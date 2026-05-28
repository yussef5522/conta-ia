# Auditoria Sprint Análise de Variação (Bridge/Waterfall)

**Data:** 28/05/2026 · **Branch:** `feature/analise-variacao`
**Baseline:** main HEAD `addb606` (após 3 fixes do comparativo)
**Backup:** `/var/backups/conta-ia/pre-analise-variacao-20260528_151558.dump` (570K)
**Pré-requisito confirmado:** ✅ Yussef validou hotfix Média/vs-Média em prod

---

## 1. Fase 0 — Pesquisa waterfall em Recharts

### 1.1 Recharts não tem waterfall nativo, mas tem padrão estabelecido

Referências oficiais e práticas:
- [Recharts oficial — Waterfall example](https://recharts.github.io/en-US/examples/Waterfall/) — usa range `[low, high]` numa Bar + shape custom
- [Medium tutorial](https://medium.com/2359media/tutorial-how-to-create-a-waterfall-chart-in-recharts-15a0e980d4b) — explica abordagem stacked
- [shadcn/ui Waterfall block](https://www.shadcn.io/blocks/stats-waterfall-chart-card) — exemplo 2026 com Recharts + Tailwind

### 1.2 Abordagem escolhida: stacked Bar (base invisível + value visível)

```
Bar dataKey="base"   fill="transparent"  stackId="wf"
Bar dataKey="value"  fill={porTipo}       stackId="wf"
```

Para cada barra do waterfall:
- **base** = Y onde a barra começa (cumulativo até o driver anterior)
- **value** = magnitude do delta (sempre positivo pra Recharts)
- **delta real** = guardado em campo extra `delta` (pra tooltip)
- **tipo** ∈ {`inicio`, `aumento`, `reducao`, `fim`}
- **cor** = cinza (totais) / vermelho (aumento despesa) / verde (redução despesa)

### 1.3 UX patterns (consenso 2026)

[Chartengine — Variance Analysis](https://chartengine.io/variance-analysis-in-depth/),
[CFO Secrets — Variance Analysis Art and Science](https://www.cfosecrets.io/p/art-and-science-of-variance-analysis),
[Inforiver — Waterfall finance pro friend](https://inforiver.com/insights/waterfall-charts-finance-professionals-best-friend/):

- **"Bridge visuals first, supported by 1-2 key driver callouts"** — alinhado
  com a spec
- **"Causal vs chronological"** — nosso uso é causal (drivers que explicam o gap)
- **"Standalone storytelling"** — deve fazer sentido sem contexto adicional
- Evitar overload — focar nos drivers de maior impacto
- Cores consistentes em todo o produto (já temos verde=favorável, vermelho=desfavorável)

---

## 2. Fase 1 — Reuso do código existente

### 2.1 APIs públicas reusáveis em `lib/relatorios/comparativo.ts`

| API | Uso na Análise de Variação |
|---|---|
| `ComparativoInputTx` | Tipo de input — usar exatamente igual |
| `parseRefMonth(ymRef)` | Parse YYYY-MM → MonthRange |
| `buildPeriodos(ymRef, N, gran)` | Gera buckets de período |
| `computeComparativoMulti(txs, opts)` | Agrega txs por categoria × período |
| `ComparativoTipoFilter` | DESPESA/RECEITA/TODOS |

### 2.2 Como reusar pro mode `mes-vs-mes`

```typescript
// 2 períodos: ymRef = mês investigado, nPeriodos=2
// values[0] = comparação, values[1] = investigado
const result = computeComparativoMulti(txs, {
  ymRef: mesInvestigado,
  nPeriodos: 2,
  granularidade: 'mes',
  tipo,
})
// Decompor: para cada row, diferenca = values[1] - values[0]
```

PROBLEMA: `nPeriodos=2` força meses CONSECUTIVOS (Fev/Mar se ref=Mar). Se
Yussef quer **Janeiro vs Maio** (não consecutivos), não funciona direto.
Vou criar engine própria que aceita 2 períodos arbitrários.

### 2.3 Como reusar pro mode `mes-vs-media`

```typescript
// N períodos (default 6) ref=mesInvestigado
const result = computeComparativoMulti(txs, {
  ymRef: mesInvestigado,
  nPeriodos: 6,
  granularidade: 'mes',
  tipo,
})
// Para cada row:
//   valorInvestigado = values[N-1] (último — ref)
//   valorComparacao = média dos values[0..N-2] excluindo zeros
//                     (fórmula calcularMediaHistorica que já temos)
```

**Reuso 100% nesse modo** — só preciso interpretar o resultado.

### 2.4 Decisão final

Criar `lib/relatorios/analise-variacao.ts` (engine própria) que:
- Para `mes-vs-mes` com meses NÃO consecutivos: usa range SQL próprio + agrega
  internamente (não chama `computeComparativoMulti` direto)
- Para `mes-vs-media`: chama `computeComparativoMulti(nPeriodos=N)` e usa
  `calcularMediaHistorica`
- Adiciona lógica nova: decomposição → drivers → waterfall bars

---

## 3. Estrutura de dados proposta

```typescript
export type ComparacaoMode = 'mes-vs-mes' | 'mes-vs-media'

export interface AnaliseVariacaoInput {
  txs: ComparativoInputTx[]
  mesInvestigado: string        // YYYY-MM
  comparacao:
    | { mode: 'mes-vs-mes'; ymComparacao: string }
    | { mode: 'mes-vs-media'; nMesesContexto: number }
  tipo: ComparativoTipoFilter
}

export interface DriverVariacao {
  categoryId: string | null
  categoryName: string
  dreGroup: string | null
  valorInvestigado: number
  valorComparacao: number
  /** investigado - comparacao (positivo = aumentou) */
  diferenca: number
  /** Variação relativa em frações (null se comparação = 0) */
  percentual: number | null
  /** Classificação semântica */
  tipo: 'aumentou' | 'reduziu' | 'novo' | 'sumiu' | 'estavel'
}

export interface WaterfallBar {
  label: string
  /** Y onde a barra começa (base invisível) */
  base: number
  /** Magnitude da barra (sempre positivo pro Recharts) */
  value: number
  /** Delta real com sinal (pra tooltip) */
  delta: number
  /** Y onde a barra termina */
  end: number
  tipo: 'inicio' | 'aumento' | 'reducao' | 'fim'
}

export interface AnaliseVariacaoResult {
  mesInvestigadoLabel: string  // "Janeiro/26"
  comparacaoLabel: string      // "Fevereiro/26" | "Média dos outros 5 meses"
  totalInvestigado: number
  totalComparacao: number
  diferencaTotal: number
  percentualTotal: number | null
  drivers: DriverVariacao[]    // ordenado por |diferenca| desc
  waterfallBars: WaterfallBar[]
  /** Validação: soma de drivers === diferencaTotal */
  aritmeticaFecha: boolean
  aritmeticaResiduo: number    // |soma - diferenca| (deve ser ~0 com tolerância)
}
```

---

## 4. Plano de implementação (estimado 4-5h)

### Fase 2.A — Engine pura (~1.5h)
- `lib/relatorios/analise-variacao.ts` com 4 helpers:
  - `decompor()` — divide categoria por categoria
  - `classificarDriver()` — aumentou/reduziu/novo/sumiu/estavel
  - `buildWaterfallBars()` — converte drivers em bars Recharts-ready
  - `analiseVariacao()` — entry point que combina tudo
- +20 testes (drivers + aritmética + waterfall)

### Fase 2.B — Endpoint (~30min)
- `GET /api/empresas/[id]/relatorios/analise-variacao`
- Query params: `mesInvestigado`, `mode`, `ymComparacao?`, `nMesesContexto?`, `tipo`
- Reusa where SQL CORRIGIDO do comparativo (competenceDate || date)

### Fase 2.C — UI cliente (~2h)
- `app/(dashboard)/empresas/[id]/relatorios/analise-variacao/page.tsx`
- `analise-variacao-client.tsx`:
  - Seletor mês + tipo de comparação (radio) + tipo despesa/receita + botão Analisar
  - Resumo executivo (mês investigado vs comparação)
  - Waterfall chart (Recharts BarChart stacked)
  - Tabela de drivers ordenada (R$/% + ícone + nota contextual)
  - Validação aritmética (✓ ou ⚠️)

### Fase 2.D — Card preview (~15min)
- Adicionar 9º card em `/relatorios` index

### Fase 3 — Testes/build/deploy (~45min)

---

## 5. Decisões abertas pra Yussef

### Decisão 1 — Janela do "mes-vs-media"

Quando você escolhe "comparar com a média dos outros meses", quantos meses
de contexto?

- **A) Default 6 meses, configurável** — você escolhe 3/6/12
- B) Fixo 6 meses, sem opção — mais simples
- C) Todos os meses do ano corrente — pode ficar inflado

### Decisão 2 — Top N drivers ou todos

Quando há 30+ categorias com pequena variação, o waterfall fica ilegível.

- **A) Top 10 drivers + barra "Outros" agrupando o resto (Recomendado)** —
  preserva aritmética; mantém legibilidade
- B) Todos os drivers — pode dar 30+ barras no chart
- C) Top 5 + "Outros" — mais minimalista mas pode esconder drivers
  relevantes do 6º ao 10º

### Decisão 3 — Bars na ordem

- **A) Drivers ordenados por |diferença| desc (maior impacto primeiro)** —
  contar narrativa "começou com X, IRPJ subiu 56k, CSLL subiu 23k, ...,
  total = Y"
- B) Drivers agrupados positivos primeiro + negativos depois — mais limpo
  visualmente mas perde a "história"

### Decisão 4 — Meses não-consecutivos no `mes-vs-mes`

Suporta comparar Janeiro vs Maio (não consecutivos)?

- **A) Sim — usuário escolhe 2 meses arbitrários (Recomendado)** — mais
  flexível, atende caso "mês muito caro vs mês muito barato"
- B) Não — só meses adjacentes (X vs X-1) — mais simples mas restritivo

---

## 6. Riscos identificados

| Risco | Mitigação |
|---|---|
| Waterfall com 30+ drivers fica ilegível | Top 10 + "Outros" (Decisão 2) |
| Aritmética não fecha por float precision | Tolerância R$ 0,01 + flag `aritmeticaFecha` |
| Reintroduzir bug do bucket (date vs competenceDate) | Where SQL usa o padrão corrigido (OR competenceDate, fallback date) |
| Modo "vs média" muito sensível a meses zerados | Reusa `calcularMediaHistorica` que já ignora zeros (Sprint comparativo fix) |
| Recharts BarChart stacked pode renderizar mal com base muito alta | Testar com `domain={['auto', 'auto']}` no YAxis |
| Performance: 1 query SQL pra cada análise | Reusa cache pattern + dynamic se necessário |

---

## 7. Aprovação solicitada

Yussef, antes de Fase 2:

1. **Decisão 1 (janela "vs média")**: A/B/C?
2. **Decisão 2 (top N drivers)**: A/B/C?
3. **Decisão 3 (ordem das bars)**: A/B?
4. **Decisão 4 (meses não-consecutivos)**: A/B?

Se OK com tudo "A" (recomendado), sigo direto pra Fase 2. Se quiser ajustar,
me fala.
