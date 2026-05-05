// Recalcula `order` dos irmãos quando uma categoria é movida pra nova posição
// dentro do mesmo parent. Função pura, testável.

export interface SiblingItem {
  id: string
  order: number
}

// Move `movedId` pra `newIndex` na lista de irmãos e retorna nova lista
// com `order` recalculado (1-indexed).
//
// - siblings: lista atual de irmãos (com mesmo parentId), em qualquer ordem
// - movedId: id da categoria que foi arrastada
// - newIndex: posição alvo (0-indexed) na lista ORDENADA
//
// Retorna: lista de { id, order } só com os irmãos que mudaram de ordem.
export function recalcularOrdens(
  siblings: SiblingItem[],
  movedId: string,
  newIndex: number,
): { id: string; order: number }[] {
  // Ordena pela ordem atual
  const ordenados = [...siblings].sort((a, b) => a.order - b.order)
  const moved = ordenados.find((s) => s.id === movedId)
  if (!moved) return []

  // Remove e re-insere na nova posição
  const semMoved = ordenados.filter((s) => s.id !== movedId)
  const indexClamp = Math.max(0, Math.min(newIndex, semMoved.length))
  semMoved.splice(indexClamp, 0, moved)

  // Recalcula order sequencial (1, 2, 3...)
  const updates: { id: string; order: number }[] = []
  semMoved.forEach((s, i) => {
    const novaOrdem = i + 1
    if (s.order !== novaOrdem) {
      updates.push({ id: s.id, order: novaOrdem })
    }
  })

  return updates
}

// Move `movedId` PRA POSIÇÃO de `targetId` (over.id no @dnd-kit).
// Conveniência pra integração com SortableContext.
export function moverParaPosicaoDe(
  siblings: SiblingItem[],
  movedId: string,
  targetId: string,
): { id: string; order: number }[] {
  if (movedId === targetId) return []
  const ordenados = [...siblings].sort((a, b) => a.order - b.order)
  const targetIndex = ordenados.findIndex((s) => s.id === targetId)
  if (targetIndex < 0) return []
  return recalcularOrdens(siblings, movedId, targetIndex)
}
