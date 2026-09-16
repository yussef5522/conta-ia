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

  it('botão trigger destacado em primary quando há valor (Sprint Frontend renomeou pra hasCommittedValue)', () => {
    const code = readFileSync(PATH, 'utf-8')
    expect(code).toMatch(/hasCommittedValue && 'bg-primary\/10/)
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
  // A decisão de design real: o INDICADOR DE FILTRO ATIVO em /pendentes é o
  // ActiveFilterChips (chips roxos), NÃO um banner amarelo de estado de filtro.
  // O teste original barrava `bg-amber-50` no arquivo inteiro como proxy de "o
  // banner de filtro sumiu" — proxy ruim: quebra sempre que alguém adiciona um
  // CTA âmbar legítimo e SEM relação com filtro (ex.: reclassificar CDB, Sprint
  // 02/08). Não há regra de design reservando âmbar (é cor semântica de atenção,
  // usada em vários CTAs). Então a proteção certa é afirmar o indicador de filtro,
  // não caçar cor no arquivo todo.
    /**
   * ⚠️⚠️ REAPONTADO EM 15/09 — A TELA MORREU, E A RÉGUA MUDOU DE LADO.
   *
   * `/pendentes` deixou de existir: ela era a **segunda fila** sobre o mesmo extrato (a
   * linha aparecia lá sem categoria E na Conciliação sem vínculo), e virou a **CAIXA DE
   * ENTRADA**, com duas abas por sentido.
   *
   * ⛔ **E o filtro de período NÃO foi realocado, de propósito** — é a régua desta casa
   * desde 14/09: *"Pendentes é FILA DE TRABALHO e NUNCA ganha mês: esconder pendente antigo
   * é esconder trabalho, e foi assim que 21 notas ficaram invisíveis"*. A caixa é fila, não
   * lista; quem navega por período é **Movimentações**, o arquivo. O que a caixa tem no
   * lugar é o **corte de época**, que é outra coisa: ele diz de quando o dono começou a
   * conciliar, não esconde o que ele ainda não resolveu.
   */
  it('⛔ a caixa de entrada é FILA — e fila não ganha filtro de período', () => {
    const caixa = readFileSync(join(ROOT, 'components/conciliacao/caixa-de-entrada.tsx'), 'utf-8')
    expect(caixa).not.toMatch(/DateRangeFilter|useDateRangeFilter/)
    // ⭐ e o corte de época (que é outra coisa) mora no servidor, não na tela
    const rota = readFileSync(join(ROOT, 'app/api/conciliacao/caixa/route.ts'), 'utf-8')
    expect(rota).toContain('conciliarAPartirDe')
})
})
