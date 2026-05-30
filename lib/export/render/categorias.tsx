// Sprint Export CSV+PDF (29/05/2026) — Builder Categorias.

import { View, Text } from '@react-pdf/renderer'
import { buildCSV } from '@/lib/export/csv/base'
import { formatBRLForCsv } from '@/lib/export/csv/format'
import { PdfDocument } from '@/lib/export/pdf/PdfDocument'
import { pdfStyles, PDF_COLORS } from '@/lib/export/pdf/styles'
import type { TopCategoriasResult } from '@/lib/relatorios/categorias'

export interface CategoriasExportContext {
  empresaNome: string
  tipo: 'DESPESA' | 'RECEITA' | 'TODOS'
  regime: 'competencia' | 'caixa'
  from: string
  to: string
  geradoEm: string
}

const TIPO_LABEL = { DESPESA: 'Despesas', RECEITA: 'Receitas', TODOS: 'Todos' } as const
const REGIME_LABEL = { competencia: 'Regime de competência', caixa: 'Regime de caixa' } as const

function formatBRLPdf(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function formatPct(v: number): string {
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

// CSV
export function renderCategoriasCSV(data: TopCategoriasResult): string {
  const headers = ['Categoria', 'Grupo DRE', 'Valor', '% do total', 'Transações']
  const rows: Array<Array<string | number>> = data.rows.map((r) => [
    r.categoryName,
    r.dreGroup ?? '',
    formatBRLForCsv(r.amount),
    formatPct(r.percent),
    r.count,
  ])
  if (data.outras) {
    rows.push([data.outras.categoryName, '', formatBRLForCsv(data.outras.amount), formatPct(data.outras.percent), data.outras.count])
  }
  rows.push(['TOTAL', '', formatBRLForCsv(data.totalAmount), '100,0%', data.totalCount])
  return buildCSV(headers, rows)
}

// PDF
export function renderCategoriasPDF(
  data: TopCategoriasResult,
  ctx: CategoriasExportContext,
) {
  return (
    <PdfDocument
      empresaNome={ctx.empresaNome}
      relatorioTitulo="Top Categorias"
      periodo={`${TIPO_LABEL[ctx.tipo]} · ${ctx.from} → ${ctx.to} · ${REGIME_LABEL[ctx.regime]}`}
      geradoEm={ctx.geradoEm}
    >
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        <Stat label="Total" value={formatBRLPdf(data.totalAmount)} accent />
        <Stat label="Categorias" value={String(data.totalCategorias)} />
        <Stat label="Transações" value={String(data.totalCount)} />
      </View>
      <View style={pdfStyles.section}>
        <Text style={pdfStyles.sectionTitle}>Top {data.rows.length} categorias</Text>
        <View style={pdfStyles.tHead} fixed>
          <View style={{ width: '40%' }}><Text style={pdfStyles.tHeadCell}>Categoria</Text></View>
          <View style={{ width: '25%' }}><Text style={pdfStyles.tHeadCell}>Grupo</Text></View>
          <View style={{ width: '17%' }}><Text style={[pdfStyles.tHeadCell, { textAlign: 'right' }]}>Valor</Text></View>
          <View style={{ width: '10%' }}><Text style={[pdfStyles.tHeadCell, { textAlign: 'right' }]}>%</Text></View>
          <View style={{ width: '8%' }}><Text style={[pdfStyles.tHeadCell, { textAlign: 'right' }]}>Txs</Text></View>
        </View>
        {[...data.rows, ...(data.outras ? [data.outras] : [])].map((r, i) => (
          <View
            key={r.categoryId ?? `outras-${i}`}
            style={[pdfStyles.tRow, i % 2 === 1 ? pdfStyles.tRowAlt : null].filter(Boolean) as never}
            wrap={false}
          >
            <View style={{ width: '40%' }}>
              <Text style={[pdfStyles.tCell, pdfStyles.tCellBold]}>{r.categoryName}</Text>
            </View>
            <View style={{ width: '25%' }}>
              <Text style={[pdfStyles.tCell, pdfStyles.tCellMuted]}>
                {(r.dreGroup ?? '').replace(/_/g, ' ').toLowerCase()}
              </Text>
            </View>
            <View style={{ width: '17%' }}>
              <Text style={[pdfStyles.tCell, pdfStyles.tCellRight, pdfStyles.tCellBold]}>{formatBRLPdf(r.amount)}</Text>
            </View>
            <View style={{ width: '10%' }}>
              <Text style={[pdfStyles.tCell, pdfStyles.tCellRight, pdfStyles.tCellMuted]}>{formatPct(r.percent)}</Text>
            </View>
            <View style={{ width: '8%' }}>
              <Text style={[pdfStyles.tCell, pdfStyles.tCellRight, pdfStyles.tCellMuted]}>{r.count}</Text>
            </View>
          </View>
        ))}
        <View style={[pdfStyles.tRow, { borderTopWidth: 1.2, borderTopColor: PDF_COLORS.textPrimary }]}>
          <View style={{ width: '65%' }}>
            <Text style={[pdfStyles.tCell, pdfStyles.tCellBold]}>TOTAL</Text>
          </View>
          <View style={{ width: '17%' }}>
            <Text style={[pdfStyles.tCell, pdfStyles.tCellRight, pdfStyles.tCellBold]}>{formatBRLPdf(data.totalAmount)}</Text>
          </View>
          <View style={{ width: '10%' }}>
            <Text style={[pdfStyles.tCell, pdfStyles.tCellRight, pdfStyles.tCellBold]}>100,0%</Text>
          </View>
          <View style={{ width: '8%' }}>
            <Text style={[pdfStyles.tCell, pdfStyles.tCellRight, pdfStyles.tCellBold]}>{data.totalCount}</Text>
          </View>
        </View>
      </View>
    </PdfDocument>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View
      style={{
        flex: 1, padding: 8, borderRadius: 4,
        backgroundColor: accent ? PDF_COLORS.brandSoft : PDF_COLORS.rowAlt,
        borderWidth: 0.5,
        borderColor: accent ? PDF_COLORS.brand : PDF_COLORS.border,
      }}
    >
      <Text style={{ fontSize: 7, color: PDF_COLORS.textMuted, textTransform: 'uppercase' }}>{label}</Text>
      <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: accent ? PDF_COLORS.brand : PDF_COLORS.textPrimary, marginTop: 2 }}>{value}</Text>
    </View>
  )
}
