// Sprint CSV-Encoding: orquestrador de diagnóstico ANTES de criar batch.
//
// Recebe bytes brutos do upload e retorna um relatório com:
//   - Encoding detectado (utf-8, windows-1252, utf-16le/be)
//   - Separador detectado (;, ,, \t)
//   - Headers lidos
//   - Quantidade de linhas de dado vs filtradas
//   - Preview das 3 primeiras linhas
//   - Mapping heurístico (favorecido/valor/vencimento) com confidence
//   - Lista de warnings humanos em pt-BR
//
// Usado pelo /upload pra:
//   - Decidir se cria batch (rows > 0 + mapping mínimo) ou retorna erro rico
//   - Embutir o diagnóstico no payload de erro pra UI mostrar tudo
//
// Função PURA — sem DB, sem rede, totalmente testável.

import { decodeCsvBytes, type DetectedEncoding } from './decode-bytes'
import { parseCsv, type CsvSeparator } from './parse-csv'
import { heuristicFallback } from '@/lib/excel-import/detect-columns'

export interface CsvDiagnostico {
  encoding: DetectedEncoding
  bomDetected: boolean
  replacementCharsCount: number
  separator: CsvSeparator
  separatorLabel: string // pt-BR humano
  headers: string[]
  dataLineCount: number
  filteredBlankCount: number
  /** Primeiras 3 linhas como o parser as enxergou (string[][]) */
  previewRows: string[][]
  mapping: {
    favorecido: string | null
    valor: string | null
    vencimento: string | null
    confidence: number // 0-1
  }
  warnings: string[]
  /** Texto decodificado pronto pra reusar no upload (evita decodar 2x). */
  decodedText: string
}

const SEP_LABEL: Record<CsvSeparator, string> = {
  ',': 'vírgula',
  ';': 'ponto-e-vírgula',
  '\t': 'tabulação (TAB)',
}

function encodingLabel(enc: DetectedEncoding): string {
  switch (enc) {
    case 'utf-8':
      return 'UTF-8'
    case 'windows-1252':
      return 'Windows-1252 (ANSI BR — Excel padrão)'
    case 'utf-16le':
      return 'UTF-16 LE'
    case 'utf-16be':
      return 'UTF-16 BE'
  }
}

export function diagnoseCsv(
  input: ArrayBuffer | Buffer | Uint8Array,
): CsvDiagnostico {
  const decoded = decodeCsvBytes(input)
  const parsed = parseCsv(decoded.text)
  const mapping = heuristicFallback(parsed.headers)

  const warnings: string[] = []

  if (decoded.encoding === 'windows-1252') {
    warnings.push(
      `Detectei encoding ${encodingLabel(decoded.encoding)} — decodei automaticamente.`,
    )
  } else if (decoded.encoding === 'utf-16le' || decoded.encoding === 'utf-16be') {
    warnings.push(
      `Detectei encoding ${encodingLabel(decoded.encoding)} pelo BOM — decodei automaticamente.`,
    )
  }

  if (decoded.replacementCharsCount > 0) {
    warnings.push(
      `${decoded.replacementCharsCount} caracteres ficaram ilegíveis (encoding pode estar misturado).`,
    )
  }

  if (parsed.separator === '\t') {
    warnings.push(
      'Separador detectado: TAB. Confere se o arquivo é mesmo TSV (não CSV).',
    )
  }

  if (parsed.headers.length === 0) {
    warnings.push('Não consegui ler o cabeçalho — arquivo pode estar vazio.')
  }

  if (parsed.rows.length === 0 && parsed.headers.length > 0) {
    warnings.push(
      'Achei o cabeçalho mas 0 linhas de dado. O arquivo só tem o cabeçalho?',
    )
  }

  if (parsed.linhasIgnoradas > 0) {
    warnings.push(
      `${parsed.linhasIgnoradas} linha${parsed.linhasIgnoradas === 1 ? '' : 's'} em branco foram ignoradas (totais, separadores, etc).`,
    )
  }

  if (!mapping.fields.favorecido) {
    warnings.push(
      'Não achei coluna de favorecido/fornecedor. Esperado: "Favorecido", "Fornecedor", "Pago a", "Para".',
    )
  }
  if (!mapping.fields.valor) {
    warnings.push(
      'Não achei coluna de valor. Esperado: "Valor", "R$", "Total".',
    )
  }
  if (!mapping.fields.vencimento) {
    warnings.push(
      'Não achei coluna de vencimento. Esperado: "Vencimento", "Venc", "Data de Vencimento".',
    )
  }

  return {
    encoding: decoded.encoding,
    bomDetected: decoded.bomDetected,
    replacementCharsCount: decoded.replacementCharsCount,
    separator: parsed.separator,
    separatorLabel: SEP_LABEL[parsed.separator],
    headers: parsed.headers,
    dataLineCount: parsed.rows.length,
    filteredBlankCount: parsed.linhasIgnoradas,
    previewRows: parsed.rows.slice(0, 3),
    mapping: {
      favorecido: mapping.fields.favorecido ?? null,
      valor: mapping.fields.valor ?? null,
      vencimento: mapping.fields.vencimento ?? null,
      confidence: mapping.confidence,
    },
    warnings,
    decodedText: decoded.text,
  }
}

/**
 * Decide se o diagnóstico permite criar batch ou se deve retornar erro
 * com diagnóstico (UI mostra ao user).
 *
 * Critério: precisa de pelo menos 1 linha de dado. Mapping insuficiente
 * NÃO bloqueia (heurística pode falhar mas detect/IA pode corrigir).
 */
export function diagnosticoPermiteBatch(diag: CsvDiagnostico): boolean {
  return diag.dataLineCount > 0
}
