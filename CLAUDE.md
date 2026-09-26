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

## Lista de frentes — estado (10/08/2026)

Roadmap vivo (o Yussef prioriza; validação no browser é o que fecha). Suíte 6.446 verdes · TS 0.

1. **Dropdown que trava (empréstimo não cadastrado prendia o usuário)** — ✅ FEITO.
2. **Código morto (import/staging + v2-confirm) removido** — ✅ FEITO (guard impede voltar).
3. **Repo privado** — ⏸️ ADIADO. Gatilho (não data): antes do 1º cliente pagante de fora OU 3º com dado no sistema. Passos meio-andados no débito abaixo.
4. **Ponte PJ→PF completa** — ✅ FEITO e validado no browser (10/08): abre ao categorizar (WithdrawalPanel) · lucro na tela (Apurado/Distribuído/Disponível + "desde MM/AAAA") · banner de órfãs (Transações+Pendentes, some ao zerar) · lote com preview (`/empresas/[id]/retiradas`) · **fluxo A/B ("já gastei esse dinheiro")** no painel E no lote.
5. **PDF do Banrisul no import de OFX** — ✅ FEITO. Convite inline pós-import (só quando a conta é Banrisul `bankCode='041'` **E** o import criou tx nova → 0 novas = 0 convite). Caminho validado; falta ver na prática no próximo extrato com movimento. Histórico (394 tx sem nome) via `/enriquecer-contraparte` (mês a mês), intocado.
6. **Motor único de par de transferência** — 🔄 EM CURSO (FASE 4 concluída em código; falta o par REAL em prod pra aposentar o legado). Motor único de 3 camadas em `lib/transfers/unified-transfer-engine.ts` (fonte única `detect-transfers-for-company.ts`, flag `UNIFIED_TRANSFER_ENGINE`). **Migradas (4 telas vivas, todas provadas CONCORDANDO):** tela 1 (banner Pendentes) + tela 2 (/parear) + tela 3 (/revisar-aguardando-par) + **tela 4 (modal "Vincular transferência" DENTRO dos Pendentes — `/transferencias/candidatas/[id]` + `VincularTransferenciaModal`)**. **Falta:** só o par real em prod → então remover os motores legados. **⚠️ ERAM ~7 LUGARES, NÃO 4** (a contagem inicial "4×" era por MÓDULO nomeado; a real por CALL-SITE é ~7). **Como os escondidos foram achados:** varredura por MÓDULO não pega lógica **inline** dentro de uma route/componente — o que achou os 3 extras (revisar/candidatas + os applies) foi **grep por CONSTANTES e comparações soltas** (`CENT_TOLERANCE`/`0.01`, `MAX_*_DELTA_DAYS`/`±3`, janela de dias, e o par de sinais opostos `CREDIT`↔`DEBIT` com `bankAccountId` diferente). Qualquer trecho que compara valor≈valor + data±N + sinal oposto É um detector de par, tenha nome ou não. **CONTRASTE dedup vs par (por que um foi centralizado e o outro não):** a **identidade de linha** (dedup) já era centralizada em `computeIdentity`/`stableKey` — nasceu como 1 helper compartilhado porque o import é UM fluxo (todo mundo passa pelo mesmo confirm). O **par de transferência** espalhou porque cada TELA cresceu seu próprio detector no lugar (banner, parear, revisar, modal) sem uma lib comum — nunca houve o "confirm único" que forçasse a centralização. Lição: quando N telas precisam da MESMA decisão, a decisão vira lib (`classifyTransferPair`), não código copiado por tela; senão as telas DISCORDAM (a `/parear` dizia "nenhum par" com o banner mostrando 99%). **LIÇÕES:** (a) **o SINAL manda, o valor é secundário** — escola/entregador/"chat gpt" não são transferência independente do valor; a camada 3 só entra com sinal de transferência (keyword forte OU entidade própria) e sem terceiro (weak caiu 83→2); (b) a regra "2× PENDING" (motor B) estava na SUGESTÃO **e** no APPLY (`pairPendentes` linha 55) — as duas saem, o par com perna RECONCILED tem que aparecer; (c) o CNPJ próprio no memo do PIX é a vantagem estrutural que Xero/QuickBooks não têm (camada 1, 0.99); (d) **concordância DENTRO da mesma tela:** o modal Vincular e o banner co-existem em Pendentes — se discordassem o user veria os dois ao mesmo tempo. Ambos chamam `classifyTransferPair`/`apply-active-transfers` → impossível discordar. **Identidade em 3 chaves = FASE 5 SEPARADA** (item abaixo/débitos), não junto do motor.
7. **CDB / liberação de empréstimo / empréstimo concedido** — ⏳ pendente (frentes de produto; ver débitos CDB + "liberação como Receita").
8. **Vazio ("empty state") da tela da ponte PJ→PF** — ⏳ pendente.

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
- **Saldo caixa loja/cofre conferido pelo usuário contra o dinheiro físico em 08/08/2026: 4.988,82, confere.** A âncora "Ajuste de saldo inicial" de 8.946,25 (06/06) está correta. (O erro de julho era uma entrada manual de 7.000 "saque do banco" lançada por engano — apagada em 08/08; o saldo voltou ao valor real.)
- **⭐ AGOSTO/2026 É O MARCO DE REFERÊNCIA DA CAÇULA (14/08).** Saldos das 5 contas conferidos contra o LEDGERBAL em 13/08 (Banrisul −2.644,08, Sicredi −66.685,57, Stone 240,19 — as 3 OFX batem exato; banco caixa e cofre são manuais), **0 buraco de período** (15 dias úteis com extrato completo em Banrisul/Sicredi/Stone). Meses anteriores têm erro conhecido e foram **dados por encerrados por decisão do usuário**. **Daqui pra frente o padrão é MANTER fechado** — todo import novo tem que preservar isso.

## Modelo de dados (chaves críticas)

Multi-tenant via `bank_accounts.companyId`. `transactions` NÃO tem `companyId` direto (JOIN via `bankAccount`).

- **`AiLearningRule.companyId` é NULLABLE** (Sprint PF Fatia 3): tabela compartilhada PJ+PF, escopo alternativo via `profileId` + `personalCategoryId`. Migration `20260615000000_pf_fatia_3_ofx_ia`.
- **Sem `bridgeId` em `transactions`** (Sprint PF Fatia 4): 2.907 linhas reais protegidas. Detecção "tem ponte?" via `pj_to_pf_bridges.pjTransactionId` UNIQUE. Relação reversa Prisma expõe como `transaction.bridge`.
- **`PJtoPFBridge`** colunas: `pjTransactionId @unique`, `pfTransactionId @unique`, `profileId`, `socioPFId`, `kind`, `amount`, `date`, `spendTransactionId`, `spendAcknowledged`. Model/URL usam "Bridge/pontes" — user vê "Retirada".
- **`transferGroupId`** em `transactions` — par TRANSFER (Sprint 0.5). `reconcileGroupId` — conciliação N:1 (Sprint Xero B.3, migration `20260619000000`).
- **`Transaction.status`**: PJ segue escada categoryId NULL⇒PENDING · NOT NULL⇒RECONCILED (com exceções IGNORED/CASH). PF nasce sempre RECONCILED por design (Fatia 3).
- **`Transaction.lifecycle`**: PAYABLE/RECEIVABLE (aberto) vs EFFECTED (realizado). `paymentDate` em PAYABLE/RECEIVABLE é **INVÁLIDO** — transição para EFFECTED sempre explícita (import Excel isPaid, mark_paid bulk, staging OFX confirm, ajustar-saldo, conciliação reconcile).
- **⚠️ `PersonalTransaction` (PF) NÃO TEM `lifecycle`** (07/08). Qualquer transação criada no PF **nasce como realizada** (`status` default RECONCILED) — não há estado intermediário (PAYABLE/RECEIVABLE) nem preview. Estruturalmente o PF é **mais frágil** que o PJ: no PJ a linha futura vira PAYABLE (agendada) e o sistema distingue; no PF viraria RECONCILED direto. **Cuidado em QUALQUER fluxo que cria transação no PF** (import OFX/PDF, ponte PJ→PF, cartão). O descarte de movimento futuro (`partitionFutureLines`) já protege os imports PF; modelar `lifecycle` no PF é mudança estrutural pendente (não feita).
- **Perfil por banco — `lib/bank-profiles/` (FASE 2, 12/08)**: cada banco preenche o OFX diferente; uma regra única quebra. Ficha DECLARATIVA por banco (`registry.ts`), resolvida **pelo BANKID do arquivo** (não pelo `bankCode` do DB, que pode estar errado), com `rationale` legível (o PORQUÊ + evidência da FASE 1). Adicionar banco = adicionar objeto; mudar um = editar o objeto dele (isolado, provado por `__tests__/cross-bank.test.ts`); banco desconhecido → `resolveBankProfile` devolve `null` → **avisa, não adivinha** (`bankProfileWarning`, tem que ir pra TELA). Campos: `dateAnchor` (DTASOF vs LAST_REAL_TX), `listsFutureMovements`, `fitidStability` (STABLE/MOSTLY/PER_DOWNLOAD), `counterpartySource` (MEMO vs PDF_ONLY), `ledgerBalReliable`, `acctIdFormat`. **Fichas (FASE 1, contra OFX reais):** Banrisul(041): DTASOF=emissão, lista futuro, **FITID PER_DOWNLOAD** (renumera recentes — 7 de 44 mudaram dl07×dl11), **único sem favorecido no OFX (NAME==MEMO) → PDF_ONLY**. Sicredi(748): **DTASOF no FIM DO MÊS (futuro) → LAST_REAL_TX**, não lista futuro, favorecido no MEMO. Stone(197): DTASOF=emissão, **FITID UUID STABLE**, favorecido no MEMO, ACCTID formatado. Caixa(104): **ficha INCOMPLETA (0 OFX salvo) → conservador + avisa**. `resolveStatementAnchor` é a única regra JÁ implementada (pura, testada); **wiring no pipeline = próximo passo** (item 2: fazer a validação Σ×LEDGERBAL voltar a morder no Sicredi). Regra dura generalizada: **DTASOF > hoje → LAST_REAL_TX** (cobre Sicredi e qualquer banco futuro).
- **⚠️⚠️ BANRISUL — LEDGERBAL do OFX embute BLOQUEADO +24h; o "SALDO NA DATA" do PDF é a verdade final (15/08, o juiz quase descartou pagamento REAL 2×).** Caso: a #23 do 064956967 (4.092,02, venc 11/08) FOI paga em dia via limite da conta garantida. O PDF prova pelo "SALDO NA DATA" impresso (recon do dia 11: 680,94 +332,22 −4.092,02 −60 −1.478,51 = −4.617,37 = exato). Mas o OFX LEDGERBAL de 14/08 (−5.913,41) = **saldo real (−4.213,41) − bloqueado (1.700)** → o juiz achou "não fecha" e ia rebaixar a 4.092,02 pra "não liquidada". Meu "excluir a 4.092,02 fecha ao centavo" era **coincidência de um LEDGERBAL já defasado**, não prova de não-débito. **LIÇÕES DURAS:** (a) **conta garantida opera NEGATIVA e CONTINUA debitando** — conta no negativo NÃO significa débito recusado (o limite cobre); (b) **o bloqueado NÃO vem estruturado no OFX do Banrisul** (só `<LEDGERBAL>`, SEM `<AVAILBAL>`) → o juiz não tem como computá-lo → o gate Σ×LEDGERBAL é **NÃO-CONFIÁVEL pro Banrisul**; (c) **verdade final do Banrisul = "SALDO NA DATA" do PDF**, não o LEDGERBAL do OFX. **FIX (pendente):** perfil Banrisul `ledgerBalReliable: false` (ou caveat bloqueado) → o juiz **NUNCA hard-discard uma tx do Banrisul por LEDGERBAL, só AVISA**; enquanto isso o juiz está LIGADO pro Banrisul (`CANONICAL_CLASSIFY_BANKS=041`) e **ativamente errado** — cuidado ao importar (o real pode ser rebaixado). A #23 e o AGOSTO INTEIRO do 064956967 (sistema congelado em 29/07, +3.984,64) precisam entrar; alvo = PDF −4.213,41, resíduo 1.700 vs LEDGERBAL = o bloqueado (esperado, não buraco). **CORREÇÃO (15/08) — NÃO HAVIA BURACO DE 26 MIL; EU LI A CONTA ERRADA (erro meu, classe "OFX conta errada" lado análise).** Há **3 contas "banrisul" (uma por empresa)**; minhas queries por NOME (`findFirst name contains banris`) pegaram a de OUTRA empresa (balance +3.984,64, "congelado 29/07"). A **caçula Banrisul é `cmq17z90v00qxrndl02kfn4iz`** — **AGOSTO JÁ IMPORTADO CERTO: 82 tx, movimento +17.974,76 (= a prova OFX×PDF), balance −5.913,41 = LEDGERBAL, diferença pro PDF real (−4.213,41) = EXATAMENTE 1.700 (bloqueado).** A abertura de agosto (−23.888,17 = SALDO ANT −22.188,17 − bloqueado) **já foi ancorada no próprio import** — NÃO precisa de âncora manual nem reconstrução de julho. **LIÇÃO DURA: resolver conta por NOME é ambíguo entre empresas — SEMPRE pelo ID** (caçula Banrisul = `cmq17z90v00qxrndl02kfn4iz`, Stone `cmq182qfr0005aktn6q2ugpv2`, Sicredi `cmq180ksv0001aktni9wj64mq`, fixos no topo deste doc). Um número de saldo caro (26 mil) saiu de uma `findFirst` ambígua — nunca mais. **Sobrou POUCO:** (1) a #23 (064956967) está PAID e linkada à 4.092,02 (11/08, 260811, N:1, **sem double-count**) mas com **`paidInterest=0` — falta o juros 953,33** (agosto aberto → +953,33 no DRE de agosto); (2) a 4.092,02 está **PENDING** (categorizar); (3) **fix do juiz `ledgerBalReliable:false`** — ainda vale: o juiz BLOQUEOU esse import real (gap=4.092,02 por LEDGERBAL defasado), o Yussef teve que contornar; muda pra "só avisa". **4A ENCERRADO.** C essencialmente feito (falta o juros da #23).
- **Trava anti "OFX na conta errada" (FASE 2.1, 12/08) — `lib/ofx/verify-account-match.ts`**: QUASE-ACIDENTE — o Yussef anexou o OFX do Sicredi (748) na conta STONE (197); o sistema aceitou e ofereceu importar 355 tx do Sicredi DENTRO da Stone (só não gravou porque ele olhou o saldo). O PDF já tinha a trava (`headerMatchesAccount`); o OFX — o caminho diário — não. Fix: `verifyOfxMatchesAccount` no `importar-ofx/route` (preview E confirm), **camada 1 BANKID×bankCode** (banco trocado → bloqueia com msg clara "Este arquivo é do Sicredi (748), mas você selecionou a conta Stone"), **camada 2 ACCTID×accountNumber** normalizado (só dígitos + sem zeros à esquerda + containment, cobre ACCTID=agência+conta concatenados) → conta errada do MESMO banco bloqueia. Não dá pra conferir (bankCode `000`/null ou sem BANKID) → **AVISA na tela, não bloqueia** (nunca travar import legítimo). Guard REGRA-3: `lib/ofx/__tests__/verify-account-match.test.ts` (matriz 3×3 dos bancos reais + o caso real Sicredi→Stone). **LIÇÃO:** o único motivo de não ter gravado 355 tx na conta errada foi o usuário olhar o saldo — proteção não pode depender disso; o sistema tinha 3 campos divergindo e não conferia nenhum.
- **⚠️⚠️ DEDUP DO IMPORT NÃO É FITID — é `data|signedAmount|memo`; o que quebra é o SINAL quando a tx é reclassificada como TRANSFER (bug PIX 7.000, 17/08).** Uma linha −7.000 (PIX ENVIADO Banrisul→Stone, marcada TRANSFER na sexta) RE-IMPORTOU como duplicata no dia seguinte. **A hipótese "FITID renumerou" estava ERRADA:** o `stableKey` (`lib/reconciliation/stable-key.ts`) é data+valorComSinal+memo e **não contém FITID** — as duas tx tinham stableKey estável IDÊNTICO (`2026-08-13|-7000.00|PIX ENVIADO`). O que divergiu foi o **signedAmount**: o `import-orchestrator` montava o universo de dedup com um `select` que **esquecia `transferDirection`** → `prepareBalanceTransactions` caía no **fallback por `createdAt`** (perna mais antiga = saída −) e, como a perna Stone (destino, +7000) foi importada ANTES da Banrisul (origem, −7000), assinava a Banrisul como **+7000** → stableKey `...|+7000.00|...` ≠ a linha nova `...|-7000.00|...` → "nova" → duplicata. O `recalcularSaldoConta` (saldo) JÁ selecionava `transferDirection` (por isso **o saldo batia e o dedup não** — mesma tx, dois caminhos, sinais opostos). **FIX:** `transferDirection` OBRIGATÓRIO nos selects do dedup (choke-point `reconcileImportLines` em `import-orchestrator.ts` — dedup ÚNICO que preview E confirm chamam, REGRA 5); o fallback `createdAt` agora **LOGA alto** (só legado NULL deve cair; se cair no import = select faltando, REGRA 4). **≠ do caso da parcela 23** (aquele era FITID==YYMMDD como marcador de PREVIEW, outro bug). **Por que o saldo/I9 não pegaram (Q3/Q4):** o saldo é ancorado no LEDGERBAL e a dup era **13/08 < ledgerBalDate 17/08 → pré-anchor → fora da janela do saldo** (o `recalcular` em modo âncora só soma tx `> ledgerBalDate`). Duplicata pré-anchor é invisível pro saldo E pro I9. **FECHADO pelo I10** (`lib/loans/tx-duplicate-invariant.ts`, `findDuplicateStableKeys`): o juiz de módulo varre o **histórico inteiro** (anchor-independent) — 2+ tx EFFECTED com o MESMO stableKey vindas de imports DIFERENTES = duplicata. Distingue repeat legítimo (2 linhas iguais na MESMA fatura compartilham o `batchId` do `dedupHash` = `stableKey#batchId:occ`) de duplicata cross-import (batchIds diferentes). Entra no relatório/selo/e-mail (`dupIssues`). **PREVIEW=CONFIRM:** o preview usava gate/dedupHash (cego pra tx do V2 — `contentHash` null, `dedupHash` no formato `stableKey#import`) e dizia "N novas"; agora roda o MESMO `reconcileImportLines` → mostra "**M já existem + N novas**" (`reconcileDedup` no payload). Guards REGRA 1: `dedup-transfer-sign-pix7000.test.ts` (mock honra o `select` → quebra se removerem `transferDirection`) + `tx-duplicate-invariant.test.ts` (formato real do dedupHash). **Provado em prod (17/08): juiz 🔴 apontou a dup exata → removida → 🟢 0, saldo −8.270,97 inalterado.**
- **⚠️ COROLÁRIO STONE (17/08) — o RECONCILE/CONFIRM estavam certos; o que mentia era o DISPLAY do preview (gate).** No import do Stone o preview mostrou "61 novas" e o **juiz de saldo do preview acusou −117.600** (= as 11 transferências IN de 03-13/08 que JÁ existiam) → o Yussef PAROU (certíssimo — nunca confirmar preview que se contradiz). Investigação read-only contra o OFX real (529 tx): o `reconcileImportLines` (= o que o CONFIRM roda) dava **479 já existem + 50 novas** — as 11 pernas IN do Stone TODAS em `matched` (o fix do `transferDirection` pegou o caminho IN também: a perna IN é assinada +valor e o stableKey bate). **Ou seja, confirmar teria criado 50, não 11 duplicatas.** O problema: a **LISTA do preview e o JUIZ DE SALDO ainda usavam o `gate` (`filtrarNovasOFX`)**, cego pra tx do V2 (`dedupHash` no formato `stableKey#import` não casa com o sha256 do gate) → o gate marcava tudo como novo. **Fix:** `filterToReconcileMissing` (`lib/reconciliation/filter-new-by-reconcile.ts`) remove das `novasReais` as que o reconcile diz que já existem (mesma `stableKey`, REGRA 4/5) → a lista, o `duplicadas` e o juiz de saldo passam a bater com o confirm. **Provado end-to-end no OFX real: gate 529 → filtro → 50 novas + 479 já existem.** **META-LIÇÃO: o juiz de saldo do preview (camada de defesa) pegou um bug de DISPLAY e o usuário parou — a defesa em camadas funcionou. Sem ela, um preview que parecia errado teria sido confirmado.** Guards: `dedup-transfer-sign-pix7000.test.ts` (caso IN) + `filter-new-by-reconcile.test.ts`.
- **Descarte de movimento futuro (07/08) — 2 CAMADAS (CAMADA 2 add 11/08)**: extrato só registra o passado. **CAMADA 1 (data)**: linha OFX/PDF com data `> âncora` (âncora = `max(DTASOF, DTEND)`, ou FITID YYMMDD Banrisul) é **DESCARTADA no import**. Helper `lib/ofx/future-line.ts` (`partitionFutureLines`). **CAMADA 2 (LEDGERBAL) — `reconcileLedgerAnchorDay`**: a CAMADA 1 usa `> âncora`, então a linha com data **IGUAL à âncora** escapa. Caso real 11/08: o Banrisul emitiu o extrato às 01h já listando `PAGAMENTO CONSORCIO -1.478,51` (data 11/08 = âncora) que só liquidava às ~9h; o LEDGERBAL -781,08 NÃO a incluía. **Data nunca resolve isso** (data igual à âncora); só o SALDO declarado revela. CAMADA 2: se `saldoAntes + Σ(novas efetivadas)` não fecha com o LEDGERBAL **e** a diferença bate EXATO com um subconjunto do **DIA DA ÂNCORA**, essas linhas são AGENDADAS (não importadas). **Cuidados:** fora do dia da âncora NÃO mexe (divergência histórica); ambíguo (2+ subconjuntos) ou sem casamento → NÃO chuta, devolve residual pro caller avisar. Wired no PREVIEW (`buildV2PreviewPayload` → seção "agendadas") e no CONFIRM (`import-orchestrator` → move de `missing` pra `futureLines`). **Diagnóstico:** anchor-day vira hipótese `agendada_dia_ancora` ("o banco listou mas não debitou"), NUNCA mais "duplicata". Guard REGRA-3: `__tests__/import-descarte-agendada-dia-ancora.test.ts` (fixture real `Extrato_20260811.ofx`). TODOS os caminhos de import de extrato usam (guard `__tests__/import-descarte-futuro-guard.test.ts`). Saldo âncora só soma EFFECTED (`recalcularSaldoConta`). Validação de fechamento: Σ(EFFECTED) x LEDGERBAL → avisa se não bater. **DÉBITO com prioridade:** `app/api/empresas/[id]/import/staging` é um fluxo de staging de OFX (só `parseOFX`) que cria tx no confirm SEM descarte de futuro — torneira aberta. **Uso real: 0 linhas (nunca usado);** os 572 `staged_payable_rows` são do fluxo Excel `contas-pagar/import` (outro, futuro intencional). Recomendação: DESLIGAR o `import/staging` (ninguém usa) ou aplicar o helper no confirm.

## Rotas & redirects 301

- `/pessoas-vinculadas` → `/socios` (Sprint Unificar 03/06)
- `/empresas/:id/pontes` → `/empresas/:id/socios` (idem)
- `/relatorios` → per-empresa via cookie (Sprint 5.0.4.0a)
- `/empresas/:id/dre` e `/dre-gerencial` → `/empresas/:id/relatorios/dre-gerencial` (statusCode 301 explícito em `next.config.mjs`)

## Regras de negócio críticas

- **⭐⭐ VENDAS ESTENDIDAS 12/08 → 01/08 (25/08) — o PISO desceu pra 01/08 SEM tocar no presente nem nas regras. Julho continua intocado.** **O FATO que autorizou** (confirmado pelo dono contra a operação real): em **01-11/08 o arranjo de recebimento era o MESMO de hoje** — Stone PIX no mesmo dia, cofre todo dia (D+1 corrido), cartão e Sicredi D+1 útil. A **Tuna nem existia** (entrou ~12/08), então nenhuma regra nova precisou ser inventada pro período antigo. **O QUE MUDOU: só o `vigenteDe` das 4 `RegraRecebimento`, de 12/08 pra 01/08 — CONTEÚDO INTOCADO** (dias de atraso, `recebeSabDom`, conta, meio: tudo idêntico). Nenhuma regra foi ajustada pra "acomodar" o passado — essa era a linha vermelha do dono e ela não foi cruzada. **BLINDAGEM (a prova, não a promessa):** snapshot de TODAS as `VendaDiaria` de 12/08+ antes e depois do recompute → **30 linhas, R$ 140.647,48, hash `e06ed1b90b96743c` — IDÊNTICO ao centavo**; o script abortaria tudo se uma linha mudasse. Golden travado e verde (12/08=11.919,65 · 13/08=10.468,80 · fim de semana=62.090,93). Teste `lib/vendas/__tests__/extensao-01-08-nao-estraga-presente.test.ts` (6 testes) roda o motor com a janela nos DOIS pontos e compara linha a linha. `pg_dump pre-extensao-vendas-20260825-225240.dump` antes. **GATE cumprido antes de gravar** (o dono exigiu): o "7 de 11 dias" no banrisul/sicredi **NÃO era buraco de extrato** — resolvendo as contas **por ID** (REGRA 8; a query por nome falhou porque a conta se chama `'sicredi '` **com espaço no fim**), banrisul e sicredi têm movimento nos 7 dias ÚTEIS e zero nos 4 de fim de semana; stone e cofre têm os 11. Banco não credita sábado/domingo — a ausência era a regra funcionando. **RESULTADO:** 62 VendaDiaria · 863 origens · R$ 363.475,90, dos quais **R$ 222.828,42 são história nova de 01-11/08**, com **32 de 32 linhas `confirmadoPerfil`** (antes: 0 de 24 — o período rodava com regra default). O perfil da semana saiu de "a apurar" com 3-4 amostras por dia. **⚠️ A BORDA, resolvida com AVISO e não com invenção:** o bloco **31/07–02/08** (R$ 43.106,03, cartão + PIX Sicredi) começa em JULHO — o depósito de segunda junta sexta+sábado+domingo e **o banco não diz qual real é de qual dia**. Julho não se mexe, então o bloco FICA, com aviso visível na tela: *"inclui venda de fim de julho — não separável"*. **BUG ACHADO NO CAMINHO (REGRA 1, `lib/vendas/janela-mes.ts` + 5 testes):** a tela filtrava a `VendaDiaria` por `dataCompetencia` DENTRO do mês — um bloco que começa na sexta do mês anterior tem competência em julho e **sumia inteiro da tela** (R$ 43.106,03 invisíveis). A regra certa é **SOBREPOSIÇÃO** (`dataCompetenciaFim >= inícioMês AND dataCompetencia < fimMês`), não pertencimento; vale pra toda virada de mês daqui pra frente. **E os 5 textos "12/08" que estavam LITERAIS na tela** (rótulo do mês, legenda, comparações) passaram a ler o `moduleInicio` da API — literal de data em tela vira mentira na primeira vez que a janela muda.

- **⭐ AGOSTO/2026 É O PISO — de 12/08 pra frente é 100%; jul e antes têm erro conhecido e NÃO se mexe (17/08).** O dono não fazia tudo 100% até então; a partir de **12/08/2026** (1º dia do PIX via Tuna) o padrão é fechado. **Regras duras:** (a) motor de vendas / tela / golden / invariantes de venda só olham **12/08+**; (b) **NÃO gerar VendaDiaria pra jun/jul** mesmo com dado — a tela navega pra trás e mostra "sem dado" antes de 12/08, nunca um número de mês torto; (c) **NÃO corrigir/reclassificar/mover nada de jun/jul** mesmo achando erro — se achar, REGISTRA aqui como "divergência conhecida em [mês]" e segue (o move das 77 de 17/08 foi exceção aceita só porque era DRE-neutro e o cofre precisava de categoria uniforme — **não abre precedente**); (d) perfil da semana / previsão / SDLW só com dado 12/08+; sem histórico suficiente = "a apurar", nunca completa com julho; (e) juiz noturno: invariantes de venda só rodam agosto+ (empréstimo/cartão seguem como estão, fechados). **Se um passo precisar de dado pré-12/08 pra funcionar, PARA e pergunta — a resposta é quase sempre "não precisa, começa de 12/08".**
- **⚠️⚠️ GATILHO DO MOTOR DE VENDAS FALTAVA NA CRIAÇÃO MANUAL (25/08) — venda em dinheiro do cofre NÃO entrava no calendário.** O dono lançou à mão a venda em dinheiro do cofre; a transação nasceu **categorizada como Receita de Vendas e RECONCILED**, e o calendário de vendas **nunca soube dela**. Órfãs em prod: **24/08 R$ 3.135,00 e 25/08 R$ 942,00**. **CAUSA:** `recomputeVendasSafe`/`recomputeVendasSeVenda` era chamado no **import OFX**, na **categorização em lote** e na **edição de transação** — mas **NÃO no POST que CRIA a transação** (`app/api/transacoes/route.ts`). Quem lança pelo formulário criava dado de venda que o motor nunca via. Os lançamentos de 22 e 23/08 apareciam porque um recompute manual (`scripts/recompute-vendas-cacula.ts`) tinha rodado ANTES deles — mascarou o buraco. **LIÇÃO (classe do "N caminhos, 1 esquecido", igual ao motor de transferência e ao estorno de cartão): quando um hook precisa rodar em TODOS os caminhos que produzem um dado, listar os caminhos que CRIAM, não só os que IMPORTAM.** Formulário é caminho de criação tanto quanto import. **FIX + REGRA 4 (4 portas, não 1):** (1) `POST /api/transacoes` — a que quebrou; (2) **`createContaPendente`** — choke-point que cobre contas a pagar, contas a receber, duplicar e a ponte do estoque de uma vez (só morde no "lança já paga" com categoria de venda em conta com regra); (3) `conciliacao/find-and-match/reconcile` — conciliar ATRIBUI categoria, é caminho de categorização como qualquer outro. Hook é fail-soft e no-op quando a categoria não é venda. **REGRA CONFIRMADA no dado real:** dinheiro do cofre é **D+1 CORRIDO** — dinheiro que entra domingo é venda de sábado; que entra segunda é venda de domingo. Não vira bloco (bloco só existe em meio que NÃO recebe fim de semana). 5 testes com os dois lançamentos reais, incluindo o que reproduz o órfão.
- **⭐ CATEGORIA É DECISÃO DO DONO — o sistema NUNCA reclassifica sozinho por achar que o memo ou o volume sugerem outra coisa (17/08).** Cada banco inventa o nome de rubrica que quer, e o MESMO nome significa coisas diferentes pra clientes diferentes (ex: "OP.CREDITO C/GARANTIA" = cartão pra Cacula, conta garantida pra outro) — nenhum sistema adivinha o mecanismo por trás da rubrica; **o dono sabe.** O que o sistema DEVE fazer: **(a) PERGUNTAR quando estranhar volume/padrão, aceitar a resposta e REGISTRAR — nunca mais perguntar o mesmo**; **(b) guardar rastro de que foi o dono quem decidiu** ("categorizado pelo dono em X, regra aprendida em Y") pra quando o contador perguntar. O que NÃO pode: **mudar categoria sem confirmação.** Caso-teste (17/08): o sistema estranhou 153k de OP.CREDITO em "Receita de Vendas", PAROU e perguntou, o dono explicou (é cartão), a resposta estava certa — se tivesse reclassificado sozinho, o DRE de agosto perderia **153k de receita REAL**. Vale pra Cacula e pra todo cliente: onboarding pergunta, dono responde, sistema aplica e não reabre. É a mesma família do "não inventar dado que o arquivo não traz" — aqui é "não inventar a intenção por trás da categoria do dono". **COROLÁRIO (17/08) — DESCRIÇÃO LIVRE NÃO É FONTE DE VERDADE, a CATEGORIA é.** O dono digitou "lucro da academia" por engano numa venda em dinheiro da loja (cofre 06/08, 1.925) — o sistema estranhou (uma linha diferente das outras 18 "receita de venda dinheiro"), PERGUNTOU, o dono disse "foi typo, é venda". A descrição é texto livre e erra; a categoria é a decisão. O motor de vendas lê CATEGORIA, nunca a descrição/memo (mesma regra do "OP.CREDITO C/GARANTIA"). Quando a descrição destoa da categoria, o certo é PERGUNTAR e registrar a correção como do dono (audit) — nunca a descrição sobrescrever a categoria nem virar sinal de classificação.
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

## ⭐⭐⭐ SÉRIE B — DIVERGÊNCIA DE SALDO BANCÁRIO NUNCA MAIS VIVE EM SILÊNCIO (28/08/2026)

**⚠️⚠️ CORREÇÃO DE DIAGNÓSTICO (29/08) — E O ERRO FOI MEU, DUAS VEZES.** Numa rodada eu registrei que "a linha faltava no arquivo do banco (export de mesmo dia)". **É FALSO, e eu já tinha provado o contrário antes de escrever isso:** o dono ofereceu essa explicação, eu a adotei e **sobrescrevi minha própria evidência**. A perícia fecha a questão pelos horários:

| momento (local) | o quê |
|---|---|
| 28/08 **15:09** | o dono sobe o arquivo → preview → **a linha é descartada** → gate trava em 2.444,62 |
| 28/08 **21:05** | **eu deployo o fix do FITID** (`4ab0c42`) |
| 28/08 **21:20** | o dono confirma o **MESMO** arquivo (mesmo registro `…a9acn346`, mesmo hash `bb97a440`) → a linha entra · 13 novas · LEDGERBAL bate |

**A linha estava nos DOIS blobs guardados** (27/08 e 28/08) desde sempre. **Não era o banco: era o sistema descartando uma linha válida em silêncio** — a categoria mais grave do módulo. A causa é a que eu tinha provado na primeira investigação (heurística `FITID == YYMMDD`), e o fix dela é o que fez a linha reaparecer 15 minutos depois.

**⚠️ LIÇÃO SOBRE MIM, não sobre o código:** quando o dono propôs uma explicação alternativa, eu troquei uma conclusão **medida contra o blob** por uma **plausível** — e a escrevi no doc e nos comentários dos testes. Evidência medida não se abandona por hipótese confortável; se as duas discordam, é a hipótese que tem que ser testada.

**A lição do episódio, essa continua valendo:** a divergência só apareceu porque o dono REIMPORTOU. Com cliente, um buraco desses viveria semanas mudo.

**⚠️⚠️ A ARMADILHA QUE QUASE VIROU UM INVARIANTE INÚTIL:** o `balance` da conta é **ancorado no próprio LEDGERBAL** (`recalcularSaldoConta` = `ledgerBal + Σ(tx pós-âncora)`). Então *"saldo na data do LEDGERBAL == LEDGERBAL"* é **CIRCULAR — daria verde sempre**, inclusive com o buraco aberto. **Invariante que não pode falhar é pior que nenhum: dá selo verde de graça.** Há um teste só pra provar isso.

**⭐ O QUE MORDE:** **dois LEDGERBAL consecutivos têm que ser reconciliados pelas transações do intervalo.** O banco declarou X no dia 25 e Y no dia 28 → a diferença TEM que ser explicada pelas linhas de 26 a 28. Independente da âncora; pega linha faltando, duplicada ou com sinal trocado. **B1** (erro, intervalo não fecha) · **B2** (erro, o cache `balance` driftou) · **B3** (aviso, conta sem conferência >10d ou nunca conferida). Só ERRO conta no selo — B3 é aviso, porque conta parada não é defeito e alarme falso faz o dono parar de ler o e-mail.

**⭐ AS ÂNCORAS JÁ EXISTIAM — não precisou de tabela nova.** Todo import grava `ledgerBalAmount` + `anchorDate` em `OfxImport` desde 12/08; o histórico de saldos declarados já estava no banco, **só não era usado por ninguém**.

**⚠️ A MENSAGEM NÃO CHUTA A CAUSA:** o sinal diz de que LADO sobra, mas cada direção tem DUAS explicações (falta entrada **ou** sobra saída duplicada). A 1ª versão afirmava uma só — mandaria o dono procurar no lugar errado.

**⚠️ BUG MEU, PEGO NA 1ª RODADA EM PROD:** o juiz acusou dois erros de ±3.026,31 no Banrisul **que se cancelavam entre intervalos vizinhos** — assinatura de âncora errada, não de transação faltando. Causa: 26/08 teve DOIS imports ancorados em 25/08 (LEDGERBAL −6.408,68 e −9.434,99) e ordenar só por `anchorDate` deixava o desempate arbitrário. Agora ordena também por `createdAt`. **Lição: erro que se cancela em intervalos vizinhos é dado meu, não buraco do cliente.**

**📋 ACHADOS REAIS DA 1ª RODADA (não corrigidos — decisão do dono):**
- **Banrisul 11→13/08: R$ 1.463,71** e **13→14/08: R$ 7.000,00** — o 7.000 é a família do "bug PIX 7.000" documentado; o intervalo ainda não fecha. Período que o marco declara 100%.
- **Stone 19→21 (−2.178,67) e 21→23 (+2.178,67) — SE CANCELAM** → assinatura de **fronteira de data** (o banco lançou num dia, o OFX datou noutro), **não de dinheiro faltando**. **Stone 13→17: R$ 122,37** não cancela → esse é real.
- **Banrisul 14/08→28/08: TODOS os intervalos ✓**, inclusive 25→28 (8.167,96 = 8.167,96), confirmando o fix do FITID.
- **B3:** cofre, banco caixa e a conta teste **nunca foram conferidos com o banco** — o saldo lá é o que foi digitado. Agora isso é visível em vez de presumido.

**ITEM 4 — O CICLO VIROU COMPORTAMENTO TRAVADO:** import incompleto → juiz vermelho → re-import com a linha → verde **sem duplicar**, com os números reais. 28 testes. ⚠️ O cenário do teste continua válido (extrato pode mesmo vir incompleto), mas **não foi o que houve aqui** — ver a correção de diagnóstico acima.

**⚠️ O QUE NÃO ENTROU NESTA LEVA (registrado, não feito):** a **tela** de Contas mostrando "conferido ✓ / divergente" (o motor `conferenciaDasContas` está pronto e testado, falta o componente); o **banner de export de mesmo dia** no import; e o **diagnóstico guiado ligado na tela** do import (a função `ondeDescolou` existe e funciona — provada em prod: *"o descolamento começou entre 11/08 e 13/08 (R$ 1.463,71)"* — falta plugar no payload do preview).

## ⭐⭐⭐ OS R$ 2.444,62 DO BANRISUL (28/08) — NÃO ERA DIVERGÊNCIA ANTERIOR; ERA LINHA DESCARTADA

**A premissa estava errada, e o dado corrigiu.** O gate travou com *previsto 1.177,59 vs banco −1.267,03*, e a leitura foi "o buraco é anterior a este import". **Não era:** o sistema estava 100% correto até 25/08 — **todos** os imports com `ledgerBalMatched=SIM`, **zero** linha do arquivo faltando, `balance == LEDGERBAL` (−9.434,99), **zero** tx depois da âncora. O buraco era **deste import**.

**A linha existe no arquivo e foi DESCARTADA:**
```
26/08   −R$ 2.444,62   EMPRESTIMO   fitid 260826
```
`FITID 260826` == **YYMMDD da própria data** → a heurística *"FITID == YYMMDD ⇒ preview do Banrisul"* a mandou pra "futuras". A aritmética fecha ao centavo com ela dentro: **−9.434,99 + 8.167,96 = −1.267,03 = LEDGERBAL**. Sem ela: 1.177,59 → **a diferença é exatamente ela**. ⚠️ A pista estava na contagem: o arquivo tinha **14** linhas novas e o gate ofereceu **12** — duas descartadas (a de 09/09, correta, e esta).

**⛔ A REGRA CAIU POR EVIDÊNCIA.** Nasceu de UM caso (11/06) e produziu **DOIS falsos positivos provados**, os dois escondendo débito REAL de empréstimo: **4.092,02** (13/08, o PDF provou) e **2.444,62** (28/08, o LEDGERBAL provou). **E o arquivo real explica a causa:** todo FITID do Banrisul tem 6 dígitos, e nas linhas de empréstimo o banco usa a **DATA como identificador** — é **convenção de ID, não marcador de previsão**. A heurística lia *formato de identificador* como se fosse *estado do lançamento*. **Quem decide se liquidou é o SALDO.** Ficam de pé a defesa por DATA (camada 1 — segue descartando o CONSÓRCIO de 09/09) e a por LEDGERBAL (camada 2); sem correspondência de saldo o gate **bloqueia e pergunta**, que é o certo: avisar em vez de descartar em silêncio. Os 3 testes que afirmavam a regra antiga foram **invertidos com o motivo escrito**, não apagados.

**⚠️ NÃO HOUVE CIRURGIA DE DADOS** — o banco estava correto; o defeito era de código. **PROVADO com o arquivo real: gate agora abre VERDE** (previsto −1.267,03 == banco −1.267,03), 13 linhas contadas, 1 descartada por data.

**ITEM 4 — grafia alternada:** o banco escreve **"OP. CREDITO C/GARANTIA" (24×)** e **"OP.CREDITO C/GARANTIA" (30×)** — **no MESMO arquivo** (25-27/08 com espaço, 28/08 sem). A regra aprendida casava uma e ignorava a outra, e o dono chegou a criar uma **2ª regra na mão** ("OP CREDITO C/GARANTIA", **0 aplicações**) — sintoma clássico de match frágil. A normalização passa a **remover o espaço depois do ponto**. ⚠️ **Estreitei depois de quebrar:** a 1ª versão trocava o ponto POR espaço e **quebrou o detector de keyword do cartão** (`"Apple.Com/Bill"` → `"apple com"`); o teste pegou. As duas grafias reais diferem só pelo espaço. **Não afeta dedup** — a identidade de linha usa `normalizeMemo`, outra função (conferido antes de mexer).

## ⭐⭐⭐ OS INTERVALOS ANTIGOS FECHARAM — E A CULPA NÃO ERA NOSSA (29/08/2026)

**A perícia com os blobs deu um resultado que eu não esperava: o sistema bate AO CENTAVO com as linhas de TODOS os arquivos.** Nos dois intervalos do Banrisul que o B1 acusava:

| intervalo | linhas do arquivo | nosso sistema | bate? |
|---|---|---|---|
| 11→13/08 | 13 linhas · −3.326,71 | 13 linhas · −3.326,71 | **✓ exato** |
| 13→14/08 | 5 linhas · +3.730,67 | 5 linhas · +3.730,67 | **✓ exato** |

**Não falta transação nenhuma.** Quem não fecha é o **LEDGERBAL contra as próprias linhas que o banco listou no mesmo arquivo** (−1.863,00 declarado × −3.326,71 em linhas). É a mania documentada desde 15/08: **o Banrisul embute VALOR BLOQUEADO no saldo declarado** — manda só `<LEDGERBAL>`, sem `<AVAILBAL>`, então não há como separar.

**⛔ E a ficha do banco dizia `ledgerBalReliable: true`** — o débito estava registrado desde 15/08 e **nunca foi aplicado**. Corrigido, com a prova medida escrita no `rationale`.

**⭐ O FIX QUE IMPORTA — o B1 ganhou o TERCEIRO DADO (as linhas do próprio arquivo, lidas dos blobs).** Agora são três casos, não dois:
- sistema == arquivo == LEDGERBAL → **verde**
- sistema == arquivo ≠ LEDGERBAL → **AVISO**: *"o banco declarou um saldo que não fecha com as próprias linhas dele; nada a corrigir aqui"*
- sistema ≠ arquivo → **ERRO**: falta/sobra linha AQUI, é nosso

⚠️ **Sem esse desempate o invariante culpava a gente por uma contradição do banco** — e alarme falso repetido é como um alarme morre. Sem blob que cubra o período, volta a ser ERRO (o conservador).

**⚠️ BUG MEU NO CAMINHO, e a lição é a mania nº 6 do catálogo:** eu escolhia o arquivo de referência com `ate >= fimDoIntervalo` — pegando justamente o extrato **emitido no último dia do intervalo**, com o dia ainda pela metade. A soma vinha curta e o invariante continuava culpando a gente. **Export de mesmo dia não fecha o próprio dia**: o arquivo de referência tem que terminar **DEPOIS** do intervalo.

**RESULTADO EM PROD: série B com 0 ERROS.** Os 5 vermelhos viraram avisos explicados — 2 do Banrisul e 3 do Stone, todos com a mesma assinatura (nosso sistema == linhas do banco ≠ saldo declarado). ⚠️ Isso inclui o par ±2.178,67 do Stone, que eu já suspeitava ser fronteira de data: agora está **nomeado**, não suposto. O B3 segue avisando as contas nunca conferidas (cofre, banco caixa), que é informação, não defeito.

## ⭐⭐⭐ AS MARCAÇÕES DO IMPORT VIRARAM ATÔMICAS — "OU GRAVA TUDO, OU NADA GRAVA" (29/08/2026)

**A escolha do dono, e ela é mais forte que a minha:** eu tinha consertado o **mecanismo** (a ponte `ofxHash → txId`, que era impossível por construção) e ia deixar a aplicação numa 2ª fase com toast em caso de erro. O dono cortou: *"marcação dentro do confirm, na mesma transação que cria as linhas — melhor que mecanismo consertado + toast que pode passar"*. **Está certo:** mecanismo consertado ainda perde a marca quando a rede cai, o servidor devolve 500 ou a aba fecha; e o dono fica com transação crua **sem saber**.

**O DESENHO:** o confirm recebe `marks` junto do arquivo e aplica no passo 8.5, **dentro da mesma `$transaction`** que cria as transações — resolvendo cada marca pelo mapa `txIdByOfxHash` montado no mesmo laço que insere. **SEM try/catch, de propósito:** marcação inválida (cartão inexistente, categoria de outra empresa, parcela já conciliada) **derruba o import inteiro**.

- **`lib/ofx-v3/aplicar-marcacao.ts`** — a lógica saiu da rota e passou a aceitar o client **transacional** (`PrismaClient | Prisma.TransactionClient`). ⚠️ A `$transaction` aninhada do `PAGAMENTO_EMPRESTIMO` teve que sair (Prisma não aninha) — e como agora tudo roda numa transação só, **a atomicidade ficou mais forte, não mais fraca**. A rota `/apply-marks` continua viva como **casca fina** sobre ela (import legado, retry manual) — REGRA 4: uma lógica, dois chamadores.
- **Marcação cuja linha NÃO virou transação** (foi duplicata, futura ou SKIP) **não derruba nada** — é o preview e o confirm discordando sobre o destino, coisa que a conciliação de destinos já mostra. Conta como `pulada` e segue.

**⚠️ POR QUE A PROVA É UM SCRIPT E NÃO UM TESTE DA SUÍTE:** o `runImportV2` grava `statement_lines` por **SQL cru com `gen_random_uuid()`** — tabela que **nem está no schema Prisma** — então ele **não roda no SQLite do dev**, em nenhuma circunstância. Mesmo padrão dos outros E2E do import (`e2e-skip-decisions.ts`) e da camada 1 do estoque: **`scripts/e2e-marcacoes-atomicas.ts` contra Postgres SCRATCH**. O script **recusa subir** se o banco não tiver `scratch`/`test` no nome (a suíte já rodou contra produção uma vez, em 08/08 — não roda de novo).

**PROVADO (Postgres real, `conta_ia_scratch` no servidor, prod intocado):**
| cenário | resultado |
|---|---|
| **A.** confirm com 2 marcações | 2 aplicadas · linha do cartão já **vinculada** · despesa **RECONCILED + cashCoded**, sem 2ª fase |
| **B.** marcação inválida no meio | **0 transações · 0 statement_lines · 0 registros de import** — nem a linha da 1ª marcação, que era VÁLIDA, sobrou |
| **C.** o mundo ANTIGO (2 fases) | as 3 linhas **FICAM** gravadas e a do cartão **SEM VÍNCULO** — o estado pela metade que o fix elimina |
| **D.** marcação órfã | pulada, import segue normal |
| **E.** reimport pós-falha | aplica a marcação, sem duplicata do arquivo abortado |

⚠️ **O cenário C é o red-then-green sobre COMPORTAMENTO** (não sobre código): ele executa o caminho antigo de verdade e mostra o estado pela metade que o novo torna impossível.

⚠️⚠️ **"O QUE IMPORTA É O VÍNCULO, NÃO A FLAG" — bug meu na asserção, e a lição fica.** Eu esperava a linha órfã com `isCardPayment=false`. Ela vem **true** — o passo 8.5 do import marca a flag por **heurística de descrição** (`detectCardPayment`). Mas **sem `businessCreditCardId` a fatura fica aberta pra sempre**: a flag não quita nada, só tira da fila. Era exatamente o estado do caso real (PIX MERCADO PAGO −2.666,44), e é a regra geral do módulo: **a flag diz "parece"; o vínculo diz "é"** — ao conferir se um pagamento de cartão/empréstimo está resolvido, olhar o **vínculo** (`businessCreditCardId`/`paidInvoiceMonth`, `reconciledTransactionId`/`LoanInstallmentPayment`), nunca a flag nem o status.

⚠️ **3 testes ficaram vermelhos e a culpa era do TESTE:** `__tests__/pending-transfer-state/filters.test.ts` fazia **grep de string na rota** `/apply-marks`; a lógica mudou de arquivo e o grep perdeu o alvo. **É o falso vermelho que a REGRA 3 existe pra evitar** — o grep não distingue "refatorei" de "quebrei". Reescritos pra **executar** `aplicarMarcacao` (db duck-typed, sem banco): DEBIT→OUT, CREDIT→IN, tx já pareada → `skipped` sem tocar no banco.

## ⛔⛔ O NOME QUE VOLTAVA · DUPLICADO POR DIGITAÇÃO · SUMIR COM O ITEM (09/09/2026)

### ⛔⛔ "RENOMEEI E O NOME VOLTOU" — duas causas, e **nenhuma era "não gravou"**

**MEDIDO EM PROD antes de codar:** `stock_item_nome_anterior` com **0 renomeios** e a fila de nomes de **36 → 25** — ou seja, **11 itens MUDARAM** (pelo editor **inline**) e o **LOTE nunca foi confirmado**.

1. **O LOTE tinha um no-op silencioso MEU.** O texto editado só entrava no envio se o dono **também** marcasse o checkbox. Quem editava e saía **perdia tudo**, e a tela voltava com os nomes velhos. ⭐ **Editar já é a intenção** — agora marcar é consequência de editar, o confirmar explícito continua no fim, e a tela **avisa** quando há edição não confirmada.
2. **O editor INLINE renomeava por fora do dono.** Gravava (por isso 11 mudaram), mas **sem gravar o apelido** — buscar pelo nome antigo parava de achar, justo o que a tabela de apelido existe pra impedir — e **sem checar duplicado**. Agora passa pelo mesmo `renomearEmLote` (REGRA 4).

⚠️ **Consequência registrada:** os 11 renomeados antes do fix ficaram **sem apelido**, e não dá pra recuperar o nome antigo (não foi gravado). Da correção em diante, todo rename registra.

### ⛔ NOTA MANUAL — *"o TOMATE já existe; escrever TOMATE cria OUTRO?"* → **criava**

Este caminho **não tinha dedup nenhuma**: digitar o nome de um item existente fazia nascer um segundo item, e a partir dali Posição, busca e contagem mostravam os dois. Agora **recusa e ensina o seletor**, com a régua do `criarFicha` (canônico, sem caixa/acento) — e **dois "produto novo" com o mesmo nome na mesma nota** também não passam.

⭐ **E salvar já NÃO travava por nome vazio com o produto escolhido** — conferido no código: o nome só é exigido quando `novo` está setado. A queixa era legítima como *dúvida*, e a dúvida vinha da ausência da trava de duplicado.

⚠️⚠️ **O QUE EU NÃO CONSEGUI REPRODUZIR: os "3 quadrados de número" com o primeiro sem rótulo.** Varri os quatro candidatos e **todos têm rótulo**: `/entrada-manual` tem **2** números + Total calculado (`Produto · Qtd · Custo un. · Total`); a conferência mostra o fator como **`1 CX = [__] KG`** (rótulo inline, desktop e mobile); o sheet *"Que produto é este?"* tem `<label>` em todo campo. **O campo que mais casa com a descrição é o FATOR DE CONVERSÃO** — e ele tem um defeito real da família: usa **placeholder como rótulo** (*"quantas KG tem 1 CX?"*), e **placeholder some quando se digita** — depois do "1" chutado, a caixa fica sem nome. **Não redesenhei a tela sem saber qual é** — chutar aqui custaria o tempo dele. Falta ele dizer em qual tela estava.

### ⭐ SUMIR COM O ITEM — a régua já existia; faltava a TELA

**MEDIDO ANTES DE CODAR:** `situacaoDoItem` / `excluirItem` / `arquivarItem` implementam **exatamente** a régua pedida — e desde **29-30/08**. Sem movimento **apaga do banco**; com movimento **recusa oferecendo mesclar/arquivar**; ficha ativa **nomeia a receita** no aviso; a checagem é **server-side**. **O que faltava era o menu do Catálogo oferecer**: ele tinha "Desativar", nunca "sumir".

Agora é **um gesto só** — *"Sumir com o item"* — e **quem decide entre apagar e arquivar é o servidor**. O modal diz a verdade **antes**: *"tem história (N movimentos) — sai de todas as listas e a história fica; dá pra trazer de volta em mostrar inativos"*.

**12 testes novos** (o caminho inteiro do rename tela por tela · duplicado por digitação · virgem apaga / com NF arquiva e reativa / com ficha recusa nomeando). **8.971 verdes · TS 0 · deploy `-mustDFEDHrhyIMFNEoX3` 4/4.**

## ⭐⭐⭐ ESCOLHER NA MÃO + BAIXA PARCIAL — a peça que faltava (10/09/2026)

**Mock aprovado pelo dono.** Card por linha do banco: chão FRIO em cima (banco · data · descrição · valor) → notas abertas do fornecedor em **dois grupos, VENCIDAS e A VENCER** → **rodapé sticky** com a conta viva.

**⭐ A INVESTIGAÇÃO QUE ELE PEDIU, respondida: o payable NÃO aceitava pagamento parcial.** O vínculo era tudo-ou-nada (`reconciledWithId` + `EFFECTED` + `RECONCILED`) e não existe campo de valor pago. A peça nova é a tabela **`conciliacao_baixa_parcial`** (CREATE-only): o valor pago de uma conta é a **SOMA das baixas** e o em aberto é **DERIVADO** — *"nunca status na mão"*, palavras dele.

⛔ **Por que tabela e não coluna:** coluna de "valor pago" é número gravado, e número gravado envelhece — foi assim que a `CreditCardInvoice.status` ficou eternamente `OPEN` depois de vencer. Somando as baixas, o em aberto é sempre o que as linhas dizem, e **desfazer devolve o saldo sozinho**. É o desenho do `LoanInstallmentPayment`, e ele resolve **os dois sentidos com a mesma mecânica**: 1 linha → N notas (a última parcial) e N linhas → 1 nota até zerar.

**AS TRAVAS, cada uma com red-then-green medido:**
| trava | defeito reposto | vermelhos |
|---|---|---|
| **Conciliar só com diferença ZERO** — ou nomeada dentro do teto de R$ 25, ou com a parcial ACEITA | `podeConciliar: true` | **4** |
| **O atalho ⭐ só com UMA combinação** — duas que fecham é *"não sei qual foi"* | escolher a primeira | **1** |
| **A baixa nunca passa do que a conta deve** | tirar a checagem | **1** |
| **Desfazer REABRE a conta quitada por partes** | não reabrir | **1** |

⭐ **E o atalho SÓ MARCA as caixas** — *"o Conciliar continua sendo meu"*. A prova é a forma: `atalho` só carrega ids, não existe caminho de gravação nele.

**⚠️ E "A VENCER" ENTRA NA LISTA DE PROPÓSITO** — não é folga de régua, é o pagamento real: o dono paga o fornecedor de uma vez e a nota que ainda não venceu vai junto. Escondê-las faria o card nunca fechar nos pequenos, que são a maioria.

**NOMES HONESTOS (item 5):** a seção virou **"PRONTOS PRA CONFIRMAR"** — nunca *"fecham sozinhos"*, porque **o sistema não concilia sem o clique**; título que promete o contrário é como a confiança na tela se perde. E quem tem o extrato do período importado e nenhuma linha ganhou **"pagar, ou registrar saída do cofre"** a 1 clique — o cofre não tem OFX por natureza, e sem esse caminho essas contas ficariam esperando pra sempre um arquivo que não existe.

**⚠️⚠️ E O CASO IVAN DO MOCK NÃO EXISTE EM PROD.** O mock dizia *"PIX 2.008,00 = 3 vencidas 1.588,50 + NF 419,50 que nem venceu"*. Medido (resolvendo o fornecedor por **ID** — a 1ª medição foi por NOME e caiu no homônimo *"MAURO IVAN LUNARDI (PAO DE MEL)"*): a 4ª nota é **R$ 350,00** (NF 42, vence 14/09) e **não existe nenhuma de 419,50 em estado nenhum**. As 4 abertas somam **1.938,50** contra a linha de **2.008,00** → sobram **69,50**, acima do teto. Então o Ivan **não é** caso de atalho: ou falta uma nota que não está no sistema, ou é juros acima do teto.

**PROVADO PELA ROTA REAL** (`/api/conciliacao/escolher-na-mao`, 7 cards):
```
IVAN       linha 2.008,00 · 3 vencidas + 1 a vencer · atalho: nenhum · diferença  R$   69,50
OESA       linha 1.838,61 · 2 vencidas             · atalho: nenhum · diferença −R$  541,50
BOX PAPER  linha 5.211,85 · 3 vencidas + 12 a vencer · atalho: nenhum · (parcial na NF 6477)
```
**22 testes novos · 9.119 verdes · TS 0 · `pg_dump pre-baixa-parcial-20260910-145925` antes da migration · deploy `9j5vI5Gn0gJyxo85bhxrK` 4/4.**

### ⛔⛔⛔ PORTA SEM MAÇANETA — O MOTOR SUBIU E A TELA NÃO MUDOU (10/09)

**O dono, depois do deploy 4/4 verde:** *"a TELA que eu vejo em /conciliacao NÃO mudou — continua a mensagem '16 pagamentos nomeiam um fornecedor…' com o visual antigo, sem os cards novos. Já recarreguei com cache limpo."*

**O diagnóstico dele estava certo em cheio.** O `EscolherNaMaoCard` estava em prod, funcionando — e **inalcançável**, por TRÊS camadas somadas:
1. a seção nascia **colapsada** (`useState(false)`) → ele via só a frase;
2. dentro dela, cada linha exigia um **segundo clique** ("escolher na mão");
3. o card renderizava **no RODAPÉ da página**, longe de onde ele clicou.

⚠️ **E o texto da seção descrevia o fluxo VELHO** (*"abre a busca já no nome do fornecedor"*) — ou seja, a tela documentava por escrito uma coisa que o sprint anterior tinha substituído.

**⭐ O CONSERTO É O QUE ELE MANDOU: a seção dos que não fecham VIRA os cards, e a mensagem antiga morre.** A rota passou a devolver a **lista inteira** e a página a carrega **junto com a fila** (`Promise.all`), renderizando os cards no lugar da frase. ⛔ **E o modo de uma-linha-só (`?extratoId=`) saiu junto**: sem chamador, seria o campo decorativo que esta casa já pagou caro no `registry.parse` — existia, ninguém chamava, e o bug ficou invisível por semanas.

**⚠️ DUAS ARMADILHAS DA TROCA, as duas fechadas:** *"Tudo conciliado ✓"* apareceria **em cima de 16 pagamentos** esperando decisão (a frase do vazio só sai quando não há card na tela); e a falha ao carregar os cards viraria **erro disfarçado de vazio** — agora é um aviso âmbar dizendo que a ausência não é prova.

**⭐ O GUARD (`__tests__/regras-ui/card-nao-nasce-escondido.test.ts`) — a regra da família:** *componente que o dono precisa VER não pode nascer atrás de um booleano que começa `false`.* Ele lê a fonte (sem jsdom não dá pra clicar), **ignora comentários** (senão morderia a própria documentação do defeito) e tem **auto-teste do detector**. **REGRA 11 medida com o defeito reposto NA PÁGINA, não só no detector: 1 vermelho, verde ao restaurar.**

**PROVADO EM PROD, pelo caminho da tela** (sessão real, sem URL secreta):
```
PAGE /conciliacao (celular) → 200      PAGE /conciliacao (desktop) → 200
BUNDLE: texto dos cards novos true · frase antiga false · botão do 2º clique false
GET /api/conciliacao/escolher-na-mao?empresaId=… → 200 · 16 cards
  IVAN   linha 2.008,00 · 3 vencidas + 1 a vencer = 4 caixinhas · diferença R$ 69,50
  OESA   linha 1.838,61 · 2 vencidas · diferença −R$ 541,50 (baixa parcial)
  BOX PAPER linha 5.211,85 · 3 + 12 = 15 caixinhas
```
**9.129 verdes · TS 0 · deploy `iZOToAAWdPqFkJXosfOSq` 4/4.**

⚠️ **ACHADO NO CAMINHO, registrado e NÃO construído:** há **cards do MESMO fornecedor disputando as MESMAS notas** (3 do Casper, 2 do Ivan — linhas de extrato diferentes, uma lista de notas só). É a família do caso Cancian de 08/09, onde a nota errada foi vinculada porque dois cards ficaram quase idênticos. Hoje o servidor recusa nota já conciliada e a tela recarrega depois de cada vínculo, então **não dá pra contar duas vezes** — mas o card **não avisa** que a nota é disputada. O `ParSugerido` já tem essa faixa âmbar; portá-la pro card é um passo pequeno, à espera da palavra do dono.

### ⛔⛔ E A CORREÇÃO FOI LONGE DEMAIS PRO OUTRO LADO — 16 CARDS ABERTOS (10/09)

**O dono, navegando de novo:** *"o motor está certo (caixinhas, rodapé vivo, teto); a APRESENTAÇÃO virou parede: 16 cards abertos, Ivan aparece 3×, Casper 5×, Box Paper lista 15 parcelas até novembro. O mock era outra coisa."*

**⭐⭐ 1. UM CARD POR FORNECEDOR, FECHADO — e isto é TRAVA, não arrumação.** A fila são cabeçalhos colapsados (*fornecedor · N pagamentos · total*), **um aberto por vez**, e dentro dele **uma LINHA por vez, da mais antiga**, com ‹ anterior / pular pra próxima ›. ⛔ O motivo é que **N cards do mesmo fornecedor mostram AS MESMAS notas e disputam entre si** — marcar uma nota num card e outra no vizinho é o caminho pra vincular a errada, que é literalmente o que aconteceu com a NF do Cancian em 08/09. Nas palavras dele: *"o desenho certo é nem criar a disputa visual"*. **Com um grupo aberto e uma linha por vez, o estado ruim vira inalcançável** (REGRA 5) — não é um aviso que alguém precisa ler. ⚠️ O agrupamento é por **id**, nunca por nome: o homônimo *"MAURO IVAN LUNARDI (PAO DE MEL)"* já enganou uma medição minha.

**⭐ 2. JANELA DE 30 DIAS NO "A VENCER".** *"R02 R03 R04 R05 até 09/11 é ruído — pagamento de 02/09 não quita parcela de novembro."* ⛔ **Mas nenhuma some**: ficam atrás de *"mostrar mais N que vencem depois"*, porque no dia em que ele adiantar uma parcela o card precisa fechar. ⚠️ **E o PISO**: se a janela deixar a seção VAZIA, as 3 mais próximas abrem assim mesmo — senão o fornecedor de parcela trimestral perderia o caminho de fechar a conta. Lista com mais de 8 notas **rola dentro do card** (altura máxima), senão o rodapé sticky sai do alcance do polegar.

**⭐ 3. VENCIDAS NASCEM MARCADAS** — *"o caso comum é o pagamento cobrir as vencidas; eu desmarco a exceção"*. ⛔⛔ **COM UMA EXCEÇÃO QUE NÃO SE MEXE: o AMBÍGUO continua marcando nada**, porque a tela diz por escrito *"o sistema não sabe qual foi, então não marca nada"* — pré-marcar ali quebraria uma promessa impressa. E o **atalho ⭐ ganha das vencidas** quando existe combinação exata. ⚠️ Marcar é SUGERIR: o Conciliar segue acendendo só com a conta fechada. **A mensagem do teto só aparece DEPOIS da primeira seleção** — com zero marcado, *"faltam R$ 2.008,00"* é a linha inteira e não ensina nada.

**PROVADO EM PROD, pelo caminho da tela:**
```
16 linhas → 6 cards COLAPSADOS (cabe numa tela de celular)
  IVAN 3 pagamentos · R$ 6.332,25 · desde 24/08      CASPER 5 · R$ 10.885,97
  ALAN 2 · 1.218,47   OESA 2 · 2.973,20   BOX PAPER 2 · 5.964,19   MARIA LUIZA 2 · 3.339,22

ABRO O IVAN → pagamento 1 de 3 · linha − R$ 1.743,25 · 24/08 · stone
  [x] 350,00 NF 40 · [x] 613,50 NF 41 · [x] 625,00 NF 39   (venceram 07/09)
  [ ] 350,00 NF 42                                          (vence 14/09)
  RODAPÉ VIVO: selecionado R$ 1.588,50 · faltam R$ 154,75

⛔ notas em mais de um card ABERTO: 0     ⭐ escondidas atrás de "mostrar mais": 12
```
**REGRA 11 — 3 defeitos repostos, 2 vermelhos cada:** sem agrupar (card solto na página) · sem a janela · sem as vencidas marcadas. **9.144 verdes · TS 0 · deploy `dNlIFRWys8wuEng1JRTEF` 4/4.**

⚠️ **E o `30` da janela mora num lugar só** (`JANELA_A_VENCER_DIAS`): o servidor decide `foraDaJanela` e a tela **importa a constante** pro rótulo, em vez de digitar o número — número solto na tela vira a segunda régua no dia em que a janela mudar.

### ⭐⭐⭐ O MOCK VIROU RÉGUA VERSIONADA — E O GUARD LÊ O ARQUIVO (10/09)

**O dono, na terceira volta da mesma tela:** *"basta de descrição em palavras: o arquivo do mock está em `docs/mocks/conciliacao-mock.html` — ABRE ELE e copia o visual EXATAMENTE. Ele é a régua; divergência do mock = defeito. (…) Se tua versão 'melhorou' algo do mock, desfaz — igual primeiro, melhoria só com meu pedido depois."*

**⭐⭐ A JOGADA QUE FECHA A CLASSE: o mock ENTROU NO REPO.** Enquanto ele vivia numa pasta de downloads, *"igual ao mock"* era **memória minha** — e memória é exatamente o que falhou nas duas voltas anteriores. Versionado, ele é **dado**, e `__tests__/regras-ui/visual-bate-com-o-mock.test.ts` **LÊ o HTML** e compara: os 17 tokens do `:root{}`, 28 medidas (raio, gap, padding, tamanho de fonte) e os textos que o mock imprime. Tom ajustado "no olho" fica **vermelho apontando o valor que o arquivo manda**.

⚠️ **E o arquivo NÃO estava no caminho que ele deu** (estava em `~/Downloads/conciliacao-escolher-na-mao-mock.html`) — copiado pra `docs/mocks/conciliacao-mock.html`, que é onde ele espera e onde o guard lê.

**O QUE FOI COPIADO, MEDIDO NO ARQUIVO:** cores num lugar só (`components/conciliacao/mock-tokens.ts`) · card borda 1px `#e8e6e0` / raio 16px / margem 12px · cabeçalho chip + nome 15px/700 + valor + **seta ▶ que gira 90°** · linha do banco em chão frio `#f2f6fb` com o valor em `<b>` 15px · notas com **checkbox 19px roxo**, nome + `venc` 12px cinza, valor à direita, **sugerida com fundo `#eeecfa`** · faixa âmbar do juros e dica slate, as duas raio 10 · **rodapé sticky branco com borda de 2px**, *"não é isso"* ghost e o primário roxo **nascendo em `opacity .35` sem `pointer-events`**.

**⚠️ E OS ESPAÇAMENTOS VIRARAM px LITERAL.** `gap-2.5` do Tailwind É 10px e `gap-3` É 12px — certos, mas obrigam tradução mental, e foi tradução mental que produziu as duas versões anteriores. Agora é `gap-[10px]`, `py-[14px]`, `px-[16px]`: o número que está no arquivo, escrito igual. **Duas "melhorias" minhas foram DESFEITAS** por ordem dele — a faixa de ajuste tinha ganhado margem no topo (o mock diz `margin:0 16px 12px`) e o botão fantasma tinha virado *"fechar"* (o mock diz *"não é isso"*).

**⚠️ E o `dark:` do app é código morto:** conferido — **nada no sistema adiciona a classe `dark`** (`darkMode:['class']`, zero chamadores). As variantes espalhadas nunca renderizam, então as cores do mock entram literais sem perder nada.

⛔ **MOTOR INTOCADO** (ordem dele): as 3 travas, o agrupamento por fornecedor, a linha-por-vez e a janela do "a vencer" seguem idênticos — só a pintura mudou.

**PROVADO NO BUNDLE QUE PROD SERVE** (sessão real; não no meu código-fonte, no que a tela entrega):
```
✓ #534AB7  ✓ #eeecfa  ✓ #f2f6fb  ✓ #e8e6e0  ✓ #fdf3e3  ✓ #fdecea  ✓ #eef2f6
✓ #177245  ✓ #faf9f6  ✓ checkbox 19px  ✓ rodapé borda 2px  ✓ opacity .35
✓ seta ▶  ✓ raio 16px  ✓ raio 12px  ✓ menos U+2212  ✓ "Pra tua mão"  ✓ "não é isso"
```
**REGRA 11 — 3 desvios repostos, 1 vermelho cada:** roxo trocado · rodapé com 1px · checkbox 16px. **9.201 verdes · TS 0 · deploy `U6WHnDm9nElDqIlgTqhJn` 4/4.**

⚠️ **UMA DIFERENÇA QUE FICA REGISTRADA:** o `main` do app é `bg-zinc-50` (`#fafafa`) e o mock é `#faf9f6`. O fundo do mock entrou **na seção**, não no shell — trocar o shell mudaria todas as telas do sistema por causa de uma, o que ninguém pediu.

### ⭐⭐ O TOPO NO DESENHO DO MOCK + A MORTE DOS TEXTÕES (10/09)

**O dono:** *"os 3 stats do mock entram no lugar dos atuais — PRONTOS PRA CONFIRMAR · PRA TUA MÃO · SEM PAGAMENTO. São as três filas REAIS da tela (badge e stats da mesma função, como sempre). (…) Os textões morrem. (…) A tela abre e em UMA dobra de celular eu vejo os 3 stats, a conferência das contas, e o primeiro card colapsado. Zero parágrafo entre o topo e o trabalho."*

**⛔⛔ E O "COMO SEMPRE" DELE ACHOU UMA DIVERGÊNCIA QUE JÁ EXISTIA:** o badge do menu contava `contas.filter(c => c.sugestoes.length > 0)` — **os pares 1:1, SEM os LOTES**. A seção "prontos pra confirmar" desenha os dois. Ou seja, **o menu já dizia um número e a tela mostrava outro** — a mesma família do cabeçalho que afirmava *"69 duplicatas"* com a aba dizendo 0. Agora os dois passam por `contarFilas` (`lib/conciliacao/filas-da-tela.ts`).

**O QUE SAIU DA TELA:** o parágrafo *"Passo 2 de 2. Importou o extrato → …"* virou **ⓘ no título** (o texto não se perdeu, e a regra que ele ensinava — *casar antes de categorizar* — continua no CÓDIGO: o `LINHA_DISPONIVEL_WHERE` não olha `categoryId`, de propósito); e a aula da seção *"N pagamentos esperando você dizer quais notas foram… Marque as notas…"* **morreu inteira** — o título nomeia o trabalho e o **rodapé vivo É a instrução**. ⚠️ A dupla contagem virou stat **condicional**: *"anomalia é exceção, não móvel fixo da tela"* — card zerado toda vez treina o dono a não olhar.

**⛔⛔⛔ E AÍ EU CRIEI UMA REGRESSÃO DE 12× NO BADGE — medida, não estimada.** Ligar o badge no `contarFilas` fez ele chamar `lotesDaFila`, e **o badge é consultado a cada 60 s**:

| | antes | depois |
|---|---|---|
| badge do menu | **104 ms** | **1.288 ms** |

**A CAUSA, achada medindo:** `reconhecerFornecedor` roda `normalizeForMatch(f.razaoSocial)` **DENTRO do laço**, pros 79 fornecedores — e o motor de lote a chama **uma vez por LINHA da janela (~1.300)**. Davam **~200 mil normalizações por consulta**. É a MESMA doença dos 9,6 s de 07/09, renascida no motor de lote de 09/09, que nunca recebeu a cura do caminho 1:1.

**⭐ DUAS CURAS APLICADAS, as duas de resultado IDÊNTICO (não aproximado):** memória por descrição no `lotesDaFila` e — a que valeu — **`WeakMap` com o nome do fornecedor já normalizado**, pela IDENTIDADE do objeto (morre com o request; não é cache que envelhece). **`lotesDaFila` 2.179 → 1.368 ms** com as MESMAS 16 linhas, e a **página inteira caiu de 2,4 s pra 1,4 s** de brinde.

**⚠️⚠️ MAS O BADGE SEGUE EM ~1,3 s, e essa é uma DECISÃO DO DONO, não minha.** Duas regras dele colidem: *"badge e stats da mesma função"* × *"o badge do menu consulta a cada 60 s"* (a razão registrada do fix de 07/09). As saídas: **(a)** fica como está — número certo, 1,3 s por consulta; **(b)** badge volta ao caminho barato (104 ms) e **subcontabiliza quando existir lote** (hoje são 0). **Está em (a)** — foi o que ele pediu nesta rodada — e o resto do custo é inerente a reconhecer fornecedor linha a linha. **Não escolhi por ele.**

**PROVADO EM PROD:**
```
OS 3 STATS (1.415 ms)   PRONTOS PRA CONFIRMAR 0 · PRA TUA MÃO 16 (roxo) · SEM PAGAMENTO 93
                        EM DUPLA CONTAGEM 0 → não aparece na tela
conferência das contas: 2 batem · 1 explicada · 0 divergem
```
**REGRA 11 — 3 defeitos repostos, 1 vermelho cada:** dupla contagem como móvel fixo · o textão de volta · o badge com régua própria. **9.218 verdes · TS 0 · deploy `3RTQqNtZQP9GXYyQ0s-Wc` 4/4.**

### ⭐⭐ A CONFERÊNCIA DE SALDO SAIU DA CONCILIAÇÃO — UMA CASA SÓ (10/09)

**O dono:** *"conferência de saldo (bate/explicado/diverge) tem casa própria: o card da conta em BANCOS, que já mostra isso. Repetir na Conciliação é informação duplicada — e duplicado diverge, em tela como em código. A Conciliação cuida de VÍNCULOS (pagamento ↔ conta a pagar); saldo é assunto de Bancos."*

**⭐ CONFERIDO ANTES DE APAGAR** (a régua da casa: nada some sem ter onde morar): o selo vive em `/empresas/[id]/contas`, alimentado por `conferenciaDasContas` via `/api/contas-bancarias` — *"✓ conferido · ⚠ divergente em R$ X · ○ nunca conferida"*. **Saiu a segunda vitrine, não a régua.**

**⚠️ E SAIU DO PAYLOAD, não só da tela.** Dado que ninguém desenha é dado que alguém religa por descuido — e, no caminho, a fila parava pra conferir **todas as contas** a cada carregamento.

**⭐⭐ E UM REFETCH DE 1,4 s POR VÍNCULO MORREU JUNTO.** O `recarregarSaldos` recarregava a **fila inteira** só pra atualizar o bloco de conferência. Sem o bloco, ele virou lixo — e os stats do topo passaram a **recontar local pela `contarFilas`**, a MESMA função do servidor e do badge. Não é conta repetida no cliente: é a mesma regra, chamada de outro lugar.

**A LINHA DAS SEM-PAR ENCOLHEU** pra *"N em aberto sem par · Ver no Contas a Pagar"*; a quebra em três e o gesto do cofre moram lá dentro.

**⭐ O GUARD PROVA OS DOIS LADOS** — saiu da Conciliação **e continua em Bancos. Guard que só verifica a remoção aprovaria o dia em que a conferência sumisse de todo lugar**, e aí não seria mudança de casa, seria perda. Ele também trava o critério da dobra: as únicas tags do cabeçalho são `StatsDoMock` + o link — **nada entre os stats e os cards**.

**PROVADO EM PROD:**
```
OS 3 STATS   PRONTOS PRA CONFIRMAR 0 · PRA TUA MÃO 16 (roxo) · SEM PAGAMENTO 93
             EM DUPLA CONTAGEM 0 → não aparece na tela
conferência de saldo no payload da Conciliação: null
```
**REGRA 11 — 3 defeitos repostos, 1 vermelho cada:** a lista de contas de volta · a quebra em três na frase · o payload recalculando a conferência. **9.219 verdes · TS 0 · deploy `mQrCd3JH9QrKQKZF1K0uL` 4/4.**

⚠️ **SEGUE ABERTA A DECISÃO DO BADGE** (registrada acima): número certo a ~1,3 s por consulta, ou barato a 104 ms subcontabilizando quando existir lote. Está no primeiro.

### ⛔⛔⛔ O VÍNCULO DA PARCELA OFERECIA O CONTRATO ERRADO E ESCONDIA O PAGAMENTO (10/09)

**O dono, com a parcela #3 do C61021346-2 vencendo no dia:** *"a lista 'Lançamentos do grupo' mostra o CONTRATO ERRADO (…) e a linha que eu estou vinculando NÃO ESTÁ NA LISTA."* **Os três eram de código, e um é bomba de calendário.**

**⛔ 1. O GRUPO ERA "TODA LINHA COM CARA DE EMPRÉSTIMO".** `buildLinkGroup` punha no universo qualquer descrição que casasse `LOAN_KW` (`amortizac|liquidac|presta|contrato|financ|parcela`). Medido em prod: **7 candidatos, ZERO do contrato dele** — 6 do **C61021766** (de julho) e um **pagamento de fatura de cartão**. ⭐ Agora: **achou linha do contrato → o número manda**; e **linha que nomeia OUTRO identificador longo nunca entra**, nem por keyword (a mesma régua tira o CNPJ do boleto do cartão). ⚠️ **A keyword NÃO morreu** — no Caixa (`DEBITO PRESTA SIEMP`) e no Banrisul (`PREV-EMP.BBH`) o banco não escreve número, e ali ela é o único caminho; ela só se cala quando já existe linha deste contrato.

**⛔⛔ 2. A JANELA ERA FIXA — `2026-07-01` a `2026-08-31` — E EXPLODIU EM 01/09.** É a classe proibida desde 01/09 (*"data fixa não é futuro, é uma data que o calendário alcança"*), sobrevivendo nesta rota. **O pagamento de HOJE nem era buscado**; sobravam as de julho, de outro contrato. Agora a janela é **relativa ao vencimento das parcelas em aberto** (−45/+15) e **a SEMENTE entra POR ID mesmo fora da janela** — *"ela é o PRIMEIRO item do grupo, pré-marcada, sempre"*, e é o único jeito de ela não depender de heurística.

**⛔ 3. A AGENDA NÃO TINHA O QUE CORRIGIR — o VALIDADOR é que estava errado.** `validateSchedule` acusava *"34 parcela(s) com juros = 0 num empréstimo com taxa > 0"* → `agendaValida: false` → a tela mandava **"Corrigir agenda"** e travava o vínculo. ⭐⭐ **E o comentário da própria regra sempre disse "PRÉ-fixado" — o código é que não checava `isPostFixed`.** No pós-fixado, **juros 0 na parcela futura é o estado honesto**: o juros do mês só se conhece no vencimento, e a agenda importada nasce amort-only de propósito (regra da casa desde 14/08). **A resposta à pergunta dele:** a agenda são **36 amortizações de ~R$ 2.777,78** (100.000 ÷ 36) e o juros de cada mês entra quando o mês chega — **não havia o que corrigir**.

**⭐ E O SPLIT JÁ NASCIA CERTO DO VALOR REAL** — o que faltava era chegar nele. `4.337,52 = 2.777,80` de amortização (fora do DRE) `+ 1.559,72` de encargos (`juros 459,71 + correção 1.100,01`), exatamente o número que o dono previu.

**PROVADO PELA ROTA REAL** (`vincular-parcela/preview`, sessão assinada, READ-ONLY):
```
PARCELA #3 · vence 10/09 · contrato C61021346-2
LANÇAMENTOS DO GRUPO (1):
  [x] ✓ 10/09  R$ 4.337,52 · LIQUIDACAO DE PARCELA-C61021346
PAGO R$ 4.337,52 · amortização 2.777,80 + encargos 1.559,72
SALDO 94.444,47 → 91.666,67 · AGENDA VÁLIDA: true
```
**REGRA 11 — 3 defeitos repostos, vermelho em cada. 9.222 verdes · TS 0 · deploy `L_nDtsNcxo1elAnDItmB3` 4/4.**

**⚠️⚠️ E A RESPOSTA DURA SOBRE O IMPORT: ELE CONFIRMOU E NÃO GRAVOU — sucesso disfarçado, medido.** A linha nasceu no import de **10/09 23:13 (SUCCESS, 3 tx)** e está com **0 vínculos** (nem 1:1 nem N:1), **sem categoria**, `PENDING`. **O FATO está provado; a CAUSA não** — a UI monta a marca certo (`loanId` + `installmentNumber` em `handleConfirmar`) e o `aplicarMarcacao` gravaria ou **derrubaria o import** (o ramo não tem try/catch). Como marcação não deixa rastro próprio, não dá pra dizer por qual porta ela se perdeu sem instrumentar. **Débito nomeado, não consertado:** (a) logar toda marcação recebida × aplicada × pulada no confirm — hoje *"pulada"* é silenciosa por desenho (*"marcação cuja linha não virou transação não derruba nada"*), e é justamente onde um vínculo some; (b) ⚠️ **e quando ele grava, grava torto**: o ramo `PAGAMENTO_EMPRESTIMO` marca `PAID` + `reconciledTransactionId` **sem split** — os R$ 1.559,72 de encargos ficariam FORA do DRE. O caminho honesto do import é chamar o mesmo `computeLinkSplit` do painel.

### ⭐⭐⭐ PARCELA PAGA RELATA; PARCELA FUTURA PREVÊ (10/09)

**O dono, com a #3 do C61021346-2 recém-conciliada:** *"a linha do cronograma mostra JUROS R$ 0,00 · PARCELA R$ 2.777,80, como se eu tivesse pago sem juro nenhum. (…) É pós-fixado: o juros só nasce no vencimento — quando nasce, a linha ADOTA o nascido."*

**⛔⛔ O DADO JÁ ESTAVA TODO GRAVADO — a TELA é que lia a coluna errada.** Medido antes de escrever qualquer linha: a #3 tem `paidTotal 4.337,52 · paidInterest 459,71 · paidCorrection 1.100,01` desde o vínculo, enquanto `interest` (a AGENDA) segue 0 — que é o valor **honesto da previsão** num pós-fixado. **São dois campos com duas perguntas diferentes, e a tabela misturava.**

**⭐ A RÉGUA (`lib/loans/linha-do-cronograma.ts`), e é a mesma do resto da casa: DERIVADO, NÃO GRAVADO.** ⛔ O gatilho é o **VÍNCULO** (`paidTotal`), **nunca o `status`** — campo gravado envelhece, e foi assim que a `CreditCardInvoice.status` ficou eternamente `OPEN` depois de vencer. Parcela `PAID` sem vínculo nenhum **não tem fato pra relatar** e continua mostrando a previsão (ninguém mediu aquele pagamento).

**⚠️ E A LINHA PAGA FECHA PELO FATO:** amortização = `pago − encargos`, não a da agenda. Repetir a prevista faria `amort + juros ≠ parcela` **justo na linha que relata um fato** — e linha de dinheiro que não soma é como a confiança na tela se perde.

**⭐ O TOTAL "JUROS DO CONTRATO" SOMA SÓ O REALIZADO** (*"é o número que conversa com a despesa financeira do DRE"*). Era `Σ(installment.interest)` da agenda inteira: no pós isso soma a previsão das pagas com ZERO das futuras — **nem realizado, nem projeção**. Medido: dizia **R$ 3.089,34** com **R$ 4.649,06** realizados; a diferença, R$ 1.559,72, é exatamente a parcela que ele acabou de conciliar.

**⚠️ A #1 E A #2 SÃO A PROVA DE QUE A RÉGUA É SEGURA** (ele perguntou se mostravam real ou previsão velha): nelas o real **BATE** com a agenda — o documento do Sicredi já trazia o efetivo das parcelas pagas. **A régua nova não as altera**; ela só tem efeito onde previsão e fato divergem, que é exatamente onde a tela mentia.

**⭐⭐ CRONOGRAMA × DRE TRAVADO POR EXECUÇÃO:** os dois derivam dos MESMOS campos (`paidInterest + paidCorrection + paidPenalty`, datados por `paidDate`), e o teste **roda as duas funções sobre a mesma parcela** em vez de prometer que conversam.

**PROVADO PELA ROTA REAL:**
```
#1 PAID  juros 1.518,43                                  · parcela 4.296,23 | pago em 10/07
#2 PAID  juros 1.570,91 (juros 473,23 + corr 1.097,68)   · parcela 4.348,64 | pago em 10/08
#3 PAID  juros 1.559,72 (juros 459,71 + corr 1.100,01)   · parcela 4.337,52 | pago em 10/09
#4 OPEN  juros     0,00                                  · parcela 2.777,77 | previsto
KPI "Juros do contrato": R$ 4.649,06 (só realizado)
```
**⚠️⚠️ REGRA 11 PEGOU UM TESTE MEU QUE NÃO MORDIA.** Repus o terceiro defeito (usar a amortização da AGENDA na linha paga) e os **169 continuaram verdes** — porque na #3 os dois valores COINCIDEM (2.777,80). O teste que separa é o **pagamento acima da previsão** (pagou 5.000 → amortização 3.440,28, não 2.777,80). Os outros dois morderam de primeira. **9.225 verdes · TS 0 · deploy `a2PLqeqPp_5WLBmSqmFfp` 4/4.**

### ⛔⛔⛔ 11 FORNECEDORES CADASTRADOS 2× MATAVAM O RECONHECIMENTO (10/09)

**O dono:** *"o caso Frigorífico/Focatto: eles FORAM pagos pela Stone mas não aparecem em card nenhum. (…) aposto que a descrição não NOMEIA (boleto = 'LIQUIDACAO BOLETO <cnpj>')."*

**⚠️⚠️ A MEDIÇÃO REFUTOU A HIPÓTESE DELE — e achou uma causa maior.** A Stone **NOMEIA com todas as letras**: `FRIGORIFICO SILVA INDUSTRIA E COMERCIO LTDA - Pagamento`. O problema não era a descrição: **11 fornecedores da Caçula estão cadastrados DUAS VEZES com nome IDÊNTICO** (Frigorífico, Focatto, Doceoli, Tozzo, Nestlé, Bamberg, Menon, Lamana, e 3 "SILVANO"), e a trava do empate (*"dois fornecedores igualmente parecidos = não sei qual é"*) devolvia **NULL**:
```
⛔ NULL  FRIGORIFICO SILVA … - Pagamento      (6 contas em aberto, R$ 19.491,46)
⛔ NULL  FOCATTO DISTRIBUIDORA … - Pagamento
⛔ NULL  DOCEOLI ALIMENTOS LTDA - Pagamento
✓        BOX PAPER · OESA                     (cadastro único → reconhecidos)
```
**⭐ A TRAVA ESTAVA CERTA PRO CASO QUE A MOTIVOU** (o homônimo *"MAURO IVAN LUNARDI (PAO DE MEL)"*, 09/09) — ela só **não distinguia duas coisas diferentes**: *ambiguidade real* (nomes DIFERENTES e parecidos → não sei quem é → **NULL, fica**) de *duplicata de cadastro* (nome IDÊNTICO → **sei quem é**; a dúvida é só sobre em qual registro as contas foram parar). ⭐ E por isso a função devolve **os irmãos**: o fornecedor é UM, e as contas dele são as dos dois registros — um `canonizadorDeFornecedor` junta os dois lados (linha e nota). ⚠️ **Nada é fundido no banco** — fundir cadastro é decisão do dono, e a régua dura dele está no estoque desde 04/09.

**⭐ E O CNPJ ENTROU COMO ÂNCORA MESMO ASSIM** (ele pediu, e é correto): quando a descrição carrega o CNPJ do cadastro, **não há semelhança envolvida — é identidade**, e ela vence o nome. Não resolve a Stone (que não escreve CNPJ), resolve o Banrisul e qualquer boleto que escreva.

**⚠️ TESTE INVERTIDO COM O MOTIVO ESCRITO, não apagado** — e a metade certa dele (nome DIFERENTE e parecido → NULL) ficou travada num teste próprio.

**⭐ CABEÇALHO SEM NÚMERO INVENTADO:** *"a soma dos pagamentos sai — 6.332,25 não é valor que eu paguei em gesto nenhum; parece cobrança e confunde. Datas contam mais que soma."* Agora **"N pagamentos · 24/08 a 08/09"**; com UM pagamento o valor fica, porque ali ele É o gesto.

**⭐⭐ A PORTA DOS DOIS LADOS, por DEEP-LINK:** da linha do extrato (*"Casar com conta a pagar…"*, nos Pendentes) e da conta a pagar (*"Procurar no extrato…"*) pro **MESMO card**, já no grupo e na linha certa. ⛔ Deep-link e não um segundo painel: o card mora num lugar só, e render duplicado divergiria na primeira regra nova.

**⚠️⚠️ E A PORTA TINHA UMA LACUNA QUE SÓ A PROVA MOSTROU:** a fila lista só o que o motor de LOTE marcou, e **o lote exige 2+ notas** — fornecedor com UMA nota aberta (o Oesa depois de conciliar uma, o Focatto) **não entra nela**, e o "Casar com conta a pagar…" abriria a tela **sem card**: a porta sem maçaneta de novo, do outro lado. A rota passou a aceitar `?abrir=<linha>` e montar o card de **qualquer** linha, pelo mesmo `montarCardDeEscolha`.

**PROVADO EM PROD:**
```
A FILA (6 cards):  IVAN 3 pagamentos · ALAN 2 · ⭐ FRIGORIFICO 2 · BOX PAPER 2
                   MARIA LUIZA 2 · CASPER 5
A PORTA:  sem ?abrir= → 16 cards, a linha do Focatto NÃO está
          com ?abrir= → 17 cards · FOCATTO · linha 2.528,31 × nota 2.459,76 · falta 68,55
```
⚠️ **O OESA SUMIU DA FILA POR MOTIVO LEGÍTIMO** — o dono conciliou R$ 738,99 em 10/09; sobrou 1 conta, e fornecedor de 1 nota só chega pela porta.

**REGRA 11 — 3 defeitos repostos, 1 vermelho cada. 9.248 verdes · TS 0 · deploys `vDdKIOEvFXBTN7Z72ZEBF` e `78xZXnnR4lj5lhoUY0u2m`, os dois 4/4.**

⚠️ **REGISTRADO E NÃO FEITO:** (a) o **aluguel** (conta manual **sem fornecedor**) não tem como virar card por fornecedor — nem pela porta: sem fornecedor dos dois lados, o Find & Match por nome não alcança. O caminho vivo é o `FindAndMatchPanel` de busca livre; ligar a porta nele é o passo que falta. (b) **os 11 cadastros duplicados continuam lá** — a leitura os trata como um, mas mesclar é decisão do dono.

### ⭐⭐ OS 11 FORNECEDORES DUPLICADOS FORAM MESCLADOS — E A PORTA FECHOU (11/09)

**Autorizado pelo dono** depois do preview par a par. `pg_dump pre-mescla-fornecedores-20260911-000646.dump` (5,8 MB) antes.

**⛔⛔ A PORTA ERA A PONTE DO ESTOQUE, e o preview é que a revelou:** os cadastros **sem CNPJ são todos de 05-07/06** (os antigos, do Excel) e os **com CNPJ são de agosto/setembro** — nascidos da NF-e. O `resolverFornecedor` procurava **só por CNPJ**, e como o velho não tinha, **toda NF-e criava um segundo cadastro com o mesmo nome**. *A duplicata não era descuido do dono: era uma fábrica rodando a cada nota.*

**A RÉGUA DE QUEM SOBREVIVE** (a mesma do estoque, 04/09 — *"fusão errada de fornecedor é pior que duplicata visível"*): **CNPJ diferente NÃO MESCLA** (matriz e filial têm o mesmo nome) · sobrevive **quem tem CNPJ** · sem CNPJ nos dois, **quem tem mais movimento**. ⚠️ **Nada é apagado**: o absorvido é **desativado com o rastro nas `notes`** — o desenho da costura da RM2.

**APLICADO: 11 pares · 0 recusados · 23 transações mudam de cadastro.** Conferido depois:
```
1) SELETOR   68 ativos (era 79) · nomes 2×: 0 · 11 absorvidos com rastro
2) FRIGORÍFICO  2 cards na fila · 6 notas somando R$ 19.491,46 (os DOIS ex-cadastros)
3) ÓRFÃS     0 contas em aberto apontando pra desativado · 0 tx de qualquer tipo
```

**⭐ A PORTA FECHOU NA ORIGEM, nos dois pontos:**
- **ponte do estoque:** procura também por NOME; achou o velho sem CNPJ → **completa ele com o CNPJ da SEFAZ e reusa** (o cadastro melhora em vez de duplicar). Nome idêntico com CNPJ **diferente** cria mesmo.
- **`POST /fornecedores`:** nome idêntico → **409 que APONTA o existente** (devolve o `supplierId` pra tela oferecer "usar esse"), com escape explícito `permitirNomeDuplicado`. ⚠️ O escape existe porque travar sem saída **empurraria o dono a cadastrar "FULANO 2"** — e aí nem ele nem a régua reconhecem depois.

**REGRA 11 — a porta reposta (busca só por CNPJ) deixa vermelho o caso real do Focatto. 9.254 verdes · TS 0 · deploy `xG0WbvKW88jcxN07mzSdd` 4/4.**

**⚠️⚠️ E UMA AFIRMAÇÃO MINHA QUE O DADO DESMENTIU:** eu disse que *"o aluguel é conta manual sem fornecedor"*. Medido: **existem ZERO contas em aberto sem fornecedor**, e o único "ALUGUEL" do período é `ALUGUEL MAQ CARTOES-91942388` (R$ 266,88, 11/08, **já conciliada**) — aluguel de maquininha, não o do escritório. O caso que o dono nomeou não está na base como conta em aberto; **eu repeti a suposição dele em vez de medir**. O débito do "Find & Match sem fornecedor dos dois lados" continua válido como classe — o que não vale é o exemplo que eu dei.

### ⭐⭐ BADGE DECIDIDO · IMPORT VINCULA IGUAL AO PAINEL · TROCAR A UNIDADE DO ITEM (11/09)

**⭐ 1. BADGE — decisão do dono, e ela vira regra da casa:** *"fica no número honesto. Se doer um dia: cache do contador invalidado na escrita. **Performance se resolve com cache, nunca com número errado.**"* O badge segue em `contarFilas` (~1,3 s a cada 60 s).

**⛔⛔ 2a. O LOG DE TODA MARCAÇÃO.** O contador dizia `N puladas` e **mais nada** — e *"pulada silenciosa por desenho"* foi onde o vínculo do dia 10 sumiu. Agora cada marcação sai com **kind, hash e MOTIVO**, derivado dos conjuntos que o próprio import tem: *a linha já existia (duplicata)* · *foi descartada como futura* · *marcada mas NÃO virou transação neste confirm* (o caso que ninguém explicava) · *já estava aplicada (idempotente)*.

**⛔⛔⛔ 2b. O IMPORT MARCAVA "PAGA" SEM SPLIT — R$ 1.559,72 FORA DO DRE.** O ramo `PAGAMENTO_EMPRESTIMO` gravava `status:'PAID'` + `reconciledTransactionId` **e nada mais**: sem `paidTotal`, sem `paidInterest`, sem `paidCorrection`. Como o DRE lê **exatamente** esses campos, a parcela entrava paga com **encargo ZERO**. ⚠️ E gravava pela porta **1:1** enquanto o painel usa a **N:1** — duas portas pro mesmo fato, a família que o trigger `loan_installment_no_double_link` existe pra recusar. **⭐ A gravação virou UMA função** (`vincularPagamentoDeParcela`): o painel é casca fina sobre ela, o import chama a mesma. Vincular pelo import **é** vincular pelo painel.

**⭐⭐⭐ 3. TROCAR A UNIDADE — O GESTO JÁ EXISTIA, e medir isso ANTES economizou reescrever tudo.** O dono disse *"hoje não existe onde trocar"*; medido, o `reunitizar-item.ts` faz isso **desde 27/08** (o caso do pão), com rota, UI na ficha do item e a invariante do valor checada em runtime. **O que faltava era exatamente o caso dele** — e eram três coisas:

1. **`fator === 1` era recusado SEMPRE** (*"não muda nada"*), e o caso do óleo é `1 UN = 1 L`. **Muda a RÉGUA** — e é a troca que faz o item **aceitar decimal** (LT é fracionável, UN não), que era metade do motivo. Agora só é erro quando a unidade também não muda.
2. **Item usado em ficha era RECUSADO.** A recusa protegia do estrago certo, mas **empurrava pro caminho pior**: desmontar a receita na mão e remontar. Agora as quantidades **convertem no mesmo ato**, com a lista à vista no preview. ⚠️ Converte **todas as versões** (cada componente guarda a unidade dele) e **não cria versão nova**: a receita não mudou — 0,05 L é a mesma coisa física que 0,05 UN era.
3. **Guard novo: produção aberta COM ESTE ITEM recusa** — *"material separado está medido na unidade velha"*, e o P1 acusaria um vazamento que não existe. ⚠️ **Por ITEM, não global**: há **8 ordens abertas** na Caçula hoje e nenhuma tem óleo; guard global proibiria pra sempre o que é seguro.

**PROVADO EM PROD pela rota real (PRÉVIA, nada gravado):**
```
OLEO DE SOJA: controle UN → LT (fator 1)
  ANTES : 480 UN · R$ 8,04/UN · valor R$ 3.858,80
  DEPOIS: 480 LT · R$ 8,04/LT · valor R$ 3.858,80
  ⭐ valor INVARIANTE ao centavo · 5 movimentos reescritos · 0 fichas · 0 bloqueios
```
⚠️ **E o parentesco com a "correção de unidade" da conferência está confirmado:** aquela conserta a **ENTRADA de uma nota** (`stock_unidade_corrigida`, por nota); esta muda o **CONTROLE do item**. São tabelas e gestos diferentes e **não se cruzam** — a troca de controle mexe no `fatorConversao` do mapa `cnpj+cProd` (pra a próxima nota entrar na régua nova), nunca no `uCom`/`uTrib` que a nota declarou.

**2 testes invertidos com o motivo escrito. REGRA 11 em cada frente. 9.260 verdes · TS 0 · deploy `EFCrUP54oEL8rbXJM4JTX` 4/4.**

⚠️ **2c — o log é SENTINELA, não autópsia:** a marcação de 10/09 já passou e não deixou rastro; **não dá pra reconstruir a causa**, e o dono já tinha dito que nesse caso *"o log fica de sentinela"*. A próxima pulada sai com nome e motivo.

### ⭐⭐⭐ PRODUÇÃO — PLACAR NO HOJE + TELA DE RELATÓRIOS, FONTE ÚNICA (13/09)

**O dono:** *"os 3 mocks aprovados estão em `~/Downloads` — copia pra `docs/mocks/` e versiona, com guard de tokens como o da Conciliação. **O mock é a RÉGUA: igual primeiro, melhoria só com meu pedido.**"* E a régua de arquitetura: *"media/velocidade/rendimento têm UM dono (lib), e HOJE + Relatórios chamam a MESMA função."*

**⭐⭐ A FONTE ÚNICA É LITERAL, não promessa.** `lib/stock/producao/desempenho.ts` é o dono da conta; `relatorios.ts` **não calcula desempenho nenhum** — ele monta a janela e delega. O teste que morde é o que roda as duas e exige igualdade: `expect(r.pessoas).toEqual(placarDaEquipe(janela, historico))`. ⚠️ E **a média vem sempre da história INTEIRA, nunca da janela do filtro** — senão *"a média do período"* seria a própria pessoa do período, e o selo nunca acenderia.

**AS RÉGUAS DE HONESTIDADE, todas travadas em teste:** lote **sem meta não vira pedido 0** (sai da conta do %, mas o VOLUME dele conta) · dia sem lote medido vem **`null`, não zero** · custo médio **ignora lote sem custo fechado e DIZ quantos** · o melhor lote é por **unidades por minuto**, não por volume · período vazio **diz o motivo**, nunca um painel de zeros.

**⛔⛔ O TABLET NUNCA VÊ O PLACAR — e a trava é no que a ROTA DEVOLVE.** Esconder no componente seria combinado; não mandar o dado é impossibilidade. O guard (`tablet-nunca-ve-o-placar.test.ts`) prova os **dois lados** — que a rota do tablet não conhece `placarDaEquipe`/`vsMediaPct`, **e que o placar VIVE** atrás de `stock.manage`. Guard que só prova a ausência aprovaria o dia em que o placar sumisse de todo lugar.

**⚠️ UMA DIVERGÊNCIA DO MOCK, REGISTRADA E RESOLVIDA A FAVOR DO PEDIDO ESCRITO:** o rodapé do `hoje-placar-mock.html` menciona chips de período (hoje · 7 dias · mês); a ordem escrita é *"FIXO NO DIA — período livre mora nos Relatórios"*. Duas janelas na mesma tela fariam a mesma pergunta ter duas respostas. Há teste afirmando a ausência dos chips.

**⚠️⚠️ REGRA 11 REPROVOU O GUARD DO MOCK NA 1ª VERSÃO.** Ele conferia que a cor aparecia **em algum lugar do arquivo** — e trocar o roxo no objeto de tokens passava **VERDE**, porque o MESMO roxo também está no degradê da barra do gráfico. O que morde é conferir a **DECLARAÇÃO do token**, que é de onde a tela inteira lê. Com o aperto, os 3 desvios repostos dão vermelho (paleta trocada · chip de período no placar · nota de honestidade removida).

**⚠️ E O GUARD ESTRUTURAL DE ROTAS PEGOU A ROTA NOVA** (GET pedindo `manage`): **nomeada em `LEITURA_SENSIVEL` com o motivo escrito, não afrouxada** — a régua *"ler é ler"* continua valendo pro resto.

**PROVADO EM PROD, pelo caminho da tela (sessão real):**
```
PAGE /estoque/producao/relatorios → 200   ·   /hoje → 200   ·   /producao → 200
7 dias:  50 lotes · 4.953,86 un · 87,1h · 18 sem tempo · top "porçao queijo" 1.744 un
   porçao queijo: 7 lotes · média 44min/lote (mediana 26,5) · custo 4,45 (4,22–5,40)
   rodrigo −49% · 2h07 (média 44min)  ·  edmar "tarefa nova — sem média ainda"
mês:     99 lotes · 10.438,86 un · 19 tarefas no seletor
hoje:    "sem produção no filtro"  ⭐ (o vazio DIZ, não mostra zeros)
PLACAR 12/09: 8 pessoas · 11/09: 7 pessoas
⛔ tablet: payload menciona placar/vsMedia? ✓ NÃO
```

**⚠️ E O "CONFERIR 1 NA MÃO" DO DONO ACHOU UM PROBLEMA NO DADO — não no código.** A conferência rodrigo × média do queijo **bateu ao centavo** (média 44,3 / mediana 26,5; minha soma de cabeça divergia porque eu incluí os lotes de 0 min, que a régua já exclui). Mas o caminho expôs isto:

**📋 ACHADO MEDIDO, NÃO CONSERTADO — "LOTE RELÂMPAGO" polui a média de UMA tarefa.** 48 execuções medidas na história; **4 delas (8%) duram 1-2 minutos** — etapa iniciada e finalizada no mesmo minuto (registro retroativo, não trabalho). ⚠️ **E elas estão CONCENTRADAS na porção de queijo: 3 de 6**, que é justamente a tarefa mais produzida:
```
porçao queijo 135 grama    6 medidas · 3 relâmpago · média COM 44min → SEM 88min
beef de hamburger          5 medidas · 1 relâmpago · média COM 13min → SEM 16min
(as outras 6 tarefas com média: ZERO relâmpago)
⛔ os piores:  06/09 Cristian 1min p/ 504 un  ·  10/09 rodrigo 1min p/ 153 un
```
**Consequência real:** o *"rodrigo −49% · 2h07 (média 44min)"* compara com uma média pela metade — **sem os 3 relâmpagos a média é 88min e o 2h07 dele fica perto do normal**. É a família do *"tempo zero não é velocidade infinita"* (06/09) um degrau acima: lá a régua matou o `0`, aqui o `1` passa. **NÃO inventei um piso** — escolher "menos de N minutos não conta" é decisão do dono sobre o número que sai da cozinha dele. As saídas possíveis: (a) piso de duração pra entrar na média (e o relâmpago contado à parte, como o "sem tempo" já é); (b) deixar como está e tratar os 2 lotes na mão.

### 📋 A PARCELA "SUMIDA" DO CASPER ESTAVA PAGA — e o achado é o FILTRO "PAGAS" (13/09)

**O dono:** *"Casper NF 967122, parcela 002 (2.079,98, venc 10/09) não aparece nas notas abertas do card, e no Contas a Pagar eu não acho ela em estado nenhum."*

**⭐ MEDIDO POR ID (read-only): ela está PAGA, e o pagamento está certo.**
```
NF 967122 · CASPER · 26/08 · R$ 6.239,95 · 3 duplicatas no XML
  001  2.079,99  venc 03/09  →  PAGA 04/09 · linha stone R$ 2.086,85  (+6,86 de juros)
  002  2.079,98  venc 10/09  →  PAGA 11/09 · linha stone R$ 2.086,84  (+6,86 de juros)  ⭐
  003  2.079,98  venc 17/09  →  em aberto (PAYABLE/PENDING) — a que ele vê
```
⚠️ **E não é UMA parcela: são DUAS** — a 001 está exatamente no mesmo estado. Ele reparou na 002 porque é a do vencimento mais próximo.

**⭐ O CARD ESTÁ CERTO:** nota paga sai das "notas abertas". Não há bug de filtro ali.

**⛔⛔ MAS O "NÃO ACHO EM ESTADO NENHUM" É LEGÍTIMO — e a causa está ESCRITA NO CÓDIGO desde 28/05:** o `lifecycleScope` do Contas a Pagar tem `reconciledWithId: null` com o comentário *"exclui as conciliadas com OFX (que aparecem em /movimentacoes)"*. Rodei a **mesma query da tela** nos três filtros:
```
filtro {}          → NÃO aparece
filtro PAGAS       → NÃO aparece   ⛔
filtro TODAS       → NÃO aparece   ⛔
```
**A decisão de 28/05 é defensável** (evita a mesma linha em duas telas) — o problema é a **PROMESSA DO RÓTULO**: um filtro chamado **"PAGAS"** que esconde as pagas-e-conciliadas, e um **"TODAS"** que não traz todas. *"Todas" que não é todas é a família do cabeçalho que afirmava 69 duplicatas com a aba dizendo 0.* ⚠️ E o KPI de pagas usa o mesmo `whereBase`, então tela e número **concordam entre si** — e escondem a mesma metade.

**⛔ NÃO CONSERTEI NA HORA** — o dono foi explícito (*"se está paga, me diz qual linha pagou"*). Ele escolheu depois: **(c) o recibo + (a) os rótulos**, e recusou a (b) — *"linha em duas telas é duplicação, quebraria a decisão de 28/05"*.

### ⭐⭐⭐ A PERGUNTA GANHOU UM LUGAR PRA NASCER E MORRER (13/09)

**Critério do dono, e é a régua que fica:** ***nenhum rótulo promete mais do que entrega.***

**⭐⭐ (c) O RECIBO DA NOTA MOSTRA AS PARCELAS COM ESTADO** (`lib/stock/ponte/estado-das-parcelas.ts`, só leitura). ⚠️ **E ele NÃO relê a duplicata crua** — quem responde *"quais parcelas valem hoje"* é o `combinadoDaNota` desde 29/08, e foi **ler o XML direto** que fez o recibo mostrar 3 parcelas depois de uma renegociação pra 5. O que nasce aqui é só o ESTADO, em cima daquela fonte.

Quatro estados, cada um com frase própria: **PAGA** (com a linha do extrato, a conta e os juros **nomeados**) · **ABERTA** · **PAGA_SEM_VINCULO** · **SEM_CONTA**.

⛔ **"paga sem vínculo" é estado PRÓPRIO, não um jeito de dizer "paga"**: ninguém apontou o dinheiro que saiu, e é exatamente esse estado que o juiz **F1** vigia como dupla contagem. ⚠️ E a **diferença aparece NOMEADA** (*"R$ 6,86 de juros/tarifa"*) — escondê-la faria o dono ver dois números que não batem (2.079,98 × 2.086,84) sem nada explicando.

**⭐⭐ E O FIXTURE PEGOU UMA ASSERÇÃO ERRADA MINHA — que expôs o desenho certo.** Eu afirmei que parcela recém-conferida *"nasce em ABERTA"*; o teste devolveu **`SEM_CONTA`** e está certo: **conferir a nota NÃO cria conta a pagar** — enviar o boleto é `stock.manage` (a fronteira de 24/08, *"boleto é obrigação, coisa minha"*). Entre conferir e enviar existe um estado REAL, e a tela passa a **nomeá-lo** em vez de chamar de "em aberto" uma conta que não existe.

**⭐⭐ (a) OS RÓTULOS PASSARAM A DIZER A VERDADE** (`lib/contas-pagar/rotulos.ts` — dono único, porque o **chip do rodapé**, o **card do topo** e o **dropdown** filtram a MESMA coisa e três textos à mão divergiriam no primeiro ajuste):

| antes | depois |
|---|---|
| "Conciliadas" / "Pagas" | **"Pagas (sem conciliar)"** |
| "Todos status" | **"Em aberto e pagas sem vínculo"** |

⛔ **A decisão de 28/05 fica INTACTA** — a conta conciliada não volta pra cá. O que mudou foi a **promessa**. ⚠️ **E a nota linkada é obrigatória:** *"· as já conciliadas estão em Movimentações →"*. Sem a segunda metade, o rótulo honesto (*"sem conciliar"*) levanta a pergunta *"então cadê as outras?"* e não responde — **troca uma mentira por um mistério**.

**PROVADO EM PROD, pelo caminho da tela (sessão real, celular):**
```
NF 967122 · CASPER · 26/08 · R$ 6.239,95
  001  2.079,99  PAGA    paga em 04/09 pela linha de R$ 2.086,85 na stone · R$ 6,86 de juros
  002  2.079,98  PAGA    paga em 11/09 pela linha de R$ 2.086,84 na stone · R$ 6,86 de juros  ⭐
  003  2.079,98  ABERTA  em aberto · vence 17/09

RECIBO  → 200 · "Parcelas da nota" ✓ · "ver a linha em Movimentações" ✓
           "paga — sem linha vinculada" ✓ · "não enviada ao financeiro" ✓
           ⛔ "Contas a pagar sugeridas" (o rótulo mudo de antes): SUMIU ✓
CONTAS A PAGAR → 200 · "Pagas (sem conciliar)" ✓ · "Em aberto e pagas sem vínculo" ✓
           "as já conciliadas estão em Movimentações" ✓ · ⛔ "Todos status": SUMIU ✓
```

**REGRA 11 — 3 defeitos repostos em cada frente, 1 vermelho cada:** reler a duplicata crua · colapsar "paga sem vínculo" em "paga" · a diferença sumindo da frase · o "Pagas" seco de volta · o "Todos status" de volta · a nota linkada apagada.

**⚠️⚠️ E O GUARD DOS RÓTULOS REPROVOU A SI MESMO NA 1ª VERSÃO.** Repus o 3º defeito (apaguei a nota da tela) e ele ficou **VERDE** — porque media `toContain('NOTA_CONCILIADAS')` e **a linha do `import` já bastava**. É a lição do detector de rastro (12/09) outra vez: **o que morde é contar o USO, não a menção**. Com o aperto, o defeito fica vermelho.

**9.726 verdes · TS 0 · deploy `R4Dacd_GQpSrmdBb_Ie9n` 4/4.**

### ⭐⭐⭐ A REVISÃO DO IMPORT DE VENDAS — O PADRÃO DO EXTRATO DE BANCO (14/09)

**O dono:** *"hoje o import baixa por baixo e mostra um resumo; o ajuste mora em outra tela. Vira o desenho do extrato: **o que chegou · com quem está vinculado · ajusto ali mesmo**."*

⛔ É a **"porta sem maçaneta" de cabeça pra baixo**: o gesto EXISTE (a prateleira mapeia, o reprocesso rebaixa) e mora **longe de onde a pergunta nasce**. O dono lia *"COCA COLA LATA não baixou"* e tinha que sair da tela, achar o nome numa lista de 130 e voltar.

**A TELA** (produtos E complementos, **mesma cara** — são dois mapas por desenho, mas a PERGUNTA é idêntica): a lista **POR NOME**, com estado (✅ vinculado · 🟡 sem destino · ⚪ ignorado), **o destino E O QUE ELE DESCONTA à vista** (*"→ COCA COLA 2L (baixa: COCA-COLA 2L ×1)"*) e as **ações inline em toda linha — inclusive na vinculada**, porque vínculo errado se conserta ali. Os 3 contadores saem da **MESMA lista** que a tela desenha.

⚠️ *"Vinculado" sem dizer o que desconta é uma afirmação que o dono não tem como conferir* — e vínculo errado só apareceria no dia em que o saldo não batesse.

**⭐⭐ A SUGESTÃO SUGERE, NUNCA DECIDE — e ela tem DUAS travas, as duas medidas:**
- **DIREÇÃO:** a ficha só sugere quando está **contida no nome do PDV** (`COCA LATA` ⊂ `COCA COLA LATA` ✓). ⛔ **Nunca o contrário:** `FRUKI LATA` com a ficha `FRUKI LATA ZERO` seria a ficha **acrescentando um qualificador que o PDV não disse** — e *"zero" é outra bebida*. **Sugerir ali inventa uma distinção que ninguém fez**, e um clique rápido baixaria a errada.
- **AMBIGUIDADE:** duas candidatas = *"não sei qual"* (a trava do PAO DE MEL).

⚠️ E a régua do **IDÊNTICO** (08/09) continua sendo **a única que age sozinha**.

**⭐ O PREVIEW É SELETIVO** — só os nomes que **mudaram de estado**, com a conta: *"COCA COLA LATA: 5 ocorr. → baixa 5 × COCA LATA 350ML"* — e diz quantos **não** mudam, senão o dono não sabe se o preview está completo. ⛔ Nada baixa pro destino novo sem ele: mudança de vínculo é **escrita em estoque**.

**⚠️⚠️ UMA DECISÃO DE ENGENHARIA, DECLARADA (e ela contraria a letra do pedido):** o dono pediu *"estorno+rebaixa SÓ dos nomes que mudaram"*. O **preview** é seletivo; a **gravação** continua sendo o `reprocessarDia` que já existe. **O efeito no estoque é IDÊNTICO** (o nome que não mudou é estornado e rebaixado pelo mesmo valor: líquido zero) — o que um reprocesso seletivo economizaria é **ruído no ledger**, não exatidão. E abrir um **SEGUNDO caminho de escrita no ledger** é o que esta casa mais pagou caro (*"N caminhos, 1 esquecido"* custou o gatilho de vendas, o estorno de cartão e o split do empréstimo). ⭐ Se o ruído incomodar, o caminho é **estreitar o estorno DENTRO do `gravarVenda`** — uma função, um lugar —, nunca criar o segundo.

**PROVADO EM PROD, no dia 13/09 real (130 nomes):**
```
🟡 86 sem destino (457 ocorr.) · ✅ 44 baixam (557) · ⚪ 0 ignorados
soma dos três = 130 = linhas ✓ nada some

🟡   5× COCA COLA LATA           → ⭐ parece COCA LATA — usar? [1 clique]
🟡   1× FRUKI LATA               → escolher destino   ⭐ (NÃO sugere a ZERO)
🟡  19× COCA LATA MAIS MINI FRITAS → escolher destino  ⭐ (combo não herda)
✅  15× COCA COLA 2L             → COCA COLA 2L (baixa: COCA-COLA 2L ×1)
✅   6× COCA ZERO 2L             → COCA ZERO 2L (baixa: COCA COLA Zero 2L ×1)
TELA → 200 · "revisar" ✓ · "sem destino" ✓ · "parece" ✓ · o aviso do que falta ✓
```

**⚠️⚠️ E A PROVA EM PROD ACHOU DOIS DEFEITOS MEUS que teste nenhum pegaria:**

1. **A REVISÃO DEVOLVEU `0 NOMES` PRO DIA QUE TEM 130.** Os dois writers do módulo usam **convenções de hora DIFERENTES**: `stock_venda_complemento_linha` grava **00:00:00Z** e `stock_venda_linha` grava **15:00:00Z** — porque `new Date('…T12:00:00')` **sem Z** num processo que roda em `America/Sao_Paulo` vira 15h UTC. **Comparar timestamp EXATO acerta um writer e erra o outro.** A leitura passou a ser por **FAIXA do dia** (`gte` dia, `lt` dia+1), indiferente a quem escreveu — hoje e no dia em que alguém mudar a hora.
2. **A SUGESTÃO NÃO NASCIA NO CASO QUE MOTIVOU A TELA:** `COCA COLA LATA` não sugeria nada com a `COCA LATA` existindo, porque meus candidatos eram só as fichas **já mapeadas naquele relatório**. *Candidato estreito demais é uma sugestão que não aparece justamente onde ela serve.* Alargado pras fichas de produto final — **seguro por causa das duas travas acima**.

**REGRA 11 — 6 defeitos repostos, todos vermelhos:** sem-vínculo sumindo do contador (**3**) · sugerir com duas candidatas (**1**) · sugerir por letras parecidas (**1**) · a baixa sumindo da vinculada (**2**) · o timestamp exato de volta (**1**) · a direção caindo, sugerindo a ZERO (**1**).

**9.849 verdes · TS 0 · deploys `bbSoqlmhzx9kCOiTRvgfp` e `OZv3wzuhCQlbuljnmTyXc`, os dois 4/4.**

📋 **FICA PRO DONO (o gesto é dele):** os **4 combos** (`… MAIS MINI FRITAS`, 28 ocorrências) precisam de ficha composta (lata + porção mini fritas) — o botão *"definir"* da linha leva ao cardápio com o nome já carregado. E **"ignorar" só aparece nos complementos**: o mapa de produtos aceita `FICHA | REVENDA | REMOVER`, e REMOVER **devolve a pendente**, que é outra coisa — oferecer ali seria um gesto que promete uma coisa e faz outra. Registrado como o que falta naquele mapa, não disfarçado.

### ⭐⭐⭐ FATURAS — A CURA DA REINCIDÊNCIA EM 4 PEÇAS, E O V4 DE HOJE ERA UM DÉBITO DE 31/08 (16/09)

**O dono, com a fatura Banrisul recusada:** *"o problema de fundo é a REINCIDÊNCIA — consertamos e volta. A cura é arquitetura."*

**⭐⭐ E O DIAGNÓSTICO DO V4 DELE ESTAVA CERTO EM CHEIO — o runner novo achou no primeiro uso.** `TOTAL DE GASTOS` aparece **uma vez por PORTADOR** na fatura do Banrisul, e o parser fazia `text.match()` — **pegava a PRIMEIRA**. Medido na fixture de agosto: lia **23.648,03** quando o total é **39.302,64** (= 23.648,03 + 15.654,61, os dois portadores); na fatura que ele subiu hoje, a primeira ocorrência era **151,56**.

⚠️⚠️ **E ISTO ESTAVA REGISTRADO COMO "LATENTE" DESDE 31/08**, neste mesmo doc: *"`TOTAL DE GASTOS` 2× (23.648,03 × 15.654,61 — os dois portadores) · ⚠️ LATENTE — lê o 1º portador como se fosse total; inofensivo só porque ninguém confere com ele"*. **Alguém passou a conferir, e o latente virou o bug do dia.** ⭐ *Débito registrado não é débito pago* — é a mesma lição da dívida do PRODUTO_FINAL na contagem, que ficou 2 linhas por meses e custou 9 ajustes fantasma quando o volume chegou.

**⭐ E O COMENTÁRIO DO CAMPO JÁ PROMETIA O CERTO:** *"Σ de todos os débitos do período"* — **o código dizia uma coisa e entregava outra**. O fix é `somarTodas`, e ⛔ ele **não soma pela metade**: valor ilegível no meio devolve `null` em vez de um total curto.

═══ **AS 4 PEÇAS** ═══

**1. PARSER ISOLADO DE VERDADE.** A varredura achou **uma corrente entre bancos**: o parser do **Mercado Pago** importava `parseBRL` **de dentro do parser do SICREDI**, com o comentário *"REGRA 4: uma leitura de valor, não quatro"*. A intenção era boa e o efeito era que **mexer no Sicredi podia quebrar o Mercado Pago** sem nada avisar. ⭐ A saída não é duplicar — é **tirar o utilitário de dentro do banco** (`numero-br.ts`): *número BR se lê igual em qualquer fatura; **onde ele aparece na página**, não*.

**2. O CONGELADOR — e os goldens JÁ EXISTIAM, soltos.** Cinco arquivos, um por banco, e **nada ligava** *"mexi no Banrisul"* a *"rode o Sicredi"*: o conserto de um quebrava o vizinho **em silêncio**, e voltava semanas depois com cara de bug novo. Agora é **uma lista** (`congelador.ts`, **9 fixtures de 7 bancos**) e **um runner** que roda todas a cada rodada. ⛔ E o guard é **estrutural**: *parser de fatura sem golden fica vermelho* — ninguém consegue adicionar banco que ninguém congela. ⚠️ `goldensPara()` devolve **sempre a lista inteira**, de propósito: não é filtro, é a afirmação de que **não existe rodada parcial**.

⚠️ **E O CONGELADOR ME CORRIGIU ENQUANTO EU O ESCREVIA:** congelei 13.779,73 como `totalGastos` do Banrisul PJ e o parser leu 13.797,73 — **os dois estão certos**: um é o total de gastos, o outro é **o que se paga**, e a diferença de R$ 18,00 é o par de anuidade (`DESC ANUID` −18 / `ANUIDADEINT` +18). *Cada número tem o seu nome*, e congelar o pago no campo dos gastos criaria um vermelho eterno com o parser certo.

**3. VERSÃO DE LAYOUT.** O congelador registra `layout` por fixture (as duas do Banrisul PF são `v1`). ⚠️ **A detecção por versão ainda NÃO foi construída** — ela só se escreve honestamente com **dois layouts reais na mão**, e hoje temos um. *Inventar um detector v1/v2 sem o v2 seria adivinhar onde o banco vai mexer.* Fica nomeado como a próxima peça, com a fixture de hoje entrando como `v2` se o PDF do dono mostrar redesenho.

**4. A RECUSA QUE AJUDA A CONSERTAR.** ⛔ **A conferência NÃO afrouxou** — ela recusou hoje e estava certa; é a heroína. O que mudou é o que a recusa **entrega junto**: além de *esperado × lido*, ela aponta **as linhas candidatas do texto cru**. ⭐ **Testado contra a fatura real com a diferença de hoje (−18,00), ele achou duas linhas com 18,00** — e uma delas é **`JOD 18,00 TX DÓLAR R$ 5,2504`**, compra em moeda estrangeira, que é **exatamente a classe de linha que este parser já perdeu antes** (01/09: *"compra internacional traz US$ e R$ na mesma linha — o primeiro é o dólar e o real era cortado fora"*). ⚠️ **Hipótese forte, não veredito** — sem o PDF do dono não dá pra cravar. E ⛔ o diagnóstico **não conserta nada**: somar a linha achada seria o sistema **inventando** a transação que não soube ler.

**⭐⭐ E A QUARENTENA — o buraco que fez este sprint começar sem o documento.** O import de fatura **não guardava NADA**: nem o PDF, nem o texto extraído. Quando a conferência recusou, o documento **se perdeu**, e diagnosticar exigia pedir o arquivo de volta. **É o que o `rawOfxBlob` resolveu pro extrato em 13/08 e nunca chegou aqui.** Agora **toda tentativa** fica guardada com o texto — a recusada pra diagnosticar sem pedir o PDF, ⭐ **e a que FECHOU como o golden de amanhã** (foi por não ter os PDFs antigos que o congelador nasceu com 9 fixtures em vez do histórico inteiro). ⚠️ Fail-soft de propósito, e com **expurgo do texto em 12 meses** (LGPD), mantendo a metadata — a mesma régua do blob do OFX.

**REGRA 11 — 2 defeitos repostos, os dois morderam:** o V4 voltando a pegar a primeira ocorrência (**2 vermelhos**) · um banco saindo do congelador, virando parser solto (**2**).

**10.205 verdes · TS 0 · `pg_dump pre-quarentena-20260916-014904` (6,2 MB) antes da migration (CREATE-only, aditiva pura).**

📋 **FALTA PRA FECHAR O CASO DE HOJE — e é o que só o PDF resolve:** o **V1** (Σ Brasil 11.376,89 × 11.358,89). A fixture que temos aponta a classe (linha em moeda estrangeira), mas **a fatura de hoje é outra**, e o texto dela não existe mais em lugar nenhum. **Da próxima recusa em diante isso não se repete** — a quarentena guarda.


### ⛔⛔⛔ CONCILIAÇÃO + CONTAS A PAGAR — 4 FRENTES (20/09/2026)

**⭐⭐ 1. O BUG DA ELIANE — DUAS RÉGUAS PRA MESMA PERGUNTA, e a segunda jogava fora a resposta da primeira.** O palpite acendia (*"eliane · valor exato · 1 dia depois do vencimento"*) e o botão verde abria o painel **VAZIO**: *"0 ranqueados · nenhuma conta bate com ELIANE GARCIA"*. **A causa, medida:** o palpite tem o candidato **POR ID** (`alvo.contaId`) e o botão o **descartava**, mandando reabrir a busca — que procura **POR NOME do extrato**. E no cadastro **não existe fornecedor nem conta com "eliane"**: a conta foi achada por **valor + data**. ⚠️ O nome gravado é **`"eliane "` com espaço no fim** — a mesma cicatriz da conta `'sicredi '` de 25/08.

⭐ **O conserto é o palpite EFETIVAR por id** (`idsDoAlvo` → `contaIds` → o MESMO `reconcileTransactions` do Find & Match — **nenhuma segunda porta de gravação**). O painel fica sendo o caminho **manual**, e quando aberto a partir de um palpite **já abre COM o candidato marcado** — o dono confere em vez de procurar de novo.

**⭐ 2. FATURA E EMPRÉSTIMO JÁ MORAVAM NA CAIXA — medido, não construído.** Os dois palpites acendem em prod: **Carter fatura 2026-09 R$ 8.626,98** (`{cardId, invoiceMonth}`) e a **ELIANE** (`{contaId}`). A linha do Carter **está na caixa**, não foi parar em lugar nenhum. ⚠️ O caminho da parcela de empréstimo ficou vivo desde o fix do `select` sem `status` (19/09).

**⛔⛔⛔ 3. NADA SAI DA CAIXA SEM CATEGORIA — e a pergunta vem JUNTO DO GESTO.** Casar com conta a pagar **HERDA** a categoria da conta (é o que o reconcile já faz). ⛔ Mas **se a conta casada não tem categoria, a linha saía da caixa sem nenhuma** — e a despesa não entrava em DRE nenhum. Agora o confirmar **recusa com `code: PEDE_CATEGORIA`**, a tela abre o chip **NA LINHA** e **reenvia o MESMO gesto** com a resposta. ⭐ **E a resposta grava NA CONTA, não só na linha do banco:** a próxima nota do mesmo fornecedor já vem classificada — *o sistema aprende com o gesto em vez de repetir a pergunta todo mês*. ⚠️ Pedir depois seria pedir nunca: a linha já teria saído da caixa.

**⚠️⚠️ E O TAMANHO DISSO, medido em prod: 95 das 106 contas a pagar em aberto estão SEM categoria (R$ 159.104,38) — e as 95 vieram do `ESTOQUE_NF`.** A ponte da nota cria a conta **sem categoria** por desenho (categoria é decisão do dono), então **toda conciliação de nota caía nesse buraco**. A régua vai perguntar muito nos próximos dias — e cada resposta ensina uma.

⭐⭐ **O GUARD NÃO INVENTOU UMA SEGUNDA RÉGUA DE "TEM CATEGORIA"** (REGRA 4): quem responde *"esta linha tem nome?"* é o **`rotularLinha` do Fluxo de Caixa** (26/08), que já conhece as famílias que o banco não categoriza mas o sistema sabe pela **ESTRUTURA** — fatura de cartão (`isCardPayment`) e parcela de empréstimo (o vínculo). ***`A CLASSIFICAR` é o vermelho.*** Uma régua nova aqui faria a caixa e o Fluxo discordarem sobre a mesma linha. ⛔ **`IGNORAR` é a exceção NOMEADA**: não vira movimentação, sai das filas e é reversível — cobrar categoria de uma linha que o dono já classificou como nada seria cobrar duas vezes.

**⭐⭐ 4. A LIXEIRA VISÍVEL — *"eu NÃO lembro de ter apagado"*.** **Medido, 30 dias de auditoria:** `02/09 1 · 09/09 4 · 13/09 26 (TODAS às 19:09) · 14/09 1`. As 26 saíram pelo `source: "contas-a-pagar DELETE"`, **todas do mesmo fornecedor**, e o DELETE é **um por vez com dialog** — **não existe ação em massa nem caminho que apague sem gesto**. Foram 26 cliques confirmados num minuto: faxina de duplicata, o tipo de gesto que não fica na memória como *"apaguei contas"*. ⛔⛔ **O defeito não era o delete — era não ter onde VER.** A auditoria guardava; nenhuma tela lia. *Registro que ninguém desenha é a mesma família da porta sem maçaneta.*

⚠️ **E O QUE ELA GUARDAVA NÃO BASTAVA PRA RESTAURAR** (só `description`/`amount`/`lifecycle`): sem fornecedor, vencimento e categoria, restaurar seria **redigitar**. O DELETE passou a guardar o retrato inteiro; as 26 antigas entram com o que existe, marcadas **restauração parcial** — e **sem vencimento a tela PEDE a data** em vez de inventar uma. ⭐ A duplicata é por **fornecedor + valor + vencimento, NUNCA pela descrição** (a recriada à mão quase nunca tem o texto da nota), e ela **avisa, não bloqueia**: duas contas iguais existem no mundo real. ⛔ **Nenhuma tabela de lixeira nasceu** — seria uma 2ª verdade do mesmo fato; a lixeira LÊ o audit, e restaurar passa pela **porta única** `createContaPendente` (`bankAccountId: null` — restaurar traz a obrigação de volta, nunca reafirma que ela foi paga).

**⭐ E O DELETE PASSOU A AVISAR O ESTOQUE (o conserto do F2, na origem), fail-soft.** A amarra **não é apagada, é MARCADA** (`stock_conta_removida`): apagá-la jogaria fora a única prova de que aquela nota **já foi** pro financeiro, e na conferência seguinte o sistema mandaria a mesma nota de novo. *O alarme some porque foi EXPLICADO, nunca porque a evidência sumiu.* **Prod: 42 contas removidas, R$ 72.400,71 — e as 26 de 13/09 têm amarra do estoque, que são exatamente as 26 órfãs que o F2 acusava.**

**⚠️⚠️ BUG MEU PEGO NA PROVA EM PROD: a lixeira listou *"(sem descrição) R$ 0,00"* em tudo.** O `metadata` do audit vem como **STRING em parte das linhas** (a coluna é `Json`, mas parte foi gravada como texto) — ler sem parse devolve `undefined` **sem dar erro**: vazio com cara de *"não havia dado"*. É a mesma classe do `detail` do juiz (17/09). Curado com parser resiliente.

**PROVADO EM PROD, pela rota real (a recusa não grava nada):**
```
POST /resolver CASAR_PAGAR com conta sem categoria → HTTP 422 · code PEDE_CATEGORIA
  "A conta «LATICINIOS SANTO CRISTO — NF 179080 (parcela 003)» não tem categoria —
   diga qual é pra eu conciliar. Ela fica gravada na conta, e a próxima do mesmo
   fornecedor já vem com ela."
  ⛔ nada gravado: categoria null · vínculo null
REGRA 12 — celular e desktop: PAGE 200 · code no bundle ✓ · chip ✓ · "agora não" ✓
```
**REGRA 11 — 3 defeitos repostos, 1 vermelho cada** (a recusa removida · a resposta não gravando na conta · a tela voltando a só pintar vermelho). ⚠️ **E um guard de 18/09 foi REAPONTADO, não afrouxado:** ele contava `<MenuDoChip` no **arquivo** (== 3) e quebrou **com a tela certa**, porque o painel da pergunta desenha um 4º menu **fora do cartão** — e ele não é a mesma pergunta duas vezes. A régua continua *"o CARTÃO desenha os chips uma vez só"*; o que mudou é que ela passou a ser feita **ao cartão**. **10.512 verdes · TS 0 · deploys `fzOljl6Al8zyKA7n-cX39` e `cUkptofC-Qa2EAeHr74Jg`, os dois 4/4 · Δ bundle +0 KB.**

### ⛔⛔⛔ E A LIXEIRA ESTREOU COM CARREGANDO ETERNO — **O FETCH QUE NÃO SAI** (20/09)

**O dono, na estreia:** *"abro a tela e fica «carregando…» pra sempre — nada aparece, nem erro. (…) O guard de família claramente não cobria a tela nova — **TELA NOVA NASCE COM O GUARD**."*

**⭐ AS TRÊS HIPÓTESES DELE CAÍRAM NA MEDIÇÃO — e o que sobrou é pior:** a rota respondeu **200 em 104 ms com 19 KB e as 42 removidas**, e a página **200 nos dois viewports**. Não era 500, nem payload grande, nem parse quebrado. ***O fetch nunca aconteceu.***

**A CAUSA, provada no header real de prod:** a tela descobria a empresa com `document.cookie.match(/current_empresa_id=…/)` — e esse cookie é **`httpOnly`** desde o Sprint 4.0.5.b (`Set-Cookie: current_empresa_id=…; HttpOnly`). `document.cookie` **nunca** o enxerga → `empresaId` ficava `''` → `if (!empresaId) return` → o estado nunca saía de `undefined`. ⚠️ E a rota, chamada sem `empresaId`, devolvia **403** — dois defeitos na mesma linha: o cliente não podia saber a empresa, e o servidor exigia que ele soubesse.

**⚠️⚠️ E O `fetchComTimeout` ESTAVA INSTALADO — ele não tinha como morder.** O guard de 14/09 cobre ***fetch que não VOLTA***; este é ***fetch que não SAI***, e **nenhum teto de tempo alcança uma requisição que não aconteceu**. ⭐ **A régua que fica:** ***estado de carregamento refém de um pré-requisito que pode nunca chegar é spinner eterno com outro nome.***

**A CURA, em três camadas:** a tela usa a **porta única `useEmpresa()`** (inventar um 2º jeito de saber a empresa foi o erro — e ele nem podia funcionar) · o estado virou **EXPLÍCITO** (`CARREGANDO | SEM_EMPRESA | FALHOU | OK`), porque *enquanto "ausência de dado" servir de estado, o caso não previsto vira spinner* · e a **rota resolve a empresa do cookie no SERVIDOR**, pela mesma porta das páginas globais (*o fallback resolve QUEM, nunca afrouxa o SE* — a permissão segue checada contra a empresa resolvida).

**⭐ O GUARD DE FAMÍLIA FOI ESTENDIDO, não duplicado** (2 detectores novos no arquivo de 14/09): **(1)** nenhuma tela lê cookie `httpOnly` no cliente; **(2)** nenhum carregamento automático tem `return` antes do fetch **sem tocar no estado**. ⚠️ A restrição *"carregamento automático"* não é folga: sem ela o detector acusava **5 telas sadias** onde o early-return é de **GESTO** (`if (!file) return` num "gerar preview" está certo — o dono ainda não escolheu o arquivo) — *alarme falso no dia 1 é como um guard morre*.

**⭐⭐ E O DETECTOR ACHOU UMA 2ª INSTÂNCIA QUE NINGUÉM TINHA REPORTADO:** o **`historico-table`** da conciliação tinha o **mesmo** `if (!empresaId) return` com `loading` nascendo `true` — *"Carregando..."* pra sempre — **e** o `if (res.ok)` **sem else** (o padrão banido em 06/08), que fazia um 500 virar lista vazia. Foi junto.

**⚠️⚠️ REGRA 11 PEGOU O GUARD DUAS VEZES, e o furo é uma lição por si:** repondo o defeito no `historico-table` ele passou **verde** — o detector procurava **`fetch(` literal** e o padrão da casa é **`fetchComTimeout(`** (`'fetchComTimeout('.includes('fetch(')` é **false**). ***O guard nascia cego justamente nas telas que seguem a régua.*** Alargado pra `fetch*`, ele **ainda** passou: a chamada real é **`fetchComTimeout<{ items: … }>(`**, com o **genérico entre o nome e o parêntese**. Só na 3ª versão mordeu (2 vermelhos). ⚠️ O detector de 14/09 tinha **o mesmo furo** e foi corrigido junto — varredura do app inteiro depois: **0 violações**.

**PROVADO EM PROD, nos dois viewports:**
```
celular  PAGE 200 em 749ms · rota 200 em 254ms · 42 removidas
desktop  PAGE 200 em 287ms · rota 200 em 104ms · 42 removidas
  ⛔ document.cookie: SUMIU ✓ · useEmpresa ✓ · "tentar de novo" ✓ · sem-empresa ✓
  porDia: 14/09=1 · 13/09=26 · 09/09=4 · 02/09=1 · 14/08=1 · 09/08=2 · 24/06=7
ROTA DERRUBADA (empresa inexistente) → HTTP 403 → estado FALHOU + "tentar de novo"
SEM empresaId na URL → HTTP 200 · 42 removidas   (antes: 403 mudo)
```
**10.521 verdes · TS 0 · deploy `dXMGy5iJz6E62i2yKiBUs` 4/4 · Δ bundle +4 KB.** ⚠️ Uma sonda minha marcou o timeout como ausente no bundle — era a frase montada por template, que o minificador parte; conferido por `TempoEsgotado` (4 chunks).

### ⛔⛔⛔ O CASO FOI PRA DENTRO DO CARTÃO ≍ — E O CASPER TINHA SUMIDO (20/09)

**O dono:** *"o teu mapa de 3 casas está certo por DENTRO, mas na MINHA PÁGINA as casas empilham: o ponteiro da FRANCIELE e a FILA dela aparecem um em cima do outro — pra mim é a mesma coisa duas vezes, em dois MODELOS visuais diferentes. E o CASPER SUMIU."*

**⛔⛔⛔ O CASPER — e a causa é o default da minha própria régua.** As duas linhas dele são de **04/09 e já categorizadas**: elas **não estão na caixa**, então `divisaoDaTela` **não as conhece**. O predicado fazia `c?.casa ?? 'CAIXA'` e tratou *"desconhecida"* como *"a caixa é dona"* → escondeu. ***É o "some dos dois" que esta própria régua proíbe, cometido pelo default dela.*** ⭐ O default seguro é **APARECER**: *duplicar é feio; sumir é perder trabalho.*

**⚠️⚠️ E POR QUE O GUARD NÃO PEGOU:** ele derivava o card dos **PALPITES** — e linha que não está na caixa **não tem palpite**, então o CASPER **nunca entrou no cenário**. ***Guard que só imagina o caminho conhecido não cobre o que some.*** Agora ele recebe `linhasSoNoCard` e cobre a família.

**⭐⭐⭐ A RÉGUA DE APRESENTAÇÃO (dele):** ***uma decisão aparece UMA vez na página, SEMPRE no mesmo modelo visual — o cartão ≍.*** O caso ambíguo deixou de ser seção embaixo e renderiza **no lado direito do próprio cartão, no lugar do palpite**: a conta, as 2+ candidatas com `[foi esta — vincular]`, e o aviso da já-categorizada. ⛔ O ponteiro morreu junto — *não se aponta pra baixo quando o caso mora aqui*.

⭐ **SÓ A LINHA ANFITRIÃ HOSPEDA O PAINEL.** Duas linhas do mesmo caso na caixa: a 1ª desenha, as outras dizem *"parte do caso «X» acima ↑"*. **Sem isso a duplicação voltaria — agora dentro do modelo certo.** E a **fila solta** a conta hospedada: ela passou a morar no cartão.

**PROVADO EM PROD, na página montada (celular):**
```
⭐ CARTÃO COM O CASO — R$ 500 «FRANCIELE»
     conta «franciele» R$ 500 · vence 15/09
       · R$ 500 15/09 «FRANCIELE…»                      [vincular]
       · R$ 500 08/09 «Tiele…»  ⚠️ já Salários          [vincular]
FILA (seção de baixo): 0 conta(s)      CARDS: 2 ⭐ CASPER DE VOLTA
⛔ alguma decisão 2× na página: NENHUMA ✓
```
**REGRA 11 — o `?? 'CAIXA'` reposto: 2 vermelhos.** ⚠️ E **2 guards ficaram vermelhos COM A TELA CERTA** (o campo virou `caso`, e a rota passou a montar o painel em vez de perguntar quem desenha botão) — **reapontados, não afrouxados**; a régua que continua mordendo é *"nenhuma rota compara a casa na mão"*. **10.588 verdes · TS 0 · deploy `Do7JsHhPedkkE3gji-41b` 4/4 · Δ bundle +0 KB.**

📋 **O QUE NÃO ENTROU NAQUELA VOLTA, e foi declarado em vez de disfarçado:** o item 2 pedia que o **N:M (CASPER) também virasse cartão ≍** — ele voltou **visível**, mas ainda no visual do card de 10/09. **Fechado na volta seguinte, abaixo.**

### ⭐⭐⭐ A ÚLTIMA VOLTA DO MODELO ÚNICO — O N:M ENTROU NO CHASSI ≍ (20/09)

**O dono:** *"embrulha o EscolherNaMaoCard (N:M) no chassi do cartão ≍ — mesmo visual das outras casas, mock v3 junto. Sem pressa, **sem mexer no motor**."*

**⛔ O QUE EXISTIA ERA UM SEGUNDO MODELO PRO MESMO FATO.** O "pra tua mão" abria com a `.linha-banco`: uma faixa fria com `conta · data · "descrição"` e o valor, tudo **numa linha só**. É exatamente o que a coluna **O BANCO DIZ** das outras casas desenha — mesmo dado, dois desenhos. Era a última superfície fora do modelo.

**⭐⭐ O CHASSI GANHOU DUAS CHAVES, NÃO UMA SEGUNDA CÓPIA:**
- **`moldura={false}`** — a moldura é de quem já tem uma. O caso N:M mora **dentro** do cartão do fornecedor (que já desenha borda, raio e sombra), e caixa dentro de caixa é ruído. ⛔ **O que ela NÃO pode tirar é o desenho:** grid, coluna do banco e conector ficam **fora de qualquer condição** — senão `moldura` vira "meio chassi" e as casas voltam a divergir.
- **`painelColado`** — o painel da direita cola nas bordas (`p-0`) porque a lista de notas **sangra de ponta a ponta** e o rodapé é **sticky**; com o padrão do chassi as duas coisas quebravam.

⭐ E o painel ganhou o rótulo irmão do *"MELHOR PALPITE"*: **"QUAIS NOTAS ESTE PAGAMENTO COBRIU"**.

**⛔⛔ MOTOR INTOCADO, E O GUARD AFIRMA ISSO** — não é promessa no commit: um grupo aberto por vez · uma linha por vez (‹ anterior / pular ›) · o Conciliar preso à conta fechada (`pointerEvents: 'none'` até fechar). **Nenhuma linha do `escolher-na-mao.ts` foi tocada.**

**⚠️⚠️ REGRA 11 REPROVOU O GUARD DUAS VEZES, e as duas são a mesma armadilha:** (a) eu fatiava o arquivo a partir do primeiro `moldura ?` e perguntava se o grid aparecia no resto — e ele aparecia **dentro do ternário que eu tinha acabado de repor como defeito**; (b) trocar o rótulo por `{moldura ? 'O BANCO DIZ' : null}` passava, porque a frase **continuava no arquivo**. ***Guard que pergunta "a string está aí?" aprova o condicional que esvazia a string.*** O que morde é exigir o **`className` LITERAL** e a **linha do rótulo sem expressão**.

**PROVADO EM PROD, no bundle servido, nos DOIS viewports (REGRA 12):**
```
celular 200 em 699ms · 1.097 KB      desktop 200 em 194ms · 1.097 KB
  ⭐ "O BANCO DIZ" ✓ · "QUAIS NOTAS ESTE PAGAMENTO COBRIU" ✓ · min-[900px] ✓
  ⛔ o motor: rodapé vivo ✓ · "pular pra próxima" ✓ · "abrir o caso" ✓
ROTA /escolher-na-mao → 200 · 2 cards (CASPER 2.120,81 e 2.275,05, stone)
```
**4 defeitos repostos, 4 vermelhos** (a faixa fria de volta · o grid no ternário · o rótulo condicional · a navegação removida). **10.592 verdes · TS 0 · deploy 4/4 (`br70Lcw-_mfey_Y9YDl9P`) · Δ bundle +0 KB.**

### ⭐⭐ A LIMPEZA DO TOPO — OS LEMAS SOMEM, AS FUNÇÕES DESCEM (20/09)

**O dono:** *"os subtítulos-lema não ajudam mais (a tela já se explica) e ocupam a primeira dobra — **somem de vez**. E a linha «conciliando a partir de… mudar» + «104 em aberto sem par» SAI da posição atual: está estragando o topo. Mas **a FUNÇÃO não pode morrer**."*

**⛔⛔ E É AÍ QUE ESTE PEDIDO SE DIFERENCIA DE "APAGAR COISA DA TELA":** a régua da casa desde 10/09 é ***remoção sem realocação é perda***. As duas ofertas não sumiram — **mudaram de casa**:
- o **`RodapeDaTela`** (linha de 11px no FIM da seção) carrega o corte de época com o **⚙️ mudar** e o caminho pros "em aberto sem par";
- ⭐⭐ e o **card 💤 SEM PAGAMENTO virou LINK de verdade** pro Contas a Pagar. **Ele nunca tinha clicado** — o `Stat` tinha `onClick` na assinatura e o `StatsDoMock` **não passava nenhum**: os três cards eram números decorativos. Agora o 💤 diz pra onde leva (*"contas abertas · ver no Contas a Pagar →"*, o texto que o mock já pedia desde 16/09) — **afordância, não adivinhação** (30/08).

⚠️ **O PORQUÊ DO CORTE NÃO MORREU COM A LINHA:** *"a fila mostrando menos do que existe precisa DIZER por quê"* — a frase virou **`title`**, o mesmo padrão do ⓘ que absorveu a doutrina em 10/09. Ela parou de ocupar a dobra, não de existir.

**⭐ E O `Stat` COM DESTINO É `Link`, NUNCA `onClick` FINGINDO NAVEGAÇÃO** — o que muda é a **tag**, nunca o estilo: um card com visual próprio pro caso "tem link" divergiria no primeiro ajuste de tom.

**⚠️⚠️ REGRA 11 — 4 DEFEITOS REPOSTOS, E O DO CARD 💤 VEIO VERDE:** o guard pedia `toContain('hrefSemPagamento')`; eu tirei o `href` do card **com a declaração da prop intacta** e ele passou. ***"Menção, não uso" pela TERCEIRA vez nesta casa*** (o `acaoValePraSentido` de 15/09, o `respostaDeErroDoEstoque` de 16/09) — apertado pro **uso dentro do bloco do card**. Os outros três morderam de primeira (o lema de volta · o rodapé sem chamador na página · coisa voltando entre os stats e os cards).

**⚠️ 2 GUARDS REAPONTADOS, e um ficou MAIS APERTADO:** o critério da dobra era *"stats + a frase das sem-par, mais nada"*; agora é **só os stats**. E a frase-lema saiu da lista de "textos que o mock imprime" **invertida com o motivo escrito**, não apagada: a **ausência dela** nos dois (mock e tela) é o que o guard afirma.

**PROVADO EM PROD, no bundle servido, nos DOIS viewports.** **10.593 verdes · TS 0.**

⚠️ **E o deploy abortou uma vez por culpa minha:** eu tinha copiado a sonda da prova pro servidor com `scp` (untracked) e depois a commitei — o `git pull` recusou sobrescrever. **O blue-green segurou**: prod seguiu no build anterior, intacto. Limpo com `saferm` (que confere git-tracked antes de apagar) e repetido. *Lição pequena: arquivo que vai virar commit não se adianta por `scp`.*

### ⛔⛔⛔ ERAM TRÊS SUPERFÍCIES — E A MINHA PROVA MEDIU A ERRADA (20/09)

**O dono, com o print na mão, DEPOIS da minha entrega:** *"a linha FRANCIELE está na caixa COM palpite e botão E o card dela está no PRA TUA MÃO com [Vincular] nas duas linhas. Tua entrega mediu «pares com botão nas duas: NENHUM» — a minha tela mostra o oposto."*

**⛔⛔⛔ ELE ESTAVA CERTO E EU MEDI A SUPERFÍCIE ERRADA.** A página `/conciliacao` faz **QUATRO** chamadas — `/caixa`, `/fila`, `/escolher-na-mao`, `/corte` — e **três desenham botão**. Eu tinha ligado a régua em duas; quem desenha o `[Vincular]` do *"pra tua mão"* é a **`/fila`** (`contasEsperandoPagamento`), que ficou de fora. ***Guard que roda contra as rotas separadas aprova exatamente o que o dono vê e eu não.***

**⛔⛔ E HAVIA DUAS DEFINIÇÕES DE "CASO" — ele diagnosticou antes de mim, e a medição confirmou:**
```
a FILA conta candidatas INCLUINDO categorizadas (07/09) → franciele = 2 → caso existe
a minha régua contava linhas NA CAIXA                  → franciele = 1 → 1↔1
```
*Cada lado se achava dono, e os dois desenhavam botão.* ⭐ A definição que fica é **a da fila**, por decisão dele: *"se a Tiele-categorizada mantém o caso vivo, então o caso EXISTE e a linha da caixa vira PONTEIRO"*. Medido: a fila oferece **2 linhas** pra «franciele» (a de 15/09 com score 95 e a Tiele categorizada com 55) — não as 8 candidatas cruas de valor+data, mas **a lista que produz botão**.

**⭐⭐ TRÊS CASAS, e a terceira nasceu do guard da página montada:** minha 1ª correção mandava o ambíguo pro CARD e **a fila continuava desenhando** — duas superfícies de novo, as duas do lado direito. Agora: **1↔1 → CAIXA** · **AMBÍGUO → FILA** (é lá que as N linhas aparecem lado a lado com o aviso) · **N:M → CARD**. A `divisaoDaTela` é a **porta única** que as três rotas chamam; ⚠️ ela entra na fila **por parâmetro** (a rota a calcula) pra não criar ciclo de import.

⭐ **A METADE QUE FALTAVA:** a fila **esconde** a conta que a caixa reivindicou. ⛔ E só reivindica quando a fila oferece **aquela mesma linha** — *some dos dois é pior que aparecer nos dois*.

**⚠️⚠️ A PROVA EM PROD PEGOU MAIS UM ERRO MEU, e ele é a lição do dia:** depois de tudo, a página **ainda** mostrava botão nos dois — a rota `/caixa` comparava **`casa === 'CARD'`** na mão, e o ambíguo passara a morar em **`FILA`**: `casoNoCard` vinha `null` e o botão voltava. ***Meu guard exercitava o predicado da lib e a ROTA não o usava*** — "guard que testa a lib aprova a tela que a ignora", pela minha mão. Os predicados (`aCaixaDesenhaBotao` / `aFilaDesenhaBotao` / `oCardDesenhaBotao`) viraram lib, as rotas os **chamam**, e o guard proíbe comparar casa na mão.

**⭐ O GUARD RODA CONTRA A PÁGINA MONTADA** (exigência dele): ele junta as três superfícies e pergunta *"alguma linha tem botão em duas?"*. ⚠️ Ele também nasceu frouxo — derivava o card da `casa` em vez de chamar o predicado da rota, e **repor o defeito passava verde**; só mordeu depois de executar a régua real.

**PROVADO EM PROD, nas 3 chamadas que a página faz:**
```
CAIXA  → APONTA R$ 500 «FRANCIELE» · "faz parte do caso «franciele» … Resolver lá →"
                                      âncora #par-cmu8w6qv107ja12f0r2kppjjd
FILA   → «franciele» R$ 500 · 2 [Vincular]  ⭐ É AQUI que ele resolve
CARDS  → 0
⛔ linha com botão em duas superfícies: NENHUMA ✓
```
**REGRA 11 — 4 defeitos repostos** (a fila decidindo sozinha · o ambíguo contando só a caixa · o card desenhando o ambíguo · a rota comparando a casa na mão). **10.578 verdes · TS 0 · deploys `TviO8JYqpafRdemR8oEua` e `4lghCP06Pm0HtfwqneF83`, os dois 4/4 · Δ bundle +0 KB.** ⚠️ Custo: cada rota paga as duas fontes (~380 ms medidos) — *"performance se resolve com cache, nunca com número errado"*.

### ⛔⛔⛔ UMA PERGUNTA, UMA CASA — O MESMO PAR EM DUAS SUPERFÍCIES (20/09)

**O dono:** *"a linha FRANCIELE está na caixa COM palpite e o MESMO par aparece embaixo como card no PRA TUA MÃO (com botões próprios)."*

**⛔⛔ A CAUSA É ESTRUTURAL: as duas superfícies decidem sozinhas.** A caixa monta palpites, o card monta a escolha manual, e **nenhuma sabe da outra** — a página busca as duas em paralelo. Dois botões pro mesmo par é a família do **caso Cancian** (08/09), em que a nota errada foi vinculada porque dois cards ficaram quase idênticos: ***o desenho certo é nem criar a disputa visual.***

**A DIVISÃO (`lib/conciliacao/uma-casa-por-caso.ts`, pura):** **1↔1 com palpite** → mora **só na linha da caixa** · **AMBÍGUO** (2+ linhas da caixa disputando a mesma conta) ou **N:M** (lote) → mora **só no card**, e a linha da caixa **perde o botão e vira PONTEIRO**, com o nome do caso, o porquê e a **âncora** (*"faz parte do caso «franciele» — mais de uma linha pode ser o pagamento desta conta. Resolver lá →"*). ⛔ *"Resolver lá" sem o "lá" seria ordem, não caminho.*

⭐ **AS DUAS ROTAS CHAMAM A MESMA FUNÇÃO.** Uma régua em cada uma divergiria no primeiro caso de borda e o par voltaria a aparecer duas vezes — a doença que este módulo mais paga. ⚠️ Custou **+166 ms** nos cards (o `palpitesDaCaixa` roda lá também); medido em prod, caixa **145 ms** e cards **200 ms**. *Correção primeiro: "performance se resolve com cache, nunca com número errado".*

**⚠️⚠️ A AMBIGUIDADE É MEDIDA SOBRE QUEM ESTÁ NA CAIXA — e isso foi escolha, com número.** A conta «franciele» tem **8 linhas candidatas** por valor+data (medido: Tiele, CEREALISTA GIRUA, MARIA LUIZA, JANAINA ×2, E-CAIXAS, Viviane…). Se *"2+ candidatas"* bastasse pra chamar de ambíguo, **toda** conta viraria caso de card e o palpite nunca mais teria botão. O que cria a disputa é **duas linhas em aberto** reivindicando a mesma conta.

⭐ **E QUEM VEIO PELA PORTA (`?abrir=` / `?conta=`) NUNCA É ESCONDIDO** — ali o dono apontou a linha de propósito, e devolver tela vazia seria a porta pintada de novo (a lição de 13/09).

**⭐⭐ A PERGUNTA SOBRE A TIELE, RESPONDIDA — E A CONSEQUÊNCIA CORRIGIDA.** *"Ela já está resolvida como Salários — ainda deve ser oferecida como candidata?"* **Sim**, e a régua já era de 07/09: *"ter categoria não quita conta nenhuma"* — escondê-la esconderia justamente o caso em que o pagamento verdadeiro virou **despesa avulsa**, que é o que produz dupla contagem.

⚠️⚠️ **MAS O TEXTO QUE ELE PROPÔS PRECISOU DE CORREÇÃO MEDIDA:** *"vincular aqui DESFAZ aquilo"* — **não desfaz**. O backfill é **cooperativo** (só preenche o que é `null`), então a Tiele continuaria "Salários". O que muda é outra coisa, e é a que importa: **a conta sai do "em aberto" e aquela linha vira o pagamento dela**. O aviso diz isso. *Repetir a frase dele seria inventar um efeito — e é o erro que este doc já registra sobre mim em 29/08.*

**PROVADO EM PROD:**
```
CAIXA 3 linhas · CARDS 2 · pares com botão nas DUAS: ⭐ NENHUM
FRANCIELE hoje é 1↔1 → fica na caixa, com botão
cena reposta (2 linhas na mesma conta) → as DUAS vão pro CARD, a caixa aponta
guard de integração: conciliada/ignorada some das duas · categorizada sai da caixa
  e CONTINUA no card (a exceção de 07/09, travada)
```
**REGRA 11 — 3 defeitos repostos** (o card repetindo o par 1↔1 · o botão do palpite num caso do card · o texto prometendo desfazer a categoria). ⚠️ **E o guard do 2º não mordeu na 1ª versão**: ele procurava `{l.palpite && !l.casoNoCard && (` no arquivo e a string aparece **duas vezes** — tirar o gate de uma passava verde; o que morde é olhar **o bloco que desenha o botão**. **10.574 verdes · TS 0 · deploy `KLMlDpj3oUS3b7zho6lp-` 4/4 · Δ bundle +0 KB.**

⚠️ **DOIS REGISTROS HONESTOS:** (a) o **teste de integração novo ficou vermelho 1× em 4 rodadas** e eu **não reproduzi nem nomeei a causa** — é meu, não é pré-existente, e fica **vigiado**, não rotulado; (b) a sonda da cena reposta pegou **outra** linha da Franciele (05/06, R$ 250) por `findFirst` sem ordenação — a régua demonstrada é a mesma, o id não é o do caso.

### ⛔⛔⛔ "NÃO CONSEGUI CARREGAR." ERA 500 SEM CORPO — O `as never` ESCONDIA O CONTRATO (20/09)

**O dono:** *"clico «✓ Confirmar — concilia a eliane» e aparece só «Não consegui carregar.» — sem motivo, sem «tentar de novo», e não sei nem O QUE falhou (o painel? a conciliação em si? gravou ou não?)."*

**MEDIDO NA ROTA REAL, com a sessão dele:** `HTTP 500 · content-type: null · corpo VAZIO`. O `fetchComTimeout` lê `{erro}` do corpo; **sem corpo**, ele cai no fallback genérico — daí a frase que não diz nada.

**⛔⛔ A CAUSA É MINHA, DE ONTEM:** o `CASAR_PAGAR` chamava `reconcileTransactions(input, { userId, companyId } as never)` — e o reconcile usa **`ctx.company?.id`** e **`ctx.requirePermission()`**, que aquele objeto não tem. ***O `as never` calou o compilador*** e o gesto estourava em runtime. É **literalmente a lição de 19/09 escrita neste doc** — *"cast que cala o compilador é o lugar onde o contrato incompleto se esconde"* — cometida por mim no dia seguinte.

**⚠️⚠️ E OS MEUS TESTES PASSARAM VERDES PORQUE MOCKAVAM O RECONCILE.** O mock aceita qualquer coisa: ele substituiu **justamente a peça que cobra o contrato**. ***Guard que troca a peça não prova o encaixe dela*** — os mocks agora cobram `company.id` e `requirePermission`, como o original.

**AS QUATRO CAMADAS DO CONSERTO:** o **AuthContext real** vai da rota até a lib (o `as never` morreu) · a rota **nunca mais devolve 500 sem corpo** (o inesperado continua 500 — ali o genérico é honesto —, mas com JSON que DIZ o que falhou e `code` pra a tela agir) · `ReconciliationError` vira recusa que a tela entende · e a tela **diz O QUE falhou e sempre oferece [tentar de novo]**, repetindo o MESMO gesto com o MESMO alvo.

**⛔ E NADA GRAVA PELA METADE.** A categoria aprendida é escrita **antes** do reconcile (forçado: ele faz *backfill cooperativo*, então a conta precisa estar categorizada antes). Se o reconcile falha, a compensação **desfaz exatamente o que este gesto escreveu** — e só nas contas que estavam `null`. ⚠️ Compensação e não transação porque o `reconcileTransactions` usa o prisma global e **não entra numa `$transaction` nossa**; envolvê-lo exigiria ele aceitar client transacional. *Medido no caso real: nada tinha gravado — mas por sorte (a conta da ELIANE já tinha categoria).*

### ⭐⭐⭐ A CATEGORIA MUDOU PRO LADO ESQUERDO, E VIROU OBRIGATÓRIA ANTES (20/09)

**A decisão do dono:** *"o lado esquerdo tem menos conteúdo e sobra espaço; assim a categoria não fica espremida na fileira de chips da direita, e o cartão equilibra visualmente."* O seletor mora **sob o valor**, na coluna *"O BANCO DIZ"*.

**⛔⛔ E A METADE QUE FAZ A RÉGUA FUNCIONAR É A DAS EXCEÇÕES.** A régua não é *"tem categoria?"* — é ***"de onde vem a categoria desta linha?"***, com três respostas (`lib/conciliacao/categoria-antes-do-gesto.ts`): **ESCOLHER** (despesa/receita avulsa e estorno — a natureza deles É a categoria) · **ESTRUTURAL** (fatura, parcela, transferência, ignorar — *exigir categoria de um pagamento de fatura é cobrar duas vezes pelo mesmo fato*, e foi por isso que o Fluxo criou os rótulos `[sistema]` em 26/08) · **HERDA_DA_CONTA** (casar). ⭐ *Parede é como o dono aprende a contornar o sistema por fora.*

⭐ **O seletor DIZ em vez de pedir** quando o palpite é casar (*"herda da conta: Salários"*) — pedir ali faria o dono classificar uma linha que o backfill ia sobrescrever. ⛔ **E quando a conta não tem categoria, ele PEDE ANTES do clique** — a mesma recusa que o servidor daria, dita no cartão: *fazer o dono clicar pra levar um não é trabalho que dava pra poupar.*

⭐⭐ **O chip de categoria deixou de abrir menu próprio** — ele dispara com a escolha da esquerda. *Dois menus pra mesma pergunta seriam duas réguas na mesma tela: ele escolheria num, clicaria no outro, e a linha sairia com a categoria errada.*

**REGRA 12 DE GRAÇA:** o seletor é o **último bloco da coluna esquerda**, então no celular (que empilha pelo mesmo `min-[900px]` do mock) ele cai **entre o valor e o palpite — sem uma segunda composição pra manter**. O **mock v3 versionado foi atualizado junto** (`.cat`, `.cat-sel`, `.cat-diz`, `.aviso-cat`) e o guard de tokens acompanha, conferindo inclusive **que o bloco está do lado esquerdo e depois do valor**.

### ⛔⛔⛔ E A PROVA EM PROD ACHOU QUE "HERDA DA CONTA" VALIA SÓ NA METADE DOS CASOS

A ELIANE conciliou (HTTP 200, conta `EFFECTED/RECONCILED`, vínculo certo) — e a **linha do banco saiu pro arquivo SEM CATEGORIA**, aparecendo como **"A CLASSIFICAR"** no Fluxo de Caixa. **Exatamente o vermelho que a régua de hoje existe pra impedir.**

**A causa:** o *backfill cooperativo* (a linha herdar a categoria da conta) existia **só no ORPHAN MODE**. No **CLASSIC** — conta a pagar em aberto, o caminho COMUM — ele **não existia**. ⚠️ Eu escrevi *"a linha HERDA a categoria da conta (é o que o reconcile já faz)"* no código e no doc de manhã: ***valia pra metade***, e só a prova navegando mostrou.

⭐ Agora o CLASSIC herda **categoria e fornecedor** (cooperativo: só o que está `null`, nunca sobrescreve o dono), **sobe o status** (a escada de 28/06 — linha categorizada não fica com badge "Pendente"), o **audit guarda o que foi escrito**, e o **desfazer restaura nos dois modos por um helper único** — *desfazer pela metade deixaria na linha uma categoria que ela nunca escolheu*.

**PROVADO EM PROD, pelas portas reais (desfazer → refazer):**
```
ANTES    LINHA: ARQUIVO · categoria ⛔ nenhuma · no Fluxo: "A CLASSIFICAR"
desfazer LINHA: CAIXA (volta pra fila)          CONTA: PAYABLE/PENDING
refazer  LINHA: ARQUIVO · categoria Salários · no Fluxo: "Salários" ⭐
         CONTA: EFFECTED/RECONCILED · vínculo ✓
REGRA 12 — celular e desktop: seletor ✓ · aviso ✓ · "herda da conta" ✓ · "vem do gesto" ✓ · retry ✓
```
**REGRA 11 — 5 defeitos repostos** (o ctx falso: **5 vermelhos** · sem compensação: **1** · o `throw` mudo: **1** · o palpite disparando sem categoria: **1** · o CLASSIC sem backfill: **2** · o undo sem restaurar: **1**). **10.557 verdes · TS 0 · deploys `dXMGy5iJz6E62i2yKiBUs`, `CvSrjyJDe3F-Mv6UWDX54` e `HUtCRiqcjplFiY1eTDuX1`, os três 4/4.**

### ⛔⛔⛔ A FLAG DIZ "PARECE", O VÍNCULO DIZ "É" — E A LEI DA ESTAÇÃO CONFIAVA NA FLAG (20/09)

**O dono:** *"o mapa dizia «pagamento órfão 8.626,98 (17/09) bate a fatura OPEN do Carter, palpite aceso na caixa», mas a caixa hoje tem só 4 linhas e ela NÃO está."*

**⭐ MEDIDO POR ID (`cmu7qr6ow000o7tu9960fi9wg`) — e a hipótese da dupla contagem CAIU:** a linha **não foi categorizada**, não foi ignorada, não tem vínculo e **não tem UM registro de auditoria**. Ninguém mexeu nela. O que ela tinha era **`isCardPayment: true`** (marcado pelo passo 8.5 do import, por **heurística de DESCRIÇÃO**) com **`businessCreditCardId: null`**.

**⛔ E `comoFoiResolvida` declarava isso RESOLVIDO** (`if (l.isCardPayment) return 'pagamento de fatura de cartão'`): a linha ia pro **ARQUIVO com um selo que afirma uma quitação que nunca houve**. Daí a fatura do Carter ficou **OPEN com o pagamento dela no extrato**, o **K3 gritando todo dia** — e ***nenhuma tela onde resolver***. **A resposta à pergunta 3 do dono é esta: o palpite nunca pôde ser oferecido porque a LINHA nunca chegou na caixa.**

**⚠️⚠️ E A LIÇÃO JÁ ESTAVA ESCRITA NESTE DOC, em 29/08, com estas palavras:** *"a flag diz «parece»; o vínculo diz «é» (…) sem `businessCreditCardId` a fatura fica aberta pra sempre: **a flag não quita nada, só tira da fila**"*. ***Ela virou comentário de teste e não virou régua*** — e o defeito nasceu **depois**, na lei das estações (15/09). *Lição que não vira executável volta.*

**A CURA:** o selo exige o **VÍNCULO**; sem ele a linha **volta pra caixa**, onde o palpite do cartão (`mesQueBateOValor`) a reconhece. ⚠️ O `SELECT_DA_CAIXA` passou a carregar `businessCreditCardId` — *sem o campo, `faturaVinculada` seria sempre `false` e TODA linha de cartão voltaria pra caixa*; a derivação mora no `paraLei`, um lugar só. ⭐ E a **parcela de empréstimo sempre olhou o vínculo** — o cartão era a exceção, não a régua.

**📋 A VARREDURA DA FAMÍLIA (as 3 perguntas, respondidas com número):**
| pergunta | resposta medida |
|---|---|
| pagamento de fatura categorizado como DESPESA (dupla contagem no DRE) | **ZERO** — não existe nenhuma |
| órfãs da flag (invisíveis na caixa) | **1** — exatamente a do Carter |
| faturas abertas sem pagamento vinculado | 5, mas **só a do Carter tem débito de valor exato no extrato**; as outras 4 esperam dinheiro que não está no sistema |

**⭐ APLICADO PELA PORTA REAL** (`POST /casar-pagamento`, `pg_dump pre-casar-carter.dump` antes), **nunca por script replicando a lógica**. ⚠️ E o motor é o **`casarPagamentoDeCartao`, não o `payInvoice`**: aquele **CRIA** a saída (é o caminho do PF, quando o dono digita "paguei"); aqui **o dinheiro já saiu e já está no extrato**, então o gesto é **AMARRAR** — usar o outro duplicaria o dinheiro.

**⚠️ ACHADO NO CAMINHO: o `deltaDespesaRemovidoDoDRE` mentia.** Ele devolvia `tx.amount` **sempre** — a rota respondeu *"R$ 8.626,98 removidos do DRE"* numa linha que **nunca teve categoria** (nada saiu de lugar nenhum). Agora é zero sem categoria. *Número que afirma um efeito que não houve é a família do "número sem régua em tela de dinheiro".*

**⚠️⚠️ E UM FLAKE PRÉ-EXISTENTE FOI DIAGNOSTICADO, não rotulado** (a régua de 01/09): o `afterEach` do E2E das 9 linhas apagava transação com `{ businessCreditCardId: { not: null }, bankAccountId: null }` — **sem escopo de empresa** —, varrendo as compras do `palpite-acende-com-dado-real` **no meio da rodada paralela**. O vermelho **mudava de teste a cada rodada** e não era de ninguém. Escopado; 3 rodadas verdes. ⭐ E o mesmo E2E montava o `LinhaParaEstacao` **à mão** (a 2ª derivação que o `paraLei` existe pra impedir) — *ele podia passar verde com a tela lendo outro campo*; foi o `tsc` que cobrou quando o vínculo entrou na lei.

**PROVADO EM PROD, depois do deploy:**
```
FATURA Carter 2026-09: net 8.626,98 · 1 pagamento vinculado (17/09) → PAGA ✓
A LINHA: estação ARQUIVO · selo "pagamento de fatura de cartão" · categoria: nenhuma
A CAIXA: saídas 4 · entradas 0 · arquivo 275 · total 279 · Σ fecha ✓
ÓRFÃS DA FLAG: 0        K3 (órfão × fatura OPEN): 0 — o do Carter APAGOU ✓
```
**REGRA 11 — 3 defeitos repostos** (a lei voltando à flag: **2 vermelhos** · o `faturaVinculada` cego: **1** · o delta mentindo: **1**). **10.527 verdes · TS 0 · deploy `NBzIqdI3hBhTAJoCvqgVn` 4/4 · Δ bundle +0 KB.** ⚠️ Uma sonda minha chamou o `checkCardInvariants` **sem o `now`** da assinatura e estourou `TypeError` — refeita antes de eu reportar qualquer coisa sobre o juiz.

📋 **ACHADOS DO JUIZ, REGISTRADOS E NÃO ATACADOS** (fora do escopo deste pedido): **K1/K2** *"sicredi 2026-09: total gravado 3.194,35 vs recomputado 2.365,85 (cache podre)"* e **K5** *"fila A_CLASSIFICAR: 109 linhas / R$ 10.262,17 — a mais antiga tem 36 dias"*.

## ⭐⭐⭐ RADAR DO ESTOQUE — O AvT DIÁRIO NA LÍNGUA DA COZINHA (20/09/2026)

**Mock aprovado em `docs/mocks/radar-do-estoque-mock.html` (versionado, com os DOIS temas e os dois viewports), e só então construído.** Tela `/empresas/:id/estoque/radar` + sidebar.

**⛔⛔ A MAIOR PARTE DO TRABALHO FOI *NÃO* ESCREVER MOTOR.** A ordem era *"porta única lendo das funções que JÁ EXISTEM — NENHUMA segunda régua de saldo/consumo"*, e a medição mostrou que a variância **já está gravada**:

| pergunta | de onde vem |
|---|---|
| **DEVIA TER** | `stock_contagem_item.saldoSistema` — snapshot GRAVADO no instante da contagem |
| **CONTAMOS** | `qtdContada` |
| **FALTOU/SOBROU** | `divergencia` · `valorDivergencia` |
| os baldes do meio | o LEDGER, pelos **MESMOS `TIPOS`** do Real vs Teórico |
| custo | `custoMedioPorItem` — a MESMA fonte da Posição |

⭐ E o *"vendeu"* é **as mesmas fichas da baixa por construção**: o `BAIXA_VENDA` do ledger foi escrito pela explosão da ficha quando a venda baixou. **Re-explodir aqui seria a segunda régua que a ordem proíbe.**

**⭐⭐ A JANELA É POR ITEM (decisão do dono):** *"usa a ÚLTIMA CONTAGEM do item como ponto de partida — variância ENTRE contagens — com o período ESCRITO na conta de padeiro."* Cada linha carrega `desde`/`diasDaJanela`, porque **duas linhas da mesma tela podem falar de janelas diferentes, e esconder isso mentiria o tamanho do furo**.

**AS RÉGUAS DE HONESTIDADE, todas travadas em teste:** *"falta contar"* é **estado próprio** (`null`, nunca 0) no item **e** no gráfico por dia (lá vira barra vazia tracejada — zero se leria como *"bateu certinho"*) · a ordem é pelo **DINHEIRO** e *"sem contagem"* fica **por último** (no topo empurraria o furo real pra baixo) · o degrau vermelho×âmbar é em **R$**, não em % · e **o que está FORA das listas aparece NOMEADO**, senão o número grande subestimaria em silêncio.

**⭐ AS LISTAS SÃO CONFIGURAÇÃO, NÃO DADO DERIVADO.** A tentação era *"mostrar sempre os N mais caros do momento"* — e aí a lista **mudaria sozinha**. Tabela `stock_radar_watchlist` (CREATE-only, CHECK na lista, **único por item**: dois toques no "+ adicionar" não duplicam). **O seed só roda no PRIMEIRO acesso** — rodando sempre, sobrescreveria a edição do dono.

**⚠️⚠️ E O GUARD DE FAMÍLIA PEGOU UM DEFEITO MEU:** `aoMudar` (função vinda de PROP) numa dep de `useCallback` — **a bomba armada do laço de 20 req/s de 14/09**. Hoje só roda por gesto; foi assim que o `LinkPaymentModal` ficou com a mesma bomba esperando alguém ligar um efeito. Curado pelo **ref**, o padrão da casa.

**PROVADO EM PROD, nos dois viewports:**
```
celular 200 em 414ms · 830 KB      desktop 200 em 176ms
  OS CAROS/PORÇÕES ✓ · DEVIA TER+CONTAMOS ✓ · "falta contar hoje" ✓
  rodapé honesto ✓ · min-[900px] ✓ · paleta escura não vazou ✓
ROTA ontem→hoje: ⛔ Σ(vereditos) = placar → BATE ✓ · contas que FECHAM: 1 de 1
LISTAS semeadas: CAROS=5 · PORCOES=30
```

**REGRA 11 — 6 defeitos repostos, e DOIS vieram VERDES:** (a) o do **seed** — quem barrava a reposição era o **índice único do banco**, não o early-return que eu testava; no dia em que alguém trocasse o `createMany` por `upsert`, o seed reporia **com o guard verde**. Apertado pra a INTENÇÃO (com lista existente, a semente não pode nem ser consultada — um `db` espião explode se for). (b) o do **fetch cru** — eu tinha escrito um detector PRÓPRIO e a forma reposta não casava o regex; ⭐ a cura não é regex melhor: **o detector do `fetch*` já tem dono** (`spinner-eterno-nao-existe`), que varre o app inteiro. *Um detector, um lugar* — a duplicata saiu.

### ⭐⭐ RADAR v1.1 — O SISTEMA MOSTRA O QUE SABE, E O FREIO APRENDE A PERGUNTA (20/09)

**⭐ 1. TODA LINHA DIZ O SALDO DO SISTEMA, e a conta de padeiro ABRE MESMO SEM CONTAGEM.** Decisão do dono. O saldo vem da **porta da Posição** (`saldosDaEmpresa`) — segunda régua aqui faria o Radar e a Posição discordarem sobre o mesmo item. ⛔ E a variância **continua exigindo contagem**: `contamos`/`faltou` vão `null` e a tela escreve *"— falta contar"* nas duas últimas linhas. ***É o TIPO que impede o zero de entrar em silêncio***, não uma lembrança.

⭐ **A ressalva escrita** (*"as vendas de hoje ainda não foram baixadas"*) entra no balde do "vendeu" quando a janela alcança a ponta e não há `BAIXA_VENDA` no dia: *o número é o que o sistema SABE, sem se passar por completo*. E o **placar sem contagem deixou de ser um traço** — ele diz o tamanho do que está sendo vigiado.

**⭐⭐ 2. O FREIO APRENDE A PERGUNTA CERTA (`lib/stock/escala.ts`).** O freio **já tinha disparado** nos dois casos de 14/09 e a marcyelle **confirmou** — porque a pergunta era *"a contagem está 9280% fora do sistema"*. ***Pergunta vaga é pergunta que se confirma sem ler.*** Agora, quando existe assinatura de troca de escala, a recusa vira a frase com o número e a tela oferece **em 1 toque**:
```
"Você quis dizer 166 un? 16600 é cem vezes o que o sistema tem (177 un)."   sugestão: 166 (100×)
```
⛔ **Confirmar o absurdo continua possível** — um dia o número absurdo vai ser verdade, e travar empurraria a cozinha pra fora do sistema. ⭐ **REGRA 4 duas vezes:** a recusa reusa o campo **`grandeza`** que já existia (do guard da produção, 19/09), e a varredura usa a **MESMA** `acharTrocaDeEscala` do freio — varredura e freio não têm como discordar.

⚠️⚠️ **E ELA NÃO SE UNIFICA COM O `plausibilidade.ts` DA PRODUÇÃO, de propósito:** lá a régua compara o lote com o **rendimento histórico da própria ficha**; aqui compara o digitado com o **saldo do sistema**. São perguntas diferentes com fontes diferentes — juntar faria a produção passar a olhar saldo, que não é o número dela. O que as duas compartilham é a leitura do mundo: ***unidade mental ≠ unidade de controle***.

**⚠️⚠️ 3. O DEGRAU ">100×" DO PEDIDO NÃO PEGAVA O CASO QUE O MOTIVOU** — medido: o creme de leite é `16600 / 177 = **93,8×**`, e ficaria de fora por seis décimos. A varredura passou a usar a **assinatura** (fator 10/100/1000 com o palpite caindo perto do saldo). **Resultado na Caçula — são exatamente 2, e só um segue de pé:**
```
⛔ NUNCA RECONTADO  CREME LEITE ITALAC 200GR · 14/09 · sistema 177 → 16.600 · provável 166 (100×)
                    saldo HOJE 16.600 UN · R$ 39.342,36  ← o fantasma vivo
✓ RECONTADO DEPOIS  REQUEIJAO CHEDDAR · 14/09 · sistema 31 → 28.500 · provável 28,5 (1000×)
                    saldo HOJE 28,5 KG · R$ 1.225,22
```

**PROVADO EM PROD, nos dois viewports:**
```
celular 200 · 525ms · desktop 200 · 129ms — "no sistema" em toda linha ✓
⛔ contas de padeiro que FECHAM: 34 de 34   ·   Σ(vereditos) == placar ✓
placar sem contagem: R$ 39.980,87 (o que as listas valem no sistema)
FILE DE PEITO DE FRANGO — a conta que abre SEM contagem:
   desde 14/09 (6d) · tinha 44,4 · comprou +160 · separado −80,64
   DEVE TER AGORA 123,76 · CONTAMOS — falta contar · a conta fecha ✓
```
**REGRA 11 — 5 defeitos repostos, 5 vermelhos.** **10.667 verdes · TS 0 · deploy 4/4 (`6Dry2Ykrn_DrkDDBjjHJF`) · Δ bundle +0 KB.**

📋 **PENDENTE, e é o gesto do dono:** recontar o **creme de leite** pela tela (o freio agora vai oferecer *"usar 166"*). Depois disso eu confiro o rastro — posição, juiz e o Δ de custo dos consumos entre 14/09 e a recontagem — **sem corrigir nada sem o OK**.

### ⭐⭐ RADAR v1.2 — OS DIAS NOMEADOS E A HISTÓRIA VERDADEIRA (21/09)

**⭐ 1. O NÚMERO DIZ DE ONDE VEIO.** O balde carrega os dias que o formaram (*"vendeu (baixas de 18 e 19/09)"*), e a ressalva **nomeia a DATA**: *"o dia 20/09 ainda não tem baixa de vendas"*. ⛔ **Nunca "hoje"** — quem abre a tela amanhã de manhã lê *"hoje"* e entende outro dia. Acima de 3 dias o rótulo vira intervalo, senão a linha estoura no celular.

**⭐⭐ 2. VIDA NO DIA SEM CONTAGEM — e ela é HISTÓRIA MEDIDA, não número inventado.** Cada linha *"falta contar"* ganha o **chip do último veredito com data e cor** (*"18/09: sobrou R$ 2,10"*) e uma **sparkline de 7 dias**. ⛔ **Dia sem contagem é LACUNA no traço**: o segmento é pulado quando um dos vizinhos não foi medido — *ponto em zero se leria como "bateu certinho"*, que é a mentira que esta tela inteira existe pra não contar.

**⭐ 3. A BARRA DA SEMANA no placar dos DOIS viewports** (uma composição só — o celular não fica com menos informação que o computador). ⚠️ E ela sai do **histórico que as linhas já trazem**: uma consulta a mais por causa de uma barrinha é como o badge virou 1,3 s em 11/09.

**PROVADO EM PROD** (a sparkline impressa como `▼▲·`, lacuna no dia sem contagem):
```
faltou R$ 3,31  COCA COLA 600ML  [sistema 109 · R$ 360,47] ⟨20/09: −R$ 3,31⟩ ▼▲▲▲·▼·
falta contar    porçao queijo 135 grama [sistema 1.266 · R$ 5.325,20] ⟨18/09: R$ 206,78⟩ ▲▼▲▲···
falta contar    beef de xis   [sistema 220 · R$ 1.123,21] ⟨18/09: −R$ 22,85⟩ ··▼▼···
⛔ Σ(vereditos) == placar ✓  ·  contas de padeiro que FECHAM: 35 de 35
celular 200 · 710ms · desktop 200 · 139ms · Δ bundle +4 KB
```

**⚠️⚠️ REGRA 11 — 5 defeitos repostos, e DOIS VIERAM VERDES: "MENÇÃO, NÃO USO" PELA QUARTA VEZ.** Repus a ressalva voltando a dizer *"hoje"* e os dias somindo do balde: **verde nos dois**, porque as frases aparecem no **comentário de documentação do próprio motor**, e eu lia o arquivo CRU. ***O arquivo que documenta o defeito não pode ser o que o absolve.*** (As outras três: `acaoValePraSentido` 15/09 · `respostaDeErroDoEstoque` 16/09 · `hrefSemPagamento` 20/09.) O guard passou a ler o motor **sem comentário**, e a afirmar o **USO** (`...(dias.length ? { dias } : {})`), não a declaração — o tipo continua conferido no texto cru, onde o comentário não atrapalha.

**⚠️ E 2 GUARDS FORAM REAPONTADOS por ficarem vermelhos COM A TELA CERTA:** o de ordenação proibia qualquer `.sort()` na tela e pegou o `.sort` que acha **o pior DIA** da barra — *guard largo demais reprova o certo e ensina a afrouxar*.

**10.673 verdes · TS 0 · deploy 4/4 (`_OgFrXK9xtPjPG7vNNBjf`).**

### ⭐⭐⭐ UMA LISTA SÓ — A ARQUITETURA FINAL DA CONCILIAÇÃO (23/09)

**O dono, com o cartão do lote já no chassi:** *"a PÁGINA ainda tem SEÇÕES separadas. Mesma pergunta («o que esta linha do banco é?») em duas casas = 2 modelos pra mim, igual antes."*

**⛔ É a última forma da doença de 20/09** — lá era o mesmo **PAR** em duas superfícies; aqui, a mesma **PERGUNTA** em duas listas. A página tinha **três** superfícies de decisão além da caixa: os cards de **lote**, os de **escolha** e os pares **1↔1**. As três morreram: **toda linha do banco mora na caixa**, e o caso dela renderiza **dentro do cartão ≍ da própria linha**.

**⚠️⚠️ E A MEDIÇÃO MUDOU O DESENHO ANTES DE EU ESCREVER A PRIMEIRA LINHA.** Os **14 cards** de *"pra tua mão"* têm a linha **FORA da caixa** — elas já estão **categorizadas** (`Matéria-Prima - Alimentos`), e `estacaoDaLinha` as manda pro ARQUIVO. ⭐ É a régua de 07/09 (***"ter categoria não quita conta nenhuma"***), e é **por isso** que aquela seção existia. **Colapsar sem carregá-las perderia R$ 2.120,81 · 2.275,05 · 3.510,78 … de trabalho real** — *duplicar é feio; sumir é perder trabalho*. Então a lista é **CAIXA ∪ CASO ABERTO**, e quem entra só pelo caso vem **marcado** (`soPeloCaso`): linha já classificada aparecendo do nada parece defeito.

**AS PEÇAS:**
- **`lista-unica.ts`** — a régua PURA: quem entra, os filtros, os contadores. ⛔ Régua dentro de rota é régua que ninguém prova.
- **`cards-de-escolha.ts`** — a orquestração (~150 linhas, queries pesadas) **saiu da rota**: o caixa precisa dos MESMOS cards, e copiá-la seria a **segunda derivação** que custou os 7 detectores de par. A rota virou casca.
- **`comoPainel`** no lote e no card de escolha — ⛔ os dois desenham o próprio `ChassiDoCartao`; dentro do cartão da linha isso mostraria **a linha do banco duas vezes no mesmo cartão**. O motor deles é o mesmo (uma linha por vez, rodapé vivo, Conciliar preso à conta fechada).
- **Os contadores viraram FILTROS** da mesma lista (`passaNoFiltro`/`contadoresDaLista`) — ⭐ contador e lista **não têm COMO divergir**, que era a ordem do dono. ⚠️ A 2ª linha de um caso **não conta**: ela é ponteiro, não trabalho a mais.

**⛔⛔ E O GUARD PEGOU UM BUG QUE EU ACABEI DE CRIAR:** com o filtro `⭐ prontos` ligado e zero prontos, `visiveis.length === 0` e a caixa dizia ***"tudo resolvido"* com 35 linhas esperando**. ***Ausência de resultado NESTE recorte não é ausência de trabalho*** — a família do *"Tudo conciliado ✓ em cima de 16 pagamentos"* (10/09). O vazio de festa só sai com `filtro === 'TUDO'`; o do filtro **diz quantas linhas a lista ainda tem** e oferece o *"ver tudo →"*.

**PROVADO EM PROD, pelas rotas reais:**
```
UMA LISTA: 49 linhas · filtros {tudo 49 · prontos 1 · mão 14} · Σ 15 ≤ 49 ✓
  ⭐ entraram SÓ pelo caso (já categorizadas): 14  ← eram os 14 cards
  casos por família: ESCOLHA 14 · LOTE 1
  MARIA LUIZA R$ 2.886,37 → é UMA LINHA da lista, caso LOTE, 6 notas no painel
  CASPER → 5 linhas NA LISTA (todas soPeloCaso), antes só existiam nos cards
celular 200 · desktop 200 · bundre −8 KB (as seções saíram)
```
**REGRA 11 — 6 furos repostos, 6 vermelhos.** ⚠️ **O mais caro veio VERDE na 1ª versão:** o guard da lista larga fazia `toContain('linhasDaLista(')` e a **menção** sobreviveu à reposição — *"menção, não uso"*. Apertado pro filtro velho ter MORRIDO e a resposta sair de `paraTela`. ⚠️ **E a própria sonda da REGRA 11 nasceu quebrada:** `$G` sem aspas **não faz word-splitting em zsh**, então os 6 rodaram contra zero arquivo e "passaram". *Sonda errada dá um verde tão convincente quanto um vermelho.*

**⚠️ 4 GUARDS FICARAM VERMELHOS COM O CÓDIGO CERTO** (o alvo mudou de casa num refactor — a razão de existir da REGRA 3). **Reapontados, não afrouxados**, e **dois ficaram mais fortes**: o `card-nao-nasce-escondido` passou a exigir que o painel exista **E** que a linha dele **entre na lista**; o `um-modelo-so` passou a proibir o lote de voltar pra página.

**10.751 verdes · TS 0 · deploys 4/4 (`cBP8IOOmsVAWkUcsh2HR_` e `fRsGTCf3sYjG2lApQcxwp`) · Δ bundle −8 KB · mock v3 atualizado com os filtros e a marca "já classificada".**

### ⛔⛔⛔ TRÊS PROBLEMAS NUMERADOS (24-25/09) — o F3 sem tela, o palpite sem controle, e a régua de 07/09 virando estação

### ⭐ PROBLEMA 1 — o boleto do M. IVAN LUNARDI (R$ 326,50) ficou 10 dias com o F3 gritando e nenhuma tela mostrando

**A história, medida:** a nota **não tem duplicata no XML** (pix/dinheiro), o dono digitou o boleto do papel na conferência — o que criou a sugestão, com data, em **13/09 20:38** — e não marcou o envio. Ficou `SUGERIDA` para sempre. **Não falhou calado: nunca foi disparado.**

**⛔⛔ A CAUSA É UMA ASSIMETRIA QUE ESTAVA ESCRITA NO CÓDIGO.** A única fila desenhada filtrava `dVenc: null` — o domínio do **F5**. A parcela conferida **com data** e nunca enviada não aparecia em tela nenhuma. ⚠️ A fila do F5 ganhou tela em 13/09 com esta lição no topo do arquivo — *"e-mail noturno não é lugar de dívida vencendo — o dono lê TELA (a lição dos R$ 21.968,02 de 30/08)"* — **e o F3 ficou de fora**. É o episódio de 30/08 se repetindo exatamente onde o comentário avisava. ***Alarme sem porta é a porta sem maçaneta, do lado do alarme.***

**⭐ A mesma fila responde os dois** (a pergunta é uma: *o que falta ir pro financeiro?*), com os trabalhos **separados** porque os gestos diferem: sem data → *"combine e defina"*; com data → **um clique** *"mandar pro contas a pagar"*, pelo MESMO `POST` que a conferência usa.

⚠️ **E O NOME MUDOU COM A PERGUNTA:** `parcelasSemData` → **`parcelasNaoEnviadas`**. Um nome que diz *"sem data"* sobre uma lista que traz as COM data é o *"nenhum rótulo promete mais do que entrega"* de 13/09. ⭐ E o filtro das já-enviadas saiu do **CLIENTE** pra a fonte — régua repetida por chamador é como duas listas divergem.

**A FAMÍLIA: exatamente 1 caso.** Não há vazamento sistêmico. **3 asserções invertidas com o motivo escrito** — as três afirmavam o vão, e uma **contradizia o próprio título** (*"sai da lista"* conferindo que estava nela).

### ⭐ PROBLEMA 2 — o palpite com diferença não deixava nomear o juro

O servidor só fecha com a diferença **nomeada** (`podeFechar: nomeada`), então o ✓ Confirmar exigia uma resposta que a tela **não oferecia**. É a régua de 23/09 no segundo caso: ***toda exigência aponta pra um controle QUE ABRE.***

**⚠️ A família são CINCO palpites travados, não um:** BORTOLAZZO 2,00 · TOZZO 6,40 · LAMANA 35,12 · LATICINIOS 70,58 · DALMOLIN 72,00 = **R$ 186,10** de juros esperando.

**O controle:** motivos em botão — **juros de atraso · multa · tarifa do boleto · desconto concedido · outro** —, o botão **trava sem resposta e DIZ o que falta**, e a resposta **chega no gesto** (coletar e não enviar foi o bug de 12/09; o guard olha o corpo do gesto). A régua da tela é a **mesma função** do servidor.

**⛔⛔ E UM DEFEITO APARECEU NO CAMINHO: o rastro era CRAVADO** em *"= juros/tarifa de boleto"* — então um **DESCONTO**, que é o oposto, ficava gravado como juros no histórico da conta. ***Número no rastro com o nome errado é pior que número sem nome*** — e é o contador que lê isso em três meses. ⛔ A régua **não afrouxou**: acima do teto do gesto (10% da linha) continua recusando.

### ⭐⭐⭐ PROBLEMA 3 — O MAPA, e o caminho 1: a régua de 07/09 virou ESTAÇÃO

**⚠️⚠️ A PREMISSA DA PERGUNTA CAIU NA MEDIÇÃO — as 2 linhas nunca sumiram.** Elas existem, estão **conciliadas** e no **arquivo com selo**. O dono não as achou porque **buscou o valor da NOTA e o extrato traz o valor PAGO**:
```
procurou R$ 2.079,98 (NF 967122 p003)  →  o extrato tem R$ 2.107,42  (R$ 27,44 de juros)
procurou R$ 3.476,37 (NF 968530 p002)  →  o extrato tem R$ 3.510,78  (R$ 34,41 de juros)
```
E os valores nominais que EXISTEM com aquela data são `origin: ESTOQUE_NF` — as **parcelas** da ponte, não linhas de extrato. **O import da Stone cobre 21/09 com folga** (8 imports, o último de 23/09, 25 linhas naquele dia): zero buraco de período.

**⭐ O INVARIANTE DA ESTAÇÃO FECHA:** `358 linhas ≥ o corte = CAIXA 10 + ARQUIVO 348`, e **0 no arquivo sem selo**. O teto de 400 **não morde**. Nenhuma linha está em lugar nenhum.

**⛔⛔ MAS O MAPA ACHOU O DEFEITO DE VERDADE, e é grande: o selo `categorizada` resolvia coisas que não foram resolvidas.** São 68 saídas (R$ 93.893,78) arquivadas assim, e separando por natureza:
- **legítimas (R$ 77.692,77)** — salário, retirada de sócio, juros do banco, tarifa: **não existe boleto pra casar**;
- **⛔ 18 de FORNECEDOR que emite nota (R$ 16.201,01)** — DOCEOLI 5.234,88, **as duas do CASPER de 04/09**, DIVINE, CEREALISTA, E-CAIXAS, frete. ***Dinheiro que saiu, não baixou conta a pagar nenhuma, fora da caixa e sem ninguém cobrando.***

⚠️⚠️ **E O COMENTÁRIO DA LEI DA ESTAÇÃO DEFENDIA ISSO**, com estas palavras: *"ter categoria conta como resolvida AQUI, e isso NÃO contradiz a régua de 07/09 — lá a pergunta era «esta linha ainda pode pagar um boleto?»; aqui é «esta linha ainda pede decisão minha?», e não pede"*. ⭐ **O argumento vale pro salário e pra retirada de sócio; não vale pro fornecedor** — ali a linha ainda pede uma decisão, e a decisão é *qual nota ela pagou*.

**A RÉGUA (decisão do dono, `categoria-nao-quita.ts`):**
- **por GRUPO DO DRE, lista FECHADA** — *"a régua de quem decide, não palpite por nome"*. Nome de categoria é texto livre que cada cliente escreve como quer; `dreGroup` é escolha estrutural.
- **grupo novo cai no lado que EXIGE vínculo** — o erro seguro; o inseguro é pagamento de fornecedor sumindo em silêncio.
- **categoria sem `dreGroup` não resolve** — é a lição do `?? 'CAIXA'` que sumiu com o CASPER em 20/09: ***default que resolve é default que esconde.***
- **⭐ a saída honesta existe:** *"é despesa avulsa — não tem nota"* arquiva com selo **PRÓPRIO** (`avulsa confirmada`), com **autor e data**. ⛔ Reusar *"categorizada"* misturaria *"o dono disse que não tem nota"* com *"ninguém olhou ainda"* — **a mistura que escondeu os R$ 16.201,01**. Compra pré-sistema é caso legítimo: *decisão, nunca silêncio*.

**⭐⭐ A AUDITORIA DA CAIXA (item 2 do dono):** o mapa mediu **0 eventos** pelo id das linhas conciliadas — *"dá pra ver o estado, mas não quem o produziu"*, e o dono ficou sem saber se tinha sido ele às 00:27. Agora todo gesto grava evento com o id da **LINHA**, num **choke-point** envolvendo o `switch`: são **11 ações**, e dentro de cada ramo o próximo gesto nasceria sem rastro (*"N caminhos, 1 esquecido"*). **Fail-soft:** rastro que derruba o gesto seria pior que rastro nenhum.

**📋 ITEM 3 — AS 12 `RECEIVABLE` DE JUNHO (investigado, NÃO corrigido, por ordem do dono):**
```
12 linhas · sicredi · R$ 732,49 · criadas no MESMO import (14/06 01:05) · data 15/06 — o DIA SEGUINTE
lifecycle RECEIVABLE/RECONCILED · dueDate 15/06 · dedupHash sim · categoria sim · vínculo nenhum
⛔ 2 têm gêmea EFFECTED (duplicata pendente): R$ 128,99
⚠️ 10 sem gêmea — entrada que nunca virou caixa: R$ 603,50
⭐ e a porta JÁ FECHOU: 0 linhas nesse estado depois de 09/08 (o descarte-de-futuro)
```
⭐ **A causa:** o import de 14/06 trouxe as **movimentações FUTURAS** que o Sicredi lista, e naquela época o `partitionFutureLines` **não existia** (entrou 09/08). Ele marcou-as `RECEIVABLE` — honesto pro que sabia —, e elas **nunca transicionaram pra EFFECTED** quando o dia chegou. Junho é pré-corte e pré-marco; fica **documentado**, e a porta está fechada.

**PROVADO EM PROD, nos DOIS viewports (REGRA 12):**
```
A CAIXA: 10 → 26 linhas · ⭐ as 18 voltaram com o aviso: R$ 16.201,01 ao centavo
   DIVINE 933,39 ✓ · CASPER 04/09: 2.275,05 e 2.120,81 ✓ · DOCEOLI 5.234,88 ✓
   cada uma com "categorizada, mas sem vínculo — casa com a nota ou confirma que não tem"
   e o gesto "é despesa avulsa — não tem nota" oferecido em TODAS
celular 242ms · desktop 176ms · a tela lê o campo ✓ · faixa âmbar (#fdf3e0) ✓
```
**REGRA 11 — 6 becos repostos no P3, 6 vermelhos** · 5 no P2 · 3 no P1. ⚠️ **E uma asserção minha era TAUTOLOGIA:** ela comparava `selo()` com a própria constante `SELO_AVULSA_CONFIRMADA` — trocar a constante mudava os dois lados e passava verde. Apertada pro **literal**, mais a afirmação de que ele é **diferente** de `'categorizada'`. ⚠️ 3 testes ajustados com o motivo escrito (afirmavam a lei antiga) e 1 guard dos chips atualizado (a SAÍDA ganhou o 7º gesto).

**10.837 verdes · TS 0 · migration ADITIVA PURA (CREATE TABLE nova, zero ALTER) · `pg_dump pre-categoria-nao-quita-20260924-234428.dump` (7,3 MB) · deploys 4/4 (`18pCYfkSZO467dVVZOA60`, `jUv1fLnsiRo_3QeRlqmVn`, `wVN_n_bK-E7axLSARpY7d`).**

⚠️ **FLAKE VIGIADO, NÃO ROTULADO:** `ponte/renegociacao` ficou vermelho **1× em 2 rodadas cheias** e **verde 3/3 sozinho** e junto do arquivo novo; o CNPJ dele (`41414141000141`) não colide e a asserção é escopada por empresa. **Não medi a causa** — fica vigiado (a régua de 01/09).

📋 **ACHADO À PARTE, NÃO TOCADO:** o juiz tem **26 F2** (ERRO) — amarras do estoque apontando contas que não existem mais, ~R$ 7,9 mil. É a consequência conhecida da faxina de 13/09 (as 26 contas apagadas). Decisão do dono: restaurar pela lixeira ou limpar as amarras órfãs.

### 💳 PALPITE É ATALHO, NUNCA MURO — A PORTA DO CARTÃO REGISTRADO (25/09)

**O dono, na linha do Mercado Pago (PIX 2.900,34, palpite = fatura 2026-09):** *"quando o MELHOR PALPITE é fatura, o botão «💳 pagamento de fatura ▾» SOME da fileira «OU ESCOLHA OUTRO CAMINHO» — se o palpite apontar o cartão/competência ERRADA, não tenho como escolher outro cartão registrado."*

**⛔ A CAUSA ERA UMA LINHA:** `l.acoes.filter((a) => a.acao !== l.palpite?.acao)` — a fileira escondia **justamente o gesto que o palpite usou**. ⭐ A régua que fica é a dele: ***palpite presente não esconde caminho — palpite é atalho, não muro.***

**⭐⭐ E O MENU LISTAVA SÓ O NOME DO CARTÃO.** Escolher *"mercado pago"* não dizia QUAL competência baixava — e o servidor precisa das duas coisas. Era o **gesto pela metade** que o menu do empréstimo já tinha resolvido em 18/09 (*"pedir contrato num toque e parcela noutro"*). Agora cada cartão é uma seção e cada fatura um item, com **mês · valor · vencimento · já paga**, e o **id composto (`cartão|competência`)** mantém **um** toque.

⛔ **O "já paga" sai do VÍNCULO, nunca de status gravado** — a régua de 20/09 (*a flag diz "parece", o vínculo diz "é"*), e é o que impede o menu de afirmar uma quitação que não houve. ⚠️ **Cartão SEM fatura importada continua na lista, marcado:** o dono pode estar quitando uma competência que ele ainda vai importar, e sumir com o cartão seria a lista mentindo sobre o que existe.

**⭐ O PALPITE DE FATURA GANHOU O `[não é essa — escolher outro cartão/fatura →]`** — o irmão do que a conta a pagar ganhou em 23/09 —, abrindo **o MESMO menu**: uma pergunta, um lugar. E o **retrato da fatura passou a dizer o VENCIMENTO junto do valor** (*"fatura 2026-09 · R$ 2.900,34 · vence 20/09"*), fechando o *"nomeado, não feito"* de 23/09. ⚠️ O `dueDay` entrou no `select` — **sem ele o vencimento sumiria do retrato sem nada quebrar**, a doença do PIX de 7.000.

**⚠️⚠️ E EU CRIEI UMA SEGUNDA DERIVAÇÃO NO MEIO DO PRÓPRIO SPRINT:** montei as seções do menu **duas vezes** (no chip e na porta de troca). Duas derivações da mesma pergunta divergem no primeiro campo novo — bastaria alguém acrescentar o *"já paga"* num lado só. Viraram `secoesDeFatura`/`alvoDaFatura` na lib, com o guard contando os usos.

**⚠️⚠️ DOIS GUARDS REPONTADOS DE DISTÂNCIA PRA ESTRUTURA — a 5ª ocorrência da classe, e um deles escondia um defeito grave.** Os detectores usavam **janela de caracteres** (`pedeAlvo === 'X'[\s\S]{0,700}<MenuDoChip`). ⛔ **O do CATEGORIA estava verde pelo motivo errado: aquele ramo NÃO desenha menu nenhum desde 20/09** (o chip dispara com o seletor da esquerda) — a janela alcançava o `<MenuDoChip` do ramo **VIZINHO**. Medido: com a janela, **arrancar a categoria do gesto** (`onGesto(l, a.acao)` sem `comCategoria()` — a linha sairia da caixa **sem classificação**) passava **38/38 VERDE**; com o detector estrutural, 4 vermelhos. ⭐ O guard passou a **fatiar o RAMO** daquele `pedeAlvo` e perguntar pelo desenho DENTRO dele.

**⚠️ E O GUARD DA REGRA 12 CONTAVA — por isso quebrou COM A TELA CERTA, duas vezes** (20/09 e hoje, quando o botão de troca virou o 4º menu). ***Guard que conta cresce junto com a tela e cobra por cada controle novo: ele mede o tamanho, não a doença.*** A doença é **duas composições** (um bloco de chips por viewport), e ela tem forma própria: `l.acoes.map` mais de uma vez, ou um par `sm:hidden` × `hidden sm:` desenhando chip. É isso que ele afirma agora.

**PROVADO EM PROD, nas rotas reais, nos DOIS viewports (REGRA 12):**
```
PAGE /conciliacao  celular 200 em 114ms · desktop 200 em 55ms · bundle 1.093 KB
⭐ a linha com palpite de fatura tem os 7 CAMINHOS, o de fatura ENTRE ELES:
   «CASPER DISTRIBUIDORA…» R$ 2.275,05
   palpite: fatura 2026-07 · R$ 2.275,05 · vence 13/07      ⭐ o vencimento no retrato
   fileira: casar com conta a pagar · pagamento de fatura · parcela de empréstimo ·
            transferência enviada · é despesa: categoria · é despesa avulsa · ignorar
⛔ o filtro do palpite no bundle servido: AUSENTE ✓

O MENU (a régua única, 4 cartões):
   💳 Carter banrisul  fatura 2026-09 — R$ 8.626,98 · vence 15/09 · já paga
   💳 banco caixa      fatura 2026-09 — R$ 5.106,99 · vence 12/09
   💳 mercado pago     fatura 2026-09 — R$ 2.900,34 · vence 20/09 · já paga
   💳 sicredi          fatura 2026-09 — R$ 2.365,85 · vence 13/09 · já paga
```
⭐ **A linha que motivou o sprint já foi conciliada pelo dono** (`paidInvoiceMonth: 2026-09`, a fatura consta paga) — o mecanismo ficou provado na que restou.

**REGRA 11 — 7 becos repostos, e UM veio VERDE:** o filtro de volta (**2 vermelhos**) · o menu sem vencimento (**2**) · o `dueDay` fora do select (**1**) · o retrato sem vencimento (**1**) · as seções remontadas à mão (**1**) · a janela de distância no detector (**4**) · ⛔ **o palpite perdendo o "não é essa" passou VERDE**, porque eu troquei o gate por `{false && (` e **a frase continua no arquivo** — *"menção, não uso"* de novo (o `moldura ? 'O BANCO DIZ' : null` de 20/09, o `hrefSemPagamento`, o `IgnoradosDoCardapio`). Apertado pro **GATE que renderiza**: o último `&& (` antes do controle tem que ser o do palpite de fatura.

**10.849 verdes · TS 0 · deploy 4/4 (`6I3wGwgOMwHNkN6F_8fwz`, SHA `4883d264`) · Δ bundle +0 KB.**

**⛔⛔ ACHADO GRAVE NO CAMINHO — NÃO É REGRESSÃO DESTE SPRINT E NÃO FOI CORRIGIDO (decisão do dono):** a tolerância do `mesQueBateOValor` é **2% do valor** (`Math.max(0.02, amount * 0.02)`), e numa linha de R$ 5.210,78 isso são **R$ 104,22 de folga**. Resultado medido em prod: **17 dos 18 palpites de fatura apontam pagamento de FORNECEDOR**.
```
R$ 5.210,78 «FRIGORIFICO SILVA…»  → banco caixa 2026-09 (net 5.106,99 · dif R$ 103,79)
R$ 2.017,05 «CARTORIO DO REGISTRO…» → mercado pago 2026-07 (net 1.978,14 · dif  38,91)
R$ 1.940,59 «LATICINIOS SANTO CRISTO» → mercado pago 2026-07 (net 1.978,14 · dif  37,55)
R$ 4.337,52 «LIQUIDACAO DE PARCELA-C61021346» → banco caixa 2026-06 (dif R$ 8,43)
⭐ com tolerância EXATA (R$ 0,02): 20 palpites → 2, e os 2 são pagamento de fatura de verdade
```
⚠️ É a classe do **guard do falso-amigo** de 11/09 (*"quase-exato SEM nome compatível NUNCA sugere; diferença de centavos não compra identidade"*), que vale igual aqui — **pagamento de fatura é valor EXATO**; a folga de 2% nasceu pro `pickInvoiceMonthByValue`, onde o dono **JÁ disse** que a linha é daquele cartão e um juro cabe. **Aqui a pergunta é outra** (*"este pagamento é de ALGUM cartão?"*), e ali a folga é veneno — o mesmo raciocínio que o próprio arquivo já escreve sobre o fallback. **O mapa está medido e o conserto é de uma linha; a decisão é do dono.**

### ⛔⛔⛔ O PALPITE DE FATURA EXIGIA "PERTO"; AGORA EXIGE O VALOR (25/09) — a folga de 2% era veneno

**Ordem do dono, depois do mapa medido:** *"APERTA — o matcher que PROPÕE «é pagamento de fatura» passa a exigir match exato; a tolerância de 2% fica só pra DEPOIS que eu já escolhi o cartão (juros/encargos da fatura confirmada, e nomeados como a régua de ontem manda)."*

**O TAMANHO DO BURACO, medido em prod:** 2% de um débito de R$ 5.210,78 são **R$ 104,22 de folga** — e com ela **17 dos 18 palpites de fatura da Caçula apontavam pagamento de FORNECEDOR**.

**⛔⛔ E O ESTRAGO IA ALÉM DO PALPITE ERRADO — o candidato MATAVA o palpite certo.** Ele se declara `diferenca: 0` com confiança **ALTA** (o comentário dizia *"só devolve o mês cujo NET BATE"* — e a folga de 2% fazia disso uma **afirmação falsa**). No ranking, que ordena por confiança e depois por `|diferença|`, ele **ganhava** da conta a pagar certa (que carrega a diferença REAL) **ou empatava com ela em ALTA → empate técnico → nenhum palpite**. *A linha ficava sem palpite nenhum por causa de um candidato inventado.*

**⭐ É A CLASSE DO FALSO-AMIGO (11/09):** *"quase-exato SEM nome compatível NUNCA sugere; diferença de centavos não compra identidade"*. Lá havia nome pra desempatar; **aqui o único sinal é o valor** — então ele tem que ser **o valor**.

**⚠️⚠️ E AS DUAS RÉGUAS DEIXARAM DE SER A MESMA FUNÇÃO — o que parecia REGRA 4 era o oposto.** De 16/09 até hoje `tolerânciaDaFatura` servia os dois leitores, com o comentário *"uma régua, dois leitores"*. ⛔ **As PERGUNTAS são diferentes, então a mesma folga significa coisas diferentes em cada uma:** `pickInvoiceMonthByValue` responde *"o dono JÁ disse que é deste cartão — qual competência?"* (e ali 2% é certo: o que sobra é juros/encargo, que a régua de 24/09 manda **nomear**); `mesQueBateOValor` responde *"este pagamento é de ALGUM cartão?"*, e ali a folga é veneno. Agora são `folgaDepoisDeEscolherOCartao` e o `CENTAVO` (0,02 — *não é folga, é ruído de arredondamento*, o mesmo degrau `FECHA` de 24/09).

⭐ **Pagamento de fatura COM juros continua resolvível** — pelo **gesto**: o dono escolhe cartão e competência no menu novo, e aí vale a folga de depois.

**PROVADO EM PROD, pelas rotas reais — as linhas trocaram de palpite sozinhas:**
```
                                       ANTES (folga 2%)              AGORA (exato)
FRIGORIFICO SILVA    R$ 5.210,78   fatura banco caixa (dif 103,79) → ⭐ CASAR_PAGAR (o nome bate)
LATICINIOS S. CRISTO R$ 1.940,59   fatura mercado pago (dif 37,55) → ⭐ CASAR_PAGAR · VALOR EXATO
LIQUIDACAO PARCELA   R$ 4.337,52   fatura banco caixa 2026-06      → ⭐ PARCELA_EMPRESTIMO · exato
PAGAMENTO CARTAO     R$ 8.626,98   fatura Carter banrisul ✓        → ✓ fatura (1 toque)
PIX MERCADO PAGO     R$ 2.900,34   fatura mercado pago ✓           → ✓ fatura (1 toque)

palpites de fatura: 18 → 2    ·    as liberadas viraram 26 CASAR_PAGAR + 3 PARCELA_EMPRESTIMO
a CAIXA (14 linhas): 0 palpite de fatura · 3 CASAR_PAGAR
```
⚠️ **CARTÓRIO (2.017,05) e CASPER (2.275,05) ficaram SEM palpite** — e é o desfecho honesto: não há conta em aberto que case, e o sistema **não inventa** um destino pra preencher a lacuna.

**REGRA 11 — 3 becos repostos:** a folga de 2% de volta no palpite (**20 vermelhos**) · uma folga *"pequenininha"* de 0,5%, a porta dos fundos (**8**) · as duas réguas voltando a ser uma só (**2**). ⭐ O guard trava os **16 falsos com os valores REAIS**, inclusive o menor deles (R$ 3,49 de diferença, 0,15% — *é o teste que impede o "então põe uma tolerância pequenininha"*).

**10.873 verdes · TS 0 · deploy 4/4 (`TXAzPch9ZcfToqQ_sh2yU`) · Δ bundle +0 KB.**

⚠️ **FLAKE VIGIADO, NÃO ROTULADO:** uma rodada da suíte deu **1 vermelho** e **não reproduzi em 4 rodadas seguintes**; não capturei o arquivo e **não medi a causa**, então não chamo de pré-existente (a régua de 01/09).

### ⛔⛔⛔ DATA DISTANTE PERGUNTA, NÃO RECUSA — o caso da LAMANA (25/09)

**O dono:** *"paguei com atraso (venc 15/09, pago 21/09) e a conciliação recusa: «Datas distantes — 6 dias. Máximo 5». SEM PORTA — mas é a conta certa, só foi paga atrasada."* ⭐ A régua que fica: ***"a régua de datas existe pra evitar casamento ERRADO, não pra proibir atraso VERDADEIRO"***.

**⭐⭐ É A MESMA FAMÍLIA DO JUROS (24/09), e por isso a anatomia é idêntica:** o sinal que recusava passa a **PERGUNTAR**, a resposta viaja **no gesto** (nunca num estado de tela que ninguém envia — o bug de 12/09) e fica **no rastro**. `regua-da-data.ts` é a irmã de `regua-da-diferenca.ts`, e **a TELA e o SERVIDOR chamam a mesma função**.

**OS TRÊS DEGRAUS:** ≤ 5 dias **PASSA** direto · 6 a 45 **PERGUNTA** (com as duas datas à vista) · acima de 45 **RECUSA nomeando a saída**. ⛔ E confirmar **não** abre a porta acima de 45 — senão o teto não existe.

**⛔ NÃO É UM `force`:** o `distanciaAceita` tem que **bater com os dias reais**, igual ao `diferencaAceita` de 07/09. *Bater exato é o que separa "vi os 6 dias e aceito" de "ignora a trava"*.

**⭐ O CAMINHO MANUAL FOI CONFERIDO, NÃO PROMETIDO** (item 2 do dono — *"senão o beco só mudou de sala"*): o Find & Match aceita `windowDays: 'all'` **e** a gravação de lá usa `allowMultiReconcile`, que **pula esta pré-validação inteira**. Os dois travados em teste.

**⭐⭐ O CASO COMBINADO — atrasou E pagou juros, um confirmar só.** As duas perguntas no mesmo card, o botão espera **as duas** respostas, e o aviso do que falta **diz as duas** quando faltam as duas. ⭐ E o rastro é **UM texto com N pedaços**, nunca dois brigando pelo mesmo campo: *meia história é o contador voltando a perguntar*.

**⚠️ ADIANTAMENTO NÃO É CHAMADO DE ATRASO** — a caixa da Caçula tem várias linhas *"pago N dias antes"*, e perguntar *"foi pago com atraso?"* ali seria o sistema errando o nome do fato na cara de quem sabe a verdade.

**⚠️⚠️ E O RASTRO GANHOU DONO PRÓPRIO — porque enterrado ele não era testável.** `montarRastro` saiu do `reconcile.ts` (uma função de 300 linhas que só roda com banco): lá ele **só podia ser conferido por MENÇÃO**, e a REGRA 11 provou o custo disso — **arranquei o rastro do atraso e o guard ficou VERDE**. Extraído, ele é EXECUTADO no teste, com os números reais da LAMANA.

### ⛔⛔ E A PROVA EM PROD ACHOU UM ERRO DE UM DIA — nas MINHAS contas

O card diria **"7 dias"** onde o dono conta **6**. As horas das duas datas **não são a mesma convenção**:
```
linha do extrato : 2026-09-21T12:00:00Z   (meio-dia — a convenção das transações)
dueDate da conta : 2026-09-15T00:00:00Z   (data de calendário pura)
diferença crua   : 6,5 dias  →  Math.round = 7     ⛔ o dono conta 6
```
⛔ ***Número que o dono SABE que está errado destrói a confiança na tela inteira*** — e o rastro mentiria pro contador. Minha premissa (*"as datas do módulo são carimbadas ao meio-dia"*) valia pras TRANSAÇÕES, não pro `dueDate`.

**⚠️ E o erro não era só de texto: a régua VELHA sofria do mesmo problema.** `days > 5` sobre a diferença crua fazia **5 dias de calendário com meia diferença de horas** virarem 6 → **recusa sem porta**. *Parte da queixa do dono nascia daqui, não do teto.* Agora a contagem é de **DIA DE CALENDÁRIO** — a mesma que a pessoa faz no dedo.

**PROVADO EM PROD, pelas rotas reais:**
```
⭐ LAMANA  linha R$ 918,46 (21/09) × conta R$ 883,34 (venceu 15/09)   — O CASO COMBINADO
   DATA  [PERGUNTA] "esta conta venceu 15/09 e o pagamento é de 21/09 — 6 dias depois.
                     Foi pago com atraso?"
   VALOR [PERGUNTA] "a diferença de R$ 35,12 é juros/multa de atraso — confirmar"
   confirmando → podeFechar TRUE, e UM rastro com os dois pedaços:
   "…de 2026-09-21 (R$ 918.46) · diferença de R$ 35.12 = juros de atraso, confirmada por
    quem conciliou · 6 dias de atraso, confirmado por quem conciliou"

⭐ MOINHO DO NORDESTE (22/09 × vence 29/09) → "6 dias ANTES. Foi pago adiantado?"
   rastro: "6 dias de adiantamento" — nunca "atraso"
⭐ 62 dias → RECUSA · podeFechar false mesmo confirmando
   "…acima dos 45 que o atalho alcança. Se é esta conta mesmo, use o «procurar outra» e
    busque sem janela de data."
```

**REGRA 11 — 7 becos repostos, e DOIS vieram VERDES:** a recusa sem porta de volta (**1 vermelho**) · virar `force` (**1**) · a resposta não chegando no gesto (**2**) · a rota deixando de declarar o campo, o zod recortando em silêncio (**1**) · contar horas em vez de calendário (**2**) · ⛔ **o botão deixando de esperar a resposta** veio VERDE — a string `!difRespondida || !dataRespondida` também existe no **AVISO** logo abaixo (*"menção, não uso"*; apertado pro `disabled=` do próprio botão) · ⛔ **o rastro do atraso sumindo** veio VERDE — só era conferido por menção (virou `montarRastro`, executado).

**⚠️ 3 GUARDS DE 24/09 REAPONTADOS, nenhum afrouxado:** a montagem do rastro **mudou de arquivo** (é a razão de existir da REGRA 3 — *grep não distingue "refatorei" de "quebrei"*), e o do botão ficou **mais forte** (ele agora trava por duas razões, e o guard exige as duas).

**10.897 verdes · TS 0 · deploys 4/4 (`WYAS2-BjS05mZT_GUmFHz` e `zwHKyshQHJ0ovUK-ZREb_`) · Δ bundle +4 KB.**

### ⭐ O FLAKE VIGIADO DESDE 24/09 FECHOU — e a causa não era a que eu carregava

O `ponte/renegociacao` ficava vermelho ~1 vez a cada 5 rodadas cheias. Eu suspeitava de **colisão de dado** (a classe do CNPJ compartilhado, 13/09). **Medido: `Test timed out in 5000ms`** — e **sozinho ele leva 958 ms**. Era **contenção** de CPU/banco com os outros 838 arquivos em paralelo.

⭐ **A cura é da CLASSE, não da instância:** o teto de 5 s do vitest é pra teste **puro**, e a suíte tem **98 arquivos de integração** contra banco real — qualquer um deles pode estourar; o `renegociacao` só era o mais perto do limite. `testTimeout: 20_000`, com o motivo escrito. ⛔ **Nenhuma asserção mudou** — o que muda é parar de chamar de falha o que é fila. ***Alarme falso repetido é como um alarme morre***, e suíte que fica vermelha sozinha ensina a ignorar o vermelho. **3 rodadas cheias verdes seguidas.**

### ⭐⭐⭐ INVESTIMENTOS — O ESPELHO DO EMPRÉSTIMO, DO LADO DO ATIVO (25/09)

**Decisão do dono:** *"CAPITALIZACAO RG e PAGAMENTO CONSORCIO não são despesa nem conta a pagar — são APORTES recorrentes que constroem patrimônio. O espelho do empréstimo: lá a parcela reduz dívida, aqui aumenta ativo."*

**⭐⭐ A MEDIÇÃO MUDOU O ESCOPO ANTES DE EU ESCREVER UMA LINHA — o item 3 já estava atendido.** As linhas **já vinham** categorizadas como `Investimentos`, e `INVESTIMENTOS` **já era um dreGroup NÃO-DRE**. Provado por **contrafactual**, não por inspeção: o DRE de setembro é **idêntico ao centavo** com e sem os R$ 2.214,23, e eles aparecem em `nonDreGroups`. *O que faltava era o CONTRATO, o GESTO e uma linha na lista fechada.*

**1. OS CONTRATOS** (`InvestmentContract` + `InvestmentContribution`, migration **aditiva pura**: 2 CREATE, zero ALTER em tabela com dado). ⭐ O **total aportado é DERIVADO** dos vínculos, nunca gravado — *campo gravado envelhece*, foi assim que a `CreditCardInvoice.status` ficou eternamente OPEN. ⚠️ E o que o dono **declarou** ter pago antes do sistema fica **separado** do que o sistema **viu**: misturar faria a tela afirmar um histórico que ninguém conferiu. ⛔ `transactionId @unique`: a mesma linha virar dois aportes é **impossível**, não checado. ⚠️ Sem total conhecido, "restantes" é **`null`** — 0 se leria como *"acabou"*.

**2. O GESTO 📈** na fileira de caminhos, com menu de **contrato · valor da parcela · quanto já aportei** (listar só o nome repetiria o defeito do menu de cartão que a manhã de hoje consertou). **O palpite exige VALOR EXATO + sinal de NOME**, e ⛔ **empate devolve `null`** — a Caçula tem **dois** títulos de R$ 297,84 debitados no mesmo dia (medido: externalId 590236 e 590237), e escolher um poria o dinheiro no contrato errado. ⚠️ O **dia** é o 3º sinal e decide a **confiança**, nunca exclui: o consórcio dela caiu dia 9, 10 e 11 em meses diferentes.

**4. `INVESTIMENTOS` ENTROU NA LISTA FECHADA** — era por isso que o CONSÓRCIO de R$ 1.478,51 estava entre as 18 com o aviso, cobrando um boleto que o consórcio **nunca emite**.

### ⛔⛔⛔ E O ITEM 4 CRIOU A PORTA SEM MAÇANETA — a 11ª volta, pela minha mão

Com a lista fechada certa, a categoria passou a resolver sozinha e **os aportes saíram da caixa**: medido em prod, **14 → 4 linhas**, e o gesto 📈 ficou **inalcançável**.

⭐ **A cura é a régua do CARTÃO (20/09), palavra por palavra:** ***a flag diz "parece", o vínculo diz "é"***. Categoria `Investimentos` sem contrato vinculado é *"parece aporte"*; **com** o vínculo sai com o selo que nomeia onde o dinheiro entrou. ⚠️ **E a diferença que importa:** ela fica na caixa esperando o **CONTRATO**, nunca a NOTA.

**⛔ E O AVISO AINDA COBRAVA A COISA ERRADA** — as 5 linhas voltaram dizendo *"casa com a nota ou confirma que não tem"*. É a lição de 16/09 (*"mensagem que acusa o campo errado faz o dono caçar um erro que não existe"*) **na frase que eu acabei de pôr na tela**. A régua do aviso saiu de **inline na rota** pra função pura (*regra que mora numa rota é regra que ninguém prova*) e virou **por caso**: aporte pede contrato, fornecedor pede nota, salário não pede nada.

### ⛔⛔⛔ DOIS GESTOS NASCERAM QUEBRADOS EM PROD — e só a prova NAVEGANDO pegou

O `z.enum` da rota `/resolver` repetia a lista de ações **à mão**, e quem acrescentava gesto na lib não sabia disso. Medido **com controle**:
```
AVULSA_CONFIRMADA   (25/09) → 400 "Gesto inválido"          ⛔ NUNCA funcionou
APORTE_INVESTIMENTO (25/09) → 400 "Gesto inválido"          ⛔ idem
IGNORAR (no enum)           → 422 "linha não encontrada"    ⭐ chega na lib
```
⚠️⚠️ **Ou seja: o *"é despesa avulsa — não tem nota"* de ontem nunca funcionou** — o dono clicaria e levaria *"Gesto inválido"*. **E os testes não pegavam porque chamam `resolverLinha` DIRETO, por cima do zod** — *"testar a lib não prova o encaixe da rota"* (23/09), a **3ª ocorrência** desta classe. ⭐ Agora o enum **DERIVA** de `TODAS_AS_ACOES`: gesto fora do schema é **impossível** (REGRA 5).

### ⛔⛔ E O `@@map` QUE FALTAVA — um defeito que SÓ APARECE EM PROD

A migration criava `investment_contracts` (snake_case, como todo o schema) e os modelos não declaravam `@@map`, então o Prisma procurava `public.InvestmentContract`. ⚠️ **O dev não pega por construção:** `db push` cria a tabela com o nome do **modelo**; o SQL da migration só roda em **prod**. ***É a mesma classe do `contains` case-sensitive (08/09): funciona em dev e falha calado em prod.***

⭐ **Guard novo fecha a classe** (`modelo-e-tabela-batem.test.ts`): todo modelo aponta pra uma tabela que alguma migration cria. Medido no repo inteiro — **157 modelos, 0 divergências** —, então nasce **sem allowlist**.

**PROVADO EM PROD, pelas rotas reais, nos DOIS viewports (REGRA 12):**
```
PAGE /investimentos  celular 200 em 246ms · desktop 200 em 46ms
⭐ os 5 aportes VOLTARAM pra caixa, cada um com o 📈 na fileira e o aviso CERTO:
   "falta dizer em qual contrato este dinheiro entrou — escolha no 📈 aporte em investimento"
   R$ 1.478,51 «PAGAMENTO CONSORCIO» → palpite: valor exato · cai por volta do dia 9 · o
                                        nome bate com «Consórcio Banrisul» · parcela 2026-09
   R$ 70,02 ×2 «CAPITALIZACAO RG»    → palpite aceso
   R$ 297,84 ×2                      → ⭐ SEM palpite (dois títulos iguais: "não sei qual é")

O GESTO (endpoint real) → HTTP 200
   {"efeito":"aporte de R$ 1.478,51 no Consórcio Banrisul (2026-09) — já aportado: R$ 1.478,51"}
   a caixa: 5 → 4 aportes · o contrato: R$ 1.478,51 em 1 · último 2026-09
   RASTRO na linha: "aporte no Consórcio Banrisul, parcela de set/2026"

ITEM 3 (contrafactual): despesas operacionais R$ 117.504,57 COM e SEM os aportes ·
   lucro líquido R$ 43.748,82 nos dois · TOTAIS IDÊNTICOS ⭐
   nonDreGroups: INVESTIMENTOS R$ 2.214,23 em 5 transações
```

**REGRA 11 — 7 becos repostos, 7 vermelhos** (a lista fechada · valor parecido · escolher no empate · dispensar o nome · o gesto fora da fileira · a rota sem o campo · o enum digitado à mão). ⭐ **E o TypeScript achou os 3 `switch` que precisavam conhecer o gesto novo** — a REGRA 4 de graça, em vez de grep; o campo `temAporteVinculado` entrou **obrigatório** e o compilador achou a leitura e o teste que faltavam.

**⚠️ E DOIS GUARDS DA CASA PEGARAM DEFEITOS MEUS:** o `return` antes do fetch **sem tocar no estado** (spinner eterno, a classe de 20/09) e o **CNPJ de teste colidindo** — duas vezes, porque eu chutei em vez de conferir; na terceira eu **listei os 157 CNPJs do repo** antes de escolher.

**10.942 verdes · TS 0 · `pg_dump pre-investimentos-20260925-173714.dump` (6,9 MB) · deploys 4/4 (`WWsY-5dIh9Idlyc426UhT`, `SVyVlqS33O3MHpOxgVSI0`, `saybyQJHg5WGpAaZ9wnKI`, `s79_QVYGEisIdjvnZ7bS3`, `KnRsnSxvaEXHjAQyWsZqd`) · Δ bundle +8 KB.**

⚠️ **OS 3 CONTRATOS EM PROD SÃO MEUS, PRA PROVAR O CICLO — os nomes são do dono.** Criei *"Consórcio Banrisul"*, *"Consórcio Banco Caixa"* e *"Capitalização RG 70"* a partir do que o DADO mostrou (valor + dia + conta). **Ele renomeia, acrescenta o 2º título de cada capitalização e informa o total de parcelas.** Apagar é 1 clique enquanto não houver aporte; com aporte, o caminho é **encerrar** (a régua do *"sumir com o item"*, 09/09).

### 📋 ACHADO À PARTE, MEDIDO E NÃO CORRIGIDO — R$ 595,68 de duplicata em julho

Ao mapear os aportes, a contagem por **externalId** (a identidade que o BANCO dá) achou:
```
externalId 590236 → 2 linhas · 01/07 E 02/07 · R$ 297,84 (imports de 01/07 19:20 e 02/07 19:49)
externalId 590237 → 2 linhas · 01/07 E 02/07 · R$ 297,84
```
⭐ **É EXATAMENTE a mania do Banrisul de re-datar linha já publicada**, a mesma classe que o *Tier 1.5* (`fronteira-de-dia.ts`) passou a barrar em **05/09** — e nela o exemplo documentado é a própria `CAPITALIZACAO RG`. A trava vale **dali pra frente**; **as de julho ficaram**. ⚠️ **Cirurgia de dado é decisão do dono** — o mapa está medido e o estorno é pelo caminho de sempre.

⚠️⚠️ **E QUASE REPORTEI UMA DUPLICATA FALSA ANTES DESSA:** a minha sonda rotulava *"FITIDs distintos"* enquanto media `contentHash` (igual por construção, porque data+valor+descrição são iguais). Os pares do MESMO dia têm `externalId` **diferentes** — são dois títulos de verdade. ***Rótulo de sonda que mente produz achado falso tão convincente quanto um real.***

### ⛔⛔⛔ REUNITIZAR O ITEM NUNCA É EFEITO COLATERAL DO RECEBIMENTO (24/09)

**O dono, na nota do ALAN:** *"item da nota «SAL CISNE REFINADO 1KG · 10 UN · R$ 4,79», destino «sal» (controlado em KG). O preview propõe «o item passa a ser controlado em UN» + converter 41 movimentos e 18 fichas + «saldo −0,9 KG → −12,76 UN» (número sem sentido)."*

**⭐⭐ SÃO DUAS PERGUNTAS DIFERENTES, e *"a unidade difere"* não as separa:**
- **a nota veio noutra unidade** (`uCom` ≠ régua do item) → isso é o **FATOR**, e converte **SÓ A ENTRADA**: *1 UN da nota = 1 KG* → entram 10 KG a R$ 4,79/KG, o item continua em KG e as 18 fichas ficam intactas. **É o caso comum, o de todo dia.**
- **o dono CORRIGIU a unidade de entrada** → aí ele está dizendo *"a régua do ITEM está errada"*, e é o caso do QUEIJO (11/09), em que reunitizar é o certo.

A condição da tela era `unidadeEntrada ?? uCom`, que **colapsava as duas** e disparava a proposta de reunitização **toda vez que a nota vinha noutra unidade**. ***Gesto raro e global não pode nascer de um gesto diário.***

**⭐⭐ E A GRAVAÇÃO SEMPRE ESTEVE CERTA** — o `confirmarConferencia` só reunitiza com `aval.corrigida`. **Quem mentia era o PREVIEW**, que é o pior lugar possível pra mentir: é onde o dono decide. É a família *"preview e confirm discordando"* de cabeça pra baixo — a tela prometendo um estrago que a gravação não faria.

**⚠️ E AS DUAS CONDIÇÕES CONCORDAVAM POR ACASO.** Eu conferi os três casos e batiam; **é exatamente assim que a divergência nasce no quarto**. A tela passou a chamar **a mesma função pura do servidor** (`avaliarUnidadeDeEntrada`) — REGRA 4.

### ⛔⛔ O −12,76 INVESTIGADO: ERAM DUAS RÉGUAS DE SALDO NO MESMO CARD

Medido: **−12,76 é a soma CRUA dos 41 movimentos do sal**, incluindo os **19 `PRODUCAO_CONSUMO` (−11,86)** que o saldo **exclui** por serem transferência interna. O `antes` vinha do `saldoItem` (régua da prateleira) e o `depois` somava o plano cru — então, **com fator 1, ou seja SEM MUDAR NADA**, o card anunciava *"−0,9 KG → −12,76 UN"*.

⭐ O `movePrateleira` é o dono único dessa pergunta desde 09/09, e era ele que faltava ali. O `UnidadeDoMovimento` passou a carregar o **`tipo`** — sem ele a régua não tinha como ser aplicada. **Provado em prod: fator 1 agora dá `13,29 → 13,29`.**

### ⛔ E A PORTA DO NEGATIVO NÃO TINHA MAÇANETA DO OUTRO LADO

A recusa manda o dono pra ficha do item dizendo *"corrigir a entrada que faltou"* — e a ficha **não oferecia gesto nenhum**. É a **10ª volta** da família. Agora, com saldo negativo, ela mostra o botão *"lançar a entrada que faltou"* (borda + ícone + verbo — *ação sem afordância não existe no celular*, 30/08), pedindo a **quantidade e o valor VERDADEIROS** da compra que faltou; e a entrada manual **abre com o item já escolhido** (`?item=`), porque perder no caminho a informação que a tela acabou de mostrar é obrigar o dono a procurar de novo entre 159 itens.

**⭐⭐⭐ E O RED-THEN-GREEN ACONTECEU EM PROD PELA MÃO DELE, melhor que a minha simulação:**
```
24/09 13:51  ENTRADA_NF   10 KG · R$ 47,90   (a nota do ALAN: 10 UN × 4,79, fator 1)
24/09 13:53  ENTRADA_NF    5 KG · R$ 13,75   (a 2ª: SAL CBS 1KG, 5 UN × 2,75)
⭐ o item continua em KG · as 18 fichas continuam em KG · saldo −0,9 → 13,29 · R$ 61,43
⭐ o resíduo de −0,22 nem precisou de pergunta: a entrada trouxe valor de sobra (decisão OK)

o preview com fator 1: 13,29 → 13,29 ✓   (antes dizia −0,9 → −12,76)
a contagem depois: conto 2,5 kg → o FREIO PERGUNTA ("89% fora do sistema"), eu respondo
celular ficha 158ms · entrada 53ms    desktop 49ms · 48ms    4/4 frases nos dois
```
**REGRA 11 — 4 becos repostos, 4 vermelhos** (a tela colapsando as duas perguntas · o preview somando o plano cru · a ficha perdendo a maçaneta · a entrada manual ignorando o `?item=`).

⚠️ **Três sondas minhas erraram antes de eu medir:** chamei `previewReunitizar` com um objeto (a assinatura é posicional), inventei a forma do `Ctx` do `explodir`, e comparei `'R$ 4,79/KG'` com espaço comum quando o `Intl` usa **espaço não-quebrável**. **Parei de supor e li a assinatura** — é o que separa *"a sonda está errada"* de *"prod está quebrada"*.

**10.805 verdes · TS 0 · deploy 4/4 (`9CHm5M_5vyXbKmQPrMFTA`) · Δ bundle +4 KB.**

📋 **FICA PRO DONO:** a contagem do sal (o freio vai perguntar, é o desenho) e a **entrada manual retroativa** dos 3 que seguem negativos sem nota por vir — **ervilha −45,48 · arroz −11,5 · feijão −9,34** —, com a quantidade e o valor verdadeiros da compra que faltou. A porta está na ficha de cada um.

### ⛔⛔⛔ ITEM NEGATIVO TRAVAVA O FLUXO ALHEIO — 4 FRENTES (23/09)

**A régua do dono, e ela fecha as quatro:** ***"negativo ACONTECE na vida real; o sistema AVISA e oferece a porta (a compra/produção que falta), mas NUNCA bloqueia fluxo alheio."***

### ⭐⭐ 1. O RECEBIMENTO NÃO ACHAVA O SAL — e a hipótese caiu na medição

**O dono:** *"chegou nota do ALAN com SAL e o recebimento NÃO ACHA o item «sal» pra casar — só criando produto novo. Filtra saldo negativo?"*

**⚠️⚠️ NÃO FILTRA NADA DE SALDO.** Medido em prod, as causas eram **duas, nenhuma a suspeita**:
```
a rota mandava: findMany({ companyId, ativo: true }, take: 300, orderBy: nome asc)
ativos na empresa: 348  →  ⛔ TRUNCOU, e "sal" (minúsculo) cai no fim da ordem
```
**⭐⭐ E A RAIZ É O UNIVERSO QUE NUNCA FOI DECLARADO.** Esta rota nasceu antes da régua de 16/09 (*"cada gesto tem seu universo"*) e ficou de fora do contrato obrigatório. Sem ele a lista traz **189 invólucros de CARDÁPIO** (95 PRODUTO_FINAL + 50 SABOR + 44 INTERMEDIARIO) que **ninguém compra**, e eles comem as vagas: o universo COMPRAVEL tem **159**, e o sal entra.

**⛔ É A TERCEIRA VEZ QUE UM TETO DE LEITURA ESCONDE O ITEM** — o `take: 50` que sumiu com o fermento (16/09), o `take: 200` que sumiu com a ordem do ano 202 (19/09), e agora o `take: 300` do recebimento. ⚠️ **E o modo teste escondia MAIS que a tela real** (`take: 200`): as duas rotas passaram pelo mesmo dono da pergunta.

**⛔⛔ SEGUNDO DEFEITO, ACHADO NO CAMINHO: a busca da conferência era uma SEGUNDA RÉGUA.** Ela fazia `nome.toLowerCase().includes(busca.toLowerCase())` em vez da `casaBusca` da casa, e **diverge no acento**: medido, digitar **`"feijão"`** (como o dono escreve) achava **ZERO** onde a régua da casa acha **2** (`FEIJAO PRETO…`, como a NOTA escreve). É literalmente o bug de 09/09 sobrevivendo nesta tela.

**⭐ E O NEGATIVO APARECE COM AVISO NA LINHA DELE** — *"saldo −0,9 KG, saiu mais do que entrou · esta nota conserta"* —, porque ele é quem **mais** precisa daquela tela. O vazio também passou a dizer o recorte (*"nada com «x» entre os 159 itens que se COMPRAM"*).

**⭐ E A CONFERÊNCIA QUE ELE PEDIU: NÃO NASCEU SAL DUPLICADO.** Existe **1 item** chamado exatamente `sal`, criado em 08/09. Nada a mesclar.

### ⭐⭐ 2. A ENTRADA QUE CRUZA O ZERO LIMPA O RESÍDUO — a régua IRMÃ

`avaliarResiduo` (19/09) responde *"a BAIXA pode levar o resíduo junto?"* e só diz sim **quando a quantidade vai a ZERO**. `avaliarEntrada` responde a oposta: *"a ENTRADA pode limpar o que ficou pendurado?"* — e diz sim **justamente porque a compra que faltava acabou de chegar**. Dentro do teto (o mesmo limite matemático, proporcional ao que saiu sem lastro) **absorve e registra**; acima, **PERGUNTA com a conta na tela**, nunca beco.

**⛔⛔ E O RESÍDUO NÃO ENTRA NO CUSTO DA NOTA.** A baixa absorve somando no `custoTotal` do próprio movimento; aqui isso seria errado **duas vezes**: quebraria o **CHECK do ledger** (`|custoTotal − qtd×custoUnit| ≤ 0,01`) **e o E16** (`Σ(ENTRADA_NF da nota) == Σ(vProd)`) — o documento assinado pela SEFAZ passaria a *valer* 22 centavos a mais. ***A nota é FATO e não se reescreve.*** O ajuste é linha própria (`AJUSTE_RESIDUO`), pelo idioma do `encerrar-item` (0,001 e unitário **derivado** do total).

**⛔⛔⛔ E A FRONTEIRA VEIO DE UM TESTE VERMELHO, NÃO DE UM RACIOCÍNIO MEU.** A 1ª versão valia pra **qualquer** movimento que cruzasse o zero — e **engoliu a porta do negativo** (22/09): a CONTAGEM sobre item negativo passou a perguntar sobre centavos em vez de dizer *"vendeu sem ter produção registrada — contar por cima ENTERRA o lote que ninguém lançou"*. ⭐ A régua do dono é ***"a ENTRADA é o conserto"***: `ENTRADA_NF` · `ENTRADA_MANUAL` · `PRODUCAO_GERACAO` (a própria porta que a recusa oferece) · `DEVOLUCAO_PRODUCAO`. **`AJUSTE_CONTAGEM` fica FORA — contar por cima não é o conserto, é o enterro.**

### ⭐⭐ 3. A FICHA NÃO QUEBRA POR COMPONENTE NEGATIVO

**⚠️ A causa de fundo:** `custoMedio` é `valor/saldo` e **não existe com saldo ≤ 0** — então um item negativo entra na receita **sem custo** e a ficha inteira caía pra *"a definir"*. **O conserto não é inventar custo: é mostrar o parcial e nomear o que falta.**

- **`dá pra fazer` nunca é negativo.** Era `Math.floor(saldo/qtd)` cru: com a ERVILHA em **−45,48** a tela dizia ***"dá pra fazer −4.548"***. Falta é **ZERO**; o que muda é a frase — *"limitado por ERVILHA — em falta"*.
- **o custo mostra o PARCIAL** (*"R$ 10,35 + falta ERVILHA"*). O `custoUnitario` segue `null` (margem inventada é pior que margem ausente), e a **margem parcial vai marcada como TETO** (*"até X% · teto — falta custo de componente"*): o que falta só pode **derrubar**.
- **a linha do componente explica o PORQUÊ** — *"saldo −45,48 — saiu mais do que entrou, por isso sem custo médio"*, em vez de um *"sem custo"* que mandaria o dono esperar uma nota que já chegou.

⚠️ **Um número do pedido saiu diferente, medido:** ele escreveu *"R$ 8,58 + ervilha"*; o parcial real do XIS COMPLETO é **R$ 10,35**. Repetir o número dele seria inventar.

### ⭐ 4. A VARREDURA (mapa executável, `negativo-nao-trava-fluxo-alheio.test.ts`)

| fluxo | com item negativo |
|---|---|
| **recebimento** | ⭐ **AVISA** — aparece na lista com o saldo e *"esta nota conserta"* |
| **entrada (nota/manual/produção)** | ⭐ **AVISA e PERGUNTA** — absorve dentro do teto, pergunta acima |
| **ficha / cardápio** | ⭐ **AVISA** — custo parcial, margem-teto, *"limitado por X — em falta"* |
| **contagem** | ⭐ **PORTA de 22/09** (intacta) — *"vendeu sem produção registrada"* + o link |
| **baixa de venda** | ⚠️ **passa** — saldo negativo é o sinal *"vendeu sem produzir"*, e barrar esconderia o aviso |
| **produção** | ⭐ *"produzir agora"* na linha do componente em falta |

**PROVADO EM PROD, pelo caminho da tela, nos DOIS viewports (REGRA 12):**
```
1. a lista do recebimento: 159 itens · ⛔ invólucros de cardápio: 0
   "sal" → 3 · 1 NEGATIVO com aviso (sal −0,9)      "feijão" → 1 (com acento!)
   "ervilha" → 2 · 1 NEGATIVO (−45,48)              "xis pao" → 1 (ordem livre)
   ⭐ o sal que ele citou: ✓ NA LISTA     ⭐ itens chamados "sal": 1 (nada a mesclar)

2. as 4 entradas que cruzam o zero → PERGUNTA (resíduo acima do teto), com a conta na tela
   sal −0,22/teto 0,05 · arroz −32,77/0,06 · feijão −12,47/0,05 · ervilha −3,26/0,23

3. XIS COMPLETO: custo fechado "a definir" · ⭐ PARCIAL R$ 10,35 · falta ERVILHA
   ⭐ dá pra fazer 0 (limitado por ERVILHA — em falta) · ⛔ rendeAte negativo: NÃO

celular recebimento 113ms · cardápio 57ms · produto 64ms   desktop 78/45/48ms · 6/6 frases
```
**REGRA 11 — 7 becos repostos, 7 vermelhos** (sem universo · filtrando por saldo · busca virando 2ª régua · entrada recusada · rendeAte cru · custo parcial sumindo · contagem tratada como entrada).

⚠️ **E A SONDA DA REGRA 11 NASCEU QUEBRADA DE NOVO — `$G` sem aspas NÃO faz word-splitting em zsh** (a cicatriz de 23/09, no mesmo mês): os 7 rodaram contra zero arquivo e "passaram" com saída vazia. Refeita com array. ⚠️ Outras duas sondas minhas erraram antes: `saldosDaEmpresa` tem o campo **`saldo`**, não `quantidade` (eu media `undefined < 0`, sempre falso, e quase reportei *"zero negativos"*), e inventei a forma do `Ctx` do `explodir` em vez de ler. **Parei de supor e li a assinatura** — é a 4ª vez que isso aparece no doc.

**10.791 verdes · TS 0 · deploy 4/4 (`rHzyJW80XykbSm943faoo`) · Δ bundle +4 KB.**

📋 **FICA PRO DONO (o clique é dele):** conferir a nota do ALAN pela tela — o `sal` agora aparece na busca com o aviso, e o confirmar vai **perguntar** sobre os R$ 0,22 antes de gravar. As outras 3 (arroz, feijão, ervilha) seguem negativas até a nota delas chegar.

### ⛔⛔⛔ O LOTE EXIGIA CATEGORIA E NÃO HAVIA ONDE RESPONDER — O BECO (23/09)

**O dono:** *"o cartão exige categoria («Vincular 6 · diga a categoria primeiro — ela grava nas 6») mas NÃO EXISTE onde responder: o seletor esquerdo mostra «⚙ categoria vem do gesto» e NÃO ABRE nada. As duas metades se contradizem — a esquerda diz «não é comigo», o botão diz «é com você»."*

**⛔⛔ ERAM DOIS DEFEITOS SOMADOS, OS DOIS MEUS, dos dois sprints anteriores:**
1. **`estadoDoSeletor` lia a ação do PALPITE da linha** — e o palpite da MARIA LUIZA é **pagamento de fatura**, que é ESTRUTURAL. Daí o ⚙. **Mas lote é CASAR, e casar HERDA da conta**; com as 6 sem categoria, o caso é o **herda-pedindo** (o mesmo da TOZZO).
2. **o `SeletorDoLote` que eu construí ontem vivia no `abaixoDoValor` do chassi — e o modo painel NÃO desenha chassi.** Ou seja: ele existia no arquivo e **não era renderizado em lugar nenhum**.

**⭐ FIX NA RÉGUA, NÃO COM REMENDO** (ordem do dono): `estadoDoSeletorDoLote(notasSemCategoria, total)` — **PEDE** quando falta (com o número do que FALTA, não do total: *"2 de 6 notas sem categoria"*) · **HERDA** quando todas têm (*"herda das contas"*, honesto) · e carrega **`gravaEm`**, que é o que faz a tela dizer *"a resposta grava nas 6 contas"*. A escolha vai pela **porta única** (`resolverLinha` com `categoryId`), que já grava em CADA conta desde 20/09.

**⛔ E O LOTE VIROU PAINEL-ONLY.** O ramo do card inteiro (com chassi próprio) ficou **sem chamador** quando a seção morreu em *"uma lista só"* — e **código sem chamador é o que alguém religa por descuido**. Ele não tem mais um `if` a checar: **ele não sabe desenhar chassi**. Desenhar ali mostraria a linha do banco **duas vezes no mesmo cartão**.

**⭐⭐ A REGRA DE PÁGINA (a REGRA 11 do beco, palavras do dono):** ***botão exigindo resposta + nenhum lugar pra responder = vermelho — toda exigência aponta pra um controle QUE ABRE.*** O guard afirma que o único ramo que renderiza controle é o `PEDE`, que a tela escolhe a régua pelo **CASO** (não pelo palpite), e que a resposta da esquerda **chega no Vincular**.

**⚠️⚠️ E A PROVA EM PROD ACHOU UM SEGUNDO BECO, MENOR, QUE EU TINHA DEIXADO:** o botão dizia *"diga a categoria primeiro — ela grava nas 6"* e **parava ali** — cobrava a resposta **sem dizer onde responder**. Meia-porta. Agora: ***"escolha a categoria na esquerda ← · ela grava nas 6 contas"***. *Exigência que não aponta é a mesma doença, um degrau menor.*

**⛔ REGRESSÃO MINHA CORRIGIDA JUNTO:** com as seções mortas, o **deep-link `?abrir=`/`?conta=`** continuava sendo lido e alimentava um bloco que **não existe mais** — a linha apontada não entrava em lugar nenhum. É a ***porta pintada na parede*** (13/09) de volta, por dentro. A rota da caixa passou a aceitar `abrir`/`conta` e repassar pro `cardsDeEscolha`; a tela forwarda por um `deepLink()`.

**PROVADO EM PROD, pelo caminho da tela, nos DOIS viewports (REGRA 12):**
```
A LISTA 49 linhas · filtros {tudo 49 · prontos 1 · mão 14}
⭐ MARIA LUIZA R$ 2.886,37 · 6 notas · SEM categoria 6
   SELETOR DA ESQUERDA: PEDE · "as 6 notas sem categoria — escolha" · gravaEm=6 · ABRE ✓
⛔ vincular SEM categoria → HTTP 422 · PEDE_CATEGORIA · nada gravado

E o resto da lista, cada um na sua régua:
   TOZZO / BORTOLAZZO / LAMANA / NESTLÉ …  PEDE       "a conta casada não tem categoria"
   TOZZO / CENTERMIX                       HERDA      "herda da conta: Matéria-Prima - Alimentos"
   PIX_DEB / CARTÓRIO                      ESTRUTURAL "categoria vem do gesto"   ⭐ o ⚙ só onde é
celular 200 em 594ms · desktop 200 em 201ms · 1.089 KB · as 4 frases nos dois
```
**REGRA 11 — 6 becos repostos, 6 vermelhos** (lote voltando a ler o palpite · a resposta não chegando no Vincular · a régua devolvendo ESTRUTURAL · o deep-link sumindo da rota · o seletor morto voltando pro chassi · a exigência sem apontar).

**⚠️ 2 GUARDS REAPONTADOS, os dois MAIS FORTES:** o `comoPainel` do lote virou ***"ele não pode conter `ChassiDoCartao`"*** (antes era *"tem que ter o `if`"*) e o `um-modelo-so` tirou o lote da lista de decisores **afirmando quem hospeda** — a régua não mudou (*nenhuma decisão fora do chassi ≍*), mudou **quem desenha**.

**10.756 verdes · TS 0 · deploys 4/4 (`m11SvNjxI8Tx1ddzSdJWp` e `L7_lA5h1b1WDoH6zX93-O`) · Δ bundle −8 KB.**

### ⛔⛔ E O DEPLOY DECLAROU 4/4 VERDE COM O CÓDIGO ANTIGO (23/09) — o gate prova SAÚDE, não NOVIDADE

**Eu rodei `bash scripts/deploy.sh` direto e ele respondeu `✓ DEPLOY OK` com BUILD_ID novo.** Prod continuou no commit **anterior ao meu**. Só apareceu porque a prova em prod estourou `estadoDoSeletorDoLote is not a function` — e eu quase rotulei de sonda errada.

**A CAUSA:** o **`deploy.sh` NÃO FAZ `git pull`** — ele builda o que está na árvore de trabalho. O pull é passo do runbook, feito na mão antes. Eu pulei. **E a armadilha documentada agrava:** o swap-postgres deixa `prisma/schema.prisma` e `migration_lock.toml` **modificados**, então o `git pull` seguinte **aborta calado** — é preciso `git checkout --` nos dois antes.

**⚠️ E O GATE NÃO TINHA COMO PEGAR, honestamente:** ele mede BUILD_ID novo, pm2 estável, CSS servindo e banco respondendo — e **um rebuild do código velho passa nos quatro**. ***Gate de saúde não é gate de versão.*** É a mesma família do incidente de 28/08 (*"o gate provava presença, não saúde"*), um degrau acima: **agora prova saúde, e não prova qual código**.

📋 **DÍVIDA REGISTRADA (não construída):** o `deploy.sh` devia **imprimir o SHA que buildou × `origin/main`** e avisar quando estiverem diferentes — ou fazer o pull ele mesmo, com o `git checkout --` do swap embutido (a REGRA 5: *disciplina vira impossibilidade*). Enquanto não for, **a sequência é `git checkout -- prisma/schema.prisma prisma/migrations/migration_lock.toml && git pull && bash scripts/deploy.sh`**, e conferir o `git log --oneline -1` do servidor depois.

### ⛔⛔⛔ O LOTE FURAVA O "NADA SAI SEM CATEGORIA" — E O PALPITE PEDIA ASSINATURA NO ESCURO (23/09)

**Quatro itens do dono, e o segundo tinha risco de dado.**

**⛔⛔ O FURO (item 2).** As 6 notas da MARIA LUIZA (R$ 2.886,37) estão **todas sem categoria**, e o *"Vincular 6"* deixaria passar. **A causa é estrutural:** o card do lote postava em **`/find-and-match/reconcile`** — uma rota **PRÓPRIA**, **fora** do `resolverLinha`, que é onde o `PEDE_CATEGORIA` mora desde 20/09. Conciliadas por ali, as 6 sairiam da caixa **sem classificação nenhuma** e a despesa não entraria em DRE nenhum. ***"N caminhos, 1 esquecido"*** — agora na regra que existe justamente pra isso não acontecer.

**⭐ A cura é a PORTA ÚNICA**, não um segundo check: o lote passou a postar no `/resolver`, e a regra vale **de graça, pro N inteiro**. ⭐ E a nota passou a carregar **`temCategoria`**, então a tela **PEDE ANTES do clique** — *fazer o dono clicar pra levar um não é trabalho que dava pra poupar* (a régua do seletor da caixa). **UMA pergunta pras N**, do lado esquerdo do chassi, e a resposta **grava em CADA conta** (aprende). ⛔ Por-nota diferente continua sendo *"Escolher na mão"*: oferecer N seletores aqui transformaria o card do lote no painel manual, e o lote existe pro caso *"todas iguais"*.

**⭐ ITEM 1 — o lote veste o chassi ≍** (`moldura={false}` + `painelColado`, como o N:M em 20/09). O **grid próprio morreu**: dois modelos convivendo é exatamente o que o guard proíbe.

**⭐⭐ ITEM 3 — O PALPITE MOSTRA A CONTA INTEIRA.** Ele mostrava **só o nome da empresa**; agora traz **valor · vencimento · NF/parcela**, **espelhando a coluna da esquerda** (a anatomia que os cards de CASO já usam; o 1↔1 é que tinha ficado pra trás). *"Eu confiro valor e data ANTES de confirmar, não depois."* ⚠️ Os dados saem da **MESMA conta que o matcher escolheu** — uma 2ª leitura poderia mostrar um valor e conciliar outro. ⛔ E o vencimento compara com o **dia do BRASIL**: em UTC, das 21h à meia-noite **toda conta que vence hoje apareceria como vencida** (a cicatriz do card do cartão, 09/09, e do Contas a Pagar, 13/09). O ano só aparece quando **não** é o corrente — *"venceu 22/09"* numa conta de 2025 se lê como deste mês.

**⭐ ITEM 4 — "NÃO É ESSA — ESCOLHER OUTRA"**, ao lado do ✓ Confirmar: abre o Find & Match **SEM a sugerida pré-marcada**. ⛔ Marcar a errada de novo é obrigar o dono a **desmarcar antes de escolher**, e desmarcar é o gesto que ninguém lembra de fazer. Sem ela, palpite errado só se resolvia **abandonando o palpite**. ⚠️ O botão só **ABRE** o painel — nenhuma porta de gravação nova.

**⚠️⚠️ E A PROVA EM PROD PEGOU UM BUG MEU QUE A SUÍTE NÃO PEGAVA:** o corpo do lote ia **sem `empresaId`**, que o schema da rota exige → **HTTP 400 "Gesto inválido"**, ou seja o botão simplesmente não funcionaria. Os 8 testes chamam o **`resolverLinha` direto** e passam por cima do zod. ***Testar a lib não prova o encaixe da rota*** — a mesma lição do mock que escondeu o contrato em 20/09. O guard passou a exigir os campos **dentro do corpo do fetch**.

**PROVADO EM PROD, pelas rotas reais:**
```
ITEM 3   TOZZO       linha R$ 1.081,44 → A CONTA R$ 1.081,44 · venc 23/09 · NF 25926 (parcela 001)
         BORTOLAZZO  linha R$   948,50 → A CONTA R$   946,50 · venc 23/09 · NF 618318
                                                   ⭐ R$ 2,00 de diferença, VISTA antes de confirmar
ITEM 2   vincular as 6 sem categoria → HTTP 422 · PEDE_CATEGORIA, nomeando a NF 69009352
         ⛔ conciliadas: 0 · com categoria: 0 — INTACTAS
celular 200 · desktop 200 · bundle com o retrato, o "não é essa", o "são da mesma?" e o aviso
```
**REGRA 11 — 7 furos repostos, 7 vermelhos** (rota própria de volta · Vincular liberando sem categoria · servidor parando de exigir · palpite só com o nome · palpite sem porta de troca · troca reabrindo com a sugerida marcada · lote fora do chassi). ⚠️ **E dois guards meus não morderam de primeira**, os dois por asserção não ancorada: o do `empresaId` casou com a **declaração da prop** (*"menção, não uso"*), e um guard de 20/09 ficou **vermelho com a tela CERTA** — ele afirmava o literal do `preSelecionados`, e a régua ganhou uma **exceção explícita**. **REAPONTADO, não afrouxado:** passou a exigir as duas metades (com palpite, marcado; na troca, vazio).

**10.727 verdes · TS 0 · deploys 4/4 (`E4XwEwat8mxvuUvdbbdv2` e `LeB6ed-mZ91q_umhaEG1W`) · Δ bundle +4 KB.**

📋 **NOMEADO, NÃO FEITO:** o palpite de **fatura de cartão** traz valor no `detalhe` (*"fatura 2026-09 · R$ 2.886,37"*) mas **não o vencimento** — é outra família, com outros campos, e o pedido era sobre a conta a pagar. Fica registrado em vez de eu estender por conta própria.

### ⛔⛔⛔ A "CALABRESA BLACK QUE SUMIU" — E O IGNORAR QUE NUNCA FUNCIONOU (23/09)

**O dono, urgente:** *"cliquei sem querer num botão e a CALABRESA BLACK sumiu da minha frente"*.

**⭐⭐ A MEDIÇÃO REFUTOU A HIPÓTESE — ela não foi ignorada nem desmapeada.** Os três estão no mapa de complementos, os três como `FICHA`, e `atualizadoEm == criadoEm` nos três: **nenhuma linha foi tocada depois de criada**.
```
CALABRESA BLACK FRIDAY  → ficha cmtkwy7pl…  criado 21/09 04:57:56   (= a ficha da CALABRESA COMUM)
FRANGO BLACK FRIDAY     → ficha cmuarysgk…  criado 21/09 04:58:34   (ficha PRÓPRIA)
MUSSARELA BLACK FRIDAY  → ficha cmuarzsha…  criado 21/09 04:59:21   (ficha PRÓPRIA)
```
**A tela agrupa por FICHA** (`chaveDeApresentacao`, 03/09), então a CALABRESA BLACK **não sumiu: ela foi absorvida pela linha "CALABRESA"**, que hoje mostra 4 apelidos — `CALABRESA | CALABRESA BLACK FRIDAY | calabresa | Calabresa`. Os outros dois têm linha própria porque ganharam ficha própria, 38 e 85 segundos depois.

**⛔⛔ E O ACHADO QUE VALE DINHEIRO É OUTRO: 172 ocorrências estão baixando a porção ERRADA.** A ficha comum consome `porcao de calabresa 120 grama`; existe um item `CALABRESA BLACK 120 GRAMAS` (INTERMEDIARIO, 248 un) criado justamente pra a promoção, **e ele não é consumido por ninguém**. ⚠️ **NÃO corrigido** — a receita é decisão do dono (*"o sistema não cria ficha de sabor nenhuma automaticamente"*, 14/09), e as duas que funcionam consomem coisas diferentes (FRANGO = frango + queijo black; MUSSARELA = só queijo black). Inventar o que a pizza leva seria decidir a receita por ele.

**⛔⛔⛔ E AO PROVAR O RED-THEN-GREEN, O ACHADO MAIOR: IGNORAR PRODUTO NUNCA FUNCIONOU EM PROD.** `POST /vendas/mapear` com `alvoTipo=IGNORAR` devolve **HTTP 500 de corpo vazio, toda vez, desde 14/09** — o CHECK de 22/08 (`chk_venda_map_alvo IN ('FICHA','REVENDA')`) recusa a linha. **Nove dias de feature morta**, e os *"0 IGNORAR no mapa de produtos"* que eu tinha medido de manhã não eram *"ninguém usou"*: eram ***"é impossível"***.

⚠️⚠️ **É A MESMA LIÇÃO QUE EU ESCREVI ANTEONTEM**, no radar: ***"CHECK com vocabulário fechado numa tabela de CONFIGURAÇÃO envelhece mal"***. Lá o prazo foi de **um dia**; aqui o CHECK é de agosto e a palavra nova chegou em setembro. E só apareceu porque a prova em prod **executou o gesto** em vez de conferir o código.

**⭐ A CURA NÃO FOI CLONAR O MAPA.** Renomear o model custaria **61 usos em 34 arquivos**, um deles a **baixa de venda** (mexe em estoque). E mais fundo: `alvoTipo` responde *"para onde baixa"*, e **ignorar não responde isso** — ignorar é ***ausência de destino + decisão tomada***, que é exatamente o que separa o IGNORADO do SEM_DESTINO. `stock_venda_ignorado` (CREATE-only, CHECK na FORMA, unique por nome): ignorar apaga o destino **e** grava a marca numa transação (meio gesto deixaria o nome indistinguível de quem nunca foi tocado); o [voltar] apaga as duas. ⭐ **Efeito colateral bom:** sem linha no mapa, a baixa **já não baixa** o ignorado — por construção, sem nenhum leitor novo precisar aprender a palavra.

**⭐⭐ E O IGNORADO VOLTOU A EXISTIR NO CARDÁPIO.** No `hubCardapio` ele caía num `else { continue }` e **desaparecia**: sem seção, sem contador, sem volta. Agora é seção **última e colapsada**, com **[voltar] por item**, e **some quando não há nenhum** (móvel fixo zerado treina o dono a não olhar). ⛔ Ele viaja **à parte** de `linhas`: misturá-lo o poria nas seções, no CSV e em todo contador — *decisão tomada não disputa espaço, nem número, com trabalho pendente*. ⭐ E o [voltar] **não escolhe destino**: devolve o nome pra fila como pergunta.

**⭐ E O GESTO PASSOU A PERGUNTAR** — *"tirar «X» do cardápio?"*, modal NOSSO (nunca `confirm()` nativo, que já falhou em silêncio no Safari em fluxo async, 22/08). **Leve de propósito**: ignorar é reversível, e cobrar cerimônia por um gesto que se desfaz num clique seria pesar a mão.

**PROVADO EM PROD, navegando pelas rotas reais (efeito líquido ZERO — ignorei e devolvi):**
```
ANTES     ignorados=0 · fila sem destino=111 · produtos=206
IGNORO    HTTP 200 → ignorados=1 · fila=110 · produtos=205
          🗂 seção: «Açaí 250ml» chave=ignorado:Açaí 250ml · 1 un · fora da fila
[VOLTAR]  HTTP 200 → ignorados=0 · fila=111 · produtos=206 · volta como SEM_DESTINO
celular 200 · desktop 200 · bundle com a seção, o "tirar … do cardápio?" e o voltar
```
**REGRA 11 — 6 defeitos repostos, 6 vermelhos.** ⚠️ **DOIS vieram VERDES na 1ª versão, os dois por asserção não ancorada:** `toContain('IgnoradosDoCardapio')` passou **com a seção arrancada do JSX**, porque a **definição** da função ainda tem o nome (*"menção, não uso"*, 7ª vez — o que morde é a TAG); e o `useState(false)` do colapsado casou com o **componente VIZINHO**, porque minha fatia ia até o fim do arquivo. ⚠️ E um terceiro guard mordeu **o próprio comentário** que proíbe `confirm()` nativo — passou a ler sem comentário.

**10.710 verdes · TS 0 · guard de isolamento 48 · `pg_dump pre-venda-ignorado-20260923-101151.dump` (6,7 MB) · deploys 4/4 (`jo9AgBzBqpDJvL3BW_dI_` e `116UNYBFuDoH144UoPiqc`) · Δ bundle +4 KB.**

⚠️ **DÍVIDA REGISTRADA:** a página do Cardápio declara `Status` e `Hub` **à mão** sobre o payload, então o `IGNORADO` precisou ser acrescentado nos dois lugares. É a dívida de 01/09 (*"interface escrita à mão sobre payload é promessa, não prova"*) cobrando juros — derivar de `StatusCardapio`/`HubCardapio` é o certo e fica pro sprint dela.

**✅ E A CALABRESA BLACK VOLTOU — receita confirmada pelo dono** (*calabresa black + queijo black*, o mesmo padrão do FRANGO). `pg_dump pre-ficha-calabresa-black-20260923-102654` antes; criada pela **porta real** (`criarFicha` com `mapearComplemento`, ficha e vínculo na MESMA transação — a trava que existe porque 3 fichas nasceram órfãs em 01/09 e a PIZZA saiu duplicada).
```
⭐ «CALABRESA BLACK FRIDAY»  172 ocorr · ficha cmue509vb…  ↳ 1× CALABRESA BLACK 120 GRAMAS + 1× QUEIJO Black Friday 200G
⭐ «FRANGO BLACK FRIDAY»      60 ocorr
⭐ «MUSSARELA BLACK FRIDAY»   42 ocorr
   e a «CALABRESA» comum voltou aos 3 apelidos dela (CALABRESA | calabresa | Calabresa)
```
⚠️ **O passado NÃO foi reescrito:** as 172 ocorrências já baixadas consumiram a porção comum, e o ledger é imutável. Da venda de hoje em diante a baixa é a certa; acertar o histórico seria reprocessar os dias — **decisão do dono**, não feita.

### ⛔⛔⛔ A RECUSA DO ITEM NEGATIVO MANDAVA CAÇAR UMA NOTA QUE NÃO EXISTE (22/09)

**O dono, contando a `PORÇAO CALABRESA 85g congelada`** (−8 UN · −R$ 135,20): *"a recusa diz só 'estoque negativo, não aceita' — sem explicar POR QUE nem O QUE FAZER."*

**⛔⛔ E A FRASE ESTAVA PIOR QUE VAGA: ela mandava registrar a COMPRA.** Ninguém **compra** porção de calabresa — ela se **produz**. A frase nasceu do **FERMENTO** (16/09), que é matéria-prima e onde o buraco era mesmo uma nota; cravada pra todo item negativo, passou a mandar o dono procurar um documento que não existe. ***É a lição de 16/09 — "mensagem que acusa o campo errado faz o dono caçar um erro que não existe" — cometida um degrau acima***, na mesma função que aquele dia consertou.

**⛔ A RÉGUA NÃO MUDOU** (ordem do dono: *"FIX na mensagem, não na régua"*). O guard de 11/09 recusa o mesmo estado impossível; o que mudou foi a **frase** e a **porta**.

**⭐⭐ O PORQUÊ É O QUE IMPORTA, e ele justifica a recusa:** item PRODUZIDO negativo significa **vendeu sem ter produção registrada** — e ***contar por cima ENTERRA o lote que ninguém lançou***: o ajuste entra, o saldo fecha, e a produção perdida some do Real vs Teórico pra sempre. A recusa existe exatamente pra impedir isso, então agora ela **diz** isso.

**⭐ A PORTA — três casos, nenhum beco** (`lib/stock/porta-do-negativo.ts`, pura):
| caso | porta |
|---|---|
| **ordem PARADA** do item | link **direto nela** — *"concluir a ordem aberta de 19/09"* |
| ficha ativa, sem ordem | `/producao?ficha=<id>`, com o formulário **já aberto e a ficha escolhida** |
| sem ordem nem ficha · ou item **COMPRADO** | a entrada/ajuste pelo histórico do item |

⚠️ **Sem o `?ficha=` a porta seria meia-porta:** o dono cairia num dropdown pra procurar de novo o que o sistema acabou de nomear — o defeito do Bamberg (13/09). A tela de produção passou a ler o parâmetro **no 1º render** (em `useEffect` ela piscaria fechada antes de abrir).

**⭐ OS FATOS SÃO RESOLVIDOS ONDE HÁ BANCO; A DECISÃO MORA NA FUNÇÃO PURA.** O guard consulta ordem/ficha e manda tudo no `culpado`; o tradutor só traduz em rótulo+href. Consultar o banco no tradutor faria a decisão da porta **nascer em dois lugares** — e as duas divergiriam no primeiro caso de borda.

**⚠️ A FAMÍLIA SAI DA CATEGORIA, NÃO DA EXISTÊNCIA DE FICHA:** item produzido cuja ficha foi **arquivada** continua produzido, e mandá-lo pra *"registrar a compra"* seria o bug de hoje por outro caminho. A lista de tipos produzidos tem **dono único** (`tipos-ficha.ts`) — reescrevê-la aqui faria o `SABOR` divergir entre dois arquivos.

**📋 A VARREDURA — são 8 negativos, e a frase errada valia pra 3:**
```
MATERIA_PRIMA (pedem NOTA)   ARROZ −9,5 kg · FEIJÃO −7,72 · ERVILHA −40,53 · sal −0,1 · PAO DE XIS −224
INTERMEDIARIO (pedem PRODUÇÃO)  PORÇAO CALABRESA 85g −8 UN · Porçao aneis de cebola −7 · porcao file xis −3
⭐ ordens de produção abertas hoje: ZERO
```
⚠️⚠️ **E ISSO CORRIGE DUAS PREMISSAS DO PEDIDO:** *"linka DIRETO nela (o caso de hoje: a ordem do P2)"* — **não há ordem aberta nenhuma** (a do ano 202 foi fechada), então **hoje todas caem na 2ª porta**; a 1ª está construída e travada em teste, mas não dispara com o dado atual. E o item é a **85g congelada**, não a *"calabresa ralada"*.

**PROVADO EM PROD, com os itens reais e `$transaction` de rollback forçado — 0 movimentos gravados:**
```
ARROZ [MATERIA_PRIMA]      422 · "…falta registrar a COMPRA que não foi lançada"
                           → [ver o histórico deste item e corrigir a entrada que faltou →]
CALABRESA 85g [INTERMED.]  422 · "…vendeu sem ter produção registrada. Contar por cima
                                  ENTERRA o lote que ninguém lançou — por isso a contagem espera."
                           → [registrar a produção que faltou →] /producao?ficha=cmtxfpxll…
celular e desktop: contagem 200 · a PORTA (/producao?ficha=) 200 · as 5 frases no bundle
```
**REGRA 11 — 5 defeitos repostos** (frase cravada **1** · porta vazia **4** · ordem não linkada **1** · `?ficha=` ignorado **1** · um dos 2 estados da tela sem o link **1**). **10.701 verdes · TS 0 · deploy 4/4 (`kXAmH7e2IB6Tfu1iYgB-K`) · Δ bundle +0 KB.**

⚠️ **TRÊS SONDAS MINHAS ERRARAM ANTES DE EU MEDIR** — assinatura invertida (`saldosDaEmpresa(db, id)`), `StockFicha` sem campo `nome`, `StockProductionOrder` sem `@relation` (o isolamento proíbe). **Parei de supor e li o schema.** *Sonda errada dá um vermelho tão convincente quanto um defeito real* — e aqui ela quase virou "a produção não tem ficha".

### ⭐⭐ RADAR v1.3 — A QUANTIDADE PRIMEIRO, O TOTAL POR SEÇÃO E A CASA DA REVENDA (21/09)

**⭐ 1. O VEREDITO DIZ QUANTIDADE, DEPOIS DINHEIRO** — decisão do dono: *"quantidade é o número MAIS importante"*. `faltou 1 un · R$ 3,31` · `faltou 0,5 kg · R$ 18,42`, na unidade do item. ⭐ **Uma função (`textoDoVeredito`), os TRÊS lugares** — pílula, chip do último veredito e conta de padeiro; uma segunda formatação faria o chip e a linha discordarem sobre o mesmo fato.

**⛔⛔ 2. O RODAPÉ DA SEÇÃO, E A LEI QUE ELE OBEDECE: UN E KG NUNCA SOMAM NUM NÚMERO SÓ.** A quantidade sai **por unidade** (`faltouPorUnidade: Record<string, number>`) e só o **dinheiro** soma tudo. ⛔ **Item "falta contar" fica FORA do total** (`continue`, nunca zero) e é **dito** no rodapé (*"29 ainda sem contagem (fora do total)"*) — zero afirmaria que bateu, que é a mentira que esta tela existe pra não contar. ⭐ `totalDaSecao` é **UMA função pros três blocos**: soma por seção escrita na tela seria a segunda régua, e ela divergiria do placar no primeiro caso de borda.

**⭐ 3. A SEÇÃO 🥤 REVENDA** entre os caros e as porções — *"os caros fica só matéria-prima, como o nome diz"*. As bebidas **migram na própria migration** (`INSERT...SELECT` com `categoria = 'REVENDA'` → lista REVENDA), CREATE-only.

**⛔⛔ E O CHECK DO BANCO VALIDA FORMA, NUNCA VOCABULÁRIO.** Ontem eu criei `stock_radar_watchlist` com `CHECK (lista IN ('CAROS','PORCOES'))`; hoje o dono pediu a 3ª lista e o CHECK **virou parede**, porque este módulo é CREATE-only e `ALTER` é proibido. A tabela nova valida `lista <> '' AND lista = upper(lista)`; **o vocabulário mora no TypeScript**, onde se acrescenta. ⭐ *CHECK com vocabulário fechado numa tabela de CONFIGURAÇÃO envelhece mal — e o prazo foi de um dia.*

**⭐ O UNIVERSO `REVENDA` NASCEU ESCRITO ITEM A ITEM** (`universo-do-seletor.ts`, o dono único). Eu tinha ligado a busca da seção em `PRATELEIRA`, que oferece **queijo e coxão na lista da bebida** — recriando exatamente a mistura que a seção nasceu pra desfazer. ⚠️ E **derivar de COMPRAVEL seria o erro de 16/09** (quando `RECEITA = [...COMPRAVEL, ...]` arrastou LIMPEZA e o editor ofereceu desengraxante como ingrediente). ⭐ O tipo do `universo` na tela passou a **DERIVAR** de `UniversoDoSeletor` em vez de enumerar à mão — a lista à mão envelheceu no primeiro universo novo, e o `tsc` cobrou.

**⚠️⚠️ REGRA 11 — 5 DEFEITOS REPOSTOS, E O DO TOTAL VEIO VERDE: "MENÇÃO, NÃO USO" PELA QUINTA VEZ.** O guard fazia `toContain('faltouPorUnidade: Record<string, number>')` e passou com o campo da interface trocado por um escalar — porque a MESMA frase existe na **variável local** que acumula o total, sessenta linhas abaixo. O que morde é ler **dentro do bloco da interface** (o contrato, não o rascunho), e proibir ali qualquer escalar de quantidade. ⚠️ **E o guard do CHECK mordia o COMENTÁRIO** que documenta o defeito removido: o SQL passou a ser lido **sem comentário**, como já se fazia com o motor. ***O arquivo que documenta o defeito não pode ser o que o absolve*** — agora em SQL.

**⛔ O FLAKE DO `isolamento-pf-pj` TINHA CAUSA MEDIDA, e é a TERCEIRA ocorrência da classe.** Ele ficou vermelho na suíte cheia e **verde 3/3 sozinho**; `fotoDaPJ()` fazia `prisma.transaction.count()` **sem `where`**, e a suíte roda arquivos em PARALELO contra o mesmo banco — outro teste criou 2 transações entre as duas fotos. É o `snapshotClosedModules` global de novo (23/08 e 24/08). **Escopado por empresa — e isso APERTA**: a pergunta virou exatamente *"o import PF mexeu em alguma coisa DESTA empresa?"*, que é a única coisa que aquele teste pode afirmar. ⚠️ Medido antes de rotular, a régua de 01/09.

**PROVADO EM PROD, pelo motor real e nos DOIS viewports (REGRA 12):**
```
🥤 REVENDA   COCA COLA 600ML   faltou 1 un · R$ 3,31   [sistema 109 un]
             └─ faltaram no total: 1 un · R$ 3,31
💰 OS CAROS  └─ nada faltou · 5 ainda sem contagem (fora do total)
🍳 PORÇÕES   └─ nada faltou · 29 ainda sem contagem (fora do total)
⛔ Σ(seções) R$ 3,31 == placar R$ 3,31 ✓   ·   Coca nos CAROS? ✓ não
busca da 🥤: 30 itens, TODOS REVENDA · FANTA UVA 2L entre eles ✓ · matéria-prima: 0
celular 200 · desktop 200 (37.478B idênticos) · bundle 24KB com as 3 seções e o rodapé
⛔ o veredito só-dinheiro ("faltou R$ …" sem quantidade): SUMIU ✓
```
⚠️ **E UM NÚMERO DO PEDIDO SAIU DIFERENTE, medido:** o dono escreveu *"faltou 2 un · R$ 3,31"*; o dado diz **1 un · R$ 3,31** (o custo é 3,31/un). Repetir o número dele seria inventar meia unidade — a disciplina de 29/08.

**10.690 verdes · TS 0 · `pg_dump pre-radar-v13-20260921-004058.dump` (6,6 MB) antes da migration · deploy 4/4 (`HuW6zzhh58s0dKk0I517r`).**

📋 **FICA PRO DONO (REGRA 2, o clique é dele):** adicionar a **FANTA UVA 2L** na 🥤 REVENDA pela tela — o universo já a oferece — e a recontagem do creme de leite, que segue pendente.

### 📋 O RASTRO DA RECONTAGEM DO CREME DE LEITE — ELA NÃO ESTÁ NO BANCO (21/09)

**O dono:** *"Recontei o creme de leite pela tela (o freio ofereceu o número certo e usei). Confere o rastro."*

**⛔ MEDIDO, E A RESPOSTA É DURA: não há recontagem.** O item tem **uma única** linha de contagem (14/09 14:51) e o saldo segue **16.600 UN · R$ 39.342,36** — **23% do estoque inteiro da empresa** (total R$ 167.944,20). ⚠️ E o fato que fecha a questão: **a última contagem de QUALQUER item foi 20/09 às 11:22**, e o botão *"usar 166"* só existe desde o deploy das **23:40**. ***Desde que o botão existe, ninguém contou nada*** — então não dá pra dizer nem que ele funcionou nem que falhou; o que dá pra dizer é que a recontagem não chegou ao banco.

| pergunta dele | resposta medida |
|---|---|
| **(a)** a posição zerou o fantasma? | **não** — 16.600 UN · R$ 39.342,36, intactos |
| **(b)** juiz limpo? | **nada mudou por causa do Radar nem da recontagem** (comparação dos relatórios abaixo) |
| **(c)** Δ de custo dos consumos? | **ZERO saídas na janela** — nenhum consumo levou custo desta janela. ⭐ E o custo médio **não foi distorcido**: R$ 2,37 antes e depois, porque o `AJUSTE_CONTAGEM` entrou com o custo médio vigente. **O que está errado é a QUANTIDADE (e o valor total), nunca o custo unitário** — então nenhuma receita saiu com preço torto. |

**⭐ O JUIZ, COMPARADO EM VEZ DE ROTULADO** (a régua: *"pré-existente só depois de medir"*):
```
19/09 03:53  E15=7 E7=82 F2=26        P2=1 P3=24 P5=1 P6=84 V1=77   143 issues
20/09 03:00  E15=7 E7=85 F2=26        P1=1 P3=24 P5=1 P6=84 V1=79   143 issues
21/09 00:00  E15=7 E7=86 F2=26 F3=1   P1=1 P3=24 P5=1 P6=84 V1=90   143 issues
```
⭐ **O P1 já existia em 20/09 — ANTES do Radar subir** (18:55). O que cresceu foi E7 (82→86, itens com saldo nunca contados), V1 (77→90, vendas sem destino) e o F3 novo — **crescimento da operação, não do sprint**. Os três achados que **não estão registrados** e valem o olho dele:
- **P1** — `ordem cmu1l8uj · separado 5,58 ≠ consumido 11,16 + devolvido 0` (**algo evaporou entre a câmara e a panela** — o invariante contábil da produção);
- **P5** — uma ficha de produto final sem preço há >14 dias;
- **F3** — boleto do **M. IVAN LUNARDI R$ 326,50 (venceu 14/09)** conferido e **nunca enviado ao financeiro**.

**⚠️⚠️ E UM ERRO MEU DE LEITURA, pego antes de virar relatório:** a contagem de hoje `MAIONESE · 3 → 11.432` me pareceu um segundo fantasma de grandeza. **É `11,432 kg`** — o ponto era o decimal do JavaScript, não separador de milhar. O que me salvou foi conferir o VALOR (R$ 82,80, não R$ 100 mil). *Número formatado por engano vira achado falso tão convincente quanto um real.*

### ⛔⛔⛔ O FLAKE VIGIADO DE 20/09 TINHA CAUSA — E ERA COLISÃO DE CNPJ ENTRE ARQUIVOS DE TESTE

**O `resolvido-de-um-lado-some-do-outro` ficou vermelho *"1× em 4 rodadas"* e eu registrei como vigiado, sem rotular de pré-existente** (a régua: *"'pré-existente' só depois de MEDIR a causa"*). Hoje ele caiu de novo e deixou pista: `prisma.transaction.create()` inválido. **Sozinho passa 3/3; só quebra em paralelo.**

**A CAUSA, medida:** dois arquivos usavam `const CNPJ = '50607080000616'` e **os dois** fazem `company.deleteMany({ where: { cnpj } })` no setup. A suíte roda arquivos **em paralelo contra o mesmo banco**: um apaga a empresa do outro no meio, o cascade leva `bankAccount`/`category`/`supplier` junto, e o `transaction.create` seguinte morre com FK inválida. ***É a terceira vez que esta casa paga por escopo de teste***: o `afterEach` sem empresa (20/09) e o `snapshotClosedModules` global (23/08).

**⭐ A varredura achou 5 colisões — e uma era MINHA, criada neste mesmo sprint.** Todas corrigidas, e a classe virou **impossibilidade** (`__tests__/regras-testes/cnpj-de-teste-nao-colide.test.ts`): CNPJ criado/apagado por dois arquivos = vermelho com os nomes na mensagem.

**⚠️ E O DETECTOR NASCEU LARGO DEMAIS:** a 1ª versão pegava qualquer literal de 14 dígitos e acusou **CNPJ de FORNECEDOR** (o `36603841000130` da CIA DA FRUTA, dado real de dois testes) e até o literal do meu próprio auto-teste. *Alarme falso no dia 1 é como um guard morre.* Ele ficou estreito: resolve a indireção da constante e olha **só dentro da chamada a `company.*`**. Red-then-green nos dois sentidos — morde a colisão real, não morde o fornecedor. **Suíte: 10.649 verdes em 3 rodadas seguidas.**

### ⭐⭐⭐ O RADAR ACHOU DINHEIRO NA ESTREIA — R$ 39.342,36 DE ESTOQUE FANTASMA

A prova em prod trouxe `FORA DAS LISTAS: R$ 1.619.008,87`, que é absurdo — e **o absurdo é REAL, está no ledger**:
```
REQUEIJAO CHEDDAR 1,5KG   14/09 15:27 · sistema 31 → contou 28500 · +R$ 1.622.448,31  [freio confirmado]
                          14/09 23:35 · sistema 42750 → contou 28,5 · −R$ 1.622.989,78 [freio confirmado]
                          ⭐ a marcyelle CORRIGIU no mesmo dia · saldo hoje 28,5 KG
CREME LEITE ITALAC 200GR  14/09 14:51 · sistema 177 → contou 16600 · +R$ 38.922,51    [freio confirmado]
                          ⛔ NUNCA corrigido · SALDO HOJE 16.600 UN · R$ 39.342,36
```
**É a família do lote que entrou mil vezes maior (19/09, a maionese 22.864 g × 22,864 kg), agora na CONTAGEM.** ⚠️ E **o FREIO foi confirmado nos dois** — ele PERGUNTA e a pessoa confirma; **ele não distingue "divergência real" de "erro de grandeza"**. O `plausibilidade.ts` (que compara o lote com o histórico dele) existe pra a PRODUÇÃO e **não cobre a contagem**.

📋 **NÃO CORRIGI NADA** — cirurgia de dado é decisão do dono. Duas frentes registradas: **(a)** o creme de leite (contar de novo pela tela zera os R$ 39 mil fantasma); **(b)** levar a régua de **plausibilidade de grandeza** pra a contagem, que é o que impediria o próximo.

📋 **E O CASO QUE VOCÊ MANDOU DEIXAR APARECER** — `PORÇAO CALABRESA 85g congelada`, a conta de padeiro dela:
```
janela: (1ª contagem) → 14/09      tinha 0 · produziu +15 · vendeu −13 · estornos +8
DEVIA TER 10 · CONTAMOS 15 · SOBROU 5 (R$ 11,60)
saldo hoje no ledger: −7 · valor R$ 0,02
```
⭐ Ou seja: em 14/09 ela **sobrava 5**; o saldo −7 de hoje é **posterior à contagem** — vendeu sem produzir DEPOIS. O Radar a mostra como *"falta contar"* no período de hoje, que é o estado honesto. **O gesto é teu: contar ou concluir a produção que falta.**

📋 **DÍVIDA REGISTRADA — DARK MODE GLOBAL (decisão do dono, 20/09):** o Radar nasce CLARO como o resto do app (*"nada de prefers-color-scheme sozinho — duas metades do sistema com temas diferentes, não"*). ⚠️ **Medido, não herdado do doc: 107 arquivos usam `dark:` e NINGUÉM liga a classe** (`darkMode:['class']`, zero chamadores). Ligar o interruptor global é **sprint próprio**, e o escopo tem que incluir **conferir os 107** — eles nunca renderizaram. O mock guarda os dois temas versionados até lá.

📋 **FICA PRO DONO (REGRA 2, o clique é dele):** abrir a lixeira e reconhecer o que sumiu (restaurar o que faltar — o aviso de duplicata mostra as duas lado a lado), e conciliar uma nota pra ver a pergunta da categoria aparecer e **ficar gravada na conta**.


### ⭐⭐⭐ ITEM ENCERRADO — "PRA OPERAÇÃO, ELE NÃO EXISTE MAIS" (19-20/09/2026)

**A ordem do dono, sobre a CUBA MAIONESE:** *"sai DE TUDO que é vivo (…) nenhum lugar oferece ela pra nada. O passado fica legível: as ordens e movimentos antigos continuam mostrando o nome dela — apagar isso reescreveria custos de poções já vendidas."*

**⛔⛔ POR QUE NÃO É SÓ `ativo = false`.** Desativado é *"parei de usar, posso voltar"* — e o Catálogo mostra os inativos num toggle, de propósito. **Encerrado é decisão final**, e a diferença precisa estar ESCRITA: sem ela, em três meses ninguém sabe se o item sumiu por engano, por faxina ou porque o dono aposentou a receita. ⭐ É a mesma distinção que a casa já fez em **mesclado ≠ arquivado** (30/08) e **`ENCERRADA_SEM_FINALIZAR` ≠ FEITA** (07/09): estado com significado próprio ganha nome próprio.

**⛔ E O GESTO RECUSA COM SALDO ≠ 0** — é o coração dele: encerrar um item com estoque dentro **esconderia o dinheiro** em vez de resolvê-lo. O valor não evapora por sumir da tela; continuaria no ledger, invisível, contaminando o total e o Real vs Teórico. *A saída é contar primeiro; o encerramento é o último passo, nunca o atalho.*

**⭐⭐ QUANTIDADE ZERADA COM CENTAVOS SOBRANDO — a régua do dono, reusada.** A CUBA foi contada a zero e sobraram **R$ 0,07** (resíduo do custo médio arredondado ao longo de ~36 kg). Recusar por 7 centavos deixaria o item preso pra sempre. Vale o que ele ditou de manhã: ***zerar quantidade zera valor, SEMPRE*** — com o **mesmo teto** do `residuo-de-centavos.ts` (o limite matemático do arredondamento, proporcional ao giro) e o ajuste **registrado**, nunca sumindo calado. Acima do teto continua recusando: *ali não é centavo, é entrada que falta*.

**═══ TRÊS ERROS MEUS NO CAMINHO, os três pegos pelo próprio guard ═══**

**⛔⛔ 1. ESCREVI UMA SEGUNDA RÉGUA DE SALDO** dentro do `encerrarItem` — um `aggregate` próprio em vez de `saldoItem` — e ela **repetiu o defeito dos estornos internos que eu tinha acabado de corrigir**: acusou **36,25 KG / R$ 1,51** num item já zerado pela contagem. ***Segunda derivação da mesma pergunta diverge no primeiro caso de borda — inclusive quando quem escreve a segunda acabou de consertar a primeira.***

**⚠️ 2. ERREI O SINAL DO CUSTO UNITÁRIO** no ajuste do resíduo; o CHECK do ledger recusou por 14 centavos. Agora o unitário é **derivado do total** (`custoTotal / quantidade`), que fecha por construção.

**⚠️ 3. UMA ASSERÇÃO MINHA FICOU OBSOLETA COM A MINHA PRÓPRIA CORREÇÃO** — o guard proibia `stockMovement.aggregate` no arquivo, e o aggregate que sobrou soma só `quantidade` (o giro, pro teto). **Apertado, não afrouxado**: o proibido passou a ser somar `custoTotal` ali, que era exatamente a segunda régua.

**⭐ O GUARD EXECUTA os 5 universos + Posição + Contagem** (REGRA 3) — grep não distingue *"filtra"* de *"seleciona o campo e esquece de usar"*, que é como a Posição deixou 9 itens invisíveis em 11/09, pelo lado contrário.

**PROVADO EM PROD, pelas funções que as telas chamam:**
```
COMPRAVEL 0 · PRATELEIRA 0 · RECEITA 0 · VENDAVEL 0 · CATALOGO 0
POSIÇÃO 0 · CONTAGEM 0 · FICHAS ativas 0 · PRODUÇÃO aberta 0 · componente de ficha 0

O PASSADO:  extrato 28 linhas · 28 COM SELO · ficha 28 linhas de histórico
   «CUBA MAIONESE» → item encerrado em 20/09/2026 — a família virou uma MAIONESE só, em KG
   10 ordens antigas preservadas · o Catálogo (a casa do passado) continua achando
```
**REGRA 11 — 3 defeitos repostos, 1 vermelho cada** (a ficha não indo junto · encerrar com saldo · o selo sumindo do extrato). **10.475 verdes · TS 0 · `pg_dump pre-encerrar-cuba-20260919-212908` · deploy `ZDh5ejNBCMLX899Zho8Xw` 4/4.**

⚠️ **E a interface da ficha do item passou a DERIVAR do tipo da lib** — a mesma dívida do tablet (*"interface escrita à mão sobre payload é promessa, não prova"*): o campo novo ficava invisível e um rename lá passava verde no `tsc`.


### ⭐⭐⭐ A FAMÍLIA MAIONESE VIROU UMA SÓ — E A CIRURGIA ACHOU 4 DEFEITOS DE LEDGER (19/09/2026)

**Autorizado pelo dono** (*"DISPARA A SEQUÊNCIA COMPLETA"*), `pg_dump pre-familia-maionese-20260919-203347` (6,5 MB) antes.

**⛔⛔ PASSO 1 — CORRIGIR SÓ A GERAÇÃO NÃO BASTAVA.** Com os 22864 kg desfeitos, a CUBA ficaria em **R$ 21,96/kg** contra os ~10,87 dos lotes bons: as separações seguintes tinham saído a **R$ 0,04/kg**, porque o custo médio já estava poluído pela própria geração podre. ***O erro de custo não fica parado — ele escorre pelos movimentos seguintes.*** `cascata-de-custo.ts` estorna do ponto podre em diante e recria em ordem cronológica, recalculando o custo médio a cada passo, com a **data do FATO** (nunca a do conserto).

⚠️ E o preview de ontem estava **desatualizado**: eram **6 pares** (a cozinha produziu em 19/09), não 5 — e a separação de 14/09 18:40 saiu a **R$ 12,51/kg** com o consumo dela a **R$ 0,04**, R$ 69,58 presos numa ordem já encerrada.

⚠️ **E o meu Δ estava inflado:** somava separação **e** consumo, que é o mesmo dinheiro contado duas vezes. Separados: **Δ prateleira R$ 365,35** (o valor a mais que sai do estoque) e **Δ CMV R$ 433,25** (o custo que entra nos produtos).

═══ **OS QUATRO DEFEITOS QUE A CIRURGIA EXPÔS** ═══

**⛔⛔ 1. O ESTORNO DE UM MOVIMENTO INTERNO ENTRAVA NA PRATELEIRA.** `estornarMovimento` cria a linha oposta com `tipo: 'ESTORNO'` — e ESTORNO **conta no saldo**. Desfazer um `PRODUCAO_CONSUMO` (que é interno e NÃO conta) **somava ao estoque**: o consumo saía por fora e voltava por dentro. A CUBA ficou com **72,74 kg** onde a reconstrução previa **36,49** — a diferença de **36,25** é a soma exata dos 6 consumos. ⚠️⚠️ **E não era da cirurgia:** medidos **9 estornos** nessa situação em prod, e o «Patinho Bife (mesclado)» carregava **+38,16 kg / R$ 1.754,36** desde uma mescla antiga. ⭐ **A cura é de LEITURA, não de dado** — o ledger está certo, quem somava é que errava (a família do E2, que contava linha crua).

**⛔⛔ 2. A REUNITIZAÇÃO IGNORAVA OS ESTORNOS.** `unidadeFisicaDosMovimentos` filtrava `tipo: { not: 'ESTORNO' }`, e como o plano de conversão nasce dessa lista, eles (a) ficavam fora do saldo previsto — o preview anunciou **22.915,44 KG** onde o saldo é **51,44** — e (b) **não seriam convertidos ao aplicar**, deixando metade do ledger em cada unidade. *O "nunca converte metade e cala" acontecendo por omissão.* ⭐ Um estorno está na mesma unidade física do original; resolver pelo `estornoDeId` é a única resposta que não chuta.

**⛔⛔ 3. REUNITIZAR PERDIA MASSA — e o CHECK do banco pegou.** Era `round2(quantidade)`, e o estoque trabalha em **3 casas** (grama/ml, a régua do próprio módulo): `22,864` virava `22,86`, e `22,86 × 9,79103 = 223,82` contra os **223,86** do dinheiro → o banco **recusou a linha** por 4 centavos. ⭐ Agora o unitário é **derivado da quantidade final**, com o `custoTotal` como âncora: o CHECK fecha **por construção**, não por sorte.

**⚠️ 4. O PREVIEW FALAVA LÍNGUA DIFERENTE DA POSIÇÃO** (pego antes do OK): o `saldoAntes` vinha de um `aggregate` cru, mostrando 3,12 onde a tela mostra 36,494.

═══ **O RESULTADO** ═══
```
MAIONESE            51,44 KG · R$ 503,69 · R$  9,79/kg   ⭐ agora em KG (era UN)
CUBA MAIONESE       36,49 KG · R$ 436,13 · R$ 11,95/kg   (ficha já inativa; espera a contagem)
POÇAO MAIONESE 30G  ← 0,030 KG de MAIONESE = R$ 0,294/pote   ⭐ consumo em kg, rende em POTES
ENCHER TUBO         ← 0,590 KG de MAIONESE = R$ 5,776/tubo
Patinho Bife (mesclado)  R$ 1.754,36 de fantasma → R$ 0,00
```

**⚠️⚠️ E A ORDEM DO PASSO 4 ESTAVA ERRADA NO PLANO — minha, não dele.** Desativar a CUBA **antes** da contagem a tiraria da lista de contagem, e aí o saldo dela não teria como ser zerado pela porta certa. ***Item desativado não aparece pra contar*** — o gesto tem que vir primeiro. Ela fica ativa até o dono contar.

**⛔ E HÁ UMA SESSÃO DE CONTAGEM ABERTA HÁ 28H, do cristian, com ZERO linhas** — *"1 sessão ABERTA por vez"* é índice único no banco, então ela **bloqueia a contagem do dono**. Não fechei sessão de outra pessoa sem ordem; está reportada.

**10.458 verdes · TS 0.**

📋 **FICA PRO DONO (o passo 5 é dele):** fechar a sessão vazia do cristian, contar **MAIONESE 3,000 KG** e **CUBA 0** na mesma sessão (o FREIO vai perguntar nas duas — é pra isso que ele existe), e então eu desativo a CUBA.


### ⛔⛔⛔ A ORDEM DO ANO 202 — O AVISO E O "SUMIU" ERAM O MESMO CASO (19/09/2026)

**O dono trouxe dois problemas:** *"o painel diz '1 ordem de ontem ainda em produção'"* e *"criei uma produção de calabresa ralada e ELA SUMIU — não aparece em lugar nenhum"*. **Medido por id, é a MESMA ordem** (`…4et405`).

**⭐⭐ A CAUSA, PROVADA ATÉ OS SEGUNDOS.** A rota validava com **`z.string().min(1)`** — que aceita qualquer texto — e montava `new Date(\`${data}T12:00:00\`)`, **sem `Z`**:
```
new Date('0202-09-18T12:00:00')  em America/Sao_Paulo  →  0202-09-18T15:06:28.000Z
                                    o gravado em prod  →  0202-09-18T15:06:28.000Z  ⭐
```
⚠️ **Os `:06:28` são a assinatura.** No ano 202 São Paulo não tinha fuso de hora inteira — usava **LMT −03:06:28**. Toda ordem normal grava `15:00:00` cravado; **só esta tem segundos**. *Foi o resíduo do relógio histórico que identificou a string de origem* (`"0202-09-18"`, o que um `<input type="date">` manda quando o ano sai com um zero a mais).

**⛔⛔ MAS O ESTRAGO NÃO FOI A DATA — FOI O SUMIÇO.** `listOrdens` ordenava por `dataProducao desc` com **`take: 200`**, e a empresa tem **238 ordens**: o ano 202 jogou a linha pra **posição 238 de 238**, dentro das 38 que o teto corta.
```
ordens ABERTAS no banco: 1  ·  visíveis em qualquer tela: 0  ·  R$ 42,18 de insumo preso
```
⭐ É **o teto de leitura aplicado ANTES da pergunta que importa** — a mesma doença do `take: 50` que escondeu o fermento da busca (16/09), e o *"desativar que não some"* ao contrário: **o ativo que não aparece**.

**A CURA É DE DUAS PONTAS, e as duas são necessárias:** a data **não pode mais nascer torta** (formato + plausibilidade + `Z`, REGRA 5 — sem o `Z` ela continuaria dependendo do fuso do processo) e **a ordem ABERTA deixou de depender do teto** (ele vale só pras encerradas, que são a massa e envelhecem). ⚠️ *Trabalho pendente não é histórico: ele é a razão da tela existir.*

**⭐⭐ E O AVISO GANHOU AS TRÊS PORTAS** — elas **já existiam** (concluir · cancelar-e-devolver · o plano de etapa de 15/09); faltava o aviso **nomeá-las**. Quem lê *"o insumo saiu da prateleira e não virou produto"* fica sabendo do problema e não do que fazer com ele. Agora cada porta **diz o efeito em dinheiro** (*"os R$ 42,18 voltam pra prateleira"*), o estado vem do **SERVIDOR** (se a tela deduzisse, discordaria do P2 na primeira borda) e a 3ª reusa `stock_etapa_plano` — nenhuma segunda resposta pra *"em que dia?"*.

⛔ **E o aviso NÃO é ruidoso:** etapa em andamento não é ordem parada (alguém está com a mão na massa) · lote com plano de continuar não avisa (massa que descansa é a **receita**) · **plano VENCIDO volta a avisar** (lote esquecido continua sendo lote esquecido).

**📋 O CENSO (14 dias) — 196 ordens:** 158 concluídas · 37 canceladas · **1 em produção**. Dinheiro em trânsito: **só a calabresa, R$ 42,18, parada há 45h**. ⭐ **E as canceladas SEMPRE devolveram** — varridas todas as 37, zero com sobra; o guard ganhou o caso que faltava (cancelar **EM_PRODUCAO**, não só logo após separar) com o invariante P1 junto.

**PROVADO EM PROD, pelas rotas reais depois do deploy:**
```
GET ordem → 200 · «porçao calabresa ralada 50 grama» EM_PRODUCAO
  parada.avisar: true · "parada há 1 dia · R$ 42,18 saíram da prateleira…
   ⚠️ a data desta ordem está fora do calendário — foi por isso que ela sumiu das listas"
  [concluir agora] [cancelar e devolver] [continua depois]  — cada uma com o efeito
GET lista → ordens 201 · abertas 1 · ⭐ a calabresa aparece nas DUAS
PAGE celular 200 · desktop 200        POST com "0202-09-18" → 422 que ENSINA
```
**REGRA 11 — 3 defeitos repostos, 1 vermelho cada** (o `.min(1)` de volta · o teto na busca das abertas · o efeito sumindo da tela). ⚠️ **E uma sonda minha deu 401 em tudo** antes de eu reportar: o cookie é `auth_token` com **underscore**, não hífen — *o 401 do proxy é indistinguível do 401 de credencial*, e a diferença entre "prod quebrada" e "sonda errada" era um caractere. **10.453 verdes · TS 0 · deploy `iCPgTIeg6zTGnJ32pPfnZ` 4/4 · Δ bundle +4 KB.**

📋 **FICA PRO DONO (REGRA 2, o clique é dele):** abrir a ordem da calabresa e escolher uma das três portas — o aviso some quando ela sair do estado parado.


### ⛔⛔⛔ O LOTE QUE ENTROU MIL VEZES MAIOR — E A CAUSA NÃO ERA O PARSE (19/09/2026)

**O dono:** *"a receita de maionese está descontando demais."* E ele apontou a causa: *"PAGA A DÍVIDA DE 08/09 — costura os 4 campos de parse próprio no `sanitizarQtd`."*

**⚠️⚠️ A MEDIÇÃO REFUTOU A CAUSA APONTADA, e isso mudou o conserto inteiro:**
```
digitou "22.864" → sanitizarQtd(KG) "22,864" → 22.864   |  parse do tablet: 22.864
digitou "22,864" → sanitizarQtd(KG) "22,864" → 22.864   |  parse do tablet: 22.864
digitou "22864"  → sanitizarQtd(KG) "22864"  → 22864    |  parse do tablet: 22864
```
**Os dois caminhos concordam** — costurar os parses não teria impedido nada. O que produz 22864 é digitar **sem separador**. *A dívida dos 4 parses é legítima (o `|| 0` engolindo lixo), e não era a cura daqui.*

**⭐⭐ A CAUSA REAL, e ela tem nome:** as duas conclusões podres são da **viviane** (14/09 e 16/09), com uma boa da mesma pessoa no meio (28,58 em 15/09). O fator é **EXATAMENTE MIL**:
```
14/09 CUBA MAIONESE  gerou 22864 · rendimento 2855,50 (a média: 2,85)  · custo un R$ 0,01 (era 10,95)
16/09 MAIONESE       gerou 22864 · rendimento 2858,00 (a média: 2,858) · custo un R$ 0,01 (era  9,79)
```
**A balança da cozinha mostra GRAMA e o item é controlado em KG.** 22.864 g **são** 22,864 kg. Não é erro aleatório de digitação: é **unidade mental ≠ unidade de controle**, e por isso se repete.

**⭐ O GUARD DE PLAUSIBILIDADE (`plausibilidade.ts`) COMPARA O LOTE COM ELE MESMO NO PASSADO.** *"22864 é muito?"* não tem resposta sem contexto — 22.864 porções é um dia normal. O que não existe é **mil vezes o rendimento histórico da MESMA ficha**. **10× PERGUNTA · 100× RECUSA**, e a assinatura de grandeza (500×–2000×) **sugere o número certo em um toque**.

**⛔ E ELE NÃO É RUIDOSO — é o que o separa dos 111 alarmes falsos:** produção do DOBRO passa (variação ≠ grandeza) · **sem histórico não julga** (primeira receita nunca é alarme) · **com UM lote só também não** (um lote atípico viraria a régua).

**⚠️⚠️ ACHADO AO LIGAR O GUARD — a etapa fechava ANTES da conclusão.** Com a recusa dentro do `concluir`, a cozinha digitava 22864, levava o aviso **e a tarefa já estava fechada**, sem como repetir: estado pela metade no meio do turno. A pergunta passou pra **antes de qualquer escrita** (`avaliarGrandezaDaConclusao`). ⛔ **E não é uma segunda régua:** é a MESMA composição chamada mais cedo, com o guard do motor de pé pros outros caminhos.

**⭐ E O TABLET PASSOU A DIZER A UNIDADE** (*"Quantos saíram? **em KG**"*) — a cura da causa na raiz, porque quem pesa em grama vê a régua do sistema antes de digitar.

**⛔⛔ LOTE ESTORNADO NUNCA ENTRA NA MÉDIA** (`stock_conclusao_estornada`, CREATE-only, **unique por conclusão** — estornar 2× é impossível, não "checado"). Sem isso o rendimento podre de **2858** continuaria sendo *"o histórico"* da maionese e envenenaria toda conclusão seguinte — **inclusive o próprio guard**, que passaria a aprovar o erro por ele ter virado a norma. *É o dado ruim mais perigoso: o que se legitima com o tempo.*

**⭐ O ESTORNA-E-RELANÇA (`estorna-e-relanca.ts`) NÃO É CONTAGEM** — e a diferença é o ponto: um ajuste deixaria no ledger um `AJUSTE_CONTAGEM` de **−22.841 kg**, um buraco com cara de perda física que envenenaria o Real vs Teórico pra sempre. Não houve perda: **houve um número digitado errado**. Correção = **estorno + novo**, e o **custo do lote NÃO muda** (R$ 248,56), o que é justamente a prova de que é grandeza.

**⭐⭐ "RECEITA JÁ EXISTE" — AS TRÊS PORTAS.** Medido: as fichas da CUBA e da MAIONESE estão `ativo=false` **com o item-invólucro ATIVO**, e como `seContaFisicamente` inclui INTERMEDIARIO, o dono levava a frase sobre **NOTA FISCAL** num produto que a cozinha FAZ. Em PRODUTO_FINAL era pior: **nascia um segundo item em silêncio**. Agora é uma recusa só (409, pergunta), com **reativar** (primária — é o caso dele) · **renomear a antiga** (pela porta única de rename, que grava o apelido de busca) · **criar assim mesmo** (o escape que já existia — nenhuma terceira porta de escrita nasceu).

**⭐⭐ A QUARENTENA DE VENDAS NASCEU** — nos DOIS relatórios, por uma **porta única de leitura**. É a **terceira** vez que esta casa paga pela mesma ausência (`rawOfxBlob` 13/08 · `fatura_quarentena` 16/09). ⭐ E o *"não leu nada"* deixou de ser uma frase só: as pistas separam **arquivo vazio** · **sem tabela** (o `.xls` do Suitable é HTML) · **outro relatório** · **dia sem venda**. O expurgo de 12 meses **nasceu com chamador** no cron (a lição do E10: promessa escrita que não roda é pior que nada).

**⚠️⚠️ REGRA 11 PEGOU DOIS GUARDS MEUS — "menção, não uso" pela QUARTA vez.** Repondo os defeitos, eles ficaram **verdes**: a linha do `import` no topo já bastava pro `toMatch`, e o `indexOf` da ordem achava o símbolo no próprio import. Apertados com `usosDe`/`posDoUso`, os três defeitos mordem.

**⚠️ 1 TESTE DE 01/09 INVERTIDO COM O MOTIVO ESCRITO:** ele afirmava *"ficha INATIVA não bloqueia — arquivar e recriar continua possível"*. Medido, isso é a fábrica de duplicata.

**10.435 verdes · TS 0 · `pg_dump pre-sprintB-20260919-033749` (6,5 MB) antes das 2 migrations (CREATE-only, guard de isolamento verde).**

📋 **PENDENTE, E É DECISÃO DO DONO (preview pronto, NADA gravado):** o estorno das 2 gerações podres. A cascata (as porções de maionese que consumiram a cuba a R$ 0,04/kg em vez de R$ 10,87) tem o Δ CMV medido no preview.


### ⛔⛔⛔ A RECUSA NÃO DIZIA QUAL DOS 58 ITENS — E O TETO DE 5 CENTAVOS CAIU NA MEDIÇÃO (19/09/2026)

**O dono, travado na baixa de 18/09:** *"o confirmar recusa com «Este item ficaria com 0 unidades e valor R$ -0.04» mas NÃO DIZ QUAL ITEM dos 58 — fico travado sem saber onde agir (e os outros 57 reféns do 1)."*

**⭐⭐ DE ONDE O CENTAVO NEGATIVO NASCE, medido em prod:** `custoMedioPorItem` devolve `round2(valor / saldo)` — um número de **TELA** — e a baixa **multiplica** esse arredondado pela quantidade. O erro **cresce com a quantidade**:
```
OVO BRANCO · 1.019 un · R$ 555,64 · custo médio arredondado 0,55
   zerar: 1.019 × 0,55 = R$ 560,45  →  sobra R$ -4,81
```
**47 de 190 itens com saldo > 0 ficariam negativos ao zerar** — o pior é a **CUBA MAIONESE, R$ -113,63** (o resíduo do lote podre do Sprint B).

**⚠️⚠️ ISSO DERRUBOU O TETO DE ~R$ 0,05 QUE O DONO PROPÔS** — ele recusaria 46 dos 47. O teto que fica é o **LIMITE MATEMÁTICO DO ARREDONDAMENTO**, não um número escolhido a dedo: **meio centavo por unidade** (`max(0,05; qtd × 0,005)`), a **mesma régua do E16** (*"0,005 × Σ|quantidade|"*, 29/08). Um custo arredondado na 2ª casa erra no máximo meio centavo por unidade — acima disso não é centavo, é dado torto, e **continua recusando**.

**⭐ E A CURA DE FUNDO É A LIÇÃO QUE ESTA CASA JÁ APRENDEU DUAS VEZES** (a reunitização do pão, 27/08; o custo por unidade da conclusão de produção, 21/08): ***o ledger guarda precisão cheia; quem arredonda é a leitura***. `custoParaBaixar` devolve `valor / saldo` **sem arredondar** — com ele o resíduo **não nasce**. O teto acima é só pra o que JÁ está gravado.

**⛔ `AJUSTA_RESIDUO` SÓ EXISTE QUANDO A QUANTIDADE VAI A ZERO.** Com saldo remanescente, valor negativo é dado torto de verdade — é o caso do **fermento** (16/09: consumo lançado antes da nota de compra) — e zerar o valor de um item que ainda está na prateleira **esconderia a compra que falta**.

**⭐⭐ O RÉU TEM NOME.** `MovementInvalidError` passou a carregar o `culpado` (item, nome, saldo e valor depois) e a mensagem diz o estado de hoje e o que a baixa tira. Medido em prod, com rollback:
```
«porcao file para xis 150grama» ficaria com 1 UN e valor R$ -10.00 — dinheiro negativo
com saldo positivo é um estado que não existe. Hoje ele tem 3 UN valendo R$ 0.00;
esta baixa tira 2 UN (R$ 10.00). Confira a quantidade: ela costuma ser o sintoma.
```

**⭐ O LOTE NÃO FICA REFÉM DE UM ITEM — e a ATOMICIDADE NÃO AFROUXA.** A baixa **junta todos os barrados** e **desfaz tudo** (gravar 57 e "meio" o 58º seria o estado pela metade que o módulo existe pra evitar). O que muda é que a **recusa carrega o caminho**: 409 `ITEM_BARRADO` com os réus e a oferta *"baixar os outros N e deixar este pendente"* — o mesmo desenho do `confirmouSanidade` (05/09), ***pergunta, nunca recusa cega***. ⚠️ E **as linhas do dia continuam gravadas**: resolvido o item, um reprocesso baixa o que faltou, **sem reimportar nada** — a tela diz isso, senão pular vira perder.

**⚠️ O SUSPEITO DO DONO FOI INOCENTADO PELA MEDIÇÃO:** *"porcao file para xis"* está em **3 UN · R$ 0,00**, não negativo (é um dos **6 itens** com saldo > 0 e valor zerado). **Os dois candidatos com a assinatura EXATA de −0,04** são *«porcao beef de alimenuta»* (40 un · R$ 490,36 → 40 × 12,26 = 490,40) e *«beef aparmegiana de carne 120g»* (13 un · R$ 121,25 → 13 × 9,33 = 121,29). **Os dois cabem no teto proporcional e, com o custo cheio, nem chegam a nascer.**

**⚠️ E A PRIMEIRA PROVA EM PROD FOI SONDA MINHA ERRADA:** ela só baixava os chunks do primeiro paint e devolveu **5 ⛔** com o código **no build**. *Sonda errada dá um vermelho tão convincente quanto um defeito real* — conferido por grep no build servido antes de reportar qualquer coisa.

**PROVADO EM PROD, no chunk que prod serve, nos DOIS viewports (REGRA 12):**
```
CELULAR 200 · 56 KB      DESKTOP 200 · 56 KB
  ✓ a recusa NOMEIA os réus · ✓ "baixar os outros N" · ✓ o dia continua reprocessável
  ✓ 409 ITEM_BARRADO · ✓ o escape · ✓ composição ÚNICA (uma lista, não uma por viewport)
```
**REGRA 11 — 16 guards, cada trava reposta dá vermelho** (custo arredondado de volta · contiguidade do teto · atomicidade afrouxada · a lista sumindo da tela). ⚠️ E **uma asserção minha estava errada**: contei `barrados.itens.map` e peguei os 2 usos do *reenvio* — a régua é a **lista desenhada** (`<li key>`), não toda menção. **10.401 verdes · TS 0 · deploy `4SF_-n8AiR1uo3zoEthUS` 4/4 · Δ bundle +4 KB.**

📋 **FICA PRO DONO (REGRA 2, o clique é dele):** repor a baixa de 18/09 — ou ela passa inteira, ou a recusa **nomeia** o réu e oferece baixar os outros. **Recusa sem nome reposta = vermelho.**


### ✅ O VÍNCULO CRUZADO FOI DESFEITO (19/09/2026, autorizado: *"preview conferido"*)

`pg_dump pre-vinculo-cruzado-20260919-010501.dump` (6,5 MB) antes · preview conferido contra o estado do minuto · aplicado **pelas portas únicas**, nunca por script replicando a lógica.

```
ANTES  C41022227-1 #24: PAID · paidTotal 5.617,23 · 2 pagamentos somando 12.520,68 ⛔ não fecha
DEPOIS C41022227-1 #24: PAID · paidTotal 6.903,45 · 1 pagamento ✓ · juros 2.517,49 · amort 4.385,96
       C41022570-0 #14: PAID · paidTotal 5.617,23 · 1 pagamento ✓
              amortização 4.166,64 + encargos 1.450,59 (juros 466,52 + correção 984,07)
              saldo 95.833,36 → 91.666,72   ⭐ ao centavo o que o dono aprovou
INTEGRIDADE: 22 parcelas com N:1 na empresa · 0 inconsistentes
JUIZ: 10/10 contratos · balance 0 · dup 0 · venda 0
```

**⭐⭐ E A CIRURGIA CRIOU A PORTA QUE FALTAVA — `desfazerVinculoDeParcela`.** Não existia jeito de soltar um vínculo N:1: o `DELETE .../parcelas/[number]` mexe **só no caminho 1:1** e **deixa os `LoanInstallmentPayment` de pé** — usá-lo aqui deixaria a parcela **OPEN segurando pagamento**, pior que o defeito. ⚠️ *Cirurgia que se faz uma vez vira script perdido; gesto que fica vira porta* — e o dono vai errar de novo (dois contratos do mesmo banco adjacentes num menu é caso de repetir).

⛔ **A porta devolve a parcela ao estado de quem NUNCA foi paga** (pagamentos soltos, split limpo, status OPEN) e **quem re-grava é sempre `vincularPagamentoDeParcela`**, que recalcula do zero. *Nada de ajustar `paidTotal` na mão: número de dinheiro corrigido a dedo é o começo do dado que ninguém explica depois.*

**⚠️ E EU QUASE REPORTEI UM ALARME FALSO:** vi `paidInterest 466,52` e anunciei que o split tinha saído diferente dos R$ 1.450,59 aprovados. **Medi antes de afirmar** e os encargos estavam inteiros — num contrato POS eles vêm **partidos em juros + correção monetária** (466,52 + 984,07), que é mais preciso que a linha única do meu preview. *Olhar um campo e concluir sobre a soma é a mesma pressa que produziu o `'categoryId' in t`.*

⚠️ **DRE de setembro (mês aberto):** estas duas parcelas somam **R$ 3.968,08** de despesa financeira — antes a #24 sozinha lançava 1.231,27 sobre um `paidTotal` que não era o dela.

⚠️ E a **ponte da RGE (R$ 307,22) FICA** — decisão do dono: *"era retirada de verdade, conta de luz da minha casa paga pela empresa"*.


### ⛔⛔⛔ O PALPITE DE EMPRÉSTIMO NUNCA EXISTIU — SELECT INCOMPLETO, E O ESTRAGO FOI VÍNCULO CRUZADO (19/09/2026)

**O dono:** *"vinculei a parcela pelo gesto da caixa e nada aconteceu."* E a cadeia, medida por id, é mais longa que o relato:

```
1. palpites-da-caixa buscava os contratos SEM o campo `status`
2. detectLoanPayment começa com  loans.filter(l => l.status === 'ACTIVE' || 'LATE')
   → com o campo UNDEFINED, a lista fica VAZIA
3. → nenhum contrato casa → NENHUM palpite de parcela, NUNCA (zero, desde que a caixa nasceu)
4. sem palpite, o dono escolheu numa lista de 8 contratos → pegou o errado
5. a linha do C41022570 foi parar na parcela #24 do C41022227-1  ⛔ VÍNCULO CRUZADO
```

**⚠️⚠️ É A DOENÇA DO SELECT INCOMPLETO — a mesma do PIX de 7.000 (17/08):** o motor decide com um campo que a consulta não trouxe, e **não dá erro: dá silêncio**. ⭐ O que deixou passar foi um **`as never`** no call-site — sem o cast, o TypeScript teria acusado o campo faltando. *Cast que cala o compilador é o lugar onde o select incompleto se esconde.* ⚠️ E o `.catch(() => new Map())` da rota fechava o caixão: se explodisse, alguém veria; como só "não casa", o silêncio é perfeito.

**⭐ A LIB SEMPRE SOUBE A RESPOSTA** (medido com a forma certa): `LIQUIDACAO DE PARCELA-C41022570` → contrato **C41022570-0**, **parcela 14** — o extrato escreve o número sem o sufixo e `descriptionMatchesContract` já resolve isso desde 27/06. O motor estava certo; quem o cegava era a consulta.

**⚠️ E TRÊS SONDAS MINHAS ERRARAM ANTES DE EU ACERTAR** — a primeira chamou a lib com a assinatura errada, a segunda esqueceu o `status` (o MESMO campo do bug), a terceira passou `dueDay`, que não existe em `Loan`. *Sonda errada dá um vermelho tão convincente quanto um defeito real* — cada uma foi conferida contra a assinatura antes de virar conclusão.

**AS TRÊS CAMADAS DA FALHA MUDA, todas consertadas:**
| camada | como calava |
|---|---|
| **motor** | select sem `status` → palpite nunca nasce |
| **mensagem** | *"Alguns lançamentos não são elegíveis (conta errada, já vinculados, ou não são débito)"* — três motivos, nenhum nomeado |
| **rota** | `VinculoDeParcelaError` não é `ResolverError` → escapava como **500 sem corpo** |
| **tela** | a recusa renderizava **no topo da caixa** — no celular, com o dedo num cartão do meio da lista, está fora da tela |

⭐ Agora a recusa diz **qual** e **onde**: *"«LIQUIDACAO DE PARCELA-C41022570» já está vinculada à parcela 24 do contrato C41022227-1 — desfaça lá primeiro"*, em 422, **dentro do cartão da linha**.

**⭐⭐ E O CONVITE DA PONTE DEIXOU DE SER UM TOAST.** O dono: *"aparece uma mensagem em cima e ela DESAPARECE sozinha — depois eu não sei onde achar as retiradas. **Fiz 2 que teriam ido pra PF e não sei se deram certo.**"* ***Nada que some sozinho carrega decisão.*** O painel passou a abrir **ancorado na linha** (como o Find & Match) e **a linha não sai da caixa** até ele responder — mandar ou pular, explícito.

**⭐ E "RETIRADAS" GANHOU LUGAR VISÍVEL — a 9ª volta da porta sem maçaneta.** A tela `/empresas/[id]/retiradas` existe **desde 08/08** e só era alcançável por um banner de órfãs ou de dentro do próprio painel da ponte: **nunca esteve no menu**. Entrou, e ganhou a seção **"já mandadas pro perfil pessoal"**, cada uma com link pra ponte — que mostra as duas pontas. *A pergunta "deu certo?" não tinha tela.*

**AS 2 RETIRADAS DELE, respondidas por id:**
```
✅ RGE SUL · R$ 307,22 · 17/09 → PONTE COMPLETA
     ponte cmu7tbagr006llqd9mrtrefsr · entrada na PF cmu7tbag4006jlqd9oxbqstec
⛔ MONIQUE SOARES PAZ · R$ 350,00 · 16/09 → PENDENTE (sem ponte) · tx cmu7qxrxh013g7tu92g58moyv
```

**PROVADO EM PROD depois do deploy** (o montador real, sobre as linhas que ele tentou):
```
LIQUIDACAO DE PARCELA-C41022227 → Contrato C41022227-1 — parcela 25 · R$ 6.903,45
LIQUIDACAO DE PARCELA-C41022570 → Contrato C41022570-0 — parcela 14 · R$ 5.617,23
(antes deste deploy: ZERO palpites de empréstimo, sempre)
```
**REGRA 11 — 4 defeitos repostos, 1 vermelho cada** (select sem `status` · convite voltando a recarregar · recusa genérica · Retiradas fora do menu). **10.381 verdes · TS 0 · deploy `PT39n-HltnU-kOg9XCbVv` 4/4.**

📋 **PENDENTE, E É DECISÃO DO DONO (preview pronto, NADA gravado):** desfazer o vínculo cruzado — tirar os R$ 5.617,23 da #24 do C41022227-1 (ela nunca foi desse contrato) e vinculá-los à **#14 do C41022570-0**: amortização R$ 4.166,64 + encargos R$ 1.450,59, saldo 95.833,36 → 91.666,72. ⚠️ Hoje a #24 tem **2 pagamentos somando R$ 12.520,68 com `paidTotal` 5.617,23** — inconsistente enquanto o cruzado estiver lá.


### ⛔⛔ DOIS GESTOS QUE EFETIVAVAM PELA METADE — E NENHUMA DAS DUAS CAUSAS ERA A SUSPEITA (18/09/2026)

**⭐ 1. RETIRADA SEM PONTE — a capacidade NÃO tinha sido guardada.** O dono: *"marquei uma saída como Distribuição de Lucros na caixa e ela só gravou a categoria: não abriu a ponte que mandava a retirada pro meu perfil PF. **Não quero meia-ponte gravada.**"* Ele perguntou se a peça tinha ficado nas guardadas da faxina de 15/09. **Não:** o `WithdrawalPanel` está **VIVO** (usado pelo `xero-row` e pela tela do sócio) e os 4 arquivos com selo `CAPACIDADE GUARDADA` são outros. O que houve é mais silencioso — **a caixa de entrada nasceu sem o convite**, porque o *"convite pós-categorização"* morava no **Pendentes**, e o Pendentes morreu como TELA em 15/09. *Quando uma tela morre, some junto tudo que era oferecido POR ELA — e some sem erro nenhum.*

⭐ **O passo 2 agora é oferecido na hora** (e reusa o painel que existe — REGRA 4): categorizar na seção 💰 abre *"mandar pro perfil PF →"*, que cria a entrada na PF e vincula as duas pontas pelo mesmo `/api/pontes` de sempre. ⛔ **Pular é legítimo** (*"opcional mas oferecido sempre"*) — e a tela **diz onde reabrir**, senão pular vira perder. ⭐ Quem decide se é retirada é o **`dreGroup`**, a MESMA régua que separa a seção do menu: uma decisão, um lugar.

⚠️ **E o estado que sobra já tinha nome e casa:** `orphanWithdrawalWhere` chama de **órfã** a saída marcada como retirada **sem ponte**, e `/retiradas-pendentes` a lista. **Medido: a linha do dono está lá** — `cmu7qxrxh013g7tu92g58moyv` (R$ 350, 16/09, *PAGAMENTO PIX-PIX_DEB … MONIQUE SOARES PAZ*). O gesto sempre foi reabrível; o que faltava era a caixa **dizer isso**.

**⛔⛔ 2. SELETOR DE EMPRÉSTIMO "VAZIO" — NÃO ERA DADO, ERA CSS.** O dono: *"clico «parcela de empréstimo» e o seletor abre SEM NENHUM empréstimo — e a empresa TEM contratos ativos."* As três hipóteses dele (companyId, filtro de status, universo) **caíram na medição**: a rota devolve **10 contratos, 8 com parcela em aberto, em 41 ms** — e o **log do nginx prova que o payload chegou no navegador dele**: `GET /api/empresas/…/emprestimos → 200 · 8024 bytes`, às 23:37:06.

⭐ **A causa:** o cartão ≍ é `overflow-hidden` (é o que arredonda os dois lados do grid) e o menu era `absolute` **dentro** dele — os chips são o **último bloco** do cartão, então **o painel era recortado pela borda**. ***Menu que abre fora da vista é indistinguível de menu vazio.*** ⚠️ E foi por isso que a categoria "funcionou" e o contrato não: a seção 💰 é a **primeira**, e era o único pedaço que sobrava visível.

⭐ **O conserto é no MENU, não no cartão:** o painel foi pro **portal** (sem ancestral que corte) e a posição virou função pura (`posicaoDoMenu`) — abre **pra cima** quando o chip está no rodapé (no celular do dono: `ACIMA com 682px`), **nunca sangra pela direita**, e a altura é o **espaço REAL** que sobra. Um teste prova que o cartão **continua** com `overflow-hidden`: o conserto não pagou o arredondamento como preço.

**⛔ 3. E O VAZIO PAROU DE MENTIR.** As três listas carregam com falha macia; o menu dizia *"nenhum contrato com parcela em aberto"* — uma **afirmação sobre a empresa feita a partir de uma falha de rede**. Agora `CARREGANDO`, `FALHOU` e `OK+vazio` têm frases diferentes, e **só a última fala da empresa**.

**PROVADO EM PROD (bundle servido, os dois viewports):**
```
seletor de empréstimo: 10 contratos · 8 no menu (Caixa 33/32 · Sicredi 4/22/14/24 · Banrisul 25/59)
convite da ponte nas 5 categorias de retirada · tipo sugerido só quando o nome não é ambíguo
   "Pró-labore e Distribuição" → (o dono escolhe)   ⭐ diz as duas coisas, não chuta
menu no PORTAL ✓ · convite ✓ · pular diz onde reabrir ✓ · selo das 2 pontas ✓ · vazio honesto ✓
chip no rodapé do celular → menu abre ACIMA com 682px
```
**REGRA 11 — 3 defeitos repostos, 1 vermelho cada** (portal removido · convite não oferecido · vazio afirmando com a carga falha). **10.365 verdes · TS 0 · deploy `BHyeQ3x61hkDzdCxmQgut` 4/4 · Δ bundle +16 KB.**

📋 **FICA PRO DONO:** a linha de R$ 350 de 16/09 está em **Retiradas pendentes** esperando a ponte — e daqui pra frente o convite aparece no ato.


### ⛔⛔⛔ 10 DOS 12 CHIPS DO CARTÃO ≍ NÃO ENTREGAVAM O GESTO (17-18/09/2026)

**O dono, navegando em prod no celular:** *"clico «casar com conta a pagar» na linha do BAMBERG (que TEM candidata — o card dela está logo abaixo no PRA TUA MÃO) e não abre painel nenhum — pior: a tela SAI/fecha o cartão. **Gesto principal do balcão mudo = REGRA 2.**"*

**⭐ A PERÍCIA COMEÇOU MEDINDO, e o que ela achou é maior que o relato.** O deep-link estava certo, o card existia no destino e a fila até abria o grupo. **O defeito era NAVEGACIONAL:** `window.location.href` levava pra `/conciliacao?abrir=` — **a PRÓPRIA tela**. O reload fechava o cartão ≍, jogava o scroll pro topo e deixava o painel **abaixo da dobra**. No celular ele nunca chegava a vê-lo.

**⛔⛔ E AÍ A VARREDURA DOS 12 CHIPS (6 saída + 6 entrada) MOSTROU QUE SÓ DOIS FUNCIONAVAM:**

| chip | o que acontecia |
|---|---|
| casar com conta a pagar | reload da própria tela — painel fora da dobra |
| **casar com conta a receber** | deep-link pra `/empresas/<id>/contas-a-receber` — **rota que NÃO EXISTE**, 404 |
| **é despesa: categoria** · recebimento de venda · aporte | `<select>` alimentado por **`/api/categorias`** — **rota que NÃO EXISTE**: o menu nascia **VAZIO** |
| **parcela de empréstimo** · **estorno** | botão **sem seletor nenhum** → ação sem alvo → **422** *"Escolha o contrato…"* |
| transferência enviada/recebida | levava ao `/parear`, que **ignorava o `?abrir=`** |
| pagamento de fatura · ignorar | ✓ os dois únicos que entregavam |

**⭐⭐ A LEI QUE FICOU, e é o que o guard de família cobra chip a chip:**

> **todo chip ou EFETIVA com o alvo que a TELA consegue fornecer, ou LEVA a uma rota que EXISTE e que CONSOME o parâmetro.** Não há terceira saída: chip que manda a ação sem alvo é **mudo**; chip que aponta pra rota inexistente é **porta pintada**.

**O QUE MUDOU:**
- **Casar resolve ONDE O GESTO NASCEU:** o `FindAndMatchPanel` abre **embaixo da própria linha** (não é um segundo card — é o mesmo componente que o lote e a sugestão já abrem por props, e ele cobre PAYABLE **e** RECEIVABLE, o que dá destino real ao "casar com conta a receber"). Conciliar → a linha **sai da caixa na hora**.
- ⛔ **`destinoDaAcao` só devolve destino PROVADO.** As duas ações de casar deixaram de ser caminho e voltaram a ser *"gesto que pede alvo"*: o servidor recusa **ensinando**, como todos os outros. Sobram as transferências — e o `/parear` **passou a consumir o `?abrir=`**, pré-marcando a perna tocada (⛔ **sem chutar a outra**: achar o par é do detector, que sugere pro dono confirmar).
- **O menu virou o do mock:** pílula que **abre só ao tocar**, com seções, busca a partir de 8 opções e ESC/clique-fora pelo hook único da casa. Morreu o `<select>` nativo — era ele que no celular cobria a tela com os 4 cartões.
- **⭐ A RETIRADA GANHOU CASA, SEM VIRAR DESPESA.** ⚠️ A hipótese óbvia (*"o seletor filtra só EXPENSE"*) **caiu na medição**: as 5 categorias de retirada **já são `EXPENSE`** com `dreGroup DISTRIBUICAO_LUCROS`. O que as escondia era o menu chapado. A cura **NOMEIA a classe** — seção *«💰 retirada / distribuição de lucros»*, primeira, com a frase *"dinheiro do sócio — não é despesa operacional e fica fora do DRE"* — e **nada é reclassificado pra caber**.

**⚠️⚠️ E A PROVA EM PROD PEGOU DOIS DEFEITOS MEUS que teste nenhum pegaria:**
1. **O menu ofereceria 203 ARMADILHAS.** A rota devolve o catálogo INTEIRO — **263 categorias, 60 ativas**. É o defeito de 17/09 na fatura do cartão de novo (*"o que a tela oferece é SUBCONJUNTO do que a gravação aceita"*). A trava ficou na **régua pura** (vale mesmo se a chamada esquecer o `?soAtivas=true`), não só no parâmetro.
2. **⭐ O BANCO ABREVIA — e semear a busca com o nome inteiro devolvia ZERO.** Extrato: `BAMBERG COMERCIO E REPRES LTDA`; cadastro: `…REPRESENTACOES LTDA`. Busca cheia → **0 candidatas** (o painel abriria dizendo *"nada encontrado"* com **3 contas abertas dele** logo abaixo — *erro disfarçado de vazio*); `BAMBERG COMERCIO` → **as 3**. A semente virou o **prefixo com 2 palavras significativas**, com o conector junto (a busca é `contains`: o fragmento tem que ser **contíguo** — `CIA DA FRUTA`, nunca `CIA FRUTA`).

**PROVADO EM PROD, pelas rotas reais e no BUNDLE SERVIDO (REGRA 12, os dois viewports):**
```
BAMBERG → casar → o painel abre AQUI, buscando "BAMBERG COMERCIO" → 3 candidatas
   · NF 1746952 · R$ 2.870,70 · venceu 14/09 · dif R$ 165,06   ← a "1 vencida" do dono
   · NF 1748144 · R$ 1.477,28 · vence 21/09
   · NF 1749209 · R$ 1.341,80 · vence 28/09
FRANCIELE R$ 500 → 1ª seção do menu: 💰 retirada / distribuição (5) · depois despesa (44)
menu de categoria: 263 → 60 ativas     ⛔ /api/categorias: 404 (era daqui que vinha o vazio)
bundle celular e desktop: menu ao toque ✓ · retirada ✓ · painel na linha ✓ · <select> nativo: NÃO ✓
/parear?abrir= → lê o alvo ✓ · marca a perna ✓ · e DIZ quando não achou ✓
```
**REGRA 11 — 6 defeitos repostos, todos vermelhos** (o do casar-receber dá **3**: a lista de destinos, a rota inexistente e o alvo ignorado). **2 testes invertidos com o motivo escrito** (o E2E que afirmava `DEEP_LINK` e as 4 asserções que afirmavam o nome inteiro na busca). **10.345 verdes · TS 0 · deploys `QLzcIxYKSkuYyCb3IoU8O`, `SC5edWDFe6PLMCPJMh3DC` e `zQzIWczVVh_q2CXi5Salq`, os três 4/4 · Δ bundle +8 KB.**

📋 **FICA PRO DONO (REGRA 2, o clique é dele):** BAMBERG → casar → escolher a NF 1746952 (a diferença de R$ 165,06 é 5,4% da linha, dentro do degrau que **pergunta** — o painel pede pra nomear como juros) → conciliar e ver a linha sair da caixa. E o PIX da FRANCIELE → *"é despesa: categoria"* → **Distribuição de Lucros**.


### ⛔⛔⛔ IMPORT MISTO NÃO GRAVAVA — A TELA APRENDEU A PARTIÇÃO E O VALIDADOR FICOU PRA TRÁS (17/09)

**O dono, na fatura Sicredi:** *"40 linhas, 8 já no sistema (R$ 828,50, em leitura sem checkbox — como a tela de ontem manda), 32 novas marcadas (R$ 2.365,85). Confirmar → 'a soma das linhas 2.365,85 não fecha com o total 3.194,35, diferença 828,50'."*

**⛔⛔ A DIFERENÇA ACUSADA ERA, AO CENTAVO, O QUE A PRÓPRIA TELA TINHA TIRADO DA MÃO DELE.** E foi eu quem criou as duas metades: ontem a tela passou a **impedir de marcar** as já-no-sistema (sem checkbox, em leitura — e está certo), mas o `confirm` continuava exigindo que as linhas **ENVIADAS** fechassem sozinhas com o total. Juntas, as duas tornavam o import misto **impossível de gravar**.

⚠️ **É a segunda régua de novo — agora entre PREVIEW e CONFIRM.** O preview já dizia a frase certa (*"você marcou 32 de 40, por isso o total é outro"*); quem não sabia da partição era a gravação. É a dupla que já custou o import de OFX inteiro, e que o `resolveImportStatuses` resolveu lá com o mesmo desenho: **uma função, as duas pontas**.

**⭐ A CONTA CERTA:** `Σ(novas) + Σ(já no sistema) == total da fatura`. A já-gravada **conta pra fechar e não regrava** — o dedup de sempre cuida. E a partição é a **MESMA** da tela porque nasce do mesmo `contentHash` (`identidadeDaLinha`): o validador não inventa o que é novo, ele pergunta pela mesma chave. ⚠️ E ele **não confia no cliente**: lê as já-gravadas do banco pela competência da fatura.

**⛔ E A DEFESA NÃO AFROUXOU** — em fatura 100% nova não há nada gravado, `jaNoSistema` é 0 e o fechamento continua exigindo a soma cheia. *Ela não ficou mais permissiva: aprendeu que a fatura pode chegar em duas partes.*

⭐ **As bordas que fariam a conta torcer, todas travadas:** reenviar a fatura inteira **não conta duas vezes** (a enviada que já existe vale uma) · **estorno já gravado entra com sinal** (senão misto com crédito nunca fecharia) · **pagamento de fatura fica fora** (não é lançamento dela, é a quitação).

**⛔⛔⛔ E A MINHA PRIMEIRA CORREÇÃO TROUXE A SEGUNDA RÉGUA DENTRO DELA — o dono pegou na volta seguinte.** A tela pergunta *"esta linha já está no sistema?"* pelo **hash**: a linha é conhecida **onde quer que ela more**. Eu fui buscar as gravadas **pela competência da fatura** — e as 8 do caso real são **parcelas que moram em faturas de jun/jul/ago**. Em `2026-09` a busca achou **ZERO**, e o fechamento voltou a cobrar as novas sozinhas com a mesma diferença de 828,50. ***Duas chaves de partição são duas réguas***, e eu escrevi a segunda dentro do conserto da primeira.

**⭐ A PERGUNTA TEM UMA RESPOSTA SÓ:** o `contentHash` existe no banco — sem competência, sem data, sem o mês de qual fatura. E ela precisa das duas metades:
- **o validador** parte as linhas por hash (a mesma chave que pinta o selo "já no sistema" na tela);
- **a tela manda as já-no-sistema JUNTO** — senão o servidor nunca as vê, e nenhuma partição do mundo as encontra. Elas **contam pra fechar e não regravam** (o dedup de sempre pula).

**REGRA 11 — 2 defeitos repostos:** a busca por competência (**3 vermelhos**, um reproduzindo os 2.365,85 × 3.194,35) · a tela voltando a mandar só as marcadas (**1**).

⚠️ E o tudo-ou-nada original segue travado: reposto, dá vermelho igual.


### ⛔⛔ FATURA DA CAIXA — DUAS RÉGUAS NA MESMA TELA (17/09)

**O dono:** *"o banner do topo diz 'não fecha' (somou compras+encargos 5.119,53 sem SUBTRAIR os estornos 12,54) enquanto o rodapé diz '✓ bate: 5.106,99'."*

**⭐ E A CONTA PRINCIPAL SEMPRE ESTEVE CERTA — `diferenca 0`.** Quem reprovava era um **check secundário** que confere o BRUTO contra o *"Total cartão"* declarado:

```
diferenca 0 · matches FALSE
"Total cartão não bate: somei compras+encargos R$ 5.119,53 mas o declarado é R$ 5.106,99"
```

**⛔⛔ A CAUSA: nem todo banco declara DOIS números.** O Banrisul PJ imprime `TOTAL DE GASTOS` **e** `Saldo da fatura atual` (13.797,73 × 13.779,73); a **Caixa imprime um só** — o que se paga —, e o parser o devolve nos dois campos. Aí o check passava a comparar **bruto contra líquido**, e os 12,54 de estorno viravam "não fecha".

⭐ **A cura não é remover a defesa** (ela existe pra pegar bruto declarado que não bate): é ela **só existir quando há duas declarações diferentes pra conferir**. Onde o banco declara os dois, continua mordendo — há teste pros dois lados.

**REGRA 11 — a fórmula sem estornos reposta: 3 vermelhos**, um deles reproduzindo a mensagem exata que o dono viu.

**⭐⭐ E O SEGUNDO GOLDEN VEIO DA QUARENTENA — o primeiro com desfecho OK.** É a promessa *"a que FECHOU é o golden de amanhã"* se cumprindo pela primeira vez: `caixa-fatura-rica.txt`, 15 linhas, com **rotativo, multa, mora, IOF, anuidade, cashback e estornos** num documento só. **11 fixtures / 7 bancos**, todas verdes.

⚠️ **E O GERADOR PEGOU UMA PALAVRA FALTANDO NA LISTA DE PRESERVAR:** a anonimização comeu **`final`** (de `Total final (cartão XXXX)`) e o `totalFinalByCard` veio vazio. O script abortou em vez de gravar uma fixture que testaria outro documento — **é a terceira vez que essa trava se paga** (26/08 "PAGAMENTO", 31/08 os meses, hoje "final").

**⭐ O IMPORT QUE O DONO CONFIRMOU ENTROU FECHANDO:** 15 lançamentos · `5.119,53 − 12,54 = 5.106,99` ao centavo · os estornos são `CASHBACK ANUIDADE 12,50` e `AJUSTE CREDITO 0,04`.


### ⚠️⚠️ O SELETOR "SEM CATEGORIA" COM O DADO GRAVADO — NÃO REPRODUZI (17/09)

**O dono:** *"o painel mostra os 4 grupos certos, mas TODAS as linhas exibem o seletor em '— sem categoria —'. O value do `<select>` não está sendo hidratado."*

**⛔ MEDI AS QUATRO CAMADAS E TODAS ESTAVAM CERTAS:**
```
payload sem parâmetro     33 linhas · 33 com categoryId · 49 opções · 0 ids fora da lista
payload COM ?fatura=2026-09  idem  ← o caminho que a tela usa ao escolher a fatura
fonte no servidor         value={otimista[t.id] ?? t.categoryId ?? ''}
JS SERVIDO (minificado)   value: W[e.id] ?? e.categoryId ?? ""
```

⚠️⚠️ **E É POR ISSO QUE ESTA ENTRADA EXISTE: eu NÃO reproduzi o defeito, e não vou registrar conserto de bug que não vi quebrar.** A hipótese que sobra é **bundle velho no navegador** (a casa já pagou isso em 26/08: *"o navegador do dono guardou a página quebrada em cache; um hard-reload resolvia"*), mas **hipótese não é medição** — fica dito como hipótese.

⚠️ **UMA SONDA MINHA ERA FRACA E EU A REPORTEI COMO PROVA:** na volta anterior escrevi *"com categoryId no payload: 33 de 33"* — o teste era `'categoryId' in t`, que é **verdade mesmo com `null`**, e naquele momento as 33 estavam todas sem categoria. *Chave presente não é valor presente*, e eu apresentei isso como se fosse.

**⭐⭐ E O TEXTO DEDUROU O WIDGET — a volta seguinte fechou o cerco.** O dono: *"TODAS as 33 linhas mostram 'categoria salva: <certa>' e o `<select>` AO LADO continua em '— sem categoria —'"*. ⭐ **Foi o cinto que virou instrumento de diagnóstico:** ele matou a hipótese do bundle velho (o texto só existe no bundle novo) e isolou a falha no widget. ⚠️ Uma ressalva que eu devia: o texto lê `categoryName` direto do payload, então ele prova o NOME, não que o id case com alguma `<option>`.

**⛔ MEDIDO DE NOVO, E AS OPÇÕES TINHAM OS IDS:** contra o `dashboard.expenseCategories` (49) e contra o fallback de `/categorias` (262), **linhas com id fora da lista = 0 nas duas**. Então não é descasamento de id — a causa continua sem observação direta (a tela é cliente; não consigo o DOM dele).

**⭐⭐ O CONSERTO ENTÃO É POR CONSTRUÇÃO, nas duas suspeitas que o dono nomeou:**
1. **`key` carregando o valor** (`key={\`cat-${'${t.id}'}-${'${valor}'}\`}`) — React aplica `value` no nó; se no commit a lista de options ainda não tem aquele id, o browser cai na primeira opção, e **num commit seguinte, com o `value` IGUAL, React não reaplica** (só escreve prop que mudou). O nó fica preso em "sem categoria" com o dado certo por baixo. Com o valor no `key`, o nó é NOVO quando o valor chega — **não existe estado velho pra ficar preso**.
2. **`opcoesDoSeletor` garante a option da categoria salva**, mesmo que a lista venha curta, vazia ou de outra fonte. ⛔ *Value sem option é um select que não mostra nada.*

**⭐ E O GUARD RENDERIZA DE VERDADE** (`renderToStaticMarkup`, sem jsdom): pra cada uma das 33 linhas, a `<option selected>` tem que **existir** e carregar o **nome** da categoria — a separação que o dono fez (*"não basta o value bater"*). **REGRA 11: com a garantia removida, o markup volta `null` — exatamente o sintoma dele — 2 vermelhos.**

**O QUE FOI FEITO, e o que cada coisa é:**
- ⭐ **A regra saiu do JSX** pra `valorDoSeletor` (pura, testável). *Regra que mora num `value={...}` é regra que ninguém prova* — a lição do prefill do cardápio (28/08), que quebrou duas vezes antes de virar função. **REGRA 11: o binding ignorando o dado do servidor = vermelho.**
- ⭐⭐ **A categoria gravada passou a ser dita em TEXTO** na linha (*"categoria salva: EQUIPAMENTOS"*). ⛔ **Isto não é o conserto de um defeito que eu vi** — é a tela deixando de depender de **um widget só** pra afirmar o que o banco já sabe. Se o `<select>` falhar em hidratar por qualquer motivo, a linha continua dizendo a verdade.
- ⚠️ **Um guard de hoje foi REAPONTADO, não afrouxado** — ele afirmava o literal do `value` no JSX; a pergunta é a mesma, a resposta mudou de casa.

⭐ **E a tela do cartão tem UMA composição só** (uma `.map` de `linhasDaFatura`), então não há a segunda metade esquecida da entrada manual (16/09) — celular e desktop renderizam o mesmo DOM.


### ⛔⛔⛔ "CATEGORIA NÃO ENCONTRADA OU INATIVA" — DUAS FONTES E UMA PORTA FECHADA (17/09)

**O dono, tentando usar a maçaneta que eu tinha acabado de ligar:** *"escolho categoria na linha da fatura → 'Não consegui categorizar · Categoria não encontrada ou inativa'."*

**⛔⛔ DOIS BLOQUEIOS EM SÉRIE, os dois medidos em prod — e a aposta dele estava certa nos dois:**

```
o seletor oferece 260 categorias — 203 INATIVAS (78%) e 47 de RECEITA
   a rota valida isActive → quase 4 de cada 5 opções eram armadilha

a porta não alcança cartão:  bankAccount.companyId       → 0 linhas
                             businessCreditCard.companyId → 1
```

**1. DUAS FONTES.** A tela pedia `/categorias` **cru** e só tirava a fila `A_CLASSIFICAR`; a gravação exige `isActive`. Agora a lista nasce de `categoriasDestinoDespesa` e a rota valida por `whereCategoriaAceita` — **mesma origem**, com a invariante travada em teste: *o que a tela oferece é SUBCONJUNTO do que a gravação aceita, nunca o contrário*.

**⚠️⚠️ 2. E O SEGUNDO É ERRO MEU DA VOLTA ANTERIOR.** Reusei `/despesas/recategorizar` em nome da REGRA 4 e **não medi se ela abria pro caso novo**: ela filtra posse por `bankAccount: { companyId }`, e **compra de cartão nasce SEM conta bancária** (quem a prende à empresa é o `businessCreditCardId`). Mesmo com categoria válida, a resposta seria *"Nenhuma transação encontrada na empresa"*. ⭐ **A REGRA 4 tem duas metades — achar a porta única E provar que ela serve.** Metade dela é um bug com cara de disciplina. Fix: o filtro passa a aceitar `bankAccount` **OU** `businessCreditCard`. ⚠️ O resto da rota já tolerava (`accountType ?? null` na escada de status).

**⭐ 3. A RECUSA QUE SOBRA ENSINA** (a régua do tradutor 422 do estoque): em vez de *"Categoria não encontrada ou inativa"*, ela diz **o nome**, **o porquê** (inativa · de outra empresa · não existe mais) e **para onde ir**.

**⭐⭐ 4. O FEEDBACK DE SALVO — e o dono nomeou a classe:** *"silêncio depois do clique é o sucesso-disfarçado (ou o fracasso-disfarçado, como agora)"*. Não nasceu botão de confirmar (cada escolha grava na hora); nasceu **selo "salvo ✓"** na linha, o painel **Por categoria** atualizando na frente, e **a falha REVERTE** o seletor com o motivo do servidor. ⚠️ O `value` do select vem do `data`, que só muda no reload — sem o estado **otimista** ele voltava pra *"sem categoria"* na frente dele, que é o fracasso-disfarçado de novo.

**REGRA 11 — 4 defeitos repostos:** a porta voltando a exigir conta bancária (**1 vermelho**) · a mensagem genérica (**1**) · o valor sem sinal (**1**) · o gesto sumindo (**1**).


### ⛔⛔ A TELA DA FATURA — O SINAL, A MAÇANETA E O TOGGLE (17/09)

**⭐⭐ O ITEM 1 ERA DE VALOR, E A MEDIÇÃO O REBAIXOU DE CIRURGIA PRA DEPLOY.** O dono viu os 14 estornos listados POSITIVOS (`NETFLIX R$ 85,70`, `VIDAU R$ 1.052,42`) e perguntou o certo: *"perdeu no GRAVAR ou só na EXIBIÇÃO? A soma por categoria vai errar por 5.499,82 se o dado estiver positivo."*

**Medido antes de tocar em qualquer coisa:**
```
amount NEGATIVO no banco: 0   (a casa grava amount POSITIVO; o sinal é o type)
type=CREDIT: 14 · type=DEBIT: 19
Σ DEBIT 11.376,89 − Σ CREDIT 2.749,91 = 8.626,98
```
⭐ **O dado está certo** — é a convenção do módulo desde a Fase 2 — **e a agregação por categoria já usava `signedFaturaAmount`** (REGRA 6, 14/08), então **o erro de 5.499,82 que ele temia não existia**. O defeito era a linha imprimindo `formatBRL(amount)` sem olhar o tipo. ⚠️ **Nenhuma cirurgia.** *A diferença entre "o número está errado no banco" e "errado na tela" é a diferença entre mexer em dado real e um deploy* — e só se sabe medindo.

**O QUE MUDOU NA TELA:** estorno sai **`− R$ x` em verde** com o selo *estorno (crédito)*, e o cabeçalho mostra a **conta à vista**: `débitos − estornos = total`. Sem ela, uma lista com 14 créditos parece somar muito mais do que a fatura cobra.

**⭐⭐ ITEM 2 — A PORTA SEM MAÇANETA, DE NOVO:** as 33 linhas entraram sem categoria (decisão do dono) e **não havia onde decidir**. Agora: **seletor por linha**, **seleção múltipla** com barra fixa (*"categorizar as 15 como…"*) e a **sugestão da regra APRENDIDA** (`predictCategory`) só onde falta categoria — ⛔ determinística e barata, nada de chamada de IA numa rota de dashboard; e ela **sugere**, quem aplica é o clique.

⚠️ **REGRA 4 cumprida duas vezes:** grava pelo **`/despesas/recategorizar`**, a MESMA porta que o "mover em lote" desta tela já usava (inclusive pra UMA linha); e a lista de categorias vem do `expenseCats` que a tela **já carregava** — cheguei a pôr `expenseCategories` no payload do dashboard e **tirei** ao ver que era a segunda fonte.

**⭐ ITEM 3 — A LINHA VENCE O CARTÃO, POR CONSTRUÇÃO.** Varrido: `defaultTreatment` é lido **só no import** (pra SUGERIR a categoria de retirada) e pra exibir; **nenhum caminho reescreve `categoryId` de linha gravada** a partir do toggle. Então em fatura mista o toggle não é mentira — ele é o default, e a linha manda. Guard trava os dois lados: o `recategorizar` não pode passar a olhar o toggle, e o PATCH do cartão não pode escrever em `transaction`.

**REGRA 11 — 2 defeitos repostos na tela:** o valor sem sinal (**1 vermelho**) · o gesto de categorizar sumindo (**1**).

**⚠️⚠️ E A 1ª VERSÃO DO GUARD DO TOGGLE DEU FALSO VERMELHO — a janela de distância, pela quarta vez.** Eu procurei `defaultTreatment` seguido de `categoryId:` numa janela de 400 caracteres e mordi o `queries.ts`, onde o campo só é exibido e há um `categoryId` do mapa de categorias por perto. *Janela de distância já produziu falso vermelho e falso verde nesta casa* (o rastro em 12/09, o menu do PF em 13/09, o rodapé em 14/09). **O que morde é perguntar pelo ARQUIVO certo, não pela vizinhança.**


### ⛔⛔ ESTADO RESOLVIDO DISFARÇADO DE TRABALHO PENDENTE (17/09)

**O dono:** *"quando TODAS as linhas são duplicata, a tela continua parecendo um import pendente — tabela inteira, checkboxes, 'Confirmar e importar 0', nota pequena no rodapé. **Eu quase confirmei duas vezes achando que faltava algo.**"*

**⭐⭐ E A INFORMAÇÃO JÁ ESTAVA LÁ — cada linha vinha com o selo "duplicata".** Não adiantou: ***ninguém lê 33 selos pra concluir que não há nada a fazer.*** Quem conclui é a TELA. É o *"erro disfarçado de vazio"* de cabeça pra baixo — aqui é **estado resolvido com cara de trabalho pendente**, e o custo é o dono gravar duas vezes.

**O QUE MUDOU:**
- **Banner no topo** quando tudo é duplicata: *"Esta fatura já está importada (DD/MM) — nada novo pra entrar"* + **"Ver a fatura no cartão →"**. ⛔ Banner sem saída é só um aviso; o link é o que fecha o gesto.
- **Linha já-no-sistema vira LEITURA** — sem checkbox, cinza, selo *"já no sistema"*, tipo e categoria como texto. ⚠️ Oferecer seletor pra um lançamento que **não vai entrar** é a mesma mentira do botão que não faz nada.
- **⛔ O botão SOME quando não há linha marcada — `disabled` não basta.** Botão desabilitado continua dizendo *"é aqui que se conclui"*, e foi lendo *"Confirmar e importar 0"* que ele quase confirmou de novo.
- **Caso misto:** novas em cima (com checkbox), já-no-sistema embaixo, e o contador diz **"N nova(s) · M já no sistema"**.
- ⭐ **Quem decide o estado é a ROTA** (`jaNoSistema.todasDuplicatas`), não a tela varrendo linhas — senão nasce a segunda régua e ela diverge do `isDuplicate` no primeiro caso de borda.

**REGRA 11 — 3 defeitos repostos:** o botão voltando a `disabled` (**1 vermelho**) · o checkbox incondicional (**1**) · o banner apagado (**2**). O guard tem **auto-teste do detector** contra a tela antiga, senão passaria por cegueira — já aconteceu três vezes nesta casa.


### ⛔⛔ "A IA CLASSIFICOU ERRADO EM MASSA" — ERA A IDENTIDADE, NÃO A CLASSIFICAÇÃO (17/09)

**O dono, na tela de revisão:** *"as compras normais do bloco com sinal negativo (NETFLIX, IFD, VIDAU, ULTRAFARMA) vieram como estorno, só 14 de 33 marcadas, e o rodapé diz Compras R$ 0,00 · Total a importar −2.749,91. O sinal negativo ali é convenção DE SEÇÃO desse layout, não estorno."*

**⛔⛔ MEDI ANTES DE MEXER, E O DOCUMENTO CONTRADIZ A LEITURA DELE — as 14 linhas SÃO crédito.** Três totais impressos pelo próprio banco concordam:

```
Despesas / Débitos no Brasil  11.376,89 = só as POSITIVAS (as 19)
Pagamentos / Créditos         16.529,64 = pagamento 13.779,73 + 2.749,91 (as 14)
Saldo da fatura atual          8.626,98 = 13.779,73 − 16.529,64 + 11.376,89
```

⚠️ **E não existe "seção" pra usar como régua:** dentro do MESMO `HISTÓRICO DE TRANSAÇÕES` do `NR. 0115` convivem as linhas de 24-25/08 **negativas** e as de 02/09 **positivas**, sem nenhum cabeçalho separando. O único sinal que o documento dá é o sinal — e o bloco negativo é estorno de compras do ciclo anterior (uma delas se chama, literalmente, `ESTORNO IOF S/ TRANSAC NO EXTERIOR`; refund carrega o nome do lojista, por isso "NETFLIX" aparece ali).

**⛔ Reclassificar as 14 como compra quebraria os TRÊS totais** e a fatura pararia de fechar — depois de quatro rodadas pra fazer fechar. **Não reclassifiquei**, e é a mesma disciplina de 29/08: *evidência medida não se abandona por hipótese confortável*.

**⭐⭐ MAS O RELATO ERA REAL, E A CAUSA É DA FAMÍLIA MAIS CARA DESTE PROJETO: PREVIEW E CONFIRM DISCORDANDO.**

```
PREVIEW  computeIdentity({ …, type: 'DEBIT' })                         ← cravado
CONFIRM  computeIdentity({ …, type: kind === 'ESTORNO' ? 'CREDIT' : … })
```

Estorno gravado com hash de **CREDIT** nunca casa com o hash de **DEBIT** do preview → **o estorno aparece como "novo" pra sempre**. Medido contra a fatura real, com ela já importada:

| régua | duplicatas detectadas | a tela marcaria |
|---|---|---|
| velha (`DEBIT` cravado) | 19 de 33 | **14** ← o "14 de 33" do dono |
| nova (identidade única) | **33 de 33** | 0 |

E a fatura tem **exatamente 14 estornos** — o que a régua velha deixava escapar. *A classificação estava certa; o que divergia era a identidade.* É o mesmo defeito que custou o import de OFX (a tela dizia "N novas" e a gravação fazia outra coisa), e a cura é a mesma de lá: **uma função que as duas pontas chamam** (`identidadeDaLinha`), com **guard proibindo qualquer das rotas de calcular por conta própria** — foi a cópia que fez a divergência nascer.

**⭐ O RODAPÉ MOSTRAVA COMPRAS · ENCARGOS · TOTAL E ESCONDIA OS ESTORNOS.** Por isso o *"Compras R$ 0,00 · Total −2.749,91"* parecia mágica: o que reduzia o total era invisível. Agora são **quatro** colunas (com `Estornos (−)`) e, quando a soma não bate com a fatura, a tela **diz por quê** (*"a fatura fecha em R$ 8.626,98 · você marcou N de M lançamentos"*). ⚠️ *Número em tela de dinheiro sem régua é pior que ausência.*

⚠️ **E O DEFAULT JÁ MARCAVA TUDO QUE NÃO É DUPLICATA** — não havia o que consertar ali. As 14 apareciam marcadas porque a divergência as escondia da dedup. Com o conserto, **esta** fatura marca 0: ela já está importada.

**REGRA 11 — o `type: 'DEBIT'` reposto no preview: vermelho no guard.**


### ⭐⭐⭐ A FATURA DAS TRÊS RECUSAS FECHOU — E O GOLDEN VEIO DA QUARENTENA (17/09)

**Primeira vez que a régua nova roda inteira: quarentena → perícia → conserto → golden.** O texto é o que o motor leu **em produção** (registro `cmu4xpfv00064z0ci36uz0q8n`, cartão "Carter banrisul"), não um `pdftotext` meu e muito menos uma reconstrução.

**⭐ A PERÍCIA, contra o texto real — `cutCol = 68`:**
```
LIDO 11.358,89 × DECLARADO 11.376,89 · dif −18,00      (reproduzido ao centavo)
⛔ DESCARTADO  07/09   +18,00 BRASIL  [0123] ANUIDADEINT DIFER 05/12 0123   ← a dif
⛔ DESCARTADO  07/09   −18,00 ESTORNO [0123] DESC. ANUID. 0123 05/12
⛔ DESCARTADO  15/09 1.585,81 IOF     [—]    lixo do PAINEL de taxas
```

**As duas pistas do dono confirmadas no documento:** o bloco do `0123` aparece **2×** (cabeçalho `NR. 0123` na coluna direita da página de lançamentos **e** um bloco próprio com `US$ | R$`), e o par de anuidade mora nas linhas físicas **compartilhadas** com as compras do titular.

**⛔⛔ E "LER A DIREITA INTEIRA" NÃO ERA A CURA** — medido: inventa um **IOF de 1.585,81** colhido da tabela de taxas. *O corte existia por um motivo real; o que faltava era distinguir PAINEL de COLUNA.*

**⭐⭐ A CURA FOI MEDIDA NOS DOIS DOCUMENTOS ANTES DE TROCAR:**

| | fatura real (alvo 11.376,89) | golden PJ de agosto (alvo 13.797,73) |
|---|---|---|
| corte fixo (`cutCol`) | ⛔ 11.358,89 | ✅ bate |
| geometria por BANDAS | ✅ **11.376,89** | ✅ bate, número a número |

**As bandas não são troca de risco, são SUPERCONJUNTO** — então o que era *"a única coisa específica da PJ"* (onde cortar a coluna) **virou nada**, e some a segunda cópia da decisão *"onde a coluna termina"*. Um motor, dois documentos. ⚠️ E o que fez as bandas darem conta foi o trabalho de ontem no PF — a calha enxergando a geometria da TABELA e a apara perguntando se o que ia cortar é painel ou coluna. *O conserto estava no lugar errado; a peça, não.*

**REGRA 11 — o corte fixo reposto: 8 vermelhos**, 4 deles no golden novo.

**⭐ O GOLDEN:** `banrisul-pj-2-portadores.txt` no congelador (10 fixtures / 7 bancos), gerado por `scripts/gerar-fixture-banrisul-pj-2portadores.ts` — anonimização com trocas do **mesmo comprimento** (a geometria é o que está sob teste), preservando as palavras que o parser usa pra decidir, e **o script aborta se qualquer número, o banco reconhecido ou o comprimento de qualquer linha mudar**. ⚠️ O congelador confere só os DECLARADOS, então o teste próprio é que trava a soma das linhas — sem ele o −18,00 voltaria sem ninguém ver. Inclui **dois contrafactuais**: o corte fixo dando 11.358,89 e a direita crua inventando o IOF.

**⛔ A RECONSTRUÇÃO FOI APAGADA** (`banrisul-pf-dois-portadores`), como o dono determinou: *"a reconstrução sai da suíte quando o real entrar"*.


### ⛔⛔⛔ EU CONSERTEI O PARSER ERRADO DURAS RODADAS — A FATURA ENTRA PELA PORTA DA EMPRESA (16/09)

**O dono, na terceira recusa idêntica:** *"mesma dif −18,00 APÓS os consertos, e o número idêntico (11.358,89) prova que a RECONSTRUÇÃO não reproduzia o defeito real."*

**⭐⭐ ELE ESTAVA CERTO, E A PROVA ESTAVA NO NOME DO ERRO O TEMPO TODO.** Os rótulos **`V1 Σ Brasil`** e **`V4 Σ débitos = TOTAL DE GASTOS`** vivem em `lib/credit-card-pj/deterministic/validate-banrisul-fatura.ts` — **o validador do caminho PJ**. A fatura dele **nunca passou pelo parser PF**; entra por `/api/empresas/[id]/cartoes/[cardId]/importar-fatura/preview`, no cartão **"Carter banrisul"** (confirmado em prod: 5 cartões PJ, e as transações PJ com o padrão `MERCADOLIVRE*…` que ele citou).

⛔⛔ **E o parser PJ CORTA A COLUNA DIREITA POR DESENHO** — está escrito no arquivo: *"a defesa do parser PJ é CORTAR a direita fora"* (lá a direita é BanriClube/pontos/limites). **Se o histórico do portador adicional mora na direita, ele é jogado fora por construção.** Bate com o sintoma dele desde o começo: *lê o esquerdo, perde o direito*.

**⚠️⚠️ A LIÇÃO É SOBRE MIM, e é a mais cara da série:** eu tinha o rótulo `V1/V4` na mão desde a primeira mensagem e **não fui atrás de qual arquivo o imprime**. Consertei duas rodadas no parser **PF** — cotação, calha, apara, fatiador —, tudo medido, tudo verde, **e nada disso toca o caminho por onde a fatura dele entra**. *Conserto provado no lugar errado é tão inútil quanto conserto nenhum, e custa a confiança de quem esperou.*

**⛔⛔ POR QUE A QUARENTENA ESTAVA VAZIA: ela nasceu SÓ no caminho PF.** *"N caminhos, 1 esquecido"*, a doença que este projeto mais paga, agora entre **dois imports de fatura**. O caminho da empresa lançava `VALIDATION_FAILED` e **o texto morria no `throw`** — por isso diagnosticar exigia pedir o PDF de novo, e por isso eu passei a adivinhar.

**O QUE SUBIU (instrumento, não correção de parser):**
- **`CreditCardPjExtractError` carrega o TEXTO** que o motor leu, e a rota PJ guarda **toda tentativa** na quarentena — a recusada pra diagnosticar e **a que FECHA como o golden de amanhã**. Fail-soft.
- ⛔ **A correção do parser NÃO subiu junto, de propósito** — ver a regra abaixo. A cadeia de evidência é forte (rótulo ⇒ caminho PJ; parser PJ corta a direita; o dono leu no PDF que o 0123 está na direita), mas **falta o documento**, e é exatamente isso que a regra nova proíbe.

### ⛔⛔⛔ REGRA DE PROCESSO — CORREÇÃO DE PARSER SÓ COM O TEXTO REAL NA SUÍTE (16/09)

**Ditada pelo dono depois de duas rodadas perdidas, e vale pra sempre:**

> **Correção de parser só é aceita com o TEXTO REAL do caso na suíte (quarentena → teste). Reconstrução nunca mais vira prova.**

⚠️ **O que a reconstrução fez de mal:** ela **fechou** — 11.376,89 ao centavo — e isso me deu confiança de que o caso estava resolvido. Só que ela exercitava o parser **PF**, e o defeito vive no **PJ**. *Fixture que eu invento testa o mundo que eu imaginei; o documento testa o mundo que existe.*

⭐ **O corolário operacional:** quando a fatura recusar, **o primeiro movimento é abrir a quarentena**, não teorizar. E se a quarentena estiver vazia, a pergunta certa não é *"qual é o bug?"* — é **"por qual porta esse documento entrou?"**.

📋 **A reconstrução `banrisul-pf-dois-portadores` fica ATÉ o texto real entrar na suíte, e sai quando entrar** — foi o dono quem pôs o prazo, e ela não é golden nem entra no congelador.


### ⛔⛔⛔ O PORTADOR ADICIONAL SUMIA — A COLUNA DESCARTADA EM SILÊNCIO (16/09)

**O dono, com o PDF na mão:** *"a fatura tem DOIS PORTADORES (principal + adicional NR. 0123) e 'Débitos no Brasil' 11.376,89 = TOTAL principal 11.225,33 + TOTAL do 0123 151,56. O parser lê o lado esquerdo e o `DESC. ANUID. 0123 −18,00`, mas PERDE o `ANUIDADEINT DIFER 05/12 0123 +18,00` — a dif de −18,00 é exatamente ele."*

**⭐ E A ARITMÉTICA DELE FECHA A CAUSA SOZINHA.** O `DESC. ANUID.` é **crédito** (vai pro balde de estorno, fora das despesas) e o `ANUIDADEINT` é **débito** (entra em Brasil). Perder só o débito deixa `despesasCalculado` exatamente **18,00 curto** — que é o número que a conferência acusou. *As duas linhas existem e nenhuma se deduplica* (já era a trap 5 do núcleo).

**⛔⛔ O SINTOMA REFUTOU A MINHA PRIMEIRA HIPÓTESE.** Ele leu o lado **esquerdo** e perdeu o direito — isso **não é linha colada** (ali o motor leria o valor da direita e perderia o da esquerda, o oposto). É **corte por dentro**: a geometria de colunas descartando conteúdo.

**A PERÍCIA ACHOU TRÊS MECANISMOS DE DESCARTE, e nenhum gritava:**

| mecanismo | o que fazia |
|---|---|
| **a calha cega pra tabela** | a faixa em branco tem que existir em **TODAS** as linhas da página — então **uma única linha que atravessa as colunas** (cabeçalho do bloco, linha de totais, parágrafo de aviso) **apaga a divisão da página inteira**. A coluna do adicional deixava de existir |
| **a apara do dinheiro** | ela tira o painel de juros/pontos à direita do valor. Quando as colunas não foram separadas, a borda de valor é a da **esquerda**, e a apara cai **entre a data e o valor da direita**: a linha sobra **datada e sem dinheiro** → `nums.length === 0` → descartada calada |
| **banda com poucos lançamentos** | banda com menos de 2 linhas datadas era jogada fora inteira |

**AS DUAS CURAS (a terceira foi revertida — ver abaixo):**
1. **A geometria da tabela é definida pelas linhas da tabela.** O corte passa a ser procurado **também** só entre as linhas datadas. É a ideia do `INICIO_DOS_LANCAMENTOS` do Itaú sem depender de um rótulo que cada banco escreve com outras palavras: *quem define a coluna é o lançamento*. ⛔ E só **acrescenta** candidatos — cada um ainda passa pelo `LINHAS_PRA_SER_COLUNA`, que é o que impede data solta de inventar coluna.
2. **A apara pergunta se o que ela ia cortar é PAINEL ou COLUNA.** Painel tem números mas **nenhum lançamento**; coluna tem **data + descrição + valor**. Se o lado de fora tem lançamento, não se corta nada. ⚠️ O painel do Itaú não morde aqui: lá o valor da linha datada fica **antes** da apara.

**⚠️⚠️ E UMA CORREÇÃO MINHA FOI REVERTIDA POR NÃO MORDER — REGRA 11 cobrando de mim.** Eu tinha separado *"este corte é uma coluna?"* de *"vale ler esta banda?"* e baixado a segunda pra 1 linha datada, com um argumento bonito (*"coluna com uma compra também é coluna"*). Repondo o defeito, **o teste ficou VERDE**: quem entrega o caso é a apara, não ela. **Afrouxar um guard sem prova é trocar risco por nada** — o guard existe pra painel não virar lançamento. Revertida.

**REGRA 11 — 3 defeitos repostos:** a calha cega (**4 vermelhos**) · a apara cortando coluna (**1**) · e o terceiro **não mordeu e por isso não foi ao ar**.

**⭐⭐ A FIXTURE DE DOIS PORTADORES FECHA AO CENTAVO — 11.376,89.** Dois portadores reconhecidos · o V4 somando os **dois** `TOTAL DE GASTOS` · o par de anuidade inteiro (crédito no principal, débito no adicional) · cada linha marcada com o portador de quem gastou · `FECHA: true`.

⚠️⚠️ **MAS ELA É UMA RECONSTRUÇÃO, NÃO O PDF DELE — e isso está dito no arquivo e no nome.** O texto da fatura real nunca foi guardado (a quarentena subiu 20 min depois da tentativa); o que existe aqui é a **estrutura que ele descreveu** com os **números que ele mediu**. Ela trava a estrutura pra sempre; **não substitui o golden do documento real**, e o congelador não a lista — *o congelador é de PDF lido certo, e chamar reconstrução de golden diluiria o que a palavra significa*.

📋 **FALTA, E É UM CLIQUE:** subir a fatura de novo. Se a causa era um destes três mecanismos, ela fecha nos 11.376,89; se não era, **o texto fica na quarentena** e o diagnóstico sai sem pedir o PDF.


### ⛔⛔⛔ MOEDA ESTRANGEIRA — QUATRO JEITOS DE PERDER DINHEIRO CALADO (16/09)

**O dono, com a fatura recusando de novo:** *"a mesma dif −18,00 nos dois verificadores (o V4 agora confere igual, o conserto do latente pegou) — conserta a leitura NO PARSER DO BANRISUL, a classe inteira de linha em moeda estrangeira, não só esta."*

**⛔⛔ PRIMEIRO, A CORREÇÃO DE ROTA: A QUARENTENA ESTAVA VAZIA.** A migration fechou **01:49** e o app subiu **01:53**; a tentativa do dono é anterior. O texto da fatura de hoje **não existe em lugar nenhum** — e isso não é o mecanismo falhando, é ele tendo nascido depois do fato. ⚠️ Conferido no caminho, não suposto: o `guardarNaQuarentena` roda dentro do **`previewFaturaPF`**, antes do `return`, com `desfecho RECUSADA` — toda tentativa a partir de agora fica guardada.

**⭐ E UMA BRECHA REAL FECHADA NO CAMINHO:** o ramo *"banco não reconhecido"* retornava **antes** da quarentena. Era justo a recusa em que o documento mais importa (é dele que sai o parser que falta) e a única saída era pedir o PDF de novo — o buraco que a quarentena existe pra tapar. Agora guarda com `banco: 'DESCONHECIDO'`.

**⭐⭐ A CLASSE, MEDIDA NAS LINHAS REAIS DA FATURA — e ela perde dinheiro de QUATRO jeitos.** Numa compra internacional o Banrisul imprime a transação (`US$` + `R$`), o IOF, e uma linha **informativa** com a moeda de origem e a taxa (`JOD 49,95 TX DÓLAR R$ 5,2264`). A régua velha era *"linha que fala TX DÓLAR não é transação → pula a LINHA INTEIRA"*, e ela **só vale enquanto a cotação estiver sozinha na linha física**:

| linha REAL da fatura | o que o motor fazia |
|---|---|
| compra `617,00` │ cotação ao lado | lia **R$ 5,22** — a **TAXA** — e jogava em EXTERIOR |
| `IOF 0,06` │ cotação ao lado | **sumia** |
| cotação │ compra `559,42` | **sumia** |
| `IOF 9,62` │ `22/07 … 18,00` | lia **IOF 18,00** (o valor do vizinho) e **perdia a compra** |
| `06/07 … 347,50` │ `15/07 … 45,49` | lia **uma** transação de 45,49 e perdia **347,50** |

⚠️ **O primeiro é o pior: não falta LINHA, falta DINHEIRO dentro de uma linha que existe.** A conferência acusa a diferença e o dono sai procurando uma transação inteira que está lá, na cara dele. ⚠️ E repare na aritmética que produz o `5,22`: a taxa tem **4 casas** e o leitor de dinheiro casa `[\d.]+,\d{2}` — `5,2264` vira **5,22**, um número plausível com cara de valor.

**⭐ O GATILHO É A CALHA FALHANDO** — e ela **já falhou em documento real** (setembro, última página com 2 lançamentos na direita, registrado em 10/09). Quando falha, a página vira uma banda só e as duas colunas colam.

**AS DUAS RÉGUAS NOVAS, as duas no núcleo compartilhado:**
1. **`removerCotacaoInformativa`** — tira o FRAGMENTO, nunca a linha. Sobrou conteúdo? é transação. Não sobrou? era só a cotação. ⛔ O token da moeda só é comido quando é **alfabético** (`JOD`, `USD`): engolir `\S+` comeria o **valor da compra** que vem antes quando a fatura não imprime o token.
2. **`fatiarColunasColadas`** — backstop da calha: onde uma data de lançamento começa depois de **3+ espaços**, ali começa outra coluna. É o mesmo princípio da calha (*o documento diz onde ele se divide*), aplicado à linha. ⛔ **Conservadora de propósito:** a parcela `01/04` vem colada com UM espaço e por isso não parte nada — **inventar transação é pior que perder**, porque ninguém desconfia de um número a mais.

**⚠️ E O DIAGNÓSTICO DA PEÇA 4 QUASE ME MANDOU PRA PISTA FALSA — corrigido junto.** Ele apontou `JOD 18,00 TX DÓLAR R$ 5,2504` como candidata à diferença de −R$ 18,00. Aqueles `18,00` são **18 dinares** (≈ R$ 94,51), não 18 reais. A linha continua aparecendo (esconder seria pior), agora **marcada**: *"esta linha é de CÂMBIO — o número provavelmente está na moeda de origem, não em R$"*. **Coincidência de número não é evidência.**

**REGRA 11 — 2 defeitos repostos:** a cotação voltando a pular a linha inteira (**3 vermelhos**) · o fatiador removido (**2**).

**⭐ RED-THEN-GREEN DOS OUTROS BANCOS: os 9 goldens de 7 bancos VERDES** — o conserto do Banrisul não alcançou ninguém, que era a condição do dono.

⚠️ **DUAS FUNÇÕES DA QUARENTENA NASCERAM SEM CHAMADOR — uma corrigida, uma registrada:** o **expurgo de 12 meses** (LGPD) era promessa minha escrita e **nunca rodaria** — entrou no cron noturno do juiz, fail-soft (é a lição do E10: *planejado e não construído é pior que nenhum*). E o **`recusadasParaDiagnosticar`** (o leitor) **não tem tela**: hoje quem abre a quarentena sou eu, por script. Fica registrado como a maçaneta que falta — o dono não tem por onde olhar sozinho.

📋 **O QUE SÓ O DOCUMENTO FECHA:** a fatura de hoje **não importou** — o V1 (Σ Brasil 11.376,89 × 11.358,89) segue em aberto. A classe consertada **produz exatamente esse sintoma** (um único valor somindo de uma linha colada), mas afirmar que era ela sem o texto seria a hipótese confortável no lugar da medida — o erro que este doc já registra sobre mim em 29/08. **Subir a fatura de novo agora resolve as duas pontas: se a classe era a causa, ela fecha; se não, o texto fica na quarentena e eu diagnostico sem pedir o PDF.**


### ⭐⭐⭐ EXCLUIR RECEITA DE PRODUÇÃO — E O SERVIDOR DECIDE QUAL DOS DOIS CASOS É (16/09)

**A régua do dono:** receita **sem lote na história** → **exclui de vez** (*"rascunho que nasceu errado não merece cerimônia"*); **com lotes** → **DESATIVA**, e ***o passado não se reescreve*** — a mesma regra do fornecedor mesclado (11/09) e do item desativado (09/09).

**⛔⛔ A TRAVA MORA NO SERVIDOR, NÃO NA TELA.** A tela só **pergunta**: a prévia vem do servidor e o gesto **re-avalia dentro da transação**. Uma tela que decidisse mandaria o `DELETE` de uma receita com 40 lotes — é a régua do FREIO da contagem (23/08): *"aviso que vive no componente some no dia em que a rota for chamada por outro caminho"*.

**⭐⭐ E ELE RE-AVALIA POR UM MOTIVO REAL: a cozinha produz enquanto o dono lê o confirm.** Se o `DELETE` confiasse na prévia, apagaria uma receita que **acabou de ganhar história**. ⭐ E quando o desfecho **muda do que foi prometido**, a resposta **DIZ que mudou** (*"ganhou 1 lote enquanto você decidia — foi DESATIVADA em vez de excluída"*) — *fazer diferente do prometido e não avisar é a família do clique que gravou em silêncio (14/09)*.

**O QUE VAI JUNTO NA EXCLUSÃO, e o que NÃO vai:** somem ficha, versões, componentes e os mapas do PDV. ⭐ **O item-invólucro vai junto** — toda ficha cria um item pra nomear o que ela produz, e deixá-lo órfão poluiria o catálogo (foi item-invólucro esquecido que produziu as contagens fantasma da Coca). ⛔ **Mas com movimento ele FICA e só desativa**: movimento é ledger, e ledger é imutável. ⛔ **E o INSUMO nunca vai** — apagar a receita não apaga a carne.

**⚠️ O CONFIRM MOSTRA O EFEITO COLATERAL ANTES, NÃO DEPOIS:** *"⚠️ ela é ingrediente de: XIS COMPLETO, Combo Caçula — essas receitas ficam sem esse componente"* e *"N nomes do PDV apontam pra ela — a venda desses nomes para de baixar estoque"*. ⭐ **Sem digitar o nome pra confirmar** (decisão do dono: *"exagero pra cozinha"*) — o que segura é a frase dizendo **o efeito**, não a cerimônia.

**⛔⛔ E A VARREDURA ACHOU UM BURACO QUE TORNARIA O GESTO UMA MENTIRA: `listFichas` NÃO FILTRAVA `ativo`.** Ou seja, a receita desativada **continuaria aparecendo no planejar produção, no seletor de tarefas e na lista da cozinha** — e o confirm promete *"ela sai do planejar e do produzir"*. ***Desativar que não some de lugar nenhum é o mesmo que não desativar***, e promessa de tela que o dado não cumpre é como a confiança se perde. Agora o default é **só ativas**; `incluirInativas` existe pro toggle explícito de histórico.

**⚠️ UM GUARD DE SETEMBRO FOI REAPONTADO SEM PERDER A PROVA:** o `ficha-arquivada-fora-da-busca` existia pra provar que **a TELA filtra** (`ehReceitaDeProducao` carrega o `ativo` por dentro), e o comentário dele dizia *"um `.filter(f => f.ativo)` aqui esconderia que a tela não filtra"*. Com o servidor filtrando também, a cena passou a ser montada com `incluirInativas` e **as duas camadas ficaram provadas** — cinto **e** suspensório.

**PROVADO EM PROD, NOS DOIS VIEWPORTS (REGRA 12), no bundle servido:**
```
CELULAR lista  ✓ botão · ✓ vermelho discreto (não é hover) · ✓ o confirm
CELULAR editar ✓ · DESKTOP lista ✓ · DESKTOP editar ✓

NO DADO REAL DA CAÇULA — 165 receitas:
  38 seriam DESATIVADAS · 127 seriam EXCLUÍDAS (nunca produzidas)
  "beef de xis" → DESATIVA · 13 lotes
     ⚠️ "é ingrediente de: XIS COMPLETO, Combo Caçula, XIS - COMPLETO"
  "CUBA MAIONESE" → DESATIVA · 10 lotes
     ⚠️ "é ingrediente de: POÇAO MAIONESE 30G, ENCHER TUBO MAIONESE"
⛔ nada foi excluído na prova — só a prévia, que é leitura
```
**REGRA 11 — 3 defeitos repostos:** a receita COM história voltando a ser apagada (**2 vermelhos**) · a SEM história virando desativação (**3**) · a desativada voltando pro planejar (**2**).

**10.178 verdes · TS 0 · deploy `i1VgMzogxnj5wLhFXU7aC` 4/4.**

📋 **FICA PRO DONO (REGRA 2):** criar a receita de teste, excluir (some de vez), e tentar excluir uma com história pra ver o confirm virar desativação.


### ⛔⛔⛔ CADA GESTO TEM SEU UNIVERSO DE SELETOR (16/09)

**O dono, fazendo a entrada manual da compra do fermento:** *"na hora de escolher o produto a lista traz coisa de CARDÁPIO (fichas) e coisa de PRODUÇÃO — e não acho direito os itens de ESTOQUE que aparecem na Posição."*

**⛔ A CAUSA, numa linha:** `/api/.../estoque/itens` **sem parâmetro** devolvia `{ companyId, ativo: true }` — **TUDO**, inclusive os invólucros de `SABOR` e `PRODUTO_FINAL` que existem só pra dar nome a uma linha do cardápio. ⚠️ **O default silencioso era o veneno:** quem esquecia o recorte não via erro nenhum — via uma lista **plausível e errada**.

**A RÉGUA, registrada:** ***compra NUNCA aponta pra ficha de cardápio nem pra tarefa de produção.*** Cada seletor com o WHERE do seu gesto, e **o universo é contrato obrigatório** — a rota recusa com **400 que ensina**, e o helper o carrega **no TIPO**: chamador que não declara **não compila**.

**⚠️⚠️ E A VARREDURA ACHOU QUE NÃO É UM UNIVERSO SÓ — SÃO DOIS, e a diferença é real.** O dono listou, pra compra, *"matéria-prima, insumo, revenda, embalagem"* — **sem intermediário**, e está certo: **ninguém COMPRA "porção de carne 100g"**, ela se produz. Mas ela **se conta** (está na câmara) e **se perde** (cai no chão). Um universo só poria porção na lista de compra **ou** tiraria porção da contagem — os dois errados.

| universo | gesto | o que entra |
|---|---|---|
| **COMPRAVEL** | entrada manual, nota | matéria-prima · revenda · embalagem · limpeza · uso interno |
| **PRATELEIRA** | contagem, saída/perda | os de cima **+ intermediário** |
| **RECEITA** | componente de ficha | matéria-prima · intermediário · produto final · revenda · embalagem |
| **VENDAVEL** | mapa do PDV | produto final · sabor · revenda |
| **CATALOGO** | a lista administrativa | tudo — **e o nome diz isso** |

**A VARREDURA DOS CHAMADORES (item 1 do pedido):** dos 17 que tocam a rota, **só 4 LISTAM** — o resto é `PATCH`/`POST` ou `href`. Os defeitos reais eram **dois**: a **entrada manual** e a **saída/perda**. O seletor de ficha já declarava (`escopo=receita`, 27/08) e o hub já filtrava `categoria=REVENDA`.

**⭐ E O TOGGLE "mostrar tudo" DO EDITOR DE FICHA É UMA DECLARAÇÃO**, não uma exceção: o dono está dizendo, com o dedo, que quer o catálogo naquele momento. O que deixou de existir é o universo **que ninguém escolheu**.

**⭐ O VAZIO PASSOU A DIZER O RECORTE:** *"Nada com «xis» entre os itens que se COMPRAM"*. ⛔ *"Nenhum item encontrado"* faria o dono achar que o item não existe, quando ele só não pertence àquele gesto — **vazio que não diz o recorte é a ausência fingindo verdade**.

**⚠️⚠️ O TESTE POR GESTO PEGOU UM DEFEITO MEU NA HORA:** eu escrevi `RECEITA = [...COMPRAVEL, INTERMEDIARIO]` por conveniência e **arrastei LIMPEZA junto** — quebrando a régua de 27/08 (*"o editor oferecia DESENGRAXANTE, SACO DE LIXO e JAPONA DE CÂMARA como ingrediente de lanche"*). **Universo se escreve item a item**; derivar um do outro é como a régua de um gesto vaza pro outro.

**⭐⭐ E HÁ TESTE PROVANDO QUE PRATELEIRA == `seContaFisicamente`**, item a item. Aqui a régua é uma **LISTA** (vira `where`, não atravessa a query) e lá é uma **FUNÇÃO** — sem o teste, as duas divergiriam no primeiro tipo novo, que é exatamente como o B1 se perdeu.

**⚠️⚠️ REGRA 11 — 3 defeitos repostos, e o PRIMEIRO VEIO VERDE:** trocar o universo da entrada manual pra `CATALOGO` deixou **515 testes verdes**, porque os meus chamavam `listar(universo)` direto e **nenhum lia o que a TELA declara**. ***Guard que testa a lib aprova a tela que ignora a lib*** — a mesma lição de 14/09 (o modal) e 13/09 (o card do PJBANK). Com o bloco novo (*"cada TELA declara o universo do SEU gesto"*), o defeito fica vermelho. Os outros dois morderam de primeira: `PRODUTO_FINAL` voltando pra compra (**5 vermelhos**) e a PRATELEIRA deixando de concordar com a função (**2**).

**⚠️ E UM VERMELHO PRÉ-EXISTENTE FOI DIAGNOSTICADO EM VEZ DE ROTULADO** (a régua de 01/09): o rastro de vencimento ordenava só por `criadoEm`, e dois eventos gravados **no mesmo milissegundo** saíam em ordem arbitrária — às vezes `BOLETO` primeiro, às vezes `DONO`. **É a cicatriz do juiz de saldo de 28/08** (*"ordenar só por `anchorDate` deixava o desempate arbitrário"*), que lá custou dois alarmes de ±3.026,31 que se cancelavam. **Timestamp sozinho não é ordem total** — desempate por `id`, estável em 3 rodadas.

**⚠️⚠️ E A PROVA EM PROD ACHOU A SEGUNDA METADE DA QUEIXA — o universo certo não bastava.** Medido: o universo da compra tem **152 itens**, a rota devolve no máximo **50** (`slice(0, 50)`), e o **`fermento` NÃO estava entre os 50 primeiros** — a lista alfabética parava em *"COPOS PS 150ML"*. Ou seja: **mesmo com o recorte certo, o item nunca chegava ao navegador**, e a tela filtrava **no CLIENTE** sobre a lista já truncada.

⭐ **É a doença de 28/08 por outra porta** — e o comentário da própria rota já a documentava: *"o `take` passa a valer DEPOIS de filtrar; antes, 50 itens eram lidos e só então a busca acontecia, então item fora das 50 sumia"*. **A correção daquele dia valeu pra busca NO SERVIDOR; esta tela buscava no cliente.**

**O `<select>` de 50 virou o `BuscaItem`** — o seletor único da casa (o de 14/09, *"definir ficha me expulsa da tela"*), que busca no servidor e mostra o custo médio. ⭐ E o `universo` virou **prop obrigatória** dele: o *"não compila"* achou **2 chamadores** que eu não tinha tocado — o **DANFE digitado** (que é COMPRA) e o **editor de ficha** (RECEITA).

**⚠️⚠️ E A PROVA NO CELULAR PEGOU O FIX PELA METADE — REGRA 12 cobrando.** A entrada manual tem **duas composições** (tabela no desktop, cards no celular) e eu troquei **só a de cima**. **O dono opera no celular** — o conserto teria passado **ao lado do caso que motivou o sprint**. O guard agora conta os `<select>` de catálogo e exige **zero nos dois viewports**.

**10.167 verdes · TS 0 · deploys `hSHk9o85aeSpk6Z6KKP3A`, `ezU4mxIgKczgGLLzHxQml` e o do celular, todos 4/4 · Δ bundle −96 KB.**


### ⛔⛔⛔ "NÃO CONSEGUI GRAVAR A CONTAGEM" — O ERRO SEM MOTIVO, E A CAUSA QUE NÃO ERA A SUSPEITA (16/09)

**⭐ A HIPÓTESE DO DONO CAIU NA MEDIÇÃO, e isso mudou a resposta inteira.** Ele apostou em *"unidade UN-inteira recusando decimal"* e perguntou se o reunitizar resolvia. Medido por id: o item **`fermento` JÁ É KG** (`cmttb7w1p0003o9db38fdqthf`) — **a unidade está certa e o reunitizar não tem o que fazer**. Mandá-lo reunitizar seria mandá-lo consertar o campo errado.

**⛔ A CAUSA REAL, achada no log de prod:**
```
Error [MovementInvalidError]: Este movimento deixaria o item com 10 unidade(s) e valor
R$ -31.04 — dinheiro negativo com saldo positivo é um estado que não existe.
```
É o **guard estrutural de 11/09** funcionando. O fermento está com **saldo −1,921 e valor −R$ 31,04**, e contar 10 kg (a quantidade **CERTA** — é o que está na prateleira) cruza o zero com o valor ainda negativo.

**A HISTÓRIA, lida no ledger:** em 10-11/09 saíram **21,24 kg de produção a custo ZERO** — *antes de qualquer nota*. Em 11/09 a NF trouxe **1,5 kg a R$ 62,28**, e um **AJUSTE_CONTAGEM de +21,24 entrou a custo ZERO**. As separações seguintes saíram a **62,28/62,22** (o custo da nota, não o médio diluído) e drenaram R$ 124,46 com 2 kg. ⭐ **A compra que nunca foi registrada é o buraco.**

**⛔⛔ E O SEGUNDO DEFEITO É O QUE O DONO NOMEOU: A FRASE EXISTIA E NINGUÉM A ENTREGAVA.** O `MovementInvalidError` **não é `ContagemError`** → caía no **`throw e`** do catch da rota → **500 sem corpo** → o cliente fazia `j.erro ?? 'Não consegui gravar a contagem.'` e o `??` só cai no fallback **quando o servidor não manda nada**. ⚠️ **Eram 52 `throw e` nas rotas de estoque** — cada um é um 500 mudo esperando a vez.

**⭐⭐ A CURA É UM TRADUTOR ÚNICO** (`lib/stock/erro-da-tela.ts`, REGRA 5): erro de domínio vira **422 com a mensagem**; o que ninguém previu **continua 500** — *ali o genérico é honesto, e inventar frase amigável pra bug desconhecido esconde o bug*. ⚠️ A lista é **FECHADA** de propósito: `e instanceof Error` pegaria `TypeError` e erro do Prisma, cujas mensagens são pra MIM, não pro dono.

**⭐⭐ E A RECUSA CARREGA A SAÍDA** — *"recusa ensina a saída"*, a régua que o 409 do fornecedor já cumpria. O 422 agora devolve `{ erro, code, saida: { rotulo, href } }` e a tela desenha o link do gesto.

**⚠️⚠️ A MENSAGEM APONTAVA O CAMPO ERRADO, e isso foi corrigido junto.** Ela dizia sempre *"confira a quantidade (ela costuma ser o sintoma)"*. Agora ela separa pelos fatos: **saldo que CRUZA o zero** → *"o saldo estava em −1,92 (saiu mais do que entrou), então falta registrar a COMPRA que não foi lançada — **não é a sua contagem que está errada**"*; saldo que já era positivo → aí sim a quantidade é a suspeita.

**PROVADO EM PROD, na rota REAL com a sessão do dono:**
```
POST /estoque/contagem/linha  { itemId: fermento, qtdContada: 10 }  →  HTTP 422
{
  "erro": "… valor R$ -31.04 — dinheiro negativo com saldo positivo é um estado que
           não existe. O saldo estava em -1.92 (saiu mais do que entrou), então falta
           registrar a COMPRA que não foi lançada — não é a sua contagem que está errada.",
  "code": "ESTADO_IMPOSSIVEL",
  "saida": { "rotulo": "ver o histórico deste item e corrigir a entrada que faltou", "href": "…" }
}
⭐ 422 (não 500) ✓ · tem MOTIVO ✓ · tem SAÍDA ✓ · nada gravou ✓
```

**⚠️⚠️ REGRA 11 — 3 defeitos repostos, e o PRIMEIRO VEIO VERDE: a "menção, não uso" pela TERCEIRA VEZ EM TRÊS DIAS.** Repondo o `throw e` mudo na rota, o guard passou — porque a linha do **`import`** já casava com `toContain('respostaDeErroDoEstoque')`. É o mesmo defeito do `acaoValePraSentido` (15/09) e do `MELHOR PALPITE` no comentário (16/09). **O padrão virou helper (`usosDe`), não lembrança.** Os outros dois morderam de primeira (o fallback genérico de volta na tela; o guard do estado impossível removido).

**⚠️ E UM GUARD DE 11/09 PASSAVA POR VACUIDADE:** ele era `try/catch` **sem `expect.fail()`** — se `criarMovimento` não lançasse, o catch nunca rodava e o teste ficava verde **sem asserção nenhuma**. Corrigido junto, e reapontado pra a frase nova.

**10.145 verdes · TS 0 · deploy `u-aKjqpYYvzuR_JSkCG3L` 4/4 · Δ bundle +0 KB.**

📋 **A DECISÃO É DO DONO — e eu NÃO gravei nada** (preview read-only, a régua de sempre):
- **(a)** se **houve compra sem nota**, o gesto é **entrada manual** do fermento. ⚠️ Pra zerar o valor negativo bastariam **0,498 kg a R$ 62,28**, mas **a quantidade é a que ele comprou de verdade** — *saldo não se chuta*. Feito isso, contar 10 kg grava normal (há teste provando exatamente essa sequência).
- **(b)** se **não houve compra** (o consumo é que foi lançado a mais), o caminho é **estornar as separações erradas** — e aí ele precisa dizer **quais**.


### ⭐⭐⭐ A CAIXA DE ENTRADA NO DESENHO DO MOCK v3 — O CARTÃO ≍ (16/09)

**O dono:** *"mesma tela, mesmos motores, ROUPA nova — nenhuma régua de negócio muda."* Mock aprovado em `docs/mocks/conciliacao-caixa-mock-v3.html`, **versionado e lido pelo guard** (`caixa-bate-com-o-mock-v3.test.ts`): 17 tokens do `:root{}`, 10 medidas e as frases que o arquivo imprime. *Divergência do mock = defeito.*

**⭐⭐ O CARTÃO ≍ (padrão Xero):** à esquerda **O BANCO DIZ** (chip do banco, memo, data, valor gigante — coral débito, verde crédito), no meio o conector, à direita **MELHOR PALPITE** com a **diferença SEMPRE nomeada** e o botão que diz **o efeito** (*"✓ Confirmar — baixa a fatura"*). Sem palpite, o lado direito abre direto nos chips — *ausência de palpite não pode virar linha morta*. Mais: anel do mês, abas segmented, faixa verde com o selo do COMO, e o **inbox zero** do mock.

**⛔⛔ ZERO MATCHER NOVO — e é o ponto.** `palpite-da-linha.ts` é **puro**: ele **escolhe e traduz** o que os motores provados devolveram (`mesQueBateOValor` do cartão · `sugerirVinculoEmprestimo` · `sugerirVinculos`). Um matcher próprio seria a **segunda régua** — *a tela não pode achar um par que o servidor recusa*.

**⛔ E O EMPATE NÃO ESCOLHE NO ESCURO:** dois candidatos igualmente bons devolvem **nenhum palpite**. *"Não sei qual é"* é resposta — a trava do PAO DE MEL.

**⚠️⚠️ E ELA SE PAGOU NA PRIMEIRA PROVA EM PROD, com uma lição de CONTRATO.** Eu liguei o palpite do cartão no `resolvePaidInvoiceMonth`, e ele devolveu **`2026-08` pros QUATRO cartões da Caçula** com a linha de R$ 3.194,35 — sendo que nenhum tem fatura desse valor (os nets são 13.779,73 · 7.305,55 · 8.094,78 · 2.666,44). **Por quê:** aquela função tem **fallback pra fatura mais recente**, e ele é **CERTO no contrato dela** — *"o dono JÁ disse que este pagamento é deste cartão; qual competência ele quita?"*. A minha pergunta era outra: *"este pagamento é de ALGUM cartão?"* — e aí o fallback é veneno. **Nasceu `mesQueBateOValor` (sem fallback), com a tolerância extraída pra um lugar só.** ⭐ **Quem segurou o estrago foi a trava do empate** (4 candidatos ALTA empatados → nenhum palpite); sem ela a tela poria um botão verde gigante *"baixa a fatura"* sobre o cartão errado. **Depender disso seria depender de sorte** — a régua certa é não usar motor fora do contrato dele.

**⚠️ SEGUNDO DEFEITO DA MESMA PROVA: o anel dava 100% com trabalho na caixa.** 220 no arquivo e **1 na caixa** = 99,5%, que arredondava pra **100%** — a tela fechando o anel com o dono ainda tendo o que fazer. *Tela que se parabeniza cedo ensina o dono a não olhar o número.* **100% é reservado pro inbox zero**; com linha na caixa o teto é 99.

**⭐ O RESTO DA COMPOSIÇÃO:** os 3 stats viraram **cards-filtro** (hover levanta, ativo com borda roxa) — ⚠️ e viraram `<button>`, não `<div>`: *elemento clicável que não é botão perde teclado e leitor de tela*. Os cards de fornecedor ganharam **avatar** e **pílula de estado**; ⛔ o comportamento não mudou — continua UM card por fornecedor, fechado, uma linha por vez (a trava que impede dois cards disputarem as MESMAS notas, o caso Cancian).

**⚠️⚠️ REGRA 11 REPROVOU O GUARD NOVO — a "menção, não uso" de novo, dois dias seguidos.** Repondo o defeito (apagar `MELHOR PALPITE` do JSX) ele ficou **VERDE**, porque a frase também aparece no **comentário** do arquivo. Agora ele lê a tela **sem comentário**. E o conector passou a ser conferido pelo **uso do token** (`{CONECTOR}`), não pelo glifo solto — escrever `≍` à mão seria a segunda cópia do valor.

**⚠️ 6 ASSERÇÕES DO GUARD DE 10/09 FORAM REAPONTADAS, nenhuma apagada:** o v3 redesenhou os stats (raio, fonte, tokens) e o cabeçalho do card de fornecedor. ⭐ Uma delas merece nota: o mock antigo indicava "isto abre" com a **seta ▶ girando**; o v3 troca por **texto** (*"abrir o caso →"* / *"fechar o caso"*), o que é **mais forte** — a seta exigia interpretar um glifo, o texto DIZ o que acontece, e o `aria-expanded` segue carregando o estado.

**⛔ REGRA DE NEGÓCIO: ZERO MUDANÇA.** Degraus, contenção, corte de época, uma-linha-uma-estação — intocados. **A suíte E2E das 9 linhas passou SEM UMA EDIÇÃO**, que era a condição que o dono pôs.

**PROVADO EM PROD, NOS DOIS VIEWPORTS (REGRA 12), no bundle servido:**
```
CELULAR /conciliacao 1.063 KB        DESKTOP 1.063 KB
  ✓ título · ✓ O BANCO DIZ · ✓ MELHOR PALPITE · ✓ OU ESCOLHA OUTRO CAMINHO
  ✓ 🎉 inbox zero · ✓ "resolvida agora" · ✓ o anel · ✓ min-[900px] (empilha)
  ✓ tokens do mock: roxo · verde · coral · âmbar-bg

A ROTA: SAÍDAS 1 · ENTRADAS 0 · ARQUIVO 220 · TOTAL 221 · Σ fecha ✓
        anel 99% — "220 resolvidas · 1 na caixa" · corte 01/09
```
**REGRA 11 — 4 desvios repostos, 1 vermelho cada:** o tom do verde trocado · o conector virando `=` · o inbox zero sumindo · `MELHOR PALPITE` sumindo (este só mordeu **depois** do aperto).

**10.124 verdes · TS 0 · deploys `zGH_tUpi2QINT9Zvsi2l0` e o do fix, os dois 4/4 · Δ bundle +4 KB.**

⚠️ **DUAS COISAS REGISTRADAS, NÃO ESCONDIDAS:**
1. **O red-then-green do dono não acontece com o dado de hoje:** a linha `DEB.CTA.FATURA` de R$ 3.194,35 **não tem fatura correspondente em nenhum dos 4 cartões** — a de setembro ainda não foi importada. Ela aparece no cartão ≍ **sem palpite**, com os 6 chips do sentido, que é o comportamento honesto. Assim que a fatura entrar, o palpite acende sozinho.
2. **Dois mocks convivem na mesma tela:** o v3 governa a caixa, os stats e o cabeçalho do card de fornecedor; o mock de 10/09 continua governando **o interior do card** (as caixinhas de nota, o rodapé sticky), que o v3 não redesenhou. Enquanto for assim, o verde/coral dos dois é um tom diferente. **É o preço de "igual ao mock" com dois mocks aprovados** — o dia em que o dono pedir, o v3 absorve o interior e o arquivo de tokens vira um só.


### 🧹 A FAXINA DO PENDENTES — O QUE MORRE, O QUE FICA, E A VIGILÂNCIA QUE MUDA DE RÉGUA (15/09)

**A regra que o dono ditou:** ***o que era DA TELA morre; o que é DO DOMÍNIO fica.*** O conceito *"linha sem destino"* continua existindo — dentro da caixa. Só a **TELA** morreu.

**⛔ O QUE O INVENTÁRIO ACHOU ANTES DE APAGAR — e o achado é o item de menu.** O `pendentes-client.tsx` tinha sido deletado na entrega das estações, mas **o item "Pendentes" continuava na sidebar, com badge âmbar**, apontando pra uma rota que só redireciona. *É a "porta sem maçaneta" ao contrário: a maçaneta sem a porta.*

**MORRERAM (tela, 0 chamadores):** o item da sidebar · `VincularTransferenciaModal` **e a rota `/api/transferencias/candidatas/[id]` que só ele usava** (a capacidade vive em `/parear`, com o motor único, pra onde a caixa deep-linka) · `SugestaoDeVinculoBanner` (virou o menu `CASAR_PAGAR`) · `lib/pendentes/row-actions` · `/api/conciliacao/sugestoes-pendentes` (**zero fetch no repo inteiro**).

**⚠️ E EU ERREI UMA CLASSIFICAÇÃO NO MEIO DA FAXINA:** apaguei o `SourceBadge` como "órfão" — ele tinha **2 chamadores**, e os dois eram justamente as capacidades que o dono mandou guardar. **Restaurado no mesmo passo.** *Órfão de segundo grau não é órfão: é peça de quem está guardado.*

**⚠️⚠️ FICARAM COM SELO DE DÍVIDA (decisão do dono: *"guardar e registrar"*) — 4 arquivos SEM chamador, de propósito:** `AutoCategorizePreviewModal` (auto-categorizar em lote com prévia) · `VendorSuggestionBanner` (o selo *"sugerido por IA"* com a fonte) · `AprenderEAplicarModal` (criar regra aprendida ao categorizar — o ciclo que este doc registra como **nunca provado E2E**) · `SourceBadge`. **A caixa não tem nenhuma das três**, e *"remoção sem realocação é perda"*. Cada arquivo abre com o selo **`CAPACIDADE GUARDADA — NÃO É LIXO, É DÍVIDA REGISTRADA`**, e há guard exigindo que o selo continue lá: sem ele, a próxima faxina trata como lixo.

**⭐ O REDIRECT FICA, MARCADO:** `/pendentes` e `/empresas/:id/pendentes` abrem com **`ROTA LEGADA, REDIRECT PERMANENTE`**. *Link velho em e-mail, no histórico ou num print não pode virar 404 — redirect de uma linha não é lixo, é cortesia.*

**⭐⭐ A VIGILÂNCIA FOI REAPONTADA, NÃO APAGADA — e a régua mudou de lado.** O badge contava `NEEDS_REVIEW` (*"linha sem CATEGORIA, desde sempre"*). Agora conta o que a **CAIXA** tem esperando decisão — o que **inclui o crédito que a régua velha nunca olhou** e **exclui** o que já foi resolvido por qualquer caminho.

**⛔ E ELE NÃO SOMA COM OS VÍNCULOS, de propósito:** `conciliacao.pendentes` conta **CONTAS a pagar** com par sugerido; `conciliacao.caixa` conta **LINHAS do extrato** sem destino. Casar uma linha com uma conta **apaga as duas de uma vez** — somar seria a **dupla contagem** que esta casa combate desde o cabeçalho dos *"69 duplicatas"* (07/09). Os vínculos seguem visíveis nos **3 stats do topo da tela**.

**⭐⭐ E A LEITURA DA CAIXA GANHOU DONO ÚNICO** (`lib/conciliacao/leitura-da-caixa.ts`): a **rota** e o **badge** chamam a MESMA função, com o MESMO recorte — corte de época e teto de 400 inclusive. ⚠️ Sem isso o badge teria consulta própria, que é **exatamente** como o menu passou meses dizendo um número e a tela outro (10/09: o badge contava os pares 1:1 **sem os lotes**). *Badge com teto diferente da tela é a divergência de novo, com outra roupa.*

**⚠️ 6 GUARDS ANTIGOS FICARAM VERMELHOS COM A FAXINA CERTA — todos REAPONTADOS, nenhum apagado:** o filtro de data (×2, o corte mudou pra a leitura única) · o payload do badge (`transacoesPendentes` → `conciliacao.caixa`) · a lista de callers do `NEEDS_REVIEW` (o badges saiu, com o porquê) · o `owner-detection` (a rota `/candidatas` morreu com o modal) · o gate do PF (o item não existe mais pra esconder).

**PROVADO EM PROD, NAVEGANDO, NOS DOIS VIEWPORTS:**
```
DEEP-LINKS VELHOS   /pendentes → 307 → /conciliacao      (celular e desktop)
                    /empresas/:id/pendentes → 307 → select-and-redirect
ROTAS APAGADAS      sugestoes-pendentes → 404 ✓ · candidatas/[id] → 404 ✓   (não 500)
O MENU (no bundle)  item "Pendentes"? ✓ não · href "/pendentes"? ✓ não   (nos dois)
O BADGE             conciliacao = {"pendentes":0,"caixa":1}
                    campo velho "transacoesPendentes": ✓ não existe mais
                    ⭐ badge (1) == caixa saídas+entradas (1) — MESMA leitura
```
**GUARD NOVO — `rota-morta-nao-volta-pro-menu.test.ts`, e ele prova OS DOIS LADOS:** o item **não pode renascer** em nenhuma sidebar (detector que ignora comentário, senão morderia a documentação do próprio defeito) · o **redirect tem que continuar vivo e dizer que é legado** · os apagados continuam apagados · e as 4 guardadas continuam existindo **com o selo**. Rota aposentada nova entra na lista `ROTAS_APOSENTADAS`. **REGRA 11: repondo o item no menu, vermelho na hora; auto-teste do detector nos 4 sentidos** (template literal, aspas, comentário, rota de nome parecido).

**10.071 verdes · TS 0 · deploy 4/4 (`-gbCQ43EO4DtoIJqI5Gva`) · Δ chunks vs deploy anterior: +0 KB** (faxina não engorda bundle — a série de performance já mostrando serviço).

⚠️ **RESSALVA NOMEADA, não escondida:** o badge agora mede a CAIXA, então **conta a pagar com par pronto cuja linha já foi categorizada** não acende o badge (a linha saiu da caixa, a conta segue esperando). É a fronteira de 07/09 (*"ter categoria não quita conta nenhuma"*) aparecendo no contador. Ela fica **visível nos 3 stats do topo** quando o dono abre a tela; se incomodar, a saída é o badge mostrar os dois números lado a lado — não somá-los.


### ⭐⭐⭐ O EXTRATO EM 3 ESTAÇÕES — O PENDENTES MORRE COMO TELA (15/09)

**O desenho aprovado pelo dono, depois do estudo de QuickBooks/Conta Azul/Organizze:** ***o SENTIDO decide o menu, o menu decide a fila.*** **ESTAÇÃO 1 — IMPORT** (o portão; resolve só o automático) → **ESTAÇÃO 2 — CAIXA DE ENTRADA** (o balcão único, duas abas) → **ESTAÇÃO 3 — MOVIMENTAÇÕES** (o arquivo, com o selo de COMO).

**⛔⛔⛔ O BURACO, MEDIDO EM PROD ANTES DE CODAR:** o `LINHA_DISPONIVEL_WHERE` filtrava **onze coisas** (cartão, empréstimo, transferência, ignorada…) e **não filtrava SENTIDO**. A fila de *"casar com conta a pagar"* tinha **6.555 linhas, das quais 5.705 eram CRÉDITO — 87%**. O PIX de venda de **R$ 308,50** do dono estava ali, junto de `ANTECIP STONE` e `OP.CREDITO C/GARANTIA` de R$ 28.223,77. ***A fila de pagar dívida era, quase toda, dinheiro que entrou.*** Uma linha (`type: 'DEBIT'`) tirou os 5.705 — e ela exclui `TRANSFER` **por construção**, então a trava antiga ficou mais forte, não mais fraca.

**⭐⭐ TODO GESTO EFETIVA — a régua nova da casa:** ***gesto que ESCOLHE um alvo e não EFETIVA o vínculo é MEIA-PONTE.*** O defeito que a criou: no `pendentes-client.tsx` o seletor oferecia *"Pgto cartão"* e *"Pgto empréstimo"* e o `onChange` só tratava `TRANSFER` e `IGNORAR` — as outras duas **caíam no vazio**, guardando um rótulo num `useState` local. O dono escolhia o cartão e a fatura não baixava. *Não era meia-ponte: era ponte que não começa.*

**⛔ E NENHUM MOTOR NOVO NASCEU:** `resolverLinha` é o choke-point e **despacha pros motores provados** — `casarPagamentoDeCartao` (extraído da rota, que virou casca), `vincularPagamentoDeParcela` (a porta única de 11/09), o update + `recomputeVendasSeVenda`. As **quatro ações de VÍNCULO** (casar pagar/receber, as duas transferências) **não gravam aqui de propósito** — a escolha do alvo já tem casa provada — e por isso **devolvem o CAMINHO** em vez de calar. **A lei do sentido é checada no SERVIDOR**, não só no menu: esconder o botão não impede a chamada.

**⛔⛔ O PENDENTES MORREU NO MESMO DEPLOY, com realocação completa** — e o `pendentes-client.tsx` foi **DELETADO**, não deixado órfão: enquanto o arquivo existisse, o seletor morto podia ser remontado.

**⚠️ E OS GUARDS DE SPRINTS ANTIGOS COBRARAM A MUDANÇA DE CASA — 5 ficaram vermelhos e TODOS foram REAPONTADOS, nenhum apagado:** o filtro de data (**deixou de existir de propósito** — *"Pendentes é FILA e NUNCA ganha mês"*, a régua de 14/09; quem navega por período é Movimentações) · o `status=PENDING` forçado (virou *"a caixa não define a fila por status NEM por categoria"*) · os call-sites de `fetchJson` (a caixa usa `fetchComTimeout`) · e o **banner retroativo de transferência**, que **já morava** em `/parear` — o guard passou a provar **os dois lados**: a detecção vive lá **e** a caixa leva até lá.

**⚠️⚠️ REGRA 11 REPROVOU UM GUARD MEU — a lição do rastro (12/09) em roupa nova.** O `meia-ponte-proibida` afirmava `toContain('acaoValePraSentido')`; troquei a condição por `if (false)` no servidor e ele ficou **VERDE** — **a linha do `import` já bastava**. O que morde é `usosDe()`, que ignora import/comentário e exige a chamada dentro do `if`. **Guard que conta a MENÇÃO aprova o servidor que não checa nada.**

**PROVADO EM PROD, NAVEGANDO, NOS DOIS VIEWPORTS (REGRA 12):**
```
CELULAR /conciliacao 200 · 1.057 KB      DESKTOP 200 · 1.057 KB   (bundle servido)
  ✓ o fluxo no topo · ✓ abas SAÍDAS/ENTRADAS · ✓ contador do arquivo
  ✓ "⛔ a soma não fecha" (o invariante VISÍVEL) · ✓ o vazio que DIZ · ✓ "tentar de novo"
  ✓ o gesto vai pro choke-point · ⛔ "Pgto cartão" (o seletor morto): SUMIU

/pendentes → 307 → /conciliacao   ·   /empresas/:id/pendentes → 307   (nos dois)

A CAIXA:  SAÍDAS 1 · ENTRADAS 0 · ARQUIVO 220 · TOTAL 221
          ⭐ Σ(caixa + arquivo) == total ✓ · crédito vendo "casar com conta a pagar": 0
A FILA DE PAGAR:  régua VELHA 6.555 → régua NOVA 850   ⭐ −5.705 créditos
```
**REGRA 11 — 5 defeitos repostos:** a fila voltando a filtrar por categoria (**1 vermelho**) · a lei do sentido caindo no servidor (**1**, depois do aperto) · o invariante sumindo da tela (**3**) · a detecção de par sumindo do `/parear` (**1**) · o `not: 'TRANSFER'` de volta no lugar do `DEBIT` (**1**).

**10.063 verdes · TS 0 · `pg_dump pre-estacoes-20260915-214235` (6,2 MB) · deploy 4/4 (`PO9SGRQsL5-iul7g5IpLT`).** Migration nenhuma — o `conciliarAPartirDe` já estava em prod desde 11/09.

**⭐ SÉRIE DE PERFORMANCE POR DEPLOY LIGADA** (`scripts/serie-performance.sh`, uma linha no `deploy.sh`): grava `data · build · chunks_kb · mem_mb · home_p95_ms` em `.perf-serie.tsv` e imprime o **Δ vs o deploy anterior**. 1ª linha: **8.228 KB · 54 MB · home p95 25 ms**.

⚠️ **DÍVIDA REGISTRADA, NÃO TOCADA (ordem do dono):** os **874 KB de JS do estoque** são dívida de **code-splitting**.

**⚠️⚠️ E A LIÇÃO DO DIA É SOBRE A MINHA SONDA, que errou TRÊS VEZES seguidas e cada vez com cara de defeito de prod:** (a) assinei o token só com `{sub}` e **todas** as páginas do dashboard deram **500** — o shell faz `initials(name)`, e o login real assina `name`; eu ia reportar prod quebrada; (b) mandei `?empresaId=` sem o cookie `current_empresa_id` e o `/pendentes` respondeu **200** em vez do 307, parecendo que o redirect não subiu; (c) procurei `"Saídas:"` no bundle e o minificador escreve **`Sa\xeddas:`** — a aba estava lá. ***Sonda errada dá um vermelho tão convincente quanto um defeito real*** — é a mesma família do `"Custo total"` de 14/09 e do token de 09/09. **Antes de reportar prod quebrada, provar que a SONDA reproduz o caminho real do dono.**

📋 **FICA PRO DONO (REGRA 2, o red-then-green navegando):** abrir a Conciliação, resolver uma saída e uma entrada pelo menu de cada sentido, e ver a linha **sair da caixa na hora** com o efeito nomeado no destino.


### ⭐⭐⭐ ETAPAS EM DIAS DIFERENTES + O SILÊNCIO NÃO PUBLICA (15/09)

Duas dores de operação do dono, e **a armadilha que ele nomeou ANTES de ela aparecer já estava cobrando em prod**.

**⛔⛔⛔ 1. A ARMADILHA DO RELÓGIO — E ELA NÃO ERA HIPOTÉTICA.** `lotes.ts` dizia, em comentário: *"a duração do LOTE é da 1ª etapa iniciada à última finalizada"* — **fim − início**. **MEDIDO EM PROD ANTES DE MEXER: 30 de 45 lotes com 2+ etapas estavam inflados**, com casos de **51 min de trabalho contados como 305 min (6×)** e **57 min como 343 min**. Isso ia pra média por lote, pro gráfico por dia e pro *"melhor ritmo"*.

**A régua do dono, ao pé da letra:** *"o TEMPO do lote é a SOMA dos cronômetros das etapas. Lote que dorme 16h não produziu 16h — se a etapa 1 levou 40min e a 2 levou 35min, o lote levou 1h15."* ⚠️ E a honestidade não afrouxou: **etapa sem `finalizadoEm` = lote sem tempo medido** (`null` ≠ 0).

**⭐⭐ 2. O LOTE PODE DORMIR.** `stock_etapa_plano` (CREATE-only — `stock_ordem_etapa` não aceita ALTER desde a Fase 0) guarda **dia previsto por etapa** e **liberada pra equipe**. ⚠️ **Ausência = padrão**: sem linha, a etapa é do dia da ordem e não está liberada — é o que faz a regra nova valer pro histórico inteiro **sem backfill**.
- terminar a etapa 1 **não obriga** começar a 2: à noite a fila fica vazia;
- amanhã ela aparece com **"começou 03/09 — 'sovar' feita por Eliane"**, em tom **neutro**: massa que descansa é a RECEITA, não atraso (a lição dos 111 alarmes falsos);
- **o P2 não grita mais** sobre descanso planejado — e a exceção é **estreita**: só cala com plano **vigente** (hoje ou pra frente). Lote esquecido com plano vencido continua vermelho.

**⭐⭐⭐ 3. SEM NOME = RASCUNHO MEU.** Até 14/09 a etapa **solta** aparecia pra TODO MUNDO e qualquer um iniciava. Agora ela só chega ao tablet **designada** (e só pros nomeados) ou **liberada** — um gesto explícito. ***O silêncio não publica.***
⛔ **E QUEM RECUSA É O SERVIDOR**, não a tela: esconder o botão não impede a chamada (a lição de 06/09, a etapa 2 do beef feita antes da 1, e a de 09/09, *"o menu esconde e a rota nega"*). A mensagem ENSINA a saída: *"é rascunho do encarregado — peça pra ele te designar ou liberar pra equipe"*.
⚠️ E o dono continua vendo: a tela de gestão traz o selo **"sem responsável — não aparece pra equipe"**. Invisível pros dois seria a fila que some quando o trabalho zera (12/09) — ele planejaria o mesmo lote duas vezes.

**⭐ MEDIDO EM PROD ANTES DE SUBIR — a régua nova NÃO esconde nada hoje:** das **8 ordens abertas / 9 etapas por fazer**, **ZERO estão sem responsável**. A cozinha não perde nada ao acordar amanhã.

**PROVADO EM PROD, depois do deploy:**
```
tempo dos lotes, agora por SOMA (83 medidos):
   278 min · 408 UN · metade de bolinha massa de pizza    média por lote: 61 min
   262 min ·  68 UN · porcao bacon 80 grama               ⛔ lotes acima de 8h: 0 ✓
tela da ordem (celular e desktop, REGRA 12): ✓ dia por etapa · ✓ liberar pra equipe
   ✓ a frase do mundo velho ("quem pegar com o PIN fica registrado") MORREU
tablet: ✓ "começou …" · ✓ "liberada pra equipe"
a régua pura: NINGUEM/EQUIPE/NOMEADOS · rodrigo vê a da eliane? false · o rascunho? false
```
**REGRA 11 — 4 defeitos repostos:** a régua velha do tempo (**1 vermelho**) · a etapa voltando pro dia da ordem (**1**) · o silêncio voltando a publicar (**1**) · o selo "começou ontem" sumindo (**1**).

**⚠️⚠️ E REGRA 11 ME CORRIGIU NO CAMINHO:** o teste *"a eliane vê só a etapa 1"* passava **mesmo sem o filtro de dia** — a etapa 2 estava sem responsável e a régua da VISIBILIDADE já a escondia. *Duas travas empilhadas, e o teste media a de cima.* O caso que ISOLA o dia é a etapa **designada à própria eliane** e marcada pra amanhã: visível por responsável, invisível por DIA.

**⚠️ E O CONTRAFACTUAL ME CORRIGIU TAMBÉM:** eu escrevi "20h35" de cabeça; a conta é **18h35 = 1.115 min** — **quinze vezes** os 75 min que a cozinha trabalhou. O número que importa não mudou; a minha aritmética estava errada.

**⚠️ 2 TESTES INVERTIDOS COM O MOTIVO ESCRITO** (afirmavam *"a solta aparece pros dois"* e *"etapa SEM designação aparece pra todo mundo"* — o mundo que o dono aposentou) **e 6 fixtures passaram a declarar `liberadaParaEquipe`**: elas se apoiavam no antigo padrão **sem dizer**, e o assunto delas não mudou — o que mudou é que o pressuposto agora está escrito.

**10.027 verdes · TS 0 · `pg_dump pre-plano-etapa-20260915-144932` (6,2 MB) antes da migration · deploy `tjb48eK8CFXFDhHbSB0tK` 4/4.**

📋 **FICA PRO DONO (REGRA 2, o red-then-green navegando):** criar a tarefa de 2 etapas com a etapa 2 marcada pra amanhã, ver o tablet da eliane, e nomear o rodrigo no dia seguinte.

### ⛔⛔⛔ O CLIQUE QUE GRAVAVA E NÃO DIZIA NADA (14/09) — REGRA 2 no confirmar do dia

**O dono, navegando:** *"abro Vendas → Complementos → dia 13/09 → revisão → clico 'Confirmar e baixar' → NADA acontece: nenhum modal de prévia, nenhum recibo, nenhuma mudança de contador."*

**⛔⛔ E ERA PIOR QUE NADA — O CLIQUE GRAVOU.** Medido no ledger: **`BAIXA_VENDA` de complementos às 19:33:17**, do clique dele. A tela zerava o preview, recarregava a lista (que **não mudava**, porque os nomes já estavam vinculados) e **jogava o recibo fora**.

**⭐⭐ A RÉGUA QUE FICA:** ***gravar sem dizer é pior que não gravar — porque o dono clica de novo.*** Todo botão que escreve no ledger: **modal de prévia antes**, **recibo depois**.

**⚠️⚠️ E A LIÇÃO SOBRE O GUARD ANTERIOR É A QUE DÓI:** eu tinha um teste verde provando que `<PlanoVendaModal` existe no fluxo de complementos. **Ele passava porque eu liguei o modal no caminho do UPLOAD e o dono navegou o caminho do DIA.** *É o "guard que testa a lib e aprova a tela que ignora a lib" em versão nova: **testei o modal, não o botão que o abre**.* O guard novo pergunta **quem dispara a escrita** — e exige que a resposta seja *"o modal"*, nunca *"o botão"*.

**A INVESTIGAÇÃO, na ordem que ele pediu:** o clique chamava `reprocessar()` direto (o caminho do DIA nunca passou pelo modal — só o do upload) · o preview do rodapé respondia em **132 ms** com `mudam: 2`, então o botão estava **habilitado** e a rota **não travava** · `montarRevisaoDeLinhas` com as 1.014 ocorrências: **202 ms** · deploy íntegro. **Nada estava pendurado: estava mudo.**

**O QUE SUBIU:**
1. o botão do rodapé **ABRE O MODAL** (o mesmo de produtos), nos **dois** relatórios — e quem grava é o `gravar()`, chamado **só de dentro dele**;
2. a rota da revisão devolve o **plano do dia na forma do modal** (`planoDoDia`), saindo do **MESMO motor que a baixa executa** — um cálculo "só pro modal" faria a tela prometer um número e o ledger gravar outro;
3. **recibo do SERVIDOR** no topo da revisão (*"baixado: N ocorrências · M itens · R$ X"*) + `carregar()` e `verPreview()` logo depois, pros contadores andarem;
4. prévia e gravação com **teto de tempo** — e o da gravação é **maior (60 s)**: desistir cedo de uma escrita que está acontecendo é pior que esperar.

⚠️ **A tradução do recibo mora num lugar só:** complementos contam **ocorrências**, produtos contam **produtos**, e os campos do servidor têm nomes diferentes. Remontar isso em duas telas daria dois números pro mesmo fato.

**PROVADO EM PROD, NOS DOIS VIEWPORTS (REGRA 12):**
```
CELULAR 200 · 876 KB      DESKTOP 200 · 876 KB
  ✓ modal de prévia · ✓ recibo · ✓ "custo total baixado" · ✓ teto de tempo · ✓ "tentar de novo"

O QUE O MODAL DESENHA — 13/09 COMPLEMENTOS (a rota real):
  46 baixam · 84 sem destino · 0 ignorados
  sai do estoque: 22 itens · custo total R$ 2.682,80
    − 181 porcao de calabresa 120 grama · R$ 427,16
    − 117 porcao bacon 80 grama         · R$ 586,17
    − 113 porcao frango 100 grama       · R$ 322,05
12/09 PRODUTOS → 52 baixam · 52 itens
```
**REGRA 11 — 4 defeitos repostos:** o botão gravando direto (**2 vermelhos**) · o recibo jogado fora (**1**) · o modal sumindo do fluxo do dia (**3**) · a gravação sem teto (**1**).

⚠️ **UM VERMELHO DA MINHA SONDA, NÃO DA TELA:** a 1ª prova acusou *"⛔ o custo total do modal"* — eu procurei `"Custo total"` e o rótulo real é `"custo total baixado"`, minúsculo. **Erro da sonda**; conferido com o texto certo, está lá.

**10.015 verdes · TS 0 · deploy `51NroDCWdqIp4XDi1ZRL0` 4/4.**

⚠️ **E O DIA 13/09 FOI REPROCESSADO PELO CLIQUE MUDO DELE** (19:33:17). O estoque está correto — `processarComplementos` estorna e refaz, é idempotente —, mas o ledger tem esse par a mais, sem ninguém ter visto o que ia acontecer. É o custo registrado do defeito.

### ⛔⛔⛔ A TELA PENDUROU EM PROD — 20 REQUISIÇÕES POR SEGUNDO, 18.051 NO DIA (14/09)

**O dono:** *"com a página RECARREGADA, três fetches não resolvem — o 'Lendo…' do topo, a lista de receitas do seletor ('carregando…' eterno) e o POST do processar ('processando…' preso)."*

**⭐ A INVESTIGAÇÃO INOCENTOU TUDO QUE ELE LEVANTOU, e a medição é que apontou o culpado:**
```
pm2        online · 40 restarts · uptime 629s · 54 MB · CPU 0,1%   → sem loop, sem OOM
dmesg      nenhum "killed process"                                 → sem OOM killer
free       2.854 MB livres de 3.915                                → sem pressão
as rotas   destinos 184/261ms · revisao 13/09 202ms · processados 302ms
           preview-do-ajuste 72-112ms                              → montarRevisaoDeLinhas NÃO é pesado
deploy     BUILD_ID servido == buildado, 4/4                       → não ficou pela metade
```
⛔ **E o nginx deu o veredito: 489 de 500 requisições eram o MESMO `POST /vendas/preview`, ~20 por segundo, todas 200, cada uma reenviando o arquivo inteiro** — do Safari dele. **18.051 no dia.**

**A CAUSA É MINHA, do deploy das 17h:** o `carregar` da revisão tinha **`recarregarExterna` nas dependências**, e a tela pai monta essa função **nova a cada render**:
```
efeito → fetch → setState no pai → render → identidade nova → efeito → …
```
⚠️ **E é por isso que os TRÊS spinners travaram, não só um:** com o limite de **~6 conexões por host** do browser saturado pelo laço, o `GET /destinos` do seletor e o `POST /processar` **ficaram na FILA — pra sempre**. *O servidor nunca soube que havia um problema.*

**⭐⭐ A CURA É ESTRUTURAL, não um `useRef` em cima do laço:** no modo externo **a lista É a prop** — o componente **ESPELHA**, não busca. Quem busca é o pai, e só quando alguém pede (um ajuste). **Sem efeito que busca, não há laço possível** (REGRA 5). O `recarregarExterna` foi pro ref: é chamado por GESTO, nunca por dependência.

**⚠️ A RÉGUA GERAL QUE FICA:** ***`useCallback`/`useEffect` que busca não pode depender de função vinda de prop*** — a identidade muda a cada render do pai **por construção**. É um laço armado esperando o pai re-renderizar.

**⭐ A VARREDURA (REGRA 4) ACHOU A MESMA BOMBA NOUTRO LUGAR:** `LinkPaymentModal` tem `load` com `onClose` e `toast` nas deps + `useEffect(… , [load])`. Lá não virou enxurrada porque o `load` só mexe em estado **local** — mas é a mesma bomba armada, e foi fechada junto (os dois foram pro ref).

**⛔⛔ E O TIMEOUT QUE O DONO PEDIU — com uma declaração honesta: ELE NÃO TERIA PEGO ESTE DEFEITO.** As requisições eram **200 e rápidas**; o que pendurou foi a FILA. O timeout não impede o laço — **impede a mentira**: em vez de girar pra sempre, a tela diz *"não consegui carregar — tentar de novo"* em **12 s**. `lib/http/fetch-com-timeout.ts` (12 s pra ler, **60 s pra gravar** — desistir cedo de uma gravação que está acontecendo é pior que esperar), **nunca lança** (throw solto em efeito vira spinner com o erro só no console), e respeita o `signal` de quem chama.

**⭐ *"Carregando pra sempre e erro são estados diferentes; o spinner eterno é a ausência fingindo progresso"*** — palavras do dono, e virou régua da casa.

**O GUARD (`spinner-eterno-nao-existe.test.ts`) TEM DUAS FORMAS, e a 2ª nasceu de o guard não morder:**
- **(A) direta** — o hook tem `fetch(` no corpo e uma prop-função nas deps;
- **(B) indireta** — um `useCallback` com prop-função nas deps é ele próprio dependência de um `useEffect`.

**⚠️⚠️ REGRA 11 REPROVOU A 1ª VERSÃO:** repondo o defeito, o `fetch(` ficou num callback **VIZINHO** e o detector que só olhava o corpo passou **VERDE**. *O laço não precisa do `fetch` na mesma função — precisa da **identidade instável chegando ao efeito**.* ⛔ E `onClose` num efeito de listener **não** cai no detector: a forma é outra, e alarme falso no dia 1 mataria o guard.

**PROVADO EM PROD:**
```
CELULAR 200 · DESKTOP 200  →  ✓ teto de tempo no fetch · ✓ "tentar de novo" · ✓ a frase do erro
nginx    último POST /preview 16:26 (antes do deploy) · agora 16:31
         últimas requisições: navegação normal, ZERO /preview
```
**9.992 verdes · TS 0 · deploy `BjtjdYxjEEHTrXkBHb-OQ` 4/4.**

### ⛔⛔⛔ A TELA VELHA NÃO MORREU QUANDO A NOVA NASCEU — NAS DUAS (14/09)

**O dono:** *"depois do confirmar (e no upload), a página empilha: recibo + REVISÃO nova + o RELATÓRIO/TABELA VELHA (produtos: 'Mapeamento (115)' com trocar/desmapear e SEGUNDO botão de confirmar; complementos: o relatório feio antigo que não edita nada). O mesmo dado em duas vitrines, dois confirmares — **é a segunda derivação em forma de página**."*

**⭐⭐⭐ A REGRA QUE FICA, E VALE PRAS PRÓXIMAS:** ***quando a tela nova assume, a velha MORRE NO MESMO DEPLOY.*** Conviver *"por enquanto"* é como nasce a página com duas verdades — a mesma doença dos 7 detectores de par, agora em HTML. ⚠️ **E o defeito foi meu:** eu subi a revisão ao lado da tabela em vez de no lugar dela.

**⭐⭐ A PEÇA QUE DESTRAVOU TUDO: `montarRevisaoDeLinhas`.** A tabela velha existia por um motivo técnico real — **a revisão só sabia ler do BANCO, e antes de confirmar o dia não está no banco**. Separando as LINHAS do resto, a MESMA função serve os dois momentos: o arquivo recém-lido e o dia já importado. ⚠️ **E isso NÃO ressuscita o "baixar" separado que morreu em 07/09:** o upload continua **sem escrever nada** — o que a tela pré-import edita é o **MAPA** (configuração, vale pra sempre), e o dia nasce num confirmar só.

**1. PRODUTOS — a tabela "Mapeamento (N)" SAI.** A revisão é a única lista, com as ações completas na linha: **definir/trocar** · **desmapear** (migrou da velha) · **IGNORAR** (novo aqui).

**⭐⭐ IGNORAR CHEGOU AO MAPA DE PRODUTOS**, e o dono nomeou o custo de não ter: *"os ~30 doces/milkshakes/açaí que POR MINHA DECISÃO não controlam estoque param de engordar o contador de pendentes pra sempre"*. ⛔ **PENDENTE = "espera decisão", NUNCA "tudo que não baixa"** — contador que cobra o que já foi resolvido é como o dono aprende a não olhar o contador. Ele é **reversível** (o desmapear devolve à fila), **datado** (o *"por você, em DD/MM"* da linha) e o plano de baixa lista os ignorados **nomeados**, nunca só contados.

**2. COMPLEMENTOS — o relatório velho pós-upload SAI.** Upload → **revisão direto** → `[Confirmar e baixar]` → recibo + contadores. ⭐ E o confirmar de lá passou a usar o **MESMO `PlanoVendaModal`** da tela de produtos: o resumo inline que existia ali era um **segundo desenho da mesma pergunta** (*"o que acontece se eu confirmar?"*), e dois desenhos divergem no primeiro campo novo.

**3. O PREVIEW MORRE NO CONFIRMAR.** Sem isso a página ficaria com a lista do ARQUIVO e a lista do DIA ao mesmo tempo — as duas vitrines de novo, agora por dentro. Depois de confirmar existe **uma verdade: o dia gravado**.

**⚠️ "DESFAZER" TEM NOME DIFERENTE NOS DOIS MAPAS** — `LIMPAR` nos complementos, `REMOVER` nos produtos. A tradução mora **num lugar só** (o `aplicar` da revisão): uniformizar as rotas quebraria um dos dois guards, que são opostos de propósito desde 02/09.

**OS 3 GUARDS DA FAMÍLIA** (`uma-vitrine-um-confirmar.test.ts`): **(a)** a página não desenha NENHUMA lista de nomes do dia — quem lista é a revisão; **(b)** **zero** botão de gravar o dia fora do rodapé da revisão, nos dois relatórios; **(c)** o **guard da mudança de casa** — desmapear EXISTE na revisão, e IGNORAR não pode voltar a ser só de complementos. *Remoção sem realocação é perda* (a disciplina da conferência de saldo que mudou de casa em 10/09).

**PROVADO EM PROD, NOS DOIS VIEWPORTS (REGRA 12):**
```
/estoque/vendas   CELULAR 200 · 873 KB      DESKTOP 200 · 873 KB
  ✓ morreu — a tabela velha "Mapeamento ("      ✓ morreu — o filtro "só pendentes"
  ✓ morreu — o relatório velho de complementos  ✓ morreu — o 2º confirmar
  ✓ a revisão · ignorar · desmapear · Confirmar do rodapé · o modal único

PRODUTOS     12/09 → 🟡 33 · ✅ 52 · soma 85 = linhas 85 ✓
COMPLEMENTOS 13/09 → 🟡 84 · ✅ 46 · soma 130 = linhas 130 ✓
```
⭐ **E o dono já usou a tela enquanto eu provava:** `COCA COLA LATA` e `COCA COLA ZERO LATA` mapeadas por ele às **17:59 de hoje** (auditoria: `criadoPorId` dele) — é por isso que os complementos saíram de 🟡86/✅44 pra 🟡84/✅46.

**REGRA 11 — 5 defeitos repostos, 1-2 vermelhos cada:** a segunda vitrine de volta na página (**2**) · o segundo confirmar (**1**) · o preview sobrevivendo ao confirmar (**1**) · IGNORAR voltando a ser só de complementos (**1**) · desmapear não migrando (**1**).

**⚠️ 5 TESTES DO GUARD ANTERIOR FICARAM VERMELHOS COM A TELA CERTA — e foram REAPONTADOS, não afrouxados.** Eles mediam *"a tela de produtos renderiza `<SeletorDeDestino>`"*, o que era verdade **enquanto a tabela velha existia**; agora ela renderiza a REVISÃO, e é a revisão que usa o seletor. A pergunta continua a mesma (*"o destino se edita pelo componente único?"*); o que mudou é por onde ela passa. É a mesma classe do guard que quebrou com a tela certa em 13/09.

**9.983 verdes · TS 0 · deploy `VFe4IlUZ2ogobVspE6a_H` 4/4.**

📋 **DUAS CONSEQUÊNCIAS MEDIDAS, NOMEADAS E NÃO ESCONDIDAS:**
1. **O checkbox "não processar este nome HOJE" morreu com a tabela velha.** Ele era o `fora` do plano (mapeado que o dono desmarcava naquele processamento). **Não foi pedido pra ficar e não foi realocado** — o IGNORAR cobre a decisão permanente, que é o caso real; o "só hoje" deixou de existir. Se ele fizer falta, volta como um toggle na linha.
2. **Produto IGNORADO sai do CARDÁPIO.** O hub pula quem não tem destino FICHA/REVENDA, então o milkshake ignorado deixa de aparecer lá — inclusive com as vendas dele. É o efeito pretendido no contador de pendentes, mas o número de vendas daquele nome some junto da tela de margem. Fica registrado pro dia em que ele quiser um estado "ignorado" visível também no cardápio.

### ⛔⛔⛔ "O DEFINIR FICHA ME EXPULSA DA TELA" — PARIDADE COM PRODUTOS (14/09)

**O dono, na revisão de complementos:** *"clico em definir → navega pro cardápio e eu SAIO da revisão — perco o dia, a lista e o fio. A referência é a NOSSA tela de PRODUTOS, que está certa: clico no destino → seletor abre ALI → escolho → sigo na mesma tela."*

**A EXPULSÃO ERA LITERAL:** o "definir" era um `<a href>` pro cardápio. E **o gesto se repete ~80 vezes num dia de import** — sair e voltar 80 vezes não é fluxo, é castigo. ⚠️ É a "porta sem maçaneta" **do avesso**: o gesto existe, o caminho de VOLTA é que não.

**⭐⭐ 1. O SELETOR VIROU UM SÓ (`seletor-de-destino.tsx`), pros dois relatórios e pras duas telas.** ⛔ Dois seletores divergiriam no primeiro destino novo, e o dono veria opções diferentes pra mesma pergunta em duas telas do mesmo módulo. ⚠️ **E a referência dele ganhou o que faltava:** o `<select>` nativo da tela de produtos **não tinha busca**, e a lista já passa de **150 nomes** — agora busca pela régua da casa (palavra em qualquer ordem, sem caixa e sem acento, 08/09) e é dispensável com ESC/clique-fora (28/08).

**⛔ UNIFICAR NÃO PODE TIRAR CAPACIDADE:** o `<select>` velho oferecia **"desmapear"** (que DEVOLVE o nome pra fila, diferente de ignorar) e **"criar item de revenda"**. Os dois sobreviveram — senão o fix seria uma regressão com cara de melhoria. O guard trava os dois.

**⭐⭐ 2. A FICHA SIMPLES NASCE DO GESTO — e a régua não afrouxou.** O caso `FRUKI LATA` comum: escolher um item do estoque cria a ficha ×1 e mapeia, sem sair. ⛔ **`REVENDA` continua sendo ATALHO, não um quarto destino** — por baixo vira `FICHA`, pelo **MESMO** `garantirFichaDeRevenda` que o mapa de produtos usa desde 09/09. Ele saiu de dentro do `venda-map.ts` porque agora serve os dois mapas: **REGRA 4** — copiar as 20 linhas faria duas implementações da mesma decisão.

⚠️ **O QUE NÃO VEIO JUNTO: os GUARDS de destino.** `venda-map` recusa INTERMEDIARIO, `complemento-map` ACEITA — são **opostos de propósito desde 02/09** e unificá-los quebraria um dos dois. O que é comum é só a **construção** da ficha. E `destinosPossiveis` decide **o que a tela OFERECE, nunca o que o mapa ACEITA**: se divergirem, quem ganha é o guard da fonte.

**⭐⭐ 3. IDA COM VOLTA — o combo sai e VOLTA pro mesmo dia e pra mesma linha.** `?revisar=<dia>&relatorio=<R>#rev-<nome>`, lido no **1º render** (como o `?aba=`): em `useEffect` a tela renderizaria sem a revisão antes de abri-la, e *"voltar e não ver nada"* é indistinguível de *"não gravou"*. ⚠️ A régua mora em `lib/stock/vendas/volta-da-revisao.ts`, **nunca no componente** — sem jsdom, regra dentro de JSX é regra que ninguém prova (foi assim que o prefill do cardápio quebrou 2× em 28/08). O `voltar` só aceita **caminho interno**.

**⭐⭐ 4. O ARREMATE — CONFIRMAR NO PÉ DA TELA ONDE EU TRABALHEI.** ⛔ Antes o botão só existia **depois** de um ajuste (o preview só nascia ali), então voltar do editor com a linha vinculada deixava o dono **sem onde aplicar** — e o reprocessar morava na lista de dias, fora da tela. Agora o preview carrega junto com a tela e o rodapé é **permanente**: *botão que aparece e some conforme o estado é botão que se aprende a não procurar.* ⚠️ E ele **não grava sem preview**: mudança de vínculo é escrita em estoque.

**PROVADO EM PROD, NOS DOIS VIEWPORTS (REGRA 12):**
```
/estoque/vendas   CELULAR 200 · 880 KB      DESKTOP 200 · 880 KB
  ✓ seletor inline  ✓ 2 abas  ✓ busca  ✓ criar-item inline
  ✓ ida-com-volta do combo  ✓ Confirmar no pé  ✓ desmapear
  ✓ o <select> velho morreu

DESTINOS (a rota real)  PRODUTOS 80 receitas · 31 itens
                        COMPLEMENTOS 114 receitas · 31 itens
  ⭐ COCA LATA → "COCA COLA LATA 350ML ×1"   (o destino DIZ o que desconta)

IDA COM VOLTA  voltar: /…/vendas?aba=complementos&revisar=2026-09-13
                       &relatorio=COMPLEMENTOS#rev-coca-lata-mais-mini-fritas
               interno ✓ · responde 200
```
**REGRA 11 — 4 defeitos repostos:** o "definir" de volta a link (**3 vermelhos**) · o `?revisar=` fora do estado inicial (**1**) · a âncora da linha sumindo (**1**) · o rodapé de volta atrás do preview (**1**).

**⚠️⚠️ E O DETECTOR DO RODAPÉ NÃO MORDEU NA 1ª VERSÃO:** ele era um regex com **janela de 400 caracteres** entre o gate e o botão — e no arquivo real há o bloco inteiro do preview no meio. **Janela de distância já produziu falso vermelho e falso verde nesta casa** (o rastro em 12/09, o menu do PF em 13/09). O que morde é olhar o que vem **imediatamente antes** da tag: estrutura, não distância.

**⚠️ E O GUARD DE 09/09 ("rótulo que some não é rótulo") ME PEGOU — com razão parcial.** Ele acusou o campo de busca do seletor porque a exceção dele casava `placeholder="buscar…"` **com aspas literais**, e o meu é `placeholder={cond ? 'buscar item…' : 'buscar receita…'}`. **A pergunta é "é um campo de busca?", não "com que aspas foi escrito"** — a exceção foi corrigida na forma, não afrouxada: campo de DADO sem rótulo continua vermelho (medido).

**9.943 verdes · TS 0 · deploy `F02MS2AbYIC97UGbM0Ul6` 4/4.**

⚠️ **OS DOIS CLIQUES DO RED-THEN-GREEN SÃO DELE, e de propósito:** mapear `COCA COLA LATA` e criar a ficha do `FRUKI LATA` comum é **decisão do dono** (a régua desde 22/08) — o sistema oferece, ele aponta. O caminho de escrita está provado ponta a ponta nos 9 testes de integração contra banco real; o que falta é o dedo dele. ⚠️ E pro `FRUKI LATA` comum **não existe item no estoque** (só a `FRUKI GUARANA 2L` e a lata ZERO): ali o caminho é o **"criar no estoque"** do próprio seletor — o item nasce com **saldo ZERO** e entra na fila de contagem, porque saldo não se chuta.

### ⛔⛔⛔ A REVISÃO SÓ EXISTIA POR ROTA DIRETA — 8ª VOLTA DA "PORTA SEM MAÇANETA" (14/09)

**O dono, com o deploy 4/4 verde e a tela provada:** *"NAVEGANDO EM PROD (cache limpo, celular e desktop) eu NÃO ACHO a tela: subo arquivo, vejo o resumo velho, e nenhum botão/link leva à revisão."*

**⭐ NAVEGUEI COMO ELE E ELE ESTAVA CERTO — o defeito era MAIOR que o relato.** O caminho existia e tinha três degraus invisíveis:
```
Estoque → Vendas (Suitable) → aba "Processados" (a 4ª) → última coluna da tabela
  → <button class="text-xs text-violet-700 hover:underline">revisar</button>
```
1. ⛔ **`hover` NÃO EXISTE NO CELULAR**, que é onde ele importa — a lição literal do *"converter a unidade"* (30/08): **ação sem afordância não existe**;
2. ⛔ **o caminho REAL dele nem passava por ali:** subir o arquivo → confirmar desembocava no **recibo velho** (três números + link pro extrato). A pergunta que o recibo LEVANTA (*"86 pendentes — quais?"*) não tinha resposta na tela;
3. ⛔⛔ **e do lado dos COMPLEMENTOS a revisão NÃO TINHA CAMINHO NENHUM** — o `relatorio` estava cravado em `'PRODUTOS'`. O relatório que motivou a tela (as bebidas) só era revisável por URL secreta.

**⭐ A REGRA QUE FICA** (irmã da de 12/09, *"fila zerada esconde o trabalho, nunca a ferramenta"*): ***o RESULTADO do gesto abre a tela que responde a pergunta do gesto, e todo item da lista carrega o caminho À VISTA.***

**O QUE SUBIU:** **(a)** confirmar o import — produtos **e** complementos — **ABRE a revisão do dia** (⛔ PERÍODO fica de fora: não é dia de venda, é semente da prateleira); **(b)** as **duas** listas de dias ganharam **"revisar" com borda e ícone**, nunca só hover; **(c)** o painel tem **um dono só** (`BlocoRevisao`) aberto de quatro lugares — copiar o cabeçalho em cada um faria quatro telas divergindo no primeiro rótulo novo.

⚠️ **E o painel renderiza em DOIS SLOTS (`origem`)**: aberto pelo upload, cola no resultado; aberto pela lista, embaixo da lista. Um slot só o faria nascer longe do dedo que clicou — o defeito de 10/09, de novo.

**GUARD DE 2 LADOS** (`revisao-do-import-tem-macaneta.test.ts`), porque guard que só olha a TELA aprovaria botão apontando pro nada: o botão existe **E** a rota responde (GET+POST, `view` pra ler e `manage` pra mudar vínculo, aceitando os DOIS relatórios), **e** todo caminho que o painel chama tem arquivo de rota. Mais: nenhum "revisar" pode ser texto hover-only, e o detector de `useState(false)` de 10/09 é **reusado**, não copiado.

**PROVADO EM PROD, NAVEGANDO, NOS DOIS VIEWPORTS (REGRA 12):**
```
/estoque/vendas  CELULAR 200 · 874 KB    ·    DESKTOP 200 · 874 KB
  ✓ botão revisar  ✓ "O que chegou em"  ✓ selo complementos
  ✓ border-violet-300 (não é hover-only)  ✓ 3 contadores  ✓ sugestão  ✓ o que desconta

PRODUTOS     13/09 → 🟡 5 (39 oc) · ✅ 2 (22 oc) · soma 7 = linhas 7 ✓
PRODUTOS     12/09 → 🟡 33 (126) · ✅ 52 (559) · soma 85 = linhas 85 ✓
COMPLEMENTOS 13/09 → 🟡 86 (457) · ✅ 44 (557) · soma 130 = linhas 130 ✓
COMPLEMENTOS 12/09 → 🟡 59 (228) · ✅ 40 (306) · soma 99 = linhas 99 ✓
  ✅ CACHORRO QUENTE → baixa CACHORRO GG ×1, SALSICHA ×0,085, MILHO ×0,04, …
```
**REGRA 11 — 4 defeitos repostos, 1 vermelho cada:** o link de volta a hover-only · o confirm voltando a terminar no recibo · a lista de complementos sem o botão · o upload de complementos deixando de avisar.

### ⛔⛔ E A PROVA EM PROD ACHOU DOIS DEFEITOS NA SUGESTÃO — UM DELES CRIADO POR MIM (14/09)

**1. `FANTA LARANJA ZERO 2L` (PDV) ganhava a sugestão da ficha `FANTA LARANJA 2L` — a COMUM.** A régua da DIREÇÃO **passava** (a ficha ESTÁ contida no nome do PDV) e **um clique baixaria a bebida errada**. ⚠️ **É o espelho exato do `FRUKI LATA`:** a régua velha supunha que a palavra a mais do PDV é **ruído** (`COCA COLA LATA` × `COCA LATA` — "COLA" é ruído); **`ZERO` distingue o produto**. Lista **FECHADA** (`ZERO · DIET · LIGHT · SEM ACUCAR`), como a dos volumes de bebida e a dos sufixos societários: inferir "qualificador" de qualquer palavra a mais mataria as sugestões boas, que são a razão de a tela existir.

**⭐ E a régua nova ganhou um efeito que eu não previ (o teste me corrigiu):** com as duas fichas na lista, o que antes era **ambiguidade** (as duas casavam → nada sugerido) agora **se resolve sozinho** — a comum cai pelo qualificador e sobra a certa.

**⛔⛔ 2. …E ESSE MESMO EFEITO CRIOU UM DEFEITO MEU, achado na prova seguinte:** `COCA COLA ZERO LATA MAIS MINI FRITAS` passou a **ganhar sugestão de 1 clique pra `COCA ZERO LATA`**. A régua de 12/09 (*"combo não herda — baixaria só a lata e esqueceria a batata"*) valia aqui **POR ACIDENTE**: o combo casava com DUAS fichas e morria na trava da ambiguidade. Tirei o acidente e o buraco apareceu. Agora é **explícito** (marcas `MAIS` e `+`, lista fechada). ⚠️ **`COM` fica de fora de propósito:** `FRANGO COM CATUPIRY` é **um sabor**, e barrá-lo mataria sugestão legítima.

**⚠️⚠️ REGRA 11 REPROVOU DUAS VERSÕES MINHAS DO MESMO GUARD:** (a) a fixture com **duas** candidatas passava pela trava da **ambiguidade** — repondo o defeito, ficava **VERDE**; o caso que isola é o REAL de prod, com **uma** ficha só; (b) a lista de qualificadores nasceu em **minúsculas** e `normalizarNome` devolve **MAIÚSCULAS** → o guard era **no-op**, verde com o defeito reposto. *Guard que não roda contra o defeito que o motivou é uma afirmação sobre o mundo bom.*

**PROVADO EM PROD depois dos dois:**
```
PRODUTOS     12/09  ✓ FANTA LARANJA ZERO 2L — sem sugestão (a comum não entra)
COMPLEMENTOS 13/09  ⭐ COCA COLA LATA → COCA LATA          (comum → comum)
                    ⭐ COCA COLA ZERO LATA → COCA ZERO LATA (zero  → zero)
                    ✓ COCA LATA MAIS MINI FRITAS            — combo sem sugestão
                    ✓ COCA COLA ZERO LATA MAIS MINI FRITAS  — combo sem sugestão
                    ✓ FANTA LARANJA LATA MAIS MINI FRITAS · SPRITE LATA MAIS MINI FRITAS
```
**9.880 verdes · TS 0 · deploys `Muxqj0EeHnkUlt0WpwA1a`, `rsUZZXoICeOUbMyVaIq_G` e `-f9t45mvSaLEh0bDD_QoE`, os três 4/4.**

### ⭐⭐ O IMPORT DE COMPLEMENTOS DE 13/09 — AS BEBIDAS BAIXARAM; O DEFEITO ERA DA TELA (14/09)

**O relato:** *"bebidas não baixaram"*. **A investigação read-only inocentou o arquivo, o import e a baixa** — e achou o defeito na TELA.

**⭐ O QUE O DADO DIZ (import `comp-…-2026-09-13`, 130 linhas):**
```
  ocorr  nome do PDV                             mapa?   desfecho
    19×  COCA LATA MAIS MINI FRITAS              ⛔ NÃO  pendente (combo)
    15×  COCA COLA 2L                            SIM     BAIXOU
     7×  COCA COLA ZERO LATA MAIS MINI FRITAS    ⛔ NÃO  pendente (combo)
     6×  COCA ZERO 2L                            SIM     BAIXOU
     5×  COCA COLA LATA                          ⛔ NÃO  pendente
     3×  COCA COLA ZERO LATA                     ⛔ NÃO  pendente
     1×  FRUKI 2L · FANTA LARANJA LATA · FANTA UVA 2L · FANTA UVA LATA   SIM  BAIXARAM
     1×  FANTA LARANJA LATA MAIS MINI FRITAS · GUARANA FRUKI ZERO LATA · FRUKI LATA  ⛔ pendentes

O QUE SAIU (líquido, 54 movimentos · 17 estornados · 20 vivos):
  −15 COCA-COLA 2L · −6 COCA COLA Zero 2L · −1 FANTA LARANJA LATA · −1 FANTA UVA 2L
  −1 FANTA UVA LATA · −1 FRUKI GUARANA 2L
```
⭐ **As 15 ocorrências viraram −15.** Os 17 estornos são o **estorna-e-refaz do reprocesso funcionando** — o dia foi baixado parcial e refeito inteiro.

**⛔⛔ O DEFEITO REAL ERA DE TELA:** o modal só desenhava o `agregada` — **o que sai do ESTOQUE, por ITEM**. A pergunta do dono é *"e a COCA COLA 2L?"*, e **um xis vira 6 itens**: o nome do PDV sumia no meio do efeito. ***Contar o efeito não é listar o que entrou.*** Agora o resumo traz **três contadores** (N baixam · M sem mapa · K fora) e **a lista por NOME** com quantidade e destino — e o *"fora"* também passou a ser **nomeado**, nunca só contado.

**⭐ ITEM 2 — POR QUE A HERANÇA NÃO PEGOU OS NOVOS: o canônico DIFERE, e a régua de 08/09 está certa** (*"canônico IDÊNTICO"*, nunca *"parecido"*). Os pares, **pro dono decidir**:

| nome no PDV | ocorr. | ficha que existe |
|---|---|---|
| `COCA COLA LATA` | 5 | **`COCA LATA`** |
| `COCA COLA ZERO LATA` | 3 | **`COCA ZERO LATA`** |
| `GUARANA FRUKI ZERO LATA` | 1 | **`FRUKI LATA ZERO`** |
| `FRUKI LATA` (comum) | 1 | ⛔ **não existe** — só a `FRUKI LATA ZERO` |

⚠️ **O `FRUKI LATA` comum é o caso que NÃO se resolve mapeando**: apontá-lo pra a ZERO baixaria a bebida errada. É a régua de 09/09 (*"se só existe a ZERO, me AVISA em vez de apontar na errada"*) — **a ausência se reporta, não se preenche**.

**⭐ ITEM 3 — OS COMBOS ESTÃO PENDENTES POR DESENHO, confirmado.** São **4 nomes · 28 ocorrências**: `COCA LATA MAIS MINI FRITAS` (19) · `COCA COLA ZERO LATA MAIS MINI FRITAS` (7) · `FANTA LARANJA LATA MAIS MINI FRITAS` (1) · e o irmão do FRUKI. ⛔ **Combo não herda** (régua de 12/09): herdar por *"parece"* baixaria só a lata e **esqueceria a batata**. Cada um precisa da ficha do dono, **uma vez** (lata + porção mini fritas) — daí em diante baixa sozinho.

**⚠️⚠️ REGRA 11 — o defeito reposto veio VERDE:** meus testes provavam o **PLANO**, e ele **sempre carregou tudo**; apagar o resumo por nome DA TELA deixava os 5 verdes. ***Guard que testa o dado aprova a tela que não o desenha*** — a mesma lição do card do PJBANK, no dia anterior. O teste passou a perguntar pra TELA.

⚠️ **E um fixture meu nasceu degenerado**: a ficha produzia e consumia o MESMO item — o ciclo que `criarFicha` recusa desde 09/09. O motor acusou (*"explosão de venda muito profunda"*) antes de eu perceber.

**9.827 verdes · TS 0 · deploy `Spe71jNqCfRobDq6FdJYg` 4/4.**

### ⭐⭐⭐ FLUXO ABRE NO MÊS; ESTOQUE MOSTRA O ESTADO DE AGORA (14/09) — régua da casa

**A REGRA DOS DOIS TEMPOS, ditada pelo dono, e ela existe pra NÃO ESCONDER DÍVIDA:**
- **PAGAS é FLUXO** → recorta no período, padrão **mês corrente**. *"É o número que muda com o filtro."*
- **VENCIDAS e A PAGAR são ESTOQUE** → mostram **tudo que está em aberto, SEMPRE**. *"Dívida aberta não expira com a virada do mês — esconder vencida de agosto seria mentir que não devo."*

**⭐⭐ E A DECISÃO MORA NO DONO DO ESCOPO, não em cada tela:** `whereDoStatus` **IGNORA o mês** quando o status é de estoque, **mesmo recebendo um**. ⛔ Se dependesse de cada chamador lembrar de não passar o período, a primeira tela nova esconderia dívida em silêncio — *aqui é impossível*. Quem separa os dois é `ehFluxo`, num lugar só.

⚠️ **O MÊS É O DO BRASIL**, pelo mesmo motivo do `inicioDoDiaBrasil`: **1º de outubro às 00h30 de São Paulo ainda é setembro**, e o servidor em UTC já diria outubro desde as 21h do dia 30.

**⭐ O CABEÇALHO DIZ O RECORTE *E* O QUE ELE ALCANÇA:** *"setembro ‹ › · o mês recorta as **pagas**; **vencidas** e **a pagar** mostram tudo que está em aberto"*. ⛔ Sem a segunda metade, ver "setembro" no topo faria o dono concluir que as vencidas de agosto sumiram — exatamente a mentira que a régua evita. ⚠️ E **limpar os filtros volta pro mês corrente**, nunca pro começo dos tempos.

**PROVADO EM PROD:**
```
ABRO A TELA → mês "2026-09"
   PAGAS     26 · R$  19.040,90   (era 250 · R$ 220.353,76 "desde sempre")
   VENCIDAS   7 · R$  20.346,54   ⭐ TODAS as abertas
   A PAGAR   87 · R$ 175.982,36
‹ AGOSTO → PAGAS 62 · R$ 87.710,77 (recalculou) · VENCIDAS 7 · R$ 20.346,54 (IGUAIS ✓)
clico PAGAS: card 26 → lista 26 ✓   ·   clico VENCIDAS: card 7 → lista 7 ✓
```

**REGRA 11 — 3 defeitos repostos, 1 vermelho cada:** o mês vazando pro estoque (vencida de agosto sumindo) · PAGAS sem recorte (voltando aos R$ 220 mil) · o mês pelo fuso do servidor.

### 📋 A VARREDURA DAS OUTRAS TELAS (14/09) — o que mudou e o que NÃO muda

| tela | o que mostra | classe | desfecho |
|---|---|---|---|
| **Contas a Pagar** | pagas · vencidas · a pagar | **misto** | ⭐ FEITO — pagas no mês, as duas abertas sempre |
| **Contas a Receber** | a receber · vencidas | **ESTOQUE (os dois)** | ⭐ **não ganha mês** — e o *"vencidas"* entrou na mesma fronteira: usava o MESMO `dueDate < now` de timestamp, e às 23h daria número diferente do Contas a Pagar ao lado |
| **Movimentações** (`/transacoes`) | linhas do extrato · **7.360 desde sempre** | FLUXO | ✅ **já abria no mês** (1º → hoje) desde o Sprint 3 — conferido, nada a fazer |
| **Pendentes** | 60 linhas a classificar | **FILA DE TRABALHO** | ⛔ **NUNCA ganha mês** — esconder pendente antigo é esconder trabalho, e foi assim que 21 notas ficaram invisíveis |
| **Posição de estoque · saldo das contas** | foto de agora | **ESTOQUE** | ⛔ não ganham filtro, por ordem do dono |

### ✅ AS DUAS REGISTRADAS FECHARAM (14/09) — uma de cada vez, cada uma com o seu red-then-green

**⭐⭐ 1. RECEBIMENTOS → "RECEBIDAS" abre no mês.** 123 conferências desde sempre viravam a lista; agora **80 em setembro**, com ‹ ›.

⚠️ **O recorte vai na CONFERÊNCIA, não na emissão:** `confirmadoEm` é *"quando eu recebi"* — o fato que aconteceu comigo. A `dataEmissao` é do FORNECEDOR, e **nota de agosto conferida em setembro é recebimento DE SETEMBRO**. Há teste com esse caso exato.

⛔⛔ **E A FILA NÃO ENTRA NISSO.** *"Na fila"* e *"pra depois"* são **TRABALHO PENDENTE**, a mesma classe dos Pendentes de classificação — recortá-los por mês esconderia a nota de agosto esperando conferência, e **foi assim que 21 notas ficaram invisíveis** (o F5 de 03/09). A trava mora na lib, não na tela, e o contrafactual (`fila` em 4 meses diferentes) é o que segura a régua.

**⭐⭐ 2. PF → LANÇAMENTOS abre no mês — e é A MESMA ESCOLHA do dashboard.** 499 desde sempre → **27 em setembro** (151 em agosto).

⭐ `useMesDoPerfil` (localStorage **por perfil**) faz *"uma escolha, duas telas"*: mudar o mês num lado muda no outro. ⛔ Não vai na URL porque são **rotas diferentes** — o link teria que carregar o parâmetro em toda navegação, e a primeira que esquecesse voltaria a divergir. ⚠️ E todo acesso ao storage é protegido: ele **lança** em aba anônima e com cookies bloqueados, e um throw ali derrubaria a tela por causa de uma preferência.

**⚠️⚠️ E O DASHBOARD PF USAVA O MÊS DO UTC:** `new Date().toISOString().slice(0,7)` — **no dia 1º às 00h30 de São Paulo ele abria no mês ANTERIOR**. Achado ao unificar; o `mesCorrente` resolve os dois de uma vez.

**PROVADO EM PROD, pela rota real:**
```
RECEBIMENTOS  (padrão) mês 2026-09 · recebidas  80 · FILA 6 ⭐
              ‹ agosto  mês 2026-08 · recebidas  43 · FILA 6 ⭐ (não muda)
PF LANÇAMENTOS  desde sempre 499 · setembro 27 · agosto 151
BUNDLE: navegador ✓ · "é a mesma escolha" ✓ · a frase da fila ✓
```

**⚠️⚠️ REGRA 11 — 4 defeitos repostos, e OS DOIS DO PF VIERAM VERDES.** Meus testes provavam a **régua** (`janelaDoMes`, `mesCorrente`) e ficaram verdes quando repus os defeitos **nas telas**: tirei o recorte do fetch dos Lançamentos e devolvi o mês UTC ao hook, e nada acusou. ***Guard que testa a lib aprova a tela que ignora a lib.*** O bloco novo pergunta pras TELAS e agora eles mordem.

⚠️ **E UM ERRO MEU NO CAMINHO, o mesmo de 13/09:** rodei `git checkout` num arquivo **não-commitado** pra desfazer a reposição e apaguei a edição de verdade junto. Reaplicada — e a suíte pegou (2 vermelhos) antes de virar deploy.

**9.821 verdes · TS 0 · deploy `EcpG5H1uXzJC-EmVfQ_jS` 4/4.**

**9.809 verdes · TS 0 · deploy `cTM4f16yZDDbIlirCzNvj` 4/4.**

### ⛔⛔⛔ O `?abrir=` NÃO ABRIA O CARD — E O DEFEITO ERA MEU, DO MESMO DIA (13/09)

**O dono, preso há 3 dias nos mesmos 2 casos:** *"clico 'casar conta' no pendente PJBANK 183,65 → a tela abre e o card do PJBANK NÃO ESTÁ — só o Casper de sempre."*

**⭐ MEDIDO COM OS DOIS IDS EXATOS DELE: a ROTA devolvia o card certo** (3 cards, o do PJBANK entre eles). **Quem o perdia era a TELA** — e a causa entrou no código **naquela mesma manhã**, comigo: eu dei `fornecedorId: ''` pro card da linha sem fornecedor reconhecido, e a fila usa o id do grupo como *"quem está aberto"*. Com `a && …`, **string vazia é FALSY**: o grupo abria e **se fechava no mesmo render**. O card estava na tela, sem nome e fechado.

**⭐⭐ O CONSERTO É UMA FUNÇÃO COM DONO (`identidadeDoCard`):** id **não-vazio e único por linha** (cada pagamento não reconhecido é o próprio grupo — juntá-los faria o ‹ anterior / próxima › passear entre pagamentos sem relação) e **nome = o TEXTO DA LINHA**. ⚠️ Não é inventar identidade: é mostrar **o que o banco escreveu**. *Cabeçalho em branco é um card que o dono não consegue nomear nem procurar.* E a fila passou a comparar `a !== null`, nunca `a &&` — cinto sobre o suspensório.

**⛔ O CONTRATO, escrito pelo dono:** *"`?abrir=<linha>` SEMPRE mostra o card daquela linha; se ela não tem candidata nenhuma, o card abre VAZIO dizendo 'nenhuma conta em aberto parece par desta linha · busca livre →'. **Deep-link que abre a tela sem o alvo é porta pintada na parede.**"*

**⛔⛔ E A PORTA DO OUTRO LADO ESTAVA PIOR:** o `?conta=` (o *"procurar no extrato"* do Contas a Pagar) **não ia no fetch da tela nem existia na rota** — o dono clicava na conta e caía numa Conciliação sem card nenhum. Agora a rota resolve as **linhas candidatas daquela conta** pelo MESMO `LINHA_DISPONIVEL_WHERE` e a mesma janela; não é um segundo matcher, é o recorte que alimenta o card que já existe.

**⛔⛔⛔ 2. A TABELA DE AGING SAIU DA TELA** — decisão do dono: *"meu negócio paga em DIAS, não carrego dívida de 90 dias — 100% sempre vai estar no 0-30. O card VENCIDAS já diz tudo, e clicar nele já filtra."* ⭐ **Móvel que mostra sempre a mesma coisa ocupa dobra e treina o dono a não olhar** (a régua que tirou o card de dupla contagem zerado da Conciliação). ⚠️ **O motor FICA** — `aging.ts` e a rota seguem vivos e testados pro dia em que ele vender com prazo longo. **Saiu a VITRINE, não a régua** — e o **fetch saiu junto**: dado que ninguém desenha é dado que alguém religa por descuido (a lição da conferência de saldo, 10/09).

**⛔ 3. O "R$ R$" ERA CLASSE, NÃO UM CANTO:** **13 ocorrências em 7 arquivos**. `formatBRL` usa `Intl` com `style:'currency'` e **já traz o cifrão**. ⚠️ O `totals-bar.tsx` documentava o bug desde a travessia e ele **renasceu em 6 telas** — *comentário não é guard*. Agora um guard varre `app/` e `components/`, ignorando comentário em bloco.

**PROVADO EM PROD, pelo caminho da tela (celular, sessão real):**
```
R$ 183,65 PJBANK  → card SIM · grupo "linha:cmtxpb1cd…" · nome "PJBANK PAGAMENTOS S.A."
                    oferece 180,00 "oficina" → diferença R$ 3,65 · OFERECE
R$ 111,21 MIXX    → card SIM · nome "MIXX PLAY - Pagamento"
                    oferece 109,00 "radio"   → diferença R$ 2,21 · OFERECE
?conta= isabel camera fria R$ 3.700,00 → 5 cards (a linha de R$ 3.700,00 entre eles)
CONTAS A PAGAR: "Análise de inadimplência" SUMIU ✓ · "0-30" SUMIU ✓ · "R$ R$" SUMIU ✓
```

**⚠️⚠️ REGRA 11 — 4 DEFEITOS REPOSTOS E **TRÊS VIERAM VERDES**, e a lição é a mesma de sempre com outra roupa:** o guard montava os cards **à mão** e testava a `agruparDTO` — repondo o `fornecedorId: ''` **na rota**, ele seguia verde. ***Guard que pergunta pro fixture em vez de perguntar a quem decide não prova nada.*** A decisão saiu pra `identidadeDoCard` e os três passaram a morder (2 · 1 · 1 vermelhos). ⚠️ E o guard do cifrão me pegou de volta: a 1ª versão limpava comentário **linha a linha** e acusou o `{/* … */}` de duas linhas que **documenta o próprio defeito**.

**9.800 verdes · TS 0 · deploy `S5aLScVIc8OkThnyEMcXm` 4/4.**

### ⛔⛔⛔ CONTAS A PAGAR — TRÊS STATUS, UMA RÉGUA, E A MAÇANETA À VISTA (13/09)

**⛔⛔ 1. "VENCE EM BREVE" MORREU COMO STATUS.** Decisão do dono: *"'Vence em 2 dias' é informação da COLUNA de vencimento, nunca um status/filtro/stat próprio."* ⭐ E como status ele fazia duas coisas erradas: era **SUBCONJUNTO de "a pagar"**, então a soma dos 4 cards (e o total do rodapé) contava a mesma conta **2×**; e o `3` era um número escolhido a dedo virando ESTADO — a família do `TETO = 25` hardcoded e do `30` da janela do "a vencer". **A informação não se perdeu**: virou `textoDoPrazo`, colado na data (*"14/09 · em 2d"*). O tipo tem 3 valores **por construção** — um `warn` novo não compila.

**⛔⛔⛔ 2. OS NÚMEROS DO TOPO BRIGAVAM — e a conta fecha AO CENTAVO.**
```
KPI VENCIDAS  34 · R$ 48.502,57   ← `dueDate < now`, um TIMESTAMP
AGING          9 · R$ 20.635,54   ← `bucketFor`, que compara por DIA
a diferença:  25 · R$ 27.867,03   ← as contas que vencem HOJE
9 + 25 = 34   ·   20.635,54 + 27.867,03 = 48.502,57
```
**Duas réguas pra mesma palavra** — e a lista tinha uma terceira (o preset "pagas" filtrava `status=RECONCILED` enquanto o card contava `paymentDate != null`).

⚠️⚠️ **E HAVIA UM SEGUNDO ERRO NO MESMO LUGAR: o servidor roda em UTC.** Às 23h12 de São Paulo o `new Date()` já diz **14/09** — então o dono, olhando à noite, via **25 contas vermelhas que ainda tinha o dia inteiro pra pagar**. É o mesmo fuso que fazia o card do cartão PF mentir 3 horas por dia (09/09).

⭐ **`lib/contas-pagar/escopo.ts` é o dono único:** `VENCIDA | A_PAGAR | PAGA`, pela fronteira do **dia do BRASIL**. Consumido pelos **stats**, pelo **aging**, pela **lista** e pelo **status visual** da tabela (`payableVisualStatus` virou casca — perdeu a régua própria). ⛔ **PAGA ganha de tudo**: paga com atraso não é vencida — não há ação pendente quando o dinheiro já saiu. ⚠️ E **A PAGAR carrega a sem-vencimento**, senão a soma dos três não fecha com o total.

**⭐⭐ E O NÚMERO É O FILTRO:** clicar no card manda o MESMO `escopo` que o servidor usou pra contar. ⚠️ Com `status: 'TODOS'` de propósito — deixar o filtro de status junto recortaria de novo por outra régua, que é como a lista mostrava "muito menos" do que o card dizia.

**⛔ 3. A MAÇANETA NA TABELA.** O dono: *"nenhuma linha tem 'procurar no extrato' à vista"*. Ele estava certo: o deep-link nasceu em 10/09 **dentro do menu ⋮**, o mesmo que não existir — a **7ª volta da "porta sem maçaneta"** e a lição de 30/08. Virou botão à vista em **VENCIDA** e em **PAGA** (toda paga desta tela é *paga-sem-vínculo*, pela decisão de 28/05); **não** aparece em A PAGAR, porque conta que não venceu não tem pagamento pra procurar. Mesmo deep-link, guard estrutural com auto-teste do detector.

**⭐⭐ E A CONCILIAÇÃO ENTROU NA MESMA FRONTEIRA** (*"as duas telas, uma verdade"*): o `resumirSemPar` usava `c.conta.data > agora`, o mesmo timestamp — às 23h ele e o Contas a Pagar dariam respostas diferentes pra mesma conta.

**PROVADO EM PROD, pela rota real:**
```
VENCIDAS   9 · R$  20.635,54     card diz   9 → lista tem   9 ✓
A PAGAR   87 · R$ 175.982,36     card diz  87 → lista tem  87 ✓
PAGAS    250 · R$ 220.353,76     card diz 250 → lista tem 250 ✓
INADIMPLÊNCIA 9 · R$ 20.635,54 → bate com o card VENCIDAS ✓
4º card "a vencer 3d" no payload: SUMIU ✓

BUNDLE: "Procurar no extrato" ✓ · "Vencidas" ✓ · "A pagar" ✓
        ⛔ "Vence em breve": SUMIU ✓ · "A vencer (3d)": SUMIU ✓
isabel camera fria R$ 3.700,00 → /conciliacao?conta=… → 200 ✓
```

**REGRA 11 — 5 defeitos repostos:** fronteira de volta ao timestamp (**4 vermelhos**) · fuso UTC no lugar do dia do Brasil (**5**) · PAGA deixando de ganhar de tudo (**2**) · maçaneta de volta pro menu ⋮ (**3**) · Conciliação com o timestamp (**1**).

**⚠️ 4 TESTES INVERTIDOS COM O MOTIVO ESCRITO:** os três que afirmavam `warn` como status, e o do `vencidasOnly` — que além do timestamp **atropelava o filtro de período** do dono (os dois escreviam em `where.dueDate`).

**9.787 verdes · TS 0 · deploys `tnQI9u_69G72Xfc9iNodF` e `VQqCVQcczykSC8yboN9fF`, os dois 4/4.**

### ⛔⛔⛔ OS 5 CASOS QUE NÃO APARECIAM PRA CASAR — E AS DUAS CAUSAS ERAM GERAIS (13/09)

**O dono trouxe 5 pagamentos reais, todos no extrato e invisíveis na fila.** A medição por id achou **duas causas de classe**, as duas maiores que o relato — e uma terceira que era só a maçaneta.

**⛔⛔ CAUSA 1 — BOLETO PAGO COM JUROS NUNCA ERA SUGERIDO.** Medido no `scoreMatch`: valor dentro de ±5% vale **25 pontos**; exato vale **50**. `FOCATTO 2.528,31 × 2.459,76` — **fornecedor EXATO**, descrição 81% parecida, 4 dias — soma **50 contra um corte de 70**. Ou seja: **o caso mais comum de conta vencida (boleto com juros/multa) era invisível por construção**, e isso explicava 4 dos 5.

⭐ **O conserto reusa o dono único dos degraus** (`avaliarDiferenca`, 12/09): quase-exato **com âncora de identidade** e dentro do **teto do gesto manual (10% da linha)** passa pelo corte, **em confiança BAIXA**. ⚠️ O score **não é inflado** — ele só deixa de ser filtro, exatamente como a porta do valor exato (09/09) e a da processadora (11/09).

⛔ **E o guard do falso-amigo continua barrando — isso foi MEDIDO, não suposto.** Repondo o defeito na condição nova a suíte ficou **verde**; ela só ficou vermelha ao remover o `continue` anterior (3 vermelhos). **Quem barra `aluguel caçula × DOCEOLI` é o guard de cima; a condição nova é cinto e suspensório**, e o comentário no código foi reescrito com essa verdade.

**⛔⛔ CAUSA 2 — 10 CONTAS EM ABERTO **SEM FORNECEDOR** (R$ 30.738,31) QUE NENHUM CARD ALCANÇAVA.** `oesa 1.759,44` · `oficina 180` · `radio 109` · `aluguel caçula 5.234` · fgts · inss · icms… Conta lançada à mão não tem FK, e **o card nasce de um fornecedor reconhecido** — era o débito registrado em 10/09 (*"sem fornecedor dos dois lados, o Find & Match não alcança"*) e nunca fechado.

⭐ O card passa a oferecê-las, e as três travas são o que separa isto do caça-níquel de 09/09: **só pela porta** (`?abrir=`, nunca na fila automática) · **nada pré-marcado** · **fora do atalho ⭐** (impossível por construção: `combinacoesQueFecham` só recebe as do fornecedor). ⚠️ E passam por uma **janela de VALOR**, não de data — sem nome, o tamanho é o único sinal, e despejar o FGTS de 8.072,17 numa linha de R$ 111,21 é a parede que o dono já recusou no "a vencer".

**⛔ CAUSA 3 — A PORTA EXISTIA E ESTAVA DENTRO DO MENU ⋮.** O dono: *"é onde eu estou quando quero casar; hoje só me oferecem categoria."* Ele estava certo: o deep-link nasceu em 10/09 **dentro do dropdown de 3 pontinhos**, que é o mesmo que não existir (a lição de 30/08 — *"ação escondida sem afordância não existe, principalmente no celular"*). Virou **botão à vista**, o MESMO deep-link.

**⭐⭐⭐ E O 5º CASO ERA OUTRA COISA: DUPLICATA DE CADASTRO POR SUFIXO SOCIETÁRIO.** `CIA DA FRUTA … LTDA` (sem CNPJ, MANUAL, 05/06) × `CIA DA FRUTA … EIRELI` (CNPJ 36603841000130, ESTOQUE_NF, 04/09) — a mesma empresa. As 2 contas abertas (**790,49 + 472,64 = 1.263,13, o valor EXATO da linha**) vivem na EIRELI, a linha empatava entre as duas e o reconhecedor devolvia **NULL** (trava certa: *"dois igualmente parecidos = não sei qual é"*).

⚠️⚠️ **É A FÁBRICA DOS 11 DUPLICADOS DE 11/09, E ELA NÃO TINHA FECHADO:** o fix daquele dia casa por nome **IDÊNTICO**, e `LTDA ≠ EIRELI`. A chave de identidade passou a **ignorar o sufixo societário no FIM do nome**. ⛔ **Não funde nada — é leitura**: os dois viram irmãos e o card oferece as contas dos dois. **Fundir cadastro segue sendo decisão do dono** (04/09).

**⭐⭐ A PROVA DA DÚVIDA VIROU TESTE PERMANENTE — e a resposta é NÃO.** `categorizar-nao-esconde-da-conciliacao.integration.test.ts` categoriza de verdade e roda as MESMAS funções da tela: a linha **continua disponível**, a conta **continua com sugestão**, o lote **não a perde**, e **só CONCILIAR a tira**. ⭐ Com o **contrafactual** da régua velha (`categoryId IS NULL`) — sem ele os outros quatro passariam verdes num mundo onde nada nunca filtrou por categoria. **Medido: não há caminho onde categoria esconde linha da fila.**

**PROVADO EM PROD, pela rota real (sessão de celular) — os 5, um a um:**
```
CIA DA FRUTA  1.263,13 → card ✓ · 790,49 ✓ + 472,64 ✓ marcadas  → diferença R$ 0,00 · FECHA ⭐
FOCATTO       2.528,31 → card ✓ · nota 2.459,76                  → diferença 68,55 · PERGUNTA
OESA          1.838,61 → card ✓ · [sem forn.] "oesa" 1.759,44    → diferença 79,17 · PERGUNTA
PJBANK          183,65 → card ✓ · [sem forn.] "oficina" 180,00   → diferença  3,65 · OFERECE
MIXX PLAY       111,21 → card ✓ · [sem forn.] "radio"  109,00    → diferença  2,21 · OFERECE

FILA: comSugestao 0 → 4      PENDENTES → 200 · botão "casar conta" à vista ✓
```

**REGRA 11 — 6 defeitos repostos, e TRÊS vieram VERDES**: (a) o `alguemDizQuemE` redundante (virou comentário com a medição, e o teste foi apontado pro `continue` que morde de verdade); (b) *"conta sem fornecedor nasce desmarcada"* não tinha ninguém conferindo → ganhou teste, e agora dá **2 vermelhos**; (c) *"não entra no atalho"* é **impossível por construção** — a asserção documenta, quem garante é a forma do código, e o comentário diz isso.

**⚠️ 1 TESTE INVERTIDO COM O MOTIVO ESCRITO:** o contrafactual do Cancian de 07/09 (*"sem os fornecedores o par SOME"*) — hoje ele aparece pela âncora `DESC_MUITO_SIMILAR`, **que o guard do falso-amigo já aceitava desde 11/09**. Entrou um teste novo provando que o falso-amigo continua barrado.

**9.759 verdes · TS 0 · deploys `WSgLTuKq5Z8Ppr6cHR8DS`, `-oKEfZvr4uZvc_uEx5Wkr` e `3TH4N984JQIEQkDgScHBU`, os três 4/4.**

### ✅ A CIA DA FRUTA FOI MESCLADA (13/09, autorizada pelo dono)

`pg_dump pre-mescla-cia-da-fruta-20260913-222443` (6,1 MB) antes; preview → aplicar, o protocolo dos 11 de 11/09.

**⚠️⚠️ E O SCRIPT PRECISOU DA MESMA CHAVE DA LEITURA — REGRA 4, que mordeu de verdade.** O `mesclar-fornecedores-duplicados.ts` tinha régua PRÓPRIA casando por nome **IDÊNTICO**, e foi por isso que a CIA DA FRUTA **escapou da rodada de 11/09**. Ele passou a importar `chaveDeIdentidadeDoFornecedor` da lib: *duas réguas de "é o mesmo fornecedor?" — uma na leitura, outra na mescla — é o caminho pro card tratar dois cadastros como um e a mescla se recusar a juntá-los.*

⭐ **E o rastro diz a VERDADE do que casou** — `"mesmo nome, sufixo societário diferente"`, não `"nome idêntico"`, que seria falso aqui.

**CONFERIDO DEPOIS:**
```
LTDA  [fs6zaj] ativo=false · 0 tx · rastro: mesclado em …z78jix39 (mesmo nome, sufixo societário diferente)
EIRELI[8jix39] ativo=true  · 10 tx        seletor: 70 → 69 ativos · órfãs: 0
a linha de 1.263,13 → reconhece a EIRELI direto (irmãos: 1)
⭐ e ela JÁ PAGA as duas: 790,49 + 472,64 = R$ 1.263,13 — soma exata, conciliadas pelo card
```

**⭐⭐ E A CHAVE NOVA FEZ APARECER UM SEGUNDO PAR — que a trava de 04/09 RECUSOU, corretamente:** `TOZZO ALIMENTOS` tem dois cadastros com **CNPJs diferentes** (`01314317000165` × `01314317000599` — mesma raiz, filial diferente). ⛔ *"Matriz e filial têm o mesmo nome"*: **não mescla**, e o script diz por quê. É a régua funcionando no primeiro caso que ela encontrou depois de ficar mais larga.

### ✅ A FÁBRICA NA ESCRITA FECHOU (13/09, autorizada pelo dono)

*"A ponte passa a procurar pela MESMA `chaveDeIdentidadeDoFornecedor` da leitura (sufixo societário fora), com as regras de 11/09 intactas."* **Uma régua, os dois lados** — `chaveDoNomeDoFornecedor` virou casca sobre a da leitura, e o POST manual (409-apontando + escape `permitirNomeDuplicado`) herda de graça.

**AS TRÊS REGRAS DE 11/09, INTACTAS E COM TESTE:** achou **sem CNPJ** → completa com o da SEFAZ e reusa · achou com o **MESMO CNPJ** → reusa · achou com **CNPJ DIFERENTE** → **cria** (matriz e filial têm o mesmo nome — a régua de 04/09 na origem).

**⭐⭐ E A TROCA FOI MEDIDA ANTES, contra os 69 cadastros reais** — porque isto é caminho de **ESCRITA** e a chave da leitura é agressiva de propósito (nasceu pra descrição de banco: corta `- Pagamento`, `| Pix`, datas e códigos no fim):
```
chave VELHA → 1 grupo com 2+ cadastros     chave NOVA → 1 grupo (o MESMO)
grupos que só a chave nova junta: 1 — o TOZZO, e a trava do CNPJ o RECUSA
```
**Zero colisão nova na base real.** ⚠️ O risco fica nomeado: fornecedor cujo nome TERMINE numa dessas palavras (`ALFA TED` → `alfa`) — não existe hoje, e o escape é o `permitirNomeDuplicado`.

**⚠️⚠️ E O GUARD DE 11/09 PEGOU UMA REGRESSÃO REAL NO CAMINHO.** Ao delegar, o teste do `DISTRIB. DE PROD. ALIMENT. LAMANA` ficou **vermelho**: `normalizeForMatch` só limpa pontuação **no FIM**, enquanto a régua da ponte já trocava **toda** pontuação por espaço desde 11/09 — e a **LAMANA é uma das 11 mescladas naquele dia**. Sem isso ela duplicaria de novo. ⭐ A chave compartilhada passou a colapsar pontuação interna, **o que deixa a LEITURA mais forte também**: até hoje o card tratava `DISTRIB. DE PROD.` e `DISTRIB DE PROD` como dois fornecedores.

**PROVADO EM PROD, contra os cadastros REAIS (read-only):**
```
"CIA DA FRUTA … LTDA" [36603841000130] → ⭐ REUSA a EIRELI (CNPJ)   ← a NF-e de amanhã
"TOZZO ALIMENTOS EIRELI" [01314317000599] → REUSA o cadastro da filial (CNPJ)
69 ativos · nomes que ainda aparecem 2×: 1 (o TOZZO — matriz + filial, por desenho)
```

**REGRA 11 — 3 defeitos repostos:** chave crua de volta na ponte (**3 vermelhos**) · pontuação interna sem colapsar, o caso LAMANA (**2**) · trava do CNPJ diferente caindo, fundindo matriz com filial (**1**).

⚠️ **RESÍDUO NOMEADO (medido, não consertado):** documento **SEM CNPJ** ao lado de um cadastro **COM CNPJ** ainda **cria** um segundo registro — o `semCnpj` procura cadastro sem CNPJ, e ali não há. **Não morde na NF-e** (documento fiscal sempre traz `emitCnpj`); morde só na **entrada manual** sem CNPJ digitado, que usa o mesmo `resolverFornecedor`. Reusar ali significaria **amarrar a compra a um CNPJ que o documento não declarou** — a direção conservadora é a que está no código. Fica registrado pro dia em que ele quiser decidir.

**9.768 verdes · TS 0 · deploy `U_bX3oIyb2ewqcYQtRBbC` 4/4.**



### ⭐⭐⭐ NOTA SEM VENCIMENTO VIRA CONTA A PAGAR — as 21 do F5 ganharam gesto (13/09)

**A história, nas palavras do dono:** *"no começo a conferência não tinha onde pôr vencimento; notas entraram só como estoque."* O **F5** conta o estrago desde 03/09: **21 notas · R$ 8.588,75** que passaram pelo estoque e nunca chegaram ao Contas a Pagar.

**⭐ MEDIDO EM PROD ANTES DE CODAR — e o dado apertou o desenho:** as **21 são sem duplicata NENHUMA no XML** (0 com duplicata). Não é boleto perdido: é nota de pix/dinheiro que entrou calada.

**O CASO QUE FECHA A CONTA (a régua do dono):** a linha da stone de **R$ 2.843,35 (08/09)** paga **6 notas** da MARIA LUIZA — 2 com conta (518,87 + 967,63 = **1.486,50**) e **4 invisíveis** (463,74 · 326,69 · 235,16 · 331,28 = **1.356,87**). **A diferença que o card não fechava eram exatamente elas.**

**⭐⭐ 1. O GESTO (`lib/stock/ponte/definir-parcelas.ts`) — ORQUESTRADOR, NÃO MOTOR NOVO.** Ele costura dois donos que já existiam: `salvarCombinado` (29/08 — dono de *"o que a gente combinou pagar"*, que já refaz a fila de sugestão na mesma transação) e `enviarParaContasPagar` (24/08 — **a única porta** que cria conta no financeiro). ⛔ Escrever a gravação aqui seria a segunda porta, que é o que o `@@unique` do `stock_payable_link` existe pra recusar.

⚠️ **Duas transações, de propósito, e o estado do meio é VISÍVEL:** se as parcelas gravarem e o envio falhar, a nota fica **na fila de envio** (o card de 30/08) — estado legítimo e à vista, não um buraco. Enfiar o envio na transação do combinado faria um fornecedor recusado **apagar as parcelas que o dono acabou de digitar**.

⚠️ **E a soma que não fecha AVISA, não trava** (a régua do combinado): boleto com juros embutido é o mundo real, e travar empurraria o dono a lançar por fora — que é literalmente o que produziu estas 21. Passa com o motivo escrito.

**⭐⭐ 2. O RECIBO PAROU DE FICAR MUDO — estado `A_DEFINIR`.** `combinadoDaNota` responde *"quais parcelas VALEM hoje"*, e parcela sem data **não vale** (não pode virar conta a pagar; `dueDate` alimenta fluxo de caixa e DRE). Resultado: a nota sem vencimento devolvia **lista vazia** e o recibo não mostrava nada — justamente onde havia dívida. **Vazio não é "não deve nada".** ⛔ E não nasceu um terceiro leitor: quem responde *"o que está sem data"* é o `parcelasSemData`, dono da pergunta desde 03/09 — o mesmo que alimenta o F5. ⚠️ O selo é **ÂMBAR, não cinza**: "a definir" é trabalho pendente, não informação neutra.

**⭐ 3. A FILA DAS 21 (o F5 virando TELA).** Lista em Recebimentos: fornecedor · nº · total · data de entrada, **cada linha abrindo o recibo**. ⛔⛔ E ela é a metade que faltava do card: o card já dizia *"N notas sem data"* desde 04/09 e levava pra uma tela que **não listava nenhuma** — o dono via o número e não tinha por onde começar. **É a 6ª volta da "porta sem maçaneta", do outro lado.** ⚠️ Nota sem conferência aparece **cinza dizendo o porquê**, nunca como link morto.

**⛔⛔ 4. A PORTA FECHA PRO FUTURO.** Nota sem duplicata no XML **não confirma sem resposta**: ou o dono digita o(s) vencimento(s), ou marca **"sem data — defino depois"**. O estado final é o mesmo de antes (A DEFINIR); o que muda é que ele virou **ESCOLHA**. Nas palavras do dono: ***"o silêncio era a fábrica dessas 21"***.

⚠️ **A trava mora no SERVIDOR**, não num diálogo de tela — a régua do FREIO da contagem (23/08): aviso que vive no componente some no dia em que a rota for chamada por outro caminho, **e foi por outro caminho que estas 21 entraram**. O botão desabilitado e o rótulo *"Diga como esta nota vai ser paga"* são UX; a recusa é do `confirmarConferencia`.

**PROVADO EM PROD, pelo caminho da tela (sessão real, celular):**
```
ROTA DA FILA → 21 notas sem vencimento · R$ 8.588,75 · com link pro recibo: 21 de 21
MARIA LUIZA na fila: 5 notas · R$ 1.852,69

PREVIEW das 4 (confirmar:false — NADA gravado):
  NF 68770459 · 463,74 → 200 · fecha com a nota ✓   NF 68815521 · 326,69 → 200 ✓
  NF 68824809 · 235,16 → 200 ✓                      NF 68850297 · 331,28 → 200 ✓
  as 4 somam 1.356,87  +  as 2 que já têm conta 1.486,50  =  2.843,37
  × a linha da stone 2.843,35 → diferença R$ 0,02  ⭐ dentro do degrau FECHA
  a fila continua 21 · ⛔ nada gravado

RECEBIMENTOS → 200 · "notas entraram sem vencimento" ✓ · "não viraram conta a pagar e não
               aparecem no fluxo de caixa" ✓ · "confira a nota primeiro" ✓
RECIBO       → 200 · "Definir parcelas e vencimentos" ✓ · A_DEFINIR ✓
CONFERÊNCIA  → 200 · "defino depois" ✓ · "Diga como esta nota vai ser paga" ✓
               ⛔ a frase passiva antiga ("ou deixe a definir"): SUMIU ✓
```

**REGRA 11 — 4 defeitos repostos:** recibo mudo na nota sem data (**1**) · a porta somindo (**2**) · o gesto renegociando por cima (**1**) · **e o D4 ficou VERDE** — dava pra apagar a resolução do `conferenceId` e a fila continuava listando o trabalho **sem jeito de alcançá-lo**. Ganhou teste próprio; é a mesma família da porta sem maçaneta.

**⚠️ 1 BLOCO DE TESTE INVERTIDO COM O MOTIVO ESCRITO:** ele afirmava *"sem preencher, o caminho de ontem continua"* — e o caminho de ontem é o que produziu as 21.

**⚠️ E A ORDEM DAS TRAVAS FICA REGISTRADA:** a porta do pagamento roda **antes** da validação de item (que vive dentro da transação), então nota com fator errado responde primeiro sobre o pagamento. Três fixtures de unidade passaram a mandar `semDataDefinirDepois` — o assunto delas é unidade, e a resposta honesta ali é *"defino depois"*.

**9.742 verdes · TS 0 · deploy `VbCxzTmVLJnbtXKGFcBW8` 4/4.**

**⛔ PENDENTE E É DO DONO — as 4 datas.** O preview fecha, mas **o vencimento é o do boleto, que está na mão dele** — e este módulo não inventa data (*"sem documento, quem sabe é o dono"*). As 4 esperam o clique em `Definir parcelas e vencimentos`; com as contas nascidas, o card da Maria Luiza passa a oferecer as 6 notas e a linha de 2.843,35 crava.

### ⭐⭐ PF — ESPINHA DE NAVEGAÇÃO, WIDGET DE CONTAS E O GRID POR HIERARQUIA (13/09)

**Deploy `Dn6OBbAu6bPFYc7oMZs_f` 4/4.** Quatro frentes numa: navegação, a porta do dado, a ordem dos cards e dois defeitos do print.

**⛔⛔ 1. A ESPINHA — e NÃO nasceu uma segunda sidebar: a que existe FOI LIMPA.** O PF tinha **9 itens**, e entre eles um **"Mês" apontando pro redirect que morreu no mesmo dia**, **DOIS** caminhos pro mesmo import (*"Extrato da conta"* e *"Importar extrato"*) e **TRÊS** formas de ver lançamento (*Despesas · Receitas · Movimentações*). ⭐ Ficou: **Meu Dinheiro · Contas · Cartões · Lançamentos · Relatórios**. *Menu com três portas pra mesma sala é o B1 em forma de navegação — e uma sidebar nova ao lado desta seria a quarta.*

**⛔⛔ E O QUE SAIU DO MENU NÃO FICOU ÓRFÃO.** `Despesas` e `Receitas` são telas VIVAS e **nada mais apontava pra elas** — eu ia criar a **6ª volta da porta sem maçaneta com as minhas próprias mãos**. Passaram a ser alcançadas **do topo de Lançamentos**, com botão à vista.

**⚠️⚠️ E ISSO ABRIU UMA TENSÃO COM O SPRINT DE 02/07, que fica registrada:** naquele dia Despesas ganhou *"lugar próprio no workspace PF"* **porque o gesto estava enterrado** dentro de `/transacoes`. Hoje ela voltou pra lá — mas **o defeito de 02/07 era o gesto enterrado SEM CAMINHO VISÍVEL**, e agora ele é um botão no topo. Os dois guards daquele sprint foram **reapontados** (de *"o item está no menu"* pra *"a tela está alcançável"*), com o porquê escrito nos dois.

**⭐ 2. BOTTOM-NAV no celular** (Início · Lançamentos · **＋** · Cartões · Contas). ⛔ **O FAB solto SAIU** — virou o **＋ central**: dois botões de lançar na mesma tela seriam dois gestos pra uma coisa só, e o de baixo cobriria o outro. **O modal é o mesmo.**

**⭐⭐ 3. O WIDGET "MINHAS CONTAS" na home, com "↑ extrato" POR CONTA.** *"A porta de entrada do dado ficou fora da home"* — e ele tem razão: o gesto que **alimenta o dashboard inteiro** vivia numa tela de cadastro, a dois cliques de onde ele olha os números. A **conferência** aparece ali (a casa dela desde 10/09), incluindo o *"nunca conferida"*.

**⭐ 4. O GRID PELA RÉGUA DELE:** *"quem AGE fica em cima (contas/cartões/vencer); quem ANALISA fica embaixo (donut/balanço)"*. E o **recebido da empresa virou FAIXA FINA** — *"é selo, não bloco gigante"*: ele ocupava um card do tamanho do donut pra dizer um número.

**⛔⛔ 5. OS DOIS DEFEITOS DO PRINT:** a pílula do "a vencer" dizia **"HOJE"** em fatura de **4 dias atrás** — *pílula que mente a data ensina a ignorar a pílula*. Agora mostra **a data do vencimento sempre**, em coral quando atrasada, e **"HOJE" só quando vence hoje de verdade**. E a data tem **um formato só**: `09/09`, nunca `9/09`.

**PROVADO EM PROD, no bundle e pela rota:**
```
espinha ✓ · bottom-nav ✓ · widget Minhas contas ✓ · ↑ extrato por conta ✓
faixa da empresa ✓ · grid de 12 ✓ · FAB solto: SUMIU ✓
[09 SET] fatura magazine luiza — atrasada 4d      selos: venceu 09/09 · venceu 10/09
[10 SET] fatura banrisul — atrasada 3d            L1 saldo/fluxo/CONTAS · L2 faixa
[15 SET] fatura nubank — estimada                 L3 donut/balanço(6m) · L4 cartões/(vencer+últimos)
/contas → 200 (viva pela espinha) · /transacoes → 200
```

**⚠️ QUATRO GUARDS REAPONTADOS, nenhum apagado** — e um deles me pegou de novo com **janela de ±400 caracteres**: ele quebrou **com a tela CERTA** quando os 5 itens viraram um fragmento único. *O que define o bloco é a ESTRUTURA, não a distância* (a lição do detector de rastro, 12/09). ⭐ E o guard de vazamento do menu ficou **mais afiado**: ele casava por **label**, e *"Relatórios"* do perfil colidia com *"Relatórios"* da empresa — **dois destinos, o mesmo nome**. Agora a régua é o **destino**: `@sempre` **nunca** aponta pra rota de `/empresas/`.

**REGRA 11 — 4 defeitos repostos, todos vermelhos.** **9.714 verdes · TS 0.**

### ⛔⛔ O DESKTOP ERA O CELULAR ESTICADO — O COCKPIT (13/09)

**O dono, no MacBook:** *"o mock era MOBILE e o desktop ficou uma coluna de 480px boiando no meio do monitor."* Virou a **REGRA 12** da casa (acima).

**O DESENHO:** barra fina de página (título · ‹ mês › · olhinho · **＋ Novo lançamento**) e **grid de 12 colunas, 1200px**: linha 1 `saldo · fluxo · empresa` (o hero gradiente vira **card roxo**, não banner), linha 2 `donut grande · balanço de 6 meses`, linha 3 `cartões · (a vencer + últimos)`. ⚠️ **O FAB flutuante fica só no celular** — é gesto de polegar; no mouse ele vira botão de barra, **com o MESMO campo de frase**.

**⭐⭐ FONTE ÚNICA DE WIDGET:** os 8 widgets moram em `widgets-pf.tsx` e são **os mesmos objetos** nas duas composições — o guard conta e exige **exatamente 2 usos** de cada. ⛔ E ele proíbe a composição redesenhar widget por conta própria (o donut na mão, a barra de limite na mão): seria o começo de duas telas divergentes.

**⭐ O BALANÇO É 6 MESES NO MONITOR E 4 NO BOLSO — e quem corta é a TELA**, não uma segunda consulta: o payload é o mesmo, senão o mesmo mês teria dois números dependendo do aparelho.

**⚠️ AS DUAS COMPOSIÇÕES VIVEM NO DOM e o CSS escolhe** (`lg:hidden` × `hidden lg:block`). Escolher por JS exigiria a largura no 1º render — que **no servidor não existe**: daria hydration mismatch, ou o app piscando o layout errado antes de trocar.

**⚠️ E O `hover` É `lg:` DE PROPÓSITO:** no toque o `:hover` **GRUDA** — o card fica com a sombra levantada depois do dedo sair, parecendo selecionado. Desktop tem mouse; celular não.

**⚠️⚠️ O MEU PRÓPRIO GUARD ACHOU UM DEFEITO DE DESENHO MEU:** eu tinha posto o *"a vencer"* na coluna 3 quando não há recebimento da empresa, **pra não deixar buraco** — e com isso o widget aparecia **duas vezes na mesma composição**. *Tapar buraco duplicando widget é o começo de duas telas divergentes.* **Quem se adapta é a LINHA**: sem a empresa, saldo e fluxo dividem as 12 colunas.

**⚠️⚠️ E A REGRA 11 ME PEGOU DUAS VEZES NO GUARD NOVO:** (a) o detector de largura fixa acusava os **próprios containers do grid**, porque `\b` casa **depois do hífen** de `max-w-[…]`; (b) o teste dos "3 lado a lado" **contava `col-span-`** — e **`col-span-12` casava**, então com os três cards empilhados (que É o defeito) ele ficava **verde**. Largura cheia num grid de 12 é o oposto de lado a lado. ⭐ E numa terceira volta ele quebrou por medir a LETRA (`col-span-4`) quando a classe virou variável, com a tela CERTA — *guard que mede texto e não composição vira falso vermelho no primeiro refactor legítimo*.

**REGRA 11 — 5 defeitos repostos, todos vermelhos:** o desktop virando a coluna de 480px (**4**) · a linha 1 empilhada (**1**) · o cockpit redesenhando o donut (**2**) · o hover vazando pro toque (**1**) · a faixa do tablet sumindo (**1**).

⚠️ **E dois guards anteriores foram REAPONTADOS, não afrouxados:** o do mock (os tokens se mudaram pro módulo de widgets) e o de "zero widget sem dado" — que agora mede a trava **DENTRO do widget**, e isso é **mais forte**: com duas composições, a trava na composição teria que ser lembrada duas vezes, e a segunda é a que alguém esquece.

**9.704 verdes · TS 0 · deploy `8sYjYGPJZRHYlyhvUXLAp` 4/4.**

### ⭐⭐⭐ PF — DASHBOARD "MEU DINHEIRO" + LANÇAMENTO POR FRASE (13/09)

**Mock versionado** em `docs/mocks/pf-dashboard-mock.html`, com guard que **lê o HTML** e compara token a token (o protocolo da Conciliação). Deploy `pW6SzxKDdLJQtOK3SF_va` 4/4.

**⭐ A ROTA DECIDIDA (o dono pediu pra eu escolher e dizer): o dashboard É `/perfis/[id]`, a HOME.** É onde ele cai ao entrar no workspace pessoal; pôr num endereço próprio deixaria a home velha viva ao lado, e *"qual é a tela do meu dinheiro?"* teria duas respostas. ⛔ **E `/perfis/[id]/mes` MORREU** — virou redirect. *"NUNCA dois painéis"* é ordem dele, e dois painéis do mesmo mês divergem na primeira régua nova.

**⭐⭐ FONTE ÚNICA, literal:** `montarDashboard` **não recalcula** ENTROU/SAIU/SOBROU — chama a MESMA `painelDoMes`, **e cada mês do balanço também**. O teste que morde compara o topo com o mês atual do balanço e exige igualdade.

**AS RÉGUAS DE HONESTIDADE, todas travadas:** previsto = saldo − **faturas conhecidas** (⛔ zero projeção de gasto inventado) · **cartão sem limite não ganha barra** · *"sem categoria"* tem **fatia própria em âmbar** (enterrá-la em "outras" esconderia o que pede ação) · pagamento de fatura **fora do SAIU** · o **olhinho esconde TODOS os números**, não só o hero · **zero widget sem dado** (investimento/metas/recorrentes não existem nem cinza).

**⭐⭐ LANÇAMENTO POR FRASE:** *"mercado 280,50"* · *"gastei 45 na farmácia"* · *"recebi 500 pix"* viram lançamento com a categoria sugerida pelas regras **DO PERFIL**. ⛔⛔ **SEM VALOR, SEM LANÇAMENTO** — descrição a gente deduz, sentido a gente deduz, **valor não**: um valor chutado é dinheiro errado no extrato dele, e o erro só aparece no fim do mês. ⚠️ **`1.280,50` não é R$ 1,28** — o ponto é milhar em pt-BR, a mesma armadilha que o campo de quantidade do estoque pagou em 08/09. Trocar a categoria **ENSINA** a regra.

**PROVADO EM PROD, navegando como celular:**
```
/perfis/<id> → 200      /perfis/<id>/mes → 307 → a home  ⭐ morreu
SETEMBRO  saldo 71.609,96 · previsto 42.315,32 (3 faturas)
   banrisul 18.593,16 [VENCIDA] 24% do limite · nubank 6.210,30 [ABERTA] 44%
   magalu 4.491,18 [VENCIDA] 69% · a vencer: 3, duas atrasadas + 1 estimada
   balanço jun 61k/22k · jul 72k/22k · ago 35k/35k · set* 38k/38k
AGOSTO    tudo recalcula (35.098,26) · o balanço anda pra mai-ago
FRASES    "mercado 280,50" → SAIDA 280,50 "Mercado"
          "gastei 45 na farmácia" → SAIDA 45,00 "Farmácia"
          "recebi 500 pix" → ENTRADA 500,00 "Pix"
          "almoço com a Daniela" → montou:false "não achei o valor" ⭐ não trava
```

**⚠️⚠️ DOIS ACHADOS NO DADO REAL, pro dono saber:**
1. **RECEITAS == DESPESAS e SOBROU R$ 0,00 em TODOS os meses.** Não é bug: **toda ponte PJ→PF cria o par** crédito *"Distribuição de Lucros"* + débito *"yussef gastos"* (o fluxo A/B *"já gastei esse dinheiro"*, de 10/08). O dinheiro entra e sai no mesmo gesto, então o PF nunca "sobra". ⭐ Quando o extrato da conta entrar, os gastos REAIS aparecem e o número passa a significar alguma coisa.
2. **"Recebido da empresa" conta 6 transferências em setembro, não 3** — as 3 que o dono cita mais outras com ponte no mesmo mês. O widget soma **todo crédito com ponte**, que é o que ele pediu.

⚠️ **E o guard de contrato de 27/08 foi REAPONTADO, não apagado** (a home mudou; a lição — *contrato quebrado dá silêncio* — não). O alvo novo expôs **duas cegueiras dele**: via só `fetch` cru (o dashboard usa `fetchJson`) e cortava o payload em **400 caracteres**, enxergando só o `{erro}` do 404. Os dois consertados.

**REGRA 11 — 5 defeitos repostos, todos vermelhos.** **9.688 verdes · TS 0.**

📋 **ROADMAP REGISTRADO, NÃO CONSTRUÍDO** (ordem do dono): **Fase 2** recorrentes + orçamento por categoria → é o que destrava a projeção estilo Meu Assessor na pílula do hero (*"contas fixas + média dos meses = o mês que vem já tem número"*). **Fase 3** o assessor por **WhatsApp** (lançar por mensagem/áudio, *"quanto gastei?"*, alerta de fatura — e falando PJ também: *"quanto a Caçula vendeu hoje?"*) — **visão, não item de sprint**: WhatsApp Business API é projeto próprio.

### ⛔⛔⛔ O GESTO SÓ EXISTIA POR ROTA — 5ª VOLTA DA "PORTA SEM MAÇANETA" (13/09)

**O dono, no celular:** *"o import de extrato existe (você provou pela rota: 3 casadas, 2 novas, aprender-na-conta) mas **NÃO TEM BOTÃO NA TELA**. Estou em /perfis/[id] → Contas bancárias: os 3 cards e 'Nova conta' — nenhum 'importar extrato' em card nenhum."*

**Ele estava certo, e o card era pior do que o relato:** um `<Card>` **MORTO** — sem botão, sem link, **sem nem responder ao toque**. O motor estava em prod, provado pela rota, e **inalcançável**. ⚠️ **Eu tinha posto o gesto na SIDEBAR e chamado de feito** — mas o dono não estava na sidebar, estava na **lista de contas**, que é onde a pergunta nasce.

**⭐⭐ A FAMÍLIA INTEIRA, agora com cinco voltas:** (1) 10/09 o card da conciliação nascia colapsado · (2) 10/09 o motor subiu e a tela não mudou · (3) 12/09 a porta do cardápio sumia quando a fila zerava · (4) 12/09 o produto individual nunca teve o gesto · **(5) hoje: o gesto só existia por rota**. ⭐ **A regra que fecha as cinco:** *se o motor está em prod, o dedo do dono tem que alcançar ele **a partir de onde ele ESTÁ*** — e não de onde eu achei natural pôr o link.

**O QUE FICOU:** o card ganha **"Importar extrato (OFX)"** apontando pra **aquela** conta (`?conta=`), a **conferência aparece ali** (a casa dela desde 10/09 — inclusive o *"nunca conferida"*, que não é defeito, é informação antes presumida), e a tela do extrato **abre falando daquela conta** (saldo, conferência, e se ela já tem identidade pra trava morder). ⚠️ E ela **não sobrescreve** a escolha que veio do card — perder no caminho a informação que a tela acabou de mostrar é obrigar o dono a escolher de novo.

**⚠️⚠️ E A PRIMEIRA PROVA FALHOU POR MÉTODO MEU, não por defeito:** eu conferi o **HTML servido** e deu *"⛔ o botão não está no card"* — a tela é **client-side**, os cards nascem do `fetch` e **não existem no primeiro paint**. A prova certa é o **BUNDLE que prod serve**, como em 10/09. *Medir no lugar errado dá um vermelho tão convincente quanto um defeito real.*

**PROVADO NO BUNDLE, navegando como celular:**
```
PAGE /perfis/<id>/contas → 200 · bundle 856 KB
   "Importar extrato (OFX)" ✓ · /extrato?conta= ✓ · "nunca conferida" ✓
   "confere com o banco" ✓ · "difere do banco em" ✓ · "Ver o mês" ✓
TOCO o botão → /extrato?conta=<banrisul> → 200 · bundle 821 KB
   lê ?conta= ✓ · "casam, não duplicam" ✓ · "de fatura reconhecido" ✓
   o aprender-na-conta ✓ · "sem identificação ainda" ✓
SUBO O OFX pela rota da tela:
   ⭐ CASADAS na ponte: 3 (10.000 · 3.500 · 21.000)
   ⭐ NOVAS: 2 · fatura encontrada: banrisul · aprender: {"041","0605534106"}
```
⛔ **Não confirmei** — a gravação é o clique do dono.

**O GUARD (`gesto-existe-na-tela-pf.test.ts`) PROVA OS DOIS LADOS:** o card não pode voltar a ser morto, o link não pode virar decorativo — **e as rotas por trás têm que EXISTIR e exigir o dono do perfil**. ⚠️ Guard que só olhasse a TELA aprovaria um botão apontando pro nada, que é o mesmo defeito de cabeça pra baixo. **REGRA 11 — 3 defeitos repostos, todos vermelhos. 9.596 verdes · TS 0 · deploy `jE1B8cwx9E6PiXW_cT6QO` 4/4.**

### ⭐⭐⭐ PF FASE 1 EM PROD (13/09) — EXTRATO DA CONTA · CASAMENTO COM A PONTE · PAINEL DO MÊS

**O desenho veio da investigação, item por item.** `pg_dump pre-pf-fase1-20260913-022651` (6,0 MB) antes da migration; deploy `p19qaHOzNljwql1pV37WX` 4/4.

**⭐⭐ O CASAMENTO É O CORAÇÃO — régua confirmada pelo dono:** *"a linha do extrato é o FATO, a tx da ponte é o REGISTRO do mesmo fato — o import CASA com a ponte existente, NUNCA cria segunda."*

**⛔⛔ E ELE NÃO PODE OLHAR O TEXTO.** A ponte diz *"Distribuição de Lucros caçula"* (as palavras do dono) e o banco dirá *"PIX RECEBIDO…"* — **o mesmo fato com dois nomes**. Casar por memo não casaria NADA. A régua é **data ±2d + valor exato + sentido**, e é estreita justamente porque não há texto pra desempatar. **Duas camadas:** identidade (`stableKey`, pro re-import) e o fato (a janela larga, só pra quem **não** tem `dedupHash`). ⚠️ **Dois candidatos = AMBÍGUA**, e o sistema não escolhe — casar com o errado amarraria a categoria de um gasto no outro.

**A TRAVA NASCEU JUNTO, como o dono exigiu.** O 1º import **propõe gravar `bankCode`/`accountNumber`** (o arquivo já diz quem é a conta) e a partir daí `verifyOfxMatchesAccount` morde. Teste prova: com a conta já identificada, um OFX do Sicredi na conta do Banrisul **bloqueia** com `OFX_BANK_MISMATCH`.

**ORQUESTRADOR FINO:** reusa `parseOFX` · `stableKey` · `resolveBankProfile` · `partitionFutureLines` — **zero gatilho de vendas/DRE/conciliação**, que não existem no PF. ⚠️ E **sem âncora no arquivo não se descarta nada**: o relógio não decide (a régua de 13/08).

**⭐ ITEM 2a JUNTO:** pagamento de fatura casa por **valor EXATO + janela do vencimento**, o cartão vira **paga ✓** sozinho, e **APRENDE a conta de pagamento no 1º casamento** (*"aprende, não pede cadastro antes"*). ⛔ **Cartão INATIVO nunca é candidato** — o perfil tem um `banrisul pf ****9113` **vazio e inativo** ao lado do `banrisul ****9113` com 277 transações; casar pelos 4 dígitos escolheria o morto. **Não houve mescla: não há o que absorver** (0 faturas, 0 tx, 0 imports).

**⭐ PAINEL DO MÊS:** ENTROU · SAIU · SOBROU + barras por categoria + contas com conferência + cartões. ⛔⛔ **O PAGAMENTO DE FATURA FICA FORA DO SAIU** — senão a mesma despesa conta **duas vezes** (a compra no mês em que foi feita, a fatura no mês em que foi paga) — e **aparece nomeado**, porque exclusão escondida é tão ruim quanto exclusão nenhuma (a régua do Fluxo da PJ, 25/08).

**PROVADO EM PROD, pelo motor real (preview, nada gravado):**
```
PAGE /mes · /extrato · /cartoes → 200
PAINEL 09/2026: ENTROU 38.090,00 · SAIU 38.090,00 · SOBROU 0,00 · 13 lançamentos
   yussef gastos 31.000 · nura 3.590 · Daniela 3.500 · sem categoria: 0
   ⭐ 1 pagamento de fatura FORA do SAIU

O OFX do banrisul PF com os 3 créditos da empresa:
   ⭐⭐ CASADAS: 3 — "já registrado como dinheiro vindo da empresa (ponte PJ→PF)"
   ⭐ NOVAS: 2 (a fatura de 18.593,16 e o mercado de 280,50)
   ⭐ PAGAMENTO DE FATURA: banrisul — valor exato da fatura 2026-08, que vence 10/09
   aprender na conta: {"bankCode":"041","accountNumber":"0605534106"}
```
⭐ **Os 3 créditos da empresa NÃO viram transação nova** — era exatamente o red-then-green pedido.

**⚠️⚠️ UMA RESSALVA QUE O DONO PRECISA SABER: o BATE/DIVERGE NÃO VAI FUNCIONAR NO BANRISUL.** O preview devolveu `SEM_DECLARADO` **com o `<LEDGERBAL>` dentro do arquivo** — e está **certo**: a ficha do Banrisul tem `ledgerBalReliable: false` desde 29/08, porque **o saldo declarado dele embute o bloqueado +24h** (provado com os 1.700 do card da PJ). A conferência vale nas outras contas; no Banrisul quem confere é o PDF, dia a dia — igual na empresa.

**REGRA 11 — 5 defeitos repostos, todos vermelhos:** o import criando tx nova pro dinheiro da ponte (**7**) · a trava da conta errada fora do caminho (**1**) · sem LEDGERBAL dizendo que BATE (**2**) · cartão inativo voltando a ser candidato (**1**) · uma tx manual casando com várias linhas (**1**). **⛔ Guard de isolamento PF↔PJ:** foto da PJ (contagens de `transactions`/`bankAccounts`/`categories`/`suppliers` + saldo da conta) **idêntica** depois de um import PF completo. **9.584 verdes · TS 0.**

📋 **FICA PRA FASE 2 (não construído, por ordem do dono):** orçamento/metas (*"meta sem histórico é chute"*), a hierarquia de categorias (o modelo suporta `parentId`, hoje 0 em uso) e a tela de classificar em lote — as **regras aprendidas do perfil nascem em 0** e só passam a existir quando o dono categorizar o primeiro extrato.

### 📋 PF FASE 1 — A INVESTIGAÇÃO (13/09). **Dois dos três itens já existem, e um COLIDE com o terceiro.**

**0.1 — CONTA BANCÁRIA PF: existem 3.** `nubank` (R$ 0) · `bradesco` (R$ 0) · **`banrisul` (R$ 71.609,96)**. ⚠️ **Nenhuma tem `bankCode` nem `accountNumber` preenchidos** — e é exatamente disso que vive a trava `verifyOfxMatchesAccount` (12/08), a que impediu 355 tx do Sicredi de entrarem na conta Stone. **Sem esses dois campos a trava não tem como conferir nada** e o import PF nasceria sem a proteção que a PJ tem.

**0.2 — O MOTOR DA PJ NÃO SE APONTA PRO PERFIL, e o import PF que existe é de CARTÃO.** `lib/ofx-card/` é card-only; o campo `PersonalOfxImport.bankAccountId` está no schema com o comentário *"reservado pra Fatia 3B (OFX de conta PF)"* — **planejado em 2026-06 e nunca construído**. **0 imports de OFX feitos no perfil.** O `runImportV2` da PJ escreve em `Transaction`/`BankAccount` e chama gatilho de vendas, conciliação e DRE — nada disso existe no PF. ⭐ **O que É reusável é a camada de baixo** (parser OFX, `stableKey`/dedup, perfil de banco, descarte de futuro); o que precisa nascer é um orquestrador PF fino.
⛔ **E FALTA A ÂNCORA: `PersonalBankAccount` não tem `ledgerBal`/`ledgerBalDate`.** A conferência BATE/DIVERGE pedida **não tem onde se apoiar** no PF — é migration aditiva de 2 colunas nullable.

**0.3 — CATEGORIAS PF: árvore PRÓPRIA, e está CERTA.** `personal_categories`, **23 categorias**, tabela separada, **zero vínculo com `Category`/`dreGroup`** — os dois mundos já estão separados como o dono exige. INCOME 6 (Salário · Outros recebimentos · **Retirada da empresa [BRIDGE_ENTRY]** · 3 inativas, as duplicatas já documentadas em 13/08) · EXPENSE 17 (Alimentação, Transporte, Moradia, Contas, Saúde, Educação, Lazer, Vestuário, Investimentos, Cartão de crédito, Empréstimos, Telefone, Viagem, Daniela, nura, yussef gastos, Outros). ⚠️ **Lista PLANA** (0 categorias com pai, embora o modelo suporte) e **0 `AiLearningRule` no perfil** — a categorização aprendida do PF **nunca aprendeu nada**.

**⭐⭐ ITEM 2b JÁ ESTÁ FEITO — e o red-then-green do dono JÁ É VERDE.** As três transferências têm **ponte `DISTRIBUICAO` + gasto**:
```
08/09 R$ 10.000 · sicredi · ponte SIM     09/09 R$ 3.500 · sicredi · ponte SIM
10/09 R$ 21.000 · sicredi · ponte SIM     84 pontes no perfil
```
E o dinheiro já está espelhado na PF: `CREDIT 21.000 "Distribuição de Lucros caçula"` + `DEBIT 21.000 "yussef gastos"` (o fluxo A/B de 10/08).

**⛔⛔ E DAÍ SAI A COLISÃO QUE PRECISA DE DECISÃO ANTES DE CONSTRUIR O ITEM 1:** quando o OFX do banrisul PF entrar, **esses mesmos créditos virão no arquivo** — e hoje viram **transação nova**, porque as 152 tx de conta do PF são `origin: MANUAL` **sem `dedupHash`**. Resultado: *o mesmo dinheiro duas vezes*, que é a doença que esta casa mais paga. **A régua honesta: a linha do extrato é o FATO, a tx da ponte é o REGISTRO do mesmo fato → o import CASA com ela (como o dedup da PJ faz), nunca cria a segunda.**

**⚠️ ITEM 2a — o `casar-pagamento` JÁ EXISTE** (rota + lib, 26/08); o que falta é **disparar no import**. Mas há dois obstáculos de DADO: **3 dos 4 cartões não têm `defaultPaymentAccountId`**, e existem **dois cartões com os mesmos 4 dígitos** (`banrisul pf ****9113` fecha 28 · `banrisul ****9113` fecha 29) — duplicata de cadastro que faria o casamento por nome/dígitos escolher o errado. É a família do Cancian (08/09), e o desenho certo é **nem criar a disputa**.

**📋 ESTADO PF MEDIDO:** 499 transações (347 `PDF_FATURA` de cartão · 152 `MANUAL` de conta) · **348 sem categoria** (as de fatura) · tx de conta por mês: jun 47 · jul 42 · ago 50 · **set 13**. Faturas: `banrisul 2026-08` OPEN R$ 18.593,16 (venceu 10/09) · `nubank 2026-09` OPEN R$ 6.210,30 · `magalu 2026-09` OPEN R$ 4.491,18.

### ⛔⛔⛔ O FILTRO DE TAREFA VAZAVA — PAINÉIS GERAIS DENTRO DO RECORTE (13/09)

**O dono, com o print:** filtrou *"metade de bolinha massa de pizza"* e a tela mostrava, **dentro do recorte**, *"Unidades por pessoa · todas as tarefas"* (rodrigo 1.415) e *"Geral do período"* (51 lotes, top queijo). **A tela dizia falar de massa de pizza e mostrava a cozinha inteira.**

**⚠️ A CAUSA RAIZ NÃO ERA O FILTRO — era a tela ESCOLHER A TAREFA SOZINHA.** Sem tarefa na URL ela adotava a que mais produziu e **seguia desenhando os painéis gerais embaixo**: recorte em cima, empresa inteira embaixo, sem ninguém dizer qual era qual. **O estado "todas as tarefas" virou EXPLÍCITO** (opção no topo do seletor, default ao abrir), o recorte mora **num lugar só** na rota, e o geral **só renderiza na visão geral**. ⭐ Na visão geral as **top tarefas viram LINKS** pro recorte de cada uma. **Mesmo princípio pra PESSOA** — e ali faltava o LOTE: as execuções já vinham filtradas, os lotes não.

**A VARREDURA, item a item:**

**⛔⛔ 1. `UN + KG` NUNCA SOMAM.** O placar dizia *"rodrigo 1.415,84 un"* — e aquele `,84` era **porção de queijo (UN) somada com massa de pizza (KG)**. O decimal estranho era o sintoma de um número que **não existe**. `somarQuantidades` virou o dono da pergunta *"quanto saiu?"* e devolve **"1.410 UN · 522 KG"**; a barra por pessoa passa a medir **LOTES** quando as unidades se misturam, e a tela **diz**. ⚠️ A casa já tinha essa disciplina no leitor mais antigo (`relatorio-por-pessoa.ts` recusa `min/un` com `unidades.size !== 1`, desde 06/09) — faltava ela existir no dono novo. ⭐ **E ordenar "top tarefa" por unidades era, ele próprio, comparar UN com KG**: passou a ser por **lotes**, com a razão escrita.

**⛔ 2. "MELHOR" NÃO DIZIA A RÉGUA.** *"melhor: 3h10 p/ 214 un"* num lote que era o **mais longo** do período. Virou **"melhor ritmo: 1,13 UN/min · 12/09 (214 UN em 3h10)"** — o rótulo carrega a conta.

**⭐ 3. O GRÁFICO NÃO INVENTA ZERO.** Dia **com lote e sem tempo medido** ganha marca vazada no eixo + nota (*"○ N dia(s) com lote e sem tempo medido — sem ponto, nunca zero"*); dia **sem lote** não entra no eixo. O volume do dia continua contado.

**⭐ 4. META PARCIAL É DITA:** *"2 de 3 lotes com meta · 104% nesses"* — nunca uma média silenciosa só dos que têm. O volume conta os três.

**⭐ 5. O FILTRO VIVE NA URL** (`router.replace`, não `push` — cada chip não merece entrada no histórico).

**PROVADO EM PROD, pelo caminho da tela:**
```
VISÃO GERAL   100 lotes · 10.421 UN · 22,86 KG  ⭐ (mista) · porTarefa: null
              top tarefas clicáveis: queijo 13L · calabresa 12L · coxão 10L · bacon 10L
              por pessoa: edmar 880,01 UN [barra=20 lotes] · rodrigo 1.420,34 UN [15 lotes]

FILTRO massa  3 lotes · 522 UN · média 162min · eliane 522 UN
              ⛔ "rodrigo" na tela inteira? NÃO ✓   ⛔ "queijo"? NÃO ✓
              o GERAL vem recortado: 3 lotes · top: só a massa
              melhor ritmo: 1,13 UN/min · 12/09 (214 UN em 3h10)
              série 10/09=129 · 11/09=168 · 12/09=190 (sem zeros inventados)

FILTRO edmar  só ele nas barras · top tarefas DELE · 19 lotes (a cozinha tinha 100)
```
**REGRA 11 — 8 defeitos repostos, todos vermelhos:** escopo sem recorte · soma mista · "melhor" por duração · rendimento espalhado · barra somando misto · geral sempre visível · auto-escolhe de volta · top tarefas não-clicáveis. **9.552 verdes · TS 0 · deploy `Vnx8a956PkqFAZU-3rjXW` 4/4.**

### ⛔⛔⛔ O LOTE RELÂMPAGO ENVENENAVA A MÉDIA — PISO DE 5 MIN (13/09)

**Decisão do dono, depois do raio-x:** *"Piso de 5 minutos: execução medida abaixo disso é RELÂMPAGO — conta à parte (como o 'sem tempo' já é), fora das médias, dito no rodapé. **Nenhum lote real fica pronto em menos de 5 min; registro retroativo é o caso, e vai se repetir.** Os 2 lotes atuais ficam classificados pelo piso — não mexe neles na mão, a régua resolve."*

**⚠️⚠️ A PERGUNTA *"esta duração conta na média?"* VIVIA COPIADA EM 7 LUGARES** (`minutos != null && minutos > 0`) — e foi exatamente por isso que o piso não tinha onde entrar. Virou **`foiMedido()` / `ehRelampago()`** em `desempenho.ts`, e os 7 passaram a consumir. É a lição do B1 outra vez: quando N leitores precisam da MESMA decisão, a decisão vira função.

**⛔ O TRABALHO NÃO SOME — essa é a metade que segura a régua.** O relâmpago sai do TEMPO e fica na PRODUÇÃO: `lotesRelampago`/`tarefasRelampago` contados à parte e **ditos na tela**, exatamente como o "sem tempo" já era. ⚠️ E **zero não é relâmpago**: zero é ausência de cronômetro, relâmpago é alguém tocando os dois botões seguidos — misturar apagaria uma distinção real.

**O EFEITO EM PROD, medido pela rota real — a régua estava envenenada e cobrava de gente:**
```
porçao queijo   média 44,3 → 87,7 min/lote   ·   mediana 26,5 → 84
melhor lote     "1min p/ 504 un" → "53min p/ 306 un"        ⭐ o falso recorde morreu
Cristian        "+98% vs média" → "registro retroativo (menos de 5 min) — sem ritmo medido"
rodrigo (12/09) "−19% · 2h07 (média 44min)" → "+9% vs média"  ⭐ MUDOU DE LADO
7 dias: 3 relâmpago · mês: 7 relâmpago — contados, ditos, fora do tempo
```
⭐ O rodrigo aparecia **abaixo da média** porque a média dele era metade do real. Não era desempenho: eram três toques de botão.

**⚠️⚠️ E EU QUASE MUDEI UMA DECISÃO DE 06/09 CALADO — os testes daquele dia me pararam.** Ao aplicar o piso na tela "Por pessoa", troquei a trava da coroa por *"conta quem tem relógio"*, o que fazia a pessoa cujo único concorrente era relâmpago **perder a coroa**. Mas a casa **já decidiu, por escrito**, que *"quem TEM minuto medido continua concorrendo, mesmo com um zero na mistura"* — e **relâmpago é o zero um minuto acima, não um caso novo**. Revertido. 📋 Fica a pergunta registrada pro dono: *coroar quem foi medido, quando o único concorrente não tem tempo medido, é prêmio disputado?* Hoje a resposta da casa é sim, e vale igual pros dois.

**⚠️ REGRA 11 REPROVOU MAIS UM GUARD MEU:** a exigência *"a tela DIZ o relâmpago"* **não tinha ninguém conferindo** — repus o defeito (tirei a frase do placar) e os 48 testes ficaram **VERDES**. Agora existe, e ele também proíbe **digitar o `5` em tela** (a lição do `TETO = 25` hardcoded e do `30` da janela do "a vencer"): o número vem do dono único ou não vem.

**REGRA 11 nos outros três, cada um com vermelho:** piso de volta a 0 → **19** · `relatorios.ts` com régua própria → **1** · a 7ª cópia com a régua velha → **2**. **9.525 verdes · TS 0 · deploy `oqV3Bap34r5uHaxqGXeKz` 4/4.**

### ✅ O EDITOR DE RECEITA **NÃO** PERDE COMPONENTE — investigado e inocentado (13/09)

**A pergunta do dono:** *"o editor PERDE componente ao salvar depois de uma mescla de itens? Reproduz: ficha com componente X → mescla o item X em outro → abre a ficha, salva sem mexer → o componente sumiu?"*

**⭐⭐ A CRONOLOGIA JÁ RESPONDIA, e ela é dura:**
```
19:08  o fantasma recebe a separação de −0,161
18:55  v1 da MAIONESE (COM vinagre)
19:23  v2 — SEM vinagre          ← a perda aconteceu AQUI
19:27  v3 e v4
19:58  A MESCLA acontece (estornos + re-entradas no item vivo)   ← 35 min DEPOIS
```
**O vinagre saiu da receita 35 minutos ANTES de existir mescla.** E é por isso que a v1 hoje aponta pro item vivo: a mescla das 19:58 repontou aquele componente depois. **O sumiço da v2 foi gesto de tela**, não efeito colateral.

**⛔ MAS CRONOLOGIA PROVA O CASO, NÃO A CLASSE** — então a classe ganhou teste (`editor-nao-perde-componente.integration.test.ts`, 6 casos rodando o caminho REAL: o mesmo `getFicha` que a tela carrega e o mesmo `atualizarFicha` que o PATCH chama). **Todos verdes:** a mescla **repõe** o componente (`updateMany`, sem unique pra colidir), o load devolve todos (`versaoView` não filtra nada), o save persiste todos, componente de item **desativado** sobrevive, mudar o corpo **sem** mandar a lista **herda** a receita, e lista vazia é **recusada**.

**⚠️⚠️ E A REGRA 11 IMPORTOU MAIS AQUI DO QUE DE COSTUME — porque o veredito é "não tem bug".** Um teste verde por vacuidade **inocentaria um defeito real**, que é o pior desfecho possível de uma investigação. Repus três defeitos:
| defeito reposto | mordeu? |
|---|---|
| a mescla NÃO repõe a ficha | ✓ vermelho na hora |
| o load descarta componente de item inativo | ⛔ **VERDE** — depois da mescla o componente aponta pro SOBREVIVENTE, que está ativo |
| `componentes` ausente vira lista vazia | ⛔ **VERDE** — o teste do "salvar só o preço" **nem alcança** a linha de herança (`valorVenda` sozinho não muda o corpo, e `atualizarFicha` retorna cedo) |

Os dois buracos viraram caso próprio: **item arquivado** com a ficha apontando pra ele, e **mudar o modo de preparo** sem mandar os componentes. Com eles, os três defeitos ficam vermelhos.

**9.531 verdes · TS 0.**

### 📋 OS DOIS VINAGRES — JÁ ESTAVAM RESOLVIDOS, E NÃO POR MIM (13/09)

**O dono autorizou aplicar; o preview quebrou porque o mundo mudou.** `scripts/vinagres.ts` procura `VINAGRE 750ML` e não acha mais — e a medição explicou: **o próprio dono fez a costura na tela em 12/09** (audit: sessão dele às 19:24), mesclando os três vinagres.

**O ESTADO MEDIDO HOJE — dois dos três passos estão feitos:**
```
✓ POSIÇÃO com UM vinagre só:  "VINAGRE" · 6,84 · R$ 47,75 · custo R$ 6,98
✓ o fantasma "VINAGRE 750ML (mesclado)" está INATIVO, saldo 0, a separação de −0,161 ESTORNADA
✓ as baixas MOVERAM pro item vivo (SEPARACAO_SAIDA −0,161 e PRODUCAO_CONSUMO −0,16)
✓ o ROSINA também foi absorvido (entrada de 4 × 5,75 estornada e refeita no vivo)
```
⚠️ **P1 NÃO QUEBROU** — minha primeira fórmula acusou `dif −0,16` no fantasma e **o juiz real não aponta nada**. É a lição de 09/09 ao pé da letra: *fórmula errada dá alarme com cara de achado*; P1 fecha **por ORDEM**, não por item.

**⛔⛔ MAS DUAS COISAS FICARAM, e NÃO apliquei nenhuma — a autorização era pra um plano que não existe mais:**

1. **A FICHA ATUAL DA MAIONESE NÃO TEM VINAGRE.** O componente `0,02 LT` só existe na **v1**; as v2/v3/v4 (criadas 19:23–19:27 da mesma noite, na sessão dele) têm **5 componentes, sem vinagre**. Ou seja: **produzir maionese hoje não baixa vinagre nenhum**. Não dá pra distinguir no dado se ele tirou de propósito ou se o editor perdeu o componente ao salvar depois da mescla — e adivinhar qual das duas seria decidir a receita por ele.
2. **A UNIDADE DIZ LT, A QUANTIDADE ESTÁ EM GARRAFA.** A reunitização de 12/09 usou **fator 1** (as entradas de 3 e 4 foram estornadas e refeitas **com a mesma quantidade**), não o **0,75** do plano. São **7 garrafas de 750 ml = 5,25 LT**, mas o item mostra **6,84 LT**. ⭐ O **valor está certo** (R$ 47,75, invariante); o rótulo é que não. Efeito prático: `0,02 LT` na receita viraria **15 ml em vez de 20 ml** — pequeno, mas é exatamente o que o fator 0,75 existia pra resolver.

### ⛔⛔⛔ A PORTA SUMIA QUANDO O TRABALHO ACABAVA — 4ª VOLTA DA FAMÍLIA (12/09)

**O dono:** *"existia um lugar pra trocar a seção de um produto do cardápio e ele não aparece mais. **Eu uso isso direto**."*

**⛔ MEDIDO EM PROD, e o relato estava certo em cheio:** a porta pra `/estoque/cardapio/secoes` renderizava **só** com `hub.linhas.some((l) => l.secaoSugerida)` — e a Caçula tem **166 produtos com ZERO sugeridos**. O link ficou **invisível**.

⚠️ **E o comentário original explicava a intenção:** *"só aparece quando ainda há produto sem seção CONFIRMADA — decisão pronta não pede gesto de novo"*. A intenção era boa; **o efeito é que REVER uma decisão virou impossível pela tela**. ⚠️ E o **produto individual nunca teve** o gesto — só o lote.

**⭐⭐ A REGRA QUE FICA, irmã da de 10/09 (*card que nasce escondido*):**

> **Fila zerada esconde o TRABALHO, nunca a FERRAMENTA.** O contador pode sumir; a porta não.

**O FIX:**
- **a tela do produto ganhou o seletor de SEÇÃO**, à vista no cabeçalho — e usa a **MESMA rota do lote** (ela aceita `min(1)`), então não nasce uma segunda porta de gravação;
- **a porta do lote fica SEMPRE**, e o que muda é o TEXTO: com pendência ela chama pro trabalho (*"N com seção sugerida — confirme de uma vez"*), sem pendência ela é a saída de revisão (*"166 produtos classificados · revisar ou remanejar em lote"*);
- o estado novo da tela vem do que o **SERVIDOR aceitou**, nunca do clique.

**PROVADO NAVEGANDO, pelo caminho dele (sessão real, sem URL secreta):**
```
PAGE /estoque/cardapio                → 200   (com 0 sugeridos, a porta está lá)
PRODUTO "CACHORRO QUENTE" · LANCHES
   detalhe → 200 · secao "LANCHES" · 10 seções pra escolher
   PAGE do produto → 200
TROCA LANCHES → DOCES → 200 {"ok":true,"produtos":1,"nomes":1}
PLACAR:  LANCHES 2 → 1  ·  DOCES 11 → 12   ⭐ reflete na hora
⭐ devolvido ao original ("LANCHES") — o cardápio dele não fica mexido pela prova
```
**GUARD NOVO** (`porta-nao-some-quando-o-trabalho-acaba.test.ts`): link de ferramenta **não pode ficar atrás de um contador de pendência**, com **auto-teste do detector nos dois sentidos** (pega o padrão antigo, não acusa o novo). **REGRA 11 — com a porta escondida de volta: 2 vermelhos.**

**9.398 verdes · TS 0 · deploy `NjyZMu3hh2xE9ycgyF0NM` 4/4.**


### ⭐⭐ A CATEGORIA DO ITEM VIROU EDITÁVEL + OS DOIS VINAGRES (12/09)

**O dono:** *"VINAGRE CBS VINHO TINTO 750ML marquei USO INTERNO por engano — o certo é MATÉRIA-PRIMA. **Não existe onde trocar**."*

**⚠️ MEDIDO ANTES DE ESCREVER QUALQUER COISA: a ROTA JÁ ACEITAVA `categoria`** no `patchSchema`. O que faltava era **a TELA** — a mesma anatomia do *"sumir com o item"* de 09/09, em que a régua existia há dias e o menu não oferecia o gesto.

**⭐ A INVESTIGAÇÃO QUE ELE PEDIU ("a categoria pesa em alguma derivação?"), respondida:**
| onde | pesa? |
|---|---|
| **CMV / DRE** | **não** — nenhum uso de `categoria` nos dois |
| Posição / contagem (`seContaFisicamente`) | exclui só `SABOR` e `PRODUTO_FINAL` → **trocar entre MATERIA_PRIMA e USO_INTERNO não muda nada** (teste prova) |
| busca de ingrediente da receita · etiqueta | **sim** — e é justamente o efeito que ele quer |
| `sugestoes.ts` | só palpita na **criação**, não relê depois |

⭐ Ou seja: a troca vale na **LEITURA, daqui pra frente**. **Nenhum movimento é reescrito** — história não se mexe. `stock_item_categoria_trocada` (CREATE-only, `CHECK de <> para`) guarda **de, para, quem e quando**: tabela própria porque a troca tem autor e é um fato por si, e o item pode mudar de ideia mais de uma vez.

⛔ **Item PRODUZIDO não troca por ali** (`SABOR`/`PRODUTO_FINAL`/`INTERMEDIARIO`): a categoria dele vem da FICHA, e mexer soltaria o item da receita que o produz.

**PROVADO EM PROD, pela rota real:**
```
ANTES:  VINAGRE CBS VINHO TINTO 750ML → USO_INTERNO
PATCH → HTTP 200
DEPOIS: MATERIA_PRIMA
RASTRO: USO_INTERNO → MATERIA_PRIMA por 05e9mg em 2026-09-12T19:55
POSIÇÃO: ⭐ aparece · saldo 7   (não mudou de tamanho, como o teste previu)
```
**9.392 verdes · TS 0 · deploy `PItscD9x_WHFcGK9fuKoJ` 4/4.**

### 📋 OS DOIS VINAGRES — PREVIEW PRONTO, ESPERANDO O OK (`scripts/vinagres.ts`)

**A aposta do dono se confirmou — é o padrão invólucro/garrafa — MAS com uma diferença que muda o conserto: as UNIDADES DIVERGEM.**
```
FANTASMA  VINAGRE 750ML (LT, MANUAL)      saldo −0,16 · custo R$ 0,00
          └ é componente da ficha da MAIONESE (0,02 LT) e o ÚNICO movimento dele
            é a SEPARAÇÃO de hoje
COMPRADO  VINAGRE CBS VINHO TINTO (UN)    saldo 7 · R$ 47,75 · 2 entradas de NF
          └ não é componente de ficha nenhuma
```
⭐ E há um **terceiro**, já resolvido: `VINAGRE TINTO ROSINA 750 ML (mesclado)` — inativo, entrada estornada, saldo 0.

**O CONSERTO, em três passos — e o passo 3 NÃO pode ser agora:**
```
1. REUNITIZAR o CBS de UN → LT (1 garrafa = 0,75 LT)
   7 UN → 5,25 LT · custo R$ 6,82/UN → R$ 9,10/LT · valor R$ 47,75 ⭐ INVARIANTE
   2 movimentos convertem · 0 bloqueios
2. a ficha da MAIONESE aponta pro CBS — a quantidade NÃO muda (0,02 LT segue 0,02 LT)
3. ⛔⛔ a baixa de −0,161 é a SEPARAÇÃO de uma ordem **EM_PRODUCAO**
```
**⛔⛔ MOVER A BAIXA AGORA QUEBRARIA O INVARIANTE P1** (`Σ separado == Σ consumido + Σ devolvido`). O material **já foi separado fisicamente** com o item fantasma; o certo é a ordem **fechar nela** e a costura vir depois. ⚠️ **Impacto financeiro de deixar: ZERO** — o movimento é a custo R$ 0,00.


### ⛔⛔⛔ A BEBIDA VENDIDA COMO COMPLEMENTO NÃO BAIXAVA (12/09)

**O dono:** *"COCA 2L é produto no cardápio E complemento quando o cliente adiciona. A do relatório de Produtos baixa certinho; a MESMA bebida no relatório de Complementos não baixa nada."*

**⚠️ A APOSTA DELE ERA *"bebida esbarra numa régua complemento = sabor"* — E O DADO REFUTOU.** Não existe régua nenhuma barrando: `baixaComplemento` aceita **qualquer** ficha (`alvoTipo === 'FICHA'`) e `upsertComplementoMap` também — o comentário de lá até explica que aceita `INTERMEDIARIO` **e** `PRODUTO_FINAL` de propósito.

**⭐ A CAUSA MEDIDA É OUTRA, e mais simples: são DOIS MAPAS e ninguém preencheu o de complementos.** Das **18 bebidas** do relatório, **18 pendentes** — e várias já com ficha no cardápio:
```
"COCA COLA 2L"  38 ocorrências em 6 dias · complemento PENDENTE | produto FICHA
"COCA ZERO 2L"  14 ocorrências em 6 dias · complemento PENDENTE | produto FICHA
"FANTA UVA 2L"   3 ocorrências           · complemento PENDENTE | produto FICHA
```
⚠️ Os dois mapas continuam separados **de propósito** (02/09: 25 nomes vivem nos dois relatórios, cada um com seu destino). O que faltava não era fundir — era **herdar** quando o nome é literalmente o mesmo.

**⭐ A RÉGUA É A DE 08/09, SEM AFROUXAR: canônico IDÊNTICO** (mesma string ignorando caixa, acento e espaço). Roda no **IMPORT** e **antes da baixa** — o mapa precisa existir quando o plano é montado, senão a bebida cai na prateleira e só baixa no reprocesso. Fail-soft: herdar é bônus.

**⛔ O QUE NÃO HERDA, e por quê:** `COCA LATA MAIS MINI FRITAS` **tem fritas dentro** — herdar por "parece" baixaria só a lata e esqueceria a batata. E **decisão do dono não se sobrescreve**: nome já `IGNORAR` continua ignorado (ignorar é uma resposta, não uma ausência).

**REGRA 11 — sem a herança: 2 vermelhos.** ⚠️ **E a primeira reposição do guard do combo NÃO mordeu:** casar por `includes` não fazia o combo entrar de verdade. O defeito que morde é casar pela **primeira palavra** — com ele, o teste do combo fica vermelho.

**9.385 verdes · TS 0 · deploy `XD4mdFyy6i758iAzd8cin` 4/4.**

### 📋 O RETROATIVO ESTÁ EM PREVIEW, ESPERANDO O OK (`scripts/retro-bebida.ts`)

**⚠️⚠️ E O PREVIEW MOSTROU QUE O DEFEITO ERA MAIOR QUE BEBIDA: são 13 nomes, 87 ocorrências, 6 dias.** `FEIJAO` (16), `XIS - CALABRESA` (4), `XIS - BACON` (2), `XIS - FRANGO`, `XIS - COXAO MOLE` e `pizza grande (35cm)` estavam no mesmo buraco — qualquer nome do complemento que já tinha destino no cardápio.

```
COCA COLA 2L     38 ocorr  ·  FEIJAO            16  ·  COCA ZERO 2L      14
XIS - CALABRESA   4        ·  FANTA UVA 2L       3  ·  FRUKI 2L           2
FANTA LARANJA 2L  2        ·  FANTA LARANJA LATA 2  ·  XIS - BACON        2
FANTA UVA LATA    1        ·  pizza grande(35cm) 1  ·  XIS - COXAO MOLE   1
XIS - FRANGO      1
```

### ✅ APLICADO NOS 13 (12/09, autorizado pelo dono)

**A pergunta dele sobre a PIZZA foi respondida ANTES de aplicar:** a ficha da `Pizza Grande (35cm)` baixa **`2 × porção queijo 135 grama`** — a **base**. Os **54 sabores** já mapeados baixam **proteína** (calabresa, frango, bacon, coxão). **Interseção: NENHUMA** — conferido contra os 54, não contra uma amostra. Sem dobra de porção; a pizza entrou.

`pg_dump pre-heranca-complemento-20260912-013130.dump` (6,0 MB) antes. **13 heranças gravadas · 6 dias reprocessados** (02, 03, 04, 06, 10 e 11/09).

**SALDOS PRA O DONO BATER COM A COZINHA:**
```
COCA-COLA 2L                      144 UN · custo R$ 8,08 · valor R$ 1.164,23
COCA COLA Zero 2L                  30 UN · custo R$ 8,11 · valor R$   243,22
FEIJAO PRETO CALDO DE OURO 1K   12,12 KG · custo R$ 7,80 · valor R$    94,52

o que o COMPLEMENTO baixou (todos os dias):
   COCA-COLA 2L −38 · COCA Zero 2L −14 · PAO DE XIS −8 · OVO −8
   (e os sabores de sempre: calabresa −931, frango −519, coxão −503, bacon −476)
```

**⚠️ ACHADO NO CAMINHO, e NÃO é o estado impossível:** `porçao calabresa ralada 50 grama` está com **saldo −99 e valor −R$ 21,60**. ⭐ **Saldo negativo COM valor negativo é coerente** — é o sinal *"vendeu sem produzir"* que o módulo trata como comportamento certo desde 09/09. O guard de 11/09 barra **saldo ≥ 0 com valor < 0**, que é outro estado. Medido no ledger: **154 vendidas contra 71 produzidas** — ou a cozinha produziu menos, ou a produção não foi lançada. **É informação pro dono, não defeito.**

**⚠️ MEDIDO ANTES DE PEDIR O OK — os 13 vendem nos DOIS relatórios, e no MESMO dia:**
```
COCA COLA 2L   complemento 38 em 6d · produto 107 em 7d · mesmo dia nos dois: 6
FEIJAO         complemento 16 em 5d · produto  27 em 6d · mesmo dia: 5
XIS-CALABRESA  complemento  4 em 2d · produto   8 em 4d · mesmo dia: 1
```
⭐ Pra **bebida** o dono já disse que são **duas vendas** (*"a mesma garrafa, uma por caminho"*). Pra **XIS, FEIJÃO e pizza** a mesma lógica provavelmente vale (adicional, acompanhamento) — **mas eu não posso afirmar**, e aplicar em todos sem ele dizer seria decidir por ele num número que sai do estoque.


### ⛔⛔⛔ O SERVIDOR RECUSAVA O QUE A TELA OFERECIA — E A CAUSA NÃO ERA A RÉGUA (12/09)

**O dono, conciliando a OESA:** linha **1.695,27** × NF 3866696 de **1.641,12**, os **54,15** de multa+juros (3,3% da linha, dentro do gesto explícito de ontem). A tela acendeu o Conciliar e veio:

> *"Soma 1 candidate(s) (R$ 1641.12) não bate com OFX (R$ 1695.27). Diferença: R$ 54.15. **Tolerância máxima: R$ 0.02**."*

**⭐ O MAPA DAS RÉGUAS (ele pediu, e eram CINCO):**

| onde mora | valor | o que mede |
|---|---|---|
| `escolher-na-mao` `TOLERANCIA` | 0,02 | "fecha ao centavo" (card + baixa parcial) |
| `escolher-na-mao` `TETO_DA_DIFERENCA` | 25 | o que o sistema **oferece** nomeado |
| `escolher-na-mao` gesto manual | 10% | o que o **dono** confirma (11/09) |
| **`/find-and-match/reconcile` `SUM_TOLERANCE`** | **0,02** | **a régua do SERVIDOR** ← a terceira |
| `reconcile.ts` `AMOUNT_EQ_TOLERANCE` | 0,01 | bate o `diferencaAceita` ao centavo |

**⛔⛔ MAS A CAUSA NÃO ERA A RÉGUA DE 0,02 — era mais simples e pior: o card COLETAVA o nome da diferença, acendia o botão com ele e NUNCA O ENVIAVA.** O POST ia só com `candidateIds`; o servidor não tinha como saber que havia algo confirmado, e recusava **com razão**. ⭐ *A régua de 0,02 media a coisa certa — "a soma fecha?" — e não fazia a segunda pergunta: "e se não fecha, o dono nomeou?"*

**⭐ O FIX DE CLASSE (`regua-da-diferenca.ts`): quatro chamadores, uma função.** Card, Find & Match, lote e **servidor** passam pelos mesmos degraus — `FECHA` (≤0,02) · `OFERECE` (≤25) · `PERGUNTA` (≤10% da linha) · `RECUSA`. ⚠️ **O degrau NÃO muda quando o dono marca a caixinha** (só o `podeFechar`): senão a tela mudaria de degrau no clique e o servidor avaliaria outro. Um teste **varre de 0 a 20% da linha** e exige que tela e servidor **nunca** discordem.

⚠️ **E A MENSAGEM PASSOU A DIZER O QUE FAZER:** *"Diferença de R$ 54,15 — confirme na tela que é juros/multa pra conciliar"*. *"Tolerância máxima: R$ 0,02"* mandava o dono procurar um erro que não existia — ele sabia que era juros.

### ⛔⛔ E O RASTRO SÓ EXISTIA NUM DOS DOIS RAMOS

A OESA fechou (HTTP 200, RECONCILED) e o `notes` ficou **sem uma linha explicando**. Medido no audit: `diferencaAceita: undefined · mode: CLASSIC`. **O texto do rastro vivia só no ramo `EFFECTED_ORPHAN`** — o caso do Cancian (07/09), que era ex-payable já paga. **Conta em aberto normal segue o ramo CLASSIC**, e por ali não passava nada. É a família *"N caminhos, 1 esquecido"*, a mesma do estorno de cartão e do gatilho de vendas. Agora o texto é montado **uma vez**, antes da bifurcação.

⚠️ **O rastro vai na PRIMEIRA nota do grupo, não em todas:** a diferença é do **pagamento**, não de cada nota — escrevê-la nas cinco faria quem lê a segunda achar que houve 54,15 de juros ali também, e o grupo "somaria" R$ 270,75 que nunca existiram.

**PROVADO EM PROD, pela rota real, com o caso dele:**
```
SEM NOMEAR         → HTTP 422: "Diferença de R$ 54,15 — confirme na tela que é
                                juros/multa pra conciliar · marcado R$ 1641.12
                                × linha R$ 1695.27"
COM 54,15 NOMEADOS → HTTP 200: reconciled 1 · failed 0

A NOTA: RECONCILED · vínculo sim
⭐ RASTRO: "… · pagamento conciliado com a linha do extrato de 2026-09-11
   (R$ 1695.27) · diferença de R$ 54.15 = juros/tarifa de boleto,
   confirmada por quem conciliou"
```
⭐ **Os irmãos entram pelo mesmo gesto** (travado em teste com os números reais): **Focatto 68,55 · Cia da Fruta 32,35 · Box 63,78 · Ivan 69,50** — todos no degrau `PERGUNTA`, todos aceitos pelo servidor quando nomeados.

**REGRA 11 — 3 defeitos repostos:** card sem enviar → **1 vermelho** · régua de 0,02 solta de volta → **1** · ramo CLASSIC sem o rastro → **1**.

**⚠️⚠️ E A REGRA 11 REPROVOU DOIS GUARDS MEUS NO CAMINHO:** (a) o detector do rastro olhava uma **janela de 3.500 caracteres** em volta do `mode:` — e ela alcançava a **declaração** lá de cima, então remover o uso no CLASSIC deixava tudo verde; o que morde é contar o **USO**. (b) o guard do POST cortava o corpo em `'}),'` e parava no **spread interno**, acusando um campo que estava lá. **Guard novo só conta depois de rodar contra o defeito que o motivou — inclusive contra os defeitos dele mesmo.**

**9.378 verdes · TS 0 · deploys `Jh5E4QPQt7qRY9rfwCdZp` e `kX_Xe0qWe7edxs0S_LL6i`, os dois 4/4.**

⚠️ **A régua de 0,02 NÃO morreu — ela virou o degrau `FECHA`**, que é o papel legítimo dela: arredondamento bancário de um centavo não é diferença, é ruído. O que morreu foi ela ser **a única pergunta** do servidor.


### ⭐⭐⭐ O MATCHER APRESENTA O QUE JÁ ESTAVA NO EXTRATO (11-12/09)

**O dono cruzou os 99 débitos da Stone com o Contas a Pagar:** *"a maioria dos 'sumidos' ESTÁ no extrato — **o matcher é que não apresenta**."* Medido caso a caso, rodando o matcher de verdade antes de escrever régua nenhuma:

```
ELETROSUL 143,03 × conta manual "eletrosul" 143,00  →  60 pts  (corte 70) ⛔
Casper   2.120,81 × manual "casper"       2.113,83  →  60 pts ⛔
PJBANK   2.222,88 × "aluguel escritorio"  2.222,81  →  65 pts ⛔
⛔⛔ aluguel caçula 5.234,00 × DOCEOLI 5.234,88     →  70 pts: PASSAVA
```

**⭐ 1. A DIFERENÇA QUE O DONO NOMEIA — DOIS TETOS COM PAPÉIS DIFERENTES.** *"O teto de R$ 25 vale pro que o sistema SUGERE sozinho; acima dele, aparece o gesto explícito."* Até 25 o sistema **oferece**; entre 25 e **10% da linha** ele **pergunta com o valor em destaque** (*"a diferença de R$ 45,60 é juros/multa de atraso — confirmar"*); acima de 10% **não existe gesto** — o teste do *"500 de juros numa nota de 600"* trava isso. ⛔ E sem NOMEAR não fecha em nenhum dos dois.

**⭐ 2. A CONTA MANUAL TAMBÉM TEM NOME** (`nome-da-conta-manual.ts`). Conta sem FK nunca ganha os 15 do `FORNECEDOR_IGUAL` — e era exatamente isso que faltava, **com o nome escrito nos dois lados**. ⚠️ Palavra que descreve a NATUREZA do gasto (*aluguel, fgts, salario*) **não identifica ninguém** e fica de fora: casar por assunto é palpite.

**⛔⛔⛔ 6. O GUARD DO FALSO-AMIGO — a trava que protege todo o resto.** *"Quase-exato SEM nome compatível NUNCA sugere; diferença de centavos não compra identidade."* ⭐ **E ele só é possível por causa do item 2**: quando dá pra perguntar *"o nome bate?"*, dá pra **recusar** quem não bate. Valor **EXATO** continua passando sozinho (o sinal mais forte do domínio, com a janela curta impedindo coincidência).

**⭐ 5. O INTERMEDIÁRIO DE BOLETO, com exceção NOMEADA e estreita.** Na linha da PJBANK **ninguém pode dizer o beneficiário** — o banco vê a processadora. Lista **fechada**, só com data D0/D1, **sempre com o aviso na cara**, nascendo em confiança **baixa**. E **o vínculo ensina**: tabela CREATE-only, e na segunda vez a frase vira *"PJBANK costuma ser o boleto desta conta (3× confirmado por você)"*.

⚠️ **UMA CONTRADIÇÃO ENTRE OS PEDIDOS, RESOLVIDA E REGISTRADA:** `MIXX PLAY 111,21 × "radio" 109,00` é **exatamente** um quase-exato sem nome compatível — o item 2 o quer oferecido e o item 6 o proíbe. **O dono sabe que a MIXX é o rádio; o sistema não tem como saber.** Ficou barrado, e a saída é a do item 5: ele vincula uma vez pelo Find & Match e o padrão passa a ser conhecido.

⚠️ **E O `const TETO = 25` ESTAVA HARDCODED NA TELA** — número solto é a segunda régua no dia em que o teto muda, a mesma doença que o `30` da janela do "a vencer" já tinha ensinado. Agora vem do dono único.

**⚠️⚠️ A REGRA 11 ME CORRIGIU NUMA AFIRMAÇÃO MINHA.** Anunciei como bug que `'BOLETO'` normaliza pra **string vazia** e que `includes('')` faria **toda** linha virar processadora, derrubando o guard. **Repus o defeito e os 19 testes ficaram VERDES**: o `if (!achada) return null` já barrava, porque string vazia é *falsy*. O filtro ficou — a proteção era **acidental** e agora é **explícita** —, mas o comentário foi reescrito com a verdade.

**PROVADO EM PROD, pelas funções que a tela chama:**
```
casper              R$ 2.113,83 ← R$ 2.120,81  score 75 · "CASPER" aparece nos dois
ELETROSUL              R$ 40,00 ←    R$ 40,02  score 75 · "ELETROSUL" aparece nos dois
eletrosul             R$ 143,00 ←   R$ 143,03  score 75
box paper           R$ 5.211,85 ← R$ 5.211,85  score 75 · valor exato
aluguel escritorio  R$ 2.222,81 ← R$ 2.222,88  score 65 [baixa]
   ⚠️ pagamento via processadora de boleto (PJBANK) — ela não diz o beneficiário, confere antes

⛔ GUARD: "aluguel caçula" tem sugestão? NÃO (DOCEOLI barrada) ⭐
⭐ item 4: as linhas NOVAS de 11/09 entraram nos cards sozinhas —
   BOX PAPER 2.143,91 · OESA 1.695,27 · CASPER 2.120,81
```
**REGRA 11 — 2 defeitos repostos:** sem o guard do falso-amigo → **1 vermelho** · sem os pontos do nome manual → **4**. **1 teste invertido com o motivo escrito** (o Ivan: 69,50 é 3,5% da linha e agora fecha com ele nomeando). **9.356 verdes · TS 0 · deploy `evIGNEOToFXeSDMt34Dfq` 4/4.**

⚠️ **DÉBITO REGISTRADO, NÃO FEITO:** o card do "escolher na mão" **remonta a conta do rodapé por conta própria** em vez de chamar `contaDoRodape`. Hoje os dois concordam (o TETO já vem do dono único), mas é a segunda derivação que esta casa combate — e ela diverge no primeiro caso de borda.

⚠️ **E O ITEM 3 SE RESOLVEU SOZINHO ENQUANTO EU MEDIA:** dos 6 "exatos não oferecidos", **o dono conciliou 5 às 02:25** (o audit mostra os 5 `UPDATE Reconciliation`) e o Frigorífico já estava vinculado há dias. **Não tenho como provar que eles não foram oferecidos antes** — o estado mudou debaixo da medição, e afirmar a causa sem o estado seria inventar.


### ⭐⭐⭐ CORTE DE ÉPOCA NA CONCILIAÇÃO + O RAIO-X DE SETEMBRO (11/09)

**O dono:** *"Comecei a usar a conciliação em setembro; agosto fica pra trás POR DECISÃO — as linhas de agosto já estão categorizadas como despesa, completas no DRE; não vou caçar par de conta velha."*

**⛔⛔ O CORTE É DA VITRINE, NUNCA DO DADO.** A linha anterior continua nas Movimentações, continua no DRE e o **Find & Match manual ainda a acha** quando ele procura. O que encolhe é a fila parar de empurrar trabalho que ele recusou. ⚠️ É a diferença que separa isto do *"AGOSTO É O PISO"* das vendas: lá o piso é do **MOTOR** (o dado pré-corte nem existe), aqui é só da **VITRINE**.

**⭐ CONFIG DA EMPRESA, não constante** — `Company.conciliarAPartirDe` (migration **aditiva pura**, coluna nullable; `null` = sem corte = o comportamento de hoje pra toda empresa existente). Empresa nova define a dela no onboarding.

**⚠️ `comCorte` JUNTA O CORTE COM A JANELA SEM PERDER NENHUM DOS DOIS** — o `gte` que vale é o **mais restritivo**. Escrever o corte por cima apagaria a janela de ±N dias em silêncio, e ela existe pra não casar pagamento com conta de três meses atrás: o bug apareceria como *"a fila oferece linha velha demais"* num lugar e *"a fila esqueceu de olhar"* noutro.

Aplicado nas **4 consultas que OFERECEM** (`contasEsperandoPagamento`, `lotesDaFila`, `sugestoesParaPendentes`) — e o **badge deriva das mesmas**, então menu e tela não têm como divergir. **A tela DIZ o corte**, com o gesto de mudar ao lado: fila mostrando menos do que existe **precisa dizer por quê**, senão o dono procura o card que não vê.

**PROVADO EM PROD (corte 01/09/2026 aplicado na Caçula):**
```
ANTES (sem corte):  16 linhas oferecidas · 10 delas PRÉ-01/09
DEPOIS:              6 linhas oferecidas ·  0 pré-01/09  ⭐
```
**REGRA 11 — sem `comCorte` nas queries: 2 vermelhos. 9.337 verdes · TS 0 · deploy `vCD0uPJePbl3A0x-Fc-wI` 4/4.**

### 📋 O RAIO-X DAS 95 CONTAS DE SETEMBRO (pós-mescla, pós-corte)

**95 contas em aberto · R$ 183.061,40**, e a prestação de contas grupo a grupo:

| grupo | quantas | valor | o que é |
|---|---|---|---|
| **(a)** par/lote sugerido | **0** | — | nenhuma fecha sozinha hoje |
| **(b)** card no "pra tua mão" | **31** | R$ 64.977,65 | a linha existe, não fecha — é o clique dele |
| **(c1)** vencida **sem linha** | **25** | R$ 28.786,39 | *"paguei por onde?"* |
| **(c2)** ainda não venceu | **39** | R$ 89.297,36 | estado normal, **não é buraco** |
| **(d)** paga sem vínculo | **0** | — | a dupla contagem está zerada |

**⛔⛔ E A RESPOSTA DO (c1) É DURA: nenhuma das 25 tem um débito de valor exato em conta nenhuma desde 01/09** — nem OFX, nem manual. Elas não estão "perdidas na tela": **o pagamento delas não está no sistema**.

**⭐ O CANDIDATO MAIS FORTE, medido:** o **banco caixa está sem extrato desde 28/08** (0 linhas ≥ 01/09), enquanto banrisul, sicredi e stone estão importados até 10/09 e o cofre até 11/09. Pagamento feito por ali em setembro **não tem como aparecer**.

**⚠️⚠️ E UM PONTO CEGO REAL, ACHADO NO CAMINHO — a fila só oferece `origin: 'OFX'`.** Há **25 débitos MANUAIS sem vínculo** no cofre desde 01/09 (R$ 67.220,90) que a conciliação **nunca oferece**, por construção. ⭐ **Medi antes de chamar de causa: NENHUM deles casa por valor com conta em aberto** — são salários, entregadores e a devolução de mútuo da Arafat (R$ 50.000 em 01/09). **O ponto cego existe e fica registrado; ele não explica as 25.**

**⚠️ E UMA CORREÇÃO NO QUE O DONO LEMBROU:** os PIX pro PF são **R$ 10.000 (08/09)** e **R$ 21.000 (10/09)**, os dois no sicredi e categorizados como Distribuição de Lucros — não *"10.000 e 8.000"*. Há ainda um de **R$ 3.500 (09/09)** pra outro CPF, mesma categoria.


### ⛔⛔⛔ A CORREÇÃO DE UNIDADE VIRAVA A ENTRADA E NÃO VIRAVA O ITEM (11/09)

**O dono, depois de conferir a NF 179646 da LATICINIOS SANTO CRISTO:** *"troquei pra KG (1 peça = 2 KG), a tela mostrou certo, confirmei — o recibo diz '16 UN → Recebido 32 · custo 34,45' (**conta certa!**) mas NO ESTOQUE o item segue 'controle em UN' com o 32 entrando como unidades."* **Sucesso disfarçado, e o diagnóstico dele estava certo.**

**MEDIDO COM OS IDS, antes de tocar em código:** a entrada gravou **perfeita** (32 × R$ 34,45 = R$ 1.102,40), a `stock_unidade_corrigida` gravou (`UN→KG fator 2`) e o mapa `(cnpj, cProd)` **aprendeu o fator 2** — as três coisas que ele perguntou. O que **não** aconteceu foi a quarta: `stockItem.unidadeControle` continuou **UN**, e o saldo virou **`59,2 UN`** — um número **sem significado físico**, somando 8 peças com 19,2 kg com 32 kg.

**⛔⛔ E A MEDIÇÃO REFUTOU O FIX QUE ELE PROPÔS — "reunitiza o item com o mesmo fator" inventaria 51,2 kg de queijo.** O `reunitizar-item.ts` converte **TODOS** os movimentos vivos pelo fator; ele assume, desde 27/08, que o ledger inteiro está na régua antiga. **No queijo isso é falso:**

| quando | movimento | o que a CONFERÊNCIA registrou | fisicamente |
|---|---|---|---|
| 24/08 | 8 × R$ 69,90 | a nota disse **UN** | 8 **peças** → precisa ×2 |
| 03/09 | 19,2 × R$ 33,90 | a nota disse **KG** (outro fornecedor, a granel) | **19,2 kg — já certo** |
| 11/09 | 32 × R$ 34,45 | corrigida **UN→KG** | **32 kg — já certo** |

`59,2 × 2 = 118,4` contra os **67,2** reais. ⚠️ **Um item recebe de FORNECEDORES DIFERENTES, e cada um manda na unidade que quer** — nada garante ledger homogêneo.

**⭐⭐ E A UNIDADE DE CADA ENTRADA É DERIVÁVEL, NÃO ADIVINHÁVEL** (`lib/stock/unidade-do-movimento.ts`): a cadeia é **correção de unidade → `unidadeNota` da conferência → a régua do próprio item** (contagem e produção são digitadas nela). ⚠️ O custo unitário também denunciaria (69,90 é preço de peça, 33,90 é preço de quilo), mas isso é **heurística sobre número** — e este módulo decide pelo que foi **REGISTRADO**.

**O GESTO ÚNICO, as três coisas numa transação:** a correção converte a entrada (já fazia), grava o fator do fornecedor (já fazia) e **reunitiza o item** — **antes** de o movimento novo nascer, pra ele entrar já na régua nova e não ser convertido duas vezes. `reunitizarNaTransacao` foi extraído porque **Prisma não aninha `$transaction`** (a mesma cirurgia que o `aplicar-marcacao` levou em 29/08).

**⛔ NUNCA CONVERTE METADE E CALA:** movimento numa **terceira** unidade (nem a antiga nem a nova) **bloqueia nomeando** — sem o fator dele, converter seria chute; e se o item não puder reunitizar agora (**produção aberta**), a **conferência inteira para** e nada grava. Teste prova: 0 movimento, 0 conferência, item ainda em UN.

**⭐ O FATOR DOS MAPAS TEM A MESMA DOENÇA** — e ela mordia no mesmo caso: o queijo tem **dois** fornecedores, um que manda peça (fator 2) e outro **a granel em KG** (fator 1). Multiplicar os dois por 2 faria a próxima nota do granel entrar com **o dobro de queijo**. Agora quem já manda na unidade nova **não se mexe**.

**⚠️⚠️ E UM GUARD NASCEU SEM GUARD NO CAMINHO — o teste pegou.** Ao extrair o miolo transacional, a recusa por **produção aberta** ficou de fora (ela vivia **em duas cópias**, no preview e no aplicar). Virou `bloqueioDeProducaoAberta`, com **dono único**, chamada pelos três.

**A TELA MOSTRA O EFEITO ANTES DO CLIQUE**, e a conta vem da **mesma** `previewReunitizar` que o confirmar executa: *"o item passa a ser controlado em KG · saldo 59,2 UN → 67,2 KG · valor R$ 2.312,48 (não muda) · 1 movimento converte, 2 já estão certos"*.

**REGRA 11 — 2 defeitos repostos:** sem o reunitizar na conferência → **3 vermelhos** (o de hoje, exato) · reunitizar global (converte tudo) → **5**.

**9.327 verdes · TS 0 · deploys `bIKmA25pmFFsAHXGDE-mR` e `y2cRmD_4GrNYfjPUtV6Fw`, os dois 4/4.**

**📋 O RETROATIVO DO QUEIJO ESTÁ EM PREVIEW, ESPERANDO O OK** (`scripts/retro-queijo.ts`, read-only por padrão):
```
QUEIJO MUSSARELA FATIADO 2KG FATIA 10x10 CM   ·   UN → KG · fator 2
   ⭐ CONVERTE      8 UN → 16 KG        (unidade veio da CONFERÊNCIA)
   ✓ JÁ CERTO    19,2 KG — fica intacto (o granel)
   ✓ JÁ CERTO      32 KG — fica intacto (a entrada de hoje, já corrigida)

SALDO:  59,2 UN      →  67,2 KG
CUSTO:  R$ 39,06/UN  →  R$ 34,41/KG
VALOR:  R$ 2.312,48  →  R$ 2.312,48   ⭐ INVARIANTE ao centavo
```


### ⭐⭐⭐ A COLUNA SALDO — O EXTRATO BANCÁRIO DO ITEM (11/09)

**O dono:** *"quanto o item tinha DEPOIS de cada linha (227 → 234 → …). **Derivada do ledger na ordem, nunca gravada.**"*

**⭐ A CONTA DESCE DO SALDO DE HOJE** — que é o número que a Posição mostra. Então a linha mais recente **é** o saldo atual, e a prova que ele pediu fica **embutida na tela**: coluna, rodapé e Posição, **três leitores e uma régua só**. Cada linha devolve o próprio efeito pra quem vem abaixo; linha que não move a prateleira não desconta nada.

**⛔⛔ LISTA NÃO CONTÍGUA NÃO GANHA SALDO.** O que quebra a derivação é faltar linha **mais recente**. Filtro por **TIPO** (arranca linha de qualquer ponto) e **`ate`** (fecha o período antes de hoje) quebram → o campo vem `null` e a tela diz **"—"**. ⚠️ *Um número de estoque plausível e errado é a mentira mais cara que esta tela poderia contar.*

**⚠️⚠️ E A PROVA EM PROD CORRIGIU A MINHA RÉGUA — a coluna nasceu MORTA no extrato.** Eu tinha posto `movs.length < limite` na lista de quebras; a Caçula tem **1.013 movimentos** contra um teto de **500**, então **as 403 linhas do extrato vinham TODAS "—"**, justamente na tela em que a coluna mais serve. **Truncar corta o PASSADO** (a lista desce do mais recente), e o passado **não entra nesta conta**. Idem o filtro `de`. Um teste invertido com o motivo escrito.

**⚠️⚠️ DESCOBERTA DE DESENHO, travada em teste: CLEAN e FORENSE divergem NO MEIO da lista, de propósito.** No forense a linha de 10/09 mostra o saldo que o item **realmente tinha naquele dia** — fundo do poço, porque as baixas erradas já existiam e o estorno só veio em 11/09. No clean ela mostra a linha do tempo **sem os lançamentos anulados**. ⭐ Os dois **convergem onde tem que convergir**: no topo (hoje) e em tudo **abaixo do par** — porque o par soma zero. É por isso que o rodapé bate nos dois modos.

**⛔ O GRÁFICO DE PREÇO PASSOU PELA MESMA RÉGUA — e era defeito real que eu tinha registrado:** ele lia `ENTRADA_NF` do **CRU**, então **compra 100% estornada entrava na curva** como se alguém tivesse pago aquilo. Agora ele lê a lista **já colapsada** — fonte única, **não um filtro local a mais** —, exatamente como a compra desfeita saiu da aba "só compras". ⚠️ E usa sempre a lista limpa, **nunca o forense**: *"que preços eu paguei?"* não é pergunta que muda quando se liga o modo de auditoria.

**TIPOGRAFIA (item 4):** TOTAL e SALDO viram os protagonistas; **CUSTO UN. vira texto menor e cinza** (muda raro — é segundo olhar) e **some no celular** pra o SALDO caber. A linha anulada **não mostra saldo**: a célula fica vazia porque nada mudou ali.

**PROVADO EM PROD, pela rota real:**
```
COCA-COLA 2L — CLEAN (13 linhas)
   11/09 · Contagem      −12 un   −R$    97,08   saldo  215
   ⊘ lançamento anulado — contagem de 1.480 un estornada em 11/09   (saldo intacto: 227)
   10/09 · Compra (NF-e) +80 un    R$   646,79   saldo  227
   ⊘ lançamento anulado — baixa de venda de 1.499 un estornada em 11/09
   10/09 · Baixa de venda −7 un   −R$    56,63   saldo  147
   …
   24/08 · Compra (NF-e) +200 un   R$ 1.616,00   saldo  200   ← a 1ª compra da vida
   RODAPÉ: soma 215 · ✓ bate true
   ⭐ topo da coluna == rodapé == Posição:  215 == 215 == 215

FORENSE (17 linhas): mesmo topo (215) e mesmo rodapé, e no meio a verdade crua —
   10/09 · Compra (NF-e) +80 un   saldo −2.771   (o poço em que o item esteve)

EXTRATO: 403 linhas · 403 com saldo · filtrado por TIPO → todas "—" ⭐
GRÁFICO DE PREÇO: 6 pontos, sem a compra fantasma
```
**REGRA 11 — 3 travas repostas:** saldo virado gravado → **4 vermelhos** · contiguidade removida → **3** · gráfico lendo o cru → **2**. ⚠️ E o primeiro teste da linha anulada comparava com a linha **de cima**: *"anterior"* é no TEMPO, e a lista desce do mais recente — a linha anterior é a **de baixo**.

**9.321 verdes · TS 0 · deploys `T_hvFx3aQtHVubMRCxBDs` e `otksaKa7knJ55aMSKQPgS`, os dois 4/4.**


### ⭐⭐⭐ HISTÓRICO EM MODO CLEAN — O PAR QUE SE ANULA VIRA UMA LINHA FINA (11/09)

**O dono, olhando a Coca 2L depois do conserto:** *"16 linhas, das quais 6 são pares que se anulam. Pra entender 'o que aconteceu com meu estoque', essas linhas são ruído — mas APAGAR não pode: **o rastro é o que provou o desastre de ontem**."*

⚠️ **Medido antes de desenhar: são 4 pares (8 linhas), não 3.** O `+154 × −154` que ele mesmo citou também é par — a lista sai de **16 → 12**, não pros ~10 que ele estimou. Fanta: **10 → 7**.

**⭐ `colapsarAnulados` mora no MESMO dono do `dobrarProducao`** (`movimento-explicado.ts`), e por isso o histórico do item e o extrato herdam a régua juntos — duas implementações divergiriam no 1º tipo novo, que é a doença que este módulo mais paga.

**⛔⛔ A SOMA NÃO MUDA — E ISSO É POR CONSTRUÇÃO, NÃO PROMESSA.** O par só colapsa quando a contribuição dele à soma exibida é **zero**. Par **assimétrico** (um lado fora da prateleira, como o `PRODUCAO_CONSUMO` com estorno que move) **NÃO colapsa** — senão o rodapé *"✓ bate com o saldo"* passaria a mentir, e ele é justamente o teste da tela que o dono pediu em 09/09.

**AS TRÊS RECUSAS, cada uma com o seu motivo:**
| situação | decisão |
|---|---|
| desfeito **por inteiro** e contribuição zero | ⭐ colapsa numa linha fina |
| **estorno PARCIAL** | fica à vista — *sobrou efeito, o efeito aparece* |
| **par assimétrico** | fica à vista — colapsar mentiria na soma |
| estorno cujo **original não está na lista** (filtro/período) | fica como está — colapsar meio par sumiria com dado |

**⛔ NADA É APAGADO:** o par inteiro **viaja dentro da linha** (`anulado.original` + `anulado.estornos`), a tela expande em *"ver detalhe"*, e o toggle **"mostrar tudo (forense)"** devolve a lista crua. ⭐ O toggle **só aparece quando há par colapsado** — botão que não faz nada é ruído. **E o CSV vai SEMPRE forense** (o servidor força): arquivo é pra auditoria, e lá o par tem que estar inteiro.

⚠️ **A FRASE SAI SÓ DO QUE O LEDGER GUARDA.** Não existe campo de motivo em `stock_movement` — escrever *"(import com coluna errada)"* na linha seria inventar um dado que ninguém gravou. A linha diz o que dá pra provar: *"⊘ lançamento anulado — baixa de venda de 1.499 un estornada em 11/09"*.

**⚠️⚠️ REGRA 11 PEGOU UM TESTE MEU QUE NÃO MORDIA — de novo.** Repus o defeito tirando a trava do **PARCIAL** e os 11 testes ficaram **VERDES**: quem barrava o meu caso era a trava de **contribuição** (−100 + 40 já não soma zero). O teste que **isola** a régua do parcial é o dos **dois lados fora da prateleira**, onde a contribuição é zero de qualquer jeito e só a pergunta *"desfez tudo?"* separa. Com ele, remover a trava fica vermelho.

**7 TESTES ANTIGOS INVERTIDOS COM O MOTIVO ESCRITO** (afirmavam o mundo antigo, em que o par aparecia): os que falam da **natureza da linha** (chip, quem, href, `estornoDe`) passaram a pedir o **forense** — e isso, por si, prova que no forense **nada se perdeu**.

⚠️ **CONSEQUÊNCIA REGISTRADA:** a compra **100% estornada sai da aba "só compras"**. É o certo — aquela aba existe pra **comparar preço de fornecedor**, e uma compra desfeita não é um preço que alguém pagou; no forense ela volta. ⚠️ **E o gráfico de preço NÃO segue essa régua** (lê `ENTRADA_NF` do cru, incluindo compra estornada): é defeito **pré-existente**, achado no caminho, **não consertado sem pedido**.

**PROVADO EM PROD, pelas rotas reais com sessão assinada:**
```
COCA-COLA 2L   forense 16 linhas → CLEAN 12 (4 anuladas)
               soma clean 227 · R$ 1.835,64  ==  soma forense 227 · R$ 1.835,64
               ✓ bate com o saldo: clean true · forense true
   ⊘ lançamento anulado — contagem de 1.480 un estornada em 11/09   [1 estorno dentro]
   10/09 · Compra (NF-e)    +80 un   R$ 646,79
   10/09 · Baixa de venda    −7 un  −R$  56,63
   ⊘ lançamento anulado — baixa de venda de 1.499 un estornada em 11/09
   ⊘ lançamento anulado — baixa de venda de 1.499 un estornada em 11/09
   09/09 · Contagem        −406 un −R$ 3.280,48
   ⊘ lançamento anulado — contagem de 154 un estornada em 09/09

FANTA UVA 2L   forense 10 → CLEAN 7 (3 anuladas) · soma 6 un · R$ 40,86 nos dois
EXTRATO        clean 401 linhas (26 anuladas) · forense 427
```
**REGRA 11 — 2 travas repostas, 1 vermelho cada. 9.305 verdes · TS 0 · deploy `QjsylK61vkqb-L1cPEcAf` 4/4.**

⚠️ **E O BUILD FALHOU UMA VEZ POR CULPA MINHA:** deixei um script de medição (`scripts/medir-coca-tmp.ts`) no servidor e o type-check do build o compilou. **O blue-green segurou** — *"o symlink não moveu, prod continua no build anterior"*. Lição pequena e registrada: script temporário no servidor vive em `/tmp`, nunca em `scripts/`.


### ⛔⛔⛔ O IMPORT DE VENDAS DE 10/09 EXPLODIU O ESTOQUE — E O GUARD NASCEU NA PORTA ERRADA (11/09)

**O dono, congelando tudo antes de qualquer conserto:** *"CONGELA E MEDE — nada de consertar antes de responder."* A medição respondeu a pergunta dele (*"de onde saiu 1.499 de Fanta Uva?"*) e **refutou a hipótese da baixa dupla**.

**⛔⛔ A CAUSA, medida contra o arquivo real:** o **Relatório de COMPLEMENTOS** foi subido na aba de **PRODUTOS**. Os dois layouts têm colunas diferentes:

```
PRODUTOS:     [Produto   · **Quantidade**             · Valor Extra · Valor total]
COMPLEMENTOS: [Descrição · **Valor médio por unidade** · Quantidade  · Valor Total]
```

O parser lia **a coluna 1 como quantidade** — e no arquivo errado ela é o **PREÇO**. `R$ 14,99` virou **1.499 unidades**. As 54 linhas (de 86) são as de `R$ 0,00` virando quantidade 0 e sumindo: justamente os sabores inclusos no preço.

**⚠️ A HIPÓTESE DA BAIXA DUPLA NÃO SE CONFIRMOU:** as 6 baixas eram o **estorna-e-refaz do reprocesso funcionando** (3 estornadas + 3 vivas). O estrago era **o −1.499 que deveria ser −1**, não a duplicidade.

**⭐ O FIX DE CLASSE (ordem do dono): coluna se resolve pelo NOME DO CABEÇALHO, nunca pela posição.** `resolverColunas()` acha cada coluna pelo título e, quando o cabeçalho não traz o que se espera, **RECUSA o arquivo dizendo o que achou** — layout novo nunca mais entra calado. Golden com os **DOIS** layouts reais de 10/09.

⚠️ **3 testes foram INVERTIDOS com o motivo escrito:** a casa documentava *"142 linhas e 142.255 unidades"* como o **resultado esperado** de um arquivo trocado. O teste afirmava o defeito.

### ⛔⛔ E O GUARD DE SANIDADE ESTAVA NA PORTA ERRADA — a prova em prod que pegou

Escrevi `sanidade-do-import.ts` e o liguei no `previewImportSuitable` — **a tela de MAPEAMENTO**. A prova em prod mostrou o payload do `processar` (**quem baixa o estoque**) **sem bloco de sanidade nenhum**: o import de 10/09 repetido hoje passaria calado de novo, com o guard "pronto" no arquivo ao lado. ⚠️ *Guard na porta que o dono pode nem abrir no dia não é guard.*

- **`medirSanidade` tem um dono só** (`lib/stock/vendas/medir-sanidade.ts`) — o preview do mapa e o caminho da baixa chamam a MESMA; duas réguas divergiriam no 1º ajuste de fator.
- **O plano CARREGA a pergunta** (`montarPlanoDeLinhas` devolve `sanidade`) e **quem RECUSA é o SERVIDOR** (409 `SANIDADE`), não um diálogo de tela — é a régua do **FREIO da contagem** (23/08). Aviso que mora no componente some no dia em que a rota for chamada por outro caminho, e foi por outro caminho que o estrago entrou.
- ⭐ **Pergunta, nunca recusa cega** (a régua do dono): reenviar com `confirmouSanidade` passa. Encadeado nos **3** caminhos que baixam (import, reprocesso, lançamento manual). Na tela: as frases com o número dele e um checkbox que **nasce desmarcado** — confirmar tem que ser um gesto.

### ⛔⛔ O GUARD ESTRUTURAL E O LIMIAR QUE O TESTE CORRIGIU

*"Valor negativo com saldo positivo é impossível, não improvável — barra na escrita."* `assertSaldoNaoFicaImpossivel` entrou no `criarMovimento`.

⚠️⚠️ **E o teste pegou o limiar errado:** eu escrevi `if (custoTotal >= 0) return`, e **a linha que CRIOU o estado impossível tem `custoTotal` ZERO** — a contagem de **+1.496 a R$ 0,00**. Um guard que só olhasse valor negativo deixaria passar **exatamente o movimento que causou o defeito**. Agora é `> 0`. ⭐ E a baixa que deixa **saldo** negativo continua passando: "vendeu sem produzir" é sinal legítimo, e barrá-lo esconderia o aviso.

**REGRA 11 medida nos três:** parser por posição → **4 vermelhos** · guard estrutural removido → **2** · sanidade fora do `gravarVenda` → **1**.

**O CONSERTO APLICADO, na ordem que o dono aprovou** (`pg_dump pre-conserto-vendas-1009-20260911-013812`): estorno das 3 `BAIXA_VENDA` vivas + das 3 `AJUSTE_CONTAGEM` a R$ 0,00 pelo `estornarMovimento` da casa (ledger imutável) · **sessão de contagem ROTINA de 04/09 FECHADA** (7 dias aberta — *"sessão é FOTO"*) · reimport do arquivo certo.

**PROVADO EM PROD, pelas rotas e funções das telas:**
```
O ARQUIVO CERTO diz FANTA UVA: 1 un   (o trocado dizia 1.499)
o dia 10/09: 437 unidades · 30 produtos mapeados · R$ 2.764,72 baixados
  (o trocado: 53.761 un — 72× a média)

SALDO DOS 3        COCA-COLA 2L 227 · R$ 1.835,64   |  CC Zero 2L 57 · R$ 462,19
                   FANTA UVA 2L   6 · R$    40,86
POSIÇÃO   165 linhas · R$ 136.822,38 · valor negativo: 0 ✓ · custo médio negativo: 0 ✓
CARDÁPIO  165 produtos · COCA COLA 600ML 117 vendas · custo 3,31 · preço 11,00 · margem 70%
          margens impossíveis: 0 ✓ · custos negativos: 0 ✓
JUIZ      E1/E2/E8/C1/P1 = 0
```
⭐ **As 117 vendas da COCA 600 são as 107 que o dono citou + as 10 de 10/09** que agora entraram certas. **Varredura dos outros dias: nenhum inflado** (média 529 un/dia, 10/09 em 437).

**9.285 verdes · TS 0 · deploys `4dbjmd_nPB3UncJw1Yz_v` e `onzxKJE1ct9el5RIXgkCw`, os dois 4/4.**

⚠️ **PENDENTE (é do dono):** conferir os 3 saldos contra a geladeira. Se discordar, a marcyelle reconta **OS 3 numa sessão NOVA de hoje, nunca na velha** — a de 04/09 está fechada.

⚠️ **ACHADO NO CAMINHO, não consertado:** o juiz do estoque voltou 🔴 com **51 issues, nenhuma do ledger** — são **E15** (eventos 210210 em ERRO > 24h, o débito registrado *"sem cron de retry de evento SEFAZ"*), **E7** (itens com saldo nunca contados — a contagem inicial) e **F5** (21 notas sem data de pagamento, R$ 8.588,75). Registrado, não atacado.


### ⛔⛔ O ITEM PRODUZIDO SUMIA DA POSIÇÃO — E O RÓTULO PROMETIA A FONTE ERRADA (11/09)

**⛔ 1. "SEM CUSTO — ENTRA NA 1ª NOTA" NUM ITEM PRODUZIDO.** O dono: *"nota NUNCA vai chegar pra ele — é produzido: o custo nasce da 1ª PRODUÇÃO concluída. **Texto que promete fonte errada me deixa esperando o que não vem.**"* O texto era o mesmo pra todo componente sem custo. ⭐ Agora segue o TIPO, e o sinal é o **mesmo que o botão "produzir agora" já usava** (existe ficha que o produz) — nada de régua nova pra uma pergunta que a tela já sabia responder. O rodapé e o card de "sem custo" cobrem os dois caminhos, porque a lista pode ter comprado e produzido junto.

**⛔⛔ 2. A POSIÇÃO NASCIA DO LEDGER, NÃO DO CATÁLOGO.** `listPosicao` partia de `saldosDaEmpresa` — um `groupBy` em `stockMovement`. **Item com ZERO movimento não existia pra ela.**

**E não era só o item dele: 9 itens ativos estavam invisíveis** — `tomate`, `gas`, 6 porções e a **`HEINEKEN LONG NECK ZERO 330ML`**, justamente uma das bebidas que em 09/09 este doc registrou como *"nasce com saldo 0 e entra na fila de contagem"*. ⚠️ **Elas entraram na contagem e sumiram da tela onde o dono confere o estoque** — a família do *"erro disfarçado de vazio"*.

**⭐ A RÉGUA QUE FICOU:** a Posição é a PRATELEIRA, e **prateleira com zero unidades continua sendo uma linha da prateleira**. Saldo 0 é um **FATO** ("não tem"), não ausência de dado. A lista passa a partir do CATÁLOGO (`ativo` + `seContaFisicamente`) com o saldo DERIVADO.

**⭐⭐ E A MEDIÇÃO MOSTROU QUE A CONTAGEM JÁ ESTAVA CERTA:** `getQuadro` sempre partiu de `stockItem.findMany` — **a Posição é que era a exceção**, e as duas telas agora respondem a mesma coisa (165 linhas nas duas). Duas telas sobre a mesma prateleira dando números diferentes é o defeito que este módulo mais paga.

⚠️ **O que NÃO afrouxou:** invólucro de cardápio (`SABOR`/`PRODUTO_FINAL`) segue fora, item desativado segue fora, e **órfão com saldo sem cadastro continua aparecendo** — esconder por ausência de cadastro esconderia estoque de verdade.

**PROVADO EM PROD:**
```
1) POSIÇÃO   165 linhas (era 156) · "porcao beef de alimenuta" SIM · saldo 0 UN · custo a definir
2) CONTAGEM  165 linhas · o item está lá, saldo sistema 0
3) PRODUÇÃO  ficha ativa v1 — dá pra criar ordem antes do 1º movimento
```
⚠️ **O valor total do estoque não muda com a régua nova** (zero não soma) — a variação entre duas leituras (108.096,20 → 108.057,80) é movimento real da operação acontecendo entre elas, não efeito da mudança.

**REGRA 11 — a régua velha (partir do ledger) deixa 2 vermelhos. 9.265 verdes · TS 0 · deploy `LbnxjSzSEb-jHmVHJGXwD` 4/4.**

### ⛔⛔⛔ E O DEPLOY FALHOU 3× POR OOM — o teto era do V8, não do kernel

**O blue-green segurou as três**: *"o symlink não moveu, prod continua no build anterior"*. Mas o diagnóstico levou duas tentativas erradas, e as duas ficam registradas:

1. **APOSTEI NO AVISO DO TURBOPACK e errei.** O log trazia *"a file was traced that indicates that the WHOLE PROJECT was traced unintentionally"*, apontando `lib/stock/sefaz/server-ca.ts` (um `readFileSync` de caminho que o Turbopack não resolve estaticamente). O `/* turbopackIgnore: true */` **matou o aviso** — e o build **continuou estourando**. *Aviso real não é causa provada.*
2. **A CAUSA MEDIDA:** `FATAL ERROR: Reached heap limit`, e o limite padrão do Node **nesta máquina é 2006 MB** — o build do Next passou disso. ⚠️ **Não é o OOM killer de 24/08** (aquele era o kernel matando o processo); é o **próprio V8** batendo no teto dele, com **3,2 GB livres**. Fix: `NODE_OPTIONS=--max-old-space-size=3072` no build do `deploy.sh`.

⚠️ **A migration TINHA sido aplicada** nas três tentativas (ela roda antes do build): prod ficou com a tabela nova e o código velho — inofensivo por ser CREATE-only e sem leitor, mas vale saber que o deploy não é atômico entre schema e código.

⚠️ **PENDENTE (é do dono):** navegar o card e conciliar a Box Paper e a Oesa com baixa parcial — as duas estão prontas na tela, e a régua do restante em aberto só se prova com o clique dele.

## ⛔⛔⛔ A COLUNA COM 2 LANÇAMENTOS SUMIA — E O PAINEL VIRAVA DINHEIRO (10/09/2026)

**O dono, ao subir a fatura do Banrisul PF do mês:** *"lido 32.650,23 × declarado 18.842,30 — diferença 13.806,48. **A recusa está certa; a leitura não.**"*

**A CAUSA, medida:** o Banrisul PF tinha a **SUA** dedução de colunas, por **densidade de datas** — uma coluna "de verdade" precisava de **≥4 datas alinhadas**. Funcionou em agosto e quebrou em setembro, porque a coluna da direita da última página tem **2 lançamentos** e um painel de limites. Ela foi descartada, a página virou uma coluna só, e o parser passou a ler o dinheiro do **painel** na linha das compras:
```
02/08  POSTO PITANGUEIRA ITAQUI BRA   262,00  │  TOTAL DE GASTOS   10.482,68
                                       ↑ o certo         ↑ o que ele leu
```
Os três números que entraram por engano: **10.482,68** (total do portador), **2.839,53** (pagamento mínimo) e **114,31** (encargo do painel).

**⭐ A GEOMETRIA VIROU UMA SÓ** (`lib/pdf-fatura/colunas.ts`): a **calha** — faixa em branco em TODAS as linhas — **não depende de quantos lançamentos a coluna tem**. Uma coluna com 2 compras é tão coluna quanto uma com 40. **Mesmo motor do Itaú, dois bancos** — a régua nasceu ontem pro 7º parser e o Banrisul precisou dela no dia seguinte.

**⚠️⚠️ E A ARESTA DA BANDA PRECISOU DE DUAS CORREÇÕES, cada uma quebrando um banco diferente — as duas ficaram escritas no arquivo:**
1. **cortar no PRIMEIRO valor da linha** → quebrou o **Banrisul**: compra internacional traz **US$ e R$** na mesma linha (`15/07 MERCADOME 8,70 45,49`), o "primeiro" é o dólar e o **real era cortado fora** — **50 linhas sumiram** e o Brasil ficou 2.548,19 curto;
2. **cortar no valor mais à direita que se repete** → quebrou o **Itaú**: o painel de juros da página 2 **também é alinhado à direita** (borda 118, 6×) e ganhava do valor de verdade (borda 69, 11×).

⭐ **O que separa os dois é a CALHA depois da coluna de valor:** o valor é seguido de faixa em branco; o painel vive DEPOIS dela.

**MAIS DOIS ACHADOS QUE SÓ O MÊS NOVO TRAZIA:**
- **`(+) IOF sobre operações de crédito 1,45`** — rótulo que **não existe na fatura de agosto**. Sem ele o saldo ficava **1,45 curto** e a fatura era recusada por um centavo e meio.
- **A parcela ficava na descrição** junto do campo estruturado → a tela mostrava **"CHEFRED 10/1210/12"**. ⚠️ A limpeza mora no **adaptador**, não no `nucleo.ts`: aquele arquivo é **compartilhado com o parser PJ**, e mexer nele mudaria as descrições de quatro layouts que hoje estão certos.

**⭐⭐ A SEGUNDA FIXTURE, e a regra do dono que a justifica:** *"meses diferentes, layouts que variam — **o golden de um mês não congela o banco no tempo**"*. Gerada **no servidor, pelo `extractPdfText`** (a regra que nasceu do episódio do Itaú, em que o golden fechava e a tela não).

**PROVADO PELA ROTA REAL, com upload e sem digitar nada:**
```
POST /importar-fatura (preview) → 200 · Banrisul · ok true · origem do total: PDF
despesas 18.842,30 == declarado   ·   saldo 18.593,16 == declarado   ·   fecha true
93 linhas · portadores ["5349","9113"] · venc 10/09 · descrições com parcela duplicada: 0
próximas faturas (declaradas, FORA do import): 21.680,57
```
E **agosto seguiu verde**: 39.302,64 / 18.348,72 com as **mesmas 181 linhas**, incluindo as internacionais.

**REGRA 11 — 3 defeitos repostos:** densidade de datas de volta → **6 vermelhos**; aresta no primeiro valor → **6**; IOF de crédito fora do encargo → **2**. **22 testes novos · 9.094 verdes · TS 0 · deploy `yjp7cj3EzHhr1ea0gFYwn` 4/4.**

⚠️ **REGISTRADO, NÃO FEITO:** a mesma duplicação de parcela na descrição provavelmente existe nos **4 parsers PJ** (o `nucleo.ts` é compartilhado e a limpeza ficou só no adaptador PF). Não mexi: mudaria descrições de faturas que hoje estão certas, sem pedido.

## ⭐⭐⭐ O CARD DO CARTÃO PASSOU A DIZER O ESTADO DA FATURA (09/09/2026)

**O dono:** *"a lista diz limite e 'fecha dia X · vence dia Y' — e nada sobre a fatura em si: aberta? fechada esperando pagamento? vencida? paga? **É a pergunta que me faz abrir a tela.**"*

**A linha da fatura virou o protagonista do card** e o cadastro (limite, ciclo) desceu pro rodapé. Seis estados, cada um com **frase e tom decididos no servidor** — a tela só pinta; se ela derivasse a cor do estado seriam duas derivações da mesma pergunta.

**⛔⛔ A RÉGUA DO PAGO É A DELE, e é dura:** *"pago = pagamento REGISTRADO. Se não tem registro, a tela não adivinha."* `estaPaga` lê o **`paidAmount`** — que só cresce quando um pagamento é AMARRADO —, **nunca o `status` gravado**. ⚠️ E o motivo é estrutural, não estético: **`CreditCardInvoice.status` existe desde a Fatia 2 e NINGUÉM o transiciona com o tempo** (fatura importada nasce `OPEN` e continua `OPEN` depois de vencer); e um cartão que se diz pago sem vínculo é **o mesmo dinheiro contado duas vezes**. Teste com o contrafactual: `status: 'PAID'` com `paidAmount: 0` continua cobrando.

**⛔ E AUSÊNCIA NUNCA VIRA VERDE:** `SEM_FATURA` é estado próprio, com o que fazer escrito. E um card pode mostrar a **VENCIDA de julho** e dizer, na segunda linha, que **o ciclo de agora não foi importado** — as duas coisas são verdade e as duas aparecem.

### ⭐ O VÍNCULO PAGAMENTO→CARTÃO: **não existia nenhum** (a resposta à pergunta dele)

A categoria *"Cartão de crédito"* do PF é **só um nome** — não aponta pra cartão nem pra fatura. O único vínculo real é `casarPagamentoPF`/`payInvoice`, e em prod havia **0 transações com ele**. Agora o card **oferece o débito de valor EXATO na janela do vencimento**, com o motivo, e 1 clique registra — daí em diante o *"paga ✓"* é derivado sozinho.

⛔ **Só valor EXATO é oferecido, e o sistema não casa sozinho:** ele tem 4 cartões e valores se parecem; marcar uma fatura como paga com o dinheiro de outra é bem mais caro de desfazer que um clique. ⚠️ E um débito só é oferecido a UM cartão — senão o mesmo dinheiro apareceria como "o pagamento" de duas faturas.

### ⛔⛔⛔ E A PROVA EM PROD PEGOU UM FUSO QUE MENTIA TRÊS HORAS POR DIA

A 1ª medição pela rota real mostrou o Magalu como **"VENCEU dia 09/09"** — com o dono **dentro do prazo**. O servidor marcava `2026-09-10 02:32 UTC`; em São Paulo ainda era **23:32 de 09/09**.

⚠️ **Não é preciosismo:** todo dia, **das 21h à meia-noite, TODO cartão que vence naquele dia apareceria vencido** — no número que ele usa pra decidir se corre pagar. O card passou a usar o **dia do Brasil**, reusando o `endOfTodayBrazil` que a casa já tinha desde 07/08.

**⚠️ E o irmão do mesmo bug, do outro lado:** o card dizia *"paga ✓ em **10/09**"* pra um pagamento feito às 23:35 de **09/09**. **Vencimento e fechamento são DATAS DE CALENDÁRIO** (00:00 UTC — formatá-las no fuso as puxaria pro dia anterior); **o pagamento é um INSTANTE**, e aí o fuso manda. Os dois sentidos têm teste. ⚠️ E a fixture antiga datava o pagamento à **meia-noite UTC**, forma que a aplicação **nunca grava** (o import usa meio-dia; o `payInvoice` usa o relógio) — ela escondia o fuso em vez de testá-lo.

**⚠️ E O GUARD DA CASA PEGOU O MEU PRÓPRIO TESTE:** o `sem-data-fixa-no-futuro` reprovou `hoje: new Date('2026-09-13')` — data fixa no futuro na posição de "agora". Nada ali compara com o relógio real, mas **a forma importava**: o calendário do cenário passou a ser derivado da própria âncora (`maisDias(4)`), o que deixa a independência do relógio **visível** em vez de depender de alguém reparar nela.

**PROVADO EM PROD, pela ROTA REAL, com o dono usando o app ao vivo** (ele registrou o pagamento do Banrisul às 23:35, entre duas medições minhas, e o card virou sozinho):
```
banrisul (9113)        [OK]      PAGA       "paga ✓ em 09/09"
nubank (1564)          [NEUTRO]  FECHADA    "R$ 6.210,30 · vence em 6 dias"
magazine luiza (2971)  [ALERTA]  VENCE_HOJE "R$ 4.491,18 · vence HOJE"
   ⚠️ os três com a 2ª linha: sem fatura importada deste ciclo
```
**REGRA 11 — 3 defeitos repostos:** "paga" confiando no status gravado → 1 vermelho; `SEM_FATURA` com tom `ok` → 1; a sugestão aceitando valor **parecido** → 1. **22 testes novos · 9.078 verdes · TS 0 · deploys `kLOYQNDFarQjHozRXqU-F`, `oZPQ75hxLh-J75uCUJWhU` e `TOENjtqHg1uIs52L9ZdWL`, os três 4/4.**

⚠️ **PENDENTE (é do dono):** as três faturas do ciclo corrente não foram importadas — a segunda linha de cada card já diz isso.

## ⛔⛔⛔ O GOLDEN ACHAVA E A TELA NÃO, NO MESMO PDF — DOIS EXTRATORES (09/09/2026)

**O dono, horas depois do sprint do 7º parser:** *"subi a fatura EXATA do golden. Os 37 lançamentos, portadores, parcelas e o 4.370,79 bateram — mas a conferência diz 'não achei os totais do resumo neste PDF' e pede o total digitado, sendo que o 'Total desta fatura R$ 4.491,18' está na página 1."* E a hipótese dele estava certa em cheio: ***"aposto em extrator diferente mudando espaçamento e quebrando a âncora do resumo"***.

**MEDIDO, com o mesmo arquivo nos dois lados:**
```
Mac (poppler 25)     "Resumo da fatura em R$" @ 9  ·  "Total desta fatura" @ 19   (dist 10)
servidor (24.02.0)   "Resumo da fatura em R$" @ 6  ·  "Total desta fatura" @ 20   (dist 14)
```
Meu `lerResumo` cortava o bloco com **`slice(i, i + 14)`** e o comentário dizia *"14 linhas cobrem com folga"*. Cobriam — **na extração do meu Mac**. Na do servidor o `slice(6, 20)` para no índice 19 e **exclui o 20 por UMA linha**: `totalDaFatura` virava `null`, e a tela pedia o número que está impresso na página 1.

**⭐⭐ A CAUSA DE FUNDO É A QUE ELE NOMEOU: HAVIA DOIS EXTRATORES.** O gerador da fixture chamava `pdftotext -layout` **na mão, no Mac**; a rota chama **`extractPdfText`** (com `-enc UTF-8`) **no servidor**, com outra versão do poppler. ***Fixture que não sai do caminho real é promessa que prod não cumpre.***

**O FIX DE CLASSE, nas três partes:**
1. **O fim do bloco é o FATO que o fecha** (`= Total desta fatura`), nunca uma contagem de linhas — contagem quebra quando o extrator muda de versão, e **extrator muda de versão sozinho**. ⚠️ E a âncora virou cinto E suspensório: um teste prova que os **6 rótulos que o parser lê são únicos** no documento (só o "Total a pagar" repete — as duas simulações — e ele não é lido).
2. **O gerador de fixture usa `extractPdfText`**, o MESMO do caminho real, e a **fixture primária é gerada NO SERVIDOR**.
3. **A extração do outro poppler ficou como SEGUNDA fixture** e o golden roda contra as duas, exigindo leitura idêntica linha a linha. É o que impede o golden de voltar a ser promessa.

**⭐ E O GUARD DA CLASSE PROS SETE PARSERS:** empurra o documento **3 linhas pra baixo** e exige o mesmo número. Nenhum parser pode depender de posição de linha — e o teste roda sem precisar do PDF original de cada banco. Varri o código atrás de outras janelas por linha: as que sobraram são em **caracteres** (1.200 e 3.000), muito mais tolerantes.

## ⛔⛔⛔ E A "SAÍDA MANUAL" NUNCA FUNCIONOU — O DONO ACHOU QUE TINHA IMPORTADO (09/09/2026)

**Achado ao CONFERIR o conserto acima em prod, não por relato:** o cartão magazine luiza tinha **0 lançamentos** e havia **0 transações `PDF_FATURA` nas últimas 24h**. A frase dele — *"importei com o total digitado pra fechar o mês"* — descrevia uma gravação **que não aconteceu**.

**Eram DOIS defeitos na mesma saída, criada em 31/08 e nunca funcional ponta a ponta:**
1. **O `ok` do preview era só a régua do BANCO.** Num PDF que não declara o total essa régua é `false` **por construção** — então o dono digitava o número, via `origemTotal: DIGITADO` na tela… e o `ok` continuava `false`, porque o digitado **nunca era consultado**.
2. **O `confirmarFaturaPF` nem aceitava `totalDigitado`, e a rota não o repassava** — o confirm rerodava a conferência sem o número, caía em "não fecha" e **recusava calado, com o preview verde na tela**. É a família *"preview e confirm discordando"* que este projeto já pagou caro no import de OFX.

**⛔ A TRAVA NÃO AFROUXOU:** o digitado só entra quando **o documento é omisso** (`saldoDeclarado == null`), quando **tudo o mais que dava pra conferir fechou** (`fechaSemOTotal`, definido por banco) e quando **o número dele bate** com o lido. PDF que declara e não bate continua recusado — *digitar não é `force`*, e há teste dizendo isso.

**⭐ E A ROTA PASSOU A MONTAR UM OBJETO SÓ** pros dois caminhos (REGRA 5): não existe mais "esqueci de repassar num dos dois".

**⚠️ LIÇÃO DE MÉTODO, e é sobre mim:** o sprint anterior fechou com *"REGRA 2 é do dono: subir o PDF pela tela"* — e **os dois defeitos só apareceram quando ele subiu**. Nenhum teste meu passava pela ROTA com upload real; eu provei `previewFaturaPF` (que recebe o texto **já extraído**) e chamei de prova de ponta a ponta. **Provar a função que fica DEPOIS do trecho quebrado não prova nada sobre ele.**

**PROVADO EM PROD pela ROTA REAL** (upload do PDF, sessão assinada, **sem digitar nada**): `200 · banco Itaú/Luizacred · ok true · origem do total PDF · **totalDeclarado 4.491,18** · 37 lançamentos · despesas 4.370,79 = declarado · saldo 4.491,18 = declarado · portadores ["8818","2971"]`. **REGRA 11 — 2 defeitos repostos: a janela de 14 linhas → 8 vermelhos; o digitado fora do `ok` → 2. 9.053 verdes · TS 0 · deploys `p3l3L3QNQlOO-M8LayT8h` e `Smm3oPaMezv75xW0hCrto`, os dois 4/4.**

⚠️ **PENDENTE (é do dono):** a fatura do Magalu **não está importada** — o preview agora fecha sozinho, falta o CONFIRMAR na tela.

## ⭐⭐⭐ 7º PARSER DE FATURA — ITAÚ/LUIZACRED, E O REGISTRY QUE ERA DECORATIVO (09/09/2026)

**O dono:** *"o sistema não consegue ler"* — a fatura do **Magazine Luiza** (emissor **LUIZACRED S/A SCFI**, boleto do **Banco Itaú**, diagramação **Quadient**).

**⛔⛔⛔ ACHADO ANTES DE ESCREVER UMA LINHA DO PARSER, e é maior que o pedido: o registry de bancos do caminho PF NUNCA foi chamado.** Ele nasceu em 31/08 justamente pra matar o fallback silencioso (o dono subiu um Nubank e o Banrisul foi aplicado por cima) — e a porta foi **só até a metade**:
```ts
const parser = reconhecerBancoPF(input.texto)   // ⭐ reconhece o banco…
if (!parser) { …falha com a frase certa… }
const r = parseBanrisulFaturaPF(input.texto)    // ⛔ …e parseia SEMPRE com o Banrisul
```
**O campo `parse` do registry tinha ZERO chamadores.** Uma fatura do Nubank passava no reconhecimento, era lida com a régua do Banrisul e caía em *"não consegui ler nenhum lançamento"*.

**⚠️⚠️ POR QUE NINGUÉM VIU, e a lição vale pra todo parser:** o parser do Nubank tinha **20 testes verdes** e **nenhum deles passava pelo import**; o único teste de ciclo do import PF roda com a fatura do **Banrisul** — o caso em que o bug é **invisível por construção**. ***Parser testado isoladamente não prova que alguém o chama.*** É a família do "N caminhos, 1 esquecido", agora entre o registry e quem deveria consumi-lo.

**⭐ O CONSERTO:** o campo virou **`ler`** e devolve uma **forma única** (`FaturaPFLida`); cada banco tem um **adaptador** e o import conhece **uma** língua. ⛔ **Mas a RÉGUA DE CONFERÊNCIA continua sendo de cada banco, de propósito** — a composição que fecha o Nubank (compras + IOF + outros) não é a do Banrisul (brasil + estornos + encargos) nem a do Itaú (cartão A + cartão B + produtos e serviços). **Régua única aqui reprovaria fatura correta**, que foi a lição de 31/08. O que se unifica é o FORMATO, nunca a régua.

### ⭐⭐ A ANATOMIA DO LAYOUT, e o corte é MEDIDO no documento

**DUAS COLUNAS na página de lançamentos — e a da direita não é painel, é a CONTINUAÇÃO.** Cortá-la fora perderia **16 das 37 linhas**; ler a linha corrida somaria duas compras diferentes. O corte sai de uma **calha** (faixa de colunas em branco em todas as linhas): *o documento diz onde ele mesmo se divide*. Número fixo envelheceria no primeiro estabelecimento de nome mais longo.

**⚠️⚠️ DOIS ERROS MEUS, MEDIDOS CONTRA O PDF REAL, e os dois viraram regra no arquivo:**
1. **A calha só vale na REGIÃO DE LANÇAMENTOS.** Na página inteira, os parágrafos de aviso do topo atravessam as duas colunas e **apagam a calha** — a página vira uma coluna só. Total: **2.686,42** contra os 4.370,79 do documento.
2. **A data tem que estar NO COMEÇO da coluna** (`^\s{0,2}`). Com `^\s*`, qualquer corte à esquerda "enxerga" as datas da coluna da direita e inventa uma coluna **no meio do campo de valor**.

**O resto da anatomia:** cada lançamento ocupa **2 linhas** (a 2ª é `CATEGORIA .CIDADE`, complemento) · **dois cartões** em blocos (`(final 8818)` e `(final 2971)`), cada linha guardando o portador · **parcela colada no nome**, com e sem espaço (`LOJAS RIACHUELO SA03/03`, `Leiturinha S.A 12/12`) · a data é a da **compra original** (há parcelas de 27/01, 16/04 e 20/05 ainda correndo) · **estorno com sinal** (`- 0,03`) · **encargo de atraso** entra como lançamento · ⛔ **"Compras parceladas - próximas faturas" NÃO entra** (são as parcelas dos meses seguintes; entrariam duas vezes).

**⛔⛔ E O TOTAL SAI DO BLOCO DO RESUMO, NUNCA DE REGEX SOLTO:** esta fatura tem **"Total a pagar" duas vezes fora do resumo** — R$ 5.185,79 e R$ 5.387,96 — e as duas são **SIMULAÇÃO de parcelamento**, maiores que a fatura. É a armadilha que custou o parser do Nubank em 31/08, e o teste guarda o contrafactual: o regex ingênuo pega **5.185,79**.

**AS PROVAS, AO CENTAVO:**
```
cartão 8818  1.070,89 ✓   cartão 2971  3.285,23 ✓   produtos e serviços  14,67
                            = 4.370,79 = "Total dos lançamentos atuais"
1.635,08 − 1.635,08 + 0,00 + 120,39 + 4.370,79 = 4.491,18 = "Total desta fatura"
```
e o **confirm grava 4.491,18** — 37 lançamentos + a linha do encargo. ⭐ **O encargo vira LINHA com o nome QUE O DOCUMENTO USA** (*"Encargos (financiamento + moratório)"*): "Encargos sobre rotativo" é rótulo do Banrisul, e gravá-lo aqui poria na tela um nome que não existe na fatura que o dono tem na mão.

**⚠️ E A MEDIÇÃO PEGOU UMA TERCEIRA SUPOSIÇÃO MINHA — no NUBANK:** eu zerei os *"outros lançamentos"* no adaptador achando que já vinham como linha. **Não vêm**: a Σ das linhas dá 2.726,03 contra 3.053,32 declarados, exatamente os **327,29** do campo. Ia gravar a fatura do Nubank 327,29 curta — o mesmo bug dos R$ 0,62 do Banrisul de 26/08. *Conferi os três bancos pela mesma conta (Σ linhas + encargo == declarado) em vez de acreditar no meu raciocínio.*

**⭐ O GUARD DE ISOLAMENTO (o dono pediu):** os **7 layouts travados ao centavo**, cada um contra a sua fixture — Banrisul PJ 13.797,73 · Caixa 7.280,39 · Sicredi 7.896,32 · Mercado Pago 2.666,44 · Banrisul PF 18.348,72 · Nubank 3.053,32 · **Itaú 4.370,79/4.491,18**. ⚠️ Isso importa porque **Banrisul PF e PJ compartilham o `nucleo.ts`**: régua nova escrita "pro Itaú" num trecho comum sai de graça pros outros. Mais dois guards: **cada fixture casa com UM parser só** (testado sem a proteção da ordem do registry, senão um `match` largo no primeiro sequestraria os de baixo) e **todo banco do registry tem `ler`** — o teste que impede o campo de voltar a ser enfeite.

**A FIXTURE É ANONIMIZADA COM TROCAS DO MESMO COMPRIMENTO** (`scripts/gerar-fixture-itau.ts`): aqui a **geometria** é o que está sendo testado, e uma troca de tamanho diferente **move a calha** — a fixture passaria a testar um documento que não existe. O gerador **roda o parser antes e depois e aborta se qualquer número mudar**; sai o nome da segunda portadora (terceiro), o nome de pessoa física que aparece como estabelecimento, CPF, endereço e os números de documento.

**REGRA 11 medida — 3 defeitos repostos:** calha na página inteira → **8 vermelhos**; data com `^\s*` → **11**; o Banrisul cravado de volta no import → **6**. **32 testes novos · 9.033 verdes (era 8.987) · TS 0 · deploy `RixbA7qypgm6MJCkBrcAj` 4/4.**

⚠️ **REGRA 2 é do dono:** subir o PDF da fatura pela tela do cartão PF e confirmar — e **o import do Nubank também**, que nunca foi validado em prod e só agora tem como funcionar.

## ⭐⭐⭐ UM PIX PAGA N NOTAS — E O SUBSET-SUM SEM ÂNCORA É CAÇA-NÍQUEL (09/09/2026)

**O dono:** *"~30 contas VENCIDAS não apareceram na conciliação, e os pagamentos EXISTEM no extrato. O padrão: fornecedor pequeno com VÁRIAS notinhas — eu pago JUNTO, num PIX só. Aposto que o matcher só casa 1-pra-1."* **Ele estava certo em cheio.**

**⭐ MEDIDO EM PROD ANTES DE CODAR:** dois pagamentos em lote reais de 08/09 na Stone — **ODISSEA R$ 1.137,78 = 5 das 11 notas dela** e **ALAN R$ 1.370,33 = 5 das 12** — e a tela dizia **"Tudo conciliado ✓"**, porque nenhuma nota bate sozinha com o PIX consolidado. `comSugestao: 0` com 31 contas vencidas.

**⛔⛔⛔ A TRAVA CENTRAL VEIO DE UM ERRO MEU, MEDIDO:** a 1ª versão da investigação perguntava *"existe soma de N notas que dê o valor da linha?"* — e casou a ODISSEA com uma linha **"YUSSEF ABU ZAHRY MUSA · Distribuição de Lucros" de R$ 500,00**. Com 6 notinhas pequenas **quase qualquer alvo é alcançável**: medido nas listas reais do Alan e da Odissea, **9% de valores ALEATÓRIOS na faixa também fechariam**. ***Uma soma que fecha não prova nada sozinha.*** Foi o script de investigação que pegou isso, não um teste — e é o argumento de sempre a favor de medir contra o dado real antes de escrever a feature.

**⭐ POR ISSO SÃO TRÊS ÂNCORAS, e nenhuma é opcional** (`lib/stock/../conciliacao/pagamento-em-lote.ts`):
1. **A LINHA NOMEIA O FORNECEDOR** — FK (só 1,3% das linhas a têm) ou o nome reconhecido pela `reconhecerFornecedor` da casa. Sem fornecedor resolvido o motor **nem roda**.
2. **JANELA DE VENCIMENTO** (−45d / +15d da data do pagamento) — ninguém paga hoje uma nota de daqui a três meses.
3. **COMBINAÇÃO ÚNICA** — duas combinações que fecham é a resposta **"não sei qual foi"**, e o sistema não sugere. Escolher uma seria a régua decidindo quais notas o dono pagou.

**⭐ A LINHA QUE NOMEIA E NÃO FECHA NÃO SOME** (16 em prod: Ivan, Maria Luiza, Oesa, Casper, Box Paper). Quase sempre é **pagamento parcial** ou pagamento de nota que não está no sistema. Sumir seria o *"erro disfarçado de vazio"* que esta casa já pagou caro — ela aparece recolhida, com os números à vista, e o gesto é **"escolher na mão"**, que abre o Find & Match **já com o nome do fornecedor na busca**. ⚠️ O painel N:1 (soma conferida + ajuste de juros) **já existia desde a Fase B.3**; o que faltava era **CHEGAR nele** — perder no caminho a informação que a tela acabou de mostrar é obrigar o dono a procurar de novo numa lista de 100.

**⭐ E O VALOR EXATO DEIXOU DE SUMIR:** `contabilidade R$ 1.621,00` e `di car R$ 1.000,00` tinham o valor **exato** no extrato e não eram sugeridos — 50 (valor exato) + 5 (pago 4-7 dias depois) + 0 (a conta lançada à mão não tem fornecedor) + 0 (o nome digitado não parece com o do extrato) = **55, abaixo do corte de 70**. Agora **valor exato dentro de 7 dias aparece mesmo abaixo do corte**, com o score real preservado (nasce em confiança BAIXA, ranqueado abaixo dos fortes). ⛔ **Não é baixar o corte** — isso deixaria entrar valor PRÓXIMO, que é palpite. **Medido antes de ligar: +2 pares, os dois que ele nomeou, ZERO conta ganhando mais de uma opção.**

**⭐⭐ A ORDEM DO FLUXO, ESCRITA NA TELA:** *"Passo 2 de 2 — importou → o óbvio casou no import → aqui fica o que precisa de decisão. **Casar vem antes de categorizar**: ao vincular, a conta a pagar leva a categoria dela junto. Linha que você já categorizou como despesa **continua casável** — ter categoria não quita conta nenhuma."* ⭐ **E isso está PROVADO no dado, não prometido:** as duas linhas de lote de prod já têm categoria (*Embalagens - Delivery* e *Matéria-Prima - Alimentos*) e continuam sendo oferecidas — o `LINHA_DISPONIVEL_WHERE` não olha `categoryId`, de propósito, desde 07/09.

**⛔ E O LOTE AVISA ANTES DE PEDIR CATEGORIA:** em `/pendentes` o banner de vínculo 1:1 já vinha antes da sugestão de categoria; o PIX consolidado **não tinha aviso nenhum** e chegava pedindo categoria — categorizar como despesa deixaria as N notas abertas pra sempre. Agora a linha diz *"parece o pagamento de 5 notas do ODISSEA"* e manda pra Conciliação. ⚠️ **Só o AVISO mora lá: a decisão do lote tem UM lugar.** Duas telas montando o mesmo lote seriam duas derivações da mesma pergunta — a lição do B1, que já custou o `GruposSugeridos` duplicado do cardápio.

**PROVADO EM PROD pelas ROTAS REAIS com sessão assinada** (`/api/conciliacao/fila` **200**): `lotes: 2 · notasEmLote: 10 · comSugestao: 2 · não fecham: 16`. **Prestação de contas das 31 vencidas: 11 resolvidas em 1 clique (9 por lote + 2 pelo valor exato) · 8 com pagamento no extrato que não fecha (escolher na mão) · 12 sem pagamento nenhum no extrato importado** — essas esperam ARQUIVO, não decisão.

**REGRA 11 medida — 2 defeitos repostos, 3 vermelhos** (sem a âncora de fornecedor, o caça-níquel volta; com o corte de 70 de volta, os dois pares de valor exato somem). **12 testes novos com os números reais · 8.987 verdes · TS 0 · deploys `h14uvBKIgIKzT6Vo0jIYd` e `JGnfRT4i_vz3Z_5qDP7sh`, os dois 4/4.**

⚠️ **O QUE NÃO ENTROU (registrado, não feito):** a sugestão de vínculo **dentro do preview do import de OFX**. Hoje a ordem "casar antes de categorizar" vale de `/pendentes` (onde a linha chega depois do confirm) em diante; o preview do import ainda só classifica. E o lote com **diferença de juros** não é sugerido com 1 clique — ele cai no *"escolher na mão"*, onde o ajuste com categoria já existe: sugerir um lote inexato exigiria **inventar** qual parte é juros.

## ⛔⛔⛔ RÓTULO QUE SOME QUANDO EU DIGITO É RÓTULO QUE NÃO EXISTE (09/09/2026)

**O dono, depois de saber a causa do "1" que ele chutou:** *"conserta em TODA tela que fizer isso, independente de qual era a minha — rótulo que some quando eu digito é rótulo que não existe (foi exatamente assim que eu chutei '1' sem saber o quê). **Rótulo fixo em cima do campo, placeholder só de exemplo.**"*

**A TELA DOS "3 QUADRADOS" ERA O MOBILE DO DANFE MANUAL** (`itens-manuais-editor.tsx`) — três caixas embaixo do nome do produto com `qtd` · `un` · `preço` **só no placeholder** e **sem total de linha**. ⚠️ **O DESKTOP DA MESMA TELA ESTAVA CERTO O TEMPO TODO** (`<th>` por coluna + coluna Total): o defeito vivia só no caminho que ele usa de fato. *Tela conferida no desktop não é tela conferida.*

**⭐ A VARREDURA ACHOU 14, NÃO 1** — e duas valem por si:
- **A PORTA DA IMPRESSORA não tinha NEM placeholder** — caixa completamente muda.
- **A PERGUNTA DO FATOR era o placeholder** (*"quantas KG tem 1 CX?"*, na conferência **e** no DANFE manual): a única pista visível **sumia no primeiro dígito**. Agora a pergunta fica em cima e o placeholder é um número de exemplo.

**⛔ O GUARD (`__tests__/regras-ui/rotulo-que-some-nao-e-rotulo.test.ts`):** campo de dado sem rótulo que FIQUE na tela quebra a suíte. **Três exceções, e as três têm rótulo que não some:** célula de tabela (o `<th>` da coluna) · campo de **busca** (ali o placeholder é o propósito, não o nome de um dado que vai ser gravado) · campo embrulhado num `<label>` (a checagem é **estrutural** — procura o `<label>` aberto acima sem `</label>` no meio —, não por distância em linhas).

**⚠️⚠️ E O DETECTOR ERRADO ESCONDEU 4 DEFEITOS REAIS:** a 1ª versão olhava **uma linha só**, então `<input`, `placeholder=` e `aria-label=` em linhas diferentes passavam despercebidos nos dois sentidos — dava falso positivo no fator (que tem rótulo inline) e **falso NEGATIVO** no PIN da equipe, na etapa da ficha e no fator do DANFE. Lendo o **elemento inteiro**, os quatro apareceram. *Guard que lê uma linha de JSX não lê JSX.*

**REGRA 11 medida:** repondo a pergunta como placeholder, **vermelho** nomeando arquivo e linha.

## ⛔⛔⛔ A PÁGINA ABRIA E O DADO NÃO VINHA — A **4ª** VOLTA DAS "DUAS PORTAS" (09/09/2026)

**O dono:** *"/equipe renderiza mas mostra 'Não consegui carregar a equipe' + 'ninguém da cozinha cadastrado ainda' — com 5+ pessoas cadastradas."*

**MEDIDO com a sessão real do Cristian:**
```
LISTA da equipe  GET → 403 ⛔ falta user.invite     ← e o banco tem 17 pessoas
redefinir PIN    GET → 200
usuários         GET → 403 (correto: ler ≠ mexer)
```

**AS QUATRO VOLTAS, e cada uma escapou do guard da anterior:**
1. **(08/09)** a **porta** da página era mais restrita que a **ação** que o servidor já autorizava;
2. **(08/09)** a página abriu pra `stock.manage`… e o **menu** ficou em `user.invite`;
3. **(09/09)** guard novo: *o item do menu não pode exigir mais que a página*;
4. **(09/09)** **a ROTA DA LISTA ficou pra trás** — e o efeito foi **pior que um 403 na cara**: a página abre, a chamada morre, e a tela afirma *"ninguém cadastrado"*. **Erro disfarçado de vazio.**

**⭐⭐ POR QUE O GUARD DA 3ª VOLTA NÃO PEGOU — e é a lição que fecha a família:** ele comparava **MENU × PÁGINA**, as duas portas que eu conhecia. **A terceira porta é a API que a página chama DEPOIS de abrir**, e *status 200 da página não diz nada sobre ela*. Nas palavras do dono: *"página que abre com dado que não vem é exatamente o que o teste de rota não pega."*

**O FIX:** a rota da lista aceita o mesmo conjunto da página — **ver a lista é o desenho aprovado** (ele precisa saber quem existe pra cadastrar cozinha e redefinir PIN). **Gerenciar acesso continua `user.invite`**, e o cliente já desabilitava convite/papel/aparelho com o motivo escrito: **ler e mexer são travas diferentes, e só a primeira abriu.**

**⛔ E ERRO E VAZIO NUNCA MAIS JUNTOS:** quando a carga falha o sistema **não sabe** se está vazio — afirmar que está é inventar. O estado vazio só renderiza sem erro, e a mensagem passou a distinguir **permissão** de falha de rede.

**⭐ O GUARD DA FAMÍLIA (`pagina-abre-com-dado.test.ts`):** pra **cada papel que a página aceita**, **toda rota que o cliente chama** tem que responder — lendo os `fetch` do componente e o guard de cada rota **das fontes**. Rota nova na tela sem entrar no guard fica vermelha, em vez de virar *"ninguém cadastrado"* na cara do dono. **Red-then-green: 4 vermelhos com os defeitos repostos.**

**PROVADO EM PROD, navegando como cada um:**
```
cristian  LISTA 200 ⭐ 17 pessoas (13 da cozinha) · cadastrar cozinha ✅ · PIN ✅
          usuários 403 · aparelho 403 ⭐ negado, como tem que ser
tablet    LISTA 403 · cadastrar 403 · PIN 403 · acesso 403
```
**8.958 verdes · TS 0 · deploy `QIuxg3hWohT5KO0I1esVE` 4/4.**

## ⭐⭐⭐ UM CAMINHO SÓ: VENDA → FICHA → COMPONENTE(S) (09/09/2026) — decisão do dono

**A ordem:** *"Produto vendido baixa estoque por UM mecanismo, não três. Três caminhos pra mesma pergunta é como a bagunça nasce — cada tela nova precisa conhecer os três, cada auditoria conferir os três. Revenda é só o caso particular de ficha com 1 componente ×1: é o caminho que já cobre o caso complexo, então os simples cabem nele — o contrário não."*

**⭐ MEDIDO ANTES — a migração era MUITO menor do que parecia:**

| caminho | quantos | |
|---|---|---|
| **1. ficha** | **42** | já era o alvo |
| **3. mapa direto** | **2** | SKOL e FRUKI 600ML (⚠️ a COCA LATA **já era ficha** — o dono lembrou errado) |
| **2. fundida** | **2** | COCA COLA 2L e COCA LATA |

⚠️ **E as OUTRAS 6 linhas de `stock_item_mesclado` são mescla de ITEM DE VERDADE** (Coxão, Bobina, Filé de frango): **não entram**, e varrê-las junto seria estrago.

**AS PORTAS FECHAM NUM CHOKE-POINT SÓ:** `upsertVendaMap` com `REVENDA` passa a **criar a ficha de 1 componente por baixo** — os **três** callers (dropdown do hub, tela do Suitable, lançamento manual) herdam, e **não há uma quarta porta pra alguém esquecer**. ⭐ O gesto de 1 clique **não muda pra quem usa**. E `mesclarItens` **recusa invólucro de ficha**, com o motivo escrito (a mescla MOVE MOVIMENTO — foi por aí que +154 garrafas entraram no item real); mesclar item de verdade continua funcionando.

**⛔⛔ DOIS RISCOS QUE OS TESTES EXPUSERAM ANTES DE PROD — e são o motivo de ter feito red-then-green antes de migrar:**
1. **O LINK APODRECERIA.** A bebida que era `item:<id>` virou `ficha:<id>`, e um favorito antigo daria 404 — contra a regra do próprio arquivo (*"a chave é um LINK, e link não apodrece"*). Curado com `baixaItemId` no hub + um último degrau em `acharLinhaPorChave`. **Provado em prod: `item:7qundp` ainda abre o SKOL.**
2. **REUSAR FICHA SÓ PELO NOME.** Uma ficha homônima que baixa **outra coisa** seria reusada e o produto passaria a baixar o item errado **em silêncio** (no fixture degenerado virou explosão infinita). Agora só reusa o **passa-direto do MESMO item**; senão, erro que ensina a saída.

⚠️ E o guard do rename deixou de tratar RECEITA como dona de nome — a linha do cardápio leva o nome do PDV **de propósito**, e bloquear o rename da garrafa por isso seria o guard impedindo o desenho.

**5 testes invertidos com o motivo escrito** (status `REVENDA` → `FICHA_OK`, chave `item:` → `ficha:`, nome exibido vira o do cardápio) e **1 fixture degenerada corrigida** (uma ficha que produzia **e** consumia o mesmo item — ciclo que `criarFicha` recusa e que só existia porque o teste gravava por SQL cru).

**CRITÉRIO DE ACEITE, PROVADO EM PROD** (`pg_dump pre-caminho-unico-20260909-041524`):
```
alvoTipo FICHA: 44 · mapas diretos restantes: 0 · invólucros fundidos: 0
   (as 6 mesclas de item de verdade preservadas)
44 produtos · 0 pendentes · 43 itens baixados · 0 baixando em invólucro
plano do migrado: SKOL ⭐ IDÊNTICO · FRUKI 600ML ⭐ IDÊNTICO
item:7qundp → ⭐ abre "SKOL"   ·   item:xap6fc → ⭐ abre "FRUKI 600ML"
```
**8.950 verdes · TS 0 · deploy `yp1LvHxIl0C41PzpDE6wd` 4/4.**

## ⭐⭐ INVÓLUCRO DE FICHA: NÃO FUNDIR OS OUTROS — E O CATÁLOGO CONTAR A VERDADE (09/09/2026)

### ⭐ A CONFERÊNCIA DA COCA 2L FUNDIDA: **nenhuma aresta**

```
"COCA COLA 2L (mesclado)" · PRODUTO_FINAL · ativo=false · mesclado em COCA-COLA 2L
   usado como componente: 0 · mapa direto: 0 · ordens de produção: 0
   ficha ativa v1 · cardápio FICHA_OK · custo 8,09 · a venda baixa −8 na garrafa
```
Nem geração/pack, nem contagem, nem leitor esperando o invólucro existir. **A estrutura fundida funciona.**

### ⛔⛔ MAS NÃO VALE FUNDIR OS OUTROS — e o dado é que decide

**MEDIDO:** dos invólucros que apareciam no Catálogo, **57 são passa-direto de revenda** e **36 têm vários componentes** (XIS, BURGER, Combo, pizza).

1. **A mescla só alcança 61% do problema.** Combo Caçula não é "parte de" garrafa nenhuma — não há em que fundir. Sobrariam 36 linhas com exatamente a mesma cara, e o dono passaria a ter **dois estados pra lembrar** em vez de um. *Cura que resolve 6 de cada 10 não é cura, é um segundo caso especial.*
2. **`stock_item_mesclado` significa "virou parte de outro" — e isso é FALSO aqui.** O invólucro é a linha do cardápio; ele não virou a garrafa. E o rastro da mescla vive na ficha do SOBREVIVENTE (decisão de 30/08): a garrafa passaria a dizer *"absorveu COCA COLA 2L"*, o que confunde em vez de explicar.
3. **⛔ A MESCLA MOVE MOVIMENTO** (estorno no absorvido + igual no sobrevivente). **Foi exatamente esse mecanismo que empurrou o fantasma de +154 pra dentro da garrafa real.** Repetir 57 vezes é criar 57 chances do mesmo estrago — por uma arrumação de tela.
4. **Onde importa, os dois estados já são idênticos:** Posição, contagem e busca escondem os dois igualmente. A única diferença era o **Catálogo** — e Catálogo se conserta com tela, não com cirurgia de ledger.

**RECOMENDAÇÃO, e o que ficou:** os 2 já fundidos **ficam como estão** (funcionam, e desfazer mexeria no ledger de novo sem ganho); **nenhum outro é fundido**. ⚠️ Fica a assimetria registrada: 2 fundidos e o resto não — visualmente idêntico depois do fix do Catálogo.

### ⭐ O CATÁLOGO PASSA A DIZER O QUE É CADA LINHA

**O dono:** *"parece item duplicado/quebrado, e eu mesmo levei susto achando que a mescla tinha dado errado. O dono não pode olhar o Catálogo e achar que tem duplicata."*

- receita vira **linha secundária indentada** sob a garrafa que ela baixa: *"↳ BRAHMA · receita de venda → baixa BRAHMA CHOPP 600ML"*;
- com vários componentes: *"receita de venda → 2 componentes"* — **sem fingir um dono**, porque eleger "o principal" seria decidir por conta própria;
- ⛔ **sem saldo, custo ou mín/máx**: *"0 UN · a definir"* ali não é informação, **é o ruído que assustou**;
- legenda: *"garrafa se conta e se compra; a receita só diz o que baixa quando vende"*.

**⚠️ E UM ZERO SILENCIOSO MEU NO CAMINHO:** a 1ª medição respondeu *"0 invólucros no Catálogo"* — e eu quase reportei que ele estava enganado. Eu li `cat.itens` e `listCatalogo` **devolve o array direto**; `undefined ?? []` deu lista vazia. **É a REGRA 8b em outra roupa: zero silencioso é indistinguível de "não tem".** Refeito com a forma certa: **93 receitas apareciam como linha cheia**, exatamente como ele descreveu.

**PROVADO EM PROD:** `236 linhas · 93 receitas · 57 indentam sob a garrafa · 36 com N componentes · 31 itens REVENDA continuam linha cheia (28 com saldo) · 0 item de prateleira marcado como receita`. **3 testes · red-then-green: 2 vermelhos com o defeito reposto · 8.945 verdes · TS 0 · deploy `VyH5GTh_kkI3CjO3xQ8pj` 4/4.**

## ⭐⭐ BEBIDA SEM NOTA + SIGLA NÃO FICA NO NOME (09/09/2026)

### ⭐ "EXISTE NA GELADEIRA, SÓ NUNCA VEIO NF" — o caminho da 1ª semana

**O dono:** *"Começamos há 1 semana — essas bebidas estão na geladeira, só nunca veio NF delas."* As 3 que a auditoria achou vendendo sem item foram criadas: **item REVENDA/UN com custo 0** (a 1ª nota ensina o preço) + **ficha de revenda ×1** + **vínculo com o PDV**, tudo na mesma transação.

**⛔⛔ SALDO NASCE ZERO, e é o ponto.** *"Saldo NÃO se chuta"* — item sem movimento é item **sem contagem**, não item sem estoque. Chutar "umas 12 garrafas" poria número inventado exatamente onde o Real vs Teórico vai medir. Os 3 entram na fila de contagem e o saldo vem de lá.

**⚠️ O NOME DO ITEM ≠ O NOME DO CARDÁPIO, de propósito:** `FANTA LARANJA LATA 350ML` (o que está na geladeira) × `FANTA LARANJA LATA` (a linha do menu). Além de ser o desenho, evita a colisão que o guard de 09/09 recusa — e que foi o que criou os invólucros duplicados.

**PROVADO EM PROD:** as 3 vendas baixam o item novo (`−3 · −1 · −1`, **0 pendentes**), os 3 estão **na fila de contagem com saldo 0**, e **0 invólucros** na fila junto. ⚠️ `MILKSHAKE SABOR PACOCA` fica de fora (decisão do dono: família doces).

### ⛔ SIGLA NÃO FICA — "CC" não serve

- **Volume solto ganha ML:** `CC 600 PET 12` → **COCA COLA 600ML** (era "COCA COLA 600"). ⛔ **Lista FECHADA** de volumes de bebida: inferir ML de qualquer número faria `SACO PAPEL SOS 15` virar "15ML".
- **⛔⛔ SIGLA SOZINHA JÁ PÕE O ITEM NA FILA.** `CERV SKOL 600ML` não tinha nenhuma marca de embalagem e ficava **fora** da revisão — e o dono lê "CERV" na Posição do mesmo jeito. Varredura: era **o único** nessa situação.
- **⚠️ 2 testes MEUS invertidos com o motivo escrito** (esperavam "COCA COLA 600"; o dono pediu a unidade junto).

**PROVADO EM PROD:** **36 itens na fila · 0 sugestões com sigla · 0 itens com sigla fora da fila.**
```
0000903482 - CERV HEINEKEN PIL 0.60GFA RT 24UN → CERVEJA HEINEKEN PILSEN 600ML
CC 600 PET 12                                  → COCA COLA 600ML
DV UVA LT 290ML 6U FL                          → DEL VALLE UVA LATA 290ML
CERV SKOL 600ML                                → CERVEJA SKOL 600ML
```
**8.942 verdes · TS 0 · deploy `yF2TBYVmM4h0G8GhTf2gB` 4/4.** ⚠️ Falta o **confirmar dele** na fila — depois disso "coca" acha os 7 por extenso e nenhum "CC" sobra visível.

## ⭐⭐ AUDITORIA DAS BEBIDAS (0 divergência) + NOMES DE NOTA EM LOTE (09/09/2026)

### ⭐ FRENTE 1 — cada produto baixa a GARRAFA CERTA: **25 auditadas, 0 suspeitas**

Régua de vermelho: divergência de **marca · sabor · zero×comum · tamanho** entre o vendido e o baixado. **Nenhuma.** Os dois que o dono mandou olhar com lupa estão certos:
- `COCA LATA` → **COCA COLA LATA 350ML** (comum, custo 2,91) — **não** a Zero (2,90)
- `SUCO DE PESSEGO` → **DV PESSEGO** · `SUCO DELL VALE` → **DV UVA** (os dois a 3,07, e cada um no seu)

**⚠️ DAS 4 SEM FICHA, SÓ UMA TEM ALVO CERTO — as outras viram AVISO, não palpite:**

| vendido no PDV | o que existe no estoque | veredito |
|---|---|---|
| FANTA LARANJA ZERO 2L (2 un) | `FANTA LARANJA ZERO 2L` · 18 un · custo 0 | ⭐ dá pra apontar |
| **FANTA LARANJA LATA** (3 un) | só a **ZERO** (`FANTA LARANJA ZERO LATA`, 31 un) | ⛔ **a comum não existe** — decisão dele |
| **FRUKI ZERO 2L** (1 un) | há Fruki Zero 600 e Zero lata, e Fruki **comum** 2L | ⛔ **não existe Zero 2L** — decisão dele |
| **HEINEKEN LONG ZERO** (1 un) | só a `HEINEKEN PIL 0.60GFA` (600ml comum) | ⛔ **não existe long zero** — decisão dele |

⭐ Ele **previu exatamente isto** ao pedir ("se só existe a ZERO, me AVISA em vez de apontar na errada"), e é a mesma regra do módulo inteiro: **a ausência se reporta, não se preenche**. ⚠️ Achado no caminho: `MILKSHAKE SABOR PACOCA` (2 un) também vende sem destino — não é bebida de revenda, fica registrado.

### ⭐⭐ FRENTE 2 — nome de nota vira nome de gente

**⭐ A PERGUNTA QUE ELE EXIGIU ANTES DO PRIMEIRO RENAME, respondida:** **nenhum vínculo do módulo é por NOME**. `fornecedor→produto` é `(cnpj, cProd) → itemId`; ficha, histórico, mapa de venda e contagem são **por id**. A única busca por nome é a dedup do *"criar item novo"* na conferência — **não é vínculo**. ⚠️ **Consequência registrada:** se um cProd NOVO chegar e alguém digitar o nome ANTIGO em "criar item novo", a dedup não casaria e nasceria duplicado — **o apelido fecha esse flanco**, e é por isso que ele não é enfeite.

**⚠️⚠️ E O NOME DO CARDÁPIO NÃO VIROU A RESPOSTA — o dado real derrubou a ideia óbvia.** Nos 13 itens mapeados ele **perde informação**: `SUCO DELL VALE` esquece que é **UVA** (com o de PÊSSEGO ao lado, mesmo custo 3,07), `HEINEKEN` perde o **600ML**, `ORIGINAL` perde "cerveja 600ML". Entra como **atalho de um clique**, nunca por cima da sugestão.

**O que subiu:** régua pura (`nome-limpo.ts`) · tabela **CREATE-only** `stock_item_nome_anterior` (apelido de busca + quem renomeou) · a busca acha pelos **dois** nomes · tela de revisão em lote **tudo desmarcado ao abrir** (confirmar em lote não pode virar "aceitei sem ler") · e o **GET não grava nada** (provado: 229 itens antes e depois, 0 renomeios).

**⚠️⚠️ DUAS ARMADILHAS QUE SÓ O PREVIEW CONTRA PROD MOSTROU:**
1. **`LT` é LATA *ou* LITRO.** `DV UVA LT 290ML` é lata; `LEITE UHT … CX 12 X 1 LT` é **litro** — e a régua escrevia *"1 LATA de leite"*. Agora só vira LATA quando há um tamanho em **ML** na mesma linha.
2. **`CX/08 PC`** deixava um **`/08` órfão** no meio do nome quando o `CX` saía.

**35 itens na fila de revisão · 21 testes** (incluindo os 4 vínculos que não podem quebrar e a busca achando por *"CC 600"* depois do rename) · **8.934 verdes · TS 0 · `pg_dump pre-nomes-20260909-024026` · deploys `QfauR4_xjo40f4OpaoXgQ` e `W2AYP6PpdoJ1tIgeCM6Uo`, os dois 4/4.**

## ⛔⛔⛔ BEBIDA TEM UM ITEM SÓ — A FICHA DE REVENDA CRIAVA UM SEGUNDO (09/09/2026)

**O dono:** *"COCA COLA 2L aparece 2× na busca da receita. Fiz uma máscara e acho que fiz errado."*

**⭐ A 1ª HIPÓTESE CAIU NA MEDIÇÃO:** a busca **não** mistura ficha com item — ela lista **só `stock_item`**. As duas COCA eram **dois itens de verdade**:
```
[cmt6ugy5t…] "COCA-COLA  2L"  REVENDA/CONFERENCIA  560 un de NF   ← a garrafa
[cmts4gqv9…] "COCA COLA 2L"   PRODUTO_FINAL/MANUAL criado pela FICHA ← a linha do menu
```
**Toda ficha cria um item-invólucro pro produto que ela produz.** Numa ficha de revenda esse invólucro nasce **ao lado** da garrafa que a nota alimenta.

**⛔⛔ E O ESTRAGO FOI MUITO ALÉM DA BUSCA — a contagem oferecia OS DOIS.** As garrafas foram contadas **na linha do invólucro**, cujo saldo de sistema era **0**: cada contagem virou um `+N` fantasma (**+154** Coca 2L · **+67** lata · **+62** Coca 600 · +43 · +33 · +7 …) enquanto o item real seguia com o saldo da nota. Ao **mesclar** dois deles (a "máscara"), o fantasma entrou **dentro** do item real: `COCA-COLA 2L` foi de 560 pra **714** com **154 garrafas na geladeira**.

**⭐⭐ A DÍVIDA ESTAVA ESCRITA DESDE 21/08, no próprio `tipos-ficha.ts`:** *"item de PRODUTO_FINAL (XIS COMPLETO, PIZZA PEQUENA 25CM) também aparece na contagem hoje e também não se conta — são 2 linhas, decisão do dono"*. **Eram 2 linhas; viraram 27** com o cardápio de bebidas, e aí custaram 9 ajustes fantasma. *Dívida registrada não é dívida paga — ela cobra juros no dia em que o volume chega.*

**OS QUATRO FIXES:**
- **`CATEGORIAS_SEM_PRATELEIRA` = [SABOR, PRODUTO_FINAL]** — um dono só (`seContaFisicamente`), consumido pela **contagem** E pela **Posição**. O invólucro é a linha do cardápio; ninguém estoca "XIS COMPLETO" nem "COCA COLA 2L (do menu)". ⚠️ Produto comprado pronto é `REVENDA` e **continua** dentro.
- **A busca da receita não oferece o PASSA-DIRETO de revenda** (ficha de **1 componente ×1 de item REVENDA**) — oferecê-lo é oferecer a garrafa com um degrau a mais. ⛔ Régua **estreita de propósito**: XIS (vários componentes) e COMBO (leva o Xis) **ficam**; afrouxar aqui esconderia produto real da receita, que é o erro caro.
- **`criarFicha` RECUSA nome que já é item de prateleira** e **ensina a saída**: *"já existe COCA-COLA 2L no estoque, alimentado por nota fiscal (saldo 560 UN) … aponte o nome do PDV direto nesse item — a venda baixa a garrafa do mesmo jeito, sem ficha"*. Criar assim vira **decisão explícita** (`permitirItemNovoComNomeDeEstoque`).
- ⭐ **E o caminho dele FUNCIONA pra venda** — conferido: as fichas explodem na garrafa, e SKOL/FRUKI (mapeados **direto no item**) já baixam. O defeito era a duplicação, não a mecânica.

**11 testes · red-then-green: 5 vermelhos com os 3 defeitos repostos · 8.908 verdes · TS 0 · deploy `RNE7CqsiB9K5KQMbD8DbI` 4/4.**

### ⭐ O SELO DO CARDÁPIO FALA DO RESULTADO, NÃO DO CAMINHO (09/09)

**O dono:** *"SKOL e FRUKI aparecem com selo 'revenda' e as outras 'completa'. Confirma que os DOIS caminhos baixam certo — e se sim, unifica (pro dono importa 'baixa e tem custo', não o caminho interno). Se algum NÃO baixa, me conta antes."*

**MEDIDO COM O PLANEJADOR REAL (dry-run, nada gravado) — os dois baixam igual:**
```
SKOL           (mapa direto no item) → CERV SKOL 600ML       −10 · custo 6,21
FRUKI 600ML    (mapa direto no item) → FRUKI GUARANA 600ML    −5 · custo 3,75
COCA COLA 2L   (mapa na FICHA)       → COCA-COLA  2L          −8 · custo 8,09
COCA ZERO LATA (mapa na FICHA)       → CC Zero LT 350ml       −3 · custo 2,90
```
Os dois caem **no mesmo item de estoque, com custo**. Só por isso o selo pôde unir — a pergunta *"os dois baixam?"* tinha que ser **respondida**, não presumida. Ambos agora mostram **"baixa certo"**. ⚠️ O `status` continua distinto por dentro (é ele que escolhe o gesto que a tela oferece), e **o que NÃO baixa mantém selo próprio**: unificar não pode apagar problema.

### ✅ A ARRUMAÇÃO DOS DADOS — APLICADA (09/09, autorizada pelo dono)

**`pg_dump pre-bebidas-20260909-013719.dump` (5,7 MB) antes.** 13 bebidas re-baseadas, **13/13 ✓**, ledger imutável (estorno do fantasma + ajuste novo contra o saldo certo).

**CONFERIDO DEPOIS, em prod:**
```
POSIÇÃO   150 itens · R$ 134.571,96 · bebidas com MAIS DE UMA linha: 0 · invólucros: 0
CONTAGEM  160 linhas · invólucros: 0
COCA-COLA 2L 154 UN (R$ 1.245,48) · COCA LATA 67 · CC 600 62 · CC Zero 2L 43 …
```

**⚠️ BUG MEU PEGO NO PREVIEW, antes de aplicar:** a 1ª versão subtraía **todos** os fantasmas do saldo do item real, inclusive os que estão no invólucro (que não entram nesse saldo). `COCA COLA 600ML` daria **−284** em vez de **−346**, deixando 124 garrafas onde a marcyelle contou 62. **Preview existe pra isso** — e a versão corrigida bate com a medição independente feita antes por outro caminho.

### 📋 (histórico) O PREVIEW QUE ANTECEDEU A APLICAÇÃO
`scripts/arrumar-contagem-de-bebida.ts` (preview + `--aplicar`). **13 bebidas**, ledger **imutável** (estorno do fantasma + ajuste novo, nunca UPDATE):
```
COCA COLA 2L    154 │ COCA-COLA  2L         714 → 154 │ -406
COCA LATA        67 │ COCA COLA LATA 350ML  307 →  67 │ -173
COCA COLA 600ML  62 │ CC 600 PET 12         408 →  62 │ -346   (+10 outras)
   valor que sai do estoque: ~R$ 5.573
```
⚠️ **NÃO é perda nova:** bebida **nunca teve baixa de venda** (os mapas do PDV são de ontem), então o sistema segurava a nota inteira. Isto é a **1ª contagem real de bebida** virando saldo. **A contagem da marcyelle está certa — errada estava a LINHA.**

**⚠️ BUG MEU PEGO NO PREVIEW, antes de aplicar:** a 1ª versão subtraía **todos** os fantasmas do saldo do item real, inclusive os que estão no invólucro (que não entram nesse saldo). `COCA COLA 600ML` daria **−284** em vez de **−346**, deixando 124 garrafas onde ela contou 62. **Preview existe pra isso** — e a versão corrigida bate com a medição independente que eu tinha feito antes, por outro caminho.

## ⛔⛔ O GERENTE NÃO CHEGAVA NA EQUIPE — A PORTA NÃO ACOMPANHOU A SALA (09/09/2026)

**O defeito é meu e é a terceira volta da MESMA classe.** Em 08/09 eu abri a **PÁGINA** `/equipe` pra `['user.invite', 'stock.manage']` — porque a tela faz duas coisas, gerenciar quem **LOGA** e gerenciar **COLABORADOR** de produção — e **deixei o item do MENU exigindo só `user.invite`**. Lá a porta era mais restrita que a ação; aqui **o menu ficou mais restrito que a porta**.

**MEDIDO EM PROD, papel a papel, com as chaves REAIS do banco:**

| papel | menu | página | redefinir PIN |
|---|---|---|---|
| OWNER (37 chaves) | ✅ | ✅ | ✅ |
| **GERENTE_ESTOQUE (4 chaves)** | **⛔** | ✅ | ✅ |
| EXECUTOR_PRODUCAO (1 chave) | ⛔ | ⛔ | ⛔ (correto) |

⛔ **Porta fechada com a sala aberta** — e **eram DOIS gerentes**, não um: o Cristian **e a marcyelle** podiam usar a tela e não tinham como chegar nela.

**O FIX:** `usePermissaoMenu` passa a aceitar **"qualquer uma destas"** (`perm="user.invite|stock.manage"`). ⚠️ **Separador `|` em vez de array por um motivo duro:** o guard estrutural do menu lê `perm="..."` **por regex**; virar `perm={[...]}` deixaria o item **invisível pro guard** — exatamente o buraco que ele existe pra fechar. O guard foi atualizado pra validar **chave a chave**, então typo continua sendo pego.

**GUARD NOVO (`porta-acompanha-a-sala.test.ts`):** *o item do menu nunca pode exigir MAIS do que a página pra onde ele leva.* Ele lê o `requirePermission` da página e o `perm` do menu **das fontes**, e compara. Red-then-green: repondo `perm="user.invite"`, **2 vermelhos**.

**PROVADO EM PROD com a sessão real de cada um:**
```
cristian  MENU ✅ (régua antiga: ⛔ — era isto) · /equipe 200 · PIN passa a trava
          lista de colaboradores 200 (13) · lista de USUÁRIOS 403 ← a fronteira intacta
tablet    MENU ⛔ · PIN 403 · colaboradores 403 · usuários 403
```
⭐ **A fronteira de papel continua de pé:** o gerente administra **colaborador e PIN**; **quem LOGA** segue sendo `user.invite`, e ele leva **403** ali. Abrir a porta não afrouxou a ação.

**⚠️⚠️ DOIS ERROS MEUS NO CAMINHO, e os dois são sobre método:**
1. **Assinei o token com `{userId}` e o `getAuthUser` lê `sub`.** Com `sub` indefinido, o `findFirst({ where: { userId: undefined, companyId } })` do `getAuthContext` **ignora o filtro e devolve o PRIMEIRO papel da empresa** — eu medi o **OWNER** achando que era o Cristian, e quase reportei "37 chaves" como vazamento de permissão. **Token de teste se assina pelo `signToken` da casa**, nunca à mão.
2. **Sondei o método do "redefinir PIN" por tentativa (`POST`) e criei um colaborador "Carlisle" duplicado em prod.** O `POST /estoque/colaboradores` é *cadastrar pessoa*; o redefinir PIN é `POST /estoque/producao/cadastros/pin`. **Removido** (zero rastro: 0 PINs, 0 etapas, 0 conclusões, 0 participações — era lixo da sondagem, não uma pessoa; 14 → 13). ⭐ **A lição:** prova em prod não chuta verbo de rota que ESCREVE. O certo é o que fiz depois — **payload inválido de propósito**: `400` prova que a trava deixou passar, `403` provaria que barrou, e **nada é gravado**.

**8.897 verdes · TS 0 · deploy `fldyLllPU6VQ0afvVsbbm` 4/4.** ⚠️ REGRA 2 é do dono: o Cristian logando e abrindo a Equipe pelo menu.

## ⛔⛔⛔ A REGRA DO HISTÓRICO HONESTO — A SOMA DA TABELA **É** O SALDO (09/09/2026)

**A suspeita do dono, olhando o BACON:** *"Pra CADA ordem aparecem DUAS saídas do mesmo tamanho — Separação −12,341 E Produção·consumiu −12,34 — e NENHUMA linha positiva de devolução. Se o saldo soma os dois tipos, todo insumo de produção baixa 2×."*

**⭐ MEDIDO ANTES DE MEXER — e o saldo estava CERTO (braço B):**

| item | Σ TODAS as linhas | Σ sem `PRODUCAO_CONSUMO` | **saldo exibido** |
|---|---|---|---|
| BACON | −34,14 | **114,00** | **114,00** ✓ |
| FILÉ DE PEITO DE FRANGO | −112,26 | **59,71** | **59,71** ✓ |
| Gordura | −0,50 | **20,95** | **20,95** ✓ |

`saldo.ts` sempre excluiu o `PRODUCAO_CONSUMO` (é transferência interna — o insumo já saiu na separação). O invariante **P1 fecha em 60 de 60 ordens concluídas**, e o resíduo por item é **exatamente** o material preso nas **8 ordens abertas de hoje**. **Nada vaza.**

**⚠️ E UM ERRO MEU NO CAMINHO, corrigido pela segunda medição:** minha 1ª fórmula de P1 rodou **por ITEM** e acusou "NÃO FECHA" nos três. Falso: P1 só fecha **por ORDEM CONCLUÍDA** — material separado numa ordem ainda aberta legitimamente não foi consumido. A conta por ordem deu 0 quebras. *Fórmula errada dá alarme com cara de achado.*

**⛔ MESMO COM O NÚMERO CERTO, ISTO ERA DEFEITO** — palavras do dono, e viraram régua da casa: ***"a dúvida que essa tela me deu hoje é falha da tela mesmo se o número estiver certo por baixo; rastreio que deixa o dono na dúvida não rastreou nada."***

**A REGRA QUE FICA:** ***ou a linha entra na conta, ou não aparece somando.***

- **`saldo.ts` passou a EXPORTAR quem move a prateleira** (`movePrateleira`/`TIPOS_FORA_DA_PRATELEIRA`). A régua já tinha um dono só — **mas era privada**, e a TELA não tinha como saber dela. Foi essa invisibilidade que deixou a tela somar o que o saldo não conta.
- **O consumo sai da lista e vira HISTÓRIA dentro da linha que baixou:** *"separado 10 · consumido 8 · devolvido 2 · em produção 0"* — informativo, **sem valor na coluna TOTAL**.
- **A devolução FICA como linha própria**: ela move a prateleira, então tem que somar.
- **Rodapé novo**: a soma das linhas com o selo *"✓ bate com o saldo em estoque"*. É o teste da tela **à vista do dono** — sem ele, ninguém tem como saber se a tabela fecha.
- **Vale pro extrato também** (`/estoque/movimentos`), pelo mesmo dono.
- ⛔⛔ **NADA SOME EM SILÊNCIO:** consumo **sem** separação correspondente **continua aparecendo**, marcado como "não move o saldo" e com `—` no total. Fazer a linha sumir seria trocar uma mentira por um **buraco**, e buraco é a doença que este módulo mais paga.
- ⚠️ **Tipo NOVO entra na conta por default** (é denylist, não allowlist): esquecer de cadastrar um tipo faz ele **aparecer e somar** — o erro seguro. O inseguro seria um movimento real sumir do saldo sem ninguém ver.

**⚠️ E O DADO REAL PEGOU UM DETALHE QUE A FIXTURE NÃO TERIA:** a separação grava **4 casas** e o consumo **2** (`separado 15,0487 · consumido 15,05`), então o resíduo dava **−0,001** e a tela diria *"em produção −0,001"* — mandando o dono procurar um grama que não existe. Piso de 0,01 (o mesmo do CHECK do ledger); acima dele o resíduo é real e aparece. Dois testes travam os dois lados.

**REGRA 11 — 2 defeitos repostos, 6 vermelhos** (o consumo de volta na lista somando; a tela com régua própria de prateleira). **9 testes novos**, incluindo a **conta de padeiro do dono** (*separo 10, consumo 8 → saldo cai 8, não 18*). **TS 0 · 8.887 verdes · deploy `BoBuBkHw_Oqj3KzlG7FXO` 4/4.**

**PROVADO EM PROD, na empresa inteira:** **170 itens batem · 0 não batem.** BACON `soma 114 KG / R$ 3.404,53 == saldo 114 / R$ 3.404,53`, com *"ordem de 09/09 · porcao bacon 80 grama → separado 10,356 · em produção 10,356"* (ordem aberta de hoje) e **0 consumos listados como saída própria**.

## ⛔⛔⛔ A "HISTÓRICO DE COMPRAS" MOSTRAVA O LEDGER INTEIRO — E LINKAVA TUDO ERRADO (08/09/2026)

**O dono:** *"Linhas NEGATIVAS (consumo!) aparecem como 'recibo' de compra, entradas grandes sem dizer se foi contagem/ajuste/estorno, e NADA diz quem fez. Quando eu precisar rastrear um erro, quero saber exatamente aonde foi cada kg."*

**MEDIDO NO BACON (`cmtda5dwo006nek1cy78rlzvn`), em prod, antes de tocar em código:**

| | |
|---|---|
| linhas na tela de "compras" | **19** |
| **não eram compra** | **16** (AJUSTE_CONTAGEM 4 · PRODUCAO_CONSUMO 6 · SEPARACAO_SAIDA 6) |
| **negativas** (consumo) sob a coluna *"Preço un."* | **14** |
| sem autor no banco | **0** — o rastro sempre existiu em `criadoPorId`, **ninguém o mostrava** |

**⛔ A CAUSA ERA UMA LINHA:** `buildFichaItem` fazia `findMany` **sem filtro de tipo** e jogava o resultado num campo chamado `compras`, com interface `CompraLinha`. O comentário do arquivo dizia, desde a Fase 1: *"preparada pra crescer (consumo/contagem/produção nas próximas fases leem os mesmos movimentos)"*. **As fases chegaram, os movimentos entraram, e o rótulo ficou.**

**⛔⛔ E O LINK ESTAVA QUEBRADO EM 84% DAS LINHAS — ninguém tinha reportado.** O `receiptId` é **polimórfico**: aponta pra conferência, ordem de produção, sessão de contagem, import de venda ou entrada manual, e **quem desambigua é o `tipo`** (decisão de 21/08 — o isolamento proíbe ALTER em `stock_movement`, então não dá pra ter uma coluna por destino). A tela ignorava isso e mandava **tudo** pra `/estoque/recibos/{receiptId}`.

**⭐⭐ O PAR ±222 QUE O DONO ESTAVA OLHANDO — a resposta, com os ids:**
```
[cmtmfja4v00c47928yywxsq18] 04/09 04:04 · AJUSTE_CONTAGEM · +222,19 KG · R$ 6.661,26
[cmtsxzxet00rylxp5xheux6a1] 08/09 17:27 · AJUSTE_CONTAGEM · −222,01 KG · R$ −6.631,44
   ⭐ os DOIS no MESMO receiptId cmtmf0htx00007928189dzw11 (contagem ROTINA, por marcyelle)
```
**Não é compra nem consumo: é a MESMA linha de contagem, contada em 04/09 e RECONTADA em 08/09.** O `@@unique(contagemId,itemId)` faz recontar virar UPDATE da linha, e cada confirmação grava o ajuste compensatório — o desenho de 23/08 (*"ajuste na hora, por linha"*) funcionando. **Líquido +0,18 KG.** ⚠️ E a sessão **seguia ABERTA desde 04/09** — 4 dias; a tela de Contagens mostra isso, mas vale o olho do dono.

**⛔ A MESMA MENTIRA VIVIA NO EXTRATO** (`lib/stock/movimentos.ts`): lá a `referencia` colapsava **tudo** que não tinha nota em `label: 'conferência'` — produção, contagem e baixa de venda apareciam como "conferência". **Duas telas, a mesma pergunta, duas respostas erradas.** Por isso o fix é um **dono único** (`lib/stock/movimento-explicado.ts`) que as duas consomem, em vez de consertar só a que o dono viu.

**O QUE CADA LINHA GANHOU:** chip com o **tipo real** (cor por família: compra verde · contagem violeta · produção azul · venda âmbar · saída coral) · **QUEM** — e na contagem é **quem CONTOU** (`contadoPorNome`), não quem abriu a sessão, porque numa sessão longa não é a mesma pessoa · **DE ONDE** com link pra fonte certa · **filtro por tipo** (só os que existem no item) + **aba "só compras"**, que devolve o uso original limpo.

**⛔ E SAÍDA NÃO DIZ MAIS "PREÇO UN."** — numa baixa o `custoUnitario` é o **custo médio do estoque no instante**; exibi-lo como preço faria o dono comparar fornecedor contra a média do próprio estoque. A célula agora marca `médio`.

**⭐ A ROTA DE DESTINO MORA NA LIB, não em cada tela** — se cada uma montasse a própria URL, a próxima divergiria no primeiro tipo novo, que é exatamente como o `/recibos/` acabou valendo pra contagem. Duas âncoras pequenas foram junto pra o link **chegar de fato na fonte**: `#c-<id>` na lista de contagens e `?aba=processados#dia-<data>` nas vendas (a aba lida no 1º render, pra não piscar).

**⛔ TIPO DESCONHECIDO APARECE COM O NOME CRU** — nunca vira "recibo" nem some. Foi o fallback silencioso que produziu o defeito inteiro: *melhor uma linha feia e honesta que uma linha bonita e errada.*

**REGRA 11 — 4 defeitos repostos, 4 vermelhos** (o fallback "recibo", o link cego pro recibo na produção e na contagem, e o rótulo do extrato). **12 testes** com as linhas reais do BACON. **TS 0 · 8.880 verdes · deploy `4qQzkdHeE8-7D8SfGraGv` 4/4.**

**PROVADO EM PROD pelo MESMO caminho da tela:** `19 linhas · rótulo "recibo": 0 · sem QUEM: 0 · sem link: 0 · saídas dizendo "Preço un.": 0`, com *"NF nº 968530 · CASPER DISTRIB."* → recibo, *"ordem de 06/09 · porcao bacon 80 grama"* → a ordem, e o par ±222 → a sessão de contagem.

## ⛔⛔⛔ O TABLET TRANCOU TRÊS PESSOAS FORA DO PRÓPRIO TRABALHO (08/09/2026)

**O dono:** *"Ela esqueceu de finalizar e foi embora; eu finalizei pelo gerente — tudo fechado. Mas quando ela digita o PIN no tablet aparece 'Você está com "produção" em andamento. Finalize antes de começar outra.' — e ela não tem NADA em aberto."*

**⚠️ UMA CORREÇÃO NO RELATO, e ela não muda o diagnóstico:** o rastro diz que a etapa não foi finalizada pelo gerente — foi **`ENCERRADA_SEM_FINALIZAR` (`ORDEM_CONCLUIDA`)**, ou seja a ordem foi concluída pela tela de Produção e varreu a etapa aberta junto. A aposta dele sobre a CAUSA estava certa em cheio.

**⛔⛔ A CAUSA É A ARMADILHA MAIS BONITA DESTE MÓDULO — a mesma coluna que segura a honestidade é a que tranca a pessoa.** Nos **dois** gestos que fecham uma etapa sem tempo medido, `finalizadoEm` **fica NULL de propósito**: é isso que os mantém fora das médias por construção (REGRA 5, decisão de 07/09). Lida **crua**, essa mesmíssima coluna responde *"tem gente com a mão na massa"*. **Todo leitor que perguntar "em andamento?" olhando a coluna vai errar — e vai errar mais a cada gesto novo que fechar etapa sem carimbo.**

**⭐ A VARREDURA ACHOU CINCO LEITORES, não um** (o dono pediu: *"que OUTROS leitores existem?"*):

| leitor | o que a régua crua fazia |
|---|---|
| **trava "uma por vez" do tablet** | ⛔ **trancou a Carlise** — e ela não tinha saída, porque o gesto que resolveria a etapa é do gerente e ele já o tinha feito |
| **alarme das 4h** | remontava **à mão** os degraus 1 e 3 de `derivarEstadoDaEtapa` com dois `notIn` — **segunda derivação**, concordando por coincidência |
| **`inativar-colaborador`** | recusaria **tirar a pessoa da equipe** ("1 etapa em andamento"), um impedimento sem gesto que o resolvesse |
| **fechar o lote pelo tablet** | contaria a etapa finalizada pelo gerente como "faltando" → **a cozinha nunca fecharia o lote** numa ordem que o gerente já resolveu |
| **`abertasIgnoradas` do relatório** | contava a mesma etapa **duas vezes** (presente no corpo E como ignorada), inflando justamente o número que diz *quanto trabalho ficou fora da conta* |

Todos passam agora por **`lib/stock/producao/em-andamento.ts`**, que pergunta pra `derivarEstadoDaEtapa`. Três perguntas com nome próprio: `somenteEmAndamento` · `somentePendentes` (*ainda pede trabalho* — outra pergunta) · `etapasEmAndamentoDoColaborador`.

**⛔⛔ A CAMADA DO PARTICIPANTE NÃO SE RESOLVE CARIMBANDO O RELÓGIO DELE — e essa foi a decisão mais importante.** O dono levantou o nível 2 (*"o finalizar-pelo-gerente fecha o registro de participante dela também? Se a etapa fecha e o participante fica aberto, TODO leitor de participante vai mentir"*). A tentação óbvia era gravar `participante.finalizadoEm = agora`. **Isso inventaria um horário que ninguém mediu, um nível ABAIXO de todos os testes que protegem o de cima** — o mesmo erro que o NULL da etapa existe pra impedir, escondido onde nenhum guard olha. **Quem manda é o ESTADO DA ETAPA; o relógio do participante é RASTRO, não veredito.** Conferido: os outros dois leitores de participante (`etapasDaOrdem` e `dia-ao-vivo`) **já** usavam o resolvedor pro estado e o participante só pra nome/designação — a camada 2 era mais estreita do que parecia.

**⭐⭐ E NÃO HOUVE RETROATIVO DE DADO — porque não havia dado errado.** O estado **sempre esteve certo** no banco (ordem CONCLUIDA + `stock_etapa_encerrada` gravado); a derivação única já respondia `ENCERRADA_SEM_FINALIZAR` antes de eu tocar numa linha. **Quem mentia era o leitor, e leitor se conserta com deploy, não com UPDATE.** `scripts/destravar-tablet-preview.ts` prova isso read-only, em vez de eu afirmar.

**⛔⛔ E A PROVA EM PROD ACHOU MAIS DUAS PESSOAS — as duas travadas HOJE:**
```
⭐ DESTRAVA Carlisle    “produção” de 06/09 19:38 → ENCERRADA_SEM_FINALIZAR (ORDEM_CONCLUIDA)
⭐ DESTRAVA lucas       “porcao”   de 08/09 17:13 → ENCERRADA_SEM_FINALIZAR (ORDEM_CONCLUIDA)
⭐ DESTRAVA michelle    “produção” de 08/09 17:12 → ENCERRADA_SEM_FINALIZAR (ORDEM_CONCLUIDA)
   (as outras 10 da equipe: livres pelas duas réguas)
```
⚠️ **O dono relatou UMA pessoa; eram TRÊS**, e duas travaram no mesmo dia, 1 minuto uma da outra — a cozinha estava batendo nisso repetidamente e só um caso chegou até ele. **É o argumento a favor de varrer a classe em vez de consertar a instância**: o relato é a ponta do que o defeito faz.

**REGRA 11 medida — 4 defeitos repostos, 4 vermelhos** (a trava, o alarme, o inativar e o relatório, cada um no seu teste). **12 testes novos** montando a cena real pelos construtores de verdade, com a régua crua afirmada explicitamente em cada um pra o guard não passar por cegueira. **TS 0 · 329 verdes em produção+equipe · deploy `c_4ub9zAIf5LCi-wXJydJ` 4/4.**

⚠️ **REGRA 2 é do dono:** o PIN da Carlise, do lucas e da michelle entrando livre no tablet, com a cozinha rodando.

## ⭐⭐ O HOJE VIROU POSTO DE COMANDO + A TELA DA DUPLA (08/09/2026)

### ⛔⛔ REGRA 2 FALHOU NO SPRINT ANTERIOR — e o dono achou navegando

*"O modelo aceita 2 participantes, mas a tela da ordem só tem UM seletor de pessoa por etapa — não existe onde marcar a segunda. **REGRA 2 falhou aqui: o caminho do usuário não foi navegado.**"*

⚠️ **O motor estava certo; a LEITURA é que não chegava na tela** — `etapasDaOrdem` não devolvia os participantes. Subir o modelo sem andar o caminho do gerente é a definição do que a REGRA 2 existe pra impedir.

**O seletor único virou CHIPS**, e duas escolhas seguram a regra:
- **o "+" some quando a vaga acaba** — o teto de 2 aparece como **ausência de opção**, não como erro depois do clique;
- ⛔ **quem já iniciou não tem X**: ganha o selo **"no relógio"**. Tirá-lo pela designação **apagaria trabalho medido** — pra esse caso existem os dois gestos do gerente, que **registram** o que houve em vez de reescrever.

**⚠️ E um bug meu junto:** o redesignar do HOJE mandava **o dono do card**, não os participantes da etapa — remanejar teria **apagado a segunda pessoa sem ninguém pedir**. Passou a receber os `designados` do servidor.

### ⭐⭐ O POSTO DE COMANDO — as 6 decisões, aprovadas no mock antes de codar

1. **O CRONÔMETRO MANDA** — 34px no AGORA, 16px na linha de cada pessoa. É *a pergunta da tela*, e de 2 metros é a única coisa que precisa ser legível. ⛔ **O formato muda com a grandeza**: `mm:ss` até 1h (o segundo andando é o que diz "está vivo"), `h:mm` depois — aí o segundo é ruído.
2. **O ALERTA PINTA O CARD INTEIRO** de coral. O único alarme da tela tem causa real; **ícone no canto é fácil de não ver justo no caso que existe pra ser visto**.
3. **BOTÕES DE VERDADE**, com *"pedir pra finalizar"* como **primário** — o caminho preferido, porque aí ela aperta com o PIN e **o tempo é dela, medido**.
4. **"QUANTOS SAÍRAM?" nasce no card** quando é a última etapa, com o campo **vazio**.
5. **REDESIGNAR SÓ NA FILA**, com os dois campos da dupla.
6. **QUEM NÃO TEM NADA APARECE**, apagado, com o convite — **sumir com quem está livre esconderia justamente a decisão que o gerente precisa tomar**.

Mais: cards em **grade** (o molde do "Por Pessoa"), estados em **chip** (o caractere solto sumia no meio do texto quando a lista crescia), timeline com **ícone em disco** e hora em destaque, e o vazio **"cozinha em silêncio"** — que é o estado do fim do dia e do começo da manhã, **aparece toda hora** e não podia parecer "não carregou".

**⚠️⚠️ E UM ERRO MEU, PEGO NA HORA:** o primeiro teste do cronômetro **copiava o corpo da função** em vez de importá-la — a segunda derivação que este projeto inteiro combate, escrita por mim **num teste cujo próprio comentário dizia pra não fazer isso**. A conta foi pra lib (`textoDoCronometro`), e tela e teste importam a mesma. É a mesma lição do tablet que passou dois dias mentindo zero: **regra que mora na tela é regra que ninguém prova**.

**8.856 verdes · TS 0 · deploys `1GPNkuST7XCvpwFP4mOgz` e `eJu_JfmUOKiH99A6b7zNK`, os dois 4/4.** ⚠️ REGRA 2 é do dono: ele navega como gerente e como tablet, com a cozinha rodando.

## ⭐⭐⭐ A DUPLA NA MESMA ETAPA + AS AÇÕES DO GERENTE NO HOJE (08/09/2026)

### ⭐⭐ A DUPLA — dois relógios, nenhum minuto rateado

**A v1 travou em 1 responsável por etapa DE PROPÓSITO**, pra não ratear tempo no chute. A evolução admite duas pessoas e mantém a honestidade inteira: **cada uma inicia e finaliza com o próprio PIN**, e o `min/un` de cada uma sai do **próprio relógio**.

**AS DUAS DECISÕES DO DONO:**
1. **O SEGUNDO É OPCIONAL — "quem pegou, pegou".** A etapa fica FEITA quando todos que **INICIARAM** finalizarem. ⛔ O designado que nunca iniciou **não trava nada**: *"travar a etapa esperando quem não veio pararia a cozinha por um plano furado"*.
2. **A ETAPA 2 LIBERA COM A 1 FEITA** — *"a dependência é física: o moldar precisa do gessado PRONTO"*. ⭐ E isso saiu **sem tocar na régua de sequência**: ela continua olhando `etapa.finalizadoEm`, que passa a ser carimbado exatamente quando o último participante finaliza. **Uma regra só, igual à de hoje.**

**⛔⛔ AS UNIDADES DIVIDEM SÓ ENTRE QUEM MEDIU** — e o raciocínio ao pé da letra: `min/un = minutos ÷ unidades`, então **dar unidades a quem não tem minutos aumenta o denominador de alguém sem aumentar o numerador de ninguém**. É o defeito de 06/09 ("0 min/un" lido como "a mais rápida de todas") voltando por outra porta. ⚠️ Se **ninguém** mediu, dividem igual mas com minutos `null`: **o volume conta, o ritmo é a apurar**.

**⚠️⚠️ E O GUARD DA CASA ME PEGOU AFROUXANDO O QUE NINGUÉM PEDIU.** Eu tinha escrito *"só recusa quando já há DOIS designados"* — o que deixaria um terceiro entrar em tarefa designada a **uma** pessoa. Não é o desenho: *"a etapa aceita até 2 designados, o GERENTE escolhe os dois"*. Corrigido: **se há PLANO, ele manda; sem plano, vale o "quem pegou, pegou" até o teto**.
⚠️ E **plano é o que tem `designadoEm`** — o `colaboradorId` também é preenchido quando alguém **pega uma tarefa solta**, e tratar isso como plano **trancaria a etapa na primeira pessoa que tocasse**, matando a dupla em toda tarefa não designada (a maioria).

**⛔ O teto de 2 é do BANCO** (no iniciar e no designar), e **redesignar NUNCA apaga o relógio de quem já trabalhou** — apagar seria perder tempo medido de verdade.

### ⭐⭐ AS AÇÕES DO GERENTE NO HOJE AO VIVO

*"Hoje é o primeiro dia da equipe no relógio — vai ter esquecimento, gente embora sem finalizar, e EU resolvendo."*

**⛔ FONTE ÚNICA, SEM SEGUNDA IMPLEMENTAÇÃO:** os botões chamam **a mesma rota** da tela da ordem, que chama **as mesmas funções**; e quando é a última etapa, o *"quantos saíram?"* conclui pelo **mesmo `concluirDoTablet`** — consumo, custo e sobra pelo motor único.

- **"pedir pra finalizar" vem PRIMEIRO**: é o caminho preferido, porque aí **ela aperta com o PIN e o tempo é dela, medido de verdade**.
- o campo *"quantos saíram?"* nasce **vazio** — número sugerido vira número confirmado sem ninguém contar.
- **redesignar só na FILA**: etapa iniciada tem relógio correndo no nome de alguém, e **trocar o nome por baixo do tempo medido escreveria o trabalho de uma pessoa na conta de outra**.
- **`ehUltima` sai do SERVIDOR** junto do resto da tarefa: deixar a tela deduzir "é a última" seria uma segunda derivação da estrutura da ordem, e ela erraria no dia em que a receita ganhasse uma etapa.

⚠️ `concluirDoTablet` passou a aceitar `colaboradorId: null` — **pelo HOJE ninguém assinou com PIN**, e inventar um assinante seria pior que a ausência.

**PROVADO:** 26 testes novos (9 de integração com os dois relógios no banco) · **8.850 verdes · TS 0** · deploys `mnWSF1z-pdJ_WMVLGqzfU` e `Hw6_4hYK0iZtHnHEaUhVr`, os dois 4/4 · `pg_dump` antes da migration.

## ⛔⛔⛔ PRODUÇÃO: O CRONÔMETRO PARADO, O DESIGNAR QUE SUMIA E A PORTA DA EQUIPE (08/09/2026)

**Quatro achados, e três deles eram MENORES do que pareciam — porque a medição veio antes.**

### ⛔⛔ #4 O CRONÔMETRO PARADO NO ZERO — e o `Math.max` era o cúmplice

**O dono:** *"Funcionário clica INICIAR e o relógio fica no ZERO — não anda."*

**⭐ A primeira coisa medida foi a pergunta dele: o `iniciadoEm` grava?** Grava — **4 das 12 etapas recentes** têm o carimbo e as durações fecham. **O tempo real nunca esteve errado; era só a pintura.**

**A causa:** o cálculo era `Math.max(0, Date.now() − iniciadoEm)`. Num tablet com a **hora atrasada**, a conta dá **negativo** e o `max` **para o relógio em 00:00** — pelo tanto que o aparelho estiver errado. ⛔ **E o `max` era justamente o que ESCONDIA o problema: em vez de acusar, mentia zero.**

**⚠️ E A CASA JÁ SABIA:** *"o cronômetro é da TELA, o instante é do servidor (…) relógio de aparelho pode estar torto"* está escrito desde **06/09**, na tela do HOJE. Faltava aplicar **no tablet** — justamente onde o aparelho é compartilhado e ninguém acerta a hora. Agora as rotas devolvem `agoraServidor`, o desvio é **MEDIDO a cada resposta**, e a conta virou **função pura testada** (`relogioDaTarefa`) — *regra que mora na tela é regra que ninguém prova*, e esta ficou mentindo zero sem ninguém achar.

### ⛔⛔ #2 DESIGNAR SUMIA NA ORDEM DE ETAPA ÚNICA — e era literal

```js
if (etapas.length <= 1 && !etapas.some(e => e.executorNome)) return null
```

O bloco **inteiro** retornava `null`. A justificativa escrita era *"mostrar um bloco de uma linha só seria ruído numa tela longa"* — e **economizar uma linha de tela custou o GESTO INTEIRO**: receita sem etapas cadastradas é a maioria, e nelas designar era **impossível**, sem nada na tela dizer por quê. Invertido com o motivo escrito.

### ⭐⭐ #1 A FRONTEIRA DO GERENTE JÁ ESTAVA DE PÉ — faltava a PORTA

Medido antes de mexer, e **o achado mudou o tamanho do trabalho**: as rotas de colaborador e de PIN **já exigem `stock.manage`**, que o `GERENTE_ESTOQUE` tem via `stock.*`; convite, papel e "marcar aparelho" **já exigem `user.invite`**, que ele **não** tem; e o "trocar PIN" **já existia** na tela, com o motivo escrito (o PIN é hash — o gesto é **redefinir**, não ver).

**O que barrava era UMA LINHA:** a página `/equipe` inteira exigia `user.invite`. ⛔ **Uma permissão na PORTA escondia um gesto que o servidor já autorizava** — a tela faz duas coisas (gerenciar quem **loga** e gerenciar **colaborador**) e a porta só olhava a primeira. `resolveEmpresaAccess` passou a aceitar **lista (qualquer uma)**, e quem não tem `user.invite` vê **o motivo escrito** e o botão desabilitado — esconder o botão sumiria com a explicação junto. ⚠️ **Abrir a porta não afrouxa a ação: porta e ação são travas diferentes**, e o teste trava as duas (o que morde é repor `stock.*` como `'*'`).

### ⭐ #5 O VISUAL

**(a)** designar salva com **confirmação visível** — e o check verde nasce do que o **servidor devolveu**, não do clique: dizer "designado" a partir do próprio clique afirmaria uma gravação que pode não ter acontecido (*a flag diz "parece", o vínculo diz "é"*).
**(b)** no tablet, o **nome inteiro do produto virou protagonista** (26px) e a etapa virou rótulo. Antes o grande era o nome da **etapa** (`"porcao"`) e o produto inteiro ficava em cinza pequeno: **de longe, o tablet dizia "porcao" e não dizia porção DE QUÊ.**

**8.823 verdes · TS 0 · deploys `ubpQf0Apc5abe1J5R9vzU` e `vOby8GctHuU2SaZbdFHLx`, os dois 4/4.**

## ⭐⭐⭐ O CARDÁPIO POR SEÇÕES (08/09/2026) — a régua sugere, o dono confirma em UM gesto

**O dono:** *"A CLASSIFICAÇÃO INICIAL não pode ser 156 cliques meus (…) heurística sugere, eu bato o martelo — **mas num gesto, não em 156**."*

**⛔⛔ A SEÇÃO É GUARDADA POR NOME DO PDV, NÃO PELA CHAVE DO HUB — e a escolha tem um motivo duro.** A `chave` é `nome:<x>` enquanto o produto não tem destino e vira `ficha:<id>` quando ganha ficha: guardar por ela **perderia a seção justo no dia em que o dono cria a ficha**, que é o dia em que ele mais mexe na tela. O nome do PDV é o fato bruto que não muda — a mesma disciplina do *"o nome cru continua gravado como veio"*.

**⛔ A BORDA DE PALAVRA É O QUE SEPARA REGRA DE ACASO.** Sem ela `AGUA` casaria dentro de **GUARDANAPO** e `LATA` dentro de **SALATA**. E palavra que não bate **não vira palpite**: cai em Outros, à vista. ⚠️ *Nome desconhecido em Outros é 1 clique; nome na seção errada é um número errado no relatório de cobertura — e ninguém desconfia de número.*

**⭐ O GET DO LOTE NÃO GRAVA NADA.** A sugestão é calculada na hora; nada entra no banco antes do CONFIRMAR. Abrir a tela não pode ter classificado o cardápio inteiro — **ler não escreve**.

**⚠️⚠️ REGRA 11 PEGOU UM GUARD MEU QUE NÃO MORDIA — e a justificativa escrita estava ERRADA.** Eu afirmava que `FRANGO FRITO` precisava vir antes de `FRITAS` *"senão cairia em Porções pelo FRIT"*. Repus o defeito (movi a linha pro fim) e **nenhum teste ficou vermelho**: a borda de palavra já separava `FRITO` de `FRITAS`. Reescrito com o caso que morde de verdade — **`PORCAO DE FRANGO FRITO` casa em DUAS regras inteiras**, e aí a ordem decide (o específico ganha do genérico).

**⭐⭐ E MEDIR EM PROD MOVEU DUAS LINHAS DA RÉGUA — que é exatamente pra isso que ela é config, e não um modelo:**
- **`PIZZAS` (plural) entrou:** `PROMO 2 PIZZAS GRANDES` (**150 un**, dos maiores do cardápio) caía em Outros porque o **"2" no meio quebra a frase** `PROMO PIZZAS`, e a borda de palavra não deixa `PIZZA` casar `PIZZAS`.
- **`BURGERS` subiu acima de `FRANGO_FRITO`:** o real `BURGER FRANGO FRITO` é um **burger**.

**⚠️ O guard estrutural de rotas reprovou as duas rotas novas** por não usarem `guardStock` — **corrigidas na fonte, não afrouxado**.

**PROVADO EM PROD (`KFjP8_hPy00r8H6jO5nHT`) com os 156 reais:** **Σ das seções = 156 = total do hub — ninguém sumiu no caminho**, e **todo header soma certo** (`comFicha + semFicha === total`). A régua classificou **94 de 156**; os **62 que ela não soube** ficaram em Outros, nomeados, com `porQue: null` — e o maior deles é `GRANDE PRECINHO` (168 un), que não tem palavra nenhuma que o identifique. Cobertura real por seção: Bebidas 50% · Pizzas 50% · Burgers 23% · Xis 21% · **Pratos, Porções, Lanches e Doces em 0%** — é o mapa de onde atacar. **8.806 verdes · TS 0 · `pg_dump` antes da migration.**

## ⛔⛔⛔ QUANTIDADE NÃO ACEITAVA DECIMAL NA CONFERÊNCIA (08/09/2026)

**Caso real do dono:** *"Produto que chega por KG em fração (0,600 · 0,350 · 0,100) e o campo de editar quantidade não deixa ir abaixo de 1 — não aceito 0,600. Pra conferir a nota certa eu PRECISO do decimal."*

**⛔⛔ A TRAVA ERA INVISÍVEL NO NOSSO CÓDIGO — e é por isso que ninguém achava.** `<input type="number">` **sem `step` assume `step="1"`**: o navegador recusa `0,6` **sozinho**, sem erro, sem log, sem uma linha de validação nossa dizendo isso. Procurar no nosso código por "onde recusa decimal" não acharia nada, porque não havia nada.

**⭐ MEDIDO ANTES DE MEXER** (o dono pediu explicitamente pra avisar se algo no meio guardasse inteiro): **nada guarda**. `qtdNota`, `qtdRecebida`, `quantidade` do ledger, `qtdEntrada` e `qtdContada` são todas `Float`; a rota valida com `z.coerce.number().positive()` — **sem `.int()`**; e os únicos dois `Int` do schema (`VendaDiaria.quantidade`, `StockVendaLinha.quantidade`) são de **vendas**, onde ocorrência é inteira por natureza. ⭐ **A prova de que o armazenamento sempre esteve certo veio do dado:** dos **660 movimentos do ledger, 241 já eram fracionados** (vieram do `qCom` da nota), e **22 têm a 3ª casa significativa** (`1.834`, `1.736`, `0.926` — grama). **Só a DIGITAÇÃO era impossível.**

**⚠️⚠️ "N CAMINHOS, 1 ESQUECIDO", A CLASSE INTEIRA DE NOVO.** `lib/stock/quantidade.ts` **existe desde 28/08** e resolve exatamente esta dor — nasceu do MESMO bug no editor de ficha (*"digitar 0,050 é IMPOSSÍVEL: no instante em que o dono digita a vírgula, o texto '0,' vira o número 0 e a vírgula some da tela"*). **A conferência nunca o usou.**

**⛔⛔ E DUAS RÉGUAS DE PONTO CONVIVIAM — só visível medindo.** O módulo **cortava** no separador (`6.313 UN` → **6**); o cartão de contagem tinha **parse próprio** tratando ponto como milhar (→ **6313**), com o motivo escrito lá (*"absurdo pra digitar 6.313"*). Duas derivações da mesma pergunta, a lição do B1 agora na digitação. **Unificadas no módulo, e venceu a da contagem**: cortar em 6 **perdia 6.307 unidades em silêncio**. O `ehInteira` local do componente morreu — *regra que mora num componente é regra que ninguém prova*.

**⚠️ A LISTA FECHADA PASSOU A SER A DAS INTEIRAS, não a das fracionáveis** (`UN|UND|PC|PCT|CX|DZ|PAR|FD|SC`). Item novo com unidade imprevista (BANDEJA, FARDO) cai no lado que **aceita** fração: fração indevida numa peça o dono vê na hora, **campo bloqueado ele descobre com a nota na mão**. G e ML entraram junto, como o dono pediu.

**⭐ E A FRAÇÃO EM UNIDADE INTEIRA É IMPOSSÍVEL POR CONSTRUÇÃO, não por aviso:** o sanitizador **não deixa a vírgula existir** ali (`0,5 UN` → `05`). Não há o que validar depois.

**A VARREDURA DA CLASSE (o dono pediu a lista):** conferência **estava errada** (corrigida) · contagem **já aceitava decimal** e agora lê a mesma régua · editor de ficha **já estava certo** (é a origem do módulo) · ⚠️ **entrada manual, saída/perda, itens manuais e produção (concluir e previsão) já aceitam decimal** — todos usam `<input>` de texto com `Number(s.replace(',', '.'))` — **mas têm parse próprio, sem a régua da unidade e com `|| 0` engolindo lixo como zero**. **NÃO foram tocados de propósito**: mudar a semântica de quatro telas sem pedido (passar a recusar `0,5 UN`, deixar de devolver 0) pode travar fluxo real. Fica registrado como a próxima costura, à espera da palavra do dono.

### 📋 PRÓXIMO SPRINT DE ESTOQUE — a costura dos 4 parses (aprovado 08/09, NÃO urgente)

O dono aprovou costurar **entrada manual · saída/perda · itens manuais · produção (concluir e previsão)** na MESMA régua (`sanitizarQtd` + `valorQtd` + regra da unidade), com **duas exigências**:
1. **O `|| 0` MORRE.** Lixo digitado vira **erro visível**, nunca zero calado — *"zero silencioso em quantidade é a família do 'salvo que mentia'"*.
2. **UN passa a recusar fração nesses quatro** — mas **red-then-green com os fluxos reais antes**.

**⭐ O GATE JÁ FOI MEDIDO (08/09, read-only) — e a aposta do dono estava certa: NADA depende de fração em unidade inteira pela DIGITAÇÃO.**

| caminho | casos |
|---|---|
| contagem | **0** |
| fichas (receita) | **0** |
| entrada manual · produção · saída | **0** (nenhum movimento fracionado de UN veio de `ENTRADA_MANUAL`, `AJUSTE_CONTAGEM`, `PRODUCAO_*` ou `SEPARACAO_SAIDA`) |
| conferência / ledger | **4 itens** — e **todos vieram de `ENTRADA_NF`**, nenhum de teclado |

**⛔⛔ E OS 4 CASOS NÃO SÃO "ALGUÉM USA MEIA UNIDADE" — SÃO ITEM CADASTRADO NA UNIDADE ERRADA:** `19,2 UN` de *"QUEIJO MUSSARELA FATIADO **2KG**"*, `40,8 UN` de *"MOLHO TOMATE PIZZA **1,01KG**"*, `0,93 UN` de *"BOBINA 02 LITROS"*. A nota mandou **peso**; o item diz **peça**. Quem resolve isso é o gesto de **corrigir a unidade de entrada**, que já existe — não a trava da digitação.

**⚠️ CONSEQUÊNCIA DE DESENHO PRA QUANDO O SPRINT RODAR: a trava é do TECLADO, nunca do LEDGER.** Aplicar a regra ao `ENTRADA_NF` **recusaria uma nota legítima** — o fornecedor manda o que manda, e o nosso papel ali é registrar, não julgar. A régua da unidade vale onde o dono **digita**; o que chega da NF-e entra como veio e, se estiver na unidade errada, é a correção de unidade que conserta.

**PROVADO EM PROD (`xIrd6QsH_3gTO4Mw1A4V6`), o caminho inteiro:** `0,600` · `0,350` · `0,100` · `0.600` → **0.6 / 0.35 / 0.1 / 0.6** · `0,5` em UN → sanitizado `05` · `6.313` → **6313 em UN, 6.313 em KG**. No ledger real: `102,68 KG × 46,95 = 4.820,83` — proporcional exato. **8.760 verdes · TS 0.**

## ⭐⭐⭐ GRAFIA IGUAL É O MESMO SABOR, POR CONSTRUÇÃO (08/09/2026)

**O dono:** *"A tela mostra 'frango com catupiry (2) · já existe ficha via FRANGO COM CATUPIRY — mapear nessa ficha' me pedindo clique. **Se o nome canônico é IDÊNTICO (só caixa/acento difere), isso não é heurística sugerindo — é a mesma palavra.**"*

**⛔⛔ A FRONTEIRA É O CORAÇÃO DA REGRA, e ela é dura.** Automatizar o canônico igual só é seguro porque **tudo que exige julgamento continua pedindo clique** — e os casos são reais, não hipóteses:
- **TYPO:** `STROGONOFF DE CARNEE` ≠ `STROGONOFF DE CARNE`. ⚠️ **As DUAS grafias existem de verdade** (o cardápio escreve com EE, o PDV sem) — "corrigir" sozinho **apagaria um sabor**.
- **COMEÇA IGUAL:** `MUSSARELA ACEBOLADA` ⊄ `MUSSARELA` — dois pratos do cardápio.
- **DÍGITO:** `4 QUEIJOS` ≠ `5 QUEIJOS` — um caractere, outro produto.

**⭐ TRÊS PORTAS, UMA REGRA** (`aplicar-agrupamento.ts`) — e a terceira é a que o dono exigiu: *"deixa PLANTADO: quando uma ficha nova nascer, as grafias pendentes de canônico igual entram juntas na hora — **senão a regra só vale pro passado**."*
1. **IMPORT** — ⚠️ roda **ANTES da baixa**: a grafia que entra agora precisa estar no mapa quando o plano da baixa for montado, senão a ocorrência dela cairia na prateleira e só baixaria no próximo reprocesso. Uma linha de ordem, um dia de estoque certo. **Fail-soft**: agrupar é bônus, nunca derruba import legítimo.
2. **FICHA NOVA** — dentro da **transação da ficha** (ou entra tudo, ou nada — a disciplina que consertou as 3 fichas órfãs).
3. **RETROATIVO** — script com preview + `--aplicar`.

**⭐ E O "CRIAR FICHA PELO GRUPO" JÁ VINCULAVA TODAS AS GRAFIAS** — confirmado antes de mexer: `mapearComplemento` aceita array e grava todas na mesma transação. Não precisou de nada.

**⚠️⚠️ UM GUARD INVERTIDO COM O MOTIVO ESCRITO (não apagado).** Ele afirmava *"PENDENTE não se agrupa — antes de mapear ninguém sabe que são o mesmo sabor"*. A **metade certa** era não juntar por **PARECIDO**, e ela continua travada em dois testes novos. A **metade errada** era chamar de parecido o que é **a mesma palavra**. O critério de agrupamento passou a ter um dono só (`chaveDeApresentacao`): **ficha** quando há ficha · **canônico** quando pendente · **nome cru** quando IGNORAR (ignorar é decisão por nome — um `GRANDE` não tem nada a ver com um `PEQUENO`).

**⭐ O SUFIXO DE TAMANHO/PROMO — sugestão FORTE, clique obrigatório.** Lista **fechada e editável em código** (`FAMILIA · PROMO · GRANDE · MEDIO · PEQUENO · BROTO`, mais `PIZZA PEQUENA/GRANDE/MEDIA/BROTO` como prefixo). ⛔ Com lista **aberta**, `CALABRESA BLACK FRIDAY` viraria sugestão de CALABRESA — e promoção com nome inventado pode ser outro produto. E por que sugere em vez de mapear, nas palavras do dono: *"tamanho não muda a explosão (1 ocorrência = 1 explosão), então apelido na mesma ficha resolve"* — o gesto é barato e reversível, **mas é dele**.

**⛔ O RASTRO VAI EM TABELA PRÓPRIA** (`stock_venda_grafia_agrupada`, CREATE-only, unique por nome): o isolamento do módulo **proíbe ALTER** em tabela existente, e a separação é honesta — o vínculo é um fato, a razão dele é outro. Sem ela, o mapa diria "alguém mapeou" sem dizer que **ninguém clicou**.

**⚠️ E O AUTOMÁTICO SE RECUSA A ESCOLHER NUM CONFLITO:** mesmo canônico apontando pra fichas **diferentes** é dado inconsistente, não decisão — `conflitosDeGrafia` acha e mostra; escolher uma seria a adivinhação que a regra proíbe.

### ⛔⛔ E SOBROU DUPLICAÇÃO DE **TELA**: o mesmo sabor em dois lugares (08/09)

**O dono, depois do agrupamento funcionar:** *"A seção 'Sabores de pizza' (cards de grupo) e a tabela listam os MESMOS pendentes — 4 QUEIJOS, MUSSARELA, 5 QUEIJOS, PORTUGUESA, ENTREVERO, CARNEE, todos 2x na mesma página. (…) **Foi exatamente o que me fez achar que o bug continuava.**"*

**⛔⛔ A CURA NÃO FOI ESCONDER O SEGUNDO — FOI APAGAR O COMPONENTE.** `GruposSugeridos` (a faixa de cards acima da tabela) **deixou de existir**. Enquanto ele estivesse no arquivo, alguém religaria e a página voltaria a mostrar `4 QUEIJOS` duas vezes. **Impossibilidade, não vigilância** — e *"duas apresentações do mesmo dado divergem e confundem"* é a mesma lição do B1, agora na tela em vez de na query.

**⭐ A SUGESTÃO MUDOU DE ENDEREÇO, NÃO DE FORMA:** irmã com ficha, typo com ficha e sufixo FAMILIA viraram uma faixa âmbar **dentro da linha do sabor**, com o botão do lado. ⛔ **Parecida SEM ficha continua só informação** — juntar typo por conta própria é a classe do *"o memo diz Transferência"*; o gesto real é o "criar ficha" da linha, que leva o grupo inteiro.

**⛔⛔ E UMA CORREÇÃO QUE O PEDIDO ASSUMIA PRONTA — as ações da LINHA agiam só na grafia REPRESENTANTE.** Como a linha agora **é o sabor**, "criar ficha", "apontar ficha", "ignorar" e "desfazer" valem pras N grafias. ⚠️ Agir só na representante era invisível **do jeito pior**: a linha sumia da fila (a representante foi resolvida) e as irmãs ficavam pendentes **sem aparecer em lugar nenhum**, porque o agrupamento já as tinha juntado sob ela.

**⭐ A ORDEM É DO TRABALHO** (`ordem-da-prateleira.ts`), em quatro faixas: pendente **com sugestão** (ação de 1 clique) · pendente sem sugestão por ocorrências · já decidido · **"não vendeu" por último, mesmo estando pendente** — sabor do cardápio que não apareceu é **conferência, não fila**, e deixá-lo no topo empurraria pra baixo o que de fato vendeu. ⚠️ Medido: a CALABRESA (1.220 ocorrências, o maior volume de longe) fica **abaixo** de um pendente de 24 — ela já está resolvida.

**⚠️ REGRA 9 PEGOU UM BUG REAL MEU:** os hooks novos ficaram **depois do early return** de carregamento. O guard `hooks-antes-de-early-return` reprovou antes do deploy. Movidos pro topo com `?? []` — **a ordem dos hooks não pode depender de dado**, mesmo quando nada quebra hoje.

**PROVADO EM PROD (`E4SNLDyqEucTcuvYdGxwQ`) com os dados reais:** **230 linhas cruas → 181 na tela** (49 grafias fundidas na apresentação) e **`canônicos duplicados na página: []`**. A ordem saiu certa: `MUSSARELA` e `STROGONOFF DE CARNEE` (com sugestão) encabeçam os sabores mesmo com 55 e 6 ocorrências, e `STROGONOFF DE CARNE FAMILIA` (18) encabeça os outros. ⭐ E a fronteira segue de pé na tela: `4 QUEIJOS ▸2 nomes` e `5 QUEIJOS ▸2 nomes` são **duas linhas**, cada uma com as suas grafias.

**PROVADO EM PROD (`YzcCzYwUYwO1Z9r-nJN0D`), e o preview acertou os quatro que o dono nomeou:** `frango com catupiry` (2) · `Filé com Palha` (1) · `milho com bacon` (1) · `calabresa acebolada` (1) — todas com rastro `origem RETROATIVO`, **4/4 no mapa como FICHA**, **0 conflitos**, e **0 pendentes de canônico já mapeado sobrando**. A sugestão de tamanho achou `STROGONOFF DE CARNE FAMILIA` (**18 ocorrências**) esperando o clique. ⚠️ `SABOR CREME DE AVELA PROMO` seguiu pendente **de propósito**: a base `SABOR CREME DE AVELA` não está mapeada, e sufixo sobre base inexistente não é sugestão — é chute. **8.753 verdes · TS 0 · `pg_dump` antes da migration.**

## ⛔⛔⛔ A CONCILIAÇÃO ERRAVA DOS DOIS LADOS — E A FONTE ÚNICA DE SUGESTÃO (07/09/2026)

**O DONO:** *"Eu olhando uma conta a pagar casável e sem gesto pra casar."* · *"A tela mostra coisas que não têm nada a ver e às vezes NÃO mostra o que devia."*

**⛔⛔ O DEFEITO DE CLASSE: a fila era de CLASSIFICAÇÃO com nome de CONCILIAÇÃO.** A query é `origin=OFX` + `NEEDS_REVIEW` (que exige `categoryId IS NULL`) + `cashCoded=false`. Daí os dois erros saem **do mesmo lugar**: entra qualquer linha sem categoria (tenha par ou não), e a linha que ganha categoria **sai da fila pra sempre — mesmo com a conta aberta**. Medido na Caçula: a tela listava **0 linhas** enquanto havia **93 contas em aberto** e **R$ 230,81 em dupla contagem**. ⭐ **A regra nova: a fila é sobre VÍNCULO QUE FALTA, nunca sobre categoria que falta.**

**⛔⛔ O MATCHER SÓ ANDAVA NUM SENTIDO.** Ele nasce de uma **linha do extrato** e procura conta a pagar. A ex-payable do Cancian (paga, sem vínculo) **não é linha de extrato** — ninguém nunca procurou par pra ela. `sugerirVinculosDaConta` é o sentido que faltava, e **reusa a mesma função** em vez de ter ranker próprio: dois rankers divergem no primeiro caso de borda (a lição do B1).

**⭐⭐ OS 15 PONTOS DO FORNECEDOR ERAM LETRA MORTA — o achado que destrava tudo.** O critério exigia `supplierId` nos DOIS lados; medido: **90 de 6.750 linhas OFX têm `supplierId` (1,3%)**. O nome mora na **descrição** (`"CARLOS CANCIAN CIA LTDA - Pagamento"`). O efeito, medido pelo matcher real: o par Cancian (232,81 × 230,81, nome 87%, 3 dias) marcava **65 = NO_MATCH**, invisível abaixo do corte de 70; com o nome reconhecido vai a **80** e vira sugestão. ⚠️ **Reconhecer é SUGERIR, nunca gravar** — o `supplierId` da transação não é tocado —, e **empate técnico entre dois fornecedores devolve NULL**: 15 pontos não se dão a palpite.

**⛔⛔ A RÉGUA DA DUPLICATA FOI MEDIDA TRÊS VEZES ANTES DE ESCOLHER** (é o coração do "não tem nada a ver"): `conta+dia+valor+tipo` → **84 grupos**, quase todos Pix de gente diferente com o mesmo valor; `+ nome ≥85%` → **ainda erra** (o prefixo `"RECEBIMENTO PIX-PIX_CRED <cpf> "` engana o Jaro-Winkler); `+ FITID + descrição idêntica` → **0**. ⚠️ **E o FITID sozinho também não serve: o Banrisul RECICLA** — o FITID `000000` cobre 14 eventos diferentes (IOF, JUROS, TARIFA). **FITID diferente = o banco disse que são eventos diferentes**, e crer na minha heurística contra a identidade que o banco deu é o oposto da casa. **Zero é a resposta certa** — melhor aba honesta vazia que 84 fantasmas.

**⭐ A DIFERENÇA DE JUROS NÃO É UM `force` DISFARÇADO.** `diferencaAceita` carrega **o número que a tela mostrou** e só passa se **bater ao centavo** com a diferença real — mandar um valor qualquer continua sendo recusado. O `force` (que desliga tudo) segue existindo só pra backfill interno. E o rastro dos juros fica **escrito na conta**, não só no audit.

**⭐ `ESTOQUE_NF` ENTROU NAS ORIGENS ÓRFÃS** do `reconcile.ts`: a conta nascida da conferência de NF-e, quando marcada como paga, é **exatamente a mesma forma** de um órfão de Excel. Ficar de fora era o motivo de a costura do Cancian só existir como script.

**⭐ "NÃO É ISSO" ENSINA** (`conciliacao_par_recusado`, CREATE-only, **unique por par**): recusar era gesto sem memória. ⚠️ A recusa é **do PAR, não da linha** — o mesmo extrato continua podendo casar com outra nota do mesmo fornecedor. E vale nas duas telas: recusar na Conciliação cala nos Pendentes.

**⚠️⚠️ O CASO CANCIAN NÃO ERA O QUE O PRINT DIZIA — e é por isso que se mede antes.** O dono descreveu *"a linha da Stone … NF 834771 · 28/08 · −R$ 230,81"* como o pagamento, e a payable de 05/09 como o par. Medido: **não existe linha de extrato de R$ 230,81**. A linha que ele via nos Pendentes **É a própria ex-payable** (`ESTOQUE_NF/EFFECTED`, a única da fila), e o 28/08 é o 29/08 UTC visto em São Paulo. E a payable de **05/09 é OUTRA NOTA** (NF **835271**, chave `…835271…`), em aberto de verdade. Costurar o que ele descreveu marcaria uma nota **não paga** como paga. **O par que fecha 8/8 é NF 834771 × a linha de 232,81 de 31/08** (+R$ 2,00 de juros) — o mesmo par que a costura de 05/09 segurou de propósito.

**REGRA 11 — 2 defeitos repostos, os 2 morderam:** tirar `ESTOQUE_NF` das origens órfãs → **3 vermelhos**; aceitar qualquer número em `diferencaAceita` → **1 vermelho** (o teste do "número errado"). **8.714 verdes · TS 0 · deploy 4/4 (`WrsXqO2xmQlZRHiLkJx63`) · `pg_dump` antes da migration.**

**PROVADO EM PROD pelas rotas reais com sessão assinada:** `/api/conciliacao/fila` **200** (108 contas · **2 com sugestão** · 0 transferência sem par · 0 duplicata) e `/api/conciliacao/sugestoes-pendentes` **200** — a linha do Cancian devolve *"valor com R$ 2,00 de diferença · pago 3 dias depois do vencimento · o nome no extrato é CARLOS CANCIAN E CIA LTDA"*, score 80.

### ⭐⭐ A TELA NOVA (mock aprovado pelo dono antes de codar)

**O card do par tem os DOIS LADOS EM CHÃO DE COR DIFERENTE — frio é o extrato, quente é a conta.** É **estrutura, não enfeite**: quem lê nunca precisa procurar rótulo pra saber de que lado está. No meio, a tira do **porquê**, que é obrigatória — *"sugestão SEMPRE com motivo visível; nunca vincula sozinha"*. Três abas com **contador honesto** (enquanto carrega mostra `…`, nunca um número chutado) e **"Já conciliadas"** como saída lateral.

**⛔⛔ O BADGE DO MENU ERA A SEGUNDA DERIVAÇÃO — e a fila nova ia fazê-lo mentir ao contrário.** Ele tinha `count` próprio com a definição VELHA (`origin=OFX` + `categoryId IS NULL` + `cashCoded=false`) e o comentário dizia *"IDÊNTICO ao filtro de /ofx-pendentes pra badge bater com a aba"* — ou seja, a cópia estava **documentada**. Com a tela mudando de pergunta, o menu marcaria **0** com **2 pares na tela**. Agora chama `contarVinculosEsperandoDecisao`, a MESMA função que a tela desenha. ⚠️ E o filtro por TIPO saiu do badge: a fila nova não filtra `apenas-pagamentos`, porque conta a receber sem pagamento casado é trabalho igual.

**⭐⭐ OS GUARDS DA CASA ACHARAM UM BURACO DE VERDADE — e é o melhor argumento a favor deles.** Três testes de `isCardPayment` / `loanInstallmentPaid` / `pendingTransfer` ficaram vermelhos. Eram **grep no fonte** da rota (a classe de falso vermelho que a REGRA 3 existe pra evitar — e esses arquivos JÁ registravam essa lição de 29/08), **mas apontavam defeito real**: a 1ª versão da fila oferecia **qualquer** linha OFX sem vínculo como pagamento, **inclusive dinheiro que já tem dono** (fatura de cartão, parcela de empréstimo já casada, transferência entre contas próprias, linha ignorada). Sugerir uma dessas é oferecer o mesmo dinheiro duas vezes. `LINHA_DISPONIVEL_WHERE` fecha isso. ⛔ **E de propósito ela NÃO inclui `categoryId`** — era exatamente esse filtro que fazia a tela velha esquecer a linha assim que ela ganhava categoria; **ter categoria não quita conta nenhuma**. Os três guards foram **reescritos pra EXECUTAR a regra** (afirmam o objeto, não o texto da rota).

**⚠️ UM TESTE INVERTIDO COM O MOTIVO ESCRITO:** o sprint do filtro de data listava a `/conciliacao` como uma das 3 páginas com período. Ela era **lista de linhas do extrato**, e lista se navega por data; a tela nova é **fila de decisão** sobre o que não tem pagamento casado — o período dela é "o que está em aberto", e filtro de data ali só serviria pra **esconder conta vencida**. É o mesmo raciocínio que o arquivo já registrava pra `/transferencias`. A `/pendentes` continua sendo lista e mantém o filtro.

**⚠️ O QUE SUMIU DA TELA E ONDE FOI PARAR:** categorizar linha de extrato é a fila de `/pendentes`, que cobre o **mesmo universo** (a query velha era subconjunto dela) — nada se perdeu. O **Find & Match** (a saída do Xero pro caso difícil) continua vivo, agora pendurado no card do par em **"Procurar outra"**.

**⚠️⚠️ 9,6 s → 242 ms: O LAÇO ESTAVA DO LADO ERRADO, e só a medição pela rota real mostrou.** A 1ª versão chamava `sugerirVinculos` uma vez por **PAR** (conta × linha), e **cada chamada reconhece o fornecedor contra os 78 nomes cadastrados**: 110 contas × ~1.300 linhas × 78 nomes de Jaro-Winkler. Numa rota que o **badge do menu consulta a cada 60 s**. A cura é o laço **por LINHA do extrato**, com uma **peneira barata de valor/data/direção ANTES de qualquer texto** — o `scoreMatch` já descarta valor fora de ±5%, então comparar dois números evita quase todo o trabalho caro, e o reconhecimento passa a rodar uma vez por linha (só nas que têm conta compatível). ⭐ **A prova de que a inversão não mudou comportamento é o resultado idêntico ao centavo:** os mesmos 2 pares, os mesmos scores 80/70, as mesmas frases.

**PROVADO EM PROD (`Xl4gM4FQ7k3E1q8SCci7P`):** `/api/conciliacao/fila` **200 em 242 ms** · `/api/dashboard/badges` diz **2** e a fila diz **2** — badge e tela pelo mesmo número, que é o ponto.

### ⛔⛔⛔ O CABEÇALHO CONTRADIZIA AS ABAS — a terceira derivação velha (07/09)

**O dono, olhando a tela nova:** *"Ele diz '69 prováveis duplicatas somando R$ 845.646,99' e a aba Possíveis duplicatas diz 0. (…) Se é conta de outra época da tela, ela está afirmando um número que ninguém consegue defender."*

**⛔ 1. AS "69 DUPLICATAS" ERAM A FAMÍLIA DOS 84 FANTASMAS.** A régua de trás (`/api/conciliacao/balance-check`) era um **JOIN por valor + ±5 dias SEM olhar o nome**. Medida, ela chamava de duplicata *"BIG GELO R$ 80,00"* × *"Mauricio Ramos Berro - Pix"* e *"chat gpt R$ 100,00 (06/07)"* × *"COOPERATIVA DE PAIS E MESTRES (01/07)"*. ⚠️⚠️ **E o dinheiro estava errado SOB A PRÓPRIA RÉGUA:** `COUNT(DISTINCT e.id)` com `SUM(e.amount)` **sobre as linhas do JOIN** — toda conta que casava com mais de uma linha entrava no dinheiro mais de uma vez. **R$ 845.646,99 no lugar de R$ 444.746,99**, medido. Número inflado por aritmética, não por régua.

**⛔ 2. NENHUM DOS DOIS "SALDOS" ERA SALDO.** *"Saldo do extrato R$ 33.046,25"* era **Σ(CREDIT−DEBIT) de TODA tx OFX já importada** — ignora saldo inicial e ignora o que o banco declarou. *"Saldo no sistema −R$ 128.404,22"* era a régua da **DRE realizada**, e **325 daquelas linhas nem têm conta bancária** (R$ 61.812,00): elas não podem bater com extrato nenhum, por construção. A soma dos cards das contas é **−R$ 74.190,46** — nem um nem outro. Daí o *"R$ 161.450,47 a conciliar pra bater"*: a diferença entre duas somas que não são saldos.

**⭐ A RÉGUA HONESTA JÁ EXISTIA NO MODELO:** `balance` (o saldo que o sistema calcula — **o MESMO número do card da conta**, que é contra o que o dono confere) contra `ledgerBal` (**o que o banco DECLAROU** no último extrato), com `ledgerBalDate` dizendo **de quando**, e **POR CONTA** — foi o agregado que produzia o indefensável. Em prod: sicredi e stone batem ao centavo, **banrisul tem R$ 1.700,00 de diferença desde 04/09** (número que dá pra defender e pra agir). ⛔ **Conta sem extrato importado fica FORA da conferência e NOMEADA** ("banco caixa", "caixa loja/cofre"): sem declaração do banco não existe conferência, e dizer "bate" seria **inventar o outro lado** — que é literalmente o defeito. É o teste que morde em `conferencia-de-saldos.test.ts`.

**A REGRA QUE FICA (do dono):** *"O que dá pra derivar da MESMA fonte das abas, deriva; o que não tem definição honesta, sai do cabeçalho — **número sem régua em tela de dinheiro é pior que ausência**."* Sobraram: vínculos e dupla contagem saindo do MESMO `totais` das abas (somando a **lista**, cada conta **uma vez** — a aritmética que o JOIN errava), contas sem par, e a conferência por conta. **`statement-balance-header`, `balance-banner` e a rota `/balance-check` foram APAGADOS** — deixar a rota viva é deixar a segunda resposta viva.

### ⛔⛔ O BLOQUEIO +24h É **EXPLICADO**, NÃO ALARME — e a régua é a FICHA (08/09)

**O dono, olhando a conferência por conta:** *"O ⚠ do Banrisul é o BLOQUEIO +24h — a mania nº 1, que a ficha do banco já conhece (`ledgerBalReliable` false). **Alarme âmbar em diferença esperada e explicável vira ruído.** (…) **Pela ficha, não por if do Banrisul.**"*

**MEDIDO EM PROD:** a diferença de **R$ 1.700,00 é EXATAMENTE o `blockedAmount`** que o documento declarou — `diferença − bloqueio = 0`. É o **mesmo R$ 1.700 de 01/09** que o `destaque-do-card` já documenta como fantasma. E a ficha da **CAIXA também é `false`**: já hoje a régua vale pra mais de um banco, o que sozinho condena um `if (Banrisul)`.

**TRÊS ESTADOS NO LUGAR DE DOIS:** `BATE` (✓ verde) · `EXPLICADO` (cinza, *"diferença = bloqueio +24h declarado (R$ 1.700,00 em 05/09)"*) · `DIVERGE` (⚠ âmbar). **Só o `DIVERGE` conta como pendência**, e o contador do topo soma BATE+EXPLICADO.

**⛔⛔ E O PASSE LIVRE NÃO EXISTE — é a metade que segura a regra.** A ficha explica **por que a comparação não fecha**; ela **não explica qualquer número**. Sem `blockedAmount` medido, ou com um valor que não fecha ao centavo, **o ⚠ continua** — com a frase que ensina a saída (*"a conferência de lá é dia a dia contra o PDF"*). Dar EXPLICADO ali seria **inventar o bloqueio de hoje a partir da mania de ontem**, e o bloqueio muda todo dia. Três testes travam isso: sem a ficha volta a ⚠; com bloqueio que não fecha continua ⚠; sem bloqueio medido continua ⚠.

**⭐ E A DATA É A DO BLOQUEIO, NÃO A DO SALDO:** o saldo é de 04/09 e o bloqueio de 05/09. Datar pelo saldo faria um número velho passar por atual — a mesma disciplina do card.

⚠️ A resolução usa `podeConferirPorLedgerbal(resolveBankProfile(bankCode))`, a **mesma função** do card da conta e do import. Ler `ledgerBalReliable` na mão aqui **reprovaria no guard estrutural** (`ledgerbal-um-dono-so.test.ts`) — e com razão: a pergunta tem um dono só.

**PROVADO EM PROD (`N93m7UKoPUqJQUaoPseox`):** `batem 2 · explicadas 1 · divergem 0` — a linha do banrisul agora é cinza com a frase, e **nada na tela pede ação que não exista**.

### ⭐⭐ A LISTA DAS 109 SAI DA TELA — a fila é só o que pede DECISÃO (08/09)

**Decisão do dono:** *"Conta em aberto sem par no extrato é o **estado NORMAL** de uma conta que ainda não foi paga — não é pendência de conciliação. (…) A conciliação trabalha **DAQUI PRA FRENTE**: nota nova → payable → extrato novo → par sugerido → vínculo. Se alguma antiga aparecer casando sozinha quando um extrato entrar, ótimo — **mas ninguém sai procurando**."*

**⛔ A LISTA SAIU DO PAYLOAD, não só da tela.** `filaDeConciliacao` devolve **só as contas com par sugerido**. Não é economia de bytes: é a regra virando **impossibilidade**. Sem a lista no JSON, nenhuma tela futura ressuscita a parede de texto por descuido.

**⛔⛔ E O NÚMERO CRU SERIA O BADGE QUE TODO MUNDO IGNORA — por isso ele vai QUEBRADO.** O dono perguntou por que subiu de 108 pra 109 *"se o número só cresce e ninguém vai tratar"*. Medido: as 109 se explicam inteiras.
- **67 ainda não venceram** (uma tem parcela pra **novembro**) — estado normal.
- **34 venceram DEPOIS do último extrato importado.** ⚠️ Esta é a categoria mais fácil de esquecer e a que mais importa: o último extrato era de **04/09** e já era **08/09**. **Elas esperam ARQUIVO, não decisão** — cobrar ação delas é cobrar o impossível.
- **8** venceram dentro de um período que já tem extrato: as únicas que podem ser lacuna real.

**⭐ E O CRESCIMENTO É TRABALHO NOVO, NÃO ACÚMULO:** medidas **23 contas entrando em 48h** (aluguel, INSS, ICMS, FGTS, fornecedores — o dono lançando o mês). O que segura o número é o fluxo natural, exatamente como ele previu.

**⭐ A RESPOSTA À PERGUNTA DO GESTO "RESOLVIDA FORA DO EXTRATO": NENHUMA, hoje.** O extrato mais antigo importado é de **25/05/2026** e **zero** contas da fila vencem antes disso — todas as 42 vencidas são de **setembro**. Não há caso, então não se constrói o gesto. **Mecanismo sem caso é peso morto**, e o dono pediu o número justamente pra decidir isso com dado.

**⚠️⚠️ A DUPLA CONTAGEM FICA NA TELA MESMO SEM PAR SUGERIDO — e é a exceção que prova a regra.** Ela **não** é "conta em aberto sem pagamento": é conta marcada como **PAGA** e sem vínculo, ou seja **o mesmo dinheiro em duas linhas**. Isso é **anomalia, não espera**. Se ela saísse junto com as outras, **não sobraria lugar nenhum onde aparecesse** — e o teste que morde é justamente esse (`resumirSemPar` a exclui do resumo).

**PROVADO EM PROD (`ep_lZszAOzVWOjsa5x7-3`):** `contas no payload: 0` · `semPar: {total 109, naoVenceram 67, aguardandoExtrato 34, comExtratoImportado 8, ultimoExtrato 04/09}`.

### ⛔⛔ E A NOTA ERRADA FOI VINCULADA — o desenho ajudou (08/09)

As **duas** notas do Cancian (NF 834771 venc 29/08 e NF **835271** venc 05/09), R$ 230,81 cada, disputavam o **mesmo** débito de R$ 232,81. Os dois cards ficavam quase idênticos — **mesma linha à esquerda, mesmo valor à direita** — e o que os separa (**número da NF e vencimento**) estava em texto pequeno, com os dois em "provável". Resultado medido no audit: `mode CLASSIC`, a **835271** foi conciliada às 00:00:34 de 08/09, e a 834771 seguiu em dupla contagem.

⛔ **A cura NÃO é esconder um dos cards** — esconder seria a régua decidindo qual nota foi paga, que é o oposto da disciplina. São duas outras coisas: **(1)** o card avisa **antes do par**, com borda âmbar, que *"N notas disputam este mesmo débito — só uma pode ser"*, e o **número da NF** e o **vencimento** ganham peso tipográfico, porque são o que decide; **(2)** vincular um par **tira aquela linha do extrato dos outros cards na hora** — ela foi **gasta**. O servidor já não a devolveria no próximo carregamento; **era a tela que mentia até o F5**, e o card concorrente seguia clicável.

**⭐ RESOLVIDO PELO DONO NA TELA, e o rastro conta a história inteira:** ele desfez o vínculo errado (01:39) e vinculou o certo (01:41). A **NF 834771** ficou `EFFECTED/RECONCILED` apontando pra linha de 232,81, com a nota *"pagamento conciliado com a linha do extrato de 2026-08-31 (R$ 232.81) · diferença de R$ 2.00 = juros/tarifa de boleto, confirmada por quem conciliou"*; a **NF 835271** voltou a `PAYABLE/PENDING`, sem vínculo, como ele mandou. **As 8 ex-payables fecham 8/8 e a dupla contagem foi a zero.**

## ⭐⭐⭐ CONFIRMAR O IMPORT **JÁ BAIXA** — O GESTO ÚNICO DA VENDA (07/09/2026)

**O DONO RELATOU UM BUG E A MEDIÇÃO ACHOU OUTRA COISA — vale registrar que o servidor estava certo.** *"Importei os complementos de 06/09 …, cliquei BAIXAR no dia, e NADA baixou: porção de calabresa segue 597 UN."* Medido pelo caminho real, com sessão assinada: o motor monta o plano de 06/09 **perfeito** (31 nomes com destino, 335 de 736 ocorrências, CALABRESA 112 → a ficha certa), e o **endpoint responde 200** no preview e no confirmar. Nenhum erro no log do minuto. ⛔ **O que faltava era o SEGUNDO CLIQUE** — "baixar" abria o preview, e confirmar era outro gesto, em outro lugar da tela, sem cara de continuação do primeiro.

**⭐⭐ A REGRA NOVA, DECISÃO DO DONO:** *"O botão 'baixar' separado é estado intermediário que só serve pra ser esquecido — provou isso a semana inteira (dias 02–04 importados e nunca baixados)."* **CONFIRMAR IMPORT (produtos ou complementos) = importa E BAIXA na mesma ação.** O preview do import passa a mostrar **também o resumo da baixa** antes do confirmar: um preview, um clique, tudo. O botão "baixar" separado **sumiu**; a lista de dias mostra **estado** (baixado / precisa reprocessar / não baixar — decisão), não uma tarefa pendente.

**⛔⛔ É O PADRÃO "COMMIT + PONTE" DO RECEBIMENTO, e a ordem importa:** as linhas gravam na `$transaction`, ela **commita**, e só então a baixa roda (`baixarSeHouverFicha`). Se a ponte falhar, o import **NÃO desfaz** — avisa (`avisoBaixa` / `baixaFalhou`) e o dia fica visível como pendente. ⚠️ Enfiar a baixa dentro da mesma transação faria um erro de ficha **apagar o import inteiro**, e o dono perderia os 113 nomes da prateleira por causa de um destino faltando.
- **sem ficha/destino → não baixa** (entra na prateleira, como hoje) e mapear depois acende o `precisaReprocessar` do dia — o mecanismo que já existe cobre.
- **PERÍODO continua nunca baixando** — a trava velha sobreviveu à mudança, e tem teste próprio dizendo isso.
- **reprocessar (estorna-e-refaz) continua gesto próprio**, com preview: mexer no ledger sozinho a partir de um import é o oposto da disciplina do módulo.
- ⚠️ **`lib/stock/vendas/identidade-import-complemento.ts` (novo)**: `importIdDe` / `ehLinhaDePeriodo` saíram do import porque agora o import chama a baixa **e** a baixa lê o `importId` — sem a extração, ciclo.

**⚠️ UMA DECISÃO QUE EU MARQUEI EM VEZ DE ESCOLHER SOZINHO:** o dono pediu *"reimport de dia baixado → precisa reprocessar"*. Com o gesto único o reimport **se auto-corrige** (estorna e refaz no confirmar, com o preview avisando *"este dia já foi baixado — confirmar estorna e refaz"*), então `precisaReprocessar` ficou reservado ao caso de **mapeamento**, que é o que ele mesmo nomeou no bullet seguinte. Se ele preferir a marca também no reimport, é uma linha.

**PROVADO EM PROD (07/09, read-only pelas MESMAS funções da tela):** os **quatro** dias baixaram — 06/09 (−118 calabresa), 04/09 (−106), 03/09 (−80), 02/09 (−64), todos por Yussef às 01:28-01:29, **20 minutos depois do deploy `63648f4`**. A porção de calabresa foi de **597 → 229 UN**, e 597−(118+106+80+64) = **229 à unidade**. Nenhum dia em `PENDENTE` nem em `PRECISA REPROCESSAR`. 8.695 verdes · TS 0 · deploy 4/4 (`v5wOOPP9ZRL0XamtDegIq`).

⚠️ **`baixado` GANHA DE `dispensado` NO RÓTULO** (02 e 03/09 estavam dispensados e o dono baixou assim mesmo): a ordem da tela é **período → reprocessar → baixado → dispensado → pendente**. Script de diagnóstico que ordene diferente **inventa um segundo rótulo pro mesmo dia** — a lição do B1 vale pro script também, não só pra tela.

## ⛔⛔⛔ A ETAPA ABERTA: DO RÓTULO HONESTO AO GESTO DE RESOLVER (06-07/09/2026)

**A FRESTA, achada pelo dono em prod:** etapa iniciada com o PIN da Carlise (16:38) e ordem concluída pela **tela de Produção** (o caminho do encarregado, que ajusta o consumo e não passa pelo tablet). A etapa ficou **aberta 7h05 sem NENHUM gesto que a resolvesse** — o tablet recusa (ordem encerrada) e a Produção não tinha botão. E o "HOJE ao vivo" a contava no AGORA: *"Carlise · fazendo há 7h05"*, **o retrato do presente mentindo por causa de uma ordem que já acabou**.

⚠️ **A metade CERTA da regra antiga era não inventar tempo** (`concluir()` não tocava nas etapas, de propósito). A metade errada era deixar a etapa "em andamento" **para sempre**, sem nome e sem saída.

**⭐⭐ OS CINCO ESTADOS, UMA DERIVAÇÃO SÓ (`lib/stock/producao/estado-da-etapa.ts`):** `AGUARDANDO` · `EM_ANDAMENTO` (⛔ só ordem VIVA) · `FEITA` (tempo MEDIDO) · `FINALIZADA_PELO_GERENTE` (tempo A APURAR) · `ENCERRADA_SEM_FINALIZAR` (a ordem levou junto). **A tela da ordem, o "HOJE ao vivo" e o tablet leem a MESMA função e o MESMO rótulo** (`resolverEstadoDasEtapas`).
- ⛔⛔ **"Na fila" + ordem concluída deixou de existir POR CONSTRUÇÃO** — era a contradição do print, e nascia de haver **DUAS derivações** (a tela da ordem tinha a sua, o "HOJE" calculava a dele inline). **É a lição do B1 aplicada à etapa.**
- ⚠️ **`AGUARDA_ANTERIOR` deixou de ser ESTADO** e virou detalhe do aguardando: não é outra fila, é a **mesma fila com um motivo** — e como estado obrigava toda tela a conhecer um sexto caso.
- ⚠️ **O estado deriva da ORDEM, não do registro.** Os registros carregam o RASTRO; se a tela dependesse deles pra não mentir, toda linha antiga mentiria até o retroativo rodar.

**⭐⭐ OS DOIS GESTOS DO GERENTE** (`gestos-do-gerente.ts`, `stock.manage` — fechar tarefa de outra pessoa é decisão de gestão, não de operação). A diferença entre eles é a **QUALIDADE DO DADO**:
1. **PEDIR PRA FINALIZAR** — o preferido: recado no tablet dela; **ela** aperta com o PIN e o tempo é **DELA, medido**, entra na média. Pedir 2× é **reenviar** (unique por etapa), e o pedido fica marcado **ATENDIDO** quando ela finaliza — pedido não atendido é informação de gestão, não lixo.
2. **FINALIZAR PELO GERENTE** — quando ela foi embora: estado próprio, **tempo A APURAR**, rastro *"finalizada por X em nome de Y"* — ⛔ **nunca "entrar na conta dela"**.
3. E **concluir a ordem com etapa aberta** avisa antes (*"…será encerrada sem tempo medido — se ela terminou de verdade, peça pra finalizar no tablet primeiro"*) e encerra como `ENCERRADA_SEM_FINALIZAR`. **Não bloqueia:** escolha consciente, não efeito colateral.

**⛔⛔ E O `finalizadoEm` DA ETAPA CONTINUA NULL NO GESTO 2 — REGRA 5, e é a decisão que segura tudo.** Se o gesto carimbasse a coluna, o tempo entraria em TODA média **por construção** (o relatório calcula `fim − início`), e nenhuma lista de exceções seguraria isso pra sempre. Com a coluna nula, o erro é **impossível**, não improvável.

**⛔⛔ A TAREFA DO GERENTE CONTA COMO FEITA, MAS FICA FORA DA TAXA — os DOIS lados da divisão.** Somar as UNIDADES sem os MINUTOS faria a pessoa parecer **mais rápida** justamente onde ninguém cronometrou nada. ⚠️ E **o dia dela é o do INÍCIO**, não o do gesto: o gerente pode fechar três dias depois, e datar pelo gesto jogaria trabalho velho dentro do relatório de hoje.

**⚠️⚠️ REGRA 11 — UM GUARD MEU PASSAVA PELO MOTIVO ERRADO, de novo.** Com **só** a tarefa do gerente, `minutosMedidos` fica 0 e a taxa sai `null` de qualquer jeito: **repus o defeito e os 16 testes ficaram VERDES**. O teste que morde é o **MISTO** (uma tarefa medida + uma do gerente): **1,0 min/un contra 0,5 com o defeito — o dobro de velocidade**. E outro teste pegou que o **alarme de 4h seguia cobrando** o que o gerente já tinha resolvido.

**TABELAS CREATE-only** (o isolamento proíbe ALTER): `stock_etapa_encerrada` · `stock_etapa_pedido_finalizar` · `stock_etapa_finalizada_gerente` — as três com **unique por etapa**, então gravar o mesmo fato duas vezes é impossível, não "checado".

**RETROATIVO** (`scripts/encerrar-etapas-orfas.ts`, preview + `--apply`): grava o rastro com a **data da ORDEM**, nunca "agora", e **autor NULL** — quem encerrou naquele dia não está guardado em lugar nenhum, e inventar um nome é pior que a ausência.

**PROVADO EM PROD (07/09):** a ordem da calabresa mostra *"produção · Carlisle → ENCERRADA_SEM_FINALIZAR [ficou aberta — a ordem foi concluída pela Produção] · minutos: a apurar · finalizadoEm: null"*; no dia 06/09 o card dela diz **"0 fazendo · 0 na fila · 1 feita · 1 sem finalizar"** (nunca mais "na fila"); **AGORA zerado e alarme de 4h em 0**. 8.688 verdes · TS 0 · `pg_dump` antes das duas migrations.

⚠️ **TESTE INVERTIDO COM O MOTIVO ESCRITO** (não apagado): o guard do sprint anterior afirmava que a etapa "continua EM_ANDAMENTO" e chamava isso de rastro honesto. Não era honesto — era a fresta.

## ⭐⭐ AS DUAS TELAS DA PRODUÇÃO — "POR PESSOA" NO MOCK E "HOJE AO VIVO" (06/09/2026)

**FRENTE 1 — `/estoque/producao/pessoas`, construída sobre o mock aprovado do dono:** 3 destaques por faceta · cards ricos por pessoa (selo de rendimento em **% do esperado**, barra `min/un` vs média da equipe, sparkline semanal, tarefas que faz) · navegação **‹ mês ›** com período livre opt-in · CSV. As réguas de honestidade vêm **do servidor**, da MESMA lista que a tela desenha (REGRA 4) — calcular no cliente abriria a porta pra o card premiar quem a lista não mostra.

**⭐ `lib/stock/producao/por-tarefa-da-equipe.ts` (novo) — "quem é mais rápido em CADA tarefa".** A régua do dono: *"quem faz gessado mais rápido ≠ quem molda mais rápido"*. ⛔⛔ **E A TRAVA CENTRAL: uma pessoa só não é a mais rápida — é a única.** Coroar sem ninguém pra comparar é dar um prêmio que não foi disputado, e quem lê a tela não tem como saber. Empate **nomeia os dois**; a média mostrada é a **daquela tarefa**, nunca a geral. ⚠️ A sparkline é **bloco de 7 dias do início do período**, não semana de calendário — senão a 1ª barra sai menor por ter menos dias, não menos trabalho.

**FRENTE 2 — `/estoque/producao/hoje`, "HOJE ao vivo", ZERO evento novo** (`lib/stock/producao/dia-ao-vivo.ts`, só leitura): **AGORA** · **o dia de cada uma** · **linha do tempo**. Auto-refresh de **30s só no dia de hoje** (recarregar o passado é gastar requisição num dia que não muda). Atalho na Produção ao lado de "Por pessoa".
- ⛔ **o cronômetro é da TELA, o instante é do servidor** — e a **hora absoluta vai ao lado** ("começou 08:40"), porque relógio de aparelho pode estar torto.
- ⛔⛔ **nenhum vermelho de atraso** (decisão do dono): não existe hora prometida por tarefa. O único alarme é o das **4h**, que tem causa real. *"Depois do gessado"* é **sequência da receita**, cinza, neutro.
- ⭐ **quem não tem tarefa APARECE** ("nada designado hoje") — é o momento de designar; **some quem está INATIVO, não quem está livre**.
- ⛔ dia passado **não tem "agora"**; ordem CANCELADA fica fora dos três blocos, a mesma régua do relatório.

**⚠️⚠️ DOIS DEFEITOS DE DESENHO MEUS, PEGOS PELO TESTE ANTES DA TELA:**
1. **a fila saía de `designadoEm`** — o gestor designa na SEXTA as tarefas do SÁBADO; a manhã de sábado apareceria **vazia**, justamente na hora em que a tela mais serve. Quem diz de que dia é o trabalho é a **`dataProducao` da ordem**.
2. **o lote fechado pendurava na última etapa da ordem** — com produção **PARCIAL** a mesma ordem tem várias conclusões, e todas cairiam na mesma linha, somadas. Agora pendura no **toque que gerou cada uma** (a etapa finalizada mais recente antes da conclusão).

**⛔⛔ E O FURO QUE SÓ O DADO REAL MOSTROU — TEMPO ZERO NÃO É VELOCIDADE INFINITA.** A medição em prod imprimia `beef · média 0 min/un` e `nadine · min/un 0`: o módulo guarda **MINUTOS**, e tarefa fechada em segundos arredonda pra 0. **"0 min/un" se lê como "a mais rápida de todas"** — número inventado com cara de medição, no card que existe justamente pra ser justo. Agora é **"a apurar"**, com o motivo na linha. ⚠️ **E num segundo grau:** a **média da equipe** contava as unidades do trabalho não cronometrado no denominador sem nada no numerador — isso a puxava pra baixo e **endurecia a régua de todo mundo**; passou a somar só o que foi medido. O **volume continua contado** — o que não dá pra medir é a velocidade, não a produção.

**⚠️ O GUARD ESTRUTURAL DE ROTAS MORDEU A ROTA NOVA** (GET pedindo `stock.manage`) e exigiu o motivo escrito. **Nomeada em `LEITURA_SENSIVEL`, não afrouxada** — as duas telas mostram o ritmo de cada um lado a lado, e isso é conversa de gestão; a janela do tablet segue mostrando só as tarefas de quem está com o PIN.

**REGRA 11 medida — 7 defeitos repostos, 7 vermelhos:** cancelada de volta nos três blocos · fila por `designadoEm` · dia em UTC · trava de "uma pessoa só" · "a apurar" virando 100% · empate desempatando no escuro · tempo zero valendo como velocidade. **8.652 verdes · TS 0.** Deploys `f3f4e7f` e `bf6e300`, os dois 4/4.

**PROVADO EM PROD (read-only, REGRA 8b):** "Mais produziu" mostrou **Carlisle e nadine** (empate, os dois) e as outras duas facetas disseram *"ainda apurando: pelo menos 3 tarefas"* em vez de coroar com 1 lote; "HOJE ao vivo" trouxe **Carlisle fazendo**, 10 eventos com o lote (6 UN) pendurado no "finalizou" da nadine, e o **rodrigo com "nada designado hoje"**. **PENDENTE (REGRA 2):** o dono validar as duas telas no navegador.

## ⛔⛔⛔ TRÊS DIAS DE COMPLEMENTO PARADOS — E O JUIZ NÃO TINHA COMO SABER (05/09/2026)

**O dono relatou "a baixa não desconta". O motor estava 100% certo; o que faltava era o gesto — e o alarme que teria contado.**

**MEDIDO, tudo por ID (REGRA 8):**
- **`0` movimentos com `receiptId` começando em `comp-`** — a baixa de complemento **nunca rodou**, em dia nenhum.
- o mapa está certo: `"CALABRESA"` (e as 3 grafias) → ficha `cmtkwy7pl…`, SABOR, 1 componente → **`cmti20jp8000n8cepfzcieo5z`** ("porcao de calabresa 120 grama" — a INTERMEDIARIO, não a crua `cmthu8f1…` de KG).
- o **plano do dia 04/09, montado pelo caminho real**, está correto: **103 ocorrências → 103 UN da porção** (+3 da acebolada), 4 itens agregados, 27 com destino, 60 pendentes.
- a porção só tem **entradas**: `+70 · +106 · +72 · −9 (contagem) · +105`. **Nada nunca a consumiu** — por isso o saldo só sobe.

**⛔ A CAUSA DE FUNDO É DE DESENHO, E É MINHA:** as duas metades do trabalho de complemento moram em **telas diferentes** — a **prateleira/mapeamento** em `/estoque/cardapio` (onde ele trabalha) e o **import + baixa** em `/estoque/vendas`, aba vizinha à baixa de **produtos**, que tem **o mesmo rótulo** ("Confirmar a baixa") e responde "pronto". A baixa de produtos de 04/09 rodou e gravou 10 movimentos (PAO DE XIS, beef, caixas, **porçao queijo −271**); **nenhuma porção de SABOR** entre eles — o que bate com o dono ter deixado em branco o *"CALABRESA aparecia?"*.

### ⭐⭐ V2 — O INVARIANTE QUE FALTAVA EXISTIR

*"importado e NUNCA baixou o estoque há > 24h"*, pros **dois** relatórios. Três dias ficaram parados com **mapa certo, ficha certa, plano certo e zero movimento**, e nada avisou. ⚠️ 24h porque **importar e baixar no mesmo minuto não é pendência**; e **PERÍODO nunca avisa** — ele existe pra montar a lista de sabores, não pra baixar.

### ⭐⭐ "NÃO BAIXAR — DECISÃO" (o estado que protege o alarme)

**Decisão do dono: as baixas começam de 04/09 pra frente** — em 02 e 03/09 a produção não estava montada e baixar ali só criaria negativo sem significado. É a mesma disciplina do **"AGOSTO É O PISO"**.

**⛔⛔ O V2 JÁ NASCEU RESPEITANDO A DISPENSA.** Sem isso ele gritaria **para sempre** sobre dias pulados de propósito — **alarme falso repetido mata o alarme** (os 111 falsos do juiz de vendas). Um invariante que nasce ruidoso é pior que invariante nenhum.

- tabela CREATE-only com **índice único PARCIAL**: dispensar duas vezes é **impossível por construção**, não "checado".
- **reversível, com autor e motivo**; reverter **não apaga** — carimba `revertidoEm`, e o rastro vale nos dois sentidos (o desenho da recusa de nota).
- ⚠️ **dia JÁ baixado não se dispensa**: ali a saída é **estornar**, que é outro gesto com outro nome.
- a régua é **uma função** que a tela, o aviso e o juiz leem — em vez de um `where` copiado em três lugares, que é como um deles fica pra trás.

**EM PROD:** V2 acusou os dois dias com a frase que **ensina a saída**; dispensados 02 e 03/09 → **juiz calou**; a tela mostra `NÃO BAIXAR — DECISÃO` com o rastro. **04/09 segue como pendência**, que é o certo — é o dia que o dono vai baixar.

**⚠️ MEDIDO E REPORTADO:** os **PRODUTOS de 02, 03 e 04/09 já estão TODOS baixados** — só os complementos estavam parados. Fica a assimetria daqueles dois dias (o produto saiu, o sabor não), registrada por decisão do dono.

**⚠️ ACHADO NO CAMINHO (cadastro, decisão dele):** a conta `yussefmusa5522@gmail.com` tem `name = "nura abu zahry musa"` — **todo rastro que o dono deixar sai com esse nome**. Não renomeei conta de usuário por conta própria.

11 testes, red-then-green nos dois (V2 ignorando a dispensa → 2 vermelhos; sem o V2 → 3). 8.445 verdes.

## ⭐⭐⭐ A NOTA É FATO, A ENTRADA É COMBINADO — CORRIGIR A UNIDADE ERRADA (05/09/2026)

**CASO REAL (ALAN SALBEGO, nota de 05/09):**

```
cProd 12457 · "LEITE EM PO INTEGRAL AURORA 400G" · 12 KG × 15,99 = 191,88 · trib 12 UN
```

São **12 latas de 400 g**, não 12 quilos. O fornecedor digitou a unidade errada — **e a própria nota se contradiz**: `uCom = KG`, **`uTrib = UN`**. Essa contradição é o sinal, e ele é **medido**, não chutado.

**⛔⛔ A NOTA FICA COMO VEIO** (12 KG, assinada pela SEFAZ). O que se corrige é a **ENTRADA**, com rastro em tabela própria (`stock_unidade_corrigida`, CREATE-only): *"a nota dizia 12 KG; entrada conferida como 12 UN, por Yussef"*. É a mesma regra do combinado × duplicata e dos itens digitados do DANFE — **documento fiscal não se reescreve**.

⚠️ **Tabela nova, não coluna**: migration de estoque é CREATE-only — e é o certo por conteúdo também, porque **correção tem autor e data**. Com CHECK `unidadeNota <> unidadeEntrada`: *correção que não corrige nada não existe*.

**⭐ O CUSTO: o denominador muda, o valor da nota nunca.** R$ 191,88 ÷ 12 latas = **R$ 15,99 por LATA**. Se um dia vierem 24 latas nos mesmos "12 KG", o mesmo total vira R$ 7,995 — em **precisão cheia**, senão o CHECK do ledger recusa a linha.

**⭐ APRENDE COM A CORREÇÃO, e SUGERE:** a próxima nota do mesmo (fornecedor, cProd) diz *"da última vez você conferiu como UN — conferir igual?"*. **Sugere, não decide** — um dia pode vir a granel de verdade, e casar sozinho seria a classe do "casar por semelhança" que o módulo recusa em toda parte.

**⛔⛔ O GUARD DO FATOR INTACTO** (item 4 do dono): identidade só entre unidades **iguais**; entre diferentes, **fator conhecido**. `KG → UN` com fator 1 é **recusado no confirm**, sem meia-gravação — *assumir 1 aqui transformaria KG em UN sem ninguém decidir*.

**⚠️⚠️ E A PROVA EM PROD PEGOU UM BURACO QUE O CÓDIGO ESCONDIA:** a unidade sugerida pro **item NOVO** vinha do `uCom`. No caso do leite o item **nasceria em KG**, seguindo a nota errada — entrada e item seriam ambos KG, **a correção nunca dispararia, e o conserto ficaria inútil justamente no caso que o motivou**. Agora `sugerirUnidade(uCom, uTrib)` faz a **tributária mandar quando as duas divergem**: é o campo que o fornecedor não escolhe à toa (vai pro fisco). Provado em prod: *"item novo sugerido em: UN"*.

12 testes, red-then-green nos três pedaços (sem a unidade de entrada 3 vermelhos · sem o guard 2 · sem o aprendizado 2). 8.430 verdes.

## ⭐⭐ O NÚMERO GRANDE DO CARD É O SALDO DEVEDOR — SÓ APRESENTAÇÃO (05/09/2026)

**Decisão do dono:** *"é esse que eu comparo todo dia; sistema mostrando outro número em destaque parece errado mesmo estando certo."*

```
banrisul   [DEVEDOR] −8.347,67  em 04/09
           R$ 1.700,00 bloqueado (+24h) em 05/09 · contábil −R$ 6.647,67 · conferido 26/26 dias
sicredi    [CONTABIL] −49.956,90        stone [CONTABIL] 636,63
Saldo Total (contábil, inalterado): −56.556,37
```

**⭐ A REGRA É DA FICHA DO BANCO, NUNCA UM `if (Banrisul)`** — vale pra qualquer conta cujo declarado embuta bloqueio (`ledgerBalReliable: false`). O dia em que o banco consertar o LEDGERBAL, **o card acerta sozinho**; o dia em que outro banco tiver a mania, acerta também.

**⚠️ O DEVEDOR VAI DATADO** (*"saldo devedor em 04/09"*): ele é do último documento importado, não de hoje — sem a data, um número velho passa por atual. E **sem bloqueio medido não se inventa um**: ele muda todo dia e só vale no instante do documento.

**⛔⛔ A FRONTEIRA — só apresentação, e está TRAVADA POR TESTE:**
- **ledger, conferência diária, selo e âncora seguem no CONTÁBIL** — é ele que fecha ao centavo (26/26). *O devedor dança com o bloqueio sem lançamento nenhum*, então nunca pode virar régua (foi o fantasma de R$ 1.700 de 01/09).
- **Saldo Total e Fluxo de Caixa continuam somando `balance`**, com **guard estrutural + auto-teste**: alguém "uniformizar" e somar o destaque faria o total **dançar com o bloqueio de cada banco** — R$ 1.700 a menos sem nada ter acontecido.

Red-then-green nos dois sentidos: destaque de volta no contábil → 4 vermelhos; total somando o devedor → o guard morde. 8.417 verdes.

## ⭐⭐⭐ OS R$ 776,53 DE AGOSTO ERAM **UMA LINHA**: O JUROS DO MÊS (05/09/2026)

**O PDF de agosto atualizado achou, e é uma só:**

```
31/08   JUROS   000000   776,53-
```

É o **juros da conta garantida**, que o próprio extrato avisa em letras garrafais: *"OS JUROS DE SUA CONTA CORRENTE SERÃO DEBITADOS NO ÚLTIMO DIA ÚTIL DO MÊS"*. O banco o postou **depois** do PDF de 01/09 (emitido 13:55) e **nunca o re-publicou em OFX** — por isso não estava em nenhum dos 32 blobs guardados. Só o PDF do mês o mostra.

**A CONFERÊNCIA FECHOU TUDO:** `156 casadas · 1 acrescentada · 0 órfãs` · **24/25 → 25/25 dias**; depois de gravar a régua de agosto inteira, **26/26 dias fecham, de 31/07 a 04/09**.

**⭐⭐ E A PROVA MAIS BONITA É O SALDO:** −5.871,14 − 776,53 = **−6.647,67** = **exatamente o "SALDO NA DATA" de 04/09 do banco**. A conta passou a bater ao centavo com o contábil declarado.

**⚠️ IMPACTO NO DRE DE AGOSTO: +R$ 776,53 de despesa financeira.** Agosto é o marco de referência do dono — e é justamente por isso que a linha entra: **o fechamento de agosto só volta a ser verdade COM ela**. Sem a linha, o mês fechava contra um extrato que o banco já tinha mudado.

A linha entrou **`PENDING`, sem categoria** (categoria é decisão do dono) — e a fila já sugere **"Juros e Encargos" [ALTA, via regra]**, porque o seed dos encargos de ontem cobre o `JUROS` EXACT do Banrisul. `pg_dump pre-juros-agosto-20260905-023014` antes.

**⭐ E O MÉTODO SE PAGOU:** o localizador roda o **mesmo motor do import** e **abortaria** se o período não fechasse depois da linha. Fechou — então a lista estava completa, e isso é uma afirmação medida, não uma esperança.

## ⛔⛔ CONFERIR NÃO DEPENDE DE TER LINHA NOVA — A FAIXA DO PDF SUMIA COM "0 NOVAS" (05/09/2026)

**O dono subiu um OFX já importado só pra CONFERIR com o PDF — e a faixa de anexar não existia**, nem a conferência rodava. O selo estava **dentro do ramo V2**; o preview tem **três saídas** (legado · re-import vazio · V2) e ele caiu na do meio.

**⚠️ É A MESMA ANATOMIA DE 29/08 — e o guard daquele dia não pegou.** Lá o `avisoExportMesmoDia` saiu só no V2, virou guard, e o guard trava **o aviso**. O **selo nasceu depois** (04/09) e entrou no mesmo lugar errado, **sem entrar no guard**. *Guard que trava um campo não protege o campo do vizinho.* Agora selo e conferência são calculados **uma vez, fora dos ramos**, e o guard cobre os dois — inclusive que a conferência roda **uma vez só** (duas seriam duas verdades).

**📋 E O LOCALIZADOR DOS R$ 776,53 ESTÁ PRONTO** (`scripts/localizar-linhas-que-o-banco-acrescentou.ts`): com o PDF do mês, lista as linhas que o banco postou depois do fato usando **o MESMO motor do import** (`reconcileStatement`, com a fronteira de dia) — uma régua própria discordaria do sistema no 1º caso de borda. Prova que o período **fecha depois** delas e **ABORTA se não fechar** (lista incompleta espalharia o erro). Entram **sem categoria**.

**⚠️ VALIDADO CONTRA O PDF DE SETEMBRO (o que existe):** `20 lançamentos · 20 casadas · 0 acrescentadas · 4/4 dias fecham`. A ferramenta funciona ponta a ponta; **falta o PDF de AGOSTO**, que é o único documento em que os 776,53 aparecem — **conferido: os 32 blobs de OFX guardados não têm nada de agosto além do que já está no ledger**, porque o banco não re-publicou aquelas linhas em OFX.

## ⛔⛔⛔ A RÉGUA DO PDF NUNCA ERA GRAVADA · O ÚLTIMO DIA SUMIA · O BANCO REESCREVE O PASSADO (05/09/2026)

**Três achados numa investigação só, com o PDF real (`Extrato_20260905.pdf`, emitido 00:55).**

### 1. A cirurgia da data — o PDF elegeu o juiz e ele decidiu

As 2 `CAPITALIZACAO RG` estão no **bloco do dia 02** (`SALDO NA DATA 4.841,10-`). Movidas com preview e a trava do dono (*"os dias 01 e 02 têm que fechar depois"*): **1/3 → 3/3**. `pg_dump pre-mover-capitalizacao-20260905-015346`. **Só a data mudou** — valor, histórico e categoria intactos.

### 2. ⛔⛔ `gravarReguaDeclarada` TINHA ZERO CHAMADORES DE PRODUÇÃO

A régua (`bank_account_saldo_declarado`) foi escrita **uma única vez**, em **01/09 18:03**, por um script de sprint. O import com PDF **lia o documento, conferia em memória, mostrava na tela e jogava fora**.

**⚠️ E O DIAGNÓSTICO DO DONO PRECISAVA DE UM AJUSTE FINO:** ele supôs *"badge calculado no preview e nunca recalculado"*. O selo **é derivado na hora** — recalcula certinho. **Congelada estava a RÉGUA**, de um PDF emitido às **14:01 do dia 01/09**, ou seja **no meio do dia**, antes dos 3 encargos existirem. Por isso o badge dizia *"01/09 não fecha (R$ 1.741,70)"* — a soma exata deles. **O badge não estava velho; a régua estava.**

Agora o **confirm com PDF grava a régua** (fora da `$transaction`, fail-soft — PDF ilegível não desfaz import que já gravou).

### 3. ⛔⛔ O ÚLTIMO DIA DE TODO EXTRATO NUNCA FOI CONFERIDO

O Banrisul escreve `SALDO NA DATA` nos dias do meio e **`SALDO NA DATA.`** — com ponto — no **último**. O regex exigia espaço depois de `DATA`. **O dia mais recente, justamente o que o dono acabou de importar, sumia da régua em silêncio** — e o *"N/N dias fecham"* dizia N sobre N−1 dias reais.

### 4. ⭐⭐ O BANCO REESCREVE O FECHAMENTO DE UM MÊS JÁ FECHADO

PDF de 01/09: `SALDO ANT EM 31/08 = −7.353,66` (e agosto fechava 22/22). PDF de hoje: **−8.130,19**. São **R$ 776,53** que o Banrisul postou em agosto **depois do fato**.

**⛔ NÃO SE MEXE NO LEDGER NO CHUTE** (ordem do dono): a régua registra o que o banco diz hoje, e a tela **pede o extrato de AGOSTO** pra a conferência diária localizar as linhas.

**⭐ E O FURO NÃO CONTAMINA SETEMBRO** — a conferência já seguia do saldo do **BANCO** a cada dia (cada dia é uma equação independente), então o vermelho fica **localizado no intervalo em que aconteceu**. Era o desenho certo desde 01/09 e é o que faz esta notícia ser legível.

**⚠️ E A 1ª RODADA EM PROD INFLOU O AVISO — corrigido:** ela somou o 01/09 (−3.225,96 → −5.148,51) ao 31/08 e anunciou **R$ 2.699,08** de "reescrita". Mas a declaração anterior de 01/09 fora emitida **às 14:01 do próprio dia** — um **parcial**, não um fechamento. **Reescrita de verdade é o dia cuja declaração anterior foi emitida DEPOIS do fim daquele dia**; o dado (`emitidoEm`) já estava gravado. Sobra só o 31/08, com os 776,53 que o dono mediu. *Alarme inflado é alarme que se aprende a ignorar.*

**RESULTADO EM PROD:** **24/25 dias fecham**, cobertura **03/08 a 04/09**, **setembro 4/4 ✓** (01, 02, 03 e 04), e **um único vermelho: 31/08, R$ 776,53** — exatamente o que o dono validou à mão.

## ⛔⛔⛔ O FÓSSIL DO LEDGERBAL NO GATE DO CONFIRMAR — E A CLASSE FECHADA (05/09/2026)

**⚠️ E O IMPORT TINHA GRAVADO.** O dono leu *"Saldo não fechou com o banco — Calculado −R$ 5.871,14 vs LEDGERBAL −R$ 8.347,67. Revise a classificação"* e entendeu **recusa**. Conferido em prod: `status=SUCCESS · novas=14 · dup=6`, as 20 linhas de 01/09 em diante no ledger. Era **toast vermelho pós-gravação**. **O alarme falso custou um dia de import parado** — e alarme que mente sobre o que aconteceu é pior que alarme nenhum.

Os **R$ 2.476,53** de diferença são o **bloqueio de 24h**, a mania documentada desde 15/08. Não era classificação errada; era a comparação que **saiu do preview em 04/09 e continuou viva no confirm**.

**⛔⛔ SEGUNDA OCORRÊNCIA DA MESMA CLASSE NO MESMO PERFIL — e o conserto estava a 35 LINHAS.** No MESMO arquivo, o `ledgerBalMatched` consulta a ficha do banco **desde 01/09**; o `ledgerMismatch`, logo acima, não consultava. **Duas respostas pra mesma pergunta, calculadas em pontos diferentes** — foi assim que o fóssil sobreviveu a três correções.

**⭐ A CLASSE, não a instância (ordem do dono).** Havia **6 leituras** de `ledgerBalReliable` espalhadas, cada uma com o seu `?? true`: orquestrador ×2 · `resolve-import-statuses` · `selo-do-import` · `classify-for-import` · `judge`. Agora:

- **`podeConferirPorLedgerbal(ficha)`** é o dono da pergunta *"o saldo declarado deste banco serve de régua?"*.
- **`avaliarFechamentoDeSaldo`** devolve as **três** saídas de um cálculo só (`mismatch`, `ledgerBalMatched`, `avisoSemSelo`) — impossível uma consultar a ficha e a outra não.
- **Guard estrutural + auto-teste**: quem escrever `.ledgerBalReliable` num lugar novo fica vermelho e é mandado pra função. (Permitidos: o dono da pergunta, a ficha em si, e o juiz — que é PURO e recebe a resposta por parâmetro.)

**⭐⭐ A REGRA DO DONO:** *"recusar a gravação por causa de um número que a gente provou que mente é segurar meu dinheiro fora do sistema por fé num número errado."* No Banrisul o import **grava**, não compara, e a tela diz **NEUTRO**: *"Importado — sem selo de saldo: … anexe o PDF pra conferir dia a dia."* ⚠️ **Banco desconhecido continua comparando** — a ressalva do banco sem ficha é da TELA (`decidirSelo` diz que não vai afirmar nada), **travar gravação, não**.

**PROVADO EM PROD com os números reais:** `saldo −5.871,14 vs LEDGERBAL −8.347,67 → mismatch null · ledgerBalMatched null · aviso neutro`. E reimportar o mesmo arquivo agora: **20 já existem · 0 novas** — nada a refazer.

⚠️ **`ledgerBalMatched: null` NÃO é "não bateu"** — é *"não dá pra dizer por aqui"*. Quem diz, no Banrisul, é a conferência dia a dia contra o PDF.

12 testes novos (9 de comportamento + 3 do guard). Red-then-green nos dois: fóssil reposto → 2 vermelhos; cópia nova do `if` → o guard morde.

## ⛔⛔ A CONFERÊNCIA ACUSAVA O PRÓPRIO IMPORT · E O BANCO RE-DATA LINHA JÁ PUBLICADA (05/09/2026)

**Os dois refinamentos que o dono levantou estavam certos — e juntos explicam os R$ 1.146,02 ao centavo.**

```
dia 01/09 · arquivo de 04/09 diz:  7 linhas ·  +2.981,68
            nosso ledger tinha:    6 linhas ·  +4.127,70   →  +1.146,02

  faltavam no ledger (3 encargos, na lista "a importar" da MESMA tela)  −1.741,70
  sobravam no ledger (2 CAPITALIZACAO RG que o banco moveu pro dia 02)    +595,68
```
⭐ **Nenhuma das duas causas sozinha dá esse número.** As duas juntas dão.

### 1. A conferência lia só o ledger — e rodava no preview

`conferirComPdf` filtrava `lifecycle:'EFFECTED'`: **por construção, todo import acusava o que ele mesmo ia resolver.** Agora recebe `recon.missing` — **a MESMA lista que o confirm cria**, não uma recontagem (se viesse de outro cálculo, tela e gravação voltariam a divergir) — e o selo fala do **previsto**.

⚠️ **E os dois desfechos são frases distintas**, senão a correção troca um susto por outro: *"os dias fecham DEPOIS de confirmar — nada a corrigir"* × *"o dia 01/09 não fecha **nem depois** de confirmar: faltam R$ X"*. Só a segunda pede ação.

### 2. O banco muda a data de uma linha JÁ PUBLICADA

As 2 `CAPITALIZACAO RG` (FITID 590244/590245): **01/09** no 1º download, **02/09** nos três seguintes. A identidade da linha é `data|valor|memo` (o FITID não entra — o Banrisul renumera), então elas voltariam como novas: **R$ 595,68 duplicados**. Varredura dos **32 blobs**: só estas 2 mudaram de data de verdade (o `PACOTE SERVICOS` em 4 datas é FITID **reciclado por mês**, não deslocamento).

**Tier 1.5 do reconcile** (`fronteira-de-dia.ts`), estreito por exigência do dono: mesmo valor ao centavo · mesmo histórico **canônico** · exatamente 1 dia de diferença · ⭐ **e a linha SUMIU do dia original no arquivo novo**. A tela **sugere com nome** — *"o banco moveu X de 01/09 pra 02/09 entre dois downloads"* — em vez de casar em silêncio, porque quem decide a data é o dono.

**⛔⛔ A 4ª condição é a que protege o PIX de 7.000:** dois PIX iguais em dias vizinhos **de verdade** (os dois listados no arquivo) não podem virar um só — **perder lançamento é pior que duplicar, porque duplicata a gente vê.**

**⚠️⚠️ E O GUARD DESSE CASO NÃO MORDIA NA 1ª VERSÃO (REGRA 11, de novo):** com o ledger tendo UMA linha, ela casa exato no Tier 1 e **nunca chega na fronteira** — removi a condição 4 e os 11 testes ficaram **verdes**. O teste que ficou tem **sobra dos dois lados** (ledger com duas em 13/08, arquivo com uma em 13 e uma em 14), que é o único formato em que a condição 4 é executada.

**⚠️ E A AMBIGUIDADE É DE DIA, NÃO DE LINHA** — minha 1ª versão errou isso e **não casava o caso que a motivou**: duas linhas idênticas no mesmo dia vizinho são intercambiáveis (é o multiset do Tier 1); o que não se decide é candidata no dia anterior **e** no seguinte.

**PROVADO CONTRA O ARQUIVO REAL PARADO:** `já existem 6 · novas 14 · futuras 1 · órfãs 0` — **0 CAPITALIZACAO entrando de novo**, os dois deslocamentos nomeados na tela. (Antes: 17 novas, com os 595,68 dobrados.)

**📋 A DATA — decisão do dono, pendente do PDF:** *"a régua é o PDF; sem o PDF, não move nada."* `scripts/mover-data-por-fronteira.ts` está pronto: **recusa rodar sem `--pdf`**, mostra antes×depois pela MESMA conferência da tela, e **ABORTA se os dias 01 e 02 não fecharem depois** — se o movimento não faz os dois fecharem, a hipótese está errada e mover espalharia o erro.

## ⛔⛔⛔ OS TRÊS BURACOS DO IMPORT DO BANRISUL — E OS TRÊS ERAM DE CÓDIGO (04/09/2026)

**Os três faziam o dono retrabalhar A CADA import.** Medidos contra os blobs reais antes de eu tocar em qualquer coisa.

### 1. A caixa "LEDGERBAL ausente" mentia — e a hipótese do dono estava certa

**O arquivo TEM o saldo.** Nos 4 blobs de setembro o parser lê **−8.347,67 · −9.960,26 · −6.419,60 · −4.925,96**, e `<LEDGERBAL>` está nos quatro. **O parser não regrediu.**

⛔ **A causa é a família "N caminhos":** a rota, pra ESCONDER a caixa nos bancos em que o LEDGERBAL não é régua, mandava `available:false` — e no componente essa flag **já tinha dono e significado**: *"o extrato não trouxe saldo"*. **Uma flag, dois significados**, e quem renderiza escolheu o errado, afirmando na cara do dono o contrário do arquivo.

⭐ **Duas perguntas que nunca foram a mesma, agora separadas:** `available` = o ARQUIVO trouxe · `ehReguaNesteBanco` = a ficha do banco diz que serve de régua. Quem junta é `estadoDoBanner` (pura), e **os dois previews consomem o MESMO componente** — pôr a regra neles seria dois lugares decidindo, que foi como a mensagem errada nasceu. **No Banrisul a única mensagem sobre saldo é a faixa do PDF; "ausente" volta a significar uma coisa só, em qualquer banco.**

### 2. A regra quebrava a cada grafia — e o SINAL tinha que entrar junto

O ramo **CONTAINS casava por STRING CRUA**. As normalizações de 28/08 (que já colapsam `OP. CREDITO`/`OP.CREDITO`) valiam só pros ramos EXACT e NORMALIZED — e **todas as regras do Banrisul são CONTAINS**. Daí o **+5.252,06 em "escolha você" por UM espaço**, e a 2ª regra que o dono criou na mão com **0 aplicações**.

⭐ As três grafias reais (`OP. CREDITO C/GARANTIA` · `OP.CREDITO C/GARANTIA` · `OP CRED C GARANT`) viram **`OP CREDITO C GARANTIA`**.

⚠️⚠️ **E O CANÔNICO SOMA, NUNCA SUBSTITUI — medido ANTES de escrever:** a regra `"RECEBIMENTO PIX-PIX_CRE"` tem **851 aplicações** e casa por substring crua com `"RECEBIMENTO PIX-PIX_CRED  43098655000157 TUNA PAGAMENTOS LTDA"`. No canônico o catálogo expande `CRED → CREDITO`, o padrão vira `…PIX CRE` e **a regra de 851 aplicações pararia de morder**. Consertar o Banrisul quebrando o Sicredi, em silêncio, seria o pior desfecho — o raw fica.

⛔⛔ **E A RÉGUA DO SINAL ENTRA NO MESMO COMMIT, senão o conserto vira um bug maior:** só a canonização jogaria o **−3.700 "OP CRED C GARANT"** dentro de **Receita de Vendas**, porque o texto casa. A régua saiu **sem coluna nova**: o `dreGroup` da categoria da regra já diz o sinal esperado — receita só casa com CREDIT, despesa só com DEBIT, **grupo neutro passa** (transferência e aporte acontecem nos dois sentidos; travar ali seria alarme falso). Sinal contraditório **não classifica** e a linha ganha *"Confira no banco: … saiu como DÉBITO, e o histórico com esse nome sempre foi entrada"* no lugar do "escolha você" mudo.

⚠️ **O seed dos encargos usa a categoria que o DONO mais usou**, medida na história dele (IOF → Tarifas 6×2 · PACOTE SERVICOS → Tarifas 3×0 · JUROS → Juros e Encargos 1×0). **Não é o sistema escolhendo categoria: é o sistema repetindo a decisão dele.** O empate 1×1 do `TRANSF. ENCARGOS CTA UNICA` fica **marcado**, não resolvido no escuro.

⛔ **E padrão CURTO é EXACT, não CONTAINS** — um teste pegou antes de ir pra prod: enquanto o CONTAINS casar por substring crua (e tem que casar), **um `"IOF"` acha `"BIOFARMA"`**.

### 3. A inversão description × counterpartyName (anotada em 01/09, nunca tratada)

O banco manda `<NAME>PIX ENVIADO` + `<MEMO>CACULA MIX`. Gravava descrição "CACULA MIX" e contraparte "PIX ENVIADO" — **9 transações em prod estão assim**. A correção decide **pela FORMA** (histórico genérico é conjunto fechado), **nunca pela posição** — posição é justamente o que o banco alterna.

**⛔⛔ DOIS DEFEITOS MEUS QUE SÓ A PROVA EM PROD PEGOU** (rodar o pipeline real contra o arquivo do dono, em vez de acreditar no meu código):
- **regra EXACT gravada CRUA nunca casa:** o índice indexa `rule.padrao` cru e busca com `normalizeExact(descricao)` (minúsculo). Meu seed gravou `"IOF"` e `"JUROS"` em maiúscula → **duas regras mortas**. *Regra morta é pior que regra ausente: parece cobertura.*
- **espaço no fim do cadastro matava o sinal do PIX:** o nome da empresa está gravado como **`"caçula mix "`** e `normalizeForCompare` não aparava → `PIX ENVIADO` + `CACULA MIX` dava **0 sinais próprios**. É a **mesma cicatriz de 25/08** (a conta `'sicredi '`).

**RESULTADO NO ARQUIVO REAL QUE ESTAVA PARADO (21 linhas):** **16 com categoria · 1 transferência (aguarda o par) · 1 "confira" · 3 escolha você** — contra o que ele viu ontem. **23 testes** com fixture derivada do `Extrato_20260904.ofx`; red-then-green nos **seis** defeitos (caixa 1 · CONTAINS cru 2 · canônico sem sinal 1 · inversão 2 · EXACT crua 1 · espaço no cadastro 2). 8.367 verdes, TS 0.

**📋 ACHADO NO CAMINHO, NÃO PEDIDO — O BANRISUL ESTÁ 3 DIAS SEM IMPORTAR.** Os registros de 02, 03 e 04/09 são todos `status=PREVIEW`: **nenhum foi confirmado**. A última tx do Banrisul no sistema é de **01/09** ("ANTECIP STONE"), e o Sicredi e o Stone foram confirmados nesses mesmos dias. Ou seja: **ele abria o preview, batia nos três buracos e desistia** — exatamente o "retrabalho a cada import" que motivou este sprint. As 3 linhas de PREVIEW sem âncora não são regressão do gravador de âncora (preview não finaliza; `ledgerBalAmount` só é gravado no confirm).

## ⛔⛔⛔ A TELA ESCONDIA 63 DOS 85 FORNECEDORES — A DUPLICATA ERA SINTOMA (04/09/2026)

**O dono achou que tinha sido descuido dele.** Foi cadastrar uma nota manual da **RM2**, não achou no seletor, criou uma segunda — e ficou com duas. **Medido em prod antes de tocar em qualquer coisa: `stock_supplier` = 27 · `Supplier` (financeiro) = 85. Sessenta e três invisíveis.**

**A CAUSA:** o seletor lia **só a tabela do estoque**, que **só enche quando uma nota é CONFERIDA**. Fornecedor cadastrado à mão no financeiro (como a RM2, de 10/06) nunca aparecia. ⚠️ **E a busca era o SEGUNDO problema, não o primeiro** — o `<select>` nativo casa por prefixo e caixa, então "RM2" não achava "rm2"; mas **consertar só a busca deixaria o bug vivo com cara de resolvido**, porque nenhuma busca acha o que não está na lista.

**⛔⛔ OS GUARDS DA UNIFICAÇÃO SÃO DO DONO, e a regra de fundo é dele:** *"fusão errada de fornecedor é pior que duplicata visível"*. Duplicata se resolve com uma costura; fusão errada manda dinheiro pro CNPJ errado e ninguém percebe.

| situação | decisão |
|---|---|
| CNPJ igual (os dois têm) | **é o mesmo** |
| os DOIS com CNPJ **diferente** | **NUNCA une**, nem com nome idêntico (matriz × filial) |
| nenhum dos dois tem CNPJ | une **só** se o nome normalizado for **igual** |
| um tem, o outro não | **não une** — mostra os dois com a origem marcada |

**⭐ O `stock_supplier` NASCE NO GESTO DA ESCOLHA** (`garantirFornecedorDoEstoque`), na mesma transação da entrada, idempotente por CNPJ. ⚠️ **LÊ o `Supplier` do financeiro e nunca escreve nele** — a exceção desenhada ao isolamento continua sendo só a ponte de contas a pagar.

**⚠️⚠️ O NÚMERO DE PROD PEGOU UM BUG MEU QUE OS 12 TESTES NÃO PEGARAM:** a lista voltou **33 linhas com id de estoque contra 28 que existem**. Um registro do financeiro **já empilhado** virava alvo do próximo → dois cadastros do financeiro **se fundiam entre si**, um sumia da lista e o outro ainda dizia **"AMBOS"**, mentindo sobre existir no estoque. Fix: só casa com linha que **veio do estoque**. **A aritmética da lista foi o que denunciou** — os testes conferiam os casos, não a conta.

**PROVADO EM PROD:** tabelas 28 + 88 → **seletor com 90 linhas · 28 ids de estoque (o máximo possível) · 88 ids do financeiro distintos, nenhum perdido**. Busca: `r` → 69 (pega FRIGORIFICO, R no meio) · `rm2`, `fgts`, `informatica`, `girua` → todos achados.

**⛔ BUG 2 — O GESTO ÚNICO SE QUEBRAVA EM DOIS:** anexar o PDF do extrato fazia `setPreview(null)` e a tela **voltava pro começo**; o dono lia como "perdi o OFX" e subia tudo de novo. Agora o clique é de um **`<button type="button">` com `preventDefault`** (o `<label>` embrulhando input dentro de área clicável deixava o clique escapar) e o preview **recarrega inline** com o MESMO OFX + o PDF novo. ⚠️ **E o defeito seguinte era invisível:** reconferir lendo `pdfDaRegua` do **estado** pegaria o valor **anterior** ao `setState` — o preview voltaria sem régua e o selo nunca apareceria, com cara de "o arquivo não serviu". O arquivo vai por **parâmetro**, e a decisão mora em lib pura (`lib/ofx/regua-do-preview.ts`) — *regra que mora num `useState` é regra que ninguém prova*.

**18 testes novos · red-then-green medido nos três defeitos** (5 vermelhos no seletor, 1 na fusão financeiro×financeiro, 2 no PDF).

**⭐ COSTURA DA RM2 EXECUTADA (04/09, autorizada: *"CONFIRMO — mesma empresa"*).** `pg_dump pre-costura-rm2-20260904-225034` antes, preview antes do `--apply`. **1 transação movida** (08/09 · R$ 417,40 · PAYABLE/PENDING) pro cadastro original · 0 regras · 0 recorrências · o `rm2` do financeiro **desativado com o rastro nas `notes`** · o `stock_supplier` **renomeado** pro nome completo. **Conferido depois, medido:** o seletor mostra **1 linha, marcada AMBOS**, e a dívida está sob o cadastro certo.

**⚠️ E O DESATIVADO PRECISOU SAIR DO SELETOR NO MESMO GESTO:** `listarFornecedoresUnificados` não filtrava `isActive` — o `rm2` recém-costurado **continuaria sendo oferecido numa nota nova**, recriando a duplicata que a costura acabou de resolver.

**⚠️ O ESTOQUE NÃO TEM COLUNA DE "ATIVO"** (o isolamento proíbe ALTER) — lá a saída foi **renomear**, que é o que faz os dois lados se reconhecerem **pelo nome** enquanto não houver CNPJ. O snapshot `fornecedorNome` da entrada manual foi junto; a **descrição da transação** (*"rm2 — compra sem nota"*) **fica** — é o que o dono digitou naquele dia.

**⛔⛔ E A CAUSA DE FUNDO CONTINUA ABERTA, com o dono sabendo:** *"sem CNPJ essa dúvida volta a cada duplicata"*. **Ele está certo** — sem CNPJ a única régua é o NOME, e nome é justamente o que diverge. `scripts/preencher-cnpj-fornecedor.ts` preenche os **dois lados de uma vez** (valida o dígito verificador — **CNPJ errado é pior que campo vazio, porque PARECE prova e passa a unir quem não é o mesmo** — e aborta se o CNPJ já for de outro fornecedor, que aí é caso de costura, não de preenchimento). **PENDENTE: o dono trazer o CNPJ da RM2 na próxima nota.**

**📋 O PREVIEW QUE ANTECEDEU A COSTURA** (`scripts/preview-costura-rm2.ts`, read-only): o cadastro original **`RM2 COMERCIO DE MATERIAIS PARA INFORMATICA LTDA`** (10/06, `fonte=MANUAL`, **0 transações**) e o **`rm2`** nascido do gesto de ontem (`fonte=ESTOQUE_NF`) com **1 transação: 08/09 · R$ 417,40 · PAYABLE/PENDING · "rm2 — compra sem nota"**. **Nenhum dos dois tem CNPJ**, e os nomes normalizados **diferem** → o sistema não pode provar que são a mesma empresa e **não une sozinho**. A confirmação veio no mesmo dia.

## ⭐⭐ A LISTA MISTA MORREU E O "VOLTAR" APRENDEU DE ONDE VOCÊ VEIO (03/09/2026)

**O dono caiu na lista mista DEPOIS de salvar uma ficha de sabor** — e ia repetir esse gesto **~50 vezes** na mesma tarde. A causa, achada na leitura: `/estoque/fichas/nova` montava o editor **sem `voltarPara`**, então o destino caía no default `/estoque/fichas`. ⚠️ **A mesma porta atingia o `+ criar ficha` da tela de Vendas**; só o Cardápio escapava, porque lá o editor abre DENTRO da tela (`aoSalvar`), sem navegar.

**⭐ QUEM CHAMA É QUEM SABE:** o destino passou a vir **explícito** (`?voltar=`), nunca adivinhado pelo `tipo` — heurística erraria no dia em que uma quarta tela abrisse o editor, e erraria **em silêncio**. Duas peças pequenas junto: a aba do Cardápio aceita **`?aba=complementos`** (sem isso a volta cai na aba errada e a linha verde não aparece) e o destino externo é **recusado** (`//evil.com` é host pro browser — mesma trava do `redirect` do convite).

**⚠️ E OS RÓTULOS MENTIAM NOS TRÊS MUNDOS:** a página dizia sempre *"Nova ficha técnica"* e *"voltar pras fichas"*, inclusive criando SABOR pela prateleira. Agora acompanham a origem.

**⛔⛔ `/estoque/fichas` DEIXOU DE LISTAR.** A investigação de quem chegava lá deu quase ninguém: **não está na sidebar** (saiu em 27/08), e o único link humano era o breadcrumb de `/producao/cadastros` — o resto era **o próprio bug do `voltar`**. Como lista ela é **redundante** (Cardápio cobre PRODUTO_FINAL, Receitas cobre INTERMEDIARIO, a prateleira cobre SABOR).

**⛔ E NÃO VIROU `redirect` SECO** — a decisão que o dono confirmou: **ali chegam DOIS PAPÉIS** (o dono, que quer o cardápio; a cozinha, que quer as receitas). Redirect escolheria por quem chega e mandaria metade das visitas pro lugar errado. Virou **PLACA**: três destinos rotulados + *Setores e colaboradores*. ⚠️ **`/fichas/nova` e `/fichas/[id]` continuam vivas** — são as portas que as outras telas usam; só a LISTA morreu.

**⭐ O TESTE QUE IMPEDE O LIXÃO DE RESSUSCITAR** é estrutural e assumido como tal (sem jsdom não dá pra renderizar): ele prova que a rota **não busca a lista de fichas** — era o `fetch` daquela API que alimentava a mistura. **E o detector tem AUTO-TESTE contra o código velho** (REGRA 11): sem isso ele passaria verde por cegueira, que é exatamente como três guards deste projeto já nasceram mentindo.

## ⭐⭐ SABOR VIROU TIPO PRÓPRIO — A FRONTEIRA ENTRE A VENDA E A COZINHA (03/09/2026)

**CASO REAL:** o dono criou a ficha do sabor **CALABRESA** pela aba Complementos e ela apareceu em **Produção › Receitas**, no meio das **20 receitas de verdade**. Diagnóstico dele, certo: ***`tipoProduto` estava respondendo DUAS perguntas*** — *"como isto baixa na venda?"* e *"isto aparece na cozinha?"*. Com **~50 sabores** a caminho, seriam 50 intrusos na tela de quem cozinha.

**⭐ O QUE A MEDIÇÃO MOSTROU ANTES DE EU PROPOR QUALQUER COISA:** `explodir()` **sempre explode a ficha-alvo do mapa** — a decisão *pack × explodir* é por **COMPONENTE** (`fichaComp.tipoProduto`), não pelo alvo. Ou seja, **trocar o tipo do sabor é de graça pra mecânica da baixa**. Sem esse dado eu teria proposto algo mais caro.

**AS TRÊS COISAS DO DOMÍNIO** (`lib/stock/tipos-ficha.ts`, o vocabulário num lugar só):
| tipo | quem faz | exemplo |
|---|---|---|
| `INTERMEDIARIO` | a cozinha FAZ em lote, rendimento MEDIDO | porção de calabresa 120g |
| `PRODUTO_FINAL` | o cliente COMPRA, monta no pedido | XIS COMPLETO |
| **`SABOR`** | escolha DENTRO de um produto, monta no pedido | CALABRESA (a pizza) |

**⭐⭐ E A SEPARAÇÃO SAIU SEM UM `if` NOVO EM TELA NENHUMA:** cada régua já era **ALLOWLIST** (`=== INTERMEDIARIO` na produção, `=== PRODUTO_FINAL` no cardápio e no mapa de produtos), então o tipo novo fica de fora **por construção**. *Tipo que se acrescenta sem precisar caçar filtro é o sinal de que o vocabulário estava faltando, não o filtro.* A exigência do dono (*"fonte única, nada de segundo filtro por tela"*) foi cumprida sem a régua mudar.

**⛔ O QUE FOI DESCARTADO E POR QUÊ:** derivar de *"é alvo de mapeamento de complemento"* parecia mais barato (zero estado novo) e tem **falha real**: o dia em que ele mapear `MOLHO → ficha "molho especial"` (uma receita de verdade, caminho que o guard do mapa documenta como legítimo), essa receita **sumiria da cozinha**. Trocaria um intruso por um **sumiço** — e sumiço é a classe que este módulo mais paga.

**⭐ MUDANÇA DELIBERADA, APROVADA:** `SABOR` **explode** junto com `PRODUTO_FINAL` quando usado como componente (`montaNaVenda`). Sem isso, um sabor dentro de outra ficha baixaria o **item-invólucro**, que **ninguém produz** → saldo negativo eterno num item fantasma.

**⛔ E O INVÓLUCRO NÃO ENTRA NA CONTAGEM:** ninguém pesa "CALABRESA" na câmara — o que existe lá é a *porção*. Sem essa régua a contagem inicial nasceria com ~50 linhas impossíveis de contar, e **linha que não dá pra contar vira linha que se ignora**. ⚠️ **Dívida registrada (pré-existente, não mexida):** item de `PRODUTO_FINAL` (XIS COMPLETO, PIZZA PEQUENA 25CM) **também** aparece na contagem hoje — 2 linhas, decisão do dono.

**⚠️ E EXISTEM DOIS ITENS "CALABRESA" EM PROD, os dois legítimos:** a **matéria-prima** (`criadoVia CONFERENCIA`, 7 movimentos, veio de nota — **entra na contagem, se pesa**) e o **invólucro de sabor** (`criadoVia MANUAL`, `categoria SABOR` — fora da contagem). Conferi por ID, não por nome: foi a REGRA 8 evitando eu "consertar" um falso positivo meu.

**PROVADO EM PROD:** receitas na cozinha **19 → 18**, CALABRESA **fora** de Produção, `tipo=SABOR` e `categoria=SABOR`, contagem **sem** o invólucro **e com** a matéria-prima, e a baixa de 1 CALABRESA → **1 UN da porção pronta** (zero na crua). Conserto por script com preview, **sem recriar ficha** e sem tocar no mapeamento. Red-then-green (REGRA 11) nos **três** defeitos repostos.

## ⛔⛔⛔ O GATE QUE EU ESCREVI PRA MATAR A CLASSE MENTIU NA MESMA CLASSE (02/09/2026)

**Na mesma tarde eu (a) achei que o deploy declarava 4/4 verde com migration pendente, (b) escrevi um gate pra impedir isso, e (c) o gate deixou passar exatamente o mesmo caso — duas vezes, com o app no ar lendo tabela inexistente.**

**A CAUSA É DE SHELL, NÃO DE PRISMA:**
```bash
set -euo pipefail
if npx prisma migrate status 2>/dev/null | grep -q "have not yet been applied"; then …
```
Com migration pendente o `prisma migrate status` **sai com código 1** (medido: pendente → texto no *stdout* e exit 1; em dia → exit 0). Com `pipefail`, o pipeline vale o exit do **prisma**, não o do grep — então **o grep casava e o `if` lia FALSO**. O gate anunciava *"schema do banco em dia"* com a tabela faltando. Prova reproduzida em uma linha: `if (exit 1) | grep -q ""; then … ` → cai no `else`.

**⭐ A CURA É NÃO DEPENDER DE TEXTO NEM DE PIPE:** `migrate deploy` roda sempre (é idempotente) e a verificação passou a ser o **exit code** do `migrate status`. Código de saída não muda de idioma entre versões do Prisma e não atravessa pipe.

**⭐⭐ E O GATE GANHOU TESTE QUE O EXECUTA** (`__tests__/infra/gate-migrations.test.ts`): um `npx` **falso** no PATH imita os dois estados reais do Prisma e o teste roda `scripts/gate-migrations.sh` de verdade — pendente reprova, em dia passa, `deploy` que falha derruba. **O quarto teste roda a linha ANTIGA e prova que ela responde "em dia" com pendente**: é o red-then-green sobre comportamento de shell. ⚠️ Grep no fonte do `deploy.sh` **não distinguiria** a versão que funciona da que mente — as duas contêm a mesma frase.

**⚠️ A LIÇÃO, e ela é sobre mim:** *"escrevi um guard"* não é o mesmo que *"o guard morde"*. É a terceira vez no projeto que um guard nasce verde por construção (o de data fixa em 01/09, o do `PRONTOS` hoje de manhã, e este). **Guard novo só conta depois de rodar contra o defeito que o motivou** — e, quando o guard é shell, o defeito pode estar no shell, não na lógica.

## ⛔⛔ PERÍODO ENTRANDO COMO DIA É BOMBA PRA BAIXA (02/09/2026)

**O relatório do Suitable não traz data NENHUMA** (conferido no arquivo: zero ocorrência de data ou "período"), e o dono pode exportar **um dia** ou **um período inteiro**. Os dois caem na mesma tabela, que é indexada por `data`.

**⛔⛔ SE UM PERÍODO ENTRAR COMO DIA:** quando a baixa for ligada, *"processar o dia X"* baixaria as **7.648 ocorrências do mês inteiro** de uma vez, **com cara de operação de rotina**. Por isso o import ganhou `modo: 'DIA' | 'PERIODO'`, o período é marcado no `importId` (`comp-periodo-…`) e existe `ehLinhaDePeriodo` **para a baixa RECUSAR essas linhas**. ⚠️ A decisão fica registrada AGORA, no código que grava, e não na memória de quem for ligar a baixa daqui a um mês — é a mesma disciplina do bloco "LEIA ANTES DE LIGAR A BAIXA".

**⚠️ E A DATA DO SEED É RÓTULO, NÃO FATO:** como o arquivo não declara período, a data de um import de PERÍODO é só a chave da linha. O modo PERÍODO é o que impede esse rótulo de ser lido como "as vendas aconteceram neste dia".

**⭐⭐ O SABOR QUE AINDA NÃO VENDEU APARECE COM 0** — pedido do dono: *"não quero descobrir na primeira venda deles que não tinham ficha"*. Um dia de relatório não contém o cardápio inteiro (em 29/08, 5 dos 52 sabores não venderam). Sem isso eles só apareceriam **no dia em que fossem vendidos**, que é quando já é tarde.

**⛔⛔ E ISSO É GATEADO POR EVIDÊNCIA, senão vira dado inventado em outro cliente:** a lista dos 52 é o cardápio da **Caçula**, escrito em código. Injetar em toda empresa encheria a prateleira de um cliente qualquer com nomes de pizza que ele nunca vendeu — **dado inventado com cara de dado real**, e multi-tenant é onde isso dói mais. Só injeta onde o próprio relatório **já provou** que o cardápio é aquele (**10+ sabores casando exato**; a Caçula casa 51 de 52). Cliente que vende "BACON" e "FRANGO" sem ser pizzaria não herda nada.

## ⛔⛔ DOIS RELATÓRIOS, DOIS DIAS, UM CABEÇALHO SÓ — E O CARD QUE DEU −72 (02/09/2026)

**⭐ O MÉTODO SALVOU O DIA: a hipótese do dono era razoável e o dado a REFUTOU.** Ele viu *"121 complementos · CALABRESA 115"* onde a fixture tem 215 e 1.220, com o cabeçalho dizendo *"vendas de 21/08 a 21/08"*, e levantou: *"a aba herda o filtro de período do Cardápio"*. **Medido em prod (read-only, REGRA 8b):** a tabela tem **121 linhas · 121 nomes · 651 ocorrências, todas do dia 29/08**, e a prateleira devolve exatamente isso. **Não há filtro de período em lugar nenhum do caminho.** O arquivo que entrou foi **um dia real (29/08)**, não a fixture de período longo — CALABRESA 115 num dia é coerente com 1.220 num período.

**⚠️ A CONFUSÃO ERA DE TELA, E ELA É REAL:** o cabeçalho do Cardápio falava *"vendas de 21/08 a 21/08"* (o relatório de **PRODUTOS**) enquanto a aba mostrava **complementos de 29/08**. Dois relatórios, dois dias, um cabeçalho só — parece filtro, e não é. Agora **cada aba fala do período DELA** e a prateleira imprime o dela junto da contagem.

**⛔ MAS A INVESTIGAÇÃO ACHOU UM SUMIÇO SILENCIOSO DE VERDADE, que ninguém tinha visto:** a prateleira nascia **só das LINHAS**, e reimportar um dia **SUBSTITUI** as linhas dele. Um nome que só existia na versão antiga sai da tabela — e, **se já estava mapeado, o mapeamento continua vivo no banco e o nome DESAPARECE da tela**. Invisível na vista, valendo na hora da baixa: a família do "estoque invisível". **Fix: a prateleira é a UNIÃO de (nomes com linha) ∪ (nomes no mapa)**, e o mapeado sem linha aparece com **0 ocorrências**, no fim — que é o lugar honesto dele. Regra do dono que virou desenho: ***"mapear é trabalho independente de período — nome conhecido nunca some por causa de data"***.

**⛔⛔ O CARD "PRONTOS −72" — CONJUNTO QUE SE SOBREPÕE NÃO SE CONTA SUBTRAINDO.** A tela fazia `produtos − semDestino − semCusto`; **produto sem ficha é as DUAS coisas**, então era subtraído duas vezes: **80 − 76 − 76 = −72**, o número exato do print. Virou uma régua só (`ehProntoNoCardapio` = tem destino **E** tem custo) consumida pelo **card E pelo filtro** — senão o card diz um número e a lista mostra outro.

**⚠️⚠️ E O PRIMEIRO GUARD QUE ESCREVI NÃO MORDIA.** Ele testava o predicado puro; eu repus a subtração no `totais` e **os 46 testes passaram verdes**. *Guard que não pega o caso que o motivou dá selo verde de graça* — a mesma lição de 01/09. O que ficou **roda o pipeline real** (`hubCardapio`) e exige `card == tamanho da lista filtrada`; com a subtração de volta, vermelho na hora.

**⭐ AGRUPAMENTO SABOR × OUTRO — a régua é o CARDÁPIO, e ela é EDITÁVEL.** Os 52 sabores do cardápio real vivem em `lib/stock/vendas/grupo-complemento.ts` (seed em CÓDIGO: cardápio novo se resolve editando a lista, **sem backfill**); a tabela `stock_venda_complemento_grupo` (CREATE-only, CHECK no grupo) guarda **só o que o dono MOVEU**. Seções: **Sabores** (o trabalho que faz o estoque baixar) → **Outros** (borda, adicional, tamanho, combo) → **Ignorados** (colapsado; decisão tomada não disputa espaço com trabalho pendente). ⚠️ **Ignorado sai das duas primeiras seções**, senão vira trabalho que se refaz toda vez que a tela abre.

**⭐⭐ O CARD QUE RESPONDE A PERGUNTA DO DONO ("quanto da venda já baixa estoque") É POR OCORRÊNCIA, NUNCA POR NOME:** CALABRESA sozinha é **115 de 651 ocorrências (18%)** e **1 de 121 nomes (0,8%)**. Contar nome faria a barra andar devagar justamente quando ele mapeia o que mais importa. ⚠️ **IGNORAR não conta como coberto** (ignorar é decidir que NÃO baixa) e **sem ocorrência é "a apurar", nunca 0%**.

**⛔ E O SISTEMA NÃO CASA POR SEMELHANÇA.** `variacoesDeSabor` **lista** ("STROGONOFF DE CARNE FAMILIA parece STROGONOFF DE CARNE") e para aí — o vínculo N:1 é do dono. Casar sozinho faria a promo baixar a ficha de outro sabor sem ninguém mandar; é a mesma classe do *"o memo diz Transferência"*.

**CONFERÊNCIA DO CARDÁPIO (52 sabores × os 121 nomes de 29/08):** **51 dos 121 nomes são sabor**; **5 sabores nunca venderam como complemento** — PIZZA ATUM · MEXICANA · HOT DOG · CHOCOLATE PRETO · KIT KAT (não precisam de ficha agora, mas ficam **nomeados**: ausência silenciosa é a doença que este módulo mais paga). ⚠️ **`STROGONOFF DE CARNEE` (cardápio) × `STROGONOFF DE CARNE` (PDV)**: as duas grafias existem em fontes reais, então **as duas entram na régua** — registrar o que cada documento diz não é adivinhar.

## ⭐⭐⭐ A PRATELEIRA DOS COMPLEMENTOS — O CICLO FECHA NUM GESTO SÓ (02/09/2026)

**O QUE ISTO RESOLVE:** o relatório de PRODUTOS diz que saíram N pizzas grandes e **não diz de que SABOR**. Quem sabe é o Relatório de Complementos — `CALABRESA 1.220` é a maior linha dele. Sem este módulo o estoque não baixa sabor nenhum.

**⭐ A REGRA DE NEGÓCIO (do dono):** **1 ocorrência = 1 explosão da ficha, SEMPRE**, independente do tamanho. Quem garante é o CARDÁPIO — pizza pequena obriga 2 sabores, grande 4 → uma grande inteira de calabresa chega como **4 ocorrências**. ⚠️ NADA de fração por tamanho: o PDV já entregou a conta feita, e refazê-la seria refazer errado.

**⛔ DOIS MAPAS, E NÃO É DUPLICAÇÃO — 25 nomes estão nos DOIS relatórios:** COCA COLA 2L (337 produto · 134 complemento), MAIONESE CASEIRA (283 · 240), MAIONESE C/ ALHO (31 · **78**, o complemento é o dobro), XIS - CALABRESA (32 · 21). Com um mapa só (`@@unique(companyId, nomeSuitable)`) cada nome teria UM destino e **baixaria duas vezes**. ⚠️ E não deu pra pôr `origem` na chave da tabela existente: seria ALTER, e migration de estoque é CREATE-only. Tabela espelho resolve sem ALTER e sem backfill.

**⛔⛔ OS DOIS GUARDS SÃO OPOSTOS DE PROPÓSITO — quem "unificar" quebra um dos dois** (o comentário está nos dois arquivos): o mapa de PRODUTOS **recusa** INTERMEDIARIO (lá o destino é o que o cliente compra; apontar venda pra intermediário faria o xis baixar **carne crua** — bug real de 22/08); o mapa de COMPLEMENTOS **aceita**, porque sabor É intermediário e **baixa o pack pronto**, nunca explode a receita. Saldo negativo sem porção produzida é o comportamento CERTO: é o sinal de "vendeu sem produzir".

**⭐⭐ O CICLO FECHA NA MESMA TRANSAÇÃO — e o motivo é um bug real.** Criar a ficha do sabor PELA prateleira grava o vínculo nome→ficha **dentro do mesmo `$transaction`** (`criarFicha({ mapearComplemento })`). Em 01/09 o gesto era "cria a ficha → volta na aba → aponta à mão" e o passo 2 ficou de fora **3 vezes** — e é um gesto que se repete ~50 vezes. Mandar os dois mapeamentos juntos (produto E complemento) é recusado: sinal de chamada errada.

**⭐ DUPLICAR (padrão do modelo de etiqueta): "cria um NOVO com o conteúdo deste. Nada é sobrescrito."** Os ~50 sabores são FAMÍLIAS (14 variações de FILE, 8 de FRANGO) — do zero são 50 montagens; duplicando, 8 montagens e 42 ajustes. **⛔ A CÓPIA NUNCA NASCE MAPEADA:** o mapa é `@@unique` com UPSERT, então herdar faria a cópia **roubar as baixas da original em silêncio**, sem erro na tela. ⚠️ A decisão mora em **lib pura** (`camposDaCopia`), não num `useState` — a lição do prefill do cardápio: *regra que mora num `useState` é regra que ninguém prova*.

**⚠️ A PORTA DE IMPORT FALTAVA E A TELA PROMETIA ELA:** o vazio da prateleira mandava pra Vendas, e Vendas **não tinha upload de complementos** — a prateleira nasceria vazia pra sempre. Agora é aba própria: **data** (o arquivo NÃO traz o período — quem sabe é o dono na tela do Suitable) → arquivo → **PREVIEW** → confirmar. Pendente **não trava** o import (entra e fica visível pra mapear) e a tela diz que **nada baixou estoque**.

**⚠️ A CONFERÊNCIA É POR CONTAGEM, NUNCA POR DINHEIRO:** 73 das 215 linhas valem **R$ 0,00** (34%) — mas carregam **3.660 das 7.648 ocorrências (48%)**, porque são os sabores inclusos no preço. Um gate por valor descartaria quase METADE das baixas, e justamente as que este import existe pra capturar.

**⛔⛔⛔ LEIA ANTES DE LIGAR A BAIXA** (levantado pelo dono antes de o problema existir, anotado em `import-complementos.ts`): **reimportar um dia JÁ BAIXADO com números diferentes.** Hoje reimport SUBSTITUI e é seguro porque nenhum movimento nasce da linha. Depois da baixa, substituir deixaria **linha nova + movimento velho convivendo em silêncio**. As duas saídas aceitas: **estorno-e-refaz na hora** (o que `montarPlanoReprocesso` já faz pros produtos) **ou** marcar o dia como **"precisa reprocessar" VISÍVEL**. Substituir calado não é opção.

**TESTES:** 22 novos cobrindo o código novo — três destinos, ficha arquivada recusada, LIMPAR reversível, aviso dos 25, ordenação por ocorrências, ficha+vínculo na mesma transação, e a duplicação. ⚠️ Nasceram porque **8.110 verdes sem nenhum cobrindo o código novo é verde dos outros** (palavras do dono). Red-then-green medido nos dois pontos críticos: sem o vínculo na transação e sem o LIMPAR, 1 vermelho em cada.

**EM PROD (deploy 4/4 verde, `fc0c018`):** rotas novas respondendo 401 sem sessão (existem e estão travadas), telas 307. ⚠️ **PENDENTE (é do dono):** importar os dois relatórios pela tela com a DATA real — eu **não invento a data**, e o arquivo não a traz. Depois: apontar os sabores um a um (o conteúdo das fichas é dele; **o sistema não cria ficha de sabor nenhuma automaticamente**).

## ⛔⛔⛔ SALDO DECLARADO PODE SER DISPONÍVEL, NÃO CONTÁBIL (01/09/2026)

**A REGRA, ditada pelo dono, e vale pra todo banco daqui pra frente:**

> **Saldo declarado pelo banco pode ser DISPONÍVEL, não contábil. Âncora de conciliação é o saldo contábil DIA A DIA, nunca um único saldo final.**

**O CASO:** o `<LEDGERBAL>` do OFX do Banrisul é o saldo **disponível**, já descontando o `(+) BLOQUEADO + 24 HS`. O sistema ancorava nele → a conta mostrava **−6.267,03** enquanto o banco declarava **−4.567,03** de contábil em 28/08. **Fantasma de exatamente R$ 1.700,00 — com o ledger 100% correto o mês inteiro.**

**⭐ E O PDF FECHOU A QUESTÃO AO CENTAVO:** `SALDO DEVEDOR −4.925,96` **+** `(+) BLOQUEADO 1.700,00` = `SALDO NA DATA −3.225,96`. Os **21 dias** de agosto do PDF fecham um a um, e o ledger do sistema bate com **os 20** que ele tem (129 tx = 136 do PDF − as 7 de 31/08, ainda não importadas).

**⛔⛔ NÃO HAVIA TRANSAÇÃO FANTASMA PRA ESTORNAR** — e essa foi a correção mais importante do diagnóstico. Existem **0 transações de R$ 1.700,00** na conta. O −1.700 vivia só em `bankAccount.balance`/`ledgerBal`, gravados pelo import de **29/08 02:52** a partir do LEDGERBAL, com `ledgerBalMatched=true`. ⚠️ **O gate deu VERDE contra o número errado** — circular, a mesma doença do invariante de saldo que virou selo de graça em 28/08.

**⚠️⚠️ E O LEDGER NÃO SE SUSTENTA SOZINHO — medido antes de "derivar do ledger":** `Σ(482 tx EFFECTED) = −134.769,26` contra o contábil `−4.567,03`. O erro (**−130.202,23**) é **inteiro em jun/jul** e constante; agosto é perfeito. Trocar o saldo por `Σ(ledger)` deixaria a conta **130 mil pior**. É a mina registrada em "Modelo de saldo não separa ABERTURA de MOVIMENTO", e ela é REAL nesta conta. **O caminho é âncora de ABERTURA nossa, conferida uma vez contra o `SALDO ANT` do PDF (31/07 = −22.188,17), com o ledger mandando de lá pra frente** — o declarado vira conferência, não fonte.

**⭐ TERCEIRO PARSER DA MESMA FAMÍLIA:** Nubank (o `Total a pagar` da propaganda), Sicredi (rótulo repetido 4×), Banrisul (bloqueio embutido). **Todo número declarado tem que ser lido junto com o que ele EXCLUI.**

**⚠️ A CURA DOS PARSERS DE CARTÃO NÃO SERVE AQUI.** Lá o remédio foi cortar por posição de coluna; neste extrato as colunas **oscilam dentro do mesmo dia** (duas `PIX ENVIADO` de 31/08 em posições diferentes). A régua que fecha os 23 dias é **relativa**: valor = último token, sinal pelo `-` final, documento = os 6 dígitos anteriores. Teste trava as duas linhas reais.

**⭐ REGRA 4 RESPEITADA:** já existia parser deste layout (`banrisul-parser.ts`, de 31/07, pra contraparte). Foi **estendido**, não duplicado — ganhou `saldoAnterior`, `saldosDiarios`, `bloqueado`, `saldoDisponivel`, `futuros`, todos opcionais (fixture antiga segue válida).

**⛔ BUG ACHADO NA EXTENSÃO:** o bloco `MOVIMENTOS FUTUROS` era lido como lançamento realizado — o **consórcio de 09/09** entrava como transação de **01/09**. Pior: a data saía do PERÍODO do extrato (que acaba em agosto), datando-o **09/08**, um mês no passado, dentro da janela conferida. Agora o mês vem do marcador `++ MOVIMENTOS SET/2026`. ⚠️ E o consórcio de **11/08 é REAL** (documento 150022 × 150023) — só o DOCUMENTO separa os dois; filtrar por descrição mataria o lançamento verdadeiro.

**⚠️ O SELO É POR DIA, NUNCA PELA CONTA** (decisão do dono): agosto verde e setembro sem selo é o honesto. Sem PDF, importa **sem selo**, com aviso de que o OFX do Banrisul desconta bloqueio.

**⭐⭐⭐ RESULTADO EM PROD (01/09): 22 DE 22 DIAS FECHAM.** Âncora `31/07 = −22.188,17` (do `SALDO ANT` do PDF, com a origem escrita e evento de auditoria) · régua de 23 dias gravada · 31/08 e 01/09 importados pelo endpoint REAL (13 linhas, **1 futuro descartado** = o consórcio de 09/09) · os 2 nomes de 25/08 preenchidos pelo PDF · **saldo −3.225,96 = o contábil do banco ao centavo**, com o disponível (−4.925,96) e o bloqueio (1.700 em 01/09 14:01) ao lado, datados.

**⛔⛔ BUG PEGO PELO DADO REAL, que o teste escondia:** o filtro era `date > openingDate` com a âncora em `31/07 00:00Z` — e **o sistema grava as transações ao MEIO-DIA UTC**. As **10 tx de 31/07 12:00** entravam de novo e o saldo saiu **−4.662,10** em vez de −4.567,03, errado em **−95,07** = a soma exata delas. O teste passava porque usava meia-noite: **fixture idealizada escondendo a convenção real do banco de dados**. Régua nova: o DIA da âncora inteiro fica fora (`depoisDaAncora`).

**⛔ AS 4 "CACULA MIX" DE 31/08 NÃO FORAM MARCADAS COMO TRANSFERÊNCIA — e o motivo é estrutural:** `prepareBalanceTransactions` **descarta TRANSFER sem `transferGroupId`** (as 19 de agosto têm par). Marcar as 4 sem a perna do destino tiraria **R$ 37.500** do saldo e quebraria 31/08 e 01/09 — desfazendo o 22/22. O caminho é o pareamento de sempre (sugere, o dono confirma) **depois** que a perna do destino for importada.

**⚠️ ACHADO NO IMPORT NOVO — O BANRISUL INVERTEU OS CAMPOS DO OFX:** neste download `description` = `"CACULA MIX"` (o favorecido!) e `counterpartyName` = `"PIX ENVIADO"` (o histórico genérico). Ou seja, **o OFX passou a trazer o favorecido**, mas no campo errado pro nosso mapeamento — e o `counterpartyName` está sendo poluído com texto genérico. A ficha do banco diz `counterpartySource: 'PDF_ONLY'`, o que **deixou de ser verdade**. Tarefa própria: reconferir o mapeamento NAME/MEMO do Banrisul contra dois downloads.

**📋 TAREFA PRÓPRIA REGISTRADA — os R$ 130.202,23 de jun/jul:** `Σ(482 tx)` diverge do contábil por um valor **constante** desde antes de agosto. **Hipótese: a conta nasceu sem lançamento de abertura** (offset constante tem essa cara). **NÃO mexer agora** (decisão do dono). Quando o PDF de junho existir, **a mesma conferência diária resolve** — e mover a âncora pra trás já é seguro, porque toda mudança deixa evento.

## ⛔⛔⛔ NÚMERO DE PROPAGANDA PARECE NÚMERO DE CONFERÊNCIA (31/08/2026)

**A REGRA, e vale pra TODO parser de documento daqui pra frente:**

> **Todo valor DECLARADO tem que vir ancorado no BLOCO a que pertence — nunca de regex solto sobre o documento inteiro.**

**O CASO:** a fatura do Nubank tem `Total a pagar` **duas vezes**. Uma no bloco *"Parcele a sua fatura"* (**R$ 3.634,43** — quanto se pagaria financiando em 3×) e outra no RESUMO (**R$ 3.053,32** — o que se deve). O parser lia a PRIMEIRA. **Ele conferia a fatura contra um número de SIMULAÇÃO.**

⚠️⚠️ **E o perigo não é o erro — é o acerto por acaso.** Uma fatura que não fechasse mandaria o dono investigar; mas no dia em que os dois números coincidissem, o gate daria **verde sobre a régua errada** e o selo viraria enfeite sem ninguém notar. *"A conta fecha" NÃO prova classificação certa* — a mesma lição do `ledgerBalMatched` de 13/08.

⚠️ **O FIX É ESTRUTURAL, NÃO "REGEX MAIS ESPERTO":** lê-se dentro do trecho do resumo, ancorado no rótulo que só ele tem (`"Total de compras de todos os cartões"`). Regex mais específico continuaria dependendo de a propaganda não mudar de texto.

**⭐⭐ A CLASSE JÁ TINHA MORDIDO ANTES, EM OUTRO PARSER, E NINGUÉM GENERALIZOU.** O `mercadopago-fatura-parser.ts` tem, desde 29/08, este comentário: *"NÃO pode cair no 'Total a pagar: até R$ 4.966,40' da seção de parcelamento, que é uma OFERTA, não a fatura (foi o que aconteceu na 1ª rodada)"*. Dois parsers, o mesmo defeito, dois meses de distância — porque na primeira vez virou comentário local em vez de regra do módulo.

**AUDITORIA DOS 6 LAYOUTS (feita, medida nas fixtures REAIS):**

| parser | frase-âncora duplicada? | usa no gate? | veredito |
|---|---|---|---|
| **Nubank PF** | `Total a pagar` **2×** (3.634,43 × 3.053,32) | sim | ⛔ **era LIVE — corrigido 31/08** |
| **Mercado Pago PJ** | `Total a pagar` 3× | sim | ⭐ já ancorado em 29/08 (`^[ \t]*Total[ \t]{2,}` + janela) |
| **Sicredi PJ** | `Total cartão (final …)` **4×** | **sim** (`validate-fatura` usa em 4 checagens) | ⚠️ **LATENTE** — as 4 ocorrências trazem **o mesmo valor** (7.995,55, repetido no cabeçalho de página). Seguro **por coincidência do documento**, não por construção: fatura com 2 cartões de totais diferentes conferiria contra o 1º |
| **Banrisul PF** | `TOTAL DE GASTOS` **2×** (23.648,03 × 15.654,61 — os dois portadores) | **não** (o gate usa `brasil` e `saldoAtual`, 1× cada) | ⚠️ **LATENTE** — lê o 1º portador como se fosse total; inofensivo só porque ninguém confere com ele |
| **Banrisul PJ** | não | — | ✅ |
| **Caixa PJ** | `Total final` 2× | sim, mas por **`matchAll` chaveado pelos 4 dígitos do cartão** | ✅ seguro **por construção** |

**⭐ O PADRÃO QUE SEPARA SEGURO DE SORTUDO:** o Caixa está seguro porque **coleta todas as ocorrências e as indexa**, em vez de pegar a primeira. Quem faz `text.match()` num rótulo que se repete está apostando no layout.

**DÉBITOS ABERTOS (não corrigidos — decisão do dono):** ancorar o `totalCartao` do Sicredi (ou exigir que as N ocorrências concordem, senão `null`) e o `totalGastos` do Banrisul PF. Nenhum dos dois está errado hoje.

**⚠️ TAREFA PRÓPRIA REGISTRADA (não feita):** o **anonimizador de fixture precisa de um teste** que prove que as palavras da lista de decisão sobrevivem. Hoje a lista vive no gerador e nada impede alguém de mexer e descobrir três meses depois. **Já mordeu duas vezes:** 26/08 (comeu `"PAGAMENTO"` e os nomes dos meses → o parser PJ divergiu em 8.736,17 e a seção "Próximas Faturas" sumiu) e 31/08 (comeu `"Banrisul"` → 12 testes do ciclo PF vermelhos). **Palavra que decide não se anonimiza.**

## ⭐⭐ O CAMINHO PF GANHOU UMA PORTA — E O 2º LAYOUT (31/08/2026)

**CASO:** o dono criou um cartão Nubank, subiu a fatura do Nubank, e o sistema aplicou **os regex do Banrisul**. A falha saiu como *"o PDF não declarou o total (layout inesperado)"* — **"banco não reconhecido" vestido de "o layout mudou"**, e ele foi caçar uma mudança que não existia.

⚠️ **NÃO FOI UM `??` MAL COLOCADO.** `importar-fatura-pf.ts` chamava `parseBanrisulFaturaPF(texto)` **direto** e maquiava com `detectedBank ?? 'Banrisul'` — que nunca poderia ajudar, porque `nucleo.ts` cravava `detectedBank: 'Banrisul'`. **O PJ tem registry com `match` por banco desde sempre; o PF nasceu com um banco só e nunca ganhou a porta.**

**⭐ AS QUATRO FALHAS TÊM NOME PRÓPRIO** (`diagnosticarFalha`, pura): banco não reconhecido · documento sem os totais · totais presentes mas 0 linhas · não fecha. Um teste garante que **as quatro mensagens são diferentes entre si** — *"se toda falha diz a mesma coisa, eu paro de ler"* (dono). E a de banco desconhecido **não pode conter a palavra "layout"**, que foi a que mandou ele pro lugar errado.

**⭐ O TOTAL DECLARADO TEM DUAS FONTES: o PDF, ou o DONO digitando** olhando a fatura em papel. **A conferência roda IDÊNTICA nos dois casos** — é isso que impede a saída manual de virar afrouxamento. Sem total de nenhuma das duas = **não importa**. Digitado que não fecha = **não importa**, com a diferença ao centavo. A **origem fica gravada** (`PDF` | `DIGITADO`).

**⚠️ O MATCH DO BANRISUL TEM DOIS SINAIS, e o 2º não é preguiça:** a fixture anonimizada tem **ZERO ocorrências de "banrisul"**. Casar só pela marca derrubou 12 testes do ciclo PF na hora — e, pior, arriscaria o único import que funciona em prod, porque **não dá pra provar do repo que o PDF real traz a palavra**. O 2º sinal é o rótulo estrutural que o parser já depende pra ler.

**GOLDEN NUBANK, contra o `pdftotext` REAL** (venc 17/08/2026): `compras 2.692,12 + IOF 33,91 + outros 327,29 = 3.053,32` = declarado, **diferença 0**.
- ⚠️ **A conferência é pela COMPOSIÇÃO declarada, NUNCA pela soma bruta:** somar todas as linhas dá **negativo**, porque o Nubank mistura pagamento, crédito e saldo em atraso no mesmo bloco. Uma régua inventada reprovaria fatura correta.
- ⚠️ **1 centavo de folga NO SUBTOTAL:** o próprio PDF declara `Pagamentos e Financiamentos −5.066,39` pra linhas que somam **−5.066,40**. É divergência do banco. O total principal continua exigindo **exato**.
- **Manias travadas:** IOF é lançamento próprio e vem **sem** os 4 dígitos · as 2 linhas de conversão internacional não são lançamento · `−` U+2212 nas linhas **e** `-` ASCII nos subtotais, no mesmo documento · parcela sai do nome pra estrutura · 3 finais de cartão · **o ano vem do período** (mês > o do vencimento ⇒ ano anterior).
- **Blocos-fantasma:** `Saque no crédito`, `Pix no crédito` e até `"nem multa. R$ 3.053,32"` (parágrafo quebrado pelo `-layout`) viravam bloco. Só conta depois de `TRANSAÇÕES DE …`.

**⚠️ CORREÇÃO HONESTA sobre um "achado" meu:** o bug do `"Pagamento recebido"` filtrado por FRASE **não teria mordido no arquivo real** — lá a linha se chama `"Pagamento em 22 JUL"`. Ele apareceu contra a minha fixture inventada. A regra que ficou no código vale igual: **a frase é a flag, TER DATA é o vínculo** — e por isso a lista de frases **não pode** ser movida pro laço de transação "pra simplificar".

**ESTADO DOS PARSERS DE FATURA (6 layouts provados):** **PJ** — Sicredi 7.896,32 · Banrisul 13.779,73 · Caixa 7.280,39 · Mercado Pago, todos com fixture real e golden. **PF** — Banrisul 18.348,72 · Nubank 3.053,32. Itaú, BB, Santander, Inter, C6, XP: **nenhum**.

## ⛔⛔⛔ DÍVIDA MORA NUM LUGAR SÓ — E A VARREDURA DE ÓRFÃOS ACHOU R$ 21.968,02 PARADOS (30/08/2026)

**O PEDIDO ERA UMA LIMPEZA DE TELA; O ITEM 5 DELE ACHOU DINHEIRO.** O dono mandou tirar a duplicata (*"depois da ponte, os boletos vão direto pro Contas a Pagar — a tela do estoque virou DUPLICATA"*) **e** exigiu: *"confere órfãos ANTES de remover: não pode sumir dívida no apagar da tela"*. A varredura:

| | qtd | valor |
|---|---|---|
| fila de envio (sugestão sem link) | **8** | **R$ 21.968,02** |
| já enviadas (tem link) | 37 | 67.073,19 |
| **órfão** (link sem conta no financeiro) | **0** | — |
| **duplicada** (na fila E enviada) | **0** | — |

**Zero órfão e zero duplicata — mas os 8 da fila são exatamente o lote que este doc registrou como ENVIADO em 24/08.** Conferido conta a conta no financeiro: **não estão lá** (a única linha de 230,81 é de OUTRA nota do Cancian, enviada em 29/08). **A dívida não estava em dois lugares; estava em NENHUM.** E vencendo: **R$ 6.237,26 já vencidos** (Frigorífico 27/08, Cancian 29/08) e **R$ 2.537,29 vencendo no dia** (Dalmolin).

**⛔⛔ E O JUIZ AVISAVA — 5 achados F3, com a frase certa** (*"conferido há mais de 7 dias e ainda NÃO foi pro contas a pagar — vence sem aparecer no fluxo de caixa"*). **O alarme funcionou; o canal não.** É a lição que fecha a série dos alarmes: **e-mail noturno não é lugar de dívida vencendo — o dono lê TELA.** Por isso o card não é conveniência: é o canal que faltava.

⚠️ **E é por isso que a ordem do dono estava certa:** apagar a tela primeiro teria tornado esses R$ 21.968,02 invisíveis — o F3 seguiria gritando no vazio.

**O QUE FICOU:**
- **A sidebar perdeu "Boletos p/ pagar".** A rota continua viva — é pra onde o card leva. Guard novo (red-then-green provado): **item de menu apontando pra `/estoque/contas-a-pagar` quebra o teste**. Item de menu é o que faz uma tela voltar a ser destino.
- **A FILA DE ENVIO virou CARD em Recebimentos** — *"N boletos aguardando envio ao financeiro · R$ X"*, **vermelho com a contagem de vencidos/vence-hoje**, e **some sozinho quando a fila esvazia** (zero boletos = zero tela). Leva pro mesmo fluxo de envio de sempre (checkbox por parcela).
- **⭐ A RÉGUA DO CARD É FUNÇÃO PURA** (`lib/stock/ponte/fila-envio.ts`), não lógica dentro do componente — a lição do prefill do cardápio: *regra que mora num `useState` é regra que ninguém prova* (o projeto roda em `environment: node`, sem jsdom). Ela roda contra **os 8 boletos reais**, com o total ao centavo. ⚠️ **`hoje` é PARÂMETRO**: o relógio só rotula a tela, nunca decide — e a comparação é DIA×DIA em UTC, senão o boleto de hoje viraria "vencido" dependendo da hora em que o dono abre.
- ⚠️ **Sem vencimento NÃO é urgente** — entra no total, fica fora do vermelho. Inventar urgência a partir de ausência é como se treina o dono a ignorar alarme (a lição dos 111 falsos).
- **A OPERADORA NÃO VÊ O CARD** (`stock.manage` — a fronteira de papel de sempre). ⚠️ E aqui, **diferente da sidebar**, ele espera as permissões carregarem: menu que some item na cara de quem já está lendo é pior que menu que demora; **card que aparece e some parece defeito**.
- **⛔ O BLOCO "JÁ NO CONTAS A PAGAR" SAIU — e o payload `enviadas` saiu junto.** Era uma SEGUNDA lista do mesmo dinheiro. **Deixar o dado na rota manteria a segunda fonte esperando alguém desenhar a tela de novo.**
- **⭐ RENEGOCIAR NÃO MORREU — MUDOU DE CASA.** Listar dívida é uma coisa; mexer no combinado do DOCUMENTO é outra. Agora abre da própria NOTA: **Recebimentos → Recebidas → "Ajustar parcelas (renegociou?)"**, por um componente único (`AjustarParcelasDaNota`) que carrega XML + combinado + quantas contas serão canceladas sozinho — qualquer tela com uma nota na mão oferece o gesto sem repetir o fetch (REGRA 4).
- **⭐ E A SETA DE VOLTA: "ver nota de origem" no Contas a Pagar do financeiro** (`lib/stock/ponte/nota-de-origem.ts`). Chip `NF 2407777 ↗` na linha → abre o **RECIBO** se a nota já foi conferida, a **fila** se não. ⚠️ **A função mora no módulo de ESTOQUE**: quem conhece `stock_payable_link`/`stock_receipt_conference` é ele; a rota do financeiro recebe `{ transactionId → href }` pronto e não aprende o esquema do estoque. **É leitura pura** — a exceção desenhada ao isolamento (estoque escrevendo em `transactions`/`suppliers`) continua sendo só a ponte de criação. **Fail-soft**: estoque fora do ar = lista sem link, nunca lista sem abrir.

**14 testes novos · 642 stock verdes · TS 0.** ⚠️ **PENDENTE E URGENTE (é do dono):** os 8 boletos continuam parados — **enviar é gesto dele** (`stock.manage`), e 2 já venceram. O card agora mostra isso toda vez que ele abre Recebimentos.

## ⭐⭐⭐ REGRA DE PRODUTO — ASSINATURA É POR EMPRESA; CONVIDADO HERDA; FUNCIONÁRIO NUNCA PAGA (30/08/2026)

**Vale pra CADA cliente que entrar daqui pra frente:**
- **QUEM ASSINA É A EMPRESA.** O plano e o trial pertencem ao **CNPJ**, pagos pelo dono/admin.
- **FUNCIONÁRIO CONVIDADO HERDA** o acesso da empresa: **nunca** tem trial próprio, **nunca** vê banner de plano, **nunca** vê "assinar".
- **Empresa inadimplente é problema do DONO.** O funcionário vê, no máximo, *"acesso suspenso — fale com o responsável"*.
- **Ver/gerenciar plano é de dono/admin** — é a mesma fronteira de papel dos boletos: *decisão que gasta dinheiro da empresa é do dono*.

**O QUE ACONTECEU:** a Marcyelle, convidada como `OPERADOR_ESTOQUE`, logou e viu **"TRIAL 14 dias restantes · Ver planos"**. O sistema criou uma assinatura **pra ela**.

**⚠️ ERAM TRÊS PORTAS criando assinatura, e fechar uma só seria enxugar gelo:** o **cadastro**, o **LOGIN** (`getOrCreateSubscription` cria "por defesa" **a cada acesso** — apagar a dela sem isso seria inútil) e o **`/api/subscription/me`**. As três agora resolvem por empresa e **não criam nada**.

**⚠️ MIGRATION ADITIVA PURA e o `userId @unique` FICA:** `ADD COLUMN` nullable `companyId` em `subscriptions` (8 linhas). O Asaas (customer, checkout, webhook) resolve **por usuário** — reescrever a integração de **pagamento** no mesmo passo trocaria um problema de **regra** por um risco de **cobrança**. **A regra nova mora na LEITURA** (`assinaturaEfetiva`); o `userId` vira o portador histórico de quem contratou. Rollback: `DROP COLUMN`.

**A cascata, cada degrau com motivo:** assinatura da EMPRESA → a do DONO da empresa (cobre o histórico sem `companyId`) → a própria, se ele for dono → **null**. ⚠️ **E `null` nunca vira "EXPIRADO"**: convidado não tem o que expirar, e marcar expirado o jogaria em `/assinar` — a tela que ele nunca deveria ver.

**⚠️⚠️ E O DRY-RUN DO BACKFILL ME SALVOU DE UM ESTRAGO:** a 1ª régua era *"não é dono de nenhuma empresa → apaga a assinatura"*, e ela marcou **5** — incluindo o **admin da plataforma** (GRANTED), uma conta de teste e um **segundo email do dono**. **"Não é dono" ≠ "é funcionário":** funcionário é quem **ESTÁ numa empresa** e não é dono dela; conta **sem vínculo nenhum** não se toca. Régua apertada → **1 removida** (a certa), **4 intocadas**.

**⚠️ E OS TESTES DO ASAAS PEGARAM O EXCESSO SEGUINTE:** meu guard de checkout bloqueou contas que **têm assinatura própria mas não têm empresa** (o admin, contas de avaliação) — clientes legítimos sendo barrados do próprio checkout. **Quem paga pode mexer no que paga**; a regra é sobre funcionário não pagar, não sobre impedir cliente de gerenciar o dele.

**PROVADO EM PROD (as duas sessões):**
| | assinatura efetiva | titular? | pode gerenciar? | assinatura pessoal |
|---|---|---|---|---|
| **operadora** | `inteligencia/GRANTED` da Caçula | **não (herda)** | **não** | **nenhuma** ✅ |
| **dono** | `inteligencia/GRANTED` | sim | sim | GRANTED, amarrada à Caçula |

Backfill em prod: **3 amarradas · 1 removida · 4 intocadas**. `pg_dump pre-billing-empresa` antes.

## ⛔⛔ BLOCKLIST NÃO SEGURA MENU — A ALLOWLIST DO SIDEBAR (30/08/2026)

**⚠️ MINHA 1ª TENTATIVA FOI BLOCKLIST e falhou exatamente como blocklist falha:** escondi à mão os itens que EU lembrei. **O dono mediu na tela dela** e listou o que sobrou — **Dashboard COM O FATURAMENTO**, Recorrentes, Relatórios, **Tributário inteiro**, Cadastros (Empresas, Bancos, Clientes, Fornecedores, Categorias, Sócios), Inteligência, **Usuários, Permissões, Auditoria, Alertas** e "Em breve". Tudo que eu não lembrei.

**⭐⭐ AGORA É ESTRUTURAL: `perm` É OBRIGATÓRIA NO TIPO do `SidebarItem` — item novo sem mapeamento NÃO COMPILA** — e o componente **some sozinho** quando o papel não tem a chave. **Default é ESCONDER.** Os 50 itens mapeados pras **36 chaves REAIS** do RBAC. É a REGRA 5 aplicada a menu: o erro deixou de ser improvável e passou a ser impossível.

**⚠️ E CHAVE INVENTADA ESCONDERIA O ITEM ATÉ DO DONO** — o OWNER tem lista **concreta** de 36 chaves, **não `*`** (a lição de 24/08). Por isso o guard confere cada `perm` contra a lista real; erro de digitação aqui seria bug de tela pra todo mundo.

**⭐ O DASHBOARD TAMBÉM LIA SÓ `UserCompany`** (a 2ª porta de novo, agora em server component): a convidada caía no empty state *"você não está em nenhuma empresa"* **sendo membro de verdade**.

**⭐ E O LOGIN DELA CAI DIRETO NA POSIÇÃO:** o dashboard mostra faturamento — pra quem só opera estoque não é só inútil, **é o número que ela não deveria ver, na primeira tela**.

**PROVADO EM PROD com a sessão real dela:**
- **menu: 16 de 50 itens** · **itens da empresa fora do estoque: NENHUM**
- as **17 rotas** por trás de cada item que vazou: **ZERO devolvem 200** (403 nomeando a permissão que falta, ou 404). **O menu esconde e a rota nega — os dois.**

**⚠️⚠️ E A AUDITORIA DO MAPA PEGOU DOIS ERROS MEUS**, os dois da mesma família ("o mapa é lido de cima pra baixo"):
1. **`/empresas/<id>/despesas`** (tela **financeira**) casou com o fragmento genérico `/empresas` **antes** do específico e virou `company.view` — quem tivesse `company.view` sem `transaction.view` veria tela de dinheiro.
2. Itens do **workspace PESSOAL** (`/perfis/`) mapeados em `transaction.view`/`report.view` — **as despesas dela são dela**, não são governadas pelo papel na empresa. Viraram `@sempre`.

Os dois viraram guard. ⚠️ E **o guard da tela financeira pegou um falso positivo dele mesmo**: `/estoque/vendas` (Suitable) casa com `/vendas` e é tela de estoque — regex de guard também precisa de teste.

## ⛔⛔⛔ O CONVIDADO NÃO ENTRAVA NA EMPRESA — E 3 VAZAMENTOS DE FINANCEIRO NO CAMINHO (30/08/2026)

**CASO REAL:** a Marcyelle foi convidada como `OPERADOR_ESTOQUE` da Caçula, criou a conta pelo link e **caiu num workspace vazio**. Perícia: conta existia, **zero vínculo, zero papel**, convite com `acceptedAt` **NULL** e **não expirado**.

**⚠️ DUAS CAUSAS INDEPENDENTES, e a segunda ninguém veria:**
1. **cadastro e login faziam `router.push('/dashboard')` FIXO**, jogando fora o `redirect` do convite. Ela criou a conta e **nunca voltou pra aceitar**. ⚠️ O aceite **em si já era atômico** (`$transaction` com UCR + `acceptedAt`) — **ele nunca foi alcançado**. O bug não estava onde a hipótese apontava.
2. **⭐⭐ `/api/empresas` listava só por `UserCompany`** (o modelo ANTIGO) e o aceite grava **`UserCompanyRole`** (o do RBAC). **Mesmo aceitando certo, a empresa não apareceria no seletor** — acesso funcionando por baixo (rotas de estoque respondendo 200) e **workspace vazio na cara dela**. É o *"linked tem DUAS portas"* de 14/08 **outra vez**: checar UMA é o bug.

**⛔⛔ E A INVESTIGAÇÃO ACHOU VAZAMENTO DE FINANCEIRO** (medido em prod, com a sessão real dela):
| rota | o que devolvia |
|---|---|
| `/fluxo-caixa` | **200** com *"entrou: 475.739,55"* |
| `/vendas` | **200** com o faturamento diário |
| `/juiz` | **200** com o relatório de **TODAS as empresas** — chamava `getAuthContext` **sem companyId**: bastava estar logado |

**A lição em uma frase:** `getAuthContext(request, companyId)` **só prova que a pessoa É DA EMPRESA — não que ela pode ver AQUILO.** Faltava `requirePermission`. ⚠️ O juiz não dava pra escopar por empresa (o relatório é global), então a régua virou *"precisa de `transaction.view` em ALGUMA empresa"*.

**⭐ E O MENU NÃO RESPEITAVA O PAPEL:** `/api/empresas/[id]/me` existia **com o comentário "usado pela sidebar contextual para filtrar menu por permissions"** — e **nunca foi consumido por ninguém**. Ela veria Transações, DRE, Conciliação, e **cada clique bateria num 403**. *Menu que oferece o que a pessoa não pode fazer ensina que o sistema está quebrado.* ⚠️ Enquanto as permissões carregam, o menu aparece **inteiro** — filtro que chega depois **pisca e some item na cara do usuário**; e a trava de verdade são as ROTAS, isto é UX.

**⚠️ O `redirect` só aceita caminho INTERNO** — mandar usuário recém-cadastrado pra domínio arbitrário é open redirect de manual.

**CONTA DELA CONSERTADA pelo ENDPOINT REAL do aceite** (nunca script replicando a lógica): `caçula mix` como `OPERADOR_ESTOQUE`, convite marcado aceito. **PROVADO EM PROD depois:** seletor mostra a Caçula · permissões `stock.view, stock.operate` · estoque **200** (posição, etiquetas, contagem) · financeiro **403** nos cinco (fluxo de caixa, vendas, juiz, DRE, transações).

**⚠️ ITEM 7 — não havia workspace fantasma pra limpar:** ela não tinha `PersonalProfile` nem empresa própria; o "workspace vazio" era o empty state de quem não está em lugar nenhum. Nada a apagar.

**⚠️ E O GUARD DE SIDEBAR DE 26/08 REPROVOU O APERTO:** o regex exigia `workspaceType !== 'pf' && (` e o gate virou `… && !soEstoque && (`. Afrouxei **só pra aceitar um gate MAIS restritivo** — *guard que impede endurecer é guard que envelheceu*.

## ⭐⭐⭐ A ETIQUETA VIROU A TELA — E A LIÇÃO É SOBRE ENSINO, NÃO SOBRE LÓGICA (31/08/2026)

**⛔⛔ O RELATO DO DONO É O ACHADO:** *"o comportamento está CORRETO, mas a tela FALHOU no teste de uso: eu mesmo, dono do produto, olhei e conclui que os dois lados faziam a mesma coisa. Se eu me confundo, a Marcyelle se confunde."*

Ele digitou **"queijo"** no campo Rótulo do nome do produto achando que trocava o CONTEÚDO, e a prévia mostrou **"queijoPorção de carne 100g"**. **Nada estava quebrado** — dois blocos de inputs visualmente idênticos, um em cada lado da tela, e **nada mostrando que "Rótulo" e o valor formam UMA linha da etiqueta**. **Se o dono lê errado, a régua está errada — não o leitor.**

**⭐ O DESENHO NOVO (padrão ZebraDesigner/BarTender/Canva): a etiqueta é o elemento principal e a edição acontece NO elemento.** Três colunas — camadas · etiqueta (400px, o centro) · inspetor da linha. Sumiram os 9 cards empilhados **e** o card "Dados de prévia": cada dado de exemplo passou a morar **na linha a que pertence**.

**⭐⭐ O QUE ENSINA SÃO TRÊS COISAS AMARRADAS**, não um texto explicativo: (1) a tira *"como sai na etiqueta"* mostra a linha **montada**, com as partes pintadas — `VAL` em chip azul, `03/09/2026` em chip âmbar tracejado; (2) as caixas de edição repetem **exatamente** as mesmas cores (🔒 azul = salvo · 👁 âmbar = só prévia); (3) focar um campo **acende** a parte correspondente na etiqueta, e clicar numa parte leva o cursor ao campo dela. O mapeamento vira literal.

⚠️ **A LINHA DE TEXTO LIVRE tem só a caixa azul** (o texto dela É salvo) — a ausência da caixa âmbar ensina o contraste de graça, sem mais uma legenda.

**⭐ A INTERAÇÃO ENTROU NO `PreviaEtiqueta` QUE JÁ EXISTIA, e não num "canvas editável" novo:** um segundo renderizador faria o que se **edita** divergir do que se **imprime** na primeira mudança de layout. Sem `onSelecionar` o componente é o mesmo de antes — a tela `/estoque/etiquetas` não mudou em nada. As partes (`{rotulo, conteudo}`) viraram **dado do layout**, com teste provando que **recompõem exatamente** o texto desenhado (não são um 2º cálculo).

**⚠️ DECISÕES DO DONO no desenho:** (a) **um card só** no topo — "Espaço usado"; "linhas ativas" e "avisos" repetiam o que já está a dois centímetros e roubavam espaço da etiqueta. **E o denominador é derivado do MESMO limite do `estourou`** (`LADO_DOTS_USAVEL`), senão a barra diria 92% numa etiqueta já estourada; (b) **arrastar E setas ↑↓ nos DOIS** (desktop e celular), uma lista só, os dois gestos chamando `moverBloco` — *"dois comportamentos diferentes pra mesma lista é fonte única quebrada"*; o teclado vem de brinde; (c) **faixa de clique da largura inteira** — clicar no vazio à direita de "25 UN" seleciona a linha da Quantidade.

**⭐⭐ O TESTE QUE MATA A CLASSE, não a instância:** *"nenhum campo do modelo fica sem jeito de ser previsto"* (`ENTRADAS_PREVIA`). Campo novo sem entrada = campo que o dono não consegue prever — e aí ele tenta trocar pelo Rótulo de novo, que foi exatamente o que aconteceu.

## ⛔⛔ "RÓTULO SOZINHO NÃO VIRA LINHA" ERA REGRA ERRADA — E O ASSASSINO NÃO ERA O SUSPEITO (31/08/2026)

**CASO REAL, achado pelo dono no browser:** rótulo **"carne 100 grama"** no Nome do produto + conteúdo de prévia vazio → **a linha sumia inteira**. Bastava digitar uma letra pra voltar. **Isso quebrava a promessa que a própria tela faz:** a caixa azul do inspetor diz *"SAI EM TODA ETIQUETA — É SALVO"*, e não saía.

**⚠️⚠️ ERAM DOIS GUARDS, e o apontado nem chegava a rodar:**
```
201:  if (!bruto.trim()) continue     ← MATAVA AQUI (guard de 30/08, decide pelo CONTEÚDO)
204:  if (!valor) continue            ← o suspeito; inalcançável
```
**Corrigir só o `juntarRotuloValor` teria deixado o bug vivo** e o dono reabriria o chamado. **Guard que decide por UMA das partes não pode existir num lugar onde a linha é a SOMA das duas.** Os dois viraram **um só**, sobre o valor que vai ser desenhado.

**⭐ E A SUSPEITA DO DONO ESTAVA CERTA — eram duas réguas pro mesmo caso.** A regra velha nasceu pra evitar imprimir **"VAL" solto sem data**; mas `valoresDaEtiqueta` devolve **"A DEFINIR"** quando não há validade, **nunca string vazia**. Ela guardava um estado **inalcançável** e cobrava um bug real por um problema que a outra régua já resolvia.

**A REGRA ÚNICA: a linha existe se há algo pra imprimir — rótulo OU conteúdo.**

| rótulo | conteúdo | sai |
|---|---|---|
| `"VAL"` | vazio | **não acontece** (vem "A DEFINIR") |
| `"carne 100 grama"` | vazio | **`carne 100 grama`** |
| vazio | vazio | nada — linha em branco vira buraco |
| vazio | `"X"` | `X` |

⚠️ **O teste que afirmava a regra errada foi INVERTIDO com o motivo escrito, não apagado** — o mesmo tratamento que a heurística do FITID recebeu quando caiu por evidência. **Red-then-green:** com os dois guards de volta, **4 testes acusam**, incluindo *"a linha sumiu — é o bug de 31/08"*. **67 testes de etiqueta** (era 45 antes deste ciclo) · 676 stock verdes · TS 0.

⚠️ **PENDÊNCIA REGISTRADA:** a **régua de calibração da largura** (`LARGURA_CALIBRADA=false`, aviso diz *"pode sair cortada"* e nunca "corta"; um teste trava a hedge). O dono decidiu não rodar a régua ainda — **lembrar quando ele falar da Zebra de novo**. ⚠️ E um **4º teste vermelho** além dos 3 documentados: `producao-invariants > P2` (ordem parada > 24h), **provado pré-existente** com `git stash` contra o HEAD limpo.

## ⭐⭐⭐ EDITOR DE MODELO DE ETIQUETA — O DONO DESENHA (30/08/2026)

**VEREDITO DO ESTUDO, registrado:** o **conteúdo** nosso já era **≥ SuFlex** — lote com **custo real** e QR com **rastro até a nota da SEFAZ**, que eles não têm. **A flexibilidade do modelo era o gap** — e morre aqui. Eles deixam **configurar** (ligar/desligar campo); aqui o dono **DESENHA**: renomeia rótulo (`FAB` → `FABRICAÇÃO`), reordena, muda fonte, põe negrito/destaque, adiciona **linha de texto livre** ("Mantenha congelado", CNPJ, telefone) e cria **vários modelos**, com escolha por item.

**⚠️ TROQUEI COORDENADA FIXA POR FLUXO DE BLOCOS, e a razão é estrutural:** "arrastar pra reordenar" e "adicionar linha" são **impossíveis** com x/y cravados — mover um campo exigiria recalcular o y de todos os outros na mão, e uma linha nova empurraria tudo. **Com fluxo, a ORDEM DA LISTA É O LAYOUT**: o dono arrasta, o sistema calcula.

**⭐ E A FONTE CONTINUA ÚNICA:** `blocosParaLayout` vira posições, e **ZPL e prévia consomem essa saída**. **Prévia do editor == prévia da tela de imprimir == o que sai da Zebra**, nos três lugares, porque os três chamam a mesma função. Testes travam: **reordenar muda os dois na mesma medida**; **desligar tira dos dois**.

**⚠️ AVISA QUANDO NÃO CABE:** com texto livre o dono vai estourar os 480 dots. A prévia ganha borda vermelha e diz o que fazer — **cortar em silêncio seria descobrir só com a etiqueta na mão**.

**⚠️ O MÍNIMO SANITÁRIO AVISA E NÃO TRAVA** (a regra de sempre): desligar a VALIDADE diz *"não atende a Vigilância Sanitária"* e **salva assim mesmo**. **Travar empurraria o dono a escrever a validade à mão numa fita crepe — que é pior, porque sai do sistema.** Sem lote **e** sem QR avisa de rastro; **com QR só, não avisa** (o QR carrega o lote).

**⚠️ SETINHAS ↑↓ EM VEZ DE ARRASTAR:** no celular — onde o dono vai mexer — arrastar dentro de lista que rola **briga com o scroll** e vira frustração. Mesma função, no dedo frio, sem biblioteca.

**⚠️ E LÊ O JSON DO BANCO COM DESCONFIANÇA:** bloco inválido é **descartado** e o resto imprime — melhor etiqueta sem uma linha que produto sem etiqueta.

**⭐ DETALHE DE ZPL que virou teste:** "negrito" **não é uma flag** — é o texto impresso **2× com 1 dot de deslocamento** (o truque padrão da Zebra pra fonte escalável).

**PROVADO EM PROD** com um modelo customizado (texto livre no topo, `MANIP.` no lugar de `FAB`, quantidade desligada, nome maior): os 9 blocos viraram 10, **todo texto da prévia está no ZPL**, cabe na etiqueta, e a tela de imprimir passou a usar o modelo salvo. ⚠️ O modelo da prova foi **removido** depois — o dono cria o dele do zero (REGRA 2).

**32 testes do modelo · 628 stock verdes.**

## ⭐⭐⭐ A TORNEIRA — TELA DE ETIQUETAS COM PRÉVIA EM TAMANHO REAL (30/08/2026)

A fila e o agente eram o **cano**. `/estoque/etiquetas` é a **torneira**: **3 toques** — produto → confere a prévia → imprimir. É a tela que o Cristian abre no celular.

**⭐⭐ UM LAYOUT, DOIS RENDERIZADORES (`lib/stock/etiquetas/modelo.ts`).** O navegador **não renderiza ZPL**, então prévia e impressão são dois renderizadores **por necessidade**. O que dá pra garantir — e é o que o arquivo garante — é que os dois leem o **MESMO layout declarativo** (posição em dots, tamanho, ordem, quais campos entram). Uma segunda lista de campos "igualzinha" divergiria na primeira mudança e **a prévia passaria a mentir sobre o que sai da Zebra**. Testes travam: campo desligado **some dos dois**; a posição da prévia é a **mesma** do ZPL (em % de 480 dots, então é fiel em qualquer tela).

**⭐ A VALIDADE EM DESTAQUE, LOGO ABAIXO DO NOME** — vídeo invertido no ZPL (`^GB` + `^FR`), caixa preta na prévia. **Numa câmara fria, com pressa, ninguém lê a 5ª linha** — e validade lida errado vira comida estragada servida. Lote e colaborador são **rastro** (importam depois, quando alguém investiga); validade é **decisão do momento**.

**⭐ VALIDADE POR ESTADO DE CONSERVAÇÃO** (`stock_item_validade`, CREATE-only, CHECK 1..3650): a mesma carne dura **90 dias congelada, 3 resfriada, 1 em ambiente**. Trocar o estado na tela **recalcula a validade na hora, na prévia**. ⚠️ **Sem dias cadastrados a etiqueta diz "A DEFINIR"** — número inventado numa etiqueta de alimento é o pior lugar possível pra um palpite, **porque a data errada é OBEDECIDA**. A sugestão aparece **marcada como sugestão**, e quantos dias um produto dura é `stock.manage` (decisão de segurança alimentar do dono, não do operador).

**⭐ TODA IMPRESSÃO VIRA REGISTRO** (`stock_etiqueta`: produto, lote, validade, estado, quem, quando). É o que vai **fazer o painel "vence hoje" (2c) e o ciclo de vida (2d) existirem** — sem isso a etiqueta sai e o sistema não sabe que ela existe.

⚠️ **O lote da manipulação nasce do INSTANTE, não do dia:** descongelou de manhã ≠ descongelou à tarde, e o QR precisa distinguir os dois pacotes.
⚠️ **O grid não é o catálogo inteiro** (produzidos + matéria-prima que se manipula): oferecer material de limpeza transformaria a tela de 3 toques num catálogo de 90 linhas.

**PROVADO EM PROD** com a porção de carne real: 49 produtos etiquetáveis, prévia e ZPL saindo da mesma fonte, validade `02/09/2026` marcada como **sugestão** (o dono ainda não definiu os dias dela). ⚠️ **Achado pra afinar:** o grid está **48 matéria-prima × 1 intermediário** — ordenar por "mais etiquetado" faria a tela de 3 toques valer no dia a dia.

**FALTA DESTE SPRINT (não feito, registrado):** a tela `/estoque/etiquetas/modelo` (ligar/desligar campos + teste do modelo — o layout já é declarativo e aceita `desligados`, falta a tela), o override por item de por-pacote/por-lote, e a subida de nível da `/estoque/impressao` (item 4). Depois: **2b** (manipulação avulsa), **2c** (painel vence-hoje) e **2d** (ciclo de vida + QR).

## ⭐⭐⭐ IMPRESSÃO DE ETIQUETA POR FILA — O CELULAR DA COZINHA IMPRIME (30/08/2026)

**⚠️ O PEDIDO ERA "o servidor manda ZPL pro IP da impressora, sem agente preso num computador". ISSO NÃO É REALIZÁVEL, e a razão importa mais que o não:** o servidor roda num **datacenter** e a impressora está na **LAN da cozinha** — conferido no servidor, **não há rota** pra `192.168.x.x`. Fazer o servidor alcançá-la exigiria **expor a porta 9100 na internet**, e **9100 não tem autenticação nenhuma**: qualquer um imprimiria, ou entupiria a bobina de propósito. Pelo navegador também não sai: JS não abre socket TCP, e HTTPS→HTTP local é bloqueado por *mixed content* fora de `localhost` (que é o motivo de o agente antigo só funcionar no PC com o cabo — **do celular, nunca funcionou**).

**⭐ O DESENHO QUE ENTREGA O OBJETIVO DE VERDADE:**
```
celular → app (HTTPS) → FILA no servidor → agente PUXA (conexão de SAÍDA) → impressora
```
- o agente **só faz conexão de saída**: sem abrir porta no roteador, sem IP fixo, sem VPN
- a **FILA** é o que faz a etiqueta **não se perder**: impressora ocupada, sem papel ou desligada → o job **espera e sai depois**, com retry contado
- e com impressora de **REDE** o agente roda em **qualquer máquina da LAN** — deixa de morar no PC com o cabo USB (um Raspberry de ~R$ 150 na tomada serve)

**⛔⛔ DOIS AGENTES NÃO IMPRIMEM A MESMA ETIQUETA.** A trava é `updateMany` com `status: 'PENDENTE'` no WHERE: quem atualiza 0 linhas perdeu a corrida e pega o próximo. **Sem ela, agente no PC + no Raspberry dobrariam cada etiqueta e ninguém descobriria até faltar bobina.** Teste com corrida real (`Promise.all` de dois agentes → exatamente 1 leva).

**SEGURANÇA DO TOKEN:** guardado como **hash** (o segredo mora num PC de cozinha, lugar exposto), aparece **uma única vez** na criação, e o **escopo é mínimo de propósito** — pega ZPL da fila e diz se imprimiu; **não lê estoque, nota nem dinheiro**. Se vazar, o estrago é imprimir etiqueta. Guard de teste trava esse escopo por nome de model.

**⚠️⚠️ ACHADO NA PROVA EM PROD (e teria custado dias):** o **proxy matava a rota do agente antes dela rodar** — `{"erro":"Sessão expirada ou não autenticado"}`, 401. **E o 401 do proxy é indistinguível do 401 de token errado**: dava pra ficar trocando token achando que era credencial. Entrou no `PUBLIC_API` (mesmo padrão do webhook do Asaas, que também valida o próprio segredo). **Guard novo trava a DUPLA dependência**: pública no proxy **+** sem validar token = rota aberta — o teste exige as duas juntas.

**⚠️ E O GUARD DE ROTAS TINHA UM PONTO CEGO:** ele varria só `app/api/empresas/[id]/estoque`, então a rota do agente (que vive em `app/api/estoque/`) seria **invisível** pra ele. Estendido com **allowlist e motivo escrito** — rota nova ali sem entrar na lista quebra o teste.

**PROVADO EM PROD, ciclo inteiro:** cadastro → token gerado → celular enfileira → **agente puxa só com o token** (HTTP 200, sem cookie) → token errado dá **401 seco** (`{"erro":"token inválido"}`) → agente avisa → tela mostra **agente ONLINE** e job **IMPRESSA**. 77 testes no guard de rotas, 601 stock verdes.

**PENDENTE (é do dono):** o **modelo exato da Zebra** — se tem Ethernet/WiFi, o agente sai do PC; se é USB-only (ZD220 base), o print-server de ~R$100 resolve. E o **teste físico**: `node scripts/zebra-agente.mjs --teste`.

## ⚠️⚠️ CONTROLE QUE NINGUÉM RECONHECE COMO CONTROLE É CONTROLE MORTO (30/08/2026)

**O dono não conseguia converter as 36 cartelas de ovo em 1.080 ovos:** *"o título aparece mas não é clicável — não tem botão, não expande. Só o texto solto entre o saldo e a faixa de mín/máx."*

**⚠️ A PERÍCIA DEU UM RESULTADO DESCONFORTÁVEL, e vale registrar exatamente assim:** não havia handler perdido nem componente sem render. O `onClick` **sempre esteve no bundle servido** (`onClick:()=>m(!0)`, lido direto do chunk em prod) e a **API sempre respondeu certo** (36 × 18 → 1.080 × 0,60, valor 648,00 intacto, medido contra o item real). Duas hipóteses do próprio dono — "componente não renderiza" e "colapsável perdeu o handler no deploy" — foram **descartadas por evidência**, não por opinião.

**O defeito era de AFORDÂNCIA:** o gatilho era `text-xs text-slate-400`, **sem borda, sem ícone, com sublinhado só no `hover`** — e **no celular não existe hover**. Ele leu como legenda, e está certo. **O efeito pra quem usa é idêntico ao de um botão quebrado**, e por isso isto conta como bug, não como "questão de estilo". Agora é linha com borda, ícone, **chevron**, verbo no rótulo (*"Converter a unidade"*) e `aria-expanded`.

**⭐ LIÇÃO PRA TODA TELA NOVA:** ação escondida atrás de texto cinza sem afordância **não existe** — principalmente no celular, que é onde o dono opera. Se é clicável, tem que parecer clicável **sem hover**.

**⭐ E A BARRA DE AÇÕES DA POSIÇÃO NÃO ERA FANTASMA — provado pelo dado:** o dono **já tinha mesclado as 2 BOBINAs** às 00:48 (o absorvido está `ativo=false`, marcado "(mesclado)", com o registro em `stock_item_mesclado`, e a Posição mostra **uma linha só: 1,86 UN / R$ 71,27** = a soma exata das duas). A pergunta "está renderizando de verdade?" foi respondida pelo banco, não por suposição.

**7 testes** rodando o caminho que a tela chama (prévia → aplicar) com os números de prod: ledger sem perder linha (3 originais + 3 estornos + 3 novas), procedência por nota preservada (o **E16 segue fechando**) e o fator da nota atualizado. + guard de afordância — **estrutural e assumido como tal**: sem jsdom não dá pra clicar no teste, então ele trava o que quebrou de fato (o gatilho virar texto).

## ⭐⭐ AJUSTE DE QUANTIDADE PERGUNTA · MESCLADO ≠ ARQUIVADO (30/08/2026)

**A ORIGEM DO FANTASMA DO OVO ERA AJUSTE MANUAL, e o dono contou:** *"fui eu: ajustei manual a quantidade pra 360 (12 cartelas × 30 ovos, a conta certa) — e o sistema manteve o custo POR CARTELA (18,00) em cada OVO"*.

**⚠️ A RAIZ É MAIS SUTIL QUE "FALTOU PERGUNTAR", e essa é a lição:** o campo de FATOR de conversão só aparecia quando `uCom` ≠ unidade de controle. No ovo as duas são **"UN"** — cartela UN e ovo UN — então **o caminho certo estava INVISÍVEL** e só sobrou o campo de quantidade. Por isso o gatilho novo é a **RAZÃO entre as quantidades**, não a diferença de unidade.

**O FIX DA CLASSE** (`lib/stock/ajuste-quantidade.ts`, puro, 12 testes): mudou a quantidade → a tela mostra **as DUAS leituras com o número feito**, e pergunta:
- **(a) mesma mercadoria em outra unidade** → valor **INTACTO** (216,00), custo vira **0,60**
- **(b) recebi quantidade diferente** → valor **MUDA** (6.480,00), custo fica 18,00

⭐ Escolher **(a) ZERA a divergência** de propósito — não é mercadoria a mais, é outra régua; o motivo só é cobrado em (b). E **ensina o fator pro mapa**: a próxima nota do fornecedor já entra convertida. Custo em **precisão cheia** (o pão dá 2,3125, que não cabe em 2 casas). Desktop **e celular**, que é onde ele confere.

**⛔ CIRURGIA FEITA (autorizada, `pg_dump pre-cirurgia-ovo-20260830-003415`):** as 2 entradas de `360 × 18` estornadas e relançadas como `12 × 18` — **estorno + novo, nunca UPDATE**. Prod: **732 UN / R$ 13.176,00 → 36 UN / R$ 648,00**, saiu **R$ 12.528,00** de fantasma, e o **E16 foi de 2 achados pra 0**. ⚠️ A cirurgia **NÃO converte pra ovo** — isso o dono faz pela ficha (fator 30) com o custo certo por baixo; misturar "consertar o erro" com "mudar a régua" no mesmo gesto esconderia qual das duas falhou.

**⭐⭐ MESCLADO ≠ ARQUIVADO** (`stock_item_mesclado`, CREATE-only, UNIQUE por item + CHECK anti auto-mescla). O dono: *"o duplicado SOME das listas pra sempre — não é 'arquivar e juntar lixo'"*. **Ele tem razão e são estados diferentes:** o **arquivado** é um item de verdade que saiu de uso e **volta** em "mostrar arquivados"; o **mesclado virou parte de outro** e não volta em lugar nenhum.

⚠️ **A varredura achou o vazamento ANTES de ele mesclar:** com os dois estados sendo o mesmo `ativo=false`, o **Catálogo** (que mostra inativos) traria o absorvido de volta como item normal. `idsMesclados` é o **resolvedor único** que as listas consultam (REGRA 4). A auditoria *"absorveu X"* fica na ficha do **SOBREVIVENTE** — é onde alguém procura ("cadê a outra bobina?"). O **extrato de Movimentos continua mostrando** as linhas do absorvido, e isso é o certo: é o rastro contábil.

**E A RECUSA DO EXCLUIR VIROU BIFURCAÇÃO:** *"tem histórico; se é DUPLICADO use MESCLAR (some das listas); se não se compra mais, ARQUIVAR"* — em vez de só negar e deixar o dono preso com a lista suja.

**555 stock verdes.** PENDENTE (REGRA 2): o dono mesclar as 2 BOBINAs na tela e confirmar que o absorvido sumiu; depois converter o ovo pela ficha.

## ⛔⛔⛔ R$ 12.528 DE ESTOQUE FANTASMA NO OVO — E O INVARIANTE QUE FALTAVA (E16, 29/08/2026)

**O dono pediu três coisas de gestão de itens; a varredura achou dois bugs maiores que o pedido.**

**⛔ ACHADO 1 — o OVO.** O XML das **TRÊS** notas da CIA DA FRUTA diz `12 UN × R$ 18,00 = R$ 216,00`. O ledger tem:

| movimento | qtd | custo unit | total | bate? |
|---|---|---|---|---|
| 28/08 | **360** | 18,00 | **6.480,00** | ❌ 30× |
| 28/08 | **360** | 18,00 | **6.480,00** | ❌ 30× |
| 29/08 | 12 | 18,00 | 216,00 | ✓ |

A quantidade foi convertida (12 cartelas × 30) e **o custo não acompanhou** — em vez de converter (**valor intacto**), multiplicou o valor por 30. **R$ 12.528,00 de estoque que não existe.** ⚠️ **NÃO corrigido**: investigação read-only, correção é decisão do dono — e é por isso que a resposta ao pedido "reunitizar o ovo com fator 30" foi **não faça ainda**: converter agora transformaria 732 em 21.960 ovos e o fantasma junto.

**⛔ ACHADO 2 — o custo unitário era ARREDONDADO antes de multiplicar.** `round2(vUnCom/fator)` × quantidade: com **6.313 caixas de pizza**, 2,74 no lugar de 2,742145… = **R$ 12,63 a menos** que a nota, numa linha só; o mesmo padrão em 8 notas. **É a regra que o módulo já tinha aprendido DUAS vezes** (conclusão de produção; reunitização do pão, 2,3125): **o ledger guarda precisão cheia, quem arredonda é a leitura.** Corrigido na fonte — agora `qtdRecebida × (vUnCom/fator) == qCom × vUnCom == vProd` **exato**.

**⭐⭐ E16 — O INVARIANTE QUE NÃO EXISTIA:** `Σ(ENTRADA_NF + ESTORNO) da nota == Σ(vProd) dos itens`. **O E2 conta LINHAS; VALOR ninguém olhava** — foi o buraco por onde os 12,5 mil passaram.
- ⚠️ **Conta o LÍQUIDO, e o ESTORNO tem tipo próprio.** Esquecer isso acusa toda correção legítima: na minha 1ª varredura a reunitização do pão apareceu como *"+1.775,96"* e era o **método do módulo funcionando**. Foi o terceiro rodeio da mesma query até acertar — a lição do E2 ("invariante que conta linha em ledger imutável envelhece mal") vale igual pra quem soma VALOR.
- ⚠️ **A tolerância é o LIMITE MATEMÁTICO do arredondamento** (`0,005 × Σ|quantidade|`, piso de 5 centavos), não um número escolhido a dedo: meio centavo por unidade é o pior caso do custo a 2 casas. Régua fixa em centavos alarmaria o **0,07 da Cancian** e o **0,09 da Menon** toda noite. **Troca consciente registrada:** os R$ 12,63 da BOX PAPER cabem na folga — quem fecha esse flanco é a **fonte** (precisão cheia), não a régua; e 6.264 em 12 unidades **não escapa** (folga de 1,80).
- **PROVADO EM PROD:** o juiz nomeou as duas notas da CIA DA FRUTA com o valor e a explicação.

**⭐ 1 — MESCLAR DUPLICADOS (as 2 BOBINAS).** A mesma nota trouxe o produto em duas linhas e **cada uma criou seu item** (0,93 e 0,926 UN). Mesclar: saldo soma, **valor soma AO CENTAVO** (conferido em runtime, não prometido), custo médio ponderado. **Ledger imutável**: estorno no absorvido + movimento igual no sobrevivente **preservando `nfeChave`** → o **E16 continua fechando** (mesclar não vira alarme). Mapas de nota/venda e fichas migram. ⛔ **Unidade diferente NÃO mescla** (somar KG com UN inventa número) — a saída é reunitizar antes.
**A PREVENÇÃO É NA FONTE:** a conferência criava um item por linha **sem olhar se outra linha da MESMA nota já tinha criado aquele nome** (o `POST /itens` já deduplicava, mas a conferência não passa por ele). Agora um nome vira UM item e as duas linhas viram dois **movimentos** — o saldo soma, que é o certo.

**⭐ 2 — ARQUIVAR / EXCLUIR.** Sem movimento nenhum → **exclui de verdade**; com histórico → **arquiva** (some da Posição e da busca de receita; ledger intacto). ⚠️ **Arquivar não é zerar**: item com saldo ≠ 0 ou em ficha ATIVA exige confirmação, com o valor e o nome da ficha na mensagem (**409 "confirmar", não 500 "erro"**). A Posição passou a filtrar arquivados — e os **checkboxes que já existiam e não faziam nada** ganharam a barra de ações (mesclar 2 · arquivar N), com prévia obrigatória do antes/depois.

**⚠️ DEBATE DE RÉGUA que virou comentário no código:** o saldo do módulo anda em **2 casas** (`saldoItem`), então 0,93 + 0,926 = **1,86**. Eu tinha "melhorado" a prévia pra 1,856 — e isso faria a prévia dizer um número e a Posição outro. **A prévia fala a MESMA língua da tela que ela prevê.** O custo médio derivado desliza 8 centavos por causa do denominador arredondado (71,27 ÷ 1,86 = 38,32): **a garantia é o VALOR**, e ela vale.

**33 testes novos · 533 stock verdes.** ⚠️ Achado no caminho: um arquivo de teste **vazio** que eu tinha criado por engano numa exploração (`nfe-invariants.test.ts`) estava fazendo a suíte do estoque falhar — removido.

## ⭐⭐⭐ O COMBINADO ≠ A NOTA — RENEGOCIAÇÃO PÓS-NOTA (29/08/2026)

**CASO REAL BOX PAPER (R$ 10.400,66).** A NF-e traz **3 duplicatas** (3.466,88 · 3.466,88 · 3.466,90). O dono falou com o fornecedor: os 3 boletos foram **cancelados** e vieram **4 novos**. **A nota não muda — é da SEFAZ, assinada. O que mudou foi o combinado.** A conferência só sabia COPIAR as duplicatas do XML, então o financeiro ficaria cobrando um acordo que não existe mais.

**⚠️ NENHUM DOS DOIS SOBRESCREVE O OUTRO** — é a mesma regra do "itens digitados do DANFE não apagam o XML" e do "categoria é decisão do dono":
- `stock_nfe_dup` → **o que a NOTA diz** (3 parcelas, imutável, da SEFAZ)
- `stock_parcela_combinada` → **o que foi COMBINADO** (4 parcelas, decisão do dono, com `origem` XML|RENEGOCIADO + motivo + quem + quando)

Os dois ficam visíveis na tela. Inventar que a nota tem 4 duplicatas seria mentir sobre um documento fiscal assinado.

**⭐ VALIDAÇÃO AVISA, NÃO TRAVA:** desconto e juros de renegociação são o mundo real, não erro de digitação. Quando a soma diverge do total da nota, o sistema exige um **motivo curto** e segue — travar empurraria o dono a lançar por fora, o pior dos mundos. **Trava só o que impede a conta a pagar de existir**: valor ≤ 0, vencimento ausente, número repetido, lista vazia. ⚠️ **Vencimento no passado é AVISO** — renegociação de boleto atrasado é justamente o caso mais urgente.

**RESOLVEDOR ÚNICO (REGRA 4):** `combinadoDaNota()` é a única função que responde *"quais parcelas valem hoje?"* — conferência, ponte, tela de boletos e juiz chamam ELA. Sem renegociação ela devolve as próprias duplicatas do XML, então o caminho comum não muda. **E a fila de trabalho (`stock_payable_suggestion`) anda na MESMA transação**: sem isso a tela mostraria 4 e mandaria 3 — dois lugares respondendo a mesma pergunta, a doença que este módulo mais paga.

**DEPOIS DE ENVIADO** (`renegociarParcelasDaNota`): cancela as contas **pendentes** daquela nota e recria com o combinado novo, **tudo numa transação só** (em duas, uma falha no meio deixaria o dono sem as velhas e sem as novas). Apaga a amarra junto com a conta — deixar o link criaria alerta F2 falso todo dia; o rastro do combinado anterior vive nas linhas **inativas**. **⛔ CONTA JÁ PAGA OU CONCILIADA BLOQUEIA**, nomeando qual: dinheiro que já saiu não se reescreve.

**⭐ NUMERAÇÃO `R01..Rnn`** — nunca colide com `001..003` do XML, que é o que mantém o `@@unique(companyId, origem, refId, nDup)` do `stock_payable_link` funcionando quando a mesma nota mandou parcelas antes e manda de novo agora.

**JUIZ F4 — A RÉGUA MUDOU:** mede contra o **COMBINADO vigente**, não contra as duplicatas cruas. ⚠️ A régua velha acusaria **toda renegociação legítima** como erro — e alarme falso repetido é como um alarme morre (a lição dos 111 alarmes de vendas). F4 **erro** = combinado × financeiro discordam; F4 **aviso** = soma difere da NOTA **sem motivo escrito** (o número sem o porquê vira mistério pro contador em três meses).

**⚠️ ERRO MEU, PEGO ANTES DE COMMITAR:** eu tinha deixado `reenviar: true` fixo, o que faria **editar parcelas de uma nota ainda não enviada CRIAR conta a pagar sozinho** — furando a fronteira de papel do módulo (*"enviar boleto é obrigação financeira, é decisão do dono"*). Agora só recria o que foi cancelado.

**⚠️⚠️ E O DEPLOY QUEBROU POR UMA LACUNA REAL DO GATE — que teria mordido em TODA migration futura.** O build falhou com *"Property 'stockParcelaCombinada' does not exist on type 'PrismaClient'"*. **A causa:** o `node_modules` do workspace de build é hard-linkado e **só é refeito quando o `package-lock` muda** — mas o `prisma generate` **substitui os arquivos de `.prisma` (inodes NOVOS)**, então os hard links do workspace seguiam apontando pro client **velho**. Medido: o app tinha **380** referências ao modelo novo, o workspace **ZERO**. O gate garantia o *provider* do client, nunca que ele tivesse os *modelos* do schema. Fix: re-linkar `.prisma` e `@prisma/client` a cada deploy. **⭐ O DESENHO BLUE-GREEN SEGUROU: build falhou, symlink não moveu, prod seguiu no ar intacto** — falha de build continua sendo não-evento pro cliente.

**PROVADO EM PROD** (handler real, nota `cmtan0d65…`): GET devolve *"a nota diz 3"* e *"o combinado hoje: 3 [XML], soma 10.400,66, fecha SIM, renegociado: não"*. **29 testes** (13 puros + 8 de integração ponta a ponta + 4 de F4 red-then-green), 486 stock verdes, migration CREATE-only com 3 CHECKs + índice único parcial, `pg_dump pre-combinado-renegociacao-20260829-150818` antes.

**⚠️⚠️ E O USO REAL PEGOU O BUG QUE OS TESTES NÃO PEGARAM — REGRA 4, DE NOVO, NO MESMO SPRINT.** O dono ajustou as parcelas, confirmou, voltou pra tela da nota e viu **as 3 do XML**: *"sem erro, sem aviso"*. **A classe proibida ("nunca falha em silêncio"), pela segunda vez.**

**A perícia foi curta e o dado respondeu:** o combinado **GRAVOU** — 5 linhas `RENEGOCIADO` de 2.080,13 em prod, 18:29:10. **A falha era de LEITURA.** `buildConferenceView` lia **`stock_nfe_dup` DIRETO**, virando um **SEGUNDO leitor** de *"quais parcelas valem"* — bem depois de eu ter criado `combinadoDaNota` justamente pra ser o resolvedor único e tê-lo ligado no confirmar e na tela de boletos. **⚠️ E os meus testes passavam porque conferiam a GRAVAÇÃO, nunca o que a TELA carrega** — a lição do contrato quebrado do Dashboard PF, na mesma semana.

**A varredura achou uma SEGUNDA vítima da mesma régua:** o **E3** do juiz contava as duplicatas cruas, então renegociar 3 → 2 viraria *"3 duplicatas mas 2 sugeridas"* **toda noite**. Corrigido junto (mesma correção do F4).

**O teste que faltava roda o CAMINHO DA TELA** (`buildConferenceView → salvar → buildConferenceView`), com red-then-green medido: com o bug de volta, *"expected length 4 but got 3"*. E a tela ganhou o **selo "renegociado"** + a linha *"A nota diz 3 parcelas: …"* — sem isso o dono ajusta, volta e **não tem como saber se pegou**.

**⭐ UX — O SISTEMA DIVIDE, O DONO AJUSTA** (`dividir-parcelas.ts`, 15 testes): adicionar/remover **redistribui o total em partes iguais com o resto de centavos na ÚLTIMA** — exatamente como a nota real faz (3.466,88 + 3.466,88 + **3.466,90**). Não é estética: espalhar o centavo de outro jeito faria a soma não fechar e a validação cobraria motivo **por arredondamento nosso**. Data nova = **+30 dias** da anterior. ⚠️ **Editar UM valor NÃO redistribui os outros** — senão "entrada maior" seria impossível de digitar (cada número corrigiria o anterior). ⚠️ **Sem nenhuma data, não inventa a primeira**: a 1ª é a do boleto, e chutar "hoje+30" criaria vencimento falso com cara de combinado.

**PROVADO EM PROD depois do fix** (`buildConferenceView` contra a nota real): selo **renegociado SIM** · combinado **5 × 2.080,13 = 10.400,65** · referência **"a nota diz 3: 3.466,88 · 3.466,88 · 3.466,90 = 10.400,66"**. 505 stock verdes.

**PENDENTE (REGRA 2):** o dono refazer o combinado na tela com os valores reais dos boletos novos e enviar pro Contas a Pagar. As 5 parcelas de 2.080,13 são a gravação do teste dele — ficam até ele refazer (renegociar de novo substitui e guarda o histórico).

## ⭐⭐ AS TRÊS TELAS — O IMPORT FECHOU (29/08/2026)

Os motores estavam prontos e testados desde 28/08, mas viviam **só no juiz noturno**: o dono só sabia por e-mail. **Saldo sem procedência parece conferido** — que é exatamente como um buraco vive semanas em silêncio.

**1. SELO DE CONFERÊNCIA nas Contas** (`conferenciaDasContas` no `GET /api/contas-bancarias`, badge no card). Três estados, nenhum deles silêncio: **✓ conferido com o banco em DD/MM** · **⚠ divergente em R$ X desde DD/MM** · **○ nunca conferida**. ⚠️ *"Nunca conferida" NÃO é defeito* — cofre e banco caixa são manuais; é informação que antes ficava **presumida**. **Falha macia**: se a conferência estourar, a lista de contas abre sem selo — diagnóstico não pode derrubar a tela principal. **PROVADO EM PROD** (handler real, sessão do dono): banrisul −6.267,03 ✓ · sicredi −79.768,15 ✓ · stone 860,57 ✓ (os três conferidos em 28/08) · caixa loja/cofre 39.714,73 ○ · banco caixa −3.248,46 ○.

**2. AVISO DE EXPORT DE MESMO DIA** (`lib/ofx/export-mesmo-dia.ts`, pura, 9 testes) — o caso de 28/08 15:09. **Tom NEUTRO de propósito** (slate, não vermelho): não manda parar, e diz explicitamente que **importar agora é seguro** — o que faltar entra no próximo extrato **sem duplicar** (a dedup é data+valor+memo). *Aviso que manda parar sem motivo vira aviso que o dono aprende a ignorar.* ⚠️ **É AVISO DE TELA, nunca decisão** — por isso ele PODE olhar o relógio (o princípio é *"o relógio serve pra exibir 'hoje' na tela, nunca pra decidir"*). Se um dia virar critério de descarte, tem que sair de lá.

**3. DIAGNÓSTICO GUIADO no preview** (`ondeDescolou` ligado no payload). O gate já dizia *"não bate, dif X"*; **faltava a pergunta que leva a uma AÇÃO: desde quando.** Roda **só quando o gate acusa** (no verde seria ruído e custo) e é fail-soft. A frase diz o intervalo, o valor e o que fazer — e acrescenta que **a divergência é anterior ao arquivo, então importar agora não piora nada**.

Os dois banners ficam **na PÁGINA**, acima dos previews V2 e V3 — um lugar, não um por componente (REGRA 4).

**⚠️⚠️ BUG MEU, ACHADO NA PROVA EM PROD E NÃO NO CÓDIGO — "N caminhos, 1 esquecido", 15 minutos depois de eu escrever o código.** O preview tem **TRÊS returns** (legado · **re-import vazio** · V2) e eu devolvi o aviso só no do V2. O re-import vazio é justamente o caso em que o dono vê *"nenhuma transação nova pra importar"* — e a pergunta dele é **"é porque o dia não fechou?"**. Sem o aviso ali, a tela cala na hora em que mais precisa falar. Agora é calculado **uma vez** logo após a âncora e devolvido nos três. **Guard estrutural** (`preview-avisa-em-todo-caminho.test.ts`): quem devolve `bankProfile` devolve o aviso — caminho novo sem ele fica vermelho. ⚠️ **E notei porque a prova em prod foi ATRÁS DO PAYLOAD REAL, não do meu raciocínio**: o campo veio `null` e eu ia escrever "o gate fechou"; era o gate nem ter rodado.

## ⭐⭐ CATÁLOGO DE MANIAS DO STONE (29/08/2026) — abre com "MEMO DE BANCO MENTE"

`lib/ofx/__tests__/catalogo-manias-stone.test.ts`, irmão do catálogo do Banrisul: **mexeu no import, roda tudo de novo.**

**⭐⭐ MANIA 1 — o memo diz `"<NOME> - Transferência|Pix"` em TODO PIX**, seja transferência entre contas próprias ou **pagamento a uma pessoa**. A palavra "Transferência" ali é o **nome do produto do banco**, não a natureza do lançamento.

⚠️ **E quem caiu nessa fui EU:** na auditoria das marcações perdidas rotulei **3 PIX do Stone como "transferência"** porque o memo dizia isso — eram pagamentos a pessoas físicas. O dono corrigiu. **É a mesma família do que já está registrado aqui em outro lugar** (*"descrição livre não é fonte de verdade, a categoria é"*, *"OP.CREDITO C/GARANTIA não é empréstimo"*) e do princípio duro do import: **heurística sobre texto livre pode SUGERIR, nunca DECIDIR**.

**O que decide é ESTRUTURA** — e o motor único já faz certo, o que o catálogo trava: CNPJ próprio no memo → **camada 1 (0.99)**; nome de sócio cadastrado → **camada 2 (STRONG)**, nunca promove a camada 1; nome de terceiro sem sinal próprio → **não sugere**. O teste inclui o **contrafactual**: `/transfer/i` sobre a descrição dá `true` pros DOIS casos — a palavra não carrega a informação.

**⭐ E A LIÇÃO GERAL, que vale pra qualquer banco:** o memo é **texto de produto**, não classificação. Ele pode SUGERIR (na tela, pro dono confirmar) e nunca DECIDIR — mesma regra do FITID, da categoria e da descrição livre.

**As outras (todas executando comportamento, não grep):** favorecido vem no MEMO (não precisa de PDF) · **homônimo não passa por sócio** (o nome tem que ser o completo cadastrado) · FITID é **UUID estável** — o oposto do Banrisul — e mesmo assim a identidade da linha é data+valor+memo, sem FITID · ACCTID vem **formatado com hífen** · não lista futuro (nada descartado por data) · **dois downloads do mesmo dia divergem** no LEDGERBAL (o "70k" aberto desde 12/08): a linha repetida dá a **mesma stableKey** e não duplica; o desempate do saldo é do juiz, não do parser — o parser reporta o declarado sem escolher.

## ⛔⛔⛔ PRINCÍPIO — HEURÍSTICA NUNCA DECIDE DESCARTE EM SILÊNCIO (29/08/2026)

> **HEURÍSTICA PODE SUGERIR** (na tela, pro humano confirmar).
> **HEURÍSTICA NUNCA DECIDE DESCARTE/DESTINO EM SILÊNCIO.**
> **Descarte só por REGRA DETERMINÍSTICA sobre campo DECLARADO.**

Nasceu do `FITID == YYMMDD`: a regra funcionou nos arquivos da época, **armou**, e explodiu num débito real de R$ 2.444,62. Heurística que decide sozinha não falha no dia em que nasce — falha no dia em que o banco muda de humor.

**REGRA ÚNICA DO FUTURO:** `futura ⟺ DTPOSTED > âncora`, com âncora = `max(DTASOF, DTEND)`. **Nada mais.** O `fitidLooksLikePreview` continua na assinatura por compat e é **ignorado** (`void`).

**VARREDURA (o que achei além do FITID):**
| onde | o que faz | veredito |
|---|---|---|
| `is-preview` / `future-line` | FITID==YYMMDD | ⛔ **era descarte silencioso — DESLIGADO** |
| `opening-balance.isOpeningBalanceMemo` | filtra tx NOSSAS de "SALDO INICIAL/ABERTURA" do pool de conciliação | ⚠️ heurística de memo, mas **só sobre tx do banco de dados, nunca sobre linha do arquivo** — não some linha. Registrado |
| `import-orchestrator` → `detectCardPayment` | marca `isCardPayment` por descrição | ✅ **classifica, não descarta** — reversível pelo dono |
| `parser.ts` | derruba linha sem FITID/data/valor | ✅ **determinístico sobre campo declarado E reportado** (`errors[]` vai pra tela) |

**⭐ BURACO FECHADO NA BORDA DO PARSER (achado nesta varredura):** a conciliação de destinos que eu tinha feito contava linhas **PARSEADAS** — linha derrubada no parser **morria antes de ser contada**, invisível pra qualquer conferência posterior. Agora o parser devolve **`totalBlocos`** (quantos `<STMTTRN>` o ARQUIVO tinha) e a conta é `blocos == novas + já existem + futuras + ignoradas + **ilegíveis**`.

**CICLO DO AGENDADO (o CONSÓRCIO de 09/09):** sai do import listado com o motivo (data > âncora) e, quando POSTAR num export seguinte — **possivelmente com FITID renumerado, mania conhecida do Banrisul** — entra **uma vez**, porque o `stableKey` é data+valor+memo e **não usa FITID**. Travado por teste, inclusive o contrafactual ("se a dedup usasse FITID, entraria duas vezes"). ⚠️ E a decisão é **now-independente**: o mesmo arquivo importado hoje, amanhã ou em 2027 dá o mesmo resultado.

**⭐ CATÁLOGO DE MANIAS DO BANRISUL** (`lib/ofx/__tests__/catalogo-manias-banrisul.test.ts`) — **mexeu no import, roda tudo de novo.** 6 manias + o invariante do parser: FITID no formato da data · grafia dupla `OP.CREDITO`/`OP. CREDITO` no mesmo arquivo · FITID renumerado entre downloads · agendado no meio do extrato · LEDGERBAL como âncora (com DTASOF curto) · export de mesmo dia incompleto. ⚠️ Fixtures **derivadas dos blobs reais mas escritas à mão**, com os valores reais e memos genéricos — nome de pessoa não entra (LGPD, e nenhuma decisão depende dele).

**BLOBS (a matéria-prima da perícia — foi o blob que provou a verdade):** **0 purgados** · **todo import de OFX desde 13/08 tem blob** (a coluna nasceu naquela data; os 82 sem blob são anteriores, o mais recente de 26/07) · **12 de 12 re-parseiam batendo exato** contra o parser atual, com `blocos == parseadas + erros` em todos.

## ⛔⛔⛔ INCIDENTE 28/08 — LOGIN 500 POR 8 HORAS COM O TRIO VERDE. O GATE PROVAVA PRESENÇA, NÃO SAÚDE.

**O ERRO FOI MEU, e a lição vale mais que ele.** No comando de deploy da rodada anterior rodei `git reset --hard` (que **reverte `prisma/schema.prisma` pra `sqlite`** — o swap-postgres é passo MANUAL do runbook) e em seguida `npx prisma generate` **sem o swap**. Como o **`node_modules` é COMPARTILHADO por hard link** com o workspace de build, o client gerado virou SQLite; o app subiu com ele e **toda query ao banco morria**: *"the URL must start with the protocol `file:`"*. Log real: `[LOGIN] Erro interno: PrismaClientInitializationError`.

**⚠️⚠️ O PIOR NÃO FOI O ERRO — FOI O TRIO FICAR VERDE 8 HORAS.** BUILD_ID ok · pm2 online, uptime 28.557s, sem loop · CSS servindo do build novo. **A home é ESTÁTICA e respondia 200 enquanto o login dava 500.** O gate provava que o site era **SERVIDO**, nunca que ele **FALAVA COM O BANCO**. *Gate que não enxerga banco fora do ar não é gate de saúde — é gate de presença.*

**⚠️ E O ROLLBACK NÃO RESOLVERIA** (o dono pediu "rollback imediato", e a resposta certa era outra): o build estava **íntegro**; o quebrado era o **client gerado, compartilhado por TODOS os builds**. Voltar de build daria um `✓ ROLLBACK OK` com o site ainda quebrado — mentira no pior momento possível. **Fix real:** `swap-prisma-to-postgres.sh` + `prisma generate` + `pm2 restart` (o client em disco já estava certo desde a correção anterior; era o PROCESSO que segurava o antigo em memória).

**AS 3 CAMADAS PRA NUNCA VOLTAR:**
1. **IMPOSSÍVEL POR CONSTRUÇÃO (REGRA 5)** — o `deploy.sh` confere o provider do schema, **roda o swap sozinho** se preciso, gera e **ABORTA** se o client não ficar `postgresql`. O swap deixou de depender de alguém lembrar. **PROVADO:** deployei de propósito **sem** o swap manual e o log disse *"schema em 'sqlite' — rodando o swap pra postgres → ✓ prisma client em postgresql"*.
2. **PROVADO EM RUNTIME** — o trio virou **4/4**: sonda que faz **POST no login com credencial proposital inválida e exige 401**. 500 = banco inalcançável. Sem senha real, sem efeito colateral, sem criar nada. **O `rollback.sh` ganhou a mesma sonda** e, se o login seguir quebrado depois de voltar, ele **diz que a causa não era o build** e aponta o Prisma.
3. **AUDITADO POST-FACTUM** — **D4** no juiz noturno: provider do client gerado ≠ provider do schema = **erro**, com o comando que resolve **e** o aviso de que rollback não adianta.

⚠️ **PEGADINHA que me enganou na 1ª leitura:** `grep "provider ="` no schema devolve **`prisma-client-js`** (do bloco `generator`), não o do `datasource`. `extrairProviderDatasource` lê o bloco certo — e tem teste pra isso.

**PROVA DE VOLTA (28/08):** login **401** com a mensagem correta (local e pelo IP público) · home 200 · deploy **4/4 verde** · juiz **D1-D4 🟢 0 achados**. 9 testes novos.

⚠️ **ACHADO À PARTE (pré-existente, NÃO é a queda):** `contaia.com.br` **não tem registro DNS** (`dig` vazio) — prod é acessado por **`http://198.211.103.10`**. O `smoke` que testa o domínio sempre devolveu 000. Resolver quando for publicar o domínio.

## ⛔⛔ DEPLOY QUE NUNCA DERRUBA PROD (26/08/2026) — USE `scripts/deploy.sh`

**Regra do dono:** com cliente pagando, *"deploy quebrou o site" NÃO PODE EXISTIR como categoria de evento.*

**A CAUSA COMUM DOS 3 INCIDENTES ERA UMA SÓ: o build mexia no diretório VIVO.**
| quando | o que matou o build | o que o cliente viu |
|---|---|---|
| 24/08 | `npm run build \| grep \| head` → **SIGPIPE** no meio da escrita do `.next` | pm2 em loop, site fora |
| 24/08 | **OOM killer** no type-check (servidor sem swap) | idem |
| 26/08 | build escreveu **por cima do `.next` que o pm2 servia** | **página sem CSS** por segundos |

⚠️ O incidente de 26/08 tem o log exato: `CSS 404 às 16:35:00` → `200 às 16:36:56`. Janela de troca. **Não foi OOM** (build completou, swap em 68 MB) e **não foi build parcial** — o build estava íntegro. Foi o instante da substituição. E o navegador do dono guardou a página quebrada em cache; um hard-reload já resolvia.

**O DESENHO NOVO — o build não encosta no que está no ar:**
```
.next                       → SYMLINK
.next-builds/<stamp>-<sha>  → onde cada build mora (mantém os 3 últimos, 155 MB cada)
```
`next.config.mjs` ganhou `distDir: process.env.NEXT_DIST_DIR || '.next'`. O build vai pro diretório novo; **só depois de PROVADO pronto** o symlink troca (`mv -T` de symlink é `rename(2)` — não existe instante "meio trocado"). **Build que falha por qualquer motivo não move o symlink: prod continua no build anterior INTACTO.** Falha de build virou não-evento pro cliente.

**GATE ANTES:** memória disponível ≥ 2200 MB, swap ≥ 1 GB, disco ≥ 2 GB. **Abortar cedo é melhor que deixar o kernel matar no meio** — build morto pela metade foi o que quebrou prod em 24/08.
**VERIFICAÇÃO DO ARTEFATO:** BUILD_ID existe + tem CSS + tem `server/`. Sem os três, apaga o build e nem troca.
**GATE DEPOIS — O TRIO (só declara sucesso com os três):** (1) BUILD_ID servido == o buildado; (2) pm2 `online` **e o MESMO processo depois de 10s** — ⚠️ em 24/08 o smoke passou VERDE com o processo em loop, porque o nginx ainda servia a resposta do processo anterior; uptime crescendo é o que distingue "no ar" de "reiniciando sem parar"; (3) **TODOS** os CSS que o HTML referencia respondendo 200 **e vindos do build novo** — o smoke antigo checava só o primeiro que achava, e a home pede dois.

**⏪ ROLLBACK EM UM COMANDO — `bash scripts/rollback.sh`** (segundos, sem rebuild). `--lista` mostra os builds; `<nome>` volta pra um específico. Roda o mesmo gate depois.

**JUIZ D1/D2/D3 (`lib/infra/deploy-health.ts`)** no cron das 3h: **D1 (erro)** `.next` sem BUILD_ID ou sem CSS — os dois estados que derrubaram prod; **D2 (aviso)** `.next` virou diretório real (alguém buildou por cima do vivo) — ⚠️ **isso o smoke NUNCA pegaria**: responde 200 normalmente e mesmo assim jogou fora a troca atômica e o rollback; **D3 (aviso)** menos de 2 builds guardados = rollback exigiria rebuild. D1 não empilha com "sem CSS" (uma causa, um alerta — mesma disciplina do N1/N3).

**⚠️ O DESENHO SE PAGOU NO PRIMEIRO DIA: 3 builds falharam em sequência e prod não sentiu um segundo.** As causas, todas descobertas em 26/08 tentando fazer o build sair do diretório vivo: (1) **`distDir` aninhado** (`.next-builds/<sha>`) — o Next gera os arquivos de tipo com caminho relativo de 3 níveis assumindo profundidade 1; (2) **`distDir` plano** — mesma morte, e aí veio a causa REAL: o **`tsconfig.json` inclui `.next/types/**/*.ts`**, então com qualquer `distDir` diferente o TypeScript lê o `validator.ts` **VELHO** do build anterior. Não dá pra contornar por configuração; (3) **`node_modules` por SYMLINK** no workspace — o **Turbopack recusa** ("Symlink [project]/node_modules is invalid, it points out of the filesystem root"). **SOLUÇÃO:** buildar numa **CÓPIA do repo** (`/opt/conta-ia-build`, `rsync` sem node_modules/.next), com **node_modules por HARD LINK** (`cp -al` — instantâneo, mesmo inode, e é diretório de verdade), o `.next` PADRÃO lá dentro, e `mv` do artefato pronto pro lado do app (mesmo filesystem = rename). ⚠️ **`NEXT_DIST_DIR` continua no `next.config.mjs` como escape hatch, mas o deploy NÃO o usa** — o comentário lá explica por quê.

**⚠️ NÃO rodar `npm run build` na mão no servidor** — volta a escrever no diretório vivo e o D2 vai acusar. Use sempre `bash scripts/deploy.sh`.

**MEMÓRIA — leitura DURANTE o build de 26/08 (o gatilho (b) NÃO disparou):** memória disponível no pico **431 MB** de 3.915 · swap **68 MB** de 2.047 · **zero OOM kills**. O build come ~3,5 GB e sobrevive, mas com ~11% de folga. O gatilho (b) do upgrade 4→8 GB é *"swap usado em operação normal, FORA de build"* — swap está em 68 MB, bem abaixo dos 256 MB do N1. **Não disparou.** ⚠️ E com o deploy em diretório separado, um OOM durante o build passou a ser **inofensivo** (o symlink não move): a urgência do resize CAIU. O gatilho que continua valendo é o **(a)** — a rotina real começar.

## Ordem de deploy (PJ + PF)

**⚠️ SWAP DE 2GB É OBRIGATÓRIO NO SERVIDOR (25/08).** O `npm run build` do Next roda o type-check num worker que chega a **~1,9 GB de RSS**; o servidor tem 3,9 GB e estava **sem swap nenhum** → o OOM killer matava o worker (`signal: SIGKILL`) e o `.next` ficava **sem `BUILD_ID`**, deixando o pm2 em loop de erro. **Não adianta mexer no `--max-old-space-size`:** teto alto (2560) o kernel mata igual; teto baixo (1400) o próprio V8 aborta por heap insuficiente (`SIGABRT`) — o type-check PRECISA de ~2 GB. Criado em 25/08: `fallocate -l 2G /swapfile && chmod 600 && mkswap && swapon` + linha no `/etc/fstab` (persiste no reboot). Build voltou a passar de primeira. **Servidor novo nasce quebrado sem isso** — incluir no provisionamento junto com o poppler. Pra desfazer: `swapoff /swapfile && rm /swapfile` + tirar a linha do fstab.

**⭐ GATILHO DO UPGRADE 4 → 8 GB (combinado com o dono em 25/08).** Hoje o droplet é **DigitalOcean `s-2vcpu-4gb` em nyc1** (2 vCPU · 3,9 GB RAM · 116 GB disco) + 2 GB de swap. Fica assim **enquanto é fase de teste**. **Sobe pra 8 GB quando o PRIMEIRO destes disparar:** **(a)** a rotina real começar (Cristian operando + contagem inicial feita + notas entrando todo dia); **(b)** o **swap for usado em operação normal, fora do build** — é o invariante **N1** do juiz, que avisa por e-mail sozinho; **(c)** entrar o **segundo cliente**. **PASSO-A-PASSO (DigitalOcean):** painel → o droplet `contaia-prod` → **Resize** → escolher **"CPU and RAM only"** (⚠️ NÃO "Disk, CPU and RAM": a que mexe em disco é **irreversível**, não dá pra voltar; a de CPU/RAM é reversível) → escolher o plano de 8 GB → o painel **exige desligar o droplet antes** (Power Off) → Resize → Power On. **DOWNTIME estimado: 2 a 5 minutos** (desligar + redimensionar + bootar), mais ~15s de boot do pm2 — o pm2 sobe sozinho no reboot. É janela curta, mas é queda: **combinar horário com o dono**, nunca em horário de recebimento de nota. **Depois do upgrade:** conferir `free -m` (tem que dizer ~8 GB), rodar `npx tsx scripts/cron-judge.ts` e ver o N1/N2 verdes, e **manter o swap** (ele deixa de ser muleta e vira rede).

**Dependência de SISTEMA (não-npm):** `poppler-utils` (binário `pdftotext`) — usado pelo enriquecimento de contraparte por PDF (`lib/bank-statement-pdf/extract-pdf-text.ts`, único ponto que invoca poppler). **Servidor novo nasce quebrado sem isso** — incluir no provisionamento: `apt-get install -y poppler-utils`. Validar com `which pdftotext`. Instalado no CAIXAOS em 31/07/2026.

Sequência **crítica** (bug pego na Fatia 1 quando `npm ci` rodou `prisma generate` antes do swap):

```
# ANTES do pull: descartar o swap-postgres local (senão o pull ABORTA calado).
# ⚠️ O lock é prisma/migrations/migration_lock.toml (NÃO prisma/migration_lock.toml).
git checkout -- prisma/schema.prisma prisma/migrations/migration_lock.toml
git pull origin main
./scripts/swap-prisma-to-postgres.sh       # troca schema sqlite→postgres
npm ci --legacy-peer-deps
npx prisma generate                         # ⚠️ DEPOIS do swap
npx prisma migrate status                   # confirma migrations pendentes
npx prisma migrate deploy                   # aplica
npm run build
pm2 reload conta-ia --update-env
pm2 list | grep conta-ia                    # confirma online
bash scripts/smoke-deploy.sh                 # ⚠️ OBRIGATÓRIO — home 200 NÃO basta
```

`pg_dump -Fc` em `/var/backups/conta-ia/pre-<sprint>-YYYYMMDD-HHMMSS.dump` **antes** de toda migration.

- **⚠️ "HOME 200" NÃO É SMOKE — a página pode responder 200 e renderizar SEM CSS (16/08).** Sintoma: HTML puro, links azuis sublinhados, header duplicado. Causa: após `rm -rf .next` + rebuild, o `pm2 reload` (graceful) deixa o processo **servindo o build VELHO** — o HTML aponta CSS com hash que o rebuild apagou → 404 → site sem estilo. **FIX: `pm2 restart` (full, NÃO reload) sempre que fizer `rm -rf .next`** — reload só troca env, restart recarrega o build. **SMOKE OBRIGATÓRIO** (`scripts/smoke-deploy.sh`): extrai o `<link>` CSS do HTML servido e verifica que retorna 200 (o CSS neste Next fica em `.next/static/chunks/*.css`, não `/css/`). "deploy ok" com site quebrado aconteceu porque o smoke era só `curl -w %{http_code} /` = 200. Agora o smoke morde. **COROLÁRIO 502 (17/08):** o smoke tem que rodar **DEPOIS** do restart terminar — se o build falha no type-check (ex: `JsonValue not assignable to string` quando schema e coluna divergem) o `.next` fica parcial e o app sobe **502**. `curl` do domínio público (não localhost) pega o 502; "build sem erro" no terminal não basta se o restart não completou.
- **⚠️⚠️ `npm run build | grep ... | head -N` DERRUBA PROD — o `head` mata o build por SIGPIPE (24/08, prod ficou FORA DO AR).** Eu rodava o deploy com `npm run build 2>&1 | grep -iE "Compiled successfully|error" | head -2` pra encurtar o output. **A lista de rotas que o Next imprime no fim tem `├ ƒ /api/client-error-report`, que casa com `-i error`** → o `head -2` completou suas 2 linhas, fechou o pipe, e o `npm run build` levou **SIGPIPE no meio da escrita do `.next`**. Resultado: `.next` sem `BUILD_ID`, `pm2 restart` subindo e morrendo em loop (`errored`, 16 restarts), **site fora**. O terminal tinha mostrado "✓ Compiled successfully" — o build REALMENTE compilou; morreu na etapa seguinte. **LIÇÃO (irmã da que já estava aqui, "build sem erro no terminal não basta"): NUNCA canalizar o build pra `head`/`grep -m`/qualquer coisa que feche o pipe cedo.** Se quiser encurtar, redirecione pra arquivo e leia depois (`npm run build > /tmp/build.log 2>&1; tail -20 /tmp/build.log`), ou use `| tail -N` (tail lê tudo até o fim, não fecha cedo). **E o smoke SÓ VALE DEPOIS de conferir que o `.next/BUILD_ID` existe e que o `pm2 list` diz `online` com uptime crescendo** — o smoke passou verde num momento em que o processo já estava reiniciando em loop, porque o nginx ainda servia a resposta do processo anterior.
- **⚠️ `git add <path-inexistente>` ABORTA CALADO — todo o commit vira no-op silencioso (17/08, mordeu 3× no MESMO commit).** Ao mover `/api/admin/juiz` → `/api/juiz` fiz `git add` incluindo o dir `app/api/admin` já apagado; o git recusou o comando INTEIRO (exit≠0, mensagem some no meio do output) → **nada foi stageado**: nem a página com o fetch corrigido, nem o `schema.prisma detail String`, nem outro arquivo. O `git commit` seguinte "funcionou" (commitou o que já estava staged de antes) e eu dei por feito. Efeito: a TELA continuava chamando `/api/admin/juiz` (404) e o SERVIDOR tinha `detail Json` (o valor original — meu fix pra String nunca colou; **NÃO foi passo de deploy reescrevendo schema**, foi commit que não pegou). **REGRA: depois de todo commit que MOVE/RENOMEIA/apaga arquivo, PROVAR o conteúdo commitado com `git show HEAD:<arquivo>`** (não `git status`, não `git log --stat` — o conteúdo REAL da linha que importa). `git add -A` no lugar de listar paths também evita (não referencia path morto).
- **Relatório com `detail` malformado NÃO pode derrubar o GET (17/08).** O `/api/juiz` fazia `rows.map(r => JSON.parse(r.detail))` — UMA linha legado com `detail` objeto (coluna era `Json` no servidor) estourava o `.map` inteiro → GET 500 → o selo caía no CINZA "nunca rodou" (mentira: tinha rodado). **Mesma causa derrubava DOIS lugares** (o selo e a tela /juiz) — a correção tinha que valer pros dois (parse resiliente na FONTE → casca fina). Fix: `parseDetail(d: unknown)` no escopo do módulo — aceita objeto (Json/legado), string (parse), ou default `{byCompany:[],sharedTx:[],balanceChecks:[]}`; **nunca throw**. Um dado ruim degrada UMA linha, não a lista. **Selo tem 4 estados DISTINTOS** (`judge-selo-state.ts`, função pura testada): 🟢 verde `<24h` e ok · 🔴 vermelho `<24h` e falha · 🟡 **amarelo relatório existe mas `>24h` = cron parado, avisa DESDE QUANDO** · ⚪ cinza zero relatório. A IDADE decide, não a existência (o amarelo caía no cinza — REGRA 1, `judge-selo-state.test.ts`).

## Segurança & LGPD

- **Senhas** bcrypt rounds 12 · **JWT** cookie httpOnly · **Zod** em toda rota · **Multi-tenant** isolation via `companyId` (transactions) e `profileId` (personal).
- **Rate limit login** (Sprint 05/06): por `(IP+email)`, backoff progressivo (0/0/0/30s/60s/180s/300s teto), guard IP 20/15min, reset no login OK, UI link "Esqueci senha" após 2 falhas. **Fail-open** em qualquer exceção do limiter (nunca bloquear login legítimo).
- **NUNCA** `cat .env` nem echo credenciais em logs.
- **NUNCA** confundir CAIXAOS vs AcadOS — confirmar IP + hostname antes de SSH/deploy.
- **NUNCA** mexer em senha do admin em prod.
- **Contraparte é dado pessoal de terceiro** (Sprint Contraparte PIX 31/07): `Transaction.counterpartyName` e `counterpartyDocument` (nome/CPF/CNPJ de favorecido/pagador do PIX) são DADO PESSOAL sob LGPD. Mesmo gate de permissão das transações; **NUNCA logar em log de aplicação** (nem em diagnóstico — mascarar sempre). Não alimentam `stableKey`/`computeCacheKey` (que usam `description`) — vivem só nessas colunas. Precedência de origem `MANUAL > OPEN_FINANCE > OFX > PDF_STATEMENT` centralizada em `lib/counterparty/precedence.ts`. Parser determinístico do PDF: `lib/bank-statement-pdf/banrisul-parser.ts` (texto, sem Vision). Join read-only: `lib/counterparty/join-pdf-statement.ts`. **⚠️ Validação de conta (11/08):** o Banrisul emite a conta no cabeçalho em DOIS formatos — `CONTA..: 0605534106` (jul) e `CONTA..: 06.055341.0-6` (ago, formatado). O regex parava no 1º ponto e pegava só "06" → recusava o PDF certo. Fix: char class `[\dXx.\-]+` (inclui ponto) + `headerMatchesAccount` normaliza os dois lados (só dígitos, sem zeros à esquerda). Guard: `banrisul-parser.test.ts` + `build-preview.test.ts`.

## Pegadinhas Asaas (Sprint 3A/3B/3C — em uso ativo)

1. **`$` na `ASAAS_API_KEY`** precisa escape `\$` no `.env` (dotenv-expand faz expansão shell — chave vira string vazia sem escape). Aspas simples/duplas NÃO bastam. Validação: `node -e "loadEnvConfig('.'); console.log(process.env.ASAAS_API_KEY.length)"`.
2. **Conta Asaas precisa CHAVE PIX cadastrada** — `POST /v3/payments` retorna 200 mas `pixTransaction` null; `pixQrCode` depois 400 `invalid_action`.
3. **`POST /v3/checkouts` RECURRENT + customerData** exige TODOS os 9 campos (name/email/cpfCnpj/phone/address/addressNumber/postalCode/city IBGE/province) OU NENHUM. MVP usa "nenhum" — hosted Asaas coleta.
4. **Webhook token hex** NÃO precisa escape `$` (é hex puro do `openssl rand -hex 32`).
5. **Webhook auth header**: `asaas-access-token` (não `x-webhook-secret` nem `Authorization`).

## Anti-padrão: validação visual obrigatória (Sprint 5.0.4.0a)

DoD que envolve **sidebar, rota, link, redirect, layout** exige validação em browser real (ou curl -i pra redirect, ou screenshot). **"Código escrito" ≠ "DoD cumprido"**. Se ambiente não permite browser: DECLARAR limitação e pedir smoke test do Yussef ANTES de fechar sprint. Nunca marcar DoD visual ✅ sem olhar com olhos humanos.

## ⭐ INVARIANTES DE INFRA — o juiz olha a máquina também (25/08)

Nasceu do episódio de 24-25/08: o `next build` foi morto pelo OOM killer **três vezes**, o `.next` ficou sem `BUILD_ID`, o pm2 entrou em loop — e **nada no sistema avisou**. O juiz olhava dinheiro e estoque; a máquina embaixo deles era ponto cego. Decisão do dono: *"infra também merece invariante"*.

`lib/infra/health.ts` (motor PURO + leitura do `/proc/meminfo`), rodado pelo **cron das 3h** (`cron-judge.ts`) e incluído no **e-mail de alerta** — e o e-mail passa a ser disparado por infra sozinha, mesmo com dinheiro e estoque verdes.

- **N3 (erro)** — servidor com menos de 1 GB de swap. É o estado exato que derrubou prod: sem folga, o type-check do build é morto pelo OOM e o `.next` fica sem `BUILD_ID`.
- **N1 (erro)** — mais de 256 MB de swap em uso. ⚠️ **O horário é o que dá sentido ao número:** às 3h NÃO há build rodando, então swap em uso ali não é o build respirando — é a operação normal já não cabendo na RAM. **É o gatilho (b) do upgrade pra 8 GB.**
- **N2 (aviso)** — menos de 15% da memória disponível. Avisa, não deixa vermelho.

**N1 não acumula sobre N3:** máquina sem swap dispara só o N3 — uma causa, um alerta (senão o e-mail vira ruído e o dono para de ler). 8 testes, incluindo a leitura REAL do servidor antes e depois do swap.

## ⛔⛔⛔ DATA FIXA NO FUTURO É CONTAGEM REGRESSIVA · E "PRÉ-EXISTENTE" SÓ DEPOIS DE MEDIR (01/09/2026)

**⭐ A RÉGUA (do dono): *"futuro tem que ser relativo ao relógio de quem roda — data fixa não é futuro, é uma data que o calendário alcança."*** Quando o teste precisa de um "agora" adiante, escreve `new Date(Date.now() + N * 86_400_000)`.

**QUATRO OCORRÊNCIAS, e a última explodiu com três de uma vez:**
| quando | o quê | como falhou |
|---|---|---|
| 26/08 | rota de detecção de pagamento de empréstimo com janela FIXA `01/07–31/08` | em 01/09 pararia **em silêncio**, sem erro nenhum |
| 01/09 | `real-vs-teorico` com `ATE = '2026-08-31'` | o `AJUSTE_CONTAGEM` é carimbado com AGORA (correto em produção) → o teste dependia de "hoje" caber na janela. **5 vermelhos sozinhos na virada do mês** |
| 01/09 | `producao P2` fingindo `now = '2026-09-01'` ("11 dias depois") | P2 mede `now − atualizadoEm`, e `atualizadoEm` é o relógio REAL → a diferença virou **zero** |
| 01/09 | `producao P5/P6` fingindo `'2026-09-30'` | ainda não tinha explodido — explodiria em 30/09. Desarmada antes de tocar |

**⚠️ A REGRA É ESTREITA, e a medição é o que impede o alarme falso:** a suíte tem **148** datas fixas no futuro e a esmagadora maioria é **FIXTURE legítima** (`dVenc`, `dueDate`, `validadeAte`) — boleto que vence em 19/09 é dado realista, e virar passado não quebra nada porque o teste não compara com o relógio. **O que mata é a data fixa ocupando a posição de AGORA.** Medido: **48 testes** têm data fixa em posição de relógio e **todas as 48 estão no passado** — por isso o guard nasce com zero violação.

**⭐ O GUARD:** `__tests__/regras-testes/sem-data-fixa-no-futuro.test.ts` — falha quando um teste novo põe data fixa **no futuro** numa posição de relógio (`now:`/`ate:`/`const NOW =`/`check*Invariants(…)`), **resolvendo a indireção dentro do arquivo** (`const X = new Date('…')` → `check…(db, X)`). ⚠️ **A 1ª versão NÃO pegava a bomba do P2** porque ela estava atrás de uma variável e meus padrões só olhavam nomes — *guard que não pega o caso que motivou o guard dá selo verde de graça*. Tem auto-teste do detector (senão passaria por cegueira) e teste de que NÃO morde fixture.

**⛔ E O QUE FOI MEDIDO E REJEITADO:** flagrar **toda** `const X = new Date(futuro)` dá 3 achados e os **três são benignos** (`NOT_AFTER` de um .pfx sintético — `readPfx` não tem `new Date()` em lugar nenhum; `futureNow`/`FUTURE` fixas e coerentes entre si; `dez` alimentando função pura de intervalo). Três alarmes falsos no dia 1 é como um alarme morre. **O que distingue bomba de fixture é SEMÂNTICO** — a data fixa ser comparada com um carimbo do relógio real — e isso não dá pra ler no texto. O guard cobre a posição de relógio e **assume não cobrir o resto**.

**⭐⭐ E A SEGUNDA RÉGUA, que é sobre método e vale pros dois lados:**

> **"PRÉ-EXISTENTE" SÓ DEPOIS DE MEDIR A CAUSA. Sem causa medida, é "VERMELHO SEM DIAGNÓSTICO" — e isso não fica na fila mais de um dia.**

Eu rotulei o `producao P2` de pré-existente **por dias**, e o rótulo *"não é meu"* **parou a investigação**. O dono: *"eu aceitei porque você repetiu."* Quando finalmente instrumentei, a causa apareceu em minutos — era bomba de calendário, e as P5/P6 estavam armadas do lado. ⚠️ Duas vezes eu também expliquei os 5 do `real-vs-teorico` como *"poluição do dev.db"* sem medir; a sujeira existia (663 empresas de teste acumuladas, hoje 0 com o teardown global), mas **não era a causa** — serviu de explicação confortável pra eu não medir. **Alarme falso repetido mata o alarme; rótulo confortável mata o diagnóstico.**

- **⚠️ O FILTRO DE PERÍODO DA FILA DE TRABALHO NÃO FOI REALOCADO — e é DECISÃO, não esquecimento (15/09).** Os Pendentes tinham `DateRangeFilter`; a CAIXA DE ENTRADA **não tem**, pela régua de 14/09: *"Pendentes é FILA DE TRABALHO e NUNCA ganha mês — esconder pendente antigo é esconder trabalho, e foi assim que 21 notas ficaram invisíveis"*. Quem navega por período é **Movimentações** (o arquivo). O que a caixa tem no lugar é o **corte de época**, que é outra coisa: diz de quando o dono começou a conciliar, **não** esconde o que ele ainda não resolveu. Há teste afirmando a AUSÊNCIA com o motivo escrito.

## Regras do acordo (teste + tela + comportamento)

- **REGRA 1** — todo bug corrigido ganha um teste que **falha antes** do fix e **passa depois**.
- **REGRA 2** — feature só está pronta se **visível na tela** (validação em browser real; se o ambiente não permite, declarar limitação e pedir smoke do Yussef).
- **REGRA 3** (09/08/2026) — **teste tem que EXECUTAR o comportamento, não procurar string no código.** Grep de símbolo, checagem de import, existência de arquivo, snapshot de fonte: **nenhum prova que a funcionalidade funciona.** Se o teste não roda o caminho real com dado real, **não é guard** — dá falsa segurança (já mordeu 2× em 09/08: o guard de descarte-futuro era grep de `partitionFutureLines`, verde com o preview 100% aberto; e o teste "sprint-visual" caçava `bg-amber-50` no arquivo). Todo guard novo roda o pipeline real contra fixture real (ex: `preview-futuro-extrato-real.test.ts`).
- **REGRA 4** (13/08/2026) — **ao substituir uma lógica, PROVAR que não há outra cópia antes de considerar feito.** Buscar por: (a) o NOME da função, (b) a CONSTANTE ou PADRÃO que ela usa (YYMMDD, tolerância `0.01`, janela de dias `_WINDOW_DAYS`/`86400000`, sinal oposto CREDIT×DEBIT), e (c) o COMPORTAMENTO (grep por quem descarta/filtra/classifica/deduplica). **Achar UMA e parar já custou 5 episódios:** motor de transferência (7 lugares) · categoria de entrada da ponte (3) · rawOfxBlob (1 caminho de N) · relógio no import (3 lugares: future-line, is-preview, parser.ts) · heurística FITID==YYMMDD (2 cópias: `partitionFutureLines` E `reconcile.isPreviewLine` — a 2ª mordeu no import real do 4.092,02). **COROLÁRIO — "a conta fecha" NÃO prova classificação certa:** o `ledgerBalMatched=true` enganou (deu true porque o saldo fechava COM a linha FORA, o que era coerente MAS escondia que ela foi descartada pelo motivo errado). O saldo pode fechar com a linha dentro OU fora dependendo do LEDGERBAL; só o LEDGERBAL diz QUAL. Fechar é necessário, não suficiente.
- **REGRA 5** (14/08/2026) — **DISCIPLINA VIRA IMPOSSIBILIDADE. Todo "combinado que não faz" deve virar "não dá pra fazer errado".** Quando aparecer uma regra que depende de lembrar ("sempre rodar X antes", "não esquecer de Y", "cuidar pra não Z"), a primeira pergunta é: *dá pra tornar impossível em vez de combinado?* Um guard/choke-point/tipo que RECUSA o caminho errado vale mais que qualquer nota. **Exemplos que já pagaram:** `saferm` (recusa apagar git-tracked — matou o `rm` de tracked que mordeu 2×) · `createOfxImportRecord` EXIGE o blob no tipo (impossível criar OfxImport sem gravar o cru) · `resolveImportStatuses` é UMA função que preview e confirm chamam (impossível a tela mostrar ≠ do que grava) · `systemSlug='BRIDGE_ENTRY'` (impossível renomear a categoria e criar duplicata) · `to-canonical` é a ÚNICA porta do OFX cru. **O padrão é sempre o mesmo:** onde a regra dependia de disciplina humana, botar uma barreira estrutural (tipo obrigatório, ponto único de passagem, allowlist, exit-1 no comando) que torna o erro impossível, não improvável.
- **REGRA 6** (14/08/2026) — **O CASO NEGATIVO ESCAPA QUANDO O CAMINHO FELIZ E A EXCEÇÃO VIVEM EM LUGARES DIFERENTES.** O estorno de cartão (CREDIT) escapou **3× no MESMO dia** — no import (`checkInvoiceTotals`), no display (`monthSpend`), e na categoria (`byCat`/`applyWithdrawal`). Sempre a mesma causa: o caminho feliz (compra DEBIT positiva) tratado num lugar e a exceção (CREDIT que subtrai) esquecida nos outros. **Antes de dar por pronta QUALQUER feature de valor, procurar TODOS os lugares que SOMAM e verificar se tratam o caso negativo** (estorno, devolução, crédito, sinal oposto). É a REGRA 4 aplicada a VALOR: total de fatura, saldo, soma de despesa — cada `Σ` é um lugar onde o CREDIT pode ter sido esquecido. **Fix estrutural:** quando N lugares calculam o MESMO número, vira UMA função (`faturaNetTotal` = compras − estornos; os 3 lugares agora chamam ela). Mesma família do motor de transferência (7 cópias) e do FITID (2 cópias): número de fatura, como qualquer decisão repetida, é função única — não cópia por tela. Guard: `fatura-fecha-com-estorno.test.ts` (o teste que teria pego os 3 bugs de uma vez).
- **REGRA 7** (14/08/2026) — **MÓDULO DE DINHEIRO SE FECHA COM UM TESTE DE INVARIANTE DE MÓDULO (todos os itens, todos os Σ), NÃO com teste por bug.** Antes de dar um módulo por fechado, mapear a CLASSE inteira (todos os contratos/todas as somas/todos os call-sites), não a instância que gritou. O teste roda o pipeline REAL contra fixture multi-caso (feliz + exceção + borda) e falha se QUALQUER item violar QUALQUER invariante — item novo trinca ele. **COROLÁRIO — invariante ERRADO é pior que invariante nenhum:** se a regra falha no caso legítimo, alguém vai "consertar" o DADO pra bater com a regra errada. Ex real (empréstimos 14/08): o invariante ingênuo `saldo devedor == principal − Σamort(PAID)` QUEBRA em contrato com carência capitalizada/POS (SELIC), onde a dívida SOBE sem pagamento (Caixa 1827478: 150.000 → 177.219,96 após 11 meses de carência; saldo sobe no meio do contrato). O invariante certo tem que valer pra TODA a classe, com exceção explícita pro que foge (FLEXIBLE sem prazo, capitalização). **Saldo correto = "saldo declarado no ÚLTIMO PDF oficial do banco + amortizações casadas depois da data daquele PDF"** — checável, honesto, não exige modelar capitalização, amarra com "a agenda do banco é a verdade do planejado". Guardar no contrato: `saldoDeclarado` + `dataDoDocumento`.
- **REGRA 9** (25/08/2026) — **HOOK NOVO VAI PRO TOPO DO COMPONENTE, NUNCA PERTO DE ONDE É USADO.** Mordeu **2×** com o mesmo desenho: 21/08 a ordem de produção (`useMemo` do escalaAviso depois do early-return) e 25/08 a tela de vendas (3 `useState` + 1 `useEffect` depois do `if (!data) return` → **"This page couldn't load"**, tela caída em prod). **A causa é sempre a mesma e é sedutora:** o hook novo é colado ao lado do código que o consome — e o código que o consome já está depois do return. Na 1ª renderização o componente retorna cedo e registra N hooks; quando o fetch volta, passa dos returns e registra N+k → *"Rendered more hooks than during the previous render"*. **É crash de CLIENTE: o servidor responde 200/307 normalmente e o `pm2 logs` fica limpo** — por isso não adianta procurar no log, e por isso o smoke não pega. **GUARD (REGRA 5, `__tests__/regras-react/hooks-antes-de-early-return.test.ts`):** varre TODAS as páginas cliente e falha nomeando arquivo/componente/linha. Detecta no CORPO do componente (indentação de 2 espaços) — `if (!x) return` dentro de callback/useMemo não conta, lá é legítimo. Tem também um teste que prova que o DETECTOR pega o padrão, senão o guard passaria por cegueira. Varredura de 25/08 sobre o app inteiro: **1 componente afetado, o que eu tinha acabado de mexer** — os outros 25 candidatos eram `return` dentro de callback (falso positivo dos 2 primeiros regex que tentei).
- **REGRA 10** (01/09/2026) — **RELAXAR CONSTRAINT EXIGE FIXTURE DO ESTADO NOVO NO MESMO COMMIT.** *"Tornar um campo nullable (ou relaxar qualquer constraint) exige, no MESMO commit, uma fixture com o estado novo rodando na suíte — todo teste existente continua provando só o mundo antigo"* (dono). **NASCEU DE INCIDENTE:** `loans.bankAccountId` virou nullable e a carteira (`/emprestimos`) quebrou em prod com *"This page couldn't load"* — a rota respondia **200**, o `pm2 logs` ficava **limpo** (crash de CLIENTE) e **8.045 testes verdes** não viram nada, porque até aquele dia um contrato sem conta era **IMPOSSÍVEL** (NOT NULL) e nenhuma fixture jamais o produziu. ⚠️ **Uma auditoria dirigida de 33 referências também não pegou**, por dois motivos que valem sozinhos: (a) ela varreu o **ESCALAR** (`bankAccountId`) e o que quebrou usava a **RELAÇÃO** (`bankAccount`) — identificador diferente, grep cego; (b) o **TypeScript aprovou**, ver a dívida abaixo. **A fixture é a única das três camadas que teria pego.**
- **REGRA 11** (02/09/2026) — **GUARD SÓ CONTA DEPOIS DE RODAR CONTRA O DEFEITO QUE O MOTIVOU — E QUANDO O GUARD É SHELL, O DEFEITO PODE ESTAR NO SHELL.** Regra do dono, nascida de **três ocorrências com a MESMA anatomia: testado contra o caso bom, nunca contra o defeito.** (1) **Data fixa no futuro** (01/09): a 1ª versão do guard não pegava a bomba do `producao P2` porque a data estava atrás de uma variável — *"guard que não pega o caso que o motivou dá selo verde de graça"*. (2) **Card `PRONTOS`** (02/09): o guard testava o predicado puro; **repus a subtração errada no `totais` e os 46 testes passaram verdes** — o que morde roda o pipeline real (`hubCardapio`). (3) **Gate de migration** (02/09): `npx prisma migrate status | grep -q "…"` sob `set -o pipefail` — com migration pendente o prisma **sai com código 1**, o pipeline inteiro vale 1 **mesmo com o grep casando**, o `if` leu falso e o deploy anunciou *"schema do banco em dia"* com a tabela faltando, **duas vezes no mesmo dia**. ⭐ **O PROCEDIMENTO:** escreveu guard → **reponha o defeito** (comente a linha, volte a fórmula antiga, force o estado ruim) → **veja vermelho** → restaure. Sem esse passo, o guard é uma afirmação sobre o mundo bom. ⚠️ **E se o guard for shell, o teste tem que EXECUTAR o script** (com binário falso no PATH, se preciso): grep no fonte não distingue a versão que funciona da que mente — as duas contêm a mesma frase.
- **REGRA 12** (13/09/2026) — **TELA NOVA SE PROVA NOS DOIS VIEWPORTS, SEMPRE. Mock mobile sem composição desktop definida NÃO É SPEC COMPLETA.** Nasceu do dashboard PF: o mock aprovado era de 480px, eu implementei fiel, e no MacBook do dono virou *"uma coluna de 480px boiando no meio do monitor"*. ⭐ **A régua é DUAS COMPOSIÇÕES, UM CONJUNTO DE WIDGETS** — o app no celular e o COCKPIT no desktop (padrão Monarch/Mobills) usam **os mesmos componentes**; muda o LAYOUT, nunca o conteúdo. ⛔ Dois cards do mesmo dado, um por viewport, divergiriam no primeiro selo novo — e o dono veria um número no bolso e outro no monitor. **Breakpoints da casa:** `<768` app · `768–1024` duas colunas · `≥1024` grid de 12. **A prova é red-then-green NOS DOIS**, e o guard (`desktop-nao-e-celular-esticado.test.ts`) tem uma LISTA: tela nova entra nela **ou** registra a decisão de ser mobile-only (o tablet da cozinha é um aparelho só, e isso é escolha, não esquecimento). ⚠️ Vale retroativamente pra Conciliação, Relatórios de produção e as próximas.
- **REGRA 8b** (02/09/2026) — **TODO SCRIPT DE INVESTIGAÇÃO PROVA EM QUAL BANCO ESTÁ ANTES DE MEDIR: resolve a empresa pelo ID e ABORTA se ela não existir ali.** ⛔ Nasceu de erro meu: rodei a reconciliação dos 195 produtos do PDV com o `companyId` **certo** da Caçula, mas via `npx tsx` no Mac, onde o `.env` aponta pro **SQLite de dev**. A empresa não existe lá; o Prisma devolveu **0 mapeamentos** e eu concluí **por escrito** que *"os 4 mapeamentos sumiram"*. O dono ia abrir investigação de PERDA DE DADO e adiar uma tarde de trabalho — os 4 estavam intactos em prod o tempo todo. ⭐ **A classe: zero silencioso é indistinguível de "não tem"** — `findMany` num banco que não conhece a empresa não erra, devolve lista vazia, que é resposta plausível (mesma família do empty state que mentiu na home PF e do `contains` case-sensitive). ⚠️ **E a trava que existia é ASSIMÉTRICA:** `guard-banco-de-teste` impede a SUÍTE de rodar contra prod (cicatriz de 08/08), e não havia nada no sentido inverso. **Resolver por ID não basta se o ID for lido no banco errado.** Helper: `lib/scripts/prova-banco.ts` (`exigirEmpresaNesteBanco`), que aborta e ainda imprime contra qual banco mediu — output sem essa linha é output do qual não dá pra concluir nada.
- **REGRA 8** (15/08/2026) — **RESOLVER CONTA/EMPRESA POR ID, NUNCA POR NOME.** 3 empresas (caçula/profit/arafet) × os MESMOS bancos → `findFirst({where:{name:{contains:'banris'}}})` pega a conta de OUTRA empresa. **Custou um número de saldo FALSO de 26 mil** (li o Banrisul da profit, +3.984,64, e "descobri" um buraco na caçula que não existia) **+ um sprint inteiro de âncora inventada** — a caçula estava certa o tempo todo. Mesma classe da trava "OFX na conta errada" (`verify-account-match`), lado ANÁLISE. **Regra dura:** toda query/write de conta resolve por `bankAccountId` explícito (IDs no topo deste doc: caçula Banrisul `cmq17z90v00qxrndl02kfn4iz`, Stone `cmq182qfr0005aktn6q2ugpv2`, Sicredi `cmq180ksv0001aktni9wj64mq`) OU filtra por `companyId`; **`findFirst` por nome é PROIBIDO em qualquer caminho.** ⚠️ vale IGUAL pra `loan.findFirst({where:{contractNumber}})` sem `companyId` — ambíguo se 2 empresas têm o mesmo nº (auditado 15/08: os 7 contratos da caçula que gravei são únicos, **0 write vazou** — mas foi SORTE, não desenho). **Todo preview de gravação mostra `empresa + id da conta` antes de confirmar.** Duas fontes concordando não vira verdade, E ler a entidade errada não vira diagnóstico — confirmar o ID é a barreira.

## Princípios de arquitetura (Fase 3, 15/08/2026)

Alinhados com padrão de mercado (Modern Treasury / Fintech Engineering Handbook). Fase 3 = 3 camadas: **(1) impossível por construção** (constraint no schema — ex: `LoanInstallment` tem `reconciledTransactionId` OU ponte N:1, NUNCA os dois → double-count morre no banco; `companyId` NOT NULL + index em toda tabela do módulo → REGRA 8 vira constraint); **(2) provado em runtime** (os invariantes como property tests `fast-check` sobre fixture REAL anonimizado PRE+POS+ex-truncado+sweep+FLEXIBLE; invariante checado APÓS CADA PASSO de mutação, não só no fim; idempotência — importar o mesmo OFX 2× = 0 mudança; golden tests travados ao centavo: fatura Sicredi, OFX 14/08, agenda Banrisul); **(3) auditado post-factum** (job noturno "juiz de módulo" roda os invariantes contra o banco INTEIRO, todas as empresas, grava relatório; divergência = alerta — pega o bug que passou pelas outras 2 camadas). **Regras:**
- **SALDO NUNCA É DADO PRIMÁRIO** — derivado das transações, cacheado se precisar, recomputável SEMPRE. ⚠️ **AUDITORIA (15/08): HOJE ESTÁ GRAVADO** — `bankAccount.balance` e `bankAccount.ledgerBal` são campos primários; `recalcularSaldoConta` reconstrói, mas o valor vive gravado (e o `ledgerBal` é âncora legítima do fechamento OFX). Pendência: o `balance` deveria ser cache derivado, não fonte; o `ledgerBal` fica (é declaração do banco, não cálculo nosso).
- **VALUE DATE (competência/vencimento) e BOOKING DATE (caixa/débito) são DOIS campos, sempre — nunca colapsar num só.** Já parcialmente: `Transaction.competenceDate` vs `date`/`paymentDate`; `LoanInstallment.dueDate` (value) vs `paidDate` (booking). Guardar a distinção em qualquer campo de data novo.
- **DADO SE CORRIGE NO LUGAR ATÉ SER REPORTADO (contador); depois, SÓ por compensação no período atual, com link ao original.** Mês fechado/reportado não se reescreve — lança-se um ajuste no período aberto apontando pro lançamento original. (É o mesmo espírito do `dreHeld`: mês fechado não muda em silêncio.)
- **CAMADA 1 FEITA — TRIGGER `loan_installment_no_double_link` (double-count IMPOSSÍVEL no banco, 15/08).** Migration `20260815210000_loan_no_double_link_trigger`. **Protege:** uma `LoanInstallment` tem `reconciledTransactionId` (1:1) OU `LoanInstallmentPayment` (N:1), NUNCA os dois — senão o juros conta 2× no DRE (path 1:1 + path N:1). 2 triggers (`trg_lip_no_double_link` BEFORE INS/UPD em `loan_installment_payments`; `trg_li_no_double_link` BEFORE UPD em `loan_installments`) chamam a função que `RAISE EXCEPTION` com **mensagem acionável** ("DOUBLE-LINK BLOQUEADO: a parcela X já tem vínculo 1:1 — remova antes de criar N:1…"), não erro genérico. **companyId NOT NULL + índice JÁ existiam** (`loans.companyId` NOT NULL, `loans_companyId_idx`) — CAMADA 1 = só o trigger. **ROLLBACK documentado:** `DROP TRIGGER trg_li_no_double_link ON loan_installments; DROP TRIGGER trg_lip_no_double_link ON loan_installment_payments; DROP FUNCTION loan_installment_no_double_link();`. ⚠️ **Postgres-only** (dev SQLite não tem — o "impossível" vale em prod). Prova REGRA 1: script server-side tenta criar o double-count de propósito → banco RECUSA (roda contra Postgres real, não SQLite).

## Vendas — decisões de arquitetura (17/08/2026, Fase 1 COMPLETA e deployada)

**CAUSA RAIZ do módulo: DUAS coisas diferentes que pareciam uma.** O **extrato** diz QUANDO O DINHEIRO CHEGOU; a **venda** aconteceu ANTES (o cartão liquida D+1, o PIX-Tuna consolida o dia anterior, o cofre lança um dia depois). São perguntas diferentes com um LINK entre elas. Decisões (todas em `lib/vendas/`):
- **`VendaDiaria` é DERIVADA de `Transaction`, recomputável, NUNCA fonte primária.** Some ao recompute e nasce de novo igual (idempotente). O extrato é a verdade; a VendaDiaria é a leitura.
- **Competência por CONTA + MEIO + VIGÊNCIA, UMA função (`computeCompetencia`).** O `PerfilRecebimento` diz, por (conta, meio, data), quantos dias o dinheiro atrasa e se recebe fim de semana. Vigência porque a Cacula MIGROU o PIX pra Tuna em **12/08** — antes/depois são dois mundos; a data da linha decide a regra. `recebeSabDom=false` → dias ÚTEIS + BLOCO de fim de semana (seg = {sex..dom}); `=true` → dias CORRIDOS sem bloco (cofre: sáb=sex; Stone D+0=dia). Segunda cópia da função = bug (REGRA 4).
- **CATEGORIA É DECISÃO DO DONO — o sistema pergunta, nunca reclassifica** (ver "Regras de negócio críticas"). O motor lê CATEGORIA (RECEITA_BRUTA), nunca memo/descrição. OP.CREDITO C/GARANTIA = cartão (o dono confirmou); "academia" foi typo numa venda; nada disso o sistema adivinha.
- **⭐ AGOSTO (12/08) PRA FRENTE — antes não existe pra vendas.** 11/08 dropado (dia incompleto: o Stone D+0 dele está no extrato pré-corte). Nada pré-12/08 computa; jul e antes NÃO se mexe (só o move das 77 do cofre, DRE-neutro, foi exceção — não abre precedente). A tela navega pra trás e mostra "antes do início do sistema" (distinto de sem-venda/loja-fechada).
- **ESTIMADO nunca tem a cara de CONFIRMADO** (til `~` + cor sky, distinta do emerald de confirmado que ainda não existe). Tudo hoje é `EXTRATO_INFERIDO`/`ESTIMADO`; a confirmação por adquirente é fase 2. Mesma disciplina do `~previsto` dos empréstimos.
- **FIM DE SEMANA = BLOCO na tela, divisão GUARDADA.** Tuna (seg, 3 lançamentos) e cofre DIVIDEM por dia (guardado nas VendaDiaria de dia único); cartão vem em BLOCO ({14..16}, não divide). A tela agrupa sex-dom num card só e soma cartão+PIX+dinheiro; a divisão aparece no clique.
- **"A APURAR" > número inventado, SEMPRE.** SDLW/SWLY, perfil da semana, previsão: enquanto não há histórico suficiente (≥2 semanas por dia; ≥4 semanas pra previsão), mostra "a apurar", nunca completa com julho nem chuta.
- **Defesa em 3 camadas (igual empréstimos):** golden travado ao centavo (fixture anti-PII) · invariantes **V1-V4 no juiz noturno** (V1 Σ==recompute · V2 links N:1 · V3 multi-tenant · V4 idempotência; `vendaIssues` no selo/e-mail; só competência ≥12/08) · gatilho **fail-soft** (`recomputeVendasSafe` no import confirm + `/transacoes/[id]` + `/transacoes/lote`; NUNCA derruba o import — o juiz pega de manhã).
- **GOLDEN (12-16/08, conferido pelo dono contra o que a loja vendeu):** qua 12/08=**11.919,65** · qui 13/08=**10.468,80** · fim de semana {14..16}=**62.090,93** (cartão bloco 28.422,17 + PIX 24.048,76 + dinheiro 9.620) + split Tuna 5.780,17/7.979,80/8.587,17→14/15/16. **Cresce toda semana** com o dono conferindo os dias novos antes de travar.
- **Fase 2 (desenhada, NÃO iniciada):** adquirente (Stone API) → bruto/taxa/líquido, contagem, ticket médio, por hora, DEBITO×CREDITO, subcategorias de meio. **Fase 3 (desenhada, NÃO iniciada):** previsão de entrada × saída na MESMA tela (as 3 saídas: empréstimo "vence este mês" + faturas de cartão a vencer + contas a pagar) + WhatsApp/e-mail (só depois da tela confiável).
- **⭐ PROVA VIVA DO JUIZ V1 (18/08) — o gatilho fail-soft cobre IMPORT + CATEGORIZAÇÃO, mas NÃO o lançamento MANUAL de venda em dinheiro no cofre.** Caso real: uma venda de 1.599 (dinheiro, cofre, competência 17/08) foi LANÇADA À MÃO às 20:36, depois do último recompute (06:02) → a VendaDiaria de 17/08 não existia. O **V1 pegou na 1ª rodada do juiz** ("gravado 0,00 vs esperado 1.599,00") + V2 ("venda-tx com competência ≥ corte não está em nenhuma VendaDiaria"), o **e-mail de falha saiu**, e `recomputeVendas` (self-heal desenhado) resolveu — 17/08 criada, **golden intacto** (12/08=11.919,65 · 13/08=10.468,80 · fim de semana=62.090,93), venda→0. **A defesa em camadas funcionou: o hook não cobriu, o juiz noturno cobriu.** **Débito:** ligar `recomputeVendasSafe` TAMBÉM no lançamento manual de venda em dinheiro (o form de tx manual do cofre não passa pelo hook) — OU deixar o juiz noturno cobrindo (que JÁ funciona; o e-mail avisa e o recompute resolve). NÃO urgente.
- **DÉBITOS:** (1) **estorno de venda** — a categoria "Estorno de venda (dinheiro)" existe mas **nenhum passou ainda**; o 1º que aparecer é o teste (VendaDiaria `tipo=ESTORNO`, faixa negativa, invariante não pode quebrar). (2) **subcategorias PIX/cartão** — hoje o MEIO vem da CONTA (Banrisul=cartão, Sicredi/Stone=PIX, cofre=dinheiro) via perfil, funciona; criar subcategoria por meio é fase 2. (3) **"loja fechada" vs "sem extrato"** — a tela hoje mostra "aguardando" pros dias ≥12/08 sem venda; distinguir "extrato do dia seguinte existe sem venda" (fechada) de "extrato não importado" é refino do bloco 2.

## Cartão de crédito PJ — decisões de arquitetura (18/08/2026, 3 camadas FECHADAS)

**CAUSA RAIZ de todo bug do módulo (mesma semana turbulenta dos empréstimos): fatura VIRTUAL sem dono declarado do total nem do "pago".** A fatura PJ NÃO tem linha própria nem coluna `status` (isso é do `CreditCardInvoice` do PF) — é `Transaction` agrupada por `invoiceMonth`, e "paga" é DERIVADO (existe pagamento com `paidInvoiceMonth == mês` no mesmo cartão). Sem uma linha de fatura pra travar, cada decisão (total, sinal do estorno, mês que o pagamento quita) espalhava. Decisões (`lib/credit-card-pj/`):
- **`BusinessCreditCard` (companyId, closingDay, dueDay, `defaultTreatment` OPERACIONAL|PESSOAL_SOCIO, socioPFId). Linha = `Transaction`** (`businessCreditCardId`, `invoiceMonth` YYYY-MM do vencimento, `type` DEBIT/CREDIT, **amount SEMPRE positivo — o sinal vem do type**, `isCardPayment`, `paidInvoiceMonth`).
- **`faturaNetTotal` = a ÚNICA soma de fatura** (compras − estornos; ignora pagamento). Os **6 lugares** que somam agora TODOS delegam a ela ou a `signedFaturaAmount` (o 6º era o `confirm:179` que recalculava na mão; o "7º" era o `review-queue` inline — fechados). Segunda cópia = bug (REGRA 4/6).
- **`resolvePaidInvoiceMonth` = a ÚNICA resolução do mês que um pagamento quita** — a TELA (`casar-pagamento`) E o IMPORT (`apply-marks`) chamam a mesma. Casa por **VALOR** (a fatura cujo net bate o pago), **NUNCA "a mais recente"** (era o bug sistêmico: o 7.896,32 caiu em julho porque agosto ainda não existia). Foi por não estar no import que o Banrisul 13.779,73 fechou OPEN "casado no import" (bug ao vivo 17/08, corrigido + K3 provado).
- **ESTORNO = CREDIT, amount positivo, SUBTRAI em todo Σ** (REGRA 6). Nunca somado como débito.
- **PESSOAL_SOCIO → toda linha nasce em `A_CLASSIFICAR`** (`dreGroup='A_CLASSIFICAR'`, `NON_LEARNABLE` — nenhuma AiLearningRule pode apontar pra ela). A fila tem que ESVAZIAR (K5 alerta se a mais antiga passa de **30 dias**, medido por `createdAt`, não pela data da compra — parcelada engana).
- **⭐ CAMADA 1 (impossível por construção) é FINA de propósito no PJ** — sem linha/status de fatura, C1/C2/C3 do sprint não cabem em constraint; viram invariante de RUNTIME (K). Banco trava só **C5** (companyId NOT NULL + index, já estava) + **C6** (CHECK `chk_business_card_days`: closingDay/dueDay 1..31 e dueDay≠closingDay, red-then-green provado; ROLLBACK `DROP CONSTRAINT chk_business_card_days`). **C4** (estorno sem categoria em PESSOAL_SOCIO) NÃO virou trigger — seria em `transactions` (tabela mais quente, subquery por insert = caro; ≠ do trigger de empréstimo em `loan_installment_payments`) → é invariante K. **O cadeado vem do JUIZ + golden**, não do banco.
- **CAMADA 2 (runtime):** GOLDEN das 3 faturas de agosto ao centavo (Sicredi 7.896,32/estorno 99,23 · Banrisul 13.779,73 · Caixa 7.280,39; fixture anti-PII só type+amount) + **3 parsers determinísticos** (Sicredi 4 validações · Banrisul 6 · Caixa 6) + **P1/P3** (property test, 500 casos, sem fast-check) + **idempotência PROVADA** (fatura Sicredi real 2× = 0 nova; contentHash estável; colisão só em linhas genuinamente idênticas — a "Be On" 5,00 x2 real 22:29/22:30, prod correto).
- **⭐ PARSER DE FATURA — 3 BANCOS, 3 LAYOUTS, A MESMA DOENÇA (FASE 4, 18/08).** `lib/credit-card-pj/deterministic/{sicredi,banrisul,caixa}-fatura-parser.ts` + `validate-*.ts`, registrados no `DETERMINISTIC[]` de `extract-invoice-smart.ts` (pdftotext -layout PRIMEIRO, Vision só fallback; validação não fecha → **FALHA 422, nunca grava**). **A doença:** o `-layout` põe TABELAS LADO A LADO (transações numa coluna, Pontos/Limites/Encargos noutra) → "valor no fim da linha" pega o número errado. **A cura: cortar por COLUNA** (Banrisul transações à ESQUERDA, corta na col do header `R$` ~64; Caixa à DIREITA, corta ~col 96; Sicredi coluna única). **O crédito tem sinal/forma DIFERENTE em cada banco:** Sicredi `-R$`, Banrisul `-` (e o par anuidade `DESC ANUID` −18 / `ANUIDADEINT` +18), **Caixa por SUFIXO `D`/`C`** (`570,08D`/`12,50C`) — e foi o **C que o Vision perdeu** (3 créditos de 12,58 = o K1 vermelho). **Caixa ainda quebra linha no -layout** (data/desc/valor em linhas físicas distintas no Demonstrativo) → recupera por FILA de pendentes; a Σ dos créditos independe do pareamento, a validação fecha. **Regra dura: ler por POSIÇÃO DE COLUNA + SUFIXO, nunca por "último número da linha".** Golden trava ao centavo (Banrisul 13.797,73 gastos/13.779,73 paga; Caixa 7,55+7.285,42−12,58=7.280,39). REGRA 8 do parser: banco desconhecido → Vision (não adivinha).
- **CAMADA 3 (juiz noturno) — K1-K7 em `card-invariants.ts`, no cron 3h + selo (`cardIssues` soma no vermelho) + e-mail + tela /juiz:** K1 metadata vs recompute · K2 fatura PAID (1 pagamento, valor, mês) · K3 pagamento órfão × fatura OPEN · K4 amount>0 · K5 fila A_CLASSIFICAR (report + alerta 30d) · K6 NON_LEARNABLE intacto · K7 fatura agosto+ de banco sem parser determinístico = entrou por Vision. Rodada manual 18/08: **K2-K6 🟢, K7 🔴 2 (Banrisul+Caixa Vision, honesto até o parser), K1 🔴 1 (Caixa real)** — dois vermelhos CERTOS, nenhum ajustado.
- **⭐ FASE 4 ENCERRADA E DEPLOYADA (18/08) — CARTÃO FECHADO NAS 3 CAMADAS, selo VERDE conferido no browser.** Parsers determinísticos Banrisul + Caixa em prod (`DETERMINISTIC[]`), golden ao centavo. **K7 dos dois APAGOU** (`hasDeterministicParser` true). **K1 do Caixa APAGOU** via reprocess CIRÚRGICO em prod (`scripts/reprocess-caixa-agosto-creditos.ts --apply --category=<Tarifas Bancárias>`): adicionou só os 3 créditos que o Vision perdeu (`CASHBACK ANUIDADE` 12,50C + 2× `AJUSTE` 0,04C, como CREDIT em DESPESAS_FINANCEIRAS = offset da anuidade, nunca receita) → net **7.292,97→7.280,39** = metadata → K1 verde; fatura segue OPEN (0 pagamento, correto); os 15 débitos do Vision (já certos) intocados. Juiz manual pós: **✓ OK · balance 0 · dup 0 · venda 0 · cartão 0.** Fatura conferida no browser (7.280,39, 3 créditos visíveis). pg_dump `pre-cartao-fase4-20260818` antes. **DÉBITOS restantes:** (3) **jun/jul — 4 pagamentos com paidInvoiceMonth cujo net não bate** (12,50–345,93) — divergência conhecida, foco agosto, NÃO investigar. (4) **NON_LEARNABLE — 2 de 4 call-sites de `AiLearningRule` não checam `isCategoryLearnable`** (`apply.ts:248` CONTAINS, `auto-memorize-vendor.ts:93`; ambos atrás de flag OFF; runtime 0 hoje, K6 vigia). (5) **K5 versão por CRESCIMENTO** ("cresceu N em 30 dias sem mover") quando houver histórico de snapshots — hoje é por idade (30d). (6) **DEDUP de fatura só por `contentHash` (date+valor+desc) → REIMPORTAR A MESMA FATURA POR OUTRO PARSER DUPLICA** (18/08). O contentHash inclui a DESCRIÇÃO; Vision e o parser determinístico escrevem descrições diferentes pra a mesma linha → hash diferente → o confirm não vê como duplicata e recria. Foi por isso que o reprocess do Caixa agosto teve que ser CIRÚRGICO (`scripts/reprocess-caixa-agosto-creditos.ts`, adiciona só os 3 créditos faltantes) em vez de re-upload. **Solução futura (NÃO agora): dedup por `(cartão, invoiceMonth, data, |valor|, sinal)` ALÉM do hash** — aí trocar de parser não duplica. Registrado como débito, não construído.

## Estoque + Produção — decisões de arquitetura (19/08/2026, MÓDULO NOVO, FASE 0 em curso)

**Desenho completo em `~/Downloads/DESIGN_estoque_producao.txt`** (câmera = porta de entrada, mas o DADO vem da SEFAZ pela chave da nota; produção em 2 níveis com rendimento MEDIDO; estoque é LEDGER, saldo derivado; Real vs Teórico é o motor; 3 camadas desde o dia 1). Sprint FASE 0 em `~/Downloads/SPRINT_estoque_fase0.txt`.

**⭐ ISOLAMENTO É REGRA DURA (decisão do dono):** módulo TOTALMENTE isolado. Tabelas só `stock_`, migrations **SÓ CRIAM** (guard de CI `lib/stock/__tests__/migration-isolation.test.ts` — 0 ALTER/DROP, toda `CREATE TABLE` é `stock_`). `companyId` é **VALOR indexado, SEM `@relation`** às tabelas fechadas (Company/User) → a migration não referencia nenhuma tabela existente; multi-tenant via app + juiz E11. **PODE LER** Company/User/Supplier (nunca escreve). NÃO escreve em Transaction/Category/AccountsPayable/VendaDiaria/Loan/CreditCard/BankAccount/AiLearningRule/Supplier. Rotas `/empresas/:id/estoque/*` + `/api/empresas/:id/estoque/*`. Sidebar: seção própria "Estoque" (não dentro de Financeiro). Teste de isolamento: snapshot count das tabelas fechadas antes/depois = idêntico (`snapshotClosedModules`/`isolationHeld`).
- **Juiz do estoque = tabela PRÓPRIA `stock_judge_report`** (decisão 19/08), NÃO uma coluna em `loan_module_judge_reports` (respeita "migration não toca tabela existente" E fica mais isolado). Selo/e-mail agregam lendo as duas. Invariantes E10-E14 + isolamento; FASE 0 entrega **E12** (certificado vence < 30 dias). E10/E13/E14 (SEFAZ) entram no item 2; E11 quando houver dado.
- **Biblioteca SEFAZ = SOAP direto que a gente controla** (REGRA 4 — Ciência e download são os ÚNICOS pontos que falam com a SEFAZ, não espalhar): download `NFeDistribuicaoDFe` por **mTLS** (`https.Agent({pfx})` nativo, sem assinatura); Ciência (210210) por mTLS + **`xml-crypto`** (item 3); ler o .pfx com **`node-forge`** (CNPJ do OID 2.16.76.1.3.3 / CN + validade); parse XML com **`fast-xml-parser`**; `node:zlib` no docZip. **`nfe.io` REJEITADO** (SaaS — mandaria o cert pra terceiro, fura LGPD/isolamento).
- **⭐ FASE 0 item 1 (certificado A1) FEITO — 16 testes verdes, 0 regressão:** `lib/stock/{crypto,certificate,certificate-service,stock-invariants}.ts` + migration `20260819120000_stock_certificate` (CREATE-only, índice único PARCIAL "1 ativo/company" que funciona Postgres+SQLite) + rota + tela `/empresas/:id/estoque/certificado` + sidebar. **Cifra** AES-256-GCM (`node:crypto`), chave de `STOCK_CERT_ENC_KEY` (env). **REGRA 8 fiscal:** CNPJ do cert == Company.cnpj senão recusa; validade > hoje senão recusa. Golden: `.pfx` sintético real (node-forge 1024) → lê CNPJ/validade ao certo; CNPJ divergente/vencido recusa; um-ativo-por-company; E12; isolamento. **⚠️ 2 DÉBITOS (decisão do dono, servidor único hoje):** (a) `STOCK_CERT_ENC_KEY` no `.env` é aceitável AGORA; com mais clientes, sai pra COFRE (KMS/Vault) ou vira chave POR EMPRESA derivada de uma mestra; (b) se a chave for perdida/trocada, o `.pfx` cifrado vira lixo e o dono sobe de novo (o original é dele) — a tela DIZ isso ao não decifrar (`StockCryptoError` acionável), o juiz E12 alerta, NUNCA falha em silêncio.
- **⭐ MUDANÇA DE DESENHO (19/08, decisão do dono) — DATA DE CORTE, igual "agosto pra frente":** NÃO trabalhar notas antigas (mercadoria já recebida/consumida → daria estoque fantasma). Nota com `dataEmissao < corte` = **HISTORICA** (visível num filtro, SEM Ciência/parse/proposta/ação). Nota `>= corte` = **AGUARDANDO_MERCADORIA** (fila; NADA acontece — nem estoque, nem cadastro, nem contas a pagar — até a mercadoria CHEGAR e alguém CONFERIR/CONFIRMAR, padrão MarketMan, Fase 1). **Cadastro nasce NOTA A NOTA na conferência**, não em lote de 90 dias. Corte = dia do deploy do item 2.
- **⭐ FASE 0 item 2 (download SEFAZ) FEITO E RODADO EM PROD — 13 testes verdes:** `lib/stock/sefaz/` (client mTLS, envelope, parse-response, download, report, server-ca) + migration `20260819160000_stock_nfe_download` (stock_sefaz_state/log + stock_nfe `@@unique[companyId,chave]`). **NFeDistribuicaoDFe** no AN produção, NSU 0→14458, 23 páginas, **294 NF-e** (288 históricas 20/05–18/08 · **6 novas 19/08 = R$ 22.153,43**, fornecedores de alimentos DOCEOLI/CASPER/DIVINE/OESA/TOZZO). **0 Ciência enviada** (item 2 não tem esse caminho). **2 FIXES DUROS de A1 brasileiro + Node 20/OpenSSL 3** (achados só no shadow/diag em prod, não nos testes): (a) **passar `pfx` cru pro `https.request` → `ERR_CRYPTO_UNSUPPORTED_OPERATION`** (OpenSSL 3 recusa o PKCS#12 legado RC2/3DES/SHA1) → `pfxToPem` (node-forge lê o legado) extrai **key+cert PEM**, o TLS nunca abre o pkcs12; (b) **`unable to get local issuer certificate`** — a cadeia do CLIENTE ia em `ca` (que é o trust do SERVIDOR); fix: `cert` = leaf+intermediários (identidade do cliente), `ca` = `loadServerCa()` (roots do Node + **bundle do sistema `/etc/ssl/certs/ca-certificates.crt`**, o que o `curl` usa — o Node sozinho não tem o emissor do servidor SEFAZ). LIÇÃO: **o mTLS de A1 brasileiro em Node só funciona via PEM + CA do sistema; nunca `pfx` direto, nunca `ca`=cadeia-do-cliente.** Respeita bloqueio "consumo indevido" (656 → 1h). ⚠️ débito menor: `Company.state` da caçula estava vazio (preenchi RS no cadastro — o `cUFAutor` vem de lá; empresa sem UF trava a consulta com msg clara).
- **⭐ CORTE = 20/08 (decisão do dono): tudo até 19/08 é HISTÓRICO, estoque começa do ZERO.** `statusForNfe` (função única, REGRA 4) no download E no ajuste; `setDataCorte` reclassifica. Prod: **294 históricas, 0 na fila** (nasce vazia, enche sozinha). `Company.state` da caçula preenchido RS (cadastro faltando; o `cUFAutor` vem de lá).
- **⭐ FASE 0 itens 3(parse)+4+5 + CRON FEITOS E DEPLOYADOS — 23 testes novos (39 stock total), 0 regressão:** item 3 parse (`parse-nfe.ts` procNFe→itens/dup/emitente + `persist-nfe.ts` idempotente + migration `20260819190000_stock_nfe_itens` stock_nfe_item/dup/emit CREATE-only + **golden 1 NF-e REAL anonimizada ao centavo**: OLEO DE SOJA 926,40, dup 926,40, invariantes Σ itens==vProd/Σ dup==vNF; NOVA completa parseia, histórica NÃO). Item 5 tela `/empresas/:id/estoque/recebimentos` (fila nasce VAZIA + painel históricas "sem ação, não entram no estoque"; sidebar). Item 4 relatório no endpoint. **CRON horário** (`scripts/cron-sefaz-download.ts` no crontab `0 * * * *`, toda empresa com cert ativo, respeita bloqueio 1h). **FALTA (item 3): Ciência (evento 210210 assinado com xml-crypto) — fallback pra nova que vier SÓ RESUMO.** Deferida de propósito: as 6 novas do contador já vieram COMPLETAS (ele pré-manifesta) → o parse dispara direto; a Ciência só é testável end-to-end quando aparecer uma resumo-only real (não shipar crypto de assinatura sem poder provar contra o endpoint de evento). **Conferência completa + cadastro nota-a-nota + câmera = Fase 1** (próximo sprint).
- **⭐ FASE 1 item 1 (fundação do LEDGER) FEITO E DEPLOYADO — camada 1 PROVADA contra Postgres real, 9 testes, 0 regressão:** migration `20260820140000_stock_fase1` (CREATE-only): `stock_item` · `stock_supplier` (isolado; LÊ Supplier pra sugerir linkar) · `stock_supplier_product` (mapa aprendido, UNIQUE) · **`stock_movement` (o LEDGER)** · `stock_receipt_conference`/`stock_conference_item` · `stock_payable_suggestion` (ponte OFF) · `stock_sefaz_event` · `stock_saldo_cache`. **CAMADA 1:** `stock_movement` IMUTÁVEL (trigger `BEFORE UPDATE/DELETE → RAISE EXCEPTION` msg acionável; correção = ESTORNO+novo) + **CHECK inline** (no CREATE TABLE, sem ALTER): `quantidade<>0` e `|custoTotal − qtd*custoUnit| <= 0,01` POR LINHA. `lib/stock/movement.ts` (`assertMovementValid` runtime + `criarMovimento` + `estornarMovimento` oposto/idempotente/`estornoDeId`) + `lib/stock/saldo.ts` (saldo DERIVADO Σ movimentos, cache recomputável nunca-fonte). **Provado (`scripts/stock-fase1-prova-ledger.ts` em prod):** UPDATE/DELETE recusados · qtd 0 recusada · custoTotal torto recusado · **arredondamento 0,333×10,00=3,33 ACEITO** (a tolerância ±0,01/linha não vira porta de inconsistência) · CORREÇÃO cria→estorna→novo→SALDO FECHA. **Item 2 (conferência + posição) = o coração da fase; MOSTRAR A TELA antes de ligar o confirmar** (pedido do dono). Depois: 3 (eventos SEFAZ+xml-crypto) · 4 (golden) · 5 (juiz E1/E2/E3/E15) · 6 (câmera chave→SEFAZ; OCR gated) · 7 (modo teste que não grava).
- **⭐ FASE 1 itens 2/3/4 EM PROD — a FILA ENCHEU SOZINHA (cron provado): 5 notas reais de 20/08** (Frigorífico 12k · Isabel · Juliano · Bortolazzo · Alan). **⭐ CIÊNCIA (210210) PROVADA END-TO-END com nota REAL:** Frigorífico + Alan vieram SÓ RESUMO → `lib/stock/sefaz/{evento,recepcao-evento,ciencia}.ts` (xml-crypto, XMLDSig enveloped RSA-SHA1 C14N, endpoint `NFeRecepcaoEvento4`) → Ciência deferida → rebaixa → **XML completo veio, itens parseados (Frigorífico 6 · Alan 1)**. **2 FIXES DUROS de assinatura SEFAZ (só no dado real):** (a) **KeyInfo com a CADEIA inteira (4 certs) → cStat 225 "Falha no Esquema do lote"**; fix: assinar com **SÓ A FOLHA** no X509Data (a cadeia fica só no mTLS); (b) **`nSeqEvento` contava tentativas ERRO → cStat 594 "seq maior que permitido"**; fix: contar só `ENVIADO`. `EVENTO_OK`={135,136,573} (573 duplicidade = já deferido, ok). `scripts/sefaz-ciencia.ts`. **Item 2 (tela):** card da fila **CLICA** → `ConferenciaView` (componente ÚNICO REGRA 4) da NOTA REAL read-only (vê itens/mapeia/divergência+foto webcam-desktop/câmera-celular; CONFIRMAR **desligado** até o dono aprovar mobile+desktop) + preview modo-teste separado (treino). **FIX TZ (item 4):** `fmt` formatava do `new Date('2026-08-20')` → rolava pra 19/08 em -03:00; agora formata do texto YYYY-MM-DD. Dono testou a nota real no celular (criou "Coxão Mole", fluiu) → **LIBEROU o CONFIRMAR.**
- **⭐ CONFIRMAR LIGADO + POSIÇÃO — EM PROD (o coração da Fase 1):** `lib/stock/confirmar-conferencia.ts` (transação isolada, só stock_): cadastra fornecedor + itens novos nota-a-nota + **APRENDE** `stock_supplier_product (cProd→item)` (próxima nota do mesmo fornecedor já vem mapeada) · 1 `stock_movement` ENTRADA_NF por item pela **qtd RECEBIDA** (custo = vUnCom/fator) · conferência item-a-item (divergência/motivo/foto base64) · contas a pagar SUGERIDO das duplicatas (`stock_payable_suggestion`, **ponte OFF**) · nota sai da fila (status CONFIRMADA) · recompute saldo · **Confirmação 210200** assinada à SEFAZ (fora da transação — falha não desfaz o recebimento físico; retry pelo cron). Tela `ConferenciaView` (botão liga com `podeConfirmar`) → recibo. **Posição** `/estoque/posicao` (+ sidebar): saldo DERIVADO Σ movimentos, custo médio, valor, card por categoria; nasce vazia. Provado (3 testes integração): movimentos pela RECEBIDA (28≠30), item novo + mapa aprendido, 2 parcelas, DIVERGENTE_ACEITA, fora da fila, saldo bate (28KG/1120/40), idempotente, isolamento. **⚠️ O read-only da conferência NÃO grava (só visual); o mapeamento persiste só no CONFIRMAR.** **⚠️ O read-only da conferência NÃO grava (só visual); o mapeamento persiste só no CONFIRMAR.** O dono vai fazer a 1ª conferência REAL do Frigorífico validando junto (movimentos, parcelas, cStat 135, posição com os kg).
- **⭐ FICHA do produto (pedido do dono) — EM PROD:** `lib/stock/ficha-item.ts` + `/estoque/itens/[id]` (item da posição vira link). SEM modelo novo — lê o ledger: cabeçalho (saldo/custo médio/valor) + **HISTÓRICO DE COMPRAS** (cada ENTRADA_NF: data, fornecedor via join por chave, nº da nota extraído da chave, qtd, preço unit daquela compra, total; estorno destacado) + gráfico de preço no tempo (Recharts, 2+ compras). Preparada pra crescer (consumo/contagem/produção leem os mesmos movimentos). 4 testes. **Fix de teste:** o trigger de imutabilidade no dev sqlite vazava entre arquivos (SQLite compartilhado, travava cleanups de outros testes) → REMOVIDO do dev; imutabilidade é Postgres-only, provada por `scripts/stock-fase1-prova-ledger.ts` (igual empréstimo). **Ordem restante (dono pediu JUIZ ANTES da câmera, pra 1ª conferência nascer vigiada):** item 5 juiz E1(saldo cache==Σ)/E2(conferência tem movimentos que somam)/E3(nota confirmada tem payable)/E15(evento pendente>24h) → item 4 golden do fluxo completo → item 6 câmera chave→SEFAZ (OCR gated).
- **⭐ JUIZ DO ESTOQUE E1/E2/E3/E12/E15 — EM PROD, VERDE, VALIDANDO A CONFERÊNCIA REAL:** `lib/stock/{stock-invariants,run-stock-judge}.ts` + `scripts/cron-stock-judge.ts`. E1 cache==Σ movimentos · E2 conferência CONFIRMADA tem movimentos que somam os itens · E3 nota confirmada c/ duplicata tem payable sugerido · E12 cert<30d · E15 evento SEFAZ pendente/erro>24h. Persiste em **`stock_judge_report` (tabela PRÓPRIA, isolada — decisão Fase 0, não toca `loan_module_judge_reports`)**. Integrado no selo/e-mail/api SEM ALTER: `judge-selo-state` soma `stockIssues` (verde só se `passed && stockIssues==0`), `api/juiz` lê a tabela isolada (GET) + roda o juiz de estoque (POST), `cron-judge` roda+persiste+`stockChecks` no e-mail (crontab 3h já existente). **Rodada manual em prod 🟢 0 issues** validando o Frigorífico: 6 movimentos, 6 caches (E1 ok), 1 conferência com 6 movimentos (E2 ok), 2 duplicatas → 2 payables (E3 ok). 5 testes (válido→0; E1/E2/E3/E15 cada um pega quebrado). **Ordem seguinte (dono, 20/08): 2 tela `/estoque/movimentos` (extrato do estoque) → 3 min/max + barra de status na posição → 4 fechar Fase 1 (recebimentos badge idade + "Recebidas" + recibo persistido + golden fluxo + câmera chave→SEFAZ).**
- **⭐ ROADMAP ESTOQUE — FASES 2/3/4 (registrado 21/08, NÃO construído; design Fase 2 completo em `~/Downloads/DESIGN_producao_fase2.txt`, estudo de Apicbase/Galley/Vuca/SuFlex/MarketMan).** **FASE 2 PRODUÇÃO:** setores (COZINHA 1º) + colaboradores (nomes) + **fichas técnicas VERSIONADAS** (componentes recursivos, ciclo proibido, `loteBase` escalável, `rendimentoMedio` DERIVADO média-móvel N=5 "a apurar", `custoTeorico` recalcula quando NF muda, sem custo→"a definir" NUNCA 0,01) · **ordem de produção 5 estados** (PLANEJADA→SEPARADA→EM_PRODUCAO→CONCLUIDA|CANCELADA, origem MANUAL|SUGESTAO min/max, parada>Xh=alerta, cancelada pós-separação DEVOLVE insumos) · **separação/picking** (explosão da ficha, pré-preenchido, imprimir p/ câmara, movimento `SEPARACAO_SAIDA` estoque-geral→armazém virtual EM-PRODUÇÃO — o teórico se move com o progresso) · **conclusão fluxo do dono** (consumo real+devolução, "quantos saíram?", COLABORADOR, compara rendimentoMedio ±15%=alerta, custo REAL do lote, imprime etiquetas Zebra 60x60 lote=idOrdem, produção PARCIAL 300 de 500) · **movimentos novos** (enum já previsto Fase 1): `SEPARACAO_SAIDA`/`DEVOLUCAO_PRODUCAO`/`PRODUCAO_CONSUMO`/`PRODUCAO_GERACAO`; **invariante contábil P1: Σ SEPARACAO_SAIDA == Σ PRODUCAO_CONSUMO + Σ DEVOLUCAO_PRODUCAO** (nada evapora entre câmara e panela) · **cardápio/margem** (PRODUTO_FINAL valorVenda, margem ao vivo, "a definir" cobra — anti-0,01) · telas `/estoque/{producao,producao/[id],fichas,cardapio}` · **juiz P1-P7** (P1 invariante contábil · P2 ordem parada>24h · P3 rendimento fora ±25% · P4 em-produção com saldo SEM ordem aberta=vazamento · P5 PRODUTO_FINAL valorVenda nulo>14d · P6 ficha componente sem custo>7d · P7 etiqueta lote vencida ainda válida) · ordem 2.0 setores+colab+fichas → 2.1 ordem+separação → 2.2 conclusão → 2.3 etiquetas Zebra (agente USB, teste físico freezer) → 2.4 min/max+cardápio → 2.5 juiz+golden · perguntas abertas ao dono: setores além de COZINHA? nº colaboradores? sobra de produção (estoque normal vs separado)? etiqueta por pacote ou por lote? **FASE 3 CONTAGEM:** template tela Contagem Diária do Vuca (inline, divergência na hora, "não contados >7d", 0/N, ação em massa) + Desperdícios por motivo + aba Divergências + Comparativo valor unitário + Real vs Teórico (o motor que paga o módulo). **FASE 4:** Pedido/Cotações/Lista de Compras + sugestão de compra (min/max+consumo+lead time) + **CMV por CONSUMO no DRE** (competência, não caixa — o dia que o DRE fica honesto) + armazéns múltiplos quando precisar. Isolamento total continua em todas.
- **⭐ 1ª CONFERÊNCIA REAL FEITA (Frigorífico, 6 itens, posição R$ 11.763,15) — o ciclo fechou.** **DIFF 249,74 EXPLICADO = ICMS-ST** (Substituição Tributária): a nota tem vProd 11.763,15 (mercadoria, entrou no estoque) + vST 249,74 = vNF 12.012,89; frete/IPI/desconto = 0; nenhum item veio a menos (qtdNota==qtdRecebida). **Decisão contábil (registrada, correta hoje):** estoque valora pelo **vProd** (custo da mercadoria); o contas-a-pagar pega o **vNF** (com ST, o que se paga) via duplicatas. Débito futuro (decisão do contador): se quiser alocar ST/frete ao custo do item, é rateio — não feito, product-value é honesto e padrão.
- **⭐ SPRINT VISUAL (dono: "nível líder, melhor que o Vuca") #0+#1 EM PROD:** **#0 bug dos nomes** — o prefixo numérico do código do fornecedor entrava no nome (`sugerirNome` agora faz strip) + **renomear INLINE** (lápis, `NomeEditavel` componente único) na ficha e posição via PATCH `/estoque/itens/[id]` (o nome é do DONO, não da nota); os 6 do Frigorífico renomeados por ID. **#1 posição nível líder** (a tela de trabalho diária): cards de valor por categoria (clicam→filtram) + total · busca · ordenação (valor/nome/idade) · tendência de custo (seta subiu/desceu vs compra anterior) · badge de idade da última entrada (hoje/N dias, amarelo>7/vermelho>14, padrão Vuca) · agrupar por categoria colapsável · mobile em cards. **FALTA do sprint visual:** #2 recebimentos mais rico (badge "aguardando há X dias" amarelo>2/vermelho>5 + histórico "Recebidas" com link pro recibo) · #3 recibo persistido/acessível depois · #4 consistência visual com Vendas. Depois: juiz (item 5) → golden (4) → câmera (6).
- **⭐⭐ FASE 1 DO ESTOQUE ENCERRADA E DEPLOYADA (21/08) — o LEDGER inteiro fecha nas 3 camadas, tela nível-Vuca, ciclo real provado. Próximo = FASE 2 (produção).** **CONSTRUÍDO (Fase 1 completa):** (1) fundação do ledger — `stock_movement` IMUTÁVEL (trigger Postgres, correção = estorno+novo) + CHECK por linha (qtd≠0, |custoTotal−qtd·custoUnit|≤0,01), saldo DERIVADO Σ movimentos (cache recomputável nunca-fonte); (2) conferência + CONFIRMAR (`confirmar-conferencia.ts`: cadastra fornecedor + item nota-a-nota + APRENDE `stock_supplier_product` cProd→item, 1 ENTRADA_NF por item pela qtd RECEBIDA custo=vUnCom/fator, contas-a-pagar SUGERIDO das duplicatas [ponte OFF], Confirmação 210200 fora da transação); (3) Ciência 210210 provada end-to-end (xml-crypto, folha-só no KeyInfo, nSeqEvento só ENVIADO); (4) POSIÇÃO nível-líder (valor por categoria, busca/ordenação, tendência de custo, idade); (5) FICHA do produto (histórico de compras do ledger, gráfico de preço); (6) MOVIMENTOS `/estoque/movimentos` (extrato: filtros item/tipo/período, referência clicável, estorno destacado, CSV); (7) MÍN/MÁX + barra de status na posição (`statusEstoque` fonte única: verde dentro/vermelho abaixo/azul acima/cinza sem-mín, borda por status, filtro "N abaixo do mín", CSV; mín editável na ficha, valida mín<máx); (8) RECIBO persistido (URL estável `/estoque/recibos/[conferenceId]`, derivado de conferência+itens+movimentos+duplicatas, linkado da nota/Recebidas/ficha; mostra vProd "entrou" vs vNF "total" + diferença ST/frete); (9) "deixar pra depois" (`stock_nfe_adiada`, CREATE-only — o dono adia nota da fila e SILENCIA o badge "aguardando há X dias"; a nota fica cinza, reversível — as 4 notas atuais vão marcadas assim); (10) seção "Recebidas" (confirmadas); (11) câmera/chave→SEFAZ ("chegou sem aparecer na fila" — consChNFe por chave de 44 dígitos → fila; idempotente; **`persistSefazDoc` = porta ÚNICA** REGRA 4: download E busca-por-chave gravam pelo mesmo helper); (12) JUIZ E1/E2/E3/E12/E15 em `stock_judge_report` (tabela isolada) integrado no selo/e-mail/cron. **TESTES:** 92 stock verdes (18 arquivos), 0 TS, 0 regressão. **GOLDEN do fluxo completo** (`fluxo-completo-golden.integration.test.ts`): NF-e real anonimizada → parse → persist → conferência → confirmar → movimentos AO CENTAVO, com divergência (recebido 118≠120 → valor entra 910,96; **a duplicata segue o total da nota 926,40**, não o recebido) e sem. Camada 1 (imutabilidade) provada contra Postgres real (`scripts/stock-fase1-prova-ledger.ts`; trigger é Postgres-only, tirado do dev sqlite). **CICLO REAL FECHADO:** 1ª conferência (Frigorífico 6 itens, posição R$ 11.763,15; diff 249,74 = ICMS-ST, estoque valora vProd, contas-a-pagar cobra vNF — decisão registrada). **JUIZ manual em prod 🟢 0 issues.** **ISOLAMENTO mantido:** toda tabela nova é `stock_`, migration `20260821140000_stock_nfe_adiada` CREATE-only (guard verde), `companyId` VALOR sem @relation, snapshot dos módulos fechados idêntico. pg_dump `pre-estoque-fase1-item4` (4.6M) antes. **DÉBITOS da Fase 1 (registrados, não urgentes):** (a) **mín<máx é validado na ROTA (app-level), não CHECK no banco** — o `stock_item` já existe e o isolamento proíbe ALTER; tabela nova de estoque nasce com CHECK inline, a existente fica no app + juiz; (b) **câmera lê a chave por DIGITAÇÃO; o decode de barcode/OCR está GATED** (mesmo padrão do PDF Vision) — ligar quando escolher a lib de scan; (c) recibo é derivado (não há PDF/impressão — só a tela); (d) STOCK_CERT_ENC_KEY no .env (→ cofre com mais clientes) e retenção de docXml (auditoria) seguem como estavam. **PRÓXIMO: FASE 2 (produção) pelo `~/Downloads/DESIGN_producao_fase2.txt` item 2.0 — setores + colaboradores + fichas técnicas versionadas.** Roadmap Fases 2/3/4 já registrado acima; isolamento total continua; REGRA 2 em cada tela nova.
- **⭐ FASE 2 item 2.0 EM PROD (21/08) — cadastros da produção (setor + colaborador + FICHA técnica versionada). SEM ordem ainda.** 5 tabelas `stock_` (setor/colaborador/ficha/ficha_versao/ficha_componente), migration `20260821170000_stock_fase2_fichas` CREATE-only (guard verde), isolamento mantido. **Ficha VERSIONADA:** HEAD (item produzido + tipo + `versaoAtual` + `valorVenda`) + VERSÃO (corpo: componentes, `loteBase`, preparo, `validadeDias`). **Editar componente/qtd/lote → versão NOVA** (`atualizarFicha`, ordens antigas apontam pra versão da época); mudar só preço/setor/nome → in place. **CICLO proibido** (`detectaCicloFicha` puro: A não pode conter B se B contém A em qualquer nível; recursão legítima permitida — xis usa pacote que usa carne). **Custo teórico AO VIVO** (`calcularCustoTeorico`: Σ custoMedio×qtd; **"a definir" quando falta custo, NUNCA 0,01**; custo/unidade "a apurar" sem rendimento — 2.0 não tem produção, rendimentoMedio=null). Item produzido nasce `stock_item` categoria INTERMEDIARIO|PRODUTO_FINAL (String livre, sem migration de enum). Editor (`ficha-editor.tsx`) com busca de componentes + custo ao vivo; telas `/estoque/fichas`(+nova+[id]) + `/estoque/producao/cadastros`; sidebar "Fichas técnicas". 110 stock testes (era 92), 0 TS. **FIX (21/08): custoMedio da ficha vinha do campo `stockItem.custoMedio` (null — o confirm não popula) → editor mostrava "sem custo" pra Coxão/Açém que TÊM custo na Posição. Unificado em `custoMedioPorItem` (fonte única, derivado dos movimentos = mesma da Posição): editor + getFicha leem daí. "Sem custo" fica só pra item que nunca teve nota. Prova SQL prod (Coxão 46,95/Açém 33,95) + REGRA 1. Também "criar item novo" na busca de componentes (molho/sal sem nota → nasce sem custo/movimento, "a definir"; o custo chega na 1ª nota).**
- **⭐ GOLDEN da 1ª ficha real (21/08):** "Porção de Carne 100g" v3 = Coxão 46,95 + Açém 33,95 + Gordura 9,60 = **custo do lote 90,50 ao centavo**, custos derivados do ledger. Fixture `golden-ficha-carne.test.ts` (receita, anti-PII). Trava o custo teórico + a leitura derivada.
- **⭐ FASE 2 item 2.1 EM PROD (21/08) — ORDEM DE PRODUÇÃO + SEPARAÇÃO + armazém virtual em-produção.** Fluxo do dono no ledger: cria ordem (ficha × escala do lote base, **snapshot da versaoFicha**) → separação PRÉ-PREENCHIDA da ficha → ajusta o que REALMENTE tirou da câmara → confirma → **`SEPARACAO_SAIDA`** (insumo sai do estoque geral, quantidade NEGATIVA, e entra no **armazém virtual "em-produção" = DERIVADO dos movimentos com `receiptId=ordemId`, NUNCA tabela de saldo à parte**). Sobra volta com **`DEVOLUCAO_PRODUCAO`**. Cancelar DEVOLVE tudo (nada some). **5 estados** PLANEJADA→SEPARADA→EM_PRODUCAO→CONCLUIDA|CANCELADA — **CHECK inline no banco** (`chk_production_order_estado` + `chk_production_order_escala`, CAMADA 1: estado inválido impossível). `lib/stock/producao/ordens.ts` (criar/explodirSeparacao/confirmarSeparacao/iniciar/devolver/cancelar; movimentos pelo helper único validado). Telas `/estoque/producao`(lista+nova) + `/estoque/producao/[id]`(stepper + separação editável + imprimir p/ câmara + devolver + cancelar); sidebar "Produção". 123 stock testes (7 de ordem: separa tira do estoque, devolve volta, cancela devolve tudo, não separa 2×, não produz sem separar, isolamento). Migration `20260821200000_stock_production_order` CREATE-only (guard verde). **⚠️ movimentos de produção usam `receiptId` como ref da ordem (não dá pra ALTER stock_movement sob o isolamento) — mesmo padrão do conference (receiptId=conferenceId); o `tipo` desambigua.** O dono fez a 1ª separação real (Coxão+Açém+Gordura 1kg, R$ 90,50 em produção, posição caiu ao centavo). **Aviso leve** quando o separado destoa da escala (criou 100×, separou 1×) — não trava; o rendimento vai contra o REAL.
- **⭐ FASE 2 itens 2.2 (CONCLUSÃO) + 2.3 (ETIQUETAS) EM PROD (21/08).** **2.2 "quantos saíram?":** confirma o consumo REAL (pré = em-produção, sobra volta) → **`PRODUCAO_CONSUMO`** (baixa da produção) + **`PRODUCAO_GERACAO`** (o produto ENTRA no estoque com o CUSTO REAL do lote) → **rendimento MEDIDO contra o consumo real, NUNCA a escala** (`escalaConsumida` = consumido/lote-base; rendimento = qtdGerada/escala) → compara com a **média móvel das últimas 5 (±15%)** → registra. **Colaborador** + **produção PARCIAL** (300 hoje/200 amanhã = várias conclusões na mesma ordem; a última devolve a sobra e fecha CONCLUIDA). Golden (`conclusao.integration.test.ts`): 1kg de cada → **17 saíram → rendimento 17, custo do lote 90,50, produto 5,32/UN**. **⭐ DECISÃO DE LEDGER (não duplica a baixa):** `PRODUCAO_CONSUMO` é **transferência interna** (o insumo já saiu da prateleira no `SEPARACAO_SAIDA`) → **EXCLUÍDO do saldo de prateleira** (`saldo.ts` filtra `tipo != PRODUCAO_CONSUMO`); `PRODUCAO_GERACAO` entra no item produzido. Como saldo/cache/E1/posição usam TODOS `saldosDaEmpresa`, **uma exclusão só mantém tudo coerente** (REGRA 4/5). **Invariante P1 provado: Σ|SEPARACAO| == Σ|CONSUMO| + Σ|DEVOLUCAO|** (nada evapora entre câmara e panela). O custo unit do produto vai em **precisão cheia** (qtd×custoUnit == custoLoteReal exato, senão o CHECK do ledger recusa por arredondamento — mordeu no teste, corrigido). **2.3 ETIQUETAS Zebra 60×60:** produto, **lote (= id da ordem)**, manipulação, validade (`dataProducao`+`validadeDias`), qtd, colaborador, **QR do lote**; tela imprimível + **baixar ZPL cru** (`etiqueta.ts` `etiquetaZpl`; o agente USB da Zebra é frente à parte). Por LOTE (1) ou por UNIDADE (N). `stock_producao_conclusao` CREATE-only (CHECK qtdGerada>0). 131 stock testes. **⭐⭐ FASE 2 (PRODUÇÃO) FECHADA NAS 3 CAMADAS E DEPLOYADA (21/08).** Itens 2.0→2.5 em prod. **2.4:** SUGESTÃO de produção (item produzido com ficha abaixo do mín → "produzir ~N pra voltar ao máx" no home, 1 toque cria ordem PLANEJADA) + CARDÁPIO/MARGEM (`/estoque/cardapio`: PRODUTO_FINAL com custo REAL do ledger, preço editável inline no `valorVenda` da ficha, margem ao vivo, "a definir" no topo — nunca 0,01, CSV). **2.5 JUIZ P1-P6** (`producao-invariants.ts`, integrado no `checkStockInvariants` → selo/e-mail/cron, tabela isolada `stock_judge_report`): **P1** Σ|SEPARACAO|==Σ|CONSUMO|+Σ|DEVOLUCAO| em ordem CONCLUIDA · **P2** ordem parada >24h · **P3** rendimento fora ±25% da média · **P4** em-produção preso em ordem encerrada (vazamento) · **P5** produto final sem preço >14d · **P6** componente sem custo >7d. **P7 (etiqueta vencida ainda vendida) DEFERIDO** (depende de BAIXA_VENDA/fase 3). GOLDEN do fluxo completo trava a 1ª produção real (1kg de cada → 25 UN, 3,62/un) com 0 P; cada P tem red-then-green. **⭐ MARCO — a defesa em 3 camadas se pagou NO 1º DIA da Fase 2 (21/08):** o juiz noturno pegou um bug (E1) que passou pelas camadas 1 (construção) e 2 (golden) na 1ª produção real. Prova viva de que "auditado post-factum" não é redundância — é a rede que pega o que escapou. **BUG pego pelo próprio juiz:** as movimentações de produção não recomputavam o `stock_saldo_cache` (só a conferência fazia) → E1 vermelho (cache 102,68 vs Σ real 101,68; produto sem cache). Fix: `recomputeSaldoCache` após separar/concluir/devolver/cancelar (posição sempre esteve certa — é derivada; era o cache que driftava). Recomputado em prod → **juiz VERDE pra produção (P1-P6 0, E1 0)**. **141 stock testes.** ⚠️ **Resta E15 (pré-existente, NÃO é produção): 2 eventos de Ciência SEFAZ (210210) de notas HISTÓRICAS em ERRO >24h — retry de Ciência que não pegou; débito à parte.** **⭐ (c) E15 FANTASMA RESOLVIDO (22/08):** os 2 E15 em ERRO eram RUÍDO — as notas já estavam manifestadas (750619 tem 210210 seq1 ENVIADO 135; 483080 tem 210200 ENVIADO 135, Confirmação supera Ciência). Fix: E15 só flagra nota SEM nenhum evento ENVIADO. Juiz do estoque agora **🟢 0 issues**. Débito: sem cron de retry de evento (o seq-2/594 veio de re-run manual) + parser podia salvar a resposta crua no erro de parse. **⭐ (a) AGENTE USB DA ZEBRA EM PROD (22/08):** `scripts/zebra-agent.mjs` (Node puro, roda no PC do estoque: localhost HTTP → `lp -o raw`/PowerShell → Zebra USB; localhost é trustworthy, o app HTTPS fala com ele). Etiqueta tem "Imprimir na Zebra"; **ao CONCLUIR a produção o app já vai pra etiqueta com `?print=zebra`** → sai direto na impressora. Fallback papel/ZPL. **Dono vai fazer o teste físico no freezer com a bobina atual.** **FASE 2 FECHADA (2.0→2.5 + Zebra).** **PRÓXIMO: FASE 3 (contagem estilo Vuca + baixa por venda via Suitable + Real vs Teórico).** ⚠️ **PREP FASE 3 (dono levantando): formato que o Suitable exporta vendas POR PRODUTO** — o que preciso: por dia, `identificador do produto (nome ou código) + qtd vendida + data` (CSV/relatório/API — qualquer um serve; ideal API ou CSV agendado). Com isso: `BAIXA_VENDA` (baixa o PRODUTO_FINAL do estoque por venda) + Real vs Teórico (consumo real de insumo vs o que as fichas diziam) — o motor que paga o módulo. P7 (etiqueta vencida ainda vendida) liga junto (precisa da venda).
- **⭐ FORMATO SUITABLE LEVANTADO + FASE 3 PASSO 1 (import) EM PROD (22/08).** O relatório do Suitable é um **.xls que é HTML** (`<table>` Produto|Quantidade|Valor Extra|Valor total; **SEM data** — o período fica na tela do Suitable → o import PERGUNTA a data; **NOME sem código**). Golden real (`lib/stock/vendas/__tests__/fixtures/suitable-produtos-agrupado.xls`): 80 produtos, 494 unidades, Combo Caçula 57 (campeão). **`parseSuitable`** (regex, sem dep). **Mapa que APRENDE** (`stock_venda_produto_map`, nome → FICHA|REVENDA, UNIQUE por nome): 1ª vez o dono aponta, depois automático (= cProd dos fornecedores); duplicata do PDV (`XIS COMPLETO`/`XIS - COMPLETO`) → mesma ficha; renomear no Suitable = nome novo, pergunta de novo. Tela `/estoque/vendas` (upload → preview → mapear inline) + sidebar "Vendas (Suitable)". `stock_venda_import` UNIQUE `[companyId,data]` (idempotente por dia, reimportar substitui). 154 stock testes. **DECISÕES pra a baixa (dono, 22/08):** casamento por NOME EXATO; **Combo Caçula é COMPOSTO** (ficha aponta pros componentes, explosão recursiva); **bebida/revenda (Coca/Skol/água) baixa direta do item REVENDA, sem ficha**. **PRÓXIMO (Fase 3 passo 2): BAIXA_VENDA** — o dono informa a data → cada venda baixa o estoque; **explosão: produto que MONTA na venda (PRODUTO_FINAL) explode nos componentes recursivamente; INTERMEDIÁRIO batch-produzido baixa o pack; raw/revenda baixa direto** (regra por `tipoProduto`, sem coluna nova — isolamento proíbe ALTER em stock_ficha; override per-ficha = débito). Idempotente (reimport = estorna as BAIXA_VENDA antigas + refaz, movimento é imutável). Depois: contagem estilo Vuca + Real vs Teórico + P7.
- **⭐ FIX 3 NÍVEIS no mapa de vendas (22/08) — o dono pegou a violação antes de mapear.** A tela listava TODOS os itens (matéria-prima como vendável) e o intermediário aparecia 2×; mapear "XIS - COXAO MOLE" (lanche) no Coxão cru baixaria 1kg de carne crua por xis. **FIX:** destino de venda = SÓ ficha **PRODUTO_FINAL** + item categoria **REVENDA** (matéria-prima nunca; intermediário consumido VIA ficha, nunca destino direto). **GUARD NA FONTE** (REGRA 1, não só escondido): `upsertVendaMap` RECUSA ficha INTERMEDIARIO e item ≠ REVENDA (`VendaMapError`→422). Dropdown ganhou **"+ criar ficha de produto final"** (abre o editor no tipo PRODUTO_FINAL, nome pré-preenchido do Suitable) e **"+ criar item de revenda"** (cria UN/REVENDA e mapeia). **Recursão dos 3 níveis CONFIRMADA por teste:** ficha PRODUTO_FINAL aceita intermediário (Xis usa porção de carne) E outra ficha final (Combo usa Xis) como componente. 156 stock testes. ⚠️ **PERGUNTA ABERTA pro dono (afina a explosão da baixa):** vender um Xis consome a porção de carne JÁ produzida em lote (baixa o pack) ou monta na hora do coxão? Default: PRODUTO_FINAL monta na venda (explode), INTERMEDIARIO é batch (baixa o pack) — confirmar com exemplo real ao mapear.
- **⭐ FLUXO REAL DO DONO — PRODUÇÃO EM 2 ELOS (confirmado 22/08):** Acém+Coxão+Gordura → máquina → **GESSADO** (carne moída, interm. 1) → molda → **BEEF DE XIS / BEEF DE HAMBURGUER** (interm. 2). A ficha do **XIS COMPLETO** (PRODUTO_FINAL) = 1 beef de xis (batch, **para nele**) + **pão de xis (insumo DIRETO, entra por nota da padaria, SEM produção)** + queijo + maionese. Bebida = revenda direta. **CONFIRMADO por teste (`cadeia-2elos.integration.test.ts`):** intermediário consome OUTRO intermediário — elo 1 gessado consome as carnes com PERDA de peso (3kg→2,85kg), custo medido 31,75/kg; elo 2 beef consome o GESSADO do estoque (baixa o pack), custo herdado (3,35/un); **rendimento e custo medidos em CADA elo**; ciclo bloqueado continua. **DEPENDÊNCIA ENTRE ORDENS (aviso, sem orquestração automática):** `explodirSeparacao` devolve `fichaIdComponente`; na ordem, se um componente PRODUZIDO falta no estoque, a tela avisa "tem X, precisa Y" + botão **"produzir antes"** (cria a ordem do componente e navega). **Ordem que o dono vai montar quando a rotina começar: gessado → beef de xis → xis completo → combo.** Por ora: mapear bebidas + ficha do xis com a porção de carne atual. 160 stock testes.
- **⭐ FIX CONVERSÃO DE UNIDADE na conferência (22/08) — o dono pegou antes de confirmar a Bortolazzo.** Nota real "FRUKI GUARANA 600ML 12UN · 3 EB · R$45/EB" (EB = caixa de 12; controle em GARRAFA/UN). A tela mostrava "recebido 3" tratando caixa como garrafa → confirmaria 3 UN em vez de 36, custo 12× errado. **O backend já suportava `fatorConversao`** (confirmarConferencia: `custoUnitario=vUnCom/fator`, grava qtd convertida, aprende em `stock_supplier_product`); faltava a TELA. **Buracos corrigidos:** (1) mapear pra item EXISTENTE com unidade ≠ da nota FORÇAVA fator 1 → agora PERGUNTA o fator (mostra "3 EB = 36 UN · R$ 3,75/UN" ao vivo); (2) `sugerirFatorConversao(xProd)` sugere pelo nome ("12UN"→12, "C/6"→6, "CX24"→24; "SKOL 600ML"→null, digita); (3) qtdRecebida pré-preenchida JÁ em UN convertida. Fator fica aprendido → próxima nota do fornecedor converte sozinha (`conference.ts` já traz o fator do mapa). **GOLDEN:** 3 EB × 45 fator 12 → 36 UN a 3,75, valorEntrada 135, fator aprendido. 163 stock testes. **Vale 1:1 também** ("SKOL 600ML 1 CX = 24 garrafas" pergunta igual). ⚠️ **A Bortolazzo estava esperando o fix** — agora pode conferir (fixture real perfeito do golden).
- **⭐ FIX 2 CONVERSÃO — fator SEMPRE visível + vem da NF-e (bug da Skol, 22/08).** "CERV SKOL 600ML · 1 CX · R$169,20" — a pergunta do fator só rodava onde o nome sugeria; na Skol não apareceu, esperado ficou 1, o dono digitou 20 na mão e a tela marcou DIVERGÊNCIA pedindo motivo FALSO (a caixa TEM 20 — motivo falso sujaria o Real vs Teórico). **FIX:** (1) na linha mapeada, quando `uCom` ≠ unidade de controle, o **fator fica SEMPRE visível e editável inline** (conta ao vivo "1 CX = 20 UN · R$ 8,46/UN"; fator 1 com unidade de caixa → amber "confira"); é o próprio "ajustar fator" (corrige até fator gravado errado; movimentos antigos só por estorno). (2) divergência compara DEPOIS da conversão (já era). **SOLUÇÃO DE FUTURO — a dupla unidade da NF-e:** `qTrib/uTrib` (já gravados no `stock_nfe_item`) resolvem o fator quando `uTrib` é unidade de controle → `fatorDaNota = qTrib/qCom` (Skol 1 CX / 20 UN trib → sugere 20, botão "a nota diz 20", 1 toque). **ORDEM de resolução (nunca em silêncio):** (1) mapa aprendido fornecedor+produto → (2) qTrib/uTrib da nota → (3) sugestão pelo nome (12UN) → (4) pergunta. GOLDEN: Skol 1 CX=20 UN trib → fatorNota 20; óleo uTrib==uCom → null. 165 stock testes. **DÉBITO: EAN (cEAN, já parseado) pra casar produto novo de fornecedor novo no MESMO item (a Coca da distribuidora X e Y têm o mesmo EAN) — precisa de tabela `stock_item_ean` (CREATE-only), não construído.** **Agora o dono confere a Bortolazzo inteira de uma vez (Frukis ×12 + Skol ×20).**
- **⭐ FASE 3 PASSO 2 — BAIXA_VENDA + fluxo diário EM PROD (22/08).** Redesenho do fluxo de vendas (padrão Apicbase/MarketMan; a tela antiga era beco sem saída): **mapear = cadastro permanente** (chip verde "→ destino" + lápis pra trocar, não volta pro "escolher"); **não-mapeado = pendente que NÃO trava**; **botão "Processar vendas (N mapeados · M pendentes)" SEMPRE visível** (parcial é normal). **Fluxo:** informa a DATA (arquivo não traz) → PREVIEW (o que baixa agregado + explosão + pendentes que não baixam) → CONFIRMAR → **BAIXA_VENDA no ledger** → RECIBO do dia. **BAIXA_VENDA** (`baixa-venda.ts`): **explosão recursiva** (Combo→Xis→beef+pão), **revenda direta** (Coca), **idempotente por dia** (reprocessar estorna as baixas anteriores e refaz — movimento imutável). `stock_venda_linha` guarda as linhas (pendentes + reprocessar sem re-upload). **Filtro "só pendentes" + busca** (80 linhas). **Juiz V1** (`vendas-invariants.ts`, **nível AVISO — NÃO deixa o selo vermelho**): venda importada sem destino > 7 dias (mapear a cauda longa é decisão do dono). `StockInvariantFail.nivel='aviso'` não conta no `stockIssues` do selo. 169 stock testes. Migration `stock_venda_linha` CREATE-only. **DÉBITO: EAN cross-fornecedor (futuro). PRÓXIMO: dono processa o 1º dia real; depois contagem estilo Vuca + Real vs Teórico (o motor que paga o módulo).**
- **⭐ FIX 1º processamento falhou em silêncio (22/08) — 3 problemas.** BUG 1 date picker não abria (Safari/Mac) → `showPicker()` no clique + campo visível + validação "escolha a data". BUG 2 processar sem feedback → `erroProc` dedicado ao lado do botão; QUALQUER falha (data vazia, 0 marcados, parse, servidor) vira mensagem visível (nunca silêncio). DESENHO 3 (fluxo líder): **CHECKBOX por linha mapeada** (escolho o que entra neste processamento; mapeado não-marcado → "fora", não baixa nem é pendente) · botão "Confirmar baixa de N produtos" → preview → confirmar · **aba PROCESSADOS** (histórico por dia: data, baixados, valor, pendentes + **reprocessar** a partir das linhas gravadas, sem re-upload, com o mapa atual) · 2 áreas claras (MAPEAMENTO / PROCESSAR O DIA). Engine: `montarPlanoDeLinhas` (incluir→fora), `reprocessarDia` (linhas do banco), `listProcessados`. 171 stock testes (5 de baixa: explosão, idempotência, reprocesso menor, incluir/fora, reprocessarDia). ⚠️ **date picker corrigido via `showPicker()` (fix padrão Safari) mas NÃO validado em browser real — pedir smoke do dono no Safari desktop+celular (REGRA 2/validação visual obrigatória).**
- **⭐ FIX modal + reprocessar (22/08) — a baixa de 21/08 gravou (2 baixados · R$ 32,88 · 78 pendentes).** FIX 1 (modal parecia erro): redesenho — responde "o que acontece se eu confirmar?" numa tela: "Vai baixar (N)" em TABELA + custo total; pendentes = UMA linha NEUTRA cinza colapsada ("ver lista" → tabela limpa, nunca parágrafo laranja); "fora" idem. FIX 2 (reprocessar em silêncio — `confirm()` nativo + async no Safari): trocado por modal NOSSO; reprocessar segue o MESMO fluxo do processar (PREVIEW dry-run das linhas gravadas com o mapa atual → "estorna N baixas e refaz" → Confirmar → recibo). `montarPlanoReprocesso` (dry-run + conta baixas a estornar); a rota reprocessar respeita `confirmar` (preview vs executar). 171 stock testes. **Débito: o erro do dry-run do reprocesso usa `alert()` (visível, não silencioso) — trocar por toast quando houver.**
- **⭐ PARTE C — SAÍDAS QUE NÃO SÃO VENDA (perda/uso interno) EM PROD (22/08).** O buraco que a revisão achou (comps/spills/staff-meals dos líderes; tínhamos enum PERDA sem tela). `registrarSaida`: item → qtd → **MOTIVO obrigatório** (VENCEU/ESTRAGOU/CAIU_QUEBROU/ERRO_PREPARO/CONSUMO_FUNCIONARIO/USO_INTERNO/CORTESIA/OUTRO) → foto opcional → movimento **PERDA|USO_INTERNO** (por motivo) com custo REAL. **`stock_saida`** guarda o porquê — **motivo sem motivo é IMPOSSÍVEL por construção** (transação atômica + CHECK `length(trim(motivo))>0`/qtd>0/tipo). Relatório **`/estoque/perdas`** (por motivo + por item, R$) = insumo do Real vs Teórico. Modal "Registrar saída" na Posição + na tela de Perdas (busca item + motivo + foto webcam/câmera). **Juiz C1 (erro):** movimento de saída sem `stock_saida` (backstop). **C2 (aviso):** perda do item no mês > 30% do consumo (venda+produção). 179 stock testes. Migration `stock_saida` CREATE-only. **PARTE A já feita (modal+reprocessar).**
- **⭐ PARTE B EM PROD (22/08) — 2 telas manuais.** **B1 CATÁLOGO** (`/estoque/itens`, sidebar "Catálogo"): TODOS os itens (inclusive saldo zero, que a Posição esconde — ela só lista quem tem movimento). **"+ novo item"** (nome·KG/UN/LT·categoria-base·min/máx); item manual nasce SEM saldo e SEM custo ("a definir") — saldo só por nota/produção/contagem, ledger única fonte. **Intermediário/produto final só via ficha** (o "+ novo item" só oferece as 5 categorias-base). Dedup por nome. Busca + filtro (categoria/inativos) + editar nome inline + desativar/reativar (PATCH `ativo`). POST /itens agora aceita min/máx. **B2 LANÇAMENTO MANUAL** (aba em `/estoque/vendas`): tipo PDV pros dias sem o arquivo. **Vendáveis = só PRODUTO_FINAL + REVENDA** (mesmo guard 3 níveis). data → quantidades → MESMO fluxo preview/confirmar/recibo. **CONVIVE com o import do dia** (mescla as linhas por nome; reprocessar cobre os dois). Modal do plano extraído (`PlanoVendaModal`) — **1 componente pros 3 fluxos** (import, reprocesso, manual). 182 stock testes (3 de manual). **⭐⭐ PRÓXIMO = FASE 3 (o motor): CONTAGEM INICIAL (ponto-zero) + contagem rotineira Vuca + AJUSTE_CONTAGEM + Real vs Teórico. ⚠️ A CONTAGEM INICIAL É UM MOMENTO GRANDE (contar loja/câmara/freezer no CELULAR, andando, em ETAPAS POR ÁREA) — o dono quer OPINAR no fluxo: PARAR e perguntar ANTES de desenhar a tela da contagem (pedido explícito 22/08).**
- **⭐ DESENHO FASE 3 APROVADO (22/08, REGRA 2 no desenho) — 2 frentes: (1) usuários/permissões, (2) contagem.** **PARTE 1 (permissões) — o RBAC JÁ EXISTE e é usado no Financeiro** (`lib/auth/permissions.ts` chaves+wildcard, `resolveEmpresaAccess({requirePermission})`, `rbac.ts`, `Role`/`RolePermission`/`UserCompanyRole`/`CompanyInvite`, telas `/usuarios` e `/roles`, papéis OWNER/ADMIN/ACCOUNTANT/FINANCIAL/VIEWER). **Buraco:** rotas de estoque usam o check ANTIGO (`userCompany.findFirst`) = qualquer membro faz tudo; sem chave de estoque nem papel de operador. **Plano aprovado:** 3 chaves (`stock.view` ver · `stock.operate` contar/conferir/produzir/saída/venda · `stock.manage` ficha/min-máx/catálogo/mapa) + 2 papéis (**OPERADOR_ESTOQUE**=view+operate, sem financeiro; **LEITURA_ESTOQUE**=view só — leitura SÓ do estoque, decisão do dono) + ligar as rotas ao `requirePermission`. Login individual via `/usuarios`+convite (o ledger já grava `criadoPorId`; falta mostrar o nome). **Financeiro continua só do dono.** **PARTE 2 (contagem) — decisões do dono:** tela **`/estoque/contagem`** (lista ÚNICA agrupada por categoria, progresso 0/N por cat+geral, busca, filtro "não contados >7d"; por linha: produto · última contagem+hora [tap→QUEM contou] · saldo derivado no instante · campo contagem inline KG decimal/UN inteiro · divergência ao vivo qtd+R$ · check; **conta VENDO o teórico**; item nunca contado = "sem contagem" cinza, não zero; mobile impecável) + **`/estoque/contagens`** (sessões: retomar parcial, histórico, INICIAL). **CONTAGEM INICIAL = a mesma tela no 1º uso** (ajuste marcado INICIAL). **3 decisões aprovadas:** (a) **1 sessão ABERTA por vez**; (b) **ajuste na hora, por linha** (confirma linha → `AJUSTE_CONTAGEM` no ledger na hora, saldo bate andando); (c) **LEITURA só do estoque**. Modelo novo: `stock_contagem` (sessão) + `stock_contagem_item` (linha com saldoSistema snapshot, qtdContada, divergência, quem+quando, movementId do ajuste). Juiz: contagem finalizada tem ajustes que batem + E7 (item sem contagem >N dias, já existe) liga na tela. **Real vs Teórico logo atrás** (variância = contagem − (entrada−venda−perda−consumo)). **Ordem de build: PARTE 1 (permissões, fundação) → PARTE 2 (contagem) → Real vs Teórico.**
- **⭐ ROADMAP ESTOQUE atualizado (22/08, ordem do dono): A (fluxo Suitable, FEITO) → C (saídas, FEITO) → B (2 telas manuais: catálogo /estoque/itens com "+ novo item" nome·un·categoria·min/max, mostra saldo zero, item manual nasce sem saldo/custo, dedup por nome, intermediário só via ficha; + aba "Lançamento manual" tipo PDV em Vendas: data → lista do vendável (PRODUTO_FINAL+REVENDA, guard 3 níveis) → qtd → mesmo fluxo preview/confirmar/recibo, origem MANUAL, convive com import) → FASE 3 (o motor: CONTAGEM INICIAL ponto-zero [maior peça faltante] + contagem rotineira estilo Vuca + AJUSTE_CONTAGEM + Real vs Teórico = contagem − (venda+perda+consumo), usando as perdas da Parte C) → FASE 4 (sugestão de compra + CMV por consumo no DRE).** REGRA 2 em cada tela. Item 2.4 antigo do roadmap:
- **⭐⭐ FASE 3 PARTE 2 — CONTAGEM EM PROD (23/08).** Telas `/estoque/contagem` (o quadro) + `/estoque/contagens` (sessões), sidebar "Contagem". **Modelo:** `stock_contagem` (sessão) + `stock_contagem_item` (linha), migration `20260823180000_stock_contagem` CREATE-only (guard verde). **CAMADA 1 (impossível por construção):** `CHECK` em tipo (INICIAL|ROTINA) e status (ABERTA|FINALIZADA|CANCELADA) · `CHECK qtdContada >= 0` · **`UNIQUE(contagemId,itemId)`** (recontar vira UPDATE da linha, nunca uma 2ª) · **índice único PARCIAL "1 sessão ABERTA por company"** — segura até corrida entre dois celulares. ⚠️ o índice parcial é criado pela MIGRATION (Postgres); o `db push` do dev SQLite não o cria, então a app também checa antes (mesma situação do trigger de imutabilidade — a checagem dá a mensagem boa, o índice é o backstop). **⭐ O FREIO (pedido do dono):** divergência grande **não passa sem 2ª confirmação — e quem recusa é o SERVIDOR** (`contarLinha` → 409 `code=FREIO`, ledger intocado), não um diálogo de tela (REGRA 5). `avaliarFreio` é PURA e testada: freia se desvio > 30% do saldo **E** vale ≥ R$ 20, **ou** se a diferença vale > R$ 200. **O `E` do "≥ R$ 20" é de propósito:** 0,4 KG de sal 60% fora vale R$ 1,80 — alarme aí treina o dono a confirmar sem ler e o freio perde a função. Saldo ZERO não freia por percentual (item novo na inicial é normal), só pela regra de dinheiro. **AJUSTE_CONTAGEM por linha, na hora:** confirmar a linha grava o movimento na MESMA transação (`receiptId` = id da sessão, mesmo padrão de conferência/ordem) → **o saldo bate enquanto o dono anda pela loja**. Divergência 0 = linha registrada e **ledger intocado** (nenhum movimento). Correção = novo ajuste (movimento é imutável). **`saldoSistema` é SNAPSHOT** do instante — nunca recalculado depois, senão a divergência histórica muda sozinha. **Decisões na tela:** conta VENDO o teórico · item nunca contado = **"sem contagem" CINZA, nunca zero** (zero é uma afirmação) · **KG/LT decimal (balança) / UN inteiro** (o back RECUSA fracionado em UN, não é só `step` do input) · tap na última contagem mostra **QUEM contou** (`contadoPorNome` desnormalizado — recontagem por outra pessoa TROCA a atribuição) · progresso por categoria e geral · busca · filtro "não contados > 7 dias" (inclui quem nunca foi contado) · parcial é o padrão: a linha já está gravada, sair é só sair. **Rotas NASCERAM com `requireStock`** (`stock.view` pra ver, `stock.operate` pra contar) — as 31 antigas seguem no check velho (Parte 1). **JUIZ:** **E8 (erro)** contagem FINALIZADA cujos ajustes não batem com o ledger (linha com divergência sem movimento, movimento sumido, tipo errado, ou quantidade ≠ divergência) — é o que impede a contagem de virar enfeite (relatório bonito, saldo intacto); **E7 (aviso)** item COM saldo sem contagem há > 30 dias ou nunca contado, só pra empresa que já contou alguma vez. 28 testes de contagem + 8 do juiz (red-then-green em cada invariante). **⚠️ FLAKE PRÉ-EXISTENTE CORRIGIDO no caminho:** `snapshotClosedModules` contava as tabelas fechadas **globalmente**; como a suíte roda arquivos em PARALELO contra o mesmo banco, outro teste apagando empresa (cascade → bankAccount/transaction) mudava a contagem entre dois snapshots e pintava de vermelho um isolamento intacto. Agora aceita `companyId` e os 4 testes de isolamento passam escopados — **não afrouxa** (a pergunta fica exata: "a operação DESTA empresa criou linha fechada DESTA empresa?"). Achado no caminho: **`accountsPayable` não é delegate do Prisma** (contas a pagar são `Transaction.lifecycle=PAYABLE`) → aquela entrada da lista nunca mediu nada; a cobertura real vem de `transaction`. **PRÓXIMO: Real vs Teórico** (variância = contagem − (entrada − venda − perda − consumo)), depois o enforcement das 31 rotas antigas + seed dos papéis (Parte 1) antes de convidar o Cristian.
- **⭐⭐ BUG DA FOCATTO (23/08) — A FILA INTEIRA ESTAVA PRESA E O SELO DIZIA VERDE. Duas mentiras, uma causa.** **(1) O E10 NUNCA EXISTIU.** A Fase 0 registrou "E10/E13/E14 (SEFAZ) entram no item 2" e eles não foram construídos; os invariantes realmente emitidos eram E1/E2/E3/E12/E15 (+P/V/C/E7/E8). O 🟢 era de "não olhei", não de "está tudo bem". **Lição: invariante PLANEJADO num doc e não construído é pior que invariante nenhum — cria confiança falsa. Só conta o que roda.** **(2) A CAUSA:** o `NFeDistribuicaoDFe` só entrega o **procNFe completo depois da manifestação** (Ciência 210210); o cron horário só BAIXAVA. `enviarEvento` era chamado só de `confirmar-conferencia` (Confirmação 210200, DEPOIS de conferir — e não dá pra conferir sem itens) e de um SCRIPT MANUAL. O Frigorífico/Alan funcionaram porque eu rodei o script na mão em 21/08; o débito "sem cron de retry de evento" era exatamente isto. Estado achado: **as 7 notas da fila com `temXmlCompleto=false` e ZERO eventos** (Focatto R$ 2.459,76 parada 2 dias); o download devolvia "137 Nenhum documento localizado" — **correto**, não havia o que baixar. **(3) POR QUE O E15 NÃO PEGOU:** ele varre `stock_sefaz_event` atrás de evento PENDENTE/ERRO > 24h; **nota que nunca teve evento não tem linha nenhuma lá — invisível**. **LIÇÃO DURA: invariante que olha a tabela do PROCESSO (tentativas) nunca vê a tentativa que NÃO ACONTECEU. O que vale é olhar a tabela do FATO.** **FIX:** `lib/stock/sefaz/garantir-ciencia.ts` — função ÚNICA (REGRA 4) que o **cron horário** E o script manual chamam; idempotente (nota com evento ENVIADO — Ciência ou Confirmação, que é mais forte — é pulada, então rodar de hora em hora não vira enxurrada nem infla o `nSeqEvento`); desiste após 5 erros e deixa o E10 gritar. Fica **FORA do caminho do download** de propósito: provado em prod que a Ciência foi enviada mesmo com o download BLOQUEADO por consumo indevido. **E10 real** (`lib/stock/nfe-invariants.ts`): nota na fila sem XML > 24h, com o **PORQUÊ** no detalhe (sem manifestação / Ciência falhou com cStat / aceita mas XML não veio) — alerta que não diz o que fazer vira ruído. **PROVADO EM PROD:** juiz passou a 🔴 7 issues nomeando cada nota → cron corrigido enviou **7 Ciências, cStat 135 nas 7** → 2ª rodada "0 enviadas · 7 já ok" (idempotência). ⚠️ **O TEXTO DA TELA TAMBÉM MENTIA** ("a Ciência já foi enviada; o XML chega na próxima consulta") — corrigido, e agora o dono não fica refém disso (ver item abaixo).
- **⭐ ITENS DIGITADOS DO DANFE DE PAPEL (23/08) — o caminhão não espera a SEFAZ.** Na nota só-resumo, botão "Digitar itens da nota (do papel)": descrição · qtd · unidade · preço unit, e o fluxo NORMAL de conferência roda em cima deles (mapear, fator, divergência, confirmar). `lib/stock/itens-manuais.ts`; grava como `stock_nfe_item` (sem tabela nova) e **NÃO marca `temXmlCompleto`** — é o papel, não o arquivo. **A soma é conferida contra o `vNF` que a SEFAZ já confirmou e AVISA, NUNCA TRAVA:** a diferença costuma ser ICMS-ST/frete/IPI, que entram no total e não no `vProd` dos itens (caso real do Frigorífico, 249,74) — travar aqui repetiria o erro de tratar "não fecha" como "está errado". **`origem` do movimento distingue a fonte:** `SEFAZ` quando a nota tem XML, **`DANFE_MANUAL`** quando os itens foram digitados (derivado de `temXmlCompleto`, sem coluna nova). **XML CHEGANDO DEPOIS NÃO DESFAZ NADA:** `saveNfeCompleta` ganhou guard — nota **CONFIRMADA** só recebe enriquecimento (emitente + docXml guardado), os itens digitados FICAM; reescrevê-los deixaria a conferência órfã (movimentos são imutáveis e o E2 confere item×movimento). Nota ainda NÃO conferida: o XML manda (dado da SEFAZ é melhor que o papel). 16 testes, fixture = a Focatto real (R$ 2.459,76).
- **⭐ ENTRADA MANUAL COMPLETA (23/08) — compra SEM nota nenhuma** (produtor rural que não emite, feira, compra avulsa). `/estoque/entrada-manual` (botão em Recebimentos): fornecedor (escolhe ou cria na hora) + data + itens (do catálogo ou **criados na hora**) → preview → confirmar → movimentos **`ENTRADA_MANUAL`** → recibo em URL estável `/estoque/entradas/[id]`; aparece em **"Recebidas" marcada MANUAL**. **É COMPRA, não ajuste** — o custo médio se move junto (provado: 10 KG a 5 + 10 KG a 9 = custo médio 7,00). O tipo do movimento separa pra sempre de `AJUSTE_CONTAGEM` no extrato e no Real vs Teórico. **Parcela do contas a pagar é OPT-IN** (checkbox "gera parcela?" com vencimento/valor; **compra à vista não gera**). Tabelas próprias `stock_entrada_manual` + `_item` (CREATE-only, migration `20260824000000`): **não deu pra reusar `stock_receipt_conference` nem `stock_payable_suggestion` porque as duas exigem `nfeId` NOT NULL e o isolamento proíbe ALTER**. CAMADA 1: CHECK `quantidade > 0`, `custoUnitario >= 0` (bonificação existe), e **`geraPayable` sem vencimento/valor é IMPOSSÍVEL** por CHECK. Rotas nasceram com `requireStock`. 16 testes (inclui isolamento e "item de outra empresa é recusado", REGRA 8). ⚠️ **DÉBITO: quando a ponte pro contas-a-pagar for LIGADA, ela tem que ler as DUAS fontes** (`stock_payable_suggestion` das notas E `stock_entrada_manual.payable*`) — hoje a ponte está OFF nas duas.
- **⭐ FIX 3 CONVERSÃO — PACK COMPOSTO "N KG CX/M PC" (23/08, caso real do cheddar).** `"PREP. ALIM. SABOR CHEDDAR 2,27 KG CX/08 PC · 1 CX · R$ 683,76"` = caixa com **8 peças de 2,27 KG**. O parser antigo não pegava NADA — **`CX/08` não casa com `CX\s*\d+` (a barra quebra)** — e o campo ficava **vazio e mudo**, sem nem dizer o que perguntar. **A sacada: há DUAS conversões válidas e a resposta DEPENDE da unidade de controle** — em KG são 8 × 2,27 = **18,16 KG** (R$ 37,65/KG); em UN são **8 peças** (R$ 85,47/pç). Por isso `sugerirFatorConversao(xProd)` (unit-agnostic) virou **`sugerirFator({xProd, unidadeControle, uCom, fatorNota, vUnCom})`** — função ÚNICA (REGRA 4, os 2 call-sites migrados) que devolve `{fator, explicacao, origem}`. **A `explicacao` é a CONTA à vista** ("8 pç × 2,27 kg = 18,16 KG · R$ 37,65/KG") — sugestão sem a conta é chute com cara de autoridade. **PRIORIDADE preservada:** qTrib/uTrib da nota > composto > pack simples > perguntar. **Variantes reconhecidas:** `CX/M PC`, `C/M PC`, `M PC x N KG`, `CX/M PECAS N KG`; medida normaliza G→KG e ML→LT. **NÃO CHUTA:** achou as peças mas não o peso e o controle é KG → devolve null e PERGUNTA (multiplicar por número errado multiplica o custo de entrada — foi o bug da Skol); pack simples (`12UN`) com controle em KG também não sugere, porque "12UN" não diz quantos KG tem a caixa. **A sugestão recalcula quando o dono troca a unidade** (é outra pergunta, outra resposta) e é **SEMPRE editável**. **Campo vazio agora PERGUNTA:** `placeholderFator` → *"quantas KG tem 1 CX?"* em vez de vazio mudo. 23 testes (o cheddar real nos dois caminhos + variantes + os casos que não devem chutar).
- **⭐⭐ REAL vs TEÓRICO EM PROD (24/08) — a última peça do motor. `/estoque/real-vs-teorico` + CSV + sidebar.** **⭐ A SACADA: a variância JÁ ESTÁ NO LEDGER — ela É o `AJUSTE_CONTAGEM`.** Quando a contagem confirma uma linha, o ajuste gravado é, por construção, `real − teórico` naquele instante (o teórico era o saldo derivado; o real é o que o dono contou). Então o relatório **NÃO recalcula a variância por uma segunda fórmula** — ele LÊ os ajustes e EXPLICA o que houve no meio (entradas, vendas, perdas, consumo de produção). **Por que isso é o ponto:** uma segunda fórmula seria uma segunda fonte de verdade e as duas divergiriam no 1º caso de borda (estorno, devolução de produção, item novo) — é a MESMA classe do motor de transferência (7 cópias discordando) e do dedup×saldo (mesma tx, dois caminhos, sinais opostos). Uma decisão = uma função. **Baldes:** entradas (ENTRADA_NF+ENTRADA_MANUAL) · produzido (PRODUCAO_GERACAO) · vendas (BAIXA_VENDA) · perdas (PERDA+USO_INTERNO) · consumo de produção (SEPARACAO_SAIDA − DEVOLUCAO_PRODUCAO) · estornos. **`PRODUCAO_CONSUMO` fica FORA** (transferência interna, já saiu na separação — a mesma exclusão do `saldo.ts`, fonte única; incluir dobraria a baixa). **INVARIANTE que trava tudo (teste):** `saldoInicial + baldes + ajustes == saldoFinal == saldo derivado do ledger` — se um tipo de movimento novo ficar fora dos baldes, o teste quebra ANTES de o relatório mentir em silêncio (mesmo risco do "esqueci o `transferDirection` no select"). **HONESTIDADE:** item sem contagem no período tem variância **`null` = "sem contagem" CINZA, nunca zero** (zero afirmaria que bateu), e o resumo DIZ quantos itens ficaram invisíveis. **PISO DOS DADOS `2026-08-12` embutido** (`PISO_DADOS`): período anterior é AJUSTADO com aviso do porquê — relatório de variância sobre dado sabidamente torto aponta furo que não existe. **Denominador com significado:** % é sobre o que ROTACIONOU (venda+perda+consumo), não sobre o saldo. **Ranking pelo DINHEIRO** (|variânciaValor|) — onde está vazando primeiro. **Leitura do sinal na tela** (o dono não decora + e −): falta = perda não registrada / porção maior que a ficha / saída sem lançamento; sobra = venda lançada que não saiu / porção menor / entrada a mais que a nota dizia. 9 testes (invariante dos baldes com um movimento de CADA tipo, piso, sem-contagem, falta, sobra, bateu). ⚠️ **Enquanto não houver a 1ª CONTAGEM em prod o relatório mostra "sem contagem" em tudo — e isso está certo: a contagem inicial é o marco zero.** **FALTA PRA FECHAR O MÓDULO: enforcement das 31 rotas antigas + seed dos 2 papéis (Fase 3 Parte 1) em sessão fresca, então convidar o Cristian, então a CONTAGEM INICIAL.**
- **⭐⭐ A FECHADURA — ENFORCEMENT DAS PERMISSÕES DE ESTOQUE EM PROD (24/08). Fase 3 Parte 1 COMPLETA.** **⚠️ O ACHADO QUE QUASE TRANCOU O DONO FORA: `getAuthContext` resolve permissão pelo BANCO** (`UserCompanyRole`→`Role`→`RolePermission`→`Permission.key`), e **o OWNER em prod tinha uma lista CONCRETA de 33 permissões, NÃO o literal `*`** — o seed antigo rodou `expandPermissions(['*'])`, que congelou as 33 chaves existentes na época. `stock.*` não estava lá, e `permissionMatches` não tem como casar. **Efeito real: as rotas novas que já subiram com `requireStock` (contagem, Real vs Teórico, entrada manual, DANFE) estavam dando 403 PRO PRÓPRIO DONO** — defeito embarcado nos deploys de 23/08, consertado pelo seed. **LIÇÃO: `*` em constante de código NÃO é `*` no banco depois de expandido. Permissão nova exige RE-SEED, senão a chave existe no código e não existe pra ninguém.** **ORDEM SEGURA (seed ANTES das rotas):** `npx tsx scripts/seed-rbac.ts` (idempotente, já existia — REGRA 4, não criei um segundo) → 36 permissions, OWNER 36 · ADMIN 35 · **OPERADOR_ESTOQUE 2 (view+operate) · LEITURA_ESTOQUE 1 (view)** criados. **VIEWER ganhou `stock.view`** de brinde (a def é `['*.view']` — coerente, mas registrado). **31 ROTAS MIGRADAS** do `userCompany.findFirst` pro RBAC. O check estava **COPIADO em 31 arquivos** como helper `auth()` local — 31 cópias da mesma decisão. Em vez de reescrever cada call-site (formato diferente = chance de errar em silêncio numa delas), criei **`guardStock`** em `require-stock.ts`: MESMA forma que as rotas já consumiam (`a.erro`/`a.user.sub`), REGRA diferente por dentro. Um choke-point (REGRA 5). **MAPA (explícito por arquivo+verbo, nada inferido): 50 handlers = 27 `stock.view` · 15 `stock.operate` · 8 `stock.manage`.** Decisões de fronteira: certificado A1 POST = **manage** (configuração, não operação do dia) · mapa de vendas = **manage** (o dono decide o destino) · `vendas/preview` = **operate** (não grava, mas faz upload + plano: quem opera pode, quem só lê não) · criar ordem de produção = **operate**. **TESTES (REGRA 3, handlers REAIS com token assinado contra o banco — não mock):** `enforcement-estoque.integration.test.ts` 18 testes — o DONO faz tudo (ver/operar/gerenciar), o OPERADOR opera (saída, contagem) e **leva 403 em catálogo/ficha/mín-máx/mapa com `permission: stock.manage` no corpo e NADA gravado**, a LEITURA vê e leva 403 em tudo que mexe, e **nenhum dos dois tem UMA chave de financeiro** (7 chaves testadas; `permissions` do operador == exatamente `[stock.operate, stock.view]`). REGRA 1 provada: afrouxar o catálogo de manage→operate deixa o teste VERMELHO. **+ `toda-rota-tem-trava.test.ts` (54 testes, guard estrutural):** todo handler de estoque exige uma das 3 chaves · o check antigo não pode voltar · **GET é sempre view** · **escrita nunca se contenta com view**. Resolve o handler nº 51 (rota nova sem lock). **O FINANCEIRO JÁ ESTAVA SEGURO:** todas as rotas de transações/DRE/relatórios/contas-pagar/conciliação já usam RBAC (zero no check antigo), e o convite cria só `UserCompanyRole` (não `UserCompany`). ⚠️ **DÉBITO: 16 rotas fora do estoque seguem no `userCompany.findFirst`** (cartões, empréstimos/parcelas-do-mes, categorias/template-diff, import-warnings, monitor-alerts, auth). Pro operador elas falham FECHADO (404 sem `UserCompany`) — direção segura, mas **está certo por acidente, não por desenho**. ⚠️ **2º flake do `snapshotClosedModules` global corrigido** (5 arquivos em `producao/`+`sefaz/` que faltaram na 1ª passada) — suíte estável em 2 rodadas. **PRÓXIMO: o dono convida o Cristian como OPERADOR_ESTOQUE em `/usuarios` e marca a CONTAGEM INICIAL.**
- **⭐⭐⭐ PONTE 1 EM PROD (24/08) — o boleto da nota vira CONTA A PAGAR de verdade. A 1ª travessia estoque→financeiro.** **⚠️ ESTA É A EXCEÇÃO DESENHADA AO ISOLAMENTO, e ela tem NOME e TAMANHO: o estoque escreve em `transactions` (a conta) e `suppliers` (o fornecedor) — E SÓ NESTE FLUXO.** Marcas: `Transaction.origin='ESTOQUE_NF'` e `Supplier.fonte='ESTOQUE_NF'` (os dois campos já eram String livre — **nenhum ALTER**). **A 2ª tabela (`suppliers`) foi decisão explícita do dono (24/08)** depois que a investigação mostrou que **NENHUM dos 8 fornecedores do estoque existia no financeiro** e que `createContaPendente` tem guard `hasLink` (conta sem fornecedor/categoria/banco é RECUSADA — ficaria invisível na listagem). Sem cadastrar fornecedor, a ponte não criaria NENHUMA das 7 parcelas presas. **Dado do fornecedor vem do XML** (razão social + CNPJ assinados pela SEFAZ — cadastro mais limpo que digitação), e **sempre sob checkbox**. **REGRA 4 — não existe 2º jeito de criar conta a pagar:** a ponte chama **`createContaPendente`**, a MESMA função do formulário do financeiro (ganhou um param opcional `origin`, aditivo). Se as regras de conta a pagar mudarem, a ponte muda junto de graça. **IDEMPOTÊNCIA POR CONSTRUÇÃO:** `stock_payable_link` (CREATE-only) com **UNIQUE (companyId, origem, refId, nDup)** — a mesma parcela virar 2 contas é IMPOSSÍVEL no banco, não "checado". A tabela é a AMARRA nos dois sentidos e é o que vai permitir responder "o que fazer com as contas?" quando existir estorno de conferência — ⚠️ **esse fluxo NÃO existe hoje** (não inventei o ramo). **FRONTEIRA DE PAPEL:** enviar boleto pro Contas a Pagar é criar OBRIGAÇÃO FINANCEIRA → **`stock.manage`, não `operate`**. O OPERADOR_ESTOQUE confere a nota (estoque entra normal) e as parcelas **ficam esperando o dono** — a tela diz isso. **3 CAMINHOS:** (1) bloco **"BOLETOS DA NOTA (N parcelas)"** na conferência, checkbox por parcela marcado por default + aceite de cadastro do fornecedor, tudo antes do confirmar; (2) tela **`/estoque/contas-a-pagar`** pra aprovar em LOTE (o retroativo das notas já conferidas + o que o operador deixou); (3) **entrada manual** — o "gera parcela?" agora cria conta de verdade, mesma origem. ⚠️ As duplicatas na conferência vêm de **`stock_nfe_dup`** (dado CRU da NF-e): as `stock_payable_suggestion` só nascem NO confirmar — por isso a seleção da tela é por **`nDup`**, não por id que ainda não existe. **JUIZ F1/F2/F3** (`ponte-invariants.ts`): **F1** toda conta `origin=ESTOQUE_NF` tem amarra, valor batendo com a duplicata (±1 centavo) e nota-mãe existente — *"a ponte inflaria o contas a pagar"*; **F2** amarra órfã (conta apagada pelo financeiro); **F3 (aviso)** boleto conferido há >7d sem ir pro contas a pagar — *"vence sem aparecer no fluxo de caixa"*. **⚠️ BUG MEU QUE O TESTE PEGOU:** o F1 resolvia a empresa por `bankAccount.companyId`, mas **conta a pagar NASCE SEM bankAccount** → `companyId` null → o alerta sumia no filtro por empresa. Agora resolve pelo **fornecedor**. **GUARD DO ISOLAMENTO (o teste que importa):** roda saída, contagem com ajuste, entrada manual à vista e movimento cru → **contagem de `transactions`/`suppliers` INALTERADA**; depois roda a ponte → **+1 conta e +1 fornecedor, exatamente**. É o que impede a exceção de virar vazamento silencioso. 17 testes (10 da ponte + 7 do juiz, red-then-green em cada invariante). **CICLO FECHADO:** nota entra → mercadoria conferida → boleto no contas a pagar → pagamento casa no extrato → custo já está no estoque. **FALTA A ÚLTIMA PONTE: CMV por consumo no DRE (Fase 4).**
- **⭐⭐ 1ª PRODUÇÃO REAL DA CAÇULA — 21/08/2026: "porção de carne 100g", 25 UN por receita, R$ 3,62/un, por Cristian, validade 05/09.** O ciclo fechou de ponta a ponta: nota → estoque → câmara (separação 1kg de cada) → panela → 25 pacotes com custo REAL (90,50 do lote ÷ 25). **A 1ª medição já provou o princípio: rendimento MEDIDO ≠ chute** — a estimativa de cabeça era 17, saíram 25; o sistema gravou 25 (nunca teria chutado). Conferido em prod: conclusão (qtdGerada 25, rendimento 25, custoLoteReal 90,50, custoUnitarioReal 3,62, escalaConsumida 1 = contra o consumo real, NÃO a escala 100× da ordem), produto na posição 25 UN/90,50, em-produção zerado, etiqueta com validade 05/09. **BUG corrigido no caminho (21/08):** o detalhe da ordem quebrava ("This page couldn't load") — `useMemo` (escalaAviso) DEPOIS do early-return violava a Regra dos Hooks (nº de hooks mudava na transição loading→carregado); crash de CLIENTE (servidor OK). Fix: hook movido pra antes do return. Guard `ordem-detalhe-hooks.test.ts` (REGRA 1, provado falha-antes/passa-depois; sem jsdom/RTL no projeto, encoda a invariante estrutural). REGRA 4: nenhuma outra tela repetia.

## ⭐⭐⭐ MARCO — PRIMEIRA PONTE ESTOQUE→FINANCEIRO LIGADA (24/08/2026)

**O ciclo fechou de ponta a ponta, com dinheiro real:** nota da SEFAZ → mercadoria conferida → **boleto no Contas a Pagar** → vai casar com o extrato quando for pago → e o custo já está no estoque.

**Confirmado pelo dono em 24/08:** as **8 parcelas (R$ 21.968,02)** foram enviadas, os fornecedores cadastrados no mesmo gesto, e chegaram no Contas a Pagar do financeiro com o vencimento certo. Frigorífico Silva 001+002 (6.006,45 + 6.006,44) · SPAL 4.138,27 · Dalmolin 2.537,29 · Focatto 2.459,76 · Juliano 570,00 · Cancian 230,81 · Alan 19,00.

**Fronteira APROVADA pelo dono:** criar conta a pagar é **`stock.manage`**, não `operate` — *"boleto é obrigação, coisa minha"*. O OPERADOR_ESTOQUE confere a nota e o estoque entra normal; as parcelas ficam esperando o dono aprovar.

**O que a ponte tem de estrutural** (detalhe técnico na seção de Estoque): função ÚNICA de criação (`createContaPendente`, a mesma do formulário do financeiro) · idempotência por UNIQUE no banco · marcas de origem nas duas tabelas · juiz F1/F2/F3 conferindo toda linha que o estoque escreveu no financeiro · e o guard que prova que **nenhum outro caminho do estoque atravessa a fronteira**.


**⭐⭐ REGRA DO DONO (26/08, VALE PRA SEMPRE): EMPRÉSTIMO NÃO É ENTRADA.** *"ENTROU = só o que realmente entrou DE VENDA (+ outras receitas reais tipo iFood). Dinheiro de empréstimo não é venda, não é receita — é DÍVIDA entrando. SAIU = tudo que foi pago, não importa o quê."* **COMO FICOU:** liberação de empréstimo e aporte de capital aparecem como **LINHA PRÓPRIA, informativa, FORA da soma do ENTROU** — *"+ Liberação de empréstimo: R$ 100.000 (não somado — é dívida)"* — mesmo tratamento das transferências internas: **visível, excluído, explicado**. Vale também no **gráfico de 6 meses** (senão junho apareceria como o melhor mês do ano por causa de uma dívida). **⚠️ O MARCADOR É ESTRUTURAL, NÃO A CATEGORIA:** `Loan.disbursementTransactionId` (a MESMA fonte que o DRE usa pra não tratar liberação como receita) tem precedência sobre `dreGroup`. O caso real prova por quê: a liberação do **C61021346 (R$ 100.000, 12/06/2026)** estava categorizada como **"Aporte de Capital"** — se a categoria mandasse, a tela chamaria uma DÍVIDA de aporte de sócio. O vínculo com o contrato não mente. Aporte DE VERDADE (dreGroup `APORTES_CAPITAL` sem vínculo de contrato) também fica fora, com o rótulo dele. **PROVA em prod:** junho ENTROU **464.190,76 com E sem a liberação — idêntico**, com os 100 mil na faixa informativa; invariante Σcategorias == ENTROU verde nos dois meses. 8 testes novos (30 no motor).

**LIBERAÇÃO DO C61021346 LINKADA (26/08)** — `disbursementTransactionId` = a tx de 12/06 (`LIBERACAO CREDITO-C61021346`, R$ 100.000, valor idêntico ao principal), pelo endpoint real `/linkar-liberacao`. Categoria movida de "Aporte de Capital" pra **"Liberação de Empréstimo"** (criada), **mantendo `dreGroup=APORTES_CAPITAL` → DRE de junho INALTERADO** (a tx já estava nesse grupo; a mudança é de NOME, não de tratamento contábil). ⚠️ Débito menor: não existe dreGroup próprio pra "entrada com contrapartida em passivo"; `APORTES_CAPITAL` é o mais próximo entre os existentes e criar um grupo novo mexeria no calculador do DRE — não feito de propósito. **As 8 liberações antigas (2021-2024) seguem pendência OPCIONAL do dono** (extratos daquela época; o extrato mais antigo no sistema é 25/05/2026).

**FATURA CAIXA VISA 2026-08 CASADA E PAGA (26/08)** — o K3 apontou o pagamento ÓRFÃO de **R$ 7.280,39 (24/08, "LIQUIDACAO BOLETO … CARTOES CAIXA VISA PJ")**: tinha `isCardPayment=true` mas `businessCreditCardId=null`, então não quitava fatura nenhuma. Casado pelo endpoint real `/casar-pagamento` (que vincula ao cartão + amarra `paidInvoiceMonth` + zera categoria, tudo atômico). **Fatura fecha AO CENTAVO: compras 7.292,97 − estornos 12,58 = net 7.280,39 = o pagamento.** Status na tela de Cartões: **PAGA** (era PENDENTE). Os 12,58 de estorno são os 3 créditos que o Vision tinha perdido e o reprocess cirúrgico de 18/08 recuperou — a fatura só fecha por causa daquele fix.


**⭐⭐ AUDITORIA CONTA-A-CONTA DE AGOSTO/2026 (26/08) — o fluxo FECHA, zero linha inexplicada.** O dono pediu revisão total antes de confiar nos números. Método: para CADA transação EFFECTED da empresa em agosto, ou ela é CONTADA (entrou/saiu) ou é EXCLUÍDA COM MOTIVO NOMEADO; o que sobrar aparece como *** SEM EXPLICAÇÃO ***. **Resultado: `BRUTO = ENTROU + SAIU + excluídos` bate ao centavo (R$ 1.327.986,49) e as linhas sem explicação são ZERO.** Por conta: banrisul (entrou 224.600,20 · saiu 56.420,71 · fora 150.700,00 em 15 transferências) · stone (62.833,78 · 258.488,19 · fora 192.800,00 em 21) · sicredi (108.716,62 · 67.826,74 · fora 49.100,00 em 7) · cofre (67.585,35 · 31.193,77 · fora 50.000,00 por categoria de transferência) · banco caixa (0 · 721,13 · fora 7.000,00). **Motor e auditoria calculados por caminhos DIFERENTES deram o mesmo número** (463.735,95 / 414.650,54) — é a prova de que a tela não tem viés próprio.
**DE-PARA dos 366/324 → 463/414 (o dono estranhou, com razão):** rastreado por `createdAt` (lote de import). Até 25/08 o acumulado era **exatamente 366.442,25 / 324.422,21** — os números do 1º relatório estavam certos. O lote gravado em **26/08 (48 linhas · banrisul + sicredi + stone) trouxe +97.293,70 de entrada e +90.228,33 de saída**. Não houve mudança de cálculo, foi dado novo. ⚠️ **Lição de comunicação: número de tela muda quando o dado muda — sempre reportar COM a data/lote, senão parece bug.**
**⚠️ ACHADO ACIONÁVEL — 2 PARES DE TRANSFERÊNCIA NÃO PAREADOS INFLAM OS DOIS LADOS:** o import de 26/08 trouxe `24/08 DEBIT 25.000 banrisul "CACULA MIX" ↔ CREDIT 25.000 stone "YUSSEF… Transferência"` e `24/08 DEBIT 10.000 sicredi "PIX_DEB 29756732000198" ↔ CREDIT 10.000 stone`. **O CNPJ no memo é o da própria Caçula.** O detector único (`detectTransfersForCompany`) OS VÊ com confiança **0.99 (camada DETERMINISTIC, CNPJ próprio) e 0.90 (camada STRONG, nome do sócio)**, ambos `autoSuggest=true`. **NÃO pareados por mim** — a regra é "sugestão sempre, o dono confirma cada par, NUNCA automático". Confirmar no banner de Pendentes derruba ENTROU e SAIU em 35.000 cada; o SOBROU não muda. Há ainda `25/08 CREDIT 6.000 sicredi "PIX_CRED 29756732000198"` com CNPJ próprio e **sem par detectado** — a perna de saída provavelmente ainda não foi importada; fica em A CLASSIFICAR até o extrato chegar (honesto, não inventa).
**A CLASSIFICAR de agosto: 21 linhas** (entrada 41.000,00 · saída 54.981,84). Além dos 3 de transferência acima, são pagamentos REAIS sem categoria vindos do import novo (AES Sul 5.550,51 · Cia da Fruta 3.796,75 · Bamberg 2.384,75 · PagSeguro 1.674,50 · PIX a pessoas). Contados no SAIU, cobrando na tela — nunca somidos.
**BANRISUL "OP.CREDITO C/GARANTIA" CONFERIDO (regra do dono: é RECEITA DE VENDA, a conta garantida processando o cartão):** agosto tem **15 lançamentos, R$ 197.258,31, TODOS como Receita de Vendas E todos os 15 dentro da VendaDiaria** (competência). No histórico inteiro existem só 2 variantes do descritivo — `OP.CREDITO C/GARANTIA` (30x, 342.794,95) e `OP. CREDITO C/GARANTIA` com espaço (24x, 257.175,62) — ambas corretas. **Nada a corrigir.** ⚠️ Também conferido: **`TRANSFER` com categoria de despesa = ZERO** (uma leitura minha intermediária sugeriu que existiam; era erro de agrupamento meu, que rotulava a família inteira pelo tipo da primeira linha — o dado estava certo).
**O CARD VIROU PORTA (pedido do dono):** clicar em ENTROU/SAIU rola pro resumo completo e destaca a seção; o card mostra "N categorias · M pagamentos". As **34 categorias de saída aparecem INTEIRAS, nada agrupado em "outros"**, cada uma expandindo nos pagamentos (data · conta de onde saiu · descrição · valor · link pro extrato). Invariante travado em teste: `Σ(entradas + saídas + informativas) == tudo que entrou no motor`, a contagem de lançamentos fecha, e 34 categorias distintas continuam 34.


**⭐⭐⭐ O BUG MAIS CARO DA SÉRIE — TRÊS NÚMEROS PRO MESMO AGOSTO (26/08).** A tela de Vendas dizia **~595 mil**, o Fluxo de Caixa **~425 mil**, e a realidade do dono era **~380 mil**. *"Sistema financeiro NÃO pode ter duas telas se contradizendo em silêncio."*
**CAUSA RAIZ (BUG 2): o `recomputeVendas` deixou de ser IDEMPOTENTE.** O DELETE filtrava por `dataCompetencia >= corte` (**pertencimento**); o BLOCO de fim de semana tem competência na SEXTA — 31/07, ANTES do corte de 01/08. **O delete nunca o alcançava e o create o inseria de novo a cada import.** Em prod: **5 cópias** do bloco (2 chaves × 5), inflando 43.106,03 → **215.530,15**. As transações de origem estavam ÍNTEGRAS o tempo todo (109 tx, lotes 03-04/08) — **não era duplicata de import, era duplicata de VendaDiaria**. A hipótese "FITID do Banrisul renumerou" estava ERRADA. **⚠️ TERCEIRA CÓPIA DA MESMA DECISÃO:** a regra "o bloco atravessa o corte" vive na TELA (`janela-mes.ts`), no JUIZ (`vendas-invariants.ts`) e no RECOMPUTE. Corrigi a 1ª em 25/08, a 2ª em 26/08 de manhã, e **deixei justamente a que GRAVA**. Fix: `dataCompetenciaFim: { gte: inicio }` nos três.
**POR QUE O JUIZ NÃO PEGOU:** o V1 montava o mapa com `mapSto.set(chave, valor)` — N linhas de mesma chave **sobrescreviam** umas às outras e sobrava UMA, que batia com o esperado. **O invariante era CEGO PRA DUPLICATA POR CONSTRUÇÃO.** Agora SOMA (5 cópias viram 5× o esperado e o V1 grita) e o **V5** reporta a duplicata com a contagem.
**BUG 1 — o total somava a borda:** o fix da sobreposição (certo pra EXIBIR o bloco) vazou pro SOMATÓRIO. Agora o total/cards/composição/perfil usam **só agosto puro**; o bloco de borda aparece marcado e **fora da soma**, com o valor à vista ("inclui venda de fim de julho — não somado no total do mês"). Mesmo padrão das exclusões do Fluxo: visível, excluído, explicado.
**⭐ BUG 3 — V6, A PONTE (`lib/vendas/consistencia-caixa.ts`):** Vendas (competência) e Fluxo (caixa) medem coisas diferentes do MESMO dinheiro; a diferença só pode ser borda. **TRÊS bordas nomeadas:** (a) venda de mês anterior recebida neste mês; (b) venda deste mês a receber; (c) **venda ANTERIOR AO INÍCIO DO MÓDULO** — descoberta na validação: R$ 2.966,35 de venda em dinheiro que caiu no cofre em 01/08 (cofre é D+1 corrido → venda de 31/07, e julho não é computado). Sem nomear a (c), a ponte "fecharia" ignorando dinheiro que a tela mostra. **O caixa do V6 vem do MESMO motor da tela de Fluxo** (REGRA 4) — se viesse de soma própria, o juiz poderia fechar contra um número que a tela não exibe, que é a doença que ele existe pra curar. Fora da tolerância (±R$ 1) → **VERMELHO + e-mail**.
**RESULTADO EM PROD (cirurgia com `pg_dump pre-dedup-vendadiaria-20260826-021219`):** 74 → 66 linhas, duplicatas **0**, e **GOLDEN INTACTO AO CENTAVO** (12/08 = 11.919,65 · 13/08 = 10.468,80 · fds 14-16 = 62.090,93). Os três números fecharam: **Vendas 379.637,26** (a realidade do dono) · **Fluxo 425.709,64** · **V6 inexplicado R$ 0,00** — *"Vendas 379.637,26 × Caixa 422.743,29 — diferença explicada pelas bordas (recebido de antes 43.106,03, a receber 0,00, venda anterior ao módulo 2.966,35)"*.
**BANRISUL "OP.CREDITO C/GARANTIA" CONFERIDO LINHA A LINHA:** 16 lançamentos em agosto (R$ 200.232,00), **todos** Receita de Vendas e **todos** atribuídos à competência certa — D+1 útil nos dias de semana, bloco de fim de semana na segunda (03/08 → 31/07-02/08 · 10/08 → 07-09/08 · 17/08 → 14-16/08 · 24/08 → 21-23/08). Padrão perfeito de depósito de maquininha. ⚠️ Eram 15 numa contagem anterior do mesmo dia: a 16ª foi **gravada às 04:47 enquanto a auditoria rodava** — o dono importava em paralelo.
**LIÇÃO GERAL:** quando uma decisão de fronteira (pertencimento × sobreposição) existe em N lugares, corrigir N−1 é pior que não corrigir nenhum — o sistema fica com metade das telas certas e nenhum alarme. E **invariante que agrega com `set` é cego pra duplicata**: ao escrever comparação por chave, SOMAR é o default seguro.

## ⭐⭐ ESTOQUE "CARDÁPIO-PRIMEIRO" (27/08/2026) — o hub do dono. UX pura: motor, ledger e golden INTOCADOS.

**O PROBLEMA:** o dono começou a usar de verdade e o caminho estava espalhado em 4 telas (Fichas, Produção, Vendas Suitable, Catálogo). Estudo dos líderes (MarketMan/Apicbase): são **MENU-FIRST** — a lista dos produtos QUE SE VENDE é o hub, a receita se anexa DENTRO do produto, e receita de PRODUÇÃO (sub-recipe/prep) vive SEPARADA da ficha do produto vendido. Mesmo motor, lugares distintos, porque respondem perguntas de pessoas diferentes (cozinha vs dono).

**⭐ A DECISÃO QUE SEGURA O RESTO — O CUSTO SAI DA MESMA EXPLOSÃO QUE A VENDA USA PRA BAIXAR (REGRA 4).** `lib/stock/cardapio/hub.ts` reusa o `explodir` de `baixa-venda.ts` com `qtd=1`: as folhas que saem são exatamente as que o ledger vai baixar quando 1 unidade for vendida; somar o custo médio delas É o custo do produto, **por construção**. Uma fórmula própria divergiria no 1º caso de borda (componente que é outro produto final, intermediário que baixa o pack) e a tela mostraria margem sobre um custo que não acontece — a doença dos 7 detectores de par. O teste-estrela compara o custo do hub com o **plano REAL de venda**, ao centavo, nos 3 níveis (Combo → Xis → beef + pão).

**⚠️ POR QUE NÃO USEI O `calcularCustoTeorico` QUE JÁ EXISTIA:** ele divide pelo **rendimento MEDIDO**, que só existe depois de uma produção em lote. Produto montado na venda (xis, combo) **nunca** é produzido em lote → ficaria "a apurar" para sempre, justamente nos produtos que interessam. O intermediário (beef, gessado) continua no mundo da produção com rendimento medido, intocado.

**⛔ CÓDIGO MORTO REMOVIDO NO MESMO GESTO:** `cardapio()` e `cardapioToCsv()` (de `sugestao-cardapio.ts`) ficariam com **zero caller** e seriam um **SEGUNDO custo/margem pro mesmo produto**, por outra regra. Removidos. `sugestoesDeProducao` (min/máx) fica — responde outra pergunta ("o que preciso produzir?").

**A LINHA NASCE DA VENDA, NÃO DO CADASTRO.** Produto que vendeu 57× e não tem ficha aparece **em vermelho no topo** — é o trabalho a fazer, não uma ausência a esconder. Banner de onboarding aponta o campeão por VOLUME: o dono monta o cardápio na ordem que importa pro bolso dele.

**PREÇO — o PRATICADO manda sobre o cadastrado.** `valorTotal ÷ quantidade` do próprio relatório do PDV é o que o cliente pagou de fato (mesma regra do resto do sistema: quando o arquivo TRAZ o dado, usa o dado). O `valorVenda` da ficha fica como preço de cardápio e a tela **avisa quando os dois divergem**. Sem nenhum dos dois → "a definir", nunca 0,01.

**APELIDOS DO PDV:** nomes que apontam pro MESMO destino viram UMA linha com as vendas somadas ("XIS COMPLETO" + "XIS - COMPLETO"). Nomes parecidos **SEM** o mesmo destino ficam separados — casar por semelhança seria adivinhar.

**DENTRO DO PRODUTO (`/estoque/cardapio/[chave]`):** cards (vendas/custo/preço/margem) · preço inline · a **receita se cria/edita ALI** · cada componente com saldo, tipo (insumo/produzido) e **[produzir agora]** quando falta, que cria a ordem e navega. **Fluxo encadeado completo: cardápio → produto → componente → produção → etiqueta.** Mostra também "dá pra fazer N" com o **gargalo nomeado**.

**DOIS MUNDOS SEPARADOS, EDITOR ÚNICO (REGRA 4):** `/estoque/cardapio` = a casa do DONO (só o que se vende) · `/estoque/producao/receitas` = a casa da COZINHA (só INTERMEDIÁRIO: lote base, validade, botão produzir). O **mesmo `FichaEditor`** serve os dois, aberto com `tipoTravado` e `voltarPara` — um segundo editor divergiria na 1ª regra nova. **"Fichas técnicas" (lista mista) SAIU da sidebar**; a rota fica viva com placa apontando os dois caminhos, pra link antigo não quebrar.

**SIDEBAR do estoque:** Cardápio (topo) · Recebimentos · Posição · Catálogo · Movimentos · Contagem · Real vs Teórico · Boletos · Produção (com Receitas) · Vendas (Suitable) · Certificado.

**PROVADO EM PROD com o dado real (commit `1e8521d`, deploy trio verde):** 80 produtos do Suitable (21/08, 494 un, **R$ 18.521,10** — coerente com os ~380k/mês do motor de vendas) · banner **"Combo Caçula (57 vendas) sem ficha"** · **78 dos 80 sem ficha** (o hub é hoje uma lista de trabalho, que é o estado honesto) · as 2 revendas mapeadas fecham sozinhas (**Skol custo 8,46 / preço 18,00** e **Fruki 3,75 / 11,00**) — custo da nota + preço do PDV = margem real sem cadastrar nada. Todas as telas novas **200**. 15 testes novos; o guard estrutural de rota subiu **54 → 58** (a rota nova nasceu travada). TS 0; suíte com os mesmos 3 vermelhos documentados.

**⭐ 2 AJUSTES DO USO REAL (27/08, commit `3b5d614`) — o dono usou e os dois apareceram na hora:**

**(1) REVENDA MAPEIA NO PRÓPRIO HUB.** O link *"é bebida? mapear lá"* jogava na tela genérica do Suitable e o dono tinha que **achar o produto de novo numa lista de 80** — o hub já sabia qual era. **Perder no caminho a informação que o sistema acabou de mostrar é obrigar o usuário a repetir.** Agora o card do produto sem ficha tem os dois caminhos lado a lado: *"é feito aqui"* → monta receita; *"é revenda"* → dropdown **só de itens REVENDA**, escolheu e a margem fecha na hora. O link do Suitable vira secundário ("ver todos os mapeamentos"). **REGRA 4:** delega pro MESMO `upsertVendaMap` — o guard dos 3 níveis segue num lugar só (teste prova que material de limpeza é RECUSADO). ⚠️ **E o dropdown é decisão do DONO por um motivo real:** o catálogo tem **"COCA-COLA ORIGINAL PET 2L" (8,08) E "CC Zero PET 2L" (8,11)** — "COCA COLA 2L" do PDV pode ser qualquer uma. O sistema **não adivinha**; sugere a lista, o dono aponta.

**(2) O EDITOR HERDAVA 3 CONCEITOS DE INTERMEDIÁRIO ao ser aberto pelo hub:**
- **TIPO** — o seletor Intermediário/Final agora **some** quando o mundo já respondeu (era só `disabled`). Perguntar de novo é dar chance de errar numa decisão que a tela já tomou.
- **CUSTO** — *"por unidade só depois da 1ª produção — a apurar"* é conceito de **INTERMEDIÁRIO**, onde o rendimento é MEDIDO. **Produto final MONTA na venda**: 1 xis = 1 receita, custo = **Σ componentes AO VIVO**. Herdar aquele texto **escondia o custo justamente no produto que interessa**. Corrigidos cálculo, rótulo ("Custo por unidade"), texto e o lote base nasce **1 UN** (per-serving, como os líderes tratam menu item). O "a apurar" **continua valendo no mundo da cozinha** — teste trava os dois.
- **BUSCA** — oferecia **DESENGRAXANTE, SACO DE LIXO e JAPONA DE CÂMARA** como ingrediente de lanche: pedia o catálogo inteiro. Agora `escopo=receita` (matéria-prima + produzidos + revenda), intermediário/matéria-prima primeiro, com toggle *"mostrar tudo"* pro caso raro. ⚠️ **O filtro é no SERVIDOR:** com `take: 50`, filtrar no cliente perderia itens bons sempre que a limpeza ocupasse as vagas — o bug mudaria de cara em vez de sumir.
- **BÔNUS** — o preço de venda nasce **pré-preenchido com o praticado no PDV** (23,37 no Xis), pra a margem nascer calculada.

**REGRA 1 provada** no filtro (o único dos 4 que é comportamento de servidor): **sem o fix 2 vermelhos, com o fix 6 verdes**. **PROVADO EM PROD:** busca de ingrediente **47 → 40 itens, ZERO de limpeza/uso interno**, com a "porção de carne 100g" (R$ 3,62, custo real da 1ª produção) no topo · dropdown de revenda com **21 itens** · Xis com preço praticado **23,37** e Coca **17,00** prontos pra pré-preencher. 14 testes novos (29 no módulo).

**⭐⭐ UNIDADE DE CONSUMO ≠ UNIDADE DE COMPRA (27/08, commits `850e5b9` + `7752acc`) — o caso do PÃO.**

**O CASO:** o dono foi montar a ficha do xis e o `PAO TRADICIONAL GERGELIM CT PC/12 UN (900G) CX/16 PC` estava controlado em **PACOTE** (64 PC a R$ 27,75), mas a receita usa **1 PÃO** (R$ 2,31). Pôr `1` na ficha baixaria **um pacote inteiro por lanche — 12× a mais** — e o Real vs Teórico apontaria um rombo que não existe. É a família do fator da Skol, com uma diferença: lá a conversão acontece na conferência; aqui **o item já nasceu na régua errada**.

**`lib/stock/reunitizar-item.ts`** (caminho (a), o que o dono escolheu): troca a unidade de controle do item existente.
- **⭐ A INVARIANTE QUE TRAVA TUDO: o VALOR em R$ não muda.** Quantidade × fator · custo ÷ fator · **valor idêntico ao centavo** — checado em RUNTIME (lança se divergir) e em teste. Se o dinheiro mudasse, a reunitização estaria inventando ou destruindo valor.
- **O LEDGER CONTINUA IMUTÁVEL:** correção = **ESTORNO + movimento novo**, nunca UPDATE. O original fica e o histórico de compras segue legível (data/nota/fornecedor pelo `receiptId`).
- **⚠️ CUSTO EM PRECISÃO CHEIA:** 27,75 ÷ 12 = **2,3125** no ledger. Arredondar pra 2,31 faria 768 × 2,31 = 1.774,08 ≠ 1.776,00 e **o CHECK do banco recusaria** (o mesmo que mordeu na conclusão de produção). **Quem arredonda é a LEITURA** — o custo médio derivado mostra 2,31, o número que o dono citou.
- **VÃO JUNTO ou o bug volta sozinho:** o **fator APRENDIDO** da nota (**16 CX→PC vira 192 CX→pães**; sem isso a próxima nota reentra na régua antiga) e o **mín/máx** (escritos na régua antiga, virariam alarme falso).
- **RECUSA item já usado em ficha:** a receita foi escrita na régua antiga e passaria a significar outra coisa em silêncio. Instrui em vez de converter por debaixo.
- **UI:** bloco discreto na ficha do item ("A unidade está errada?") com **prévia obrigatória** mostrando antes/depois e a âncora *"o valor em estoque não muda"*.

**EXECUTADO EM PROD** (`pg_dump pre-reunitizar-pao-20260827-163634`, 4.8M): **64 PC → 768 pães · R$ 2,31 · valor 1.776,00 idêntico · fator 16 → 192**. Ledger com as 3 linhas (original + estorno + nova a 2,3125).

**⚠️⚠️ E O JUIZ PEGOU UM BUG MAIOR QUE A MINHA MUDANÇA — o E2 era INCOMPATÍVEL COM A CORREÇÃO DO PRÓPRIO MÓDULO.** Depois da conversão o juiz ficou 🔴: *"2 itens conferidos vs 3 movimentos ENTRADA_NF"*. **A causa não foi a reunitização:** o E2 contava `ENTRADA_NF` **CRU** por `receiptId`, e correção neste módulo é **sempre** estorno + novo (ledger imutável). Ou seja, **bastava corrigir um item de nota, por qualquer caminho, pra o juiz acusar um rombo que não existe** — o invariante contradizia a disciplina que o próprio módulo documenta. **Fix:** conta **LÍQUIDO** (entrada estornada não vale). REGRA 1 nos dois sentidos: com o `count` antigo os 2 testes novos ficam vermelhos, **e o E2 continua mordendo quando falta movimento de verdade** (estornar sem recriar) — o estorno não virou desculpa universal. **Juiz em prod depois: 🟢 0 issues.** **LIÇÃO: invariante que conta LINHA em ledger imutável envelhece mal — toda correção legítima vira alarme falso, e alarme falso é pior que alarme nenhum.**

**QUEIJO: nada a fazer** — `MUSSARELA EM PECA 02 KG` já está em **KG (31,90)** e a ficha aceita decimal. Teste trava **0,080 KG × 31,90 = subtotal 2,55**.

**PREFILL (nome + preço do PDV):** os props existiam e estavam no bundle servido, mas o dono viu campos vazios — **não reproduzi a causa**. Tornei robusto: agora também se aplicam **quando chegam** (`useEffect`), não só na montagem, e **só em campo intocado** (nunca sobrescreve o que o dono digitou).

⚠️ **O guard estrutural pegou um erro MEU no caminho:** o GET da prévia pedia `stock.manage` e a regra é *"ler nunca exige gerenciar"*. **Corrigi a ROTA, não o guard.**

**⭐⭐ MODAL DA RECEITA — REDESENHO "PLATE COST" + O PREFILL QUE ABRIA VAZIO (28/08).**

**O BUG (reportado 2×):** `/estoque/cardapio` → card XIS COMPLETO → painel (vendas 53 · preço 23,37 **visíveis**) → "Montar a receita" → **modal com nome e preço VAZIOS**. Conferido contra o servidor: a rota devolvia `nomesSuitable: ["XIS COMPLETO"]` e `precoPraticado: 23.37` — **os dados sempre chegaram certos**; quem perdia era a camada React.

**⚠️ A CORREÇÃO DE FUNDO, e é a lição:** o prefill vivia como **valor inicial de `useState`** dentro do componente. Duas tentativas de conserto (valor inicial, depois `useEffect` de sincronização) não resolveram, e **nenhuma das duas podia virar teste vermelho** — o projeto não tem jsdom/RTL, então regra que mora dentro de `useState` é regra que ninguém consegue provar. **A decisão saiu pra `lib/stock/cardapio/valores-iniciais.ts` (função PURA)** e o componente virou casca que só ecoa. Agora o teste percorre o caminho real (hub → `detalheProduto` → `valoresIniciaisDaFicha`) e afirma `nome: 'XIS COMPLETO'` e `preco: '23,37'`. **Regra que não dá pra testar é regra que volta a quebrar.**

**REDESENHO — UM EDITOR, DOIS MUNDOS** (anatomia do MarketMan):
- **PRODUTO FINAL = PLATE COST.** 1 ficha = **1 porção vendida**. **SUMIRAM** "A receita rende N" + unidade e "Validade" — são conceitos de quem produz em LOTE, e a tela dizia o contrário do que o produto é. **Cabeçalho:** nome (prefill) · `no PDV: X` · preço (prefill do PDV, editável, com "pode editar") · setor. **Corpo = INGREDIENTES**, com **custo por unidade e MARGEM ao vivo no topo** (verde/âmbar/vermelho na MESMA régua da tela do cardápio — `faixaMargem`, uma decisão num lugar só), subtotal por linha, e intermediário com chip **"produzido"** linkando pra receita de produção dele. **Rodapé sticky** com [Criar ficha] primário.
- **INTERMEDIÁRIO** mantém rende/validade/preparo e ganha o mesmo padrão visual.
- **"Livro de receitas" (o Cookbook)** — seção **COLAPSADA e opcional**: tempo de preparo + modo de preparo, com a frase *"nada aqui entra no custo"*. Abre sozinha quando a ficha já tem conteúdo.
- Preço em **pt-BR** (`23,37`, não `23.37`) — o dono digita com vírgula.

⚠️ **A FOTO do cookbook NÃO ENTROU** e o motivo é estrutural: `StockFichaVersao` não tem campo de foto e **o isolamento do módulo proíbe ALTER** (migrations de estoque são CREATE-only, com guard de CI). Guardar exigiria tabela nova (`stock_ficha_foto`) — registrado como débito pequeno, não construído no meio de um sprint de UX.

**📋 ROADMAP REGISTRADO (decisão do dono: registrar, NÃO construir agora):**
1. **ALERTA DE MARGEM** (padrão MarketMan) — nota nova muda o custo de um insumo e derruba a margem de um produto abaixo de X% → aviso no juiz/e-mail: *"o queijo subiu e o Xis caiu pra 12%"*. ⚠️ A base já existe: o custo é derivado do ledger e recalcula sozinho; falta o **limiar por empresa** e o disparo. Cuidado conhecido: alarme por produto sem custo completo seria ruído — só entra produto com custo fechado.
2. **MENU ENGINEERING** — quadrante margem × popularidade (**Estrela / Burro-de-carga / Enigma / Cão**). Já temos os dois eixos (vendas do Suitable + margem do hub); é relatório barato de alto valor. ⚠️ Só fica honesto depois que a maioria dos 80 produtos tiver ficha — hoje 78 estão sem, e o quadrante mostraria um canto vazio.

**⭐⭐ O CAMPO DE QUANTIDADE NÃO ACEITAVA DECIMAL (28/08) — `value={numero}` mata a digitação.**

**O dono pegou no Acém (33,95/KG):** *"o campo só aceita 1, 5, 10 — não consigo digitar 0,050 (50 gramas) nem 0,10. Receita de lanche É feita de fração de KG; sem decimal o modal é inútil."*

**A CAUSA, exata:** o input era `value={c.qtdPlanejada}` (**NÚMERO**) com `onChange` convertendo na hora. No instante em que a vírgula é digitada, `"0,"` vira o número `0` e **a vírgula some da tela** — estado intermediário não é representável como número. Só inteiro passava, **e não por regra: por efeito colateral**.

**A CURA É ESTRUTURAL:** o que se **DIGITA é TEXTO** e fica texto enquanto se digita; o número é **DERIVADO**. `lib/stock/quantidade.ts` (puro) sanitiza, converte e valida:
- vírgula **e** ponto aceitos; ponto vira vírgula na tela (padrão BR) · até **3 casas** em KG/LT (grama/ml é o menor que a cozinha usa)
- **UN continua INTEIRO**, e a recusa **ENSINA**: *"se você usa meia unidade, o item precisa ser cadastrado numa unidade menor"* — que é exatamente a reunitização feita no pão
- `inputMode="decimal"` (teclado numérico com vírgula no celular, onde ele monta as fichas)
- **conversão amigável ao lado: "0,050 KG = 50 g"** — existe pra não errar **UM ZERO** (0,05 e 0,005 são visualmente parecidos e **10× diferentes** no custo)
- **vazio NUNCA vira 0** — ausência não é zero (a mesma regra do "sem contagem" do estoque)

**19 testes** com os números reais (0,050 × 33,95 = **1,70** · 0,080 × 31,90 = **2,55**) e — o que importa — com os **ESTADOS INTERMEDIÁRIOS** (`"0"` → `"0,"` → `"0,0"` → `"0,05"`), que são precisamente o que o campo antigo destruía.

**REGRA 4:** vale pros dois mundos **de graça** — cardápio e receita de produção abrem o MESMO `FichaEditor` (conferido nos 3 call-sites).

⚠️ **A VARREDURA ACHOU O MESMO PADRÃO EM OUTRO LUGAR:** `components/estoque/conferencia-view.tsx` (linhas 236 e 314) usa `value={e.qtdRecebida}` **numérico**. Lá tem `type="number"`, que delega o parsing ao browser e **vem funcionando nas conferências reais** — então é **RISCO, não bug provado**. **NÃO mexi:** é fluxo diário e não estava no escopo. Decisão do dono se ataca agora ou fica registrado.

**⭐ O DROPDOWN DE INGREDIENTES NÃO FECHAVA SEM ESCOLHER (28/08).** *"abro a busca, a lista abre (Acém, Coxão...), mas se eu DESISTO de escolher não tem como sair."* Era verdade: o `aberto` só virava `false` ao **escolher** ou **criar** item — quem desistia ficava com a lista pendurada, e no celular pior.

⚠️ **NÃO EXISTIA NENHUM utilitário de clique-fora no projeto** — cada dropdown novo ia reinventar (ou esquecer, como este esqueceu). Virou **um lugar** (`lib/hooks/use-dismissivel.ts`, REGRA 4/5): dropdown novo chama o hook e **nasce dispensável**. Clique/toque fora · **ESC** · escolher (já fechava). **`mousedown`/`touchstart`, NÃO `click`** — com `click` o alvo de fora pode re-renderizar entre press e release e o evento se perde; e `touchstart` é o que faz funcionar no celular. Sem container montado **não fecha** (fechar por ausência de referência derrubaria o painel no 1º render).

**VARREDURA (REGRA 4):** o `BuscaItem` é o único dropdown flutuante de verdade e serve os **dois mundos** (cardápio e receita de produção usam o mesmo `FichaEditor`) — um fix, os dois. O mapeamento do Suitable usa **`<select>` nativo**, que o browser já dispensa; os outros `aberto` do app são acordeão, não dropdown. ⚠️ **Achado no caminho:** o sheet *"Que produto é este?"* da conferência fechava no backdrop e no X mas **ESC não fazia nada** — ganhou `useEscape` (hook irmão, só a tecla; clique-fora lá seria redundante).

⚠️ **7 testes com a decisão PURA e duck-typed** (`cliqueFoiFora` aceita qualquer coisa com `contains`), porque o projeto roda em `environment: node`. **Não puxei jsdom só pra isso** — trocaria um risco pequeno por um custo permanente de manutenção.

**⭐⭐ A BUSCA NÃO ACHAVA O ITEM (28/08) — `contains` do Prisma é CASE-SENSITIVE no Postgres.**

O dono: *"o PAO DE XIS aparece rolando a lista completa, mas a busca não acha de jeito nenhum: 'pao de xis' nada, 'pao' nada, **'xis' nada**"* — e o "xis" (sem acento) foi o dado que matou a hipótese de acento.

**CAUSA MEDIDA no banco de prod (não deduzida):**
```
contains("xis") → 0      contains("XIS") → 1   ("PAO DE XIS")
contains("pao") → 0      contains("PAO") → 1
```
**`contains` é case-SENSITIVE no PostgreSQL e case-INSENSITIVE no SQLite.** Funcionava em DEV e falhava CALADO em PROD — **a pior classe de bug, porque o dev nunca vê**. ⚠️ Nenhuma das 3 hipóteses levantadas: era a MESMA fonte, era CONTÉM (não prefixo), e não era cache.

⚠️ **E `mode: 'insensitive'` NÃO bastaria:** conserta caixa, **não ACENTO**. Medido no mesmo banco: `insensitive("pao")` acha "PAO DE XIS" mas **não** acha "Pão tradicional". Num catálogo onde a NOTA escreve "PAO" e o DONO escreve "Pão", é o mesmo bug com outra cara.

**FIX — `lib/busca-texto.ts`** (`normalizarBusca`/`casaBusca`/`filtrarPorBusca`): o filtro roda **NO APP, sobre a MESMA lista que a tela renderiza** (REGRA 4 — filtro e lista não têm como discordar), casando por **palavra em qualquer ordem** ("xis pao" acha "PAO DE XIS", porque o nome vem da nota e não da cabeça do dono). **BÔNUS: mata a truncagem** — o `take: 50` valia ANTES do filtro, então item fora das 50 primeiras sumia da busca mesmo casando; agora vale depois. **PROVADO EM PROD:** `xis`→1 · `pao`→2 · `PAO`→2 · `pão`→2 · `xis pao`→1 · `coxao`→"Coxão Mole" · `acem`→"Acém". 15 testes.

⚠️⚠️ **DÉBITO REGISTRADO — a classe existe em ~10 outras buscas, e há uma RESTRIÇÃO REAL que impede o fix óbvio:** `mode: 'insensitive'` **não existe no SQLite**, e o dev roda SQLite → a correção quebra o `tsc --noEmit` local, que é parte do DoD. Os **20 usos que já existem** no código precisam de um *cast* pra compilar (ver `conciliacao/find-and-match`, que monta `{ mode: 'insensitive' as const } as {...}`). Cheguei a corrigir 4 e **reverti**. **As afetadas (texto que o DONO digita):** `fornecedores` (razaoSocial/nomeFantasia) · `regras` (padrao) · `personal-profile/queries` (description — busca de movimentações do PF) · `audit-log` + export (userName/entityId) · `admin/coupons`. **Não são busca** (constante do sistema, sem problema): `recategorize-pix`, `suggest-category`, `auto-memorize-vendor`, `find-similar-pending`, `find-and-match` (cnpjDigits). ⚠️ **Evidência de que a classe já era conhecida e contornada na unha:** `lib/credit-card-pj/queries.ts` enumera à mão `'CARTAO','cartao','CARTÃO','cartão','CARTOES',…` — 12 variantes de caixa e acento da mesma palavra. **Caminhos possíveis:** (a) app-side como no estoque (só onde a lista é pequena — não serve pra audit-log/transações PF, que paginam milhares); (b) extensão `unaccent` no Postgres + raw SQL; (c) migrar o dev pra Postgres e usar `mode` sem cast — o mais definitivo, e o que também mataria a divergência dev/prod que causou este bug.

**PENDENTE (REGRA 2):** o dono validar no notebook e no celular, e montar o Xis Completo inteiro (pão 2,31 + porção de carne 3,62 + queijo 0,080 KG + o resto).

## 🗺️ O QUE FALTA PRO MÓDULO DE ESTOQUE FECHAR (atualizado 24/08/2026)

**FEITO e em prod:** Fase 0 (SEFAZ) · Fase 1 (ledger + conferência) · Fase 2 (produção) · Fase 3 (vendas, saídas, catálogo, **contagem**, **Real vs Teórico**, **entrada manual**, **itens do DANFE**) · **Fase 3 Parte 1 — ENFORCEMENT (as 31 rotas no RBAC + papéis semeados, 24/08)** · **PONTE 1 (contas a pagar, 24/08)**.

**FALTA — em ordem:**
1. **Convidar o Cristian** como `OPERADOR_ESTOQUE` em `/usuarios`. ⚠️ **A fechadura JÁ ESTÁ PRONTA** (commit `f28b213`, em prod): 0 rotas de estoque no check antigo, papéis semeados, prova rodada. Não há pré-requisito pendente.
2. **CONTAGEM INICIAL** — o ponto-zero. Acende o Real vs Teórico (que hoje mostra "sem contagem" em tudo, corretamente) e é o marco a partir do qual a variância significa alguma coisa.
3. **FASE 4 — CMV por consumo no DRE (a ÚLTIMA ponte).** O dia em que o DRE fica honesto: custo da mercadoria vendida por COMPETÊNCIA (o que foi consumido), não por caixa (o que foi comprado). Junto: sugestão de compra (mín/máx + consumo + lead time) e pedido/cotações.

**DÉBITOS registrados (nenhum bloqueia o Cristian):**
- **16 rotas fora do estoque ainda no `userCompany.findFirst`** (cartões, empréstimos/parcelas-do-mês, categorias/template-diff, import-warnings, monitor-alerts, auth). Pro operador falham FECHADO (404 sem `UserCompany`) — direção segura, mas **certo por acidente, não por desenho**.
- **Estorno de conferência NÃO EXISTE** — por isso o item "estorno pergunta o que fazer com as contas" da Ponte 1 ficou só com a amarra pronta (`stock_payable_link` responde quando o fluxo existir).
- ~~3 testes vermelhos de grep~~ **RESOLVIDOS em 01/09** — substituídos por testes que rodam o pipeline e conferem o número (ver a entrada em Pendências). A suíte não tem mais vermelho esperado.
- EAN cross-fornecedor · `STOCK_CERT_ENC_KEY` no `.env` (→ cofre com mais clientes) · sem cron de retry de evento SEFAZ · recibo sem PDF.
- **A BAIXA DOS COMPLEMENTOS não está ligada** (02/09) — a prateleira, os dois mapas e o import estão em prod; o que falta é o gesto que gera `BAIXA_VENDA` a partir das ocorrências. ⛔ Antes de ligar, ler o bloco "LEIA ANTES DE LIGAR A BAIXA" em `lib/stock/vendas/import-complementos.ts` (reimport de dia já baixado) e travar o red-then-green combinado com o dono: **1 ocorrência de CALABRESA → CONSUMO de 1 UN de "porção de calabresa" e ZERO movimento na calabresa CRUA**.

## ⭐⭐⭐ MARCO — FLUXO DE CAIXA: A PERGUNTA DE DONO RESPONDIDA COM RASTRO (25/08/2026)

**"Entrou X, paguei Y, sobrou Z"** — a página central dos líderes (QuickBooks e Xero põem como front page). Tela `/empresas/:id/fluxo-caixa`, anatomia CaP, **SÓ LEITURA: zero motor novo, zero tabela nova.**

**⚠️ NÃO É O DRE, e a tela DIZ isso.** DRE é COMPETÊNCIA (quando o fato aconteceu); fluxo é CAIXA (quando o dinheiro entrou/saiu da conta). A diferença mais visível é o cartão: no DRE a despesa é a COMPRA, aqui a saída é o **PAGAMENTO DA FATURA**. Somar os dois contaria a mesma despesa 2×. Sem a frase na tela, alguém compara os dois números e conclui que um está errado.

**AGOSTO REAL (validado pelo dono):** ENTROU R$ 366.442,25 · SAIU R$ 324.422,21 · **SOBROU R$ 42.020,04** · saldo em contas −R$ 53.958,18 (sicredi −79.991,73 é a conta garantida operando negativa, correto — a tela quebra por conta porque o consolidado sozinho assusta). Saídas: Matéria-Prima Alimentos 129.864,01 · Salários 41.287,50 · **Parcela de empréstimo 21.692,38** · **Fatura de cartão 21.676,05** · Distribuição de Lucros 21.520,00 · Entregador 14.725,50 (32 categorias). Entradas: Receita de Vendas 315.796,01 · Venda em dinheiro 50.203,35 · iFood 442,89.

**⭐ O ACHADO — R$ 43.368,43 iam virar "A CLASSIFICAR" (balde de erro).** Eram **2 pagamentos de fatura + 4 parcelas de empréstimo**: as duas famílias que o dono listou POR NOME no pedido. Não têm categoria no banco, mas o sistema sabe o que são por ESTRUTURA (flag `isCardPayment`, vínculo de parcela) → ganharam **rótulo sintético próprio marcado `[sistema]`**. "A CLASSIFICAR" fica reservado pro que ninguém sabe o que é — e zerou. **Decisão do dono: "o [sistema] no lugar do balde de erro foi a jogada certa".** ⚠️ As parcelas quase escaparam: o vínculo tem **DUAS PORTAS** (1:1 `reconciledTransactionId` e N:1 `LoanInstallmentPayment`) e na Cacula as 4 de agosto estão **TODAS pela N:1** — checar só a primeira (o erro de 14/08) daria zero e jogaria 21 mil no balde. Teste trava as duas portas.

**REGRAS DE HONESTIDADE (todas em `lib/fluxo-caixa/motor.ts`, uma vez só):** (a) **transferência entre contas próprias FORA** pelas 4 marcas que o sistema já tem (`type=TRANSFER`, `isInternalTransfer`, `pendingTransfer`, categoria `dreGroup=TRANSFERENCIA`) — **não escrevi um 2º detector** (REGRA 4); sem isso agosto inflaria ~42 linhas dos DOIS lados (os pares "PIX ENVIADO 17.000" ↔ "YUSSEF… Transferência 17.000"); (b) **cartão**: entra o pagamento, sai a compra — auditado em prod, as 7 tx com cartão E conta bancária são TODAS pagamento de fatura (a compra nasce com `bankAccountId` null); (c) só `lifecycle=EFFECTED` e `reconciledWithId=null` (conta a pagar em aberto não é caixa; conciliada não conta 2×); (d) **mês corrente marcado "em andamento (até DD/MM)"**; mês anterior ao marco de agosto/2026 aparece COM o número mas com ressalva visível; (e) **a EXCLUSÃO é mostrada na tela** ("transferências entre contas próprias: N lançamentos, R$ X") — esconder a exclusão é tão ruim quanto não excluir.

**INVARIANTE travado (REGRA 7):** Σ das categorias == total, dos dois lados, incluindo os sintéticos. Rótulo novo esquecido = teste vermelho ANTES de a tela mostrar total que não fecha com as partes. 22 testes.

**⭐ UNIFICAÇÃO (o dono: "essencial"):** `/relatorios/fluxo-caixa` (barras realizado × previsto) tinha um `where` PRÓPRIO, **sem** as travas de `isInternalTransfer`/`pendingTransfer` e sem o tratamento do cartão → as duas telas dariam totais DIFERENTES pro mesmo mês. Migrado pro MESMO `whereFluxoCaixa`. Mesma classe do "5 detectores de par que discordavam".


## ⭐⭐ PF — O MENU LEVAVA PRA EMPRESA (26/08/2026) + TRAVA ANTI-TESTE-EM-PRODUÇÃO

**O SINTOMA:** *"o módulo de cartão não funciona na PF, não consigo nem cadastrar."* **A CAUSA NÃO ERA O MÓDULO.** Investigação read-only com sessão real: `/api/perfis/<yussef>/cartoes` **200**, `dashboard-summary` **200**, `PAGE /perfis/<id>/cartoes` **200**, `PAGE .../cartoes/novo` **200** — e o perfil **já tinha 1 cartão cadastrado** ("banrisul pf", limite 76.150). O módulo PF (Fatia 2: `CreditCard` + `CreditCardInvoice`) nunca esteve quebrado.

**A PORTA EXATA:** ao trocar pro workspace PF, **`currentEmpresaId` NÃO era zerado**. Como TODO item de empresa é gated por `{currentEmpresaId && ...}`, o menu INTEIRO da PJ seguia visível apontando pra última empresa. Clicar em "Cartões" dentro do PF levava a `/empresas/caçula/cartoes` — **a tela da PJ**; cadastrar ali criaria um `BusinessCreditCard` na Caçula. E **não existia NENHUMA entrada de menu** pra `/perfis/[id]/cartoes`. ⚠️ **O código já sabia:** o efeito `empresaIdForBadges` zera a empresa no PF pelo MESMO motivo declarado em comentário ("badges mostravam dados de empresa que o user nem está visualizando") — **corrigiram os badges e deixaram os ~30 itens do menu**.

**FIX (choke-point, não 30 ifs):** `const empresaAtiva = workspaceType === 'pf' ? null : currentEmpresaId` governa os **28 destinos** de `/empresas/`; os 4 itens PJ que não tinham gate (Contas a Pagar/Receber, Conciliação, Pendentes) ficaram atrás de `workspaceType !== 'pf'`. **Seção PF ganhou Cartões, Contas, Movimentações, Insights e Importar extrato.** Guard estrutural (`__tests__/sidebar/pf-nao-ve-menu-da-empresa.test.ts`, 11 testes): nenhum `href` de `/empresas/` pode escapar do choke-point, e item novo sem a trava quebra o teste — foi assim que a correção se perdeu da 1ª vez.

**⚠️ REGRA 4 — O QUE A PF VÊ:** antes deste fix a PF tinha apenas **3 itens próprios** (Despesas, Receitas, Categorias) contra **~35 itens de PJ apontando pra Caçula**, incluindo os 11 de Estoque.

**⚠️ DÉBITO REGISTRADO — o ciclo de cartão da PF NÃO é o mesmo da PJ (são dois módulos):** PJ = `BusinessCreditCard` + fatura **virtual** (Transaction agrupada por `invoiceMonth`); PF = `CreditCard` + **linha real** `CreditCardInvoice` com `status` (OPEN/CLOSED/PAID/PARTIAL/OVERDUE — nisso a PF é MELHOR que a PJ, onde "paga" é derivado). **A PF NÃO TEM import de fatura em PDF**: os 3 parsers determinísticos vivem em `lib/credit-card-pj/` e só estão ligados à rota PJ; na PF só dá pra lançar compras à mão. **O juiz K-series é PJ-only** (`db.businessCreditCard`) — cartão PF tem ZERO cobertura de invariante. **Decisão do dono (26/08): sprint próprio, com fatura PF real dele como fixture; os parsers PJ, estáveis e auditados, NÃO se mexem no fim de investigação.**

**⛔⛔ A SUÍTE RODOU CONTRA PRODUÇÃO EM 08/08/2026 às 01:21** — **30 perfis PF órfãos e 18 cartões** criados no banco real (`CardA`, `CardB`, `Estorno`, `Rotativo`, `Pay test`, `Summary teste`, `CardRevert`…). Ficaram INVISÍVEIS na tela (sem `UserPersonalProfile`, a `/api/perfis` não os devolve), então era poluição inerte — mas sujava contagem e auditoria. **COMO ACONTECEU:** o projeto não tem `setupFiles` no vitest nem tratamento de `DATABASE_URL`; os testes usam `lib/db.ts`, que lê o ambiente. Rodar `npx vitest` **dentro do servidor** (onde o `.env` aponta pra prod) = testes no banco real. **LIMPO (26/08)** com `pg_dump pre-limpeza-perfis-teste-20260826-152824` antes: 30 apagados por cascade, restaram 4 perfis (todos com usuário vinculado) e 2 cartões reais; **o perfil do dono intacto** (1 cartão, 3 contas, 125 tx).

**⛔ TRAVA POR CONSTRUÇÃO (REGRA 5) — `lib/testing/guard-banco-de-teste.ts` + `vitest.setup.ts`:** a suíte **RECUSA SUBIR** se o `DATABASE_URL` não for de um banco de teste. **⚠️ A REGRA É POR NOME DO BANCO, NÃO POR HOST — o Postgres de produção roda na MESMA máquina, então a URL de prod também diz `localhost`**; barrar "host remoto" não pegaria nada. O que distingue é `conta_ia_prod` × `dev.db`. **E é ALLOWLIST, não denylist:** só passa `file:` (SQLite dev) ou Postgres com `test`/`scratch` no nome — banco desconhecido (`conta_ia`, `caixaos`) é recusado, porque bloquear "o que parece produção" falharia no dia em que o nome mudasse. Lê o `.env` na mão (o projeto não tem `dotenv`; puxar dependência pro guard seria trocar uma trava simples por algo a manter). **PROVADO:** apontando o `.env` pra forma de prod, a suíte parou com **0 testes executados** e mensagem nomeando o banco e ensinando a saída. 9 testes, incluindo "testemunha não vira senha-passe por conter test".


## ⭐⭐ CARTÃO PF — O CICLO COMPLETO (26/08/2026)

**O que a PJ tinha e a PF não:** cadastrar → **ler a fatura em PDF** → casar o pagamento → **PAGA**, com juiz vigiando. Agora tem.

**⚠️ FATURA DE CARTÃO NO BRASIL É PDF.** O botão da PF dizia *"Importar fatura OFX"* e levava pro import de **EXTRATO** — o Banrisul não emite OFX de cartão. Corrigido pra "Importar fatura PDF" com tela própria.

**PARSER (investigação antes de prometer — pedido do dono):** o parser PJ do Banrisul **NÃO serve**. Rodado contra a fatura real: Brasil 26.807,47 vs 39.302,64, **Exterior e IOF ZERO**. Causa estrutural: na PJ as transações ficam só na coluna ESQUERDA e a defesa do parser é **cortar a direita** (lá é BanriClube/pontos); na **PF as DUAS colunas têm lançamento** — dois portadores lado a lado (**106 transações na esquerda, 46 na direita**). A validação **recusaria o import** — a disciplina da PJ funcionou contra um layout que ela não conhece. **`lib/fatura-banrisul/nucleo.ts`**: a LEITURA DA LINHA (idêntica nos dois) saiu do parser PJ; **golden das 3 faturas PJ: 68 verdes antes e depois**, provando ao centavo que a extração não mudou. **`banrisul-fatura-pf.ts`**: bandas verticais deduzidas de **ONDE AS DATAS SE ALINHAM**, por página, com filtro de densidade. **5 tentativas até fechar, cada número virou comentário no arquivo** — (1) parser PJ direto; (2) corte fixo 66 → IOF estourou pra 3.874,27 porque a **página 1 é o RESUMO** e lá "IOF" é total; (3) bandas pela coluna do CABEÇALHO → banda direita leu ZERO (o título "NR. 9113" está na col 76, as transações na 66); (4) bandas pelas datas sem filtro → data solta no rodapé virou coluna e o Brasil despencou pra 1.685,12; (5) com filtro de densidade, fecha. **FECHA AO CENTAVO:** despesas 39.302,64 = declarado; **saldo anterior (−20.954,54) + despesas + rotativo (0,62) = 18.348,72** = declarado. ⚠️ Meus alvos de comparação estavam errados no começo: o "TOTAL DE GASTOS" é o subtotal **de um portador** (existem dois: 23.648,03 e 15.654,61) e somam o "Despesas / Débitos no Brasil", que na PF é o total de TUDO (Brasil + exterior + IOF).

**IMPORT (`importar-fatura-pf.ts`):** ⚠️ **não usa `createPurchase`** — aquele recebe o TOTAL e o DIVIDE em N parcelas futuras; o PDF traz **a parcela DESTE mês, já cobrada** ("QATAR 02/05"), e importar por lá duplicaria o que o banco vai cobrar depois. Cada linha vira UMA tx na fatura do extrato. **A fatura é a do VENCIMENTO do PDF** — e achar essa não é óbvio: com "fecha 29 / vence 10" o vencimento cai no mês SEGUINTE ao fechamento, e a 1ª versão pegava a fatura errada (**o teste pegou**: esperava 10/08, vinha 10/09). Agora anda pra trás mês a mês até o vencimento calculado bater. **Idempotente** por `dedupHash` (cardId|data|valor|desc|parcela) — reimportar o mesmo PDF cria 0. **Nunca grava fatura que não fecha**, no preview E no confirm.

**CASAR (`casar-pagamento-pf.ts`):** ⚠️ **não é o `payInvoice`** — aquele CRIA a saída (o dono digita "paguei"); aqui o dinheiro **já saiu e já está no extrato**, então criar outra duplicaria e o saldo cairia 2×. Este AMARRA a tx existente. **Não mexe no saldo da conta.** Candidatos ordenados (valor exato primeiro), **o dono confirma — não adivinha**. Status pelo MESMO `assertInvoicePaidConsistency` do `payInvoice`. Tem desfazer.

**⭐ JUIZ KP1-KP6 NA PF (`card-invariants-pf.ts`), no mesmo contador `cardIssues`:** o cartão PF tinha **ZERO invariante** (o K-series só olhava `businessCreditCard`). KP1 total × Σ das linhas · **KP2 estado coerente** · KP3 pagamento órfão que bate fatura aberta · KP4 sinal · KP5 pagamento sem fatura · KP6 vencida sem pagar >10d. **KP2 e KP5 não têm irmão na PJ**: só existem porque a **PF tem `status` REAL na linha** (`CreditCardInvoice`), enquanto na PJ "paga" é derivado — dá pra checar a coerência do estado, coisa que na PJ nem faz sentido perguntar.

**⚠️ BURACO DE SEGURANÇA FECHADO NO CAMINHO:** `getCardInProfile` só confere que o CARTÃO é do PERFIL — **não que o USUÁRIO é dono do perfil**. Todo write do módulo chama `checkProfileAccess` antes; minhas duas libs novas não chamavam. Sem isso, bastava trocar o id na URL pra importar fatura no perfil de outra pessoa. Corrigido, e o teste prova (outro usuário leva exceção).

**17 TESTES DO CICLO com a fatura REAL** (fixture anonimizada **preservando as COLUNAS** — o parser depende delas; a 1ª versão trocou a palavra "PAGAMENTO" e o resultado divergiu em 8.736,17, então as palavras que o parser usa pra classificar sobrevivem à anonimização): fecha ao centavo · idempotência · PAGA · desfazer · KP verde · **isolamento PF↔PJ provado de verdade** (empresa com cartão ao lado, nenhuma vê a outra, nenhuma linha da fatura PF virou Transaction da empresa).

**FALTA (REGRA 2):** o dono importar a fatura real e casar o pagamento em prod.

## 📋 PRÓXIMO SPRINT — VENDAS/FLUXO, 4 ITENS (definido pelo dono em 26/08)

Entra **depois** que o dono validar o cartão PF em prod (importar a fatura + casar o pagamento). **Nada novo entra na frente.**

1. **INSTRUMENTAR O GATILHO DE VENDAS** *(aprovado 26/08)* — `recomputeVendasSeVenda` hoje só loga **quando recomputa**. Resultado: *"não logou"* é ambíguo entre **"não foi chamado"** e **"foi chamado e virou no-op"**, e foi exatamente essa ambiguidade que me impediu de cravar a porta da venda-fantasma de **R$ 2.041,00** (25/08, dinheiro do cofre — o juiz pegou, o self-heal resolveu, a porta ficou desconhecida). **Logar SEMPRE que o hook é chamado, com o motivo do no-op** (categoria não é de venda / empresa sem perfil / erro engolido). ⚠️ Diagnóstico só serve se estiver **em prod ANTES** do bug repetir — quanto antes subir, antes a próxima ocorrência é capturada. Ver o débito completo em "Pendências", com a varredura REGRA 4 das 12 portas que criam transação sem o gatilho.
2. **Validar na tela** que Vendas mostra **~380 mil** (agosto puro) e não 595 — REGRA 2 do fix já em prod.
3. **Validar o Fluxo de Caixa** com o card SAIU levando ao resumo completo das 34 categorias.
4. **Confirmar os 2 pares de transferência** que o detector aponta (24/08, 25.000 e 10.000, CNPJ próprio no memo) — derruba ENTROU e SAIU em 35.000 cada; o SOBROU não muda.

⚠️ **ESTADO REAL DOS "TRÊS BUGS":** o CÓDIGO deles **já está em prod desde 26/08** (commits `2e4cb24` recompute duplicando, `0cdafdb` ponte V6, `c111ea9` docs) — conferido no servidor: **0 chaves duplicadas** e **agosto puro R$ 379.637,26**. O que resta dali são os itens **2, 3 e 4** acima, que são **validação sua na tela**, não código. O item **1 é o único desenvolvimento novo** do sprint.

### ✅ SPRINT DA VITRINE ENCERRADO (27/08) — 5 itens, commit `22eea0d`

**1-3 conferidos vivos com o dado de hoje:** agosto puro **R$ 381.678,26** · bloco de borda **43.106,03 fora da soma** e marcado · **0 VendaDiaria duplicada** · **V6 `inexplicado 0,00`**.

**Os 16 OP.CREDITO C/GARANTIA de agosto (R$ 200.232,00) batidos linha a linha:** **0 duplicata** (nenhum par mesma-data+mesmo-valor) e cada um atribuído à competência certa. **⭐ E o LEDGERBAL FECHA EXATO — saldo calculado −9.434,99 == LEDGERBAL −9.434,99.** Ou seja: o import do Banrisul estava limpo o tempo todo; o inchaço de 43.106 → 215.530 foi **VendaDiaria duplicada, nunca transação duplicada**. A hipótese de "import sujo" morre aqui, com número.

**ITEM 4 — o hook de vendas agora LOGA SEMPRE, inclusive no no-op, dizendo de QUAL PORTA veio.** `OrigemHook` é parâmetro obrigatório na prática (default `'desconhecida'` só pra não quebrar chamada nova em silêncio) e as **6 portas se identificam**: `POST /api/transacoes` · `PATCH /api/transacoes/[id]` · `POST /api/transacoes/lote` · `import-ofx/confirm` · `conciliacao/reconcile` · `createContaPendente`. Os no-ops legítimos passaram a ter MOTIVO escrito ("empresa sem perfil de recebimento" · "transação SEM categoria" · "categoria não é de venda (N id(s), nenhum RECEITA_BRUTA)"). ⚠️ **Isto é diagnóstico, não fix** — a venda-fantasma de R$ 2.041,00 só se explica na PRÓXIMA ocorrência; a diferença é que agora "não logou" passa a significar **uma coisa só** (não foi chamado), em vez de quatro.

**ITEM 5 — o Dashboard PF NÃO estava lendo fonte PJ. Era CONTRATO, que é pior: não dá erro, dá SILÊNCIO.**
- **A varredura (REGRA 4) saiu limpa do que o dono suspeitava:** todo `fetch` da home do PF aponta pra `/api/perfis/...`; **nenhum widget lê fonte de empresa** (nem saldo, nem faturas, nem empréstimos).
- **O bug real:** a rota devolvia `{summary, topCategoriesOnCards, invoiceHistory}` e a home lia **`cards`** e **`summary.totalDue`** — que não existiam. `cards ?? []` virava lista vazia e a tela dizia **"Nenhum cartão cadastrado"** com o cartão lá. ⚠️ **O empty state MENTE com cara de verdade:** "nenhum cartão" é uma resposta plausível, então ninguém desconfia — diferente de um 500, que grita.
- **⭐ O teste de contrato ao vivo achou um SEGUNDO, que ninguém tinha reportado:** `/api/perfis/[id]/transacoes` devolve **`items`** e a home lia **`transactions`** → a lista de movimentações da home estava vazia pelo mesmo motivo, em silêncio.
- **PROVADO EM PROD** (handler real, sessão assinada do dono): `dashboard-summary` **200 · cards: 1 · "banrisul ****9113 · 62,2% · fatura em aberto 18.348,72" · summary.totalDue 18.348,72**; `transacoes` **200 · items: 50**.
- **GUARD (`__tests__/perfis/contrato-home-pf.test.ts`):** casa as chaves que a home LÊ com as que a rota DEVOLVE, mantém o `items ?? transactions` como fallback, e trava que nenhum `fetch` da home vá pra `/empresas/`.
- **LIÇÃO (família do "duas fontes", mas um degrau mais traiçoeira):** contrato quebrado entre rota e tela **não aparece em nenhum log** — o servidor responde 200 e a tela renderiza o vazio. Fetch novo em tela ganha teste de contrato, senão a próxima chave renomeada esvazia um widget sem ninguém saber.
- ⚠️ Débito menor achado no caminho: `/api/perfis/[id]/transacoes` **ignora `?limit=`** (respondeu 50 com `limit=5`; o parâmetro é `pageSize`). Não morde a home (que lê tudo e corta), mas é contrato torto.


**⭐ 4 BUGS DA FATURA PF, PROVADOS PELO DONO COMPARANDO A TELA COM O PDF (26/08):**
1. **FALTAVAM R$ 0,62** — a tela dizia 18.348,10 e o boleto cobra 18.348,72. Os **encargos sobre rotativo** são declarados no RESUMO e **não viram linha de transação**, então a Σ ficava curta. ⚠️ **A correção é criar a LINHA do encargo, não somar "por fora"**: assim o invariante KP1 (`totalAmount == Σ das linhas`) continua valendo e o dono VÊ a cobrança na lista em vez de um total que não fecha com o que ele soma na mão. ⚠️ **Armadilha:** existe uma linha de **0,62 que é IOF** de uma compra pequena (uma das 60 que somam 271,63) — coincidência de valor; o teste checa por DESCRIÇÃO, não por valor. **Fatura já gravada corrigida em prod** (`pg_dump pre-fatura-pf-4bugs-20260826-200500`): 182 linhas, total **18.348,72 = boleto ao centavo**.
2. **"fecha em −29 dias"** — dia negativo é o sistema pedindo pro dono fazer a conta de cabeça. `lib/credit-card/estado-fatura.ts` fala *"fechou 29/07 · venceu 10/08 (há 16 dias)"*, com **hoje/amanhã** em vez de "em 0 dias"/"em 1 dias".
3. **STATUS INEXISTENTE** — R$ 18 mil vencidos sem uma cor na tela. Estados **ABERTA → FECHADA/a pagar → VENCIDA (vermelho) → PAGA**, na paleta da Contas a Pagar. ⚠️ **DERIVADO da data + do pago, NÃO do campo gravado:** `CreditCardInvoice.status` existe mas **ninguém o transiciona com o tempo** — fatura importada nasce OPEN e continua OPEN depois de vencer, porque não há job que acorde e mude. Derivar nunca fica velho. ⚠️ **Paga com atraso é PAGA**, não vencida: vermelho é pra cobrar ação, e não há ação pendente quando o dinheiro já saiu.
4. **PREVIEW DA PRÓXIMA FATURA = R$ 0,00** — enquanto o PDF declara *"Despesas parceladas - Próximas Faturas: Agosto 10.747,10 · Setembro 5.012,90 · Demais 13.229,62 · Total 28.989,62"*. O parser passa a extrair a seção (`readProximasFaturas`, todo PDF do Banrisul traz) e a tela usa o **DECLARADO**. ⚠️⚠️ **A PROJEÇÃO CALCULADA NÃO PODE SER A FONTE — medido:** projetar "restam N parcelas × valor" dá **R$ 71.733,16** contra **28.989,62** declarados, porque uma compra grande aparece com **4 parcelas cobradas na MESMA fatura (01/05..04/05)** e um **estorno de −20.954,54** (parcelamento antecipado/cancelado); projetar dali inventaria ~47 mil que nunca serão cobrados. A projeção fica só como CONFERÊNCIA. Mesma regra do resto do sistema: quando o arquivo TRAZ o dado, usa o dado. Guardado em `credit_card_invoices.declaredUpcoming` (migration **aditiva pura**, 1 coluna nullable; rollback = `DROP COLUMN`). Fatura sem PDF mostra **"a apurar"**, nunca 0,00.

**EXTERIOR CONFERIDO (pedido do dono):** **59 linhas internacionais** gravadas com o R$ convertido e **IOF 271,63 ao centavo**. ⚠️ O balde exterior soma **7.124,23** contra **7.769,30** declarado — **645,07 de diferença de CLASSIFICAÇÃO** (linhas que o PDF conta como exterior e o parser vê como doméstica, por virem só com o R$ na linha, sem a coluna US$). **NENHUM dinheiro se perde: o TOTAL fecha em 39.302,64.** É fronteira de balde, não buraco — registrado como débito menor.

**⚠️ ARMADILHA DA FIXTURE ANONIMIZADA (mordeu 2×):** o anonimizador troca sequências de letras por texto genérico do mesmo comprimento (pra preservar as COLUNAS, de que o parser depende). Na 1ª versão trocou **"PAGAMENTO"** e o resultado divergiu em 8.736,17; na 2ª trocou os **NOMES DOS MESES** e a seção "Próximas Faturas" sumiu. **Toda palavra que o parser usa pra DECIDIR tem que sobreviver à anonimização** — a lista está no gerador da fixture.


**⭐⭐ BUG DE CONCEITO NO LIMITE DO CARTÃO PF (26/08) — o dono pegou comparando com o app do banco.** A tela dizia **R$ 18.348,72** de usado enquanto o banco tinha **~40 mil comprometidos**. E o pior nem estava na tela: **ao casar o pagamento, o usado ZERARIA** — o sistema afirmaria limite inteiro livre com R$ 28.989,62 de parcelado pendurado. A própria fatura avisa: *"o valor total do parcelamento COMPROMETERÁ o limite de crédito do seu cartão e será recomposto à medida que as parcelas forem pagas."*
**A CAUSA:** `calculateCardSummary` somava só as faturas não pagas. O termo `futureParcelasNotInvoiced` existia mas **chegava SEMPRE VAZIO** — o comentário no código dizia *"pra MVP fica vazio"*, e ficou.
**O CONCEITO CERTO:** `usado = faturas não pagas + PARCELADO A VENCER + compras do ciclo atual`. ⚠️ **O terceiro termo é DESCONHECIDO** até a próxima fatura chegar (compras feitas depois do fechamento só aparecem no PDF seguinte), então o resultado é um **PISO** e a tela DIZ isso: **"Usado (pelo menos)"** / **"Disponível (no máximo)"**, com a quebra por origem e *"compras do ciclo atual: a apurar"*. Afirmar limite livre que pode não existir é pior que dizer "a apurar" — mesma regra do "sem contagem" do estoque. ⚠️ **Somar os dois primeiros NÃO dobra:** o "a vencer" declarado pelo banco exclui o que já está na fatura corrente — são conjuntos disjuntos. **EM PROD:** usado **47.338,34** (18.348,72 + 28.989,62) = o piso exato que o dono calculou · disponível 28.811,66 · **62,2%** (antes marcava ~24%). 8 testes com os números reais, incluindo *"pagar a fatura NÃO zera"*.
**⭐ ITEM 5 — A PJ JÁ ESTAVA CERTA, e por um caminho melhor:** usa o **limite DISPONÍVEL declarado no PDF** (`lastInvoiceAvailableLimit`), que o banco já calcula com as parcelas futuras descontadas. A fatura **PF não declara o disponível** (só o total 76.150 e o de saque), então lá a soma é mesmo o caminho. ⚠️ Ressalva: o **fallback** da PJ (cartão sem PDF importado) usa só a fatura atual — mesmo conceito antigo, mas só nesse caminho; registrado.
**⚠️ ARMADILHA DO REIMPORT (mordeu na hora):** reimportar o mesmo PDF pra gravar os declarados **DUPLICOU o encargo** (182 → 183, total 18.349,34). A linha de 0,62 que eu tinha criado à mão na correção nasceu **sem `dedupHash`**, e o import procurava **só por hash** — confiava que todo mundo tinha passado por ele. **Não passou.** Agora casa por **hash OU (fatura + descrição + valor)**. Prod limpo: 182 linhas, 18.348,72. **Lição: dedup que só olha a chave que ELE mesmo escreve é cego pra dado que entrou por outra porta** — é a mesma família do "N caminhos, 1 esquecido".

## Empréstimos — decisões de arquitetura (14/08/2026)
- **⭐⭐ PARCELA PAGA EM MORDIDAS — caso real C41033828 #21 (26/08).** Conta sem saldo: o Sicredi debitou a parcela de **R$ 10.234,35 em 3 pedaços no mesmo dia** — 4.923,71 + 3.224,94 + 2.085,70, exato. O encadeado é visível no extrato: a Tuna depositou 3.224,94 e o banco pegou **exatamente** 3.224,94 na sequência. **O vínculo NÃO aconteceu sozinho** (as 3 ficaram PENDING, sem categoria, e a #21 OPEN com paidTotal=0); vinculadas pelo endpoint REAL `/vincular-parcela/confirm` com sessão do dono (`linked:3, status:PAID, splitInjected:true`), NUNCA por script replicando a lógica. **PROVA ao centavo:** saldo do contrato 40.937,40 → **31.370,79**, queda de **9.566,61 = a amortização da #21**; `paidInterest` 667,74 = 10.234,35 − 9.566,61. **3 BURACOS ACHADOS NO CAMINHO:** **(1) a TELA mostrava "pago" SECO** — lia só a porta 1:1 (`reconciledTransaction`) e as mordidas são N:1; agora a parcela abre com data/valor/conta/link de CADA mordida + a soma conferindo (só aparece com 2+, parcela normal segue limpa). **(2) o IMPORT não sabia sugerir** — `detectLoanPayment` ACERTA as duas descrições (`AMORTIZACAO CONTRATO-C…` e `LIQUIDACAO DE PARCELA-C…`, normalizando o sufixo `-8`), mas só é chamado pela fila `/pendentes`; o import é OUTRO caminho e lá o `PAGAMENTO_EMPRESTIMO` exige contrato+parcela explícitos → "escolha você". **Pior: esse caminho grava só pela porta 1:1, que é `@unique` — 3 mordidas na mesma parcela são IMPOSSÍVEIS por ali** (a 2ª estouraria "parcela já conciliada"). Criado `lib/loans/sugerir-vinculo.ts` (reusa o detector — REGRA 4 — e acrescenta a 2ª pergunta que faltava: QUAL PARCELA; empate de distância → a mais ANTIGA, que é a que o banco cobra primeiro), wired na detecção: a próxima mordida chega com contrato E parcela prontos, marcada "parcial: X de Y; faltam Z". 12 testes com as 3 reais. **(3) BOMBA-RELÓGIO: a rota de detecção tinha janela FIXA `01/07–31/08/2026`** — em 01/09 a detecção pararia de funcionar **em silêncio**, sem erro nem aviso. Virou janela ROLANTE (3 meses).
- **⚠️ REGRESSÃO MINHA — 111 ALARMES FALSOS NO JUIZ DE VENDAS (26/08), causados pela extensão pra 01/08.** O juiz buscava as `VendaDiaria` gravadas com `dataCompetencia >= inicio` (**pertencimento**), e o BLOCO de fim de semana tem competência na SEXTA. Com a janela em 01/08, o bloco 31/07–02/08 (R$ 43.106,03) ficou **invisível pro juiz** embora gravado certo → **V1 (2×) "gravado 0.00 vs esperado 35113.82/7992.21"** + **V2 (109×) "venda-tx tem competência >= corte mas NÃO está em nenhuma VendaDiaria"** — as 109 tx eram todas de 03/08 e somavam **EXATAMENTE 43.106,03**, o bloco inteiro. **CAUSA:** eu corrigi a decisão "pertencimento → SOBREPOSIÇÃO" na TELA (`lib/vendas/janela-mes.ts`) e **não no JUIZ** — a mesma decisão em dois lugares, um só arrumado (REGRA 4, de novo). **LIÇÃO DURA: alarme FALSO é pior que alarme nenhum** — o e-mail noturno vira ruído e o dono para de ler (é a mesma razão de o N1 não empilhar sobre o N3 no juiz de infra). Fix: `dataCompetenciaFim: { gte: inicio }`. Teste `juiz-bloco-atravessa-corte.test.ts` roda o pipeline real e **reproduz as 2 mensagens exatas de prod** com o filtro antigo. **Provado em prod: venda 111 → 0.**
- **DÉBITO — LIBERAÇÃO NÃO LINKADA, o que é e o que dá pra fazer (26/08).** Os **9 contratos** têm `disbursementTransactionId` null. Para **8 é IRRESOLVÍVEL hoje**: as liberações são de 2021/2023/2024 (a do C41033828 é 26/11/2024) e o extrato mais antigo no sistema começa em **25/05/2026** — precisaria de extratos daquela época. **Não é erro de número** (o saldo devedor está certo), é vínculo de auditoria; fica como pendência do dono, opcional. **EXCEÇÃO RESOLVÍVEL: o C61021346-2**, liberado 10/06/2026, DENTRO da cobertura — a tx existe (`12/06/2026 · R$ 100.000 · sicredi · "LIBERACAO CREDITO-C61021346"`), hoje categorizada como **"Aporte de Capital"**, que não é (liberação = entrada de caixa com contrapartida em PASSIVO, nunca capital). **NÃO mexido — categoria é decisão do dono**; aguardando o ok pra linkar a liberação e ajustar a categoria juntos.
- **⚠️ K3 ABERTO (achado legítimo do juiz, 26/08): pagamento ÓRFÃO de R$ 7.280,39 (24/08) bate com a fatura OPEN do banco caixa 2026-08 (net 7.280,39) — CASAR na tela.** Veio no import novo do Sicredi. Não é ruído: é o K3 fazendo o trabalho dele. Um clique do dono em casar-pagamento.



**CAUSA RAIZ de todo bug do módulo: DUAS fontes de verdade sem dono declarado.** Agenda oficial do banco (PDF) = verdade do **PLANEJADO** (quais parcelas existem, cronograma, amortização, saldo declarado). Extrato (tx real) = verdade do **QUE ACONTECEU** (valor pago, juros real, quando). Nenhuma sobrepõe a outra — respondem perguntas DIFERENTES. Juros POS, agenda truncada e órfã são todos colisão silenciosa nessa fronteira (o código escolhia uma sem regra). Decisões:
- **Juros POS vem do EXTRATO, nunca de fórmula.** `juros real = tx − amort`. Índice CDI/SELIC NÃO entra. Parcela POS OPEN não tem juros gravado — tem **previsão**. (Preencher juros por fórmula na agenda POS = ressuscitar a invenção que foi morta — proibido.)
- **Previsão da OPEN = valor da última parcela CASADA COM PARCELA.** Trava DURA: só tx casada-com-parcela vira base (avulso/tarifa/parcial/fatia de sweep NUNCA — o 1.142,53 do C41022570 dá juros derivado −3.024). Sem casada → "a apurar", não inventa. Marcar `~previsto` (cor/rótulo ≠ fato — REGRA 6): "previsto com base na #N paga em DD/MM".
- **Órfã é melhor que casada errado.** Não sei o que é → deixa órfã.
- **Saldo devedor: invariante corrigido (REGRA 7)** — `saldoDeclarado(último PDF) + Σamort casadas depois`, NÃO `principal−Σamort` (quebra em carência capitalizada/POS onde a dívida sobe). `saldoDevedorAtual` (`lib/loans/saldo.ts`) já usa closingBalance da última paga; soma dos 9 = **825.313,37** (provado contra 5 PDFs de 3 bancos, NÃO tocar).
- **"Vence este mês" é INCALCULÁVEL com agenda truncada** (1827478 31/37, #32 vence 24/08 e não existe no banco). Completar a agenda é PRÉ-REQUISITO do card, não paralelo. Invariante `agenda.length == termMonths` **EXCETO FLEXIBLE** (Arafat, sem prazo).
- **Badge tem que mostrar `rateType` (PRE/POS), não só `amortizationSystem` (PRICE/SAC).** 5 de 8 são POS; esconder isso fez o próprio dono caçar "contrato fixo que varia".
- **Conta garantida do Sicredi = sweep fragmentado** (C41022570 #12 = 5.951,33 em ~20 "AMORTIZACAO CONTRATO" + LIQUIDACAO; C61021766 = 7.294,40 cobrindo C41022227 #22). O dinheiro ESTÁ na conta importada, picado — casar é N:1 (`LoanInstallmentPayment`), não 1:1. **Nunca chamar de "pago por fora" sem busca ampla por valor+data (qualquer descrição/conta)** — o pagamento de empréstimo aparece como LIQUIDACAO/DEBITO PRESTA/PREV-EMP.BBH/sweep, não sob um padrão único.
- **⚠️ CORREÇÃO 14/08 — O JUROS DE EMPRÉSTIMO JÁ É CONTADO NO DRE VIA N:1; NÃO HAVIA "REPRESAR". A premissa anterior estava ERRADA.** Descoberto ao ligar o flag `dreHeld`: as **"8 órfãs" que eu ia casar NUNCA foram órfãs** — estavam linkadas via `LoanInstallmentPayment` (N:1) desde antes (import/deslocamento 07/08), com `payment.transactionId` apontando pra tx real. Eu detectei "órfã" checando **SÓ `reconciledTransactionId`** e perdi o 2º mecanismo → **falha REGRA 4: "linked" tem DUAS portas (`reconciledTransactionId` 1:1 E `LoanInstallmentPayment` N:1); checar UMA e declarar órfão foi o bug.** O juros delas JÁ estava no DRE (path N:1 lê `paidInterest`, populado pelo import). **Casar (setar `reconciledTransactionId`) DUPLICA** (path 1:1 + N:1 contam a mesma parcela); o `dreHeld=true` então removeu o que já estava → DRE mai/jun/jul CAIU. **REVERTIDO** (`reconciledTransactionId=null` + `dreHeld=false` nos 8): mai/jun/jul de volta ao correto (1.139,81 / 8.221,45 / 6.459,66), 0 double-count. **A ÚNICA lacuna real era a #2 do C61021346** (POS, agenda juros 0 → `paidInterest`=0 → juros de agosto faltava); agora capturado (agosto 1.570,91, mês aberto, UMA vez via N:1). **Flag `dreHeld` deployado (migration `20260814210000` + `lib/loans/dre-interest.ts` = dono único dos 2 caminhos) mas NÃO USADO — no-op, tudo false; represar não é necessário.** **LIÇÕES:** (a) juros de empréstimo flui por `paidInterest` (N:1), não por `reconciledTransactionId` — antes de chamar algo de "órfão/faltando", checar OS DOIS vínculos E se já não está contado; (b) **DOUBLE-COUNT latente**: parcela com `reconciledTransactionId` E `payments` conta 2× (path 1:1 + N:1 sem dedup) — hoje 0 nesse estado, mas casar-1:1 de parcela que já tem ponte N:1 dispara; (c) **shadow tem que cobrir TODOS os meses tocados, não só os fechados** — o double-count de agosto passou porque o shadow só olhou mai/jun/jul; (d) **conferência de DRE contra PDF soma TODOS os contratos que pagaram no mês, não só alguns** — o "gap de 7.600" que parecia juros fantasma era conferência incompleta (junho tinha parcela de 7 contratos, não 2); o DRE estava certo, e a parte que o PDF "não mostra" é a correção monetária que ele agrega em "encargos totais". **1º uso real do flag `dreHeld` (15/08):** o sweep C41022570 #12 corrigido de 1.731,10 (estimativa) pra 1.784,67 (real = 5.951,33 − 4.166,66) com `dreHeld=true` — julho é fechado, então a correção fica represada até o contador liberar (flip).
- **DÉBITO — "Liberação não linkada" nos 8 contratos** (15/08). Todos os 8 mostram o badge "Liberação não linkada" (`disbursementTransactionId` null) — a entrada do dinheiro (liberação do empréstimo) nunca foi casada com a tx de crédito no extrato. **Plano:** ao reimportar os extratos antigos de cada conta, achar a tx de crédito da liberação (valor = principal, na abertura do contrato) e linkar em `Loan.disbursementTransactionId` (o DRE já trata liberação como entrada de caixa com contrapartida em PASSIVO, não receita — `loanDisbursement` filtro). Não é bug de número (o saldo devedor está certo), é vínculo de auditoria faltando. Não deixar virar paisagem.
- **Empréstimos Fase 2 (15/08) — FEITO e validado no browser:** card por contrato (previsão POS `~` pela última CASADA + badge `pós-fixado` + taxa `+ SELIC/CDI` + data TZ-UTC), 2 cards do topo ("Vence este mês" previsto em 4 baldes incl. **"vencida aguardando débito/import"** pro caso venc-passou-mas-tx-não-entrou; "Próxima de cada contrato" com previsão). Status "Atrasada" só DEPOIS do dia do venc (comparação por DIA, não instante); venc-hoje = "Vence hoje". Helpers dono-único `lib/loans/forecast.ts` + `vence-mes.ts` (testados). **FALTA:** lista real-vs-planejado com destaque de divergência + "real debitado por mês" (sem chamar de média).
- **FORA do fechamento (débito próprio):** parsers Banrisul(4 colunas)/Caixa(coluna enganosa) — import-time, não runtime; DRE por competência de VENCIMENTO (vs débito) — mudança de regime contábil, decisão do contador.

## Definição de Pronto (DoD) — regra crítica

Sprint não é "entregue" sem TODOS: (1) unit/integration tests passando, (2) build sem erros, (3) TS strict 0, (4) teste E2E real no browser com fixture real + contagem numérica, (5) smoke test em prod pós-deploy (PM2 online, curl 200, fluxo crítico), (6) relatório com evidência numérica + PNGs + logs limpos, (7) `pg_dump` antes de deploy com mudança de schema/lógica financeira. Cenários E2E obrigatórios cobrem: upload (válido + limit + tipo errado + re-upload + retry), form multi-step (golden + voltar/avançar + validation), CRUD (criar/editar/deletar/filtros/paginação), conciliação (match 1-1 + split + ignore).

## Migrations em tabelas com dados reais

Toda migration além de "100% aditiva pura" (CREATE TABLE, ADD COLUMN nullable ou com default em tabela SEM dados) exige seção **"⚠️ ALTERs em tabelas com DADOS REAIS"** no plano com tabela: tabela | operação | tipo | linhas afetadas | risco | mitigação. Confirmação pós-migration com evidência objetiva: COUNT antes/depois, `is_nullable`, distribuição, FKs/índices intactos, query típica retornando dados certos. Risco Alto: DROP COLUMN, RENAME, backfill não-idempotente, migração entre tabelas.

## Padrão de Relatórios CAIXAOS (Sprint 5.0.4.0a)

Todos os relatórios financeiros em `/empresas/:id/relatorios/<nome>`. `/relatorios` global redirect per-empresa via cookie. Estrutura: Breadcrumb "← Voltar pra Relatórios" · Header título+subtítulo · Filtros (período/comparações/tipo) · 3-4 stats cards · Conteúdo (tabela/gráfico) · Drill-down clicando linhas. Cores semânticas: receitas `emerald-600` · despesas `red-600` · positivos `emerald` bold · negativos `red` bold · estável `slate` · crescimento `↑↑ red >+50%` / `↑ amber +15-50%` / `━ slate ±15%` / `↓ sky -15-50%` / `↓↓ sky escuro <-50%` · novidade `🆕 purple` · sumiu `✕ slate-400`. DRE existente (`lib/dre/*`) é REUSADO — mesma fonte da verdade.

## ⭐ DENSIDADE / MOLDE DE LAYOUT (23/08/2026, EM PROD — toda tela nova segue)

Comparação do dono com o Vuca: "eles usam cada canto; as nossas têm coluna estreita central com margens gigantes, linhas altas, cards enormes — cara de protótipo". **Diagnóstico: a gaiola era DUPLA.** O shell (`components/layout/dashboard-shell.tsx`) prendia tudo em `max-w-6xl` (1152px) **e** 49 das 137 páginas de `(dashboard)` ainda punham um `max-w` próprio dentro dele (no estoque, 18 de 19) + um `p-4 sm:p-6` que duplicava o padding do shell. Efeito real no notebook (~1272px úteis): `max-w-4xl` = 896px = **70% de aproveitamento**; `max-w-3xl` = 60%.

- **O MOLDE (uma linha, cobre as 137 páginas):** shell = `mx-auto max-w-[1600px] px-4 py-6 lg:px-6 lg:py-8`. **Teto ALTO, não ausência de teto** — no notebook é largura total de fato, e o teto só morde em ultrawide (tabela esticada a 2500px vira linha ilegível). Landing, `(auth)` e `/admin` não passam pelo shell.
- **REGRA: TELA DE DADOS = largura total (sem `max-w` próprio). FORMULÁRIO/DOCUMENTO mantém o seu.** Preservados de propósito: certificado, ficha nova/editar, cadastros de produção, recibo (é documento) e **a etiqueta Zebra 60×60 (`max-w-lg` = largura FÍSICA, intocável)**.
- **⭐ LINHA DE 48px REUSANDO O `density-normal` QUE JÁ EXISTIA** (`globals.css`, Sprint 5.0.3.0c: compact 36 / normal 48 / comfortable 60). **Um sistema de densidade no projeto, não dois** (REGRA 4). Receita da tabela: `<table className="density-normal w-full">` · `th` = `px-3 py-2` + `text-[11px] uppercase tracking-wide` · `td` = `px-3 py-0 text-[13px]` (**`py-0` de propósito: quem manda na altura é a classe**). O `text-[13px]` tem que ir no **`td`** — `.density-normal tbody tr{font-size:14px}` é mais específico que qualquer classe Tailwind no `tr`, então só o valor aplicado direto na célula vence.
- **⚠️ NÃO EDITAR o `.density-*` do globals.css — só CONSUMIR.** `lib/contas-pagar/virtualization.ts` (`ROW_HEIGHT_BY_DENSITY` 36/48/60) **duplica esses números** pra virtualizar >100 linhas, com testes travando, e a densidade é **persistida por usuário** na coluna `density` das saved_views. Mudar o CSS quebra o cálculo da virtualização da Contas a Pagar — não é "só visual". Guards: `virtualization.test.ts` + `use-table-preferences.test.ts`.
- **Padrão de topo de tela:** cabeçalho de UMA linha (ícone `h-5 w-5` · `h1 text-base` · subtítulo `text-xs text-slate-400` que some abaixo de `lg` · botões `h-8 px-2.5 text-xs`) · filtros numa linha `h-9` com busca limitada a `max-w-[320px]` · agregados por categoria como **faixa horizontal fina que rola no eixo x** (`h-9`, rótulo+valor na mesma linha), **nunca tijolo de 3 linhas** — tijolo quebra em 2ª fileira e come a altura da lista · coluna de faixa/barra numa linha só (barra + `mín–máx` ao lado) · texto curto em coluna de idade (`hoje` · `2d` · `23d`). Resultado na Posição: ~7 → ~12-13 linhas visíveis no notebook.
- **MOBILE INTOCADO** — os blocos `sm:hidden` de cards empilhados não entram no passe.
- **Aplicado (em prod):** molde + 11 telas do estoque (Posição=referência, Catálogo, Movimentos, Recebimentos, Vendas, Perdas, Produção, Cardápio, Fichas, Ficha do produto, Ordem) + 7 financeiras que estavam estreitas de fato, **só largura, zero lógica/golden** (vendas, juiz, auditoria, import-warnings, monitor-alerts, transferencias/ignoradas, dashboard). **Contas a Pagar/Receber, Conciliação e Empréstimos NÃO têm `max-w` próprio** — herdaram o molde (1152→1600) sem nenhum arquivo delas ser tocado; se o dono quiser congelar alguma no tamanho antigo, é `max-w-6xl` no container dela.

## Convenções de código

TypeScript strict em tudo · commits semânticos (feat/fix/refactor/docs/test/chore) · Zod em toda rota API · textos UI pt-BR · logs de erro em pt-BR · comentários em pt-BR quando explicam regra de negócio · shadcn/ui · path alias `@/*`. Design system atual: cards limpos, `tabular-nums`, Framer Motion `stagger 30ms` `easeOutExpo`, gradient hero `#185FA5→#0F4A8C`, semântica de cor (emerald/rose/amber/slate), radius consistente.

## Pendências / débitos técnicos

- **⏳ PAINEL DE PRODUÇÃO — falta "período…" com calendário + paginação nas concluídas (01/09/2026).** São a MESMA feature (decisão do dono): período grande sem paginação vira lista infinita, e paginação sem calendário não tem o que paginar. A tela hoje tem `hoje / semana / mês`; **o histórico completo não tem caminho**. Entram juntos na próxima volta desta tela.

- **⚠️ INTERFACE ESCRITA À MÃO SOBRE PAYLOAD DE API É PROMESSA, NÃO PROVA (01/09/2026).** As páginas declaram a forma da resposta em `interface` própria, **sem vínculo de tipo com o `select` do Prisma** — então o TypeScript valida a página contra o que o autor **acha** que a rota devolve. Foi assim que `bankAccount: { id; name; bankName }` (sem `| null`) deixou passar o `.name` que derrubou a carteira, com `tsc` verde. **É a mesma família do contrato quebrado da home PF** (a rota devolvia `items` e a tela lia `transactions` — 200, silêncio, widget vazio). **ONDE DER, DERIVAR O TIPO DO SELECT REAL** (`Prisma.LoanGetPayload<typeof select>`) em vez de reescrever à mão; onde não der, **teste de contrato** casando as chaves que a tela LÊ com as que a rota DEVOLVE (já existe um: `__tests__/perfis/contrato-home-pf.test.ts`). Não construído — dívida registrada.

- **⚠️ GATILHO DO MOTOR DE VENDAS NÃO DISPAROU numa criação manual (26/08) — porta não identificada.** O juiz pegou (`V1` + `V2`, R$ 2.041,00 de venda em dinheiro do cofre de 25/08) e o self-heal (`recomputeVendas`) resolveu — a defesa em camadas funcionou. **O QUE SE SABE:** a tx foi criada às 20:06, DEPOIS do restart do deploy (o log do gatilho tem a última linha imediatamente antes de `> conta-ia@0.1.0 start:prod`), e **NÃO há nenhuma linha `[vendas-hook]` após o restart** — o gatilho não rodou. A tx tem a impressão digital do FORMULÁRIO (`origin: MANUAL`, `lifecycle: EFFECTED`, sem `dedupHash`/`externalId`/`recurringScheduleId`/`classificationSource`), e `POST /api/transacoes` **TEM** o gatilho na linha 341. Também não é recorrente nem import. **Não consegui cravar a porta nesta passada.** **VARREDURA REGRA 4 (registrada pra continuar):** criam transação SEM o gatilho — `app/api/contas-a-pagar/[id]/duplicar`, `cartoes/[cardId]/importar-fatura/confirm`, `contas-pagar/import/[batchId]/{confirm,resolve-row}`, `pluggy/sincronizar`, `contas-bancarias/[id]/ajustar-saldo`, `importar-pdf-extrato/confirm`; e nas libs — `reconciliation/import-orchestrator`, `recurrence/generator`, `transfers/{create,from-ofx,pair-pendentes}`, `bridges/create`. ⚠️ Várias dessas são chamadas por rotas que TÊM o gatilho (o import é o caso), então a lista é ponto de partida, não veredito. **Hipóteses a testar:** (a) o hook é fail-soft e engoliu erro sem logar; (b) `recomputeVendasSeVenda` decidiu que a categoria não era de venda e virou no-op silencioso; (c) existe uma Server Action criando transação (o log tem vários `Failed to find Server Action` do mesmo período). **A instrumentação que fecharia isso: logar SEMPRE que o hook é chamado — inclusive o no-op — com o motivo.** Hoje ele só loga quando recomputa, e "não logou" é ambíguo entre "não foi chamado" e "foi chamado e não fez nada".

- **CÓDIGO MORTO — `buildConsolidatedCashflowWhere` (`lib/cashflow/query.ts`) tem ZERO callers** (achado 25/08 ao construir o fluxo de caixa; só aparece citado num comentário de `consolidated.ts`). Sobrou de algum refactor. Remover numa limpeza — antes, re-confirmar 0 caller por grep. `calculateConsolidatedCashflow` e `bucketFor` (mesma pasta) CONTINUAM VIVOS (o relatório usa).

- **✅ OS 3 VERMELHOS DE GREP MORRERAM (01/09) — e NENHUM era regressão.** Eram grep de string no fonte (violação da REGRA 3), vermelhos desde 23/08. A perícia: **(1)** `sprint-emprestimos-ui` procurava `/Parcela mensal total/` na página — o card estava lá e certo; o teste não sabia dizer se era o RÓTULO ou a SOMA. **(2)+(3)** `pagamento-parcela-redesign` procurava `const jurosTotal = interest + correcao` e `if (jurosTotal <= 0) continue` **na rota do DRE** — a lógica tinha sido extraída pra `lib/loans/dre-interest.ts` em 14/08 e **o grep perdeu o alvo num refactor**. É o buraco exato que a REGRA 3 existe pra fechar: *grep não distingue "refatorei" de "quebrei"*, e por isso os três passaram dias fingindo ser vermelho de dinheiro. **SUBSTITUÍDOS POR EXECUÇÃO:** `__tests__/pagamento-parcela-redesign/dre-juros-pipeline.test.ts` monta as transações pelo caminho real, roda o `calculateDRE` e confere **445,67** (juros 311,26 + correção 134,41), com o contrafactual do **juros derivado NEGATIVO −3.024** do C41022570 — sem o guard `<= 0` ele viraria despesa negativa e **abateria a despesa financeira das outras parcelas do mês**, inflando o lucro; e `lib/loans/__tests__/parcela-mensal-total.test.ts` confere **R$ 26.471,06** da carteira real com o mútuo FLEXIBLE de fora (somá-lo prometeria 67.899,63/mês). ⚠️ **Pro 3º o número precisou de casa própria:** a soma vivia solta no laço do handler (`totalParcelaMensalRec += …`) e **não tinha como ser conferida sem banco e sessão** — foi por isso que acabou guardada por um grep. Virou `lib/loans/parcela-mensal-total.ts` (dono único); a rota só coleta a linha. **Red-then-green medido nos dois:** repondo os defeitos, 2 vermelhos no DRE. `npx vitest run` agora fecha **sem vermelho documentado** — qualquer vermelho é novo.
- **⭐ VENDAS FASE 1 — COMPLETA e deployada (17/08). Arquitetura consolidada na seção "Vendas — decisões de arquitetura".** Motor (`lib/vendas/`: PerfilRecebimento · computeCompetencia · VendaDiaria + recompute idempotente · V1-V4 no juiz · gatilho fail-soft) + **tela `/vendas`** (blocos 1 número grande com toggle dia/semana/mês, 2 calendário mapa de calor com fim de semana em card único + pré-12/08 distinto, 3 perfil da semana "a apurar", 4 composição por meio, 6 comparações "a apurar"; bloco 5 previsão fora até ≥4 semanas) + link na sidebar. GOLDEN travado (12/08=11.919,65 · 13/08=10.468,80 · fim de semana=62.090,93). 47 testes verdes. **TESTE DE ACEITE PENDENTE (do dono):** importar o extrato de 18/08 e ver o 17/08 virar número sozinho pelo gatilho (a prova de que a tela é viva). **Fase 2/3 desenhadas, não iniciadas** (ver a seção de arquitetura).
- **PRINCÍPIO — quando o arquivo não traz um dado, o sistema NÃO INVENTA (13/08)**. Marca como ausente e avisa. Inventar "hoje" pra uma data que falta é mentir com cara de fato. Foi por relógio que o bug de descarte voltou 3×: `future-line` (`> hoje`, corrigido 09/08), `is-preview` (`min(DTASOF,hoje)`, achado 12/08) e `parser.ts:70` (`DTASOF ausente → new Date()`, achado na rearquitetura 13/08). **Regra:** o RELÓGIO só serve pra exibir "hoje" na TELA — nunca entra em decisão (classificar tx, âncora, futuro). A fonte é o ARQUIVO: data da linha, período, LEDGERBAL. No canônico (`lib/canonical/`), DTASOF ausente = `ledger.asOf: null` + aviso.
- **Empréstimos POS — previsão pela última parcela CASADA + casar órfãs + lista real-vs-planejado (EM CURSO 14/08)**. Diagnóstico read-only fechado: **5 de 8 contratos são POS** (badge só mostra `amortizationSystem` PRICE/SAC e ESCONDE o `rateType` POS → o usuário lê "valor fixo" num contrato que varia). Parcela POS OPEN nasce com **juros 0** na agenda (`apply-imported-schedule` importa amort-only) → valor planejado mente pra baixo (~127 parcelas OPEN juros 0). O débito real (com juros pós-fixado) fica **órfão** (tx "LIQUIDACAO DE PARCELA" sem vínculo) → juros some do DRE. **Método (decidido 14/08):** previsão da OPEN = valor da **última parcela CASADA COM PARCELA** — trava DURA: só tx casada-com-parcela vira base (pagamento avulso/tarifa/parcial NUNCA; o 1.142,53 de 20/07 do C41022570, juros derivado NEGATIVO −3.024, fica órfão). Sem casada → "a apurar", nunca inventa. **NÃO precisa do índice CDI/SELIC** — juros real = tx − amort (sai de graça ao casar). **Ordem:** Fase 0 reproduzir 825 ✅ · Fase 1 DADO (completar 2 agendas truncadas ANTES do card + casar **8 órfãs 1:1** [C41033828 #18/#19/#20, C61021346 #1/#2, **1837311 #29/#30 via DEBITO PRESTA banco caixa, 064956967 #21 via PREV-EMP.BBH banrisul** — busca ampla por valor+data achou os 3 extras] + **1 N:1** [C41022570 #12 = sweep 5.951,33 fragmentado, ponte `LoanInstallmentPayment`] + **2 deixar** [C41022227 #22 garantida C61021766 e 1827478 #31 documento, já decididos 05/08 e 07/08]) · Fase 2 DISPLAY (badge/previsão/2 cards/lista) · Fase 3 teste de invariante de módulo (REGRA 7). Card "vence este mês" = `previsto · já debitado · a vencer` (2 cards SEPARADOS: "vence este mês" ≠ "próxima de cada contrato"; NUNCA misturar). ⚠️ **"vence este mês" é FURADO enquanto a agenda estiver truncada** — meu 37.235,95 OMITIU o 1827478 #32 (vence 24/08, não existe no banco); o real é maior (~44.400). Completar agenda é pré-requisito. ⚠️ **1837311 #29/#30:** CLAUDE.md diz vinculadas 07/08 mas o banco mostra `reconciledTransactionId=null` (provável "confirm não gravou") — verificar antes de casar. Impacto DRE do passo 1 = +6.042,01 de juros real que era real mas não contado (mai +1.139,81, jun +985,10, jul +2.346,19, ago +1.570,91); **saldo devedor NÃO muda** (amort já estava). **"Real debitado por mês" existe mas NÃO é média/referência de planejamento** (jul/ago inflados pela operação C61021766); o número de planejar é o "vence este mês". **PENDENTE separado (decisão com o CONTADOR, não no meio do sprint): juros no DRE pela competência do VENCIMENTO, não da data do DÉBITO** — mudança de regime contábil, mexe em meses fechados; **hoje segue por data do débito** (`dre-enrichment.ts` conta `installment.interest` só da parcela CASADA, competência = data da tx). Projeção de fluxo (`fluxo-previsto.ts`/`lib/cashflow/*`/`relatorios/cash-flow.ts`) NÃO soma parcela futura → previsão é display-only, não quebra fluxo/DRE/relatório.
- **Rearquitetura do import — CAMADA 1 LIGADA atrás de flag; JUIZ pronto mas dormente (FASE 2+3+4, 13/08)**. `lib/canonical/`: `to-canonical.ts` = CHOKE-POINT (única porta do OFX cru). 4 tradutores (`translators.ts`) com evidência escrita: Banrisul (FITID renumera → identidade data+valor+descrição+**ocorrência #N**, resolve a colisão 2× CAPITALIZACAO RG mesmo dia; NAME==MEMO), Sicredi (DTASOF fim-do-mês → âncora=última tx real), Stone (FITID UUID), Conservador (Caixa/desconhecido → `conservative:true`+aviso na tela). Isolamento provado (`isolation.test.ts`). **CAMADA 1 LIGADA** no confirm (`import-orchestrator`) E preview (`importar-ofx/route`) atrás de `CANONICAL_CLASSIFY_ENABLED` — o FITID NÃO decide status → a parcela paga (bug 13/08: EMPRESTIMO 4.092,02 FITID 260811) não é mais descartada. Shadow-run: **0 divergência em 24 blobs, 0 regressão**; legado (flag OFF) = rollback. **JUIZ (Camada 2, `judge.ts`) PRONTO mas NÃO wired** — LEDGERBAL bidirecional, DESCONHECIDA nunca em silêncio, ambíguo bloqueia, override LOUD+auditado, 1º import ancora, banco não-confiável (Stone varre) avisa, `searchMayHaveMissed` quando a busca limita. **Falta pro juiz:** `saldoAntes` = **(B)** derivar da 1ª linha nova via sobreposição + **(A)** de rede (sem sobreposição → avisa buraco+ancora; sobreposição divergente → reporta) — só então wire + shadow contíguo. **RELÓGIO nunca em decisão** (3º achado: `parser.ts:70`). **⚠️ FLAG ROLLBACK PRA OFF (13/08) — a heurística FITID tinha uma 2ª CÓPIA que eu não achei:** `reconcileStatement` roda `isPreviewLine` (o MESMO `fitidLooksLikeDate`) nas linhas reais e re-descarta a linha FITID==YYMMDD que a Camada 1 tinha mantido. Efeito no import real do Extrato_20260813: parcela 23 (4.092,02, FITID 260811) → Camada 1 EFETIVADA → reconcile jogou pra `result.previews` → descartada; `newTransactions=effectiveMissing(20)+previews(1)=21` mas 20 inseridas (over-count — ⚠️ o pipeline novo TEM que provar que `newTransactions` == tx REALMENTE inseridas; teste do contador na FASE 5), e o PREVIEW mostrou importável enquanto o CONFIRM descartou (discordância). **DB não corrompeu** (a parcela 23 realmente não liquidou — LEDGERBAL −2.644,08 a exclui, `ledgerBalMatched=true`; não importar era o certo pra ESSE arquivo), mas o MECANISMO estava errado (coincidência de FITID, não LEDGERBAL). **LIÇÃO (de novo): achar TODAS as cópias** — a heurística estava em `partitionFutureLines` E em `reconcile.isPreviewLine`. **CORREÇÃO DE RUMO:** Camada 1 NÃO pode ligar sozinha — classificar linha FITID==YYMMDD (data<=âncora) exige o LEDGERBAL pra saber se liquidou (settled→importa) ou está agendada (scheduled→não). **Camada 1 + remover a 2ª cópia do FITID no reconcile + o JUIZ têm que ir JUNTOS.** Flag fica OFF até isso. **PENDENTE:** juiz (saldoAntes B+A) + remover reconcile.isPreviewLine sob a flag + blob-no-preview; FASE 5 (fixtures reais + este caso do 4.092,02).
- **PRÓXIMA FRENTE (depois do juiz) — motor de transferência ler `counterpartyName`, não só o memo (14/08)**. **MOTIVO:** o enriquecimento por PDF criou um sinal forte que antes NÃO existia — no Banrisul o memo é genérico ("PIX ENVIADO"), mas o `counterpartyName` agora traz o nome PRÓPRIO ("CACULA MIX" / "YUSSEF ABU ZAHRY MUSA"). O motor está CEGO pra isso: `classifyTransferPair` (`lib/transfers/unified-transfer-engine.ts`) só olha `d.description`/`c.description`. Dos 11 enriquecidos do Banrisul, **10 são a própria empresa** — 10 sinais de transferência interna que o motor não vê. **DESENHO:** fazer as 3 checagens considerarem `counterpartyName` ALÉM do `description` — `extractOwnSignals` (CNPJ/CPF próprio), `hasPersonName`, e o match de `refs.ownerNames`. "CACULA MIX"/nome do sócio no counterpartyName → sinal de transferência própria (camada 1 se CNPJ, camada 2 se nome). Atrás do MESMO flag do motor, com **shadow-run provando 0 regressão** (Sicredi/Stone que já trazem no memo não podem mudar). ⚠️ **REGRA 4:** procurar TODAS as cópias antes de dar por feito — se `classifyTransferPair` tem outro lugar fazendo a mesma checagem (os applies `pair`/`confirmar-em-lote`/`apply-active-transfers` são id-based, não re-classificam — provável que não; CONFIRMAR), vai junto. **NÃO agora** (juiz é o gargalo; não misturar duas frentes depois do susto da 2ª cópia do FITID).
- **Enriquecimento de contraparte Banrisul — CHAVE ALTERNATIVA (Nível 2) + tela contar certo (RESOLVIDO 13/08)**. O join casava DOCUMENTO(PDF)==FITID(OFX), mas o FITID do Banrisul **renumera a cada download** (`fitidStability='PER_DOWNLOAD'` no perfil) → 0 preenchidos quando OFX e PDF vêm de downloads diferentes. **Fix:** **Nível 1** = FITID (preferencial); **Nível 2** (fallback) = **(data completa, |valor|)** — casa quando o FITID não bate. **Gated no perfil de banco** (só `PER_DOWNLOAD`): Sicredi/Stone (FITID estável) NUNCA entram; se o Banrisul consertar, muda o campo pra STABLE e o Nível 2 se desliga sozinho (rationale registra isso, `lib/bank-profiles/registry.ts`). **Segurança multi-mês:** o parser resolve a data completa por linha (dia + período, avança o mês quando o dia decresce) → um "dia 05 + R$X" de agosto NÃO casa com um de junho. **Conservador:** 2+ nomes OU 2+ tx pra mesma chave = AMBÍGUO (não adivinha); precedência `MANUAL>OFX>PDF` intacta. **Auditoria:** coluna `Transaction.counterpartyMatchKey` ('FITID'|'DATE_AMOUNT', migration `20260813170000` aditiva) — pra achar/reverter em lote os preenchidos pela alternativa: `SELECT id,date,amount,description,"counterpartyName","counterpartyDocument" FROM transactions WHERE "counterpartyMatchKey"='DATE_AMOUNT' ORDER BY date`. **Tela conta CERTO:** 4 baldes (vão receber nome · ambíguas · fora do período+sugere o mês · não-se-aplica IOF/tarifa) + progresso "N de M" + aviso de período. **Números caçula (FASE 1):** 76 elegíveis sem nome (jun 23·jul 43·ago 10); os "385/408" eram 332 não-elegíveis + 66 de outro período. Precisa de 3 PDFs (jun/jul/ago) OU 1 PDF de range amplo (period-agnostic). Guards REGRA 3: `altkey-join.test.ts` (os 8 casos) + `banrisul-period.test.ts`. **PENDENTE:** o Yussef sobe o PDF de ago e valida na tela (REGRA 2); depois jun/jul pra limpar o histórico. ⚠️ o formato exato da linha "PERÍODO" do PDF real ainda não foi visto — se a extração falhar, a tela avisa ("não consegui ler o período") e o regex se ajusta com o texto real.
- **LIÇÃO — campo livre com "criar nova" onde a resposta é SEMPRE a mesma = duplicata garantida (13/08)**. A categoria de ENTRADA da ponte PJ→PF ("dinheiro da empresa entrando no PF") era um `CategoryCombobox` livre com `createCategoryForPF` → o Yussef criou **3 categorias pra mesma coisa** sem perceber ("Pró-labore / Lucros" 56, "receita de lucro" 6, "escola" 2 — essa última nome de GASTO). Todo cliente faria igual. **A liberdade estava no lugar errado:** a entrada é sempre a mesma; quem varia é o GASTO (Nura, Viagem, Moradia). **Regra geral:** liberdade só onde há variação real; onde a resposta é única, o sistema fixa/resolve (não oferece campo livre). **FIX (Entrada-Fixa-Ponte, RESOLVIDO 13/08):** (a) marcador ESTÁVEL `PersonalCategory.systemSlug='BRIDGE_ENTRY'` (rename-proof, `@@unique([profileId,systemSlug])`, migration `20260813150000`) — o usuário pode RENOMEAR ("Retirada da Caçula") que continua a mesma; (b) resolvido NO SERVIDOR (`getOrCreateBridgeEntryCategory`, roda fora do $transaction c/ retry no P2002) — `createBridge` não aceita mais `pfCategoryId`; (c) combobox de entrada REMOVIDO de TODOS os caminhos (NovaPonteForm, WithdrawalPanel, BridgeSuggestionCard; batch `/lote` e `build-ponte-payload` dropados) — vira linha read-only "🔒 Retirada da empresa · definido pelo sistema"; o combobox do GASTO (EXPENSE) FICA; (d) perfil novo nasce com a canônica semeada (`PF_DEFAULT_CATEGORIES`, substituiu o "Pró-labore / Lucros" mal-nomeado). **Limpeza de dado (prod, com backup):** 64 tx consolidadas em "Retirada da empresa" (id `cmq1crgt600cr50toreol6jwp`, renomeado); receita de lucro/escola/es desativadas (não deletadas). Guard REGRA 3: `__tests__/bridges/entry-category-fixed.test.ts` (perfil novo nasce c/ canônica · toda ponte usa a mesma · renomear não cria outra · idempotente). **Mesma família de "achar TODAS as cópias":** eram >3 call-sites (a disciplina do motor de transferência valeu de novo).
- **Retirada órfã — FONTE ÚNICA `lib/withdrawals/orphan-query.ts` (RESOLVIDO 13/08)**. Antes: banner (`/retiradas-orfas`, `isOrphanWithdrawal`) e sidebar+aba Sócios (`/retiradas-pendentes`, lógica própria: `status=RECONCILED` + pró-labore por nome, sem excluir interna/agrupada) DISCORDAVAM (mesmo problema do motor de transferência). Fix: `orphanWithdrawalWhere`/`countOrphanWithdrawals`/`listOrphanWithdrawals` = a decisão numa lib só; os 2 endpoints são cascas finas. Critério canônico: DEBIT + `lifecycle=EFFECTED` + **não interna** + **não agrupada** (evita contar transferência entre contas próprias como retirada — foi o erro dos 157k pra "CACULA MIX") + `dreGroup ∈ WITHDRAWAL_DRE_GROUPS` (**DISTRIBUICAO_LUCROS só**) + sem bridge. Aba "Retiradas pendentes" do Sócios REMOVIDA (3º caminho duplicado); sidebar segue no `/retiradas-pendentes` (agora canônico). Empty state de `/empresas/[id]/pontes` redesenhado (ensina + mostra órfãs esperando + caminho real). Guard: `lib/withdrawals/__tests__/orphan-query.test.ts`.
- **Pró-labore como retirada — precisa de dreGroup `PRO_LABORE` dedicado (PRIORIDADE MÉDIA)** (13/08). Pró-labore É retirada (sai da empresa, entra no PF do sócio) e DEVE contar como retirada pendente — MAS hoje vive dentro de `DESPESAS_PESSOAL` junto com 30 categorias de FUNCIONÁRIO (Salários, FGTS, Férias…), e o único sinal seria o NOME da categoria "Pró-labore" — frágil (rename quebra; já mordeu). **Fix reliável:** criar dreGroup `PRO_LABORE` (semântico, à prova de rename), migrar a categoria "Pró-labore" pra ele, e SÓ ENTÃO `WITHDRAWAL_DRE_GROUPS = {DISTRIBUICAO_LUCROS, PRO_LABORE}`. Por ora fica **DISTRIBUICAO só** — melhor faltar pró-labore que contar salário de funcionário como retirada do sócio. ⚠️ pró-labore afeta o DRE (distribuição não) — o dreGroup novo tem que entrar como despesa no DRE, diferente de DISTRIBUICAO.

- **O JUIZ LIGADO no import — SÓ BANRISUL (rollout per-bank, 14/08)**. O wiring está VIVO em prod atrás de `CANONICAL_CLASSIFY_ENABLED=true` + allowlist `CANONICAL_CLASSIFY_BANKS` (default `041`). **Choke-point único** `lib/reconciliation/resolve-import-statuses.ts` (canônico → saldoAntes encadeado → juiz) chamado IGUAL no PREVIEW (`importar-ofx/route`) e no CONFIRM (`import-orchestrator`) → tela e gravação não têm como divergir. **2ª cópia do FITID REMOVIDA sob a flag:** `reconcileStatement(...,{skipPreviewSeparation:judgeRan})` não re-separa por FITID==YYMMDD (era ela que descartava a 4.092,02); a CAMADA 2 legada (`reconcileLedgerAnchorDay`) também não roda (o juiz subsume). `blocked` = saldo não fecha e nada explica → NÃO grava (confirm: throw+rollback; preview: `bankProfile.judgeBlockWarning` na tela). **Gate per-bank `isCanonicalClassifyEnabledForBank(bankId)`** — flag OFF ou banco fora da lista = LEGADO (rollback instantâneo). **SHADOW (glue real vs DB de prod, 14/08) — POR QUE só Banrisul:** Banrisul 12 blobs → 11 ✅ (13/08 reimport CLOSED gap=0, a 4.092,02 entra como paga; 1 futuro 17/08 fora) + 1 ⛔ legítimo (04/08 dois extratos conflitantes). **Sicredi 5/6 ⛔ — gap -0.57 SISTEMÁTICO** (constante, não é 1 linha; DERIVED_CONTIGUOUS de fim-de-mês; **A INVESTIGAR antes de ligar 748** — NÃO bumpar tolerância, é sinal real). **Stone 2/10 ⛔** (downloads conflitantes do mesmo dia 03/08 — o "70k"). **PENDENTE:** (a) Yussef reimporta o 13/08 na tela e valida (REGRA 2); (b) investigar o -0.57 do Sicredi; (c) Stone 03/08 conflitante. REGRA 4 provada no passo 2 (heurística FITID = só 2 cópias). Guards: `lib/canonical/__tests__/` (58 testes) + `flag.test.ts`.
- **Camada canônica + Juiz + saldoAntes (A) — PRONTOS e provados no shadow, WIRING FEITO (Banrisul) (PRIORIDADE ALTA→média)** (14/08). `lib/canonical/` (translators/build/judge/saldo-antes) DORMENTE (0 import no pipeline vivo; flag `CANONICAL_CLASSIFY_ENABLED=false`). **(A) 14/08:** `deriveSaldoAntes` recebe as LINHAS do extrato anterior (`PriorStatement.lines`) → regra GERAL "linha do overlap que o anterior não tinha e nunca entrou num LEDGERBAL = não-liquidada, independente da data" (o banco lista/re-lista mas ainda não debitou; ex parcela vencida). O juiz recebe essas como `knownScheduled` → down-flip MESMO fora do dia da âncora (sem isso o down-flip só alcança a âncora e a parcela datada no passado escapava). **Shadow 14/08 (11 blobs Banrisul reais):** o import ROTINEIRO de 13/08 (que ANTES do (A) o juiz BLOQUEAVA) agora **✅ CLOSED gap=0** — o (A) corrigiu o `saldoAntes` que dobrava a contagem do consórcio −1.478,51 já deferido pelo juiz do 11/08 (−22.409,66 errado → −23.888,17, o mesmo dos extratos 05/07/11). **REGRA SUPREMA corrigiu minha leitura:** a parcela 23 (4.092,02) NÃO era "falha de débito" — o LEDGERBAL −2.644,08 a INCLUI (fecha só com ela dentro) → ela DEBITOU atrasada (~13/08, conta no negativo); o Loan mostra OPEN só por falta de tx vinculada. **⚠️ DESCOBERTA DE DESIGN PRO WIRING:** `prior.lines` tem que ser o conjunto **PÓS-JUIZ** (o que entrou no LEDGERBAL do import anterior = `judge.effectedIds`), NÃO o canônico EFETIVADA — senão o extrato seguinte re-subtrai a linha que o juiz anterior deferiu. **1 BLOCK legítimo no shadow (04/08):** há DOIS extratos de 03/08 conflitantes (export 188 linhas −2.040,33 vs diário 12 linhas 18.959,67) → o juiz se recusa a gravar em silêncio (correto; precisa do usuário resolver). **Passos do wiring (com aprovação + shadow limpo):** ligar juiz no confirm/preview atrás da flag, REMOVER a 2ª cópia do FITID (`reconcile-statement.ts isPreviewLine`), religar flag. Guards: `lib/canonical/__tests__/` (48 testes).
- **Perfil por banco — WIRING no pipeline (item 2, PRIORIDADE ALTA)** (12/08). O modelo `lib/bank-profiles/` está pronto e testado (FASE 2+3), mas **ainda NÃO está ligado no import** — só `resolveStatementAnchor` existe (puro). Falta: (a) o import resolver o perfil e usar a âncora do perfil (`import-orchestrator` + `importar-ofx/route` trocam `settledThroughDate` cru pela âncora do perfil); (b) **PROVAR que a validação Σ(EFFECTED)×LEDGERBAL voltou a MORDER no Sicredi** — hoje é TOOTHLESS lá porque a âncora é 31/08 (fim do mês, futuro) → filtra nada e "bate" trivialmente. É proteção que existe no código e NÃO funciona nessa conta; (c) surfar o `bankProfileWarning` NA TELA (banco desconhecido/incompleto). Só depois a FASE 4 (chave alternativa Banrisul + tela contar certo).
- **Motor único de par — TETO de órfãs RESOLVIDO (13/08)**. Era `cap:3000` (chute defensivo pro par O(D×C) quadrático — 5M na caçula) que descartava os mais ANTIGOS em silêncio. **Medido:** dos 5M pares, só **58 valores têm débito E crédito → 716 candidatos reais (0.014%)**. Fix: (a) **JANELA POR VALOR** em `detectTransfers` — créditos ordenados por |valor| 1×, busca binária da banda `[|d|−tarifa, |d|+tarifa]` por débito (classify já rejeitava fora da banda → **resultado IDÊNTICO ao O(D×C)**, provado em `detect-transfers-window.test.ts` c/ sort determinístico por id). 6.5k órfãs casam em ~1ms; (b) **teto subiu 3.000→20.000** (`DEFAULT_CAP`) — cobre qualquer empresa real, caçula (6.5k) não corta mais; (c) **AVISO OBRIGATÓRIO proporcional**: `detectTransfersForCompany` devolve `coverage {analyzed,total,truncated}`; o banner de Pendentes mostra "Analisei as X mais recentes de N — transferências mais antigas podem não aparecer" quando `truncated` (slate se cortou <10%, amber se >30%). Nunca silencioso. O teto de carga só protege memória/query de conta patológica (>20k).
- **Motor único de par — nome de sócio (matchOwnerName) LIGADO (12/08)** — a flag `matchOwnerName` está `true` nos 4 call-sites vivos (banner `detect-active-transfers`, `/parear` `parear-sugestoes`, `/revisar` `aguardando-par`, modal `candidatas`). Reconhece nome de sócio cadastrado (`refs.ownerNames`, nome COMPLETO normalizado) como próprio → camada 2 (0.85, não 0.99). NARROW: nome exato + valor exato + mesmo dia + keyword + sinal oposto + contas ≠ mesma empresa. Homônimo rejeitado. Shadow-run 12/08: +1 par real (25.000 Banrisul→Stone STRONG 0.90), 0 regressão, NURA×OP.CREDITO fora. Os applies (`pair`/`confirmar-em-lote`/`apply-active-transfers`) são id-based (não re-classificam anti-pessoa), então não rejeitam o que a sugestão ofereceu.
- **`rawOfxBlob` — grava SEMPRE (RESOLVIDO 13/08, PJ + cartão)**. Ponto obrigatório `lib/ofx/persist-import.ts`: `createOfxImportRecord` (EXIGE `rawOfx` — impossível criar OfxImport sem o cru; cria CEDO, status PROCESSING, ANTES de processar → sobrevive a import de 0 tx ou falha) + `finalizeOfxImport` (status + contadores + **CONTEXTO 2.4**: âncora, regra, perfil de banco, LEDGERBAL fechou?, dif). Todos os caminhos PJ passam por ele: importar-ofx V2 (orchestrator recebe `importId`) + V1 (fallback) + multi (via orchestrator) + cartão + PDF-extrato. Guard: ESLint `no-restricted-syntax` bane `ofxImport.create` fora do helper (⚠️ `next lint` foi removido no Next 16 — o guard vale como doc/futuro; o guard REAL é comportamental: `lib/ofx/__tests__/persist-import.test.ts` + e2e). `rawOfxBlob` virou campo de 1ª classe no schema (migration `20260813000000`, aditiva). **Tamanho: avg 70 KB, ~34 MB/ano — trivial.** **PENDÊNCIAS desta frente:** (a) **PF** — `PersonalOfxImport` NÃO tem coluna de blob; **gatilho: adicionar `rawBlob` ANTES do 1º import de OFX no PF** (hoje 0 imports PF); (b) **RETENÇÃO** — política definida (Yussef 13/08): **expurgar o BLOB após 12 meses** (LGPD, PII de terceiro), mantendo a metadata (auditoria, sem PII). `blobPurgedAt` já existe; falta o JOB de expurgo (cron que zera `rawOfxBlob` onde `createdAt < now-12m`). Registrar como frente pequena; `createdAt` já grava; (c) **PROCESSING órfão** — imports que travam ficam PROCESSING; **JÁ VISÍVEIS** na tela `/empresas/[id]/imports` (mostra status). Falta só um **alerta "PROCESSING há > X min"** (item 5, não construído — nice-to-have).
- **`bankCode` do arafet banrisul = '000' (não corrigir por dedução)** (12/08). A conta `banrisul` da arafet (`cmr2lswr800au3le2j2mq5b8j`) tem `bankCode='000'` (provável 041, mas **sem OFX salvo pra provar**). NÃO corrigir cadastro por nome de conta — quando aparecer um OFX dessa conta, conferir o BANKID e corrigir com prova. (A Stone `cmq182qfr0005aktn6q2ugpv2` foi corrigida 000→197 em 12/08, provada pelo OFX BANKID=0197.)
- **Stone — 2 downloads do MESMO dia 07/08 com saldo divergente (7.605,88 vs 105,50) e contagem de tx diferente** (12/08). Provável raiz do "70k" que o Yussef mencionou. Não investigado — quando voltar na Stone, começar por aí (os `Comprovante de Extrato (48)/(49).ofx`).
- **Caixa — ficha de perfil INCOMPLETA (sem OFX salvo)** (12/08). Perfil `CAIXA` marcado `incomplete:true` (conservador + avisa). Preencher a ficha (FASE 1) quando o Yussef subir um OFX real da conta corrente Caixa (os "DEBITO PRESTA SIEMP" vêm dela).
- **Aposentar os motores antigos de transferência (A/B/D + inline) — gatilho DUPLO: (a) 1 semana rodando E (b) taxa de confirmação alta.** O motor único acertou 1 par REAL (25.000 Banrisul→Stone, STRONG 0.90, `matchOwnerName` 12/08). **NÃO aposentar ainda** (decisão Yussef 12-13/08): 1 acerto + 1 semana é o mínimo. **Aposentar exige AS DUAS coisas:** (a) ~1 semana com a flag ligada sem erro E (b) **taxa de confirmação das sugestões ALTA** (usuário confirma a maioria). **Se o usuário IGNORAR muito, o motor erra e o legado FICA** — ajustar o motor antes. **MEDIÇÃO PRONTA (13/08):** `TransferSuggestionEvent` (`transfer_suggestion_events`, migration `20260813120000`) registra sugestão→desfecho. Chave por par `(debitTxId, creditTxId)`, `engine` (unified=motor sugeriu / manual=usuário achou sozinho), `outcome` (SUGGESTED/CONFIRMED/IGNORED). SUGGESTED no detect (`recordSuggested`, upsert idempotente), CONFIRMED no apply (`recordConfirmed` — mantém unified se havia sugestão, senão manual), IGNORED quando o modal rejeita (`recordIgnored`; o modal manda os `ignored` no apply). Helper `lib/transfers/suggestion-events.ts`. **No 19/08, medir:** `SELECT engine, outcome, count(*) FROM transfer_suggestion_events GROUP BY 1,2` — taxa = CONFIRMED / (CONFIRMED+IGNORED) onde engine='unified'. **Bônus (resolveu o outro problema):** o "ignorar" agora PERSISTE — par ignorado NÃO reaparece no banner (`detectTransfers` recebe `ignoredKeys`, pula ANTES do greedy → a tx ainda pareia com outra); reversível em `/empresas/[id]/transferencias/ignoradas` ("ver de novo"). `transferDismissedAt` DEPRECADO (campo morto, granularidade errada — a exclusão vem do event por PAR). Motor C fica; branches OFF são a rede de rollback até lá.
- **7º site de par inline — `/transferencias/candidatas/[id]` + `VincularTransferenciaModal` (VIVO em Pendentes) — MIGRADO (11/08)** (achado 11/08). Modal "Vincular transferência" lista candidatas por sinal oposto + valor ±1¢ (sem scoring). **Migrado pro motor único** atrás da flag: a route dropa o `status:'PENDING'` (candidata pode estar RECONCILED), classifica cada candidato via `classifyTransferPair` (só camadas 1+2 aparecem), devolve `layer`/`confidence`/`evidences` + `engine:'unified'`; o modal mostra badge da camada + evidências pt-BR e aplica via `apply-active-transfers` (in-place, não deleta+recria como o `pair-pendentes` legado). Caminho manual = link "Parear manualmente →" pro `/parear` (independente do detector). Flag OFF mantém o legado 2× PENDING. Confirma que a lógica de par estava em ~7 lugares, não 4.
- **ANTI-PADRÃO — `rm` no servidor sem checar se é tracked → RESOLVIDO por IMPOSSIBILIDADE (`saferm`, 14/08)**. Mordeu 2× (11/08 3 libs; depois `rm -rf lib/canonical` — os dois recuperados por `git checkout -- <path>`). O `git pull` NÃO restaura tracked deletado. **Disciplina virou impossibilidade:** `/usr/local/bin/saferm` no CAIXAOS roda `git ls-files --error-unmatch` antes de apagar e **RECUSA** qualquer arquivo/dir git-tracked (exit 1, manda usar `git rm`/`git checkout`); só remove untracked. **Regra: no servidor, usar `saferm <path>` no lugar de `rm` pra limpar scratch.** Testado 14/08 (recusa `lib/canonical/judge.ts`, remove `.tmp` untracked). Fallback manual: `git ls-files` antes; tracked deletado → `git checkout -- <arquivo>`; untracked → `git clean -n` (dry-run) ANTES do `git clean -f`.
- **PRÁTICA OBRIGATÓRIA — SHADOW-ANTES-DE-WIRE (14/08)**. Todo motor/regra nova de fluxo-de-dinheiro (detector, juiz, saldoAntes, classificador) passa por **shadow-run contra DADO REAL (blobs/fixtures reais), com o resultado conferido, ANTES de tocar o pipeline de produção**. Nunca ligar flag direto no dado real sem shadow. **Já pegou 2 problemas que teriam ido a prod:** (a) os 23 pares FALSOS do motor de transferência (scan-retroativo 0.70 na caçula, valores redondos); (b) o JUIZ **bloqueando** o import ROTINEIRO de 13/08 — a parcela 23 do Banrisul é persistente-não-liquidada (vencida, falha de débito por falta de saldo) e o down-flip do juiz não a alcançava; sem o shadow, o juiz ligado teria travado o import diário do Yussef. O shadow é a diferença entre "os testes passam" e "funciona no dado que o usuário TEM". Só liga a flag depois do shadow limpo + aprovação.

- **ANTI-PADRÃO — fallback não pode depender do caminho principal** (lição 11/08, motor de transferência tela 2). No `/parear`, os dropdowns manuais ("eu digo que é transferência") eram DERIVADOS das sugestões do detector → se o detector achava 0, a ferramenta manual (que deveria ser a saída de emergência) ficava vazia. **A saída de emergência dependia do mecanismo que ela substitui.** Fix: dropdowns vêm de TODAS as órfãs, independente do detector. **AÇÃO:** varrer se há isso em outro lugar — alguma tela onde a ação manual só funciona se a sugestão automática funcionar.
- **ANTI-PADRÃO — a varredura por NOME de módulo não acha lógica INLINE em rota/componente** (lição 11/08, motor de transferência). O 5º detector de par estava inline dentro do `/aguardando-par` (constantes `PAIR_WINDOW_DAYS=3`/`PAIR_AMOUNT_TOL=0.01`, sinal oposto) — não aparecia como função nomeada, então nenhum mapa por módulo o achava. **Ao mapear duplicação, procurar TAMBÉM por constantes e comparações soltas** (janela de dias `86400000`/`_WINDOW_DAYS`, tolerância `_TOL`/`0.01`/`0.015`, `Math.abs(a.amount - b.amount)`, `DEBIT`×`CREDIT` sinal oposto), não só por `import` de função. **Varredura 11/08 achou (família par de transferência, inline):** `/aguardando-par` (GET detector + `/[txId]/pair` apply), `/confirmar-em-lote` (apply batch), `/transferencias/candidatas/[id]` (candidatos por tx). **NÃO são par (features distintas, tolerância própria, deixar):** conciliação Xero (`row-actions`/`xero-row`), fatura de cartão (`importar-fatura`), empréstimo (`linkar-liberacao`/`candidatos`).
- **Motor C (`findRetroactivePairs`) SOBREVIVE de propósito** (decisão 11/08) — o `/duplicatas` (tela viva) usa a saída `duplicates` de C pra detectar DUPLICATA (OFX×MANUAL), que é feature DIFERENTE de par de transferência. O motor único de par NÃO faz dedup e não deve. C fica; não é esquecimento.
- **5 endpoints de transferência MORTOS — deletar na limpeza** (11/08, provado 0 caller por grep): `/transferencias/sugestoes` (GET), `/sozinhas`, `/scan-retroativo`, `sugestoes/confirmar`, `sugestoes/recusar`. Antes de remover: re-confirmar 0 caller por grep + execução. Sobras do design antigo da Central.
- **ANTI-PADRÃO — lógica duplicada em 2+ lugares, uma corrigida e outra não** (recorrente; mordeu de novo 11/08). A regra "2× PENDING" do par estava na SUGESTÃO **e** no APPLY (`pairPendentes:55`) — corrigir só a sugestão deixaria o apply rejeitando o que a tela oferece. **Mesma família de:** V1/V2 do import, `stableKey`/`dedupHash` em N lugares, os **5 detectores de par** de transferência (A/B/C/D + o inline do `/aguardando-par`). Ao mexer numa regra, achar TODAS as cópias (grep + execução) antes de dar por fechado.

- **Preview do PDF (Vision) usa relógio de parede pro descarte-futuro, não a âncora do arquivo** (registrado 10/08/2026). O `partitionFutureStatementLines` (`lib/pdf-bank-statement/partition-future.ts`) corta por `todayBrazilDay(now)` — MESMA classe do bug que o OFX teve: se importar tarde (dia+1), a linha agendada de +1 passa. O OFX foi corrigido pra `max(DTASOF, DTEND)` (now-independente, `lib/ofx/future-line.ts:settledThroughDate`), mas o PDF não tem DTASOF/DTEND confiável. **Está gated** (`PDF_IMPORT_ENABLED=false`), então não morde hoje. **Ao ligar o PDF Vision: ancorar no `periodEnd`/`closingBalance` da extração** (não no relógio), espelhando o OFX.
- **~500 guards grep-de-string em ~28 arquivos (REGRA 3) — reescrever como comportamentais** (auditado 10/08/2026). Auditoria cética dos guards de fluxo-de-dinheiro (import, transferência, ponte PJ→PF, empréstimo, DRE/badge/categoria): **ZERO com comportamento quebrado** — o caso do descarte-futuro foi específico (string no branch CONFIRM, comportamento faltava no PREVIEW); nos demais o símbolo grep-ado aponta pra código efetivamente ligado no caminho real (traçado + funções puras executadas). **Logo: reescrever NÃO muda produção — é qualidade de teste, não incêndio.** Fila de ataque quando estiver calmo, por VALOR: (1) `createBridge` A/B (`fluxo-ab-ponte`), (2) import empty-guard (`fix-import-vazio`), (3) `parear-transferencias`. Maiores por nº de testes: `fluxo-unificado-retirada` (36), `redesign-socios` (34), `parear-transferencias` (32), `fluxo-ab-ponte` (28), `redesign-ponte-detalhe` (26), `sprint-emprestimos-backend` (25 — 6 grep/19 comportamental), `receitas-pf`/`despesas-pf` (25). UI-pura (`redesign-*`, `sprint-visual-datefilter`) não-auditada e menos grave (quebra tela, não número). **REGRA 3 vale pra tudo NOVO daqui pra frente** (teste novo executa comportamento; antigos ficam até a reescrita). Método da auditoria = tracing + execução de pura (o mesmo que pegou o bug do futuro); certeza total só com E2E real.
- **Repo PÚBLICO — decisão consciente da fase de teste** (08/08/2026). `github.com/yussef5522/conta-ia` é público de propósito durante o desenvolvimento (só Yussef + amigos usando pra achar erro; sem cliente pagante nem terceiro com dado). **TORNAR PRIVADO ANTES de (gatilho, não data):** (a) o 1º cliente pagante de fora entrar, OU (b) qualquer terceiro que não seja o usuário/amigos próximos ter dado no sistema. **Passos já meio-andados:** deploy key ed25519 read-only já gerada em `/opt/conta-ia` (`/root/.ssh/conta_ia_deploy`, alias `github-contaia` no `~/.ssh/config`, remote AINDA em HTTPS). Falta: registrar a pública no GitHub como **deploy key read-only** → trocar o remote pra SSH (`git@github-contaia:yussef5522/conta-ia.git`) → testar `git ls-remote` + `git fetch` → só então privar → `git pull` completo de prova. **Histórico verificado LIMPO** (622 commits, zero credencial/chave privada — só placeholders de doc) → privar resolve sem rotacionar nada. `.gitignore` já cobre `.env*` + dumps (`*.dump`/`*.sql.gz`). CPF do dono já anonimizado nos testes.
- **Asaas 3D** (produção real de pagamento) — playbook em `docs/sprints/PAGAMENTO-RETOMAR-AQUI.md`. Sandbox 3A+B+C deployados; falta ativar webhook + smoke + virar chave prod.
- **PDF Vision** — gated até Yussef assinar ZDR com Anthropic. Doc: `docs/sprints/pf-fatia-3.5-LIGAR-PDF.md`.
- **Rotação senha Postgres prod** — higiene pós-Asaas 3C (senha apareceu em texto durante debug). Sem vetor externo conhecido, mas fazer quando puder.
- **Categoria PJ genérica** — refatorar antes do 2º sócio entrar em qualquer empresa (`docs/decisoes/categoria-pj-nominada-vs-generica.md`).
- **Fase B.3 Conciliação completa** — hoje aba "Transfer" da conciliação linka pra `/transferencias/parear`. Fase B.3 real seria parear inline dentro da conciliação + migration `discussNotes` pra aba Discuss.
- **Motor único de par — anti-pessoa rejeita par interno quando o memo tem o NOME do sócio (não CNPJ) — PROVADO bloqueando 7 pares (PRIORIDADE, aguarda green-light)** (12/08). O `classifyTransferPair` (`unified-transfer-engine.ts:139-141`) marca `thirdPartyName` quando `hasPersonName(desc) && !(hasOwnCnpj || hasOwnerCpf)` — só o CNPJ/CPF próprio salva, **o NOME do sócio não**. Import real da Stone: 7 créditos "YUSSEF ABU ZAHRY MUSA - Transferência|Pix" (transferências Banrisul→Stone) ↔ 7 PIX ENVIADO do Banrisul, **todos same-day + valor exato + keyword de transferência** → o motor detectou **0** (o "teste real" do motor falhou). Causa: o memo da Stone traz o NOME do dono mas **sem CNPJ**, e `refs.ownerNames` (["Yussef Abu Zahry Musa"]) **não é consultado** no gate anti-pessoa. **Fix proposto (aguarda ok do Yussef):** tratar nome que casa `refs.ownerNames`/SocioPF cadastrado como "próprio" (não terceiro) — narrow (exige nome exato do sócio + valor+data+keyword+sinal oposto), baixo risco de falso positivo. Mesma família do fix 06/08 (que só cobriu CNPJ próprio, não nome). É a raiz do débito histórico "reconhecer nome de SocioPF como próprio".
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
- **Liberação de empréstimo de anos anteriores como Receita de Vendas** (Sprint Casar Pagamento 04/08) — R$ 248.273,59 de liberações Banrisul "OP. CREDITO C/GARANTIA" (contratos 2021-2024) estão categorizadas como `Receita de Vendas` (RECEITA_BRUTA) na caçula, mais 1 Sicredi R$ 100.000 "LIBERACAO CREDITO-C61021346" como Aporte de Capital. **Decisão do usuário (04/08): NÃO mexer** — competências fechadas (2021/2023/2024), não afetam o período atual. **Para contratos NOVOS:** liberação = entrada de caixa com contrapartida em PASSIVO, NUNCA receita (inflaria faturamento, grave em Lucro Real). A FASE 6.3 (reclassificar) foi cancelada. **⚠️ CORREÇÃO (17/08): a premissa de que "OP.CREDITO C/GARANTIA" do Banrisul é LIBERAÇÃO DE EMPRÉSTIMO estava ERRADA — ver o bullet abaixo. É VENDA DE CARTÃO. Só a linha Sicredi "LIBERACAO CREDITO-C61021346" (100k) é liberação de fato. Os 248k Banrisul provavelmente são cartão histórico (competências fechadas, não reabrir).**
- **⚠️ "OP.CREDITO C/GARANTIA" no Banrisul da Cacula = LIQUIDAÇÃO DE CARTÃO, NÃO empréstimo (dono confirmou 17/08).** É a venda de uma bandeira específica (Visa/Master) que o Banrisul liquida por essa rubrica porque a bandeira está vinculada à garantia do empréstimo — liquidação DIRETA, sem conta intermediária. As outras rubricas de cartão do Banrisul (ANTECIP STONE, DEBITO STONE, BANRI A VISTA, VERO ANTECIPACAO, ANTECIPACAO BANRICOMPRAS) são outras bandeiras/adquirentes; **nada duplicado**. OP.CREDITO é **87% do cartão Banrisul** (a bandeira principal: agosto 153k de 176k). **Prova = o PADRÃO D+1 útil com fim de semana em BLOCO** (seg 03/08 27.000, seg 10/08 27.929, seg 17/08 24.431 após o fim de semana; dias seguidos 06→6.975, 07→8.474), igual ao resto do cartão — não é saque manual, é o banco liquidando. **NÃO reclassificar; fica Receita de Vendas.** O motor de vendas trata OP.CREDITO como CARTÃO Banrisul (D+1 útil, fim de semana em bloco). **Diferente do limite de conta garantida (cheque especial)**, que opera negativo e aparece como JUROS/IOF/"TRANSF. ENCARGOS CTA UNICA" — essa sim é dívida. (Nota: liquidação de bandeira pode atrasar 1 dia e dobrar no seguinte — ter 04/08 teve ~0 OP.CREDITO, qua 05/08 veio 42.225 = ter+qua batidos; reforça o `~ESTIMADO`.)
- **C61021766 = operação de crédito automática Sicredi (RESOLVIDO 05/08, caso isolado)** — o Sicredi abre um contrato ("conta garantida") pra cobrir uma parcela sem saldo e raspa a conta até quitar. Aconteceu 1× na caçula: 6 lançamentos em 20-21/07/2026 (R$ 7.294,40, terminando em "LIQUIDACAO CONTRATO-C61021766") pra cobrir a #22 do C41022227. **Decisão do usuário:** NÃO cadastrar o contrato nem construir tratamento próprio. Os 6 foram **categorizados como "Juros sobre Empréstimos" (DESPESAS_FINANCEIRAS)**, não como amortização — porque a #22 do C41022227 (7.139,85) já constará paga pelo documento oficial com o split correto (principal fora do DRE); lançar os 6 como amortização contaria o principal 2×. Despesa financeira evita a duplicidade, mantém fora do resultado operacional, é honesto (não é o ideal — parte seria principal — mas o caso é isolado). **Se voltar a acontecer com frequência, avaliar tratamento próprio.** Nota relacionada: a #22 do C41022227 vai ficar paga pelo documento SEM tx vinculada (o dinheiro veio da operação de crédito, não da conta corrente) — correto, não forçar vínculo.
- **Empréstimo 0% / FLEXIBLE — encargo SEMPRE zero no vínculo** (Sprint FLEXIBLE Arafat 06/08 — RESOLVIDO) — `computeLinkSplit` (`lib/loans/link-payment.ts`): `interestRateMonthly === 0` → `encargos = 0`, `amortização = valor pago inteiro`, `closing = opening − pago` (todo valor é baixa de passivo). Fecha o gap: devolver R$ 45.000 numa parcela nominal de R$ 41.428,57 NÃO cria R$ 3.571,43 de despesa financeira falsa. Confirm de vínculo (`vincular-parcela/confirm`): 0% sempre grava o split e move `amortization` pro valor pago. Saldo FLEXIBLE (`lib/loans/saldo.ts`) = `principal − Σamort(PAID)` (agenda nominal ignorada). UI (lista + detalhe): sem próxima parcela/progresso-por-parcela/cards de compromisso mensal, nunca "Atrasada", progresso em VALOR + histórico de devoluções. Gated 100% por `FLEXIBLE`/`rate===0` — os 8 bancários intocados. DRE inalterado (guard `encargos<=0`). Testes: `casar-pagamento.test.ts` + `saldo.test.ts`.
- **Dívida com a Arafat — mútuo sem juros, saldo 290k** (Sprint Dívida Arafat 05/08; **números corrigidos contra o banco em 01/09**) — ⚠️ **este doc dizia R$ 340.000 e UMA devolução; o banco diz `principal = 380.000` e DUAS**: 40.000 em 06/07 e 50.000 em 04/08. Os dois caminhos chegam nos mesmos 290.000 de saldo (`380 − 90`), mas a leitura antiga escondia a devolução de julho. A caçula pegou **R$ 380.000** emprestado da **Arafat (arafet thalji, empresa do grupo)** em mai/2026 SEM JUROS; devolveu **40.000 (06/07) e 50.000 (04/08)**; faltam **290.000** (devolução conforme caixa, 40-50k/mês). ⚠️ As duas devoluções estão vinculadas por **1:1** (`reconciledTransactionId`) nas parcelas #1 e #2 — o N:1 deste contrato está VAZIO. Cadastrado no módulo de Empréstimos como: credor "Arafat (arafet thalji)", saldo 290.000, **taxa 0%**, SAC nominal 7x, `scheduleSource='FLEXIBLE'` (NUNCA marca "Atrasada" — cronograma é só referência), na conta caixa loja/cofre, com `notes` explicando o contexto. **Entrada original dos 340k NÃO registrada** (competência mai/2026, decisão do usuário). Os 50k de 04/08 reclassificados de "Juros sobre Empréstimos" pra "Amortização de Mútuo (terceiros)" (TRANSFERENCIA, não-DRE) — **só categoria, SEM vincular** (o saldo 290k já é líquido; vincular abateria de novo → 240k errado). Categoria nova "Amortização de Mútuo (terceiros)" criada pra isso. Próximas devoluções: vincular ao empréstimo (encargo 0, abate saldo exato) — gap 0% já resolvido (item acima). **PENDENTE:** a reclassificação dos 50k de 04/08 (categoria) ainda NÃO foi gravada — mostrei o preview, falta o "confirma?" do Yussef.
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
