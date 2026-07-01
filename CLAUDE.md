# Conta IA — CLAUDE.md operacional

> **Hierarquia de docs (ler ao iniciar sessão):**
> 1. **`CLAUDE.md`** (este) — regras vivas + estado + convenções. Injeção de contexto <200 linhas (padrão Anthropic).
> 2. **`CLAUDE_HISTORY.md`** — log integral de 23+ sessões (29/04 → 05/06/2026). Consultar sob demanda com grep pra contexto de "por que X foi feito".
> 3. **`docs/CONTA-IA-NORTE.md`** — visão estratégica 12 meses.
> 4. **`docs/DASHBOARD-PLAN.md`** — plano do Dashboard Mundial.
> 5. **`docs/DEPLOY.md`** — guia técnico deploy.
> 6. **`docs/sprints/PAGAMENTO-RETOMAR-AQUI.md`** — retomar frente Asaas 3D.
> 7. **`docs/sprints/pf-fatia-3.5-LIGAR-PDF.md`** — ligar PDF Vision quando ZDR assinado.
>
> **Conflito:** operacional (aqui) > estratégico (NORTE) > histórico (HISTORY).

---

## Visão geral

**Conta IA** — SaaS de gestão financeira para PMEs BR. Domínio `contaia.com.br`. Tagline "seu contador inteligente que nunca dorme". Diferenciais: (1) IA agentica que aprende contabilidade BR, (2) pronto para Reforma Tributária 2026 (IBS/CBS), (3) Open Finance nativo (Pluggy — FASE 10), (4) multi-empresa PJ + PF, (5) preço acessível. Pricing: Starter R$149 / Business R$399 / Enterprise R$999.

## Stack real

Next.js 16.2.4 (App Router) · TypeScript 5 strict · Prisma 5.22 · SQLite dev / Postgres 16 prod · Tailwind 3.4 + shadcn/ui · React 18.3.1 · JWT `jose` + `bcrypt` (rounds 12) · Zod 3 · Vitest 2 · Recharts 3.8 · Framer Motion 12. Path alias `@/*` = raiz. Textos UI em pt-BR.

## Estado atual (01/07/2026)

- **PJ:** Sprint 0.5 + 1 + 3.0.4 + 5.0.4.0a/b/c1 + Gestão de Conta + Asaas 3A/B/C + Reformulação Conciliação Xero B.1/B.2/B.3/B.4 deployados.
- **PF:** Fatia 1 (Fundação) + 2 (Cartão) + 3 (OFX+IA) + 3.5 (PDF Vision GATED) + 4 (Bridge PJ→PF) + Dashboard PF deployados.
- **Recente (30/06-01/07):** Redesign Sócios Mercury/Ramp (nomenclatura "Retirada" nunca "Ponte") · Fluxo unificado retirada (aba "Retiradas pendentes" + convite pós-categorização) · CategoryCombobox unificado 14/16 telas · UI parear transferências (`/transferencias/parear` expõe `POST /api/transferencias/pair-pendentes` Sprint 1.7) · dashboard-summary aceita `?mes=` + fallback auto-detect último mês com dados · placeholder Fase B.3 conciliação vira link útil.
- **Suite:** 6.029 testes verdes · TS strict 0.

Contexto detalhado de qualquer sprint acima → `CLAUDE_HISTORY.md`.

## Servidores / IPs

| Ambiente | IP | Path | Nome |
|---|---|---|---|
| **CAIXAOS prod** (Conta IA) | **198.211.103.10** | `/opt/conta-ia` | `contaia-prod` |
| **AcadOS prod** (outro projeto) | **167.172.159.101** | — | `acados` |

⚠️ **NUNCA confundir**: `AcadOS` NÃO é Conta IA. Sempre confirmar `hostname` + `pm2 jlist` `pm_cwd` antes de SSH/deploy. Dev local Mac: `/Users/yussef/Projects/conta-ia` (`macbook`). PM2 app: `conta-ia`, porta 3001 atrás de nginx.

## IDs críticos (Cacula = empresa teste principal)

- **Empresa Cacula Mix:** `cmq17yapb00gnrndlh33sctbo` · CNPJ `29756732000198`
- **Contas:** Stone `cmq182qfr0005aktn6q2ugpv2` · Banrisul `cmq17z90v00qxrndl02kfn4iz` · Sicredi `cmq180ksv0001aktni9wj64mq`
- **SocioPF Yussef (Cacula):** `cmq1cqrjk00cj50toproqbscy`
- **PersonalProfile Yussef:** `cmq1crgsz00cn50toa9zty4uy`
- **User admin:** `admin@contaia.com.br` (plano `inteligencia` GRANTED)

## Modelo de dados (chaves críticas)

Multi-tenant via `bank_accounts.companyId`. `transactions` NÃO tem `companyId` direto (JOIN via `bankAccount`).

- **`AiLearningRule.companyId` é NULLABLE** (Sprint PF Fatia 3): tabela compartilhada PJ+PF, escopo alternativo via `profileId` + `personalCategoryId`. Migration `20260615000000_pf_fatia_3_ofx_ia`.
- **Sem `bridgeId` em `transactions`** (Sprint PF Fatia 4): 2.907 linhas reais protegidas. Detecção "tem ponte?" via `pj_to_pf_bridges.pjTransactionId` UNIQUE. Relação reversa Prisma expõe como `transaction.bridge`.
- **`PJtoPFBridge`** colunas: `pjTransactionId @unique`, `pfTransactionId @unique`, `profileId`, `socioPFId`, `kind`, `amount`, `date`, `spendTransactionId`, `spendAcknowledged`. Model/URL usam "Bridge/pontes" — user vê "Retirada".
- **`transferGroupId`** em `transactions` — par TRANSFER (Sprint 0.5). `reconcileGroupId` — conciliação N:1 (Sprint Xero B.3, migration `20260619000000`).
- **`Transaction.status`**: PJ segue escada categoryId NULL⇒PENDING · NOT NULL⇒RECONCILED (com exceções IGNORED/CASH). PF nasce sempre RECONCILED por design (Fatia 3).
- **`Transaction.lifecycle`**: PAYABLE/RECEIVABLE (aberto) vs EFFECTED (realizado). `paymentDate` em PAYABLE/RECEIVABLE é **INVÁLIDO** — transição para EFFECTED sempre explícita (import Excel isPaid, mark_paid bulk, staging OFX confirm, ajustar-saldo, conciliação reconcile).

## Rotas & redirects 301

- `/pessoas-vinculadas` → `/socios` (Sprint Unificar 03/06)
- `/empresas/:id/pontes` → `/empresas/:id/socios` (idem)
- `/relatorios` → per-empresa via cookie (Sprint 5.0.4.0a)
- `/empresas/:id/dre` e `/dre-gerencial` → `/empresas/:id/relatorios/dre-gerencial` (statusCode 301 explícito em `next.config.mjs`)

## Regras de negócio críticas

- **Multi-empresa**: user ilimitado por plano; cada empresa dados isolados; IA aprende por empresa (não mistura).
- **Reforma Tributária 2026**: NF-e deve destacar IBS 0,1% + CBS 0,9% a partir de 01/01/2026. Sistema calcula créditos + alerta Split Payment.
- **PJ → PF**: PIX/TED entre conta PJ e CPF do sócio classifica como Distribuição de Lucros (dreGroup `DISTRIBUICAO_LUCROS`, non-DRE) OU Pró-labore (`DESPESAS_PESSOAL`, afeta DRE). Não é despesa operacional.
- **Detecção transferência interna** (`lib/conciliation/active-transfer-detector.ts` Sprint 5.0.2.u): 6 regras rígidas — ambas PIX, blacklist, CNPJ terceiro, anti-pessoa (rejeita se descrição tem nome), ±0 dias (same-day), confidence ≥0.85. Auto-apply ≥0.95.
- **Import Excel — NUNCA pular linha em silêncio** (Sprint 05/06 Hardening): confirm marca outcome (IMPORTED/NEEDS_REVIEW/EXCLUDE), response detalha `skippedRows[]`, endpoint `resolve-row` com 3 ações por linha. Toda linha visível na tela em alguma categoria.
- **CSV encoding-aware** (Sprint 05/06): BOM detect (UTF-8/UTF-16 LE/BE) + heurística >1% replacement chars → Windows-1252 fallback (Excel BR salva ANSI). `detectSeparator` inclui TAB. Endpoint 422 `CSV_NO_DATA` com diagnóstico completo.
- **Conciliação lifecycle** (Sprint 5.0.4.0c1 bug-fix): categoria = ferramenta de classificação; lifecycle = estado financeiro. Ao categorizar tx em `/pendentes`, NUNCA mudar lifecycle. Toda transição de lifecycle é explícita (paths auditados: staging/confirm OFX, mark_paid bulk, ajustar-saldo, conciliacao/reconcile, import Excel com isPaid).

## Privacidade Bridge PJ→PF (5 decisões multi-sócio A-E)

Sprint Fatia 4 03/06 — quando 2+ sócios usam a MESMA empresa:
- **A.** Lista `/empresas/:id/socios` filtra `profileId ∈ owned_by_user_logado`.
- **B.** Badge de retirada na tx PJ para terceiros é anônimo (sem nome/conta destino).
- **C.** GET `/pontes/:id` retorna 404 para quem não é dono nem criador (não revela existência).
- **D.** Sugestão de destino filtra por `userId` (sócio B não vê CPF do A).
- **E.** Visão consolidada anonimizada para ADMINISTRADOR societário fica pra Fatia 6+.

⚠️ **Categoria PJ nominada vaza nome sócio** (`docs/decisoes/categoria-pj-nominada-vs-generica.md`) — refatorar para categoria genérica ANTES do 2º sócio entrar em qualquer empresa.

## Cartão PF — regras (Sprint Fatia 2)

- **`closingDayRule`** ATUAL (default) vs PROXIMA — compra no dia do fechamento vai pra qual fatura.
- **Parcelamento clamp** 31/jan → 28/fev via `addMonths` genérico (`lib/dates/add-months.ts` — extraído do webhook Asaas). Máx **24 parcelas**.
- **Estorno em fatura paga** → crédito automático na próxima fatura (não devolve dinheiro).
- **Pagamento parcial** → `carryoverFromInvoiceId` na próxima + tx rotativa + juros manual (user informa).
- **Anuidade manual** (não calculada automaticamente).
- **USD/cashback/pontos FORA de escopo** — só R$ real, transações de crédito no extrato do banco.
- **Limite real-time**: OPEN + CLOSED + PARTIAL contam; PAID não.

## Conciliação — invariantes (Sprint Xero B.1/B.2/B.3)

- **N:1 via `reconcileGroupId`** — 1 OFX pode casar com N contas a pagar (soma ≤ R$ 0,02 do OFX.amount).
- **4 camadas de defesa** (substituem @unique antigo removido):
  1. Guard `reconciledFrom.length > 0` no reconcile (só dispara sem `allowMultiReconcile`).
  2. Flag `allowMultiReconcile` só via endpoint dedicado.
  3. Validação soma == OFX.amount ±R$ 0,02 ANTES de reconcile.
  4. Multi-tenant — todos candidatos na mesma empresa do OFX.
- **Endpoint `POST /api/transferencias/pair-pendentes`** (Sprint 1.7) casa 2 tx PENDING existentes como par TRANSFER atomic (revert saldos → delete → create par → apply). UI em `/transferencias/parear` (Sprint 01/07). NÃO confundir com `POST /api/transferencias` (`createTransfer`) que CRIA 2 tx novas — usar isso pras existentes duplica.

## IA — regras

- **Modelo**: Claude Sonnet 4.6 para insights narrativos · Haiku 4.5 para categorização em lote.
- **SDK**: fetch direto sem `@anthropic-ai/sdk` (padrão `lib/ai-categorizer/claude-client.ts`).
- **Cache 1h no DB** (não Redis — projeto não tem). Tabela dedicada `AiInsightsLog` (separada de `AiUsageLog`).
- **PDF Vision GATED** em prod: `PDF_IMPORT_ENABLED=false` + `PDF_IMPORT_ZDR_CONFIRMED=false` explicit. Só liga com **AMBAS true** após ZDR assinado com Anthropic. Doc: `docs/sprints/pf-fatia-3.5-LIGAR-PDF.md`.

## Ordem de deploy (PJ + PF)

Sequência **crítica** (bug pego na Fatia 1 quando `npm ci` rodou `prisma generate` antes do swap):

```
git pull origin main
./scripts/swap-prisma-to-postgres.sh       # troca schema sqlite→postgres
npm ci --legacy-peer-deps
npx prisma generate                         # ⚠️ DEPOIS do swap
npx prisma migrate status                   # confirma migrations pendentes
npx prisma migrate deploy                   # aplica
npm run build
pm2 reload conta-ia --update-env
pm2 list | grep conta-ia                    # confirma online
```

`pg_dump -Fc` em `/var/backups/conta-ia/pre-<sprint>-YYYYMMDD-HHMMSS.dump` **antes** de toda migration.

## Segurança & LGPD

- **Senhas** bcrypt rounds 12 · **JWT** cookie httpOnly · **Zod** em toda rota · **Multi-tenant** isolation via `companyId` (transactions) e `profileId` (personal).
- **Rate limit login** (Sprint 05/06): por `(IP+email)`, backoff progressivo (0/0/0/30s/60s/180s/300s teto), guard IP 20/15min, reset no login OK, UI link "Esqueci senha" após 2 falhas. **Fail-open** em qualquer exceção do limiter (nunca bloquear login legítimo).
- **NUNCA** `cat .env` nem echo credenciais em logs.
- **NUNCA** confundir CAIXAOS vs AcadOS — confirmar IP + hostname antes de SSH/deploy.
- **NUNCA** mexer em senha do admin em prod.

## Pegadinhas Asaas (Sprint 3A/3B/3C — em uso ativo)

1. **`$` na `ASAAS_API_KEY`** precisa escape `\$` no `.env` (dotenv-expand faz expansão shell — chave vira string vazia sem escape). Aspas simples/duplas NÃO bastam. Validação: `node -e "loadEnvConfig('.'); console.log(process.env.ASAAS_API_KEY.length)"`.
2. **Conta Asaas precisa CHAVE PIX cadastrada** — `POST /v3/payments` retorna 200 mas `pixTransaction` null; `pixQrCode` depois 400 `invalid_action`.
3. **`POST /v3/checkouts` RECURRENT + customerData** exige TODOS os 9 campos (name/email/cpfCnpj/phone/address/addressNumber/postalCode/city IBGE/province) OU NENHUM. MVP usa "nenhum" — hosted Asaas coleta.
4. **Webhook token hex** NÃO precisa escape `$` (é hex puro do `openssl rand -hex 32`).
5. **Webhook auth header**: `asaas-access-token` (não `x-webhook-secret` nem `Authorization`).

## Anti-padrão: validação visual obrigatória (Sprint 5.0.4.0a)

DoD que envolve **sidebar, rota, link, redirect, layout** exige validação em browser real (ou curl -i pra redirect, ou screenshot). **"Código escrito" ≠ "DoD cumprido"**. Se ambiente não permite browser: DECLARAR limitação e pedir smoke test do Yussef ANTES de fechar sprint. Nunca marcar DoD visual ✅ sem olhar com olhos humanos.

## Definição de Pronto (DoD) — regra crítica

Sprint não é "entregue" sem TODOS: (1) unit/integration tests passando, (2) build sem erros, (3) TS strict 0, (4) teste E2E real no browser com fixture real + contagem numérica, (5) smoke test em prod pós-deploy (PM2 online, curl 200, fluxo crítico), (6) relatório com evidência numérica + PNGs + logs limpos, (7) `pg_dump` antes de deploy com mudança de schema/lógica financeira. Cenários E2E obrigatórios cobrem: upload (válido + limit + tipo errado + re-upload + retry), form multi-step (golden + voltar/avançar + validation), CRUD (criar/editar/deletar/filtros/paginação), conciliação (match 1-1 + split + ignore).

## Migrations em tabelas com dados reais

Toda migration além de "100% aditiva pura" (CREATE TABLE, ADD COLUMN nullable ou com default em tabela SEM dados) exige seção **"⚠️ ALTERs em tabelas com DADOS REAIS"** no plano com tabela: tabela | operação | tipo | linhas afetadas | risco | mitigação. Confirmação pós-migration com evidência objetiva: COUNT antes/depois, `is_nullable`, distribuição, FKs/índices intactos, query típica retornando dados certos. Risco Alto: DROP COLUMN, RENAME, backfill não-idempotente, migração entre tabelas.

## Padrão de Relatórios CAIXAOS (Sprint 5.0.4.0a)

Todos os relatórios financeiros em `/empresas/:id/relatorios/<nome>`. `/relatorios` global redirect per-empresa via cookie. Estrutura: Breadcrumb "← Voltar pra Relatórios" · Header título+subtítulo · Filtros (período/comparações/tipo) · 3-4 stats cards · Conteúdo (tabela/gráfico) · Drill-down clicando linhas. Cores semânticas: receitas `emerald-600` · despesas `red-600` · positivos `emerald` bold · negativos `red` bold · estável `slate` · crescimento `↑↑ red >+50%` / `↑ amber +15-50%` / `━ slate ±15%` / `↓ sky -15-50%` / `↓↓ sky escuro <-50%` · novidade `🆕 purple` · sumiu `✕ slate-400`. DRE existente (`lib/dre/*`) é REUSADO — mesma fonte da verdade.

## Convenções de código

TypeScript strict em tudo · commits semânticos (feat/fix/refactor/docs/test/chore) · Zod em toda rota API · textos UI pt-BR · logs de erro em pt-BR · comentários em pt-BR quando explicam regra de negócio · shadcn/ui · path alias `@/*`. Design system atual: cards limpos, `tabular-nums`, Framer Motion `stagger 30ms` `easeOutExpo`, gradient hero `#185FA5→#0F4A8C`, semântica de cor (emerald/rose/amber/slate), radius consistente.

## Pendências / débitos técnicos

- **Asaas 3D** (produção real de pagamento) — playbook em `docs/sprints/PAGAMENTO-RETOMAR-AQUI.md`. Sandbox 3A+B+C deployados; falta ativar webhook + smoke + virar chave prod.
- **PDF Vision** — gated até Yussef assinar ZDR com Anthropic. Doc: `docs/sprints/pf-fatia-3.5-LIGAR-PDF.md`.
- **Rotação senha Postgres prod** — higiene pós-Asaas 3C (senha apareceu em texto durante debug). Sem vetor externo conhecido, mas fazer quando puder.
- **Categoria PJ genérica** — refatorar antes do 2º sócio entrar em qualquer empresa (`docs/decisoes/categoria-pj-nominada-vs-generica.md`).
- **Fase B.3 Conciliação completa** — hoje aba "Transfer" da conciliação linka pra `/transferencias/parear`. Fase B.3 real seria parear inline dentro da conciliação + migration `discussNotes` pra aba Discuss.
- **Detector de transferência interna** (`active-transfer-detector.ts` regra 4 anti-pessoa) — conservador demais para o padrão "Stone anota nome do sócio ordinante em PIX interno". Melhoria: reconhecer nome de SocioPF cadastrado como "próprio" (não terceiro).

## Workflow

- **Início de sessão**: ler CLAUDE.md por completo · confirmar com Yussef qual frente antes de codar.
- **Sprint pattern** (opção 2 = execução completa em sessão única):
  1. FASE 0 — `pg_dump -Fc` prod (sempre, mesmo sem migration se envolve prod).
  2. FASE 1-N — implementar em fases claras.
  3. Deploy no fim: git push → prod pull → build → PM2 reload → smoke sem auth (401 esperado) + smoke com SQL (invariantes intactos).
- **Confirmar IP CAIXAOS 198.211.103.10** sempre antes de SSH/deploy.
- **NUNCA** mexer em senha admin em prod. **NUNCA** confundir com AcadOS.
- **Testar contra Conta Azul** (referência de mercado) — se comportamento nosso é pior/menos claro, é regressão.

## Log de sessões

Detalhamento cronológico integral de 23+ sessões (29/04/2026 → 05/06/2026) em **`CLAUDE_HISTORY.md`** — consultar com grep pra contexto de "por que X foi feito assim" ou como uma feature evoluiu. Sessões 30/06-01/07 (Redesign Sócios, Fluxo Retirada Unificado, Parear Transferências) ainda pendentes de registro no HISTORY — a próxima sessão de manutenção deve consolidá-las.

## Links úteis

- Pluggy: <https://docs.pluggy.ai> · <https://meu.pluggy.ai>
- Claude API: <https://docs.claude.com>
- Reforma Tributária: <https://www.gov.br/fazenda/reforma-tributaria>
- NF-e 2026: <https://www.nfe.fazenda.gov.br>
- shadcn/ui: <https://ui.shadcn.com> · BrasilAPI: <https://brasilapi.com.br>
