import { describe, it, expect } from 'vitest'
import { findDuplicateStableKeys, type DupTxRow } from '../tx-duplicate-invariant'

// REGRA 1 do I10 (bug PIX 7.000, 17/08) — com o FORMATO REAL de dedupHash do banco.
// Os dois hashes abaixo são os REAIS das duas tx de −7000 em 13/08 (só o batchId muda).

const BAN = 'cmq17z90v00qxrndl02kfn4iz' // caçula Banrisul
const accNames = new Map([[BAN, 'banrisul']])
const D = (iso: string) => new Date(iso)

const row = (id: string, dedupHash: string | null, over: Partial<DupTxRow> = {}): DupTxRow => ({
  id, bankAccountId: BAN, dedupHash, date: D('2026-08-13T12:00:00Z'), amount: 7000, description: 'PIX ENVIADO', ...over,
})

describe('findDuplicateStableKeys — I10', () => {
  it('duplicata REAL do 7.000 (mesmo stableKey, batchIds diferentes) → aponta 1', () => {
    const dup = findDuplicateStableKeys([
      row('cmsuottdl0008pxoyni63u9w1', '2026-08-13|-7000.00|PIX ENVIADO#cmsuo96uy0003pxoyvls6j0ml:0'),
      row('cmsy374kg0004fwz9lbgyn3gh', '2026-08-13|-7000.00|PIX ENVIADO#cmsy34sjm0001fwz9j1iaoj6v:0'),
    ], accNames)
    expect(dup).toHaveLength(1)
    expect(dup[0].txIds.sort()).toEqual(['cmsuottdl0008pxoyni63u9w1', 'cmsy374kg0004fwz9lbgyn3gh'])
    expect(dup[0].amount).toBe(7000)
    expect(dup[0].accountName).toBe('banrisul')
  })

  it('depois de remover uma → 0 (o que o juiz tem que mostrar pós-limpeza)', () => {
    const dup = findDuplicateStableKeys([
      row('cmsuottdl0008pxoyni63u9w1', '2026-08-13|-7000.00|PIX ENVIADO#cmsuo96uy0003pxoyvls6j0ml:0'),
    ], accNames)
    expect(dup).toHaveLength(0)
  })

  it('repeat LEGÍTIMO na mesma fatura (mesmo batchId, occ :0 e :1) → NÃO é duplicata', () => {
    // 2 tarifas idênticas no mesmo dia, no MESMO import — distintas de propósito.
    const dup = findDuplicateStableKeys([
      row('t1', '2026-08-13|-50.00|TARIFA#batchA:0', { amount: 50 }),
      row('t2', '2026-08-13|-50.00|TARIFA#batchA:1', { amount: 50 }),
    ], accNames)
    expect(dup).toHaveLength(0)
  })

  it('mesmo stableKey em CONTAS diferentes → NÃO é duplicata (isolado por conta)', () => {
    const dup = findDuplicateStableKeys([
      row('a', '2026-08-13|-7000.00|PIX ENVIADO#b1:0'),
      row('b', '2026-08-13|-7000.00|PIX ENVIADO#b2:0', { bankAccountId: 'OUTRA_CONTA' }),
    ], accNames)
    expect(dup).toHaveLength(0)
  })

  it('dedupHash legado (sha256/sem #) ou null → pula (não julga, não falso-positivo)', () => {
    const dup = findDuplicateStableKeys([
      row('a', 'a1b2c3d4e5f6deadbeef'), // sha256 V1, sem '#'
      row('b', 'a1b2c3d4e5f6deadbeef'),
      row('c', null),
      row('d', null),
    ], accNames)
    expect(dup).toHaveLength(0)
  })
})
