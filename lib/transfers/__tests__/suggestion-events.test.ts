// Sprint TransferSuggestionEvent (13/08) — REGRA 3: executa os helpers reais
// contra prisma-mock que captura o que foi gravado + o filtro do motor (puro).

import { describe, it, expect, vi } from 'vitest'
import {
  recordSuggested, recordConfirmed, recordIgnored, loadIgnoredKeys, pairKey,
} from '../suggestion-events'
import { detectTransfers, type UnifiedTx } from '../unified-transfer-engine'
import type { OwnEntityRefs } from '../own-entity-signals'

function mockDb() {
  const upserts: any[] = []
  const db: any = {
    transferSuggestionEvent: {
      upsert: vi.fn(async (args: any) => { upserts.push(args); return { id: 'e1' } }),
      findMany: vi.fn(async () => [{ debitTxId: 'd1', creditTxId: 'c1' }]),
    },
  }
  return { db, upserts }
}

describe('recordSuggested — SUGGESTED idempotente (não duplica a cada load)', () => {
  it('usa UPSERT por par (create SUGGESTED, update NO-OP → não sobrescreve desfecho)', async () => {
    const { db, upserts } = mockDb()
    await recordSuggested(db, 'co1', [{ debitTxId: 'd1', creditTxId: 'c1', layer: 'STRONG', confidence: 0.9, evidences: ['x'] }])
    expect(db.transferSuggestionEvent.upsert).toHaveBeenCalledTimes(1)
    const a = upserts[0]
    expect(a.where.debitTxId_creditTxId).toEqual({ debitTxId: 'd1', creditTxId: 'c1' })
    expect(a.create.outcome).toBe('SUGGESTED')
    expect(a.create.engine).toBe('unified')
    expect(a.create.evidences).toBe(JSON.stringify(['x']))
    expect(a.update).toEqual({}) // existe → NÃO toca (preserva CONFIRMED/IGNORED)
  })
})

describe('recordConfirmed — CONFIRMED; manual vs motor', () => {
  it('confirmar marca CONFIRMED (update) e cria como manual se não havia sugestão', async () => {
    const { db, upserts } = mockDb()
    await recordConfirmed(db, 'co1', [{ debitTxId: 'd1', creditTxId: 'c1', confidence: 0.9 }])
    const a = upserts[0]
    expect(a.update.outcome).toBe('CONFIRMED')
    expect(a.update.resolvedAt).toBeInstanceOf(Date)
    // create (quando NÃO havia SUGGESTED) → engine 'manual' (usuário achou sozinho)
    expect(a.create.engine).toBe('manual')
    expect(a.create.outcome).toBe('CONFIRMED')
  })
})

describe('recordIgnored — IGNORED', () => {
  it('ignorar marca IGNORED (update) com resolvedAt', async () => {
    const { db, upserts } = mockDb()
    await recordIgnored(db, 'co1', [{ debitTxId: 'd1', creditTxId: 'c1' }])
    expect(upserts[0].update.outcome).toBe('IGNORED')
    expect(upserts[0].create.outcome).toBe('IGNORED')
  })
})

describe('loadIgnoredKeys', () => {
  it('devolve Set de chaves debit|credit', async () => {
    const { db } = mockDb()
    const keys = await loadIgnoredKeys(db, 'co1')
    expect(keys.has(pairKey('d1', 'c1'))).toBe(true)
  })
})

// ── filtro do motor (puro): par ignorado NÃO reaparece, mas a tx pareia com outra ──
const REFS: OwnEntityRefs = { cnpj: '29756732000198', names: ['cacula'], accountNames: [], ownerCpfs: [], ownerNames: [] }
const D = (d: number) => new Date(2026, 7, d, 12)

describe('detectTransfers — ignoredKeys pula ANTES do greedy', () => {
  it('par ignorado some das sugestões', () => {
    const d: UnifiedTx = { id: 'd', bankAccountId: 'banrisul', date: D(2), type: 'DEBIT', amount: 5000, description: 'PIX ENVIADO 29756732000198' }
    const c: UnifiedTx = { id: 'c', bankAccountId: 'stone', date: D(2), type: 'CREDIT', amount: 5000, description: 'PIX RECEBIDO 29756732000198' }
    const semIgnore = detectTransfers([d, c], { refs: REFS, valorComum: new Set(), matchOwnerName: true })
    expect([...semIgnore.suggestions, ...semIgnore.weak].length).toBeGreaterThan(0)
    const comIgnore = detectTransfers([d, c], { refs: REFS, valorComum: new Set(), matchOwnerName: true, ignoredKeys: new Set([pairKey('d', 'c')]) })
    expect([...comIgnore.suggestions, ...comIgnore.weak].find((p) => p.from.id === 'd' && p.to.id === 'c')).toBeUndefined()
  })

  it('ignorar d↔c NÃO impede d↔c2 (a tx pareia com outra contraparte)', () => {
    const d: UnifiedTx = { id: 'd', bankAccountId: 'banrisul', date: D(2), type: 'DEBIT', amount: 5000, description: 'PIX ENVIADO 29756732000198' }
    const c1: UnifiedTx = { id: 'c1', bankAccountId: 'stone', date: D(2), type: 'CREDIT', amount: 5000, description: 'PIX RECEBIDO 29756732000198' }
    const c2: UnifiedTx = { id: 'c2', bankAccountId: 'sicredi', date: D(2), type: 'CREDIT', amount: 5000, description: 'PIX RECEBIDO 29756732000198' }
    const r = detectTransfers([d, c1, c2], { refs: REFS, valorComum: new Set(), matchOwnerName: true, ignoredKeys: new Set([pairKey('d', 'c1')]) })
    const paired = [...r.suggestions, ...r.weak]
    expect(paired.find((p) => p.from.id === 'd' && p.to.id === 'c1')).toBeUndefined() // ignorado
    expect(paired.find((p) => p.from.id === 'd' && p.to.id === 'c2')).toBeTruthy() // pareou com a outra
  })
})
