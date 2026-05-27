// Sprint 5.0.3.0a — Skeleton da tela /contas-a-pagar enquanto fetch.
// Mostra: 4 stats cards skeleton + 10 linhas de tabela skeleton.

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function PayableSkeleton() {
  return (
    <div className="space-y-6" data-testid="payable-skeleton">
      {/* 4 stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-7 w-32" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-8 w-8 rounded-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters bar */}
      <Skeleton className="h-12 w-full" />

      {/* Tabela 10 linhas */}
      <div className="rounded-md border overflow-hidden">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-3 py-2.5 border-b last:border-0"
          >
            <div className="w-1 h-9 bg-muted rounded-sm shrink-0" />
            <Skeleton className="h-4 w-4 rounded-sm" />
            <div className="flex-1 min-w-0 space-y-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-4 w-20 shrink-0" />
            <Skeleton className="h-4 w-24 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
