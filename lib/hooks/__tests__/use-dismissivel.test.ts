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
import { cliqueFoiFora, ehTeclaDeFechar } from '../use-dismissivel'

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
