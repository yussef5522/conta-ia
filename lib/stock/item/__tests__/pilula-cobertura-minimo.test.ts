/**
 * ⭐⭐ AS RÉGUAS DO v4 DA PÁGINA DO ITEM — pílula, cobertura e mínimo sugerido (06/10/2026).
 *
 * ⚠️ REGRA 3: aqui as funções RODAM, com os números reais de prod (o fermento e a ERVILHA).
 */
import { describe, it, expect } from 'vitest'
import { pilulaDoItem, DIAS_PARA_PARADO } from '../pilula-do-item'
import { statusEstoque } from '../../status-estoque'
import {
  consumoDoItem, coberturaDoItem, prazoDeReposicao, minimoSugerido,
  JANELA_CONSUMO_DIAS, FOLGA_DO_MINIMO,
} from '../consumo-e-cobertura'

const AGORA = new Date('2026-10-06T12:00:00Z')
/** ⚠️ datas RELATIVAS ao `agora` do cenário — data fixa no futuro é bomba de calendário (REGRA 1/01/09) */
const diasAtras = (n: number) => new Date(AGORA.getTime() - n * 86_400_000).toISOString()

describe('⭐⭐ A PÍLULA — 5 estados, e a precedência é a da AÇÃO', () => {
  it('⛔ NEGATIVO ganha de tudo, e a pílula já diz a saída', () => {
    const p = pilulaDoItem({ saldo: -3.56, estoqueMin: 10, estoqueMax: 20, diasSemMovimento: 90 })
    expect(p.estado).toBe('NEGATIVO')
    expect(p.tom).toBe('vermelho')
    // ⭐ a lei de 05/10 aparece na pílula: contar resolve
    expect(p.porque).toMatch(/contar resolve/)
  })

  it('⭐ ZERADO ganha de PARADO — "não tem" é mais acionável que "não se move"', () => {
    const p = pilulaDoItem({ saldo: 0, estoqueMin: 5, estoqueMax: null, diasSemMovimento: 200 })
    expect(p.estado).toBe('ZERADO')
    expect(p.tom).toBe('cinza')
  })

  /**
   * ⭐⭐ A DIVERGÊNCIA DE TOM, TRAVADA: o `statusEstoque` chama de VERMELHO (é o alarme da
   * barra da Posição) e a pílula pinta ÂMBAR, porque nesta tela o vermelho é do NEGATIVO.
   * ⛔ O **status** é o mesmo nos dois — só a tinta muda.
   */
  it('⭐⭐ abaixo do mínimo: MESMO status do `statusEstoque`, tinta diferente', () => {
    const p = pilulaDoItem({ saldo: 2, estoqueMin: 10, estoqueMax: 20, diasSemMovimento: 1 })
    expect(p.estado).toBe('ABAIXO_DO_MINIMO')
    expect(p.tom, 'âmbar: o vermelho desta tela é do negativo').toBe('ambar')
    expect(statusEstoque(2, 10, 20).status, 'a régua do mínimo tem UM dono').toBe('ABAIXO')
    expect(statusEstoque(2, 10, 20).cor, 'e ela continua vermelha onde sempre foi').toBe('vermelho')
  })

  it('⭐ PARADO só acima do teto, e ele é um número com dono', () => {
    expect(pilulaDoItem({ saldo: 5, estoqueMin: null, estoqueMax: null, diasSemMovimento: DIAS_PARA_PARADO }).estado).toBe('EM_ESTOQUE')
    const p = pilulaDoItem({ saldo: 5, estoqueMin: null, estoqueMax: null, diasSemMovimento: DIAS_PARA_PARADO + 1 })
    expect(p.estado).toBe('PARADO')
    expect(p.label).toContain(String(DIAS_PARA_PARADO + 1))
  })

  it('⭐ item que NUNCA se moveu não é "parado" — é só item sem história', () => {
    expect(pilulaDoItem({ saldo: 5, estoqueMin: null, estoqueMax: null, diasSemMovimento: null }).estado).toBe('EM_ESTOQUE')
  })

  /** ⚠️ `ACIMA do máximo` não ganha pílula (decisão registrada) — a faixa mín/máx já pinta */
  it('⚠️ acima do máximo cai em "em estoque" — quem pinta isso é a faixa', () => {
    expect(pilulaDoItem({ saldo: 99, estoqueMin: 1, estoqueMax: 10, diasSemMovimento: 1 }).estado).toBe('EM_ESTOQUE')
    expect(statusEstoque(99, 1, 10).status).toBe('ACIMA')
  })
})

describe('⭐⭐ CONSUMO E COBERTURA — e o que fica FORA da conta', () => {
  const movs = [
    { tipo: 'BAIXA_VENDA', data: diasAtras(2), quantidade: -10 },
    { tipo: 'SEPARACAO_SAIDA', data: diasAtras(5), quantidade: -20 },
    { tipo: 'DEVOLUCAO_PRODUCAO', data: diasAtras(5), quantidade: 5 },
    { tipo: 'PERDA', data: diasAtras(9), quantidade: -5 },
    // ⛔ transferência interna: já saiu na separação. Contar aqui DOBRARIA a baixa.
    { tipo: 'PRODUCAO_CONSUMO', data: diasAtras(5), quantidade: -20 },
    // ⛔ entrada não é consumo
    { tipo: 'ENTRADA_NF', data: diasAtras(7), quantidade: 100 },
    // ⛔ e o que está FORA da janela não conta
    { tipo: 'BAIXA_VENDA', data: diasAtras(JANELA_CONSUMO_DIAS + 3), quantidade: -500 },
  ]

  it('⭐ consumo = venda + perda + (separação − devolução), nada mais', () => {
    const c = consumoDoItem(movs, AGORA)
    expect(c.consumoNaJanela, '10 + 5 + (20 − 5)').toBe(30)
    expect(c.porDia).toBeCloseTo(30 / JANELA_CONSUMO_DIAS, 3)
  })

  it('⭐⭐ estorno PARCIAL de venda SUBTRAI — senão a conta mente pra cima', () => {
    const comEstorno = [...movs, { tipo: 'ESTORNO', data: diasAtras(1), quantidade: 4, estornoDeTipo: 'BAIXA_VENDA' }]
    expect(consumoDoItem(comEstorno, AGORA).consumoNaJanela, '30 − 4').toBe(26)
  })

  it('⛔ sem consumo na janela, `porDia` é NULL — ausência não é zero', () => {
    const c = consumoDoItem([{ tipo: 'ENTRADA_NF', data: diasAtras(1), quantidade: 50 }], AGORA)
    expect(c.consumoNaJanela).toBe(0)
    expect(c.porDia).toBeNull()
  })

  it('⭐ cobertura = saldo ÷ consumo/dia', () => {
    const c = consumoDoItem(movs, AGORA)
    const cob = coberturaDoItem(60, c)
    expect(cob.dias, '60 ÷ 1/dia').toBe(60)
    expect(cob.porque).toBeNull()
  })

  /** ⛔ o pior caso é o teste: a ERVILHA real, negativa */
  it('⛔⛔ saldo NEGATIVO ou ZERADO não tem cobertura — e a tela DIZ por quê', () => {
    const c = consumoDoItem(movs, AGORA)
    expect(coberturaDoItem(-78.391, c)).toEqual({ dias: null, porque: 'SALDO_NAO_POSITIVO' })
    expect(coberturaDoItem(0, c)).toEqual({ dias: null, porque: 'SALDO_NAO_POSITIVO' })
  })

  it('⛔ saldo em pé SEM consumo medido: cobertura "—" com o motivo próprio', () => {
    const c = consumoDoItem([], AGORA)
    expect(coberturaDoItem(10, c)).toEqual({ dias: null, porque: 'SEM_CONSUMO' })
  })
})

describe('⭐⭐ PRAZO DE REPOSIÇÃO — MEDIANA, nunca média', () => {
  /**
   * ⛔⛔ O CASO QUE SEPARA AS DUAS: compras semanais com UMA parada de 90 dias no meio.
   * A média diz ~27 dias (a parada puxa a referência); a mediana diz 7 — o prazo real.
   */
  it('⛔⛔ uma parada longa NÃO vira "o prazo normal"', () => {
    const movs = [0, 7, 14, 104, 111].map((d) => ({ tipo: 'ENTRADA_NF', data: diasAtras(120 - d), quantidade: 10 }))
    const p = prazoDeReposicao(movs)
    expect(p.dias, 'mediana de [7,7,90,7]').toBe(7)
    const media = (7 + 7 + 90 + 7) / 4
    expect(Math.round(media), 'o contrafactual: a média diria 28').toBe(28)
  })

  it('⚠️ duas notas no MESMO dia são UMA compra — senão o prazo vira zero', () => {
    const movs = [
      { tipo: 'ENTRADA_NF', data: diasAtras(10), quantidade: 5 },
      { tipo: 'ENTRADA_NF', data: diasAtras(10), quantidade: 5 },
      { tipo: 'ENTRADA_NF', data: diasAtras(3), quantidade: 5 },
    ]
    expect(prazoDeReposicao(movs)).toEqual({ dias: 7, comprasUsadas: 2 })
  })

  it('⛔ com UMA compra não existe intervalo: sem prazo, honesto', () => {
    expect(prazoDeReposicao([{ tipo: 'ENTRADA_NF', data: diasAtras(3), quantidade: 5 }]).dias).toBeNull()
  })

  it('⛔ compra ESTORNADA não repôs nada — não gera intervalo', () => {
    const movs = [
      { tipo: 'ENTRADA_NF', data: diasAtras(20), quantidade: 5 },
      { tipo: 'ESTORNO', data: diasAtras(10), quantidade: -5, estornoDeTipo: 'ENTRADA_NF' },
      { tipo: 'ENTRADA_NF', data: diasAtras(6), quantidade: 5 },
    ]
    expect(prazoDeReposicao(movs), 'as 2 compras de verdade, 14 dias').toEqual({ dias: 14, comprasUsadas: 2 })
  })
})

describe('⭐⭐ MÍNIMO SUGERIDO — sugere, com a conta escrita, e nunca chuta', () => {
  it('⭐ a conta é consumo/dia × prazo × (1 + folga), e ela vai POR EXTENSO', () => {
    const consumo = consumoDoItem(
      [{ tipo: 'BAIXA_VENDA', data: diasAtras(1), quantidade: -60 }],
      AGORA,
    )
    const prazo = prazoDeReposicao([
      { tipo: 'ENTRADA_NF', data: diasAtras(21), quantidade: 10 },
      { tipo: 'ENTRADA_NF', data: diasAtras(14), quantidade: 10 },
      { tipo: 'ENTRADA_NF', data: diasAtras(7), quantidade: 10 },
    ])
    const s = minimoSugerido(consumo, prazo, 'KG')
    expect(prazo.dias).toBe(7)
    expect(consumo.porDia).toBe(2)
    expect(s.minimo, '2/dia × 7 dias × 1,3').toBeCloseTo(2 * 7 * (1 + FOLGA_DO_MINIMO), 2)
    // ⭐ a conta na tela: o dono confere em vez de acreditar
    expect(s.conta).toContain('2 KG/dia')
    expect(s.conta).toContain('7 dia')
    expect(s.conta).toContain('30%')
  })

  it('⛔ sem consumo OU sem prazo, NENHUMA sugestão (nunca um número chutado)', () => {
    const semConsumo = consumoDoItem([], AGORA)
    const prazoOk = prazoDeReposicao([
      { tipo: 'ENTRADA_NF', data: diasAtras(14), quantidade: 1 },
      { tipo: 'ENTRADA_NF', data: diasAtras(7), quantidade: 1 },
    ])
    expect(minimoSugerido(semConsumo, prazoOk, 'KG').minimo).toBeNull()

    const comConsumo = consumoDoItem([{ tipo: 'BAIXA_VENDA', data: diasAtras(1), quantidade: -30 }], AGORA)
    expect(minimoSugerido(comConsumo, { dias: null, comprasUsadas: 1 }, 'KG').minimo).toBeNull()
    expect(minimoSugerido(comConsumo, { dias: null, comprasUsadas: 1 }, 'KG').conta).toBeNull()
  })
})
