'use client'

// Sprint Casar Pagamento (04/08/2026) — FASE 4: painel de vínculo N:1.
// Mostra a parcela, os lançamentos do contrato JÁ AGRUPADOS, o split (amortização
// fora do DRE + encargos despesa financeira) e saldo antes→depois. O usuário
// CONFERE e ajusta a seleção; UMA confirmação fecha tudo. Nunca vincula sozinho.

import { useEffect, useState, useCallback } from 'react'
import { Loader2, Landmark, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'
import { readJsonResponse } from '@/lib/http/safe-json'

interface Cand { id: string; description: string; amount: number; date: string; selected: boolean }
interface Split { amortization: number; encargos: number; paidInterest: number; paidCorrection: number; paidTotal: number; isPartial: boolean; closingBalance: number }
interface Preview {
  loan: { contractNumber: string | null; lender: string; rateType: string | null }
  installment: { number: number; dueDate: string; amortization: number; openingBalance: number; status: string; isEstimate: boolean }
  candidates: Cand[]
  paidTotal: number
  split: Split
  saldoAntes: number
  saldoDepois: number
  agendaValida: boolean
}
const fmtD = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split('-'); return `${d}/${m}/${y.slice(2)}` }

export function LinkPaymentModal({ empresaId, loanId, onClose, onDone }: { empresaId: string; loanId: string; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pv, setPv] = useState<Preview | null>(null)
  const [sel, setSel] = useState<Set<string>>(new Set())

  const load = useCallback(async (ids?: string[]) => {
    setLoading(true)
    const resp = await fetch(`/api/empresas/${empresaId}/emprestimos/${loanId}/vincular-parcela/preview`, {
      method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(ids ? { transactionIds: ids } : {}),
    })
    const { ok, data, message } = await readJsonResponse<Preview>(resp)
    if (!ok || !data) { toast({ variant: 'destructive', title: 'Erro', description: message ?? 'Falha ao carregar' }); onClose(); return }
    setPv(data)
    if (!ids) setSel(new Set(data.candidates.filter((c) => c.selected).map((c) => c.id)))
    setLoading(false)
  }, [empresaId, loanId, toast, onClose])

  useEffect(() => { void load() }, [load])

  function toggle(id: string) {
    const next = new Set(sel)
    next.has(id) ? next.delete(id) : next.add(id)
    setSel(next)
    void load([...next])
  }

  async function confirmar() {
    if (!pv || sel.size === 0) return
    setSaving(true)
    const resp = await fetch(`/api/empresas/${empresaId}/emprestimos/${loanId}/vincular-parcela/confirm`, {
      method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ installmentNumber: pv.installment.number, transactionIds: [...sel], confirm: true }),
    })
    const { ok, data, message } = await readJsonResponse<{ ok: boolean; splitInjected: boolean; isPartial: boolean }>(resp)
    if (!ok || !data) { toast({ variant: 'destructive', title: 'Não vinculei', description: message ?? 'Erro' }); setSaving(false); return }
    toast({ variant: 'success', title: data.isPartial ? 'Parcela parcialmente paga' : 'Parcela vinculada', description: data.splitInjected ? 'Encargos entraram no DRE; amortização fora (baixa de passivo).' : 'Vinculada — split fica "a definir" até a agenda ser corrigida.' })
    onDone()
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Landmark className="h-5 w-5" />Vincular pagamento — {pv?.loan.lender} {pv?.loan.contractNumber ?? ''}</DialogTitle>
        </DialogHeader>

        {loading || !pv ? (
          <div className="py-12 text-center"><Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-4">
            {!pv.agendaValida && (
              <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 flex gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                A agenda deste empréstimo não fecha — dá pra vincular (o dinheiro saiu), mas o split juros/principal só entra no DRE depois de corrigir a agenda.
              </div>
            )}

            <div className="rounded-md border p-3 text-sm">
              <p className="font-semibold">Parcela #{pv.installment.number} · vence {fmtD(pv.installment.dueDate)}</p>
              <p className="text-xs text-muted-foreground">Você <strong>confere</strong>, não digita — o CAIXAOS calcula a amortização pelo cronograma.</p>
            </div>

            {/* Lançamentos do contrato (agrupados) */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">Lançamentos deste contrato no período (desmarque o que não entra):</p>
              <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
                {pv.candidates.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-muted/50">
                    <input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} />
                    <span className="w-14 text-xs text-muted-foreground">{fmtD(c.date)}</span>
                    <span className="flex-1 truncate text-xs">{c.description}</span>
                    <span className="tabular-nums text-red-700">{formatBRL(c.amount)}</span>
                  </label>
                ))}
                {pv.candidates.length === 0 && <p className="px-3 py-3 text-xs text-muted-foreground text-center">Nenhum lançamento candidato.</p>}
              </div>
            </div>

            {/* Split */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md border p-2"><p className="text-[10px] text-muted-foreground">Pago (grupo)</p><p className="text-sm font-bold tabular-nums">{formatBRL(pv.paidTotal)}</p></div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-2"><p className="text-[10px] text-muted-foreground">Amortização (fora do DRE)</p><p className="text-sm font-bold tabular-nums text-slate-700">{formatBRL(pv.split.amortization)}</p></div>
              <div className="rounded-md border border-red-200 bg-red-50 p-2"><p className="text-[10px] text-muted-foreground">Encargos (despesa financeira)</p><p className="text-sm font-bold tabular-nums text-red-700">{formatBRL(pv.split.encargos)}</p></div>
            </div>
            <p className="text-xs text-center text-muted-foreground">Saldo devedor {formatBRL(pv.saldoAntes)} → <strong>{formatBRL(pv.saldoDepois)}</strong></p>
            {pv.split.isPartial && (
              <p className="text-xs text-center text-amber-700 flex items-center justify-center gap-1"><AlertTriangle className="h-3 w-3" />Pago menor que a amortização — parcela fica PARCIAL, não quita.</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={confirmar} disabled={saving || loading || !pv || sel.size === 0}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            <CheckCircle2 className="h-4 w-4 mr-1" />Confirmar vínculo ({sel.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
