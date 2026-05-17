// Login premium — Sprint 1.2.
// Server Component (sem interatividade). Layout split 40/60 desktop,
// 50/50 tablet, full-width mobile.

import { Sparkles, Quote, Check } from 'lucide-react'
import type { Metadata } from 'next'
import { Logo } from '@/components/logo'
import { LoginForm } from './login-form'

export const metadata: Metadata = {
  title: 'Entrar | Conta IA',
  description:
    'Acesse seu dashboard financeiro com IA. Importa OFX, categoriza sozinha, gera DRE.',
}

export default function LoginPage() {
  return (
    <div className="min-h-screen grid lg:grid-cols-[2fr_3fr] md:grid-cols-2">
      {/* ========== ESQUERDA — Form ========== */}
      <div className="flex items-center justify-center bg-white p-6 sm:p-10">
        <div className="w-full max-w-[400px]">
          <Logo size="md" className="mb-10" />

          <div className="mb-7">
            <h1
              className="font-medium tracking-tight"
              style={{ fontSize: 22, color: '#0C447C' }}
            >
              Entrar na sua conta
            </h1>
            <p
              className="mt-1 text-muted-foreground"
              style={{ fontSize: 13 }}
            >
              Acesse seu dashboard contábil com IA
            </p>
          </div>

          <LoginForm />
        </div>
      </div>

      {/* ========== DIREITA — Hero (esconde no mobile) ========== */}
      <div
        className="hidden md:flex flex-col justify-center p-8 lg:p-12 text-white relative overflow-hidden"
        style={{
          background:
            'linear-gradient(135deg, #0C447C 0%, #185FA5 50%, #378ADD 100%)',
        }}
      >
        <div className="max-w-[520px] space-y-7">
          {/* Pill badge */}
          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium"
            style={{ background: 'rgba(255,255,255,0.15)' }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            IA Contadora · Aprende contigo
          </span>

          {/* Tagline */}
          <h2
            className="font-medium leading-[1.25]"
            style={{ fontSize: 26 }}
          >
            A IA que organiza<br />
            teu financeiro<br />
            em segundos.
          </h2>

          {/* Descrição */}
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.55 }}>
            Importa OFX, categoriza sozinha, gera DRE em segundos.<br />
            Sem planilha, sem dor de cabeça.
          </p>

          {/* Checkmarks */}
          <ul className="space-y-2.5">
            {[
              'IA Contadora 3 camadas (única no Brasil)',
              '14 dias grátis · sem cartão',
              'Cancela quando quiser, sem multa',
              'Suporte humano via WhatsApp',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2.5" style={{ fontSize: 13 }}>
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full shrink-0"
                  style={{ background: 'rgba(255,255,255,0.2)' }}
                >
                  <Check className="h-3 w-3" />
                </span>
                <span style={{ color: 'rgba(255,255,255,0.92)' }}>{item}</span>
              </li>
            ))}
          </ul>

          {/* Quote box */}
          <div
            className="rounded-lg p-4 space-y-2"
            style={{
              background: 'rgba(255,255,255,0.1)',
              borderWidth: '0.5px',
              borderColor: 'rgba(255,255,255,0.2)',
              borderStyle: 'solid',
            }}
          >
            <div className="flex items-center gap-1.5">
              <Quote className="h-3.5 w-3.5" />
              <span
                className="uppercase tracking-wide font-medium"
                style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}
              >
                Diferencial
              </span>
            </div>
            <p
              style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.92)',
                lineHeight: 1.5,
              }}
            >
              Enquanto outros sistemas pedem que você classifique tudo
              manualmente, a Conta IA aprende com cada classificação tua e
              categoriza automaticamente.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
