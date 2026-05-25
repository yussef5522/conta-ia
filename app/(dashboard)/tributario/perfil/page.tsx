'use client'

// Sprint 5.0.1 — Form perfil tributário.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Header } from '@/components/layout/header'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { useEmpresa } from '@/lib/contexts/empresa-context'
import { DisclaimerBanner } from '@/components/tax/disclaimer-banner'

interface Profile {
  regime: string
  simplesAnexo: string | null
  folha12m: number
  proLabore: number
  cnae: string | null
}

const ANEXO_OPTIONS = [
  { value: 'ANEXO_I', label: 'Anexo I — Comércio' },
  { value: 'ANEXO_II', label: 'Anexo II — Indústria' },
  { value: 'ANEXO_III', label: 'Anexo III — Serviços (com Fator R)' },
  { value: 'ANEXO_IV', label: 'Anexo IV — Construção / Vigilância / Limpeza' },
  { value: 'ANEXO_V', label: 'Anexo V — Serviços (sem Fator R)' },
]

export default function PerfilTributarioPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { currentEmpresaId } = useEmpresa()

  const [regime, setRegime] = useState<'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL'>('SIMPLES_NACIONAL')
  const [anexo, setAnexo] = useState<string>('ANEXO_III')
  const [folha12m, setFolha12m] = useState('')
  const [proLabore, setProLabore] = useState('')
  const [cnae, setCnae] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!currentEmpresaId) return
    setLoading(true)
    fetch(`/api/empresas/${currentEmpresaId}/tax-profile`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const p: Profile | null = data?.profile ?? null
        if (p) {
          setRegime(p.regime as typeof regime)
          setAnexo(p.simplesAnexo ?? 'ANEXO_III')
          setFolha12m(String(p.folha12m ?? 0))
          setProLabore(String(p.proLabore ?? 0))
          setCnae(p.cnae ?? '')
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [currentEmpresaId])

  async function salvar() {
    if (!currentEmpresaId) {
      toast({ variant: 'destructive', title: 'Selecione uma empresa' })
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/empresas/${currentEmpresaId}/tax-profile`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          regime,
          simplesAnexo: regime === 'SIMPLES_NACIONAL' ? anexo : null,
          folha12m: Number(folha12m) || 0,
          proLabore: Number(proLabore) || 0,
          cnae: cnae || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Falha ao salvar',
          description: data.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      toast({ title: 'Perfil tributário salvo' })
      router.push('/tributario')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Carregando…</p>
  }

  return (
    <div className="space-y-6">
      <Header title="Perfil Tributário" description="Configurações fiscais da empresa atual">
        <Button asChild variant="outline" size="sm">
          <Link href="/tributario">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Voltar
          </Link>
        </Button>
      </Header>

      <DisclaimerBanner />

      <Card>
        <CardContent className="py-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs">Regime tributário <span className="text-red-500">*</span></label>
            <Select value={regime} onValueChange={(v) => setRegime(v as typeof regime)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SIMPLES_NACIONAL">Simples Nacional</SelectItem>
                <SelectItem value="LUCRO_PRESUMIDO" disabled>
                  Lucro Presumido (Sprint 5.0.2)
                </SelectItem>
                <SelectItem value="LUCRO_REAL" disabled>
                  Lucro Real (Sprint 5.0.2)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {regime === 'SIMPLES_NACIONAL' && (
            <div className="space-y-1.5">
              <label className="text-xs">Anexo do Simples <span className="text-red-500">*</span></label>
              <Select value={anexo} onValueChange={setAnexo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ANEXO_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs">Folha 12 meses (R$)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={folha12m}
                onChange={(e) => setFolha12m(e.target.value)}
                placeholder="0.00"
              />
              <p className="text-[10px] text-zinc-500">
                Total pago em salários + encargos + pró-labore nos últimos 12 meses.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs">Pró-labore mensal (R$)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={proLabore}
                onChange={(e) => setProLabore(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs">CNAE principal (opcional)</label>
            <Input
              value={cnae}
              onChange={(e) => setCnae(e.target.value)}
              placeholder="9311-5/00"
              maxLength={20}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" asChild disabled={saving}>
              <Link href="/tributario">Cancelar</Link>
            </Button>
            <Button onClick={salvar} disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar perfil'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
