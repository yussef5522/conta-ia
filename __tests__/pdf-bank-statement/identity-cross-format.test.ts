// Sprint PDF Extrato Bancário — verifica que a IDENTIDADE canônica é
// CROSS-FORMAT: a mesma tx vinda de OFX vs PDF gera o MESMO contentHash.
// Isso garante que o dedup pega a duplicação entre canais.

import { describe, it, expect } from 'vitest'
import { computeIdentity } from '@/lib/import-identity/compute-identity'

describe('Identity cross-format OFX ↔ PDF', () => {
  it('mesma tx via OFX e via PDF gera mesmo contentHash', () => {
    // OFX: traz FITID (provavelmente confiável pra Stone/Sicredi)
    const fromOfx = computeIdentity({
      accountId: 'conta-cuid-cacula-caixa',
      fitid: '20260603001230',
      date: new Date('2026-06-03T00:00:00Z'),
      amount: 6822.93,
      type: 'DEBIT',
      name: 'PARC FIN 1827478',
      memo: 'PARC FIN 1827478',
    })

    // PDF: sem FITID (extrato Caixa)
    const fromPdf = computeIdentity({
      accountId: 'conta-cuid-cacula-caixa',
      fitid: null,
      date: '2026-06-03', // string YYYY-MM-DD
      amount: 6822.93,
      type: 'DEBIT',
      name: null,
      memo: 'PARC FIN 1827478',
    })

    // contentHash deve ser IDÊNTICO — esse é o ponto crítico.
    expect(fromOfx.contentHash).toBe(fromPdf.contentHash)
    // fitidKey só OFX tem
    expect(fromPdf.fitidKey).toBeNull()
  })

  it('mesma tx mas em CONTA diferente gera hash diferente', () => {
    const a = computeIdentity({
      accountId: 'conta-A',
      fitid: null,
      date: '2026-06-01',
      amount: 100,
      type: 'CREDIT',
      memo: 'PIX',
    })
    const b = computeIdentity({
      accountId: 'conta-B',
      fitid: null,
      date: '2026-06-01',
      amount: 100,
      type: 'CREDIT',
      memo: 'PIX',
    })
    expect(a.contentHash).not.toBe(b.contentHash)
  })

  it('mesma tx com sinais opostos (CREDIT vs DEBIT) gera hash diferente', () => {
    const credit = computeIdentity({
      accountId: 'c',
      fitid: null,
      date: '2026-06-01',
      amount: 100,
      type: 'CREDIT',
      memo: 'X',
    })
    const debit = computeIdentity({
      accountId: 'c',
      fitid: null,
      date: '2026-06-01',
      amount: 100,
      type: 'DEBIT',
      memo: 'X',
    })
    expect(credit.contentHash).not.toBe(debit.contentHash)
  })

  it('description normalizada bate mesmo com whitespace diferente', () => {
    const a = computeIdentity({
      accountId: 'c',
      fitid: null,
      date: '2026-06-01',
      amount: 100,
      type: 'DEBIT',
      memo: 'PARC FIN  1827478',
    })
    const b = computeIdentity({
      accountId: 'c',
      fitid: null,
      date: '2026-06-01',
      amount: 100,
      type: 'DEBIT',
      memo: 'PARC FIN 1827478', // 1 espaço só
    })
    expect(a.contentHash).toBe(b.contentHash)
  })
})
