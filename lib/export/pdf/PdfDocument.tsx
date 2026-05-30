// Sprint Export CSV+PDF (29/05/2026) — Wrapper PDF profissional.
//
// Header fixo (logo + empresa + nome do relatório) e footer fixo
// (data de geração + paginação) em TODAS as páginas via `fixed`.
//
// Documento traz title/author no metadata pro PDF reader exibir.

import { Document, Page, View, Text } from '@react-pdf/renderer'
import { pdfStyles, PDF_COLORS } from './styles'
import { PdfLogo } from './PdfLogo'

interface PdfDocumentProps {
  empresaNome: string
  relatorioTitulo: string
  periodo: string
  geradoEm: string // string formatada pt-BR
  children: React.ReactNode
}

export function PdfDocument({
  empresaNome,
  relatorioTitulo,
  periodo,
  geradoEm,
  children,
}: PdfDocumentProps) {
  return (
    <Document
      title={`${relatorioTitulo} — ${empresaNome}`}
      author="CAIXAOS"
      creator="CAIXAOS"
      producer="CAIXAOS"
    >
      <Page size="A4" style={pdfStyles.page}>
        {/* Header fixo */}
        <View style={pdfStyles.header} fixed>
          <PdfLogo height={20} />
          <View style={pdfStyles.headerEmpresa}>
            <Text style={pdfStyles.headerEmpresaNome}>{empresaNome}</Text>
            <Text style={pdfStyles.headerRelatorio}>{relatorioTitulo}</Text>
          </View>
        </View>

        {/* Título + período — só na primeira página */}
        <View style={pdfStyles.titleBlock}>
          <Text style={pdfStyles.title}>{relatorioTitulo}</Text>
          <Text style={pdfStyles.subtitle}>{periodo}</Text>
        </View>

        {children}

        {/* Footer fixo */}
        <View style={pdfStyles.footer} fixed>
          <Text>Gerado por CAIXAOS em {geradoEm}</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Página ${pageNumber} de ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  )
}

// Re-exports pra conveniência dos builders
export { pdfStyles, PDF_COLORS }
