// Sprint 0.5 Dia 2 — detecção heurística de transferências em 2 níveis:
//   HIGH (≥0.90): mesmo dia + valor exato + sinais opostos → PIX provável
//   MEDIUM (0.70-0.89): D+1 + valor exato + sinais opostos → TED provável
//   BOOST: descrição com PIX/TED/TRANSF → +0.05 a +0.10

import { describe, it, expect } from 'vitest'
import {
  detectarTransferenciasNoPreview,
  type OfxCandidateTransaction,
  type AccountTransactionsBundle,
} from '@/lib/ofx/detect-transfer'

const CONTA_IMPORTADA = { id: 'acc-banrisul', name: 'Banrisul Matriz' }
const CONTA_SICOOB = 'acc-sicoob'

function tx(
  id: string,
  type: 'CREDIT' | 'DEBIT',
  amount: number,
  date: string,
  description = 'Lançamento',
): OfxCandidateTransaction {
  return { id, type, amount, date: new Date(date), description }
}

function bundle(
  accountId: string,
  transactions: OfxCandidateTransaction[],
): AccountTransactionsBundle {
  return { accountId, accountName: 'Sicoob Filial', transactions }
}

describe('detectarTransferenciasNoPreview — NÍVEL ALTO (HIGH ≥0.90)', () => {
  it('mesmo dia + valor exato + sinais opostos → HIGH 0.90', () => {
    const novas = [tx('n1', 'DEBIT', 5000, '2026-05-11', 'Saque')]
    const outras = [bundle(CONTA_SICOOB, [tx('o1', 'CREDIT', 5000, '2026-05-11')])]
    const r = detectarTransferenciasNoPreview(novas, outras, CONTA_IMPORTADA)
    expect(r.candidates).toHaveLength(1)
    expect(r.candidates[0].confidence).toBe(0.9)
    expect(r.candidates[0].confidenceLevel).toBe('HIGH')
    expect(r.candidates[0].suggestedAction).toBe('AUTO_PAIR')
  })

  it('HIGH com keyword PIX → 1.0 (capped)', () => {
    const novas = [tx('n1', 'DEBIT', 5000, '2026-05-11', 'PIX ENVIADO BANRISUL')]
    const outras = [bundle(CONTA_SICOOB, [tx('o1', 'CREDIT', 5000, '2026-05-11')])]
    const r = detectarTransferenciasNoPreview(novas, outras, CONTA_IMPORTADA)
    expect(r.candidates[0].confidence).toBe(1.0)
    expect(r.candidates[0].confidenceLevel).toBe('HIGH')
    expect(r.candidates[0].reason).toContain('PIX')
  })

  it('HIGH detecta direção: DEBIT é "from", CREDIT é "to"', () => {
    const novas = [tx('saida-banrisul', 'DEBIT', 3000, '2026-05-11')]
    const outras = [bundle(CONTA_SICOOB, [tx('entrada-sicoob', 'CREDIT', 3000, '2026-05-11')])]
    const r = detectarTransferenciasNoPreview(novas, outras, CONTA_IMPORTADA)
    expect(r.candidates[0].fromTransactionId).toBe('saida-banrisul')
    expect(r.candidates[0].toTransactionId).toBe('entrada-sicoob')
    expect(r.candidates[0].fromAccountId).toBe(CONTA_IMPORTADA.id)
    expect(r.candidates[0].toAccountId).toBe(CONTA_SICOOB)
  })

  it('HIGH detecta direção invertida: CREDIT nova + DEBIT na outra', () => {
    const novas = [tx('entrada-banrisul', 'CREDIT', 2000, '2026-05-11')]
    const outras = [bundle(CONTA_SICOOB, [tx('saida-sicoob', 'DEBIT', 2000, '2026-05-11')])]
    const r = detectarTransferenciasNoPreview(novas, outras, CONTA_IMPORTADA)
    expect(r.candidates[0].fromTransactionId).toBe('saida-sicoob')
    expect(r.candidates[0].toTransactionId).toBe('entrada-banrisul')
    expect(r.candidates[0].fromAccountId).toBe(CONTA_SICOOB)
    expect(r.candidates[0].toAccountId).toBe(CONTA_IMPORTADA.id)
  })
})

describe('detectarTransferenciasNoPreview — NÍVEL MÉDIO (0.70-0.89)', () => {
  it('D+1 + valor exato + sinais opostos → MEDIUM 0.75', () => {
    const novas = [tx('n1', 'DEBIT', 5000, '2026-05-11')]
    const outras = [bundle(CONTA_SICOOB, [tx('o1', 'CREDIT', 5000, '2026-05-12')])]
    const r = detectarTransferenciasNoPreview(novas, outras, CONTA_IMPORTADA)
    expect(r.candidates).toHaveLength(1)
    expect(r.candidates[0].confidence).toBe(0.75)
    expect(r.candidates[0].confidenceLevel).toBe('MEDIUM')
    expect(r.candidates[0].suggestedAction).toBe('CONFIRM')
  })

  it('MEDIUM com keyword TED → 0.85 ainda MEDIUM', () => {
    const novas = [tx('n1', 'DEBIT', 5000, '2026-05-11', 'TED ENVIADA')]
    const outras = [bundle(CONTA_SICOOB, [tx('o1', 'CREDIT', 5000, '2026-05-12')])]
    const r = detectarTransferenciasNoPreview(novas, outras, CONTA_IMPORTADA)
    expect(r.candidates[0].confidence).toBe(0.85)
    expect(r.candidates[0].confidenceLevel).toBe('MEDIUM')
    expect(r.candidates[0].reason).toContain('TED')
  })

  it('MEDIUM com keyword TRANSF → 0.80 ainda MEDIUM (boost 0.05)', () => {
    const novas = [tx('n1', 'DEBIT', 5000, '2026-05-11', 'TRANSF entre contas')]
    const outras = [bundle(CONTA_SICOOB, [tx('o1', 'CREDIT', 5000, '2026-05-12')])]
    const r = detectarTransferenciasNoPreview(novas, outras, CONTA_IMPORTADA)
    expect(r.candidates[0].confidence).toBe(0.8)
    expect(r.candidates[0].confidenceLevel).toBe('MEDIUM')
  })

  it('D-1 (data outra é UM DIA ANTES da nova) também detecta como MEDIUM', () => {
    const novas = [tx('n1', 'CREDIT', 5000, '2026-05-12')]
    const outras = [bundle(CONTA_SICOOB, [tx('o1', 'DEBIT', 5000, '2026-05-11')])]
    const r = detectarTransferenciasNoPreview(novas, outras, CONTA_IMPORTADA)
    expect(r.candidates).toHaveLength(1)
    expect(r.candidates[0].confidenceLevel).toBe('MEDIUM')
  })
})

describe('detectarTransferenciasNoPreview — REJEIÇÕES', () => {
  it('valor diferente → não sugere nada', () => {
    const novas = [tx('n1', 'DEBIT', 5000, '2026-05-11')]
    const outras = [bundle(CONTA_SICOOB, [tx('o1', 'CREDIT', 4999.99, '2026-05-11')])]
    const r = detectarTransferenciasNoPreview(novas, outras, CONTA_IMPORTADA)
    expect(r.candidates).toHaveLength(0)
  })

  it('tolerância de 1 centavo é OK (rounding)', () => {
    const novas = [tx('n1', 'DEBIT', 5000.005, '2026-05-11')]
    const outras = [bundle(CONTA_SICOOB, [tx('o1', 'CREDIT', 5000.0, '2026-05-11')])]
    const r = detectarTransferenciasNoPreview(novas, outras, CONTA_IMPORTADA)
    expect(r.candidates).toHaveLength(1)
  })

  it('data com >1 dia de diferença → não sugere', () => {
    const novas = [tx('n1', 'DEBIT', 5000, '2026-05-11')]
    const outras = [bundle(CONTA_SICOOB, [tx('o1', 'CREDIT', 5000, '2026-05-15')])]
    const r = detectarTransferenciasNoPreview(novas, outras, CONTA_IMPORTADA)
    expect(r.candidates).toHaveLength(0)
  })

  it('mesmos sinais (2 DEBIT ou 2 CREDIT) → não sugere', () => {
    const novas = [tx('n1', 'DEBIT', 5000, '2026-05-11')]
    const outras = [bundle(CONTA_SICOOB, [tx('o1', 'DEBIT', 5000, '2026-05-11')])]
    const r = detectarTransferenciasNoPreview(novas, outras, CONTA_IMPORTADA)
    expect(r.candidates).toHaveLength(0)
  })

  it('zero outras contas → não sugere', () => {
    const novas = [tx('n1', 'DEBIT', 5000, '2026-05-11')]
    const r = detectarTransferenciasNoPreview(novas, [], CONTA_IMPORTADA)
    expect(r.candidates).toHaveLength(0)
  })

  it('mesma conta (importada aparece em outrasContas por erro) → ignora', () => {
    const novas = [tx('n1', 'DEBIT', 5000, '2026-05-11')]
    const outras = [
      bundle(CONTA_IMPORTADA.id, [tx('o1', 'CREDIT', 5000, '2026-05-11')]),
    ]
    const r = detectarTransferenciasNoPreview(novas, outras, CONTA_IMPORTADA)
    expect(r.candidates).toHaveLength(0)
  })
})

describe('detectarTransferenciasNoPreview — RANKING', () => {
  it('ordena candidatos por confiança decrescente', () => {
    const novas = [
      tx('high', 'DEBIT', 1000, '2026-05-11', 'PIX'),
      tx('med', 'DEBIT', 2000, '2026-05-11'),
    ]
    const outras = [
      bundle(CONTA_SICOOB, [
        tx('high-par', 'CREDIT', 1000, '2026-05-11'),
        tx('med-par', 'CREDIT', 2000, '2026-05-12'),
      ]),
    ]
    const r = detectarTransferenciasNoPreview(novas, outras, CONTA_IMPORTADA)
    expect(r.candidates).toHaveLength(2)
    expect(r.candidates[0].confidence).toBeGreaterThan(r.candidates[1].confidence)
    expect(r.candidates[0].fromTransactionId).toBe('high')
  })
})

describe('detectarTransferenciasNoPreview — REASON e suggestedAction', () => {
  it('HIGH com PIX: reason inclui "Mesmo dia + valor exato + descrição contém PIX"', () => {
    const novas = [tx('n1', 'DEBIT', 1000, '2026-05-11', 'PIX')]
    const outras = [bundle(CONTA_SICOOB, [tx('o1', 'CREDIT', 1000, '2026-05-11')])]
    const r = detectarTransferenciasNoPreview(novas, outras, CONTA_IMPORTADA)
    expect(r.candidates[0].reason).toBe(
      'Mesmo dia + valor exato + descrição contém "PIX"',
    )
  })

  it('MEDIUM sem keyword: reason "D+1 + valor exato"', () => {
    const novas = [tx('n1', 'DEBIT', 1000, '2026-05-11')]
    const outras = [bundle(CONTA_SICOOB, [tx('o1', 'CREDIT', 1000, '2026-05-12')])]
    const r = detectarTransferenciasNoPreview(novas, outras, CONTA_IMPORTADA)
    expect(r.candidates[0].reason).toBe('D+1 + valor exato')
  })

  it('thresholds de suggestedAction: AUTO_PAIR (≥0.90), CONFIRM (≥0.70)', () => {
    const novas = [
      tx('a', 'DEBIT', 1000, '2026-05-11', 'PIX'), // HIGH 1.0
      tx('b', 'DEBIT', 2000, '2026-05-11'), // HIGH 0.90
      tx('c', 'DEBIT', 3000, '2026-05-11'), // MEDIUM via D+1
    ]
    const outras = [
      bundle(CONTA_SICOOB, [
        tx('a-par', 'CREDIT', 1000, '2026-05-11'),
        tx('b-par', 'CREDIT', 2000, '2026-05-11'),
        tx('c-par', 'CREDIT', 3000, '2026-05-12'),
      ]),
    ]
    const r = detectarTransferenciasNoPreview(novas, outras, CONTA_IMPORTADA)
    expect(r.candidates).toHaveLength(3)
    const byId = Object.fromEntries(r.candidates.map((c) => [c.fromTransactionId, c]))
    expect(byId['a'].suggestedAction).toBe('AUTO_PAIR')
    expect(byId['b'].suggestedAction).toBe('AUTO_PAIR')
    expect(byId['c'].suggestedAction).toBe('CONFIRM')
  })
})
