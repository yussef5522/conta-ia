'use client'

// Sprint Fechar-Ponte (08/08/2026) — cliente do lote de retiradas órfãs.
// A LISTA é o preview: mostra descrição COMPLETA + data + valor + conta +
// categoria (foi a descrição que revelou os erros). Desmarca o que não for,
// confirma, e cada uma vira ponte via /retiradas-orfas/lote (createBridge).

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Check, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'

type Kind = 'PRO_LABORE' | 'DISTRIBUICAO' | 'REEMBOLSO' | 'ADIANTAMENTO' | 'RETIRADA_SOCIOS'

interface Orfa {
  id: string
  date: string
  amount: number
  description: string
  bankAccount: { id: string; name: string } | null
  category: { id: string; name: string } | null
}
interface Profile {
  id: string
  name: string
  accounts: { id: string; name: string; bankName: string | null }[]
  incomeCategories: { id: string; name: string }[]
  expenseCategories: { id: string; name: string }[]
}
interface Ctx {
  socios: { id: string; nome: string; papel: string }[]
  profiles: Profile[]
  lucroContext: { desde: string } | null
}

const KIND_LABEL: Record<Kind, string> = {
  DISTRIBUICAO: 'Distribuição de Lucros',
  PRO_LABORE: 'Pró-labore',
  REEMBOLSO: 'Reembolso de despesa',
  ADIANTAMENTO: 'Adiantamento a sócio',
  RETIRADA_SOCIOS: 'Retirada genérica',
}

function fmtData(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function LoteRetiradasClient({ empresaId }: { empresaId: string }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [ctx, setCtx] = useState<Ctx | null>(null)
  const [orfas, setOrfas] = useState<Orfa[]>([])
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())
  const [applying, setApplying] = useState(false)

  // Config (escolhido UMA vez)
  const [socioId, setSocioId] = useState('')
  const [kind, setKind] = useState<Kind>('DISTRIBUICAO')
  const [profileId, setProfileId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [incomeCatId, setIncomeCatId] = useState('')
  const [fluxoAB, setFluxoAB] = useState(false)
  const [spendCatId, setSpendCatId] = useState('')

  async function carregar() {
    setLoading(true)
    try {
      const [cRes, oRes] = await Promise.all([
        fetch(`/api/empresas/${empresaId}/withdrawal-context`, { credentials: 'include' }),
        fetch(`/api/empresas/${empresaId}/retiradas-orfas?includeList=true&limit=100`, {
          credentials: 'include',
        }),
      ])
      const c = cRes.ok ? ((await cRes.json()) as Ctx) : null
      const o = oRes.ok ? ((await oRes.json()) as { orfas: Orfa[] }) : { orfas: [] }
      setCtx(c)
      setOrfas(o.orfas ?? [])
      setSelecionadas(new Set((o.orfas ?? []).map((x) => x.id)))
      if (c && c.profiles.length === 1) {
        const p = c.profiles[0]
        setProfileId(p.id)
        if (p.accounts.length === 1) setAccountId(p.accounts[0].id)
        const match = p.incomeCategories.find((x) => /pr[oó].labore|lucros/i.test(x.name))
        setIncomeCatId(match?.id ?? p.incomeCategories[0]?.id ?? '')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId])

  const profile = ctx?.profiles.find((p) => p.id === profileId) ?? null
  const totalSel = useMemo(
    () => orfas.filter((o) => selecionadas.has(o.id)).reduce((s, o) => s + o.amount, 0),
    [orfas, selecionadas],
  )
  const nSel = selecionadas.size

  const podeAplicar =
    socioId !== '' &&
    profileId !== '' &&
    accountId !== '' &&
    incomeCatId !== '' &&
    (!fluxoAB || spendCatId !== '') &&
    nSel > 0

  function toggle(id: string) {
    setSelecionadas((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }
  function toggleTodas() {
    setSelecionadas((prev) => (prev.size === orfas.length ? new Set() : new Set(orfas.map((o) => o.id))))
  }

  async function aplicar() {
    if (!podeAplicar) return
    const ids = orfas.filter((o) => selecionadas.has(o.id)).map((o) => o.id)
    const perfilNome = profile?.name ?? 'PF'
    const ok = window.confirm(
      `Criar ${ids.length} ponte(s) — ${formatBRL(totalSel)} — como ${KIND_LABEL[kind]} para o perfil "${perfilNome}"${
        fluxoAB ? ' (entra e sai no mesmo ato)' : ''
      }?`,
    )
    if (!ok) return
    setApplying(true)
    try {
      const res = await fetch(`/api/empresas/${empresaId}/retiradas-orfas/lote`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pjTransactionIds: ids,
          profileId,
          pfBankAccountId: accountId,
          pfCategoryId: incomeCatId,
          kind,
          socioPFId: socioId,
          spendCategoryId: fluxoAB ? spendCatId : undefined,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Falha no lote', description: body.erro ?? `HTTP ${res.status}` })
        return
      }
      const { criadas, falhas } = body as { criadas: number; falhas: number }
      toast({
        title: `${criadas} ponte(s) criada(s)`,
        description: falhas > 0 ? `${falhas} falharam — recarregando lista.` : 'Retiradas enviadas ao PF.',
      })
      await carregar()
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-4 space-y-4">
      <Link
        href={`/empresas/${empresaId}/pendentes`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div>
        <h1 className="text-xl font-semibold">Resolver retiradas em lote</h1>
        <p className="text-sm text-muted-foreground">
          Saídas categorizadas como retirada que ainda não têm entrada no seu PF. Escolha o destino
          uma vez, revise a lista e confirme.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Carregando...
        </div>
      ) : orfas.length === 0 ? (
        <div className="rounded-md border bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900 p-6 text-center">
          <Check className="mx-auto h-8 w-8 text-emerald-600 mb-2" />
          <p className="font-medium text-emerald-900 dark:text-emerald-200">
            Nenhuma retirada órfã. Tudo enviado ao PF. 🎉
          </p>
        </div>
      ) : !ctx || ctx.socios.length === 0 || ctx.profiles.length === 0 ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-4 text-sm text-amber-900 dark:text-amber-200">
          <p className="font-medium">Cadastro incompleto</p>
          <p className="text-xs mt-1">
            Você precisa de pelo menos 1 sócio cadastrado e 1 perfil PF com conta para criar pontes.
            Cadastre em <strong>Sócios</strong> / <strong>PF</strong> e volte aqui.
          </p>
        </div>
      ) : (
        <>
          {/* Config — escolhido UMA vez */}
          <div className="rounded-md border p-3 space-y-3 bg-muted/30">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Campo label="Sócio">
                <select value={socioId} onChange={(e) => setSocioId(e.target.value)} className={selectCls}>
                  <option value="">Escolher...</option>
                  {ctx.socios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                      {s.papel !== 'SOCIO' ? ` (${s.papel.toLowerCase()})` : ''}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo label="Tipo">
                <select value={kind} onChange={(e) => setKind(e.target.value as Kind)} className={selectCls}>
                  {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABEL[k]}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo label="Perfil PF (recebe)">
                <select
                  value={profileId}
                  onChange={(e) => {
                    setProfileId(e.target.value)
                    setAccountId('')
                    setIncomeCatId('')
                    setSpendCatId('')
                  }}
                  className={selectCls}
                >
                  <option value="">Escolher...</option>
                  {ctx.profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo label="Conta PF">
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className={selectCls}
                  disabled={!profile}
                >
                  <option value="">Escolher...</option>
                  {profile?.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {a.bankName ? ` · ${a.bankName}` : ''}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo label="Categoria da entrada (PF)">
                <select
                  value={incomeCatId}
                  onChange={(e) => setIncomeCatId(e.target.value)}
                  className={selectCls}
                  disabled={!profile}
                >
                  <option value="">Escolher...</option>
                  {profile?.incomeCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo label="Já virou gasto? (fluxo A/B)">
                <div className="flex items-center gap-2 h-9">
                  <input
                    id="fluxoab"
                    type="checkbox"
                    checked={fluxoAB}
                    onChange={(e) => setFluxoAB(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <label htmlFor="fluxoab" className="text-xs text-muted-foreground">
                    entra e sai (saldo PF não muda)
                  </label>
                </div>
              </Campo>
              {fluxoAB && (
                <Campo label="Categoria do gasto (PF)">
                  <select
                    value={spendCatId}
                    onChange={(e) => setSpendCatId(e.target.value)}
                    className={selectCls}
                    disabled={!profile}
                  >
                    <option value="">Escolher...</option>
                    {profile?.expenseCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Campo>
              )}
            </div>
          </div>

          {/* Lista = preview */}
          <div className="rounded-md border">
            <div className="flex items-center justify-between border-b px-3 py-2 bg-muted/30">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={selecionadas.size === orfas.length && orfas.length > 0}
                  onChange={toggleTodas}
                  className="h-4 w-4"
                />
                {nSel} de {orfas.length} selecionada(s)
              </label>
              <span className="text-sm font-semibold tabular-nums">{formatBRL(totalSel)}</span>
            </div>
            <ul className="divide-y">
              {orfas.map((o) => (
                <li key={o.id} className="flex items-start gap-3 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selecionadas.has(o.id)}
                    onChange={() => toggle(o.id)}
                    className="mt-1 h-4 w-4 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm break-words">{o.description || '(sem descrição)'}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtData(o.date)} · {o.bankAccount?.name ?? '—'} ·{' '}
                      {o.category?.name ?? 'sem categoria'}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums shrink-0">
                    {formatBRL(o.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="sticky bottom-0 flex items-center justify-between gap-3 rounded-md border bg-background p-3 shadow-sm">
            <p className="text-sm text-muted-foreground">
              {nSel} ponte(s) · <span className="font-semibold text-foreground">{formatBRL(totalSel)}</span>
              {fluxoAB ? ' · saldo PF não muda (A/B)' : ''}
            </p>
            <Button onClick={aplicar} disabled={!podeAplicar || applying}>
              {applying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Criando...
                </>
              ) : (
                <>
                  Criar {nSel} ponte(s) <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

const selectCls = 'w-full h-9 px-2 text-sm rounded border bg-background'

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] uppercase font-semibold text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}
