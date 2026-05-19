'use client'

// Login admin DARK premium — Sprint 1.6.
// Anti-enumeration: erro genérico "Credenciais inválidas".
// Visual: monoespaçado discreto, paleta dark + accent sutil.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Lock } from 'lucide-react'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function AdminLoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!EMAIL_REGEX.test(email.trim())) {
      setError('Credenciais inválidas')
      return
    }
    if (!password) {
      setError('Credenciais inválidas')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (res.status === 429) {
          setError(data.erro ?? 'Muitas tentativas. Aguarde alguns minutos.')
        } else {
          setError('Credenciais inválidas')
        }
        return
      }

      router.push('/admin/dashboard')
      router.refresh()
    } catch {
      setError('Falha de conexão')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && (
        <div
          role="alert"
          className="rounded border px-3 py-2 text-xs"
          style={{
            background: 'rgba(239,68,68,0.10)',
            borderColor: 'rgba(239,68,68,0.30)',
            color: '#fca5a5',
          }}
        >
          {error}
        </div>
      )}

      <div className="space-y-1">
        <label
          htmlFor="email"
          className="text-[10px] uppercase tracking-widest"
          style={{ color: '#737373' }}
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          autoFocus
          disabled={loading}
          className="w-full h-10 px-3 rounded text-sm font-mono outline-none transition-colors"
          style={{
            background: '#171717',
            border: '1px solid #262626',
            color: '#e5e5e5',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#3b82f6'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#262626'
          }}
        />
      </div>

      <div className="space-y-1">
        <label
          htmlFor="password"
          className="text-[10px] uppercase tracking-widest"
          style={{ color: '#737373' }}
        >
          Senha
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          disabled={loading}
          className="w-full h-10 px-3 rounded text-sm font-mono outline-none transition-colors"
          style={{
            background: '#171717',
            border: '1px solid #262626',
            color: '#e5e5e5',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#3b82f6'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#262626'
          }}
        />
      </div>

      <button
        type="submit"
        disabled={loading || !email || !password}
        className="w-full h-10 rounded text-sm font-medium tracking-tight transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: '#185FA5',
          color: '#fafafa',
        }}
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Autenticando
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <Lock className="h-3.5 w-3.5" />
            Entrar
          </span>
        )}
      </button>

      <p
        className="text-center text-[10px] pt-1"
        style={{ color: '#525252' }}
      >
        Acesso registrado · IP e dispositivo monitorados
      </p>
    </form>
  )
}
