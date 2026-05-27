// Sprint 5.0.3.0d (d2) — Helpers puros pra virtualização da PayableTable.
//
// Threshold: > 100 linhas ativa virtualização. Abaixo disso, render normal.
// Altura de cada row derivada da density atual (alinhada com CSS density-*).

import type { DensityLevel } from './use-table-preferences'

/** Threshold acima do qual ativamos virtualização. */
export const VIRTUALIZATION_THRESHOLD = 100

/** Altura estimada de cada linha por density level. Bate com CSS globals.css. */
export const ROW_HEIGHT_BY_DENSITY: Record<DensityLevel, number> = {
  compact: 36,
  normal: 48,
  comfortable: 60,
}

/** Decide se deve virtualizar baseado no count. */
export function shouldVirtualize(rowCount: number): boolean {
  return rowCount > VIRTUALIZATION_THRESHOLD
}

/** Overscan otimizado por density (mais linhas em compact que cabem na viewport). */
export function overscanForDensity(density: DensityLevel): number {
  // Mais linhas pré-renderizadas pra compact (mais visíveis) = scroll mais suave
  if (density === 'compact') return 15
  if (density === 'normal') return 10
  return 8
}
