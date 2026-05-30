// Sprint Export CSV+PDF (29/05/2026) — Builder do Comparativo Mensal.
//
// Pega `ComparativoMultiResult` (mesmo shape que a UI consome) +
// metadados de empresa/período/filtros + gera:
// - `renderComparativoCSV()` → string CSV (BOM + RFC 4180)
// - `renderComparativoPDF()` → React component pra `renderToBuffer`

import { View, Text } from '@react-pdf/renderer'
import { buildCSV } from '@/lib/export/csv/base'
import { formatBRLForCsv } from '@/lib/export/csv/format'
import { PdfDocument } from '@/lib/export/pdf/PdfDocument'
import { PdfHeatmap } from '@/lib/export/pdf/PdfHeatmap'
import { pdfStyles, PDF_COLORS } from '@/lib/export/pdf/styles'
import type { ComparativoMultiResult } from '@/lib/relatorios/comparativo'

export interface ComparativoExportContext {
  /** Nome da empresa (vai pro header do PDF + filename) */
  empresaNome: string
  /** "DESPESA" / "RECEITA" / "TODOS" — vai pro título */
  tipo: 'DESPESA' | 'RECEITA' | 'TODOS'
  /** "competencia" / "caixa" — vai pro subtítulo */
  regime: 'competencia' | 'caixa'
  /** "mes" / "trimestre" / "ano" — pra descrição do período */
  granularidade: 'mes' | 'trimestre' | 'ano'
  /** Data/hora de geração formatada pt-BR */
  geradoEm: string
}

const TIPO_LABEL = {
  DESPESA: 'Despesas',
  RECEITA: 'Receitas',
  TODOS: 'Todos os lançamentos',
} as const

const GRAN_LABEL = {
  mes: 'mês',
  trimestre: 'trimestre',
  ano: 'ano',
} as const

const REGIME_LABEL = {
  competencia: 'Regime de competência',
  caixa: 'Regime de caixa',
} as const

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

function formatPctSignedCsv(v: number | null): string {
  if (v === null) return ''
  const pct = v * 100
  const formatted = pct.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  return pct >= 0 ? `+${formatted}%` : `${formatted}%`
}

// ──────────────────────────────────────────────────────────────
// CSV
// ──────────────────────────────────────────────────────────────

export function renderComparativoCSV(
  data: ComparativoMultiResult,
): string {
  const periodoCols = data.periodos.map((p) => p.label)
  const headers = ['Categoria', ...periodoCols, 'Média', 'vs Média (%)', 'Total']

  const rows: Array<Array<string | number>> = data.rows.map((row) => [
    row.categoryName,
    ...row.values.map(formatBRLForCsv),
    row.mediaHistorica !== null ? formatBRLForCsv(row.mediaHistorica) : '',
    row.referenciaVazia ? 'ref. vazia' : formatPctSignedCsv(row.desvioPct),
    formatBRLForCsv(row.total),
  ])

  // Linha total
  rows.push([
    'TOTAL',
    ...data.totals.porPeriodo.map(formatBRLForCsv),
    data.totals.mediaHistorica !== null
      ? formatBRLForCsv(data.totals.mediaHistorica)
      : '',
    data.totals.referenciaVazia
      ? 'ref. vazia'
      : formatPctSignedCsv(data.totals.desvioPct),
    formatBRLForCsv(data.totals.total),
  ])

  return buildCSV(headers, rows)
}

// ──────────────────────────────────────────────────────────────
// PDF
// ──────────────────────────────────────────────────────────────

function formatBRLPdf(v: number): string {
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

export function renderComparativoPDF(
  data: ComparativoMultiResult,
  ctx: ComparativoExportContext,
) {
  return (
    <PdfDocument
      empresaNome={ctx.empresaNome}
      relatorioTitulo="Comparativo Mensal"
      periodo={periodoSubtitulo(data, ctx)}
      geradoEm={ctx.geradoEm}
    >
      {/* Resumo de stats — 3 mini-cards no topo */}
      <View
        style={{
          flexDirection: 'row',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <StatMini
          label="Categorias"
          value={String(data.rows.length)}
        />
        <StatMini
          label="Períodos"
          value={String(data.periodos.length)}
        />
        <StatMini
          label="Total no período"
          value={formatBRLPdf(data.totals.total)}
          accent
        />
      </View>

      {/* Heatmap principal */}
      <View style={pdfStyles.section}>
        <Text style={pdfStyles.sectionTitle}>Detalhamento por categoria</Text>
        <PdfHeatmap
          periodos={data.periodos.map((p) => ({ label: p.label }))}
          rows={data.rows.map((r) => ({
            categoryName: r.categoryName,
            values: r.values,
            cellTones: r.cellTones,
            mediaHistorica: r.mediaHistorica,
            desvioPct: r.desvioPct,
            referenciaVazia: r.referenciaVazia,
            total: r.total,
          }))}
          totals={data.totals}
          formatBRL={formatBRLPdf}
        />
      </View>

      {/* Legenda do heatmap */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
          marginTop: 8,
          paddingTop: 8,
          borderTopWidth: 0.5,
          borderTopColor: PDF_COLORS.border,
        }}
      >
        <Text style={{ fontSize: 7, color: PDF_COLORS.textMuted }}>
          Heatmap (Despesas):
        </Text>
        <LegendaItem cor="#fef2f2" texto="leve" />
        <LegendaItem cor="#fee2e2" texto="moderado" />
        <LegendaItem cor="#fecaca" texto="forte" />
        <Text style={{ fontSize: 7, color: PDF_COLORS.textMuted }}>·</Text>
        <LegendaItem cor="#d1fae5" texto="abaixo da média = bom" />
      </View>
    </PdfDocument>
  )
}

// ──────────────────────────────────────────────────────────────
// Sub-componentes locais
// ──────────────────────────────────────────────────────────────

function StatMini({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <View
      style={{
        flex: 1,
        padding: 8,
        borderRadius: 4,
        backgroundColor: accent ? PDF_COLORS.brandSoft : PDF_COLORS.rowAlt,
        borderWidth: 0.5,
        borderColor: accent ? PDF_COLORS.brand : PDF_COLORS.border,
      }}
    >
      <Text
        style={{
          fontSize: 7,
          color: PDF_COLORS.textMuted,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: 13,
          fontFamily: 'Helvetica-Bold',
          color: accent ? PDF_COLORS.brand : PDF_COLORS.textPrimary,
          marginTop: 2,
        }}
      >
        {value}
      </Text>
    </View>
  )
}

function LegendaItem({ cor, texto }: { cor: string; texto: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <View
        style={{
          width: 8,
          height: 8,
          backgroundColor: cor,
          borderWidth: 0.5,
          borderColor: PDF_COLORS.border,
        }}
      />
      <Text style={{ fontSize: 7, color: PDF_COLORS.textMuted }}>{texto}</Text>
    </View>
  )
}
