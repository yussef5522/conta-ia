'use client'

// Sprint 5.0.2.t — Modal pra revisar candidatos a transferência interna
// detectados cross-conta (active-transfer-detector).

import { useState } from 'react'
import {
  Loader2,
  ArrowLeftRight,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  X,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'
import { ConfidenceSignal } from './ConfidenceSignal'

export interface TransferCandidateDTO {
  debit: {
    id: string
    description: string | null
    date: string | Date
    amount: number
    bankAccountId: string | null
    bankAccountName: string | null
  }
  credit: {
    id: string
    description: string | null
    date: string | Date
    amount: number
    bankAccountId: string | null
    bankAccountName: string | null
  }
  confidence: number
  matchType: 'EXACT_SAME_DAY' | 'EXACT_ADJACENT' | 'WITHIN_3DAYS'
  daysApart: number
}

const MATCH_LABEL: Record<TransferCandidateDTO['matchType'], string> = {
  EXACT_SAME_DAY: 'Mesmo dia',
  EXACT_ADJACENT: 'D±1',
  WITHIN_3DAYS: 'D±3',
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  empresaId: string
  candidates: TransferCandidateDTO[] | null
  onApplied: (aplicadas: number) => void
}

function formatDate(d: string | Date): string {
  return new Date(d).toLocaleDateString('pt-BR')
}

export function DetectarTransferenciasModal({
  open,
  onOpenChange,
  empresaId,
  candidates,
  onApplied,
}: Props) {
  const { toast } = useToast()
  const [applying, setApplying] = useState(false)
  /** REJEITADOS por id (debitId-creditId). Padrão: tudo aceito. */
  const [rejected, setRejected] = useState<Set<string>>(new Set())

  function keyOf(c: TransferCandidateDTO): string {
    return `${c.debit.id}-${c.credit.id}`
  }

  function toggleReject(c: TransferCandidateDTO) {
    const k = keyOf(c)
    setRejected((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  const acceptedCount = candidates
    ? candidates.filter((c) => !rejected.has(keyOf(c))).length
    : 0

  async function aplicar() {
    if (!candidates || applying) return
    setApplying(true)
    try {
      const pairs = candidates
        .filter((c) => !rejected.has(keyOf(c)))
        .map((c) => ({
          debitId: c.debit.id,
          creditId: c.credit.id,
          confidence: c.confidence,
          matchType: c.matchType,
        }))

      if (pairs.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Nenhuma seleção',
          description: 'Aceite pelo menos uma transferência pra aplicar.',
        })
        return
      }

      const res = await fetch(
        `/api/empresas/${empresaId}/conciliation/apply-active-transfers`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pairs }),
        },
      )
      const data = await res.json()
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Falha ao aplicar',
          description: data.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      toast({
        title: `${data.aplicadas} transferências marcadas`,
        description:
          data.aplicadas > 0
            ? `${data.aplicadas} pares conciliados como transferência interna`
            : 'Nenhum par conciliado',
      })
      onApplied(data.aplicadas)
      onOpenChange(false)
    } catch {
      toast({ variant: 'destructive', title: 'Erro de rede' })
    } finally {
      setApplying(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ArrowLeftRight className="h-5 w-5 text-violet-600" />
            Transferências entre contas
          </DialogTitle>
          <DialogDescription>
            Pares detectados entre contas da mesma empresa (mesmo valor,
            janela ±3 dias). Desmarque os que não forem transferência.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1">
          {!candidates ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : candidates.length === 0 ? (
            <div className="text-center py-16 text-sm text-muted-foreground">
              Nenhuma transferência cross-conta detectada nas pendentes.
            </div>
          ) : (
            <ul className="divide-y">
              {candidates.map((c) => {
                const k = keyOf(c)
                const aceito = !rejected.has(k)
                return (
                  <li
                    key={k}
                    className={`px-6 py-3 ${aceito ? '' : 'opacity-50'}`}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={aceito}
                        onCheckedChange={() => toggleReject(c)}
                        aria-label="Aceitar pareamento"
                      />
                      <ConfidenceSignal confidence={c.confidence} />
                      <span className="text-[10px] uppercase tracking-wide rounded bg-muted px-1.5 py-0.5">
                        {MATCH_LABEL[c.matchType]}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums ml-auto">
                        R$ {formatBRL(c.debit.amount)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-2 pl-8 text-sm">
                      <div className="flex items-start gap-2 min-w-0">
                        <ArrowUpRight className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="truncate font-medium" title={c.debit.description ?? ''}>
                            {c.debit.description ?? '(sem descrição)'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {formatDate(c.debit.date)} · {c.debit.bankAccountName ?? '?'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 min-w-0">
                        <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="truncate font-medium" title={c.credit.description ?? ''}>
                            {c.credit.description ?? '(sem descrição)'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {formatDate(c.credit.date)} · {c.credit.bankAccountName ?? '?'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <DialogFooter className="border-t bg-background px-6 py-3 sm:flex-row sm:justify-between">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground tabular-nums">{acceptedCount}</strong>{' '}
            {acceptedCount === 1 ? 'transferência será marcada' : 'transferências serão marcadas'}
          </p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={applying}
            >
              <X className="h-4 w-4 mr-1" />
              Cancelar
            </Button>
            <Button onClick={aplicar} disabled={applying || acceptedCount === 0}>
              {applying ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Check className="h-4 w-4 mr-1" />
              )}
              Marcar {acceptedCount}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
