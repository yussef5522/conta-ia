// Sprint 3-Bugs Fase 2A (Yussef 12/06/2026) — Payload do preview do import OFX.
//
// Extrai a lógica de montar o payload do preview pra função PURA testável.
// Tem 2 versões:
//   - buildLegacyPreviewPayload: payload IDÊNTICO ao histórico (flag V2=false).
//     Pra não quebrar o fluxo de import atual.
//   - buildV2PreviewPayload: payload enriquecido com classificação 4-grupos
//     (skipDup / replaceManual / conciliatePayable / novasGenuinas).
//
// Ambas FUNÇÕES PURAS — recebem dados, retornam objeto serializável. ZERO
// acesso a DB. Quem faz IO é o route handler.

import type { OFXTransaction } from './parser'
import {
  findPreExistingMatches,
  normalizeUTC,
  type IncomingOfxTx,
  type ExistingCandidate,
  type ClassifyResult,
} from '@/lib/conciliacao/find-pre-existing-matches'
import { reconcileLedgerAnchorDay, type LedgerReconcileLine } from './future-line'

// ───────────────────────────────────────────────────────────────
// Payload LEGADO (preservado bit-pra-bit)
// ───────────────────────────────────────────────────────────────

export interface LegacyPreviewItem {
  fitid: string
  dedupHash: string
  date: Date
  amount: number
  type: 'CREDIT' | 'DEBIT'
  memo: string
}

export interface LegacyPreviewPayload {
  preview: LegacyPreviewItem[]
  total: number
  novas: number
  duplicadas: number
  errosParser: string[]
  banco: BancoDetectadoPayload | null
}

export interface BancoDetectadoPayload {
  codigo: string
  nome: string
  /** null quando não há perfil de conta suficiente pra comparar */
  batePerfilConta: boolean | null
}

export function buildLegacyPreviewPayload(input: {
  novas: Array<OFXTransaction & { dedupHash: string }>
  totalArquivo: number
  duplicadas: number
  errosParser: string[]
  banco: BancoDetectadoPayload | null
}): LegacyPreviewPayload {
  return {
    preview: input.novas.map((t) => ({
      fitid: t.fitid,
      dedupHash: t.dedupHash,
      date: t.datePosted,
      amount: t.amount,
      type: t.type,
      memo: t.memo,
    })),
    total: input.totalArquivo,
    novas: input.novas.length,
    duplicadas: input.duplicadas,
    errosParser: input.errosParser,
    banco: input.banco,
  }
}

// ───────────────────────────────────────────────────────────────
// Payload V2 — enriquecido com classificação 4-grupos
// ───────────────────────────────────────────────────────────────

interface CandidateWithMeta {
  id: string
  bankAccountId: string | null
  amount: number
  date: Date
  dueDate: Date | null
  description: string
  type: string
  origin: string
  lifecycle: string
  reconciledWithId: string | null
  transferGroupId: string | null
  category: { name: string } | null
  supplier: { razaoSocial: string } | null
}

export interface V2BaseItem {
  ofxIndex: number
  amount: number
  date: string  // ISO
  memo: string
  type: 'CREDIT' | 'DEBIT'
}

export interface V2SkipDupItem extends V2BaseItem {
  matchedTxId: string
  matchedAmount: number
  matchedDate: string
  matchedDescription: string
  matchedOrigin: 'OFX'
  similarity: number
  reason: string
}

export interface V2ReplaceManualItem extends V2BaseItem {
  matchedTxId: string
  matchedAmount: number
  matchedDate: string
  matchedDescription: string
  matchedOrigin: 'MANUAL'
  isTransferGroup: boolean
  transferGroupId: string | null
  similarity: number
  reason: string
}

export interface V2ConciliatePayableItem extends V2BaseItem {
  matchedTxId: string
  matchedAmount: number
  matchedDate: string
  matchedDescription: string
  matchedOrigin: 'IMPORT_EXCEL'
  matchedCategoryName: string | null
  matchedSupplierName: string | null
  diff: number
  similarity: number
  reason: string
}

export interface V2NovaGenuinaItem extends V2BaseItem {
  fitid: string
  dedupHash: string
}

/** Linha do DIA DA ÂNCORA reclassificada como AGENDADA pela CAMADA 2 (o banco
 *  listou mas o LEDGERBAL prova que ainda não liquidou). NÃO é importada. */
export interface V2AgendadaDiaItem extends V2BaseItem {
  fitid: string
  dedupHash: string
  /** signed (CREDIT +, DEBIT −) — pra somar no relatório de agendadas. */
  signedAmount: number
}

/** Hipótese sobre causa de divergência LEDGERBAL ≠ saldoPos (Sub-fase 2B). */
export type LedgerBalHipoteseTipo =
  | 'dup_marcada_nova'        // alguma nova é dup escondida
  | 'real_marcada_dup'        // alguma marcada como dup era real
  | 'historico_errado'        // balance pré-existente diverge do banco
  | 'linhas_futuras'          // diff == soma das linhas futuras (agendadas)
  | 'agendada_dia_ancora'     // diff == linha(s) do DIA DA ÂNCORA ainda não liquidadas (CAMADA 2)
  | 'todas_novas_transferencia' // diff == Σ(novas) e LEDGERBAL==balanceAtual → transferências internas
  | 'causa_desconhecida'      // NENHUMA hipótese explica a diferença — admitir em vez de chutar

export interface LedgerBalHipotese {
  tipo: LedgerBalHipoteseTipo
  label: string
  /** Indica a "mais provável" — pra UI destacar */
  maisProvavel: boolean
  /** ofxIndex que casam exatos com diff (quando aplicável) */
  suspeitos?: number[]
}

export interface LedgerBalCheckPayload {
  /** Dados do extrato */
  ledgerBalAmount: number | null
  ledgerBalDate: string | null     // ISO
  /** Dado do sistema */
  balanceAtual: number
  /** Cálculo do delta */
  deltaImportProposto: number
  saldoPosImport: number
  /** Verdict */
  available: boolean               // false se ledgerBalAmount=null
  bate: boolean                    // true se |LEDGERBAL - saldoPos| ≤ 0.02
  diff: number                     // LEDGERBAL - saldoPos
  /** Pro UI explicar quando não bate (vazio quando bate) */
  hipoteses: LedgerBalHipotese[]
}

export interface V2PreviewPayload {
  banco: BancoDetectadoPayload | null
  total: number
  errosParser: string[]
  duplicadasHashLegado: number
  classificacao: {
    skipDup: V2SkipDupItem[]
    replaceManual: V2ReplaceManualItem[]
    conciliatePayable: V2ConciliatePayableItem[]
    novasGenuinas: V2NovaGenuinaItem[]
    contagens: {
      total: number
      skipDup: number
      replaceManual: number
      conciliatePayable: number
      novasGenuinas: number
      duplicadasHashLegado: number
    }
  }
  ledgerBalCheck: LedgerBalCheckPayload
  /** CAMADA 2 (11/08): linhas do dia da âncora agendadas (não importadas). */
  agendadasDiaAncora: V2AgendadaDiaItem[]
}

// ───────────────────────────────────────────────────────────────
// LedgerBalCheck (Sub-fase 2B) — função pura
// ───────────────────────────────────────────────────────────────

const LEDGER_BAL_TOLERANCE = 0.02

/** Signed amount pra cálculo do delta:
 *  CREDIT (+amount) — entrada de dinheiro
 *  DEBIT  (-amount) — saída de dinheiro */
function signedAmount(item: { type: 'CREDIT' | 'DEBIT'; amount: number }): number {
  return item.type === 'CREDIT' ? item.amount : -item.amount
}

/** Constrói o LedgerBalCheck a partir do estado atual + classificação.
 *
 *  SKIP_DUP e REPLACE_MANUAL NÃO entram no delta (já estavam contados no
 *  balance). Apenas novasGenuinas + CONCILIATE_PAYABLE (que cria saída real)
 *  contribuem pro delta. */
export function buildLedgerBalCheck(input: {
  ledgerBalance: { amount: number; asOfDate: Date } | null
  balanceAtual: number
  novasGenuinas: V2NovaGenuinaItem[]
  conciliatePayable: V2ConciliatePayableItem[]
  /** Sprint Preview-Futuro (09/08): soma (signed) das linhas futuras já
   *  removidas do preview. Se o diff residual bater com ela, o diagnóstico
   *  aponta "linhas futuras" em vez de "histórico errado". */
  futurasSum?: number
  /** CAMADA 2 (11/08): resultado da reconciliação do dia da âncora quando NÃO
   *  resolveu sozinha (ambíguo). ofxIndex das linhas do dia da âncora suspeitas.
   *  Presente → o diagnóstico lidera com "agendada do dia", NÃO "duplicata". */
  agendadaDiaAncora?: { ambiguous: boolean; suspeitos: number[] }
}): LedgerBalCheckPayload {
  const deltaNovas = input.novasGenuinas.reduce((s, t) => s + signedAmount(t), 0)
  const deltaConcil = input.conciliatePayable.reduce((s, t) => s + signedAmount(t), 0)
  const deltaImportProposto = deltaNovas + deltaConcil
  const saldoPosImport = input.balanceAtual + deltaImportProposto

  // Sem LEDGERBAL no arquivo: verificação indisponível
  if (input.ledgerBalance === null) {
    return {
      ledgerBalAmount: null,
      ledgerBalDate: null,
      balanceAtual: input.balanceAtual,
      deltaImportProposto,
      saldoPosImport,
      available: false,
      bate: false,
      diff: 0,
      hipoteses: [],
    }
  }

  const diff = input.ledgerBalance.amount - saldoPosImport
  const bate = Math.abs(diff) <= LEDGER_BAL_TOLERANCE

  // Quando bate: nenhuma hipótese
  if (bate) {
    return {
      ledgerBalAmount: input.ledgerBalance.amount,
      ledgerBalDate: input.ledgerBalance.asOfDate.toISOString(),
      balanceAtual: input.balanceAtual,
      deltaImportProposto,
      saldoPosImport,
      available: true,
      bate: true,
      diff: 0,
      hipoteses: [],
    }
  }

  // Quando NÃO bate: lista as 3 hipóteses + identifica a mais provável
  // Sinal do diff:
  //   diff > 0 (LEDGERBAL > saldoPos) → banco tem MAIS saldo que sistema
  //     → falta entrada que sistema marcou como dup, ou tem saída a mais
  //   diff < 0 (LEDGERBAL < saldoPos) → banco tem MENOS saldo que sistema
  //     → sistema tem entrada falsa (algo marcado como nova que era dup),
  //       ou falta saída
  const suspeitosNovas = input.novasGenuinas
    .filter((t) => Math.abs(Math.abs(signedAmount(t)) - Math.abs(diff)) <= LEDGER_BAL_TOLERANCE)
    .map((t) => t.ofxIndex)

  // Heurística "mais provável":
  //   Se algum item nas novasGenuinas casa exato com |diff| → hipótese 1
  //   Caso contrário → hipótese 3 (histórico errado) é o palpite default
  const hasSuspeitoNova = suspeitosNovas.length > 0
  // Sprint Preview-Futuro (09/08): cruzamento explícito. Se o diff residual bate
  // com a SOMA das linhas futuras (agendadas), a causa é essa — NÃO "histórico
  // errado". Se as futuras (DEBIT) entrassem no saldoPos, ele ficaria BAIXO por
  // |futurasSum| → diff = −futurasSum. Logo o casamento é diff ≈ −futurasSum.
  // Rede de segurança: com o particionamento no preview o diff já vira 0.
  const futurasSum = input.futurasSum ?? 0
  const isFuturas =
    futurasSum !== 0 && Math.abs(diff + futurasSum) <= LEDGER_BAL_TOLERANCE

  // CAMADA 2 (11/08): quando a diferença bate com linha(s) do DIA DA ÂNCORA que
  // ainda não liquidaram, a causa é ESSA. `agendadaDiaAncora` só chega aqui quando
  // o subconjunto do dia REALMENTE soma a diferença (ver buildV2PreviewPayload) —
  // não basta EXISTIR linha do dia (foi o bug: acusava "agendada" no Stone 70k).
  const ancora = input.agendadaDiaAncora
  const isAgendadaDia = !!ancora && ancora.suspeitos.length > 0

  // NOVO (12/08): a diferença é EXATAMENTE o delta proposto E o banco declara o
  // MESMO saldo de antes (LEDGERBAL == balanceAtual) → as novas somam à diferença.
  // Caso Stone 70k: 6 créditos "YUSSEF" (transferências internas) cujo OUTRO LADO
  // já está no sistema. O sistema TINHA o dado (a soma bate) — agora usa.
  // ≥2 novas: com UMA só, "dup_marcada_nova" (mais específico) explica melhor.
  const isTodasNovas =
    input.novasGenuinas.length >= 2 &&
    Math.abs(input.ledgerBalance.amount - input.balanceAtual) <= LEDGER_BAL_TOLERANCE &&
    Math.abs(deltaImportProposto) > LEDGER_BAL_TOLERANCE

  // REGRA (12/08): só LIDERA com uma hipótese quando ela REALMENTE explica a
  // diferença. Se NENHUMA explica → "não identifiquei a causa" (admitir é mais
  // útil que apontar o lugar errado). Já chutou causa errada 4× (duplicata,
  // histórico, agendada) — não pode mais.
  // histórico errado EXPLICA quando o import não propôs delta (≈0 novas) mas o
  // saldo não bate: o problema é PRÉ-EXISTENTE, não deste import (por eliminação).
  const isHistorico = Math.abs(deltaImportProposto) <= LEDGER_BAL_TOLERANCE
  const lider =
    isAgendadaDia ? 'agendada_dia_ancora'
    : isFuturas ? 'linhas_futuras'
    : isTodasNovas ? 'todas_novas_transferencia'
    : hasSuspeitoNova ? 'dup_marcada_nova'
    : isHistorico ? 'historico_errado'
    : 'causa_desconhecida'
  const fmtDiff = `R$ ${Math.abs(diff).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const hipoteses: LedgerBalHipotese[] = [
    ...(isFuturas
      ? [{
          tipo: 'linhas_futuras' as const,
          label: 'A diferença é exatamente a soma dos lançamentos futuros (agendados) — eles não entram no saldo. Nada errado.',
          maisProvavel: lider === 'linhas_futuras',
        }]
      : []),
    ...(isAgendadaDia
      ? [{
          tipo: 'agendada_dia_ancora' as const,
          label: ancora!.ambiguous
            ? 'A diferença bate com lançamento(s) do dia — o banco listou mas ainda não debitou. Como há mais de um candidato, confirme qual não liquidou.'
            : 'A diferença é exatamente um lançamento do dia — o banco listou mas ainda não debitou (agendado). Não é duplicata.',
          maisProvavel: lider === 'agendada_dia_ancora',
          suspeitos: ancora!.suspeitos,
        }]
      : []),
    ...(isTodasNovas
      ? [{
          tipo: 'todas_novas_transferencia' as const,
          label: `A diferença (${fmtDiff}) é exatamente a soma das ${input.novasGenuinas.length} transações novas deste import. Provável que sejam transferências internas cujo outro lado já está no sistema (o banco não mudou o saldo). Confira antes de importar.`,
          maisProvavel: lider === 'todas_novas_transferencia',
          suspeitos: input.novasGenuinas.map((t) => t.ofxIndex),
        }]
      : []),
    {
      tipo: 'dup_marcada_nova',
      label: 'Alguma transação marcada como nova é, na verdade, duplicata (vai contar 2×).',
      maisProvavel: lider === 'dup_marcada_nova',
      suspeitos: hasSuspeitoNova ? suspeitosNovas : undefined,
    },
    {
      tipo: 'real_marcada_dup',
      label: 'Alguma transação marcada como "já no sistema" era real (faltando no balance).',
      maisProvavel: false,
    },
    // histórico errado é POSSIBILIDADE, nunca LÍDER — não é verificável. Fica
    // listada, mas não "chuta". Quando nada explica, quem lidera é causa_desconhecida.
    {
      tipo: 'historico_errado',
      label: 'Balance pré-existente diverge do banco (estrago histórico não relacionado a este import).',
      maisProvavel: lider === 'historico_errado',
    },
    ...(lider === 'causa_desconhecida'
      ? [{
          tipo: 'causa_desconhecida' as const,
          label: `Não identifiquei a causa desta diferença de ${fmtDiff}. Ela não bate com lançamentos futuros, agendados do dia, com todas as novas somadas, nem com uma transação nova isolada. Confira transações recentes ou aguardando par antes de importar.`,
          maisProvavel: true,
        }]
      : []),
  ]

  return {
    ledgerBalAmount: input.ledgerBalance.amount,
    ledgerBalDate: input.ledgerBalance.asOfDate.toISOString(),
    balanceAtual: input.balanceAtual,
    deltaImportProposto,
    saldoPosImport,
    available: true,
    bate: false,
    diff,
    hipoteses,
  }
}

export function buildV2PreviewPayload(input: {
  novas: Array<OFXTransaction & { dedupHash: string }>
  totalArquivo: number
  duplicadasHashLegado: number
  errosParser: string[]
  banco: BancoDetectadoPayload | null
  contaId: string
  candidates: CandidateWithMeta[]
  /** NOVO 2B — balance atual da conta (pra LedgerBalCheck) */
  contaBalance?: number
  /** NOVO 2B — LEDGERBAL extraído do OFX (pode ser null) */
  ledgerBalance?: { amount: number; asOfDate: Date } | null
  /** Sprint Preview-Futuro (09/08) — soma signed das linhas futuras removidas. */
  futurasSum?: number
  /** CAMADA 2 (11/08) — âncora = max(DTASOF, DTEND). Default = ledgerBalance.asOfDate. */
  anchor?: Date
}): V2PreviewPayload {
  // 1. Mapeia novas pra IncomingOfxTx
  const incoming: IncomingOfxTx[] = input.novas.map((t, index) => ({
    index,
    bankAccountId: input.contaId,
    amount: t.amount,
    date: normalizeUTC(t.datePosted),
    description: t.memo,
    type: t.type,
  }))

  // 2. Mapeia candidates pra ExistingCandidate
  const candidates: ExistingCandidate[] = input.candidates
    .map((c) => {
      const origin = c.origin as 'OFX' | 'MANUAL' | 'IMPORT_EXCEL' | 'ADJUSTMENT'
      const lifecycle = c.lifecycle as 'EFFECTED' | 'PAYABLE' | 'RECEIVABLE'
      // TRANSFER manual exporta como DEBIT no extrato real (banco emite saída).
      // Pra match contra OFX, normaliza type da perna manual de TRANSFER.
      const type: 'CREDIT' | 'DEBIT' =
        c.type === 'TRANSFER' ? 'DEBIT' : (c.type as 'CREDIT' | 'DEBIT')
      return {
        id: c.id,
        bankAccountId: c.bankAccountId,
        amount: c.amount,
        date: normalizeUTC(c.dueDate ?? c.date),
        description: c.description,
        type,
        origin,
        lifecycle,
        hasReconciledLink: c.reconciledWithId !== null,
      }
    })

  // 3. Classifica (função pura)
  const results = findPreExistingMatches({ incoming, candidates })

  // 4. Indexa pra lookup rápido
  const candidatesById = new Map(input.candidates.map((c) => [c.id, c]))

  // 5. Agrupa por action
  const skipDup: V2SkipDupItem[] = []
  const replaceManual: V2ReplaceManualItem[] = []
  const conciliatePayable: V2ConciliatePayableItem[] = []
  const novasGenuinas: V2NovaGenuinaItem[] = []

  for (const r of results) {
    const ofx = input.novas[r.ofxTxIndex]
    const base: V2BaseItem = {
      ofxIndex: r.ofxTxIndex,
      amount: ofx.amount,
      date: ofx.datePosted.toISOString(),
      memo: ofx.memo,
      type: ofx.type,
    }
    if (r.action === 'SKIP_DUP') {
      const matched = r.matchedTxId ? candidatesById.get(r.matchedTxId) : undefined
      if (!matched) continue
      skipDup.push({
        ...base,
        matchedTxId: matched.id,
        matchedAmount: matched.amount,
        matchedDate: matched.date.toISOString(),
        matchedDescription: matched.description,
        matchedOrigin: 'OFX',
        similarity: r.similarity ?? 0,
        reason: r.reason,
      })
    } else if (r.action === 'REPLACE_MANUAL') {
      const matched = r.matchedTxId ? candidatesById.get(r.matchedTxId) : undefined
      if (!matched) continue
      replaceManual.push({
        ...base,
        matchedTxId: matched.id,
        matchedAmount: matched.amount,
        matchedDate: matched.date.toISOString(),
        matchedDescription: matched.description,
        matchedOrigin: 'MANUAL',
        isTransferGroup: matched.transferGroupId !== null,
        transferGroupId: matched.transferGroupId,
        similarity: r.similarity ?? 0,
        reason: r.reason,
      })
    } else if (r.action === 'CONCILIATE_PAYABLE') {
      const matched = r.matchedTxId ? candidatesById.get(r.matchedTxId) : undefined
      if (!matched) continue
      conciliatePayable.push({
        ...base,
        matchedTxId: matched.id,
        matchedAmount: matched.amount,
        matchedDate: (matched.dueDate ?? matched.date).toISOString(),
        matchedDescription: matched.description,
        matchedOrigin: 'IMPORT_EXCEL',
        matchedCategoryName: matched.category?.name ?? null,
        matchedSupplierName: matched.supplier?.razaoSocial ?? null,
        diff: r.diff ?? 0,
        similarity: r.similarity ?? 0,
        reason: r.reason,
      })
    } else {
      // CREATE_NEW
      novasGenuinas.push({
        ...base,
        fitid: ofx.fitid,
        dedupHash: ofx.dedupHash,
      })
    }
  }

  // ── CAMADA 2 (11/08): reconcilia contra o LEDGERBAL. Se a diferença bate com
  // linha(s) do DIA DA ÂNCORA que o banco listou mas ainda não debitou, elas
  // saem das novasGenuinas → viram AGENDADAS (não importadas) e o saldo fecha.
  // Ambíguo/sem casamento → não mexe (o diagnóstico avisa a causa certa).
  const anchor = input.anchor ?? input.ledgerBalance?.asOfDate ?? null
  const agendadasDiaAncora: V2AgendadaDiaItem[] = []
  let novasFinais = novasGenuinas
  let agendadaDiaInfo: { ambiguous: boolean; suspeitos: number[] } | undefined

  if (input.ledgerBalance && anchor) {
    const camada2 = reconcileLedgerAnchorDay({
      newLines: novasGenuinas.map<LedgerReconcileLine>((n) => ({
        key: n.dedupHash,
        type: n.type,
        amount: n.amount,
        datePosted: new Date(n.date),
      })),
      balanceAtual: input.contaBalance ?? 0,
      ledgerBalance: input.ledgerBalance.amount,
      anchor,
    })
    if (camada2.resolved && camada2.scheduledKeys.length > 0) {
      const sched = new Set(camada2.scheduledKeys)
      novasFinais = []
      for (const n of novasGenuinas) {
        if (sched.has(n.dedupHash)) {
          agendadasDiaAncora.push({
            ofxIndex: n.ofxIndex,
            amount: n.amount,
            date: n.date,
            memo: n.memo,
            type: n.type,
            fitid: n.fitid,
            dedupHash: n.dedupHash,
            signedAmount: n.type === 'CREDIT' ? n.amount : -n.amount,
          })
        } else {
          novasFinais.push(n)
        }
      }
    } else if (camada2.ambiguous) {
      // AMBÍGUO = 2+ subconjuntos do dia da âncora REALMENTE somam a diferença
      // (só não dá pra escolher qual). Aí sim é "agendada do dia". Fix 12/08: NÃO
      // acusar "agendada" só porque EXISTE linha do dia sem ela explicar a
      // diferença (era o bug do Stone 70k — acusava agendada num 6.000 avulso).
      const suspeitos = novasGenuinas
        .filter((n) => camada2.anchorDayKeys.includes(n.dedupHash))
        .map((n) => n.ofxIndex)
      if (suspeitos.length > 0) agendadaDiaInfo = { ambiguous: true, suspeitos }
    }
  }

  const ledgerBalCheck = buildLedgerBalCheck({
    ledgerBalance: input.ledgerBalance ?? null,
    balanceAtual: input.contaBalance ?? 0,
    novasGenuinas: novasFinais,
    conciliatePayable,
    futurasSum: input.futurasSum,
    agendadaDiaAncora: agendadaDiaInfo,
  })

  return {
    banco: input.banco,
    total: input.totalArquivo,
    errosParser: input.errosParser,
    duplicadasHashLegado: input.duplicadasHashLegado,
    classificacao: {
      skipDup,
      replaceManual,
      conciliatePayable,
      novasGenuinas: novasFinais,
      contagens: {
        total: input.totalArquivo,
        skipDup: skipDup.length,
        replaceManual: replaceManual.length,
        conciliatePayable: conciliatePayable.length,
        novasGenuinas: novasFinais.length,
        duplicadasHashLegado: input.duplicadasHashLegado,
      },
    },
    ledgerBalCheck,
    agendadasDiaAncora,
  }
}

/** Helper pra UI/callers: feature flag ligada? */
export function isV2PreviewEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.IMPORT_PREVIEW_V2 === 'true'
}

/** Re-export para testes */
export type { ClassifyResult }
