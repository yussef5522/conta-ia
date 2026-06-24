'use client'

// Sprint 4.0.1.a — Form criar conta a pagar.

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
interface BankAccount { id: string; name: string; bankName: string | null; companyId: string }
interface Category { id: string; name: string; type: string; color: string | null }
interface Supplier { id: string; razaoSocial: string; nomeFantasia: string | null }

export default function NovaContaAPagarPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Carregando…</div>}>
      <NovaContaInner />
    </Suspense>
  )
}

function NovaContaInner() {
  const router = useRouter()
  const { toast } = useToast()
  const searchParams = useSearchParams()

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaId, setEmpresaId] = useState(searchParams.get('empresaId') ?? '')
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])

  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [bankAccountId, setBankAccountId] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Carrega empresas
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
      .catch(() => {})
  }, [empresaId])

  // Carrega dados da empresa (contas, categorias, fornecedores)
  useEffect(() => {
    if (!empresaId) return
    fetch('/api/contas-bancarias')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.contas) {
          setBankAccounts(data.contas.filter((c: BankAccount) => c.companyId === empresaId))
        }
      })
    fetch(`/api/empresas/${empresaId}/categorias?soAtivas=true`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.categorias) setCategories(data.categorias.filter((c: Category) => c.type === 'EXPENSE'))
      })
    fetch(`/api/empresas/${empresaId}/fornecedores`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.fornecedores) setSuppliers(data.fornecedores)
      })
  }, [empresaId])

  async function salvar() {
    if (!empresaId || !descricao || !valor || !dueDate) {
      toast({
        variant: 'destructive',
        title: 'Preencha os campos obrigatórios',
        description: 'Empresa, descrição, valor e vencimento são necessários.',
      })
      return
    }
    // Sprint 13 — fix "This page couldn't load":
    // Tx sem nenhum vínculo (categoria, fornecedor, conta) vira órfã do
    // multi-tenant guard e PATCH/DELETE retornam 404. Exige ≥1 vínculo.
    if (!categoryId && !supplierId && !bankAccountId) {
      toast({
        variant: 'destructive',
        title: 'Defina ao menos um vínculo',
        description:
          'Escolha uma categoria, fornecedor OU conta bancária prevista. Sem isso, a conta fica invisível na listagem.',
      })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/contas-a-pagar', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: empresaId,
          description: descricao,
          amount: Number(valor),
          dueDate,
          supplierId: supplierId || null,
          categoryId: categoryId || null,
          bankAccountId: bankAccountId || null,
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
      toast({ title: 'Conta a pagar criada', description: descricao })
      router.push(`/contas-a-pagar?empresaId=${empresaId}`)
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha de rede.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Header title="Nova conta a pagar" description="Cadastre um compromisso pendente">
        <Button size="sm" variant="outline" asChild>
          <Link href={`/contas-a-pagar${empresaId ? `?empresaId=${empresaId}` : ''}`}>
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
            <label className="text-xs">Descrição <span className="text-red-500">*</span></label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Energia ENERGISA — maio/2026"
              maxLength={255}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs">Valor (R$) <span className="text-red-500">*</span></label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs">Vencimento <span className="text-red-500">*</span></label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs">Fornecedor (opcional)</label>
            <Select value={supplierId} onValueChange={setSupplierId} disabled={!empresaId}>
              <SelectTrigger>
                <SelectValue placeholder="Sem fornecedor" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nomeFantasia ?? s.razaoSocial}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs">
              Categoria{' '}
              <span className="text-amber-600 dark:text-amber-400">
                (escolha 1: categoria, fornecedor ou conta)
              </span>
            </label>
            <Select value={categoryId} onValueChange={setCategoryId} disabled={!empresaId}>
              <SelectTrigger>
                <SelectValue placeholder="Sem categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs">Conta bancária prevista (opcional)</label>
            <Select value={bankAccountId} onValueChange={setBankAccountId} disabled={!empresaId}>
              <SelectTrigger>
                <SelectValue placeholder="Decidir na hora do pagamento" />
              </SelectTrigger>
              <SelectContent>
                {bankAccounts.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.bankName ?? b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Opcional. Setar conta agora ajuda a projetar saldo, mas você pode decidir só ao efetivar.
            </p>
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
              <Link href={`/contas-a-pagar${empresaId ? `?empresaId=${empresaId}` : ''}`}>
                Cancelar
              </Link>
            </Button>
            <Button onClick={salvar} disabled={saving}>
              {saving ? 'Salvando…' : 'Criar conta a pagar'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
