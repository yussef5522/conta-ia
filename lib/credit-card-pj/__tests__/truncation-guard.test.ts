// Sprint BUG B Step 0 — REGRA 3: o guard de truncamento. ANTES não existia (a
// resposta cortada no max_tokens virava JSON inválido OU tx faltando em silêncio).
// Agora falha ALTO e acionável.

import { describe, it, expect } from 'vitest'
import { extractInvoice } from '../extract'
import { CreditCardPjExtractError } from '../types'

const pdfBytes = new TextEncoder().encode('%PDF-1.4\n...conteudo...')

function mockFetch(stopReason: string) {
  return async () =>
    new Response(
      JSON.stringify({
        content: [{ type: 'text', text: '{"lines":[]}' }],
        stop_reason: stopReason,
        usage: { input_tokens: 9000, output_tokens: 8000 },
        model: 'claude-sonnet-4-6',
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
}

describe('guard de truncamento (stop_reason=max_tokens)', () => {
  it('resposta cortada no teto → CLAUDE_TRUNCATED com mensagem acionável', async () => {
    await expect(
      extractInvoice({ pdfBytes, fileName: 'f.pdf' }, { fetch: mockFetch('max_tokens') as any, apiKey: 'test' }),
    ).rejects.toMatchObject({ code: 'CLAUDE_TRUNCATED' })

    try {
      await extractInvoice({ pdfBytes, fileName: 'f.pdf' }, { fetch: mockFetch('max_tokens') as any, apiKey: 'test' })
    } catch (e) {
      expect(e).toBeInstanceOf(CreditCardPjExtractError)
      expect((e as Error).message).toMatch(/grande demais|cortada|divida/i)
    }
  })

  it('resposta completa (stop_reason=end_turn) → NÃO lança truncamento', async () => {
    // não deve lançar CLAUDE_TRUNCATED (segue pro parse normal do JSON)
    const r = await extractInvoice(
      { pdfBytes, fileName: 'f.pdf' },
      { fetch: mockFetch('end_turn') as any, apiKey: 'test' },
    )
    expect(r.extraction).toBeDefined()
  })
})
