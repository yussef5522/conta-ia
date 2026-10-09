/**
 * ⚠️ O QUE ESTE ARQUIVO TRAVA SÃO OS **ESTADOS INTERMEDIÁRIOS** — que é justamente o que um
 * `value={numero}` destrói, e o motivo de o campo de quantidade do estoque não aceitar decimal
 * por três semanas (08/09).
 */
import { describe, it, expect } from 'vitest'
import { sanitizarDinheiro, valorDinheiro } from '../money-input'

describe('⭐ digitar dinheiro — o texto sobrevive à digitação', () => {
  it('⭐ os estados intermediários de "40000,50" NÃO se perdem', () => {
    const passos = ['4', '40', '400', '4000', '40000', '40000,', '40000,5', '40000,50']
    for (const p of passos) {
      expect(sanitizarDinheiro(p), `o passo "${p}" foi destruído`).toBe(p)
    }
    // ⛔ o passo que o `value` numérico matava: a vírgula sozinha
    expect(sanitizarDinheiro('40000,')).toBe('40000,')
    expect(valorDinheiro('40000,')).toBe(40000)
  })

  it('⛔⛔ PONTO É MILHAR: "40.000" são quarenta mil, nunca R$ 40,00', () => {
    expect(valorDinheiro('40.000')).toBe(40000)
    expect(valorDinheiro('40.000,00')).toBe(40000)
    expect(valorDinheiro('1.428,57')).toBe(1428.57)
    expect(valorDinheiro('380.000,00')).toBe(380000)
  })

  it('⭐ o caso real do dono: 40.000 de devolução', () => {
    expect(valorDinheiro(sanitizarDinheiro('40.000,00'))).toBe(40000)
    expect(valorDinheiro(sanitizarDinheiro('40000'))).toBe(40000)
    expect(valorDinheiro(sanitizarDinheiro('40.000'))).toBe(40000)
  })

  it('⚠️ VÍRGULA é decimal mesmo com 3 dígitos atrás — a intenção era decimal, e dinheiro tem 2 casas', () => {
    // ⛔ a régua do milhar vale só pro PONTO; quem digita vírgula quis separar o centavo
    expect(valorDinheiro('40,000')).toBe(40)
    expect(sanitizarDinheiro('40,000')).toBe('40,00')
  })

  it('⛔ o teto é 2 casas — centavo é o menor que dinheiro tem', () => {
    expect(sanitizarDinheiro('10,123456')).toBe('10,12')
    expect(valorDinheiro('10,129')).toBe(10.12)
  })

  it('⛔⛔ VAZIO devolve `null`, NUNCA 0 — ausência não é zero', () => {
    expect(valorDinheiro('')).toBeNull()
    expect(valorDinheiro('abc')).toBeNull()
    expect(valorDinheiro(',')).toBeNull()
    expect(sanitizarDinheiro('abc')).toBe('')
  })

  it('⚠️ lixo digitado não vira número plausível', () => {
    expect(sanitizarDinheiro('R$ 40.000,00')).toBe('40000,00')
    expect(valorDinheiro('R$ 40.000,00')).toBe(40000)
  })
})
