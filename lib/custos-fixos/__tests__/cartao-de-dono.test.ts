/**
 * ⭐⭐ A RÉGUA DO CARTÃO FORTE, EXECUTADA (10/10/2026).
 *
 * **REGRA 3:** aqui nada é grep — o número é formatado de verdade, as palavras da sub são
 * contadas, e o popover é montado. É o que separa *"escrevi a régua"* de *"a régua morde"*.
 */
import { describe, it, expect } from 'vitest'
import {
  valorDoCartao, SUB_DO_CARTAO, MAX_PALAVRAS_DA_SUB, palavrasDaSub, FAMILIA_DO_CARTAO,
  linhaDeHonestidade, explicacoesDoPopover, type QualCartao,
} from '../cartao-de-dono'

const QUAIS: QualCartao[] = ['conta', 'porDia', 'equilibrio', 'afundar']

/**
 * ⚠️⚠️ O `Intl` PÕE ESPAÇO NÃO-QUEBRÁVEL (U+00A0) DEPOIS DE "R$" — comparar com literal de
 * teclado NUNCA casa, e o vermelho sai como `expected 'R$ 193.083' to be 'R$ 193.083'`
 * (strings visualmente idênticas). É a cicatriz de 24/09, que mordeu de novo em 09/10 e agora.
 * ⛔ Normalizo o espaço no TESTE em vez de mexer no formatador: o não-quebrável é o certo na
 * tela (ele impede o "R$" de ficar órfão no fim da linha).
 */
const semNbsp = (s: string) => s.replace(/\u00a0/g, ' ')

describe('⭐⭐ O NÚMERO É REDONDO NA FRENTE E CHEIO NO TOOLTIP', () => {
  /**
   * ⛔⛔ O VERMELHO QUE O DONO PEDIU: *"centavos no número do cartão = vermelho"*.
   * ⚠️ E o número do caso é o real de prod (R$ 193.082,50) — fixture inventada aqui esconderia
   * justamente o arredondamento do `,50`, que é a borda.
   */
  it('⛔ o curto NÃO tem centavos; o cheio TEM', () => {
    const v = valorDoCartao(193_082.5)!
    expect(v.curto, 'o cartão imprime o real redondo').not.toMatch(/,\d/)
    expect(semNbsp(v.curto)).toBe('R$ 193.083')
    expect(semNbsp(v.cheio), 'o centavo não se perde — só sai da frente').toBe('R$ 193.082,50')
  })

  it('⭐ arredonda pro real mais próximo, pra cima e pra baixo', () => {
    expect(semNbsp(valorDoCartao(1_000.49)!.curto)).toBe('R$ 1.000')
    expect(semNbsp(valorDoCartao(1_000.5)!.curto)).toBe('R$ 1.001')
    expect(semNbsp(valorDoCartao(0)!.curto)).toBe('R$ 0')
  })

  /** ⚠️ "a apurar" é estado PRÓPRIO — nunca R$ 0, a régua da casa inteira */
  it('⛔ `null` devolve `null` (a cascata do "a apurar" continua)', () => {
    expect(valorDoCartao(null)).toBeNull()
    expect(valorDoCartao(Number.NaN)).toBeNull()
  })
})

describe('⭐ AS SUBS — ≤5 palavras, uma por cartão', () => {
  it('⛔ nenhuma sub passa do teto', () => {
    for (const q of QUAIS) {
      const n = palavrasDaSub(SUB_DO_CARTAO[q])
      expect(n, `${q}: "${SUB_DO_CARTAO[q]}" tem ${n} palavras`).toBeLessThanOrEqual(MAX_PALAVRAS_DA_SUB)
      expect(n, `${q} não pode ser vazia`).toBeGreaterThan(0)
    }
  })

  it('⭐ as palavras do dono estão ali, literais', () => {
    expect(SUB_DO_CARTAO.conta).toBe('a casa come isso parada')
    expect(SUB_DO_CARTAO.equilibrio).toBe('venda/dia que paga o mês')
    expect(SUB_DO_CARTAO.afundar).toBe('acima disso, sobra de verdade')
  })

  it('⭐ cada cartão tem a família que o dono ditou', () => {
    expect(FAMILIA_DO_CARTAO).toEqual({
      conta: 'indigo', porDia: 'azul', equilibrio: 'verde', afundar: 'coral',
    })
  })
})

describe('⭐⭐ A LINHA MIÚDA — e a margem "a apurar" NUNCA vira 0%', () => {
  it('⭐ com margem, diz o percentual e a fonte do CMV', () => {
    const l = linhaDeHonestidade({ margemPct: 0.477, dias: 31 })
    expect(l).toBe('margem 47,7% (CMV por compra) · 31 dias corridos')
  })

  /**
   * ⛔⛔ Sem margem, `0%` seria uma AFIRMAÇÃO (que a empresa não tem margem nenhuma) feita a
   * partir de uma ausência de dado — e numa tela de preço isso é decisão errada com cara de
   * número. É a mesma régua do "sem contagem" do estoque.
   */
  it('⛔ sem margem, é "a apurar" — e o 0% não aparece em lugar nenhum', () => {
    const l = linhaDeHonestidade({ margemPct: null, dias: 30 })
    expect(l).toContain('margem a apurar')
    expect(l).not.toContain('0,0%')
    expect(l).toContain('30 dias corridos')
  })

  it('⭐ vírgula decimal pt-BR, nunca ponto', () => {
    expect(linhaDeHonestidade({ margemPct: 0.492, dias: 30 })).toContain('49,2%')
  })
})

describe('⭐⭐ O ⓘ GUARDA O QUE OS PARÁGRAFOS DIZIAM — nada se perde', () => {
  const base = {
    margemPct: 0.477,
    margemPorque: null,
    margemRessalva: 'CMV por COMPRA (a nota que entrou na janela), não por consumo',
    margemConta: '(receita R$ 100 − CMV R$ 52) ÷ receita = 47,7%',
    dias: 31,
    diasRotulo: '31 dias no mês — a empresa não tem calendário de funcionamento cadastrado',
    contaDosChips: 'CASA + BANCO + COMPROMISSOS',
    foraDaConta: null,
    porqueDoAfundar: 'R$ 1.000 por dia ÷ margem de 47,7%',
  }

  it('⭐ a ressalva do CMV e o calendário continuam existindo', () => {
    const e = explicacoesDoPopover(base)
    const tudo = e.map((x) => `${x.titulo}: ${x.texto}`).join(' | ')
    expect(tudo, 'a ressalva do CMV por compra').toContain('por COMPRA')
    expect(tudo, 'o porquê dos dias corridos').toContain('calendário de funcionamento')
    expect(tudo, 'a composição dos chips').toContain('CASA + BANCO + COMPROMISSOS')
    expect(tudo, 'a conta do 4º cartão').toContain('÷ margem de')
  })

  /** ⚠️ linha que fala do que NÃO aconteceu é ruído — some quando não há o que dizer */
  it('⛔ o que não existe não vira linha', () => {
    const e = explicacoesDoPopover({ ...base, contaDosChips: null, foraDaConta: null, porqueDoAfundar: null })
    expect(e.map((x) => x.titulo)).toEqual(['a margem', 'o calendário'])
  })

  it('⭐ sem margem, o ⓘ diz O PORQUÊ (é a ação) em vez de um percentual', () => {
    const e = explicacoesDoPopover({
      ...base, margemPct: null, margemConta: null,
      margemPorque: 'só 3 dos 30 dias da janela têm receita — pouco dado pra uma média',
    })
    expect(e[0].texto).toContain('pouco dado')
    expect(e[0].texto).toContain('a apurar')
  })
})
