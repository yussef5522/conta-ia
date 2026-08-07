// Etapa 1 (06/08/2026) — rede anti-falha-silenciosa.
// fetchJson SEMPRE retorna {ok,data,message,aborted} e NUNCA lança. É o contrato
// que os 6 call-sites críticos usam pra parar de falhar em silêncio.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fetchJson } from '@/lib/http/fetch-json'

const ROOT = join(__dirname, '..', '..')

afterEach(() => vi.restoreAllMocks())

function mockFetch(impl: () => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(impl))
}

describe('fetchJson — contrato', () => {
  it('2xx com JSON → ok=true, data preenchido, message null', async () => {
    mockFetch(async () => new Response(JSON.stringify({ items: [1, 2] }), { status: 200 }))
    const r = await fetchJson<{ items: number[] }>('/x')
    expect(r.ok).toBe(true)
    expect(r.data).toEqual({ items: [1, 2] })
    expect(r.message).toBeNull()
    expect(r.aborted).toBe(false)
  })

  it('500 com JSON de erro → ok=false, message do backend, data NÃO vira sucesso', async () => {
    mockFetch(async () => new Response(JSON.stringify({ erro: 'Empresa não encontrada' }), { status: 500 }))
    const r = await fetchJson('/x')
    expect(r.ok).toBe(false)
    expect(r.message).toBe('Empresa não encontrada')
  })

  it('403 → ok=false com mensagem (não engole permissão)', async () => {
    mockFetch(async () => new Response(JSON.stringify({ erro: 'Sem permissão' }), { status: 403 }))
    const r = await fetchJson('/x')
    expect(r.ok).toBe(false)
    expect(r.message).toBe('Sem permissão')
  })

  it('502 com HTML (nginx) → ok=false, mensagem amigável, NUNCA vaza SyntaxError', async () => {
    mockFetch(async () => new Response('<html>502 Bad Gateway</html>', { status: 502 }))
    const r = await fetchJson('/x')
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/indisponível/i)
    expect(r.message).not.toMatch(/SyntaxError|<html>/)
  })

  it('AbortController → aborted=true, SEM message (não é erro pra mostrar)', async () => {
    mockFetch(async () => { throw new DOMException('aborted', 'AbortError') })
    const r = await fetchJson('/x')
    expect(r.aborted).toBe(true)
    expect(r.ok).toBe(false)
    expect(r.message).toBeNull()
  })

  it('rede caiu (fetch lança não-abort) → ok=false com mensagem de conexão, NUNCA lança', async () => {
    mockFetch(async () => { throw new TypeError('Failed to fetch') })
    const r = await fetchJson('/x')
    expect(r.ok).toBe(false)
    expect(r.aborted).toBe(false)
    expect(r.message).toMatch(/conex/i)
  })
})

// Guard de fonte: os 6 call-sites críticos DEVEM usar fetchJson (não voltar ao
// padrão silencioso). E o pior (transacoes) NÃO pode marcar "pronto" sem guard.
describe('Etapa 1 — call-sites críticos migrados', () => {
  const files = [
    'app/(dashboard)/transacoes/page.tsx',
    'app/(dashboard)/contas-a-pagar/page.tsx',
    'app/(dashboard)/contas-a-receber/page.tsx',
    'app/(dashboard)/conciliacao/page.tsx',
    'app/(dashboard)/empresas/[id]/pendentes/pendentes-client.tsx',
  ]
  for (const f of files) {
    it(`${f} importa e usa fetchJson`, () => {
      const code = readFileSync(join(ROOT, f), 'utf-8')
      expect(code).toMatch(/from '@\/lib\/http\/fetch-json'/)
      expect(code).toMatch(/fetchJson</)
    })
  }

  it('transacoes: setContasReady(true) só é alcançado APÓS o guard !ok (não finge pronto)', () => {
    const code = readFileSync(join(ROOT, 'app/(dashboard)/transacoes/page.tsx'), 'utf-8')
    // o guard existe e retorna antes de marcar pronto
    expect(code).toMatch(/if \(!ok\)[\s\S]*?return[\s\S]*?setContasReady\(true\)/)
  })
})
