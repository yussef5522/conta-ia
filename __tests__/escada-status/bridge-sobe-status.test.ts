// Sprint Escada-Status (28/06/2026) — F2: lib/bridges/create.ts ao resolver
// categoria PJ pós-create do par, sobe status pra RECONCILED no mesmo
// update. Sem isso, 11 das 57 tx Cacula invertidas vinham daqui (BRIDGE
// setava categoryId+source MAS status ficava PENDING).

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const root = (p: string) => join(__dirname, '..', '..', p)

describe('bridge create — update PJ post-categoria sobe status', () => {
  const code = readFileSync(root('lib/bridges/create.ts'), 'utf-8')

  it('o update categoria PJ contém status: RECONCILED', () => {
    // Bloco: tx.transaction.update onde data tem categoryId: resolvedCategoryId
    // + classificationSource: 'BRIDGE' deve agora ter status: 'RECONCILED'
    const block = code.match(
      /tx\.transaction\.update\(\{[\s\S]+?categoryId:\s*resolvedCategoryId[\s\S]+?classificationSource:\s*'BRIDGE'[\s\S]+?\}\s*,?\s*\}\s*\)/,
    )
    expect(block).toBeTruthy()
    expect(block![0]).toMatch(/status:\s*'RECONCILED'/)
  })

  it('citação Sprint Escada-Status no comentário', () => {
    expect(code).toMatch(/Sprint Escada-Status/)
  })
})
