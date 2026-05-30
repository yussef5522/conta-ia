// Sprint Export CSV+PDF (29/05/2026) — Builder Análise de Variação.

import { View, Text } from '@react-pdf/renderer'
import { buildCSV } from '@/lib/export/csv/base'
import { formatBRLForCsv } from '@/lib/export/csv/format'
import { PdfDocument } from '@/lib/export/pdf/PdfDocument'
import { PdfWaterfall } from '@/lib/export/pdf/PdfWaterfall'
import { pdfStyles, PDF_COLORS } from '@/lib/export/pdf/styles'
import type { AnaliseVariacaoResult } from '@/lib/relatorios/analise-variacao'

export interface AnaliseVariacaoExportContext {
  empresaNome: string
  tipo: 'DESPESA' | 'RECEITA' | 'TODOS'
  regime: 'competencia' | 'caixa'
  mode: 'mes-vs-mes' | 'mes-vs-media'
  geradoEm: string
}

const TIPO_LABEL = { DESPESA: 'Despesas', RECEITA: 'Receitas', TODOS: 'Todos os lançamentos' } as const
const REGIME_LABEL = { competencia: 'Regime de competência', caixa: 'Regime de caixa' } as const

function periodoSubtitulo(data: AnaliseVariacaoResult, ctx: AnaliseVariacaoExportContext): string {
  return `${TIPO_LABEL[ctx.tipo]} · ${data.antigoLabel} → ${data.novoLabel} · ${REGIME_LABEL[ctx.regime]}`
}

const TIPO_BR: Record<string, string> = {
  aumentou: 'aumentou',
  reduziu: 'reduziu',
  estavel: 'estável',
}

// ──────────────────────────────────────────────────────────────
// CSV
// ──────────────────────────────────────────────────────────────

export function renderAnaliseVariacaoCSV(data: AnaliseVariacaoResult): string {
  const headers = ['Categoria', data.antigoLabel, data.novoLabel, 'Diferença', 'Tipo']
  const rows: Array<Array<string | number>> = data.drivers
    .filter((d) => d.tipo !== 'estavel')
    .map((d) => [
      d.categoryName,
      d.valorAntigo > 0 ? formatBRLForCsv(d.valorAntigo) : '',
      d.valorNovo > 0 ? formatBRLForCsv(d.valorNovo) : '',
      formatBRLForCsv(d.diferenca),
      TIPO_BR[d.tipo] ?? d.tipo,
    ])

  // Linha total
  rows.push([
    'TOTAL',
    formatBRLForCsv(data.totalAntigo),
    formatBRLForCsv(data.totalNovo),
    formatBRLForCsv(data.diferencaTotal),
    '',
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

function formatBRLSigned(v: number): string {
  const formatted = Math.abs(v).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
  return v >= 0 ? `+${formatted}` : `-${formatted}`
}

export function renderAnaliseVariacaoPDF(
  data: AnaliseVariacaoResult,
  ctx: AnaliseVariacaoExportContext,
) {
  const visiveis = data.drivers.filter((d) => d.tipo !== 'estavel')
  const variacaoCor = data.diferencaTotal > 0 ? PDF_COLORS.negative : PDF_COLORS.positive

  return (
    <PdfDocument
      empresaNome={ctx.empresaNome}
      relatorioTitulo="Análise de Variação"
      periodo={periodoSubtitulo(data, ctx)}
      geradoEm={ctx.geradoEm}
    >
      {/* Título narrativo */}
      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', lineHeight: 1.4 }}>
          {data.tituloNarrativo}
        </Text>
      </View>

      {/* Resumo executivo: 3 cards */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        <View
          style={{
            flex: 1,
            padding: 8,
            borderRadius: 4,
            backgroundColor: PDF_COLORS.rowAlt,
            borderWidth: 0.5,
            borderColor: PDF_COLORS.border,
          }}
        >
          <Text style={{ fontSize: 7, color: PDF_COLORS.textMuted, textTransform: 'uppercase' }}>
            {data.antigoLabel}
          </Text>
          <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: PDF_COLORS.textSecondary, marginTop: 2 }}>
            {formatBRLPdf(data.totalAntigo)}
          </Text>
        </View>
        <View
          style={{
            flex: 1,
            padding: 8,
            borderRadius: 4,
            backgroundColor: PDF_COLORS.rowAlt,
            borderWidth: 0.5,
            borderColor: PDF_COLORS.border,
          }}
        >
          <Text style={{ fontSize: 7, color: PDF_COLORS.textMuted, textTransform: 'uppercase' }}>
            {data.novoLabel}
          </Text>
          <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 2 }}>
            {formatBRLPdf(data.totalNovo)}
          </Text>
        </View>
        <View
          style={{
            flex: 1,
            padding: 8,
            borderRadius: 4,
            backgroundColor: data.diferencaTotal > 0 ? '#fef2f2' : '#ecfdf5',
            borderWidth: 0.5,
            borderColor: variacaoCor,
          }}
        >
          <Text style={{ fontSize: 7, color: PDF_COLORS.textMuted, textTransform: 'uppercase' }}>
            Diferença
          </Text>
          <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: variacaoCor, marginTop: 2 }}>
            {formatBRLSigned(data.diferencaTotal)}
          </Text>
        </View>
      </View>

      {/* Waterfall nativo */}
      <View style={pdfStyles.section}>
        <Text style={pdfStyles.sectionTitle}>Cascata de variação por categoria</Text>
        <PdfWaterfall bars={data.waterfallBars} />
      </View>

      {/* Tabela completa de drivers */}
      <View style={pdfStyles.section}>
        <Text style={pdfStyles.sectionTitle}>
          Onde foi a diferença ({visiveis.length} drivers)
        </Text>
        <View style={pdfStyles.tHead} fixed>
          <View style={{ width: '40%' }}>
            <Text style={pdfStyles.tHeadCell}>Categoria</Text>
          </View>
          <View style={{ width: '20%' }}>
            <Text style={[pdfStyles.tHeadCell, { textAlign: 'right' }]}>
              {data.antigoLabel.toUpperCase()}
            </Text>
          </View>
          <View style={{ width: '20%' }}>
            <Text style={[pdfStyles.tHeadCell, { textAlign: 'right' }]}>
              {data.novoLabel.toUpperCase()}
            </Text>
          </View>
          <View style={{ width: '20%' }}>
            <Text style={[pdfStyles.tHeadCell, { textAlign: 'right' }]}>Diferença</Text>
          </View>
        </View>
        {visiveis.map((d, idx) => {
          const corDif = d.diferenca >= 0 ? PDF_COLORS.negative : PDF_COLORS.positive
          return (
            <View
              key={d.categoryId ?? `__${idx}`}
              style={[
                pdfStyles.tRow,
                idx % 2 === 1 ? pdfStyles.tRowAlt : null,
              ].filter(Boolean) as never}
              wrap={false}
            >
              <View style={{ width: '40%' }}>
                <Text style={[pdfStyles.tCell, pdfStyles.tCellBold]}>{d.categoryName}</Text>
              </View>
              <View style={{ width: '20%' }}>
                <Text style={[pdfStyles.tCell, pdfStyles.tCellRight, pdfStyles.tCellMuted]}>
                  {d.valorAntigo > 0 ? formatBRLPdf(d.valorAntigo) : '—'}
                </Text>
              </View>
              <View style={{ width: '20%' }}>
                <Text style={[pdfStyles.tCell, pdfStyles.tCellRight]}>
                  {d.valorNovo > 0 ? formatBRLPdf(d.valorNovo) : '—'}
                </Text>
              </View>
              <View style={{ width: '20%' }}>
                <Text
                  style={[
                    pdfStyles.tCell,
                    pdfStyles.tCellRight,
                    pdfStyles.tCellBold,
                    { color: corDif },
                  ]}
                >
                  {formatBRLSigned(d.diferenca)}
                </Text>
              </View>
            </View>
          )
        })}
        {/* Linha total */}
        <View
          style={[
            pdfStyles.tRow,
            { borderTopWidth: 1.2, borderTopColor: PDF_COLORS.textPrimary },
          ]}
        >
          <View style={{ width: '40%' }}>
            <Text style={[pdfStyles.tCell, pdfStyles.tCellBold]}>TOTAL</Text>
          </View>
          <View style={{ width: '20%' }}>
            <Text style={[pdfStyles.tCell, pdfStyles.tCellRight, pdfStyles.tCellBold]}>
              {formatBRLPdf(data.totalAntigo)}
            </Text>
          </View>
          <View style={{ width: '20%' }}>
            <Text style={[pdfStyles.tCell, pdfStyles.tCellRight, pdfStyles.tCellBold]}>
              {formatBRLPdf(data.totalNovo)}
            </Text>
          </View>
          <View style={{ width: '20%' }}>
            <Text
              style={[
                pdfStyles.tCell,
                pdfStyles.tCellRight,
                pdfStyles.tCellBold,
                { color: variacaoCor },
              ]}
            >
              {formatBRLSigned(data.diferencaTotal)}
            </Text>
          </View>
        </View>
      </View>
    </PdfDocument>
  )
}
