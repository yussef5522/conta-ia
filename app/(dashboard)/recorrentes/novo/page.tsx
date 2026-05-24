'use client'

// Sprint 4.0.1.b — Form novo schedule recorrente.

import { useEffect, useState, useMemo, Suspense } from 'react'
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
import { calculateNextDueDates } from '@/lib/recurrence/next-date'

interface Empresa { id: string; name: string; tradeName: string | null }
interface Category { id: string; name: string; type: string; color: string | null }
interface Supplier { id: string; razaoSocial: string; nomeFantasia: string | null }
interface Customer { id: string; razaoSocial: string; nomeFantasia: string | null }

export default function NovoRecorrentePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Carregando…</div>}>
      <NovoRecorrenteInner />
    </Suspense>
  )
}

function NovoRecorrenteInner() {
  const router = useRouter()
  const { toast } = useToast()
  const searchParams = useSearchParams()

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaId, setEmpresaId] = useState(searchParams.get('empresaId') ?? '')
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])

  const [type, setType] = useState<'PAYABLE' | 'RECEIVABLE'>('PAYABLE')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [frequency, setFrequency] = useState<'MONTHLY' | 'WEEKLY' | 'QUARTERLY' | 'YEARLY'>('MONTHLY')
  const [dayOfMonth, setDayOfMonth] = useState('5')
  const [dayOfWeek, setDayOfWeek] = useState('1')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [categoryId, setCategoryId] = useState('')
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
    fetch(`/api/empresas/${empresaId}/categorias?soAtivas=true`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.categorias) {
          const targetType = type === 'PAYABLE' ? 'EXPENSE' : 'INCOME'
          setCategories(data.categorias.filter((c: Category) => c.type === targetType))
        }
      })
    fetch(`/api/empresas/${empresaId}/fornecedores`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.fornecedores) setSuppliers(data.fornecedores) })
    fetch(`/api/empresas/${empresaId}/clientes?soAtivas=true`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.customers) setCustomers(data.customers) })
  }, [empresaId, type])

  // Preview "próximas 3 gerações"
  const previewDates = useMemo(() => {
    if (!startDate) return []
    const startD = new Date(startDate)
    if (isNaN(startD.getTime())) return []
    try {
      return calculateNextDueDates(
        {
          frequency,
          dayOfMonth: ['MONTHLY', 'QUARTERLY', 'YEARLY'].includes(frequency) ? Number(dayOfMonth) || null : null,
          dayOfWeek: frequency === 'WEEKLY' ? Number(dayOfWeek) : null,
          startDate: startD,
          endDate: endDate ? new Date(endDate) : null,
        },
        new Date(),
        3,
      )
    } catch {
      return []
    }
  }, [startDate, frequency, dayOfMonth, dayOfWeek, endDate])

  async function salvar() {
    if (!empresaId || !descricao || !valor || !startDate) {
      toast({
        variant: 'destructive',
        title: 'Preencha os campos obrigatórios',
        description: 'Empresa, descrição, valor e data de início.',
      })
      return
    }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        companyId: empresaId,
        type,
        description: descricao,
        amount: Number(valor),
        frequency,
        startDate,
        endDate: endDate || null,
        supplierId: type === 'PAYABLE' && supplierId ? supplierId : null,
        customerId: type === 'RECEIVABLE' && customerId ? customerId : null,
        categoryId: categoryId || null,
        notes: notes || null,
      }
      if (['MONTHLY', 'QUARTERLY', 'YEARLY'].includes(frequency)) {
        payload.dayOfMonth = Number(dayOfMonth)
      }
      if (frequency === 'WEEKLY') {
        payload.dayOfWeek = Number(dayOfWeek)
      }
      const res = await fetch('/api/recorrentes', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
      toast({ title: 'Recorrente criado', description: descricao })
      router.push(`/recorrentes?empresaId=${empresaId}`)
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha de rede.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Header title="Novo recorrente" description="Gera lançamentos automaticamente no vencimento">
        <Button size="sm" variant="outline" asChild>
          <Link href={`/recorrentes${empresaId ? `?empresaId=${empresaId}` : ''}`}>
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
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.tradeName ?? e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs">Tipo <span className="text-red-500">*</span></label>
              <Select value={type} onValueChange={(v) => setType(v as 'PAYABLE' | 'RECEIVABLE')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PAYABLE">A pagar (despesa recorrente)</SelectItem>
                  <SelectItem value="RECEIVABLE">A receber (receita recorrente)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs">Frequência <span className="text-red-500">*</span></label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as typeof frequency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">Mensal</SelectItem>
                  <SelectItem value="WEEKLY">Semanal</SelectItem>
                  <SelectItem value="QUARTERLY">Trimestral</SelectItem>
                  <SelectItem value="YEARLY">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs">Descrição <span className="text-red-500">*</span></label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder={type === 'PAYABLE' ? 'Ex: Folha mensal' : 'Ex: Mensalidade aluno X'}
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
            {['MONTHLY', 'QUARTERLY', 'YEARLY'].includes(frequency) ? (
              <div className="space-y-1.5">
                <label className="text-xs">Dia do mês <span className="text-red-500">*</span></label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs">Dia da semana <span className="text-red-500">*</span></label>
                <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Domingo</SelectItem>
                    <SelectItem value="1">Segunda</SelectItem>
                    <SelectItem value="2">Terça</SelectItem>
                    <SelectItem value="3">Quarta</SelectItem>
                    <SelectItem value="4">Quinta</SelectItem>
                    <SelectItem value="5">Sexta</SelectItem>
                    <SelectItem value="6">Sábado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs">Início da vigência <span className="text-red-500">*</span></label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs">Fim da vigência (opcional)</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          {/* Preview */}
          {previewDates.length > 0 && (
            <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs">
              <p className="font-medium mb-1">Próximas gerações:</p>
              <ul className="text-muted-foreground space-y-0.5">
                {previewDates.map((d, i) => (
                  <li key={i}>· {d.toLocaleDateString('pt-BR')}</li>
                ))}
              </ul>
            </div>
          )}

          {type === 'PAYABLE' && (
            <div className="space-y-1.5">
              <label className="text-xs">Fornecedor (opcional)</label>
              <Select value={supplierId} onValueChange={setSupplierId} disabled={!empresaId}>
                <SelectTrigger><SelectValue placeholder="Sem fornecedor" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nomeFantasia ?? s.razaoSocial}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {type === 'RECEIVABLE' && (
            <div className="space-y-1.5">
              <label className="text-xs">Cliente (opcional)</label>
              <Select value={customerId} onValueChange={setCustomerId} disabled={!empresaId}>
                <SelectTrigger><SelectValue placeholder="Sem cliente" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nomeFantasia ?? c.razaoSocial}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs">Categoria (opcional)</label>
            <Select value={categoryId} onValueChange={setCategoryId} disabled={!empresaId}>
              <SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
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
              <Link href={`/recorrentes${empresaId ? `?empresaId=${empresaId}` : ''}`}>Cancelar</Link>
            </Button>
            <Button onClick={salvar} disabled={saving}>
              {saving ? 'Salvando…' : 'Criar recorrente'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
