// Sprint Export CSV+PDF (29/05/2026) — Builder Variâncias.

import { View, Text } from '@react-pdf/renderer'
import { buildCSV } from '@/lib/export/csv/base'
import { formatBRLForCsv } from '@/lib/export/csv/format'
import { PdfDocument } from '@/lib/export/pdf/PdfDocument'
import { pdfStyles, PDF_COLORS } from '@/lib/export/pdf/styles'
import type { CollectVariancesResult } from '@/lib/variance/collect'
import type { VarianceLevel } from '@/lib/variance/detect-variances'

export interface VarianciasExportContext {
  empresaNome: string
  geradoEm: string
  /** Materiality threshold em R$ (default 500) */
  minAbsoluteValue: number
}

const LEVEL_LABEL: Record<VarianceLevel, string> = {
  NEW: 'Novo',
  CRITICAL_UP: 'Subiu crítico (+50%+)',
  HIGH_UP: 'Subiu forte (+25%/+50%)',
  MODERATE_UP: 'Subiu moderado (+15%/+25%)',
  STABLE: 'Estável',
  MODERATE_DOWN: 'Caiu moderado (-15%/-25%)',
  HIGH_DOWN: 'Caiu forte (-25%/-50%)',
  CRITICAL_DOWN: 'Caiu crítico (-50%+)',
  DISAPPEARED: 'Sumiu',
}

const LEVEL_COLOR: Record<VarianceLevel, string> = {
  NEW: PDF_COLORS.brand,
  CRITICAL_UP: PDF_COLORS.negative,
  HIGH_UP: PDF_COLORS.negative,
  MODERATE_UP: '#f59e0b',
  STABLE: PDF_COLORS.textSecondary,
  MODERATE_DOWN: '#10b981',
  HIGH_DOWN: PDF_COLORS.positive,
  CRITICAL_DOWN: PDF_COLORS.positive,
  DISAPPEARED: PDF_COLORS.textMuted,
}

function formatBRLPdf(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function formatBRLSigned(v: number): string {
  const formatted = Math.abs(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
  return v >= 0 ? `+${formatted}` : `-${formatted}`
}

function formatPctSigned(v: number | null): string {
  if (v === null) return '—'
  const formatted = Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return v >= 0 ? `+${formatted}%` : `-${formatted}%`
}

// CSV
export function renderVarianciasCSV(data: CollectVariancesResult): string {
  const headers = ['Categoria', 'Grupo DRE', 'Base', 'Atual', 'Variação R$', 'Variação %', 'Nível']
  const rows: Array<Array<string | number>> = data.variances.map((v) => [
    v.categoryName,
    v.dreGroup ?? '',
    formatBRLForCsv(v.baseAmount),
    formatBRLForCsv(v.currentAmount),
    formatBRLForCsv(v.variationAbs),
    v.variationPct !== null ? `${v.variationPct >= 0 ? '+' : ''}${v.variationPct.toFixed(1)}%` : '—',
    LEVEL_LABEL[v.level] ?? v.level,
  ])
  rows.push(['', '', '', '', '', '', ''])
  rows.push([
    'TOTAIS',
    '',
    formatBRLForCsv(data.totals.baseSum),
    formatBRLForCsv(data.totals.currentSum),
    formatBRLForCsv(data.totals.currentSum - data.totals.baseSum),
    '',
    '',
  ])
  return buildCSV(headers, rows)
}

// PDF
export function renderVarianciasPDF(
  data: CollectVariancesResult,
  ctx: VarianciasExportContext,
) {
  const periodoStr = `Atual ${data.periods.current.ym} vs Base ${data.periods.base.ym} · Threshold: ${formatBRLPdf(ctx.minAbsoluteValue)}`
  const totalVariation = data.totals.currentSum - data.totals.baseSum

  return (
    <PdfDocument
      empresaNome={ctx.empresaNome}
      relatorioTitulo="Variâncias"
      periodo={periodoStr}
      geradoEm={ctx.geradoEm}
    >
      {/* Stats topo */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        <Stat label={`Base ${data.periods.base.ym}`} value={formatBRLPdf(data.totals.baseSum)} />
        <Stat label={`Atual ${data.periods.current.ym}`} value={formatBRLPdf(data.totals.currentSum)} accent />
        <Stat
          label="Variação total"
          value={formatBRLSigned(totalVariation)}
          danger={totalVariation > 0}
          positive={totalVariation < 0}
        />
      </View>

      {/* Resumo por severidade */}
      <View style={pdfStyles.section}>
        <Text style={pdfStyles.sectionTitle}>Resumo por severidade</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <SeverityCard label="🚨 Crítico" count={data.summary.critical.count} impact={data.summary.critical.totalImpact} />
          <SeverityCard label="⚠️ Alto" count={data.summary.high.count} impact={data.summary.high.totalImpact} />
          <SeverityCard label="📊 Moderado" count={data.summary.moderate.count} impact={data.summary.moderate.totalImpact} />
          <SeverityCard label="✨ Novos" count={data.summary.new.count} impact={data.summary.new.totalImpact} />
        </View>
      </View>

      {/* Tabela completa */}
      <View style={pdfStyles.section}>
        <Text style={pdfStyles.sectionTitle}>Detalhamento ({data.variances.length} categorias)</Text>
        <View style={pdfStyles.tHead} fixed>
          <View style={{ width: '32%' }}><Text style={pdfStyles.tHeadCell}>Categoria</Text></View>
          <View style={{ width: '14%' }}><Text style={[pdfStyles.tHeadCell, { textAlign: 'right' }]}>Base</Text></View>
          <View style={{ width: '14%' }}><Text style={[pdfStyles.tHeadCell, { textAlign: 'right' }]}>Atual</Text></View>
          <View style={{ width: '14%' }}><Text style={[pdfStyles.tHeadCell, { textAlign: 'right' }]}>Δ R$</Text></View>
          <View style={{ width: '8%' }}><Text style={[pdfStyles.tHeadCell, { textAlign: 'right' }]}>Δ %</Text></View>
          <View style={{ width: '18%' }}><Text style={pdfStyles.tHeadCell}>Nível</Text></View>
        </View>
        {data.variances.map((v, i) => {
          const corLevel = LEVEL_COLOR[v.level]
          const corDelta = v.variationAbs > 0 ? PDF_COLORS.negative : PDF_COLORS.positive
          return (
            <View
              key={v.categoryId}
              style={[pdfStyles.tRow, i % 2 === 1 ? pdfStyles.tRowAlt : null].filter(Boolean) as never}
              wrap={false}
            >
              <View style={{ width: '32%' }}>
                <Text style={[pdfStyles.tCell, pdfStyles.tCellBold]}>{v.categoryName}</Text>
                {v.dreGroup && (
                  <Text style={{ fontSize: 7, color: PDF_COLORS.textMuted, marginTop: 1 }}>
                    {v.dreGroup.replace(/_/g, ' ').toLowerCase()}
                  </Text>
                )}
              </View>
              <View style={{ width: '14%' }}>
                <Text style={[pdfStyles.tCell, pdfStyles.tCellRight, pdfStyles.tCellMuted]}>{formatBRLPdf(v.baseAmount)}</Text>
              </View>
              <View style={{ width: '14%' }}>
                <Text style={[pdfStyles.tCell, pdfStyles.tCellRight, pdfStyles.tCellBold]}>{formatBRLPdf(v.currentAmount)}</Text>
              </View>
              <View style={{ width: '14%' }}>
                <Text style={[pdfStyles.tCell, pdfStyles.tCellRight, pdfStyles.tCellBold, { color: corDelta }]}>
                  {formatBRLSigned(v.variationAbs)}
                </Text>
              </View>
              <View style={{ width: '8%' }}>
                <Text style={[pdfStyles.tCell, pdfStyles.tCellRight, { color: corDelta }]}>
                  {formatPctSigned(v.variationPct)}
                </Text>
              </View>
              <View style={{ width: '18%' }}>
                <Text style={[pdfStyles.tCell, { color: corLevel, fontFamily: 'Helvetica-Bold' }]}>
                  {LEVEL_LABEL[v.level] ?? v.level}
                </Text>
              </View>
            </View>
          )
        })}
      </View>
    </PdfDocument>
  )
}

function Stat({
  label, value, accent, danger, positive,
}: {
  label: string; value: string; accent?: boolean; danger?: boolean; positive?: boolean
}) {
  const bg = danger ? '#fef2f2' : positive ? '#ecfdf5' : accent ? PDF_COLORS.brandSoft : PDF_COLORS.rowAlt
  const border = danger ? PDF_COLORS.negative : positive ? PDF_COLORS.positive : accent ? PDF_COLORS.brand : PDF_COLORS.border
  const color = danger ? PDF_COLORS.negative : positive ? PDF_COLORS.positive : accent ? PDF_COLORS.brand : PDF_COLORS.textPrimary
  return (
    <View
      style={{
        flex: 1, padding: 8, borderRadius: 4,
        backgroundColor: bg,
        borderWidth: 0.5,
        borderColor: border,
      }}
    >
      <Text style={{ fontSize: 7, color: PDF_COLORS.textMuted, textTransform: 'uppercase' }}>{label}</Text>
      <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color, marginTop: 2 }}>{value}</Text>
    </View>
  )
}

function SeverityCard({
  label,
  count,
  impact,
}: {
  label: string
  count: number
  impact: number
}) {
  return (
    <View
      style={{
        flex: 1,
        padding: 6,
        borderRadius: 3,
        backgroundColor: PDF_COLORS.rowAlt,
        borderWidth: 0.5,
        borderColor: PDF_COLORS.border,
      }}
    >
      <Text style={{ fontSize: 8, color: PDF_COLORS.textSecondary }}>{label}</Text>
      <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', marginTop: 2 }}>{count}</Text>
      <Text style={{ fontSize: 7, color: PDF_COLORS.textMuted, marginTop: 1 }}>
        Impacto: {formatBRLPdf(impact)}
      </Text>
    </View>
  )
}
