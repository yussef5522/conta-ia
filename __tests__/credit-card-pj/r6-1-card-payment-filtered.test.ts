// Sprint Cartao PJ R6.1 — verifica que TODOS os 5 endpoints que listam
// pendencias/categorias agora excluem isCardPayment=true (pagamento casado).
//
// Tests de "presenca da linha" no codigo (defensivos a regressao do filtro).

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const root = (p: string) => join(__dirname, '..', '..', p)

describe('Sprint R6.1 — isCardPayment: false em endpoints de pendencias', () => {
  it('1) /api/conciliacao/ofx-pendentes exclui isCardPayment', () => {
    const code = readFileSync(
      root('app/api/conciliacao/ofx-pendentes/route.ts'),
      'utf-8',
    )
    expect(code).toMatch(/isCardPayment:\s*false/)
  })

  it('2) /api/transacoes (semCategoria=true) exclui isCardPayment', () => {
    const code = readFileSync(root('app/api/transacoes/route.ts'), 'utf-8')
    // O fix esta dentro do bloco `if (semCategoria)` — exige que a
    // assignment aparece junto com semCategoria
    expect(code).toMatch(/where\.isCardPayment\s*=\s*false/)
    expect(code).toMatch(/semCategoria/)
  })

  it('3) /api/conciliacao/bulk-dry-run exclui isCardPayment', () => {
    const code = readFileSync(
      root('app/api/conciliacao/bulk-dry-run/route.ts'),
      'utf-8',
    )
    expect(code).toMatch(/isCardPayment:\s*false/)
  })

  it('4) /api/dashboard/badges exclui isCardPayment (em AMBAS as 2 counts)', () => {
    const code = readFileSync(root('app/api/dashboard/badges/route.ts'), 'utf-8')
    // 2 ocorrencias (1 por count: a conciliacao OFX + a pendentes)
    const matches = code.match(/isCardPayment:\s*false/g) ?? []
    expect(matches.length).toBeGreaterThanOrEqual(2)
  })

  it('5) /api/empresas/[id]/relatorios/drill-down/transacoes exclui isCardPayment', () => {
    const code = readFileSync(
      root('app/api/empresas/[id]/relatorios/drill-down/transacoes/route.ts'),
      'utf-8',
    )
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
    // Confirma que isCardPayment so eh filtrado DENTRO do bloco semCategoria
    // (pra lista geral, default, NAO deve esconder pagamentos de cartao)
    const semCategoriaBlockMatch = code.match(/if \(semCategoria\) \{[\s\S]+?\n\s*\}/)
    expect(semCategoriaBlockMatch).toBeTruthy()
    expect(semCategoriaBlockMatch![0]).toMatch(/isCardPayment/)
    // Fora do bloco semCategoria nao deve ter where.isCardPayment seta
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
