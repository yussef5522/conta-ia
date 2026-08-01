import { describe, it, expect } from 'vitest'
import { buildEnrichmentPreview, headerMatchesAccount, type EnrichTx } from '../build-preview'
import type { ParsedBankStatement } from '@/lib/bank-statement-pdf/types'

const line = (documento: string, amount: number, counterpartyName: string | null, day = 1) => ({
  day, historico: 'PIX', documento, amount, signed: -amount, counterpartyName,
})
const tx = (id: string, externalId: string | null, amount: number, over: Partial<EnrichTx> = {}): EnrichTx => ({
  id, externalId, amount, date: new Date('2026-07-06T12:00:00Z'), description: 'PIX ENVIADO', type: 'DEBIT',
  counterpartyName: null, counterpartySource: null, ...over,
})
const parsed = (lines: ReturnType<typeof line>[]): ParsedBankStatement => ({
  header: { agencia: '0230', conta: '0606342204', titular: 'PRO FIT ITAQUI LTDA' }, lines,
})

describe('headerMatchesAccount (FASE 1.3a — rejeita PDF de outra conta)', () => {
  it('bate agência+conta (ignora formatação)', () => {
    expect(headerMatchesAccount({ agencia: '0230', conta: '0606342204' }, { agency: '0230', accountNumber: '06.063.422-04' })).toBe(true)
  })
  it('agência diferente → NÃO bate', () => {
    expect(headerMatchesAccount({ agencia: '0230', conta: '0606342204' }, { agency: '0523', accountNumber: '0606342204' })).toBe(false)
  })
  it('conta diferente → NÃO bate', () => {
    expect(headerMatchesAccount({ agencia: '0230', conta: '0606342204' }, { agency: '0230', accountNumber: '0605534106' })).toBe(false)
  })
})

describe('buildEnrichmentPreview', () => {
  it('EXACT enriquecido com detalhes da tx', () => {
    const p = buildEnrichmentPreview(parsed([line('198074', 1215, 'MARCOS ADRIEL')]), [tx('t1', '198074', 1215)])
    expect(p.counts.exact).toBe(1)
    expect(p.exact[0]).toMatchObject({ txId: 't1', proposedName: 'MARCOS ADRIEL', currentName: null })
  })
  it('AMBIGUOUS agrupado, nenhum em exact', () => {
    const p = buildEnrichmentPreview(
      parsed([line('000000', 139.9, 'FULANO', 9), line('000000', 139.9, 'BELTRANO', 10)]),
      [tx('a', '000000', 139.9), tx('b', '000000', 139.9)],
    )
    expect(p.counts.exact).toBe(0)
    expect(p.ambiguous).toHaveLength(1)
    expect(p.ambiguous[0].candidateNames.sort()).toEqual(['BELTRANO', 'FULANO'])
    expect(p.ambiguous[0].txs).toHaveLength(2)
  })
  it('MANUAL protegido não vira exact', () => {
    const p = buildEnrichmentPreview(parsed([line('198074', 1215, 'MARCOS')]), [tx('t1', '198074', 1215, { counterpartySource: 'MANUAL' })])
    expect(p.counts.exact).toBe(0)
    expect(p.counts.manualProtected).toBe(1)
  })
})
