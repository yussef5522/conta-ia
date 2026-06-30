// Sprint Find&Match World-Class (15/06/2026) — ranking, reasons[], nudge,
// filtro de data, direção, paginação.
//
// 6 cenários da spec do Yussef:
//   (a) candidatos saem ordenados por score DESC
//   (b) reasons[] correto (VALOR_EXATO etc.)
//   (c) numa linha sem candidato de valor próximo, topScore baixo e nudge=true
//   (d) filtro de data corta fora da janela
//   (e) direção incoerente é descartada
//   (f) paginação retorna top N + hasMore

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  scoreMatch,
  rankCandidates,
  AMOUNT_CLOSE_MIN_POINTS,
  type MatchCandidate,
  type OFXTransaction,
} from '@/lib/conciliacao/match'

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d))

// ============================================================================
// FIXTURES — caso REAL Cacula Mix: JUROS UTILIZ.CH.ESPECIAL R$ 1.546,70
// vs 87 candidatos crus (salários, SALDO INICIAL R$ 69.813, distribuições...).
// Nenhum bate de valor: o nudge precisa disparar e levar o user pro Create.
// ============================================================================

const ofxJuros: OFXTransaction = {
  id: 'ofx-juros',
  description: 'JUROS UTILIZ.CH.ESPECIAL',
  amount: 1546.70,
  type: 'DEBIT',
  date: utc(2026, 5, 10), // 10/jun/2026
  supplierId: null,
  bankAccountId: 'ba-banrisul',
}

const ofxNestle: OFXTransaction = {
  id: 'ofx-nestle',
  description: 'NESTLE BRASIL LTDA - Pagamento',
  amount: 105.86,
  type: 'DEBIT',
  date: utc(2026, 5, 3),
  supplierId: 'sup-nestle',
  bankAccountId: 'ba-banrisul',
}

// Universo "crú" tipo o que o Find & Match recebe hoje:
const universoCacula: MatchCandidate[] = [
  // Salário grande (não bate valor)
  {
    id: 'c-sal-1',
    lifecycle: 'PAYABLE',
    description: 'FOLHA PAGAMENTO MAIO',
    amount: 12000,
    dueDate: utc(2026, 5, 5),
    supplierId: null,
    customerId: null,
    categoryId: null,
  },
  // Distribuição (não bate valor)
  {
    id: 'c-dist-1',
    lifecycle: 'PAYABLE',
    description: 'DISTRIBUICAO LUCROS — sócio',
    amount: 5000,
    dueDate: utc(2026, 5, 8),
    supplierId: null,
    customerId: null,
    categoryId: null,
  },
  // Nestle pendente (bate valor + descrição)
  {
    id: 'c-nestle',
    lifecycle: 'PAYABLE',
    description: 'Nestle Brasil Ltda',
    amount: 105.86,
    dueDate: utc(2026, 5, 3),
    supplierId: 'sup-nestle',
    customerId: null,
    categoryId: null,
  },
  // Distribuição outra (não bate valor)
  {
    id: 'c-dist-2',
    lifecycle: 'PAYABLE',
    description: 'DISTRIBUICAO — outra sócia',
    amount: 3500,
    dueDate: utc(2026, 5, 8),
    supplierId: null,
    customerId: null,
    categoryId: null,
  },
]

// ============================================================================
// (a) candidatos saem ordenados por score DESC
// ============================================================================
describe('Sprint Find&Match World-Class — (a) ordenação DESC', () => {
  it('rankCandidates(allowAnyAmount=true) retorna lista DESC por score', () => {
    const ranked = rankCandidates(ofxNestle, universoCacula, {
      allowAnyAmount: true,
    })
    expect(ranked.length).toBeGreaterThanOrEqual(2)
    // Primeiro = Nestle (valor exato + supplier + descrição = ~100+ pts)
    expect(ranked[0].candidateId).toBe('c-nestle')
    // Ordem DESC garantida
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score)
    }
  })

  it('com auto-match (allowAnyAmount=false) descarta valores distantes', () => {
    // O Sprint A original (auto-match no XeroRow) deve continuar igual:
    // só Nestle entra; salários/distribuições são descartados.
    const ranked = rankCandidates(ofxNestle, universoCacula)
    expect(ranked.length).toBe(1)
    expect(ranked[0].candidateId).toBe('c-nestle')
  })

  it('caso REAL JUROS: nenhum candidato bate valor; lista NÃO vazia em allowAnyAmount=true', () => {
    const ranked = rankCandidates(ofxJuros, universoCacula, {
      allowAnyAmount: true,
    })
    // Find & Match mostra os candidatos pra user CONSEGUIR ver que nenhum bate
    // (em vez de tela vazia). Auto-match na linha verde fica = []
    expect(ranked.length).toBe(universoCacula.length)
    expect(rankCandidates(ofxJuros, universoCacula).length).toBe(0)
  })
})

// ============================================================================
// (b) reasons[] correto (chaves estáveis pros chips)
// ============================================================================
describe('Sprint Find&Match World-Class — (b) reasons[] estáveis', () => {
  it('valor exato gera VALOR_EXATO', () => {
    const r = scoreMatch(ofxNestle, universoCacula[2]) // Nestle
    expect(r).not.toBeNull()
    expect(r!.reasons).toContain('VALOR_EXATO')
  })

  it('mesma data gera DATA_MESMA', () => {
    const r = scoreMatch(ofxNestle, universoCacula[2]) // mesmo dia 03/jun
    expect(r!.reasons).toContain('DATA_MESMA')
  })

  it('mesmo supplierId gera FORNECEDOR_IGUAL', () => {
    const r = scoreMatch(ofxNestle, universoCacula[2])
    expect(r!.reasons).toContain('FORNECEDOR_IGUAL')
  })

  it('descrição muito similar gera DESC_MUITO_SIMILAR', () => {
    const r = scoreMatch(ofxNestle, universoCacula[2])
    expect(r!.reasons).toContain('DESC_MUITO_SIMILAR')
  })

  it('valor diff 1% (centavos) gera VALOR_PROXIMO_1PCT, não VALOR_EXATO', () => {
    const c: MatchCandidate = {
      ...universoCacula[2],
      amount: 105.50, // diff ~0.34% < 1%
    }
    const r = scoreMatch(ofxNestle, c)
    expect(r!.reasons).toContain('VALOR_PROXIMO_1PCT')
    expect(r!.reasons).not.toContain('VALOR_EXATO')
  })

  it('valor diff 3% gera VALOR_PROXIMO_5PCT', () => {
    const c: MatchCandidate = { ...universoCacula[2], amount: 102 } // diff ~3.6%
    const r = scoreMatch(ofxNestle, c)
    expect(r!.reasons).toContain('VALOR_PROXIMO_5PCT')
  })

  it('D±1 dia gera DATA_D1; D+3 gera DATA_PROXIMA', () => {
    const c1: MatchCandidate = { ...universoCacula[2], dueDate: utc(2026, 5, 4) }
    const r1 = scoreMatch(ofxNestle, c1)
    expect(r1!.reasons).toContain('DATA_D1')

    const c2: MatchCandidate = { ...universoCacula[2], dueDate: utc(2026, 5, 6) }
    const r2 = scoreMatch(ofxNestle, c2)
    expect(r2!.reasons).toContain('DATA_PROXIMA')
  })

  it('NENHUMA chave aparece quando o critério não bate (sem ruído na UI)', () => {
    // OFX simples (sem supplier) contra candidato sem supplier:
    const c: MatchCandidate = {
      id: 'c-no-match',
      lifecycle: 'PAYABLE',
      description: 'ALGO DIFERENTE COMPLETAMENTE',
      amount: 105.86, // valor bate
      dueDate: utc(2026, 5, 3), // data bate
      supplierId: null,
      customerId: null,
      categoryId: null,
    }
    const r = scoreMatch(
      { ...ofxNestle, supplierId: null, description: 'X Y Z' },
      c,
    )
    expect(r!.reasons).toContain('VALOR_EXATO')
    expect(r!.reasons).toContain('DATA_MESMA')
    expect(r!.reasons).not.toContain('FORNECEDOR_IGUAL')
    expect(r!.reasons).not.toContain('DESC_MUITO_SIMILAR')
    expect(r!.reasons).not.toContain('DESC_SIMILAR')
  })
})

// ============================================================================
// (c) caso JUROS R$ 1.546,70: topScore baixo, nudge=true (regra: nenhum
//     candidato com breakdown.amount >= AMOUNT_CLOSE_MIN_POINTS)
// ============================================================================
describe('Sprint Find&Match World-Class — (c) nudge "isso é Create"', () => {
  it('caso REAL JUROS: nenhum candidato tem valor próximo → nudge=true', () => {
    const ranked = rankCandidates(ofxJuros, universoCacula, {
      allowAnyAmount: true,
    })
    const hasAnyAmountClose = ranked.some(
      (r) => r.breakdown.amount >= AMOUNT_CLOSE_MIN_POINTS,
    )
    const nudge = ranked.length === 0 || !hasAnyAmountClose
    expect(nudge).toBe(true)
    expect(hasAnyAmountClose).toBe(false)
  })

  it('quando topScore < 25 (sem nenhum candidato de valor próximo) → nudge', () => {
    const ranked = rankCandidates(ofxJuros, universoCacula, {
      allowAnyAmount: true,
    })
    // Como nenhum candidato bate valor, todos os scores vêm de data + descrição
    // — nenhum chega aos 25 pts mínimos de valor.
    for (const r of ranked) expect(r.breakdown.amount).toBeLessThan(25)
  })

  it('caso Nestle: existe candidato com valor próximo → nudge=false', () => {
    const ranked = rankCandidates(ofxNestle, universoCacula, {
      allowAnyAmount: true,
    })
    const hasAnyAmountClose = ranked.some(
      (r) => r.breakdown.amount >= AMOUNT_CLOSE_MIN_POINTS,
    )
    const nudge = ranked.length === 0 || !hasAnyAmountClose
    expect(nudge).toBe(false)
    expect(hasAnyAmountClose).toBe(true)
  })

  it('AMOUNT_CLOSE_MIN_POINTS é exportada e vale 25 (diff ≤ 5%)', () => {
    expect(AMOUNT_CLOSE_MIN_POINTS).toBe(25)
  })
})

// ============================================================================
// (d) filtro de data corta fora da janela
// ============================================================================
describe('Sprint Find&Match World-Class — (d) filtro de janela de data', () => {
  it('endpoint aceita windowDays como número (1-365) OU "all" (default 15)', () => {
    // Teste de presença do schema: lê o arquivo e confirma o aceite.
    const code = readFileSync(
      join(__dirname, '..', 'app/api/conciliacao/find-and-match/route.ts'),
      'utf-8',
    )
    expect(code).toMatch(/windowDays/)
    expect(code).toMatch(/z\.literal\('all'\)/)
    expect(code).toMatch(/min\(1\)\.max\(365\)/)
    expect(code).toMatch(/\.default\(15\)/)
  })

  it('janela aplicada em dueDate (Sprint Find-And-Match-Strict: RAMO 2 removido)', () => {
    const code = readFileSync(
      join(__dirname, '..', 'app/api/conciliacao/find-and-match/route.ts'),
      'utf-8',
    )
    // Sprint Find-And-Match-Strict (30/06/2026): janela agora é parâmetro
    // do helper compartilhado buildStrictReconciliationWhere; ramo2 (e seu
    // OR de paymentDate/dueDate/date) foram REMOVIDOS. Só dueDate fica.
    expect(code).toMatch(/dueWindow/)
    expect(code).toMatch(/data\.windowDays !== 'all'/)
    expect(code).toMatch(/buildStrictReconciliationWhere/)
  })

  it('windowDays="all" não monta filtro de data (passa universo inteiro pro ranking)', () => {
    const code = readFileSync(
      join(__dirname, '..', 'app/api/conciliacao/find-and-match/route.ts'),
      'utf-8',
    )
    // Sprint Find-And-Match-Strict: quando 'all', dueWindow fica undefined
    // e o helper recebe `undefined` no 3o arg, omitindo dueDate do where.
    const helperCode = readFileSync(
      join(__dirname, '..', 'lib/conciliacao/strict-where.ts'),
      'utf-8',
    )
    expect(helperCode).toMatch(/window\s*\?\s*\{\s*dueDate:\s*\{\s*gte:\s*window\.gte/)
    // E o endpoint só constrói dueWindow se windowDays !== 'all'.
    expect(code).toMatch(/let\s+dueWindow\s*:/)
  })
})

// ============================================================================
// (e) direção incoerente é descartada
// ============================================================================
describe('Sprint Find&Match World-Class — (e) direção incoerente descartada', () => {
  it('DEBIT vs RECEIVABLE retorna null mesmo com allowAnyAmount=true', () => {
    const r = scoreMatch(
      { ...ofxJuros, type: 'DEBIT' },
      { ...universoCacula[0], lifecycle: 'RECEIVABLE' as 'PAYABLE' },
      { allowAnyAmount: true },
    )
    expect(r).toBeNull()
  })

  it('CREDIT vs PAYABLE retorna null mesmo com allowAnyAmount=true', () => {
    const r = scoreMatch(
      { ...ofxNestle, type: 'CREDIT' },
      { ...universoCacula[2], lifecycle: 'PAYABLE' },
      { allowAnyAmount: true },
    )
    expect(r).toBeNull()
  })

  it('rankCandidates filtra os incoerentes sem precisar de tratamento extra', () => {
    const mixed: MatchCandidate[] = [
      { ...universoCacula[2], id: 'ok-payable', lifecycle: 'PAYABLE' },
      { ...universoCacula[2], id: 'bad-receivable', lifecycle: 'RECEIVABLE' as 'PAYABLE' },
    ]
    const ranked = rankCandidates(ofxNestle, mixed, { allowAnyAmount: true })
    expect(ranked.length).toBe(1)
    expect(ranked[0].candidateId).toBe('ok-payable')
  })
})

// ============================================================================
// (f) paginação top N + hasMore
// ============================================================================
describe('Sprint Find&Match World-Class — (f) paginação', () => {
  it('endpoint aceita page (>=0) e limit (1-50, default 15)', () => {
    const code = readFileSync(
      join(__dirname, '..', 'app/api/conciliacao/find-and-match/route.ts'),
      'utf-8',
    )
    expect(code).toMatch(/page:\s*z\.coerce\.number\(\)\.int\(\)\.min\(0\)\.default\(0\)/)
    expect(code).toMatch(/limit:\s*z\.coerce\.number\(\)\.int\(\)\.min\(1\)\.max\(50\)\.default\(15\)/)
  })

  it('payload retorna ranking.hasMore + ranking.totalRanked + ranking.page', () => {
    const code = readFileSync(
      join(__dirname, '..', 'app/api/conciliacao/find-and-match/route.ts'),
      'utf-8',
    )
    expect(code).toMatch(/totalRanked,/)
    expect(code).toMatch(/hasMore,/)
    expect(code).toMatch(/topScore,/)
    expect(code).toMatch(/nudgeCreate,/)
  })

  it('slice de paginação usa start = page * limit; hasMore = end < totalRanked', () => {
    const code = readFileSync(
      join(__dirname, '..', 'app/api/conciliacao/find-and-match/route.ts'),
      'utf-8',
    )
    expect(code).toMatch(/data\.page \* data\.limit/)
    expect(code).toMatch(/hasMore = end < totalRanked/)
  })

  it('ordenação puramente em memória sobre o universo (até scanLimit=200)', () => {
    // Garante que scanLimit fica como cap defensivo separado de limit.
    const code = readFileSync(
      join(__dirname, '..', 'app/api/conciliacao/find-and-match/route.ts'),
      'utf-8',
    )
    expect(code).toMatch(/scanLimit/)
    expect(code).toMatch(/take: data\.scanLimit/)
  })
})

// ============================================================================
// (regressão) scoreMatch sem opts mantém comportamento Sprint 4.0.2
// — testes existentes em conciliacao-match.test.ts não devem quebrar.
// Aqui confirmamos o shape novo do MatchScore.
// ============================================================================
describe('Sprint Find&Match World-Class — shape MatchScore tem reasons[]', () => {
  it('reasons[] sempre é array (mesmo sem matches em nenhuma dimensão)', () => {
    const r = scoreMatch(
      { ...ofxNestle, supplierId: null, description: 'AAAA' },
      {
        ...universoCacula[2],
        supplierId: null,
        description: 'BBBB',
      },
    )
    expect(Array.isArray(r!.reasons)).toBe(true)
    // Valor + data ainda batem
    expect(r!.reasons).toContain('VALOR_EXATO')
  })

  it('reasoning[] preservado (legível pra logs)', () => {
    const r = scoreMatch(ofxNestle, universoCacula[2])
    expect(Array.isArray(r!.reasoning)).toBe(true)
    expect(r!.reasoning).toContain('Valor exato')
  })
})

// ============================================================================
// UI — testes de presença no painel (selo, chips, nudge, filtro)
// ============================================================================
describe('Sprint Find&Match World-Class — Painel UI (presença)', () => {
  const PANEL_PATH = join(
    __dirname,
    '..',
    'components/conciliacao/find-and-match-panel.tsx',
  )
  const code = readFileSync(PANEL_PATH, 'utf-8')

  it('importa MatchReason do engine + tem REASON_LABEL', () => {
    expect(code).toMatch(/import type \{ MatchReason \}/)
    expect(code).toMatch(/REASON_LABEL: Record<MatchReason, string>/)
  })

  it('selo "Provável" (≥90, verde) + "Quase" (70-89, âmbar) + sem selo (<70)', () => {
    expect(code).toMatch(/data-testid="confidence-strong"/)
    expect(code).toMatch(/data-testid="confidence-weak"/)
    expect(code).toMatch(/Provável · \{c\.score\}/)
    expect(code).toMatch(/Quase · \{c\.score\}/)
    expect(code).toMatch(/score >= 90/)
    expect(code).toMatch(/score >= 70/)
  })

  it('chips do "porque" usando REASON_LABEL', () => {
    expect(code).toMatch(/data-testid="reason-chips"/)
    expect(code).toMatch(/c\.reasons\.map/)
    expect(code).toMatch(/REASON_LABEL\[r\]/)
  })

  it('valor exato destacado em verde (estilo emerald)', () => {
    expect(code).toMatch(/VALOR_EXATO[\s\S]{0,200}bg-emerald-50/)
  })

  it('banner nudge "isso é Create" quando ranking.nudgeCreate=true', () => {
    expect(code).toMatch(/data-testid="nudge-create"/)
    expect(code).toMatch(/Nenhum candidato com valor próximo/)
    expect(code).toMatch(/onSwitchToCreate/)
  })

  it('controle de filtro de janela (Select com 4 opções)', () => {
    expect(code).toMatch(/windowDays/)
    expect(code).toMatch(/±15 dias \(recomendado\)/)
    expect(code).toMatch(/Todas as datas/)
  })

  it('botão "Ver mais" quando ranking.hasMore=true', () => {
    expect(code).toMatch(/Ver mais \(\{ranking\.totalRanked - candidates\.length/)
    expect(code).toMatch(/ranking\?\.hasMore/)
  })

  it('AbortController pra evitar race condition de fetch', () => {
    expect(code).toMatch(/AbortController/)
    expect(code).toMatch(/abortRef\.current\.abort\(\)/)
  })

  it('XeroRow passa onSwitchToCreate que troca pra aba CREATE', () => {
    const xeroCode = readFileSync(
      join(__dirname, '..', 'components/conciliacao/xero-row.tsx'),
      'utf-8',
    )
    expect(xeroCode).toMatch(/onSwitchToCreate=\{\(\) => \{/)
    expect(xeroCode).toMatch(/setTab\('CREATE'\)/)
  })
})
