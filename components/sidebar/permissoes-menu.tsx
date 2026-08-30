'use client'

// ⭐⭐ AS PERMISSÕES QUE O MENU ENXERGA (30/08/2026) — allowlist, default é ESCONDER.
//
// ⚠️ POR QUE UM CONTEXTO E NÃO UM `if` EM CADA ITEM: a 1ª tentativa foi BLOCKLIST —
// escondi à mão os itens que eu lembrei. Resultado, medido pelo dono: Dashboard **com o
// faturamento na tela**, Tributário, Cadastros (Empresas, Bancos, Clientes, Fornecedores,
// Categorias, Sócios), Auditoria, Usuários e Permissões **continuaram visíveis** pra uma
// operadora de estoque. Blocklist esquece; allowlist não tem como.
//
// Com o contexto, o `SidebarItem` decide sozinho: **item sem permissão declarada, ou com
// permissão que o papel não tem, simplesmente não renderiza**. Item novo criado daqui a
// seis meses nasce invisível pro operador — que é o comportamento seguro.

import { createContext, useContext } from 'react'

interface Ctx {
  /** null = ainda carregando (mostra tudo; ver o comentário abaixo) */
  permissoes: string[] | null
}

const PermissoesMenuCtx = createContext<Ctx>({ permissoes: null })

export const ProvedorPermissoesMenu = PermissoesMenuCtx.Provider

/**
 * ⚠️ ENQUANTO CARREGA, LIBERA. Filtro que chega depois **pisca e some item na cara do
 * usuário** — pior que meio segundo de menu completo. E a trava de verdade são as ROTAS
 * (403); isto aqui é UX.
 */
export function usePermissaoMenu(perm: string): boolean {
  const { permissoes } = useContext(PermissoesMenuCtx)
  // ⚠️ `@sempre` = o workspace PESSOAL (PF) da pessoa. Não é dado da empresa e não é
  // governado pelo papel dela na empresa — as despesas dela são dela.
  if (perm === '@sempre') return true
  if (permissoes === null) return true
  return permissoes.some(
    (p) =>
      p === '*' ||
      p === perm ||
      (p.endsWith('.*') && perm.startsWith(p.slice(0, -1))) ||
      (p.startsWith('*.') && perm.endsWith(p.slice(1))),
  )
}
