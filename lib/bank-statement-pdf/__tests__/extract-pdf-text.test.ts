import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { extractPdfText, PdfExtractError } from '../extract-pdf-text'

describe('extractPdfText — guardas de segurança (sem poppler)', () => {
  it('rejeita não-PDF (magic bytes) ANTES de invocar poppler', async () => {
    await expect(extractPdfText(new TextEncoder().encode('isto nao e um pdf'))).rejects.toMatchObject({
      code: 'NOT_A_PDF',
    })
  })
  it('rejeita arquivo > 10MB antes de tocar o disco', async () => {
    const big = new Uint8Array(11 * 1024 * 1024)
    big.set(new TextEncoder().encode('%PDF-1.4'), 0)
    await expect(extractPdfText(big)).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' })
  })
  it('PdfExtractError é a classe de erro exportada', () => {
    expect(new PdfExtractError('NOT_A_PDF', 'x')).toBeInstanceOf(Error)
  })
})

// Guarda de SALDO (não-negociável): o confirm SÓ escreve campos de contraparte.
// Se alguém adicionar balance/amount/date/categoryId no update, este teste quebra.
describe('confirm — saldo-safety (guard estático)', () => {
  const code = readFileSync(
    join(__dirname, '..', '..', '..', 'app/api/contas-bancarias/[id]/enriquecer-contraparte/confirm/route.ts'),
    'utf-8',
  )
  it('o update do confirm NÃO toca balance/amount/date/categoryId/status', () => {
    const updateBlock = code.slice(code.indexOf('data: {'), code.indexOf('data: {') + 400)
    expect(updateBlock).not.toMatch(/\bbalance\b/)
    expect(updateBlock).not.toMatch(/\bamount\b/)
    expect(updateBlock).not.toMatch(/\bcategoryId\b/)
    expect(updateBlock).not.toMatch(/\bdate\b/)
  })
  it('confirm respeita precedência (canApplyCounterparty)', () => {
    expect(code).toMatch(/canApplyCounterparty/)
  })
})
