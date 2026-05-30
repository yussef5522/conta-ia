// Sprint Export CSV+PDF (29/05/2026) — Builder Funcionários (folha).

import { View, Text } from '@react-pdf/renderer'
import { buildCSV } from '@/lib/export/csv/base'
import { formatBRLForCsv } from '@/lib/export/csv/format'
import { PdfDocument } from '@/lib/export/pdf/PdfDocument'
import { pdfStyles, PDF_COLORS } from '@/lib/export/pdf/styles'
import type { PayrollResult } from '@/lib/relatorios/payroll'

export interface FuncionariosExportContext {
  empresaNome: string
  from: string
  to: string
  filterTipo?: string | null
  geradoEm: string
}

function formatBRLPdf(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function formatPct(v: number): string {
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

// CSV
export function renderFuncionariosCSV(data: PayrollResult): string {
  // Aba "Tipos" virtual: tabela única com 2 blocos
  const headers = ['Funcionário', 'Tipo', 'Status', 'Valor pago', '% do total', 'Transações']
  const rows: Array<Array<string | number>> = []

  // Bloco 1: por funcionário
  for (const r of data.rows) {
    rows.push([
      r.nome,
      r.tipo,
      r.ativo ? 'Ativo' : 'Inativo',
      formatBRLForCsv(r.amount),
      formatPct(r.percentDoTotal),
      r.count,
    ])
  }

  // Bloco 2: agregado por tipo
  rows.push(['', '', '', '', '', ''])
  rows.push(['BREAKDOWN POR TIPO', '', '', '', '', ''])
  for (const b of data.byType) {
    rows.push([
      `(${b.tipo})`, b.tipo, '',
      formatBRLForCsv(b.amount),
      formatPct(b.percent),
      b.count,
    ])
  }

  // Total
  rows.push(['', '', '', '', '', ''])
  rows.push([
    'TOTAL', '', '',
    formatBRLForCsv(data.totals.valorTotal),
    '100,0%',
    data.totals.transacoesCount,
  ])

  return buildCSV(headers, rows)
}

const TIPO_LABEL: Record<string, string> = {
  CLT: 'CLT',
  ESTAGIO: 'Estágio',
  PJ: 'PJ',
  AUTONOMO: 'Autônomo',
  OUTRO: 'Outro',
}

// PDF
export function renderFuncionariosPDF(
  data: PayrollResult,
  ctx: FuncionariosExportContext,
) {
  const periodoStr = `${ctx.from} → ${ctx.to}${ctx.filterTipo ? ` · Filtro: ${TIPO_LABEL[ctx.filterTipo] ?? ctx.filterTipo}` : ''}`
  return (
    <PdfDocument
      empresaNome={ctx.empresaNome}
      relatorioTitulo="Folha de Pagamento"
      periodo={periodoStr}
      geradoEm={ctx.geradoEm}
    >
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        <Stat label="Total pago" value={formatBRLPdf(data.totals.valorTotal)} accent />
        <Stat label="Funcionários pagos" value={`${data.totals.funcionariosPagos} / ${data.totals.funcionariosAtivos}`} />
        <Stat label="Média / funcionário" value={formatBRLPdf(data.totals.mediaPorFuncionario)} />
      </View>

      {/* Breakdown por tipo */}
      {data.byType.length > 0 && (
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Breakdown por tipo de vínculo</Text>
          <View style={pdfStyles.tHead} fixed>
            <View style={{ width: '40%' }}><Text style={pdfStyles.tHeadCell}>Tipo</Text></View>
            <View style={{ width: '20%' }}><Text style={[pdfStyles.tHeadCell, { textAlign: 'right' }]}>Funcionários</Text></View>
            <View style={{ width: '25%' }}><Text style={[pdfStyles.tHeadCell, { textAlign: 'right' }]}>Valor total</Text></View>
            <View style={{ width: '15%' }}><Text style={[pdfStyles.tHeadCell, { textAlign: 'right' }]}>% total</Text></View>
          </View>
          {data.byType.map((b, i) => (
            <View
              key={b.tipo}
              style={[pdfStyles.tRow, i % 2 === 1 ? pdfStyles.tRowAlt : null].filter(Boolean) as never}
              wrap={false}
            >
              <View style={{ width: '40%' }}>
                <Text style={[pdfStyles.tCell, pdfStyles.tCellBold]}>{TIPO_LABEL[b.tipo] ?? b.tipo}</Text>
              </View>
              <View style={{ width: '20%' }}>
                <Text style={[pdfStyles.tCell, pdfStyles.tCellRight]}>{b.count}</Text>
              </View>
              <View style={{ width: '25%' }}>
                <Text style={[pdfStyles.tCell, pdfStyles.tCellRight, pdfStyles.tCellBold]}>{formatBRLPdf(b.amount)}</Text>
              </View>
              <View style={{ width: '15%' }}>
                <Text style={[pdfStyles.tCell, pdfStyles.tCellRight, pdfStyles.tCellMuted]}>{formatPct(b.percent)}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Detalhamento por funcionário */}
      {data.rows.length > 0 && (
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Detalhamento por funcionário</Text>
          <View style={pdfStyles.tHead} fixed>
            <View style={{ width: '38%' }}><Text style={pdfStyles.tHeadCell}>Funcionário</Text></View>
            <View style={{ width: '15%' }}><Text style={pdfStyles.tHeadCell}>Tipo</Text></View>
            <View style={{ width: '12%' }}><Text style={pdfStyles.tHeadCell}>Status</Text></View>
            <View style={{ width: '20%' }}><Text style={[pdfStyles.tHeadCell, { textAlign: 'right' }]}>Valor pago</Text></View>
            <View style={{ width: '8%' }}><Text style={[pdfStyles.tHeadCell, { textAlign: 'right' }]}>%</Text></View>
            <View style={{ width: '7%' }}><Text style={[pdfStyles.tHeadCell, { textAlign: 'right' }]}>Txs</Text></View>
          </View>
          {data.rows.map((r, i) => (
            <View
              key={r.employeeId}
              style={[pdfStyles.tRow, i % 2 === 1 ? pdfStyles.tRowAlt : null].filter(Boolean) as never}
              wrap={false}
            >
              <View style={{ width: '38%' }}>
                <Text style={[pdfStyles.tCell, pdfStyles.tCellBold]}>{r.nome}</Text>
              </View>
              <View style={{ width: '15%' }}>
                <Text style={[pdfStyles.tCell, pdfStyles.tCellMuted]}>{TIPO_LABEL[r.tipo] ?? r.tipo}</Text>
              </View>
              <View style={{ width: '12%' }}>
                <Text
                  style={[
                    pdfStyles.tCell,
                    { color: r.ativo ? PDF_COLORS.positive : PDF_COLORS.textMuted },
                  ]}
                >
                  {r.ativo ? 'Ativo' : 'Inativo'}
                </Text>
              </View>
              <View style={{ width: '20%' }}>
                <Text style={[pdfStyles.tCell, pdfStyles.tCellRight, pdfStyles.tCellBold]}>{formatBRLPdf(r.amount)}</Text>
              </View>
              <View style={{ width: '8%' }}>
                <Text style={[pdfStyles.tCell, pdfStyles.tCellRight, pdfStyles.tCellMuted]}>{formatPct(r.percentDoTotal)}</Text>
              </View>
              <View style={{ width: '7%' }}>
                <Text style={[pdfStyles.tCell, pdfStyles.tCellRight, pdfStyles.tCellMuted]}>{r.count}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
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
