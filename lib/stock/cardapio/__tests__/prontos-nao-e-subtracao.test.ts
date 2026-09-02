// ⛔⛔ "PRONTOS −72" — contagem de conjuntos que se SOBREPÕEM não se faz por subtração.
//
// O dono viu na tela: **80 produtos · 76 sem ficha · 76 custo a definir · PRONTOS −72**.
// A conta era `produtos − semDestino − semCusto`, e produto sem ficha é **as duas coisas** →
// subtraído duas vezes. 80 − 76 − 76 = −72, o número exato que apareceu.
//
// ⭐ A cura é contar quem CUMPRE a condição (`ehProntoNoCardapio`), e a MESMA função serve o
// card e o filtro da tela — senão o card diz um número e a lista mostra outro.

import { describe, it, expect } from 'vitest'
import { ehProntoNoCardapio } from '../hub'

type L = { status: string; custoUnitario: number | null }
const linha = (status: string, custoUnitario: number | null): L => ({ status, custoUnitario })

/** a conta ANTIGA, guardada aqui só pra provar que ela produz o número errado */
const contaAntiga = (n: number, semDestino: number, semCusto: number) => n - semDestino - semCusto

describe('⛔⛔ o −72 da tela', () => {
  it('⛔⛔ reproduz o número exato que o dono viu com a conta antiga', () => {
    expect(contaAntiga(80, 76, 76)).toBe(-72)
  })

  it('⭐⭐ com a régua nova o mesmo cenário dá 4 — e nunca negativo', () => {
    // 80 produtos: 76 sem ficha (logo sem custo) + 4 com ficha e custo
    const linhas: L[] = [
      ...Array.from({ length: 76 }, () => linha('SEM_DESTINO', null)),
      ...Array.from({ length: 4 }, () => linha('FICHA_OK', 12.5)),
    ]
    const semDestino = linhas.filter((l) => l.status === 'SEM_DESTINO').length
    const semCusto = linhas.filter((l) => l.custoUnitario == null).length
    expect([semDestino, semCusto]).toEqual([76, 76]) // os dois cards da tela batem com o print
    expect(linhas.filter(ehProntoNoCardapio as (l: L) => boolean)).toHaveLength(4)
  })

  it('⭐ produto com ficha mas SEM custo não é pronto — é o card "custo a definir"', () => {
    expect(ehProntoNoCardapio(linha('FICHA_OK', null) as never)).toBe(false)
    expect(ehProntoNoCardapio(linha('REVENDA', null) as never)).toBe(false)
  })

  it('⭐ revenda com custo É pronta (bebida não tem ficha e está certa assim)', () => {
    expect(ehProntoNoCardapio(linha('REVENDA', 8.46) as never)).toBe(true)
  })

  it('⛔ ficha que sumiu/desativou não é pronta, mesmo com custo herdado', () => {
    expect(ehProntoNoCardapio(linha('SEM_FICHA', 3.62) as never)).toBe(false)
  })

  it('⭐⭐ os quatro cards NUNCA passam do total, em nenhuma combinação', () => {
    // property test caseiro: qualquer mistura de estados fecha dentro do total
    for (let semFicha = 0; semFicha <= 20; semFicha++) {
      for (let semCustoComFicha = 0; semCustoComFicha <= 20; semCustoComFicha++) {
        const linhas: L[] = [
          ...Array.from({ length: semFicha }, () => linha('SEM_DESTINO', null)),
          ...Array.from({ length: semCustoComFicha }, () => linha('FICHA_OK', null)),
          ...Array.from({ length: 5 }, () => linha('FICHA_OK', 10)),
        ]
        const prontos = linhas.filter(ehProntoNoCardapio as (l: L) => boolean).length
        expect(prontos).toBe(5)
        expect(prontos).toBeGreaterThanOrEqual(0)
        expect(prontos).toBeLessThanOrEqual(linhas.length)
      }
    }
  })
})
