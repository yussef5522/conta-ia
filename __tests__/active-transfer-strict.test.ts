// Sprint 5.0.2.u — Validação ESTRITA de pares (validateTransferPair).
//
// Casos do print real do Cacula Mix (11 falsos positivos da Sprint t).

import { describe, it, expect } from 'vitest'
import {
  validateTransferPair,
  isPixDebitDesc,
  isPixCreditDesc,
  isBlacklistedDesc,
  descContainsCnpj,
  hasPersonName,
} from '@/lib/conciliation/active-transfer-detector'

const CACULA_CNPJ = '29756732000198'

function mkDate(iso: string): Date {
  return new Date(iso + 'T12:00:00Z')
}

function mkInput(
  debitDesc: string,
  creditDesc: string,
  opts: { sameDate?: boolean; valorComum?: boolean } = {},
) {
  const date = mkDate('2026-05-15')
  return {
    debit: { description: debitDesc, date, paymentDate: opts.sameDate === false ? null : date },
    credit: {
      description: creditDesc,
      date: opts.sameDate === false ? mkDate('2026-05-17') : date,
      paymentDate: opts.sameDate === false ? mkDate('2026-05-17') : date,
    },
    companyCnpj: CACULA_CNPJ,
    valorComum: opts.valorComum,
  }
}

describe('REJECTS — casos reais Cacula Mix do print', () => {
  it('Pix Cristian -100 + Pix Daniela +100 (pessoas distintas)', () => {
    const r = validateTransferPair(
      mkInput(
        'Cristian de Matos Fortes - Transferência | Pix',
        'RECEBIMENTO PIX-PIX_CRED 03208880022 Daniela Aguilar Fernandes',
      ),
    )
    expect(r.valid).toBe(false)
    // Cristian descrição não tem "PIX_DEB" - cai em "Débito não é PIX"
    // (Caso real: pix enviado costuma ter PIX_DEB; aqui só tem "Pix" no fim, sem PIX_DEB)
    expect(r.confidence).toBe(0)
  })

  it('PIX_DEB 20000 + OP. CRÉDITO C/GARANTIA 20000 (empréstimo entrando)', () => {
    const r = validateTransferPair(
      mkInput(
        'PAGAMENTO PIX-PIX_DEB 29756732000198 CACULA MIX',
        'OP. CRÉDITO C/GARANTIA',
      ),
    )
    expect(r.valid).toBe(false)
    expect(r.reason).toContain('PIX')
  })

  it('PIX_DEB GHOST AGENCIA + OP CRÉDITO (pagamento + empréstimo)', () => {
    const r = validateTransferPair(
      mkInput(
        'PAGAMENTO PIX-PIX_DEB GHOST AGENCIA DE GROWTH MARKETING',
        'OP. CREDITO C/GARANTIA',
      ),
    )
    expect(r.valid).toBe(false)
  })

  it('PIX_DEB Fernanda + DEP DINHEIRO ATM (espécie)', () => {
    const r = validateTransferPair(
      mkInput(
        'PAGAMENTO PIX-PIX_DEB Fernanda Chaves Ramires',
        'DEP DINHEIRO ATM-2d223037',
      ),
    )
    expect(r.valid).toBe(false)
    // Crédito não casa PIX_CRED patterns
    expect(r.reason).toContain('PIX')
  })

  it('PIX_DEB Cristian + PIX_CRED Cassiana (pessoas diferentes)', () => {
    const r = validateTransferPair(
      mkInput(
        'PAGAMENTO PIX-PIX_DEB 03208880022 Cristian de Matos',
        'RECEBIMENTO PIX-PIX_CRED 11122233344 Cassiana Schmidt',
      ),
    )
    expect(r.valid).toBe(false)
    // CPFs de terceiros (11 dígitos) caem em "CNPJ de terceiro" ou anti-pessoa
  })

  it('PIX_DEB com CNPJ TERCEIRO + PIX_CRED CNPJ Cacula', () => {
    const r = validateTransferPair(
      mkInput(
        'PAGAMENTO PIX-PIX_DEB 12345678000199 FORNECEDOR XYZ LTDA',
        'RECEBIMENTO PIX-PIX_CRED 29756732000198 CACULA MIX',
      ),
    )
    expect(r.valid).toBe(false)
    expect(r.reason).toContain('terceiro')
  })
})

describe('ACCEPTS — transferência interna LEGÍTIMA', () => {
  it('PIX CNPJ Cacula nas DUAS pernas mesmo dia → AUTO confidence ≥0.95', () => {
    const r = validateTransferPair(
      mkInput(
        'PAGAMENTO PIX-PIX_DEB 29756732000198 CACULA MIX LTDA',
        'RECEBIMENTO PIX-PIX_CRED 29756732000198 CACULA MIX LTDA',
      ),
    )
    expect(r.valid).toBe(true)
    expect(r.confidence).toBeGreaterThanOrEqual(0.95)
    expect(r.signals.debitContainsOwnCnpj).toBe(true)
    expect(r.signals.creditContainsOwnCnpj).toBe(true)
  })

  it('PIX CNPJ próprio em só uma perna, mesmo dia → confidence ≥0.85', () => {
    const r = validateTransferPair(
      mkInput(
        'PAGAMENTO PIX-PIX_DEB 29756732000198 CACULA MIX LTDA',
        'RECEBIMENTO PIX-PIX_CRED entre contas',
      ),
    )
    expect(r.valid).toBe(true)
    expect(r.confidence).toBeGreaterThanOrEqual(0.9)
  })

  it('Sprint u: PIX em dias DIFERENTES (D+2) → REJEITA (same-day obrigatório)', () => {
    const r = validateTransferPair(
      mkInput(
        'PAGAMENTO PIX-PIX_DEB 29756732000198 CACULA',
        'RECEBIMENTO PIX-PIX_CRED 29756732000198 CACULA',
        { sameDate: false },
      ),
    )
    expect(r.valid).toBe(false)
    expect(r.reason).toContain('instantâneo')
  })

  it('valor comum aplica penalidade −0.30 (Sprint u apertado)', () => {
    const semPenalidade = validateTransferPair(
      mkInput(
        'PAGAMENTO PIX-PIX_DEB 29756732000198 CACULA',
        'RECEBIMENTO PIX-PIX_CRED 29756732000198 CACULA',
      ),
    )
    const comPenalidade = validateTransferPair(
      mkInput(
        'PAGAMENTO PIX-PIX_DEB 29756732000198 CACULA',
        'RECEBIMENTO PIX-PIX_CRED 29756732000198 CACULA',
        { valorComum: true },
      ),
    )
    expect(comPenalidade.confidence).toBeLessThan(semPenalidade.confidence)
    expect(semPenalidade.confidence - comPenalidade.confidence).toBeCloseTo(0.3, 1)
  })
})

describe('REGRA 4 (Sprint u apertada): UMA perna com pessoa → REJEITA', () => {
  it('PIX_DEB Cacula CNPJ + PIX_CRED com nome de pessoa → rejeita', () => {
    const r = validateTransferPair(
      mkInput(
        'PAGAMENTO PIX-PIX_DEB 29756732000198 CACULA',
        'RECEBIMENTO PIX-PIX_CRED ALGUEM FORTES MATOS',
      ),
    )
    expect(r.valid).toBe(false)
    expect(r.reason).toMatch(/pessoa/i)
  })
})

describe('helpers — isPixDebitDesc', () => {
  it('PAGAMENTO PIX-PIX_DEB → true', () => {
    expect(isPixDebitDesc('PAGAMENTO PIX-PIX_DEB 12345')).toBe(true)
  })
  it('PIX ENVIADO → true', () => {
    expect(isPixDebitDesc('PIX ENVIADO ALGUEM')).toBe(true)
  })
  it('Cristian - Transferência | Pix → false (sem PIX_DEB explícito)', () => {
    expect(isPixDebitDesc('Cristian - Transferência | Pix')).toBe(false)
  })
  it('OP CRÉDITO → false', () => {
    expect(isPixDebitDesc('OP. CRÉDITO C/GARANTIA')).toBe(false)
  })
})

describe('helpers — isPixCreditDesc', () => {
  it('RECEBIMENTO PIX-PIX_CRED → true', () => {
    expect(isPixCreditDesc('RECEBIMENTO PIX-PIX_CRED 12345 NOME')).toBe(true)
  })
  it('PIX RECEBIDO → true', () => {
    expect(isPixCreditDesc('PIX RECEBIDO DE ALGUEM')).toBe(true)
  })
  it('OP CRÉDITO → false', () => {
    expect(isPixCreditDesc('OP. CRÉDITO C/GARANTIA')).toBe(false)
  })
  it('DEP DINHEIRO ATM → false', () => {
    expect(isPixCreditDesc('DEP DINHEIRO ATM-2d223037')).toBe(false)
  })
})

describe('helpers — isBlacklistedDesc', () => {
  it('OP. CRÉDITO C/GARANTIA → true', () => {
    expect(isBlacklistedDesc('OP. CRÉDITO C/GARANTIA')).toBe(true)
  })
  it('EMPRÉSTIMO BANRISUL → true', () => {
    expect(isBlacklistedDesc('EMPRÉSTIMO BANRISUL')).toBe(true)
  })
  it('DEP DINHEIRO ATM → true', () => {
    expect(isBlacklistedDesc('DEP DINHEIRO ATM-2d223037')).toBe(true)
  })
  it('TARIFA PIX → true', () => {
    expect(isBlacklistedDesc('TARIFA PIX ENVIO')).toBe(true)
  })
  it('DARF → true', () => {
    expect(isBlacklistedDesc('PAGAMENTO DARF')).toBe(true)
  })
  it('PAGAMENTO PIX_DEB CNPJ → false (não blacklisted)', () => {
    expect(isBlacklistedDesc('PAGAMENTO PIX-PIX_DEB 29756732000198 CACULA')).toBe(false)
  })
})

describe('helpers — descContainsCnpj', () => {
  it('CNPJ Cacula formatado encontra', () => {
    expect(
      descContainsCnpj('PAGAMENTO 29.756.732/0001-98 CACULA', CACULA_CNPJ),
    ).toBe(true)
  })
  it('CNPJ não formatado encontra', () => {
    expect(descContainsCnpj('PIX-PIX_DEB 29756732000198 CACULA', CACULA_CNPJ)).toBe(true)
  })
  it('CNPJ de terceiro NÃO encontra', () => {
    expect(descContainsCnpj('PIX-PIX_DEB 12345678000199 OUTRO', CACULA_CNPJ)).toBe(false)
  })
  it('Descrição vazia → false', () => {
    expect(descContainsCnpj(null, CACULA_CNPJ)).toBe(false)
  })
})

describe('helpers — hasPersonName', () => {
  it('CPF formatado → true', () => {
    expect(hasPersonName('PIX 123.456.789-00 JOAO')).toBe(true)
  })
  it('2 palavras 4+ letras → true (nome próprio)', () => {
    expect(hasPersonName('CRISTIAN FORTES MATOS')).toBe(true)
  })
  it('CNPJ não conta como pessoa', () => {
    expect(hasPersonName('PAGAMENTO 29756732000198 CACULA')).toBe(false)
  })
  it('Só "PIX" e códigos → false', () => {
    expect(hasPersonName('PIX 12345')).toBe(false)
  })
})
