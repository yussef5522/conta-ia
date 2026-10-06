/**
 * ⛔⛔⛔ A CONTAGEM É A ÂNCORA — a valoração EXECUTADA, com os números reais de prod.
 *
 * ⚠️ REGRA 3: aqui roda a régua, não um grep. E os casos são os 8 itens negativos que a Caçula
 * tinha em 05/10 — o fermento e a ERVILHA são os dois extremos (dinheiro negativo × dinheiro
 * POSITIVO com saldo negativo, o espelho).
 */
import { describe, it, expect } from 'vitest'
import {
  valorarContagem, ehAncoraDeContagem, ehMotivoDoNegativo, fraseDoMotivo,
  MOTIVOS_DO_NEGATIVO, TIPO_CONTAGEM, TIPOS_COM_CUSTO_CONHECIDO,
} from '../contagem-ancora'
import { ENTRADAS_QUE_CONSERTAM } from '../entrada-cruza-o-zero'

describe('⭐ o caminho de TODO DIA não muda em nada', () => {
  it('⭐ item com custo médio e dinheiro em pé usa o custo médio, sem resíduo', () => {
    const v = valorarContagem({ saldoSistema: 100, valorAtual: 800, contado: 95, custoMedio: 8, ultimoCustoConhecido: 7 })
    expect(v.divergencia).toBe(-5)
    expect(v.custoUnitario, 'o custo MÉDIO, não o último de compra').toBe(8)
    expect(v.custoTotal).toBe(-40)
    expect(v.residuo, 'nada pendurado = nenhuma linha à parte').toBe(0)
    expect(v.valorFinal).toBe(760)
    expect(v.base).toBe('CUSTO_MEDIO')
    expect(v.eraNegativo).toBe(false)
  })

  it('⭐ contagem que bate não gera nada', () => {
    const v = valorarContagem({ saldoSistema: 50, valorAtual: 400, contado: 50, custoMedio: 8, ultimoCustoConhecido: 8 })
    expect(v.divergencia).toBe(0)
    expect(v.custoTotal).toBe(0)
    expect(v.residuo).toBe(0)
  })
})

describe('⛔⛔ O FERMENTO — o caso real que motivou a lei (05/10)', () => {
  /**
   * ⭐ Medido em prod: saldo **−3,56 KG**, valor **−R$ 31,46**, `custoMedio` **null** (o
   * `saldo.ts` se recusa a dividir negativo por negativo), e o dono tem **6 KG na prateleira**.
   */
  const FERMENTO = { saldoSistema: -3.56, valorAtual: -31.46, contado: 6, custoMedio: null, ultimoCustoConhecido: 34 }

  it('⛔⛔ a contagem ENTRA e o saldo vira o CONTADO', () => {
    const v = valorarContagem(FERMENTO)
    expect(v.eraNegativo).toBe(true)
    expect(v.divergencia, 'atravessa o zero: de −3,56 a 6').toBe(9.56)
  })

  /**
   * ⛔⛔ **A LINHA DA QUANTIDADE CARREGA UM CUSTO QUE ALGUÉM PAGOU** — R$ 34,00/kg da última
   * compra. ⚠️ Com o `custoMedio` nulo (como prod devolve), a régua antiga gravaria o ajuste
   * por **R$ 0,00**: a quantidade consertava e o dinheiro continuava quebrado.
   */
  it('⭐⭐ a quantidade é valorada no último custo CONHECIDO', () => {
    const v = valorarContagem(FERMENTO)
    expect(v.base).toBe('ULTIMO_CONHECIDO')
    expect(v.custoUnitario).toBe(34)
    expect(v.custoTotal, '9,56 × 34').toBe(325.04)
  })

  /**
   * ⛔⛔⛔ **O ITEM TERMINA VALENDO `contado × custo` — e o resto vai numa LINHA À PARTE.**
   *
   * ⚠️ O atalho óbvio (enfiar o resíduo no `custoUnitario` da linha da quantidade) daria o
   * total certo e **um custo por unidade inventado**: R$ 24,63/kg num fermento que custa
   * R$ 34,00. O custo médio alimenta ficha, cardápio e CMV — ***"nunca por dentro do custo"***
   * é a parte da ordem que protege todo o resto.
   */
  it('⭐⭐⭐ o resíduo é LINHA PRÓPRIA, e o custo por unidade sai limpo', () => {
    const v = valorarContagem(FERMENTO)
    expect(v.residuo, '204,00 − (−31,46 + 325,04)').toBe(-89.58)
    expect(v.valorFinal, '6 KG × R$ 34,00').toBe(204)
    expect(v.valorFinal / FERMENTO.contado, 'o custo médio renasce LIMPO').toBe(34)
    // ⛔ o contrafactual: com o resíduo por dentro, o custo sairia inventado
    const porDentro = (v.custoTotal + v.residuo) / v.divergencia
    expect(Math.round(porDentro * 100) / 100, 'R$ 24,63/kg — o número que NÃO entra').toBe(24.63)
  })
})

describe('⭐ O ESPELHO — dinheiro POSITIVO com saldo negativo (a ERVILHA real)', () => {
  /** ⚠️ medido em prod: saldo **−78,39 KG** com valor **+R$ 469,96** — o estado impossível ao contrário */
  it('⭐ o alvo manda, e o resíduo tira a ficção', () => {
    const v = valorarContagem({ saldoSistema: -78.39, valorAtual: 469.96, contado: 10, custoMedio: null, ultimoCustoConhecido: 13.145 })
    expect(v.custoTotal, '88,39 × 13,145').toBe(1161.89)
    expect(v.valorFinal, '10 × 13,145').toBe(131.45)
    expect(v.residuo, 'a ficção escrita fora do custo').toBe(-1500.4)
    expect(v.valorFinal / 10, 'custo limpo').toBeCloseTo(13.145, 3)
  })
})

describe('⛔ SEM CUSTO CONHECIDO o custo é "a definir" — honesto, nunca chutado', () => {
  it('⛔ nunca houve compra nem produção: custo 0 e a palavra na base', () => {
    const v = valorarContagem({ saldoSistema: -5, valorAtual: -10, contado: 3, custoMedio: null, ultimoCustoConhecido: null })
    expect(v.base).toBe('A_DEFINIR')
    expect(v.custoUnitario, 'chutar aqui poria preço inventado na ficha e no CMV').toBe(0)
    expect(v.custoTotal).toBe(0)
    expect(v.residuo, 'o dinheiro negativo é escrito fora, mesmo sem custo').toBe(10)
    expect(v.valorFinal).toBe(0)
  })

  it('⛔ custo conhecido ZERO (bonificação) também é "a definir"', () => {
    const v = valorarContagem({ saldoSistema: -2, valorAtual: -1, contado: 1, custoMedio: null, ultimoCustoConhecido: 0 })
    expect(v.base).toBe('A_DEFINIR')
  })
})

describe('⛔ O ESTADO IMPOSSÍVEL do outro lado: saldo em pé, dinheiro negativo', () => {
  /** ⚠️ hoje são ZERO itens em prod — mas é o estado que o guard de 11/09 nomeia, e a lei vale pra ele */
  it('⛔ custo médio NEGATIVO não é usado: ele propaga a ficção', () => {
    const v = valorarContagem({ saldoSistema: 10, valorAtual: -5, contado: 8, custoMedio: -0.5, ultimoCustoConhecido: 2 })
    expect(v.eraNegativo).toBe(true)
    expect(v.custoUnitario, 'o último conhecido, nunca o médio negativo').toBe(2)
    expect(v.valorFinal, '8 × 2').toBe(16)
    expect(v.residuo).toBe(25)
  })
})

describe('⭐ CONTAR ZERO num item negativo', () => {
  it('⭐ zera quantidade E valor, com o resíduo nomeado', () => {
    const v = valorarContagem({ saldoSistema: -31, valorAtual: -112.19, contado: 0, custoMedio: null, ultimoCustoConhecido: 3.62 })
    expect(v.divergencia).toBe(31)
    expect(v.valorFinal, 'contado 0 → valor 0').toBe(0)
    expect(v.residuo, 'o que sobra depois do ajuste da quantidade').toBe(-0.03)
  })
})

describe('⚠️ resíduo de CENTAVO não vira linha', () => {
  it('⚠️ um centavo de arredondamento é ruído no extrato, não um fato', () => {
    const v = valorarContagem({ saldoSistema: -1, valorAtual: -0.01, contado: 1, custoMedio: null, ultimoCustoConhecido: 0.01 })
    expect(Math.abs(v.residuo)).toBeLessThanOrEqual(0.01)
    expect(v.residuo).toBe(0)
  })
})

describe('⭐ o vocabulário e a frase', () => {
  it('⭐ a âncora é o AJUSTE_CONTAGEM, e só ele', () => {
    expect(ehAncoraDeContagem(TIPO_CONTAGEM)).toBe(true)
    expect(ehAncoraDeContagem('ENTRADA_NF'), 'nota é entrada, não âncora').toBe(false)
    expect(ehAncoraDeContagem('AJUSTE_RESIDUO')).toBe(false)
  })

  /** ⚠️ REGRA 4: o "último custo conhecido" sai dos MESMOS tipos que consertam um negativo */
  it('⭐ os tipos com custo conhecido são os mesmos que consertam', () => {
    expect(TIPOS_COM_CUSTO_CONHECIDO).toBe(ENTRADAS_QUE_CONSERTAM)
    expect(TIPOS_COM_CUSTO_CONHECIDO, 'baixa de venda carrega custo MÉDIO, que é derivado').not.toContain('BAIXA_VENDA')
  })

  it('⭐ 4 motivos, e "não sei" é um deles de primeira classe', () => {
    expect(MOTIVOS_DO_NEGATIVO).toHaveLength(4)
    expect(ehMotivoDoNegativo('NAO_SEI'), 'obrigar a escolher causa desconhecida fabrica diagnóstico').toBe(true)
    expect(ehMotivoDoNegativo('FICHA_ERRADA')).toBe(true)
    expect(ehMotivoDoNegativo('qualquer'), 'lista FECHADA').toBe(false)
    expect(ehMotivoDoNegativo(''), 'nem vazio').toBe(false)
  })

  /** ⚠️ a frase PROMETE o desfecho: pedir o motivo sem dizer que entra se leria como recusa */
  it('⭐ a frase diz a conta E diz que a contagem vai entrar', () => {
    const f = fraseDoMotivo('fermento', -3.56, -31.46, 'KG')
    expect(f).toContain('-3.56 KG')
    expect(f).toContain('R$ 31,46')
    expect(f, 'o desfecho prometido').toContain('vai entrar')
    expect(f.toLowerCase(), 'nunca a palavra da recusa').not.toContain('não aceita')
  })
})
