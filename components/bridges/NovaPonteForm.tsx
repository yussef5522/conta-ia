'use client'

// Sprint Unificar Sócios — Form de criação de ponte reutilizável.
//
// Reaproveitado em /empresas/[id]/pontes/nova (legacy) e
// /empresas/[id]/socios/[socioId] (action=nova-ponte).
//
// Pode receber pre-fill de socioPF.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'
import { BridgeKindRadio } from '@/components/bridges/BridgeKindRadio'
import type { BridgeKind } from '@/lib/bridges/types'
import { CategoryCombobox } from '@/components/transacoes/category-combobox'
import { createCategoryForPF } from '@/lib/transacoes/on-create-category'

export interface PjTx {
  id: string
  date: string
  description: string
  amount: number
  bankAccountName: string | null
}
export interface Profile {
  id: string
  name: string
  type: string
}
export interface Account {
  id: string
  name: string
  bankName?: string | null
}
export interface Category {
  id: string
  name: string
  color?: string | null
  type?: string | null
}

export interface NovaPonteFormProps {
  empresaId: string
  /** SocioPF pré-selecionado (usado em /socios/[id]). */
  socioPFId?: string | null
  /** Onde redirecionar após criar. */
  redirectTo?: string
  /** Texto do botão cancelar (override). */
  cancelHref?: string
  onCreated?: (bridgeId: string) => void
}

export function NovaPonteForm({
  empresaId,
  socioPFId,
  redirectTo,
  cancelHref,
  onCreated,
}: NovaPonteFormProps) {
  const router = useRouter()
  const { toast } = useToast()

  const [pjTxs, setPjTxs] = useState<PjTx[]>([])
  const [pjTxQuery, setPjTxQuery] = useState('')
  const [selectedPjTxId, setSelectedPjTxId] = useState('')
  const [kind, setKind] = useState<BridgeKind>('DISTRIBUICAO')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [profileId, setProfileId] = useState('')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountId, setAccountId] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/empresas/${empresaId}/transacoes?type=DEBIT&pageSize=50`)
      .then((r) => r.json())
      .then((j) => setPjTxs(j.transacoes ?? []))
      .catch(() => {})
  }, [empresaId])

  useEffect(() => {
    fetch('/api/perfis')
      .then((r) => r.json())
      .then((j) => setProfiles((j.profiles ?? []).filter((p: Profile) => p.type === 'OWN')))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!profileId) return
    fetch(`/api/perfis/${profileId}/contas`)
      .then((r) => r.json())
      .then((j) => setAccounts(j.accounts ?? []))
      .catch(() => {})
    fetch(`/api/perfis/${profileId}/categorias?type=INCOME`)
      .then((r) => r.json())
      .then((j) => setCategories(j.categories ?? []))
      .catch(() => {})
  }, [profileId])

  const filteredTxs = pjTxQuery
    ? pjTxs.filter((tx) => tx.description.toLowerCase().includes(pjTxQuery.toLowerCase()))
    : pjTxs.slice(0, 30)
  const selectedPjTx = pjTxs.find((tx) => tx.id === selectedPjTxId)

  async function handleSubmit() {
    if (!selectedPjTxId || !profileId || !accountId || !categoryId) {
      toast({
        title: 'Preencha tudo',
        description: 'Selecione tx PJ, tipo, perfil, conta e categoria.',
        variant: 'destructive',
      })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/pontes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          companyId: empresaId,
          pjTransactionId: selectedPjTxId,
          profileId,
          pfBankAccountId: accountId,
          pfCategoryId: categoryId,
          kind,
          createdVia: 'CREATED_MANUAL',
          socioPFId: socioPFId ?? null,
          notes: notes || null,
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.erro ?? 'Erro ao criar ponte')
      }
      const json = await res.json()
      toast({ title: '🌉 Ponte criada', description: 'Redirecionando…' })
      if (onCreated) onCreated(json.bridgeId)
      else router.push(redirectTo ?? `/pontes/${json.bridgeId}`)
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
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-3 p-4">
          <h2 className="font-semibold text-slate-900">
            1. Lado PJ — qual transação?
          </h2>
          <Input
            placeholder="Buscar transação PJ (descrição)…"
            value={pjTxQuery}
            onChange={(e) => setPjTxQuery(e.target.value)}
          />
          <div className="max-h-64 overflow-y-auto rounded border border-slate-200">
            {filteredTxs.length === 0 ? (
              <p className="p-3 text-sm text-slate-500">Nenhuma transação encontrada</p>
            ) : (
              filteredTxs.map((tx) => (
                <label
                  key={tx.id}
                  className={`flex cursor-pointer items-center gap-3 border-b border-slate-100 p-3 text-sm hover:bg-slate-50 ${
                    selectedPjTxId === tx.id ? 'bg-primary/5' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="pj-tx"
                    value={tx.id}
                    checked={selectedPjTxId === tx.id}
                    onChange={() => setSelectedPjTxId(tx.id)}
                  />
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{tx.description}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(tx.date).toLocaleDateString('pt-BR')} ·{' '}
                      {tx.bankAccountName ?? '—'}
                    </p>
                  </div>
                  <span className="font-medium text-red-600">−{formatBRL(tx.amount)}</span>
                </label>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <h2 className="font-semibold text-slate-900">2. Tipo da retirada</h2>
          <BridgeKindRadio value={kind} onChange={setKind} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-4">
          <h2 className="font-semibold text-slate-900">3. Lado PF</h2>

          <div>
            <Label>Perfil PF</Label>
            <select
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
              className="mt-1 w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Selecione…</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>Conta PF</Label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              disabled={!profileId}
              className="mt-1 w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Selecione…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.bankName ? ` (${a.bankName})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>Categoria PF</Label>
            {/* Sprint Category-Combobox PF Batch (30/06/2026): trocado
                <select> HTML por CategoryCombobox unificado. Bridge PJ→PF
                cria tx PF CREDIT (recebimento), categoria = INCOME. */}
            <CategoryCombobox
              value={categoryId || null}
              categorias={categories.map((c) => ({
                id: c.id,
                name: c.name,
                color: c.color ?? null,
                type: c.type ?? 'INCOME',
                dreGroup: null,
              }))}
              onChange={(v) => setCategoryId(v ?? '')}
              onCreate={
                profileId
                  ? async (name) => {
                      const cat = await createCategoryForPF(profileId, name, 'INCOME')
                      if (cat) setCategories((prev) => [...prev, {
                        id: cat.id,
                        name: cat.name,
                        color: cat.color ?? null,
                        type: cat.type ?? 'INCOME',
                      }])
                      return cat
                    }
                  : undefined
              }
              disabled={!profileId}
              placeholder="Selecione…"
              className="mt-1 h-9 w-full justify-between border-input text-sm"
              ariaLabel="Categoria PF da ponte"
            />
          </div>

          <div>
            <Label>Observações (opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
            />
          </div>
        </CardContent>
      </Card>

      {selectedPjTx && profileId && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="space-y-1 p-4 text-sm text-slate-700">
            <p className="font-semibold text-emerald-900">Após criar:</p>
            <p>🏢 Empresa · DRE não muda (categoria PJ continua a mesma)</p>
            <p>👤 Perfil · +{formatBRL(selectedPjTx.amount)} entrada</p>
            <p>
              🌉 Ponte · {kind} · {new Date(selectedPjTx.date).toLocaleDateString('pt-BR')}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => router.push(cancelHref ?? `/empresas/${empresaId}/socios`)}
        >
          Cancelar
        </Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Criando…' : '🌉 Criar ponte'}
        </Button>
      </div>
    </div>
  )
}
