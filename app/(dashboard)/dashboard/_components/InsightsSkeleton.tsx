// Skeleton da seção AI Insights — Sprint 2 Dia 5.
// Substitui o CardSkeleton genérico durante <Suspense>.
// Mesma grid do componente final pra evitar layout shift.

export function InsightsSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-4 w-4 rounded bg-muted animate-pulse" />
        <div className="h-3 w-32 rounded bg-muted animate-pulse" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <InsightCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

function InsightCardSkeleton() {
  return (
    <div className="relative rounded-lg border border-muted bg-muted/20 p-4">
      <div className="flex items-start gap-3">
        <div className="h-5 w-5 rounded bg-muted animate-pulse shrink-0" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3.5 w-3/4 rounded bg-muted animate-pulse" />
          <div className="h-2.5 w-full rounded bg-muted/70 animate-pulse" />
          <div className="h-2.5 w-5/6 rounded bg-muted/70 animate-pulse" />
          <div className="h-7 w-24 rounded bg-muted animate-pulse mt-3" />
        </div>
      </div>
    </div>
  )
}
