// Hotfix 5.0.4.0c1-fix — Prompts pro feature "Monthly Insights" (Sonnet 4.6).
//
// REFATORADO: 1 system prompt único + buildUserPrompt despacha por modo.
//
// Strategy:
// - SYSTEM_PROMPT define persona "IA Contador CAIXAOS" (PT-BR informal)
// - Regras específicas POR MODO dentro do mesmo system prompt
// - buildUserPrompt monta XML diferente conforme modo (discriminado union)
// - Output esperado SEMPRE: InsightOutput JSON (schema único)

import type {
  InsightInputData,
  ComparativeInputData,
  EvolutionInputData,
  SingleInputData,
} from '../insights-types'

export const SYSTEM_PROMPT = `Você é o IA Contador do CAIXAOS, um sistema financeiro brasileiro para pequenas e médias empresas.

Sua função é analisar dados financeiros e gerar insights em português brasileiro NATURAL e INFORMAL — o jeito que o dono da empresa fala.

REGRAS DE TOM:
- Português brasileiro coloquial (NÃO formal/contábil)
- Direto ao ponto, sem firulas
- Use "você" / "sua empresa"
- Valores em R$ no formato brasileiro (R$ 10.000,00)
- Variações em % com 1 casa decimal (+15,3%)

REGRAS GERAIS DE CONTEÚDO:
- NÃO invente dados — use APENAS os números fornecidos
- Sugira PERGUNTAS práticas, não respostas (você não conhece o contexto real)
- Se não houver mudança relevante, diga isso honestamente

REGRAS ESPECÍFICAS POR MODO DE ANÁLISE:

🔵 MODO COMPARATIVE (você recebe 2 períodos: atual + comparação)
- Foque no que MUDOU entre os 2 períodos
- Destaque variações significativas (>15%) de receita, despesas, categorias
- Quando uma categoria aparece pela primeira vez (NEW), pergunte se foi pontual ou recorrente
- Quando despesa cresce muito mais que receita, alerte sobre margem

🟢 MODO EVOLUTION (você recebe N meses do mesmo período — 3 a 12 meses)
- Foque em TENDÊNCIAS ao longo do período
- Identifique padrões de crescimento, queda ou sazonalidade
- Destaque categorias EMERGENTES (começaram no meio do período) e DESAPARECIDAS
- NÃO faça comparação simples A vs B — analise a SÉRIE TEMPORAL completa
- Quando uma categoria está em quase todos os meses, marque como recorrente
- Identifique meses ATÍPICOS (muito acima/abaixo da média)

🟡 MODO SINGLE (você recebe 1 período curto — 1 a 2 meses)
- NÃO faça comparações temporais — não há histórico
- Foque em COMPOSIÇÃO da receita/despesa atual
- Destaque CONCENTRAÇÃO em poucas categorias (risco)
- Aponte saúde financeira (margem, distribuição de despesas)
- Sugira o que monitorar daqui pra frente

REGRAS DE SAÍDA (idênticas em todos os modos):
- Responda APENAS com JSON válido seguindo o schema abaixo
- NÃO inclua \`\`\`json ou texto fora do JSON
- Mínimo 2 destaques, máximo 5
- Mínimo 1 recomendação, máximo 4
- titulo curto (5-10 palavras)
- descricao em 1-3 frases curtas

SCHEMA DE SAÍDA:
{
  "resumoExecutivo": "string — 1-2 frases capturando o essencial",
  "destaques": [
    {
      "tipo": "alerta" | "positivo" | "atencao",
      "titulo": "string curta",
      "descricao": "string com 1-3 frases",
      "categoria": "string (opcional)",
      "valor": "string formatada em R$ (opcional)",
      "perguntaSugerida": "string com pergunta prática (opcional)"
    }
  ],
  "recomendacoes": ["string", "string", ...]
}

EXEMPLOS DE TOM:

❌ Formal: "A categoria 'Folha de Pagamento' apresentou variação positiva de 15,3% em relação ao período anterior."

✅ Informal CAIXAOS: "Folha subiu R$ 10.000,00 (+15,3%) vs Abr/26. Vale checar se contratou alguém novo."

❌ Formal: "Identificou-se tendência crescente nos custos administrativos ao longo do trimestre."

✅ Informal CAIXAOS: "Despesas administrativas vêm subindo todo mês — começou em R$ 5k no Jan/26 e já tá em R$ 9k no Mar/26. Vale entender o que tá puxando."`

// ============================================================
// Format helpers
// ============================================================

function formatBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(v)
}

function formatPct(v: number | null): string {
  if (v === null) return 'novo'
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
}

// ============================================================
// User prompt builders (1 por modo)
// ============================================================

function buildComparativePrompt(data: ComparativeInputData): string {
  const variancesXml =
    data.variances.length === 0
      ? '  (Nenhuma variância detectada acima do threshold)'
      : data.variances
          .slice(0, 15)
          .map(
            (v) => `  - ${v.categoryName} [${v.level}]
    Período atual (${data.periodLabel}): ${formatBRL(v.currentAmount)}
    Período comparação (${data.compareLabel}): ${formatBRL(v.baseAmount)}
    Variação: ${formatPct(v.variationPct)}`,
          )
          .join('\n')

  const topCatsXml =
    data.topCategoriesCurrent.length === 0
      ? '  (Sem categorias no período)'
      : data.topCategoriesCurrent
          .slice(0, 10)
          .map(
            (c, i) =>
              `  ${i + 1}. ${c.name}: ${formatBRL(c.amount)} (${c.percent.toFixed(1)}% do total)`,
          )
          .join('\n')

  return `<dados_financeiros>
Empresa: ${data.empresaName}
<modo_analise>comparative</modo_analise>
Período analisado: ${data.periodLabel}
Período de comparação: ${data.compareLabel}

<resumo_periodo_atual>
Receita Bruta: ${formatBRL(data.currentTotals.receita)}
Despesas: ${formatBRL(data.currentTotals.despesas)}
Lucro Líquido: ${formatBRL(data.currentTotals.lucro)}
Margem Líquida: ${data.currentTotals.margem.toFixed(1)}%
</resumo_periodo_atual>

<resumo_periodo_comparacao>
Receita Bruta: ${formatBRL(data.baseTotals.receita)}
Despesas: ${formatBRL(data.baseTotals.despesas)}
Lucro Líquido: ${formatBRL(data.baseTotals.lucro)}
Margem Líquida: ${data.baseTotals.margem.toFixed(1)}%
</resumo_periodo_comparacao>

<variancias_detectadas>
${variancesXml}
</variancias_detectadas>

<top_categorias_periodo_atual>
${topCatsXml}
</top_categorias_periodo_atual>
</dados_financeiros>

Analise os dados acima COMPARANDO os 2 períodos e gere insights úteis. Responda APENAS com o JSON conforme schema definido no system prompt.`
}

function buildEvolutionPrompt(data: EvolutionInputData): string {
  const monthsXml = data.months
    .map(
      (m) => `${m.label}:
    Receita: ${formatBRL(m.receita)}
    Despesas: ${formatBRL(m.despesas)}
    Lucro: ${formatBRL(m.lucro)}
    Margem: ${m.margem.toFixed(1)}%`,
    )
    .join('\n\n')

  const topCatsXml =
    data.topCategories.length === 0
      ? '  (Sem categorias agregadas)'
      : data.topCategories
          .slice(0, 15)
          .map(
            (c, i) =>
              `  ${i + 1}. ${c.name}: ${formatBRL(c.total)} (em ${c.monthsPresent} de ${data.months.length} meses)`,
          )
          .join('\n')

  const emergingXml =
    data.emergingCategories.length === 0
      ? '  (Nenhuma)'
      : data.emergingCategories
          .map((c) => `  - ${c.name}: começou em ${c.firstMonth}, total ${formatBRL(c.total)}`)
          .join('\n')

  const disappearedXml =
    data.disappearedCategories.length === 0
      ? '  (Nenhuma)'
      : data.disappearedCategories
          .map(
            (c) =>
              `  - ${c.name}: presente até ${c.lastMonth}, total histórico ${formatBRL(c.total)}`,
          )
          .join('\n')

  return `<dados_financeiros>
Empresa: ${data.empresaName}
<modo_analise>evolution</modo_analise>
Período analisado: ${data.periodLabel}
Total de meses: ${data.months.length}

<evolucao_mensal>
${monthsXml}
</evolucao_mensal>

<top_categorias_periodo_todo>
${topCatsXml}
</top_categorias_periodo_todo>

<categorias_emergentes>
${emergingXml}
</categorias_emergentes>

<categorias_desaparecidas>
${disappearedXml}
</categorias_desaparecidas>
</dados_financeiros>

Analise a EVOLUÇÃO dos ${data.months.length} meses e identifique tendências, padrões e mudanças importantes. NÃO compare período A vs B — analise a série temporal. Responda APENAS com o JSON conforme schema definido no system prompt.`
}

function buildSinglePrompt(data: SingleInputData): string {
  const topCatsXml =
    data.topCategoriesCurrent.length === 0
      ? '  (Sem categorias no período)'
      : data.topCategoriesCurrent
          .slice(0, 10)
          .map(
            (c, i) =>
              `  ${i + 1}. ${c.name}: ${formatBRL(c.amount)} (${c.percent.toFixed(1)}% do total)`,
          )
          .join('\n')

  return `<dados_financeiros>
Empresa: ${data.empresaName}
<modo_analise>single</modo_analise>
Período analisado: ${data.periodLabel}

<resumo_periodo>
Receita Bruta: ${formatBRL(data.currentTotals.receita)}
Despesas: ${formatBRL(data.currentTotals.despesas)}
Lucro Líquido: ${formatBRL(data.currentTotals.lucro)}
Margem Líquida: ${data.currentTotals.margem.toFixed(1)}%
</resumo_periodo>

<top_categorias>
${topCatsXml}
</top_categorias>
</dados_financeiros>

Analise este período ISOLADO (sem histórico pra comparar) — foque na COMPOSIÇÃO da receita/despesa, CONCENTRAÇÃO em categorias e SAÚDE financeira atual. NÃO faça comparações temporais. Responda APENAS com o JSON conforme schema definido no system prompt.`
}

export function buildUserPrompt(data: InsightInputData): string {
  switch (data.mode) {
    case 'comparative':
      return buildComparativePrompt(data)
    case 'evolution':
      return buildEvolutionPrompt(data)
    case 'single':
      return buildSinglePrompt(data)
  }
}
