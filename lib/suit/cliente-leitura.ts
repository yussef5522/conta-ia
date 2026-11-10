// SUITAPI — cliente SÓ DE LEITURA. ⛔ A credencial TEM escopo `order:write` (medido 10/11), e a
// API tem rotas de escrita (order/create, status, cook, motoboy, cancel) — ESCRITA É VETADA.
//
// ⛔⛔ A TRAVA É ESTRUTURAL (10/11/2026): todo byte que sai daqui passa por `criarPorta()`, a
// ÚNICA função deste módulo que chama `fetch`. Ela EXPLODE (SuitEscritaVetadaError) em qualquer
// método ≠ GET — a única exceção é o POST do token, e só na URL do token. "O verbo é fixo" era
// disciplina; a porta é impossibilidade. Teste: cliente-leitura.test.ts (replantado: vermelho).
//
// Credencial: arquivo 600 root:root (padrão /opt/conta-ia/.env.suitapi) com SUIT_CLIENT_ID e
// SUIT_CLIENT_SECRET. ⛔ Nenhuma mensagem de erro deste arquivo carrega credencial ou token.
// Limite: 120 req/min → espaçamento de 550 ms (~109/min); 429 respeita Retry-After; token de 6h
// renovado no 401.

import { readFileSync } from 'node:fs'
import { janelaDia, type PedidoApi } from './regua-sombra'

export const SUIT_BASE = 'https://api.suit.com.br'
export const SUIT_URL_TOKEN = `${SUIT_BASE}/api/auth/token/`
const ESPACO_MS = 550

export class SuitErro extends Error {
  constructor(msg: string) {
    super(msg)
    this.name = 'SuitErro'
  }
}

/** ⛔ alguém tentou ESCREVER na API da Suit. Nunca é capturado como "erro de rede". */
export class SuitEscritaVetadaError extends Error {
  constructor(metodo: string, caminho: string) {
    super(`escrita vetada na SuitAPI: ${metodo} ${caminho}`)
    this.name = 'SuitEscritaVetadaError'
  }
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => Promise<Response>

/**
 * ⭐ A PORTA ÚNICA. Devolve a função que faz TODA requisição do cliente.
 * GET → passa. POST → só em SUIT_URL_TOKEN. Qualquer outro caso → explode ANTES de sair.
 */
export function criarPorta(fetchImpl: FetchLike = (u, i) => fetch(u, i)): FetchLike {
  return (url, init) => {
    const metodo = String(init?.method ?? '').toUpperCase()
    const semQuery = url.split('?')[0]
    const ehToken = metodo === 'POST' && semQuery === SUIT_URL_TOKEN
    if (metodo !== 'GET' && !ehToken) throw new SuitEscritaVetadaError(metodo || '(sem método)', new URL(semQuery, SUIT_BASE).pathname)
    if (metodo === 'GET' && init.body !== undefined) throw new SuitEscritaVetadaError('GET-com-corpo', new URL(semQuery, SUIT_BASE).pathname)
    return fetchImpl(url, init)
  }
}

function lerCredencial(arquivo: string): { id: string; secret: string } {
  let txt: string
  try {
    txt = readFileSync(arquivo, 'utf8')
  } catch {
    throw new SuitErro(`credencial ilegível em ${arquivo}`)
  }
  const kv = new Map<string, string>()
  for (const l of txt.split('\n')) {
    const i = l.indexOf('=')
    if (i > 0) kv.set(l.slice(0, i).trim(), l.slice(i + 1).trim())
  }
  const id = kv.get('SUIT_CLIENT_ID')
  const secret = kv.get('SUIT_CLIENT_SECRET')
  if (!id || !secret) throw new SuitErro(`SUIT_CLIENT_ID/SUIT_CLIENT_SECRET ausentes em ${arquivo}`)
  return { id, secret }
}

const dormirPadrao = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ─── o shape CRU da API (só o que lemos; o resto do JSON é ignorado) ──────────────────────
export type OpcaoCrua = { group_name?: string | null; name: string; unit_price: string | number; quantity: number | string; price: string | number }
export type ItemCru = {
  id: number; name: string; category?: string | null; quantity: number | string
  unit_price: string | number; price: string | number; base_price?: string | number | null
  status?: string | null; requested_at?: string | null; cancelled_at: string | null
  weight_kg?: number | null; sold_by_weight?: boolean; promotional?: boolean; options?: OpcaoCrua[] | null
}
export type MetodoCru = { id?: number | null; code?: number | null; type?: string | null; entry_type?: string | null; value: string | number; settled?: boolean | null }
export type PedidoCru = {
  id: number; display_number?: string | null; status: string; order_type?: string | null; source?: string | null
  created_at: string; finished_at?: string | null; delivered_at?: string | null; scheduled_for?: string | null
  is_scheduled?: boolean; products_total: string | number; delivery_fee: string | number; service_fee: string | number
  discount: string | number; additional: string | number; total: string | number; paid: boolean
  integration_code?: string | null; items: ItemCru[]; payment?: { methods?: MetodoCru[] | null } | null
}
/** a linha da LISTA (sem itens) — o que basta pra saber se um pedido mudou de cara */
export type PedidoDaLista = { id: number; status: string; created_at: string; products_total: string | number; total: string | number; paid: boolean }
export type LancamentoCru = {
  id: number; entry_id?: number | null; type: string; status: string; value: string | number; is_earning: boolean
  fee: string | number; net_value: string | number; created_at: string; received_at?: string | null
  conciliated?: boolean; administrative?: boolean; payment_method?: { id?: number | null; type?: string | null } | null
  bank_account?: { id?: number | null } | null; bill_id?: number | null; cashier_id?: number | null; cashier_shift_id?: number | null
}

export interface ClienteSuitLeitura {
  /** a régua da sombra (mantida): pedidos do dia operacional D, só os campos da régua */
  pedidosDoDia(dia: string): Promise<PedidoApi[]>
  /** a LISTA inteira de uma janela (strings no relógio da API). ⛔ incompleta = ERRO */
  listar(from: string, to: string): Promise<PedidoDaLista[]>
  /** o pedido cru; `null` = a API respondeu 404 (pedido apagado no PDV) */
  detalhe(id: number): Promise<PedidoCru | null>
  /** os lançamentos financeiros do dia de caixa (start_date=end_date=D) */
  lancamentos(diaCaixa: string): Promise<LancamentoCru[]>
  requisicoes(): number
}

export function criarClienteSuitLeitura(
  arquivo = process.env.SUIT_ENV_FILE ?? '/opt/conta-ia/.env.suitapi',
  opts: { fetchImpl?: FetchLike; dormir?: (ms: number) => Promise<void>; espacoMs?: number; credencial?: { id: string; secret: string } } = {},
): ClienteSuitLeitura {
  const cred = opts.credencial ?? lerCredencial(arquivo)
  const porta = criarPorta(opts.fetchImpl)
  const dormir = opts.dormir ?? dormirPadrao
  const espacoMs = opts.espacoMs ?? ESPACO_MS
  let token: string | null = null
  let ultimo = 0
  let requisicoes = 0

  async function obterToken(): Promise<void> {
    requisicoes++
    const r = await porta(SUIT_URL_TOKEN, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(`${cred.id}:${cred.secret}`).toString('base64'),
      },
      body: 'grant_type=client_credentials',
    })
    if (!r.ok) throw new SuitErro(`auth recusada: HTTP ${r.status}`)
    const j = (await r.json()) as { access_token?: string }
    if (!j.access_token) throw new SuitErro('auth sem access_token')
    token = j.access_token
  }

  /** GET com espaçamento, 429/5xx com espera, 401 renova o token UMA vez. `aceita404` → null. */
  async function get<T>(caminho: string, q: Record<string, string | number> = {}, aceita404 = false): Promise<T | null> {
    if (!token) await obterToken()
    const u = new URL(SUIT_BASE + caminho)
    for (const [k, v] of Object.entries(q)) u.searchParams.set(k, String(v))
    let renovou = false
    for (let tentativa = 0; tentativa < 8; tentativa++) {
      const espera = espacoMs - (Date.now() - ultimo)
      if (espera > 0) await dormir(espera)
      ultimo = Date.now()
      requisicoes++
      let r: Response
      try {
        r = await porta(u.toString(), { method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
      } catch (e) {
        if (e instanceof SuitEscritaVetadaError) throw e
        await dormir(2000 * (tentativa + 1))
        continue
      }
      if (r.status === 429) {
        await dormir((Number(r.headers.get('retry-after')) || 5) * 1000)
        continue
      }
      if (r.status === 401 && !renovou) {
        renovou = true
        await obterToken()
        continue
      }
      if (r.status === 404 && aceita404) return null
      if (r.status >= 500) {
        await dormir(2000 * (tentativa + 1))
        continue
      }
      if (!r.ok) throw new SuitErro(`GET ${caminho} → HTTP ${r.status}`)
      return (await r.json()) as T
    }
    throw new SuitErro(`GET ${caminho} → esgotou as tentativas`)
  }

  async function listar(from: string, to: string): Promise<PedidoDaLista[]> {
    type Pagina = { count: number; results: PedidoDaLista[] }
    const porId = new Map<number, PedidoDaLista>()
    let count = -1
    for (let page = 1; page <= 200; page++) {
      const p = (await get<Pagina>('/api/order/list', { created_from: from, created_to: to, page_size: 100, page }))!
      count = p.count
      for (const o of p.results) porId.set(o.id, { id: o.id, status: o.status, created_at: o.created_at, products_total: o.products_total, total: o.total, paid: o.paid })
      if (p.results.length === 0 || porId.size >= count) break
    }
    if (porId.size !== count) throw new SuitErro(`lista ${from}→${to} incompleta: ${porId.size} ids × count ${count}`)
    return [...porId.values()]
  }

  async function detalhe(id: number): Promise<PedidoCru | null> {
    const d = await get<PedidoCru>('/api/order/details/', { order_id: id }, true)
    if (d === null) return null
    if (!Array.isArray(d.items)) throw new SuitErro(`pedido ${id} sem items[]`)
    return d
  }

  async function lancamentos(diaCaixa: string): Promise<LancamentoCru[]> {
    type Pagina = { count: number; results: LancamentoCru[] }
    const porId = new Map<number, LancamentoCru>()
    let count = -1
    for (let page = 1; page <= 200; page++) {
      const p = (await get<Pagina>('/api/financial/payments/list', { start_date: diaCaixa, end_date: diaCaixa, page_size: 100, page }))!
      count = p.count
      for (const l of p.results) porId.set(l.id, l)
      if (p.results.length === 0 || porId.size >= count) break
    }
    if (porId.size !== count) throw new SuitErro(`lançamentos de ${diaCaixa} incompletos: ${porId.size} × count ${count}`)
    return [...porId.values()]
  }

  /** todos os pedidos (com itens) do dia operacional D. ⛔ Lista incompleta é ERRO, nunca parcial. */
  async function pedidosDoDia(dia: string): Promise<PedidoApi[]> {
    const { from, to } = janelaDia(dia)
    const lista = await listar(from, to)
    const pedidos: PedidoApi[] = []
    for (const { id } of lista) {
      const d = await detalhe(id)
      if (!d) continue // apagado entre a lista e o detalhe
      // só o que a régua usa — nada de cliente/endereço/motoboy sai daqui
      pedidos.push({
        id: d.id,
        status: d.status,
        items: d.items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price, cancelled_at: i.cancelled_at })),
      })
    }
    return pedidos
  }

  return { pedidosDoDia, listar, detalhe, lancamentos, requisicoes: () => requisicoes }
}
