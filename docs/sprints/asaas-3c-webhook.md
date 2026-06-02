# Sprint Asaas FATIA 3C — Webhook (sandbox)

**Status:** 🔍 Fase 1 (investigação) — AGUARDANDO APROVAÇÃO
**Branch:** `feature/asaas-3c-webhook`
**Data:** 02/06/2026
**Doc oficial:** https://docs.asaas.com/docs/about-webhooks · /docs/payment-events · /docs/subscription-events · /docs/how-to-implement-idempotence-in-webhooks · /docs/receive-asaas-events-at-your-webhook-endpoint

---

## 1. 🔐 Validação de origem (autenticação)

### Header exato
```
asaas-access-token: <token configurado no painel>
```

Citação da doc: *"The informed token will be sent in all notifications in the `asaas-access-token` header."*

### Como configura
1. **Yussef** cadastra webhook no painel sandbox.asaas.com → Configurações → Integrações → Webhooks
2. **Yussef** define um token forte (sugiro: `openssl rand -hex 32` → 64 chars hex)
3. **Mesmo token** vai pro `.env` do servidor como `ASAAS_WEBHOOK_TOKEN`
4. Nosso endpoint compara `request.headers['asaas-access-token']` vs `process.env.ASAAS_WEBHOOK_TOKEN`

### Implementação (constant-time compare)
```ts
import { timingSafeEqual } from 'crypto'

function validateToken(received: string | null, expected: string): boolean {
  if (!received || !expected) return false
  const a = Buffer.from(received)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false  // timingSafeEqual exige tamanhos iguais
  return timingSafeEqual(a, b)
}
```

Token errado/ausente → **HTTP 401** + log `[webhook] auth failed` (sem expor token recebido).

### IPs oficiais Asaas (defesa em profundidade — OPCIONAL)
- 52.67.12.206
- 18.230.8.159
- 54.94.136.112
- 54.94.183.101

**Decisão:** NÃO implementar filtro de IP no MVP. Razões:
- Doc não confirma se IPs são iguais sandbox/prod
- Reverse proxy (nginx) ofusca IP de origem se mal configurado (`X-Forwarded-For`)
- Token já protege adequadamente
- Pode ser adicionado em Sprint futuro se necessário

---

## 2. 🆔 Idempotência

### Campo chave
```
body.id  (top-level, string formato "evt_05b708f961d739ea7eba7e4db318f621&368604920")
```

Citação da doc: *"Events sent by Asaas Webhooks have unique IDs, and even if they are sent more than once, you will always receive the same ID."*

### Garantias do Asaas
- **At-least-once delivery:** mesmo evento PODE chegar 2x, 3x ou mais
- **Mesmo `id`** sempre é enviado pro mesmo evento (não muda entre retries)
- **15 falhas consecutivas** → fila do webhook **PAUSA** automaticamente (precisa reativar manual no painel)
- **14 dias** de retenção de eventos (após isso, perdidos)

### Estratégia de defesa
- Tabela `WebhookEvent` com `asaasEventId String @unique`
- Antes de processar: `findUnique({ asaasEventId })` → se existe, retorna 200 sem reprocessar
- Insert + update atomic via `prisma.$transaction`
- Estado: `RECEIVED` → `PROCESSED` (ou `IGNORED` / `ERROR`)

---

## 3. 📦 Estrutura do payload

```json
{
  "id": "evt_05b708f961d739ea7eba7e4db318f621&368604920",
  "event": "PAYMENT_RECEIVED",
  "payment": {
    "object": "payment",
    "id": "pay_080225913252",
    "customer": "cus_000008072088",
    "subscription": "sub_xxx",           // null em Pix one-off
    "value": 149.99,
    "netValue": 145.32,
    "billingType": "CREDIT_CARD",        // ou PIX, BOLETO
    "status": "RECEIVED",
    "dueDate": "2026-06-02",
    "paymentDate": "2026-06-02",
    "externalReference": "user:cmp...|plan:inteligencia|ciclo:MONTHLY",
    ...
  }
}
```

### Campos críticos pra nosso fluxo
| Campo | Uso |
|---|---|
| `body.id` | Idempotência (UNIQUE em WebhookEvent) |
| `body.event` | Roteamento (CONFIRMED → ativa, OVERDUE → PAST_DUE, etc) |
| `body.payment.id` | Auditoria + busca/dedup secundária |
| `body.payment.subscription` | Identifica assinatura recorrente (cartão) |
| `body.payment.externalReference` | Identifica `user:<id>` (fonte primária pra nós) |
| `body.payment.status` | Validação cruzada (deve bater com event) |
| `body.payment.billingType` | Diferencia PIX (one-off) vs CREDIT_CARD (subscription) |
| `body.payment.value` | Cálculo + auditoria |

---

## 4. 🗺️ Mapa evento → ação

### Eventos que TRATAMOS no 3C

| Evento Asaas | Ação na nossa Subscription | Estado final |
|---|---|---|
| `PAYMENT_CONFIRMED` | Pagamento OK (saldo ainda não disponível) — ativa | `ACTIVE` + `currentPeriodEnd = +1m/+1y` |
| `PAYMENT_RECEIVED` | Pagamento recebido (saldo disponível) — ativa | `ACTIVE` + `currentPeriodEnd = +1m/+1y` |
| `PAYMENT_OVERDUE` | Cobrança atrasou | `PAST_DUE` (corte de acesso = 3D, ainda libera por enquanto) |
| `PAYMENT_REFUNDED` | Estorno total | `CANCELED` + `canceledAt = now` |
| `PAYMENT_CHARGEBACK_REQUESTED` | Chargeback iniciado | `PAST_DUE` (decisão final = 3D) |
| `PAYMENT_DELETED` | Cobrança removida do Asaas | `CANCELED` + `canceledAt = now` |

### Eventos que IGNORAMOS (gravados como `IGNORED`)
- `PAYMENT_CREATED` — cobrança criada (já sabemos via checkout)
- `PAYMENT_UPDATED` — mudança de data/valor (raro, não impacta acesso)
- `PAYMENT_AWAITING_RISK_ANALYSIS` — análise antifraude em curso
- `PAYMENT_APPROVED_BY_RISK_ANALYSIS` / `PAYMENT_REPROVED_BY_RISK_ANALYSIS` — preludem CONFIRMED/CREDIT_CARD_CAPTURE_REFUSED
- `PAYMENT_AUTHORIZED` — autorização técnica de cartão
- `PAYMENT_CREDIT_CARD_CAPTURE_REFUSED` — falha de captura cartão (importante mas trata em 3D)
- `PAYMENT_ANTICIPATED` — antecipação financeira (não muda acesso)
- `PAYMENT_RESTORED` — cobrança restaurada (operacional)
- `PAYMENT_PARTIALLY_REFUNDED` / `PAYMENT_REFUND_IN_PROGRESS` / `PAYMENT_REFUND_DENIED` — reembolso parcial/em curso
- `PAYMENT_RECEIVED_IN_CASH_UNDONE` — operacional financeiro
- `PAYMENT_CHARGEBACK_DISPUTE` / `PAYMENT_AWAITING_CHARGEBACK_REVERSAL` — flow de chargeback (decisão final cobre)
- `PAYMENT_DUNNING_RECEIVED` / `PAYMENT_DUNNING_REQUESTED` — notarial
- `PAYMENT_BANK_SLIP_CANCELLED` / `PAYMENT_BANK_SLIP_VIEWED` — boleto-específico (não usamos boleto no 3B)
- `PAYMENT_CHECKOUT_VIEWED` — telemetria
- `PAYMENT_SPLIT_*` — não usamos split
- `SUBSCRIPTION_CREATED` / `SUBSCRIPTION_UPDATED` / `SUBSCRIPTION_DELETED` / `SUBSCRIPTION_INACTIVATED` / `SUBSCRIPTION_SPLIT_*` — gerenciamos via cobranças individuais (PAYMENT_*), os eventos de assinatura são redundantes

**Por quê IGNORAR e não rejeitar:** ainda gravamos em `WebhookEvent` com status `IGNORED` pra auditoria — quando precisarmos lidar (3D, 3E), basta deixar de ignorar.

### Eventos DESCONHECIDOS (não no enum acima)
- Gravar com status `IGNORED` + payload completo
- Retornar 200 (não trava fila do Asaas)
- Log: `[webhook] evento não mapeado: <EVENT_NAME>`
- Permite Asaas adicionar novos eventos sem quebrar nosso endpoint

---

## 5. 🔍 Como identificamos a Subscription

### Estratégia em camadas (de preferida → fallback)

**Camada 1 — `externalReference`** (preferida — controlada por nós):
```
externalReference = "user:cmp...|plan:inteligencia|ciclo:MONTHLY"
                                                          ^^^ ou |dias:N pro Pix
```
- Regex: `/^user:([^|]+)\|plan:([^|]+)\|ciclo:(MONTHLY|YEARLY)(\|dias:\d+)?$/`
- Busca `subscription.findUnique({ userId })`
- Match exato

**Camada 2 — `gatewaySubscriptionId`** (Asaas controla — só cartão recorrente):
- Pra cartão, Asaas envia `payment.subscription`
- Busca `subscription.findFirst({ where: { gatewaySubscriptionId: payment.subscription } })`
- Importante: SETAMOS esse campo na PRIMEIRA confirmação (não vem do checkout — Asaas cria a subscription só após o cartão ser cobrado com sucesso)

**Camada 3 — `gatewayCustomerId`** (fallback Pix):
- Pra Pix one-off, `payment.subscription` é null
- Busca `subscription.findFirst({ where: { gatewayCustomerId: payment.customer } })`

### Se NENHUMA das 3 acha
- Loga warn `[webhook] subscription não localizada` com `paymentId + externalReference`
- Grava `WebhookEvent` com status `ERROR`
- Retorna **200** (NÃO 4xx — senão Asaas trava fila depois de 15 falhas)
- Possíveis causas: pagamento criado fora do CAIXAOS (Yussef cobrou direto pelo painel), user deletado, race com signup

---

## 6. 🏗️ Schema novo — `WebhookEvent`

```prisma
model WebhookEvent {
  id           String   @id @default(cuid())
  asaasEventId String   @unique                  // body.id do Asaas — chave idempotência
  eventType    String                            // PAYMENT_CONFIRMED, PAYMENT_RECEIVED, etc
  paymentId    String?                           // body.payment.id (null em eventos não-payment)
  subscriptionId String?                          // FK pra nossa Subscription (quando identificada)
  payload      Json                              // body completo (auditoria 14d Asaas + além)
  status       String                            // RECEIVED | PROCESSED | IGNORED | ERROR
  errorMessage String?                           // populado quando status=ERROR
  processedAt  DateTime?
  createdAt    DateTime @default(now())

  subscription Subscription? @relation(fields: [subscriptionId], references: [id], onDelete: SetNull)

  @@index([eventType])
  @@index([paymentId])
  @@index([status])
  @@index([createdAt])
  @@map("webhook_events")
}
```

**Decisões de schema:**
- `asaasEventId` UNIQUE → race-safe via constraint do DB (não basta findUnique sem transaction)
- `payload Json` (Postgres) — Asaas guarda 14d, nós além
- `subscription` SetNull onDelete — preserva histórico de eventos mesmo se user excluído
- `errorMessage` opcional pra debug

### Migration aditiva (sem breaking)
- `prisma/migrations/<ts>_webhook_event/migration.sql` escrita à mão (padrão do projeto)
- BACKUP do `.env` + dump do banco prod ANTES:
  ```bash
  pg_dump -Fc | tee /var/backups/conta-ia/pre-3c-webhook-<ts>.dump
  ```
- Não toca tabelas existentes

---

## 7. 🔄 Fluxo completo do endpoint

```
POST /api/webhooks/asaas
│
├─ 1. valida header asaas-access-token (timingSafeEqual)
│     ├─ inválido/ausente → 401 + log auth fail (NUNCA processa)
│     └─ válido → segue
│
├─ 2. parse body JSON
│     ├─ inválido → 400 + log (não chega aqui via Asaas real)
│     └─ ok → extrai { id, event, payment? }
│
├─ 3. IDEMPOTÊNCIA: findUnique({ asaasEventId: body.id })
│     ├─ existe → retorna 200 imediato (log "idempotent skip")
│     └─ não existe → segue
│
├─ 4. Cria WebhookEvent com status=RECEIVED, payload=body
│     (UNIQUE constraint do asaasEventId garante race-safety;
│      em colisão, faz update via upsert/catch P2002)
│
├─ 5. ROTEIA por body.event:
│     │
│     ├─ PAYMENT_CONFIRMED / PAYMENT_RECEIVED:
│     │     ├─ identifica subscription (3 camadas — seção 5)
│     │     ├─ não acha → status=ERROR, log warn, return 200
│     │     ├─ acha → calcula novo currentPeriodEnd
│     │     │   • parse ciclo do externalReference
│     │     │   • MONTHLY → max(now, currentPeriodEnd) + 1 mês
│     │     │   • YEARLY → max(now, currentPeriodEnd) + 12 meses
│     │     │   • o `max` garante renovação acumulativa (não corta se chegou cedo)
│     │     ├─ update Subscription: status=ACTIVE, currentPeriodEnd=<novo>,
│     │     │   gatewaySubscriptionId=payment.subscription (se cartão e ainda null)
│     │     └─ marca WebhookEvent.status=PROCESSED + processedAt=now
│     │
│     ├─ PAYMENT_OVERDUE:
│     │     ├─ identifica subscription
│     │     ├─ status=PAST_DUE (acesso NÃO cortado — corte é 3D)
│     │     └─ WebhookEvent.status=PROCESSED
│     │
│     ├─ PAYMENT_REFUNDED / PAYMENT_DELETED:
│     │     ├─ identifica subscription
│     │     ├─ status=CANCELED + canceledAt=now
│     │     └─ WebhookEvent.status=PROCESSED
│     │
│     ├─ PAYMENT_CHARGEBACK_REQUESTED:
│     │     ├─ status=PAST_DUE
│     │     └─ WebhookEvent.status=PROCESSED
│     │
│     └─ qualquer outro:
│           └─ WebhookEvent.status=IGNORED
│
└─ 6. return 200 { ok: true, eventId: body.id, status: <RECEIVED|PROCESSED|IGNORED|ERROR> }
```

### Responder RÁPIDO (≤ 5s alvo)
- Processamento síncrono é OK pra MVP (Asaas tolera ~30s sem timeout documentado)
- Operações são todas DB locais (~50ms total)
- Sem chamada externa síncrona no path do webhook (nada que volte ao Asaas)
- Se ficar lento no futuro: pode mover pra fila (BullMQ) com 200 imediato após `WebhookEvent.RECEIVED`

---

## 8. ⚠️ Riscos e mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Webhook falso (sem token) | Alta (sem auth) → BAIXA | Crítico (ativar grátis) | `asaas-access-token` + timingSafeEqual |
| Evento duplicado processado 2x | Alta (at-least-once) | Crítico (renovar 2x = +2 meses) | UNIQUE constraint asaasEventId + check antes |
| Race: 2 webhooks idênticos chegam simultâneos | Média | Crítico | UNIQUE + try/catch P2002 (constraint do DB) |
| Subscription não localizada (externalReference quebrado) | Baixa | Médio (user não ativa) | 3 camadas de busca + log warn + status ERROR |
| Asaas trava fila por 15 falhas | Baixa | Alto (todos webhooks param) | Resposta 200 em TODOS caminhos exceto auth (sentinel 401) |
| currentPeriodEnd retrocede (renovação adiantada) | Baixa | Médio (corta antes) | `max(now, currentPeriodEnd) + delta` |
| Webhook depois de exclusão de user | Muito baixa | Baixo (200 + ignore) | findFirst retorna null → ERROR + 200 |
| Eventos chegam fora de ordem (CONFIRMED depois de REFUNDED) | Baixa | Médio | Status atual já capturado; lógica idempotente por design |
| Cartão renova antes do webhook → user vê EXPIRED | Baixa | Médio | UX: tela `/assinar` sempre acessível pra renovar; webhook sincroniza dentro de minutos |
| Token vazado nos logs | Baixa | Médio | Nenhum log inclui body.headers; auth fail log sem expor token |
| `payment.subscription` nulo em cartão (race) | Baixa | Baixo | gatewaySubscriptionId setado lazy — primeira confirmação |
| Body JSON gigante (>10MB) | Muito baixa | Médio (memória) | Next.js limita body em 4.5MB default — sufficient (eventos Asaas ~2KB) |

---

## 9. 📋 Plano de implementação (Fase 2 — pós-aprovação)

### A. Migration
1. Backup: `pg_dump -Fc -Z 9 > /var/backups/conta-ia/pre-3c-<ts>.dump`
2. Adicionar model `WebhookEvent` em `schema.prisma`
3. Adicionar `webhookEvents WebhookEvent[]` na relação reversa em `Subscription`
4. Escrever `prisma/migrations/<ts>_webhook_event/migration.sql` à mão (padrão do projeto, Postgres puro)
5. `npx prisma db push` em dev + `npx prisma generate`

### B. Lib
- `lib/asaas/webhook.ts` — funções puras:
  - `validateAsaasToken(received, expected) → boolean`
  - `parseExternalReference(ref) → { userId, planId, ciclo } | null`
  - `calculateNextPeriodEnd(current, ciclo, now) → Date`
  - `routeEvent(event) → 'ACTIVATE' | 'PAST_DUE' | 'CANCEL' | 'IGNORE'`
- `lib/asaas/types.ts` — adicionar `AsaasWebhookEvent`, `AsaasPaymentEventType`

### C. Endpoint
- `app/api/webhooks/asaas/route.ts` — orquestra auth + idempotência + processamento
- `proxy.ts` — adicionar `/api/webhooks/asaas` em `PUBLIC_API` (sem JWT — webhook é não-autenticado por user, só por token Asaas)

### D. Testes (alvo +25)
1. rejeita sem header → 401
2. rejeita token errado → 401
3. rejeita comprimento token diferente → 401 (timingSafeEqual safety)
4. aceita token correto → 200
5. body inválido → 400
6. body sem `id` → 400
7. body sem `event` → 400
8. idempotência: 2º POST mesmo `id` → 200 imediato, NÃO reprocessa
9. UNIQUE constraint colisão (race) → 200 (catch P2002)
10. PAYMENT_CONFIRMED via externalReference → ACTIVE + currentPeriodEnd MONTHLY
11. PAYMENT_RECEIVED via externalReference → ACTIVE + currentPeriodEnd YEARLY
12. PAYMENT_RECEIVED via gatewaySubscriptionId → ACTIVE
13. PAYMENT_RECEIVED via gatewayCustomerId fallback (Pix) → ACTIVE
14. PAYMENT_RECEIVED → seta gatewaySubscriptionId se vier no payload
15. PAYMENT_CONFIRMED 2x consecutivo (renovação) → currentPeriodEnd estende corretamente
16. PAYMENT_CONFIRMED com currentPeriodEnd no futuro → soma a partir do futuro (não retrocede)
17. PAYMENT_OVERDUE → PAST_DUE (sem cortar acesso)
18. PAYMENT_REFUNDED → CANCELED + canceledAt
19. PAYMENT_DELETED → CANCELED + canceledAt
20. PAYMENT_CHARGEBACK_REQUESTED → PAST_DUE
21. PAYMENT_CREATED → IGNORED (gravado mas sem efeito)
22. PAYMENT_UPDATED → IGNORED
23. SUBSCRIPTION_DELETED → IGNORED (decisão de produto)
24. Subscription não localizada (externalReference quebrado) → ERROR + 200
25. parseExternalReference malformed → null
26. calculateNextPeriodEnd MONTHLY de currentPeriodEnd null → now + 1 mês
27. calculateNextPeriodEnd YEARLY de currentPeriodEnd futuro → +12 meses do futuro
28. routeEvent retorna 'IGNORE' pra evento desconhecido

### E. Deploy
1. Build prod local (`npm run build` — TS strict 0)
2. Backup banco prod
3. Push branch → merge main
4. SSH droplet → rodar migration via `prisma migrate deploy` (depois do swap SQLite→Postgres)
5. PM2 reload

### F. Configuração Yussef (após deploy)
1. Sandbox: `openssl rand -hex 32` → token gerado
2. Yussef edita `.env` em prod: `ASAAS_WEBHOOK_TOKEN=<token>` (sem expor)
3. PM2 reload --update-env
4. Yussef vai em https://sandbox.asaas.com → Configurações → Integrações → Webhooks → Adicionar
5. URL: `https://app.caixaos.com.br/api/webhooks/asaas`
6. Token: cola o mesmo do `.env`
7. Eventos: selecionar todos os `PAYMENT_*` (mais simples que escolher subset — IGNORED não dói)
8. Versão: 3.0 (atual)
9. Email pra falhas: yussef
10. Habilita

### G. Smoke test (Yussef + Claude juntos)
1. No painel sandbox, criar cobrança Pix manual
2. Confirmar pagamento (botão "Receber em dinheiro")
3. Watch logs PM2: `[webhook] PAYMENT_RECEIVED` + WebhookEvent.status=PROCESSED
4. Verificar Subscription do Yussef: status=ACTIVE, currentPeriodEnd=+30d
5. Re-enviar mesmo evento (botão "Reenviar" no painel) → log "idempotent skip"
6. Confirmar Subscription NÃO mudou (currentPeriodEnd igual)

---

## 10. ❓ Decisões abertas pra aprovação

1. **OK incluir CHARGEBACK_REQUESTED como PAST_DUE?** (alternativa: CANCELED imediato — agressivo)
2. **OK ignorar TODOS os SUBSCRIPTION_***? (alternativa: tratar SUBSCRIPTION_INACTIVATED como CANCELED)
3. **OK NÃO implementar filtro de IP?** (defesa em profundidade — proposta: ficar pra Sprint 3D ou 3E se necessário)
4. **OK processar síncrono sem fila?** (alternativa: BullMQ — proposta: MVP síncrono, fila se ficar lento)
5. **`gatewaySubscriptionId` set lazy?** Set na 1ª confirmação OU já na 1ª chamada checkout cartão? (proposta: lazy via webhook, porque Asaas só cria subscription após cobrança bem-sucedida)

---

## 11. ✅ Checklist DoD (recap)

- [ ] Auditoria + aprovação ← VOCÊ ESTÁ AQUI
- [ ] Backup banco prod
- [ ] Migration WebhookEvent aplicada
- [ ] POST /api/webhooks/asaas (auth + idempotência + processamento)
- [ ] PAYMENT_CONFIRMED/RECEIVED → ACTIVE + currentPeriodEnd
- [ ] PAYMENT_OVERDUE → PAST_DUE
- [ ] PAYMENT_REFUNDED/DELETED → CANCELED
- [ ] PAYMENT_CHARGEBACK_REQUESTED → PAST_DUE
- [ ] Renovação estende currentPeriodEnd corretamente
- [ ] +25 testes (todos cenários acima)
- [ ] TypeScript strict 0 erros
- [ ] Build OK
- [ ] Deploy prod (sandbox apenas)
- [ ] Yussef configura webhook no painel sandbox
- [ ] Smoke: pagamento sandbox dispara webhook → ativa conta
- [ ] Smoke: reenvio mesmo evento → idempotent skip confirmado
