// REGRA 1 — A HEURÍSTICA DO FITID ESCONDEU DÉBITO REAL DE EMPRÉSTIMO, DUAS VEZES.
//
// A regra "FITID == YYMMDD da própria data ⇒ é preview do Banrisul" nasceu de UM caso
// (EMPRESTIMO 4.092,02 em 11/06) e depois produziu DOIS FALSOS POSITIVOS PROVADOS:
//
//   · 13/08  EMPRESTIMO 4.092,02  FITID 260811  → tinha DEBITADO (o "SALDO NA DATA" do PDF
//            provou; o import foi bloqueado e o dono teve que contornar)
//   · 28/08  EMPRESTIMO 2.444,62  FITID 260826  → tinha DEBITADO; o LEDGERBAL do próprio
//            arquivo (-1.267,03) só fecha COM ela dentro, AO CENTAVO:
//                -9.434,99 (saldo 25/08) + 8.167,96 (26–28/08) = -1.267,03  ✓
//            Sem ela o sistema previa 1.177,59 → o gate travou com 2.444,62 de diferença.
//
// ⚠️ E o arquivo real explica a causa: TODO FITID do Banrisul tem 6 dígitos (000013,
// 242038, 928419…), e nas linhas de empréstimo o banco usa a DATA como identificador. É
// CONVENÇÃO DE ID, não marcador de previsão — a heurística lia formato de identificador
// como se fosse estado do lançamento.
//
// Quem decide se liquidou é o SALDO. A defesa por DATA (camada 1) e a por LEDGERBAL
// (camada 2) continuam; sem correspondência de saldo o gate BLOQUEIA e pergunta, que é o
// certo: avisar em vez de descartar em silêncio.

import { describe, it, expect } from 'vitest'
import { partitionFutureLines, isFutureStatementLine } from '../future-line'
import { isPreviewLine, fitidLooksLikeDate } from '@/lib/reconciliation/is-preview'

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

// as linhas REAIS do Extrato_20260828.ofx (Banrisul da Caçula)
const ARQUIVO = [
  { datePosted: d('2026-08-25'), fitid: '000013', valor: 2973.69, memo: 'OP. CREDITO C/GARANTIA' },
  { datePosted: d('2026-08-26'), fitid: '000001', valor: 3965.48, memo: 'OP. CREDITO C/GARANTIA' },
  { datePosted: d('2026-08-26'), fitid: '576308', valor: 336.32, memo: 'ANTECIP STONE' },
  { datePosted: d('2026-08-26'), fitid: '503997', valor: 244.59, memo: 'DEBITO STONE' },
  { datePosted: d('2026-08-26'), fitid: '433538', valor: -2500, memo: 'CACULA MIX' },
  // ⭐ a linha do incidente: FITID == YYMMDD da própria data
  { datePosted: d('2026-08-26'), fitid: '260826', valor: -2444.62, memo: 'EMPRESTIMO' },
  { datePosted: d('2026-08-27'), fitid: '000032', valor: 6976.93, memo: 'OP. CREDITO C/GARANTIA' },
  { datePosted: d('2026-08-27'), fitid: '190257', valor: 386.54, memo: 'ANTECIP STONE' },
  { datePosted: d('2026-08-27'), fitid: '117758', valor: 261.35, memo: 'DEBITO STONE' },
  { datePosted: d('2026-08-27'), fitid: '953621', valor: -500, memo: 'YUSSEF' },
  { datePosted: d('2026-08-27'), fitid: '992550', valor: -7000, memo: 'CACULA MIX' },
  // ⚠️ a grafia MUDA no mesmo arquivo: "OP. CREDITO" (com espaço) nos dias 25-27 e
  // "OP.CREDITO" (sem) no dia 28 — é o que quebra o match da regra aprendida.
  { datePosted: d('2026-08-28'), fitid: '016182', valor: 7549.18, memo: 'OP.CREDITO C/GARANTIA' },
  { datePosted: d('2026-08-28'), fitid: '008913', valor: 417.82, memo: 'ANTECIP STONE' },
  { datePosted: d('2026-08-28'), fitid: '008116', valor: 474.37, memo: 'DEBITO STONE' },
  // futura de verdade (data > âncora) — tem que continuar sendo descartada
  { datePosted: d('2026-09-09'), fitid: '150023', valor: -1478.51, memo: 'PAGAMENTO CONSORCIO' },
]
const ANCORA = d('2026-08-28') // DTASOF do arquivo

describe('⭐⭐ o débito de empréstimo ENTRA (era descartado em silêncio)', () => {
  it('⭐ EMPRESTIMO 2.444,62 (FITID 260826) é linha REAL, não futura', () => {
    const { realLines, futureLines } = partitionFutureLines(ARQUIVO, ANCORA)
    const emprestimo = realLines.find((l) => l.memo === 'EMPRESTIMO')
    expect(emprestimo).toBeDefined()
    expect(futureLines.find((l) => l.memo === 'EMPRESTIMO')).toBeUndefined()
  })

  it('⭐⭐ com ela dentro, o saldo fecha com o LEDGERBAL do banco AO CENTAVO', () => {
    const { realLines } = partitionFutureLines(ARQUIVO, ANCORA)
    const saldo25 = -9434.99 // o que o sistema tinha, igual ao LEDGERBAL do import anterior
    const novas = realLines.filter((l) => l.datePosted >= d('2026-08-26'))
    const soma = novas.reduce((s, l) => s + l.valor, 0)
    expect(Math.round((saldo25 + soma) * 100) / 100).toBe(-1267.03) // = LEDGERBAL do arquivo
  })

  it('⚠️ SEM o fix, o previsto dava 1.177,59 — os 2.444,62 do gate', () => {
    const semEmprestimo = ARQUIVO.filter((l) => l.memo !== 'EMPRESTIMO')
    const { realLines } = partitionFutureLines(semEmprestimo, ANCORA)
    const soma = realLines.filter((l) => l.datePosted >= d('2026-08-26')).reduce((s, l) => s + l.valor, 0)
    expect(Math.round((-9434.99 + soma) * 100) / 100).toBe(1177.59)
    expect(Math.round((1177.59 - -1267.03) * 100) / 100).toBe(2444.62)
  })

  it('o outro caso real (4.092,02 · FITID 260811 · 11/08) também entra', () => {
    const linha = { datePosted: d('2026-08-11'), fitid: '260811' }
    expect(isFutureStatementLine(linha.datePosted, d('2026-08-13'), true)).toBe(false)
    expect(isPreviewLine(linha, d('2026-08-13'))).toBe(false)
  })
})

describe('⚠️ a defesa por DATA continua de pé (não afrouxei o descarte)', () => {
  it('PAGAMENTO CONSORCIO de 09/09 (depois da âncora) segue descartado', () => {
    const { futureLines, realLines } = partitionFutureLines(ARQUIVO, ANCORA)
    expect(futureLines.map((l) => l.memo)).toEqual(['PAGAMENTO CONSORCIO'])
    expect(realLines).toHaveLength(ARQUIVO.length - 1)
  })

  it('linha futura COM fitid de data continua futura — é a data que manda', () => {
    expect(isFutureStatementLine(d('2026-09-09'), ANCORA, true)).toBe(true)
    expect(isFutureStatementLine(d('2026-09-09'), ANCORA, false)).toBe(true)
  })

  it('linha do dia da âncora não é futura por data (a camada 2 do LEDGERBAL cuida dela)', () => {
    expect(isFutureStatementLine(ANCORA, ANCORA, false)).toBe(false)
  })
})

describe('o detector de formato continua existindo — só não DECIDE mais sozinho', () => {
  it('fitidLooksLikeDate segue reconhecendo o padrão (serve de sinal/diagnóstico)', () => {
    expect(fitidLooksLikeDate('260826', d('2026-08-26'))).toBe(true)
    expect(fitidLooksLikeDate('260811', d('2026-08-11'))).toBe(true)
  })

  it('⚠️ mas reconhecer o padrão NÃO descarta mais nada', () => {
    expect(isFutureStatementLine(d('2026-08-26'), ANCORA, true)).toBe(false)
  })

  it('FITID que não é data segue não casando (o detector não ficou frouxo)', () => {
    expect(fitidLooksLikeDate('000013', d('2026-08-25'))).toBe(false)
    expect(fitidLooksLikeDate('928419', d('2026-08-25'))).toBe(false)
  })
})
