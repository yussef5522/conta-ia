# Sprint Asaas FATIA 3B — Implementação (após PCI aprovado)

**Branch:** `feature/asaas-3b-checkout`
**Data:** 31/05/2026
**Status:** ⏳ aguardando aprovação Yussef antes de codar

---

## 0. Decisão estratégica recente

✅ Yussef aprovou **Opção B (híbrida)** do `asaas-3b-audit.md`:
- **Pix**: transparente dentro do CAIXAOS
- **Cartão**: hosted (Asaas Checkout, redirect ~15s) → SAQ-A preservado

---

## 1. Pesquisa rigorosa da doc Asaas

### 1.1 Endpoints que vamos usar

| Endpoint | Método | Fonte | Uso |
|---|---|---|---|
| `/customers` | POST | já implementado | criar customer (cpfCnpj exigido) |
| `/payments` | POST | [docs](https://docs.asaas.com/reference/criar-nova-cobranca) | cobrança Pix one-off |
| `/payments/{id}/pixQrCode` | GET | [docs](https://docs.asaas.com/reference/obter-qr-code-para-pagamentos-via-pix) | pega QR base64 + payload copia-cola |
| `/payments/{id}` | GET | docs | polling de status |
| `/checkouts` | POST | [docs](https://docs.asaas.com/reference/create-new-checkout) | sessão hosted RECURRENT cartão |

### 1.2 Resposta da pesquisa: Pix **não é "verdadeiramente" recorrente**

🚨 **Achado importante da doc:** *"A assinatura é um agendador de criação de cobranças. Pix subscriptions = system generates charges on a schedule, but does NOT automatically debit the customer's account. The customer receives notifications and must initiate payment for each billing cycle."*

Existe `Pix Automático` (separado), mas precisa **autorização do cliente no banco dele** (similar a débito automático): UX ruim pra MVP + integração mais complexa.

**Implicação de produto:**
- Pix recorrente = cliente recebe novo QR todo mês e paga manualmente (lembrete por email) — UX ruim
- Cartão recorrente = Asaas debita automático todo mês — UX boa

### 1.3 Proposta de produto pra 3B

| Método | Tipo de cobrança | UX cliente |
|---|---|---|
| 💚 **Pix** | **One-off mensal** (1 mês de acesso) | Paga Pix → ganha 30 dias. Antes de acabar, recebe email/banner pra renovar. Simples, transparente, sem cartão guardado. |
| 💜 **Cartão** | **RECURRENT mensal OU anual** | Cadastra 1x → Asaas debita automático todo mês/ano. Netflix-like. |

**Por que melhor que Pix recorrente:**
- Pix recorrente do Asaas é "scheduler" — mesmo trabalho operacional que one-off, mas confunde o cliente ("paguei mas não foi automático?")
- One-off é honesto: "pague seu mês quando quiser, sem fidelidade"
- Pra quem quer "esquecer e ser cobrado", o caminho é cartão (e o Asaas debita de verdade)

**Pix automático fica pra fatia futura** quando habilitar autorização bancária e tiver fluxo de UX bem desenhado.

---

## 2. Fluxos detalhados

### 2.1 Fluxo Pix (transparente)

```
┌──────────────────────────────────────────────────────────────┐
│  CLIENTE                CAIXAOS                  ASAAS       │
├──────────────────────────────────────────────────────────────┤
│  1. /assinar           ─────────────────────────────────►    │
│     escolhe Pix                                              │
│                                                              │
│  2. cpfCnpj form  ────► POST /api/subscription/checkout/pix  │
│                         body: { planId, ciclo, cpfCnpj }     │
│                                                              │
│                         ┌──────────────────────────────────► │
│                         │ createOrGetCustomerForUser          │
│                         │ (POST /v3/customers se 1ª vez)      │
│                         ◄──────────────────────────────────┐  │
│                         │                                  │  │
│                         │ POST /v3/payments                 │  │
│                         │ {customer, billingType:PIX,       │  │
│                         │  value, dueDate:hoje+1d,          │  │
│                         │  description, externalRef:userId} │  │
│                         ◄────── { id, status:PENDING }     │  │
│                         │                                  │  │
│                         │ GET /v3/payments/{id}/pixQrCode  │  │
│                         ◄────── { encodedImage,           │  │
│                                  payload, expirationDate } │  │
│                                                              │
│  3. ◄── { paymentId, qrImg, copiaECola, valorPago, expira }  │
│                                                              │
│  4. UI mostra QR + copia-cola + countdown                    │
│     Inicia polling: GET /api/subscription/checkout/pix/status?id=
│     (a cada 3s)                                              │
│                                                              │
│  5. Cliente paga no banco                                    │
│                         ◄──── ✓ Asaas detecta (~10s)         │
│                                                              │
│  6. Polling pega status RECEIVED                             │
│     UI mostra "Pagamento confirmado! ✓"                      │
│                                                              │
│  7. Servidor marca Subscription:                             │
│     status=ACTIVE, planId, trialEndsAt=null,                 │
│     currentPeriodEnd=hoje+30d (ou +365d se anual)            │
│                                                              │
│  8. UI redireciona /dashboard                                │
└──────────────────────────────────────────────────────────────┘

⚠️ Na 3C (webhook) a confirmação vai ser definitiva. Aqui (3B) o
polling do status já marca ACTIVE — webhook valida + cobre casos
onde o user fecha a aba antes do polling pegar.
```

### 2.2 Fluxo Cartão (hosted)

```
┌──────────────────────────────────────────────────────────────┐
│  CLIENTE                CAIXAOS                  ASAAS       │
├──────────────────────────────────────────────────────────────┤
│  1. /assinar                                                  │
│     escolhe Cartão                                            │
│     mostra "Você será redirecionado pra pagamento seguro"     │
│                                                              │
│  2. cpfCnpj form ────► POST /api/subscription/checkout/cartao│
│     (se faltar)         body: { planId, ciclo, cpfCnpj }     │
│                                                              │
│                         ┌─► POST /v3/checkouts                │
│                         │ {                                   │
│                         │  billingTypes:["CREDIT_CARD"],      │
│                         │  chargeTypes:["RECURRENT"],         │
│                         │  customerData: { name, cpfCnpj,     │
│                         │                  email, ... },      │
│                         │  subscription: {                    │
│                         │    cycle: MONTHLY|YEARLY,           │
│                         │    nextDueDate: hoje,               │
│                         │    endDate: +5 anos                 │
│                         │  },                                 │
│                         │  items: [{name:plano, value, qty:1}]│
│                         │  callback: {                        │
│                         │    successUrl: ../assinar/sucesso?id│
│                         │    cancelUrl:  ../assinar?cancel=1  │
│                         │    expiredUrl: ../assinar?expired=1 │
│                         │  },                                 │
│                         │  minutesToExpire: 30                │
│                         │ }                                   │
│                         ◄────── { id: 'chk_xxx', ... }       │
│                         │                                    │
│                         │ Salva Subscription.checkoutSessionId│
│                         │ (estado provisório = PENDING)       │
│                                                              │
│  3. ◄── { checkoutUrl: 'asaas.com/checkoutSession/show?id=..' }
│                                                              │
│  4. Browser redirect ───► hosted page Asaas (assaas.com/...)  │
│                                                              │
│  5. Cliente digita cartão DENTRO DO ASAAS                    │
│     (nosso servidor NUNCA toca número)                       │
│                                                              │
│  6. Cartão aprovado ──── Asaas cria CustomerCard +           │
│                          PaymentMethod tokenizado +          │
│                          Subscription (gateway-side)         │
│                                                              │
│  7. Asaas redirect ──► /assinar/sucesso?id=chk_xxx           │
│                         ┌─ Backend pega o checkoutId         │
│                         │ GET /v3/checkouts/{id}             │
│                         ◄── { subscriptionId, status:'PAID'} │
│                         │                                    │
│                         │ Salva Subscription.gatewaySubsId   │
│                         │ Marca status='ACTIVE' (provisório) │
│                                                              │
│  8. Página mostra ✓ + redirect /dashboard                    │
│                                                              │
│  ⚠️ 3C webhook confirma + recebe eventos mensais futuros      │
└──────────────────────────────────────────────────────────────┘
```

### 2.3 ✅ Confirmação PCI/SAQ-A

| Vetor | Onde dado de cartão trafega | Veredito |
|---|---|---|
| POST /api/subscription/checkout/cartao | body NÃO tem cartão (só planId/ciclo) | ✅ |
| POST /v3/checkouts (nosso → Asaas) | body NÃO tem cartão (só dados do customer) | ✅ |
| Resposta do Asaas | retorna `id`, NÃO retorna cartão | ✅ |
| Hosted page | cartão digitado em `asaas.com` (domínio deles) | ✅ |
| Tokenização | acontece **dentro do Asaas** (server-side deles) | ✅ |
| /assinar/sucesso?id= | query param tem só `checkoutId` (não-sensível) | ✅ |
| GET /v3/checkouts/{id} | retorna `subscriptionId`, NÃO cartão | ✅ |
| Webhook (3C) | recebe eventos sem cartão (`paymentId`, `status`) | ✅ |
| Nosso DB | guarda só `gatewayCustomerId`, `gatewaySubscriptionId` (IDs Asaas) | ✅ |

**Conclusão: 0 (zero) byte de dado de cartão toca nosso servidor em qualquer momento. SAQ-A preservado.**

---

## 3. Mudanças no Schema

### 3.1 `User.cpfCnpj` — novo campo (aditivo)

```prisma
model User {
  // ...
  cpfCnpj String? // CPF (11 chars) ou CNPJ (14 chars), só dígitos.
                  // Coletado no checkout 3B. Nullable: users existentes
                  // preenchem no 1º pagamento.
}
```

**Migration aditiva** + backup prod antes.

⚠️ NÃO único — múltiplos users podem ter o mesmo CPF (raro mas legal: cônjuges compartilhando email separados, MEI vs pessoa física do mesmo CPF). Dedup ficaria escapista.

### 3.2 `Subscription.checkoutSessionId` — novo campo (aditivo)

```prisma
model Subscription {
  // ...
  checkoutSessionId String?
  // ID da última sessão de checkout cartão hosted ativa.
  // Usado pra: (1) dedup quando user clica "Assinar" 2x antes da
  // primeira sessão expirar; (2) callback /assinar/sucesso pra
  // confirmar via GET /checkouts/{id}.
}
```

---

## 4. Lib + Endpoints

### 4.1 Novos arquivos `lib/asaas/`

```
lib/asaas/
├── (existentes do 3A...)
├── pix.ts                  — createPixCharge + getPixQrCode + getPaymentStatus
├── checkout-hosted.ts      — createHostedCheckout + getCheckoutSession
└── (futuro 3C: webhook.ts)

lib/validation/
└── cpf-cnpj.ts             — validateCpfCnpj puro (algoritmo DV)
```

### 4.2 Endpoints

```
POST /api/subscription/checkout/pix
  body: { planId, ciclo: MONTHLY|YEARLY, cpfCnpj }
  ações:
    1. valida user logado, planId válido, ciclo válido, cpfCnpj válido
    2. salva User.cpfCnpj se faltava
    3. createOrGetCustomerForUser (lib 3A)
    4. createPixCharge (value conforme plano+ciclo, dueDate=hoje+1d)
    5. getPixQrCode pelo paymentId
    6. atualiza Subscription { gatewayCustomerId } provisório
  retorna: { paymentId, qrImageBase64, copiaECola, valor, expiresAt }

GET /api/subscription/checkout/pix/status?paymentId=
  ações:
    1. valida session (paymentId pertence ao user)
    2. GET /v3/payments/{id} no Asaas
    3. SE status RECEIVED OR CONFIRMED:
       → Subscription { status: ACTIVE, planId, currentPeriodEnd: +30|365d }
  retorna: { status: PENDING|CONFIRMED|EXPIRED }

POST /api/subscription/checkout/cartao
  body: { planId, ciclo: MONTHLY|YEARLY, cpfCnpj }
  ações:
    1. valida user, plano, ciclo, cpfCnpj
    2. salva User.cpfCnpj se faltava
    3. createOrGetCustomerForUser
    4. createHostedCheckout:
       billingTypes: CREDIT_CARD
       chargeTypes: RECURRENT
       subscription: { cycle, nextDueDate: hoje, endDate: +5 anos }
       items: [{ name: plano, value: precoMensal ou precoAnual, qty: 1 }]
       callback: { successUrl: APP_URL/assinar/sucesso?id={...}, cancelUrl, expiredUrl }
       customerData: { name, email, cpfCnpj }
    5. salva Subscription.checkoutSessionId
  retorna: { checkoutUrl: 'https://(sandbox.)asaas.com/checkoutSession/show?id=XXX' }

GET /assinar/sucesso?id=<checkoutSessionId>
  página server:
    1. lê id do query
    2. valida que checkoutSessionId bate com Subscription do user
    3. GET /v3/checkouts/{id}
    4. SE status PAID → Subscription { status: ACTIVE, gatewaySubscriptionId }
    5. mostra "✓ Assinatura ativa" + redirect /dashboard
  ⚠️ Webhook (3C) é a fonte definitiva — esta página é UX, não confiança.
```

---

## 5. UI `/assinar` (dark imersivo)

Substitui o placeholder atual. Visual coerente com a landing (`mesh-bg`, glassmorphism, font-display, gradient violet).

```
┌────────────────────────────────────────────────────────┐
│  CAIXAOS                                       [Sair] │
├────────────────────────────────────────────────────────┤
│                                                        │
│          Seu teste terminou — escolha um plano        │
│                                                        │
│   [ Mensal | Anual −20% ]   ← toggle                   │
│                                                        │
│  ┌─────────┐  ┌─────────┐  ┌───────────┐  ┌──────────┐│
│  │ Início  │  │Controle │  │Inteligência│ │Performan │
│  │ R$29,99 │  │ R$89,99 │  │ R$149,99 ⭐│ │R$349,99 ││
│  │         │  │         │  │            │ │          ││
│  │ Escolher│  │ Escolher│  │ ESCOLHER   │ │ Escolher ││
│  └─────────┘  └─────────┘  └───────────┘  └──────────┘│
│                                                        │
└────────────────────────────────────────────────────────┘

Clique num plano:
┌────────────────────────────────────────────────────────┐
│  ← Voltar                                              │
│                                                        │
│         Inteligência · Mensal                          │
│         R$ 149,99 / mês                                │
│         "Sua contadora com IA, 24/7"                   │
│                                                        │
│  Escolha o método:                                     │
│                                                        │
│  ┌──────────────────┐    ┌──────────────────┐         │
│  │   Pagar com Pix  │    │ Cartão recorrente│         │
│  │                  │    │                  │         │
│  │ • Pague 1 mês    │    │ • Débito automát.│         │
│  │ • Sem cartão     │    │ • Cancele quando │         │
│  │   guardado       │    │   quiser         │         │
│  │ • 30 dias acesso │    │ • Sem renovação  │         │
│  │                  │    │   manual         │         │
│  └──────────────────┘    └──────────────────┘         │
└────────────────────────────────────────────────────────┘

Click Pix:
┌────────────────────────────────────────────────────────┐
│  Aponte a câmera do banco no QR code                   │
│                                                        │
│        [ ████████ ]                                    │
│        [ █ QR  █ █ ]                                   │
│        [ ████████ ]                                    │
│                                                        │
│  Ou copie:                                             │
│  ┌─────────────────────────────────────────┐  [Copiar]│
│  │ 00020126360014BR.GOV.BCB.PIX01...       │           │
│  └─────────────────────────────────────────┘           │
│                                                        │
│  ⏱  Expira em 14:32                                    │
│  ⏳ Aguardando confirmação do pagamento...             │
└────────────────────────────────────────────────────────┘

Click Cartão:
[form mínimo: cpfCnpj (se faltar) + botão "Continuar"]
→ redirect pra asaas.com (~15s)
→ volta em /assinar/sucesso ✓
```

---

## 6. Testes (alvo +20)

```ts
describe('lib/validation/cpf-cnpj', () => {
  test('CPF válido com DV correto')
  test('CPF inválido (DV errado)')
  test('CPF com formato inválido (10 dígitos)')
  test('CNPJ válido')
  test('CNPJ inválido')
  test('aceita com máscara (12.345.678/0001-95) ou só dígitos')
})

describe('lib/asaas/pix', () => {
  test('createPixCharge envia payload correto')
  test('getPixQrCode retorna {encodedImage, payload}')
  test('getPaymentStatus mapeia PENDING/RECEIVED/CONFIRMED')
})

describe('lib/asaas/checkout-hosted', () => {
  test('createHostedCheckout RECURRENT mensal → payload correto')
  test('createHostedCheckout RECURRENT anual → cycle:YEARLY')
  test('callback inclui successUrl/cancelUrl/expiredUrl absolutos')
  test('items aceita value do plano correto')
  test('🛡️ NENHUM campo de cartão no payload (só customerData)')
})

describe('endpoints checkout', () => {
  test('POST /pix exige user logado + cpfCnpj válido')
  test('POST /cartao retorna URL https://(sandbox.)asaas.com/checkoutSession/...')
  test('GET /pix/status RECEIVED → Subscription ACTIVE')
  test('GET /assinar/sucesso?id=invalid → erro')
  test('idempotente: 2 clicks rápidos não criam 2 cobranças')
})

describe('🛡️ logs', () => {
  test('nenhum dado sensível em console.error em todos os endpoints')
})
```

**Total esperado: ~22 testes.**

---

## 7. Riscos identificados

| # | Risco | Mitigação |
|---|---|---|
| 1 | Cliente fecha aba do hosted checkout depois de pagar | 3C webhook é a fonte da verdade. /sucesso é só UX. |
| 2 | Pix expira sem cliente pagar | `expiresAt` retornado no response. UI mostra countdown. Cliente pode gerar novo. |
| 3 | Duplicação de cobrança (2 clicks rápidos) | Idempotência: salvar `checkoutSessionId` pendente, se já existe e não expirou, reusa. |
| 4 | User com Subscription GRANTED clicando assinar (Yussef!) | UI esconde `/assinar` se status=GRANTED. Endpoint rejeita (já tem acesso vitalício). |
| 5 | Pix subscription cycle confusion | Decidimos: Pix one-off, não recorrente. UI fala "1 mês de acesso" claro. |
| 6 | nextDueDate no passado | Sempre `nextDueDate = today UTC` na criação do checkout. Asaas valida. |
| 7 | Customer já existe no Asaas com outro cpfCnpj (race com upgrade) | `createOrGetCustomerForUser` é idempotente. cpfCnpj guardado no User também — pode trocar em call separada futura. |

---

## 8. Estimativa

| Etapa | Esforço |
|---|---|
| Migration cpfCnpj + checkoutSessionId + backup | 20min |
| `lib/validation/cpf-cnpj.ts` | 30min |
| `lib/asaas/pix.ts` | 45min |
| `lib/asaas/checkout-hosted.ts` | 30min |
| 4 endpoints (POST pix, GET pix/status, POST cartao, /sucesso) | 1h30 |
| UI `/assinar` dark imersivo (toggle, planos, QR Pix, redirect cartão) | 2h30 |
| Testes ~22 | 1h30 |
| Build + deploy + smoke prep (instruções pro Yussef) | 30min |
| **Total** | **~8h** (1h acima do estimado original, justificado por UI dark premium) |

---

## 9. Checkpoint de aprovação

- [ ] **Decisão produto Pix one-off vs Pix recorrente (scheduler)**: ⭐ one-off (UX honesta)
- [ ] OK schema: `User.cpfCnpj String?` + `Subscription.checkoutSessionId String?`
- [ ] OK fluxo Pix: customer → payment → qrCode → polling status → ACTIVE
- [ ] OK fluxo Cartão: hosted checkout (RECURRENT) → redirect → /sucesso → ACTIVE (provisório, 3C confirma)
- [ ] OK ativação provisória (3B) + confirmação webhook (3C) coexistirem
- [ ] OK visual `/assinar` dark imersivo violeta (continuidade landing)
- [ ] OK +22 testes (alvo +20)
- [ ] OK estimativa 8h

---

## 10. Roadmap

- 🚧 **3B (esta)**: Pix one-off + Cartão hosted recorrente, ativação provisória
- 🚧 **3C**: webhook (`PAYMENT_RECEIVED`, `SUBSCRIPTION_DELETED`, `PAYMENT_OVERDUE`), idempotência por `eventId`, fonte da verdade
- 🚧 **3D**: produção (chave + env) + smoke real R$ 0,01

Aguardando seu **APROVADO** ou ajustes nas decisões.
