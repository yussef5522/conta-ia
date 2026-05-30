// Sprint Export CSV+PDF (29/05/2026) — Builder Fornecedores.

import { View, Text } from '@react-pdf/renderer'
import { buildCSV } from '@/lib/export/csv/base'
import { formatBRLForCsv } from '@/lib/export/csv/format'
import { PdfDocument } from '@/lib/export/pdf/PdfDocument'
import { pdfStyles, PDF_COLORS } from '@/lib/export/pdf/styles'
import type { TopSuppliersResult } from '@/lib/relatorios/top-suppliers'

export interface FornecedoresExportContext {
  empresaNome: string
  from: string
  to: string
  geradoEm: string
}

function formatBRLPdf(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function formatPct(v: number): string {
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

function formatTrendPct(v: number | null): string {
  if (v === null) return '—'
  return `${v >= 0 ? '+' : ''}${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

const TREND_LABEL: Record<string, string> = {
  NEW: 'novo',
  UP_STRONG: 'subiu forte',
  UP: 'subiu',
  STABLE: 'estável',
  DOWN: 'caiu',
  DOWN_STRONG: 'caiu forte',
  GONE: 'sumiu',
}

// CSV
export function renderFornecedoresCSV(data: TopSuppliersResult): string {
  const headers = ['Rank', 'Fornecedor', 'CNPJ', 'Valor', '% do total', 'Tendência', 'Variação (%)', 'Transações']
  const rows: Array<Array<string | number>> = data.rows.map((r) => [
    r.rank,
    r.nome,
    r.cnpj ?? '',
    formatBRLForCsv(r.amount),
    formatPct(r.percentDoTotal),
    TREND_LABEL[r.trend] ?? r.trend,
    formatTrendPct(r.trendPct),
    r.count,
  ])
  rows.push(['', 'TOTAL', '', formatBRLForCsv(data.totalAmount), '100,0%', '', '', data.totalCount])
  return buildCSV(headers, rows)
}

// PDF
export function renderFornecedoresPDF(
  data: TopSuppliersResult,
  ctx: FornecedoresExportContext,
) {
  return (
    <PdfDocument
      empresaNome={ctx.empresaNome}
      relatorioTitulo="Top Fornecedores"
      periodo={`${ctx.from} → ${ctx.to}`}
      geradoEm={ctx.geradoEm}
    >
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        <Stat label="Total pago" value={formatBRLPdf(data.totalAmount)} accent />
        <Stat label="Fornecedores únicos" value={String(data.totalSuppliersUnique)} />
        <Stat
          label="Concentração Top 5"
          value={formatPct(data.concentracaoTop5)}
          warning={data.concentracaoTop5 > 60}
        />
      </View>

      <View style={pdfStyles.section}>
        <Text style={pdfStyles.sectionTitle}>Top {data.rows.length} fornecedores</Text>
        <View style={pdfStyles.tHead} fixed>
          <View style={{ width: '5%' }}><Text style={pdfStyles.tHeadCell}>#</Text></View>
          <View style={{ width: '38%' }}><Text style={pdfStyles.tHeadCell}>Fornecedor</Text></View>
          <View style={{ width: '17%' }}><Text style={[pdfStyles.tHeadCell, { textAlign: 'right' }]}>Valor</Text></View>
          <View style={{ width: '10%' }}><Text style={[pdfStyles.tHeadCell, { textAlign: 'right' }]}>%</Text></View>
          <View style={{ width: '20%' }}><Text style={pdfStyles.tHeadCell}>Tendência</Text></View>
          <View style={{ width: '10%' }}><Text style={[pdfStyles.tHeadCell, { textAlign: 'right' }]}>Txs</Text></View>
        </View>
        {data.rows.map((r, i) => {
          const trendColor =
            r.trend === 'UP_STRONG' ? PDF_COLORS.negative
            : r.trend === 'UP' ? PDF_COLORS.negative
            : r.trend === 'DOWN_STRONG' ? PDF_COLORS.positive
            : r.trend === 'DOWN' ? PDF_COLORS.positive
            : r.trend === 'NEW' ? PDF_COLORS.brand
            : r.trend === 'GONE' ? PDF_COLORS.textMuted
            : PDF_COLORS.textSecondary
          return (
            <View
              key={r.supplierId}
              style={[pdfStyles.tRow, i % 2 === 1 ? pdfStyles.tRowAlt : null].filter(Boolean) as never}
              wrap={false}
            >
              <View style={{ width: '5%' }}>
                <Text style={[pdfStyles.tCell, pdfStyles.tCellBold]}>{r.rank}</Text>
              </View>
              <View style={{ width: '38%' }}>
                <Text style={[pdfStyles.tCell, pdfStyles.tCellBold]}>{r.nome}</Text>
                {r.cnpj && (
                  <Text style={{ fontSize: 7, color: PDF_COLORS.textMuted, marginTop: 1 }}>
                    {r.cnpj}
                  </Text>
                )}
              </View>
              <View style={{ width: '17%' }}>
                <Text style={[pdfStyles.tCell, pdfStyles.tCellRight, pdfStyles.tCellBold]}>{formatBRLPdf(r.amount)}</Text>
              </View>
              <View style={{ width: '10%' }}>
                <Text style={[pdfStyles.tCell, pdfStyles.tCellRight, pdfStyles.tCellMuted]}>{formatPct(r.percentDoTotal)}</Text>
              </View>
              <View style={{ width: '20%' }}>
                <Text style={[pdfStyles.tCell, { color: trendColor }]}>
                  {TREND_LABEL[r.trend] ?? r.trend} {r.trendPct !== null && `(${formatTrendPct(r.trendPct)})`}
                </Text>
              </View>
              <View style={{ width: '10%' }}>
                <Text style={[pdfStyles.tCell, pdfStyles.tCellRight, pdfStyles.tCellMuted]}>{r.count}</Text>
              </View>
            </View>
          )
        })}
      </View>
    </PdfDocument>
  )
}

function Stat({
  label, value, accent, warning,
}: { label: string; value: string; accent?: boolean; warning?: boolean }) {
  const bg = warning ? '#fef3c7' : accent ? PDF_COLORS.brandSoft : PDF_COLORS.rowAlt
  const border = warning ? '#f59e0b' : accent ? PDF_COLORS.brand : PDF_COLORS.border
  const color = warning ? '#b45309' : accent ? PDF_COLORS.brand : PDF_COLORS.textPrimary
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
