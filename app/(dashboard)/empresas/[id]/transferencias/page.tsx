// Sprint Transferências Redesign (28/06/2026, Mercury/Ramp).
//
// DASHBOARD navegável: 4 KPIs clicáveis → subtelas detalhadas + gráfico de
// fluxo entre contas + CTA pra fila de revisão.
//
// NÃO mexe na lógica de detecção/pareamento/DRE — só camada de apresentação.
// Reusa endpoints existentes via novo endpoint agregador dashboard-summary.

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  CircleCheckBig,
  Sparkles,
  AlertTriangle,
  ArrowLeftRight,
  Plus,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'
import { NovaTransferenciaModal } from '@/components/transferencias/NovaTransferenciaModal'
import { KPICard } from './_components/KPICard'
import { FluxoContas } from './_components/FluxoContas'

interface DashboardData {
  periodo: { inicio: string; fim: string; rotulo: string }
  kpis: {
    conciliado: { count: number; valor: number }
    revisar: { count: number; valor: number }
    duplicatas: { count: number }
    movimentado: { valor: number }
  }
  fluxoPorConta: Array<{
    id: string
    name: string
    bankName: string | null
    accountKind: 'PJ' | 'PF'
    enviado: number
    recebido: number
    countOut: number
    countIn: number
  }>
  insight: string
}

interface Conta {
  id: string
  name: string
}

export default function TransferenciasDashboard() {
  const params = useParams<{ id: string }>()
  const empresaId = params.id
  const { toast } = useToast()
  const [data, setData] = useState<DashboardData | null>(null)
  const [contas, setContas] = useState<Conta[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [empresaNome, setEmpresaNome] = useState<string>('')

  async function reload() {
    setLoading(true)
    try {
      const [summaryRes, contasRes, empresaRes] = await Promise.all([
        fetch(`/api/empresas/${empresaId}/transferencias/dashboard-summary`, {
          credentials: 'include',
        }),
        fetch(`/api/contas-bancarias?empresaId=${empresaId}`, { credentials: 'include' }),
        fetch(`/api/empresas/${empresaId}`, { credentials: 'include' }),
      ])
      if (summaryRes.ok) setData(await summaryRes.json())
      if (contasRes.ok) {
        const d = await contasRes.json()
        setContas(d.contas ?? [])
      }
      if (empresaRes.ok) {
        const d = await empresaRes.json()
        setEmpresaNome(d.empresa?.tradeName ?? d.empresa?.name ?? '')
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao carregar' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
  }, [empresaId]) // eslint-disable-line react-hooks/exhaustive-deps

  const kpis = data?.kpis
  const periodo = data?.periodo
  const fluxoTotal = (kpis?.conciliado.valor ?? 0)
  const temPraRevisar = (kpis?.revisar.count ?? 0) > 0

  return (
    <div className="space-y-6">
      <Header
        title="Transferências entre contas"
        description={
          periodo
            ? `${empresaNome ? empresaNome + ' · ' : ''}${capitalize(periodo.rotulo)}`
            : empresaNome || 'Movimentação entre contas'
        }
      >
        <Button variant="outline" asChild>
          <Link href={`/empresas/${empresaId}`}>← Empresa</Link>
        </Button>
        <Button onClick={() => setModalOpen(true)} disabled={contas.length < 2}>
          <Plus className="mr-2 h-4 w-4" />
          Nova transferência
        </Button>
      </Header>

      {/* Sem 2 contas: aviso */}
      {contas.length < 2 && !loading && (
        <Card className="rounded-xl border-amber-200/60 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/15">
          <CardContent className="py-4 text-sm">
            Você precisa de pelo menos 2 contas bancárias cadastradas pra criar
            transferências.{' '}
            <Link
              href={`/empresas/${empresaId}/contas`}
              className="underline font-medium"
            >
              Ir pra Contas
            </Link>
          </CardContent>
        </Card>
      )}

      {/* CTA — só quando há revisão pendente */}
      {temPraRevisar && (
        <Link
          href={`/empresas/${empresaId}/transferencias/revisar`}
          className="block rounded-xl border border-blue-200/60 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/15 p-4 hover:bg-blue-50/70 dark:hover:bg-blue-950/25 transition-colors"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  {kpis!.revisar.count} {kpis!.revisar.count === 1 ? 'transferência aguardando você' : 'transferências aguardando você'}
                </p>
                <p className="text-xs text-blue-700/80 dark:text-blue-300/80">
                  {formatBRL(kpis!.revisar.valor)} em movimentação pendente · prontas pra confirmar
                </p>
              </div>
            </div>
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300 inline-flex items-center gap-0.5">
              Revisar agora <ChevronRight className="h-4 w-4" />
            </span>
          </div>
        </Link>
      )}

      {/* 4 KPIs clicáveis */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          href={`/empresas/${empresaId}/transferencias/conciliadas`}
          label="Conciliado"
          value={kpis ? `${kpis.conciliado.count}` : '—'}
          hint={kpis ? formatBRL(kpis.conciliado.valor) : undefined}
          icon={CircleCheckBig}
          tone="emerald"
        />
        <KPICard
          href={`/empresas/${empresaId}/transferencias/revisar`}
          label="Pra revisar"
          value={kpis ? `${kpis.revisar.count}` : '—'}
          hint={kpis && kpis.revisar.valor > 0 ? formatBRL(kpis.revisar.valor) : undefined}
          icon={Sparkles}
          tone="blue"
        />
        <KPICard
          href={`/empresas/${empresaId}/transferencias/duplicatas`}
          label="Duplicatas"
          value={kpis ? `${kpis.duplicatas.count}` : '—'}
          hint={kpis?.duplicatas.count === 0 ? 'Nada suspeito' : undefined}
          icon={AlertTriangle}
          tone="amber"
        />
        <KPICard
          href={`/empresas/${empresaId}/transferencias/conciliadas`}
          label="Movimentado no mês"
          value={kpis ? formatBRL(fluxoTotal) : '—'}
          hint={kpis && kpis.conciliado.count > 0 ? `${kpis.conciliado.count} transferências` : undefined}
          icon={ArrowLeftRight}
          tone="slate"
        />
      </div>

      {/* Fluxo entre contas */}
      {data && <FluxoContas contas={data.fluxoPorConta} insight={data.insight} />}

      {/* Loading state */}
      {loading && !data && (
        <Card className="rounded-xl border-slate-200/70 dark:border-slate-800/70">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Carregando…
          </CardContent>
        </Card>
      )}

      <NovaTransferenciaModal
        empresaId={empresaId}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSuccess={() => {
          setModalOpen(false)
          reload()
        }}
      />
    </div>
  )
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
