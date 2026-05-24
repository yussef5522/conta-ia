// Sprint 4.0.3 — testes da função pura classifyAlertas.

import { describe, it, expect } from 'vitest'
import { classifyAlertas } from '@/lib/dashboard/alertas'

const today = new Date('2026-05-24T00:00:00Z')
const daysFromNow = (n: number) =>
  new Date(today.getTime() + n * 24 * 60 * 60 * 1000)

describe('classifyAlertas', () => {
  it('vazio → todos zeros', () => {
    const r = classifyAlertas([], today)
    expect(r.vencidas.count).toBe(0)
    expect(r.vencendoEm3Dias.count).toBe(0)
    expect(r.vencendoSemana.count).toBe(0)
    expect(r.total.count).toBe(0)
  })

  it('tx ontem (dueDate < hoje) → vencida', () => {
    const r = classifyAlertas(
      [{ id: '1', amount: 100, dueDate: daysFromNow(-1) }],
      today,
    )
    expect(r.vencidas.count).toBe(1)
    expect(r.vencidas.total).toBe(100)
    expect(r.vencendoEm3Dias.count).toBe(0)
  })

  it('tx hoje → vencendo em 3 dias (não vencida)', () => {
    const r = classifyAlertas(
      [{ id: '1', amount: 200, dueDate: today }],
      today,
    )
    expect(r.vencidas.count).toBe(0)
    expect(r.vencendoEm3Dias.count).toBe(1)
    expect(r.vencendoEm3Dias.total).toBe(200)
  })

  it('tx em 2 dias → vencendo em 3 dias', () => {
    const r = classifyAlertas(
      [{ id: '1', amount: 300, dueDate: daysFromNow(2) }],
      today,
    )
    expect(r.vencendoEm3Dias.count).toBe(1)
  })

  it('tx em 4 dias → vencendo na semana', () => {
    const r = classifyAlertas(
      [{ id: '1', amount: 500, dueDate: daysFromNow(4) }],
      today,
    )
    expect(r.vencendoEm3Dias.count).toBe(0)
    expect(r.vencendoSemana.count).toBe(1)
    expect(r.vencendoSemana.total).toBe(500)
  })

  it('tx em 7 dias → vencendo na semana', () => {
    const r = classifyAlertas(
      [{ id: '1', amount: 500, dueDate: daysFromNow(7) }],
      today,
    )
    expect(r.vencendoSemana.count).toBe(1)
  })

  it('tx em 8+ dias → conta no total mas não nas categorias', () => {
    const r = classifyAlertas(
      [{ id: '1', amount: 1_000, dueDate: daysFromNow(15) }],
      today,
    )
    expect(r.vencidas.count).toBe(0)
    expect(r.vencendoEm3Dias.count).toBe(0)
    expect(r.vencendoSemana.count).toBe(0)
    expect(r.total.count).toBe(1)
    expect(r.total.total).toBe(1_000)
  })

  it('mix completo', () => {
    const r = classifyAlertas(
      [
        { id: '1', amount: 100, dueDate: daysFromNow(-2) }, // vencida
        { id: '2', amount: 200, dueDate: daysFromNow(1) }, // 3d
        { id: '3', amount: 300, dueDate: daysFromNow(5) }, // semana
        { id: '4', amount: 50, dueDate: daysFromNow(-10) }, // vencida antiga
      ],
      today,
    )
    expect(r.vencidas.count).toBe(2)
    expect(r.vencidas.total).toBe(150)
    expect(r.vencendoEm3Dias.count).toBe(1)
    expect(r.vencendoEm3Dias.total).toBe(200)
    expect(r.vencendoSemana.count).toBe(1)
    expect(r.vencendoSemana.total).toBe(300)
    expect(r.total.count).toBe(4)
    expect(r.total.total).toBe(650)
  })

  it('dueDate null é ignorado', () => {
    const r = classifyAlertas(
      [{ id: '1', amount: 999, dueDate: null }],
      today,
    )
    expect(r.total.count).toBe(0)
  })
})
