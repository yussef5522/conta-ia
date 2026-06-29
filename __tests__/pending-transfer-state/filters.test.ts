// Sprint Pending Transfer State (27/06/2026) — defensivos de filtros.
//
// pendingTransfer: false adicionado em:
//   - DRE engine (calculator.ts) + DRE SQL (dre/route.ts)
//   - ofx-pendentes
//   - transacoes (semCategoria)
//   - bulk-dry-run
//   - dashboard badges (2 queries)
//   - drill-down

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const root = (p: string) => join(__dirname, '..', '..', p)

describe('Sprint Pending Transfer — DRE engine puro pula pendingTransfer', () => {
  it('calculator.ts tem skip por tx.pendingTransfer', () => {
    const code = readFileSync(root('lib/dre/calculator.ts'), 'utf-8')
    expect(code).toMatch(/if\s*\(\s*tx\.pendingTransfer\s*\)\s*continue/)
  })
  it('types.ts inclui pendingTransfer opcional em TransactionForDRE', () => {
    const code = readFileSync(root('lib/dre/types.ts'), 'utf-8')
    expect(code).toMatch(/pendingTransfer\?:\s*boolean/)
  })
})

// Sprint Fundação Status (28/06/2026): filtro consolidado em
// NEEDS_REVIEW_WHERE_PRISMA pra endpoints de "pra revisar". Aceita literal
// OU spread da fonte única. DRE e drill-down não migraram (filtro literal).
function temFiltroPendingTransfer(code: string): boolean {
  const literal = /pendingTransfer/.test(code)
  const fonteUnica =
    /\.\.\.NEEDS_REVIEW_WHERE_PRISMA/.test(code) ||
    /Object\.assign\(where,\s*NEEDS_REVIEW_WHERE_PRISMA\)/.test(code)
  return literal || fonteUnica
}

describe('Sprint Pending Transfer — DRE SQL + filas filtram pendingTransfer', () => {
  const files = [
    'app/api/empresas/[id]/dre/route.ts',
    'app/api/conciliacao/ofx-pendentes/route.ts',
    'app/api/transacoes/route.ts',
    'app/api/conciliacao/bulk-dry-run/route.ts',
    'app/api/empresas/[id]/relatorios/drill-down/transacoes/route.ts',
  ]
  for (const f of files) {
    it(`${f} exclui pendingTransfer`, () => {
      const code = readFileSync(root(f), 'utf-8')
      expect(temFiltroPendingTransfer(code)).toBe(true)
    })
  }
  it('dashboard/badges exclui pendingTransfer em AMBAS as 2 contagens', () => {
    const code = readFileSync(root('app/api/dashboard/badges/route.ts'), 'utf-8')
    // Sprint Fundação Status: filtro consolidado em NEEDS_REVIEW_WHERE_PRISMA.
    // Aceita literais OU spreads — 2 das 2 contagens devem aplicar.
    const literais = code.match(/pendingTransfer:\s*false/g) ?? []
    const spreads = code.match(/\.\.\.NEEDS_REVIEW_WHERE_PRISMA/g) ?? []
    expect(literais.length + spreads.length).toBeGreaterThanOrEqual(2)
  })
})

describe('Sprint Pending Transfer — apply-marks seta pendingTransfer no TRANSFER', () => {
  const code = readFileSync(
    root('app/api/contas-bancarias/[id]/importar-ofx/apply-marks/route.ts'),
    'utf-8',
  )
  it('TRANSFER case seta pendingTransfer=true', () => {
    expect(code).toMatch(/pendingTransfer:\s*true/)
  })
  it('TRANSFER case seta pendingTransferDirection (OUT/IN por type)', () => {
    expect(code).toMatch(/pendingTransferDirection/)
    expect(code).toMatch(/'OUT'|'IN'/)
  })
  it('TRANSFER case seta pendingTransferSince', () => {
    expect(code).toMatch(/pendingTransferSince:\s*new Date\(\)/)
  })
})

describe('Sprint Pending Transfer — scan-retroativo limpa pendingTransfer no auto-pair', () => {
  it('importar-ofx auto-pair zera pendingTransfer/Direction/Since em ambos lados', () => {
    const code = readFileSync(
      root('app/api/contas-bancarias/[id]/importar-ofx/route.ts'),
      'utf-8',
    )
    // 2 ocorrencias (uma pra cada lado do par no $transaction)
    const matches = code.match(/pendingTransfer:\s*false/g) ?? []
    expect(matches.length).toBeGreaterThanOrEqual(2)
  })
})

describe('Sprint Pending Transfer — endpoints novos existem', () => {
  it('GET /api/empresas/[id]/transferencias/aguardando-par', () => {
    const path = root('app/api/empresas/[id]/transferencias/aguardando-par/route.ts')
    const code = readFileSync(path, 'utf-8')
    expect(code).toMatch(/export\s+async\s+function\s+GET/)
    expect(code).toMatch(/pendingTransfer:\s*true/)
  })
  it('DELETE /api/transferencias/aguardando-par/[txId]', () => {
    const path = root('app/api/transferencias/aguardando-par/[txId]/route.ts')
    const code = readFileSync(path, 'utf-8')
    expect(code).toMatch(/export\s+async\s+function\s+DELETE/)
    expect(code).toMatch(/pendingTransfer:\s*false/)
  })
  it('POST /api/transferencias/aguardando-par/[txId]/pair', () => {
    const path = root('app/api/transferencias/aguardando-par/[txId]/pair/route.ts')
    const code = readFileSync(path, 'utf-8')
    expect(code).toMatch(/export\s+async\s+function\s+POST/)
    // Garante validações duras (mesma empresa + valor exato + sinais opostos)
    expect(code).toMatch(/CROSS_COMPANY/)
    expect(code).toMatch(/Sinais não são opostos/)
    expect(code).toMatch(/transferGroupId:\s*groupId/)
    expect(code).toMatch(/pendingTransfer:\s*false/)
  })
})
