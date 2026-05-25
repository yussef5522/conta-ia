// Sprint 5.0.2.b — GET /api/cnae/search?q=... autocomplete CNAEs cadastrados.
//
// Não precisa de RBAC nem companyId (catálogo global, dados públicos
// republicados pelo IBGE), só autenticação básica via middleware.

import { NextRequest, NextResponse } from 'next/server'
import { searchCNAEs, RAMO_LABELS } from '@/lib/tax/expertise'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const q = url.searchParams.get('q') ?? ''
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 20), 50)

  const results = searchCNAEs(q, limit).map((c) => ({
    code: c.code,
    name: c.name,
    ramo: c.ramo,
    ramoLabel: RAMO_LABELS[c.ramo],
    anexo: c.anexo,
  }))

  return NextResponse.json({ results, total: results.length })
}
