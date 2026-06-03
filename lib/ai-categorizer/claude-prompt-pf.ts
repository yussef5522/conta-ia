// Sprint PF Fatia 3 — Prompt Claude pra categorização PESSOAL.
//
// Paralelo a claude-prompt.ts (PJ). Mantém PJ intocado pra evitar
// regressão. SYSTEM_PROMPT diferente: PF é controle de orçamento
// pessoal — sem regimes, sem DRE, sem CNAE.
//
// FUNÇÃO PURA.

export const CLAUDE_SYSTEM_PROMPT_PF = `Você é a IA financeira pessoal do CAIXAOS, especialista em classificar gastos PESSOAIS de pessoas físicas brasileiras.

Sua tarefa: classificar UMA transação (compra de cartão, lançamento manual, etc) em UMA categoria do plano de contas PESSOAL do usuário.

REGRAS DE OURO (siga na ordem):

1. NÃO INVENTE CATEGORIAS — escolha SOMENTE entre as fornecidas em "CATEGORIAS DISPONÍVEIS". Se nenhuma servir bem, retorne categoryId: null + reasoning claro.

2. COMPRAS DE CARTÃO frequentes têm padrões reconhecíveis no Brasil:
   - iFood / Rappi / Uber Eats → Alimentação (delivery)
   - Mercado / Pão de Açúcar / Carrefour → Alimentação
   - Uber / 99 / Cabify → Transporte
   - Posto / Shell / Ipiranga → Transporte (combustível)
   - Netflix / Spotify / HBO / Disney+ → Lazer
   - Apple.com / Google Play → Lazer (apps/streaming)
   - Airbnb / Booking / LATAM / GOL → Lazer (viagem)
   - Drogaria / Farmácia / Hospital → Saúde
   - Udemy / Alura / Claude / ChatGPT → Educação
   - Zara / Renner / Nike → Vestuário

3. PARCELAMENTO — descrições com sufixo "- Parcela X/Y" devem ser
   categorizadas pelo PRODUTO/serviço, NÃO pela palavra "Parcela".
   Ex: "Airbnb Hm9z23za5s - Parcela 5/6" → Lazer (é viagem).

4. ENCARGOS DE CARTÃO (IOF, Multa, Juros do rotativo, Valor pendente do
   mês anterior) → categoria "Cartão de crédito" / "Encargos".

5. PAGAMENTO RECEBIDO no cartão NÃO é compra. NÃO categorize — retorne
   categoryId: null + reasoning: "Pagamento da fatura — não importar".

6. CONFIDENCE — proporcional à evidência:
   - 0.85+: keyword forte na descrição (Netflix, iFood, Uber)
   - 0.65-0.84: inferência razoável (descrição menos clara)
   - 0.45-0.64: palpite educado (genérico, ex: "loja de algo")
   - <0.45 → retorne null (recuse ao invés de chutar errado)

7. CLASSIFICAÇÕES RECENTES do mesmo usuário (few-shot) são REFERÊNCIA
   forte — se ele categoriza "Posto" como "Combustível" (não "Transporte"
   genérico), siga o padrão dele.

8. FORMATO — responda APENAS JSON válido. Sem markdown, sem comentários.

FORMATO DE SAÍDA OBRIGATÓRIO:
{
  "categoryId": "<id da categoria escolhida ou null>",
  "confidence": <número 0.0 a 1.0>,
  "reasoning": "<frase curta em pt-BR explicando a escolha>",
  "alternativeCategoryIds": ["<id1>", "<id2>"]
}`

export interface PromptPfCategory {
  id: string
  name: string
  type: 'INCOME' | 'EXPENSE'
}

export interface FewShotPfExample {
  description: string
  categoryName: string
}

export interface BuildUserMessagePfInput {
  profileName: string
  categories: PromptPfCategory[]
  fewShot: FewShotPfExample[]
  description: string
  amount: number
  type: 'CREDIT' | 'DEBIT'
  date: Date
  /** true quando vem de OFX cartão (ajuda IA decidir parcela vs avulsa) */
  isCreditCardTx?: boolean
}

const MAX_CATEGORIES = 50
const MAX_FEW_SHOT = 10

function sanitize(s: string): string {
  return s.replace(/[\r\n]+/g, ' ').replace(/\\/g, '\\\\').replace(/"/g, '\\"').slice(0, 500)
}

export function buildUserMessagePf(input: BuildUserMessagePfInput): string {
  const lines: string[] = []
  lines.push(`USUÁRIO: ${sanitize(input.profileName)} (pessoa física)`)
  lines.push('')

  lines.push('CATEGORIAS DISPONÍVEIS:')
  const filtered = input.categories.filter(
    (c) =>
      (input.type === 'CREDIT' && c.type === 'INCOME') ||
      (input.type === 'DEBIT' && c.type === 'EXPENSE'),
  )
  const cats = filtered.slice(0, MAX_CATEGORIES)
  for (const c of cats) {
    lines.push(`  - ${c.id} → ${sanitize(c.name)}`)
  }
  if (filtered.length > MAX_CATEGORIES) {
    lines.push(`  (${filtered.length - MAX_CATEGORIES} categorias não mostradas)`)
  }
  lines.push('')

  if (input.fewShot.length > 0) {
    lines.push('CLASSIFICAÇÕES RECENTES DO USUÁRIO (siga o padrão dele):')
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
  if (input.isCreditCardTx) {
    lines.push(`  Origem: COMPRA DE CARTÃO DE CRÉDITO`)
  }
  lines.push('')
  lines.push('Responda APENAS com o objeto JSON.')

  return lines.join('\n')
}
