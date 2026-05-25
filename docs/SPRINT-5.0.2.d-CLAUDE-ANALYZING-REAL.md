# Sprint 5.0.2.d — Claude Analyzing Real

**Status:** ✅ CONCLUÍDO em 25/05/2026
**Suite testes:** 2116 → **2166 (+50 testes)** sem regressões
**TypeScript strict:** 0 erros · **Build:** ✓ Compiled in 3.2s

## Objetivo

Sistema vira CONSULTOR SÊNIOR REAL: lê transações reais da empresa,
calcula imposto pago, compara regimes com base em dados verdadeiros,
cita leis específicas (Knowledge Base 2.100 linhas), benchmarka grandes
redes e gera recomendações em R$/ano.

## Arquitetura

```
POST /api/empresas/[id]/tax-ai-analysis
  │
  ├─► loadCompanyTaxData(companyId, 12) ─► Prisma reads (Transactions/TaxProfile/CNAE)
  │     │
  │     └─► aggregateFromTransactions() ─► CompanyTaxAnalysisData (puro)
  │
  ├─► cacheKey = sha256(snapshot)
  │     ├─ cache hit (< 24h) → retorna direto
  │     └─ cache miss → segue
  │
  ├─► analyzeTaxOptimization(data)
  │     ├─ system: TAX_EXPERT_SYSTEM_PROMPT (Sprint 5.0.2.c)
  │     ├─ user: buildAnalysisContext(data) — dados REAIS formatados
  │     ├─ tools: [get_knowledge, calculate_regime, get_benchmark_redes]
  │     │
  │     └─► loop tool use (até 10 rounds):
  │           ├─ Claude pede tool → executeToolCall (puro, sem DB)
  │           ├─ resposta → next round
  │           └─ stop_reason='end_turn' → parse JSON → return
  │
  └─► persiste AiAnalysisCache (TTL 24h)
        └─ retorna analysis + metadata + fromCache
```

## Componentes

### Schema (`migration 20260525100000_sprint_5_0_2d_ai_analysis_cache`)
```prisma
model AiAnalysisCache {
  id, companyId (FK CASCADE)
  cacheKey String       — sha256 do snapshot relevante
  topic String          — "general" (futuras: "regime-otimo", "icms-st", "fator-r")
  periodStart/End DateTime
  analysis String       — JSON serializado (compat SQLite/Postgres)
  modelUsed, tokensInput, tokensOutput, costUSD Float
  expiresAt DateTime    — created + 24h
  @@unique([companyId, cacheKey])
  @@index([companyId, expiresAt])
}
```

### `lib/tax/ai-analysis/data-aggregator.ts`
- `loadCompanyTaxData(companyId, monthsBack=12)` — fetch + aggregate
- `aggregateFromTransactions()` — função PURA (testável sem DB)
- Detecta receita (CREDIT), despesa (DEBIT), ignora TRANSFER
- Agrupa por mês, categoria
- Identifica folha via dreGroup (DESPESAS_PESSOAL/CUSTO_PESSOAL/PRO_LABORE) OU keyword
- Top fornecedores (supplier.razaoSocial, fallback description)
- Detecta impostos pelas descrições (DAS Simples, IRPJ, CSLL, PIS, COFINS, ICMS, ISS, INSS, FGTS)

### `lib/tax/ai-analysis/benchmarks.ts`
- 3 redes por ramo × 3 ramos = 9 benchmarks
  - **RESTAURANTE:** Madero (Lucro Real), Outback (Lucro Real), Girafas (Simples I)
  - **ACADEMIA:** Smart Fit (LR — Fator R), Bodytech (LR), Bio Ritmo (LR)
  - **COMERCIO_ROUPA:** Renner (LR), Riachuelo (LR), C&A (LR — importação)
- Cada rede tem estratégias específicas citando leis (LC 10.637/02, EC 132/2023, etc)

### `lib/tax/ai-analysis/tools.ts`
3 tools que Claude pode chamar:
1. **`get_knowledge(topic)`** — retorna 1 dos 10 KBs (Sprint 5.0.2.c)
2. **`calculate_regime(regime, receita, …)`** — calcula Simples/Presumido/Real usando engines existentes
3. **`get_benchmark_redes(ramo)`** — retorna redes do ramo

Executor `executeToolCall()` é puro e síncrono (tools são local-only, sem DB calls).

### `lib/tax/ai-analysis/claude-analyzer.ts`
- **Modelo:** `claude-sonnet-4-6` (override via `AI_CLAUDE_MODEL`)
- **Pricing:** $3/MTok input, $15/MTok output
- **Padrão fetch direto** (sem SDK Anthropic) — mesmo do projeto pre-existente
- **Fetcher injetável** pra testes (`options.fetcher`)
- **Timeout:** 120s
- **Max tool rounds:** 10 (proteção contra loop infinito)
- **Multi tool calls:** processa todas as tools de um turn em paralelo
- **JSON parsing tolerante:** remove ` ```json ` se vier wrap markdown, extrai `{ ... }` se vier prosa

Discriminated union de resultado:
- `success` + analysis + metadata (tokens/custo/duração/rounds)
- `disabled` (sem API key ou flag false)
- `timeout` (AbortError)
- `error` (HTTP error)
- `invalid-json` (não conseguiu parsear)
- `max-rounds-exceeded` (Claude entrou em loop)

### Endpoint POST `/api/empresas/[id]/tax-ai-analysis`
- Auth via `getAuthContext` + permission `transaction.view`
- Edge cases:
  - **422 "CNAE não configurado"** com link `/tributario?tab=config`
  - **422 "Sem dados financeiros"** se receita=0 e despesa=0
  - **503 "IA desabilitada"** se sem ANTHROPIC_API_KEY
  - **504 "Timeout"** se Claude demorou
- Cache key inclui: companyId + cnae + regime + anexo + estado + receita média + despesa média + folha + periodEnd (dia)

### UI `components/tributario/ai-analysis-section.tsx`
- **Empty state** — botão "Analisar agora" + descrição
- **Loading state** — spinner + lista de etapas ("📊 Lendo últimos 12 meses…")
- **Error state** — card amarelo com link de remediação + botão "Tentar novamente"
- **Result** — 5 seções:
  - Hero (resumo + imposto pago + economia/ano + botão Refazer)
  - Comparativo 3 regimes (RegimeMiniCard com badge "Atual" + economia/ano)
  - Oportunidades priorizadas (ordem + base legal + passos + risco badge)
  - Benefícios específicos do ramo (aplicável/não aplicável)
  - Benchmark grandes redes
  - Próximos passos (urgência badge)
- Footer disclaimer "Valide com seu contador"

### Integração na `AnaliseTab`
Adicionado como **3ª sub-pill** (default): `Análise IA` | `Análise CNAE` | `Comparativo de Regimes`.
Mantidas as 2 anteriores (Sprint 5.0.2.b/c).

## Custo esperado

- 1ª análise: ~3-5k input tokens + ~1-2k output = **~$0.04-0.07 USD**
- Cache hit (24h): **R$ 0** (lê do banco)
- Limite prático: 1 empresa pode gerar ~1 análise por dia útil → ~$1.5/mês por empresa ativa

## Validação (50 tests novos)

- **22 aggregator** — receita/despesa/transfer, agrupamentos mês/categoria, folha por dreGroup+keyword, top vendors, impostos detectados, edge cases (vazio, sem categoria, division by zero)
- **15 tools** — schema, get_knowledge limites, calculate_regime 3 regimes, benchmarks Madero/Smart Fit/Renner, errors, qualidade dados
- **13 analyzer** — buildAnalysisContext (nome/CNAE/Fator R/fornecedores/sem CNAE/tools listadas), disabled, sucesso direto, tool use loop, erros HTTP/JSON/markdown, pricing Sonnet 4.6 ($3+$15/MTok)

## Smoke test pra Yussef

1. **`/tributario?tab=analise`** — pill default agora é "Análise IA"
2. Clicar **"Analisar agora"** (sem cache ainda)
3. Aguardar ~10-30s (Claude vai consultar Knowledge Base + calcular regimes + benchmark)
4. Verificar 5 seções no resultado:
   - **Hero:** resumo + imposto pago em R$ + economia/ano
   - **Comparativo:** 3 cards com badge "Atual" no regime atual
   - **Oportunidades:** lista numerada com base legal (LC X art. Y) + economia/ano
   - **Benefícios:** ICMS-ST, PERSE, Fator R, monofásico (conforme ramo)
   - **Benchmark:** Madero/Outback/Girafas (se restaurante) ou Smart Fit (se academia) ou Renner (se loja)
   - **Próximos passos:** ordenados com urgência
5. Clicar **"Refazer"** — segunda chamada vem do cache (instantâneo) com nota "Análise em cache · gerada …"
6. Trocar CNAE em `?tab=config` → cacheKey muda → próxima análise re-roda Claude

## Configuração prod

`.env`:
```
ANTHROPIC_API_KEY=sk-ant-...
AI_CLAUDE_MODEL=claude-sonnet-4-6     # default, pode trocar pra opus-4-7
AI_CLAUDE_ENABLED=true                # default true se API_KEY set
```

## Decisões técnicas

- **Sonnet 4.6, não Haiku** — análise tributária é complexa, requer raciocínio profundo + tool use multi-round. Custo extra ($3 vs $1/MTok) vale a qualidade.
- **Tool use em vez de prompt mega-fat** — passar 2.100 linhas de Knowledge Base inteira no system seria caro. Claude pede só os tópicos relevantes via `get_knowledge`.
- **Cache 24h via hash do snapshot** — não cache por timer puro: se Yussef trocar CNAE ou receita mudar significativamente, hash muda, cache reroda automaticamente.
- **JSON serializado como String** — compat SQLite-dev / Postgres-prod sem usar Json nativo (mesmo padrão de `expertise` nos CNAEs).
- **TRANSFER ignorado na agregação** — defesa em profundidade. DRE já filtra, mas aggregador também.
- **Fetcher injetável** — testes não chamam Claude real. Mockam Response.

## Próximo

**Sprint 5.0.3** — IA Agent conversacional ("chat") usando essa Knowledge Base.
**Sprint 5.0.4** — Reforma Tributária IBS/CBS detalhado (já tem KB, falta UI dedicada).
