// Sprint Account Kind PJ/PF (27/06/2026) — defensivos de endpoint/UI.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const root = (p: string) => join(__dirname, '..', '..', p)

describe('Sprint Account Kind — schema BankAccount.accountKind', () => {
  it('schema.prisma tem accountKind String DEFAULT "PJ"', () => {
    const code = readFileSync(root('prisma/schema.prisma'), 'utf-8')
    expect(code).toMatch(/accountKind\s+String\s+@default\("PJ"\)/)
  })
  it('migration aditiva pura existe', () => {
    const code = readFileSync(
      root('prisma/migrations/20260628010000_account_kind_pj_pf/migration.sql'),
      'utf-8',
    )
    expect(code).toMatch(/ADD COLUMN "accountKind" TEXT NOT NULL DEFAULT 'PJ'/)
  })
  it('zod schema aceita accountKind PJ|PF (default PJ)', () => {
    const code = readFileSync(root('lib/validations/conta-bancaria.ts'), 'utf-8')
    expect(code).toMatch(/ACCOUNT_KINDS\s*=\s*\[\s*'PJ',\s*'PF'\s*\]/)
    expect(code).toMatch(/accountKind:\s*z\.enum\(ACCOUNT_KINDS\)/)
  })
})

describe('Sprint Account Kind — pair endpoint decide pelo accountKind', () => {
  const code = readFileSync(
    root('app/api/transferencias/aguardando-par/[txId]/pair/route.ts'),
    'utf-8',
  )
  it('importa classifyTransferPair', () => {
    expect(code).toMatch(/classifyTransferPair/)
    expect(code).toMatch(/from '@\/lib\/accounts\/kind'/)
  })
  it('carrega accountKind do bankAccount em ambos lados', () => {
    const matches = code.match(/accountKind:\s*true/g) ?? []
    expect(matches.length).toBeGreaterThanOrEqual(2)
  })
  it('TRANSFER_INTERNAL vira type=TRANSFER + transferGroupId compartilhado', () => {
    expect(code).toMatch(/TRANSFER_INTERNAL/)
    expect(code).toMatch(/type:\s*'TRANSFER'/)
  })
  it('APORTE/RETIRADA categoriza com equity, mantém type DEBIT/CREDIT', () => {
    // Confirma branch APORTE_CAPITAL (a string aparece no if) + nomes
    // literais de categoria de equity + error code da categoria ausente.
    expect(code).toMatch(/APORTE_CAPITAL/)
    expect(code).toMatch(/Aporte de Capital/)
    expect(code).toMatch(/Retirada de Lucros/)
    expect(code).toMatch(/EQUITY_CATEGORY_MISSING/)
  })
  it('OUT_OF_SCOPE rejeitado com 400', () => {
    expect(code).toMatch(/OUT_OF_SCOPE/)
  })
})

describe('Sprint Account Kind — classify-equity endpoint', () => {
  const code = readFileSync(
    root('app/api/transferencias/aguardando-par/[txId]/classify-equity/route.ts'),
    'utf-8',
  )
  it('aceita APORTE_CAPITAL e RETIRADA_LUCRO', () => {
    expect(code).toMatch(/kind:\s*z\.enum\(\['APORTE_CAPITAL',\s*'RETIRADA_LUCRO'\]\)/)
  })
  it('valida coerência type: APORTE=CREDIT, RETIRADA=DEBIT', () => {
    expect(code).toMatch(/Aporte deve ser uma entrada/)
    expect(code).toMatch(/Retirada deve ser uma saída/)
  })
  it('zera pendingTransfer/Direction/Since', () => {
    expect(code).toMatch(/pendingTransfer:\s*false/)
    expect(code).toMatch(/pendingTransferDirection:\s*null/)
    expect(code).toMatch(/pendingTransferSince:\s*null/)
  })
})

describe('Sprint Account Kind — DRE engine respeita APORTES_CAPITAL como NonDRE', () => {
  it('lib/dre/types.ts inclui APORTES_CAPITAL em NON_DRE_GROUPS', () => {
    const code = readFileSync(root('lib/dre/types.ts'), 'utf-8')
    expect(code).toMatch(/'APORTES_CAPITAL'/)
    expect(code).toMatch(/NON_DRE_GROUPS:\s*NonDREGroup\[\]\s*=\s*\[[\s\S]*?APORTES_CAPITAL[\s\S]*?\]/)
  })
  it('label de UI cadastrado', () => {
    const code = readFileSync(root('lib/dre/types.ts'), 'utf-8')
    expect(code).toMatch(/APORTES_CAPITAL:\s*'Aportes de Capital/)
  })
})

describe('Sprint Account Kind — UI selo PJ/PF', () => {
  it('AccountKindBadge.tsx existe e exporta', () => {
    const code = readFileSync(root('components/shared/AccountKindBadge.tsx'), 'utf-8')
    expect(code).toMatch(/export function AccountKindBadge/)
  })
  it('conta-form.tsx tem seletor accountKind', () => {
    const code = readFileSync(root('components/contas-bancarias/conta-form.tsx'), 'utf-8')
    expect(code).toMatch(/accountKind/)
    expect(code).toMatch(/PJ — Conta da empresa/)
    expect(code).toMatch(/PF — Conta pessoal do dono/)
  })
  it('lista de contas mostra AccountKindBadge', () => {
    const code = readFileSync(
      root('app/(dashboard)/empresas/[id]/contas/page.tsx'),
      'utf-8',
    )
    expect(code).toMatch(/AccountKindBadge/)
  })
  it('AguardandoParTab mostra badge da conta + sugestão', () => {
    const code = readFileSync(
      root('app/(dashboard)/empresas/[id]/transferencias/_components/AguardandoParTab.tsx'),
      'utf-8',
    )
    expect(code).toMatch(/AccountKindBadge/)
    // 2 lugares: badge da conta da pendente + badge do candidato sugestão
    const matches = code.match(/AccountKindBadge/g) ?? []
    expect(matches.length).toBeGreaterThanOrEqual(3) // import + 2 usos
  })
})
