// ESTOQUE FASE 3 — GET Real vs Teórico (o motor). CSV com ?formato=csv.
// Nasce com requireStock (stock.view — é relatório, não mexe em nada).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireStock } from '@/lib/stock/require-stock'
import { calcularRealVsTeorico, interpretar, PISO_DADOS } from '@/lib/stock/real-vs-teorico'

interface Params { params: Promise<{ id: string }> }

const hoje = () => new Date().toISOString().slice(0, 10)

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const auth = await requireStock(request, companyId, 'stock.view')
  if (!auth.ok) return auth.res

  const sp = request.nextUrl.searchParams
  const de = sp.get('de') || PISO_DADOS
  const ate = sp.get('ate') || hoje()
  const r = await calcularRealVsTeorico({ companyId, de, ate }, prisma)

  if (sp.get('formato') === 'csv') {
    const cab = ['Item', 'Categoria', 'Un', 'Saldo inicial', 'Entradas', 'Produzido', 'Vendas', 'Perdas', 'Consumo producao', 'Estornos', 'Teorico', 'Real (contado)', 'Variancia', 'Variancia R$', '% consumo', 'Leitura']
    const linhas = r.linhas.map((l) => [
      l.nome, l.categoria, l.unidadeControle, l.saldoInicial, l.entradas, l.producaoGerada,
      l.vendas, l.perdas, l.consumoProducao, l.estornos, l.saldoTeorico,
      l.variancia == null ? 'sem contagem' : l.saldoFinal,
      l.variancia ?? '', l.varianciaValor ?? '',
      l.varianciaPct == null ? '' : (l.varianciaPct * 100).toFixed(1),
      interpretar(l) ?? '',
    ])
    const csv = [cab, ...linhas].map((r_) => r_.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
    return new NextResponse(`﻿${csv}`, {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="real-vs-teorico-${r.resumo.de}-a-${r.resumo.ate}.csv"` },
    })
  }

  return NextResponse.json({ relatorio: r })
}
