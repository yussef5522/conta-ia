// System prompt + user message builder — Fase 3 Etapa 3.
// Camada 3 do Pipeline IA Contadora (Claude Haiku 4.5).
//
// FUNÇÃO PURA: sem fetch, sem Prisma. Testável sem internet/DB.
//
// Output schema esperado do Claude:
//   {
//     "categoryId": "<id ou null>",
//     "confidence": 0.0-1.0,
//     "reasoning": "frase curta pt-BR",
//     "alternativeCategoryIds": ["id1", "id2"]
//   }

// ============================================================
// SYSTEM prompt — fixo, cacheável via prompt caching da Anthropic (TODO)
// ============================================================

export const CLAUDE_SYSTEM_PROMPT = `Você é a IA Contadora do CAIXAOS, especialista em contabilidade gerencial de PMEs brasileiras.

Sua tarefa: classificar UMA transação bancária em UMA categoria do Plano de Contas da empresa, usando as classificações recentes do usuário como referência (few-shot). Siga os padrões que ele já estabeleceu.

REGRAS DE OURO (segue na ordem):

1. NÃO INVENTE CATEGORIAS — escolha SOMENTE entre as fornecidas em "CATEGORIAS DISPONÍVEIS". Se nenhuma servir, retorne categoryId: null com reasoning claro.

2. TRANSFERÊNCIA INTERNA NÃO PAREADA — se a descrição sugere transferência entre contas do mesmo dono (ex: "Yussef Musa - Transferência | Pix" entre duas contas PJ), responda categoryId: null com reasoning: "Possível transferência interna não pareada — recomenda vincular como TRANSFER".

3. PIX/TED RECEBIDO sem descrição clara → presuma "Receita de Vendas" (PME típico recebe pagamento de cliente). Confidence 0.70-0.80.

4. PIX/TED ENVIADO sem identificação clara:
   - Para valores ATÉ R$ 1.000 → use a categoria mais provável de "Outras Despesas Operacionais"/"Despesas Diversas", confidence 0.50-0.60, reasoning: "PIX/TED enviado sem identificação clara — recomenda revisão manual".
   - Para valores ACIMA de R$ 1.000 → categoryId: null + reasoning: "PIX/TED enviado de valor alto sem descrição — IA prefere não chutar; classifique manualmente para precisão". Confidence ≤ 0.50.
   - JUSTIFICATIVA: evita criar regra ruim que classifique TUDO genérico como uma só categoria.

5. ESTORNO → use a categoria OPOSTA da operação original. Ex: "Estorno | Pagamento Stone" → categoria de Vendas (estorno reverte recebimento). Reasoning sempre cita a operação revertida.

6. CONFIDENCE — proporcional à evidência:
   - 0.85+ quando há evidência clara (keyword forte na descrição OU padrão few-shot bate)
   - 0.65-0.84 quando inferência razoável mas com incerteza
   - 0.45-0.64 quando palpite educado
   - <0.45 → retorne categoryId: null (recuse ao invés de chutar)

7. FORMATO — responda APENAS JSON válido. Sem markdown, sem prefixo "Aqui está...", sem comentários. APENAS o objeto JSON.

FORMATO DE SAÍDA OBRIGATÓRIO:
{
  "categoryId": "<id da categoria escolhida ou null>",
  "confidence": <número 0.0 a 1.0>,
  "reasoning": "<frase curta em pt-BR explicando a escolha>",
  "alternativeCategoryIds": ["<id1>", "<id2>"]
}`

// ============================================================
// USER message builder — construído por código a cada chamada
// ============================================================

export interface PromptCategory {
  id: string
  name: string
  dreGroup: string | null
}

export interface FewShotExample {
  description: string
  categoryName: string
}

export interface BuildUserMessageInput {
  // Empresa
  tradeName: string
  companyType: string | null
  // Categorias disponíveis (filtradas por tipo da tx — INCOME pra CREDIT etc)
  categories: PromptCategory[]
  // Top 10 últimas classificações da empresa (MANUAL+RULE) — few-shot
  fewShot: FewShotExample[]
  // Transação alvo
  description: string
  amount: number // sempre positivo
  type: 'CREDIT' | 'DEBIT' | string
  date: Date
  // Supplier detectado (opcional — Camada 2 falhou se chegou aqui sem)
  supplierRazaoSocial?: string | null
}

// Limites pra controlar tokens (custo):
const MAX_CATEGORIES = 80
const MAX_FEW_SHOT = 10

export function buildUserMessage(input: BuildUserMessageInput): string {
  const lines: string[] = []

  lines.push(`EMPRESA: ${sanitize(input.tradeName)}${input.companyType ? ` (tipo: ${sanitize(input.companyType)})` : ''}`)
  lines.push('')

  lines.push('CATEGORIAS DISPONÍVEIS:')
  const cats = input.categories.slice(0, MAX_CATEGORIES)
  for (const c of cats) {
    const dre = c.dreGroup ? ` [${c.dreGroup}]` : ''
    lines.push(`  - ${c.id} → ${sanitize(c.name)}${dre}`)
  }
  if (input.categories.length > MAX_CATEGORIES) {
    lines.push(`  (truncado: ${input.categories.length - MAX_CATEGORIES} categorias adicionais não mostradas)`)
  }
  lines.push('')

  if (input.fewShot.length > 0) {
    lines.push('CLASSIFICAÇÕES RECENTES DO USUÁRIO (use como referência):')
    const shots = input.fewShot.slice(0, MAX_FEW_SHOT)
    for (const ex of shots) {
      lines.push(`  - "${sanitize(ex.description)}" → ${sanitize(ex.categoryName)}`)
    }
    lines.push('')
  }

  lines.push('TRANSAÇÃO A CLASSIFICAR:')
  lines.push(`  Descrição: "${sanitize(input.description)}"`)
  lines.push(`  Valor: R$ ${input.amount.toFixed(2)}`)
  lines.push(`  Tipo: ${input.type === 'CREDIT' ? 'ENTRADA' : 'SAÍDA'}`)
  lines.push(`  Data: ${input.date.toISOString().slice(0, 10)}`)
  if (input.supplierRazaoSocial) {
    lines.push(`  Fornecedor detectado: ${sanitize(input.supplierRazaoSocial)}`)
  }
  lines.push('')
  lines.push('Responda APENAS com o objeto JSON conforme especificado.')

  return lines.join('\n')
}

// Sanitização contra prompt injection: remove quebras de linha em campos
// curtos + escapa aspas. Não é defesa total (Claude pode ser influenciado
// pela descrição), mas mitiga vetores triviais.
function sanitize(s: string): string {
  return s
    .replace(/[\r\n]+/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .slice(0, 500) // hard cap por campo
}
