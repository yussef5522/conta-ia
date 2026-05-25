// Sprint 5.0.2.b/c — GET /api/cnae/search autocomplete CNAEs.
//
// Catálogo global (dados públicos IBGE) — só exige autenticação via middleware.
// Suporta:
//   - q: termo de busca (código, nome, alias)
//   - ramo: filtro por ramo (RESTAURANTE | ACADEMIA | COMERCIO_ROUPA)
//   - limit: max resultados (cap 50)

import { NextRequest, NextResponse } from 'next/server'
import { searchCNAEs, RAMO_LABELS, countCNAEsByRamo, type Ramo } from '@/lib/tax/expertise'

const VALID_RAMOS: Ramo[] = ['RESTAURANTE', 'ACADEMIA', 'COMERCIO_ROUPA']

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const q = url.searchParams.get('q') ?? ''
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 20), 1), 50)
  const ramoParam = url.searchParams.get('ramo')
  const ramo = ramoParam && VALID_RAMOS.includes(ramoParam as Ramo) ? (ramoParam as Ramo) : undefined

  const results = searchCNAEs(q, limit, ramo).map((c) => ({
    code: c.code,
    name: c.name,
    ramo: c.ramo,
    ramoLabel: RAMO_LABELS[c.ramo],
    anexo: c.anexo,
    icon: c.icon ?? '📋',
    aliases: c.aliases ?? [],
  }))

  return NextResponse.json({
    results,
    total: results.length,
    countByRamo: countCNAEsByRamo(),
  })
}
