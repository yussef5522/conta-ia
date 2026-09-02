// ⭐ DUPLICAR FICHA — o que a cópia herda, e o que ela NUNCA herda (02/09).

import { describe, it, expect } from 'vitest'
import { camposDaCopia, type FichaParaCopiar } from '../duplicar-ficha'

const ORIGEM: FichaParaCopiar = {
  nomeProduzido: 'sabor calabresa',
  unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO',
  setorId: 'setor-cozinha', valorVenda: null,
  loteBase: 10, unidadeLoteBase: 'UN',
  validadeDias: 3, tempoPreparoMin: 25, modoPreparo: 'fatiar fino',
  componentes: [
    { itemId: 'i-calabresa', nome: 'CALABRESA CRUA', unidade: 'KG', qtdPlanejada: 1.2, custoMedio: 28.9, unidadeControle: 'KG' },
    { itemId: 'i-oregano', nome: 'ORÉGANO', unidade: 'KG', qtdPlanejada: 0.005, custoMedio: 90, unidadeControle: 'KG' },
  ],
}

describe('⭐ a cópia HERDA o trabalho', () => {
  it('⭐⭐ os componentes vêm INTEIROS — é o motivo de duplicar existir', () => {
    const c = camposDaCopia(ORIGEM)
    expect(c.componentes).toHaveLength(2)
    expect(c.componentes[0]).toMatchObject({ itemId: 'i-calabresa', qtdPlanejada: 1.2 })
    expect(c.componentes[1].qtdPlanejada).toBe(0.005)
  })

  it('⭐ e o resto do corpo também (lote, validade, preparo, setor)', () => {
    const c = camposDaCopia(ORIGEM)
    expect(c).toMatchObject({
      tipoProduto: 'INTERMEDIARIO', loteBase: 10, unidadeLoteBase: 'UN',
      validadeDias: 3, tempoPreparoMin: 25, modoPreparo: 'fatiar fino', setorId: 'setor-cozinha',
    })
  })

  it('⚠️ e é CÓPIA, não referência — mexer na nova não mexe na original', () => {
    const c = camposDaCopia(ORIGEM)
    c.componentes[0].qtdPlanejada = 99
    expect(ORIGEM.componentes[0].qtdPlanejada).toBe(1.2)
  })
})

describe('⛔⛔ o que a cópia NUNCA herda', () => {
  it('⛔⛔ o VÍNCULO COM O PDV — senão a cópia rouba as baixas da original, em silêncio', () => {
    // o mapa é @@unique(companyId, nomeSuitable) e a gravação é UPSERT: herdar não daria
    // erro nenhum na tela, só passaria a baixar a ficha errada.
    const c = camposDaCopia(ORIGEM)
    expect(c.mapearComplemento).toBeNull()
    expect(c.mapearNomeSuitable).toBeNull()
  })

  it('⛔ o NOME cru — duas fichas ATIVAS com o mesmo nome são recusadas na gravação', () => {
    const c = camposDaCopia(ORIGEM)
    expect(c.nomeProduzido).not.toBe('sabor calabresa')
    expect(c.nomeProduzido).toBe('sabor calabresa (cópia)')
  })

  it('⭐ mas o nome que o contexto já decidiu MANDA sobre o "(cópia)"', () => {
    expect(camposDaCopia(ORIGEM, 'sabor bacon').nomeProduzido).toBe('sabor bacon')
    // ⚠️ nome só de espaço não conta como decidido
    expect(camposDaCopia(ORIGEM, '   ').nomeProduzido).toBe('sabor calabresa (cópia)')
    expect(camposDaCopia(ORIGEM, null).nomeProduzido).toBe('sabor calabresa (cópia)')
  })
})

describe('⭐ o caso real: a família de sabores', () => {
  it('⭐⭐ 8 variações de FRANGO saem da mesma base, cada uma independente', () => {
    const nomes = ['sabor frango', 'sabor frango c/ catupiry', 'sabor frango c/ bacon']
    const copias = nomes.map((n) => camposDaCopia(ORIGEM, n))
    expect(copias.map((c) => c.nomeProduzido)).toEqual(nomes)
    // todas com o trabalho pronto e NENHUMA mapeada
    expect(copias.every((c) => c.componentes.length === 2)).toBe(true)
    expect(copias.every((c) => c.mapearComplemento === null)).toBe(true)
  })
})
