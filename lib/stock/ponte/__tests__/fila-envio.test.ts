// ⭐⭐ A FILA DE ENVIO — com os 8 BOLETOS REAIS que estavam parados em 30/08/2026.
//
// ⛔ O CASO: a varredura pedida pelo dono ("confere órfãos ANTES de remover a tela")
// achou 8 boletos conferidos que NUNCA chegaram ao Contas a Pagar — R$ 21.968,02, dos
// quais R$ 6.237,26 já vencidos e R$ 2.537,29 vencendo no próprio dia. Zero órfãos e zero
// duplicatas (a dívida não estava em dois lugares), mas também não estava em NENHUM: só
// na fila do estoque. Apagar a tela sem o card teria tornado isso invisível.
//
// Estes números são o golden do card.

import { describe, it, expect } from 'vitest'
import { resumoDaFila, diasAteVencer, type ParcelaNaFila } from '../fila-envio'

/** os 8 de prod, na ordem de vencimento (valores e datas conferidos no banco) */
const OITO_REAIS: ParcelaNaFila[] = [
  { valor: 6006.45, dVenc: '2026-08-27T00:00:00.000Z' }, // FRIGORIFICO SILVA 001 — venceu
  { valor: 230.81, dVenc: '2026-08-29T00:00:00.000Z' },  // CARLOS CANCIAN — venceu
  { valor: 2537.29, dVenc: '2026-08-30T00:00:00.000Z' }, // DALMOLIN — vence HOJE
  { valor: 4138.27, dVenc: '2026-08-31T00:00:00.000Z' }, // SPAL — amanhã
  { valor: 19.0, dVenc: '2026-09-03T00:00:00.000Z' },    // ALAN
  { valor: 6006.44, dVenc: '2026-09-03T00:00:00.000Z' }, // FRIGORIFICO SILVA 002
  { valor: 2459.76, dVenc: '2026-09-04T00:00:00.000Z' }, // FOCATTO
  { valor: 570.0, dVenc: '2026-09-19T00:00:00.000Z' },   // JULIANO
]
const HOJE = new Date(2026, 7, 30) // 30/08/2026, hora local — o dia em que o dono olhou

describe('⭐⭐ o card fala o número certo (os 8 reais de 30/08)', () => {
  const r = resumoDaFila(OITO_REAIS, HOJE)

  it('⭐⭐ 8 boletos · R$ 21.968,02 — ao centavo', () => {
    expect(r.n).toBe(8)
    expect(r.total).toBe(21968.02)
  })

  it('⛔⛔ 2 VENCIDOS e 1 vencendo HOJE — é o que pinta o card de vermelho', () => {
    expect(r.vencidos).toBe(2)
    expect(r.hoje).toBe(1)
    expect(r.alerta).toBe(true)
    // 6.006,45 + 230,81 (vencidos) + 2.537,29 (hoje)
    expect(r.valorUrgente).toBe(8774.55)
  })

  it('⭐ e só os VENCIDOS somam 6.237,26 — o número que o dono precisa ver primeiro', () => {
    const soVencidos = OITO_REAIS.filter((p) => (diasAteVencer(p.dVenc, HOJE) ?? 0) < 0)
    expect(Math.round(soVencidos.reduce((s, p) => s + p.valor, 0) * 100) / 100).toBe(6237.26)
  })
})

describe('⭐ zero boletos = zero tela', () => {
  it('fila vazia não tem o que mostrar', () => {
    const r = resumoDaFila([], HOJE)
    expect(r.n).toBe(0)
    expect(r.total).toBe(0)
    expect(r.alerta).toBe(false)
  })

  it('⭐ tudo em dia NÃO fica vermelho (alarme falso é como um alarme morre)', () => {
    const r = resumoDaFila([{ valor: 100, dVenc: '2026-09-30T00:00:00.000Z' }], HOJE)
    expect(r.alerta).toBe(false)
    expect(r.valorUrgente).toBe(0)
  })
})

describe('⚠️ as bordas que já morderam neste módulo', () => {
  it('⚠️ SEM vencimento não é urgente — ausência não é atraso', () => {
    const r = resumoDaFila([{ valor: 999, dVenc: null }], HOJE)
    expect(r.n).toBe(1)
    expect(r.total).toBe(999)
    expect(r.alerta).toBe(false) // entra no total, não no vermelho
  })

  it('⚠️ o vencimento de HOJE nunca vira "vencido" por causa da HORA', () => {
    // a data vem em UTC e o dono abre a tela às 21h de Brasília: comparar INSTANTES
    // faria o boleto de hoje aparecer como vencido (ou o de amanhã como de hoje).
    const tarde = new Date(2026, 7, 30, 21, 45)
    expect(diasAteVencer('2026-08-30T00:00:00.000Z', tarde)).toBe(0)
    expect(diasAteVencer('2026-08-31T00:00:00.000Z', tarde)).toBe(1)
    expect(diasAteVencer('2026-08-29T00:00:00.000Z', tarde)).toBe(-1)
  })

  it('⚠️ data ilegível não derruba a conta (o card nunca some por dado torto)', () => {
    const r = resumoDaFila([{ valor: 50, dVenc: 'não é data' }], HOJE)
    expect(r.n).toBe(1)
    expect(r.total).toBe(50)
    expect(r.alerta).toBe(false)
  })

  it('⚠️ o relógio é PARÂMETRO — a mesma fila em outro dia dá outro rótulo, e só', () => {
    // no dia 26/08 nenhum tinha vencido ainda; nada do TOTAL muda.
    const antes = resumoDaFila(OITO_REAIS, new Date(2026, 7, 26))
    expect(antes.total).toBe(21968.02)
    expect(antes.vencidos).toBe(0)
    expect(antes.alerta).toBe(false)
  })
})
