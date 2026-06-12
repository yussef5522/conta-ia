// Sub-fase 2C — Grupo expansível da classificação (4 sabores: novas/manual/payable/skip)

'use client'

import { useState, type ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  /** Texto do título (ex: "Genuinamente novas") */
  titulo: string
  /** Emoji do título (ex: "🆕") */
  emoji: string
  /** Quantidade — vai entre parênteses no header */
  count: number
  /** Sub-texto explicativo (1 linha embaixo do título) */
  subtexto?: string
  /** Cor semântica do card */
  variant: 'novas' | 'manual' | 'payable' | 'skip'
  /** Default expanded — só "novas" começa expandido */
  defaultExpanded?: boolean
  /** Conteúdo dentro do grupo (cada item) */
  children?: ReactNode
  /** Mensagem quando count=0 (ex: "Nenhuma transação nova") */
  emptyMessage?: string
}

const VARIANT_CLASSES = {
  novas: {
    border: 'border-blue-200',
    bg: 'bg-blue-50',
    text: 'text-blue-900',
    headerIcon: 'text-blue-600',
  },
  manual: {
    border: 'border-amber-200',
    bg: 'bg-amber-50',
    text: 'text-amber-900',
    headerIcon: 'text-amber-600',
  },
  payable: {
    border: 'border-purple-200',
    bg: 'bg-purple-50',
    text: 'text-purple-900',
    headerIcon: 'text-purple-600',
  },
  skip: {
    border: 'border-slate-200',
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    headerIcon: 'text-slate-500',
  },
} as const

export function GrupoClassificacao({
  titulo,
  emoji,
  count,
  subtexto,
  variant,
  defaultExpanded = false,
  children,
  emptyMessage,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const v = VARIANT_CLASSES[variant]

  return (
    <Card
      className={cn(v.border, v.bg)}
      data-testid={`grupo-${variant}`}
      data-count={count}
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className={cn(
          'flex w-full items-center justify-between px-4 py-3 text-left',
          v.text,
        )}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className={cn('h-4 w-4', v.headerIcon)} />
          ) : (
            <ChevronRight className={cn('h-4 w-4', v.headerIcon)} />
          )}
          <span aria-hidden className="text-lg">
            {emoji}
          </span>
          <span className="font-medium">
            {titulo} ({count})
          </span>
        </div>
      </button>

      {expanded && (
        <div className={cn('border-t px-4 py-3', v.border)}>
          {subtexto && (
            <p className={cn('mb-3 text-sm', v.text)}>{subtexto}</p>
          )}
          {count === 0 ? (
            <p className={cn('text-sm italic', v.text)}>
              {emptyMessage ?? 'Nenhuma transação nesta categoria.'}
            </p>
          ) : (
            children
          )}
        </div>
      )}
    </Card>
  )
}
