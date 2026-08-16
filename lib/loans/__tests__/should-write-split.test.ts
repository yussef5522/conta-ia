import { describe, it, expect } from 'vitest'
import { shouldWriteSplit } from '../link-payment'

describe('shouldWriteSplit — grava o juros ao vincular (fix #2/#23, 15/08)', () => {
  // O BUG: agenda IMPORTED (POS ou PRE-importado) tem juros=0 nas OPEN →
  // validateSchedule reprova (agendaValida=false) → o split NÃO era gravado →
  // paidInterest=0 → juros escondido do DRE. Toda parcela casada pela tela nascia
  // assim. Antes do fix a regra era `agendaValida && !isPartial` → false aqui.
  it('IMPORTED + agenda inválida (juros=0 OPEN) + não-parcial → GRAVA o split (era o bug)', () => {
    expect(
      shouldWriteSplit({ scheduleSource: 'IMPORTED', isZeroRate: false, agendaValida: false, isPartial: false }),
    ).toBe(true)
  })

  it('IMPORTED + agenda válida → grava (inalterado)', () => {
    expect(
      shouldWriteSplit({ scheduleSource: 'IMPORTED', isZeroRate: false, agendaValida: true, isPartial: false }),
    ).toBe(true)
  })

  it('FÓRMULA + agenda inválida → NÃO grava (trava FASE 5.3 mantida — amort não confiável)', () => {
    expect(
      shouldWriteSplit({ scheduleSource: null, isZeroRate: false, agendaValida: false, isPartial: false }),
    ).toBe(false)
  })

  it('FÓRMULA + agenda válida → grava', () => {
    expect(
      shouldWriteSplit({ scheduleSource: 'FORMULA', isZeroRate: false, agendaValida: true, isPartial: false }),
    ).toBe(true)
  })

  it('parcial NUNCA grava split (nem IMPORTED) — não quita', () => {
    expect(
      shouldWriteSplit({ scheduleSource: 'IMPORTED', isZeroRate: false, agendaValida: true, isPartial: true }),
    ).toBe(false)
  })

  it('0% (Arafat/FLEXIBLE) SEMPRE grava (split determinístico, encargo 0)', () => {
    expect(
      shouldWriteSplit({ scheduleSource: 'FLEXIBLE', isZeroRate: true, agendaValida: false, isPartial: false }),
    ).toBe(true)
  })
})
