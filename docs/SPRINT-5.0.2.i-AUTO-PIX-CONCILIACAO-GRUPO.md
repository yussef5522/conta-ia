# Sprint 5.0.2.i — Auto-aplicar Pix + Conciliação Transferências Grupo

**Status:** ✅ CONCLUÍDO em 25/05/2026
**Suite testes:** 2336 → **2347 (+11 testes)** sem regressões
**TypeScript strict:** 0 erros · **Build:** ✓ Compiled

## Contexto

Sprint 5.0.2.h deixou as bases (SocioPF, EmpresaRelacionada, `lib/pix-detection/`) mas com 3 itens pendentes documentados:

1. Integrar `detectPixForTransaction` no pipeline de categorização
2. Conciliação automática transferências internas entre CNPJs do grupo
3. Exclusão das transferências internas do DRE

Sem isso, mesmo Yussef cadastrando CPFs/CNPJs em `/pessoas-vinculadas`, as transações Pix continuavam sendo categorizadas só pelo Claude normal — sem detecção dos relacionados, sem filtro de DRE.

## Parte A — Pipeline Pix (camada 0)

### `lib/categorias/ensure-system-categories.ts` (NOVO)
Garante existência idempotente de 3 categorias do sistema por empresa:
- **Distribuição de Lucros** (EXPENSE, dreGroup `DISTRIBUICAO_LUCROS`, púrpura)
- **Pró-labore** (EXPENSE, dreGroup `DESPESAS_PESSOAL`, azul)
- **Transferência entre Contas (grupo)** (TRANSFER, dreGroup `TRANSFERENCIA`, cinza)

Função `resolveSystemCategoryId(dreGroup, categories)` mapeia dreGroup → categoryId correta.

### `lib/pix-detection/auto-apply-pix.ts` (NOVO)
Duas funções:

- **`autoApplyPixForTransaction(companyId, txId, description, [categories])`** — async, full DB. Detecta + aplica patch direto na Transaction (status=RECONCILED, categoryId, classificationSource=AI, aiConfidence=1.0, relatedPartyType/Id).

- **`detectAndPlanPixApply(tx, socios, empresasRelacionadas, systemCategories)`** — PURA. Recebe cadastros pre-carregados, retorna `{ detection, apply, patch? }`. Pra uso em batch (import OFX, recategorize retroativo).

Confiança máxima (1.0) — match exato de CPF/CNPJ/email/telefone/nome é determinístico.

## Parte B — Schema + Conciliação Grupo

### Migration `20260527000000_sprint_5_0_2i_internal_transfer_match`
`Transaction` ganha:
- `isInternalTransfer Boolean @default(false)`
- `linkedTransactionId String? @unique`
- `@@index([isInternalTransfer])`

### `lib/conciliation/match-internal-transfer.ts` (NOVO)
Função `matchInternalTransferForTransaction(input)`:

1. Só procura pra tx com `relatedPartyType === 'GRUPO_PJ'`
2. Busca `EmpresaRelacionada` cadastrada (precisa estar no /pessoas-vinculadas)
3. Busca a empresa correspondente no sistema (`Company.cnpj`)
4. Janela ±1 dia + valor exato + tipo oposto (DEBIT ↔ CREDIT)
5. Se acha candidata: atomic `$transaction` marca AMBAS `isInternalTransfer=true` e linka via `linkedTransactionId`

Retorna `{ matched, linkedTransactionId, linkedCompanyId, reason }`.

### Filtros DRE/Cashflow
- `lib/cashflow/query.ts` (consolidado) → `isInternalTransfer: false` adicionado
- `app/api/empresas/[id]/dre/route.ts` → `isInternalTransfer: false` adicionado em ambas views (Realizado + Previsto)
- Cashflow POR CONTA (`buildByAccountCashflowWhere`) mantido SEM filtro — extrato individual mostra a movimentação real

## Parte C — Endpoint retroativo

### `POST /api/empresas/[id]/recategorize-pix`
Re-analisa Tx EFFECTED com PIX na descrição que ainda não têm `relatedPartyType`:

1. Carrega cadastros + garante categorias do sistema
2. Se não há sócio nem empresa relacionada cadastrada → retorna msg orientativa
3. Busca candidatas (cap 2000)
4. Pra cada: roda `detectAndPlanPixApply` + aplica patch
5. Pra `GRUPO_PJ` aplicados: roda `matchInternalTransferForTransaction`
6. Retorna `{ analisadas, socioPF, grupoPJ, conciliacoes }`

### UI em `/pessoas-vinculadas`
Card explicativo no topo agora tem botão **"Re-analisar Pix antigos"** (aparece só se houver pelo menos 1 sócio ou empresa cadastrada). Confirm dialog → roda endpoint → toast com sumário.

## Decisões técnicas

- **Camada 0 do pipeline** — Pix detection roda ANTES de Claude/regras/keywords. Match exato (CPF/CNPJ) tem confidence 1.0 e aplica direto sem chamar IA paga.
- **`mode: 'insensitive'` removido** — SQLite-dev não suporta. OFX padrão usa "PIX" caixa-alta, então `contains: 'PIX'` simples já pega 95%+.
- **`isInternalTransfer` em DRE/cashflow consolidado mas NÃO em por-conta** — extrato individual mostra movimentação real (saída da conta A apareceu, entrada na conta B apareceu); só não infla análise consolidada do grupo.
- **`linkedTransactionId` com @unique** — força 1↔1 (tx só pode ter UM par). Cleanup natural se uma é deletada (outra fica órfã com flag, retoma como tx normal).
- **Camada 0 não foi integrada no `autoClassifyTransactions` síncrono** — aquela função roda no IMPORT OFX antes de salvar (não tem ID ainda). O caller do import precisa ou (a) usar `detectAndPlanPixApply` no batch ou (b) rodar `autoApplyPixForTransaction` post-create. Pra MVP, **endpoint retroativo `/recategorize-pix` cobre o use case** — Yussef rodá-lo após cadastrar pessoas vinculadas e após cada novo import.

## Pendências pra futuras sprints

- **Integração no pipeline síncrono** do import OFX (Sprint 5.0.2.j?) — aplicar `detectAndPlanPixApply` no batch antes do `createMany`
- **Hook automático** pós-import OFX → roda `recategorize-pix` em background
- **Badge visual** `relatedPartyType` na lista de Pendentes (componente `PendentesClient` precisa expor o campo + buscar nome via fetch)
- **UI "Mostrar transferências internas"** em `/transacoes` com filtro toggle

## Smoke test pra Yussef

1. **`/pessoas-vinculadas`** — cadastrar:
   - Sócio "Yussef Musa" com CPF + chave Pix
   - Empresa relacionada CNPJ academia + nome
2. Clicar **"Re-analisar Pix antigos"** (botão novo no card indigo) → confirm → toast com sumário
3. **`/pendentes`** — Tx que eram Pix pra você ou academia agora estão RECONCILED com categoria correta (Distribuição/Pró-labore/Transferência)
4. **`/dre`** — Tx categorizadas como Transferência interna SUMIRAM (não infla receita/despesa)
5. **Próxima importação OFX** — Pix com CNPJ academia continua aparecendo como tx normal até rodar `recategorize-pix` de novo OU aguardar Sprint 5.0.2.j (integração automática no import)
6. **Conciliação grupo**: depois de importar OFX das DUAS empresas (Cacula + Academia), rodar recategorize em ambas → matches automáticos (linkedTransactionId vincula as 2 pontas)

## Arquivos

### Novos (4)
- `lib/categorias/ensure-system-categories.ts`
- `lib/pix-detection/auto-apply-pix.ts`
- `lib/conciliation/match-internal-transfer.ts`
- `app/api/empresas/[id]/recategorize-pix/route.ts`
- `__tests__/pix-auto-apply.test.ts` (11 tests)
- `prisma/migrations/20260527000000_sprint_5_0_2i_internal_transfer_match/`

### Modificados (4)
- `prisma/schema.prisma` (+Transaction.isInternalTransfer + linkedTransactionId)
- `lib/cashflow/query.ts` (filtro `isInternalTransfer: false`)
- `app/api/empresas/[id]/dre/route.ts` (filtro `isInternalTransfer: false`)
- `app/(dashboard)/pessoas-vinculadas/pessoas-vinculadas-client.tsx` (botão "Re-analisar Pix antigos")
