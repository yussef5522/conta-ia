/**
 * ⛔⛔ O TEXTO-RESUMO QUE DESDIZIA OS CARTÕES (09/10/2026).
 *
 * **O dono:** *"«Devolvidos 40.000 e 50.000. Saldo 290.000» × cartão R$ 240.000."*
 *
 * Medido em prod: o `notes` do contrato era **verdade em 05/08** e congelou no dia em que a
 * terceira devolução entrou. Este arquivo trava a régua que o substitui — e o GUARD que o dono
 * pediu: `Σ(histórico) == principal − saldo`.
 */
import { describe, it, expect } from 'vitest'
import { resumoDoFlexivel } from '../resumo-do-flexivel'

/** ⚠️ o Intl usa espaço NÃO-QUEBRÁVEL depois do "R$" (a cicatriz de 24/09) — a comparação
 *  usa o MESMO formatador, nunca um literal escrito à mão. */
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** as três devoluções REAIS do contrato da Arafat, com as datas de prod */
const TRES = [
  { data: new Date('2026-07-06T12:00:00Z'), valor: 40000 },
  { data: new Date('2026-08-04T12:00:00Z'), valor: 50000 },
  { data: new Date('2026-09-01T12:00:00Z'), valor: 50000 },
]

describe('⭐⭐ o resumo do mútuo sai do histórico, nunca de um texto gravado', () => {
  it('⭐ o estado de hoje em prod: 380.000 · 3 devoluções · 140.000 · saldo 240.000', () => {
    const r = resumoDoFlexivel(380000, 240000, TRES)
    expect(r.devolucoes).toBe(3)
    expect(r.totalDevolvido).toBe(140000)
    expect(r.saldo).toBe(240000)
    expect(r.fecha, 'Σ(devoluções) tem que fechar com principal − saldo').toBe(true)
    expect(r.frase).toContain('3 devoluções')
    expect(r.frase).toContain(brl(140000))
    expect(r.frase).toContain(`saldo ${brl(240000)}`)
    // ⭐ a data da ÚLTIMA aparece — é a pergunta "quando eu devolvi por último?"
    expect(r.frase).toContain('01/09/26')
    // ⛔ e o número velho da nota NÃO pode aparecer em lugar nenhum
    expect(r.frase).not.toContain('290.000')
  })

  it('⭐⭐ DEPOIS da devolução de hoje: 4 devoluções · 180.000 · saldo 200.000 (o caso do dono)', () => {
    const r = resumoDoFlexivel(380000, 200000, [
      ...TRES,
      { data: new Date('2026-10-09T12:00:00Z'), valor: 40000 },
    ])
    expect(r.devolucoes).toBe(4)
    expect(r.totalDevolvido).toBe(180000)
    expect(r.saldo).toBe(200000)
    expect(r.fecha).toBe(true)
    expect(r.frase).toContain('4 devoluções')
    expect(r.frase).toContain('09/10/26')
  })

  it('⛔⛔ o GUARD morde: Σ(histórico) ≠ principal − saldo devolve `fecha: false`', () => {
    // ⚠️ é o estado que a tela precisa GRITAR em vez de escolher um dos dois números
    const r = resumoDoFlexivel(380000, 290000, TRES)
    expect(r.fecha, 'a divergência passou calada — era o defeito de hoje').toBe(false)
  })

  it('⭐ sem devolução nenhuma, DIZ isso — nunca "R$ 0,00 devolvidos" com cara de fato', () => {
    const r = resumoDoFlexivel(110000, 110000, [])
    expect(r.devolucoes).toBe(0)
    expect(r.ultima).toBeNull()
    expect(r.frase).toContain('nenhuma devolução registrada ainda')
    expect(r.fecha).toBe(true)
  })

  it('⚠️ UMA devolução fala no singular — plural errado num texto de dinheiro chama atenção pro lugar errado', () => {
    const r = resumoDoFlexivel(380000, 340000, [TRES[0]])
    expect(r.frase).toContain('1 devolução somando')
    expect(r.frase).not.toContain('1 devoluções')
  })

  it('⚠️ o degrau de 2 centavos é ruído de arredondamento, não divergência', () => {
    const r = resumoDoFlexivel(380000, 240000.01, TRES)
    expect(r.fecha).toBe(true)
  })
})
