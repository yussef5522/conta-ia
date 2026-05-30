// Sprint 5.0.2.3 — Magic bytes check pra validar arquivos Excel.
// Sprint CSV Import (30/05/2026) — Estendido pra aceitar .csv também.
//
// Por que: a checagem de extensão (`.xlsx?`) é facilmente burlável renomeando
// um PDF/imagem como `algo.xlsx`. Magic bytes verificam o conteúdo REAL.
//
// XLSX é um ZIP file (formato OOXML) — magic bytes `PK\x03\x04` (4 bytes).
// XLS antigo (BIFF) é um OLE2 compound document — magic `D0 CF 11 E0`.
// CSV não tem magic bytes (é texto puro) — aceitamos se começa com BOM UTF-8
// (EF BB BF) OU caractere ASCII imprimível em todos os primeiros bytes.

const XLSX_ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04] // 'P','K',0x03,0x04
const XLSX_ZIP_EMPTY = [0x50, 0x4b, 0x05, 0x06] // ZIP vazio (raro)
const XLSX_ZIP_SPANNED = [0x50, 0x4b, 0x07, 0x08] // ZIP spanned (raro)
const XLS_OLE2_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]

function startsWith(bytes: Uint8Array, prefix: number[]): boolean {
  if (bytes.length < prefix.length) return false
  for (let i = 0; i < prefix.length; i++) {
    if (bytes[i] !== prefix[i]) return false
  }
  return true
}

export type ExcelFileType = 'XLSX' | 'XLS' | 'INVALID'

/**
 * Retorna 'XLSX', 'XLS', ou 'INVALID' baseado nos primeiros bytes do arquivo.
 *
 * Aceita ArrayBuffer (cliente), Buffer (Node), ou Uint8Array (genérico).
 * Lê só os primeiros 8 bytes — barato, sem alocar buffer grande.
 */
export function detectExcelType(
  input: ArrayBuffer | Buffer | Uint8Array,
): ExcelFileType {
  // Buffer (Node) é subclasse de Uint8Array — pegado pelo 1º branch.
  // ArrayBuffer precisa wrap; tudo o resto é Uint8Array direto.
  const bytes: Uint8Array =
    input instanceof Uint8Array ? input : new Uint8Array(input)

  const head = bytes.subarray(0, 8)

  if (
    startsWith(head, XLSX_ZIP_SIGNATURE) ||
    startsWith(head, XLSX_ZIP_EMPTY) ||
    startsWith(head, XLSX_ZIP_SPANNED)
  ) {
    return 'XLSX'
  }
  if (startsWith(head, XLS_OLE2_SIGNATURE)) {
    return 'XLS'
  }
  return 'INVALID'
}

/** Retorna true se o conteúdo bate com .xlsx OU .xls (não checa extensão). */
export function isValidExcel(
  input: ArrayBuffer | Buffer | Uint8Array,
): boolean {
  return detectExcelType(input) !== 'INVALID'
}

const BOM_UTF8 = [0xef, 0xbb, 0xbf]

/**
 * Retorna true se o conteúdo PARECE CSV: texto plano UTF-8.
 *
 * CSV não tem assinatura específica como xlsx/xls. Heurística:
 * - Aceita BOM UTF-8 no começo (Excel BR comum)
 * - Aceita qualquer ASCII imprimível (0x20-0x7E) + acentos UTF-8 + CR/LF/TAB
 * - Rejeita bytes binários (0x00, magic Excel, magic PDF, etc) nos primeiros 256B
 *
 * Não é tão estrito quanto magic bytes do Excel — é defesa razoável
 * pra detectar binários disfarçados de .csv.
 */
export function isValidCsv(
  input: ArrayBuffer | Buffer | Uint8Array,
): boolean {
  const bytes: Uint8Array =
    input instanceof Uint8Array ? input : new Uint8Array(input)
  if (bytes.length === 0) return false

  // Excel/binários disfarçados → rejeita
  if (detectExcelType(bytes) !== 'INVALID') return false

  // PDF disfarçado de CSV
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return false
  }

  // Pula BOM se presente
  let start = 0
  if (
    bytes.length >= 3 &&
    bytes[0] === BOM_UTF8[0] &&
    bytes[1] === BOM_UTF8[1] &&
    bytes[2] === BOM_UTF8[2]
  ) {
    start = 3
  }

  // Olha primeiros 256 bytes (após BOM). Aceita ASCII imprimível +
  // whitespace (TAB/LF/CR) + bytes UTF-8 multi-byte (≥0x80).
  // Rejeita NUL (0x00) ou bytes de controle inesperados.
  const limit = Math.min(start + 256, bytes.length)
  for (let i = start; i < limit; i++) {
    const b = bytes[i]
    if (b === 0x00) return false // NUL → binário
    if (b < 0x20 && b !== 0x09 && b !== 0x0a && b !== 0x0d) {
      // Controle não-whitespace → binário
      return false
    }
  }

  return true
}
