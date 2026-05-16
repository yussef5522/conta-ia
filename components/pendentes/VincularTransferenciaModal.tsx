'use client'

// Modal "Vincular como transferência" — Sprint 1.7.
// Lista até 5 candidatas (PENDING em outra conta, sinal oposto, valor ±1¢,
// data ±3d). Click numa candidata → confirm → POST /pair-pendentes.

import { useEffect, useState } from 'react'
import { ArrowLeftRight, AlertTriangle, Loader2, ArrowRight } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'

interface TransacaoBase {
  id: string
  description: string
  amount: number
  type: 'CREDIT' | 'DEBIT'
  date: string
  bankAccount: { id: string; name: string; bankName: string | null }
}

interface Candidata {
  id: string
  description: string
  amount: number
  type: 'CREDIT' | 'DEBIT'
  date: string
  bankAccount: { id: string; name: string; bankName: string | null }
}

interface VincularTransferenciaModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Transação base (a que o user clicou no botão ↔)
  base: TransacaoBase | null
  // Recebe os 2 IDs apagados pra caller remover ambos da lista otimisticamente
  onSuccess?: (deletedIds: { idA: string; idB: string }) => void
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function VincularTransferenciaModal({
  open,
  onOpenChange,
  base,
  onSuccess,
}: VincularTransferenciaModalProps) {
  const { toast } = useToast()
  const [candidatas, setCandidatas] = useState<Candidata[]>([])
  const [loading, setLoading] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !base) return
    setErro(null)
    setConfirmingId(null)
    setCandidatas([])
    setLoading(true)
    fetch(`/api/transferencias/candidatas/${base.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.erro) {
          setErro(data.erro)
          setCandidatas([])
        } else {
          setCandidatas(data.candidatas ?? [])
        }
      })
      .catch(() => setErro('Erro ao buscar candidatas.'))
      .finally(() => setLoading(false))
  }, [open, base])

  if (!base) return null

  async function vincular(candidataId: string) {
    if (!base) return
    setSubmittingId(candidataId)
    setErro(null)
    try {
      const res = await fetch('/api/transferencias/pair-pendentes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transacaoIdA: base.id, transacaoIdB: candidataId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErro(data.erro ?? 'Falha ao vincular')
        return
      }
      toast({
        variant: 'success',
        title: 'Vinculadas como transferência',
        description: `${formatBRL(data.transferencia.amount)} · ${data.transferencia.fromAccount.name} → ${data.transferencia.toAccount.name}`,
      })
      const [idA, idB] = data.transferencia.deletedTransactionIds ?? [base.id, candidataId]
      onSuccess?.({ idA, idB })
      onOpenChange(false)
    } catch {
      setErro('Erro de rede. Tente novamente.')
    } finally {
      setSubmittingId(null)
      setConfirmingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-primary" />
            Vincular como transferência
          </DialogTitle>
          <DialogDescription>
            Pareie esta transação com a contraparte em outra conta sua. Ambas
            viram um par TRANSFER e somem da lista de pendentes — sem inflar
            DRE/Fluxo de Caixa.
          </DialogDescription>
        </DialogHeader>

        {/* Header com a transação base */}
        <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Transação selecionada
          </p>
          <p className="font-medium truncate">{base.description}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span className="tabular-nums">
              {base.type === 'CREDIT' ? '+' : '-'} {formatBRL(base.amount)}
            </span>
            <span>·</span>
            <span>{base.bankAccount.name}</span>
            <span>·</span>
            <span>{formatDate(base.date)}</span>
          </div>
        </div>

        {erro && (
          <div className="flex items-start gap-2 rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <p>{erro}</p>
          </div>
        )}

        {/* Lista de candidatas */}
        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Buscando candidatas...
          </div>
        ) : candidatas.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <ArrowLeftRight className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">Nenhuma transação par encontrada</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Critérios: outra conta da empresa, sinal oposto, mesmo valor (±R$ 0,01)
              e data ±3 dias. Verifique se a outra ponta foi importada.
            </p>
            <p className="text-xs text-muted-foreground mt-2 max-w-xs">
              Se for aporte/aplicação/empréstimo, use o dropdown de categoria
              ao lado (Aporte de Capital, Mútuo entre Sócios, etc).
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border max-h-[300px] overflow-y-auto -mx-1">
            {candidatas.map((c) => (
              <li key={c.id} className="py-3 px-1">
                {confirmingId === c.id ? (
                  <div className="space-y-3">
                    <p className="text-sm">
                      Vincular essas duas como transferência? Ambas serão
                      substituídas pelo par TRANSFER. Saldos preservados.
                    </p>
                    <div className="flex gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmingId(null)}
                        disabled={submittingId === c.id}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => vincular(c.id)}
                        disabled={submittingId === c.id}
                      >
                        {submittingId === c.id && (
                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        )}
                        Confirmar vínculo
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingId(c.id)}
                    className="w-full text-left hover:bg-muted/40 -mx-2 px-2 py-1 rounded-md transition-colors flex items-start gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{c.description}</p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                        <span className="tabular-nums font-medium">
                          {c.type === 'CREDIT' ? '+' : '-'} {formatBRL(c.amount)}
                        </span>
                        <span>·</span>
                        <span>{c.bankAccount.name}</span>
                        <span>·</span>
                        <span>{formatDate(c.date)}</span>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submittingId !== null}
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
