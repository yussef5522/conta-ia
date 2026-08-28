// REGRA 1 — O CAMPO DE QUANTIDADE NÃO ACEITAVA DECIMAL (28/08, o dono pegou no Acém).
//
// "escolhi Acém (33,95/KG) e o campo só aceita 1, 5, 10 — não consigo digitar 0,050 (50
// gramas) nem 0,10. Receita de lanche É feita de fração de KG; sem decimal o modal é inútil."
//
// ⚠️ A CAUSA: o input era `value={numero}` + `onChange={parse}`. No instante em que a
// vírgula é digitada, "0," vira o número 0 e a vírgula SOME da tela — estado intermediário
// não é representável como número. Por isso só inteiro passava.
//
// A cura: o que se DIGITA é TEXTO; o número é derivado. Estes testes travam os estados
// intermediários, que são exatamente o que o `value` numérico destruía.

import { describe, it, expect } from 'vitest'
import { sanitizarQtd, valorQtd, textoQtd, descreverQtd, validarQtd, aceitaFracao } from '../quantidade'

describe('⭐⭐ os números REAIS do dono', () => {
  it('Acém: 0,050 KG × 33,95 = 1,70', () => {
    const v = valorQtd(sanitizarQtd('0,050', 'KG'))!
    expect(v).toBe(0.05)
    expect(Math.round(v * 33.95 * 100) / 100).toBe(1.7)
  })

  it('Queijo: 0,080 KG × 31,90 = 2,55', () => {
    const v = valorQtd(sanitizarQtd('0,080', 'KG'))!
    expect(v).toBe(0.08)
    expect(Math.round(v * 31.9 * 100) / 100).toBe(2.55)
  })

  it('0,10 também passa (o outro que ele tentou)', () => {
    expect(valorQtd(sanitizarQtd('0,10', 'KG'))).toBe(0.1)
  })
})

describe('⭐ os ESTADOS INTERMEDIÁRIOS — é aqui que o campo antigo morria', () => {
  it('digitando "0" → "," → "0" → "5" → "0", cada passo sobrevive', () => {
    // ⚠️ com `value={numero}`, o passo "0," virava 0 e a vírgula sumia: impossível seguir.
    expect(sanitizarQtd('0', 'KG')).toBe('0')
    expect(sanitizarQtd('0,', 'KG')).toBe('0,')
    expect(sanitizarQtd('0,0', 'KG')).toBe('0,0')
    expect(sanitizarQtd('0,05', 'KG')).toBe('0,05')
    expect(sanitizarQtd('0,050', 'KG')).toBe('0,050')
  })

  it('"0," ainda não é número — e vazio NUNCA vira zero', () => {
    expect(valorQtd('0,')).toBe(0) // "0." → 0, coerente
    expect(valorQtd('')).toBeNull()
    expect(valorQtd(',')).toBeNull()
    expect(valorQtd('abc')).toBeNull()
  })

  it('campo pode ficar vazio enquanto o dono apaga pra redigitar', () => {
    expect(sanitizarQtd('', 'KG')).toBe('')
  })
})

describe('vírgula E ponto — o dono digita como quiser', () => {
  it('ponto vira vírgula na tela (padrão BR), mesmo valor', () => {
    expect(sanitizarQtd('0.050', 'KG')).toBe('0,050')
    expect(valorQtd('0.05')).toBe(0.05)
    expect(valorQtd('0,05')).toBe(0.05)
  })

  it('só UM separador — o primeiro manda', () => {
    expect(sanitizarQtd('0,0,5', 'KG')).toBe('0,05')
    expect(sanitizarQtd('1.2.3', 'KG')).toBe('1,23')
  })

  it('letra e símbolo não entram', () => {
    expect(sanitizarQtd('0,0a5kg', 'KG')).toBe('0,05')
    expect(sanitizarQtd('-3', 'KG')).toBe('3')
  })

  it('até 3 casas (grama/ml é o menor que a cozinha usa)', () => {
    expect(sanitizarQtd('0,12345', 'KG')).toBe('0,123')
  })
})

describe('⭐ UN é INTEIRO — não existe 0,5 pão', () => {
  it('a digitação corta no separador', () => {
    expect(sanitizarQtd('1,5', 'UN')).toBe('1')
    expect(sanitizarQtd('2.75', 'UN')).toBe('2')
  })

  it('e a validação recusa fração com instrução, não com "inválido"', () => {
    const erro = validarQtd('1.5', 'UN', 'Pão')!
    expect(erro).toContain('fração')
    expect(erro).toContain('unidade menor') // diz o que FAZER (é a reunitização)
    expect(validarQtd('2', 'UN', 'Pão')).toBeNull()
  })

  it('KG e LT fracionam; UN e o resto não', () => {
    expect(aceitaFracao('KG')).toBe(true)
    expect(aceitaFracao('LT')).toBe(true)
    expect(aceitaFracao('UN')).toBe(false)
    expect(aceitaFracao('CX')).toBe(false)
  })
})

describe('⭐ a conversão amigável — pra não errar UM ZERO', () => {
  it('0,050 KG = 50 g · 0,080 KG = 80 g', () => {
    expect(descreverQtd(0.05, 'KG')).toBe('50 g')
    expect(descreverQtd(0.08, 'KG')).toBe('80 g')
  })

  it('⚠️ 0,005 KG = 5 g — o zero a mais fica ÓBVIO (10× no custo)', () => {
    expect(descreverQtd(0.005, 'KG')).toBe('5 g')
  })

  it('litro vira ml', () => {
    expect(descreverQtd(0.25, 'LT')).toBe('250 ml')
  })

  it('não polui: ≥ 1 se lê sozinho, e UN não tem conversão', () => {
    expect(descreverQtd(1.5, 'KG')).toBeNull()
    expect(descreverQtd(2, 'UN')).toBeNull()
    expect(descreverQtd(null, 'KG')).toBeNull()
    expect(descreverQtd(0, 'KG')).toBeNull()
  })
})

describe('ida e volta (carregar ficha existente → editar)', () => {
  it('número do banco vira texto pt-BR e volta igual', () => {
    expect(textoQtd(0.08)).toBe('0,08')
    expect(valorQtd(textoQtd(0.08))).toBe(0.08)
    expect(textoQtd(null)).toBe('')
  })

  it('validação pega quantidade zerada antes de salvar', () => {
    expect(validarQtd('', 'KG', 'Acém')).toContain('maior que zero')
    expect(validarQtd('0', 'KG', 'Acém')).toContain('maior que zero')
  })
})
