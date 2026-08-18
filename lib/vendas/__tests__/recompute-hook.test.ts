import { describe, it, expect } from 'vitest'
import { recomputeVendasSafe, algumaEhVenda, recomputeVendasSeVenda } from '../recompute-hook'

// Mock de db que registra se o recompute REALMENTE rodou (vendaDiaria.deleteMany).
function makeDb(opts: { perfil?: boolean; vendaCount?: number; explode?: boolean }) {
  const calls = { recomputeRodou: false }
  const db: any = {
    regraRecebimento: {
      findFirst: async () => (opts.perfil === false ? null : { vigenteDe: new Date('2026-08-12T00:00:00Z') }),
      findMany: async () => {
        if (opts.explode) throw new Error('boom no recompute')
        return [{ bankAccountId: 'A', meio: 'PIX', diasUteisAtraso: 1, recebeSabDom: false, vigenteDe: new Date('2026-08-12'), vigenteAte: null, origemHint: null, confirmadoPeloDono: true }]
      },
    },
    category: {
      count: async () => opts.vendaCount ?? 0,
      findMany: async () => [],
    },
    transaction: { findMany: async () => [] },
    vendaDiaria: {
      deleteMany: async () => { calls.recomputeRodou = true; return { count: 0 } },
      create: async () => ({}),
    },
  }
  return { db, calls }
}

describe('recompute-hook — fail-soft + gating por venda', () => {
  it('FAIL-SOFT: se o recompute explode, NÃO propaga (o import não trava)', async () => {
    const { db } = makeDb({ perfil: true, explode: true })
    await expect(recomputeVendasSafe(db, 'co')).resolves.toBeUndefined() // não lança
  })

  it('empresa SEM perfil → no-op (não roda recompute)', async () => {
    const { db, calls } = makeDb({ perfil: false })
    await recomputeVendasSafe(db, 'co')
    expect(calls.recomputeRodou).toBe(false)
  })

  it('algumaEhVenda: RECEITA_BRUTA presente → true; nenhuma → false; vazio → false', async () => {
    expect(await algumaEhVenda(makeDb({ vendaCount: 1 }).db, ['c1'])).toBe(true)
    expect(await algumaEhVenda(makeDb({ vendaCount: 0 }).db, ['c1'])).toBe(false)
    expect(await algumaEhVenda(makeDb({ vendaCount: 5 }).db, [null, undefined])).toBe(false)
  })

  it('recomputeVendasSeVenda: categoria NÃO-venda → recompute NÃO roda (evita à toa)', async () => {
    const { db, calls } = makeDb({ perfil: true, vendaCount: 0 })
    await recomputeVendasSeVenda(db, 'co', ['cat-despesa'])
    expect(calls.recomputeRodou).toBe(false)
  })

  it('recomputeVendasSeVenda: categoria de VENDA → recompute roda', async () => {
    const { db, calls } = makeDb({ perfil: true, vendaCount: 1 })
    await recomputeVendasSeVenda(db, 'co', ['cat-venda'])
    expect(calls.recomputeRodou).toBe(true)
  })
})
