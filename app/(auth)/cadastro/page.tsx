'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { t } from '@/lib/i18n/pt-BR'

export default function CadastroPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  function handleChange(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErrors({})

    try {
      const res = await fetch('/api/auth/cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.campos) {
          setErrors(data.campos)
        } else {
          toast({
            variant: 'destructive',
            title: t.common.error,
            description: data.erro ?? t.auth.cadastro.errors.serverError,
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
        description: t.auth.cadastro.errors.serverError,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-6">
      <div className="w-full max-w-sm space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">{t.auth.cadastro.title}</h1>
        <p className="text-sm text-muted-foreground">{t.auth.cadastro.subtitle}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">{t.auth.cadastro.nameLabel}</Label>
          <Input
            id="name"
            placeholder={t.auth.cadastro.namePlaceholder}
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            required
            autoFocus
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">{t.auth.cadastro.emailLabel}</Label>
          <Input
            id="email"
            type="email"
            placeholder={t.auth.cadastro.emailPlaceholder}
            value={form.email}
            onChange={(e) => handleChange('email', e.target.value)}
            required
            autoComplete="email"
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">{t.auth.cadastro.passwordLabel}</Label>
          <Input
            id="password"
            type="password"
            placeholder={t.auth.cadastro.passwordPlaceholder}
            value={form.password}
            onChange={(e) => handleChange('password', e.target.value)}
            required
            autoComplete="new-password"
          />
          <p className="text-xs text-muted-foreground">{t.auth.cadastro.passwordHint}</p>
          {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">{t.auth.cadastro.confirmPasswordLabel}</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder={t.auth.cadastro.confirmPasswordPlaceholder}
            value={form.confirmPassword}
            onChange={(e) => handleChange('confirmPassword', e.target.value)}
            required
            autoComplete="new-password"
          />
          {errors.confirmPassword && (
            <p className="text-xs text-destructive">{errors.confirmPassword}</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? t.auth.cadastro.loading : t.auth.cadastro.submitButton}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {t.auth.cadastro.hasAccount}{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t.auth.cadastro.loginLink}
        </Link>
      </p>
      </div>
    </div>
  )
}
