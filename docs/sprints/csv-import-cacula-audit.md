# Auditoria — Import CSV Contas a Pagar (formato CACULA + genérico)

**Data:** 30/05/2026 · **Branch:** `feature/csv-import-cacula` (a criar)
**Baseline:** main HEAD `7582b33` (PDF worker entregue em prod)

---

## 1. Contexto e escopo

Yussef forneceu o arquivo real `~/Downloads/contas-pagar-2026-05-30.csv`
(export do sistema financeiro da CACULA MIX ITAQUI: 542 linhas =
1 header + 541 dados, UTF-8, separador `;`, todos os valores
NEGATIVOS, formato brasileiro). Este audit propõe o plano para:

- Habilitar import CSV no fluxo existente de Contas a Pagar
- **Fast-path determinístico** pro formato CACULA (mapping exato do spec)
- **Fall-back IA** pra qualquer outro CSV (genérico, headers desconhecidos)
- Conexão com `lib/lifecycle/index.ts` pra evitar o bug histórico de R$ 939k
  (PAYABLE+paymentDate inválido)

Não há sprint base prévia — este é o documento único.

---

## 2. As 4 decisões aprovadas (recap)

| # | Decisão | Detalhe |
|---|---|---|
| 1 | Sem doc pai | Este audit é o spec único |
| 2 | Integrar no fluxo existente | Adicionar parser CSV ao pipeline `/import/upload/[batchId]/{detect,review,confirm}` — mesmo botão, mesmo downstream |
| 3 | Fast-path CACULA | Detectar header → mapping determinístico (skip IA). CSV desconhecido → IA. Preview SEMPRE obrigatório. |
| 4 | LGPD | Arquivo real NÃO vai pro git. Fixture ANONIMIZADA em `__tests__/fixtures/cacula-formato-anon.csv`. `.gitignore` adiciona arquivos reais. |

---

## 3. Pipeline atual descoberto

```
POST /import/upload (FormData file)
  ↓
  parseXlsx() (exceljs)
  heuristicFallback() (sem IA, instant)
  cria ExcelImportBatch + N StagedPayableRow
  ↓
POST /import/[batchId]/detect (refinamento IA se confidence baixo)
  ↓
GET  /import/[batchId]/review (UI preview)
  ↓
POST /import/[batchId]/confirm (cria Transactions reais)
```

### Modelo `StagedPayableRow` (já existe — reusado integralmente)

Campos já cobrem 100% do que CACULA precisa:
- raw: `rawFavorecido`, `rawDescricao`, `rawCompetencia`, `rawVencimento`,
  `rawPagamento`, `rawValor`, `rawStatus`
- normalizados: `valor`, `vencimento`, `pagamento`, `competencia`,
  `paymentStatus`
- match: `favorecidoType`, `matchedSupplierId`, `matchedCategoryId`

🚨 **Lacuna identificada:** `paymentStatus` é `"PAID" | "PENDING"`,
não `Lifecycle`. Pro CACULA precisamos persistir o **lifecycle final**
no preview e no confirm. Vou adicionar campo opcional `lifecycle` em
`StagedPayableRow` (migration aditiva).

### Detector de magic bytes (`lib/excel-import/magic-bytes.ts`)
Hoje só valida `.xlsx`/`.xls`. Vamos estender pra também aceitar `.csv`
(magic bytes: pode começar com BOM `EF BB BF` ou direto com ASCII).

### Mensagem de erro (`lib/excel-import/error-codes.ts:49`)
Atualmente: *"PDF, CSV e outros formatos ainda não são aceitos"*.
Vamos remover a menção de CSV (agora aceito).

---

## 4. Plano de mudança nos arquivos

### Nova lib `lib/csv-import/` (NÃO renomeio lib/excel-import; cria parallel)

```
lib/csv-import/
├── parse-csv.ts         # parser genérico: separador ; ou , detecção auto + BOM + RFC 4180
├── detect-cacula.ts     # detector do header CACULA exato (fast-path)
├── map-cacula.ts        # mapping determinístico CACULA (20 colunas → StagedRow)
├── parse-valor-br.ts    # "-5.312,80" → -5312.80
├── parse-data-br.ts     # "30/05/2026" → Date (ou null pra "-" / "")
├── clean-categoria.ts   # "MATERIA PRIMA ( R$ 5.312,80 );" → "MATERIA PRIMA"
└── lifecycle-cacula.ts  # STATUS + paymentDate → Lifecycle (validado vs lib/lifecycle)
```

### Mudanças em `lib/excel-import/`

| Arquivo | Mudança |
|---|---|
| `magic-bytes.ts` | Adiciona `isValidCsv(buffer)`: aceita BOM, ASCII, UTF-8 com acentos. Renomeia `isValidExcel` p/ continuar funcionando |
| `error-codes.ts` | L49: remove menção a CSV. Adiciona `CSV_HEADER_DESCONHECIDO`, `CSV_LINHA_QUEBRADA`, etc |
| `detect-columns.ts` | Estende `CanonicalField` se necessário (provavelmente OK como está) — IA mapeia headers genéricos de CSV igual Excel |

### Mudanças em `/import/upload/route.ts`

Estende o switch por mime-type/extension:

```ts
const ext = file.name.toLowerCase().split('.').pop()
if (ext === 'csv' || file.type === 'text/csv') {
  const text = await file.text()  // UTF-8
  const parsed = parseCsv(text)   // detecta separador, parsea linhas
  if (detectaCacula(parsed.headers)) {
    // Fast-path: mapping determinístico
    rows = mapearCsvCacula(parsed)
  } else {
    // Cai no fluxo genérico (mesmo do Excel)
    rows = parsed.rows
    detectedMapping = heuristicFallback(parsed.headers, parsed.sampleRows)
  }
} else if (ext === 'xlsx' || ext === 'xls') {
  // pipeline Excel existente intocado
}
```

### `/import/[batchId]/detect|review|confirm` — **intocados**
Downstream reusa 100%. CSV vira só mais um upstream que produz
`StagedPayableRow` no mesmo formato.

### Migration (mínima e aditiva)

```sql
ALTER TABLE "StagedPayableRow" ADD COLUMN "lifecycle" TEXT;
-- 'EFFECTED' | 'PAYABLE' | 'RECEIVABLE' | NULL (não preenchido)
```

CACULA fast-path preenche; Excel/CSV genérico deixa NULL e o
`confirm` decide via lógica atual (`paymentStatus=PAID → EFFECTED;
PENDING → PAYABLE`). Sem breaking change.

---

## 5. Fast-path detection — header CACULA exato

```ts
const CACULA_HEADER_FIELDS = [
  'ID', 'VALOR', 'JUROS/MULTA', 'DESCONTO', 'TOTAL', 'PARCELA',
  'DATA LANCAMENTO', 'DATA COMPETENCIA', 'DATA DE VENCIMENTO',
  'DATA DO PAGAMENTO', 'UNIDADE', 'ORIGEM', 'STATUS',
  'CREDOR/PAGANTE', 'CATEGORIA CONTABIL', 'DESCRICAO',
  'FORMA DE PAGAMENTO', 'NUMERO NOTA', 'BANCO', 'OBS.',
]

export function detectaCacula(headers: string[]): boolean {
  // Tolerante: ignora trailing ';' do header CACULA real (21 campos
  // sendo o último vazio) + case-insensitive + trim
  const normalized = headers
    .map((h) => h.trim().toUpperCase())
    .filter(Boolean)
  if (normalized.length !== 20) return false
  return CACULA_HEADER_FIELDS.every(
    (f, i) => normalized[i].toUpperCase() === f.toUpperCase(),
  )
}
```

Conservador: exige os 20 campos NA ORDEM, sem variação. Qualquer
variação cai no fluxo IA genérico (que mapeia robustamente).

---

## 6. Mapeamento determinístico CACULA (do adendo)

| Campo CAIXAOS | Coluna CSV (índice 0-based) | Tratamento |
|---|---|---|
| `rawValor` / `valor` | TOTAL (4) | `parseValorBR("-153,00") → -153.00` |
| `rawCompetencia` / `competencia` | DATA COMPETENCIA (7) | `parseDataBR("30/05/2026")` |
| `rawVencimento` / `vencimento` | DATA DE VENCIMENTO (8) | `parseDataBR(...)` |
| `rawPagamento` / `pagamento` | DATA DO PAGAMENTO (9) | `"-" → null; vazio → null; senão parseDataBR` |
| `rawStatus` | STATUS (12) | mantém literal (`PAGO`/`VENCE HOJE`/`VENCIDO`) |
| `lifecycle` | derivado de STATUS + pagamento | regra do §7 |
| `rawFavorecido` | CREDOR/PAGANTE (13) | `URSO SILVANO` etc |
| `rawDescricao` | CREDOR/PAGANTE (13) **+** DESCRICAO (15) se ≠ "-" | concat por " — " se DESCRICAO presente; senão só favorecido |
| `rawCentroCusto` | CATEGORIA CONTABIL (14) | `limparCategoria(...)` (remove " ( R$ X,XX )" embedded) |
| (sem campo) | UNIDADE (10) | Mostrar no preview "Arquivo: CACULA MIX ITAQUI" |
| (sem campo) | ORIGEM (11) | Ignorado neste momento |
| (sem campo) | PARCELA (5) | Ignorado |
| (sem campo) | JUROS/MULTA (2), DESCONTO (3), VALOR (1) | Ignorados — TOTAL já inclui |
| `rawNota` | NUMERO NOTA (17) | `"-" → null` |
| (sem campo) | FORMA DE PAGAMENTO (16) | Ignorado nesta sprint |
| (sem campo) | BANCO (18), OBS. (19) | Ignorados |

🚨 **Sinal do valor:** CACULA exporta SEMPRE negativo (são saídas).
O modelo `StagedPayableRow.valor` é Float. Pesquisei o flow do Excel
(`upload/route.ts:64-68`):
```ts
if (typeof v === 'number') return Math.round(v * 100) / 100
```
Excel aceita valor positivo OU negativo direto. Pra MANTER consistência
com Excel: **armazenar valor ABSOLUTO** (positivo). O tipo do lançamento
("contas a pagar = despesa") já está implícito pelo modelo. Yussef
confirmou neste exato comportamento na sprint 5.0.2.0 (bug de R$ 939k
foi sobre lifecycle, não sinal). Mais seguro: armazenar `Math.abs(valor)`.

---

## 7. Regra de lifecycle CACULA (CRÍTICA)

```ts
// lib/csv-import/lifecycle-cacula.ts
import { validateLifecycleState } from '@/lib/lifecycle'

export function definirLifecycleCacula(
  status: string,
  paymentDate: Date | null,
): Lifecycle {
  const norm = status?.toUpperCase().trim()
  const pago = norm === 'PAGO'
  const temPaymentDate = paymentDate !== null

  if (pago && temPaymentDate) return 'EFFECTED'  // conta paga ✓
  if (pago && !temPaymentDate) {
    // EDGE: STATUS=PAGO mas sem data de pagamento → assume PAYABLE
    // (defensivo: preferimos tratar como pendente vs criar EFFECTED órfão)
    return 'PAYABLE'
  }
  // VENCE HOJE, VENCIDO, qualquer outro → PAYABLE
  return 'PAYABLE'
}

export function validarRow(
  lifecycle: Lifecycle,
  paymentDate: Date | null,
): { ok: true } | { ok: false; reason: string } {
  // Bug histórico R$ 939k: PAYABLE + paymentDate é INVÁLIDO.
  // Se cair aqui, é bug do mapper.
  return validateLifecycleState({ lifecycle, paymentDate, ... })
}
```

**Estados no arquivo real (validei):**
- PAGO: 528 linhas (97.6%) → EFFECTED se temPaymentDate
- VENCE HOJE: 11 linhas (2.0%) → PAYABLE
- VENCIDO: 2 linhas (0.4%) → PAYABLE

⚠️ Tracking: quando lifecycle=EFFECTED no CACULA, `paymentDate`
PRECISA estar preenchido. Se vier `PAGO` + `paymentDate="-"`,
defensivamente marcamos PAYABLE (não EFFECTED órfão).

---

## 8. Limpeza categoria e detecção multi-cat

```ts
// lib/csv-import/clean-categoria.ts
const R_REGEX = /\s*\(\s*R\$[^)]*\)\s*;?/g

export function limparCategoria(raw: string): string {
  if (!raw || raw === '-' || raw.trim() === '') return ''
  return raw.replace(R_REGEX, '').trim().replace(/;+$/, '').trim()
}

export function detectarMultiCategoria(raw: string): {
  primeira: string
  temMultiplas: boolean
  contagem: number
} {
  if (!raw || raw === '-') return { primeira: '', temMultiplas: false, contagem: 0 }
  const matches = raw.match(/\(\s*R\$[^)]*\)/g) ?? []
  const partes = raw.split(';').map(limparCategoria).filter(Boolean)
  return {
    primeira: partes[0] ?? '',
    temMultiplas: matches.length > 1,
    contagem: matches.length,
  }
}
```

⚠️ **REGRA CRÍTICA:** o valor entre parênteses na categoria é NÃO
CONFIÁVEL e DEVE SER IGNORADO. O valor SEMPRE vem da coluna TOTAL.

🚨 **Achado durante audit:** o arquivo atual da CACULA tem **ZERO
linhas multi-categoria** (validei com `awk -F';'` — todas têm 0 ou 1
"( R$ )"). Os números de linha mencionados no spec (26, 509, 529) não
batem com o conteúdo do arquivo, mas implementar a detecção de
multi-cat AINDA assim por defesa (uploads futuros podem ter).

**Preview UI:** linha com `temMultiplas=true` recebe badge ⚠️
"Múltiplas categorias — revisar".

---

## 9. Campos vazios / "-" / nulls

| Valor bruto | Tratamento |
|---|---|
| `"-"` | `null` |
| `""` | `null` |
| `" "` (whitespace) | `null` |
| Qualquer outro | trim + retorna |

Aplicado em **todos os campos** ANTES de qualquer parse específico.
Helper `normalizeCacula(s: string): string | null`.

---

## 10. LGPD — fixture anonimizada

### Arquivo real
- Fica só em `~/Downloads/` do Yussef (smoke test manual em prod)
- Adiciona em `.gitignore`:
  ```
  # CSV de import real (contém dados pessoais — LGPD)
  __tests__/fixtures/cacula-real-*.csv
  /tmp/cacula-real-*.csv
  ```

### Fixture anonimizada (versionada)

`__tests__/fixtures/cacula-formato-anon.csv` — **mesma ESTRUTURA**
do arquivo real:
- Mesmos 20 cabeçalhos exatos (+ trailing `;`)
- Mesmos 3 STATUS variados (PAGO, VENCE HOJE, VENCIDO)
- ~50 linhas representativas cobrindo:
  - Valores variados (`-153,00` até `-5.312,80`)
  - Datas variadas (cobrir todos os meses do ano)
  - Categorias com/sem `( R$ X )` embedded
  - 2-3 linhas multi-categoria (mesmo o arquivo real não tendo) pra testar regra
  - 1-2 linhas com `paymentDate = "-"` mesmo STATUS=PAGO (edge)
  - Acentos: `FORNECEDOR GRÁFICOS`, `MATERIAIS DIVERSOS LTDA`, etc
  - Fornecedores: `FORNECEDOR A`, `FORNECEDOR B`, ..., `FORNECEDOR Z` (genéricos)

**ZERO dados pessoais reais.** Estrutura 100% representativa.

---

## 11. Casos de teste (≥15 novos + fixture E2E)

### `lib/csv-import/parse-valor-br.test.ts` (6)
```ts
test('"-5.312,80" → -5312.80', ...)
test('"-153,00" → -153.00', ...)
test('"0,00" → 0', ...)
test('"-" → null', ...)
test('"" → null', ...)
test('valor inválido "abc" → null + erro reportado', ...)
```

### `lib/csv-import/parse-data-br.test.ts` (5)
```ts
test('"30/05/2026" → 2026-05-30 UTC', ...)
test('"-" → null', ...)
test('"" → null', ...)
test('"32/01/2026" → null (inválida)', ...)
test('"30/13/2026" → null (mês inválido)', ...)
```

### `lib/csv-import/clean-categoria.test.ts` (8)
```ts
test('"MATERIA PRIMA ( R$ 5.312,80 );" → "MATERIA PRIMA"', ...)
test('"ENERGIA ELETRICA ( R$ 129,68 );" → "ENERGIA ELETRICA"', ...)
test('"ENTREGADOR DELIVERY" → "ENTREGADOR DELIVERY" (sem embedded)', ...)
test('"-" → ""', ...)
test('"" → ""', ...)
test('multi: "MATERIA PRIMA ( R$ 1.144,08 );OUTRAS ( R$ 2,98 );" → primeira="MATERIA PRIMA", temMultiplas=true, contagem=2', ...)
test('NUNCA usa valor embutido — só limpa', ...)
test('preserva acentos: "GRÁFICAS ESPECIAIS ( R$ 100,00 );" → "GRÁFICAS ESPECIAIS"', ...)
```

### `lib/csv-import/lifecycle-cacula.test.ts` (7)
```ts
test('STATUS=PAGO + paymentDate=Date → EFFECTED', ...)
test('STATUS=VENCE HOJE + pagamento "-" → PAYABLE', ...)
test('STATUS=VENCIDO + pagamento "-" → PAYABLE', ...)
test('STATUS=PAGO + paymentDate=null (edge "pagamento órfão") → PAYABLE defensivo', ...)
test('STATUS lowercase "pago" → EFFECTED (case-insensitive)', ...)
test('NUNCA cria PAYABLE+paymentDate (validateLifecycleState bate)', ...)
test('valida contra lib/lifecycle/index.ts (validateLifecycleState)', ...)
```

### `lib/csv-import/detect-cacula.test.ts` (5)
```ts
test('header CACULA exato (20 campos) → true', ...)
test('header CACULA com trailing ; (21 campos sendo último vazio) → true', ...)
test('header diferente (Excel genérico) → false', ...)
test('header CACULA com 1 coluna a menos → false (estrito)', ...)
test('header com mesmas colunas mas em ordem diferente → false', ...)
```

### `lib/csv-import/map-cacula.test.ts` E2E com fixture (4)
```ts
test('fixture anonimizada: parsea N linhas sem erro', ...)
test('cada linha gera StagedPayableRow válido (Zod ou contrato manual)', ...)
test('soma de PAGO + soma de PENDENTE = soma total (aritmética fecha)', ...)
test('acentos preservados em todo o pipeline', ...)
```

**Total: 35 novos testes** (cobre 100% do mapping CACULA + edges).

---

## 12. Plano de execução

| Fase | Tempo | Conteúdo |
|---|---|---|
| **C.1** | 30min | Magic bytes `.csv` + atualizar error-codes + fixture anonimizada + `.gitignore` |
| **C.2** | 60min | `lib/csv-import/parse-csv.ts` (parser genérico) + `parse-valor-br.ts` + `parse-data-br.ts` |
| **C.3** | 60min | `clean-categoria.ts` + `detect-cacula.ts` + `lifecycle-cacula.ts` |
| **C.4** | 60min | `map-cacula.ts` (orquestrador) + integração no `/import/upload/route.ts` |
| **C.5** | 30min | Migration aditiva `StagedPayableRow.lifecycle` + ajuste `confirm` |
| **C.6** | 45min | Tests (35 novos) + suite verde |
| **C.7** | 30min | Build + deploy + smoke prod (Yussef faz upload real) |
| **Total** | **~5h** | Dentro do estimado pra uma sprint média |

---

## 13. Riscos + mitigações

| Risco | Mitigação |
|---|---|
| Quebra fluxo Excel existente | Mudanças aditivas. `parseXlsx` intocado. Switch por extensão isolado. Suite 3515 atual deve continuar verde |
| Encoding errado (ISO-8859-1 em vez de UTF-8) | `parse-csv.ts` detecta BOM + tenta decodificar UTF-8; se acentos vierem `??`, sugere ao user converter. CACULA já é UTF-8 confirmado |
| Linha quebrada com `;` no meio de campo entre aspas | Parser RFC 4180 (lida com `"; isso é texto;"`) — testado |
| User faz upload de CSV com header CACULA mas dados corrompidos | Validação row-a-row continua (cada parse helper retorna null se inválido); preview mostra erros antes do confirm |
| Lifecycle inválido (PAYABLE+paymentDate) escapou pra prod | `validateLifecycleState` da `lib/lifecycle` validado no confirm. Bug histórico R$ 939k não reaparece |
| Migration falha em prod | Aditiva nullable (ALTER TABLE ADD COLUMN) — safe. Backup pré-deploy obrigatório |
| Yussef sobe arquivo NÃO CACULA achando que é | Header diferente → cai no fluxo IA genérico (mesmo do Excel) automaticamente. Sem perda de UX |
| Worker PDF quebrar (regressão) | PDF não é tocado nesta sprint |

---

## 14. Aprovação solicitada — 6 pontos

Yussef, antes de Fase 2:

### 14.1 Sinal do valor: armazenar **absoluto** (positivo)?
Vou usar `Math.abs(valor)` pra armazenar em `StagedPayableRow.valor`,
seguindo o padrão Excel. O sinal negativo do CSV CACULA é só convenção
do sistema de origem (despesas como negativo). Confirma?

### 14.2 Descrição combinada
Quando `DESCRICAO ≠ "-"`, vou concat `CREDOR/PAGANTE — DESCRICAO`
pra `rawDescricao`. Confirma? Ou prefere só `CREDOR/PAGANTE`?

### 14.3 Migration aditiva `StagedPayableRow.lifecycle`
Adicionar coluna `lifecycle TEXT NULL`. CACULA preenche; Excel fica
NULL e usa lógica existente no confirm. Zero breaking change. Confirma?

### 14.4 Edge: STATUS=PAGO sem paymentDate
Decisão defensiva: `→ PAYABLE` (não EFFECTED órfão). Marca no preview
com badge ⚠️ "Status PAGO sem data de pagamento — revisar". Confirma?

### 14.5 Detecção multi-categoria mesmo sem casos no arquivo real
Arquivo real CACULA atual tem ZERO linhas multi-cat. Implementar
mesmo assim por defesa (futuros uploads)? Recomendo sim — código
~20 linhas + 1 teste, baixíssimo custo.

### 14.6 Fixture anonimizada: ~50 linhas
Estimei ~50 linhas pra cobrir todos os casos. Confirma? Ou prefere
mais/menos? Yussef pode revisar a fixture antes do deploy.

Se OK em tudo, sigo Fase C.1.
