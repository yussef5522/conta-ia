// #8 (07/08) — helper CENTRAL de descarte de futuro. Um lugar só que todos usam.
// No código pré-helper a função não existia → import falha = VERMELHO.

import { describe, it, expect } from 'vitest'
import { partitionFutureLines } from '../future-line'

const D = (s: string) => new Date(`${s}T12:00:00Z`)
const hoje = D('2026-08-07')
const dtAsOf = D('2026-08-07')

const linha = (day: string, fitid?: string) => ({ datePosted: D(day), fitid, signedAmount: -1, memo: 'X' })

describe('partitionFutureLines — separa real vs futuro (fonte única)', () => {
  it('futuras (>DTASOF e >hoje) saem; reais ficam', () => {
    const lines = [linha('2026-08-05'), linha('2026-08-10'), linha('2026-08-17')]
    const { realLines, futureLines } = partitionFutureLines(lines, dtAsOf, hoje)
    expect(realLines.map((l) => l.datePosted.toISOString().slice(0, 10))).toEqual(['2026-08-05'])
    expect(futureLines).toHaveLength(2)
  })

  it('data entre DTASOF-curto e hoje NÃO é descartada (protege real)', () => {
    const { realLines, futureLines } = partitionFutureLines([linha('2026-08-06')], D('2026-08-05'), hoje)
    expect(realLines).toHaveLength(1)
    expect(futureLines).toHaveLength(0)
  })

  it('FITID YYMMDD (preview Banrisul) vai pra futuras mesmo com data passada', () => {
    const { futureLines } = partitionFutureLines([linha('2026-08-05', '260805')], dtAsOf, hoje)
    expect(futureLines).toHaveLength(1)
  })

  it('tudo real → futureLines vazio (caminho comum não quebra)', () => {
    const { realLines, futureLines } = partitionFutureLines([linha('2026-08-01'), linha('2026-08-07')], dtAsOf, hoje)
    expect(realLines).toHaveLength(2)
    expect(futureLines).toHaveLength(0)
  })
})
