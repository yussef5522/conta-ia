// SUITAPI — VENDAS AO VIVO (lei docs/vendas-ao-vivo-referencia.html v3, aprovada 11/11/2026).
//
// V0 · fonte única: o ESPELHO (suit_pedido → itens → opções → pagamentos). Nunca XLS/summary.
// V8 · ⛔⛔ CLIENTE NÃO EXISTE AQUI: o espelho não grava cliente (allowlist de espelho.ts) E este
//      DTO é montado campo a campo — não há de onde um nome/telefone/endereço sair.
// ⛔ O que a API NÃO dá e esta tela NÃO inventa (medido 11/11):
//    - horário de "preparo"/"saiu": a linha do tempo tem só aceito (created_at) e entregue
//      (delivered_at) — os minutos do status ativo contam do ÚLTIMO horário real;
//    - taxa/líquido POR PEDIDO: o lançamento financeiro não liga ao pedido (entry_id ≠ order id,
//      bill_id nulo) — taxa e líquido aparecem como TOTAL DO DIA, do financeiro;
//    - motivo do cancelamento: texto livre, fora da allowlist (LGPD) — o cancelado aparece riscado,
//      com a hora do cancelamento, sem motivo.

import type { PrismaClient } from '@prisma/client'
import { somarDias } from './regua-sombra'
import { diaOperacional } from './espelho'
import { relogioDaApi } from './sync'
import { fechamentoDe } from './materializar'

export const SEMANAS_DA_REGUA = 4
export const LIMIAR_ALERTA_PCT = 15
export const STATUS_ATIVOS = ['accepted', 'ready'] as const

/** os canais (V4), por campo DECLARADO da API: marketplace pela origem; o resto pelo tipo do pedido */
export function canalDe(source: string | null, orderType: string | null): { chave: string; rotulo: string } {
  const s = (source ?? '').toLowerCase()
  if (s === 'ifood') return { chave: 'ifood', rotulo: 'iFood' }
  if (s === 'aiqfome') return { chave: 'aiqfome', rotulo: 'Aiqfome' }
  if (orderType === 'delivery') return { chave: 'tele', rotulo: 'Tele' }
  if (orderType === 'salon' || orderType === 'number') return { chave: 'salao', rotulo: 'Salão' }
  if (orderType === 'takeout') return { chave: 'retirada', rotulo: 'Retirada' }
  return { chave: 'outro', rotulo: 'Outro' }
}

export const ROTULO_STATUS: Record<string, string> = {
  accepted: 'ACEITO', ready: 'PRONTO', delivered: 'ENTREGUE', cancelled: 'CANCELADO', transferred: 'TRANSFERIDO', abandoned: 'ABANDONADO',
}

/** minutos de Brasília desde a meia-noite (o relógio da casa pra exibir) */
export function minutosBrasil(d: Date): number {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map((x) => [x.type, x.value]))
  return Number(p.hour) * 60 + Number(p.minute)
}
export const horaBrasil = (d: Date) => d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/** a hora "operacional" (o dia vai de 03h a 02h59 de Brasília): 03→0 … 23→20, 00→21, 01→22, 02→23 */
export function horaOperacional(d: Date): number {
  return ((Math.floor(minutosBrasil(d) / 60) - 3) + 24) % 24
}
/** minuto operacional (0 = 03:00 de Brasília) — o CORTE justo do V2 */
export function minutoOperacional(d: Date): number {
  return (minutosBrasil(d) - 180 + 1440) % 1440
}

/** V3 · minutos no status ATIVO: agora − o último horário REAL da linha do tempo. Inativo → null */
export function minutosNoStatus(status: string, linhaDoTempo: { hora: Date }[], agora: Date): number | null {
  if (!(STATUS_ATIVOS as readonly string[]).includes(status) || linhaDoTempo.length === 0) return null
  const ultimo = linhaDoTempo[linhaDoTempo.length - 1].hora
  return Math.max(0, Math.floor((agora.getTime() - ultimo.getTime()) / 60_000))
}

/** mediana (pares → média dos dois do meio) */
export function mediana(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}

export type PedidoDaRegua = { status: string; sumido: boolean; criado: Date; valorCent: number }

/** o que a régua de produtos conta de um pedido (status ≠ abandoned, não apagado) — V10 */
export const contaNoVendido = (p: { status: string; sumido: boolean }) => !p.sumido && p.status !== 'abandoned'

/**
 * ⭐ V2 · A RÉGUA DO RITMO: os MESMOS dias-da-semana das 4 semanas anteriores, cada um somado
 * ATÉ O MESMO MINUTO operacional de agora (corte justo — sábado 21:37 × sábados até 21:37), e a
 * mediana deles. Com menos de 4 semanas no espelho: régua EM FORMAÇÃO (null) — nunca inventada.
 */
export function reguaDoRitmo(
  diasAnteriores: { dia: string; pedidos: PedidoDaRegua[] }[], corteMinuto: number,
): { semanas: number; tipicoCent: number | null; tipicoDiaCent: number | null; porHoraCent: number[] | null } {
  const semanas = diasAnteriores.length
  if (semanas < SEMANAS_DA_REGUA) return { semanas, tipicoCent: null, tipicoDiaCent: null, porHoraCent: null }
  const ate = diasAnteriores.map((d) => d.pedidos.filter((p) => contaNoVendido(p) && minutoOperacional(p.criado) <= corteMinuto).reduce((t, p) => t + p.valorCent, 0))
  const inteiro = diasAnteriores.map((d) => d.pedidos.filter(contaNoVendido).reduce((t, p) => t + p.valorCent, 0))
  const porHora = Array.from({ length: 24 }, (_, h) => mediana(diasAnteriores.map((d) => d.pedidos.filter((p) => contaNoVendido(p) && horaOperacional(p.criado) === h).reduce((t, p) => t + p.valorCent, 0))))
  return { semanas, tipicoCent: mediana(ate), tipicoDiaCent: mediana(inteiro), porHoraCent: porHora }
}

/** V7 · ritmo % (null sem régua) e alerta além do limiar */
export function ritmo(hojeCent: number, tipicoCent: number | null): { pct: number | null; alerta: boolean } {
  if (tipicoCent === null || tipicoCent <= 0) return { pct: null, alerta: false }
  const pct = (100 * (hojeCent - tipicoCent)) / tipicoCent
  return { pct, alerta: pct < -LIMIAR_ALERTA_PCT }
}

/** V11 · quem fechou: materializado ANTES da virada das 03:10 só pode ter sido a mão do dono */
export function quemFechou(dia: string, materializadoEm: Date): 'dono' | 'automatico' {
  return materializadoEm.getTime() < fechamentoDe(dia).getTime() ? 'dono' : 'automatico'
}

/** o selo da semana (V6) a partir da linha REAL da guarda (suit-guarda.state) — selo falso jamais */
export function seloDaGuarda(linha: string | undefined): 'conferido' | 'divergiu' | 'conferindo' {
  if (!linha) return 'conferindo'
  const a = / a=(BATE|DIVERGE|SEM_DIA)/.exec(linha)?.[1]
  const comp = / comp=(BATE|DIVERGE|SEM_DIA)/.exec(linha)?.[1]
  if (a === 'BATE' && comp === 'BATE') return 'conferido'
  if (a === 'DIVERGE' || comp === 'DIVERGE') return 'divergiu'
  return 'conferindo'
}

// ─── a montagem (DB → DTO, campo a campo) ─────────────────────────────────────────────────

export interface ItemDTO { q: number; nome: string; cent: number; sabores: string[] }
export interface PedidoDTO {
  id: number; num: string; hora: string; canal: string; status: string; rotulo: string; minutos: number | null
  conta: boolean; itens: ItemDTO[]; valorCent: number; linhaDoTempo: { rotulo: string; hora: string }[]
  pagamento: { tipo: string; valorCent: number }[]
}
export interface AoVivoDTO {
  dia: string; agora: string; atualizado: string | null
  fechado: { hora: string; por: 'dono' | 'automatico' } | null
  vendidoCent: number; pedidos: number; naCozinha: number; prontos: number; ticketCent: number | null
  regua: { semanas: number; tipicoCent: number | null; tipicoDiaCent: number | null; ritmoPct: number | null; alerta: boolean }
  curva: { hora: string; hojeCent: number | null; reguaCent: number | null; atual: boolean }[]
  canais: { chave: string; rotulo: string; pedidos: number; cent: number }[]
  feed: PedidoDTO[]
  taxaDia: { valorCent: number; taxaCent: number; liquidoCent: number } | null
  semana: { dia: string; totalCent: number | null; selo: 'conferido' | 'divergiu' | 'conferindo' | 'em andamento' | 'fechado'; hoje: boolean }[]
}

const SELECT_PEDIDO = {
  apiId: true, displayNumber: true, status: true, sumidoEm: true, orderType: true, source: true,
  criadoApiEm: true, entregueApiEm: true,
  itens: { select: { nome: true, quantidade: true, precoCent: true, canceladoEm: true, opcoes: { select: { nome: true, ordem: true } } } },
  pagamentos: { select: { tipo: true, valorCent: true, ordem: true } },
} as const

export async function montarAoVivo(db: PrismaClient, companyId: string, agora: Date, opts: { atualizado: Date | null; guarda: Map<string, string> }): Promise<AoVivoDTO> {
  const dia = diaOperacional(relogioDaApi(agora))
  const ps = await db.suitPedido.findMany({ where: { companyId, dia }, select: SELECT_PEDIDO, orderBy: { criadoApiEm: 'desc' } })
  const agoraMs = agora.getTime()
  // ⛔ honestidade: nada "depois de agora" entra na tela (relógio da API adiantado/atrasado)
  const vivos = ps.filter((p) => p.criadoApiEm.getTime() <= agoraMs)
  const valor = (p: (typeof ps)[number]) => p.itens.filter((i) => !i.canceladoEm).reduce((t, i) => t + i.precoCent, 0)
  const contam = vivos.filter((p) => contaNoVendido({ status: p.status, sumido: !!p.sumidoEm }))
  const vendidoCent = contam.reduce((t, p) => t + valor(p), 0)
  const comVenda = contam.filter((p) => p.status !== 'cancelled')

  const mat = await db.suitDiaMaterializado.findUnique({ where: { companyId_dia: { companyId, dia } }, select: { materializadoEm: true } })
  const fechado = mat ? { hora: horaBrasil(mat.materializadoEm), por: quemFechou(dia, mat.materializadoEm) } : null

  // V2 · régua: os mesmos dias-da-semana (D−7, D−14, D−21, D−28) QUE EXISTEM no espelho
  const anteriores: { dia: string; pedidos: PedidoDaRegua[] }[] = []
  for (let k = 1; k <= SEMANAS_DA_REGUA; k++) {
    const d = somarDias(dia, -7 * k)
    const pp = await db.suitPedido.findMany({ where: { companyId, dia: d }, select: { status: true, sumidoEm: true, criadoApiEm: true, itens: { select: { precoCent: true, canceladoEm: true } } } })
    if (pp.length) anteriores.push({ dia: d, pedidos: pp.map((p) => ({ status: p.status, sumido: !!p.sumidoEm, criado: p.criadoApiEm, valorCent: p.itens.filter((i) => !i.canceladoEm).reduce((t, i) => t + i.precoCent, 0) })) })
  }
  const corte = minutoOperacional(agora)
  const r = reguaDoRitmo(anteriores, corte)
  const rt = ritmo(vendidoCent, r.tipicoCent)

  // curva: hoje por hora operacional (até a hora atual) + a linha da régua quando existe
  const hAtual = horaOperacional(agora)
  const porHora = new Array(24).fill(0)
  for (const p of contam) porHora[horaOperacional(p.criadoApiEm)] += valor(p)
  const primeira = contam.length ? Math.min(...contam.map((p) => horaOperacional(p.criadoApiEm))) : hAtual
  const ultimaComRegua = r.porHoraCent ? Math.max(...r.porHoraCent.map((v, h) => (v > 0 ? h : 0))) : 0
  const curva: AoVivoDTO['curva'] = []
  for (let h = Math.min(primeira, r.porHoraCent ? r.porHoraCent.findIndex((v) => v > 0) : primeira); h <= Math.max(hAtual, ultimaComRegua); h++) {
    if (h < 0) continue
    curva.push({ hora: `${String((h + 3) % 24).padStart(2, '0')}h`, hojeCent: fechado || h <= hAtual ? porHora[h] : null, reguaCent: r.porHoraCent ? r.porHoraCent[h] : null, atual: h === hAtual && !fechado })
  }

  // canais (V4) — só o que conta no vendido
  const canaisM = new Map<string, { chave: string; rotulo: string; pedidos: number; cent: number }>()
  for (const p of comVenda) {
    const c = canalDe(p.source, p.orderType)
    const cur = canaisM.get(c.chave) ?? { ...c, pedidos: 0, cent: 0 }
    cur.pedidos++; cur.cent += valor(p); canaisM.set(c.chave, cur)
  }

  // feed (V3/V10) — pedido a pedido, campo a campo (V8)
  const feed: PedidoDTO[] = vivos.map((p) => {
    const linha: { rotulo: string; hora: Date }[] = [{ rotulo: 'aceito', hora: p.criadoApiEm }]
    if (p.entregueApiEm && p.entregueApiEm.getTime() <= agoraMs) linha.push({ rotulo: 'entregue', hora: p.entregueApiEm })
    const canc = p.itens.map((i) => i.canceladoEm).filter((x): x is Date => !!x && x.getTime() <= agoraMs).sort((a, b) => +a - +b)
    if (p.status === 'cancelled' && canc.length) linha.push({ rotulo: 'cancelado', hora: canc[canc.length - 1] })
    if (p.sumidoEm) linha.push({ rotulo: 'apagado na Suit', hora: p.sumidoEm })
    const itensVivos = p.status === 'cancelled' ? p.itens : p.itens.filter((i) => !i.canceladoEm)
    return {
      id: p.apiId,
      num: `#${p.displayNumber ?? p.apiId}`,
      hora: horaBrasil(p.criadoApiEm),
      canal: canalDe(p.source, p.orderType).chave,
      status: p.sumidoEm ? 'apagado' : p.status,
      rotulo: p.sumidoEm ? 'APAGADO' : ROTULO_STATUS[p.status] ?? p.status.toUpperCase(),
      minutos: p.sumidoEm ? null : minutosNoStatus(p.status, linha, agora),
      conta: contaNoVendido({ status: p.status, sumido: !!p.sumidoEm }) && p.status !== 'cancelled',
      itens: itensVivos.map((i) => ({ q: i.quantidade, nome: i.nome, cent: i.precoCent, sabores: [...i.opcoes].sort((a, b) => a.ordem - b.ordem).map((o) => o.nome) })),
      valorCent: p.status === 'cancelled' ? p.itens.reduce((t, i) => t + i.precoCent, 0) : valor(p),
      linhaDoTempo: linha.map((l) => ({ rotulo: l.rotulo, hora: horaBrasil(l.hora) })),
      pagamento: [...p.pagamentos].sort((a, b) => a.ordem - b.ordem).map((g) => ({ tipo: g.tipo ?? 'outro', valorCent: g.valorCent })),
    }
  })

  // taxa do dia (V5, nível dia): só existe depois que os lançamentos do dia foram espelhados
  const lanc = await db.suitPagamento.findMany({ where: { companyId, dia, receita: true, administrativo: false, tipo: { notIn: ['previous_cash_balance', 'liquidation', 'closing_transfer'] } }, select: { valorCent: true, taxaCent: true, liquidoCent: true } })
  const taxaDia = lanc.length ? { valorCent: lanc.reduce((t, l) => t + l.valorCent, 0), taxaCent: lanc.reduce((t, l) => t + l.taxaCent, 0), liquidoCent: lanc.reduce((t, l) => t + l.liquidoCent, 0) } : null

  // V6 · a semana: os 6 dias anteriores (com dado no espelho) + hoje
  const semana: AoVivoDTO['semana'] = []
  for (let k = 6; k >= 1; k--) {
    const d = somarDias(dia, -k)
    const m = await db.suitDiaMaterializado.findUnique({ where: { companyId_dia: { companyId, dia: d } }, select: { totalCent: true } })
    const temEspelho = m ? true : (await db.suitPedido.count({ where: { companyId, dia: d } })) > 0
    if (!temEspelho) continue
    semana.push({ dia: d, totalCent: m?.totalCent ?? null, selo: seloDaGuarda(opts.guarda.get(d)), hoje: false })
  }
  semana.push({ dia, totalCent: fechado ? vendidoCent : null, selo: fechado ? 'fechado' : 'em andamento', hoje: true })

  return {
    dia, agora: horaBrasil(agora), atualizado: opts.atualizado ? horaBrasil(opts.atualizado) : null, fechado,
    vendidoCent, pedidos: comVenda.length,
    naCozinha: comVenda.filter((p) => p.status === 'accepted').length,
    prontos: comVenda.filter((p) => p.status === 'ready').length,
    ticketCent: comVenda.length ? Math.round(vendidoCent / comVenda.length) : null,
    regua: { semanas: r.semanas, tipicoCent: r.tipicoCent, tipicoDiaCent: r.tipicoDiaCent, ritmoPct: rt.pct, alerta: rt.alerta },
    curva, canais: [...canaisM.values()].sort((a, b) => b.cent - a.cent), feed, taxaDia, semana,
  }
}

/** ⭐ o portão da contagem: o dia corrente (ou o anterior) teve venda e não foi fechado → trancada */
export async function portaoDaContagem(db: PrismaClient, companyId: string, agora: Date): Promise<{ liberada: boolean; dia: string | null }> {
  const hoje = diaOperacional(relogioDaApi(agora))
  for (const d of [somarDias(hoje, -1), hoje]) {
    const vendeu = await db.suitPedido.count({ where: { companyId, dia: d, sumidoEm: null, status: { not: 'abandoned' } } })
    if (!vendeu) continue
    const fechado = await db.suitDiaMaterializado.findUnique({ where: { companyId_dia: { companyId, dia: d } }, select: { id: true } })
    const temXls = await db.stockVendaImport.findUnique({ where: { companyId_data: { companyId, data: new Date(`${d}T12:00:00`) } }, select: { id: true } })
    if (!fechado && !temXls) return { liberada: false, dia: d }
  }
  return { liberada: true, dia: null }
}
