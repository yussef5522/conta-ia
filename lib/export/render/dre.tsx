// Sprint Export CSV+PDF (29/05/2026) — Builder DRE Gerencial.

import { View, Text } from '@react-pdf/renderer'
import { buildCSV } from '@/lib/export/csv/base'
import { formatBRLForCsv } from '@/lib/export/csv/format'
import { PdfDocument } from '@/lib/export/pdf/PdfDocument'
import { pdfStyles, PDF_COLORS } from '@/lib/export/pdf/styles'
import type { DREResult } from '@/lib/dre/types'

export interface DREExportContext {
  empresaNome: string
  regime: 'competence' | 'cash'
  periodoLabel: string // "Janeiro/2026" ou "01/01 → 31/03/2026"
  geradoEm: string
}

const REGIME_LABEL = {
  competence: 'Regime de competência',
  cash: 'Regime de caixa',
} as const

function formatBRLPdf(v: number): string {
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

function formatPct(v: number | null): string {
  if (v === null || !isFinite(v)) return '—'
  return `${(v * 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`
}

// ──────────────────────────────────────────────────────────────
// CSV — linhas hierárquicas (grupo > categorias)
// ──────────────────────────────────────────────────────────────

export function renderDRECSV(data: DREResult): string {
  const headers = ['Linha', 'Grupo', 'Valor', '% Vertical', '% Variação']
  const rows: Array<Array<string | number>> = []

  for (const group of data.groups) {
    rows.push([
      group.groupLabel,
      'GRUPO',
      formatBRLForCsv(group.total),
      group.verticalPct !== null ? formatPct(group.verticalPct) : '',
      group.horizontalPct !== null ? formatPct(group.horizontalPct) : '',
    ])
    for (const cat of group.categories) {
      rows.push([
        `  ${cat.category.name}`,
        group.groupLabel,
        formatBRLForCsv(cat.total),
        cat.verticalPct !== null ? formatPct(cat.verticalPct) : '',
        cat.horizontalPct !== null ? formatPct(cat.horizontalPct) : '',
      ])
    }
  }

  // Totais consolidados (chave do DRE)
  rows.push(['', '', '', '', ''])
  rows.push(['RECEITA BRUTA', 'TOTAL', formatBRLForCsv(data.totals.receitaBruta), '', ''])
  rows.push(['(-) Deduções', 'TOTAL', formatBRLForCsv(-data.totals.totalDeducoes), '', ''])
  rows.push(['RECEITA LÍQUIDA', 'TOTAL', formatBRLForCsv(data.totals.receitaLiquida), '100,0%', ''])
  rows.push(['(-) Custos', 'TOTAL', formatBRLForCsv(-data.totals.totalCustos), '', ''])
  rows.push(['LUCRO BRUTO', 'TOTAL', formatBRLForCsv(data.totals.lucroBruto), formatPct(data.totals.margemBruta / 100), ''])
  rows.push(['(-) Despesas operacionais', 'TOTAL', formatBRLForCsv(-data.totals.totalDespesasOperacionais), '', ''])
  rows.push(['RESULTADO OPERACIONAL', 'TOTAL', formatBRLForCsv(data.totals.resultadoOperacional), formatPct(data.totals.margemOperacional / 100), ''])
  rows.push(['(±) Resultado financeiro', 'TOTAL', formatBRLForCsv(data.totals.resultadoFinanceiro), '', ''])
  rows.push(['LAIR', 'TOTAL', formatBRLForCsv(data.totals.lair), '', ''])
  rows.push(['(-) Impostos sobre lucro', 'TOTAL', formatBRLForCsv(-data.totals.impostosSobreLucro), '', ''])
  rows.push(['LUCRO LÍQUIDO', 'TOTAL', formatBRLForCsv(data.totals.lucroLiquido), formatPct(data.totals.margemLiquida / 100), ''])

  return buildCSV(headers, rows)
}

// ──────────────────────────────────────────────────────────────
// PDF
// ──────────────────────────────────────────────────────────────

interface DRELine {
  label: string
  value: number
  pctVertical?: number | null // 0..1
  bold?: boolean
  /** Linha de subtotal (border-top + sublinhado) */
  emphasis?: boolean
  /** Sub-item indentado (categoria dentro do grupo) */
  indented?: boolean
}

function buildLines(data: DREResult): DRELine[] {
  const lines: DRELine[] = []
  const t = data.totals

  lines.push({ label: 'Receita Bruta', value: t.receitaBruta, bold: true })
  // Listar categorias do grupo Receita Bruta como sub-itens, se houver
  const receitaGroup = data.groups.find((g) => g.group === 'RECEITA_BRUTA')
  if (receitaGroup) {
    for (const c of receitaGroup.categories) {
      lines.push({ label: c.category.name, value: c.total, indented: true })
    }
  }

  if (t.totalDeducoes > 0) {
    lines.push({ label: '(-) Deduções', value: -t.totalDeducoes })
  }

  lines.push({
    label: 'Receita Líquida',
    value: t.receitaLiquida,
    bold: true,
    emphasis: true,
    pctVertical: 1,
  })

  if (t.totalCustos > 0) {
    lines.push({ label: '(-) Custos', value: -t.totalCustos })
    const cpvGroup = data.groups.find((g) => g.group === 'CUSTO_PRODUTO_VENDIDO')
    if (cpvGroup) {
      for (const c of cpvGroup.categories) {
        lines.push({ label: c.category.name, value: -c.total, indented: true })
      }
    }
  }

  lines.push({
    label: 'Lucro Bruto',
    value: t.lucroBruto,
    bold: true,
    emphasis: true,
    pctVertical: t.receitaLiquida ? t.lucroBruto / t.receitaLiquida : null,
  })

  if (t.totalOutrasReceitas > 0) {
    lines.push({ label: '(+) Outras receitas', value: t.totalOutrasReceitas })
  }
  if (t.totalDespesasOperacionais > 0) {
    lines.push({ label: '(-) Despesas operacionais', value: -t.totalDespesasOperacionais })
    if (t.totalDespesasPessoal > 0) {
      lines.push({ label: 'Pessoal', value: -t.totalDespesasPessoal, indented: true })
    }
    if (t.totalDespesasComerciais > 0) {
      lines.push({ label: 'Comerciais', value: -t.totalDespesasComerciais, indented: true })
    }
    if (t.totalDespesasAdministrativas > 0) {
      lines.push({ label: 'Administrativas', value: -t.totalDespesasAdministrativas, indented: true })
    }
    if (t.totalOutrasDespesas > 0) {
      lines.push({ label: 'Outras despesas', value: -t.totalOutrasDespesas, indented: true })
    }
  }

  lines.push({
    label: 'Resultado Operacional',
    value: t.resultadoOperacional,
    bold: true,
    emphasis: true,
    pctVertical: t.receitaLiquida ? t.resultadoOperacional / t.receitaLiquida : null,
  })

  if (t.resultadoFinanceiro !== 0) {
    lines.push({ label: '(±) Resultado financeiro', value: t.resultadoFinanceiro })
  }

  lines.push({ label: 'LAIR', value: t.lair, bold: true, emphasis: true })

  if (t.impostosSobreLucro > 0) {
    lines.push({ label: '(-) Impostos sobre lucro', value: -t.impostosSobreLucro })
  }

  lines.push({
    label: 'Lucro Líquido',
    value: t.lucroLiquido,
    bold: true,
    emphasis: true,
    pctVertical: t.receitaLiquida ? t.lucroLiquido / t.receitaLiquida : null,
  })

  return lines
}

export function renderDREPDF(
  data: DREResult,
  ctx: DREExportContext,
) {
  const lines = buildLines(data)
  return (
    <PdfDocument
      empresaNome={ctx.empresaNome}
      relatorioTitulo="DRE Gerencial"
      periodo={`${ctx.periodoLabel} · ${REGIME_LABEL[ctx.regime]}`}
      geradoEm={ctx.geradoEm}
    >
      {/* Mini-stats topo */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        <StatCard label="Receita Líquida" value={formatBRLPdf(data.totals.receitaLiquida)} />
        <StatCard label="Lucro Bruto" value={formatBRLPdf(data.totals.lucroBruto)} />
        <StatCard
          label="Lucro Líquido"
          value={formatBRLPdf(data.totals.lucroLiquido)}
          accent={data.totals.lucroLiquido >= 0}
          danger={data.totals.lucroLiquido < 0}
        />
      </View>

      {/* Tabela DRE hierárquica */}
      <View style={pdfStyles.section}>
        <Text style={pdfStyles.sectionTitle}>Resultado consolidado</Text>
        <View style={pdfStyles.tHead} fixed>
          <View style={{ width: '60%' }}>
            <Text style={pdfStyles.tHeadCell}>Linha</Text>
          </View>
          <View style={{ width: '25%' }}>
            <Text style={[pdfStyles.tHeadCell, { textAlign: 'right' }]}>Valor</Text>
          </View>
          <View style={{ width: '15%' }}>
            <Text style={[pdfStyles.tHeadCell, { textAlign: 'right' }]}>% RL</Text>
          </View>
        </View>
        {lines.map((line, i) => {
          const isNeg = line.value < 0
          const valueColor = line.bold && line.value < 0 ? PDF_COLORS.negative : undefined
          return (
            <View
              key={i}
              style={[
                pdfStyles.tRow,
                line.emphasis
                  ? { borderTopWidth: 0.8, borderTopColor: PDF_COLORS.textPrimary, marginTop: 1 }
                  : null,
                i % 2 === 1 && !line.emphasis ? pdfStyles.tRowAlt : null,
              ].filter(Boolean) as never}
              wrap={false}
            >
              <View
                style={{
                  width: '60%',
                  paddingLeft: line.indented ? 12 : 0,
                }}
              >
                <Text
                  style={[
                    pdfStyles.tCell,
                    line.bold ? pdfStyles.tCellBold : null,
                    line.indented ? pdfStyles.tCellMuted : null,
                  ].filter(Boolean) as never}
                >
                  {line.label}
                </Text>
              </View>
              <View style={{ width: '25%' }}>
                <Text
                  style={[
                    pdfStyles.tCell,
                    pdfStyles.tCellRight,
                    line.bold ? pdfStyles.tCellBold : null,
                    valueColor ? { color: valueColor } : null,
                    isNeg && !line.bold ? pdfStyles.tCellMuted : null,
                  ].filter(Boolean) as never}
                >
                  {formatBRLPdf(line.value)}
                </Text>
              </View>
              <View style={{ width: '15%' }}>
                <Text
                  style={[
                    pdfStyles.tCell,
                    pdfStyles.tCellRight,
                    pdfStyles.tCellMuted,
                  ]}
                >
                  {line.pctVertical !== undefined && line.pctVertical !== null
                    ? formatPct(line.pctVertical)
                    : ''}
                </Text>
              </View>
            </View>
          )
        })}
      </View>

      {data.uncategorized.total > 0 && (
        <View style={{ marginTop: 10 }}>
          <Text style={{ fontSize: 8, color: PDF_COLORS.textMuted, fontStyle: 'italic' }}>
            Não categorizado (fora do DRE): {formatBRLPdf(data.uncategorized.total)} (
            {data.uncategorized.transactionCount} lançamentos)
          </Text>
        </View>
      )}
    </PdfDocument>
  )
}

function StatCard({
  label,
  value,
  accent,
  danger,
}: {
  label: string
  value: string
  accent?: boolean
  danger?: boolean
}) {
  const bg = danger ? '#fef2f2' : accent ? PDF_COLORS.brandSoft : PDF_COLORS.rowAlt
  const border = danger ? PDF_COLORS.negative : accent ? PDF_COLORS.brand : PDF_COLORS.border
  const color = danger ? PDF_COLORS.negative : accent ? PDF_COLORS.brand : PDF_COLORS.textPrimary
  return (
    <View
      style={{
        flex: 1,
        padding: 8,
        borderRadius: 4,
        backgroundColor: bg,
        borderWidth: 0.5,
        borderColor: border,
      }}
    >
      <Text style={{ fontSize: 7, color: PDF_COLORS.textMuted, textTransform: 'uppercase' }}>
        {label}
      </Text>
      <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color, marginTop: 2 }}>
        {value}
      </Text>
    </View>
  )
}
