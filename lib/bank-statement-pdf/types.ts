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

/** Saldo CONTÁBIL declarado pelo banco no fim de um dia ("SALDO NA DATA"). */
export interface SaldoDoDia {
  /** YYYY-MM-DD */
  data: string
  /** contábil, com sinal (negativo = devedor) */
  valor: number
}

export interface ParsedBankStatement {
  header: BankStatementHeader
  lines: BankStatementLine[]
  /** Sprint Contraparte-Banrisul FASE 4 (13/08): período do extrato, se legível. */
  period: StatementPeriod | null

  // ⭐⭐ A RÉGUA (01/09/2026) — o PDF deixou de ser só fonte de NOME e passou a ser a
  // referência de SALDO. Campos OPCIONAIS: fixture antiga sem eles continua válida.
  /** "SALDO ANT EM dd/mm/aaaa" — a abertura do período. É a âncora da conferência. */
  saldoAnterior?: SaldoSnapshot | null
  /** um "SALDO NA DATA" por dia, em ordem — a régua dia a dia. */
  saldosDiarios?: SaldoDoDia[]
  /** "(+) BLOQUEADO + 24 HS" — valor retido, NÃO é lançamento. */
  bloqueado?: number | null
  /** "SALDO DEVEDOR" do cabeçalho = saldo DISPONÍVEL (já descontado o bloqueio). */
  saldoDisponivel?: number | null
  /** "EXTRATO EMITIDO AS HH:MM DE dd/mm/aaaa" — o instante do retrato. */
  emitidoEm?: string | null
  /** bloco "MOVIMENTOS FUTUROS": agendado, NUNCA lançamento realizado. */
  futuros?: BankStatementLine[]
}

/** Saldo declarado numa data específica. */
export interface SaldoSnapshot {
  data: string
  valor: number
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
