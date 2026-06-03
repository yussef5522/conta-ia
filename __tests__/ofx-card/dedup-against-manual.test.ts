// Sprint PF Fatia 3 — Dup contra tx manuais.

import { describe, expect, test } from 'vitest'
import { findDuplicatesAgainstManual } from '@/lib/ofx-card/dedup-against-manual'

const OFX_DATE = new Date(Date.UTC(2026, 6, 20))

describe('findDuplicatesAgainstManual', () => {
  test('match exato data+valor+descrição similar → EXACT_AMOUNT_DATE_DESC', () => {
    const ofxTxs = [
      { fitid: 'F1', date: OFX_DATE, amount: 85.5, description: 'Posto Pitangueira' },
    ]
    const manuals = [
      { id: 'M1', date: OFX_DATE, amount: 85.5, description: 'Posto Pitangueira combustivel' },
    ]
    const dups = findDuplicatesAgainstManual(ofxTxs, manuals)
    expect(dups).toHaveLength(1)
    expect(dups[0].reason).toBe('EXACT_AMOUNT_DATE_DESC')
    expect(dups[0].confidence).toBeGreaterThanOrEqual(0.7)
  })

  test('data ±1 dia ok', () => {
    const ofxTxs = [
      { fitid: 'F1', date: OFX_DATE, amount: 100, description: 'Mercado Extra' },
    ]
    const oneDayBefore = new Date(OFX_DATE.getTime() - 24 * 60 * 60 * 1000)
    const manuals = [
      { id: 'M1', date: oneDayBefore, amount: 100, description: 'Mercado Extra' },
    ]
    const dups = findDuplicatesAgainstManual(ofxTxs, manuals)
    expect(dups).toHaveLength(1)
  })

  test('valor diferente → não match', () => {
    const ofxTxs = [
      { fitid: 'F1', date: OFX_DATE, amount: 100, description: 'X' },
    ]
    const manuals = [
      { id: 'M1', date: OFX_DATE, amount: 99.5, description: 'X' },
    ]
    const dups = findDuplicatesAgainstManual(ofxTxs, manuals)
    expect(dups).toHaveLength(0)
  })

  test('descrição totalmente diferente → não match (jaccard baixa)', () => {
    const ofxTxs = [
      { fitid: 'F1', date: OFX_DATE, amount: 100, description: 'Apple.Com/Bill' },
    ]
    const manuals = [
      { id: 'M1', date: OFX_DATE, amount: 100, description: 'Conta da luz Enel' },
    ]
    const dups = findDuplicatesAgainstManual(ofxTxs, manuals)
    expect(dups).toHaveLength(0)
  })

  test('parcela 5/6 OFX match com parcela 5/6 manual (mesmo group)', () => {
    const ofxTxs = [
      { fitid: 'F1', date: OFX_DATE, amount: 380, description: 'Airbnb * Hm9z23za5s - Parcela 5/6' },
    ]
    const manuals = [
      {
        id: 'M1',
        date: OFX_DATE,
        amount: 380,
        description: 'Airbnb Hm9z23za5s (5/6)',
        installmentGroupId: 'GROUP-1',
        installmentNumber: 5,
        installmentTotal: 6,
      },
    ]
    const dups = findDuplicatesAgainstManual(ofxTxs, manuals)
    expect(dups).toHaveLength(1)
    expect(dups[0].reason).toBe('INSTALLMENT_GROUP')
    expect(dups[0].confidence).toBeGreaterThanOrEqual(0.9)
  })

  test('manual já usada não aparece em 2 OFX', () => {
    const ofxTxs = [
      { fitid: 'F1', date: OFX_DATE, amount: 50, description: 'Loja X' },
      { fitid: 'F2', date: OFX_DATE, amount: 50, description: 'Loja X' },
    ]
    const manuals = [
      { id: 'M1', date: OFX_DATE, amount: 50, description: 'Loja X' },
    ]
    const dups = findDuplicatesAgainstManual(ofxTxs, manuals)
    expect(dups).toHaveLength(1) // só 1 match (F1)
    expect(dups[0].ofxFitid).toBe('F1')
  })

  test('arrays vazios → []', () => {
    expect(findDuplicatesAgainstManual([], [])).toEqual([])
    expect(findDuplicatesAgainstManual([{ fitid: 'F1', date: OFX_DATE, amount: 100, description: 'X' }], [])).toEqual([])
  })
})
