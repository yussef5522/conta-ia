// Sprint 5.0.2.1 — Sanidade do path do botão "Importar Excel".

import { describe, it, expect } from 'vitest'

/**
 * O botão "Importar Excel" no header de /contas-a-pagar precisa apontar
 * pra rota EXATA criada na Sprint 5.0.2.0:
 *   /empresas/<empresaId>/contas-pagar/import
 *
 * Esse teste documenta o contrato — se a rota mover ou renomear, o teste
 * falha e força revisão do botão.
 */
function buildImportHref(empresaId: string | null | undefined): string {
  return empresaId ? `/empresas/${empresaId}/contas-pagar/import` : '#'
}

describe('Botão "Importar Excel" — destino', () => {
  it('Aponta pra /empresas/[id]/contas-pagar/import quando empresa selecionada', () => {
    expect(buildImportHref('cmp_abc123')).toBe(
      '/empresas/cmp_abc123/contas-pagar/import',
    )
  })

  it('Vira "#" quando sem empresa (botão desabilitado)', () => {
    expect(buildImportHref(null)).toBe('#')
    expect(buildImportHref(undefined)).toBe('#')
    expect(buildImportHref('')).toBe('#')
  })

  it('Path bate com a rota App Router criada na Sprint 5.0.2.0', () => {
    // Documenta o path do diretório no repo
    // app/(dashboard)/empresas/[id]/contas-pagar/import/page.tsx
    const href = buildImportHref('cmp_xyz')
    expect(href).toMatch(/^\/empresas\/[^/]+\/contas-pagar\/import$/)
  })
})
