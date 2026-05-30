// Sprint Export CSV+PDF (29/05/2026) — Heatmap pro Comparativo no PDF.
//
// Recria a tabela do Comparativo com células coloridas por intensidade
// usando `backgroundColor` no <View> nativo do react-pdf — mesmo
// mapeamento semântico do `CELL_TONE_CLASSES` da UI Tailwind.

import { View, Text } from '@react-pdf/renderer'
import { pdfStyles, PDF_COLORS } from './styles'
import type { CellTone } from '@/lib/relatorios/comparativo'

// Mapa CellTone → HEX (equivalente das classes Tailwind do client).
// Cores escolhidas pra impressão (PDF print-friendly — não usa dark mode).
const TONE_HEX: Record<CellTone, string | null> = {
  transparent: null,
  'fav-weak': '#ecfdf5', // emerald-50
  'fav-medium': '#d1fae5', // emerald-100
  'fav-strong': '#a7f3d0', // emerald-200
  'unfav-weak': '#fef2f2', // red-50
  'unfav-medium': '#fee2e2', // red-100
  'unfav-strong': '#fecaca', // red-200
}

export interface HeatmapPeriodo {
  label: string
}

export interface HeatmapRow {
  categoryName: string
  /** values + cellTones têm mesmo length de periodos */
  values: number[]
  cellTones: CellTone[]
  /** Coluna "Média" — null = sem média histórica suficiente */
  mediaHistorica: number | null
  /** Coluna "vs Média" em frações (-0.15 = -15%) ou null */
  desvioPct: number | null
  /** True se a categoria não teve transação no mês ref (Hotfix 28/05) */
  referenciaVazia: boolean
  /** Soma de values[] */
  total: number
}

export interface HeatmapTotals {
  porPeriodo: number[]
  mediaHistorica: number | null
  desvioPct: number | null
  referenciaVazia: boolean
  total: number
}

interface Props {
  periodos: HeatmapPeriodo[]
  rows: HeatmapRow[]
  totals: HeatmapTotals
  formatBRL: (v: number) => string
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

export function PdfHeatmap({ periodos, rows, totals, formatBRL }: Props) {
  const N = periodos.length
  // Larguras: Categoria 28% + N períodos uniformes em ~50% + Média 11% + vs Média 11%
  // Ajustado simples: dá ~28 / 50/N / 11 / 11. Restante (~0) negligível.
  const colCategoryPct = 28
  const colMediaPct = 11
  const colDesvioPct = 11
  const colsPerPeriodoPct = (100 - colCategoryPct - colMediaPct - colDesvioPct) / N

  return (
    <View>
      {/* Header */}
      <View
        style={[
          pdfStyles.tHead,
          { backgroundColor: PDF_COLORS.rowAlt },
        ]}
        fixed
      >
        <View style={{ width: `${colCategoryPct}%` }}>
          <Text style={pdfStyles.tHeadCell}>Categoria</Text>
        </View>
        {periodos.map((p, i) => (
          <View key={i} style={{ width: `${colsPerPeriodoPct}%` }}>
            <Text style={[pdfStyles.tHeadCell, { textAlign: 'right' }]}>
              {p.label}
            </Text>
          </View>
        ))}
        <View style={{ width: `${colMediaPct}%` }}>
          <Text style={[pdfStyles.tHeadCell, { textAlign: 'right' }]}>
            Média
          </Text>
        </View>
        <View style={{ width: `${colDesvioPct}%` }}>
          <Text style={[pdfStyles.tHeadCell, { textAlign: 'center' }]}>
            vs Média
          </Text>
        </View>
      </View>

      {/* Rows */}
      {rows.map((row, rIdx) => (
        <View
          key={rIdx}
          style={[
            pdfStyles.tRow,
            rIdx % 2 === 1 ? pdfStyles.tRowAlt : null,
          ].filter(Boolean) as never}
          wrap={false}
        >
          <View style={{ width: `${colCategoryPct}%` }}>
            <Text style={[pdfStyles.tCell, pdfStyles.tCellBold]}>
              {row.categoryName}
            </Text>
          </View>
          {row.values.map((v, i) => {
            const tone = row.cellTones[i] ?? 'transparent'
            const bg = TONE_HEX[tone]
            return (
              <View
                key={i}
                style={{
                  width: `${colsPerPeriodoPct}%`,
                  backgroundColor: bg ?? undefined,
                  paddingHorizontal: 2,
                }}
              >
                <Text
                  style={[
                    pdfStyles.tCell,
                    pdfStyles.tCellRight,
                  ]}
                >
                  {v > 0 ? formatBRL(v) : '—'}
                </Text>
              </View>
            )
          })}
          <View style={{ width: `${colMediaPct}%` }}>
            <Text
              style={[
                pdfStyles.tCell,
                pdfStyles.tCellRight,
                pdfStyles.tCellBold,
                pdfStyles.tCellMuted,
              ]}
            >
              {row.mediaHistorica !== null ? formatBRL(row.mediaHistorica) : '—'}
            </Text>
          </View>
          <View style={{ width: `${colDesvioPct}%` }}>
            <Text
              style={[
                pdfStyles.tCell,
                { textAlign: 'center' },
                pdfStyles.tCellMuted,
              ]}
            >
              {row.referenciaVazia
                ? 'ref. vazia'
                : formatPctSigned(row.desvioPct)}
            </Text>
          </View>
        </View>
      ))}

      {/* Linha Total */}
      <View
        style={[
          pdfStyles.tRow,
          { borderTopWidth: 1.2, borderTopColor: PDF_COLORS.textPrimary },
        ]}
        wrap={false}
      >
        <View style={{ width: `${colCategoryPct}%` }}>
          <Text style={[pdfStyles.tCell, pdfStyles.tCellBold]}>Total</Text>
        </View>
        {totals.porPeriodo.map((v, i) => (
          <View key={i} style={{ width: `${colsPerPeriodoPct}%` }}>
            <Text
              style={[
                pdfStyles.tCell,
                pdfStyles.tCellRight,
                pdfStyles.tCellBold,
              ]}
            >
              {formatBRL(v)}
            </Text>
          </View>
        ))}
        <View style={{ width: `${colMediaPct}%` }}>
          <Text
            style={[
              pdfStyles.tCell,
              pdfStyles.tCellRight,
              pdfStyles.tCellBold,
            ]}
          >
            {totals.mediaHistorica !== null
              ? formatBRL(totals.mediaHistorica)
              : '—'}
          </Text>
        </View>
        <View style={{ width: `${colDesvioPct}%` }}>
          <Text
            style={[
              pdfStyles.tCell,
              { textAlign: 'center' },
              pdfStyles.tCellBold,
            ]}
          >
            {totals.referenciaVazia
              ? 'ref. vazia'
              : formatPctSigned(totals.desvioPct)}
          </Text>
        </View>
      </View>
    </View>
  )
}
