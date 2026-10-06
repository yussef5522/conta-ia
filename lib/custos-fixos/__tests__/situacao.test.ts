/**
 * ⭐ O SELO DE CADA LINHA — função PURA, com os números REAIS da Caçula (06/10/2026).
 *
 * ⚠️ As cenas saem do dado medido em prod: `Energia Elétrica` 3 contas abertas, R$ 10.851,83,
 * próximo vencimento 21/10 · `Aluguel` R$ 8.456,89 vencendo 05/10 · `Contabilidade` R$ 1.621,00.
 */
import { describe, it, expect } from 'vitest'
import { situacaoDaLinha, excessoDoPlano, estourouOQueAvisa, TOLERANCIA_DO_PLANO, ESTOURO_QUE_AVISA } from '../situacao'

// ⚠️ relógio FIXO no PASSADO (a REGRA do dono: data fixa no futuro é contagem regressiva)
const AGORA = new Date('2026-10-06T14:00:00Z')
const dia = (d: number) => new Date(Date.UTC(2026, 9, d))
const aberta = (d: number, amount: number) => ({ dueDate: dia(d), amount, status: 'PENDING', paymentDate: null })

describe('⭐ o selo de cada linha', () => {
  it('pago ✓ — saiu dinheiro e não sobrou conta em aberto', () => {
    const s = situacaoDaLinha({ realizado: 8456.88, planejado: 8500, emAberto: [] }, AGORA)
    expect(s.estado).toBe('PAGO')
    expect(s.tom).toBe('verde')
  })

  it('⛔ NADA LANÇADO é estado PRÓPRIO — chamar de "pago" seria afirmar um pagamento que não houve', () => {
    const s = situacaoDaLinha({ realizado: 0, planejado: 8500, emAberto: [] }, AGORA)
    expect(s.estado).toBe('SEM_LANCAMENTO')
    expect(s.tom).toBe('cinza')
    expect(s.texto).toMatch(/nada lançado/)
  })

  it('vence dia X — a conta MAIS PRÓXIMA manda (a energia de 21/10)', () => {
    const s = situacaoDaLinha({
      realizado: 0, planejado: 7000,
      emAberto: [aberta(21, 10851.83), aberta(28, 500)],
    }, AGORA)
    expect(s.estado).toBe('VENCE')
    expect(s.tom).toBe('azul')
    expect(s.texto).toContain('dia 21')
  })

  it('⭐ atrasado Nd — a conta MAIS ANTIGA manda (o aluguel de 05/10 visto no dia 06)', () => {
    const s = situacaoDaLinha({ realizado: 0, planejado: 8500, emAberto: [aberta(5, 8456.89)] }, AGORA)
    expect(s.estado).toBe('ATRASADO')
    expect(s.tom).toBe('coral')
    expect(s.texto).toBe('atrasado 1d')
  })

  it('⭐ +18% do plano, com o número arredondado como o dono escreve', () => {
    const s = situacaoDaLinha({ realizado: 1180, planejado: 1000, emAberto: [] }, AGORA)
    expect(s.estado).toBe('ACIMA_DO_PLANO')
    expect(s.tom).toBe('ambar')
    expect(s.texto).toBe('+18% do plano')
  })

  it('⛔ ATRASADO ganha de ACIMA_DO_PLANO — dinheiro vencido é a notícia mais urgente', () => {
    const s = situacaoDaLinha({ realizado: 1180, planejado: 1000, emAberto: [aberta(1, 500)] }, AGORA)
    expect(s.estado).toBe('ATRASADO')
    // ⭐ e a segunda notícia NÃO se perde: o excesso viaja junto
    expect(s.excessoPct).toBeCloseTo(0.18, 4)
  })

  it('⭐ a linha pode ser DUAS coisas: vence dia 21 E já estourou — o excesso viaja no payload', () => {
    const s = situacaoDaLinha({ realizado: 1050, planejado: 1000, emAberto: [aberta(21, 300)] }, AGORA)
    expect(s.estado).toBe('VENCE')
    expect(s.excessoPct).toBeCloseTo(0.05, 4)
  })

  it('⚠️ dentro da tolerância de 15% NÃO acende âmbar — alarme no ruído é como o alarme morre', () => {
    const s = situacaoDaLinha({ realizado: 1140, planejado: 1000, emAberto: [] }, AGORA)
    expect(excessoDoPlano(1140, 1000)).toBeLessThanOrEqual(TOLERANCIA_DO_PLANO)
    expect(s.estado).toBe('PAGO')
  })

  it('⚠️ conta já PAGA não é "em aberto" — quem decide é o statusDaConta, não a data', () => {
    const paga = { dueDate: dia(1), amount: 500, status: 'PENDING', paymentDate: dia(2) }
    const s = situacaoDaLinha({ realizado: 500, planejado: 500, emAberto: [paga] }, AGORA)
    expect(s.estado, 'paga com atraso NÃO é atrasada — o dinheiro já saiu').toBe('PAGO')
  })

  it('⚠️ sem plano, o excesso é NULL — não existe "acima" sem referência', () => {
    expect(excessoDoPlano(5000, null)).toBeNull()
    expect(excessoDoPlano(5000, 0)).toBeNull()
    const s = situacaoDaLinha({ realizado: 5000, planejado: null, emAberto: [] }, AGORA)
    expect(s.estado).toBe('PAGO')
    expect(s.excessoPct).toBeNull()
  })
})

describe('⛔⛔ o degrau do SININHO é MAIS ALTO que o do selo', () => {
  it('⭐ 18% acende o selo âmbar e NÃO avisa — o sininho não repete a tela', () => {
    expect(situacaoDaLinha({ realizado: 1180, planejado: 1000, emAberto: [] }, AGORA).estado).toBe('ACIMA_DO_PLANO')
    expect(estourouOQueAvisa(1180, 1000), '18% < 20%').toBeNull()
  })

  it('⭐ 25% avisa', () => {
    const x = estourouOQueAvisa(1250, 1000)
    expect(x).not.toBeNull()
    expect(x!).toBeGreaterThan(ESTOURO_QUE_AVISA)
  })

  it('⚠️ o exemplo do dono: energia R$ 590 acima de um plano de R$ 2.000 avisa', () => {
    expect(estourouOQueAvisa(2590, 2000)).toBeCloseTo(0.295, 3)
  })
})
