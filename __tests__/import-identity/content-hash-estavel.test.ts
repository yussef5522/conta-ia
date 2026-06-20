// Sprint ContentHash Estável (20/06/2026) — testes da raiz
// Garante que promoção DEBIT→TRANSFER OUT e CREDIT→TRANSFER IN
// preservam o contentHash. Previne duplicação em re-import de banco
// que renumera FITID curto (Banrisul).

import { describe, it, expect } from 'vitest'
import { computeIdentity } from '../../lib/import-identity/compute-identity'
import { valorToCents } from '../../lib/import-identity/normalize'

const ACC = 'cmq17z90v00qxrndl02kfn4iz' // Banrisul
const DATE = '2026-06-08'
const MEMO = 'PIX ENVIADO'

describe('valorToCents — sinal pela direção de caixa', () => {
  it('CREDIT 100 -> +10000', () => {
    expect(valorToCents(100, 'CREDIT')).toBe(10000)
  })
  it('DEBIT 100 -> -10000', () => {
    expect(valorToCents(100, 'DEBIT')).toBe(-10000)
  })
  it('TRANSFER + IN  100 -> +10000 (entrada)', () => {
    expect(valorToCents(100, 'TRANSFER', 'IN')).toBe(10000)
  })
  it('TRANSFER + OUT 100 -> -10000 (saída)', () => {
    expect(valorToCents(100, 'TRANSFER', 'OUT')).toBe(-10000)
  })
  it('TRANSFER + null -> -10000 (default seguro = OUT/saída)', () => {
    expect(valorToCents(100, 'TRANSFER', null)).toBe(-10000)
    expect(valorToCents(100, 'TRANSFER')).toBe(-10000)
  })
  it('drift float preservado (round half-up)', () => {
    expect(valorToCents(0.005, 'CREDIT')).toBe(1)
  })
})

describe('contentHash IMUNE a promoção DEBIT→TRANSFER OUT', () => {
  it('(a) DEBIT 20.300 → TRANSFER OUT 20.300 → MESMO contentHash', () => {
    const antes = computeIdentity({
      accountId: ACC,
      fitid: '010850',
      date: DATE,
      amount: 20300,
      type: 'DEBIT',
      memo: MEMO,
    })
    const depoisPromoção = computeIdentity({
      accountId: ACC,
      fitid: '010850',
      date: DATE,
      amount: 20300,
      type: 'TRANSFER',
      transferDirection: 'OUT',
      memo: MEMO,
    })
    expect(antes.contentHash).toBe(depoisPromoção.contentHash)
    expect(antes.parts.valorCentavos).toBe(-2030000)
    expect(depoisPromoção.parts.valorCentavos).toBe(-2030000)
  })

  it('(b) CREDIT 34.000 → TRANSFER IN 34.000 → MESMO contentHash', () => {
    const antes = computeIdentity({
      accountId: 'cmq182qfr0005aktn6q2ugpv2', // Stone
      fitid: '89a8dfbf-3725-4567-89ab-cdef01234567',
      date: '2026-06-08',
      amount: 34000,
      type: 'CREDIT',
      memo: 'YUSSEF ABU ZAHRY MUSA - Transferência | Pix',
    })
    const depoisPromoção = computeIdentity({
      accountId: 'cmq182qfr0005aktn6q2ugpv2',
      fitid: '89a8dfbf-3725-4567-89ab-cdef01234567',
      date: '2026-06-08',
      amount: 34000,
      type: 'TRANSFER',
      transferDirection: 'IN',
      memo: 'YUSSEF ABU ZAHRY MUSA - Transferência | Pix',
    })
    expect(antes.contentHash).toBe(depoisPromoção.contentHash)
    expect(antes.parts.valorCentavos).toBe(3400000)
    expect(depoisPromoção.parts.valorCentavos).toBe(3400000)
  })

  it('(c) DEBIT 100 != CREDIT 100 (prova de NÃO-colisão)', () => {
    const debit = computeIdentity({
      accountId: ACC,
      date: DATE,
      amount: 100,
      type: 'DEBIT',
      memo: 'X',
    })
    const credit = computeIdentity({
      accountId: ACC,
      date: DATE,
      amount: 100,
      type: 'CREDIT',
      memo: 'X',
    })
    expect(debit.contentHash).not.toBe(credit.contentHash)
    expect(debit.parts.valorCentavos).toBe(-10000)
    expect(credit.parts.valorCentavos).toBe(10000)
  })

  it('(d) TRANSFER OUT != TRANSFER IN no mesmo valor (prova direção)', () => {
    const out = computeIdentity({
      accountId: ACC,
      date: DATE,
      amount: 100,
      type: 'TRANSFER',
      transferDirection: 'OUT',
      memo: 'X',
    })
    const inT = computeIdentity({
      accountId: ACC,
      date: DATE,
      amount: 100,
      type: 'TRANSFER',
      transferDirection: 'IN',
      memo: 'X',
    })
    expect(out.contentHash).not.toBe(inT.contentHash)
  })

  it('(e) Cenário REAL Cacula bug 21k: DEBIT incoming bate TRANSFER OUT no DB', () => {
    // OFX re-import traz DEBIT 20.300 com FITID renumerado (540806 ≠ 010850 original)
    const incoming = computeIdentity({
      accountId: ACC,
      fitid: '540806',
      date: DATE,
      amount: 20300,
      type: 'DEBIT',
      memo: 'PIX ENVIADO',
    })
    // DB tem TRANSFER OUT (promovida pelo detector há dias)
    const storedTransfer = computeIdentity({
      accountId: ACC,
      fitid: '010850',
      date: DATE,
      amount: 20300,
      type: 'TRANSFER',
      transferDirection: 'OUT',
      memo: 'PIX ENVIADO',
    })
    expect(incoming.contentHash).toBe(storedTransfer.contentHash)
    // fitidKeys são diferentes (FITID renumerado), mas Banrisul ext curto = null
    // → gate cai no contentHash, que agora BATE → barra duplicação
    expect(incoming.fitidKey).toBeNull()
    expect(storedTransfer.fitidKey).toBeNull()
  })
})

describe('Regressão — DEBIT/CREDIT puros mantêm comportamento', () => {
  it('hash de DEBIT puro inalterado vs sprint anterior', () => {
    const r = computeIdentity({
      accountId: ACC,
      fitid: '702998',
      date: '20260612',
      amount: 1500,
      type: 'DEBIT',
      memo: 'PAGAMENTO ENERGIA',
    })
    expect(r.parts.valorCentavos).toBe(-150000)
  })
  it('hash de CREDIT puro inalterado', () => {
    const r = computeIdentity({
      accountId: ACC,
      date: '20260612',
      amount: 1500,
      type: 'CREDIT',
      memo: 'RECEBIMENTO',
    })
    expect(r.parts.valorCentavos).toBe(150000)
  })
})
