'use client'

// Tabela hierárquica do DRE (Sub-etapa 5.4.B).
// Grupos colapsáveis com categorias indentadas, subtotais oficiais Lei 6.404,
// margens, uncategorized warning e seção colapsável de não-DRE.

import { ChevronRight, AlertTriangle, Info } from 'lucide-react'
import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatBRL, formatPercent, formatPercentSigned } from '@/lib/format/dre'

// ============================================================
// Types (espelham lib/dre/types.ts ao formato JSON do endpoint)
// ============================================================

export interface DRECategoryItem {
  category: { id: string; name: string; code: string | null }
  total: number
  transactionCount: number
  verticalPct: number | null
  horizontalDelta: number | null
  horizontalPct: number | null
  children: DRECategoryItem[]
}

export interface DREGroupResult {
  group: string
  groupLabel: string
  sign: 'positive' | 'negative'
  categories: DRECategoryItem[]
  total: number
  verticalPct: number | null
  horizontalDelta: number | null
  horizontalPct: number | null
}

export interface DRETotals {
  receitaBruta: number
  totalDeducoes: number
  receitaLiquida: number
  totalCustos: number
  lucroBruto: number
  totalOutrasReceitas: number
  totalDespesasPessoal: number
  totalDespesasComerciais: number
  totalDespesasAdministrativas: number
  totalOutrasDespesas: number
  totalDespesasOperacionais: number
  resultadoOperacional: number
  receitasFinanceiras: number
  despesasFinanceiras: number
  resultadoFinanceiro: number
  lair: number
  impostosSobreLucro: number
  lucroLiquido: number
  margemBruta: number
  margemOperacional: number
  margemLiquida: number
}

export interface NonDREGroupResult {
  group: string
  groupLabel: string
  total: number
  transactionCount: number
}

export interface DREResult {
  period: { startDate: string; endDate: string; regime: 'competence' | 'cash' }
  comparisonPeriod:
    | { startDate: string; endDate: string; regime: 'competence' | 'cash' }
    | null
  groups: DREGroupResult[]
  totals: DRETotals
  uncategorized: { total: number; transactionCount: number }
  nonDreGroups: NonDREGroupResult[]
  totalsComparison: {
    receitaLiquidaDelta: number | null
    receitaLiquidaPct: number | null
    lucroLiquidoDelta: number | null
    lucroLiquidoPct: number | null
    margemLiquidaDelta: number | null
  }
  metadata: {
    transactionsProcessed: number
    categoriesUsed: number
    calculatedAt: string
  }
}

interface Props {
  data: DREResult
  onCategoryClick: (categoryId: string) => void
}

// ============================================================
// Helpers de cor semântica
// ============================================================

// Indica se grupo é "receita" (esperamos crescer) ou "despesa" (esperamos reduzir)
function isRevenueGroup(groupKey: string): boolean {
  return ['RECEITA_BRUTA', 'OUTRAS_RECEITAS', 'RECEITAS_FINANCEIRAS'].includes(
    groupKey,
  )
}

// Cor da variação horizontal:
// - Receita ↑ = verde (cresceu)
// - Despesa ↓ = verde (gastou MENOS)
// - Receita ↓ = vermelho
// - Despesa ↑ = vermelho
function variationColor(groupKey: string, deltaPct: number | null): string {
  if (deltaPct === null) return 'text-muted-foreground'
  if (deltaPct === 0) return 'text-muted-foreground'
  const isRevenue = isRevenueGroup(groupKey)
  const positiveDelta = deltaPct > 0
  const isGood = isRevenue ? positiveDelta : !positiveDelta
  return isGood
    ? 'text-emerald-700 dark:text-emerald-400'
    : 'text-rose-700 dark:text-rose-400'
}

// ============================================================
// Componente principal
// ============================================================

export function DRETable({ data, onCategoryClick }: Props) {
  const hasComparison = data.comparisonPeriod !== null
  const rl = data.totals.receitaLiquida
  const verticalOver = (v: number): number | null =>
    rl !== 0 ? (v / rl) * 100 : null

  return (
    <Card className="overflow-hidden">
      {/* Header da tabela */}
      <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-muted/50 border-b text-xs font-semibold text-muted-foreground uppercase">
        <div className="col-span-6">Item</div>
        <div className="col-span-2 text-right">Atual</div>
        <div className="col-span-2 text-right">Vertical %</div>
        {hasComparison && <div className="col-span-2 text-right">Variação</div>}
      </div>

      {/* Corpo */}
      <div className="divide-y">
        {data.groups.map((group) => (
          <DREGroupRow
            key={group.group}
            group={group}
            hasComparison={hasComparison}
            onCategoryClick={onCategoryClick}
          />
        ))}

        {/* Subtotais calculados (só aparecem se tem Receita Líquida ou impacto) */}
        <SubtotalRow
          label="= Receita Líquida"
          value={data.totals.receitaLiquida}
          hasComparison={hasComparison}
          verticalPct={verticalOver(data.totals.receitaLiquida)}
        />
        <SubtotalRow
          label="= Lucro Bruto"
          value={data.totals.lucroBruto}
          hasComparison={hasComparison}
          verticalPct={verticalOver(data.totals.lucroBruto)}
        />
        <SubtotalRow
          label="= Resultado Operacional"
          value={data.totals.resultadoOperacional}
          hasComparison={hasComparison}
          verticalPct={verticalOver(data.totals.resultadoOperacional)}
        />
        <SubtotalRow
          label="= LAIR (Lucro Antes do IR)"
          value={data.totals.lair}
          hasComparison={hasComparison}
          verticalPct={verticalOver(data.totals.lair)}
        />

        {/* Linha final destacada */}
        <FinalRow
          label="= Lucro Líquido do Exercício"
          value={data.totals.lucroLiquido}
          margemPct={data.totals.margemLiquida}
          hasComparison={hasComparison}
          rl={rl}
        />

        {/* Margens summary */}
        <MarginsRow totals={data.totals} />
      </div>

      {/* Uncategorized (se houver) */}
      {data.uncategorized.transactionCount > 0 && (
        <UncategorizedSection data={data.uncategorized} />
      )}

      {/* nonDreGroups (info) */}
      {data.nonDreGroups.length > 0 && <NonDreSection groups={data.nonDreGroups} />}
    </Card>
  )
}

// ============================================================
// Linha de grupo (colapsável)
// ============================================================

interface GroupRowProps {
  group: DREGroupResult
  hasComparison: boolean
  onCategoryClick: (catId: string) => void
}

function DREGroupRow({ group, hasComparison, onCategoryClick }: GroupRowProps) {
  const [expanded, setExpanded] = useState(true)
  const sign = group.sign === 'negative' ? '−' : '+'

  return (
    <div>
      {/* Linha do grupo */}
      <button
        type="button"
        className="w-full grid grid-cols-12 gap-2 px-4 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="col-span-6 flex items-center gap-2">
          <ChevronRight
            className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
          />
          <span className="font-semibold">
            <span className="text-muted-foreground mr-1">{sign}</span>
            {group.groupLabel}
          </span>
          {group.categories.length > 0 && (
            <Badge variant="outline" className="text-xs ml-1">
              {group.categories.length}
            </Badge>
          )}
        </div>
        <div className="col-span-2 text-right font-semibold tabular-nums">
          {formatBRL(group.total)}
        </div>
        <div className="col-span-2 text-right text-sm tabular-nums text-muted-foreground">
          {formatPercent(group.verticalPct)}
        </div>
        {hasComparison && (
          <div
            className={`col-span-2 text-right text-sm tabular-nums ${variationColor(
              group.group,
              group.horizontalPct,
            )}`}
          >
            {formatPercentSigned(group.horizontalPct)}
          </div>
        )}
      </button>

      {/* Categorias filhas (se expandido) */}
      {expanded &&
        group.categories.map((cat) => (
          <CategoryRow
            key={cat.category.id}
            cat={cat}
            groupKey={group.group}
            hasComparison={hasComparison}
            onClick={() => onCategoryClick(cat.category.id)}
          />
        ))}
    </div>
  )
}

interface CategoryRowProps {
  cat: DRECategoryItem
  groupKey: string
  hasComparison: boolean
  onClick: () => void
}

function CategoryRow({ cat, groupKey, hasComparison, onClick }: CategoryRowProps) {
  return (
    <button
      type="button"
      className="w-full grid grid-cols-12 gap-2 px-4 py-1.5 cursor-pointer hover:bg-muted/30 transition-colors text-sm text-left"
      onClick={onClick}
    >
      <div className="col-span-6 flex items-center gap-2 pl-8">
        <span className="text-muted-foreground truncate">
          {cat.category.code && (
            <span className="font-mono text-xs mr-2">{cat.category.code}</span>
          )}
          {cat.category.name}
        </span>
        <Badge variant="outline" className="text-xs shrink-0">
          {cat.transactionCount}
        </Badge>
      </div>
      <div className="col-span-2 text-right tabular-nums">{formatBRL(cat.total)}</div>
      <div className="col-span-2 text-right tabular-nums text-muted-foreground">
        {formatPercent(cat.verticalPct)}
      </div>
      {hasComparison && (
        <div
          className={`col-span-2 text-right tabular-nums ${variationColor(
            groupKey,
            cat.horizontalPct,
          )}`}
        >
          {formatPercentSigned(cat.horizontalPct)}
        </div>
      )}
    </button>
  )
}

// ============================================================
// Linhas de subtotal/total/margens
// ============================================================

function SubtotalRow({
  label,
  value,
  hasComparison,
  verticalPct,
}: {
  label: string
  value: number
  hasComparison: boolean
  verticalPct?: number | null
}) {
  return (
    <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-muted/30 font-semibold border-y">
      <div className="col-span-6">{label}</div>
      <div className="col-span-2 text-right tabular-nums">{formatBRL(value)}</div>
      <div className="col-span-2 text-right text-sm tabular-nums text-muted-foreground">
        {verticalPct !== undefined ? formatPercent(verticalPct) : ''}
      </div>
      {hasComparison && <div className="col-span-2" />}
    </div>
  )
}

function FinalRow({
  label,
  value,
  margemPct,
  hasComparison,
  rl,
}: {
  label: string
  value: number
  margemPct: number
  hasComparison: boolean
  rl: number
}) {
  const positive = value >= 0
  return (
    <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-primary/10 border-l-4 border-primary font-bold">
      <div className="col-span-6">{label}</div>
      <div
        className={`col-span-2 text-right tabular-nums text-lg ${
          positive
            ? 'text-emerald-700 dark:text-emerald-400'
            : 'text-rose-700 dark:text-rose-400'
        }`}
      >
        {formatBRL(value)}
      </div>
      <div className="col-span-2 text-right tabular-nums">
        {rl !== 0 ? formatPercent(margemPct) : '—'}
      </div>
      {hasComparison && <div className="col-span-2" />}
    </div>
  )
}

function MarginsRow({ totals }: { totals: DRETotals }) {
  const rl = totals.receitaLiquida
  return (
    <div className="px-4 py-3 bg-muted/20 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
      <div>
        <span className="text-muted-foreground">Margem Bruta:</span>{' '}
        <span className="font-semibold">
          {rl !== 0 ? formatPercent(totals.margemBruta) : '—'}
        </span>
      </div>
      <div>
        <span className="text-muted-foreground">Margem Operacional:</span>{' '}
        <span className="font-semibold">
          {rl !== 0 ? formatPercent(totals.margemOperacional) : '—'}
        </span>
      </div>
      <div>
        <span className="text-muted-foreground">Margem Líquida:</span>{' '}
        <span className="font-semibold">
          {rl !== 0 ? formatPercent(totals.margemLiquida) : '—'}
        </span>
      </div>
    </div>
  )
}

function UncategorizedSection({
  data,
}: {
  data: { total: number; transactionCount: number }
}) {
  return (
    <div className="border-t-2 border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/30 px-4 py-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-orange-900 dark:text-orange-100">
            ⚠️ Sem Categoria: {formatBRL(data.total)}
          </p>
          <p className="text-xs text-orange-800 dark:text-orange-300 mt-0.5">
            {data.transactionCount} transações sem categorização. Categorize para que
            entrem na DRE.
          </p>
        </div>
      </div>
    </div>
  )
}

function NonDreSection({ groups }: { groups: NonDREGroupResult[] }) {
  const [expanded, setExpanded] = useState(false)
  const total = groups.reduce((sum, g) => sum + g.total, 0)
  const count = groups.reduce((sum, g) => sum + g.transactionCount, 0)

  return (
    <div className="border-t bg-muted/20">
      <button
        type="button"
        className="w-full px-4 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 text-xs">
          <ChevronRight
            className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`}
          />
          <Info className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">
            Movimentações fora do DRE: <strong>{formatBRL(total)}</strong> ({count}{' '}
            lançamentos — distribuição de lucros, investimentos, transferências)
          </span>
        </div>
      </button>
      {expanded && (
        <div className="px-4 py-2 space-y-1.5 text-xs">
          {groups.map((g) => (
            <div key={g.group} className="grid grid-cols-12 gap-2 px-2">
              <span className="col-span-7 text-muted-foreground">{g.groupLabel}</span>
              <span className="col-span-3 text-right tabular-nums">
                {formatBRL(g.total)}
              </span>
              <span className="col-span-2 text-right text-muted-foreground">
                {g.transactionCount} tx
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
