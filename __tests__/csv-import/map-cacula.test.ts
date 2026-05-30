// Sprint CSV Import (30/05/2026) — Tests do orquestrador map-cacula.

import { describe, it, expect } from 'vitest'
import { mapearLinhaCacula, mapearCacula } from '@/lib/csv-import/map-cacula'
import { CACULA_HEADERS } from '@/lib/csv-import/detect-cacula'
import { parseCsv } from '@/lib/csv-import/parse-csv'

function buildRow(overrides: Partial<Record<number, string>>): string[] {
  const row = Array(20).fill('-')
  for (const [idx, val] of Object.entries(overrides)) {
    row[Number(idx)] = val
  }
  return row
}

describe('mapearLinhaCacula — happy path PAGO+pagamento', () => {
  const row = buildRow({
    0: '29478',
    4: '-153,00',
    7: '30/05/2026',
    8: '30/05/2026',
    9: '30/05/2026',
    10: 'CACULA MIX ITAQUI',
    12: 'PAGO',
    13: 'URSO SILVANO',
    14: 'ENTREGADOR DELIVERY',
    15: '-',
  })

  it('valor positivo absoluto', () => {
    const r = mapearLinhaCacula(row, 0)
    expect(r.valor).toBe(153)
    expect(r.rawValor).toBe(-153)
  })

  it('lifecycle EFFECTED', () => {
    const r = mapearLinhaCacula(row, 0)
    expect(r.lifecycle).toBe('EFFECTED')
    expect(r.pagamento).toEqual(new Date('2026-05-30T00:00:00.000Z'))
  })

  it('descrição = CREDOR sozinho quando DESCRICAO="-"', () => {
    const r = mapearLinhaCacula(row, 0)
    expect(r.rawDescricao).toBe('URSO SILVANO')
  })

  it('categoria limpa', () => {
    const r = mapearLinhaCacula(row, 0)
    expect(r.categoriaLimpa).toBe('ENTREGADOR DELIVERY')
  })

  it('sem erros de parse', () => {
    const r = mapearLinhaCacula(row, 0)
    expect(r.errosParse).toEqual([])
  })

  it('sem precisarRevisar', () => {
    const r = mapearLinhaCacula(row, 0)
    expect(r.precisaRevisar).toBe(false)
  })
})

describe('mapearLinhaCacula — VENCE HOJE/VENCIDO', () => {
  it('VENCE HOJE + pagamento "-" → PAYABLE, pagamento null', () => {
    const row = buildRow({
      4: '-100,00',
      7: '30/05/2026',
      8: '30/05/2026',
      9: '-',
      12: 'VENCE HOJE',
      13: 'FORNECEDOR X',
      14: '-',
      15: '-',
    })
    const r = mapearLinhaCacula(row, 0)
    expect(r.lifecycle).toBe('PAYABLE')
    expect(r.pagamento).toBeNull()
    expect(r.valor).toBe(100)
  })

  it('VENCIDO → PAYABLE', () => {
    const row = buildRow({
      4: '-50,00',
      8: '20/05/2026',
      12: 'VENCIDO',
      13: 'FORNECEDOR Y',
    })
    const r = mapearLinhaCacula(row, 0)
    expect(r.lifecycle).toBe('PAYABLE')
  })
})

describe('mapearLinhaCacula — categoria suja + multi', () => {
  it('categoria com "( R$ X )" embedded → limpa', () => {
    const row = buildRow({
      4: '-180,00',
      7: '29/05/2026',
      8: '29/05/2026',
      9: '29/05/2026',
      12: 'PAGO',
      13: 'ARTES GRÁFICAS',
      14: 'MATERIAL ESCRITORIO ( R$ 180,00 );',
    })
    const r = mapearLinhaCacula(row, 0)
    expect(r.categoriaLimpa).toBe('MATERIAL ESCRITORIO')
    expect(r.temMultiplasCategorias).toBe(false)
  })

  it('multi-categoria → marca pra revisão', () => {
    const row = buildRow({
      4: '-1.692,00',
      7: '24/03/2026',
      8: '03/05/2026',
      9: '04/05/2026',
      12: 'PAGO',
      13: 'BOX PAPER',
      14: 'EMBALAGENS ( R$ 1.144,08 );OUTRAS ( R$ 547,92 );',
    })
    const r = mapearLinhaCacula(row, 0)
    expect(r.temMultiplasCategorias).toBe(true)
    expect(r.contagemCategorias).toBe(2)
    expect(r.categoriaLimpa).toBe('EMBALAGENS')
    expect(r.todasCategorias).toEqual(['EMBALAGENS', 'OUTRAS'])
    expect(r.precisaRevisar).toBe(true)
    expect(r.motivosRevisar[0]).toContain('Múltiplas categorias')
  })

  it('NUNCA usa valor da categoria — só do TOTAL', () => {
    const row = buildRow({
      4: '-210,00',
      7: '01/05/2026',
      8: '01/05/2026',
      9: '03/05/2026',
      12: 'PAGO',
      13: 'FOR',
      14: 'OUTRAS ( R$ 240,00 );',
    })
    const r = mapearLinhaCacula(row, 0)
    expect(r.valor).toBe(210)
    expect(r.valor).not.toBe(240)
  })
})

describe('mapearLinhaCacula — descrição combinada', () => {
  it('CREDOR + " — " + DESCRICAO quando DESCRICAO ≠ "-"', () => {
    const row = buildRow({
      4: '-100,00',
      7: '30/05/2026',
      8: '30/05/2026',
      12: 'VENCE HOJE',
      13: 'EMPRESA A',
      14: '-',
      15: 'NF 123 SERVIÇOS DE PINTURA',
    })
    const r = mapearLinhaCacula(row, 0)
    expect(r.rawDescricao).toBe('EMPRESA A — NF 123 SERVIÇOS DE PINTURA')
  })

  it('só CREDOR quando DESCRICAO=null', () => {
    const row = buildRow({
      4: '-100,00',
      8: '30/05/2026',
      12: 'VENCE HOJE',
      13: 'EMPRESA B',
      15: '-',
    })
    const r = mapearLinhaCacula(row, 0)
    expect(r.rawDescricao).toBe('EMPRESA B')
  })
})

describe('mapearLinhaCacula — edges + guard R$ 939k', () => {
  it('PAGO sem data de pagamento → PAYABLE + precisaRevisar', () => {
    const row = buildRow({
      4: '-100,00',
      7: '30/05/2026',
      8: '30/05/2026',
      9: '-',
      12: 'PAGO',
      13: 'X',
    })
    const r = mapearLinhaCacula(row, 0)
    expect(r.lifecycle).toBe('PAYABLE')
    expect(r.pagamento).toBeNull()
    expect(r.precisaRevisar).toBe(true)
    expect(r.motivosRevisar.join(' ')).toContain('PAGO sem data')
  })

  it('TOTAL inválido → erro de parse + valor=0', () => {
    const row = buildRow({
      4: 'abc',
      8: '30/05/2026',
      12: 'VENCE HOJE',
      13: 'X',
    })
    const r = mapearLinhaCacula(row, 0)
    expect(r.errosParse.length).toBeGreaterThan(0)
    expect(r.errosParse[0]).toContain('TOTAL')
    expect(r.valor).toBe(0)
  })

  it('sem vencimento E sem competência → erro + marca pra revisão', () => {
    const row = buildRow({
      4: '-100,00',
      7: '-',
      8: '-',
      12: 'VENCE HOJE',
      13: 'X',
    })
    const r = mapearLinhaCacula(row, 0)
    expect(r.errosParse.length).toBeGreaterThan(0)
    expect(r.precisaRevisar).toBe(true)
  })

  it('vencimento ausente mas competência presente → usa competência como dueDate', () => {
    const row = buildRow({
      4: '-100,00',
      7: '30/05/2026',
      8: '-',
      9: '-',
      12: 'VENCE HOJE',
      13: 'X',
    })
    const r = mapearLinhaCacula(row, 0)
    expect(r.lifecycle).toBe('PAYABLE')
    expect(r.errosParse).toHaveLength(0)
  })
})

describe('mapearCacula — integração com parseCsv', () => {
  it('CSV mini com 2 linhas → 2 CaculaMappedRow + stats corretas', () => {
    const headerLine = [...CACULA_HEADERS].join(';') + ';'
    const row1 =
      [
        '"29478"', '"-153,00"', '"0,00"', '"0,00"', '"-153,00"', '"1|1"',
        '"30/05/2026"', '"30/05/2026"', '"30/05/2026"', '"-"',
        '"CACULA MIX ITAQUI"', '"ENTREGADOR DELIVERY"', '"VENCE HOJE"',
        '"URSO SILVANO"', '"ENTREGADOR DELIVERY"', '"-"',
        '"DINHEIRO"', '"-"', '"-"', '"-"',
      ].join(';') + ';'
    const row2 =
      [
        '"29425"', '"-180,00"', '"0,00"', '"0,00"', '"-180,00"', '"1|1"',
        '"29/05/2026"', '"29/05/2026"', '"28/05/2026"', '"29/05/2026"',
        '"CACULA MIX ITAQUI"', '"ENTRADA"', '"PAGO"',
        '"ARTES GRÁFICAS ITAQUI"', '"MATERIAL ESCRITORIO ( R$ 180,00 );"',
        '"-"', '"PIX/TRANSF. BANCARIA"', '""', '"-"', '"-"',
      ].join(';') + ';'

    const csv = `${headerLine}\n${row1}\n${row2}`
    const parsed = parseCsv(csv)
    const result = mapearCacula(parsed)

    expect(result.rows).toHaveLength(2)
    expect(result.unidadeArquivo).toBe('CACULA MIX ITAQUI')
    expect(result.stats.total).toBe(2)
    expect(result.stats.payable).toBe(1)
    expect(result.stats.effected).toBe(1)
    expect(result.rows[1].categoriaLimpa).toBe('MATERIAL ESCRITORIO')
    expect(result.rows[1].rawDescricao).toBe('ARTES GRÁFICAS ITAQUI')
  })

  it('joga erro se header NÃO é CACULA', () => {
    const parsed = parseCsv('Nome;Valor\nX;100')
    expect(() => mapearCacula(parsed)).toThrow(/header não-CACULA/)
  })
})
