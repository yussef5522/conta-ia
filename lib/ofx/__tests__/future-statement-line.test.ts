// FASE 2.5 (07/08) + fix âncora (09/08) — critério de DESCARTE de movimento futuro.
// Âncora = max(DTASOF, DTEND) = "liquidado até aqui" do extrato. NOW-INDEPENDENTE:
// o critério antigo era `> DTASOF E > hoje (BRT)` e o `&& > hoje` deixava a linha
// agendada de +1 passar quando o extrato era importado no dia seguinte (bug real
// Extrato_20260809). max(DTASOF,DTEND) resolve os DOIS erros opostos (ver
// settledThroughDate): DTASOF curto não descarta real; import tardio não deixa
// agendada passar.

import { describe, it, expect } from 'vitest'
import { isFutureStatementLine, settledThroughDate } from '../future-line'

const D = (s: string) => new Date(`${s}T12:00:00Z`)

describe('isFutureStatementLine — âncora = max(DTASOF, DTEND), now-independente', () => {
  it('data > âncora → FUTURA (agendada): Banrisul 17/08 com âncora 09/08', () => {
    expect(isFutureStatementLine(D('2026-08-17'), D('2026-08-09'), false)).toBe(true)
  })

  it('data <= âncora → NÃO futura (real dentro do período)', () => {
    expect(isFutureStatementLine(D('2026-08-06'), D('2026-08-06'), false)).toBe(false)
  })

  it('NOW não afeta (bug 09/08→10/08): 10/08 com âncora 09/08 é futura em QUALQUER dia de import', () => {
    for (const now of [D('2026-08-09'), D('2026-08-10'), D('2026-08-20')]) {
      expect(isFutureStatementLine(D('2026-08-10'), D('2026-08-09'), false, now)).toBe(true)
    }
  })

  it('data anterior à âncora → NÃO futura', () => {
    expect(isFutureStatementLine(D('2026-08-05'), D('2026-08-09'), false)).toBe(false)
  })

  it('FITID YYMMDD (preview interno Banrisul) → futura mesmo com data passada', () => {
    expect(isFutureStatementLine(D('2026-08-05'), D('2026-08-09'), true)).toBe(true)
  })
})

describe('settledThroughDate — max(DTASOF, DTEND) protege real de DTASOF curto', () => {
  it('DTASOF curto (05/08) + DTEND real (06/08) → âncora 06/08 (não descarta 06/08 real)', () => {
    const anchor = settledThroughDate(D('2026-08-05'), D('2026-08-06'))!
    expect(anchor.toISOString().slice(0, 10)).toBe('2026-08-06')
    expect(isFutureStatementLine(D('2026-08-06'), anchor, false)).toBe(false) // real, mantém
    expect(isFutureStatementLine(D('2026-08-07'), anchor, false)).toBe(true) // > período, agendada
  })

  it('DTASOF futuro (31/08) > DTEND (15/08) → âncora 31/08', () => {
    expect(settledThroughDate(D('2026-08-31'), D('2026-08-15'))!.toISOString().slice(0, 10)).toBe(
      '2026-08-31',
    )
  })

  it('só um presente usa o presente; nenhum → null', () => {
    expect(settledThroughDate(D('2026-08-09'), null)!.toISOString().slice(0, 10)).toBe('2026-08-09')
    expect(settledThroughDate(null, D('2026-08-09'))!.toISOString().slice(0, 10)).toBe('2026-08-09')
    expect(settledThroughDate(null, null)).toBeNull()
  })
})
