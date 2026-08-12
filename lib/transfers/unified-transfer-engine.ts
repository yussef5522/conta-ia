// Sprint Motor-Único-Transferência (10/08/2026) — FASE 2.
//
// UM motor com 3 CAMADAS (não 4 motores separados). Cada sugestão carrega POR QUE
// foi sugerida (camada + sinais + confiança + evidências) — auditável na tela e no
// log. NÃO decide em silêncio. Reusa os helpers já calibrados:
//   - active-transfer-detector: blacklist, CNPJ próprio, anti-pessoa (o motor A)
//   - own-entity-signals: sinais de entidade própria (CNPJ/CPF/nome/conta)
//   - score-pair: a fórmula numérica comum (janela D±3, keyword)
//
// CAMADA 1 — DETERMINÍSTICA (0.99): CNPJ/CPF próprio no memo + mesmo dia + valor
//   exato. O sinal forte que Xero/QuickBooks não têm (PIX carrega o documento).
// CAMADA 2 — FORTE (≥0.85): valor exato + D±1..3 + palavra de transferência + SEM
//   nome de terceiro. Sugere, usuário confirma.
// CAMADA 3 — FRACA (<0.85): valor próximo (tarifa)/comum, janela maior. NUNCA
//   sugere sozinha — só aparece quando o usuário procura par manualmente.
// NUNCA SUGERE: valor redondo comum sem outro sinal (os 18/23 falsos positivos).
//
// EXTENSIBILIDADE (banco novo = configuração): os padrões (PIX/keyword/blacklist)
// vivem nos módulos compartilhados; adicionar banco = estender as listas, não
// reescrever o motor. A regra "2× PENDING" NÃO existe aqui (perdia par legítimo).

import {
  scorePair,
  CENT_TOLERANCE,
  MAX_DELTA_DAYS,
  MS_PER_DAY,
  type ScoringResult,
} from './score-pair'
import {
  extractOwnSignals,
  extractCnpjsFromDescription,
  normalizeCnpj,
  type OwnEntityRefs,
} from './own-entity-signals'
import {
  isBlacklistedDesc,
  hasPersonName,
} from '@/lib/conciliation/active-transfer-detector'

export type TransferLayer = 'DETERMINISTIC' | 'STRONG' | 'WEAK'

export interface UnifiedTx {
  id: string
  bankAccountId: string
  bankAccountName?: string
  date: Date
  type: 'CREDIT' | 'DEBIT' | string
  amount: number
  description: string
  /** só informativo — o motor NÃO exige PENDING (a regra do B saiu). */
  status?: string
}

export interface TransferSignals {
  ownEntity: boolean // CNPJ/CPF próprio em alguma perna
  sameDay: boolean
  exactValue: boolean // |Δ| ≤ 1 centavo
  transferKeyword: boolean // palavra forte de transferência
  thirdPartyName: boolean // pessoa numa perna SEM CNPJ próprio
  valorComum: boolean // valor aparece 3+ vezes em 60d
}

export interface TransferSuggestion {
  /** perna de SAÍDA (DEBIT). */
  from: UnifiedTx
  /** perna de ENTRADA (CREDIT). */
  to: UnifiedTx
  confidence: number
  layer: TransferLayer
  /** true = camadas 1+2 (sugere). false = camada 3 (só busca manual). */
  autoSuggest: boolean
  signals: TransferSignals
  /** POR QUE — pt-BR, pra tela e log. */
  evidences: string[]
  deltaDays: number
}

export interface UnifiedDetectOptions {
  refs: OwnEntityRefs
  /** valores que aparecem 3+ vezes em 60d (o caller calcula via groupBy). */
  valorComum?: ReadonlySet<number>
  /** piso da camada 3 (default 0.70). */
  minWeak?: number
  /** tolerância de "valor próximo" (tarifa) pra camada 3/busca manual. Default
   *  1% do valor (mín 1 centavo). Camadas 1/2 SEMPRE exigem valor exato. */
  tarifaTolerance?: (amount: number) => number
  /** FASE 4 (12/08): reconhecer NOME de sócio cadastrado (refs.ownerNames) como
   *  "próprio", não terceiro. NARROW — só com valor exato + MESMO DIA + keyword.
   *  Camada 2 (0.85, não 0.99): nome é sinal forte mas NÃO prova (homônimo).
   *  Default OFF (shadow-run antes de ligar). */
  matchOwnerName?: boolean
}

export interface UnifiedDetectResult {
  /** camadas 1+2 — aparecem como sugestão. */
  suggestions: TransferSuggestion[]
  /** camada 3 — NÃO sugeridas; só na busca manual. */
  weak: TransferSuggestion[]
}

const r2 = (n: number) => Math.round(n * 100) / 100
const sameCalendarDay = (a: Date, b: Date) =>
  a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10)
const daysBetween = (a: Date, b: Date) => Math.abs(a.getTime() - b.getTime()) / MS_PER_DAY
// Tarifa de PIX/TED é valor FIXO pequeno (poucos reais), não percentual — 1% de
// R$20.000 = R$200 não é tarifa, é outro lançamento. Banda = MENOR entre 1% e
// R$50 (decisão Yussef 10/08: prefere perder par ocasional a ter lista ignorada).
const defaultTarifa = (amount: number) =>
  Math.max(CENT_TOLERANCE, Math.min(Math.abs(amount) * 0.01, 50))

function hasForeignCnpj(desc: string, refs: OwnEntityRefs): boolean {
  const own = refs.cnpj ? normalizeCnpj(refs.cnpj) : null
  return extractCnpjsFromDescription(desc).some((c) => normalizeCnpj(c) !== own)
}

/**
 * Classifica UM par (débito d + crédito c) nas 3 camadas — ou null se não é
 * candidato. PURA e auditável: retorna a camada, os sinais e as evidências.
 * O caller garante contas diferentes; aqui validamos valor+janela+sinais.
 */
export function classifyTransferPair(
  d: UnifiedTx,
  c: UnifiedTx,
  opts: UnifiedDetectOptions,
): TransferSuggestion | null {
  if (d.bankAccountId === c.bankAccountId) return null
  const delta = daysBetween(d.date, c.date)
  if (delta > MAX_DELTA_DAYS) return null
  const diff = Math.abs(Math.abs(d.amount) - Math.abs(c.amount))
  const tarifa = (opts.tarifaTolerance ?? defaultTarifa)(d.amount)
  if (diff > tarifa) return null // nem valor próximo → não é candidato

  // ── HARD REJECTS (nunca candidato, nem na busca manual do detector) ──
  // Blacklist: empréstimo/tarifa/imposto. Mata o caso NURA×OP.CREDITO (1.000).
  if (isBlacklistedDesc(d.description) || isBlacklistedDesc(c.description)) return null
  // CNPJ de TERCEIRO numa perna → pagamento a terceiro, não transferência.
  if (hasForeignCnpj(d.description, opts.refs) || hasForeignCnpj(c.description, opts.refs)) return null

  const sigD = extractOwnSignals(d.description, opts.refs)
  const sigC = extractOwnSignals(c.description, opts.refs)
  const ownEntity =
    sigD.hasOwnCnpj || sigD.hasOwnerCpf || sigC.hasOwnCnpj || sigC.hasOwnerCpf
  // FASE 4 (12/08): nome de sócio cadastrado (hasOwnerName = nome COMPLETO como
  // substring, normalizado — homônimo "YUSSEF NEDAL..." NÃO casa "yussef abu
  // zahry musa") reconhecido como próprio. Gated por opts.matchOwnerName. NÃO
  // entra em `ownEntity` (camada 1 é reservada ao CNPJ documental).
  const matchOwner = opts.matchOwnerName === true
  const ownNameD = matchOwner && sigD.hasOwnerName
  const ownNameC = matchOwner && sigC.hasOwnerName
  const ownerNameSignal = ownNameD || ownNameC
  // Anti-pessoa (regra 4 do A): pessoa numa perna SEM sinal próprio = terceiro.
  // Sinal próprio = CNPJ/CPF próprio OU (com a flag) nome de sócio cadastrado.
  const thirdPartyName =
    (hasPersonName(d.description) && !(sigD.hasOwnCnpj || sigD.hasOwnerCpf || ownNameD)) ||
    (hasPersonName(c.description) && !(sigC.hasOwnCnpj || sigC.hasOwnerCpf || ownNameC))

  const scoring: ScoringResult = scorePair(
    { description: d.description, amount: Math.abs(d.amount), type: 'DEBIT', date: d.date },
    { description: c.description, amount: Math.abs(c.amount), type: 'CREDIT', date: c.date },
    opts.refs,
  )
  const exactValue = diff <= CENT_TOLERANCE
  const sameDay = sameCalendarDay(d.date, c.date)
  const transferKeyword = scoring.matchedKeyword === 'STRONG'
  const valorComum = opts.valorComum?.has(r2(Math.abs(d.amount))) ?? false

  const signals: TransferSignals = {
    ownEntity,
    sameDay,
    exactValue,
    transferKeyword,
    thirdPartyName,
    valorComum,
  }
  const baseEv = [...scoring.evidences]
  const mk = (layer: TransferLayer, confidence: number, head: string): TransferSuggestion => ({
    from: d,
    to: c,
    confidence: r2(confidence),
    layer,
    autoSuggest: layer !== 'WEAK',
    signals,
    evidences: [head, ...baseEv],
    deltaDays: Math.round(delta),
  })

  // ── CAMADA 1 — determinística: CNPJ/CPF próprio + mesmo dia + valor exato ──
  if (ownEntity && sameDay && exactValue) {
    return mk('DETERMINISTIC', 0.99, 'Camada 1 (0.99): CNPJ/CPF próprio no memo + mesmo dia + valor exato')
  }

  // ── CAMADA 2 (nome do sócio) — FASE 4: nome de sócio cadastrado no memo (sinal
  // FORTE, não prova → não é camada 1). NARROW: exige a combinação COMPLETA —
  // nome exato de sócio + valor EXATO + MESMO DIA + keyword de transferência +
  // sem terceiro. Sinal oposto e contas ≠ da mesma empresa o caller garante.
  // Confiança 0.85 (honesta: pode haver homônimo, apesar do match de nome completo).
  if (ownerNameSignal && !thirdPartyName && exactValue && sameDay && transferKeyword) {
    return mk('STRONG', Math.max(0.85, scoring.confidence), 'Camada 2 (nome do sócio no memo + mesmo dia + valor exato + palavra de transferência)')
  }

  // ── CAMADA 2 — forte: valor exato + D±1..3 + keyword transfer + sem terceiro ──
  // valor comum SEM sinal próprio nunca chega aqui (protege dos redondos).
  if (
    exactValue &&
    !thirdPartyName &&
    scoring.confidence >= 0.85 &&
    (transferKeyword || ownEntity) &&
    !(valorComum && !ownEntity)
  ) {
    return mk('STRONG', scoring.confidence, `Camada 2 (${r2(scoring.confidence)}): valor exato + D±${Math.round(delta)} + palavra de transferência, sem terceiro`)
  }

  // ── CAMADA 3 — fraca: NUNCA sugere sozinha; só busca manual. Entra SÓ se tem
  // SINAL de transferência (keyword forte OU entidade própria) e SEM terceiro —
  // senão é coincidência de valor (escola/entregador/"chat gpt"/nome de pessoa) e
  // vira ruído. Decisão Yussef 10/08: "prefiro perder par ocasional a lista
  // ignorada". Par sem sinal ainda pode ser pareado pelo CAMINHO MANUAL (o
  // usuário aponta os dois; o detector não precisa achar).
  if (
    !thirdPartyName &&
    (transferKeyword || ownEntity) &&
    scoring.confidence >= (opts.minWeak ?? 0.7)
  ) {
    const motivo = !exactValue ? 'valor próximo (possível tarifa)' : 'sinal de transferência sem confiança alta'
    return mk('WEAK', scoring.confidence, `Camada 3 (${r2(scoring.confidence)}, só busca manual): ${motivo}`)
  }

  return null
}

/**
 * Detecta pares numa lista de tx órfãs (não exige PENDING; não olha status).
 * Greedy 1:1 por confiança (cada tx num par só). Separa sugestões (camadas 1+2)
 * das fracas (camada 3, só busca manual).
 */
export function detectTransfers(
  txs: UnifiedTx[],
  opts: UnifiedDetectOptions,
): UnifiedDetectResult {
  const debits = txs.filter((t) => t.type === 'DEBIT')
  const credits = txs.filter((t) => t.type === 'CREDIT')

  // JANELA POR VALOR (13/08): o par O(D×C) é quadrático (5M na caçula) e por isso
  // tinha teto de 3.000 — que descartava SILENCIOSAMENTE os mais antigos. Mas
  // classifyTransferPair rejeita qualquer par com |Δvalor| > tarifa (linha do
  // `diff > tarifa`), então só vale a pena comparar créditos com |valor| DENTRO da
  // banda [|d|−tarifa, |d|+tarifa]. Ordena os créditos por |valor| 1× e faz busca
  // binária da banda por débito. RESULTADO IDÊNTICO ao O(D×C) (só pula os pares que
  // o classify rejeitaria na hora) — provado em `detect-transfers-window.test.ts`.
  // Reduz 5M→~700 candidatos → o teto vira desnecessário.
  const creditsByAmount = [...credits].sort((a, b) => Math.abs(a.amount) - Math.abs(b.amount))
  const creditAmts = creditsByAmount.map((c) => Math.abs(c.amount))
  // menor índice i com creditAmts[i] >= target (lower bound).
  const lowerBound = (target: number): number => {
    let lo = 0, hi = creditAmts.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (creditAmts[mid] < target) lo = mid + 1
      else hi = mid
    }
    return lo
  }

  const all: TransferSuggestion[] = []
  for (const d of debits) {
    const da = Math.abs(d.amount)
    const tarifa = (opts.tarifaTolerance ?? defaultTarifa)(d.amount)
    const start = lowerBound(da - tarifa)
    for (let i = start; i < creditsByAmount.length && creditAmts[i] <= da + tarifa; i++) {
      const res = classifyTransferPair(d, creditsByAmount[i], opts)
      if (res) all.push(res)
    }
  }
  // Ordena: sugestões antes (autoSuggest), depois confiança, depois menor janela.
  // Tie-break por id (determinístico) — assim o resultado NÃO depende da ordem de
  // inserção, então a janela por valor dá o MESMO greedy que o O(D×C) bruto.
  all.sort(
    (a, b) =>
      Number(b.autoSuggest) - Number(a.autoSuggest) ||
      b.confidence - a.confidence ||
      a.deltaDays - b.deltaDays ||
      a.from.id.localeCompare(b.from.id) ||
      a.to.id.localeCompare(b.to.id),
  )
  const used = new Set<string>()
  const suggestions: TransferSuggestion[] = []
  const weak: TransferSuggestion[] = []
  for (const p of all) {
    if (used.has(p.from.id) || used.has(p.to.id)) continue
    used.add(p.from.id)
    used.add(p.to.id)
    ;(p.autoSuggest ? suggestions : weak).push(p)
  }
  return { suggestions, weak }
}
