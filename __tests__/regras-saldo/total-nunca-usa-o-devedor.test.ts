// ⛔⛔ GUARD ESTRUTURAL — o Saldo Total soma o CONTÁBIL, nunca o devedor (05/09/2026).
//
// A troca do destaque é **só apresentação** (decisão do dono). O risco de um dia alguém
// "uniformizar" e passar a somar `destaque.valor` é real — e o efeito seria o **Saldo Total
// dançando com o bloqueio de cada banco**, sem lançamento nenhum por trás. R$ 1.700 a menos
// no total da Caçula, por exemplo, sem nada tendo acontecido.
//
// ⚠️ ESTRUTURAL E ASSUMIDO COMO TAL: o comportamento está em
// `lib/balance/__tests__/destaque-do-card.test.ts` (função pura). Aqui se trava o que o
// componente NÃO pode fazer — e o projeto não tem jsdom pra renderizar.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const RAIZ = join(__dirname, '..', '..')
const pagina = readFileSync(join(RAIZ, 'app/(dashboard)/empresas/[id]/contas/page.tsx'), 'utf8')

/** ⭐ a linha proibida: somar o destaque em vez do contábil */
export function somaODestaque(conteudo: string): boolean {
  return /reduce\([^)]*destaque/.test(conteudo) || /\+\s*c\.destaque/.test(conteudo)
}

describe('⛔ o Saldo Total nunca soma o devedor', () => {
  it('⛔⛔ o total continua somando `balance` (o contábil)', () => {
    expect(pagina).toMatch(/const saldoTotal = .*reduce\(\(s, c\) => s \+ c\.balance, 0\)/)
    expect(somaODestaque(pagina), 'o total passou a somar o destaque — dança com o bloqueio').toBe(false)
  })

  it('⭐ e o card individual USA o destaque no número grande (senão a mudança não existe)', () => {
    expect(pagina).toMatch(/conta\.destaque\?\.valor \?\? conta\.balance/)
  })

  it('⭐ AUTO-TESTE do detector — senão ele passaria verde por cegueira', () => {
    expect(somaODestaque('const t = contas.reduce((s, c) => s + c.destaque.valor, 0)')).toBe(true)
    expect(somaODestaque('const t = x + c.destaque!.valor')).toBe(true)
    expect(somaODestaque('const t = contas.reduce((s, c) => s + c.balance, 0)')).toBe(false)
    // ⚠️ e não morde o USO legítimo do destaque no card
    expect(somaODestaque('{formatBRL(conta.destaque?.valor ?? conta.balance)}')).toBe(false)
  })
})
