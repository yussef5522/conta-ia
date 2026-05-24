// Sprint 3.0.4 C1 — helpers CSV de transações.

import { describe, it, expect } from 'vitest'
import {
  generateTransacoesCSV,
  transacoesCsvFilename,
} from '@/lib/transacoes/csv'
import type { TransacaoCsvRow } from '@/lib/transacoes/csv'

const ROW_BASE: TransacaoCsvRow = {
  id: 'tx1',
  date: new Date('2026-05-15T15:00:00Z'),
  description: 'NETFLIX',
  amount: 49.9,
  type: 'DEBIT',
  status: 'RECONCILED',
  classificationSource: 'RULE',
  aiConfidence: 0.95,
  category: { name: 'Streaming' },
  supplier: null,
  classifiedByRule: { padrao: 'NETFLIX' },
  bankAccount: {
    name: 'Conta corrente',
    bankName: 'Banrisul',
    company: { name: 'Cacula Mix', tradeName: null },
  },
}

describe('generateTransacoesCSV', () => {
  it('gera CSV com BOM + headers + 1 linha', () => {
    const csv = generateTransacoesCSV([ROW_BASE])
    expect(csv.startsWith('﻿')).toBe(true) // BOM UTF-8
    const lines = csv.split('\r\n')
    expect(lines.length).toBe(2)
    expect(lines[0]).toContain('Data')
    expect(lines[0]).toContain('Descrição')
    expect(lines[0]).toContain('Categoria')
    expect(lines[0]).toContain('Source IA')
  })

  it('formata amount com vírgula decimal + sinal negativo pra DEBIT', () => {
    const csv = generateTransacoesCSV([ROW_BASE])
    expect(csv).toContain('-49,90')
  })

  it('CREDIT sem sinal', () => {
    const csv = generateTransacoesCSV([
      { ...ROW_BASE, type: 'CREDIT', amount: 1500 },
    ])
    expect(csv).toContain('1500,00')
    expect(csv).not.toContain('-1500')
  })

  it('escapa campos com vírgula entre aspas', () => {
    const csv = generateTransacoesCSV([
      { ...ROW_BASE, description: 'TENDA, ATACADO' },
    ])
    expect(csv).toContain('"TENDA, ATACADO"')
  })

  it('escapa aspas duplas duplicando', () => {
    const csv = generateTransacoesCSV([
      { ...ROW_BASE, description: 'PIX "URGENTE"' },
    ])
    expect(csv).toContain('"PIX ""URGENTE"""')
  })

  it('translates source e status pra pt-BR', () => {
    const csv = generateTransacoesCSV([ROW_BASE])
    expect(csv).toContain('Regra')
    expect(csv).toContain('Conciliado')
    expect(csv).toContain('Saída')
  })

  it('confidence formatado como percentual inteiro', () => {
    expect(generateTransacoesCSV([ROW_BASE])).toContain('95%')
    expect(
      generateTransacoesCSV([{ ...ROW_BASE, aiConfidence: 0.756 }]),
    ).toContain('76%')
  })

  it('confidence null → vazio', () => {
    const csv = generateTransacoesCSV([
      { ...ROW_BASE, aiConfidence: null, classificationSource: null },
    ])
    const lines = csv.split('\r\n')
    expect(lines[1]).toMatch(/,,/) // dois campos vazios consecutivos
  })

  it('supplier usa nomeFantasia quando presente, senão razão', () => {
    const csv1 = generateTransacoesCSV([
      {
        ...ROW_BASE,
        supplier: { razaoSocial: 'NETFLIX BRASIL LTDA', nomeFantasia: 'Netflix' },
      },
    ])
    expect(csv1).toContain('Netflix')
    const csv2 = generateTransacoesCSV([
      {
        ...ROW_BASE,
        supplier: { razaoSocial: 'NETFLIX BRASIL LTDA', nomeFantasia: null },
      },
    ])
    expect(csv2).toContain('NETFLIX BRASIL LTDA')
  })

  it('empresa: tradeName tem precedência sobre name', () => {
    const csv = generateTransacoesCSV([
      {
        ...ROW_BASE,
        bankAccount: {
          ...ROW_BASE.bankAccount!,
          company: { name: 'CACULA COMERCIO LTDA', tradeName: 'Cacula Mix' },
        },
      },
    ])
    expect(csv).toContain('Cacula Mix')
    expect(csv).not.toContain('CACULA COMERCIO LTDA')
  })

  it('Sprint 4.0.1.a — bankAccount null não quebra (PAYABLE export)', () => {
    const csv = generateTransacoesCSV([
      { ...ROW_BASE, bankAccount: null },
    ])
    // Não deve quebrar e empresa/conta ficam vazias
    expect(csv).toContain('NETFLIX')
  })
})

describe('transacoesCsvFilename', () => {
  it('slug normalizado + data', () => {
    const f = transacoesCsvFilename('Cacula Mix', new Date('2026-05-23'))
    expect(f).toBe('transacoes-cacula-mix-20260523.csv')
  })

  it('remove acentos do slug', () => {
    expect(transacoesCsvFilename('Açaí Express', new Date('2026-01-01'))).toMatch(/acai-express/)
  })

  it('null empresa → "export"', () => {
    expect(transacoesCsvFilename(null, new Date('2026-01-01'))).toBe('transacoes-export-20260101.csv')
  })

  it('caracteres especiais viram hífens', () => {
    expect(transacoesCsvFilename('Loja@123!', new Date('2026-01-01'))).toMatch(/loja-123/)
  })

  it('limita slug a 40 chars', () => {
    const longName = 'A'.repeat(100)
    const f = transacoesCsvFilename(longName, new Date('2026-01-01'))
    // Slug não deve ter mais de 40 chars (a parte antes da data)
    const slug = f.replace('transacoes-', '').replace(/-\d+\.csv$/, '')
    expect(slug.length).toBeLessThanOrEqual(40)
  })
})
