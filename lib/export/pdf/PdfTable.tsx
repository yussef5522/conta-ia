// Sprint Export CSV+PDF (29/05/2026) — Tabela reusável pros PDFs.
//
// Suporta:
// - Headers com alinhamento (left/right) + caps + bold
// - Rows com zebra striping
// - Cell ad-hoc com bold + cor (pra negativos/positivos)
// - Quebra de página automática (react-pdf cuida)
// - Larguras em % via prop `widths`

import { View, Text } from '@react-pdf/renderer'
import type { Style } from '@react-pdf/types'
import { pdfStyles, PDF_COLORS } from './styles'

type StyleEntry = Style | false | null | undefined
function compact(...styles: StyleEntry[]): Style[] {
  return styles.filter((s): s is Style => Boolean(s))
}

export interface PdfCellStyle {
  bold?: boolean
  /** Cor do texto (HEX). Default = textPrimary. */
  color?: string
  /** Background da cell (HEX). Default = transparente. */
  bg?: string
}

export interface PdfTableHeader {
  label: string
  /** Alinhamento horizontal. Default 'left'. */
  align?: 'left' | 'right' | 'center'
}

export interface PdfTableRow {
  cells: Array<string | { text: string; style?: PdfCellStyle }>
  /** Negrito na linha inteira (ex.: linha de total). */
  bold?: boolean
  /** Highlight de fundo (ex.: linha de subtotal). */
  highlight?: boolean
}

interface Props {
  headers: PdfTableHeader[]
  rows: PdfTableRow[]
  /** Larguras em %, soma = 100. Se omitido, distribui igualmente. */
  widths?: number[]
  /** Zebra striping (default true) */
  zebra?: boolean
}

export function PdfTable({
  headers,
  rows,
  widths,
  zebra = true,
}: Props) {
  const N = headers.length
  const colWidths = widths ?? Array(N).fill(100 / N)

  return (
    <View style={pdfStyles.table}>
      {/* Header */}
      <View style={pdfStyles.tHead} fixed>
        {headers.map((h, i) => {
          const align = h.align ?? 'left'
          return (
            <View key={i} style={{ width: `${colWidths[i]}%` }}>
              <Text
                style={compact(
                  pdfStyles.tHeadCell,
                  align === 'right' && { textAlign: 'right' },
                  align === 'center' && { textAlign: 'center' },
                )}
              >
                {h.label}
              </Text>
            </View>
          )
        })}
      </View>

      {/* Rows */}
      {rows.map((row, rIdx) => {
        const isAlt = zebra && rIdx % 2 === 1
        return (
          <View
            key={rIdx}
            style={compact(
              pdfStyles.tRow,
              isAlt && pdfStyles.tRowAlt,
              row.highlight && { backgroundColor: PDF_COLORS.brandSoft },
            )}
            wrap={false}
          >
            {row.cells.map((cell, cIdx) => {
              const align = headers[cIdx]?.align ?? 'left'
              const isObj = typeof cell !== 'string'
              const text = isObj ? cell.text : cell
              const s = isObj ? cell.style : undefined
              return (
                <View
                  key={cIdx}
                  style={{
                    width: `${colWidths[cIdx]}%`,
                    backgroundColor: s?.bg,
                    paddingHorizontal: s?.bg ? 2 : 0,
                  }}
                >
                  <Text
                    style={compact(
                      pdfStyles.tCell,
                      align === 'right' && pdfStyles.tCellRight,
                      align === 'center' && { textAlign: 'center' },
                      (row.bold || s?.bold) && pdfStyles.tCellBold,
                      s?.color ? { color: s.color } : null,
                    )}
                  >
                    {text}
                  </Text>
                </View>
              )
            })}
          </View>
        )
      })}
    </View>
  )
}
