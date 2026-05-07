'use client'

// Drill-down lateral do DRE (Sub-etapa 5.4.B).
// Sheet (sidebar) com transações da categoria clicada no período/regime atuais.
// Paginação 50 por vez via /api/empresas/[id]/dre/transactions.

import { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatBRL, formatDateBR } from '@/lib/format/dre'

interface Transaction {
  id: string
  type: 'CREDIT' | 'DEBIT'
  amount: number
  description: string | null
  date: string
  competenceDate: string | null
  paymentDate: string | null
  bankAccount: { id: string; name: string }
}

interface DrillResult {
  category: { id: string; name: string; code: string | null; dreGroup: string | null }
  transactions: Transaction[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

interface Props {
  empresaId: string
  categoryId: string
  startDate: Date
  endDate: Date
  regime: 'competence' | 'cash'
  onClose: () => void
}

export function DREDrillDown({
  empresaId,
  categoryId,
  startDate,
  endDate,
  regime,
  onClose,
}: Props) {
  const [data, setData] = useState<DrillResult | null>(null)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Quando muda categoria, volta pra página 1
  useEffect(() => {
    setPage(1)
    setData(null)
  }, [categoryId])

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('categoryId', categoryId)
      params.set('startDate', startDate.toISOString())
      params.set('endDate', endDate.toISOString())
      params.set('regime', regime)
      params.set('page', String(page))
      params.set('pageSize', '50')

      const res = await fetch(
        `/api/empresas/${empresaId}/dre/transactions?${params.toString()}`,
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.erro ?? 'Erro ao carregar transações')
      }
      const json: DrillResult = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }, [empresaId, categoryId, startDate, endDate, regime, page])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  const periodLabel = `${formatDateBR(startDate)} a ${formatDateBR(endDate)}`

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto p-6"
      >
        <SheetHeader>
          <SheetTitle>
            {data ? data.category.name : 'Carregando...'}
            {data?.category.code && (
              <span className="text-xs text-muted-foreground ml-2 font-mono">
                {data.category.code}
              </span>
            )}
          </SheetTitle>
          <SheetDescription>
            {periodLabel} · Regime de{' '}
            {regime === 'competence' ? 'Competência' : 'Caixa'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded bg-muted" />
              ))}
            </div>
          )}

          {data && !isLoading && (
            <>
              <div className="text-xs text-muted-foreground">
                {data.pagination.total} transação(ões) no período
              </div>

              {data.transactions.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  Nenhuma transação encontrada para esta categoria no período.
                </div>
              ) : (
                <div className="space-y-2">
                  {data.transactions.map((tx) => {
                    const refDate =
                      regime === 'competence'
                        ? (tx.competenceDate ?? tx.date)
                        : (tx.paymentDate ?? tx.date)
                    return (
                      <div
                        key={tx.id}
                        className="rounded-lg border p-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm truncate">
                              {tx.description ?? '(sem descrição)'}
                            </p>
                            <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                              <span>{formatDateBR(refDate)}</span>
                              <span>·</span>
                              <span className="truncate">{tx.bankAccount.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {tx.type === 'CREDIT' ? 'Entrada' : 'Saída'}
                              </Badge>
                            </div>
                          </div>
                          <div
                            className={`text-sm font-semibold tabular-nums shrink-0 ${
                              tx.type === 'CREDIT'
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-rose-700 dark:text-rose-400'
                            }`}
                          >
                            {tx.type === 'CREDIT' ? '+' : '−'}
                            {formatBRL(tx.amount)}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Paginação */}
              {data.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between border-t pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || isLoading}
                  >
                    <ChevronLeft className="h-3 w-3 mr-1" /> Anterior
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Página {page} de {data.pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPage((p) => Math.min(data.pagination.totalPages, p + 1))
                    }
                    disabled={page === data.pagination.totalPages || isLoading}
                  >
                    Próxima <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
