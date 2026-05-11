import { describe, it, expect } from 'vitest'
import { buildTransferOperations } from '@/lib/transfers/build-operations'
import type { TransferInput } from '@/lib/transfers/validate'

const FROM = {
  id: 'acc-from',
  name: 'Banrisul Matriz',
  companyId: 'comp-1',
}
const TO = {
  id: 'acc-to',
  name: 'Sicoob Filial',
  companyId: 'comp-1',
}

function makeInput(overrides: Partial<TransferInput> = {}): TransferInput {
  return {
    fromAccountId: FROM.id,
    toAccountId: TO.id,
    amount: 1500,
    date: new Date('2026-05-11T12:00:00Z'),
    ...overrides,
  }
}

describe('buildTransferOperations (Sprint 0.5 Dia 2)', () => {
  it('cria 2 transações com o MESMO transferGroupId', () => {
    const ops = buildTransferOperations(makeInput(), FROM, TO, 'group-abc')
    expect(ops.debitTx.transferGroupId).toBe('group-abc')
    expect(ops.creditTx.transferGroupId).toBe('group-abc')
  })

  it('ambas as transações têm type=TRANSFER', () => {
    const ops = buildTransferOperations(makeInput(), FROM, TO, 'g1')
    expect(ops.debitTx.type).toBe('TRANSFER')
    expect(ops.creditTx.type).toBe('TRANSFER')
  })

  it('ambas com categoryId=null (transferência não tem categoria)', () => {
    const ops = buildTransferOperations(makeInput(), FROM, TO, 'g1')
    expect(ops.debitTx.categoryId).toBeNull()
    expect(ops.creditTx.categoryId).toBeNull()
  })

  it('ambas com status=RECONCILED (não vão pra fila de classificação)', () => {
    const ops = buildTransferOperations(makeInput(), FROM, TO, 'g1')
    expect(ops.debitTx.status).toBe('RECONCILED')
    expect(ops.creditTx.status).toBe('RECONCILED')
  })

  it('bankAccountId correto em cada lado', () => {
    const ops = buildTransferOperations(makeInput(), FROM, TO, 'g1')
    expect(ops.debitTx.bankAccountId).toBe(FROM.id)
    expect(ops.creditTx.bankAccountId).toBe(TO.id)
  })

  it('deltas de saldo são opostos e batem com amount', () => {
    const ops = buildTransferOperations(makeInput({ amount: 750 }), FROM, TO, 'g1')
    expect(ops.fromBalanceDelta).toBe(-750)
    expect(ops.toBalanceDelta).toBe(750)
    expect(ops.fromBalanceDelta + ops.toBalanceDelta).toBe(0)
  })

  it('description padrão quando omitida: saída usa nome da to, entrada usa nome da from', () => {
    const ops = buildTransferOperations(makeInput(), FROM, TO, 'g1')
    expect(ops.debitTx.description).toBe('Transferência para Sicoob Filial')
    expect(ops.creditTx.description).toBe('Transferência de Banrisul Matriz')
  })

  it('description custom é usada nas DUAS pontas quando informada', () => {
    const ops = buildTransferOperations(
      makeInput({ description: 'Folha de pagamento out/2026' }),
      FROM,
      TO,
      'g1',
    )
    expect(ops.debitTx.description).toBe('Folha de pagamento out/2026')
    expect(ops.creditTx.description).toBe('Folha de pagamento out/2026')
  })

  it('description em branco com espaços cai pro default', () => {
    const ops = buildTransferOperations(
      makeInput({ description: '   ' }),
      FROM,
      TO,
      'g1',
    )
    expect(ops.debitTx.description).toBe('Transferência para Sicoob Filial')
    expect(ops.creditTx.description).toBe('Transferência de Banrisul Matriz')
  })

  it('notes são preservadas em ambas as pontas', () => {
    const ops = buildTransferOperations(
      makeInput({ notes: 'Reposição de saldo' }),
      FROM,
      TO,
      'g1',
    )
    expect(ops.debitTx.notes).toBe('Reposição de saldo')
    expect(ops.creditTx.notes).toBe('Reposição de saldo')
  })

  it('amount é positivo nas 2 pontas (sinal vem do delta de saldo)', () => {
    const ops = buildTransferOperations(makeInput({ amount: 2500 }), FROM, TO, 'g1')
    expect(ops.debitTx.amount).toBe(2500)
    expect(ops.creditTx.amount).toBe(2500)
  })

  it('origin=MANUAL nas 2 pontas', () => {
    const ops = buildTransferOperations(makeInput(), FROM, TO, 'g1')
    expect(ops.debitTx.origin).toBe('MANUAL')
    expect(ops.creditTx.origin).toBe('MANUAL')
  })

  it('mesma data nas 2 pontas', () => {
    const date = new Date('2026-05-11T15:30:00Z')
    const ops = buildTransferOperations(makeInput({ date }), FROM, TO, 'g1')
    expect(ops.debitTx.date).toEqual(date)
    expect(ops.creditTx.date).toEqual(date)
  })
})
