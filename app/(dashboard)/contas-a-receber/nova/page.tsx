'use client'

// Sprint 4.0.1.b — Form criar conta a receber.

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
import { CategoryCombobox } from '@/components/transacoes/category-combobox'
import { createCategoryForPJ } from '@/lib/transacoes/on-create-category'

interface Empresa { id: string; name: string; tradeName: string | null }
interface BankAccount { id: string; name: string; bankName: string | null; companyId: string }
interface Category { id: string; name: string; type: string; color: string | null; dreGroup?: string | null }
interface Customer { id: string; razaoSocial: string; nomeFantasia: string | null }

export default function NovaContaAReceberPage() {
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
  const [customers, setCustomers] = useState<Customer[]>([])

  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [bankAccountId, setBankAccountId] = useState('')
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
        if (data?.categorias) setCategories(data.categorias.filter((c: Category) => c.type === 'INCOME'))
      })
    fetch(`/api/empresas/${empresaId}/clientes?soAtivas=true`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.customers) setCustomers(data.customers)
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
    setSaving(true)
    try {
      const res = await fetch('/api/contas-a-receber', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: empresaId,
          description: descricao,
          amount: Number(valor),
          dueDate,
          customerId: customerId || null,
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
      toast({ title: 'Conta a receber criada', description: descricao })
      router.push(`/contas-a-receber?empresaId=${empresaId}`)
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha de rede.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Header title="Nova conta a receber" description="Cadastre um recebimento esperado">
        <Button size="sm" variant="outline" asChild>
          <Link href={`/contas-a-receber${empresaId ? `?empresaId=${empresaId}` : ''}`}>
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
              placeholder="Ex: Mensalidade aluno João — junho/2026"
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
            <label className="text-xs">Cliente (opcional)</label>
            <Select value={customerId} onValueChange={setCustomerId} disabled={!empresaId}>
              <SelectTrigger>
                <SelectValue placeholder="Sem cliente vinculado" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nomeFantasia ?? c.razaoSocial}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs">Categoria (opcional)</label>
            <CategoryCombobox
              value={categoryId || null}
              categorias={categories.map((c) => ({
                id: c.id,
                name: c.name,
                color: c.color,
                type: c.type,
                dreGroup: c.dreGroup ?? null,
              }))}
              onChange={(v) => setCategoryId(v ?? '')}
              onCreate={async (name) => {
                if (!empresaId) return null
                const cat = await createCategoryForPJ(empresaId, name, 'INCOME')
                if (cat) setCategories((prev) => [...prev, { id: cat.id, name: cat.name, type: cat.type ?? 'INCOME', color: cat.color ?? null, dreGroup: cat.dreGroup ?? null }])
                return cat
              }}
              disabled={!empresaId}
              placeholder="Sem categoria"
              className="h-9 w-full justify-between border-input"
              ariaLabel="Categoria"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs">Conta bancária prevista (opcional)</label>
            <Select value={bankAccountId} onValueChange={setBankAccountId} disabled={!empresaId}>
              <SelectTrigger>
                <SelectValue placeholder="Decidir ao receber" />
              </SelectTrigger>
              <SelectContent>
                {bankAccounts.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.bankName ?? b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              <Link href={`/contas-a-receber${empresaId ? `?empresaId=${empresaId}` : ''}`}>
                Cancelar
              </Link>
            </Button>
            <Button onClick={salvar} disabled={saving}>
              {saving ? 'Salvando…' : 'Criar conta a receber'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
