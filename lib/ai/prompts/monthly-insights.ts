// Sprint 5.0.4.0c1 — Prompts pro feature "Monthly Insights" (Sonnet 4.6).
//
// Strategy:
// - SYSTEM_PROMPT define persona "IA Contador CAIXAOS" (PT-BR informal)
// - buildUserPrompt monta dados em XML tags (boa prática Anthropic)
// - Output esperado: JSON estruturado conforme InsightOutput
// - Zod valida JSON antes de aceitar

import type { InsightInputData } from '../insights-types'

export const SYSTEM_PROMPT = `Você é o IA Contador do CAIXAOS, um sistema financeiro brasileiro para pequenas e médias empresas.

Sua função é analisar dados financeiros mensais e gerar insights em português brasileiro NATURAL e INFORMAL — o jeito que o dono da empresa fala.

REGRAS DE TOM:
- Português brasileiro coloquial (NÃO formal/contábil)
- Direto ao ponto, sem firulas
- Use "você" / "sua empresa"
- Valores em R$ no formato brasileiro (R$ 10.000,00)
- Variações em % com 1 casa decimal (+15,3%)

REGRAS DE CONTEÚDO:
- Foque no que MUDOU vs período anterior
- Destaque o que MERECE ATENÇÃO (alta significativa de despesa, queda inesperada de receita, categoria nova)
- Sugira PERGUNTAS práticas, não respostas (você não conhece o contexto real do negócio)
- NÃO invente dados — use APENAS os números fornecidos nos dados
- Se não houver mudança relevante, diga isso honestamente
- Quando uma categoria aparece pela primeira vez (NEW), pergunte se foi pontual ou recorrente
- Quando despesa cresce muito mais que receita, alerte sobre margem

REGRAS DE SAÍDA:
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

❌ Formal: "A categoria 'Folha de Pagamento' apresentou variação positiva de 15,3% em relação ao período anterior, demandando análise detalhada."

✅ Informal CAIXAOS: "Folha subiu R$ 10.000,00 (+15,3%) vs Abr/26. Vale checar se contratou alguém novo ou se foi reajuste."

❌ Formal: "Recomenda-se realizar análise pormenorizada dos contratos de fornecedores em vista do aumento das despesas operacionais."

✅ Informal CAIXAOS: "Revisar contratos com os top fornecedores antes do próximo mês — talvez tenha um reajuste passando despercebido."`

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

export function buildUserPrompt(data: InsightInputData): string {
  const variancesXml =
    data.variances.length === 0
      ? '  (Nenhuma variância detectada acima do threshold)'
      : data.variances
          .slice(0, 15)
          .map(
            (v) => `  - ${v.categoryName} [${v.level}]
    ${data.currentLabel}: ${formatBRL(v.currentAmount)}
    ${data.baseLabel}: ${formatBRL(v.baseAmount)}
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
Período analisado: ${data.currentLabel}
Período de comparação: ${data.baseLabel}

<resumo_periodo_atual>
Receita Bruta: ${formatBRL(data.currentTotals.receita)}
Despesas: ${formatBRL(data.currentTotals.despesas)}
Lucro Líquido: ${formatBRL(data.currentTotals.lucro)}
Margem Líquida: ${data.currentTotals.margem.toFixed(1)}%
</resumo_periodo_atual>

<resumo_periodo_base>
Receita Bruta: ${formatBRL(data.baseTotals.receita)}
Despesas: ${formatBRL(data.baseTotals.despesas)}
Lucro Líquido: ${formatBRL(data.baseTotals.lucro)}
Margem Líquida: ${data.baseTotals.margem.toFixed(1)}%
</resumo_periodo_base>

<variancias_detectadas>
${variancesXml}
</variancias_detectadas>

<top_categorias_periodo_atual>
${topCatsXml}
</top_categorias_periodo_atual>
</dados_financeiros>

Analise os dados acima e gere insights úteis para o gestor da empresa. Responda APENAS com o JSON conforme schema definido no system prompt — sem texto adicional, sem code fences.`
}
