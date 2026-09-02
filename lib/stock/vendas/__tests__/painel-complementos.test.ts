// ⭐⭐ CARDS E SEÇÕES DA PRATELEIRA — com os números reais de 29/08 (02/09).

import { describe, it, expect } from 'vitest'
import { cardsDaPrateleira, secoesDaPrateleira } from '../painel-complementos'
import type { LinhaPrateleira } from '../complemento-map'

const l = (p: Partial<LinhaPrateleira> & { nomeSuitable: string; ocorrencias: number }): LinhaPrateleira => ({
  destino: 'SEM_FICHA', fichaId: null, nomeFicha: null, tambemProduto: false,
  destinoComoProduto: null, grupo: 'OUTRO', grupoDoDono: false, ...p,
})

describe('⭐⭐ "quanto da venda já baixa estoque"', () => {
  it('⭐⭐ é por OCORRÊNCIA, não por nome — e a diferença é o ponto', () => {
    // o dia real: CALABRESA 115 de 651 ocorrências, num universo de 121 nomes
    const linhas = [
      l({ nomeSuitable: 'CALABRESA', ocorrencias: 115, destino: 'FICHA', fichaId: 'f1', grupo: 'SABOR' }),
      ...Array.from({ length: 120 }, (_, i) => l({ nomeSuitable: `X${i}`, ocorrencias: Math.ceil((651 - 115) / 120) })),
    ]
    const t = cardsDaPrateleira(linhas)
    expect(t.comFicha).toBe(1)
    // 1 nome de 121 é 0,8% — mas ele sozinho cobre ~18% das ocorrências
    expect(t.pctCoberto!).toBeGreaterThan(15)
    expect(1 / linhas.length * 100).toBeLessThan(1)
  })

  it('⛔ IGNORAR não conta como coberto — ignorar é decidir que NÃO baixa', () => {
    const t = cardsDaPrateleira([
      l({ nomeSuitable: 'GRANDE', ocorrencias: 300, destino: 'IGNORAR' }),
      l({ nomeSuitable: 'CALABRESA', ocorrencias: 100, destino: 'FICHA', fichaId: 'f1' }),
    ])
    expect(t.ignorados).toBe(1)
    expect(t.pctCoberto).toBe(25) // 100 de 400, não 100 de 100
  })

  it('⚠️ sem ocorrência nenhuma é "a apurar", nunca 0% — ausência não é zero', () => {
    expect(cardsDaPrateleira([]).pctCoberto).toBeNull()
    expect(cardsDaPrateleira([l({ nomeSuitable: 'X', ocorrencias: 0 })]).pctCoberto).toBeNull()
  })

  it('⭐ os três primeiros cards somam o total de nomes', () => {
    const linhas = [
      l({ nomeSuitable: 'A', ocorrencias: 1 }),
      l({ nomeSuitable: 'B', ocorrencias: 2, destino: 'FICHA', fichaId: 'f' }),
      l({ nomeSuitable: 'C', ocorrencias: 3, destino: 'IGNORAR' }),
    ]
    const t = cardsDaPrateleira(linhas)
    expect(t.pendentes + t.comFicha + t.ignorados).toBe(linhas.length)
  })
})

describe('⭐⭐ as três seções', () => {
  const linhas = [
    l({ nomeSuitable: 'CALABRESA', ocorrencias: 115, grupo: 'SABOR' }),
    l({ nomeSuitable: 'FRANGO', ocorrencias: 30, grupo: 'SABOR', destino: 'FICHA', fichaId: 'f' }),
    l({ nomeSuitable: 'MAIONESE CASEIRA', ocorrencias: 31 }),
    l({ nomeSuitable: 'GRANDE', ocorrencias: 3, destino: 'IGNORAR' }),
    l({ nomeSuitable: 'PAULISTA', ocorrencias: 22, grupo: 'SABOR', destino: 'IGNORAR' }),
  ]

  it('⭐ sabores primeiro, outros depois, ignorados por último', () => {
    expect(secoesDaPrateleira(linhas).map((s) => s.chave)).toEqual(['SABORES', 'OUTROS', 'IGNORADOS'])
  })

  it('⛔⛔ IGNORADO sai das duas primeiras seções — senão vira trabalho que se refaz', () => {
    const [sab, outros, ign] = secoesDaPrateleira(linhas)
    // PAULISTA é sabor E está ignorado: aparece SÓ em ignorados
    expect(sab.linhas.map((x) => x.nomeSuitable)).toEqual(['CALABRESA', 'FRANGO'])
    expect(outros.linhas.map((x) => x.nomeSuitable)).toEqual(['MAIONESE CASEIRA'])
    expect(ign.linhas.map((x) => x.nomeSuitable)).toEqual(['GRANDE', 'PAULISTA'])
  })

  it('⭐ cada seção traz suas ocorrências e seus pendentes', () => {
    const [sab] = secoesDaPrateleira(linhas)
    expect(sab.ocorrencias).toBe(145)
    expect(sab.pendentes).toBe(1) // só CALABRESA
  })

  it('⭐⭐ nenhuma linha se perde e nenhuma aparece duas vezes', () => {
    const secoes = secoesDaPrateleira(linhas)
    const todas = secoes.flatMap((s) => s.linhas.map((x) => x.nomeSuitable))
    expect(todas).toHaveLength(linhas.length)
    expect(new Set(todas).size).toBe(linhas.length)
  })
})
