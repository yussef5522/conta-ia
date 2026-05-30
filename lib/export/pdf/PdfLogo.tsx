// Sprint Export CSV+PDF (29/05/2026) — Logo CAIXAOS recriado nativo
// no react-pdf (3 barras violetas + wordmark).
//
// Replica /public/brand/logo-horizontal.svg via <Svg><Rect> nativo
// pra não depender de fetch/disco em runtime server-side.

import { View, Text, Svg, Rect } from '@react-pdf/renderer'
import { PDF_COLORS } from './styles'

interface PdfLogoProps {
  /** Altura do logo em pt. Default 24 (bom pra header). */
  height?: number
}

export function PdfLogo({ height = 24 }: PdfLogoProps) {
  // viewBox original: 0 0 54 56 → ratio 54/56 ≈ 0.964 (barras)
  const svgHeight = height
  const svgWidth = (54 / 56) * svgHeight
  // Wordmark "CAIXAOS" — fonte equivalente à Inter 500 -1.2 letter-spacing
  // Em Helvetica fica um pouco mais largo, mas semanticamente bate.
  const fontSize = height * 0.66
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        // alignItems baseline puxa o texto pra baixo do svg
      }}
    >
      <Svg width={svgWidth} height={svgHeight} viewBox="0 0 54 56">
        <Rect x={0} y={32} width={14} height={24} rx={2} fill={PDF_COLORS.brand} />
        <Rect x={20} y={18} width={14} height={38} rx={2} fill={PDF_COLORS.brand} />
        <Rect x={40} y={4} width={14} height={52} rx={2} fill={PDF_COLORS.brand} />
      </Svg>
      <Text
        style={{
          fontSize,
          fontFamily: 'Helvetica-Bold',
          color: PDF_COLORS.textPrimary,
          marginLeft: 5,
          letterSpacing: -0.5,
        }}
      >
        CAIXAOS
      </Text>
    </View>
  )
}
