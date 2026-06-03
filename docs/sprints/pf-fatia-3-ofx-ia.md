# Sprint PF FATIA 3 — Import OFX (foco cartão Nubank) + IA categorização PF

> **Status:** 📋 Plano detalhado — AGUARDANDO REVISÃO/APROVAÇÃO
> **Pré-requisitos:** Fatia 1 (fundação PF) ✅ · Fatia 2 (cartão robusto) ✅
> **Duração estimada:** 8-11 dias
> **Data:** 03/06/2026
> **Caso de teste real:** OFX Nubank que o Yussef tem (CCSTMTRS · NU PAGAMENTOS S.A.)

---

## 1. Investigação da base atual

### 1.1 Parser OFX existente (`lib/ofx/parser.ts`)

**Estrutura atual:**
```ts
parseOFX(raw): {
  accountId, bankId, currency,
  transactions: [{fitid, datePosted, amount, type, memo}],
  errors: []
}
```

**Comportamento atual com CCSTMTRS (cartão Nubank):**
- ⚠️ `extractTag(content, 'ACCTID')` busca a tag em **qualquer lugar** do conteúdo. Em CCSTMTRS o ACCTID está em `<CCACCTFROM><ACCTID>` — funciona POR ACIDENTE (pega o primeiro ACCTID que achar).
- ⚠️ `extractTag(content, 'BANKID')` vai retornar `undefined` pra cartão (cartão usa `<ORG>NU PAGAMENTOS S.A.</ORG><FID>260</FID>` em outra estrutura).
- ⚠️ `extractStmtTrnList(content)` procura `<BANKTRANLIST>` — em CCSTMTRS o BANKTRANLIST está dentro de `<CREDITCARDMSGSRSV1><CCSTMTRS>` — funciona porque a tag tem o mesmo nome `<BANKTRANLIST>`.
- ⚠️ **NÃO distingue** se é cartão ou conta-corrente. O caller decide.
- ⚠️ **NÃO detecta** parcelas no MEMO ("Parcela 5/6").
- ⚠️ **NÃO detecta** transações especiais (Pagamento recebido, IOF, Multa).

**Confirmação do estudo anterior:** parser PJ "lê" CCSTMTRS por sorte (mesma tag interna), mas não sabe que é cartão.

### 1.2 Dedup (`lib/ofx/dedup.ts`)

`dedupHashOFX(t) = sha256(fitid + dateKey + signedAmount + memoKey)`. **REUSÁVEL como-está** — mesma lógica funciona pra cartão.

### 1.3 Pipeline IA (`lib/ai-categorizer/`)

**5 camadas:** RULE → KEYWORD → SETOR → BRASILAPI → CLAUDE.

**Limitações pra PF:**
- Prompt do Claude (`claude-prompt.ts`) HARDCODES "EMPRESA: {tradeName}" e `companyType` + categorias com `dreGroup` (contábil PJ). **NÃO** parametrizado pra PF.
- KEYWORD detector tem `DreGroupHint` enum PJ — vai precisar adicionar `PersonalCategoryHint` em paralelo.
- RULE prediction usa `AiLearningRule.companyId` — PF precisa de regra equivalente.
- Few-shot busca `Transaction.companyId` — PF precisa buscar `PersonalTransaction.profileId`.

**Reuso possível:** `pipeline.ts` (orquestrador), `normalize.ts`, `cnpj-extractor.ts`, `predict.ts` (rule index), `claude-client.ts`, `claude-rate-limiter.ts`, `claude-cache.ts`. Refactor: tornar `claude-prompt.ts` parametrizável + `keyword-detector.ts` aceitar dicionário PJ ou PF.

### 1.4 OfxImport histórico (`prisma/schema.prisma:1097`)

Já existe `OfxImport` (Sprint 2.4 PJ) com revert + audit. **Estrutura é PERFEITA pra clonar pra PF** como `PersonalOfxImport`.

---

## 2. Resposta às 8 perguntas

### 2.1 Parser reusável? Lê CCSTMTRS?

**SIM, parser PJ pode ser ESTENDIDO** (não duplicado):
- Adicionar `statementType: 'BANK' | 'CREDITCARD'` no `OFXParseResult`
- Adicionar detecção: presença de `<CREDITCARDMSGSRSV1>` → cartão
- Extrair `accountId` de `<CCACCTFROM>` preferencialmente (em vez do primeiro ACCTID solto)
- Extrair `org` + `fid` pra cartão (em vez de `bankId`)
- Manter compat 100% com PJ (default `BANK` se não tem CREDITCARDMSGSRSV1)

**Sem refactor pesado.** Mudanças aditivas no mesmo arquivo. Estrutura interna `STMTTRN` é idêntica entre os dois.

### 2.2 Associar OFX ao `CreditCard` correto

**Decisão recomendada:** **user escolhe o cartão no momento do import.**

Razões:
- O ACCTID do Nubank é o número do cartão (criptografado parcialmente), e o user provavelmente não cadastrou em `lastDigits` exatamente igual
- Match automático via `lastDigits` falha se user cadastrou "0001" e ACCTID vem "5031-1234" → user precisa intervir mesmo
- Como o OFX **JÁ É** uma fatura mensal completa (1 mês), associar a um cartão e a uma fatura específica é decisão de produto que merece confirmação humana

**Fluxo:**
1. Upload arquivo
2. Sistema detecta `statementType=CREDITCARD` + extrai `org=NU PAGAMENTOS S.A.`
3. Tela "Importar fatura de cartão" exibe a lista de cartões do perfil (verde, com bandeiras) + opção "Criar novo cartão"
4. User escolhe ou cria
5. Pré-fill: se cartão escolhido tem `bankName` similar a `org`, destaca

**Mecanismo opcional (stretch):** se `lastDigits` cadastrado bate com final do ACCTID → seleciona automático com confirmação.

### 2.3 Parcelamento detectado no MEMO

**Caso real do OFX Yussef:**
```
Airbnb * Hm9z23za5s - Parcela 5/6
Laghetto Golden - Parcela 4/9
Mercadolivre*Rgs - Parcela 5/10
```

**Detecção:** regex pura em `lib/ofx-card/detect-installment.ts`:
```ts
const PATTERNS = [
  /\s+-\s+Parcela\s+(\d+)\/(\d+)/i,    // Nubank padrão
  /\s+Parcela\s+(\d+)\/(\d+)/i,
  /\s+\((\d+)\/(\d+)\)/,                // "(5/6)"
  /\s+(\d+)\s+de\s+(\d+)\s+x/i,         // "5 de 6 x"
]
```

**Tratamento recomendado:**
- **MVP:** importar APENAS a parcela que veio no OFX (5/6) — registra `installmentNumber=5, installmentTotal=6, installmentGroupId=null` (sem grupo automático)
- **Mostrar warning no preview:** "📦 Parcela 5/6 detectada — quer importar as outras parcelas que faltam (1-4 e 6)?"
- **Stretch (1 clique):** botão "Importar parcelas anteriores" — sistema chama `buildInstallments` com data REGRESSIVA (compra original em jul/2025, calcula 4 parcelas anteriores em fev-jun/2026), cria com `installmentGroupId` compartilhado, vincula a faturas passadas (ou cria faturas com `status=PAID` se já passaram)

**Anti-duplicação com tx manuais:**
- Se já tem `PersonalTransaction` com `installmentGroupId != null` e mesma descrição-base + cartão → flag "⚠️ Possível duplicação com compra parcelada já lançada" no preview

**Cuidado contábil:** parcela importada do OFX é "real" (banco confirmou cobrança). Parcela criada manualmente é "estimativa". Quando user importa OFX e tem manual prévio, melhor MARCAR a manual como "substituída pela importação real" do que duplicar.

### 2.4 IA categorização parametrizada PF

**Estratégia: parametrizar `claude-prompt.ts` + `keyword-detector.ts`.**

#### `claude-prompt.ts` ganha parâmetro `entityType`

```ts
interface BuildUserMessageInput {
  entityType: 'pj' | 'pf'                 // NOVO
  // PJ-only (ignored se entityType='pf'):
  tradeName?: string
  companyType?: string | null
  // PF-only (ignored se entityType='pj'):
  profileName?: string                     // "Yussef", "Filho Pedro"
  // Comum:
  categories: PromptCategory[]             // PJ usa dreGroup, PF usa type INCOME|EXPENSE
  fewShot: FewShotExample[]
  description: string
  amount: number
  type: 'CREDIT' | 'DEBIT'
  date: Date
  supplierRazaoSocial?: string | null
  // PF NOVO:
  isCreditCardTx?: boolean                 // true → ajuda IA: "é compra de cartão, não débito direto"
}
```

#### SYSTEM_PROMPT ganha bloco condicional

```
[Bloco comum]
Você é a IA financeira do CAIXAOS.

[Bloco PJ — mantém atual]
Especialista em contabilidade gerencial de PMEs brasileiras.
EMPRESA: ... (DRE, regimes)

[Bloco PF — novo]
Você está classificando despesas/receitas PESSOAIS de "{profileName}".
PF é controle de orçamento doméstico — categorias simples (Alimentação,
Transporte, Moradia, Lazer, Saúde, etc), NÃO contabilidade fiscal.
Categorias disponíveis: {15 PersonalCategory + customs}
Few-shot: últimas 10 classificações MANUAL/RULE deste PERFIL.

[Bloco específico CARTÃO — quando isCreditCardTx=true]
Esta transação veio de uma fatura de CARTÃO DE CRÉDITO.
- Compras parceladas têm sufixo "- Parcela X/Y" → categorize pelo
  produto/serviço, não pela parcela
- Transações tipo "Pagamento recebido" / "Multa" / "IOF" não são
  compras — categorize como Encargos/Pagamento Fatura
- Marcas comuns no Brasil: iFood/Rappi → Alimentação;
  Uber/99 → Transporte; Netflix/Spotify/HBO → Lazer; etc.
```

#### KEYWORD detector PF — dicionário NOVO

`lib/ai-categorizer/keyword-pf.ts` (paralelo a `keyword-detector.ts` PJ):

```ts
export const PF_KEYWORDS: Array<{
  keyword: string
  displayName: string
  personalCategoryHint: string  // nome da PersonalCategory
}> = [
  // Alimentação
  { keyword: 'ifood', displayName: 'iFood', personalCategoryHint: 'Alimentação' },
  { keyword: 'rappi', displayName: 'Rappi', personalCategoryHint: 'Alimentação' },
  { keyword: 'mercado', displayName: 'Mercado', personalCategoryHint: 'Alimentação' },
  { keyword: 'super', displayName: 'Supermercado', personalCategoryHint: 'Alimentação' },
  { keyword: 'pao de acucar', displayName: 'Pão de Açúcar', personalCategoryHint: 'Alimentação' },
  { keyword: 'extra', displayName: 'Extra', personalCategoryHint: 'Alimentação' },
  // Transporte
  { keyword: 'uber', displayName: 'Uber', personalCategoryHint: 'Transporte' },
  { keyword: '99 ', displayName: '99', personalCategoryHint: 'Transporte' },
  { keyword: 'posto', displayName: 'Posto', personalCategoryHint: 'Transporte' },
  { keyword: 'shell', displayName: 'Shell', personalCategoryHint: 'Transporte' },
  { keyword: 'br mania', displayName: 'BR Mania', personalCategoryHint: 'Transporte' },
  // Lazer/Streaming
  { keyword: 'netflix', displayName: 'Netflix', personalCategoryHint: 'Lazer' },
  { keyword: 'spotify', displayName: 'Spotify', personalCategoryHint: 'Lazer' },
  { keyword: 'apple.com', displayName: 'Apple', personalCategoryHint: 'Lazer' },
  { keyword: 'claude', displayName: 'Anthropic Claude', personalCategoryHint: 'Educação' },
  { keyword: 'facebk', displayName: 'Facebook Ads', personalCategoryHint: 'Outros' },
  { keyword: 'hbo', displayName: 'HBO Max', personalCategoryHint: 'Lazer' },
  // Viagem
  { keyword: 'airbnb', displayName: 'Airbnb', personalCategoryHint: 'Lazer' },
  { keyword: 'booking', displayName: 'Booking', personalCategoryHint: 'Lazer' },
  { keyword: 'latam', displayName: 'LATAM', personalCategoryHint: 'Lazer' },
  { keyword: 'gol linhas', displayName: 'GOL', personalCategoryHint: 'Lazer' },
  // Saúde
  { keyword: 'farmacia', displayName: 'Farmácia', personalCategoryHint: 'Saúde' },
  { keyword: 'drogaria', displayName: 'Drogaria', personalCategoryHint: 'Saúde' },
  { keyword: 'unimed', displayName: 'Unimed', personalCategoryHint: 'Saúde' },
  // Encargos cartão
  { keyword: 'iof', displayName: 'IOF', personalCategoryHint: 'Cartão de crédito' },
  { keyword: 'multa', displayName: 'Multa cartão', personalCategoryHint: 'Cartão de crédito' },
  { keyword: 'juros do rotativo', displayName: 'Juros rotativo', personalCategoryHint: 'Cartão de crédito' },
  { keyword: 'valor pendente', displayName: 'Rotativo mês anterior', personalCategoryHint: 'Cartão de crédito' },
  // ... ~50 keywords inicial
]
```

**Confidence:** keyword PF = 0.85 (alto — Mobills/Organizze não fazem isso bem).

**Few-shot do CLAUDE:** busca últimas 10 `PersonalTransaction` do PROFILE com `categoryId NOT NULL` ordenadas por data desc. Ensina a IA o estilo do usuário ("ele categoriza Posto como Combustível, não Transporte" → IA adapta).

### 2.5 Casos especiais — tabela de tratamento

| Caso real (MEMO) | Detecção | Tratamento |
|---|---|---|
| `Pagamento recebido` (CREDIT) | type=CREDIT + regex `/pagamento\s+(recebido|efetuado)/i` | **Skip + warning** "X pagamentos detectados — não importados (são pagamentos da fatura, não compras)". Stretch: criar `PersonalTransaction` com `isInvoicePayment=true` linkando à invoice manual. |
| `Multa por fatura atrasada` | regex `/multa.*fatura/i` | Categoria automática `Cartão de crédito` ou subcat "Multas/Encargos" |
| `IOF por fatura atrasada` | regex `/^iof/i` ou `/iof.*atrasada/i` | Categoria `Cartão de crédito` |
| `IOF de compra internacional` | regex `/iof.*internacional/i` | Categoria `Cartão de crédito` + flag `🌐 internacional` no preview |
| `Valor pendente do mês anterior` | regex `/valor\s+pendente/i` | Categoria `Cartão de crédito` + warning "Possível duplicação com rotativo gerado em /faturas/X" (busca CreditCardInvoice com `carryoverFromInvoiceId != null` no mesmo cartão) |
| `Parcela 5/6` | regex parcela (seção 2.3) | Marca `installmentNumber/Total` mas NÃO cria as outras automaticamente (warn) |

### 2.6 Dedup — 3 estratégias em camadas

**Camada 1 — Reimport mesmo arquivo:** `dedupHashOFX` (FITID+data+valor+memo) — JÁ FUNCIONA, reuso direto.

**Camada 2 — Duplicação com lançamentos manuais anteriores:**
- Para cada tx do OFX, busca `PersonalTransaction` com:
  - `creditCardId = chosenCardId`
  - `date` em ±1 dia da `datePosted`
  - `amount` exato
  - `description` com similaridade ≥0.7 (Levenshtein ou Jaccard de tokens)
- Match → flag "⚠️ Possível duplicação com tx manual #ID" no preview
- User decide: "Substituir manual pela importação" (delete manual + create OFX) OU "Pular importação dessa linha" OU "Importar mesmo assim"

**Camada 3 — Parcelas pré-criadas:**
- Se tx é Parcela X/Y e existe `PersonalTransaction` com `installmentGroupId != null` mesmo cartão + description-base similar + installmentNumber bate → match
- Sugere: "Substituir parcela manual pela importação real"

### 2.7 UX do import — desenho recomendado

**Fluxo em 4 telas** (paralelo ao import OFX PJ + ganhos):

#### Tela 1: Upload + escolher cartão
- Drag-and-drop ou file picker (`.ofx`, `.qfx`)
- Após parse, mostra: "📄 Fatura detectada: NU PAGAMENTOS S.A. · 78 transações · Período jul-ago/2026"
- Lista cartões PF + "Criar novo cartão"
- Botão "Próximo: Categorizar"

#### Tela 2: Preview com IA já categorizada (PRINCIPAL — diferencial)
- Tabela editável (estilo Linear/Notion):
  - ☑️ checkbox (seleciona/deseleciona linha do import)
  - Data
  - Descrição original (read-only, fonte mono)
  - **Categoria sugerida (dropdown editável) + badge confidence colorido** (verde 0.85+, amarelo 0.65-0.84, vermelho ≤0.50)
  - Valor (read-only)
  - Flags na lateral (👻 parcela / 💳 pagamento / ⚠️ dup / 🌐 intl / 🔄 rotativo)
- **Acima da tabela: pílulas de resumo**:
  - 47 compras (R$ 3.240) · 8 parcelas detectadas (R$ 1.200) · 1 pagamento (R$ 2.800 — não importado) · 3 encargos (R$ 87) · 2 possíveis dup
- **Bulk actions:** "Aplicar categoria pra todas selecionadas" / "Desmarcar todas as possíveis dup"
- **Filtro top:** "Mostrar só não-categorizadas" / "Mostrar só baixa confiança"
- Botão "Próximo: Revisar"

#### Tela 3: Confirmar
- Resumo final: "Você vai importar 64 transações no cartão Nubank na fatura ago/2026 (R$ 3.327). 3 marcadas como duplicação NÃO serão importadas. 1 pagamento detectado NÃO será importado."
- Botão "Importar"

#### Tela 4: Sucesso + insights
- "✅ 64 transações importadas. Fatura atualizada."
- Insights leves (se inclusos no escopo — ver §2.8):
  - "💡 Detectamos 5 assinaturas recorrentes: Netflix (R$ 55), Spotify (R$ 22), Apple (R$ 24), HBO (R$ 35), Claude (R$ 100). Total: R$ 236/mês"
  - "📈 Você gastou 30% mais em Lazer este mês vs anterior."
- Atalhos: "Ver fatura" / "Ver transações" / "Importar outro OFX"

#### O que GANHA dos líderes:
- ✅ **Funciona na WEB** (Mobills/Organizze só app)
- ✅ **Edição livre** (eles travam tx auto)
- ✅ **Retroativo** (importa OFX de mês passado)
- ✅ **IA com contexto** (entende parcela, internacional, encargos)
- ✅ **Bulk actions** (não precisa categorizar 1 por 1)
- ✅ **Confidence visível** (user sabe onde a IA "chuta")

### 2.8 Insights — incluir na Fatia 3?

**Recomendação: incluir versão LIGHT — "detector de assinaturas recorrentes"** (custo de implementação baixo, ganho de valor alto).

**Detector:**
```ts
detectRecurringSubscriptions(personalTransactions: PT[]): Array<{
  merchantNormalized: string         // "netflix"
  monthsActive: number                // 6
  avgAmount: number                   // 55.00
  lastSeenAt: Date
  predictedNextDate: Date
}>
```

**Algoritmo puro:**
1. Agrupa tx de cartão por `normalizeMerchant(description)` (remove parcela, refs, "* xxx")
2. Filtra grupos com ≥3 ocorrências em meses distintos
3. Se desvio padrão dos valores < 15% da média → é recorrente
4. Predict next date = última data + (avg gap em dias)

**Análises mais profundas (anomalias, comparativo categoria) → ficam pro Dashboard PF** (próximo sprint). Aqui só o detector de assinaturas porque é diferencial Mobills/Organizze ("eles mostram assinaturas? sim, mas mal categorizadas").

---

## 3. Schema (1 model novo + 2 colunas opcionais)

### 3.1 `PersonalOfxImport` (clone de OfxImport PJ, aditivo)

```prisma
model PersonalOfxImport {
  id                String    @id @default(cuid())
  profileId         String
  // Cartão escolhido pra import (Fatia 3 — só cartão. Conta bancária PF
  // fica pra fatura 3B se necessário).
  creditCardId      String?
  // bankAccountId opcional pra futuro (import OFX de conta PF).
  bankAccountId     String?
  userId            String

  // PROCESSING | SUCCESS | FAILED | REVERTED
  status            String    @default("PROCESSING")
  fileName          String
  fileSize          Int       @default(0)
  // BANK | CREDITCARD (detectado do parser)
  statementType     String

  totalTransactions Int       @default(0)
  newTransactions   Int       @default(0)
  duplicates        Int       @default(0)
  autoClassified    Int       @default(0)
  invoicePaymentsSkipped Int  @default(0)
  parcelasDetected  Int       @default(0)

  periodStart       DateTime?
  periodEnd         DateTime?

  // Metadados do cartão detectado
  detectedOrg       String?     // "NU PAGAMENTOS S.A."
  detectedFid       String?     // "260"
  detectedAcctId    String?     // ACCTID criptografado do OFX

  ipAddress         String?
  userAgent         String?
  errorMessage      String?
  revertedAt        DateTime?
  revertedById      String?

  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  profile      PersonalProfile       @relation(fields: [profileId], references: [id], onDelete: Cascade)
  creditCard   CreditCard?           @relation(fields: [creditCardId], references: [id], onDelete: SetNull)
  bankAccount  PersonalBankAccount?  @relation(fields: [bankAccountId], references: [id], onDelete: SetNull)
  user         User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  revertedBy   User?                 @relation("PersonalOfxImportReverter", fields: [revertedById], references: [id])
  transactions PersonalTransaction[]

  @@index([profileId])
  @@index([creditCardId])
  @@index([status])
  @@map("personal_ofx_imports")
}
```

### 3.2 `PersonalTransaction` ganha 3 colunas opcionais (ALTER aditivo)

```prisma
// (aditivo)
ofxImportId            String?   // FK pra PersonalOfxImport
// Compra internacional detectada (regex "internacional" no memo + IOF)
isInternational        Boolean   @default(false)
internationalCurrency  String?   // "USD", "EUR" (futuro — detectar via memo)

// FK reversa nova
ofxImport PersonalOfxImport? @relation(fields: [ofxImportId], references: [id], onDelete: SetNull)
```

### 3.3 `AiLearningRule` — adicionar suporte PF (mínimo, aditivo)

```prisma
// model AiLearningRule já existe (PJ). Adicionar:
profileId          String?   // NULL quando regra é PJ (atual); preenchido quando regra é PF
personalCategoryId String?   // FK opcional pra PersonalCategory

profile          PersonalProfile?  @relation(...)
personalCategory PersonalCategory? @relation(...)
```

**Decisão:** REUSAR `AiLearningRule` (não criar `PersonalLearningRule` separado). Razões:
- Estrutura é idêntica (padrão + tipoMatch + vezesAplicada + confiança)
- Adicionar `profileId String?` + `personalCategoryId String?` é aditivo zero-risco
- Pipeline `predict.ts` já tem RuleIndex — ganha filtro `where profileId === x OR companyId === y`

### 3.4 Migration

`prisma/migrations/<TS>_pf_fatia_3_ofx_ia/migration.sql`:
- 1× `CREATE TABLE personal_ofx_imports`
- 1× `ALTER TABLE personal_transactions ADD COLUMN` × 3 (ofxImportId, isInternational, internationalCurrency)
- 1× `ALTER TABLE ai_learning_rules ADD COLUMN profileId TEXT NULL` + `ADD COLUMN personalCategoryId TEXT NULL`
- ~6 índices
- 5 ADD CONSTRAINT FK (com SetNull onDelete onde apropriado)
- **Zero ALTER em** users / companies / transactions PJ / bank_accounts / categories PJ / Fatia 1 / Fatia 2 (CreditCard intocado)
- Backup + counts pré/pós obrigatórios

---

## 4. Lib pura (helpers testáveis)

### 4.1 Parser estendido — `lib/ofx-card/parser-ext.ts`

```ts
export interface OFXParseResultExt extends OFXParseResult {
  statementType: 'BANK' | 'CREDITCARD'
  // Pra cartão:
  org?: string                       // "NU PAGAMENTOS S.A."
  fid?: string                       // "260"
  // ACCTID preferencialmente de CCACCTFROM
}

export function parseOFXExtended(raw: string): OFXParseResultExt
```

**Mudanças no parser:**
- Detectar `<CREDITCARDMSGSRSV1>` → statementType=CREDITCARD
- Pra cartão, extrair ACCTID DE DENTRO de `<CCACCTFROM>` (regex específica)
- Extrair `<ORG>` e `<FID>` quando cartão

### 4.2 `lib/ofx-card/detect-installment.ts` (puro)

```ts
export interface InstallmentDetection {
  isInstallment: boolean
  installmentNumber?: number
  installmentTotal?: number
  baseDescription?: string  // descrição sem "Parcela X/Y"
}

export function detectInstallment(memo: string): InstallmentDetection
```

4 regex patterns. Retorna `baseDescription` pra dedup/agrupamento.

### 4.3 `lib/ofx-card/detect-special-tx.ts` (puro)

```ts
export type SpecialTxKind =
  | 'INVOICE_PAYMENT'      // "Pagamento recebido"
  | 'IOF_LATE'             // IOF atraso
  | 'IOF_INTL'             // IOF internacional
  | 'LATE_FEE'             // Multa
  | 'CARRYOVER_PREVIOUS'   // Valor pendente mês anterior
  | 'INTEREST_REVOLVING'   // Juros do rotativo
  | null                    // Compra normal

export function detectSpecialTx(memo: string, type: 'CREDIT' | 'DEBIT'): {
  kind: SpecialTxKind
  isInternational: boolean
  shouldSkipImport: boolean   // true pra INVOICE_PAYMENT
  suggestedCategoryHint?: string  // "Cartão de crédito" pra IOF/Multa
}
```

### 4.4 `lib/ai-categorizer/keyword-pf.ts` (puro)

~50 keywords PF iniciais (lista da seção 2.4). Mesma API que `keyword-detector.ts` PJ mas dicionário separado.

### 4.5 `lib/ai-categorizer/build-pf-prompt.ts` (puro)

Refactor de `claude-prompt.ts`: extrai a parte PJ pra função `buildUserMessagePJ`, cria nova `buildUserMessagePF`. Mantém compat 100%.

### 4.6 `lib/ofx-card/dedup-against-manual.ts` (puro)

```ts
export interface DupMatch {
  ofxTxIdx: number          // índice da tx OFX
  manualTxId: string        // tx manual que bate
  confidence: number        // 0..1
  reason: 'EXACT_AMOUNT_DATE' | 'INSTALLMENT_GROUP' | 'FUZZY_DESC'
}

export function findDuplicatesAgainstManual(
  ofxTxs: ParsedOFXTx[],
  manualTxs: PersonalTransaction[],
  creditCardId: string,
): DupMatch[]
```

### 4.7 `lib/ai-categorizer/detect-recurring.ts` (puro — Insights)

```ts
export interface RecurringSubscription {
  merchantNormalized: string
  displayName: string
  monthsActive: number
  avgAmount: number
  lastSeenAt: Date
  predictedNextDate: Date
}

export function detectRecurringSubscriptions(
  txs: PersonalTransaction[],
  minMonths: number = 3,
): RecurringSubscription[]
```

### 4.8 `lib/ofx-card/queries.ts` (orquestrador atomic)

- `createOfxImport(input)` — cria PersonalOfxImport + parse + retorna preview
- `confirmOfxImport(importId, decisions)` — recebe decisões do user (skip/replace/etc) e cria PersonalTransactions em batch atomic
- `revertOfxImport(importId)` — soft-delete tx + status=REVERTED

---

## 5. Endpoints REST (5 novos)

| Método | Rota | Função |
|---|---|---|
| POST | `/api/perfis/[id]/ofx-import/preview` | Upload+parse → retorna preview com IA categorizada + flags |
| POST | `/api/perfis/[id]/ofx-import/confirm` | Confirma com decisões (skip, replace, edit categoria por linha) |
| GET | `/api/perfis/[id]/ofx-import/historico` | Lista imports anteriores |
| POST | `/api/perfis/[id]/ofx-import/[importId]/reverter` | Reverte (soft delete das tx) |
| GET | `/api/perfis/[id]/insights/recorrentes` | Detector de assinaturas (alimenta dashboard futuro) |

---

## 6. Telas (4 novas)

| # | Rota | Conteúdo |
|---|---|---|
| 1 | `/perfis/[id]/importar` | Upload OFX + seleção cartão (tela 1) |
| 2 | `/perfis/[id]/importar/preview/[importId]` | Preview editável (TELA PRINCIPAL — diferencial) |
| 3 | `/perfis/[id]/imports` | Histórico de imports (com revert) |
| 4 | `/perfis/[id]/insights` | Painel insights (assinaturas recorrentes — MVP) |

**Atalhos:**
- Botão "Importar OFX" no header de `/perfis/[id]/cartoes` (cartão escolhido pré-fill)
- Botão "Importar fatura" no detalhe do cartão `/perfis/[id]/cartoes/[cardId]`

---

## 7. Testes (alvo: 90-120)

### Puros (~60)
- `parser-ext.test.ts` (15) — CCSTMTRS detection, ACCTID de CCACCTFROM, ORG/FID, retrocompat BANK
- `detect-installment.test.ts` (12) — 4 patterns, casos do OFX Nubank real, false positives
- `detect-special-tx.test.ts` (15) — todos os 6 tipos + edge cases (case-insensitive, acentos)
- `keyword-pf.test.ts` (10) — 50 keywords retornam categoria correta
- `detect-recurring.test.ts` (8) — Netflix 3 meses → recurring, 2 meses → não, valor flutuando >15% → não

### Integração (~30)
- `parser-real-nubank.test.ts` (10) — usa OFX REAL do Yussef como fixture; valida resultado linha-a-linha
- `queries-integration.test.ts` (10) — createImport + confirmImport + revert
- `endpoint-preview.test.ts` (10) — Zod validation + multi-tenant + retorno bem-formado

### Isolamento multi-tenant (~15)
- userB → preview userA → 404
- POST confirm com importId de outro perfil → 404
- POST confirm com creditCardId de outro perfil → 400
- POST confirm com personalCategoryId de outro perfil → 400
- DELETE import de outro user → 404
- GET historico só lista do user
- AiLearningRule criada pelo profileA → não aplica em profileB (mesmo user)

---

## 8. O que FICA FORA da Fatia 3

- ❌ **OFX de conta bancária PF** (banca corrente / poupança) — fica pra Fatia 3B se houver demanda. Foco AGORA é cartão.
- ❌ **CSV import** — futuro
- ❌ **PDF import** (Nubank gera PDF da fatura) — Claude Vision é stretch grande
- ❌ **Insights complexos** (anomalias por categoria, comparativo trimestre) — Dashboard sprint
- ❌ **Cartão multi-moeda** (currency tracking) — campo já preparado, lógica fica pra futuro
- ❌ **Importar parcelas futuras automaticamente** quando detecta "X/Y" — stretch (oferece botão mas não automático)
- ❌ **Cartão PJ** — Fatia 3 só PF
- ❌ **Conciliação OFX vs lançamento manual** (split view) — futuro

---

## 9. Riscos

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|---|
| 1 | Parser quebra OFX PJ ao adicionar CCSTMTRS | Baixa | Crítico | Refactor é ADITIVO em `parser.ts`. PJ continua usando `parseOFX`. Cartão usa `parseOFXExtended`. Suite 4053 testes garante zero regressão |
| 2 | Detecção de parcela falsa positiva (memo legítimo com "5/6") | Baixa | Médio | Regex exige palavras "Parcela" ou "Parc." antes do "5/6" — não pega "5/6 estrelas" solto |
| 3 | IA categoriza pagamento como compra | Média | Médio | detectSpecialTx roda ANTES da IA. Pagamento detectado → skipa import (não chega na IA) |
| 4 | Dedup contra manual gera muitos falsos positivos | Média | Médio | Fuzzy threshold ≥0.7 + DATA ±1 dia + valor EXATO. User SEMPRE confirma no preview |
| 5 | Custo Claude alto (78 tx/import × R$ 0.001) | Baixa | Baixo | Cache 24h por (description+amount+profileId); KEYWORD pega ~60% antes da IA → só 30 tx vão pro Claude por import |
| 6 | OFX Nubank tem formato proprietário não-padrão | Média | Médio | Usar OFX REAL do Yussef como fixture nos testes. Adicionar fixture de OFX Itaú/Bradesco depois |
| 7 | Vazamento entre perfis (regra de PF1 vaza pra PF2) | Baixa | Crítico (LGPD) | RuleIndex filtra `profileId` + 15 testes isolamento |
| 8 | Import duplicado destrói saldo do cartão | Baixa | Alto | confirm endpoint atomic em $transaction + idempotência via PersonalOfxImport.status |

---

## 10. Plano de execução (8-11 dias)

| Dia | Foco |
|---|---|
| 1 | Schema + migration + db push dev + extrair parseOFXExtended (puro) |
| 2 | detect-installment + detect-special-tx + keyword-pf (3 helpers puros + 35 testes) |
| 3 | dedup-against-manual + detect-recurring (insights) + 18 testes |
| 4 | Refactor claude-prompt parametrizado + build-pf-prompt + IA pipeline aceita entityType='pf' |
| 5 | queries.ts (createImport / confirmImport / revertImport) atomic + 10 testes |
| 6 | 5 endpoints REST + multi-tenant guards + 25 testes (15 isolamento + 10 integração) |
| 7 | Telas 1-2 (upload + preview com IA categorizada — TELA PRINCIPAL) |
| 8 | Telas 3-4 (histórico + insights) + atalho "Importar" no cartão |
| 9 | Suite tests full + smoke local + parser-real-nubank fixture |
| 10 | Build + deploy (backup + counts + smoke) |
| 11 | Buffer / polish + CLAUDE.md log |

---

## 11. Decisões abertas pra você validar

1. **Parser:** estender `lib/ofx/parser.ts` em vez de criar `parser-card.ts` (recomendado — aditivo) OK?
2. **`AiLearningRule` reusada com `profileId` opcional** (recomendado — sem duplicar tabela) OK?
3. **Insights de assinaturas recorrentes na Fatia 3** (light — só detector) vs deixar tudo pro dashboard? Sugiro **incluir** porque é diferencial Mobills.
4. **Parcelas detectadas: importar apenas a que veio no OFX + warning** (MVP) vs **botão "importar todas anteriores"** (stretch). Sugiro MVP + botão stretch.
5. **Pagamento recebido (CREDIT do OFX):** **SKIP + warning** (MVP) vs **criar PersonalTransaction com `isInvoicePayment=true`** (mais completo mas pode duplicar com pay manual). Sugiro SKIP no MVP.
6. **OFX de conta bancária PF** fica pra Fatia 3B futura? OK focar 100% em cartão agora?
7. **PDF da fatura Nubank** (Claude Vision) — vale stretch ou fica pra futuro? Sugiro futuro (complexidade alta).
8. **Limite máximo de transações por import** (sanity)? Sugiro 500 (mesmo limit do PJ).

---

## 12. Resumo dos diferenciais vs Mobills/Organizze

| Recurso | Mobills/Organizze (Belvo) | CAIXAOS Fatia 3 |
|---|---|---|
| Web | ❌ Só app | ✅ Web + app futuro |
| Editar tx auto | ❌ Trava | ✅ Edição livre na preview |
| Retroativo | ❌ Só sincroniza atual | ✅ Importa OFX qualquer mês |
| IA contextual | ❌ Categorização genérica Belvo | ✅ Claude 4.6 + few-shot do usuário |
| Categoriza parcela | ❌ Trata como compra individual | ✅ Detecta "Parcela X/Y" + agrupa |
| Pagamento da fatura | ❌ Importa como gasto (erro) | ✅ Detecta e skipa com warn |
| Encargos (IOF, multa) | ❌ Manual | ✅ Categoria automática |
| Dup com manual | ❌ Sem detecção | ✅ Fuzzy match + decisão user |
| Confidence visível | ❌ Sem score | ✅ Verde/amarelo/vermelho |
| Insights | ⚠️ Assinaturas mal categorizadas | ✅ Detector próprio com confidence |
