import { describe, it, expect } from 'vitest'
import { computeCompetencia } from '../compute-competencia'
import { feriadosNacionais, diaUTC } from '../feriados-nacionais'
import { buildCaculaDefaultRegras, CACULA_IDS, CACULA_PERFIL_VIGENTE_DE } from '../seed-cacula'

const F = feriadosNacionais(2026)
const REGRAS = buildCaculaDefaultRegras(CACULA_IDS)
const INICIO = CACULA_PERFIL_VIGENTE_DE // 12/08
const E = (iso: string) => new Date(iso + 'T12:00:00Z') // dataEntrada (dinheiro entrou)
const comp = (dataIso: string, acc: string, meio: any, opts: any = {}) =>
  computeCompetencia(E(dataIso), acc, meio, REGRAS, F, { moduleInicio: INICIO, ...opts })
const iv = (c: any) => `${diaUTC(c.inicio!)}..${diaUTC(c.fim!)}`

describe('computeCompetencia — casos REAIS de agosto (uma função)', () => {
  it('cartão Banrisul 17/08 (seg) → bloco {14..16}', () => {
    const c = comp('2026-08-17', CACULA_IDS.banrisulId, 'CARTAO')
    expect(iv(c)).toBe('2026-08-14..2026-08-16')
    expect(c.isBloco).toBe(true)
  })
  it('cartão Banrisul 13/08 (qui) → 12/08 (dia único)', () => {
    const c = comp('2026-08-13', CACULA_IDS.banrisulId, 'CARTAO')
    expect(iv(c)).toBe('2026-08-12..2026-08-12')
    expect(c.isBloco).toBe(false)
  })
  it('Sicredi Tuna 14/08 (sex) → 13/08', () => {
    expect(iv(comp('2026-08-14', CACULA_IDS.sicrediId, 'PIX'))).toBe('2026-08-13..2026-08-13')
  })
  it('Sicredi Tuna 17/08 x3 → 14, 15, 16 em ordem (split, cada um dia único)', () => {
    const dias = [0, 1, 2].map((ordinal) =>
      diaUTC(comp('2026-08-17', CACULA_IDS.sicrediId, 'PIX', { ordinal, totalNoDia: 3 }).inicio!),
    )
    expect(dias).toEqual(['2026-08-14', '2026-08-15', '2026-08-16'])
    const c0 = comp('2026-08-17', CACULA_IDS.sicrediId, 'PIX', { ordinal: 0, totalNoDia: 3 })
    expect(c0.isSplit).toBe(true)
    expect(c0.isBloco).toBe(false)
  })
  it('Sicredi Tuna 17/08 x1 → bloco {14..16} SEM divisão', () => {
    const c = comp('2026-08-17', CACULA_IDS.sicrediId, 'PIX', { ordinal: 0, totalNoDia: 1 })
    expect(iv(c)).toBe('2026-08-14..2026-08-16')
    expect(c.isSplit).toBe(false)
    expect(c.isBloco).toBe(true)
  })
  it('Stone Pix|Maquininha 15/08 (sáb) → 15/08 (D+0)', () => {
    expect(iv(comp('2026-08-15', CACULA_IDS.stoneId, 'PIX'))).toBe('2026-08-15..2026-08-15')
  })
  it('cofre 15/08 (sáb) → 14/08 · 16/08 (dom) → 15/08 · 17/08 (seg) → 16/08 (D+1 corrido, sem bloco)', () => {
    expect(iv(comp('2026-08-15', CACULA_IDS.cofreId, 'DINHEIRO'))).toBe('2026-08-14..2026-08-14')
    expect(iv(comp('2026-08-16', CACULA_IDS.cofreId, 'DINHEIRO'))).toBe('2026-08-15..2026-08-15')
    const seg = comp('2026-08-17', CACULA_IDS.cofreId, 'DINHEIRO')
    expect(iv(seg)).toBe('2026-08-16..2026-08-16')
    expect(seg.isBloco).toBe(false)
  })
  it('data sem regra vigente (conta desconhecida) → default + flag não-confirmado', () => {
    const c = comp('2026-08-14', 'conta-fantasma', 'PIX')
    expect(c.fora).toBe(false)
    expect(c.confirmado).toBe(false) // default assumido → a tela avisa
    expect(iv(c)).toBe('2026-08-13..2026-08-13') // D+1 default
  })
  it('data ANTES de 12/08 → fora (não computa)', () => {
    const c = comp('2026-08-10', CACULA_IDS.sicrediId, 'PIX')
    expect(c.fora).toBe(true)
    expect(c.inicio).toBeNull() // fora
  })
  it('bônus — terça após feriado segunda → bloco {sex..seg} (generaliza o bloco)', () => {
    // Feriado fictício na segunda 04/05/2026? 01/05 (sex) já é feriado. Uso ter 05/05:
    // 01/05 sex=feriado, 02-03 fim de semana, 04 seg útil, 05 ter.
    // cartão D+1 em 05/05 (ter) → volta 1 útil = 04/05 (seg); bloco só {04} (04 é útil, sem não-úteis após).
    // Pra ter {sex..seg} preciso de feriado NA segunda. Uso a real: não há em agosto.
    // Então testo o mecanismo com 04/05 (seg, 1º útil após 01/05 feriado + fim de semana):
    const c = computeCompetencia(new Date('2026-05-04T12:00:00Z'), CACULA_IDS.banrisulId, 'CARTAO', REGRAS, F, { moduleInicio: new Date('2026-01-01') })
    // volta 1 útil de seg 04/05 = qui 30/04 (pula 01/05 fer, 02-03 fds); estende até dom 03/05
    expect(iv(c)).toBe('2026-04-30..2026-05-03')
  })
})
