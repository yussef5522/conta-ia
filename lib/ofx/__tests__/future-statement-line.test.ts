// FASE 2.5 (07/08) — critério de DESCARTE de movimento futuro.
// Conservador (AND): só descarta se data > DTASOF **E** data > fim de hoje (BRT).
// Assim um DTASOF curto/estranho sozinho não descarta movimento real do dia.
// No código pré-fix a função não existia → import falha = VERMELHO.

import { describe, it, expect } from 'vitest'
import { isFutureStatementLine } from '../future-line'

const D = (s: string) => new Date(`${s}T12:00:00Z`)
const hoje = D('2026-08-07')
const dtAsOf = D('2026-08-07')

describe('isFutureStatementLine — descarte conservador (AND)', () => {
  it('data > DTASOF E > hoje → FUTURA (descarta): caso Banrisul 17/08', () => {
    expect(isFutureStatementLine(D('2026-08-17'), dtAsOf, false, hoje)).toBe(true)
  })

  it('data > DTASOF mas <= hoje → NÃO futura (protege DTEND curto/estranho)', () => {
    // Banco manda DTASOF 05/08, mas a linha 06/08 é movimento REAL (hoje=07/08)
    expect(isFutureStatementLine(D('2026-08-06'), D('2026-08-05'), false, hoje)).toBe(false)
  })

  it('data <= DTASOF → NÃO futura', () => {
    expect(isFutureStatementLine(D('2026-08-05'), dtAsOf, false, hoje)).toBe(false)
  })

  it('DTASOF no FUTURO (Sicredi 31/08) não descarta linha real de 15/08', () => {
    // futuroPorData exige data > DTASOF(31/08); 15/08 não é > 31/08 → mantém
    expect(isFutureStatementLine(D('2026-08-15'), D('2026-08-31'), false, hoje)).toBe(false)
  })

  it('FITID YYMMDD (preview interno Banrisul) → futura mesmo com data passada', () => {
    expect(isFutureStatementLine(D('2026-08-05'), dtAsOf, true, hoje)).toBe(true)
  })
})
