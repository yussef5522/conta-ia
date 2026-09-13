// ⛔⛔ O DASHBOARD DERIVA DA MESMA FONTE — NUNCA DOIS PAINÉIS (13/09/2026)
//
// **Régua do dono:** *"mês navegável recalcula tudo da MESMA fonte (fonte única dos totais
// — o painel /mes atual vira esse ou morre, NUNCA dois painéis)"* e *"zero widget sem dado"*.

import { describe, it, expect } from 'vitest'
import { montarDashboard, estadoDaFatura, type FaturaDoDash } from '../dashboard'
import { painelDoMes, type LinhaDoMes } from '@/lib/pf-extrato/painel-do-mes'

const HOJE = new Date('2026-09-13T12:00:00Z')
const lm = (o: Partial<LinhaDoMes> & { valorComSinal: number }): LinhaDoMes => ({
  id: o.id ?? `l${Math.random()}`, data: o.data ?? new Date('2026-09-10T12:00:00Z'),
  descricao: o.descricao ?? 'x', categoriaId: o.categoriaId ?? null, categoriaNome: o.categoriaNome ?? null,
  ehPagamentoDeFatura: o.ehPagamentoDeFatura ?? false, ...o,
})
const fat = (o: Partial<FaturaDoDash> & { cardId: string; total: number }): FaturaDoDash => ({
  invoiceId: o.invoiceId ?? `i-${o.cardId}`, cardNome: o.cardNome ?? o.cardId, lastDigits: o.lastDigits ?? '0000',
  fechaDia: o.fechaDia ?? 29, limite: o.limite ?? 0, referencia: o.referencia ?? '2026-09',
  vencimento: o.vencimento ?? new Date('2026-09-10T00:00:00Z'), pago: o.pago ?? 0, ...o,
})

const LINHAS: LinhaDoMes[] = [
  lm({ valorComSinal: 21000, categoriaId: 'c1', categoriaNome: 'Retirada da empresa' }),
  lm({ valorComSinal: -3480, categoriaId: 'c2', categoriaNome: 'yussef gastos' }),
  lm({ valorComSinal: -1240, categoriaId: 'c3', categoriaNome: 'Alimentação' }),
  lm({ valorComSinal: -816, categoriaId: 'c4', categoriaNome: 'Contas' }),
  lm({ valorComSinal: -300, categoriaId: 'c5', categoriaNome: 'Lazer' }),
  lm({ valorComSinal: -81 }),                                        // sem categoria
  lm({ valorComSinal: -18593.16, ehPagamentoDeFatura: true }),
]

describe('⭐⭐ fonte única: o topo do dashboard É o painelDoMes', () => {
  it('ENTROU/SAIU/SOBROU vêm da mesma função, não de uma segunda conta', () => {
    const d = montarDashboard({ mes: '2026-09', hoje: HOJE, linhas: LINHAS, historico: LINHAS, saldoNasContas: 71609.96, faturas: [], pontesDoMes: [] })
    const p = painelDoMes('2026-09', LINHAS)
    expect({ entrou: d.entrou, saiu: d.saiu, sobrou: d.sobrou }).toEqual({ entrou: p.entrou, saiu: p.saiu, sobrou: p.sobrou })
    // ⛔ o pagamento de fatura segue FORA do SAIU — senão a compra conta 2×
    expect(d.saiu).toBe(5917)
    expect(d.pagamentosDeFatura.quantos).toBe(1)
  })

  it('⭐ e cada mês do BALANÇO usa a mesma função — não têm como discordar do topo', () => {
    const d = montarDashboard({ mes: '2026-09', hoje: HOJE, linhas: LINHAS, historico: LINHAS, saldoNasContas: 0, faturas: [], pontesDoMes: [] })
    const setembro = d.balanco.find((b) => b.atual)!
    expect(setembro.entrou).toBe(d.entrou)
    expect(setembro.saiu).toBe(d.saiu)
    expect(d.balanco).toHaveLength(4)
    expect(d.balanco.map((b) => b.rotulo)).toEqual(['jun', 'jul', 'ago', 'set'])
  })
})

describe('⭐ o PREVISTO só conta fatura CONHECIDA', () => {
  it('saldo − o que falta pagar das faturas em aberto/vencidas', () => {
    const d = montarDashboard({
      mes: '2026-09', hoje: HOJE, linhas: LINHAS, historico: LINHAS, saldoNasContas: 71609.96,
      faturas: [fat({ cardId: 'banrisul', total: 18593.16 }), fat({ cardId: 'nubank', total: 6210.30, vencimento: new Date('2026-09-15T00:00:00Z') })],
      pontesDoMes: [],
    })
    expect(d.previstoFimDoMes).toBe(46806.5)
    expect(d.faturasNoPrevisto).toBe(2)
  })

  it('⛔ fatura JÁ PAGA não entra no previsto', () => {
    const d = montarDashboard({
      mes: '2026-09', hoje: HOJE, linhas: [], historico: [], saldoNasContas: 1000,
      faturas: [fat({ cardId: 'x', total: 500, pago: 500 })], pontesDoMes: [],
    })
    expect(d.previstoFimDoMes).toBe(1000)
    expect(d.faturasNoPrevisto).toBe(0)
  })

  it('⛔⛔ e NADA de projetar gasto futuro inventado — sem fatura, previsto == saldo', () => {
    // projeção de recorrente é Fase 2; sem histórico ela seria chute com cara de número
    const d = montarDashboard({ mes: '2026-09', hoje: HOJE, linhas: LINHAS, historico: LINHAS, saldoNasContas: 71609.96, faturas: [], pontesDoMes: [] })
    expect(d.previstoFimDoMes).toBe(71609.96)
  })
})

describe('⛔ o CARTÃO SEM LIMITE não ganha barra', () => {
  it('limite 0 = sem barra, sem disponível — nunca um teto inventado', () => {
    const d = montarDashboard({
      mes: '2026-09', hoje: HOJE, linhas: [], historico: [], saldoNasContas: 0,
      faturas: [fat({ cardId: 'sem', total: 6210.30, limite: 0 })], pontesDoMes: [],
    })
    expect(d.cartoes[0].usoPct).toBeNull()
    expect(d.cartoes[0].disponivel).toBeNull()
  })

  it('⭐ com limite, a barra e o disponível saem certos', () => {
    const d = montarDashboard({
      mes: '2026-09', hoje: HOJE, linhas: [], historico: [], saldoNasContas: 0,
      faturas: [fat({ cardId: 'com', total: 18593.16, limite: 25000 })], pontesDoMes: [],
    })
    expect(d.cartoes[0].usoPct).toBe(74)
    expect(d.cartoes[0].disponivel).toBe(6406.84)
  })
})

describe('⭐ o estado da fatura é DERIVADO, nunca o status gravado', () => {
  it.each([
    [{ total: 500, pago: 500 }, 'PAGA'],
    [{ total: 500, pago: 0 }, 'VENCIDA'],
    [{ total: 500, pago: 200 }, 'VENCIDA'],
  ] as const)('%o → %s', (f, esperado) => {
    expect(estadoDaFatura({ ...f, vencimento: new Date('2026-09-10T00:00:00Z') }, HOJE).estado).toBe(esperado)
  })

  it('⭐ vencimento no futuro e não paga = ABERTA', () => {
    expect(estadoDaFatura({ total: 500, pago: 0, vencimento: new Date('2026-09-20T00:00:00Z') }, HOJE).estado).toBe('ABERTA')
  })
})

describe('⭐⭐ o DONUT: top 4 + outras, e "sem categoria" SEMPRE à parte', () => {
  const d = montarDashboard({ mes: '2026-09', hoje: HOJE, linhas: LINHAS, historico: LINHAS, saldoNasContas: 0, faturas: [], pontesDoMes: [] })

  it('as 4 maiores viram fatia nomeada', () => {
    expect(d.donut.slice(0, 4).map((f) => f.nome)).toEqual(['yussef gastos', 'Alimentação', 'Contas', 'Lazer'])
  })

  it('⛔⛔ "sem categoria" tem fatia PRÓPRIA e cor âmbar — é o convite pra agir', () => {
    const s = d.donut.find((f) => f.semCategoria)
    expect(s, 'o sem-categoria foi enterrado em "outras"').toBeDefined()
    expect(s!.valor).toBe(81)
    expect(s!.cor).toBe('#d97706')
  })

  it('⭐ as fatias somam 100% do que saiu', () => {
    const soma = d.donut.reduce((s, f) => s + f.valor, 0)
    expect(soma).toBeCloseTo(d.saiu, 2)
  })

  it('⚠️ sem gasto nenhum, o donut fica VAZIO — não desenha um círculo de nada', () => {
    const vazio = montarDashboard({ mes: '2026-09', hoje: HOJE, linhas: [lm({ valorComSinal: 100 })], historico: [], saldoNasContas: 0, faturas: [], pontesDoMes: [] })
    expect(vazio.donut).toHaveLength(0)
  })
})

describe('⭐ o recebido da empresa e o a-vencer', () => {
  it('soma as pontes do mês e conta quantas foram', () => {
    const d = montarDashboard({
      mes: '2026-09', hoje: HOJE, linhas: LINHAS, historico: LINHAS, saldoNasContas: 0, faturas: [],
      pontesDoMes: [{ valor: 10000 }, { valor: 3500 }, { valor: 21000 }],
    })
    expect(d.recebidoDaEmpresa).toEqual({ total: 34500, transferencias: 3 })
  })

  it('⛔ a-vencer só tem fatura CONHECIDA — recorrente é Fase 2, sem placeholder', () => {
    const d = montarDashboard({
      mes: '2026-09', hoje: HOJE, linhas: [], historico: [], saldoNasContas: 0,
      faturas: [fat({ cardId: 'a', total: 100 }), fat({ cardId: 'b', total: 200, pago: 200 })], pontesDoMes: [],
    })
    expect(d.aVencer).toHaveLength(1)     // a paga não é conta a vencer
    expect(d.aVencer[0].diasDeAtraso).toBe(3)
  })

  it('⭐ a fatura que ainda não venceu é marcada ESTIMADA — o número pode crescer', () => {
    const d = montarDashboard({
      mes: '2026-09', hoje: HOJE, linhas: [], historico: [], saldoNasContas: 0,
      faturas: [fat({ cardId: 'n', total: 6210.30, vencimento: new Date('2026-09-20T00:00:00Z') })], pontesDoMes: [],
    })
    expect(d.aVencer[0].estimada).toBe(true)
    expect(d.aVencer[0].diasDeAtraso).toBe(0)
  })
})
