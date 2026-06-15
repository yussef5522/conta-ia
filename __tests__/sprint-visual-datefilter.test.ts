// Sprint Visual (15/06/2026) — testes de presença + helpers presets.
// Componentes React testados via grep no código (sem renderer).

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { rangeForPreset } from '../lib/hooks/use-date-range-filter'

const ROOT = join(__dirname, '..')

describe('Sprint Visual — DateRangeFilter upgrade (popover + presets + Calendar)', () => {
  const PATH = join(ROOT, 'components/shared/DateRangeFilter.tsx')

  it('usa Popover + Calendar do design system', () => {
    const code = readFileSync(PATH, 'utf-8')
    expect(code).toMatch(/from '@\/components\/ui\/popover'/)
    expect(code).toMatch(/from '@\/components\/ui\/calendar'/)
    expect(code).toMatch(/<Popover[^>]*open=\{open\}/)
    expect(code).toMatch(/<Calendar[^>]*mode="range"/)
  })

  it('tem 7 presets em sentence case (Hoje, Ontem, Últimos 7 dias, …)', () => {
    const code = readFileSync(PATH, 'utf-8')
    for (const label of [
      "label: 'Hoje'",
      "label: 'Ontem'",
      "label: 'Últimos 7 dias'",
      "label: 'Últimos 30 dias'",
      "label: 'Este mês'",
      "label: 'Mês passado'",
      "label: 'Personalizado'",
    ]) {
      expect(code).toContain(label)
    }
  })

  it('botão trigger destacado em primary quando há valor', () => {
    const code = readFileSync(PATH, 'utf-8')
    expect(code).toMatch(/hasValue && 'bg-primary\/10/)
    expect(code).toMatch(/border-primary\/40 text-primary/)
  })

  it('formato pt-BR no botão ("11 jun – 15 jun")', () => {
    const code = readFileSync(PATH, 'utf-8')
    expect(code).toMatch(/'jan', 'fev', 'mar', 'abr', 'mai', 'jun'/)
    expect(code).toMatch(/Selecionar período/)
  })

  it('preset "Ontem" retorna ontem (helper rangeOntem)', () => {
    const code = readFileSync(PATH, 'utf-8')
    expect(code).toMatch(/function rangeOntem\(today = new Date\(\)\)/)
  })

  it('preset HOJE delegado para rangeForPreset (lib hook puro) — sem regressão', () => {
    const r = rangeForPreset('hoje', new Date('2026-06-15T12:00:00Z'))
    expect(r).toEqual({ inicio: '2026-06-15', fim: '2026-06-15' })
  })
})

describe('Sprint Visual — ActiveFilterChips', () => {
  const PATH = join(ROOT, 'components/shared/ActiveFilterChips.tsx')

  it('exporta ActiveFilterChips + ActiveChip type', () => {
    const code = readFileSync(PATH, 'utf-8')
    expect(code).toMatch(/export function ActiveFilterChips/)
    expect(code).toMatch(/export interface ActiveChip/)
  })

  it('chip tem label + botão X (onRemove)', () => {
    const code = readFileSync(PATH, 'utf-8')
    expect(code).toMatch(/chip\.label/)
    expect(code).toMatch(/onClick=\{chip\.onRemove\}/)
    expect(code).toMatch(/<X className/)
  })

  it('estilo primary (token roxo) + ring 0.5px + rounded-full', () => {
    const code = readFileSync(PATH, 'utf-8')
    expect(code).toMatch(/bg-primary\/10/)
    expect(code).toMatch(/ring-\[0\.5px\] ring-primary\/30/)
    expect(code).toMatch(/rounded-full/)
  })

  it('expõe "Limpar tudo" + contagem opcional', () => {
    const code = readFileSync(PATH, 'utf-8')
    expect(code).toMatch(/Limpar tudo/)
    expect(code).toMatch(/onClearAll/)
    expect(code).toMatch(/count !== undefined/)
  })
})

describe('Sprint Visual — calendar.tsx (shadcn) cores via tokens', () => {
  const PATH = join(ROOT, 'components/ui/calendar.tsx')

  it('range_start e range_end usam primary (token, sem hex)', () => {
    const code = readFileSync(PATH, 'utf-8')
    expect(code).toMatch(/range_start/)
    expect(code).toMatch(/range_end/)
    expect(code).toMatch(/bg-primary text-primary-foreground/)
    // range_middle usa primary/10 (claro)
    expect(code).toMatch(/range_middle/)
    expect(code).toMatch(/bg-primary\/10/)
  })

  it('reusa DayPicker (react-day-picker)', () => {
    const code = readFileSync(PATH, 'utf-8')
    expect(code).toMatch(/from 'react-day-picker'/)
    expect(code).toMatch(/<DayPicker/)
  })
})

describe('Sprint Visual — /pendentes usa ActiveFilterChips (substitui banner amarelo)', () => {
  it('importa ActiveFilterChips + usa', () => {
    const code = readFileSync(
      join(ROOT, 'app/(dashboard)/empresas/[id]/pendentes/pendentes-client.tsx'),
      'utf-8',
    )
    expect(code).toMatch(/ActiveFilterChips/)
    expect(code).toMatch(/<ActiveFilterChips[\s\S]*?count=/)
    // banner antigo amber removido
    expect(code).not.toMatch(/bg-amber-50/)
    expect(code).not.toMatch(/border-amber-200/)
  })
})
