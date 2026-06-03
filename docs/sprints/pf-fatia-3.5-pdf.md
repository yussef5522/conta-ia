# Sprint PF FATIA 3.5 — Import fatura cartão em PDF (Claude Vision)

> **Status:** 📌 PLANEJADA — próximo sprint depois da Fatia 3 (OFX + IA)
> **Pré-requisito:** Fatia 3 completa (OFX + pipeline IA + preview editável)
> **Decisão Yussef (03/06/2026):** PDF fica em fatia separada pra não inchar a 3
> **Duração estimada (a refinar):** 4-6 dias

---

## 1. Por quê uma fatia dedicada

Alguns bancos brasileiros **não fornecem OFX** — só PDF. Casos conhecidos:
- C6 Bank (cartão) — só PDF
- Inter (cartão) — só PDF em alguns planos
- Bancos digitais menores (Will, PicPay, Méliuz)
- Faturas antigas (antes de 2023) muitas vezes só estão arquivadas em PDF

A Fatia 3 (OFX) cobre **Nubank, Itaú, Santander, Bradesco, Sicredi, Sicoob** (todos que o Yussef já testou). 3.5 cobre o **gap** dos que só dão PDF.

## 2. Filosofia: REUSAR tudo da Fatia 3

A Fatia 3.5 **NÃO refaz** a IA, nem o preview, nem dedup, nem categorização. Ela **só substitui a ENTRADA**: em vez de parser OFX → **Claude Vision extrai as transações do PDF** → depois entra no MESMO pipeline da Fatia 3:

```
[ENTRADA]                  [PIPELINE COMUM Fatia 3]
                           ┌────────────────────────────┐
OFX (Fatia 3)              │ detect-installment         │
  └─ parseOFXExtended ─┐   │ detect-special-tx          │
                       ├──→│ keyword-pf                 │
PDF (Fatia 3.5)        │   │ IA Claude (entityType=pf)  │
  └─ Claude Vision  ───┘   │ dedup-against-manual       │
     extractFromPDF        │ preview editável           │
                           │ confirm + create PersonalTx│
                           └────────────────────────────┘
```

**Reuso garantido:** 100% da lógica de categorização, casos especiais, preview UX, dedup, insights. O PDF só vira `Array<ParsedOFXTx>` antes de entrar no pipeline.

## 3. Componentes novos esperados

### 3.1 `lib/ofx-card/extract-from-pdf.ts` (novo)

```ts
export interface PdfExtractResult {
  statementType: 'BANK' | 'CREDITCARD'
  detectedBank?: string
  closingDate?: Date
  dueDate?: Date
  totalAmount?: number
  transactions: ParsedOFXTx[]  // MESMO tipo da Fatia 3
  confidence: number            // 0-1 (qualidade da extração)
}

export async function extractFromPdf(
  pdfBytes: Uint8Array,
  options?: { hintBank?: string },
): Promise<PdfExtractResult>
```

**Implementação:**
- Usa Claude Vision (modelo `claude-sonnet-4-6` ou `claude-haiku-4-5` — testar custo/qualidade)
- Prompt few-shot por banco (templates: C6, Inter, Bradesco PDF, Itaú PDF)
- Output JSON estrito com `transactions[]` no schema `ParsedOFXTx` da Fatia 3
- Hint opcional do banco no prompt acelera + melhora precisão

### 3.2 Reuso direto da Fatia 3
- `detectInstallment(memo)`
- `detectSpecialTx(memo, type)`
- `keywordPf` dictionary
- `claudePrompt` PF
- `dedupAgainstManual()`
- Preview editável (mesma tela, parâmetro `source: 'OFX' | 'PDF'`)
- Endpoints `confirm`, `historico`, `reverter`
- Schema `PersonalOfxImport` ganha `sourceType: 'OFX' | 'PDF'` + `extractionConfidence Float?` (ADD COLUMN aditivo)

### 3.3 Migração 3.5

```prisma
// ALTER aditivo:
ALTER TABLE personal_ofx_imports ADD COLUMN "sourceType" TEXT NOT NULL DEFAULT 'OFX';
ALTER TABLE personal_ofx_imports ADD COLUMN "extractionConfidence" DOUBLE PRECISION;
```

Migration < 1KB. Zero risco.

## 4. Desafios técnicos esperados

### 4.1 Cada banco formata diferente
- **Mitigação:** começa com 3 bancos comuns (C6, Inter, Bradesco), valida com PDFs reais do Yussef, expande
- Cada banco vira um **prompt template** (`lib/ofx-card/pdf-templates/c6.ts`, etc)
- Banco não reconhecido → prompt genérico (qualidade ~85% — user revisa mais)

### 4.2 PDFs com layout multi-coluna ou tabelas complexas
- Claude Vision lida bem com tabelas (já provado em testes públicos)
- Risco: PDFs scannedos (imagem) ou com OCR ruim → confidence baixa, warn user

### 4.3 Custo Claude Vision
- ~$0.003/imagem (Sonnet) ou $0.001/imagem (Haiku) — fatura típica = 1-2 imagens
- Por import: ~R$ 0,01-0,03 (margem do plano R$ 19,99 absorve facilmente)
- Cache 24h por hash do PDF: reimport do mesmo PDF não rebatra API

### 4.4 Datas e parcelas no PDF
- Tabela com colunas diferentes por banco
- Datas às vezes vêm "dd/mm" sem ano → IA infere pelo mês de competência da fatura
- Parcelas no formato "Parcela 5/6" funcionam igual ao OFX (reusa `detectInstallment`)

## 5. UX esperada

- Tela 1 (já existente): upload aceita `.pdf` além de `.ofx`/`.qfx`
- Loading state: "🔍 Lendo a fatura com IA Vision… isso pode levar 10-20s"
- Confidence visível: banner amarelo se < 0.7 ("⚠️ Qualidade da extração: 65%. Revise as transações com atenção")
- Resto idêntico à Fatia 3 (mesma preview, mesmo confirm)

## 6. Riscos consolidados (a refinar quando chegar a sprint)

| Risco | Mitigação |
|---|---|
| Claude Vision extrai errado | Confidence + warn + preview EDITÁVEL (user corrige fácil) |
| PDF scannedo / qualidade baixa | Detecta via OCR confidence + sugere "Tente OFX se disponível" |
| Banco novo sem template | Prompt genérico (~85% precisão) + user corrige no preview |
| Custo se virar viral | Cache 24h + limit por user (10 imports/dia free, ilimitado em planos pagos) |

## 7. Quando chegar a hora

Antes de começar a 3.5, eu vou:
1. **Propor o plano detalhado** (igual fiz pra Fatia 1, 2, 3)
2. **Investigar Claude Vision real** (pricing, limites, formato)
3. **Pedir 2-3 PDFs de bancos diferentes** (C6, Inter, Bradesco) pra testar
4. **Refinar duração** com base nos PDFs de teste

Por enquanto: **REGISTRADO como próximo passo**. Vai depois de Fatia 3 entregar OFX + IA + preview editável funcionando em prod.
