// Sprint 5.0.4.0b — Card de relatório futuro (em breve).
// Visualmente desabilitado, não clicável.

import type { LucideIcon } from 'lucide-react'

interface Props {
  icon: LucideIcon
  title: string
  description?: string
  sprintLabel: string
}

export function FutureReportCard({
  icon: Icon,
  title,
  description,
  sprintLabel,
}: Props) {
  return (
    <div
      className="flex h-full flex-col rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-5 opacity-70 cursor-not-allowed"
      aria-disabled="true"
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-200/60 dark:bg-slate-800">
          <Icon className="h-4 w-4 text-slate-400 dark:text-slate-500" />
        </div>
        <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
      </div>

      {description && (
        <p className="text-xs text-muted-foreground flex-1 mb-3">
          {description}
        </p>
      )}

      <span className="inline-flex w-fit items-center rounded-full bg-slate-200/60 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {sprintLabel}
      </span>
    </div>
  )
}
