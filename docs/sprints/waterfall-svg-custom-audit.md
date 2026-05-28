# Auditoria Waterfall SVG Custom — 2ª Tentativa

**Data:** 28/05/2026 · **Branch:** `hotfix/waterfall-svg-custom`
**Backup:** `/var/backups/conta-ia/pre-waterfall-svg-20260528_164152.dump` (570K)
**Baseline:** main HEAD `cf33ed4` (após redesign McKinsey com Recharts)

---

## 1. Estado atual a substituir

**Componente:** `components/relatorios/analise-variacao/WaterfallChart.tsx`
(275 linhas — Recharts com Bar shape custom)

**6 bugs visuais herdados** (relatados pelo Yussef):

| # | Bug | Causa raiz técnica |
|---|---|---|
| 1 | Escala 0→200k (drivers viram linhas) | `Math.max(0, minY - padding)` força incluir zero quando minY é alto |
| 2 | 13 barras (Top 10 + Outros + 2 totais) | `topN=10` + `minImpactPct=0.05` não corta agressivo |
| 3 | Connectors horizontais (não diagonais) | Recharts não expõe scale no `Bar shape`, só dá `x/y/width/height` da barra atual. Sem acesso à coord Y da próxima, só foi possível desenhar linha horizontal saindo do topo |
| 4 | Texto sobrepondo | Sem algoritmo de placement; labels sempre 6px acima da barra |
| 5 | Título inverte sujeito | A confirmar via testes (engine LÓGICA atual usa `mesInvestigadoLabel` como sujeito, mas pode haver casos onde fica confuso) |
| 6 | Bullet "X outros drivers somam Y" inútil | `gerarInsightsPrincipais()` sempre adiciona esse bullet quando há outros |

**Conclusão técnica do diagnóstico:** Bugs 1 e 3 são **limitações estruturais
do Recharts**. Bug 1 (escala) é controlável mas o `Math.max(0, ...)` foi
defensivo demais. Bug 3 (connectors diagonais) é **fundamental**: o `Bar
shape` do Recharts não dá acesso à yScale interna, impossibilita calcular
posição Y da próxima barra. Apenas `width/x` do conjunto inteiro
acessível externamente.

---

## 2. Decisão técnica

### 2.1 Migrar pra SVG puro (não Recharts)

Yussef pediu explicitamente. Confirmo é necessário pra desbloquear bug 3
(connectors diagonais).

Outras libs avaliadas:
- **AG Charts / Syncfusion** ([refs](https://www.ag-grid.com/charts/react/waterfall-series/)) — pagas
- **react-waterfall-chart** ([KeyValueSoftwareSystems](https://github.com/KeyValueSoftwareSystems/react-waterfall-chart)) — menor cap de customização, mantenedor único
- **Visx** — overkill (lib grande pra 1 componente)

**SVG puro com cálculos próprios = melhor escolha.** Zero deps, controle total.

### 2.2 d3-scale: instalar ou implementar manual?

`d3-scale` NÃO está instalado (confirmado via `grep` no `package.json`).

| Critério | d3-scale (~10KB gzip) | Manual (~30 linhas) |
|---|---|---|
| Battle-tested | ✅ standard FP&A | ⚠️ pode ter edge cases |
| Manutenção | ✅ comunidade D3 | nossa |
| Bundle size | +10KB | 0 |
| Curva | já conhecido | trivial |
| Padrões consagrados | scaleBand, scaleLinear, copy() | manual |

**Recomendação:** **implementar manual** — `scaleLinear` é literalmente
10 linhas, `scaleBand` é 15 linhas. Zero dep nova. Mantém build leve.

Implementação proposta (interna ao componente):
```typescript
function scaleLinear(d0: number, d1: number, r0: number, r1: number) {
  const m = (r1 - r0) / (d1 - d0)
  return (x: number) => r0 + m * (x - d0)
}

function scaleBand(n: number, r0: number, r1: number, padding = 0.35) {
  const totalRange = r1 - r0
  const step = totalRange / n
  const bandwidth = step * (1 - padding)
  const offset = (step - bandwidth) / 2
  return (i: number) => ({
    x: r0 + i * step + offset,
    width: bandwidth,
  })
}
```

---

## 3. Plano de implementação

### 3.1 Componente novo (`WaterfallChartSvg.tsx`)

Estrutura sugerida:

```typescript
'use client'

interface Props {
  bars: WaterfallBar[]
  width?: number
  height?: number
}

export function WaterfallChartSvg({ bars, width = 900, height = 420 }: Props) {
  const margin = { top: 40, right: 20, bottom: 80, left: 20 }
  const innerW = width - margin.left - margin.right
  const innerH = height - margin.top - margin.bottom

  // Escala adaptativa: usa MIN/MAX dos valores cumulativos
  const allYs = bars.flatMap(b => [b.base, b.end])
  const minY = Math.min(...allYs)
  const maxY = Math.max(...allYs)
  const range = maxY - minY
  const padTop = range * 0.10
  const padBot = range * 0.10
  // CHAVE: NÃO força Math.max(0, ...) — deixa zoom real
  const yScale = scaleLinear(minY - padBot, maxY + padTop, innerH, 0)
  const xScale = scaleBand(bars.length, 0, innerW, 0.35)

  const topDriverIdx = findTopDriverIndex(bars)

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <g transform={`translate(${margin.left},${margin.top})`}>
        {/* Connectors diagonais — desenhar ANTES das barras pra ficarem atrás */}
        {bars.slice(0, -1).map((b, i) => {
          const next = bars[i + 1]
          const { x: xCur, width: wCur } = xScale(i)
          const { x: xNext } = xScale(i + 1)
          // Topo da atual = yScale(b.end) (porque end é o cumulativo)
          // Início da próxima = yScale(next.base + next.value) ou similar...
          // Estratégia simples: connector vai de topo(atual) até topo(início próxima)
          const yTopoAtual = yScale(b.end)
          const yInicioPróxima = next.tipo === 'reducao'
            ? yScale(next.end + next.value) // topo da próxima
            : yScale(next.base)              // base da próxima
          return (
            <line
              key={`c${i}`}
              x1={xCur + wCur}
              y1={yTopoAtual}
              x2={xNext}
              y2={yInicioPróxima}
              stroke="#cbd5e1"
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.7}
            />
          )
        })}

        {/* Barras */}
        {bars.map((b, i) => {
          const { x, width: w } = xScale(i)
          const yTop = yScale(b.end)
          const yBot = yScale(b.base)
          const h = Math.abs(yBot - yTop)
          const cor = corDaBarra(b, i === topDriverIdx)
          return (
            <g key={i}>
              <rect x={x} y={Math.min(yTop, yBot)} width={w} height={h} fill={cor} rx={2} />
              {/* Label valor */}
              <text x={x + w / 2} y={Math.min(yTop, yBot) - 6}
                    textAnchor="middle" fontSize={11} fontWeight={i === topDriverIdx ? 700 : 600}
                    fill={cor}>
                {formatLabel(b)}
              </text>
              {/* Label categoria (eixo X) */}
              <text x={x + w / 2} y={innerH + 18}
                    textAnchor="middle" fontSize={11} fill="#475569">
                {truncar(b.label, 14)}
              </text>
            </g>
          )
        })}
      </g>
    </svg>
  )
}
```

### 3.2 Engine — `selecionarDriversVisuais` mais agressivo

Atualizar defaults:
```typescript
const DEFAULT_TOP_N = 6              // antes: 10
const DEFAULT_MIN_IMPACT_PCT = 0.08  // antes: 0.05
const DEFAULT_MIN_VISIBLE = 4        // antes: 5
```

⚠️ Manter assinatura — caller pode override. Os defaults novos aplicam
ao `analiseVariacao()` que é a entry pública.

### 3.3 Engine — `gerarTituloNarrativo` testar explicitamente

A lógica atual já usa `mesInvestigadoLabel` como sujeito. Vou ADICIONAR
testes explícitos pra cada cenário (mes-vs-mes positivo, negativo,
mes-vs-media) garantindo que o investigado SEMPRE é sujeito.

Caso o Yussef tenha clicado "Investigar=Fev" sem perceber, a label
ainda fica correta semanticamente (mostra o que o usuário pediu).

### 3.4 Engine — `gerarInsightsPrincipais` remover bullet "outros"

Trecho a deletar:
```typescript
// REMOVER ESTE BLOCO:
if (resto.length > 0) {
  const restoDelta = resto.reduce(...)
  const restoPct = Math.round(...)
  insights.push({ tipo: 'outros', texto: `${resto.length} outros drivers somam ...` })
}
```

Mantém só: top-driver (1-2) + concentracao (quando ≥ 50%).

### 3.5 Label placement (simples)

Algoritmo:
- Default: label acima da barra (-6px)
- Se barra tiver `height < 30px`: label DENTRO da barra (centralizado vertical)
- Sem collision detection avançada (Yussef pediu top 6 agressivo → não vai
  haver tantas barras pra colidir)

### 3.6 UI cliente — substituir import

```typescript
// ANTES:
import { WaterfallChartDynamic } from '@/components/relatorios/analise-variacao/WaterfallChartWrapper'

// DEPOIS:
import { WaterfallChartSvgDynamic } from '@/components/relatorios/analise-variacao/WaterfallChartSvgWrapper'
```

Mantém wrapper dynamic (apesar de SVG puro não precisar de SSR fix, manter
padrão consistente).

### 3.7 Arquivos a tocar

| Arquivo | Mudança |
|---|---|
| `lib/relatorios/analise-variacao.ts` | Defaults topN/minImpact/minVisible + remover bullet outros |
| `components/relatorios/analise-variacao/WaterfallChartSvg.tsx` | NOVO — SVG puro |
| `components/relatorios/analise-variacao/WaterfallChartSvgWrapper.tsx` | NOVO — dynamic |
| `components/relatorios/analise-variacao/WaterfallChart.tsx` | DELETAR (código morto após swap) |
| `components/relatorios/analise-variacao/WaterfallChartWrapper.tsx` | DELETAR |
| `app/(dashboard)/.../analise-variacao-client.tsx` | Swap import |
| `__tests__/analise-variacao.test.ts` | +18 testes (engine + tipo) |

---

## 4. Riscos

| Risco | Mitigação |
|---|---|
| SVG sem responsiveness automática | `viewBox` + `width="100%"` + `preserveAspectRatio` |
| Performance ruim com muitas barras | Top 6 agressivo limita; ≤8 elementos no DOM |
| Cálculo de connector diagonal errado em barras `reducao` | Teste unitário do `WaterfallBarShape` — coord de início da próxima |
| Aritmética quebra com Top 6 mais agressivo | `selecionarDriversVisuais` continua preservando soma exata (testado) |
| Dark mode contrast | Cores `#dc2626` etc são CSS válidas pra ambos; bg do SVG transparente herda do tema |
| Quebra build após delete dos arquivos antigos | Swap import antes de deletar, então deletar |

---

## 5. Aprovação solicitada

Yussef, antes de Fase 2:

1. **SVG puro com scaleLinear/scaleBand manuais** (sem instalar d3-scale)?
   Recomendo manual — `<40 linhas` de utilitário, zero dep nova.
2. **Defaults agressivos: topN=6, threshold=8%, mín=4**?
   Recomendo sim — Yussef pediu corte agressivo (problema #2).
3. **Bullet "X outros drivers somam Y" REMOVIDO** dos insights?
   Recomendo sim — Yussef classificou como ruído.
4. **Deletar arquivos antigos** `WaterfallChart.tsx` e wrapper Recharts após
   swap? Recomendo sim — código morto polui.

Se OK em tudo, sigo Fase 2 (implementação + 18 testes + deploy).
