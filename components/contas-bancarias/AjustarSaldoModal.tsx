'use client'

// Modal "Ajustar Saldo" — Sprint 1.5.
// Corrige o saldo de uma conta existente fazendo bater com o extrato do banco.
// Cria um lançamento de ajuste (categoria AJUSTE_SALDO — não infla DRE).

import { useState, useEffect } from 'react'
import { Scale, AlertTriangle, Loader2 } from 'lucide-react'
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
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'

interface AjustarSaldoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conta: { id: string; name: string; balance: number } | null
  onSuccess?: () => void
}

export function AjustarSaldoModal({
  open,
  onOpenChange,
  conta,
  onSuccess,
}: AjustarSaldoModalProps) {
  const { toast } = useToast()
  const [saldoCorreto, setSaldoCorreto] = useState('')
  const [motivo, setMotivo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Reseta o form quando o modal abre
  useEffect(() => {
    if (open) {
      setSaldoCorreto('')
      setMotivo('')
      setErro(null)
    }
  }, [open])

  if (!conta) return null

  // Preview do ajuste (client-side, espelha a lógica de buildBalanceAdjustment)
  const parsed = parseFloat(saldoCorreto.replace(',', '.'))
  const temValor = saldoCorreto.trim() !== '' && !isNaN(parsed)
  const diferenca = temValor ? Math.round((parsed - conta.balance) * 100) / 100 : 0
  const precisaAjuste = temValor && Math.abs(diferenca) >= 0.005

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!conta) return
    setErro(null)

    if (!temValor) {
      setErro('Informe o saldo correto.')
      return
    }
    if (!precisaAjuste) {
      setErro('O saldo informado já é o saldo atual. Nenhum ajuste necessário.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/contas-bancarias/${conta.id}/ajustar-saldo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saldoCorreto: parsed,
          motivo: motivo.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.campos) {
          setErro(Object.values(data.campos).join(' '))
        } else {
          setErro(data.erro ?? 'Falha ao ajustar saldo.')
        }
        return
      }

      toast({
        variant: 'success',
        title: 'Saldo ajustado',
        description: `${conta.name}: ${formatBRL(data.saldoAnterior)} → ${formatBRL(data.saldoNovo)}`,
      })
      onSuccess?.()
      onOpenChange(false)
    } catch {
      setErro('Erro de rede. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            Ajustar Saldo — {conta.name}
          </DialogTitle>
          <DialogDescription>
            Faz o saldo do CAIXAOS bater com o extrato real do seu banco.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {erro && (
            <div className="flex items-start gap-2 rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>{erro}</p>
            </div>
          )}

          <div className="rounded-md bg-muted/50 px-3 py-2 text-sm flex items-center justify-between">
            <span className="text-muted-foreground">Saldo atual no sistema</span>
            <span className="font-semibold tabular-nums">{formatBRL(conta.balance)}</span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="saldoCorreto">
              Saldo atual no extrato do banco (de hoje){' '}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="saldoCorreto"
              type="number"
              step="0.01"
              placeholder="-444178.92"
              value={saldoCorreto}
              onChange={(e) => {
                setSaldoCorreto(e.target.value)
                setErro(null)
              }}
            />
            <p className="text-xs text-muted-foreground">
              Abra o app do seu banco e digite o saldo que aparece lá. O sistema
              cria um lançamento de ajuste pra fazer o saldo bater. Pode ser
              negativo (cheque especial). Não afeta o DRE.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="motivo">
              Motivo <span className="text-muted-foreground font-normal">— opcional</span>
            </Label>
            <Textarea
              id="motivo"
              rows={2}
              maxLength={200}
              placeholder="Ex: saldo inicial não foi informado na criação da conta"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>

          {precisaAjuste && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <p className="font-medium">
                Ajuste de {formatBRL(diferenca)} ({diferenca > 0 ? 'entrada' : 'saída'})
              </p>
              <p className="text-xs mt-1">
                Cria um lançamento com data anterior ao histórico. Não afeta o DRE.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || !precisaAjuste}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {submitting ? 'Ajustando...' : 'Ajustar Saldo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
