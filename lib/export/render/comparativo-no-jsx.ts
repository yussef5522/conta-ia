// Sprint Export CSV+PDF (29/05/2026) — Tentativa 2: createElement explícito.
//
// Mesmo conteúdo de `comparativo.tsx` mas SEM JSX. Todas as criações
// de element passam por `React.createElement` direto pra contornar a
// transformação JSX do Turbopack que parece estar gerando elements
// com $$typeof diferente do que o reconciler do react-pdf espera.

import * as React from 'react'
import {
  Document,
  Page,
  View,
  Text,
  Svg,
  Rect,
} from '@react-pdf/renderer'
import type { ComparativoMultiResult } from '@/lib/relatorios/comparativo'
import type { CellTone } from '@/lib/relatorios/comparativo'

const { createElement: h } = React

export interface ComparativoExportContext {
  empresaNome: string
  tipo: 'DESPESA' | 'RECEITA' | 'TODOS'
  regime: 'competencia' | 'caixa'
  granularidade: 'mes' | 'trimestre' | 'ano'
  geradoEm: string
}

// Cores brand (sem importar styles.ts pra evitar StyleSheet.create caching)
const C = {
  brand: '#7c3aed',
  brandSoft: '#ede9fe',
  textPrimary: '#0f172a',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',
  border: '#e2e8f0',
  rowAlt: '#f8fafc',
}

const TONE_HEX: Record<CellTone, string | null> = {
  transparent: null,
  'fav-weak': '#ecfdf5',
  'fav-medium': '#d1fae5',
  'fav-strong': '#a7f3d0',
  'unfav-weak': '#fef2f2',
  'unfav-medium': '#fee2e2',
  'unfav-strong': '#fecaca',
}

const TIPO_LABEL = {
  DESPESA: 'Despesas',
  RECEITA: 'Receitas',
  TODOS: 'Todos os lançamentos',
} as const
const GRAN_LABEL = { mes: 'mês', trimestre: 'trimestre', ano: 'ano' } as const
const REGIME_LABEL = {
  competencia: 'Regime de competência',
  caixa: 'Regime de caixa',
} as const

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

function formatPctSigned(v: number | null): string {
  if (v === null) return '—'
  const pct = v * 100
  const formatted = pct.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  return pct >= 0 ? `+${formatted}%` : `${formatted}%`
}

function periodoSubtitulo(
  data: ComparativoMultiResult,
  ctx: ComparativoExportContext,
): string {
  const firstLabel = data.periodos[0]?.label ?? '?'
  const lastLabel = data.periodos[data.periodos.length - 1]?.label ?? '?'
  return `${TIPO_LABEL[ctx.tipo]} · ${data.periodos.length} ${
    GRAN_LABEL[ctx.granularidade]
  }${data.periodos.length === 1 ? '' : 'es'} (${firstLabel} → ${lastLabel}) · ${
    REGIME_LABEL[ctx.regime]
  }`
}

// Mini logo (3 barras + wordmark) via createElement
function buildLogo(): React.ReactElement {
  return h(
    View,
    { style: { flexDirection: 'row', alignItems: 'center' } },
    h(
      Svg,
      { width: 22, height: 22, viewBox: '0 0 54 56' },
      h(Rect, { x: 0, y: 32, width: 14, height: 24, rx: 2, fill: C.brand }),
      h(Rect, { x: 20, y: 18, width: 14, height: 38, rx: 2, fill: C.brand }),
      h(Rect, { x: 40, y: 4, width: 14, height: 52, rx: 2, fill: C.brand }),
    ),
    h(
      Text,
      {
        style: {
          fontSize: 14,
          fontFamily: 'Helvetica-Bold',
          color: C.textPrimary,
          marginLeft: 5,
          letterSpacing: -0.5,
        },
      },
      'CAIXAOS',
    ),
  )
}

function buildStatMini(
  label: string,
  value: string,
  accent?: boolean,
): React.ReactElement {
  return h(
    View,
    {
      style: {
        flex: 1,
        padding: 8,
        borderRadius: 4,
        backgroundColor: accent ? C.brandSoft : C.rowAlt,
        borderWidth: 0.5,
        borderColor: accent ? C.brand : C.border,
      },
    },
    h(
      Text,
      {
        style: {
          fontSize: 7,
          color: C.textMuted,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        },
      },
      label,
    ),
    h(
      Text,
      {
        style: {
          fontSize: 13,
          fontFamily: 'Helvetica-Bold',
          color: accent ? C.brand : C.textPrimary,
          marginTop: 2,
        },
      },
      value,
    ),
  )
}

function buildHeatmapHeader(periodos: Array<{ label: string }>): React.ReactElement {
  const N = periodos.length
  const colCategoryPct = 28
  const colMediaPct = 11
  const colDesvioPct = 11
  const colsPerPeriodoPct =
    (100 - colCategoryPct - colMediaPct - colDesvioPct) / N

  const headStyle = {
    flexDirection: 'row' as const,
    borderBottomWidth: 1.2,
    borderBottomColor: C.textPrimary,
    paddingVertical: 4,
    paddingHorizontal: 4,
    backgroundColor: C.rowAlt,
  }
  const cellTextStyle = {
    fontFamily: 'Helvetica-Bold' as const,
    fontSize: 8,
    color: C.textPrimary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  }

  const cols: React.ReactElement[] = [
    h(
      View,
      { key: 'cat', style: { width: `${colCategoryPct}%` } },
      h(Text, { style: cellTextStyle }, 'Categoria'),
    ),
    ...periodos.map((p, i) =>
      h(
        View,
        { key: `p${i}`, style: { width: `${colsPerPeriodoPct}%` } },
        h(
          Text,
          { style: { ...cellTextStyle, textAlign: 'right' as const } },
          p.label,
        ),
      ),
    ),
    h(
      View,
      { key: 'media', style: { width: `${colMediaPct}%` } },
      h(
        Text,
        { style: { ...cellTextStyle, textAlign: 'right' as const } },
        'Média',
      ),
    ),
    h(
      View,
      { key: 'desvio', style: { width: `${colDesvioPct}%` } },
      h(
        Text,
        { style: { ...cellTextStyle, textAlign: 'center' as const } },
        'vs Média',
      ),
    ),
  ]
  return h(View, { style: headStyle, fixed: true }, ...cols)
}

function buildHeatmapRow(
  row: ComparativoMultiResult['rows'][number],
  rIdx: number,
  N: number,
): React.ReactElement {
  const colCategoryPct = 28
  const colMediaPct = 11
  const colDesvioPct = 11
  const colsPerPeriodoPct =
    (100 - colCategoryPct - colMediaPct - colDesvioPct) / N

  const rowStyle = {
    flexDirection: 'row' as const,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
    paddingVertical: 4,
    paddingHorizontal: 4,
    backgroundColor: rIdx % 2 === 1 ? C.rowAlt : undefined,
  }
  const cellText = { fontSize: 9, color: C.textPrimary }

  const cols: React.ReactElement[] = [
    h(
      View,
      { key: 'cat', style: { width: `${colCategoryPct}%` } },
      h(
        Text,
        { style: { ...cellText, fontFamily: 'Helvetica-Bold' } },
        row.categoryName,
      ),
    ),
    ...row.values.map((v, i) => {
      const tone = row.cellTones[i] ?? 'transparent'
      const bg = TONE_HEX[tone]
      return h(
        View,
        {
          key: `v${i}`,
          style: {
            width: `${colsPerPeriodoPct}%`,
            backgroundColor: bg ?? undefined,
            paddingHorizontal: 2,
          },
        },
        h(
          Text,
          { style: { ...cellText, textAlign: 'right' as const } },
          v > 0 ? formatBRL(v) : '—',
        ),
      )
    }),
    h(
      View,
      { key: 'media', style: { width: `${colMediaPct}%` } },
      h(
        Text,
        {
          style: {
            ...cellText,
            textAlign: 'right' as const,
            fontFamily: 'Helvetica-Bold' as const,
            color: C.textSecondary,
          },
        },
        row.mediaHistorica !== null ? formatBRL(row.mediaHistorica) : '—',
      ),
    ),
    h(
      View,
      { key: 'desvio', style: { width: `${colDesvioPct}%` } },
      h(
        Text,
        {
          style: {
            ...cellText,
            textAlign: 'center' as const,
            color: C.textSecondary,
          },
        },
        row.referenciaVazia ? 'ref. vazia' : formatPctSigned(row.desvioPct),
      ),
    ),
  ]
  return h(View, { key: row.categoryId ?? `__${rIdx}`, style: rowStyle }, ...cols)
}

function buildTotalRow(
  totals: ComparativoMultiResult['totals'],
  N: number,
): React.ReactElement {
  const colCategoryPct = 28
  const colMediaPct = 11
  const colDesvioPct = 11
  const colsPerPeriodoPct =
    (100 - colCategoryPct - colMediaPct - colDesvioPct) / N

  const rowStyle = {
    flexDirection: 'row' as const,
    borderTopWidth: 1.2,
    borderTopColor: C.textPrimary,
    paddingVertical: 4,
    paddingHorizontal: 4,
  }
  const cellText = {
    fontSize: 9,
    color: C.textPrimary,
    fontFamily: 'Helvetica-Bold' as const,
  }

  const cols: React.ReactElement[] = [
    h(
      View,
      { key: 'cat', style: { width: `${colCategoryPct}%` } },
      h(Text, { style: cellText }, 'Total'),
    ),
    ...totals.porPeriodo.map((v, i) =>
      h(
        View,
        { key: `v${i}`, style: { width: `${colsPerPeriodoPct}%` } },
        h(
          Text,
          { style: { ...cellText, textAlign: 'right' as const } },
          formatBRL(v),
        ),
      ),
    ),
    h(
      View,
      { key: 'media', style: { width: `${colMediaPct}%` } },
      h(
        Text,
        { style: { ...cellText, textAlign: 'right' as const } },
        totals.mediaHistorica !== null ? formatBRL(totals.mediaHistorica) : '—',
      ),
    ),
    h(
      View,
      { key: 'desvio', style: { width: `${colDesvioPct}%` } },
      h(
        Text,
        { style: { ...cellText, textAlign: 'center' as const } },
        totals.referenciaVazia ? 'ref. vazia' : formatPctSigned(totals.desvioPct),
      ),
    ),
  ]
  return h(View, { style: rowStyle }, ...cols)
}

export function renderComparativoPDFNoJSX(
  data: ComparativoMultiResult,
  ctx: ComparativoExportContext,
): React.ReactElement {
  const N = data.periodos.length

  // Page content
  const titleBlock = h(
    View,
    { style: { marginBottom: 16 } },
    h(
      Text,
      {
        style: {
          fontFamily: 'Helvetica-Bold',
          fontSize: 18,
          color: C.textPrimary,
        },
      },
      'Comparativo Mensal',
    ),
    h(
      Text,
      { style: { fontSize: 10, color: C.textSecondary, marginTop: 4 } },
      periodoSubtitulo(data, ctx),
    ),
  )

  const statsRow = h(
    View,
    { style: { flexDirection: 'row', gap: 8, marginBottom: 12 } },
    buildStatMini('Categorias', String(data.rows.length)),
    buildStatMini('Períodos', String(data.periodos.length)),
    buildStatMini('Total no período', formatBRL(data.totals.total), true),
  )

  const heatmap = h(
    View,
    { style: { marginBottom: 14 } },
    h(
      Text,
      {
        style: {
          fontFamily: 'Helvetica-Bold',
          fontSize: 11,
          color: C.textPrimary,
          marginBottom: 6,
        },
      },
      'Detalhamento por categoria',
    ),
    h(
      View,
      { style: { width: '100%' } },
      buildHeatmapHeader(data.periodos.map((p) => ({ label: p.label }))),
      ...data.rows.map((r, i) => buildHeatmapRow(r, i, N)),
      buildTotalRow(data.totals, N),
    ),
  )

  const header = h(
    View,
    {
      style: {
        position: 'absolute' as const,
        top: 30,
        left: 40,
        right: 40,
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        alignItems: 'flex-end' as const,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
        paddingBottom: 8,
      },
      fixed: true,
    },
    buildLogo(),
    h(
      View,
      { style: { alignItems: 'flex-end' } },
      h(
        Text,
        {
          style: {
            fontFamily: 'Helvetica-Bold',
            fontSize: 10,
            color: C.textPrimary,
          },
        },
        ctx.empresaNome,
      ),
      h(
        Text,
        { style: { fontSize: 8, color: C.textSecondary, marginTop: 1 } },
        'Comparativo Mensal',
      ),
    ),
  )

  const footer = h(
    View,
    {
      style: {
        position: 'absolute' as const,
        bottom: 30,
        left: 40,
        right: 40,
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        paddingTop: 6,
        borderTopWidth: 1,
        borderTopColor: C.border,
      },
      fixed: true,
    },
    h(
      Text,
      { style: { fontSize: 7, color: C.textMuted } },
      `Gerado por CAIXAOS em ${ctx.geradoEm}`,
    ),
    h(Text, {
      style: { fontSize: 7, color: C.textMuted },
      render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
        `Página ${pageNumber} de ${totalPages}`,
    }),
  )

  const page = h(
    Page,
    {
      size: 'A4',
      style: {
        paddingTop: 80,
        paddingBottom: 60,
        paddingHorizontal: 40,
        fontFamily: 'Helvetica',
        fontSize: 9,
        color: C.textPrimary,
      },
    },
    header,
    titleBlock,
    statsRow,
    heatmap,
    footer,
  )

  return h(
    Document,
    {
      title: `Comparativo Mensal — ${ctx.empresaNome}`,
      author: 'CAIXAOS',
      creator: 'CAIXAOS',
      producer: 'CAIXAOS',
    },
    page,
  )
}
