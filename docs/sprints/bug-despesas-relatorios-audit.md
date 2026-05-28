# Investigação: Despesas não aparecem nos relatórios

**Data:** 28/05/2026 · **Branch:** `investigation/bug-despesas-relatorios`
**Trigger:** Yussef detectou que profit sao borja tinha 398 contas PAGAS (R$ 757.499,35)
em `/contas-a-pagar`, mas o relatório Análise IA disse "despesas zeradas".

---

## 1. Confirmação do problema

**profit sao borja** (`cmpnmgp9r0001px7oj7omv5y2`):
- 398 contas `lifecycle=PAYABLE` com `paymentDate` preenchida
- R$ 757.499,35 total
- Datas de pagamento: **Dez/2024 a Abr/2026** (Yussef disse "2025+2026" — na real começa em 12/12/2024)
- Todas têm: `categoryId`, `dreGroup`, `competenceDate`, `dueDate`, `paymentDate`, type=DEBIT
- Todas com `origin: IMPORT_EXCEL`
- Zero conciliadas (`reconciledWithId = NULL`)

---

## 2. Investigação das 4 hipóteses

### Hipótese A — Campo de data divergente (PARCIALMENTE confirmada)
- `competenceDate`: 398/398 (100%) preenchido — não é o problema
- `dueDate`: 398/398 preenchido
- `paymentDate`: 398/398 preenchido
- **Mas:** os relatórios filtram `lifecycle='EFFECTED'` antes de olhar datas → contas PAYABLE nunca chegam à etapa de filtro de data

### Hipótese B — Período do relatório (rejeitada)
- Distribuição das 398 datas cobre o range Dez/24 → Abr/26
- Análise IA do Yussef cobriu "Dez/25 a Mar/26" — período DENTRO desse range, então não é problema de período

### Hipótese C — Receita vs Despesa / sinal (rejeitada)
- 398/398 são `type='DEBIT'` (despesa)
- Sinal correto

### Hipótese D — Categoria sem dreGroup (rejeitada)
- Cacula: 273/273 categorias com `dreGroup` (100%)
- Profit: 241/241 categorias com `dreGroup` (100%)
- Não é problema de classificação

### ✅ Hipótese A refinada — **CAUSA RAIZ:** filtro `lifecycle='EFFECTED'`

**Os 9 lugares onde código de relatórios filtra `lifecycle: 'EFFECTED'`:**
- `lib/ai/collect-insight-data.ts` (5 ocorrências)
- `lib/dashboard/queries.ts` (6 ocorrências — Hero KPIs, Mini DRE, Health Check)
- `lib/relatorios/preview-queries.ts` (10 ocorrências — todos os cards de preview)
- `lib/variance/collect.ts` (1)
- `lib/cashflow/query.ts` (2 — builder centralizado)
- Total: **24 ocorrências em 5 arquivos**

Todas excluem `lifecycle='PAYABLE'`, mesmo quando `paymentDate` está preenchida (= conta efetivamente paga).

---

## 3. Onde o estado divergente nasce no código

### 3.1 IMPORT EXCEL — fonte primária do problema

`app/api/empresas/[id]/contas-pagar/import/[batchId]/confirm/route.ts:225-247`:

```typescript
const isPaid = !!row.pagamento
const txDate = row.pagamento ?? row.vencimento ?? new Date()
await tx.transaction.create({
  data: {
    // ...
    type: 'DEBIT',
    status: isPaid ? 'RECONCILED' : 'PENDING',
    origin: 'IMPORT_EXCEL',
    lifecycle: 'PAYABLE',          // ← HARDCODED!
    dueDate: row.vencimento,
    paymentDate: row.pagamento,    // ← preenchido se Excel veio com pgto
    competenceDate: row.competencia,
    // ...
  },
})
```

**Bug:** mesmo quando o Excel do contador VEM com pagamento já realizado (paymentDate preenchida), o sistema cria como `lifecycle='PAYABLE'`. Isso VIOLA a regra de validação documentada em `lib/lifecycle/index.ts:60-69`:

```typescript
// Regra 1: PAYABLE/RECEIVABLE NÃO podem ter paymentDate (não foi pago ainda).
```

Ou seja, o próprio código de validação retornaria `valid: false` pras 492 transações em prod.

### 3.2 mark_paid bulk — fonte secundária

`app/api/empresas/[id]/contas-pagar/bulk/route.ts:121-129`:

```typescript
await tx.transaction.updateMany({
  where: { id: { in: validation.allowed } },
  data: {
    paymentDate: parsed.paymentDate,
    status: 'RECONCILED',
    date: parsed.paymentDate,
    // ❌ NÃO atualiza lifecycle: 'PAYABLE' → 'EFFECTED'
  },
})
```

Marca como paga mas não transiciona. Mesmo bug do import.

### 3.3 Comportamento documentado vs realidade

`lib/lifecycle/index.ts:5-9` (doc-comment):
> EFFECTED = transação real que já aconteceu (OFX importado, pagamento manual feito).
> PAYABLE = conta a pagar (compromisso futuro, ainda não saiu do caixa). **Vira EFFECTED quando efetivada (pagamento manual) ou conciliada (OFX bate)**.

**O código não implementa essa transição.** Conceitualmente, `lifecycle` representa o "estado financeiro" (intenção vs realizado). Mas na prática nunca muda de PAYABLE pra EFFECTED.

---

## 4. Universo total afetado em prod

| Empresa | Contas invisíveis | Valor | Origin |
|---|---|---|---|
| **profit sao borja** | **398** | **R$ 757.499,35** | 100% IMPORT_EXCEL |
| **cacula mix** | **94** | **R$ 182.396,54** | 100% IMPORT_EXCEL |
| **Total** | **492 contas** | **R$ 939.895,89** | **100% IMPORT_EXCEL** |

**Cacula NÃO funcionou** — Yussef pensou que sim porque ela tem **287 EFFECTED via OFX (R$ 611k)** que aparecem corretamente nos relatórios. Mas as 94 contas Excel marcadas como pagas estão tão invisíveis quanto as do profit.

A profit não tem OFX nenhum — por isso o problema ficou óbvio lá (relatórios mostram zero).

---

## 5. Por que o problema só apareceu agora

- Sprint 4.0.1.a introduziu o conceito `lifecycle` (EFFECTED/PAYABLE/RECEIVABLE)
- Sprint 4.0.2 adicionou filtro `reconciledWithId: null` pra evitar dupla contagem PAYABLE conciliada com OFX
- **Mas ninguém implementou a transição PAYABLE → EFFECTED** quando paymentDate é preenchida sem OFX
- Funcionava nos testes porque OFX gerava EFFECTED diretamente
- Funcionava no Cacula porque OFX dominava o volume
- Quebra no Profit porque toda fonte de dados é Excel + mark_paid

---

## 6. Correção proposta — 3 frentes

### Fix A — Stop the bleeding (código)

**A1. `confirm/route.ts:238`** — não criar PAYABLE com paymentDate:

```diff
- lifecycle: 'PAYABLE',
+ lifecycle: isPaid ? 'EFFECTED' : 'PAYABLE',
```

Excel com `pagamento` preenchido = pagamento já realizado = EFFECTED.
Excel com `pagamento` vazio = conta a pagar = PAYABLE (current behavior).

**A2. `bulk/route.ts:121-129`** — transicionar lifecycle ao marcar paga:

```diff
  data: {
    paymentDate: parsed.paymentDate,
    status: 'RECONCILED',
    date: parsed.paymentDate,
+   lifecycle: 'EFFECTED',
  },
```

**A3. Auditoria de outras rotas que setam paymentDate sem mudar lifecycle.** Vou grep mais antes de aplicar o fix.

### Fix B — Backfill dos dados existentes

Migration SQL idempotente:

```sql
-- Backfill: PAYABLE com paymentDate preenchida → EFFECTED.
-- Critério conservador: só transiciona se reconciledWithId IS NULL (não está
-- conciliada com OFX — duplicaria entrada).
UPDATE transactions
SET lifecycle = 'EFFECTED'
WHERE lifecycle = 'PAYABLE'
  AND "paymentDate" IS NOT NULL
  AND "reconciledWithId" IS NULL;
```

Impacto previsto: 492 linhas atualizadas (Profit 398 + Cacula 94). Outras empresas zero (validado pela query do universo).

### Fix C — Defesa em profundidade (opcional, futuro)

Adicionar trigger DB OU validação Prisma middleware que rejeita INSERT/UPDATE com `lifecycle='PAYABLE' AND paymentDate IS NOT NULL`. Isso prevenir regressão.

**Não incluir nesta sprint** — risco de quebrar paths legítimos não identificados. Pode virar Sprint própria.

---

## 7. Pré-requisitos pro fix

- ✅ Backup pré-fix obrigatório (mesmo sendo só UPDATE)
- ⚠️ Investigar se há OUTRAS rotas que escrevem `paymentDate` sem mudar lifecycle
- ⚠️ Investigar se há alguma rota que DEPENDE de `lifecycle='PAYABLE' com paymentDate` pra alguma lógica (improvável mas vale checar)
- ⚠️ Tests automatizados antes/depois pra garantir paridade

---

## 8. Riscos do fix

| Risco | Mitigação |
|---|---|
| Backfill em prod causa dupla contagem | Critério `reconciledWithId IS NULL` exclui as já conciliadas com OFX |
| Mudança no import quebra fluxo PAYABLE puro | A2 só muda quando `isPaid=true`. PAYABLE não-pago segue igual |
| Mark_paid bulk em conta com bankAccountId muda comportamento | Verificar lib/conciliacao não é acionada por engano |
| Outras rotas de "pagar" não auditadas | Vou grep todas antes do fix definitivo |
| Cache de relatórios entrega valores velhos | TTL 60s + tag revalidation já existem |

---

## 9. Aprovação solicitada

Yussef, recomendo fazer os 3 fixes (A1, A2, B) numa **única sprint pequena**:

1. **Investigar mais 30min**: grep todos os places que setam paymentDate, garantir que não tem rota órfã
2. **Aplicar Fix A1 + A2** (código)
3. **Aplicar Fix B** (backfill em prod via SQL após backup)
4. **Validar com curl em prod** que 492 contas viram EFFECTED
5. **Yussef confirma** olhando Análise IA da profit (deve mostrar despesas reais)
6. **+15 testes** cobrindo: import Excel com isPaid → EFFECTED; mark_paid → EFFECTED; backfill idempotente

Estimativa: 2h total. Confirma essa abordagem?

Alternativa mais conservadora: aplicar SÓ Fix B (backfill) sem mexer no código — funciona pros dados existentes mas o problema VOLTA na próxima importação Excel. Não recomendo.

---

## 10. Resposta direta às perguntas do prompt

> A causa raiz é o filtro `lifecycle='EFFECTED'` nos relatórios + ausência de transição PAYABLE→EFFECTED em 2 paths (IMPORT_EXCEL com isPaid=true, mark_paid bulk).

> /contas-a-pagar vê porque filtra `lifecycle='PAYABLE'`.
> /relatorios não vê porque filtra `lifecycle='EFFECTED'`.

> competencyDate preenchido em todas as 398 (100%) — **não é** problema de competência.

> dreGroup preenchido em todas as categorias (Cacula 100%, Profit 100%) — **não é** problema de categoria.

> Cacula tem o mesmo problema (94 contas invisíveis R$ 182k), só que mascarado por 287 EFFECTED via OFX. Profit não tem OFX → problema óbvio.
