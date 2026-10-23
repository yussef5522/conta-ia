// REGRA 1 — A BUSCA DE INGREDIENTES NÃO FECHAVA SEM ESCOLHER (28/08).
//
// "abro a busca, a lista abre (Acém, Coxão...), mas se eu DESISTO de escolher não tem como
// sair: clicar fora não fecha, e a lista fica aberta na tela."
//
// ⚠️ O projeto roda os testes em `environment: 'node'` (sem jsdom), então o que dá pra
// provar é a DECISÃO — e é por isso que ela é pura e duck-typed: `cliqueFoiFora` aceita
// qualquer coisa com `contains`. A fiação dos listeners fica no hook, fina de propósito.
//
// ⚠️ Não adicionei jsdom só pra este teste: puxar dependência nova pra provar 4 linhas de
// `addEventListener` trocaria um risco pequeno por um custo permanente de manutenção.

import { describe, it, expect } from 'vitest'
import { cliqueFoiFora, cliqueFoiForaDeTodos, ehTeclaDeFechar } from '../use-dismissivel'

/** painel falso: "contém" os nós que estiverem na lista */
const painel = (dentro: unknown[]) => ({ contains: (n: unknown) => dentro.includes(n) })

describe('⭐ clique FORA fecha (o caso do dono: desistiu de escolher)', () => {
  it('⭐⭐ clicou no meio da tela, longe do dropdown → fecha', () => {
    const dropdown = painel(['input', 'lista', 'item-acem'])
    expect(cliqueFoiFora(dropdown, 'fundo-da-pagina')).toBe(true)
  })

  it('clicou DENTRO (no input ou num item) → NÃO fecha', () => {
    const dropdown = painel(['input', 'lista', 'item-acem'])
    expect(cliqueFoiFora(dropdown, 'input')).toBe(false)
    expect(cliqueFoiFora(dropdown, 'item-acem')).toBe(false)
  })

  it('⚠️ sem container montado NÃO fecha — fechar por ausência derrubaria no 1º render', () => {
    expect(cliqueFoiFora(null, 'qualquer')).toBe(false)
    expect(cliqueFoiFora(undefined, 'qualquer')).toBe(false)
  })

  it('evento sem alvo não fecha (não adivinha)', () => {
    expect(cliqueFoiFora(painel([]), null)).toBe(false)
    expect(cliqueFoiFora(painel([]), undefined)).toBe(false)
  })
})

describe('ESC fecha', () => {
  it('⭐ Escape fecha', () => {
    expect(ehTeclaDeFechar('Escape')).toBe(true)
  })

  it('aceita o nome legado "Esc" (Edge antigo)', () => {
    expect(ehTeclaDeFechar('Esc')).toBe(true)
  })

  it('⚠️ outra tecla NÃO fecha — digitar "e" de "Acém" tem que continuar buscando', () => {
    for (const k of ['e', 'Enter', 'ArrowDown', 'Backspace', 'a', ' ']) {
      expect(ehTeclaDeFechar(k)).toBe(false)
    }
  })
})

// ⛔⛔ OS DOIS CONTAINERS — O GESTO QUE MORRIA NO PORTAL (23/10).
//
// Com o painel no PORTAL ele NÃO é descendente do container do campo. Perguntando a UM ref só,
// o clique no resultado conta como "fora": o `mousedown` fecha o dropdown ANTES do `click` do
// botão chegar, e ***o item nunca é adicionado***. O gesto morre sem erro nenhum na tela.
describe('⭐⭐ clique dentro do PAINEL NO PORTAL não fecha (senão o item nunca é adicionado)', () => {
  const campo = painel(['input', 'toggle'])
  const portal = painel(['resultado-queijo', 'botao-mais', 'criar'])

  it('⛔⛔ o clique no RESULTADO é "fora do campo" — com UM ref só, fecharia e mataria o gesto', () => {
    // é o contrafactual: a régua antiga (um container) manda FECHAR no clique do resultado
    expect(cliqueFoiFora(campo, 'resultado-queijo')).toBe(true)
    // ⭐ a régua dos DOIS não fecha
    expect(cliqueFoiForaDeTodos([campo, portal], 'resultado-queijo')).toBe(false)
  })

  it('clique no + do resultado e no "criar" também não fecham', () => {
    expect(cliqueFoiForaDeTodos([campo, portal], 'botao-mais')).toBe(false)
    expect(cliqueFoiForaDeTodos([campo, portal], 'criar')).toBe(false)
  })

  it('⭐ clique no CAMPO não fecha', () => {
    expect(cliqueFoiForaDeTodos([campo, portal], 'input')).toBe(false)
  })

  it('⭐⭐ clique FORA dos dois fecha — o dono desistiu de escolher', () => {
    expect(cliqueFoiForaDeTodos([campo, portal], 'fundo-da-pagina')).toBe(true)
  })

  it('⚠️ painel ainda NÃO montado não vota — senão fecharia no 1º toque do portal', () => {
    // o portal monta um tick depois do campo: nesse instante só o campo existe
    expect(cliqueFoiForaDeTodos([campo, null], 'input')).toBe(false)
    expect(cliqueFoiForaDeTodos([campo, undefined], 'fundo-da-pagina')).toBe(true)
  })

  it('⚠️ nenhum container montado NÃO fecha (o chamador antigo, de 1 ref, intocado)', () => {
    expect(cliqueFoiForaDeTodos([null, undefined], 'qualquer')).toBe(false)
    expect(cliqueFoiForaDeTodos([], 'qualquer')).toBe(false)
  })

  it('⭐ com UM container a régua é a de sempre — o chamador antigo não muda de comportamento', () => {
    expect(cliqueFoiForaDeTodos([campo], 'input')).toBe(false)
    expect(cliqueFoiForaDeTodos([campo], 'fundo-da-pagina')).toBe(true)
  })
})
