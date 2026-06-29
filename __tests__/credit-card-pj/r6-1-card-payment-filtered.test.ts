// Sprint Cartao PJ R6.1 — verifica que TODOS os 5 endpoints que listam
// pendencias/categorias agora excluem isCardPayment=true (pagamento casado).
//
// Tests de "presenca da linha" no codigo (defensivos a regressao do filtro).

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const root = (p: string) => join(__dirname, '..', '..', p)

// Sprint Fundação Status (28/06/2026): isCardPayment=false agora vem do
// NEEDS_REVIEW_WHERE_PRISMA (fonte única). Aceita literal OU spread.
function temFiltroCardPayment(code: string): boolean {
  const literal = /isCardPayment:\s*false/.test(code)
  const fonteUnica =
    /\.\.\.NEEDS_REVIEW_WHERE_PRISMA/.test(code) ||
    /Object\.assign\(where,\s*NEEDS_REVIEW_WHERE_PRISMA\)/.test(code)
  return literal || fonteUnica
}

describe('Sprint R6.1 — isCardPayment filtrado em endpoints de pendencias', () => {
  it('1) /api/conciliacao/ofx-pendentes exclui isCardPayment', () => {
    const code = readFileSync(
      root('app/api/conciliacao/ofx-pendentes/route.ts'),
      'utf-8',
    )
    expect(temFiltroCardPayment(code)).toBe(true)
  })

  it('2) /api/transacoes (semCategoria=true) exclui isCardPayment', () => {
    const code = readFileSync(root('app/api/transacoes/route.ts'), 'utf-8')
    expect(code).toMatch(/semCategoria/)
    expect(temFiltroCardPayment(code)).toBe(true)
  })

  it('3) /api/conciliacao/bulk-dry-run exclui isCardPayment', () => {
    const code = readFileSync(
      root('app/api/conciliacao/bulk-dry-run/route.ts'),
      'utf-8',
    )
    expect(temFiltroCardPayment(code)).toBe(true)
  })

  it('4) /api/dashboard/badges exclui isCardPayment (em AMBAS as 2 counts)', () => {
    const code = readFileSync(root('app/api/dashboard/badges/route.ts'), 'utf-8')
    const spreads = code.match(/\.\.\.NEEDS_REVIEW_WHERE_PRISMA/g) ?? []
    const literais = code.match(/isCardPayment:\s*false/g) ?? []
    expect(spreads.length + literais.length).toBeGreaterThanOrEqual(2)
  })

  it('5) /api/empresas/[id]/relatorios/drill-down/transacoes exclui isCardPayment', () => {
    const code = readFileSync(
      root('app/api/empresas/[id]/relatorios/drill-down/transacoes/route.ts'),
      'utf-8',
    )
    // Drill-down não migrou pra fonte única (lista tx de categoria).
    expect(code).toMatch(/isCardPayment:\s*false/)
  })
})

// ============================================================================
// Sanity check: telas legitimas onde o pagamento DEVE continuar aparecendo
// NAO podem ter o filtro adicionado.
// ============================================================================
describe('Sprint R6.1 — telas legitimas mantem visibilidade', () => {
  it('extrato/lista geral de transacoes SEM filtro semCategoria nao exclui isCardPayment', () => {
    const code = readFileSync(root('app/api/transacoes/route.ts'), 'utf-8')
    // Sprint Fundação Status: o filtro está consolidado em NEEDS_REVIEW_WHERE_PRISMA
    // aplicado DENTRO do bloco if(semCategoria) via Object.assign. Confirma que
    // o spread/assign acontece dentro do bloco — fora dele, lista geral mantém
    // visibilidade dos pagamentos de cartão.
    const semCategoriaBlockMatch = code.match(/if \(semCategoria\) \{[\s\S]+?\n\s{2,4}\}/)
    expect(semCategoriaBlockMatch).toBeTruthy()
    expect(semCategoriaBlockMatch![0]).toMatch(/NEEDS_REVIEW_WHERE_PRISMA/)
    // Fora do bloco semCategoria nao deve ter where.isCardPayment seta diretamente
    // (extrato completo mantem visibilidade)
    const codeWithoutBlock = code.replace(semCategoriaBlockMatch![0], '')
    expect(codeWithoutBlock).not.toMatch(/where\.isCardPayment/)
  })

  it('queries de dashboard cartao NAO foram alteradas pelo fix', () => {
    // O dashboard do cartao usa o filtro OPOSTO (isCardPayment=true pra
    // matched payments). Garantir que o fix nao quebrou isso.
    const code = readFileSync(root('lib/credit-card-pj/queries.ts'), 'utf-8')
    expect(code).toMatch(/isCardPayment:\s*true/)
  })
})
