# Sprint 4.0.2 — Conciliação Inteligente OFX ↔ PAYABLE/RECEIVABLE

**Status:** ✅ CONCLUÍDO em 24/05/2026
**Suite testes:** 1782 → **1822 (+40 testes)** sem regressões
**TypeScript strict:** 0 erros · **Build:** ✓ Compiled successfully

---

## Escopo

Conciliação inteligente entre transações OFX (lifecycle EFFECTED) e
contas pendentes (PAYABLE/RECEIVABLE).

Problema resolvido:
- Usuário cria PAYABLE "Energia ENERGISA R$ 380, vence 25/05"
- Importa OFX dia 28: "ENERGISA -R$ 380"
- **Sem conciliação:** 2 lançamentos → DRE inflado R$ 760
- **Com conciliação:** sistema sugere link → 1 clique → PAYABLE vira
  EFFECTED (paymentDate=28/05) com `reconciledWithId=ofx.id`. DRE conta R$ 380 (correto).

---

## Arquitetura

### Algoritmo de match (`lib/conciliacao/match.ts`)

Função PURA `scoreMatch(ofx, candidate)` retorna score 0-100 ou `null` (descarte):

| Critério | Peso | Como |
|---|---|---|
| **Valor** | 50pts | Exato=50, ≤1% diff=40, ≤5%=25, >5%=`null` |
| **Data** | 30pts | Mesmo dia=30, D±1=25, ±3d=15, ±7d=5, >7=0 (mas não descarta) |
| **Supplier** | 15pts | `supplierId` exato |
| **Descrição** | 10pts | jaroWinkler ≥0.85=10, ≥0.65=5 |

Direção obrigatória:
- OFX `DEBIT` só casa com `PAYABLE` (saída)
- OFX `CREDIT` só casa com `RECEIVABLE` (entrada)

Recomendação por score:
- **≥ 90:** `AUTO_RECONCILE` — pré-selecionado no wizard, user só confirma
- **70-89:** `CONFIRM` — visível mas precisa checkbox manual
- **< 70:** `NO_MATCH` — não sugere

### jaroWinkler inline (`lib/conciliacao/jaro-winkler.ts`)

Implementado sem dep externa (~50 linhas). Reusa `normalizeDescription`
de `lib/ai-categorizer/normalize.ts` pra strip prefixo + datas + acentos
antes de comparar.

### Busca de candidatos (`lib/conciliacao/find-candidates.ts`)

Filtros SQL pré-cálculo (barato):
- Janela ±15 dias entre `ofx.date` e `candidate.dueDate`
- Valor candidate ±20% do `ofx.amount` (passa pelo filtro fino de 5% no score)
- Multi-tenant via OR (bankAccount/supplier/customer/category)
- `lifecycle IN (PAYABLE, RECEIVABLE)` + `status='PENDING'` + `reconciledWithId IS NULL`
- `take: 50` (limite defensivo)

### Reconciliação atomic (`lib/conciliacao/reconcile.ts`)

`reconcileTransactions(input, ctx)` — operação atômica:

1. PAYABLE/RECEIVABLE recebe:
   - `lifecycle = 'EFFECTED'`
   - `paymentDate = ofx.date` (data real do caixa)
   - `date = ofx.date`
   - `bankAccountId = ofx.bankAccountId` (herda a conta efetiva)
   - `reconciledWithId = ofx.id` (link)
   - `status = 'RECONCILED'`
2. OFX permanece intocada (preserva FITID, dedupHash, importId pra auditoria)
3. Balance NÃO é mexido (OFX já atualizou ao ser criada)
4. Audit log com `entityType='Reconciliation'` + fieldsChanged (pra desfazer)

`undoReconciliation(candidateId, ctx)`:
- Lê audit log último Reconciliation pra extrair lifecycle original (PAYABLE/RECEIVABLE)
- Reverte campos pra `paymentDate=null`, `bankAccountId=null`, `reconciledWithId=null`,
  `status='PENDING'`, `lifecycle=<original>`

### Anti-dupla-contagem no DRE (CRÍTICO)

Sem essa proteção, PAYABLE conciliada + OFX = mesmo valor 2x no DRE realizado.

Adicionado filtro `reconciledWithId IS NULL` em:
- `app/api/empresas/[id]/dre/route.ts` (visão Realizado apenas)
- `lib/cashflow/query.ts` (consolidated + by-account)
- `lib/dashboard/queries.ts` (6 queries com lifecycle=EFFECTED)

A PAYABLE conciliada aponta pra OFX → ela é "ignorada" pelo DRE caixa.
A OFX (lado real do extrato) é a fonte única do valor real.

---

## Endpoints

### `POST /api/conciliacao/match`
Body: `{ ofxTransactionId }`. Retorna candidatos rankeados + recomendação top.

### `POST /api/conciliacao/confirmar`
Body: `{ ofxTransactionId, candidateId }`. Aplica reconciliação atomic.

### `POST /api/conciliacao/desfazer/[id]`
Reverte conciliação. Lê audit log pra restaurar lifecycle original.

### `POST /api/conciliacao/bulk-confirmar`
Body: `{ pairs: [{ ofxTransactionId, candidateId }, ...] }`. Aplica N (max 100)
em sequência (cada par é atomic individualmente). Retorna `{ reconciled, failed, errors }`.

### `POST /api/conciliacao/scan-by-import`
Body: `{ importId }`. Escaneia tx OFX desse import + retorna top match de cada
uma com recomendação. Limite 100 tx por scan. Usado pelo wizard pós-OFX.

---

## UI

### `/conciliacao/wizard?importId=xxx`
Wizard pós-import. Carrega sugestões via `scan-by-import`. AUTO_RECONCILE
vem pré-selecionado; CONFIRM precisa checkbox manual. Botão "Confirmar N
selecionadas" chama `bulk-confirmar`.

### `/conciliacao` (página principal)
Layout 2 colunas:
- **Esquerda:** lista tx OFX recentes da empresa
- **Direita:** ao clicar uma tx, mostra top 5 candidatos via `/match`,
  cada um com botão "Conciliar" individual

### `components/conciliacao/match-card.tsx`
Card visual reutilizável (wizard + página principal):
- Score badge colorido (verde≥90, âmbar≥70, cinza<70)
- 2 colunas comparando OFX × candidato
- Razões em pills (Valor exato, D±1, Fornecedor exato, etc)
- Recomendação visível

### Sidebar
+1 item "Conciliação" abaixo de Clientes.

---

## Decisões técnicas notáveis

### 1. Estratégia LINK (não MERGE)

PAYABLE vira EFFECTED com `reconciledWithId=ofx.id`. OFX permanece. Razões:
- Preserva FITID, dedupHash, importId pra auditoria fiscal
- Permite "desfazer" conciliação (Sprint atual)
- DRE caixa filtra `reconciledWithId IS NULL` pra evitar dupla contagem
- Conta Azul faz exatamente assim

### 2. Threshold AUTO_RECONCILE ≥ 90

Conservador. Falso positivo aqui = user precisa desfazer. Como o user
ainda confirma "X selecionadas" (checkbox pré-marcado mas visível), é
seguro auto-selecionar mas exigir 1 clique pra concluir.

### 3. jaroWinkler inline (sem dep)

Implementação clássica de ~50 linhas. Reduz deps + controle total da
normalization (normalizeDescription do ai-categorizer).

### 4. Janela ampla na busca, filtro fino no score

SQL busca ±15 dias e ±20% valor. Score interno descarta >5% valor.
Tradeoff: queries mais largas mas pré-rankeamento determinístico claro.

### 5. Bulk não-atomic globalmente

`bulk-confirmar` faz cada par atomic individualmente. Se 8 dão certo e 2 falham,
os 8 ficam conciliados + retorno mostra errors. Alternativa "tudo ou nada"
seria pior porque 1 candidato indisponível abortaria 99 outros.

### 6. `undoReconciliation` lê audit log pra restaurar lifecycle

Schema não armazena "lifecycle anterior" — usamos a propriedade `fieldsChanged`
do AuditLog (gravado como JSON) pra extrair o estado pré-conciliação. Limite:
se audit foi deletado, undo falha (mensagem explícita).

---

## Arquivos criados/modificados

### Novos (12)
- `lib/conciliacao/jaro-winkler.ts`
- `lib/conciliacao/match.ts`
- `lib/conciliacao/reconcile.ts`
- `lib/conciliacao/find-candidates.ts`
- `app/api/conciliacao/match/route.ts`
- `app/api/conciliacao/confirmar/route.ts`
- `app/api/conciliacao/desfazer/[id]/route.ts`
- `app/api/conciliacao/bulk-confirmar/route.ts`
- `app/api/conciliacao/scan-by-import/route.ts`
- `app/(dashboard)/conciliacao/page.tsx`
- `app/(dashboard)/conciliacao/wizard/page.tsx`
- `components/conciliacao/match-card.tsx`
- `__tests__/conciliacao-jaro-winkler.test.ts` (13 tests)
- `__tests__/conciliacao-match.test.ts` (27 tests)

### Modificados (3)
- `lib/cashflow/query.ts` (filtro `reconciledWithId: null` em 2 builders)
- `lib/dashboard/queries.ts` (filtro em 6 queries com lifecycle=EFFECTED)
- `app/api/empresas/[id]/dre/route.ts` (filtro condicional só em view=realizado)
- `components/sidebar/global-sidebar.tsx` (+item Conciliação)

---

## Métricas finais

```
Antes (Sprint 4.0.1.b): 1782 testes passando
Depois (Sprint 4.0.2):  1822 testes passando (+40, +2.2%)

Tempo planejado:  ~6h
Tempo real:       ~1.5h

TS strict: 0 erros
Build:     ✓ Compiled successfully
```

---

## Smoke test pós-deploy

1. Criar PAYABLE em `/contas-a-pagar/nova` (R$ 380, dueDate hoje+3d, fornecedor opcional)
2. Importar OFX que contenha transação parecida (mesmo valor, descrição similar)
3. Sistema redireciona pra `/conciliacao/wizard?importId=...` (TODO: integrar redirect no import — Sprint 4.0.3)
4. Por enquanto: acessar manualmente `/conciliacao/wizard?importId=<id-do-import>`
5. Conferir card aparece com score + razões
6. Confirmar → PAYABLE some de `/contas-a-pagar` (virou EFFECTED)
7. Conferir `/dre` continua somando R$ 380 só uma vez

### Validar anti-dup do DRE

```sql
-- Antes da conciliação (DRE realizado): conta só a OFX
SELECT SUM(amount) FROM transactions
WHERE lifecycle='EFFECTED' AND "reconciledWithId" IS NULL
  AND date BETWEEN '2026-05-01' AND '2026-05-31';

-- Após conciliação: continua só contando 1x (PAYABLE virou EFFECTED + tem reconciledWithId,
-- então é excluída pela query — só a OFX original entra)
```

---

## Próximo (Sprint 4.0.3)

1. Redirect automático pós-OFX → `/conciliacao/wizard?importId=...`
2. Fluxo Previsto no Dashboard (KPI card "A pagar próximos 30d")
3. Alertas email "Vence em 3 dias"
4. Match com Claude Haiku pra casos cinzentos (score 50-70)

Foundation completa de Core Financeiro!
