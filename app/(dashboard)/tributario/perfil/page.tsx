'use client'

// Sprint 5.0.1 + 5.0.2 — Form perfil tributário completo (Simples + Presumido + Real).

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Header } from '@/components/layout/header'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { useEmpresa } from '@/lib/contexts/empresa-context'
import { DisclaimerInfo } from '@/components/tax/disclaimer-info'
import { ATIVIDADE_LABELS } from '@/lib/validations/tax-compare'
import { UF_LABELS } from '@/lib/tax/lucro-real-tables'
import { CNAESearchPicker, type CNAEPickerResult } from '@/components/tributario/cnae-search-picker'

interface Profile {
  regime: 'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL'
  simplesAnexo: string | null
  folha12m: number
  proLabore: number
  cnae: string | null
  atividade: string | null
  estado: string | null
  hasICMS: boolean
  hasISS: boolean
  margemReal: number
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

  const [regime, setRegime] =
    useState<Profile['regime']>('SIMPLES_NACIONAL')
  const [anexo, setAnexo] = useState<string>('ANEXO_III')
  const [folha12m, setFolha12m] = useState('')
  const [proLabore, setProLabore] = useState('')
  const [cnae, setCnae] = useState('')
  const [atividade, setAtividade] = useState<string>('SERVICOS')
  const [estado, setEstado] = useState<string>('RS')
  const [hasICMS, setHasICMS] = useState(false)
  const [hasISS, setHasISS] = useState(true)
  const [margemReal, setMargemReal] = useState('15')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Sprint 5.0.2.c — picker visual de CNAE
  const [selectedCNAE, setSelectedCNAE] = useState<CNAEPickerResult | null>(null)

  useEffect(() => {
    if (!currentEmpresaId) return
    setLoading(true)
    fetch(`/api/empresas/${currentEmpresaId}/tax-profile`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const p: Profile | null = data?.profile ?? null
        if (p) {
          setRegime(p.regime)
          setAnexo(p.simplesAnexo ?? 'ANEXO_III')
          setFolha12m(String(p.folha12m ?? 0))
          setProLabore(String(p.proLabore ?? 0))
          setCnae(p.cnae ?? '')
          if (p.atividade) setAtividade(p.atividade)
          if (p.estado) setEstado(p.estado)
          if (typeof p.hasICMS === 'boolean') setHasICMS(p.hasICMS)
          if (typeof p.hasISS === 'boolean') setHasISS(p.hasISS)
          if (typeof p.margemReal === 'number') setMargemReal(String(p.margemReal))
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [currentEmpresaId])

  // Auto-popular CNAE selecionado quando profile carregar
  useEffect(() => {
    if (!cnae) return
    fetch(`/api/cnae/search?q=${encodeURIComponent(cnae)}`, {
      credentials: 'include',
    })
      .then((r) => r.json())
      .then((d) => {
        const exact = d.results?.find((r: CNAEPickerResult) => r.code === cnae)
        if (exact) setSelectedCNAE(exact)
      })
      .catch(() => {})
  }, [cnae])

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
          atividade,
          estado,
          hasICMS,
          hasISS,
          margemReal: Number(margemReal) || 15,
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
        <DisclaimerInfo />
        <Button asChild variant="outline" size="sm">
          <Link href="/tributario">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Voltar
          </Link>
        </Button>
      </Header>

      <Card>
        <CardContent className="py-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs">
              Regime tributário <span className="text-red-500">*</span>
            </label>
            <Select value={regime} onValueChange={(v) => setRegime(v as Profile['regime'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SIMPLES_NACIONAL">Simples Nacional</SelectItem>
                <SelectItem value="LUCRO_PRESUMIDO">Lucro Presumido</SelectItem>
                <SelectItem value="LUCRO_REAL">Lucro Real</SelectItem>
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
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs">Atividade (pra Lucro Presumido)</label>
              <Select value={atividade} onValueChange={setAtividade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ATIVIDADE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs">Estado (UF)</label>
              <Select value={estado} onValueChange={setEstado}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {Object.entries(UF_LABELS).map(([uf, label]) => (
                    <SelectItem key={uf} value={uf}>{uf} — {label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

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
                Total pago em salários + encargos + pró-labore nos últimos 12 meses (Fator R).
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

          {regime === 'LUCRO_REAL' && (
            <div className="space-y-1.5">
              <label className="text-xs">Margem real declarada (%)</label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={margemReal}
                onChange={(e) => setMargemReal(e.target.value)}
                placeholder="15"
              />
              <p className="text-[10px] text-zinc-500">
                % do faturamento que vira lucro tributável. Verifique no DRE da empresa.
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center pt-2 border-t">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={hasICMS} onCheckedChange={(v) => setHasICMS(!!v)} />
              Atividade tem ICMS (comércio/indústria)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={hasISS} onCheckedChange={(v) => setHasISS(!!v)} />
              Atividade tem ISS (serviços)
            </label>
          </div>

          <div className="pt-3 border-t">
            <CNAESearchPicker
              value={cnae}
              onChange={(picked) => {
                setCnae(picked.code)
                setSelectedCNAE(picked)
              }}
            />

            {selectedCNAE && (
              <div className="mt-3 rounded-md bg-indigo-50/50 border border-indigo-100 p-3 text-xs flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base">{selectedCNAE.icon}</span>
                  <div className="min-w-0">
                    <div className="font-medium text-indigo-900 truncate">
                      Selecionada: {selectedCNAE.name}
                    </div>
                    <div className="text-zinc-600">
                      <span className="font-mono">{selectedCNAE.code}</span> · {selectedCNAE.ramoLabel}
                    </div>
                  </div>
                </div>
                <Link
                  href="/tributario/expertise"
                  className="text-indigo-600 hover:underline whitespace-nowrap shrink-0"
                >
                  Ver análise expert →
                </Link>
              </div>
            )}
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
