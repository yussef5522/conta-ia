// Sprint Category-Combobox (29/06/2026) — defesa em profundidade no PUT:
// route.ts agora aplica enforceStatusLadder no fim, sobrescrevendo qualquer
// tentativa do body de status.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const root = (p: string) => join(__dirname, '..', '..', p)

describe('PUT /api/transacoes/[id] — blindagem da escada', () => {
  const code = readFileSync(
    root('app/api/transacoes/[id]/route.ts'),
    'utf-8',
  )

  it('importa enforceStatusLadder', () => {
    expect(code).toMatch(/enforceStatusLadder/)
    expect(code).toMatch(/from '@\/lib\/transacoes\/needs-review'/)
  })

  it('calcula statusEnforced antes do update', () => {
    expect(code).toMatch(/statusEnforced\s*=\s*enforceStatusLadder/)
  })

  it('passa categoryId, intendedStatus, accountType pro helper', () => {
    expect(code).toMatch(/categoryId:\s*categoryIdFinal/)
    expect(code).toMatch(/intendedStatus:\s*intendedStatus/)
    expect(code).toMatch(/accountType:\s*accountTypeBucket/)
  })

  it('status no update final usa statusEnforced (NÃO data.status cru)', () => {
    // Deve ter `status: statusEnforced` no data do update
    expect(code).toMatch(/status:\s*statusEnforced/)
  })

  it('REMOVEU spread cru data.status no update', () => {
    // Antes era: ...(data.status !== undefined ? { status: data.status } : {})
    // Agora: foi removido. Status sempre vem do enforce.
    expect(code).not.toMatch(/\.\.\.\(data\.status\s*!==\s*undefined\s*\?\s*\{\s*status:\s*data\.status\s*\}/)
  })

  it('citação Sprint Category-Combobox no comentário', () => {
    expect(code).toMatch(/Sprint Category-Combobox/)
  })
})

describe('PATCH /api/transacoes/lote/status — blindagem em lote', () => {
  const code = readFileSync(
    root('app/api/transacoes/lote/status/route.ts'),
    'utf-8',
  )

  it('importa enforceStatusLadder', () => {
    expect(code).toMatch(/enforceStatusLadder/)
  })

  it('agrupa por status enforced antes do updateMany', () => {
    expect(code).toMatch(/byEnforced/)
    expect(code).toMatch(/intendedStatus:\s*data\.status/)
  })

  it('multi-tenant preservado: query por user.sub continua', () => {
    expect(code).toMatch(/users:\s*\{\s*some:\s*\{\s*userId:\s*user\.sub/)
  })
})
