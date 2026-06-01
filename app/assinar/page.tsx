// Sprint Engine de Assinatura FATIA 1 (31/05/2026) — placeholder /assinar.
// User com subscription EXPIRED cai aqui via middleware. Sem checkout real
// — Fatia 3 vai plugar Asaas.

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { getEffectiveStatusByUserId } from '@/lib/subscription/queries'
import { PLANOS } from '@/lib/planos/config'

export const metadata: Metadata = {
  title: 'Assinar',
  robots: { index: false, follow: false, nocache: true },
}

export const dynamic = 'force-dynamic'

export default async function AssinarPage() {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (!token) redirect('/login')

  let payload
  try {
    payload = await verifyToken(token)
  } catch {
    redirect('/login')
  }

  // Se NÃO está expirado, volta pro dashboard (caso entre na URL direto)
  const status = await getEffectiveStatusByUserId(payload.sub)
  if (status && !status.isExpired) {
    redirect('/dashboard')
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 mb-5">
            <svg
              className="h-7 w-7 text-violet-700"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
            Seu período de teste acabou
          </h1>
          <p className="mt-3 text-base text-slate-600 max-w-md mx-auto">
            Olá, <strong>{payload.name}</strong>. Pra continuar usando o
            CAIXAOS, escolha um plano abaixo. Seus dados estão salvos e
            ficam intactos.
          </p>
        </div>

        <div className="rounded-2xl border-2 border-violet-200 bg-white p-7 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="shrink-0 h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <svg
                className="h-5 w-5 text-amber-700"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-slate-900">
                Cobrança em breve
              </h2>
              <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                Estamos finalizando a integração com o gateway de pagamento.
                Enquanto isso, fale com o nosso suporte pra continuar com
                acesso ao sistema sem interrupção.
              </p>
              <a
                href="https://wa.me/55XXXXXXXXXXX?text=Olá!%20Meu%20trial%20do%20CAIXAOS%20acabou%20e%20quero%20continuar%20usando."
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-4 w-4"
                  aria-hidden
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347" />
                </svg>
                Falar com o suporte
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-xl bg-white border border-slate-200 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-600 mb-3">
            Planos disponíveis
          </p>
          <div className="space-y-3">
            {PLANOS.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-0 last:pb-0"
              >
                <div>
                  <p className="font-medium text-slate-900">{p.nome}</p>
                  <p className="text-xs text-slate-500">{p.publico}</p>
                </div>
                <p className="text-sm font-semibold text-slate-900 tabular-nums">
                  R$ {p.precoMensal.toFixed(2).replace('.', ',')}
                  <span className="text-xs text-slate-500 font-normal">/mês</span>
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 text-center">
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="text-sm text-slate-500 hover:text-slate-700 underline underline-offset-2"
            >
              Sair da conta
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400 leading-relaxed">
          Seus dados estão preservados. Quando assinar, tudo volta exatamente
          como você deixou.
        </p>
      </div>
    </main>
  )
}
