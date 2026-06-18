// Sprint Empréstimos AI/Contrato (17/06/2026) — testes.
//
// Fixture: contrato real Banrisul BBH 002100057538834 (SAC CDI CAR).
// Oráculo: campos extraídos validados contra o contrato impresso fornecido
// pelo Yussef no enunciado da sprint.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  extractContract,
  normalizeExtraction,
  ContractExtractError,
  type ContractExtraction,
} from '@/lib/loans/contract-extract'
import {
  generateMidLifeSchedule,
  recalcOnConciliate,
} from '@/lib/loans/mid-life-schedule'

const D = (s: string) => new Date(s + 'T00:00:00.000Z')

// ============================================================================
// 1) FIXTURE — JSON que simula o que o Claude retornaria pro contrato Banrisul
// ============================================================================
const FIXTURE_BANRISUL = {
  bank: 'Banrisul',
  contractNumber: '002100057538834',
  amortizationSystem: 'SAC',
  rateType: 'POS',
  indexer: 'CDI',
  indexerPercent: 100,
  principal: 130000,
  valorFinanciado: 134807.03,
  iof: 3199.03,
  tarifas: 1608.0,
  taxaPreMensal: 0.0035,
  nParcelas: 76,
  parcelasPagas: 55,
  parcelasAPagar: 21,
  primeiraParcela: '2021-11-26',
  vencimentoFinal: '2028-02-26',
  diaVencimento: 26,
  saldoDevedorAtual: 40295.17,
  amortizacaoConstante: 1898.69,
  carencia: 5,
  parcelasAPagarLista: [
    { number: 56, dueDate: '2026-06-26', payment: 2519.02 },
    { number: 57, dueDate: '2026-07-26', payment: 2451.18 },
    { number: 58, dueDate: '2026-08-26', payment: 2456.08 },
    { number: 59, dueDate: '2026-09-26', payment: 2429.25 },
    { number: 60, dueDate: '2026-10-26', payment: 2330.98 },
    { number: 61, dueDate: '2026-11-26', payment: 2357.34 },
    { number: 62, dueDate: '2026-12-26', payment: 2318.17 },
    { number: 63, dueDate: '2027-01-26', payment: 2276.34 },
    { number: 64, dueDate: '2027-02-26', payment: 2276.97 },
    { number: 65, dueDate: '2027-03-26', payment: 2217.34 },
    { number: 66, dueDate: '2027-04-26', payment: 2177.93 },
    { number: 67, dueDate: '2027-05-26', payment: 2196.17 },
    { number: 68, dueDate: '2027-06-26', payment: 2161.91 },
    { number: 69, dueDate: '2027-07-26', payment: 2110.58 },
    { number: 70, dueDate: '2027-08-26', payment: 2112.13 },
    { number: 71, dueDate: '2027-09-26', payment: 2067.1 },
    { number: 72, dueDate: '2027-10-26', payment: 2033.86 },
    { number: 73, dueDate: '2027-11-26', payment: 2012.54 },
    { number: 74, dueDate: '2027-12-26', payment: 1981.71 },
    { number: 75, dueDate: '2028-01-26', payment: 1957.36 },
    { number: 76, dueDate: '2028-02-26', payment: 1930.15 },
  ],
  warnings: [],
}

const ORACULO = {
  contractNumber: '002100057538834',
  banco: 'Banrisul',
  sistema: 'SAC',
  rateType: 'POS',
  indexer: 'CDI',
  indexerPercent: 100,
  saldoDevedorAtual: 40295.17,
  parcelasPagas: 55,
  parcelasAPagar: 21,
  amortizacaoConstante: 1898.69,
  taxaPreMensal: 0.0035,
  diaVencimento: 26,
  iof: 3199.03,
  tarifas: 1608.0,
  carencia: 5,
  nParcelas: 76,
} as const

// ============================================================================
// 2) Validação campo-a-campo da extração contra o oráculo
// ============================================================================
describe('Sprint AI/Contrato — extractContract com fixture Banrisul (oráculo)', () => {
  it('normaliza fixture FIEL ao oráculo', () => {
    const extracted = normalizeExtraction(FIXTURE_BANRISUL)
    expect(extracted.contractNumber).toBe(ORACULO.contractNumber)
    expect(extracted.bank).toBe(ORACULO.banco)
    expect(extracted.amortizationSystem).toBe(ORACULO.sistema)
    expect(extracted.rateType).toBe(ORACULO.rateType)
    expect(extracted.indexer).toBe(ORACULO.indexer)
    expect(extracted.indexerPercent).toBe(ORACULO.indexerPercent)
    expect(extracted.saldoDevedorAtual).toBeCloseTo(ORACULO.saldoDevedorAtual, 2)
    expect(extracted.parcelasPagas).toBe(ORACULO.parcelasPagas)
    expect(extracted.parcelasAPagar).toBe(ORACULO.parcelasAPagar)
    expect(extracted.amortizacaoConstante).toBeCloseTo(ORACULO.amortizacaoConstante, 2)
    expect(extracted.taxaPreMensal).toBeCloseTo(ORACULO.taxaPreMensal, 6)
    expect(extracted.diaVencimento).toBe(ORACULO.diaVencimento)
    expect(extracted.iof).toBeCloseTo(ORACULO.iof, 2)
    expect(extracted.tarifas).toBeCloseTo(ORACULO.tarifas, 2)
    expect(extracted.carencia).toBe(ORACULO.carencia)
    expect(extracted.nParcelas).toBe(ORACULO.nParcelas)
    expect(extracted.parcelasAPagarLista).toHaveLength(21)
    expect(extracted.parcelasAPagarLista[0].number).toBe(56)
    expect(extracted.parcelasAPagarLista[0].dueDate).toBe('2026-06-26')
    expect(extracted.parcelasAPagarLista[20].number).toBe(76)
  })

  it('total das parcelas a pagar bate ~R$ 46.374,11 (parcelas) e saldo ~R$ 40.295,17 (descontos aplicados)', () => {
    const total = FIXTURE_BANRISUL.parcelasAPagarLista.reduce((s, p) => s + p.payment, 0)
    expect(total).toBeCloseTo(46374.11, 2)
  })

  it('extractContract chama Claude API e parseia resposta JSON (fetcher injetável)', async () => {
    const mockFetch = async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          content: [{ type: 'text', text: JSON.stringify(FIXTURE_BANRISUL) }],
        }),
      }) as unknown as Response
    // PDF "válido" com header %PDF-
    const bytes = new TextEncoder().encode('%PDF-1.4\n%dummy\n')
    const result = await extractContract(bytes, {
      fetch: mockFetch as typeof fetch,
      apiKey: 'fake-key',
    })
    expect(result.contractNumber).toBe(ORACULO.contractNumber)
    expect(result.saldoDevedorAtual).toBeCloseTo(ORACULO.saldoDevedorAtual, 2)
  })

  it('respeita backticks ```json …``` na resposta do Claude', async () => {
    const mockFetch = async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          content: [
            {
              type: 'text',
              text: '```json\n' + JSON.stringify(FIXTURE_BANRISUL) + '\n```',
            },
          ],
        }),
      }) as unknown as Response
    const bytes = new TextEncoder().encode('%PDF-1.4\n')
    const result = await extractContract(bytes, {
      fetch: mockFetch as typeof fetch,
      apiKey: 'fake',
    })
    expect(result.parcelasPagas).toBe(55)
  })

  it('PDF inválido (sem header) → erro PDF_INVALID', async () => {
    const bytes = new TextEncoder().encode('lorem ipsum')
    await expect(extractContract(bytes, { apiKey: 'fake' })).rejects.toBeInstanceOf(
      ContractExtractError,
    )
  })

  it('PDF encriptado → erro PDF_ENCRYPTED', async () => {
    const bytes = new TextEncoder().encode('%PDF-1.4 /Encrypt foo')
    await expect(extractContract(bytes, { apiKey: 'fake' })).rejects.toMatchObject({
      code: 'PDF_ENCRYPTED',
    })
  })

  it('resposta não-JSON → erro JSON_PARSE_ERROR', async () => {
    const mockFetch = async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({ content: [{ type: 'text', text: 'desculpa, não consegui' }] }),
      }) as unknown as Response
    const bytes = new TextEncoder().encode('%PDF-1.4\n')
    await expect(
      extractContract(bytes, { fetch: mockFetch as typeof fetch, apiKey: 'fake' }),
    ).rejects.toMatchObject({ code: 'JSON_PARSE_ERROR' })
  })
})

// ============================================================================
// 3) generateMidLifeSchedule — só parcelas futuras
// ============================================================================
describe('Sprint AI/Contrato — generateMidLifeSchedule (em andamento)', () => {
  it('Banrisul SAC: saldo R$ 40.295,17 + 21 futuras + amort R$ 1.898,69 → última zera', () => {
    const sch = generateMidLifeSchedule({
      outstandingBalance: 40295.17,
      rateMonthly: 0.0035,
      futureCount: 21,
      startNumber: 56,
      firstDueDate: D('2026-06-26'),
      system: 'SAC',
      amortizationConstant: 1898.69,
      isPostFixed: true,
    })
    expect(sch).toHaveLength(21)
    expect(sch[0].number).toBe(56)
    expect(sch[20].number).toBe(76)
    expect(sch[0].openingBalance).toBeCloseTo(40295.17, 2)
    // Última parcela: amortização ajusta pra zerar saldo
    expect(sch[20].closingBalance).toBe(0)
    // Cada parcela isEstimate=true porque é pós-fixado
    expect(sch.every((r) => r.isEstimate)).toBe(true)
  })

  it('SUM(amortizations) === outstandingBalance EXATO (sem perda de centavo)', () => {
    const sch = generateMidLifeSchedule({
      outstandingBalance: 40295.17,
      rateMonthly: 0.0035,
      futureCount: 21,
      startNumber: 56,
      firstDueDate: D('2026-06-26'),
      system: 'SAC',
      amortizationConstant: 1898.69,
      isPostFixed: true,
    })
    const sumAmort = sch.reduce((s, r) => Math.round((s + r.amortization) * 100) / 100, 0)
    expect(sumAmort).toBe(40295.17)
  })

  it('PRE-fixado: correcao=0; juros = saldo * taxaPre', () => {
    const sch = generateMidLifeSchedule({
      outstandingBalance: 10000,
      rateMonthly: 0.02,
      futureCount: 5,
      startNumber: 11,
      firstDueDate: D('2026-07-01'),
      system: 'SAC',
      amortizationConstant: 2000,
      isPostFixed: false,
    })
    expect(sch[0].correcao).toBe(0)
    expect(sch[0].interest).toBeCloseTo(200, 2) // 10000 * 0.02
    expect(sch.every((r) => !r.isEstimate)).toBe(true)
  })

  it('startNumber preserva continuidade (55 pagas + 1 futura começa em 56)', () => {
    const sch = generateMidLifeSchedule({
      outstandingBalance: 10000,
      rateMonthly: 0.01,
      futureCount: 3,
      startNumber: 56,
      firstDueDate: D('2026-06-26'),
      system: 'SAC',
      amortizationConstant: 3333.33,
    })
    expect(sch.map((r) => r.number)).toEqual([56, 57, 58])
  })

  it('throws com inputs inválidos', () => {
    expect(() =>
      generateMidLifeSchedule({
        outstandingBalance: 0,
        rateMonthly: 0.01,
        futureCount: 3,
        startNumber: 1,
        firstDueDate: D('2026-07-01'),
        system: 'SAC',
      }),
    ).toThrow(/outstandingBalance/)
  })
})

// ============================================================================
// 4) recalcOnConciliate — pós-fixado vira valor real
// ============================================================================
describe('Sprint AI/Contrato — recalcOnConciliate (valor real do debito)', () => {
  it('parcela #56 Banrisul: opening=40295,17 amort=1898,69 taxa=0,35% real=2519,02', () => {
    const r = recalcOnConciliate({
      openingBalance: 40295.17,
      amortization: 1898.69,
      rateMonthly: 0.0035,
      realPayment: 2519.02,
    })
    // juros = 40295,17 * 0,0035 = 141,03
    expect(r.interest).toBeCloseTo(141.03, 1)
    // correcao = realPayment - amort - juros = 2519,02 - 1898,69 - 141,03 ≈ 479,30
    expect(r.correcao).toBeCloseTo(479.3, 1)
    // DRE: despesa financeira = juros + correcao
    expect(r.loanInterestSplit).toBeCloseTo(620.33, 1)
    // saldo cai pela amortização (independe do realPayment)
    expect(r.closingBalance).toBeCloseTo(38396.48, 2)
  })

  it('DRE conta juros+correcao; amortização fora', () => {
    const r = recalcOnConciliate({
      openingBalance: 10000,
      amortization: 2000,
      rateMonthly: 0.02,
      realPayment: 2350,
    })
    // juros = 10000 * 0.02 = 200
    // correcao = 2350 - 2000 - 200 = 150
    expect(r.interest).toBe(200)
    expect(r.correcao).toBe(150)
    expect(r.loanInterestSplit).toBe(350)
    expect(r.closingBalance).toBe(8000)
  })

  it('parcela com correcao NEGATIVA (CDI caiu, parcela < estimativa)', () => {
    const r = recalcOnConciliate({
      openingBalance: 10000,
      amortization: 2000,
      rateMonthly: 0.02,
      realPayment: 2150, // menor que estimativa
    })
    expect(r.correcao).toBeCloseTo(-50, 2) // correção negativa
    expect(r.loanInterestSplit).toBeCloseTo(150, 2)
  })
})

// ============================================================================
// 5) Schema + migration + endpoint presence
// ============================================================================
describe('Sprint AI/Contrato — schema + integração', () => {
  const ROOT = join(__dirname, '..')

  it('Migration adiciona rateType/indexer/outstandingBalanceInitial + isEstimate/correcao/realPayment', () => {
    const sql = readFileSync(
      join(ROOT, 'prisma/migrations/20260625000000_loans_ai_contrato/migration.sql'),
      'utf-8',
    )
    expect(sql).toMatch(/"rateType"\s+TEXT/)
    expect(sql).toMatch(/"indexer"\s+TEXT/)
    expect(sql).toMatch(/"outstandingBalanceInitial"\s+DOUBLE/)
    expect(sql).toMatch(/"trackingStartDate"\s+TIMESTAMP/)
    expect(sql).toMatch(/"amortizationConstant"\s+DOUBLE/)
    expect(sql).toMatch(/"isEstimate"\s+BOOLEAN/)
    expect(sql).toMatch(/"correcao"\s+DOUBLE/)
    expect(sql).toMatch(/"realPayment"\s+DOUBLE/)
  })

  it('schema.prisma define os campos novos', () => {
    const schema = readFileSync(join(ROOT, 'prisma/schema.prisma'), 'utf-8')
    expect(schema).toMatch(/outstandingBalanceInitial\s+Float\?/)
    expect(schema).toMatch(/amortizationConstant\s+Float\?/)
    expect(schema).toMatch(/isEstimate\s+Boolean/)
    expect(schema).toMatch(/correcao\s+Float/)
    expect(schema).toMatch(/realPayment\s+Float\?/)
  })

  it('Endpoint /extrair-contrato existe + multipart', () => {
    const code = readFileSync(
      join(ROOT, 'app/api/empresas/[id]/emprestimos/extrair-contrato/route.ts'),
      'utf-8',
    )
    expect(code).toMatch(/export async function POST/)
    expect(code).toMatch(/extractContract/)
    expect(code).toMatch(/formData/)
  })

  it('POST /emprestimos suporta modo EM_ANDAMENTO via Zod union', () => {
    const code = readFileSync(
      join(ROOT, 'app/api/empresas/[id]/emprestimos/route.ts'),
      'utf-8',
    )
    expect(code).toMatch(/createMidLifeSchema/)
    expect(code).toMatch(/generateMidLifeSchedule/)
    expect(code).toMatch(/outstandingBalanceInitial/)
    expect(code).toMatch(/installmentsPaidBefore/)
    expect(code).toMatch(/trackingStartDate/)
    expect(code).toMatch(/futureCount/)
  })

  it('autoConciliarParcelas honra isEstimate (recalcula realPayment)', () => {
    const code = readFileSync(join(ROOT, 'lib/loans/auto-conciliacao.ts'), 'utf-8')
    expect(code).toMatch(/isEstimate/)
    expect(code).toMatch(/realPayment/)
    expect(code).toMatch(/correcao/)
    expect(code).toMatch(/openingBalance \* loan\.interestRateMonthly/)
  })

  it('DRE enrichment soma interest + correcao', () => {
    const code = readFileSync(join(ROOT, 'lib/loans/dre-enrichment.ts'), 'utf-8')
    expect(code).toMatch(/correcao/)
    expect(code).toMatch(/i\.interest \+ \(i\.correcao/)
  })
})

// ============================================================================
// 6) UI presence — banner em andamento + upload PDF + destaque saldo
// ============================================================================
describe('Sprint AI/Contrato — UI', () => {
  const ROOT = join(__dirname, '..')

  it('Página /novo tem upload PDF + extração AI + tabs NOVO/EM_ANDAMENTO', () => {
    const code = readFileSync(
      join(ROOT, 'app/(dashboard)/empresas/[id]/emprestimos/novo/page.tsx'),
      'utf-8',
    )
    expect(code).toMatch(/handleUploadPdf/)
    expect(code).toMatch(/extrair-contrato/)
    expect(code).toMatch(/EM_ANDAMENTO/)
    expect(code).toMatch(/Saldo devedor ATUAL/)
    expect(code).toMatch(/Confira antes de salvar/)
    expect(code).toMatch(/aiExtracting/)
    expect(code).toMatch(/aiWarnings/)
  })

  it('Banner amarelo "em andamento" com aviso sobre SALDO + TAXA', () => {
    const code = readFileSync(
      join(ROOT, 'app/(dashboard)/empresas/[id]/emprestimos/novo/page.tsx'),
      'utf-8',
    )
    expect(code).toMatch(/em andamento entra pelo/i)
    expect(code).toMatch(/saldo devedor atual/i)
    expect(code).toMatch(/parcelas já pagas/i)
  })

  it('Campo saldo devedor atual com destaque visual (border-primary)', () => {
    const code = readFileSync(
      join(ROOT, 'app/(dashboard)/empresas/[id]/emprestimos/novo/page.tsx'),
      'utf-8',
    )
    expect(code).toMatch(/outstandingBalanceInitial/)
    expect(code).toMatch(/border-primary\/50/)
  })
})

// ============================================================================
// 7) Type guards — ContractExtraction
// ============================================================================
describe('Sprint AI/Contrato — type safety', () => {
  it('ContractExtraction tem todos os campos do oráculo', () => {
    const ex: ContractExtraction = {
      bank: null, contractNumber: null, amortizationSystem: null,
      rateType: null, indexer: null, indexerPercent: null,
      dataContratacao: null, dataLiberacao: null,
      principal: null, valorFinanciado: null, iof: null, tarifas: null,
      taxaPreMensal: null, nParcelas: null, parcelasPagas: null,
      parcelasAPagar: null, primeiraParcela: null, vencimentoFinal: null,
      diaVencimento: null, saldoDevedorAtual: null, amortizacaoConstante: null,
      carencia: null, parcelasAPagarLista: [], warnings: [],
    }
    // Compile-time check only — corre se o tipo bate
    expect(ex.parcelasAPagarLista).toEqual([])
  })
})
