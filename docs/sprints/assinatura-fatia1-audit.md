# Sprint Engine de Assinatura — FATIA 1 (sem pagamento)

**Branch:** `feature/assinatura-engine-fatia1`
**Data:** 31/05/2026
**Status:** ⏳ aguardando aprovação do Yussef (2 perguntas no final)

---

## 1. O que JÁ existe (reusar — não recriar)

### 1.1 Planos (`lib/planos/config.ts`) — fonte ÚNICA, 4 planos
| id | nome | preço | empresas | temIA | destaque |
|---|---|---|---|---|---|
| `inicio` | Início | R$ 29,99 | 1 | ❌ | — |
| `controle` | Controle | R$ 89,99 | 3 | ❌ | — |
| `inteligencia` | Inteligência | R$ 149,99 | 10 | ✅ | ⭐ |
| `performance` | Performance | R$ 349,99 | `Infinity` | ✅ | — |

Helpers: `featuresCumulativas(planoId)`, `formatPreco(valor)`, constante `DESCONTO_ANUAL = 0.2`.

### 1.2 Cupons (sistema enterprise, Sprint 1.7)
- **Models:** `Coupon` + `CouponRedemption` (snapshot completo no resgate)
- **3 tipos:** `PERCENTAGE`, `FIXED_AMOUNT`, `FREE_MONTHS` (com campo `freeMonths Int?`)
- **Libs:** `validate`, `apply` (atomic + audit), `format`, `types`
- **API pública:** `POST /api/coupons/validate` com rate-limit + anti-enumeration
- **Resgate atual:** `redeemCoupon(code, userId, ctx)` chamado **fire-and-forget** no cadastro (`app/api/auth/cadastro/route.ts:69-79`)

### 1.3 🚨 FREE_MONTHS ESTÁ ÓRFÃO HOJE
`lib/coupons/apply.ts` apenas:
1. INSERT `CouponRedemption` (snapshot)
2. `UPDATE Coupon SET currentUses += 1`
3. Audit `COUPON_REDEEMED`

**Nada consome o `freeMonths`** pra estender período de trial/assinatura. Esta fatia conecta isso.

### 1.4 Cadastro (`POST /api/auth/cadastro`)
- Cria user → assina JWT → seta cookie → fire-and-forget `redeemCoupon` (background)
- Não bloqueia o signup se cupom falhar
- ⚠️ Pra conectar trial+freeMonths, vou precisar mudar o resgate de fire-and-forget pra SÍNCRONO ANTES da criação da Subscription (ou criar Subscription com `trialEndsAt = +14d`, depois esticar se cupom valida em background).

### 1.5 Proxy bloqueio (padrão `mustChangePassword`)
`proxy.ts:144-218` tem 2 camadas:
- **PUBLIC_PAGES**: se user logado tenta acessar `/login`/`/cadastro`/`/`/etc → redirect (mas se `mustChangePassword=true` → `/trocar-senha` em vez de `/dashboard`)
- **Protegidas**: se token tem `mustChangePassword=true` → bloqueia tudo exceto whitelist (`/trocar-senha`, change-password endpoint, logout, me)

**Mesmo padrão exato pra EXPIRED**: flag no JWT + whitelist → `/assinar` (placeholder).

### 1.6 Estado real de prod (4 users)
| Email | Empresas | Transações | Perfil |
|---|---|---|---|
| `admin@contaia.com.br` | 2 | **2169** | 🎯 Yussef principal — DADOS REAIS |
| `nouraawni90@gmail.com` | 1 | 0 | Família (Nura) — conta criada mas sem uso |
| `yussefmusa5522@gmail.com` | 0 | 0 | Segundo email do Yussef — sem uso |
| `newuser-1779151369@...` | 0 | 0 | Conta de teste |

**Risco de quebra na migration:** baixo. **Só 1 user produtivo.** Mas decisão precisa ser registrada pra futuros bulk-create.

---

## 2. Proposta — Model `Subscription`

```prisma
model Subscription {
  id     String @id @default(cuid())
  userId String @unique // 1 assinatura por user (Fatia 1)

  // Plano contratado (referência o id de lib/planos/config.ts)
  // Valores válidos: 'inicio' | 'controle' | 'inteligencia' | 'performance'
  planId String

  // Estado da assinatura. String + comment (mesmo padrão dos outros models).
  // TRIAL    — em período de teste grátis (trialEndsAt no futuro)
  // ACTIVE   — paga e em dia
  // EXPIRED  — trial acabou OU pagamento parou
  // CANCELED — user cancelou explicitamente
  // PAST_DUE — cobrança falhou (Fatia 3 — futuro)
  // GRANTED  — concedida sem cobrança (early adopter / equipe — pra Decisão #1)
  status String @default("TRIAL")

  // Trial 14 dias contados do cadastro (CAN ser estendido por cupom FREE_MONTHS).
  // null quando assinatura não-trial (ACTIVE/GRANTED direto).
  trialEndsAt DateTime?

  // Fim do ciclo pago atual (Fatia 3 preenche). null no trial.
  currentPeriodEnd DateTime?

  canceledAt DateTime?

  // Sprint 1.7 → CouponRedemption.couponId que originou desconto/trial estendido.
  // null = sem cupom. Snapshot pra audit se cupom for desativado depois.
  originCouponId String?

  // ===== Fatia 3 (pagamento) — nullable, preparado mas não usado =====
  gatewayCustomerId     String?
  gatewaySubscriptionId String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([status])
  @@index([trialEndsAt])
  @@map("subscriptions")
}
```

**Decisões de schema:**
- `userId @unique` — 1 user, 1 assinatura (multi-conta vem em fatia futura)
- `planId String` — não enum, refere o `PlanoId` de TypeScript. Validação no app-layer (zod). Permite adicionar plano sem migration.
- `status String` — mesmo padrão dos demais models (Coupon, User.role, etc)
- `originCouponId` — snapshot do cupom que originou o trial estendido (audit)
- 6 campos nullable de gateway pra Fatia 3 → 0 mudança de schema quando plugar Asaas
- `onDelete: Cascade` — apagar user (admin DELETE) limpa subscription (consistente com `delete-user-cascade.ts`)

---

## 3. Onde a engine vai morar

```
lib/subscription/
├── types.ts                 — SubscriptionStatus, GetSubscriptionResult
├── access.ts                — funções puras (canAccessFeature, getEmpresaLimit, isTrialExpired)
├── compute-status.ts        — lógica de "TRIAL com trialEndsAt no passado → EXPIRED" (lazy/derivado)
├── create-trial.ts          — cria Subscription TRIAL no cadastro
├── apply-coupon-bonus.ts    — soma freeMonths no trialEndsAt
└── queries.ts               — getSubscriptionByUserId, getActiveSubscription

app/api/subscription/
└── me/route.ts              — GET retorna status do user logado pro banner
```

### Acesso (`lib/subscription/access.ts`)
```ts
export function getEmpresaLimit(planoId: PlanoId): number
// 1 | 3 | 10 | Infinity

export function canAccessFeature(planoId: PlanoId, feature: Feature): boolean
// Feature = 'ia' | 'multi-empresa' | 'export-pdf' | 'conciliacao' | ...

export function isTrialExpired(sub: { status: string; trialEndsAt: Date | null }, now = new Date()): boolean
// true se status=TRIAL E trialEndsAt < now

export function computeDerivedStatus(sub, now): 'TRIAL' | 'ACTIVE' | 'EXPIRED' | ...
// Status "lazy": se DB diz TRIAL mas trialEndsAt passou, derivada vira EXPIRED
// (não precisa job de cron — calculado on-read)
```

Funções 100% puras (sem Prisma) → testáveis isoladamente.

---

## 4. Mudanças nos arquivos existentes

### 4.1 `app/api/auth/cadastro/route.ts`
Mudança CRÍTICA: resgate do cupom precisa ser **SÍNCRONO** antes de criar Subscription (pra esticar trialEndsAt se for FREE_MONTHS). Mas pra não quebrar UX:
- Mantém o fire-and-forget do cupom como fallback se a validação síncrona falhar
- Cria Subscription **sempre** com trial 14d
- Se cupom valida + FREE_MONTHS → estica trialEndsAt em `freeMonths * 30 dias`
- Audit `COUPON_REDEEMED` + `metadata: {trialExtensionDays: freeMonths*30}`

### 4.2 `lib/auth.ts` (TokenPayload)
Adicionar flag opcional `subscriptionExpired?: boolean` (mesmo padrão de `mustChangePassword`). JWT carrega → middleware bloqueia sem DB lookup.

⚠️ **Decisão técnica:** flag fica STALE se status mudar em background (cron, webhook do Asaas futuro). Solução: recalcular flag no login + endpoint manual "refresh session". MVP aceita stale até próximo login.

### 4.3 `proxy.ts`
2 mudanças, mesmo padrão de `mustChangePassword`:
- PUBLIC_PAGES: se logado E `subscriptionExpired=true` E `path !== '/assinar'` → redirect `/assinar`
- Protegidas: bloqueia tudo exceto whitelist (`/assinar`, `/api/subscription/*`, logout, me, change-password)

### 4.4 `/api/auth/login` 
Computa `subscriptionExpired` no momento do login (1 query extra) → assina JWT com a flag.

### 4.5 `app/(dashboard)/layout.tsx` (banner trial)
Server component que mostra "Trial: X dias restantes" no topo. Some quando ACTIVE/GRANTED.

### 4.6 `app/assinar/page.tsx` (placeholder)
Rota nova em raiz (igual `/trocar-senha`). Mostra "Seu trial acabou. Em breve você poderá assinar um plano." + link "Sair". **Sem checkout real** — Fatia 3.

---

## 5. Testes (alvo +25)

```ts
describe('lib/subscription/access.ts (puras)', () => {
  // getEmpresaLimit
  test('inicio=1, controle=3, inteligencia=10, performance=Infinity')
  // canAccessFeature
  test('ia: false em inicio/controle, true em inteligencia/performance')
  test('multi-empresa: scaling correto')
  // isTrialExpired
  test('TRIAL + trialEndsAt no futuro → false')
  test('TRIAL + trialEndsAt no passado → true')
  test('ACTIVE → false (não importa data)')
  test('respeita o now injetado (não usa Date.now)')
  // computeDerivedStatus
  test('TRIAL expired vira EXPIRED na leitura')
  test('GRANTED nunca expira')
})

describe('createTrial', () => {
  test('cria subscription planId=inteligencia, status=TRIAL, trialEndsAt=+14d')
  test('idempotente: chamada 2x retorna a mesma subscription')
})

describe('applyCouponBonus (FREE_MONTHS)', () => {
  test('cupom 1 mês free → +30 dias no trialEndsAt')
  test('cupom 3 meses → +90 dias')
  test('PERCENTAGE/FIXED_AMOUNT não afetam trial (futura aplicação no preço)')
  test('grava originCouponId no Subscription')
})

describe('/api/auth/cadastro com subscription', () => {
  test('user novo recebe trial inteligencia 14d')
  test('user novo + cupom FREE_MONTHS=2 → trial 14+60=74 dias')
  test('cupom inválido não bloqueia signup (trial 14d default)')
})

describe('/api/auth/login', () => {
  test('user com trial vigente → JWT com subscriptionExpired=false')
  test('user com trial expirado → JWT com subscriptionExpired=true')
  test('user GRANTED → sempre false')
})

describe('proxy.ts bloqueio EXPIRED', () => {
  test('EXPIRED tentando /dashboard → redirect /assinar')
  test('EXPIRED no /assinar → permite (não loop)')
  test('EXPIRED em API normal → 403 SUBSCRIPTION_EXPIRED')
  test('EXPIRED em /api/auth/logout → permite (sair)')
})

describe('GET /api/subscription/me', () => {
  test('retorna status + plano + dias restantes')
  test('user sem subscription → 404 (ou auto-cria? decidir)')
})

describe('Migration de dados', () => {
  test('users existentes recebem subscription conforme decisão Yussef')
})
```

Total esperado: **~28-32 testes**.

---

## 6. Riscos identificados

| # | Risco | Mitigação |
|---|---|---|
| 1 | **Cupom resgatado MAS Subscription falha de criar** → freeMonths perdido | Atomic via `prisma.$transaction([createSub, redeemCoupon])`. Refatorar `redeemCoupon` pra aceitar `tx` opcional. |
| 2 | **Race condition** 2 abas signup → 2 trials | `Subscription.userId @unique` resolve. Tentativa duplicada → unique violation → ignora. |
| 3 | **Flag stale no JWT** (trial expirou mas user já logado, JWT diz não-expirado) | MVP: trial dura 24h máx de inconsistência (TTL do JWT). Adequado pra Fatia 1. Fatia 3 vai ter webhook + refresh. |
| 4 | **Bloqueio agressivo de feature** quebra early adopter | **Pergunta #2 abaixo.** Por padrão Fatia 1: NÃO aplica limites. Só expõe as funções. |
| 5 | **User sem subscription** (race condition, falha de migration) | Helper `getOrCreateSubscription(userId)` lazy. Cria trial 14d se não existir (gracioso). |
| 6 | **Audit log do trial-by-coupon não rastreia** | Já adiciono `metadata.trialExtensionDays` no audit `COUPON_REDEEMED`. |

---

## 7. ❓ Checkpoint — 2 perguntas pro Yussef

### 🅰️ Como tratar os 4 users JÁ existentes em prod?

| Opção | Comportamento |
|---|---|
| **A1** — Trial 14d normal | Migration cria todos com `status=TRIAL trialEndsAt=+14d`. Eles têm 14d a partir de hoje. **Risco: Yussef (admin@contaia, 2169 tx) entra em modo "trial" e expira em 14d**. |
| **A2** — Status `GRANTED` vitalício pros early adopters | Migration cria com `status=GRANTED trialEndsAt=null`. Nunca expira. Adequado pra Yussef + Nura (sócios/família). Comportamento: usuários atuais ficam acessando tudo sem pagar — "presente de pioneiro". |
| **A3** — A1 mas só pros não-Yussef + GRANTED só pro admin | Yussef recebe GRANTED. Outros 3 recebem trial 14d normal. **Mas Nura é "família" — vai expirar do nada.** |
| **A4** ⭐ recomendado | **GRANTED vitalício pros 4 atuais** (eles são todos teste/família). Quando Fatia 3 abrir, Yussef troca manualmente o status pra ACTIVE se for cobrar de algum (Nura, etc). Migration registra `metadata.reason = 'early-adopter-pre-paywall'` no audit. |

### 🅱️ Aplicar limites de plano agora (Fatia 1) OU deixar pra fatia separada?

| Opção | Comportamento |
|---|---|
| **B1** — Limites HARD agora | Trial dá `inteligencia` (10 empresas + IA). Mas se você baixar pra `controle` no futuro, **vai bloquear criar 11ª empresa, IA fica indisponível**. Pode quebrar fluxo de uso ativo. |
| **B2** ⭐ recomendado — Só EXPÕE as funções (`canAccessFeature`, `getEmpresaLimit`), zero aplicação dura | Funções estão prontas pra uso quando UI quiser exibir mensagens ("upgrade pra criar 11ª empresa"). Mas nada bloqueia hoje. **Sem surpresas pros 4 users atuais.** |
| **B3** — Aplica SÓ no `inicio` (mais restritivo) | Trial não vai pra `inicio`, então ninguém é afetado. Mas quando alguém escolher `inicio` no futuro, já bloqueia naturalmente. |

---

## 8. Estimativa de esforço (após aprovação)

| Etapa | Esforço |
|---|---|
| Schema + migration `Subscription` + backup | 20min |
| `lib/subscription/` (4 arquivos puros + queries) | 1h |
| Refator cadastro + cupom síncrono + trial extension | 45min |
| `lib/auth.ts` + login compute flag + proxy bloqueio | 45min |
| `/assinar` placeholder + banner trial | 30min |
| Migration de dados users existentes (depende da decisão A) | 15min |
| Testes ~30 | 1h30 |
| Build + deploy + smoke | 30min |
| **Total** | **~5h** |

---

## 9. Checklist de aprovação

- [ ] **A. Tratamento users existentes** → A1 / A2 / **A3** / **A4** ⭐
- [ ] **B. Aplicar limites agora** → B1 / **B2** ⭐ / B3
- [ ] Confirmar `SubscriptionStatus` valores: `TRIAL | ACTIVE | EXPIRED | CANCELED | PAST_DUE | GRANTED` (✨ GRANTED é novo)
- [ ] Confirmar trial = 14 dias no plano **inteligencia** (mostra IA = âncora de valor)
- [ ] OK pra cupom resgate ficar **síncrono** no cadastro (era fire-and-forget)
- [ ] OK pro placeholder `/assinar` (sem checkout real — Fatia 3)
- [ ] Bloqueio EXPIRED via flag no JWT + middleware (mesmo padrão `mustChangePassword`)
