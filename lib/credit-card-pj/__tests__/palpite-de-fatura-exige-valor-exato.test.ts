/**
 * ⭐⭐⭐ PALPITE DE FATURA SÓ COM VALOR EXATO (25/09/2026) — régua do dono.
 *
 * *"O matcher que PROPÕE «é pagamento de fatura» passa a exigir match exato; a tolerância
 * de 2% fica só pra DEPOIS que eu já escolhi o cartão."*
 *
 * **MEDIDO EM PROD ANTES DE MEXER:** a folga de 2% num débito de R$ 5.210,78 vale
 * **R$ 104,22** — e com ela **17 dos 18 palpites de fatura da Caçula apontavam pagamento de
 * FORNECEDOR**. Os números reais estão nos testes abaixo, um a um.
 *
 * ⛔⛔ **E o estrago ia além do palpite errado.** O candidato de fatura se declara
 * `diferenca: 0` com confiança ALTA, então no ranking ele **ganhava** do palpite certo (a
 * conta do fornecedor, que carrega a diferença real) **ou matava os dois por empate
 * técnico** — deixando a linha sem palpite nenhum.
 *
 * ⭐ É a classe do **guard do falso-amigo** (11/09): *"quase-exato SEM nome compatível NUNCA
 * sugere; diferença de centavos não compra identidade"*. Aqui não há nome pra desempatar —
 * o único sinal é o valor —, então ele tem que ser **o valor**.
 */
import { describe, it, expect } from 'vitest'
import { mesQueBateOValor, pickInvoiceMonthByValue, folgaDepoisDeEscolherOCartao } from '../fatura-net-total'

/** as faturas REAIS da Caçula em 25/09, medidas em prod */
const FATURAS_DA_CACULA = {
  'banco caixa': new Map([['2026-09', 5106.99], ['2026-08', 7280.39], ['2026-07', 7689.22], ['2026-06', 4345.95]]),
  'mercado pago': new Map([['2026-09', 2900.34], ['2026-08', 2666.44], ['2026-07', 1978.14]]),
  sicredi: new Map([['2026-09', 2365.85], ['2026-08', 7896.32], ['2026-07', 2304.83], ['2026-06', 1890.22]]),
  'Carter banrisul': new Map([['2026-09', 8626.98], ['2026-08', 13779.73], ['2026-07', 2695.29]]),
}

describe('⛔⛔ os 17 falsos-palpites de fornecedor CAEM', () => {
  /**
   * ⚠️ Cada linha aqui é um caso REAL da caixa da Caçula que, com a folga de 2%, virava
   * *"💳 pagamento de fatura"* — um toque e o dono baixaria a fatura errada com o dinheiro
   * do fornecedor.
   */
  const FALSOS: [string, number, keyof typeof FATURAS_DA_CACULA, number][] = [
    ['FRIGORIFICO SILVA', 5210.78, 'banco caixa', 103.79],
    ['CARTORIO DO REGISTRO DE IMOVEIS', 2017.05, 'mercado pago', 38.91],
    ['LATICINIOS SANTO CRISTO', 1940.59, 'mercado pago', 37.55],
    ['INAIARA SILVA RODRIGUES', 2617.17, 'mercado pago', 49.27],
    ['FRIGORIFICO SILVA (2)', 4298.98, 'banco caixa', 46.97],
    ['FRIGORIFICO SILVA (3)', 2862.58, 'mercado pago', 37.76],
    ['ALEKCIA KARLANY DE MELLO', 1920.71, 'sicredi', 30.49],
    ['CASPER DISTRIBUIDORA', 2275.05, 'sicredi', 29.78],
    ['M. Ivan Lunardi Ourique', 2008.00, 'mercado pago', 29.86],
    ['FRIGORIFICO SILVA (4)', 1867.09, 'sicredi', 23.13],
    ['MARIA LUIZA COELHO', 2886.37, 'mercado pago', 13.97],
    ['LIQUIDACAO DE PARCELA-C61021346', 4337.52, 'banco caixa', 8.43],
    ['FRIGORIFICO SILVA (5)', 2905.54, 'mercado pago', 5.20],
    ['MOINHO DO NORDESTE', 2700.00, 'Carter banrisul', 4.71],
    ['FRIGORIFICO SILVA (6)', 4350.58, 'banco caixa', 4.63],
    ['BARBARA SOARES RIBEIRO', 2369.34, 'sicredi', 3.49],
  ]

  for (const [quem, valor, cartao, dif] of FALSOS) {
    it(`⛔ «${quem}» R$ ${valor} NÃO sugere fatura do ${cartao} (dif R$ ${dif})`, () => {
      expect(mesQueBateOValor(FATURAS_DA_CACULA[cartao], valor),
        `voltou a sugerir fatura pra um pagamento com R$ ${dif} de diferença`).toBeNull()
    })
  }

  it('⛔⛔ e o MENOR deles (R$ 3,49) também cai — a folga não volta pela porta dos fundos', () => {
    /**
     * ⚠️ Este é o teste que impede o *"então põe uma tolerância pequenininha"*. R$ 3,49 num
     * débito de R$ 2.369,34 é 0,15% — e ainda assim é uma transferência pra uma PESSOA,
     * não o pagamento de uma fatura.
     */
    expect(mesQueBateOValor(FATURAS_DA_CACULA.sicredi, 2369.34)).toBeNull()
  })
})

describe('⭐⭐ as faturas DE VERDADE continuam de 1 toque', () => {
  it('⭐ «PAGAMENTO CARTAO DE CREDITO» R$ 8.626,98 → Carter banrisul 2026-09', () => {
    expect(mesQueBateOValor(FATURAS_DA_CACULA['Carter banrisul'], 8626.98)).toBe('2026-09')
  })

  it('⭐ o PIX do MERCADO PAGO R$ 2.900,34 → mercado pago 2026-09 (o caso do dono)', () => {
    expect(mesQueBateOValor(FATURAS_DA_CACULA['mercado pago'], 2900.34)).toBe('2026-09')
  })

  it('⭐ o centavo de ARREDONDAMENTO passa — não é folga, é ruído', () => {
    // ⚠️ o mesmo degrau `FECHA` da régua da diferença (24/09)
    expect(mesQueBateOValor(FATURAS_DA_CACULA.sicredi, 2365.86)).toBe('2026-09')
    expect(mesQueBateOValor(FATURAS_DA_CACULA.sicredi, 2365.83)).toBe('2026-09')
    // ⛔ e três centavos já não
    expect(mesQueBateOValor(FATURAS_DA_CACULA.sicredi, 2365.90)).toBeNull()
  })

  it('⛔ nenhuma fatura perto → null, SEM FALLBACK (o veneno de 16/09)', () => {
    expect(mesQueBateOValor(FATURAS_DA_CACULA.sicredi, 3194.35)).toBeNull()
  })
})

describe('⭐ a folga de 2% SOBREVIVE onde ela é certa — DEPOIS de escolher o cartão', () => {
  /**
   * ⭐ A diferença é de CONTRATO: ali o dono JÁ disse que a linha é daquele cartão, e o que
   * sobra é juros/encargo — que a régua de 24/09 manda **nomear**. Aqui a pergunta é *"é de
   * ALGUM cartão?"*, e o único sinal é o valor.
   */
  it('⭐ o pagamento COM juros ainda acha a competência (2.365,85 pago como 2.400)', () => {
    expect(pickInvoiceMonthByValue(FATURAS_DA_CACULA.sicredi, 2400)).toBe('2026-09')
    // ⛔ e o palpite, com o MESMO número, se cala
    expect(mesQueBateOValor(FATURAS_DA_CACULA.sicredi, 2400)).toBeNull()
  })

  it('⭐ a folga continua proporcional (2%), e o piso é o centavo', () => {
    expect(folgaDepoisDeEscolherOCartao(5210.78)).toBeCloseTo(104.2156, 3)
    expect(folgaDepoisDeEscolherOCartao(0.5)).toBe(0.02)
  })

  it('⛔⛔ as duas réguas NÃO podem voltar a ser a mesma função', () => {
    /**
     * ⚠️ De 16/09 a 25/09 elas eram compartilhadas, com o comentário *"uma régua, dois
     * leitores"*. **Parecia REGRA 4 e era o oposto:** as PERGUNTAS são diferentes, então a
     * mesma folga significa coisas diferentes em cada uma.
     */
    const caro = 5210.78
    expect(folgaDepoisDeEscolherOCartao(caro), 'a folga de depois encolheu junto').toBeGreaterThan(100)
    // ⭐ e o palpite ignora essa folga por completo
    expect(mesQueBateOValor(new Map([['2026-09', 5106.99]]), caro)).toBeNull()
  })
})
