'use client'

// Sprint 4.0.1.b — Clientes (Customer) CRUD.

import { useEffect, useState, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Users, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Header } from '@/components/layout/header'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'

interface Customer {
  id: string
  razaoSocial: string
  nomeFantasia: string | null
  cnpj: string | null
  cpf: string | null
  email: string | null
  phone: string | null
  isActive: boolean
  _count: { transactions: number }
}

interface Empresa { id: string; name: string; tradeName: string | null }

export default function ClientesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Carregando…</div>}>
      <ClientesInner />
    </Suspense>
  )
}

function ClientesInner() {
  const router = useRouter()
  const { toast } = useToast()
  const searchParams = useSearchParams()

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaId, setEmpresaId] = useState<string>(searchParams.get('empresaId') ?? '')

  // Sprint 5.0.3.3 — Sincroniza state com searchParams.empresaId quando
  // WorkspaceSwitcher troca empresa.
  useEffect(() => {
    const urlEmpresaId = searchParams.get('empresaId') ?? ''
    if (urlEmpresaId && urlEmpresaId !== empresaId) {
      setEmpresaId(urlEmpresaId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [buscaDebounced, setBuscaDebounced] = useState('')
  const [soAtivas, setSoAtivas] = useState(true)

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

  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca.trim()), 300)
    return () => clearTimeout(t)
  }, [busca])

  const fetchCustomers = useCallback(async () => {
    if (!empresaId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (soAtivas) qs.set('soAtivas', 'true')
      if (buscaDebounced) qs.set('q', buscaDebounced)

      const res = await fetch(`/api/empresas/${empresaId}/clientes?${qs}`, {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setCustomers(data.customers)
      }
    } finally {
      setLoading(false)
    }
  }, [empresaId, buscaDebounced, soAtivas])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])

  useEffect(() => {
    if (!empresaId) return
    const sp = new URLSearchParams()
    sp.set('empresaId', empresaId)
    router.replace(`?${sp}`, { scroll: false })
  }, [empresaId, router])

  async function toggleAtivo(c: Customer) {
    try {
      const res = await fetch(`/api/clientes/${c.id}`, {
        method: c.isActive ? 'DELETE' : 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: c.isActive ? undefined : JSON.stringify({ razaoSocial: c.razaoSocial }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast({
          variant: 'destructive',
          title: 'Falha',
          description: data.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      toast({ title: c.isActive ? 'Cliente desativado' : 'Cliente reativado' })
      void fetchCustomers()
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha de rede.' })
    }
  }

  function formatDoc(c: Customer): string {
    if (c.cnpj) return c.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
    if (c.cpf) return c.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    return '—'
  }

  return (
    <div className="space-y-6">
      <Header
        title="Clientes"
        description={
          empresaId
            ? `${customers.length} cliente${customers.length !== 1 ? 's' : ''}`
            : 'Selecione uma empresa pra ver clientes'
        }
      >
        <Button size="sm" asChild disabled={!empresaId}>
          <Link href={`/clientes/novo${empresaId ? `?empresaId=${empresaId}` : ''}`}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Novo cliente
          </Link>
        </Button>
      </Header>

      {empresas.length > 1 && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Empresa:</span>
              <Select value={empresaId} onValueChange={setEmpresaId}>
                <SelectTrigger className="w-auto min-w-[280px]">
                  <SelectValue placeholder="Selecione…" />
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
          </CardContent>
        </Card>
      )}

      {empresaId && (
        <>
          <Card>
            <CardContent className="py-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    type="text"
                    className="h-8 pl-8 text-sm"
                    placeholder="Buscar por razão social"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                  />
                </div>
                <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Input
                    type="checkbox"
                    className="w-3.5 h-3.5"
                    checked={soAtivas}
                    onChange={(e) => setSoAtivas(e.target.checked)}
                  />
                  Só ativos
                </label>
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : customers.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-2" />
                <p className="text-sm">
                  Nenhum cliente cadastrado.{' '}
                  <Link
                    href={`/clientes/novo?empresaId=${empresaId}`}
                    className="text-primary hover:underline"
                  >
                    Cadastrar primeiro cliente
                  </Link>
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-lg overflow-hidden bg-card">
              {customers.map((c, i) => (
                <div
                  key={c.id}
                  className={`flex items-center gap-3 px-4 py-3 hover:bg-muted/30 ${i > 0 ? 'border-t' : ''} ${!c.isActive ? 'opacity-50' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {c.nomeFantasia ?? c.razaoSocial}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-muted-foreground">
                      <span>{formatDoc(c)}</span>
                      {c.email && <span>· {c.email}</span>}
                      {c.phone && <span>· {c.phone}</span>}
                      <span>· {c._count.transactions} tx</span>
                    </div>
                  </div>
                  {!c.isActive && (
                    <Badge variant="outline" className="text-xs">Inativo</Badge>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleAtivo(c)}
                  >
                    {c.isActive ? 'Desativar' : 'Reativar'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
