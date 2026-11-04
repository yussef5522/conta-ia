// Sprint Unificar-Retirada-Órfã (13/08) — REGRA 3: executa a fonte única contra
// prisma-mock e prova que count e list usam a MESMA derivação (impossível divergir).
//
// ⛔⛔ REESCRITO EM 05/11/2026 — A UNIDADE VIROU O DINHEIRO, NÃO A LINHA.
//
// As duas asserções que caíram aqui eram as que AFIRMAVAM O DEFEITO:
//   1. `expect(w.bridge).toEqual({ is: null })` — a exclusão de ponte **na própria linha**;
//   2. `countOrphanWithdrawals` chamando `transaction.count` com esse where.
//
// Medido em prod (04/11, zero escrita): uma retirada vive em DUAS linhas conciliadas (a
// `MANUAL` digitada + a `OFX` do extrato) e a ponte é `@unique` por linha. O dono resolveu o
// lado OFX e a fila devolveu a gêmea MANUAL — 3 fantasmas (escola 100 · escola 1.318,57 ·
// carro 2.845) e 2 pares com AMBOS os lados listados (formatura 190 · camiseta 59).
//
// ⚠️ *Guard que afirma o comportamento errado é pior que guard nenhum* — ele defende o
// defeito. O comportamento novo se prova contra banco em `fila-por-dinheiro.integration.test.ts`
// (as relações não existem no mock); aqui ficam a FORMA do where e a fonte única.

import { describe, it, expect, vi } from 'vitest'
import { orphanWithdrawalWhere, countOrphanWithdrawals, listOrphanWithdrawals } from '../orphan-query'

describe('orphanWithdrawalWhere — as LINHAS candidatas', () => {
  it('tem os filtros que evitam falso positivo: EFFECTED + não-interna + não-agrupada + só DISTRIBUICAO', () => {
    const w: any = orphanWithdrawalWhere('co1')
    expect(w.bankAccount).toEqual({ companyId: 'co1' })
    expect(w.type).toBe('DEBIT')
    expect(w.lifecycle).toBe('EFFECTED') // pago (não status=RECONCILED, mais correto)
    expect(w.isInternalTransfer).toBe(false) // exclui transferência entre contas próprias
    expect(w.transferGroupId).toBeNull() // exclui par agrupado
    expect(w.category.dreGroup.in).toEqual(['DISTRIBUICAO_LUCROS']) // pró-labore fica de fora
  })

  /**
   * ⛔⛔ A ASSERÇÃO INVERTIDA, de propósito: este where NÃO pode filtrar ponte.
   * Se alguém devolver `bridge: { is: null }` aqui, os 3 fantasmas voltam — então o guard
   * cobra a AUSÊNCIA do filtro, com o motivo escrito.
   */
  it('⛔ NÃO filtra ponte por linha — é isso que cobrava a gêmea já resolvida', () => {
    const w: any = orphanWithdrawalWhere('co1')
    expect(w.bridge, 'ponte se decide por DINHEIRO (a linha + o par conciliado)').toBeUndefined()
  })
})

describe('count e list usam a MESMA derivação', () => {
  /** o mock mínimo: `dinheirosDeRetiradaPendentes` faz findMany sobre as candidatas */
  const dbComLinhas = (linhas: any[]) => ({
    transaction: { findMany: vi.fn(async () => linhas) },
  }) as any

  it('countOrphanWithdrawals conta DINHEIRO, não linha — par conciliado vale 1', async () => {
    const db = dbComLinhas([
      { id: 'manual', date: new Date('2026-11-03'), amount: 190, description: 'formatura', origin: 'MANUAL',
        bankAccountId: 'b1', bankAccount: { name: 'stone' }, categoryId: 'c1', category: { name: 'Distribuição de Lucros' },
        reconciledWithId: 'ofx', bridge: null, reconciledFrom: [] },
      { id: 'ofx', date: new Date('2026-11-03'), amount: 190, description: 'Liege Da Silva Boeira - Transf', origin: 'OFX',
        bankAccountId: 'b1', bankAccount: { name: 'stone' }, categoryId: 'c1', category: { name: 'Distribuição de Lucros' },
        reconciledWithId: null, bridge: null, reconciledFrom: [] },
    ])
    expect(await countOrphanWithdrawals(db, 'co1')).toBe(1)
  })

  it('listOrphanWithdrawals devolve o MESMO número que o count', async () => {
    const linhas = [
      { id: 'so-manual', date: new Date('2026-11-01'), amount: 700, description: 'nura', origin: 'MANUAL',
        bankAccountId: 'b1', bankAccount: { name: 'caixa loja/cofre' }, categoryId: 'c1', category: { name: 'Distribuição de Lucros' },
        reconciledWithId: null, bridge: null, reconciledFrom: [] },
    ]
    const lista = await listOrphanWithdrawals(dbComLinhas(linhas), 'co1')
    const n = await countOrphanWithdrawals(dbComLinhas(linhas), 'co1')
    expect(lista).toHaveLength(n)
    expect(lista[0]!.description).toBe('nura')
    expect(lista[0]!.bankAccountName).toBe('caixa loja/cofre')
  })

  it('a lista pede as CANDIDATAS (sem filtro de ponte) e ordena por data desc', async () => {
    const db = dbComLinhas([])
    await listOrphanWithdrawals(db, 'co1')
    const arg = db.transaction.findMany.mock.calls[0][0]
    expect(arg.where).toEqual(orphanWithdrawalWhere('co1'))
    expect(arg.orderBy).toEqual({ date: 'desc' })
  })
})
