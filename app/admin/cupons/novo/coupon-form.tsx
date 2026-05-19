'use client'

// Form de criação de cupom no painel admin — Sprint 1.7.
// Dark Linear-vibe. Validação cliente-side mínima — servidor é fonte da verdade.

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

type CouponType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_MONTHS'

interface FormState {
  code: string
  description: string
  type: CouponType
  value: string
  freeMonths: string
  validUntil: string
  maxUses: string
  maxUsesPerUser: string
}

const INITIAL: FormState = {
  code: '',
  description: '',
  type: 'PERCENTAGE',
  value: '',
  freeMonths: '',
  validUntil: '',
  maxUses: '',
  maxUsesPerUser: '1',
}

export function NovoCouponForm() {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(INITIAL)
  const [submitting, setSubmitting] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const previewValue = useMemo(() => {
    const n = Number(form.value || 0)
    if (form.type === 'PERCENTAGE') return `${n}%`
    if (form.type === 'FIXED_AMOUNT')
      return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    if (form.type === 'FREE_MONTHS') {
      const m = Number(form.freeMonths || 0)
      return m === 1 ? '1 mês grátis' : `${m} meses grátis`
    }
    return '—'
  }, [form.type, form.value, form.freeMonths])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setErro(null)

    const payload: Record<string, unknown> = {
      code: form.code.trim().toUpperCase(),
      description: form.description.trim() || null,
      type: form.type,
      value: form.type === 'FREE_MONTHS' ? 0 : Number(form.value || 0),
      maxUsesPerUser: Number(form.maxUsesPerUser || 1),
    }
    if (form.type === 'FREE_MONTHS') {
      payload.freeMonths = Number(form.freeMonths)
    }
    if (form.validUntil) payload.validUntil = new Date(form.validUntil).toISOString()
    if (form.maxUses) payload.maxUses = Number(form.maxUses)

    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setErro(data.erro ?? 'Erro ao criar cupom.')
        setSubmitting(false)
        return
      }
      router.push(`/admin/cupons/${data.coupon.id}`)
      router.refresh()
    } catch {
      setErro('Falha de rede. Tente de novo.')
      setSubmitting(false)
    }
  }

  function update<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  const inputStyle: React.CSSProperties = {
    background: '#0a0a0a',
    border: '1px solid #1f1f1f',
    color: '#fafafa',
  }
  const labelClass = 'text-[10px] uppercase tracking-wider'
  const labelStyle: React.CSSProperties = { color: '#737373' }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      {/* Code */}
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} style={labelStyle}>
          Código <span style={{ color: '#fca5a5' }}>*</span>
        </label>
        <input
          type="text"
          required
          maxLength={20}
          value={form.code}
          onChange={(e) => update('code', e.target.value.toUpperCase())}
          placeholder="FUNDADOR100"
          className="text-sm font-mono px-3 py-2 rounded outline-none uppercase tracking-wider"
          style={inputStyle}
        />
        <p className="text-[10px]" style={{ color: '#525252' }}>
          4-20 caracteres. Apenas letras maiúsculas e números. Imutável após criar.
        </p>
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} style={labelStyle}>
          Descrição interna
        </label>
        <input
          type="text"
          maxLength={500}
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          placeholder="100% off vitalício para os 100 primeiros fundadores"
          className="text-sm px-3 py-2 rounded outline-none"
          style={inputStyle}
        />
      </div>

      {/* Type + Value + FreeMonths */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} style={labelStyle}>
            Tipo <span style={{ color: '#fca5a5' }}>*</span>
          </label>
          <select
            value={form.type}
            onChange={(e) => update('type', e.target.value as CouponType)}
            className="text-sm px-3 py-2 rounded outline-none"
            style={inputStyle}
          >
            <option value="PERCENTAGE">Porcentagem (%)</option>
            <option value="FIXED_AMOUNT">Valor fixo (R$)</option>
            <option value="FREE_MONTHS">Meses grátis</option>
          </select>
        </div>

        {form.type === 'FREE_MONTHS' ? (
          <div className="flex flex-col gap-1.5">
            <label className={labelClass} style={labelStyle}>
              Meses grátis <span style={{ color: '#fca5a5' }}>*</span>
            </label>
            <input
              type="number"
              min={1}
              max={120}
              required
              value={form.freeMonths}
              onChange={(e) => update('freeMonths', e.target.value)}
              placeholder="3"
              className="text-sm font-mono px-3 py-2 rounded outline-none tabular-nums"
              style={inputStyle}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label className={labelClass} style={labelStyle}>
              Valor <span style={{ color: '#fca5a5' }}>*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min={0}
              max={form.type === 'PERCENTAGE' ? 100 : undefined}
              required
              value={form.value}
              onChange={(e) => update('value', e.target.value)}
              placeholder={form.type === 'PERCENTAGE' ? '100' : '49.90'}
              className="text-sm font-mono px-3 py-2 rounded outline-none tabular-nums"
              style={inputStyle}
            />
          </div>
        )}
      </div>

      {/* Validade + maxUses + maxUsesPerUser */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} style={labelStyle}>
            Válido até
          </label>
          <input
            type="date"
            value={form.validUntil}
            onChange={(e) => update('validUntil', e.target.value)}
            className="text-sm px-3 py-2 rounded outline-none"
            style={inputStyle}
          />
          <p className="text-[10px]" style={{ color: '#525252' }}>
            Vazio = sem prazo (vitalício)
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelClass} style={labelStyle}>
            Limite total
          </label>
          <input
            type="number"
            min={1}
            value={form.maxUses}
            onChange={(e) => update('maxUses', e.target.value)}
            placeholder="∞"
            className="text-sm font-mono px-3 py-2 rounded outline-none tabular-nums"
            style={inputStyle}
          />
          <p className="text-[10px]" style={{ color: '#525252' }}>
            Vazio = ilimitado
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelClass} style={labelStyle}>
            Por usuário
          </label>
          <input
            type="number"
            min={1}
            value={form.maxUsesPerUser}
            onChange={(e) => update('maxUsesPerUser', e.target.value)}
            className="text-sm font-mono px-3 py-2 rounded outline-none tabular-nums"
            style={inputStyle}
          />
        </div>
      </div>

      {/* Preview */}
      <div
        className="px-4 py-3 rounded"
        style={{
          background: 'rgba(29, 158, 117, 0.08)',
          border: '1px solid rgba(29, 158, 117, 0.25)',
        }}
      >
        <p
          className="text-[10px] uppercase tracking-wider"
          style={{ color: '#5DCAA5' }}
        >
          Preview
        </p>
        <p
          className="text-base font-mono font-medium mt-1"
          style={{ color: '#fafafa' }}
        >
          {form.code || 'CODIGO'} → {previewValue}
        </p>
        {form.description && (
          <p className="text-xs mt-1" style={{ color: '#a3a3a3' }}>
            {form.description}
          </p>
        )}
      </div>

      {/* Erro */}
      {erro && (
        <div
          className="px-3 py-2 rounded text-xs"
          style={{
            background: 'rgba(239, 68, 68, 0.10)',
            border: '1px solid rgba(239, 68, 68, 0.30)',
            color: '#fca5a5',
          }}
        >
          {erro}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="text-xs px-4 py-2 rounded font-medium transition-colors disabled:opacity-50"
          style={{
            background: '#fafafa',
            color: '#0a0a0a',
          }}
        >
          {submitting ? 'Criando...' : 'Criar cupom'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/cupons')}
          className="text-xs px-4 py-2 rounded transition-colors"
          style={{
            background: 'transparent',
            color: '#a3a3a3',
          }}
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
