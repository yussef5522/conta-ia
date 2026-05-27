// Sprint 5.0.2.q — Badge pequeno e legível pra fonte da sugestão.
//
// Cores subtis (bg-100 + text-700) — segue padrão Stripe/Linear (não
// saturado, não "destaque agressivo"). Tipografia uppercase, font-medium,
// tracking sutil.

export type SuggestionSource =
  | 'CACHE_GLOBAL'
  | 'BRASIL_API'
  | 'KEYWORD_MATCH'
  | 'CLAUDE_AI'
  | 'VENDOR_MEMORY'
  | 'SETOR_PATTERN'
  | 'LEARNED_RULE'
  | 'SAME_COMPANY_TRANSFER'
  | 'PIX_DETECTION'
  | 'RULE_EXACT_NORMALIZED'
  | 'RULE_CONTAINS'

interface Config {
  label: string
  className: string
}

const SOURCE_CONFIG: Record<SuggestionSource, Config> = {
  CACHE_GLOBAL: {
    label: 'Conhecido',
    className: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  },
  BRASIL_API: {
    label: 'Receita Federal',
    className: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
  },
  KEYWORD_MATCH: {
    label: 'Palavra-chave',
    className: 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  },
  CLAUDE_AI: {
    label: 'IA',
    className: 'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  },
  VENDOR_MEMORY: {
    label: 'Aprendido',
    className: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  },
  SETOR_PATTERN: {
    label: 'Padrão setor',
    className: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300',
  },
  LEARNED_RULE: {
    label: 'Regra',
    className: 'bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
  },
  SAME_COMPANY_TRANSFER: {
    label: 'Transf. interna',
    className: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300',
  },
  PIX_DETECTION: {
    label: 'Pix sócio/grupo',
    className: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  },
  RULE_EXACT_NORMALIZED: {
    label: 'Regra aprendida',
    className: 'bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
  },
  RULE_CONTAINS: {
    label: 'Memória anchor',
    className: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  },
}

interface Props {
  source: SuggestionSource | string
}

const FALLBACK_CONFIG: Config = {
  label: 'Outro',
  className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
}

export function SourceBadge({ source }: Props) {
  const cfg = (SOURCE_CONFIG as Record<string, Config>)[source] ?? FALLBACK_CONFIG
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${cfg.className}`}
    >
      {cfg.label}
    </span>
  )
}

/** Helper exportado pra reuso em testes / lookup direto. */
export function sourceLabel(source: string): string {
  return (
    (SOURCE_CONFIG as Record<string, Config>)[source]?.label ?? FALLBACK_CONFIG.label
  )
}
