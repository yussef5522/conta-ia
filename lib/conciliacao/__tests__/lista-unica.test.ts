/**
 * ⭐⭐⭐ UMA LISTA SÓ — a régua (23/09/2026).
 *
 * ⛔ O que este arquivo impede é o desfecho proibido do colapso: **perder as linhas que a
 * caixa de hoje exclui**. Medido em prod: os 14 cards de *"pra tua mão"* têm a linha FORA
 * da caixa porque já estão **categorizadas** — e categoria não quita conta (07/09).
 */
import { describe, it, expect } from 'vitest'
import {
  linhasDaLista, passaNoFiltro, contadoresDaLista,
  type CasoNaLinha, type LinhaDaLista,
} from '../lista-unica'

const caso = (p: Partial<CasoNaLinha> & Pick<CasoNaLinha, 'tipo'>): CasoNaLinha =>
  ({ hospeda: true, ...p })

describe('⛔⛔ a lista é CAIXA ∪ CASO ABERTO — e perder linha é o desfecho proibido', () => {
  const todas = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]

  it('⭐ linha da caixa entra, com ou sem caso', () => {
    const l = linhasDaLista(todas, new Set(['a', 'b']), new Map([['a', caso({ tipo: 'PALPITE' })]]))
    expect(l.map((x) => x.id)).toEqual(['a', 'b'])
    expect(l.find((x) => x.id === 'b')!.caso).toBeNull()
  })

  it('⛔⛔ linha JÁ CATEGORIZADA com caso aberto ENTRA — é o caso CASPER (14 em prod)', () => {
    const l = linhasDaLista(todas, new Set(['a']), new Map([['c', caso({ tipo: 'ESCOLHA' })]]))
    const c = l.find((x) => x.id === 'c')
    expect(c, 'a linha do card de escolha sumiu — R$ 2.120,81 de trabalho perdido').toBeTruthy()
    // ⭐ e vem MARCADA: sem isso, uma linha categorizada aparecendo do nada parece defeito
    expect(c!.soPeloCaso).toBe(true)
  })

  it('⛔ mas ARQUIVO sem caso NÃO entra — senão 358 linhas resolvidas afogam o trabalho', () => {
    const l = linhasDaLista(todas, new Set(['a']), new Map())
    expect(l.map((x) => x.id)).toEqual(['a'])
  })

  it('⭐ a linha da caixa nunca é marcada como "só pelo caso"', () => {
    const l = linhasDaLista(todas, new Set(['a']), new Map([['a', caso({ tipo: 'LOTE' })]]))
    expect(l[0].soPeloCaso).toBe(false)
  })
})

describe('⭐⭐ os filtros são a MESMA lista recortada', () => {
  const lista: LinhaDaLista[] = [
    { id: 'p1', soPeloCaso: false, caso: caso({ tipo: 'PALPITE' }) },
    { id: 'lo', soPeloCaso: false, caso: caso({ tipo: 'LOTE' }) },
    { id: 'es', soPeloCaso: true, caso: caso({ tipo: 'ESCOLHA' }) },
    { id: 'am', soPeloCaso: false, caso: caso({ tipo: 'AMBIGUO' }) },
    { id: 'so', soPeloCaso: false, caso: null },
    // ⚠️ a 2ª linha do mesmo caso: ela APONTA, não é trabalho a mais
    { id: 'p2', soPeloCaso: false, caso: caso({ tipo: 'ESCOLHA', hospeda: false, ancora: '#es' }) },
  ]

  it('⭐ PRONTOS = palpite + lote · MÃO = escolha + ambíguo', () => {
    expect(lista.filter((l) => passaNoFiltro(l, 'PRONTOS')).map((l) => l.id)).toEqual(['p1', 'lo'])
    expect(lista.filter((l) => passaNoFiltro(l, 'MAO')).map((l) => l.id)).toEqual(['es', 'am'])
  })

  it('⛔ TUDO mostra a lista inteira — nenhum filtro esconde linha', () => {
    expect(lista.filter((l) => passaNoFiltro(l, 'TUDO'))).toHaveLength(lista.length)
  })

  it('⛔⛔ a 2ª linha do caso NÃO conta duas vezes — ela é ponteiro', () => {
    expect(passaNoFiltro(lista.find((l) => l.id === 'p2')!, 'MAO')).toBe(false)
  })

  it('⛔ linha SEM caso não entra em balde nenhum — contador não promete trabalho que não há', () => {
    const so = lista.find((l) => l.id === 'so')!
    expect(passaNoFiltro(so, 'PRONTOS')).toBe(false)
    expect(passaNoFiltro(so, 'MAO')).toBe(false)
    expect(passaNoFiltro(so, 'TUDO')).toBe(true)
  })

  it('⭐⭐ o contador SAI da lista — nunca de uma 2ª consulta', () => {
    const c = contadoresDaLista(lista)
    expect(c).toEqual({ tudo: 6, prontos: 2, mao: 2 })
    // ⛔ e ele bate com o que a tela desenha, por construção
    expect(c.prontos).toBe(lista.filter((l) => passaNoFiltro(l, 'PRONTOS')).length)
    expect(c.mao).toBe(lista.filter((l) => passaNoFiltro(l, 'MAO')).length)
    expect(c.tudo).toBe(lista.filter((l) => passaNoFiltro(l, 'TUDO')).length)
  })

  it('⛔⛔ Σ dos filtros NUNCA passa do total — nenhuma linha em dois baldes', () => {
    for (const l of lista) {
      const em = (['PRONTOS', 'MAO'] as const).filter((f) => passaNoFiltro(l, f))
      expect(em.length, `a linha ${l.id} está em ${em.length} baldes`).toBeLessThanOrEqual(1)
    }
    const c = contadoresDaLista(lista)
    expect(c.prontos + c.mao).toBeLessThanOrEqual(c.tudo)
  })
})
