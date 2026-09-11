// ⛔⛔⛔ O VÍNCULO OFERECIA O CONTRATO ERRADO E ESCONDIA O PAGAMENTO (10/09/2026)
//
// **O dono, com a parcela #3 do C61021346-2 vencendo no dia:** *"a lista 'Lançamentos do
// grupo' mostra o CONTRATO ERRADO: minha parcela é do C61021346 e a lista só tem linhas
// do C61021766 e até 'LIQUIDACAO BOLETO CARTOES CAIXA VISA PJ' — que não é empréstimo
// nenhum. (…) E a linha que eu estou vinculando NÃO ESTÁ NA LISTA: o pagamento de
// 4.337,52 de hoje — a semente do vínculo — não aparece pra marcar."*
//
// **MEDIDO EM PROD, e os dois eram de código:**
//   1. `buildLinkGroup` punha no universo qualquer linha que casasse `LOAN_KW`
//      (`amortizac|liquidac|presta|contrato|…`) — *"toda linha com cara de empréstimo
//      solta"*, nas palavras dele. Ofereceu **7 candidatos, nenhum do contrato dele**.
//   2. a janela do preview era **FIXA em `2026-07-01`…`2026-08-31`** — bomba de calendário
//      que explodiu em 01/09. A linha de 10/09 nem era buscada.
//
// ⚠️ ESTES SÃO OS DADOS REAIS de prod (nomes de contrato inclusos: são número de
// documento da empresa, não dado de pessoa).

import { describe, it, expect } from 'vitest'
import { buildLinkGroup, nomeiaOutroContrato, computeLinkSplit } from '../link-payment'
import { validateSchedule } from '../validate-schedule'

const d = (s: string) => new Date(`${s}T12:00:00Z`)
/** as linhas que o grupo do C61021346-2 oferecia em 10/09, medidas em prod */
const PEND = [
  { id: 'semente', description: 'LIQUIDACAO DE PARCELA-C61021346', amount: 4337.52, date: d('2026-09-10') },
  { id: 'o1', description: 'AMORTIZACAO CONTRATO-C61021766', amount: 4962.20, date: d('2026-07-20') },
  { id: 'o2', description: 'AMORTIZACAO CONTRATO-C61021766', amount: 60.99, date: d('2026-07-20') },
  { id: 'o3', description: 'AMORTIZACAO CONTRATO-C61021766', amount: 362.89, date: d('2026-07-20') },
  { id: 'o4', description: 'LIQUIDACAO CONTRATO-C61021766', amount: 1358.47, date: d('2026-07-21') },
  { id: 'cartao', description: 'LIQUIDACAO BOLETO-          00360305000104 CARTOES CAIXA VISA PJ', amount: 7280.39, date: d('2026-08-24') },
]

describe('⛔⛔ 1. o grupo é do MEU contrato', () => {
  const g = buildLinkGroup({ pend: PEND, contractNumber: 'C61021346-2', originTxId: 'semente' })

  it('a lista traz só a linha do C61021346 — as 4 do C61021766 e o cartão saem', () => {
    expect(g.candidates.map((c) => c.id)).toEqual(['semente'])
  })

  it('⭐ e a SEMENTE é a primeira, pré-marcada', () => {
    expect(g.candidates[0].id).toBe('semente')
    expect(g.candidates[0].selected).toBe(true)
    expect(g.paidTotal).toBeCloseTo(4337.52, 2)
  })

  it('⛔ linha que nomeia OUTRO contrato nunca entra — nem por keyword', () => {
    expect(nomeiaOutroContrato('AMORTIZACAO CONTRATO-C61021766', 'C61021346-2')).toBe(true)
    expect(nomeiaOutroContrato('LIQUIDACAO DE PARCELA-C61021346', 'C61021346-2')).toBe(false)
    // ⚠️ o CNPJ no meio do texto do cartão também é "identificador de terceiro"
    expect(nomeiaOutroContrato('LIQUIDACAO BOLETO- 00360305000104 CARTOES', 'C61021346-2')).toBe(true)
  })

  it('⚠️ MAS a keyword continua valendo no banco que NÃO escreve o número', () => {
    // Caixa e Banrisul não põem contrato na descrição — ali a keyword é o único caminho,
    // e desligá-la deixaria esses contratos sem nenhum candidato.
    const semNumero = [
      { id: 'a', description: 'DEBITO PRESTA SIEMP', amount: 2927.02, date: d('2026-09-10') },
      { id: 'b', description: 'PIX ENVIADO JOAO', amount: 100, date: d('2026-09-10') },
    ]
    const s = buildLinkGroup({ pend: semNumero, contractNumber: '1837311', originTxId: undefined })
    expect(s.candidates.map((c) => c.id)).toEqual(['a'])
  })
})

describe('⛔⛔ 2. a agenda POS não tem o que "corrigir"', () => {
  // as 3 primeiras do C61021346-2, como estão em prod: juros só no que já foi pago
  const rows = [
    { number: 1, openingBalance: 100000, interest: 1518.43, amortization: 2777.80, payment: 4296.23, closingBalance: 97222.20 },
    { number: 2, openingBalance: 97222.20, interest: 473.23, correcao: 1097.68, amortization: 2777.73, payment: 4348.64, closingBalance: 94444.47 },
    { number: 3, openingBalance: 94444.47, interest: 0, amortization: 2777.80, payment: 2777.80, closingBalance: 91666.67 },
    { number: 4, openingBalance: 91666.67, interest: 0, amortization: 91666.67, payment: 91666.67, closingBalance: 0 },
  ]

  it('⭐ PÓS-fixado: juros 0 na parcela futura é o estado honesto, não defeito', () => {
    const r = validateSchedule({ rows, base: 100000, ratePositive: true, isPostFixed: true })
    expect(r.errors.join(' ')).not.toContain('juros = 0')
  })

  it('⛔ mas no PRÉ-fixado a regra continua mordendo — ali juros 0 É erro', () => {
    const r = validateSchedule({ rows, base: 100000, ratePositive: true, isPostFixed: false })
    expect(r.errors.join(' ')).toContain('juros = 0')
  })
})

describe('⭐⭐ 3. o split nasce do valor REAL pago', () => {
  it('4.337,52 = 2.777,80 de amortização + 1.559,72 de encargos (o número do dono)', () => {
    const s = computeLinkSplit({
      installment: { amortization: 2777.80, openingBalance: 94444.47 },
      rateMonthly: 0.004867550565343048,
      paidTotal: 4337.52,
    })
    expect(s.amortization).toBeCloseTo(2777.80, 2)
    expect(s.encargos).toBeCloseTo(1559.72, 2)
    expect(s.closingBalance).toBeCloseTo(91666.67, 2)
    expect(s.isPartial).toBe(false)
  })

  it('⚠️ e pagar MENOS que a amortização prevista é PARCIAL — não quita', () => {
    const s = computeLinkSplit({
      installment: { amortization: 2777.80, openingBalance: 94444.47 },
      rateMonthly: 0.004867550565343048, paidTotal: 1000,
    })
    expect(s.isPartial).toBe(true)
  })
})
