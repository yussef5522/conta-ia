'use client'

// ⭐⭐⭐ UMA ESCOLHA, DUAS TELAS (14/09/2026) — pedido do dono.
//
// *"PF → Lançamentos abre no mês (27, não 499), navegando JUNTO com o dashboard — mesmo
// mês selecionado nas duas."*
//
// ⛔ O dashboard guardava o mês num `useState` local: sair dele e voltar perdia a escolha,
// e a tela de Lançamentos nem tinha uma. **Duas telas do mesmo dinheiro com meses
// diferentes é a mesma doença do número que briga** — só que na navegação.
//
// ⚠️ A escolha mora no `localStorage`, POR PERFIL: o dono tem PF e (um dia) outros perfis,
// e o mês de um não é o do outro. Não vai na URL porque as duas telas são rotas
// diferentes — o link teria que carregar o parâmetro em toda navegação, e a primeira que
// esquecesse voltaria a divergir.
//
// ⚠️⚠️ E TODO ACESSO É PROTEGIDO: `localStorage` **lança** em aba anônima, com cookies
// bloqueados e em captura de thumbnail. Um throw aqui derrubaria a tela inteira por causa
// de uma preferência.

import { useCallback, useEffect, useState } from 'react'
import { mesCorrente } from '@/lib/periodo/mes-corrente'

const chave = (profileId: string) => `pf:mes:${profileId}`
const ehMes = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}$/.test(v)

export function useMesDoPerfil(profileId: string): [string, (m: string) => void] {
  /**
   * ⚠️ NASCE NO MÊS CORRENTE, e só depois lê o guardado — ler no `useState` inicial faria
   * o servidor e o cliente renderizarem valores diferentes (hydration mismatch), que é a
   * mesma razão de as duas composições do dashboard serem escolhidas por CSS.
   */
  const [mes, setMesState] = useState(() => mesCorrente())

  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem(chave(profileId))
      if (ehMes(guardado)) setMesState(guardado)
    } catch { /* aba anônima / cookies bloqueados: fica no mês corrente */ }
  }, [profileId])

  const setMes = useCallback((m: string) => {
    if (!ehMes(m)) return // ⛔ lixo no storage não vira filtro
    setMesState(m)
    try { window.localStorage.setItem(chave(profileId), m) } catch { /* idem */ }
  }, [profileId])

  return [mes, setMes]
}
