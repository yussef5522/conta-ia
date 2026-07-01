'use client'

// Sprint Unificar Sócios — Cliente da tela /socios unificada.
//
// Tabs:
//  1. Sócios PF (cadastro + coluna "Suas pontes" filtrada por privacidade)
//  2. Empresas do Grupo (CNPJs relacionados)
//
// Reuso: endpoints /socios-pf + /empresas-relacionadas existentes (CRUD).
// Privacidade: coluna "Suas pontes" chama agregador filtrado por userId.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Users, Building2, Plus, Trash2, ArrowRight, Loader2, Wand2, X, Sparkles } from 'lucide-react'
import { RetiradasPendentesTab } from '@/components/bridges/RetiradasPendentesTab'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Header } from '@/components/layout/header'
import { useToast } from '@/components/ui/use-toast'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatBRL } from '@/lib/format/money'

interface Socio {
  id: string
  nome: string
  cpf: string | null
  pixKeys: string[]
  papel: string
}

interface EmpresaRel {
  id: string
  cnpjRelacionado: string
  nomeFantasia: string
  pixKeys: string[]
  relacao: string
}

interface SocioWithPontes extends Socio {
  /** Quantidade de pontes deste sócio que o user logado pode ver (privacidade). */
  suasPontesCount: number
  /** Soma das pontes do user logado pra este sócio. */
  suasPontesAmount: number
}

interface Props {
  empresaId: string
  empresaNome: string
}

const PAPEL_LABELS: Record<string, string> = {
  SOCIO: 'Sócio',
  ADMINISTRADOR: 'Administrador',
  FAMILIAR: 'Familiar',
}

const RELACAO_LABELS: Record<string, string> = {
  MESMO_GRUPO: 'Mesmo grupo',
  SOCIO_COMUM: 'Sócio comum',
  CONTROLADA: 'Controlada',
  CONTROLADORA: 'Controladora',
}

function maskCpf(cpf: string | null): string {
  if (!cpf) return '—'
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11) return cpf
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`
}

function maskCnpj(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '')
  if (digits.length !== 14) return cnpj
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`
}

export function SociosUnifiedClient({ empresaId, empresaNome }: Props) {
  const { toast } = useToast()
  const [socios, setSocios] = useState<SocioWithPontes[]>([])
  const [empresasRel, setEmpresasRel] = useState<EmpresaRel[]>([])
  const [loading, setLoading] = useState(true)
  const [showSocioForm, setShowSocioForm] = useState(false)
  const [showEmpresaForm, setShowEmpresaForm] = useState(false)
  const [recategorizing, setRecategorizing] = useState(false)
  const [activeTab, setActiveTab] = useState('socios-pf')
  const [showMigrationToast, setShowMigrationToast] = useState(false)
  // Sprint Fluxo-Unificado-Retirada (30/06/2026): contador da fila usado
  // no badge da aba. Fetch leve, cache 60s no endpoint.
  const [retiradasCount, setRetiradasCount] = useState<number | null>(null)

  // Toast enxuto: aparece 1 vez por user via localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    const k = 'socios-unified-toast-seen-v1'
    if (!localStorage.getItem(k)) {
      setShowMigrationToast(true)
      localStorage.setItem(k, '1')
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/empresas/${empresaId}/socios-pf`, { credentials: 'include' }),
        fetch(`/api/empresas/${empresaId}/empresas-relacionadas`, { credentials: 'include' }),
      ])
      if (!r1.ok) throw new Error('Erro ao carregar sócios')
      if (!r2.ok) throw new Error('Erro ao carregar empresas')
      const d1 = await r1.json()
      const d2 = await r2.json()
      const rawSocios: Socio[] = d1.socios ?? []
      setEmpresasRel(d2.empresas ?? [])

      // Buscar agregados em paralelo (privacidade userId no endpoint)
      const agg = await Promise.all(
        rawSocios.map((s) =>
          fetch(`/api/empresas/${empresaId}/socios/${s.id}/aggregated`, { credentials: 'include' })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
        ),
      )

      const enriched: SocioWithPontes[] = rawSocios.map((s, i) => {
        const data = agg[i]
        return {
          ...s,
          suasPontesCount: data?.agregados?.totalCount ?? 0,
          suasPontesAmount: data?.agregados?.totalAmount ?? 0,
        }
      })
      setSocios(enriched)
    } catch (err) {
      toast({
        title: 'Erro',
        description: (err as Error).message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [empresaId, toast])

  useEffect(() => {
    load()
  }, [load])

  // Sprint Fluxo-Unificado-Retirada (30/06/2026): puxa contador da fila
  // em paralelo (mesmo endpoint que a aba usa — cache 60s garante 1 hit).
  useEffect(() => {
    fetch(`/api/empresas/${empresaId}/retiradas-pendentes`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j && typeof j.total === 'number') setRetiradasCount(j.total)
      })
      .catch(() => {
        /* silent — contador é decorativo */
      })
  }, [empresaId])

  async function recategorizePix() {
    setRecategorizing(true)
    try {
      const res = await fetch(`/api/empresas/${empresaId}/recategorize-pix`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Erro ao re-analisar')
      const json = await res.json()
      toast({
        title: 'Re-análise concluída',
        description: `${json.atualizadas ?? 0} transações atualizadas`,
      })
    } catch (err) {
      toast({
        title: 'Erro',
        description: (err as Error).message,
        variant: 'destructive',
      })
    } finally {
      setRecategorizing(false)
    }
  }

  async function handleDeleteSocio(id: string) {
    if (!confirm('Excluir este sócio?')) return
    try {
      const res = await fetch(`/api/empresas/${empresaId}/socios-pf/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Erro ao excluir')
      toast({ title: 'Sócio excluído' })
      load()
    } catch (err) {
      toast({
        title: 'Erro',
        description: (err as Error).message,
        variant: 'destructive',
      })
    }
  }

  async function handleDeleteEmpresa(id: string) {
    if (!confirm('Excluir esta empresa do grupo?')) return
    try {
      const res = await fetch(`/api/empresas/${empresaId}/empresas-relacionadas/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Erro ao excluir')
      toast({ title: 'Empresa excluída' })
      load()
    } catch (err) {
      toast({
        title: 'Erro',
        description: (err as Error).message,
        variant: 'destructive',
      })
    }
  }

  return (
    <>
      <Header title="Sócios" description={`${empresaNome}`} />

      <div className="container mx-auto max-w-6xl px-4 py-6 space-y-6">
        {/* Toast enxuto de migração (1 vez por user via localStorage) */}
        {showMigrationToast && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
            <span>
              ✨ <strong>Novidade:</strong> &quot;Pessoas Vinculadas&quot; e
              &quot;Pontes PJ→PF&quot; foram unificadas aqui em &quot;Sócios&quot;.
            </span>
            <button
              onClick={() => setShowMigrationToast(false)}
              className="text-amber-700 hover:text-amber-900"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Banner privacidade */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="flex items-start gap-3 p-4">
            <Users className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
            <div className="text-sm">
              <p className="font-medium text-blue-900">Privacidade</p>
              <p className="text-blue-800">
                Os cadastros (CPF/CNPJ/papel) são visíveis a todos da empresa.
                Os <strong>pagamentos (pontes)</strong> que cada sócio recebeu
                são privados — você só vê os <strong>seus</strong>.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card educativo sobre detecção (preservado da tela antiga) */}
        {(socios.length > 0 || empresasRel.length > 0) && (
          <Card className="bg-indigo-50/40 border-indigo-100">
            <CardContent className="py-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-xs text-indigo-900">
                  💡 <strong>Detecção automática de Pix</strong> funciona com os cadastros
                  atuais. Re-analisar aplica em transações antigas.
                </p>
                <Button size="sm" variant="default" onClick={recategorizePix} disabled={recategorizing}>
                  {recategorizing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Analisando…
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-3.5 w-3.5 mr-1.5" />
                      Re-analisar Pix antigos
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="socios-pf">
              <Users className="mr-2 h-4 w-4" />
              Sócios PF ({socios.length})
            </TabsTrigger>
            <TabsTrigger value="empresas-grupo">
              <Building2 className="mr-2 h-4 w-4" />
              Empresas do Grupo ({empresasRel.length})
            </TabsTrigger>
            {/* Sprint Fluxo-Unificado-Retirada (30/06/2026): aba nova.
                Badge âmbar destaca quando há retiradas pendentes (call to action
                sutil sem gritar). Neutro quando fila zerada. */}
            <TabsTrigger value="retiradas-pendentes">
              <span className="mr-2 text-sm" aria-hidden>🌉</span>
              Retiradas pendentes
              {retiradasCount !== null && retiradasCount > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-2 h-4 min-w-[18px] px-1 text-[10px] bg-amber-100 text-amber-800 border-amber-200"
                >
                  {retiradasCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* === ABA SÓCIOS PF === */}
          <TabsContent value="socios-pf" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    Sócios e Familiares (PF)
                    <Badge variant="outline" className="text-[10px]">{socios.length}</Badge>
                  </CardTitle>
                  <Button size="sm" onClick={() => setShowSocioForm(!showSocioForm)}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Adicionar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {showSocioForm && (
                  <SocioForm
                    empresaId={empresaId}
                    onCreated={() => {
                      setShowSocioForm(false)
                      load()
                    }}
                    onCancel={() => setShowSocioForm(false)}
                  />
                )}

                {loading ? (
                  <p className="text-sm text-zinc-500">Carregando…</p>
                ) : socios.length === 0 ? (
                  <p className="text-sm text-zinc-500 text-center py-6">
                    Nenhum sócio cadastrado. Adicione seu próprio CPF e chaves Pix pra começar.
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="py-2 text-left">Nome</th>
                        <th className="py-2 text-left">CPF</th>
                        <th className="py-2 text-left">Papel</th>
                        <th className="py-2 text-right">Suas pontes</th>
                        <th className="py-2 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {socios.map((s) => (
                        <tr key={s.id} className="border-b border-slate-100">
                          <td className="py-3 font-medium text-slate-900">
                            <Link
                              href={`/empresas/${empresaId}/socios/${s.id}`}
                              className="hover:text-primary hover:underline"
                            >
                              {s.nome}
                            </Link>
                          </td>
                          <td className="py-3 text-slate-700">{maskCpf(s.cpf)}</td>
                          <td className="py-3">
                            <Badge variant="outline" className="text-[10px]">
                              {PAPEL_LABELS[s.papel] ?? s.papel}
                            </Badge>
                          </td>
                          <td className="py-3 text-right">
                            {s.suasPontesCount === 0 ? (
                              <span className="text-slate-400">—</span>
                            ) : (
                              <span className="font-medium text-emerald-600">
                                {formatBRL(s.suasPontesAmount)}
                                <span className="ml-1 text-xs text-slate-500">
                                  ({s.suasPontesCount})
                                </span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Link href={`/empresas/${empresaId}/socios/${s.id}`}>
                                <Button variant="ghost" size="sm">
                                  <ArrowRight className="h-4 w-4" />
                                </Button>
                              </Link>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteSocio(s.id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === ABA EMPRESAS DO GRUPO === */}
          <TabsContent value="empresas-grupo" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    Empresas Relacionadas (Mesmo Grupo)
                    <Badge variant="outline" className="text-[10px]">{empresasRel.length}</Badge>
                  </CardTitle>
                  <Button size="sm" onClick={() => setShowEmpresaForm(!showEmpresaForm)}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Adicionar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {showEmpresaForm && (
                  <EmpresaRelForm
                    empresaId={empresaId}
                    onCreated={() => {
                      setShowEmpresaForm(false)
                      load()
                    }}
                    onCancel={() => setShowEmpresaForm(false)}
                  />
                )}

                {loading ? (
                  <p className="text-sm text-zinc-500">Carregando…</p>
                ) : empresasRel.length === 0 ? (
                  <p className="text-sm text-zinc-500 text-center py-6">
                    Nenhum CNPJ do grupo cadastrado. Adicione pra detectar transferências
                    entre empresas e evitar dupla contagem no DRE.
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="py-2 text-left">Nome Fantasia</th>
                        <th className="py-2 text-left">CNPJ</th>
                        <th className="py-2 text-left">Tipo Relação</th>
                        <th className="py-2 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {empresasRel.map((e) => (
                        <tr key={e.id} className="border-b border-slate-100">
                          <td className="py-3 font-medium text-slate-900">{e.nomeFantasia}</td>
                          <td className="py-3 text-slate-700">{maskCnpj(e.cnpjRelacionado)}</td>
                          <td className="py-3">
                            <Badge variant="outline" className="text-[10px]">
                              {RELACAO_LABELS[e.relacao] ?? e.relacao}
                            </Badge>
                          </td>
                          <td className="py-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteEmpresa(e.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === ABA RETIRADAS PENDENTES === */}
          <TabsContent value="retiradas-pendentes" className="space-y-4">
            <RetiradasPendentesTab
              empresaId={empresaId}
              defaultSocioPFId={socios.length === 1 ? socios[0].id : null}
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}

// =================== FORMS (inline pra reusar estrutura) ===================

interface SocioFormProps {
  empresaId: string
  onCreated: () => void
  onCancel: () => void
}

function SocioForm({ empresaId, onCreated, onCancel }: SocioFormProps) {
  const { toast } = useToast()
  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [papel, setPapel] = useState('SOCIO')
  const [pixKeysStr, setPixKeysStr] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      const pixKeys = pixKeysStr.split(',').map((s) => s.trim()).filter(Boolean)
      const res = await fetch(`/api/empresas/${empresaId}/socios-pf`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ nome: nome.trim(), cpf: cpf.trim() || null, papel, pixKeys }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.erro ?? 'Erro ao criar')
      }
      toast({ title: 'Sócio adicionado' })
      onCreated()
    } catch (err) {
      toast({
        title: 'Erro',
        description: (err as Error).message,
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mb-4 space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Nome completo *</Label>
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Yussef Abu Zahry Musa"
            required
          />
          <p className="mt-1 text-[10px] text-slate-500 leading-snug">
            Use o nome <strong>completo</strong>, como aparece nos extratos bancários.
            O sistema usa pra detectar movimentações próprias (transferências, PIX) e separá-las
            das vendas no DRE.
          </p>
        </div>
        <div>
          <Label className="text-xs">CPF</Label>
          <Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="600.258.890-60" />
          <p className="mt-1 text-[10px] text-slate-500 leading-snug">
            Sinal forte pra detectar transferências do dono (quando o banco
            inclui o CPF na descrição do PIX).
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Papel</Label>
          <Select value={papel} onValueChange={setPapel}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SOCIO">Sócio</SelectItem>
              <SelectItem value="ADMINISTRADOR">Administrador</SelectItem>
              <SelectItem value="FAMILIAR">Familiar</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Chaves Pix (separadas por vírgula)</Label>
          <Input
            value={pixKeysStr}
            onChange={(e) => setPixKeysStr(e.target.value)}
            placeholder="email@x.com, 51-99999-9999"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? 'Salvando…' : 'Adicionar'}
        </Button>
      </div>
    </form>
  )
}

interface EmpresaRelFormProps {
  empresaId: string
  onCreated: () => void
  onCancel: () => void
}

function EmpresaRelForm({ empresaId, onCreated, onCancel }: EmpresaRelFormProps) {
  const { toast } = useToast()
  const [nomeFantasia, setNomeFantasia] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [relacao, setRelacao] = useState('MESMO_GRUPO')
  const [pixKeysStr, setPixKeysStr] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const pixKeys = pixKeysStr.split(',').map((s) => s.trim()).filter(Boolean)
      const res = await fetch(`/api/empresas/${empresaId}/empresas-relacionadas`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          nomeFantasia: nomeFantasia.trim(),
          cnpjRelacionado: cnpj.trim(),
          relacao,
          pixKeys,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.erro ?? 'Erro ao criar')
      }
      toast({ title: 'Empresa do grupo adicionada' })
      onCreated()
    } catch (err) {
      toast({
        title: 'Erro',
        description: (err as Error).message,
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mb-4 space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Nome Fantasia *</Label>
          <Input value={nomeFantasia} onChange={(e) => setNomeFantasia(e.target.value)} required />
        </div>
        <div>
          <Label className="text-xs">CNPJ *</Label>
          <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} required placeholder="00.000.000/0000-00" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Tipo de Relação</Label>
          <Select value={relacao} onValueChange={setRelacao}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MESMO_GRUPO">Mesmo grupo</SelectItem>
              <SelectItem value="SOCIO_COMUM">Sócio comum</SelectItem>
              <SelectItem value="CONTROLADA">Controlada</SelectItem>
              <SelectItem value="CONTROLADORA">Controladora</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Chaves Pix (vírgula)</Label>
          <Input
            value={pixKeysStr}
            onChange={(e) => setPixKeysStr(e.target.value)}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? 'Salvando…' : 'Adicionar'}
        </Button>
      </div>
    </form>
  )
}
