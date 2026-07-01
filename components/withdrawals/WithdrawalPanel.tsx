'use client'

// Sprint Retirada-1-Clique — Painel reusável "Marcar como retirada de sócio".
// Usado em:
//   - XeroRow tab "💸 Retirada" (Conciliação)
//   - Modal Pendentes (botão "Marcar como retirada")
//
// Reusa API /api/pontes (Fatia 4). Sem migration. Sem duplicação de lógica.
//
// REGRA UX-FISCAL importante: o tipo (kind) é o ponto crítico. SEMPRE mostra
// explicação de cada tipo (INSS/IR/isenção) ao lado da escolha. NÃO usa
// default que esconda a decisão — user clica conscientemente.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Check, AlertTriangle, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'
import { CategoryCombobox } from '@/components/transacoes/category-combobox'
import { createCategoryForPF } from '@/lib/transacoes/on-create-category'

export type WithdrawalKind =
  | 'PRO_LABORE'
  | 'DISTRIBUICAO'
  | 'REEMBOLSO'
  | 'ADIANTAMENTO'
  | 'RETIRADA_SOCIOS'

interface SocioOption {
  id: string
  nome: string
  cpf: string | null
  papel: string
  pixKeys: string[]
}
interface ProfileOption {
  id: string
  name: string
  cpf: string | null
  type: string
  accounts: { id: string; name: string; bankName: string | null }[]
  incomeCategories: { id: string; name: string; color?: string | null }[]
}

interface ContextResponse {
  socios: SocioOption[]
  profiles: ProfileOption[]
}

interface Props {
  empresaId: string
  /** ID da tx PJ (DEBIT) que vai virar ponte. */
  pjTransactionId: string
  /** Valor (só mostra; backend pega do tx). */
  pjAmount: number
  /** Descrição da tx PJ (pra mostrar no header). */
  pjDescription: string
  /** Sugestão pré-selecionada (do suggestWithdrawal). Pode ser null. */
  initialSuggestion?: {
    socioId: string
    suggestedKind: WithdrawalKind
  } | null
  /** Callback após sucesso — UI deve remover a row da lista. */
  onConfirmed: () => void
  /** Callback de cancelar (volta pra Match/Create). */
  onCancel?: () => void
}

const KIND_INFO: Record<
  WithdrawalKind,
  { label: string; emoji: string; affectsDre: boolean; fiscal: string }
> = {
  PRO_LABORE: {
    label: 'Pró-labore',
    emoji: '💼',
    affectsDre: true,
    fiscal:
      'INSS + IR. É o "salário" do sócio. Afeta a DRE como Despesa de Pessoal.',
  },
  DISTRIBUICAO: {
    label: 'Distribuição de Lucros',
    emoji: '🏷',
    affectsDre: false,
    fiscal:
      'Isento de IR/INSS pro sócio (até limite legal). NÃO afeta a DRE. Só pode usar se a empresa teve LUCRO comprovado.',
  },
  REEMBOLSO: {
    label: 'Reembolso de despesa',
    emoji: '🔄',
    affectsDre: true,
    fiscal:
      'Sócio adiantou despesa do bolso. A categoria PJ depende do que foi reembolsado — você escolhe.',
  },
  ADIANTAMENTO: {
    label: 'Adiantamento a sócio',
    emoji: '💸',
    affectsDre: false,
    fiscal:
      'Empréstimo informal da empresa pro sócio. NÃO afeta DRE. Se > 60 dias sem devolução, Receita pode reclassificar como retirada disfarçada.',
  },
  RETIRADA_SOCIOS: {
    label: 'Retirada genérica',
    emoji: '📤',
    affectsDre: false,
    fiscal:
      'Retirada sem classificação específica. NÃO afeta DRE por default. Reclassifique depois quando tiver a apuração contábil.',
  },
}

export function WithdrawalPanel({
  empresaId,
  pjTransactionId,
  pjAmount,
  pjDescription,
  initialSuggestion,
  onConfirmed,
  onCancel,
}: Props) {
  const { toast } = useToast()
  const [ctx, setCtx] = useState<ContextResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [socioId, setSocioId] = useState<string>('')
  const [kind, setKind] = useState<WithdrawalKind | ''>('')
  const [profileId, setProfileId] = useState<string>('')
  const [accountId, setAccountId] = useState<string>('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [createPfEntry, setCreatePfEntry] = useState(true)

  useEffect(() => {
    fetch(`/api/empresas/${empresaId}/withdrawal-context`, {
      credentials: 'include',
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ContextResponse | null) => {
        if (!data) return
        setCtx(data)
        // Pré-fill com sugestão
        if (initialSuggestion) {
          setSocioId(initialSuggestion.socioId)
          setKind(initialSuggestion.suggestedKind)
        }
        // Auto-pick perfil único + conta única
        if (data.profiles.length === 1) {
          const p = data.profiles[0]
          setProfileId(p.id)
          if (p.accounts.length === 1) setAccountId(p.accounts[0].id)
          // Categoria default pelo tipo (procura por nome)
          const matchCat = data.profiles[0].incomeCategories.find((c) =>
            /pr[oó].labore|lucros/i.test(c.name),
          )
          if (matchCat) setCategoryId(matchCat.id)
          else if (p.incomeCategories.length > 0)
            setCategoryId(p.incomeCategories[0].id)
        }
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId])

  const profile = ctx?.profiles.find((p) => p.id === profileId) ?? null
  const canSubmit =
    socioId !== '' &&
    kind !== '' &&
    profileId !== '' &&
    accountId !== '' &&
    categoryId !== ''

  async function confirmar() {
    if (!canSubmit || !kind) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/pontes', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: empresaId,
          pjTransactionId,
          profileId,
          pfBankAccountId: accountId,
          pfCategoryId: categoryId,
          kind,
          createdVia: 'CREATED_MANUAL',
          socioPFId: socioId,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Falha ao criar retirada',
          description: body.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      const sName = ctx?.socios.find((s) => s.id === socioId)?.nome ?? 'sócio'
      toast({
        title: `Retirada confirmada — ${KIND_INFO[kind].label}`,
        description: `${formatBRL(pjAmount)} para ${sName}. ${
          KIND_INFO[kind].affectsDre
            ? 'Conta na DRE como Despesa de Pessoal.'
            : 'NÃO afeta a DRE.'
        }`,
      })
      onConfirmed()
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando sócios + perfis PF...
      </div>
    )
  }
  if (!ctx || ctx.socios.length === 0) {
    return (
      <div className="rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-3 text-sm text-amber-900 dark:text-amber-200 space-y-2">
        <p className="font-medium">Sem sócios cadastrados</p>
        <p className="text-xs">
          Cadastre o sócio em <strong>Cadastros → Sócios</strong> antes de
          marcar uma retirada.
        </p>
      </div>
    )
  }
  // Sprint Retirada-Fix: API /api/pontes exige pfBankAccountId obrigatório.
  // Logo "criar entrada PF" não é opcional quando o user TEM perfis PF.
  // Se user NÃO tem nenhum perfil → checkbox aparece (e fica false) só
  // pra UI indicar "estado sem PF". Ponte não vai ser criada (TODO Fatia 5).
  const hasPfProfile = ctx.profiles.length > 0
  if (!hasPfProfile && createPfEntry) {
    setCreatePfEntry(false)
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="rounded bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-900 dark:text-amber-200 space-y-0.5">
        <p>
          <strong>{formatBRL(pjAmount)}</strong> · {pjDescription.slice(0, 80)}
        </p>
        <p className="text-amber-700 dark:text-amber-300/80">
          Esta saída vai virar <strong>Retirada de Sócio</strong>. NÃO entra
          como despesa operacional.
        </p>
      </div>

      {/* Sócio */}
      <div className="space-y-1">
        <label className="text-[10px] uppercase font-semibold text-muted-foreground">
          Sócio
        </label>
        <select
          value={socioId}
          onChange={(e) => setSocioId(e.target.value)}
          className="w-full h-9 px-2 text-sm rounded border bg-background"
        >
          <option value="">Escolher sócio...</option>
          {ctx.socios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome} {s.papel !== 'SOCIO' && `(${s.papel.toLowerCase()})`}
            </option>
          ))}
        </select>
      </div>

      {/* Tipo (kind) com explicação fiscal */}
      <div className="space-y-1.5">
        <label className="text-[10px] uppercase font-semibold text-muted-foreground">
          Tipo (impacto fiscal)
        </label>
        <div className="space-y-1.5">
          {(Object.keys(KIND_INFO) as WithdrawalKind[]).map((k) => {
            const info = KIND_INFO[k]
            const isSelected = kind === k
            return (
              <label
                key={k}
                className={`flex items-start gap-2 rounded border p-2 cursor-pointer transition-colors ${
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/30'
                }`}
              >
                <input
                  type="radio"
                  name="kind"
                  value={k}
                  checked={isSelected}
                  onChange={() => setKind(k)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span>{info.emoji}</span>
                    <strong>{info.label}</strong>
                    <span
                      className={`text-[10px] px-1.5 py-0 rounded uppercase font-semibold ${
                        info.affectsDre
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {info.affectsDre ? 'Afeta DRE' : 'Não afeta DRE'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {info.fiscal}
                  </p>
                </div>
              </label>
            )
          })}
        </div>
      </div>

      {/* Caixa PF do sócio (sempre cria quando há perfil PF do user) */}
      {hasPfProfile && (
        <>
          <div className="text-xs text-muted-foreground flex items-center gap-2 pt-1">
            <Check className="h-3 w-3 text-emerald-600" />
            <span>
              Criando entrada equivalente no caixa pessoal do sócio (rastreável
              no PF).
            </span>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-semibold text-muted-foreground">
              Perfil PF
            </label>
            <select
              value={profileId}
              onChange={(e) => {
                setProfileId(e.target.value)
                setAccountId('')
                setCategoryId('')
              }}
              className="w-full h-9 px-2 text-sm rounded border bg-background"
            >
              <option value="">Escolher perfil PF...</option>
              {ctx.profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

              {profile && (
                <>
                  {/* Sprint Retirada-Fix: profile sem conta → banner explicativo
                      no lugar do dropdown vazio (em vez de só ficar vazio sem
                      explicação). Botão pra cadastrar leva direto pra rota. */}
                  {profile.accounts.length === 0 ? (
                    <div className="rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-3 text-xs space-y-2">
                      <div className="flex items-start gap-2 text-amber-900 dark:text-amber-200">
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-semibold">
                            Seu perfil PF &quot;{profile.name}&quot; não tem nenhuma
                            conta bancária cadastrada.
                          </p>
                          <p className="text-amber-800 dark:text-amber-300 mt-0.5">
                            Pra rastrear a retirada no seu caixa pessoal,
                            cadastre uma conta. Ou desmarque o checkbox acima
                            pra completar SÓ a saída PJ (categoria DRE fica
                            certa).
                          </p>
                        </div>
                      </div>
                      <Link
                        href={`/perfis/${profile.id}/contas/nova`}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-amber-900 dark:text-amber-100 font-semibold text-xs underline hover:no-underline"
                      >
                        <Plus className="h-3 w-3" />
                        Cadastrar conta no perfil &quot;{profile.name}&quot;
                      </Link>
                    </div>
                  ) : profile.incomeCategories.length === 0 ? (
                    <div className="rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-3 text-xs">
                      <div className="flex items-start gap-2 text-amber-900 dark:text-amber-200">
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                        <p>
                          O perfil &quot;{profile.name}&quot; não tem categorias
                          de receita. Cadastre em{' '}
                          <Link
                            href={`/perfis/${profile.id}/categorias`}
                            target="_blank"
                            className="underline font-semibold"
                          >
                            Categorias do perfil
                          </Link>
                          .
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-semibold text-muted-foreground">
                          Conta PF
                        </label>
                        <select
                          value={accountId}
                          onChange={(e) => setAccountId(e.target.value)}
                          className="w-full h-9 px-2 text-sm rounded border bg-background"
                        >
                          <option value="">Escolher...</option>
                          {profile.accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.bankName ?? a.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-semibold text-muted-foreground">
                          Categoria PF
                        </label>
                        {/* Sprint Category-Combobox PF Batch (30/06/2026):
                            trocado <select> HTML por CategoryCombobox.
                            Withdrawal cria tx PF CREDIT (entrada) via bridge. */}
                        <CategoryCombobox
                          value={categoryId || null}
                          categorias={profile.incomeCategories.map((c) => ({
                            id: c.id,
                            name: c.name,
                            color: c.color ?? null,
                            type: 'INCOME',
                            dreGroup: null,
                          }))}
                          onChange={(v) => setCategoryId(v ?? '')}
                          onCreate={async (name) => {
                            const cat = await createCategoryForPF(profile.id, name, 'INCOME')
                            if (cat) {
                              // Atualiza incomeCategories do profile no ctx local
                              setCtx((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      profiles: prev.profiles.map((p) =>
                                        p.id === profile.id
                                          ? {
                                              ...p,
                                              incomeCategories: [
                                                ...p.incomeCategories,
                                                { id: cat.id, name: cat.name, color: cat.color ?? null },
                                              ],
                                            }
                                          : p,
                                      ),
                                    }
                                  : prev,
                              )
                            }
                            return cat
                          }}
                          placeholder="Escolher..."
                          className="h-9 w-full justify-between border-input text-sm"
                          ariaLabel="Categoria PF do withdrawal"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
        </>
      )}

      {!hasPfProfile && (
        <div className="rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 px-3 py-2 text-xs text-amber-900 dark:text-amber-200 space-y-1">
          <div className="flex items-start gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Você não tem nenhum perfil PF cadastrado. Pra rastrear a retirada
              no seu caixa pessoal, cadastre um perfil.
            </span>
          </div>
          <Link
            href="/perfis/novo"
            target="_blank"
            className="inline-flex items-center gap-1 font-semibold underline hover:no-underline"
          >
            <Plus className="h-3 w-3" />
            Criar meu perfil PF
          </Link>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancelar
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          onClick={confirmar}
          disabled={
            submitting ||
            !socioId ||
            !kind ||
            (createPfEntry && (!profileId || !accountId || !categoryId))
          }
          title={
            createPfEntry && profile && profile.accounts.length === 0
              ? 'Cadastre uma conta no perfil PF, ou desmarque o checkbox pra completar só a saída PJ'
              : undefined
          }
        >
          {submitting ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <Check className="h-3 w-3 mr-1" />
          )}
          Confirmar retirada
        </Button>
      </div>
    </div>
  )
}
