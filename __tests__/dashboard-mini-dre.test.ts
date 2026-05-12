import { describe, it, expect } from 'vitest'
import { computeMiniDRE } from '@/lib/dashboard/compute-mini-dre'
import type { DRETotals } from '@/lib/dre/types'

function makeTotals(overrides: Partial<DRETotals> = {}): DRETotals {
  return {
    receitaBruta: 0,
    totalDeducoes: 0,
    receitaLiquida: 0,
    totalCustos: 0,
    lucroBruto: 0,
    totalOutrasReceitas: 0,
    totalDespesasPessoal: 0,
    totalDespesasComerciais: 0,
    totalDespesasAdministrativas: 0,
    totalOutrasDespesas: 0,
    totalDespesasOperacionais: 0,
    resultadoOperacional: 0,
    receitasFinanceiras: 0,
    despesasFinanceiras: 0,
    resultadoFinanceiro: 0,
    lair: 0,
    impostosSobreLucro: 0,
    lucroLiquido: 0,
    margemBruta: 0,
    margemOperacional: 0,
    margemLiquida: 0,
    ...overrides,
  }
}

describe('computeMiniDRE — Sprint 1 Dia 2', () => {
  it('retorna 5 linhas na ordem oficial', () => {
    const r = computeMiniDRE(makeTotals(), makeTotals(), 'comp-1')
    expect(r.lines).toHaveLength(5)
    expect(r.lines.map((l) => l.id)).toEqual([
      'receita-bruta',
      'deducoes',
      'lucro-bruto',
      'resultado-operacional',
      'lucro-liquido',
    ])
  })

  it('label "Resultado Operacional" (não "EBITDA")', () => {
    const r = computeMiniDRE(makeTotals(), makeTotals(), 'comp-1')
    const ro = r.lines.find((l) => l.id === 'resultado-operacional')!
    expect(ro.label).toBe('Resultado Operacional')
    expect(ro.label).not.toContain('EBITDA')
  })

  it('valores corretos copiados de totals', () => {
    const r = computeMiniDRE(
      makeTotals({
        receitaBruta: 100_000,
        totalDeducoes: 10_000,
        lucroBruto: 80_000,
        resultadoOperacional: 50_000,
        lucroLiquido: 30_000,
      }),
      makeTotals(),
      'comp-1',
    )
    expect(r.lines[0].value).toBe(100_000)
    expect(r.lines[1].value).toBe(10_000)
    expect(r.lines[2].value).toBe(80_000)
    expect(r.lines[3].value).toBe(50_000)
    expect(r.lines[4].value).toBe(30_000)
  })

  it('Lucro Líquido tem highlighted=true, outros não', () => {
    const r = computeMiniDRE(makeTotals(), makeTotals(), 'comp-1')
    const highlighted = r.lines.filter((l) => l.highlighted)
    expect(highlighted).toHaveLength(1)
    expect(highlighted[0].id).toBe('lucro-liquido')
  })

  it('Deduções marcada como isReduction (exibida negativa)', () => {
    const r = computeMiniDRE(makeTotals(), makeTotals(), 'comp-1')
    const deducoes = r.lines.find((l) => l.id === 'deducoes')!
    expect(deducoes.isReduction).toBe(true)
    const receita = r.lines.find((l) => l.id === 'receita-bruta')!
    expect(receita.isReduction).toBe(false)
  })

  it('deltas: receita +20%, semantic higher-is-better → direction=up', () => {
    const r = computeMiniDRE(
      makeTotals({ receitaBruta: 120_000 }),
      makeTotals({ receitaBruta: 100_000 }),
      'comp-1',
    )
    const rec = r.lines.find((l) => l.id === 'receita-bruta')!
    expect(rec.deltaAbsolute).toBe(20_000)
    expect(rec.deltaPercent).toBe(20)
    expect(rec.deltaDirection).toBe('up')
  })

  it('Deduções subiram → direction=DOWN (lower-is-better em deduções)', () => {
    const r = computeMiniDRE(
      makeTotals({ totalDeducoes: 15_000 }),
      makeTotals({ totalDeducoes: 10_000 }),
      'comp-1',
    )
    const ded = r.lines.find((l) => l.id === 'deducoes')!
    expect(ded.deltaAbsolute).toBe(5_000)
    expect(ded.deltaDirection).toBe('down') // deduções subindo = ruim
  })

  it('Lucro Bruto caiu → direction=down', () => {
    const r = computeMiniDRE(
      makeTotals({ lucroBruto: 50_000 }),
      makeTotals({ lucroBruto: 80_000 }),
      'comp-1',
    )
    const lb = r.lines.find((l) => l.id === 'lucro-bruto')!
    expect(lb.deltaDirection).toBe('down')
  })

  it('previous=0 → deltaPercent=null mas direction calculável', () => {
    const r = computeMiniDRE(
      makeTotals({ lucroLiquido: 5_000 }),
      makeTotals(),
      'comp-1',
    )
    const ll = r.lines.find((l) => l.id === 'lucro-liquido')!
    expect(ll.deltaAbsolute).toBe(5_000)
    expect(ll.deltaPercent).toBeNull()
    expect(ll.deltaDirection).toBe('up')
  })

  it('current=previous → direction=flat', () => {
    const r = computeMiniDRE(
      makeTotals({ receitaBruta: 100_000 }),
      makeTotals({ receitaBruta: 100_000 }),
      'comp-1',
    )
    const rec = r.lines.find((l) => l.id === 'receita-bruta')!
    expect(rec.deltaAbsolute).toBe(0)
    expect(rec.deltaDirection).toBe('flat')
  })

  it('margemLiquida copiada de totals', () => {
    const r = computeMiniDRE(
      makeTotals({ margemLiquida: 18.5 }),
      makeTotals(),
      'comp-1',
    )
    expect(r.margemLiquida).toBe(18.5)
  })

  it('companyId vazio LANÇA (multi-tenant guard)', () => {
    expect(() => computeMiniDRE(makeTotals(), makeTotals(), '')).toThrow(/multi-tenant/i)
  })

  it('result.companyId === input.companyId', () => {
    const r = computeMiniDRE(makeTotals(), makeTotals(), 'comp-academia-3')
    expect(r.companyId).toBe('comp-academia-3')
  })
})
