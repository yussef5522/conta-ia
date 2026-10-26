# 🏛 A ÁREA ADMIN COMO PRODUTO — auditoria tela por tela

> **Missão:** avaliar a área administrativa do CAIXAOS como **produto à venda** — o painel de
> quem opera o SaaS com milhares de assinantes.
>
> **Data:** 26/10/2026 · **Método:** SÓ LEITURA (zero escrita fora deste arquivo, prod intocada)
> · varredura em subagente + medição própria em produção.
>
> ⛔ **Este relatório fala do PRODUTO, nunca do cliente.** Nenhum nome, valor ou operação da
> empresa que vive no banco aparece aqui — os exemplos dizem *"um assinante"*.

---

## NOTA GERAL DA ÁREA: **4 / 10**

**A frase que resume:** *gestão de assinante e cupom está sólida; o resto de operar um SaaS —
assinatura, cobrança, MRR, impersonar, suspender — não existe.*

⚠️ **Duas notas divergentes, e a diferença é informativa:** a varredura de telas deu **4/10**
(ela pesa o que ESTÁ construído: 6 telas completas, com RBAC e re-auth) e a varredura de
jornadas deu **2/10** (ela pesa o que FALTA pra faturar). ⭐ **A segunda nota caiu junto com a
premissa dela** — ver a correção abaixo. **A nota que fica é 4/10.**

---

## ⛔⛔⛔ CORREÇÃO DE PREMISSA — O CORTE DE INADIMPLÊNCIA **EXISTE**

A varredura de jornadas concluiu, por escrito, que *"não há `middleware.ts` na raiz"* e que
*"nada corta acesso de inadimplente"*. **As duas afirmações são FALSAS, e a causa é uma só: o
middleware desta casa se chama `proxy.ts`.**

```
ls middleware.ts  →  No such file or directory
ls proxy.ts       →  12.869 bytes   ⭐ o middleware mora aqui (renomeado)
```

**E ele TEM o gate, com allowlist explícita** (`proxy.ts:259-283`):

```
if (payload.subscriptionExpired) {
  EXPIRED_ALLOWED = ['/assinar', '/api/subscription', '/api/auth/logout', '/api/auth/me']
  → fora da lista: página redireciona pra /assinar · API devolve 403 SUBSCRIPTION_EXPIRED
}
```

⭐ A régua é **negativa por desenho** (allowlist de 4 caminhos, tudo o mais barrado) — o padrão
certo. ⚠️ **O que de fato não existe é o enforcement de LIMITE por plano** (ver jornada *f*) —
e é a isso que o comentário de `lib/subscription/access.ts` se refere.

⚠️⚠️ **A lição é de método, e é a 2ª vez nesta casa:** a varredura rodou **sem Grep/Glob** e
provou ausência por `Read` em caminho **inferido**. ***Arquivo não encontrado num caminho que eu
chutei não é prova de ausência*** — é a família do zero silencioso (REGRA 8b).

---

## 1 · O MAPA COMPLETO — 8 telas · 12 arquivos de rota · 16 handlers

**Isolamento por HOST, não por rota:** `admin.*` reescreve `/x` → `/admin/x`; `/admin/*` por
qualquer outro host devolve **404** (não 403 — pra não revelar que o painel existe).
Cookie/JWT próprios (`admin_session`, secret separado, `scope: 'admin-session'`, TTL 24h).

| # | tela | o que faz / mostra | estado | nota |
|---|---|---|---|---|
| 1 | `/admin` | redirect pro dashboard | — | — |
| 2 | `/admin/login` | e-mail + senha, rate limit, erro genérico | **COMPLETA** | **8** |
| 3 | `/admin/dashboard` | contagem de usuários e empresas · cadastros 7d · últimos 10 | **ESQUELETO** | **3** |
| 4 | `/admin/clientes` | lista, busca por nome/e-mail, paginação 50 | **COMPLETA** | **8** |
| 5 | `/admin/clientes/[userId]` | detalhe + 3 ações (reset senha, trocar e-mail, excluir) | **COMPLETA** | **9** |
| 6 | `/admin/cupons` | lista de cupons e resgates | **COMPLETA** | **7** |
| 7 | `/admin/cupons/novo` | criar cupom | **COMPLETA** | **8** |
| 8 | `/admin/cupons/[id]` | detalhe, pausar, retomar, excluir | **COMPLETA** | **8** |
| 9 | `/admin/metricas` | **o arquivo não existe** — item de menu com selo *Soon* e `href='#'` | **VAZIA** | **0** |

**Por que o dashboard é ESQUELETO (nota 3), e não "simples":** o card **MRR é a string
`"R$ 0,00"` cravada no JSX** (`app/admin/dashboard/page.tsx:82-85`), com o hint
*"Onda 4 — em desenvolvimento"* e um `TODO` na linha 196. A lista de últimos cadastros tem
`take: 10` fixo, sem filtro, sem paginação, sem nenhuma ação.

**Por que o detalhe do cliente é a melhor tela (nota 9):** o reset de senha revela a senha
temporária **uma vez** com auto-cópia; trocar e-mail valida; e o **excluir é OWNER-only exigindo
digitar o e-mail do assinante + a senha do próprio gerenciador** (re-auth). É o padrão de um
gesto destrutivo bem feito.

### As 2 rotas SEM TELA (medido por grep com o caminho resolvido)

```
/api/admin/asaas/health   → 0 caller   ⛔ a ÚNICA coisa de pagamento na área, e é inalcançável
/api/admin/me             → 0 caller   ⛔ sem tela (o proxy só a menciona num comentário)
/api/admin/clientes       → 3 callers  ·  /api/admin/coupons → 3  ·  login/logout → 1 cada
```

⚠️ **E o `asaas/health` é bem construído:** `GET`, **OWNER-only** (`FORBIDDEN_RBAC`), e o
comentário diz *"result NUNCA contém a apiKey"*. ⛔ **É a 13ª volta da "porta sem maçaneta"
desta casa** — o motor está em prod, correto, e o dono não tem por onde clicar.

⚠️ **Correção do inventário da varredura:** ela reportou *"7 telas e 15 handlers em 8 arquivos"*;
a varredura de disco dá **8 `page.tsx`, 12 arquivos de rota, 16 handlers** — ela perdeu o
`asaas/health` por estar fora do menu e sem Grep.

### ⛔ RBAC raso — e o buraco está nas duas ações mais sensíveis

```
excluir cliente     → OWNER-only + re-auth (e-mail digitado + senha)   ⭐ certo
resetar senha       → OPERADOR                                          ⛔
trocar e-mail       → OPERADOR                                          ⛔
asaas/health        → OWNER-only                                        ⭐ certo
```

⚠️ **Resetar senha e trocar e-mail de qualquer assinante são, juntos, um take-over de conta** —
e hoje um OPERADOR faz os dois. **Só o DELETE pede OWNER.**

### Hardcoded e placeholders

- o **MRR** `"R$ 0,00"` no JSX · o `take: 10` · o `comingSoon: true` com `href='#'`
- ⛔ **o rodapé da sidebar escreve a string literal `OPERADOR`** (`admin-sidebar.tsx:132`) e o
  componente só recebe `{ gerenciadorName }` — **um OWNER se vê como OPERADOR**
- ⛔ a **coluna "Status" da lista de clientes é `mustChangePassword`**, não assinatura — um
  assinante com acesso **expirado** aparece em verde *"Ativo"*
- **cor hex cravada em toda a área** (não usa os tokens da casa, então ela não tem tema escuro)
- ⚠️ **dois escapes por env que afrouxam o isolamento:** `ADMIN_COOKIE_DOMAIN='off'` e
  `COOKIE_SECURE='false'` (`lib/admin-auth/jwt.ts:88,92`)

### ⛔ A auditoria é gravada e NUNCA lida

`gerenciadorAuditLog` registra ação/entidade/metadata/IP/user-agent em **toda escrita** — e
**nenhuma tela leia**. É a classe da *"lixeira invisível"* de 20/09: o registro existe, ninguém
desenha. ⚠️ E **nenhum GET grava rastro**: não há histórico de quem OLHOU o quê.

---

## 2 · `admin.caixaos.com.br` RESOLVE E RESPONDE? — **SIM, PROVADO**

⭐⭐ **E isto DERRUBA a pergunta aberta que eu mesmo escrevi na auditoria de ontem.** Ela
nasceu da nota de 28/08 (*"`contaia.com.br` não tem DNS — prod é acessado por IP"*), que
**segue verdadeira só pra `contaia.com.br`** (medido: `A` vazio). **O domínio vivo é
`caixaos.com.br`**, com zona, DNS e TLS completos.

```
DNS       admin.caixaos.com.br → A 198.211.103.10   (o IP do servidor)
          caixaos.com.br e www.* também · NS a.sec.dns.br / b.sec.dns.br · SOA existe
TLS       CN=caixaos.com.br · SAN inclui admin.caixaos.com.br
          Let's Encrypt (YE2) · expira 29/12/2026 · "SSL certificate verify ok"
          certbot.timer: enabled + active   ⭐ renovação automática de pé

DE FORA   https://admin.caixaos.com.br/        → 307 → /admin/dashboard
          https://admin.caixaos.com.br/login   → 200
          http://admin.caixaos.com.br/         → 301 → https
          https://caixaos.com.br/              → 301 → app.caixaos.com.br

DE DENTRO (127.0.0.1:3001 + Host header · servidor contaia-prod · pm_cwd /opt/conta-ia)
          Host=admin.*  /=307  /login=200  /admin/dashboard=307
          Host=app.*    /=200  /login=200  /admin/dashboard=404

⭐ ISOLAMENTO FUNCIONANDO
          app.caixaos.com.br/admin/dashboard → 404
          IP cru /admin/dashboard            → 404

nginx     vhost próprio (caixaos.conf:35) · proxy_pass localhost:3001 · listen 443 ssl http2
```

**A área do dono NÃO está 404 em produção.** O desenho de isolamento por host está correto e
provado nas duas direções.

---

## 3 · A RÉGUA DOS GIGANTES — jornada por jornada

### (a) ASSINANTES

| | |
|---|---|
| listar / buscar usuários | ⭐ **EXISTE** — busca por nome/e-mail, paginação 50 |
| listar **empresas** (os CNPJs) | ⛔ **NÃO EXISTE** — não há tela de empresas |
| detalhe com plano, status, uso, saúde | ⛔ **NÃO EXISTE** — a query é `user.findUnique` **sem nenhum campo de assinatura**; os 4 cards são Empresas / Cupons / OFX / Agendamentos |
| criar assinante | ⛔ **NÃO EXISTE** |
| **suspender / reativar** | ⛔ **NÃO EXISTE** — o schema confirma que foi adiado (`CLIENT_SUSPEND (Onda 2+)`) |
| excluir | ⭐ **EXISTE** — OWNER-only, com re-auth |

⚠️ **A única ação destrutiva disponível é a IRREVERSÍVEL.** Pra um assinante que atrasou, o
painel oferece **excluir** e não oferece **suspender** — exatamente o contrário do que se quer.

### (b) PLANOS & COBRANÇA — **a jornada mais vazia**

| | |
|---|---|
| catálogo de planos | ⚠️ **EXISTE SÓ EM CÓDIGO** (`lib/planos/config.ts`): 4 planos com `precoMensal` 29,99 / 89,99 / 149,99 / 349,99 e `precoAnual` derivado. **Nenhuma tabela de plano no banco** |
| assinatura por cliente | ⚠️ **EXISTE no schema** (`userId @unique`, `planId`, `status`, `trialEndsAt`, `currentPeriodEnd`, `gateway*`) — e **ZERO tela no admin** |
| mensalidades / faturas | ⛔ **NÃO EXISTE** — não há tabela de fatura de assinatura |
| status de pagamento | ⛔ **NÃO EXISTE** no admin |
| **inadimplência → corte** | ⭐ **EXISTE** — `proxy.ts:259`, allowlist de 4 caminhos (ver a correção no topo) |
| trial | ⚠️ **ESQUELETO** — nasce no cadastro, expira **lazy na leitura**, sem cron e sem tela |
| upgrade / downgrade | ⛔ **NÃO EXISTE** — e **não há log de troca de plano** |

⛔⛔ **E O PREÇO DIVERGE EM TRÊS LUGARES:**

```
lib/planos/config.ts   4 planos · 29,99 / 89,99 / 149,99 / 349,99
CLAUDE.md              3 planos · Starter R$149 / Business R$399 / Enterprise R$999
access.ts:14-28        getEmpresaLimit duplica os limites por plano
```

### (c) ONBOARDING

| | |
|---|---|
| o admin cria / convida empresa nova | ⛔ **NÃO EXISTE** — nada na sidebar, nada na lista |
| auto-serviço pelo assinante | ⭐ **EXISTE** (cadastro → `POST /api/empresas`) |
| plano de contas | ⭐ **AUTOMÁTICO** (`aplicarTemplate`) — o único passo que o sistema faz sozinho |

**Quanto é manual hoje, contado:** pelo lado do **ADMIN, 0 de 5** — ele não tem como criar nada.
Pelo lado do **assinante, 4 manuais + 1 automático**: ① cadastro ② criar empresa ③ **plano de
contas (automático)** ④ contas bancárias (manual — a transação de criação da empresa não cria
nenhuma) ⑤ importação inicial de OFX (manual). Convidar equipe é um 6º.

⛔ **O gargalo comercial:** *o dono do SaaS não participa de nenhum passo* — ou o cliente se
auto-serve, ou o onboarding não acontece.

### (d) SUPORTE

| | |
|---|---|
| **impersonação** | ⛔ **NÃO EXISTE** — medido por grep com contagem explícita: **0 arquivos** mencionam `impersonat`/`loginAs`/`actAs`/`assumeUser` em `app/` e `lib/` |
| histórico de acessos do cliente | ⛔ **NÃO EXISTE** |
| canal de suporte no admin | ⛔ **NÃO EXISTE** |
| o que há | ⚠️ **reset de senha com senha temporária revelada 1×** — suporte por senha temporária, não por impersonação |

⚠️ **A consequência prática:** pra ajudar um assinante, o dono **troca a senha dele** — ou seja,
ele é **expulso da própria conta** pra que alguém olhe. Impersonação read-only com motivo
obrigatório e trilha visível é o padrão que falta.

### (e) MÉTRICAS DO NEGÓCIO

| | |
|---|---|
| tela de métricas | ⛔ **NÃO EXISTE E ESTÁ MORTA POR CONSTRUÇÃO** — `comingSoon: true` com `href='#'` e `preventDefault()`; o arquivo `app/admin/metricas/page.tsx` não existe |
| MRR | ⚠️ **ESQUELETO** — string cravada `"R$ 0,00"` |
| churn · crescimento · receita | ⛔ **NÃO EXISTE** |
| assinantes ativos | ⚠️ contagem de **usuários**, não de assinaturas ativas |

⛔⛔⛔ **MRR E CHURN NÃO SÃO CALCULÁVEIS COM O SCHEMA DE HOJE — e isso é mais grave que a tela
faltando.** Medido em produção:

```
subscriptions: ZERO colunas de valor (nada de amount/price/valor/preco)
NÃO existe tabela de plano, de preço ou de fatura de assinatura
  (as que casaram %plan%/%invoice%/%payment% são de OUTROS módulos:
   credit_card_invoices · custo_fixo_planejado · loan_installment_payments · stock_etapa_plano)
```

⭐ **Ou seja: o card `"R$ 0,00"` é honesto por FALTA DE FONTE.** Sem preço na assinatura e sem
histórico de preço, o MRR não tem de onde sair — e o churn precisa de base mensal, que também
não existe (`Subscription` é 1:1 com `User` e é **sobrescrita no lugar**, sem histórico).

**O que DÁ hoje:** nº de assinantes · nº de empresas · cadastros por período · distribuição por
`status` e `planId` (há índice) · trials vencendo (há índice em `trialEndsAt`) · **MRR
aproximado** contando ACTIVE por `planId` × o preço do código — ⚠️ sem desconto de cupom e **sem
auditoria histórica**.

**O estado real do SaaS hoje** (agregado, pela régua de produto):

```
usuários 10 · empresas (CNPJs) 5 · gerenciadores 1 · cupons 2 · resgates 1
subscriptions 7 → 3 com companyId · 4 SEM companyId
status × planId:  GRANTED/inteligencia ×4   ·   TRIAL/inteligencia ×3
TRIAL   3 com trialEndsAt · 0 com currentPeriodEnd · 0 canceladas
GRANTED 0 trial · 0 período · 0 canceladas
gateway: 0 de 7 com gatewaySubscriptionId   ·   1 de 7 com gatewayCustomerId
```

⭐ **As 7 assinaturas são todas do MESMO `planId`, nenhuma tem `currentPeriodEnd`, e NENHUMA tem
assinatura recorrente no gateway.** As 4 `GRANTED` são cortesia. **Não existe uma assinatura paga
hoje** — o que é coerente com a fase de teste, e é o número que define a ordem de construção
abaixo.

### (f) OPERAÇÃO

| | |
|---|---|
| **limites por plano** | ⚠️ **EXISTEM COMO NÚMERO, NÃO SÃO APLICADOS** |
| contador de uso | ⛔ **NÃO EXISTE** |
| avisos / comunicação em massa | ⛔ **NÃO EXISTE** (a sidebar tem 4 itens) |
| auditoria das ações do admin | ⚠️ **a GRAVAÇÃO existe, a TELA não** — *"porta sem maçaneta"* |
| gerenciar os próprios gerenciadores | ⛔ **NÃO EXISTE** |

⛔⛔ **O enforcement de limite é letra morta, e o próprio repo confessa.** `getEmpresaLimit`
(`access.ts:14`) define `empresas: 1/3/10/∞` por plano, e os únicos consumidores são:

```
lib/subscription/access.ts      (ele mesmo, nas linhas 39/41/43)
scripts/checkpoint-validation.ts:147  →  imprime literalmente:
    "POST /api/empresas  →  NÃO chama getEmpresaLimit (livre)"
```

⭐ **Está escrito num script de validação da própria casa:** criar empresa é **livre**,
independente do plano. *Campo que ninguém consome é promessa que o produto não cumpre* — e aqui
é a promessa que separa um plano de R$ 29,99 de um de R$ 349,99.

⛔ **E há só 1 gerenciador no banco, sem tela pra criar outro** — o único caminho é
`scripts/seed-gerenciador.ts`. **Bus factor 1:** se ele perder a senha, não existe segundo
caminho de acesso ao painel.

---

## 4 · OS 10 QUE FALTAM PRA OPERAR MILHARES DE ASSINANTES

*Em ordem de construção — os 5 primeiros são pré-requisito de faturar; do 6 em diante é conforto
operacional.*

### ⛔ SEM ISSO NÃO DÁ PRA COBRAR

1. **`Plan` + preço no banco, com histórico.** Hoje o preço vive em `config.ts`, duplicado em
   `access.ts` e divergente do CLAUDE.md. **É a fundação dos outros quatro** — sem preço na
   assinatura, MRR e churn não têm de onde sair.
2. **Valor na `Subscription` + `Invoice`/`Payment` por assinante**, gerados a partir do webhook.
   Hoje o webhook só deixa `WebhookEvent` com payload cru — ou seja, **pagamento não vira
   estado**.
3. **Fechar o ciclo real de cobrança (Asaas 3D).** Medido: **0 de 7** assinaturas têm recorrência
   no gateway. Pagamento em produção nunca rodou.
4. **Ficha de billing no detalhe do cliente** (plano · status · trial · próxima cobrança ·
   histórico) **+ corrigir a coluna "Status" da lista**, que hoje mostra `mustChangePassword` e
   pinta de verde quem está expirado. ⭐ O corte de acesso já existe; o que falta é o dono
   **VER** o estado antes de o cliente ligar.
5. **Suspender / reativar**, com `CLIENT_SUSPEND` no audit (já previsto no schema). **Hoje a
   única ação destrutiva é a irreversível.**

### ⭐ CONFORTO OPERACIONAL

6. **Enforcement do limite por plano + contador de uso** — o número existe e **ninguém o lê** na
   criação de empresa.
7. **Upgrade / downgrade com log de troca de plano** — pré-requisito de churn, expansion e
   contraction.
8. **Impersonação read-only, com motivo obrigatório e trilha** + **tela que LEIA o
   `GerenciadorAuditLog`** (gravado desde sempre, sem leitor). Hoje "ajudar" significa trocar a
   senha do assinante.
9. **Métricas com snapshot mensal** (MRR, churn, crescimento) — mata o `href='#'` e o
   `"R$ 0,00"` cravado. ⚠️ **Depende do item 1:** sem preço histórico, nenhuma métrica é
   auditável depois.
10. **Gerenciar gerenciadores** (hoje só por seed, 1 no banco, bus factor 1) **+ comunicação em
    massa** com os assinantes.

### Correções de minutos, à parte da lista

- a string `OPERADOR` cravada no rodapé da sidebar (um OWNER se vê como OPERADOR)
- **dar tela ao `/api/admin/asaas/health`** — está pronto, OWNER-only, e inalcançável
- os dois escapes de env que afrouxam o isolamento do cookie
- a área não usa os tokens da casa (hex cravado) → sem tema escuro

---

## O QUE ESTE RELATÓRIO **NÃO** PODE AFIRMAR

- **As ausências foram medidas com Grep e contagem explícita** (o caso da impersonação:
  `0 arquivos`). ⚠️ A varredura de jornadas rodou **sem Grep** e provou ausência por caminho
  inferido — foi assim que ela errou o `proxy.ts`. **Onde este doc diz "NÃO EXISTE", há contagem
  por trás.**
- **Nenhuma tela foi aberta com sessão de gerenciador.** O item 2 mede DNS, TLS, HTTP e
  isolamento; **a prova visual das 8 telas por dentro é do dono** (REGRA 2).
- **A nota 0-10 é julgamento meu** sobre completude como produto, não medição.

---

**⛔ ZERO ESCRITA:** nenhuma linha gravada em produção. Toda medição foi `dig`/`curl`/SSH
read-only/`psql` SELECT, com a `DATABASE_URL` nunca impressa.
