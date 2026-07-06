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
import { suggestSpendCategory } from '@/lib/bridges/suggest-spend-category'

export interface PjTx {
  id: string
  date: string
  description: string
  amount: number
  bankAccountName: string | null
  /** Sprint Fix-NovaPonte (30/06/2026): dreGroup da categoria — usado pra
   *  ordenar tx de Distribuição no topo do dropdown (kind típico). */
  dreGroup?: string | null
  /** Sprint Fix-Tipo-Param (30/06/2026): nome da categoria — usado no filtro
   *  por kind=PRO_LABORE (match por nome normalizado sem acento). */
  categoryName?: string | null
}

// Sprint Fix-Tipo-Param (30/06/2026): normalizador pra match de Pró-labore.
// Remove acentos + lowercase. "Pró-labore Sócios" → "pro-labore socios".
function normalizeForProLabore(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

// Sprint Fix-Tipo-Param (30/06/2026): filtro dinâmico por kind selecionado.
// Diagnóstico READ-ONLY 30/06 confirmou os grupos "de retirada de sócio":
//   DISTRIBUICAO/ADIANTAMENTO/RETIRADA_SOCIOS: dreGroup=DISTRIBUICAO_LUCROS
//   PRO_LABORE: category.name normalizado casa "pro-labore" (+ variações)
//   REEMBOLSO: user reembolsa QUALQUER despesa → não filtra por categoria
function matchesKindFilter(tx: PjTx, kind: BridgeKind): boolean {
  if (kind === 'REEMBOLSO') return true
  if (kind === 'PRO_LABORE') {
    const n = normalizeForProLabore(tx.categoryName)
    return n.includes('pro-labore') || n.includes('pro labore') || n.includes('prolabore')
  }
  // DISTRIBUICAO, ADIANTAMENTO, RETIRADA_SOCIOS
  return tx.dreGroup === 'DISTRIBUICAO_LUCROS'
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
  /** Sprint Fluxo-Unificado-Retirada (30/06/2026): pré-seleciona a tx PJ
   *  (usado pela fila de "Retiradas pendentes" e pelo convite pós-categorização).
   *  A tx passa a exibir "Selecionada da fila" no lugar da lista completa. */
  initialPjTxId?: string | null
  /** Pré-seleciona perfil PF (sugestão da última ponte do sócio). */
  initialProfileId?: string | null
  /** Pré-seleciona conta PF (sugestão da última ponte do sócio). */
  initialAccountId?: string | null
  /** Pré-seleciona categoria PF (sugestão da última ponte do sócio). */
  initialCategoryId?: string | null
  /** Callback de cancelar (usado em modal). Se ausente, faz router.push do cancelHref. */
  onCancel?: () => void
  /** Layout compacto (usado em modal — remove Cards internos e diminui gap). */
  compact?: boolean
}

export function NovaPonteForm({
  empresaId,
  socioPFId,
  redirectTo,
  cancelHref,
  onCreated,
  initialPjTxId,
  initialProfileId,
  initialAccountId,
  initialCategoryId,
  onCancel,
  compact = false,
}: NovaPonteFormProps) {
  const router = useRouter()
  const { toast } = useToast()

  const [pjTxs, setPjTxs] = useState<PjTx[]>([])
  const [pjTxQuery, setPjTxQuery] = useState('')
  // Sprint Fluxo-Unificado-Retirada (30/06/2026): 4 states aceitam initial* na
  // primeira render — se caller passar, form nasce pré-preenchido.
  const [selectedPjTxId, setSelectedPjTxId] = useState(initialPjTxId ?? '')
  const [kind, setKind] = useState<BridgeKind>('DISTRIBUICAO')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [profileId, setProfileId] = useState(initialProfileId ?? '')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountId, setAccountId] = useState(initialAccountId ?? '')
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryId, setCategoryId] = useState(initialCategoryId ?? '')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // Sprint Fix-NovaPonte (30/06/2026): estados dedicados pra loading + erro.
  // Antes o .catch(() => {}) engolia qualquer falha silenciosamente e o
  // dropdown mostrava "Nenhuma transação" mesmo quando o fetch tinha falhado.
  const [pjTxsLoading, setPjTxsLoading] = useState(true)
  const [pjTxsError, setPjTxsError] = useState<string | null>(null)
  // Sprint Fix-Tipo-Param (30/06/2026): escape hatch pra desligar o filtro
  // dinâmico por kind (Yussef pode querer parear tx atípica). Default off.
  const [showAllTx, setShowAllTx] = useState(false)
  // Sprint Fluxo-A/B-Ponte (05/07/2026): estados do card "Onde você gastou?".
  // Fluxo A (checkbox desmarcado, default) = só entrada. Fluxo B (marcado) =
  // entrada + saída atomic. spendCategories = EXPENSE do perfil.
  // spendSuggestionAppliedFor guarda o ID da tx pra qual já aplicamos sugestão
  // — evita reaplicar quando user troca manualmente + volta pra mesma tx.
  const [spendChecked, setSpendChecked] = useState(false)
  const [spendCategories, setSpendCategories] = useState<Category[]>([])
  const [spendCategoryId, setSpendCategoryId] = useState('')
  const [spendSuggestionAppliedFor, setSpendSuggestionAppliedFor] = useState<string | null>(null)

  useEffect(() => {
    // Sprint Fix-NovaPonte (30/06/2026): endpoint corrigido.
    //   ANTES: /api/empresas/[id]/transacoes → não existia (404 HTML,
    //          .json() falhava, .catch engolia, dropdown vazio pra qualquer empresa).
    //   AGORA: endpoint global /api/transacoes existente aceita empresaId + type +
    //          status + limit. Retorna { transacoes: [...] } com include.bridge.
    setPjTxsLoading(true)
    setPjTxsError(null)
    // Sprint Fix-Tipo-Param (30/06/2026): endpoint /api/transacoes lê
    // searchParams.get('tipo') (PT), NÃO 'type' (EN). Antes desse fix o
    // param era ignorado e vinham CREDIT + DEBIT + TRANSFER juntos, e o
    // limit=200 corta os DEBIT antigos (LM TRANSP 22/06 ficava fora).
    // Diagnóstico READ-ONLY 30/06 (HEAD 3a9415d) confirmou isso.
    const qs = new URLSearchParams({
      empresaId,
      tipo: 'DEBIT',
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
          category: { name: string | null; dreGroup: string | null } | null
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
          categoryName: tx.category?.name ?? null,
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
    // Sprint Fluxo-A/B-Ponte (05/07/2026): fetch categorias EXPENSE do perfil
    // pro card "Onde você gastou?". Mesmo pattern do INCOME acima.
    fetch(`/api/perfis/${profileId}/categorias?type=EXPENSE`)
      .then((r) => r.json())
      .then((j) => setSpendCategories(j.categories ?? []))
      .catch(() => {})
  }, [profileId])

  // Sprint Fix-Tipo-Param (30/06/2026): pipeline de filtro em 3 passos.
  // 1. Base: sem bridge (já feito no useEffect via `withoutBridge`).
  // 2. Kind: só as categorias que fazem sentido pro kind escolhido
  //    (escape hatch `showAllTx` bypass).
  // 3. Busca por descrição (só quando digitar); senão slice(0, 30).
  const kindFilteredTxs = showAllTx
    ? pjTxs
    : pjTxs.filter((tx) => matchesKindFilter(tx, kind))
  const searchedTxs = pjTxQuery
    ? kindFilteredTxs.filter((tx) =>
        tx.description.toLowerCase().includes(pjTxQuery.toLowerCase()),
      )
    : kindFilteredTxs
  const filteredTxs = pjTxQuery ? searchedTxs : searchedTxs.slice(0, 30)
  const selectedPjTx = pjTxs.find((tx) => tx.id === selectedPjTxId)

  // Sprint Fix-Tipo-Param (30/06/2026): se o kind mudar e a tx selecionada
  // não passar mais no filtro, limpar seleção — evita submeter ponte com tx
  // que sumiu da lista.
  useEffect(() => {
    if (!selectedPjTxId) return
    const stillVisible = pjTxs.some(
      (tx) =>
        tx.id === selectedPjTxId && (showAllTx || matchesKindFilter(tx, kind)),
    )
    if (!stillVisible) setSelectedPjTxId('')
  }, [kind, showAllTx, pjTxs, selectedPjTxId])

  // Sprint Fluxo-A/B-Ponte (05/07/2026): fallback pra retirada fora do top 200.
  //
  // Quando o form é aberto pela fila "Retiradas pendentes" (ou convite), o
  // caller passa `initialPjTxId` — e o resumo compacto SÓ aparece se a tx
  // constar em `pjTxs`. Mas o fetch principal traz apenas as 200 DEBIT
  // RECONCILED mais recentes da empresa, ordenadas por Distribuição de Lucros
  // primeiro (ver useEffect acima). Se a retirada é antiga OU se há muitas
  // DEBIT categorizadas, ela cai fora do corte → `selectedPjTx` fica null →
  // `hasPreselected` vira false → user vê a lista de novo (a "duplicação").
  //
  // Este effect resolve: após o carregamento inicial, se a tx pré-selecionada
  // NÃO estiver na lista, busca-a direto por ID em /api/transacoes/{id} e
  // injeta em `pjTxs`. A resposta traz bankAccount + category (com dreGroup)
  // — o suficiente pra montar PjTx. Idempotente (não duplica se já tem).
  useEffect(() => {
    if (!initialPjTxId) return
    if (pjTxsLoading) return
    if (pjTxs.some((tx) => tx.id === initialPjTxId)) return
    let cancelled = false
    fetch(`/api/transacoes/${initialPjTxId}`, { credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((j) => {
        if (cancelled) return
        const t = j?.transacao
        if (!t || typeof t.id !== 'string') return
        const extra: PjTx = {
          id: t.id,
          date: t.date,
          description: t.description,
          amount: t.amount,
          bankAccountName: t.bankAccount?.name ?? null,
          // /api/transacoes/[id] retorna category sem dreGroup; deixamos null
          // (o filtro por kind é bypassado no modo pré-selecionado — ver
          // `hasPreselected` no branch de render).
          dreGroup: t.category?.dreGroup ?? null,
          categoryName: t.category?.name ?? null,
        }
        setPjTxs((prev) => (prev.some((x) => x.id === extra.id) ? prev : [extra, ...prev]))
      })
      .catch((err) => {
        // Fail-soft: se falhar, user vê a lista completa e escolhe manual
        // (comportamento antigo). Log pra debug.
        console.error('[NovaPonteForm] Falha ao buscar tx pré-selecionada:', err)
      })
    return () => {
      cancelled = true
    }
  }, [initialPjTxId, pjTxsLoading, pjTxs])

  // Sprint Fluxo-A/B-Ponte (05/07/2026): auto-sugestão de categoria da despesa.
  //
  // Ao marcar "já gastei" (ou ao carregar categorias EXPENSE se checkbox já
  // estava marcado), rodamos `suggestSpendCategory(selectedPjTx.description)`
  // e casamos com o plano do perfil (por nome, case-insensitive). Só aplica
  // quando: (a) checkbox marcado, (b) tx selecionada, (c) categorias EXPENSE
  // carregadas, (d) ainda não aplicamos pra esta tx.
  //
  // Match por nome (não por ID) porque o mapeamento sugestor→categoria PF é
  // frouxo (categoria "Educação" no plano do user pode ter ID diferente da
  // "Educação" no plano de outro).
  useEffect(() => {
    if (!spendChecked) return
    if (!selectedPjTx) return
    if (spendCategories.length === 0) return
    if (spendSuggestionAppliedFor === selectedPjTx.id) return
    const suggestion = suggestSpendCategory(selectedPjTx.description)
    if (!suggestion) {
      // Sem sugestão — marca como processado pra evitar re-tentar. User escolhe.
      setSpendSuggestionAppliedFor(selectedPjTx.id)
      return
    }
    const target = spendCategories.find(
      (c) => c.name.toLowerCase() === suggestion.categoryName.toLowerCase(),
    )
    if (target) setSpendCategoryId(target.id)
    setSpendSuggestionAppliedFor(selectedPjTx.id)
  }, [spendChecked, selectedPjTx, spendCategories, spendSuggestionAppliedFor])

  async function handleSubmit() {
    if (!selectedPjTxId || !profileId || !accountId || !categoryId) {
      toast({
        title: 'Preencha tudo',
        description: 'Selecione tx PJ, tipo, perfil, conta e categoria.',
        variant: 'destructive',
      })
      return
    }
    // Sprint Fluxo-A/B-Ponte (05/07/2026): se fluxo B (checkbox marcado),
    // exige categoria da despesa. Sem ela o form vira fluxo A silenciosamente
    // — melhor bloquear e pedir explicitamente pra evitar confusão.
    if (spendChecked && !spendCategoryId) {
      toast({
        title: 'Escolha a categoria da despesa',
        description: 'Ou desmarque "Já gastei esse dinheiro" pra criar só a entrada.',
        variant: 'destructive',
      })
      return
    }
    setSubmitting(true)
    try {
      // Sprint Fluxo-A/B-Ponte (05/07/2026): monta payload com spend opcional.
      // Se checkbox desmarcado, o objeto não é enviado (mesmo comportamento antigo).
      const payload: Record<string, unknown> = {
        companyId: empresaId,
        pjTransactionId: selectedPjTxId,
        profileId,
        pfBankAccountId: accountId,
        pfCategoryId: categoryId,
        kind,
        createdVia: 'CREATED_MANUAL',
        socioPFId: socioPFId ?? null,
        notes: notes || null,
      }
      if (spendChecked && spendCategoryId) {
        payload.spend = { categoryId: spendCategoryId }
      }
      const res = await fetch('/api/pontes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.erro ?? 'Erro ao criar ponte')
      }
      const json = await res.json()
      // Sprint Redesign-Socios (01/07/2026): nomenclatura "Retirada" no user-visible.
      toast({
        title: '🌉 Retirada enviada ao PF',
        description: json.spendTransactionId
          ? 'Entrada + despesa registradas'
          : 'Redirecionando…',
      })
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

  // Sprint Fluxo-Unificado-Retirada (30/06/2026): modo "retirada pré-selecionada".
  // Quando o form é aberto pela fila ou pelo convite, a tx PJ já está definida —
  // esconde a lista de busca e mostra um resumo dedicado no lugar. Reduz cognição.
  const hasPreselected = !!initialPjTxId && !!selectedPjTx && compact

  return (
    <div className={compact ? 'space-y-4' : 'space-y-6'}>
      {hasPreselected && selectedPjTx ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Retirada selecionada
          </p>
          <p className="mt-1.5 truncate text-sm font-medium text-slate-900">
            {selectedPjTx.description}
          </p>
          <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              {new Date(selectedPjTx.date).toLocaleDateString('pt-BR')} ·{' '}
              {selectedPjTx.bankAccountName ?? '—'}
            </span>
            <span className="font-semibold tabular-nums text-slate-900">
              {formatBRL(selectedPjTx.amount)}
            </span>
          </div>
        </div>
      ) : (
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
          {/* Sprint Fix-Tipo-Param (30/06/2026): contador + escape hatch.
              Diagnóstico 30/06 confirmou: filtro fixo por kind reduz ~380
              DEBIT RECONCILED da Cacula pras ~22 legítimas de retirada. */}
          {!pjTxsLoading && !pjTxsError && (
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>
                {showAllTx ? (
                  <>Mostrando <strong>todas</strong> as {pjTxs.length} tx DEBIT categorizadas</>
                ) : (
                  <>
                    {kindFilteredTxs.length} tx compatível com{' '}
                    <strong>{kind === 'REEMBOLSO' ? 'reembolso (qualquer despesa)' : kind}</strong>{' '}
                    (de {pjTxs.length} DEBIT)
                  </>
                )}
              </span>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={showAllTx}
                  onChange={(e) => setShowAllTx(e.target.checked)}
                  className="h-3.5 w-3.5"
                />
                Mostrar todas
              </label>
            </div>
          )}
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
                  : pjTxQuery
                    ? ' pra esta busca.'
                    : !showAllTx && kindFilteredTxs.length === 0
                      ? ` compatível com ${kind}. Marque "Mostrar todas" pra ver as ${pjTxs.length} tx DEBIT.`
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
      )}

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

      {/* Sprint Fluxo-A/B-Ponte (05/07/2026): Card "Onde você gastou?" (opcional).
          Fluxo A (default): só entrada — cria PersonalTransaction CREDIT.
          Fluxo B (checkbox marcado): entrada + saída atomic — cria também DEBIT,
          liga via bridge.spendTransactionId, saldo PF net zero. Sugestão de
          categoria via suggestSpendCategory (keyword na descrição PJ). */}
      <Card className="border-slate-200">
        <CardContent className="space-y-3 p-4">
          <h2 className="font-semibold text-slate-900">
            📊 Onde você gastou este dinheiro?{' '}
            <span className="text-xs font-normal text-slate-500">(opcional)</span>
          </h2>
          <label className="flex cursor-pointer items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={spendChecked}
              onChange={(e) => setSpendChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-600"
            />
            <div className="min-w-0">
              <p className="font-medium text-slate-900">
                Já gastei esse dinheiro
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Registra também a despesa PF (ex: escola, mercado). A entrada e
                a saída ficam ligadas — o saldo do PF fica igual (o dinheiro
                atravessou).
              </p>
            </div>
          </label>
          {spendChecked && (
            <div className="space-y-2 rounded-md border border-emerald-100 bg-emerald-50/40 p-3">
              <Label className="text-xs font-medium text-slate-700">
                Categoria da despesa
              </Label>
              <CategoryCombobox
                value={spendCategoryId || null}
                categorias={spendCategories.map((c) => ({
                  id: c.id,
                  name: c.name,
                  color: c.color ?? null,
                  type: c.type ?? 'EXPENSE',
                  dreGroup: null,
                }))}
                onChange={(v) => setSpendCategoryId(v ?? '')}
                onCreate={
                  profileId
                    ? async (name) => {
                        const cat = await createCategoryForPF(profileId, name, 'EXPENSE')
                        if (cat)
                          setSpendCategories((prev) => [
                            ...prev,
                            {
                              id: cat.id,
                              name: cat.name,
                              color: cat.color ?? null,
                              type: cat.type ?? 'EXPENSE',
                            },
                          ])
                        return cat
                      }
                    : undefined
                }
                disabled={!profileId}
                placeholder="Escolha ou crie…"
                className="h-9 w-full justify-between border-input text-sm"
                ariaLabel="Categoria da despesa PF"
              />
              {selectedPjTx && spendCategoryId && (
                <p className="text-[11px] text-slate-500">
                  Vai criar uma despesa de{' '}
                  <span className="font-medium tabular-nums text-slate-700">
                    {formatBRL(selectedPjTx.amount)}
                  </span>{' '}
                  em{' '}
                  <span className="font-medium text-slate-700">
                    {spendCategories.find((c) => c.id === spendCategoryId)?.name}
                  </span>
                  , mesma data da retirada.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedPjTx && profileId && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="space-y-1 p-4 text-sm text-slate-700">
            <p className="font-semibold text-emerald-900">Após criar:</p>
            <p>🏢 Empresa · DRE não muda (categoria PJ continua a mesma)</p>
            <p>👤 Perfil · +{formatBRL(selectedPjTx.amount)} entrada</p>
            {spendChecked && spendCategoryId && (
              <p>
                💸 Perfil · −{formatBRL(selectedPjTx.amount)} despesa (
                {spendCategories.find((c) => c.id === spendCategoryId)?.name})
              </p>
            )}
            <p>
              🌉 Ponte · {kind} · {new Date(selectedPjTx.date).toLocaleDateString('pt-BR')}
              {spendChecked && spendCategoryId ? ' · com despesa vinculada' : ''}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => {
            // Sprint Fluxo-Unificado-Retirada (30/06/2026): onCancel
            // toma precedência (usado em modal — fecha sem navegar).
            if (onCancel) return onCancel()
            router.push(cancelHref ?? `/empresas/${empresaId}/socios`)
          }}
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
