'use client'

// ⭐⭐⭐ A HOME DO PERFIL PF É O DASHBOARD (13/09) — decisão registrada.
//
// **O dono:** *"Vira a tela inicial do perfil PF (decide a rota pela navegação e me diz)"* e
// *"o painel /mes atual vira esse ou morre, NUNCA dois painéis"*.
//
// **A ROTA ESCOLHIDA É `/perfis/[id]` — a home.** É onde ele CAI ao entrar no workspace
// pessoal; pôr o dashboard num endereço próprio deixaria a home velha viva ao lado e a
// pergunta "qual é a tela do meu dinheiro?" teria duas respostas. ⭐ E `/perfis/[id]/mes`
// **morreu**: ela redireciona pra cá, porque dois painéis do mesmo mês divergem na primeira
// régua nova — é a lição do B1 aplicada a tela.

import { use } from 'react'
import { DashboardPFView } from '@/components/perfis/dashboard-pf'

export default function PerfilHomePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <DashboardPFView profileId={id} />
}
