# Auditoria Redesign Waterfall — Nível McKinsey

**Data:** 28/05/2026 · **Branch:** `hotfix/waterfall-redesign-mckinsey`
**Backup:** `/var/backups/conta-ia/pre-waterfall-redesign-20260528_161431.dump`
(570K)
**Baseline:** main HEAD `09c57e4` (após Sprint Análise de Variação)

---

## 1. Componente atual

**Arquivo:** `components/relatorios/analise-variacao/WaterfallChart.tsx` (114 linhas)

**Implementação atual:**
- Recharts `<BarChart>` com 2 `<Bar>` empilhadas (`stackId="wf"`)
- Bar 1: `base` invisível (`fill="transparent"`)
- Bar 2: `value` colorida via `<Cell>` por tipo
- CartesianGrid horizontal + XAxis labels rotacionados -30° + YAxis em "k"
- Tooltip custom mostrando delta com sinal

**8 problemas identificados pelo Yussef:**
1. Escala ruim (Y 0→200k, drivers ~16k = "linhas finas")
2. 11 categorias + "Outros (27)" — polui o gráfico
3. Sem connectors (cascata sem elo visual)
4. Sem data labels nas barras
5. Cores sutis (red-500/emerald-500 com tooltip Stack/Recharts cinza)
6. Nomes 45° angle ocupando 3 linhas
7. Título genérico "Cascata da variação"
8. Sem hierarquia visual (maior driver não se destaca)

---

## 2. Pesquisa — Recharts vs alternativas

| Lib | Suporte waterfall | Custo migração | Recomendação |
|---|---|---|---|
| **Recharts** (atual) | ❌ nativo, mas com primitivos ([LabelList](https://recharts.github.io/en-US/api/LabelList/), [ReferenceLine](https://recharts.github.io/en-US/api/ReferenceLine/), [Cell](https://recharts.github.io/en-US/examples/Waterfall/), [Bar shape custom](https://github.com/recharts/recharts/issues/2267)) → DIY mas viável | Zero (já instalado) | **Manter ✅** |
| **Visx** (Airbnb) | ❌ nativo, compõe D3 primitives | Alto (lib nova + curva D3) | Pular |
| **Nivo** | ❌ nativo, customização via Bar | Médio (lib nova ~200KB) | Pular |
| **SVG custom + D3** | ✅ controle total | Muito alto (reescrever do zero) | Pular |

**Decisão:** **Manter Recharts**. Cobre 85%+ do redesign:
- ✅ `<LabelList>` — data labels nas barras
- ✅ `<Cell>` — cor saturada por tipo
- ✅ `domain` no YAxis — zoom (eixo não começa em 0)
- ✅ `<CartesianGrid stroke="none">` — remove grid
- ✅ `<YAxis hide>` — remove eixo Y
- ✅ `tickFormatter` no XAxis — truncar nomes
- ⚠️ Connectors — não tem nativo, mas dá pra fazer com **Bar shape custom**
  ([padrão exemplificado no exemplo oficial waterfall do Recharts](https://recharts.github.io/en-US/examples/Waterfall/))

### Detalhe técnico — Connectors via Bar shape custom

Cada `<Bar shape={fn}>` recebe `{x, y, width, height, payload, index}`.
Posso renderizar uma `<g>` com:
1. `<rect>` da barra (substitui o padrão)
2. `<line>` tracejado do topo desta barra até o `x` da próxima
3. `<text>` do data label em cima

Acesso à próxima barra: passar array completo via prop fechado no shape
component. Padrão limpo, sem overlay SVG manual.

Refs:
- [Recharts oficial Waterfall](https://recharts.github.io/en-US/examples/Waterfall/) — usa shape custom com range `[low, high]`
- [Issue #2267](https://github.com/recharts/recharts/issues/2267) — discussão de waterfall há anos
- [Recharts vs Chart.js vs Nivo (2026)](https://www.pkgpulse.com/guides/recharts-vs-chartjs-vs-nivo-vs-visx-react-charting-2026) — confirmação: Recharts foco em "good defaults" + flexibilidade

---

## 3. Plano de redesign (mantendo Recharts)

### 3.1 Lógica de seleção visual (engine — `lib/relatorios/analise-variacao.ts`)

Adicionar função pura:

```typescript
export function selecionarDriversVisuais(
  drivers: DriverVariacao[],
  diferencaTotal: number,
  opts: { topN?: number; minImpactPct?: number; minVisible?: number }
): { visiveis: DriverVariacao[]; outros: DriverVariacao[] }
```

Regras (decisão Yussef confirmada):
- Ordenar por `|diferenca|` desc (já é assim)
- Top 10 (configurável)
- Threshold automático: drivers com `|delta| < 5% * |diferencaTotal|` vão pra Outros
- **Mínimo 5 visíveis**: se threshold filtrar demais, mostra os 5 maiores mesmo abaixo
- "Outros" preserva aritmética (soma do resto)

Atualizar `buildWaterfallBars()` pra receber esse pré-filtro.

### 3.2 Título dinâmico (engine)

```typescript
export function gerarTituloNarrativo(result: AnaliseVariacaoResult): string
// Ex: "Janeiro/26 custou +R$ 99.141 a mais que Fevereiro/26
//      — IRPJ e CSLL responderam por 80%"
```

E `gerarInsightsPrincipais()` que enumera top 2-3 + casos NEW/GONE notáveis.

### 3.3 Bar shape custom (`WaterfallChart.tsx`)

Substituir `<Bar dataKey="value">` por `<Bar shape={<WaterfallBarShape allBars={bars} />}>`.

Shape custom renderiza:
1. `<rect>` da barra (cor saturada por tipo)
2. `<line strokeDasharray="3 3">` do topo desta barra até `x` da próxima
   (skip pro último item ou pro tipo `fim` → `inicio` da próxima cascata)
3. `<text>` do data label em cima da barra (R$ com sinal)
4. Cor destacada se `index === 1` (primeiro driver) — TOP 1 highlight

### 3.4 YAxis zoom + grid removido

```typescript
// Calcular janela útil
const allYs = bars.flatMap(b => [b.base, b.end])
const minY = Math.min(...allYs)
const maxY = Math.max(...allYs)
const padding = (maxY - minY) * 0.15
const yDomain: [number, number] = [Math.max(0, minY - padding), maxY + padding]

<YAxis hide domain={yDomain} />
<CartesianGrid stroke="none" />
```

### 3.5 XAxis truncar + reduzir ângulo

```typescript
function truncate(s: string, max = 18) {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

<XAxis
  dataKey="label"
  tickFormatter={truncate}
  angle={-30}
  textAnchor="end"
  axisLine={false}
  tickLine={false}
  interval={0}
  height={80}
  fontSize={11}
/>
```

Tooltip mostra nome completo (já mostra).

### 3.6 Cores saturadas + destaque TOP 1

```typescript
const CORES = {
  inicio: '#1e293b',      // slate-800
  fim: '#1e293b',         // slate-800 (igual ao início pra contraste)
  aumento: '#dc2626',     // red-600
  aumentoDestaque: '#991b1b', // red-800 (TOP 1)
  reducao: '#16a34a',     // green-600
  reducaoDestaque: '#166534', // green-800 (TOP 1)
  outros: '#64748b',      // slate-500
}
```

`isTopDriver` = primeiro driver na lista de visíveis (index 1 na bars array,
porque index 0 é o `inicio`).

### 3.7 Wrapper UI — título + insights

Atualizar `analise-variacao-client.tsx`:
- Substituir `<h3>Cascata da variação</h3>` por título dinâmico narrativo
- Adicionar bloco "Insights principais" embaixo do chart (3-4 bullets)

---

## 4. Riscos

| Risco | Mitigação |
|---|---|
| Bar shape custom quebra responsive | Recharts passa todas as props necessárias, testar 320px → 1920px |
| Connectors mal calculados quebram visual | Cobertura por teste unitário: validar coordenadas do shape |
| Aritmética quebra após filtro 5% | Engine `decompor` continua tendo TODOS os drivers; `selecionarDriversVisuais` separa visíveis × outros; aritmética continua fechando |
| Cores red-600/green-600 muito fortes em dark mode | Tailwind `dark:red-400` adapta; testar visual em ambos |
| TOP 1 highlight automático nem sempre é o "alerta" certo | Highlight é semântico = maior |impacto|. Decisão certa pra McKinsey style |
| `<YAxis hide>` quebra Tooltip alinhamento | Tooltip continua renderizando, só não mostra ticks Y |

---

## 5. Estratégia de execução (Fase 2)

1. **Engine** (~45min)
   - `selecionarDriversVisuais()` + testes
   - `gerarTituloNarrativo()` + testes
   - `gerarInsightsPrincipais()` + testes
   - Adaptar `analiseVariacao()` pra retornar visuais + texto narrativo
2. **WaterfallChart redesign** (~1.5h)
   - Bar shape custom com connector + label + cor saturada
   - YAxis hide + zoom domain
   - CartesianGrid removido
   - XAxis truncate + angle -30
3. **UI cliente** (~30min)
   - Título dinâmico no card
   - Bloco de insights principais embaixo
4. **Build + deploy + smoke** (~30min)

Estimativa total: **3.5h** (dentro de 3-4h da spec).

---

## 6. Aprovação solicitada

Yussef, antes de Fase 2:

1. **Manter Recharts** (vs Visx/Nivo/SVG custom)? **Recomendo manter** — cobre
   85%+ direto, zero migração, sem regressão.
2. **Bar shape custom** pra connectors + labels (vs SVG overlay)? **Recomendo
   Bar shape** — padrão Recharts, código mais limpo.
3. **TOP 1 highlight automático** (cor mais forte no maior driver)? **Recomendo
   sim** — segue padrão McKinsey "atenção ao maior driver".
4. **Cores red-600/green-600** (saturadas) vs red-500/emerald-500 (atuais)?
   **Recomendo red-600/green-600** — atende "saturadas não decorativas" da spec.

Se OK com tudo "A" (recomendado), sigo Fase 2. Se quiser ajustar, me fala.
