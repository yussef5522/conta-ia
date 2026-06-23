// Sprint 6 — GET /api/empresas/[id]/despesas/export
//
// Baixa CSV com TODAS as despesas do período (mesmos filtros da página).
// UTF-8 + BOM (Excel BR abre direto) + RFC 4180.

import { NextRequest } from 'next/server'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { getExpenseTransactions } from '@/lib/dashboard/expenses-breakdown'
import type { Regime } from '@/lib/dashboard/engine'

interface Params {
  params: Promise<{ id: string }>
}

const CSV_HEADER = ['Data', 'Categoria', 'Grupo', 'Descricao', 'Fornecedor', 'Banco', 'Valor']

const DRE_GROUP_LABEL_CSV: Record<string, string> = {
  CUSTO_PRODUTO_VENDIDO: 'Custo do Produto Vendido',
  DESPESAS_PESSOAL: 'Pessoal',
  DESPESAS_COMERCIAIS: 'Comercial',
  DESPESAS_ADMINISTRATIVAS: 'Administrativo',
  DESPESAS_FINANCEIRAS: 'Financeiro',
  OUTRAS_DESPESAS: 'Outras Despesas',
  IMPOSTOS_SOBRE_LUCRO: 'Impostos',
}

function csvEscape(v: string): string {
  if (v.includes(',') || v.includes('"') || v.includes('\n') || v.includes('\r')) {
    return `"${v.replace(/"/g, '""')}"`
  }
  return v
}

function csvRow(values: (string | number)[]): string {
  return values.map((v) => csvEscape(String(v))).join(',')
}

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'export'
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.view')

    const url = new URL(request.url)
    const regime: Regime = url.searchParams.get('regime') === 'competencia' ? 'competencia' : 'caixa'
    const de = url.searchParams.get('de')
    const ate = url.searchParams.get('ate')
    if (!de || !ate) {
      return new Response(JSON.stringify({ error: 'de e ate obrigatorios' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const categoryId = url.searchParams.get('categoryId') ?? undefined
    const bankAccountId = url.searchParams.get('contaId') ?? undefined
    const q = url.searchParams.get('q') ?? undefined

    // Limite 10k linhas (mesma política do export movimentações Sprint 3.0.4)
    const result = await getExpenseTransactions({
      companyId,
      periodStart: new Date(`${de}T00:00:00.000Z`),
      periodEnd: new Date(`${ate}T23:59:59.999Z`),
      regime,
      categoryId,
      bankAccountId,
      q,
      limit: 10000,
      offset: 0,
    })

    const lines: string[] = [csvRow(CSV_HEADER)]
    for (const t of result.items) {
      const valor = t.amount.toFixed(2).replace('.', ',') // BR decimal
      lines.push(
        csvRow([
          t.date, // yyyy-mm-dd
          t.categoryName,
          DRE_GROUP_LABEL_CSV[t.dreGroup] ?? t.dreGroup,
          t.description,
          t.supplierName ?? '',
          t.bankAccountName ?? '',
          valor,
        ]),
      )
    }

    const csv = '﻿' + lines.join('\r\n') + '\r\n' // BOM + CRLF
    const filename = `despesas-${slugify(de)}-a-${slugify(ate)}.csv`

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    return handleApiError(err)
  }
}
