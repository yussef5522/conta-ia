// ⭐ ONDE O PAINEL CABE — a conta que o portal precisa (23/10/2026).
//
// ⚠️ A conta nasceu em `lib/conciliacao/posicao-do-menu.ts` (18/09, o menu do cartão ≍ que abria
// RECORTADO dentro de um `overflow-hidden`) e mudou de casa quando o seletor de item do Real ×
// Teórico caiu no MESMO defeito. O que ela ganhou aqui é a RÉGUA DA LARGURA — o menu de ações
// vive bem com 320, o seletor de busca precisa de piso, senão o nome do item quebra em 2 linhas.

import { describe, it, expect } from 'vitest'
import { posicaoFlutuante } from '../posicao-flutuante'

/** o campo de busca do seletor, no card do grupo */
const campo = (over: Partial<{ left: number; top: number; bottom: number; width: number }> = {}) => ({
  left: 40,
  top: 300,
  bottom: 336,
  width: 260,
  ...over,
})
const NOTEBOOK = { largura: 1280, altura: 800 }
const CELULAR = { largura: 390, altura: 844 }

describe('⭐⭐ o PISO de largura — o defeito do print de 23/10', () => {
  it('⭐ campo de 260px pede piso de 420 → a caixa sai com 420, NUNCA com a largura do campo', () => {
    const p = posicaoFlutuante(campo(), NOTEBOOK, { minima: 420 })
    expect(p.largura).toBe(420)
  })

  it('⭐ campo MAIOR que o piso manda — a caixa acompanha o campo, nunca encolhe pra 420', () => {
    const p = posicaoFlutuante(campo({ width: 620 }), NOTEBOOK, { minima: 420 })
    expect(p.largura).toBe(620)
  })

  it('⛔ no CELULAR de 390px o piso de 420 CEDE pra margem — a caixa nunca sangra', () => {
    const p = posicaoFlutuante(campo({ left: 12, width: 366 }), CELULAR, { minima: 420 })
    expect(p.largura).toBe(366) // 390 − 12 de margem de cada lado
    expect(p.left + p.largura).toBeLessThanOrEqual(CELULAR.largura - 12)
  })

  it('⚠️ sem régua, o default continua sendo o teto de 320 do menu de AÇÕES (o de 18/09)', () => {
    expect(posicaoFlutuante(campo({ width: 40 }), NOTEBOOK).largura).toBe(320)
  })

  it('⛔ nunca sangra pela DIREITA — campo encostado na borda', () => {
    const p = posicaoFlutuante(campo({ left: 1150, width: 110 }), NOTEBOOK, { minima: 420 })
    expect(p.left).toBe(1280 - 420 - 12)
    expect(p.left + p.largura).toBeLessThanOrEqual(NOTEBOOK.largura - 12)
  })
})

describe('⭐ ABAIXO × ACIMA — controle no rodapé não abre num vão de 40px', () => {
  it('com espaço embaixo, abre pra BAIXO, ancorado no fim do campo', () => {
    const p = posicaoFlutuante(campo(), NOTEBOOK, { minima: 420 })
    expect(p.lado).toBe('ABAIXO')
    expect(p.top).toBe(336 + 6)
    expect(p.bottom).toBeUndefined()
  })

  it('⭐ campo no RODAPÉ (sobram 44px embaixo, 700 em cima) → abre pra CIMA', () => {
    const p = posicaoFlutuante(campo({ top: 724, bottom: 756 }), NOTEBOOK, { minima: 420 })
    expect(p.lado).toBe('ACIMA')
    expect(p.bottom).toBe(800 - 724 + 6)
    expect(p.top).toBeUndefined()
    expect(p.maxAltura).toBeGreaterThan(400)
  })

  it('⛔ só sobe quando o de cima é MELHOR — campo no topo com pouco espaço dos dois lados fica ABAIXO', () => {
    // 60px em cima, 100 embaixo: apertado embaixo, mas em cima é PIOR
    const p = posicaoFlutuante({ left: 40, top: 60, bottom: 688, width: 260 }, { largura: 1280, altura: 800 }, { minima: 420 })
    expect(p.lado).toBe('ABAIXO')
  })

  it('⚠️ a altura máxima é o espaço REAL que sobra, nunca um número fixo', () => {
    const folgado = posicaoFlutuante(campo({ top: 100, bottom: 136 }), NOTEBOOK, { minima: 420 })
    const apertado = posicaoFlutuante(campo({ top: 500, bottom: 536 }), NOTEBOOK, { minima: 420 })
    expect(folgado.maxAltura).toBeGreaterThan(apertado.maxAltura)
    expect(apertado.maxAltura).toBeGreaterThanOrEqual(160) // o piso que impede painel de 10px
  })
})

describe('⚠️ a porta antiga continua valendo (os 2 importadores de 18/09 intocados)', () => {
  it('⭐ `posicaoDoMenu` é a MESMA função, com o default de 320 — re-export, não cópia', async () => {
    const { posicaoDoMenu } = await import('@/lib/conciliacao/posicao-do-menu')
    const direto = posicaoFlutuante(campo(), NOTEBOOK)
    expect(posicaoDoMenu(campo(), NOTEBOOK)).toEqual(direto)
  })
})
