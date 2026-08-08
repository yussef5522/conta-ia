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
- **⚠️ `PersonalTransaction` (PF) NÃO TEM `lifecycle`** (07/08). Qualquer transação criada no PF **nasce como realizada** (`status` default RECONCILED) — não há estado intermediário (PAYABLE/RECEIVABLE) nem preview. Estruturalmente o PF é **mais frágil** que o PJ: no PJ a linha futura vira PAYABLE (agendada) e o sistema distingue; no PF viraria RECONCILED direto. **Cuidado em QUALQUER fluxo que cria transação no PF** (import OFX/PDF, ponte PJ→PF, cartão). O descarte de movimento futuro (`partitionFutureLines`) já protege os imports PF; modelar `lifecycle` no PF é mudança estrutural pendente (não feita).
- **Descarte de movimento futuro (07/08)**: extrato só registra o passado — linha OFX/PDF com data futura (`> DTASOF` **E** `> hoje BRT`, ou FITID YYMMDD Banrisul) é **DESCARTADA no import**, não vira tx (nem PAYABLE). Helper único `lib/ofx/future-line.ts` (`partitionFutureLines`); TODOS os caminhos de import de extrato usam (guard `__tests__/import-descarte-futuro-guard.test.ts`). Saldo âncora só soma EFFECTED (`recalcularSaldoConta`). Validação de fechamento: Σ(EFFECTED) x LEDGERBAL → avisa se não bater. **DÉBITO com prioridade:** `app/api/empresas/[id]/import/staging` é um fluxo de staging de OFX (só `parseOFX`) que cria tx no confirm SEM descarte de futuro — torneira aberta. **Uso real: 0 linhas (nunca usado);** os 572 `staged_payable_rows` são do fluxo Excel `contas-pagar/import` (outro, futuro intencional). Recomendação: DESLIGAR o `import/staging` (ninguém usa) ou aplicar o helper no confirm.

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

**Dependência de SISTEMA (não-npm):** `poppler-utils` (binário `pdftotext`) — usado pelo enriquecimento de contraparte por PDF (`lib/bank-statement-pdf/extract-pdf-text.ts`, único ponto que invoca poppler). **Servidor novo nasce quebrado sem isso** — incluir no provisionamento: `apt-get install -y poppler-utils`. Validar com `which pdftotext`. Instalado no CAIXAOS em 31/07/2026.

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
- **Contraparte é dado pessoal de terceiro** (Sprint Contraparte PIX 31/07): `Transaction.counterpartyName` e `counterpartyDocument` (nome/CPF/CNPJ de favorecido/pagador do PIX) são DADO PESSOAL sob LGPD. Mesmo gate de permissão das transações; **NUNCA logar em log de aplicação** (nem em diagnóstico — mascarar sempre). Não alimentam `stableKey`/`computeCacheKey` (que usam `description`) — vivem só nessas colunas. Precedência de origem `MANUAL > OPEN_FINANCE > OFX > PDF_STATEMENT` centralizada em `lib/counterparty/precedence.ts`. Parser determinístico do PDF: `lib/bank-statement-pdf/banrisul-parser.ts` (texto, sem Vision). Join read-only: `lib/counterparty/join-pdf-statement.ts`.

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
- **Modelo de saldo não separa ABERTURA de MOVIMENTO** (Sprint Saldo-V2 31/07) — `recalcularSaldoConta` SEM âncora `ledgerBal` assume abertura=0 e faz `balance = Σ(tx)`. Contas com abertura digitada (ex: "banco caixa" caçula = R$ 22.000) seriam ZERADAS por um recalc/backfill ingênuo. Hoje mitigado porque todo import OFX grava `ledgerBal` (modo âncora nunca assume 0). **Risco:** qualquer recalc em massa sem âncora corrompe abertura. **Fix próprio:** modelar abertura como tx `SALDO_ABERTURA` ou campo `openingBalance` distinto. **NUNCA rodar backfill de saldo sem âncora sem antes resolver isto.**
- **REND CDB não vem no OFX do Banrisul** (Sprint CDB 02/08) — o rendimento do CDB (única parte que é RECEITA financeira legítima) tem **0 ocorrências no OFX** da profit itaqui (`REND=0`, `APLICA=26`); só aparece no PDF. Aplicação/resgate já viram transferência (fora do DRE) via reclassificação; IOF/rendimento têm categoria financeira. **Gap:** o rendimento fica de fora até ser capturado. Caminhos futuros: (a) importar do PDF junto com a contraparte (o parser já lê "REND CDB AUT" + valor — só virar lançamento em "Rendimentos de Aplicações"); (b) lançamento manual; (c) Open Finance. Valor pequeno na profit itaqui (centavos/dia), material em conta grande. Frente futura, não implementado.
- **CDB — conta de investimento vinculada (desenho A)** (Sprint CDB 02/08) — feito o desenho B (reclassificar aplicação/resgate como TRANSFERENCIA, fora do DRE, via `cdb-reclass`). O desenho A (conta `accountType=INVESTMENT` + pernas-espelho) tornaria o **saldo do CDB visível** e fecharia a divergência CC vs app do banco (CC 3.984,64 vs banco 11.785,06). Não é bug de correção (o CC está certo); é UX. Frente própria — cria lançamentos (com preview+confirmação).
- **CAIXAOS não modela INVESTIMENTO / aplicação automática** (Sprint Saldo-V2 31/07) — Banrisul e Sicredi varrem o saldo da conta corrente pro CDB diariamente. O OFX `LEDGERBAL` traz só a conta corrente (ex Pro Fit: 3.984,64); o PDF "SALDO DISPONÍVEL" soma CC + CDB (ex: A=CDB 7.857,32 + B=CC 3.927,74 = 11.785,06). O cliente vê 3.984,64 no CAIXAOS e 11.785,06 no app do banco e acha que está errado. **Atinge TODO cliente com aplicação automática** (nicho do produto). **Frente de produto:** conta de investimento vinculada, ou ao menos exibir "saldo em aplicação" ao lado do saldo em conta.
- **Parser de agenda da CAIXA (Demonstrativo de Evolução Contratual) — PRONTO** (Sprint Parser Caixa 06/08) — antes só entendia Sicredi. Agora `lib/loans/bank-parsers.ts` roteia por cabeçalho (`detects()`), layout desconhecido → "banco não suportado", não "nenhum contrato Sicredi". `lib/loans/caixa-schedule-parser.ts` contra o `pdftotext -layout` REAL (fixture `__tests__/fixtures/caixa-1837311.txt`). **⚠️ colunas ≠ Sicredi:** "Valor da Parcela"=AMORTIZAÇÃO, "Valor total pago"=TOTAL, juros no movimento Tipo=Juros; `encargosTotais = total − amort` (=juros+enc+resíduo). **Resíduo de mora** (2º encargo não-listado, cresce #18 3,62…#29 18,13) → despesa financeira; parser ABORTA se resíduo<0 ou amort>total (nunca grava leitura errada). **Carência** (11 meses): capitalização fora das parcelas/DRE, reportada à parte. **N PG:** total-pago 0 → usa agendado amort+juros. Saldo ancorado no "Saldo Devedor Atualizado" do cabeçalho (ignora artefato da última linha, ex 102.427,10). `contractNumber` verbatim zero-padded → match exato com o Loan. Lê `Indexador` (vazio=pré). Preview validado read-only (nada gravado): saldo 17.275,32→14.116,29, pagas 29→30, parcela 30 amort 2.615,76+juros 311,26=2.927,02, DRE +445,67. **1837311 IMPORTADO (06/08)** — `scheduleSource=IMPORTED`, prazo 48, PRICE, saldo 14.116,29, 30 pagas, parcela 30 (27/07) amort 2.615,76+juros 311,26, resíduo de mora embutido no `interest` das atrasadas (#18 896,81 … #29 445,67, total 59,80), vínculo N:1 da #29 preservado. **⚠️ o confirm pela TELA não gravou** (sem log de confirm; DB inalterado) — apliquei via replicação exata do confirm route (`applyImportedSchedule` + write em $transaction, fixture .txt). Frontend está correto (guardas + toasts); **hipótese:** o `pdftotext` do servidor (poppler CAIXAOS) renderiza o PDF diferente do `.txt` gerado no Mac do Yussef → preview pode ter mostrado `matched:false` ("nada a aplicar"). **DIAGNÓSTICO DO CAMINHO DA TELA (06/08, com o PDF real):** `pdftotext -layout` no servidor (poppler 24.02.0) = **byte-idêntico** ao .txt do Mac (mesmo sha256) → hipótese pdftotext DESCARTADA. Parser reconhece + casa no texto do servidor. Testei os **endpoints REAIS com sessão autenticada** (token assinado do dono da caçula, PDF via multipart, igual ao browser): **preview → HTTP 200** (matched=true, blocked=false) e **confirm → HTTP 200** (`applied:[{parcelasGravadas:31, saldo:14116.29}]`). Ou seja, **o caminho da tela FUNCIONA de ponta a ponta** (upload+auth+permissão `transaction.update`+parse+apply). A página usa `readJsonResponse` (erro vira toast, não some). **Causa provável da falha anterior:** timing — tentativa antes do deploy do parser OU durante um reload do PM2 (os `E57P01` "terminating connection" nos logs coincidem com deploys). Não reproduzível agora. **Teste de aceite do usuário (browser):** fazer fresh no **1827478** (nunca importado) — upload PDF pela tela → preview → confirmar → agenda muda. **PENDENTES:** (1) importar **1827478** (POS/SELIC — o parser lê indexador; Loan já é `rateType=POS`) — **subir o PDF**, não só o .txt, pra testar a tela; (2) corrigir o **deslocamento de vínculo** do 1837311 (tx de julho ligada à #29/venc 26/06 em vez da #30/venc 27/07) — encargos agora confiáveis, preview antes de gravar.
- **Caixa — nº de parcelas/carência agora DERIVADO por data (não contagem de linha)** (Sprint Carência-Fix 07/08) — o parser contava as linhas "CARÊNCIA" (a 1ª é a data de contratação, 0,00; a última é implícita → dava 1 a menos) e gravava prazo total como parcelas (48). Fix: `numParcelas` = meses da 1ª parcela ao último vencimento (inclusive); `carencia` = prazoTotal − numParcelas. **1837311 → 36 parc + 12 carência; 1827478 → 37 parc + 11 carência** (não é fixo). Validação aborta se carência+parcelas≠prazoTotal ou |pagas+remanescente−parcelas|>1. `termMonths`=parcelas, `Loan.carencia`=carência; tela mostra "36 parcelas (+ 12 meses de carência)" e progresso 30/36. **1827478 IMPORTADO pela TELA (07/08) — caminho da tela provado com import fresco** (POS/SELIC validado). **FASE 2 — Sicredi SEM bug:** os 4 contratos têm `termMonths` = parcelas amortizantes (Sicredi não tem linhas carência); carência stored 12 no C41022570, 0 nos outros (contagem certa). **PENDENTE:** re-importar 1837311 e 1827478 pela tela pra corrigir termMonths 48→36/37 + carência (preview mostra antes→depois; vínculos preservados, saldo não muda). Depois: deslocamento de vínculo 1837311 #29→#30 e o nó 1827478 #31.
- **Deslocamento de vínculo Caixa — RESOLVIDO (07/08)** — 3 pagamentos "DEBITO PRESTA SIEMP" (banco caixa) estavam no lugar errado, casados por VALOR exato: tx 2.927,02 (25/07) = 1837311 #30 (estava na #29); tx 3.013,41 (06/07) = 1837311 #29 (estava na #31 do 1827478); tx 3.007,84 (03/06) = 1837311 #28 (estava RECONCILED como "Juros sobre Empréstimos"/DESPESAS_FINANCEIRAS, sem vínculo — despesa cheia inflando o DRE, mesmo bug do C41033828). Fix: movi os vínculos + descategorizei a 3.007,84 e vinculei à #28 (split certo). **1827478 #31 ficou SEM vínculo** (paga pelo documento, sem tx de 7.358,36 no extrato → histórico, não forcei). DRE: jun DESPESAS_FINANCEIRAS 3.278,10→757,50 (−2.520,60, sai a amortização mal-categorizada), jul 867,85→756,93 (−110,92). Só vínculos + 1 categoria; nenhuma tx mudou valor/data; saldos inalterados. Contratos da Caixa 100% fechados.
- **⚠️ PADRÃO RECORRENTE — o orquestrador V2 (`import-orchestrator`/`runImportV2`) PULA funcionalidades que o V1 tinha** (registrado 06/08) — com `RECONCILE_V2=true` (prod), o confirm do OFX desvia pro `runImportV2`, que reimplementa o import do zero e **esqueceu de portar** o que o caminho legado fazia. **Já mordeu 3× nesta sessão:** (1) recálculo de saldo/`ledgerBal` (fix 019495f 31/07), (2) `categoryOverrides` do preview (fix 06/08), (3) detecção de transferência entre contas próprias (fix 06/08). **REGRA:** quem for mexer no V2 no futuro DEVE listar o que o V1 (`importar-ofx/route.ts` branch legado + libs que ele chama) faz e conferir item a item se foi portado. O V2 nasceu como "motor de conciliação" e foi ganhando responsabilidades do V1 sem paridade garantida.
- **Detecção de transferência entre contas próprias — REGRA 4 + valor-comum + porta de entrada** (Sprint Detecção-Transferência 06/08 — RESOLVIDO) — PIX de R$5.000 Banrisul→Sicredi (contas da mesma caçula) não casava; saída em Pendentes, entrada inflando "Receita de Vendas". **3 causas:** (a) `runImportV2` não chama detector nenhum (ver padrão acima); (b) REGRA 4 anti-pessoa (`active-transfer-detector.ts`) rejeitava porque o memo do Sicredi traz o nome do sócio ("...29756732000198 YUSSEF ABU ZAHRY MUSA") junto do CNPJ próprio — **fix:** pessoa numa perna que TAMBÉM tem o CNPJ próprio = sócio/titular, não terceiro; só rejeita pessoa em perna SEM CNPJ próprio; (c) R$5.000 é "valor comum" (10×/60d) → penalidade −0.30 derrubava 0.99→0.69 < 0.85 — **fix:** CNPJ próprio explícito ignora a penalidade de valor comum (não é coincidência). **UI:** o `DetectarTransferenciasModal` era órfão (tela morta) → agora banner em Pendentes (`transferCandidates>0`) abre o modal de revisão; SUGESTÃO sempre, usuário confirma cada par, **nunca automático**. O detect roda no load de Pendentes = **scan retroativo** (reavalia todas as tx EFFECTED, resolve o caso "extratos importados em momentos diferentes"). `applyTransferCandidate` agora **zera `categoryId`** ao virar TRANSFER (DRE já exclui por `type=TRANSFER` em `calculator.ts:168`, mas evita tag fantasma em relatórios por categoria). **Tolerância de tarifa/multi-dia (FASE 4): NÃO implementada** — valor exato + mesmo dia mantidos; afrouxar aumentaria falso positivo com valores redondos. Transferência com tarifa (sai 5.000, entra 4.990) ou TED D+1 → parear manual em `/transferencias/parear`. **O par R$5.000 foi APLICADO (06/08)** — Banrisul TRANSFER/OUT + Sicredi TRANSFER/IN, entrada sem categoria, DRE jul Receita de Vendas 494.482,82→489.482,82 (−5.000), saldos intactos.
- **BUG CRÍTICO — `applyTransferCandidate` violava `transfer_has_direction` (apply do detector NUNCA funcionou)** (06/08 — RESOLVIDO) — o apply do detector cross-conta virava `type=TRANSFER` SEM setar `transferDirection`, violando a constraint `transfer_has_direction` (23514) → **nenhum par era conciliado, quebrado desde 14/06** (quando a constraint entrou). Foi o que fez a confirmação pelo banner "não gravar" (o clique dava erro). **Fix:** débito=`transferDirection:'OUT'`, crédito=`'IN'` (mesmo sinal de saldo que DEBIT/CREDIT já davam → saldo inalterado). **Regra:** QUALQUER caminho que vira `type=TRANSFER` DEVE setar `transferDirection` (`build-pair-pendentes` já fazia; `applyTransferCandidate` não). Constraint em `20260614231500`.
- **Padrão único anti-falha-silenciosa: `lib/http/fetch-json.ts`** (Etapa 1, 06/08) — `fetchJson<T>()` (sobre `safe-json`) SEMPRE retorna `{ok,data,message,aborted}`, nunca lança. **Regra nova pra todo fetch em tela:** `const {ok,data,message}=await fetchJson(...); if(!ok){toast(message);return}`. Mata os 3 padrões que faziam funcionalidade quebrar sem ninguém ver: `if(res.ok){}` sem else, `.catch(()=>{})`, `await res.json()` antes do ok (SyntaxError do WebKit). 6 call-sites críticos migrados (transacoes/contas-a-pagar/receber/conciliação/pendentes). Restam ~9 arquivos com `.catch(()=>{})` + ~18 `if(res.ok)` NÃO-críticos (periféricos — dropdowns/header) a migrar aos poucos. **Débito:** regra ESLint `no-restricted-syntax` banindo `.catch(()=>{})` em `app/(dashboard)` (não feita — evitaria reincidência).
- **Scan-retroativo default 0.70→0.85** (Etapa 1, 06/08) — `/transferencias/scan-retroativo` sugeria 23 pares FALSOS na caçula (tier MEDIUM 0.70–0.84, valores redondos). Default subido pra 0.85 (a 0.85 retorna 0 ruído, 0 par real perdido — o 5.000 já pareado). Quem quiser MEDIUM passa `minConfidence` explícito.
- **Paridade V1/V2 do import OFX — gaps MEDIDOS (Etapa 2, 06/08)** — medição real em Postgres scratch (`scripts/measure-v1v2-parity.ts`, guarda em `__tests__/reconciliation/v1v2-parity-gaps.test.ts`). **COBERTO (não é gap):** re-import do mesmo OFX → 0 novas (reconcileStatement dedup por stableKey, NÃO depende do ImportedIdentity ledger); categoryOverrides, ledgerBal/saldo, detecção-transfer (via banner). **Gap ALTO — SKIP decisions — RESOLVIDO (Etapa 3a, 06/08):** `runImportV2` agora recebe `decisions` do route e aplica `applyImportDecisions` (mesma função pura do V1) em missing+previews pela chave `dedupHashOFX` → linha SKIP não vira tx. Provado E2E scratch (5 linhas, 2 SKIP → 3 criadas; `scripts/e2e-skip-decisions.ts`). **NOTA:** o preview V3 (live, `OFX_IMPORT_V3_ENABLED=true`) usa marca **IGNORAR** (cria-e-marca via apply-marks), NÃO envia `decisions` SKIP — quem envia é o PreviewV2Classificado. Wiring V3→SKIP é **decisão de produto** (SKIP reaparece no re-import, pois não fica no banco pra dedup) — NÃO feito.
- **GAPS V1/V2 restantes (registrados, ordem de retomada)** — **Etapa 3b (MÉDIO):** V2 não auto-classifica por regra/keyword no import (tudo nasce PENDING; overrides manuais no preview funcionam desde 06/08). **Etapa 3b (BAIXO):** V2 não popula `fitidKey`/`contentHash` nem seed `ImportedIdentity` (dedup OK via reconcileStatement; efeito só em placeholder-reconcile de TRANSFER e auditoria). **Etapa 4:** motor ÚNICO de par de transferência (unifica os ~4 detectores — spec na tabela da PARTE 1 do diagnóstico: regras do active-transfer + janela D±1/±3 + gate de nome; shadow-run antes de trocar). **Etapa 5:** consolidar identidade em 3 chaves (unir `stableKey`+`contentHash`; mexe em dedup de dados reais → por último, com backfill dry-run). **Etapa 6:** builder único `toTransfer(tx,direction)`. Ordem por risco↑valor: 3b → 4 → 5 → 6. **Débito de fonte (Etapa 1):** regra ESLint banindo `.catch(()=>{})` em `app/(dashboard)` + migrar os ~9 arquivos/~18 `if(res.ok)` periféricos restantes.
- **DUPLICIDADE — detecção de par de transferência implementada ~4× com regras diferentes** (FASE 3 do sprint 06/08, REPORTADO não corrigido) — cada tela usa um detector diferente e eles DISCORDAM (a tela `/parear` dizia "nenhum par" enquanto o banner mostrava 99%): (1) `active-transfer-detector.ts` (`findActiveTransferCandidates`) — PIX/CNPJ/same-day, confiança, NÃO exige PENDING → banner Pendentes + `/parear` (após fix) + `/conciliation/detect-active-transfers`; (2) `parear-sugestoes` route — só valor±0,01 + data±3d, exige AS DUAS PENDING → era a fonte da tela `/parear`; (3) `detect-retroactive.ts` (fórmula `score-pair`) → `/transferencias/sugestoes` + `/sozinhas` + `/duplicatas`; (4) `scan-retroativo.ts` (score-pair + gate de NOME, MEDIUM 0.70) → `/transferencias/scan-retroativo` + import V1; + `detectar-transferencias` (per-conta, preview, exclui contraparte PENDING) e `ofx-v3/transfer-keyword`. **Fix aplicado agora:** `/parear` passou a exibir também o detector cross-conta (aditivo, não removeu o pair-pendentes manual) — some a contradição. **Débito de fundo:** unificar num único motor de par (frente própria, com preview — NÃO unificar sem). Mesma família do padrão "lógica duplicada em 2+ lugares" + "identidade de linha tem 4 chaves: `dedupHashOFX`/`stableKey`/`line-dedup-hash`/`compute-identity`".
- **Import OFX V2 (RECONCILE_V2) aplica categoria do preview — chave = `dedupHashOFX`** (Sprint Fix OFX V2 06/08 — RESOLVIDO) — regressão: com a flag ON, o confirm desviava pro `runImportV2`, que reparseava o arquivo e criava tudo `PENDING`/`categoryId` NULL, descartando os `categoryOverrides` (o `applyCategoryOverrides` do V1, L657 da route, é inalcançável com flag ON). ~1.078 tx recategorizadas à mão só na caçula em 14 dias. **Fix:** route repassa `categoryOverrides`; orchestrator casa cada override pela MESMA chave que o client usa — **`dedupHashOFX` (fitid|date|valor|memo)**, recomputado da `StatementLine` (idêntico ao `filtrarNovasOFX`). **NÃO é o `stableKey` nem o `dedupHash` de linha (`stableKey#importId:occ`)** — se alguém mexer nisso, casar por outra chave = override some em silêncio. Linha com categoria → RECONCILED+MANUAL+conf1 (espelha V1); sem/null → PENDING. `resolveLineOverride` puro testado; E2E real em Postgres scratch (`scripts/e2e-ofx-v2-override.ts`) passou. Decisão do Yussef (06/08): V1/`applyCategoryOverrides` é a rede de ROLLBACK (flag OFF) → **MANTER, não é código morto**. Ver débito do `v2-confirm` abaixo.
- **`importar-ofx/v2-confirm/route.ts` = código morto candidato a remoção** (Sprint Fix OFX V2 06/08) — **NENHUM client chama** este endpoint (o fluxo vivo é preview → `/importar-ofx` → branch RECONCILE_V2 → `runImportV2`). Confirmado por grep em `app/**` e `components/**`. **Decisão do Yussef (06/08): NÃO remover agora** — o fluxo de import já teve mudança demais hoje; remover código agora é risco sem ganho. **Fica pra uma limpeza própria, quando o import estiver estável por algumas semanas.** Ao remover, conferir de novo que segue sem caller (e checar `lib/ofx/v2-confirm.ts`, a lib que ele usa).
- **Ciclo de aprendizado de regra por CONTRAPARTE nunca provado E2E** (Sprint Enriquecer entry 03/08) — código deployado (`classificar-com-aprendizado` cria `AiLearningRule` `tipoMatch=CONTRAPARTE` + incrementa `vezesAplicada`; badge no modal `AprenderEAplicarModal`). A 1ª tentativa de teste nem chegou ao servidor (save incompleto do user, não bug). **Falta a prova viva:** categorizar 1ª ocorrência com "criar regra de contraparte" marcado → confirmar `AiLearningRule` nasce no banco → 2ª ocorrência do MESMO favorecido aparecer JÁ sugerida em `/pendentes`. Yussef vai testar com royalties da **PRO FIT ONE**. Fecha quando a 2ª ocorrência vier sugerida sozinha.
- **3 empresas do user em 3 logins separados** (Sprint Enriquecer entry 03/08) — profit itaqui (`nouraawni90@gmail.com`) / caçula (`yussefmusa5522@gmail.com`) / arafet (`alaa_hazem1993@hotmail.com`). O sistema JÁ suporta multi-empresa com seletor no topo; vincular as 3 ao mesmo user elimina o atrito de deslogar/logar. **Frente futura — NÃO mexer agora:** envolve `UserCompany`/`UserCompanyRole` (RBAC), precisa cuidado com permissão (qual login vira dono, que papel cada um tem, não vazar dado entre sócios). Diagnóstico read-only confirmou que "1 empresa" na tela é correto pro filtro atual (`GET /api/empresas` filtra por `UserCompany.userId`).
- **Liberação de empréstimo de anos anteriores como Receita de Vendas** (Sprint Casar Pagamento 04/08) — R$ 248.273,59 de liberações Banrisul "OP. CREDITO C/GARANTIA" (contratos 2021-2024) estão categorizadas como `Receita de Vendas` (RECEITA_BRUTA) na caçula, mais 1 Sicredi R$ 100.000 "LIBERACAO CREDITO-C61021346" como Aporte de Capital. **Decisão do usuário (04/08): NÃO mexer** — competências fechadas (2021/2023/2024), não afetam o período atual. **Para contratos NOVOS:** liberação = entrada de caixa com contrapartida em PASSIVO, NUNCA receita (inflaria faturamento, grave em Lucro Real). A FASE 6.3 (reclassificar) foi cancelada.
- **C61021766 = operação de crédito automática Sicredi (RESOLVIDO 05/08, caso isolado)** — o Sicredi abre um contrato ("conta garantida") pra cobrir uma parcela sem saldo e raspa a conta até quitar. Aconteceu 1× na caçula: 6 lançamentos em 20-21/07/2026 (R$ 7.294,40, terminando em "LIQUIDACAO CONTRATO-C61021766") pra cobrir a #22 do C41022227. **Decisão do usuário:** NÃO cadastrar o contrato nem construir tratamento próprio. Os 6 foram **categorizados como "Juros sobre Empréstimos" (DESPESAS_FINANCEIRAS)**, não como amortização — porque a #22 do C41022227 (7.139,85) já constará paga pelo documento oficial com o split correto (principal fora do DRE); lançar os 6 como amortização contaria o principal 2×. Despesa financeira evita a duplicidade, mantém fora do resultado operacional, é honesto (não é o ideal — parte seria principal — mas o caso é isolado). **Se voltar a acontecer com frequência, avaliar tratamento próprio.** Nota relacionada: a #22 do C41022227 vai ficar paga pelo documento SEM tx vinculada (o dinheiro veio da operação de crédito, não da conta corrente) — correto, não forçar vínculo.
- **Empréstimo 0% / FLEXIBLE — encargo SEMPRE zero no vínculo** (Sprint FLEXIBLE Arafat 06/08 — RESOLVIDO) — `computeLinkSplit` (`lib/loans/link-payment.ts`): `interestRateMonthly === 0` → `encargos = 0`, `amortização = valor pago inteiro`, `closing = opening − pago` (todo valor é baixa de passivo). Fecha o gap: devolver R$ 45.000 numa parcela nominal de R$ 41.428,57 NÃO cria R$ 3.571,43 de despesa financeira falsa. Confirm de vínculo (`vincular-parcela/confirm`): 0% sempre grava o split e move `amortization` pro valor pago. Saldo FLEXIBLE (`lib/loans/saldo.ts`) = `principal − Σamort(PAID)` (agenda nominal ignorada). UI (lista + detalhe): sem próxima parcela/progresso-por-parcela/cards de compromisso mensal, nunca "Atrasada", progresso em VALOR + histórico de devoluções. Gated 100% por `FLEXIBLE`/`rate===0` — os 8 bancários intocados. DRE inalterado (guard `encargos<=0`). Testes: `casar-pagamento.test.ts` + `saldo.test.ts`.
- **Dívida com a Arafat — mútuo sem juros, saldo 290k** (Sprint Dívida Arafat 05/08) — a caçula pegou R$ 340.000 emprestado da **Arafat (arafet thalji, empresa do grupo)** em mai/2026 SEM JUROS; devolveu 50k em 04/08; faltam **290.000** (devolução conforme caixa, 40-50k/mês). Cadastrado no módulo de Empréstimos como: credor "Arafat (arafet thalji)", saldo 290.000, **taxa 0%**, SAC nominal 7x, `scheduleSource='FLEXIBLE'` (NUNCA marca "Atrasada" — cronograma é só referência), na conta caixa loja/cofre, com `notes` explicando o contexto. **Entrada original dos 340k NÃO registrada** (competência mai/2026, decisão do usuário). Os 50k de 04/08 reclassificados de "Juros sobre Empréstimos" pra "Amortização de Mútuo (terceiros)" (TRANSFERENCIA, não-DRE) — **só categoria, SEM vincular** (o saldo 290k já é líquido; vincular abateria de novo → 240k errado). Categoria nova "Amortização de Mútuo (terceiros)" criada pra isso. Próximas devoluções: vincular ao empréstimo (encargo 0, abate saldo exato) — gap 0% já resolvido (item acima). **PENDENTE:** a reclassificação dos 50k de 04/08 (categoria) ainda NÃO foi gravada — mostrei o preview, falta o "confirma?" do Yussef.
- **DÉBITO DE UI — linha de empréstimo NÃO cadastrado trava o usuário** (Sprint Categorizar C61021766 05/08) — quando a detecção acha um nº de contrato NÃO cadastrado (`detect-payment.ts` kind `NOT_REGISTERED`), o `pendentes-client.tsx` **remove o dropdown de categoria** e deixa só o link "cadastrar". Isso PRENDE o usuário: não dá pra categorizar nem vincular — a única saída (no C61021766) foi gravar direto no servidor. Cliente real ficaria travado. **Corrigir:** a linha deve oferecer AS DUAS opções — "cadastrar o empréstimo" (sugestão) E o dropdown de categoria normal (saída padrão). Detectar empréstimo é SUGESTÃO, nunca remove a saída padrão — mesma regra do resto do sistema (sugere, usuário decide). Vale revisar também o kind `CONTRACT`/`CANDIDATES`: hoje substituem o dropdown; idealmente oferecem "Vincular à parcela" COMO destaque, mas mantêm categorizar acessível.
- **Casar pagamento de empréstimo — FASES 2-5 deployadas** (Sprint Casar Pagamento 04/08) — tela `/corrigir-agenda` aceita SAC+valor financiado+carência; detecção nos Pendentes (`detect-payment.ts`: contrato Sicredi direto, candidatos Banrisul/Caixa sem adivinhar); painel N:1 (`LinkPaymentModal`) agrupa débitos parciais → split amortização (fora DRE) + encargos (despesa financeira) via ponte `LoanInstallmentPayment`; DRE reinjeta encargos reais, agenda inválida → vincula sem injetar split. Aceite C41022570 validado read-only (21 tx jul = 5.951,33 → amort 4.166,66 + encargos 1.784,67). **Falta o usuário:** (1) corrigir a agenda do C41022570 pela tela (SAC, financiado 150.000, taxa 0,4868%/m pós, carência 12 juros capitalizados), (2) vincular os 21 lançamentos de julho. As 32 tx Sicredi seguem pendentes até isso.

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
