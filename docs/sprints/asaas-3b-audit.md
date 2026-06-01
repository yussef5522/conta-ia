# Sprint Asaas FATIA 3B — Checkout (CHECKPOINT PCI)

**Branch:** `feature/asaas-3b-checkout`
**Data:** 31/05/2026
**Status:** 🚨 **BLOQUEADOR PCI DETECTADO — aguardando decisão Yussef antes de codar cartão**

---

## 0. TL;DR — leitura obrigatória de 3 linhas

> A doc oficial do Asaas é categórica: **"O Asaas NÃO fornece a opção de Tokenização Client-Side, via front-end"**. Qualquer fluxo onde o cartão passa pelo nosso servidor (API direta OU "tokenização server-side") cai obrigatoriamente em **PCI SAQ-D** — auditoria anual, custo alto, complexidade enorme, exposição legal.
>
> O brief original ("checkout transparente dentro do CAIXAOS") é **incompatível com SAQ-A**.
>
> Pra manter SAQ-A precisamos usar o **Asaas Checkout hosted** (redirect pra `asaas.com/checkoutSession/show`). Pix continua transparente naturalmente (Pix não tem dado PCI).

---

## 1. Fontes oficiais que pesquisei

| Doc | URL | O que confirma |
|---|---|---|
| PCI DSS | [docs.asaas.com/docs/pci-dss-1](https://docs.asaas.com/docs/pci-dss-1) | SAQ por modalidade |
| Tokenização | [docs.asaas.com/reference/tokenizacao-de-cartao-de-credito](https://docs.asaas.com/reference/tokenizacao-de-cartao-de-credito) | É server-side; rota: `POST /v3/creditCard/tokenizeCreditCard` |
| Criar assinatura cartão | [docs.asaas.com/docs/criando-assinatura-com-cartao-de-credito](https://docs.asaas.com/docs/criando-assinatura-com-cartao-de-credito) | 4 vias: API direta · Asaas Checkout · Tokenização · Link |
| Checkout recorrente | [docs.asaas.com/docs/checkout-com-assinatura-recorrente](https://docs.asaas.com/docs/checkout-com-assinatura-recorrente) | `chargeTypes: ["RECURRENT"]` + `cycle: "MONTHLY"\|"YEARLY"` |
| Asaas Checkout | [docs.asaas.com/docs/asaas-checkout](https://docs.asaas.com/docs/asaas-checkout) | Suporta Pix + Cartão na mesma sessão |
| Criar checkout | [docs.asaas.com/reference/create-new-checkout](https://docs.asaas.com/reference/create-new-checkout) | `POST /v3/checkouts` → retorna `id` |
| Link/redirect | [docs.asaas.com/docs/checkout-link-and-customer-redirection](https://docs.asaas.com/docs/checkout-link-and-customer-redirection) | URL: `https://asaas.com/checkoutSession/show?id=ID` |

---

## 2. PCI DSS — análise rigorosa

### 2.1 Tabela de SAQ por método (citações da doc oficial)

| Método | Cartão toca nosso servidor? | **SAQ** | Viabilidade Solo |
|---|---|---|---|
| 🟢 **Asaas Checkout** (hosted) | NÃO | **SAQ-A** | ✅ viável |
| 🟢 **Fatura Asaas** (PDF link) | NÃO | **SAQ-A** | ✅ viável |
| 🟢 **Link de Pagamento** | NÃO | **SAQ-A** | ✅ viável |
| 🔴 **API Asaas** (direto) | SIM (no payload) | **SAQ-D** | ❌ inviável MVP |
| 🔴 **Tokenização Server-Side** | SIM (antes do token) | **SAQ-D** | ❌ inviável MVP |

**Citação:** *"Tokenização Server-Side: Required SAQ-D. Card data reaches the merchant's server before tokenization occurs."*

### 2.2 Por que SAQ-D mata o MVP

| Item | SAQ-A (hosted) | SAQ-D (API/server-side) |
|---|---|---|
| Auditoria | self-assessment anual simples | **QSA externo + ASV scan trimestral** |
| Custo | gratuito | **~R$ 30k-60k/ano** (consultoria + auditoria) |
| Tempo de implementação | semanas | **6-12 meses** (security review, logs, segmentação de rede, key management) |
| Exposição legal | LGPD padrão | LGPD + **responsabilidade direta** por dado de cartão |
| Renovação | anual leve | **anual pesada** + ressubmissão sob qualquer mudança arquitetural |
| Multa por incidente | LGPD/contrato | **bandeiras (Visa/Master) podem aplicar multas de USD 5k-100k** + responsabilização criminal |

**Pra CAIXAOS pré-receita / pré-investimento: matador.**

### 2.3 Por que o Asaas NÃO oferece tokenização client-side

Provavelmente decisão deles pra simplificar onboarding regulatório dos próprios merchants. **Stripe, PagSeguro, Mercado Pago todos têm** (Stripe Elements / iframe). **Asaas não.**

Esta é uma diferença significativa do Asaas vs Stripe que **mudou minha leitura inicial do brief**. O brief assumiu que existia tokenização client-side; ela não existe na plataforma escolhida.

---

## 3. Caminhos possíveis (escolher 1 antes de codar)

### 🟢 **Opção A — Asaas Checkout hosted (recomendado)**

**Fluxo:**
1. Cliente clica "Assinar Inteligência" no CAIXAOS
2. UI CAIXAOS mostra resumo do plano + escolha Mensal/Anual
3. Backend cria `POST /v3/checkouts` com `chargeTypes:["RECURRENT"]`, `billingTypes:["CREDIT_CARD","PIX"]`, `subscription:{cycle:"MONTHLY"|"YEARLY"}`, `callback:{successUrl:"https://app.caixaos.com.br/assinar/sucesso"}`
4. Backend retorna o ID, frontend redireciona pra `https://asaas.com/checkoutSession/show?id=<id>`
5. Cliente paga (cartão OU Pix) no Asaas
6. Asaas redireciona de volta pra `successUrl`
7. **Webhook (Fatia 3C)** confirma o pagamento e marca `Subscription.status='ACTIVE'`

**Prós:**
- **SAQ-A confirmado**
- Pix + Cartão na mesma página (decisão do customer)
- Asaas Checkout é mantido pelo time deles (atualizações de segurança automáticas)
- UI deles tem fluxos de 3DS, antifraude, e validação prontos
- Implementação reduzida no nosso lado (~30% da estimativa original)
- Suporta `customerData` pré-preenchido (já temos nome/email; cpfCnpj coletado antes)

**Contras:**
- Cliente **sai do CAIXAOS** durante o pagamento (~15s)
- Não é "Netflix-like" (Netflix tem licenças PCI massivas que SaaS pequeno não pode)
- Branding do Asaas aparece (`asaas.com/checkoutSession/...`) — domínio dele
- Se quiser visualmente coeso no futuro: Asaas tem custom CSS no Checkout (sob negociação) ou subdomain branding (planos pagos)

**Diferença vs Netflix/SaaS grandes:** Netflix é PCI Level 1 certificado + tem times de security dedicados. **SaaS pequeno BR que quer cartão "no próprio domínio" usa hosted iframe (Stripe Elements) ou aceita SAQ-D.** Como o Asaas não tem iframe e SAQ-D é inviável, o hosted é o único caminho realista.

### 🔵 **Opção B — Híbrido: Pix transparente + Cartão hosted**

**Fluxo:**
1. UI mostra os planos + escolha de método (Pix ou Cartão)
2. **Se Pix:** backend chama `POST /v3/payments` (one-off) ou `POST /v3/subscriptions billingType:PIX` (recorrente). Asaas retorna QR code. CAIXAOS mostra o QR code dentro da página. **Mantém transparência pra Pix.**
3. **Se Cartão:** redirect pro Asaas Checkout (como Opção A)

**Prós:**
- Pix continua "transparente" (não tem PCI, então não há problema)
- Cartão hosted = SAQ-A
- **65% dos pagamentos B2B BR são Pix** (dados BACEN 2025) → maioria dos clientes vai ficar no CAIXAOS

**Contras:**
- 2 fluxos pra manter
- Pix recorrente no Asaas tem limitações (cliente precisa autorizar cada mês manual? checar)

### 🔴 **Opção C — SAQ-D (NÃO recomendado)**

Aceitar a auditoria PCI-DSS SAQ-D pra ter checkout 100% transparente. Custo R$ 30k-60k/ano + 6-12 meses pra estar conforme. **Inviável pra MVP.**

### 🟡 **Opção D — Trocar gateway**

Stripe Brasil ou Pagar.me oferecem **tokenização client-side via iframe** (Stripe Elements / Pagar.me JS) → cartão nunca toca nosso servidor → **SAQ-A com transparência total**. Mas precisaria rejogar TODA a Fatia 3A (lib/asaas/* viraria lib/stripe/*) e perde a Asaas que já está integrada.

**Vale considerar?** Talvez não agora. Asaas tem ótimos preços e processo PJ ágil pra Brasil. Mas registrar como **decisão consciente** (Asaas = hosted; se quisermos transparente no futuro, troca de gateway é o caminho).

---

## 4. Recomendação minha

**⭐ Opção B — Híbrido**

1. **Pix transparente dentro do CAIXAOS** (maioria dos clientes BR + sem PCI)
2. **Cartão via Asaas Checkout hosted** (redirect rápido, volta com sucesso/falha)

Equilíbrio entre UX (Pix transparente = 65% dos casos) e segurança (cartão hosted = SAQ-A). **Ninguém perde**:
- Cliente que paga Pix: tem experiência 100% CAIXAOS
- Cliente que paga cartão: pequena fricção (~15s no Asaas) em troca de cobrança automática mensal

---

## 5. Mudanças no plano original

### Schema
- ✅ `Subscription.gatewaySubscriptionId` (já existe)
- ✅ `Subscription.gatewayCustomerId` (já existe)
- ➕ Novo opcional: `Subscription.checkoutSessionId String?` (rastreia a sessão pendente — usado pra polling/dedup)
- ➕ User precisa de `cpfCnpj` — adicionar campo + validar

### Lib
- `lib/asaas/checkouts.ts` — NOVO. Cria sessão de checkout hosted.
- `lib/asaas/payments.ts` — NOVO. Cria cobrança Pix one-off + retorna QR code.
- `lib/asaas/subscriptions.ts` — REDESENHADO. Cria assinatura Pix recorrente direto OU vincula resultado do checkout hosted.
- ~~`lib/asaas/credit-card.ts` — NÃO faz mais sentido (tokenização não cabe no SAQ-A)~~

### Endpoints
- `POST /api/subscription/checkout/cartao` — cria sessão Asaas Checkout, retorna URL pra redirect
- `POST /api/subscription/checkout/pix` — cria cobrança Pix, retorna QR code
- `GET /api/subscription/checkout/status` — polling do pagamento Pix
- `GET /assinar/sucesso` — landing pós-checkout hosted (cliente volta aqui)

### UI
- `/assinar` — duas opções: card "Pagar com Pix (instantâneo)" + card "Pagar com Cartão (mensal automático)"
- Pix: QR code + copia-cola + countdown + polling status
- Cartão: botão "Continuar pra pagamento seguro" → redirect Asaas
- `/assinar/sucesso` — celebração + redirect /dashboard

### Estimativa revisada
| Etapa | Original | Revisado |
|---|---|---|
| Lib | 2h | 1h30 |
| Endpoints | 1h30 | 1h |
| UI | 3h | 2h |
| Testes | 1h30 | 1h30 |
| Build/deploy/smoke | 1h | 1h |
| **Total** | **9h** | **~7h** |

Menos código = menos risco. SAQ-A confirmado.

---

## 6. ❓ Checkpoint — preciso da sua decisão

- [ ] **Opção A** (Cartão+Pix tudo hosted) — máxima simplicidade, fricção em ambos
- [ ] ⭐ **Opção B (recomendado)** — Pix transparente + Cartão hosted
- [ ] **Opção C** — aceitar SAQ-D agora *(NÃO recomendo)*
- [ ] **Opção D** — trocar pra Stripe/Pagar.me *(decisão grande, atrasa tudo)*
- [ ] **Pausar 3B** e propor outro caminho

### Confirmar também:
- [ ] OK adicionar `User.cpfCnpj` (coletado em form simples antes do checkout)
- [ ] OK redirect Asaas Checkout pra cartão (cliente vê `asaas.com` por ~15s)
- [ ] OK Webhook (Fatia 3C) ser o caminho oficial de confirmação ACTIVE
- [ ] Visual do `/assinar`: dark imersivo violeta (continuar identidade da landing) ou claro (estilo dashboard)?

---

## 7. Roadmap 3C / 3D revisado

### 3C — Webhook (mesmo brief)
Receber `PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED` / `SUBSCRIPTION_DELETED`. Idempotência via `eventId`. Mantém PCI escopo zero (nunca chega dado de cartão pelo webhook).

### 3D — Promoção pra produção
1. Yussef gera chave Asaas **produção**
2. Yussef pede ao gerente de contas: **habilitar checkout PCI-A** (já solicitou; tokenização também aproveitando)
3. Yussef troca `.env`: `ASAAS_API_KEY=<prod>` + `ASAAS_ENV=production`
4. `pm2 restart --update-env`
5. Smoke real com R$ 0,01

**Nada muda em código entre sandbox e produção.** ✅

---

**Aguardando seu OK** numa das opções (Opção B recomendada) antes de eu codar uma linha.
