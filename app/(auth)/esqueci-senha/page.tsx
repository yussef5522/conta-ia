// Esqueci senha — Sprint 1.5.
// Layout split 40/60 (igual login Sprint 1.2).

import { Sparkles, KeyRound, ShieldCheck, MailCheck } from 'lucide-react'
import type { Metadata } from 'next'
import { Logo } from '@/components/logo'
import { EsqueciSenhaClient } from './esqueci-senha-client'

export const metadata: Metadata = {
  title: 'Esqueci minha senha | CAIXAOS',
  description:
    'Recupere o acesso à sua conta CAIXAOS com código de 6 dígitos.',
}

export default function EsqueciSenhaPage() {
  return (
    <div className="min-h-screen grid lg:grid-cols-[2fr_3fr] md:grid-cols-2">
      {/* ESQUERDA — Form */}
      <div className="flex items-center justify-center bg-white p-6 sm:p-10">
        <div className="w-full max-w-[420px]">
          <Logo size="md" className="mb-10" />
          <EsqueciSenhaClient />
        </div>
      </div>

      {/* DIREITA — Hero gradient (esconde no mobile) */}
      <div
        className="hidden md:flex flex-col justify-center p-8 lg:p-12 text-white relative overflow-hidden"
        style={{
          background:
            'linear-gradient(135deg, #0C447C 0%, #185FA5 50%, #378ADD 100%)',
        }}
      >
        <div className="max-w-[520px] space-y-7">
          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium"
            style={{ background: 'rgba(255,255,255,0.15)' }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Segurança em 3 passos
          </span>

          <h2 className="font-medium leading-[1.25]" style={{ fontSize: 26 }}>
            Recupere o acesso
            <br />
            sem dor de cabeça.
          </h2>

          <p
            style={{
              fontSize: 13,
              color: 'rgba(255,255,255,0.85)',
              lineHeight: 1.55,
            }}
          >
            Código de 6 dígitos por email · 15 minutos de validade · Sem
            links suspeitos.
          </p>

          <ul className="space-y-3">
            {[
              { icon: MailCheck, text: 'Código enviado no seu email cadastrado' },
              { icon: KeyRound, text: 'Digite o código e crie nova senha' },
              { icon: ShieldCheck, text: 'Anti-phishing + criptografia LGPD' },
            ].map(({ icon: Icon, text }) => (
              <li
                key={text}
                className="flex items-center gap-3"
                style={{ fontSize: 13 }}
              >
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full shrink-0"
                  style={{ background: 'rgba(255,255,255,0.2)' }}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span style={{ color: 'rgba(255,255,255,0.92)' }}>{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
