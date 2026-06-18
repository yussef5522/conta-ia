// Modal de candidatos pra marcação manual de parcela.
'use client'

import { useEffect, useState } from 'react'
import { Link2, Loader2, X, AlertCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'

interface Candidate {
  id: string
  date: string
  amount: number
  description: string
  amountDiff: number
  daysDiff: number
}

interface Props {
  empresaId: string
  loanId: string
  parcelaNumber: number
  onClose: () => void
  onConfirmed: () => void
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

export function CandidatosDialog({
  empresaId,
  loanId,
  parcelaNumber,
  onClose,
  onConfirmed,
}: Props) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [info, setInfo] = useState<{ payment: number; dueDate: string } | null>(null)
  const [linking, setLinking] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(
      `/api/empresas/${empresaId}/emprestimos/${loanId}/parcelas/${parcelaNumber}/candidatos`,
      { credentials: 'include' },
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setCandidates(d.candidates ?? [])
          setInfo({ payment: d.payment, dueDate: d.dueDate })
        }
      })
      .finally(() => setLoading(false))
  }, [empresaId, loanId, parcelaNumber])

  async function confirmar(txId: string) {
    setLinking(txId)
    try {
      const res = await fetch(
        `/api/empresas/${empresaId}/emprestimos/${loanId}/parcelas/${parcelaNumber}`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactionId: txId }),
        },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast({ variant: 'destructive', title: 'Falha', description: body.erro })
        return
      }
      toast({ title: `Parcela #${parcelaNumber} marcada como paga` })
      onConfirmed()
    } finally {
      setLinking(null)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Marcar parcela #{parcelaNumber} como paga</DialogTitle>
          <DialogDescription>
            {info && (
              <>
                Vencimento: <strong>{fmtDate(info.dueDate)}</strong> · Valor:{' '}
                <strong>{formatBRL(info.payment)}</strong>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Buscando candidatos…
          </div>
        ) : candidates.length === 0 ? (
          <div className="py-6 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-md px-4">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-900">Nenhum DEBIT no extrato bate</p>
              <p className="text-amber-800/80 text-xs mt-0.5">
                Janela ±7 dias do vencimento e valor ±R$ 1. Talvez o pagamento ainda não importou no
                extrato OFX.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {candidates.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => confirmar(c.id)}
                disabled={linking !== null}
                className="w-full text-left grid grid-cols-[1fr_auto] gap-3 items-center p-3 rounded-md border hover:border-primary/40 hover:bg-primary/5 transition-colors disabled:opacity-50"
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium truncate">{c.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmtDate(c.date)} ·{' '}
                    <span className={c.daysDiff === 0 ? 'text-emerald-700' : ''}>
                      {c.daysDiff === 0 ? 'mesma data' : `Δ ${c.daysDiff}d`}
                    </span>{' '}
                    ·{' '}
                    <span className={Math.abs(c.amountDiff) < 0.5 ? 'text-emerald-700' : ''}>
                      Δ valor {formatBRL(c.amountDiff)}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums">
                    {formatBRL(c.amount)}
                  </span>
                  {linking === c.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <Link2 className="h-4 w-4 text-primary" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="ghost" onClick={onClose}>
            <X className="h-4 w-4 mr-1" />
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
