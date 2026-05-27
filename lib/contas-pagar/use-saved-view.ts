'use client'

// Sprint 5.0.3.0b — Hook que gerencia saved view ativa via URL state.
//
// Responsabilidades:
//   - Lê `?view=<id>` do searchParams.
//   - Aplica filtros da view quando user clica chip.
//   - Detecta state "Custom" (filtros manuais não batem nenhuma view).
//
// Quem efetivamente seta o state dos filtros é o componente — esse hook
// só calcula o `activeViewId` (derivado) + expõe `selectView(id)` que retorna
// os filtros novos pro caller aplicar.

import { useMemo } from 'react'
import {
  SAVED_VIEWS,
  findActiveSavedView,
  isValidSavedViewId,
  getSavedView,
  type SavedViewId,
  type PayableFilterStateExt,
} from '@/lib/contas-pagar/saved-views'

interface UseSavedViewArgs {
  currentFilters: Partial<PayableFilterStateExt>
  urlViewParam: string | null
  now?: Date
}

interface UseSavedViewResult {
  activeViewId: SavedViewId | null
  applyView: (id: SavedViewId, now?: Date) => PayableFilterStateExt
}

export function useSavedView({
  currentFilters,
  urlViewParam,
  now,
}: UseSavedViewArgs): UseSavedViewResult {
  const effectiveNow = now ?? new Date()

  const activeViewId = useMemo(() => {
    // Prioridade 1: URL param se válido E filtros batem
    if (urlViewParam && isValidSavedViewId(urlViewParam)) {
      const expected = getSavedView(urlViewParam).buildFilters(effectiveNow)
      // Se filtros atuais batem com o esperado da view do URL, view ativa
      if (
        currentFilters.dataDe === expected.dataDe &&
        currentFilters.dataAte === expected.dataAte &&
        currentFilters.status === expected.status &&
        currentFilters.vencidasOnly === expected.vencidasOnly
      ) {
        return urlViewParam
      }
      // URL diz X mas filtros divergiram (user mexeu) → Custom
      return null
    }
    // Prioridade 2: detectar view ativa a partir dos filtros atuais
    return findActiveSavedView(currentFilters, effectiveNow)
  }, [
    urlViewParam,
    effectiveNow,
    currentFilters.dataDe,
    currentFilters.dataAte,
    currentFilters.status,
    currentFilters.vencidasOnly,
    currentFilters.dataField,
  ])

  function applyView(id: SavedViewId, when?: Date): PayableFilterStateExt {
    return getSavedView(id).buildFilters(when ?? new Date())
  }

  // Garante referência estável (placeholder pra dev de evitar lint warning)
  void SAVED_VIEWS

  return { activeViewId, applyView }
}
