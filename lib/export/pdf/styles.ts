// Sprint Export CSV+PDF (29/05/2026) — StyleSheet compartilhado pros PDFs.
//
// Helvetica embutida do react-pdf (sem custom font nesta sprint —
// ver docs/TODO-INTER-FONT-PDF.md).
//
// Paleta espelha o brand CAIXAOS:
//   #7c3aed violet-600 (logo)
//   #0f172a slate-900 (texto principal)
//   #64748b slate-500 (texto secundário)
//   #e2e8f0 slate-200 (bordas)
//   #f8fafc slate-50 (zebra)
//   #16a34a green-600 (positivo)
//   #dc2626 red-600 (negativo)

import { StyleSheet } from '@react-pdf/renderer'

export const PDF_COLORS = {
  brand: '#7c3aed',
  brandSoft: '#ede9fe',
  textPrimary: '#0f172a',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',
  border: '#e2e8f0',
  rowAlt: '#f8fafc',
  positive: '#16a34a',
  negative: '#dc2626',
  heatmapWeak: '#fef2f2', // red-50
  heatmapMod: '#fecaca', // red-200
  heatmapStrong: '#f87171', // red-400
  heatmapGood: '#d1fae5', // emerald-100
} as const

export const pdfStyles = StyleSheet.create({
  page: {
    paddingTop: 80,
    paddingBottom: 60,
    paddingHorizontal: 40,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: PDF_COLORS.textPrimary,
  },
  // Header fixo em todas as páginas
  header: {
    position: 'absolute',
    top: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.border,
    paddingBottom: 8,
  },
  headerEmpresa: {
    alignItems: 'flex-end',
  },
  headerEmpresaNome: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: PDF_COLORS.textPrimary,
  },
  headerRelatorio: {
    fontSize: 8,
    color: PDF_COLORS.textSecondary,
    marginTop: 1,
  },
  // Footer fixo
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: PDF_COLORS.border,
    fontSize: 7,
    color: PDF_COLORS.textMuted,
  },
  // Bloco título + período (primeira página)
  titleBlock: {
    marginBottom: 16,
  },
  title: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 18,
    color: PDF_COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 10,
    color: PDF_COLORS.textSecondary,
    marginTop: 4,
  },
  // Tabela base
  table: {
    width: '100%',
  },
  tHead: {
    flexDirection: 'row',
    borderBottomWidth: 1.2,
    borderBottomColor: PDF_COLORS.textPrimary,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  tHeadCell: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: PDF_COLORS.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  tRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: PDF_COLORS.border,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  tRowAlt: {
    backgroundColor: PDF_COLORS.rowAlt,
  },
  tCell: {
    fontSize: 9,
    color: PDF_COLORS.textPrimary,
  },
  tCellRight: {
    textAlign: 'right',
  },
  tCellMuted: {
    color: PDF_COLORS.textSecondary,
  },
  tCellBold: {
    fontFamily: 'Helvetica-Bold',
  },
  // Seção
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    color: PDF_COLORS.textPrimary,
    marginBottom: 6,
  },
})
