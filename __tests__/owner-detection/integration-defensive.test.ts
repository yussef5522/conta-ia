// Sprint Owner Detection (28/06/2026) — defensivos cross-arquivos.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const root = (p: string) => join(__dirname, '..', '..', p)

describe('Sprint Owner Detection — OwnEntityRefs estendido', () => {
  it('interface tem ownerCpfs e ownerNames', () => {
    const code = readFileSync(root('lib/transfers/own-entity-signals.ts'), 'utf-8')
    expect(code).toMatch(/ownerCpfs:\s*string\[\]/)
    expect(code).toMatch(/ownerNames:\s*string\[\]/)
  })
  it('extractOwnSignals retorna hasOwnerCpf + hasOwnerName', () => {
    const code = readFileSync(root('lib/transfers/own-entity-signals.ts'), 'utf-8')
    expect(code).toMatch(/hasOwnerCpf:\s*boolean/)
    expect(code).toMatch(/hasOwnerName:\s*boolean/)
  })
  it('boost de CPF dono = 0.15 (FORTE igual CNPJ)', () => {
    const code = readFileSync(root('lib/transfers/own-entity-signals.ts'), 'utf-8')
    expect(code).toMatch(/OWNER_CPF_BOOST\s*=\s*0\.15/)
  })
  it('boost de nome dono = 0.10 (MEDIO igual nome empresa)', () => {
    const code = readFileSync(root('lib/transfers/own-entity-signals.ts'), 'utf-8')
    expect(code).toMatch(/OWNER_NAME_BOOST\s*=\s*0\.1/)
  })
})

describe('Sprint Owner Detection — loader centralizado', () => {
  it('lib/transfers/load-own-entity-refs.ts existe e exporta loadOwnEntityRefs', () => {
    const code = readFileSync(root('lib/transfers/load-own-entity-refs.ts'), 'utf-8')
    expect(code).toMatch(/export\s+async\s+function\s+loadOwnEntityRefs/)
    expect(code).toMatch(/sociosPF:\s*\{\s*select:\s*\{\s*nome:\s*true,\s*cpf:\s*true/)
  })
})

describe('Sprint Owner Detection — 6 callers usam o helper (DRY)', () => {
  const callers = [
    'app/api/contas-bancarias/[id]/importar-ofx/route.ts',
    'app/api/empresas/[id]/transferencias/scan-retroativo/route.ts',
    'app/api/empresas/[id]/transferencias/sozinhas/route.ts',
    'app/api/empresas/[id]/transferencias/sugestoes/route.ts',
    'app/api/empresas/[id]/transferencias/duplicatas/route.ts',
    'app/api/contas-bancarias/[id]/detectar-transferencias/route.ts',
  ]
  for (const f of callers) {
    it(`${f.split('/').slice(-2).join('/')} importa loadOwnEntityRefs`, () => {
      const code = readFileSync(root(f), 'utf-8')
      expect(code).toMatch(/loadOwnEntityRefs/)
    })
  }
})

describe('Sprint Owner Detection — auto-pair pos-import estende PJ+PF', () => {
  const code = readFileSync(
    root('app/api/contas-bancarias/[id]/importar-ofx/route.ts'),
    'utf-8',
  )
  it('importa classifyTransferPair do lib/accounts/kind', () => {
    expect(code).toMatch(/classifyTransferPair/)
    expect(code).toMatch(/normalizeAccountKind/)
  })
  it('carrega accountKind de todas contas + categorias equity', () => {
    expect(code).toMatch(/accountKind:\s*true/)
    expect(code).toMatch(/'Aporte de Capital',\s*dreGroup:\s*'APORTES_CAPITAL'/)
    expect(code).toMatch(/'Retirada de Lucros \/ Pró-labore',\s*dreGroup:\s*'DISTRIBUICAO_LUCROS'/)
  })
  it('PJ+PJ vira TRANSFER, PJ+PF categoriza com equity (sem TRANSFER)', () => {
    expect(code).toMatch(/TRANSFER_INTERNAL/)
    expect(code).toMatch(/APORTE_CAPITAL/)
    expect(code).toMatch(/\[PJ↔PF:/)
  })
})
