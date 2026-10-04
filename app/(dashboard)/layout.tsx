import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { DashboardShell } from '@/components/layout/dashboard-shell'
// Sprint Perf P3 (31/05/2026): Toaster movido do root layout pra cá
// (dashboard inteiro usa toast; landing pública não usa).
import { Toaster } from '@/components/ui/toaster'
// Sprint Engine de Assinatura FATIA 1 (31/05/2026): banner trial no topo
import { TrialBanner } from '@/components/layout/trial-banner'
// Sprint post-3B: dev tools só em sandbox
import { isDevToolsEnabled } from '@/lib/dev/guard'
import { lerTema } from '@/lib/tema/servidor'
import { classeDoTema } from '@/lib/tema/preferencia'
import { TemaDoDashboard } from '@/components/layout/tema-do-dashboard'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value

  if (!token) redirect('/login')

  let user
  try {
    user = await verifyToken(token)
  } catch {
    redirect('/login')
  }

  const devToolsEnabled = isDevToolsEnabled()
  /**
   * ⭐⭐ O TEMA É RESOLVIDO NO SERVIDOR — é isso que mata o flash de tema errado.
   *
   * ⛔⛔ **E A CLASSE ENTRA POR UM `<script>` INLINE, NÃO NO `<html>` DO ROOT LAYOUT — foi
   * MEDIDO antes de escolher.** Ler o cookie no root layout poria a classe direto no `<html>`
   * (o caminho óbvio), **mas tornaria DINÂMICA a landing pública**, que o Sprint Perf P3 fez
   * estática de propósito (o comentário em `app/page.tsx` diz: *"REMOVIDO dynamic='force-dynamic':
   * landing pública nunca muda"*). Trocar a estática da página de marketing por um tema que ela
   * nem usa é um péssimo negócio. Aqui o `cookies()` já era chamado — custo ZERO a mais.
   *
   * ⚠️ **E a classe vai no `documentElement`, não num `<div>` da árvore do dashboard**, porque
   * modal, dropdown e toast do Radix renderizam em PORTAL direto no `<body>`: com a classe num
   * wrapper interno, **todo menu e todo diálogo abriria CLARO dentro do tema escuro** — o pior
   * dos dois mundos, e invisível em teste de página.
   */
  const tema = await lerTema(user.sub)

  return (
    <DashboardShell
      userName={user.name}
      userEmail={user.email}
      devToolsEnabled={devToolsEnabled}
      tema={tema}
    >
      {/* ⚠️ Roda durante o parse, ANTES do conteúdo pintar — sem isto a tela abriria clara e
          escureceria no hydrate, que é o flash que todo app de tema erra primeiro. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.classList.${classeDoTema(tema) === 'dark' ? 'add' : 'remove'}('dark')`,
        }}
      />
      <TemaDoDashboard tema={tema} />
      <TrialBanner />
      {children}
      <Toaster />
    </DashboardShell>
  )
}
