// Fix Dropdown Contas Vazio (17/06/2026)
// Bug: form de novo empréstimo chamava `/api/empresas/[id]/contas-bancarias`
// — endpoint que NÃO existe. Middleware retornava 401 silente, dropdown
// ficava vazio sem erro visível pro user.
// Fix: usar o mesmo endpoint que a página de contas (que funciona):
// GET /api/contas-bancarias?empresaId=...

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..')

describe('Fix dropdown contas empréstimo', () => {
  const NOVO = readFileSync(
    join(ROOT, 'app/(dashboard)/empresas/[id]/emprestimos/novo/page.tsx'),
    'utf-8',
  )

  it('NÃO usa mais a URL antiga (/api/empresas/[id]/contas-bancarias)', () => {
    expect(NOVO).not.toMatch(
      /fetch\(\s*`\/api\/empresas\/\$\{empresaId\}\/contas-bancarias`/,
    )
  })

  it('usa a URL correta /api/contas-bancarias?empresaId=...', () => {
    expect(NOVO).toMatch(
      /fetch\(`\/api\/contas-bancarias\?empresaId=\$\{empresaId\}`/,
    )
  })

  it('lê d.contas do response (shape do endpoint /api/contas-bancarias)', () => {
    expect(NOVO).toMatch(/d\?\.contas/)
  })

  it('filtra só ativas pra dropdown (parcelas debitam só em conta ativa)', () => {
    expect(NOVO).toMatch(/c\.isActive/)
    expect(NOVO).toMatch(/contas\.filter/)
  })

  it('mesma URL usada pela página de contas (paridade — referência canônica)', () => {
    const contasPage = readFileSync(
      join(ROOT, 'app/(dashboard)/empresas/[id]/contas/page.tsx'),
      'utf-8',
    )
    // Confirma que a página /contas (que sabidamente funciona) usa o mesmo endpoint
    expect(contasPage).toMatch(/\/api\/contas-bancarias\?empresaId=/)
  })

  it('GET handler de /api/contas-bancarias filtra por companyId', () => {
    const code = readFileSync(
      join(ROOT, 'app/api/contas-bancarias/route.ts'),
      'utf-8',
    )
    expect(code).toMatch(/where:\s*\{\s*companyId:\s*empresaId\s*\}/)
    expect(code).toMatch(/return NextResponse\.json\(\{\s*\n?\s*contas:/)
  })
})
