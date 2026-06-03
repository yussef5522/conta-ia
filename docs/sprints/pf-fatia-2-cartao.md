# Sprint PF FATIA 2 — Cartão de crédito robusto

> **Status:** 📋 Plano detalhado — AGUARDANDO REVISÃO/APROVAÇÃO
> **Branch alvo:** `feature/pf-fatia-2-cartao` (a criar)
> **Pré-requisito:** Fatia 1 (fundação PF) deployada ✅ (commit `5f4aa33`)
> **Doc estratégico:** `docs/sprints/pf-perfis-estudo.md` seção 5 (já tem desenho rascunhado)
> **Duração estimada:** 7-9 dias
> **Data do plano:** 02/06/2026

---

## 1. Schema (2 models novos + 6 colunas aditivas em PersonalTransaction)

### 1.1 `CreditCard` — cartão de crédito

```prisma
model CreditCard {
  id        String @id @default(cuid())
  profileId String  // Fatia 2 SÓ PF (PJ futuro)

  // Identificação
  name        String              // "Nubank Roxinho", "Itaú Personnalité"
  bankName    String?
  lastDigits  String?              // últimos 4 dígitos (auditoria; nunca o número completo)
  brand       String?              // VISA | MASTERCARD | ELO | AMEX | HIPERCARD

  // Limite e datas
  creditLimit Float                // limite total do cartão
  closingDay  Int                  // 1-31: dia do fechamento
  dueDay      Int                  // 1-31: dia do vencimento

  // ⚠️ Regra do dia do fechamento (pegadinha #1 do estudo):
  // ATUAL  — compra NO dia do fechamento entra na fatura que fecha hoje
  //          (regra geral da maioria — Nubank, Itaú, Bradesco)
  // PROXIMA — compra NO dia do fechamento entra na PRÓXIMA fatura
  //          (alguns bancos invertem; user ajusta se conhecer o cartão dele)
  closingDayRule String @default("ATUAL")

  // Conta padrão que paga a fatura (PersonalBankAccount.id).
  // null → user escolhe a cada pagamento.
  defaultPaymentAccountId String?

  isActive Boolean @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  profile               PersonalProfile      @relation(fields: [profileId], references: [id], onDelete: Cascade)
  defaultPaymentAccount PersonalBankAccount? @relation("CardDefaultPayment", fields: [defaultPaymentAccountId], references: [id], onDelete: SetNull)
  invoices              CreditCardInvoice[]
  transactions          PersonalTransaction[]

  @@index([profileId])
  @@map("credit_cards")
}
```

### 1.2 `CreditCardInvoice` — fatura mensal

```prisma
model CreditCardInvoice {
  id           String @id @default(cuid())
  creditCardId String

  // Mês de competência da fatura (YYYY-MM do mês do fechamento).
  // Ex: cartão fecha dia 5; fatura "2026-06" fecha em 05/06/2026.
  // UNIQUE por cartão — garante 1 fatura por mês por cartão.
  reference    String

  closingDate  DateTime              // data exata do fechamento
  dueDate      DateTime              // data exata do vencimento

  totalAmount  Float @default(0)     // soma das tx vinculadas
  paidAmount   Float @default(0)     // quanto já foi pago

  // Estado:
  // OPEN     — date <= closingDate (ainda aceita lançamentos)
  // CLOSED   — closingDate < now <= dueDate (aguarda pagamento)
  // PAID     — paga total (paidAmount >= totalAmount)
  // PARTIAL  — paga parcial (rotativo gerou tx na próxima)
  // OVERDUE  — vencida sem pagar
  status       String @default("OPEN")

  // Rastreabilidade do rotativo:
  // Se essa fatura foi GERADA por carry-over de uma fatura anterior parcial,
  // aponta pra ela. Pra invoice normal = null.
  carryoverFromInvoiceId String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  creditCard   CreditCard            @relation(fields: [creditCardId], references: [id], onDelete: Cascade)
  carryoverFrom CreditCardInvoice?   @relation("CarryoverChain", fields: [carryoverFromInvoiceId], references: [id], onDelete: SetNull)
  carryoverTo   CreditCardInvoice[]  @relation("CarryoverChain")
  transactions PersonalTransaction[]

  @@unique([creditCardId, reference])
  @@index([creditCardId, status])
  @@index([dueDate])
  @@map("credit_card_invoices")
}
```

### 1.3 `PersonalTransaction` ganha 6 campos opcionais (ALTER aditivo)

```prisma
// Adicionar ao model PersonalTransaction existente:

// === Fatia 2 — Cartão de crédito ===
// Quando preenchidos, esta tx é uma compra/pagamento de cartão.
// NULL = tx normal (Fatia 1 — entrada/saída direta em conta bancária).
creditCardId        String?
creditCardInvoiceId String?

// Parcelamento: compra Nx gera N tx com o MESMO installmentGroupId
installmentNumber   Int?       // 1, 2, 3, ... (qual parcela)
installmentTotal    Int?       // total de parcelas da compra (N)
installmentGroupId  String?    // UUID que une as N parcelas

// True quando esta tx é o PAGAMENTO da fatura (debita conta bancária).
// False (default) = compra ou crédito normal.
isInvoicePayment    Boolean @default(false)

// Relations novas:
creditCard        CreditCard?         @relation(fields: [creditCardId], references: [id], onDelete: SetNull)
creditCardInvoice CreditCardInvoice?  @relation(fields: [creditCardInvoiceId], references: [id], onDelete: SetNull)
```

### 1.4 `PersonalBankAccount` ganha relação reversa

```prisma
// Adicionar:
cardDefaultPayments CreditCard[] @relation("CardDefaultPayment")
```

---

## 2. Migration (100% ADITIVA — zero risco)

**Arquivo:** `prisma/migrations/<TS>_pf_fatia_2_cartao/migration.sql`

**Conteúdo:**
- 2× `CREATE TABLE` (credit_cards, credit_card_invoices)
- 1× `ALTER TABLE personal_transactions ADD COLUMN` × 6 (5 nullables + 1 boolean default false)
- ~10× `CREATE INDEX`
- 5× `ADD CONSTRAINT FK` (creditCard→profile/defaultPayment, invoice→creditCard/carryover, tx→creditCard/invoice)

**Zero ALTER em:**
- ❌ users, companies, transactions PJ, bank_accounts, categories (dados reais 5 users + 2907 tx)
- ❌ subscriptions, webhook_events, socios_pf (Asaas 3C / Sprint 5.0.2.h)
- ❌ personal_profiles, user_personal_profiles, personal_categories, personal_bank_accounts (Fatia 1 intacta)

**Proteção:**
1. `pg_dump -Fc` ANTES (igual fizemos no 3C e na Fatia 1)
2. File size check + pg_restore --list (legibilidade)
3. Counts pré/pós: users / companies / transactions / subscriptions / personal_profiles / personal_transactions devem ficar iguais
4. As 4 tabelas novas (credit_cards, credit_card_invoices) começam vazias
5. `ALTER TABLE personal_transactions` é seguro: todas as 6 colunas são nullable + 1 boolean com default false → linhas existentes ficam com NULL/false, comportamento inalterado

---

## 3. Lib pura (funções testáveis sem DB)

### 3.1 `lib/dates/add-months.ts` (refactor — extrair de `lib/asaas/webhook.ts`)

```ts
/**
 * Soma N meses preservando UTC. Clamp pro último dia se mês alvo é menor.
 * Ex: 31/jan + 1 mês = 28/fev (não 03/mar).
 * 29/fev bissexto + 1 ano = 28/fev não-bissexto.
 *
 * Reutilizado de lib/asaas/webhook.ts (Sprint 3C). Movido pra
 * lib/dates pra ser genérico (cartão usa pra calcular parcelas + faturas).
 */
export function addMonths(d: Date, n: number): Date { ... }
export function addYears(d: Date, n: number): Date { ... }
```

**Migração:** `lib/asaas/webhook.ts:calculateNextPeriodEnd` passa a importar daqui. Sem mudança de comportamento.

### 3.2 `lib/credit-card/calculate-invoice-reference.ts`

Calcula em qual fatura uma compra cai.

```ts
export interface InvoiceReferenceResult {
  reference: string      // "YYYY-MM"
  closingDate: Date
  dueDate: Date
}

export function calculateInvoiceReference(
  purchaseDate: Date,
  card: { closingDay: number; dueDay: number; closingDayRule: 'ATUAL' | 'PROXIMA' },
): InvoiceReferenceResult
```

**Lógica detalhada:**

```
1. Extrai (year, month, day) UTC da purchaseDate
2. Calcula effectiveClosingDay = min(card.closingDay, dias do mês)
   (closingDay=31 num mês de 30 dias vira 30)
3. Determina mês da fatura:
   if (day < effectiveClosingDay)
     → fatura nesse mês (year, month)
   else if (day > effectiveClosingDay)
     → fatura próximo mês (addMonths +1)
   else  // day == effectiveClosingDay
     if (closingDayRule === 'ATUAL')
       → fatura nesse mês
     else // PROXIMA
       → fatura próximo mês
4. closingDate = day = closingDay (com clamp pro último dia do mês)
5. dueDate = mesmo mês ou +1 conforme card.dueDay vs effectiveClosingDay:
   if (dueDay > closingDay) → vencimento no mesmo mês da fatura
   else → vencimento no mês seguinte (caso raro mas existe)
6. reference = `${year}-${String(month + 1).padStart(2, '0')}`
```

### 3.3 `lib/credit-card/build-installments.ts`

Gera as N parcelas de uma compra parcelada.

```ts
export interface InstallmentInput {
  purchaseDate: Date
  totalAmount: number     // valor total da compra
  installments: number    // 1 a 48 (limite sanity)
  card: { closingDay: number; dueDay: number; closingDayRule: 'ATUAL' | 'PROXIMA' }
}

export interface InstallmentRow {
  installmentNumber: number   // 1, 2, 3, ...
  installmentTotal: number
  date: Date                   // purchaseDate + (N-1) meses (com clamp)
  amount: number               // total / N (last ajusta resto)
  reference: string            // YYYY-MM da fatura
  closingDate: Date
  dueDate: Date
}

export function buildInstallments(input: InstallmentInput): InstallmentRow[]
```

**Lógica detalhada:**

```
1. Validação:
   - installments >= 1 (1 = à vista)
   - totalAmount > 0
   - throw se inválido

2. Split do valor:
   - baseAmount = round(totalAmount / installments, 2)   // half-up
   - lastAmount = totalAmount - baseAmount * (installments - 1)
     // Ex: R$ 100 / 3 = 33,33 + 33,33 + 33,34
   - Garante sum(amounts) === totalAmount (precisão)

3. Pra cada parcela i = 1..installments:
   - dateP = addMonths(purchaseDate, i - 1)
       (preserva dia, clamp pro último do mês)
   - amountP = (i === installments) ? lastAmount : baseAmount
   - invoiceRef = calculateInvoiceReference(dateP, card)

4. Retorna array ordenado por installmentNumber
```

### 3.4 `lib/credit-card/calculate-card-summary.ts`

KPIs do cartão (alimenta dashboard).

```ts
export interface CardSummary {
  cardId: string
  creditLimit: number
  limitUsed: number          // sum(invoices OPEN+CLOSED) + parcelas futuras não-faturadas
  limitAvailable: number     // creditLimit - limitUsed
  currentInvoice: {
    reference: string
    totalAmount: number
    closingDate: Date
    dueDate: Date
    daysUntilClosing: number
  } | null
  nextInvoicePreview: number  // valor previsto da próxima fatura
}

export function calculateCardSummary(
  card: CreditCard,
  invoices: CreditCardInvoice[],
  futureInstallments: Array<{ amount: number; reference: string }>,
  now: Date,
): CardSummary
```

### 3.5 `lib/credit-card/calculate-profile-credit-summary.ts`

Consolidado de TODOS os cartões do perfil (pra dashboard).

```ts
export interface ProfileCreditSummary {
  cardsCount: number
  totalLimit: number
  totalUsed: number
  totalAvailable: number
  totalCurrentMonthInvoice: number
  totalNextMonthPreview: number
  byCard: CardSummary[]
}
```

---

## 4. API endpoints (10 rotas REST)

| Método | Rota | Função |
|---|---|---|
| GET | `/api/perfis/[id]/cartoes` | Lista cartões + summary embedded |
| POST | `/api/perfis/[id]/cartoes` | Cria cartão |
| GET | `/api/perfis/[id]/cartoes/[cardId]` | Detalhe + summary completo |
| PATCH | `/api/perfis/[id]/cartoes/[cardId]` | Editar (limite, fechamento, etc) |
| DELETE | `/api/perfis/[id]/cartoes/[cardId]` | Soft delete (isActive=false) |
| GET | `/api/perfis/[id]/cartoes/[cardId]/faturas` | Lista faturas do cartão |
| GET | `/api/perfis/[id]/cartoes/[cardId]/faturas/[invoiceId]` | Detalhe fatura + tx |
| POST | `/api/perfis/[id]/cartoes/[cardId]/faturas/[invoiceId]/pagar` | Pagar fatura |
| POST | `/api/perfis/[id]/cartoes/[cardId]/compras` | Nova compra (com parcelamento) |
| DELETE | `/api/perfis/[id]/cartoes/[cardId]/compras/[txId]` | Estornar (parcela ou grupo) |

**Multi-tenant rígido:** TODA rota passa por `checkProfileAccess(userId, profileId, 'OWNER')` antes de qualquer operação (mesmo padrão da Fatia 1).

---

## 5. Telas/páginas (7 telas novas + 2 melhorias)

### Telas novas

| # | Rota | Conteúdo |
|---|---|---|
| 1 | `/perfis/[id]/cartoes` | Grid de cards: cada cartão mostra apelido + bandeira + limite usado/disponível (barra de progresso colorida) + atalho "Nova compra" |
| 2 | `/perfis/[id]/cartoes/novo` | Form: nome / banco / bandeira / últimos 4 / limite / fechamento / vencimento / conta de pagamento padrão / closingDayRule |
| 3 | `/perfis/[id]/cartoes/[cardId]` | Dashboard do cartão: 4 KPIs (limite usado / disponível / fatura atual / próxima) + lista das últimas 10 compras + atalho fatura |
| 4 | `/perfis/[id]/cartoes/[cardId]/faturas` | Lista de faturas (filtro por status) — cards mostrando reference + total + status |
| 5 | `/perfis/[id]/cartoes/[cardId]/faturas/[invoiceId]` | Detalhe da fatura: cabeçalho (closing/due/total/pago) + lista de TODAS as tx + botão "Pagar" |
| 6 | `/perfis/[id]/cartoes/[cardId]/compras/novo` | Form: data / valor / descrição / categoria / **slider de parcelas (1-12)** mostrando preview "1ª R$ 33,33 em jul/2026, 2ª R$ 33,33 em ago/2026..." |
| 7 | `/perfis/[id]/cartoes/[cardId]/editar` | Form de edição (mesmos campos de novo) |

### Melhorias em telas existentes (mínimas)

- **`/perfis/[id]` (dashboard PF, criado na Fatia 1):**
  - Adiciona card "Cartões de crédito" abaixo dos KPIs principais com: total limite usado / disponível + atalho "Ver cartões"
  - Top 5 categorias passa a incluir compras de cartão automaticamente (mesma tabela)

- **`/perfis/[id]/transacoes` (Fatia 1):**
  - Tx vinculadas a cartão ganham badge visual "💳 Nubank" + chip "1/6" pra parceladas
  - Filtro novo: "Apenas cartão" / "Apenas conta"

### Componente reutilizável

- `<InstallmentPreview installments={6} totalAmount={600} card={...} />` — preview tabular das N parcelas (alimentado por `buildInstallments`). Renderiza data, valor, fatura. Usado em telas 6 (criar compra) e modal de estorno.

---

## 6. Lógica das regras (com as 10 pegadinhas resolvidas)

### Pegadinha #1 — Compra no DIA do fechamento

**Resolvida em:** `calculateInvoiceReference` + `CreditCard.closingDayRule`.

- Default `ATUAL` (regra Nubank/Itaú/Bradesco — compra no dia do fechamento entra na fatura que fecha hoje)
- User pode trocar pra `PROXIMA` por cartão (alguns bancos invertem)

### Pegadinha #2 — Virada de mês com parcelas longas

**Resolvida em:** `buildInstallments` + `addMonths` (com clamp).

- Compra 31/jan em 6x:
  - 1ª: 31/jan → fatura fev
  - 2ª: addMonths(31/jan, 1) = 28/fev (clamp) → fatura mar
  - 3ª: addMonths(31/jan, 2) = 31/mar → fatura abr
  - 4ª: addMonths(31/jan, 3) = 30/abr (clamp) → fatura mai
  - 5ª: 31/mai → fatura jun
  - 6ª: 30/jun (clamp) → fatura jul

### Pegadinha #3 — Estorno de compra parcelada

**Resolvida em:** `installmentGroupId` permite UPDATE em lote.

- DELETE `/compras/[txId]` oferece 2 opções:
  - **"Esta parcela"** — só essa
  - **"Toda a compra"** — todas as N parcelas
- Lógica para "toda a compra":
  1. Lista as N tx via `installmentGroupId`
  2. Pra cada uma:
     - Se invoice ainda OPEN → delete a tx + decrementa invoice.totalAmount
     - Se invoice CLOSED não-paga → delete + decrementa
     - Se invoice PAID → NÃO delete; ao invés, gera tx "Crédito estorno" na próxima invoice OPEN (saldo a favor)
  3. Audit log do estorno

### Pegadinha #4 — Pagamento parcial / rotativo

**Resolvida em:** endpoint `POST /faturas/[id]/pagar` + carry-over.

- Body: `{ paymentAccountId, amount, juros?: number }`
- Cria PersonalTransaction (`isInvoicePayment=true`) debitando conta
- Atualiza `invoice.paidAmount += amount`
- Se `paidAmount >= totalAmount`: status=PAID
- Se `paidAmount > 0 < totalAmount`: status=PARTIAL
  - Gera **automaticamente** na próxima invoice (cria se necessário):
    - PersonalTransaction "Rotativo da fatura X · saldo R$ Y" com `carryoverFromInvoiceId`
    - + Se `juros` foi informado: PersonalTransaction "Juros do rotativo · R$ Z"
  - Marca `nextInvoice.carryoverFromInvoiceId` pra rastreabilidade
- Recalc balance da conta de pagamento automático

**Decisão:** juros NÃO são calculados pelo sistema no MVP. User informa o valor (banco mandou). Fatia futura pode automatizar via taxa configurável.

### Pegadinha #5 — Compra internacional em USD

**Fora da Fatia 2.** Modelagem proposta pra futuro: `currency` + `exchangeRate` em PersonalTransaction. Registrado mas não implementado.

### Pegadinha #6 — Cashback / pontos

**Fora.** Decisão de produto.

### Pegadinha #7 — Anuidade

**Resolvida sem código novo:** user lança como compra manual recorrente. Quando RecurringSchedule PF chegar (futura), reusa.

### Pegadinha #8 — Limite disponível em tempo real

**Resolvida em:** `calculateCardSummary` (puro, sem cache).

`limitUsed = sum(invoices status IN (OPEN, CLOSED, PARTIAL).totalAmount - paidAmount) + sum(parcelas futuras não-faturadas)`

`limitAvailable = creditLimit - limitUsed`

Sem armazenamento — cálculo em query. Performance OK pra N cartões (cada cartão ~12-24 invoices históricas).

### Pegadinha #9 — Múltiplos cartões

**Resolvida em:** `CreditCard.profileId` é N:1 (perfil tem N cartões).

- Lista `/perfis/[id]/cartoes` renderiza grid de N cards
- Dashboard PF mostra consolidado (`calculateProfileCreditSummary`)
- Cada cartão é independente — limite, fechamento, fatura próprios

### Pegadinha #10 — Importar OFX/Excel de cartão (CCSTMTRS)

**Fora.** Vem na Fatia 3 (OFX import + IA classificação).

---

## 7. Reuso × Novo

### Reuso da Fatia 1 (sólido)
- ✅ `lib/personal-profile/queries.ts:checkProfileAccess` — auth multi-tenant
- ✅ `PersonalProfile` (FK profileId em CreditCard)
- ✅ `PersonalBankAccount` (defaultPaymentAccount + tx de pagamento)
- ✅ `PersonalCategory` (categoria das compras — usa "Cartão de crédito" placeholder já criado na Fatia 1)
- ✅ `WorkspaceContext` + `WorkspaceSwitcherDual` (Fatia 2 vive dentro do contexto PF)
- ✅ Components UI (Card, Button, Input, Select, Label, Dialog, ConfirmDialog)

### Reuso de outras Sprints
- ✅ `addMonths` (extraído de `lib/asaas/webhook.ts` Sprint 3C → `lib/dates/add-months.ts` genérico)
- ✅ Padrão URL persistente + atalhos teclado (Sprint 3.0.4 — quando chegar na lista de compras)
- ✅ Padrão de migration aditiva + backup obrigatório (Sprint 3C + Fatia 1)

### Novo (100% específico de cartão)
- 5 helpers puros em `lib/credit-card/`
- 2 models + 6 colunas aditivas em PersonalTransaction
- 10 endpoints REST
- 7 telas
- Componente `<InstallmentPreview>` reusável

---

## 8. Testes (alvo: 80-100 testes — cartão tem MUITA lógica delicada)

### 8.1 Puros (sem DB) — ~50 testes

**`__tests__/credit-card/calculate-invoice-reference.test.ts` (25 testes)**
- Compra ANTES do fechamento → fatura do mês
- Compra DEPOIS do fechamento → próximo mês
- Compra NO fechamento + closingDayRule=ATUAL → mês atual
- Compra NO fechamento + closingDayRule=PROXIMA → próximo
- closingDay=31, mês com 30 dias → clamp pro dia 30
- fev 28/29 dias + closingDay=30 → clamp
- Virada de ano (dez → jan)
- dueDay > closingDay (caso comum) → vencimento mês seguinte
- dueDay < closingDay (alguns bancos) → vencimento +2 meses

**`__tests__/credit-card/build-installments.test.ts` (15 testes)**
- 1x (à vista) → 1 row
- 2x R$ 100 → R$ 50 + R$ 50
- 3x R$ 100 → R$ 33,33 + R$ 33,33 + R$ 33,34 (resto)
- 6x R$ 600 → 6 parcelas iguais
- 12x R$ 1200 cobrindo virada de ano
- Compra 31/jan em 6x → cada parcela com clamp correto
- Validação: 0x throw, -1x throw, 49x throw

**`__tests__/credit-card/calculate-card-summary.test.ts` (10 testes)**
- limit usado = sum(OPEN) + sum(CLOSED não-pagas)
- Parcelas futuras não-faturadas contam no limite
- Tx PAID não conta no limite
- Próxima fatura preview = soma de parcelas conhecidas + carry-over
- daysUntilClosing edge cases (hoje, ontem, daqui 30d)

### 8.2 Integração com DB — ~30 testes

**`__tests__/credit-card/endpoints.test.ts` (20 testes)**
- CRUD cartão (criar / listar / detalhe / editar / deletar)
- POST compra à vista cria 1 tx + atualiza invoice.totalAmount
- POST compra 6x cria 6 tx com `installmentGroupId` único
- POST compra 6x atualiza/cria 6 invoices distintas
- POST pagar fatura total → status=PAID + tx débito conta
- POST pagar fatura parcial → status=PARTIAL + gera rotativo
- DELETE compra parcelada com opção "todas" → estorna N tx
- DELETE compra parcelada com opção "só essa" → estorna 1 tx

**`__tests__/credit-card/multi-tenant-isolamento.test.ts` (15 testes críticos)**
- 🛡️ GET /cartoes userB → cartões de A → 404
- 🛡️ POST /cartoes/[cardA] userB → 404 (não cria)
- 🛡️ POST /faturas/[invoiceA]/pagar userB → 404
- 🛡️ DELETE /compras/[txA] userB → 404
- 🛡️ POST compra com creditCardId de OUTRO perfil → 400 INVALID_CARD
- 🛡️ POST pagamento com paymentAccountId de OUTRO perfil → 400 INVALID_ACCOUNT
- 🛡️ POST compra com categoryId de OUTRO perfil → 400 INVALID_CATEGORY
- 🛡️ Cross-card no mesmo perfil: tx do card1 num invoice do card2 → 400
- 🛡️ Listagem de faturas só do cartão do perfil
- 🛡️ user A vê SÓ cartões dos perfis dele
- 🛡️ GET detalhe cartão de perfil DEPENDENT de outro user → 404
- 🛡️ PATCH limit de cartão alheio → 404 + sem mudança no DB
- 🛡️ Pagar fatura com debit usando categoria que não é cartão → ainda funciona (categoria é livre)
- 🛡️ Compra Nx cria parcelas SÓ pro cartão certo (não vaza pra outros)
- 🛡️ DELETE cartão (soft) não apaga invoices nem tx (preserva histórico)

### 8.3 Cenários de produto end-to-end — ~10-15 testes

**`__tests__/credit-card/cenarios-produto.test.ts`**
- Yussef cria cartão Nubank (fecha 5, vence 12) → compra Netflix R$ 50 em 28/jan → cai em fatura "2026-02"
- Compra R$ 600 em 6x no dia 5 (fechamento) com closingDayRule=ATUAL → 1ª em fev (fatura desse mês), 2ª em mar, etc
- Mesma compra com closingDayRule=PROXIMA → 1ª em mar, 2ª em abr
- Fatura R$ 1.580 paga parcial R$ 1.000 + juros R$ 80 informados → gera tx "Rotativo R$ 580" + "Juros R$ 80" na próxima
- Estorno de compra 6x onde 2 parcelas já em fatura paga → 4 tx deletadas + 2 créditos na próxima

---

## 9. O que FICA FORA da Fatia 2 (lista explícita)

- ❌ **Compra internacional USD/EUR** (currency + exchangeRate) — futura
- ❌ **Cashback / pontos / milhas** — fora do escopo de gestão de caixa
- ❌ **OFX import de cartão (CCSTMTRS)** → Fatia 3
- ❌ **IA classificação automática das compras** → Fatia 3 (prompt parametrizado entityType='pf')
- ❌ **Anuidade recorrente automática** (user lança manual; futura via RecurringSchedule)
- ❌ **Juros do rotativo calculados automaticamente** (user informa o valor que o banco cobrou)
- ❌ **Pré-pagamento de parcelas** (quitar antecipado) — futura
- ❌ **Limite por categoria** (alguns apps fazem; over-engineering pra MVP)
- ❌ **Bloqueio temporário do cartão** (estilo Nubank — operacional, não de gestão)
- ❌ **Alertas de fatura por email/notif** — futura, integra com email-alerts existente
- ❌ **Cartão PJ** (Fatia 2 SÓ PF; PJ futuro se houver demanda)
- ❌ **Compartilhamento de cartão entre perfis** (dependente usa cartão do titular) — Fatia 5 família talvez

---

## 10. Preparação pro dashboard (próxima sprint após Fatia 2)

**Princípio:** Fatia 2 deve deixar os dados PRONTOS pro dashboard não precisar de refactor.

### 10.1 O que a Fatia 2 entrega já consumível pelo dashboard

**a) `getProfileSummary` (já existe Fatia 1) ganha campo novo no return:**
```ts
{
  totalBalance: number       // já existe (contas bancárias)
  // ...
  creditCards: {              // NOVO Fatia 2
    count: number
    totalLimit: number
    totalUsed: number
    totalAvailable: number
    currentMonthInvoiceTotal: number
    nextMonthInvoicePreview: number
  }
}
```

**b) Top categorias de despesa (já existe Fatia 1) PASSA a incluir compras de cartão automaticamente.**
Razão: compras de cartão são `PersonalTransaction.type='DEBIT'` com `categoryId` preenchido. A query atual já agrega por categoria — nenhuma mudança necessária. Verificado.

**c) Endpoint dedicado `GET /api/perfis/[id]/cartoes/dashboard-summary`** retorna:
- Consolidado de TODOS os cartões (limit total/usado/disponível)
- Top 5 categorias de gasto NOS CARTÕES (separado das gerais — rosca-ready)
- Evolução mensal das faturas (últimos 12 meses — line chart-ready)
- Comparativo "fatura atual × fatura mês anterior" (bar chart-ready)

**d) Endpoint `GET /api/perfis/[id]/saldo-previsto`** (calcula saldo futuro):
- Saldo atual das contas bancárias
- (−) Total das faturas em aberto (vai sair em até 30d)
- (−) Parcelas futuras (próximos 30/60/90 dias)
- = Saldo previsto cenário pessimista / realista

### 10.2 Visão do dashboard que vamos PROPOR depois (registro)

**Pesquisa de mercado consolidada (Mobills + Organizze):**

| Gráfico | Função | Por que mercado tem |
|---|---|---|
| Rosca (gastos por categoria) | "Onde meu dinheiro vai?" | Mais reconhecível visualmente |
| Linha (evolução mensal entradas/saídas) | "Estou melhorando ou piorando?" | Mostra tendência |
| Barra empilhada (fatura por categoria) | "O cartão pesa em que?" | Específico de cartão |
| Progress bar de orçamento | "Estourei a meta esse mês?" | Engajamento gamificado |
| Saldo previsto (com faturas) | "Vou ficar no negativo?" | Antecipação financeira |

**Decisões abertas pro próximo sprint (dashboard) — Yussef vai decidir:**

1. **1 gráfico bem feito × vários?** Minha opinião: 1 rosca de "Top despesas" + 1 line "Evolução 12 meses" + 4 KPIs no Hero. Foco em CLAREZA > sobrecarga visual (filosofia Brex/Mercury).

2. **Reuso do PJ?** O dashboard Sprint 1 do PJ (Hero KPIs + Mini-DRE + Top Categories + Recent Activity) tem componentes reutilizáveis:
   - ✅ `Sparkline.tsx` — reusa direto
   - ✅ `KPICard.tsx` — reusa direto
   - ✅ `TopCategoriesDonut.tsx` — reusa parametrizando dados
   - ❌ `MiniDRE.tsx` — específico PJ; PF não tem DRE (tem Fluxo Pessoal)
   - ❌ Componentes de cartão são 100% novos (PJ não tem cartão modelado)

3. **Stack visual:** Recharts 3.8.1 + Framer Motion 12.38.0 (já instalado pra Sprint 1 Dashboard PJ).

4. **Metas/orçamentos:** entram só DEPOIS do dashboard básico estar fechado.

**Decisão registrada agora:** quando chegar no dashboard, Claude vai PROPOR primeiro (igual fizemos pra Fatia 1 e Fatia 2) — 2-3 opções de layout, mockup em ASCII/descrição visual, alvo "nível Mobills/Organizze" mas com filosofia minimalista (qualidade > quantidade de gráficos).

---

## 11. Riscos consolidados

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|---|
| 1 | Cálculo da fatura errado em pegadinha de data | Alta sem testes | Crítico (user confia no número) | 25 testes específicos de `calculateInvoiceReference` |
| 2 | Parcelamento gera valores que não somam o total (precisão float) | Média | Médio (centavos somem) | `buildInstallments` garante `sum = total` no teste; round half-up na divisão |
| 3 | Estorno de parcela em fatura paga gera saldo a favor não rastreado | Média | Alto (user perde dinheiro) | `carryoverFromInvoiceId` + crédito explícito na próxima invoice + audit log |
| 4 | Vazamento entre cartões de perfis diferentes | Baixa (com checkProfileAccess) | Crítico (LGPD) | 15 testes de isolamento + helper centralizado |
| 5 | Rotativo gera tx duplicada (race condition) | Baixa | Médio | `$transaction` atomic no pagamento; UNIQUE em (`creditCardInvoiceId`, `carryoverFromInvoiceId`) opcional |
| 6 | User cadastra cartão errado (closingDay/dueDay invertidos) | Alta (UX) | Médio (faturas erradas) | Validação Zod (1-31, dueDay !== closingDay), preview no form ("Próximo fechamento: DD/MM/AAAA") |
| 7 | Compra parcelada 12x cria 12 faturas vazias no banco | Baixa | Baixo (storage) | OK — faturas vazias somem do summary porque totalAmount=0 |
| 8 | Migração quebra dados Fatia 1 | Muito baixa | Crítico | Migration aditiva pura; backup + counts pré/pós obrigatórios |
| 9 | calculateCardSummary fica lento com 100+ tx | Baixa | Médio | Índices em (creditCardId, status) + (creditCardInvoiceId, date) já entram na migration |
| 10 | Dashboard depois precisa de campo novo que não previmos | Média | Médio | Mitigação: `getProfileSummary` retorna objeto extensível; endpoints `dashboard-summary` dedicados |

---

## 12. Plano de execução (7-9 dias)

| Dia | Foco |
|---|---|
| 1 | Schema + migration aditiva + `npx prisma db push` em dev + extrair `addMonths` pra `lib/dates/` |
| 2 | Helpers puros (`calculateInvoiceReference`, `buildInstallments`) + 40 testes dia 1-2 |
| 3 | Helpers `calculateCardSummary` + `calculateProfileCreditSummary` + 10 testes + integração com getProfileSummary |
| 4 | 10 endpoints REST (CRUD cartão / faturas / compras / pagar) + checkProfileAccess + multi-tenant testes (15) |
| 5 | 4 telas (lista/novo/dashboard/editar cartão) |
| 6 | 3 telas (faturas/detalhe-fatura/nova-compra com `<InstallmentPreview>`) + ajustes em /perfis/[id] e /perfis/[id]/transacoes |
| 7 | Cenários produto E2E + edge tests (15-20 testes) + suite full passa |
| 8 | Build + deploy (backup + migrate + counts + smoke) |
| 9 | Buffer / polish + commit/push + atualização CLAUDE.md |

---

## 13. Checklist DoD (recap)

- [ ] Aprovação Yussef do plano ← **VOCÊ ESTÁ AQUI**
- [ ] Backup banco prod (`pg_dump -Fc`)
- [ ] Migration aditiva aplicada (counts pré/pós iguais; novas tabelas vazias)
- [ ] Helpers puros + 50 testes (puros)
- [ ] 10 endpoints REST + checkProfileAccess em todos
- [ ] 15 testes de isolamento multi-tenant passando
- [ ] 20 testes de integração endpoint
- [ ] 10-15 testes de cenário produto E2E
- [ ] 7 telas + componente `<InstallmentPreview>`
- [ ] Adições em `/perfis/[id]` (card cartões) e `/perfis/[id]/transacoes` (badge)
- [ ] TypeScript strict 0 erros
- [ ] `npm run build` OK
- [ ] Deploy prod (PM2 reload --update-env)
- [ ] Smoke: criar cartão / compra à vista / compra 3x / pagar fatura / estorno
- [ ] CLAUDE.md atualizado com log da Fatia 2
- [ ] **Dashboard preparado:** `getProfileSummary` retorna `creditCards` + endpoint dashboard-summary OK

---

## 14. Decisões abertas pra Yussef validar

1. **closingDayRule default ATUAL** (regra Nubank/Itaú/Bradesco)? OK assumir e deixar user trocar por cartão se precisar?
2. **Limite máximo de parcelas: 12 ou 24?** Mobills usa 24, Organizze 48. Sugiro 24 (cobre 99% dos casos) — válido?
3. **Juros do rotativo: user informa manualmente** (MVP) vs **engine calcular** (com taxa por cartão)? Sugiro user informa no MVP.
4. **Anuidade: lançar como compra manual** vs **schedule recorrente automático**? Sugiro manual (RecurringSchedule PF vem depois).
5. **Estorno de parcela em fatura paga: gera crédito na próxima** vs **abre disputa pendente**? Sugiro crédito automático.
6. **closingDayRule alternativo: rule ATUAL/PROXIMA é simples — basta ou precisa "1 dia antes do fechamento"** (caso edge)? Sugiro só ATUAL/PROXIMA, edge case vira manual.
7. **Brand do cartão obrigatório?** Hoje optional — pode ficar opcional pra MVP. Sugiro sim.
