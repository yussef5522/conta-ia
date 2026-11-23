// ⭐⭐⭐ CONTAGEM COM DIREÇÃO — o motor da lei v3 (23/11/2026, docs/contagem-referencia.html).
//
// R36 o que conta hoje (grupos + ritmo, atrasados primeiro, sem zona no FIM) · R37 zonas como
// mapa (anel, última contagem, AO VIVO, assinatura) · R40 acuracidade como placar · R41 a
// história do item · R42 o recibo · R43 as zonas do dono.
//
// ⚠️ TUDO É DERIVADO das contagens já gravadas (`stock_contagem_item` = o número final de cada
// item em cada sessão; `stock_contagem_versao` = o rastro). Nada é materializado: acuracidade,
// histórico bateu/ajustou e "nunca bate" se recomputam do ledger da contagem.
// ⚠️ O relógio NÃO decide: `agora` é parâmetro; "dia" é o dia do BRASIL.
import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { CATEGORIAS_SEM_PRATELEIRA } from '@/lib/stock/tipos-ficha'
import { saldosDaEmpresa, saldoItem, TIPOS_FORA_DA_PRATELEIRA, idsDeEstornoInterno } from '@/lib/stock/saldo'
import { TIPOS } from '@/lib/stock/real-vs-teorico'
import { consumoDoItem, JANELA_CONSUMO_DIAS, type MovimentoParaConsumo } from '@/lib/stock/item/consumo-e-cobertura'
import { diaDoBrasil } from '@/lib/stock/vendas/lei-da-data'
import { quemEstaComOPin } from '@/lib/stock/producao/pin'
import { bateu } from './bateu'
import {
  acur, atrasado, liquido, mexido, nuncaBate, ordemDoDia, RITMO_PADRAO, venceHoje,
  type Grupo, type Ritmo,
} from './direcao'

/** a chave da pseudo-zona dos itens sem casa — e da assinatura da sessão inteira */
export const SEM_ZONA = '__sem_zona__'
export const CHAVE_SESSAO = '__sessao__'
/** o estimado do recibo e do "~15 min": segundos por item (a amostra da lei: 18 itens ≈ 15 min) */
export const SEGUNDOS_POR_ITEM = 50
/** "quem está contando AGORA": alguém gravou linha da zona nos últimos N minutos */
export const MINUTOS_AO_VIVO = 10
/** a sugestão do grupo A: contado em ≥ 4 dias das últimas 4 semanas (≥ 1×/semana) */
export const DIAS_PARA_SUGERIR_A = 4

export class DirecaoError extends Error {
  constructor(message: string, public code = 'DIRECAO', public status = 400) { super(message) }
}

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

/** dias de CALENDÁRIO do Brasil entre dois instantes (contado ontem = 1, hoje = 0) */
export function diasEntre(antes: Date, agora: Date): number {
  const a = Date.parse(diaDoBrasil(antes) + 'T00:00:00Z')
  const b = Date.parse(diaDoBrasil(agora) + 'T00:00:00Z')
  return Math.round((b - a) / 86_400_000)
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// PURO — a regra do dia (R36/R43)
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * ⭐ A SUGESTÃO do grupo (o dono decide; sem decisão, o sistema só sugere):
 * contado em ≥ 4 dias nas últimas 4 semanas → A · contado nas últimas 4 semanas → B ·
 * contado um dia → C · NUNCA contado → null (fila própria: os candidatos).
 */
export function sugerirGrupo(diasContados28: number, d: number | null): Grupo | null {
  if (d == null) return null
  if (diasContados28 >= DIAS_PARA_SUGERIR_A) return 'A'
  if (diasContados28 >= 1) return 'B'
  return 'C'
}

export interface ItemDaRegra {
  itemId: string
  nome: string
  /** grupo EFETIVO (decidido pelo dono ou sugerido); null = fora da regra */
  g: Grupo | null
  /** dias desde a última contagem ANTES desta sessão; null = nunca */
  d: number | null
  zonaId: string | null
  ordemNaZona: number
}

/**
 * ⭐⭐ R36 — O QUE CONTA HOJE. Só entra quem a regra manda (vence pelo ritmo do grupo); os
 * atrasados vêm primeiro; ⛔ item SEM ZONA entra no FIM — nunca some da contagem (R43).
 * Item sem grupo (nunca contado e não decidido) fica na fila própria dos candidatos.
 */
export function listaDeHoje<T extends ItemDaRegra>(itens: T[], ritmo: Ritmo = RITMO_PADRAO): T[] {
  const devidos = itens.filter((i) => i.g != null && venceHoje(i.g, i.d, ritmo))
  const comZona = devidos.filter((i) => i.zonaId != null) as (T & { g: Grupo })[]
  const semZona = devidos.filter((i) => i.zonaId == null) as (T & { g: Grupo })[]
  return [...ordemDoDia(comZona, ritmo), ...ordemDoDia(semZona, ritmo)]
}

/** a lista de UMA zona: os devidos dela, na ORDEM em que a equipe anda (o caminho do dono) */
export function listaDaZona<T extends ItemDaRegra>(hoje: T[], zonaId: string | null): T[] {
  const daZona = hoje.filter((i) => (i.zonaId ?? null) === zonaId)
  // "sem zona" não tem caminho: fica na ordem do dia (atrasados primeiro)
  if (zonaId == null) return daZona
  return daZona.sort((a, b) => a.ordemNaZona - b.ordemNaZona || a.nome.localeCompare(b.nome))
}

/** R40 — acuracidade sobre a ÚLTIMA contagem de cada item (até `ate`, se dado) */
export function acuracidade(
  contagens: { itemId: string; divergencia: number; contadoEm: Date }[], ate?: Date,
): { pct: number | null; dentro: number; total: number } {
  const ultima = new Map<string, { divergencia: number; contadoEm: Date }>()
  for (const c of contagens) {
    if (ate && c.contadoEm > ate) continue
    const u = ultima.get(c.itemId)
    if (!u || c.contadoEm > u.contadoEm) ultima.set(c.itemId, c)
  }
  let dentro = 0
  for (const u of ultima.values()) if (bateu(u.divergencia)) dentro++
  return { pct: acur(dentro, ultima.size), dentro, total: ultima.size }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// A BASE — um carregamento, todas as telas
// ═══════════════════════════════════════════════════════════════════════════════════════

type ContagemRow = { itemId: string; contagemId: string; divergencia: number; valorDivergencia: number; contadoEm: Date; contadoPorNome: string | null }

export async function ritmoDaEmpresa(companyId: string, db: PrismaClient = defaultPrisma): Promise<Ritmo> {
  const r = await db.stockContagemRitmo.findUnique({ where: { companyId } })
  return r ? { A: r.diasA, B: r.diasB, C: r.diasC } : { ...RITMO_PADRAO }
}

/** giro 30d em R$ por item = consumo da janela × custo médio (a mesma régua de consumo da casa) */
async function giro30(companyId: string, agora: Date, custo: Map<string, number | null>, db: PrismaClient): Promise<Map<string, number>> {
  const desde = new Date(agora.getTime() - JANELA_CONSUMO_DIAS * 86_400_000)
  const tipos = [...TIPOS.VENDA, ...TIPOS.PERDA, ...TIPOS.SEPARACAO, ...TIPOS.DEVOLUCAO, ...TIPOS.ESTORNO]
  const movs = await db.stockMovement.findMany({
    where: { companyId, dataMovimento: { gte: desde }, tipo: { in: tipos } },
    select: { itemId: true, tipo: true, quantidade: true, dataMovimento: true, estornoDeId: true },
  })
  const estornados = movs.filter((m) => m.estornoDeId).map((m) => m.estornoDeId!)
  const tipoOriginal = new Map(
    (estornados.length ? await db.stockMovement.findMany({ where: { id: { in: estornados } }, select: { id: true, tipo: true } }) : [])
      .map((o) => [o.id, o.tipo]),
  )
  const porItem = new Map<string, MovimentoParaConsumo[]>()
  for (const m of movs) {
    const l = porItem.get(m.itemId) ?? []
    l.push({ tipo: m.tipo, data: m.dataMovimento.toISOString(), quantidade: m.quantidade, estornoDeTipo: m.estornoDeId ? tipoOriginal.get(m.estornoDeId) ?? null : null })
    porItem.set(m.itemId, l)
  }
  const out = new Map<string, number>()
  for (const [itemId, l] of porItem) {
    const q = consumoDoItem(l, agora).consumoNaJanela
    const c = custo.get(itemId)
    if (q > 0 && c != null && c > 0) out.set(itemId, round2(q * c))
  }
  return out
}

export interface ItemBase extends ItemDaRegra {
  unidadeControle: string
  grupoDecidido: Grupo | null
  grupoSugerido: Grupo | null
  ignorado: boolean
  giro30: number
  ultimaEm: Date | null
  ultimaPor: string | null
  /** estado nesta sessão aberta (versão mais nova); null = ainda não passou */
  estado: 'CONTADO' | 'NAO_SEI' | 'PULADO' | null
}

export interface Base {
  agora: Date
  ritmo: Ritmo
  sessao: { id: string; iniciadaEm: Date } | null
  itens: ItemBase[]
  zonas: { id: string; nome: string; criadoEm: Date }[]
  contagens: ContagemRow[]
  /** versões da sessão aberta (pro AO VIVO) */
  versoesDaSessao: { itemId: string; contadoPorNome: string | null; contadoEm: Date; estado: string }[]
  assinaturas: { zonaChave: string; assinadoPorNome: string; assinadoEm: Date; viaPin: boolean }[]
}

export async function carregarBase(companyId: string, agora: Date = new Date(), db: PrismaClient = defaultPrisma): Promise<Base> {
  const [sessao, itens, saldos, contagens, grupos, zonas, zonaItens, ritmo] = await Promise.all([
    db.stockContagem.findFirst({ where: { companyId, status: 'ABERTA' }, select: { id: true, iniciadaEm: true } }),
    db.stockItem.findMany({
      where: { companyId, ativo: true, categoria: { notIn: [...CATEGORIAS_SEM_PRATELEIRA] } },
      select: { id: true, nome: true, unidadeControle: true }, orderBy: { nome: 'asc' },
    }),
    saldosDaEmpresa(db, companyId),
    db.stockContagemItem.findMany({
      where: { companyId },
      select: { itemId: true, contagemId: true, divergencia: true, valorDivergencia: true, contadoEm: true, contadoPorNome: true },
    }),
    db.stockItemGrupo.findMany({ where: { companyId } }),
    db.stockContagemZona.findMany({ where: { companyId }, orderBy: [{ criadoEm: 'asc' }, { nome: 'asc' }] }),
    db.stockContagemZonaItem.findMany({ where: { companyId } }),
    ritmoDaEmpresa(companyId, db),
  ])
  const custo = new Map(saldos.map((s) => [s.itemId, s.custoMedio]))
  const giro = await giro30(companyId, agora, custo, db)
  const [versoes, assinaturas] = sessao
    ? await Promise.all([
      db.stockContagemVersao.findMany({ where: { contagemId: sessao.id }, orderBy: { versao: 'desc' }, select: { itemId: true, estado: true, contadoPorNome: true, contadoEm: true } }),
      db.stockContagemAssinatura.findMany({ where: { contagemId: sessao.id }, select: { zonaChave: true, assinadoPorNome: true, assinadoEm: true, viaPin: true } }),
    ])
    : [[], []]
  const estado = new Map<string, string>()
  for (const v of versoes) if (!estado.has(v.itemId)) estado.set(v.itemId, v.estado)

  // ⭐ "dias desde a última contagem" é de ANTES desta sessão — senão a lista do dia encolheria
  // enquanto se conta e "18 de 18" nunca chegaria.
  const ultimaAntes = new Map<string, ContagemRow>()
  const dias28 = new Map<string, Set<string>>()
  const corte28 = new Date(agora.getTime() - 28 * 86_400_000)
  for (const c of contagens) {
    if (sessao && c.contagemId === sessao.id) continue
    const u = ultimaAntes.get(c.itemId)
    if (!u || c.contadoEm > u.contadoEm) ultimaAntes.set(c.itemId, c)
    if (c.contadoEm >= corte28) {
      const s = dias28.get(c.itemId) ?? new Set<string>()
      s.add(diaDoBrasil(c.contadoEm))
      dias28.set(c.itemId, s)
    }
  }
  const grupoPor = new Map(grupos.map((g) => [g.itemId, g]))
  const zonaPor = new Map(zonaItens.map((z) => [z.itemId, z]))
  const zonaExiste = new Set(zonas.map((z) => z.id))

  const base: ItemBase[] = itens.map((i) => {
    const u = ultimaAntes.get(i.id)
    const d = u ? diasEntre(u.contadoEm, agora) : null
    const gd = grupoPor.get(i.id)
    const decidido = (gd?.grupo as Grupo | null) ?? null
    const sugerido = sugerirGrupo(dias28.get(i.id)?.size ?? 0, d)
    const ignorado = !!gd?.ignorado && !decidido
    const z = zonaPor.get(i.id)
    return {
      itemId: i.id, nome: i.nome, unidadeControle: i.unidadeControle,
      grupoDecidido: decidido, grupoSugerido: sugerido, ignorado,
      g: decidido ?? (ignorado ? null : sugerido),
      d,
      zonaId: z && zonaExiste.has(z.zonaId) ? z.zonaId : null,
      ordemNaZona: z?.ordem ?? 0,
      giro30: giro.get(i.id) ?? 0,
      ultimaEm: u?.contadoEm ?? null, ultimaPor: u?.contadoPorNome ?? null,
      estado: (estado.get(i.id) as ItemBase['estado']) ?? null,
    }
  })
  return { agora, ritmo, sessao, itens: base, zonas, contagens, versoesDaSessao: versoes, assinaturas }
}

/** "feito" na sessão: contado ou "não sei" (a apurar). ⚠️ PULADO não fecha o dia. */
export const feito = (e: ItemBase['estado']) => e === 'CONTADO' || e === 'NAO_SEI'

// ═══════════════════════════════════════════════════════════════════════════════════════
// O POSTO DE COMANDO (R37/R40)
// ═══════════════════════════════════════════════════════════════════════════════════════

export interface CartaoDeZona {
  chave: string
  nome: string
  hoje: number
  feitos: number
  totalNaZona: number
  atrasados: number
  ultima: { quem: string | null; quando: string } | null
  aoVivo: string | null
  assinada: { quem: string; quando: string; viaPin: boolean } | null
}

export interface Posto {
  sessao: { id: string; iniciadaEm: string } | null
  ritmo: Ritmo
  acuracidade: { pct: number | null; dentro: number; total: number; tendencia30: number | null }
  sobContagem: { valor: number; pctDoGiro: number | null; itens: number }
  ajustesSemanas: { inicio: string; liquido: number; mexido: number }[]
  nuncaContados: { total: number; candidatos: { itemId: string; nome: string; giro30: number }[] }
  hoje: { itens: { itemId: string; nome: string; zonaId: string | null; atrasado: boolean; feito: boolean; g: Grupo }[]; feitos: number; estimadoMin: number }
  zonas: CartaoDeZona[]
  totalItens: number
  /** ⭐ o caminho de cada escopo: "hoje" (atrasados primeiro, sem zona no fim) e "zona:<chave>" (a ordem da zona) */
  escopos: Record<string, string[]>
}

export function montarPosto(b: Base): Posto {
  const { agora, ritmo } = b
  // ── acuracidade (R40) + tendência de 30 dias
  const a = acuracidade(b.contagens)
  const a30 = acuracidade(b.contagens, new Date(agora.getTime() - 30 * 86_400_000))
  // ── R$ sob contagem: o giro protegido pelo grupo A
  const giroTotal = b.itens.reduce((s, i) => s + i.giro30, 0)
  const doA = b.itens.filter((i) => i.g === 'A')
  const giroA = doA.reduce((s, i) => s + i.giro30, 0)
  // ── ajustes por semana (4 janelas de 7 dias, a última termina agora) — escala única na tela
  const semanas = [3, 2, 1, 0].map((k) => {
    const fim = new Date(agora.getTime() - k * 7 * 86_400_000)
    const ini = new Date(fim.getTime() - 7 * 86_400_000)
    const aj = b.contagens.filter((c) => c.contadoEm > ini && c.contadoEm <= fim && !bateu(c.divergencia)).map((c) => c.valorDivergencia)
    return { inicio: ini.toISOString(), liquido: liquido(aj), mexido: mexido(aj) }
  })
  // ── nunca contados + candidatos (sem grupo decidido, não ignorados, com giro)
  const jaContados = new Set(b.contagens.map((c) => c.itemId))
  const nunca = b.itens.filter((i) => !jaContados.has(i.itemId))
  const candidatos = nunca.filter((i) => !i.grupoDecidido && !i.ignorado && i.giro30 > 0)
    .sort((x, y) => y.giro30 - x.giro30)
    .map((i) => ({ itemId: i.itemId, nome: i.nome, giro30: i.giro30 }))
  // ── o dia
  const hoje = listaDeHoje(b.itens, ritmo)
  const feitosHoje = hoje.filter((i) => feito(i.estado)).length
  // ── o mapa das zonas (+ "sem zona" quando alguém dela vence hoje)
  const limiteVivo = new Date(agora.getTime() - MINUTOS_AO_VIVO * 60_000)
  const zonaDoItem = new Map(b.itens.map((i) => [i.itemId, i.zonaId]))
  const assinatura = new Map(b.assinaturas.map((s) => [s.zonaChave, s]))
  const cartao = (chave: string, nome: string, zonaId: string | null): CartaoDeZona => {
    const daZona = b.itens.filter((i) => i.zonaId === zonaId)
    const ids = new Set(daZona.map((i) => i.itemId))
    const doDia = hoje.filter((i) => i.zonaId === zonaId)
    let ultima: CartaoDeZona['ultima'] = null
    let ult: ContagemRow | null = null
    for (const c of b.contagens) if (ids.has(c.itemId) && (!ult || c.contadoEm > ult.contadoEm)) ult = c
    if (ult) ultima = { quem: ult.contadoPorNome, quando: ult.contadoEm.toISOString() }
    const vivo = b.versoesDaSessao.find((v) => zonaDoItem.get(v.itemId) === zonaId && ids.has(v.itemId) && v.contadoEm >= limiteVivo)
    const s = assinatura.get(chave)
    return {
      chave, nome, hoje: doDia.length, feitos: doDia.filter((i) => feito(i.estado)).length,
      totalNaZona: daZona.length,
      atrasados: doDia.filter((i) => atrasado(i.g!, i.d, ritmo)).length,
      ultima, aoVivo: vivo && !s ? vivo.contadoPorNome ?? 'alguém' : null,
      assinada: s ? { quem: s.assinadoPorNome, quando: s.assinadoEm.toISOString(), viaPin: s.viaPin } : null,
    }
  }
  const zonas = b.zonas.map((z) => cartao(z.id, z.nome, z.id))
  if (hoje.some((i) => i.zonaId == null)) zonas.push(cartao(SEM_ZONA, 'sem zona', null))

  return {
    sessao: b.sessao ? { id: b.sessao.id, iniciadaEm: b.sessao.iniciadaEm.toISOString() } : null,
    ritmo,
    acuracidade: { ...a, tendencia30: a.pct != null && a30.pct != null ? a.pct - a30.pct : null },
    sobContagem: { valor: round2(giroA), pctDoGiro: giroTotal > 0 ? Math.round((giroA / giroTotal) * 100) : null, itens: doA.length },
    ajustesSemanas: semanas,
    nuncaContados: { total: nunca.length, candidatos },
    hoje: {
      itens: hoje.map((i) => ({ itemId: i.itemId, nome: i.nome, zonaId: i.zonaId, atrasado: atrasado(i.g!, i.d, ritmo), feito: feito(i.estado), g: i.g! })),
      feitos: feitosHoje,
      estimadoMin: Math.ceil((hoje.length * SEGUNDOS_POR_ITEM) / 60),
    },
    zonas,
    totalItens: b.itens.length,
    escopos: Object.fromEntries([
      ['hoje', hoje.map((i) => i.itemId)],
      ...zonas.map((z) => [`zona:${z.chave}`, listaDaZona(hoje, z.chave === SEM_ZONA ? null : z.chave).map((i) => i.itemId)]),
    ]),
  }
}

export async function postoDeComando(companyId: string, agora: Date = new Date(), db: PrismaClient = defaultPrisma): Promise<Posto> {
  return montarPosto(await carregarBase(companyId, agora, db))
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// A HISTÓRIA DO ITEM (R41) — saldo 14 dias + pontos das contagens + nunca bate
// ═══════════════════════════════════════════════════════════════════════════════════════

export interface HistoriaDoItem {
  saldo14: number[]
  dias14: string[]
  pontos: { i: number; ok: boolean }[]
  ultimas10: boolean[]
  bateu: number
  total: number
  nuncaBate: boolean
  caixa: { fator: number; nome: string; curto: string } | null
}

const NOME_DA_EMBALAGEM: Record<string, string> = { CX: 'caixa', FD: 'fardo', PC: 'pacote', PCT: 'pacote', DZ: 'dúzia', SC: 'saco', GF: 'garrafa' }

/**
 * ⭐ R38 — a CAIXA só existe com fator CADASTRADO. O item não tem campo de fator: ele mora no
 * vínculo do fornecedor (`fatorConversao` · `unidadeNota`). Só vale quando é UM só (mesma
 * embalagem, mesmo fator) — dois fatores = ambíguo = nada de atalho (heurística não decide).
 */
export function caixaDoItem(vinculos: { fatorConversao: number; unidadeNota: string | null }[]): HistoriaDoItem['caixa'] {
  const distintos = new Map<string, { fator: number; un: string }>()
  for (const v of vinculos) {
    if (!(v.fatorConversao > 1)) continue
    const un = (v.unidadeNota ?? 'CX').trim().toUpperCase() || 'CX'
    distintos.set(`${un}|${v.fatorConversao}`, { fator: v.fatorConversao, un })
  }
  if (distintos.size !== 1) return null
  const [{ fator, un }] = [...distintos.values()]
  return { fator, nome: NOME_DA_EMBALAGEM[un] ?? un.toLowerCase(), curto: un.toLowerCase() }
}

export async function historiaDoItem(companyId: string, itemId: string, agora: Date = new Date(), db: PrismaClient = defaultPrisma): Promise<HistoriaDoItem> {
  const item = await db.stockItem.findFirst({ where: { id: itemId, companyId }, select: { id: true } })
  if (!item) throw new DirecaoError('Esse item não existe nesta empresa.', 'NAO_EXISTE', 404)
  const desde = new Date(agora.getTime() - 15 * 86_400_000)
  const excluir = await idsDeEstornoInterno(db, companyId, itemId)
  const [s, movs, contagens, vinculos] = await Promise.all([
    saldoItem(db, companyId, itemId),
    db.stockMovement.findMany({
      where: { companyId, itemId, dataMovimento: { gte: desde }, tipo: { notIn: TIPOS_FORA_DA_PRATELEIRA }, ...(excluir.length ? { id: { notIn: excluir } } : {}) },
      select: { quantidade: true, dataMovimento: true },
    }),
    db.stockContagemItem.findMany({ where: { companyId, itemId }, orderBy: { contadoEm: 'asc' }, select: { divergencia: true, contadoEm: true } }),
    db.stockSupplierProduct.findMany({ where: { companyId, itemId }, select: { fatorConversao: true, unidadeNota: true } }),
  ])
  // o saldo no FIM de cada um dos 14 dias = saldo de agora − o que entrou/saiu depois daquele dia
  const hoje = diaDoBrasil(agora)
  const dias14: string[] = []
  for (let k = 13; k >= 0; k--) dias14.push(diaDoBrasil(new Date(Date.parse(hoje + 'T12:00:00Z') - k * 86_400_000)))
  const saldo14 = dias14.map((d) => {
    const depois = movs.filter((m) => diaDoBrasil(m.dataMovimento) > d).reduce((acc, m) => acc + m.quantidade, 0)
    return Math.round((s.saldo - depois) * 1000) / 1000
  })
  const pontos: HistoriaDoItem['pontos'] = []
  for (const c of contagens) {
    const i = dias14.indexOf(diaDoBrasil(c.contadoEm))
    if (i >= 0) pontos.push({ i, ok: bateu(c.divergencia) })
  }
  const ultimas10 = contagens.slice(-10).map((c) => bateu(c.divergencia))
  const nb = contagens.filter((c) => bateu(c.divergencia)).length
  return {
    saldo14, dias14, pontos, ultimas10, bateu: nb, total: contagens.length,
    nuncaBate: nuncaBate(nb, contagens.length), caixa: caixaDoItem(vinculos),
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// A ASSINATURA DA ZONA (R37) — conta logada, ou o PIN em conta de APARELHO
// ═══════════════════════════════════════════════════════════════════════════════════════

export async function assinarZona(input: {
  companyId: string; contagemId: string; zonaChave: string; userId: string; userName?: string | null; pin?: string | null
}, agora: Date = new Date(), db: PrismaClient = defaultPrisma) {
  const sessao = await db.stockContagem.findFirst({ where: { id: input.contagemId, companyId: input.companyId }, select: { status: true } })
  if (!sessao) throw new DirecaoError('Essa contagem não existe nesta empresa.', 'NAO_EXISTE', 404)
  if (sessao.status !== 'ABERTA') throw new DirecaoError('Essa contagem já foi encerrada — a zona não tem mais o que fechar.', 'ENCERRADA', 409)
  let zonaNome: string
  if (input.zonaChave === SEM_ZONA) zonaNome = 'sem zona'
  else if (input.zonaChave === CHAVE_SESSAO) zonaNome = 'sessão'
  else {
    const z = await db.stockContagemZona.findFirst({ where: { id: input.zonaChave, companyId: input.companyId }, select: { nome: true } })
    if (!z) throw new DirecaoError('Essa zona não existe mais — recarregue a tela.', 'NAO_EXISTE', 404)
    zonaNome = z.nome
  }
  const vinculo = await db.userCompanyRole.findFirst({ where: { userId: input.userId, companyId: input.companyId }, select: { ehAparelho: true } })
  let assinadoPorNome: string
  let colaboradorId: string | null = null
  let viaPin = false
  if (vinculo?.ehAparelho) {
    // ⭐ o tablet não é gente: quem fecha a zona diz o PIN, como na Janela da Cozinha
    if (!input.pin) throw new DirecaoError('Esta é a conta do aparelho — quem contou digita o PIN pra fechar a zona.', 'PIN_OBRIGATORIO', 409)
    const quem = await quemEstaComOPin(input.companyId, input.pin, db)
    if (!quem) throw new DirecaoError('PIN não confere.', 'PIN_ERRADO', 401)
    assinadoPorNome = quem.nome
    colaboradorId = quem.colaboradorId
    viaPin = true
  } else {
    const nome = (input.userName ?? '').trim()
    if (!nome) throw new DirecaoError('Não sei quem está logado — entre de novo pra assinar a zona.', 'SEM_NOME', 401)
    assinadoPorNome = nome
  }
  const ja = await db.stockContagemAssinatura.findUnique({ where: { contagemId_zonaChave: { contagemId: input.contagemId, zonaChave: input.zonaChave } } })
  if (ja) throw new DirecaoError(`Essa zona já foi fechada por ${ja.assinadoPorNome}.`, 'JA_ASSINADA', 409)
  return db.stockContagemAssinatura.create({
    data: {
      companyId: input.companyId, contagemId: input.contagemId, zonaChave: input.zonaChave, zonaNome,
      assinadoPorNome, assinadoPorId: input.userId, colaboradorId, viaPin, assinadoEm: agora,
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// O RECIBO (R42)
// ═══════════════════════════════════════════════════════════════════════════════════════

export interface Recibo {
  contagemId: string
  status: string
  iniciadaEm: string
  finalizadaEm: string | null
  minutosReais: number | null
  minutosEstimados: number
  itens: number
  bateram: number
  ajustados: number
  liquido: number
  mexido: number
  aApurar: number
  acuracidadeSessao: number | null
  acuracidadeAcumulada: number | null
  acuracidadeAntes: number | null
  zonas: { chave: string; nome: string; quem: string | null; quando: string | null; viaPin: boolean }[]
  finalizadaPor: string | null
  ajustes: { itemId: string; nome: string; divergencia: number; unidade: string; valor: number }[]
}

export async function reciboDaSessao(companyId: string, contagemId: string, agora: Date = new Date(), db: PrismaClient = defaultPrisma): Promise<Recibo> {
  const s = await db.stockContagem.findFirst({ where: { id: contagemId, companyId } })
  if (!s) throw new DirecaoError('Essa contagem não existe nesta empresa.', 'NAO_EXISTE', 404)
  const [linhas, versoes, assin, todas, zonaItens, zonas] = await Promise.all([
    db.stockContagemItem.findMany({ where: { contagemId } }),
    db.stockContagemVersao.findMany({ where: { contagemId }, orderBy: { versao: 'desc' }, select: { itemId: true, estado: true } }),
    db.stockContagemAssinatura.findMany({ where: { contagemId }, orderBy: { assinadoEm: 'asc' } }),
    db.stockContagemItem.findMany({ where: { companyId }, select: { itemId: true, contagemId: true, divergencia: true, contadoEm: true } }),
    db.stockContagemZonaItem.findMany({ where: { companyId }, select: { itemId: true, zonaId: true } }),
    db.stockContagemZona.findMany({ where: { companyId }, select: { id: true, nome: true } }),
  ])
  const estado = new Map<string, string>()
  for (const v of versoes) if (!estado.has(v.itemId)) estado.set(v.itemId, v.estado)
  const aApurar = [...estado.values()].filter((e) => e === 'NAO_SEI').length
  const ok = linhas.filter((l) => bateu(l.divergencia))
  const aj = linhas.filter((l) => !bateu(l.divergencia))
  const nomes = new Map(
    (await db.stockItem.findMany({ where: { id: { in: aj.map((l) => l.itemId) } }, select: { id: true, nome: true, unidadeControle: true } }))
      .map((i) => [i.id, i]),
  )
  const fim = s.finalizadaEm ?? agora
  const antes = acuracidade(todas.filter((c) => c.contagemId !== contagemId), s.iniciadaEm)
  const depois = acuracidade(todas, fim)
  const itens = new Set([...linhas.map((l) => l.itemId), ...[...estado.entries()].filter(([, e]) => e === 'NAO_SEI').map(([k]) => k)]).size

  // zona por zona: as assinadas + as que tiveram item contado e NÃO foram assinadas (a tela diz)
  const zonaDe = new Map(zonaItens.map((z) => [z.itemId, z.zonaId]))
  const nomeZona = new Map(zonas.map((z) => [z.id, z.nome]))
  const tocadas = new Set(linhas.map((l) => zonaDe.get(l.itemId) ?? SEM_ZONA))
  const zonasOut: Recibo['zonas'] = assin.filter((a) => a.zonaChave !== CHAVE_SESSAO).map((a) => ({
    chave: a.zonaChave, nome: a.zonaNome, quem: a.assinadoPorNome, quando: a.assinadoEm.toISOString(), viaPin: a.viaPin,
  }))
  for (const t of tocadas) {
    if (zonasOut.some((z) => z.chave === t)) continue
    zonasOut.push({ chave: t, nome: t === SEM_ZONA ? 'sem zona' : nomeZona.get(t) ?? 'zona excluída', quem: null, quando: null, viaPin: false })
  }
  const sess = assin.find((a) => a.zonaChave === CHAVE_SESSAO)
  return {
    contagemId, status: s.status,
    iniciadaEm: s.iniciadaEm.toISOString(), finalizadaEm: s.finalizadaEm?.toISOString() ?? null,
    minutosReais: s.finalizadaEm ? Math.max(1, Math.round((s.finalizadaEm.getTime() - s.iniciadaEm.getTime()) / 60_000)) : null,
    minutosEstimados: Math.ceil((itens * SEGUNDOS_POR_ITEM) / 60),
    itens, bateram: ok.length, ajustados: aj.length,
    liquido: liquido(aj.map((l) => l.valorDivergencia)), mexido: mexido(aj.map((l) => l.valorDivergencia)),
    aApurar,
    acuracidadeSessao: acur(ok.length, linhas.length),
    acuracidadeAcumulada: depois.pct, acuracidadeAntes: antes.pct,
    zonas: zonasOut,
    finalizadaPor: sess?.assinadoPorNome ?? null,
    ajustes: aj.sort((x, y) => Math.abs(y.valorDivergencia) - Math.abs(x.valorDivergencia)).map((l) => ({
      itemId: l.itemId, nome: nomes.get(l.itemId)?.nome ?? '—', divergencia: l.divergencia,
      unidade: nomes.get(l.itemId)?.unidadeControle ?? '', valor: round2(l.valorDivergencia),
    })),
  }
}
