'use client'

// Modal "Vincular como transferência" — Sprint 1.7.
// Lista até 5 candidatas em outra conta, sinal oposto.
// Legado: PENDING, valor ±1¢, data ±3d → confirm → POST /pair-pendentes.
// Motor único (FASE 4, flag ON): classifyTransferPair decide (só camadas
// 1+2 aparecem, candidata pode estar RECONCILED) → apply-active-transfers
// in-place. É a MESMA regra do banner nesta mesma tela (Pendentes) — não
// pode discordar. Explicabilidade (badge + evidências) na própria linha.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeftRight, AlertTriangle, Loader2, ArrowRight } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'

interface TransacaoBase {
  id: string
  description: string
  amount: number
  type: 'CREDIT' | 'DEBIT'
  date: string
  bankAccount: { id: string; name: string; bankName: string | null }
}

interface Candidata {
  id: string
  description: string
  amount: number
  type: 'CREDIT' | 'DEBIT'
  date: string
  bankAccount: { id: string; name: string; bankName: string | null }
  // Motor único (FASE 4): explicabilidade — presentes com a flag ON.
  layer?: 'DETERMINISTIC' | 'STRONG' | 'WEAK'
  confidence?: number
  evidences?: string[]
}

interface VincularTransferenciaModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Empresa dona da tx (necessário pro apply do motor único)
  empresaId: string
  // Transação base (a que o user clicou no botão ↔)
  base: TransacaoBase | null
  // Recebe os 2 IDs apagados pra caller remover ambos da lista otimisticamente
  onSuccess?: (deletedIds: { idA: string; idB: string }) => void
}

const LAYER_LABEL: Record<NonNullable<Candidata['layer']>, { texto: string; cor: string }> = {
  DETERMINISTIC: { texto: 'Alta certeza', cor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' },
  STRONG: { texto: 'Forte indício', cor: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200' },
  WEAK: { texto: 'Indício fraco', cor: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200' },
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function VincularTransferenciaModal({
  open,
  onOpenChange,
  empresaId,
  base,
  onSuccess,
}: VincularTransferenciaModalProps) {
  const { toast } = useToast()
  const [candidatas, setCandidatas] = useState<Candidata[]>([])
  const [engine, setEngine] = useState<'unified' | 'legacy'>('legacy')
  const [loading, setLoading] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !base) return
    setErro(null)
    setConfirmingId(null)
    setCandidatas([])
    setEngine('legacy')
    setLoading(true)
    fetch(`/api/transferencias/candidatas/${base.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.erro) {
          setErro(data.erro)
          setCandidatas([])
        } else {
          setCandidatas(data.candidatas ?? [])
          setEngine(data.engine === 'unified' ? 'unified' : 'legacy')
        }
      })
      .catch(() => setErro('Erro ao buscar candidatas.'))
      .finally(() => setLoading(false))
  }, [open, base])

  if (!base) return null

  async function vincular(candidataId: string) {
    if (!base) return
    setSubmittingId(candidataId)
    setErro(null)
    try {
      // Motor único (FASE 4): apply in-place via apply-active-transfers
      // (mesmo endpoint do banner/parear) — NÃO deleta+recria. Legado usa
      // pair-pendentes (2× PENDING). Ambos preservam saldo.
      if (engine === 'unified') {
        const cand = candidatas.find((c) => c.id === candidataId)
        // Débito = perna DEBIT; crédito = perna CREDIT. base e candidata têm
        // sinal oposto (a query garante), então um de cada.
        const debitId = base.type === 'DEBIT' ? base.id : candidataId
        const creditId = base.type === 'DEBIT' ? candidataId : base.id
        const res = await fetch(`/api/empresas/${empresaId}/conciliation/apply-active-transfers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pairs: [{ debitId, creditId, confidence: cand?.confidence ?? 0.85 }],
          }),
        })
        const data = await res.json()
        if (!res.ok || (data.aplicadas ?? 0) === 0) {
          setErro(data.errors?.[0] ?? data.erro ?? 'Falha ao vincular')
          return
        }
        toast({
          variant: 'success',
          title: 'Vinculadas como transferência',
          description: `${formatBRL(base.amount)} · o par sumiu dos pendentes.`,
        })
        onSuccess?.({ idA: base.id, idB: candidataId })
        onOpenChange(false)
        return
      }

      const res = await fetch('/api/transferencias/pair-pendentes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transacaoIdA: base.id, transacaoIdB: candidataId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErro(data.erro ?? 'Falha ao vincular')
        return
      }
      toast({
        variant: 'success',
        title: 'Vinculadas como transferência',
        description: `${formatBRL(data.transferencia.amount)} · ${data.transferencia.fromAccount.name} → ${data.transferencia.toAccount.name}`,
      })
      const [idA, idB] = data.transferencia.deletedTransactionIds ?? [base.id, candidataId]
      onSuccess?.({ idA, idB })
      onOpenChange(false)
    } catch {
      setErro('Erro de rede. Tente novamente.')
    } finally {
      setSubmittingId(null)
      setConfirmingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-primary" />
            Vincular como transferência
          </DialogTitle>
          <DialogDescription>
            Pareie esta transação com a contraparte em outra conta sua. Ambas
            viram um par TRANSFER e somem da lista de pendentes — sem inflar
            DRE/Fluxo de Caixa.
          </DialogDescription>
        </DialogHeader>

        {/* Header com a transação base */}
        <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Transação selecionada
          </p>
          <p className="font-medium truncate">{base.description}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span className="tabular-nums">
              {base.type === 'CREDIT' ? '+' : '-'} {formatBRL(base.amount)}
            </span>
            <span>·</span>
            <span>{base.bankAccount.name}</span>
            <span>·</span>
            <span>{formatDate(base.date)}</span>
          </div>
        </div>

        {erro && (
          <div className="flex items-start gap-2 rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <p>{erro}</p>
          </div>
        )}

        {/* Lista de candidatas */}
        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Buscando candidatas...
          </div>
        ) : candidatas.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <ArrowLeftRight className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">Nenhuma transação par sugerida</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              {engine === 'unified'
                ? 'Nenhum par com indício forte (mesma conta sua, sinal oposto, transferência interna). Isso é só sugestão — você pode parear na mão.'
                : 'Critérios: outra conta da empresa, sinal oposto, mesmo valor (±R$ 0,01) e data ±3 dias. Verifique se a outra ponta foi importada.'}
            </p>
            <Link
              href={`/empresas/${empresaId}/transferencias/parear`}
              className="text-xs text-primary underline mt-2"
            >
              Parear transferências manualmente →
            </Link>
            <p className="text-xs text-muted-foreground mt-2 max-w-xs">
              Se for aporte/aplicação/empréstimo, use o dropdown de categoria
              ao lado (Aporte de Capital, Mútuo entre Sócios, etc).
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border max-h-[300px] overflow-y-auto -mx-1">
            {candidatas.map((c) => (
              <li key={c.id} className="py-3 px-1">
                {confirmingId === c.id ? (
                  <div className="space-y-3">
                    <p className="text-sm">
                      Vincular essas duas como transferência? Ambas serão
                      substituídas pelo par TRANSFER. Saldos preservados.
                    </p>
                    <div className="flex gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmingId(null)}
                        disabled={submittingId === c.id}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => vincular(c.id)}
                        disabled={submittingId === c.id}
                      >
                        {submittingId === c.id && (
                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        )}
                        Confirmar vínculo
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingId(c.id)}
                    className="w-full text-left hover:bg-muted/40 -mx-2 px-2 py-1 rounded-md transition-colors flex items-start gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{c.description}</p>
                        {c.layer && (
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${LAYER_LABEL[c.layer].cor}`}
                          >
                            {LAYER_LABEL[c.layer].texto}
                            {typeof c.confidence === 'number' && ` · ${Math.round(c.confidence * 100)}%`}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                        <span className="tabular-nums font-medium">
                          {c.type === 'CREDIT' ? '+' : '-'} {formatBRL(c.amount)}
                        </span>
                        <span>·</span>
                        <span>{c.bankAccount.name}</span>
                        <span>·</span>
                        <span>{formatDate(c.date)}</span>
                      </div>
                      {c.evidences && c.evidences.length > 0 && (
                        <ul className="mt-1 space-y-0.5">
                          {c.evidences.map((e, i) => (
                            <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1">
                              <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                              <span>{e}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submittingId !== null}
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
