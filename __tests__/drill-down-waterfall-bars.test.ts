// Sprint Drill-Down (29/05/2026) — Garantia que WaterfallBar.categoryId
// é propagado em ambas as funções (buildWaterfallBars + From Selection).

import { describe, it, expect } from 'vitest'
import {
  buildWaterfallBars,
  analiseVariacao,
  type DriverVariacao,
} from '@/lib/relatorios/analise-variacao'
import type { ComparativoInputTx } from '@/lib/relatorios/comparativo'

function driver(
  id: string,
  name: string,
  diferenca: number,
  tipo: DriverVariacao['tipo'] = 'aumentou',
): DriverVariacao {
  return {
    categoryId: id,
    categoryName: name,
    dreGroup: null,
    valorNovo: Math.max(0, diferenca),
    valorAntigo: Math.max(0, -diferenca),
    diferenca,
    percentual: null,
    tipo,
  }
}

describe('Drill-Down: WaterfallBar.categoryId propagado', () => {
  it('buildWaterfallBars: bars de driver carregam categoryId', () => {
    const drivers = [
      driver('cat-irpj', 'IRPJ', -56_000, 'reduziu'),
      driver('cat-csll', 'CSLL', -22_000, 'reduziu'),
    ]
    const bars = buildWaterfallBars(drivers, 1000, 1000 - 78_000, 'Fev', 'Jan')
    // bars[0] = inicio, bars[1..N] = drivers, bars[last] = fim
    const driverBars = bars.filter(
      (b) => b.tipo === 'aumento' || b.tipo === 'reducao',
    )
    expect(driverBars.length).toBeGreaterThan(0)
    for (const b of driverBars) {
      if (b.isOutros) continue
      expect(b.categoryId).toBeDefined()
      expect(b.categoryId).not.toBeNull()
    }
  })

  it('buildWaterfallBars: bars inicio/fim NÃO têm categoryId', () => {
    const drivers = [driver('cat-x', 'X', 1_000, 'aumentou')]
    const bars = buildWaterfallBars(drivers, 1000, 2000, 'Fev', 'Jan')
    const inicio = bars.find((b) => b.tipo === 'inicio')
    const fim = bars.find((b) => b.tipo === 'fim')
    expect(inicio?.categoryId).toBeUndefined()
    expect(fim?.categoryId).toBeUndefined()
  })

  it('analiseVariacao: bars de driver com categoryId; outros sem', () => {
    const txs: ComparativoInputTx[] = []
    // 8 categorias com valores ≥ threshold → algumas vão pra "Outros"
    for (let i = 0; i < 8; i++) {
      txs.push({
        bucketDate: new Date('2026-01-15T12:00:00Z'),
        amount: 10_000 + i * 1_000,
        type: 'DEBIT',
        categoryId: `c${i}`,
        categoryName: `Cat${i}`,
        dreGroup: null,
      })
      txs.push({
        bucketDate: new Date('2026-02-15T12:00:00Z'),
        amount: 8_000 + i * 500,
        type: 'DEBIT',
        categoryId: `c${i}`,
        categoryName: `Cat${i}`,
        dreGroup: null,
      })
    }
    const r = analiseVariacao({
      mode: 'mes-vs-mes',
      txs,
      mesAntigo: '2026-01',
      mesNovo: '2026-02',
      tipo: 'DESPESA',
    })
    for (const bar of r.waterfallBars) {
      if (bar.tipo === 'inicio' || bar.tipo === 'fim') {
        expect(bar.categoryId).toBeUndefined()
      } else if (bar.isOutros) {
        // "Outros" agrupa múltiplas categorias → não drilla
        expect(bar.categoryId).toBeUndefined()
      } else {
        // Driver individual deve ter categoryId
        expect(bar.categoryId).toBeTypeOf('string')
        expect(bar.categoryId).not.toBe('')
      }
    }
  })

  it('analiseVariacao: categoryId do bar bate com o driver de origem', () => {
    const txs: ComparativoInputTx[] = [
      {
        bucketDate: new Date('2026-01-15T12:00:00Z'),
        amount: 50_000,
        type: 'DEBIT',
        categoryId: 'cat-irpj',
        categoryName: 'IRPJ',
        dreGroup: null,
      },
    ]
    const r = analiseVariacao({
      mode: 'mes-vs-mes',
      txs,
      mesAntigo: '2026-01',
      mesNovo: '2026-02',
      tipo: 'DESPESA',
    })
    const irpjBar = r.waterfallBars.find((b) => b.label === 'IRPJ')
    expect(irpjBar).toBeDefined()
    expect(irpjBar?.categoryId).toBe('cat-irpj')
  })
})
