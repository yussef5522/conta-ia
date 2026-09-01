// ⭐⭐ SUBSTITUI DOIS GREPS DE CÓDIGO-FONTE POR EXECUÇÃO DO PIPELINE (01/09/2026).
//
// ⛔ OS TESTES QUE MORRERAM AQUI procuravam as STRINGS `const correcao = t.loanInstall…`
// e `if (jurosTotal <= 0) continue` **dentro do fonte da rota do DRE**. Estavam
// vermelhos, e a perícia mostrou que **NÃO era regressão: era teste velho.** A lógica
// foi extraída da rota pra `lib/loans/dre-interest.ts` em 14/08 (dono único, REGRA 4/5) e
// o grep perdeu o alvo. **O grep não distingue "refatorei" de "quebrei" — é exatamente o
// buraco que a REGRA 3 existe pra fechar**, e ele ficou aberto por dias fingindo ser um
// vermelho de verdade.
//
// ⭐ O QUE ESTES TESTES FAZEM NO LUGAR: montam as transações de juros pelo caminho REAL
// (`buildLoan1to1InterestTx` / `buildLoanN1InterestTx`), passam pelo `calculateDRE` de
// verdade e **conferem o NÚMERO** que sai em DESPESAS_FINANCEIRAS. Se alguém mover o
// arquivo de novo, isto continua verde; se alguém quebrar a conta, fica vermelho.

import { describe, it, expect } from 'vitest'
import { buildLoan1to1InterestTx, buildLoanN1InterestTx } from '../../lib/loans/dre-interest'
import { calculateDRE } from '../../lib/dre/calculator'
import type { TransactionForDRE, CategoryForDRE } from '../../lib/dre/types'

const JUROS: CategoryForDRE = {
  id: 'juros', name: 'Juros sobre Empréstimos', code: null,
  dreGroup: 'DESPESAS_FINANCEIRAS', parentId: null, isActive: true, type: 'DEBIT',
}
const period = {
  startDate: new Date('2026-07-01'), endDate: new Date('2026-07-31'), regime: 'competence' as const,
}

/** roda o DRE de verdade e devolve o total de DESPESAS_FINANCEIRAS */
function despesaFinanceira(txs: TransactionForDRE[]): number {
  const r = calculateDRE(txs, [JUROS], { period })
  return r.groups.find((g) => g.group === 'DESPESAS_FINANCEIRAS')?.total ?? 0
}

const parcela = (over: Partial<Parameters<typeof buildLoan1to1InterestTx>[0][number]>) => ({
  id: 'tx1', type: 'DEBIT' as const, amount: 2927.02,
  date: new Date('2026-07-27'), competenceDate: new Date('2026-07-27'),
  paymentDate: new Date('2026-07-27'), isCardPayment: false, pendingTransfer: false,
  loanInstallmentPaid: { interest: 311.26, correcao: 134.41, dreHeld: false },
  ...over,
})

describe('⭐ o DRE conta juros + CORREÇÃO, não só o juros', () => {
  it('⭐ parcela 2.927,02 (amort 2.481,35 + juros 311,26 + correção 134,41) → DRE 445,67', () => {
    // ⚠️ o número que importa é 445,67 — a SOMA. Contar só `interest` daria 311,26 e o
    // DRE subestimaria a despesa financeira em toda parcela pós-fixada (STJ: a correção
    // pelo CDI é juros na essência). E a AMORTIZAÇÃO (2.481,35) não entra em nada:
    // é baixa de passivo, não despesa.
    const txs = buildLoan1to1InterestTx([parcela({})], JUROS.id)
    expect(txs[0].loanInterestSplit).toBeCloseTo(445.67, 2)
    expect(despesaFinanceira(txs)).toBeCloseTo(445.67, 2)
  })

  it('⛔ contrafactual: se contasse só `interest`, o DRE diria 311,26 — 134,41 a menos', () => {
    const soJuros = buildLoan1to1InterestTx(
      [parcela({ loanInstallmentPaid: { interest: 311.26, correcao: 0, dreHeld: false } })],
      JUROS.id,
    )
    expect(despesaFinanceira(soJuros)).toBeCloseTo(311.26, 2)
  })

  it('⭐ o caminho N:1 soma os TRÊS encargos reais (juros + correção + multa)', () => {
    // parcela paga em mordidas: os encargos vêm de `paid*`, não da agenda
    const txs = buildLoanN1InterestTx(
      [{ id: 'i9', paidDate: new Date('2026-07-20'), paidInterest: 667.74,
         paidCorrection: 88.11, paidPenalty: 1.08, dreHeld: false }],
      JUROS.id,
    )
    expect(despesaFinanceira(txs)).toBeCloseTo(756.93, 2)
  })
})

describe('⛔⛔ o guard `jurosTotal <= 0` — e o que ele evita é LUCRO INVENTADO', () => {
  it('⛔ parcela 100% amortização (juros 0 + correção 0) não gera despesa nenhuma', () => {
    const txs = buildLoan1to1InterestTx(
      [parcela({ loanInstallmentPaid: { interest: 0, correcao: 0, dreHeld: false } })],
      JUROS.id,
    )
    expect(txs).toHaveLength(0)          // nem chega a virar transação
    expect(despesaFinanceira(txs)).toBe(0)
  })

  it('⛔⛔ juros derivado NEGATIVO é descartado — senão REDUZIRIA a despesa do mês', () => {
    // ⚠️ ISTO É CASO REAL, e é por isso que a régua é `<= 0` e não `=== 0`: o pagamento
    // de 1.142,53 de 20/07 do C41022570 dava **juros derivado −3.024** (o valor pago era
    // menor que a amortização agendada). Sem o guard, essa parcela entraria como despesa
    // NEGATIVA e **abateria a despesa financeira das outras parcelas do mês** — inflando
    // o lucro com um número que não existe. Órfã é melhor que casada errado.
    const negativa = buildLoan1to1InterestTx(
      [parcela({ id: 'tx-neg', loanInstallmentPaid: { interest: -3024, correcao: 0, dreHeld: false } })],
      JUROS.id,
    )
    expect(negativa).toHaveLength(0)

    // e no DRE, junto com uma parcela boa, o total NÃO é contaminado
    const boas = buildLoan1to1InterestTx([parcela({})], JUROS.id)
    expect(despesaFinanceira([...boas, ...negativa])).toBeCloseTo(445.67, 2)
  })

  it('⚠️ represado (dreHeld) fica FORA do DRE mesmo com juros gravado', () => {
    // mês fechado: o encargo existe na parcela, mas só reaparece quando o contador libera
    const txs = buildLoan1to1InterestTx(
      [parcela({ loanInstallmentPaid: { interest: 311.26, correcao: 134.41, dreHeld: true } })],
      JUROS.id,
    )
    expect(despesaFinanceira(txs)).toBe(0)
  })
})
