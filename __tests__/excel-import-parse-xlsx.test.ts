// Sprint 5.0.2.0 — parseXlsx + parseBRDate.

import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { parseXlsx, parseBRDate } from '@/lib/excel-import/parse-xlsx'

async function buildXlsx(
  rows: Array<Record<string, string | number | Date | null>>,
  options: { sheetName?: string; extraSheets?: number } = {},
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(options.sheetName ?? 'Sheet1')
  if (rows.length === 0) {
    const buf = await wb.xlsx.writeBuffer()
    return Buffer.from(buf as ArrayBuffer)
  }
  const headers = Object.keys(rows[0])
  ws.addRow(headers)
  for (const r of rows) {
    ws.addRow(headers.map((h) => r[h] as string | number | Date | null))
  }
  for (let i = 0; i < (options.extraSheets ?? 0); i++) {
    wb.addWorksheet(`Sheet${i + 2}`)
  }
  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf as ArrayBuffer)
}

describe('parseXlsx — happy path planilha ASSECONT', () => {
  it('extrai headers e linhas básicas', async () => {
    const buf = await buildXlsx([
      {
        Favorecido: 'GESTRA TREINAMENTOS',
        Beneficiário: 'Fornecedores',
        Descrição: 'EXAMES OCUPACIONAIS',
        Vencimento: '02/03/2026',
        Pagamento: '02/03/2026',
        Valor: 165,
        Status: 'Paga',
      },
      {
        Favorecido: 'ANA CAROLINE',
        Beneficiário: 'Colaboradores',
        Descrição: 'Salário Recepção',
        Vencimento: '05/03/2026',
        Pagamento: null,
        Valor: 1500,
        Status: null,
      },
    ])
    const r = await parseXlsx(buf)
    expect(r.headers).toEqual([
      'Favorecido',
      'Beneficiário',
      'Descrição',
      'Vencimento',
      'Pagamento',
      'Valor',
      'Status',
    ])
    expect(r.rows).toHaveLength(2)
    expect(r.rows[0].cells['Favorecido']).toBe('GESTRA TREINAMENTOS')
    expect(r.rows[1].cells['Pagamento']).toBeNull()
  })

  it('arredonda floating point sujo (300.47000000000003 → 300.47)', async () => {
    const buf = await buildXlsx([
      {
        Favorecido: 'X',
        Valor: 300.47000000000003,
      },
    ])
    const r = await parseXlsx(buf)
    expect(r.rows[0].cells['Valor']).toBe(300.47)
  })

  it('filtra linhas-total (TOTAL / SUBTOTAL no Favorecido)', async () => {
    const buf = await buildXlsx([
      { Favorecido: 'GESTRA', Valor: 100 },
      { Favorecido: 'TOTAL GERAL', Valor: 100 },
      { Favorecido: 'SUBTOTAL FEV', Valor: 50 },
      { Favorecido: 'CARLA', Valor: 200 },
    ])
    const r = await parseXlsx(buf)
    expect(r.rows).toHaveLength(2)
    expect(r.filteredCount).toBeGreaterThanOrEqual(2)
    expect(r.rows.map((x) => x.cells['Favorecido'])).toEqual(['GESTRA', 'CARLA'])
  })

  it('filtra linhas vazias / sem favorecido', async () => {
    const buf = await buildXlsx([
      { Favorecido: 'GESTRA', Valor: 100 },
      { Favorecido: '', Valor: null },
      { Favorecido: null, Valor: 50 },
      { Favorecido: 'ANA', Valor: 200 },
    ])
    const r = await parseXlsx(buf)
    expect(r.rows).toHaveLength(2)
  })

  it('gera headerHash deterministico (cache cross-import)', async () => {
    const buf1 = await buildXlsx([{ A: 1, B: 2, C: 3 }])
    const buf2 = await buildXlsx([{ A: 99, B: 'x', C: null }])
    const r1 = await parseXlsx(buf1)
    const r2 = await parseXlsx(buf2)
    expect(r1.headerHash).toBe(r2.headerHash)
    expect(r1.headerHash).toHaveLength(64) // sha256 hex
  })

  it('aba múltipla: retorna primeira + totalSheets > 1', async () => {
    const buf = await buildXlsx(
      [{ A: 1, B: 2 }],
      { sheetName: 'Despesas', extraSheets: 2 },
    )
    const r = await parseXlsx(buf)
    expect(r.sheetName).toBe('Despesas')
    expect(r.totalSheets).toBe(3)
  })
})

describe('parseBRDate — formato BR', () => {
  it('DD/MM/YYYY', () => {
    const d = parseBRDate('02/03/2026')
    expect(d).not.toBeNull()
    expect(d!.getUTCDate()).toBe(2)
    expect(d!.getUTCMonth()).toBe(2)
    expect(d!.getUTCFullYear()).toBe(2026)
  })

  it('D/M/YY (curto)', () => {
    const d = parseBRDate('5/3/26')
    expect(d).not.toBeNull()
    expect(d!.getUTCFullYear()).toBe(2026)
  })

  it('MM/YYYY (competência) vira dia 1', () => {
    const d = parseBRDate('03/2026')
    expect(d).not.toBeNull()
    expect(d!.getUTCDate()).toBe(1)
    expect(d!.getUTCMonth()).toBe(2)
  })

  it('null / vazio → null', () => {
    expect(parseBRDate(null)).toBeNull()
    expect(parseBRDate('')).toBeNull()
    expect(parseBRDate('   ')).toBeNull()
  })

  it('string inválida → null', () => {
    expect(parseBRDate('foo bar')).toBeNull()
  })

  it('ISO 2026-03-02 também parseia (fallback Date nativo)', () => {
    const d = parseBRDate('2026-03-02')
    expect(d).not.toBeNull()
    expect(d!.getUTCFullYear()).toBe(2026)
  })
})
