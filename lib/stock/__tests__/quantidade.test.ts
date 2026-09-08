// ⛔⛔⛔ QUANTIDADE NÃO ACEITAVA DECIMAL NA CONFERÊNCIA (08/09/2026) — caso real do dono.
//
// *"Produto que chega por KG em fração (0,600 · 0,350 · 0,100) e o campo de editar
// quantidade não deixa ir abaixo de 1 — não aceito 0,600."*
//
// ⚠️⚠️ E A LIÇÃO É "N CAMINHOS, 1 ESQUECIDO": este módulo existe desde **28/08** e resolve
// exatamente esta dor — nasceu do mesmo bug no editor de ficha. **A conferência nunca o
// usou.** Ela tinha `<input type="number">` cru, e `type="number"` sem `step` assume
// `step="1"`: o navegador recusa `0,600` sozinho, sem erro, sem log, sem uma linha nossa
// pra procurar.
//
// ⭐ O armazenamento sempre esteve certo, medido ANTES de mexer: `qtdRecebida` é `Float`, a
// rota valida com `z.coerce.number().positive()` (sem `.int()`), e **241 dos 660 movimentos
// do ledger já eram fracionados**. Só a DIGITAÇÃO era impossível.

import { describe, it, expect } from 'vitest'
import {
  aceitaFracao, sanitizarQtd, valorQtd, textoQtd, validarQtd, descreverQtd, stepDaUnidade,
} from '../quantidade'

/** o caminho real da tela: digitar → sanitizar → virar número */
const digitar = (texto: string, unidade: string) => valorQtd(sanitizarQtd(texto, unidade))

describe('⭐ a régua vem da UNIDADE, não de um toggle', () => {
  it('peso e volume aceitam fração', () => {
    for (const u of ['KG', 'kg', 'G', 'L', 'LT', 'ML']) expect(aceitaFracao(u)).toBe(true)
  })

  it('⛔ contagem de peça é inteira — "meia caixa não existe"', () => {
    for (const u of ['UN', 'UND', 'PC', 'PCT', 'CX', 'DZ', 'PAR']) expect(aceitaFracao(u)).toBe(false)
  })

  it('⚠️ unidade DESCONHECIDA aceita fração — e a escolha tem motivo', () => {
    // travar o desconhecido no inteiro repetiria o bug de origem num item que nem existe
    // ainda; fração indevida numa peça o dono vê na hora, campo bloqueado ele descobre
    // com a nota na mão.
    expect(aceitaFracao('BANDEJA')).toBe(true)
  })

  it('⛔⛔ o `step` que faltava: sem ele o HTML assume 1 e o navegador recusa 0,6', () => {
    expect(stepDaUnidade('KG')).toBe('0.001')
    expect(stepDaUnidade('UN')).toBe('1')
  })
})

describe('⭐ o caso que motivou: 0,600 KG', () => {
  it('vírgula brasileira, do jeito que o dono digita', () => {
    expect(digitar('0,600', 'KG')).toBe(0.6)
    expect(digitar('0,350', 'KG')).toBe(0.35)
    expect(digitar('0,100', 'KG')).toBe(0.1)
  })

  it('ponto também, como ele pediu', () => {
    expect(digitar('0.600', 'KG')).toBe(0.6)
  })

  it('⛔⛔ E O ESTADO INTERMEDIÁRIO SOBREVIVE — é o coração do arquivo', () => {
    // digitando "0,600" tecla a tecla: se algum passo virasse número, a vírgula sumiria
    // da tela e seria IMPOSSÍVEL escrever o resto.
    expect(sanitizarQtd('0', 'KG')).toBe('0')
    expect(sanitizarQtd('0,', 'KG')).toBe('0,')
    expect(sanitizarQtd('0,6', 'KG')).toBe('0,6')
    expect(sanitizarQtd('0,60', 'KG')).toBe('0,60')
    expect(sanitizarQtd('0,600', 'KG')).toBe('0,600')
  })

  it('não passa de 3 casas: a balança dá GRAMA', () => {
    expect(sanitizarQtd('0,6001', 'KG')).toBe('0,600')
  })

  it('e a confirmação visual evita o erro de UM ZERO', () => {
    // 0,05 e 0,005 são parecidos na tela e 10× diferentes no custo
    expect(descreverQtd(0.6, 'KG')).toBe('600 g')
    expect(descreverQtd(0.05, 'KG')).toBe('50 g')
    expect(descreverQtd(0.005, 'KG')).toBe('5 g')
  })
})

describe('⛔⛔ DUAS REGRAS DE PONTO CONVIVIAM — unificadas em 08/09', () => {
  // Aqui o separador CORTAVA o resto (`6.313 UN` → `6`); o cartão de contagem tinha parse
  // próprio tratando ponto como milhar (`6.313` → `6313`). Duas derivações da mesma
  // pergunta. Venceu a da contagem: cortar em 6 **perdia 6.307 unidades em silêncio**.
  it('⭐ unidade INTEIRA: o separador é MILHAR e some', () => {
    expect(digitar('6.313', 'UN')).toBe(6313)
    expect(digitar('1.234', 'CX')).toBe(1234)
    expect(digitar('6,313', 'UN')).toBe(6313)
  })

  it('⛔ e fração em unidade inteira é impossível POR CONSTRUÇÃO, não por aviso', () => {
    // o sanitizador nem deixa a vírgula existir ali — não há o que validar depois
    expect(sanitizarQtd('0,5', 'UN')).toBe('05')
    expect(validarQtd('0,5', 'UN', 'Pão')).toContain('não dá pra usar fração')
  })

  it('⭐ unidade FRACIONÁVEL: o primeiro separador é DECIMAL', () => {
    expect(digitar('6.313', 'KG')).toBe(6.313)
  })
})

describe('⛔ o que continua sendo recusado', () => {
  it('vazio e lixo viram null — NUNCA 0', () => {
    // ⚠️ devolver 0 faria "não digitou" passar por "digitou zero"
    expect(valorQtd('')).toBeNull()
    expect(valorQtd('abc')).toBeNull()
    expect(digitar('', 'KG')).toBeNull()
  })

  it('zero não passa na validação de salvar', () => {
    expect(validarQtd('0', 'KG', 'Acém')).toContain('maior que zero')
  })

  it('a mensagem da fração ENSINA a saída', () => {
    expect(validarQtd('0,5', 'UN', 'Pão')).toContain('unidade menor')
  })
})

describe('⭐ o caminho inteiro: sem arredondamento silencioso', () => {
  it('0,350 KG × custo por KG dá o proporcional certo', () => {
    const qtd = digitar('0,350', 'KG')!
    // ⚠️ se algum lugar arredondasse pra INTEIRO, 0,350 viraria 0 (some o item) ou 1
    // (paga 40,00 por 350 g) — os dois, erros de dezenas de reais.
    expect(Math.round(qtd * 40 * 100) / 100).toBe(14)
    expect(qtd).not.toBe(0)
    expect(qtd).not.toBe(1)
  })

  it('⛔ o número volta IGUAL: digitar → salvar → mostrar → digitar de novo', () => {
    for (const t of ['0,600', '0,350', '0,100', '12,5']) {
      const v = digitar(t, 'KG')!
      expect(digitar(textoQtd(v), 'KG')).toBe(v)   // ida e volta sem perder nada
    }
  })
})
