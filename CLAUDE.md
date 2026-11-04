# Conta IA — CLAUDE.md operacional

> **⛔⛔ REGRA NOVA (04/11/2026) — CLAUDE.md FICA ≤ 30k CHARES.** História, cicatrizes
> detalhadas e relatórios de sprint vão pra **`docs/memoria/<tema>.md`**. Este arquivo tem
> só as **REGRAS VIVAS curtas**, o **estado**, as **convenções** e o **índice da memória**.
> ⚠️ O motivo é medido: ele chegou a **1.853.727 chars (12× o limite de 150k)** e cada sessão
> nascia com a memória quase cheia e caía em minutos. Backup integral:
> `docs/memoria/CLAUDE-completo-2026-11-04.md` (md5 idêntico ao original).
>
> **Escrever daqui pra frente:** regra nova e curta entra aqui; o CASO (números, perícia,
> prova em prod) vai pro arquivo de tema. Se a regra não cabe em 3 linhas, ela mora na memória
> e aqui fica só o nome dela.

## 📚 MEMÓRIA COMPLETA — `docs/memoria/` · **LER POR TRECHO, só quando o tema for o do sprint**

| arquivo | o que tem |
|---|---|
| **`cicatrizes.md`** | os defeitos, a causa medida e a lição dura de cada um (⛔/⚠️). O maior volume de "por que isto é assim". |
| **`sprints-historico.md`** | o que foi construído, por data, com as provas em prod. |
| **`regras-completas.md`** | o texto INTEGRAL das REGRAS 1-14, dos princípios e dos acordos. |
| **`infra-deploy.md`** | deploy blue-green, check-up de saúde, servidor, backup, SEFAZ/certificado. |
| **`arquitetura-modulos.md`** | modelo de dados, decisões de arquitetura por módulo e regras de negócio integrais. |
| **`leis-de-tela.md`** | referências visuais versionadas, leis de layout/densidade e as telas. |
| **`pendencias-debitos.md`** | pendências, débitos técnicos e frentes abertas. |

⛔ **NUNCA ler um desses inteiro** (vários passam de 300k). O jeito certo:
`grep -n '^#' docs/memoria/<tema>.md` pra achar a seção → `sed -n 'A,Bp'` pra ler só ela.

---

## ⛔⛔ AS REGRAS VIVAS (versão curta — texto integral em `docs/memoria/regras-completas.md`)

**SESSÃO ENXUTA** — o que entra no chat é a PROVA, nunca o relatório da ferramenta. Suíte com
reporter resumido (contagem + VERMELHOS, nunca a lista dos verdes) · log/grep/SQL só nas
linhas-prova (~10 por evidência) · arquivo grande por TRECHO · texto de PDF nunca inteiro no
chat · sonda imprime VEREDITO + NÚMEROS, nunca dump. ⚠️ Enxugar a SAÍDA nunca é enxugar a
PROVA: quando o número É o achado, ele vai escrito.

**LEITURA POR TRECHO** — `grep -n` pra localizar, `sed -n 'A,Bp'` pra ler. Nunca `cat` de
arquivo grande.

**EXPLORAÇÃO EM SUBAGENTE** — varredura ampla (achar onde algo mora, mapear N arquivos) vai
pra subagente; o que volta é a CONCLUSÃO, não o despejo.

**MICRO-BLOCOS** — trabalho em blocos pequenos e provados, um por vez.

**REGRA 8b — PROVA EM QUAL BANCO ESTÁ ANTES DE MEDIR.** Todo script de investigação resolve a
empresa por ID e **ABORTA** se ela não existir ali (`exigirEmpresaNesteBanco`). ⛔ *Zero
silencioso é indistinguível de "não tem"* — já me fez declarar perda de dado que não existia.
E **REGRA 8**: conta/empresa/usuário se resolve por **ID ou PAPEL, nunca por nome ou e-mail
chutado** (3 empresas usam os mesmos bancos; `findFirst` por nome pega a do vizinho).

**REGRA 11 — GUARD SÓ CONTA DEPOIS DE RODAR CONTRA O DEFEITO.** Escreveu guard → **reponha o
defeito** → **veja vermelho** → restaure. Sem esse passo é uma afirmação sobre o mundo bom.
⚠️ A sonda guarda backup pela **chave do caminho inteiro**, **ASSERTA por md5 que a
substituição aplicou**, e **conta suíte que NÃO COLETOU como vermelho**.
⛔ *"Menção, não uso"* (22 ocorrências): guard que procura o símbolo no arquivo aprova o ramo
morto — o que morde é o **USO**, e o arquivo é lido **sem comentário** (*o arquivo que
documenta o defeito não pode ser o que o absolve*).
⛔ *Janela de distância* (10 ocorrências): `[\s\S]{0,N}` já produziu falso vermelho E falso
verde — guard é **estrutural**, nunca por proximidade.

**REGRA 14 — CURA DE FAMÍLIA OBRIGA TESTE-ESPELHO NOS IRMÃOS.** Consertou uma classe num
parser/módulo → o MESMO caso roda nos irmãos, e **o golden deles ganha variante com o campo
≠ 0** (campo zerado passa verde com a régua certa E com a errada).

**ARQUIVO DE REFERÊNCIA = LEI.** Mock/referência aprovada vive **versionada em `docs/`** e o
guard **ABRE o arquivo** (tokens por VALOR, medidas, frases). ⛔ Divergência da referência =
defeito; "melhoria" minha se desfaz. *Enquanto o mock vive no Downloads, "igual ao mock" é
memória minha — e memória é o que falha.*

**PORTA ÚNICA (REGRA 4 + REGRA 5).** Quando N telas/caminhos precisam da MESMA decisão, a
decisão vira **função com dono**; cópia é bug (já custou 7 detectores de par). E toda
"disciplina que depende de lembrar" vira **impossibilidade** (tipo obrigatório, choke-point,
índice único, `exit 1`). ⛔ Ao substituir uma lógica, **provar que não há outra cópia**:
buscar o NOME, a CONSTANTE e o COMPORTAMENTO. *"N caminhos, 1 esquecido"* é a doença mais
caras desta casa.

**DEPLOY BLUE-GREEN 4/4 — `bash scripts/deploy.sh`.** O build nunca encosta no diretório
vivo; o symlink só troca depois do artefato provado. **Gate 4/4:** BUILD_ID servido ==
buildado · pm2 `online` com o MESMO PID depois de 10s · TODOS os CSS do HTML em 200 do build
novo · **POST no login com credencial inválida → 401** (500 = banco inalcançável).
⛔ Falha de build é **não-evento**: prod segue no build anterior. Rollback:
`bash scripts/rollback.sh`. ⚠️ **Deploy cujo gate eu não li é deploy não provado.**
**NUNCA** `npm run build | head/grep -m` (SIGPIPE mata o build no meio). Antes do pull:
`git checkout -- prisma/schema.prisma prisma/migrations/migration_lock.toml`.

**SEGURANÇA — ZERO ESCRITA SEM AUTORIZAÇÃO.** Em prod: investigação é **read-only**; gravar
pede OK explícito, com **`pg_dump -Fc` antes E o TAMANHO do arquivo conferido** (*dump de 0
byte é indistinguível de dump feito*) e **contabilidade de escrita antes/depois**.
⛔ **MÁSCARA DE CREDENCIAL:** nunca `cat .env`, nunca ecoar credencial; comando que toca
`DATABASE_URL` roda com `stdio` silenciado **e o `catch` não imprime a mensagem** (a exceção
do Node/Prisma **vaza a URI com a senha**). ⛔ `saferm` no lugar de `rm` no servidor (recusa
git-tracked). ⛔ Reposição se desfaz com **`cp` de backup, nunca `git checkout`**.
⛔ **Sonda nunca dorme no workspace de build** — nasce fora do repo (ou sai na mesma linha de
comando); uma sonda no raiz já derrubou um build.

**REGRA 1** teste que falha antes e passa depois · **REGRA 2** feature só está pronta se o
dono VÊ na tela (o clique é dele) · **REGRA 3** teste EXECUTA o comportamento, nunca grep de
string (*grep não distingue "refatorei" de "quebrei"*) · **REGRA 6** o caso NEGATIVO
(estorno/crédito/sinal oposto) escapa onde o caminho feliz e a exceção moram em lugares
diferentes · **REGRA 7** módulo de dinheiro fecha com invariante de MÓDULO; *invariante que
falha no caso legítimo é pior que invariante nenhum* · **REGRA 9** hook novo vai pro TOPO do
componente, nunca perto do uso · **REGRA 10** relaxar constraint exige fixture do estado novo
no MESMO commit · **REGRA 12** tela se prova nos DOIS viewports · **REGRA 13** CHECK com
coluna nullable é lógica de TRÊS valores (`IS NOT NULL` explícito e PRIMEIRO; `length(trim(NULL))`
é NULL e **CHECK com expressão NULL PASSA**) e nasce com prova de INSERT torto contra Postgres.

**OS PRINCÍPIOS QUE MAIS SE PAGARAM** (cada um com dezenas de casos na memória):
- **o DADO decide, não o meu raciocínio** — medir ANTES de propor; evidência medida não se
  abandona por hipótese confortável.
- **heurística SUGERE, nunca DECIDE em silêncio** — descarte/destino só por regra
  determinística sobre campo DECLARADO. Texto livre (memo, descrição) não classifica nada.
- **ausência ≠ zero** — "a apurar"/"sem contagem"/`null` é estado próprio; `0` é uma
  afirmação. *Default que resolve é default que esconde.*
- **nenhum rótulo promete mais do que entrega**; número em tela de dinheiro sem régua é pior
  que ausência; **remoção sem realocação é perda**.
- **porta sem maçaneta** (12 voltas): motor em prod que o dedo do dono não alcança não existe.
- **saldo/variância nunca é dado primário** — derivado, recomputável; **ledger é imutável**,
  correção é **estorno + novo**.
- **alarme falso repetido é como um alarme morre** — e *comentário que promete ser a trava sem
  ser a trava é pior que comentário nenhum*; *linha que não pode falhar é linha que finge ser
  trava*.
- **o relógio nunca decide** (só exibe "hoje"); data de negócio é **dia do BRASIL**; data fixa
  no futuro é bomba de calendário.
- **sonda errada dá um vermelho tão convincente quanto um defeito real** — nome de campo,
  assinatura, URL, testid e export se **LEEM do repo**, nunca se chutam; no bundle se mede o
  que o CLIENTE desenha (e com escape `\xNN`), o que o servidor manda se mede no PAYLOAD;
  *achado não atribuível não é achado*.
- **categoria/receita/preço é decisão do DONO** — o sistema pergunta, registra e não reabre.

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
- **Saldo caixa loja/cofre conferido pelo usuário contra o dinheiro físico em 08/08/2026: 4.988,82, confere.** A âncora "Ajuste de saldo inicial" de 8.946,25 (06/06) está correta. (O erro de julho era uma entrada manual de 7.000 "saque do banco" lançada por engano — apagada em 08/08; o saldo voltou ao valor real.)
- **⭐ AGOSTO/2026 É O MARCO DE REFERÊNCIA DA CAÇULA (14/08).** Saldos das 5 contas conferidos contra o LEDGERBAL em 13/08 (Banrisul −2.644,08, Sicredi −66.685,57, Stone 240,19 — as 3 OFX batem exato; banco caixa e cofre são manuais), **0 buraco de período** (15 dias úteis com extrato completo em Banrisul/Sicredi/Stone). Meses anteriores têm erro conhecido e foram **dados por encerrados por decisão do usuário**. **Daqui pra frente o padrão é MANTER fechado** — todo import novo tem que preservar isso.

## Rotas & redirects 301

- `/pessoas-vinculadas` → `/socios` (Sprint Unificar 03/06)
- `/empresas/:id/pontes` → `/empresas/:id/socios` (idem)
- `/relatorios` → per-empresa via cookie (Sprint 5.0.4.0a)
- `/empresas/:id/dre` e `/dre-gerencial` → `/empresas/:id/relatorios/dre-gerencial` (statusCode 301 explícito em `next.config.mjs`)

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

## Definição de Pronto (DoD) — regra crítica

Sprint não é "entregue" sem TODOS: (1) unit/integration tests passando, (2) build sem erros, (3) TS strict 0, (4) teste E2E real no browser com fixture real + contagem numérica, (5) smoke test em prod pós-deploy (PM2 online, curl 200, fluxo crítico), (6) relatório com evidência numérica + PNGs + logs limpos, (7) `pg_dump` antes de deploy com mudança de schema/lógica financeira. Cenários E2E obrigatórios cobrem: upload (válido + limit + tipo errado + re-upload + retry), form multi-step (golden + voltar/avançar + validation), CRUD (criar/editar/deletar/filtros/paginação), conciliação (match 1-1 + split + ignore).

## Migrations em tabelas com dados reais

Toda migration além de "100% aditiva pura" (CREATE TABLE, ADD COLUMN nullable ou com default em tabela SEM dados) exige seção **"⚠️ ALTERs em tabelas com DADOS REAIS"** no plano com tabela: tabela | operação | tipo | linhas afetadas | risco | mitigação. Confirmação pós-migration com evidência objetiva: COUNT antes/depois, `is_nullable`, distribuição, FKs/índices intactos, query típica retornando dados certos. Risco Alto: DROP COLUMN, RENAME, backfill não-idempotente, migração entre tabelas.

## Padrão de Relatórios CAIXAOS (Sprint 5.0.4.0a)

Todos os relatórios financeiros em `/empresas/:id/relatorios/<nome>`. `/relatorios` global redirect per-empresa via cookie. Estrutura: Breadcrumb "← Voltar pra Relatórios" · Header título+subtítulo · Filtros (período/comparações/tipo) · 3-4 stats cards · Conteúdo (tabela/gráfico) · Drill-down clicando linhas. Cores semânticas: receitas `emerald-600` · despesas `red-600` · positivos `emerald` bold · negativos `red` bold · estável `slate` · crescimento `↑↑ red >+50%` / `↑ amber +15-50%` / `━ slate ±15%` / `↓ sky -15-50%` / `↓↓ sky escuro <-50%` · novidade `🆕 purple` · sumiu `✕ slate-400`. DRE existente (`lib/dre/*`) é REUSADO — mesma fonte da verdade.

## Convenções de código

TypeScript strict em tudo · commits semânticos (feat/fix/refactor/docs/test/chore) · Zod em toda rota API · textos UI pt-BR · logs de erro em pt-BR · comentários em pt-BR quando explicam regra de negócio · shadcn/ui · path alias `@/*`. Design system atual: cards limpos, `tabular-nums`, Framer Motion `stagger 30ms` `easeOutExpo`, gradient hero `#185FA5→#0F4A8C`, semântica de cor (emerald/rose/amber/slate), radius consistente.

## Workflow

- **Início de sessão**: ler CLAUDE.md por completo · confirmar com Yussef qual frente antes de codar.
- **Sprint pattern** (opção 2 = execução completa em sessão única):
  1. FASE 0 — `pg_dump -Fc` prod (sempre, mesmo sem migration se envolve prod).
  2. FASE 1-N — implementar em fases claras.
  3. Deploy no fim: git push → prod pull → build → PM2 reload → smoke sem auth (401 esperado) + smoke com SQL (invariantes intactos).
- **Confirmar IP CAIXAOS 198.211.103.10** sempre antes de SSH/deploy.
- **NUNCA** mexer em senha admin em prod. **NUNCA** confundir com AcadOS.
- **Testar contra Conta Azul** (referência de mercado) — se comportamento nosso é pior/menos claro, é regressão.
- **⛔ SAÍDA ENXUTA do primeiro comando ao último** — suíte com reporter resumido (contagem + vermelhos, nunca os verdes), log/grep/SQL só nas linhas-prova, arquivo grande por trecho, sonda com veredito e sem dump. Ver **REGRA DA SESSÃO ENXUTA** no bloco de regras.
- **Fim de sprint:** encerrar os shells de fundo e fechar o relatório com **`— pronto pra /clear —`**.

## Log de sessões

Detalhamento cronológico integral de 23+ sessões (29/04/2026 → 05/06/2026) em **`CLAUDE_HISTORY.md`** — consultar com grep pra contexto de "por que X foi feito assim" ou como uma feature evoluiu. Sessões 30/06-01/07 (Redesign Sócios, Fluxo Retirada Unificado, Parear Transferências) ainda pendentes de registro no HISTORY — a próxima sessão de manutenção deve consolidá-las.

## Links úteis

- Pluggy: <https://docs.pluggy.ai> · <https://meu.pluggy.ai>
- Claude API: <https://docs.claude.com>
- Reforma Tributária: <https://www.gov.br/fazenda/reforma-tributaria>
- NF-e 2026: <https://www.nfe.fazenda.gov.br>
- shadcn/ui: <https://ui.shadcn.com> · BrasilAPI: <https://brasilapi.com.br>

---

## 🔎 COMO ACHAR UMA COISA NA MEMÓRIA (receita de 2 comandos)

```bash
# 1. em qual tema está?
grep -rn "<palavra>" docs/memoria/*.md --include='*.md' -l

# 2. achar a seção e ler SÓ ela (nunca o arquivo inteiro)
grep -n '^#' docs/memoria/cicatrizes.md | grep -i "<palavra>"
sed -n '1200,1260p' docs/memoria/cicatrizes.md
```

⚠️ O backup integral (`docs/memoria/CLAUDE-completo-2026-11-04.md`, 1.853.727 bytes) é o
**original intocado** — está lá por prova de que nada se perdeu, **não pra ser lido**.
