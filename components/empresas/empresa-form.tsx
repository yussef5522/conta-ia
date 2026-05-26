'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { t } from '@/lib/i18n/pt-BR'
import { formatCNPJ, formatPhone, formatCEP } from '@/lib/utils'
import {
  TIPOS_EMPRESA,
  REGIMES_TRIBUTARIOS,
  SETORES_KB,
} from '@/lib/validations/empresa'

interface EmpresaFormProps {
  empresa?: {
    id: string
    cnpj: string
    name: string
    tradeName: string | null
    type: string
    setor?: string | null
    taxRegime: string
    email: string | null
    phone: string | null
    address: string | null
    city: string | null
    state: string | null
    zipCode: string | null
  }
}

const SETOR_LABELS: Record<(typeof SETORES_KB)[number], string> = {
  RESTAURANTE: 'Restaurante / Bar / Lanchonete',
  ACADEMIA: 'Academia / Estúdio Fitness',
  COMERCIO_ROUPA: 'Comércio de Roupa / Calçado',
  VAREJO_GERAL: 'Varejo Geral',
}

interface FormData {
  cnpj: string
  name: string
  tradeName: string
  type: string
  /** Sprint 5.0.2.l — Setor da KB SetorPattern. '' = não escolhido. */
  setor: string
  taxRegime: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zipCode: string
}

interface FormErrors {
  [key: string]: string
}

export function EmpresaForm({ empresa }: EmpresaFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const isEditing = !!empresa

  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [form, setForm] = useState<FormData>({
    cnpj: empresa?.cnpj ?? '',
    name: empresa?.name ?? '',
    tradeName: empresa?.tradeName ?? '',
    type: empresa?.type ?? '',
    setor: empresa?.setor ?? '',
    taxRegime: empresa?.taxRegime ?? '',
    email: empresa?.email ?? '',
    phone: empresa?.phone ?? '',
    address: empresa?.address ?? '',
    city: empresa?.city ?? '',
    state: empresa?.state ?? '',
    zipCode: empresa?.zipCode ?? '',
  })

  function handleChange(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErrors({})

    try {
      const url = isEditing ? `/api/empresas/${empresa.id}` : '/api/empresas'
      const method = isEditing ? 'PUT' : 'POST'

      const payload = {
        ...form,
        cnpj: form.cnpj.replace(/\D/g, ''),
        zipCode: form.zipCode.replace(/\D/g, ''),
        phone: form.phone.replace(/\D/g, ''),
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.campos) {
          setErrors(data.campos)
        } else {
          toast({ variant: 'destructive', title: t.common.error, description: data.erro })
        }
        return
      }

      toast({
        variant: 'success',
        title: t.common.success,
        description: isEditing ? t.success.empresaAtualizada : t.success.empresaCriada,
      })

      router.push('/empresas')
      router.refresh()
    } catch {
      toast({ variant: 'destructive', title: t.common.error, description: t.errors.serverError })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Dados Básicos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.empresa.form.sections.dadosBasicos}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cnpj">
              {t.empresa.form.cnpjLabel} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cnpj"
              placeholder={t.empresa.form.cnpjPlaceholder}
              value={form.cnpj}
              onChange={(e) => handleChange('cnpj', formatCNPJ(e.target.value))}
              disabled={isEditing}
              maxLength={18}
            />
            {errors.cnpj && <p className="text-xs text-destructive">{errors.cnpj}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">
              {t.empresa.form.nameLabel} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder={t.empresa.form.namePlaceholder}
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="tradeName">
              {t.empresa.form.tradeNameLabel}{' '}
              <span className="text-muted-foreground text-xs">({t.common.optional})</span>
            </Label>
            <Input
              id="tradeName"
              placeholder={t.empresa.form.tradeNamePlaceholder}
              value={form.tradeName}
              onChange={(e) => handleChange('tradeName', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Informações Tributárias */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.empresa.form.sections.tributario}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="type">
              {t.empresa.form.typeLabel} <span className="text-destructive">*</span>
            </Label>
            <Select value={form.type} onValueChange={(v) => handleChange('type', v)}>
              <SelectTrigger id="type">
                <SelectValue placeholder="Selecione o setor" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_EMPRESA.map((tipo) => (
                  <SelectItem key={tipo} value={tipo}>
                    {t.empresa.tipos[tipo]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.type && <p className="text-xs text-destructive">{errors.type}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="taxRegime">
              {t.empresa.form.taxRegimeLabel} <span className="text-destructive">*</span>
            </Label>
            <Select value={form.taxRegime} onValueChange={(v) => handleChange('taxRegime', v)}>
              <SelectTrigger id="taxRegime">
                <SelectValue placeholder="Selecione o regime" />
              </SelectTrigger>
              <SelectContent>
                {REGIMES_TRIBUTARIOS.map((regime) => (
                  <SelectItem key={regime} value={regime}>
                    {t.empresa.regimes[regime]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.taxRegime && <p className="text-xs text-destructive">{errors.taxRegime}</p>}
          </div>

          {/* Sprint 5.0.2.l — Ramo principal pra Knowledge Base de categorização */}
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="setor">Ramo principal (Knowledge Base)</Label>
            <Select
              value={form.setor || undefined}
              onValueChange={(v) => handleChange('setor', v)}
            >
              <SelectTrigger id="setor">
                <SelectValue placeholder="Escolha o ramo principal" />
              </SelectTrigger>
              <SelectContent>
                {SETORES_KB.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SETOR_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Sistema usará isso pra categorizar automaticamente transações típicas do seu ramo (iFood, AMBEV, JBS, Gympass, Hering, etc).
            </p>
            {errors.setor && <p className="text-xs text-destructive">{errors.setor}</p>}
          </div>
        </CardContent>
      </Card>

      {/* Contato */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.empresa.form.sections.contato}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email">{t.empresa.form.emailLabel}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t.empresa.form.emailPlaceholder}
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">{t.empresa.form.phoneLabel}</Label>
            <Input
              id="phone"
              placeholder={t.empresa.form.phonePlaceholder}
              value={form.phone}
              onChange={(e) => handleChange('phone', formatPhone(e.target.value))}
              maxLength={15}
            />
          </div>
        </CardContent>
      </Card>

      {/* Endereço */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.empresa.form.sections.endereco}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address">{t.empresa.form.addressLabel}</Label>
            <Input
              id="address"
              placeholder={t.empresa.form.addressPlaceholder}
              value={form.address}
              onChange={(e) => handleChange('address', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">{t.empresa.form.cityLabel}</Label>
            <Input
              id="city"
              placeholder={t.empresa.form.cityPlaceholder}
              value={form.city}
              onChange={(e) => handleChange('city', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="state">{t.empresa.form.stateLabel}</Label>
              <Input
                id="state"
                placeholder={t.empresa.form.statePlaceholder}
                value={form.state}
                onChange={(e) => handleChange('state', e.target.value.toUpperCase())}
                maxLength={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="zipCode">{t.empresa.form.zipCodeLabel}</Label>
              <Input
                id="zipCode"
                placeholder={t.empresa.form.zipCodePlaceholder}
                value={form.zipCode}
                onChange={(e) => handleChange('zipCode', formatCEP(e.target.value))}
                maxLength={9}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botões */}
      <div className="flex items-center gap-3 justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
        >
          {t.empresa.form.cancelButton}
        </Button>
        <Button type="submit" disabled={loading}>
          {loading
            ? t.empresa.form.saving
            : isEditing
            ? t.empresa.form.saveButtonEdit
            : t.empresa.form.saveButton}
        </Button>
      </div>
    </form>
  )
}
