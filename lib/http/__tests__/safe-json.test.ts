import { describe, it, expect } from 'vitest'
import { readJsonResponse, friendlyHttpMessage } from '../safe-json'

function jsonResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
function htmlResp(status: number): Response {
  return new Response(
    `<html><head><title>${status}</title></head><body>${status} Gateway Time-out</body></html>`,
    { status, headers: { 'content-type': 'text/html' } },
  )
}

describe('readJsonResponse', () => {
  it('2xx com JSON válido → ok=true, data parseado, message null', async () => {
    const r = await readJsonResponse<{ importId: string }>(jsonResp({ importId: 'abc' }))
    expect(r.ok).toBe(true)
    expect(r.data).toEqual({ importId: 'abc' })
    expect(r.message).toBeNull()
  })

  it('504 com HTML (nginx gateway timeout) → NÃO joga, ok=false, message amigável, sem HTML cru', async () => {
    const r = await readJsonResponse(htmlResp(504), {
      timeoutHint: 'A leitura do PDF demorou mais que o esperado.',
    })
    expect(r.ok).toBe(false)
    expect(r.data).toBeNull()
    expect(r.message).toBe('A leitura do PDF demorou mais que o esperado.')
    // nunca vaza o HTML cru
    expect(r.message).not.toContain('<html>')
  })

  it('504 sem timeoutHint → mensagem default de timeout', async () => {
    const r = await readJsonResponse(htmlResp(504))
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/demorou mais que o esperado/i)
  })

  it('502 → servidor indisponível', async () => {
    const r = await readJsonResponse(htmlResp(502))
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/indispon/i)
  })

  it('413 → arquivo grande demais', async () => {
    const r = await readJsonResponse(htmlResp(413))
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/grande demais/i)
  })

  it('erro do backend em JSON (400) → usa o campo erro', async () => {
    const r = await readJsonResponse(jsonResp({ erro: 'Arquivo PDF não enviado' }, 400))
    expect(r.ok).toBe(false)
    expect(r.message).toBe('Arquivo PDF não enviado')
  })

  it('504 do app em JSON {erro} → prioriza a mensagem do backend', async () => {
    const r = await readJsonResponse(jsonResp({ erro: 'Timeout na API Claude Vision' }, 504))
    expect(r.ok).toBe(false)
    expect(r.message).toBe('Timeout na API Claude Vision')
  })

  it('500 sem corpo JSON → mensagem por status, nunca err.message do navegador', async () => {
    const r = await readJsonResponse(new Response('', { status: 500 }))
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/Erro inesperado \(HTTP 500\)/)
  })

  it('2xx mas corpo não-JSON → trata como erro (não vaza HTML)', async () => {
    const r = await readJsonResponse(new Response('<html>ok</html>', { status: 200 }))
    expect(r.ok).toBe(false)
    expect(r.message).not.toContain('<html>')
  })
})

describe('friendlyHttpMessage', () => {
  it('408/504 usam timeoutHint quando fornecido', () => {
    expect(friendlyHttpMessage(408, { timeoutHint: 'X' })).toBe('X')
    expect(friendlyHttpMessage(504, { timeoutHint: 'X' })).toBe('X')
  })
  it('status desconhecido → genérico com número', () => {
    expect(friendlyHttpMessage(418)).toBe('Erro inesperado (HTTP 418).')
  })
})
