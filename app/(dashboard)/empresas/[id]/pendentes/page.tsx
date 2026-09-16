// ⭐ ROTA LEGADA, REDIRECT PERMANENTE (15/09/2026).
//
// A tela dos Pendentes morreu — virou a CAIXA DE ENTRADA. Esta rota **fica**: link
// velho em e-mail, no histórico do navegador ou num print não pode virar 404.
// ⚠️ Redirect de uma linha não é lixo, é cortesia — e o guard da faxina garante que
// ela **não volte a ter item de menu** (rota morta que renasce em menu = vermelho).
// Sprint 5.0.2.h — Redirect via route handler (cookies só em Server Action/Route Handler).

import { redirect } from 'next/navigation'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function OldPage({ params }: PageProps) {
  const { id } = await params
  redirect(`/api/empresas/${id}/select-and-redirect?to=/pendentes`)
}
