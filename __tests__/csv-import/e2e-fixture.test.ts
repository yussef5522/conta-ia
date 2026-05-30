// Sprint CSV Import (30/05/2026) — Testes E2E processando a fixture
// anonimizada (50 linhas representativas).
//
// Cobre o fluxo COMPLETO: arquivo .csv → parseCsv → isCaculaHeader →
// mapearCacula → CaculaMappedRow[] + stats. Sem mock — usa a fixture
// real versionada em __tests__/fixtures/cacula-formato-anon.csv.
//
// Cenários cobertos:
// - 3 status (PAGO, VENCE HOJE, VENCIDO)
// - Categoria suja com "( R$ X,XX )"
// - Multi-categoria (2 cats e 4 cats)
// - Acentos preservados (GONÇALVES, GRÁFICAS)
// - Edge PAGO sem paymentDate → PAYABLE defensivo
// - Aritmética: EFFECTED + PAYABLE = total geral

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseCsv } from '@/lib/csv-import/parse-csv'
import { isCaculaHeader } from '@/lib/csv-import/detect-cacula'
import { mapearCacula } from '@/lib/csv-import/map-cacula'

const FIXTURE_PATH = resolve(
  __dirname,
  '../fixtures/cacula-formato-anon.csv',
)
const TEXT = readFileSync(FIXTURE_PATH, 'utf8')

describe('CSV Import E2E — fixture anonimizada cacula-formato-anon.csv', () => {
  const parsed = parseCsv(TEXT)
  const result = mapearCacula(parsed)

  it('parseCsv detecta separador ";"', () => {
    expect(parsed.separator).toBe(';')
  })

  it('isCaculaHeader retorna true (fixture usa formato CACULA exato)', () => {
    expect(isCaculaHeader(parsed.headers)).toBe(true)
  })

  it('Total: 50 linhas processadas', () => {
    expect(result.stats.total).toBe(50)
  })

  it('Unidade detectada como CACULA MIX ANON', () => {
    expect(result.unidadeArquivo).toBe('CACULA MIX ANON')
  })

  it('Zero erros de parse na fixture', () => {
    expect(result.stats.comErros).toBe(0)
  })

  it('Cobre os 3 status: PAGO, VENCE HOJE, VENCIDO', () => {
    const statuses = new Set(result.rows.map((r) => r.rawStatus))
    expect(statuses.has('PAGO')).toBe(true)
    expect(statuses.has('VENCE HOJE')).toBe(true)
    expect(statuses.has('VENCIDO')).toBe(true)
  })
})

describe('CSV Import E2E — distribuição lifecycle', () => {
  const result = mapearCacula(parseCsv(TEXT))

  it('Linhas PAGO+pagamento = EFFECTED', () => {
    const pagoComData = result.rows.filter(
      (r) => r.rawStatus === 'PAGO' && r.rawPagamento !== null,
    )
    expect(pagoComData.every((r) => r.lifecycle === 'EFFECTED')).toBe(true)
  })

  it('Linhas VENCE HOJE = PAYABLE com pagamento null', () => {
    const venceHoje = result.rows.filter((r) => r.rawStatus === 'VENCE HOJE')
    expect(venceHoje.length).toBeGreaterThan(0)
    expect(venceHoje.every((r) => r.lifecycle === 'PAYABLE')).toBe(true)
    expect(venceHoje.every((r) => r.pagamento === null)).toBe(true)
  })

  it('Linhas VENCIDO = PAYABLE com pagamento null', () => {
    const vencidos = result.rows.filter((r) => r.rawStatus === 'VENCIDO')
    expect(vencidos.length).toBeGreaterThan(0)
    expect(vencidos.every((r) => r.lifecycle === 'PAYABLE')).toBe(true)
    expect(vencidos.every((r) => r.pagamento === null)).toBe(true)
  })

  it('Edge PAGO sem paymentDate → PAYABLE defensivo + precisaRevisar', () => {
    const pagoSemData = result.rows.find(
      (r) => r.rawStatus === 'PAGO' && r.rawPagamento === null,
    )
    expect(pagoSemData).toBeDefined()
    expect(pagoSemData!.lifecycle).toBe('PAYABLE') // defensivo
    expect(pagoSemData!.pagamento).toBeNull()
    expect(pagoSemData!.precisaRevisar).toBe(true)
    expect(pagoSemData!.motivosRevisar.join(' ')).toContain('PAGO sem data')
  })

  it('NUNCA cria PAYABLE com paymentDate preenchida (guard R$ 939k)', () => {
    for (const r of result.rows) {
      if (r.lifecycle === 'PAYABLE') {
        expect(r.pagamento).toBeNull()
      }
    }
  })
})

describe('CSV Import E2E — categorias sujas e multi', () => {
  const result = mapearCacula(parseCsv(TEXT))

  it('categoria "MATERIAL ESCRITORIO ( R$ 180,00 );" foi limpa', () => {
    const row = result.rows.find((r) => r.rawCategoria?.includes('MATERIAL ESCRITORIO'))
    expect(row).toBeDefined()
    expect(row!.categoriaLimpa).toBe('MATERIAL ESCRITORIO')
    expect(row!.categoriaLimpa).not.toContain('R$')
  })

  it('multi-categoria 2 cats marcadas pra revisão', () => {
    const multi2 = result.rows.filter(
      (r) => r.temMultiplasCategorias && r.contagemCategorias === 2,
    )
    expect(multi2.length).toBeGreaterThanOrEqual(2)
    for (const r of multi2) {
      expect(r.precisaRevisar).toBe(true)
      expect(r.motivosRevisar.join(' ')).toContain('Múltiplas categorias')
    }
  })

  it('caso especial: 4 categorias (linha 10010 da fixture)', () => {
    const cat4 = result.rows.find((r) => r.contagemCategorias === 4)
    expect(cat4).toBeDefined()
    expect(cat4!.temMultiplasCategorias).toBe(true)
    expect(cat4!.precisaRevisar).toBe(true)
    expect(cat4!.todasCategorias.length).toBe(4)
  })

  it('NUNCA usa valor embutido na categoria — só TOTAL (linha 10014: TOTAL -2.500,24 vs cat R$ 2.500,25)', () => {
    const divergente = result.rows.find((r) => r.rawId === '10014')
    expect(divergente).toBeDefined()
    expect(divergente!.valor).toBe(2500.24) // do TOTAL
    expect(divergente!.valor).not.toBe(2500.25) // NÃO da categoria
  })

  it('categoria limpa "-" → string vazia', () => {
    const rowSemCat = result.rows.find((r) => r.rawCategoria === null)
    if (rowSemCat) {
      expect(rowSemCat.categoriaLimpa).toBe('')
    }
  })
})

describe('CSV Import E2E — descrição e acentos', () => {
  const result = mapearCacula(parseCsv(TEXT))

  it('acentos preservados: "GONÇALVES SERVIÇOS"', () => {
    const goncalves = result.rows.find((r) =>
      r.rawFavorecido?.includes('GONÇALVES'),
    )
    expect(goncalves).toBeDefined()
    expect(goncalves!.rawFavorecido).toContain('Ç')
  })

  it('acentos em categoria: "PRESTAÇÃO DE SERVIÇOS"', () => {
    const presta = result.rows.find((r) =>
      r.categoriaLimpa.includes('PRESTAÇÃO'),
    )
    expect(presta).toBeDefined()
    expect(presta!.categoriaLimpa).toContain('ÇÃ')
  })

  it('descrição combinada quando DESCRICAO ≠ "-"', () => {
    const comDescricao = result.rows.find(
      (r) => r.rawDescricao && r.rawDescricao.includes(' — '),
    )
    expect(comDescricao).toBeDefined()
  })

  it('descrição só CREDOR quando DESCRICAO="-"', () => {
    const semDescricao = result.rows.find(
      (r) =>
        r.rawDescricao !== null &&
        !r.rawDescricao.includes(' — ') &&
        r.rawDescricao === r.rawFavorecido,
    )
    expect(semDescricao).toBeDefined()
  })
})

describe('CSV Import E2E — aritmética', () => {
  const result = mapearCacula(parseCsv(TEXT))

  it('soma EFFECTED + PAYABLE = soma TOTAL', () => {
    const totalEff = result.rows
      .filter((r) => r.lifecycle === 'EFFECTED')
      .reduce((s, r) => s + r.valor, 0)
    const totalPay = result.rows
      .filter((r) => r.lifecycle === 'PAYABLE')
      .reduce((s, r) => s + r.valor, 0)
    const total = result.rows.reduce((s, r) => s + r.valor, 0)
    expect(Math.abs(totalEff + totalPay - total)).toBeLessThan(0.01)
  })

  it('todos os valores são positivos (Math.abs)', () => {
    for (const r of result.rows) {
      expect(r.valor).toBeGreaterThanOrEqual(0)
    }
  })

  it('rawValor preserva sinal negativo do CSV', () => {
    const negativos = result.rows.filter(
      (r) => r.rawValor !== null && r.rawValor < 0,
    )
    expect(negativos.length).toBe(result.rows.length) // todos negativos no CACULA
  })
})

describe('CSV Import E2E — stats consolidados', () => {
  const result = mapearCacula(parseCsv(TEXT))

  it('Stats batem com a contagem manual', () => {
    expect(result.stats.total).toBe(50)
    expect(result.stats.effected).toBe(
      result.rows.filter((r) => r.lifecycle === 'EFFECTED').length,
    )
    expect(result.stats.payable).toBe(
      result.rows.filter((r) => r.lifecycle === 'PAYABLE').length,
    )
    expect(result.stats.effected + result.stats.payable).toBe(50)
  })

  it('comRevisao > 0 (tem casos de multi-cat e PAGO sem data)', () => {
    expect(result.stats.comRevisao).toBeGreaterThan(0)
  })
})
