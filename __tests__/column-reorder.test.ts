// Sprint 5.0.3.0d (d1) — Tests do column reorder logic.
//
// Foco: arrayMove + filtros de FIXED_COLUMNS + restrições anti-drop em fixos.

import { describe, it, expect } from 'vitest'
import { arrayMove } from '@dnd-kit/sortable'

const FIXED_COLUMNS = ['select', 'status', 'amount', 'actions']

function getDraggableIds(allIds: string[]): string[] {
  return allIds.filter((id) => !FIXED_COLUMNS.includes(id))
}

function applyReorder(
  allIds: string[],
  activeId: string,
  overId: string,
): string[] | null {
  // Replica a logic do handleDragEnd da PayableTable:
  // 1. NÃO permite mover FIXED columns
  if (FIXED_COLUMNS.includes(activeId) || FIXED_COLUMNS.includes(overId)) {
    return null
  }
  const oldIdx = allIds.indexOf(activeId)
  const newIdx = allIds.indexOf(overId)
  if (oldIdx < 0 || newIdx < 0) return null
  return arrayMove(allIds, oldIdx, newIdx)
}

const ALL_COLUMNS = [
  'select',
  'status',
  'dueDate',
  'paymentDate',
  'favorecido',
  'description',
  'category',
  'amount',
  'actions',
]

describe('Column reorder — filtros de draggable', () => {
  it('FIXED_COLUMNS NÃO aparecem em draggable list', () => {
    const draggable = getDraggableIds(ALL_COLUMNS)
    expect(draggable).not.toContain('select')
    expect(draggable).not.toContain('status')
    expect(draggable).not.toContain('amount')
    expect(draggable).not.toContain('actions')
  })

  it('Colunas reordenáveis: 5 do total de 9', () => {
    const draggable = getDraggableIds(ALL_COLUMNS)
    expect(draggable).toEqual([
      'dueDate',
      'paymentDate',
      'favorecido',
      'description',
      'category',
    ])
    expect(draggable).toHaveLength(5)
  })
})

describe('Column reorder — applyReorder', () => {
  it('move "favorecido" pra ANTES de "dueDate"', () => {
    const result = applyReorder(ALL_COLUMNS, 'favorecido', 'dueDate')
    expect(result).toEqual([
      'select',
      'status',
      'favorecido', // movida
      'dueDate',
      'paymentDate',
      'description',
      'category',
      'amount',
      'actions',
    ])
  })

  it('NÃO permite mover Status (FIXED)', () => {
    expect(applyReorder(ALL_COLUMNS, 'status', 'dueDate')).toBeNull()
  })

  it('NÃO permite drop em cima de Status (FIXED)', () => {
    expect(applyReorder(ALL_COLUMNS, 'favorecido', 'status')).toBeNull()
  })

  it('NÃO permite mover Valor (FIXED)', () => {
    expect(applyReorder(ALL_COLUMNS, 'amount', 'favorecido')).toBeNull()
  })

  it('NÃO permite drop em cima de Ações (FIXED)', () => {
    expect(applyReorder(ALL_COLUMNS, 'favorecido', 'actions')).toBeNull()
  })

  it('NÃO permite mover Select / checkbox (FIXED)', () => {
    expect(applyReorder(ALL_COLUMNS, 'select', 'dueDate')).toBeNull()
  })

  it('drag e drop em ID inexistente → null', () => {
    expect(applyReorder(ALL_COLUMNS, 'foo', 'bar')).toBeNull()
  })

  it('reordenação trivial: trocar 2 colunas adjacentes', () => {
    const result = applyReorder(ALL_COLUMNS, 'description', 'category')
    expect(result).toBeTruthy()
    // category vem ANTES de description agora
    expect(result!.indexOf('category')).toBeLessThan(
      result!.indexOf('description'),
    )
  })

  it('Status mantém posição 2 mesmo após reorder de outras', () => {
    const result = applyReorder(ALL_COLUMNS, 'favorecido', 'dueDate')
    expect(result![1]).toBe('status')
  })

  it('Valor mantém posição 8 (penúltima) após reorder', () => {
    const result = applyReorder(ALL_COLUMNS, 'category', 'paymentDate')
    expect(result![result!.length - 2]).toBe('amount')
  })

  it('Actions mantém última posição', () => {
    const result = applyReorder(ALL_COLUMNS, 'category', 'paymentDate')
    expect(result![result!.length - 1]).toBe('actions')
  })
})

describe('arrayMove — sanity', () => {
  it('arrayMove é estável (mesmo input → mesmo output)', () => {
    const a = arrayMove(['a', 'b', 'c', 'd'], 1, 3)
    const b = arrayMove(['a', 'b', 'c', 'd'], 1, 3)
    expect(a).toEqual(b)
  })

  it('arrayMove preserva tamanho', () => {
    const result = arrayMove(['a', 'b', 'c', 'd'], 0, 3)
    expect(result).toHaveLength(4)
  })
})
