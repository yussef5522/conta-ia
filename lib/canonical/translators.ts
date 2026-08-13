// Sprint Rearquitetura-Import FASE 2 (13/08) — OS TRADUTORES (Camada 1).
//
// Um por banco. Cada tratamento especial vem com a EVIDÊNCIA ESCRITA (garantia
// b): daqui a 6 meses ninguém lembra por que, e sem a prova alguém remove achando
// que é sobra. A ficha de banco (lib/bank-profiles/registry.ts) é a fonte da
// mesma evidência — aqui ela vira comportamento.
//
// ISOLAMENTO: cada spec é um objeto PURO e independente. Mexer no BANRISUL não
// toca no SICREDI (provado em __tests__/isolation.test.ts). O relógio NÃO entra
// em nenhuma decisão — só o arquivo.

import { translatorFromSpec, dtasofAnchor, maxLineDate, stableIdentity, type TranslatorSpec } from './build'

// ── BANRISUL (041) ────────────────────────────────────────────────────────────
// EVIDÊNCIA:
//  • FITID RENUMERA a cada download (7 de 44 mudaram dl07×dl11) → NÃO serve de
//    identidade. Identidade = data+valor+descrição (stableKey).
//  • FITID às vezes == YYMMDD da data (numeração por data) — mas a parcela JÁ PAGA
//    tem o MESMO padrão. Por isso o FITID NÃO decide status aqui (foi o bug de
//    13/08: emprestimo 4.092,02 FITID 260811 descartado já tendo saído).
//  • Lista MOVIMENTO FUTURO junto com o realizado → status por data vs âncora.
//  • Âncora = max(DTASOF, DTEND); DTASOF = emissão (confiável). Linha > âncora =
//    AGENDADA; <= âncora = EFETIVADA. SEM relógio.
//  • NAME == MEMO sempre → nunca traz favorecido (o enriquecimento vem do PDF).
export const BANRISUL_TRANSLATOR: TranslatorSpec = {
  id: 'BANRISUL',
  conservative: false,
  anchor: (input) => dtasofAnchor(input.file),
  identityOf: (l) => stableIdentity(l), // FITID renumera → não usar
  counterpartyOf: () => null, // NAME==MEMO → PDF_ONLY
}

// ── SICREDI (748) ─────────────────────────────────────────────────────────────
// EVIDÊNCIA:
//  • DTASOF e DTEND vêm no FIM DO MÊS (ex 31/08 num extrato de 06/08) = FUTURO.
//    Usar como âncora zeraria o descarte. Âncora = ÚLTIMA data real do arquivo
//    (o Sicredi NÃO lista futuro → a última linha é o "liquidado até aqui").
//  • FITID quase estável (2 de 112 renumeraram) → serve de identidade.
//  • Favorecido embutido no MEMO longo → o parser expõe quando NAME difere; senão
//    fica pra extração do MEMO (refinamento do tradutor, não bloqueia).
export const SICREDI_TRANSLATOR: TranslatorSpec = {
  id: 'SICREDI',
  conservative: false,
  anchor: (input) => maxLineDate(input), // DTASOF é fim-do-mês → última tx real
  identityOf: (l) => l.fitid || stableIdentity(l),
  counterpartyOf: (l) => l.counterpartyName,
}

// ── STONE (197) ───────────────────────────────────────────────────────────────
// EVIDÊNCIA:
//  • FITID = UUID por transação, IDÊNTICO em todo download (290/290) → identidade
//    confiável.
//  • NÃO lista futuro; última tx == DTASOF. Âncora = max(DTASOF, DTEND).
//  • Favorecido no MEMO ("NOME - Transferência | Pix") → parser expõe.
//  • ⚠️ VARRE O SALDO: dinheiro entra e sai, o LEDGERBAL não acompanha o movimento
//    intradiário. O juiz de saldo (Camada 2) tem que tolerar isso — anotado aqui
//    pra a Camada 2 tratar, NÃO pra o tradutor adivinhar.
export const STONE_TRANSLATOR: TranslatorSpec = {
  id: 'STONE',
  conservative: false,
  anchor: (input) => dtasofAnchor(input.file),
  identityOf: (l) => l.fitid || stableIdentity(l),
  counterpartyOf: (l) => l.counterpartyName,
}

// ── CONSERVADOR (Caixa 104 + qualquer banco DESCONHECIDO) ─────────────────────
// EVIDÊNCIA:
//  • Caixa: FICHA INCOMPLETA (0 OFX salvo em 7 imports) → comportamento
//    desconhecido. Banco desconhecido: idem. NÃO ADIVINHA.
//  • Identidade pessimista (data+valor+descrição) — não confia num FITID não
//    provado estável.
//  • Âncora: usa DTASOF só se ele NÃO estiver além dos dados (senão pode ser um
//    DTASOF fim-de-mês tipo Sicredi); nesse caso cai pra última data real. Tudo
//    clock-free (compara com a última linha do arquivo, não com "hoje").
//  • conservative=true + AVISO → a TELA mostra "classificação conservadora".
export const CONSERVATIVE_TRANSLATOR: TranslatorSpec = {
  id: 'CONSERVATIVE',
  conservative: true,
  anchor: (input) => {
    const last = maxLineDate(input)
    const dtAsOf = input.file.dtAsOf
    if (!dtAsOf) return last
    if (!last) return dtAsOf
    // DTASOF além da última linha = suspeito (fim-de-mês) → conservador usa a última.
    return dtAsOf.getTime() > last.getTime() ? last : dtAsOf
  },
  identityOf: (l) => stableIdentity(l),
  counterpartyOf: (l) => l.counterpartyName,
  baseWarnings: () => [
    'Banco não reconhecido ou ficha incompleta — o sistema está classificando de forma CONSERVADORA (adivinha menos). Confira o saldo antes de gravar.',
  ],
}

export const CANONICAL_TRANSLATORS = {
  BANRISUL: BANRISUL_TRANSLATOR,
  SICREDI: SICREDI_TRANSLATOR,
  STONE: STONE_TRANSLATOR,
  CONSERVATIVE: CONSERVATIVE_TRANSLATOR,
} as const

export {
  translatorFromSpec,
}
