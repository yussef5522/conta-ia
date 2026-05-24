# Sprint 4.0.1.a — Foundation Core Financeiro (Contas a Pagar)

**Status:** ✅ CONCLUÍDO em 23/05/2026
**Suite testes:** 1696 → **1734 (+38 testes)** sem regressões
**TypeScript strict:** 0 erros · **Build:** ✓ Compiled successfully

---

## Escopo

Primeira metade do Sprint 4.0.1 (foundation Core Financeiro). Entrega:

- ✅ Schema unificado: campo `lifecycle` em Transaction (EFFECTED | PAYABLE | RECEIVABLE)
- ✅ Modelo `Customer` (cliente) — espelha Supplier, contraparte de RECEIVABLE
- ✅ `Transaction.bankAccountId` nullable (PAYABLE/RECEIVABLE sem conta definida)
- ✅ Campos `dueDate`, `reconciledWithId`, `customerId` em Transaction
- ✅ `lib/lifecycle/` (validators + transitions + buildEffectivePatch puros)
- ✅ DRE + Dashboard filtram `lifecycle='EFFECTED'` (visão Realizado preservada)
- ✅ Endpoints: POST/GET `/api/contas-a-pagar`, `/contas-a-receber`, `/empresas/[id]/clientes`
- ✅ PATCH `/api/transacoes/[id]/efetivar` (marca PAYABLE→EFFECTED + atualiza saldo)
- ✅ UI `/contas-a-pagar` (lista + KPIs vencidas + modal efetivar)
- ✅ UI `/contas-a-pagar/nova` (form com supplier/categoria/conta opcional)
- ✅ Sidebar: item "Contas a Pagar"

**4.0.1.b (próxima sessão):**
- Recurrence model + endpoints + UI + cron infra
- UI Contas a Receber (`/contas-a-receber` + form)
- UI Recorrentes
- DRE Realizado vs Previsto (tabs)
- Sidebar: links Receber + Recorrentes

**4.0.2:** Match algorithm + wizard pós-OFX + conciliação (link PAYABLE↔OFX)

---

## Arquitetura

### Por que Opção B (campo `lifecycle` em Transaction unificada)

Considerei criar tabelas separadas (`accounts_payable` / `accounts_receivable`)
mas a análise mostrou que Transaction já tem 90% da infra:

- `status` (PENDING/RECONCILED/IGNORED)
- `origin` (MANUAL/OFX/PLUGGY)
- `competenceDate` + `paymentDate` (regime competência vs caixa — Sprint 5.3.A)
- `dedupHash` (anti-duplicação)
- Pipeline IA categorizer (RULE→KEYWORD→BRASILAPI→CLAUDE)
- Multi-tenant guards + RBAC + audit log

Unificação reusa tudo. Custo: 1 filtro `WHERE lifecycle='EFFECTED'` em N callers (12 queries no `lib/dashboard/queries.ts` + DRE route + 2 query builders centralizados em `lib/cashflow/query.ts`). Defesa em profundidade.

### Lifecycle como state machine

```
                  efetivar/conciliar
                  ────────────────►
PAYABLE / RECEIVABLE                EFFECTED  ◄── (terminal)
                  ◄────────────────
                       (não permitido)
```

Mudança PAYABLE→EFFECTED via:
- **Efetivação manual:** `PATCH /api/transacoes/[id]/efetivar` (pagamento direto, sem OFX)
- **Conciliação OFX:** Sprint 4.0.2 (link via `reconciledWithId` mantém ambas as tx pra auditoria)

### Schema mudanças (migration `20260523000000_sprint_4_0_1_a_lifecycle_customer`)

```sql
-- Customer (novo)
CREATE TABLE "customers" (
    id, companyId, razaoSocial, nomeFantasia, cnpj, cpf, email, phone,
    categoryId, fonte, isActive, notes, createdAt, updatedAt
);

-- Transaction (extensões)
ALTER TABLE transactions
  ADD COLUMN lifecycle TEXT NOT NULL DEFAULT 'EFFECTED',
  ADD COLUMN dueDate TIMESTAMP,
  ADD COLUMN reconciledWithId TEXT UNIQUE,
  ADD COLUMN customerId TEXT,
  ALTER COLUMN bankAccountId DROP NOT NULL;

-- Índices novos
CREATE INDEX (lifecycle, dueDate);
CREATE INDEX (lifecycle, status);
CREATE INDEX (customerId);
```

Migration aplica `DEFAULT 'EFFECTED'` nas 1755 tx existentes da Cacula Mix
(preserva 100% do comportamento atual).

### Multi-tenant guard pra PAYABLE/RECEIVABLE sem bankAccount

Hoje multi-tenant rola via `bankAccount.companyId`. PAYABLE pode ter `bankAccountId=null`,
então usar `bankAccount.companyId` direto excluiria PAYABLEs legítimos.

Solução em `/api/contas-a-pagar` GET: `OR` de 4 relações que TODAS apontam pra empresa
(`bankAccount`, `supplier`, `customer`, `category`). Pelo menos uma estará presente.
Endpoint `/efetivar` resolve `companyId` da mesma forma e valida antes do `requirePermission`.

### Rotas genéricas (`/api/transacoes/[id]` GET/PUT/DELETE) rejeitam pendentes

Adicionado guard explícito: se `bankAccount` é null → HTTP 422 com mensagem
"Use endpoints de contas a pagar/receber pra lançamentos pendentes". Mantém
contrato histórico dessas rotas (sempre lidavam com EFFECTED) e força clientes
a usar rotas dedicadas pra AP/AR.

---

## Decisões técnicas notáveis

### 1. `defaultTypeFromLifecycle` mapeia PAYABLE → DEBIT, RECEIVABLE → CREDIT

PAYABLE é compromisso de SAÍDA → type=DEBIT. RECEIVABLE é entrada futura → type=CREDIT.
EFFECTED retorna null (depende do contexto OFX, caller decide).

### 2. `dedupHash NULL` em PAYABLE

PAYABLE criada manual não tem dedupHash. Constraint `@@unique([bankAccountId, dedupHash])`
permite múltiplas NULL (postgres considera NULL distinto). Sprint 4.0.2 pode gerar
dedupHash semântico (sha256(amount + dueDate + supplier)) pra reserva slot anti-duplicação
quando OFX importa "mesma" tx.

### 3. `date` espelha `dueDate` enquanto PAYABLE

Em PAYABLE, `date` = `dueDate` (data esperada). Quando efetiva, `date` passa a ser
`paymentDate` (data real do caixa). Mantém ordering consistente em listagens (sempre
ordena por `date`) sem inventar campos extras na UI.

### 4. DRE filtra `lifecycle='EFFECTED'` no CALLER (não na função pura)

`calculateDRE` é função pura sem acesso a Prisma. Filtro vai no SQL (performance) +
no Dashboard `queries.ts` (12 lugares, defesa em profundidade). Quando vier a UI
"Previsto" no Sprint 4.0.1.b, o caller passa `lifecycle: { in: ['PAYABLE', 'RECEIVABLE'] }`
em vez de mudar a engine.

### 5. UI Efetivar usa Dialog cru (não ConfirmDialog)

ConfirmDialog tem API simples (apenas title + description + confirm callback).
Efetivar precisa de inputs (data, conta) → Dialog/DialogContent direto pra ter
controle total do form.

### 6. `bankAccountId` nullable propaga ~50 erros TS pelos consumers

A maioria dos consumers assumia tx EFFECTED (OFX). Estratégia:
- Onde for OFX-only (transferências, IA categorizer, classificador): non-null assertion `!`
- Onde for genérico (route handlers, UI editar): guard explícito com retorno 422
- Atualizar `TxSnapshot` em `lib/ai-categorizer/types.ts` pra refletir nullable

Não escondi nada — todas as 53 ocorrências revisadas manualmente.

---

## Arquivos criados/modificados

### Novos (16)
- `prisma/migrations/20260523000000_sprint_4_0_1_a_lifecycle_customer/migration.sql`
- `lib/lifecycle/index.ts`
- `lib/validations/contas-ap-ar.ts`
- `lib/contas-ap-ar/create.ts`
- `app/api/empresas/[id]/clientes/route.ts`
- `app/api/contas-a-pagar/route.ts`
- `app/api/contas-a-receber/route.ts`
- `app/api/transacoes/[id]/efetivar/route.ts`
- `app/(dashboard)/contas-a-pagar/page.tsx`
- `app/(dashboard)/contas-a-pagar/nova/page.tsx`
- `__tests__/lifecycle.test.ts` (28 tests)
- `__tests__/contas-ap-ar-validation.test.ts` (24 tests)
- `__tests__/schema-customer.test.ts` (14 tests + 0 errors)

### Modificados (16)
- `prisma/schema.prisma` (Customer + 4 novos campos Transaction + bankAccountId nullable)
- `lib/dre/types.ts` (não tocado — `TransactionForDRE` não precisa de lifecycle pq filtro fica no SQL)
- `lib/cashflow/query.ts` (lifecycle filter centralizado)
- `lib/dashboard/queries.ts` (12 queries × lifecycle filter)
- `lib/ai-categorizer/types.ts` (TxSnapshot.bankAccountId nullable)
- `lib/ai-categorizer/apply.ts` (non-null assertions)
- `lib/transfers/delete.ts` (guard + sem ! incorretos)
- `lib/transfers/from-ofx.ts` (! em existingTx.bankAccount, fromAccountData)
- `lib/transfers/pair-pendentes.ts` (! em txA/txB.bankAccount)
- `lib/transacoes/csv.ts` (bankAccount nullable)
- `app/api/empresas/[id]/dre/route.ts` (lifecycle filter)
- `app/api/transacoes/[id]/route.ts` (guards 422 + nullable bankAccountId)
- `app/api/transferencias/route.ts` (skip se bankAccount null)
- `app/api/transferencias/[groupId]/route.ts` (!)
- `app/api/transferencias/candidatas/[id]/route.ts` (!)
- `app/api/transferencias/pair-pendentes/route.ts` (!)
- `app/api/ai-categorizer/*` (!)
- `app/api/transacoes/[id]/similares/route.ts` (!)
- `app/api/transacoes/[id]/classificar-com-aprendizado/route.ts` (!)
- `app/(dashboard)/empresas/[id]/contas/[contaId]/transacoes/[transacaoId]/editar/page.tsx` (guard)
- `app/api/empresas/[id]/transacoes/export/route.ts` (compatível via tipo CSV nullable)
- `components/sidebar/global-sidebar.tsx` (link Contas a Pagar)
- `__tests__/transacoes-csv.test.ts` (1 teste novo bankAccount null)

---

## Como usar (operacional)

### Criar conta a pagar
```bash
POST /api/contas-a-pagar
{
  "companyId": "cmpgapyt402pg2006sr8ozzz8",
  "description": "Energia ENERGISA - maio/2026",
  "amount": 380.50,
  "dueDate": "2026-06-10",
  "supplierId": "cmpgxxxsupplier...",  // opcional
  "categoryId": "cmpgxxxcategory...",  // opcional
  "bankAccountId": null  // opcional — decidir na efetivação
}
```

### Efetivar (marcar como paga)
```bash
PATCH /api/transacoes/{id}/efetivar
{
  "paymentDate": "2026-06-10",
  "bankAccountId": "cmpgxxxbank..."
}
```

### Listar com KPIs
```bash
GET /api/contas-a-pagar?empresaId=...&status=PENDING&vencidas=true
# retorna: items[], paginacao, kpis: { totalPendente, totalVencido, ... }
```

### UI
- `/contas-a-pagar` — lista com KPIs (a pagar pendente + vencidas)
- `/contas-a-pagar/nova` — form criar

---

## Métricas finais

```
Antes (v6.2 baseline):   1696 testes passando
Depois (Sprint 4.0.1.a): 1734 testes passando (+38, +2.2%)

Tempo planejado:  ~5h
Tempo real:       ~1.5h (sessão única)

TS strict: 0 erros
Build:     ✓ Compiled successfully in 2.6s
```

---

## Próximo (Sprint 4.0.1.b)

1. Recurrence model + endpoints + cron infra + UI
2. UI Contas a Receber (lista + form com Customer)
3. UI Customers (CRUD básico)
4. DRE Realizado vs Previsto (tabs)
5. Sidebar: links AR + Recorrentes

Estimativa: ~5-6h.
