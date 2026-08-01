// Sprint Contraparte PIX (31/07/2026) — interface genérica de parser de extrato PDF.
// Determinístico por camada de texto (pdftotext -layout). NÃO usa Claude Vision —
// esse fluxo (lib/pdf-bank-statement/*) continua existindo pra bancos sem OFX.

export interface BankStatementHeader {
  agencia: string | null
  conta: string | null
  titular: string | null
}

export interface BankStatementLine {
  /** Dia do mês do lançamento (DD). Herdado quando a linha não repete o dia. */
  day: number
  historico: string
  /** DOCUMENTO do extrato = FITID/CHECKNUM do OFX. Pode ser alfanumérico (0000RC) ou 000000. */
  documento: string
  /** Valor absoluto. */
  amount: number
  /** Valor com sinal: negativo = saída. */
  signed: number
  /** Nome do favorecido/pagador (linha "NOME:" logo abaixo), ou null. Dado pessoal. */
  counterpartyName: string | null
}

export interface ParsedBankStatement {
  header: BankStatementHeader
  lines: BankStatementLine[]
}

export class BankStatementParseError extends Error {
  constructor(
    public code: 'NO_TEXT_LAYER' | 'HEADER_NOT_FOUND',
    message: string,
  ) {
    super(message)
    this.name = 'BankStatementParseError'
  }
}

export interface BankStatementPdfParser {
  readonly bank: string
  /** Recebe o texto de `pdftotext -layout`. Lança BankStatementParseError se inválido. */
  parse(text: string): ParsedBankStatement
}
