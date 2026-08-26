// V6 — o invariante que impede as duas telas de contarem histórias diferentes.
// Nasceu do 26/08: Vendas ~595 mil vs Fluxo ~425 mil pro mesmo agosto, em silêncio.

import { describe, it, expect } from 'vitest'
import { conferirConsistencia, explicarConsistencia, type LinhaVendaComOrigem } from '../consistencia-caixa'

const d = (s: string) => new Date(`${s}T00:00:00.000Z`)
const AGO_INI = d('2026-08-01')
const AGO_FIM = d('2026-09-01')

const linha = (comp: string, fim: string, valor: number, entradas: [string, number][]): LinhaVendaComOrigem => ({
  dataCompetencia: d(comp), dataCompetenciaFim: d(fim), valorLiquido: valor,
  entradas: entradas.map(([data, v]) => ({ data: d(data), valor: v })),
})

describe('V6 — a ponte Vendas × Caixa', () => {
  it('mês sem borda nenhuma: os dois números são IGUAIS', () => {
    const r = conferirConsistencia([
      linha('2026-08-05', '2026-08-05', 1000, [['2026-08-06', 1000]]),
      linha('2026-08-10', '2026-08-10', 500, [['2026-08-11', 500]]),
    ], AGO_INI, AGO_FIM)
    expect(r.vendasDoMes).toBe(1500)
    expect(r.caixaDoMes).toBe(1500)
    expect(r.inexplicado).toBe(0)
    expect(r.fecha).toBe(true)
  })

  it('⭐ venda de JULHO recebida em agosto: caixa MAIOR, e a borda explica', () => {
    const r = conferirConsistencia([
      // o bloco de borda real: competência 31/07, dinheiro entrou 03/08
      linha('2026-07-31', '2026-08-02', 43106.03, [['2026-08-03', 43106.03]]),
      linha('2026-08-05', '2026-08-05', 1000, [['2026-08-06', 1000]]),
    ], AGO_INI, AGO_FIM)
    expect(r.vendasDoMes).toBe(1000)              // competência de agosto só
    expect(r.caixaDoMes).toBe(44106.03)           // caixa recebeu os dois
    expect(r.bordaRecebidaDeAntes).toBe(43106.03) // e a borda é exatamente a diferença
    expect(r.inexplicado).toBe(0)
    expect(r.fecha).toBe(true)
  })

  it('venda de agosto que só cai em setembro: caixa MENOR, borda a receber explica', () => {
    const r = conferirConsistencia([
      linha('2026-08-30', '2026-08-30', 2000, [['2026-09-01', 2000]]),
      linha('2026-08-05', '2026-08-05', 1000, [['2026-08-06', 1000]]),
    ], AGO_INI, AGO_FIM)
    expect(r.vendasDoMes).toBe(3000)
    expect(r.caixaDoMes).toBe(1000)
    expect(r.bordaAReceber).toBe(2000)
    expect(r.fecha).toBe(true)
  })

  it('as DUAS bordas ao mesmo tempo (o caso normal de todo mês)', () => {
    const r = conferirConsistencia([
      linha('2026-07-31', '2026-08-02', 43106.03, [['2026-08-03', 43106.03]]),
      linha('2026-08-30', '2026-08-30', 2000, [['2026-09-01', 2000]]),
      linha('2026-08-05', '2026-08-05', 1000, [['2026-08-06', 1000]]),
    ], AGO_INI, AGO_FIM)
    expect(r.vendasDoMes).toBe(3000)
    expect(r.caixaDoMes).toBe(44106.03)
    expect(r.bordaRecebidaDeAntes).toBe(43106.03)
    expect(r.bordaAReceber).toBe(2000)
    expect(r.fecha).toBe(true)
  })

  it('⭐⭐ O BUG REAL: VendaDiaria DUPLICADA → o juiz FICA VERMELHO', () => {
    // 5 cópias do bloco, como estava em prod, mas o caixa recebeu UMA vez.
    const bloco = linha('2026-07-31', '2026-08-02', 43106.03, [['2026-08-03', 43106.03]])
    const duplicado = linha('2026-08-05', '2026-08-05', 10000, [['2026-08-06', 10000]])
    const r = conferirConsistencia([bloco, duplicado, { ...duplicado, entradas: [] }], AGO_INI, AGO_FIM)
    // Vendas conta 20.000 (a duplicata soma), o caixa só viu 10.000
    expect(r.vendasDoMes).toBe(20000)
    expect(r.fecha).toBe(false)
    expect(Math.abs(r.inexplicado)).toBeCloseTo(10000, 2)
  })

  it('a frase do alerta NOMEIA os dois números e a parte inexplicada', () => {
    const r = conferirConsistencia([
      linha('2026-08-05', '2026-08-05', 10000, []),
    ], AGO_INI, AGO_FIM)
    const f = explicarConsistencia(r, 'agosto/2026')
    expect(f).toMatch(/Vendas/)
    expect(f).toMatch(/Fluxo de Caixa/)
    expect(f).toMatch(/NÃO é borda/)
  })

  it('tolerância de ±1 real absorve arredondamento, não dado faltando', () => {
    const ok = conferirConsistencia([linha('2026-08-05', '2026-08-05', 1000.4, [['2026-08-06', 1000]])], AGO_INI, AGO_FIM)
    expect(ok.fecha).toBe(true)
    const nao = conferirConsistencia([linha('2026-08-05', '2026-08-05', 1010, [['2026-08-06', 1000]])], AGO_INI, AGO_FIM)
    expect(nao.fecha).toBe(false)
  })

  it('mês vazio não quebra nem inventa divergência', () => {
    const r = conferirConsistencia([], AGO_INI, AGO_FIM)
    expect(r).toMatchObject({ vendasDoMes: 0, caixaDoMes: 0, inexplicado: 0, fecha: true })
  })
})


// A 3ª BORDA (26/08): receita que entrou no caixa do mês mas cuja VENDA é anterior ao
// início do módulo. Caso real: 2 vendas em dinheiro que caíram no cofre em 01/08 —
// o cofre é D+1 corrido, então são venda de 31/07, e julho não é computado.
// R$ 2.966,35 que o Fluxo via e a ponte ignorava.
describe('3ª borda — receita no caixa sem VendaDiaria (venda antes do módulo)', () => {
  it('sem informar o caixa do Fluxo, a ponte fecha só sobre o que foi atribuído', () => {
    const r = conferirConsistencia([linha('2026-08-05', '2026-08-05', 1000, [['2026-08-06', 1000]])], AGO_INI, AGO_FIM)
    expect(r.bordaForaDoModulo).toBe(0)
    expect(r.fecha).toBe(true)
  })

  it('⭐ informando o caixa do Fluxo, a sobra vira borda NOMEADA e a ponte fecha', () => {
    // Fluxo viu 3.966,35 de venda; o motor atribuiu 1.000 → 2.966,35 é venda de julho
    const r = conferirConsistencia(
      [linha('2026-08-05', '2026-08-05', 1000, [['2026-08-06', 1000]])],
      AGO_INI, AGO_FIM, 3966.35)
    expect(r.bordaForaDoModulo).toBe(2966.35)
    expect(r.caixaDoMes).toBe(3966.35)
    expect(r.inexplicado).toBe(0)
    expect(r.fecha).toBe(true)
    expect(explicarConsistencia(r, 'agosto/2026')).toMatch(/anterior ao módulo/)
  })

  it('a borda nomeada NÃO vira desculpa: duplicata ainda quebra a ponte', () => {
    const dup = linha('2026-08-05', '2026-08-05', 1000, [['2026-08-06', 1000]])
    const r = conferirConsistencia([dup, { ...dup, entradas: [] }], AGO_INI, AGO_FIM, 1000)
    expect(r.vendasDoMes).toBe(2000)
    expect(r.fecha).toBe(false)
  })
})
