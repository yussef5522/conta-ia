'use client'

// ⭐⭐ AS PERMISSÕES DO USUÁRIO NA EMPRESA ATIVA (30/08/2026) — pra a sidebar filtrar.
//
// ⚠️ O ENDPOINT `/api/empresas/[id]/me` EXISTIA COM O COMENTÁRIO *"usado pela sidebar
// contextual para filtrar menu por permissions"* — **e nunca foi consumido por ninguém**.
// Resultado: a operadora de estoque recém-convidada via o menu INTEIRO (Transações, DRE,
// Conciliação…) e cada clique batia num 403. Menu que oferece o que a pessoa não pode
// fazer não é só feio: ensina que o sistema está quebrado.
//
// ⚠️ ENQUANTO CARREGA, `carregando` é true e a sidebar mostra o menu completo — **filtro
// que aparece depois pisca e some itens na cara do usuário**. Melhor mostrar tudo por meio
// segundo e cortar do que o contrário. A trava de verdade está nas ROTAS (403), não aqui:
// isto é UX, não segurança.

import { useEffect, useState } from 'react'

export function usePermissoes(empresaId: string | null) {
  const [permissoes, setPermissoes] = useState<string[] | null>(null)

  useEffect(() => {
    if (!empresaId) { setPermissoes(null); return }
    let vivo = true
    fetch(`/api/empresas/${empresaId}/me`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (vivo && j?.permissions) setPermissoes(j.permissions as string[]) })
      .catch(() => { if (vivo) setPermissoes(null) })
    return () => { vivo = false }
  }, [empresaId])

  /**
   * `pode('transaction.view')` — com wildcard, do mesmo jeito que o servidor resolve.
   * ⚠️ Enquanto não carregou, devolve TRUE (ver o comentário do topo).
   */
  const pode = (chave: string) => {
    if (permissoes === null) return true
    return permissoes.some((p) => p === '*' || p === chave || (p.endsWith('.*') && chave.startsWith(p.slice(0, -1))) || (p.startsWith('*.') && chave.endsWith(p.slice(1))))
  }

  return { permissoes, pode, carregando: permissoes === null }
}
