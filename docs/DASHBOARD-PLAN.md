# 🚀 Conta IA — Plano Mestre: Dashboard Mundial + Superar Conta Azul

**Data:** 10 de maio de 2026
**Autor:** Yussef + Claude (sessão estratégica)
**Status:** Documento de referência para FASE 5.5 (Dashboard Mundial)

---

## 📋 Sumário Executivo

Este documento consolida 3 entregáveis em um:

1. **PARTE A — Pesquisa profunda da Conta Azul** (forças, fraquezas, oportunidades)
2. **PARTE B — Mockup visual do Dashboard Mundial** (UI/UX detalhada)
3. **PARTE C — Plano técnico de implementação** (sprints, componentes, queries)

**Tese principal:** O Conta IA já tem **superioridade técnica** sobre Conta Azul em fundação (multi-tenant + RBAC + Audit Log + Centro de Custo + DRE com drill-down + 13 academias como case real). O que falta é **a primeira impressão visual** (dashboard) e **a IA Contadora funcionando** (FASE 3+4). Resolvendo esses dois eixos, o Conta IA está pronto para competir e vencer.

---

# PARTE A — PESQUISA PROFUNDA: CONTA AZUL

## A.1 — O que a Conta Azul tem hoje (mapeado)

### A.1.1 — Dashboard Principal (Conta Azul Pro)
- Tela inicial com visão consolidada de **contas a pagar e receber + saldos bancários**
- Gráfico de **Fluxo de Caixa** (linha contínua = realizado, tracejada = previsto)
- Visão **Realizado / Previsto / Orçado** (3 modos)
- Análise **horizontal e vertical** em % e valores
- Atualização **D-1** (dia anterior, não tempo real)
- **Drill Up / Drill Down** entre períodos (mês → trimestre)
- Filtros por: centro de custo, banco, categoria, cliente/fornecedor

### A.1.2 — DRE Gerencial
- DRE seguindo **regime de competência** (não caixa)
- Apresentação **mensal, bimestral, trimestral, semestral, anual**
- Filtros: categoria, cliente/fornecedor, centro de custo, conta
- **Drill-down** clicando no valor total mensal → ver lançamentos
- Análise **vertical** (% de cada conta sobre receita) e **horizontal** (evolução mês a mês)
- Mais de **10 relatórios DRE** disponíveis no plano Pro
- Exportar em **PDF, CSV, XLS**
- Personalização limitada (precisa contratar adicional "Relatórios Personalizados")

### A.1.3 — Fluxo de Caixa
- **Fluxo de Caixa Mensal** (por mês e categoria)
- **Fluxo de Caixa Projetado** (60-90 dias e 2-5 anos)
- **Fluxo de Caixa Livre** (após dívidas e investimentos)
- Visão por vencimento OU por baixa
- Comparativo previsto x realizado
- Gráficos visuais

### A.1.4 — Conciliação Bancária
- Integração bancária automática (parceiros como Pluggy)
- Conciliação automática
- Possibilidade de criar lançamento direto da conciliação

### A.1.5 — Conta AI Captura (lançado 2025)
- IA captura boletos, NFs e comprovantes via WhatsApp/email
- **Extrai dados automaticamente** (número, valor, vencimento)
- Sugere lançamento contas a pagar
- Vincula documento automaticamente

### A.1.6 — Outras funcionalidades
- Emissão NF-e, NFS-e, NFC-e (com novos campos Reforma Tributária 2026)
- Estoque integrado
- Vendas e contratos
- App mobile "Conta Azul de Bolso"
- Integração com bancos (correspondente bancário)

### A.1.7 — Pricing (problema crítico deles!)
Histórico real de cliente fiel desde 2022 (do Reclame Aqui):
- 2022/2023: R$ 1.535/ano
- 2023/2024: R$ 1.918/ano
- 2024/2025: R$ 2.638/ano
- 2025/2026: R$ 3.263/ano
- 2026/2027 proposto: **R$ 8.638/ano** (aumento de 165% em 1 ciclo!)

---

## A.2 — Fraquezas REAIS da Conta Azul (oportunidades pra nós!)

### 🔴 Fraqueza 1: Reajuste agressivo + suporte ruim
- **Padrão recorrente** de reajustes acima de 30%/ano
- Em 2026 alguns clientes receberam reajuste de **165% num único ciclo**
- Suporte chatbot que "não entende o problema" e "dá soluções que não tem nada a ver"
- Tempo médio de resposta: 6 dias e 22 horas (Reclame Aqui)
- **Oportunidade:** Conta IA pode posicionar preço justo + atendimento humano

### 🔴 Fraqueza 2: Bugs em emissão de NFS-e (problema desde Jan/2026)
- Mensagens "RPS já em uso por outra Venda" mesmo em CNPJ novo
- Atendentes "não prestam atenção no chamado"
- **Oportunidade:** Conta IA pode focar em qualidade/estabilidade real

### 🔴 Fraqueza 3: Dashboard fraco (ironicamente, eles oferecem o **Power BI da Kondado** como suplemento)
- O fato de existir um **template de Power BI separado** pra Conta Azul (Kondado) significa que o dashboard nativo deles **não é suficiente**
- Usuários precisam exportar dados pra ter visão estratégica de verdade
- **Oportunidade:** Conta IA tem dashboard nativo de qualidade Power BI

### 🔴 Fraqueza 4: Multi-empresa fraco
- Conta Azul Mais (pra contadores) tem visão multi-cliente, mas dentro do Conta Azul Pro normal **cada empresa é uma conta separada**
- Quem tem 13 academias precisaria de 13 assinaturas
- **Oportunidade:** Conta IA já é multi-tenant nativo (1 user → N empresas), perfeito pro próprio Yussef

### 🔴 Fraqueza 5: Personalização limitada
- DRE Gerencial: grupos **NÃO** podem ser personalizados
- Plano de contas tem hierarquia rígida
- "Relatórios personalizados" é serviço pago à parte
- **Oportunidade:** Conta IA já tem `dreGroup` flexível + multi-regime tributário + custom roles

### 🔴 Fraqueza 6: IA é só captura, não classificação inteligente
- "Conta AI Captura" extrai dados de boletos/NFs (OCR + NLP)
- **Não tem** classificação automática de transações OFX
- **Não tem** aprendizado a partir de confirmações manuais
- **Não tem** chat de IA contadora respondendo perguntas
- **Oportunidade:** FASE 3+4 do Conta IA é exatamente isso — classificação automática que aprende

### 🔴 Fraqueza 7: Atualização D-1 (dia anterior)
- Dashboard só atualiza com dados até o dia anterior
- **Oportunidade:** Conta IA pode oferecer **tempo real** (cada OFX/Pluggy import já reflete imediatamente)

---

## A.3 — Forças da Conta Azul (o que NÃO faz sentido tentar copiar)

✅ **Marca consolidada** (desde 2011, 17 anos de mercado)
✅ **Emissão fiscal completa** (NF-e, NFS-e, NFC-e em todos municípios)
✅ **Conta PJ própria** (instituição de pagamento autorizada BACEN)
✅ **Programa de Parceria com contadores**
✅ **Estoque + PDV** integrados
✅ **App mobile maduro**

**Decisão estratégica:** não tentamos competir nessas frentes no curto prazo. Foco no que dá pra ganhar: **dashboard + IA + preço justo + UX premium.**

---

## A.4 — Benchmark mundial: o que os melhores fazem

### Mercury, Brex, Ramp, Stripe (fintechs top globais)

**Padrões visuais que funcionam:**
- **Dark navy** (#1E3A8A) + **gradientes vibrantes** = sensação premium
- **Verde (#10B981)** como acento pra crescimento positivo
- **Branco/cinza claro** como bg primário (legibilidade)
- **Vermelho restrito a alertas** (não decoração)
- **Tipografia bold** pros números principais (24px+, weight 500-600)
- **Cards com mini-gráficos embutidos** (tendência captada de relance)

**Padrões de UX:**
- **Hierarquia clara:** 3-5 KPIs no topo, depois trends, depois detalhes
- **Card-based layout** (Brex, Mercury, Ramp todos usam)
- **Ramp:** AI proativa flagando gastos duplicados, oportunidades de economia
- **Brex:** "$50B+ spent through Brex" no hero (prova social em $)
- **Mercury:** Dashboard preview real (não ilustração)
- **Stripe:** "4 linhas de código" — complexidade no backend, simplicidade no frontend

**Princípios de Fintech UX 2026:**
1. **Show the product, not a metaphor** (mostrar dado real, não ícone)
2. **Quantify everything** (ao invés de "save money", dizer "save 23%")
3. **Whitespace generoso** (tarefas financeiras já são mentalmente pesadas)
4. **Microinteractions com feedback** (clicou em algo crítico? Dê confirmação visual)
5. **AI Insights com confidence levels** ("85% certeza que vai bater meta")
6. **Personalização baseada em comportamento** (não demografia)

---

# PARTE B — MOCKUP DO DASHBOARD MUNDIAL

## B.1 — Filosofia visual

**Norte estético escolhido:** "Conta Azul melhorada — familiar BR, mas premium"

Isso significa:
- ✅ Estrutura familiar (sidebar esquerda + área principal) — **zero curva de aprendizado**
- ✅ Português brasileiro nativo, terminologia contábil BR
- ❌ MAS sem visual datado, ícones genéricos, cores fracas
- ✅ Padrão visual de Brex/Ramp/Mercury aplicado aos componentes
- ✅ Densidade de informação como Bloomberg, mas sem o "ruído" deles
- ✅ Tipografia premium, espaçamento generoso, microinteractions

## B.2 — Estrutura do Dashboard (zonas)

```
┌─────────────────────────────────────────────────────────────────┐
│ TOP BAR — Logo + seletor empresa + filtro período + user        │
├──────────┬──────────────────────────────────────────────────────┤
│          │ HERO STRIP — KPIs principais (4 cards)               │
│          │ ────────────────────────────────────                 │
│          │ ZONA A — Saúde Financeira (mini-gráficos)            │
│ SIDEBAR  │ ────────────────────────────────────                 │
│          │ ZONA B — Fluxo de Caixa visual + Alertas IA          │
│ - Dash   │ ────────────────────────────────────                 │
│ - Empre. │ ZONA C — DRE compacta + Top categorias               │
│ - Trans. │ ────────────────────────────────────                 │
│ - Contas │ ZONA D — Atividade recente + Pendentes IA            │
│ - DRE    │                                                      │
│ - Fluxo  │                                                      │
│ - Plano  │                                                      │
│ - ...    │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

## B.3 — Detalhamento por zona

### B.3.1 — HERO STRIP (4 KPIs principais)
Os 4 KPIs MAIS importantes para o gestor BR de PME:

| Card 1 | Card 2 | Card 3 | Card 4 |
|---|---|---|---|
| 💰 **Saldo Atual** | 📈 **Receita do mês** | 💸 **Despesas do mês** | 🎯 **Resultado** |
| R$ 87.421,30 | R$ 142.350 | R$ 98.220 | R$ 44.130 |
| ↑ +12% vs mês ant. | ↑ +8% YoY | ↓ -3% (bom!) | Margem 31% |
| sparkline 30d | sparkline 12m | sparkline 12m | doughnut bruto/líquido |

**Diferencial vs Conta Azul:** mostra **YoY + sparkline em cada card** + cor semântica (verde/vermelho) + delta percentual sempre visível.

### B.3.2 — ZONA A: Saúde Financeira (4 mini-gráficos)
Inspirado no que tu já tem (5.4.C — KPIs estratégicos + Saúde Financeira), mas **mais visual**:

- **Burn Rate** (despesas/mês) — barra horizontal
- **Runway** (meses até zerar caixa) — gauge circular
- **Liquidez** (ativos líquidos / passivos curtos) — número grande + status
- **Margem EBITDA** (atual vs meta) — barra de progresso

### B.3.3 — ZONA B: Fluxo de Caixa Visual + Alertas IA ⭐ (DIFERENCIAL)
**Lado esquerdo (60%):** Gráfico de waterfall de fluxo de caixa (modelo CFO Dashboard)
- Barra azul = saldo inicial
- Barras verdes = entradas (vendas, recebimentos)
- Barras vermelhas = saídas (folha, fornecedores, impostos)
- Barra final = saldo projetado

**Lado direito (40%):** Cards de **Alertas IA Proativa** (NOVO — Conta Azul não tem):
- ⚠️ "Identifiquei R$ 4.200 em assinaturas duplicadas em 2 contas"
- 💡 "Migrar pra Lucro Presumido pode economizar R$ 12k/ano"
- 🔴 "23 transações pendentes de classificação (tempo estimado: 3 min)"
- 🟢 "Você está 18% acima da meta de receita do mês — parabéns!"

### B.3.4 — ZONA C: DRE Compacta + Top Categorias
**Lado esquerdo (50%):** Mini-DRE (5 linhas)
| | Mês atual | Mês anterior | YoY |
|---|---|---|---|
| Receita Bruta | R$ 142k | R$ 131k | +12% |
| (-) Deduções | R$ 14k | R$ 13k | +8% |
| Lucro Bruto | R$ 128k | R$ 118k | +9% |
| EBITDA | R$ 56k | R$ 49k | +14% |
| **Lucro Líquido** | **R$ 44k** | **R$ 38k** | **+16%** |

→ Botão "Ver DRE completa" (vai pra `/dre`)

**Lado direito (50%):** Top 5 Categorias do mês (donut chart)
- Visual estilo Mercury (clean, espaço respirando)

### B.3.5 — ZONA D: Atividade Recente + Pendentes IA
**Lado esquerdo (50%):** Últimas 10 transações (estilo timeline)
- Avatar do banco/fornecedor + descrição + valor + categoria

**Lado direito (50%):** Pendentes da IA (call-to-action)
- "🧠 23 transações aguardando sua revisão"
- "A IA já sugeriu categorias — você só confirma"
- Botão grande: **Revisar agora →**

## B.4 — Multi-empresa (diferencial das 13 academias)

No topo, o **seletor de empresa** tem 3 modos:
1. **Empresa única** (academia X) — dashboard normal
2. **Consolidado** (todas) — soma agregada com filtros
3. **Comparativo** (lado a lado) — perfeito pro Yussef ver qual academia está bombando

> Conta Azul **não tem** comparativo multi-empresa nativo. Esse é teu trunfo de R$ 8 mil/ano.

## B.5 — Paleta de cores definitiva

| Tipo | Light Mode | Dark Mode | Uso |
|---|---|---|---|
| Brand primary | #185FA5 (blue 600) | #85B7EB (blue 200) | Logo, CTAs principais |
| Success | #1D9E75 (teal 400) | #5DCAA5 (teal 200) | Ganhos, positivo, +R$ |
| Danger | #E24B4A (red 400) | #F09595 (red 200) | Perdas, alertas críticos, -R$ |
| Warning | #EF9F27 (amber 400) | #FAC775 (amber 100) | Atenção, IA insights |
| Neutral | #B4B2A9 (gray 200) | #5F5E5A (gray 600) | Texto secundário |
| Bg primary | #FFFFFF | #1A1A19 | Cards |
| Bg page | #F1EFE8 (gray 50) | #2C2C2A (gray 800) | Fundo geral |

## B.6 — Tipografia

- **Headings:** Inter ou Anthropic Sans (fallback: system-ui)
- **Body:** mesma família, weight 400
- **Números KPI:** weight 500, size 28-32px (tabular-nums!)
- **Labels:** 13px, weight 400, color secondary
- **Tabular-nums obrigatório** em todos os números (alinhamento perfeito de colunas)

---

# PARTE C — PLANO TÉCNICO DE IMPLEMENTAÇÃO

## C.1 — Princípios

1. **Não reinventar:** usa o que já tá pronto (DRE engine, KPIs estratégicos, RBAC, audit log)
2. **Componentização:** cada zona do dashboard é um Server Component independente
3. **Performance:** queries em paralelo, cache de 60s pros KPIs, SWR pra UX
4. **Mobile-first:** sidebar vira drawer (já feito em 5.4.NAV ✅)

## C.2 — Stack para o Dashboard

| Camada | Tecnologia | Onde já existe |
|---|---|---|
| Componentes | shadcn/ui + Tailwind | ✅ instalado |
| Gráficos | **Recharts** (primário) | ❌ adicionar (`pnpm add recharts`) |
| Sparklines | Recharts `<LineChart>` mini | (vem junto) |
| Animações | Framer Motion | ❌ adicionar (`pnpm add framer-motion`) |
| Datas | date-fns + locale ptBR | ✅ já em uso |
| Cache | unstable_cache do Next.js | ✅ nativo |

## C.3 — Arquitetura de pastas

```
app/(dashboard)/
├── page.tsx                        # ← REDESIGN COMPLETO (hoje só tem 104 bytes!)
├── _components/
│   ├── dashboard/
│   │   ├── HeroKPIs.tsx            # 4 cards principais
│   │   ├── HealthCheck.tsx         # Saúde Financeira (Burn, Runway, etc)
│   │   ├── CashflowWaterfall.tsx   # Waterfall principal
│   │   ├── AIInsights.tsx          # Cards de alertas IA ⭐
│   │   ├── MiniDRE.tsx             # DRE compacta
│   │   ├── TopCategories.tsx       # Donut top 5
│   │   ├── RecentActivity.tsx      # Timeline transações
│   │   ├── PendingClassification.tsx  # CTA pendentes IA
│   │   └── CompanySelector.tsx     # Seletor multi-empresa
│   └── shared/
│       ├── KPICard.tsx             # Reutilizável
│       ├── Sparkline.tsx           # Reutilizável
│       └── PeriodFilter.tsx        # Filtro topo
```

## C.4 — Queries necessárias (lib/dashboard/)

```typescript
// lib/dashboard/queries.ts

export async function getHeroKPIs(companyId: string, period: Period) {
  // Retorna: saldo, receita, despesas, resultado + sparklines + deltas
  // Reutiliza: lib/dre/calculate.ts (já existe)
}

export async function getHealthCheck(companyId: string) {
  // Reutiliza: lib/kpis/saude-financeira.ts (já existe!)
}

export async function getCashflowWaterfall(companyId: string, period: Period) {
  // NOVO — calcular: saldo inicial + entradas + saídas + saldo final
  // Por categoria/dreGroup
}

export async function getAIInsights(companyId: string) {
  // NOVO — chamada Claude Haiku com:
  // - últimas 100 transações
  // - regras aprendidas
  // - tendências do DRE
  // Retorna: array de insights priorizados
  // Cache: 1 hora
}

export async function getMiniDRE(companyId: string) {
  // Reutiliza: lib/dre/calculate.ts (5 linhas)
}

export async function getTopCategories(companyId: string, period: Period) {
  // Top 5 categorias por valor (despesa) no período
}

export async function getRecentTransactions(companyId: string, limit = 10) {
  // Últimas N transações com join em supplier + category
}

export async function getPendingCount(companyId: string) {
  // count(transactions where status = PENDING)
}
```

## C.4.1 — REQUISITOS CRÍTICOS adicionados (10/05/2026)

### 🔄 Transferências entre contas da mesma empresa

**Caso de uso real (Yussef):** cada uma das 13 academias tem 3-4 contas bancárias (Banrisul, Sicredi, Sicoob, Caixa, etc). Acontece de transferir dinheiro de uma conta pra outra DA MESMA academia (ex: pra cobrir folha que cai numa conta específica).

**Problema técnico:** se isso for tratado como saída + entrada simples, o DRE infla com receita/despesa fake. Pode até gerar imposto sobre dinheiro que não foi ganho.

**Solução:**

1. **Schema:** adicionar campo `transferGroupId String?` na tabela `transactions`
   - Quando preenchido, indica que essa transação é PARTE de uma transferência
   - As 2 transações pareadas têm o MESMO `transferGroupId` (ex: `tx-abc123`)
   - O tipo `TRANSFER` já existe no enum `type` ✅

2. **API criar transferência** (atomic via `prisma.$transaction`):
   ```typescript
   POST /api/transferencias
   body: { fromAccountId, toAccountId, amount, date, description?, notes? }

   // Cria 2 transações com mesmo transferGroupId
   // Tipo: TRANSFER (não DEBIT/CREDIT)
   // Categoria: null (transferência não tem categoria)
   ```

3. **Validações obrigatórias:**
   - `fromAccount.companyId === toAccount.companyId` (só dentro da MESMA empresa)
   - `fromAccountId !== toAccountId` (não pode transferir pra si mesma)
   - `amount > 0`
   - Se `fromAccount.allowNegativeBalance === false` e saldo - amount < 0 → bloqueia ou avisa

4. **Excluir transferência:** SEMPRE remove o par completo. Nunca só uma ponta.

5. **Filtros nos relatórios:**
   - **DRE:** `where type !== 'TRANSFER'` (não entra em receita nem despesa)
   - **Fluxo de Caixa Consolidado:** `where type !== 'TRANSFER'`
   - **Fluxo de Caixa POR CONTA:** mostra normalmente (entrada/saída)
   - **Tela transferências dedicada:** mostra todas, agrupadas por `transferGroupId`

6. **Detecção automática no OFX:**
   - Quando importa, se acha 2 transações no mesmo dia, mesmo valor (sinais opostos), em contas diferentes da mesma empresa → sugere parear como transferência
   - User confirma com 1 clique → vira par TRANSFER com mesmo `transferGroupId`

### 💰 Saldo negativo em conta bancária

**Caso de uso:** academia tem cheque especial. Conta pode ficar negativa em R$ 5k. Sistema precisa permitir e visualizar bem.

**Solução:**

1. **Schema:** adicionar 3 campos em `bank_accounts`:
   ```prisma
   allowNegativeBalance Boolean @default(true)  // permite saldo < 0
   creditLimit          Float   @default(0)     // limite cheque especial
   lowBalanceThreshold  Float?                  // alerta IA quando saldo < threshold
   ```

2. **Visual diferenciado:**
   - **Positivo** (saldo > threshold): azul/verde, normal
   - **Atenção** (0 < saldo ≤ threshold): badge amarelo "ATENÇÃO"
   - **Negativo** (saldo < 0): badge vermelho "SALDO NEGATIVO" + dias no vermelho

3. **DRE — categoria especial:**
   - Juros de cheque especial entram automaticamente em "Despesas Financeiras" (dreGroup `DESPESAS_FINANCEIRAS`)
   - Detecção heurística no OFX: descrição contém "JUROS CHEQUE ESP" / "JR CHQ ESP" → categoria automática

4. **Alertas IA proativos:**
   - "Caixa Econômica está negativa há 4 dias. Juros estimados: R$ 38."
   - "Sicoob terá saldo insuficiente pra folha do dia 5. Sugiro transferir R$ 8k de Banrisul."
   - Sugestões de transferência inteligente entre contas da mesma empresa

5. **Histórico de saldo negativo:**
   - Tabela nova `account_balance_alerts` (opcional, só se quiser auditar)
   - OU calculado on-the-fly via query: `SELECT date FROM transactions ORDER BY date — calcula saldo cumulativo, marca dias negativos`

### 🚨 Migrations a fazer (em ordem)

```sql
-- 1. Adicionar transferGroupId
ALTER TABLE transactions ADD COLUMN transferGroupId TEXT;
CREATE INDEX idx_transactions_transfer_group ON transactions(transferGroupId);

-- 2. Adicionar campos de saldo negativo
ALTER TABLE bank_accounts ADD COLUMN allowNegativeBalance INTEGER DEFAULT 1; -- SQLite bool
ALTER TABLE bank_accounts ADD COLUMN creditLimit REAL DEFAULT 0;
ALTER TABLE bank_accounts ADD COLUMN lowBalanceThreshold REAL;
```

(Lembrar do dual SQLite/Postgres — usar `db push` em dev e ajustar `sed` no deploy se necessário)

---

## C.5 — Sprint Plan (próximas 3 semanas)

### ⚡ SPRINT 0.5 — Transferências + Saldo negativo (3-4 dias) — DEVE VIR PRIMEIRO

**Por quê primeiro:** o Dashboard precisa mostrar saldos corretos por conta E consolidado, e o DRE não pode inflar com transferências fake. Essa fundação é pré-requisito do Sprint 1.

- [ ] **Dia 1:** Migrations + Schema
  - Adicionar `transferGroupId` em `transactions`
  - Adicionar `allowNegativeBalance`, `creditLimit`, `lowBalanceThreshold` em `bank_accounts`
  - Atualizar Prisma client
  - Testes unitários do schema

- [ ] **Dia 2:** Backend transferências
  - `POST /api/transferencias` (atomic, prisma.$transaction)
  - `DELETE /api/transferencias/[groupId]` (remove par)
  - `GET /api/transferencias` (lista paginada)
  - Validações Zod completas
  - Testes de integração (criar, listar, excluir)

- [ ] **Dia 3:** Atualizar engines existentes
  - `lib/dre/calculate.ts`: adicionar `where type !== 'TRANSFER'`
  - `lib/cashflow/consolidated.ts` (criar se não existe): mesma regra
  - `lib/cashflow/by-account.ts`: NÃO filtrar (mostra entrada/saída)
  - Testes garantindo que DRE não conta transferências

- [ ] **Dia 4:** UI
  - Modal "Nova Transferência" com 2 dropdowns + valor + data
  - Página `/transferencias` com filtros
  - Atualizar card de conta bancária: badge negativo/atenção
  - Detecção heurística no preview OFX (sugerir parear)

🎯 **Marco Sprint 0.5:** transferências entre contas funcionam sem inflar DRE/Fluxo + saldo negativo visível com alertas

### 🏃 SPRINT 1 — Fundação visual (Semana 1)
**Meta:** dashboard básico já bonito no ar

- [ ] **Dia 1-2:** Setup
  - Adicionar Recharts + Framer Motion
  - Criar `_components/dashboard/` e `lib/dashboard/`
  - Implementar `KPICard`, `Sparkline`, `PeriodFilter` (componentes base)

- [ ] **Dia 3-4:** Hero Strip
  - `HeroKPIs.tsx` com 4 cards
  - Query `getHeroKPIs` reutilizando engine DRE
  - Sparklines funcionando com dados reais

- [ ] **Dia 5:** Health Check
  - `HealthCheck.tsx` reaproveitando lib/kpis/saude-financeira

- [ ] **Dia 6-7:** Mini-DRE + Top Categories
  - `MiniDRE.tsx` + `TopCategories.tsx`
  - Donut chart com Recharts

🎯 **Marco Sprint 1:** dashboard básico (sem IA ainda) já visualmente premium

### 🚀 SPRINT 2 — Diferenciais (Semana 2)
**Meta:** o que faz o Conta IA superior

- [ ] **Dia 1-2:** Cashflow Waterfall
  - `CashflowWaterfall.tsx` com Recharts custom
  - Cores semânticas (verde entrada, vermelho saída)
  - Drill-down ao clicar numa barra

- [ ] **Dia 3-5:** AI Insights ⭐ (DIFERENCIAL CHAVE)
  - Endpoint `/api/dashboard/insights` (Claude Haiku + RAG das transações)
  - Cache 1h em Redis ou unstable_cache
  - 4 tipos de insight: alerta, oportunidade, sugestão, parabéns
  - `AIInsights.tsx` com cards ranqueados por prioridade

- [ ] **Dia 6:** Recent Activity + Pending CTA
  - `RecentActivity.tsx` (timeline)
  - `PendingClassification.tsx` (CTA)

- [ ] **Dia 7:** Company Selector multi-modo
  - 3 modos: única / consolidado / comparativo

🎯 **Marco Sprint 2:** dashboard com IA proativa rodando — gap real vs Conta Azul fechado

### 🎨 SPRINT 3 — Polimento + relatórios faltantes (Semana 3)
**Meta:** sistema completo de relatórios financeiros

- [ ] **Dia 1-2:** Animações + microinteractions
  - Framer Motion: cards entram com stagger
  - Hover states refinados
  - Loading skeletons

- [ ] **Dia 3-4:** Página `/fluxo-de-caixa` completa
  - Realizado x Projetado (linha)
  - Mensal x Diário toggle
  - Filtros por categoria/centro custo

- [ ] **Dia 5-6:** Página `/conciliacao-bancaria`
  - Split view (extrato vs lançamentos)
  - Match automático de candidatos
  - Conciliação manual drag-and-drop

- [ ] **Dia 7:** Export PDF + Excel
  - `lib/exports/dre-pdf.ts` (com logo da empresa)
  - `lib/exports/dre-xlsx.ts` (xlsx skill do projeto)

🎯 **Marco Sprint 3:** Conta IA tem dashboard + DRE + Fluxo de Caixa + Conciliação + Exports = **paridade técnica com Conta Azul Pro** mas com IA superior

## C.6 — Critérios de aceite (definição de "pronto")

Pra cada sprint, considera-se concluído quando:
- [ ] 100% dos componentes têm testes Vitest
- [ ] Funciona em mobile (responsive validado)
- [ ] Dark mode validado
- [ ] Loading states implementados
- [ ] Empty states implementados (empresa sem dados)
- [ ] Error boundaries implementados
- [ ] Performance: LCP < 2.5s, INP < 200ms
- [ ] Acessibilidade: navegação por teclado, ARIA labels
- [ ] Copy em pt-BR consistente com `lib/i18n/pt-BR.ts`

## C.7 — O que NÃO está no escopo (importante!)

Pra não perder foco:
- ❌ Reescrever DRE (já tá ótimo)
- ❌ Reescrever Plano de Contas (5.1 completo)
- ❌ Mexer em RBAC/Audit (5.3 completo)
- ❌ Pluggy produção (FASE 10)
- ❌ Emissão NF-e (FASE 8)
- ❌ App mobile (FASE 11)

## C.8 — Ordem sugerida de execução

**Hoje, segunda 11/05:** Yussef revisa esse documento, valida ou ajusta
**Terça 12/05:** Começar Sprint 1 com Claude Code
**Próximas 3 semanas:** executar sprints
**Fim do mês:** Conta IA com dashboard mundial + IA Insights + relatórios completos = **PRONTO PRA BETA com 5-10 amigos**

---

## 🎯 Conclusão

**O Conta IA está a 3 semanas de virar superior à Conta Azul** nos seguintes eixos:
- ✅ Multi-empresa nativo (já temos)
- ✅ DRE com drill-down + Centro de Custo (já temos)
- ✅ RBAC + Audit Log (já temos)
- ⏳ Dashboard mundial (Sprint 1-2)
- ⏳ AI Insights proativos (Sprint 2)
- ⏳ Fluxo de Caixa + Conciliação (Sprint 3)

E ainda fica **MUITO** melhor com a FASE 3+4 (IA Contadora) implementada depois disso.

**Posicionamento de mercado:**
> "Conta IA: a gestão financeira que a Conta Azul deveria ter sido. Com IA de verdade. Multi-empresa nativo. Preço justo."

**Vamos pra cima!** 🚀
