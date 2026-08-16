// Sprint Fase 3 CAMADA 2 (15/08/2026) — GOLDEN dos 9 contratos reais (anonimizados).
// Trava a saída CORRETA ao centavo: se o código divergir, é regressão. Os valores
// esperados são os VALIDADOS (juiz 9/9 pós-fix da #23; saldo Σ=825.313,37 provado
// contra 5 PDFs de 3 bancos). Golden que falha na 1ª rodada = bug não visto —
// NÃO "consertar" o teste, investigar.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { checkModuleInvariants, type InvLoan } from '../lib/loans/module-invariants'
import { saldoDevedorAtual } from '../lib/loans/saldo'
import { forecastProxima, type ForecastInstallment } from '../lib/loans/forecast'

const loans: InvLoan[] = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'loans-cacula-anon.json'), 'utf-8'),
)
const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

describe('GOLDEN — módulo de empréstimos contra os 9 reais (anonimizados)', () => {
  it('juiz de módulo: 9/9 passam todos os invariantes (0 falhas)', () => {
    const results = checkModuleInvariants(loans)
    const falhas = results.filter((r) => !r.pass)
    // se falhar, mostra QUAL contrato e QUAL invariante (não some no banco)
    expect(falhas, JSON.stringify(falhas)).toHaveLength(0)
    expect(results).toHaveLength(9)
  })

  // Σ = 822.174,68 (snapshot 15/08). O 825.313,37 dos PDFs era PRÉ-pagamento da
  // #23 do 064956967; ela foi paga → amort 3.138,69 baixou a dívida → 822.174,68.
  // O golden PEGOU essa mudança na 1ª rodada; investigado = pagamento legítimo,
  // não regressão. Se este número mudar sem um pagamento novo no fixture, é bug.
  it('saldo devedor: Σ dos 9 == 822.174,68 (validado; = 825.313,37 dos PDFs − amort da #23 paga)', () => {
    const soma = round2(
      loans.reduce(
        (s, l) =>
          s +
          saldoDevedorAtual(
            {
              principal: l.principal,
              installmentsPaidBefore: l.installmentsPaidBefore,
              interestRateMonthly: l.interestRateMonthly,
              rateType: l.rateType,
              scheduleSource: l.scheduleSource,
            },
            l.installments,
          ),
        0,
      ),
    )
    expect(soma).toBeCloseTo(822174.68, 2)
  })

  it('previsão POS: a próxima OPEN prevê pela última CASADA (não a amort nominal)', () => {
    // C61021346-2 anonimizado = C99000004-2 (POS)
    const pos = loans.find((l) => l.contractNumber === 'C99000004-2')!
    expect(pos.rateType).toBe('POS')
    const insts: ForecastInstallment[] = pos.installments.map((i) => ({
      number: i.number,
      dueDate: new Date(i.dueDate + 'T00:00:00.000Z'),
      status: i.status,
      payment: i.payment,
      paidTotal: i.paidTotal,
      reconciledTransactionId: i.hasReconciled ? 'x' : null,
      paymentsCount: i.paymentsCount,
    }))
    const f = forecastProxima({ rateType: pos.rateType }, insts)
    expect(f.isForecast).toBe(true)
    expect(f.baseNumber).not.toBeNull() // tem base casada, não "a apurar"
    // a previsão é o valor REAL da última casada, > amort nominal
    const base = pos.installments.find((i) => i.number === f.baseNumber)!
    expect(f.valor).toBeGreaterThan(base.amortization)
  })
})
