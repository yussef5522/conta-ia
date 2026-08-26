// REGRA 1/3 — o passe visual da tela de vendas (25/08) EXTRAIU estes dois agregados de
// dentro da página pra que os cards do topo e o número grande usem o mesmo cálculo.
// Extrair é mexer em código que produz NÚMERO, então tem que provar que não mudou nada.
//
// A fixture é o AGOSTO REAL da Cacula (as unidades exatas que a tela monta, com os
// valores conferidos em prod), e os esperados são os do calendário validado pelo dono.

import { describe, it, expect } from 'vitest'
import { resumoSemana, resumoMes, somaMeio, type Unidade } from '../resumo-periodo'

const dia = (d: string, total: number, porMeio: Record<string, number>): Unidade =>
  ({ inicio: d, fim: d, total, porMeio, isBloco: false })
const bloco = (i: string, f: string, total: number, porMeio: Record<string, number>): Unidade =>
  ({ inicio: i, fim: f, total, porMeio, isBloco: true })

// Agosto real, como a tela monta (bloco de fim de semana + dias avulsos).
const AGOSTO: Unidade[] = [
  bloco('2026-07-31', '2026-08-02', 58852.69, { CARTAO: 35113.82, PIX: 15380.21, DINHEIRO: 8358.66 }),
  dia('2026-08-03', 4331.43, { CARTAO: 753, DINHEIRO: 734, PIX: 2844.43 }),
  dia('2026-08-04', 47831.06, { CARTAO: 43089, DINHEIRO: 1110, PIX: 3632.06 }),
  dia('2026-08-05', 16557.42, { CARTAO: 7994, DINHEIRO: 5287, PIX: 3276.42 }),
  dia('2026-08-06', 19906.27, { CARTAO: 9289, DINHEIRO: 3189, PIX: 7428.27 }),
  bloco('2026-08-07', '2026-08-09', 58572.95, { CARTAO: 33537, PIX: 13623, DINHEIRO: 11412.95 }),
  dia('2026-08-10', 2893.87, { CARTAO: 332, DINHEIRO: 1278, PIX: 1283.87 }),
  dia('2026-08-11', 13882.73, { CARTAO: 7968, DINHEIRO: 2445, PIX: 3469.73 }),
]

describe('resumoSemana — a semana da última competência COM DADO', () => {
  it('pega a semana seg–dom que contém a última unidade, não "a semana de hoje"', () => {
    const r = resumoSemana(AGOSTO)!
    // a última é 11/08 (terça) → semana de 10/08 a 16/08
    expect(r.label).toBe('Semana 10/08–16/08')
    expect(r.total).toBe(2893.87 + 13882.73)
  })

  it('o bloco de fim de semana entra pela sua data FIM (é quando a semana dele fecha)', () => {
    // bloco 07–09/08 termina no domingo 09 → semana de 03 a 09
    const r = resumoSemana(AGOSTO.slice(0, 6))!
    expect(r.label).toBe('Semana 03/08–09/08')
    expect(r.total).toBe(4331.43 + 47831.06 + 16557.42 + 19906.27 + 58572.95)
  })

  it('lista vazia → null (a tela mostra "sem dado", nunca zero)', () => {
    expect(resumoSemana([])).toBeNull()
  })
})

describe('resumoMes', () => {
  it('soma TODAS as unidades do mês e rotula com o início do módulo', () => {
    const r = resumoMes(AGOSTO, '2026-08', '2026-08-01')
    expect(r.label).toBe('agosto (a partir de 01/08)')
    expect(Math.round(r.total * 100) / 100).toBe(222828.42) // = o total 01-11/08 gravado em prod
  })

  it('o rótulo segue o moduleInicio da API — não pode voltar a ser literal', () => {
    expect(resumoMes([], '2026-08', '2026-08-12').label).toBe('agosto (a partir de 12/08)')
    expect(resumoMes([], '2026-08', null).label).toBe('agosto (a partir de —)')
  })
})

describe('somaMeio — o card do topo e o número grande somam IGUAL', () => {
  it('agrega por meio sem perder nenhum', () => {
    const pm = somaMeio(AGOSTO)
    expect(Object.keys(pm).sort()).toEqual(['CARTAO', 'DINHEIRO', 'PIX'])
    const soma = Object.values(pm).reduce((s, v) => s + v, 0)
    expect(Math.round(soma * 100) / 100).toBe(222828.42) // fecha com o total do mês
  })

  it('⭐ INVARIANTE do passe visual: Σ dos meios == total, nos dois agregados', () => {
    for (const r of [resumoSemana(AGOSTO)!, resumoMes(AGOSTO, '2026-08', '2026-08-01')]) {
      const soma = Object.values(r.porMeio).reduce((s, v) => s + v, 0)
      expect(Math.round(soma * 100) / 100).toBe(Math.round(r.total * 100) / 100)
    }
  })
})
