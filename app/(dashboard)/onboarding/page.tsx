// Sprint PF FATIA 1 — Tela de onboarding pós-cadastro.
// 3 caminhos: Empresa / Pessoa física / Os dois.
// Users existentes (5 atuais, com onboardingCompletedAt=null mas
// createdAt anterior) NÃO veem essa tela — caminho controlado pelo
// gate na própria rota /dashboard (a fazer em layout/redirect futuro).
// Pra Fatia 1, /onboarding é acessível só de cima.

'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Building2, UserRound, Layers, Loader2 } from 'lucide-react'

export default function OnboardingPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState<'pj' | 'pf' | 'both' | null>(null)

  async function markCompleted() {
    try {
      await fetch('/api/auth/me/onboarding', { method: 'POST' })
    } catch {
      // ignore — não bloqueia o fluxo
    }
  }

  async function escolherPJ() {
    setSubmitting('pj')
    await markCompleted()
    router.push('/empresas/nova')
  }

  async function escolherPF() {
    setSubmitting('pf')
    await markCompleted()
    router.push('/perfis/novo')
  }

  async function escolherBoth() {
    setSubmitting('both')
    await markCompleted()
    // Começa com PF (mais simples). Depois user vê o switcher e
    // pode criar empresa quando quiser.
    router.push('/perfis/novo?next=empresa')
  }

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center py-8">
      <div className="text-center max-w-2xl mb-8">
        <h1 className="text-3xl font-bold text-zinc-900 mb-3">
          Bem-vindo ao CAIXAOS!
        </h1>
        <p className="text-zinc-600">
          Como você quer começar? Pode mudar depois — você sempre pode adicionar
          empresas e perfis pessoais no menu.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 max-w-4xl w-full">
        {/* PJ */}
        <button
          type="button"
          onClick={escolherPJ}
          disabled={!!submitting}
          className="group flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-zinc-200 hover:border-blue-500 hover:bg-blue-50/30 transition-all text-center disabled:opacity-50"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-100 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition-colors">
            {submitting === 'pj' ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Building2 className="h-6 w-6" />
            )}
          </span>
          <div>
            <h3 className="font-semibold text-zinc-900 mb-1">Tenho uma empresa</h3>
            <p className="text-xs text-zinc-600">
              Quero controlar o financeiro da minha empresa (CNPJ).
            </p>
          </div>
        </button>

        {/* PF */}
        <button
          type="button"
          onClick={escolherPF}
          disabled={!!submitting}
          className="group flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-zinc-200 hover:border-emerald-500 hover:bg-emerald-50/30 transition-all text-center disabled:opacity-50"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
            {submitting === 'pf' ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <UserRound className="h-6 w-6" />
            )}
          </span>
          <div>
            <h3 className="font-semibold text-zinc-900 mb-1">Sou pessoa física</h3>
            <p className="text-xs text-zinc-600">
              Quero organizar minha vida financeira pessoal e da família.
            </p>
          </div>
        </button>

        {/* Both */}
        <button
          type="button"
          onClick={escolherBoth}
          disabled={!!submitting}
          className="group flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-zinc-200 hover:border-purple-500 hover:bg-purple-50/30 transition-all text-center disabled:opacity-50"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-purple-100 text-purple-700 group-hover:bg-purple-600 group-hover:text-white transition-colors">
            {submitting === 'both' ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Layers className="h-6 w-6" />
            )}
          </span>
          <div>
            <h3 className="font-semibold text-zinc-900 mb-1">Os dois</h3>
            <p className="text-xs text-zinc-600">
              Tenho empresa e quero acompanhar a vida pessoal também.
            </p>
          </div>
        </button>
      </div>

      <button
        type="button"
        onClick={async () => {
          await markCompleted()
          router.push('/dashboard')
        }}
        className="mt-8 text-sm text-zinc-500 hover:text-zinc-700"
        disabled={!!submitting}
      >
        Pular por agora
      </button>
    </div>
  )
}
