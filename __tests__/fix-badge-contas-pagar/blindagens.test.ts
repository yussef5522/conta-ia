// Sprint Fix-Badge-Contas-Pagar (05/07/2026) — blindagens estáticas.
//
// Cobre:
//   (a) Endpoint /api/dashboard/badges: badge "Contas a Pagar" só conta PAYABLE
//   (b) Endpoint: retorna também contasAReceber com counts RECEIVABLE
//   (c) Hook use-sidebar-badges: tipo suporta contasAReceber opcional
//   (d) Sidebar renderiza badge no item "Contas a Receber" com arBadge

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const root = (p: string) => join(__dirname, '..', '..', p)
const read = (p: string) => readFileSync(root(p), 'utf-8')

describe('a) Endpoint badges: Contas a Pagar só conta PAYABLE', () => {
  const code = read('app/api/dashboard/badges/route.ts')

  it('NÃO usa mais lifecycle: { in: ["PAYABLE", "RECEIVABLE"] } no bloco apBadge', () => {
    // Antes do fix: 2 ocorrências (vencidas e vencendoEm3d do apBadge).
    // Depois: zero ocorrências no bloco PAYABLE. Se ainda existir, é regressão.
    const apBadgeBlock = code.match(
      /vencidas[\s\S]+?vencendoEm3[\s\S]{0,600}\)\s*,/,
    )
    expect(apBadgeBlock).toBeTruthy()
    expect(apBadgeBlock![0]).not.toMatch(/lifecycle:\s*\{\s*in:\s*\[\s*['"]PAYABLE['"],\s*['"]RECEIVABLE['"]/)
  })

  it('as duas primeiras queries usam lifecycle: "PAYABLE" (só saída)', () => {
    // Deve ter exatamente 2 ocorrências de `lifecycle: 'PAYABLE'` no arquivo
    // (vencidas + vencendoEm3d do apBadge). NÃO conta RECEIVABLE junto.
    const matches = code.match(/lifecycle:\s*['"]PAYABLE['"]/g)
    expect(matches).not.toBeNull()
    expect(matches!.length).toBeGreaterThanOrEqual(2)
  })

  it('vencidas usa dueDate < now', () => {
    expect(code).toMatch(
      /lifecycle:\s*['"]PAYABLE['"][\s\S]{0,120}dueDate:\s*\{\s*lt:\s*now\s*\}/,
    )
  })

  it('vencendoEm3 usa dueDate entre now e in3Days', () => {
    expect(code).toMatch(
      /lifecycle:\s*['"]PAYABLE['"][\s\S]{0,120}dueDate:\s*\{\s*gte:\s*now,\s*lte:\s*in3Days/,
    )
  })
})

describe('b) Endpoint: retorna contasAReceber com counts RECEIVABLE', () => {
  const code = read('app/api/dashboard/badges/route.ts')

  it('destructuring inclui arVencidas + arVencendoEm3', () => {
    expect(code).toMatch(
      /const\s*\[[\s\S]{0,300}arVencidas,\s*arVencendoEm3,?\s*\]\s*=\s*await\s+Promise\.all/,
    )
  })

  it('2 queries com lifecycle: "RECEIVABLE" no Promise.all', () => {
    const matches = code.match(/lifecycle:\s*['"]RECEIVABLE['"]/g)
    expect(matches).not.toBeNull()
    expect(matches!.length).toBeGreaterThanOrEqual(2)
  })

  it('response inclui contasAReceber: { vencidas, vencendoEm3Dias }', () => {
    expect(code).toMatch(
      /contasAReceber:\s*\{[\s\S]{0,180}vencidas:\s*arVencidas[\s\S]{0,120}vencendoEm3Dias:\s*arVencendoEm3/,
    )
  })

  it('response preserva contasAPagar + conciliacao + transacoesPendentes', () => {
    // Backward-compat: shape antigo continua funcionando pra callers que
    // ainda não sabem de contasAReceber.
    expect(code).toMatch(/contasAPagar:\s*\{/)
    expect(code).toMatch(/conciliacao:\s*\{/)
    expect(code).toMatch(/transacoesPendentes/)
  })
})

describe('c) Hook use-sidebar-badges: tipo suporta contasAReceber', () => {
  const code = read('lib/hooks/use-sidebar-badges.ts')

  it('SidebarBadges expõe contasAReceber? opcional', () => {
    // Opcional pra evitar break de teste antigo com fixture sem o campo.
    expect(code).toMatch(
      /contasAReceber\?\s*:\s*\{\s*vencidas:\s*number;\s*vencendoEm3Dias:\s*number\s*\}/,
    )
  })
})

describe('d) Sidebar renderiza badge "Contas a Receber"', () => {
  const code = read('components/sidebar/global-sidebar.tsx')

  it('calcula arBadge = vencidas + vencendoEm3Dias (só se contasAReceber presente)', () => {
    expect(code).toMatch(
      /const\s+arBadge\s*=\s*badges\?\.contasAReceber[\s\S]{0,200}vencidas\s*\+\s*[\s\S]{0,80}vencendoEm3Dias/,
    )
  })

  it('arTone usa red/amber/neutral igual ao apTone (padrão consistente)', () => {
    expect(code).toMatch(
      /const\s+arTone:\s*['"]red['"]\s*\|\s*['"]amber['"]\s*\|\s*['"]neutral['"]/,
    )
  })

  it('SidebarItem "Contas a Receber" ganha badge + badgeTone', () => {
    // O item que aponta pra /contas-a-receber deve ter as duas props.
    const receberItem = code.match(
      /label="Contas a Receber"[\s\S]{0,400}\/>/,
    )
    expect(receberItem).toBeTruthy()
    expect(receberItem![0]).toMatch(/badge=\{arBadge\s*>\s*0/)
    expect(receberItem![0]).toMatch(/badgeTone=\{arTone\}/)
  })

  it('SidebarItem "Contas a Pagar" continua com apBadge/apTone (não regrediu)', () => {
    const pagarItem = code.match(
      /label="Contas a Pagar"[\s\S]{0,400}\/>/,
    )
    expect(pagarItem).toBeTruthy()
    expect(pagarItem![0]).toMatch(/badge=\{apBadge\s*>\s*0/)
    expect(pagarItem![0]).toMatch(/badgeTone=\{apTone\}/)
  })
})
