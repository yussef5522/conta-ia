'use client'

import { useEffect } from 'react'
import { classeDoTema, type Tema } from '@/lib/tema/preferencia'

/**
 * ⭐ A LIMPEZA DA CLASSE AO SAIR DO DASHBOARD (04/10/2026).
 *
 * ⛔ **Por que isto existe:** a classe `dark` mora no `documentElement` (é o único lugar que
 * alcança os PORTAIS do Radix — modal, dropdown, toast). O `documentElement` **sobrevive à
 * navegação de cliente**, então sem este desmonte o dono sairia do dashboard (logout, ou um
 * link pra landing) e a tela de LOGIN herdaria o tema escuro — e ela é pintada com `bg-white`
 * cravado, ou seja: fundo branco com os tokens escuros por baixo. Estado misto é pior que os
 * dois temas inteiros.
 *
 * ⚠️ O `useEffect` também **reafirma** a classe: o `<script>` inline do layout resolve o
 * primeiro paint, e este cobre o caso de alguém chegar aqui por navegação de cliente (quando o
 * script já rodou numa página anterior, ou não rodou nenhuma vez).
 */
export function TemaDoDashboard({ tema }: { tema: Tema }) {
  useEffect(() => {
    const html = document.documentElement
    if (classeDoTema(tema) === 'dark') html.classList.add('dark')
    else html.classList.remove('dark')
    return () => html.classList.remove('dark')
  }, [tema])

  return null
}
