# Sprint PF FATIA 3.5 — Import fatura cartão em PDF (Claude Vision)

> **Status:** 📋 Plano detalhado — AGUARDANDO REVISÃO/APROVAÇÃO
> **Pré-requisitos:** Fatia 1 ✅ · Fatia 2 ✅ · Fatia 3 (OFX + IA) ✅
> **Duração estimada:** 6-9 dias
> **Data:** 03/06/2026
> **Stack adicional:** Claude Vision API (PDF support nativo — todos modelos ativos)

---

## 1. Filosofia — REUSAR 100% da Fatia 3

A Fatia 3.5 **NÃO refaz** IA, preview, dedup, casos especiais nem schema.
**Substitui SÓ a ENTRADA**: em vez de parser OFX → Claude Vision extrai
transações do PDF → mesmas linhas caem no pipeline existente:

```
[ENTRADA]                          [PIPELINE COMUM Fatia 3]
                                   ┌────────────────────────────────┐
OFX (Fatia 3)                      │ detectInstallment              │
  └─ parseOFXExtended ──┐          │ detectSpecialTx                │
                         ├────────→│ keyword-pf                     │
PDF (Fatia 3.5)         │          │ categorize-pf (RULE→KW→Claude) │
  └─ extractFromPdf  ───┘          │ dedup-against-manual           │
     (Claude Vision)                │ Preview editável               │
                                   │ Confirm + create PersonalTx    │
                                   └────────────────────────────────┘
```

**O que muda:** SÓ `lib/ofx-card/extract-from-pdf.ts` é NOVO (Claude Vision call).
**O que se mantém:** schema, queries, endpoints (preview/confirm/historico/reverter),
4 telas, todos os 6 helpers puros, dedup, categorização.

---

## 2. Como o Claude Vision lê o PDF

### 2.1 Specs oficiais Anthropic (validadas em platform.claude.com/docs)

| Aspecto | Valor |
|---|---|
| Max tamanho payload | 32 MB (inclui PDF + texto + headers) |
| Max páginas/request | 600 (100 em modelos 200k context) |
| Formato | Standard PDF (sem senha/criptografia) |
| Modelos suportados | **Todos os ativos** (Sonnet 4.6, Haiku 4.5, etc) |
| Tokens por página | 1.500-3.000 (texto) + tokens de imagem |
| Como envia | (a) URL, (b) base64 inline, (c) Files API com `file_id` |
| **Zero Data Retention** | ✅ Disponível (ver §5 segurança) |
| Prompt caching | ✅ `cache_control: ephemeral` reduz custo em re-queries |

**Recomendação Anthropic (best practice):**
> "Place PDFs before text in your requests. Use standard fonts. Ensure text is clear and legible. Rotate pages to proper upright orientation."

### 2.2 Como vamos enviar

**Decisão MVP: base64 inline** (Option 2 da doc Anthropic). Razões:
- Sem dependência da Files API (que tem outro beta endpoint)
- PDF típico de fatura: 50-500KB → base64 ~70-700KB (longe do limite 32MB)
- Idempotência mais simples — sem `file_id` pra gerenciar
- Pra MVP basta; Files API pode entrar em Sprint futuro se virar bottleneck

**Multi-páginas:** Claude processa o PDF inteiro em UMA chamada. Cada
página vira (texto extraído + imagem) automaticamente — o usuário não
precisa partir o PDF.

### 2.3 Modelo escolhido — análise

| Modelo | Input/Output (USD/1M tok) | Estimativa fatura 3 páginas | Qualidade extração |
|---|---|---|---|
| Sonnet 4.6 | $3 / $15 | ~$0.03 (R$ 0,15) | 🟢 Alta — segura |
| Haiku 4.5 | $1 / $5 | ~$0.01 (R$ 0,05) | 🟡 Boa — pode confundir colunas em layouts ruins |

**Decisão MVP:** **Sonnet 4.6**. Razões:
- Precisão > custo no MVP (decisão Yussef "qualidade extrema > velocidade")
- $0.03/fatura no plano R$ 19,99 = 0,15% — irrisório
- Testar Haiku depois com fixtures reais; se precisão ≥95%, migrar
- Já temos infra `claude-client.ts` que aceita override via `AI_CLAUDE_VISION_MODEL` env

### 2.4 Layouts diferentes por banco

**Estratégia: prompts por banco** + fallback genérico.

```
lib/ofx-card/pdf-templates/
├── nubank.ts          (template fatura Nubank)
├── itau.ts            (template Itaú)
├── bradesco.ts        (template Bradesco)
├── inter.ts           (template Inter)
├── c6.ts              (template C6)
└── generic.ts         (fallback — funciona com qualquer banco)
```

Cada template tem:
- Hint visual ("a tabela de lançamentos fica na página 2")
- Formato das datas ("DD/MM/AAAA" vs "DD/MM")
- Coluna do valor ("3ª coluna" vs "última coluna")
- Marcadores de parcela específicos do banco

**Como o sistema escolhe:**
1. User informa banco no upload OU
2. Sistema detecta via texto extraído da página 1 (regex "Nubank", "Itaú Personnalité", etc) OU
3. Genérico (~85% precisão) se não conseguir identificar

### 2.5 Output esperado — JSON estruturado

Prompt instrui Claude a retornar **JSON estrito** (mesmo padrão `ParsedOFXTx`):

```json
{
  "detectedBank": "Nubank",
  "closingDate": "2026-08-14",
  "dueDate": "2026-08-20",
  "totalAmount": 1742.10,
  "extractedTotal": 1742.10,
  "transactionCount": 15,
  "extractionConfidence": 0.92,
  "scanQuality": "DIGITAL",
  "transactions": [
    {
      "fitid": "PDF-2026-07-20-Posto-85.50",
      "date": "2026-07-20",
      "amount": -85.50,
      "type": "DEBIT",
      "memo": "Posto Pitangueira",
      "extractionConfidence": 0.95
    }
    // ... 14 mais
  ],
  "warnings": [
    "Página 3 tem qualidade visual baixa — revisão recomendada"
  ]
}
```

**FITIDs sintéticos:** PDF não tem FITID nativo. Geramos
determinístico = `PDF-<date>-<short-merchant>-<amount>` pra `dedupHashOFX` funcionar
igual e pra reimport do MESMO PDF não duplicar.

---

## 3. PRECISÃO / VALIDAÇÃO — o ponto mais crítico do PDF

PDF é mais propenso a erro que OFX (parser determinístico). Mitigações
em 4 camadas:

### 3.1 Validação SOMA bate com TOTAL (auto-detect)

Pedimos Claude pra extrair **DOIS valores independentes:**
1. `extractedTotal` — número que aparece literalmente na fatura como "Total" ou "Saldo da fatura"
2. `sumOfTransactions` — soma manual das tx extraídas

**Se diferença > 1% do total:** flag `extractionConfidence < 0.5` + warn forte no preview.

### 3.2 Validação CONTAGEM bate com texto

Algumas faturas dizem "15 lançamentos no período". Pedimos Claude pra
extrair esse contador (`transactionCount`) e comparar com o tamanho do
array `transactions[]`. Se discrepância → warn.

### 3.3 Confidence por linha + global

Cada transação tem `extractionConfidence` própria (0-1). Se Claude estava
incerto sobre valor/data específicos, marca baixo. UI mostra cor da linha:

- 🟢 ≥0.85 — confiável
- 🟡 0.65-0.84 — revisar
- 🔴 <0.65 — alta chance de erro — pré-selecionada pra revisão

### 3.4 Quality detection do scan

Claude classifica o PDF em:
- `DIGITAL` — gerado por software (texto vetorial, alta precisão)
- `SCANNED_HIGH` — escaneado bem (precisão razoável)
- `SCANNED_LOW` — escaneado ruim/torto (alerta forte)
- `MOBILE_PHOTO` — foto de celular (precisão MUITO baixa)

**Reação por nível:**
- `DIGITAL` — segue normal
- `SCANNED_HIGH` — banner amarelo "qualidade boa, mas confirme valores grandes"
- `SCANNED_LOW` — banner amarelo "qualidade baixa — revise tudo manualmente"
- `MOBILE_PHOTO` — banner **vermelho** "tente o OFX se disponível; se for PDF, revise CADA linha"

### 3.5 Pedido especial ao Claude no prompt

Snippet do prompt (a refinar com fixtures reais):
> "NUNCA invente valores. Se não conseguir ler com precisão suficiente um
> número ou data, MARQUE a transação com `extractionConfidence: 0.3` e
> adicione warning. Prefira erro óbvio (que o user corrige) a chute escondido.
> A soma das transações DEVE bater com o total da fatura (tolerância R$ 0,50).
> Se não bater, ajuste `extractionConfidence` global pra ≤0.5 e liste o
> motivo em warnings."

---

## 4. CUSTO

### 4.1 Estimativa por fatura

**Fatura típica Nubank (3 páginas, 50 transações):**

| Componente | Tokens estimados | USD (Sonnet 4.6) |
|---|---|---|
| PDF input (texto+imagem) | ~9.000 input | $0.027 |
| Prompt sistema | ~1.000 input | $0.003 |
| Output JSON | ~3.000 output | $0.045 |
| **Total** | — | **~$0.075 (R$ 0,38)** |

**Cenários:**
- Fatura 1 página (10 tx) → ~$0.03 (R$ 0,15)
- Fatura 5 páginas (80 tx) → ~$0.13 (R$ 0,65)

**Comparativo com plano PF R$ 19,99:**
- 1 import/mês: 1,9% do plano (margem 98%)
- 5 imports/mês: 9,5% (margem 90%)
- 20 imports/mês: 38% — vira problema só em uso anômalo

### 4.2 Cache por SHA256 do PDF

**Cache idempotente** com TTL longo:
- Hash: `sha256(pdfBytes)` — determinístico
- Cache hit → mesma resposta sem nova chamada API
- TTL: 7 dias (user pode re-tentar import sem custo)

**Schema novo `PersonalPdfExtractCache`** (tabela nova — aditivo puro):
```prisma
model PersonalPdfExtractCache {
  id              String   @id @default(cuid())
  pdfSha256       String   @unique
  modelVersion    String
  resultJson      String   @db.Text
  inputTokens     Int
  outputTokens    Int
  costCentsUsdX100 Int     // mesmo padrão AiClaudeCache existente
  cachedAt        DateTime @default(now())
  hitCount        Int      @default(0)
  expiresAt       DateTime // cachedAt + 7 dias
  @@index([pdfSha256])
  @@index([expiresAt])
  @@map("personal_pdf_extract_cache")
}
```

Nota: cache é **global por SHA256** (qualquer user que upload o MESMO PDF reusa).
Isso vaza padrões? NÃO — só responde quando hash bate, sem revelar dono.

### 4.3 Limites sanity

- Max 5 MB no upload (mesmo do OFX)
- Max 10 páginas (acima disso → erro "fatura muito grande — divida")
- Max 200 transações por request

### 4.4 Prompt caching ephemeral (opcional)

Anthropic oferece `cache_control: { type: 'ephemeral' }` no PDF.
Reduz custo input em 90% se MESMO PDF re-consultado em 5min.

**Decisão:** NÃO usar no MVP. Razões:
- Nosso cache SHA256 já cobre re-imports (TTL 7 dias > 5 min)
- Ephemeral só ajuda em "uploads múltiplos do mesmo PDF em <5min" — caso raro
- Pode entrar em sprint futuro se métrica mostrar uso

---

## 5. SEGURANÇA — dados sensíveis do cartão

PDF de fatura contém: número COMPLETO do cartão (em alguns bancos),
CPF, endereço, nome. Tratamento:

### 5.1 Zero Data Retention (ZDR) Anthropic

A doc oficial confirma:
> "This feature is eligible for Zero Data Retention (ZDR). When your
> organization has a ZDR arrangement, data sent through this feature is
> not stored after the API response is returned."

**Ação:** confirmar com Anthropic se a conta CAIXAOS tem ZDR habilitado.
Se SIM: dados do PDF nunca são persistidos por eles. Se NÃO: solicitar
upgrade pra ZDR antes do deploy em prod (Sprint 3.5 fica em sandbox até resolvido).

### 5.2 No NOSSO servidor

**Princípios:**
- ⛔ PDF **NUNCA armazenado no disco** ou no banco como blob
- ⛔ Conteúdo nunca aparece em log (apenas SHA256 hash + metadata: fileName, fileSize)
- ✅ Lido em memória → enviado pra Claude → descartado após response
- ✅ Cache armazena só `resultJson` extraído (já validado/limpo) + hash — NÃO o PDF original
- ✅ resultJson cache NÃO inclui número completo do cartão (Claude instruído a mascarar como `****1234` antes de retornar)

### 5.3 Logs

`lib/ofx-card/extract-from-pdf.ts` loga:
```ts
{
  pdfSize: 234000,
  pdfSha256: 'abc123...',  // 16 chars first
  durationMs: 12345,
  cacheHit: false,
  inputTokens: 9000,
  outputTokens: 3000,
  costCentsUsdX100: 75,
  modelVersion: 'claude-sonnet-4-6',
  bankDetected: 'Nubank',
  txCount: 15,
  extractionConfidence: 0.92,
  scanQuality: 'DIGITAL',
}
```

**ZERO conteúdo do PDF nos logs.** Hash é determinístico mas
não-reversível.

### 5.4 LGPD

- User dá consentimento ao subir o PDF (upload action = ação afirmativa)
- Política de privacidade documenta: "PDFs de fatura são processados por IA terceira (Anthropic) com Zero Data Retention. Nosso sistema cacheia só o resultado estruturado (sem o PDF original) por 7 dias pra evitar re-processamento."
- Botão "Excluir cache do PDF" disponível em `/perfis/[id]/imports` (deleta entry do `PersonalPdfExtractCache`)

### 5.5 Mascaramento

Prompt instrui Claude:
> "Se número de cartão completo aparecer no PDF, retorne APENAS os
> últimos 4 dígitos no campo `detectedCardLast4`. NUNCA inclua o número
> completo no JSON output."

---

## 6. REUSO da Fatia 3 — confirmação

| Componente Fatia 3 | Reuso na 3.5 |
|---|---|
| `parseOFXExtended` | ❌ (substituído por `extractFromPdf`) |
| `detectInstallment` | ✅ 100% — pega "Parcela X/Y" no memo |
| `detectSpecialTx` | ✅ 100% — pega Pagamento/IOF/Multa/Rotativo |
| `keyword-pf` | ✅ 100% — pega marcas BR |
| `categorize-pf` | ✅ 100% — pipeline RULE→KW→Claude |
| `dedup-against-manual` | ✅ 100% — fuzzy match |
| `detect-recurring` (insights) | ✅ 100% — alimenta `/insights` |
| `dedupHashOFX` | ✅ 100% — FITID sintético é determinístico → hash funciona |
| Schema `PersonalOfxImport` | ✅ — adiciona 2 colunas (`sourceType`, `extractionConfidence`) |
| Schema `PersonalTransaction` | ✅ 100% intacto |
| Schema `AiLearningRule` | ✅ 100% intacto |
| Endpoint POST `/preview` | ✅ — adiciona detect `.pdf` no mime/extensão |
| Endpoint POST `/confirm` | ✅ 100% — mesma lógica |
| Endpoint GET `/historico` | ✅ 100% |
| Endpoint POST `/reverter` | ✅ 100% |
| Tela `/importar` | ✅ — aceita `.pdf` além de `.ofx/.qfx` |
| Tela `/importar/preview/[id]` | ✅ — adiciona banner de scan quality |
| Tela `/imports` | ✅ — adiciona badge "PDF" / "OFX" |
| Tela `/insights` | ✅ 100% |

**O que é NOVO:**
1. `lib/ofx-card/extract-from-pdf.ts` (orquestrador Vision)
2. `lib/ofx-card/pdf-templates/*` (5 templates banco + 1 genérico)
3. Schema `PersonalPdfExtractCache` (cache SHA256)
4. ALTER em `PersonalOfxImport` (+2 colunas — ver §7)
5. Endpoint `DELETE /pdf-cache/[hash]` (cleanup LGPD)

---

## 7. ⚠️ ALTERs em tabelas com DADOS REAIS

Aplicando a regra estabelecida no `CLAUDE.md` (Fatia 3 post-mortem).

| Tabela | Operação | Tipo | Linhas afetadas em prod (hoje) | Risco | Mitigação |
|---|---|---|---|---|---|
| `personal_ofx_imports` | ADD COLUMN `sourceType TEXT NOT NULL DEFAULT 'OFX'` | ADD COLUMN com default | **0** (tabela criada na F3, sem imports ainda) | 🟢 Zero | Default `'OFX'` preenche linhas existentes (se houver no momento do deploy) → comportamento inalterado |
| `personal_ofx_imports` | ADD COLUMN `extractionConfidence DOUBLE PRECISION` | ADD COLUMN nullable | **0** | 🟢 Zero | Linhas existentes ficam NULL — apenas PDFs preenchem |

**Tabelas NOVAS (zero risco):**
- `personal_pdf_extract_cache` — `CREATE TABLE` aditivo

**Migration 100% aditiva-segura.** Não há `DROP NOT NULL`, `DROP COLUMN`,
`ALTER TYPE` nem mudança de constraint. ALTERs em `personal_ofx_imports`
são **ADD COLUMN com default OU nullable** em tabela que pode ter linhas
em prod no momento do deploy (improvável — Yussef ainda não usou import
OFX em prod, mas pode ter feito até a sprint começar).

**Evidência objetiva esperada no deploy:**
1. COUNT `personal_ofx_imports` ANTES === DEPOIS
2. Linhas existentes (se houver) com `sourceType = 'OFX'` (default aplicado)
3. Linhas existentes (se houver) com `extractionConfidence IS NULL`
4. `personal_pdf_extract_cache` criada com 0 linhas

---

## 8. UX

### 8.1 Fluxo do user

```
1. /perfis/[id]/importar → upload aceita .pdf
2. Sistema detecta extensão → mostra: "🔍 Lendo a fatura com IA Vision…
   isso pode levar 10-20s"
3. (10-20s de processamento — barra de progresso)
4. Redireciona pra preview EDITÁVEL (mesma tela da Fatia 3)
5. Banner ADICIONAL no topo (só PDF):
   - Verde se confidence ≥ 0.85: "✅ Qualidade da extração: 92% — leitura confiável"
   - Amarelo 0.65-0.84: "⚠️ Qualidade: 75% — revise valores antes de confirmar"
   - Vermelho < 0.65: "🚨 Qualidade baixa: 45% — recomendamos revisar CADA linha"
6. Linhas com extractionConfidence < 0.7 → fundo amarelo + ícone ⚠️
7. User revisa → Confirma → cria PersonalTransactions (igual Fatia 3)
```

### 8.2 Mensagens de erro

- PDF criptografado: "Esse PDF tem senha. Remova a proteção e tente de novo."
- PDF > 10 páginas: "Fatura muito grande (X páginas). Divida em arquivos menores."
- Quality MOBILE_PHOTO: "Detectamos que é foto de celular. PDF original (gerado pelo banco) tem qualidade muito superior. Considere baixar o OFX se disponível."
- Soma não bate: "A soma das transações lidas (R$ X) é diferente do total da fatura (R$ Y). Provavelmente faltou ou sobrou uma linha — revise."

### 8.3 "Best effort" comunicado

Acima da tabela:
```
┌──────────────────────────────────────────────────────────┐
│ 💡 Leitura de PDF é "best effort" da IA.                  │
│ Revisar antes de confirmar é mais importante que no OFX.  │
│ Linhas marcadas em amarelo precisam de atenção extra.     │
└──────────────────────────────────────────────────────────┘
```

---

## 9. Schema (resumo)

```prisma
// ALTER em PersonalOfxImport (Fatia 3)
ALTER TABLE "personal_ofx_imports"
  ADD COLUMN "sourceType"            TEXT NOT NULL DEFAULT 'OFX',
  ADD COLUMN "extractionConfidence"  DOUBLE PRECISION;

-- Nova tabela cache
model PersonalPdfExtractCache {
  id              String   @id @default(cuid())
  pdfSha256       String   @unique
  modelVersion    String
  resultJson      String   // JSON puro (sem o PDF, só extração)
  inputTokens     Int
  outputTokens    Int
  costCentsUsdX100 Int
  cachedAt        DateTime @default(now())
  hitCount        Int      @default(0)
  expiresAt       DateTime
  @@index([pdfSha256])
  @@index([expiresAt])
  @@map("personal_pdf_extract_cache")
}
```

**Migration arquivo:** `prisma/migrations/<TS>_pf_fatia_3_5_pdf_vision/migration.sql`

---

## 10. Endpoints REST (mínimo — reuso máximo)

| Método | Rota | Função | Status |
|---|---|---|---|
| POST | `/api/perfis/[id]/ofx-import/preview` | aceita `.pdf` além de `.ofx` | EXISTE (Fatia 3) — ajustar |
| POST | `/api/perfis/[id]/ofx-import/confirm` | reuso 100% | EXISTE |
| GET | `/api/perfis/[id]/ofx-import/historico` | reuso 100% | EXISTE |
| POST | `/api/perfis/[id]/ofx-import/[importId]/reverter` | reuso 100% | EXISTE |
| GET | `/api/perfis/[id]/insights/recorrentes` | reuso 100% | EXISTE |
| DELETE | `/api/admin/pdf-cache/[sha256]` | LGPD cleanup | **NOVO** (OWNER admin) |

**Nada de novo no front exceto banner de quality.**

---

## 11. Testes (alvo: 50-70)

### 11.1 Puros — ~30 testes
- `extract-from-pdf.test.ts` (mock Claude response) — 15
  - Parse JSON OK → ParsedOFXTx[]
  - Confidence baixa → warnings
  - Soma não bate → flag global
  - JSON malformado → erro "RETRY_PARSE"
  - Sem banco detectado → fallback genérico
- `pdf-templates/*.test.ts` — 10
  - Cada template tem prompt válido
  - Cada template tem ≥1 regex de detecção de banco
- `extract-cache.test.ts` — 5
  - Hash determinístico
  - TTL respeitado
  - Hit incrementa hitCount

### 11.2 Integração (mock fetch Anthropic) — ~20 testes
- `endpoint-preview-pdf.test.ts` — 10
  - Upload `.pdf` chama Vision
  - `.ofx` continua usando parser (regressão zero)
  - Cache hit não chama Vision
  - Confidence < 0.5 retorna preview mas com warning
- `multi-tenant-pdf.test.ts` — 10
  - Cache global por SHA256 (mas resultado ENTRA no perfil correto)
  - userB não vê cache de userA via API
  - DELETE cache só OWNER admin

### 11.3 E2E com PDFs reais (Yussef fornece) — ~10-15 testes
- Nubank fatura real → 95%+ precisão esperada
- Itaú fatura real → testar template específico
- Bradesco → genérico vs específico
- PDF escaneado (low quality) → flag corretamente
- PDF criptografado → erro adequado
- PDF > 10 páginas → erro de limite

---

## 12. Plano de execução (6-9 dias)

| Dia | Foco |
|---|---|
| 1 | Schema migration + `PersonalPdfExtractCache` + ALTER PersonalOfxImport + db push dev |
| 2 | `lib/ofx-card/extract-from-pdf.ts` (Claude Vision call + parse JSON + retry) |
| 3 | `lib/ofx-card/pdf-templates/` (Nubank + Itaú + genérico) + 25 testes puros |
| 4 | Cache `extract-cache.ts` + integração nos endpoints + 10 testes integração |
| 5 | Ajustes no `/importar` (aceita `.pdf`) + banner quality em `/preview` + 10 testes mt |
| 6 | Endpoint `DELETE /pdf-cache/[hash]` + LGPD cleanup + tela `/perfis/[id]/imports` ganha badge PDF |
| 7 | E2E com PDFs REAIS do Yussef (Nubank/Itaú/Bradesco) — calibrar prompts |
| 8 | Build + deploy (backup + counts + smoke) |
| 9 | Buffer / polish + CLAUDE.md log + atualização docs/sprints/ |

---

## 13. Decisões abertas pra Yussef validar

1. **Modelo Sonnet 4.6 vs Haiku 4.5 no MVP?** Sugiro Sonnet (qualidade > custo).
2. **Cache TTL 7 dias** ok? (LGPD: deletável manual + admin)
3. **5 bancos templates iniciais** (Nubank, Itaú, Bradesco, Inter, C6) + genérico — ok?
4. **Limite 10 páginas** por upload — ok? (fatura típica 2-5 páginas)
5. **PDFs criptografados/com senha:** erro 400 "remova proteção" — ok? (alternativa: tentar pypdf2 unprotect — complexidade alta)
6. **Validação ZDR Anthropic** — Yussef confirma se nossa org tem ZDR habilitado antes do deploy prod?
7. **Botão "deletar cache"** acessível ao user (`/perfis/[id]/imports`) ou só admin? Sugiro user pra LGPD.
8. **Foto de celular (MOBILE_PHOTO):** processar mesmo assim (com warning vermelho) ou rejeitar? Sugiro processar — user já fez esforço de upload.

---

## 14. Riscos consolidados

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|---|
| 1 | Claude inventa valor | Média | Crítico (user paga por compra fantasma) | Validação soma=total + confidence por linha + preview EDITÁVEL obrigatório |
| 2 | PDF escaneado ruim | Alta (faturas antigas) | Médio | Quality detection + banner vermelho + force-revisão |
| 3 | Banco com layout único quebra extraction | Média | Médio | Fallback genérico (~85% precisão) + adicionar template específico depois |
| 4 | Custo Vision explode | Baixa (cache + plano R$ 19,99) | Médio | Limite 10 págs + cache SHA256 7 dias + métrica em AiUsageLog (adaptar pra PF) |
| 5 | Dados vazam (logs ou cache do PDF) | Baixa | Crítico (LGPD) | ZDR Anthropic + zero PDF em disco/banco + hash-only nos logs |
| 6 | Reimport do MESMO PDF cria duplicação | Baixa | Médio | FITID sintético determinístico (`PDF-<date>-<merchant>-<amount>`) → dedupHash igual entre tentativas |
| 7 | PDF criptografado/corrompido | Média | Baixo | Detect cedo + erro 400 amigável |
| 8 | Latência alta (10-20s) frustra user | Média | Médio | Loading state claro + barra de progresso + Claude API timeout 30s |

---

## 15. Checklist DoD

- [ ] Aprovação Yussef do plano ← **VOCÊ ESTÁ AQUI**
- [ ] ZDR Anthropic confirmado pra org CAIXAOS
- [ ] Backup banco prod
- [ ] Migration aditiva-segura (2 ALTER ADD COLUMN + 1 CREATE TABLE)
- [ ] `extract-from-pdf.ts` + Claude Vision call + retry + cache
- [ ] 5 templates de banco + genérico
- [ ] Confidence + scan quality detection
- [ ] Banner quality no preview + linhas amarelas
- [ ] Cache LGPD-deletable (admin + user opcional)
- [ ] 50-70 testes (30 puros + 20 integração + 10-15 E2E reais)
- [ ] TS strict 0 erros
- [ ] Build OK
- [ ] Deploy prod
- [ ] Yussef testa com PDF REAL Nubank/Itaú/Bradesco → precisão ≥90%
- [ ] Métricas: tempo médio, custo médio, % cache hit

---

## 16. Diferenciais vs Mobills/Organizze (atualizado)

| Recurso | Mobills/Organizze | CAIXAOS Fatia 3.5 |
|---|---|---|
| Web | ❌ Só app | ✅ |
| OFX import | ✅ (basic) | ✅ (com IA Fatia 3) |
| **PDF import** | ❌ ou só texto extraction | ✅ **Claude Vision com tabelas/imagens** |
| Bancos suportados | Limitado Belvo | ✅ qualquer banco BR (template + genérico) |
| Edição livre | ❌ Trava | ✅ |
| Confidence visível | ❌ | ✅ Verde/amarelo/vermelho POR LINHA |
| Validação soma=total | ❌ | ✅ Detecta inconsistência automática |
| Cache de re-import | ❌ (nova chamada cada vez) | ✅ SHA256 7 dias |
| ZDR (LGPD) | ❓ Não documenta | ✅ Anthropic ZDR + zero PDF no nosso banco |

PDF support é **gap competitivo gigante** porque nenhum concorrente faz
bem. Mobills tem OCR limitado; Organizze nem tem. CAIXAOS abre o
ecossistema PF pra **qualquer banco que mande PDF.**
