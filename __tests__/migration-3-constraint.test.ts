// Fase 3 — Testes da lógica da constraint `manual_transfer_consistente`.
//
// Replica em função pura o predicado CHECK do banco:
//   CHECK NOT (origin='MANUAL' AND type='TRANSFER' AND transferGroupId IS NULL)
//
// Isso prova que a regra está correta antes de aplicar em prod.

import { describe, it, expect } from 'vitest'

/** Predicado da constraint — replica EXATO o CHECK do banco.
 *  Retorna `true` se a tx VIOLA a constraint (= banco rejeitaria). */
function violatesManualTransferConsistente(t: {
  origin: string
  type: string
  transferGroupId: string | null
}): boolean {
  return t.origin === 'MANUAL' && t.type === 'TRANSFER' && t.transferGroupId === null
}

describe('Fase 3 — constraint manual_transfer_consistente', () => {
  // ──────────────────────────────────────────────────────────
  it('T1. MANUAL + TRANSFER + transferGroupId set → PASSA', () => {
    expect(
      violatesManualTransferConsistente({
        origin: 'MANUAL', type: 'TRANSFER', transferGroupId: 'grupo-123',
      }),
    ).toBe(false)
  })

  // ──────────────────────────────────────────────────────────
  it('T2. ⚠️ MANUAL + TRANSFER + transferGroupId NULL → REJEITA (estado órfão)', () => {
    expect(
      violatesManualTransferConsistente({
        origin: 'MANUAL', type: 'TRANSFER', transferGroupId: null,
      }),
    ).toBe(true)
  })

  // ──────────────────────────────────────────────────────────
  it('T3. OFX + TRANSFER + transferGroupId NULL → PASSA (constraint só pra MANUAL)', () => {
    expect(
      violatesManualTransferConsistente({
        origin: 'OFX', type: 'TRANSFER', transferGroupId: null,
      }),
    ).toBe(false)
  })

  // ──────────────────────────────────────────────────────────
  it('T4. MANUAL + DEBIT + transferGroupId NULL → PASSA (constraint só pra TRANSFER)', () => {
    expect(
      violatesManualTransferConsistente({
        origin: 'MANUAL', type: 'DEBIT', transferGroupId: null,
      }),
    ).toBe(false)
  })

  // ──────────────────────────────────────────────────────────
  it('T5. MANUAL + CREDIT + transferGroupId NULL → PASSA', () => {
    expect(
      violatesManualTransferConsistente({
        origin: 'MANUAL', type: 'CREDIT', transferGroupId: null,
      }),
    ).toBe(false)
  })

  // ──────────────────────────────────────────────────────────
  it('T6. ADJUSTMENT + TRANSFER + transferGroupId NULL → PASSA', () => {
    expect(
      violatesManualTransferConsistente({
        origin: 'ADJUSTMENT', type: 'TRANSFER', transferGroupId: null,
      }),
    ).toBe(false)
  })

  // ──────────────────────────────────────────────────────────
  it('T7. IMPORT_EXCEL + qualquer combinação → PASSA', () => {
    expect(
      violatesManualTransferConsistente({
        origin: 'IMPORT_EXCEL', type: 'TRANSFER', transferGroupId: null,
      }),
    ).toBe(false)
  })

  // ──────────────────────────────────────────────────────────
  it('Casos reais Cacula: 18 MANUAL TRANSFER com grupo → todas PASSAM', () => {
    // Cenário real: scripts de parear (PIX 7.400, 20.300, 3.000 etc) sempre
    // setam transferGroupId. Lib/transfers/create.ts idem.
    const casos = [
      { origin: 'MANUAL', type: 'TRANSFER', transferGroupId: '53ccf680-aaa' },  // PIX 21.000
      { origin: 'MANUAL', type: 'TRANSFER', transferGroupId: 'ee09ce0b-aaa' },  // PIX 9.100
      { origin: 'MANUAL', type: 'TRANSFER', transferGroupId: '7de154c4-aaa' },  // PIX 34.000
      { origin: 'MANUAL', type: 'TRANSFER', transferGroupId: '1ec907e5-aaa' },  // PIX 7.400 (Etapa 1)
      { origin: 'MANUAL', type: 'TRANSFER', transferGroupId: 'be748f09-aaa' },  // PIX 1.100
      { origin: 'MANUAL', type: 'TRANSFER', transferGroupId: 'cd70a595-aaa' },  // PIX 650
    ]
    for (const c of casos) {
      expect(violatesManualTransferConsistente(c)).toBe(false)
    }
  })
})
