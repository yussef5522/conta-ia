// Sprint Cartao-A-Classificar — REGRA 3: a categoria-fila NÃO é aprendida (senão
// vira o próximo "EQUIPAMENTOS" catch-all). Executa o guard.

import { describe, it, expect } from 'vitest'
import { isCategoryLearnable } from '../is-learnable'

// db falso: só o category.findUnique importa.
const db = (dreGroup: string | null) =>
  ({ category: { findUnique: async () => ({ dreGroup }) } }) as unknown as Parameters<typeof isCategoryLearnable>[0]

describe('isCategoryLearnable', () => {
  it('A_CLASSIFICAR (fila) → NÃO aprende', async () => {
    expect(await isCategoryLearnable(db('A_CLASSIFICAR'), 'c1')).toBe(false)
  })
  it('categoria contábil de verdade → aprende', async () => {
    expect(await isCategoryLearnable(db('DESPESAS_ADMINISTRATIVAS'), 'c1')).toBe(true)
    expect(await isCategoryLearnable(db('RECEITA_BRUTA'), 'c1')).toBe(true)
    expect(await isCategoryLearnable(db(null), 'c1')).toBe(true)
  })
  it('sem categoria → não aprende (nada a aprender)', async () => {
    expect(await isCategoryLearnable(db('X'), null)).toBe(false)
  })
})
