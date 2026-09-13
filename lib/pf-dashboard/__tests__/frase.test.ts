// ⛔⛔ A FRASE VIRA LANÇAMENTO — E NUNCA INVENTA VALOR (13/09/2026)
//
// **As três frases que o dono pediu como red-then-green:** *"mercado 280,50"* ·
// *"gastei 45 na farmácia"* · *"recebi 500 pix"*.

import { describe, it, expect } from 'vitest'
import { lerFrase, acharValor, acharDescricao, acharSentido } from '../frase'

describe('⭐⭐ as 3 frases do dono', () => {
  it('"mercado 280,50" → saída de 280,50 em Mercado', () => {
    const f = lerFrase('mercado 280,50')
    expect(f.montou).toBe(true)
    expect(f.valor).toBe(280.5)
    expect(f.descricao).toBe('Mercado')
    expect(f.sentido).toBe('SAIDA')
    expect(f.porQue).toBeNull()
  })

  it('"gastei 45 na farmácia" → saída de 45 em Farmácia', () => {
    const f = lerFrase('gastei 45 na farmácia')
    expect(f.valor).toBe(45)
    expect(f.descricao).toBe('Farmácia')   // ⭐ "gastei" e "na" saem da descrição
    expect(f.sentido).toBe('SAIDA')
  })

  it('"recebi 500 pix" → ENTRADA de 500', () => {
    const f = lerFrase('recebi 500 pix')
    expect(f.valor).toBe(500)
    expect(f.sentido).toBe('ENTRADA')
    expect(f.descricao).toBe('Pix')
  })
})

describe('⛔⛔ SEM VALOR, SEM LANÇAMENTO', () => {
  it('frase sem número não monta — e DIZ por quê', () => {
    const f = lerFrase('almoço com a Daniela')
    expect(f.montou).toBe(false)
    expect(f.valor).toBeNull()
    expect(f.porQue).toContain('não achei o valor')
    // ⭐ mas o que deu pra ler VAI pro formulário — nunca trava
    expect(f.descricao).toContain('Almoço')
  })

  it('⛔ e não inventa valor nem quando a frase quase tem um', () => {
    expect(acharValor('mercado')).toBeNull()
    expect(acharValor('')).toBeNull()
    expect(acharValor('paguei tudo')).toBeNull()
  })

  it('texto vazio ensina o formato em vez de calar', () => {
    expect(lerFrase('   ').porQue).toContain('280,50')
  })
})

describe('⭐ o valor em pt-BR — a vírgula manda', () => {
  it.each([
    ['mercado 280,50', 280.5],
    ['mercado 280.50', 280.5],
    ['aluguel 1.280,50', 1280.5],
    ['aluguel 1.280', 1280],
    ['R$ 45', 45],
    ['gastei r$ 1.500,00 no pneu', 1500],
    ['45', 45],
  ])('%s → %s', (frase, esperado) => {
    expect(acharValor(frase)).toBe(esperado)
  })

  it('⛔⛔ 1.280,50 NÃO é R$ 1,28 — o ponto é milhar em pt-BR', () => {
    // a mesma armadilha que o campo de quantidade do estoque pagou em 08/09
    expect(acharValor('1.280,50')).toBe(1280.5)
    expect(acharValor('1.280,50')).not.toBe(1.28)
  })

  it('⭐ número no NOME não rouba o valor — pega o último', () => {
    expect(acharValor('posto 24h 180,00')).toBe(180)
  })
})

describe('⭐ o sentido: saída por default, entrada só com palavra', () => {
  it.each([
    ['mercado 50', 'SAIDA'], ['gastei 50', 'SAIDA'], ['paguei a luz 200', 'SAIDA'],
    ['recebi 500', 'ENTRADA'], ['salário 5000', 'ENTRADA'], ['caiu 300 de reembolso', 'ENTRADA'],
  ])('%s → %s', (frase, esperado) => {
    expect(acharSentido(frase)).toBe(esperado)
  })

  it('⚠️ o default é SAÍDA porque é o dia a dia — e entrada tem palavra própria', () => {
    // o contrário faria todo "mercado 50" virar dinheiro entrando, e o erro é caro
    expect(acharSentido('padaria 12')).toBe('SAIDA')
  })
})

describe('⭐ a descrição é o que sobra — e é o texto DELE', () => {
  it('tira o valor, a moeda e as palavras de ligação', () => {
    expect(acharDescricao('gastei 45 na farmácia')).toBe('Farmácia')
    expect(acharDescricao('paguei R$ 200 de luz')).toBe('Luz')
    expect(acharDescricao('comprei um café 8,50')).toBe('Café')
  })

  it('⭐ o que ele escreveu FICA — só a primeira letra sobe', () => {
    expect(acharDescricao('supermercado Baklizi 280,50')).toBe('Supermercado Baklizi')
  })

  it('⚠️ valor sem descrição ainda MONTA — ele completa no preview', () => {
    const f = lerFrase('45')
    expect(f.montou).toBe(true)
    expect(f.valor).toBe(45)
    expect(f.porQue).toContain('descrição')
  })
})
