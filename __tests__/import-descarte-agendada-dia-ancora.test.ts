// REGRA 3 — executa o pipeline REAL contra o arquivo REAL (fixture
// Extrato_20260811.ofx do Banrisul, importado 11/08 01:05).
//
// BUG (11/08): a linha PAGAMENTO CONSORCIO -1.478,51 tem data 11/08 IGUAL à
// âncora (DTASOF/DTEND 11/08). A CAMADA 1 (data, critério `> âncora`) NÃO a
// pega — ela passa como "real" e é OFERTADA no import. O banco emitiu o
// extrato às 01h já listando o débito que só liquida às ~9h; por isso o
// LEDGERBAL (-781,08) NÃO a inclui. Só o SALDO declarado revela que não
// liquidou. A CAMADA 2 (reconciliação contra o LEDGERBAL) pega.
//
// Prova VERMELHO→VERDE:
//   - CAMADA 1 sozinha: consórcio fica em realLines (data não resolve). [documenta]
//   - CAMADA 2: reclassifica o consórcio como AGENDADA; saldoPos == LEDGERBAL.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseOFX } from '@/lib/ofx/parser'
import {
  partitionFutureLines,
  settledThroughDate,
  reconcileLedgerAnchorDay,
  type LedgerReconcileLine,
} from '@/lib/ofx/future-line'
import { buildV2PreviewPayload, buildLedgerBalCheck } from '@/lib/ofx/preview-v2'

const FIXTURE = join(__dirname, 'fixtures', 'Extrato_20260811.ofx')
const raw = readFileSync(FIXTURE, 'utf-8')

function signed(t: { type: string; amount: number }): number {
  return t.type === 'CREDIT' ? t.amount : -t.amount
}

describe('Import Banrisul 11/08 — linha agendada do DIA DA ÂNCORA (CAMADA 2)', () => {
  const parsed = parseOFX(raw)
  const anchor = settledThroughDate(parsed.ledgerBalance!.asOfDate, parsed.statementEnd)!

  it('a fixture tem DTASOF/DTEND 11/08, LEDGERBAL -781,08 e o consórcio -1.478,51 em 11/08', () => {
    expect(parsed.ledgerBalance!.amount).toBeCloseTo(-781.08, 2)
    expect(anchor.toISOString().slice(0, 10)).toBe('2026-08-11')
    const consorcio = parsed.transactions.find((t) => t.memo.includes('CONSORCIO'))
    expect(consorcio).toBeTruthy()
    expect(signed(consorcio!)).toBeCloseTo(-1478.51, 2)
    expect(consorcio!.datePosted.toISOString().slice(0, 10)).toBe('2026-08-11')
  })

  it('CAMADA 1 (data) NÃO pega o consórcio (data == âncora) — mas pega o 17/08', () => {
    const lines = parsed.transactions.map((t) => ({
      datePosted: t.datePosted,
      fitid: t.fitid,
      memo: t.memo,
    }))
    const { realLines, futureLines } = partitionFutureLines(lines, anchor)
    // o 17/08 (PAGAMENTO CARTAO) é futuro por data → descartado
    expect(futureLines.some((l) => l.memo.includes('CARTAO'))).toBe(true)
    // o consórcio 11/08 ESCAPA da CAMADA 1 (é o bug que a CAMADA 2 resolve)
    expect(realLines.some((l) => l.memo.includes('CONSORCIO'))).toBe(true)
    expect(futureLines.some((l) => l.memo.includes('CONSORCIO'))).toBe(false)
  })

  it('CAMADA 2 reclassifica o consórcio como AGENDADA e zera a diferença', () => {
    // Linhas novas = as reais (≤ âncora). Reproduz o cenário real: TUDO liquidou
    // menos o consórcio → balanceAtual escolhido pra isolar essa única pendência.
    const anchorDay = anchor.toISOString().slice(0, 10)
    const realTx = parsed.transactions.filter(
      (t) => t.datePosted.toISOString().slice(0, 10) <= anchorDay,
    )
    const newLines: LedgerReconcileLine[] = realTx.map((t, i) => ({
      key: `${i}:${t.memo}`,
      type: t.type as 'CREDIT' | 'DEBIT',
      amount: t.amount,
      datePosted: t.datePosted,
    }))
    const ledgerBalance = parsed.ledgerBalance!.amount // -781.08
    // balanceAtual tal que só o consórcio não fecha:
    // saldoPos(sem consórcio) = balanceAtual + Σ(reais menos consórcio) = LEDGERBAL
    const sumSemConsorcio = realTx
      .filter((t) => !t.memo.includes('CONSORCIO'))
      .reduce((s, t) => s + signed(t), 0)
    const balanceAtual = Math.round((ledgerBalance - sumSemConsorcio) * 100) / 100

    const res = reconcileLedgerAnchorDay({ newLines, balanceAtual, ledgerBalance, anchor })

    expect(res.resolved).toBe(true)
    expect(res.ambiguous).toBe(false)
    expect(res.scheduledKeys).toHaveLength(1)
    expect(res.scheduledKeys[0]).toContain('CONSORCIO')

    // depois de remover a agendada, saldoPos fecha com o LEDGERBAL
    const scheduled = new Set(res.scheduledKeys)
    const saldoPos =
      balanceAtual +
      newLines.filter((l) => !scheduled.has(l.key)).reduce((s, l) => s + signed(l), 0)
    expect(Math.round(saldoPos * 100) / 100).toBeCloseTo(ledgerBalance, 2)
  })

  it('quando TUDO fecha, CAMADA 2 não agenda nada', () => {
    const anchorDay = anchor.toISOString().slice(0, 10)
    const realTx = parsed.transactions.filter(
      (t) => t.datePosted.toISOString().slice(0, 10) <= anchorDay,
    )
    const newLines: LedgerReconcileLine[] = realTx.map((t, i) => ({
      key: `${i}`,
      type: t.type as 'CREDIT' | 'DEBIT',
      amount: t.amount,
      datePosted: t.datePosted,
    }))
    const ledgerBalance = parsed.ledgerBalance!.amount
    const sumTudo = realTx.reduce((s, t) => s + signed(t), 0)
    const balanceAtual = Math.round((ledgerBalance - sumTudo) * 100) / 100 // fecha exato

    const res = reconcileLedgerAnchorDay({ newLines, balanceAtual, ledgerBalance, anchor })
    expect(res.resolved).toBe(true)
    expect(res.scheduledKeys).toHaveLength(0)
  })

  it('diferença que NÃO bate com o dia da âncora → não chuta (residual preservado)', () => {
    const anchor2 = anchor
    const newLines: LedgerReconcileLine[] = [
      // única linha do dia da âncora vale -1.478,51
      { key: 'consorcio', type: 'DEBIT', amount: 1478.51, datePosted: anchor2 },
    ]
    // diff artificial de 999,99 (não bate com o consórcio)
    const balanceAtual = 0
    const saldoPos = balanceAtual + -1478.51
    const ledgerBalance = saldoPos + 999.99
    const res = reconcileLedgerAnchorDay({ newLines, balanceAtual, ledgerBalance, anchor: anchor2 })
    expect(res.resolved).toBe(false)
    expect(res.ambiguous).toBe(false)
    expect(res.scheduledKeys).toHaveLength(0)
    expect(Math.abs(res.residualDiff)).toBeGreaterThan(0.02)
  })

  it('ambiguidade (2 linhas iguais somam a diferença) → não escolhe sozinho', () => {
    const d = anchor
    const newLines: LedgerReconcileLine[] = [
      { key: 'a', type: 'DEBIT', amount: 100, datePosted: d },
      { key: 'b', type: 'DEBIT', amount: 100, datePosted: d },
    ]
    const balanceAtual = 0
    // saldoPos = -200; queremos target = -100 (uma das duas não liquidou) → ambíguo
    const ledgerBalance = -100
    const res = reconcileLedgerAnchorDay({ newLines, balanceAtual, ledgerBalance, anchor: d })
    expect(res.resolved).toBe(false)
    expect(res.ambiguous).toBe(true)
    expect(res.scheduledKeys).toHaveLength(0)
    expect(res.anchorDayKeys).toEqual(['a', 'b'])
  })
})

describe('Preview V2 — buildV2PreviewPayload remove o consórcio e fecha o saldo', () => {
  const parsed = parseOFX(raw)
  const anchor = settledThroughDate(parsed.ledgerBalance!.asOfDate, parsed.statementEnd)!
  const anchorDay = anchor.toISOString().slice(0, 10)

  // Linhas reais (≤ âncora) — mesmo recorte que a rota passa (novasReais).
  const realTx = parsed.transactions.filter(
    (t) => t.datePosted.toISOString().slice(0, 10) <= anchorDay,
  )
  const ledgerBalance = parsed.ledgerBalance! // -781.08
  const sumSemConsorcio = realTx
    .filter((t) => !t.memo.includes('CONSORCIO'))
    .reduce((s, t) => s + (t.type === 'CREDIT' ? t.amount : -t.amount), 0)
  const contaBalance = Math.round((ledgerBalance.amount - sumSemConsorcio) * 100) / 100

  const novas = realTx.map((t, i) => ({ ...t, dedupHash: `hash-${i}-${t.memo}` }))

  it('VERMELHO→VERDE: consórcio sai das novasGenuinas → agendadasDiaAncora; saldo bate', () => {
    const payload = buildV2PreviewPayload({
      novas,
      totalArquivo: parsed.transactions.length,
      duplicadasHashLegado: 0,
      errosParser: [],
      banco: null,
      contaId: 'conta-x',
      candidates: [], // nada pré-existente → tudo vira novaGenuina antes da CAMADA 2
      contaBalance,
      ledgerBalance,
      anchor,
    })

    // o consórcio NÃO está mais na lista que seria importada
    expect(
      payload.classificacao.novasGenuinas.some((n) => n.memo.includes('CONSORCIO')),
    ).toBe(false)
    // ele está na seção de agendadas do dia da âncora
    expect(payload.agendadasDiaAncora).toHaveLength(1)
    expect(payload.agendadasDiaAncora[0].memo).toContain('CONSORCIO')
    expect(payload.agendadasDiaAncora[0].signedAmount).toBeCloseTo(-1478.51, 2)
    // o saldo previsto agora FECHA com o LEDGERBAL (diff 0)
    expect(payload.ledgerBalCheck.bate).toBe(true)
    expect(Math.abs(payload.ledgerBalCheck.diff)).toBeLessThanOrEqual(0.02)
  })
})

describe('Diagnóstico — anchor-day é "agendada do dia", NUNCA "duplicata"', () => {
  const asOf = new Date('2026-08-11T00:00:00.000Z')

  const nova = (over: Partial<{ ofxIndex: number; amount: number; type: 'CREDIT' | 'DEBIT'; memo: string; date: string }>) => ({
    ofxIndex: over.ofxIndex ?? 0,
    amount: over.amount ?? 1478.51,
    date: over.date ?? '2026-08-11T00:00:00.000Z',
    memo: over.memo ?? 'PAGAMENTO CONSORCIO',
    type: over.type ?? ('DEBIT' as const),
    fitid: 'f',
    dedupHash: `h${over.ofxIndex ?? 0}`,
  })

  it('com agendadaDiaAncora, a hipótese líder é agendada_dia_ancora (não dup_marcada_nova)', () => {
    // saldoPos = 0 + (-1478.51) = -1478.51; LEDGERBAL = -781.08 → diff = +697.43...
    // pra o teste do diagnóstico basta ter diff != 0 e o suspeito anchor-day.
    const check = buildLedgerBalCheck({
      ledgerBalance: { amount: -781.08, asOfDate: asOf },
      balanceAtual: 0,
      novasGenuinas: [nova({})],
      conciliatePayable: [],
      agendadaDiaAncora: { ambiguous: false, suspeitos: [0] },
    })
    expect(check.bate).toBe(false)
    const lider = check.hipoteses.find((h) => h.maisProvavel)
    expect(lider?.tipo).toBe('agendada_dia_ancora')
    // a hipótese de duplicata existe mas NÃO é a líder
    const dup = check.hipoteses.find((h) => h.tipo === 'dup_marcada_nova')
    expect(dup?.maisProvavel).toBe(false)
  })

  // BUG 12/08 (4ª vez que o diagnóstico chuta): caso Stone 70k. 6 novas CREDIT
  // somam +70000, LEDGERBAL == balanceAtual (banco não mudou) → diff = -70000.
  // Não é agendada do dia (nenhuma linha de 70k). É "todas as novas somam a
  // diferença" (transferências internas).
  it('Stone 70k: diff == Σ(novas) e LEDGERBAL==balanceAtual → lidera todas_novas_transferencia, NÃO agendada', () => {
    const seis = [6000, 1000, 41000, 10000, 6000, 6000].map((amt, i) =>
      nova({ ofxIndex: i, amount: amt, type: 'CREDIT', memo: 'YUSSEF - Transferencia | Pix' }),
    )
    const check = buildLedgerBalCheck({
      ledgerBalance: { amount: 105.5, asOfDate: asOf },
      balanceAtual: 105.5,
      novasGenuinas: seis,
      conciliatePayable: [],
      // NÃO passa agendadaDiaAncora (o fix upstream não seta quando não explica)
    })
    expect(check.bate).toBe(false)
    expect(Math.round(check.diff)).toBe(-70000)
    const lider = check.hipoteses.find((h) => h.maisProvavel)
    expect(lider?.tipo).toBe('todas_novas_transferencia')
    // NÃO pode acusar agendada nem duplicata
    expect(check.hipoteses.find((h) => h.tipo === 'agendada_dia_ancora')).toBeUndefined()
    expect(check.hipoteses.find((h) => h.tipo === 'dup_marcada_nova')?.maisProvavel).toBe(false)
  })

  it('quando NENHUMA hipótese explica → lidera causa_desconhecida (admite, não chuta)', () => {
    // balanceAtual 1000 + Σnovas 200 = 1200; LEDGERBAL 1500 → diff +300.
    // 300 não bate com nenhuma nova (200/... ), não é futura, LEDGERBAL≠balanceAtual.
    const check = buildLedgerBalCheck({
      ledgerBalance: { amount: 1500, asOfDate: asOf },
      balanceAtual: 1000,
      novasGenuinas: [nova({ ofxIndex: 0, amount: 200, type: 'CREDIT' })],
      conciliatePayable: [],
    })
    expect(check.bate).toBe(false)
    const lider = check.hipoteses.find((h) => h.maisProvavel)
    expect(lider?.tipo).toBe('causa_desconhecida')
    expect(lider?.label).toContain('Não identifiquei a causa')
  })
})
