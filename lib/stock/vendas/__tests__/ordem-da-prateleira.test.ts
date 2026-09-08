// ⛔⛔⛔ O MESMO SABOR EM DOIS LUGARES DA MESMA PÁGINA (08/09/2026).
//
// *"A seção 'Sabores de pizza (do cardápio)' (cards de grupo) e a tabela listam os MESMOS
// pendentes — 4 QUEIJOS, MUSSARELA, 5 QUEIJOS, PORTUGUESA, ENTREVERO, CARNEE, todos 2x na
// mesma página. (…) **Foi exatamente o que me fez achar que o bug continuava.**"* — o dono.
//
// ⚠️ O dono pediu *"teste conta linhas por canônico no HTML da tela"*. A suíte roda em
// `environment: node`, sem jsdom — então a prova é sobre **a lista que a tela desenha**.
// É mais forte, aliás: o componente que duplicava (`GruposSugeridos`) foi **APAGADO**, não
// escondido, então a página tem uma fonte só e a duplicata é impossível por construção.

import { describe, it, expect } from 'vitest'
import { agruparPorDestino } from '../painel-complementos'
import { ordenarPrateleira, faixaDaLinha, canonicosDuplicados } from '../ordem-da-prateleira'
import type { LinhaPrateleira } from '../complemento-map'

const l = (o: Partial<LinhaPrateleira> & { nomeSuitable: string; ocorrencias: number }): LinhaPrateleira => ({
  destino: 'SEM_FICHA', fichaId: null, nomeFicha: null, tambemProduto: false,
  destinoComoProduto: null, grupo: 'SABOR', grupoDoDono: false, ...o,
})

// os nomes REAIS que o dono viu duplicados na tela
const DA_TELA: LinhaPrateleira[] = [
  l({ nomeSuitable: '4 QUEIJOS', ocorrencias: 74 }),
  l({ nomeSuitable: 'MUSSARELA', ocorrencias: 55 }),
  l({ nomeSuitable: '5 QUEIJOS', ocorrencias: 52 }),
  l({ nomeSuitable: 'PORTUGUESA', ocorrencias: 30 }),
  l({ nomeSuitable: 'portuguesa', ocorrencias: 2 }),
  l({ nomeSuitable: 'Portuguesa', ocorrencias: 1 }),
  l({ nomeSuitable: 'ENTREVERO', ocorrencias: 24 }),
  l({ nomeSuitable: 'STROGONOFF DE CARNEE', ocorrencias: 2 }),
  l({ nomeSuitable: 'CALABRESA', ocorrencias: 1220, destino: 'FICHA', fichaId: 'f-cal', nomeFicha: 'porcao calabresa' }),
  l({ nomeSuitable: 'GRANDE', ocorrencias: 32, destino: 'IGNORAR', grupo: 'OUTRO' }),
  l({ nomeSuitable: 'BASCA', ocorrencias: 0 }),
]

describe('⭐⭐ a lista ÚNICA: um canônico, uma linha', () => {
  it('⛔⛔ nenhum canônico pendente aparece duas vezes', () => {
    const linhas = agruparPorDestino(DA_TELA)
    expect(canonicosDuplicados(linhas)).toEqual([])
  })

  it('os três PORTUGUESA viraram UMA linha com as três grafias embaixo', () => {
    const linhas = agruparPorDestino(DA_TELA)
    const port = linhas.filter((x) => x.titulo.toUpperCase() === 'PORTUGUESA')
    expect(port).toHaveLength(1)
    expect(port[0].ocorrencias).toBe(33)
    expect(port[0].apelidos.map((a) => a.nomeSuitable)).toEqual(['PORTUGUESA', 'portuguesa', 'Portuguesa'])
  })

  it('⛔ e a fronteira segue: 4 QUEIJOS, 5 QUEIJOS e o typo continuam separados', () => {
    const titulos = agruparPorDestino(DA_TELA).map((x) => x.titulo)
    expect(titulos).toContain('4 QUEIJOS')
    expect(titulos).toContain('5 QUEIJOS')
    expect(titulos).toContain('STROGONOFF DE CARNEE')
  })

  it('⚠️ REPONDO A DUPLICATA: duas linhas do mesmo canônico são DETECTADAS', () => {
    // o guard precisa morder — senão ele passaria por qualquer lista
    const duplicado = [
      { nomeSuitable: 'PORTUGUESA', titulo: 'PORTUGUESA', ocorrencias: 30, destino: 'SEM_FICHA' as const },
      { nomeSuitable: 'portuguesa', titulo: 'portuguesa', ocorrencias: 2, destino: 'SEM_FICHA' as const },
    ]
    expect(canonicosDuplicados(duplicado)).toEqual(['PORTUGUESA'])
  })
})

describe('⭐ a ordem é do TRABALHO, não estética', () => {
  const linhas = agruparPorDestino(DA_TELA)

  it('pendente COM sugestão vem primeiro — é a ação de 1 clique', () => {
    // o typo tem sugestão (parece STROGONOFF DE CARNE); o resto não
    const r = ordenarPrateleira(linhas, new Set(['STROGONOFF DE CARNEE']))
    expect(r[0].titulo).toBe('STROGONOFF DE CARNEE')
    expect(r[0].ocorrencias).toBe(2)   // ⛔ mesmo sendo o MENOR volume da lista
  })

  it('depois os pendentes sem sugestão, por ocorrências', () => {
    const r = ordenarPrateleira(linhas, new Set())
    expect(r.slice(0, 3).map((x) => x.titulo)).toEqual(['4 QUEIJOS', 'MUSSARELA', '5 QUEIJOS'])
  })

  it('o já decidido desce — informação não disputa espaço com trabalho', () => {
    const r = ordenarPrateleira(linhas, new Set())
    const iCalabresa = r.findIndex((x) => x.titulo === 'porcao calabresa')
    const iPendente = r.findIndex((x) => x.titulo === 'ENTREVERO')
    // ⚠️ a CALABRESA tem 1.220 ocorrências (o maior volume de longe) e mesmo assim fica
    // abaixo de um pendente de 24: ela já está resolvida.
    expect(iCalabresa).toBeGreaterThan(iPendente)
  })

  it('⚠️ "não vendeu" vai por ÚLTIMO mesmo estando PENDENTE', () => {
    const r = ordenarPrateleira(linhas, new Set())
    expect(r[r.length - 1].titulo).toBe('BASCA')
    // sabor do cardápio que não apareceu é conferência, não fila — deixá-lo no topo
    // empurraria pra baixo o que de fato vendeu.
    expect(faixaDaLinha({ nomeSuitable: 'BASCA', titulo: 'BASCA', ocorrencias: 0, destino: 'SEM_FICHA' }, false)).toBe(3)
  })

  it('a faixa é a regra inteira, em quatro números', () => {
    const f = (ocorrencias: number, destino: LinhaPrateleira['destino'], sug: boolean) =>
      faixaDaLinha({ nomeSuitable: 'x', titulo: 'x', ocorrencias, destino }, sug)
    expect(f(10, 'SEM_FICHA', true)).toBe(0)
    expect(f(10, 'SEM_FICHA', false)).toBe(1)
    expect(f(10, 'FICHA', false)).toBe(2)
    expect(f(10, 'IGNORAR', false)).toBe(2)
    expect(f(0, 'SEM_FICHA', true)).toBe(3)   // ⛔ zero ganha de tudo, até de sugestão
  })
})
