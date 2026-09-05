// ⛔⛔⛔ O FÓSSIL DO LEDGERBAL NO GATE DO CONFIRMAR (05/09/2026) — e o fecho da CLASSE.
//
// **CASO REAL, com os números da tela do dono:** o import do Banrisul passou pelo preview
// novo inteiro (selo, simulação, fronteira de dia) e no confirmar cuspiu
//
//     "Saldo não fechou com o banco — Calculado −R$ 5.871,14 vs LEDGERBAL −R$ 8.347,67.
//      Revise a classificação."
//
// A diferença de **R$ 2.476,53 é o bloqueio de 24h** — a mania que este projeto documenta
// desde 15/08. É a MESMA comparação removida do preview em 04/09, viva no confirm.
//
// ⚠️ E O IMPORT TINHA GRAVADO: 14 linhas entraram, status SUCCESS. O vermelho fez o dono
// achar que fora recusado e segurar o próximo import — **o alarme falso custou um dia**.

import { describe, it, expect } from 'vitest'
import {
  podeConferirPorLedgerbal, avaliarFechamentoDeSaldo, avisoSemReguaDeSaldo,
} from '../pode-conferir-por-ledgerbal'
import { resolveBankProfile } from '../registry'
import { decidirSelo } from '@/lib/ofx/selo-do-import'

const BANRISUL = resolveBankProfile('041')
const SICREDI = resolveBankProfile('748')

describe('⭐ a pergunta tem UM dono', () => {
  it('⛔⛔ Banrisul: o saldo declarado NÃO é régua (é o disponível, desconta o bloqueio)', () => {
    expect(BANRISUL?.ledgerBalReliable).toBe(false)
    expect(podeConferirPorLedgerbal(BANRISUL)).toBe(false)
  })

  it('⭐ Sicredi/Stone: é régua, como sempre foi', () => {
    expect(podeConferirPorLedgerbal(SICREDI)).toBe(true)
    expect(podeConferirPorLedgerbal(resolveBankProfile('197'))).toBe(true)
  })

  it('⚠️ banco DESCONHECIDO continua comparando — tirar o dente de todo banco novo é pior', () => {
    // a ressalva do banco desconhecido é da TELA (`decidirSelo`), não do gate de gravação
    expect(podeConferirPorLedgerbal(null)).toBe(true)
    expect(podeConferirPorLedgerbal(undefined)).toBe(true)
    expect(decidirSelo(null, false).modo, 'a tela é que avisa').toBe('SEM_CONFERENCIA')
  })
})

describe('⛔⛔ o gate do CONFIRMAR — com os números reais da tela', () => {
  it('⛔⛔ Banrisul com LEDGERBAL divergente: GRAVA, sem acusar classificação', () => {
    const r = avaliarFechamentoDeSaldo({
      ficha: BANRISUL, nomeDoBanco: 'BANRISUL',
      saldoCalculado: -5871.14, ledgerBalance: -8347.67, // os 2.476,53 = o bloqueio
    })
    expect(r.mismatch, 'voltou a acusar o bloqueio como erro de classificação').toBeNull()
    expect(r.ledgerBalMatched, 'null = "não dá pra dizer por aqui", nunca "não bateu"').toBeNull()
    expect(r.avisoSemSelo).toBeTruthy()
    expect(r.avisoSemSelo!).toMatch(/entraram normalmente/)
    expect(r.avisoSemSelo!, 'o dono precisa saber COMO conseguir o selo').toMatch(/PDF/)
    // ⚠️ e a frase não pode soar como erro — foi o vermelho que o fez achar que recusou
    expect(r.avisoSemSelo!).not.toMatch(/Revise a classificação/)
    expect(r.avisoSemSelo!).not.toMatch(/não fechou/)
  })

  it('⭐⭐ banco NORMAL com divergência de verdade: continua acusando, como hoje', () => {
    const r = avaliarFechamentoDeSaldo({
      ficha: SICREDI, nomeDoBanco: 'SICREDI', saldoCalculado: -5871.14, ledgerBalance: -8347.67,
    })
    expect(r.mismatch, 'o gate perdeu o dente no banco em que ele funciona').not.toBeNull()
    expect(r.mismatch!.diferenca).toBeCloseTo(2476.53, 2)
    expect(r.ledgerBalMatched).toBe(false)
    expect(r.avisoSemSelo).toBeNull()
  })

  it('⭐ banco normal que FECHA: selo verde e nenhum aviso', () => {
    const r = avaliarFechamentoDeSaldo({ ficha: SICREDI, saldoCalculado: -8347.67, ledgerBalance: -8347.67 })
    expect(r.mismatch).toBeNull()
    expect(r.ledgerBalMatched).toBe(true)
    expect(r.avisoSemSelo).toBeNull()
  })

  it('⭐ 2 centavos de tolerância — a de sempre, nos dois sentidos', () => {
    expect(avaliarFechamentoDeSaldo({ ficha: SICREDI, saldoCalculado: -100.02, ledgerBalance: -100 }).mismatch).toBeNull()
    expect(avaliarFechamentoDeSaldo({ ficha: SICREDI, saldoCalculado: -100.03, ledgerBalance: -100 }).mismatch).not.toBeNull()
  })

  it('⛔ arquivo SEM saldo declarado: não compara e NÃO avisa — não se avisa o que não se mediu', () => {
    const r = avaliarFechamentoDeSaldo({ ficha: BANRISUL, saldoCalculado: -5871.14, ledgerBalance: null })
    expect(r.mismatch).toBeNull()
    expect(r.ledgerBalMatched).toBeNull()
    expect(r.avisoSemSelo, 'aviso fantasma sobre um saldo que o arquivo não trouxe').toBeNull()
  })

  it('⭐ a frase do sem-selo é a mesma função em qualquer chamador (REGRA 4)', () => {
    const r = avaliarFechamentoDeSaldo({ ficha: BANRISUL, nomeDoBanco: 'BANRISUL', saldoCalculado: 1, ledgerBalance: 2 })
    expect(r.avisoSemSelo).toBe(avisoSemReguaDeSaldo('BANRISUL'))
  })
})
