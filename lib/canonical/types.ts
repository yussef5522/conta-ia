// Sprint Rearquitetura-Import FASE 2 (13/08) — O CANÔNICO: o contrato entre a
// CAMADA 1 (tradutores por banco) e a CAMADA 3 (negócio). Depois que existe, a
// Camada 3 NUNCA mais olha o arquivo cru — recebe só isto.
//
// PRINCÍPIO CENTRAL (decisão de produto): o RELÓGIO não entra em decisão nenhuma.
// A fonte é o ARQUIVO: data da linha, período do arquivo, LEDGERBAL. `new Date()`
// só serve pra exibir "hoje" na tela — nunca pra classificar transação. (Foi por
// relógio que o bug voltou 2×: future-line `> hoje` e is-preview `min(DTASOF,hoje)`.)

/** Efetivada = já postada. Agendada = o banco listou mas não liquidou (futuro).
 *  Desconhecida = o tradutor não tem certeza (banco incompleto) — a Camada 2
 *  (LEDGERBAL) resolve. NUNCA se chuta EFETIVADA sem base. */
export type CanonicalStatus = 'EFETIVADA' | 'AGENDADA' | 'DESCONHECIDA'

export interface CanonicalTransaction {
  /** Identidade ESTÁVEL escolhida pelo tradutor do banco (NÃO necessariamente o
   *  FITID — Banrisul renumera, então usa data+valor+descrição). */
  stableId: string
  datePosted: Date
  /** Valor com sinal (negativo = saída). */
  signedAmount: number
  /** Descrição CRUA, nunca alterada — alimenta o stableKey da Camada 3. */
  description: string
  /** Favorecido/pagador, se o banco fornecer (Banrisul não → null). */
  counterpartyName: string | null
  /** Documento do extrato, se fornecer (pro join do PDF etc). */
  document: string | null
  status: CanonicalStatus
}

export interface CanonicalStatement {
  /** BANKID do arquivo (fonte da verdade, não o bankCode do DB). */
  bankId: string | null
  /** Qual tradutor produziu (BANRISUL/SICREDI/STONE/CONSERVATIVE). */
  translatorId: string
  /** true = tradutor conservador (banco desconhecido/ficha incompleta). A TELA
   *  DEVE mostrar isso — "o sistema está adivinhando menos que o normal". */
  conservative: boolean
  /** Avisos pra tela (banco desconhecido, DTASOF ausente, etc). */
  warnings: string[]
  /** Período coberto pelo arquivo (null quando o arquivo não declara). */
  period: { start: Date | null; end: Date | null }
  /** Saldo declarado pelo banco + a data dele. `asOf` NULL quando o arquivo não
   *  traz DTASOF — o sistema NÃO inventa "hoje" (ver parser.ts:70, o relógio que
   *  se escondia ali). É o LEDGERBAL que o juiz (Camada 2) usa. */
  ledger: { balance: number | null; asOf: Date | null }
  transactions: CanonicalTransaction[]
}

/** Campos de ARQUIVO extraídos SEM relógio (DTASOF ausente = null, não hoje). */
export interface StatementFileFields {
  bankId: string | null
  accountId: string | null
  dtAsOf: Date | null
  dtStart: Date | null
  dtEnd: Date | null
  ledgerBalance: number | null
}

/** Um tradutor por banco. NÃO recebe relógio — só o arquivo já parseado. */
export interface BankTranslator {
  readonly id: string
  /** true pros tradutores conservadores (Caixa/desconhecido). */
  readonly conservative: boolean
  translate(input: TranslatorInput): CanonicalStatement
}

export interface TranslatorInput {
  /** Linhas + counterpartyName já parseadas (lib/ofx/parser). */
  lines: Array<{
    fitid: string
    datePosted: Date
    signedAmount: number
    description: string
    counterpartyName: string | null
  }>
  /** Campos de arquivo SEM relógio. */
  file: StatementFileFields
}
