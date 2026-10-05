/**
 * ⭐⭐ O TRILHO DE STATUS — barra de progresso de 4 segmentos (05/10/2026).
 *
 * **Ordem do dono:** *"4 segmentos pintados de índigo até o estado atual, com ✓ nos passados e
 * apagados nos futuros."*
 */
import { describe, it, expect } from 'vitest'
import { trilhoDaOrdem, PASSOS_DA_ORDEM } from '../trilho-da-ordem'

describe('⭐⭐ pintado até o atual, ✓ nos passados, apagado nos futuros', () => {
  it('⭐ PLANEJADA: 1 de 4 pintado, nenhum ✓', () => {
    const t = trilhoDaOrdem('PLANEJADA')
    expect(t.mostrar).toBe(true)
    expect(t.pintados).toBe(1)
    expect(t.segmentos.map((s) => s.feito)).toEqual([false, false, false, false])
    expect(t.segmentos.map((s) => s.atual)).toEqual([true, false, false, false])
    expect(t.segmentos.map((s) => s.futuro)).toEqual([false, true, true, true])
  })

  it('⭐ EM_PRODUCAO: 3 pintados, 2 com ✓, 1 apagado', () => {
    const t = trilhoDaOrdem('EM_PRODUCAO')
    expect(t.pintados).toBe(3)
    expect(t.segmentos.filter((s) => s.feito).map((s) => s.passo)).toEqual(['PLANEJADA', 'SEPARADA'])
    expect(t.segmentos.find((s) => s.atual)!.passo).toBe('EM_PRODUCAO')
    expect(t.segmentos.filter((s) => s.futuro).map((s) => s.passo)).toEqual(['CONCLUIDA'])
  })

  /** ⚠️ o ÚLTIMO estado é "atual", não "feito": o ✓ no atual diria que ele já passou */
  it('⭐ CONCLUIDA: os 4 pintados, e o último é o ATUAL (sem ✓)', () => {
    const t = trilhoDaOrdem('CONCLUIDA')
    expect(t.pintados).toBe(4)
    expect(t.segmentos.filter((s) => s.futuro)).toEqual([])
    expect(t.segmentos[3].atual).toBe(true)
    expect(t.segmentos[3].feito, 'o atual nunca leva ✓').toBe(false)
  })

  /**
   * ⛔⛔ **CANCELADA NÃO É UM PASSO** — é a ordem SAINDO do trilho. Pintar 1 de 4 nela diria
   * *"está no começo"* pra uma ordem que acabou; a tela mostra o selo e **nenhuma barra**.
   */
  it('⛔⛔ CANCELADA não desenha barra', () => {
    const t = trilhoDaOrdem('CANCELADA')
    expect(t.mostrar).toBe(false)
    expect(t.pintados).toBe(0)
    expect(t.segmentos.every((s) => s.futuro), 'nada pintado').toBe(true)
  })

  /** ⚠️ estado que a tela ainda não conhece NÃO chuta o 1º passo (seria afirmar progresso) */
  it('⛔ estado desconhecido não inventa posição', () => {
    const t = trilhoDaOrdem('ALGO_NOVO')
    expect(t.mostrar).toBe(false)
    expect(t.pintados).toBe(0)
  })

  it('⭐ os 4 passos, na ordem da vida (nunca reordenados por layout)', () => {
    expect([...PASSOS_DA_ORDEM]).toEqual(['PLANEJADA', 'SEPARADA', 'EM_PRODUCAO', 'CONCLUIDA'])
    expect(trilhoDaOrdem('SEPARADA').segmentos.map((s) => s.rotulo)).toEqual([
      'Planejada', 'Separada', 'Em produção', 'Concluída',
    ])
  })
})
