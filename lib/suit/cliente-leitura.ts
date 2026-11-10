// SUITAPI — cliente SÓ DE LEITURA. ⛔ A API tem rotas de escrita (order/create, status, cook,
// motoboy, cancel) — vetadas até ordem expressa do dono. Por construção este cliente não sabe
// escrever: o único método exposto é `get()` e o verbo é fixo. O único POST é o do token.
//
// Credencial: arquivo 600 root:root (padrão /opt/conta-ia/.env.suitapi) com SUIT_CLIENT_ID e
// SUIT_CLIENT_SECRET. ⛔ Nenhuma mensagem de erro deste arquivo carrega credencial ou token.
// Limite: 120 req/min → espaçamento de 550 ms (~109/min); 429 respeita Retry-After.

import { readFileSync } from 'node:fs'
import { janelaDia, type PedidoApi } from './regua-sombra'

const BASE = 'https://api.suit.com.br'
const ESPACO_MS = 550

export class SuitErro extends Error {
  constructor(msg: string) {
    super(msg)
    this.name = 'SuitErro'
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

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function criarClienteSuitLeitura(arquivo = process.env.SUIT_ENV_FILE ?? '/opt/conta-ia/.env.suitapi') {
  const cred = lerCredencial(arquivo)
  let token: string | null = null
  let ultimo = 0
  let requisicoes = 0

  async function obterToken(): Promise<void> {
    requisicoes++
    const r = await fetch(`${BASE}/api/auth/token/`, {
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

  async function get<T>(caminho: string, q: Record<string, string | number> = {}): Promise<T> {
    if (!token) await obterToken()
    const u = new URL(BASE + caminho)
    for (const [k, v] of Object.entries(q)) u.searchParams.set(k, String(v))
    let renovou = false
    for (let tentativa = 0; tentativa < 6; tentativa++) {
      const espera = ESPACO_MS - (Date.now() - ultimo)
      if (espera > 0) await dormir(espera)
      ultimo = Date.now()
      requisicoes++
      let r: Response
      try {
        r = await fetch(u, { method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
      } catch {
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
      if (r.status >= 500) {
        await dormir(2000 * (tentativa + 1))
        continue
      }
      if (!r.ok) throw new SuitErro(`GET ${caminho} → HTTP ${r.status}`)
      return (await r.json()) as T
    }
    throw new SuitErro(`GET ${caminho} → esgotou as tentativas`)
  }

  /** todos os pedidos (com itens) do dia operacional D. ⛔ Lista incompleta é ERRO, nunca parcial. */
  async function pedidosDoDia(dia: string): Promise<PedidoApi[]> {
    const { from, to } = janelaDia(dia)
    type Pagina = { count: number; results: { id: number }[] }
    const ids = new Set<number>()
    let count = -1
    for (let page = 1; page <= 200; page++) {
      const p = await get<Pagina>('/api/order/list', { created_from: from, created_to: to, page_size: 100, page })
      count = p.count
      for (const o of p.results) ids.add(o.id)
      if (p.results.length === 0 || ids.size >= count) break
    }
    if (ids.size !== count) throw new SuitErro(`lista do dia ${dia} incompleta: ${ids.size} ids × count ${count}`)
    const pedidos: PedidoApi[] = []
    for (const id of ids) {
      const d = await get<PedidoApi>('/api/order/details/', { order_id: id })
      if (!Array.isArray(d.items)) throw new SuitErro(`pedido ${id} sem items[]`)
      // só o que a régua usa — nada de cliente/endereço/motoboy sai daqui
      pedidos.push({
        id: d.id,
        status: d.status,
        items: d.items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price, cancelled_at: i.cancelled_at })),
      })
    }
    return pedidos
  }

  return { pedidosDoDia, requisicoes: () => requisicoes }
}
