// SUITAPI — PROVA-SOMBRA (só leitura). A RÉGUA que reproduz o import XLS a partir dos
// pedidos da API, e o VEREDITO diário API × XLS. Função pura: sem rede, sem banco, sem relógio.
//
// A régua foi provada ao centavo em 07/11/2026 (725 un · R$ 26.266,10, 435 pedidos):
//   1. pedido com status `abandoned` FICA FORA (transferred, cancelled, accepted e delivered entram);
//   2. item com `cancelled_at` FICA FORA;
//   3. DIA OPERACIONAL = D 06:00 → D+1 06:00 NO RELÓGIO DA API. ⚠️ A doc da Suit diz "horário
//      local da loja", mas o MEDIDO (09/11 23:37 de Brasília → pedidos com created_at 02:31 de
//      10/11) é UTC sem fuso: 06:00 da API = 03:00 de Brasília. A régua bateu no relógio da API,
//      então a janela é a string da API, sem conversão nenhuma.
// ⛔ `/api/order/summary/products/` NÃO serve: ele só conta delivered+accepted (deu 708 un ×
//    725 do XLS no mesmo dia — os 9 `transferred`). A fonte é o details, item por item.

import { normalizarNome } from '../stock/vendas/grupo-complemento'

export const STATUS_FORA_DA_REGUA = 'abandoned'
export const HORA_VIRADA_DIA = '06:00:00'

export type ItemApi = {
  name: string
  quantity: number | string
  price: number | string // total da LINHA (unit_price × quantity), como a API devolve
  cancelled_at: string | null
}
export type PedidoApi = { id: number; status: string; items: ItemApi[] }
export type LinhaXls = { nomeSuitable: string; quantidade: number; valorTotal: number }

export type Agregado = {
  porProduto: Map<string, { un: number; cent: number }>
  un: number
  cent: number
}

const RE_DIA = /^\d{4}-\d{2}-\d{2}$/

export function somarDias(dia: string, n: number): string {
  if (!RE_DIA.test(dia)) throw new Error(`dia inválido: ${dia}`)
  const [y, m, d] = dia.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** a janela do dia operacional D, nas strings locais que a API filtra. Fim INCLUSIVO. */
export function janelaDia(dia: string): { from: string; to: string } {
  return { from: `${dia}T${HORA_VIRADA_DIA}`, to: `${somarDias(dia, 1)}T05:59:59.999999` }
}

/**
 * A chave do produto nos DOIS lados = a porta da casa (`normalizarNome`: acento, caixa, espaço).
 * ⛔ Caso real 08/11: a API manda "HAMBURGUER  TRADICIONAL" (espaço duplo) e o XLS gravou com um
 * só — trim+maiúscula dava DIVERGE com os totais idênticos ao centavo.
 */
export function normNome(s: string): string {
  return normalizarNome(s)
}

/** dinheiro em centavos inteiros — ⛔ número não-finito é ERRO, nunca vira 0 (ausência ≠ zero) */
export function centavos(v: number | string): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) throw new Error(`valor não numérico: ${String(v)}`)
  return Math.round(n * 100)
}

function quantidade(v: number | string): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) throw new Error(`quantidade não numérica: ${String(v)}`)
  return n
}

function somar(acc: Agregado, nome: string, un: number, cent: number) {
  const k = normNome(nome)
  const cur = acc.porProduto.get(k) ?? { un: 0, cent: 0 }
  cur.un += un
  cur.cent += cent
  acc.porProduto.set(k, cur)
  acc.un += un
  acc.cent += cent
}

/** A RÉGUA. Recebe os pedidos (details) da janela do dia e devolve o que o XLS deveria dizer. */
export function agregarApi(pedidos: PedidoApi[]): Agregado & { transferred: number; pedidosContados: number } {
  const acc: Agregado = { porProduto: new Map(), un: 0, cent: 0 }
  let transferred = 0
  let pedidosContados = 0
  for (const p of pedidos) {
    if (p.status === STATUS_FORA_DA_REGUA) continue
    pedidosContados++
    if (p.status === 'transferred') transferred++
    for (const it of p.items) {
      if (it.cancelled_at) continue
      somar(acc, it.name, quantidade(it.quantity), centavos(it.price))
    }
  }
  return { ...acc, transferred, pedidosContados }
}

export function agregarXls(linhas: LinhaXls[]): Agregado {
  const acc: Agregado = { porProduto: new Map(), un: 0, cent: 0 }
  for (const l of linhas) somar(acc, l.nomeSuitable, l.quantidade, centavos(l.valorTotal))
  return acc
}

export function fmtReais(cent: number): string {
  const s = (Math.abs(cent) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${cent < 0 ? '-' : ''}R$${s}`
}
function fmtUn(un: number): string {
  return Number.isInteger(un) ? `${un}` : un.toFixed(3)
}
function sinal(n: number, s: string): string {
  return n > 0 ? `+${s}` : s
}

/**
 * O VEREDITO de um dia. BATE só se TODO produto bate em un E em centavo.
 * DIVERGE traz as 3 piores diferenças (Δ = API − XLS) e os totais dos dois lados.
 */
export function veredito(dia: string, api: ReturnType<typeof agregarApi>, xls: Agregado): string {
  const nomes = new Set([...api.porProduto.keys(), ...xls.porProduto.keys()])
  const difs: { nome: string; dUn: number; dCent: number }[] = []
  for (const nome of nomes) {
    const a = api.porProduto.get(nome) ?? { un: 0, cent: 0 }
    const x = xls.porProduto.get(nome) ?? { un: 0, cent: 0 }
    const dUn = Math.round((a.un - x.un) * 1000) / 1000
    const dCent = a.cent - x.cent
    if (dUn !== 0 || dCent !== 0) difs.push({ nome, dUn, dCent })
  }
  if (difs.length === 0) {
    return `${dia} BATE ${fmtUn(xls.un)}un ${fmtReais(xls.cent)} transferred=${api.transferred}`
  }
  difs.sort((p, q) => Math.abs(q.dCent) - Math.abs(p.dCent) || Math.abs(q.dUn) - Math.abs(p.dUn) || p.nome.localeCompare(q.nome))
  const piores = difs
    .slice(0, 3)
    .map((d) => `${d.nome} · ${sinal(d.dUn, fmtUn(d.dUn))}un · ${sinal(d.dCent, fmtReais(d.dCent))}`)
    .join(' | ')
  return (
    `${dia} DIVERGE ${piores} ` +
    `(api ${fmtUn(api.un)}un ${fmtReais(api.cent)} × xls ${fmtUn(xls.un)}un ${fmtReais(xls.cent)}; ` +
    `${difs.length} produto(s) diferem) transferred=${api.transferred}`
  )
}

// ─── o arquivo de estado: UMA linha por dia, "D <VEREDITO> ..." ───────────────────────────

/** BATE e DIVERGE são veredito; AGUARDANDO-XLS e ERRO-* não são (o cron tenta de novo). */
export function temVeredito(linha: string | undefined): boolean {
  return !!linha && / (BATE|DIVERGE)( |$)/.test(linha)
}

export function lerState(conteudo: string): Map<string, string> {
  const m = new Map<string, string>()
  for (const l of conteudo.split('\n')) {
    const t = l.trim()
    const dia = t.slice(0, 10)
    if (RE_DIA.test(dia)) m.set(dia, t)
  }
  return m
}

/** substitui (ou acrescenta) a linha do dia; devolve o arquivo ordenado por dia */
export function mesclarState(conteudo: string, linha: string): string {
  const m = lerState(conteudo)
  m.set(linha.slice(0, 10), linha)
  return [...m.keys()].sort().map((k) => m.get(k)).join('\n') + '\n'
}

/**
 * Quais dias rodar: os `n` mais recentes, a partir de `inicio`, ainda SEM veredito e JÁ FECHADOS
 * (D+1 06:00 de Brasília já passou). `agoraLocal` = "YYYY-MM-DDTHH:mm:ss" no horário do Brasil.
 * O dia da API fecha às 03:00 de Brasília (relógio dela é UTC), então comparar 06:00 de Brasília
 * é CONSERVADOR: nunca roda um dia ainda aberto. O relógio só escolhe QUAIS dias; nunca o veredito.
 */
export function diasPendentes(state: Map<string, string>, agoraLocal: string, inicio: string, n = 3): string[] {
  const out: string[] = []
  let d = somarDias(agoraLocal.slice(0, 10), -1)
  while (d >= inicio && out.length < n) {
    const fechado = agoraLocal >= `${somarDias(d, 1)}T${HORA_VIRADA_DIA}`
    if (fechado && !temVeredito(state.get(d))) out.push(d)
    d = somarDias(d, -1)
  }
  return out.reverse()
}

/** quantos BATE seguidos, contando do dia mais recente com veredito pra trás */
export function sequenciaBate(state: Map<string, string>): number {
  const dias = [...state.keys()].filter((d) => temVeredito(state.get(d))).sort().reverse()
  let n = 0
  for (const d of dias) {
    if (/ BATE( |$)/.test(state.get(d)!)) n++
    else break
  }
  return n
}
