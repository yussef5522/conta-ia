// REGRA 3 — estes testes EXECUTAM o motor com linhas reais, não procuram string.
// Cada um trava uma das regras de honestidade que o dono definiu (25/08).

import { describe, it, expect } from 'vitest'
import {
  whereFluxoCaixa, agruparFluxo, rotularLinha, serieMensal, ultimosMeses, paraLinha,
  entradaInformativa, CAT_FATURA, CAT_PARCELA, CAT_SEM, CAT_LIBERACAO, CAT_APORTE,
  DRE_APORTE, type LinhaFluxo,
} from '../motor'

const d = (s: string) => new Date(`${s}T12:00:00.000Z`)
let seq = 0
const linha = (p: Partial<LinhaFluxo> & { type: string; amount: number }): LinhaFluxo => ({
  id: `t${++seq}`, date: d('2026-08-10'), categoriaNome: null, isCardPayment: false,
  ehParcelaEmprestimo: false, ehLiberacaoEmprestimo: false, dreGroup: null,
  contaNome: 'banrisul', descricao: 'x', ...p,
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


// ⭐ REGRA DO DONO (26/08): "ENTROU = só o que realmente entrou DE VENDA. Dinheiro de
// empréstimo não é venda, não é receita — é dívida entrando."
// O caso real: R$ 100.000 do C61021346 liberados em 12/06/2026, que estavam
// categorizados como "Aporte de Capital" e somariam no ENTROU de junho.
describe('empréstimo NÃO é entrada — junho com e sem a liberação', () => {
  const VENDAS_JUNHO = [
    linha({ type: 'CREDIT', amount: 299520.45, categoriaNome: 'Receita de Vendas', date: d('2026-06-15') }),
    linha({ type: 'CREDIT', amount: 54462.81, categoriaNome: 'Venda em dinheiro', date: d('2026-06-20') }),
    linha({ type: 'CREDIT', amount: 861.70, categoriaNome: 'Receita Delivery (iFood)', date: d('2026-06-10') }),
    linha({ type: 'DEBIT', amount: 1000, categoriaNome: 'Aluguel', date: d('2026-06-05') }),
  ]
  // a liberação REAL: vínculo estrutural com o contrato + categoria (errada) de aporte
  const LIBERACAO = linha({
    type: 'CREDIT', amount: 100000, date: d('2026-06-12'),
    categoriaNome: 'Aporte de Capital', dreGroup: DRE_APORTE,
    ehLiberacaoEmprestimo: true, descricao: 'LIBERACAO CREDITO-C61021346', contaNome: 'sicredi',
  })

  it('⭐ ENTROU é IDÊNTICO com e sem a liberação', () => {
    const sem = agruparFluxo(VENDAS_JUNHO)
    const com = agruparFluxo([...VENDAS_JUNHO, LIBERACAO])
    expect(com.entrou).toBe(sem.entrou)
    expect(com.resultado).toBe(sem.resultado)
    expect(com.entrou).toBe(354844.96) // 299520.45 + 54462.81 + 861.70
  })

  it('a liberação NÃO some: vira linha própria, informativa, com o valor à vista', () => {
    const com = agruparFluxo([...VENDAS_JUNHO, LIBERACAO])
    expect(com.informativas).toHaveLength(1)
    expect(com.informativas[0]).toMatchObject({ rotulo: CAT_LIBERACAO, total: 100000, n: 1 })
    expect(com.totalInformativo).toBe(100000)
    expect(com.informativas[0].lancamentos[0].descricao).toContain('C61021346')
  })

  it('o VÍNCULO manda sobre a categoria — dívida não vira "aporte de sócio" na tela', () => {
    // a categoria diz aporte; o vínculo com o contrato diz empréstimo. Ganha o vínculo.
    expect(entradaInformativa(LIBERACAO)).toBe(CAT_LIBERACAO)
  })

  it('APORTE DE VERDADE (sem vínculo de contrato) também fica fora do ENTROU', () => {
    const aporte = linha({ type: 'CREDIT', amount: 50000, categoriaNome: 'Aporte de Capital', dreGroup: DRE_APORTE })
    const r = agruparFluxo([...VENDAS_JUNHO, aporte])
    expect(r.entrou).toBe(354844.96)
    expect(r.informativas[0]).toMatchObject({ rotulo: CAT_APORTE, total: 50000 })
  })

  it('a liberação NÃO entra em "entradas por categoria" (senão apareceria somada)', () => {
    const com = agruparFluxo([...VENDAS_JUNHO, LIBERACAO])
    expect(com.entradas.map((g) => g.rotulo)).not.toContain('Aporte de Capital')
    expect(com.entradas.reduce((s, g) => s + g.total, 0)).toBe(com.entrou)
  })

  it('a SAÍDA não muda: pagar continua pagar, não importa o quê', () => {
    const com = agruparFluxo([...VENDAS_JUNHO, LIBERACAO])
    expect(com.saiu).toBe(1000)
  })

  it('o GRÁFICO de 6 meses usa a mesma regra — junho não incha por dívida', () => {
    const semLib = serieMensal(VENDAS_JUNHO, ['2026-06'], d('2026-08-26'))
    const comLib = serieMensal([...VENDAS_JUNHO, LIBERACAO], ['2026-06'], d('2026-08-26'))
    expect(comLib[0].entrou).toBe(semLib[0].entrou)
    expect(comLib[0].resultado).toBe(semLib[0].resultado)
  })

  it('DEBIT com dreGroup de aporte não é tratado como informativo (só entrada é)', () => {
    const saida = linha({ type: 'DEBIT', amount: 10, categoriaNome: 'Devolução de aporte', dreGroup: DRE_APORTE })
    expect(entradaInformativa(saida)).toBeNull()
    expect(agruparFluxo([saida]).saiu).toBe(10)
  })
})


// ⭐ INVARIANTE DA AUDITORIA (26/08) — nasceu da revisão conta-a-conta de agosto que o
// dono pediu: "extrato bruto = ENTROU + excluídos explicados; se sobrar linha
// inexplicada, ela aparece". Nenhum real pode evaporar entre a entrada e os baldes.
describe('nenhuma linha some em silêncio', () => {
  it('Σ(entradas) + Σ(saídas) + Σ(informativas) == Σ de tudo que entrou no motor', () => {
    const linhas = [
      linha({ type: 'CREDIT', amount: 372089.71, categoriaNome: 'Receita de Vendas' }),
      linha({ type: 'CREDIT', amount: 50203.35, categoriaNome: 'Venda em dinheiro' }),
      linha({ type: 'CREDIT', amount: 41000, descricao: 'PIX sem categoria' }), // A CLASSIFICAR
      linha({ type: 'CREDIT', amount: 100000, ehLiberacaoEmprestimo: true }),   // informativa
      linha({ type: 'DEBIT', amount: 139487.5, categoriaNome: 'Matéria-Prima - Alimentos' }),
      linha({ type: 'DEBIT', amount: 54981.84 }),                               // A CLASSIFICAR
      linha({ type: 'DEBIT', amount: 28956.44, isCardPayment: true }),          // sintética
      linha({ type: 'DEBIT', amount: 31926.73, ehParcelaEmprestimo: true }),    // sintética
    ]
    const r = agruparFluxo(linhas)
    const nosBaldes = [...r.entradas, ...r.saidas, ...r.informativas].reduce((s, g) => s + g.total, 0)
    const entrouNoMotor = linhas.reduce((s, l) => s + l.amount, 0)
    expect(Math.round(nosBaldes * 100) / 100).toBe(Math.round(entrouNoMotor * 100) / 100)
  })

  it('e a contagem de LANÇAMENTOS também fecha (nenhum rastro perdido)', () => {
    const linhas = [
      linha({ type: 'CREDIT', amount: 10, categoriaNome: 'Vendas' }),
      linha({ type: 'CREDIT', amount: 20, ehLiberacaoEmprestimo: true }),
      linha({ type: 'DEBIT', amount: 30 }),
      linha({ type: 'DEBIT', amount: 40, isCardPayment: true }),
    ]
    const r = agruparFluxo(linhas)
    const n = [...r.entradas, ...r.saidas, ...r.informativas].reduce((s, g) => s + g.n, 0)
    expect(n).toBe(linhas.length)
    const rastros = [...r.entradas, ...r.saidas, ...r.informativas].reduce((s, g) => s + g.lancamentos.length, 0)
    expect(rastros).toBe(linhas.length)
  })

  it('TODA categoria aparece — nunca existe balde "outros" agrupando cauda longa', () => {
    // 34 categorias distintas (o agosto real tem exatamente isso do lado das saídas)
    const linhas = Array.from({ length: 34 }, (_, i) =>
      linha({ type: 'DEBIT', amount: 1000 - i, categoriaNome: `Categoria ${i}` }))
    const r = agruparFluxo(linhas)
    expect(r.saidas).toHaveLength(34)
    expect(r.saidas.map((g) => g.rotulo)).not.toContain('Outros')
    expect(Math.round(r.saidas.reduce((s, g) => s + g.total, 0) * 100) / 100).toBe(r.saiu)
  })
})
