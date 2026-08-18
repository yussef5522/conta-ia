import { describe, it, expect } from 'vitest'
import { computeVendasDiarias, type VendaDiariaComputada } from '../compute-vendas-diarias'
import { feriadosNacionais, diaUTC } from '../feriados-nacionais'
import { buildInputs, REGRAS_CACULA, MODULE_INICIO } from './fixtures/vendas-cacula-agosto'

// GOLDEN travado pelo dono (17/08): as vendas reais de 12-17/08 batem ao centavo.
// Qualquer refactor que mude 1 centavo → o teste grita.

const F = feriadosNacionais(2026)
const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const run = () => computeVendasDiarias(buildInputs(), REGRAS_CACULA, F, MODULE_INICIO)

// Soma das VendaDiaria cuja competência cai DENTRO de [de..ate] (inclui bloco).
const somaNoIntervalo = (vs: VendaDiariaComputada[], de: string, ate: string, meio?: string) =>
  round2(
    vs
      .filter((v) => diaUTC(v.dataCompetencia) >= de && diaUTC(v.dataCompetenciaFim) <= ate && (!meio || v.meio === meio))
      .reduce((s, v) => s + v.valorLiquido, 0),
  )

describe('GOLDEN vendas Cacula 12-17/08 (travado ao centavo)', () => {
  const vs = run()

  it('ter 12/08 = 11.919,65 (cartão 5.705,25 · PIX 4.191,40 · dinheiro 2.023,00)', () => {
    expect(somaNoIntervalo(vs, '2026-08-12', '2026-08-12')).toBe(11919.65)
    expect(somaNoIntervalo(vs, '2026-08-12', '2026-08-12', 'CARTAO')).toBe(5705.25)
    expect(somaNoIntervalo(vs, '2026-08-12', '2026-08-12', 'PIX')).toBe(4191.40)
    expect(somaNoIntervalo(vs, '2026-08-12', '2026-08-12', 'DINHEIRO')).toBe(2023.00)
  })

  it('qua 13/08 = 10.468,80 (cartão 4.230,67 · PIX 4.459,13 · dinheiro 1.779,00)', () => {
    expect(somaNoIntervalo(vs, '2026-08-13', '2026-08-13')).toBe(10468.80)
    expect(somaNoIntervalo(vs, '2026-08-13', '2026-08-13', 'CARTAO')).toBe(4230.67)
    expect(somaNoIntervalo(vs, '2026-08-13', '2026-08-13', 'PIX')).toBe(4459.13)
    expect(somaNoIntervalo(vs, '2026-08-13', '2026-08-13', 'DINHEIRO')).toBe(1779.00)
  })

  it('fim de semana {14..16} = 62.090,93 (cartão bloco 28.422,17 · PIX 24.048,76 · dinheiro 9.620,00)', () => {
    expect(somaNoIntervalo(vs, '2026-08-14', '2026-08-16')).toBe(62090.93)
    expect(somaNoIntervalo(vs, '2026-08-14', '2026-08-16', 'CARTAO')).toBe(28422.17)
    expect(somaNoIntervalo(vs, '2026-08-14', '2026-08-16', 'PIX')).toBe(24048.76)
    expect(somaNoIntervalo(vs, '2026-08-14', '2026-08-16', 'DINHEIRO')).toBe(9620.00)
  })

  it('cartão do fim de semana é UM bloco {14..16}, não dividido', () => {
    const blocos = vs.filter((v) => v.meio === 'CARTAO' && v.isBloco)
    expect(blocos).toHaveLength(1)
    expect(diaUTC(blocos[0].dataCompetencia)).toBe('2026-08-14')
    expect(diaUTC(blocos[0].dataCompetenciaFim)).toBe('2026-08-16')
    expect(blocos[0].valorLiquido).toBe(28422.17)
  })

  it('Tuna 17/08 dividida sex/sáb/dom: 5.780,17→14 · 7.979,80→15 · 8.587,17→16 (via origem)', () => {
    const origemNoDia = (dia: string, valor: number) =>
      vs.some((v) => v.meio === 'PIX' && diaUTC(v.dataCompetencia) === dia && !v.isBloco && v.origens.some((o) => o.valor === valor && o.competenciaDia === dia))
    expect(origemNoDia('2026-08-14', 5780.17)).toBe(true)
    expect(origemNoDia('2026-08-15', 7979.80)).toBe(true)
    expect(origemNoDia('2026-08-16', 8587.17)).toBe(true)
  })

  it('11/08 DROPADO (dia incompleto, pré-corte): nenhuma VendaDiaria antes de 12/08', () => {
    expect(vs.every((v) => diaUTC(v.dataCompetencia) >= '2026-08-12')).toBe(true)
  })

  it('toda origem está linkada (N:1 completo) e a soma das origens == valorLiquido', () => {
    for (const v of vs) {
      expect(v.origens.length).toBeGreaterThan(0)
      expect(round2(v.origens.reduce((s, o) => s + o.valor, 0))).toBe(v.valorLiquido)
    }
  })

  it('IDEMPOTÊNCIA: rodar 2× dá exatamente o mesmo resultado', () => {
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()))
  })
})
