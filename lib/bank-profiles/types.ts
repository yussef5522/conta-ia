// FASE 2 — Modelo de perfil por banco (12/08/2026).
//
// Cada banco preenche o OFX de um jeito. Se você ajusta o sistema pra um, quebra
// pro outro. Este módulo torna esse comportamento DADO DECLARATIVO: adicionar
// banco = adicionar um objeto; mudar um banco = editar o objeto dele (isolado);
// banco sem perfil = o sistema AVISA em vez de adivinhar.
//
// Mesmo padrão dos parsers de documento (`lib/bank-statement-pdf/*`): cada banco
// com o seu, identificação por marca no cabeçalho (aqui = BANKID do OFX), teste
// cruzado obrigatório provando que mexer num banco não muda os outros.
//
// A ficha (FASE 1) foi levantada contra OFX REAIS: Banrisul (3 downloads),
// Sicredi (3), Stone (3). Caixa: ficha INCOMPLETA (nenhum OFX salvo ainda).

/** Como o banco carimba a data-âncora do saldo. */
export type DateAnchorRule =
  /** DTASOF = dia da emissão, confiável (Banrisul, Stone). Âncora = max(DTASOF, DTEND). */
  | 'DTASOF'
  /** DTASOF vem no FIM DO MÊS (futuro) e não serve de âncora (Sicredi). Âncora = última tx real. */
  | 'LAST_REAL_TX'

/** Estabilidade do FITID entre downloads do MESMO extrato. */
export type FitidStability =
  /** UUID por transação, idêntico em todo download (Stone). Chave de identidade confiável. */
  | 'STABLE'
  /** Numérico, quase sempre igual, mas alguns lançamentos recentes renumeram (Sicredi). */
  | 'MOSTLY_STABLE'
  /** Renumera os lançamentos recentes a cada download (Banrisul). NUNCA usar como chave estável. */
  | 'PER_DOWNLOAD'

/** Onde mora o nome do favorecido/pagador (contraparte). */
export type CounterpartySource =
  /** Favorecido embutido no MEMO do próprio OFX (Sicredi, Stone). Sem PDF. */
  | 'MEMO'
  /** NAME==MEMO==histórico genérico; favorecido SÓ no PDF do extrato (Banrisul). */
  | 'PDF_ONLY'

/**
 * Ficha declarativa de um banco. Cada campo de comportamento vem acompanhado do
 * PORQUÊ em `rationale` — texto legível, com a evidência da FASE 1. Daqui a 6
 * meses ninguém vai lembrar por que o campo está assim; o rationale conta.
 */
export interface BankProfile {
  id: 'BANRISUL' | 'SICREDI' | 'STONE' | 'CAIXA'
  displayName: string
  /** BANKID(s) do OFX que mapeiam pra este perfil, normalizados (sem zero à esquerda). */
  bankCodes: string[]

  dateAnchor: DateAnchorRule
  /** O banco lista movimento FUTURO (agendado) junto com o realizado? */
  listsFutureMovements: boolean
  fitidStability: FitidStability
  counterpartySource: CounterpartySource
  /** LEDGERBAL é confiável como saldo do fechamento? */
  ledgerBalReliable: boolean
  /** ACCTID vem formatado (com pontos/hífen) ou puro? Afeta a validação de conta. */
  acctIdFormat: 'PLAIN' | 'FORMATTED'

  /** Ficha incompleta (sem OFX real analisado) → o sistema trata como conservador + avisa. */
  incomplete?: boolean

  /** O PORQUÊ de cada escolha, com a evidência da FASE 1 (texto legível). */
  rationale: {
    dateAnchor: string
    listsFutureMovements: string
    fitidStability: string
    counterpartySource: string
    ledgerBalReliable: string
    acctIdFormat: string
    geral?: string
  }
}
