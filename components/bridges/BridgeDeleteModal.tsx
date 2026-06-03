// Sprint PF Fatia 4 — Modal de delete com 2 opções (A LINK_ONLY / B WITH_PF_TX).

'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { BridgeDeleteMode } from '@/lib/bridges/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Ex: "PROFIT" */
  pjCompanyName: string
  /** Ex: "Nubank PF" */
  pfAccountName: string
  amount: number
  onConfirm: (mode: BridgeDeleteMode) => Promise<void>
}

export function BridgeDeleteModal({
  open, onOpenChange, pjCompanyName, pfAccountName, amount, onConfirm,
}: Props) {
  const [mode, setMode] = useState<BridgeDeleteMode>('LINK_ONLY')
  const [submitting, setSubmitting] = useState(false)

  async function handleConfirm() {
    setSubmitting(true)
    try {
      await onConfirm(mode)
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Excluir ponte</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-slate-600">
          Você quer apenas desfazer o vínculo ou também excluir a entrada do perfil PF?
        </p>

        <div className="space-y-3">
          <label
            className={`block cursor-pointer rounded-lg border-2 p-4 transition ${
              mode === 'LINK_ONLY' ? 'border-primary bg-primary/5' : 'border-slate-200 bg-white'
            }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="delete-mode"
                value="LINK_ONLY"
                checked={mode === 'LINK_ONLY'}
                onChange={() => setMode('LINK_ONLY')}
                className="mt-1"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">
                    A) Apenas desfazer o vínculo
                  </span>
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-700">
                    recomendado
                  </span>
                </div>
                <ul className="mt-2 space-y-1 text-sm text-slate-600">
                  <li>✓ Tx PJ {pjCompanyName} mantida</li>
                  <li>✓ Tx PF {pfAccountName} mantida</li>
                  <li>✗ Apenas a ponte some</li>
                </ul>
                <p className="mt-1 text-xs text-slate-500">
                  💡 Use quando errou só o vínculo
                </p>
              </div>
            </div>
          </label>

          <label
            className={`block cursor-pointer rounded-lg border-2 p-4 transition ${
              mode === 'WITH_PF_TX' ? 'border-primary bg-primary/5' : 'border-slate-200 bg-white'
            }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="delete-mode"
                value="WITH_PF_TX"
                checked={mode === 'WITH_PF_TX'}
                onChange={() => setMode('WITH_PF_TX')}
                className="mt-1"
              />
              <div>
                <span className="font-semibold text-slate-900">
                  B) Desfazer + excluir entrada do perfil PF
                </span>
                <ul className="mt-2 space-y-1 text-sm text-slate-600">
                  <li>✓ Tx PJ {pjCompanyName} mantida</li>
                  <li>
                    ✗ Tx PF {pfAccountName} <strong>EXCLUÍDA</strong> (−R${' '}
                    {amount.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    no saldo)
                  </li>
                  <li>✗ A ponte some</li>
                </ul>
                <p className="mt-1 text-xs text-slate-500">
                  💡 Use quando o dinheiro não foi pro perfil PF de fato
                </p>
              </div>
            </div>
          </label>
        </div>

        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          ⚠ Pra excluir a transação PJ da {pjCompanyName}, vá em{' '}
          <code>/empresas/[id]/transacoes</code> (caminho normal).
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            variant={mode === 'WITH_PF_TX' ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? 'Excluindo…' : 'Confirmar exclusão'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
