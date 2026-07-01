// Sprint Category-Combobox PJ Batch (30/06/2026) — helper único do onCreate
// do CategoryCombobox pra todas as telas PJ.
//
// Fluxo: user digita nome novo no combobox + clica "Criar" → callers chamam
// createCategoryForPJ(...) → POST /api/empresas/[id]/categorias com o type
// derivado do contexto (DEBIT/despesa → EXPENSE, CREDIT/receita → INCOME).
//
// POST /api/empresas/[id]/categorias exige name + type (lib/validations/categoria.ts).
// Retorna a CategoryLite pra o Combobox selecionar a nova imediatamente.
//
// Evita boilerplate em ~10 chamadas espalhadas.

import type { CategoryLite } from './category-search'

/** Tipo requerido pelo endpoint POST /api/empresas/[id]/categorias */
export type PjCategoryType = 'INCOME' | 'EXPENSE' | 'TRANSFER'

/**
 * Cria categoria PJ inline (usado pelo onCreate do CategoryCombobox).
 *
 * Retorna null em qualquer falha (rede, 4xx, 5xx) — o Combobox mostra loading
 * e volta ao estado anterior. Caller pode exibir toast se quiser sinalizar.
 */
export async function createCategoryForPJ(
  empresaId: string,
  name: string,
  type: PjCategoryType,
): Promise<CategoryLite | null> {
  const trimmed = name.trim()
  if (!trimmed) return null

  try {
    const res = await fetch(`/api/empresas/${empresaId}/categorias`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed, type }),
    })
    if (!res.ok) return null
    const data = await res.json().catch(() => null)
    if (!data || typeof data !== 'object') return null
    // API retorna a categoria direto (não wrap em { categoria: ... }).
    // Alguns endpoints podem envelopar — aceitamos os 2 shapes.
    const cat = (data as { id?: string; categoria?: unknown }).categoria ?? data
    if (!cat || typeof cat !== 'object') return null
    const c = cat as Record<string, unknown>
    if (typeof c.id !== 'string' || typeof c.name !== 'string') return null
    return {
      id: c.id,
      name: c.name,
      color: (c.color as string | null) ?? null,
      type: (c.type as string | null) ?? null,
      dreGroup: (c.dreGroup as string | null) ?? null,
    }
  } catch {
    return null
  }
}

/**
 * Deriva o type default a partir do contexto operacional.
 *
 * DEBIT (saída) → EXPENSE
 * CREDIT (entrada) → INCOME
 *
 * TRANSFER não é usado no onCreate (raramente cria categoria nova pra
 * transferência via combobox). Caller que precisar de TRANSFER pode passar
 * explicitamente.
 */
export function derivePjCategoryType(
  txType: 'CREDIT' | 'DEBIT' | 'TRANSFER' | string,
): PjCategoryType {
  if (txType === 'CREDIT') return 'INCOME'
  if (txType === 'TRANSFER') return 'TRANSFER'
  return 'EXPENSE'
}
