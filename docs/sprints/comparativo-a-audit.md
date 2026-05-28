# Auditoria Sprint Comparativo-A Fundação

**Data:** 28/05/2026 · **Branch:** `feature/comparativo-a-fundacao`
**Baseline:** main HEAD `2166250` (após bug-fix lifecycle)
**Backup:** `/var/backups/conta-ia/pre-comparativo-a-20260528_015943.dump` (570K)

---

## 1. Arquitetura atual

### 1.1 Arquivos do comparativo

| Arquivo | Papel | Linhas |
|---|---|---|
| `lib/relatorios/comparativo.ts` | Lib pura: `computeComparativo()`, `trendIndicator()`, `threeMonthsForRef()`, `TREND_VISUAL` | 365 |
| `app/api/empresas/[id]/relatorios/comparativo/route.ts` | Endpoint GET: carrega tx + delega pra lib | 91 |
| `app/(dashboard)/empresas/[id]/relatorios/comparativo/page.tsx` | Server entry (header + auth) | (curto) |
| `app/(dashboard)/empresas/[id]/relatorios/comparativo/comparativo-client.tsx` | Client UI: filtros + 3 stats + tabela | ~250 |

### 1.2 Como os 3 meses são definidos hoje

**HARDCODED em 3 meses fixos** (`prev2`, `prev1`, `current`):

```typescript
// lib/relatorios/comparativo.ts:140-168
export function threeMonthsForRef(ymRef: string): {
  prev2: MonthRange
  prev1: MonthRange
  current: MonthRange
} { ... }
```

`ComparativoRow` tem shape FIXO `{ prev2, prev1, current, total }`. Refatorar
pra `buckets: Array<{label, value}>` é o ponto central da Sprint A.

### 1.3 Cálculo de tendência atual

```typescript
trendIndicator(prev2, prev1, current) → TrendResult
```

Usa **prev1** (mês imediatamente anterior) como referência principal. Returns:
- 5 indicadores quantitativos (UP_STRONG, UP, STABLE, DOWN, DOWN_STRONG)
- 3 qualitativos (NEW, GONE, EMPTY)
- Threshold `STABLE_TOLERANCE = 0.15` (±15%)
- Threshold `STRONG_THRESHOLD = 0.5` (±50%)

**Reuso:** os mesmos thresholds servem pro heatmap (15-40-80 do plano de
intensidade encaixa). Manter `STABLE_TOLERANCE=0.15` como constante única.

### 1.4 Cards atuais (Cliente)

| Card | Lógica atual | Sprint A |
|---|---|---|
| Novas (🆕) | `trend === 'NEW'` count | Recalcular pra "apareceu APENAS no mês atual entre N períodos" |
| Subindo (↑) | `trend in [UP, UP_STRONG]` count | Recalcular pra mês atual vs penúltimo (consistente) |
| Descendo (↓) | `trend in [DOWN, DOWN_STRONG]` count | Idem |
| **Fora da Média** | NÃO EXISTE | **NOVO** — count de DESPESAS com desvio>+15% vs média |

### 1.5 Campo de data usado

Endpoint atual (`route.ts:55`):
- Query SQL: `date: { gte: prev2.start, lte: current.end }`
- Lib pura: `bucketDate = competenceDate ?? date` (regime 'competencia')
   OU `paymentDate ?? date` (regime 'caixa')

**OK:** já suporta `regime` via env. Mantém na Sprint A.

### 1.6 Filtros multi-tenant + lifecycle

```typescript
OR: [bankAccount, supplier, employee, customer, category].companyId,
status: { in: ['RECONCILED', 'PENDING'] },
```

**Ausências (notar mas não corrigir nesta sprint):**
- ❌ NÃO filtra `lifecycle: 'EFFECTED'` → pega TUDO (EFFECTED + PAYABLE +
  RECEIVABLE) → reflete corretamente após o bug-fix do lifecycle
- ❌ NÃO filtra `reconciledWithId: null` → POSSÍVEL dupla contagem se houver
  PAYABLE não conciliada que depois foi conciliada (mas o lifecycle agora é
  EFFECTED, então só duplicaria se houver OFX com PAYABLE não-conciliada
  pendente — improvável)

**Decisão:** sprint A NÃO mexe nesses filtros (escopo é apresentação). Se
detectar dupla contagem na validação, abre micro-fix depois.

---

## 2. Plano de mudanças

### 2.1 Refactor da lib pura

**Tipos novos:**
```typescript
export type Granularidade = 'mes' | 'trimestre' | 'ano'

export interface PeriodoBucket {
  id: string           // "2026-03" / "2026-Q1" / "2026"
  label: string        // "Mar/26" / "Q1/26" / "2025"
  start: Date
  end: Date
}

export interface ComparativoRowMulti {
  categoryId: string | null
  categoryName: string
  dreGroup: string | null
  /** Valores por período (mesmo ordem de buckets[]) */
  values: number[]
  /** Média dos values[0..N-1] (EXCLUI último — current) */
  mediaHistorica: number | null
  /** Desvio do current vs mediaHistorica. null se média = 0 ou < 2 pontos */
  desvioPct: number | null
  /** Total do período inteiro */
  total: number
  /** Trend (compatível com UI atual — current vs penúltimo) */
  trend: TrendResult
  /** NOVO: Cor do heatmap pra cada célula. Index alinhado com values[] */
  cellTones: CellTone[]
}

export type CellTone =
  | 'transparent'           // |desvio| < 15%
  | 'fav-weak'              // 15-40% favorável
  | 'fav-medium'            // 40-80% favorável
  | 'fav-strong'            // >80% favorável
  | 'unfav-weak'            // 15-40% desfavorável
  | 'unfav-medium'          // 40-80% desfavorável
  | 'unfav-strong'          // >80% desfavorável
```

**Funções novas:**
```typescript
buildPeriodos(ymRef, nPeriodos, granularidade): PeriodoBucket[]
calcularMediaHistorica(values: number[]): number | null
calcularDesvio(current: number, media: number | null): number | null
classifyCellTone(value: number, mediaCategoria: number, tipo: 'DESPESA'|'RECEITA'): CellTone
computeComparativoMulti(txs, opts): { rows, totals, periodos, summary }
```

**Compat:** manter `computeComparativo()` antigo + `threeMonthsForRef()`
funcionando (pra evitar quebrar logs antigos do AI). Adicionar o novo lado a
lado. Cliente migra pra função nova.

### 2.2 Endpoint atualizado

```typescript
querySchema = z.object({
  refMonth: z.string().regex(/^\d{4}-\d{2}$/),
  tipo: z.enum(['DESPESA', 'RECEITA', 'TODOS']).default('DESPESA'),
  regime: z.enum(['competencia', 'caixa']).default('competencia'),
  meses: z.coerce.number().int().min(2).max(12).default(3),         // NOVO
  granularidade: z.enum(['mes','trimestre','ano']).default('mes'),  // NOVO
})
```

Query SQL adapta range pra `nPeriodos × granularidade` (12 meses se
granularidade='trimestre' e meses=12 = 4 trimestres = 12 meses range).

### 2.3 UI client

**Filtros (linha única):**
```
Referência: [Mar/26 ▼]  Períodos: [6 ▼]  Granularidade: [Mês ▼]  Tipo: [Despesas ▼]  Mostrar: [Tudo ▼]
```

**Stats cards (4 agora):**
- Card "Novas" (🆕)
- Card "Subindo" (↑)
- Card "Descendo" (↓)
- **Card "Fora da Média" (NOVO)** — count despesas com desvio>+15%

**Tabela (matriz)**:
```
Categoria (sticky) | Per1 | Per2 | ... | PerN | Média | vs Média | Total
─────────────────────────────────────────────────────────────────────
Salários           | 29k  | 30k  | ... | 45k  | 31,8k | 🔴 +41%   | 250k
                     (heatmap nas células coloridas)
```

- Primeira coluna sticky (categoria + dreGroup label)
- Container `overflow-x-auto`
- `tabular-nums` em todas células numéricas
- Heatmap via `style={{ backgroundColor: ... }}` por CellTone

**URL state:**
```
?refMonth=2026-03&meses=6&granularidade=mes&tipo=DESPESA&filterMode=ALL
```

### 2.4 Trend semântica IBCS (refinamento)

`TREND_VISUAL` atual mistura direção e severidade (UP_STRONG = vermelho
sempre, mesmo pra RECEITA onde subir é bom). Sprint A vai adicionar
`TREND_VISUAL_SEMANTIC` com cor por (indicator × tipo):

| Indicator × Tipo | DESPESA | RECEITA |
|---|---|---|
| UP_STRONG | red bold | emerald bold |
| UP | red | emerald |
| STABLE | slate | slate |
| DOWN | emerald | red |
| DOWN_STRONG | emerald bold | red bold |
| NEW | purple | purple (chama atenção em ambos) |
| GONE | slate | slate |
| EMPTY | muted | muted |

Mantém o `TREND_VISUAL` antigo pra compat com outras pages. Cliente novo
usa `getTrendVisual(indicator, tipo)`.

---

## 3. Estratégia de execução (3 sub-fases internas + deploy)

### Fase 2.A — Refactor lib pura (1h)
- `lib/relatorios/comparativo.ts`: novos tipos + funções multi-período
- Mantém código antigo pra compat
- +20 testes (cobre granularidade trimestre/ano, média exclui current, cellTone)

### Fase 2.B — Endpoint atualizado (20min)
- Zod schema novo (`meses`, `granularidade`)
- Query SQL ajusta range
- Smoke test com curl em prod (cacula + profit)

### Fase 2.C — Cliente UI (1.5h)
- Filtros novos (períodos + granularidade)
- 4º card "Fora da Média"
- Tabela N colunas + sticky + heatmap
- URL state
- +8 testes (helpers de UI)

### Fase 3 — Deploy + screenshots (30min)
- Merge main + deploy
- Smoke prod (cacula 6 meses + 12 meses)
- 5 screenshots solicitados (limitação visual declarada)

**Total estimado:** ~3h (dentro dos 4-5h da spec).

---

## 4. Riscos identificados

| Risco | Mitigação |
|---|---|
| Refactor quebra o relatório existente (atual em prod) | Manter `computeComparativo()` antigo intacto. Adicionar `computeComparativoMulti()` novo lado a lado. Cliente troca por opt-in |
| 12 meses × 50k txs = query lenta | Cap em 50k já existe. Range SQL filtra antes. Cache `unstable_cache` 60s |
| Heatmap polui leitura | Tons leves (50/100/200 Tailwind). Texto preto preserva contraste WCAG |
| Sticky column quebra em alguns browsers | `position: sticky` é safe em todos modernos. Fallback: scroll horizontal sem sticky se Safari < 13 |
| Dupla contagem (sem filtro `reconciledWithId`) | Validar em prod com SQL de paridade. Se detectar, micro-fix futuro |
| Trimestre/ano + ref-month "Mar/26" requer cálculo correto de Q1/2026 | Helper `quarterOf(date)` puro testado |
| `lifecycle='PAYABLE'` ainda aparece se não conciliado/pago | É correto (regime competência inclui PAYABLE pendentes) |

---

## 5. Aprovação solicitada

Yussef, antes de iniciar Fase 2 (implementação), confirma 4 pontos:

<!-- decisões pra confirmar -->

1. **Refactor com retrocompat** (manter `computeComparativo` antigo + adicionar
   `computeComparativoMulti` novo) — OK?
2. **Threshold de desvio = 15%** (mesmo `STABLE_TOLERANCE` atual) — OK?
3. **Heatmap tons leves (Tailwind 50/100/200)** vs vibrantes (300/500/700) — OK?
4. **Card "Fora da Média" só conta DESPESAS** (não RECEITAS) — OK?

Se OK em tudo, sigo direto pra Fase 2. Se quiser ajustar, me fala.
