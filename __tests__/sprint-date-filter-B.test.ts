// Sprint Filtro de Data Parte B — testes de presença + helper puro.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { readDateRangeParams } from '../lib/api/date-range-params'

const ROOT = join(__dirname, '..')

describe('readDateRangeParams — aliases', () => {
  function sp(obj: Record<string, string>): URLSearchParams {
    const u = new URLSearchParams()
    for (const [k, v] of Object.entries(obj)) u.set(k, v)
    return u
  }

  it('inicio/fim — convenção principal', () => {
    expect(readDateRangeParams(sp({ inicio: '2026-06-01', fim: '2026-06-30' })))
      .toEqual({ inicio: '2026-06-01', fim: '2026-06-30' })
  })
  it('dataDe/dataAte — legacy contas-a-pagar', () => {
    expect(readDateRangeParams(sp({ dataDe: '2026-06-01', dataAte: '2026-06-30' })))
      .toEqual({ inicio: '2026-06-01', fim: '2026-06-30' })
  })
  it('startDate/endDate — DRE/fluxo', () => {
    expect(readDateRangeParams(sp({ startDate: '2026-06-01', endDate: '2026-06-30' })))
      .toEqual({ inicio: '2026-06-01', fim: '2026-06-30' })
  })
  it('from/to — relatórios', () => {
    expect(readDateRangeParams(sp({ from: '2026-06-01', to: '2026-06-30' })))
      .toEqual({ inicio: '2026-06-01', fim: '2026-06-30' })
  })
  it('vazio quando nenhum param presente', () => {
    expect(readDateRangeParams(sp({}))).toEqual({ inicio: '', fim: '' })
  })
  it('inicio/fim ganha precedência sobre os outros', () => {
    expect(
      readDateRangeParams(
        sp({
          inicio: '2026-06-01', fim: '2026-06-30',
          dataDe: '2025-01-01', dataAte: '2025-12-31',
          startDate: '2024-01-01', endDate: '2024-12-31',
          from: '2023-01-01', to: '2023-12-31',
        }),
      ),
    ).toEqual({ inicio: '2026-06-01', fim: '2026-06-30' })
  })
})

describe('Sprint Filtro de Data Parte B — backend', () => {
  it('/api/contas-a-receber lê inicio/fim e mapeia pra dueDate', () => {
    const code = readFileSync(join(ROOT, 'app/api/contas-a-receber/route.ts'), 'utf-8')
    expect(code).toMatch(/readDateRangeParams/)
    expect(code).toMatch(/where\.dueDate\s*=\s*\{/)
    expect(code).toMatch(/gte:\s*new Date\(inicio\)/)
    expect(code).toMatch(/lte:\s*new Date\(fim/)
  })

  it('DRE aceita ?inicio=&fim= como alias de startDate/endDate', () => {
    const code = readFileSync(join(ROOT, 'app/api/empresas/[id]/dre/route.ts'), 'utf-8')
    expect(code).toMatch(/!rawQuery\.startDate\s*&&\s*rawQuery\.inicio/)
    expect(code).toMatch(/!rawQuery\.endDate\s*&&\s*rawQuery\.fim/)
  })

  it('relatórios fornecedores/funcionarios/categorias aceitam inicio/fim como alias de from/to', () => {
    for (const f of ['fornecedores', 'funcionarios', 'categorias']) {
      const code = readFileSync(
        join(ROOT, `app/api/empresas/[id]/relatorios/${f}/route.ts`),
        'utf-8',
      )
      expect(code).toMatch(/!raw\.from\s*&&\s*raw\.inicio/)
      expect(code).toMatch(/!raw\.to\s*&&\s*raw\.fim/)
    }
  })

  it('/api/transferencias usa groupBy(transferGroupId) pra count (não Math.floor(/2))', () => {
    const code = readFileSync(join(ROOT, 'app/api/transferencias/route.ts'), 'utf-8')
    expect(code).toMatch(/prisma\.transaction\.groupBy/)
    expect(code).toMatch(/by:\s*\[?'transferGroupId'\]?/)
    expect(code).not.toMatch(/Math\.floor\(totalTransacoesTransfer\s*\/\s*2\)/)
  })
})

describe('Sprint Filtro de Data Parte B — UI', () => {
  it('/contas-a-pagar PayableFilters usa DateRangeFilter (não input solto)', () => {
    const code = readFileSync(
      join(ROOT, 'components/contas-pagar/PayableFilters.tsx'),
      'utf-8',
    )
    expect(code).toMatch(/DateRangeFilter/)
    expect(code).toMatch(/dateField="dueDate"/)
  })

  it('/contas-a-receber usa DateRangeFilter + useDateRangeFilter', () => {
    const code = readFileSync(
      join(ROOT, 'app/(dashboard)/contas-a-receber/page.tsx'),
      'utf-8',
    )
    expect(code).toMatch(/DateRangeFilter/)
    expect(code).toMatch(/useDateRangeFilter/)
    expect(code).toMatch(/dateField="dueDate"/)
  })

  it('3 relatórios (fornecedores/funcionarios/categorias) usam DateRangeFilter + useDateRangeFilter', () => {
    for (const f of ['fornecedores', 'funcionarios', 'categorias']) {
      const code = readFileSync(
        join(ROOT, `app/(dashboard)/empresas/[id]/relatorios/${f}/${f}-client.tsx`),
        'utf-8',
      )
      expect(code).toMatch(/DateRangeFilter/)
      expect(code).toMatch(/useDateRangeFilter/)
    }
  })
})
