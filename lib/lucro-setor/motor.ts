/**
 * ⭐⭐ LUCRO POR SETOR — O MOTOR DO SETOR-DIA (Fatia 1, 10/11/2026). Lei: docs/lucro-por-setor-referencia.html.
 *
 * Por setor (seção do cardápio) de UM dia: vendeu R$ · un · custo (produtos + complementos
 * atribuídos) · o que ficou sem ficha · as linhas por produto.
 *
 * ⛔⛔ PORTA ÚNICA DE CUSTO: todo custo unitário — produto (FICHA ou REVENDA) e complemento —
 *    sai de `custoDeUmaUnidade` (lib/stock/cardapio/hub.ts). Aqui não existe `explodir` nem
 *    `custoDe.get`. (A casa já tem duas cópias dessa conta: `custoPorSabor` no lerMargem e
 *    `custoDeUmaFicha` no montador — débito registrado; não é aqui que nasce a terceira.)
 *
 * ⚠️ O CUSTO É O VIGENTE (custo médio de hoje do ledger), aplicado às unidades DAQUELE dia —
 *    rotulado `custoBase: 'VIGENTE'`. NÃO é "o custo daquela data": custo histórico por época
 *    é evolução futura. E NUNCA é média do período × unidades do dia (o atalho do por-dia.ts):
 *    vendeu e un são os do dia, lidos do dia.
 *
 * ⛔ HONESTIDADE (lei S4): produto sem custo NUNCA entra no custo por estimativa — nem o
 *    `custoParcial` do hub. Ele vai pra `semFicha` (nome · un · R$), e o lucro do setor é
 *    sobre o que TEM custo (`vendeuComCusto − custo`).
 * ⛔ SEM SETOR (lei S11): produto sem seção gravada, seção inativa e complemento sem atribuição
 *    caem num setor próprio, visível — nunca somados em silêncio num setor qualquer.
 * ⛔ AUSÊNCIA ≠ ZERO: dia sem relatório de complementos tem `custoComplementos: null` e
 *    `custoCompleto: false` — não um custo de complemento 0.
 *
 * SÓ LÊ. Nenhuma escrita (não usa `secoesDaEmpresa`, que semeia quando vazio).
 */
import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { hubCardapio, custoDeUmaUnidade, type LinhaCardapio } from '@/lib/stock/cardapio/hub'
import { montarCtx } from '@/lib/stock/vendas/baixa-venda'
import { custoMedioPorItem } from '@/lib/stock/saldo'
import { secoesPorNome, secaoDaLinha } from '@/lib/stock/cardapio/secoes-db'
import { gruposVigentes, type GrupoComplemento } from '@/lib/stock/vendas/grupo-complemento'
import { janelaDoDiaSP } from '@/lib/datas/dia-sao-paulo'
import { diaUtc } from '@/lib/stock/vendas/dia-dispensado'
import { setorDoComplemento, SEM_SETOR, NOME_SEM_SETOR } from './complemento-setor'

// ─── entradas do núcleo puro ────────────────────────────────────────────────────────────

/** custo de 1 unidade como a porta devolve: `null` = sem custo (nunca 0) */
export type CustoDaPorta = number | null

export interface ProdutoDoDia {
  chave: string
  nome: string
  nomesSuitable: readonly string[]
  un: number
  vendeu: number // R$ do dia
  custoUn: CustoDaPorta
  /** ⭐ E3 · ingredientes SEM PREÇO da ficha (o custo é parcial — "pelo menos"); vazio/ausente = completo */
  faltaPreco?: readonly string[]
  /** a seção do produto, já resolvida; `null` = sem seção gravada */
  secao: string | null
}

export interface ComplementoDoDia {
  nomeSuitable: string
  ocorrencias: number
  alvo: 'FICHA' | 'IGNORAR' | 'SEM_MAPA'
  custoUn: CustoDaPorta
  /** ⭐ E3 · ingredientes sem preço da ficha do complemento */
  faltaPreco?: readonly string[]
  grupo: GrupoComplemento
}

export interface Secao {
  chave: string
  nome: string
  ordem: number
}

// ─── saída ──────────────────────────────────────────────────────────────────────────────

export interface LinhaDoProduto {
  chave: string
  nome: string
  un: number
  vendeu: number
  custoUn: CustoDaPorta
  /** custo do dia = custoUn × un; `null` quando não há custo */
  custo: number | null
  /** ⭐ E3 · ingredientes sem preço (custo é "pelo menos"); `[]` = completo */
  faltaPreco: string[]
}

export interface LinhaDoComplemento {
  nome: string
  ocorrencias: number
  custoUn: CustoDaPorta
  custo: number | null
  faltaPreco: string[]
  porQue: string
}

export interface SetorDoDia {
  secao: string
  nome: string
  ordem: number
  vendeu: number
  un: number
  vendeuComCusto: number
  unComCusto: number
  custoProdutos: number
  /** `null` = o dia não tem relatório de complementos (ausência ≠ zero) */
  custoComplementos: number | null
  /** custoProdutos + (custoComplementos ?? 0) — confira `custoCompleto` antes de ler como inteiro */
  custo: number
  custoCompleto: boolean
  /** vendeuComCusto − custo: o lucro do que TEM custo */
  lucro: number
  semFicha: { nome: string; un: number; vendeu: number }[]
  complementosSemFicha: { nome: string; ocorrencias: number }[]
  /** ⭐ E3 · produto COM custo parcial (ingrediente sem preço): entra no custo, nomeado aqui */
  semPreco: { nome: string; un: number; faltantes: string[] }[]
  complementosSemPreco: { nome: string; ocorrencias: number; faltantes: string[] }[]
  produtos: LinhaDoProduto[]
  complementos: LinhaDoComplemento[]
}

export interface LucroPorSetorDoDia {
  dia: string
  custoBase: 'VIGENTE'
  setores: SetorDoDia[]
  totais: { vendeu: number; un: number; custo: number; lucro: number; unComCusto: number }
  complementos: {
    temRelatorio: boolean
    ocorrencias: number
    /** o dono marcou IGNORAR (tamanho, "não desejo borda"...): sem custo, sem setor — contado */
    ignorados: { nome: string; ocorrencias: number }[]
  }
}

// ─── núcleo puro (em centavos: K2 fecha ao centavo) ──────────────────────────────────────

const cent = (v: number) => Math.round((v + Math.sign(v) * 1e-9) * 100)
const reais = (c: number) => c / 100

interface Acc {
  secao: string
  nome: string
  ordem: number
  vendeu: number
  un: number
  vendeuComCusto: number
  unComCusto: number
  custoProdutos: number
  custoComplementos: number
  produtos: LinhaDoProduto[]
  complementos: LinhaDoComplemento[]
  semFicha: { nome: string; un: number; vendeu: number }[]
  complementosSemFicha: { nome: string; ocorrencias: number }[]
  semPreco: { nome: string; un: number; faltantes: string[] }[]
  complementosSemPreco: { nome: string; ocorrencias: number; faltantes: string[] }[]
}

export function montarSetores(opts: {
  dia: string
  produtos: readonly ProdutoDoDia[]
  secoes: readonly Secao[]
  /** `null` = o dia não tem relatório de complementos */
  complementos: readonly ComplementoDoDia[] | null
}): LucroPorSetorDoDia {
  const ativas = new Map(opts.secoes.map((s) => [s.chave, s]))
  const accs = new Map<string, Acc>()
  const acc = (chave: string | null): Acc => {
    const s = chave != null ? ativas.get(chave) : undefined
    const k = s ? s.chave : SEM_SETOR // seção inexistente/inativa também é SEM SETOR
    let a = accs.get(k)
    if (!a) {
      a = {
        secao: k, nome: s ? s.nome : NOME_SEM_SETOR, ordem: s ? s.ordem : 1000,
        vendeu: 0, un: 0, vendeuComCusto: 0, unComCusto: 0, custoProdutos: 0, custoComplementos: 0,
        produtos: [], complementos: [], semFicha: [], complementosSemFicha: [], semPreco: [], complementosSemPreco: [],
      }
      accs.set(k, a)
    }
    return a
  }

  for (const p of opts.produtos) {
    if (p.un === 0 && p.vendeu === 0) continue
    const a = acc(p.secao)
    const v = cent(p.vendeu)
    a.vendeu += v
    a.un += p.un
    if (p.custoUn == null) {
      a.semFicha.push({ nome: p.nome, un: p.un, vendeu: reais(v) })
      a.produtos.push({ chave: p.chave, nome: p.nome, un: p.un, vendeu: reais(v), custoUn: null, custo: null, faltaPreco: [...(p.faltaPreco ?? [])] })
    } else {
      const c = cent(p.custoUn) * p.un
      a.custoProdutos += c
      a.vendeuComCusto += v
      a.unComCusto += p.un
      const falta = [...(p.faltaPreco ?? [])]
      if (falta.length) a.semPreco.push({ nome: p.nome, un: p.un, faltantes: falta })
      a.produtos.push({ chave: p.chave, nome: p.nome, un: p.un, vendeu: reais(v), custoUn: p.custoUn, custo: reais(c), faltaPreco: falta })
    }
  }

  const ignorados: { nome: string; ocorrencias: number }[] = []
  let ocorrencias = 0
  for (const c of opts.complementos ?? []) {
    ocorrencias += c.ocorrencias
    if (c.alvo === 'IGNORAR') {
      ignorados.push({ nome: c.nomeSuitable, ocorrencias: c.ocorrencias })
      continue
    }
    const destino = setorDoComplemento(c.nomeSuitable, c.grupo)
    const a = acc(destino.secao)
    if (c.custoUn == null) {
      a.complementosSemFicha.push({ nome: c.nomeSuitable, ocorrencias: c.ocorrencias })
      a.complementos.push({ nome: c.nomeSuitable, ocorrencias: c.ocorrencias, custoUn: null, custo: null, faltaPreco: [...(c.faltaPreco ?? [])], porQue: destino.porQue })
    } else {
      const k = cent(c.custoUn) * c.ocorrencias
      a.custoComplementos += k
      const falta = [...(c.faltaPreco ?? [])]
      if (falta.length) a.complementosSemPreco.push({ nome: c.nomeSuitable, ocorrencias: c.ocorrencias, faltantes: falta })
      a.complementos.push({ nome: c.nomeSuitable, ocorrencias: c.ocorrencias, custoUn: c.custoUn, custo: reais(k), faltaPreco: falta, porQue: destino.porQue })
    }
  }

  const temRelatorio = opts.complementos != null
  const porVendeu = <T extends { vendeu?: number; un?: number; ocorrencias?: number; nome: string }>(xs: T[]) =>
    xs.sort((x, y) => (y.vendeu ?? 0) - (x.vendeu ?? 0) || (y.un ?? y.ocorrencias ?? 0) - (x.un ?? x.ocorrencias ?? 0) || x.nome.localeCompare(y.nome, 'pt-BR'))

  const setores: SetorDoDia[] = [...accs.values()]
    .sort((x, y) => x.ordem - y.ordem || x.nome.localeCompare(y.nome, 'pt-BR'))
    .map((a) => {
      const custo = a.custoProdutos + (temRelatorio ? a.custoComplementos : 0)
      return {
        secao: a.secao, nome: a.nome, ordem: a.ordem,
        vendeu: reais(a.vendeu), un: a.un,
        vendeuComCusto: reais(a.vendeuComCusto), unComCusto: a.unComCusto,
        custoProdutos: reais(a.custoProdutos),
        custoComplementos: temRelatorio ? reais(a.custoComplementos) : null,
        custo: reais(custo),
        // ⛔ E3 · custo PARCIAL (ingrediente sem preço) não é custo completo
        custoCompleto: temRelatorio && a.semFicha.length === 0 && a.complementosSemFicha.length === 0 && a.semPreco.length === 0 && a.complementosSemPreco.length === 0,
        lucro: reais(a.vendeuComCusto - custo),
        semFicha: porVendeu(a.semFicha),
        complementosSemFicha: porVendeu(a.complementosSemFicha),
        semPreco: a.semPreco.sort((x, y) => y.un - x.un || x.nome.localeCompare(y.nome, 'pt-BR')),
        complementosSemPreco: a.complementosSemPreco.sort((x, y) => y.ocorrencias - x.ocorrencias || x.nome.localeCompare(y.nome, 'pt-BR')),
        produtos: porVendeu(a.produtos),
        complementos: a.complementos.sort((x, y) => (y.custo ?? 0) - (x.custo ?? 0) || y.ocorrencias - x.ocorrencias),
      }
    })

  const tot = [...accs.values()].reduce(
    (t, a) => {
      const custo = a.custoProdutos + (temRelatorio ? a.custoComplementos : 0)
      return { v: t.v + a.vendeu, un: t.un + a.un, c: t.c + custo, l: t.l + a.vendeuComCusto - custo, uc: t.uc + a.unComCusto }
    },
    { v: 0, un: 0, c: 0, l: 0, uc: 0 },
  )

  return {
    dia: opts.dia,
    custoBase: 'VIGENTE',
    setores,
    totais: { vendeu: reais(tot.v), un: tot.un, custo: reais(tot.c), lucro: reais(tot.l), unComCusto: tot.uc },
    complementos: { temRelatorio, ocorrencias, ignorados: ignorados.sort((x, y) => y.ocorrencias - x.ocorrencias) },
  }
}

// ─── o invólucro que lê o banco ─────────────────────────────────────────────────────────

/** a seção do produto pela marcação GRAVADA. ⛔ Sem gravada → `null` (SEM SETOR), nunca a sugestão por palavra. */
export function secaoGravada(
  nomesSuitable: readonly string[],
  gravadas: Awaited<ReturnType<typeof secoesPorNome>>,
  nome: string,
): string | null {
  if (!nomesSuitable.some((n) => gravadas.has(n))) return null
  return secaoDaLinha(nomesSuitable, gravadas, nome).secao
}

export interface EntradasDoDia {
  dia: string
  produtos: ProdutoDoDia[]
  secoes: Secao[]
  complementos: ComplementoDoDia[] | null
}

/** O motor inteiro: lê as entradas do dia e monta os setores. */
export async function lucroPorSetorDoDia(
  companyId: string,
  dia: string,
  db: PrismaClient = defaultPrisma,
): Promise<LucroPorSetorDoDia> {
  return montarSetores(await lerEntradasDoDia(companyId, dia, db))
}

/**
 * ⭐ A PORTA DE CUSTO DO SETOR-DIA (12/11) — produto e complemento, um lugar só. A tela (laço
 * pedido→item→sabores, `tela.ts`) usa ESTA mesma, nunca uma cópia: o custo da linha do motor
 * e o custo do item da tela não podem divergir por régua.
 */
export interface CustoMarcado {
  /** o custo de 1 unidade: completo OU parcial (veja `completo`); `null` = sem custo nenhum */
  custo: CustoDaPorta
  /** ⭐ E3 · `false` = algum ingrediente sem preço — o custo é "pelo menos" */
  completo: boolean
  faltantes: string[]
}
const SEM_CUSTO: CustoMarcado = { custo: null, completo: false, faltantes: [] }

export function portaDeCusto(ctx: Awaited<ReturnType<typeof montarCtx>>, custoDe: Map<string, number | null>) {
  const fichasValidas = new Set(ctx.componentesByFicha.keys())
  const marcado = (r: ReturnType<typeof custoDeUmaUnidade>): CustoMarcado => ({ custo: r.custo, completo: r.completo, faltantes: r.faltantes })
  return {
    produto(l: Pick<LinhaCardapio, 'destinoTipo' | 'fichaId' | 'status' | 'itemId'>): CustoMarcado {
      if (l.status === 'IGNORADO') return SEM_CUSTO
      if (l.destinoTipo === 'FICHA' && l.fichaId && l.status !== 'SEM_FICHA' && fichasValidas.has(l.fichaId)) {
        return marcado(custoDeUmaUnidade({ tipo: 'FICHA', fichaId: l.fichaId }, ctx, custoDe))
      }
      if (l.destinoTipo === 'REVENDA' && l.itemId) {
        return marcado(custoDeUmaUnidade({ tipo: 'REVENDA', itemId: l.itemId }, ctx, custoDe))
      }
      return SEM_CUSTO
    },
    complemento(alvo: ComplementoDoDia['alvo'], fichaId: string | null): CustoMarcado {
      return alvo === 'FICHA' && fichaId && fichasValidas.has(fichaId)
        ? marcado(custoDeUmaUnidade({ tipo: 'FICHA', fichaId }, ctx, custoDe))
        : SEM_CUSTO
    },
  }
}

/** Lê do banco tudo o que o núcleo puro precisa — e todo custo sai daqui, pela porta. */
export async function lerEntradasDoDia(
  companyId: string,
  dia: string,
  db: PrismaClient = defaultPrisma,
): Promise<EntradasDoDia> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) throw new Error(`dia inválido: ${dia}`)
  const j = janelaDoDiaSP(dia)
  const de = j.de
  const ate = new Date(j.ate.getTime() + 1) // o hub filtra `lt`

  const [hub, ctx, custoDe, gravadas, secoes, compLinhas, mapComp] = await Promise.all([
    hubCardapio(companyId, { de, ate }, db),
    montarCtx(companyId, db),
    custoMedioPorItem(db, companyId),
    secoesPorNome(companyId, db),
    db.stockCardapioSecao.findMany({ where: { companyId, ativo: true }, select: { chave: true, nome: true, ordem: true } }),
    // ⛔ (12/11) o complemento NÃO se lê pela janela SP: o funil grava `data = diaUtc(dia)`
    // (dia 00:00Z = 21:00 do dia ANTERIOR em Brasília). Pela janela 03:00Z→03:00Z o motor lia
    // o relatório do dia SEGUINTE — medido em prod: 10/11 sem sabor nenhum, 09/11 com os 376 de 10/11.
    db.stockVendaComplementoLinha.findMany({
      where: { companyId, data: diaUtc(dia) },
      select: { nomeSuitable: true, ocorrencias: true },
    }),
    db.stockVendaComplementoMap.findMany({ where: { companyId }, select: { nomeSuitable: true, alvoTipo: true, fichaId: true } }),
  ])

  const porta = portaDeCusto(ctx, custoDe)
  const custoDoProduto = porta.produto

  // ⚠️ o ignorado do CARDÁPIO (produto) segue a decisão do dono e entra como SEM CUSTO no seu
  //    setor — some do custo, mas a venda dele NÃO some do dia (K1 conta tudo que o PDV vendeu).
  const produtos: ProdutoDoDia[] = [...hub.linhas, ...hub.ignorados]
    .filter((l) => l.vendasQtd !== 0 || l.vendasValor !== 0)
    .map((l) => ({
      chave: l.chave, nome: l.nome, nomesSuitable: l.nomesSuitable, un: l.vendasQtd, vendeu: l.vendasValor,
      ...(() => { const k = custoDoProduto(l); return { custoUn: k.custo, faltaPreco: k.faltantes } })(),
      secao: secaoGravada(l.nomesSuitable, gravadas, l.nome),
    }))

  let complementos: ComplementoDoDia[] | null = null
  if (compLinhas.length > 0) {
    const porNome = new Map<string, number>()
    for (const c of compLinhas) porNome.set(c.nomeSuitable, (porNome.get(c.nomeSuitable) ?? 0) + c.ocorrencias)
    const mapa = new Map(mapComp.map((m) => [m.nomeSuitable, m]))
    const grupos = await gruposVigentes(companyId, [...porNome.keys()], db)
    complementos = [...porNome].map(([nome, oc]) => {
      const m = mapa.get(nome)
      const alvo: ComplementoDoDia['alvo'] = m?.alvoTipo === 'IGNORAR' ? 'IGNORAR' : m?.alvoTipo === 'FICHA' && m.fichaId ? 'FICHA' : 'SEM_MAPA'
      const k = porta.complemento(alvo, m?.fichaId ?? null)
      return { nomeSuitable: nome, ocorrencias: oc, alvo, custoUn: k.custo, faltaPreco: k.faltantes, grupo: grupos.get(nome)?.grupo ?? 'OUTRO' }
    })
  }

  return { dia, produtos, secoes, complementos }
}
