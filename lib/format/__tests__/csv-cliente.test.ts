// CSV do cliente — o dialeto que o Excel-pt-BR abre sem perguntar nada.
import { describe, it, expect } from 'vitest'
import { montarCsv } from '../csv-cliente'

describe('montarCsv', () => {
  it('usa ; como separador e aspas em tudo', () => {
    const csv = montarCsv(['A', 'B'], [['x', 'y']])
    expect(csv).toContain('"A";"B"')
    expect(csv).toContain('"x";"y"')
  })
  it('começa com BOM (sem ele o Excel come os acentos)', () => {
    expect(montarCsv(['Ação'], [])[0]).toBe('﻿')
  })
  it('número vira decimal pt-BR (vírgula)', () => {
    expect(montarCsv(['V'], [[1234.56]])).toContain('"1234,56"')
  })
  it('escapa aspas dentro do texto', () => {
    expect(montarCsv(['N'], [['diz "oi"']])).toContain('"diz ""oi"""')
  })
  it('null vira célula vazia (não a string "null")', () => {
    expect(montarCsv(['N'], [[null]])).toContain('""')
    expect(montarCsv(['N'], [[null]])).not.toContain('null')
  })
  it('quebra linha com CRLF', () => {
    expect(montarCsv(['A'], [['x']])).toContain('\r\n')
  })
})
