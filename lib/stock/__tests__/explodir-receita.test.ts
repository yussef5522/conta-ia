/**
 * ⛔⛔⛔ A PORTA ÚNICA DA EXPLOSÃO — o que ela tem que garantir (02/10/2026).
 *
 * **A doença que ela cura, nas palavras do dono:** *"toda quebra da produção nasceu de CONTA
 * PARALELA — escala dupla da maionese, round2 zerando dose pequena, a ficha do Combo baixando
 * bebida que o complemento já baixava."*
 *
 * ⚠️ O teste mais importante deste arquivo é o **ESTOCADO**: ele prova que a explosão PARA no
 * intermediário em vez de descer nos insumos dele. Descer seria **baixa DUPLA** — os insumos
 * já saíram na ordem de produção que fez aquele intermediário.
 */
import { describe, it, expect } from 'vitest'
import {
  explodirReceita,
  comoConsome,
  round6,
  doseQueZeraria,
  type GrafoDeFichas,
} from '../explodir-receita'

/** monta o grafo na mão, do jeito que o `montarCtx` monta a partir do banco */
function grafo(
  fichas: { id: string; tipo: string; produz: string; comps: [string, number][] }[],
): GrafoDeFichas {
  return {
    componentesByFicha: new Map(
      fichas.map((f) => [f.id, f.comps.map(([itemId, qtdPlanejada]) => ({ itemId, qtdPlanejada }))]),
    ),
    fichaByItemProduzido: new Map(
      fichas.map((f) => [f.produz, { id: f.id, tipoProduto: f.tipo, itemProduzidoId: f.produz }]),
    ),
  }
}

describe('⭐ a régua ESTOCADO × ATRAVESSA, com nome', () => {
  it('INTERMEDIARIO é ESTOCADO (a cozinha produz por ordem) e PRODUTO_FINAL/SABOR ATRAVESSAM', () => {
    expect(comoConsome('INTERMEDIARIO')).toBe('ESTOCADO')
    expect(comoConsome('MATERIA_PRIMA')).toBe('ESTOCADO')
    expect(comoConsome('REVENDA')).toBe('ESTOCADO')
    expect(comoConsome('PRODUTO_FINAL')).toBe('ATRAVESSA')
    expect(comoConsome('SABOR')).toBe('ATRAVESSA')
  })

  it('⛔⛔ a venda PARA no intermediário — descer nos insumos dele seria baixa DUPLA', () => {
    /**
     * A cena é o caso real da pizza: a ficha pede `metade de bolinha`, que é um
     * INTERMEDIÁRIO produzido por ordem a partir de farinha/leite/sal.
     * ⭐ Vender a pizza baixa A METADE. A farinha já saiu quando a cozinha produziu as
     * metades — baixá-la de novo aqui tiraria do estoque uma farinha que nunca existiu.
     */
    const g = grafo([
      { id: 'f-pizza', tipo: 'PRODUTO_FINAL', produz: 'i-pizza', comps: [['i-metade', 3]] },
      {
        id: 'f-metade',
        tipo: 'INTERMEDIARIO',
        produz: 'i-metade',
        comps: [['i-farinha', 0.15], ['i-leite', 0.018]],
      },
    ])
    const r = explodirReceita({ fichaId: 'f-pizza' }, 1, g, 'VENDA')
    expect(r.consumos).toEqual([{ itemId: 'i-metade', qtd: 3, viaFichas: ['f-pizza'] }])
    // ⛔ o contrafactual: se descesse, a farinha apareceria aqui
    expect(r.consumos.map((c) => c.itemId)).not.toContain('i-farinha')
  })

  it('⭐ o invólucro de cardápio ATRAVESSA — o Combo desce no Xis e chega nos insumos dele', () => {
    /**
     * ⚠️ Sem isso, um PRODUTO_FINAL usado como componente baixaria o **item-invólucro**, que
     * ninguém produz — e o saldo dele ficaria negativo pra sempre (a cicatriz de 03/09).
     */
    const g = grafo([
      { id: 'f-combo', tipo: 'PRODUTO_FINAL', produz: 'i-combo', comps: [['i-xis', 2]] },
      {
        id: 'f-xis',
        tipo: 'PRODUTO_FINAL',
        produz: 'i-xis',
        comps: [['i-beef', 1], ['i-pao', 1]],
      },
    ])
    const r = explodirReceita({ fichaId: 'f-combo' }, 1, g, 'VENDA')
    expect(r.consumos.map((c) => [c.itemId, c.qtd])).toEqual([
      ['i-beef', 2],
      ['i-pao', 2],
    ])
    expect(r.consumos.map((c) => c.itemId)).not.toContain('i-xis')
    // ⭐ o rastro diz por onde passou — é o que explica o número na tela
    expect(r.consumos[0].viaFichas).toEqual(['f-combo', 'f-xis'])
  })

  it('⛔⛔ na SEPARAÇÃO nada desce — o gesto é FÍSICO (tirar da câmara o que a ficha lista)', () => {
    /**
     * A MESMA ficha, a MESMA porta, resposta diferente **por declaração**: aqui alguém vai
     * buscar material. Descer mandaria a pessoa pegar farinha quando a ficha pede massa.
     */
    const g = grafo([
      { id: 'f-pizza', tipo: 'PRODUTO_FINAL', produz: 'i-pizza', comps: [['i-xis', 2]] },
      { id: 'f-xis', tipo: 'PRODUTO_FINAL', produz: 'i-xis', comps: [['i-beef', 1]] },
    ])
    const r = explodirReceita({ fichaId: 'f-pizza' }, 1, g, 'SEPARACAO')
    expect(r.consumos).toEqual([{ itemId: 'i-xis', qtd: 2, viaFichas: ['f-pizza'] }])
  })
})

describe('⛔ sem arredondamento no meio da conta', () => {
  it('⛔⛔⛔ a dose que ZERARIA no meio sobrevive e CHEGA NA BORDA — era o fermento derretido', () => {
    /**
     * ⚠️⚠️ REGRA 11 ME CORRIGIU AQUI: a 1ª versão deste teste usava `0,1 × 0,0003` e passava
     * VERDE com o `round6` por passo reposto — **0,00003 cabe em 6 casas**. Eu tinha escolhido
     * um caso que o defeito não alcança.
     *
     * ⭐ O que ISOLA o defeito é a dose cujo produto intermediário fica **abaixo de 1e-6**:
     * com arredondamento no meio ela vira **0 exato** e o item **DESAPARECE da explosão** —
     * e pior, desaparece em SILÊNCIO, porque `doseQueZeraria` só vê quem chegou diferente de
     * zero. Era assim que o fermento sumia da baixa sem ninguém saber.
     */
    const g = grafo([
      { id: 'f-a', tipo: 'PRODUTO_FINAL', produz: 'i-a', comps: [['i-b', 0.001]] },
      { id: 'f-b', tipo: 'PRODUTO_FINAL', produz: 'i-b', comps: [['i-fermento', 0.0003]] },
    ])
    const r = explodirReceita({ fichaId: 'f-a' }, 1, g, 'VENDA')
    expect(r.consumos).toHaveLength(1)
    expect(r.consumos[0].itemId).toBe('i-fermento')
    // (a) a conta chegou EXATA (3e-7), não zerada no meio
    expect(r.consumos[0].qtd).toBeCloseTo(0.0000003, 15)
    expect(r.consumos[0].qtd).not.toBe(0)
    // (b) ⭐ e a BORDA avisa que gravar isso daria zero — o dado some COM NOME
    expect(doseQueZeraria(r.consumos)).toHaveLength(1)
  })

  it('⭐ e o erro não COMPÕE: 1.000 unidades de uma dose de 3 níveis fecham exato', () => {
    /**
     * Arredondar a cada passo erra pouco por linha e **cresce com a quantidade** — a mesma
     * doença do custo arredondado da baixa de venda (19/09, R$ −4,81 em 1.019 ovos).
     */
    const g = grafo([
      { id: 'f-a', tipo: 'PRODUTO_FINAL', produz: 'i-a', comps: [['i-b', 0.333333]] },
      { id: 'f-b', tipo: 'PRODUTO_FINAL', produz: 'i-b', comps: [['i-c', 0.333333]] },
    ])
    const r = explodirReceita({ fichaId: 'f-a' }, 1000, g, 'VENDA')
    expect(r.consumos[0].qtd).toBeCloseTo(1000 * 0.333333 * 0.333333, 9)
  })

  it('⭐ o mesmo item por DOIS caminhos soma exato, sem erro composto', () => {
    const g = grafo([
      {
        id: 'f-x',
        tipo: 'PRODUTO_FINAL',
        produz: 'i-x',
        comps: [['i-queijo', 0.1], ['i-sub', 1]],
      },
      { id: 'f-sub', tipo: 'PRODUTO_FINAL', produz: 'i-sub', comps: [['i-queijo', 0.2]] },
    ])
    const r = explodirReceita({ fichaId: 'f-x' }, 3, g, 'VENDA')
    expect(r.consumos).toHaveLength(1)
    expect(r.consumos[0].qtd).toBeCloseTo(0.9, 12) // 3×0,1 + 3×0,2
  })

  it('⚠️ a BORDA avisa a dose que arredondaria pra zero — nunca engole', () => {
    const quase = [{ itemId: 'i', qtd: 0.0000004, viaFichas: [] }]
    expect(round6(0.0000004)).toBe(0)
    expect(doseQueZeraria(quase)).toHaveLength(1)
    // ⛔ e zero de verdade (dose zero na ficha) não entra na lista — é outro caso, outro aviso
    expect(doseQueZeraria([{ itemId: 'i', qtd: 0, viaFichas: [] }])).toHaveLength(0)
  })
})

describe('⭐⭐ o "NÃO SEI" sai NOMEADO (item 5 do dono)', () => {
  it('ficha sem componente na versão vigente → aviso, não silêncio', () => {
    const g = grafo([{ id: 'f-vazia', tipo: 'PRODUTO_FINAL', produz: 'i-v', comps: [] }])
    const r = explodirReceita({ fichaId: 'f-vazia' }, 1, g, 'VENDA')
    expect(r.consumos).toHaveLength(0)
    expect(r.avisos).toEqual([
      expect.objectContaining({ motivo: 'FICHA_SEM_COMPONENTE', fichaId: 'f-vazia' }),
    ])
  })

  it('dose ZERO na ficha → aviso nomeando o componente', () => {
    const g = grafo([
      { id: 'f', tipo: 'PRODUTO_FINAL', produz: 'i', comps: [['i-sal', 0], ['i-ok', 2]] },
    ])
    const r = explodirReceita({ fichaId: 'f' }, 1, g, 'VENDA')
    expect(r.consumos.map((c) => c.itemId)).toEqual(['i-ok'])
    expect(r.avisos).toEqual([
      expect.objectContaining({ motivo: 'DOSE_ZERO', itemId: 'i-sal' }),
    ])
  })

  it('⛔ ciclo de ficha → aviso de PROFUNDIDADE, nunca laço infinito', () => {
    /**
     * ⚠️ `criarFicha` já recusa ciclo desde 09/09; isto é o cinto. Fixture degenerada (uma
     * ficha que produz e consome o mesmo item) já apareceu num teste meu em 02/09.
     */
    const g = grafo([
      { id: 'f-a', tipo: 'PRODUTO_FINAL', produz: 'i-a', comps: [['i-b', 1]] },
      { id: 'f-b', tipo: 'PRODUTO_FINAL', produz: 'i-b', comps: [['i-a', 1]] },
    ])
    const r = explodirReceita({ fichaId: 'f-a' }, 1, g, 'VENDA')
    expect(r.avisos.some((a) => a.motivo === 'PROFUNDIDADE')).toBe(true)
  })
})

describe('⭐ alvo que é item direto (revenda / matéria-prima)', () => {
  it('baixa ele mesmo, sem explodir nada', () => {
    const r = explodirReceita({ itemId: 'i-coca' }, 25, grafo([]), 'VENDA')
    expect(r.consumos).toEqual([{ itemId: 'i-coca', qtd: 25, viaFichas: [] }])
    expect(r.avisos).toHaveLength(0)
  })
})
