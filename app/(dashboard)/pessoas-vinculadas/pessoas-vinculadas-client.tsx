'use client'

// Sprint 5.0.2.h — UI Pessoas Vinculadas (CRUD).

import { useEffect, useState, useCallback } from 'react'
import { Users, Building2, Plus, Trash2, Sparkles, Wand2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Header } from '@/components/layout/header'
import { useToast } from '@/components/ui/use-toast'

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

export function PessoasVinculadasClient({ empresaId, empresaNome }: Props) {
  const { toast } = useToast()
  const [socios, setSocios] = useState<Socio[]>([])
  const [empresasRel, setEmpresasRel] = useState<EmpresaRel[]>([])
  const [loading, setLoading] = useState(true)
  const [showSocioForm, setShowSocioForm] = useState(false)
  const [showEmpresaForm, setShowEmpresaForm] = useState(false)
  const [recategorizing, setRecategorizing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/empresas/${empresaId}/socios-pf`, { credentials: 'include' }),
        fetch(`/api/empresas/${empresaId}/empresas-relacionadas`, { credentials: 'include' }),
      ])
      const d1 = await r1.json()
      const d2 = await r2.json()
      setSocios(d1.socios ?? [])
      setEmpresasRel(d2.empresas ?? [])
    } finally {
      setLoading(false)
    }
  }, [empresaId])

  useEffect(() => {
    load()
  }, [load])

  async function deleteSocio(id: string) {
    if (!confirm('Remover este sócio? A detecção automática deixa de funcionar pra ele.')) return
    const res = await fetch(`/api/empresas/${empresaId}/socios-pf/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (res.ok) {
      toast({ title: 'Sócio removido' })
      load()
    }
  }

  async function recategorizePix() {
    if (
      !confirm(
        'Re-analisar TODAS as transações Pix antigas com os cadastros atuais? Pode demorar alguns segundos.',
      )
    )
      return
    setRecategorizing(true)
    try {
      const res = await fetch(`/api/empresas/${empresaId}/recategorize-pix`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Falha',
          description: data.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      toast({
        title: 'Re-categorização concluída',
        description: `Analisadas: ${data.analisadas} · Sócios PF: ${data.socioPF} · Grupo PJ: ${data.grupoPJ} · Conciliações: ${data.conciliacoes}`,
      })
    } finally {
      setRecategorizing(false)
    }
  }

  async function deleteEmpresa(id: string) {
    if (!confirm('Remover esta empresa relacionada?')) return
    const res = await fetch(`/api/empresas/${empresaId}/empresas-relacionadas/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (res.ok) {
      toast({ title: 'Empresa removida' })
      load()
    }
  }

  return (
    <div className="space-y-6">
      <Header
        title="Pessoas Vinculadas"
        description={`Sócios e CNPJs do grupo — ${empresaNome}`}
      />

      <Card className="bg-indigo-50/40 border-indigo-100">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="text-sm text-zinc-700 flex-1">
              <p className="font-medium text-indigo-900 mb-1">Detecção automática de Pix</p>
              <p>
                Cadastre <strong>seus CPFs (sócios)</strong> e <strong>outros CNPJs do grupo</strong>. O sistema vai
                detectar automaticamente Pix entre vocês e categorizar corretamente como:
              </p>
              <ul className="list-disc list-inside mt-2 text-xs space-y-0.5">
                <li>
                  Pix para CPF de sócio = <strong>Distribuição de Lucros</strong> ou <strong>Pró-labore</strong>
                </li>
                <li>
                  Pix entre seus CNPJs = <strong>Transferência entre Contas</strong> (não é despesa, não infla DRE)
                </li>
              </ul>
            </div>
          </div>
          {(socios.length > 0 || empresasRel.length > 0) && (
            <div className="mt-3 pt-3 border-t border-indigo-100 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-indigo-900">
                Já cadastrou? <strong>Re-analise transações Pix antigas</strong> aplicando os cadastros atuais.
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
          )}
        </CardContent>
      </Card>

      {/* SÓCIOS PF */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-500" />
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
            <div className="space-y-2">
              {socios.map((s) => (
                <div
                  key={s.id}
                  className="rounded-md border bg-white p-3 flex items-start justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-zinc-900">{s.nome}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {PAPEL_LABELS[s.papel] ?? s.papel}
                      </Badge>
                    </div>
                    {s.cpf && (
                      <p className="text-xs text-zinc-500 font-mono mt-1">
                        CPF {formatCPF(s.cpf)}
                      </p>
                    )}
                    {s.pixKeys.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {s.pixKeys.map((k, i) => (
                          <Badge key={i} variant="outline" className="text-[10px] font-mono">
                            {k}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteSocio(s.id)}
                    className="text-red-600 shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* EMPRESAS RELACIONADAS */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="h-4 w-4 text-emerald-500" />
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
              Nenhum CNPJ relacionado. Cadastre outras empresas do seu grupo.
            </p>
          ) : (
            <div className="space-y-2">
              {empresasRel.map((e) => (
                <div
                  key={e.id}
                  className="rounded-md border bg-white p-3 flex items-start justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-zinc-900">
                        {e.nomeFantasia}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {RELACAO_LABELS[e.relacao] ?? e.relacao}
                      </Badge>
                    </div>
                    <p className="text-xs text-zinc-500 font-mono mt-1">
                      CNPJ {formatCNPJ(e.cnpjRelacionado)}
                    </p>
                    {e.pixKeys.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {e.pixKeys.map((k, i) => (
                          <Badge key={i} variant="outline" className="text-[10px] font-mono">
                            {k}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteEmpresa(e.id)}
                    className="text-red-600 shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SocioForm({
  empresaId,
  onCreated,
  onCancel,
}: {
  empresaId: string
  onCreated: () => void
  onCancel: () => void
}) {
  const { toast } = useToast()
  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [pixKeysRaw, setPixKeysRaw] = useState('')
  const [papel, setPapel] = useState('SOCIO')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const cpfDigits = cpf.replace(/\D/g, '')
      const pixKeys = pixKeysRaw
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
      const res = await fetch(`/api/empresas/${empresaId}/socios-pf`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          cpf: cpfDigits.length === 11 ? cpfDigits : null,
          pixKeys,
          papel,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Erro', description: data.erro ?? `HTTP ${res.status}` })
        return
      }
      toast({ title: 'Sócio cadastrado' })
      onCreated()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-md border bg-zinc-50/50 p-4 mb-4 space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs">Nome <span className="text-red-500">*</span></label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Yussef Musa" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs">CPF (só dígitos)</label>
          <Input
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            placeholder="12345678900"
            maxLength={14}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs">Papel</label>
        <Select value={papel} onValueChange={setPapel}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SOCIO">Sócio (Distribuição de Lucros)</SelectItem>
            <SelectItem value="ADMINISTRADOR">Administrador (Pró-labore)</SelectItem>
            <SelectItem value="FAMILIAR">Familiar (Pró-labore)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs">Chaves Pix (uma por linha ou separadas por vírgula)</label>
        <textarea
          value={pixKeysRaw}
          onChange={(e) => setPixKeysRaw(e.target.value)}
          placeholder="email@exemplo.com&#10;11999998888&#10;12345678900"
          className="w-full rounded-md border px-3 py-2 text-sm min-h-[80px] font-mono"
        />
        <p className="text-[10px] text-zinc-500">
          Email, telefone, CPF ou chave aleatória. Usadas pra detectar Pix automaticamente.
        </p>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={save} disabled={saving || !nome.trim()}>
          {saving ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </div>
  )
}

function EmpresaRelForm({
  empresaId,
  onCreated,
  onCancel,
}: {
  empresaId: string
  onCreated: () => void
  onCancel: () => void
}) {
  const { toast } = useToast()
  const [cnpj, setCnpj] = useState('')
  const [nomeFantasia, setNomeFantasia] = useState('')
  const [pixKeysRaw, setPixKeysRaw] = useState('')
  const [relacao, setRelacao] = useState('MESMO_GRUPO')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const cnpjDigits = cnpj.replace(/\D/g, '')
      if (cnpjDigits.length !== 14) {
        toast({ variant: 'destructive', title: 'CNPJ inválido', description: 'Deve ter 14 dígitos' })
        return
      }
      const pixKeys = pixKeysRaw
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
      const res = await fetch(`/api/empresas/${empresaId}/empresas-relacionadas`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cnpjRelacionado: cnpjDigits,
          nomeFantasia,
          pixKeys,
          relacao,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Erro', description: data.erro ?? `HTTP ${res.status}` })
        return
      }
      toast({ title: 'Empresa relacionada cadastrada' })
      onCreated()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-md border bg-zinc-50/50 p-4 mb-4 space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs">CNPJ <span className="text-red-500">*</span></label>
          <Input
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            placeholder="12345678000190"
            maxLength={18}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs">Nome fantasia <span className="text-red-500">*</span></label>
          <Input
            value={nomeFantasia}
            onChange={(e) => setNomeFantasia(e.target.value)}
            placeholder="Ex: Academia Forca Total"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs">Relação</label>
        <Select value={relacao} onValueChange={setRelacao}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="MESMO_GRUPO">Mesmo grupo</SelectItem>
            <SelectItem value="SOCIO_COMUM">Sócio em comum</SelectItem>
            <SelectItem value="CONTROLADA">Controlada por esta</SelectItem>
            <SelectItem value="CONTROLADORA">Controla esta</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs">Chaves Pix do CNPJ relacionado</label>
        <textarea
          value={pixKeysRaw}
          onChange={(e) => setPixKeysRaw(e.target.value)}
          placeholder="email@empresa.com&#10;12345678000190"
          className="w-full rounded-md border px-3 py-2 text-sm min-h-[80px] font-mono"
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={save} disabled={saving || !cnpj || !nomeFantasia.trim()}>
          {saving ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </div>
  )
}

function formatCPF(d: string): string {
  if (d.length !== 11) return d
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function formatCNPJ(d: string): string {
  if (d.length !== 14) return d
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}
