// VENDAS — a frase que explica a atribuição. PURA: mesma regra do motor, texto legível.
import { describe, it, expect } from 'vitest'
import { explicarAtribuicao } from '../detalhe-dia'

const sex = new Date('2026-08-21T00:00:00.000Z') // sexta
const seg = new Date('2026-08-24T00:00:00.000Z') // segunda

describe('explicarAtribuicao', () => {
  it('D+0 em dinheiro diz que foi declarado no próprio dia', () => {
    const t = explicarAtribuicao({ diasUteisAtraso: 0, recebeSabDom: true, confirmado: true }, 'DINHEIRO', sex, false)
    expect(t).toContain('declarado no próprio dia')
    expect(t).toContain('sexta')
  })

  it('D+0 em PIX diz que cai no mesmo dia', () => {
    expect(explicarAtribuicao({ diasUteisAtraso: 0, recebeSabDom: true, confirmado: true }, 'PIX', sex, false))
      .toContain('mesmo dia')
  })

  it('cartão D+1 útil mostra a regra e o dia REAL da entrada', () => {
    const t = explicarAtribuicao({ diasUteisAtraso: 1, recebeSabDom: false, confirmado: true }, 'CARTAO', seg, false)
    expect(t).toContain('D+1 dia útil')
    expect(t).toContain('segunda')
  })

  it('BLOCO de fim de semana explica que acumulou', () => {
    const t = explicarAtribuicao({ diasUteisAtraso: 1, recebeSabDom: false, confirmado: true }, 'CARTAO', seg, true)
    expect(t).toContain('fim de semana acumula')
  })

  it('meio que recebe todo dia NÃO fala em acúmulo (não há bloco)', () => {
    const t = explicarAtribuicao({ diasUteisAtraso: 1, recebeSabDom: true, confirmado: true }, 'DINHEIRO', seg, true)
    expect(t).toContain('dia corrido')
    expect(t).not.toContain('acumula')
  })

  it('sem regra cadastrada, DIZ que não há regra — não inventa uma', () => {
    expect(explicarAtribuicao(null, 'PIX', sex, false)).toContain('sem regra')
  })
})
