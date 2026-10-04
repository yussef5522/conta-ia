/**
 * ⭐ "O QUE VAI SAIR DA CÂMARA" — a lista que a tela mostra antes de criar a ordem.
 *
 * ⚠️ A régua mora em lib porque este projeto roda **sem jsdom**: dentro do JSX ela seria regra
 * que ninguém prova (a lição do prefill do cardápio, 28/08).
 */
import { describe, it, expect } from 'vitest'
import { listaDoQueVaiSeparar } from '../lista-da-separacao'

/** a ficha real do beef de xis: 1 receita = 1 UN, dose nominal do dono (03/10) */
const BEEF_DE_XIS = [
  { itemId: 'acem', nome: 'Acém', unidade: 'KG', porLote: 0.091, custoMedio: 33.96 },
  { itemId: 'peito', nome: 'Peito', unidade: 'KG', porLote: 0.044, custoMedio: 18.5 },
  { itemId: 'gordura', nome: 'Gordura', unidade: 'KG', porLote: 0.02, custoMedio: 9.6 },
]

describe('⭐⭐ o pin do beef de xis vale aqui também — ficha × pedido, sem rendimento', () => {
  it('⭐ pedir 10 UN tira 0,910 / 0,440 / 0,200 (o nominal da ficha do dono)', () => {
    const r = listaDoQueVaiSeparar(BEEF_DE_XIS, 10, 1)
    expect(r.linhas.map((l) => l.quantidade)).toEqual([0.91, 0.44, 0.2])
    expect(r.semCusto).toBe(0)
    expect(r.faltando).toBe(0)
    // 0,91×33,96 + 0,44×18,5 + 0,2×9,6 = 30,90 + 8,14 + 1,92
    expect(r.custoTotal).toBeCloseTo(40.96, 2)
  })

  it('⭐ e escala com o pedido: 80 UN tira 8× isso', () => {
    const r = listaDoQueVaiSeparar(BEEF_DE_XIS, 80, 1)
    expect(r.linhas[0].quantidade).toBeCloseTo(7.28, 4)
  })

  it('⭐ lote > 1 divide certo (a MAIONESE: lote 2,858)', () => {
    const r = listaDoQueVaiSeparar([{ itemId: 'oleo', nome: 'OLEO', unidade: 'LT', porLote: 3, custoMedio: 8 }], 10, 2.858)
    // 10 ÷ 2,858 = 3,4989 lotes × 3 LT
    expect(r.linhas[0].quantidade).toBeCloseTo(10.4969, 3)
  })
})

describe('⛔ as honestidades da lista', () => {
  it('⛔⛔ custo total só quando TODOS têm custo — e DIZ quantos faltam', () => {
    /**
     * ⚠️ Total parcial com cara de total é a mentira mais fácil numa tela de dinheiro. É a
     * mesma régua do "a definir" das fichas (nunca 0,01) e do custo médio do cardápio.
     */
    const r = listaDoQueVaiSeparar(
      [...BEEF_DE_XIS, { itemId: 'novo', nome: 'tempero novo', unidade: 'KG', porLote: 0.001, custoMedio: null }],
      10, 1,
    )
    expect(r.custoTotal).toBeNull()
    expect(r.semCusto).toBe(1)
    // ⭐ mas as linhas que TÊM custo seguem mostrando o delas
    expect(r.linhas[0].custoTotal).toBeCloseTo(30.9, 2)
    expect(r.linhas[3].custoTotal).toBeNull()
  })

  it('⛔ pedido ou lote inválido devolve `null` por linha, nunca 0', () => {
    for (const [pedido, lote] of [[0, 1], [10, 0], [-5, 1]] as const) {
      const r = listaDoQueVaiSeparar(BEEF_DE_XIS, pedido, lote)
      expect(r.linhas.every((l) => l.quantidade === null), `pedido ${pedido} lote ${lote}`).toBe(true)
      expect(r.custoTotal).toBeNull()
    }
  })

  it('⭐ falta é avisada quando o saldo não cobre', () => {
    const r = listaDoQueVaiSeparar(
      [{ itemId: 'acem', nome: 'Acém', unidade: 'KG', porLote: 0.091, custoMedio: 33.96, saldo: 0.5 }],
      10, 1,
    )
    expect(r.linhas[0].falta).toBe(true)
    expect(r.faltando).toBe(1)
  })

  it('⛔⛔ sem saber o saldo, NÃO afirma falta (ausência de dado não é falta)', () => {
    /**
     * ⚠️ Pintar de vermelho por ausência é a família do "erro disfarçado de vazio": o dono
     * deixaria de produzir algo que ele talvez tenha na câmara.
     */
    const r = listaDoQueVaiSeparar(BEEF_DE_XIS, 10, 1)
    expect(r.linhas.every((l) => l.falta === false)).toBe(true)
    expect(r.faltando).toBe(0)
  })

  it('⭐ saldo exatamente igual ao que sai NÃO é falta', () => {
    const r = listaDoQueVaiSeparar(
      [{ itemId: 'acem', nome: 'Acém', unidade: 'KG', porLote: 0.091, custoMedio: 33.96, saldo: 0.91 }],
      10, 1,
    )
    expect(r.linhas[0].falta).toBe(false)
  })

  it('a régua por receita viaja junto (a tela mostra em letra pequena)', () => {
    const r = listaDoQueVaiSeparar(BEEF_DE_XIS, 10, 1)
    expect(r.linhas.map((l) => l.porLote)).toEqual([0.091, 0.044, 0.02])
  })
})
