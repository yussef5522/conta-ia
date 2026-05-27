# Importador Excel de Contas a Pagar (Sprint 5.0.2.0)

Permite empresa do CAIXAOS subir a planilha de Contas a Pagar do contador
em qualquer formato e a IA cadastrar tudo automaticamente: fornecedores
novos, funcionários, contas pagas (com data), contas a pagar (em aberto).

## Visão geral do fluxo

```
1. /empresas/[id]/contas-pagar/import — UI multi-step
2. Upload  →  POST /api/empresas/[id]/contas-pagar/import/upload
3. Detect  →  POST /api/empresas/[id]/contas-pagar/import/[batchId]/detect
4. Review  →  GET  /api/empresas/[id]/contas-pagar/import/[batchId]/review
5. Confirm →  POST /api/empresas/[id]/contas-pagar/import/[batchId]/confirm
6. Redirect → /dashboard?imported=N&totalAmount=X — banner pós-import
```

## Modelos envolvidos

- `Employee` (NOVO) — funcionário CLT/ESTAGIO/PJ/AUTONOMO, separado de Supplier
  (folha tem natureza distinta — encargos/13/rescisão)
- `ExcelImportBatch` (NOVO) — 1 por upload; idempotente via `companyId+fileHash`
- `StagedPayableRow` (NOVO) — linha de staging entre upload e confirm
- `Transaction.employeeId` (NOVO) — alternativo a `supplierId` em PAYABLE de folha
- **Reusa** `Transaction.lifecycle='PAYABLE'` (Sprint 4.0.1.a — já existia!)

## Pipeline de cadastro

| Etapa | O que decide | Onde mora |
|---|---|---|
| Mapping de colunas | Heurística por nome + Claude Haiku tool use refina | `lib/excel-import/detect-columns.ts` |
| Cache cross-import | Hash do header → mapping cacheado no `AiClaudeCache` | `lib/excel-import/detect-columns.ts` |
| Classify favorecido | SUPPLIER / EMPLOYEE / ORGAO_PUBLICO | `lib/excel-import/classify-favorecido.ts` |
| Map categoria | Centro de custo → Category (plano setorial Sprint s) | `lib/excel-import/map-categories.ts` |
| Dedup | sha256(favorecido+desc+vencimento+valor) vs PAYABLE últimos 90d | `/detect/route.ts` |

## Detecção de favorecido — regras estritas

1. Se planilha tem coluna `beneficiario_tipo` com valor explícito ("Fornecedores"/"Colaboradores"/"Órgãos oficiais") → confia (0.95)
2. Heurística por nome:
   - 26 termos órgão público (RECEITA/INSS/FGTS/DARF/DAS/PREFEITURA/...) → ORGAO_PUBLICO
   - 22 formas jurídicas (LTDA/SA/EIRELI/COMERCIO/DISTRIBUIDORA/...) → SUPPLIER
   - 2+ palavras-nome consecutivas (4+ letras) → EMPLOYEE
   - Default conservador: SUPPLIER
3. `inferEmployeeTipo` via centro de custo: "Salário Estagiário" → ESTAGIO

## Mapping de categorias — 4 estratégias

1. **Match exato** (confidence 1.0)
2. **Hint regex setorial** (35+ patterns BR: folha/tributos/utilidades/MP)
3. **Token similarity Jaccard** ≥0.55
4. **Sem match** → propõe categoria nova com nome do CC

## Boundary do parser (exceljs)

- Arredonda `Valor` pra 2 casas (`300.47000000000003` → `300.47`)
- Filtra linhas-total (`TOTAL`/`SUBTOTAL`/`SOMA` no Favorecido)
- Filtra linhas sem favorecido ou totalmente vazias
- Aceita datas DD/MM/YYYY, D/M/YY, MM/YYYY (competência), ISO
- `headerHash sha256` deterministico — cache cross-import

## Limites

- Tamanho: 10 MB
- Linhas: 5000
- Aba: primeira (UI mostra `totalSheets` se múltiplas)

## Como testar

1. Login no app
2. Abrir empresa cadastrada com setor (Cacula Mix tem setor=RESTAURANTE)
3. Ir em `/empresas/<id>/contas-pagar/import`
4. Upload da planilha (.xlsx do contador)
5. "Analisar com IA" → vê breakdown
6. Revisar tabela; desmarcar duplicatas e linhas suspeitas
7. "Confirmar import" → redireciona pro dashboard com banner

## Custos

- Detecção heurística inicial: $0 (sem IA)
- Refino IA por planilha (Claude Haiku tool use): ~$0.001 (cacheado por hash do header)
- Classify + map por linha: $0 (puro local)

## Network effect

Cliente A sobe planilha do contador X → mapping fica em cache.
Cliente B com mesmo contador (mesmos headers) → cache hit, 0 custo, instantâneo.

## Não está nesta sprint

- ❌ Cruzar com OFX automaticamente (conciliação manual fica em `/conciliacao`)
- ❌ PDF (exige OCR — sprint dedicada)
- ❌ Múltiplas abas (só primeira)
- ❌ Folha completa (CPF/cargo/admissão/salário base — sprint dedicada de RH)
- ❌ Dashboard com cálculos novos (banner usa o que já tem)

## Arquivos

```
prisma/
  schema.prisma                                      (Employee + Batch + StagedRow + tx.employeeId)
  migrations/20260606000000_sprint_5_0_2_0_excel_import_ap/

lib/excel-import/
  parse-xlsx.ts                                     (exceljs + parseBRDate)
  detect-columns.ts                                 (Claude Haiku tool use + heurística + cache)
  classify-favorecido.ts                            (SUPPLIER/EMPLOYEE/ORGAO_PUBLICO)
  map-categories.ts                                 (4 estratégias)

app/api/empresas/[id]/contas-pagar/import/
  upload/route.ts
  [batchId]/detect/route.ts
  [batchId]/review/route.ts                         (GET pra UI)
  [batchId]/confirm/route.ts

app/(dashboard)/empresas/[id]/contas-pagar/import/
  page.tsx                                          (server component)
  import-excel-client.tsx                           (4 steps: UPLOAD/DETECT/REVIEW/CONFIRMED)

app/(dashboard)/dashboard/_components/
  ImportedBanner.tsx                                (banner pós-import)

__tests__/
  excel-import-parse-xlsx.test.ts                   (12 tests)
  excel-import-detect-columns-heuristic.test.ts     (8 tests)
  excel-import-classify-favorecido.test.ts          (20 tests)
  excel-import-map-categories.test.ts               (16 tests)
```

**Total: 56 testes novos** sem regressões na suite existente.
