'use client'

// Sprint Asaas 3B (31/05/2026) — UI checkout dark imersivo.
// Fluxo: escolher plano + ciclo → escolher Pix ou Cartão → checkout.

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { PLANOS, type PlanoId } from '@/lib/planos/config'

type Ciclo = 'MONTHLY' | 'YEARLY'
type Method = null | 'PIX' | 'CARTAO'
type Step = 'plano' | 'metodo' | 'pix' | 'cartao'

interface Props {
  userName: string
  userEmail: string
  cpfCnpjExistente: string | null
}

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function maskCpfCnpj(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }
  return d
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

export function AssinarClient({ cpfCnpjExistente }: Props) {
  const [step, setStep] = useState<Step>('plano')
  const [planoId, setPlanoId] = useState<PlanoId>('inteligencia')
  const [ciclo, setCiclo] = useState<Ciclo>('MONTHLY')
  const [method, setMethod] = useState<Method>(null)
  const [cpfCnpj, setCpfCnpj] = useState(cpfCnpjExistente ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Pix state
  const [pixData, setPixData] = useState<{
    paymentId: string
    qrImageBase64: string
    copiaECola: string
    valor: number
    expiresAt: string
  } | null>(null)
  const [pixStatus, setPixStatus] = useState<'pending' | 'confirmed' | 'expired'>('pending')
  const [copied, setCopied] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const plano = PLANOS.find((p) => p.id === planoId)!
  const valor = ciclo === 'YEARLY' ? plano.precoAnual * 12 : plano.precoMensal

  // ===== Pix polling =====
  useEffect(() => {
    if (step !== 'pix' || !pixData || pixStatus !== 'pending') return
    pollingRef.current = setInterval(async () => {
      try {
        const r = await fetch(
          `/api/subscription/checkout/pix/status?paymentId=${encodeURIComponent(pixData.paymentId)}`,
        )
        if (!r.ok) return
        const data = await r.json()
        if (data.status === 'CONFIRMED') {
          setPixStatus('confirmed')
          if (pollingRef.current) clearInterval(pollingRef.current)
          setTimeout(() => {
            window.location.href = '/dashboard'
          }, 1500)
        }
      } catch {
        // silencioso, tenta de novo
      }
    }, 3000)
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [step, pixData, pixStatus])

  async function submitPix() {
    setErro(null)
    setSubmitting(true)
    try {
      const r = await fetch('/api/subscription/checkout/pix', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ planId: planoId, ciclo, cpfCnpj }),
      })
      const data = await r.json()
      if (!r.ok) {
        setErro(data.erro ?? 'Erro ao gerar Pix')
        return
      }
      setPixData(data)
      setStep('pix')
    } catch {
      setErro('Erro de rede.')
    } finally {
      setSubmitting(false)
    }
  }

  async function submitCartao() {
    setErro(null)
    setSubmitting(true)
    try {
      const r = await fetch('/api/subscription/checkout/cartao', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ planId: planoId, ciclo, cpfCnpj }),
      })
      const data = await r.json()
      if (!r.ok) {
        setErro(data.erro ?? 'Erro ao iniciar checkout')
        return
      }
      window.location.href = data.checkoutUrl
    } catch {
      setErro('Erro de rede.')
    } finally {
      setSubmitting(false)
    }
  }

  function copyPix() {
    if (!pixData) return
    if (navigator.clipboard) {
      navigator.clipboard.writeText(pixData.copiaECola).then(() => setCopied(true))
    }
  }

  // ============ Step PLANO ============
  if (step === 'plano') {
    return (
      <div className="space-y-6">
        {/* Toggle ciclo */}
        <div className="flex items-center justify-center">
          <div className="inline-flex items-center rounded-full bg-white/[0.06] border border-white/10 p-1 backdrop-blur-md">
            {(['MONTHLY', 'YEARLY'] as Ciclo[]).map((c) => (
              <button
                key={c}
                onClick={() => setCiclo(c)}
                className={[
                  'px-5 py-2 rounded-full text-sm font-medium transition-all',
                  ciclo === c
                    ? 'bg-violet-500 text-white shadow-[0_0_20px_-5px_rgba(167,139,250,0.6)]'
                    : 'text-slate-300 hover:text-white',
                ].join(' ')}
              >
                {c === 'MONTHLY' ? 'Mensal' : 'Anual'}
                {c === 'YEARLY' && (
                  <span className="ml-1.5 text-[10px] bg-emerald-400/20 text-emerald-300 px-1.5 py-0.5 rounded">
                    −20%
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANOS.map((p) => {
            const selected = planoId === p.id
            const preco = ciclo === 'YEARLY' ? p.precoAnual : p.precoMensal
            return (
              <button
                key={p.id}
                onClick={() => setPlanoId(p.id)}
                className={[
                  'relative text-left rounded-2xl p-5 border transition-all hover:-translate-y-0.5',
                  selected
                    ? 'bg-white text-slate-900 border-violet-400 shadow-[0_10px_40px_-10px_rgba(167,139,250,0.7)] lg:scale-[1.02]'
                    : 'bg-white/[0.04] text-white border-white/10 hover:bg-white/[0.08]',
                ].join(' ')}
              >
                {p.destaque && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 inline-flex items-center px-2 py-0.5 rounded-full bg-gradient-to-r from-violet-400 to-violet-600 text-white text-[10px] font-bold uppercase tracking-[0.14em]">
                    ⭐ Popular
                  </span>
                )}
                <p
                  className={[
                    'text-[10px] font-bold uppercase tracking-[0.18em]',
                    selected ? 'text-violet-700' : 'text-violet-300',
                  ].join(' ')}
                >
                  {p.nome}
                </p>
                <p
                  className={[
                    'mt-1 text-xs',
                    selected ? 'text-slate-500' : 'text-slate-400',
                  ].join(' ')}
                >
                  {p.publico}
                </p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className={selected ? 'text-2xl font-bold' : 'text-2xl font-bold text-white'}>
                    {formatBRL(preco)}
                  </span>
                  <span className={selected ? 'text-xs text-slate-500' : 'text-xs text-slate-400'}>
                    /mês
                  </span>
                </div>
                <p
                  className={[
                    'mt-3 text-xs leading-relaxed',
                    selected ? 'text-slate-600' : 'text-slate-300',
                  ].join(' ')}
                >
                  {p.tagline}
                </p>
              </button>
            )
          })}
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => setStep('metodo')}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-b from-violet-400 to-violet-600 px-7 py-3.5 text-sm font-semibold text-white shadow-[0_10px_30px_-5px_rgba(124,58,237,0.6)] hover:from-violet-300 hover:to-violet-500 transition-all"
          >
            Continuar com {plano.nome} →
          </button>
        </div>
      </div>
    )
  }

  // ============ Step MÉTODO ============
  if (step === 'metodo') {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setStep('plano')}
          className="text-sm text-slate-400 hover:text-white"
        >
          ← Trocar plano
        </button>

        <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-5 text-center backdrop-blur-md">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-300">
            Resumo
          </p>
          <p className="mt-1 text-lg font-semibold text-white">
            {plano.nome} · {ciclo === 'YEARLY' ? 'Anual' : 'Mensal'}
          </p>
          <p className="mt-1 text-3xl font-bold text-white tabular-nums">
            {formatBRL(valor)}
            <span className="text-sm font-normal text-slate-400">
              {ciclo === 'YEARLY' ? ' / ano' : ' / mês'}
            </span>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MethodCard
            title="Pagar com Pix"
            badge="Imediato"
            description="Pague agora e use por 30 dias. Sem cartão guardado."
            details={[
              '• Acesso por 30 dias após pagamento',
              '• Não é cobrança automática',
              '• Avisamos por email quando renovar',
            ]}
            onClick={() => {
              setMethod('PIX')
              if (cpfCnpj) submitPix()
              else setStep('cartao') // reusa form de cpfCnpj
            }}
          />
          <MethodCard
            title="Cartão recorrente"
            badge="Automático"
            description="Cadastre 1x e seja cobrado todo mês/ano automaticamente."
            details={[
              '• Cobrança automática (Netflix-style)',
              '• Cancele quando quiser',
              '• Pagamento seguro no Asaas (PCI Level 1)',
            ]}
            recommended
            onClick={() => {
              setMethod('CARTAO')
              setStep('cartao')
            }}
          />
        </div>
      </div>
    )
  }

  // ============ Step CPF/CARTAO form ============
  if (step === 'cartao') {
    const isPixFlow = method === 'PIX'
    return (
      <div className="max-w-md mx-auto space-y-5">
        <button onClick={() => setStep('metodo')} className="text-sm text-slate-400 hover:text-white">
          ← Trocar método
        </button>

        <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-6 backdrop-blur-md">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-300">
            {isPixFlow ? 'Pix · um mês' : 'Cartão · recorrente'}
          </p>
          <p className="mt-1 text-2xl font-bold text-white tabular-nums">
            {formatBRL(valor)}
            <span className="text-sm font-normal text-slate-400">
              {isPixFlow ? ' · 30 dias' : ciclo === 'YEARLY' ? ' / ano' : ' / mês'}
            </span>
          </p>

          <div className="mt-5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              CPF ou CNPJ {cpfCnpjExistente && '(salvo)'}
            </label>
            <input
              value={maskCpfCnpj(cpfCnpj)}
              onChange={(e) => setCpfCnpj(e.target.value.replace(/\D/g, ''))}
              placeholder="000.000.000-00"
              className="w-full rounded-md bg-white/[0.06] border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-violet-400/50 focus:ring-2 focus:ring-violet-400/30 outline-none"
            />
            <p className="mt-2 text-xs text-slate-400">
              Exigido pelo gateway pra emissão do recibo fiscal.
            </p>
          </div>

          {erro && (
            <div className="mt-4 rounded-md bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-200">
              {erro}
            </div>
          )}

          <div className="mt-5 rounded-md bg-violet-500/5 border border-violet-500/20 px-3 py-2.5 text-xs text-violet-100/90 leading-relaxed">
            {isPixFlow ? (
              <>
                <strong className="text-violet-200">Pagamento Pix:</strong> você
                paga agora e usa por 30 dias. Avisamos por email antes de
                expirar pra você renovar.
              </>
            ) : (
              <>
                <strong className="text-violet-200">Cobrança automática:</strong> seu
                cartão será cobrado todo {ciclo === 'YEARLY' ? 'ano' : 'mês'}.
                Você cancela quando quiser na sua conta. Pagamento processado
                no domínio seguro do Asaas (PCI Level 1).
              </>
            )}
          </div>

          <button
            onClick={isPixFlow ? submitPix : submitCartao}
            disabled={submitting || cpfCnpj.length < 11}
            className="mt-5 w-full inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-violet-400 to-violet-600 px-7 py-3.5 text-sm font-semibold text-white shadow-[0_10px_30px_-5px_rgba(124,58,237,0.6)] hover:from-violet-300 hover:to-violet-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting
              ? 'Processando...'
              : isPixFlow
                ? 'Gerar QR code Pix'
                : 'Continuar pro pagamento seguro →'}
          </button>
        </div>
      </div>
    )
  }

  // ============ Step PIX (QR code + polling) ============
  if (step === 'pix' && pixData) {
    if (pixStatus === 'confirmed') {
      return (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md mx-auto text-center"
        >
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
          <h2 className="text-3xl font-bold text-white">Pagamento confirmado!</h2>
          <p className="mt-3 text-slate-300">Redirecionando pro dashboard…</p>
        </motion.div>
      )
    }

    return (
      <div className="max-w-md mx-auto">
        <div className="rounded-2xl bg-white p-6 text-slate-900">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-700 text-center">
            Pix · {formatBRL(pixData.valor)}
          </p>
          <p className="mt-1 text-center text-sm text-slate-600">
            Aponte o app do banco no QR code
          </p>

          <div className="mt-4 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/png;base64,${pixData.qrImageBase64}`}
              alt="QR Code Pix"
              className="w-56 h-56 rounded-lg ring-1 ring-slate-200"
            />
          </div>

          <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500 text-center">
            Ou copie o código
          </p>
          <div className="mt-2 rounded-md bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-mono text-slate-700 break-all">
            {pixData.copiaECola}
          </div>
          <button
            onClick={copyPix}
            className="mt-3 w-full inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
          >
            {copied ? '✓ Código copiado!' : 'Copiar código Pix'}
          </button>

          <div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-500">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500" />
            </span>
            Aguardando confirmação do pagamento...
          </div>
        </div>
      </div>
    )
  }

  return null
}

function MethodCard({
  title,
  badge,
  description,
  details,
  recommended,
  onClick,
}: {
  title: string
  badge: string
  description: string
  details: string[]
  recommended?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'relative text-left rounded-2xl p-6 border transition-all hover:-translate-y-1',
        recommended
          ? 'bg-gradient-to-br from-violet-500/15 to-violet-700/10 border-violet-400/40 shadow-[0_10px_40px_-15px_rgba(167,139,250,0.6)]'
          : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.08]',
      ].join(' ')}
    >
      {recommended && (
        <span className="absolute -top-2.5 right-4 inline-flex items-center px-2 py-0.5 rounded-full bg-gradient-to-r from-violet-400 to-violet-600 text-white text-[10px] font-bold uppercase tracking-[0.14em]">
          Recomendado
        </span>
      )}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-white">{title}</h3>
        <span className="text-[10px] font-bold uppercase tracking-wider text-violet-300 bg-violet-500/15 px-2 py-0.5 rounded">
          {badge}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-300">{description}</p>
      <ul className="mt-4 space-y-1">
        {details.map((d) => (
          <li key={d} className="text-xs text-slate-400">
            {d}
          </li>
        ))}
      </ul>
    </button>
  )
}
