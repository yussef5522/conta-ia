// Integração Pluggy.ai (Open Finance BR)
// Requer PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET no .env
// Sem essas vars, todas as funções retornam null/[] sem lançar erro

const BASE_URL = 'https://api.pluggy.ai'
const CLIENT_ID = process.env.PLUGGY_CLIENT_ID
const CLIENT_SECRET = process.env.PLUGGY_CLIENT_SECRET

export const PLUGGY_ENABLED = !!(CLIENT_ID && CLIENT_SECRET)

let cachedToken: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string | null> {
  if (!PLUGGY_ENABLED) return null

  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token
  }

  const res = await fetch(`${BASE_URL}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET }),
  })

  if (!res.ok) {
    console.error('[PLUGGY] Falha ao obter token:', res.status, await res.text())
    return null
  }

  const data = await res.json()
  cachedToken = {
    token: data.apiKey,
    expiresAt: Date.now() + (data.expiresIn ?? 7200) * 1000,
  }
  return cachedToken.token
}

export interface PluggyConnector {
  id: number
  name: string
  primaryColor: string
  institutionUrl: string
  country: string
  type: string
  credentials: Array<{ label: string; name: string; type: string }>
}

export interface PluggyItem {
  id: string
  connector: PluggyConnector
  status: string
  createdAt: string
  updatedAt: string
}

export interface PluggyAccount {
  id: string
  itemId: string
  name: string
  number: string
  bankData?: { transferNumber?: string; closingBalance?: number }
  type: string
  subtype: string
  balance: number
  currencyCode: string
}

export interface PluggyTransaction {
  id: string
  accountId: string
  date: string
  description: string
  amount: number
  type: 'CREDIT' | 'DEBIT'
  category?: string
  balance?: number
}

export async function createConnectToken(itemId?: string): Promise<string | null> {
  const token = await getAccessToken()
  if (!token) return null

  const body: Record<string, unknown> = {}
  if (itemId) body.itemId = itemId

  const res = await fetch(`${BASE_URL}/connect_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-KEY': token },
    body: JSON.stringify(body),
  })
  if (!res.ok) { console.error('[PLUGGY] Falha connect_token:', res.status); return null }
  const data = await res.json()
  return data.accessToken ?? null
}

export async function getItem(itemId: string): Promise<PluggyItem | null> {
  const token = await getAccessToken()
  if (!token) return null

  const res = await fetch(`${BASE_URL}/items/${itemId}`, {
    headers: { 'X-API-KEY': token },
  })
  if (!res.ok) return null
  return res.json()
}

export async function getAccounts(itemId: string): Promise<PluggyAccount[]> {
  const token = await getAccessToken()
  if (!token) return []

  const res = await fetch(`${BASE_URL}/accounts?itemId=${itemId}`, {
    headers: { 'X-API-KEY': token },
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.results ?? []
}

export async function getTransactions(
  accountId: string,
  from?: string,
  to?: string,
  pageSize = 100
): Promise<PluggyTransaction[]> {
  const token = await getAccessToken()
  if (!token) return []

  const params = new URLSearchParams({ accountId, pageSize: String(pageSize) })
  if (from) params.set('from', from)
  if (to) params.set('to', to)

  const all: PluggyTransaction[] = []
  let page = 1

  while (true) {
    params.set('page', String(page))
    const res = await fetch(`${BASE_URL}/transactions?${params}`, {
      headers: { 'X-API-KEY': token },
    })
    if (!res.ok) break
    const data = await res.json()
    const results: PluggyTransaction[] = data.results ?? []
    all.push(...results)
    if (all.length >= (data.total ?? 0) || results.length < pageSize) break
    page++
  }

  return all
}

export async function deleteItem(itemId: string): Promise<boolean> {
  const token = await getAccessToken()
  if (!token) return false

  const res = await fetch(`${BASE_URL}/items/${itemId}`, {
    method: 'DELETE',
    headers: { 'X-API-KEY': token },
  })
  return res.ok
}
