'use client'

// ⭐⭐⭐ "MARCAR PAGA" — a PORTA ÚNICA na tela (R54, 25/11/2026).
//
// O diálogo mostra a PRÉVIA da porta (`previaDoVinculo`): o grupo do dia (a conta garantida
// inclusa), o que vai ser gravado (capital · juros · correção apurados) e o BLOQUEIO da régua
// única — com o porquê, e o botão travado. Confirmar grava pelos pedaços escolhidos
// (`transactionIds`) na MESMA função que a caixa de entrada e o OFX usam.
// ⛔ Antes: um candidato só, split próprio e gravação 1:1 que reescrevia a agenda.

import { useCallback, useEffect, useState } from 'react'
import { Loader2, AlertTriangle, CircleCheck } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'

interface Previa {
  loan: { contractNumber: string | null; lender: string; rateType: string | null }
  installment: { number: number; dueDate: string; amortization: number; payment: number; isEstimate: boolean }
  candidates: Array<{ id: string; description: string | null; amount: number; date: string; selected: boolean }>
  paidTotal: number
  jaVinculado: number
  paidTotalGravado: number
  split: { amortization: number; paidInterest: number; paidCorrection: number; paidPenalty: number; encargos: number; closingBalance: number; isPartial: boolean }
  splitInjected: boolean
  bloqueio: { code: string; mensagem: string } | null
}

interface Props {
  empresaId: string
  loanId: string
  parcelaNumber: number
  onClose: () => void
  onConfirmed: () => void
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' })

export function CandidatosDialog({ empresaId, loanId, parcelaNumber, onClose, onConfirmed }: Props) {
  const { toast } = useToast()
  const [previa, setPrevia] = useState<Previa | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [gravando, setGravando] = useState(false)
  const url = `/api/empresas/${empresaId}/emprestimos/${loanId}/parcelas/${parcelaNumber}/candidatos`

  const ler = useCallback(async (transactionIds?: string[]) => {
    setCarregando(true)
    try {
      const r = transactionIds
        ? await fetch(url, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ transactionIds }) })
        : await fetch(url, { credentials: 'include' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErro(j.erro ?? 'não consegui ler as linhas do extrato'); return }
      setPrevia(j); setErro(null)
    } finally { setCarregando(false) }
  }, [url])
  useEffect(() => { void ler() }, [ler])

  const selecionadas = previa?.candidates.filter((c) => c.selected).map((c) => c.id) ?? []
  const alternar = (id: string) => {
    if (!previa) return
    const atual = new Set(selecionadas)
    if (atual.has(id)) atual.delete(id); else atual.add(id)
    void ler([...atual])
  }

  async function confirmar() {
    if (!previa || selecionadas.length === 0 || previa.bloqueio) return
    setGravando(true)
    try {
      const r = await fetch(`/api/empresas/${empresaId}/emprestimos/${loanId}/parcelas/${parcelaNumber}`, {
        method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ transactionIds: selecionadas }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast({ variant: 'destructive', title: 'Não gravei', description: j.erro }); return }
      toast({ variant: 'success', title: `Parcela #${parcelaNumber} ${j.status === 'PARTIAL' ? 'paga em parte' : 'paga'}`, description: j.encargoApurado ? 'encargo apurado no pagamento' : undefined })
      onConfirmed()
    } finally { setGravando(false) }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Marcar paga · parcela #{parcelaNumber}{previa ? ` · ${previa.loan.lender}${previa.loan.contractNumber ? ` ${previa.loan.contractNumber}` : ''}` : ''}</DialogTitle>
        </DialogHeader>

        {carregando && !previa && <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />lendo o extrato…</div>}
        {erro && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

        {previa && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              vence {fmtDate(previa.installment.dueDate)} · agenda {formatBRL(previa.installment.payment)}{previa.installment.isEstimate ? ' (~ estimada)' : ''}
              {previa.jaVinculado > 0 && <> · já vinculado {formatBRL(previa.jaVinculado)}</>}
            </p>

            {previa.candidates.length === 0 ? (
              <p className="rounded-md border px-3 py-4 text-sm text-muted-foreground">nenhuma linha livre do extrato perto deste vencimento</p>
            ) : (
              <ul data-candidatas className="divide-y rounded-md border">
                {previa.candidates.map((c) => (
                  <li key={c.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                      <input type="checkbox" checked={c.selected} onChange={() => alternar(c.id)} disabled={carregando} />
                      <span className="w-14 tabular-nums text-muted-foreground">{fmtDate(c.date)}</span>
                      <span className="min-w-0 flex-1 truncate">{c.description}</span>
                      <b className="whitespace-nowrap tabular-nums">{formatBRL(c.amount)}</b>
                    </label>
                  </li>
                ))}
              </ul>
            )}

            {selecionadas.length > 0 && (
              <div className="rounded-md border bg-muted/30 px-3 py-3 text-sm">
                <p className="mb-1 font-semibold">Como fica nos livros</p>
                <div className="flex justify-between"><span>Amortização do principal</span><span className="tabular-nums">{formatBRL(previa.split.amortization)}</span></div>
                <div className="flex justify-between"><span>Juros do contrato</span><span className="tabular-nums">{formatBRL(previa.split.paidInterest)}</span></div>
                {previa.split.paidCorrection > 0 && <div className="flex justify-between"><span>Correção</span><span className="tabular-nums">{formatBRL(previa.split.paidCorrection)}</span></div>}
                <div className="mt-1 flex justify-between border-t pt-1 font-semibold"><span>Pago (soma dos pedaços)</span><span className="tabular-nums">{formatBRL(previa.paidTotalGravado)}</span></div>
                {previa.split.isPartial && <p className="mt-1 text-xs text-amber-700">pagamento parcial — a parcela segue em aberto até completar</p>}
                {!previa.splitInjected && !previa.split.isPartial && <p className="mt-1 text-xs text-muted-foreground">encargo a apurar: a agenda deste contrato não sustenta o split</p>}
              </div>
            )}

            {/* ⛔ a recusa DIZ o porquê — e trava o botão (a régua única, a mesma da gravação) */}
            {previa.bloqueio && (
              <p data-bloqueio className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />{previa.bloqueio.mensagem}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>Não é esta</Button>
              <Button onClick={confirmar} disabled={gravando || carregando || selecionadas.length === 0 || !!previa.bloqueio}>
                {gravando ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CircleCheck className="mr-1 h-4 w-4" />}
                Confirmar pagamento
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
