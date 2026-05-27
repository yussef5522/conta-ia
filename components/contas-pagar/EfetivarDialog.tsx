'use client'

// Sprint 5.0.3.0a — Modal "Efetivar pagamento" extraído da page atual.
// Reusado em bulk action (Sprint 5.0.3.0b) também.

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'

export interface PayableForEfetivar {
  id: string
  description: string
  amount: number
  bankAccount: { id: string } | null
}

export interface BankAccountOption {
  id: string
  name: string
  bankName: string | null
}

interface Props {
  open: boolean
  conta: PayableForEfetivar | null
  bankAccounts: BankAccountOption[]
  onClose: () => void
  onDone: () => void
}

export function EfetivarDialog({
  open,
  conta,
  bankAccounts,
  onClose,
  onDone,
}: Props) {
  const { toast } = useToast()
  const [bankId, setBankId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)

  // Reset state quando abre uma conta nova
  if (open && conta && !bankId) {
    setBankId(conta.bankAccount?.id ?? bankAccounts[0]?.id ?? '')
  }

  async function executar() {
    if (!conta || !bankId || !date) return
    setLoading(true)
    try {
      const res = await fetch(`/api/transacoes/${conta.id}/efetivar`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentDate: date, bankAccountId: bankId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast({
          variant: 'destructive',
          title: 'Falha ao efetivar',
          description: data.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      toast({ title: 'Efetivada', description: conta.description })
      onDone()
      onClose()
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha de rede.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose()
          setBankId('')
        }
      }}
    >
      <DialogContent className="max-w-md">
        {conta && (
          <>
            <DialogHeader>
              <DialogTitle>Efetivar pagamento</DialogTitle>
              <DialogDescription>
                Marca como paga (lifecycle EFFECTED) e atualiza saldo da conta.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm font-medium">{conta.description}</p>
              <div className="space-y-1.5">
                <label className="text-xs">Data do pagamento</label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs">Conta bancária</label>
                <Select value={bankId} onValueChange={setBankId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione conta…" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.bankName ?? b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Valor:{' '}
                <strong className="tabular-nums">{formatBRL(conta.amount)}</strong>
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={loading}>
                Cancelar
              </Button>
              <Button
                onClick={executar}
                disabled={!bankId || !date || loading}
              >
                {loading ? 'Efetivando…' : 'Efetivar'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
