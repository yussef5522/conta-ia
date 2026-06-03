# Sprint PF Dashboard — proposta de design

> **Status:** estudo + proposta — aguardando aprovação do Yussef.
> **Data:** 03/06/2026.
> **Estimativa:** 4-5 dias (foco visual; 90% frontend, sem migration).
> **Lema do Yussef:** "1 muito bem feito > vários meia-boca."

---

## 0. TL;DR

Dashboard PF "Mercury/Brex meets Mobills": premium fintech ocidental + simplicidade BR. Uma única tela com **6 zonas verticais**, cada uma resolvendo UMA pergunta. Hero gradient verde (workspace PF), donut grande de despesas (a "bola" pedida), evolução mensal combinada, faixa de cartões, recorrentes, ponte PJ→PF (DIFERENCIAL exclusivo), atividade recente. Reuso pesado dos componentes do Dashboard PJ (Sprint 1) — só 5 componentes novos.

Endpoints já existem (`dashboard-summary`, `saldo-previsto`, `insights/recorrentes`, `pontes/summary`). 1 endpoint novo orquestrador opcional + 1 pra evolução mensal. **Zero migration.**

---

## 1. Pesquisa dos líderes (relembrando)

### 1.1 Mobills (líder PF Brasil — 10M+ users)

**Layout típico do dashboard:**
- Topo: **saldo geral** + filtro de período (mês atual default)
- Linha de KPIs: Receitas, Despesas, Saldo do mês (verde/vermelho/cor)
- **Gráfico rosca** de despesas por categoria (centro = total)
- **Gráfico linha** de evolução mensal (12 meses)
- Cards de **cartões** (limite usado em barra de progresso colorida)
- Lista de **últimas transações**

**Pontos fortes:** simplicidade, mobile-first, ícones por categoria, animações suaves.
**Pontos fracos:** sem ponte PJ→PF, IA básica, sem insights de recorrência fortes.

### 1.2 Organizze

- **Saldo previsto** (inclui lançamentos futuros) — diferencial
- "Saúde financeira" score
- Gráfico de pizza categorias + comparativo mês anterior
- Metas / objetivos financeiros
- Calendário com agenda de lançamentos futuros

**Pontos fortes:** saldo previsto, score de saúde, metas.
**Pontos fracos:** UX mais complexa, paga (premium $).

### 1.3 Kinvo

Foco em PATRIMÔNIO (não gastos do dia-a-dia). Gráficos de evolução patrimonial, distribuição por classe de ativo, rentabilidade. **Menos relevante** pra Conta IA PF (foco caixa, não investimento). Não copio.

### 1.4 Mercury / Brex (referência visual fintech ocidental)

- Hero gradient + KPI grande
- Tipografia tabular-nums
- Cards arredondados, sombras sutis
- Sparklines em todos os KPIs
- Microinterações (hover states)

Já aplicamos no Dashboard PJ (Sprint 1). **Aproveitar 100%.**

---

## 2. Diferenciais que NÓS temos que eles NÃO têm

| Diferencial | Mobills | Organizze | Conta IA |
|---|---|---|---|
| **Ponte PJ→PF** (entradas vindas de empresas do próprio sócio) | ❌ | ❌ | ✅ (Fatia 4) |
| IA de categorização aprendida (regras + Claude) | parcial | parcial | ✅ (Fatia 3) |
| OFX cartão com parcelas detectadas | ❌ | parcial | ✅ (Fatia 3) |
| Internacional/IOF detectado | ❌ | ❌ | ✅ (Fatia 3) |
| Insights de recorrência (assinaturas) automático | parcial | ❌ | ✅ (Fatia 3) |
| Saldo previsto incluindo cheque especial | ❌ | parcial | ✅ (Sprint 0.5 + Fatia 1) |
| Dashboard dual PJ ↔ PF integrado | ❌ | ❌ | ✅ (workspace switcher) |
| Pareamento 1-clique entradas PJ→PF | ❌ | ❌ | ✅ (Fatia 4) |

→ **8 diferenciais** sustentáveis. Dashboard PF tem que **destacar visualmente** pelo menos os 4 marcados em negrito (ponte, IA, recorrentes, saldo previsto).

---

## 3. Proposta de layout — 1 versão bem pensada

> Princípio: **cada zona resolve UMA pergunta**. Sem zonas "decorativas".

```
┌──────────────────────────────────────────────────────────────────────────┐
│  HEADER (workspace switcher PF/PJ verde — já existe)                    │
└──────────────────────────────────────────────────────────────────────────┘

┌─ ZONA 1 — HERO STRIP (gradient verde-esmeralda) ─────────────────────────┐
│                                                                          │
│  Yussef Musa · CPF ***.258.890-**                       Maio/2026  ▾    │
│                                                                          │
│  R$ 12.347,89                                                            │
│  Saldo total · 3 contas                                                  │
│  Sparkline 30d ─────────╱╲────╱──────╲                                  │
│                                                                          │
│  ┌─────────────────┬─────────────────┬─────────────────┐               │
│  │ ENTRADAS MÊS    │ SAÍDAS MÊS      │ RESULTADO MÊS   │               │
│  │ +R$ 18.200,00   │ -R$ 9.450,00    │ +R$ 8.750,00    │               │
│  │ Sparkline       │ Sparkline       │ Sparkline       │               │
│  │ ↑ +12% vs abril │ ↓ -8% vs abril  │ ↑ +85% vs abril │               │
│  └─────────────────┴─────────────────┴─────────────────┘               │
│                                                                          │
│  💡 Saldo previsto em 30 dias: R$ 14.100 (incluindo cheque especial)   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
   Pergunta que essa zona resolve: "Como estou financeiramente AGORA?"
   Reuso: KPICard + Sparkline + Hero gradient (do PJ, recolorido verde)


┌─ ZONA 2 — GRÁFICO PRINCIPAL (a "BOLA" pedida) ───────────────────────────┐
│                                                                          │
│  Em que estou gastando?                                                 │
│  ───────────────────────────────                                        │
│                                                                          │
│  ┌──────────────────────────────────┐  ┌──────────────────────────────┐ │
│  │                                  │  │ 📊 Por categoria             │ │
│  │           🍰                     │  │                              │ │
│  │      Gráfico Rosca               │  │ 🍔 Alimentação    R$ 2.100  │ │
│  │      Recharts 280px              │  │    ████████ 22%             │ │
│  │                                  │  │ 🚗 Transporte     R$ 1.450  │ │
│  │   Centro: total despesas mês     │  │    ██████ 15%               │ │
│  │   R$ 9.450,00                    │  │ 🏠 Moradia        R$ 1.380  │ │
│  │                                  │  │    █████ 15%                │ │
│  │   8 fatias coloridas             │  │ 💳 Cartão         R$ 980    │ │
│  │   (top 7 + "Outros")             │  │    ████ 10%                 │ │
│  │                                  │  │ 🎮 Lazer          R$ 720    │ │
│  │   Hover = % + R$ + tooltip       │  │    ███ 8%                   │ │
│  │   Click = drill-down (tabela)    │  │ ⚕️ Saúde          R$ 540    │ │
│  │                                  │  │    ██ 6%                    │ │
│  │                                  │  │ 📚 Educação       R$ 350    │ │
│  │                                  │  │    █ 4%                     │ │
│  │                                  │  │ 📦 Outros         R$ 1.930  │ │
│  │                                  │  │    ████ 20%                 │ │
│  └──────────────────────────────────┘  └──────────────────────────────┘ │
│                                                                          │
│  [ Ver todas as despesas →]              [ Comparar com abril ↔ ]      │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
   Pergunta: "Pra onde foi meu dinheiro?"
   Reuso: TopCategoriesDonut + TopCategoriesChart wrapper (genérico do PJ)
   NOVO: drill-down modal lateral (Sheet)


┌─ ZONA 3 — EVOLUÇÃO MENSAL (12 meses, linha+barras) ──────────────────────┐
│                                                                          │
│  Evolução nos últimos 12 meses                  [Saldo] [Movimento] ▾   │
│  ───────────────────────────────                                        │
│                                                                          │
│  Recharts ComposedChart:                                                │
│   - Barras verdes (entradas) + vermelhas (saídas) lado a lado          │
│   - Linha azul (saldo cumulativo) por cima                              │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ R$                                                  ─── ── ──── │   │
│  │ 30k                                          ──╱──╲           │   │
│  │      ╱──╲                              ──────                  │   │
│  │ 20k ╱    ╲                  ────────                            │   │
│  │     ▌  ▌  ▌  ▌  ▌  ▌  ▌  ▌  ▌  ▌  ▌  ▌                          │   │
│  │ 10k ▌  ▌  ▌  ▌  ▌  ▌  ▌  ▌  ▌  ▌  ▌  ▌                          │   │
│  │     ▌  ▌  ▌  ▌  ▌  ▌  ▌  ▌  ▌  ▌  ▌  ▌                          │   │
│  │  0  ▌  ▌  ▌  ▌  ▌  ▌  ▌  ▌  ▌  ▌  ▌  ▌                          │   │
│  │     jun jul ago set out nov dez jan fev mar abr mai             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
   Pergunta: "Estou melhorando ou piorando ao longo do tempo?"
   NOVO: MonthlyEvolutionChart (Recharts ComposedChart + dynamic ssr:false)


┌─ ZONA 4 — DIFERENCIAIS (3 cards lado a lado) ────────────────────────────┐
│                                                                          │
│  ┌──────────────────────┬──────────────────────┬──────────────────────┐ │
│  │ 🌉 Ponte PJ→PF       │ 🔁 Assinaturas       │ 💳 Cartões           │ │
│  │ ──────────────       │ recorrentes detect.  │ de crédito           │ │
│  │                      │ ──────────────       │ ──────────────       │ │
│  │ R$ 15.000,00         │ R$ 287,90 / mês      │ R$ 1.430,00 a pagar │ │
│  │ recebido este mês    │ (R$ 3.454,80 ano)    │ Próxima fatura       │ │
│  │                      │                      │                      │ │
│  │ 2 pontes:            │ Top 5:               │ Nubank ████░ 28%    │ │
│  │ • PROFIT (R$10k)     │ Netflix    R$ 45     │ Itaú   ██░░ 14%      │ │
│  │ • CACULA (R$5k)      │ Spotify    R$ 21     │ C6     ██░░ 14%      │ │
│  │                      │ iFood club R$ 39     │                      │ │
│  │ Tipo: Distribuição   │ Claude     R$ 100    │ Limite total:        │ │
│  │                      │ Dropbox    R$ 50     │ R$ 28.500            │ │
│  │ [Ver todas →]        │ [Ver lista →]        │ [Pagar fatura →]     │ │
│  └──────────────────────┴──────────────────────┴──────────────────────┘ │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
   Pergunta: "Quais são meus padrões e compromissos?"
   Reuso ZERO em conteúdo (são novidades). Mesmo grid pattern do PJ.
   NOVO: BridgeIncomeCard, RecurringSubscriptionsCard, CreditCardSummaryCard


┌─ ZONA 5 — TRANSAÇÕES RECENTES (timeline compacta) ───────────────────────┐
│                                                                          │
│  Movimentações recentes                                  [Ver todas →]  │
│  ───────────────────────────────                                        │
│                                                                          │
│  ↗  Hoje      iFood (Almoço)           R$ -38,90    🍔 Alimentação    │
│  ↘  Ontem    Salário ACME              R$ +8.500    💰 Salário        │
│  ↗  29/05    Uber (Centro)             R$ -22,40    🚗 Transporte     │
│  ↗  28/05    Distribuição PROFIT  🌉   R$ +10.000   💰 Pró-labore     │
│  ↗  28/05    Netflix                   R$ -45,00    🎮 Lazer          │
│  ↗  27/05    iFood (Jantar)            R$ -42,10    🍔 Alimentação    │
│  ↘  26/05    Pix Cláudia               R$ +500      💝 Outros         │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
   Pergunta: "O que aconteceu de mais recente?"
   Reuso: RecentActivity pattern (do PJ) + BridgeBadge (Fatia 4)


┌─ ZONA 6 — CONTAS + PENDENTES (faixa minimal) ────────────────────────────┐
│                                                                          │
│  3 contas                                            7 pendentes 🟡    │
│  ┌──────────┬──────────┬──────────┐                  [Classificar →]   │
│  │ Nubank   │ Banrisul │ Inter PF │                                     │
│  │ R$ 8.230 │ R$ 3.117 │ R$ 1.000 │                                     │
│  └──────────┴──────────┴──────────┘                                     │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
   Pergunta: "O que tá esperando minha ação?"
   Reuso: PendingClassification pattern (do PJ)
```

---

## 4. Mapeamento técnico — reuso vs NOVO

### 4.1 ✅ Reuso direto (Sprint 1 PJ, zero código novo)

| Componente | Adaptação | Origem |
|---|---|---|
| `KPICard` | Trocar `variant=primary` (azul) por `green` ou prop `accent` | Sprint 1 Dia 1 |
| `Sparkline` + `SparklineWrapper` | Direto, sem mudança | Sprint 1 Dia 1 |
| `TopCategoriesDonut` + Chart wrapper | Trocar paleta de cores (verde+pastéis) | Sprint 1 Dia 2 |
| `RecentActivity` pattern | Trocar source de tx PJ pra tx PF | Sprint 1 Dia 5 |
| `PendingClassification` pattern | Trocar source pra `personalTransaction status=PENDING` | Sprint 1 Dia 5 |
| `EmptyDashboard` pattern | 3 empty states: sem perfil/sem conta/sem tx | Sprint 1 Dia 1 |
| `formatBRL` + Framer Motion stagger | Direto | Vários |
| `BridgeBadge` | Direto (já existe na Fatia 4) | Fatia 4 |

### 4.2 ✨ Novos componentes (5)

| Componente | Onde | Função |
|---|---|---|
| `PFHero` | `_components/PFHero.tsx` | Hero gradient verde + saldo grande + sparkline + 3 sub-KPIs + saldo previsto |
| `PFTopExpenses` | `_components/PFTopExpenses.tsx` | Donut + lista lateral + drill-down Sheet |
| `MonthlyEvolutionChart` | `_components/MonthlyEvolutionChart.tsx` | Recharts ComposedChart 12m (barras+linha) + Wrapper dynamic ssr:false |
| `DiferenciaisGrid` | `_components/DiferenciaisGrid.tsx` | Container 3 cards: Bridge + Recorrentes + Cartões |
| `BridgeIncomeCard`, `RecurringSubscriptionsCard`, `CreditCardSummaryCard` | mesmo arquivo ou separados | Cards individuais do grid |

### 4.3 Endpoints — REUSO total (sem nada novo se quiser MVP rápido)

| Endpoint | Já existe? | Função |
|---|---|---|
| `GET /api/perfis/[id]` | ✅ (F1) | Saldo + topExpenseCategories + accounts |
| `GET /api/perfis/[id]/cartoes/dashboard-summary` | ✅ (F2) | Cartões + limite usado + invoice history |
| `GET /api/perfis/[id]/cartoes/saldo-previsto` | ✅ (F2) | Saldo previsto 30d com fatura |
| `GET /api/perfis/[id]/insights/recorrentes` | ✅ (F3) | Assinaturas recorrentes detectadas |
| `GET /api/pontes/summary?profileId=&dateFrom=&dateTo=` | ✅ (F4) | Total recebido via ponte no período |
| `GET /api/perfis/[id]/transacoes?pageSize=10` | ✅ (F1) | Atividade recente |

**Endpoint NOVO opcional (1):**
- `GET /api/perfis/[id]/evolucao-mensal?months=12` — agrega tx por mês pra MonthlyEvolutionChart. **Justifica criar** porque sem ele a UI faria 12 requests separados (1 por mês) ou um payload gigante de tx. Implementação simples (15 linhas Prisma `groupBy`).

**Endpoint orquestrador (opcional, performance):**
- `GET /api/perfis/[id]/dashboard-overview?period=` — chama os 6 endpoints acima em paralelo e retorna num JSON único. Cache 60s tag `pf-dashboard:${profileId}`. Pro MVP, **faz separado** (paralelo no client). Stretch.

### 4.4 Migration — ZERO

Confirmado: zero schema change. **Sem aviso de tabelas com dados reais.** Todos os dados já existem nas Fatias 1-4.

---

## 5. Stack técnica

- Recharts 3.8.1 (já instalado — usado no PJ)
- Framer Motion 12.38.0 (já instalado)
- Tailwind + shadcn/ui (já)
- Dynamic ssr:false pra todos os charts Recharts (lição Next 16 da Sprint 1)

---

## 6. Princípios de design (aplicados)

### 6.1 "1 muito bem feito > vários meia-boca" (lema Yussef)

Cortei do roadmap inicial:
- ❌ **Score de saúde financeira PF** (Organizze tem; Mobills não tem; pode ser stretch — adiciona complexidade)
- ❌ **Calendário com agenda** (cabe na Fatia futura quando tivermos contas a pagar PF)
- ❌ **Metas/objetivos** (Organizze tem; é feature inteira separada)
- ❌ **Comparativo lado-a-lado mês-anterior** (cabe num filtro do donut, não zona dedicada)
- ❌ **Gráfico de "patrimônio" Kinvo-style** (foco caixa, não investimento)

Manteve: 6 zonas, **cada uma respondendo UMA pergunta**.

### 6.2 Coerência com Dashboard PJ

- Mesma arquitetura: Server Components com Suspense + cache `unstable_cache` 60s
- Mesmos componentes de KPI/Sparkline
- Mesmo padrão de animação entrance (Framer Motion stagger 50ms)
- Mesma paleta semântica (entradas=verde, saídas=vermelho, alerta=amber)
- **Diferença visual:** workspace verde (Hero gradient verde-esmeralda) vs azul PJ — coerente com workspace switcher dual da F1

### 6.3 Privacidade

Dashboard PF é privado por design (Fatia 1: `checkProfileAccess`). Toda query passa pelo helper. Quando entrar Família/multi-perfis na Fatia 5, queries já são scoped.

---

## 7. Validação contra os líderes

| Categoria | Mobills | Organizze | Conta IA (proposta) |
|---|---|---|---|
| KPIs no topo | ✅ | ✅ | ✅ + sparkline + saldo previsto + cheque especial |
| Donut despesas | ✅ | ✅ | ✅ + drill-down Sheet + paleta consistente |
| Evolução mensal linha | ✅ | ✅ | ✅ ComposedChart linha+barras (premium) |
| Cartões | ✅ (lista) | parcial | ✅ + barra de progresso + fatura aberta + limite total |
| Recorrentes | parcial | ❌ | ✅ detecção automática + total anual |
| **Ponte PJ→PF** | ❌ | ❌ | ✅ EXCLUSIVO |
| Atividade recente | ✅ | ✅ | ✅ + BridgeBadge identificando origem |
| Mobile responsivo | ✅✅ (mobile-first) | ✅ | parcial (desktop primeiro; mobile depois) |
| Tipografia tabular | ❌ | ❌ | ✅ (tabular-nums) |
| Animações entrance | parcial | parcial | ✅ (Framer Motion stagger) |
| Score / metas | parcial | ✅ | ❌ (cortado pra MVP) |
| Calendário lançamentos | ❌ | ✅ | ❌ (cortado pra MVP) |

**Conclusão:** competimos cabeça-a-cabeça em todos os pontos universais, **lideramos no diferencial Ponte PJ→PF** (zona 4), **lideramos em premium feel** (animações, tipografia, donut polido).

---

## 8. Plano de implementação (3-4 dias)

### Dia 1 — Infraestrutura + Hero (1 dia)
- `app/(dashboard)/perfis/[id]/page.tsx` REESCRITA como Server Component
- `_components/PFHero.tsx` (client component anima Framer Motion)
- Server fetcher paralelo (`Promise.all` nos 5 endpoints existentes)
- Layout grid responsivo

### Dia 2 — Donut + Evolução mensal (1 dia)
- `_components/PFTopExpenses.tsx` (reusa donut + drill-down Sheet shadcn)
- `_components/MonthlyEvolutionChart.tsx` + ChartLoader
- Endpoint novo `GET /api/perfis/[id]/evolucao-mensal?months=12`

### Dia 3 — Zona 4 Diferenciais + Recent (1 dia)
- `BridgeIncomeCard` (chama `/pontes/summary?profileId=`)
- `RecurringSubscriptionsCard` (chama `/insights/recorrentes`)
- `CreditCardSummaryCard` (chama `/cartoes/dashboard-summary`)
- `_components/RecentActivityPF.tsx` + integração `BridgeBadge`
- Footer zona 6 (contas + pendentes)

### Dia 4 — Polimento + smoke (0.5-1 dia)
- Empty states (sem cartão / sem ponte / sem recorrentes)
- Loading skeletons
- Mobile responsivo (breakpoints sm/md/lg)
- Tests (mínimo: 20 testes — função pura de agregação evolução mensal, formatBRL edges, empty states)
- Smoke local visual + screenshot

### Dia 5 (opcional) — Stretch goals
- Endpoint orquestrador `dashboard-overview` se performance pedir
- Filtro de período no Hero (hoje/semana/mês/3m)
- Comparativo mês anterior visualizado no donut

---

## 9. Testes (~25 testes)

| Arquivo | Testes |
|---|---|
| `agregacao-evolucao-mensal.test.ts` (função pura) | 8 — agrupamento 12m, mês com 0 tx, virada de ano, timezone |
| `formatadores.test.ts` | 5 — formatBRL grandes/negativos/zero, formatPercent |
| `dashboard-helpers.test.ts` | 5 — buildTopCategories com agregação "Outros", separar tx CREDIT/DEBIT |
| `integration-pf-dashboard.test.ts` | 7 — endpoint orquestrador (se criado) + cache + privacidade (sem profile = 401, profile alheio = 404) |

---

## 10. Aprovações pendentes (te peço confirmar antes de codar)

1. **Layout 6 zonas como descrito** — OK ou ajustar quais zonas?
2. **Cortes feitos** (sem score, sem metas, sem calendário) — concorda ou quer alguma?
3. **Endpoint novo `evolucao-mensal`** — OK criar?
4. **Endpoint orquestrador `dashboard-overview`** — MVP separado (paralelo no client) ou criar logo?
5. **Mobile responsivo** — pra MVP foco desktop; mobile como Sprint stretch dedicado?
6. **Comparativo vs mês anterior** — entra como filtro no donut OU stretch?

---

## 11. Próximo passo

Aguardo aprovação dos 6 pontos acima. Quando aprovar, sigo a sequência do §8:
- Dia 1: Hero
- Dia 2: Donut + Evolução
- Dia 3: Diferenciais + Recent
- Dia 4: Polimento + smoke
- Dia 5 (opcional): Stretch
