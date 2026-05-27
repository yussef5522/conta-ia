// Sprint 5.0.3.0b — Tests do CSV export (PT-BR, Excel-compatível).

import { describe, it, expect } from 'vitest'
import {
  buildPayableCSV,
  buildCSVRow,
  buildCSVFilename,
  escapeCSV,
  formatNumberBR,
  formatDateBR,
  BOM,
  SEPARATOR,
  LINE_BREAK,
  type ExportRow,
} from '@/lib/contas-pagar/csv-export'

function makeRow(over: Partial<ExportRow> = {}): ExportRow {
  return {
    id: 'cmprow' + Math.random().toString(36).slice(2, 8),
    description: 'Aluguel março',
    amount: 1375.18,
    dueDate: '2026-03-05T00:00:00.000Z',
    paymentDate: '2026-03-04T00:00:00.000Z',
    status: 'RECONCILED',
    notes: 'NF: 142',
    category: {
      id: 'cat1',
      name: 'Aluguel',
      color: '#ef4444',
      dreGroup: 'DESPESAS_OPERACIONAIS',
    },
    supplier: {
      id: 'sup1',
      razaoSocial: 'G2 IMÓVEIS LTDA',
      nomeFantasia: null,
    },
    employee: null,
    bankAccount: { id: 'ba1', name: 'Conta PJ', bankName: 'Banrisul' },
    favorecidoType: 'SUPPLIER',
    ...over,
  }
}

describe('escapeCSV', () => {
  it('strings simples passam direto', () => {
    expect(escapeCSV('Aluguel')).toBe('Aluguel')
    expect(escapeCSV('São Borja')).toBe('São Borja')
  })

  it('valor com separador ; vira aspas duplas', () => {
    expect(escapeCSV('a; b')).toBe('"a; b"')
  })

  it('valor com " vira aspas duplas + escape ""', () => {
    expect(escapeCSV('John "Doe"')).toBe('"John ""Doe"""')
  })

  it('null/undefined viram string vazia', () => {
    expect(escapeCSV(null)).toBe('')
    expect(escapeCSV(undefined)).toBe('')
  })

  it('quebra de linha CRLF/LF aspas', () => {
    expect(escapeCSV('linha1\nlinha2')).toBe('"linha1\nlinha2"')
    expect(escapeCSV('a\r\nb')).toBe('"a\r\nb"')
  })

  it('número passa como string', () => {
    expect(escapeCSV(1234)).toBe('1234')
  })
})

describe('formatNumberBR', () => {
  it('1234.56 → 1.234,56', () => {
    expect(formatNumberBR(1234.56)).toBe('1.234,56')
  })

  it('0 → 0,00', () => {
    expect(formatNumberBR(0)).toBe('0,00')
  })

  it('rounding 2 decimais', () => {
    expect(formatNumberBR(1.005)).toMatch(/1,0[01]/) // rounding pode variar — só checa shape
  })

  it('milhão: 1234567.89 → 1.234.567,89', () => {
    expect(formatNumberBR(1234567.89)).toBe('1.234.567,89')
  })

  it('negativo: -1234.56 → -1.234,56', () => {
    expect(formatNumberBR(-1234.56)).toBe('-1.234,56')
  })
})

describe('formatDateBR', () => {
  it('ISO → dd/MM/yyyy UTC', () => {
    expect(formatDateBR('2026-03-05T00:00:00.000Z')).toBe('05/03/2026')
  })

  it('Date object', () => {
    expect(formatDateBR(new Date('2026-12-31T00:00:00.000Z'))).toBe(
      '31/12/2026',
    )
  })

  it('null/empty → string vazia', () => {
    expect(formatDateBR(null)).toBe('')
    expect(formatDateBR('')).toBe('')
  })

  it('inválido → string vazia (não NaN)', () => {
    expect(formatDateBR('not-a-date')).toBe('')
  })

  it('padding com zero (01/01/2026)', () => {
    expect(formatDateBR('2026-01-01T00:00:00.000Z')).toBe('01/01/2026')
  })
})

describe('buildCSVRow — linha completa', () => {
  it('contém todos os campos esperados em ordem', () => {
    const csv = buildCSVRow(makeRow())
    const cells = csv.split(SEPARATOR)
    expect(cells).toHaveLength(13)
    expect(cells[0]).toBe('Paga') // Status (paymentDate preenchida)
    expect(cells[1]).toBe('05/03/2026') // Vencimento
    expect(cells[2]).toBe('04/03/2026') // Pagamento
    expect(cells[3]).toBe('G2 IMÓVEIS LTDA') // Favorecido
    expect(cells[4]).toBe('Fornecedor') // Tipo
    expect(cells[5]).toBe('Aluguel março') // Descrição
    expect(cells[6]).toBe('Aluguel') // Categoria
    expect(cells[7]).toBe('DESPESAS_OPERACIONAIS') // Plano
    expect(cells[8]).toBe('142') // NFe (extraída de "NF: 142")
    expect(cells[9]).toBe('Banrisul') // Banco
    expect(cells[10]).toBe('') // Forma (vazio)
    expect(cells[11]).toBe('1.375,18') // Valor BR
    expect(cells[12]).toBe('NF: 142') // Notas
  })

  it('emprega nomeFantasia se preenchida (prioridade sobre razaoSocial)', () => {
    const row = makeRow({
      supplier: {
        id: 's',
        razaoSocial: 'Razão Social LTDA',
        nomeFantasia: 'Fantasia',
      },
    })
    const cells = buildCSVRow(row).split(SEPARATOR)
    expect(cells[3]).toBe('Fantasia')
  })

  it('PAYABLE de funcionário (employee em vez de supplier)', () => {
    const row = makeRow({
      supplier: null,
      employee: { id: 'e1', nome: 'Lana Barbosa' },
      favorecidoType: 'EMPLOYEE',
    })
    const cells = buildCSVRow(row).split(SEPARATOR)
    expect(cells[3]).toBe('Lana Barbosa')
    expect(cells[4]).toBe('Funcionário')
  })

  it('PENDING (sem pagamento) → Status="A pagar" + Pagamento vazio', () => {
    const row = makeRow({
      status: 'PENDING',
      paymentDate: null,
      dueDate: '2027-01-01T00:00:00.000Z',
    })
    const cells = buildCSVRow(row).split(SEPARATOR)
    expect(cells[2]).toBe('')
    expect(cells[0]).toBe('A pagar')
  })

  it('Valores com ; ou " escapam corretamente', () => {
    const row = makeRow({ description: 'Aluguel; março' })
    const csv = buildCSVRow(row)
    expect(csv).toContain('"Aluguel; março"')
  })

  it('Acentos preservados (UTF-8)', () => {
    const row = makeRow({
      description: 'Salário; férias',
      supplier: { id: 's', razaoSocial: 'São Borja LTDA', nomeFantasia: null },
    })
    const csv = buildCSVRow(row)
    expect(csv).toContain('São Borja LTDA')
    expect(csv).toContain('"Salário; férias"')
  })
})

describe('buildPayableCSV — arquivo completo', () => {
  it('começa com BOM UTF-8', () => {
    const csv = buildPayableCSV([])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv.startsWith(BOM)).toBe(true)
  })

  it('inclui linha de cabeçalho com 13 colunas', () => {
    const csv = buildPayableCSV([])
    const headerLine = csv.slice(BOM.length).split(LINE_BREAK)[0]
    expect(headerLine.split(SEPARATOR)).toHaveLength(13)
    expect(headerLine).toContain('Vencimento')
    expect(headerLine).toContain('Favorecido')
    expect(headerLine).toContain('Valor')
  })

  it('csv vazio (0 rows) tem BOM + header + CRLF', () => {
    const csv = buildPayableCSV([])
    const lines = csv.slice(BOM.length).split(LINE_BREAK)
    // lines = ['HEADER', ''] — header + trailing empty depois do CRLF
    expect(lines.length).toBe(2)
    expect(lines[0]).toContain('Status')
    expect(lines[1]).toBe('')
  })

  it('csv com 2 rows: BOM + header + row1 + row2 + final CRLF', () => {
    const csv = buildPayableCSV([makeRow(), makeRow()])
    const body = csv.slice(BOM.length)
    const lines = body.split(LINE_BREAK)
    expect(lines.length).toBe(4) // header + 2 rows + trailing empty (do CRLF final)
    expect(lines[0]).toContain('Status') // header
    expect(lines[lines.length - 1]).toBe('') // trailing CRLF
  })

  it('separador é PONTO-E-VÍRGULA (não vírgula)', () => {
    const csv = buildPayableCSV([makeRow()])
    expect(csv).toContain(';')
    // Vírgulas só aparecem em descrições/notes
    const body = csv.slice(BOM.length).split(LINE_BREAK)[1]
    expect(body.split(';').length).toBe(13)
  })

  it('line breaks são CRLF (\\r\\n)', () => {
    const csv = buildPayableCSV([makeRow()])
    expect(csv).toContain('\r\n')
    // Não deve ter LF isolado fora de campos quoteados
    expect(csv.replace(/\r\n/g, '|').replace(/"[^"]*"/g, '')).not.toContain('\n')
  })
})

describe('buildCSVFilename', () => {
  it('formato contas-pagar-{slug}-{YYYY-MM-DD}.csv', () => {
    expect(buildCSVFilename('Cacula Mix', new Date('2026-05-27'))).toBe(
      'contas-pagar-cacula-mix-2026-05-27.csv',
    )
  })

  it('remove acentos', () => {
    expect(
      buildCSVFilename('Açúcar União S.A.', new Date('2026-05-27')),
    ).toMatch(/^contas-pagar-acucar-uniao-s-a-2026-05-27\.csv$/)
  })

  it('caracteres especiais viram traços', () => {
    expect(buildCSVFilename('A&B / Co.', new Date('2026-05-27'))).toBe(
      'contas-pagar-a-b-co-2026-05-27.csv',
    )
  })

  it('nome vazio → "export"', () => {
    expect(buildCSVFilename('', new Date('2026-05-27'))).toBe(
      'contas-pagar-export-2026-05-27.csv',
    )
  })

  it('cap 40 chars do slug', () => {
    const longName = 'A'.repeat(100)
    const filename = buildCSVFilename(longName, new Date('2026-05-27'))
    // slug parte tem ≤40 chars
    const slugPart = filename.replace(/^contas-pagar-/, '').replace(/-\d{4}-\d{2}-\d{2}\.csv$/, '')
    expect(slugPart.length).toBeLessThanOrEqual(40)
  })
})
