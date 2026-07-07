'use client'

// Sprint Redesign-Ponte-Detalhe (06/07/2026) — "linha do tempo do dinheiro".
//
// Vitrine do novo padrão visual do CAIXAOS. Referências: Mercury, Fey, Ramp.
//
// Estrutura:
//   1. HERO — gradiente azul, valor dominante (tabular-nums 5xl), pill de kind
//      + selo DRE, metadata secundária.
//   2. TIMELINE — 3 nós conectados por linha vertical animada:
//        NÓ 1 · 🏢 Saiu da <empresa PJ> (-R$)
//        NÓ 2 · 👤 Entrou na sua <conta PF> (+R$) verde
//        NÓ 3 · 💸 Foi gasto? (DINÂMICO):
//          - Registrado: card verde "gasto em <categoria>"  · ciclo fechado
//          - Convite: card âmbar "Registrar onde gastei" + painel inline
//          - Dismissado: card slate "Agora não" · reativar
//   3. RODAPÉ — sócio rastreado (info), "Ver no PJ" / "Ver no PF" (ghost),
//      "Excluir esta ponte" LINK discreto (vermelho SÓ no modal de confirmar).
//
// Segurança: GET /api/pontes/[id] chama getBridgeDetailForPage — 404
// anonimizado se user não é OWNER nem creator. Mesmo guard do original.
//
// Reusa fluxo A/B: painel inline chama POST /api/pontes/[id]/spend com
// suggestSpendCategory pré-selecionando categoria EXPENSE por keyword.

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Sparkles,
  Trash2,
  User,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'
import { KIND_DEFAULTS } from '@/lib/bridges/kind-defaults'
import { BridgeDeleteModal } from '@/components/bridges/BridgeDeleteModal'
import { CategoryCombobox } from '@/components/transacoes/category-combobox'
import { suggestSpendCategory } from '@/lib/bridges/suggest-spend-category'
import type { BridgeDeleteMode, BridgeKind } from '@/lib/bridges/types'

// ─────────────────────────────────────────────
// Tipos (espelham getBridgeDetailForPage)
// ─────────────────────────────────────────────

interface BridgeDetailFull {
  bridge: {
    id: string
    kind: string
    amount: number
    date: string
    createdAt: string
    createdVia: string
    companyId: string
    profileId: string
    notes: string | null
    socioPFId: string | null
    spendTransactionId: string | null
    spendAcknowledged: boolean
    createdBy: { name: string; email: string } | null
  }
  pjTransaction: {
    id: string
    description: string
    amount: number
    date: string
    bankAccount: {
      id: string
      name: string
      company: { id: string; name: string; tradeName: string | null }
    } | null
    category: { id: string; name: string; dreGroup: string | null } | null
  }
  pfTransaction: {
    id: string
    description: string
    amount: number
    date: string
    bankAccount: { id: string; name: string } | null
    category: { id: string; name: string; color: string | null } | null
  }
  spendTransaction: {
    id: string
    description: string
    amount: number
    date: string
    bankAccount: { id: string; name: string } | null
    category: { id: string; name: string; color: string | null } | null
  } | null
  socioPF: {
    id: string
    nome: string
    cpf: string | null
    papel: string
  } | null
}

interface PfCategory {
  id: string
  name: string
  color: string | null
  type: string
}

interface PfAccount {
  id: string
  name: string
  bankName?: string | null
}

// ─────────────────────────────────────────────
// Utils
// ─────────────────────────────────────────────

/** Máscara de CPF: 60025889060 → ***.258.***-60 (só mostra 4 dígitos centrais). */
function maskCpf(cpf: string | null): string {
  if (!cpf) return '—'
  const clean = cpf.replace(/\D/g, '')
  if (clean.length !== 11) return cpf
  return `***.${clean.slice(3, 6)}.***-${clean.slice(-2)}`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ─────────────────────────────────────────────
// Página
// ─────────────────────────────────────────────

export default function PonteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()

  const [data, setData] = useState<BridgeDetailFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  const [spendPanelOpen, setSpendPanelOpen] = useState(false)
  const [pfCategories, setPfCategories] = useState<PfCategory[]>([])
  const [pfAccounts, setPfAccounts] = useState<PfAccount[]>([])

  // ✨ Microinteração: quando spend é criado, dispara pulso verde percorrendo
  // os 3 nós ("ciclo completo"). Anima uma vez, depois desliga.
  const [cyclePulse, setCyclePulse] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/pontes/${id}`, { credentials: 'include' })
      if (r.status === 404) {
        setNotFound(true)
        return
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const j = (await r.json()) as BridgeDetailFull
      setData(j)
    } catch (err) {
      toast({
        title: 'Erro ao carregar',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [id, toast])

  useEffect(() => {
    load()
  }, [load])

  // Carrega categorias EXPENSE + contas PF do perfil ao abrir o painel de gasto.
  // Evita fetch inicial pesado quando a ponte já está gasta (a maioria dos casos).
  useEffect(() => {
    if (!spendPanelOpen || !data) return
    if (pfCategories.length > 0 || pfAccounts.length > 0) return
    const pid = data.bridge.profileId
    Promise.all([
      fetch(`/api/perfis/${pid}/categorias?type=EXPENSE`, { credentials: 'include' })
        .then((r) => r.json())
        .then((j) => setPfCategories(j.categories ?? [])),
      fetch(`/api/perfis/${pid}/contas`, { credentials: 'include' })
        .then((r) => r.json())
        .then((j) => setPfAccounts(j.accounts ?? [])),
    ]).catch(() => {
      // fail-soft — user vê dropdown vazio, escolhe manual
    })
  }, [spendPanelOpen, data, pfCategories.length, pfAccounts.length])

  async function handleDelete(mode: BridgeDeleteMode) {
    try {
      const res = await fetch(`/api/pontes/${id}?mode=${mode}`, { method: 'DELETE' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.erro ?? 'Erro ao excluir')
      }
      toast({ title: '🌉 Ponte removida', description: 'Você pode recriar importando o extrato de novo.' })
      router.push('/dashboard')
    } catch (err) {
      toast({
        title: 'Erro',
        description: (err as Error).message,
        variant: 'destructive',
      })
    }
  }

  const handleSpendCreated = useCallback(
    (spendData: {
      spendTransactionId: string
      description: string
      amount: number
      categoryId: string
      bankAccountId: string
    }) => {
      if (!data) return
      const cat = pfCategories.find((c) => c.id === spendData.categoryId)
      const acc = pfAccounts.find((a) => a.id === spendData.bankAccountId)
      // Update otimista + fecha painel + dispara pulso.
      setData({
        ...data,
        bridge: { ...data.bridge, spendTransactionId: spendData.spendTransactionId },
        spendTransaction: {
          id: spendData.spendTransactionId,
          description: spendData.description,
          amount: spendData.amount,
          date: data.bridge.date, // padrão: mesma data da ponte
          bankAccount: acc ? { id: acc.id, name: acc.name } : null,
          category: cat
            ? { id: cat.id, name: cat.name, color: cat.color }
            : null,
        },
      })
      setSpendPanelOpen(false)
      setCyclePulse(true)
      toast({
        title: '✨ Ciclo completo',
        description: 'O dinheiro entrou e saiu — perfil PF em saldo net zero.',
      })
      // Refetch em background pra pegar estado real do servidor.
      void load()
    },
    [data, pfCategories, pfAccounts, toast, load],
  )

  // ── Loading skeleton (não spinner cru — hero + grid 2 col) ──
  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-10 lg:px-12">
        <div className="mb-6 h-4 w-24 animate-pulse rounded bg-slate-100" />
        <div className="mb-8 h-48 animate-pulse rounded-2xl bg-slate-100" />
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-50" />
            ))}
          </div>
          <div className="h-64 animate-pulse rounded-xl bg-slate-50" />
        </div>
      </main>
    )
  }

  // ── Not found (privacidade: mesma tela pra "não existe" e "não é seu") ──
  if (notFound || !data) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <Card className="border-slate-200">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <div className="rounded-full bg-slate-100 p-3 text-3xl" aria-hidden>
              🌉
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Ponte não encontrada</h2>
            <p className="max-w-sm text-sm text-slate-500">
              Pode ter sido excluída, ou pertence a outro sócio (privacidade).
            </p>
            <Link href="/dashboard" className="mt-2">
              <Button variant="outline" size="sm">
                Voltar pro dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    )
  }

  const kind = KIND_DEFAULTS[data.bridge.kind as BridgeKind]
  const empresaLabel =
    data.pjTransaction.bankAccount?.company.tradeName ??
    data.pjTransaction.bankAccount?.company.name ??
    'a empresa'
  const contaPfLabel = data.pfTransaction.bankAccount?.name ?? 'sua conta PF'
  const contaPjLabel = data.pjTransaction.bankAccount?.name ?? '—'
  const hasSpend = !!data.spendTransaction
  const isDismissed = data.bridge.spendAcknowledged && !hasSpend

  // Sprint Ponte-Detalhe-2Col (07/07/2026): dados derivados pro painel Resumo.
  // Hoje spend é tudo-ou-nada (100% ou 0%). Preparado pra proporcional futuro
  // (spend parcial — quando `spend.amount < bridge.amount`).
  const gasto = hasSpend && data.spendTransaction ? data.spendTransaction.amount : 0
  const total = data.bridge.amount
  const pctUsado = total > 0 ? Math.min(100, Math.max(0, (gasto / total) * 100)) : 0
  const naConta = Math.max(0, total - gasto)

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10 lg:px-12">
      {/* Voltar discreto no topo */}
      <button
        onClick={() => router.back()}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Voltar
      </button>

      {/* ─────────────── HERO ─────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-[#1E3A8A] via-[#1E40AF] to-[#0F4A8C] p-6 text-white shadow-lg sm:p-8"
      >
        {/* Ornamento decorativo (círculos difusos) */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/5 blur-2xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-12 -left-4 h-32 w-32 rounded-full bg-cyan-400/10 blur-2xl"
        />

        <div className="relative">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/70">
            Retirada de {empresaLabel}
          </p>
          <p className="mt-3 text-4xl font-semibold tabular-nums tracking-tight sm:text-5xl">
            {formatBRL(data.bridge.amount)}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
              <span aria-hidden>{kind.emoji}</span>
              {kind.label}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur">
              {kind.affectsDre ? '● Afeta DRE' : '○ Fora do DRE'}
            </span>
          </div>
          <p className="mt-4 text-xs text-white/60">
            {fmtDate(data.bridge.date)} · Criada{' '}
            {data.bridge.createdVia === 'CREATED_FROM_DETECTION' ? 'por detecção' : 'manualmente'}
            {data.bridge.createdBy ? ` por ${data.bridge.createdBy.name}` : ''}
          </p>
        </div>
      </motion.section>

      {/* ─────────────── GRID 2 COLUNAS ─────────────── */}
      {/* Sprint Ponte-Detalhe-2Col (07/07/2026):
          Desktop (lg+): 1fr | 340px lado-a-lado, gap 24px.
          Mobile/tablet: empilha (jornada em cima, resumo embaixo).
          Aproveita a largura do container (max-w-6xl) — antes ficava vazio à
          esquerda em monitores grandes.  */}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* ─── COLUNA ESQUERDA: A JORNADA DO DINHEIRO ─── */}
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6 sm:p-8">
            <div className="mb-6">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
                A jornada do dinheiro
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Do PJ ao PF — e onde foi parar.
              </p>
            </div>

            <section aria-label="Linha do tempo do dinheiro" className="relative">
              <TimelineNode
                index={0}
                icon={<Building2 className="h-5 w-5" aria-hidden />}
                iconTone="slate"
                pulse={cyclePulse}
                title={`Saiu de ${empresaLabel}`}
                subtitle={data.pjTransaction.description}
                meta={
                  <>
                    {fmtDate(data.pjTransaction.date)} · {contaPjLabel}
                    {data.pjTransaction.category ? (
                      <>
                        {' · '}
                        <span className="text-slate-600">
                          {data.pjTransaction.category.name}
                        </span>
                      </>
                    ) : null}
                  </>
                }
                amount={-data.pjTransaction.amount}
                link={{
                  href: `/empresas/${data.bridge.companyId}/transacoes/${data.pjTransaction.id}`,
                  label: 'Ver no PJ',
                }}
              />

              <TimelineNode
                index={1}
                icon={<Wallet className="h-5 w-5" aria-hidden />}
                iconTone="emerald"
                pulse={cyclePulse}
                title={`Entrou em ${contaPfLabel}`}
                subtitle={data.pfTransaction.description}
                meta={
                  <>
                    {fmtDate(data.pfTransaction.date)}
                    {data.pfTransaction.category ? (
                      <>
                        {' · '}
                        <span className="text-slate-600">
                          {data.pfTransaction.category.name}
                        </span>
                      </>
                    ) : null}
                  </>
                }
                amount={data.pfTransaction.amount}
                link={{
                  href: `/perfis/${data.bridge.profileId}/receitas`,
                  label: 'Ver em Receitas',
                }}
              />

              <TimelineNode
                index={2}
                icon={
                  hasSpend ? (
                    <CheckCircle2 className="h-5 w-5" aria-hidden />
                  ) : (
                    <Sparkles className="h-5 w-5" aria-hidden />
                  )
                }
                iconTone={hasSpend ? 'emerald' : isDismissed ? 'slate' : 'amber'}
                pulse={cyclePulse && hasSpend}
                last
                renderBody={() =>
                  hasSpend && data.spendTransaction ? (
                    <SpendRegisteredContent
                      spend={data.spendTransaction}
                      profileId={data.bridge.profileId}
                    />
                  ) : isDismissed ? (
                    <SpendDismissedContent
                      bridgeId={data.bridge.id}
                      onReactivate={load}
                    />
                  ) : (
                    <SpendInvitePrompt
                      bridge={data}
                      open={spendPanelOpen}
                      setOpen={setSpendPanelOpen}
                      pfCategories={pfCategories}
                      pfAccounts={pfAccounts}
                      onCreated={handleSpendCreated}
                    />
                  )
                }
              />
            </section>

            {/* Notas (se houver) — no rodapé do card jornada */}
            {data.bridge.notes && (
              <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Observações
                </p>
                <p className="mt-1.5 text-sm text-slate-800">{data.bridge.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── COLUNA DIREITA: RESUMO (sticky no desktop) ─── */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <ResumoPanel
            pctUsado={pctUsado}
            gasto={gasto}
            naConta={naConta}
            total={total}
            hasSpend={hasSpend}
            socioPF={data.socioPF}
          />
        </div>
      </div>

      {/* ─────────────── RODAPÉ (abaixo do grid) ─────────────── */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="mt-10 space-y-4"
      >
        <p className="text-center text-xs text-slate-400">
          Ponte criada em {fmtDateTime(data.bridge.createdAt)}
        </p>
        <div className="flex justify-center">
          <button
            onClick={() => setShowDelete(true)}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-rose-600"
          >
            <Trash2 className="h-3 w-3" aria-hidden />
            Excluir esta ponte
          </button>
        </div>
      </motion.section>

      <BridgeDeleteModal
        open={showDelete}
        onOpenChange={setShowDelete}
        pjCompanyName={empresaLabel}
        pfAccountName={contaPfLabel}
        amount={data.bridge.amount}
        onConfirm={handleDelete}
      />
    </main>
  )
}

// ─────────────────────────────────────────────
// ResumoPanel — coluna direita (2 col layout)
// ─────────────────────────────────────────────
//
// Mostra: (1) % usado grande verde/âmbar, (2) barra de progresso animada
// preenchendo da esquerda, (3) legenda Gasto/Na conta, (4) sócio compacto.
// Reage automaticamente ao `hasSpend` — quando registrar gasto na timeline,
// pctUsado sobe pra 100% + barra anima (Framer Motion pega o novo width).

interface ResumoPanelProps {
  pctUsado: number
  gasto: number
  naConta: number
  total: number
  hasSpend: boolean
  socioPF: BridgeDetailFull['socioPF']
}

function ResumoPanel({
  pctUsado,
  gasto,
  naConta,
  total,
  hasSpend,
  socioPF,
}: ResumoPanelProps) {
  const isComplete = pctUsado >= 100
  const pctRounded = Math.round(pctUsado)

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardContent className="space-y-6 p-6">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
            Resumo
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Onde esse dinheiro está agora.
          </p>
        </div>

        {/* Stat central: % usado */}
        <div>
          <p className="text-xs text-slate-500">
            {hasSpend ? 'Deste dinheiro, você já usou' : 'Ainda na sua conta'}
          </p>
          <p
            className={`mt-1.5 text-4xl font-semibold tabular-nums tracking-tight ${
              isComplete ? 'text-emerald-600' : 'text-slate-900'
            }`}
          >
            {pctRounded}%
          </p>
        </div>

        {/* Barra de progresso animada */}
        <div>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-valuenow={pctRounded}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pctUsado}%` }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className={`h-full rounded-full ${
                isComplete ? 'bg-emerald-500' : 'bg-amber-400'
              }`}
            />
          </div>
          <div className="mt-3 flex items-start justify-between gap-4 text-xs">
            <div>
              <p className="text-slate-500">Gasto</p>
              <p className="mt-0.5 font-medium tabular-nums text-slate-900">
                {formatBRL(gasto)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-slate-500">Na conta</p>
              <p className="mt-0.5 font-medium tabular-nums text-slate-900">
                {formatBRL(naConta)}
              </p>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-slate-400">
            Total: <span className="tabular-nums">{formatBRL(total)}</span>
          </p>
        </div>

        {/* Sócio rastreado (compacto) */}
        {socioPF && (
          <div className="border-t border-slate-100 pt-5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Sócio rastreado
            </p>
            <div className="mt-2.5 flex items-start gap-3">
              <div className="rounded-full bg-slate-100 p-2">
                <User className="h-3.5 w-3.5 text-slate-500" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">
                  {socioPF.nome}
                </p>
                <p className="text-xs text-slate-500">
                  CPF {maskCpf(socioPF.cpf)} · {socioPF.papel.toLowerCase()}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────
// TimelineNode — nó da timeline (com conector vertical)
// ─────────────────────────────────────────────

interface TimelineNodeProps {
  index: number
  icon: React.ReactNode
  iconTone: 'slate' | 'emerald' | 'amber'
  pulse: boolean
  /** Título opcional — obrigatório apenas quando `renderBody` NÃO é usado
   *  (nó 1 e 2). Quando `renderBody` desenha um card próprio, o título
   *  perde valor visual e some. */
  title?: string
  subtitle?: string
  meta?: React.ReactNode
  amount?: number
  link?: { href: string; label: string }
  last?: boolean
  renderBody?: () => React.ReactNode
}

const TONE_STYLES: Record<
  TimelineNodeProps['iconTone'],
  { bg: string; text: string; ring: string; pulseRing: string }
> = {
  slate: {
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    ring: 'ring-slate-200',
    pulseRing: 'ring-slate-300',
  },
  emerald: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-600',
    ring: 'ring-emerald-100',
    pulseRing: 'ring-emerald-300',
  },
  amber: {
    bg: 'bg-amber-50',
    text: 'text-amber-600',
    ring: 'ring-amber-100',
    pulseRing: 'ring-amber-300',
  },
}

function TimelineNode(props: TimelineNodeProps) {
  const {
    index,
    icon,
    iconTone,
    pulse,
    title,
    subtitle,
    meta,
    amount,
    link,
    last,
    renderBody,
  } = props
  const tone = TONE_STYLES[iconTone]

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: 0.15 + index * 0.08,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="relative flex gap-4 pb-6 last:pb-0"
    >
      {/* Ícone + conector vertical */}
      <div className="flex flex-col items-center">
        <div
          className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone.bg} ${tone.text} ring-4 ring-white`}
        >
          {icon}
          {/* Pulso quando ciclo completa (só nós verdes) */}
          <AnimatePresence>
            {pulse && (
              <motion.span
                key={`pulse-${index}`}
                initial={{ opacity: 0.6, scale: 1 }}
                animate={{ opacity: 0, scale: 1.8 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.2, delay: index * 0.15, ease: 'easeOut' }}
                className={`absolute inset-0 rounded-full ${tone.pulseRing} ring-4`}
                aria-hidden
              />
            )}
          </AnimatePresence>
        </div>
        {!last && (
          <div className="mt-1 w-px flex-1 bg-gradient-to-b from-slate-200 to-slate-100" />
        )}
      </div>

      {/* Conteúdo do nó */}
      <div className="min-w-0 flex-1">
        {renderBody ? (
          <div>
            {title && (
              <p className="mb-2 text-sm font-semibold text-slate-900">{title}</p>
            )}
            {renderBody()}
          </div>
        ) : (
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">{title}</p>
                {subtitle && (
                  <p className="mt-0.5 truncate text-sm text-slate-600">{subtitle}</p>
                )}
                {meta && <p className="mt-1 text-xs text-slate-500">{meta}</p>}
              </div>
              {typeof amount === 'number' && (
                <p
                  className={`whitespace-nowrap text-base font-semibold tabular-nums ${
                    amount < 0 ? 'text-slate-700' : 'text-emerald-600'
                  }`}
                >
                  {amount < 0 ? '−' : '+'}
                  {formatBRL(Math.abs(amount))}
                </p>
              )}
            </div>
            {link && (
              <Link
                href={link.href}
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-900"
              >
                {link.label}
                <ExternalLink className="h-3 w-3" aria-hidden />
              </Link>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// Nó 3 · Registrado (fluxo B já concluído)
// ─────────────────────────────────────────────

function SpendRegisteredContent({
  spend,
  profileId,
}: {
  spend: NonNullable<BridgeDetailFull['spendTransaction']>
  profileId: string
}) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
            Ciclo fechado
          </p>
          <p className="mt-1 truncate text-sm font-medium text-slate-900">
            Foi gasto em{' '}
            <span className="text-emerald-700">
              {spend.category?.name ?? 'sem categoria'}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {fmtDate(spend.date)}
            {spend.bankAccount ? ` · ${spend.bankAccount.name}` : ''}
          </p>
        </div>
        <p className="whitespace-nowrap text-base font-semibold tabular-nums text-slate-700">
          −{formatBRL(spend.amount)}
        </p>
      </div>
      <Link
        href={`/perfis/${profileId}/despesas`}
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 transition-colors hover:text-emerald-900"
      >
        Ver em Despesas
        <ExternalLink className="h-3 w-3" aria-hidden />
      </Link>
    </div>
  )
}

// ─────────────────────────────────────────────
// Nó 3 · Dismissado (user disse "Agora não")
// ─────────────────────────────────────────────

function SpendDismissedContent({
  bridgeId,
  onReactivate,
}: {
  bridgeId: string
  onReactivate: () => void
}) {
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()
  async function reativar() {
    setBusy(true)
    try {
      const r = await fetch(`/api/pontes/${bridgeId}/spend`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledged: false }),
      })
      if (!r.ok) throw new Error()
      onReactivate()
    } catch {
      toast({ title: 'Erro ao reativar', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <p className="text-sm text-slate-700">
        Você marcou &quot;Agora não&quot; nesta ponte.
      </p>
      <button
        onClick={reativar}
        disabled={busy}
        className="mt-2 text-xs font-medium text-slate-600 underline underline-offset-4 hover:text-slate-900 disabled:opacity-50"
      >
        {busy ? 'Reativando…' : 'Reativar convite'}
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────
// Nó 3 · Convite (Fluxo B — registrar gasto)
// ─────────────────────────────────────────────

function SpendInvitePrompt({
  bridge,
  open,
  setOpen,
  pfCategories,
  pfAccounts,
  onCreated,
}: {
  bridge: BridgeDetailFull
  open: boolean
  setOpen: (v: boolean) => void
  pfCategories: PfCategory[]
  pfAccounts: PfAccount[]
  onCreated: (data: {
    spendTransactionId: string
    description: string
    amount: number
    categoryId: string
    bankAccountId: string
  }) => void
}) {
  const { toast } = useToast()
  const suggestion = useMemo(
    () => suggestSpendCategory(bridge.pjTransaction.description),
    [bridge.pjTransaction.description],
  )
  const [categoryId, setCategoryId] = useState('')
  const [bankAccountId, setBankAccountId] = useState('')
  const [amount, setAmount] = useState(bridge.bridge.amount.toFixed(2))
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)

  // Auto-preenche categoria + conta + descrição quando categorias/contas
  // carregam (matching por nome pra encontrar a sugestão no plano do perfil).
  useEffect(() => {
    if (!open) return
    if (!categoryId && suggestion && pfCategories.length > 0) {
      const match = pfCategories.find(
        (c) => c.name.toLowerCase() === suggestion.categoryName.toLowerCase(),
      )
      if (match) setCategoryId(match.id)
    }
    if (!bankAccountId && pfAccounts.length > 0) {
      // Prefere a mesma conta da entrada PF (net zero se amount igual)
      const preferred = pfAccounts.find(
        (a) => a.id === bridge.pfTransaction.bankAccount?.id,
      )
      setBankAccountId(preferred?.id ?? pfAccounts[0]?.id ?? '')
    }
    if (!description) {
      const catName = suggestion?.categoryName ?? 'Despesa'
      setDescription(`${catName} — ${bridge.pjTransaction.description}`.slice(0, 200))
    }
  }, [
    open,
    suggestion,
    pfCategories,
    pfAccounts,
    categoryId,
    bankAccountId,
    description,
    bridge,
  ])

  async function confirmar() {
    const valorNum = Number(amount.replace(',', '.'))
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      toast({ title: 'Valor inválido', variant: 'destructive' })
      return
    }
    if (!categoryId) {
      toast({ title: 'Escolha uma categoria', variant: 'destructive' })
      return
    }
    if (!bankAccountId) {
      toast({ title: 'Escolha uma conta PF', variant: 'destructive' })
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/pontes/${bridge.bridge.id}/spend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: valorNum,
          date: new Date(bridge.bridge.date).toISOString(),
          description: description.trim() || 'Despesa',
          bankAccountId,
          categoryId,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.erro ?? 'Erro ao registrar gasto')
      }
      const body = (await res.json()) as { spendTransactionId: string; bridgeId: string }
      onCreated({
        spendTransactionId: body.spendTransactionId,
        description: description.trim() || 'Despesa',
        amount: valorNum,
        categoryId,
        bankAccountId,
      })
    } catch (err) {
      toast({
        title: 'Erro',
        description: (err as Error).message,
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  async function agoraNao() {
    setBusy(true)
    try {
      const res = await fetch(`/api/pontes/${bridge.bridge.id}/spend`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledged: true }),
      })
      if (!res.ok) throw new Error()
      // Fecha painel + refetch (parent atualiza estado)
      setOpen(false)
      window.location.reload()
    } catch {
      toast({ title: 'Erro', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <motion.button
        type="button"
        onClick={() => setOpen(!open)}
        whileTap={{ scale: 0.98 }}
        className="group flex w-full items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-left transition-colors hover:bg-amber-50"
      >
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
            Falta fechar o ciclo
          </p>
          <p className="mt-1 text-sm font-medium text-slate-900">
            Esse dinheiro já foi gasto?
          </p>
          <p className="mt-0.5 text-xs text-slate-600">
            Registre onde foi pra ver o ciclo completo no seu PF.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm">
          {open ? 'Fechar' : 'Registrar'}
          <ArrowRight
            className={`h-3 w-3 transition-transform ${open ? 'rotate-90' : 'group-hover:translate-x-0.5'}`}
            aria-hidden
          />
        </span>
      </motion.button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="spend-panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-4 rounded-xl border border-slate-200 bg-white p-4">
              {/* Categoria + sugestão */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <Label className="text-xs font-medium text-slate-700">
                    Categoria da despesa
                  </Label>
                  {suggestion && categoryId && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                      <Sparkles className="h-2.5 w-2.5" aria-hidden />
                      sugerido pela IA
                    </span>
                  )}
                </div>
                <CategoryCombobox
                  value={categoryId || null}
                  categorias={pfCategories.map((c) => ({
                    id: c.id,
                    name: c.name,
                    color: c.color,
                    type: c.type ?? 'EXPENSE',
                    dreGroup: null,
                  }))}
                  onChange={(v) => setCategoryId(v ?? '')}
                  placeholder="Escolha ou crie…"
                  className="h-9 w-full justify-between border-input text-sm"
                  ariaLabel="Categoria da despesa PF"
                />
              </div>

              {/* Valor + Conta lado-a-lado no desktop */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs font-medium text-slate-700">Valor</Label>
                  <Input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    inputMode="decimal"
                    className="mt-1 h-9 tabular-nums"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-700">Conta PF</Label>
                  <select
                    value={bankAccountId}
                    onChange={(e) => setBankAccountId(e.target.value)}
                    className="mt-1 h-9 w-full rounded-md border border-input bg-white px-3 text-sm"
                  >
                    <option value="">Selecione…</option>
                    {pfAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Descrição */}
              <div>
                <Label className="text-xs font-medium text-slate-700">Descrição</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={200}
                  className="mt-1 h-9 text-sm"
                />
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  onClick={agoraNao}
                  disabled={busy}
                  className="text-xs text-slate-500 underline underline-offset-4 hover:text-slate-900 disabled:opacity-50"
                >
                  Agora não
                </button>
                <Button onClick={confirmar} disabled={busy} className="gap-1.5">
                  {busy ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      Registrando…
                    </>
                  ) : (
                    <>
                      Confirmar gasto
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
