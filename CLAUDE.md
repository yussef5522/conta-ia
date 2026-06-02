# Conta IA — Documento OPERACIONAL do Projeto

> **HIERARQUIA DE DOCUMENTOS:**
>
> 📍 **`CLAUDE.md`** (este arquivo) — Estado **OPERACIONAL** atual
>    - Onde estamos hoje, próxima ação concreta, log de sessões
>    - Atualizado a cada sessão de código
>    - **LER PRIMEIRO** ao iniciar qualquer sessão
>
> 🎯 **`docs/CONTA-IA-NORTE.md`** — Visão **ESTRATÉGICA** (norte de longo prazo)
>    - Posicionamento, arquitetura fundacional, roadmap 12 meses, decisões grandes
>    - Atualizado raramente (apenas quando há decisão estratégica)
>    - **LER quando:** precisar entender "PORQUÊ" das decisões ou guiar etapa nova
>
> 🎨 **`docs/DASHBOARD-PLAN.md`** — Plano Mestre Dashboard Mundial + Sprint Plan (10/05/2026)
>    - Pesquisa profunda Conta Azul (forças/fraquezas), mockup do dashboard mundial, plano técnico em 3 sprints
>    - Inclui requisitos críticos: Transferências entre contas + Saldo negativo (Sprint 0.5)
>    - **LER quando:** for executar Sprint 0.5 ou Sprints 1-3 do Dashboard
>
> 📚 **`docs/DEPLOY.md`** — Guia técnico de deploy
>    - **LER quando:** for fazer deploy em produção
>
> 💳 **`docs/sprints/PAGAMENTO-RETOMAR-AQUI.md`** — Estado da frente de pagamento Asaas
>    - 3A + 3B + 3C deployados em sandbox; falta ativar webhook + smoke + virar pra prod (3D)
>    - **LER quando:** for retomar a frente de cobrança/SaaS
>
> **Em caso de conflito aparente entre documentos:**
> - CLAUDE.md tem prioridade pra decisões **OPERACIONAIS** (próxima etapa, comandos)
> - CONTA-IA-NORTE.md tem prioridade pra decisões **ESTRATÉGICAS** (visão, arquitetura)
> - DASHBOARD-PLAN.md tem prioridade pra **EXECUÇÃO** dos sprints de dashboard (0.5 → 3)
>
> **Última atualização:** 02/06/2026

---

## 📌 Visão geral do produto

**Nome:** Conta IA  
**Tagline:** "Seu contador inteligente que nunca dorme"  
**Domínio:** contaia.com.br  
**Público-alvo:** PMEs brasileiras de qualquer setor (academias, lojas, restaurantes, clínicas, salões, prestadores)  
**Modelo de cobrança:** SaaS recorrente — Starter R$149 / Business R$399 / Enterprise R$999  
**Beta nos próximos 60 dias:** Yussef (13 academias) + amigos beta testers via OFX manual

### Diferenciais competitivos
1. IA agentica que **aprende e raciocina** sobre contabilidade BR (não só categoriza)
2. Pronto para **Reforma Tributária 2026** (IBS/CBS/Split Payment) desde o dia 1
3. Open Finance nativo via Pluggy (FASE 10 — quando tiver receita)
4. Multi-empresa com consolidação automática
5. Preço acessível
6. Interface 100% em português, design moderno

---

## 🛠️ Stack técnica REAL (rodando)

| Camada | Tecnologia | Versão |
|---|---|---|
| Framework | Next.js | 16.2.4 (NÃO 14 — atualizado) |
| Linguagem | TypeScript | 5.x strict mode |
| Frontend | React + TailwindCSS + shadcn/ui | React 18.3.1, Tailwind 3.4 |
| Backend | Next.js API Routes | (NÃO Express — fullstack Next.js) |
| ORM | Prisma | 5.22 |
| DB Dev | SQLite | `file:./dev.db` |
| DB Prod | PostgreSQL 16 | DigitalOcean droplet |
| Auth | JWT (jose) + bcrypt + cookies httpOnly | jose 5.9, bcrypt 2.4 |
| Validação | Zod | 3.23 |
| Testes | Vitest | 2.1 |
| Lint | ESLint | next/core-web-vitals |
| Importação bancária | OFX/QFX (SGML e XML) | atual |
| Open Finance | Pluggy.ai | implementado FASE 2, ATIVO via Meu Pluggy (Yussef dev) |
| IA | Anthropic Claude API + BrasilAPI | FASE 3+4 |

### Hosting
- **Dev:** localhost Windows do Yussef → `http://localhost:3000` ✅ FUNCIONANDO
- **Prod:** DigitalOcean droplet `167.172.159.101:3001` (PM2 + nginx)
- **Estratégia dual SQLite/Postgres:** schema usa SQLite em dev; deploy roda 2 `sed` que trocam pra postgresql antes de `prisma migrate deploy`. Detalhes em `docs/DEPLOY.md`.

### Estrutura de pastas (real)
```
conta-ia/
├── .claude/
├── .next/
├── __tests__/             # Testes Vitest
├── app/                   # Next.js App Router
│   ├── (auth)/            # /login, /cadastro
│   ├── (dashboard)/       # /dashboard, /empresas, etc
│   └── api/               # API Routes
├── components/
│   ├── ui/                # shadcn/ui
│   ├── layout/            # Sidebar, Header
│   └── empresas/
├── docs/
│   └── DEPLOY.md
├── lib/
│   ├── auth.ts
│   ├── db.ts
│   ├── utils.ts
│   ├── i18n/pt-BR.ts
│   └── validations/
├── node_modules/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── .env / .env.example / .gitignore
├── next.config.mjs / tsconfig.json / tailwind.config.ts
├── package.json
├── proxy.ts               # middleware proteção rotas
├── vitest.config.ts
└── CLAUDE.md              # ← ESTE ARQUIVO
```

---

## 📊 Estado atual do projeto

### ✅ FASE 1 — Fundação (CONCLUÍDA)
- [x] Setup Next.js + Prisma + SQLite
- [x] Schema multi-tenant (users, companies, user_companies)
- [x] Auth completo: signup, login, JWT (jose), bcrypt rounds=12, cookies httpOnly
- [x] CRUD de usuários
- [x] CRUD de empresas com `company_type` (service, retail, restaurant, industry, mixed, other)
- [x] Middleware `proxy.ts` protege rotas privadas
- [x] Seed: admin@contaia.com.br / ContaIA@2025

### ✅ FASE 2 — Bancos e OFX (CONCLUÍDA)
- [x] CRUD de contas bancárias (`bank_accounts`)
- [x] Modelo de transações (`transactions`)
- [x] Categorias customizáveis por empresa (`categories`)
- [x] Importação OFX/QFX (parser SGML e XML)
- [x] Pluggy implementado (mas desabilitado — vamos reativar só na FASE 10)

### ✅ FASE 2.1 — Correções de UX (CONCLUÍDA)
- [x] Botão "Nova Conta" no header de `/contas-bancarias` (dropdown inteligente por nº de empresas)
- [x] Botão "Nova Conta" no estado vazio (CTA "Ir para Empresas")
- [x] Botão "Nova Transação" na página global de transações (mesmo padrão de dropdown)
- [x] `try/catch` no GET de `/api/contas-bancarias`
- [x] `try/catch` no GET de `/api/transacoes`

Commits relacionados: `00817ea`, `0f7d45f`, `34ea23c`, `9d59af1`, `3256259`.

---

## 💡 Estratégia decidida (29/04/2026)

### Princípio: **gastar zero antes de ter clientes pagando**

| Fase | Open Finance | Custo | Quem usa |
|---|---|---|---|
| **Dev e treino IA** | Meu Pluggy (Yussef) | R$ 0 | Só Yussef pra treinar IA |
| **Lançamento beta** | OFX manual | R$ 0 | Yussef + amigos beta testers |
| **Pós-validação (10+ clientes pagantes)** | Pluggy produção | R$500-1500/mês | Todos os clientes |

### Por que faz sentido
- Diferencial real do Conta IA é a **IA Contadora**, não Open Finance (Conta Azul, Omie, Nibo todos têm)
- Validar IA primeiro com OFX é mais barato e rápido
- Mira PMEs que **odeiam complicação** dos concorrentes (academia, salão, padaria, mecânica)
- Quando provar valor (R$2-5k/mês de receita), Pluggy paga por si

### Status do Meu Pluggy (Yussef pessoal)
- ✅ Conta criada em `meu.pluggy.ai` com `yussefmusa5522@gmail.com`
- ✅ **Banrisul conectado** (1 ativa)
- ⏳ Sicoob: a conectar
- ⏳ Outros bancos: conforme necessário

---

## 🎯 Norte do Produto — CONTA-IA-NORTE.md

Toda decisão estratégica do produto (priorização de features, escopo de fases, posicionamento de mercado, definição de templates por subsetor, integração com IA) deve ser tomada à luz do documento `docs/CONTA-IA-NORTE.md` na raiz de `docs/`.

Esse documento consolida 30+ buscas web profundas, fontes oficiais BR, benchmark de 15 sistemas e 5 sessões iterativas de pesquisa (V1 → V2-A → V2-B → V2-C → V3). Substitui o `PRODUTO-NORTE.md` (arquivado em `docs/_arquivado/`) e é o NORTE permanente do produto pelos próximos 12 meses.

Antes de propor qualquer mudança de roadmap, nova fase ou ajuste de prioridades, releia as seções relevantes do CONTA-IA-NORTE.md.

Especialização: produto inicia foco em SERVICE/Academia (Yussef = expert), depois replica pra Clínica, Salão, Restaurante (cacula mix), Loja.

---

## 🏦 Bancos do Yussef (validados)

Todos os 7 bancos exportam OFX nativamente. Pluggy também suporta todos:

| Banco | OFX | Pluggy | Tipo | Observação |
|---|---|---|---|---|
| Banrisul | ✅ | ✅ ATIVO | PF + PJ | Conectado no Meu Pluggy 29/04 |
| Bradesco | ✅ | ✅ | PF + PJ | Internet Banking → OFX |
| Itaú | ✅ | ✅ | PF + PJ | Bankline → OFX |
| Santander | ✅ | ✅ | PF + PJ | Net Empresas → OFX |
| Sicredi | ✅ | ✅ | PJ | Bankline → OFX |
| Sicoob | ✅ | ✅ | PF + PJ | Sisbr → OFX |
| Caixa | ✅ | ⚠️ 30 min auth | PF + PJ | Internet Banking PJ |
| Nubank PJ | ✅ | ⚠️ Limitado | PJ | App → Exportar extrato |

**Decisão:** sistema deve suportar contas PF (CPF) + PJ (CNPJ) nativamente. Quando dinheiro sai do PJ pro PF do dono, classificar automaticamente como "Distribuição de Lucros / Pró-labore".

---

## 🗄️ Modelo de dados (multi-tenant)

```
users                # donos das empresas (Yussef = primeiro user)
companies            # cada CNPJ = empresa separada
user_companies       # N:N (user pode ter várias empresas)
bank_accounts        # cada conta pertence a uma empresa
transactions         # movimentações vinculadas à conta
categories           # plano de contas customizável por empresa
suppliers            # fornecedores identificados por CNPJ (FASE 3+4)
ai_learning_rules    # regras aprendidas pela IA (FASE 3+4)
invoices             # NF-e, NFC-e, NFS-e (FASE 6)
```

### Tipos de empresa (enum `company_type`)
- `service` — academias, clínicas, salões (foco ISS, mensalidades)
- `retail` — lojas, comércios (foco ICMS, NFC-e)
- `restaurant` — bares, restaurantes (SAT, alto giro)
- `industry` — indústrias (IPI, insumos)
- `mixed` — empresas híbridas
- `other`

Cadastro de empresa permite escolher tipo, sistema ajusta automaticamente plano de contas sugerido, categorias típicas, relatórios e alertas.

---

## 📋 Regras de negócio críticas

### Identificação automática de pagamentos (FASE 3+4)
1. Sistema recebe transação (Pluggy ou OFX importado)
2. Identifica tipo (PIX, TED, boleto, débito automático)
3. Se tem CNPJ na descrição → consulta `suppliers` local OU BrasilAPI
4. Se identifica → categoriza automaticamente
5. Se NÃO identifica → cria entrada "pendente" e notifica usuário
6. User responde uma vez → cria regra em `ai_learning_rules` → aplica em todas as próximas similares
7. **Nunca pergunta 2x o mesmo padrão**

### Reforma Tributária 2026
A partir de **01/01/2026** todas NF-e DEVEM destacar:
- IBS (0,1%)
- CBS (0,9%)

Sistema precisa:
- Suportar novos campos no XML NF-e
- Calcular créditos CBS/IBS
- Relatórios de apuração
- Alertar sobre Split Payment

### Multi-empresa
- User pode ter empresas ilimitadas (limitado pelo plano SaaS)
- Cada empresa = dados isolados
- Dashboard consolidado mostra visão geral
- Comparativo entre empresas do mesmo tipo
- IA aprende padrões POR EMPRESA (não mistura entre empresas)

### Regra especial PJ → PF (FASE 3+4)
- Detectar transferências entre contas do mesmo dono (CNPJ → CPF)
- Classificar como "Distribuição de Lucros" ou "Pró-labore"
- Não é despesa operacional → afeta DRE corretamente

---

## 🚀 Roadmap completo

### ✅ FASE 2.1 — Correções rápidas (CONCLUÍDA)
3 botões + try/catch nas rotas. Destravou navegação.

### ⚡ SPRINT 0.5 — Transferências entre contas + Saldo negativo (3-4 dias) — PRÉ-REQUISITO

> 📄 **Plano completo em `docs/DASHBOARD-PLAN.md` (seção C.4.1 e C.5).**
>
> **Por quê primeiro:** Yussef tem 13 academias, cada uma com 3-4 contas bancárias. Transferências internas (entre contas da MESMA empresa) hoje seriam contadas como receita + despesa pelo DRE — inflando resultado e gerando imposto sobre dinheiro que não foi ganho. Saldo negativo (cheque especial) também não tem suporte visual. Sem essas fundações, o **Dashboard Mundial** (Sprint 1-3) mostraria números errados. Por isso vem ANTES da FASE 3+4.

**Escopo (4 dias):**

- [x] **Dia 1 — Migrations + Schema** (concluído 11/05/2026, commit `183ae53`)
  - `transactions.transferGroupId String?` (par de transferência usa o mesmo ID)
  - `bank_accounts.allowNegativeBalance Boolean @default(true)`
  - `bank_accounts.creditLimit Float @default(0)` (limite do cheque especial)
  - `bank_accounts.lowBalanceThreshold Float?` (alerta IA)
  - Índice em `transferGroupId`
  - Migration SQL escrita à mão pra Postgres (`prisma/migrations/20260511000000_sprint_0_5_*`)
  - 10 testes novos (4 schema-transfer + 6 schema-bank-account) — 719/719 passando

- [x] **Dia 2 — Backend Transferências** (concluído 11/05/2026, commit `885bbc6`)
  - `POST /api/transferencias` (atomic via `prisma.$transaction`, cria par com `type=TRANSFER` e mesmo `transferGroupId`)
  - `DELETE /api/transferencias/[groupId]` (sempre remove o par completo, detecta direção via `createdAt ASC`)
  - `GET /api/transferencias` (listagem paginada agrupada por `transferGroupId`)
  - Validações Zod: mesma empresa, contas diferentes, valor > 0
  - Detecção heurística OFX em 2 níveis (HIGH ≥0.90 PIX, MEDIUM 0.70-0.89 TED) + boost por keywords
  - DRE ignora `type=TRANSFER` (SQL filter + loop guard)
  - 50 testes novos (4 arquivos) — 769/769 passando
  - ⚠️ Saldo negativo (`allowNegativeBalance` check) movido pro Dia 3 com `lib/balance/`

- [x] **Dia 3 — Engines + Validação Saldo** (concluído 11/05/2026, commit `b82a4eb`)
  - `lib/balance/`: `prepare` (sinal por transação), `calculate` (saldo, dias negativo, lowest), `check` (validação com `BalanceCheckError` HTTP 422)
  - `lib/cashflow/consolidated.ts`: escopo `companyId`, IGNORA `TRANSFER`, agrupa day/week/month
  - `lib/cashflow/by-account.ts`: escopo `bankAccountId`, INCLUI `TRANSFER` (via signedAmount)
  - `lib/cashflow/query.ts`: query builders centralizados (único ponto de filtro multi-tenant)
  - Lógica de validação: `allowNegativeBalance=true` respeita `creditLimit` REAL por conta (Banrisul 600k, Sicredi 80k); `false` bloqueia qualquer negativo
  - Integração: `createTransfer` + `POST /api/transacoes` validam saldo antes de criar
  - `scripts/backfill-credit-limits.ts` — safety net pra Cacula Mix (rodar em prod antes do deploy)
  - 71 testes novos (6 arquivos), incluindo 10 dedicados a isolamento multi-tenant — 840/840 passando
  - ⚠️ DRE filtro de TRANSFER já estava feito no Dia 2 (SQL filter + loop guard)

- [x] **Dia 4 — UI completa + Replace OFX** (concluído 11/05/2026, commit `d53ef79`)
  - Modal "Nova Transferência" reutilizável (trata HTTP 422 inline sem fechar)
  - Página `/empresas/[id]/transferencias` (filtros período + conta nos 2 lados, paginação, delete confirmado)
  - Badge dinâmico de saldo nas contas: verde/amarelo/vermelho + % do cheque especial usado (porcentagem com cor própria)
  - Section "Cheque Especial" no form de conta (toggle + creditLimit + lowBalanceThreshold com tooltips)
  - Detecção heurística OFX no preview com cards HIGH/MEDIUM + ações individual/batch
  - **Replace OFX (refinamento crítico):** endpoint `POST /api/transferencias/from-ofx` com estratégia "dedupHash reservation" — TRANSFER reserva slot UNIQUE, import OFX skipa duplicata naturalmente, ZERO mudança no endpoint de import
  - ConfirmDialog quando tx existente tem categoria/notas + audit log preserva tudo no metadata pra rastreabilidade
  - 19 testes novos (15 balance-badge-status + 7 conta-validation + 19 transfers-from-ofx — sendo 12 solicitados + 7 robustez extra)

🎯 **Marco Sprint 0.5:** ✅ **ATINGIDO** — Transferências internas funcionam sem inflar DRE/Fluxo Consolidado. Saldo negativo permitido e visível com cheque especial real por conta. Base sólida pro Dashboard Mundial (Sprints 1-3 do DASHBOARD-PLAN.md).

---

## 🏆 SPRINT 0.5 — FINALIZADO (11/05/2026)

**4 dias planejados → entregues em 1 sessão única.** 4 commits feat + 4 commits docs = **8 commits totais**.

| Dia | Hash | Foco |
|---|---|---|
| Dia 1 | `183ae53` | Schema: `transferGroupId` + 3 campos cheque especial |
| Dia 2 | `885bbc6` | Backend transferências (POST/GET/DELETE) + detecção heurística OFX |
| Dia 3 | `b82a4eb` | Engines `lib/balance/` + `lib/cashflow/` + validação saldo + safety net |
| Dia 4 | `d53ef79` | UI completa + Replace OFX (dedupHash reservation) |

**Suite de testes:** 709 → **881 (+172 testes, +24%)** sem regressões. **TypeScript strict:** 0 erros.

---

## 🏆 SPRINT 1 — DASHBOARD MUNDIAL — FINALIZADO (11/05/2026)

**Plano completo:** `docs/DASHBOARD-PLAN.md` seção C.5 (Sprint 1, Semana 1) + closing histórico ao final do arquivo.
**Stack adicional:** Recharts 3.8.1 + Framer Motion 12.38.0.

| Dia | Status | Hash | Foco |
|---|---|---|---|
| **Dia 1** | ✅ Concluído | `7176ffe` | Hero Strip — 4 KPI cards + sparklines + cache 60s + empty states |
| **Dia 2** | ✅ Concluído | `8e61263` | Mini-DRE compacta + Top 5 Despesas (donut Recharts) |
| Dia 3 | ⏭️ Consolidado | — | (escopos absorvidos no Dia 2) |
| **Dia 4** | ✅ Concluído | `4fd7f43` | Saúde Financeira — Burn, Runway (com cheque especial), Variação 30d, Margem |
| **Dia 5** | ✅ Concluído | `f3e08df` | Recent Activity timeline + Pendentes CTA + closing docs |

**Suite de testes (Sprint 1):** 881 → **961 (+80 testes).** TypeScript strict: 0 erros.

### 📍 FASE 3+4 — Importar e classificar perfeito (4-6 semanas) — DIFERENCIAL DO PRODUTO

**Objetivo:** Yussef importa um OFX e a IA classifica automaticamente com ≥80% de acerto, aprendendo a cada confirmação manual.

**Princípio de execução:** entrar no fluxo "OFX + IA" o quanto antes para Yussef testar com dados reais já a partir de 1 arquivo. Multi-arquivo e histórico de uploads ficam pro fim — não bloqueiam validação da IA.

**Notação:** sub-etapas mantêm os prefixos `3.x` (UX OFX) e `4.x` (IA) por origem, mas a ordem de execução abaixo intercala os dois.

#### 🧪 BLOCO A — UX OFX rápido (1-2 dias)
Pequenas vitórias visuais antes de mexer com IA. Sem migration.

- [x] **3.1 — Detecção automática do banco no preview** (concluída 30/04/2026)
  - parser já extraía `BANKID`; passou a usar
  - lista canônica em `lib/bancos.ts` (15 bancos brasileiros — fonte única, ver entrada do log)
  - `lib/ofx/bancos.ts` com helpers `detectarBanco` e `bateComPerfilDaConta`
  - API preview retorna `banco: { codigo, nome, batePerfilConta }`
  - UI mostra "Banco detectado: **Banrisul** (041)" e oferece auto-preencher se conta sem `bankName`
  - **Validado com dados reais:** 270 transações do Banrisul importadas, saldo R$ 5.821,08 correto, detecção verde.

- [x] **3.2 — "Atualizado há X dias" na lista de contas** (Onda 2 Sprint 2.4)
  - calcular `lastImportAt = max(transactions.createdAt where origin in (OFX, PLUGGY))`
  - badge na `/contas-bancarias` com cor: verde (<7d), amarelo (8-14d), vermelho (>14d ou nunca)
  - **Teste:** importar OFX → badge "hoje" verde.

#### 🧠 BLOCO B — Classificação com 1 arquivo (2-3 semanas) — TESTES COM DADOS REAIS COMEÇAM AQUI
Foco em fazer Yussef classificar manualmente já criando regras, depois automatizar.

- [x] **4.1 — Schema novo (suppliers + ai_learning_rules + ai_claude_cache + ai_usage_log)** (FASE 3 Etapa 1)
  - migration: `suppliers` (id, companyId, cnpj, razaoSocial, categoriaId?, fonte=BRASILAPI/MANUAL/CLAUDE, createdAt)
  - migration: `ai_learning_rules` (id, companyId, padrao, tipoMatch=EXACT/CONTAINS/CNPJ, categoriaId, supplierId?, confianca, vezesAplicada, createdAt, updatedAt)
  - sem mudança de UI ainda; só base
  - rodar migration em dev (não em prod ainda)

- [x] **4.5 — Tela "Pendentes de Classificação" com sugestões Claude lazy** (FASE 3 Etapa 3)
  - rota nova `/empresas/[id]/pendentes` (ou filtro `?status=PENDING` na página global de transações)
  - lista transações com `status = PENDING` (todas as importadas via OFX entram assim)
  - cada linha tem dropdown de categoria + botão "Confirmar"
  - sem IA ainda — só interface humana eficiente
  - **Teste:** importar 1 OFX e classificar 30-50 manualmente; medir tempo.

- [x] **4.6 — Loop: confirmar manualmente cria/atualiza regra** (FASE 3 Etapa 1 — `classificar-com-aprendizado`)
  - ao confirmar categoria, salva `ai_learning_rule` com padrão = primeiras N palavras significativas do `description` (stop-words removidas)
  - se regra similar já existe (mesmo `padrao` + `tipoMatch`), incrementa `vezesAplicada`
  - se descrição contém CNPJ válido, salva `supplier` também
  - 🎯 **MARCO 1:** Yussef já consegue treinar manualmente uma base de regras a partir de 1 OFX importado.

- [x] **4.2 — Pipeline etapa 1: aplicar regras automaticamente no import** (FASE 3 Etapa 1 — `autoClassifyTransactions`)
  - hook: ao inserir transações novas via OFX, antes do `createMany`, rodar match contra `ai_learning_rules` da empresa
  - ordem de match: EXACT → CNPJ → CONTAINS
  - se bate, `categoryId` preenchido + `status = RECONCILED` (ou novo `AUTOMATICO`)
  - 🎯 **MARCO 2:** próximo OFX já vem 30-50% pré-classificado.

- [x] **4.3 — Pipeline etapa 2: enriquecer por CNPJ via BrasilAPI** (FASE 3 Etapa 2)
  - extractor de CNPJ na descrição (regex `\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}`)
  - cache local em `suppliers` por CNPJ
  - se não tem cache, consulta BrasilAPI (`/cnpj/v1/{cnpj}`), salva `razaoSocial` + sugestão de `categoria` baseada em CNAE primário
  - rate-limit cliente: 3 req/s
  - 🎯 **MARCO 3:** transações com CNPJ vêm com fornecedor identificado mesmo sem regra prévia.

- [x] **4.4 — Pipeline etapa 3: Claude Haiku com few-shot** (FASE 3 Etapa 3 — fetch direto sem SDK, modelo `claude-haiku-4-5-20251001`)
  - rota interna `/api/classificar` recebe `{ description, amount, type }` retorna `{ categoriaSugerida, confianca, justificativa }`
  - prompt few-shot com 10-15 exemplos do setor da empresa
  - prompt caching da Anthropic na parte fixa do prompt
  - chama só pra transações que escaparam de 4.2 e 4.3
  - 🎯 **MARCO 4:** pipeline completo 3 etapas funcionando. Critério de saída: ≥80% automático.

#### 🪟 BLOCO C — Visibilidade e dashboard (1-2 semanas)
Painéis para Yussef visualizar o que foi aprendido.

- [x] **4.7 — Tela "Regras Aprendidas" (CRUD)** (Onda 2 Sprint 2.1)
  - rota `/empresas/[id]/regras`
  - tabela: padrão / tipo / categoria / vezes aplicada / confiança / ações (editar, desativar, excluir)
  - filtro por categoria

- [x] **4.8 — Tela "Fornecedores"** (Onda 2 Sprint 2.2)
  - rota `/empresas/[id]/fornecedores`
  - tabela: CNPJ / razão social / categoria padrão / total movimentado / última transação
  - cada linha linka para transações filtradas

- [ ] **4.9 — Dashboard com cards e gráficos** (~6-8h)
  - cards: saldo consolidado, receitas mês, despesas mês, resultado
  - gráfico linha: fluxo de caixa últimos 12 meses
  - gráfico donut: composição de despesas por categoria no mês
  - alertas: "X transações pendentes de classificação"
  - usar Recharts (já em shadcn/ui)
  - 🎯 **MARCO 5:** Yussef abre dashboard e bate olho em 1 academia inteira em 30 segundos.

#### 📦 BLOCO D — Escalar import (1 semana)
Depois que IA está validada, melhora ergonomia para volumes maiores.

- [x] **3.3 — Múltiplos arquivos OFX por vez** (Onda 2 Sprint 2.4 — `<MultiOfxDropZone>` sequencial)
  - input `multiple`, estado `arquivos: File[]`
  - preview paralelo + confirmação em série
  - tratamento de falha parcial (sem rollback — quem importou ficou)
  - mensagem final: "5 arquivos · 142 transações importadas · 23 duplicadas · 1 com erro"

- [x] **3.4 — Histórico de uploads + revert** (Onda 2 Sprint 2.3 — `ofx_imports` + `/empresas/[id]/imports`)
  - migration: `OfxImport` (id, bankAccountId, importedByUserId, fileName, fileSize, totalLidas, inseridas, duplicadas, errosCount, errosJSON, createdAt)
  - rota `GET /api/contas-bancarias/[id]/importacoes`
  - página `/empresas/[id]/contas/[contaId]/importacoes`
  - link "Histórico" no header da página de transações da conta

#### Setup técnico paralelo (Yussef faz manual, fora do código)
- ✅ Conta `meu.pluggy.ai` criada
- ✅ Banrisul conectado
- [ ] Conectar Sicoob, Itaú, etc (conforme dado real for sendo necessário pra treinar IA)

#### Stretch (depois de tudo)
- [ ] CSV com wizard de mapeamento
- [ ] PDF com Claude (extrair extrato de PDF, fase 2)

### 📍 FASE 5 — Beta com amigos (2-3 semanas)
- Convidar 5-10 amigos donos de PMEs (diversificar setores)
- Onboarding: explicar que upload OFX é manual
- Coletar feedback semanal
- **Critério saída:** 5+ usuários ativos satisfeitos, IA classificando 80%+ automático

### 📍 FASE 6 — Relatórios profissionais (1-2 semanas)
- DRE Gerencial completa (estrutura BR padrão)
- Export PDF (com logo) + Excel
- DFC realizado e projetado
- Conciliação bancária (split view)
- Centro de Custo (essencial pras 13 academias)
- KPIs: Margem Bruta, Líquida, Burn Rate, Runway

### 📍 FASE 7 — Cobrança SaaS (1 semana)
- Painel Super Admin (Yussef vê tudo)
- Integração Asaas (recorrência em real, PIX, boleto)
- Trial 14 dias sem cartão
- Onboarding wizard
- Email transacional (Resend)

### 📍 FASE 8 — Apuração de Impostos
- Simples Nacional (DAS)
- IRPJ + CSLL
- **Reforma Tributária 2026: IBS + CBS**
- Suporte XML NF-e 2026
- Calendário fiscal

### 📍 FASE 9 — Chat IA Contadora
- Interface de chat
- RAG com legislação BR
- Contexto: dados financeiros da empresa
- Perguntas: "Quanto gastei com fornecedores em outubro?"

### 📍 FASE 10 — Pluggy Produção (quando justificar)
**Disparador:** 10+ clientes pagando = R$1.500-3.000/mês de receita
- Iniciar processo comercial Pluggy (KYC 2-4 semanas)
- Application Production
- Migrar do Meu Pluggy → API Produção (mesma estrutura, troca env vars)
- UI: cliente clica "Conectar Banco" e widget Pluggy abre dentro do Conta IA
- Manter OFX como fallback (planos starter mais baratos)

### 📍 FASE 11 — PWA + Mobile
### 📍 FASE 12 — Polimento + Lançamento público

---

## 🎯 Prioridade do Yussef (ranking)

1. **Relatórios e dashboards** ← Fases 3+4 + 6
2. **Conciliação bancária automática** ← Fase 6
3. **IA contadora que calcula impostos** ← Fases 8 + 9
4. **Open Finance** ← Fase 10 (quando tiver clientes pagando)

---

## 🔐 Convenções de código

- TypeScript strict mode em TUDO
- Commits semânticos (feat, fix, refactor, docs, test, chore)
- Validação com Zod em todas as rotas de API
- Textos de UI em português brasileiro
- Logs de erro descritivos em português
- Comentários em português quando explicam regra de negócio
- Componentes UI: shadcn/ui
- Path alias: `@/*` aponta pra raiz

---

## ⚠️ Pegadinhas operacionais Asaas (Sprint 3A/3B/3C)

### 1. `$` na ASAAS_API_KEY precisa de escape `\$` no `.env`

Chaves do Asaas começam com `$aact_hmlg_...` (sandbox) ou `$aact_prod_...`
(produção). O Next.js usa `@next/env` que aplica dotenv-expand: o `$`
inicial é interpretado como **expansão de variável shell**, e como o
nome (`aact_hmlg_...`) não é uma var existente, **a chave vira string
vazia em runtime**.

⚠️ Aspas simples NÃO bastam (diferente do bash). Tem que ESCAPAR:

```
❌ ASAAS_API_KEY=$aact_hmlg_xxx       → string vazia
❌ ASAAS_API_KEY='$aact_hmlg_xxx'     → string vazia
❌ ASAAS_API_KEY="$aact_hmlg_xxx"     → string vazia
✅ ASAAS_API_KEY=\$aact_hmlg_xxx      → FUNCIONA
```

Sintoma: `AsaasConfigError: ASAAS_API_KEY não configurada` nos logs
PM2 + endpoints de checkout retornam 500. Health check via `node
--env-file=.env script.mjs` continua funcionando (parser nativo do
Node NÃO faz expansão) — não use isso como validação suficiente.

Validação que pega o bug:
```bash
node -e "const{loadEnvConfig}=require('@next/env');loadEnvConfig('.');
console.log(JSON.stringify({defined:!!process.env.ASAAS_API_KEY,
length:(process.env.ASAAS_API_KEY||'').length}))"
```

Vale pra sandbox E produção. Antes de promover pra 3D, escapar o `$`
da chave de produção também.

### 2. Conta Asaas precisa de CHAVE PIX cadastrada pra Pix funcionar

`POST /v3/payments` com `billingType:PIX` retorna 200 e cria a cobrança
mesmo sem chave Pix cadastrada — MAS `pixTransaction` fica `null`.
Quando você chama `GET /v3/payments/{id}/pixQrCode`, retorna 400
`invalid_action: "Esta cobrança não permite pagamentos via Pix."`.

Pra resolver: no painel sandbox.asaas.com (ou www.asaas.com em prod),
ir em **Pix > Chaves Pix > Nova chave** e cadastrar qualquer tipo
(EVP aleatória é a mais fácil).

Vale pra sandbox E produção (3D). Em prod precisa de chave Pix antes
de aceitar cobranças Pix dos clientes.

### 3. `POST /v3/checkouts` com RECURRENT exige customerData COMPLETO ou NENHUM

Enviar `customerData` parcial (ex: name+email+cpfCnpj sem phone+
endereço) retorna 400. Os campos obrigatórios são: `name`, `email`,
`cpfCnpj`, `phone`, `address`, `addressNumber`, `postalCode`, `city`
(ID IBGE numérico), `province`.

Sprint 3B usa a estratégia "NENHUM" — cliente preenche tudo no hosted
Asaas (mesma página onde digita cartão). Zero fricção no nosso UI,
zero coleta de endereço/CEP.

Se algum dia precisar enviar customerData (ex: pré-preencher) →
enviar TODOS os 9 campos. Integrar ViaCEP + lookup IBGE city ID.

---

## 🚨 Anti-padrão detectado em Sprint 5.0.4.0a (27/05/2026)

Sprint 5.0.4.0a foi declarada entregue com DoD items "✅". Yussef testou
em prod (HEAD 1e91f4a) e encontrou que 2 items estavam falsos:
- Sidebar NÃO tinha item "Relatórios" (tinha "DRE Gerencial" antigo)
- Clicar "DRE Gerencial" abria DRE antigo (sem redirect 301)

CAUSA RAIZ: Marquei DoD como ✅ baseado em "código foi escrito" em vez
de "código foi VALIDADO no browser real". Erro concreto: editei
`components/layout/sidebar.tsx` mas o sidebar real do app é
`components/sidebar/global-sidebar.tsx` (sidebar única do TopBar, Sprint
4.0.5.a). Como nunca abri o app no browser, não vi que estava editando
o arquivo errado.

### REGRA REFORÇADA — validação visual obrigatória

Antes de marcar QUALQUER DoD item como ✅:
- DoD que mexe em **sidebar** → abrir o app e ver o sidebar
- DoD que mexe em **rota** → abrir a rota
- DoD que mexe em **link** → clicar no link
- DoD que mexe em **redirect** → testar via curl `-i` antes do dev server morrer
- DoD que mexe em **layout** → screenshot ou descrição visual

"Código escrito" ≠ "DoD cumprido".

### Workflow obrigatório ao final de toda sprint

1. `npm run build` OK (TS strict 0)
2. `npm run dev` → abrir browser local (`localhost:3000`)
3. Percorrer manualmente CADA item do DoD na UI real
4. Para redirects: `curl -i` validando status HTTP exato
5. SÓ DEPOIS declarar entregue
6. Solicitar smoke test do Yussef em prod

### Quando não posso validar no browser

Se o ambiente não permitir browser interativo (sem MCP browser, sem
display), **DECLARAR A LIMITAÇÃO EXPLICITAMENTE** no relatório de
entrega antes de pedir smoke test:

> "Não tenho acesso a browser nesta sessão. Validei via build + tests
> + curl, mas DoD items que dependem de visual (sidebar, layout, links)
> precisam de smoke test do Yussef antes de fechar a sprint."

Nunca mais marcar DoD visual como ✅ sem ter olhado com olhos humanos
(meus via screenshot/curl, ou de Yussef via teste real).

---

## 🛡️ Definição de Pronto (DoD) — REGRA CRÍTICA

Sprint 5.0.2.3 (26/05/2026) instituiu esse protocolo PERMANENTE após
3 sprints seguidas chegarem em prod com bugs que teste end-to-end teria pego:

| # | Sprint | Bug que escapou |
|---|---|---|
| 5.0.2.1 | Botão "Importar Excel" — não tinha entrada na UI | Faltou abrir o caminho do usuário |
| 5.0.2.2 | Cookie name errado em 4 server components | Unit tests passaram, ninguém clicou |
| 5.0.2.3 | `/confirm` viola unique constraint + cookies in RSC | Sem E2E real com planilha do contador |

### NENHUMA sprint pode ser declarada "entregue" sem TODOS estes:

1. ✅ **Unit/integration tests passando** (`npx vitest run`)
2. ✅ **Build sem erros** (`npm run build`)
3. ✅ **TS strict sem erros** (`npx tsc --noEmit`)
4. ✅ **Teste end-to-end REAL no browser** com:
   - Fluxo completo do usuário, do primeiro click ao resultado final
   - Para features de import/upload: usar **fixture real** + validar
     contagem numérica do resultado (ex: "94/94 linhas")
   - Playwright headless gera PNGs em `tests/e2e/screenshots/{sprint-id}/`
5. ✅ **Smoke test em produção** após deploy:
   - PM2 online (`pm2 list | grep online`)
   - URL principal responde 200 (`curl -sI`)
   - Fluxo crítico funciona manualmente (Yussef confirma)
6. ✅ **Relatório com evidência** entregue ao Yussef:
   - Métricas numéricas concretas (não "funcionou"; "94/94 linhas, R$ X")
   - PNGs do Playwright ou screenshots manuais
   - Logs limpos do deploy (`pm2 logs --err | head -20` sem erros novos)
   - Tempo medido das operações críticas
7. ✅ **Backup do banco em prod ANTES de qualquer deploy** que mude schema
   ou lógica financeira: `pg_dump -Fc | tee /var/backups/conta-ia/<sprint>.dump`

### Sintomas de violação

Se você (Claude Code) está tentado a dizer "entregue" sem ter feito o teste
end-to-end com a fixture real do Yussef, PARE. Faça o teste primeiro.

Se você está rodando só unit tests + build + TS check, ISSO NÃO É SUFICIENTE
pra features de fluxo do usuário (upload, navegação, formulários multi-step).

Se você não tem como testar end-to-end neste ambiente (sem browser interativo,
sem credenciais), DECLARE EXPLICITAMENTE essa limitação no relatório e peça
ao Yussef pra fazer o smoke test em prod ANTES de fechar a sprint.

### Cenários típicos de teste E2E obrigatório

| Feature | Cenários mínimos |
|---|---|
| Upload de arquivo | (1) válido fluxo completo; (2) >limit tamanho; (3) tipo errado; (4) re-upload idempotência; (5) rede instável retry |
| Form multi-step | (1) golden path; (2) voltar/avançar; (3) validation errors visíveis |
| CRUD listagem | (1) criar; (2) editar; (3) deletar; (4) filtros; (5) paginação |
| Conciliação | (1) match manual 1-1; (2) split; (3) ignore |

VIOLAR ESSA REGRA = bug em produção = retrabalho = quebra de confiança.

---

## 🛡️ Segurança e LGPD

- ✅ Senhas com bcrypt rounds=12
- ✅ JWT em cookie httpOnly (não acessível via JS)
- ✅ Validação Zod em todas as rotas
- ✅ Multi-tenant isolation (cada user só vê suas empresas)
- [ ] Refresh tokens (FASE 7)
- [ ] Rate limiting (FASE 7)
- [ ] Logs de auditoria pra ações financeiras
- [ ] Criptografia em repouso pra dados sensíveis (CNPJ, dados Pluggy)
- [ ] Tela LGPD: exportar dados, excluir conta com purga 30 dias
- [ ] Termo de Uso + Política de Privacidade
- [ ] Certificado A1/A3 pra emissão NF-e (futuro)

---

## 📊 Padrão de Relatórios — CAIXAOS

A partir da Sprint 5.0.4.0a, **todos os relatórios financeiros** ficam em
`/empresas/[id]/relatorios/<nome>`. `/relatorios` global redireciona pra
per-empresa via cookie. Sidebar tem item "Relatórios" ativo.

**Estrutura obrigatória de cada relatório:**
- Breadcrumb "← Voltar pra Relatórios"
- Header com título + subtítulo descritivo
- Linha de filtros (período, comparações, tipo)
- Stats cards (3-4) com indicadores e contadores
- Conteúdo principal (tabela ou gráfico)
- Drill-down clicando linhas (quando aplicável)

**Cores semânticas:**
- Receitas: `emerald-600`
- Despesas: `red-600`
- Resultados positivos: `emerald` bold
- Resultados negativos: `red` bold
- Estável: `slate`
- Crescimento: `↑↑` (red, > +50%) · `↑` (amber, +15-50%) · `━` (slate, ±15%) · `↓` (sky, -15-50%) · `↓↓` (sky escuro, < -50%)
- Novidade: `🆕` + `purple` (categoria apareceu pela 1ª vez)
- Sumiu: `✕` + slate-400

**DRE existente (lib/dre/*) é REUSADO em /relatorios/dre-gerencial** — não
foi duplicado nem refatorado. Mesma fonte da verdade rodando em URL nova.

**Rotas iniciais (5.0.4.0a):**
- `/relatorios` (global, redirect cookie)
- `/empresas/[id]/relatorios` (index com 3 cards)
- `/empresas/[id]/relatorios/dre-gerencial` (reusa DREClient)
- `/empresas/[id]/relatorios/comparativo` (3 meses lado a lado)
- `/empresas/[id]/relatorios/categorias` (top N + barra horizontal)

**Rotas futuras:**
- Sprint 5.0.4.0b: fluxo-caixa, fornecedores, funcionarios
- Sprint 5.0.4.0c: variancias (IA), multi-empresa
- Sprint 5.0.4.0d: export PDF, mobile polish, E2E

---

## 📝 Log de sessões

### 29/04/2026 — Reorganização e estratégia OFX-first
**Contexto:** sessão de planejamento via chat com Claude (não Claude Code ainda).

**Descobertas:**
- Existem 2 pastas no Desktop: `conta ia` (vazia, lixo) e `conta-ia` (projeto real)
- Pasta correta: `Desktop\conta-ia` (com hífen)
- Stack real é Next.js 16.2.4, não 14 como dizia o CLAUDE.md antigo
- Yussef tem 7 bancos pra conectar (Banrisul, Bradesco, Itaú, Santander, Sicredi, Sicoob, Caixa, Nubank PJ)
- Banrisul já conectado no Meu Pluggy

**Decisões tomadas:**
- Workflow: chat (estratégia) + Claude Code no PC (execução)
- **Estratégia OFX-first:** zero custo Pluggy até ter receita
- Meu Pluggy SÓ pra Yussef em dev (treinar IA com dados reais)
- Clientes beta usam upload OFX manual
- Pluggy produção paga só na FASE 10 (10+ clientes pagantes)
- Suportar PF + PJ nativamente (rastrear pró-labore)
- Documento mestre único: este CLAUDE.md (consolidado)

**Próximo passo:** Yussef abre Claude Code apontado pra `Desktop\conta-ia`, cola prompt de auditoria/execução FASE 2.1.

### 30/04/2026 — Auditoria 2.1 + unificação 3+4 + sub-etapa 3.1 + 2 bugs bloqueadores

**Contexto:** primeira sessão de execução com Claude Code apontado pra `Desktop\conta-ia` após a reorganização do dia 29/04.

**O que foi feito (5 commits):**
- `0d54c80` — Auditoria FASE 2.1: marcada como concluída no doc (já estava 100% no código, regressão de checkboxes na reescrita de 29/04).
- `a83fe87` — Unificação FASE 3 (UX OFX) + FASE 4 (IA Contadora) em "Importar e classificar perfeito", com sub-etapas reordenadas pra encurtar tempo até teste com dados reais.
- `3ebba31` — Sub-etapa 3.1: detecção automática do banco no preview (BANKID → nome via mapa FEBRABAN; UI mostra detecção e oferece auto-preencher cadastro).
- `e4141ee` — **Bug bloqueador descoberto no teste:** lista de bancos do form de cadastro estava divergente da do OFX (Banrisul, Sicredi, Sicoob, BTG, Safra ausentes no form). Refatorado pra fonte única em `lib/bancos.ts` com testes de consistência ida-e-volta.
- `54921d4` — **Bug bloqueador descoberto no teste com dados reais:** Banrisul reusa FITIDs ("000001", "000002", ...) entre transações distintas no mesmo OFX. A constraint `@@unique([bankAccountId, externalId])` fazia o import inteiro falhar. Refatorada dedup pra usar `dedupHash = sha256(fitid + data + valor + memo)` num campo separado; `externalId` virou só auditoria. Pluggy ficou intocado.

**Validação final com dados reais:** Yussef importou 270 transações do Banrisul, saldo R$ 5.821,08 calculado correto, transações de março/2026 aparecem ao filtrar pelo período, detecção automática do banco funciona (card verde "Banco detectado: Banrisul (041)").

**Decisões de produto registradas:**
- Pluggy congelado por tempo indeterminado — não pega contas PJ direito. Foco 100% em OFX manual até nova ordem.
- Código FEBRABAN 290 = "PagBank" (nome de mercado, não razão social "PagSeguro").

**Descoberta interessante:**
- 2 dos 5 commits foram bugs bloqueadores descobertos só ao Yussef testar com dados reais (lista de bancos incompleta + FITIDs duplicados do Banrisul). Reforça o valor da estratégia "testar com 1 OFX real ASAP" do plano da FASE 3+4 — esses bugs ficariam invisíveis num beta sem dados brasileiros reais.

**Próximo passo:** sub-etapa 4.1 — criar tabelas `suppliers` e `ai_learning_rules` no schema Prisma (base pra pipeline de classificação automática).

### 03/05/2026 — Pesquisa profunda de mercado e definição do NORTE
**Contexto:** Yussef estabeleceu filosofia "qualidade extrema > velocidade" (02/05) e pediu pesquisa profunda antes de prosseguir com Fase B do Plano de Contas.

**Pesquisa realizada (no chat com Claude, não Code):**
- 30+ buscas web profundas via WebSearch
- Fontes oficiais (Receita Federal, Ministério Fazenda, leis)
- Benchmark de 15 sistemas (BR e globais)
- Análise IA financeira 2026
- Cronograma Reforma Tributária 2026-2033

**Resultado:**
- Documento `docs/PRODUTO-NORTE.md` (~37KB, 934 linhas) — arquivado em 03/05/2026, substituído por `docs/CONTA-IA-NORTE.md`
- 5 insights principais de mercado
- 6 diferenciais sustentáveis identificados
- Roadmap revisado de 12 meses
- Posicionamento e pricing definidos

**Decisões registradas:**
- Foco inicial: SERVICE/Academia (Yussef = expert)
- Templates por SUBSETOR (não setor amplo)
- IA como cérebro central, não feature
- Recomendação tributária ativa = diferencial chave
- Folha integrada nativa (não add-on)
- Pronto pra Reforma Tributária 2026 desde dia 1

**Próximo passo:** Yussef revisa o CONTA-IA-NORTE.md (versão consolidada que substituiu o PRODUTO-NORTE.md), confirma decisões pendentes, e damos sequência à Fase B do Plano de Contas com profundidade extrema (80-120 categorias, 3 níveis, foco academia primeiro).

### 03/05/2026 (parte 2) — Etapa 2.4 backfill empresas existentes CONCLUÍDA
**Contexto:** Bug descoberto no teste da 2.3 — cacula mix sem categorias, dropdown vazio.

**Diagnóstico revelou 3 problemas:**
- cacula mix com 0 categorias (criada antes do seed)
- Tipos no banco em UPPERCASE (RESTAURANT, SERVICE) mas router em lowercase
- taxRegime "SIMPLES_NACIONAL" genérico (sem sufixo do anexo)

**Soluções aplicadas:**
- Fix em `getTemplate()` pra normalizar lowercase + aceitar null/undefined
- Script `scripts/backfill-templates.ts` (idempotente, atomic via `prisma.$transaction`)
- Migration taxRegime legacy (`SIMPLES_NACIONAL` → `SIMPLES_NACIONAL_III`)
- Aplicação automática de templates por companyType
- Mapping heurístico de dreGroup pra categorias antigas (15 regras)
- Movido `scripts/_diagnostico.ts` pra `docs/exemplos/diagnostico-empresas.ts`

**Resultado:**
- cacula mix: 0 → 182 categorias (template Restaurante)
- Demo Conta IA: 15 → 210 categorias (195 do template Academia + 15 antigas mapeadas)
- 270 transações da cacula mix preservadas (categoryId mantido)
- 35 testes novos (267/267 total)
- Validação visual: dropdown funcionando, classificação real OK (contador 100 → 99)

**Próxima fase planejada (Fase B+):** UI de Gerenciamento de Categorias estilo Conta Azul — árvore navegável, drag-and-drop, edição inline, criar/desativar, restaurar template. Critério de prioridade: virou o próximo gargalo de UX agora que o backfill aplicou plano profissional nas empresas existentes.

### 03/05/2026 (parte 3) — Documentação estratégica consolidada
**Contexto:** Após Etapa 2.4 concluída (commit `dfeb20c`), Yussef e Claude (chat) fizeram pesquisa profunda em 5 sessões iterativas (V1 → V2-A → V2-B → V2-C → V3 → consolidação final) sobre UI Categorias + DRE.

**Achados principais:**
- 18 furos identificados em V1 e corrigidos em V2/V3
- Hierarquia de documentos clarificada (CLAUDE.md operacional vs CONTA-IA-NORTE.md estratégico)
- Postura da IA definida: INTELIGENTE-PROATIVA (não conservadora demais, não agressiva)
- Foco geográfico confirmado: BRASIL 100% (sem visão global)

**Documentos consolidados:**
- ✅ Criado `docs/CONTA-IA-NORTE.md` (2.332 linhas) — visão estratégica completa
- ✅ Substitui PRODUTO-NORTE.md (arquivado em `docs/_arquivado/`)
- ✅ Cabeçalho do CLAUDE.md atualizado com hierarquia clara

**Decisões estratégicas registradas no CONTA-IA-NORTE.md (14 decisões):**
- Hierarquia categorias: 3 default, schema permite até 5
- Drag-and-drop: v1 reordenar mesmo nível, v1.5 entre níveis
- Importação CSV: stretch v2
- Insight IA: cache 24h, toggle ON
- Drill-down DRE: modal lateral
- 4 cards de KPI fixos (Receita/Bruto/EBITDA/Líquido)
- Posicionamento honesto sem promessa "#1 BR"
- Custom Roles em todos os planos (diferencial vs QuickBooks)
- Audit log retenção 5 anos (LGPD anonimizar, não deletar)
- Implementação: Categorias primeiro
- Migrations faseadas (uma por vez)
- Atalhos teclado em fases
- Densidade árvore: compacta desktop, espaçada mobile
- Paleta cores: 12 curadas + custom
- IA Coach: postura INTELIGENTE-PROATIVA com simulações reais (ex: alerta migração regime tributário com economia em R$)

**Próximo passo:** Etapa 5.1 — Tela `/empresas/[id]/categorias` (gerenciar Plano de Contas).

### 10/05/2026 — Migração para MacBook + Plano Mestre Dashboard Mundial + Sprint 0.5

**Contexto:** Yussef migrou o ambiente de desenvolvimento do PC Windows pro MacBook M5 (`/Users/yussef/Projects/conta-ia`). Sessão estratégica de planejamento via chat com Claude (não Code) pra desenhar o Dashboard que vai virar o jogo contra Conta Azul.

**Migração de ambiente:**
- PC Windows → MacBook M5 (Apple Silicon)
- Pasta nova: `/Users/yussef/Projects/conta-ia`
- Stack mantida (Next.js 16.2.4, Prisma 5.22, SQLite dev)
- Daqui pra frente Claude Code roda no Mac

**Pesquisa profunda Conta Azul (no chat):**
- Mapeamento completo: dashboard, DRE, fluxo de caixa, conciliação, Conta AI Captura, pricing
- 7 fraquezas reais identificadas (reajuste 165% num ciclo, suporte ruim, bugs NFS-e, dashboard fraco que precisa de Power BI externo, multi-empresa amarrado, personalização limitada, IA só de captura sem aprendizado, atualização D-1)
- 6 forças reconhecidas (marca, emissão fiscal, conta PJ própria, parceria contadores, estoque/PDV, mobile maduro) — **NÃO** entramos nessas frentes no curto prazo

**Benchmark mundial:**
- Mercury, Brex, Ramp, Stripe — padrões visuais e UX
- Tese: "Conta Azul melhorada — familiar BR, mas premium"
- Paleta definida, tipografia (tabular-nums!), princípios fintech 2026

**Documento criado:** `docs/DASHBOARD-PLAN.md` (620 linhas)
- Parte A: pesquisa Conta Azul (forças, fraquezas, oportunidades)
- Parte B: mockup do Dashboard Mundial (5 zonas: Hero KPIs, Saúde, Cashflow Waterfall + AI Insights, Mini-DRE + Top Categories, Recent + Pending)
- Parte C: plano técnico em 3 Sprints (1-3) + Sprint 0.5 inserido como pré-requisito

**🚨 Descoberta crítica (Sprint 0.5):**
Conversa revelou 2 gaps fundacionais que impediriam o Dashboard de mostrar números corretos:

1. **Transferências entre contas da MESMA empresa** — Yussef tem 13 academias, cada uma com 3-4 contas (Banrisul, Sicredi, Sicoob, Caixa). Move dinheiro entre contas pra cobrir folha. Hoje isso seria contado como receita + despesa pelo DRE → inflação artificial + risco de imposto sobre dinheiro fake. Solução: campo `transferGroupId` pareando as 2 pontas + filtro `type !== 'TRANSFER'` no DRE/Fluxo Consolidado.

2. **Saldo negativo (cheque especial)** — Sistema atual não suporta visualmente. Solução: campos `allowNegativeBalance` + `creditLimit` + `lowBalanceThreshold` em `bank_accounts`; visual com badge amarelo/vermelho; alerta IA proativo.

Esses 2 itens foram extraídos pro **Sprint 0.5 (3-4 dias)** que vira pré-requisito de QUALQUER avanço no dashboard. Inserido no roadmap ANTES da FASE 3+4.

**Decisões registradas:**
- Hierarquia de docs ampliada: CLAUDE.md (operacional) > CONTA-IA-NORTE.md (estratégico) > **DASHBOARD-PLAN.md (execução sprints dashboard)** > DEPLOY.md (deploy)
- Stack visual confirmada: Recharts + Framer Motion (a adicionar)
- Posicionamento: "Conta IA: a gestão financeira que a Conta Azul deveria ter sido."

**Próximo passo (próxima sessão Claude Code):** iniciar **Sprint 0.5 Dia 1** — migrations Prisma para `transferGroupId` em `transactions` + `allowNegativeBalance`/`creditLimit`/`lowBalanceThreshold` em `bank_accounts`. Sem mexer em UI/API ainda — só schema + Prisma client + testes do schema.

### 11/05/2026 — Sprint 0.5 Dia 1: schema + migrations

**Contexto:** primeira sessão Claude Code no MacBook após migração de ambiente (10/05). Branch `feature/postgres-prod`, working tree limpo, 709/709 testes passando como baseline. Yussef autorizou começar Sprint 0.5 Dia 1 (fundação pro Dashboard Mundial).

**O que foi feito (commit `183ae53`):**
- `prisma/schema.prisma`: 4 campos novos
  - `Transaction.transferGroupId String?` (nullable) + `@@index([transferGroupId])`
  - `BankAccount.allowNegativeBalance Boolean @default(true)`
  - `BankAccount.creditLimit Float @default(0)`
  - `BankAccount.lowBalanceThreshold Float?` (nullable)
- Comentário do `Transaction.type` atualizado pra mencionar `TRANSFER`
- `prisma/migrations/20260511000000_sprint_0_5_transfers_and_negative_balance/migration.sql` — SQL Postgres puro pra `migrate deploy` em produção
- Dev DB (SQLite) sincronizado via `npx prisma db push` + `prisma generate`
- 2 arquivos de teste novos: `__tests__/schema-transfer.test.ts` (4 testes) + `__tests__/schema-bank-account.test.ts` (6 testes) — usam `Prisma.dmmf` + leitura da migration SQL (sem DB real, alinhado ao padrão do projeto)
- 719/719 testes passando

**Decisões/descobertas técnicas:**
- `prisma migrate dev` quebra no shadow DB SQLite porque migrations existentes têm sintaxe Postgres (`ADD CONSTRAINT`). Confirmado que o projeto usa `db push` em dev + migration files escritas à mão pra prod. Mantido o padrão.
- DMMF do Prisma 5.22 NÃO expõe `@@index` não-únicos no client gerado — só `uniqueIndexes`. Solução: teste de índice valida o conteúdo da migration SQL.
- `field.documentation` do DMMF só preserva comentários `///` (triple slash), não `//`. Substituído por teste mais útil (índice via SQL).

**Contexto de negócio validado com Yussef:**
- 13 academias × 3-4 contas cada (~45 contas total)
- Transferências entre contas da mesma empresa são FREQUENTES (várias/mês)
- Saldo negativo é REGRA, não exceção (algumas contas ficam negativas 5-6 meses)
- Sem Sprint 0.5, DRE inflaria em ~R$ 50-100k/mês de receita/despesa fake — confirma que essa etapa é CRÍTICA, não cosmética

**Próximo passo:** Sprint 0.5 Dia 2 — Backend transferências
1. `POST /api/transferencias` (atomic via `prisma.$transaction`, valida mesma empresa + saldo se `allowNegativeBalance=false`)
2. `DELETE /api/transferencias/[groupId]` (remove o par completo)
3. `GET /api/transferencias` (lista paginada)
4. Detecção heurística no preview OFX (sugerir parear)
5. Modal "Nova Transferência" simples (mover pra Dia 4 se precisar)

### 11/05/2026 (parte 2) — Sprint 0.5 Dia 2: backend de transferências

**Contexto:** Yussef decidiu avançar pro Dia 2 na mesma sessão após fechar o Dia 1. Plano aprovado com ajuste crítico de produto na detecção heurística OFX (2 níveis de confiança em vez de 1).

**O que foi feito (commit `885bbc6`):**
- **API REST nova** (`app/api/transferencias/`):
  - `POST /api/transferencias` — cria par atomic via `prisma.$transaction` ([create debit, create credit, update from balance, update to balance])
  - `GET /api/transferencias?empresaId=&page=&limit=` — lista agrupada por `transferGroupId`, paginação no nível dos grupos
  - `DELETE /api/transferencias/[groupId]` — remove par completo + reverte saldos
- **Lib nova** `lib/transfers/`:
  - `validate.ts` — schema Zod + `assertSameCompany` + `TransferValidationError` (status 400)
  - `build-operations.ts` — função PURA monta o par (testável sem DB)
  - `create.ts` — orquestra fetch contas + permission + atomic + audit log
  - `delete.ts` — detecta direção via `orderBy: createdAt ASC` (robusto pra description custom)
- **Detecção heurística OFX** (`lib/ofx/detect-transfer.ts`) — NÃO integrada com import ainda (Dia 4 com UI):
  - **HIGH ≥0.90:** mesmo dia + valor exato + sinais opostos → `AUTO_PAIR` (provável PIX)
  - **MEDIUM 0.70-0.89:** D ou D+1 + valor exato + sinais opostos → `CONFIRM` (provável TED)
  - **Boost por keyword:** PIX/TED = +0.10, TRANSF/DOC/ENTRE CONTAS = +0.05
  - Tolerância 1 centavo (rounding); detecta direção automaticamente (DEBIT=from, CREDIT=to)
- **DRE atualizada:**
  - `lib/dre/types.ts` — `TransactionForDRE.type` aceita `'TRANSFER'`
  - `lib/dre/calculator.ts` — `if (tx.type === 'TRANSFER') continue` (defesa em profundidade)
  - `app/api/empresas/[id]/dre/route.ts` — `where: { type: { not: 'TRANSFER' } }` (otimização SQL)
- **Audit log:** 1 entrada unificada por operação (`entityType: 'Transfer'`, `entityId: groupId`, metadata com IDs das 2 transações + contas)
- **Permissions:** reuso de `transaction.create`/`view`/`delete` (sem mexer em RBAC catalog)

**Contexto de produto registrado (vale ouro pra futuras sessões):**
- PIX é o método predominante de transferência entre contas hoje no Yussef (instantâneo, sempre mesmo dia)
- TED é minoritário mas existe (cai D+1 se feito após 16h)
- Detecção em 2 níveis evita falsos positivos: valor coincidente em datas distantes NÃO sugere transferência

**Decisões técnicas notáveis:**
- **Defesa em profundidade no DRE:** filtragem em 2 camadas (SQL + engine puro). SQL é otimização; engine puro garante correção mesmo se chamado direto (testes, batch futuro).
- **Detecção de direção no DELETE:** usa `orderBy: createdAt ASC` em vez de prefix de description (frágil pra description custom). Funciona porque `$transaction([create debit, create credit])` garante ordem.
- **Função `buildTransferOperations` 100% pura:** sem DB, testável em isolamento, 13 testes específicos validam o shape exato dos 2 inserts.

**Métricas:**
- 50 testes novos (4 arquivos): `transfers-validate` (13), `transfers-build-operations` (13), `dre-ignores-transfer` (6), `ofx-detect-transfer` (18)
- **769/769 testes passando** (era 719 no Dia 1)
- `tsc --noEmit` exit 0 (TypeScript strict OK)
- 14 arquivos no commit (11 novos + 3 modificados), +1273/-2 linhas

**Próximo passo:** Sprint 0.5 Dia 3 — Engines de cálculo + validação de saldo
1. `lib/balance/check.ts` — função pura que valida se transação deixa saldo abaixo de `-creditLimit` (quando `allowNegativeBalance=false`). Integrar no `createTransfer` + `POST /api/transacoes`.
2. `lib/balance/calculate.ts` — calcula saldo atual e projetado por conta (já temos `balance` cacheado em `bank_accounts`, mas precisa de função pura pra recalcular do zero a partir das transações).
3. `lib/cashflow/consolidated.ts` — engine de fluxo de caixa consolidado (todas as contas da empresa, filtra TRANSFER).
4. `lib/cashflow/by-account.ts` — fluxo POR conta (NÃO filtra TRANSFER, mostra entrada/saída normalmente).
5. Testes em massa.

### 11/05/2026 (parte 3) — Sprint 0.5 Dia 3: engines de saldo e cashflow

**Contexto:** Yussef quis avançar pro Dia 3 imediatamente após o Dia 2. Antes de codar, ele forneceu **correção crítica de entendimento de produto** sobre como `creditLimit` funciona no mundo real das 13 academias.

**Contexto de produto registrado (ouro pra futuras sessões):**
- Cada conta bancária tem cheque especial **REAL e DIFERENTE**:
  - **Banrisul:** R$ 600.000 (pode ficar negativa até -600k)
  - **Sicredi:** R$ 80.000 (pode ficar negativa até -80k)
  - Outras contas: cada uma com seu limite próprio
- Contas podem ficar negativas por **ANOS** (2, 3, 6 anos) dentro do limite — isso é operação NORMAL pra PME brasileira, não excepção
- **Decisão de produto:** `allowNegativeBalance=true` significa "conta tem cheque especial"; `creditLimit` é o valor REAL do limite. Lógica:
  ```ts
  if (allowNegativeBalance === false) {
    allowed = (saldo - amount) >= 0       // tipo poupança
  } else {
    allowed = (saldo - amount) >= -creditLimit   // cheque especial real
  }
  ```

**O que foi feito (commit `b82a4eb`):**
- **6 arquivos novos em `lib/`:**
  - `lib/balance/prepare.ts` — atribui sinal por transação (CREDIT/+, DEBIT/−, TRANSFER conforme ordem por `createdAt`), FILTRA contas alheias (defesa em profundidade)
  - `lib/balance/calculate.ts` — recomputa saldo do zero, retorna `{ current, available, inNegativeSince, daysInNegative, lowestBalance, lowestBalanceDate }`. `inNegativeSince` RESETA a cada volta a positivo
  - `lib/balance/check.ts` — `checkBalance(input)` + `BalanceCheckError` (status 422). Implementa lógica exata dos exemplos do Yussef
  - `lib/cashflow/query.ts` — query builders centralizados pra multi-tenant
  - `lib/cashflow/consolidated.ts` — fluxo da empresa (`companyId`), ignora TRANSFER, agrupa day/week/month
  - `lib/cashflow/by-account.ts` — fluxo por conta (`bankAccountId`), INCLUI TRANSFER via `signedAmount`
- **Integração (3 arquivos modificados):**
  - `lib/transfers/create.ts` — chama `checkBalance` antes do `$transaction`
  - `app/api/transferencias/route.ts` — mapeia `BalanceCheckError` → HTTP 422
  - `app/api/transacoes/route.ts` — POST agora valida saldo (DEBIT bloqueia se estoura; CREDIT sempre passa)
- **Script de safety net:** `scripts/backfill-credit-limits.ts` — idempotente, cutoff `2026-05-11T23:59:59Z`, aplica `creditLimit=999.999.999` em contas pré-Sprint-0.5 com `creditLimit=0`. **Deve rodar em produção ANTES do próximo deploy** pra não travar Cacula Mix em despesas

**Cenários reais cobertos em `balance-check.test.ts`:**
- Banrisul 600k limit, saldo=-550k + despesa 30k → ALLOWED (dentro do limite)
- Banrisul 600k limit, saldo=-550k + despesa 100k → BLOQUEADO (estoura -600k)
- Sicredi 80k limit, saldo=-70k + despesa 20k → BLOQUEADO (estoura -80k)
- Poupança `allowNegativeBalance=false`, saldo=100 + despesa 200 → BLOQUEADO
- Conta nova `creditLimit=0 + allowNegativeBalance=true` → BLOQUEADO (limite=0)
- CREDIT (entrada) sempre passa, mesmo conta MUITO negativa
- Edge cases: exatamente no limite passa; 1 centavo abaixo bloqueia

**Decisões técnicas notáveis:**
- **Defesa em profundidade no multi-tenant**: 3 camadas. (1) Query builders centralizados rejeitam `companyId/bankAccountId` vazio; (2) Funções puras lançam se receberem ID vazio; (3) `prepareBalanceTransactions` FILTRA transações de contas alheias mesmo se passadas por engano
- **Normalização de `-0`**: JavaScript retorna `-0` em `-creditLimit` quando `creditLimit=0`. Normalizado pra `0` no `check.ts` (caso 1 teste pegou)
- **Rastreabilidade em results**: `calculateConsolidatedCashflow` retorna `companyId` no result; `calculateByAccountCashflow` retorna `bankAccountId`
- **CREDIT (entrada) NUNCA bloqueia**: regra crítica — recebimento de dinheiro sempre passa, mesmo conta muito negativa. Bloquear receita por causa de saldo seria absurdo

**Métricas:**
- **71 testes novos** (6 arquivos): `balance-prepare` (10), `balance-calculate` (13), `balance-check` (18), `cashflow-consolidated` (10), `cashflow-by-account` (10), `multitenant-isolation` (10)
- **840/840 testes passando** (era 769 no Dia 2)
- `tsc --noEmit` exit 0
- 16 arquivos no commit (13 novos + 3 modificados), +1668/-8 linhas

**Próximo passo:** Sprint 0.5 Dia 4 — UI completa
1. Modal "Nova Transferência" (dropdowns origem/destino + valor + data)
2. Página `/transferencias` (lista agrupada por `transferGroupId` com filtros)
3. Card de conta bancária: badge amarelo "ATENÇÃO" / vermelho "SALDO NEGATIVO" + dias no vermelho (usar `calculateBalance` engine)
4. Tela de edição de conta: configurar `allowNegativeBalance`, `creditLimit`, `lowBalanceThreshold` (substituir o backfill)
5. Integração da detecção heurística OFX no preview de import (oferecer 1-clique pra parear HIGH)
6. Tratar HTTP 422 nas chamadas (mostrar mensagem amigável de cheque especial estourado)

### 11/05/2026 (parte 4) — Sprint 0.5 Dia 4: UI completa + Replace OFX  🏁 SPRINT 0.5 FINALIZADO

**Contexto:** quarta e última etapa do Sprint 0.5 numa única sessão de hoje. Yussef pediu UI completa + integração com tudo que foi construído nos Dias 1-3, e durante a apresentação do plano inicial decidiu transformar o pareamento OFX num **Replace completo** em vez do MVP que eu havia proposto (que geraria duplicação). Decisão certa: Yussef vai usar muito o feature, precisa funcionar 100%.

**O que foi feito (commit `d53ef79`, 15 arquivos, +2539/-57 linhas):**

UI principal:
- `components/transferencias/NovaTransferenciaModal.tsx` — Modal Dialog shadcn reutilizável, trata HTTP 422 com banner amarelo inline (não fecha o modal — UX permite ajustar e retentar)
- `app/(dashboard)/empresas/[id]/transferencias/page.tsx` — Lista paginada com filtros (período + conta nos 2 lados origem/destino) e delete via ConfirmDialog
- `app/(dashboard)/empresas/[id]/contas/page.tsx` — Badge dinâmico no card de conta usando `computeBalanceBadgeStatus` (verde/amarelo/vermelho + porcentagem colorida de uso do cheque especial)
- `components/contas-bancarias/conta-form.tsx` — 3º Card "Cheque Especial" (Checkbox + 2 inputs com tooltips)
- `app/(dashboard)/empresas/[id]/contas/[contaId]/importar/page.tsx` — Section "X transferências detectadas" com cards HIGH/MEDIUM + ConfirmDialog do Replace

Backend:
- `app/api/contas-bancarias/[id]/detectar-transferencias/route.ts` — endpoint enriquece candidatos com `existingTxCategoryName` + `existingTxHasNotes`
- `app/api/transferencias/from-ofx/route.ts` — endpoint do Replace, mapeia 422/400
- `lib/transfers/build-ofx-replace.ts` — função PURA (testável sem DB) que monta as operações
- `lib/transfers/from-ofx.ts` — orquestrador atomic (revert saldo + delete existing + create par TRANSFER + audit)

**🧠 Decisão técnica notável — "dedupHash reservation":**
Em vez de modificar o endpoint de import OFX pra aceitar lista de skips (introduziria risco de regressão), reaproveitamos a constraint `@@unique([bankAccountId, dedupHash])` existente. A transação TRANSFER criada na conta importada recebe o mesmo `dedupHash` da OFX preview, ocupando o slot. Quando o user confirma o import depois, a tentativa de inserir a CREDIT/DEBIT colide naturalmente → import marca como "duplicada" e skipa. **Zero mudança no endpoint de import OFX. Risco de regressão = 0.**

**Estatística histórica do dia (sessão única 11/05/2026):**
- Começamos: **709 testes** (baseline antes do Sprint 0.5)
- Terminamos: **881 testes** — **+172 testes (+24%) sem regressões**
- 8 commits totais (4 feat + 4 docs)
- 4 dias planejados → entregues em ~1 sessão

**Distribuição dos testes novos (172 total):**
- Dia 1: 10 (schema)
- Dia 2: 50 (transferências + DRE filter + detecção heurística)
- Dia 3: 71 (engines + multi-tenant)
- Dia 4: 41 (UI helpers + Replace OFX)

**Próximo passo:** **Sprint 1 — Dashboard Mundial** (Semana 1 do `docs/DASHBOARD-PLAN.md` Parte C.5).
- Adicionar Recharts + Framer Motion
- Implementar componentes base `KPICard`, `Sparkline`, `PeriodFilter`
- Hero Strip com 4 KPIs principais (Saldo + Receita + Despesas + Resultado)
- Health Check reusando `lib/kpis/saude-financeira`
- Mini-DRE + Top Categories (donut)

**Ações operacionais ANTES do próximo deploy em produção:**
1. Rodar `npx tsx scripts/backfill-credit-limits.ts` (safety net pra Cacula Mix)
2. Yussef revisar e configurar `creditLimit` real por conta via UI (`/empresas/[id]/contas/[contaId]/editar` agora tem section "Cheque Especial")
3. Smoke test do fluxo: criar transferência manual → import OFX → parear sugestão → confirmar import → verificar contadores em `/transferencias`

### 11/05/2026 (parte 5) — Sprint 1 Dia 1: Hero Strip Dashboard Mundial

**Contexto:** com Sprint 0.5 100% finalizado mais cedo no dia, Yussef decidiu emendar pra **Sprint 1 — Dashboard Mundial**. Dia 1 focado em fundação visual: Hero Strip com 4 KPIs + sparklines, infraestrutura de queries com cache, e empty states.

**O que foi feito (commit `7176ffe`, 14 arquivos, +1768/-132 linhas):**

Infraestrutura (lib/dashboard/):
- `types.ts` — `HeroKPIsResult`, `KPIValue`, `KPIDelta`, `SparkPoint`
- `period.ts` — `derivePeriods(refDate)` retorna 4 ranges (current/previous month, last 30 days, last 12 months) com edge cases de fim de mês e ano
- `compute-kpis.ts` — função PURA `computeKPIsFromData` que agrega `calculateDRE` + `calculateConsolidatedCashflow` (Sprint 0.5) em KPIs
- `queries.ts` — `getHeroKPIs(companyId)` server-side com `unstable_cache` 60s + tags `dashboard:${companyId}` (Sprint 2 vai revalidar em mutations)

UI (app/(dashboard)/dashboard/_components/):
- `HeroKPIs.tsx` — server component que faz fetch + grid 4 cards
- `KPICard.tsx` — client component animado (Framer Motion stagger 50ms), variant primary com gradient azul Conta IA
- `Sparkline.tsx` — Recharts AreaChart com gradient sutil, dinamicamente importada com `ssr: false` (resolve warning `width(-1)` do ResponsiveContainer)
- `CompanySelector.tsx` — Select shadcn que muda `?empresa=` via `router.push`, renderiza só com 2+ empresas
- `EmptyDashboard.tsx` — 3 empty states: sem empresas, sem contas, sem transações (com 2 CTAs: Importar OFX / Lançar Manualmente)

Página principal:
- `app/(dashboard)/dashboard/page.tsx` — REESCRITA completa. Server component lê `searchParams.empresa`, decide empty state, integra HeroKPIs em Suspense com Skeleton

**Decisões técnicas notáveis:**
- **URL como source-of-truth de empresa**: `?empresa=<id>` permite shareable links, back/forward funciona, cache-friendly. Sprint 2 expande pra modo "consolidado" facilmente.
- **5 queries paralelas no Prisma**: previne N+1, ~125ms application-code consistente.
- **Cache validado empiricamente**: 1ª call 1.99s (Turbopack compilando), 2ª call **127ms** (15x mais rápido) — confirma `unstable_cache` ativo.
- **Sparkline saldo cumulativo**: caminha "pra trás" a partir do saldo atual, subtraindo o `net` de cada dia. Narrativa visual de tendência.
- **Semântica invertida em despesas**: `direction='up'` (verde) quando despesa CAI vs mês anterior. Quem programa pensando "alto = bom" cai em erro aqui.
- **Recharts SSR fix**: `dynamic(() => Sparkline, { ssr: false })` eliminou warnings `width(-1)` que apareciam em cada server render.

**Smoke test (3 cenários reais com `npm run dev`):**
- ✅ Sem auth → 307 redirect /login
- ✅ Auth admin@contaia.com.br (1 empresa Demo, 0 contas) → renderiza empty state (b)
- ✅ Auth + seed temporário 60 tx → Hero Strip completo com 4 cards + 8 sparklines visíveis no HTML

**Stack adicional:**
- `recharts@3.8.1` (charts)
- `framer-motion@12.38.0` (animações entrance)
- Instalado com `--legacy-peer-deps` (conflito pré-existente eslint 8 vs eslint-config-next 16 — não relacionado às novas deps)

**Métricas:**
- 14 arquivos no commit (11 novos + 3 modificados)
- **21 testes novos** (7 dashboard-period + 14 dashboard-compute-kpis)
- **902/902 testes passando** (era 881 no fim do Sprint 0.5 — superou estimativa de 895)
- TypeScript strict: 0 erros
- 1ª carga: 1.99s | 2ª carga: 127ms (cache hit)

**Próximo passo:** **Sprint 1 Dia 2-3** — Mini-DRE compacta + Top 5 Categorias (donut Recharts). Componentes:
1. `MiniDRE.tsx` — 5 linhas comprimidas (Receita Bruta, Deduções, Lucro Bruto, EBITDA, Lucro Líquido) com comparação mês anterior
2. `TopCategories.tsx` — donut chart Recharts com top 5 categorias de despesa do mês corrente
3. Queries em `lib/dashboard/queries.ts` reusando engines existentes
4. Layout: linha abaixo do Hero Strip, 2 colunas (50%/50%)

### 11/05/2026 (parte 6) — Sprint 1 Dia 2: Mini-DRE + Top 5 Despesas

**Contexto:** continuação do Sprint 1 Dashboard Mundial. Dia 1 entregou Hero Strip; Dia 2 adiciona a linha de detalhamento abaixo (Mini-DRE + Top Categorias). Decisão de produto importante feita junto com Yussef: **renomear "EBITDA" pra "Resultado Operacional"** — honestidade técnica (engine não calcula D&A separadamente, então usar "EBITDA" seria impreciso).

**O que foi feito (commit `8e61263`, 10 arquivos, +933/-3 linhas):**

Funções puras (lib/dashboard/):
- `compute-mini-dre.ts` — extrai 5 linhas de `DRETotals` + calcula deltas com semântica por linha (receita ↑ é bom, deduções ↑ é ruim)
- `compute-top-categories.ts` — filtra dreGroup de despesa (CUSTO_*, DESPESAS_*, OUTRAS_DESPESAS, IMPOSTOS), ordena, aplica paleta fixa

Queries server-side:
- `getMiniDRE(companyId)` — chama `calculateDRE` 2x (mês atual + anterior), `unstable_cache` 60s, tag `dashboard:${companyId}`
- `getTopCategories(companyId)` — Prisma `groupBy` com `take: 20` + fetch metadata + filtra despesas + slice 5

UI (app/(dashboard)/dashboard/_components/):
- `MiniDRE.tsx` — Server, 5 linhas com deltas coloridos, Lucro Líquido em card destacado (`bg-primary/5 border-primary/20`)
- `TopCategories.tsx` — Server orquestrador, layout flex (donut 120px + lista vertical), empty state amigável
- `TopCategoriesDonut.tsx` — Client, Recharts `PieChart` com `Cell` colorido
- `TopCategoriesChart.tsx` — **Wrapper Client** que isola `dynamic({ssr:false})` (necessário por bug Next 16 — ver abaixo)

Página integrada:
- `dashboard/page.tsx` — Hero Strip + grid 2 colunas `lg:grid-cols-2 gap-6` com Mini-DRE | Top Categories, ambos em Suspense com CardSkeleton

**🐛 Bug Next 16 detectado e resolvido in-session:**
Erro 500 inicial: `next/dynamic` com `ssr: false` **NÃO é permitido em Server Components** no Next 16 ("Please move it into a Client Component"). Solução idiomática: criar wrapper `'use client'` (`TopCategoriesChart.tsx`) que faz o dynamic, e o Server Component (`TopCategories.tsx`) importa o wrapper. 1 arquivo extra mas é o padrão idiomático Next 16. **Documentado nos comentários do wrapper pra futuros casos.**

**Decisões técnicas/produto registradas:**
- **"Resultado Operacional" em vez de "EBITDA"**: usa `totals.resultadoOperacional` (`lucroBruto + outrasReceitas - despesasOperacionais`). EBITDA real exige D&A (depreciação/amortização). Quando engine algum dia separar D&A, aí sim mostra "EBITDA". Honestidade técnica > buzz word.
- **Cores fixas no Top 5** (#185FA5, #1D9E75, #EF9F27, #E24B4A, #6B7280) — ignora `category.color` do banco pra consistência visual. Dashboard = visualização de DADOS; páginas de gestão = visualização de IDENTIDADE (usa category.color lá).
- **Mini-DRE rodando `calculateDRE` 2x**: 1ª pra mês atual, 2ª pra mês anterior. Tradeoff aceito pra MVP (cache 60s mitiga). Refactor futuro pode compartilhar tx do Hero Strip.
- **Semântica de delta por linha**: receita/lucros ↑ é "up" (verde); deduções ↑ é "down" (vermelho). Frio matemático ≠ leitura humana.

**Cenários cobertos em testes:**
- Mini-DRE: deltas com previous=0 → percent null + direction calculável; TRANSFER não infla (testado via engine que já filtra); margem líquida copiada
- Top Categories: limite 5 com 8 candidatos; ignora RECEITA_BRUTA e DISTRIBUICAO_LUCROS; ignora categoria órfã; cores nos índices 0-4; percent relativo ao total das top; empty → array vazio

**Métricas:**
- **25 testes novos** (13 mini-dre + 12 top-categories)
- **927/927 testes passando** (era 902 — excedeu estimativa de 916)
- TypeScript strict: 0 erros
- Smoke test: 1ª call 451ms, 2ª call **40ms** (cache hit confirmado)
- HTML output: +38KB vs Dia 1 (Mini-DRE + Donut SVG + lista)

**Próximo passo:** **Sprint 1 Dia 4** — Saúde Financeira:
1. Card de Burn Rate (despesas mensais médias 3-6 meses)
2. Runway (meses até zerar caixa: saldo / burn rate)
3. Liquidez (ativos líquidos / passivos curtos — placeholder enquanto não temos passivos)
4. Margem operacional vs target (gauge ou barra)
5. Reusar `calculateConsolidatedCashflow` (Sprint 0.5) pra histórico

Dia 3 fica **livre** porque os escopos planejados (Mini-DRE e Top 5) já foram entregues juntos no Dia 2. Yussef decide se pula direto pro Dia 4 ou usa o Dia 3 pra polimento/testes adicionais.

### 11/05/2026 (parte 7) — Sprint 1 Dia 4: Saúde Financeira

**Contexto:** com Hero Strip (Dia 1) + Mini-DRE/Top 5 (Dia 2) entregues, o Dashboard ganha hoje a camada estratégica de "Como minha empresa está?". 4 indicadores de saúde financeira num único Card abaixo dos detalhes.

**Decisões de produto significativas:**

1. **Liquidez Corrente substituída por "Variação 30 dias"** — Sem AP/AR no schema atual (Sprint 0.5 não cobriu), calcular liquidez clássica seria matematicamente possível mas conceitualmente errado. Honestidade técnica > buzz word: variação 30d é o indicador REAL que conseguimos com dados disponíveis. Liquidez volta quando FASE 6+ implementar contas a pagar/receber.

2. **Burn Rate comparado vs RECEITA média (não baseline histórico)** — Comparação histórica isolada esconde o cenário "margem zero = morte lenta" (burn cresce proporcionalmente à receita mas margem fica zero). Threshold sustainability-first: ≤70% receita = Saudável; 70-90% = Atenção; >90% = Crítico.

3. **Runway INCLUI cheque especial** — Crítico pro caso real Yussef: Banrisul tem 600k de cheque especial. Sem incluir, conta legitimamente negativa (-550k) com burn 10k/mês daria Runway 0 (falso alarme). Fórmula real: `available = saldo + creditLimit (onde allowNegativeBalance=true)`. Subtext "Incluindo cheque especial" pra transparência.

4. **Threshold margem ajustado pra PME BR (20%, não 30%)** — Academia típica fica 15-25%, restaurante 8-15%, loja 10-20%. 30% é meta de unicórnio SaaS. Por setor fica como melhoria Sprint 2+.

5. **Cap Runway 24 meses → "Mais de 2 anos"** — Wording mais natural em pt-BR que "24+ meses". Acima do cap, mostra a frase + status Excelente + subtext "Reserva confortável".

6. **Empty state com progresso** — `<3 meses de burnHistory` → status "Acumulando dados (X/3 meses)" em vez de só "—". User entende quanto falta + cria expectativa positiva.

**O que foi feito (commit `4fd7f43`, 6 arquivos, +1049/-1 linhas):**

Função pura:
- `lib/dashboard/compute-health.ts` — 4 indicadores com thresholds dedicados + `progressPercent` pra barra visual + `subtext` pra info adicional. ID estável (`burn-rate`, `runway`, `variation-30d`, `margin`) pra React keys

Query server-side:
- `getHealthCheck(companyId)` em `lib/dashboard/queries.ts` — 5 queries paralelas (contas com flags, categorias DRE, 3 buckets de burn, net 30d, mês atual pra margem), `unstable_cache` 60s + tag `dashboard:${companyId}`. Reuso de `calculateConsolidatedCashflow` (Sprint 0.5 Dia 3) + `calculateDRE`. Bonus: removido import duplicado de `CashflowTransaction` no arquivo

UI:
- `HealthCheck.tsx` — Server orquestrador. Card único com `<Activity />` icon + título + grid 2×2 mobile / 1×4 desktop
- `HealthIndicator.tsx` — Client com Framer Motion stagger 50ms. Status dot colorido + label CAPS + valor grande + progress bar opcional + status label + subtext

Página integrada:
- `dashboard/page.tsx` — `<HealthCheck>` em Suspense full width abaixo do grid Mini-DRE/Top Categories

**Smoke test com cenário REAL Yussef:**
Banrisul cheque 600k, saldo seed 60k, 3 meses anteriores (50k receita + 35k despesa = burn 70%), mês atual (40k receita + 25k despesa = margem 37.5%):
- Burn: R$ 35k → 🟢 Saudável (70% da receita)
- Runway: 18.9 meses → 🟢 Saudável + subtext "Incluindo cheque especial"
- Variação 30d: +R$ 15k → 🟢 Subindo
- Margem: 37.5% → 🟢 Saudável

**Métricas:**
- **24 testes novos** (excedeu estimativa de 15) cobrindo todos os edges
- **951/951 testes passando** (era 927)
- TypeScript strict: 0 erros
- 1ª call: 467ms | 2ª call: **44ms** (cache hit)
- Subtext "Incluindo cheque especial" empiricamente validado no DOM

**Próximo passo:** **Sprint 1 Dia 5** — fechamento do Sprint 1:
1. Recent Activity timeline (últimas N transações + transferências, agrupado por data)
2. Polimento geral: revisar animações, dark mode, mobile responsive
3. Smoke test integrado de TODOS os componentes do Dashboard
4. Documentação final do Sprint 1
5. Marco Sprint 1 fechado → preparar Sprint 2 (Cashflow Waterfall + AI Insights)

### 11/05/2026 (parte 8) — 🏁 FECHAMENTO HISTÓRICO: Sprint 0.5 + Sprint 1 numa única sessão

**Marca da sessão:** maior dia de progresso da branch desde o início. **Sprint 0.5 (transferências/saldo/engines) + Sprint 1 (Dashboard Mundial)** entregues do zero em 1 sessão única de 11/05/2026.

**Sprint 1 Dia 5 (commit `f3e08df`, 7 arquivos, +475 linhas):**
- `lib/dashboard/format-activity-date.ts` — função PURA com formatação relativa pt-BR (Hoje/Ontem/Há X dias/DD/MM/DD/MM/YYYY)
- `app/(dashboard)/dashboard/_components/RecentActivity.tsx` — timeline 10 últimas tx, avatar semântico CREDIT/DEBIT, click → editar tx
- `app/(dashboard)/dashboard/_components/PendingClassification.tsx` — CTA sutil + estado celebração "🎉 Tudo classificado!"
- `lib/dashboard/queries.ts` — `getRecentActivity` + `getPendingCount` com cache 60s
- `dashboard/page.tsx` — grid 60/40 final (Recent | Pendentes) em Suspense
- `docs/DASHBOARD-PLAN.md` — seção "🏆 SPRINT 1 CONCLUÍDO" com tabela, tree de componentes, métricas, 10 decisões de produto
- 10 testes novos (`__tests__/dashboard-format-activity-date.test.ts`)

**Decisões finais do Sprint 1 (Dia 5):**
- Avatar por TIPO (CREDIT verde / DEBIT vermelho) — semântico instantâneo. Categoria fica em badge ao lado.
- Datas relativas até 7 dias (Mercury/Brex pattern). Acima disso: DD/MM.
- Click leva pra `/empresas/[id]/contas/[contaId]/transacoes/[id]/editar` (90% dos casos user quer corrigir).
- Visual Pendentes SUTIL (`border-primary/20 bg-primary/5`) — sem competir com gradient do KPI Resultado.
- Estado 0 pendentes: emoji 🎉 + "Tudo classificado! Você está em dia." — humano brasileiro.
- Dashboard sem breadcrumb (é rota raiz).

**Estatísticas históricas do dia 11/05/2026:**

| Métrica | Valor |
|---|---|
| Início do dia | 709 testes, branch limpa após sprint 0.5 planejamento |
| Fim do dia | **961 testes** (+252 testes, +35.5%) |
| Sprint 0.5 | 4 commits feat + 4 commits docs (8 total) |
| Sprint 1 | 4 commits feat + 5 commits docs (9 total) |
| **Total commits do dia** | **17 commits** (acima dos 4 anteriores ao dia = ~21 ahead de main) |
| Tempo planejado original (Sprint 0.5 + Sprint 1) | ~2 semanas |
| Tempo real entregue | **1 dia (11/05/2026)** |
| TypeScript strict no fim do dia | ✅ 0 erros |
| Multi-tenant guards em todas as funções puras | ✅ |
| Performance dashboard (cache hit) | 40-60ms validado empiricamente |

**Componentes em produção (Dashboard Mundial completo):**
- Hero Strip: 4 KPI cards + sparklines Recharts
- Mini-DRE: 5 linhas + Lucro Líquido destacado + link "Ver DRE completa"
- Top 5 Despesas: donut 120px + lista vertical + cores fixas
- Saúde Financeira: Burn, Runway (com cheque especial), Variação 30d, Margem
- Recent Activity: timeline 10 tx + avatar semântico + datas relativas
- Pendentes Classification: CTA sutil + celebration state

**Lib engines reusados em todo o Dashboard:**
- `calculateDRE` (Sprint 0.5 Dia 2-3) → Hero, Mini-DRE, Margem
- `calculateConsolidatedCashflow` (Sprint 0.5 Dia 3) → Sparklines, Burn, Variação 30d
- `lib/balance/*` (Sprint 0.5 Dia 3) → potencial uso futuro pra projeções
- `lib/dashboard/period.ts` → derivePeriods compartilhado

**Próximo passo:** **Sprint 2 — Diferenciais** (DASHBOARD-PLAN.md seção C.5):
1. **Cashflow Waterfall** — gráfico Recharts custom (saldo inicial → entradas → saídas → saldo final) com drill-down ao clicar nas barras
2. **AI Insights** ⭐ (DIFERENCIAL CHAVE) — endpoint `/api/dashboard/insights` com Claude Haiku + RAG das últimas 100 tx + regras aprendidas + tendências do DRE. 4 tipos de insight: alerta, oportunidade, sugestão, parabéns. Cache 1h.
3. **Recent Activity + Pending CTA** (já entregues no Sprint 1)
4. **Company Selector multi-modo** — 3 modos: única (atual) / consolidado (todas empresas somadas) / comparativo (lado a lado)

**Marco final do dia:** Conta IA tem agora um Dashboard Mundial visualmente competitivo com Brex/Mercury/Ramp + base de cálculo financeiro testada multi-tenant + transferências entre contas robustas + safety net pra deploy. Próxima sessão pode focar 100% nos diferenciais (Cashflow Waterfall + AI Insights) que fecham o gap conceitual vs Conta Azul.

### 23/05/2026 — Sprint 3.0.4 (Polimento Pro): C1+C2+C3+C4 numa sessão

**Contexto:** Sprint 3.0.3 (Edição Power) já em produção e estável. Sprint
3.0.4 é o "polimento operacional" — features que aceleram o dia-a-dia de
Yussef classificando transações em escala.

**O que foi feito (4 commits feat + 1 docs):**

- `e05dd54` — **C1 Export CSV**. Botão "Exportar" no header de `/transacoes`
  baixa CSV (BOM UTF-8 + RFC 4180) abrindo direto no Excel BR. Reusa os
  MESMOS filtros aplicados (tipo, status, categoria, busca, valores,
  datas, conta, importId). Endpoint novo `GET /api/empresas/[id]/transacoes/export`
  com cap 10k linhas e RBAC. Filename slug normalizado (acentos removidos,
  cap 40 chars, fallback "export"). 11 colunas em pt-BR. 15 testes.

- `3bfe328` — **C2 Atalhos teclado**. J/K navegação (com scroll smooth +
  ring visual azul), / focar busca, Esc desfoca/fecha, Espaço seleciona,
  Cmd+A select all, E edita, C abre dropdown categoria, X ignora, Enter
  concilia, ? abre modal de ajuda. Hook `useKeyboardShortcuts` document-level
  com função pura `matchShortcut()` testável; ignora foco em inputs EXCETO
  safeInInputs (Esc, ?). Cross-platform Cmd/Ctrl. 17 testes.

- `06ea25b` — **C3 Preview regra ao vivo**. No modal de editar regra,
  enquanto digita padrão / tipoMatch, mostra contador "X pendentes seriam
  classificadas" + 5 amostras (debounce 300ms). Endpoint `POST /regras/preview`
  com janela 5000 tx PENDING (excluindo as já classificadas pela própria
  regra via `excludeRuleId`). Função pura `txMatchesRegra` reusa
  `normalizeExact`/`normalizeDescription` do `ai-categorizer/normalize.ts`
  pra garantir consistência com pipeline real. 21 testes (4 tipos de match).

- `939f00d` — **C4 URL persistente completa**. TODOS os filtros agora
  refletidos no querystring (state → URL via `router.replace` com
  `scroll: false`). Links shareable, back/forward funciona, refresh
  preserva contexto. Parser extendido com `status` (enum), `contaId` (cuid),
  `page` (int 1-10000). Builder novo `buildTransacoesURLParams()` omite
  defaults pra URL limpa. Valores DEBOUNCED (q, valorMin, valorMax) só
  comitam após user parar de digitar. 18 testes incluindo round-trip
  build→parse.

**Decisões técnicas notáveis:**
- C1: filename slug usa NFD + UTC dates (bug pego em teste: `new Date('2026-05-23')`
  parseado como UTC, mas `.getMonth()` retorna BRT-3 → filename ficava com
  data do dia anterior).
- C2: `isTypingTarget` duck-typed (procura `tagName` + `isContentEditable`)
  pra ser testável em vitest com env `node` sem precisar de jsdom.
- C3: `excludeRuleId` no preview é crítico — sem ele, editar uma regra
  existente mostraria zero pendentes (já estavam todas classificadas pela
  própria regra).
- C4: `router.replace` (não `push`) e `scroll: false` impedem poluir
  histórico do navegador e scrollar pro topo a cada keystroke.

**Métricas:**
- Suite testes: **1596 → 1667 (+71 testes, +4.4%)** sem regressões
- TypeScript strict: 0 erros · `npm run build`: ✓ Compiled successfully
- 4 commits feat: `e05dd54` · `3bfe328` · `06ea25b` · `939f00d`
- 5 libs novas + 2 endpoints + 2 componentes + 4 arquivos de teste
- Sem migrations — sprint puramente código
- Documentação completa em `docs/SPRINT-3.0.4-POLIMENTO-PRO.md`

**Próximo passo:**
1. `git push origin main`
2. Deploy prod (PM2 reload, sem migration)
3. Yussef smoke test: Exportar CSV / `?` modal atalhos / J-K nav /
   preview regra / refresh URL preserva filtros
4. Próximo sprint: Sprint 3.0.5 (a planejar) ou pular pra FASE 6
   (Relatórios PDF — DRE + DFC + Conciliação)

### 27/05/2026 — Hotfix 5.0.4.0a-fix + Sprint 5.0.4.0b DEEP DIVE

**Contexto:** sessão dupla — primeiro um hotfix da Sprint 5.0.4.0a (DoD
falhado), depois Sprint 5.0.4.0b inteira em sequência única.

#### Hotfix 5.0.4.0a-fix (commit `d5c5a0c`, merge `83997b9`)

Yussef testou Sprint 5.0.4.0a em prod e detectou 2 DoD items declarados
✅ que estavam FALSOS:
- Sidebar AINDA tinha "DRE Gerencial" antigo
- DRE antigo abria sem redirect 301

**Causa raiz:** eu editei `components/layout/sidebar.tsx` quando o sidebar
real do app é `components/sidebar/global-sidebar.tsx` (TopBar Sprint
4.0.5.a). Como nunca abri o app no browser, não vi que tava no arquivo
errado. Marquei DoD baseado em "código foi escrito" em vez de "código
foi validado visualmente".

**Fix completo:**
- `global-sidebar.tsx`: removido item TrendingUp "DRE Gerencial" → /dre;
  adicionado BarChart3 "Relatórios" com href per-empresa
  (`/empresas/${currentEmpresaId}/relatorios` quando há empresa no
  contexto, fallback `/relatorios` cookie-based)
- `next.config.mjs`: redirects 301 explícitos pra `/empresas/:id/dre` +
  `/empresas/:id/dre-gerencial` (Next default seria 308 com
  `permanent:true`; forçado `statusCode: 301` conforme spec)
- `MiniDRE.tsx` + `AIInsights.tsx`: 4 URLs `/dre` atualizadas pra
  `/empresas/${companyId}/relatorios/dre-gerencial`
- `app/(dashboard)/empresas/[id]/dre/page.tsx` DELETADO (next.config
  pega antes do file system routing, 1 hop em vez de cadeia de 2)
- `CLAUDE.md`: nova seção "🚨 Anti-padrão detectado em Sprint 5.0.4.0a"
  com regra reforçada "Código escrito ≠ DoD cumprido" + workflow visual
  obrigatório + protocolo pra quando não tenho browser

**Validação:** curl em dev local + prod confirmou HTTP 301 explícito.

#### Sprint 5.0.4.0b DEEP DIVE (merge `22ad9d6`, 4 commits)

**Pedido do Yussef:** transformar `/relatorios` de MVP (3 cards iguais)
em world-class Pilot.com/Ramp/Mercury (hero gradient + cards com dados
reais embutidos + roadmap visual) + entregar 3 relatórios novos.

**Auditoria pré-execução** (commit `dc535be`):
- Backup `/var/backups/conta-ia/pre-5.0.4.0b-20260527_214933.dump` (553K)
- Recharts 3.8.1 + Framer Motion 12.38.0 já instalados
- Employee.tipo já é String — **sem migration**
- Cacula tem só 4 meses de dados — sparkline adaptativo (3-12m) em vez
  de 12m fixo
- profit itaqui zerado — empty states graciosos necessários
- 10 libs reusáveis mapeadas (zero engine novo)

**Fase 2** (commit `1b0c2cf`): Redesign `/relatorios`
- `lib/relatorios/preview-queries.ts` (548 linhas, 6 funções server +
  orquestrador paralelo) com cache 60s tag `relatorios:${empresaId}`
- 7 componentes novos em `components/relatorios/`: HeroCard (gradient
  slate-900→blue-900, sparkline Recharts AreaChart, 3 mini-stats),
  HeroSparkline + Wrapper (dynamic ssr:false pro Next 16),
  MiniSparkline + Wrapper, ReportPreviewCard (reusável tipado com
  tones semânticos), FutureReportCard (opacity-60 + sprint badge)
- Page.tsx reescrita: Hero + Visão Geral (6 cards) + Análises
  Inteligentes (3 future Sprint 0c) + Deve chegar depois (3 bullets 0d)

**Fases 3-5** (commit `e81efaa`):
- **Fluxo Caixa** (`/relatorios/fluxo-caixa`): `lib/cash-flow.ts` com
  `computeCashFlowProjection` (30/60/90 cumulativo) +
  `computeAccumulatedBalance`. Endpoint reusa
  `calculateConsolidatedCashflow` (Sprint 0.5). UI com 4 stats +
  CashFlowChart (Recharts ComposedChart 2 Bar + Line) + tabela projeção
- **Fornecedores** (`/relatorios/fornecedores`): `lib/top-suppliers.ts`
  com trendIndicator simplificado (NEW/UP/DOWN_STRONG/etc) +
  concentracaoTop5. UI com top 10 + trend visual + barra concentração
  com warning > 60%
- **Folha** (`/relatorios/funcionarios`): `lib/payroll.ts` com
  breakdown por tipo (CLT/ESTAGIO/PJ/AUTONOMO/OUTRO). UI com badges
  coloridos + tabela detalhada + flag inativo

**Decisão de produto registrada:**
- Drill-down modal lateral fica pro backlog Sprint 5.0.4.0d (junto com
  Export PDF). Tabela atual + filtros + hover row são suficientes pra
  MVP. Yussef aprovou.

**Checkpoint após Fase 2:** deploy parcial feature branch em prod,
Yussef validou visualmente, aprovou pra seguir Fases 3-5.

**Métricas finais:**
- Tests: **3136 → 3192 (+56)** ✓ atingiu alvo +50 da spec
- TypeScript strict: 0 erros
- Build: ✓ 4.2s
- 4 commits feat + 1 audit + 1 merge = 6 commits totais
- Sem migration · backup pré-sprint salvo
- pm2 ↺ 138 online

**6 rotas de relatórios funcionais em prod:**
- /relatorios/dre-gerencial (5.0.4.0a)
- /relatorios/categorias (5.0.4.0a)
- /relatorios/comparativo (5.0.4.0a)
- /relatorios/fluxo-caixa (5.0.4.0b NOVO)
- /relatorios/fornecedores (5.0.4.0b NOVO)
- /relatorios/funcionarios (5.0.4.0b NOVO)

Branch `feature/sprint-5.0.4.0b-deep-dive-redesign` ENTREGUE em prod
via merge no main. Pode ser deletada (mantida no remote pra histórico).

**Próximo passo:** Sprint 5.0.4.0c1 — Variâncias + IA narrativa
(aguardando prompt do Yussef).

### 27-28/05/2026 — Sprint 5.0.4.0c1 + 2 hotfixes (sessão maratona)

**Contexto:** sessão única e longa cobrindo a entrega da Sprint
5.0.4.0c1 INTELIGÊNCIA + 2 hotfixes consecutivos. Tudo validado em prod
por Yussef ao fim.

#### 1) Sprint 5.0.4.0c1 — Variâncias + IA narrativa (Sonnet 4.6)

**Diferencial competitivo entregue:** detecção automática de variâncias
(que Conta Azul/Omie/Bling não têm) + insights narrativos em PT-BR
informal via Claude Sonnet 4.6.

**Algoritmo de variâncias** (`lib/variance/detect-variances.ts`):
- 9 levels: NEW / CRITICAL_UP (>+50%) / HIGH_UP / MODERATE_UP / STABLE
  (filtrado) / MODERATE_DOWN / HIGH_DOWN / CRITICAL_DOWN / DISAPPEARED
- Materiality filter R$ 500 (env `VARIANCE_MIN_ABSOLUTE_VALUE`)
- Ordena por severidade DESC + |variationAbs| DESC

**Rota `/relatorios/variancias`**: 4 stats cards + 5 seções agrupadas
(🚨/⚠️/✨ novidades/📊 moderadas/🛑 sumiram) + cards com cores
semânticas + visual SVG.

**Claude API integration** (DECISÃO IMPORTANTE: NÃO instalar
`@anthropic-ai/sdk` — seguir padrão `lib/ai-categorizer/claude-client.ts`
com fetch direto). Stack:
- `lib/ai/insights-client.ts` (fetch direto, fetcher injetável)
- `lib/ai/prompts/monthly-insights.ts` (SYSTEM_PROMPT PT-BR informal)
- `lib/ai/insights-cache.ts` (DB-based, NÃO Redis — projeto não tem)
- `lib/ai/collect-insight-data.ts` (orquestra DRE + variâncias + top cat)
- Migration `AiInsightsLog` (separada do `AiUsageLog` do Haiku)

**Custo real em prod:** ~$0.022 USD = R$ 0,11/análise · 20-25s · 1500
input + 1100 output tokens. Cache 1h via DB.

**UI inicial** (depois movida em 5.0.4.0c1-fix): card `AIInsightsCard`
inline na `/relatorios` com 4 estados (idle/loading/success/error).

**Checkpoint do dia:** Yussef validou qualidade do JSON gerado pela IA
antes de eu construir UI — output PT-BR natural, perguntas práticas,
sem invenção de dados.

**Métricas:** Tests 3192 → 3236 (+44). TS strict 0. Migration aplicada.

Commits: `dc535be` (audit), `7f56fa4` (impl), merge `9d8709e`, fix
migration `d0b96d8`.

#### 2) Hotfix 5.0.4.0c1-fix — Arquitetura + Períodos

**2 problemas Yussef detectou em prod:**

1. **Arquitetural**: Análise IA aparecia INLINE em `/relatorios`
   poluindo a tela. Padrão CAIXAOS é "página dedicada por relatório".
2. **Períodos hardcoded**: análise só fazia "mês atual vs anterior".
   Yussef queria 7 presets + custom datas (limite 12 meses).

**Decisão técnica chave:** repurpose dos campos `currentPeriod`/
`basePeriod` (TEXT YYYY-MM) como ISO YYYY-MM-DD (start dates) — `2026-05`
parseia compativelmente como `2026-05-01`. Adiciona 3 campos novos
(`currentEndPeriod`, `baseEndPeriod`, `mode`) em vez de 5 colunas DATE
do zero. Zero breaking change em logs antigos.

**Modo automático** (transparente pro usuário):
- `comparative`: 2 períodos com `compareStartDate`
- `evolution`: período principal >= 3 meses sem compare
- `single`: < 3 meses sem compare

**1 system prompt único** (não 3 separados) com regras por modo. Shape
`InsightOutput` consistente. Adicionar 4º modo no futuro = adicionar
regra no mesmo prompt.

**`lib/dates/period-presets.ts`** (NÃO instalar date-fns — helpers
nativos UTC consistentes com o projeto):
- 7 presets (month-vs-prev, month-vs-yoy, quarter-vs-prev, year-vs-prev,
  last-3m, last-6m, last-12m)
- `inferMode()` + `validatePeriodLimit()` (12m max)

**Nova rota `/relatorios/analise-ia`**: PeriodSelector com 7 presets +
toggle custom + date pickers + validação inline + botão "Gerar análise"
com cost estimate. Reusa `AnalysisDisplay` extraído.

**Card preview** em `/relatorios` substitui render inline. Mostra
última análise (ou estado vazio).

**Checkpoint do dia:** Yussef validou os 3 outputs distintos (compar/
evol/single) em prod com Claude real antes de UI.

**Métricas:** Tests 3236 → 3276 (+40). Migration ALTER TABLE 3 colunas
aplicada. `AIInsightsCard.tsx` antigo deletado (código morto após
extrair `AnalysisDisplay`).

Commits: `dd105d3` (audit), `8c43c81` (impl), merge `65824c7`.

#### 3) Bug-fix LIFECYCLE PAYABLE+paymentDate (causa raiz histórica)

**Contexto:** Yussef testou Análise IA da `profit sao borja` e a IA
disse "despesas zeradas" — MAS tinha 398 contas pagas (R$ 757k) em
`/contas-a-pagar`. Contradição grave.

**Investigação SQL profunda** revelou:
- 398 contas PAYABLE + paymentDate + categoryId + dreGroup populados
- Estado VIOLA `lib/lifecycle/index.ts:60-69` ("PAYABLE/RECEIVABLE NÃO
  podem ter paymentDate") — `validateLifecycleState` retornaria
  inválido pras 398
- 24 ocorrências em 5 arquivos filtram `lifecycle='EFFECTED'` nos
  relatórios → 398 invisíveis

**Universo total afetado:**
- profit sao borja: 398 contas / R$ 757.499,35
- **cacula mix: 94 contas / R$ 182.396,54** (Yussef pensou que cacula
  funcionava, mas ela tinha 287 EFFECTED via OFX R$ 611k mascarando
  o bug das 94 Excel)
- TOTAL: **492 contas / R$ 939.895,89 invisíveis nos relatórios**

**Causa raiz (2 paths que corrompiam lifecycle):**
1. `confirm/route.ts:238` (import Excel) hardcodava `lifecycle: 'PAYABLE'`
   mesmo quando Excel vinha com paymentDate (compras pagas no passado)
2. `bulk/route.ts:121-129` (mark_paid) setava paymentDate sem
   transicionar `PAYABLE → EFFECTED`

**Auditoria extra confirmou que outros 3 paths estão corretos:**
- staging/confirm (OFX) — default schema `'EFFECTED'`
- ajustar-saldo — default `'EFFECTED'`
- conciliacao/reconcile — transiciona explícito (Sprint 4.0.1.a)

**5 fixes aplicados:**

| Fix | O que mudou |
|---|---|
| A1 | Import Excel: `lifecycle: isPaid ? 'EFFECTED' : 'PAYABLE'` |
| A2 | `mark_paid` bulk: adiciona `lifecycle: 'EFFECTED'` no updateMany |
| B | Migration backfill `20260610000000`: 492 contas viraram EFFECTED (critério reconciledWithId=null pra evitar dupla contagem OFX) |
| C | Listagem `/contas-a-pagar` estendida pra incluir EFFECTED com dueDate (preserva visibilidade das pagas) |
| D | Helper `lib/contas-pagar/lifecycle-scope.ts` + edit/delete/duplicar/inline aceitam EFFECTED-que-eram-PAYABLE |

**Lição de produto registrada** (aplicada nos próximos imports):
- `lifecycle` representa estado financeiro (intenção vs realizado)
- `paymentDate` em PAYABLE/RECEIVABLE é estado **inválido** (lib doc)
- Toda transição deve ser explícita: PAYABLE/RECEIVABLE → EFFECTED via
  conciliação OFX, mark_paid, OU import Excel com pagamento já feito

**Validação Yussef em prod (5/5 caminhos OK):**
1. `/profit/relatorios` → Hero mostra despesas reais
2. `/profit/relatorios/analise-ia` → IA agora vê R$ 757k
3. `/cacula/relatorios` → DRE +R$ 182k que estavam invisíveis
4. `/contas-a-pagar?empresaId=profit` → 398 pagas continuam visíveis
5. Edit/duplicar contas pagas funciona

**Métricas:** Tests 3276 → 3305 (+29) · 0 violações remanescentes ·
backup pré-fix 573K · pm2 ↺ 145.

Commits: `406d09e` (audit), `24f83c1` (A1+A2+B), `d2182fe` (merge),
`d814e6e` (fix C), `5200a36` (fix D).

#### Estatística histórica da sessão

| Item | Valor |
|---|---|
| Duração | 27-28/05/2026 (sessão única longa) |
| Sprints/hotfixes | 3 |
| Migrations aplicadas | 2 (`ai_insights_log` + `bugfix_payable_paymentdate`) |
| Testes adicionados | +113 (3192 → 3305) |
| Commits totais | 13 |
| pm2 restart final | ↺ 145 |
| Contas restauradas pro DRE | 492 (R$ 939.895,89) |
| Limitação visual declarada | Sem browser → Yussef validou 5+ caminhos em prod |

**Próximo passo:** aguardando próximo prompt do Yussef.

### 31/05/2026 — Sprint Gestão de Conta (admin + autoatendimento + force-change senha)

**Contexto:** auditoria do dia 30/05 mostrou 2 lados pendentes — admin gerenciar
contas dos clientes (placeholder `comingSoon` em `/admin/clientes`) e
autoatendimento (cliente editar perfil/senha/excluir própria conta). Sprint
entregue em 1 sessão com Fase 1 (auditoria + aprovação) → Fase 2 Parte A
(admin) → checkpoint Yussef → Parte B+C (autoatendimento + force change) →
deploy + smoke 6/6 ✓.

**Doc completo de auditoria:** `docs/sprints/gestao-conta-audit.md` (commit
`6ead5dc`) — mapa de FK do User, riscos LGPD, algoritmo cascade em 7 passos.

**O que foi entregue:**

🏛️ **Schema + migração** (commit `1630727`, deploy `0UfOfVeQr8Ydmg7yIP99K`):
- `User.mustChangePassword Boolean @default(false)` — migration aditiva
  `20260531000000_gestao_conta_must_change_password`
- Backup prod salvo: `pre-gestao-conta-20260531_212016.dump` (582KB)
- Coluna confirmada no `information_schema` pós-deploy

🛡️ **Cascade da exclusão** (`lib/admin-clientes/delete-user-cascade.ts`):
Algoritmo §2.3 atomic em 7 passos via `prisma.$transaction`:
1. Identifica companies onde user é único dono (preserva multi-dono)
2. `UPDATE OfxImport SET revertedById=null` (FK Restrict)
3. `UPDATE CompanyTaxProfile SET createdById=null` (FK Restrict)
4. `DELETE RecurringSchedule WHERE createdById=:userId` (FK Restrict)
5. `DELETE Company` cascade massivo (BankAccount → Transaction, Category,
   Supplier, Customer, AiLearningRule, Role custom, AuditLog scoped, etc)
6. `DELETE User` (cascade restante: SavedView, UserCompany, UserCompanyRole,
   AiUsageLog, AiInsightsLog, CouponRedemption, PasswordResetCode)
7. `AuditLog.userId` + `CategoryHistory.userId` viram NULL via SetNull
   (preserva histórico anonimizado pra LGPD/fiscal)

Retorna snapshot completo pro audit log (companies deletadas vs preservadas
+ counts dos updates Restrict). Reusado pela exclusão admin **E** pela
exclusão autoatendimento.

🔑 **Senha temporária** (`lib/admin-clientes/generate-temp-password.ts`):
16 chars com garantia de 4 classes (uppercase + lowercase + digit + symbol).
Sem chars confusos (I/O/l/0/1). Fisher-Yates shuffle pra entropia real.
Crypto-secure via `crypto.randomBytes`.

🔐 **Re-auth do Gerenciador** (`lib/admin-clientes/re-auth.ts`):
bcrypt.compare da senha do Gerenciador + rate-limit 3 tentativas / 15min
por (gerenciadorId, action). Exigido em todas as 3 ações sensíveis.

🛂 **PARTE A — `/admin/clientes` (admin)**

Endpoints REST:
- `GET  /api/admin/clientes` — list paginado + busca name/email
- `GET  /api/admin/clientes/[userId]` — detalhe + counts agregados
- `POST /api/admin/clientes/[userId]/reset-password` — OPERADOR+OWNER
- `PATCH /api/admin/clientes/[userId]/email` — OPERADOR+OWNER + UNICIDADE 409
- `DELETE /api/admin/clientes/[userId]` — 🚨 **OWNER ONLY** (403 pra
  OPERADOR com `code: 'FORBIDDEN_RBAC'`)

UI dark Linear-like coerente com `/admin/cupons`:
- Lista com busca, paginação, badge "Troca pendente"
- Detalhe com 4 stats + 3 cards de ação
- Card "Excluir" **RBAC-aware**: pra OPERADOR mostra "Apenas gerenciadores
  OWNER. Você é OPERADOR." e botão disabled
- `TempPasswordRevealModal` — auto-copy clipboard + countdown 60s + auto-close
- Sidebar admin: "Clientes" `comingSoon` REMOVIDO

3 audit actions novas no `GerenciadorAuditLog`:
- `ADMIN_RESET_USER_PASSWORD`
- `ADMIN_CHANGE_USER_EMAIL` (metadata `{oldEmail, newEmail}`)
- `ADMIN_DELETE_USER` (metadata snapshot completo do cascade)

👤 **PARTE B — `/minha-conta` (autoatendimento)**

Multi-tenant rígido: TODOS endpoints `/me/*` usam `session.sub` do JWT, NUNCA
aceitam `userId` no body — smuggle é ignorado pelo Zod schema.

- `PATCH /api/auth/me/perfil` — só nome (email exige verificação futura)
- `POST  /api/auth/me/change-password` — **2 fluxos no mesmo endpoint**:
  - Autoatendimento (`mustChangePassword=false`): exige `currentPassword`
    + `novaSenha`, bcrypt.compare na atual
  - Force-change (true): **PULA** `currentPassword` (login já validou a
    temp), regenera cookie limpo após sucesso
- `DELETE /api/auth/me` — `currentPassword` + `confirmText="EXCLUIR"` →
  REUSA `deleteUserCascade` → limpa cookie → redirect /login

UI em `(dashboard)/minha-conta`:
- Perfil: nome editável, email read-only
- Segurança: trocar senha (3 inputs)
- Zona de perigo: collapse + dupla confirmação

Link "Minha conta" no UserMenu do TopBar (substitui "Configurações breve").

⚡ **PARTE C — Force-change senha no 1º login**

Decisão técnica: flag `mustChangePassword` vai no **payload do JWT**
(evita DB lookup a cada request).

- `lib/auth.ts` `TokenPayload` recebe campo opcional
- `/api/auth/login`: ao detectar `User.mustChangePassword=true`, JWT é
  assinado com a flag E response retorna `{mustChangePassword: true}` pra
  UI redirecionar
- `proxy.ts`: quando token tem flag, bloqueia tudo exceto
  `[/trocar-senha, /api/auth/me/change-password, /api/auth/me, /api/auth/logout]`.
  Outras URLs: redirect /trocar-senha (página) ou 403 `MUST_CHANGE_PASSWORD`
  (API). **Defesa em profundidade contra "skip" via URL direta.**
- Rota `/trocar-senha` em raiz: server component valida sessão+flag,
  redirect /dashboard se flag=false (proteção pós-troca)
- Form client POST `/api/auth/me/change-password` → cookie regenerado
  sem a flag → middleware libera o app

**Testes (+44, total 3706):**
- `generate-temp-password.test.ts` (7) — entropia, 4 classes, sem chars
  confusos, 100 unique em 100 calls
- `delete-user-cascade.test.ts` (6) — solo, multi-dono, FK Restrict
  OfxImport/RecurringSchedule/CompanyTaxProfile, throws inexistente, snapshot
- `admin-endpoints.test.ts` (15) — RBAC OPERADOR reset+email OK, OWNER
  delete OK, OPERADOR delete bloqueado 403, audit das 3 actions, email
  duplicado 409, formato inválido 400, confirmEmail mismatch 400
- `autoatendimento.test.ts` (16) — PATCH perfil, smuggle userId ignorado,
  change-password (auto vs force), cookie regenerado, DELETE me sucesso/erros,
  smuggle userId no DELETE ignorado, GET me retorna flag

**Smoke prod Yussef (6/6 ✅):**
- A: reset senha → recebe temp 16 chars
- B: login com temp → forçado pra /trocar-senha (sem skip)
- C: trocar email + duplicado bloqueia (409)
- D: criar cliente fake → excluir → sumiu da lista
- E: cliente troca própria senha em /minha-conta
- F: cliente tenta /admin/clientes → 404 (subdomain routing)

**Métricas finais:**
- 4 commits: `6ead5dc` (audit doc), `1630727` (feat), `ac1e080` (merge), deploy
- TS strict 0, suite 3706/3706 (+44)
- Migration aditiva aplicada em prod, coluna `mustChangePassword boolean
  default false` confirmada
- PM2 ↺ 174, BUILD_ID `0UfOfVeQr8Ydmg7yIP99K`

**Próximo passo:** aguardando próximo prompt do Yussef. Sprint comercial
SaaS agora tem 3/5 pilares prontos (auth, gestão conta, cupons) — faltam
**subscription/planos** e **gateway de pagamento** (mapeados na auditoria
de 30/05 em `docs/sprints/`).

### 02/06/2026 — Sprint Asaas 3C (webhook) + checkpoint org

**Contexto:** continuação direta da sessão 31/05-01/06 (3A + 3B). Yussef
aprovou seguir pro 3C imediatamente após o checkout cartão funcionar
end-to-end (fix do `NEXT_PUBLIC_APP_URL` callback URL).

#### Sprint 3C — Webhook (Asaas sandbox) ✅ DEPLOYADO
**Branch:** `feature/asaas-3c-webhook` → mergeada na `main` em `2a15128`.

Fase 1 — Investigação (`docs/sprints/asaas-3c-webhook.md`):
- Auth header oficial: `asaas-access-token` (citação verbatim da doc)
- Idempotência: `body.id` (top-level — formato `evt_<hash>&<num>`)
- Payload: `{id, event, payment: {id, status, subscription,
  externalReference, customer, ...}}`
- 28 PAYMENT_* + 7 SUBSCRIPTION_* mapeados
- Doc: 15 falhas consecutivas → fila pausa; sem timeout especificado
- 4 IPs oficiais Asaas (NÃO usamos — token protege)

5 decisões aprovadas:
1. CHARGEBACK_REQUESTED → PAST_DUE (não cancela imediato)
2. Ignorar todos SUBSCRIPTION_* (gravar pra auditoria)
3. Sem filtro de IP no MVP — token protege
4. Síncrono no MVP (sem fila)
5. `gatewaySubscriptionId` set lazy na 1ª confirmação webhook

Fase 2 — Implementação:
- Schema `WebhookEvent` (asaasEventId @unique + race handling P2002 +
  FK SetNull pra Subscription)
- Migration `20260612000000_asaas_3c_webhook_event` — PURAMENTE ADITIVA
  (só CREATE TABLE webhook_events + 5 índices + FK na própria tabela)
- `lib/asaas/webhook.ts` puro (testável sem DB):
  - `validateAsaasToken(received, expected)` via `crypto.timingSafeEqual`
  - `parseExternalReference(ref)` → `{userId, planId, ciclo, dias?}`
  - `calculateNextPeriodEnd(current, ciclo, now)` — `max(now, current) + delta`
  - `routeEvent(event)` → ACTIVATE | PAST_DUE | CANCEL | IGNORE
- `POST /api/webhooks/asaas` (orquestrador) — fluxo:
  1. Valida `asaas-access-token` (fail-closed se var ausente)
  2. Idempotência via findUnique + try/catch P2002 no atomic
  3. Roteia + atualiza Subscription + grava WebhookEvent num único
     `prisma.$transaction`
- 3 camadas pra identificar Subscription: externalReference (preferida)
  → gatewaySubscriptionId → gatewayCustomerId
- Sub não localizada → status=ERROR + 200 (não trava fila Asaas)
- `proxy.ts` — `/api/webhooks/asaas` em PUBLIC_API (auth por token, não JWT)

Fase 3 — Testes:
- **+67 testes** (3845 → 3912): 42 puros + 25 endpoint integration
- TypeScript strict: 0 erros
- Build prod local: ✓ Compiled
- Cobertura: auth (5) / body validation (3) / idempotência (1) /
  ACTIVATE (7) / PAST_DUE (1) / CANCEL (2) / chargeback (1) /
  IGNORED (3) / ERROR fallback (2) + 42 puros (token + parser +
  calc + router)

**Bonus fix dentro da sprint** (em `lib/asaas/client.ts`):
Quando o WAF/proxy do Asaas retorna body não-JSON em 4xx, agora logamos
`contentType + bodyFirst300` com REDACT da `apiKey` (caso proxy
intermediário ecoasse headers no body). Preserva diagnóstico útil
(HTML do WAF) sem vetor de vazamento. Teste de segurança existente
(`Sanitização de logs`) volta a passar.

#### Deploy passo-a-passo
1. Backup `pg_dump -Fc` → `/var/backups/conta-ia/pre-3c-webhook-20260601_234500.dump` (541.823 bytes · 340 itens via `pg_restore --list`)
2. `swap-prisma-to-postgres.sh` (no-op — prod já estava em postgres)
3. `prisma migrate status` → 1 pendente (apenas a do 3C) ✓ confirmado com Yussef antes de aplicar
4. `prisma migrate deploy` → migration aplicada
5. Counts pré/pós: **subscriptions 5=5 · transactions 2663=2663 · users 5=5** (dados intactos)
6. `npm run build` + `pm2 reload --update-env`
7. Smokes 401 confirmados (sem header / token aleatório sem var / via nginx público)

#### Pegadinha #5 nova (3C): webhook token hex NÃO precisa escape de `$`
(token é hex puro vindo do `openssl rand -hex 32`).

#### Checkpoint de organização (após 3C)
Yussef pediu pausa da frente pagamento pra mexer em outras partes.
Estado salvo:
- **Triplo match HEAD** Mac=GitHub=Prod = `2a15128`
- Working tree limpo · todas as branches locais mergeadas na main
- `docs/sprints/PAGAMENTO-RETOMAR-AQUI.md` criado — playbook pra
  retomar (ativar webhook + smoke + virar 3D)
- CLAUDE.md atualizado: cabeçalho aponta pro PAGAMENTO-RETOMAR-AQUI

**Pendência de segurança registrada:**
- Rotacionar senha do banco Postgres prod quando puder
  (`PGPASSWORD` apareceu em texto durante a investigação do bug
  callback URL — higiene boa = rotação. Sem vetor externo conhecido)

**Próximo passo (frente pagamento):** Yussef executar a seção
"ATIVAR O WEBHOOK" de `docs/sprints/PAGAMENTO-RETOMAR-AQUI.md` quando
quiser retomar.

**Próximo passo (sessão atual):** Yussef decide qual outra frente
abrir (nenhuma específica indicada — pode ser dashboard, IA contadora,
relatórios, etc).

### [Próxima sessão] — preencher
- Data:
- O que foi feito:
- Próximo passo:

---

## 🆘 Workflow obrigatório a cada sessão

### Início de sessão (chat OU Claude Code)
1. Ler ESTE arquivo (`CLAUDE.md`) por completo
2. Olhar último item do "Log de sessões"
3. Confirmar com Yussef qual fase/item antes de codar

### Fim de sessão
1. Atualizar "Log de sessões" com:
   - Data
   - O que foi feito (lista de checkboxes marcados)
   - O que descobrimos
   - Próximo passo claro
2. Marcar checkboxes concluídos no roadmap

### NUNCA
- Começar do zero (sempre tem contexto)
- Mudar stack sem justificativa
- Pular fases
- Codar antes de confirmar plano
- Criar pasta nova com nome parecido (causa confusão)

---

## 📞 Links úteis

- Pluggy docs: https://docs.pluggy.ai
- Meu Pluggy (Yussef): https://meu.pluggy.ai
- Pluggy Dashboard (dev): https://dashboard.pluggy.ai
- Claude API docs: https://docs.claude.com
- Reforma Tributária: https://www.gov.br/fazenda/reforma-tributaria
- Layout NF-e 2026: https://www.nfe.fazenda.gov.br
- shadcn/ui: https://ui.shadcn.com
- BrasilAPI: https://brasilapi.com.br
