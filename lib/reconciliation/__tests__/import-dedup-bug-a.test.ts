// Sprint Fix Dedup Import (30/07/2026) — testes de regressão do BUG A.
// Invariante inegociável: N linhas idênticas no OFX ⇒ N transações no banco.
// Nenhuma perdida (proibido descartar). E re-import continua deduplicando via
// reconcileStatement (que recomputa stableKey das colunas, sem ler dedupHash).

import { describe, it, expect } from 'vitest'
import { reconcileStatement } from '../reconcile-statement'
import { buildLineDedupHash, makeOccurrenceCounter } from '../line-dedup-hash'
import { stableKey } from '../stable-key'
import type { StatementLine, DbBankTransaction } from '../types'

const D = (s: string) => new Date(`${s}T12:00:00Z`)
const dtAsOf = D('2026-07-31')

function dbTx(
  over: Partial<DbBankTransaction> &
    Pick<DbBankTransaction, 'id' | 'date' | 'signedAmount' | 'memo'>,
): DbBankTransaction {
  return { lifecycle: 'EFFECTED', type: over.signedAmount >= 0 ? 'CREDIT' : 'DEBIT', ...over }
}

// Reproduz EXATAMENTE o loop `missing` do import-orchestrator: gera o dedupHash
// de LINHA de cada linha nova. Se colidissem, o create bateria no @@unique.
function dedupHashesForMissing(missing: StatementLine[], importId: string): string[] {
  const nextOcc = makeOccurrenceCounter()
  return missing.map((line) => {
    const sk = stableKey({
      date: line.datePosted,
      signedAmount: line.signedAmount,
      memo: line.memo,
    })
    return buildLineDedupHash(sk, importId, nextOcc(sk))
  })
}

// 3 TARIFA PIX COMPRA idênticas (mesma data, valor e memo) — caso real Banrisul.
const tresIdenticas: StatementLine[] = [
  { datePosted: D('2026-07-10'), signedAmount: -12.5, memo: 'TARIFA PIX COMPRA' },
  { datePosted: D('2026-07-10'), signedAmount: -12.5, memo: 'TARIFA PIX COMPRA' },
  { datePosted: D('2026-07-10'), signedAmount: -12.5, memo: 'TARIFA PIX COMPRA' },
]

describe('BUG A — N linhas idênticas ⇒ N transações (nenhuma descartada)', () => {
  it('6.1-A: 3 idênticas contra conta VAZIA ⇒ 3 missing e 3 dedupHash DISTINTOS', () => {
    const r = reconcileStatement(tresIdenticas, [], dtAsOf)
    expect(r.missing).toHaveLength(3) // reconcile diz: são 3 novas
    const hashes = dedupHashesForMissing(r.missing, 'imp-1')
    expect(new Set(hashes).size).toBe(3) // @@unique satisfeita: nenhuma colide
  })

  it('6.1-B: re-import do MESMO extrato (3 já no banco) ⇒ 0 novas', () => {
    const dbs: DbBankTransaction[] = [
      dbTx({ id: 'a', date: D('2026-07-10'), signedAmount: -12.5, memo: 'TARIFA PIX COMPRA' }),
      dbTx({ id: 'b', date: D('2026-07-10'), signedAmount: -12.5, memo: 'TARIFA PIX COMPRA' }),
      dbTx({ id: 'c', date: D('2026-07-10'), signedAmount: -12.5, memo: 'TARIFA PIX COMPRA' }),
    ]
    const r = reconcileStatement(tresIdenticas, dbs, dtAsOf)
    expect(r.matched).toHaveLength(3)
    expect(r.missing).toHaveLength(0)
  })

  it('6.1-C: re-import com FITID DIFERENTE (Banrisul recicla) ⇒ 0 novas — PROTEGE a remoção do fitid', () => {
    const dbs: DbBankTransaction[] = [
      dbTx({ id: 'a', date: D('2026-07-10'), signedAmount: -12.5, memo: 'TARIFA PIX COMPRA', fitid: '000001' }),
      dbTx({ id: 'b', date: D('2026-07-10'), signedAmount: -12.5, memo: 'TARIFA PIX COMPRA', fitid: '000002' }),
      dbTx({ id: 'c', date: D('2026-07-10'), signedAmount: -12.5, memo: 'TARIFA PIX COMPRA', fitid: '000003' }),
    ]
    // Extrato novo: MESMA data/valor/memo, FITIDs trocados
    const stmtNovosFitids: StatementLine[] = tresIdenticas.map((l, i) => ({ ...l, fitid: `999${i}` }))
    const r = reconcileStatement(stmtNovosFitids, dbs, dtAsOf)
    expect(r.matched).toHaveLength(3)
    expect(r.missing).toHaveLength(0)
  })

  it('6.1-D: parcial — 3 no arquivo, 1 já no banco ⇒ 2 novas, 2 dedupHash distintos', () => {
    const dbs: DbBankTransaction[] = [
      dbTx({ id: 'a', date: D('2026-07-10'), signedAmount: -12.5, memo: 'TARIFA PIX COMPRA' }),
    ]
    const r = reconcileStatement(tresIdenticas, dbs, dtAsOf)
    expect(r.matched).toHaveLength(1)
    expect(r.missing).toHaveLength(2)
    expect(new Set(dedupHashesForMissing(r.missing, 'imp-2')).size).toBe(2)
  })
})

// ─────────────────────────────────────────────────────────────────────────
// BUG B (07/08) — duplicata PREVIEW↔REAL entre imports.
// Causa: reconcileStatement recebia só tx EFFECTED. Uma linha REAL que casava
// com uma PREVIEW (PAYABLE/RECEIVABLE) criada por outro import virava `missing`
// e era RECRIADA → duplicata. Fix: pending entram no universo e o match vira
// `promoted` (o caller promove lifecycle→EFFECTED em vez de recriar).
// Estes testes ficam VERMELHOS no código pré-fix: `promoted` não existia e uma
// PAYABLE sobrando caía em `orphans`.
describe('BUG B — preview↔real: promove, não duplica', () => {
  const realLine: StatementLine[] = [
    { datePosted: D('2026-07-27'), signedAmount: -4092.02, memo: 'EMPRESTIMO PARCELA', fitid: 'REAL27' },
  ]

  it('B.1: linha real casa com PAYABLE existente ⇒ promoted=1, missing=0 (não recria)', () => {
    const dbs: DbBankTransaction[] = [
      dbTx({ id: 'pay', date: D('2026-07-27'), signedAmount: -4092.02, memo: 'EMPRESTIMO PARCELA', lifecycle: 'PAYABLE' }),
    ]
    const r = reconcileStatement(realLine, dbs, dtAsOf)
    expect(r.missing).toHaveLength(0) // NÃO recria → não duplica
    expect(r.matched).toHaveLength(1)
    expect(r.promoted).toHaveLength(1)
    expect(r.promoted[0].dbTx.id).toBe('pay')
  })

  it('B.2: linha real casa com RECEIVABLE ⇒ promoted (crédito)', () => {
    const credit: StatementLine[] = [
      { datePosted: D('2026-07-27'), signedAmount: 700, memo: 'RECEBIMENTO', fitid: 'REALC' },
    ]
    const dbs: DbBankTransaction[] = [
      dbTx({ id: 'rec', date: D('2026-07-27'), signedAmount: 700, memo: 'RECEBIMENTO', lifecycle: 'RECEIVABLE' }),
    ]
    const r = reconcileStatement(credit, dbs, dtAsOf)
    expect(r.missing).toHaveLength(0)
    expect(r.promoted.map((m) => m.dbTx.id)).toEqual(['rec'])
  })

  it('B.3: match com EFFECTED NÃO entra em promoted (já materializada)', () => {
    const dbs: DbBankTransaction[] = [
      dbTx({ id: 'eff', date: D('2026-07-27'), signedAmount: -4092.02, memo: 'EMPRESTIMO PARCELA', lifecycle: 'EFFECTED' }),
    ]
    const r = reconcileStatement(realLine, dbs, dtAsOf)
    expect(r.matched).toHaveLength(1)
    expect(r.promoted).toHaveLength(0)
  })

  it('B.4: PAYABLE que sobrou (nenhuma linha real casou) NÃO vira órfão/fantasma', () => {
    const dbs: DbBankTransaction[] = [
      dbTx({ id: 'futuro', date: D('2026-07-28'), signedAmount: -999, memo: 'AGENDADO FUTURO', lifecycle: 'PAYABLE' }),
    ]
    // extrato sem essa linha → antes do fix a PAYABLE cairia em orphans (warning falso)
    const r = reconcileStatement(realLine, dbs, dtAsOf)
    expect(r.orphans).toHaveLength(0)
  })

  it('B.5: EFFECTED que sumiu do extrato CONTINUA sendo órfão (fantasma real)', () => {
    const dbs: DbBankTransaction[] = [
      dbTx({ id: 'fantasma', date: D('2026-07-20'), signedAmount: -55, memo: 'SUMIU DO EXTRATO', lifecycle: 'EFFECTED' }),
    ]
    const r = reconcileStatement(realLine, dbs, dtAsOf)
    expect(r.orphans.map((o) => o.id)).toEqual(['fantasma'])
  })
})

describe('line-dedup-hash — helper', () => {
  const sk = '2026-07-10|-12.50|tarifa pix compra'

  it('mesma stableKey no mesmo batch ⇒ ocorrências 0,1,2 ⇒ 3 valores distintos', () => {
    const occ = makeOccurrenceCounter()
    const vals = [buildLineDedupHash(sk, 'imp', occ(sk)), buildLineDedupHash(sk, 'imp', occ(sk)), buildLineDedupHash(sk, 'imp', occ(sk))]
    expect(new Set(vals).size).toBe(3)
  })

  it('batches diferentes nunca colidem (namespace por importId)', () => {
    expect(buildLineDedupHash(sk, 'imp-A', 0)).not.toBe(buildLineDedupHash(sk, 'imp-B', 0))
  })

  it('valor de LINHA nunca é igual ao stableKey puro (não colide com linhas antigas)', () => {
    expect(buildLineDedupHash(sk, 'imp', 0)).not.toBe(sk)
  })
})
