/**
 * ⭐⭐⭐ A RÉGUA DOS 3 INTERRUPTORES — as 8 combinações, uma a uma (07/10/2026).
 *
 * **Ordem do dono:** *"os cartões têm que recalcular certo em todas as 8 combinações"*.
 *
 * ⛔⛔ **POR QUE AS OITO E NÃO UMA AMOSTRA:** cada combinação é uma soma DIFERENTE com um
 * RÓTULO diferente, e a cascata do "a apurar" entra por prateleira. Testar três e supor o
 * resto é exatamente como a divergência nasce no estado que ninguém olhou — e o dono vai
 * clicar nos oito.
 */
import { describe, it, expect } from 'vitest'
import {
  CHIPS_PADRAO,
  cartoesDoTopo,
  contaDosCartoes,
  ehPrateleira,
  praNaoAfundar,
  prateleiraOuPadrao,
  pontoDeEquilibrio,
  rotuloDoPrimeiroCartao,
  type Chips,
  type SubtotaisDasPrateleiras,
} from '../prateleira'

/** ⚠️ os números são os REAIS da Caçula em outubro (o retrato de 07/10) */
const S: SubtotaisDasPrateleiras = {
  casaPlanejado: 100_000,
  casaRealizado: 40_000,
  casaLinhas: 26,
  bancoPlanejado: 12_102,
  bancoRealizado: 1_799.39,
  bancoLinhas: 5,
  compromissos: 51_300,
  compromissosAApurar: 0,
}

const chips = (casa: boolean, banco: boolean, compromissos: boolean): Chips => ({ casa, banco, compromissos })

describe('⭐ o vocabulário das prateleiras mora no TypeScript', () => {
  it('⭐ CASA e BANCO valem; o resto não', () => {
    expect(ehPrateleira('CASA')).toBe(true)
    expect(ehPrateleira('BANCO')).toBe(true)
    expect(ehPrateleira('banco')).toBe(false)
    expect(ehPrateleira('COMPROMISSOS')).toBe(false)
  })

  it('⚠️ o default é CASA — a direção SEGURA (as 26 já marcadas não mudam de lugar)', () => {
    expect(prateleiraOuPadrao(null)).toBe('CASA')
    expect(prateleiraOuPadrao('LIXO')).toBe('CASA')
    expect(prateleiraOuPadrao('BANCO')).toBe('BANCO')
  })
})

describe('⭐⭐ AS 8 COMBINAÇÕES — a soma e o rótulo de cada uma', () => {
  const casos: { c: Chips; total: number | null; rotulo: string }[] = [
    { c: chips(true, true, true), total: 163_402, rotulo: 'CASA + BANCO + COMPROMISSOS' },
    { c: chips(true, true, false), total: 112_102, rotulo: 'CASA + BANCO' },
    { c: chips(true, false, true), total: 151_300, rotulo: 'CASA + COMPROMISSOS' },
    { c: chips(true, false, false), total: 100_000, rotulo: 'A CASA CUSTA' },
    { c: chips(false, true, true), total: 63_402, rotulo: 'BANCO + COMPROMISSOS' },
    { c: chips(false, true, false), total: 12_102, rotulo: 'BANCO' },
    { c: chips(false, false, true), total: 51_300, rotulo: 'COMPROMISSOS' },
    { c: chips(false, false, false), total: null, rotulo: 'NADA NA CONTA' },
  ]

  for (const caso of casos) {
    const nome = `casa=${caso.c.casa} banco=${caso.c.banco} compromissos=${caso.c.compromissos}`
    it(`⭐ ${nome} → ${caso.total == null ? 'a apurar' : caso.total} · "${caso.rotulo}"`, () => {
      const r = contaDosCartoes(caso.c, S)
      expect(r.rotulo).toBe(caso.rotulo)
      if (caso.total == null) {
        expect(r.total).toBeNull()
        expect(r.porque, 'a apurar sempre DIZ o motivo').toBeTruthy()
      } else {
        expect(r.total).toBeCloseTo(caso.total, 2)
        expect(r.porque).toBeNull()
      }
    })
  }

  it('⛔⛔ a Σ das partes LIGADAS é sempre o total — nenhuma prateleira entra duas vezes', () => {
    for (const caso of casos) {
      if (caso.total == null) continue
      const esperado =
        (caso.c.casa ? S.casaPlanejado! : 0) +
        (caso.c.banco ? S.bancoPlanejado! : 0) +
        (caso.c.compromissos ? S.compromissos : 0)
      expect(contaDosCartoes(caso.c, S).total).toBeCloseTo(esperado, 2)
    }
  })

  it('⭐ o rótulo do 1º cartão acompanha os chips, sempre', () => {
    expect(rotuloDoPrimeiroCartao(chips(true, false, false))).toBe('A CASA CUSTA')
    expect(rotuloDoPrimeiroCartao(chips(true, true, false))).toBe('CASA + BANCO')
  })
})

describe('⛔⛔ prateleira LIGADA sem plano não vale ZERO — ela torna o cartão "a apurar"', () => {
  it('⛔ casa ligada e sem plano: "a casa é de graça" é a pior leitura possível', () => {
    const semCasa = { ...S, casaPlanejado: null } // ⚠️ casaLinhas: 26 — TEM linha, sem plano
    const r = contaDosCartoes(chips(true, true, true), semCasa)
    expect(r.total).toBeNull()
    expect(r.porque).toContain('a casa')
  })

  it('⛔ banco ligado e sem plano idem — e o motivo NOMEIA qual falta', () => {
    const semBanco = { ...S, bancoPlanejado: null } // ⚠️ bancoLinhas: 5 — TEM linha, sem plano
    const r = contaDosCartoes(chips(true, true, true), semBanco)
    expect(r.total).toBeNull()
    expect(r.porque).toContain('o banco')
    expect(r.porque).not.toContain('a casa')
  })

  it('⭐ DESLIGAR a prateleira sem plano devolve o número — é o que faz o cenário funcionar', () => {
    const semBanco = { ...S, bancoPlanejado: null } // ⚠️ bancoLinhas: 5 — TEM linha, sem plano
    const r = contaDosCartoes(chips(true, false, true), semBanco)
    expect(r.total).toBeCloseTo(151_300, 2)
  })

  /**
   * ⛔⛔⛔ **ESTE CASO FOI ACHADO PELA PROVA EM PROD (07/10), não por raciocínio.**
   *
   * Em setembro a Caçula tem R$ 95.618,64 de plano na casa e R$ 103.051,67 de compromisso
   * medido — e o 1º cartão dizia **"a apurar"**, porque a prateleira do BANCO está VAZIA (zero
   * categorias marcadas) com o chip ligado, e a cascata tratava isso como *"não declarou"*. A
   * frase pedia *"declare o que cada custo fixo do banco deve custar"* sobre uma prateleira
   * que não tem UMA linha — e o dono não teria saída a não ser desligar um interruptor que ele
   * nem sabe por que está no caminho.
   *
   * ⭐ Prateleira VAZIA vale **ZERO**: é um FATO ("não tem nada aqui"), igual a
   * `compromissos: 0`. O *"a apurar"* fica pro caso que ele existe pra cobrir — a prateleira
   * que TEM linha e nenhuma com plano.
   */
  it('⛔⛔ prateleira VAZIA (0 linhas) vale ZERO, nunca "a apurar"', () => {
    const bancoVazio = { ...S, bancoPlanejado: null, bancoRealizado: 0, bancoLinhas: 0 }
    const r = contaDosCartoes(chips(true, true, true), bancoVazio)
    expect(r.total, 'a casa + os compromissos continuam somando').toBeCloseTo(151_300, 2)
    expect(r.porque).toBeNull()
  })

  it('⛔ e isso NÃO afrouxa: prateleira COM linha e sem plano segue "a apurar"', () => {
    const comLinhaSemPlano = { ...S, bancoPlanejado: null, bancoLinhas: 3 }
    const r = contaDosCartoes(chips(true, true, true), comLinhaSemPlano)
    expect(r.total).toBeNull()
    expect(r.porque).toContain('o banco')
  })

  it('⚠️ COMPROMISSOS zero é FATO, não ausência de declaração — não vira "a apurar"', () => {
    const sem = { ...S, compromissos: 0 }
    const r = contaDosCartoes(chips(false, false, true), sem)
    expect(r.total).toBe(0)
    expect(r.porque).toBeNull()
  })
})

describe('⭐ o que ficou FORA aparece com o VALOR, nunca só "filtrado"', () => {
  it('⭐ banco e compromissos desligados → a linha nomeia os dois com o número', () => {
    const r = contaDosCartoes(chips(true, false, false), S)
    expect(r.foraDaConta).toContain('banco')
    expect(r.foraDaConta).toContain('compromissos')
    expect(r.foraDaConta).toMatch(/12\.102/)
    expect(r.foraDaConta).toMatch(/51\.300/)
  })

  it('⚠️ nada fora → nenhuma linha (frase sobre o que não aconteceu é ruído)', () => {
    expect(contaDosCartoes(CHIPS_PADRAO, S).foraDaConta).toBeNull()
  })

  it('⚠️ prateleira VAZIA desligada não vira linha — não há o que estar fora', () => {
    const vazio = { ...S, bancoPlanejado: null, bancoRealizado: 0, bancoLinhas: 0 }
    const r = contaDosCartoes(chips(true, false, true), vazio)
    expect(r.foraDaConta).toBeNull()
  })
})

describe('⭐⭐⭐ O 4º CARTÃO NÃO OBEDECE AOS CHIPS — é a âncora', () => {
  const margem = { pct: 0.5, porque: null }

  it('⛔⛔ desligar TODOS os chips não muda o "pra não afundar"', () => {
    const dias = 31
    const todosOn = cartoesDoTopo(chips(true, true, true), S, dias, margem)
    const todosOff = cartoesDoTopo(chips(false, false, false), S, dias, margem)
    expect(todosOff.conta.total, 'o 1º cartão MUDA').toBeNull()
    expect(todosOff.afundar.porDia, 'o 4º NÃO muda').toBeCloseTo(todosOn.afundar.porDia!, 6)
    // 163.402 ÷ 31 ÷ 0,5
    expect(todosOff.afundar.porDia).toBeCloseTo(163_402 / 31 / 0.5, 4)
  })

  it('⭐ ele soma a verdade COMPLETA (casa + banco + compromissos)', () => {
    const r = praNaoAfundar(S, 31, 0.5, null)
    expect(r.totalDoMes).toBeCloseTo(163_402, 2)
  })

  it('⛔ sem plano em alguma prateleira ele é "a apurar" — nunca uma meta pela metade', () => {
    const r = praNaoAfundar({ ...S, casaPlanejado: null }, 31, 0.5, null)
    expect(r.porDia).toBeNull()
    expect(r.porque).toContain('a casa')
  })

  it('⛔ sem margem medida idem, e com o motivo DA MARGEM', () => {
    const r = praNaoAfundar(S, 31, null, 'não há receita registrada nesta janela')
    expect(r.porDia).toBeNull()
    expect(r.porque).toBe('não há receita registrada nesta janela')
    // ⭐ mas o total do mês CONTINUA conhecido — só a meta depende da margem
    expect(r.totalDoMes).toBeCloseTo(163_402, 2)
  })

  it('⛔ margem NEGATIVA não vira meta negativa com cara de alvo', () => {
    expect(praNaoAfundar(S, 31, -0.1, 'CMV acima da receita').porDia).toBeNull()
  })
})

describe('⭐ o ponto de equilíbrio herda o "a apurar" das duas pontas', () => {
  it('⛔ sem custo fixo não existe meta — R$ 0,00/dia se leria como "a casa se paga sozinha"', () => {
    expect(pontoDeEquilibrio(null, { pct: 0.5, porque: null }).porDia).toBeNull()
  })

  it('⛔ sem margem idem, e repete o motivo dela', () => {
    const r = pontoDeEquilibrio(1000, { pct: null, porque: 'pouco dado' })
    expect(r.porDia).toBeNull()
    expect(r.porque).toBe('pouco dado')
  })

  it('⭐ com os dois, a conta vai ESCRITA (tela nunca mostra percentual sem régua)', () => {
    const r = pontoDeEquilibrio(2_425.19, { pct: 0.498, porque: null })
    expect(r.porDia).toBeCloseTo(2_425.19 / 0.498, 4)
    expect(r.conta).toContain('49.8%')
  })
})

describe('⭐⭐ `cartoesDoTopo` é a régua ÚNICA dos 4 cartões', () => {
  it('⭐ o 2º e o 3º cartão DERIVAM do 1º — o encadeamento não se rompe no toggle', () => {
    const dias = 31
    for (const c of [chips(true, true, true), chips(true, false, false), chips(false, false, true)]) {
      const r = cartoesDoTopo(c, S, dias, { pct: 0.5, porque: null })
      expect(r.porDia.valor).toBeCloseTo(r.conta.total! / dias, 6)
      expect(r.equilibrio.porDia).toBeCloseTo(r.porDia.valor! / 0.5, 6)
    }
  })

  it('⛔ chips todos desligados: os 3 primeiros são "a apurar" e o 4º continua número', () => {
    const r = cartoesDoTopo(chips(false, false, false), S, 31, { pct: 0.5, porque: null })
    expect(r.conta.total).toBeNull()
    expect(r.porDia.valor).toBeNull()
    expect(r.equilibrio.porDia).toBeNull()
    expect(r.afundar.porDia).not.toBeNull()
  })

  it('⚠️ o rótulo dos dias é HONESTO: diz que não há calendário cadastrado', () => {
    const r = cartoesDoTopo(CHIPS_PADRAO, S, 31, { pct: 0.5, porque: null })
    expect(r.porDia.rotulo).toContain('não tem calendário')
    expect(r.porDia.dias).toBe(31)
  })
})
