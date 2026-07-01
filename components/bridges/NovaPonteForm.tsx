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
  /** Sprint Fix-NovaPonte (30/06/2026): dreGroup da categoria — usado pra
   *  ordenar tx de Distribuição no topo do dropdown (kind típico). */
  dreGroup?: string | null
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
  // Sprint Fix-NovaPonte (30/06/2026): estados dedicados pra loading + erro.
  // Antes o .catch(() => {}) engolia qualquer falha silenciosamente e o
  // dropdown mostrava "Nenhuma transação" mesmo quando o fetch tinha falhado.
  const [pjTxsLoading, setPjTxsLoading] = useState(true)
  const [pjTxsError, setPjTxsError] = useState<string | null>(null)

  useEffect(() => {
    // Sprint Fix-NovaPonte (30/06/2026): endpoint corrigido.
    //   ANTES: /api/empresas/[id]/transacoes → não existia (404 HTML,
    //          .json() falhava, .catch engolia, dropdown vazio pra qualquer empresa).
    //   AGORA: endpoint global /api/transacoes existente aceita empresaId + type +
    //          status + limit. Retorna { transacoes: [...] } com include.bridge.
    setPjTxsLoading(true)
    setPjTxsError(null)
    const qs = new URLSearchParams({
      empresaId,
      type: 'DEBIT',
      status: 'RECONCILED',
      limit: '200',
    })
    fetch(`/api/transacoes?${qs.toString()}`, { credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) {
          throw new Error(`HTTP ${r.status}`)
        }
        return r.json()
      })
      .then((j) => {
        // Shape do endpoint global: { transacoes: [{ id, date, description,
        // amount, bankAccount: { name }, category: { dreGroup }, bridge: { id } }] }
        // Mapeamos pro PjTx (shape do NovaPonteForm) e filtramos tx que JÁ
        // têm ponte (não permitir criar ponte duplicada — @unique já garante
        // no BD, mas UX melhor pré-filtrando).
        type ApiTxLite = {
          id: string
          date: string
          description: string
          amount: number
          bankAccount: { name: string | null } | null
          category: { dreGroup: string | null } | null
          bridge: { id: string } | null
        }
        const list: ApiTxLite[] = Array.isArray(j?.transacoes) ? j.transacoes : []
        const withoutBridge = list.filter((tx) => !tx.bridge)
        const mapped: PjTx[] = withoutBridge.map((tx) => ({
          id: tx.id,
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          bankAccountName: tx.bankAccount?.name ?? null,
          dreGroup: tx.category?.dreGroup ?? null,
        }))
        // Ordena: Distribuição de Lucros primeiro (kind típico), depois o resto
        // por data desc (mais recentes primeiro).
        mapped.sort((a, b) => {
          const aDist = a.dreGroup === 'DISTRIBUICAO_LUCROS' ? 0 : 1
          const bDist = b.dreGroup === 'DISTRIBUICAO_LUCROS' ? 0 : 1
          if (aDist !== bDist) return aDist - bDist
          return b.date.localeCompare(a.date)
        })
        setPjTxs(mapped)
      })
      .catch((err) => {
        // Sprint Fix-NovaPonte (30/06/2026): erro visível, não engolido.
        console.error('[NovaPonteForm] Falha ao carregar transações PJ:', err)
        setPjTxsError(
          err instanceof Error ? err.message : 'Falha ao carregar transações',
        )
      })
      .finally(() => setPjTxsLoading(false))
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
            {/* Sprint Fix-NovaPonte (30/06/2026): distingue loading / erro /
                vazio-verdadeiro. Antes era só "Nenhuma transação encontrada"
                em todos os 3 casos — enganava o user quando na verdade o fetch
                tinha falhado (endpoint fantasma). */}
            {pjTxsLoading ? (
              <p className="p-3 text-sm text-slate-500">Carregando transações…</p>
            ) : pjTxsError ? (
              <p className="p-3 text-sm text-red-600">
                Erro ao carregar transações ({pjTxsError}). Tente recarregar a página.
              </p>
            ) : filteredTxs.length === 0 ? (
              <p className="p-3 text-sm text-slate-500">
                Nenhuma transação encontrada
                {pjTxs.length === 0
                  ? ' — não há tx DEBIT já categorizada disponível pra virar ponte.'
                  : ' pra este filtro.'}
              </p>
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
