# Fix Média/vs-Média — 3 bugs

**Data:** 28/05/2026 · **Branch:** `hotfix/comparativo-media-vs-media`
**Backup:** mesmo da Sprint A (`pre-comparativo-a-20260528_015943.dump`)

---

## BUG 1 — Média vazia com 3 períodos (defaults)

### Causa raiz (em DOIS lugares)

**Servidor:** `app/api/empresas/[id]/relatorios/comparativo/route.ts:115-122`

```typescript
const isLegacyShape = input.meses === 3 && input.granularidade === 'mes'
if (isLegacyShape) {
  const result = computeComparativo(inputTxs, input.refMonth, input.tipo)
  return NextResponse.json({ ...result, multi: false })  // shape LEGACY (sem mediaHistorica)
}
```

Quando o usuário escolhe **3 meses + Mês** (defaults), o servidor **DEIXA DE
USAR** `computeComparativoMulti` e cai no caminho legacy. O `computeComparativo`
antigo (Sprint 5.0.4.0a) NÃO tem coluna Média.

**Cliente:** `comparativo-client.tsx:157-169`

```typescript
rows: legacy.rows.map((r) => ({
  ...r,
  values: [r.prev2, r.prev1, r.current],
  mediaHistorica: null,        // ← HARDCODED null
  desvioPct: null,
  referenciaVazia: false,
  cellTones: ['transparent', ...],
}))
```

O adaptador legacy do cliente hardcoda `mediaHistorica: null` porque o
shape legacy não tem o campo.

### Por que 6 períodos funciona

Com 6 períodos, `isLegacyShape === false` → servidor usa
`computeComparativoMulti` (Sprint A) que calcula a média corretamente.

### Fix

Remover a lógica `isLegacyShape` no servidor. Sempre usar
`computeComparativoMulti`. O cliente ÚNICO da API agora é o Sprint A
(toda chamada externa também passa pelo schema novo). O
`computeComparativo` antigo permanece exportado pra retrocompat de lib
mas o endpoint não chama mais.

---

## BUG 2 — Direção da seta no vs Média

### Causa raiz

`comparativo-client.tsx:506`

```typescript
const visual = getTrendVisualSemantic(row.trend.indicator, tipoSemantic)
```

A coluna "vs Média" usa `row.trend.indicator` que é calculado vs
**prev1** (mês anterior imediato), NÃO vs média histórica.

Exemplo profit Salários (6 períodos):
- Mar/26: R$ 45.159 · Fev/26: R$ 38.977 → `trend.indicator = UP` (subiu 15.9% vs Fev)
- Mar/26: R$ 45.159 · Média histórica: R$ 45.277 → `desvioPct = -0.26%` (abaixo da média)

Resultado: tela mostra **seta ↑ vermelha + número -0,3%** (inconsistente).

### Fix

A coluna "vs Média" deve usar **`desvioPct`** pra ícone + cor:
- `desvioPct === null && referenciaVazia` → label "ref. vazia"
- `desvioPct === null` → "—" sem ícone
- `|desvioPct| <= 0.15` → ícone ━ cinza + % exato
- `desvioPct > 0.15` → ↑ + cor por (tipo, favorável/desfavorável)
- `desvioPct < -0.15` → ↓ + cor por (tipo, favorável/desfavorável)

Criar helper `getDesvioVisual(desvioPct, tipo)` separado do
`getTrendVisualSemantic` (que continua válido pra outras métricas vs prev1).

---

## BUG 3 — Arredondamento perde decimais e sinal

### Causa raiz

`comparativo-client.tsx:80-86`

```typescript
function formatPct(v: number | null, withSign = true): string {
  if (v === null) return '—'
  const pct = v * 100
  const rounded = Math.round(pct)            // ← perde decimais
  if (withSign && rounded > 0) return `+${rounded}%`
  return `${rounded}%`
}
```

`-0.0026 → -0.26% → Math.round → 0 → "0%"` (perde o sinal e a magnitude).
Combinado com BUG 2, vira "↑ 0%" — falsa impressão de alta.

### Fix

Decisão do Yussef: **sempre 1 casa decimal + sinal explícito**.

```typescript
function formatPctExact(v: number | null): string {
  if (v === null) return '—'
  const pct = v * 100
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
}
```

Aplicar tanto no `Row` quanto na linha "Total".

---

## Correção proposta — 3 mudanças

### MUDANÇA 1 (servidor) — `route.ts`

Remover bloco `isLegacyShape`. Sempre chamar `computeComparativoMulti`.

### MUDANÇA 2 (lib) — `lib/relatorios/comparativo.ts`

Adicionar helper `getDesvioVisual(desvioPct, tipo)`:

```typescript
export type DesvioStatus =
  | 'sem-media'           // mediaHistorica null
  | 'ref-vazia'           // referenciaVazia=true
  | 'na-media'            // |desvio| <= 0.15
  | 'acima'               // desvio > +0.15
  | 'abaixo'              // desvio < -0.15

export interface DesvioVisual {
  status: DesvioStatus
  symbol: string          // '—' | 'ref vazia' | '━' | '↑' | '↓'
  colorClass: string      // Tailwind por (status, tipo)
  label: string           // 'Sem média' | 'Ref vazia' | 'Na média' | ...
}

export function getDesvioVisual(
  desvioPct: number | null,
  referenciaVazia: boolean,
  tipo: 'DESPESA' | 'RECEITA',
): DesvioVisual {
  if (referenciaVazia) return { status: 'ref-vazia', ... }
  if (desvioPct === null) return { status: 'sem-media', ... }
  if (Math.abs(desvioPct) <= 0.15) return { status: 'na-media', symbol: '━', ... }
  
  const acima = desvioPct > 0
  const favoravel = tipo === 'DESPESA' ? !acima : acima
  return {
    status: acima ? 'acima' : 'abaixo',
    symbol: acima ? '↑' : '↓',
    colorClass: favoravel ? 'text-emerald-600' : 'text-red-600',
    ...
  }
}
```

### MUDANÇA 3 (cliente) — `comparativo-client.tsx`

- Substituir `getTrendVisualSemantic(row.trend.indicator, ...)` na coluna "vs Média"
  por `getDesvioVisual(row.desvioPct, row.referenciaVazia, tipoSemantic)`
- Substituir `formatPct()` por `formatPctExact()` (1 casa decimal + sinal)
- Aplicar mesma lógica na linha "Total" (rodapé)
- Remover adaptador legacy do BUG 1 (não vai mais ser usado)

### MUDANÇA 4 (testes)

- 4 testes pra `getDesvioVisual` (5 status × cenários)
- 3 testes confirmando média preenchida com 2/3/4/6 períodos
- 1 teste do servidor garantindo que sempre retorna shape multi (sem
  legacy) — feito via TS shape do response

---

## Arquivos a mudar

| Arquivo | Mudança |
|---|---|
| `app/api/empresas/[id]/relatorios/comparativo/route.ts` | Remover bloco `isLegacyShape` (4 linhas) |
| `lib/relatorios/comparativo.ts` | Adicionar `getDesvioVisual()` + tipo `DesvioStatus`/`DesvioVisual` |
| `app/(dashboard)/empresas/[id]/relatorios/comparativo/comparativo-client.tsx` | Usar `getDesvioVisual`, `formatPctExact`, remover adaptador legacy |
| `__tests__/comparativo-multi-periodo.test.ts` | +8 testes (getDesvioVisual + formatPctExact + integração) |

---

## Aprovação solicitada

Yussef, antes de aplicar:

1. **MUDANÇA 1 (remover caminho legacy do servidor)** — OK? A função
   `computeComparativo` antiga continua exportada (3 outros lugares usam
   ela em testes), mas o endpoint não chama mais.
2. **MUDANÇA 2 (helper `getDesvioVisual` dedicado pra vs Média)** — OK?
3. **MUDANÇA 3 (formatPctExact com 1 casa decimal + sinal)** — OK?

Se OK, sigo Fase 2 com testes + deploy.
