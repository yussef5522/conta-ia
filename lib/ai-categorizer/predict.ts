// Predição de categoria via regras aprendidas — Fase 3 Etapa 1.
// Função PURA — sem Prisma.
//
// Estratégia de match (ordem de prioridade):
//   1. EXACT — descrição literal normalizada igual ao padrão da regra.
//      Confidence usada = rule.confianca (default 1.0).
//   2. NORMALIZED — descrição APÓS strip prefixo/data igual ao padrão.
//      Confidence usada = rule.confianca * 0.9 (penalidade por ser inferência).
//
// MULTI-TENANT: caller DEVE filtrar regras por companyId antes de passar.
// Função não checa — mas RuleIndex carrega companyId pra defesa em profundidade.

import { normalizeDescription, normalizeExact } from './normalize'
import { canonizarHistorico } from '@/lib/bank-profiles/historico-canonico'
import { sinalCompativel, frasePorConflitoDeSinal, type SinalDaLinha } from './sinal-da-regra'
import type {
  Prediction,
  RuleSnapshot,
  TipoMatch,
  TxSnapshot,
} from './types'

// Penalidade aplicada quando match é NORMALIZED (vs EXACT).
// 1.0 manual → 0.9 normalized → cai em AUTO threshold (≥0.95)
// 0.85 normalized → 0.765 → cai em SUGESTAO (entre 0.75 e 0.95)
// Garantia: NORMALIZED nunca dispara AUTO no import.
const NORMALIZED_PENALTY = 0.9

// Index O(1) de regras por padrão.
//
// 3 estruturas pra busca em camadas:
//   exactByPattern: lookup direto via descrição original normalizada (case+acentos)
//   normalizedByPattern: lookup via descrição com strip prefixo+data
//   containsRules: array (Sprint 5.0.2.m) — Vendor Memory (anchor word).
//     CONTAINS roda em loop O(N×M) mas N é pequeno (<100 regras CONTAINS
//     típicas por empresa) e M é pequeno (~500 tx por OFX). Trivial.
//
// Multi-tenant: armazena companyId. Caller deve filtrar antes de buildRuleIndex.
export interface RuleIndex {
  companyId: string
  exactByPattern: Map<string, RuleSnapshot>
  normalizedByPattern: Map<string, RuleSnapshot>
  containsRules: RuleSnapshot[]
}

export function buildRuleIndex(
  companyId: string,
  rules: RuleSnapshot[],
): RuleIndex {
  if (!companyId) {
    throw new Error('companyId é obrigatório (isolamento multi-tenant)')
  }

  const exactByPattern = new Map<string, RuleSnapshot>()
  const normalizedByPattern = new Map<string, RuleSnapshot>()
  const containsRules: RuleSnapshot[] = []

  for (const rule of rules) {
    // Defesa em profundidade: NUNCA indexar regra de outra empresa.
    if (rule.companyId !== companyId) continue
    // Regras inativas são ignoradas no index (caller pode filtrar também).
    if (!rule.isActive) continue
    // categoryId null = regra de supplier only (BrasilAPI futura), skip por ora
    if (!rule.categoryId) continue

    if (rule.tipoMatch === 'EXACT') {
      exactByPattern.set(rule.padrao, rule)
    } else if (rule.tipoMatch === 'NORMALIZED') {
      normalizedByPattern.set(rule.padrao, rule)
    } else if ((rule.tipoMatch as string) === 'CONTAINS') {
      containsRules.push(rule)
    }
    // CNPJ ignorado nesta etapa
  }

  // Ordena CONTAINS por (vezesAplicada desc → padrão length desc):
  //  - regras mais usadas batem primeiro (heurística "high confidence")
  //  - padrão mais longo desempata (mais específico ganha)
  containsRules.sort((a, b) => {
    if (b.vezesAplicada !== a.vezesAplicada) {
      return b.vezesAplicada - a.vezesAplicada
    }
    return b.padrao.length - a.padrao.length
  })

  return { companyId, exactByPattern, normalizedByPattern, containsRules }
}

// Predição: retorna a melhor regra que casa com a transação OU null.
//
// Prioridade EXACT > NORMALIZED > CONTAINS (Sprint 5.0.2.m Vendor Memory).
// Se nenhum match → null.
/**
 * ⭐⭐ O CASAMENTO CRU, num lugar só — `predictCategory` e `explicarConflitoDeSinal`
 * consomem ESTE resultado.
 *
 * ⚠️ Duas funções públicas respondendo sobre a mesma linha (uma classifica, a outra explica
 * por que não classificou) **não podem discordar** — se a explicação achasse uma regra que
 * o classificador não achou, a tela diria "confira o sinal" numa linha que foi classificada.
 * Por isso o casamento é UM, e as duas o leem.
 */
function casarRegra(
  tx: { description: string; type?: string },
  index: RuleIndex,
): { rule: RuleSnapshot; tipo: TipoMatch; confidence: number } | null {
  if (!tx.description) return null

  // 1. Tentativa EXACT
  const exactKey = normalizeExact(tx.description)
  const exactRule = index.exactByPattern.get(exactKey)
  if (exactRule) return { rule: exactRule, tipo: 'EXACT', confidence: exactRule.confianca }

  // 2. Tentativa NORMALIZED (com strip de prefixo nome próprio + data)
  const normKey = normalizeDescription(tx.description)
  const normRule = index.normalizedByPattern.get(normKey)
  if (normRule) {
    return { rule: normRule, tipo: 'NORMALIZED', confidence: Math.min(normRule.confianca * NORMALIZED_PENALTY, 1.0) }
  }

  // 3. CONTAINS (Vendor Memory) — ⭐ AGORA PELO CANÔNICO.
  //
  // ⛔ ERA `descUpper.includes(padrao.toUpperCase())`, string CRUA: as normalizações de
  // 28/08 (que já colapsam "OP. CREDITO"/"OP.CREDITO") valiam só pros ramos EXACT e
  // NORMALIZED — e **todas** as regras do Banrisul são CONTAINS. Foi por isso que o
  // +5.252,06 de 04/09 caiu em "escolha você" por causa de UM espaço.
  //
  // ⚠️⚠️ E O CANÔNICO **SOMA**, NUNCA SUBSTITUI — medido antes de escrever: a regra
  // `"RECEBIMENTO PIX-PIX_CRE"` (**851 aplicações**) casa hoje por substring crua com
  // `"RECEBIMENTO PIX-PIX_CRED  43098655000157 TUNA PAGAMENTOS LTDA"`. No canônico o
  // catálogo expande `CRED → CREDITO`, o padrão vira `...PIX CRE` e o token `CRE` não
  // existe mais na descrição → **a regra de 851 aplicações pararia de morder**. Trocar uma
  // régua por outra teria consertado o Banrisul quebrando o Sicredi, em silêncio.
  //
  // ⚠️ E o lado canônico casa por TOKEN INTEIRO (com as bordas), senão o padrão "IOF"
  // acharia "BIOFARMA" — regra curta em substring solta é assim que se classifica dinheiro
  // no lugar errado.
  if (index.containsRules.length > 0) {
    const cru = tx.description.toUpperCase()
    const alvo = ` ${canonizarHistorico(tx.description)} `
    for (const rule of index.containsRules) {
      const casaCru = cru.includes(rule.padrao.toUpperCase())
      const casaCanonico = alvo.includes(` ${canonizarHistorico(rule.padrao)} `)
      if (casaCru || casaCanonico) {
        return { rule, tipo: 'CONTAINS' as TipoMatch, confidence: rule.confianca }
      }
    }
  }

  return null
}

/**
 * ⛔⛔ A regra casou pelo TEXTO mas o SINAL contradiz? Devolve a frase; senão, null.
 *
 * É o que a tela mostra no lugar do "escolha você" mudo — ver `sinal-da-regra.ts`.
 */
export function explicarConflitoDeSinal(
  tx: { description: string; type?: string },
  index: RuleIndex,
): string | null {
  const m = casarRegra(tx, index)
  if (!m) return null
  const sinal = tx.type === 'CREDIT' || tx.type === 'DEBIT' ? (tx.type as SinalDaLinha) : undefined
  if (!sinal || sinalCompativel(m.rule.dreGroupDaCategoria, sinal)) return null
  return frasePorConflitoDeSinal(tx.description.trim(), sinal, m.rule.padrao)
}

export function predictCategory(
  tx: { description: string; type?: string },
  index: RuleIndex,
): Prediction | null {
  if (!tx.description) return null

  const m = casarRegra(tx, index)
  if (!m) return null

  // ⛔⛔ SINAL CONTRADIZ O GRUPO DA CATEGORIA → NÃO CLASSIFICA (regra do dono).
  // Devolver `null` aqui é o que garante que NENHUM dos 5 chamadores auto-classifique:
  // quem quiser a explicação chama `explicarConflitoDeSinal`, que lê o MESMO casamento.
  const sinal = tx.type === 'CREDIT' || tx.type === 'DEBIT' ? (tx.type as SinalDaLinha) : undefined
  if (sinal && !sinalCompativel(m.rule.dreGroupDaCategoria, sinal)) return null

  return predictionFromRule(m.rule, m.tipo, m.confidence)
}

function predictionFromRule(
  rule: RuleSnapshot,
  tipoMatch: TipoMatch,
  confidence: number,
): Prediction {
  return {
    ruleId: rule.id,
    categoryId: rule.categoryId,
    supplierId: rule.supplierId,
    confidence,
    tipoMatch,
  }
}

// Predict em batch (otimização pro import). Retorna Map<txId, Prediction | null>.
export function predictBatch(
  txs: TxSnapshot[],
  index: RuleIndex,
): Map<string, Prediction | null> {
  const result = new Map<string, Prediction | null>()
  for (const tx of txs) {
    result.set(tx.id, predictCategory(tx, index))
  }
  return result
}
