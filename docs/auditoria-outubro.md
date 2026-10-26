# AUDITORIA DE OUTUBRO — 6 AUDITORES, SÓ LEITURA (26/10/2026)

Seis especialistas varreram o CAIXAOS em paralelo, **sem Write, sem Edit, sem rodar nada**.
Nenhuma linha de código, dado ou configuração foi alterada por esta auditoria.

> ⚠️ **NOTA DE MÉTODO, declarada antes dos números.** Os 6 arquivos de agente nasceram
> em `.claude/agents/*.md` com `tools: Read, Grep, Glob` — incapazes de escrever por
> construção. **Mas o registry de agentes é lido na SUBIDA da sessão**, então eles ainda
> não eram reconhecíveis como `subagent_type` nesta rodada: os 6 rodaram via `Explore`
> lendo a própria definição, com Bash **proibido por instrução, não por ausência de
> ferramenta**. Os `.md` ficam no repo e valem no próximo `/clear` — aí a incapacidade
> volta a ser física.

---

## AS 6 NOTAS

| área | nota | a frase que resume |
|---|---|---|
| **admin / SaaS** | **3/10** | o esqueleto é bom e **a cobrança não corta nada** |
| **produto / interface** | **4/10** | a CARA v1.2 alcançou **11 de 169 telas** — e 3 números mentem |
| **arquitetura / escala** | **6,5/10** | disciplina acima do mercado, presa em 3 coisas de infra |
| **performance** | **6/10** | sobrou um N+1 de **escrita** no caminho diário da cozinha |
| **financeiro / ledger** | **7/10** | onde existe juiz, fecha com rigor raro — o andar **fiscal** não tem vigia |
| **segurança** | **7/10** | **não vaza entre clientes**; os furos são de papel, rastro e abuso de custo |

**Média 5,6.** A dispersão é o retrato honesto da casa: **o que foi construído com as 3
camadas (ledger, estoque, produção, vendas) está em 7; o que nunca ganhou invariante
(DRE fiscal, área do dono, cara das telas) está em 3-4.**

**A resposta que mais importava é boa:** `getAuthContext` lança 403 sem `UserCompanyRole`,
**sem fallback e sem `??`**; as 22 rotas que recebem `empresaId` do cliente passam o valor
pelo guard antes de usar; nas rotas por id o `companyId` é **derivado do registro**,
incluindo o caso da conta a pagar que nasce sem banco. **Nenhum caminho de leitura
cross-tenant foi encontrado.**

---

## OS 10 ACHADOS MAIS GRAVES DO SISTEMA INTEIRO

Ordenados por gravidade, cruzando as áreas. **"Cruzado"** marca o que mais de um auditor
bateu de forma independente — é o sinal mais forte que esta auditoria produziu.

### 1. ⛔⛔⛔ NÃO EXISTE REVOGAÇÃO DE ACESSO EM TEMPO REAL — e são TRÊS caminhos, uma causa
**Cruzado: admin-saas + segurança.** O JWT é a única verdade por **24h** (`lib/auth.ts:32`)
e **não há `jti` nem `tokenVersion` no schema** (grep: 0). Daí saem três furos que parecem
distintos e são o mesmo:
- **inadimplência não corta nada** — o webhook grava `PAST_DUE`
  (`app/api/webhooks/asaas/route.ts:200-203`) e o único gate dispara em `EXPIRED`
  (`proxy.ts:261`). `PAST_DUE ≠ EXPIRED` → **o cliente que para de pagar mantém acesso
  total, pra sempre**. O próprio código confessa: *"corte só em 3D"* (`lib/asaas/types.ts:50`);
- **o gate lê um SNAPSHOT do JWT**, não o banco — `subscriptionExpired` é assinado no login,
  então mesmo cortando há **até 24h de acesso grátis por token**;
- **logout só apaga o cookie** (`app/api/auth/logout/route.ts:13`) e o **reset de senha pelo
  admin não mata sessão em curso** (`admin/clientes/[userId]/reset-password:80`) — token
  roubado vale 24h depois do logout.

⭐ **Um mecanismo fecha os três.** Enquanto não existir, *"derrubar sessão"* não existe no
produto.

### 2. ⛔⛔⛔ `alerts/send-now` — QUALQUER CLIENTE LOGADO DISPARA E-MAIL PRA PLATAFORMA INTEIRA
**Segurança, e é o ÚNICO achado de efeito cross-tenant.** `app/api/alerts/send-now/route.ts:32`
diz, no próprio comentário, *"aceita qualquer user logado (smoke test)"* — e
`lib/email/alerts-job.ts:69` varre **`prisma.user.findMany()` da plataforma** e manda e-mail.
⚠️ O isolamento de **leitura** está provado; este é furo de **ação**, e ele alcança todos os
clientes a partir da sessão de um só. **Quick win do auditor: exigir `getAdminSession`, 3 linhas.**

### 3. ⛔⛔⛔ ZERO BACKUP AGENDADO — O PRIMEIRO INCIDENTE DE DISCO É PERDA TOTAL
**Arquitetura.** `ls scripts/ | grep backup` = **0**. Todo `pg_dump` é manual, feito à mão
antes de migration (o doc registra dezenas deles). **O Postgres roda na MESMA máquina do
app**, sem réplica, e o build já consome **3,5 GB de 3,9**. ⚠️ Cruza com a nota do
admin-saas: não há como *"operar como SaaS de verdade"* sem isso. **Quick win: `pg_dump -Fc`
diário no crontab com retenção de 7 dias — o comando já está no runbook, falta a linha.**

### 4. ⛔⛔⛔ TRÊS CARDS DE DINHEIRO SOMANDO A PÁGINA, NÃO O AGREGADO
**Produto — e a casa JÁ CUROU esta classe uma vez.**
```
app/(dashboard)/transacoes/page.tsx:299-300          .reduce sobre as 50 carregadas (limit: 50)
empresas/[id]/contas/[contaId]/transacoes:154-155    idem, extrato por conta
empresas/[id]/cartoes/[cardId]:333-334,696-697       soma própria em vez de faturaNetTotal
```
Em período com 2+ páginas os cards **mentem** e ninguém desconfia. ⚠️ É exatamente a classe
curada na Contas a Pagar em **25/10** (*"a barra escondia 27 contas e R$ 48.165,66"*), e o
terceiro é o **7º call-site da REGRA 6**, que declara `faturaNetTotal` dono ÚNICO desde 14/08.
**Quick win: trocar pelos agregados do servidor — 3 linhas, mata 3 números que mentem.**

### 5. ⛔⛔⛔ O ANDAR QUE O CONTADOR ASSINA É O ÚNICO SEM VIGIA
**Financeiro.** O juiz noturno tem **40+ códigos** (I/V/K/KP/B/E/P/C/F/M/N/D/R/E17) e
**ZERO sobre lucro**: nenhum invariante compara o resultado contábil com as transações, nem
o DRE com o Fluxo de Caixa, nem a apuração com o DRE (`scripts/cron-judge.ts:25`).
`Σ(grupos) == lucroLíquido` só existe em teste de unidade, **nunca contra o dado real**.
⚠️ **E há uma SEGUNDA derivação de DRE esperando alguém religar:** `lib/dashboard/queries.ts:276-300`
monta o DRE **sem `lifecycle:'EFFECTED'`, sem `reconciledWithId:null` e sem `isCardPayment`
no select** — payable em aberto, ex-payable conciliada e pagamento de fatura contariam como
despesa. **As outras 3 queries do MESMO arquivo têm os filtros.** Hoje é código órfão (0
caller vivo, provado), e **isso é pior que lixo: é a segunda resposta esperando alguém religar.**

### 6. ⛔⛔⛔ A RÉGUA MULTI-TENANT DA CONTA A PAGAR ESTÁ COPIADA EM 30 ARQUIVOS — E AS CÓPIAS DIVERGEM
**Cruzado: arquitetura + performance + financeiro (via RBA).** `ramosDaEmpresaEmContaAPagar`
(`lib/contas-pagar/list-filters.ts:182`) tem **3 consumidores** e **30 arquivos / 33
ocorrências reescrevem o OR à mão** — e, medido, **6 de 7 NÃO têm o ramo `employee`**:
`lib/email/alerts-job.ts:98` · `lib/dashboard/queries-previsto.ts:41` ·
`app/api/dashboard/badges/route.ts:60` · `lib/tax/calculate-rba.ts` ·
`lib/conciliacao/fila-de-conciliacao.ts` · `lib/lifecycle/orphan-monitor.ts` (este sem
`customer` também).

⛔ **Efeito:** conta a pagar presa só por `employeeId` (folha) é **INVISÍVEL** no e-mail
diário de vencimento, no badge, no fluxo previsto e no RBA.

⚠️⚠️ **A casa já registra 4 ocorrências desta CLASSE** (F1 da ponte 24/08 · selo dos custos
fixos 06/10 · a mesa ① 15/10 · `preview-queries` 16/10, que escondia R$ 135.777,81) — **o
que ela NÃO sabia é que existem 30 cópias e que 6 delas estão quebradas de um jeito
diferente.** E a performance acrescenta o segundo golpe: `transactions` tem 23 índices e
**nenhum em `supplierId`, `employeeId`, `categoryId`** — exatamente os ramos desse OR, na
tabela mais quente, pagos pelos **12 agregados** da rota de Contas a Pagar.

### 7. ⛔⛔ TRÊS ROTAS DE TRANSFERÊNCIA ACEITAM SÓ MEMBERSHIP — O OPERADOR DE ESTOQUE MEXE EM DINHEIRO
**Segurança.** `transferencias/pair-pendentes/route.ts:28` · `transferencias/from-ofx/route.ts:30`
· `transferencias/[groupId]` DELETE — as três **deletam e recriam transação** e **revertem
saldo** exigindo apenas que a pessoa seja da empresa, sem `requirePermission`.
⚠️ É a mesma fronteira que **30/08** fechou em fluxo-de-caixa, vendas e juiz (*"o menu esconde
e a rota nega"*) **e que ficou aberta aqui**. **Quick win: `ctx.requirePermission('transaction.update')`,
1 linha cada.** ⭐ E o guard estrutural que o estoque tem desde 24/08 (`toda-rota-tem-trava`,
54 testes) **não tem irmão no financeiro**: escrita que se contenta com membership deveria ser
vermelha.

### 8. ⛔⛔ O LUCRO REAL É DECIDIDO POR DOIS NÚMEROS QUE NINGUÉM DERIVA
**Financeiro.**
- `lib/tax/real-engine.ts:15` — a apuração usa **`margemRealPercent` DIGITADO** pelo cliente;
  **ela não lê o DRE.** A lição principal×despesa mora só em `lib/dre/calculator.ts:186-196`
  e **não alcança a apuração**, porque a apuração não tem despesa nenhuma. **Não há como
  provar a lição ali.**
- `lib/tax/detect-compras.ts:13-19` — `COMPRAS_DREGROUPS` lista **5 dreGroups que NÃO
  EXISTEM** (`CUSTO_MERCADORIA`, `CUSTO_INSUMO`, `CUSTO_PRODUCAO`, `CUSTOS_OPERACIONAIS`,
  `DESPESAS_INSUMOS`) e o real (`CUSTO_PRODUTO_VENDIDO`) **ficou fora**. O ramo estrutural é
  **no-op**: o crédito **PIS/COFINS (9,25% das compras)** é decidido **só por keyword de
  NOME** (linha 21-43) — a régua que **24/09** proibiu por escrito. ⭐ **Quick win: uma linha
  no set, com teste que valide cada entrada contra `DREGroup`** — senão o vocabulário morto volta.

### 9. ⛔⛔ CONTAR 50 ITENS LEVA ~34 SEGUNDOS — NO CELULAR, DENTRO DA CÂMARA FRIA
**Performance.** `recomputeSaldoCache` (`lib/stock/saldo.ts`) faz **1 upsert por item,
sequencial** — e `saldosDaEmpresa` devolve **247 itens** (medido 13/10). ⛔
`lib/stock/contagem.ts:527` o chama **por LINHA CONTADA** → ~**675 ms por toque**.
⚠️ Cruza com a feature de **05/10** (*"a contagem é a âncora, ela sempre entra"*): a régua está
certa e o gesto é lento justamente onde o dono opera de pé, com frio, no celular.
⭐ **Quick win: `deleteMany` + `createMany` numa consulta, e chamar no `finalizarContagem`
em vez de por linha** — a invariante E1 continua valendo, porque **o saldo da tela é
derivado, não o cache**.

### 10. ⛔⛔ O PLANO NÃO LIMITA NADA E O PAINEL DO DONO NÃO VÊ ASSINATURA
**Admin-SaaS — por isso a nota 3.** `lib/subscription/access.ts:14,31`
(`getEmpresaLimit`/`canAccessFeature`) tem **ZERO consumidores**, e o cabeçalho do arquivo
**confessa**: *"NÃO bloqueia nada hoje"* → o plano `início` (1 empresa) **não impede criar 50**,
e **o de R$ 29,99 entrega o de R$ 349,99** — sem motivo pra upgrade. ⚠️ E o painel do dono
**não vê plano**: grep de `subscription|plano|planId|trial` nas 2 telas de cliente + 2 rotas →
**zero**; `MRR` é **`"R$ 0,00"` hardcoded** (`app/admin/dashboard/page.tsx:82-84`, com
`hint="Onda 4"`); não há **suspender/reativar** (só *excluir* com cascade); não há **dunning**.
⛔ **Hoje cada exceção é `psql` na mão — escala a ~5 clientes, não a 100.**

---

### MENÇÕES HONROSAS (fora do top 10, mas medidas)

| # | achado | área |
|---|---|---|
| 11 | **~20 telas com `fetch` e NENHUM estado de ERRO** — falha de rede vira **lista vazia**, o *"erro disfarçado de vazio"* que esta casa já pagou 4× | produto |
| 12 | **12 tabelas sem `overflow-x-auto` e sem composição mobile** (REGRA 12) — o padrão certo já existe no repo | produto |
| 13 | **4 portas gravam fatura com `totalAmount: { increment }`** (soma incremental **sem chave**) — a lei de 30/09 (*saldo derivado*) não chegou ao cartão | financeiro |
| 14 | **`stock_movement` sem índice com `dataMovimento`**, que aparece em 7 filtros de faixa + 10 `orderBy` | performance |
| 15 | **`PrismaClient` sem `connection_limit`** → pool = 5 em 2 vCPU, com o badge de 1,3 s a cada 60 s por aba | arquitetura |
| 16 | **15 rotas com upload e ZERO rate limit · 10 sem teto de TAMANHO** — a mais barata de abusar é `importar-ofx` | segurança |
| 17 | **`.gitignore` cobre `.env` e NÃO cobre `*.pfx`/`*.p12`/`*.pem`** — e o certificado A1 é upload de rotina (conferido: nenhum rastreado hoje) | segurança |
| 18 | **8 caminhos de ESCRITA de estoque com `new Date("…T12:00:00")` SEM `Z`** — a forma que produziu o ano 202 e o `-001899` | financeiro |
| 19 | **`contas-bancarias` faz ~28 consultas quase todas SEQUENCIAIS** (2 laços por conta) | performance |
| 20 | **`select-and-redirect/route.ts:32` seta `current_empresa_id` sem sessão e sem checar posse** — não vaza (as rotas revalidam), mas é defesa em profundidade quebrada | arquitetura |

---

## A CASA JÁ SABIA × ACHADO NOVO

### ✅ A CASA JÁ SABIA — débito registrado no CLAUDE.md

| débito | onde está escrito | o que a auditoria acrescentou |
|---|---|---|
| **Asaas em sandbox** | `docs/sprints/PAGAMENTO-RETOMAR-AQUI.md` | é o **item 1 do que impede faturar** |
| **"16 rotas de dinheiro sem rastro"** | 20/10 | ⚠️ **o número era menor que a realidade: medido, são 24 de 36** (régua estreita) / 42 de 84 (larga) |
| **Float em todo dinheiro** | 29/09 | ⚠️ nunca como invariante global: **as Σ fecham por TOLERÂNCIA (0,01/0,02), não por exatidão** |
| **~500 grep-guards** | 10/08 | o do DRE (`coerencia-filtros`) é **grep em 10 de 14 casos** e lê **só a rota** |
| **A cicatriz da data sem `Z`** | 14/09 · 17/10 · 18/10 (ano negativo) | ⚠️ a pista *"terceiro caminho?"* de 18/10 fica **NOMEADA**: 8 caminhos de escrita + 3 de janela |
| **`rawOfxBlob` sem expurgo** | 13/08 (política de 12 meses escrita) | **0 chamador de purge** — a política segue escrita e não construída |
| **Schedulers in-process sem lock** | comentário em `recurrence/scheduler.ts:8` | deploy no horário = **job não roda e nada avisa** |
| **`radar-tokens.ts` com hex cravado** | 20/09 | são **22 hex**, e 3 telas do estoque são **governadas por mock que trava hex, não token** |
| **"As telas antigas fora do padrão"** | 14/10, deferido pra Fase 2 | ⚠️ **o TAMANHO nunca foi medido: 158 de 169 telas** |
| **`dedup` de fatura por `contentHash`** | 18/08 | trocar de parser muda a descrição → **a mesma fatura entra 2×** |
| **`cascata-de-custo.ts` com o `: 0`** | 15/10 | segue como custo de saída na ferramenta de cirurgia |
| **`STOCK_CERT_ENC_KEY` no `.env`** | 19/08 | o degrau é KMS/Vault, com chave por empresa |
| **badge 1,3 s · RTT 143 ms (nyc1)** | 11/09 · 28/09 | ⭐ e a lição que fica: **com 143 ms de RTT, reduzir round-trips vale mais que otimizar SQL** |
| **`pg_stat_statements` não instalado** | 28/09 | sem ele, *"a rota está lenta"* **nunca aponta QUAL consulta** |
| **A classe do `bankAccount.companyId`** | 4 ocorrências (24/08 · 06/10 · 15/10 · 16/10) | ⚠️ ver achado **#6** — **30 cópias, 6 divergentes** |
| **CMV por COMPRA, não por consumo** | Fase 4 do estoque | o DRE só fica honesto com a competência |
| **A bomba do ano negativo** | 18/10 | segue aberta, com o rastro colhido |

### 🆕 ACHADO NOVO

**Gravíssimos (os 10 acima):** inadimplência não corta · gate por snapshot de JWT · logout
sem revogação · `alerts/send-now` cross-tenant · zero backup agendado · os 3 `.reduce` de
dinheiro · DRE sem invariante · a 2ª derivação órfã de DRE · as 30 cópias divergentes da
régua multi-tenant · as 3 rotas de transferência só com membership · `margemRealPercent`
digitado · os 5 dreGroups inexistentes do PIS/COFINS · `recomputeSaldoCache` por linha
contada · limites de plano com zero consumidores · painel sem assinatura · MRR hardcoded.

**Médios:** sem índice em `supplierId`/`employeeId`/`categoryId`/`paymentDate`/`dataMovimento`
· pool de 5 · 4 portas com `increment` na fatura · ~20 telas sem estado de erro · 12 tabelas
sem `overflow-x-auto` · 15 uploads sem rate limit (10 sem teto) · `.gitignore` sem
`*.pfx`/`*.pem` · `select-and-redirect` sem posse · `contas-bancarias` com 28 sequenciais ·
`ler-conferencia` lendo o histórico INTEIRO da conta · `build-categorize-plan` com ~218
consultas em 109 pendentes · `recharts` estático no maior chunk da casa (1.261 KB) ·
`rbac` com `include` de 3 níveis em **toda** request · sem suspender/reativar · sem dunning
· sem impersonação · duas tabelas de preço divergentes (código **29,99–349,99** × CLAUDE.md
**149–999**, **e nenhuma no banco**) · `"Atrasadas"` × `vencidasOnly` na mesma tela · 158
telas fora de qualquer verificação de contraste.

**⚠️ E um alerta que nenhum auditor pôde medir (sem rede autorizada):** o admin só abre em
host `admin.*` (`lib/middleware/subdomain.ts:40`, 404 por outros hosts) e o CLAUDE.md
registra prod acessado por **`http://198.211.103.10`, sem DNS**. **Se `admin.caixaos.com.br`
não resolver, a área do dono responde 404 em produção hoje.** É pergunta medível, não
afirmação.

---

## O QUE CADA AUDITOR DECLAROU NÃO TER MEDIDO

⭐ Esta seção existe porque **os seis declararam os próprios limites sem ser pedido** — é o
que separa relatório de opinião.

- **segurança** — varreu **405** `route.ts` por grep; **~40 lidas em detalhe**. *"Não
  extrapolei o comportamento das 365 restantes."* E **descartou 2 falsos positivos próprios**
  ao ler o código (`conciliacao/caixa` checa com `hasPermission`, não `requirePermission`;
  `pontes/[id]/spend` tem ownership dentro da lib) — *grep de nome de função não distingue
  "não checa" de "checa com outro nome"*. **Zero segredo transcrito, zero CPF/CNPJ reproduzido.**
- **performance** — **não mediu p95**. Tudo é estimativa do código, com a unidade de
  round-trip que a própria casa mediu (**2,7 ms/consulta**, dos 4.909 ms ÷ 1.786 de 28/09).
- **financeiro** — **não mediu prod**: os R$ dos achados #3, #5 e #6 **não estão
  quantificados**. ⭐ E provou que o #6 é **código ÓRFÃO** (0 caller vivo) antes de reportar —
  *"se eu tivesse parado no grep do select, teria reportado como incêndio"*. ⚠️ O primeiro
  grep de órfãos dele **saiu vazio por erro de quoting em zsh**, e **vazio é indistinguível de
  "não tem"**: refez com aspas antes de concluir.
- **produto** — **sem navegador: não conferiu contraste real nem alvo de toque.** A varredura
  L7 da casa (`lib/ui/varredura-l7.ts`) **só alcança quem usa token**, então as 158 telas
  claras estão **fora de qualquer verificação** — *"isso é ponto cego, não aprovação"*.
- **arquitetura** — dos **219** hits brutos de `for-await`, quase todos são escrita sequencial
  em `$transaction` ou o padrão BOM *"uma consulta pelos ids"*; **só 4 em caminho vivo de
  leitura**. Das **405** rotas, 45 sem o grep de auth; inspecionadas, **sobra 1 real**.
- **admin-saas** — entregou **inventário antes do julgamento** e disse **onde procurou** quando
  algo não existe (grep `impersonat|SUPER_ADMIN|superAdmin` → zero). ⚠️ *"Hoje não dá pra
  calcular churn nem com SQL: não há histórico de plano/preço, só o estado atual."*

---

## E O QUE A AUDITORIA ACHOU DE FORTE

Registrado porque uma auditoria que só lista defeito mente sobre o sistema.

- **O isolamento multi-tenant é por CONSTRUÇÃO, não por disciplina** — `getAuthContext` lança
  403 sem papel, sem fallback e sem `??`; as rotas por id derivam o `companyId` do registro.
- **273 `@@index`** no schema; todo `stock_*` com `[companyId, …]`.
- **Onde existe juiz, o dinheiro fecha com rigor raro** — saldo (I9), fatura (K1/KP1), parcela
  (I1/I5/I8), estoque (E1/E2/E16), venda (V1-V6), LEDGERBAL (B1/B2), todos rodando de
  madrugada **contra o banco inteiro**, cada um com red-then-green.
- **O admin é isolado de verdade** — JWT e cookie próprios, **404 por outro host**, com testes
  dedicados; cupons é a parte mais madura do módulo (3 tipos, pause/resume, snapshot de
  auditoria, `@@unique(couponId,userId)`, 6 arquivos de teste).
- **O gate de assinatura cobre página E API** (403 `SUBSCRIPTION_EXPIRED`) — **não é burlável
  pela API**; o problema dele é a fonte (snapshot), não o alcance.
- **Trial on-read sem cron** (`computeEffectiveStatus`) — bom desenho: não existe job que possa
  falhar em silêncio.
- **O self-service de onboarding já funciona** e é o ponto mais forte do módulo do dono — o
  gargalo é cobrança, não entrada de cliente.
- **Rate limit de login bem feito** — backoff 0/0/0/30/60/180/300 + guarda de IP 20/15min +
  fail-open.
- **Guards estruturais que já pagam aluguel** — `toda-rota-tem-trava` (54 testes),
  `migration-isolation`, `espiao-de-consultas` (contagem de consultas, não milissegundo),
  R1/R2 noturno, série de performance por deploy.
- **Onde a fundação visual chegou, chegou bem** — 3/3 em margem · custos-fixos · vendas,
  5/5 em produção.

---

## AS 3 COISAS QUE EU FARIA PRIMEIRO

Não é plano de sprint — é a leitura de risco×custo cruzando os seis relatórios.

1. **Backup diário + 2 índices + pool** *(horas, risco zero, migration aditiva pura)* — é o
   único grupo em que **não fazer** tem custo irreversível, e os dois índices aceleram Contas
   a Pagar, aging, badge, DRE e 10 relatórios de uma vez.
2. **Revogação de sessão (`tokenVersion`)** *(dias)* — fecha **três** achados de uma vez
   (#1), e sem ela o corte por inadimplência **não tem como funcionar** mesmo depois de
   consertado.
3. **Os 3 `.reduce` de dinheiro + a régua multi-tenant única com guard** *(dias)* — são os dois
   lugares onde o sistema **mostra número errado** ou **esconde dívida** na cara do dono, e os
   dois têm cura conhecida e já escrita na casa.

---

*Auditoria read-only. Nenhuma linha de código, dado ou configuração foi alterada.*

⚠️ **Os 6 perfis de auditor vivem em `.claude/agents/` e NÃO são versionados** — `.claude/`
está no `.gitignore:43`. Eles existem **só nesta máquina** e podem ser re-rodados a qualquer
momento depois de um `/clear`; em outro clone do repo, **não existem**. Se a intenção for que
a casa inteira herde os auditores, o caminho é tirar `.claude/agents/` do ignore (decisão do
dono — hoje o ignore protege `.claude/settings.local.json` e afins junto).
