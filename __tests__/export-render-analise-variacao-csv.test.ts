// Sprint Export CSV+PDF (29/05/2026) — Testes builder Análise Variação CSV.

import { describe, it, expect } from 'vitest'
import { renderAnaliseVariacaoCSV } from '@/lib/export/render/analise-variacao'
import type { AnaliseVariacaoResult } from '@/lib/relatorios/analise-variacao'

function fakeAV(overrides?: Partial<AnaliseVariacaoResult>): AnaliseVariacaoResult {
  return {
    novoLabel: 'Fevereiro/2026',
    antigoLabel: 'Janeiro/2026',
    totalNovo: 175000,
    totalAntigo: 250000,
    diferencaTotal: -75000,
    percentualTotal: -0.3,
    drivers: [
      {
        categoryId: 'irpj', categoryName: 'IRPJ',
        dreGroup: null, valorAntigo: 56000, valorNovo: 0, diferenca: -56000,
        percentual: -1, tipo: 'reduziu',
      },
      {
        categoryId: 'csll', categoryName: 'CSLL',
        dreGroup: null, valorAntigo: 22000, valorNovo: 0, diferenca: -22000,
        percentual: -1, tipo: 'reduziu',
      },
      {
        categoryId: 'aluguel', categoryName: 'Aluguel',
        dreGroup: null, valorAntigo: 8000, valorNovo: 12000, diferenca: 4000,
        percentual: 0.5, tipo: 'aumentou',
      },
    ],
    waterfallBars: [],
    aritmeticaFecha: true,
    aritmeticaResiduo: 0,
    tituloNarrativo: 'Fevereiro/2026 custou -R$ 75k a menos...',
    ...overrides,
  }
}

describe('renderAnaliseVariacaoCSV', () => {
  it('cabeçalho com labels antigo/novo', () => {
    const csv = renderAnaliseVariacaoCSV(fakeAV())
    expect(csv).toContain('Categoria,Janeiro/2026,Fevereiro/2026,Diferença,Tipo')
  })

  it('inclui BOM + decimais BR', () => {
    const csv = renderAnaliseVariacaoCSV(fakeAV())
    expect(csv.charCodeAt(0)).toBe(0xfeff)
  })

  it('filtra drivers estáveis (não inclui no CSV)', () => {
    const av = fakeAV({
      drivers: [
        ...fakeAV().drivers,
        {
          categoryId: 'estavel', categoryName: 'CategoriaEstavel',
          dreGroup: null, valorAntigo: 100, valorNovo: 105, diferenca: 5,
          percentual: 0.05, tipo: 'estavel',
        },
      ],
    })
    const csv = renderAnaliseVariacaoCSV(av)
    expect(csv).not.toContain('CategoriaEstavel')
  })

  it('valor zero (sumiu/apareceu) → célula vazia em vez de "0,00"', () => {
    const csv = renderAnaliseVariacaoCSV(fakeAV())
    // IRPJ: antigo=56000 (preenchido), novo=0 (vazio)
    expect(csv).toMatch(/IRPJ,"56\.000,00",,/)
  })

  it('linha total com soma dos antigos e novos', () => {
    const csv = renderAnaliseVariacaoCSV(fakeAV())
    expect(csv).toContain('TOTAL,"250.000,00","175.000,00","-75.000,00"')
  })

  it('tipo cronológico em pt-BR', () => {
    const csv = renderAnaliseVariacaoCSV(fakeAV())
    expect(csv).toContain('aumentou')
    expect(csv).toContain('reduziu')
  })
})
