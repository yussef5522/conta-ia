// Sprint PF Fatia 3.5 — extract-from-pdf orquestrador.
// Mock fetch Claude API — sem rede.

import { describe, expect, test, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  extractFromPdf,
  sha256Pdf,
  sanitizeForCache,
} from '@/lib/pdf-import/extract-from-pdf'
import { PdfExtractError } from '@/lib/pdf-import/types'

const FIXTURE_JSON = readFileSync(
  join(__dirname, '..', 'fixtures', 'nubank-mai-2026.json'),
  'utf-8',
)

function fakePdf(): Uint8Array {
  // Header válido + conteúdo dummy
  return new TextEncoder().encode('%PDF-1.4\n%fake\n%%EOF')
}

function mockClaudeOk(jsonResponse: string) {
  return vi.fn(async () =>
    new Response(
      JSON.stringify({
        content: [{ type: 'text', text: jsonResponse }],
        usage: { input_tokens: 9000, output_tokens: 3200 },
        model: 'claude-sonnet-4-6',
        stop_reason: 'end_turn',
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ),
  ) as unknown as typeof fetch
}

describe('sha256Pdf', () => {
  test('determinístico — mesmo bytes → mesmo hash', () => {
    const a = sha256Pdf(fakePdf())
    const b = sha256Pdf(fakePdf())
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })

  test('bytes diferentes → hash diferente', () => {
    const a = sha256Pdf(new TextEncoder().encode('%PDF-1.4\nA'))
    const b = sha256Pdf(new TextEncoder().encode('%PDF-1.4\nB'))
    expect(a).not.toBe(b)
  })
})

describe('sanitizeForCache', () => {
  test('mascara cartão pra últimos 4 chars', () => {
    const result = JSON.parse(FIXTURE_JSON)
    const sanitized = sanitizeForCache({
      ...result,
      detectedCardLast4: '12345671234',
    })
    expect(sanitized.detectedCardLast4).toBe('1234')
  })

  test('null permanece null', () => {
    const result = JSON.parse(FIXTURE_JSON)
    const sanitized = sanitizeForCache({ ...result, detectedCardLast4: null })
    expect(sanitized.detectedCardLast4).toBeNull()
  })
})

describe('extractFromPdf — validações pré-Claude', () => {
  test('PDF vazio → PDF_INVALID', async () => {
    await expect(
      extractFromPdf({ pdfBytes: new Uint8Array(0), fileName: 'x.pdf' }, { apiKey: 'k' }),
    ).rejects.toThrow(PdfExtractError)
  })

  test('PDF sem header %PDF- → PDF_INVALID', async () => {
    await expect(
      extractFromPdf(
        { pdfBytes: new TextEncoder().encode('NOT A PDF'), fileName: 'x.pdf' },
        { apiKey: 'k' },
      ),
    ).rejects.toThrow(PdfExtractError)
  })

  test('PDF criptografado (/Encrypt no header) → PDF_ENCRYPTED', async () => {
    const encrypted = new TextEncoder().encode('%PDF-1.4\n/Encrypt <<>>\n%%EOF')
    await expect(
      extractFromPdf({ pdfBytes: encrypted, fileName: 'x.pdf' }, { apiKey: 'k' }),
    ).rejects.toThrow(PdfExtractError)
    try {
      await extractFromPdf({ pdfBytes: encrypted, fileName: 'x.pdf' }, { apiKey: 'k' })
    } catch (err) {
      expect((err as PdfExtractError).code).toBe('PDF_ENCRYPTED')
    }
  })

  test('PDF > 5MB → PDF_TOO_LARGE', async () => {
    const big = new Uint8Array(6 * 1024 * 1024)
    big.set(new TextEncoder().encode('%PDF-1.4'))
    await expect(
      extractFromPdf({ pdfBytes: big, fileName: 'x.pdf' }, { apiKey: 'k' }),
    ).rejects.toThrow(PdfExtractError)
  })

  test('ANTHROPIC_API_KEY ausente → CLAUDE_API_ERROR', async () => {
    const prev = process.env.ANTHROPIC_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    try {
      await expect(
        extractFromPdf({ pdfBytes: fakePdf(), fileName: 'x.pdf' }, {}),
      ).rejects.toThrow(PdfExtractError)
    } finally {
      if (prev) process.env.ANTHROPIC_API_KEY = prev
    }
  })
})

describe('extractFromPdf — sucesso com fixture sintético', () => {
  test('parse JSON OK + validação soma=total', async () => {
    const fetch = mockClaudeOk(FIXTURE_JSON)
    const result = await extractFromPdf(
      { pdfBytes: fakePdf(), fileName: 'Fatura_Nubank_2026_05.pdf' },
      { fetch, apiKey: 'k' },
    )
    expect(result.detectedBank).toBe('Nubank')
    expect(result.scanQuality).toBe('DIGITAL')
    expect(result.declaredTotal).toBe(6771.22)
    expect(result.detectedCardLast4).toBe('2716')
    expect(result.transactions.length).toBeGreaterThan(15)
  })

  test('soma das DEBITs bate com R$ 6.771,22 (validação Yussef)', async () => {
    const fetch = mockClaudeOk(FIXTURE_JSON)
    const result = await extractFromPdf(
      { pdfBytes: fakePdf(), fileName: 'Fatura_Nubank_2026_05.pdf' },
      { fetch, apiKey: 'k' },
    )
    const sumDebit = result.transactions
      .filter((t) => t.type === 'DEBIT')
      .reduce((s, t) => s + t.amount, 0)
    expect(Math.round(sumDebit * 100) / 100).toBe(6771.22)
  })

  test('detecta CREDIT (pagamento recebido)', async () => {
    const fetch = mockClaudeOk(FIXTURE_JSON)
    const result = await extractFromPdf(
      { pdfBytes: fakePdf(), fileName: 'Fatura_Nubank_2026_05.pdf' },
      { fetch, apiKey: 'k' },
    )
    const credit = result.transactions.find((t) => t.type === 'CREDIT')
    expect(credit?.memo).toMatch(/pagamento/i)
    expect(credit?.amount).toBe(6563.5)
  })

  test('parcela mantém sufixo no memo', async () => {
    const fetch = mockClaudeOk(FIXTURE_JSON)
    const result = await extractFromPdf(
      { pdfBytes: fakePdf(), fileName: 'Fatura_Nubank_2026_05.pdf' },
      { fetch, apiKey: 'k' },
    )
    const ml = result.transactions.find((t) => t.memo.includes('Mercadolivre'))
    expect(ml?.memo).toContain('Parcela 4/10')
    const airbnb = result.transactions.find((t) => t.memo.includes('Airbnb'))
    expect(airbnb?.memo).toContain('Parcela 4/6')
  })

  test('internacionais marcadas com isInternational + originalCurrency', async () => {
    const fetch = mockClaudeOk(FIXTURE_JSON)
    const result = await extractFromPdf(
      { pdfBytes: fakePdf(), fileName: 'Fatura_Nubank_2026_05.pdf' },
      { fetch, apiKey: 'k' },
    )
    const anth = result.transactions.find((t) => t.memo.includes('Anthropic'))
    expect(anth?.isInternational).toBe(true)
    expect(anth?.originalCurrency).toBe('USD')
    expect(anth?.amount).toBe(102.49) // valor em REAL
  })

  test('FITID sintético é gerado pra cada tx', async () => {
    const fetch = mockClaudeOk(FIXTURE_JSON)
    const result = await extractFromPdf(
      { pdfBytes: fakePdf(), fileName: 'F.pdf' },
      { fetch, apiKey: 'k' },
    )
    for (const tx of result.transactions) {
      expect(tx.fitid).toBeTruthy()
      expect(tx.fitid).toMatch(/^PDF-/)
    }
  })
})

describe('extractFromPdf — rejeições', () => {
  test('MOBILE_PHOTO → IS_PHOTO_REJECTED', async () => {
    const fetch = mockClaudeOk(JSON.stringify({
      ...JSON.parse(FIXTURE_JSON),
      scanQuality: 'MOBILE_PHOTO',
    }))
    await expect(
      extractFromPdf({ pdfBytes: fakePdf(), fileName: 'x.pdf' }, { fetch, apiKey: 'k' }),
    ).rejects.toThrow(PdfExtractError)
    try {
      await extractFromPdf({ pdfBytes: fakePdf(), fileName: 'x.pdf' }, { fetch, apiKey: 'k' })
    } catch (err) {
      expect((err as PdfExtractError).code).toBe('IS_PHOTO_REJECTED')
    }
  })

  test('Claude retorna texto NÃO-JSON → CLAUDE_INVALID_JSON', async () => {
    const fetch = mockClaudeOk('Desculpe não consegui ler o PDF')
    await expect(
      extractFromPdf({ pdfBytes: fakePdf(), fileName: 'x.pdf' }, { fetch, apiKey: 'k' }),
    ).rejects.toThrow(PdfExtractError)
  })

  test('Claude retorna 429 → CLAUDE_RATE_LIMITED', async () => {
    const fetchMock = vi.fn(async () => new Response('Rate limit', { status: 429 })) as unknown as typeof globalThis.fetch
    try {
      await extractFromPdf({ pdfBytes: fakePdf(), fileName: 'x.pdf' }, { fetch: fetchMock, apiKey: 'k' })
    } catch (err) {
      expect((err as PdfExtractError).code).toBe('CLAUDE_RATE_LIMITED')
    }
  })

  test('Claude retorna 500 → CLAUDE_API_ERROR', async () => {
    const fetchMock = vi.fn(async () => new Response('server err', { status: 500 })) as unknown as typeof globalThis.fetch
    try {
      await extractFromPdf({ pdfBytes: fakePdf(), fileName: 'x.pdf' }, { fetch: fetchMock, apiKey: 'k' })
    } catch (err) {
      expect((err as PdfExtractError).code).toBe('CLAUDE_API_ERROR')
    }
  })
})
