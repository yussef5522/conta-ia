'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { ChevronRight, ChevronDown, EyeOff, GripVertical } from 'lucide-react'
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import type { CategoryNode } from '@/lib/categories/buildTree'
import { getDreColorClass } from '@/lib/categories/dre-colors'

interface Props {
  tree: CategoryNode[]
  selectedId?: string | null
  onSelect: (node: CategoryNode) => void
  defaultExpandAll?: boolean
  // Reorder via drag-and-drop. Recebe o id arrastado, parentId atual,
  // e o id do irmão sobre o qual foi solto (ou null se foi solto fora).
  onReorder?: (movedId: string, parentId: string | null, overId: string | null) => void
  // Callback quando rename inline é confirmado.
  onRename?: (id: string, newName: string) => void
  // Quando true, drag-and-drop e edição inline ficam desabilitados (ex: modo edit).
  interactiveDisabled?: boolean
  // Mensagem mostrada via toast quando user tenta drop entre níveis (drag inválido).
  onInvalidDrop?: () => void
}

export function CategoryTree({
  tree,
  selectedId,
  onSelect,
  defaultExpandAll = false,
  onReorder,
  onRename,
  interactiveDisabled = false,
  onInvalidDrop,
}: Props) {
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [shakingId, setShakingId] = useState<string | null>(null)

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Mapa id → parentId pra validar drag entre níveis
  const parentOf = useMemo(() => {
    const m = new Map<string, string | null>()
    const visitar = (n: CategoryNode) => {
      m.set(n.id, n.parentId)
      for (const c of n.children) visitar(c)
    }
    for (const r of tree) visitar(r)
    return m
  }, [tree])

  // IDs achatados pra SortableContext (depth-first respeitando expandidos)
  const flatIds = useMemo(() => {
    const ids: string[] = []
    const visitar = (n: CategoryNode) => {
      ids.push(n.id)
      if (expanded.has(n.id)) {
        for (const c of n.children) visitar(c)
      }
    }
    for (const r of tree) visitar(r)
    return ids
  }, [tree, expanded])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const movedId = String(active.id)
    const overId = String(over.id)
    const parentMoved = parentOf.get(movedId) ?? null
    const parentOver = parentOf.get(overId) ?? null

    if (parentMoved !== parentOver) {
      // Drop em nível diferente — bloqueia + shake + toast
      setShakingId(movedId)
      setTimeout(() => setShakingId(null), 350)
      onInvalidDrop?.()
      return
    }

    onReorder?.(movedId, parentMoved, overId)
  }

  if (tree.length === 0) return null

  const dndDisabled = interactiveDisabled || !onReorder

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={flatIds} strategy={verticalListSortingStrategy}>
        <ul role="tree" aria-label="Plano de Contas" className="text-sm">
          {tree.map((node) => (
            <CategoryTreeItem
              key={node.id}
              node={node}
              expanded={expanded}
              onToggle={toggle}
              onSelect={onSelect}
              selectedId={selectedId}
              editingId={editingId}
              setEditingId={setEditingId}
              shakingId={shakingId}
              onRename={onRename}
              dndDisabled={dndDisabled}
              interactiveDisabled={interactiveDisabled}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

interface ItemProps {
  node: CategoryNode
  expanded: Set<string>
  onToggle: (id: string) => void
  onSelect: (node: CategoryNode) => void
  selectedId?: string | null
  editingId: string | null
  setEditingId: (id: string | null) => void
  shakingId: string | null
  onRename?: (id: string, newName: string) => void
  dndDisabled: boolean
  interactiveDisabled: boolean
}

function CategoryTreeItem({
  node,
  expanded,
  onToggle,
  onSelect,
  selectedId,
  editingId,
  setEditingId,
  shakingId,
  onRename,
  dndDisabled,
  interactiveDisabled,
}: ItemProps) {
  const isOpen = expanded.has(node.id)
  const isSelected = selectedId === node.id
  const isEditing = editingId === node.id
  const isShaking = shakingId === node.id
  const hasChildren = node.children.length > 0
  const isInactive = !node.isActive
  const colorClass = getDreColorClass(node.dreGroup)

  const sortable = useSortable({
    id: node.id,
    disabled: dndDisabled || isEditing || node.isSystemDefault === undefined ? false : false,
  })

  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    paddingLeft: `${node.depth * 16 + 8}px`,
  }

  const inlineRenameBloqueado = node.isSystemDefault || interactiveDisabled

  return (
    <li
      ref={sortable.setNodeRef}
      style={style}
      role="treeitem"
      aria-expanded={hasChildren ? isOpen : undefined}
      aria-selected={isSelected}
      aria-grabbed={sortable.isDragging || undefined}
      className={cn(
        'list-none',
        sortable.isDragging && 'opacity-50 scale-[1.02] shadow-lg z-10 relative',
        isShaking && 'animate-shake',
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2 rounded px-2 py-1.5 transition-colors group',
          'hover:bg-slate-100/60',
          isSelected && 'bg-indigo-50 border-l-[3px] border-indigo-500 -ml-[3px]',
          isInactive && 'opacity-50',
          !isEditing && 'cursor-pointer',
        )}
        onClick={() => !isEditing && onSelect(node)}
        onDoubleClick={(e) => {
          if (inlineRenameBloqueado || !onRename) return
          e.stopPropagation()
          setEditingId(node.id)
        }}
      >
        {/* Drag handle (aparece no hover, não disponível pra isSystemDefault) */}
        {!dndDisabled && (
          <button
            type="button"
            aria-label="Arrastar pra reordenar"
            className={cn(
              'shrink-0 -ml-1 p-0.5 rounded text-muted-foreground/40',
              'opacity-0 group-hover:opacity-100 transition-opacity',
              'cursor-grab active:cursor-grabbing',
              'hover:text-muted-foreground',
            )}
            {...sortable.attributes}
            {...sortable.listeners}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Chevron */}
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

        {/* Bolinha DRE Group */}
        <span
          className={cn('shrink-0 h-2.5 w-2.5 rounded-full', colorClass)}
          aria-hidden="true"
        />

        {/* Nome — input se edição inline, senão texto */}
        {isEditing && onRename ? (
          <InlineRenameInput
            initialValue={node.name}
            onCancel={() => setEditingId(null)}
            onConfirm={(novo) => {
              setEditingId(null)
              onRename(node.id, novo)
            }}
          />
        ) : (
          <span
            className={cn(
              'flex-1 truncate',
              inlineRenameBloqueado && !node.isSystemDefault ? '' : '',
              node.isSystemDefault && 'cursor-default',
            )}
            title={node.isSystemDefault ? 'Categoria padrão. Use Editar para alterar.' : node.name}
          >
            {node.name}
          </span>
        )}

        {/* Contador */}
        {!isEditing &&
          (node.transactionCount > 0 ? (
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
          ))}

        {/* Ícone inativa */}
        {!isEditing && isInactive && (
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
              editingId={editingId}
              setEditingId={setEditingId}
              shakingId={shakingId}
              onRename={onRename}
              dndDisabled={dndDisabled}
              interactiveDisabled={interactiveDisabled}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

// Input inline pra rename (Enter salva, Esc cancela, blur salva)
function InlineRenameInput({
  initialValue,
  onCancel,
  onConfirm,
}: {
  initialValue: string
  onCancel: () => void
  onConfirm: (val: string) => void
}) {
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  function tentarSalvar() {
    const novo = value.trim()
    if (!novo) {
      onCancel()
      return
    }
    if (novo === initialValue) {
      onCancel()
      return
    }
    if (novo.length > 80) {
      onCancel()
      return
    }
    onConfirm(novo)
  }

  return (
    <Input
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          tentarSalvar()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          onCancel()
        }
      }}
      onBlur={tentarSalvar}
      onFocus={(e) => e.currentTarget.select()}
      maxLength={80}
      className="h-7 text-sm flex-1"
      aria-label="Renomear categoria"
    />
  )
}
