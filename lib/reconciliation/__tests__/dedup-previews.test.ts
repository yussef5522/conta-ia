import { describe, it, expect } from 'vitest'
import { dedupPreviewsAgainstDbPending } from '../dedup-previews'
import type { StatementLine } from '../types'

const D = (s: string) => new Date(`${s}T12:00:00Z`)

describe('dedupPreviewsAgainstDbPending', () => {
  it('reimport com preview que já existe como PAYABLE → 0 duplicata criada', () => {
    // Caso real: agendado 15/06 PAGAMENTO CARTAO já foi inserido como PAYABLE
    // num import anterior; re-import do mesmo arquivo (ou arquivo de período
    // sobreposto) NÃO deve recriar.
    const dbPending = [
      { id: 'tx-pgto-existente', date: D('2026-06-15'), signedAmount: -2654.63, memo: 'PAGAMENTO CARTAO DE CREDITO' },
    ]
    const previews: StatementLine[] = [
      { datePosted: D('2026-06-15'), signedAmount: -2654.63, memo: 'PAGAMENTO CARTAO DE CREDITO', fitid: '100048' },
    ]
    const r = dedupPreviewsAgainstDbPending(previews, dbPending)
    expect(r.toCreate).toHaveLength(0)
    expect(r.alreadyExisting).toHaveLength(1)
    expect(r.alreadyExisting[0].dbTxId).toBe('tx-pgto-existente')
  })

  it('preview NOVA (nenhuma PAYABLE correspondente) → vai pra toCreate', () => {
    const previews: StatementLine[] = [
      { datePosted: D('2026-06-15'), signedAmount: -2654.63, memo: 'PAGAMENTO CARTAO DE CREDITO', fitid: '100048' },
    ]
    const r = dedupPreviewsAgainstDbPending(previews, [])
    expect(r.toCreate).toHaveLength(1)
    expect(r.alreadyExisting).toHaveLength(0)
  })

  it('Multiset: extrato traz 2 previews iguais, DB tem só 1 PAYABLE → 1 já existe + 1 nova', () => {
    const dbPending = [
      { id: 'tx-1', date: D('2026-06-15'), signedAmount: -100, memo: 'TARIFA PROGRAMADA' },
    ]
    const previews: StatementLine[] = [
      { datePosted: D('2026-06-15'), signedAmount: -100, memo: 'TARIFA PROGRAMADA', fitid: 'aaa' },
      { datePosted: D('2026-06-15'), signedAmount: -100, memo: 'TARIFA PROGRAMADA', fitid: 'bbb' },
    ]
    const r = dedupPreviewsAgainstDbPending(previews, dbPending)
    expect(r.toCreate).toHaveLength(1)
    expect(r.alreadyExisting).toHaveLength(1)
  })

  it('Memo case/whitespace diverge mas stableKey iguala → casa', () => {
    const dbPending = [
      { id: 'tx-old', date: D('2026-06-15'), signedAmount: -2654.63, memo: '  PAGAMENTO   CARTAO   DE  CREDITO  ' },
    ]
    const previews: StatementLine[] = [
      { datePosted: D('2026-06-15'), signedAmount: -2654.63, memo: 'pagamento cartao de credito', fitid: '100048' },
    ]
    const r = dedupPreviewsAgainstDbPending(previews, dbPending)
    expect(r.alreadyExisting).toHaveLength(1)
    expect(r.toCreate).toHaveLength(0)
  })

  it('Banco TROCA memo entre exports (caso real Banrisul agendado 15/06): Tier 2 FUZZY casa', () => {
    // DB tem o agendado com memo antigo "DEBITO CARTAO DE CREDITO" (export anterior)
    const dbPending = [
      { id: 'tx-agendado', date: D('2026-06-15'), signedAmount: -2654.63, memo: 'DEBITO CARTAO DE CREDITO' },
    ]
    // Extrato novo traz a MESMA linha com memo diferente "PAGAMENTO CARTAO DE CREDITO"
    const previews: StatementLine[] = [
      { datePosted: D('2026-06-15'), signedAmount: -2654.63, memo: 'PAGAMENTO CARTAO DE CREDITO', fitid: '100048' },
    ]
    const r = dedupPreviewsAgainstDbPending(previews, dbPending)
    expect(r.toCreate).toHaveLength(0) // NÃO duplica
    expect(r.alreadyExisting).toHaveLength(1)
    expect(r.alreadyExisting[0].confidence).toBe('FUZZY')
    expect(r.alreadyExisting[0].dbTxId).toBe('tx-agendado')
  })

  it('Tier 1 tem prioridade: 2 PAYABLE com mesma data/valor mas memos diferentes; 2 previews uma exata + uma fuzzy → casam corretamente', () => {
    const dbPending = [
      { id: 'tx-pagamento', date: D('2026-06-15'), signedAmount: -100, memo: 'PAGAMENTO X' },
      { id: 'tx-debito', date: D('2026-06-15'), signedAmount: -100, memo: 'DEBITO X' },
    ]
    const previews: StatementLine[] = [
      { datePosted: D('2026-06-15'), signedAmount: -100, memo: 'PAGAMENTO X', fitid: 'aaa' }, // Tier 1: bate com pagamento
      { datePosted: D('2026-06-15'), signedAmount: -100, memo: 'NOVO Y', fitid: 'bbb' },     // Tier 2: cai no debito
    ]
    const r = dedupPreviewsAgainstDbPending(previews, dbPending)
    expect(r.toCreate).toHaveLength(0)
    expect(r.alreadyExisting).toHaveLength(2)
    const exact = r.alreadyExisting.find(m => m.confidence === 'EXACT')!
    const fuzzy = r.alreadyExisting.find(m => m.confidence === 'FUZZY')!
    expect(exact.dbTxId).toBe('tx-pagamento')
    expect(fuzzy.dbTxId).toBe('tx-debito') // consumed.has tx-pagamento bloqueia recasamento
  })

  it('signed diferente NÃO casa (segurança)', () => {
    const dbPending = [
      { id: 'tx-positivo', date: D('2026-06-15'), signedAmount: 2654.63, memo: 'PAGAMENTO CARTAO DE CREDITO' },
    ]
    const previews: StatementLine[] = [
      { datePosted: D('2026-06-15'), signedAmount: -2654.63, memo: 'PAGAMENTO CARTAO DE CREDITO', fitid: '100048' },
    ]
    const r = dedupPreviewsAgainstDbPending(previews, dbPending)
    expect(r.alreadyExisting).toHaveLength(0)
    expect(r.toCreate).toHaveLength(1)
  })
})
