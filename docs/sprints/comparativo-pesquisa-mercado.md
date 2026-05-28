# Pesquisa de mercado — Relatório Comparativo

**Sprint:** Comparativo-A Fundação · **Data:** 28/05/2026
**Pesquisador:** Claude Code (6 buscas WebSearch — duplo check sobre a pesquisa
do consultor)

---

## 1. Matriz comparativa de funcionalidades

| Feature | Xero | QuickBooks | **Fathom** | Conta Azul | Omie | CAIXAOS hoje | CAIXAOS Sprint A |
|---|---|---|---|---|---|---|---|
| Comparativo multi-período | ✅ até 12m | ✅ | ✅ até **12** períodos | ⚠️ limitado | ⚠️ limitado | 3 fixos | **2/3/6/12** |
| Granularidade Mês/Tri/Ano | ⚠️ só mês | ⚠️ | ✅ | ❌ | ❌ | ❌ | **✅** |
| Coluna Média histórica | ❌ | ❌ | ⚠️ via budget | ❌ | ❌ | ❌ | **✅** |
| Variance % vs Average | ⚠️ via budget | ⚠️ | ✅ | ❌ | ❌ | ❌ | **✅** |
| **Heatmap intensidade células** | ❌ | ❌ | ⚠️ via custom | ❌ | ❌ | ❌ | **✅ ⭐** |
| Semântica IBCS favorável | ⚠️ | ⚠️ | ✅ | ❌ | ❌ | ⚠️ direção, não favorável | **✅** |
| Sticky column + h-scroll | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ❌ | **✅** |
| Cenários comparados | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | Sprint B+ |
| Drill-down célula | ✅ | ✅ | ✅ | ⚠️ | ❌ | ❌ | Sprint B |
| Export CSV/PDF | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | Sprint C |

**Fathom** ([fathomhq.com](https://www.fathomhq.com/)) é o líder em comparativo
mensal pra PMEs internacionais. Suas "Trended KPI Tables" mostram até 12
períodos contínuos lado a lado, mas **não tem heatmap de intensidade** —
mostra os números crus e o usuário precisa "ler" cada um.

---

## 2. APRESENTAÇÃO VISUAL (foco principal da pesquisa)

### 2.1 Hierarquia de informação (todos os líderes)

Princípio unânime: **ler de cima pra baixo, esquerda pra direita** com info
crítica top-left.

- **Header da página**: período + filtros (referência, tipo, granularidade)
- **Stats cards (3-4)**: indicadores agregados do período inteiro
- **Tabela matrix**: linhas = categorias, colunas = períodos × Média × vs Média
- **Footer**: total/CTA

### 2.2 Heatmap de intensidade — diferencial real

Encontrado em **Power BI matrix com conditional formatting** ([guia 1](https://www.youngurbanproject.com/power-bi-heatmap/),
[guia 2](https://blog.coupler.io/power-bi-heatmap/), [FasterCapital](https://www.fastercapital.com/content/Heat-Map--Warm-Up-to-Data--Heat-Maps-as-a-Hot-Tool-in-Power-BI.html)),
mas **NÃO está implementado nativamente em nenhum líder de PME (Fathom/Xero/QB/Conta Azul/Omie)**.

**Por que isso é o nosso diferencial:**
- Power BI matrix é DIY (analista monta) → não escala
- Fathom mostra números crus → não orienta o olhar
- Heatmap nativo no produto = lê padrões SEM ler números
- **PME brasileira não usa Power BI** → CAIXAOS oferece a vantagem direto

**Color scale escolhida** (consenso da pesquisa):
- Light-to-dark dentro de cada cor semântica
- Cor única por categoria (favorável vs desfavorável), intensidade = magnitude
- Verde = favorável, Vermelho = desfavorável (gain/loss em fintech dashboards 2026)
- Não usar binário on/off — escala perceptualmente uniforme

### 2.3 Color scale recomendada (baseada em Tailwind palette)

| Desvio | Despesa (acima=ruim) | Despesa (abaixo=bom) | Receita (acima=bom) | Receita (abaixo=ruim) |
|---|---|---|---|---|
| ±0–15% | transparente | transparente | transparente | transparente |
| ±15–40% | red-50/100 | emerald-50/100 | emerald-50/100 | red-50/100 |
| ±40–80% | red-100/200 | emerald-100/200 | emerald-100/200 | red-100/200 |
| ±80%+ | red-200/300 | emerald-200/300 | emerald-200/300 | red-200/300 |

**Sutil é melhor que vibrante** — pesquisa enfatiza que legibilidade do número
vem primeiro. Fundo das células fica leve (50-300), texto preto/cinza preserva
contraste WCAG.

### 2.4 Sticky column + scroll horizontal (mobile-friendly)

Fintech dashboards 2026 ([guia](https://www.wildnetedge.com/blogs/fintech-ux-design-best-practices-for-financial-dashboards),
[merge.rocks](https://merge.rocks/blog/fintech-dashboard-design-or-how-to-make-data-look-pretty))
recomendam:

- **Primeira coluna (categoria) sticky** com `position: sticky; left: 0; z-index: 10`
- Container com `overflow-x: auto` quando 12 colunas excederem viewport
- `min-width` por coluna pra evitar compressão
- Mobile: stacked scroll (não tentar 12 colunas em 390px) — Sprint C
- Tipografia tabular-nums em todas as células de valor (alinhamento vertical
  perfeito)

### 2.5 Float Cash Flow ([float.app](https://floatapp.com/))

Toggle daily/weekly/monthly é referência pra granularidade — adotamos
mês/trimestre/ano (Causal usa também). Float TOGGLA tudo de uma vez, sem
filtro persistente — vamos mais longe com URL state.

### 2.6 Tipografia + alinhamento (consenso)

- Valores: `tabular-nums` (mono numérico)
- Negative em **vermelho com parênteses** ou cor + sinal (estilo contábil)
- Headers: uppercase + tracking-wider + text-muted-foreground
- Linhas alternadas com `even:bg-muted/30` (zebra) — opcional

---

## 3. O que NENHUM líder faz bem (nossa chance de superar)

### 3.1 Coluna "vs Média Histórica" explícita

Fathom mostra "vs Budget" e "vs Prior Period". **Nenhum mostra "vs Média
das últimas N entradas"** — que é exatamente o que Yussef quer ("ficar
olhando se algo subiu fora da média dos outros meses").

Esta é uma feature **única** do CAIXAOS.

### 3.2 Heatmap nativo em PME brasileira

Conta Azul e Omie tem relatórios comparativos BÁSICOS (tabela crua). Nenhum
oferece heatmap de intensidade. Power BI tem mas exige analista. **Primeiro
CAIXAOS do Brasil a oferecer essa visualização nativamente.**

### 3.3 Semântica IBCS rigorosa

Conta Azul/Omie usam cores arbitrárias (vermelho/verde inconsistente entre
relatórios). **CAIXAOS adota IBCS**: SEMPRE verde=favorável, vermelho=desfavorável,
independente da direção (subir despesa = vermelho, subir receita = verde).

### 3.4 Card "Fora da Média" acionável

Stats cards típicos mostram contagem ("3 subindo"). **Card "Fora da Média"
diz qual ação tomar**: "5 custos acima do normal → trabalhe pra normalizar".
Yussef pediu literalmente.

---

## 4. Recomendações concretas pra Sprint A

### 4.1 Features de dados

1. **Multi-período**: 2/3/6/12 meses (default 3, mantém retrocompat)
2. **Granularidade**: mês (default) / trimestre / ano via env
3. **Média histórica EXCLUI mês atual** (decisão Yussef — média deve ser
   "referência" não "auto-comparação")
4. **Threshold de desvio**: ±15% pra entrar em "fora da média" (mesmo
   threshold que `STABLE` no algoritmo atual — consistência)
5. **Manter retrocompat** com query atual (3 meses) — adicionar params
   opcionais `meses=` e `granularidade=`

### 4.2 Features de apresentação

1. **Heatmap nas células** com 4 níveis de intensidade (transp/50/100/200)
2. **Color scale por semântica** (despesa+ ruim / receita+ bom)
3. **Sticky column** + `overflow-x-auto`
4. **`tabular-nums`** em todas as cells numéricas
5. **Header label dinâmico** ("Mar/26" / "Q1/26" / "2025") pela granularidade
6. **Empty cells** mostram "—" não R$ 0,00 (reduz ruído visual)

### 4.3 Card "Fora da Média" (4º card)

- Mostra contagem de DESPESAS com desvio > +15%
- Tom vermelho (não verde) — chama atenção
- Subtext: "custos acima do normal"

### 4.4 Cards existentes recalculados

- Card "Novas": categorias que aparecem APENAS no mês atual (não nos
  N-1 anteriores)
- Card "Subindo" / "Descendo": baseados no mês atual vs penúltimo
  (não vs média) — mantém semântica antiga, fácil leitura

### 4.5 NÃO fazer nesta Sprint A (vai pras seguintes)

- Drill-down célula → Sprint B
- Segmentação por DRE group → Sprint B
- Export CSV/PDF → Sprint C
- Redesign layout completo → Sprint C
- Mobile stacked view → Sprint C

---

## 5. Sources

- [Fathom Help — Trended KPI Tables](https://support.fathomhq.com/en/articles/1425587-financial-statements-tables-in-reports)
- [Fathom Reporting deep dive](https://www.apitchdeck.com/blog/mastering-fathom-reporting-a-deep-dive-into-layout-design-and-crafting-executive-summaries)
- [Fathom Features](https://www.fathomhq.com/features)
- [Causal vs Runway comparison](https://runway.com/blog/best-modern-fpa-software-runway-vs-abacum-vs-mosaic-vs-causal)
- [Power BI Heatmap step-by-step](https://www.youngurbanproject.com/power-bi-heatmap/)
- [Power BI Heatmap (Coupler)](https://blog.coupler.io/power-bi-heatmap/)
- [Heat Map em Power BI (FasterCapital)](https://www.fastercapital.com/content/Heat-Map--Warm-Up-to-Data--Heat-Maps-as-a-Hot-Tool-in-Power-BI.html)
- [Matrix Marvels — heatmap em matrix](https://fastercapital.com/content/Matrix-Visual--Matrix-Marvels--Integrating-Heat-Maps-into-Power-BI-Matrix-Visuals)
- [Fintech UX best practices 2026](https://www.wildnetedge.com/blogs/fintech-ux-design-best-practices-for-financial-dashboards)
- [Fintech dashboard design — Merge Rocks](https://merge.rocks/blog/fintech-dashboard-design-or-how-to-make-data-look-pretty)
- [Best finance dashboard templates 2026](https://thefrontkit.com/blogs/best-finance-dashboard-templates-2026)
- [Conta Azul vs Omie 2026 (Ledware)](https://www.ledware.com.br/2026/05/05/contaazul-omie-sage-ledcontabil-comparativo-sistemas-cloud-escritorios-2026/)
- [Omie vs Conta Azul (Jestor)](https://blog.jestor.com/omie-vs-conta-azul-melhor-erp-pequenas-empresas/)
- [Float Cash Flow features](https://www.floatapp.com/features)
- [Float Cash Flow review 2026](https://research.com/software/reviews/float-cash-flow-forecasting)
