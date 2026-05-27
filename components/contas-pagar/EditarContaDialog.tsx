'use client'

// Sprint 5.0.3.0a-fix — Modal de edição de PAYABLE.
//
// Campos editáveis: descrição, valor, vencimento, pagamento (opcional), notas.
// Validação client mínima + envio pra PATCH /api/contas-a-pagar/[id] (Zod no servidor).
//
// Não permite mudar favorecido/categoria nesta versão (sub-sprint 5.0.3.0c
// adicionará pickers — aqui o foco é viabilizar edição básica de números/datas).

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
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import type { PayableRow } from './PayableTable'

interface Props {
  open: boolean
  conta: PayableRow | null
  onClose: () => void
  onSaved: () => void
}

interface FormState {
  description: string
  amount: string // string pra controle do Input numeric
  dueDate: string // YYYY-MM-DD
  paymentDate: string // YYYY-MM-DD ou ''
  notes: string
}

function isoDateInput(d: string | null): string {
  if (!d) return ''
  // d pode vir como "2026-03-15T00:00:00.000Z" ou "2026-03-15"
  return d.slice(0, 10)
}

export function EditarContaDialog({
  open,
  conta,
  onClose,
  onSaved,
}: Props) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<FormState>({
    description: '',
    amount: '',
    dueDate: '',
    paymentDate: '',
    notes: '',
  })

  // Hydrata form quando conta muda
  useEffect(() => {
    if (conta) {
      setForm({
        description: conta.description,
        amount: String(conta.amount),
        dueDate: isoDateInput(conta.dueDate),
        paymentDate: isoDateInput(conta.paymentDate),
        notes: conta.notes ?? '',
      })
    }
  }, [conta?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!conta) return null

  async function salvar() {
    if (!conta) return
    setLoading(true)
    try {
      const body: Record<string, unknown> = {
        description: form.description,
        amount: parseFloat(form.amount.replace(',', '.')),
        notes: form.notes || null,
      }
      if (form.dueDate) body.dueDate = form.dueDate
      // paymentDate vazio = null (limpa), preenchido = nova data
      body.paymentDate = form.paymentDate || null

      const res = await fetch(`/api/contas-a-pagar/${conta.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast({
          variant: 'destructive',
          title: 'Falha ao salvar',
          description: data.erro ?? `HTTP ${res.status}`,
        })
        return
      }

      toast({
        title: 'Conta atualizada',
        description: form.description,
      })
      onSaved()
      onClose()
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro de rede',
        description: 'Tente novamente em alguns segundos.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !loading && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar conta a pagar</DialogTitle>
          <DialogDescription>
            Edite os dados desta conta. Categoria e fornecedor são editados
            via inline (sub-sprint c).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-description">Descrição</Label>
            <Input
              id="edit-description"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="Ex: Aluguel março"
              data-testid="edit-description"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-amount">Valor (R$)</Label>
              <Input
                id="edit-amount"
                type="text"
                inputMode="decimal"
                value={form.amount}
                onChange={(e) =>
                  setForm({ ...form, amount: e.target.value })
                }
                placeholder="0,00"
                data-testid="edit-amount"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-dueDate">Vencimento</Label>
              <Input
                id="edit-dueDate"
                type="date"
                value={form.dueDate}
                onChange={(e) =>
                  setForm({ ...form, dueDate: e.target.value })
                }
                data-testid="edit-dueDate"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-paymentDate">
              Data de pagamento{' '}
              <span className="text-xs text-muted-foreground">
                (deixe vazio se ainda não foi paga)
              </span>
            </Label>
            <Input
              id="edit-paymentDate"
              type="date"
              value={form.paymentDate}
              onChange={(e) =>
                setForm({ ...form, paymentDate: e.target.value })
              }
              data-testid="edit-paymentDate"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-notes">Notas</Label>
            <Textarea
              id="edit-notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              placeholder="Observações internas (NF, parcela, etc)"
              data-testid="edit-notes"
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
            onClick={salvar}
            disabled={loading || !form.description || !form.amount}
            type="button"
            data-testid="edit-save"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
