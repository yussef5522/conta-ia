'use client'

// Sprint 5.0.3.0b — Modal "Marcar N contas como pagas" em lote.

import { useEffect, useState } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'

interface Props {
  open: boolean
  count: number
  empresaId: string
  transactionIds: string[]
  onClose: () => void
  /** Disparado quando bulk completa com sucesso. */
  onDone: () => void
  /** Disparado se backend retorna BLOCKED — UI pode oferecer ação de filtrar */
  onBlocked?: (blockedIds: string[]) => void
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function MarkPaidBulkDialog({
  open,
  count,
  empresaId,
  transactionIds,
  onClose,
  onDone,
  onBlocked,
}: Props) {
  const { toast } = useToast()
  const [date, setDate] = useState(todayISO())
  const [loading, setLoading] = useState(false)
  const [blockedCount, setBlockedCount] = useState<number | null>(null)

  useEffect(() => {
    if (open) {
      setDate(todayISO())
      setBlockedCount(null)
    }
  }, [open])

  async function executar() {
    setLoading(true)
    setBlockedCount(null)
    try {
      const res = await fetch(
        `/api/empresas/${empresaId}/contas-pagar/bulk`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'mark_paid',
            transactionIds,
            paymentDate: date,
          }),
        },
      )

      if (res.status === 422) {
        const data = await res.json().catch(() => ({}))
        if (data.code === 'BULK_BLOCKED_BY_EFFECTED') {
          setBlockedCount(data.blockedTransactionIds?.length ?? 0)
          onBlocked?.(data.blockedTransactionIds ?? [])
          return
        }
        toast({
          variant: 'destructive',
          title: 'Falha ao marcar como pagas',
          description: data.erro ?? 'Erro de validação',
        })
        return
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast({
          variant: 'destructive',
          title: 'Falha ao marcar como pagas',
          description: data.erro ?? `HTTP ${res.status}`,
        })
        return
      }

      const data = await res.json()
      toast({
        title: `${data.success} contas marcadas como pagas`,
        description: `Data: ${date.split('-').reverse().join('/')}`,
      })
      onDone()
      onClose()
    } catch {
      toast({ variant: 'destructive', title: 'Erro de rede' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !loading && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Marcar {count} {count === 1 ? 'conta' : 'contas'} como{' '}
            {count === 1 ? 'paga' : 'pagas'}
          </DialogTitle>
          <DialogDescription>
            Registra o pagamento sem mexer em saldo bancário. Pra debitar de
            uma conta, use &quot;Efetivar com banco&quot; individualmente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="bulk-payment-date">Data do pagamento</Label>
            <Input
              id="bulk-payment-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              data-testid="bulk-payment-date"
            />
          </div>

          {blockedCount !== null && blockedCount > 0 && (
            <div
              className="rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm flex items-start gap-2"
              data-testid="bulk-blocked-alert"
            >
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="font-medium text-amber-900 dark:text-amber-100">
                  {blockedCount} {blockedCount === 1 ? 'conta' : 'contas'} já{' '}
                  {blockedCount === 1 ? 'foi efetivada' : 'foram efetivadas'}{' '}
                  com banco
                </p>
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  Desmarque essas linhas antes de prosseguir. Use{' '}
                  &quot;Mostrar bloqueadas&quot; pra filtrar.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            type="button"
          >
            Cancelar
          </Button>
          <Button
            onClick={executar}
            disabled={loading || !date}
            type="button"
            data-testid="bulk-mark-paid-confirm"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Marcando...
              </>
            ) : (
              `Marcar ${count} como ${count === 1 ? 'paga' : 'pagas'}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
