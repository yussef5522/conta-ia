// Sprint 5.0.2.3 — Magic bytes check pra validar arquivos Excel.
//
// Por que: a checagem de extensão (`.xlsx?`) é facilmente burlável renomeando
// um PDF/imagem como `algo.xlsx`. Magic bytes verificam o conteúdo REAL.
//
// XLSX é um ZIP file (formato OOXML) — magic bytes `PK\x03\x04` (4 bytes).
// XLS antigo (BIFF) é um OLE2 compound document — magic `D0 CF 11 E0`.

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
