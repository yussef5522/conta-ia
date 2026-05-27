'use client'

// Sprint 5.0.2.v — Ações admin isoladas (saíram do header /pendentes):
//   1. Reverter transferências marcadas erradas (Sprint t lenient)
//   2. Limpar cache global de IA com baixa confiança
//   3. Corrigir categorizações com tipo INCOMPATÍVEL (Sprint t guard)

import { useState } from 'react'
import { Loader2, AlertTriangle, Trash2, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'

interface Props {
  empresaId: string
}

interface ActionState {
  loading: boolean
  result: string | null
}

export function ManutencaoClient({ empresaId }: Props) {
  const { toast } = useToast()
  const [reverter, setReverter] = useState<ActionState>({
    loading: false,
    result: null,
  })
  const [cleanCache, setCleanCache] = useState<ActionState>({
    loading: false,
    result: null,
  })
  const [fixTypes, setFixTypes] = useState<ActionState>({
    loading: false,
    result: null,
  })

  async function handleReverter() {
    if (reverter.loading) return
    setReverter({ loading: true, result: null })
    try {
      const res = await fetch(
        `/api/empresas/${empresaId}/conciliation/unmark-bad-transfers`,
        { method: 'POST', credentials: 'include' },
      )
      const data = await res.json()
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Falha',
          description: data.erro ?? `HTTP ${res.status}`,
        })
        setReverter({ loading: false, result: null })
        return
      }
      const msg =
        data.paresRevertidos > 0
          ? `${data.paresRevertidos} pares revertidos (${data.transacoesRevertidas} tx voltaram pra pendentes)`
          : 'Nenhuma transferência marcada errada — banco consistente'
      toast({ title: 'Concluído', description: msg })
      setReverter({ loading: false, result: msg })
    } catch {
      toast({ variant: 'destructive', title: 'Erro de rede' })
      setReverter({ loading: false, result: null })
    }
  }

  async function handleCleanCache() {
    if (cleanCache.loading) return
    setCleanCache({ loading: true, result: null })
    try {
      const res = await fetch(
        `/api/empresas/${empresaId}/vendor-discovery/clean-cache`,
        { method: 'POST', credentials: 'include' },
      )
      const data = await res.json()
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Falha',
          description: data.erro ?? `HTTP ${res.status}`,
        })
        setCleanCache({ loading: false, result: null })
        return
      }
      const msg = `${data.deleted} entradas envenenadas removidas do cache global`
      toast({ title: 'Concluído', description: msg })
      setCleanCache({ loading: false, result: msg })
    } catch {
      toast({ variant: 'destructive', title: 'Erro de rede' })
      setCleanCache({ loading: false, result: null })
    }
  }

  async function handleFixTypes() {
    if (fixTypes.loading) return
    setFixTypes({ loading: true, result: null })
    try {
      const res = await fetch(
        `/api/empresas/${empresaId}/cleanup-type-mismatches`,
        { method: 'POST', credentials: 'include' },
      )
      const data = await res.json()
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Falha',
          description: data.erro ?? `HTTP ${res.status}`,
        })
        setFixTypes({ loading: false, result: null })
        return
      }
      const msg =
        data.corrigidas > 0
          ? `${data.corrigidas} transações com tipo incompatível voltaram pra pendentes (de ${data.analisadas} analisadas)`
          : 'Nenhum mismatch de tipo encontrado — categorizações consistentes'
      toast({ title: 'Concluído', description: msg })
      setFixTypes({ loading: false, result: msg })
    } catch {
      toast({ variant: 'destructive', title: 'Erro de rede' })
      setFixTypes({ loading: false, result: null })
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Operações esporádicas</p>
            <p className="text-xs text-muted-foreground mt-1">
              Estas ações limpam dados gerados por bugs ou regras antigas. Não
              precisam ser usadas no dia-a-dia — apenas quando o sistema
              detectar inconsistência.
            </p>
          </div>
        </div>
      </div>

      <ActionCard
        icon={<Wrench className="h-5 w-5 text-violet-600" />}
        title="Reverter transferências marcadas erradas"
        description="Reverte pares marcados como TRANSFER que falham as regras estritas (CNPJ próprio + PIX same-day). Volta status PENDING."
        buttonLabel="Reverter"
        loading={reverter.loading}
        result={reverter.result}
        onClick={handleReverter}
      />

      <ActionCard
        icon={<Trash2 className="h-5 w-5 text-violet-600" />}
        title="Limpar cache global de IA envenenado"
        description="Remove entradas globais de vendor discovery com baixa confidence ou categoria genérica (A Categorizar/Despesas Diversas)."
        buttonLabel="Limpar"
        loading={cleanCache.loading}
        result={cleanCache.result}
        onClick={handleCleanCache}
      />

      <ActionCard
        icon={<AlertTriangle className="h-5 w-5 text-violet-600" />}
        title="Corrigir categorizações com tipo incompatível"
        description="Acha tx DEBIT classificadas como RECEITA (ou vice-versa). Volta pra status PENDING pra revisão manual."
        buttonLabel="Corrigir"
        loading={fixTypes.loading}
        result={fixTypes.result}
        onClick={handleFixTypes}
      />
    </div>
  )
}

function ActionCard({
  icon,
  title,
  description,
  buttonLabel,
  loading,
  result,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  description: string
  buttonLabel: string
  loading: boolean
  result: string | null
  onClick: () => void | Promise<void>
}) {
  return (
    <div className="rounded-md border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-full bg-violet-50 dark:bg-violet-950/30 p-2">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium">{title}</h3>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
          {result && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
              ✓ {result}
            </p>
          )}
        </div>
        <Button
          onClick={() => void onClick()}
          disabled={loading}
          variant="outline"
          size="sm"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            buttonLabel
          )}
        </Button>
      </div>
    </div>
  )
}
