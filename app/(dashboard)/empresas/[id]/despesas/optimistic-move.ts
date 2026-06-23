// Sprint 11 — Helper puro de atualização otimista pós-recategorizar.
//
// Move N tx do bucket origem pro bucket destino (no breakdown + no txCache
// local), sem chamar API e sem router.refresh(). Mantém scroll/expanded.

import type {
  ExpenseBreakdownResult,
  ExpenseCategorySummary,
  ExpenseTransactionItem,
} from '@/lib/dashboard/expenses-breakdown'
import type { CategoriaPickerItem } from './category-picker'

export interface OptimisticMoveInput {
  breakdown: ExpenseBreakdownResult
  /** Cache de tx por categoria (lazy-loaded por expansão). */
  txCache: Record<string, { items: ExpenseTransactionItem[]; total: number; loading?: boolean }>
  /** Mapa id → tx (usado pra encontrar amount/categoria origem de quaisquer tx). */
  txById: Map<string, ExpenseTransactionItem>
  txIds: string[]
  novaCategoriaId: string
  /** Catálogo completo da empresa (pra resolver name/dreGroup quando a destino é nova no breakdown). */
  categoriasCatalogo: CategoriaPickerItem[]
}

export interface OptimisticMoveResult {
  breakdown: ExpenseBreakdownResult
  txCache: Record<string, { items: ExpenseTransactionItem[]; total: number; loading?: boolean }>
}

const EXPENSE_DRE_GROUPS = new Set([
  'CUSTO_PRODUTO_VENDIDO',
  'DESPESAS_PESSOAL',
  'DESPESAS_COMERCIAIS',
  'DESPESAS_ADMINISTRATIVAS',
  'DESPESAS_FINANCEIRAS',
  'OUTRAS_DESPESAS',
  'IMPOSTOS_SOBRE_LUCRO',
])

export function applyOptimisticMove(input: OptimisticMoveInput): OptimisticMoveResult {
  const { breakdown, txCache, txById, txIds, novaCategoriaId, categoriasCatalogo } = input

  if (txIds.length === 0) return { breakdown, txCache }

  // ─── 1. Decompor: pra cada tx, descobrir { id, amount, origemCategoryId, txItem } ───
  const moves: Array<{ tx: ExpenseTransactionItem; origemCatId: string }> = []
  for (const id of txIds) {
    const t = txById.get(id)
    if (!t) continue
    moves.push({ tx: t, origemCatId: t.categoryId })
  }
  if (moves.length === 0) return { breakdown, txCache }

  // ─── 2. Resolver categoria destino (pode ou não existir no breakdown atual) ───
  const destCatInfo = categoriasCatalogo.find((c) => c.id === novaCategoriaId)
  if (!destCatInfo || !destCatInfo.dreGroup) {
    // Sem info da categoria destino: não conseguimos atualizar otimisticamente
    // (ex: categoria nova fora do catálogo). Caller deve fazer refresh real.
    return { breakdown, txCache }
  }

  // ─── 3. Atualizar txCache: remove dos buckets origem, adiciona no destino ───
  const newTxCache: typeof txCache = { ...txCache }

  // Agrupa tx por origem pra fazer 1 update por bucket
  const txsByOrigem = new Map<string, ExpenseTransactionItem[]>()
  for (const m of moves) {
    const arr = txsByOrigem.get(m.origemCatId) ?? []
    arr.push(m.tx)
    txsByOrigem.set(m.origemCatId, arr)
  }

  for (const [origemCatId, txs] of txsByOrigem) {
    const bucket = newTxCache[origemCatId]
    if (!bucket) continue
    const idsRemove = new Set(txs.map((t) => t.id))
    const newItems = bucket.items.filter((t) => !idsRemove.has(t.id))
    newTxCache[origemCatId] = {
      ...bucket,
      items: newItems,
      total: Math.max(0, (bucket.total ?? 0) - txs.length),
    }
  }

  // Adiciona no destino — só se o bucket já está no cache (não força carregar)
  if (newTxCache[novaCategoriaId]) {
    const bucket = newTxCache[novaCategoriaId]
    const updatedItems: ExpenseTransactionItem[] = moves.map(({ tx }) => ({
      ...tx,
      categoryId: novaCategoriaId,
      categoryName: destCatInfo.name,
      dreGroup: destCatInfo.dreGroup ?? tx.dreGroup,
    }))
    newTxCache[novaCategoriaId] = {
      ...bucket,
      items: [...updatedItems, ...bucket.items],
      total: (bucket.total ?? 0) + moves.length,
    }
  }

  // ─── 4. Atualizar breakdown: subtrai do origem, soma no destino ───
  // breakdown.totalGeral NÃO muda (recategorizar move, não cria/remove).
  const newCategorias = [...breakdown.categorias]

  // Subtrai por origem
  for (const [origemCatId, txs] of txsByOrigem) {
    const totalMovedAmount = txs.reduce((s, t) => s + t.amount, 0)
    const idx = newCategorias.findIndex((c) => c.categoryId === origemCatId)
    if (idx >= 0) {
      const cur = newCategorias[idx]
      const newTotal = Math.max(0, cur.total - totalMovedAmount)
      const newQtd = Math.max(0, cur.qtdTx - txs.length)
      newCategorias[idx] = { ...cur, total: newTotal, qtdTx: newQtd }
    }
  }

  // Soma no destino — adiciona entry se necessário
  const totalMovedAll = moves.reduce((s, m) => s + m.tx.amount, 0)
  const destIdx = newCategorias.findIndex((c) => c.categoryId === novaCategoriaId)
  if (destIdx >= 0) {
    const cur = newCategorias[destIdx]
    newCategorias[destIdx] = {
      ...cur,
      total: cur.total + totalMovedAll,
      qtdTx: cur.qtdTx + moves.length,
    }
  } else {
    // Nova categoria no breakdown — só adiciona se é EXPENSE_DRE_GROUPS
    if (EXPENSE_DRE_GROUPS.has(destCatInfo.dreGroup ?? '')) {
      const nova: ExpenseCategorySummary = {
        categoryId: destCatInfo.id,
        name: destCatInfo.name,
        dreGroup: destCatInfo.dreGroup ?? '',
        total: totalMovedAll,
        qtdTx: moves.length,
        pctDoTotal: 0, // recalculado abaixo
        isTop: false,
      }
      newCategorias.push(nova)
    }
  }

  // Remove categorias com qtdTx=0 (esvaziaram)
  const filtered = newCategorias.filter((c) => c.qtdTx > 0)

  // Recalcula pcts em relação ao totalGeral (que NÃO mudou)
  const recalculado = filtered.map((c, idx) => ({
    ...c,
    pctDoTotal: breakdown.totalGeral > 0 ? (c.total / breakdown.totalGeral) * 100 : 0,
    isTop: false, // recalculado abaixo após sort
  }))
  // Ordena por total desc pra recomputar isTop
  recalculado.sort((a, b) => b.total - a.total)
  if (recalculado.length > 0) recalculado[0].isTop = true

  // Atualiza porGrupo (totais por dreGroup)
  const grupoMap = new Map<string, { total: number; qtdTx: number }>()
  for (const c of recalculado) {
    const prev = grupoMap.get(c.dreGroup) ?? { total: 0, qtdTx: 0 }
    grupoMap.set(c.dreGroup, { total: prev.total + c.total, qtdTx: prev.qtdTx + c.qtdTx })
  }
  const newPorGrupo = Array.from(grupoMap.entries())
    .map(([dreGroup, v]) => ({ dreGroup, ...v }))
    .sort((a, b) => b.total - a.total)

  const newBreakdown: ExpenseBreakdownResult = {
    ...breakdown,
    categorias: recalculado,
    totalCategorias: recalculado.length,
    porGrupo: newPorGrupo,
    // totalGeral e totalTx NÃO mudam — recategorizar move, não cria/remove tx
  }

  return { breakdown: newBreakdown, txCache: newTxCache }
}
