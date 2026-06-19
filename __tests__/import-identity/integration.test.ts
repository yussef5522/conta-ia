// Sprint Import Idempotente — testes integration (sem DB real)
// Simulam o ciclo: 1º import vazio → 2º reimport idem → 0 novas.

import { describe, it, expect } from 'vitest'
import { computeIdentity } from '../../lib/import-identity/compute-identity'
import { applyIdentityGate } from '../../lib/import-identity/apply-gate'

interface FakeTx {
  fitid: string | null
  date: string
  amount: number
  type: 'CREDIT' | 'DEBIT'
  memo: string
}

const BANRISUL = 'acc-banrisul'
const SICREDI = 'acc-sicredi'
const STONE = 'acc-stone'

// Fixture: 5 tx típicas Banrisul (Cacula, 12/06/2026)
const banrisulFixture: FakeTx[] = [
  { fitid: '702998', date: '20260612', amount: 10945.59, type: 'CREDIT', memo: 'OP.CREDITO C/GARANTIA' },
  { fitid: '702999', date: '20260612', amount: 326.93, type: 'CREDIT', memo: 'ANTECIP STONE' },
  { fitid: '703000', date: '20260612', amount: 75.96, type: 'CREDIT', memo: 'ANTECIPACAO BANRICOMPRAS' },
  { fitid: '703001', date: '20260612', amount: 1500.00, type: 'DEBIT', memo: 'PAGAMENTO ENERGIA' },
  { fitid: '703002', date: '20260612', amount: 21000.00, type: 'DEBIT', memo: 'PIX ENVIADO' },
]

// Fixture: 1 tx Sicredi liberação empréstimo (foi DUPLICADA em prod)
const sicrediFixture: FakeTx[] = [
  { fitid: '22313501711', date: '20260612', amount: 100000.00, type: 'CREDIT', memo: 'LIBERACAO CREDITO-C61021346' },
]

// Fixture: 3 tx Stone UUID (Yussef PIX 14 viraram TRANSFER, 3 ficaram CRÉDITO)
const stoneFixture: FakeTx[] = [
  { fitid: '989220bb-1234-4567-89ab-cdef01234567', date: '20260608', amount: 8000.00, type: 'CREDIT', memo: 'YUSSEF ABU ZAHRY MUSA - Transferencia | Pix' },
  { fitid: '989220bb-5678-4567-89ab-cdef01234568', date: '20260609', amount: 650.00, type: 'CREDIT', memo: 'YUSSEF ABU ZAHRY MUSA - Transferencia | Pix' },
]

function mkIdent(accId: string, tx: FakeTx) {
  return {
    payload: tx,
    identity: computeIdentity({
      accountId: accId,
      fitid: tx.fitid,
      date: tx.date,
      amount: tx.amount,
      type: tx.type,
      memo: tx.memo,
    }),
  }
}

describe('IDEMPOTÊNCIA — reimport do mesmo extrato = 0 novas', () => {
  it('Banrisul: 1º import insere 5; 2º import insere 0', () => {
    const incoming = banrisulFixture.map((t) => mkIdent(BANRISUL, t))

    // 1º import: DB vazio
    const r1 = applyIdentityGate(incoming, {
      existingFitidKeys: new Set(),
      existingContentCounts: new Map(),
    })
    expect(r1.toInsert).toHaveLength(5)
    expect(r1.stats.inserted).toBe(5)

    // Simula que as 5 entraram no ledger
    const fitidKeysInLedger = new Set(
      r1.toInsert.map((i) => i.identity.fitidKey).filter((k): k is string => k !== null),
    )
    const contentCounts = new Map<string, number>()
    for (const i of r1.toInsert) {
      contentCounts.set(
        i.identity.contentHash,
        (contentCounts.get(i.identity.contentHash) ?? 0) + 1,
      )
    }

    // 2º import: mesmo arquivo. Banrisul fitids são CURTOS = não confiáveis,
    // então gate ETAPA 1 não dropa. ETAPA 2 (contentHash) é que mata.
    const r2 = applyIdentityGate(incoming, {
      existingFitidKeys: fitidKeysInLedger,
      existingContentCounts: contentCounts,
    })
    expect(r2.toInsert).toHaveLength(0)
    expect(r2.skipped).toHaveLength(5)
    expect(r2.stats.skippedContent).toBe(5)
  })

  it('Sicredi liberação 100k: 2º import dropa pelo fitidKey (Sicredi numérico longo = confiável)', () => {
    const incoming = sicrediFixture.map((t) => mkIdent(SICREDI, t))
    const r1 = applyIdentityGate(incoming, {
      existingFitidKeys: new Set(),
      existingContentCounts: new Map(),
    })
    expect(r1.toInsert).toHaveLength(1)
    const fitidLedger = new Set([r1.toInsert[0].identity.fitidKey!])
    const r2 = applyIdentityGate(incoming, {
      existingFitidKeys: fitidLedger,
      existingContentCounts: new Map(),
    })
    expect(r2.toInsert).toHaveLength(0)
    expect(r2.skipped[0].reason).toBe('DUPLICATE_FITID')
  })

  it('Stone UUID: gate ETAPA 1 dropa no reimport (fitid confiável)', () => {
    const incoming = stoneFixture.map((t) => mkIdent(STONE, t))
    const r1 = applyIdentityGate(incoming, {
      existingFitidKeys: new Set(),
      existingContentCounts: new Map(),
    })
    expect(r1.toInsert).toHaveLength(2)
    const fitidLedger = new Set(
      r1.toInsert.map((i) => i.identity.fitidKey).filter((k): k is string => k !== null),
    )
    const r2 = applyIdentityGate(incoming, {
      existingFitidKeys: fitidLedger,
      existingContentCounts: new Map(),
    })
    expect(r2.toInsert).toHaveLength(0)
    expect(r2.stats.skippedFitid).toBe(2)
  })
})

describe('CROSS-SOURCE — Excel + OFX mesma tx não duplica', () => {
  it('1º import via Excel (sem fitid) -> entrou. 2º via OFX (fitid Banrisul não confiável) mesmo conteudo -> dropa', () => {
    const tx: FakeTx = {
      fitid: null,
      date: '20260612',
      amount: 5000,
      type: 'DEBIT',
      memo: 'PAGAMENTO ENERGIA',
    }
    const excelIncoming = [mkIdent(BANRISUL, tx)]
    const r1 = applyIdentityGate(excelIncoming, {
      existingFitidKeys: new Set(),
      existingContentCounts: new Map(),
    })
    expect(r1.toInsert).toHaveLength(1)
    const contentLedger = new Map([[r1.toInsert[0].identity.contentHash, 1]])

    // Agora via OFX com fitid Banrisul curto
    const ofxIncoming = [mkIdent(BANRISUL, { ...tx, fitid: '702998' })]
    const r2 = applyIdentityGate(ofxIncoming, {
      existingFitidKeys: new Set(),
      existingContentCounts: contentLedger,
    })
    expect(r2.toInsert).toHaveLength(0)
    expect(r2.skipped[0].reason).toBe('DUPLICATE_CONTENT')
  })
})

describe('CROSS-EXPORT — Banrisul sem TZ vs Sicredi com TZ mesma data calendário', () => {
  it('20260612 vs 20260612000000(BRT-3) -> mesmo contentHash', () => {
    const t1 = mkIdent(BANRISUL, {
      fitid: 'X',
      date: '20260612',
      amount: 100,
      type: 'CREDIT',
      memo: 'TESTE',
    })
    const t2 = mkIdent(BANRISUL, {
      fitid: 'X',
      date: '20260612000000(BRT-3)',
      amount: 100,
      type: 'CREDIT',
      memo: 'TESTE',
    })
    expect(t1.identity.contentHash).toBe(t2.identity.contentHash)
  })

  it('20260612 vs 20260612120000(UTC) -> mesmo contentHash (Stone UTC noon)', () => {
    const t1 = mkIdent(STONE, {
      fitid: null,
      date: '20260612',
      amount: 100,
      type: 'CREDIT',
      memo: 'PIX',
    })
    const t2 = mkIdent(STONE, {
      fitid: null,
      date: '20260612120000(UTC)',
      amount: 100,
      type: 'CREDIT',
      memo: 'PIX',
    })
    expect(t1.identity.contentHash).toBe(t2.identity.contentHash)
  })
})

describe('TX LEGITIMAMENTE IDÊNTICAS — NÃO matar', () => {
  it('2 PIX R$ 48,75 mesmo dia mesma descrição -> 2 entram, ambos passam', () => {
    const a = mkIdent(STONE, {
      fitid: null,
      date: '20260612',
      amount: 48.75,
      type: 'CREDIT',
      memo: 'PIX QRCODE EST 1',
    })
    const b = mkIdent(STONE, {
      fitid: null,
      date: '20260612',
      amount: 48.75,
      type: 'CREDIT',
      memo: 'PIX QRCODE EST 1',
    })
    expect(a.identity.contentHash).toBe(b.identity.contentHash)
    const r = applyIdentityGate([a, b], {
      existingFitidKeys: new Set(),
      existingContentCounts: new Map(),
    })
    expect(r.toInsert).toHaveLength(2) // ambas legítimas
  })

  it('reimport idempotente preserva: DB tem 2, incoming 2 -> 0 novas', () => {
    const a = mkIdent(STONE, {
      fitid: null,
      date: '20260612',
      amount: 48.75,
      type: 'CREDIT',
      memo: 'PIX QRCODE EST 1',
    })
    const r = applyIdentityGate([a, a], {
      existingFitidKeys: new Set(),
      existingContentCounts: new Map([[a.identity.contentHash, 2]]),
    })
    expect(r.toInsert).toHaveLength(0)
  })
})

describe('OVERSHOOT — DB 2, incoming 5 -> entram só 3', () => {
  it('Cenário "perdeu 3 tx no OFX antigo, novo OFX traz todas 5"', () => {
    const t = mkIdent(STONE, {
      fitid: null,
      date: '20260612',
      amount: 100,
      type: 'CREDIT',
      memo: 'X',
    })
    const r = applyIdentityGate([t, t, t, t, t], {
      existingFitidKeys: new Set(),
      existingContentCounts: new Map([[t.identity.contentHash, 2]]),
    })
    expect(r.toInsert).toHaveLength(3)
    expect(r.skipped).toHaveLength(2)
  })
})
