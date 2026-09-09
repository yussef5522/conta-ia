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
  // ⭐⭐ "QUALQUER UMA DESTAS" (09/09/2026) — `perm="a|b"`.
  //
  // ⛔ NASCEU DE DEFEITO MEU, e é a lição das DUAS PORTAS pela terceira vez: em 08/09 abri a
  // PÁGINA `/equipe` pra `['user.invite', 'stock.manage']` (ela faz duas coisas — gerenciar
  // quem LOGA e gerenciar COLABORADOR) e **deixei o item do menu exigindo só `user.invite`**.
  // Resultado medido em prod: o Cristian e a marcyelle (GERENTE_ESTOQUE, 4 chaves) **podiam
  // usar a tela e não tinham como chegar nela** — porta fechada com a sala aberta.
  //
  // ⚠️ O separador é `|` em vez de array porque o guard estrutural do menu lê `perm="..."`
  // por regex: trocar pra `perm={[...]}` deixaria o item **invisível pro guard**, e um item
  // que o guard não enxerga é exatamente o buraco que ele existe pra fechar.
  const exigidas = perm.split('|').map((p) => p.trim()).filter(Boolean)
  return exigidas.some((exigida) =>
    permissoes.some(
      (p) =>
        p === '*' ||
        p === exigida ||
        (p.endsWith('.*') && exigida.startsWith(p.slice(0, -1))) ||
        (p.startsWith('*.') && exigida.endsWith(p.slice(1))),
    ),
  )
}
