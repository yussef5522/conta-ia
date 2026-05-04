// Monta árvore hierárquica a partir de lista flat de categorias.
// Função pura (sem efeitos colaterais), testável como unit.

export interface CategoryFlat {
  id: string
  name: string
  type: string
  parentId: string | null
  dreGroup: string | null
  code: string | null
  description: string | null
  color: string
  icon: string | null
  order: number
  visibleInRegimes: string | null
  isActive: boolean
  isSystemDefault: boolean
  _count?: { transactions: number }
}

export interface CategoryNode {
  id: string
  name: string
  type: string
  parentId: string | null
  dreGroup: string | null
  code: string | null
  description: string | null
  color: string
  icon: string | null
  order: number
  visibleInRegimes: string | null
  isActive: boolean
  isSystemDefault: boolean
  transactionCount: number
  children: CategoryNode[]
  depth: number
}

// Detecta se navegar pelos parents leva a ciclo (parent ancestral de si mesmo).
function ancestraisFormaCiclo(
  startId: string,
  parentOfId: Map<string, string | null>,
): boolean {
  const visitados = new Set<string>()
  let cursor: string | null | undefined = startId
  while (cursor) {
    if (visitados.has(cursor)) return true
    visitados.add(cursor)
    cursor = parentOfId.get(cursor) ?? null
  }
  return false
}

export function buildTree(flat: CategoryFlat[]): CategoryNode[] {
  const byId = new Map<string, CategoryNode>()
  const parentOfId = new Map<string, string | null>()

  for (const c of flat) {
    parentOfId.set(c.id, c.parentId)
    byId.set(c.id, {
      id: c.id,
      name: c.name,
      type: c.type,
      parentId: c.parentId,
      dreGroup: c.dreGroup,
      code: c.code,
      description: c.description,
      color: c.color,
      icon: c.icon,
      order: c.order,
      visibleInRegimes: c.visibleInRegimes,
      isActive: c.isActive,
      isSystemDefault: c.isSystemDefault,
      transactionCount: c._count?.transactions ?? 0,
      children: [],
      depth: 0,
    })
  }

  const roots: CategoryNode[] = []

  for (const node of byId.values()) {
    // Vira raiz quando: sem parent OU parent não existe na lista (resiliência)
    // OU detectamos ciclo (resiliência adicional).
    const semParent = !node.parentId
    const parentForaDaLista = node.parentId !== null && !byId.has(node.parentId)
    const ciclo = node.parentId !== null && ancestraisFormaCiclo(node.id, parentOfId)

    if (semParent || parentForaDaLista || ciclo) {
      roots.push(node)
    } else {
      const parent = byId.get(node.parentId as string)
      if (parent) parent.children.push(node)
    }
  }

  // Calcula depth recursivamente
  const calcularDepth = (n: CategoryNode, d: number) => {
    n.depth = d
    for (const c of n.children) calcularDepth(c, d + 1)
  }
  for (const r of roots) calcularDepth(r, 0)

  // Ordena raízes e filhos: order asc, depois name asc (pt-BR)
  const ordenarRecursivo = (nodes: CategoryNode[]) => {
    nodes.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order
      return a.name.localeCompare(b.name, 'pt-BR')
    })
    for (const n of nodes) ordenarRecursivo(n.children)
  }
  ordenarRecursivo(roots)

  return roots
}

// Helper auxiliar: retorna a lista achatada (depth-first) na ordem da árvore.
// Útil pra renderização ou navegação por teclado.
export function flattenTree(roots: CategoryNode[]): CategoryNode[] {
  const out: CategoryNode[] = []
  const visitar = (n: CategoryNode) => {
    out.push(n)
    for (const c of n.children) visitar(c)
  }
  for (const r of roots) visitar(r)
  return out
}
