// #8 (07/08) — helper CENTRAL de descarte de futuro. Um lugar só que todos usam.
// No código pré-helper a função não existia → import falha = VERMELHO.

import { describe, it, expect } from 'vitest'
import { partitionFutureLines } from '../future-line'

const D = (s: string) => new Date(`${s}T12:00:00Z`)
const hoje = D('2026-08-07')
const dtAsOf = D('2026-08-07')

const linha = (day: string, fitid?: string) => ({ datePosted: D(day), fitid, signedAmount: -1, memo: 'X' })

describe('partitionFutureLines — separa real vs futuro (fonte única)', () => {
  it('futuras (> âncora) saem; reais ficam — independente de `hoje`', () => {
    const lines = [linha('2026-08-05'), linha('2026-08-10'), linha('2026-08-17')]
    // âncora=07/08; `hoje` variado (inclusive DEPOIS das agendadas) não muda nada
    for (const now of [hoje, D('2026-08-11'), D('2026-08-20')]) {
      const { realLines, futureLines } = partitionFutureLines(lines, dtAsOf, now)
      expect(realLines.map((l) => l.datePosted.toISOString().slice(0, 10))).toEqual(['2026-08-05'])
      expect(futureLines).toHaveLength(2)
    }
  })

  it('data <= âncora NÃO é descartada (protege real; âncora=max(DTASOF,DTEND))', () => {
    // O caller passa a âncora = max(DTASOF curto, DTEND real) = 06/08 → 06/08 é real.
    const { realLines, futureLines } = partitionFutureLines([linha('2026-08-06')], D('2026-08-06'), hoje)
    expect(realLines).toHaveLength(1)
    expect(futureLines).toHaveLength(0)
  })

  // ⛔ REGRA DERRUBADA POR EVIDÊNCIA (28/08/2026). Antes este teste afirmava que FITID
  // YYMMDD tornava a linha FUTURA mesmo com data passada. A regra escondeu DÉBITO REAL de
  // empréstimo duas vezes (4.092,02 em 13/08 · 2.444,62 em 28/08) e nas duas o saldo
  // declarado pelo banco provou que a linha tinha liquidado. Todo FITID do Banrisul tem 6
  // dígitos e o banco usa a DATA como id nas linhas de empréstimo: é convenção de
  // IDENTIFICADOR, não estado do lançamento. Quem decide é o SALDO.
  // Detalhe do incidente em lib/ofx/__tests__/fitid-nao-descarta-emprestimo.test.ts.
  it('FITID YYMMDD com data passada fica em REAIS (não vai mais pra futuras)', () => {
    const { realLines, futureLines } = partitionFutureLines([linha('2026-08-05', '260805')], dtAsOf, hoje)
    expect(realLines).toHaveLength(1)
    expect(futureLines).toHaveLength(0)
  })

  it('tudo real → futureLines vazio (caminho comum não quebra)', () => {
    const { realLines, futureLines } = partitionFutureLines([linha('2026-08-01'), linha('2026-08-07')], dtAsOf, hoje)
    expect(realLines).toHaveLength(2)
    expect(futureLines).toHaveLength(0)
  })
})
