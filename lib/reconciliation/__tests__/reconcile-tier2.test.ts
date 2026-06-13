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

describe('reconcileStatement — Tier 2 (FUZZY) + desempate por FITID', () => {
  it('T7: TRANSFER memo divergente ERP vs banco → casa no Tier 2 FUZZY', () => {
    // Caso real Cacula: form "Nova Transferência" grava memo "YUSSEF... | Pix",
    // extrato OFX traz "PIX ENVIADO" — mesma data, mesmo valor com sinal.
    const dbs: DbBankTransaction[] = [
      { id: 'tx-pix-21k', date: D('2026-06-03'), signedAmount: -21000, memo: 'YUSSEF ABU ZAHRY MUSA - Transferência | Pix', lifecycle: 'EFFECTED', type: 'TRANSFER' },
    ]
    const stmt: StatementLine[] = [
      { datePosted: D('2026-06-03'), signedAmount: -21000, memo: 'PIX ENVIADO', fitid: '918448' },
    ]
    const r = reconcileStatement(stmt, dbs, dtAsOf)

    expect(r.matched).toHaveLength(1)
    expect(r.matched[0].confidence).toBe('FUZZY')
    expect(r.matched[0].dbTx.id).toBe('tx-pix-21k')
    expect(r.orphans).toHaveLength(0)
    expect(r.missing).toHaveLength(0)
  })

  it('T8: duplicata mesma chave — a ÓRFÃ marcada DEVE ser a 014332 (FITID ausente do extrato), não a 000020', () => {
    const dbs: DbBankTransaction[] = [
      dbTx({ id: 'tx-014332', date: D('2026-06-10'), signedAmount: 3919, memo: 'OP.CREDITO C/GARANTIA', fitid: '014332' }),
      dbTx({ id: 'tx-000020', date: D('2026-06-10'), signedAmount: 3919, memo: 'OP. CREDITO C/GARANTIA', fitid: '000020' }),
    ]
    const stmt: StatementLine[] = [
      { datePosted: D('2026-06-10'), signedAmount: 3919, memo: 'OP. CREDITO C/GARANTIA', fitid: '000020' },
    ]
    const r = reconcileStatement(stmt, dbs, dtAsOf)

    expect(r.matched).toHaveLength(1)
    expect(r.matched[0].confidence).toBe('EXACT')
    expect(r.matched[0].dbTx.id).toBe('tx-000020') // confirmado pelo FITID do extrato
    expect(r.orphans).toHaveLength(1)
    expect(r.orphans[0].id).toBe('tx-014332') // FITID ausente do extrato atual → órfã determinística
    expect(r.missing).toHaveLength(0)
  })

  it('T9 (ANTI OVER-MATCH): 2 tx DB distintas com mesma data+valor, AMBAS no extrato → Tier 2 casa 1-pra-1, não inventa', () => {
    // Cenário: 2 PIX legítimos do mesmo dia, mesmo valor (ex: 2 transferências sequenciais)
    const dbs: DbBankTransaction[] = [
      dbTx({ id: 'tx-a', date: D('2026-06-01'), signedAmount: -500, memo: 'TRANSF MANUAL A', fitid: 'aaa111' }),
      dbTx({ id: 'tx-b', date: D('2026-06-01'), signedAmount: -500, memo: 'TRANSF MANUAL B', fitid: 'bbb222' }),
    ]
    const stmt: StatementLine[] = [
      { datePosted: D('2026-06-01'), signedAmount: -500, memo: 'PIX ENVIADO', fitid: 'xxx111' },
      { datePosted: D('2026-06-01'), signedAmount: -500, memo: 'PIX ENVIADO', fitid: 'xxx222' },
    ]
    const r = reconcileStatement(stmt, dbs, dtAsOf)

    expect(r.matched).toHaveLength(2) // exatamente 2, não mais
    expect(r.matched.every(m => m.confidence === 'FUZZY')).toBe(true)
    expect(r.orphans).toHaveLength(0) // nenhuma falsa órfã
    expect(r.missing).toHaveLength(0) // nenhum falso missing
  })

  it('T10 (SEGURANÇA DE SINAL): transfer +7400 no DB vs -7400 no extrato → CONTINUA órfã mesmo com Tier 2', () => {
    // Caso real Banrisul: heurística createdAt-ASC atribuiu signed=+7400 ao Banrisul
    // (deveria ser -7400 porque Banrisul ENVIOU). Tier 2 NÃO PODE mascarar isso.
    const dbs: DbBankTransaction[] = [
      { id: 'tx-7400-bugado', date: D('2026-06-10'), signedAmount: +7400, memo: 'PIX ENVIADO', fitid: '802039', lifecycle: 'EFFECTED', type: 'TRANSFER' },
    ]
    const stmt: StatementLine[] = [
      { datePosted: D('2026-06-10'), signedAmount: -7400, memo: 'PIX ENVIADO', fitid: '802039' },
    ]
    const r = reconcileStatement(stmt, dbs, dtAsOf)

    // Sinais opostos → weakKey diferente → Tier 2 também não casa
    expect(r.matched).toHaveLength(0)
    expect(r.orphans).toHaveLength(1)
    expect(r.orphans[0].id).toBe('tx-7400-bugado')
    expect(r.missing).toHaveLength(1)
    expect(r.missing[0].fitid).toBe('802039')
  })

  it('T7 estendido: 3 PIX órfãos + 3 extrato missing (caso real) → todos casam FUZZY', () => {
    const dbs: DbBankTransaction[] = [
      { id: 'db-21k', date: D('2026-06-01'), signedAmount: -21000, memo: 'YUSSEF ABU ZAHRY MUSA - Transferência | Pix', lifecycle: 'EFFECTED', type: 'TRANSFER' },
      { id: 'db-9k1', date: D('2026-06-03'), signedAmount: -9100, memo: 'YUSSEF ABU ZAHRY MUSA - Transferência | Pix', lifecycle: 'EFFECTED', type: 'TRANSFER' },
      { id: 'db-7k4', date: D('2026-06-10'), signedAmount: -7400, memo: 'YUSSEF ABU ZAHRY MUSA - Transferência | Pix', lifecycle: 'EFFECTED', type: 'TRANSFER' },
    ]
    const stmt: StatementLine[] = [
      { datePosted: D('2026-06-01'), signedAmount: -21000, memo: 'PIX ENVIADO', fitid: '918448' },
      { datePosted: D('2026-06-03'), signedAmount: -9100, memo: 'PIX ENVIADO', fitid: '938032' },
      { datePosted: D('2026-06-10'), signedAmount: -7400, memo: 'PIX ENVIADO', fitid: '802039' },
    ]
    const r = reconcileStatement(stmt, dbs, dtAsOf)

    expect(r.matched).toHaveLength(3)
    expect(r.matched.every(m => m.confidence === 'FUZZY')).toBe(true)
    expect(r.orphans).toHaveLength(0)
    expect(r.missing).toHaveLength(0)
  })

  it('Combinação Tier 1 + Tier 2: créditos por chave estável + transfers por fuzzy', () => {
    const dbs: DbBankTransaction[] = [
      // Tier 1: 1 crédito legítimo
      dbTx({ id: 'db-cred', date: D('2026-06-11'), signedAmount: 298.99, memo: 'ANTECIP STONE', fitid: 'old-fitid' }),
      // Tier 2: 1 transfer memo divergente
      { id: 'db-pix', date: D('2026-06-05'), signedAmount: -1000, memo: 'TRANSFERÊNCIA PIX | YUSSEF', lifecycle: 'EFFECTED', type: 'TRANSFER' },
    ]
    const stmt: StatementLine[] = [
      { datePosted: D('2026-06-11'), signedAmount: 298.99, memo: 'ANTECIP STONE', fitid: 'new-fitid' },
      { datePosted: D('2026-06-05'), signedAmount: -1000, memo: 'PIX ENVIADO', fitid: 'extrato-fitid' },
    ]
    const r = reconcileStatement(stmt, dbs, dtAsOf)

    expect(r.matched).toHaveLength(2)
    expect(r.matched.find(m => m.dbTx.id === 'db-cred')?.confidence).toBe('EXACT')
    expect(r.matched.find(m => m.dbTx.id === 'db-pix')?.confidence).toBe('FUZZY')
    expect(r.orphans).toHaveLength(0)
  })
})
