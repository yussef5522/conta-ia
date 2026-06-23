// Sprint 7 — Dashboard estilo Mercury (server component).
// Sprint 8 — moldura cards + 3 widgets (fluxo de caixa, fornecedores, receita por forma).
//
// FONTE ÚNICA: motor único (lib/dashboard/engine.ts + widgets.ts).
//
// Layout final (Sprint 8):
//   [seletor já está na page]
//   1. Card SALDO + chips de contas
//   2. 3 metric cards (Receita / Despesa / Resultado)
//   3. Card FLUXO DE CAIXA 6m
//   4. Card RECEITA POR FORMA  |  Card MAIORES FORNECEDORES (lado a lado em desktop)
//   5. Card PRECISA DE VOCÊ (só se houver pendentes reais)
//   6. Card TOP 5 DESPESAS (clicável)

import { Suspense } from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  Wallet,
  ArrowRight,
  Inbox,
  ChevronRight,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatBRL } from '@/lib/format/money'
import { getDashboardData, type CustomPeriod, type Regime } from '@/lib/dashboard/engine'
import { TopCategoriesChart } from './TopCategoriesChart'
import { CashflowMensalWidget } from './CashflowMensalWidget'
import { ReceitaPorFormaWidget } from './ReceitaPorFormaWidget'
import { MaioresFornecedoresWidget } from './MaioresFornecedoresWidget'

interface MercuryDashboardProps {
  empresaId: string
  regime: Regime
  customPeriod: CustomPeriod // sempre passado pelo page.tsx
  periodLabel: string
}

export async function MercuryDashboard(props: MercuryDashboardProps) {
  const data = await getDashboardData(
    props.empresaId,
    new Date(),
    props.regime,
    props.customPeriod,
  )

  // Selo "conciliado": só quando TODAS as contas com ledgerBal batem
  const contasConciliadas = data.saldosPorConta.filter((c) => c.ledgerBal !== null)
  const todasBatem = contasConciliadas.length > 0 &&
    contasConciliadas.every((c) => Math.abs(c.balance - (c.ledgerBal ?? 0)) <= 0.01)

  const margem = data.receitaBruta > 0
    ? (data.lucroLiquido / data.receitaBruta) * 100
    : null

  return (
    <div className="space-y-3">
      {/* ===== 1. CARD SALDO + CONTAS ===== */}
      <Card>
        <CardContent className="py-5 space-y-5">
          {/* Hero */}
          <div>
            <div className="flex items-baseline gap-2.5 text-sm text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" />
              Saldo total · todas as contas
              {todasBatem && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="h-3 w-3" />
                  conciliado
                </span>
              )}
            </div>
            <div
              className={`mt-1.5 text-[38px] leading-none font-medium tabular-nums tracking-tight ${
                data.saldoAtual < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'
              }`}
            >
              {formatBRL(data.saldoAtual)}
            </div>
            <div className="mt-1.5 text-xs text-muted-foreground">
              {props.periodLabel}
            </div>
          </div>

          {/* Mini-cards de contas */}
          {data.saldosPorConta.length > 0 && (
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
                Contas
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {data.saldosPorConta.map((conta) => (
                  <Link
                    key={conta.bankAccountId}
                    href={`/empresas/${props.empresaId}/contas/${conta.bankAccountId}`}
                    className="group rounded-md bg-muted/40 hover:bg-muted/60 px-3 py-2 transition-colors"
                  >
                    <div className="text-[11px] text-muted-foreground capitalize truncate">
                      {conta.name}
                    </div>
                    <div
                      className={`text-sm font-medium tabular-nums ${
                        conta.balance < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'
                      }`}
                    >
                      {formatBRL(conta.balance)}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== 2. 3 MÉTRICAS ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricCard
          label="Receita bruta"
          value={data.receitaBruta}
          tone="neutral"
        />
        <MetricCard
          label="Despesa operacional"
          value={data.despesaOperacional}
          tone="negative"
          href={`/empresas/${props.empresaId}/despesas`}
        />
        <MetricCard
          label="Resultado"
          value={data.lucroLiquido}
          tone={data.lucroLiquido >= 0 ? 'positive' : 'negative'}
          subtitle={margem !== null ? `margem ${margem.toFixed(1)}%` : undefined}
        />
      </div>

      {/* ===== 3. FLUXO DE CAIXA 6M ===== */}
      <Suspense fallback={<WidgetSkeleton h={280} />}>
        <CashflowMensalWidget empresaId={props.empresaId} regime={props.regime} />
      </Suspense>

      {/* ===== 4. RECEITA POR FORMA | MAIORES FORNECEDORES (lado a lado) ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Suspense fallback={<WidgetSkeleton h={280} />}>
          <ReceitaPorFormaWidget
            empresaId={props.empresaId}
            regime={props.regime}
            customPeriod={props.customPeriod}
          />
        </Suspense>
        <Suspense fallback={<WidgetSkeleton h={280} />}>
          <MaioresFornecedoresWidget
            empresaId={props.empresaId}
            regime={props.regime}
            customPeriod={props.customPeriod}
          />
        </Suspense>
      </div>

      {/* ===== 5. PRECISA DE VOCÊ — só itens reais ===== */}
      <PrecisaDeVoce
        empresaId={props.empresaId}
        pendentesClassificar={data.pendentes.total}
      />

      {/* ===== 6. TOP 5 DESPESAS — clicável (Sprint 6) ===== */}
      {data.top5Despesas.items.length > 0 && (
        <Card>
          <CardContent className="py-5">
            <div className="flex items-baseline justify-between mb-4">
              <div className="text-sm font-medium">Top 5 despesas</div>
              <Link
                href={`/empresas/${props.empresaId}/despesas`}
                className="text-xs text-foreground hover:underline underline-offset-2 inline-flex items-center gap-1"
              >
                Ver todas
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="flex items-center gap-6 flex-col sm:flex-row">
              <div className="shrink-0">
                <TopCategoriesChart items={data.top5Despesas.items} size={120} />
              </div>
              <ul className="flex-1 space-y-1 min-w-0 w-full">
                {data.top5Despesas.items.map((item) => (
                  <li key={item.categoryId}>
                    <Link
                      href={`/empresas/${props.empresaId}/despesas?cat=${item.categoryId}`}
                      className="flex items-center gap-3 text-sm px-2 py-1.5 -mx-2 rounded-md hover:bg-muted/60 transition-colors group"
                    >
                      <span
                        aria-hidden
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="flex-1 truncate text-foreground">
                        {item.name}
                      </span>
                      <span className="font-medium tabular-nums shrink-0">
                        {formatBRL(item.amount)}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0 w-12 text-right">
                        {item.percent.toFixed(1)}%
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer técnico */}
      <p className="text-[10px] text-muted-foreground text-center pt-4">
        Fonte única: <span className="font-mono">getDashboardData</span> ·
        regime <span className="font-medium">{props.regime}</span> ·
        TRANSFER + distribuição + investimento fora ·
        bate com /despesas e DRE ao centavo
      </p>
    </div>
  )
}

// ============================================================
// Subcomponentes
// ============================================================

function MetricCard({
  label,
  value,
  tone,
  subtitle,
  href,
}: {
  label: string
  value: number
  tone: 'neutral' | 'positive' | 'negative'
  subtitle?: string
  href?: string
}) {
  const valueClass =
    tone === 'negative'
      ? 'text-rose-600 dark:text-rose-400'
      : tone === 'positive'
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-foreground'

  const content = (
    <Card className="h-full hover:border-foreground/30 transition-colors">
      <CardContent className="py-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`mt-1.5 text-2xl font-medium tabular-nums tracking-tight ${valueClass}`}>
          {formatBRL(value)}
        </div>
        {subtitle && (
          <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>
        )}
      </CardContent>
    </Card>
  )

  if (href) return <Link href={href}>{content}</Link>
  return content
}

function PrecisaDeVoce({
  empresaId,
  pendentesClassificar,
}: {
  empresaId: string
  pendentesClassificar: number
}) {
  // Só itens REAIS do motor. Se N=0, esconde a seção inteira.
  const items: Array<{ icon: typeof Inbox; label: string; n: number; href: string }> = []
  if (pendentesClassificar > 0) {
    items.push({
      icon: Inbox,
      label: 'a categorizar',
      n: pendentesClassificar,
      href: `/pendentes?empresaId=${empresaId}`,
    })
  }
  if (items.length === 0) return null

  return (
    <Card>
      <CardContent className="py-3">
        <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2 px-1">
          Precisa de você
        </div>
        <ul className="divide-y">
          {items.map((it) => {
            const Icon = it.icon
            return (
              <li key={it.label}>
                <Link
                  href={it.href}
                  className="flex items-center justify-between gap-3 py-2.5 px-1 hover:bg-muted/40 transition-colors -mx-1 rounded"
                >
                  <div className="flex items-center gap-2.5 text-sm">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium tabular-nums">{it.n}</span>
                    <span className="text-muted-foreground">{it.label}</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                </Link>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

function WidgetSkeleton({ h }: { h: number }) {
  return (
    <Card>
      <CardContent className="py-5">
        <Skeleton style={{ height: h - 40 }} className="w-full" />
      </CardContent>
    </Card>
  )
}
