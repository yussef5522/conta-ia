// Sprint Transferências Redesign (28/06/2026) — defensivos de estrutura
// das novas rotas + endpoints. SO VISUAL/UX — logica intacta.

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const root = (p: string) => join(__dirname, '..', '..', p)

describe('Sprint Transferencias Redesign — endpoints novos', () => {
  it('GET dashboard-summary existe', () => {
    const path = root('app/api/empresas/[id]/transferencias/dashboard-summary/route.ts')
    expect(existsSync(path)).toBe(true)
    const code = readFileSync(path, 'utf-8')
    expect(code).toMatch(/export async function GET/)
    // Retorna os 4 KPIs
    expect(code).toMatch(/conciliado:\s*\{/)
    expect(code).toMatch(/revisar:\s*\{/)
    expect(code).toMatch(/duplicatas:\s*\{/)
    expect(code).toMatch(/movimentado:\s*\{/)
    // Fluxo por conta
    expect(code).toMatch(/fluxoPorConta/)
  })

  it('POST unpair existe (desfazer par seguro — não afeta saldo)', () => {
    const path = root('app/api/transferencias/[groupId]/unpair/route.ts')
    expect(existsSync(path)).toBe(true)
    const code = readFileSync(path, 'utf-8')
    expect(code).toMatch(/export async function POST/)
    // Reverte type=TRANSFER → DEBIT/CREDIT original
    expect(code).toMatch(/transferGroupId:\s*null/)
    expect(code).toMatch(/pendingTransfer:\s*true/)
    expect(code).toMatch(/status:\s*'PENDING'/)
    // NAO apaga (continua sendo POST, não DELETE)
    expect(code).not.toMatch(/transaction\.delete/)
  })

  it('POST confirmar-em-lote existe (massa, validações duras)', () => {
    const path = root('app/api/empresas/[id]/transferencias/confirmar-em-lote/route.ts')
    expect(existsSync(path)).toBe(true)
    const code = readFileSync(path, 'utf-8')
    expect(code).toMatch(/export async function POST/)
    // Usa classifyTransferPair (mesma lógica do /pair single)
    expect(code).toMatch(/classifyTransferPair/)
    // Validações: mesma empresa, contas diferentes, valor +-0.01, sinais opostos
    expect(code).toMatch(/AMOUNT_TOL/)
    expect(code).toMatch(/sinais não opostos|opposite/)
    expect(code).toMatch(/mesma conta|bankAccountId/)
  })
})

describe('Sprint Transferencias Redesign — paginas novas', () => {
  it('dashboard (page.tsx) tem 4 KPICard + FluxoContas', () => {
    const path = root('app/(dashboard)/empresas/[id]/transferencias/page.tsx')
    const code = readFileSync(path, 'utf-8')
    expect(code).toMatch(/KPICard/)
    expect(code).toMatch(/FluxoContas/)
    // 4 cards minimo (Conciliado, Revisar, Duplicatas, Movimentado)
    const kpiMatches = code.match(/<KPICard/g) ?? []
    expect(kpiMatches.length).toBeGreaterThanOrEqual(4)
  })

  it('subpagina /revisar existe e usa AguardandoParTab + confirmar-em-lote', () => {
    const path = root('app/(dashboard)/empresas/[id]/transferencias/revisar/page.tsx')
    expect(existsSync(path)).toBe(true)
    const code = readFileSync(path, 'utf-8')
    expect(code).toMatch(/AguardandoParTab/)
    expect(code).toMatch(/confirmar-em-lote/)
  })

  it('subpagina /conciliadas existe com desfazer/excluir + confirmação dura', () => {
    const path = root('app/(dashboard)/empresas/[id]/transferencias/conciliadas/page.tsx')
    expect(existsSync(path)).toBe(true)
    const code = readFileSync(path, 'utf-8')
    expect(code).toMatch(/unpair/)
    expect(code).toMatch(/Desfazer/)
    // Excluir tem confirmação DURA
    expect(code).toMatch(/destructive/)
    expect(code).toMatch(/afeta saldo|saldo/)
  })

  it('subpagina /duplicatas existe com aviso "sistema NAO apaga"', () => {
    const path = root('app/(dashboard)/empresas/[id]/transferencias/duplicatas/page.tsx')
    expect(existsSync(path)).toBe(true)
    const code = readFileSync(path, 'utf-8')
    expect(code).toMatch(/NÃO apaga nada sozinho/)
    expect(code).toMatch(/É duplicata|Não é duplicata/)
  })
})

describe('Sprint Transferencias Redesign — componentes reusaveis', () => {
  it('KPICard.tsx existe (Mercury/Ramp design)', () => {
    const path = root('app/(dashboard)/empresas/[id]/transferencias/_components/KPICard.tsx')
    expect(existsSync(path)).toBe(true)
    const code = readFileSync(path, 'utf-8')
    expect(code).toMatch(/Link/)
    expect(code).toMatch(/rounded-xl/)
    expect(code).toMatch(/tone:\s*'emerald'\s*\|\s*'blue'\s*\|\s*'amber'\s*\|\s*'slate'/)
  })

  it('FluxoContas.tsx existe (barras horizontais + insight)', () => {
    const path = root('app/(dashboard)/empresas/[id]/transferencias/_components/FluxoContas.tsx')
    expect(existsSync(path)).toBe(true)
    const code = readFileSync(path, 'utf-8')
    expect(code).toMatch(/enviado|recebido/)
    expect(code).toMatch(/insight/)
    expect(code).toMatch(/AccountKindBadge/)
  })
})

describe('Sprint Transferencias Redesign — lógica intacta', () => {
  it('unpair SO chama Prisma update, NUNCA delete', () => {
    const code = readFileSync(
      root('app/api/transferencias/[groupId]/unpair/route.ts'),
      'utf-8',
    )
    expect(code).not.toMatch(/transaction\.delete|deleteMany/)
    expect(code).toMatch(/transaction\.update/)
  })

  it('confirmar-em-lote REUSA classifyTransferPair (não inventa logica)', () => {
    const code = readFileSync(
      root('app/api/empresas/[id]/transferencias/confirmar-em-lote/route.ts'),
      'utf-8',
    )
    expect(code).toMatch(/from '@\/lib\/accounts\/kind'/)
    expect(code).toMatch(/TRANSFER_INTERNAL/)
    expect(code).toMatch(/APORTE_CAPITAL/)
  })
})
