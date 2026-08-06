import { describe, it, expect } from 'vitest'
import { regenerateSchedule, type RegenLoan, type RegenInstallment } from '../regenerate'
import { computeLinkSplit, buildLinkGroup, pickTargetInstallment, type GroupTx, type OpenInstallment } from '../link-payment'
import { detectLoanPayment, type DetectLoanLite } from '../detect-payment'

// ===== FASE 2 — gerador SAC + valor financiado (caso C41022570) =====
describe('regenerateSchedule SAC (C41022570)', () => {
  const loan: RegenLoan = {
    principal: 104166.72, outstandingBalanceInitial: 104166.72, termMonths: 36,
    installmentsPaidBefore: 10, amortizationSystem: 'SAC', amortizationConstant: null,
    financedAmount: null, firstDueDate: new Date('2026-06-15'),
  }
  function seed(): RegenInstallment[] {
    const rows: RegenInstallment[] = []
    for (let n = 11; n <= 36; n++) rows.push({
      number: n, dueDate: new Date(Date.UTC(2026, 5 + (n - 11), 15)), openingBalance: 0, interest: 0,
      amortization: 0, correcao: 0, payment: 0, closingBalance: 0, status: 'OPEN', isEstimate: true,
      reconciledTransactionId: null, realPayment: null, reconciledTxAmount: null, linkedPaidTotal: null, linkedEncargosBefore: null,
    })
    return rows
  }
  it('financiado 150.000 / 36 → amort 4.166,66 (truncado), agenda fecha', () => {
    const r = regenerateSchedule(loan, seed(), { system: 'SAC', financedAmount: 150000, rateMonthly: 0.004868, isPostFixed: true })
    expect(r.validation.ok).toBe(true)
    const p12 = r.rows.find((x) => x.number === 12)!
    expect(p12.amortization).toBeCloseTo(4166.66, 2)
    // saldo devedor #12: abre 104.166,72 → fecha 100.000,06 (aceite 7.1)
    expect(p12.openingBalance).toBeCloseTo(104166.72, 1)
    expect(p12.closingBalance).toBeCloseTo(100000.06, 1)
  })
})

// ===== FIX 2 — recalcular split de vínculo N:1 ao corrigir a agenda =====
describe('regenerateSchedule — recalcula split de vínculo N:1 (FIX 2)', () => {
  const loan: RegenLoan = {
    principal: 104166.72, outstandingBalanceInitial: 104166.72, termMonths: 36,
    installmentsPaidBefore: 10, amortizationSystem: 'SAC', amortizationConstant: null,
    financedAmount: null, firstDueDate: new Date('2026-06-15'),
  }
  it('parcela #12 vinculada (5.951,33) → linkedPayments com encargos 1.784,67', () => {
    const rows: RegenInstallment[] = []
    for (let n = 11; n <= 36; n++) rows.push({
      number: n, dueDate: new Date(Date.UTC(2026, 5 + (n - 11), 15)), openingBalance: 0, interest: 0,
      amortization: 0, correcao: 0, payment: 0, closingBalance: 0, status: n === 12 ? 'PAID' : 'OPEN', isEstimate: true,
      reconciledTransactionId: null, realPayment: null, reconciledTxAmount: null,
      // #12 paga por vínculo N:1, mas com split "a definir" (agenda estava quebrada)
      linkedPaidTotal: n === 12 ? 5951.33 : null, linkedEncargosBefore: n === 12 ? 0 : null,
    })
    const r = regenerateSchedule(loan, rows, { system: 'SAC', financedAmount: 150000, rateMonthly: 0.004868, isPostFixed: true })
    expect(r.validation.ok).toBe(true)
    const lp = r.linkedPayments.find((x) => x.number === 12)!
    expect(lp).toBeTruthy()
    expect(lp.encargosAntes).toBe(0) // estava fora do DRE
    expect(lp.amortDepois).toBeCloseTo(4166.66, 2)
    expect(lp.encargosDepois).toBeCloseTo(1784.67, 2) // agora entra no DRE
    expect(lp.isPartial).toBe(false)
  })
})

// ===== FASE 4/5 — split do grupo (identidade PAGO = AMORT + ENCARGOS) =====
describe('computeLinkSplit', () => {
  it('caso julho C41022570: 5.951,33 = 4.166,66 amort + 1.784,67 encargos', () => {
    const s = computeLinkSplit({ installment: { amortization: 4166.66, openingBalance: 104166.72 }, rateMonthly: 0.004868, paidTotal: 5951.33 })
    expect(s.isPartial).toBe(false)
    expect(s.amortization).toBeCloseTo(4166.66, 2)
    expect(s.encargos).toBeCloseTo(1784.67, 2)
    // encargos = juros + correção (soma bate)
    expect(s.paidInterest + s.paidCorrection + s.paidPenalty).toBeCloseTo(1784.67, 2)
    // amort fora do DRE + encargos = pago
    expect(s.amortization + s.encargos).toBeCloseTo(5951.33, 2)
  })
  it('pagamento parcial (< amortização) → PARCIAL, não quita, sem encargos', () => {
    const s = computeLinkSplit({ installment: { amortization: 4166.66, openingBalance: 104166.72 }, rateMonthly: 0.004868, paidTotal: 3000 })
    expect(s.isPartial).toBe(true)
    expect(s.encargos).toBe(0)
    expect(s.amortization).toBeCloseTo(3000, 2)
  })

  // ── Mútuo FLEXIBLE / taxa 0% (Arafat) — encargo SEMPRE zero ──
  // Sem isso, devolver R$ 45.000 numa parcela nominal de R$ 41.428,57 criaria
  // R$ 3.571,43 de despesa financeira inexistente.
  it('taxa 0%: devolução 45.000 numa parcela nominal 41.428,57 → encargo 0, amort 45.000', () => {
    const s = computeLinkSplit({ installment: { amortization: 41428.57, openingBalance: 290000 }, rateMonthly: 0, paidTotal: 45000 })
    expect(s.encargos).toBe(0)
    expect(s.paidInterest).toBe(0)
    expect(s.paidCorrection).toBe(0)
    expect(s.paidPenalty).toBe(0)
    expect(s.amortization).toBeCloseTo(45000, 2)
    expect(s.isPartial).toBe(false)
    // saldo cai EXATAMENTE o valor devolvido: 290.000 − 45.000 = 245.000
    expect(s.closingBalance).toBeCloseTo(245000, 2)
  })
  it('taxa 0%: devolução MENOR que a parcela nominal ainda é encargo 0 (não vira parcial com despesa)', () => {
    const s = computeLinkSplit({ installment: { amortization: 41428.57, openingBalance: 290000 }, rateMonthly: 0, paidTotal: 30000 })
    expect(s.encargos).toBe(0)
    expect(s.amortization).toBeCloseTo(30000, 2)
    expect(s.closingBalance).toBeCloseTo(260000, 2)
  })
})

// ===== BUG 1/2 — agrupamento do painel (buildLinkGroup) =====
describe('buildLinkGroup', () => {
  const tx = (id: string, description: string, amount: number): GroupTx => ({ id, description, amount, date: new Date('2026-07-15') })

  it('C41022570: os 21 lançamentos agrupam com total 5.951,33 (BUG 2)', () => {
    const amorts = [1101.39, 35.61, 39.98, 46.0, 29.99, 222.92, 778.78, 959.63, 46.99, 45.99, 20.0, 132.95, 57.49, 167.47, 155.86, 32.99, 74.97, 51.98, 315.98, 491.83]
    const pend = amorts.map((a, i) => tx(`a${i}`, 'AMORTIZACAO CONTRATO-C41022570', a))
    pend.push(tx('liq', 'LIQUIDACAO DE PARCELA-C41022570', 1142.53))
    const g = buildLinkGroup({ pend, contractNumber: 'C41022570-0' })
    expect(g.candidates.length).toBe(21)
    expect(g.selectedIds.length).toBe(21)
    expect(g.paidTotal).toBeCloseTo(5951.33, 2)
  })

  it('tx clicada SEMPRE entra pré-selecionada — CONTRACT', () => {
    const pend = [tx('t1', 'AMORTIZACAO CONTRATO-C41022570', 100), tx('t2', 'AMORTIZACAO CONTRATO-C41022570', 200)]
    const g = buildLinkGroup({ pend, contractNumber: 'C41022570-0', originTxId: 't1' })
    expect(g.selectedIds).toContain('t1')
  })

  it('empréstimo SEM número (Caixa): grupo abre com 1 (a tx clicada), não com 0 (BUG 1)', () => {
    const pend = [tx('c1', 'DEBITO PRESTA SIEMP', 2927.02), tx('c2', 'DEBITO PRESTA SIEMP', 3100.0)]
    const g = buildLinkGroup({ pend, contractNumber: '000000000001827478', originTxId: 'c1' })
    // só a clicada pré-selecionada
    expect(g.selectedIds).toEqual(['c1'])
    expect(g.paidTotal).toBeCloseTo(2927.02, 2)
    // a outra aparece como candidato ADICIONÁVEL, mas NÃO pré-selecionada
    const c2 = g.candidates.find((c) => c.id === 'c2')
    expect(c2?.selected).toBe(false)
  })

  it('2 contratos Caixa na mesma conta NÃO se misturam (só a clicada entra)', () => {
    // ambos "DEBITO PRESTA SIEMP" na mesma conta — sem originTx do outro, não agrupa junto
    const pend = [tx('L1p', 'DEBITO PRESTA SIEMP', 2927.02), tx('L2p', 'DEBITO PRESTA SIEMP', 1500.0)]
    const g = buildLinkGroup({ pend, contractNumber: '000000000001827478', originTxId: 'L1p' })
    expect(g.selectedIds).toEqual(['L1p'])
    expect(g.selectedIds).not.toContain('L2p')
  })

  it('sem originTxId nem contrato → grupo vazio (não inventa)', () => {
    const pend = [tx('x', 'DEBITO PRESTA SIEMP', 100)]
    const g = buildLinkGroup({ pend, contractNumber: null })
    expect(g.selectedIds.length).toBe(0)
  })
})

// ===== FIX matcher por data — parcela fixa PRICE não desloca mais =====
describe('pickTargetInstallment', () => {
  const open = (n: number, venc: string, payment = 10234.35): OpenInstallment => ({ number: n, dueDate: new Date(venc), payment, status: 'OPEN' })
  const parcelas = [open(18, '2026-05-25'), open(19, '2026-06-25'), open(20, '2026-07-25')]

  it('PRICE parcela fixa: cada pagamento casa pela DATA, não a mais antiga', () => {
    // débito de 25/06 → #19 (venc 25/06), NÃO #18 (a mais antiga)
    const jun = pickTargetInstallment(parcelas, new Date('2026-06-25'), 10234.35)
    expect(jun.target!.number).toBe(19)
    expect(jun.valorAmbiguo).toBe(true) // 3 parcelas de mesmo valor
    expect(jun.byDate).toBe(true)
    // débito de 27/07 (atrasado 2d) → #20 (venc 25/07)
    expect(pickTargetInstallment(parcelas, new Date('2026-07-27'), 10234.35).target!.number).toBe(20)
    // débito de 25/05 → #18
    expect(pickTargetInstallment(parcelas, new Date('2026-05-25'), 10234.35).target!.number).toBe(18)
  })

  it('valor distingue (SAC parcelas diferentes) → não marca ambíguo', () => {
    const sac = [open(1, '2026-06-15', 2777.77), open(2, '2026-07-15', 2760.10)]
    const r = pickTargetInstallment(sac, new Date('2026-07-15'), 2760.10)
    expect(r.target!.number).toBe(2)
    expect(r.valorAmbiguo).toBe(false)
  })

  it('data também não distingue (empate) → sinaliza dateAmbiguo pra perguntar', () => {
    // duas parcelas equidistantes do débito
    const eq = [open(5, '2026-06-10', 500), open(6, '2026-06-20', 500)]
    const r = pickTargetInstallment(eq, new Date('2026-06-15'), 500)
    expect(r.valorAmbiguo).toBe(true)
    expect(r.dateAmbiguo).toBe(true)
  })

  it('sem data de origem → cai na mais antiga (comportamento antigo, sem quebrar)', () => {
    expect(pickTargetInstallment(parcelas, null, null).target!.number).toBe(18)
  })
})

// ===== FASE 3 — detecção (contrato Sicredi vs candidatos Banrisul) =====
describe('detectLoanPayment', () => {
  const sicredi: DetectLoanLite = { id: 'L1', contractNumber: 'C41022570-0', lender: 'Sicredi', status: 'ACTIVE', dueDay: 15 }
  const banr1: DetectLoanLite = { id: 'B1', contractNumber: '002100057538834', lender: 'Banrisul', status: 'ACTIVE', dueDay: 26 }
  const banr2: DetectLoanLite = { id: 'B2', contractNumber: '002100064956967', lender: 'Banrisul', status: 'ACTIVE', dueDay: 11 }

  it('Sicredi: contrato na descrição → vínculo direto', () => {
    const d = detectLoanPayment({ description: 'AMORTIZACAO CONTRATO-C41022570', type: 'DEBIT', date: '2026-07-15' }, [sicredi])
    expect(d).toMatchObject({ kind: 'CONTRACT', loanId: 'L1' })
  })
  it('Banrisul: "EMPRESTIMO" sem número + 2 empréstimos → CANDIDATOS, NÃO escolhe sozinho', () => {
    const d = detectLoanPayment({ description: 'EMPRESTIMO', type: 'DEBIT', date: '2026-07-26' }, [banr1, banr2])
    expect(d?.kind).toBe('CANDIDATES')
    if (d?.kind === 'CANDIDATES') {
      expect(d.candidates.length).toBe(2)
      // ranqueia dia 26 primeiro (vence dia 26)
      expect(d.candidates[0].loanId).toBe('B1')
    }
  })
  it('contrato sem empréstimo cadastrado → avisa cadastrar', () => {
    const d = detectLoanPayment({ description: 'AMORTIZACAO CONTRATO-C99999999', type: 'DEBIT', date: '2026-07-15' }, [sicredi])
    expect(d?.kind).toBe('NOT_REGISTERED')
  })
  it('descrição comum (não empréstimo) → null', () => {
    expect(detectLoanPayment({ description: 'PIX RECEBIDO', type: 'DEBIT', date: '2026-07-15' }, [sicredi])).toBeNull()
  })
  it('PIX pra CPF (11 dígitos) NÃO vira "empréstimo não cadastrado" (falso positivo)', () => {
    // o extrator pega "60025889060" pelo fallback ≥10 dígitos, mas não é contrato
    const d = detectLoanPayment({ description: 'PAGAMENTO PIX-PIX_DEB   60025889060 YUSS', type: 'DEBIT', date: '2026-07-13' }, [sicredi, banr1])
    expect(d).toBeNull()
  })
})
