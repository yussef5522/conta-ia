'use client'

// MOLDE OFICIAL (24/08) — cabeçalho de tabela ORDENÁVEL (setinha no header).
//
// A /contas-a-pagar ordena via TanStack Table, que ela precisa por causa de virtualização,
// colunas arrastáveis e saved views. As telas do estoque são listas simples: puxar TanStack
// pra elas seria peso sem ganho. Então o que é COMPARTILHADO aqui é o comportamento e o
// visual da ordenação — não a engine.
//
// `useSort` guarda (coluna, direção) e devolve um comparador; clicar no mesmo header
// inverte, clicar em outro começa asc. Valores null/undefined vão SEMPRE pro fim, nas duas
// direções — "sem dado" não é o menor valor, é ausência (mesma regra do "sem contagem"
// cinza da contagem: ausência não vira zero).

import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'

export type Dir = 'asc' | 'desc'

export function useSort<K extends string>(inicial: K, dirInicial: Dir = 'asc') {
  const [col, setCol] = useState<K>(inicial)
  const [dir, setDir] = useState<Dir>(dirInicial)
  const alternar = (c: K) => {
    if (c === col) setDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setCol(c); setDir('asc') }
  }
  /** ordena uma lista por um extrator de valor da coluna atual */
  const ordenar = useMemo(() => <T,>(itens: T[], valor: (i: T, c: K) => string | number | null | undefined): T[] => {
    const mult = dir === 'asc' ? 1 : -1
    return [...itens].sort((a, b) => {
      const va = valor(a, col)
      const vb = valor(b, col)
      const na = va == null || va === ''
      const nb = vb == null || vb === ''
      if (na && nb) return 0
      if (na) return 1 // ausência SEMPRE no fim, independente da direção
      if (nb) return -1
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mult
      return String(va).localeCompare(String(vb), 'pt-BR') * mult
    })
  }, [col, dir])
  return { col, dir, alternar, ordenar }
}

export function SortableTh<K extends string>({
  campo, col, dir, onSort, children, align = 'left', className = '',
}: {
  campo: K
  col: K
  dir: Dir
  onSort: (c: K) => void
  children: React.ReactNode
  align?: 'left' | 'right' | 'center'
  className?: string
}) {
  const ativo = campo === col
  const just = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'
  return (
    <th className={`px-3 py-2 font-medium ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'} ${className}`}>
      <button
        type="button"
        onClick={() => onSort(campo)}
        className={`inline-flex w-full items-center gap-1 ${just} transition-colors hover:text-slate-700 ${ativo ? 'text-slate-700' : ''}`}
        aria-label={`Ordenar por ${typeof children === 'string' ? children : campo}`}
      >
        {children}
        {ativo
          ? (dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
          : <ChevronsUpDown className="h-3 w-3 opacity-0 transition-opacity group-hover/thead:opacity-40" />}
      </button>
    </th>
  )
}
