// Sprint CSV Import (30/05/2026) — Parser CSV genérico RFC 4180.
//
// Suporta:
//  - Separadores: ; (CACULA, Excel BR padrão) e , (US/RFC default)
//  - Detecção automática do separador (1ª linha)
//  - Aspas duplas pra escapar campos com separador, quebra de linha,
//    aspas (RFC 4180: "" dentro de campo entre aspas vira ")
//  - BOM UTF-8 (EF BB BF) removido se presente
//  - Line endings: \n, \r\n, ou \r
//  - Linha em branco (só whitespace) é IGNORADA
//
// NÃO faz inferência de tipo — tudo vem como string. Caller decide
// como parsear cada coluna (valor BR, data BR, etc).

export interface ParseCsvOptions {
  /**
   * Força separador específico. Se omitido, detecta automaticamente.
   * CACULA = ';'
   */
  separator?: ',' | ';'
}

export interface ParsedCsv {
  headers: string[]
  rows: string[][]
  separator: ',' | ';'
  /** Quantas linhas em branco foram ignoradas */
  linhasIgnoradas: number
}

/**
 * Detecta separador da primeira linha lendo qual aparece mais.
 * Empate → ';' (padrão BR). Sem nenhum → ',' (RFC default).
 */
function detectSeparator(firstLine: string): ',' | ';' {
  // Conta SÓ separadores fora de aspas pra não confundir com texto
  let inQuote = false
  let comma = 0
  let semi = 0
  for (let i = 0; i < firstLine.length; i++) {
    const ch = firstLine[i]
    if (ch === '"') {
      // ignora "" escapado
      if (firstLine[i + 1] === '"') {
        i++
        continue
      }
      inQuote = !inQuote
      continue
    }
    if (inQuote) continue
    if (ch === ',') comma++
    else if (ch === ';') semi++
  }
  if (semi > comma) return ';'
  if (comma > semi) return ','
  return ';' // empate → BR padrão
}

/**
 * Parser RFC 4180 — stateful character-by-character.
 * Retorna array de linhas, cada linha é array de campos string.
 */
function parseRfc4180(text: string, separator: ',' | ';'): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuote = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (inQuote) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          // "" escapado → " literal
          field += '"'
          i++
        } else {
          inQuote = false
        }
      } else {
        field += ch
      }
      continue
    }

    // Fora de aspas
    if (ch === '"') {
      inQuote = true
      continue
    }
    if (ch === separator) {
      row.push(field)
      field = ''
      continue
    }
    if (ch === '\r') {
      // CRLF → trata como LF
      if (text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      continue
    }
    if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      continue
    }
    field += ch
  }

  // Último campo / linha
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

/**
 * Remove BOM UTF-8 do início se presente.
 */
function stripBom(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) {
    return text.slice(1)
  }
  return text
}

/**
 * Filtra linhas em branco (todos os campos vazios ou whitespace).
 * Retorna { kept, ignored }.
 */
function dropBlankRows(
  rows: string[][],
): { kept: string[][]; ignored: number } {
  const kept: string[][] = []
  let ignored = 0
  for (const row of rows) {
    const allBlank = row.every((f) => f.trim() === '')
    if (allBlank) {
      ignored++
    } else {
      kept.push(row)
    }
  }
  return { kept, ignored }
}

export function parseCsv(
  text: string,
  options: ParseCsvOptions = {},
): ParsedCsv {
  const cleaned = stripBom(text)
  if (cleaned.trim() === '') {
    return { headers: [], rows: [], separator: ';', linhasIgnoradas: 0 }
  }

  // Detecta separador na 1ª linha (antes da quebra)
  const firstLineEnd =
    cleaned.indexOf('\n') !== -1
      ? cleaned.indexOf('\n')
      : cleaned.indexOf('\r')
  const firstLine =
    firstLineEnd >= 0 ? cleaned.slice(0, firstLineEnd) : cleaned
  const separator = options.separator ?? detectSeparator(firstLine)

  const allRows = parseRfc4180(cleaned, separator)
  if (allRows.length === 0) {
    return { headers: [], rows: [], separator, linhasIgnoradas: 0 }
  }

  const headers = allRows[0]
  const body = allRows.slice(1)
  const { kept: rows, ignored } = dropBlankRows(body)

  return {
    headers,
    rows,
    separator,
    linhasIgnoradas: ignored,
  }
}
