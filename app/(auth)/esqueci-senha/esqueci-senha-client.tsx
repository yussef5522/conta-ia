'use client'

// Esqueci senha — 3 etapas premium — Sprint 1.5.
// Fluxo: email → código 6 dígitos → nova senha → sucesso → /login.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  Loader2,
  Mail,
  ArrowLeft,
  ShieldCheck,
  KeyRound,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/auth/password-input'
import { useToast } from '@/components/ui/use-toast'
import { CodeInput } from './code-input'

type Step = 'email' | 'code' | 'password' | 'success'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CODE_EXPIRES_SECONDS = 15 * 60
const RESEND_COOLDOWN_SECONDS = 60

export function EsqueciSenhaClient() {
  const router = useRouter()
  const { toast } = useToast()
  const reducedMotion = useReducedMotion()

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null)

  // Timers
  const [codeRemaining, setCodeRemaining] = useState(CODE_EXPIRES_SECONDS)
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS)

  useEffect(() => {
    if (step !== 'code') return
    if (codeRemaining <= 0) return
    const t = setInterval(() => setCodeRemaining((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [step, codeRemaining])

  useEffect(() => {
    if (step !== 'code') return
    if (resendCooldown <= 0) return
    const t = setInterval(
      () => setResendCooldown((s) => Math.max(0, s - 1)),
      1000,
    )
    return () => clearInterval(t)
  }, [step, resendCooldown])

  const formattedTime = useMemo(() => {
    const m = Math.floor(codeRemaining / 60)
    const s = codeRemaining % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }, [codeRemaining])

  // ============================================================
  // Etapa 1 — Solicitar código
  // ============================================================
  async function solicitarCodigo(retryEmail?: string) {
    const target = (retryEmail ?? email).trim().toLowerCase()
    if (!EMAIL_REGEX.test(target)) {
      setError('Email inválido')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: target }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.erro ?? 'Não foi possível enviar o código.')
        return
      }
      setMaskedEmail(data.maskedEmail ?? null)
      if (!retryEmail) {
        // Primeira solicitação — avança etapa
        setStep('code')
        setCodeRemaining(CODE_EXPIRES_SECONDS)
      }
      setResendCooldown(RESEND_COOLDOWN_SECONDS)
      toast({
        variant: 'success',
        title: 'Código enviado',
        description: data.maskedEmail
          ? `Verifique a caixa de entrada de ${data.maskedEmail}.`
          : 'Confira sua caixa de entrada.',
      })
    } catch {
      setError('Erro de rede. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  // ============================================================
  // Etapa 2 — Verificar código
  // ============================================================
  async function verificarCodigo(autoCode?: string) {
    const c = autoCode ?? code
    if (c.length !== 6) {
      setError('Código deve ter 6 dígitos')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/verify-reset-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: c }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (typeof data.attemptsLeft === 'number') {
          setAttemptsLeft(data.attemptsLeft)
        }
        setError(data.erro ?? 'Código inválido')
        return
      }
      setToken(data.token)
      setStep('password')
      setAttemptsLeft(null)
    } catch {
      setError('Erro de rede. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  // ============================================================
  // Etapa 3 — Redefinir senha
  // ============================================================
  async function redefinirSenha() {
    if (novaSenha.length < 8) {
      setError('Senha precisa ter ao menos 8 caracteres')
      return
    }
    if (!/[A-Za-z]/.test(novaSenha) || !/[0-9]/.test(novaSenha)) {
      setError('Inclua letras e números')
      return
    }
    if (novaSenha !== confirmacao) {
      setError('As senhas não coincidem')
      return
    }
    if (!token) {
      setError('Sessão expirada — recomece o fluxo')
      setStep('email')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, novaSenha }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.erro ?? 'Não foi possível redefinir')
        return
      }
      setStep('success')
      setTimeout(() => router.push('/login'), 3500)
    } catch {
      setError('Erro de rede. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  // Força da senha
  const strength = useMemo(() => {
    if (!novaSenha) return { level: 0, label: '', color: '' }
    const has8 = novaSenha.length >= 8
    const hasLetter = /[A-Za-z]/.test(novaSenha)
    const hasNumber = /[0-9]/.test(novaSenha)
    const hasUpper = /[A-Z]/.test(novaSenha)
    const hasSpecial = /[^A-Za-z0-9]/.test(novaSenha)
    const long = novaSenha.length >= 12
    if (!has8 || !hasLetter || !hasNumber) {
      return { level: 1, label: 'Fraca', color: '#dc2626' }
    }
    if (long && hasUpper && hasSpecial) {
      return { level: 3, label: 'Forte', color: '#16a34a' }
    }
    return { level: 2, label: 'Média', color: '#eab308' }
  }, [novaSenha])

  const motionProps = (delay = 0) =>
    reducedMotion
      ? {}
      : {
          initial: { opacity: 0, x: 16 },
          animate: { opacity: 1, x: 0 },
          exit: { opacity: 0, x: -16 },
          transition: { duration: 0.28, delay, ease: [0.16, 1, 0.3, 1] as const },
        }

  return (
    <AnimatePresence mode="wait">
      {step === 'email' && (
        <motion.div key="email" {...motionProps()}>
          <header className="mb-6">
            <h1
              className="font-medium tracking-tight"
              style={{ fontSize: 22, color: '#0C447C' }}
            >
              Esqueci minha senha
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Digite seu email e mandamos um código de 6 dígitos.
            </p>
          </header>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              void solicitarCodigo()
            }}
            className="space-y-5"
            noValidate
          >
            {error && (
              <div
                className="rounded-md border border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950 p-3 text-sm text-rose-900 dark:text-rose-100"
                role="alert"
              >
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="text-xs font-medium text-muted-foreground"
              >
                E-mail
              </Label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  className="h-11 pl-8"
                  placeholder="seu@empresa.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
                  disabled={loading}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11"
              disabled={loading || !email}
              style={{ backgroundColor: '#185FA5' }}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Enviando código...
                </>
              ) : (
                'Receber código'
              )}
            </Button>

            <Link
              href="/login"
              className="flex items-center justify-center gap-1.5 text-sm font-medium hover:underline"
              style={{ color: '#185FA5' }}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar pro login
            </Link>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground pt-2">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Código válido por 15 minutos · Anti-phishing</span>
            </div>
          </form>
        </motion.div>
      )}

      {step === 'code' && (
        <motion.div key="code" {...motionProps()}>
          <header className="mb-6">
            <h1
              className="font-medium tracking-tight"
              style={{ fontSize: 22, color: '#0C447C' }}
            >
              Insira o código
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enviamos um código de 6 dígitos pra{' '}
              <strong>{maskedEmail ?? email}</strong>.
            </p>
          </header>

          <div className="space-y-5">
            {error && (
              <div
                className="rounded-md border border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950 p-3 text-sm text-rose-900 dark:text-rose-100"
                role="alert"
              >
                {error}
                {attemptsLeft !== null && attemptsLeft > 0 && (
                  <span className="block text-xs mt-1 opacity-80">
                    {attemptsLeft}{' '}
                    {attemptsLeft === 1
                      ? 'tentativa restante'
                      : 'tentativas restantes'}
                  </span>
                )}
              </div>
            )}

            <CodeInput
              value={code}
              onChange={setCode}
              onComplete={verificarCodigo}
              disabled={loading}
              error={!!error}
            />

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {codeRemaining > 0
                  ? `Expira em ${formattedTime}`
                  : 'Código expirado'}
              </span>
              <button
                type="button"
                onClick={() => solicitarCodigo(email)}
                disabled={resendCooldown > 0 || loading}
                className="font-medium hover:underline disabled:opacity-50 disabled:no-underline"
                style={{ color: '#185FA5' }}
              >
                {resendCooldown > 0
                  ? `Reenviar em ${resendCooldown}s`
                  : 'Reenviar código'}
              </button>
            </div>

            <Button
              type="button"
              className="w-full h-11"
              onClick={() => verificarCodigo()}
              disabled={loading || code.length !== 6 || codeRemaining === 0}
              style={{ backgroundColor: '#185FA5' }}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Verificando...
                </>
              ) : (
                'Verificar código'
              )}
            </Button>

            <button
              type="button"
              onClick={() => {
                setStep('email')
                setCode('')
                setError(null)
                setAttemptsLeft(null)
              }}
              className="flex items-center justify-center gap-1.5 mx-auto text-sm font-medium hover:underline"
              style={{ color: '#185FA5' }}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Mudar email
            </button>
          </div>
        </motion.div>
      )}

      {step === 'password' && (
        <motion.div key="password" {...motionProps()}>
          <header className="mb-6">
            <h1
              className="font-medium tracking-tight"
              style={{ fontSize: 22, color: '#0C447C' }}
            >
              Nova senha
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Escolha uma senha forte com 8+ caracteres, letras e números.
            </p>
          </header>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              void redefinirSenha()
            }}
            className="space-y-5"
            noValidate
          >
            {error && (
              <div
                className="rounded-md border border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950 p-3 text-sm text-rose-900 dark:text-rose-100"
                role="alert"
              >
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label
                htmlFor="novaSenha"
                className="text-xs font-medium text-muted-foreground"
              >
                Nova senha
              </Label>
              <PasswordInput
                id="novaSenha"
                placeholder="••••••••"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                autoComplete="new-password"
                autoFocus
                disabled={loading}
                className="h-11"
              />

              {novaSenha && (
                <div className="space-y-1.5 mt-2">
                  <div className="flex gap-1">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-1.5 flex-1 rounded-full transition-colors"
                        style={{
                          backgroundColor:
                            i <= strength.level
                              ? strength.color
                              : 'rgba(0,0,0,0.08)',
                        }}
                      />
                    ))}
                  </div>
                  <p className="text-xs" style={{ color: strength.color }}>
                    Força: <strong>{strength.label}</strong>
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="confirmacao"
                className="text-xs font-medium text-muted-foreground"
              >
                Confirme a senha
              </Label>
              <PasswordInput
                id="confirmacao"
                placeholder="••••••••"
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
                autoComplete="new-password"
                disabled={loading}
                className="h-11"
              />
              {confirmacao && novaSenha !== confirmacao && (
                <p className="text-xs text-rose-600">As senhas não coincidem</p>
              )}
            </div>

            <ul className="text-xs space-y-1 text-muted-foreground">
              <li
                className={
                  novaSenha.length >= 8 ? 'text-emerald-700 font-medium' : ''
                }
              >
                {novaSenha.length >= 8 ? '✓' : '○'} Pelo menos 8 caracteres
              </li>
              <li
                className={
                  /[A-Za-z]/.test(novaSenha)
                    ? 'text-emerald-700 font-medium'
                    : ''
                }
              >
                {/[A-Za-z]/.test(novaSenha) ? '✓' : '○'} Pelo menos 1 letra
              </li>
              <li
                className={
                  /[0-9]/.test(novaSenha) ? 'text-emerald-700 font-medium' : ''
                }
              >
                {/[0-9]/.test(novaSenha) ? '✓' : '○'} Pelo menos 1 número
              </li>
            </ul>

            <Button
              type="submit"
              className="w-full h-11"
              disabled={
                loading ||
                novaSenha.length < 8 ||
                novaSenha !== confirmacao ||
                !/[A-Za-z]/.test(novaSenha) ||
                !/[0-9]/.test(novaSenha)
              }
              style={{ backgroundColor: '#185FA5' }}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Redefinindo...
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4 mr-2" />
                  Definir nova senha
                </>
              )}
            </Button>
          </form>
        </motion.div>
      )}

      {step === 'success' && (
        <motion.div
          key="success"
          {...motionProps()}
          className="text-center py-4"
        >
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-full mb-5"
            style={{
              background: 'linear-gradient(135deg, #5DCAA5 0%, #1D9E75 100%)',
            }}
          >
            <CheckCircle2 className="h-7 w-7 text-white" />
          </div>
          <h1
            className="font-medium tracking-tight"
            style={{ fontSize: 22, color: '#0C447C' }}
          >
            Senha redefinida
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Você será redirecionado pra tela de login em instantes.
          </p>
          <Link
            href="/login"
            className="inline-block mt-4 text-sm font-medium hover:underline"
            style={{ color: '#185FA5' }}
          >
            Ir agora →
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
