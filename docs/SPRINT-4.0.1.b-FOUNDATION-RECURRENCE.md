# Sprint 4.0.1.b — Foundation Core Financeiro (Recurrence + AR + Clientes + DRE tabs)

**Status:** ✅ CONCLUÍDO em 23/05/2026
**Suite testes:** 1734 → **1782 (+48 testes)** sem regressões
**TypeScript strict:** 0 erros · **Build:** ✓ Compiled successfully

---

## Escopo

Segunda metade do Sprint 4.0.1 (Core Financeiro). Entrega:

- ✅ Model `RecurringSchedule` + `Transaction.recurringScheduleId` (anti-dup via @@unique)
- ✅ `lib/recurrence/`:
  - `next-date.ts` — função PURA `calculateNextDueDates` (MONTHLY/WEEKLY/QUARTERLY/YEARLY)
  - `generator.ts` — gera Transaction PAYABLE/RECEIVABLE PENDING na janela 7 dias
  - `scheduler.ts` — node-cron, dispara 06:00 America/Sao_Paulo diariamente
- ✅ `instrumentation.ts` — startup hook do Next que inicia o scheduler
- ✅ Endpoints:
  - POST/GET `/api/recorrentes`
  - PATCH/DELETE `/api/recorrentes/[id]` (DELETE = soft, active=false)
  - POST `/api/recorrentes/generate-now` (trigger manual sem esperar cron)
  - PATCH/DELETE `/api/clientes/[id]` (Customer update + soft delete)
- ✅ UIs:
  - `/contas-a-receber` (lista + KPIs verdes + modal "Receber")
  - `/contas-a-receber/nova` (form com Customer)
  - `/clientes` (lista + search + soft delete inline)
  - `/clientes/novo` (form CNPJ/CPF/contato)
  - `/recorrentes` (lista + toggle pause + "Gerar agora")
  - `/recorrentes/novo` (form com preview "próximas 3 gerações")
- ✅ DRE `/empresas/[id]/dre` com **tabs Realizado/Previsto** + persistência URL
- ✅ Sidebar: +3 itens (Contas a Receber, Recorrentes, Clientes)

---

## Arquitetura

### Recurrence schema

```prisma
model RecurringSchedule {
  id, companyId, description
  type        // PAYABLE | RECEIVABLE
  amount      // Float (mantém consistência com Transaction.amount)
  frequency   // MONTHLY | WEEKLY | QUARTERLY | YEARLY
  dayOfMonth  // 1-31 (MONTHLY/QUARTERLY/YEARLY)
  dayOfWeek   // 0-6 (WEEKLY)
  startDate, endDate (null=sem fim)
  active      // pausa sem deletar
  lastGeneratedAt
  supplierId, customerId, categoryId
  createdById // user que criou
  transactions Transaction[]
  @@index([companyId, active])
  @@map("recurring_schedules")
}

model Transaction {
  // ... +
  recurringScheduleId String?
  @@unique([recurringScheduleId, dueDate])  // ANTI-DUP
}
```

### Anti-duplicação via UNIQUE

Constraint `@@unique([recurringScheduleId, dueDate])` é a chave: garante que
o gerador nunca crie 2 tx pra mesma `(schedule, dueDate)`, **mesmo se rodar
2x ou 100x no mesmo dia**. `INSERT` falha silenciosamente (P2002) e contamos
como "skipped". Postgres trata NULLs como distintos, então tx normal
(`recurringScheduleId=NULL`) não interfere.

### Cron — node-cron + instrumentation.ts

```ts
// instrumentation.ts (raiz)
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startRecurrenceScheduler } = await import('./lib/recurrence/scheduler')
    startRecurrenceScheduler()
  }
}
```

- Next 16 chama `register()` 1x quando o server start
- Roda só em `nodejs` runtime (não Edge)
- `lib/recurrence/scheduler.ts` usa `node-cron` v4.2.1
  - Cron: `0 6 * * *` (06:00 todo dia)
  - Timezone: `America/Sao_Paulo`
  - Guard `started` previne dupla inscrição se `register()` for chamado 2x
- **PM2 está em modo `fork` (não cluster)** — verificado antes do deploy. Cron
  roda 1x sem duplicação. Se virar cluster algum dia, precisará de lock
  (Redis SETNX ou pg advisory lock).

### Generator

Janela de geração: próximos 7 dias a partir de hoje.

```typescript
generateRecurringTransactions({
  referenceDate?: Date,  // default = new Date()
  windowDays?: number,    // default = 7
  companyId?: string,     // opcional — escopo limitado (endpoint manual usa)
})
// retorna: { schedulesProcessed, generated, skippedDuplicate, errors, errorDetails }
```

Pra cada schedule active:
1. Calcula próximas dueDates via `calculateNextDueDates`
2. Pra cada dueDate na janela: tenta create Transaction PENDING
3. Se P2002 → skipped (já gerou)
4. Se gerou pelo menos 1 → update `lastGeneratedAt`

### `calculateNextDueDates` — função pura (testes 15)

Cobertura por frequency:
- **MONTHLY**: dia 31 ajusta pra último dia do mês (fev=28, abr=30)
- **WEEKLY**: caminha 0..6 dias do cursor até bater dayOfWeek alvo
- **QUARTERLY**: trimestres ancorados no MÊS de startDate (start=jan → jan/abr/jul/out)
- **YEARLY**: mesmo dayOfMonth no mesmo mês de startDate, ano em ano

Validações: respeita `startDate` (não retrocede) e `endDate` (corta janela).

### DRE Realizado vs Previsto

Backend (`/api/empresas/[id]/dre?view=previsto`):
- `view=realizado` (default): `lifecycle='EFFECTED'` + filtro `bankAccount.companyId`
- `view=previsto`: `lifecycle IN ('PAYABLE','RECEIVABLE')` + multi-tenant OR
  (bankAccount/supplier/customer/category) + filtro por `dueDate`

PAYABLE/RECEIVABLE têm `competenceDate = dueDate` por construção, então a
engine DRE pura aceita ambos sem mudança (Sub-etapa 5.3.A regime competência).

Frontend (`dre-client.tsx`):
- Tabs Radix UI no header (componente novo `components/ui/tabs.tsx`)
- Estado `view` sincronizado com URL (`?view=previsto`)
- Subtítulo do header indica "Visão PREVISTO" quando ativo

---

## Decisões técnicas notáveis

### 1. Frequency YEARLY usa mês de startDate (não dayOfMonth + janeiro)

Schedule "todo dia 15 de março" se cria com `startDate=2026-03-15, frequency=YEARLY, dayOfMonth=15`.
A engine extrai `month=2` (março) do startDate. Mais natural que pedir um `monthOfYear` separado.

### 2. Soft delete em vez de delete real (Customer + Recurrence)

`DELETE /api/clientes/[id]` → `isActive=false`.
`DELETE /api/recorrentes/[id]` → `active=false`.

Razões: preserva tx vinculadas, permite "reativar" sem perder histórico,
audit trail completo.

### 3. RECEIVABLE com Customer obrigatório? **Não, opcional**

Yussef pode cadastrar "Mensalidade aluno X" sem ter o Customer X cadastrado
ainda. Quando vincular depois, tx ganham o customerId. Mesmo padrão do
supplierId em PAYABLE (4.0.1.a).

### 4. PM2 fork mode validado antes de instalar node-cron

`pm2 list` mostrou `mode=fork, instances=1`. Se fosse cluster, cron
duplicaria. Documentado na seção arquitetura pra futuro.

### 5. Tabs shadcn criado manualmente (Radix wrap)

Não tinha `components/ui/tabs.tsx`. Adicionado novo dep `@radix-ui/react-tabs`
(consistente com outros Radix do projeto). Wrap em estilo shadcn (data-state
classes pra hover/active).

### 6. instrumentation.ts NÃO precisa de `experimental.instrumentationHook`

Next 16 promoveu a API pra stable. Só precisa o arquivo na raiz. Verificado
e funcionando.

---

## Arquivos criados/modificados

### Novos (13)
- `prisma/migrations/20260523010000_sprint_4_0_1_b_recurrence/migration.sql`
- `lib/recurrence/next-date.ts`
- `lib/recurrence/generator.ts`
- `lib/recurrence/scheduler.ts`
- `lib/validations/recurrence.ts`
- `instrumentation.ts`
- `app/api/recorrentes/route.ts`
- `app/api/recorrentes/[id]/route.ts`
- `app/api/recorrentes/generate-now/route.ts`
- `app/api/clientes/[id]/route.ts`
- `app/(dashboard)/contas-a-receber/page.tsx`
- `app/(dashboard)/contas-a-receber/nova/page.tsx`
- `app/(dashboard)/clientes/page.tsx`
- `app/(dashboard)/clientes/novo/page.tsx`
- `app/(dashboard)/recorrentes/page.tsx`
- `app/(dashboard)/recorrentes/novo/page.tsx`
- `components/ui/tabs.tsx`
- `__tests__/recurrence-next-date.test.ts` (15 tests)
- `__tests__/recurrence-validation.test.ts` (19 tests)
- `__tests__/schema-recurrence.test.ts` (14 tests)

### Modificados (3)
- `prisma/schema.prisma` (RecurringSchedule + Transaction.recurringScheduleId + relations)
- `app/api/empresas/[id]/dre/route.ts` (parâmetro `view=previsto`)
- `app/(dashboard)/empresas/[id]/dre/dre-client.tsx` (Tabs Realizado/Previsto)
- `components/sidebar/global-sidebar.tsx` (+3 items: Receber, Recorrentes, Clientes)

### Dependências novas
- `node-cron@4.2.1` + `@types/node-cron@3.0.11`
- `@radix-ui/react-tabs`

---

## Métricas finais

```
Antes (Sprint 4.0.1.a baseline): 1734 testes passando
Depois (Sprint 4.0.1.b):         1782 testes passando (+48, +2.8%)

Tempo planejado:  ~5-6h
Tempo real:       ~1.5h

TS strict: 0 erros
Build:     ✓ Compiled successfully in 2.7s
```

---

## Operacional pós-deploy

### Conferir cron rodando em prod

```bash
pm2 logs conta-ia --lines 50 | grep -i recurrence
# Esperado ao subir: "[Recurrence] Scheduler iniciado — cron=\"0 6 * * *\""
# 06:00 todo dia: "[Recurrence] Job iniciado em ..."
```

### Smoke test funcional

1. Criar Customer em `/clientes/novo`
2. Criar Conta a Receber em `/contas-a-receber/nova` vinculado ao Customer
3. Criar Recorrente MONTHLY em `/recorrentes/novo` (folha mensal, dia 5)
4. Conferir "Próximas gerações" no preview
5. Salvar
6. Clicar "Gerar agora" → conferir tx criada em `/contas-a-pagar` (se PAYABLE)
   ou `/contas-a-receber` (se RECEIVABLE)
7. Acessar `/empresas/[id]/dre` → tab "Previsto" → conferir tx pendente aparece

### Validar anti-dup

```bash
curl -X POST https://app.caixaos.com.br/api/recorrentes/generate-now \
  -H "Cookie: auth_token=..." \
  -H "Content-Type: application/json" \
  -d '{"empresaId":"...", "windowDays":7}'
# 1ª vez: { result: { generated: 1, skippedDuplicate: 0 } }
# 2ª vez (mesmo dia): { result: { generated: 0, skippedDuplicate: 1 } }
```

---

## Próximo (Sprint 4.0.2)

Conciliação OFX ↔ PAYABLE/RECEIVABLE:
- Match algorithm (score 0-100: valor + data + supplier + descrição)
- Wizard pós-import OFX (sugestões automáticas)
- Página `/conciliacao` dedicada
- Endpoint POST `/api/conciliacao/match` + POST `/api/conciliacao/confirmar`

Foundation completa de Core Financeiro!
