/**
 * ⭐ E2 (12/11/2026, ordem do dono) — "Lucro por setor" mora no FINANCEIRO, logo ABAIXO de
 * "Quem paga a casa". Uma entrada só, a mesma rota, e a mesma permissão da rota (quem vê a porta
 * abre a sala). Lido do componente real do menu, na ordem em que ele desenha.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ler = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')
const MENU = ler('components/sidebar/global-sidebar.tsx').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
const itens = [...MENU.matchAll(/<SidebarItem\b([\s\S]*?)\/>/g)].map((m) => ({
  label: /label="([^"]+)"/.exec(m[1])?.[1] ?? '',
  perm: /perm="([^"]+)"/.exec(m[1])?.[1] ?? null,
  href: /href=\{`([^`]+)`\}/.exec(m[1])?.[1] ?? '',
}))

describe('E2 · Lucro por setor no lugar que o dono mandou', () => {
  it('uma entrada só, imediatamente abaixo de "Quem paga a casa"', () => {
    const i = itens.findIndex((x) => x.label === 'Lucro por setor')
    expect(itens.filter((x) => x.label === 'Lucro por setor')).toHaveLength(1)
    expect(itens[i - 1]?.label).toBe('Quem paga a casa')
  })

  it('a mesma rota de antes e a MESMA permissão que a rota da API exige', () => {
    const it_ = itens.find((x) => x.label === 'Lucro por setor')!
    expect(it_.href).toBe('/empresas/${empresaAtiva}/estoque/lucro-setor')
    const api = ler('app/api/empresas/[id]/estoque/lucro-setor/route.ts')
    expect(api).toContain(`guardStock(request, companyId, '${it_.perm}')`)
  })

  it('saiu do grupo do estoque: nenhuma entrada de estoque entre ele e "Real vs Teórico"', () => {
    const iReal = itens.findIndex((x) => x.label === 'Real vs Teórico')
    expect(itens[iReal + 1]?.label).not.toBe('Lucro por setor')
    expect(itens.findIndex((x) => x.label === 'Lucro por setor')).toBeLessThan(iReal)
  })
})
