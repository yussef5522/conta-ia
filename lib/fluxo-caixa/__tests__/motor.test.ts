// REGRA 3 — estes testes EXECUTAM o motor com linhas reais, não procuram string.
// Cada um trava uma das regras de honestidade que o dono definiu (25/08).

import { describe, it, expect } from 'vitest'
import {
  whereFluxoCaixa, agruparFluxo, rotularLinha, serieMensal, ultimosMeses, paraLinha,
  CAT_FATURA, CAT_PARCELA, CAT_SEM, type LinhaFluxo,
} from '../motor'

const d = (s: string) => new Date(`${s}T12:00:00.000Z`)
let seq = 0
const linha = (p: Partial<LinhaFluxo> & { type: string; amount: number }): LinhaFluxo => ({
  id: `t${++seq}`, date: d('2026-08-10'), categoriaNome: null, isCardPayment: false,
  ehParcelaEmprestimo: false, contaNome: 'banrisul', descricao: 'x', ...p,
})

describe('whereFluxoCaixa — as travas do dinheiro vivo', () => {
  const w = whereFluxoCaixa('empresa-1', { de: d('2026-08-01'), ate: d('2026-08-31') })

  it('exclui as 4 marcas de transferência entre contas próprias', () => {
    expect(w.type).toEqual({ not: 'TRANSFER' })
    expect(w.isInternalTransfer).toBe(false)
    expect(w.pendingTransfer).toBe(false)
    expect(w.NOT).toEqual({ category: { dreGroup: 'TRANSFERENCIA' } })
  })

  it('só dinheiro que de fato saiu/entrou (EFFECTED) e sem dupla contagem da conciliada', () => {
    expect(w.lifecycle).toBe('EFFECTED')
    expect(w.reconciledWithId).toBeNull()
  })

  it('CARTÃO: aceita o pagamento da fatura e recusa a compra', () => {
    // a compra tem businessCreditCardId e isCardPayment=false → não casa nenhum ramo
    expect(w.OR).toEqual([{ businessCreditCardId: null }, { isCardPayment: true }])
  })

  it('recusa companyId vazio (isolamento) e período invertido', () => {
    expect(() => whereFluxoCaixa('', { de: d('2026-08-01'), ate: d('2026-08-02') })).toThrow(/companyId/)
    expect(() => whereFluxoCaixa('e', { de: d('2026-08-05'), ate: d('2026-08-01') })).toThrow(/invertido/)
  })
})

describe('rotularLinha — a categoria do dono manda', () => {
  it('categoria existente vence os sintéticos', () => {
    const r = rotularLinha(linha({ type: 'DEBIT', amount: 10, categoriaNome: 'Salários', isCardPayment: true }))
    expect(r).toEqual({ rotulo: 'Salários', sintetico: false })
  })

  it('pagamento de fatura sem categoria vira linha PRÓPRIA, não "A CLASSIFICAR"', () => {
    expect(rotularLinha(linha({ type: 'DEBIT', amount: 7896.32, isCardPayment: true })))
      .toEqual({ rotulo: CAT_FATURA, sintetico: true })
  })

  it('parcela de empréstimo sem categoria vira linha PRÓPRIA', () => {
    expect(rotularLinha(linha({ type: 'DEBIT', amount: 4348.64, ehParcelaEmprestimo: true })))
      .toEqual({ rotulo: CAT_PARCELA, sintetico: true })
  })

  it('o resto sem categoria COBRA — nunca some', () => {
    expect(rotularLinha(linha({ type: 'DEBIT', amount: 99 })).rotulo).toBe(CAT_SEM)
  })
})

describe('paraLinha — o vínculo de empréstimo tem DUAS portas', () => {
  const cru = (over: object) => ({
    id: 'a', date: d('2026-08-10'), amount: 100, type: 'DEBIT', description: 'LIQUIDACAO',
    isCardPayment: false, category: null, bankAccount: { name: 'sicredi ' },
    loanInstallmentPaid: null, loanInstallmentPayments: [], ...over,
  })

  it('porta 1:1 (reconciledTransactionId)', () => {
    expect(paraLinha(cru({ loanInstallmentPaid: { id: 'p1' } })).ehParcelaEmprestimo).toBe(true)
  })

  it('porta N:1 (LoanInstallmentPayment) — é a que a Cacula usa; checar só a 1ª daria zero', () => {
    expect(paraLinha(cru({ loanInstallmentPayments: [{ id: 'x' }] })).ehParcelaEmprestimo).toBe(true)
  })

  it('sem nenhuma das duas → não é parcela', () => {
    expect(paraLinha(cru({})).ehParcelaEmprestimo).toBe(false)
  })

  it('apara o espaço do nome da conta (a conta real se chama "sicredi ")', () => {
    expect(paraLinha(cru({})).contaNome).toBe('sicredi')
  })
})

describe('agruparFluxo', () => {
  it('entrou − saiu = resultado, e o rastro fica em cada categoria', () => {
    const r = agruparFluxo([
      linha({ type: 'CREDIT', amount: 1000, categoriaNome: 'Receita de Vendas' }),
      linha({ type: 'CREDIT', amount: 500, categoriaNome: 'Receita de Vendas' }),
      linha({ type: 'DEBIT', amount: 300, categoriaNome: 'Salários' }),
    ])
    expect(r.entrou).toBe(1500)
    expect(r.saiu).toBe(300)
    expect(r.resultado).toBe(1200)
    expect(r.entradas[0]).toMatchObject({ rotulo: 'Receita de Vendas', total: 1500, n: 2 })
    expect(r.entradas[0].lancamentos).toHaveLength(2)
  })

  it('faltou aparece como resultado NEGATIVO (não vira zero nem some)', () => {
    const r = agruparFluxo([
      linha({ type: 'CREDIT', amount: 100 }),
      linha({ type: 'DEBIT', amount: 450, categoriaNome: 'Aluguel' }),
    ])
    expect(r.resultado).toBe(-350)
  })

  it('ordena as saídas pelo VALOR (a maior primeiro — é o que o dono procura)', () => {
    const r = agruparFluxo([
      linha({ type: 'DEBIT', amount: 10, categoriaNome: 'Água' }),
      linha({ type: 'DEBIT', amount: 900, categoriaNome: 'Matéria-Prima' }),
      linha({ type: 'DEBIT', amount: 200, categoriaNome: 'Salários' }),
    ])
    expect(r.saidas.map((g) => g.rotulo)).toEqual(['Matéria-Prima', 'Salários', 'Água'])
  })

  it('⭐ INVARIANTE: a soma das categorias BATE com o total, incluindo os sintéticos', () => {
    const r = agruparFluxo([
      linha({ type: 'CREDIT', amount: 1000, categoriaNome: 'Receita de Vendas' }),
      linha({ type: 'DEBIT', amount: 129864.01, categoriaNome: 'Matéria-Prima - Alimentos' }),
      linha({ type: 'DEBIT', amount: 7896.32, isCardPayment: true }),
      linha({ type: 'DEBIT', amount: 4348.64, ehParcelaEmprestimo: true }),
      linha({ type: 'DEBIT', amount: 77.5 }), // sem categoria nenhuma
    ])
    const somaS = r.saidas.reduce((s, g) => s + g.total, 0)
    const somaE = r.entradas.reduce((s, g) => s + g.total, 0)
    expect(Math.round(somaS * 100) / 100).toBe(r.saiu)
    expect(Math.round(somaE * 100) / 100).toBe(r.entrou)
    // e o balde de erro é contado à parte, com o valor à vista
    expect(r.aClassificar).toEqual({ n: 1, entrada: 0, saida: 77.5 })
  })

  it('TRANSFER que escape do where não vira entrada nem saída (defesa em profundidade)', () => {
    const r = agruparFluxo([
      linha({ type: 'TRANSFER', amount: 17000 }),
      linha({ type: 'CREDIT', amount: 50 }),
    ])
    expect(r.entrou).toBe(50)
    expect(r.saiu).toBe(0)
  })
})

describe('serieMensal — mês nunca aparece sem dizer se é confiável', () => {
  const linhas = [
    linha({ type: 'CREDIT', amount: 100, date: d('2026-07-10') }),
    linha({ type: 'CREDIT', amount: 300, date: d('2026-08-10') }),
    linha({ type: 'DEBIT', amount: 120, date: d('2026-08-11') }),
  ]

  it('mês corrente = "em andamento (até DD/MM)"', () => {
    const s = serieMensal(linhas, ['2026-08'], d('2026-08-25'))
    expect(s[0]).toMatchObject({ mes: '2026-08', entrou: 300, saiu: 120, resultado: 180, completo: false })
    expect(s[0].motivo).toBe('em andamento (até 25/08)')
  })

  it('mês anterior ao marco de agosto/2026 é marcado, mas APARECE com o número', () => {
    const s = serieMensal(linhas, ['2026-07'], d('2026-08-25'))
    expect(s[0].entrou).toBe(100)
    expect(s[0].completo).toBe(false)
    expect(s[0].motivo).toMatch(/marco de agosto/)
  })

  it('mês fechado depois do marco não recebe ressalva', () => {
    const s = serieMensal([linha({ type: 'CREDIT', amount: 9, date: d('2026-09-02') })], ['2026-09'], d('2026-10-05'))
    expect(s[0]).toMatchObject({ completo: true, motivo: null })
  })

  it('mês sem nenhum lançamento vem como zero, não some da série', () => {
    const s = serieMensal([], ['2026-06', '2026-07'], d('2026-08-25'))
    expect(s).toHaveLength(2)
    expect(s[0]).toMatchObject({ mes: '2026-06', entrou: 0, saiu: 0 })
  })
})

describe('ultimosMeses', () => {
  it('6 meses terminando no informado, virando o ano', () => {
    expect(ultimosMeses('2026-08', 6)).toEqual(['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'])
    expect(ultimosMeses('2026-02', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
  })
})
