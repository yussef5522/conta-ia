// Badge IA source + confidence — Sprint 3.0.2 A4.
// Pure component, sem data fetch — recebe os campos da transaction.

import { Sparkles, Bot, KeyRound, Globe2, User } from 'lucide-react'

type Source = 'RULE' | 'KEYWORD' | 'CLAUDE' | 'BRASILAPI' | 'MANUAL' | string | null

interface Props {
  source: Source
  confidence?: number | null
  // ruleId presente sinaliza que veio de RULE → opcional pra tooltip.
  ruleName?: string | null
  // Compact (default) vs detailed (mostra confidence percent)
  compact?: boolean
}

interface Style {
  icon: typeof Sparkles
  label: string
  bg: string
  text: string
  border: string
}

const STYLES: Record<string, Style> = {
  RULE: {
    icon: KeyRound,
    label: 'RULE',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-500/30',
  },
  KEYWORD: {
    icon: Bot,
    label: 'KEYWORD',
    bg: 'bg-amber-500/10',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-500/30',
  },
  CLAUDE: {
    icon: Sparkles,
    label: 'IA',
    bg: 'bg-purple-500/10',
    text: 'text-purple-700 dark:text-purple-400',
    border: 'border-purple-500/30',
  },
  BRASILAPI: {
    icon: Globe2,
    label: 'BrasilAPI',
    bg: 'bg-blue-500/10',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-500/30',
  },
  MANUAL: {
    icon: User,
    label: 'Manual',
    bg: 'bg-zinc-500/10',
    text: 'text-zinc-700 dark:text-zinc-400',
    border: 'border-zinc-500/30',
  },
}

function styleFor(source: Source): Style | null {
  if (!source) return null
  return STYLES[source] ?? null
}

export function formatConfidence(conf: number | null | undefined): string | null {
  if (conf === null || conf === undefined) return null
  return `${Math.round(conf * 100)}%`
}

export function confidenceTier(
  conf: number | null | undefined,
): 'high' | 'medium' | 'low' | null {
  if (conf === null || conf === undefined) return null
  if (conf >= 0.9) return 'high'
  if (conf >= 0.7) return 'medium'
  return 'low'
}

export function AiSourceBadge({
  source,
  confidence,
  ruleName,
  compact = true,
}: Props) {
  const style = styleFor(source)
  if (!style) return null
  const Icon = style.icon
  const conf = formatConfidence(confidence)

  // Tooltip text
  const tooltipParts: string[] = []
  if (source === 'RULE') {
    tooltipParts.push(
      ruleName ? `Aplicada pela regra: ${ruleName}` : 'Aplicada por regra IA',
    )
  } else if (source === 'KEYWORD') {
    tooltipParts.push('Detectada por keyword local')
  } else if (source === 'CLAUDE') {
    tooltipParts.push('Sugerido por Claude Haiku 4.5')
  } else if (source === 'BRASILAPI') {
    tooltipParts.push('CNPJ identificado via BrasilAPI')
  } else if (source === 'MANUAL') {
    tooltipParts.push('Classificada manualmente')
  }
  if (conf) tooltipParts.push(`Confiança: ${conf}`)
  const tooltip = tooltipParts.join(' · ')

  return (
    <span
      title={tooltip}
      className={`inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded border ${style.bg} ${style.text} ${style.border}`}
    >
      <Icon className="h-2.5 w-2.5" />
      <span>{style.label}</span>
      {!compact && conf && (
        <span className="opacity-70 tabular-nums">{conf}</span>
      )}
    </span>
  )
}
