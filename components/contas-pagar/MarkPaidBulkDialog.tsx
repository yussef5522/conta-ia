'use client'

// Sprint 5.0.3.0b — Modal "Marcar N contas como pagas" em lote.
// Sprint Caixa: adiciona seletor "Pagar com" (opcional) — bancos + Caixa
// diferenciado por ícone. Se Caixa, backend valida saldo.

import { useEffect, useMemo, useState } from 'react'
import { Loader2, AlertCircle, Wallet, Landmark } from 'lucide-react'
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

interface ContaPagamento {
  id: string
  name: string
  accountType: string
  balance: number
}

interface Props {
  open: boolean
  count: number
  empresaId: string
  transactionIds: string[]
  onClose: () => void
  /** Disparado quando bulk completa com sucesso. Passa data ISO + bankAccountId
   *  (opcional) pra que a página faça update OTIMISTA sem refetch (Sprint
   *  contas-pagar/no-scroll-jump). */
  onDone: (paymentDateISO: string, bankAccountId: string | null) => void
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
  // Sprint Caixa — seletor "Pagar com" (opcional)
  const [contas, setContas] = useState<ContaPagamento[]>([])
  const [bankAccountId, setBankAccountId] = useState<string>('')
  const [insufficientError, setInsufficientError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setDate(todayISO())
      setBlockedCount(null)
      setBankAccountId('')
      setInsufficientError(null)
      // Busca contas da empresa pra popular o select
      fetch(`/api/contas-bancarias?empresaId=${empresaId}`, {
        credentials: 'include',
      })
        .then((r) => (r.ok ? r.json() : { contas: [] }))
        .then((d) => setContas((d.contas ?? []) as ContaPagamento[]))
        .catch(() => setContas([]))
    }
  }, [open, empresaId])

  const selectedConta = useMemo(
    () => contas.find((c) => c.id === bankAccountId) ?? null,
    [contas, bankAccountId],
  )
  const isCash = selectedConta?.accountType === 'CASH'

  async function executar() {
    setLoading(true)
    setBlockedCount(null)
    setInsufficientError(null)
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
            ...(bankAccountId ? { bankAccountId } : {}),
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
        // Sprint Caixa — saldo insuficiente / cheque especial estourou
        if (data.code === 'CASH_INSUFFICIENT' || data.code === 'BALANCE_EXCEEDED') {
          setInsufficientError(data.erro)
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
      onDone(date, bankAccountId || null)
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

          {/* Sprint Caixa — Pagar com (opcional) */}
          <div className="space-y-1.5">
            <Label htmlFor="bulk-pay-account">
              Pagar com{' '}
              <span className="font-normal text-muted-foreground">— opcional</span>
            </Label>
            <select
              id="bulk-pay-account"
              value={bankAccountId}
              onChange={(e) => {
                setBankAccountId(e.target.value)
                setInsufficientError(null)
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              data-testid="bulk-pay-account"
            >
              <option value="">Não definir conta agora</option>
              <optgroup label="Bancos">
                {contas
                  .filter((c) => c.accountType !== 'CASH')
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      🏦 {c.name} · {c.balance.toFixed(2)}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Caixa (dinheiro físico)">
                {contas
                  .filter((c) => c.accountType === 'CASH')
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      💰 {c.name} · {c.balance.toFixed(2)}
                    </option>
                  ))}
              </optgroup>
            </select>
            {selectedConta && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                {isCash ? (
                  <Wallet className="h-3 w-3 text-amber-700" />
                ) : (
                  <Landmark className="h-3 w-3" />
                )}
                {isCash
                  ? 'Caixa físico — saldo será debitado, não vai pra Conciliação'
                  : 'Banco — saldo será debitado, não vai pra Conciliação (origem manual)'}
              </p>
            )}
          </div>

          {insufficientError && (
            <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm dark:border-rose-900 dark:bg-rose-950/30">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <p className="text-rose-900 dark:text-rose-100">{insufficientError}</p>
            </div>
          )}

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
