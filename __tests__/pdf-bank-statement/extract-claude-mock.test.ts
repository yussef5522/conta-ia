// Sprint PDF Extrato Bancário — teste do orchestrator com Claude mockado.

import { describe, it, expect } from 'vitest'
import {
  extractBankStatement,
  BankStatementExtractError,
} from '@/lib/pdf-bank-statement/extract'

// Mini PDF header válido pra passar pre-validação
const MINI_PDF_HEADER = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'

function mkPdfBytes(): Uint8Array {
  return new TextEncoder().encode(MINI_PDF_HEADER + 'trailing content')
}

function mkFetchMock(claudeJsonResponse: string, status = 200) {
  return async () => {
    return new Response(
      JSON.stringify({
        content: [{ type: 'text', text: claudeJsonResponse }],
        usage: { input_tokens: 1500, output_tokens: 800 },
        model: 'claude-sonnet-4-6',
        stop_reason: 'end_turn',
      }),
      { status, headers: { 'content-type': 'application/json' } },
    )
  }
}

describe('extractBankStatement', () => {
  it('extrai e coerce resposta válida do Claude', async () => {
    const claudeResp = JSON.stringify({
      openingBalance: 1000,
      closingBalance: 850,
      detectedBank: 'Caixa',
      scanQuality: 'GOOD',
      notes: [],
      lines: [
        {
          date: '2026-06-01',
          description: 'PIX RECEBIDO XPTO',
          amount: 500,
          type: 'CREDIT',
          balanceAfter: 1500,
        },
        {
          date: '2026-06-02',
          description: 'PARC FIN 1827478',
          amount: 650,
          type: 'DEBIT',
          balanceAfter: 850,
        },
      ],
    })
    const result = await extractBankStatement(
      { pdfBytes: mkPdfBytes(), fileName: 'extrato.pdf' },
      { fetch: mkFetchMock(claudeResp), apiKey: 'sk-test' },
    )
    expect(result.extraction.lines).toHaveLength(2)
    expect(result.extraction.openingBalance).toBe(1000)
    expect(result.extraction.detectedBank).toBe('Caixa')
    expect(result.metrics.inputTokens).toBe(1500)
    expect(result.metrics.outputTokens).toBe(800)
    expect(result.metrics.pdfSize).toBeGreaterThan(0)
  })

  it('rejeita PDF vazio', async () => {
    await expect(
      extractBankStatement(
        { pdfBytes: new Uint8Array(0), fileName: 'a.pdf' },
        { fetch: mkFetchMock(''), apiKey: 'sk' },
      ),
    ).rejects.toThrow(BankStatementExtractError)
  })

  it('rejeita arquivo sem header PDF', async () => {
    await expect(
      extractBankStatement(
        {
          pdfBytes: new TextEncoder().encode('not a pdf at all'),
          fileName: 'fake.pdf',
        },
        { fetch: mkFetchMock(''), apiKey: 'sk' },
      ),
    ).rejects.toThrow(/PDF válido/)
  })

  it('rejeita PDF encriptado', async () => {
    const bytes = new TextEncoder().encode(
      MINI_PDF_HEADER + '/Encrypt 1 0 R\nmore content',
    )
    await expect(
      extractBankStatement(
        { pdfBytes: bytes, fileName: 'enc.pdf' },
        { fetch: mkFetchMock(''), apiKey: 'sk' },
      ),
    ).rejects.toThrow(/senha|criptografia/)
  })

  it('rejeita quando ANTHROPIC_API_KEY ausente', async () => {
    await expect(
      extractBankStatement(
        { pdfBytes: mkPdfBytes(), fileName: 'a.pdf' },
        { fetch: mkFetchMock(''), apiKey: '' },
      ),
    ).rejects.toThrow(/ANTHROPIC_API_KEY/)
  })

  it('trata Claude retornando JSON malformado', async () => {
    await expect(
      extractBankStatement(
        { pdfBytes: mkPdfBytes(), fileName: 'a.pdf' },
        { fetch: mkFetchMock('isso não é json'), apiKey: 'sk' },
      ),
    ).rejects.toThrow(/JSON inválido/)
  })

  it('trata erro HTTP da Claude API', async () => {
    const errorFetch = async () =>
      new Response('rate limited', {
        status: 429,
        headers: { 'content-type': 'text/plain' },
      })
    await expect(
      extractBankStatement(
        { pdfBytes: mkPdfBytes(), fileName: 'a.pdf' },
        { fetch: errorFetch, apiKey: 'sk' },
      ),
    ).rejects.toThrow(/Claude API/)
  })

  it('aceita Claude com prosa antes/depois do JSON', async () => {
    const claudeResp = `Aqui está o extrato:
    {"openingBalance":100,"closingBalance":50,"lines":[{"date":"2026-06-01","description":"TARIFA","amount":50,"type":"DEBIT"}]}
    Fim.`
    const result = await extractBankStatement(
      { pdfBytes: mkPdfBytes(), fileName: 'a.pdf' },
      { fetch: mkFetchMock(claudeResp), apiKey: 'sk' },
    )
    expect(result.extraction.lines).toHaveLength(1)
    expect(result.extraction.openingBalance).toBe(100)
  })
})
