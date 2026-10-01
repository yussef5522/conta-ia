// REGRA 1/3 — os 3 lançamentos REAIS da parcela #21 do C41033828 (25/08/2026).
// A conta não tinha saldo e o Sicredi debitou conforme o dinheiro entrava.
// Antes: caíam em "escolha você". Depois: cada uma vem sugerida com contrato + parcela.

import { describe, it, expect } from 'vitest'
import { sugerirVinculoEmprestimo, escolherParcela, type ParcelaLite } from '../sugerir-vinculo'
import type { DetectLoanLite } from '../detect-payment'

const d = (s: string) => new Date(`${s}T00:00:00.000Z`)

// Os contratos REAIS da Cacula no Sicredi (mesma conta) — o detector tem que
// escolher o certo pelo número na descrição, não pelo dia de vencimento.
const LOANS: DetectLoanLite[] = [
  { id: 'L-3828', contractNumber: 'C41033828-8', lender: 'Sicredi', status: 'ACTIVE', dueDay: 25 },
  { id: 'L-2227', contractNumber: 'C41022227-1', lender: 'Sicredi', status: 'ACTIVE', dueDay: 25 },
  { id: 'L-caixa', contractNumber: '000000000001837311', lender: 'Caixa Econômica Federal', status: 'ACTIVE', dueDay: 25 },
]

// Agenda real do C41033828 em torno da #21.
const PARCELAS: ParcelaLite[] = [
  { number: 19, dueDate: d('2026-06-25'), payment: 10234.35, status: 'PAID', paidTotal: 10234.35 },
  { number: 20, dueDate: d('2026-07-25'), payment: 10234.35, status: 'PAID', paidTotal: 10234.35 },
  { number: 21, dueDate: d('2026-08-25'), payment: 10234.35, status: 'OPEN', paidTotal: 0 },
  { number: 22, dueDate: d('2026-09-25'), payment: 10234.35, status: 'OPEN', paidTotal: 0 },
]
const mapa = (ps: ParcelaLite[]) => ({ 'L-3828': ps })

// As 3 MORDIDAS REAIS, na ordem em que o banco debitou.
const MORDIDAS = [
  { description: 'AMORTIZACAO CONTRATO-C41033828', amount: 4923.71 },
  { description: 'AMORTIZACAO CONTRATO-C41033828', amount: 3224.94 },
  { description: 'LIQUIDACAO DE PARCELA-C41033828', amount: 2085.70 },
]

describe('as 3 mordidas reais da #21', () => {
  it('a 1ª já vem SUGERIDA com contrato e parcela (antes: "escolha você")', () => {
    const s = sugerirVinculoEmprestimo(
      { ...MORDIDAS[0], type: 'DEBIT', date: d('2026-08-25') }, LOANS, mapa(PARCELAS))
    expect(s?.kind).toBe('SUGERIDO')
    if (s?.kind !== 'SUGERIDO') throw new Error('x')
    expect(s.loanId).toBe('L-3828')
    expect(s.contractNumber).toBe('C41033828-8')
    expect(s.installmentNumber).toBe(21)
    expect(s.parcial).toBe(true)
    expect(s.faltaDepois).toBe(5310.64) // 10234.35 − 4923.71
    expect(s.rotulo).toContain('C41033828-8')
    expect(s.rotulo).toContain('parcela 21')
  })

  it('a 2ª (a que o banco pegou logo após o PIX da Tuna) sugere a MESMA parcela', () => {
    const parcial = PARCELAS.map((p) => (p.number === 21 ? { ...p, paidTotal: 4923.71 } : p))
    const s = sugerirVinculoEmprestimo(
      { ...MORDIDAS[1], type: 'DEBIT', date: d('2026-08-25') }, LOANS, mapa(parcial))
    if (s?.kind !== 'SUGERIDO') throw new Error('x')
    expect(s.installmentNumber).toBe(21)
    expect(s.parcial).toBe(true)
    expect(s.faltaDepois).toBe(2085.70) // exatamente a 3ª mordida
  })

  it('a 3ª FECHA a parcela — deixa de ser parcial', () => {
    const parcial = PARCELAS.map((p) => (p.number === 21 ? { ...p, paidTotal: 8148.65 } : p))
    const s = sugerirVinculoEmprestimo(
      { ...MORDIDAS[2], type: 'DEBIT', date: d('2026-08-25') }, LOANS, mapa(parcial))
    if (s?.kind !== 'SUGERIDO') throw new Error('x')
    expect(s.installmentNumber).toBe(21)
    expect(s.parcial).toBe(false)
    expect(s.faltaDepois).toBe(0)
    expect(s.rotulo).toBe('Pgto empréstimo C41033828-8 — parcela 21')
  })

  it('⭐ as 3 somam a parcela AO CENTAVO e todas apontam pra #21', () => {
    let pago = 0
    const nums: number[] = []
    for (const m of MORDIDAS) {
      const ps = PARCELAS.map((p) => (p.number === 21 ? { ...p, paidTotal: pago } : p))
      const s = sugerirVinculoEmprestimo({ ...m, type: 'DEBIT', date: d('2026-08-25') }, LOANS, mapa(ps))
      if (s?.kind !== 'SUGERIDO') throw new Error('devia sugerir')
      nums.push(s.installmentNumber)
      pago = Math.round((pago + m.amount) * 100) / 100
    }
    expect(nums).toEqual([21, 21, 21])
    expect(pago).toBe(10234.35)
  })

  it('não confunde com o OUTRO contrato Sicredi da mesma conta', () => {
    const s = sugerirVinculoEmprestimo(
      { description: 'LIQUIDACAO DE PARCELA-C41022227', amount: 7335.85, type: 'DEBIT', date: d('2026-08-17') },
      LOANS, { 'L-2227': [{ number: 22, dueDate: d('2026-08-25'), payment: 7335.85, status: 'OPEN' }] })
    if (s?.kind !== 'SUGERIDO') throw new Error('x')
    expect(s.loanId).toBe('L-2227')
  })
})

describe('o que NÃO deve adivinhar', () => {
  it('descrição sem número (Banrisul "EMPRESTIMO") → devolve candidatos pro dono', () => {
    const s = sugerirVinculoEmprestimo(
      { description: 'EMPRESTIMO', amount: 4092.02, type: 'DEBIT', date: d('2026-08-11') },
      LOANS, mapa(PARCELAS))
    expect(s?.kind).toBe('ESCOLHER')
  })

  it('contrato na descrição que NÃO está cadastrado → avisa, não inventa', () => {
    const s = sugerirVinculoEmprestimo(
      { description: 'AMORTIZACAO CONTRATO-C99999999', amount: 100, type: 'DEBIT', date: d('2026-08-25') },
      LOANS, mapa(PARCELAS))
    expect(s?.kind).toBe('NAO_CADASTRADO')
  })

  it('CREDIT nunca é pagamento de parcela', () => {
    expect(sugerirVinculoEmprestimo(
      { description: 'AMORTIZACAO CONTRATO-C41033828', amount: 10, type: 'CREDIT', date: d('2026-08-25') },
      LOANS, mapa(PARCELAS))).toBeNull()
  })

  it('contrato certo mas SEM parcela aberta → não força, manda escolher', () => {
    const todasPagas = PARCELAS.map((p) => ({ ...p, status: 'PAID' }))
    const s = sugerirVinculoEmprestimo(
      { ...MORDIDAS[0], type: 'DEBIT', date: d('2026-08-25') }, LOANS, mapa(todasPagas))
    expect(s?.kind).toBe('ESCOLHER')
  })
})

describe('escolherParcela', () => {
  it('pega a aberta com vencimento mais próximo da data do débito', () => {
    expect(escolherParcela(PARCELAS, d('2026-08-25'))?.number).toBe(21)
    expect(escolherParcela(PARCELAS, d('2026-09-20'))?.number).toBe(22)
  })

  it('empate de distância → a MAIS ANTIGA (o banco cobra a velha primeiro)', () => {
    const ps: ParcelaLite[] = [
      { number: 21, dueDate: d('2026-08-20'), payment: 100, status: 'OPEN' },
      { number: 22, dueDate: d('2026-08-30'), payment: 100, status: 'OPEN' },
    ]
    expect(escolherParcela(ps, d('2026-08-25'))?.number).toBe(21)
  })

  it('sem parcela aberta → null', () => {
    expect(escolherParcela(PARCELAS.map((p) => ({ ...p, status: 'PAID' })), d('2026-08-25'))).toBeNull()
  })
})

describe('⛔⛔⛔ DEBITO PRESTA SIEMP — a conta e a parcela exata desempatam (01/10/2026)', () => {
  /**
   * **O caso real do banco caixa:** o dono importou o extrato e a linha
   * `DEBITO PRESTA SIEMP · 26/09 · R$ 2.927,02` ficava **sem palpite**, porque o banco
   * **não escreve o número do contrato** e o detector devolvia **os 10 contratos da
   * empresa** — Banrisul e Sicredi inclusos, que não têm como ser debitados ali.
   *
   * ⚠️ E o comentário do próprio detector já dizia *"palavra-chave + **a conta** tem
   * empréstimo ativo"* — o código nunca olhou a conta, e `palpitesDaCaixa` tinha o
   * `bankAccountId` no `select` e o **descartava no map**.
   */
  const CAIXA = 'conta-banco-caixa'
  const SICREDI = 'conta-sicredi'
  const d = (iso: string) => new Date(`${iso}T12:00:00.000Z`)

  const OS_CONTRATOS = [
    { id: 'L1837311', contractNumber: '000000000001837311', lender: 'Caixa Econômica Federal', status: 'ACTIVE', dueDay: null, bankAccountId: CAIXA },
    { id: 'L1827478', contractNumber: '000000000001827478', lender: 'Caixa Econômica Federal', status: 'ACTIVE', dueDay: null, bankAccountId: CAIXA },
    { id: 'LSic1', contractNumber: 'C41022227-1', lender: 'Sicredi', status: 'ACTIVE', dueDay: null, bankAccountId: SICREDI },
    { id: 'LSic2', contractNumber: 'C41033828-8', lender: 'Sicredi', status: 'ACTIVE', dueDay: null, bankAccountId: SICREDI },
    { id: 'LMutuo', contractNumber: null, lender: 'Arafat (arafet thalji)', status: 'ACTIVE', dueDay: null, bankAccountId: null },
  ]
  /** as parcelas abertas REAIS medidas em prod */
  const AS_PARCELAS = {
    L1837311: [
      { number: 32, dueDate: d('2026-09-26'), payment: 2927.02, status: 'OPEN' },
      { number: 33, dueDate: d('2026-10-26'), payment: 2927.02, status: 'OPEN' },
    ],
    L1827478: [
      { number: 33, dueDate: d('2026-09-24'), payment: 7093.19, status: 'OPEN' },
      { number: 34, dueDate: d('2026-10-24'), payment: 7093.19, status: 'OPEN' },
    ],
    LSic1: [{ number: 26, dueDate: d('2026-09-25'), payment: 2927.02, status: 'OPEN' }],
  }

  const aLinha = { description: 'DEBITO PRESTA SIEMP', type: 'DEBIT', date: d('2026-09-26'), amount: 2927.02 }

  it('⛔⛔⛔ a linha de 2.927,02 vira PALPITE da #32 do 1837311', () => {
    const s = sugerirVinculoEmprestimo({ ...aLinha, bankAccountId: CAIXA }, OS_CONTRATOS, AS_PARCELAS)
    expect(s?.kind, 'voltou a pedir pro dono escolher numa linha que casa ao centavo e no dia').toBe('SUGERIDO')
    if (s?.kind !== 'SUGERIDO') return
    expect(s.contractNumber).toBe('000000000001837311')
    expect(s.installmentNumber).toBe(32)
  })

  it('⛔⛔ sem a CONTA, o Sicredi de 2.927,02 empata e o palpite MORRE — e é o certo', () => {
    /**
     * ⭐ Este teste é a prova de que a régua da conta é o que faz o palpite existir: há um
     * contrato do SICREDI com parcela de valor idêntico. Sem estreitar por conta, duas
     * parcelas fecham → *"não sei qual foi"*, e o sistema não chuta.
     */
    const s = sugerirVinculoEmprestimo({ ...aLinha, bankAccountId: null }, OS_CONTRATOS, AS_PARCELAS)
    expect(s?.kind).toBe('ESCOLHER')
  })

  it('⛔ dois contratos da MESMA conta fechando o mesmo valor → ESCOLHER (não chuta)', () => {
    const empate = {
      ...AS_PARCELAS,
      L1827478: [{ number: 33, dueDate: d('2026-09-26'), payment: 2927.02, status: 'OPEN' }],
    }
    const s = sugerirVinculoEmprestimo({ ...aLinha, bankAccountId: CAIXA }, OS_CONTRATOS, empate)
    expect(s?.kind, 'escolheu um contrato no escuro').toBe('ESCOLHER')
  })

  it('⛔ valor que não casa EXATO não vira palpite — "perto" não compra identidade', () => {
    const s = sugerirVinculoEmprestimo(
      { ...aLinha, amount: 2900, bankAccountId: CAIXA }, OS_CONTRATOS, AS_PARCELAS,
    )
    expect(s?.kind).toBe('ESCOLHER')
  })

  it('⛔ fora da janela de 5 dias também não — a #33 de outubro não é a de hoje', () => {
    const s = sugerirVinculoEmprestimo(
      { ...aLinha, date: d('2026-10-10'), bankAccountId: CAIXA }, OS_CONTRATOS, AS_PARCELAS,
    )
    expect(s?.kind).toBe('ESCOLHER')
  })

  it('⭐ a conta NUNCA estreita até zero: conta sem contrato nenhum mantém a lista', () => {
    /**
     * ⚠️ O `bankAccountId` do contrato pode simplesmente não ter sido preenchido. *Sumir com
     * o candidato é pior que oferecer um a mais* — o de sobra o dono descarta; o que falta
     * ele não tem como adivinhar.
     */
    const s = sugerirVinculoEmprestimo(
      { ...aLinha, amount: 999, bankAccountId: 'conta-sem-contrato' }, OS_CONTRATOS, AS_PARCELAS,
    )
    expect(s?.kind).toBe('ESCOLHER')
    if (s?.kind !== 'ESCOLHER') return
    expect(s.candidates.length, 'a conta estreitou até zero candidato').toBe(OS_CONTRATOS.length)
  })

  it('⭐⭐ e o NÚMERO continua mandando — identidade não se discute com desempate', () => {
    const s = sugerirVinculoEmprestimo(
      { description: 'LIQUIDACAO DE PARCELA-C41022227', type: 'DEBIT', date: d('2026-09-25'), amount: 2927.02, bankAccountId: CAIXA },
      OS_CONTRATOS, AS_PARCELAS,
    )
    expect(s?.kind).toBe('SUGERIDO')
    if (s?.kind !== 'SUGERIDO') return
    // ⭐ o contrato do número ganha, MESMO estando noutra conta
    expect(s.contractNumber).toBe('C41022227-1')
  })
})
