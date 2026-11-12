/**
 * ⭐⭐ LUCRO POR SETOR — A LEITURA DA TELA (Fatia 2, 12/11/2026). Lei: docs/lucro-por-setor-referencia.html (v11).
 *
 * O dado por item vem do LAÇO (suit_pedido → suit_pedido_item → suit_item_opcao), S19: cada sabor
 * amarrado ao item do pedido. Por isso:
 *   • o CUSTO INTEIRO do item (S17) = ficha da base × un + ficha de cada sabor QUE FOI NELE;
 *   • o complemento HERDA o setor do produto-pai do pedido (o mapa K1–K4 da fatia 1 fica só pro
 *     dia SEM laço, dentro do motor). Sabor cujo pai não tem setor fica em SEM SETOR, contado
 *     (`orfaos`) — nunca empurrado pra um setor sem a venda do item (custo sem receita = lucro falso).
 *
 * ⛔ S0 · UMA FÁBRICA SÓ: todo custo unitário sai de `portaDeCusto` (motor.ts → hub.custoDeUmaUnidade).
 * ⛔ S4/S22 · HONESTIDADE: base sem ficha → item fora do lucro (`semBase`), nomeado; sabor sem ficha →
 *    custo "pelo menos", nomeado. Ficha vazia = SEM ficha (a porta devolve `null`).
 * ⛔ S19 · dia sem laço (XLS antigo): só o TOTAL do setor (do motor) — a quebra por item nunca se inventa.
 * ⛔ V8 · dado de cliente NÃO EXISTE aqui: o select do pedido é allowlist (sem `conteudo`/`impressao`).
 * SÓ LÊ.
 */
import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { hubCardapio, type LinhaCardapio } from '@/lib/stock/cardapio/hub'
import { montarCtx } from '@/lib/stock/vendas/baixa-venda'
import { custoMedioPorItem } from '@/lib/stock/saldo'
import { secoesPorNome } from '@/lib/stock/cardapio/secoes-db'
import { grafiaDoXls } from '@/lib/suit/materializar'
import { STATUS_FORA_DA_REGUA, somarDias } from '@/lib/suit/regua-sombra'
import { mediana, horaBrasil } from '@/lib/suit/ao-vivo'
import { diaOperacional } from '@/lib/suit/espelho'
import { relogioDaApi } from '@/lib/suit/sync'
import { CORTE_COMPLEMENTOS } from '@/lib/suit/cortes'
import { lucroPorSetorDoDia, secaoGravada, portaDeCusto, type CustoDaPorta } from './motor'
import { SEM_SETOR, NOME_SEM_SETOR } from './complemento-setor'
import { chaveDeNome, gemeoDe, ehNomeDePromo, quadrantes, type Quadrante } from './estudo'

const cent = (v: number) => Math.round((v + Math.sign(v) * 1e-9) * 100)
const reais = (c: number) => c / 100
const r3 = (v: number) => Math.round(v * 1000) / 1000

// ─── o DTO (o que a rota devolve; o que a tela desenha) ───────────────────────────────────

export interface SaborDTO {
  nome: string
  q: number
  custoUn: number | null
  custo: number | null
  /** a ficha a que o nome está ligado (pra abrir na linha); `null` = sem vínculo → "criar ficha →" */
  fichaId: string | null
}

export interface FaltaFicha {
  nome: string
  q: number
  tipo: 'PRODUTO' | 'SABOR'
  fichaId: string | null
  /** os nomes do PDV que a ficha nova tem que atender (vínculo na MESMA transação — porta do editor) */
  nomesPdv: string[]
}

export interface ItemDTO {
  chave: string
  nome: string
  nomesSuitable: string[]
  secao: string
  q: number
  vendeu: number
  /** S23 · o preço de HOJE do item: o unitário mais vendido no dia */
  preco: number
  destino: 'FICHA' | 'REVENDA' | null
  fichaId: string | null
  custoBaseUn: number | null
  custoBase: number | null
  semBase: boolean
  sabores: SaborDTO[]
  /** S17 · base + sabores com ficha ("pelo menos" quando há sabor sem ficha) */
  custo: number
  /** `null` quando a base não tem custo (S22: não se inventa conta) */
  lucro: number | null
  margem: number | null
  semFicha: FaltaFicha[]
  promo: boolean
  quadrante: Quadrante | null
}

export interface SetorDTO {
  secao: string
  nome: string
  ordem: number
  vendeu: number
  un: number
  /** o vendeu do que TEM custo de base — é sobre ele que o lucro é honesto (a régua do motor) */
  vendeuComCusto: number
  custo: number
  lucro: number
  margem: number | null
  /** S4 · o que ficou sem ficha (un somadas: base sem ficha + sabores sem ficha) */
  semFicha: FaltaFicha[]
  unSemFicha: number
  /** sabores cujo item-pai não tem setor (ficaram em SEM SETOR com ele) */
  orfaos: { sabores: number; custo: number } | null
  itens: string[]
}

export interface ReguaDoItem {
  /** o nome cuja régua vale (o próprio item ou o gêmeo a preço cheio) */
  nomeCheio: string
  /** mediana das un nos 4 mesmos dias-da-semana SEM promo; `null` = em formação */
  un: number | null
  dias: string[]
}

export interface VereditoDTO {
  secao: string
  emFormacao: boolean
  dia: { un: number; vendeu: number; custo: number; lucro: number }
  regua: { un: number; vendeu: number; custo: number; lucro: number } | null
  delta: number | null
  dias: string[]
}

export interface TelaDTO {
  dia: string
  hoje: string
  /** S1/S8 · "até HH:MM" no dia de hoje (parcial, não fecha veredito); `null` = dia fechado */
  parcial: string | null
  temDado: boolean
  temLaco: boolean
  custoBase: 'VIGENTE'
  dias: { dia: string; parcial: string | null }[]
  setores: SetorDTO[]
  itens: ItemDTO[]
  promo: { chave: string; nome: string; q: number; preco: number; usual: number | null } | null
  veredito: VereditoDTO | null
  estudo: { padrao: string | null; reguas: Record<string, ReguaDoItem> }
}

// ─── núcleo puro: o laço do dia → itens e setores ────────────────────────────────────────

export interface PedidoDoLaco {
  status: string
  sumido: boolean
  itens: { nome: string; quantidade: number; unitarioCent: number; precoCent: number; cancelado: boolean; opcoes: { nome: string; quantidade: number }[] }[]
}

export interface ProdutoResolvido {
  chave: string
  nome: string
  nomesSuitable: string[]
  secao: string | null
  destino: 'FICHA' | 'REVENDA' | null
  fichaId: string | null
  custoUn: CustoDaPorta
}

export interface OpcaoResolvida {
  alvo: 'FICHA' | 'IGNORAR' | 'SEM_MAPA'
  fichaId: string | null
  custoUn: CustoDaPorta
}

export interface Secao { chave: string; nome: string; ordem: number }

/**
 * ⭐ O LAÇO → itens (S17) e setores (S3/S4). A régua do pedido é a da materialização
 * (status ≠ abandoned, não apagado, item não cancelado) e a do complemento (ocorrência =
 * qtd da opção × qtd do item-pai) — as MESMAS que o dia fechado usa, pra K1 bater com o motor.
 */
export function montarDoLaco(opts: {
  pedidos: readonly PedidoDoLaco[]
  produto: (grafia: string) => ProdutoResolvido
  opcao: (grafia: string) => OpcaoResolvida
  secoes: readonly Secao[]
  /** chaves com promo detectada no dia (S14) */
  promos?: ReadonlySet<string>
}): { itens: ItemDTO[]; setores: SetorDTO[] } {
  const ativas = new Map(opts.secoes.map((s) => [s.chave, s]))
  type Acc = { p: ProdutoResolvido; secao: string; q: number; cent: number; porUnit: Map<number, number>; sab: Map<string, { q: number; r: OpcaoResolvida }> }
  const accs = new Map<string, Acc>()

  for (const p of opts.pedidos) {
    if (p.sumido || p.status === STATUS_FORA_DA_REGUA) continue
    for (const it of p.itens) {
      if (it.cancelado) continue
      const prod = opts.produto(grafiaDoXls(it.nome))
      let a = accs.get(prod.chave)
      if (!a) {
        const secao = prod.secao != null && ativas.has(prod.secao) ? prod.secao : SEM_SETOR
        a = { p: prod, secao, q: 0, cent: 0, porUnit: new Map(), sab: new Map() }
        accs.set(prod.chave, a)
      }
      a.q += it.quantidade
      a.cent += it.precoCent
      a.porUnit.set(it.unitarioCent, (a.porUnit.get(it.unitarioCent) ?? 0) + it.quantidade)
      for (const o of it.opcoes) {
        const g = grafiaDoXls(o.nome)
        const r = opts.opcao(g)
        if (r.alvo === 'IGNORAR') continue // tamanho, "sem cebola"… decisão do dono: sem custo, sem falta
        const s = a.sab.get(g) ?? { q: 0, r }
        s.q += o.quantidade * it.quantidade
        a.sab.set(g, s)
      }
    }
  }

  const itens: ItemDTO[] = []
  for (const a of accs.values()) {
    const q = r3(a.q)
    if (q === 0 && a.cent === 0) continue
    const precoCent = [...a.porUnit].sort((x, y) => y[1] - x[1] || y[0] - x[0])[0]?.[0] ?? (q ? Math.round(a.cent / q) : 0)
    const semBase = a.p.custoUn == null
    const custoBaseCent = semBase ? null : cent(a.p.custoUn as number) * q
    let custoCent = custoBaseCent ?? 0
    const semFicha: FaltaFicha[] = semBase ? [{ nome: a.p.nome, q, tipo: 'PRODUTO', fichaId: a.p.fichaId, nomesPdv: a.p.nomesSuitable }] : []
    const sabores: SaborDTO[] = []
    for (const [nome, s] of a.sab) {
      const qs = r3(s.q)
      if (s.r.custoUn == null) {
        semFicha.push({ nome, q: qs, tipo: 'SABOR', fichaId: s.r.fichaId, nomesPdv: [nome] })
        sabores.push({ nome, q: qs, custoUn: null, custo: null, fichaId: s.r.fichaId })
      } else {
        const c = Math.round(cent(s.r.custoUn) * qs)
        custoCent += c
        sabores.push({ nome, q: qs, custoUn: s.r.custoUn, custo: reais(c), fichaId: s.r.fichaId })
      }
    }
    sabores.sort((x, y) => y.q - x.q || x.nome.localeCompare(y.nome, 'pt-BR'))
    const lucroCent = semBase ? null : a.cent - custoCent
    itens.push({
      chave: a.p.chave, nome: a.p.nome, nomesSuitable: a.p.nomesSuitable, secao: a.secao, q, vendeu: reais(a.cent),
      preco: reais(precoCent), destino: a.p.destino, fichaId: a.p.fichaId,
      custoBaseUn: a.p.custoUn, custoBase: custoBaseCent == null ? null : reais(custoBaseCent), semBase,
      sabores, custo: reais(custoCent), lucro: lucroCent == null ? null : reais(lucroCent),
      margem: lucroCent == null || a.cent === 0 ? null : (100 * lucroCent) / a.cent,
      semFicha, promo: !!opts.promos?.has(a.p.chave), quadrante: null,
    })
  }
  itens.sort((x, y) => y.vendeu - x.vendeu || y.q - x.q || x.nome.localeCompare(y.nome, 'pt-BR'))

  // S6 · o quadrante, por setor, nas medianas reais do setor
  const porSecao = new Map<string, ItemDTO[]>()
  for (const i of itens) porSecao.set(i.secao, [...(porSecao.get(i.secao) ?? []), i])
  for (const xs of porSecao.values()) {
    const qd = quadrantes(xs)
    for (const i of xs) i.quadrante = qd.get(i.chave) ?? null
  }

  const setores: SetorDTO[] = [...porSecao].map(([secao, xs]) => {
    const s = ativas.get(secao)
    let vendeu = 0, vendeuComCusto = 0, custo = 0, un = 0, orfS = 0, orfC = 0
    const falta = new Map<string, FaltaFicha>()
    for (const i of xs) {
      vendeu += cent(i.vendeu)
      un += i.q
      if (!i.semBase) vendeuComCusto += cent(i.vendeu)
      for (const f of i.semFicha) {
        const k = `${f.tipo}:${f.nome}`
        const cur = falta.get(k)
        falta.set(k, cur ? { ...cur, q: r3(cur.q + f.q) } : { ...f })
      }
      if (secao === SEM_SETOR) for (const sb of i.sabores) { orfS += sb.q; orfC += sb.custo != null ? cent(sb.custo) : 0 }
    }
    // ⛔ item SEM BASE está fora da conta inteira (S22): nem a venda nem os sabores dele entram no
    // custo/lucro do setor — só na lista do que falta. Assim VENDEU(com custo) − CUSTO = LUCRO, sempre.
    custo = xs.filter((i) => !i.semBase).reduce((t, i) => t + cent(i.custo), 0)
    const lucro = vendeuComCusto - custo
    const semFicha = [...falta.values()].sort((x, y) => y.q - x.q || x.nome.localeCompare(y.nome, 'pt-BR'))
    return {
      secao, nome: s ? s.nome : NOME_SEM_SETOR, ordem: s ? s.ordem : 1000,
      vendeu: reais(vendeu), un: r3(un), vendeuComCusto: reais(vendeuComCusto), custo: reais(custo), lucro: reais(lucro),
      margem: vendeuComCusto > 0 ? (100 * lucro) / vendeuComCusto : null,
      semFicha, unSemFicha: r3(semFicha.reduce((t, f) => t + f.q, 0)),
      orfaos: secao === SEM_SETOR && orfS > 0 ? { sabores: r3(orfS), custo: reais(orfC) } : null,
      itens: xs.map((i) => i.chave),
    }
  })
  setores.sort((x, y) => x.ordem - y.ordem || x.nome.localeCompare(y.nome, 'pt-BR'))
  return { itens, setores }
}

// ─── núcleo puro: a história por item (promo, preço usual, régua) ───────────────────────

/** dia → chave → { un, cent } — só dias COM dado (dia sem import não é dia de zero) */
export type Historico = ReadonlyMap<string, ReadonlyMap<string, { un: number; cent: number }>>

export const SEMANAS_DA_REGUA = 4
/** quantas semanas pra trás se procura os 4 dias sem promo */
export const SEMANAS_DE_BUSCA = 8
const DIAS_DO_USUAL = 28

/** S14 · o preço usual: mediana do preço por unidade nos 28 dias antes de `dia` (dias em que vendeu) */
export function precoUsual(h: Historico, chave: string, dia: string): number | null {
  const ps: number[] = []
  for (let k = 1; k <= DIAS_DO_USUAL; k++) {
    const v = h.get(somarDias(dia, -k))?.get(chave)
    if (v && v.un > 0) ps.push(Math.round(v.cent / v.un))
  }
  return ps.length ? mediana(ps) / 100 : null
}

/** S14 · o padrão de un do item: mediana das un nos 4 mesmos dias-da-semana anteriores COM dado */
function padraoDeUn(h: Historico, chave: string, dia: string): number | null {
  const us: number[] = []
  for (let k = 1; k <= SEMANAS_DA_REGUA; k++) {
    const d = h.get(somarDias(dia, -7 * k))
    if (d) us.push(d.get(chave)?.un ?? 0)
  }
  return us.length ? mediana(us) : null
}

/**
 * ⭐ S14 · PROMO DETECTADA do item no dia:
 *   (a) vendeu abaixo do preço usual (mediana 4 semanas), ou
 *   (b) é linha PRECINHO/PROMO e vendeu ACIMA do próprio padrão (sem padrão ainda: vendeu).
 * ⚠️ O (b) pede "acima do padrão" porque o PRECINHO desta casa sai quase todo dia (medido: 57 dias);
 *    "teve PRECINHO" marcaria todo dia como promo e a régua nunca nasceria.
 */
export function emPromo(h: Historico, dia: string, chave: string, nomes: readonly string[]): boolean {
  const v = h.get(dia)?.get(chave)
  if (!v || v.un <= 0) return false
  const usual = precoUsual(h, chave, dia)
  if (usual != null && v.cent / v.un / 100 < usual - 0.01) return true
  if (nomes.some(ehNomeDePromo)) {
    const pad = padraoDeUn(h, chave, dia)
    return pad == null ? true : v.un > pad
  }
  return false
}

/**
 * ⭐ S7/S21 · OS DIAS DA RÉGUA: os mesmos dias-da-semana anteriores, COM dado e SEM promo no
 * setor — os 4 primeiros, procurando até 8 semanas. Menos de 4 = EM FORMAÇÃO (`[]`), nunca
 * uma régua de 1 dia vestida de mediana.
 */
export function diasDaRegua(h: Historico, dia: string, chavesDoSetor: ReadonlyMap<string, readonly string[]>): string[] {
  const out: string[] = []
  for (let k = 1; k <= SEMANAS_DE_BUSCA && out.length < SEMANAS_DA_REGUA; k++) {
    const d = somarDias(dia, -7 * k)
    if (!h.has(d)) continue
    let promo = false
    for (const [c, nomes] of chavesDoSetor) if (emPromo(h, d, c, nomes)) { promo = true; break }
    if (!promo) out.push(d)
  }
  return out.length >= SEMANAS_DA_REGUA ? out : []
}

/** S21/S23 · a régua de un do item (ou do gêmeo) nos dias da régua do setor */
export function reguaDeUn(h: Historico, dias: readonly string[], chaveCheio: string | null): number | null {
  if (!dias.length || chaveCheio == null) return null
  return mediana(dias.map((d) => h.get(d)?.get(chaveCheio)?.un ?? 0))
}

// ─── o invólucro que lê o banco ─────────────────────────────────────────────────────────

export const diaDeHoje = (agora: Date) => diaOperacional(relogioDaApi(agora))

/** o select do laço — ⛔ ALLOWLIST: nada de `conteudo`/`impressao` (dado de cliente não entra) */
const SELECT_LACO = {
  status: true, sumidoEm: true,
  itens: { select: { nome: true, quantidade: true, unitarioCent: true, precoCent: true, canceladoEm: true, opcoes: { select: { nome: true, quantidade: true } } } },
} as const

async function lerLaco(db: PrismaClient, companyId: string, dia: string) {
  const ps = await db.suitPedido.findMany({ where: { companyId, dia }, select: SELECT_LACO })
  return {
    pedidos: ps.map((p): PedidoDoLaco => ({
      status: p.status, sumido: !!p.sumidoEm,
      itens: p.itens.map((i) => ({ nome: i.nome, quantidade: i.quantidade, unitarioCent: i.unitarioCent, precoCent: i.precoCent, cancelado: !!i.canceladoEm, opcoes: i.opcoes })),
    })),
  }
}

/** S1 · os dias que têm dado (import do dia ou laço), do mais novo pro mais velho */
async function diasComDado(db: PrismaClient, companyId: string, hoje: string, n = 7): Promise<string[]> {
  const desde = somarDias(hoje, -21)
  const [imps, hojeTem] = await Promise.all([
    db.stockVendaImport.findMany({ where: { companyId, data: { gte: new Date(`${desde}T00:00:00Z`) } }, select: { data: true } }),
    db.suitPedido.count({ where: { companyId, dia: hoje } }),
  ])
  const set = new Set(imps.map((i) => i.data.toISOString().slice(0, 10)))
  if (hojeTem > 0) set.add(hoje)
  return [...set].filter((d) => d <= hoje).sort().reverse().slice(0, n)
}

/** o dia tem laço? a partir do corte dos complementos pela API, com pedidos, e não é dia de XLS */
async function temLacoNoDia(db: PrismaClient, companyId: string, dia: string, pedidos: number): Promise<boolean> {
  if (dia < CORTE_COMPLEMENTOS || pedidos === 0) return false
  const [mat, imp] = await Promise.all([
    db.suitDiaMaterializado.findUnique({ where: { companyId_dia: { companyId, dia } }, select: { id: true } }),
    db.stockVendaImport.findUnique({ where: { companyId_data: { companyId, data: new Date(`${dia}T12:00:00`) } }, select: { id: true } }),
  ])
  return !!mat || !imp
}

/** O resolvedor de nomes do PDV → produto (destino, custo, seção) e → complemento (alvo, custo). */
export async function resolvedores(companyId: string, db: PrismaClient = defaultPrisma) {
  const [hub, ctx, custoDe, gravadas, secoes, mapComp] = await Promise.all([
    hubCardapio(companyId, {}, db),
    montarCtx(companyId, db),
    custoMedioPorItem(db, companyId),
    secoesPorNome(companyId, db),
    db.stockCardapioSecao.findMany({ where: { companyId, ativo: true }, select: { chave: true, nome: true, ordem: true } }),
    db.stockVendaComplementoMap.findMany({ where: { companyId }, select: { nomeSuitable: true, alvoTipo: true, fichaId: true } }),
  ])
  const porta = portaDeCusto(ctx, custoDe)
  const porNome = new Map<string, LinhaCardapio>()
  for (const l of [...hub.linhas, ...hub.ignorados]) for (const n of l.nomesSuitable.length ? l.nomesSuitable : [l.nome]) if (!porNome.has(n)) porNome.set(n, l)
  const cacheP = new Map<string, ProdutoResolvido>()
  const produto = (grafia: string): ProdutoResolvido => {
    const c = cacheP.get(grafia)
    if (c) return c
    const l = porNome.get(grafia)
    const r: ProdutoResolvido = l
      ? {
          chave: l.chave, nome: l.nome, nomesSuitable: l.nomesSuitable.length ? l.nomesSuitable : [grafia],
          secao: secaoGravada(l.nomesSuitable.length ? l.nomesSuitable : [grafia], gravadas, l.nome),
          destino: l.status === 'IGNORADO' ? null : l.destinoTipo, fichaId: l.fichaId, custoUn: porta.produto(l),
        }
      : // ⭐ nome que o PDV nunca mandou antes: a régua do hub pra nome sem destino (`nome:<grafia>`)
        { chave: `nome:${grafia}`, nome: grafia, nomesSuitable: [grafia], secao: secaoGravada([grafia], gravadas, grafia), destino: null, fichaId: null, custoUn: null }
    cacheP.set(grafia, r)
    return r
  }
  const mapa = new Map(mapComp.map((m) => [m.nomeSuitable, m]))
  const opcao = (grafia: string): OpcaoResolvida => {
    const m = mapa.get(grafia)
    const alvo: OpcaoResolvida['alvo'] = m?.alvoTipo === 'IGNORAR' ? 'IGNORAR' : m?.alvoTipo === 'FICHA' && m.fichaId ? 'FICHA' : 'SEM_MAPA'
    return { alvo, fichaId: alvo === 'FICHA' ? m!.fichaId : null, custoUn: porta.complemento(alvo, m?.fichaId ?? null) }
  }
  /** chave do hub de cada nome do PDV (pra montar o histórico das linhas antigas) */
  const chaveDoNome = (n: string) => produto(grafiaDoXls(n)).chave
  return { produto, opcao, secoes, chaveDoNome, linhas: [...hub.linhas, ...hub.ignorados], gravadas }
}

/** dia → chave → {un, cent}, das linhas de PRODUTO (XLS ou API materializada) — só dias com import */
async function lerHistorico(db: PrismaClient, companyId: string, dia: string, chaveDoNome: (n: string) => string): Promise<Map<string, Map<string, { un: number; cent: number }>>> {
  const desde = somarDias(dia, -(7 * SEMANAS_DE_BUSCA * 2 + DIAS_DO_USUAL))
  const ls = await db.stockVendaLinha.findMany({
    where: { companyId, data: { gte: new Date(`${desde}T00:00:00Z`), lt: new Date(`${dia}T00:00:00Z`) } },
    select: { data: true, nomeSuitable: true, quantidade: true, valorTotal: true },
  })
  const h = new Map<string, Map<string, { un: number; cent: number }>>()
  for (const l of ls) {
    const d = l.data.toISOString().slice(0, 10)
    const m = h.get(d) ?? new Map<string, { un: number; cent: number }>()
    const k = chaveDoNome(l.nomeSuitable)
    const cur = m.get(k) ?? { un: 0, cent: 0 }
    cur.un += l.quantidade
    cur.cent += cent(l.valorTotal)
    m.set(k, cur)
    h.set(d, m)
  }
  return h
}

/** ⭐ A TELA DO DIA — tudo que a primeira carga desenha. */
export async function lerTelaDoDia(companyId: string, dia: string, agora: Date, db: PrismaClient = defaultPrisma): Promise<TelaDTO> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) throw new Error(`dia inválido: ${dia}`)
  const hoje = diaDeHoje(agora)
  const [laco, dias, rs, matHoje, vistoHoje] = await Promise.all([
    lerLaco(db, companyId, dia), diasComDado(db, companyId, hoje), resolvedores(companyId, db),
    db.suitDiaMaterializado.findUnique({ where: { companyId_dia: { companyId, dia: hoje } }, select: { id: true } }),
    db.suitPedido.aggregate({ where: { companyId, dia: hoje }, _max: { vistoUltimoEm: true } }),
  ])
  const temLaco = await temLacoNoDia(db, companyId, dia, laco.pedidos.length)
  // S1/S8 · "até HH:MM" = o último ciclo REAL do sincronizador que viu o dia (nunca depois de agora)
  const v = vistoHoje._max.vistoUltimoEm
  const parcialHoje = matHoje ? null : `até ${horaBrasil(v && v < agora ? v : agora)}`
  const parcial = dia === hoje ? parcialHoje : null
  const chips = dias.map((d) => ({ dia: d, parcial: d === hoje ? parcialHoje : null }))
  const vazio: TelaDTO = { dia, hoje, parcial, temDado: false, temLaco: false, custoBase: 'VIGENTE', dias: chips, setores: [], itens: [], promo: null, veredito: null, estudo: { padrao: null, reguas: {} } }

  if (!temLaco) {
    // S19 · sem laço: só o TOTAL por setor, do motor (o que o import do dia guardou)
    const imp = await db.stockVendaImport.findUnique({ where: { companyId_data: { companyId, data: new Date(`${dia}T12:00:00`) } }, select: { id: true } })
    if (!imp) return vazio
    const m = await lucroPorSetorDoDia(companyId, dia, db)
    return {
      ...vazio, temDado: true,
      setores: m.setores.map((s) => {
        const semFicha: FaltaFicha[] = [
          ...s.semFicha.map((f) => ({ nome: f.nome, q: f.un, tipo: 'PRODUTO' as const, fichaId: null, nomesPdv: [] })),
          ...s.complementosSemFicha.map((f) => ({ nome: f.nome, q: f.ocorrencias, tipo: 'SABOR' as const, fichaId: null, nomesPdv: [] })),
        ]
        return {
          secao: s.secao, nome: s.nome, ordem: s.ordem, vendeu: s.vendeu, un: s.un, vendeuComCusto: s.vendeuComCusto,
          custo: s.custo, lucro: s.lucro, margem: s.vendeuComCusto > 0 ? (100 * s.lucro) / s.vendeuComCusto : null,
          semFicha, unSemFicha: semFicha.reduce((t, f) => t + f.q, 0), orfaos: null, itens: [],
        }
      }),
    }
  }

  // o histórico (régua/usual) + o dia de hoje vindo do laço
  const h = await lerHistorico(db, companyId, dia, rs.chaveDoNome)
  const semPromo = montarDoLaco({ pedidos: laco.pedidos, produto: rs.produto, opcao: rs.opcao, secoes: rs.secoes })
  const doDia = new Map<string, { un: number; cent: number }>()
  for (const i of semPromo.itens) doDia.set(i.chave, { un: i.q, cent: cent(i.vendeu) })
  h.set(dia, doDia)

  const chavesDe = (secao: string) => new Map(semPromo.itens.filter((i) => i.secao === secao).map((i) => [i.chave, i.nomesSuitable.concat(i.nome)] as const))
  // ⭐ o setor de uma chave do histórico que não vendeu hoje entra na régua do setor também
  const secaoDaChave = new Map<string, string>()
  for (const l of rs.linhas) secaoDaChave.set(l.chave, secaoGravada(l.nomesSuitable.length ? l.nomesSuitable : [l.nome], rs.gravadas, l.nome) ?? SEM_SETOR)
  const nomesDaChave = new Map<string, string[]>()
  for (const l of rs.linhas) nomesDaChave.set(l.chave, l.nomesSuitable.concat(l.nome))
  const chavesDoSetor = (secao: string) => {
    const m = new Map<string, readonly string[]>(chavesDe(secao))
    for (const [c, s] of secaoDaChave) if (s === secao && !m.has(c)) m.set(c, nomesDaChave.get(c) ?? [])
    return m
  }

  const promos = new Set(semPromo.itens.filter((i) => emPromo(h, dia, i.chave, i.nomesSuitable.concat(i.nome))).map((i) => i.chave))
  const { itens, setores } = montarDoLaco({ pedidos: laco.pedidos, produto: rs.produto, opcao: rs.opcao, secoes: rs.secoes, promos })

  // a chave do gêmeo a preço cheio, pelo nome do item ou pelos apelidos do PDV
  const chavePorNome = new Map<string, string>()
  for (const l of rs.linhas) for (const n of l.nomesSuitable.concat(l.nome)) if (!chavePorNome.has(chaveDeNome(n))) chavePorNome.set(chaveDeNome(n), l.chave)

  const cacheDias = new Map<string, string[]>()
  const diasDoSetor = (secao: string) => {
    if (!cacheDias.has(secao)) cacheDias.set(secao, diasDaRegua(h, dia, chavesDoSetor(secao)))
    return cacheDias.get(secao)!
  }
  const reguas: Record<string, ReguaDoItem> = {}
  for (const i of itens) {
    const g = gemeoDe(i.nomesSuitable.concat(i.nome))
    const chaveCheio = g ? chavePorNome.get(chaveDeNome(g)) ?? null : i.chave
    const ds = diasDoSetor(i.secao)
    reguas[i.chave] = { nomeCheio: g ?? i.nome, un: reguaDeUn(h, ds, chaveCheio), dias: ds }
  }

  // S14 · o cartão da promo: a de maior venda; "normal" = o usual do gêmeo (ou do próprio)
  const pr = itens.filter((i) => i.promo).sort((x, y) => y.vendeu - x.vendeu)[0] ?? null
  let promo: TelaDTO['promo'] = null
  if (pr) {
    const g = gemeoDe(pr.nomesSuitable.concat(pr.nome))
    const cUsual = g ? chavePorNome.get(chaveDeNome(g)) ?? null : pr.chave
    promo = { chave: pr.chave, nome: pr.nome, q: pr.q, preco: pr.preco, usual: cUsual ? precoUsual(h, cUsual, dia) : null }
  }

  // S7/S8 · o veredito do setor da promo — dia parcial não fecha veredito
  let veredito: VereditoDTO | null = null
  if (pr && !parcial) {
    const s = setores.find((x) => x.secao === pr.secao)!
    const ds = diasDoSetor(pr.secao)
    const doDiaS = { un: s.un, vendeu: s.vendeu, custo: s.custo, lucro: s.lucro }
    if (ds.length) {
      const ms = await Promise.all(ds.map((d) => lucroPorSetorDoDia(companyId, d, db)))
      const xs = ms.map((m) => m.setores.find((x) => x.secao === pr.secao) ?? { un: 0, vendeu: 0, custo: 0, lucro: 0 })
      const med = (f: (x: { un: number; vendeu: number; custo: number; lucro: number }) => number) => mediana(xs.map((x) => cent(f(x)))) / 100
      const regua = { un: med((x) => x.un), vendeu: med((x) => x.vendeu), custo: med((x) => x.custo), lucro: med((x) => x.lucro) }
      veredito = { secao: pr.secao, emFormacao: false, dia: doDiaS, regua, delta: reais(cent(s.lucro) - cent(regua.lucro)), dias: ds }
    } else {
      veredito = { secao: pr.secao, emFormacao: true, dia: doDiaS, regua: null, delta: null, dias: [] }
    }
  }

  const top = [...itens].sort((x, y) => y.vendeu - x.vendeu)[0] ?? null
  return {
    dia, hoje, parcial, temDado: true, temLaco: true, custoBase: 'VIGENTE', dias: chips, setores, itens, promo, veredito,
    estudo: { padrao: pr?.chave ?? top?.chave ?? null, reguas },
  }
}

// ─── "ver pedidos →" (S19: todo número desce até o pedido) ───────────────────────────────

export interface PedidoDoItemDTO {
  numero: string
  hora: string
  q: number
  sabores: string[]
}

/** os pedidos REAIS do laço que formaram o número de um item — ⛔ nº, hora, item, sabores; cliente nunca */
export async function pedidosDoItem(companyId: string, dia: string, chave: string, db: PrismaClient = defaultPrisma): Promise<PedidoDoItemDTO[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) throw new Error(`dia inválido: ${dia}`)
  const rs = await resolvedores(companyId, db)
  const ps = await db.suitPedido.findMany({
    where: { companyId, dia, sumidoEm: null, NOT: { status: STATUS_FORA_DA_REGUA } },
    // ⛔ ALLOWLIST: nº de exibição, id da API (fallback do nº), hora, itens e sabores
    select: { apiId: true, displayNumber: true, criadoApiEm: true, itens: { select: { nome: true, quantidade: true, canceladoEm: true, opcoes: { select: { nome: true, quantidade: true }, orderBy: { ordem: 'asc' } } } } },
    orderBy: { criadoApiEm: 'asc' },
  })
  const out: PedidoDoItemDTO[] = []
  for (const p of ps) {
    for (const it of p.itens) {
      if (it.canceladoEm || rs.produto(grafiaDoXls(it.nome)).chave !== chave) continue
      const sabores = it.opcoes
        .filter((o) => rs.opcao(grafiaDoXls(o.nome)).alvo !== 'IGNORAR')
        .map((o) => (o.quantidade !== 1 ? `${r3(o.quantidade)}× ${grafiaDoXls(o.nome)}` : grafiaDoXls(o.nome)))
      out.push({ numero: `#${p.displayNumber ?? p.apiId}`, hora: horaBrasil(p.criadoApiEm), q: r3(it.quantidade), sabores })
    }
  }
  return out
}
