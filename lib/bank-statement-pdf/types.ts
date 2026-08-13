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
  /**
   * Sprint Contraparte-Banrisul FASE 4 (13/08): data COMPLETA do lançamento
   * (YYYY-MM-DD), resolvida a partir do período + dia (caminhando o mês quando o
   * dia decresce — cobre PDF de vários meses). `null` quando o período não foi
   * lido do PDF. É a chave do Nível 2 (data+valor), segura contra colisão de
   * dia entre meses diferentes. Opcional pra retrocompat de fixtures antigas.
   */
  date?: string | null
}

/** Período coberto pelo extrato (YYYY-MM-DD). `null` = não foi possível ler. */
export interface StatementPeriod {
  start: string
  end: string
}

export interface ParsedBankStatement {
  header: BankStatementHeader
  lines: BankStatementLine[]
  /** Sprint Contraparte-Banrisul FASE 4 (13/08): período do extrato, se legível. */
  period: StatementPeriod | null
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
