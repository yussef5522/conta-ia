// Sprint Category-Combobox PJ Batch (30/06/2026) — testes de blindagem.
//
// 2 endpoints que estavam sem enforceStatusLadder agora aplicam a escada:
// - PATCH /api/empresas/[id]/contas-pagar/[transactionId]/inline
// - PATCH /api/empresas/[id]/despesas/recategorizar
//
// Confirmação por grep — mesma técnica dos outros defensivos da casa.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const root = (p: string) => join(__dirname, '..', '..', p)

describe('PATCH /contas-pagar/[id]/inline — usa enforceStatusLadder', () => {
  const code = readFileSync(
    root('app/api/empresas/[id]/contas-pagar/[transactionId]/inline/route.ts'),
    'utf-8',
  )

  it('importa enforceStatusLadder', () => {
    expect(code).toMatch(
      /import\s*\{\s*enforceStatusLadder\s*\}\s*from\s+['"]@\/lib\/transacoes\/needs-review['"]/,
    )
  })

  it('aplica enforceStatusLadder no fluxo do field=categoryId', () => {
    expect(code).toMatch(/if\s*\(\s*input\.field\s*===\s*'categoryId'\s*\)/)
    expect(code).toMatch(/enforceStatusLadder\(\s*\{/)
    expect(code).toMatch(/intendedStatus:\s*antiga\.status/)
    expect(code).toMatch(/categoryId:\s*resolvedCategoryId/)
    expect(code).toMatch(/accountType:\s*acc\?\.accountType/)
  })

  it('grava status derivado (statusEnforced) se diferente do anterior', () => {
    expect(code).toMatch(/statusEnforced\s*!==\s*antiga\.status/)
    expect(code).toMatch(/data\.status\s*=\s*statusEnforced/)
  })
})

describe('PATCH /despesas/recategorizar — usa enforceStatusLadder', () => {
  const code = readFileSync(
    root('app/api/empresas/[id]/despesas/recategorizar/route.ts'),
    'utf-8',
  )

  it('importa enforceStatusLadder', () => {
    expect(code).toMatch(
      /import\s*\{\s*enforceStatusLadder\s*\}\s*from\s+['"]@\/lib\/transacoes\/needs-review['"]/,
    )
  })

  it('fetch tx agora inclui status + bankAccount.accountType', () => {
    expect(code).toMatch(/status:\s*true/)
    expect(code).toMatch(/bankAccount:\s*\{\s*select:\s*\{\s*accountType:\s*true/)
  })

  it('agrupa por status enforced antes do updateMany', () => {
    expect(code).toMatch(/enforceStatusLadder\(\s*\{/)
    expect(code).toMatch(/intendedStatus:\s*t\.status/)
    expect(code).toMatch(/categoryId:\s*novaCategoriaId/)
    expect(code).toMatch(/accountType:\s*t\.bankAccount\?\.accountType/)
    expect(code).toMatch(/groups\.set\(/)
  })

  it('updateMany por grupo dentro de $transaction (padrão A2 Sprint Escada-Status)', () => {
    expect(code).toMatch(/prisma\.\$transaction\(async\s*\(tx\)/)
    expect(code).toMatch(/tx\.transaction\.updateMany/)
    expect(code).toMatch(/status:\s*statusFinal/)
  })

  it('citação Sprint Category-Combobox PJ Batch nos comentários', () => {
    expect(code).toMatch(/Sprint Category-Combobox PJ Batch/)
  })
})
