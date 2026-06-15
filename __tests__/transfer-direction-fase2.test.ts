// Fase 2 — testes da direção EXPLÍCITA de transferência.
// Cobertura:
//   (a) par com transferDirection ('OUT'/'IN') rende from→to certo na listagem
//   (b) deletar 1 perna preserva a direção da restante (NÃO inverte)
//   (c) recompute via transferDirection == recompute via createdAt-ASC (prova de equivalência)

import { describe, it, expect } from 'vitest'
import { groupTransfersForList, type TxForList } from '../lib/transfers/group-for-list'
import { prepareBalanceTransactions, type RawBalanceTransaction } from '../lib/balance/prepare'

const D = (s: string) => new Date(`${s}T12:00:00Z`)
const acc = (id: string, name: string) => ({ id, name, bankName: null })

describe('Fase 2 — listagem (groupTransfersForList) com transferDirection', () => {
  it('(a) par com OUT/IN explícito → fromAccount=OUT, toAccount=IN', () => {
    const txs: TxForList[] = [
      {
        id: 'out-side', date: D('2026-06-10'), amount: 7400,
        description: 'PIX Banrisul→Stone', notes: null,
        transferGroupId: 'grp1', transferDirection: 'OUT',
        bankAccount: acc('banr', 'banrisul'),
      },
      {
        id: 'in-side', date: D('2026-06-10'), amount: 7400,
        description: 'PIX Banrisul→Stone', notes: null,
        transferGroupId: 'grp1', transferDirection: 'IN',
        bankAccount: acc('stone', 'stone'),
      },
    ]
    const result = groupTransfersForList(txs)
    expect(result).toHaveLength(1)
    expect(result[0].fromAccount?.name).toBe('banrisul')
    expect(result[0].toAccount?.name).toBe('stone')
  })

  it('(a-2) IN aparece ANTES de OUT no input → ainda atribui certo (ordem irrelevante)', () => {
    const txs: TxForList[] = [
      {
        id: 'in-side', date: D('2026-06-10'), amount: 7400, description: '', notes: null,
        transferGroupId: 'grp1', transferDirection: 'IN',
        bankAccount: acc('stone', 'stone'),
      },
      {
        id: 'out-side', date: D('2026-06-10'), amount: 7400, description: '', notes: null,
        transferGroupId: 'grp1', transferDirection: 'OUT',
        bankAccount: acc('banr', 'banrisul'),
      },
    ]
    const result = groupTransfersForList(txs)
    expect(result[0].fromAccount?.name).toBe('banrisul')
    expect(result[0].toAccount?.name).toBe('stone')
  })

  it('(b) grupo com 1 perna OUT → fromAccount=OUT, toAccount=null (NÃO from=to)', () => {
    const txs: TxForList[] = [
      {
        id: 'solo-out', date: D('2026-06-10'), amount: 2500, description: '', notes: null,
        transferGroupId: 'orfa', transferDirection: 'OUT',
        bankAccount: acc('sicredi', 'sicredi'),
      },
    ]
    const result = groupTransfersForList(txs)
    expect(result[0].fromAccount?.name).toBe('sicredi')
    expect(result[0].toAccount).toBeNull()
  })

  it('(b-2) grupo com 1 perna IN → toAccount=IN, fromAccount=null', () => {
    const txs: TxForList[] = [
      {
        id: 'solo-in', date: D('2026-06-10'), amount: 2500, description: '', notes: null,
        transferGroupId: 'orfa', transferDirection: 'IN',
        bankAccount: acc('stone', 'stone'),
      },
    ]
    const result = groupTransfersForList(txs)
    expect(result[0].fromAccount).toBeNull()
    expect(result[0].toAccount?.name).toBe('stone')
  })

  it('Fallback createdAt-ASC quando transferDirection NULL (tx pré-Fase-2)', () => {
    const txs: TxForList[] = [
      {
        id: 'mais-antigo', date: D('2026-06-10'), amount: 7400, description: '', notes: null,
        transferGroupId: 'legacy', transferDirection: null,
        bankAccount: acc('banr', 'banrisul'),
      },
      {
        id: 'mais-novo', date: D('2026-06-10'), amount: 7400, description: '', notes: null,
        transferGroupId: 'legacy', transferDirection: null,
        bankAccount: acc('stone', 'stone'),
      },
    ]
    const result = groupTransfersForList(txs)
    expect(result[0].fromAccount?.name).toBe('banrisul') // primeira vista = OUT
    expect(result[0].toAccount?.name).toBe('stone') // segunda = IN
  })
})

describe('Fase 2 — prepareBalanceTransactions com transferDirection', () => {
  function tx(over: Partial<RawBalanceTransaction> & Pick<RawBalanceTransaction, 'id' | 'bankAccountId' | 'amount' | 'type'>): RawBalanceTransaction {
    return {
      date: D('2026-06-10'), createdAt: D('2026-06-10'),
      transferGroupId: null,
      ...over,
    }
  }

  it('(c) signed via transferDirection EXPLÍCITO (OUT=-amount, IN=+amount)', () => {
    const txs: RawBalanceTransaction[] = [
      tx({ id: 'a', bankAccountId: 'sicredi', amount: 2500, type: 'TRANSFER', transferGroupId: 'g1', transferDirection: 'OUT', createdAt: D('2026-06-11') }),
      tx({ id: 'b', bankAccountId: 'stone', amount: 2500, type: 'TRANSFER', transferGroupId: 'g1', transferDirection: 'IN', createdAt: D('2026-06-10') }),
    ]
    const sigSicredi = prepareBalanceTransactions(txs, 'sicredi')
    const sigStone = prepareBalanceTransactions(txs, 'stone')
    expect(sigSicredi[0].signedAmount).toBe(-2500)
    expect(sigStone[0].signedAmount).toBe(2500)
    // ⚠ Note: o Sicredi tem createdAt mais NOVO mas é OUT (heurística cra-ASC daria IN=+).
    // Isso prova que a direção EXPLÍCITA prevalece e CORRIGE casos onde createdAt mente.
  })

  it('(c) equivalência: dados pré-Fase-2 (transferDirection=NULL) usam createdAt-ASC e dão MESMO signed', () => {
    const txs: RawBalanceTransaction[] = [
      tx({ id: 'old', bankAccountId: 'banr', amount: 7400, type: 'TRANSFER', transferGroupId: 'g2', createdAt: D('2026-06-10') }),
      tx({ id: 'new', bankAccountId: 'stone', amount: 7400, type: 'TRANSFER', transferGroupId: 'g2', createdAt: D('2026-06-11') }),
    ]
    // Sem transferDirection → fallback createdAt-ASC: mais antigo = OUT
    const sigBanr = prepareBalanceTransactions(txs, 'banr')
    const sigStone = prepareBalanceTransactions(txs, 'stone')
    expect(sigBanr[0].signedAmount).toBe(-7400)
    expect(sigStone[0].signedAmount).toBe(7400)

    // Mesmo cenário COM transferDirection EXPLÍCITO → MESMO resultado (equivalência)
    const txsComDir: RawBalanceTransaction[] = txs.map(t => ({
      ...t,
      transferDirection: t.id === 'old' ? 'OUT' : 'IN' as 'OUT' | 'IN',
    }))
    const sigBanr2 = prepareBalanceTransactions(txsComDir, 'banr')
    const sigStone2 = prepareBalanceTransactions(txsComDir, 'stone')
    expect(sigBanr2[0].signedAmount).toBe(sigBanr[0].signedAmount)
    expect(sigStone2[0].signedAmount).toBe(sigStone[0].signedAmount)
  })

  it('(b) perna SOZINHA com transferDirection EXPLÍCITO continua contabilizada (não skip)', () => {
    // Caso real: Sicredi MANUAL órfã pós-deleção. Com Fase 2, a direção
    // gravada PERMANECE, e o saldo NÃO é distorcido pela ausência da contraparte.
    const txs: RawBalanceTransaction[] = [
      tx({ id: 'orfa', bankAccountId: 'sicredi', amount: 2500, type: 'TRANSFER', transferGroupId: 'g3', transferDirection: 'OUT' }),
    ]
    const sig = prepareBalanceTransactions(txs, 'sicredi')
    expect(sig).toHaveLength(1)
    expect(sig[0].signedAmount).toBe(-2500)
  })

  it('(b) perna SOZINHA SEM transferDirection (legacy) → skipped (comportamento antigo preservado)', () => {
    const txs: RawBalanceTransaction[] = [
      tx({ id: 'legacy-orfa', bankAccountId: 'sicredi', amount: 2500, type: 'TRANSFER', transferGroupId: 'g4' }),
    ]
    const sig = prepareBalanceTransactions(txs, 'sicredi')
    expect(sig).toHaveLength(0) // skipped pela heurística antiga
  })
})
