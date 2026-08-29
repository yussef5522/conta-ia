// REGRA 1 — O ROTEADOR MANDAVA A FATURA DO MERCADO PAGO PRO PARSER DA CAIXA (29/08/2026).
//
// ⚠️ Pego na validação ponta a ponta, com o PDF real: o roteador fazia
// `DETERMINISTIC.find(d => d.match.test(text))` — **o PRIMEIRO que casa**. O texto do MP diz
// *"saque no CAIXA eletrônico"*, o match da Caixa é `/caixa/i`, e a Caixa vem antes no
// array. A fatura do Mercado Pago ia pro parser da Caixa e voltava com
// *"não encontrei o Valor total desta fatura da Caixa"* — **uma recusa que culpava o PDF do
// cliente por um erro de roteamento nosso**. Exatamente a classe que o sprint quer matar.
//
// ⚠️ "Só reordenar o array" resolveria por ACIDENTE. Palavra comum não identifica emissor;
// QUANTIDADE de evidência identifica. No caso real: MP 8 ocorrências × Caixa 2.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { escolherParser } from '../../extract-invoice-smart'

const fixture = (n: string) => readFileSync(join(__dirname, 'fixtures', n), 'utf-8')

describe('⭐⭐ cada fatura vai pro SEU parser', () => {
  it('⭐⭐ Mercado Pago → Mercado Pago (ia pra Caixa por causa de "caixa eletrônico")', () => {
    const d = escolherParser(fixture('mercadopago-fatura-2026-08.txt'))
    expect(d?.bank).toBe('Mercado Pago')
  })

  it('Caixa → Caixa', () => {
    expect(escolherParser(fixture('caixa-fatura-real.txt'))?.bank).toBe('Caixa')
  })

  it('Banrisul → Banrisul', () => {
    expect(escolherParser(fixture('banrisul-fatura-real.txt'))?.bank).toBe('Banrisul')
  })

  it('Sicredi → Sicredi', () => {
    expect(escolherParser(fixture('sicredi-fatura-real.txt'))?.bank).toBe('Sicredi')
  })
})

describe('⚠️ o roteamento é por EVIDÊNCIA, não por ordem', () => {
  it('⭐ menção de passagem perde pra menção repetida', () => {
    const texto = 'Fatura Mercado Pago. Mercado Pago. Mercado Pago. Saque no caixa eletrônico.'
    expect(escolherParser(texto)?.bank).toBe('Mercado Pago')
  })

  it('⚠️ e o inverso vale igual — não é favorecimento do MP', () => {
    const texto = 'CAIXA ECONOMICA. Fatura CAIXA. Cartão CAIXA. Compra em MERCADOPAGO*LOJA.'
    expect(escolherParser(texto)?.bank).toBe('Caixa')
  })

  it('⭐ EMPATE não adivinha — devolve nenhum e a decisão sobe', () => {
    // rotear errado devolve "seu PDF está errado" pra um PDF que está certo
    expect(escolherParser('caixa mercado pago')).toBeUndefined()
  })

  it('texto sem nenhum emissor conhecido → nenhum parser (vai pra camada de cima)', () => {
    expect(escolherParser('Fatura do Banco Inventado S/A. Total R$ 100,00')).toBeUndefined()
  })

  it('texto vazio não quebra', () => {
    expect(escolherParser('')).toBeUndefined()
  })
})
