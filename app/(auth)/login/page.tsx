'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { t } from '@/lib/i18n/pt-BR'
import type { Metadata } from 'next'

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErrors({})

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 401) {
          toast({
            variant: 'destructive',
            title: t.common.error,
            description: t.auth.login.errors.invalidCredentials,
          })
        } else {
          toast({
            variant: 'destructive',
            title: t.common.error,
            description: t.auth.login.errors.serverError,
          })
        }
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch {
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: t.auth.login.errors.serverError,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">{t.auth.login.title}</h1>
        <p className="text-sm text-muted-foreground">{t.auth.login.subtitle}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">{t.auth.login.emailLabel}</Label>
          <Input
            id="email"
            type="email"
            placeholder={t.auth.login.emailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            autoFocus
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">{t.auth.login.passwordLabel}</Label>
          <Input
            id="password"
            type="password"
            placeholder={t.auth.login.passwordPlaceholder}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? t.auth.login.loading : t.auth.login.submitButton}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {t.auth.login.noAccount}{' '}
        <Link href="/cadastro" className="font-medium text-primary hover:underline">
          {t.auth.login.signupLink}
        </Link>
      </p>
    </div>
  )
}
