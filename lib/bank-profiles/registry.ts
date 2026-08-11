// FASE 2 — Registry dos perfis de banco + resolução por BANKID.
//
// RESOLUÇÃO PELO BANKID DO ARQUIVO, nunca pelo bankCode do DB — o DB pode estar
// errado (a Stone estava gravada como '000' em vez de '197'). O BANKID vem de
// dentro do OFX que está sendo importado; é a fonte da verdade pra este arquivo.

import type { BankProfile } from './types'

// ── BANRISUL (041) ────────────────────────────────────────────────────────────
const BANRISUL: BankProfile = {
  id: 'BANRISUL',
  displayName: 'Banrisul',
  bankCodes: ['41'],
  dateAnchor: 'DTASOF',
  listsFutureMovements: true,
  fitidStability: 'PER_DOWNLOAD',
  counterpartySource: 'PDF_ONLY',
  ledgerBalReliable: true,
  acctIdFormat: 'PLAIN',
  rationale: {
    dateAnchor: 'DTASOF = dia da emissão do extrato (09/08, 11/08…), confiável. Âncora = max(DTASOF, DTEND).',
    listsFutureMovements:
      'Lista movimento FUTURO junto com o realizado (ex: um extrato de 11/08 traz PAGAMENTO CARTAO de 17/08). Por isso precisa das duas camadas de descarte (data + LEDGERBAL).',
    fitidStability:
      'FITID renumera os lançamentos recentes a cada download — provado comparando 2 downloads (dl07×dl11: 7 de 44 mudaram; dl09×dl11: 2 de 45). NÃO usar como chave estável.',
    counterpartySource:
      'ÚNICO banco cujo OFX não traz favorecido: NAME==MEMO==histórico genérico ("PIX ENVIADO") em 45/45. Por isso existe o fluxo de enriquecimento por PDF. E como o FITID renumera, a chave documento==FITID só funciona quando OFX e PDF vêm do MESMO download.',
    ledgerBalReliable: 'LEDGERBAL = saldo liquidado (NÃO inclui as linhas futuras listadas). Confiável.',
    acctIdFormat: 'ACCTID puro, 14 dígitos = agência+conta concatenados (02300605534106). Mas o cabeçalho do PDF vem formatado (06.055341.0-6) — a validação de conta normaliza os dois lados.',
    geral: 'Especificidade Banrisul: o enriquecimento por PDF existe SÓ por causa deste banco.',
  },
}

// ── SICREDI (748) ─────────────────────────────────────────────────────────────
const SICREDI: BankProfile = {
  id: 'SICREDI',
  displayName: 'Sicredi',
  bankCodes: ['748'],
  dateAnchor: 'LAST_REAL_TX',
  listsFutureMovements: false,
  fitidStability: 'MOSTLY_STABLE',
  counterpartySource: 'MEMO',
  ledgerBalReliable: true,
  acctIdFormat: 'PLAIN',
  rationale: {
    dateAnchor:
      'DTASOF vem no FIM DO MÊS (31/08 num extrato emitido em 06/08) — no FUTURO. Usar como âncora de data zera o descarte e deixa a validação Σ(EFFECTED)×LEDGERBAL TOOTHLESS (sempre "bate" trivialmente). Ancorar pela última tx REAL do arquivo.',
    listsFutureMovements: 'NÃO lista futuro: as tx param na data real (06/08), apesar do DTASOF 31/08.',
    fitidStability:
      'FITID numérico (11 díg, = REFNUM), quase sempre igual entre downloads, mas alguns PIX recentes renumeram (dl04×dl07: 2 de 112).',
    counterpartySource:
      'Favorecido embutido no MEMO longo (66-70 chars): "RECEBIMENTO PIX … NOME DO PAGADOR". NÃO precisa de PDF.',
    ledgerBalReliable: 'LEDGERBAL existe; confiável como saldo atual, apesar do DTASOF carimbado no fim do mês.',
    acctIdFormat: 'ACCTID puro, 16 dígitos.',
  },
}

// ── STONE (197) ───────────────────────────────────────────────────────────────
const STONE: BankProfile = {
  id: 'STONE',
  displayName: 'Stone',
  bankCodes: ['197'],
  dateAnchor: 'DTASOF',
  listsFutureMovements: false,
  fitidStability: 'STABLE',
  counterpartySource: 'MEMO',
  ledgerBalReliable: true,
  acctIdFormat: 'FORMATTED',
  rationale: {
    dateAnchor: 'DTASOF = dia da emissão, sem futuro. Âncora = max(DTASOF, DTEND). Simples.',
    listsFutureMovements: 'NÃO lista futuro; última tx == DTASOF.',
    fitidStability: 'FITID = UUID por transação, IDÊNTICO em todo download (290/290 e 178/178). Chave de identidade confiável.',
    counterpartySource: 'Favorecido no MEMO: "NOME DO FAVORECIDO - Transferência | Pix". NÃO precisa de PDF.',
    ledgerBalReliable: 'LEDGERBAL confiável.',
    acctIdFormat: 'ACCTID FORMATADO com hífen (22155748-1) — diferente de Banrisul/Sicredi.',
    geral: 'BANKID no OFX = 0197 (o DB gravava "000", corrigido pra 197 em 12/08). Aberto: 2 downloads do mesmo dia 07/08 com saldo divergente (7.605,88 vs 105,50) — provável raiz do "70k", investigar por aí.',
  },
}

// ── CAIXA (104) — FICHA INCOMPLETA ────────────────────────────────────────────
// Nenhum OFX salvo (7 imports, 0 rawOfxBlob). Comportamento DESCONHECIDO → o
// sistema trata como conservador e AVISA. Preencher quando o Yussef subir um OFX.
const CAIXA: BankProfile = {
  id: 'CAIXA',
  displayName: 'Caixa Econômica Federal',
  bankCodes: ['104'],
  incomplete: true,
  // defaults conservadores até ter OFX real:
  dateAnchor: 'LAST_REAL_TX', // não confiar em DTASOF sem prova
  listsFutureMovements: false,
  fitidStability: 'PER_DOWNLOAD', // pessimista: tratar como instável até provar
  counterpartySource: 'MEMO',
  ledgerBalReliable: false,
  acctIdFormat: 'PLAIN',
  rationale: {
    dateAnchor: 'FICHA INCOMPLETA — sem OFX real analisado. Conservador: última tx real.',
    listsFutureMovements: 'Desconhecido — assume não até provar.',
    fitidStability: 'Desconhecido — assume instável (pessimista) até provar.',
    counterpartySource: 'Desconhecido — assume MEMO até provar.',
    ledgerBalReliable: 'Desconhecido — não confiar até provar.',
    acctIdFormat: 'Desconhecido.',
    geral: 'Tem conta corrente com extrato (os "DEBITO PRESTA SIEMP" vêm daqui), mas nenhum OFX foi salvo. Preencher a ficha quando houver arquivo.',
  },
}

export const BANK_PROFILES: readonly BankProfile[] = [BANRISUL, SICREDI, STONE, CAIXA]

/** Normaliza um BANKID/bankCode pra comparar: só dígitos, sem zeros à esquerda. */
export function normalizeBankCode(code: string | null | undefined): string {
  return (code ?? '').replace(/\D/g, '').replace(/^0+/, '')
}

/**
 * Resolve o perfil pelo BANKID do OFX (fonte da verdade do arquivo). Retorna
 * `null` se o banco é DESCONHECIDO — o caller DEVE tratar (conservador + avisa,
 * nunca adivinha). `registry` é injetável pra teste de isolamento.
 */
export function resolveBankProfile(
  bankid: string | null | undefined,
  registry: readonly BankProfile[] = BANK_PROFILES,
): BankProfile | null {
  const norm = normalizeBankCode(bankid)
  if (!norm) return null
  return registry.find((p) => p.bankCodes.some((c) => normalizeBankCode(c) === norm)) ?? null
}
