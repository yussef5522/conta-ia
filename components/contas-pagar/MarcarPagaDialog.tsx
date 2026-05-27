'use client'

// Sprint 5.0.3.0a-fix — Modal mini "Marcar como paga".
//
// Só pede data do pagamento (default = hoje). Diferente do "Efetivar pagamento"
// que pede conta bancária + atualiza saldo. Aqui só registra que está paga
// (paymentDate set + status=RECONCILED) — útil pra pagamentos extra-conta.

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
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
import { formatBRL } from '@/lib/format/money'
import type { PayableRow } from './PayableTable'

interface Props {
  open: boolean
  conta: PayableRow | null
  onClose: () => void
  onDone: () => void
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function MarcarPagaDialog({ open, conta, onClose, onDone }: Props) {
  const { toast } = useToast()
  const [date, setDate] = useState(todayISO())
  const [loading, setLoading] = useState(false)

  // Reset data ao abrir
  useEffect(() => {
    if (open) setDate(todayISO())
  }, [open])

  async function executar() {
    if (!conta) return
    setLoading(true)
    try {
      const res = await fetch(`/api/contas-a-pagar/${conta.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentDate: date }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast({
          variant: 'destructive',
          title: 'Falha ao marcar como paga',
          description: data.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      toast({
        title: 'Marcada como paga',
        description: conta.description,
      })
      onDone()
      onClose()
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro de rede',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !loading && onClose()}>
      <DialogContent className="max-w-md">
        {conta && (
          <>
            <DialogHeader>
              <DialogTitle>Marcar como paga</DialogTitle>
              <DialogDescription>
                Registra o pagamento sem mexer em saldo bancário. Pra debitar
                de uma conta específica, use &quot;Efetivar pagamento&quot;.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
                <p className="font-medium">{conta.description}</p>
                <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                  R$ {formatBRL(conta.amount)}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="mark-paid-date">Data do pagamento</Label>
                <Input
                  id="mark-paid-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  data-testid="mark-paid-date"
                />
              </div>
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
                data-testid="mark-paid-confirm"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Marcando...
                  </>
                ) : (
                  'Marcar como paga'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
