import { describe, it, expect, vi } from 'vitest'
import { criarPorta, criarClienteSuitLeitura, SuitEscritaVetadaError, SUIT_URL_TOKEN, SUIT_BASE } from './cliente-leitura'

const resp = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('⛔ a trava GET-only da SuitAPI é ESTRUTURAL (a porta única explode antes de sair)', () => {
  it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'post', ''])('método %j fora do token → explode e NÃO chama o fetch', (metodo) => {
    const fetchImpl = vi.fn(async () => resp(200))
    const porta = criarPorta(fetchImpl)
    expect(() => porta(`${SUIT_BASE}/api/order/cancel/`, { method: metodo, headers: {} })).toThrow(SuitEscritaVetadaError)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('POST só passa na URL EXATA do token (nem com query, nem em outra rota de auth)', async () => {
    const fetchImpl = vi.fn(async () => resp(200))
    const porta = criarPorta(fetchImpl)
    await porta(SUIT_URL_TOKEN, { method: 'POST', headers: {}, body: 'grant_type=client_credentials' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(() => porta(`${SUIT_BASE}/api/auth/token/revoke/`, { method: 'POST', headers: {} })).toThrow(SuitEscritaVetadaError)
    expect(() => porta(`${SUIT_BASE}/api/order/create/`, { method: 'POST', headers: {} })).toThrow(SuitEscritaVetadaError)
  })

  it('GET com corpo também é recusado (não existe "GET que escreve")', () => {
    const porta = criarPorta(vi.fn(async () => resp(200)))
    expect(() => porta(`${SUIT_BASE}/api/order/list`, { method: 'GET', headers: {}, body: '{}' })).toThrow(SuitEscritaVetadaError)
  })

  it('o CLIENTE inteiro só emite GET (+ o POST do token) — cada chamada real passa pela porta', async () => {
    const vistos: string[] = []
    const fetchImpl = vi.fn(async (url: string, init: { method: string }) => {
      vistos.push(`${init.method} ${new URL(url).pathname}`)
      if (url === SUIT_URL_TOKEN) return resp(200, { access_token: 't' })
      if (url.includes('/order/list')) return resp(200, { count: 1, results: [{ id: 7, status: 'delivered', created_at: '2026-11-09T12:00:00', products_total: '10.00', total: '10.00', paid: true }] })
      if (url.includes('/order/details/')) return resp(404, { detail: 'Não encontrado.' })
      if (url.includes('/financial/payments/list')) return resp(200, { count: 0, results: [] })
      return resp(500)
    })
    const c = criarClienteSuitLeitura('x', { fetchImpl, dormir: async () => {}, espacoMs: 0, credencial: { id: 'a', secret: 'b' } })
    await c.listar('2026-11-09T06:00:00', '2026-11-10T05:59:59.999999')
    expect(await c.detalhe(7)).toBeNull() // 404 = apagado, nunca exceção
    await c.lancamentos('2026-11-09')
    expect(vistos.filter((v) => !v.startsWith('GET ')).every((v) => v === 'POST /api/auth/token/')).toBe(true)
    expect(vistos.filter((v) => v.startsWith('POST')).length).toBe(1)
  })

  it('lista incompleta é ERRO, nunca parcial', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url === SUIT_URL_TOKEN) return resp(200, { access_token: 't' })
      return resp(200, { count: 5, results: [] })
    })
    const c = criarClienteSuitLeitura('x', { fetchImpl, dormir: async () => {}, espacoMs: 0, credencial: { id: 'a', secret: 'b' } })
    await expect(c.listar('a', 'b')).rejects.toThrow(/incompleta/)
  })
})
