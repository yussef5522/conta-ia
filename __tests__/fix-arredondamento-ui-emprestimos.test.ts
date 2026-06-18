// Fix Arredondamento UI Empréstimos (17/06/2026)
// Bug: previa mostrava "0.35000000000000003% a.m." (lixo de float).
// Causa: String(0.0035 * 100). Fix: cleanFloat + fmtPercentValue/fmtRateMonthly.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fmtRateMonthly, fmtPercentValue, cleanFloat } from '@/lib/loans/format'

describe('Fix arredondamento — helpers', () => {
  it('fmtRateMonthly(0.0035) = "0,35% a.m." (vírgula PT-BR)', () => {
    expect(fmtRateMonthly(0.0035)).toBe('0,35% a.m.')
  })

  it('fmtRateMonthly(0.025) = "2,50% a.m." (preserva trailing zero)', () => {
    expect(fmtRateMonthly(0.025)).toBe('2,50% a.m.')
  })

  it('fmtRateMonthly arredonda excedentes (lixo de float)', () => {
    expect(fmtRateMonthly(0.0035000000000000003)).toBe('0,35% a.m.')
  })

  it('fmtRateMonthly inválido → "—"', () => {
    expect(fmtRateMonthly(NaN)).toBe('—')
    expect(fmtRateMonthly(Infinity)).toBe('—')
  })

  it('fmtPercentValue aceita string + number; PT-BR; 2 casas', () => {
    expect(fmtPercentValue(0.35)).toBe('0,35')
    expect(fmtPercentValue('0.35000000000000003')).toBe('0,35')
    expect(fmtPercentValue('2.5')).toBe('2,50')
    expect(fmtPercentValue('foo')).toBe('—')
  })

  it('cleanFloat(0.0035 * 100) = 0.35 (sem lixo)', () => {
    expect(cleanFloat(0.0035 * 100)).toBe(0.35)
  })

  it('cleanFloat preserva precisão real', () => {
    expect(cleanFloat(0.123456789, 6)).toBe(0.123457)
  })

  it('cleanFloat(NaN) = 0 (defensivo)', () => {
    expect(cleanFloat(NaN)).toBe(0)
  })
})

describe('Fix arredondamento — uso nas telas', () => {
  const ROOT = join(__dirname, '..')

  it('novo/page.tsx usa fmtPercentValue na exibição da taxa pré', () => {
    const code = readFileSync(
      join(ROOT, 'app/(dashboard)/empresas/[id]/emprestimos/novo/page.tsx'),
      'utf-8',
    )
    expect(code).toMatch(/fmtPercentValue\(form\.interestRateMonthly\)/)
    expect(code).not.toMatch(/\{form\.interestRateMonthly\}%\s*a\.m\./)
  })

  it('novo/page.tsx usa cleanFloat na preenchedora AI da taxa', () => {
    const code = readFileSync(
      join(ROOT, 'app/(dashboard)/empresas/[id]/emprestimos/novo/page.tsx'),
      'utf-8',
    )
    expect(code).toMatch(/cleanFloat\(e\.taxaPreMensal \* 100\)/)
  })

  it('detalhe e carteira usam fmtRateMonthly (não .toFixed direto)', () => {
    const detalhe = readFileSync(
      join(ROOT, 'app/(dashboard)/empresas/[id]/emprestimos/[loanId]/page.tsx'),
      'utf-8',
    )
    const carteira = readFileSync(
      join(ROOT, 'app/(dashboard)/empresas/[id]/emprestimos/page.tsx'),
      'utf-8',
    )
    expect(detalhe).toMatch(/fmtRateMonthly/)
    expect(carteira).toMatch(/fmtRateMonthly/)
    // não tem mais o ad-hoc .toFixed(2)% a.m. em detalhe
    expect(detalhe).not.toMatch(/\(r \* 100\)\.toFixed\(2\)/)
  })
})
