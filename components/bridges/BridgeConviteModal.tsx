'use client'

// Sprint Fluxo-Unificado-Retirada (30/06/2026) — Convite pós-categorização.
//
// Abre AUTOMATICAMENTE após user categorizar uma tx como Distribuição de
// Lucros (dreGroup=DISTRIBUICAO_LUCROS) ou Pró-labore. Design casado com
// o resto do fluxo (Mercury-grade — número heroi + 3 ações claras).
//
// 3 CTAs:
//   1. "Enviar ao PF agora" → abre NovaPonteForm modal pré-preenchido
//   2. "Deixar na fila"    → fecha; tx entra automaticamente na fila
//   3. "Não é retirada"    → fecha; user pode desmarcar categoria depois

import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Clock, Inbox, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatBRL } from '@/lib/format/money'
import { NovaPonteForm } from '@/components/bridges/NovaPonteForm'
import type { UltimaPonteDestino } from '@/app/api/empresas/[id]/socios/[socioId]/ultima-ponte-destino/route'

export interface BridgeConviteTxContext {
  txId: string
  amount: number
  description: string
  date: string
}

interface Props {
  open: boolean
  onClose: () => void
  empresaId: string
  txContext: BridgeConviteTxContext
  /** SocioPF sugerido (única na Cacula). Se null e user aceita, form pergunta. */
  defaultSocioPFId?: string | null
  onBridgeCreated?: (bridgeId: string) => void
}

export function BridgeConviteModal({
  open,
  onClose,
  empresaId,
  txContext,
  defaultSocioPFId,
  onBridgeCreated,
}: Props) {
  const [step, setStep] = useState<'invite' | 'form'>('invite')
  const [sugestao, setSugestao] = useState<UltimaPonteDestino | null>(null)

  // Reset do step ao fechar
  useEffect(() => {
    if (!open) setStep('invite')
  }, [open])

  // Busca sugestão quando abre (rápido, mesmo endpoint cacheado)
  useEffect(() => {
    if (!open || !defaultSocioPFId) return
    fetch(
      `/api/empresas/${empresaId}/socios/${defaultSocioPFId}/ultima-ponte-destino`,
      { credentials: 'include' },
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((j: UltimaPonteDestino | null) => {
        if (j) setSugestao(j)
      })
      .catch(() => {
        /* silent */
      })
  }, [open, empresaId, defaultSocioPFId])

  const handleAceitar = useCallback(() => setStep('form'), [])
  const handleFila = useCallback(() => onClose(), [onClose])
  const handleNao = useCallback(() => onClose(), [onClose])

  const handleBridgeCreated = useCallback(
    (bridgeId: string) => {
      onBridgeCreated?.(bridgeId)
      onClose()
    },
    [onClose, onBridgeCreated],
  )

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl w-[calc(100vw-2rem)] overflow-y-auto">
        {step === 'invite' ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="text-base" aria-hidden>🌉</span>
                Categorizou como retirada — mandar pro seu PF?
              </DialogTitle>
              <DialogDescription>
                A categoria é de <strong>distribuição de lucros</strong>. Você
                pode registrar essa saída também como entrada no seu perfil
                pessoal — ligadas por uma ponte auditável.
              </DialogDescription>
            </DialogHeader>

            {/* Preview da tx — número heroi discreto */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Retirada
              </p>
              <p className="mt-1.5 truncate text-sm font-medium text-slate-900">
                {txContext.description}
              </p>
              <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-500">
                <span>{new Date(txContext.date).toLocaleDateString('pt-BR')}</span>
                <span className="text-lg font-semibold tabular-nums text-slate-900">
                  {formatBRL(txContext.amount)}
                </span>
              </div>
            </div>

            {/* 3 CTAs */}
            <div className="flex flex-col gap-2 pt-1 sm:flex-row-reverse">
              <Button onClick={handleAceitar} className="gap-1 shadow-sm sm:flex-1">
                Enviar ao PF agora
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" onClick={handleFila} className="gap-1 sm:flex-1">
                <Inbox className="h-3.5 w-3.5" />
                Deixar na fila
              </Button>
              <Button variant="ghost" onClick={handleNao} className="gap-1 text-slate-500 sm:flex-none">
                <X className="h-3.5 w-3.5" />
                Não é retirada
              </Button>
            </div>

            {/* Rodapé educativo */}
            <div className="mt-1 flex items-start gap-2 text-[11px] text-slate-500">
              <Clock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              <span>
                Se você escolher &quot;deixar na fila&quot;, a retirada aparece
                em <strong>Sócios → Retiradas pendentes</strong> pra você enviar
                depois. Nada muda no DRE.
              </span>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="text-base" aria-hidden>🌉</span>
                Enviar retirada ao seu PF
              </DialogTitle>
              <DialogDescription>
                A tx PJ continua na mesma categoria (DRE não muda). Uma entrada
                é criada na sua conta pessoal.
              </DialogDescription>
            </DialogHeader>
            <NovaPonteForm
              empresaId={empresaId}
              socioPFId={defaultSocioPFId ?? null}
              initialPjTxId={txContext.txId}
              initialProfileId={sugestao?.profileId ?? null}
              initialAccountId={sugestao?.bankAccountId ?? null}
              initialCategoryId={sugestao?.categoryId ?? null}
              onCancel={onClose}
              onCreated={handleBridgeCreated}
              compact
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
