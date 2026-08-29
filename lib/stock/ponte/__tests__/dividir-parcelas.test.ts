// ⭐ DIVISÃO AUTOMÁTICA — o caso real BOX PAPER (29/08/2026).
//
// O total da nota é 10.400,66 e as 3 duplicatas do XML são 3.466,88 + 3.466,88 + 3.466,90.
// A regra do resto na ÚLTIMA não é estética: é o que faz a soma FECHAR. Se o centavo
// fosse espalhado de outro jeito, a validação passaria a cobrar motivo por causa de um
// arredondamento NOSSO — alarme por defeito próprio.

import { describe, it, expect } from 'vitest'
import {
  dividirTotal, somarDias, proximaData, adicionarParcela, removerParcela, redistribuir,
} from '../dividir-parcelas'

const TOTAL = 10400.66
const soma = (ns: number[]) => Math.round(ns.reduce((s, n) => s + n, 0) * 100) / 100

describe('⭐⭐ dividirTotal — o resto de centavos vai na ÚLTIMA', () => {
  it('⭐⭐ 3 parcelas reproduzem EXATAMENTE o que a nota real fez', () => {
    expect(dividirTotal(TOTAL, 3)).toEqual([3466.88, 3466.88, 3466.9])
    expect(soma(dividirTotal(TOTAL, 3))).toBe(TOTAL)
  })

  it('⭐⭐ 4 parcelas (o caso do dono): 2.600,16 e o resto na última', () => {
    const p = dividirTotal(TOTAL, 4)
    expect(p).toEqual([2600.16, 2600.16, 2600.16, 2600.18])
    expect(soma(p)).toBe(TOTAL)
  })

  it('⭐ a soma FECHA pra qualquer N — é o que impede a validação de cobrar motivo à toa', () => {
    for (let n = 1; n <= 24; n++) expect(soma(dividirTotal(TOTAL, n))).toBe(TOTAL)
  })

  it('1 parcela = o total inteiro', () => {
    expect(dividirTotal(TOTAL, 1)).toEqual([TOTAL])
  })

  it('total que divide exato não deixa resto', () => {
    expect(dividirTotal(300, 3)).toEqual([100, 100, 100])
  })

  it('n inválido devolve lista vazia (não estoura)', () => {
    expect(dividirTotal(TOTAL, 0)).toEqual([])
  })
})

describe('⭐ datas — +30 dias, o padrão do mundo', () => {
  it('soma 30 dias atravessando o mês', () => {
    expect(somarDias('2026-09-10', 30)).toBe('2026-10-10')
    expect(somarDias('2026-01-31', 30)).toBe('2026-03-02') // fevereiro: sem clamp, dia corrido
  })

  it('⭐ a próxima parcela sai da ÚLTIMA data preenchida', () => {
    expect(proximaData(['2026-09-10', '2026-09-25'])).toBe('2026-10-25')
  })

  it('⚠️ sem nenhuma data, NÃO inventa a primeira', () => {
    // a 1ª data é a do boleto — chutar "hoje+30" criaria vencimento falso com cara de combinado
    expect(proximaData([])).toBe('')
    expect(proximaData(['', ''])).toBe('')
  })

  it('pula linhas sem data e usa a última que tem', () => {
    expect(proximaData(['2026-09-10', ''])).toBe('2026-10-10')
  })
})

describe('⭐⭐ o fluxo do dono: 3 do XML → [+ parcela] → 4 redistribuídas', () => {
  const XML = [
    { valor: '3466,88', dVenc: '2026-09-10' },
    { valor: '3466,88', dVenc: '2026-09-25' },
    { valor: '3466,90', dVenc: '2026-10-10' },
  ]

  it('⭐⭐ adicionar recalcula os 4 valores E sugere a data +30', () => {
    const r = adicionarParcela(XML, TOTAL)
    expect(r).toHaveLength(4)
    expect(r.map((l) => l.valor)).toEqual(['2600,16', '2600,16', '2600,16', '2600,18'])
    // as datas antigas ficam; a nova é +30 da última
    expect(r.map((l) => l.dVenc)).toEqual(['2026-09-10', '2026-09-25', '2026-10-10', '2026-11-09'])
  })

  it('⭐ remover também redistribui (3 → 2 de 5.200,33)', () => {
    const r = removerParcela(XML, 1, TOTAL)
    expect(r.map((l) => l.valor)).toEqual(['5200,33', '5200,33'])
    expect(r.map((l) => l.dVenc)).toEqual(['2026-09-10', '2026-10-10'])
  })

  it('remover a última linha deixa lista vazia (a validação cobra depois)', () => {
    expect(removerParcela([XML[0]], 0, TOTAL)).toEqual([])
  })

  it('⚠️ redistribuir NÃO mexe nas datas — só nos valores', () => {
    const r = redistribuir(XML, TOTAL)
    expect(r.map((l) => l.dVenc)).toEqual(XML.map((l) => l.dVenc))
  })

  it('⭐⭐ o valor sai em formato BR, pronto pro campo (vírgula, 2 casas)', () => {
    // ⚠️ o campo é TEXTO (a lição do campo de quantidade): devolver número faria a
    // vírgula sumir enquanto o dono digita.
    expect(adicionarParcela(XML, TOTAL).every((l) => /^\d+,\d{2}$/.test(l.valor))).toBe(true)
  })
})
