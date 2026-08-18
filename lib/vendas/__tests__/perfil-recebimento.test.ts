import { describe, it, expect } from 'vitest'
import { feriadosNacionais, diaUTC } from '../feriados-nacionais'
import { isDiaUtil, isFimDeSemana, voltarDiasUteis } from '../dias-uteis'
import { resolveRegraRecebimento } from '../perfil-recebimento'
import { buildCaculaDefaultRegras, CACULA_IDS } from '../seed-cacula'

const D = (iso: string) => new Date(iso + 'T12:00:00Z')

describe('feriados nacionais bancários', () => {
  const f = feriadosNacionais(2026)
  it('fixos de 2026 (incl. Consciência Negra 20/11)', () => {
    for (const dia of ['2026-01-01', '2026-04-21', '2026-05-01', '2026-09-07', '2026-11-20', '2026-12-25'])
      expect(f.has(dia)).toBe(true)
  })
  it('móveis de 2026 (Páscoa 05/04): Sexta Santa 03/04, Carnaval 16-17/02, Corpus Christi 04/06', () => {
    expect(f.has('2026-04-03')).toBe(true) // Sexta-feira Santa
    expect(f.has('2026-02-16')).toBe(true) // Carnaval seg
    expect(f.has('2026-02-17')).toBe(true) // Carnaval ter
    expect(f.has('2026-06-04')).toBe(true) // Corpus Christi
  })
  it('dia normal NÃO é feriado', () => {
    expect(f.has('2026-08-17')).toBe(false)
  })
})

describe('dias úteis (datas reais de agosto/2026)', () => {
  const f2026 = feriadosNacionais(2026)
  it('sáb 15 e dom 16/08 são fim de semana; seg 17 é útil', () => {
    expect(isFimDeSemana(D('2026-08-15'))).toBe(true)
    expect(isFimDeSemana(D('2026-08-16'))).toBe(true)
    expect(isDiaUtil(D('2026-08-17'), f2026)).toBe(true)
  })
  it('01/05 (feriado) não é dia útil', () => {
    expect(isDiaUtil(D('2026-05-01'), f2026)).toBe(false)
  })
  it('voltar 1 dia útil de seg 17/08 → sex 14/08 (pula fim de semana)', () => {
    expect(diaUTC(voltarDiasUteis(D('2026-08-17'), 1, f2026))).toBe('2026-08-14')
  })
  it('voltar 1 dia útil de seg 04/05 → qui 30/04 (pula sáb/dom + feriado 01/05)', () => {
    // 01/05/2026 = sexta (Dia do Trabalho). 02-03 fim de semana. 04 = segunda.
    expect(diaUTC(voltarDiasUteis(D('2026-05-04'), 1, f2026))).toBe('2026-04-30')
  })
})

describe('resolveRegraRecebimento — vigência (bug dos dois mundos Tuna)', () => {
  const regras = buildCaculaDefaultRegras(CACULA_IDS)

  it('Sicredi PIX em 14/08 (pós-Tuna) → D+1, sem fim de semana, CONFIRMADO', () => {
    const r = resolveRegraRecebimento(regras, CACULA_IDS.sicrediId, 'PIX', D('2026-08-14'))
    expect(r).toMatchObject({ diasUteisAtraso: 1, recebeSabDom: false, confirmado: true })
  })
  it('Stone PIX em 15/08 (sáb) → D+0, RECEBE fim de semana, confirmado', () => {
    const r = resolveRegraRecebimento(regras, CACULA_IDS.stoneId, 'PIX', D('2026-08-15'))
    expect(r).toMatchObject({ diasUteisAtraso: 0, recebeSabDom: true, confirmado: true })
  })
  it('Sicredi PIX ANTES de 12/08 (10/08) → DEFAULT + flag não-confirmado (a tela não olha antes)', () => {
    const r = resolveRegraRecebimento(regras, CACULA_IDS.sicrediId, 'PIX', D('2026-08-10'))
    expect(r.confirmado).toBe(false)
  })
  it('conta/meio sem regra → DEFAULT D+1 + flag', () => {
    const r = resolveRegraRecebimento(regras, 'conta-desconhecida', 'PIX', D('2026-08-14'))
    expect(r).toMatchObject({ diasUteisAtraso: 1, recebeSabDom: false, confirmado: false })
  })
  it('Banrisul CARTAO em 17/08 → D+1, sem fim de semana, confirmado (OP.CREDITO incluso)', () => {
    const r = resolveRegraRecebimento(regras, CACULA_IDS.banrisulId, 'CARTAO', D('2026-08-17'))
    expect(r).toMatchObject({ diasUteisAtraso: 1, recebeSabDom: false, confirmado: true })
  })
  it('Cofre DINHEIRO → D+1 mas recebeSabDom=true (dia corrido, sem bloco)', () => {
    const r = resolveRegraRecebimento(regras, CACULA_IDS.cofreId, 'DINHEIRO', D('2026-08-16'))
    expect(r).toMatchObject({ diasUteisAtraso: 1, recebeSabDom: true, confirmado: true })
  })
})
