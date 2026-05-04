'use client'

import { useMemo, useState, useCallback } from 'react'
import { ChevronRight, ChevronDown, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CategoryNode } from '@/lib/categories/buildTree'
import { getDreColorClass } from '@/lib/categories/dre-colors'

interface Props {
  tree: CategoryNode[]
  selectedId?: string | null
  onSelect: (node: CategoryNode) => void
  // Quando true, expande tudo na primeira renderização (útil pra resultados de busca).
  defaultExpandAll?: boolean
}

export function CategoryTree({ tree, selectedId, onSelect, defaultExpandAll = false }: Props) {
  // Set de IDs expandidos. Default = primeiro nível expandido.
  const initialExpanded = useMemo(() => {
    const set = new Set<string>()
    if (defaultExpandAll) {
      const visitar = (n: CategoryNode) => {
        if (n.children.length > 0) set.add(n.id)
        for (const c of n.children) visitar(c)
      }
      for (const r of tree) visitar(r)
    } else {
      for (const r of tree) {
        if (r.children.length > 0) set.add(r.id)
      }
    }
    return set
  }, [tree, defaultExpandAll])

  const [expanded, setExpanded] = useState<Set<string>>(initialExpanded)

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  if (tree.length === 0) return null

  return (
    <ul role="tree" aria-label="Plano de Contas" className="text-sm">
      {tree.map((node) => (
        <CategoryTreeItem
          key={node.id}
          node={node}
          expanded={expanded}
          onToggle={toggle}
          onSelect={onSelect}
          selectedId={selectedId}
        />
      ))}
    </ul>
  )
}

interface ItemProps {
  node: CategoryNode
  expanded: Set<string>
  onToggle: (id: string) => void
  onSelect: (node: CategoryNode) => void
  selectedId?: string | null
}

function CategoryTreeItem({ node, expanded, onToggle, onSelect, selectedId }: ItemProps) {
  const isOpen = expanded.has(node.id)
  const isSelected = selectedId === node.id
  const hasChildren = node.children.length > 0
  const isInactive = !node.isActive
  const semUso = node.transactionCount === 0
  const colorClass = getDreColorClass(node.dreGroup)

  return (
    <li
      role="treeitem"
      aria-expanded={hasChildren ? isOpen : undefined}
      aria-selected={isSelected}
      className="list-none"
    >
      <div
        className={cn(
          'flex items-center gap-2 rounded px-2 py-1.5 cursor-pointer transition-colors',
          'hover:bg-slate-100/60',
          isSelected && 'bg-indigo-50 border-l-[3px] border-indigo-500 -ml-[3px]',
          isInactive && 'opacity-50',
        )}
        style={{ paddingLeft: `${node.depth * 16 + 8}px` }}
        onClick={() => onSelect(node)}
      >
        {/* Chevron — sempre reserva espaço (8px) pra alinhar */}
        {hasChildren ? (
          <button
            type="button"
            aria-label={isOpen ? 'Recolher' : 'Expandir'}
            onClick={(e) => {
              e.stopPropagation()
              onToggle(node.id)
            }}
            className="shrink-0 p-0.5 rounded hover:bg-slate-200/80"
          >
            {isOpen ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="shrink-0 w-4" aria-hidden="true" />
        )}

        {/* Bolinha colorida do DRE Group */}
        <span
          className={cn('shrink-0 h-2.5 w-2.5 rounded-full', colorClass)}
          aria-hidden="true"
        />

        {/* Nome */}
        <span className="flex-1 truncate" title={node.name}>
          {node.name}
        </span>

        {/* Contador de transações */}
        {node.transactionCount > 0 ? (
          <span
            className="shrink-0 text-xs text-muted-foreground tabular-nums"
            aria-label={`${node.transactionCount} transações vinculadas`}
          >
            ({node.transactionCount})
          </span>
        ) : (
          <span
            className="shrink-0 text-xs text-muted-foreground/60 tabular-nums"
            title="Nunca usada"
            aria-label="Nunca usada"
          >
            (0)
          </span>
        )}

        {/* Ícone de inativa */}
        {isInactive && (
          <EyeOff
            className="shrink-0 h-3.5 w-3.5 text-muted-foreground"
            aria-label="Categoria inativa"
          />
        )}
      </div>

      {/* Filhos */}
      {hasChildren && isOpen && (
        <ul role="group" className="list-none">
          {node.children.map((child) => (
            <CategoryTreeItem
              key={child.id}
              node={child}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
              selectedId={selectedId}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
