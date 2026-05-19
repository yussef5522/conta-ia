'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { t } from '@/lib/i18n/pt-BR'

interface CouponPreview {
  code: string
  description: string | null
  valueFormatted: string
}

function CadastroPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Sprint 1.7 — campo cupom
  const [couponCode, setCouponCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<CouponPreview | null>(null)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [validatingCoupon, setValidatingCoupon] = useState(false)
  const [autoApplied, setAutoApplied] = useState(false)

  // Auto-aplica cupom da query string `?cupom=XXX` (link compartilhado)
  useEffect(() => {
    const raw = searchParams.get('cupom') ?? searchParams.get('cupon') ?? searchParams.get('coupon')
    if (raw && !autoApplied) {
      const trimmed = raw.trim().toUpperCase()
      setCouponCode(trimmed)
      setAutoApplied(true)
      void applyCoupon(trimmed)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  function handleChange(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  async function applyCoupon(codeArg?: string) {
    const code = (codeArg ?? couponCode).trim().toUpperCase()
    if (!code) return
    setValidatingCoupon(true)
    setCouponError(null)
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (data.valid) {
        setAppliedCoupon({
          code: data.code,
          description: data.description ?? null,
          valueFormatted: data.valueFormatted,
        })
        setCouponCode(data.code)
      } else {
        setAppliedCoupon(null)
        setCouponError(data.message ?? 'Cupom inválido.')
      }
    } catch {
      setCouponError('Falha ao validar. Tente de novo.')
    } finally {
      setValidatingCoupon(false)
    }
  }

  function removeCoupon() {
    setAppliedCoupon(null)
    setCouponCode('')
    setCouponError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErrors({})

    try {
      const payload: Record<string, unknown> = { ...form }
      if (appliedCoupon) payload.couponCode = appliedCoupon.code

      const res = await fetch('/api/auth/cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
          <p className="text-sm text-muted-foreground">
            {t.auth.cadastro.subtitle}
          </p>
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
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
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
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email}</p>
            )}
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
            <p className="text-xs text-muted-foreground">
              {t.auth.cadastro.passwordHint}
            </p>
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">
              {t.auth.cadastro.confirmPasswordLabel}
            </Label>
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

          {/* Sprint 1.7 — Cupom */}
          <div className="space-y-2">
            <Label htmlFor="couponCode">Cupom (opcional)</Label>
            {appliedCoupon ? (
              <div
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                style={{
                  background: 'rgba(34, 197, 94, 0.06)',
                  borderColor: 'rgba(34, 197, 94, 0.40)',
                }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-mono font-semibold text-green-700 dark:text-green-300">
                    {appliedCoupon.code} · {appliedCoupon.valueFormatted}
                  </p>
                  {appliedCoupon.description && (
                    <p className="text-xs text-muted-foreground truncate">
                      {appliedCoupon.description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={removeCoupon}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                  aria-label="Remover cupom"
                >
                  Remover
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <Input
                    id="couponCode"
                    placeholder="EX: FUNDADOR100"
                    value={couponCode}
                    onChange={(e) => {
                      setCouponCode(e.target.value.toUpperCase())
                      if (couponError) setCouponError(null)
                    }}
                    maxLength={20}
                    autoComplete="off"
                    style={{ fontFamily: 'monospace', textTransform: 'uppercase' }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => applyCoupon()}
                    disabled={!couponCode.trim() || validatingCoupon}
                  >
                    {validatingCoupon ? 'Validando...' : 'Aplicar'}
                  </Button>
                </div>
                {couponError && (
                  <p className="text-xs text-destructive">{couponError}</p>
                )}
              </>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t.auth.cadastro.loading : t.auth.cadastro.submitButton}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {t.auth.cadastro.hasAccount}{' '}
          <Link
            href="/login"
            className="font-medium text-primary hover:underline"
          >
            {t.auth.cadastro.loginLink}
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function CadastroPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <CadastroPageInner />
    </Suspense>
  )
}
