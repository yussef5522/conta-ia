// Sprint Dropdown-não-trava (08/08) — Regra 1. Antes do fix, a linha detectada
// como empréstimo REMOVIA o dropdown de categoria e travava o usuário. Estes
// testes ficam VERMELHOS no código pré-fix (a função não existia / a regra era
// "esconde quando det"). Verde depois: categoria SEMPRE disponível.

import { describe, it, expect } from 'vitest'
import { pendenteRowActions } from '../row-actions'

describe('pendenteRowActions — detecção de empréstimo NÃO remove a categoria', () => {
  // 3.1 + 3.2 — um por kind: os três com dropdown disponível.
  it('CONTRACT: mostra vincular E mantém o dropdown de categoria', () => {
    const r = pendenteRowActions({ kind: 'CONTRACT' })
    expect(r.loanAction).toBe('CONTRACT')
    expect(r.showCategoryDropdown).toBe(true)
  })

  it('CANDIDATES: mostra candidatos E mantém o dropdown', () => {
    const r = pendenteRowActions({ kind: 'CANDIDATES' })
    expect(r.loanAction).toBe('CANDIDATES')
    expect(r.showCategoryDropdown).toBe(true)
  })

  it('NOT_REGISTERED (o pior caso): oferece cadastrar E mantém o dropdown', () => {
    const r = pendenteRowActions({ kind: 'NOT_REGISTERED' })
    expect(r.loanAction).toBe('NOT_REGISTERED')
    expect(r.showCategoryDropdown).toBe(true)
  })

  // 3.3 — sem detecção continua idêntico: sem ação de empréstimo, dropdown normal.
  it('sem detecção: nenhuma ação de empréstimo, dropdown normal', () => {
    const r = pendenteRowActions(null)
    expect(r.loanAction).toBeNull()
    expect(r.showCategoryDropdown).toBe(true)
    expect(pendenteRowActions(undefined).loanAction).toBeNull()
  })

  it('INVARIANTE: showCategoryDropdown é true para TODO kind (nunca esconde a saída)', () => {
    for (const kind of ['CONTRACT', 'CANDIDATES', 'NOT_REGISTERED'] as const) {
      expect(pendenteRowActions({ kind }).showCategoryDropdown).toBe(true)
    }
  })
})
