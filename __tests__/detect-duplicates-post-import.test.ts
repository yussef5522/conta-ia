// Fase 4 — Testes da função pura detectDuplicatesPostImport.
//
// ⚠️ D3 é o teste-chave: COMPRA REPETIDA REAL não vira falso positivo.
//    (mesmo guardião da Fase 1)

import { describe, it, expect } from 'vitest'
import {
  detectDuplicatesPostImport,
  type NewTxForDetect,
  type ExistingTxForDetect,
} from '../lib/import-warnings/detect'

const BANK_A = 'bank-A'

function newTx(opts: Partial<NewTxForDetect> & { id: string }): NewTxForDetect {
  return {
    id: opts.id,
    bankAccountId: opts.bankAccountId ?? BANK_A,
    amount: opts.amount ?? 100,
    date: opts.date ?? new Date('2026-06-12T00:00:00.000Z'),
    description: opts.description ?? 'PAGAMENTO X',
    type: opts.type ?? 'DEBIT',
    origin: opts.origin ?? 'OFX',
    createdAt: opts.createdAt ?? new Date('2026-06-12T02:00:00.000Z'),
    hasReconciledLink: opts.hasReconciledLink ?? false,
    reconciledFromCount: opts.reconciledFromCount ?? 0,
  }
}

function existingTx(opts: Partial<ExistingTxForDetect> & { id: string }): ExistingTxForDetect {
  return {
    id: opts.id,
    bankAccountId: opts.bankAccountId ?? BANK_A,
    amount: opts.amount ?? 100,
    date: opts.date ?? new Date('2026-06-12T00:00:00.000Z'),
    description: opts.description ?? 'PAGAMENTO X',
    type: opts.type ?? 'DEBIT',
    createdAt: opts.createdAt ?? new Date('2026-06-11T12:00:00.000Z'),
    hasReconciledLink: opts.hasReconciledLink ?? false,
    reconciledFromCount: opts.reconciledFromCount ?? 0,
  }
}

describe('Fase 4 — detectDuplicatesPostImport', () => {
  // ──────────────────────────────────────────────────────────
  it('D1. DB tem 1 R$ 100 ontem; lote tem 1 R$ 100 hoje → 1 warning', () => {
    const warnings = detectDuplicatesPostImport({
      newTxs: [newTx({ id: 'new-1', amount: 100, description: 'PIX X' })],
      existingTxs: [existingTx({ id: 'sys-1', amount: 100, description: 'PIX X' })],
    })
    expect(warnings).toHaveLength(1)
    expect(warnings[0].newTxId).toBe('new-1')
    expect(warnings[0].suspectedDupId).toBe('sys-1')
    expect(warnings[0].similarity).toBeGreaterThanOrEqual(0.8)
  })

  // ──────────────────────────────────────────────────────────
  it('D2. DB tem 1 R$ 100 JÁ LINKADA; lote tem 1 R$ 100 → 0 warnings (sistema sabe)', () => {
    const warnings = detectDuplicatesPostImport({
      newTxs: [newTx({ id: 'new-1' })],
      existingTxs: [existingTx({ id: 'sys-1', hasReconciledLink: true })],
    })
    expect(warnings).toHaveLength(0)
  })

  // ──────────────────────────────────────────────────────────
  it('⚠️ D3. COMPRA REPETIDA REAL (1 sistema, 2 lote) → 1 warning (não 2!)', () => {
    // Sistema tem 1 R$ 105 criada ontem. Lote tem 2 R$ 105 hoje.
    // A 1ª do lote (criada mais cedo) "claim" a do sistema → 1 warning.
    // A 2ª do lote não tem candidato disponível → não é warning (real preservada).
    const warnings = detectDuplicatesPostImport({
      newTxs: [
        newTx({ id: 'new-1', amount: 105, description: 'PAGAMENTO FORNECEDOR X', createdAt: new Date('2026-06-12T02:00:00Z') }),
        newTx({ id: 'new-2', amount: 105, description: 'PAGAMENTO FORNECEDOR X', createdAt: new Date('2026-06-12T02:00:01Z') }),
      ],
      existingTxs: [
        existingTx({ id: 'sys-1', amount: 105, description: 'PAGAMENTO FORNECEDOR X' }),
      ],
    })
    expect(warnings).toHaveLength(1)
    expect(warnings[0].newTxId).toBe('new-1')
    expect(warnings[0].suspectedDupId).toBe('sys-1')
    // Garante que new-2 NÃO foi marcada como dup (protege real)
    expect(warnings.find((w) => w.newTxId === 'new-2')).toBeUndefined()
  })

  // ──────────────────────────────────────────────────────────
  it('D4. DB tem 2 R$ 105; lote tem 2 R$ 105 → 2 warnings', () => {
    const warnings = detectDuplicatesPostImport({
      newTxs: [
        newTx({ id: 'new-1', amount: 105, createdAt: new Date('2026-06-12T02:00:00Z') }),
        newTx({ id: 'new-2', amount: 105, createdAt: new Date('2026-06-12T02:00:01Z') }),
      ],
      existingTxs: [
        existingTx({ id: 'sys-1', amount: 105 }),
        existingTx({ id: 'sys-2', amount: 105 }),
      ],
    })
    expect(warnings).toHaveLength(2)
    // Cada warning casa com candidato diferente (claim 1:1)
    const ids = warnings.map((w) => w.suspectedDupId).sort()
    expect(ids).toEqual(['sys-1', 'sys-2'])
  })

  // ──────────────────────────────────────────────────────────
  it('D5. DB tem 2 R$ 105; lote tem 3 R$ 105 → 2 warnings (3ª real)', () => {
    const warnings = detectDuplicatesPostImport({
      newTxs: [
        newTx({ id: 'new-1', amount: 105, createdAt: new Date('2026-06-12T02:00:00Z') }),
        newTx({ id: 'new-2', amount: 105, createdAt: new Date('2026-06-12T02:00:01Z') }),
        newTx({ id: 'new-3', amount: 105, createdAt: new Date('2026-06-12T02:00:02Z') }),
      ],
      existingTxs: [
        existingTx({ id: 'sys-1', amount: 105 }),
        existingTx({ id: 'sys-2', amount: 105 }),
      ],
    })
    expect(warnings).toHaveLength(2)
    // new-3 (mais recente) fica sem candidato
    expect(warnings.find((w) => w.newTxId === 'new-3')).toBeUndefined()
  })

  // ──────────────────────────────────────────────────────────
  it('D6. Multi-tenant: existing em OUTRO bankAccount → 0 warnings', () => {
    const warnings = detectDuplicatesPostImport({
      newTxs: [newTx({ id: 'new-1', bankAccountId: BANK_A })],
      existingTxs: [existingTx({ id: 'sys-1', bankAccountId: 'OUTRO-BANK' })],
    })
    expect(warnings).toHaveLength(0)
  })

  // ──────────────────────────────────────────────────────────
  it('D7. DB tem 1 R$ 100 há 7 dias (fora janela ±1d) → 0 warnings', () => {
    const warnings = detectDuplicatesPostImport({
      newTxs: [newTx({ id: 'new-1', date: new Date('2026-06-12T00:00:00Z') })],
      existingTxs: [existingTx({ id: 'sys-1', date: new Date('2026-06-05T00:00:00Z') })],
    })
    expect(warnings).toHaveLength(0)
  })

  // ──────────────────────────────────────────────────────────
  it('D8. valor 100 vs 100,03 (fora tolerância 0,02) → 0 warnings', () => {
    const warnings = detectDuplicatesPostImport({
      newTxs: [newTx({ id: 'new-1', amount: 100 })],
      existingTxs: [existingTx({ id: 'sys-1', amount: 100.03 })],
    })
    expect(warnings).toHaveLength(0)
  })

  // ──────────────────────────────────────────────────────────
  it('D9. DB tem DEBIT; lote tem CREDIT mesmo valor → 0 warnings', () => {
    const warnings = detectDuplicatesPostImport({
      newTxs: [newTx({ id: 'new-1', type: 'CREDIT' })],
      existingTxs: [existingTx({ id: 'sys-1', type: 'DEBIT' })],
    })
    expect(warnings).toHaveLength(0)
  })

  // ──────────────────────────────────────────────────────────
  it('D10. Descrição totalmente diferente (Jaro-Winkler < 0.80) → 0 warnings', () => {
    const warnings = detectDuplicatesPostImport({
      newTxs: [newTx({ id: 'new-1', description: 'PIX TOZZO ALIMENTOS' })],
      existingTxs: [existingTx({ id: 'sys-1', description: 'OUTRA COMPLETAMENTE DIFERENTE' })],
    })
    expect(warnings).toHaveLength(0)
  })

  // ──────────────────────────────────────────────────────────
  it('D11. newTx ELA MESMA (mesmo id) → 0 warnings (não compara consigo)', () => {
    const warnings = detectDuplicatesPostImport({
      newTxs: [newTx({ id: 'same-id', createdAt: new Date('2026-06-12T02:00:00Z') })],
      existingTxs: [existingTx({ id: 'same-id', createdAt: new Date('2026-06-12T01:00:00Z') })],
    })
    expect(warnings).toHaveLength(0)
  })

  // ──────────────────────────────────────────────────────────
  it('D12. reason é texto em pt-BR humano', () => {
    const warnings = detectDuplicatesPostImport({
      newTxs: [newTx({ id: 'new-1' })],
      existingTxs: [existingTx({ id: 'sys-1' })],
    })
    expect(warnings).toHaveLength(1)
    expect(warnings[0].reason).toMatch(/possível duplicação/i)
  })

  // ──────────────────────────────────────────────────────────
  it('D13. existingTx criada DEPOIS da newTx → ignora (não pode ser dup pré-existente)', () => {
    const warnings = detectDuplicatesPostImport({
      newTxs: [newTx({ id: 'new-1', createdAt: new Date('2026-06-12T02:00:00Z') })],
      existingTxs: [existingTx({ id: 'sys-1', createdAt: new Date('2026-06-12T03:00:00Z') })],
    })
    expect(warnings).toHaveLength(0)
  })

  // ──────────────────────────────────────────────────────────
  it('D14. newTx JÁ tem link (sistema sabe que está pareada) → 0 warnings', () => {
    const warnings = detectDuplicatesPostImport({
      newTxs: [newTx({ id: 'new-1', hasReconciledLink: true })],
      existingTxs: [existingTx({ id: 'sys-1' })],
    })
    expect(warnings).toHaveLength(0)
  })

  // ──────────────────────────────────────────────────────────
  it('Janela custom: dateWindowDays=5 → match em 4 dias separados', () => {
    const warnings = detectDuplicatesPostImport({
      newTxs: [newTx({ id: 'new-1', date: new Date('2026-06-12T00:00:00Z') })],
      existingTxs: [existingTx({ id: 'sys-1', date: new Date('2026-06-08T00:00:00Z') })],
      dateWindowDays: 5,
    })
    expect(warnings).toHaveLength(1)
  })
})
