// Sprint Filtro de Data Parte A — testes de presença + helpers puros.
// (a) /api/transferencias filtra por data (lê código)
// (b) helper rangeForPreset retorna intervalos consistentes
// (c) /api/transacoes cap subiu pra 500

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { rangeForPreset } from '../lib/hooks/use-date-range-filter'

const ROOT = join(__dirname, '..')

describe('Sprint Filtro de Data Parte A — backend honra inicio/fim', () => {
  it('/api/transferencias monta dateFilter (gte/lte) quando inicio/fim presentes', () => {
    const code = readFileSync(join(ROOT, 'app/api/transferencias/route.ts'), 'utf-8')
    expect(code).toMatch(/searchParams\.get\('inicio'\)/)
    expect(code).toMatch(/searchParams\.get\('fim'\)/)
    expect(code).toMatch(/dateFilter\.gte\s*=\s*new Date\(inicio\)/)
    expect(code).toMatch(/dateFilter\.lte\s*=\s*new Date\(fim/)
    expect(code).toMatch(/date: dateFilter/)
  })

  it('/api/transacoes cap subiu de 100 → 500', () => {
    const code = readFileSync(join(ROOT, 'app/api/transacoes/route.ts'), 'utf-8')
    expect(code).toMatch(/Math\.min\(500,/)
    expect(code).not.toMatch(/limit = Math\.min\(100,/)
  })
})

describe('rangeForPreset (helper puro)', () => {
  const ref = new Date('2026-06-15T12:00:00Z')

  it('hoje = hoje..hoje', () => {
    const r = rangeForPreset('hoje', ref)
    expect(r).toEqual({ inicio: '2026-06-15', fim: '2026-06-15' })
  })

  it('ultimos-7d = inclui hoje (7 dias)', () => {
    const r = rangeForPreset('ultimos-7d', ref)
    expect(r).toEqual({ inicio: '2026-06-09', fim: '2026-06-15' })
  })

  it('ultimos-30d = 30 dias contando hoje', () => {
    const r = rangeForPreset('ultimos-30d', ref)
    expect(r).toEqual({ inicio: '2026-05-17', fim: '2026-06-15' })
  })

  it('mes-atual = 01 → último dia do mês', () => {
    const r = rangeForPreset('mes-atual', ref)
    expect(r).toEqual({ inicio: '2026-06-01', fim: '2026-06-30' })
  })

  it('mes-passado = mês anterior inteiro', () => {
    const r = rangeForPreset('mes-passado', ref)
    expect(r).toEqual({ inicio: '2026-05-01', fim: '2026-05-31' })
  })

  it('virada de ano em mes-passado (janeiro)', () => {
    const jan = new Date('2026-01-10T12:00:00Z')
    const r = rangeForPreset('mes-passado', jan)
    expect(r).toEqual({ inicio: '2025-12-01', fim: '2025-12-31' })
  })

  it('virada de ano em mes-atual (dezembro)', () => {
    const dez = new Date('2026-12-15T12:00:00Z')
    const r = rangeForPreset('mes-atual', dez)
    expect(r).toEqual({ inicio: '2026-12-01', fim: '2026-12-31' })
  })
})

describe('Sprint Filtro de Data Parte A — uso compartilhado nas 3 páginas', () => {
  it('/pendentes usa useDateRangeFilter + DateRangeFilter', () => {
    const code = readFileSync(
      join(ROOT, 'app/(dashboard)/empresas/[id]/pendentes/pendentes-client.tsx'),
      'utf-8',
    )
    expect(code).toMatch(/useDateRangeFilter/)
    expect(code).toMatch(/DateRangeFilter/)
    expect(code).toMatch(/totalReal/)
    expect(code).toMatch(/Mostrando/)
    expect(code).toMatch(/Filtros ativos/)
  })

  it('/conciliacao usa useDateRangeFilter + DateRangeFilter (sem mais Select 30d/60d/90d)', () => {
    const code = readFileSync(join(ROOT, 'app/(dashboard)/conciliacao/page.tsx'), 'utf-8')
    expect(code).toMatch(/useDateRangeFilter/)
    expect(code).toMatch(/DateRangeFilter/)
    // Não deve mais existir o periodo state nem o Select de 30d/60d/90d
    expect(code).not.toMatch(/const \[periodo, setPeriodo\]/)
    expect(code).not.toMatch(/value="30d"/)
  })

  it('/transferencias usa useDateRangeFilter + DateRangeFilter (não inputs soltos)', () => {
    const code = readFileSync(
      join(ROOT, 'app/(dashboard)/empresas/[id]/transferencias/page.tsx'),
      'utf-8',
    )
    expect(code).toMatch(/useDateRangeFilter/)
    expect(code).toMatch(/DateRangeFilter/)
    // O fetch deve enviar inicio/fim na query
    expect(code).toMatch(/qs\.set\('inicio',\s*dataInicio\)/)
    expect(code).toMatch(/qs\.set\('fim',\s*dataFim\)/)
  })
})
