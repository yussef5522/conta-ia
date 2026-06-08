'use client'

// Sprint Fluxo-Único-Retirada (08/06/2026) — Banner inline ÂMBAR que
// aparece em QUALQUER lista de tx PJ quando isOrphanWithdrawal(tx) === true.
//
// Princípio: a categoria DISPARA o fluxo. Quando o user categoriza uma tx
// como Distribuição/Pró-labore/etc, este card aparece automaticamente em
// todas as listas (/transacoes, conta-Caixa, /pendentes, conciliação).
//
// Click → abre Dialog com WithdrawalPanel pré-preenchido (kind inferido).
// Após confirmar → callback `onCompleted` dispara update otimista no parent
// (linha sai da lista de órfãs / re-render do estado).

import { useState } from 'react'
import { AlertCircle, ArrowRight } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { WithdrawalPanel } from '@/components/withdrawals/WithdrawalPanel'
import { inferKindFromDreGroup } from '@/lib/withdrawals/is-orphan'

interface Props {
  empresaId: string
  /** ID da tx PJ DEBIT EFFECTED categorizada como retirada órfã. */
  pjTransactionId: string
  pjAmount: number
  pjDescription: string
  /** dreGroup da categoria — usado pra inferir kind no WithdrawalPanel. */
  categoryDreGroup: string | null
  /** Disparado após criar a ponte com sucesso. Parent deve marcar
   *  esta row como "ponte ativa" no estado local (update otimista). */
  onCompleted: () => void
  /** Variantes visuais:
   *  - 'inline' (default): banner âmbar abaixo da linha (em listas)
   *  - 'compact': badge horizontal pequeno (pra cards densos) */
  variant?: 'inline' | 'compact'
}

export function OrphanWithdrawalCard({
  empresaId,
  pjTransactionId,
  pjAmount,
  pjDescription,
  categoryDreGroup,
  onCompleted,
  variant = 'inline',
}: Props) {
  const [open, setOpen] = useState(false)
  const suggestedKind = inferKindFromDreGroup(categoryDreGroup)
  const initialSuggestion = suggestedKind
    ? { socioId: '', suggestedKind }
    : null

  function handleConfirmed() {
    setOpen(false)
    onCompleted()
  }

  if (variant === 'compact') {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
          aria-label="Registrar entrada PF (falta ponte)"
        >
          <AlertCircle className="h-2.5 w-2.5" />
          Falta ponte PF
        </button>
        {renderDialog()}
      </>
    )
  }

  // variant === 'inline' (default)
  return (
    <>
      <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs dark:border-amber-900 dark:bg-amber-950/30">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="font-medium text-amber-900 dark:text-amber-100">
              Sem entrada no PF
            </p>
            <p className="text-amber-800/80 dark:text-amber-300/80">
              Esta retirada ainda não foi registrada como entrada na sua
              conta pessoal.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => setOpen(true)}
          className="shrink-0 bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600"
        >
          Registrar entrada PF
          <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </div>
      {renderDialog()}
    </>
  )

  function renderDialog() {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              💸 Registrar Retirada de Sócio
            </DialogTitle>
          </DialogHeader>
          {open && (
            <WithdrawalPanel
              empresaId={empresaId}
              pjTransactionId={pjTransactionId}
              pjAmount={pjAmount}
              pjDescription={pjDescription}
              initialSuggestion={initialSuggestion}
              onConfirmed={handleConfirmed}
              onCancel={() => setOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    )
  }
}
