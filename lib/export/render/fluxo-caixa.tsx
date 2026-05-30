// Sprint Export CSV+PDF (29/05/2026) — Builder Fluxo de Caixa.

import { View, Text } from '@react-pdf/renderer'
import { buildCSV } from '@/lib/export/csv/base'
import { formatBRLForCsv } from '@/lib/export/csv/format'
import { PdfDocument } from '@/lib/export/pdf/PdfDocument'
import { pdfStyles, PDF_COLORS } from '@/lib/export/pdf/styles'

const MES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  return `${MES[m - 1]}/${String(y).slice(-2)}`
}

export interface FluxoCaixaExportContext {
  empresaNome: string
  geradoEm: string
  meses: number
}

export interface FluxoCaixaData {
  saldoAtual: number
  realizado: {
    byMonth: Array<{ monthKey: string; income: number; expense: number; net: number }>
    totals: { income: number; expense: number; net: number }
    acumulado: Array<{ monthKey: string; saldo: number }>
  }
  projecao: {
    buckets: Array<{
      id: '30d' | '60d' | '90d'
      label: string
      entradas: number
      saidas: number
      resultado: number
    }>
    total: { entradas: number; saidas: number; resultado: number }
  }
}

function formatBRLPdf(v: number): string {
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

// ──────────────────────────────────────────────────────────────
// CSV
// ──────────────────────────────────────────────────────────────

export function renderFluxoCaixaCSV(data: FluxoCaixaData): string {
  const headers = ['Mês', 'Entradas', 'Saídas', 'Resultado (net)', 'Saldo acumulado']
  const rows: Array<Array<string | number>> = data.realizado.byMonth.map((m, i) => [
    monthLabel(m.monthKey),
    formatBRLForCsv(m.income),
    formatBRLForCsv(-m.expense),
    formatBRLForCsv(m.net),
    formatBRLForCsv(data.realizado.acumulado[i]?.saldo ?? 0),
  ])

  // Linha total realizado
  rows.push([
    'TOTAL REALIZADO',
    formatBRLForCsv(data.realizado.totals.income),
    formatBRLForCsv(-data.realizado.totals.expense),
    formatBRLForCsv(data.realizado.totals.net),
    '',
  ])

  // Sep
  rows.push(['', '', '', '', ''])
  rows.push(['PROJEÇÃO (acum. a partir do saldo atual)', '', '', '', ''])
  for (const b of data.projecao.buckets) {
    const saldoFinal = data.saldoAtual + b.resultado
    rows.push([
      b.label,
      formatBRLForCsv(b.entradas),
      formatBRLForCsv(-b.saidas),
      formatBRLForCsv(b.resultado),
      formatBRLForCsv(saldoFinal),
    ])
  }

  return buildCSV(headers, rows)
}

// ──────────────────────────────────────────────────────────────
// PDF
// ──────────────────────────────────────────────────────────────

export function renderFluxoCaixaPDF(
  data: FluxoCaixaData,
  ctx: FluxoCaixaExportContext,
) {
  return (
    <PdfDocument
      empresaNome={ctx.empresaNome}
      relatorioTitulo="Fluxo de Caixa"
      periodo={`Realizado últimos ${ctx.meses} meses + Projeção 30/60/90 dias`}
      geradoEm={ctx.geradoEm}
    >
      {/* Stats topo */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <StatCard label="Saldo atual" value={formatBRLPdf(data.saldoAtual)} accent />
        <StatCard label="Net realizado" value={formatBRLPdf(data.realizado.totals.net)} />
        <StatCard
          label="Saldo 90d (proj.)"
          value={formatBRLPdf(
            data.saldoAtual +
              (data.projecao.buckets.find((b) => b.id === '90d')?.resultado ?? 0),
          )}
        />
      </View>

      {/* Realizado */}
      <View style={pdfStyles.section}>
        <Text style={pdfStyles.sectionTitle}>Realizado mensal</Text>
        <View style={pdfStyles.tHead} fixed>
          <View style={{ width: '22%' }}>
            <Text style={pdfStyles.tHeadCell}>Mês</Text>
          </View>
          <View style={{ width: '20%' }}>
            <Text style={[pdfStyles.tHeadCell, { textAlign: 'right' }]}>Entradas</Text>
          </View>
          <View style={{ width: '20%' }}>
            <Text style={[pdfStyles.tHeadCell, { textAlign: 'right' }]}>Saídas</Text>
          </View>
          <View style={{ width: '18%' }}>
            <Text style={[pdfStyles.tHeadCell, { textAlign: 'right' }]}>Net</Text>
          </View>
          <View style={{ width: '20%' }}>
            <Text style={[pdfStyles.tHeadCell, { textAlign: 'right' }]}>Saldo</Text>
          </View>
        </View>
        {data.realizado.byMonth.map((m, i) => {
          const saldo = data.realizado.acumulado[i]?.saldo ?? 0
          const netColor = m.net >= 0 ? PDF_COLORS.positive : PDF_COLORS.negative
          return (
            <View
              key={m.monthKey}
              style={[
                pdfStyles.tRow,
                i % 2 === 1 ? pdfStyles.tRowAlt : null,
              ].filter(Boolean) as never}
              wrap={false}
            >
              <View style={{ width: '22%' }}>
                <Text style={[pdfStyles.tCell, pdfStyles.tCellBold]}>
                  {monthLabel(m.monthKey)}
                </Text>
              </View>
              <View style={{ width: '20%' }}>
                <Text style={[pdfStyles.tCell, pdfStyles.tCellRight]}>
                  {formatBRLPdf(m.income)}
                </Text>
              </View>
              <View style={{ width: '20%' }}>
                <Text style={[pdfStyles.tCell, pdfStyles.tCellRight, pdfStyles.tCellMuted]}>
                  -{formatBRLPdf(m.expense)}
                </Text>
              </View>
              <View style={{ width: '18%' }}>
                <Text
                  style={[
                    pdfStyles.tCell,
                    pdfStyles.tCellRight,
                    pdfStyles.tCellBold,
                    { color: netColor },
                  ]}
                >
                  {formatBRLPdf(m.net)}
                </Text>
              </View>
              <View style={{ width: '20%' }}>
                <Text style={[pdfStyles.tCell, pdfStyles.tCellRight, pdfStyles.tCellBold]}>
                  {formatBRLPdf(saldo)}
                </Text>
              </View>
            </View>
          )
        })}
      </View>

      {/* Projeção */}
      <View style={pdfStyles.section}>
        <Text style={pdfStyles.sectionTitle}>Projeção 30/60/90 dias</Text>
        <View style={pdfStyles.tHead}>
          <View style={{ width: '20%' }}>
            <Text style={pdfStyles.tHeadCell}>Janela</Text>
          </View>
          <View style={{ width: '20%' }}>
            <Text style={[pdfStyles.tHeadCell, { textAlign: 'right' }]}>Entradas</Text>
          </View>
          <View style={{ width: '20%' }}>
            <Text style={[pdfStyles.tHeadCell, { textAlign: 'right' }]}>Saídas</Text>
          </View>
          <View style={{ width: '20%' }}>
            <Text style={[pdfStyles.tHeadCell, { textAlign: 'right' }]}>Net</Text>
          </View>
          <View style={{ width: '20%' }}>
            <Text style={[pdfStyles.tHeadCell, { textAlign: 'right' }]}>Saldo final</Text>
          </View>
        </View>
        {data.projecao.buckets.map((b, i) => {
          const p = {
            label: b.label,
            inc: b.entradas,
            exp: b.saidas,
            net: b.resultado,
            sf: data.saldoAtual + b.resultado,
          }
          const netColor = p.net >= 0 ? PDF_COLORS.positive : PDF_COLORS.negative
          const sfColor = p.sf >= 0 ? PDF_COLORS.textPrimary : PDF_COLORS.negative
          return (
            <View
              key={p.label}
              style={[
                pdfStyles.tRow,
                i % 2 === 1 ? pdfStyles.tRowAlt : null,
              ].filter(Boolean) as never}
              wrap={false}
            >
              <View style={{ width: '20%' }}>
                <Text style={[pdfStyles.tCell, pdfStyles.tCellBold]}>{p.label}</Text>
              </View>
              <View style={{ width: '20%' }}>
                <Text style={[pdfStyles.tCell, pdfStyles.tCellRight]}>
                  {formatBRLPdf(p.inc)}
                </Text>
              </View>
              <View style={{ width: '20%' }}>
                <Text style={[pdfStyles.tCell, pdfStyles.tCellRight, pdfStyles.tCellMuted]}>
                  -{formatBRLPdf(p.exp)}
                </Text>
              </View>
              <View style={{ width: '20%' }}>
                <Text
                  style={[
                    pdfStyles.tCell,
                    pdfStyles.tCellRight,
                    pdfStyles.tCellBold,
                    { color: netColor },
                  ]}
                >
                  {formatBRLPdf(p.net)}
                </Text>
              </View>
              <View style={{ width: '20%' }}>
                <Text
                  style={[
                    pdfStyles.tCell,
                    pdfStyles.tCellRight,
                    pdfStyles.tCellBold,
                    { color: sfColor },
                  ]}
                >
                  {formatBRLPdf(p.sf)}
                </Text>
              </View>
            </View>
          )
        })}
      </View>
    </PdfDocument>
  )
}

function StatCard({
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
      <Text style={{ fontSize: 7, color: PDF_COLORS.textMuted, textTransform: 'uppercase' }}>
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
