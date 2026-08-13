// Sprint Contraparte-Banrisul FASE 4 (13/08) — REGRA 3: os 8 casos que o Yussef
// listou. Executa o join/preview reais (não grep). O Nível 2 (data+valor) é do
// Banrisul; Sicredi/Stone (FITID estável) NÃO entram.

import { describe, it, expect } from 'vitest'
import { joinPdfStatement, type JoinTxInput } from '../join-pdf-statement'
import { buildEnrichmentPreview, type EnrichTx } from '../build-preview'
import { banrisulPdfParser } from '@/lib/bank-statement-pdf/banrisul-parser'
import { resolveBankProfile } from '@/lib/bank-profiles/registry'
import type { BankStatementLine } from '@/lib/bank-statement-pdf/types'

const pdfLine = (o: Partial<BankStatementLine>): BankStatementLine => ({
  day: 3, historico: 'PIX ENVIADO', documento: '000000', amount: 100, signed: -100,
  counterpartyName: null, date: null, ...o,
})
const jtx = (o: Partial<JoinTxInput>): JoinTxInput => ({
  id: 't', externalId: null, amount: 100, description: 'PIX ENVIADO',
  counterpartySource: null, counterpartyName: null, dateIso: '2026-08-03', ...o,
})

describe('1) FITID casa → usa FITID (preferencial)', () => {
  it('documento==externalId → matchKey FITID', () => {
    const r = joinPdfStatement(
      [pdfLine({ documento: 'ABC123', amount: 1215, counterpartyName: 'MARCOS', date: '2026-08-03' })],
      [jtx({ id: 't1', externalId: 'ABC123', amount: -1215, dateIso: '2026-08-03' })],
      { altKey: true },
    )
    expect(r.exact).toHaveLength(1)
    expect(r.exact[0]).toMatchObject({ txId: 't1', counterpartyName: 'MARCOS', matchKey: 'FITID' })
  })
})

describe('2) FITID não casa mas data+valor casa único → Nível 2', () => {
  it('externalId diferente (renumerou) → casa por data+valor, matchKey DATE_AMOUNT', () => {
    const r = joinPdfStatement(
      [pdfLine({ documento: '198074', amount: 1215, counterpartyName: 'MARCOS', date: '2026-08-03' })],
      // FITID do OFX (dl11) != documento do PDF (dl07): não casa por FITID
      [jtx({ id: 't1', externalId: '999999', amount: -1215, dateIso: '2026-08-03' })],
      { altKey: true },
    )
    expect(r.exact).toHaveLength(1)
    expect(r.exact[0]).toMatchObject({ txId: 't1', counterpartyName: 'MARCOS', matchKey: 'DATE_AMOUNT' })
  })
})

describe('3) 2 candidatas iguais → AMBÍGUO, não preenche', () => {
  it('mesma data+valor com 2 nomes → ambíguo (nenhum exact)', () => {
    const r = joinPdfStatement(
      [
        pdfLine({ documento: '000000', amount: 139.9, counterpartyName: 'FULANO', date: '2026-08-09' }),
        pdfLine({ documento: '000000', amount: 139.9, counterpartyName: 'BELTRANO', date: '2026-08-09' }),
      ],
      [jtx({ id: 'a', externalId: 'x', amount: -139.9, dateIso: '2026-08-09', description: 'PIX RECEBIDO' })],
      { altKey: true },
    )
    expect(r.exact).toHaveLength(0)
    expect(r.ambiguous).toHaveLength(1)
    expect(r.ambiguous[0].via).toBe('DATE_AMOUNT')
  })
  it('mesma data+valor com 2 TX (1 nome) → ambíguo (qual tx?)', () => {
    const r = joinPdfStatement(
      [pdfLine({ documento: 'x', amount: 500, counterpartyName: 'FULANO', date: '2026-08-05' })],
      [
        jtx({ id: 'a', externalId: 'p', amount: -500, dateIso: '2026-08-05' }),
        jtx({ id: 'b', externalId: 'q', amount: -500, dateIso: '2026-08-05' }),
      ],
      { altKey: true },
    )
    expect(r.exact).toHaveLength(0)
    expect(r.ambiguous[0].txIds.sort()).toEqual(['a', 'b'])
  })
})

describe('4) nome MANUAL → não sobrescreve', () => {
  it('counterpartySource MANUAL fica protegido (nem FITID nem Nível 2 tocam)', () => {
    const r = joinPdfStatement(
      [pdfLine({ documento: '198074', amount: 1215, counterpartyName: 'MARCOS', date: '2026-08-03' })],
      [jtx({ id: 't1', externalId: '999999', amount: -1215, dateIso: '2026-08-03', counterpartySource: 'MANUAL', counterpartyName: 'EU PUS NA MAO' })],
      { altKey: true },
    )
    expect(r.exact).toHaveLength(0)
    expect(r.noMatchTxIds).not.toContain('t1')
  })
})

describe('7) Sicredi/Stone → Nível 2 DESLIGADO (idêntico a hoje)', () => {
  it('altKey=false: a mesma tx que casaria por data+valor NÃO casa', () => {
    const r = joinPdfStatement(
      [pdfLine({ documento: '198074', amount: 1215, counterpartyName: 'MARCOS', date: '2026-08-03' })],
      [jtx({ id: 't1', externalId: '999999', amount: -1215, dateIso: '2026-08-03' })],
      { altKey: false },
    )
    expect(r.exact).toHaveLength(0)
    expect(r.noMatchTxIds).toContain('t1')
  })
  it('o perfil de banco decide: Banrisul=PER_DOWNLOAD (liga), Sicredi/Stone=estável (não liga)', () => {
    expect(resolveBankProfile('041')!.fitidStability).toBe('PER_DOWNLOAD')
    expect(resolveBankProfile('748')!.fitidStability).not.toBe('PER_DOWNLOAD')
    expect(resolveBankProfile('197')!.fitidStability).toBe('STABLE')
  })
})

describe('5+6) buckets: fora do período e não-elegível não contam como "sem match"', () => {
  // PDF cobre 03-05/08. Tx: 1 casa (03/08), 1 fora do período (jul), 1 IOF (não-elegível).
  const text = [
    'AGENCIA: 0230',
    'CONTA..: 0605534106',
    'PERÍODO: 03/08/2026 a 05/08/2026',
    'DIA HISTORICO           DOCUMENTO        V A L O R',
    '03   PIX ENVIADO        198074            1.215,00-',
    '      NOME: MARCOS ADRIEL',
  ].join('\n')
  const parsed = banrisulPdfParser.parse(text)
  const txs: EnrichTx[] = [
    { id: 'casa', externalId: '999', amount: 1215, date: new Date('2026-08-03T12:00:00Z'), description: 'PIX ENVIADO', type: 'DEBIT', counterpartyName: null, counterpartySource: null },
    { id: 'fora', externalId: '888', amount: 300, date: new Date('2026-07-10T12:00:00Z'), description: 'PIX ENVIADO', type: 'DEBIT', counterpartyName: null, counterpartySource: null },
    { id: 'iof', externalId: '777', amount: 2.07, date: new Date('2026-08-04T12:00:00Z'), description: 'IOF', type: 'DEBIT', counterpartyName: null, counterpartySource: null },
  ]
  const p = buildEnrichmentPreview(parsed, txs, { altKey: true })

  it('5) a de julho conta como FORA DO PERÍODO (não sem-match), e sugere o mês', () => {
    expect(p.counts.outOfPeriod).toBe(1)
    expect(p.outOfPeriodMonths).toEqual([{ month: '2026-07', count: 1 }])
  })
  it('6) o IOF conta como NÃO SE APLICA (nunca terá contraparte)', () => {
    expect(p.counts.notApplicable).toBe(1)
  })
  it('2) a de agosto casa pelo Nível 2 (data+valor)', () => {
    expect(p.counts.willReceive).toBe(1)
    expect(p.counts.exactByDateAmount).toBe(1)
    expect(p.exact[0]).toMatchObject({ txId: 'casa', proposedName: 'MARCOS ADRIEL', matchKey: 'DATE_AMOUNT' })
  })
  it('período e progresso vêm no payload', () => {
    expect(p.period).toEqual({ start: '2026-08-03', end: '2026-08-05' })
    expect(p.progress.totalEligible).toBe(2) // casa + fora (IOF não é elegível)
    expect(p.progress.named).toBe(0)
  })
})

describe('8) fim-a-fim: PDF (layout Banrisul) + OFX com FITID renumerado', () => {
  it('8 PIX ENVIADO casam por data+valor quando o FITID não bate', () => {
    const pdf = [
      'AGENCIA: 0230',
      'CONTA..: 0605534106',
      'PERÍODO: 04/08/2026 a 08/08/2026',
      'DIA HISTORICO           DOCUMENTO        V A L O R',
      '04   PIX ENVIADO        100001            5.000,00-',
      '      NOME: ALUGUEL IMOVEIS LTDA',
      '05   PIX ENVIADO        100002            3.500,00-',
      '      NOME: FORNECEDOR A',
      '06   PIX ENVIADO        100003            2.000,00-',
      '      NOME: FORNECEDOR B',
    ].join('\n')
    const parsed = banrisulPdfParser.parse(pdf)
    // OFX com FITID DIFERENTE (renumerado) — só data+valor casa
    const txs: EnrichTx[] = [
      { id: 'o1', externalId: 'ZZ1', amount: 5000, date: new Date('2026-08-04T00:00:00Z'), description: 'PIX ENVIADO', type: 'DEBIT', counterpartyName: null, counterpartySource: null },
      { id: 'o2', externalId: 'ZZ2', amount: 3500, date: new Date('2026-08-05T00:00:00Z'), description: 'PIX ENVIADO', type: 'DEBIT', counterpartyName: null, counterpartySource: null },
      { id: 'o3', externalId: 'ZZ3', amount: 2000, date: new Date('2026-08-06T00:00:00Z'), description: 'PIX ENVIADO', type: 'DEBIT', counterpartyName: null, counterpartySource: null },
    ]
    const p = buildEnrichmentPreview(parsed, txs, { altKey: true })
    expect(p.counts.willReceive).toBe(3)
    expect(p.counts.exactByDateAmount).toBe(3)
    const aluguel = p.exact.find((e) => e.txId === 'o1')
    expect(aluguel!.proposedName).toBe('ALUGUEL IMOVEIS LTDA') // o aluguel que virava "retirada"
  })
})
