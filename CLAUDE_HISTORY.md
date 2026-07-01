# CLAUDE_HISTORY.md — Log histórico de sessões (Conta IA)

> **O que é:** log integral de sessões de desenvolvimento extraído do
> `CLAUDE.md` em **01/07/2026** para manter o CLAUDE.md leve (padrão
> Anthropic: injeção de contexto <200 linhas).
>
> **Quando consultar:** quando precisar de contexto de _"por que X foi
> feito assim"_, _"como a feature Y evoluiu"_, _"qual foi o caminho de
> decisão do sprint Z"_. Regras **vivas** (invariantes de código,
> convenções, decisões de arquitetura ainda vigentes) foram promovidas
> pro `CLAUDE.md` — este arquivo é referência histórica.
>
> **Como consultar:** grep por palavra-chave, data ou nome do sprint.
> Ex: `grep -n "reconcileGroupId" CLAUDE_HISTORY.md`, ou pular direto
> pela seção via índice abaixo.
>
> Zero conteúdo perdido no processo. Backup do CLAUDE.md pré-enxugamento
> preservado em `CLAUDE.md.backup-20260701`.

---

## Índice cronológico

### Sessões
- [29/04/2026 — Reorganização + estratégia OFX-first](#29042026--reorganização-e-estratégia-ofx-first)
- [30/04/2026 — Auditoria 2.1 + FASE 3+4 + 2 bugs bloqueadores](#30042026--auditoria-21--unificação-34--sub-etapa-31--2-bugs-bloqueadores)
- [03/05/2026 — Pesquisa profunda + NORTE](#03052026--pesquisa-profunda-de-mercado-e-definição-do-norte)
- [03/05/2026 p2 — Etapa 2.4 backfill categorias](#03052026-parte-2--etapa-24-backfill-empresas-existentes-concluída)
- [03/05/2026 p3 — Documentação estratégica](#03052026-parte-3--documentação-estratégica-consolidada)
- [10/05/2026 — MacBook + Plano Dashboard](#10052026--migração-para-macbook--plano-mestre-dashboard-mundial--sprint-05)
- [11/05/2026 Dia 1 — Sprint 0.5 schema](#11052026--sprint-05-dia-1-schema--migrations)
- [11/05/2026 Dia 2 — Sprint 0.5 backend](#11052026-parte-2--sprint-05-dia-2-backend-de-transferências)
- [11/05/2026 Dia 3 — Sprint 0.5 engines](#11052026-parte-3--sprint-05-dia-3-engines-de-saldo-e-cashflow)
- [11/05/2026 Dia 4 — Sprint 0.5 UI + Replace OFX 🏁](#11052026-parte-4--sprint-05-dia-4-ui-completa--replace-ofx--sprint-05-finalizado)
- [11/05/2026 Sprint 1 Dia 1 — Hero](#11052026-parte-5--sprint-1-dia-1-hero-strip-dashboard-mundial)
- [11/05/2026 Sprint 1 Dia 2 — Mini-DRE + Top 5](#11052026-parte-6--sprint-1-dia-2-mini-dre--top-5-despesas)
- [11/05/2026 Sprint 1 Dia 4 — Saúde Financeira](#11052026-parte-7--sprint-1-dia-4-saúde-financeira)
- [11/05/2026 🏁 Fechamento 0.5 + 1](#11052026-parte-8---fechamento-histórico-sprint-05--sprint-1-numa-única-sessão)
- [23/05/2026 — Sprint 3.0.4 Polimento Pro](#23052026--sprint-304-polimento-pro-c1c2c3c4-numa-sessão)
- [27/05/2026 — Hotfix 5.0.4.0a + 5.0.4.0b Deep Dive](#27052026--hotfix-50440a-fix--sprint-50440b-deep-dive)
- [27-28/05/2026 — Sprint 5.0.4.0c1 + 2 hotfixes](#27-28052026--sprint-50440c1--2-hotfixes-sessão-maratona)
- [31/05/2026 — Sprint Gestão de Conta](#31052026--sprint-gestão-de-conta-admin--autoatendimento--force-change-senha)
- [02/06/2026 — Sprint Asaas 3C](#02062026--sprint-asaas-3c-webhook--checkpoint-org)
- [02/06/2026 p2 — Sprint PF Fatia 1](#02062026-parte-2--sprint-pf-fatia-1-fundação-entregue-em-prod)
- [03/06/2026 — Sprint PF Fatia 2 cartão](#03062026--sprint-pf-fatia-2-cartão-de-crédito-entregue-em-prod)
- [03/06/2026 p2 — Sprint PF Fatia 3 OFX+IA](#03062026-parte-2--sprint-pf-fatia-3-ofx-cartão--ia--deployada)
- [03/06/2026 p3 — Sprint PF Fatia 3.5 PDF](#03062026-parte-3--sprint-pf-fatia-35-pdf-vision-deployada-gated)
- [03/06/2026 p4 — Sprint PF Fatia 4 Ponte](#03062026-parte-4--sprint-pf-fatia-4-ponte-pjpf-deployada--diferencial-competitivo-final)
- [03/06/2026 p5 — Sprint Unificar Sócios](#03062026-parte-5--sprint-unificar-sócios-ux-consolidação)
- [03/06/2026 p6 — Sprint Dashboard PF](#03062026-parte-6--sprint-dashboard-pf-mobillsmercury-deployada)
- [03-04/06/2026 — Conciliação Xero B.1-B.3](#03-04062026--reformulação-conciliação-no-modelo-xero-sprint-a-effected-b1b2b3)
- [04/06/2026 p2 — Fase B.4 Ajustes](#04062026-parte-2--fase-b4-ajustes-jurostarifasdescontos--3-bugs-ux)
- [05/06/2026 — Hardening (rate limit + import + CSV)](#05062026--hardening-uxsegurança-em-sequência-sessão-maratona)

### Sprints resumo (tabelas)
- [🏆 SPRINT 0.5 — Finalizado](#-sprint-05--finalizado-11052026)
- [🏆 SPRINT 1 — Dashboard Mundial Finalizado](#-sprint-1--dashboard-mundial--finalizado-11052026)

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

### 02/06/2026 (parte 2) — Sprint PF Fatia 1 (Fundação) entregue em prod

**Contexto:** Yussef aprovou a Fatia 1 da frente PESSOA FÍSICA após estudo
profundo de arquitetura. Decisões fechadas: PersonalProfile separado de
Company, ponte PJ→PF via 2 transações pareadas (futuro Fatia 4), cartão
como Fatia 2 dedicada, plano PF R$ 19,99 (Fatia 6), onboarding pergunta
PF/PJ pós-cadastro.

#### Sprint PF Fatia 1 — Fundação ✅ DEPLOYADA EM PROD
**Branch:** `feature/pf-fatia-1-fundacao` → main em `5f4aa33`.

**Schema (5 models novos + 1 coluna):**
- `PersonalProfile` (cpf opcional, type OWN|DEPENDENT)
- `UserPersonalProfile` (N:N + role + isSelf flag)
- `PersonalBankAccount` (reusa cheque especial Sprint 0.5)
- `PersonalCategory` (15 default + hierarquia)
- `PersonalTransaction` (CREDIT|DEBIT; campos cartão/ponte reservados)
- `User.onboardingCompletedAt` (gate users existentes)
- Migration `20260613000000_pf_fatia_1_fundacao` PURAMENTE ADITIVA

**Lib + queries (lib/personal-profile/):**
- `default-categories.ts` — 15 templates (3 INCOME + 12 EXPENSE)
- `queries.ts` — `checkProfileAccess` centralizado pra multi-tenant
  rígido. Toda chamada passa por aqui antes de retornar dados.
- `ProfileAccessError` com códigos: NO_ACCESS | INSUFFICIENT_ROLE |
  INVALID_PARENT | INVALID_ACCOUNT | INVALID_CATEGORY

**8 endpoints REST + 2 utilitários:**
- /api/perfis (GET/POST)
- /api/perfis/[id] (GET/PATCH/DELETE — com summary embutido)
- /api/perfis/[id]/contas[/contaId] (CRUD)
- /api/perfis/[id]/transacoes[/txId] (CRUD + recalc saldo automático)
- /api/perfis/[id]/categorias[/catId] (CRUD)
- /api/perfis/atual (cookie httpOnly de profile selecionado)
- /api/auth/me/onboarding (gate de onboarding)

**UI dual PJ × PF:**
- `lib/contexts/workspace-context.tsx` — NOVO (EmpresaContext intacto)
- `components/layout/workspace-switcher-dual.tsx` — switcher com cor
  forte (🟦 azul Building2 = empresas, 🟢 verde Users = pessoal)
- Pill colorida no header indica contexto ativo
- Badge PJ/PF ao lado do nome do workspace
- TopBar + DashboardShell atualizados

**6 telas em /perfis/*:**
1. Lista de perfis (cards verdes com tipo + CPF mascarado)
2. /novo (form OWN|DEPENDENT + CPF opcional)
3. /[id] (dashboard: saldo / entradas+saídas 30d / resultado / top 5
   despesas + lista de contas)
4. /[id]/contas (lista + form inline com cheque especial)
5. /[id]/transacoes (lista + form inline filtrando categorias por tipo)
6. /[id]/categorias (2 colunas: receitas + despesas)

**Onboarding /onboarding:**
- 3 cards: 🏢 Empresa (azul) / 👤 PF (verde) / 🔀 Os dois (roxo)
- Gate via `User.onboardingCompletedAt` — users existentes (5 atuais)
  com NULL podem ignorar
- "Pular por agora" → /dashboard + marca completed

**52 testes novos (3912 → 3964):**
- `default-categories.test.ts` (9 puros) — 15 cats, hex valid, placeholders
- `queries.test.ts` (27 integração) — CRUD + autorização + saldo automático
- `endpoint-multi-tenant.test.ts` (16 isolamento) — 10+ críticos:
  - userB → perfilA: GET/PATCH/DELETE/POST contas/tx → todos 404
  - cross-account: tx do perfilA usando conta do perfilA2 → 400
  - POST /api/perfis/atual com profileId alheio → 404
  - listagem só retorna perfis do user logado (nunca vaza)

#### Deploy passo-a-passo
1. Backup `pg_dump -Fc` → `/var/backups/conta-ia/pre-pf-fatia-1-20260602_141414.dump` (550.800 bytes · 349 itens)
2. git fetch + reset main → 5f4aa33
3. `npm ci --legacy-peer-deps`
4. `swap-prisma-to-postgres.sh` (no-op — já estava postgres)
5. `prisma migrate status` → 1 pendente (a do PF Fatia 1)
6. `prisma migrate deploy` → migration aplicada
7. **⚠️ Bug pego (importante registrar):** `npm ci` rodou `prisma generate`
   ANTES do swap, gerando client com schema=sqlite. Login retornou 500
   "url must start with file:". Fix: `npx prisma generate` DEPOIS do
   swap + `npm run build` de novo + pm2 reload. Registrar no `docs/DEPLOY.md`
   na próxima oportunidade: ordem correta = git pull → swap → npm ci →
   prisma generate → migrate deploy → build → reload.
8. Counts pré/pós: users 5=5, companies 3=3, subscriptions 5=5 (intactos)
9. transactions: 2698 → 2907 (+209) durante o deploy — **NÃO** foi meu
   código. Eram OFX/Excel imports do Yussef usando o sistema em paralelo.
   PM2 reload é hot → uso real não foi interrompido. Confirma robustez
   do deploy.
10. admin@contaia.com.br continua GRANTED + plano "inteligencia"
11. Smoke: GET /api/perfis sem auth → 401 ✓ · com auth → []
    ✓ · POST perfil → criado ✓ · cleanup perfil de smoke

**Métricas finais:**
- 28 arquivos, +4462 linhas
- TypeScript strict: 0 erros
- Build prod: ✓
- Suite: 3964/3964 (52 PF + base 3912)
- 5 models criados, todos vazios em prod (esperado)
- PM2 ↺ 240, BUILD_ID nova

**Próximo passo:** Yussef testa em prod (admin pode criar perfil PF
próprio + dependente, validar switcher visual PJ/PF + isolamento entre
contas). Quando aprovar, segue Fatia 2 (cartão de crédito robusto).

### 03/06/2026 — Sprint PF Fatia 2 (Cartão de crédito) entregue em prod

**Contexto:** Yussef aprovou o plano detalhado (`docs/sprints/pf-fatia-2-cartao.md`)
+ as 7 decisões (closingDayRule default ATUAL, máx 24 parcelas, juros
manual no MVP, anuidade manual, estorno em fatura paga vira crédito
automático na próxima, brand opcional). Construção inteira em 1 sessão
+ checkpoint pré-deploy aprovado.

#### Sprint PF Fatia 2 — Cartão robusto ✅ DEPLOYADA EM PROD
**Branch:** `feature/pf-fatia-2-cartao` → main em `8704107`.

**Schema (2 models novos + 7 colunas aditivas + 1 reverso):**
- `CreditCard` (limite, closingDay, dueDay, closingDayRule ATUAL|PROXIMA,
  defaultPaymentAccountId opcional, brand/lastDigits opcionais)
- `CreditCardInvoice` (reference YYYY-MM @unique, status OPEN|CLOSED|
  PAID|PARTIAL|OVERDUE, `carryoverFromInvoiceId` pra rastrear rotativo)
- PersonalTransaction ganhou 7 colunas: creditCardId, creditCardInvoiceId,
  installmentNumber, installmentTotal, installmentGroupId, isInvoicePayment
- PersonalBankAccount ganhou relação reversa `cardDefaultPayments`
- PersonalProfile ganhou `creditCards[]`
- Migration `20260614000000_pf_fatia_2_cartao` puramente aditiva

**5 helpers puros (testáveis sem DB):**
- `lib/dates/add-months.ts` (EXTRAÍDO de Sprint 3C `lib/asaas/webhook.ts`
  — agora genérico, reusado em PJ webhook + Fatia 2 cartão)
- `calculate-invoice-reference` (closingDayRule ATUAL|PROXIMA + clamp último dia)
- `build-installments` (1-24 parcelas, round half-up, sum exato qualquer N)
- `calculate-card-summary` (limite usado/disponível real-time, OPEN+CLOSED+PARTIAL contam, PAID não)
- `calculate-profile-credit-summary` (consolidado N cartões pro dashboard)
- `lib/credit-card/queries.ts` (orquestrador atomic com $transaction + checkProfileAccess)

**13 endpoints REST:**
- CRUD cartão (lista, novo, detalhe+summary, editar, soft delete)
- Faturas (lista, detalhe+tx, pagar com juros opcional)
- Compras (criar à vista 1x ou parcelada 2-24x, estornar SINGLE|ALL_GROUP)
- `dashboard-summary` (consolidado + topCategoriesOnCards + invoiceHistory 12m — rosca/line/bar READY)
- `saldo-previsto` (saldo - faturas ≤30d - parcelas futuras)
- `installments-preview` (alimenta `<InstallmentPreview>` sem criar compra)

**UI dual PJ × PF:**
- 7 telas novas em `/perfis/[id]/cartoes/*`: lista, novo, dashboard
  do cartão, editar, faturas (lista + detalhe + pagar), nova compra
- Componente reusável `<InstallmentPreview>` (mostra "1ª R$ 33,33 em
  jul/2026, 2ª R$ 33,33 em ago/2026..." em real-time enquanto user
  digita)
- Dashboard PF (`/perfis/[id]`) ganha card "Cartões" com limite
  consolidado + atalho "Criar 1º cartão" se zero

**10 pegadinhas resolvidas com testes:**
1. Compra no dia do fechamento — closingDayRule ATUAL|PROXIMA
2. Virada de mês parcelado (31/jan → 28/fev) — addMonths com clamp
3. Estorno parcelado em fatura paga — crédito automático na próxima
4. Pagamento parcial → carryoverFromInvoiceId + tx rotativa + juros opcional
5-10. USD/cashback/pontos FORA · anuidade manual · limite real-time ·
multi-cartões · OFX Fatia 3 · juros user informa

**Multi-tenant rígido:**
- Toda rota usa `checkProfileAccess` (helper Fatia 1)
- `CreditCardError` com códigos NO_ACCESS|CARD_NOT_FOUND|INVALID_*
- 15 testes isolamento confirmam zero vazamento

**89 testes novos (3964 → 4053):**
- 12 add-months (extraído + clamp + bissexto)
- 23 calculate-invoice-reference (todas pegadinhas de data)
- 14 build-installments (sum exato qualquer N, 31/jan, 12x cruza ano)
- 12 calculate-card-summary (limit usado/PAID/PARTIAL/clamps)
- 13 queries-integration (à vista, parcelado, rotativo+juros, estorno SINGLE|ALL_GROUP)
- 15 multi-tenant-isolamento (15 cenários críticos endpoint)

#### Deploy passo-a-passo (resultado)
1. Backup `pg_dump -Fc` → `pre-pf-fatia-2-20260603_001635.dump` (607.153 bytes · 382 itens)
2. **Baseline counts:** users=5, companies=3, transactions=2907, subscriptions=5, personal_profiles=1 (Yussef criou após decisão SocioPF×PersonalProfile), personal_transactions=0
3. git pull main → HEAD `8704107`
4. swap-prisma-to-postgres.sh (no-op — já em postgres)
5. **prisma generate DEPOIS do swap** (fix do bug Fatia 1 — sem isso login dá 500)
6. prisma migrate status: 1 pendente (a do PF Fatia 2)
7. **prisma migrate deploy** → aplicada
8. **Counts pós:** users=5✓, companies=3✓, transactions=2907✓, subscriptions=5✓, personal_profiles=1✓, personal_transactions=0✓
9. Yussef admin GRANTED+inteligencia preservado ✓
10. 7 colunas novas em personal_transactions verificadas no information_schema (6 nullable + 1 NOT NULL com default)
11. credit_cards=0, credit_card_invoices=0 (esperado)
12. npm run build OK
13. pm2 reload --update-env → PID 522947 online

**Smoke tests:**
- (a) GET /cartoes sem auth → 401 ✓
- (b) Login admin + GET /perfis → lista 1 perfil ("yussef abu zahry musa", CPF 600.258.890-60, isSelf:true)
- (c) GET /cartoes do perfil → `{"cards":[]}` ✓
- (d) GET /cartoes/dashboard-summary → `{summary:{cardsCount:0,totalLimit:0,...},topCategoriesOnCards:[],invoiceHistory:[]}` ✓
- (e) GET /saldo-previsto → `{saldoAtual:0,faturasAbertas:0,parcelasFuturas:0,saldoPrevisto:0}` ✓

**Descoberta interessante:**
- Yussef já criou o PersonalProfile dele (`cmpxg38zj000omro5yw0v3xr0`) com
  CPF 600.258.890-60 entre nossa decisão SocioPF×PersonalProfile e o
  deploy da Fatia 2. Preservado ✓

**Próximo passo:** Yussef testa criar 1 cartão real (Nubank/Itaú) → lançar
compra à vista + 1 parcelada (preview) → pagar fatura → estornar.
Quando aprovar, próximo sprint é **DASHBOARD PF** (Mobills/Organizze-grade)
ou **Fatia 3 (OFX + IA classificação PF)**. Decisão pendente.

### 03/06/2026 (parte 2) — Sprint PF Fatia 3 (OFX cartão + IA) ✅ deployada

**Contexto:** Yussef aprovou plano + 8 decisões; pediu Fatia 3.5 (PDF
via Claude Vision) registrada como próximo passo. Fatia 3 inteira
entregue em 1 sessão.

#### Sprint PF Fatia 3 — OFX import + IA categorização PF ✅ PROD
**Branch:** `feature/pf-fatia-3-ofx-ia` → main em `8a3513c` (+ fix migration `3355b3e`).

**Schema (1 model + 9 colunas aditivas):**
- `PersonalOfxImport` (clone OfxImport PJ — histórico + revert)
- `PersonalTransaction` +6 cols: `ofxImportId`, `isInternational`,
  `internationalCurrency`, `classifiedByRuleId`, `aiConfidence`, `classifiedBy`
- `AiLearningRule.companyId` virou nullable + `+profileId` +
  `+personalCategoryId` (REUSO da tabela PJ — sem duplicar)
- Migration `20260615000000_pf_fatia_3_ofx_ia` aditiva

**6 helpers puros (funções testáveis):**
- `parseOFXExtended` (statementType BANK|CREDITCARD + ORG/FID/CCACCTFROM)
- `detectInstallment` (4 regex Parcela X/Y + clamp num≤total≤99)
- `detectSpecialTx` (Pagamento|IOF|Multa|Rotativo|Internacional|Juros)
- `keyword-pf` (~70 marcas BR: iFood/Uber/Netflix/Apple/Airbnb/Posto/Mercado/etc)
- `detect-recurring` (Jaccard + stdev<15%, ≥3 meses → assinatura)
- `dedup-against-manual` (fuzzy tokens + ±1d + valor exato)
- `categorize-pf` orquestrador (RULE → KEYWORD → SPECIAL → NONE/Claude)

**IA PF parametrizada:**
- `claude-prompt-pf.ts` (SYSTEM_PROMPT específico — sem DRE/regimes/CNAE)
- `buildUserMessagePf` (categorias por INCOME|EXPENSE)
- Bloco condicional pra cartão (parcela, IOF, internacional)
- `apply.ts` PJ ajustado pra `companyId nullable`

**5 endpoints REST:**
- `POST preview` (multipart ou JSON, max 5MB, 500 tx)
- `POST confirm` (decisões por linha)
- `GET historico`
- `POST reverter`
- `GET insights/recorrentes`

**4 telas UI (foco no preview EDITÁVEL — diferencial):**
- `/importar` (upload + pré-fill cartão via `?cartao=`)
- `/importar/preview/[importId]` ⭐ — pílulas resumo + filtros + bulk +
  confidence badge colorido + flags 📦💳🌐⚠️ + sticky confirm
- `/imports` (histórico + revert 1-clique)
- `/insights` (assinaturas recorrentes + total mensal)
- Atalho "Importar fatura OFX" no detalhe do cartão

**Pegadinhas resolvidas com fixture Nubank real:**
- Pagamento recebido (CREDIT) → SKIP + warn
- Posto → Transporte (KEYWORD 0.85)
- Claude.Ai → Educação
- Airbnb Parcela 5/6 → Lazer + isInstallment 5/6
- Multa fatura atrasada → Cartão de crédito (SPECIAL)
- IOF internacional → `isInternational=true`
- Valor pendente mês anterior → CARRYOVER + warn rotativo
- Reimport → dedupHash existente
- Dup com manual → fuzzy match jaccard ≥0.3 + ±1d + valor exato

**Multi-tenant:**
- `checkProfileAccess` em toda rota + validação `INVALID_CARD/CATEGORY`
- 9 testes isolamento (GET/POST/DELETE userB → A → 404)
- Cross-perfil same-user (cardId de perfil A2 em import A1) → 400

**98 testes novos (4053 → 4151):**
- 11 parser-ext (fixture Nubank real)
- 15 installment
- 16 special-tx
- 16 keyword-pf
- 9 recurring
- 7 dedup-against-manual
- 12 categorize-pf
- 11 integration e2e (preview/confirm/revert com fixture)
- 9 multi-tenant isolamento

#### Deploy passo-a-passo
1. Backup `pg_dump -Fc` → 616.431 bytes · 401 itens
2. **Baseline counts:** users=5, companies=3, transactions=2907,
   subscriptions=5, personal_profiles=1, personal_transactions=0,
   credit_cards=1 (Yussef criou Nubank), credit_card_invoices=0,
   ai_learning_rules=176 (PJ existentes)
3. git pull main + npm ci + swap + **prisma generate DEPOIS do swap**
4. `prisma migrate status` → SÓ a do PF Fatia 3 pendente
5. ⚠️ **1ª tentativa falhou** ("relation ai_learning_rules_companyId_tipoMatch_padrao_key already exists") — Postgres mantém INDEX implícito após DROP CONSTRAINT
6. **Fix in-flight:** adicionar `DROP INDEX IF EXISTS` antes do CREATE
   UNIQUE INDEX (commit `3355b3e`). Prisma rollback total da 1ª tentativa
   garantiu state limpo
7. `prisma migrate deploy` (2ª tentativa) → SUCCESS
8. **Counts pós:** todos intactos (5/3/2907/5/1/0/1/0/176) + `personal_ofx_imports`=0
9. `ai_learning_rules.companyId` agora nullable ✓ +  `profileId`/`personalCategoryId` ✓
10. Admin GRANTED preservado ✓
11. npm run build + pm2 reload → PID 525012 online

**Smoke tests:**
- (a) preview sem auth → 401 ✓
- (b) GET historico → `{imports:[]}` ✓
- (c) GET insights → `{recurring:[],monthlyTotal:0}` ✓
- (d) POST preview com mini-OFX (Netflix) → IA categorizou + statementType=CREDITCARD detectado + `lines:[{description:"Netflix",...}]` ✓
- Smoke import deletado pós-validação

**Próximo passo:** Yussef testa em prod com seu OFX REAL do Nubank
(15 tx, 3 parcelas, encargos, pagamento). Quando aprovar:
- **Fatia 3.5** (PDF via Claude Vision) — doc dedicado existente
- **Dashboard PF nível Mobills** — sprint atrasado, agora todos os
  endpoints dashboard-ready estão prontos
- **Fatia 4** (ponte PJ→PF) — diferencial competitivo final

### 03/06/2026 (parte 3) — Sprint PF Fatia 3.5 (PDF Vision) deployada GATED

**Contexto:** Yussef aprovou plano (`docs/sprints/pf-fatia-3.5-pdf.md`) +
8 decisões (Sonnet 4.6, cache 7d, 5 bancos, max 10 pgs, PDF criptografado
→ erro, ZDR via sales, owner deleta cache, reject MOBILE_PHOTO). Construção
inteira em 1 sessão + checkpoint pré-deploy aprovado + deploy GATED em prod.

#### Sprint PF Fatia 3.5 — PDF Vision ✅ DEPLOYADA GATED EM PROD
**Branch:** `feature/pf-fatia-3.5-pdf-vision` → main em `a8a160e` + fix gate `0fa18ba`.

**Schema (1 model + 4 colunas aditivas):**
- `PersonalPdfExtractCache` (UNIQUE `pdfSha256`, owner-scoped via FK,
  TTL `expiresAt` 7 dias)
- `PersonalOfxImport` +4 cols nullable: `sourceType` DEFAULT 'OFX',
  `extractionConfidence`, `pdfSha256`, `pdfScanQuality`
- Migration `20260616000000_pf_fatia_3_5_pdf_vision` PURAMENTE ADITIVA
  (zero ALTER em tabela com dados reais que mude semântica)

**Lib `lib/pdf-import/` (8 arquivos):**
- `feature-flag.ts` — gate dual env: dev/test só PDF_IMPORT_ENABLED=true,
  prod exige AMBAS `PDF_IMPORT_ENABLED=true` AND `PDF_IMPORT_ZDR_CONFIRMED=true`
- `extract-from-pdf.ts` — orquestrador Claude Sonnet 4.6 Vision, fetch
  injetável, pre-validações (≤5MB, header %PDF-, /Encrypt detect, timeout 30s)
- `pdf-templates/` — 5 bancos (Nubank/Itaú/Bradesco/Inter/C6) + genérico,
  detecção por filename
- `validate.ts` — 4 camadas: soma=total ±R$0.50, count, line confidence
  mínima, scan quality. Rejeita MOBILE_PHOTO
- `cache.ts` — global por SHA256, delete LGPD scoped por dono
- `queries.ts` — `createPdfPreview` orquestrador (gate → multi-tenant →
  SHA256 → cache OR Vision → PersonalOfxImport sourceType='PDF' → preview
  via pipeline F3)
- `confirm.ts` — separado do OFX confirm (lê do cache)
- `types.ts` — ScanQuality + PdfExtractedTx + PdfExtractError + códigos

**5 endpoints REST + UI:**
- GET `/api/perfis/[id]/pdf-import/status` (feature flag — sempre 200)
- POST `/api/perfis/[id]/pdf-import/preview` (multipart, 403 quando gated)
- POST `/api/perfis/[id]/pdf-import/confirm` (decisões, 403 quando gated)
- GET `/api/auth/me/pdf-cache` (listar próprios caches)
- DELETE `/api/auth/me/pdf-cache/[sha256]` (deletar próprio, LGPD)
- UI: `/perfis/[id]/importar` aceita .pdf quando pdfAllowed (escondido se gated)
- UI: preview com banner colorido por scan quality

**Privacidade:**
- Fixture `__tests__/fixtures/nubank-mai-2026.json` SINTÉTICO (NUNCA
  commitar PDF real). README documenta decisão
- Logs do extract gravam só `sha256` + tokens + cost. Nunca conteúdo

**Multi-tenant:**
- `__tests__/pdf-import/multi-tenant.test.ts` (9 testes): userB → cache de
  A retorna 404, DELETE cache alheio retorna 404, confirm cross-user 404

**Testes (+77, suite 4151 → 4228):**
- feature-flag (10) — gate dev/test/prod com matriz
- validate (11) — 4 camadas + reject MOBILE_PHOTO
- extract-from-pdf (17) — Claude API mockada
- templates (11) — catálogo bancos + filename detection
- cache (10) — LGPD ownership
- integration-pipeline (9) — fixture sintético soma R$6.771,22
- multi-tenant (9) — isolamento entre users

#### Deploy passo-a-passo (resultado)

1. Backup `pg_dump -Fc` → `/var/backups/conta-ia/pre-pf-fatia-3.5-20260603_023028.dump`
   (639KB · 419 itens via `pg_restore --list`)
2. **Counts pré:** users=5, companies=3, subscriptions=5, personal_profiles=1,
   credit_cards=1, personal_ofx_imports=0, personal_transactions=0,
   transactions=2907, ai_learning_rules=176
3. git pull main + npm ci + swap + **prisma generate DEPOIS do swap**
4. prisma migrate status → SÓ a do PF Fatia 3.5 pendente
5. prisma migrate deploy → SUCCESS
6. **Counts pós:** TODOS idênticos + nova tabela `personal_pdf_extract_cache=0`
7. Verificação colunas: `sourceType` NOT NULL DEFAULT 'OFX', 3 outras nullable
8. Admin `admin@contaia.com.br` plano `inteligencia` status `GRANTED` preservado ✓
9. **Gate fechado em prod:** adicionei `PDF_IMPORT_ENABLED=false` +
   `PDF_IMPORT_ZDR_CONFIRMED=false` explicit em `.env`
10. npm run build + pm2 reload (PID 528977 ↺ 244 online)

**Smoke test em prod (4 cenários — 4/4 ✓):**
- status sem auth → 401 AUTH_REQUIRED ✓
- status autenticado → 200 `{allowed:false, reason:"DISABLED"}` (UI esconde botão) ✓
- preview autenticado → 403 DISABLED (gate intercepta) ✓
- confirm autenticado → 403 DISABLED (gate intercepta) ✓

**Bug pego no smoke (fix in-flight, commit `0fa18ba`):**
Os endpoints preview/confirm rodavam validação de file/JSON ANTES do gate,
retornando 400/404 em vez de 403. Movi `checkPdfImportFlag()` pra logo após
auth check. PM2 PID 530076 ↺ 245 online após reload do fix.

**Como LIGAR PDF (registrado em `docs/sprints/pf-fatia-3.5-LIGAR-PDF.md`):**
1. Solicitar ZDR à Anthropic via <https://claude.com/contact-sales>
   (1-2 semanas) — pedir explicitamente elegibilidade pra PDF Vision
2. Assinar DPA addendum recebido
3. Em prod: trocar AMBAS `PDF_IMPORT_ENABLED=true` + `PDF_IMPORT_ZDR_CONFIRMED=true`
   no `.env` + `pm2 reload conta-ia --update-env`
4. Smoke: GET `/pdf-import/status` retorna `{allowed:true,reason:null}`

**Custo esperado quando ligar:** ~R$ 0,18 por fatura nova Nubank (~6 pgs),
R$ 0,00 em re-import dentro de 7d (cache SHA256). Pra 10 academias × 4 cartões
× 1 import/mês = ~R$ 7,20/mês.

**Métricas finais:**
- 36 arquivos no merge (+3178 linhas), TS strict 0
- Suite: 4228/4228 (+77 vs Fatia 3)
- Migration aplicada, dados intactos
- PM2 ↺ 245 online após fix do gate
- Cleanup: senha admin revertida ao hash original, tmp files removidos

**🚨 PENDÊNCIA PRO YUSSEF:** solicitar ZDR com Anthropic quando quiser
ligar PDF. Enquanto isso, OFX continua funcionando normalmente (Fatia 3
já em prod). Doc completo: `docs/sprints/pf-fatia-3.5-LIGAR-PDF.md`.

**Próximo passo:** Yussef decide próxima frente:
- Ligar PDF (depende do ZDR — frente externa)
- **Dashboard PF nível Mobills** (sprint atrasado, todos endpoints prontos)
- **Fatia 4** (ponte PJ→PF — diferencial competitivo final)
- Outra (retomar Asaas 3D, etc)

### 03/06/2026 (parte 4) — Sprint PF Fatia 4 (Ponte PJ→PF) deployada — diferencial competitivo final

**Contexto:** Yussef aprovou plano (`docs/sprints/pf-fatia-4-ponte.md`) + 7 decisões iniciais + ajustes de privacidade multi-sócio (5 decisões A-E) após eu levantar o ponto crítico. Construção inteira + smoke real 5/5 em prod.

#### Sprint PF Fatia 4 — Ponte PJ→PF ✅ DEPLOYADA EM PROD
**Branch:** `feature/pf-fatia-4-ponte` → main em `4cc2d70` (commit feat `67a09fb`).

**Schema (1 model + ZERO ALTER em tabelas existentes):**
- `PJtoPFBridge` (UNIQUE em pjTransactionId/pfTransactionId — sem `bridgeId` em
  `transactions` PJ pra **proteger as 2907 linhas reais**)
- Migration `20260617000000_pf_fatia_4_ponte_pj_pf` PURAMENTE ADITIVA:
  só CREATE TABLE + 4 índices + 6 FKs. Zero ALTER em transactions/personal_transactions
- FK Restrict nas 2 tx (PJ + PF): bloqueia hard delete direto, força user
  deletar ponte primeiro (UX 409 HAS_ACTIVE_BRIDGE)

**🔒 Privacidade multi-sócio (decisões A-E aprovadas):**
- A: Lista `/empresas/[id]/pontes` filtra `profileId IN owned_by_user_logado`
- B: Badge na tx PJ pra terceiros é anônimo (sem nome/conta)
- C: GET `/pontes/[id]` retorna 404 pra quem não é dono nem criador (não revela existência)
- D: Sugestão filtra por userId em `find-candidate-profile` (sócio B não vê CPF de A)
- E: Visão consolidada anonimizada pra ADMINISTRADOR societário fica pra Fatia 6+

**Tratamento contábil (validado com engine DRE existente):**
- PRO_LABORE → categoria `dreGroup='DESPESAS_PESSOAL'` (AFETA DRE)
- DISTRIBUICAO/ADIANTAMENTO/RETIRADA → `DISTRIBUICAO_LUCROS` (NÃO afeta DRE — non-DRE group)
- REEMBOLSO → `suggestedPjDreGroup=null` (força user escolher manualmente)

**Lib `lib/bridges/` (6 arquivos):**
- `types.ts` — BridgeError + 14 códigos privacy-safe
- `kind-defaults.ts` — 5 kinds × dreGroup PJ × categoria PF sugerida
- `find-candidate-profile.ts` — filtro por userId (privacidade D)
- `suggest-bridge.ts` — sugestões sob demanda
- `create.ts` — atomic 3-camadas (RBAC PJ + ProfileAccess OWNER + companyId match)
- `delete.ts` — 2 modos LINK_ONLY/WITH_PF_TX (privacidade C)
- `queries.ts` — listBridges (filtro privacidade) + getBridgeDetail + getBridgeSummary +
  checkPjTxBridgeForUser (retorna bridgeId=null pra terceiros, badge anônimo)

**6 endpoints REST:**
- POST `/api/pontes` (auth + RBAC `transaction.create`)
- GET/DELETE `/api/pontes/[id]?mode=` (404 anonimizado)
- GET `/api/empresas/[id]/pontes` (lista filtrada)
- GET `/api/empresas/[id]/pontes/sugestoes` (cache 60s tag `bridges:suggestions:${id}`)
- GET `/api/perfis/[id]/pontes` (multi-tenant via checkProfileAccess)
- GET `/api/pontes/summary` (agregados privados)

**5 telas + 4 componentes:**
- `/empresas/[id]/pontes` — lista com **banner de privacidade explícito**
- `/perfis/[id]/pontes` — lista lado PF (foco "de qual empresa")
- `/empresas/[id]/pontes/nova` — form 3 passos (tx PJ + tipo + destino PF)
- `/pontes/[id]` — detalhe (404 anonimizado pra terceiros)
- Sidebar: item "Pontes PJ→PF" (com Workflow icon, só quando há empresa contextual)
- Componentes: `BridgeKindRadio`, `BridgeBadge` (prop `belongsToMe`),
  `BridgeDeleteModal` (2 modos), `BridgeSuggestionCard`

**Testes (+83, suite 4228 → 4311):**
- kind-defaults (11) — 5 tipos + sugestões por papel SocioPF
- find-candidate-profile (15) — incl **3 ★ privacidade multi-sócio**
- create (10) — caminho feliz + 7 bloqueios + **★ privacidade**
- delete (7) — 2 modos + auth + FK Restrict
- queries (15) — incl **5 ★ privacidade**
- dre-contabil (4) — engine DRE não infla + tratamento correto
- endpoints (21) — incl **7 ★ privacidade entre sócios**

#### Deploy passo-a-passo

1. Backup `pg_dump -Fc` → `pre-pf-fatia-4-20260603_035703.dump` (629K · 428 itens)
2. **Counts pré:** users=5, companies=3, subscriptions=5, **transactions=2907 (CRÍTICO)**,
   personal_profiles=1, credit_cards=1, socios_pf=1, ai_learning_rules=176
3. git pull → npm ci → swap → **prisma generate DEPOIS do swap** → migrate status:
   1 pendente (a do PF Fatia 4)
4. `prisma migrate deploy` → SUCCESS
5. **Counts pós (idênticos):** todos batendo + `pj_to_pf_bridges=0` (nova)
6. admin@contaia.com.br plano `inteligencia` status `GRANTED` preservado ✓
7. npm run build + pm2 reload (PID 532016 ↺ 246 online)

**Smoke real (5/5 ✅) — usando IDs reais profit sao borja + perfil Yussef:**

| # | Validação | Resultado |
|---|---|---|
| 1 | POST `/api/pontes` PROFIT → Yussef → DISTRIBUICAO R$10k | **201** + bridgeId retornado |
| 2 | DRE PROFIT — NÃO afetado | Categoria dreGroup=DISTRIBUICAO_LUCROS (non-DRE) · Soma DESPESAS_PESSOAL maio=R$0 · Soma DISTRIBUICAO maio=R$10k |
| 3 | Dashboard PF — entrada criada | personal_transaction CREDIT R$10k no perfil Yussef · Categoria INCOME · Soma entradas maio=R$10k |
| 4 | Audit log BRIDGE_CREATED | 1 entrada · entity=PJtoPFBridge · by=Yussef Musa · metadata completa (pjTx + pfTx + kind + amount + createdVia) |
| 5 | DELETE LINK_ONLY | 200 + pfTransactionDeleted:false · bridge=0 · tx PJ=1 · tx PF=1 · audit BRIDGE_DELETED_LINK_ONLY |

**Cleanup pós-smoke:**
- Tx PJ + PF de teste deletadas (após DELETE LINK_ONLY que removeu a bridge)
- Senha admin revertida ao hash original (PWD_REVERTED=OK)
- Arquivos `/tmp/*.mjs` e `/tmp/*.json` removidos do servidor

**Counts FINAIS (idênticos aos iniciais):**
- users=5, companies=3, subscriptions=5
- **transactions=2907 ✓ (intacto)**
- personal_transactions=0, personal_profiles=1
- **pj_to_pf_bridges=0** (tabela criada vazia)

**Documentação:**
- `docs/sprints/pf-fatia-4-ponte.md` — plano completo + 5 decisões privacidade
- `docs/decisoes/categoria-pj-nominada-vs-generica.md` — caveat post-MVP (categoria
  PJ nominada vaza nome do sócio; refactor genérico fica pra quando entrar 2º sócio
  na mesma empresa)

**Métricas:**
- 33 arquivos no commit feat (+4150 linhas)
- TS strict 0
- Suite 4311/4311 (+83 vs Fatia 3.5)
- Migration 100% aditiva, dados PJ intactos
- PM2 ↺ 246 online após reload
- Backup 629K · 428 itens verificados

**🚨 PENDÊNCIA REGISTRADA (não esquecer):** quando entrar 2º sócio numa mesma empresa
(cenário multi-sócio real), revisar `docs/decisoes/categoria-pj-nominada-vs-generica.md`
ANTES de abrir acesso. Categoria PJ atual permite nome ("Distribuição p/Yussef") que
vaza pra outros sócios — corrigir antes ou depois fica mais caro.

**Próximo passo:** Yussef decide próxima frente:
- **Dashboard PF nível Mobills** (sprint atrasado — todos os endpoints prontos das Fatias 1-3)
- **Ligar PDF Vision** (depende ZDR Anthropic — frente externa)
- **Asaas 3D** (retomar pagamento prod — playbook em `docs/sprints/PAGAMENTO-RETOMAR-AQUI.md`)
- **Fatia 5** (Família/multi-perfis compartilhados + convites entre Users)
- Refactor categoria genérica (`docs/decisoes/categoria-pj-nominada-vs-generica.md`)

### 03/06/2026 (parte 5) — Sprint Unificar Sócios (UX consolidação)

**Contexto:** Yussef notou sobreposição UX entre `/pessoas-vinculadas` (cadastro
SocioPF + EmpresaRelacionada) e `/empresas/[id]/pontes` (Fatia 4 recém-deployada).
Pediu unificação estilo QuickBooks/Xero/Conta Azul. Estudo + 6 decisões
aprovadas + construção + deploy em 1 sessão. Ordem: Yussef escolheu fazer
Unificação ANTES do Dashboard PF (minha recomendação) pra evitar links
inconsistentes no dashboard futuro.

#### Sprint Unificar Sócios ✅ DEPLOYADA EM PROD
**Branch:** `feature/unificar-socios` → main em `be9acf4` (commit feat `7f3e017`).

**O que mudou (100% UI, ZERO migration):**
- Sidebar: 9 → 8 itens. "Pessoas Vinculadas" + "Pontes PJ→PF" removidos,
  "Sócios" adicionado
- `/empresas/[id]/socios` com 2 abas:
  - "Sócios PF" — tabela com coluna **"Suas pontes"** filtrada por user
  - "Empresas do Grupo" — CNPJs relacionados (sem timeline)
- `/empresas/[id]/socios/[socioId]` com 4 abas:
  - **Dados** (público): nome, CPF, papel, chaves Pix, cadastrado em
  - **Suas pontes** (privado): timeline filtrada por `profileId IN owned_by_user`
  - **Detecção Pix** (público): tx PJ identificadas com badge 🌉 anônimo
  - **Nova ponte** (form contextual com `socioPFId` pré-preenchido)
- `/socios` rota global resolve cookie `current_empresa_id` → redirect
- Toast enxuto "Pontes agora estão em Sócios" (1x por user via localStorage)

**Reuso máximo (zero código novo):**
- Endpoints existentes `/api/empresas/[id]/socios-pf` + `/empresas-relacionadas`
  (CRUD intacto)
- Componentes Fatia 4: `BridgeBadge`, `BridgeDeleteModal`, `BridgeKindRadio`,
  `KIND_DEFAULTS`
- Lib Fatia 4: `getUserOwnedProfileIds`, queries de pontes
- `lib/pix-detection/*` (detecção Pix intacta — 67 testes verdes)
- Reuso do form de criação de ponte → extraído em `NovaPonteForm.tsx`

**1 novo endpoint:** `GET /api/empresas/[id]/socios/[socioId]/aggregated`
- Retorna: socio + suasPontes (filtradas por user) + agregados + txPixDetected (público)
- Cache 60s com **userId NA CHAVE** (privacidade — sócio B nunca vê totals do A)

**Redirects 301 em `next.config.mjs`:**
- `/pessoas-vinculadas` → `/socios` (rota global resolve cookie)
- `/empresas/:id/pontes` → `/empresas/:id/socios`
- `/pontes/[id]` (detalhe global) e `/pontes/nova` (legacy) MANTIDOS

#### 🔒 Privacidade Fatia 4 INTACTA + 3 novos testes ★
- 83/83 testes Fatia 4 verdes (incl 9 ★ privacidade entre sócios)
- 67/67 testes pix-detection verdes
- 11 testes novos `aggregated-endpoint` incl **3 ★ privacidade**:
  - userA dono perfil + 2 bridges → totals R$ 15k ✓
  - 🚨 userB sem perfil → vê dados públicos do sócio MAS totals zerados + suasPontes=[] ✓
  - 🚨 Tx Pix detectadas são públicas (hasBridge=true sem detalhes) ✓

**Suite:** 4311 → **4322 (+11 testes)** sem regressões.

#### Deploy passo-a-passo (ZERO MIGRATION)

1. Backup `pg_dump -Fc` → `pre-unificar-socios-20260603_153249.dump` (651K · 443 itens)
2. **Counts pré:** users=5, companies=3, **transactions=2907**, personal_profiles=1,
   personal_transactions=0, pj_to_pf_bridges=0, **socios_pf=1**
3. git pull → npm ci → swap → **prisma generate DEPOIS** → `migrate status`:
   `Database schema is up to date!` ✓ **(0 pendentes — confirmado zero migration)**
4. `npm run build` ✓ → pm2 reload (PID 541118 ↺ 247 online)
5. **Counts pós:** TODOS idênticos ✓
6. admin@contaia plano `inteligencia` status `GRANTED` preservado ✓

**Smoke real (5 cenários ✅):**

| # | Validação | Resultado |
|---|---|---|
| 1 | `curl /pessoas-vinculadas` | **301 → /socios** ✓ |
| 2 | `curl /empresas/<id>/pontes` | **301 → /empresas/<id>/socios** ✓ |
| 3 | GET aggregated sem auth | **401 AUTH_REQUIRED** ✓ |
| 4 | GET aggregated com admin logado | **200** + payload completo (socio + suasPontes + agregados + txPixDetected) ✓ |
| 5 | HTML `/empresas/<id>/socios` | **200**, title "Sócios \| CAIXAOS" ✓ |

**Defense in depth descoberto durante smoke:** UserB sem `UserCompanyRole` é
bloqueado em camada anterior (403 antes do endpoint). Proteção em prod MAIOR
que nos testes (que mockam contexto pra cobrir o cenário "RBAC ok + perfil
inexistente"). Zero risco real.

**Cleanup pós-smoke:**
- Sócio smoke + userB temporário deletados
- Senha admin revertida ao hash bcrypt original (PWD_REVERTED=OK)
- /tmp limpo (zero arquivo de teste)

**Counts finais (idênticos baseline):** users=5, transactions=2907,
socios_pf=1, pj_to_pf_bridges=0.

**Documentação:**
- `docs/sprints/unificar-socios-pontes.md` — plano + decisões A-F
- `docs/sprints/pf-dashboard.md` — próxima sprint pendente (Dashboard PF
  estilo Mobills/Organizze, propostas 6 zonas + 5 decisões)

**Métricas:**
- 8 arquivos novos + 3 modificados (+1944 linhas)
- TS strict 0
- Build prod: ✓
- Suite 4322/4322 (+11)
- Migration aplicada: **0** (zero ALTER, zero CREATE TABLE)
- PM2 ↺ 247 online após reload
- Backup 651K · 443 itens

**Próximo passo:** **Sprint Dashboard PF** (`docs/sprints/pf-dashboard.md`).
Yussef vai aprovar as 6 decisões do plano (layout 6 zonas, cortes,
endpoint evolução mensal, etc) e parte pra construção. Endpoints
de dados (Fatia 1-4) já existem, falta só camada visual.

Alternativas que podem ser priorizadas em vez do Dashboard PF:
- **Ligar PDF Vision** (depende ZDR Anthropic — frente externa)
- **Asaas 3D** (retomar pagamento prod)
- **Fatia 5 PF** (Família/multi-perfis compartilhados)
- **Refactor categoria genérica** (`docs/decisoes/categoria-pj-nominada-vs-generica.md`)

### 03/06/2026 (parte 6) — Sprint Dashboard PF (Mobills/Mercury) deployada

**Contexto:** Yussef priorizou Dashboard PF logo após Unificar Sócios (mesma
sessão). 6 zonas verticais + reuso máximo dos endpoints das Fatias 1-4.
Sessão anterior travou no smoke test final (depois do PM2 reload e build OK).
Sessão atual confirmou: deploy COMPLETOU em prod antes do travamento.

#### Sprint Dashboard PF ✅ DEPLOYADA EM PROD
**Branch:** `feature/dashboard-pf` → main em `a963f74` (commit feat `db26759`).

**O que mudou (100% UI + 1 endpoint, ZERO migration):**
- `/perfis/[id]/page.tsx` reescrita em 6 zonas verticais:
  1. **PFHero** — gradient esmeralda + saldo grande + sparkline + 3 sub-KPIs
     + saldo previsto com cheque especial
  2. **PFTopExpenses** ("a bola") — donut Recharts 220px + lista lateral
     + hover interativo no centro + drill-down link
  3. **MonthlyEvolutionChart** — ComposedChart 12m (barras entradas+saídas
     + linha saldo cumulativo)
  4. **DiferenciaisGrid** — 3 cards: Bridge PJ→PF (linka pra /socios coerente
     com unificação), Recorrentes (top 5 + total anual), Cartões (barra
     limite usado verde/amber/red)
  5. **RecentActivityPF** — timeline 8 últimas tx + avatar semântico
     CREDIT/DEBIT + categoria color dot + flags 🌐 internacional + parcela
  6. **PFFooterStrip** — contas (até 4 visíveis) + pendentes (estado
     celebração quando 0)

**Endpoint novo:**
- `GET /api/perfis/[id]/evolucao-mensal?months=12` (Prisma groupBy)
- `lib/dashboard-pf/aggregate-monthly.ts` — função PURA testada (virada
  de ano, saldo cumulativo retrocedendo, tx fora da janela)

**Empty states caprichados** (dashboard começa vazio):
- Donut 🥧 / Evolução 📈 / Bridge 🌉 / Recorrentes 🔁 / Cartões 💳 /
  Recent 📋 / Contas / Pendentes 0 = 🎉 "Tudo em dia"

**Reuso máximo (zero refactor):**
- Sparkline do PJ (mesmo componente)
- `formatBRL`, padrão Card, Button shadcn
- BridgeBadge (Fatia 4) disponível
- Pattern dynamic ssr:false / client wrapper do PJ Dashboard (lição Next 16
  Sprint 1 PJ)

**🔗 Coerência com unificação Sócios:**
- Card Bridge linka pra `/empresas/<companyId>/socios` (NÃO `/pontes` legacy)
- Mantém privacidade Fatia 4 (queries filtradas por user)

**Testes (+18, suite 4322 → 4340):**
- aggregate-monthly (12) — virada de ano, saldo cumulativo, fora janela
- evolucao-mensal-endpoint (6) — auth + privacidade + shape resposta

#### Deploy passo-a-passo (resultado)

1. Backup `pg_dump -Fc` → `pre-dashboard-pf-20260603_155932.dump` (639K)
2. **Counts pré:** users=5, companies=3, subscriptions=5, transactions=2907,
   personal_profiles=1, personal_transactions=0, socios_pf=1,
   pj_to_pf_bridges=0, credit_cards=1
3. git pull → npm ci → swap → **prisma generate DEPOIS do swap** →
   migrate status: `Database schema is up to date!` (0 pendentes — confirmado
   ZERO migration)
4. `npm run build` ✓ (BUILD_ID `S2U9FtnsYUER6cMLZBkld`, mtime 16:02)
5. pm2 reload → ↺ **248** online

**Validação na sessão de fechamento** (sessão anterior travou no smoke):
- HEAD prod `a963f74` ✓
- migrate status limpo ✓
- PM2 online uptime 5h ↺ 248 ✓
- Endpoint `GET /api/perfis/<id>/evolucao-mensal` → HTTP **401**
  `{"erro":"Sessão expirada","code":"AUTH_REQUIRED"}` ✓ (porta 3001)
- `transactions=3014` (+107 uso real do Yussef hoje, NÃO deploy)
- `personal_profiles=2` (+1 = `nouraawni90@gmail.com` criou perfil dela às
  18:58, depois do deploy 16:02)

**🔒 Isolamento entre perfis CONFIRMADO no SQL:**
```
        user_email      |        profile_id         | isSelf | total_users_with_access
admin@contaia.com.br    | cmpxg38zj000omro5yw0v3xr0 | t      |                       1
nouraawni90@gmail.com   | cmpyfimdf002f6lippdy6ahgk | t      |                       1
```
Cada perfil tem APENAS 1 entrada em `user_personal_profiles` apontando pro
próprio dono. Privacidade Fatia 1/4 funcionando — admin não vê perfil da
Noura, Noura não vê perfil do admin. Multi-user PF rodando 100% isolado em prod.

**Métricas:**
- 15 arquivos no commit feat (+2164/-316 linhas)
- TS strict 0
- Build prod: ✓
- Suite 4340/4340 (+18 vs Unificar Sócios)
- Migration aplicada: **0** (ZERO ALTER, ZERO CREATE TABLE)
- PM2 ↺ 248 online
- Backup 639K · 408 itens

**Próximo passo:** Yussef decide próxima frente:
- **Ligar PDF Vision** (depende ZDR Anthropic — frente externa)
- **Asaas 3D** (retomar pagamento prod — `docs/sprints/PAGAMENTO-RETOMAR-AQUI.md`)
- **Fatia 5 PF** (Família/multi-perfis compartilhados + convites entre Users
  — agora que multi-user PF está validado em prod)
- **Refactor categoria PJ genérica** (`docs/decisoes/categoria-pj-nominada-vs-generica.md`)

### 03-04/06/2026 — Reformulação Conciliação no modelo Xero (Sprint A-effected B.1+B.2+B.3)

**Contexto:** Yussef usando a tela de conciliação Fase B atual (4 ações por linha + bulk
approve) com dados reais da Cacula Mix (pizzaria, 22 duplicatas Excel↔OFX conhecidas)
encontrou 3 problemas estruturais — a tela tinha ficado inventiva, não refletia o
modelo mental do negócio dele. Decisão: **copiar o Xero LITERALMENTE** (referência
mundial). Sprint dividida em B.1 + B.2 + B.3, branch `feature/sprint-a-matcher-hotfix`
mergeada em main em `f903bf5`.

**Histórico longo da branch (8 dias, 17 commits):** começou como hotfix do matcher
(Sprint A — relaxar filtro lifecycle pra incluir EFFECTED órfão), virou Sprint A-fix
(endpoint /match retorna candidate metadata embarcado — resolve N+1 fetch da UI), depois
Sprint A-effected (reconcile aceita EFFECTED órfão como candidato + transferência
cooperativa de category/supplier), depois Fase 1 (aba Já Conciliado + saldo banner),
depois Fase 2 (4 abas confidence + bulk-dry-run), depois Fase 2-fix (refreshKey do
banner + reverse-link guard descoberto via Lamana), e finalmente a reformulação Xero
(B.1+B.2+B.3) que substituiu toda UI.

#### Sprint A — Hotfix matcher
- `lib/conciliacao/find-candidates.ts` — relaxa filtro `lifecycle`: RAMO 1 (clássico
  PAYABLE/RECEIVABLE) + RAMO 2 NOVO (EFFECTED órfão, origin Excel/Manual, sem link)
- `lib/conciliacao/normalize-for-match.ts` (NOVO) — normalizer dedicado pra match
  (preserva nome do fornecedor, strippa só sufixos comerciais tipo "- Pagamento").
  Diferente do normalizeDescription da categorização (que cortaria o nome).
- 20 backfill PAYABLE+RECONCILED+null link → PENDING (`scripts/sprint-a-backfill-
  payable-orphans.ts`)

#### Sprint A-fix — endpoint /match embarca candidate metadata
Bug crítico: UI fazia GET `/api/transacoes/[id]` por candidato (N+1) que retornava
422 quando `bankAccountId IS NULL` (todas as candidatas EFFECTED órfão Excel sem
conta). UI silenciava com `.filter(r.ok)` → vazio. **Fix:** endpoint `/match`
embarca candidate metadata via Map lookup O(1). Performance caiu de 500-2000ms
(5 GETs sequenciais) pra ~100-200ms.

#### Sprint A-effected — reconcile aceita EFFECTED órfão
2 modos no reconcile:
- **CLASSIC** (Sprint 4.0.2): PAYABLE → EFFECTED + paymentDate=OFX.date + link.
- **ORPHAN** (NOVO): EFFECTED órfão → SÓ cria reconciledWithId + status=RECONCILED.
  NÃO mexe em lifecycle/paymentDate/date/bankAccountId/amount/description (Excel
  já tem a verdade contábil). **Backfill cooperativo Excel → OFX** quando OFX está
  com categoryId/supplierId nulos.
- Audit metadata grava `ofxBefore` + `ofxBackfilled` + `candidateStatusBefore` pra
  undo restaurar bit-pra-bit.

#### Fase 1 — Aba Já Conciliado + StatementBalance + filtros
- Aba "Já Conciliado" (HistoricoTable) com busca + Desfazer
- BalanceBanner topo (refreshKey adicionado na Fase 2-fix)
- Filtro de período + tipo (TipoSelector com heurística por `companyType`:
  restaurant/retail/industry → "apenas-pagamentos"; service/mixed → "todos")

#### Fase 2 — 4 abas confidence + bulk approve
- Alta confiança (≥90) / Revisar (70-89) / Sem match / Já conciliado
- Endpoint `bulk-dry-run` pré-classifica todas as OFX pendentes em batch
- BulkDryRunModal com checkboxes individuais + revisão antes de aplicar

#### Fase 2-fix — refreshKey + reverse-link guard (caso Lamana)
Yussef descobriu **triplicação Lamana** (cadastro duplicado Excel #1 +
Excel #2, 1 OFX). Excel #1 já conciliada → Excel #2 aparecia como
candidata pra mesma OFX. Fix em **4 camadas de defesa em profundidade**:
1. `bulk-dry-run` filtra `reconciledFrom: { none: {} }`
2. NOVO endpoint `ofx-pendentes` (substituto de `/api/transacoes` na UI) filtra reverso
3. `/api/conciliacao/match` rejeita 422 quando reverso existe
4. `lib/reconcile` rejeita ANTES do UNIQUE constraint

#### Reformulação B.1 — UI Xero literal
Yussef parou: "PARA de inventar. Vamos COPIAR o Xero EXATAMENTE."
- `StatementBalanceHeader` (NOVO) substitui BalanceBanner colorido → 2 números
  sóbrios "Saldo do extrato (banco)" e "Saldo no sistema" + linha "→ R$ X a
  conciliar pra bater"
- 4 abas Xero literais: **Reconcile** (default) / Cash coding (placeholder Fase C) /
  Bank statements (link `/imports`) / **Account transactions** (HistoricoTable)
- `XeroRow` (NOVO) substitui ConfidenceList/RowActions:
  - **Esquerda:** card box com Date/Description/Reference/**Spent**/**Received**
    em colunas distintas (cópia fiel Xero — facilita scan)
  - **Direita:** card com **4 tabs** (Match/Create/Transfer/Discuss) + menu "..."
    com IGNORAR (não polui as 4 tabs)
  - **Fundo verde claro** (`bg-emerald-50/40`) quando há match auto
  - Cinza/branco quando sem sugestão
  - Botão **OK verde** + link **"Find & Match"** azul no rodapé

#### B.2 — Find & Match inline (single-select)
Resolve caso "auto-match não acha mas a nota existe":
- NOVO endpoint `GET /api/conciliacao/find-and-match` — busca AP/AR pendentes
  + EFFECTED órfão por description/supplier/CNPJ/externalId/amount exato. SEM
  janela de data (busca manual permite tolerância infinita).
- `FindAndMatchPanel` (NOVO) **inline takeover** do card direito: header
  "Statement: X · Selected: Y · Diff: Z" + busca debounced + tabela com checkbox
  + botão Reconcile só ativa quando Diff ≤ R$ 0,01.
- **Descoberta crítica no smoke real:** A CIA DA FRUTA da Cacula (R$ 3.786,78)
  é um **PIX consolidado N:1** — 13 candidatas, **7 notas somam R$ 3.786,77**.
  Schema atual `reconciledWithId @unique` BLOQUEIA N:1. B.2 ficou single-select
  com banner detector amarelo avisando "vem na B.3".

#### B.3 — N:1 multi-select + Desfazer grupo
Migration aditiva `20260619000000_conciliacao_fase_b3_n_to_one`:
- `DROP INDEX transactions_reconciledWithId_key` (era unique index, não constraint
  — descoberto no 1º deploy attempt que falhou)
- `CREATE INDEX transactions_reconciledWithId_idx` (não-único)
- `ADD COLUMN reconcileGroupId String?` nullable (NULL implícito em 3014 linhas)
- `CREATE INDEX transactions_reconcileGroupId_idx`

**4 camadas substituem o @unique removido:**
1. Guard `reconciledFrom.length > 0` no reconcile (só dispara quando
   `!input.allowMultiReconcile`)
2. Flag `allowMultiReconcile` só passa via endpoint dedicado
3. **Validação SOMA == OFX.amount (±R$ 0,02)** ANTES de chamar reconcile
4. Multi-tenant: todas candidates checadas na mesma empresa do OFX

**Endpoints novos:**
- `POST /api/conciliacao/find-and-match/reconcile` — N:1 com groupId compartilhado
- `POST /api/conciliacao/desfazer-grupo/[groupId]` — atomic loop undoReconciliation

**UI:** Find & Match multi-select habilitado. HistoricoTable agrupa por
`reconcileGroupId` (useMemo `GroupedEntry { single | group }`) com header azul
"Grupo N:1 · N notas", soma, lista filhas compacta, botão "Desfazer grupo (N)".

**lib/conciliacao/reconcile.ts:**
- Param `allowMultiReconcile` + `reconcileGroupId`
- Pula validação valor exato no N:1 (cada candidate individual NÃO bate; soma
  é validada upstream)
- Propaga groupId em ambos modos CLASSIC + ORPHAN
- `undoReconciliation` limpa `reconcileGroupId` no UPDATE

**Smoke real CIA DA FRUTA end-to-end na Cacula (com reverso completo):**
```
OFX: cmpygh3g4000ns76djiatdouh R$ 3.786,78
14 candidatas → escolheu 7 que somam R$ 3.786,77 (diff 1¢ dentro de ±2¢)
DRE ANTES: R$ 90.823,66
groupId gerado: rg_smoke_b3c28ed7
7 reconciled atomic
DRE PÓS: R$ 89.486,13 (-R$ 1.337,53 — 4 EFFECTED órfãs saíram do realizado)
reconcileGroupId NOT NULL: 0 → 7
Reconcilied With Id NOT NULL: 3 → 10
Todas as 7 apontam pra mesma OFX: true ✓

UNDO grupo: 7 undone
DRE PÓS UNDO: R$ 90.823,66 == ANTES ✓ (bit-pra-bit)
reconcileGroupId NOT NULL: 7 → 0
Conciliações antigas (Nestle/Lamana/DISTRIB): intactas ✓
```

#### Stats consolidadas
- **8 dias** (27/05 → 04/06) — 1 das maiores branches do projeto
- **17 commits** na branch + 1 merge
- **+8.209 / -288 linhas** no merge final
- **+39 arquivos novos** (lib + endpoints + componentes + tests + docs)
- **3 migrations aditivas:**
  - `20260617000000_pf_fatia_4_ponte_pj_pf` (já existia, não dessa sprint)
  - `20260618000000_conciliacao_fase_b_ignorar_cashcoded` (5 colunas pra IGNORAR + CRIAR)
  - `20260619000000_conciliacao_fase_b3_n_to_one` (DROP @unique + reconcileGroupId)
- **2 backfills idempotentes** (PAYABLE órfãos → PENDING + categoria órfã)
- **Suite:** 4322 → **4417** (+95 testes), TS strict 0
- **0 ALTER em dados reais** (3014 transactions intactas durante todas migrations)
- **PM2 ↺ 247 → 261** (12 reloads de deploy)

#### Próximo passo (Yussef decide)
**Recomendação:** Yussef pode CONCILIAR DE VERDADE agora na tela B (sem esperar Fase C).
- **Pagamentos** (caso Cacula — 22 duplicatas + CIA DA FRUTA + IGNORAR falsas):
  resolve 100% com a tela Xero atual (Match auto + Find & Match N:1 + menu IGNORAR).
  Fase C (cash coding) é OTIMIZAÇÃO pra recebimentos varejo (alto volume PIX
  maquininha), NÃO pré-requisito pra limpar duplicação atual.
- **Recebimentos avulsos** (vendas pizzaria): podem esperar Fase C (cash coding
  em lote) — não causam duplicação de DRE (cada uma é entrada única).

### 04/06/2026 (parte 2) — Fase B.4 (Ajustes Juros/Tarifas/Descontos) + 3 bugs UX

**Contexto:** Yussef conciliou 14 singles 1:1 + 4 grupos N:1 na Cacula
(incluindo CIA DA FRUTA com 7 notas → 1 PIX). DRE caiu de R$ 91.700
(inflado) pra R$ 71.766 (24 ligações conciliadas). Pediu Ajustes
(Juros/Multas/Descontos) ANTES de continuar — caso real "boleto R$
5.000 pago atrasado R$ 5.070" não conciliava.

#### Fase B.4.1 — Backend ajustes (commits `0fefc36` + `3e78bc0`)

**Templates 4 categorias** (`lib/conciliacao/adjustment-categories.ts`):
- JUROS_MULTAS_BANCARIAS (EXPENSE, DESPESAS_FINANCEIRAS)
- TARIFAS_BANCARIAS (EXPENSE, DESPESAS_FINANCEIRAS)
- DESCONTOS_OBTIDOS (INCOME, RECEITAS_FINANCEIRAS) ← diferencial vs Xero
- AJUSTES_ARREDONDAMENTO (EXPENSE, OUTRAS_DESPESAS, threshold R$ 1)
- `applicableTemplates(diff)` dropdown adaptativo pelo sinal do Diff

**Endpoints:**
- `GET /api/conciliacao/adjustment-categories` (status por empresa)
- `POST .../create-defaults` (idempotente, match SÓ por nome exato após
  smoke ter pego match frouxo "Taxa Cartão" como Juros)
- `POST /find-and-match/reconcile` estendido com `adjustments[]`
  validando soma + sign INCOME/EXPENSE batem com categoria
- `POST /desfazer-grupo/[groupId]` estendido — DELETE atomic pra
  `origin='ADJUSTMENT'` + audit preservado

**Lib `create-adjustment.ts`** (função pura testável):
- `buildAdjustmentTxData` cria tx com origin='ADJUSTMENT', lifecycle=
  EFFECTED, reconciledWithId=NULL (entra no DRE direto), reconcileGroupId
  compartilhado com candidates do grupo
- Decisão crítica: ajuste TEM reconciledWithId=NULL (não filtrado pelo
  DRE) E reconcileGroupId aponta pro grupo (undo deleta junto)

**Tests +31** (4417 → 4448): templates + suggest/applicable + build data
defensive. Zero migration.

**Smoke real Cacula:** AP R$ 121 + Ajuste R$ 0,50 = OFX R$ 121,50 ✓ →
DRE +R$ 0,50 (ajuste entra na categoria Juros) → UNDO grupo deleta
ajuste → DRE volta exato.

#### Fase B.4.2 — UI ajustes (commit `4deb86d`)

`components/conciliacao/adjustment-controls.tsx` (3 exports):
- `AdjustmentMenu` dropdown adaptativo no rodapé do Find & Match
- `AdjustmentForm` form inline (categoria preset + descrição auto
  "Juros — [supplier]" + valor pré-fill do diff)
- `EnsureAdjustmentCategoriesModal` opt-in 1º uso

Integrado em `FindAndMatchPanel.tsx`:
- State `adjustments[]` (cap 3 — decisão Yussef #6)
- Diff calc: `sum(candidates) + sum(adjustmentsSigned)`
- Reconcile só ativa quando `|diff| <= 0.01` incluindo ajustes
- Reconcile body passa `adjustments[]` com `categoryId/amount/sign/description`
- Toast "X reconciled + N ajuste(s)"

**4 casos reais identificados na Cacula pra Yussef testar:** 4 boletos
PODAL DISTRIBUIDORA com diff R$ 1,00 exato (boleto+juros típico).

#### 3 bugs UX (commits `747ebf5` v1 falho + `ae2022c` v2 correto)

Yussef reportou 3 bugs em sequência. 1ª tentativa errou a causa raiz nos
bugs 2 e 3 — ele provou via screenshot que continuavam quebrados. 2ª
tentativa achei as causas REAIS:

**Bug 1 — Modal Classificar cortado:** `DialogContent max-w-lg` (512px)
apertado + texto sem `break-words`. Fix: `max-w-2xl w-[calc(100vw-2rem)]
break-words` no `AprenderEAplicarModal`.

**Bug 2 v1 falho → v2 correto:** v1 só fixou `selectEmpresa` em PF.
**Causa real:** Dashboard é Server Component que NÃO conhecia
workspaceType (cookie não existia). Yussef dava F5 em `/dashboard` com
workspace PF → server renderiza dashboard PJ (Cacula) enquanto switcher
client mostra PF.

v2 correto:
- NOVO cookie httpOnly `caixaos_workspace_type`
- NOVO endpoint `POST /api/workspace/atual` (set) + GET (lê)
- `workspace-context.setWorkspace` sincroniza cookie SEMPRE (antes só
  setava profileId quando PF)
- `dashboard/page.tsx`: lê cookie ANTES de queries. Se `pf` + profileId
  → redirect server-side pra `/perfis/[id]`

**Bug 3 v1 falho → v2 correto:** v1 mexeu em `tipoLocked` mas tipo no
state já estava correto. **Causa real:** race condition entre fetches
concorrentes.

Sequência:
1. Mount sem URL tipo → Promise A (tipo='todos') dispara
2. Heurística roda → setTipo('apenas-pagamentos') → Promise B dispara
3. Se A resolve depois de B → `setOfxTxs(A.data)` sobrescreve B
4. Lista mostra CREDIT mesmo seletor mostrando "Só pagamentos"

v2 correto: `useRef<AbortController>` em `fetchOfxTxs` e `fetchDryRun`.
Aborta o anterior antes de cada novo fetch. Defesa adicional: `if
(ref.current === controller)` antes de `setState` (Promise abortada
não sobrescreve).

**Validação SQL direta confirmou** que a query com filtro funciona: tipo
DEBIT retorna 19 tx, 0 CREDIT na Cacula. O fix garante que a query
RECEBA o tipo correto sem ser sobrescrita por Promise stale.

**Lição:** quando user diz "fix não funcionou", causa raiz REAL é
outra. v1 sempre olhei o sintoma (state local), v2 olhei o que server
realmente recebe (cookie ausente, Promise stale).

#### Estatísticas do dia (sessão única)
- 6 commits feat/fix (`0fefc36` → `ae2022c`)
- Tests 4417 → 4448 (+31, ajustes templates + create-adjustment)
- Suite verde sem regressão
- TS strict 0 · zero migration
- PM2 reloads: 263 → 266
- 24 conciliações reais na Cacula (DRE caiu R$ 19.934 — de R$ 91.700
  inflado pra R$ 71.766)

#### Próximo passo (Yussef decide)

Casos restantes Cacula pra zerar a duplicação completa:
- 6 duplicatas Excel #2 conhecidas (R$ 8.714,43) — DELETAR ou IGNORAR
- 2 conciliações revisar (TURATTI↔DIVINE + PREFEITURA↔ECO VERDE — pode
  ter sido erro ou cadastro estranho)
- 211 OFX CREDIT órfãs (vendas PIX maquininha — Fase C cash coding em
  lote, ainda não construída)
- 1 OFX DEBIT futura (PAGAMENTO CONSORCIO R$ 1.478,51 em 09/06)

DRE atual: R$ 71.766. Estimado real pós-desdup: ~R$ 63k.

### 05/06/2026 — Hardening UX/segurança em sequência (sessão maratona)

**Contexto:** sessão longa cobrindo 12 frentes de hardening do produto após
auditoria UX real do Yussef testando contas de teste e CSV próprio. Todas
shipadas em prod (PM2 ↺ 271 → 279), zero migration, suite 4452 → 4530
(+78 testes).

| # | Sprint/fix | Commit | Suite |
|---|---|---|---|
| 1 | Seletor empresa duplicado em /conciliacao removido (usa WorkspaceSwitcher) | `fc19540` | 4452 |
| 2 | Card de transferência detectada no import OFX mostra 2 lados completos | `632eeb4` | 4456 |
| 3 | Conciliar item não joga scroll pro topo (update otimista) | `5da6343` | — |
| 4 | Modal "aprender e aplicar" com lista completa + checkbox + outliers | `0212c5e` | 4461 |
| 5 | Visual conciliação nível Mercury/Linear + 2 abas + busca local | `46099b3` | 4482 |
| 6 | OFX categorizada some da Conciliação (sync Pendentes ↔ Conciliação) | `fd13628` | — |
| 7 | Badge sidebar bate com aba + zera em workspace PF | `5a7321c` | — |
| 8 | Badges Pendentes+Conciliação batem com telas (consórcio futuro, ORPHANs) | `d44c434` | — |
| 9 | Sidebar reordenada por fluxo de trabalho (Bancos vira Cadastro) | `0d90c17` | — |
| 10 | Rate limit por (IP+email) + backoff progressivo + reset OK | `5c90366` | 4502 |
| 11 | Import Excel: nunca pular linha em silêncio + 3 ações por pendente | `cdb717e` | 4513 |
| 12 | CSV import: detecção encoding (UTF-8/ANSI/UTF-16) + separador TAB + diagnóstico | hoje | 4530 |

**Highlights do dia:**

**#10 Rate limit (Sprint Rate-Limit-Login):** Yussef ficou travado 7min
após errar senha 2-3x. Filtro por IP só vazava entre emails — família/NAT
travavam-se mútuo. Refatorei pra (IP+email) com backoff progressivo
(1-3=0s, 4=30s, 5=60s, 6=180s, 7+=300s teto) + guarda IP 20/15min +
reset no login OK + UI link "Esqueci senha" amber após 2 falhas. Política
fail-open em qualquer exceção: rate limit NUNCA bloqueia login legítimo.
Smoke 5/5 com IP forjado `192.0.2.1` + emails `@test.invalid`.

**#11 Import transparência (Sprint Import-Transparência):** Yussef importou
38 contas, sistema disse 35 — 3 sumiram em silêncio (`NEEDS_REVIEW` por
`favorecidoConfidence < 0.7`). Pior: `stagedPayableRow.deleteMany` após
confirm apagava evidência. Fix sem migration reusando `userDecision`:
confirm NÃO deleta mais, marca outcome (`IMPORTED`/`NEEDS_REVIEW`/`EXCLUDE`),
response ganha `skippedRows[]` detalhado, novo endpoint `resolve-row`
com 3 ações por linha (IMPORT/IMPORT_EDITED/EXCLUDE), UI com tiles
"Importadas · Excluídas por você · Puladas pelo sistema" + lista de
pendentes editáveis inline. Badge âmbar `⚠ Precisa decisão` preventivo
na review.

**#12 CSV encoding (Sprint CSV-Encoding):** CSV BR exportado do Excel deu
"batch sem linhas". Causa raiz: `Buffer.toString('utf8')` quebra
Windows-1252 (ANSI BR padrão) — acentos viram U+FFFD → mapping não acha
"Descrição" etc. Fix:
- `lib/csv-import/decode-bytes.ts`: detecção via BOM (UTF-8/UTF-16 LE/BE)
  + heurística >1% replacement chars → Windows-1252
- `parse-csv.ts`: `detectSeparator` ganha TAB (vence só com maioria
  absoluta pra evitar falso positivo)
- `lib/csv-import/diagnose-csv.ts`: orquestrador puro retorna
  `{encoding, separator, headers, dataLineCount, previewRows, mapping,
  warnings}` em pt-BR
- `upload/route.ts` substitui decode raw por diagnose; quando
  `dataLineCount === 0`, retorna 422 `CSV_NO_DATA` com diagnóstico
  embarcado no body
- UI `CsvDiagnosticDetail`: banner expansível com encoding + separador
  + cabeçalhos lidos + linhas de dado + mapping (verde/vermelho por
  campo) + preview 3 linhas + lista de warnings
+17 testes com fixtures binárias (latin1/utf16le/ansi BR).

**Lições registradas pra futuras sessões:**

- **Sincronização badge ↔ tela**: badge da sidebar precisa usar
  EXATAMENTE o mesmo filtro do endpoint da tela. Filtros divergentes
  geram desinformação de gestão. Padrão: contagem por mesmo `where:`.
- **Período em fila de trabalho**: default `'todos'` (Xero/QuickBooks
  pattern). Período vira filtro opcional. Data futura (consórcio
  pré-datado) sempre conta — é trabalho real pendente.
- **Pulada em silêncio = bug grave em sistema financeiro.** Toda linha
  precisa estar em alguma categoria visível (importada / excluída por
  user / pulada pelo sistema com motivo). Total arquivo sempre bate.
- **Fail-open em rate limit**: política de segurança é nunca impedir
  login legítimo por bug do limiter. Try/catch em toda função, qualquer
  exceção retorna `allowed: true`.
- **Encoding-aware** em qualquer importação de CSV BR: Excel salva em
  Windows-1252 por padrão. UTF-8 strict só funciona em arquivos US ou
  exportados por sistema moderno (web).

### [Próxima sessão] — preencher
- Data:
- O que foi feito:
- Próximo passo:

---
