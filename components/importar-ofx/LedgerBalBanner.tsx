// Sub-fase 2C — Faixa de verificação LEDGERBAL (Conta Azul-style)
//
// Renderiza 1 de 3 estados:
//   bate=true  → faixa VERDE (saldo bate com extrato)
//   bate=false → faixa AMARELA (lista 3 hipóteses + destaca a mais provável)
//   available=false → faixa CINZA (LEDGERBAL ausente no OFX)

import { Card } from '@/components/ui/card'
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LedgerBalCheckPayload } from '@/lib/ofx/preview-v2'

function fmtBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

interface Props {
  check: LedgerBalCheckPayload
  className?: string
}

export function LedgerBalBanner({ check, className }: Props) {
  // ───────────────────────────────────────────────
  // Estado 1: LEDGERBAL ausente → faixa cinza neutra
  // ───────────────────────────────────────────────
  if (!check.available) {
    return (
      <Card
        className={cn('border-slate-200 bg-slate-50 p-4', className)}
        data-testid="ledger-bal-banner"
        data-state="unavailable"
      >
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 flex-shrink-0 text-slate-500" />
          <div className="text-sm text-slate-700">
            <p className="font-medium">Extrato não traz saldo final (LEDGERBAL ausente)</p>
            <p className="mt-1 text-slate-600">
              Verificação matemática pulada — confiando na classificação.
            </p>
          </div>
        </div>
      </Card>
    )
  }

  // ───────────────────────────────────────────────
  // Estado 2: bate → faixa verde
  // ───────────────────────────────────────────────
  if (check.bate) {
    return (
      <Card
        className={cn('border-emerald-200 bg-emerald-50 p-4', className)}
        data-testid="ledger-bal-banner"
        data-state="bate"
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-600" />
          <div className="flex-1 text-sm">
            <p className="font-medium text-emerald-900">
              Saldo após import bate com o extrato
            </p>
            <dl className="mt-2 grid grid-cols-1 gap-1 text-emerald-800 sm:grid-cols-2 sm:gap-x-6">
              <div className="flex justify-between">
                <dt>balance atual:</dt>
                <dd className="tabular-nums">{fmtBRL(check.balanceAtual)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>a aplicar agora:</dt>
                <dd className="tabular-nums">
                  {check.deltaImportProposto >= 0 ? '+' : ''}
                  {fmtBRL(check.deltaImportProposto)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>saldo previsto:</dt>
                <dd className="tabular-nums">{fmtBRL(check.saldoPosImport)}</dd>
              </div>
              <div className="flex justify-between font-semibold">
                <dt>extrato (banco):</dt>
                <dd className="tabular-nums">{fmtBRL(check.ledgerBalAmount ?? 0)} ✓</dd>
              </div>
            </dl>
          </div>
        </div>
      </Card>
    )
  }

  // ───────────────────────────────────────────────
  // Estado 3: NÃO bate → faixa amarela + hipóteses
  // ───────────────────────────────────────────────
  const maisProvavel = check.hipoteses.find((h) => h.maisProvavel)

  return (
    <Card
      className={cn('border-amber-300 bg-amber-50 p-4', className)}
      data-testid="ledger-bal-banner"
      data-state="nao-bate"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-600" />
        <div className="flex-1 text-sm">
          <p className="font-medium text-amber-900">
            Saldo após import NÃO bate com extrato
          </p>
          <dl className="mt-2 grid grid-cols-1 gap-1 text-amber-900 sm:grid-cols-2 sm:gap-x-6">
            <div className="flex justify-between">
              <dt>balance atual:</dt>
              <dd className="tabular-nums">{fmtBRL(check.balanceAtual)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>a aplicar agora:</dt>
              <dd className="tabular-nums">
                {check.deltaImportProposto >= 0 ? '+' : ''}
                {fmtBRL(check.deltaImportProposto)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>saldo previsto:</dt>
              <dd className="tabular-nums">{fmtBRL(check.saldoPosImport)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>extrato (banco):</dt>
              <dd className="tabular-nums">{fmtBRL(check.ledgerBalAmount ?? 0)}</dd>
            </div>
            <div className="col-span-full flex justify-between border-t border-amber-300 pt-1 font-semibold">
              <dt>diferença:</dt>
              <dd className="tabular-nums">{fmtBRL(check.diff)}</dd>
            </div>
          </dl>

          <div className="mt-3">
            <p className="font-medium text-amber-900">Causas possíveis:</p>
            <ul className="mt-1 space-y-1">
              {check.hipoteses.map((h) => (
                <li
                  key={h.tipo}
                  className={cn(
                    'flex items-start gap-2',
                    h.maisProvavel ? 'font-medium text-amber-900' : 'text-amber-800',
                  )}
                >
                  <span aria-hidden className="mt-0.5">
                    {h.maisProvavel ? '●' : '◯'}
                  </span>
                  <span className="flex-1">{h.label}</span>
                </li>
              ))}
            </ul>

            {maisProvavel?.tipo === 'historico_errado' && (
              <p className="mt-3 rounded border border-amber-200 bg-amber-100 p-2 text-amber-900">
                <span className="font-medium">↳ MAIS PROVÁVEL:</span>{' '}
                isto pode ser divergência histórica, não deste import. Corrigir saldo inicial
                fica pra sprint separada — não bloqueia este import.
              </p>
            )}
          </div>

          <p className="mt-3 text-amber-800">
            Você pode confirmar mesmo assim ou cancelar pra investigar.
          </p>
        </div>
      </div>
    </Card>
  )
}
