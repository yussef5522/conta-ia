// Sprint Escada-Status (28/06/2026) — F3: lib/conciliacao/reconcile.ts no
// ORPHAN mode, quando ofxBackfill.categoryId é populado (OFX recebe
// categoryId/supplierId do candidate Excel), agora sobe status do OFX pra
// RECONCILED. Sem isso, 43 das 57 tx Cacula invertidas vinham daqui — maior
// fluxo afetado.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const root = (p: string) => join(__dirname, '..', '..', p)

describe('reconcile.ts — backfill cooperativo OFX sobe status', () => {
  const code = readFileSync(root('lib/conciliacao/reconcile.ts'), 'utf-8')

  it("quando ofxBackfill tem categoryId, update inclui status: 'RECONCILED'", () => {
    // O fix transforma ofxBackfill em ofxBackfillWithStatus quando categoryId
    // está presente. O update final usa essa versão (ou a original se só
    // supplierId).
    expect(code).toMatch(/ofxBackfillWithStatus/)
    expect(code).toMatch(/'categoryId' in ofxBackfill/)
    expect(code).toMatch(/status:\s*'RECONCILED'/)
  })

  it('preserva backfill sem categoryId intacto (só supplierId não sobe status)', () => {
    // Lógica: 'categoryId' in ofxBackfill ? { ...withStatus } : ofxBackfill
    // Se vier só supplierId, mantém ofxBackfill original.
    expect(code).toMatch(/\?\s*\{\s*\.\.\.ofxBackfill,\s*status:\s*'RECONCILED'/)
    expect(code).toMatch(/:\s*ofxBackfill/)
  })

  it('citação Sprint Escada-Status no comentário', () => {
    expect(code).toMatch(/Sprint Escada-Status/)
  })
})
