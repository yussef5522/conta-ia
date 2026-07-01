'use client'

// Sprint Unificar Sócios — Cliente da tela /socios unificada.
// Sprint Redesign-Socios (01/07/2026) — Mercury/Ramp/Linear consistente.
//
// Tabs finais:
//  1. Sócios PF (cadastro + coluna "Retiradas" filtrada por privacidade)
//  2. Retiradas pendentes (fila da Sprint Fluxo-Unificado-Retirada 30/06)
//
// Colapsados em blocos discretos (features dormentes, 0 uso em toda prod):
//  - Empresas do Grupo (0/prod) → botão "Ver empresas do grupo"
//  - Detecção automática de Pix → rodapé/config discreto
//
// Nomenclatura visível ao usuário: "Retirada" (não "Ponte") — model/URL
// continuam como bridges/pontes.
//
// Reuso: endpoints /socios-pf + /empresas-relacionadas + /recategorize-pix
// intactos. Privacidade Fatia 4 preservada.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Users, Building2, Plus, Trash2, ArrowRight, Loader2, Wand2, ChevronDown } from 'lucide-react'
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
  // Sprint Fluxo-Unificado-Retirada (30/06/2026): contador da fila usado
  // no badge da aba. Fetch leve, cache 60s no endpoint.
  const [retiradasCount, setRetiradasCount] = useState<number | null>(null)
  // Sprint Redesign-Socios (01/07/2026): blocos discretos colapsáveis
  // (features dormentes — Empresas do Grupo 0/prod, Detecção Pix 0/prod).
  const [showEmpresasGrupo, setShowEmpresasGrupo] = useState(false)
  const [showPixConfig, setShowPixConfig] = useState(false)

  // Sprint Redesign-Socios (01/07/2026): toast "Unificação" removido (Sprint
  // Unificar Sócios era 03/06 — 28 dias, 100% users já viram).

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

      <div className="container mx-auto max-w-6xl px-4 py-6 space-y-5">
        {/* Sprint Redesign-Socios (01/07/2026): banner Privacidade discreto —
            info em 1 linha compacta com ícone pequeno. Antes era Card grande. */}
        <div className="flex items-start gap-2 text-xs text-slate-500">
          <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
          <p className="leading-relaxed">
            Cadastros (CPF, papel, chaves Pix) são visíveis a todos da empresa.
            As <strong className="font-medium text-slate-700">retiradas</strong>{' '}
            que cada sócio recebeu são privadas — você só vê as suas.
          </p>
        </div>

        {/* Tabs — 2 principais. "Empresas do Grupo" e "Detecção Pix" agora
            ficam em blocos colapsáveis no rodapé. */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="socios-pf">
              <Users className="mr-2 h-4 w-4" />
              Sócios PF ({socios.length})
            </TabsTrigger>
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

                {/* Sprint Redesign-Socios (01/07/2026): tabela premium
                    (tabular-nums, hover suave, coluna "Retiradas" no lugar
                    de "Suas pontes"). Nomenclatura visível ao usuário. */}
                {loading ? (
                  <div className="space-y-2 py-3">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="h-9 animate-pulse rounded bg-slate-50" />
                    ))}
                  </div>
                ) : socios.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">
                    Nenhum sócio cadastrado. Adicione seu próprio CPF e chaves Pix pra começar.
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="py-2 text-left font-medium">Nome</th>
                        <th className="py-2 text-left font-medium">CPF</th>
                        <th className="py-2 text-left font-medium">Papel</th>
                        <th className="py-2 text-right font-medium">Retiradas</th>
                        <th className="py-2 text-right font-medium">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {socios.map((s) => (
                        <tr
                          key={s.id}
                          className="group border-b border-slate-100 transition-colors hover:bg-slate-50/60"
                        >
                          <td className="py-3 font-medium text-slate-900">
                            <Link
                              href={`/empresas/${empresaId}/socios/${s.id}`}
                              className="transition-colors hover:text-primary"
                            >
                              {s.nome}
                            </Link>
                          </td>
                          <td className="py-3 tabular-nums text-slate-600">
                            {maskCpf(s.cpf)}
                          </td>
                          <td className="py-3">
                            <Badge variant="outline" className="text-[10px] font-normal">
                              {PAPEL_LABELS[s.papel] ?? s.papel}
                            </Badge>
                          </td>
                          <td className="py-3 text-right">
                            {s.suasPontesCount === 0 ? (
                              <span className="text-slate-400">—</span>
                            ) : (
                              <span className="tabular-nums font-medium text-emerald-600">
                                {formatBRL(s.suasPontesAmount)}
                                <span className="ml-1 text-xs font-normal text-slate-400">
                                  ({s.suasPontesCount})
                                </span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                              <Link
                                href={`/empresas/${empresaId}/socios/${s.id}`}
                                aria-label={`Ver detalhes de ${s.nome}`}
                              >
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                  <ArrowRight className="h-3.5 w-3.5" />
                                </Button>
                              </Link>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteSocio(s.id)}
                                aria-label={`Excluir ${s.nome}`}
                                className="h-7 w-7 p-0 text-rose-500 hover:bg-rose-50 hover:text-rose-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
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

          {/* === ABA RETIRADAS PENDENTES === */}
          <TabsContent value="retiradas-pendentes" className="space-y-4">
            <RetiradasPendentesTab
              empresaId={empresaId}
              defaultSocioPFId={socios.length === 1 ? socios[0].id : null}
            />
          </TabsContent>
        </Tabs>

        {/* Sprint Redesign-Socios (01/07/2026): blocos colapsáveis pra features
            dormentes (0 uso em toda prod, 01/07/2026). CRUD intacto,
            só sai da entrada principal. Discreto no rodapé. */}
        <div className="mt-8 space-y-2 border-t border-slate-100 pt-6">
          {/* Empresas do Grupo — colapsável */}
          <button
            type="button"
            onClick={() => setShowEmpresasGrupo((v) => !v)}
            className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-xs text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
            aria-expanded={showEmpresasGrupo}
          >
            <span className="inline-flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5" aria-hidden />
              Empresas do grupo ({empresasRel.length})
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${
                showEmpresasGrupo ? 'rotate-180' : ''
              }`}
              aria-hidden
            />
          </button>
          {showEmpresasGrupo && (
            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-sm font-medium text-slate-700">
                    CNPJs do mesmo grupo
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowEmpresaForm(!showEmpresaForm)}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Adicionar
                  </Button>
                </div>
                <p className="text-xs text-slate-500">
                  Cadastre CNPJs do mesmo grupo pra detectar transferências
                  automaticamente e evitar dupla contagem no DRE.
                </p>
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
                  <div className="space-y-2 py-2">
                    {[0, 1].map((i) => (
                      <div key={i} className="h-8 animate-pulse rounded bg-slate-50" />
                    ))}
                  </div>
                ) : empresasRel.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">
                    Nenhum CNPJ do grupo cadastrado.
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="py-2 text-left font-medium">Nome Fantasia</th>
                        <th className="py-2 text-left font-medium">CNPJ</th>
                        <th className="py-2 text-left font-medium">Relação</th>
                        <th className="py-2 text-right font-medium">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {empresasRel.map((e) => (
                        <tr
                          key={e.id}
                          className="group border-b border-slate-100 transition-colors hover:bg-slate-50/60"
                        >
                          <td className="py-3 font-medium text-slate-900">{e.nomeFantasia}</td>
                          <td className="py-3 tabular-nums text-slate-600">
                            {maskCnpj(e.cnpjRelacionado)}
                          </td>
                          <td className="py-3">
                            <Badge variant="outline" className="text-[10px] font-normal">
                              {RELACAO_LABELS[e.relacao] ?? e.relacao}
                            </Badge>
                          </td>
                          <td className="py-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteEmpresa(e.id)}
                              aria-label={`Excluir ${e.nomeFantasia}`}
                              className="h-7 w-7 p-0 text-rose-500 opacity-60 transition-opacity hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          )}

          {/* Detecção Pix — colapsável */}
          <button
            type="button"
            onClick={() => setShowPixConfig((v) => !v)}
            className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-xs text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
            aria-expanded={showPixConfig}
          >
            <span className="inline-flex items-center gap-2">
              <Wand2 className="h-3.5 w-3.5" aria-hidden />
              Detecção automática de Pix
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${
                showPixConfig ? 'rotate-180' : ''
              }`}
              aria-hidden
            />
          </button>
          {showPixConfig && (
            <Card className="border-slate-200">
              <CardContent className="space-y-3 p-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Depende dos cadastros de <strong>chaves Pix</strong> nos sócios
                  (acima) e dos CNPJs do grupo. Quando ativa, categoriza
                  transferências para o CPF/CNPJ do sócio como{' '}
                  <em>Distribuição de Lucros</em> automaticamente. Rodar re-análise
                  aplica em transações antigas.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={recategorizePix}
                  disabled={recategorizing}
                >
                  {recategorizing ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Analisando…
                    </>
                  ) : (
                    <>
                      <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                      Re-analisar transações antigas
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
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
