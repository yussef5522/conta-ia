# 💳 PAGAMENTO — ONDE PARAMOS (retomar aqui)

> **Status:** engine 3A + 3B + 3C **deployada em SANDBOX**. Falta ativar
> o webhook no painel Asaas e testar end-to-end. Depois, virar pra
> produção (3D — só quando decidir faturar de verdade).
>
> **Última atualização:** 02/06/2026
> **HEAD relevante:** `2a15128 merge: asaas 3C webhook (sandbox) → main`

---

## 📦 O QUE JÁ ESTÁ PRONTO E DEPLOYADO

### Sprint 3A — Fundação (✅ deployado sandbox)
- `lib/asaas/{client,config,customers,errors,health,types}.ts`
- `loadAsaasConfig` lê `ASAAS_API_KEY` + `ASAAS_ENV` (default sandbox)
- `asaasRequest` wrapper genérico com timeout + sanitização de erros
- `createOrGetCustomerForUser` idempotente
- `GET /api/admin/asaas/health` (OWNER only)
- Decisão: SEM SDK Asaas — fetch próprio (alinha com `claude-client.ts`)

### Sprint 3B — Checkout (✅ deployado sandbox)
- **Pix transparente** (`POST /api/subscription/checkout/pix`): QR + copia-cola gerados no nosso UI
- **Cartão hosted** (`POST /api/subscription/checkout/cartao`): redireciona pra sandbox.asaas.com (SAQ-A — zero byte de cartão toca nosso servidor)
- Bloqueia GRANTED + ALREADY_ACTIVE
- `User.cpfCnpj` + `Subscription.checkoutSessionId` (migration `20260601000001`)

### Sprint 3C — Webhook (✅ código deployado, falta ativar)
- `POST /api/webhooks/asaas` — autenticação por `asaas-access-token` (timingSafeEqual)
- `model WebhookEvent` com `asaasEventId @unique` (idempotência via UNIQUE + race handling P2002)
- Migration `20260612000000_asaas_3c_webhook_event` aplicada em prod (sandbox)
- 3 camadas pra identificar Subscription: externalReference → gatewaySubscriptionId → gatewayCustomerId
- Routing: PAYMENT_CONFIRMED/RECEIVED → ACTIVE, PAYMENT_OVERDUE/CHARGEBACK_REQUESTED → PAST_DUE, PAYMENT_REFUNDED/DELETED → CANCELED, outros → IGNORED
- Renovação acumulativa: `calculateNextPeriodEnd = max(now, current) + 1m/1y`
- **67 testes novos** (42 puros + 25 endpoint integration)

---

## 🛠️ O QUE FALTA FAZER (na ordem)

### 1. 🔑 Ativar o webhook no sandbox (Yussef faz manualmente)

**a) Gera token (no Mac):**
```bash
openssl rand -hex 32
```
Vai gerar 64 chars hex (`a1b2c3...`). **NÃO compartilha em chat.**

**b) Põe no `.env` do servidor:**
```bash
ssh root@198.211.103.10
nano /opt/conta-ia/.env
# adiciona no final, sem aspas, sem $, sem espaço:
ASAAS_WEBHOOK_TOKEN=<COLA_O_HEX>
# salva (Ctrl+O, Enter, Ctrl+X)
grep -c '^ASAAS_WEBHOOK_TOKEN=' /opt/conta-ia/.env   # esperado: 1
pm2 reload conta-ia --update-env
sleep 5 && pm2 list | grep conta-ia
```

**c) Cadastra no painel:**
- https://sandbox.asaas.com → Configurações → Integrações → Webhooks
- **Adicionar webhook:**

| Campo | Valor |
|---|---|
| Nome | `CAIXAOS Sandbox` |
| URL | `https://app.caixaos.com.br/api/webhooks/asaas` |
| Email pra falhas | seu email pessoal |
| Versão API | v3 |
| Tipo de envio | sequencial |
| Token de autenticação | **MESMO HEX do `.env`** |
| Status | Ativada |

- **Eventos** marcar (mínimo):
  - ✅ PAYMENT_CONFIRMED
  - ✅ PAYMENT_RECEIVED
  - ✅ PAYMENT_OVERDUE
  - ✅ PAYMENT_REFUNDED
  - ✅ PAYMENT_DELETED
  - ✅ PAYMENT_CHARGEBACK_REQUESTED
  - (pode marcar TODOS `PAYMENT_*` se preferir — irrelevantes viram `IGNORED`)

---

### 2. 🧪 Testar end-to-end no sandbox

**Teste A — Ativação:**
1. Cria conta teste expirada (ou usa `/api/dev/expire-trial` num user TRIAL existente)
2. Logado nessa conta → vai em `/assinar` → escolhe plano → clica Pix
3. Pega o QR code (ou copia-cola) → vai no painel sandbox → encontra a cobrança
4. Clica **Receber em dinheiro** (confirma o pagamento sandbox)
5. Verifica logs:
   ```bash
   ssh root@198.211.103.10 'pm2 logs conta-ia --lines 30 --nostream | grep webhook'
   ```
   Esperado: `[webhook] processed { action: 'ACTIVATE', ... }`
6. Recarrega o app → conta deve estar fora do `/assinar`, com acesso normal

**Teste B — Idempotência:**
1. No painel sandbox, encontra o evento que disparou → clica **Reenviar**
2. Aguarda 5s → logs devem mostrar: `[webhook] idempotent skip { previousStatus: 'PROCESSED' }`
3. Confirma que `currentPeriodEnd` NÃO mudou no banco

**Teste C — Token inválido (já validado, mas reconfirma após config):**
```bash
curl -X POST -H 'asaas-access-token: errado' -d '{}' https://app.caixaos.com.br/api/webhooks/asaas
# esperado: HTTP 401
```

---

### 3. 🚀 Virar pra PRODUÇÃO (Sprint 3D) — só quando decidir faturar real

**Pré-requisitos antes de mexer:**
- [ ] 3C validada end-to-end em sandbox
- [ ] Conta de produção Asaas aprovada (KYC completo)
- [ ] Gerente de contas Asaas habilitou tokenização de cartão em produção
- [ ] Chave Pix cadastrada na conta PROD

**No `.env` do servidor:**
```bash
# Trocar:
ASAAS_ENV=production
ASAAS_API_KEY=\$aact_prod_SUA_CHAVE_PRODUCAO   # ⚠️ escape OBRIGATÓRIO do $
ASAAS_WEBHOOK_TOKEN=<NOVO_TOKEN_DE_PRODUCAO>   # gera outro openssl rand -hex 32
```

**Painel asaas.com (NÃO sandbox.asaas.com):**
- Cadastra outro webhook com o token de produção
- Cadastra chave Pix
- Confirma que cartão recorrente está habilitado

**Smoke test produção:**
- Cria cobrança Pix de **R$ 1** (não R$ 149,99 ainda) numa conta teste
- Confirma fluxo completo: criar → pagar → webhook ativa
- Só depois divulga pros clientes reais

---

## 🐛 PEGADINHAS JÁ DESCOBERTAS (não repetir)

| # | Pegadinha | Onde aprendemos | Solução |
|---|---|---|---|
| 1 | Chave API `$aact_xxx` precisa escape `\$` no `.env` (aspas NÃO bastam — `@next/env` faz expansão) | Sprint 3B post-3A | `ASAAS_API_KEY=\$aact_hmlg_xxx` |
| 2 | Conta Asaas precisa de **chave Pix cadastrada** ou `pixQrCode` retorna 400 `invalid_action` | Sprint 3B | Cadastrar chave EVP no painel |
| 3 | Checkout RECURRENT: `customerData` **COMPLETO** (9 campos) OU **NENHUM** | Sprint 3B post-fix | Estratégia Opção A: nenhum (cliente preenche no hosted) |
| 4 | Callback URL precisa domínio **HTTPS** (IP raw + HTTP = WAF nginx bloqueia 403) | Sprint 3B post-fix 2 | `NEXT_PUBLIC_APP_URL=https://app.caixaos.com.br` |
| 5 | Webhook token hex **NÃO precisa escape** (não começa com `$`) | Sprint 3C | Hex puro, sem aspas |
| 6 | Body 4xx do Asaas pode ser HTML do WAF (não JSON) | Sprint 3B post-fix 2 | `lib/asaas/client.ts` loga `bodyFirst300` redacted da apiKey |

---

## ⚠️ PENDÊNCIA DE SEGURANÇA

- **Rotacionar senha do banco** quando puder. `PGPASSWORD` apareceu em texto em alguns outputs durante a investigação do bug do callback URL. Não há vetor externo conhecido, mas higiene boa = rotação.
  - Trocar via `ALTER USER conta_ia_user PASSWORD '<nova>'`
  - Atualizar `DATABASE_URL` no `.env` (URL-encode caracteres especiais)
  - `pm2 reload --update-env`
  - Validar com `SELECT 1` que conexão funciona

---

## 📁 ARQUIVOS RELEVANTES (mapa rápido)

```
lib/asaas/
├── client.ts           ← wrapper fetch + sanitização logs
├── config.ts           ← loadAsaasConfig (env vars)
├── customers.ts        ← createOrGetCustomerForUser
├── checkout-hosted.ts  ← Cartão recorrente hosted (3B)
├── pix.ts              ← Pix one-off transparente (3B)
├── webhook.ts          ← validateAsaasToken / parseExternalReference / routeEvent / calculateNextPeriodEnd (3C)
├── errors.ts
├── types.ts            ← AsaasWebhookEvent / AsaasPaymentEventType etc
└── health.ts

app/api/
├── webhooks/asaas/route.ts                ← endpoint 3C
├── subscription/checkout/pix/route.ts     ← endpoint Pix
├── subscription/checkout/cartao/route.ts  ← endpoint cartão hosted
└── admin/asaas/health/route.ts            ← health (OWNER)

prisma/migrations/
├── 20260601000000_subscription_engine/        ← Subscription model
├── 20260601000001_asaas_3b_cpfcnpj_checkout/  ← cpfCnpj + checkoutSessionId
└── 20260612000000_asaas_3c_webhook_event/     ← WebhookEvent

docs/sprints/
├── asaas-3c-webhook.md   ← investigação + design completo 3C
└── PAGAMENTO-RETOMAR-AQUI.md  ← ESTE ARQUIVO
```

---

## 🎯 RESUMO EXECUTIVO PRA RETOMAR

1. **Lê esse arquivo.**
2. Executa os 3 passos da seção "ATIVAR O WEBHOOK" (gerar token + .env + painel).
3. Roda os 2 smoke tests (ativação + idempotência).
4. Quando quiser cobrar dinheiro real → seção "3D — virar pra produção".
