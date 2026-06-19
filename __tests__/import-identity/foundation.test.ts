// Sprint Import Idempotente — testes foundation (funções puras)

import { describe, it, expect } from 'vitest'
import {
  extractDateKey,
  valorToCents,
  normalizeDescription,
  buildDescription,
} from '../../lib/import-identity/normalize'
import {
  isFitidConfiavel,
  describeFitid,
} from '../../lib/import-identity/heuristic-fitid'
import { computeIdentity } from '../../lib/import-identity/compute-identity'
import { computeFileHash } from '../../lib/import-identity/file-hash'
import { applyIdentityGate } from '../../lib/import-identity/apply-gate'

describe('normalize.extractDateKey', () => {
  it('Banrisul 8 chars literal', () => {
    expect(extractDateKey('20260612')).toBe('20260612')
  })

  it('Sicredi com hora + timezone BRT', () => {
    expect(extractDateKey('20260612000000(BRT-3)')).toBe('20260612')
  })

  it('Stone com hora + UTC', () => {
    expect(extractDateKey('20260612120000(UTC)')).toBe('20260612')
  })

  it('ISO date format', () => {
    expect(extractDateKey('2026-06-12')).toBe('20260612')
  })

  it('ISO datetime Z', () => {
    expect(extractDateKey('2026-06-12T15:30:00.000Z')).toBe('20260612')
  })

  it('Date object UTC', () => {
    const d = new Date(Date.UTC(2026, 5, 12))
    expect(extractDateKey(d)).toBe('20260612')
  })

  it('vazio retorna string vazia', () => {
    expect(extractDateKey('')).toBe('')
  })

  it('Date invalido retorna vazio', () => {
    expect(extractDateKey(new Date('invalid'))).toBe('')
  })
})

describe('normalize.valorToCents', () => {
  it('4092.02 CREDIT -> 409202', () => {
    expect(valorToCents(4092.02, 'CREDIT')).toBe(409202)
  })
  it('1033.13 DEBIT -> -103313', () => {
    expect(valorToCents(1033.13, 'DEBIT')).toBe(-103313)
  })
  it('0 -> 0', () => {
    expect(valorToCents(0, 'CREDIT')).toBe(0)
  })
  it('arredonda half-up: 0.005 -> 1 centavo', () => {
    expect(valorToCents(0.005, 'CREDIT')).toBe(1)
  })
  it('drift de float: 100.10 + 100.10 == 200.20 -> 20020 cents', () => {
    expect(valorToCents(0.1 + 0.2, 'CREDIT')).toBe(30)
  })
})

describe('normalize.normalizeDescription', () => {
  it('uppercase + colapsa espaços (e strip de hífen virou separador)', () => {
    expect(normalizeDescription('  Acai Especial   - Lote  ')).toBe(
      'ACAI ESPECIAL LOTE',
    )
  })
  it('remove acentos', () => {
    expect(normalizeDescription('Mercadão Pão de Açúcar')).toBe(
      'MERCADAO PAO DE ACUCAR',
    )
  })
  it('null retorna vazio', () => {
    expect(normalizeDescription(null)).toBe('')
  })
  it('undefined retorna vazio', () => {
    expect(normalizeDescription(undefined)).toBe('')
  })

  // Sprint Iter 2 — caso real Banrisul que estava furando o gate
  it('OP. CREDITO C/GARANTIA == OP CREDITO C/GARANTIA (pontuação)', () => {
    expect(normalizeDescription('OP. CREDITO C/GARANTIA')).toBe(
      normalizeDescription('OP CREDITO C/GARANTIA'),
    )
    expect(normalizeDescription('OP. CREDITO C/GARANTIA')).toBe(
      'OP CREDITO C GARANTIA',
    )
  })
  it('PIX YUSSEF | TRANSFERENCIA -> sem pipe', () => {
    expect(normalizeDescription('PIX YUSSEF | TRANSFERÊNCIA')).toBe(
      'PIX YUSSEF TRANSFERENCIA',
    )
  })
  it('preserva números — PARCELA 1/12 != PARCELA 2/12', () => {
    const a = normalizeDescription('PARCELA 1/12')
    const b = normalizeDescription('PARCELA 2/12')
    expect(a).not.toBe(b)
    expect(a).toBe('PARCELA 1 12')
    expect(b).toBe('PARCELA 2 12')
  })
  it('preserva números — externalIds com dígitos diferentes não fundem', () => {
    expect(normalizeDescription('REF 70193920247')).not.toBe(
      normalizeDescription('REF 70193920248'),
    )
  })
  it('NÃO funde tx legítimamente DIFERENTES no texto base', () => {
    expect(normalizeDescription('PAGAMENTO ENERGIA')).not.toBe(
      normalizeDescription('PAGAMENTO ENERGIA SOLAR'),
    )
  })
})

describe('normalize.buildDescription', () => {
  it('NAME + MEMO iguais retorna 1 vez', () => {
    expect(buildDescription('PIX ENVIADO', 'PIX ENVIADO')).toBe('PIX ENVIADO')
  })
  it('NAME + MEMO diferentes concatena', () => {
    expect(buildDescription('PIX ENVIADO', 'CACULA MIX')).toBe(
      'PIX ENVIADO CACULA MIX',
    )
  })
  it('só MEMO (pontuação removida)', () => {
    expect(buildDescription(null, 'OP. CREDITO C/GARANTIA')).toBe(
      'OP CREDITO C GARANTIA',
    )
  })
})

describe('heuristic-fitid.isFitidConfiavel', () => {
  it('Stone UUID = confiável', () => {
    expect(isFitidConfiavel('989220bb-1234-4567-89ab-cdef01234567')).toBe(true)
  })
  it('Sicredi numérico 11 dígitos = confiável', () => {
    expect(isFitidConfiavel('22313501711')).toBe(true)
  })
  it('Banrisul 6 dígitos = NÃO confiável', () => {
    expect(isFitidConfiavel('702998')).toBe(false)
  })
  it('Banrisul "000001" = NÃO confiável', () => {
    expect(isFitidConfiavel('000001')).toBe(false)
  })
  it('vazio = NÃO confiável', () => {
    expect(isFitidConfiavel('')).toBe(false)
    expect(isFitidConfiavel(null)).toBe(false)
    expect(isFitidConfiavel(undefined)).toBe(false)
  })
  it('numérico 9 dígitos = NÃO confiável (limítrofe)', () => {
    expect(isFitidConfiavel('123456789')).toBe(false)
  })
  it('numérico 10 dígitos = confiável (limítrofe)', () => {
    expect(isFitidConfiavel('1234567890')).toBe(true)
  })

  it('describeFitid dá texto humano', () => {
    expect(describeFitid('000001')).toMatch(/curto/i)
    expect(describeFitid('22313501711')).toMatch(/confiável|confiavel/i)
    expect(describeFitid('989220bb-1234-4567-89ab-cdef01234567')).toMatch(/UUID/)
    expect(describeFitid('')).toMatch(/vazio/)
  })
})

describe('computeIdentity — ponto a ponto', () => {
  it('mesma tx em formatos OFX diferentes -> mesma identidade', () => {
    // Banrisul sem TZ
    const b = computeIdentity({
      accountId: 'acc-banrisul',
      fitid: '702998',
      date: '20260612',
      amount: 4092.02,
      type: 'CREDIT',
      name: 'PIX RECEBIDO',
      memo: 'CACULA MIX',
    })
    // Mesma tx mas com TZ (simula re-export)
    const c = computeIdentity({
      accountId: 'acc-banrisul',
      fitid: '702999', // FITID diferente (banco renumerou)
      date: '20260612000000(BRT-3)',
      amount: 4092.02,
      type: 'CREDIT',
      name: 'PIX RECEBIDO',
      memo: 'CACULA MIX',
    })
    expect(b.contentHash).toBe(c.contentHash) // mesma assinatura ✓
    expect(b.fitidKey).toBeNull() // Banrisul fitid curto = não confiável
    expect(c.fitidKey).toBeNull()
  })

  it('Stone UUID -> fitidKey populado', () => {
    const r = computeIdentity({
      accountId: 'acc-stone',
      fitid: '989220bb-1234-4567-89ab-cdef01234567',
      date: '20260612',
      amount: 48.75,
      type: 'CREDIT',
      memo: 'PIX QRCODE',
    })
    expect(r.fitidKey).not.toBeNull()
    expect(r.fitidKey).toMatch(/^[0-9a-f]{64}$/)
    expect(r.parts.fitidConfiavel).toBe(true)
  })

  it('mesmo accountId + FITID -> mesmo fitidKey', () => {
    const a = computeIdentity({
      accountId: 'acc-x',
      fitid: '22313501711',
      date: '20260612',
      amount: 100,
      type: 'CREDIT',
    })
    const b = computeIdentity({
      accountId: 'acc-x',
      fitid: '22313501711',
      date: '20260613', // diferente!
      amount: 200,
      type: 'DEBIT',
    })
    expect(a.fitidKey).toBe(b.fitidKey) // mesmo fitid + accountId
    expect(a.contentHash).not.toBe(b.contentHash)
  })

  it('contas diferentes -> identidades diferentes mesmo FITID/conteudo iguais', () => {
    const a = computeIdentity({
      accountId: 'acc-banrisul',
      fitid: '22313501711',
      date: '20260612',
      amount: 100,
      type: 'CREDIT',
      memo: 'X',
    })
    const b = computeIdentity({
      accountId: 'acc-sicredi',
      fitid: '22313501711',
      date: '20260612',
      amount: 100,
      type: 'CREDIT',
      memo: 'X',
    })
    expect(a.fitidKey).not.toBe(b.fitidKey)
    expect(a.contentHash).not.toBe(b.contentHash)
  })

  it('valorCentavos em parts é com sinal', () => {
    const cr = computeIdentity({
      accountId: 'acc',
      date: '20260612',
      amount: 100,
      type: 'CREDIT',
      memo: 'X',
    })
    const db = computeIdentity({
      accountId: 'acc',
      date: '20260612',
      amount: 100,
      type: 'DEBIT',
      memo: 'X',
    })
    expect(cr.parts.valorCentavos).toBe(10000)
    expect(db.parts.valorCentavos).toBe(-10000)
    expect(cr.contentHash).not.toBe(db.contentHash)
  })
})

describe('computeFileHash', () => {
  it('mesmo buffer -> mesmo hash', () => {
    const b1 = new Uint8Array([1, 2, 3, 4, 5])
    const b2 = new Uint8Array([1, 2, 3, 4, 5])
    expect(computeFileHash(b1)).toBe(computeFileHash(b2))
  })
  it('buffer diferente -> hash diferente', () => {
    const b1 = new Uint8Array([1, 2, 3])
    const b2 = new Uint8Array([1, 2, 4])
    expect(computeFileHash(b1)).not.toBe(computeFileHash(b2))
  })
  it('arraybuffer aceito', () => {
    const buf = new ArrayBuffer(3)
    new Uint8Array(buf).set([10, 20, 30])
    expect(computeFileHash(buf)).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('applyIdentityGate — cenários reais', () => {
  function mkTx(accountId: string, fitid: string | null, date: string, amount: number, type: 'CREDIT' | 'DEBIT', memo: string) {
    const id = computeIdentity({ accountId, fitid, date, amount, type, memo })
    return { payload: { id: `${date}_${memo}_${amount}` }, identity: id }
  }

  it('reimport do MESMO OFX = 0 novas (Cacula Banrisul cenário)', () => {
    const tx1 = mkTx('acc-banrisul', '702998', '20260612', 4092.02, 'CREDIT', 'OP CREDITO C/GARANTIA')
    const tx2 = mkTx('acc-banrisul', '702999', '20260612', 4092.02, 'CREDIT', 'OP CREDITO C/GARANTIA')
    // 1º import vazio -> 2 entram
    const r1 = applyIdentityGate([tx1, tx2], {
      existingFitidKeys: new Set(),
      existingContentCounts: new Map(),
    })
    expect(r1.toInsert).toHaveLength(2)

    // 2º import (mesmas tx): DB já tem 2 com mesmo contentHash
    const r2 = applyIdentityGate([tx1, tx2], {
      existingFitidKeys: new Set(),
      existingContentCounts: new Map([[tx1.identity.contentHash, 2]]),
    })
    expect(r2.toInsert).toHaveLength(0)
    expect(r2.skipped).toHaveLength(2)
    expect(r2.stats.skippedContent).toBe(2)
  })

  it('2 PIX legítimos R$48,75 mesmo dia -> 2 entram, NÃO mata legítima', () => {
    const tx1 = mkTx('acc', null, '20260612', 48.75, 'CREDIT', 'PIX QRCODE EST 1')
    const tx2 = mkTx('acc', null, '20260612', 48.75, 'CREDIT', 'PIX QRCODE EST 1')
    // Mesma descrição, mesmo valor, mesmo dia -> mesmo contentHash
    expect(tx1.identity.contentHash).toBe(tx2.identity.contentHash)
    const r = applyIdentityGate([tx1, tx2], {
      existingFitidKeys: new Set(),
      existingContentCounts: new Map(),
    })
    expect(r.toInsert).toHaveLength(2)
    expect(r.skipped).toHaveLength(0)
  })

  it('FITID confiável já vivo no DB -> dropa', () => {
    const tx = mkTx('acc-stone', '989220bb-1234-4567-89ab-cdef01234567', '20260612', 100, 'CREDIT', 'X')
    const r = applyIdentityGate([tx], {
      existingFitidKeys: new Set([tx.identity.fitidKey!]),
      existingContentCounts: new Map(),
    })
    expect(r.toInsert).toHaveLength(0)
    expect(r.skipped).toHaveLength(1)
    expect(r.skipped[0].reason).toBe('DUPLICATE_FITID')
    expect(r.stats.skippedFitid).toBe(1)
  })

  it('cross-source OFX+Excel mesmo conteudo -> dropa segundo', () => {
    // 1ª via OFX (sem fitidKey confiavel) entra
    const ofx = mkTx('acc', null, '20260612', 1500, 'DEBIT', 'PAGAMENTO ENERGIA')
    const xls = mkTx('acc', null, '20260612', 1500, 'DEBIT', 'PAGAMENTO ENERGIA')
    expect(ofx.identity.contentHash).toBe(xls.identity.contentHash)
    // OFX ja inseriu
    const r = applyIdentityGate([xls], {
      existingFitidKeys: new Set(),
      existingContentCounts: new Map([[ofx.identity.contentHash, 1]]),
    })
    expect(r.toInsert).toHaveLength(0)
    expect(r.skipped[0].reason).toBe('DUPLICATE_CONTENT')
  })

  it('intra-batch: 2 vezes mesmo fitid no batch -> 2ª é DUPLICATE_FITID', () => {
    const a = mkTx('acc', '989220bb-1234-4567-89ab-cdef01234567', '20260612', 100, 'CREDIT', 'X')
    const b = mkTx('acc', '989220bb-1234-4567-89ab-cdef01234567', '20260612', 100, 'CREDIT', 'X')
    const r = applyIdentityGate([a, b], {
      existingFitidKeys: new Set(),
      existingContentCounts: new Map(),
    })
    expect(r.toInsert).toHaveLength(1)
    expect(r.skipped).toHaveLength(1)
    expect(r.skipped[0].reason).toBe('DUPLICATE_FITID')
  })

  it('overshoot: incoming 5x mesmo contentHash, DB tem 2 -> entram 3', () => {
    const txs = Array.from({ length: 5 }, () =>
      mkTx('acc', null, '20260612', 100, 'CREDIT', 'PIX X'),
    )
    const r = applyIdentityGate(txs, {
      existingFitidKeys: new Set(),
      existingContentCounts: new Map([[txs[0].identity.contentHash, 2]]),
    })
    expect(r.toInsert).toHaveLength(3)
    expect(r.skipped).toHaveLength(2)
    expect(r.skipped.every((s) => s.reason === 'DUPLICATE_CONTENT')).toBe(true)
  })
})
