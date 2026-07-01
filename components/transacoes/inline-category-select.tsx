'use client'

// Sprint 3.0.3 B1 — edição inline da categoria de uma transação.
// Click na badge → abre dropdown → PATCH /api/transacoes/[id]
// → toast + atualiza estado local sem recarregar a página.
//
// Sprint Category-Combobox (29/06/2026): refatorado pra usar o
// CategoryCombobox único (Ramp/Mercury-grade). Mantém a mesma API pública
// (props transacaoId/current/categorias/onUpdated) pra não quebrar callers.
// Agora ganha busca por texto sem acento, agrupamento por dreGroup,
// navegação por teclado e (opcional) sugestão IA.

import { useState } from 'react'
import { useToast } from '@/components/ui/use-toast'
import { CategoryCombobox } from '@/components/transacoes/category-combobox'

export interface InlineCategorySelectCategoria {
  id: string
  name: string
  color: string | null
  dreGroup?: string | null
}

interface Props {
  transacaoId: string
  current: { id: string; name: string; color: string | null } | null
  categorias: InlineCategorySelectCategoria[]
  /** Sugestão IA opcional (regra/heurística que já existe na tx). */
  suggestedCategoryId?: string | null
  // Callback após PATCH OK — caller atualiza array de transações local
  onUpdated: (
    catId: string | null,
    cat: InlineCategorySelectCategoria | null,
  ) => void
  /**
   * Sprint Fluxo-Unificado-Retirada (30/06/2026): quando passado, dispara o
   * BridgeConviteModal se o user escolher categoria dreGroup=DISTRIBUICAO_LUCROS
   * (ou Pró-labore). Callers que quiserem o convite passam esses 4 campos.
   * Opt-in — quem não passar mantém comportamento antigo.
   */
  bridgeContext?: {
    empresaId: string
    amount: number
    description: string
    date: string
    defaultSocioPFId?: string | null
  }
  onBridgeCreated?: (bridgeId: string) => void
}

export function InlineCategorySelect({
  transacaoId,
  current,
  categorias,
  suggestedCategoryId,
  onUpdated,
  bridgeContext,
  onBridgeCreated,
}: Props) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  async function handleChange(novoId: string | null) {
    if (novoId === (current?.id ?? null)) return
    setSaving(true)
    try {
      const res = await fetch(`/api/transacoes/${transacaoId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: novoId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast({
          variant: 'destructive',
          title: 'Falha ao mudar categoria',
          description: data.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      const data = await res.json().catch(() => ({}))
      const novaCat = novoId
        ? categorias.find((c) => c.id === novoId) ?? null
        : null
      onUpdated(novoId, novaCat)

      // Sprint 5.0.2.m — Vendor Memory: backend pode ter aprendido fornecedor
      // e aplicado retroativamente em outras pendentes. Mostra count no toast.
      const vm:
        | { anchor: string | null; retroactiveCount: number }
        | undefined = data?.vendorMemory
      let description = novaCat?.name ?? 'Sem categoria'
      if (vm?.anchor && vm.retroactiveCount > 0) {
        description = `+${vm.retroactiveCount} ${vm.anchor} categorizadas automaticamente`
      } else if (vm?.anchor) {
        description = `Próximas "${vm.anchor}" serão automáticas · ${novaCat?.name ?? ''}`
      }

      toast({
        title: 'Categoria atualizada',
        description,
        duration: vm?.anchor ? 4500 : 2500,
      })
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro de rede',
        description: 'Falha ao salvar — tente de novo.',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <CategoryCombobox
      value={current?.id ?? null}
      categorias={categorias}
      suggestedCategoryId={suggestedCategoryId}
      onChange={handleChange}
      saving={saving}
      placeholder="Sem categoria"
      ariaLabel="Mudar categoria"
      askIfBridge={!!bridgeContext}
      bridgeContext={
        bridgeContext
          ? {
              txId: transacaoId,
              empresaId: bridgeContext.empresaId,
              amount: bridgeContext.amount,
              description: bridgeContext.description,
              date: bridgeContext.date,
              defaultSocioPFId: bridgeContext.defaultSocioPFId ?? null,
            }
          : undefined
      }
      onBridgeCreated={onBridgeCreated}
    />
  )
}
