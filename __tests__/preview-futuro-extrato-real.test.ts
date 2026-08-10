// Sprint Preview-Futuro (09/08/2026) — Regra 1 + Regra 3 (COMPORTAMENTAL).
//
// REGRESSÃO real: o preview do import (OFX) oferecia 4 linhas AGENDADAS
// (10/08 ×2, 11/08, 17/08 = −15.398,28) e ainda concluía "divergência
// histórica". Causa: o descarte de futuro só rodava no CONFIRM; o preview não.
//
// Este teste RODA o pipeline real do preview (parseOFX → partitionFutureLines →
// buildV2PreviewPayload) contra o arquivo REAL Extrato_20260809.ofx — não é grep
// de string. Prova: 4 futuras fora + saldo bate; e reproduz o diagnóstico ERRADO
// de antes (vermelho) quando as futuras entram.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseOFX, type OFXTransaction } from '@/lib/ofx/parser'
import { partitionFutureLines } from '@/lib/ofx/future-line'
import { buildV2PreviewPayload } from '@/lib/ofx/preview-v2'
import { dedupHashOFX } from '@/lib/ofx/dedup'

const raw = readFileSync(join(__dirname, 'fixtures', 'Extrato_20260809.ofx'), 'utf8')
const HOJE = new Date('2026-08-09T18:00:00Z') // DTSERVER do arquivo
const signed = (t: OFXTransaction) => (t.type === 'CREDIT' ? t.amount : -t.amount)
const r2 = (n: number) => Math.round(n * 100) / 100

describe('#regressão preview descarta futuro (Extrato_20260809 REAL)', () => {
  const { transactions, ledgerBalance } = parseOFX(raw)
  const dtAsOf = ledgerBalance!.asOfDate
  const novas = transactions.map((t) => ({ ...t, dedupHash: dedupHashOFX(t) }))
  const { realLines, futureLines } = partitionFutureLines(novas, dtAsOf, HOJE)
  const futurasSum = r2(futureLines.reduce((s, t) => s + signed(t), 0))
  // balance tal que as REAIS fecham exatamente no LEDGERBAL (−6.178,45)
  const balanceAtual = r2(ledgerBalance!.amount - realLines.reduce((s, t) => s + signed(t), 0))

  it('LEDGERBAL do arquivo = −6.178,45 em 09/08 (âncora)', () => {
    expect(r2(ledgerBalance!.amount)).toBe(-6178.45)
    expect(dtAsOf.toISOString().slice(0, 10)).toBe('2026-08-09')
  })

  it('separa as 4 agendadas (10, 11, 17/08 = −15.398,28) — fora das importáveis', () => {
    expect(futureLines).toHaveLength(4)
    expect(futureLines.map((f) => f.datePosted.toISOString().slice(0, 10)).sort()).toEqual([
      '2026-08-10',
      '2026-08-10',
      '2026-08-11',
      '2026-08-17',
    ])
    expect(futurasSum).toBe(-15398.28)
    expect(realLines.every((t) => t.datePosted.toISOString().slice(0, 10) <= '2026-08-09')).toBe(true)
  })

  it('FIX: só com as reais o saldo previsto BATE com o LEDGERBAL', () => {
    const payload = buildV2PreviewPayload({
      novas: realLines,
      totalArquivo: transactions.length,
      duplicadasHashLegado: 0,
      errosParser: [],
      banco: null,
      contaId: 'c',
      candidates: [],
      contaBalance: balanceAtual,
      ledgerBalance,
      futurasSum,
    })
    expect(payload.ledgerBalCheck.bate).toBe(true)
    // nenhuma futura na lista oferecida
    expect(payload.classificacao.novasGenuinas.length).toBe(realLines.length)
  })

  it('VERMELHO ANTES DO FIX: com as futuras dentro, diagnóstico aponta "agendadas", não "histórico"', () => {
    // Reproduz a rota ANTIGA: passava TODAS as linhas ao preview (futuras inclusas).
    const payload = buildV2PreviewPayload({
      novas,
      totalArquivo: transactions.length,
      duplicadasHashLegado: 0,
      errosParser: [],
      banco: null,
      contaId: 'c',
      candidates: [],
      contaBalance: balanceAtual,
      ledgerBalance,
      futurasSum, // o cruzamento (novo); antes do fix esta hipótese não existia → vermelho
    })
    expect(payload.ledgerBalCheck.bate).toBe(false)
    const maisProvavel = payload.ledgerBalCheck.hipoteses.find((h) => h.maisProvavel)
    // ANTES: "Balance pré-existente diverge... histórico" era a mais provável → falha.
    expect(maisProvavel?.label ?? '').toMatch(/futuro|agendado/i)
  })
})
