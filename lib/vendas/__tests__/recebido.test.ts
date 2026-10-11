/**
 * ⭐⭐⭐ A FAIXA "VENDIDO × RECEBIDO" (10/10/2026) — com os números REAIS de outubro.
 *
 * ⚠️ A fixture é o dado medido em prod, e isso importa aqui mais que de costume: as bordas
 * que este arquivo trava (o bloco atravessando o recorte, o extrato atrás do período) **são
 * o estado de hoje**, não hipóteses — extrato em 09/10 com o mês indo até 31/10, e um bloco
 * de cartão `02→04/10` de R$ 23.908,49.
 */
import { describe, it, expect } from 'vitest'
import { montarFaixa, type LinhaRecebida } from '../recebido'

const d = (s: string) => new Date(`${s}T00:00:00.000Z`)
const linha = (ini: string, fim: string, valor: number, meio = 'PIX'): LinhaRecebida =>
  ({ dataCompetencia: d(ini), dataCompetenciaFim: d(fim), valorLiquido: valor, meio })

/** ⭐ outubro real: 1 bloco de cartão e dias únicos de PIX/dinheiro */
const OUTUBRO: LinhaRecebida[] = [
  linha('2026-10-01', '2026-10-01', 14_163.31, 'PIX'),
  linha('2026-10-02', '2026-10-04', 23_908.49, 'CARTAO'), // ⭐ O BLOCO
  linha('2026-10-02', '2026-10-02', 12_926.85, 'PIX'),
  linha('2026-10-05', '2026-10-05', 11_369.32, 'PIX'),
  linha('2026-10-06', '2026-10-06', 15_926.36, 'CARTAO'),
  linha('2026-10-07', '2026-10-07', 15_608.79, 'DINHEIRO'),
  linha('2026-10-08', '2026-10-08', 14_195.56, 'PIX'),
]

describe('⭐⭐ a conta da faixa', () => {
  it('⭐ vendido → recebido → a caminho, com a fração pra barra', () => {
    const f = montarFaixa({
      vendido: 186_940.50, linhas: OUTUBRO, de: '2026-10-01', ate: '2026-10-31', extratoAte: '2026-10-09',
    })
    expect(f.vendido).toBeCloseTo(186_940.50, 2)
    expect(f.recebido).toBeCloseTo(108_098.68, 2)
    expect(f.aCaminho).toBeCloseTo(186_940.50 - 108_098.68, 2)
    expect(f.fracaoRecebida).toBeCloseTo(108_098.68 / 186_940.50, 6)
  })

  /**
   * ⛔⛔ O VERMELHO DO DONO: *"vendido somado por fora = vermelho"*. A faixa **RECEBE** o
   * vendido; ela não tem como somá-lo — não há `dias` na assinatura. ⭐ É impossibilidade por
   * construção (REGRA 5), não um combinado: dois números pro mesmo fato na mesma tela, a dez
   * centímetros um do outro, é como a confiança se perde.
   */
  it('⛔⛔ o vendido é PARÂMETRO — a faixa não soma dia nenhum', () => {
    const f = montarFaixa({
      vendido: 999.99, linhas: OUTUBRO, de: '2026-10-01', ate: '2026-10-31', extratoAte: null,
    })
    expect(f.vendido, 'o que entrou é o que sai').toBeCloseTo(999.99, 2)
  })

  it('⭐ sem venda medida: vendido e a caminho são "a apurar", nunca 0', () => {
    const f = montarFaixa({
      vendido: null, linhas: OUTUBRO, de: '2026-10-01', ate: '2026-10-31', extratoAte: null,
    })
    expect(f.vendido).toBeNull()
    expect(f.aCaminho).toBeNull()
    expect(f.fracaoRecebida).toBeNull()
    expect(f.frase).toContain('a apurar')
    // ⭐ e o recebido continua sendo um FATO: ele não depende do vendido
    expect(f.recebido).toBeCloseTo(108_098.68, 2)
  })
})

describe('⛔⛔ a SOBREPOSIÇÃO — o bloco entra inteiro no recorte que ele toca', () => {
  /**
   * ⛔⛔ Esta é a régua que escondeu **R$ 43.106,03** em 25/08 e gerou **111 alarmes falsos**
   * em 26/08 — nas duas vezes porque um leitor usava SOBREPOSIÇÃO e o outro PERTENCIMENTO.
   */
  it('⭐ recorte de 1 dia dentro do bloco traz o bloco INTEIRO', () => {
    const f = montarFaixa({
      vendido: 28_377.16, linhas: OUTUBRO, de: '2026-10-04', ate: '2026-10-04', extratoAte: '2026-10-09',
    })
    expect(f.recebido, 'o bloco 02→04 entra inteiro').toBeCloseTo(23_908.49, 2)
    expect(f.blocoAtravessaBorda, 'ele começa ANTES do recorte').toBe(true)
  })

  it('⛔ e com PERTENCIMENTO ele sumiria — o contrafactual do bug de 25/08', () => {
    const soDentro = OUTUBRO.filter((l) =>
      l.dataCompetencia >= d('2026-10-04') && l.dataCompetencia < d('2026-10-05'))
    expect(soDentro, 'nenhuma linha COMEÇA em 04/10 — o bloco inteiro desapareceria').toHaveLength(0)
  })

  /**
   * ⚠️⚠️ A RESSALVA DO DONO (*"recebido > vendido"*) É REAL, e o retrato achou a causa que
   * ele não nomeou: **não é o repasse da semana anterior, é o BLOCO**. ⛔ E a tela mostra
   * normal, com o ⓘ explicando — *"nunca esconder"*, a ordem dele.
   */
  it('⛔⛔ recebido PASSA o vendido num recorte curto, e isso aparece normal', () => {
    const f = montarFaixa({
      vendido: 12_147.24, linhas: OUTUBRO, de: '2026-10-03', ate: '2026-10-03', extratoAte: '2026-10-09',
    })
    expect(f.recebido).toBeCloseTo(23_908.49, 2)
    expect(f.aCaminho!, 'negativo, e não escondido').toBeLessThan(0)
    expect(f.frase).toContain('fim de semana anterior')
    // ⭐ a BARRA é clampada (desenho), o NÚMERO continua o real (fato)
    expect(f.fracaoRecebida).toBe(1)
  })
})

describe('⛔⛔ a honestidade do extrato atrasado', () => {
  it('⭐ extrato ATRÁS do recorte: a tela DIZ até quando ele vai', () => {
    const f = montarFaixa({
      vendido: 186_940.50, linhas: OUTUBRO, de: '2026-10-01', ate: '2026-10-31', extratoAte: '2026-10-09',
    })
    expect(f.extratoAte).toBe('2026-10-09')
    expect(f.frase).toContain('09/10')
  })

  /**
   * ⚠️ E ELA SÓ APARECE QUANDO MORDE: *"importado até 09/10"* num recorte que acaba em 09/10
   * é ruído, e ruído é como um número para de ser lido (os 111 alarmes falsos).
   */
  it('⛔ extrato que ALCANÇA o recorte não gera ressalva', () => {
    const f = montarFaixa({
      vendido: 80_000, linhas: OUTUBRO, de: '2026-10-01', ate: '2026-10-08', extratoAte: '2026-10-09',
    })
    expect(f.extratoAte).toBeNull()
    expect(f.frase).not.toContain('está em')
  })

  it('⭐ sem extrato nenhum importado: a faixa não inventa ressalva de data', () => {
    const f = montarFaixa({
      vendido: 1_000, linhas: [], de: '2026-10-01', ate: '2026-10-31', extratoAte: null,
    })
    expect(f.extratoAte).toBeNull()
    expect(f.recebido).toBe(0)
    expect(f.aCaminho).toBeCloseTo(1_000, 2)
  })
})

describe('⛔⛔⛔ NUNCA DECOMPOR O "A CAMINHO" SEM DADO', () => {
  /**
   * ⛔⛔ O VERMELHO DO DONO: *"decomposição inventada do «a caminho» = vermelho"*. Dizer
   * *"R$ X de cartão a receber"* exigiria saber qual parte é repasse pendente e qual é extrato
   * que falta importar — **e o sistema não tem esse dado**. A frase diz as DUAS causas e para.
   */
  it('⛔⛔ a frase diz as duas causas e NÃO reparte o valor', () => {
    const f = montarFaixa({
      vendido: 186_940.50, linhas: OUTUBRO, de: '2026-10-01', ate: '2026-10-31', extratoAte: '2026-10-09',
    })
    expect(f.frase).toContain('cartão a receber')
    expect(f.frase).toContain('ou extrato ainda não importado')
    // ⛔ nenhum valor em R$ dentro da frase do "a caminho" — repartir seria inventar
    expect(f.frase, 'a frase não carrega número de dinheiro').not.toMatch(/R\$\s*[\d.]/)
    // ⛔ e o objeto não tem campo de decomposição pra alguém desenhar
    expect(Object.keys(f)).not.toContain('aCaminhoCartao')
    expect(Object.keys(f)).not.toContain('aCaminhoSemExtrato')
  })

  it('⭐ quando tudo caiu, a frase diz isso em vez de "a caminho R$ 0,00"', () => {
    const f = montarFaixa({
      vendido: 108_098.68, linhas: OUTUBRO, de: '2026-10-01', ate: '2026-10-31', extratoAte: null,
    })
    expect(f.aCaminho).toBe(0)
    expect(f.frase).toBe('tudo que foi vendido já caiu na conta')
  })
})

describe('⭐ a composição do recebido, por meio', () => {
  it('⭐ soma por meio, ordenada pelo maior, e fecha com o recebido', () => {
    const f = montarFaixa({
      vendido: 186_940.50, linhas: OUTUBRO, de: '2026-10-01', ate: '2026-10-31', extratoAte: null,
    })
    /**
     * ⚠️ ESTA ASSERÇÃO ME CORRIGIU: eu escrevi `CARTAO` primeiro de cabeça e o PIX é maior —
     * PIX 52.655,04 (4 dias) contra CARTÃO 39.834,85 (o bloco + 06/10). ⭐ Aritmética de
     * cabeça em teste de dinheiro é como um número errado entra e vira "o esperado".
     */
    expect(f.porMeio.map((m) => m.meio)).toEqual(['PIX', 'CARTAO', 'DINHEIRO'])
    expect(f.porMeio[0].valor).toBeCloseTo(52_655.04, 2)
    expect(f.porMeio[1].valor).toBeCloseTo(39_834.85, 2)
    expect(f.porMeio.reduce((a, m) => a + m.valor, 0)).toBeCloseTo(f.recebido, 2)
  })

  /**
   * ⚠️ ESTORNO JÁ VEM COM SINAL — o motor grava `valorLiquido` negativo nele. Somar tudo já
   * subtrai; checar um campo `tipo` aqui faria subtrair DUAS vezes.
   */
  it('⛔ estorno (valorLiquido negativo) SUBTRAI, sem tratamento especial', () => {
    const f = montarFaixa({
      vendido: 1_000,
      linhas: [linha('2026-10-06', '2026-10-06', 500, 'PIX'), linha('2026-10-06', '2026-10-06', -120, 'PIX')],
      de: '2026-10-06', ate: '2026-10-06', extratoAte: null,
    })
    expect(f.recebido).toBeCloseTo(380, 2)
    expect(f.porMeio).toEqual([{ meio: 'PIX', valor: 380 }])
  })
})
