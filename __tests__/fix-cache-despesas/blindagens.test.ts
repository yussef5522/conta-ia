// Sprint Fix-Cache-Despesas (01/07/2026) — blindagem.
//
// Bug: getExpenseBreakdown usava unstable_cache (TTL 60s, tag
// `dashboard:${companyId}`), mas revalidateTag no route.ts recategorizar
// NÃO invalidava efetivamente no Next 16 em runtime prod — cabeçalho
// do card de categoria ficava STALE mesmo após reload (a lista, sem
// cache, mostrava atualizada). Ex: Compras Mercadoria "21 tx ·
// R$41.968" no cabeçalho, "sem transações" na lista.
//
// Fix: remover o unstable_cache. Consulta direta a cada render.
// ~50-150ms por groupBy Prisma — imperceptível. Cabeçalho SEMPRE bate
// com a lista.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const root = (p: string) => join(__dirname, '..', '..', p)
const read = (p: string) => readFileSync(root(p), 'utf-8')

describe('expenses-breakdown: SEM unstable_cache', () => {
  const code = read('lib/dashboard/expenses-breakdown.ts')

  it('NÃO importa mais unstable_cache', () => {
    expect(code).not.toMatch(/from\s+['"]next\/cache['"]/)
    expect(code).not.toMatch(/import\s*\{\s*unstable_cache\s*\}/)
  })

  it('NÃO chama mais unstable_cache no getExpenseBreakdown', () => {
    // Localiza a função e verifica ausência de CHAMADA a unstable_cache
    // (o comentário do fix pode citar o nome, mas não pode haver invocação).
    const fnBlock = code.match(/export async function getExpenseBreakdown[\s\S]+?^\}/m)?.[0] ?? ''
    expect(fnBlock).toBeTruthy()
    expect(fnBlock).not.toMatch(/unstable_cache\(/)
    // Delega direto pra loadExpenseBreakdown (sem cache intermediário).
    expect(fnBlock).toMatch(/return loadExpenseBreakdown\(input\)/)
  })

  it('NÃO tem mais CACHE_TTL nem chave "dashboard:expenses:"', () => {
    expect(code).not.toMatch(/CACHE_TTL/)
    expect(code).not.toMatch(/dashboard:expenses:/)
  })

  it('comentário do fix cita causa raiz + versão Next', () => {
    expect(code).toMatch(/Fix-Cache-Despesas/)
    expect(code).toMatch(/Next 16/)
    expect(code).toMatch(/real-time/)
  })
})

describe('loadExpenseBreakdown continua PURA (função pública inalterada)', () => {
  const code = read('lib/dashboard/expenses-breakdown.ts')

  it('loadExpenseBreakdown exposta pra scripts CLI / testes', () => {
    expect(code).toMatch(/export async function loadExpenseBreakdown/)
  })

  it('agregação groupBy por categoryId preservada', () => {
    expect(code).toMatch(/prisma\.transaction\.groupBy\(/)
    expect(code).toMatch(/by:\s*\[['"]categoryId['"]\]/)
  })

  it('filtro por EXPENSE_DRE_GROUPS preservado', () => {
    expect(code).toMatch(/EXPENSE_DRE_GROUPS/)
    expect(code).toMatch(/CUSTO_PRODUTO_VENDIDO/)
  })

  it('lifecycle EFFECTED + reconciledWithId null preservados', () => {
    expect(code).toMatch(/lifecycle:\s*['"]EFFECTED['"]/)
    expect(code).toMatch(/reconciledWithId:\s*null/)
  })
})

describe('regressão: recategorizar continua invalidando tag no route.ts', () => {
  const code = read('app/api/empresas/[id]/despesas/recategorizar/route.ts')

  it('revalidateTag preservado (não danifica o resto que depende dele)', () => {
    expect(code).toMatch(/revalidateTag\(`dashboard:\$\{companyId\}`,\s*['"]default['"]\)/)
  })
})
