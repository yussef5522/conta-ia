// Sprint Gestão de Conta (31/05/2026) — Tela de force-change senha.
// Acessada quando user tem mustChangePassword=true (após reset admin).
// Sem skip — middleware bloqueia qualquer outra rota.

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import type { Metadata } from 'next'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { TrocarSenhaForm } from './trocar-senha-form'

export const metadata: Metadata = {
  title: 'Defina uma nova senha',
  robots: { index: false, follow: false, nocache: true },
}

export const dynamic = 'force-dynamic'

export default async function TrocarSenhaPage() {
  // Só faz sentido pra user LOGADO. Se não tem token, manda pro login.
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (!token) redirect('/login')

  let payload
  try {
    payload = await verifyToken(token)
  } catch {
    redirect('/login')
  }

  // Se NÃO precisa trocar, mantém o user na rota dele
  // (caso entre na URL direto após já ter trocado).
  if (!payload.mustChangePassword) {
    redirect('/dashboard')
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-5 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 mb-4">
            <svg
              className="h-6 w-6 text-violet-700"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m0-9V6m9 6a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Defina uma nova senha
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Olá, <strong>{payload.name}</strong>. Sua senha foi resetada pelo
            administrador. Pra continuar usando o CAIXAOS, escolha uma nova
            senha.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <TrocarSenhaForm />
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Por segurança, esta tela não pode ser pulada. A senha temporária
          fornecida pelo admin só serve pra este login.
        </p>
      </div>
    </main>
  )
}
