'use client'

// Modal "Nova Transferência" — Sprint 0.5 Dia 4.
// Reutilizável: pode ser aberto de qualquer página com `empresaId`.
// Trata HTTP 422 (BalanceCheckError) com mensagem amigável SEM fechar o modal.

import { useEffect, useState } from 'react'
import { ArrowLeftRight, AlertTriangle, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'

interface Conta {
  id: string
  name: string
  bankName: string | null
  balance: number
}

interface NovaTransferenciaModalProps {
  empresaId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (groupId: string) => void
  defaultFromAccountId?: string
}

export function NovaTransferenciaModal({
  empresaId,
  open,
  onOpenChange,
  onSuccess,
  defaultFromAccountId,
}: NovaTransferenciaModalProps) {
  const { toast } = useToast()
  const [contas, setContas] = useState<Conta[]>([])
  const [loadingContas, setLoadingContas] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  // Mensagem de saldo insuficiente vinda do backend (HTTP 422). Renderizada
  // como banner amarelo dentro do modal, NÃO fecha o modal.
  const [saldoWarning, setSaldoWarning] = useState<string | null>(null)

  const [form, setForm] = useState({
    fromAccountId: defaultFromAccountId ?? '',
    toAccountId: '',
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    description: '',
  })

  // Reset/refetch quando o modal abre
  useEffect(() => {
    if (!open) return
    setErrors({})
    setSaldoWarning(null)
    setForm({
      fromAccountId: defaultFromAccountId ?? '',
      toAccountId: '',
      amount: '',
      date: new Date().toISOString().slice(0, 10),
      description: '',
    })
    fetchContas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultFromAccountId])

  async function fetchContas() {
    setLoadingContas(true)
    try {
      const res = await fetch(`/api/contas-bancarias?empresaId=${empresaId}`)
      if (res.ok) {
        const data = await res.json()
        setContas(data.contas ?? [])
      }
    } finally {
      setLoadingContas(false)
    }
  }

  function set(field: keyof typeof form, value: string) {
    setForm((p) => ({ ...p, [field]: value }))
    if (errors[field]) setErrors((p) => ({ ...p, [field]: '' }))
    setSaldoWarning(null)
  }

  function validateClient(): boolean {
    const next: Record<string, string> = {}
    if (!form.fromAccountId) next.fromAccountId = 'Selecione a conta de origem'
    if (!form.toAccountId) next.toAccountId = 'Selecione a conta de destino'
    if (form.fromAccountId && form.toAccountId && form.fromAccountId === form.toAccountId) {
      next.toAccountId = 'Origem e destino devem ser diferentes'
    }
    const amountNum = parseFloat(form.amount.replace(',', '.'))
    if (!form.amount || isNaN(amountNum) || amountNum <= 0) {
      next.amount = 'Valor deve ser maior que zero'
    }
    if (!form.date) next.date = 'Data obrigatória'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaldoWarning(null)
    if (!validateClient()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/transferencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAccountId: form.fromAccountId,
          toAccountId: form.toAccountId,
          amount: parseFloat(form.amount.replace(',', '.')),
          date: form.date,
          description: form.description.trim() || undefined,
        }),
      })

      if (res.status === 422) {
        const data = await res.json()
        setSaldoWarning(data.erro ?? 'Saldo insuficiente pra essa transferência.')
        return
      }

      const data = await res.json()
      if (!res.ok) {
        if (data.campos) setErrors(data.campos)
        toast({ variant: 'destructive', title: 'Erro', description: data.erro ?? 'Falha ao criar transferência' })
        return
      }

      toast({
        variant: 'success',
        title: 'Transferência criada',
        description: `${formatBRL(data.transferencia.amount)} de ${data.transferencia.fromAccount.name} → ${data.transferencia.toAccount.name}`,
      })
      onSuccess?.(data.transferencia.groupId)
      onOpenChange(false)
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro de rede. Tente novamente.' })
    } finally {
      setSubmitting(false)
    }
  }

  const contasDisponiveisOrigem = contas
  const contasDisponiveisDestino = contas.filter((c) => c.id !== form.fromAccountId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-primary" />
            Nova Transferência
          </DialogTitle>
          <DialogDescription>
            Move dinheiro entre contas da mesma empresa. Não afeta DRE/Fluxo Consolidado.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {saldoWarning && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Saldo insuficiente</p>
                <p className="text-xs mt-1">{saldoWarning}</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="fromAccountId">Conta de origem <span className="text-destructive">*</span></Label>
            <Select
              value={form.fromAccountId}
              onValueChange={(v) => set('fromAccountId', v)}
              disabled={loadingContas || contas.length === 0}
            >
              <SelectTrigger id="fromAccountId">
                <SelectValue placeholder={loadingContas ? 'Carregando...' : 'Selecione a conta'} />
              </SelectTrigger>
              <SelectContent>
                {contasDisponiveisOrigem.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="font-medium">{c.name}</span>
                    {c.bankName && <span className="text-muted-foreground text-xs ml-2">{c.bankName}</span>}
                    <span className="text-muted-foreground text-xs ml-2 tabular-nums">{formatBRL(c.balance)}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.fromAccountId && <p className="text-xs text-destructive">{errors.fromAccountId}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="toAccountId">Conta de destino <span className="text-destructive">*</span></Label>
            <Select
              value={form.toAccountId}
              onValueChange={(v) => set('toAccountId', v)}
              disabled={loadingContas || !form.fromAccountId}
            >
              <SelectTrigger id="toAccountId">
                <SelectValue placeholder={!form.fromAccountId ? 'Escolha origem primeiro' : 'Selecione a conta'} />
              </SelectTrigger>
              <SelectContent>
                {contasDisponiveisDestino.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="font-medium">{c.name}</span>
                    {c.bankName && <span className="text-muted-foreground text-xs ml-2">{c.bankName}</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.toAccountId && <p className="text-xs text-destructive">{errors.toAccountId}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="amount">Valor (R$) <span className="text-destructive">*</span></Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="5000,00"
                value={form.amount}
                onChange={(e) => set('amount', e.target.value)}
              />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Data <span className="text-destructive">*</span></Label>
              <Input
                id="date"
                type="date"
                value={form.date}
                onChange={(e) => set('date', e.target.value)}
              />
              {errors.date && <p className="text-xs text-destructive">{errors.date}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição <span className="text-muted-foreground font-normal">— opcional</span></Label>
            <Textarea
              id="description"
              placeholder="Ex: Reposição de saldo pra folha"
              rows={2}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || loadingContas}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {submitting ? 'Criando...' : 'Criar transferência'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
