# Sprint 5.0.2.e — Fix JSON Parser + Comparativo sem Dropdown Genérico

**Status:** ✅ CONCLUÍDO em 25/05/2026
**Suite testes:** 2166 → **2183 (+17 testes)** sem regressões
**TypeScript strict:** 0 erros · **Build:** ✓ Compiled

## Motivação

Yussef testou Sprint 5.0.2.d em produção (Cacula Mix) e reportou 2 bugs:

❌ **Análise IA falhava "JSON malformado"** — Claude eventualmente retornava
texto antes/depois do JSON, escapando o parser frágil.

❌ **Comparativo tinha dropdown genérico** — "Atividade (Presumido)" + checkboxes
manuais ICMS/ISS. Yussef configurava restaurante mas tinha que reescolher
no Comparativo, e a lista nem tinha "Restaurante" — só categorias genéricas
(Comércio, Serviços, etc).

## Parte A — JSON Parser Robusto

### `submit_analysis` tool (Anthropic tool use estruturado)

`lib/tax/ai-analysis/tools.ts` — nova tool `submit_analysis` com `input_schema`
completo cobrindo todos os campos de `TaxAnalysisResult`:

- `resumoExecutivo` (cenárioAtual, impostoPagoEstimado, aliquotaEfetiva, economiaPotencialAnual)
- `oportunidades[]` com required: prioridade, titulo, descricao, economiaAnual, baseLegal, passosPraticos, risco
- `comparativoRegimes` com atual + simples/presumido/real + recomendacao
- `beneficiosEspecificos[]`, `benchmarkRedes[]`, `proximosPassos[]`

Quando Claude chama essa tool, Anthropic **valida o input no servidor** —
ou seja, a estrutura chega ao nosso loop garantidamente bem formada. Sem
JSON parsing.

### Analyzer detecta submit_analysis preempt

`lib/tax/ai-analysis/claude-analyzer.ts` — no loop de tool use:

```typescript
const submitCall = toolUses.find((t) => t.name === SUBMIT_ANALYSIS_TOOL_NAME)
if (submitCall) {
  return {
    kind: 'success',
    analysis: submitCall.input as unknown as TaxAnalysisResult,
    metadata: { ... }
  }
}
```

Mesmo se Claude chamar `get_knowledge` + `submit_analysis` no mesmo turn,
`submit_analysis` ganha precedência (encerra a conversa).

### Prompt atualizado

System suffix agora diz:
> Após coletar os dados via get_knowledge / calculate_regime / get_benchmark_redes, você DEVE chamar a tool 'submit_analysis' com a análise final estruturada. NÃO escreva JSON em texto livre — use SEMPRE a tool submit_analysis pra retornar o resultado final.

### Parser fallback robusto (4 estratégias)

`tryParseJson()` exportado pra testes, segue 4 estratégias se Claude
ignorar a instrução e responder em texto:

1. **JSON puro:** `JSON.parse(text.trim())`
2. **Remove markdown:** strip ` ```json ` / ` ``` `
3. **Extrai primeiro objeto:** regex `/\{[\s\S]*\}/`
4. **Slice por chaves:** `text.slice(firstBrace, lastBrace + 1)`

Retorna `null` se nada parseia.

### Retry automático 1x no endpoint

`app/api/empresas/[id]/tax-ai-analysis/route.ts`:

```typescript
let result = await analyzeTaxOptimization(data)
if (result.kind === 'invalid-json' || result.kind === 'error' || result.kind === 'max-rounds-exceeded') {
  console.warn('[tax-ai-analysis] First attempt failed:', result.kind, 'retrying once...')
  result = await analyzeTaxOptimization(data)
}
```

Custo aceitável: análise tributária roda 1×/dia por empresa via cache.

## Parte B — Comparativo sem Dropdown Genérico

### `components/tributario/comparativo-section.tsx` reescrito

**REMOVIDO:**
- Select "Atividade (Presumido)" com 8 opções genéricas
- Checkboxes manuais "Tem ICMS" / "Tem ISS"

**ADICIONADO:**
- Carga inicial do CNAE via `/api/empresas/[id]/tax-profile`
- **Sem CNAE:** card vermelho com botão "Configurar CNAE →" pra `/tributario?tab=config`
- **Com CNAE:** card indigo no topo do form com:
  - Ícone emoji (🍽️, 💪, 👕, ...)
  - Nome do CNAE
  - Código + ramo label + atividade derivada
  - Tributos derivados (ICMS ✓/✗ · ISS ✓/✗)
  - Botão "Trocar CNAE →" (vai pra config)

Form mantém: receita, margem real, anexo Simples, estado.

### Derive automático no submit

```typescript
const derived = deriveActivityFromCNAE(cnae)
fetch('/api/empresas/[id]/tax-compare', {
  body: JSON.stringify({
    receitaBrutaMes: Number(receita),
    anexoSimples,
    atividade: derived.presumidoAtividade,  // ← derivado
    margemRealPercent: Number(margemReal),
    estado,
    hasICMS: derived.hasICMS,                // ← derivado
    hasISS: derived.hasISS,                  // ← derivado
  }),
})
```

Backend endpoint (`/api/empresas/[id]/tax-compare`) já aceitava esses
campos via Zod — sem mudança backend necessária.

## Arquivos

### Modificados (4)
- `lib/tax/ai-analysis/tools.ts` (+SUBMIT_ANALYSIS_TOOL_NAME + tool schema completo)
- `lib/tax/ai-analysis/claude-analyzer.ts` (detect submit_analysis + parser 4 estratégias + tryParseJson exportado)
- `app/api/empresas/[id]/tax-ai-analysis/route.ts` (retry 1x)
- `components/tributario/comparativo-section.tsx` (REESCRITO — sem dropdown)

### Novos (2)
- `__tests__/tax-ai-submit-tool.test.ts` (17 tests)
- `docs/SPRINT-5.0.2.e-FIX-JSON-COMPARATIVO.md`

### Atualizado (1)
- `__tests__/tax-ai-tools.test.ts` (1 assertion: `toHaveLength(3)` → `toHaveLength(4)`)

## Métricas

| | Antes | Depois |
|---|---|---|
| Tools registradas | 3 | **4** (submit_analysis adicionada) |
| Estratégias parser JSON | 2 | **4** |
| Retry endpoint | 0 | **1** |
| Dropdown "Atividade" no Comparativo | sim | **não (auto-derive)** |
| Testes | 2166 | **2183 (+17)** |

## Smoke test prod

1. **`/tributario?tab=analise`** → Análise IA → "Analisar agora"
   - Esperado: análise gera sem erro (submit_analysis garante estrutura)
   - Se Claude falhar 1x, retry automático antes de mostrar erro
2. **`/tributario?tab=analise`** → "Comparativo de Regimes"
   - Esperado: card indigo no topo "🍽️ Restaurantes e similares — 5611-2/01 · Atividade Lucro Presumido: COMERCIO · ICMS ✓ ISS ✗"
   - Form: SÓ receita + margem + anexo + UF (sem dropdown atividade, sem checkboxes)
3. Empresa sem CNAE configurado:
   - Esperado: card VERMELHO "CNAE não configurado" + botão "Configurar CNAE →"

## Próximo

**Sprint 5.0.3** — IA Agent conversacional (chat) usando essa Knowledge Base.
**Sprint 5.0.4** — Reforma Tributária IBS/CBS UI dedicada.
