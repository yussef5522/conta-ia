'use client'

// Sprint 4.0.1.b — Form novo cliente.

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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

interface Empresa { id: string; name: string; tradeName: string | null }

export default function NovoClientePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Carregando…</div>}>
      <NovoClienteInner />
    </Suspense>
  )
}

function NovoClienteInner() {
  const router = useRouter()
  const { toast } = useToast()
  const searchParams = useSearchParams()

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaId, setEmpresaId] = useState(searchParams.get('empresaId') ?? '')

  const [razaoSocial, setRazaoSocial] = useState('')
  const [nomeFantasia, setNomeFantasia] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [cpf, setCpf] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/empresas')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.empresas) {
          setEmpresas(data.empresas)
          if (!empresaId && data.empresas.length === 1) {
            setEmpresaId(data.empresas[0].id)
          }
        }
      })
  }, [empresaId])

  async function salvar() {
    if (!empresaId || !razaoSocial) {
      toast({
        variant: 'destructive',
        title: 'Preencha os campos obrigatórios',
        description: 'Empresa e razão social são necessários.',
      })
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/empresas/${empresaId}/clientes`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razaoSocial,
          nomeFantasia: nomeFantasia || null,
          cnpj: cnpj.replace(/\D/g, '') || null,
          cpf: cpf.replace(/\D/g, '') || null,
          email: email || null,
          phone: phone || null,
          notes: notes || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast({
          variant: 'destructive',
          title: 'Falha ao criar',
          description: data.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      toast({ title: 'Cliente criado', description: razaoSocial })
      router.push(`/clientes?empresaId=${empresaId}`)
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha de rede.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Header title="Novo cliente" description="Cadastre um cliente pra vincular em Contas a Receber">
        <Button size="sm" variant="outline" asChild>
          <Link href={`/clientes${empresaId ? `?empresaId=${empresaId}` : ''}`}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Voltar
          </Link>
        </Button>
      </Header>

      <Card>
        <CardContent className="py-6 space-y-4">
          {empresas.length > 1 && (
            <div className="space-y-1.5">
              <label className="text-xs">Empresa <span className="text-red-500">*</span></label>
              <Select value={empresaId} onValueChange={setEmpresaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione empresa…" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.tradeName ?? e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs">Razão social <span className="text-red-500">*</span></label>
            <Input
              value={razaoSocial}
              onChange={(e) => setRazaoSocial(e.target.value)}
              placeholder="Ex: João Silva ME"
              maxLength={200}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs">Nome fantasia (opcional)</label>
            <Input
              value={nomeFantasia}
              onChange={(e) => setNomeFantasia(e.target.value)}
              placeholder="Ex: João Mercado"
              maxLength={200}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs">CNPJ (opcional)</label>
              <Input
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs">CPF (opcional)</label>
              <Input
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                placeholder="000.000.000-00"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs">Email (opcional)</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contato@cliente.com"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs">Telefone (opcional)</label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs">Observações (opcional)</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas internas"
              maxLength={1000}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" asChild disabled={saving}>
              <Link href={`/clientes${empresaId ? `?empresaId=${empresaId}` : ''}`}>
                Cancelar
              </Link>
            </Button>
            <Button onClick={salvar} disabled={saving || !empresaId || !razaoSocial}>
              {saving ? 'Salvando…' : 'Criar cliente'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
