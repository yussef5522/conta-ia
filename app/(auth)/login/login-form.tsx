'use client'

// Form de login — Sprint 1.2.
// Validação client-side (email + senha mínima 6 chars), submissão pra
// /api/auth/login, tratamento de erros em pt-BR, loading state.

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/auth/password-input'
import { useToast } from '@/components/ui/use-toast'
import { validateLoginForm } from '@/lib/auth/validate-login'

export function LoginForm() {
  const router = useRouter()
  const { toast } = useToast()

  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})

  function validate(): boolean {
    const next = validateLoginForm({ email, password })
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        const errMsg =
          res.status === 429
            ? data.erro ?? 'Muitas tentativas. Tente novamente em alguns minutos.'
            : res.status === 401
              ? 'E-mail ou senha incorretos'
              : res.status === 403
                ? 'Sua conta está suspensa. Contate o suporte.'
                : data.erro ?? 'Não foi possível entrar. Tente novamente.'
        toast({
          variant: 'destructive',
          title: 'Erro ao entrar',
          description: errMsg,
        })
        return
      }

      // Sucesso: redirect pra dashboard (rota raiz autenticada)
      router.push('/dashboard')
      router.refresh()
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro de conexão',
        description: 'Não foi possível conectar. Verifique sua internet.',
      })
    } finally {
      setLoading(false)
    }
  }

  const submitDisabled = loading || !email || !password

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Email */}
      <div className="space-y-1.5">
        <Label
          htmlFor="email"
          className="text-xs font-medium text-muted-foreground"
        >
          E-mail
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="seu@empresa.com.br"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          autoFocus
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-err' : undefined}
          className="h-11"
        />
        {errors.email && (
          <p id="email-err" className="text-xs text-destructive" role="alert">
            {errors.email}
          </p>
        )}
      </div>

      {/* Senha */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label
            htmlFor="password"
            className="text-xs font-medium text-muted-foreground"
          >
            Senha
          </Label>
          <Link
            href="/esqueci-senha"
            className="text-xs font-medium text-primary hover:underline"
          >
            Esqueci minha senha
          </Link>
        </div>
        <PasswordInput
          id="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? 'password-err' : undefined}
          className="h-11"
        />
        {errors.password && (
          <p id="password-err" className="text-xs text-destructive" role="alert">
            {errors.password}
          </p>
        )}
      </div>

      {/* Submit */}
      <Button
        type="submit"
        className="w-full h-11 text-sm font-medium"
        disabled={submitDisabled}
        style={{ backgroundColor: '#185FA5' }}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Entrando...
          </>
        ) : (
          'Entrar'
        )}
      </Button>

      {/* Criar conta */}
      <p className="text-center text-sm text-muted-foreground">
        Não tem conta?{' '}
        <Link
          href="/cadastro"
          className="font-medium hover:underline"
          style={{ color: '#185FA5' }}
        >
          Criar conta grátis
        </Link>
      </p>

      {/* Trust */}
      <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground pt-2">
        <ShieldCheck className="h-3.5 w-3.5" />
        <span>Conexão segura · Dados criptografados · LGPD</span>
      </div>
    </form>
  )
}
