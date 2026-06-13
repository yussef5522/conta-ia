import { describe, it, expect } from 'vitest'
import { reconcileStatement } from '../reconcile-statement'
import type { StatementLine, DbBankTransaction } from '../types'

const D = (s: string) => new Date(`${s}T12:00:00Z`)
const dtAsOf = D('2026-06-12')

function dbTx(over: Partial<DbBankTransaction> & Pick<DbBankTransaction, 'id' | 'date' | 'signedAmount' | 'memo'>): DbBankTransaction {
  return {
    lifecycle: 'EFFECTED',
    type: over.signedAmount >= 0 ? 'CREDIT' : 'DEBIT',
    ...over,
  }
}

describe('reconcileStatement — casos reais Cacula Mix', () => {
  it('T1: EMPRESTIMO 4092.02 no DB mas ausente do extrato → ÓRFÃ (fantasma)', () => {
    const dbs: DbBankTransaction[] = [
      dbTx({ id: 'tx-emprestimo', date: D('2026-06-11'), signedAmount: -4092.02, memo: 'EMPRESTIMO' }),
    ]
    const stmt: StatementLine[] = [] // extrato 12/06 NÃO traz mais

    const r = reconcileStatement(stmt, dbs, dtAsOf)
    expect(r.orphans).toHaveLength(1)
    expect(r.orphans[0].id).toBe('tx-emprestimo')
    expect(r.matched).toHaveLength(0)
    expect(r.missing).toHaveLength(0)
  })

  it('T2: duplicata OP.CREDITO C/GARANTIA — extrato tem 1, DB tem 2 → 014332 órfã DETERMINÍSTICA (desempate FITID)', () => {
    const dbs: DbBankTransaction[] = [
      dbTx({ id: 'tx-014332', date: D('2026-06-10'), signedAmount: 3919, memo: 'OP.CREDITO C/GARANTIA', fitid: '014332' }),
      dbTx({ id: 'tx-000020', date: D('2026-06-10'), signedAmount: 3919, memo: 'OP. CREDITO C/GARANTIA', fitid: '000020' }),
    ]
    const stmt: StatementLine[] = [
      { datePosted: D('2026-06-10'), signedAmount: 3919, memo: 'OP. CREDITO C/GARANTIA', fitid: '000020' },
    ]
    const r = reconcileStatement(stmt, dbs, dtAsOf)
    expect(r.matched).toHaveLength(1)
    expect(r.matched[0].dbTx.id).toBe('tx-000020') // FITID confirmado pelo extrato
    expect(r.orphans).toHaveLength(1)
    expect(r.orphans[0].id).toBe('tx-014332') // determinístico agora
    expect(r.missing).toHaveLength(0)
  })

  it('T3: 5 créditos de 11/06 cujo FITID mudou entre exports → casados por chave estável, ZERO duplicata', () => {
    // DB: importados do arquivo 11/06 com FITIDs antigos
    const dbs: DbBankTransaction[] = [
      dbTx({ id: 'db-1', date: D('2026-06-11'), signedAmount: 75.96, memo: 'ANTECIPACAO BANRICOMPRAS', fitid: '007842' }),
      dbTx({ id: 'db-2', date: D('2026-06-11'), signedAmount: 298.99, memo: 'ANTECIP STONE', fitid: '008911' }),
      dbTx({ id: 'db-3', date: D('2026-06-11'), signedAmount: 111.94, memo: 'ANTECIP STONE', fitid: '008912' }),
      dbTx({ id: 'db-4', date: D('2026-06-11'), signedAmount: 245.20, memo: 'BANRI A VISTA', fitid: '007743' }),
      dbTx({ id: 'db-5', date: D('2026-06-11'), signedAmount: 132.14, memo: 'DEBITO STONE', fitid: '008201' }),
    ]
    // Extrato 12/06: Banrisul TROCOU os FITIDs (mas mesma data/valor/memo)
    const stmt: StatementLine[] = [
      { datePosted: D('2026-06-11'), signedAmount: 75.96, memo: 'ANTECIPACAO BANRICOMPRAS', fitid: '381453' },
      { datePosted: D('2026-06-11'), signedAmount: 298.99, memo: 'ANTECIP STONE', fitid: '523604' },
      { datePosted: D('2026-06-11'), signedAmount: 111.94, memo: 'ANTECIP STONE', fitid: '523605' },
      { datePosted: D('2026-06-11'), signedAmount: 245.20, memo: 'BANRI A VISTA', fitid: '333729' },
      { datePosted: D('2026-06-11'), signedAmount: 132.14, memo: 'DEBITO STONE', fitid: '446801' },
    ]
    const r = reconcileStatement(stmt, dbs, dtAsOf)
    expect(r.matched).toHaveLength(5)
    expect(r.orphans).toHaveLength(0)
    expect(r.missing).toHaveLength(0)
  })

  it('T4: PAGAMENTO CARTAO 2654.63 DTPOSTED 15/06 com DTASOF 12/06 → PREVIEW (PENDING, não EFFECTED)', () => {
    const dbs: DbBankTransaction[] = []
    const stmt: StatementLine[] = [
      { datePosted: D('2026-06-15'), signedAmount: -2654.63, memo: 'PAGAMENTO CARTAO DE CREDITO', fitid: '100048' },
    ]
    const r = reconcileStatement(stmt, dbs, dtAsOf)
    expect(r.previews).toHaveLength(1)
    expect(r.previews[0].memo).toContain('PAGAMENTO CARTAO')
    expect(r.matched).toHaveLength(0)
    expect(r.orphans).toHaveLength(0)
    expect(r.missing).toHaveLength(0)
  })

  it('T5: TRANSFER "PIX ENVIADO -7400 10/06" presente no extrato → casa (não é órfã) mesmo sendo TRANSFER no DB', () => {
    // DB tem a perna como type=TRANSFER (Sprint 0.5 Dia 2 pareamento), MAS pra
    // efeito de reconciliação contra extrato o que importa é signedAmount + memo + data
    const dbs: DbBankTransaction[] = [
      { id: 'tx-802039', date: D('2026-06-10'), signedAmount: -7400, memo: 'PIX ENVIADO', fitid: '802039', lifecycle: 'EFFECTED', type: 'TRANSFER' },
    ]
    const stmt: StatementLine[] = [
      { datePosted: D('2026-06-10'), signedAmount: -7400, memo: 'PIX ENVIADO', fitid: '802039' },
    ]
    const r = reconcileStatement(stmt, dbs, dtAsOf)
    expect(r.matched).toHaveLength(1)
    expect(r.matched[0].dbTx.type).toBe('TRANSFER')
    expect(r.orphans).toHaveLength(0)
  })

  it('T6: duas linhas LEGÍTIMAS de mesma chave (2 tarifas iguais mesmo dia) → ambas casam (NÃO marcar uma como órfã)', () => {
    const dbs: DbBankTransaction[] = [
      dbTx({ id: 'db-tarifa-1', date: D('2026-06-01'), signedAmount: -8.50, memo: 'TARIFA PACOTE' }),
      dbTx({ id: 'db-tarifa-2', date: D('2026-06-01'), signedAmount: -8.50, memo: 'TARIFA PACOTE' }),
    ]
    const stmt: StatementLine[] = [
      { datePosted: D('2026-06-01'), signedAmount: -8.50, memo: 'TARIFA PACOTE', fitid: '100001' },
      { datePosted: D('2026-06-01'), signedAmount: -8.50, memo: 'TARIFA PACOTE', fitid: '100002' },
    ]
    const r = reconcileStatement(stmt, dbs, dtAsOf)
    expect(r.matched).toHaveLength(2)
    expect(r.orphans).toHaveLength(0)
    expect(r.missing).toHaveLength(0)
  })

  it('CASO COMBINADO: cenário realista da Cacula em 12/06', () => {
    // Mini-cenário: EMPRESTIMO órfã + duplicata + agendado + 1 missing
    const dbs: DbBankTransaction[] = [
      dbTx({ id: 'emp', date: D('2026-06-11'), signedAmount: -4092.02, memo: 'EMPRESTIMO' }), // órfã
      dbTx({ id: 'd1', date: D('2026-06-10'), signedAmount: 3919, memo: 'OP.CREDITO C/GARANTIA' }), // duplicata 1
      dbTx({ id: 'd2', date: D('2026-06-10'), signedAmount: 3919, memo: 'OP. CREDITO C/GARANTIA' }), // duplicata 2
    ]
    const stmt: StatementLine[] = [
      { datePosted: D('2026-06-10'), signedAmount: 3919, memo: 'OP. CREDITO C/GARANTIA', fitid: '000020' },
      { datePosted: D('2026-06-15'), signedAmount: -2654.63, memo: 'PAGAMENTO CARTAO', fitid: '100048' }, // preview
      { datePosted: D('2026-06-12'), signedAmount: 50, memo: 'NOVA DO DIA 12', fitid: '999111' }, // missing
    ]
    const r = reconcileStatement(stmt, dbs, dtAsOf)
    expect(r.matched).toHaveLength(1)
    expect(r.orphans).toHaveLength(2) // EMPRESTIMO + 1 duplicata
    expect(r.previews).toHaveLength(1)
    expect(r.missing).toHaveLength(1)
    expect(r.missing[0].memo).toBe('NOVA DO DIA 12')
  })
})
