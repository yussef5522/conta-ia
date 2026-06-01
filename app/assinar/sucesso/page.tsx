// Sprint Asaas 3B (31/05/2026) — /assinar/sucesso
// Callback do checkout hosted. Asaas redireciona o cliente pra cá
// quando o pagamento de cartão é confirmado.
//
// ⚠️ Cliente pode chegar AQUI antes do webhook 3C. UI mostra "✓
// assinatura ativa" provisório. Webhook confirma definitivo.

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getCheckoutSession } from '@/lib/asaas/checkout-hosted'

export const metadata: Metadata = {
  title: 'Assinatura confirmada',
  robots: { index: false, follow: false, nocache: true },
}

export const dynamic = 'force-dynamic'

interface Props {
  // Asaas pode mandar `?id=<checkoutId>` ou outros params como
  // sessionId/paymentId. Aceita ambos.
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function singleParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export default async function SucessoPage({ searchParams }: Props) {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (!token) redirect('/login')

  let payload
  try {
    payload = await verifyToken(token)
  } catch {
    redirect('/login')
  }

  const sp = await searchParams
  const checkoutId =
    singleParam(sp.id) ?? singleParam(sp.checkoutId) ?? singleParam(sp.session)

  let confirmedProvisorio = false
  let asaasStatus: string | null = null

  if (checkoutId) {
    // Confirma com o Asaas que esta sessão foi paga
    try {
      const session = await getCheckoutSession(checkoutId)
      asaasStatus = session.status
      if (session.status === 'PAID' || session.subscription?.id) {
        // Marca Subscription ACTIVE provisório (3C webhook confirma)
        await prisma.subscription.updateMany({
          where: {
            userId: payload.sub,
            checkoutSessionId: checkoutId,
            status: { not: 'GRANTED' },
          },
          data: {
            status: 'ACTIVE',
            trialEndsAt: null,
            gatewaySubscriptionId: session.subscription?.id ?? undefined,
          },
        })
        confirmedProvisorio = true
      }
    } catch {
      // Não bloqueia UI. Webhook 3C resolve.
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 px-5 py-12">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20 mb-6 ring-4 ring-emerald-500/10">
          <svg
            className="h-8 w-8 text-emerald-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-white">
          {confirmedProvisorio
            ? 'Assinatura ativa!'
            : 'Recebemos seu pagamento'}
        </h1>
        <p className="mt-4 text-base text-slate-300 leading-relaxed">
          {confirmedProvisorio
            ? 'Tudo certo. Você já pode usar o CAIXAOS sem limites.'
            : 'Estamos processando a confirmação. Em até 2 minutos o acesso libera automaticamente.'}
        </p>

        {asaasStatus && process.env.ASAAS_ENV === 'sandbox' && (
          <p className="mt-4 text-xs text-slate-500 font-mono">
            sandbox · status: {asaasStatus}
          </p>
        )}

        <Link
          href="/dashboard"
          className="mt-8 inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-violet-400 to-violet-600 px-7 py-3.5 text-sm font-semibold text-white shadow-[0_10px_30px_-5px_rgba(124,58,237,0.6)] hover:from-violet-300 hover:to-violet-500 transition-all"
        >
          Ir pro dashboard →
        </Link>
      </div>
    </main>
  )
}
