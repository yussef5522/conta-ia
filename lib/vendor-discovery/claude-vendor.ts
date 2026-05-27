// Sprint 5.0.2.n — Consulta ao Claude Haiku pra identificar vendor BR.
//
// Usado APENAS quando:
//   1. Cache global não tem o vendor
//   2. BrasilAPI não retornou (ou descrição não tem CNPJ)
//
// Salva o resultado no cache global pra próximas consultas.

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-haiku-4-5-20251001'

// Pricing aproximado Haiku 4.5 (USD per 1M tokens)
const PRICE_INPUT_PER_1M = 0.8
const PRICE_OUTPUT_PER_1M = 4.0

export interface ClaudeVendorResult {
  vendorName: string
  razaoSocial: string | null
  nomeFantasia: string | null
  ramoAtividade: string
  categoriaSugerida: string
  confidence: number
  description: string
  custoApi: number
  /** Sprint 5.0.2.o — qual estratégia Claude usou (telemetria). */
  estrategiaUsada?: string
  /** Sprint 5.0.2.o — texto cru do Claude pra debug. */
  rawText?: string
  rawJson?: unknown
}

export interface ClaudeVendorInput {
  vendorName: string
  cnpj?: string | null
  transactionDescription: string
  transactionType: 'DEBIT' | 'CREDIT'
  /** Sprint 5.0.2.s — setor da empresa pra prompt setorial. */
  setor?: string | null
}

// Sprint 5.0.2.o — Prompt reescrito (mais corajoso, com pistas).
const SYSTEM_PROMPT = `Você é um especialista em empresas brasileiras e categorização contábil.

Sua tarefa: identificar empresas brasileiras que aparecem em transações bancárias
e sugerir a categoria contábil correta.

ESTRATÉGIA EM ORDEM DE PRIORIDADE:

1. RECONHECIMENTO DIRETO:
   Se você reconhece a empresa (marca BR), use seu conhecimento.
   - AMBEV, COCA-COLA, SPAL, HEINEKEN → Fornecedor Bebidas (conf 0.95)
   - JBS, FRIBOI, MARFRIG, SADIA, PERDIGAO → Fornecedor Carnes (conf 0.95)
   - SHELL, IPIRANGA, PETROBRAS → Combustível (conf 0.95)
   - CELESC, CPFL, ENEL, COPEL → Energia Elétrica (conf 0.95)
   - VIVO, TIM, CLARO → Telefonia e Internet (conf 0.90)
   - STONE, CIELO, REDE, GETNET → Receita Cartão (conf 0.95)
   - IFOOD, RAPPI, UBER EATS → Receita Delivery (conf 0.95)

2. PISTAS NA RAZÃO SOCIAL:
   Se nome contém palavras descritivas, USE para categorizar (conf 0.80-0.90):
   - "EMBALAGENS" / "EMBALAGEM" → Material de Embalagem
   - "BEBIDAS" → Fornecedor Bebidas
   - "CARNES" / "FRIGORIFICO" / "AVICOLA" → Fornecedor Carnes
   - "CONSERVAS" → Fornecedor Alimentos
   - "PRODUTOS ALIMENTICIOS" / "ALIMENTOS" → Fornecedor Alimentos
   - "HORTIFRUTI" / "FRUTAS" / "LEGUMES" → Hortifruti
   - "DISTRIBUIDORA" + alimentos → Compras Mercadoria
   - "PADARIA" / "CONFEITARIA" → Padaria
   - "SOFTWARE" / "SISTEMAS" / "TECNOLOGIA" / "INFORMATICA" → Software/Tecnologia
   - "CONTROL DE PONTO" / "PONTO ELETRONICO" → Software/Tecnologia
   - "POSTO" / "COMBUSTIVEIS" → Combustível
   - "TRANSPORTADORA" / "LOGISTICA" → Frete
   - "CONTABILIDADE" / "CONTADOR" → Honorários Contábeis
   - "ADVOGADO" / "ADVOCACIA" / "JURIDICO" → Honorários Jurídicos
   - "CONSTRUTORA" / "ENGENHARIA" → Serviços de Engenharia
   - "MEDICINA" / "CLINICA" / "MEDICO" → Saúde
   - "IMOBILIARIA" → Aluguel
   - "MARKETING" / "PUBLICIDADE" / "PROPAGANDA" → Marketing Digital
   - "SEGURANCA" / "VIGILANCIA" → Segurança
   - "LIMPEZA" / "CONSERVACAO" → Material/Serviço de Limpeza
   - "MATERIAIS ELETRICOS" → Material Elétrico
   - "MATERIAIS DE CONSTRUCAO" → Material de Construção
   - "AUTO PECAS" / "AUTOPECAS" → Manutenção Veículos
   - "OFICINA" → Manutenção Veículos
   - "FARMACIA" / "DROGARIA" → Material Médico

3. INFERÊNCIA POR CONTEXTO:
   Se descrição inclui contexto (ex: "PAGAMENTO ALUGUEL JOAO DA SILVA"),
   use o contexto.

4. SOMENTE SE NADA DAS 3 ESTRATÉGIAS FUNCIONAR:
   Retorne confidence baixo (<0.6) e categoria "A Categorizar".

CATEGORIAS VÁLIDAS (use uma destas):
RECEITAS: Receita de Vendas, Receita Cartão, Receita Pix, Receita TED, Receita Boleto, Receita Delivery, Receita Gympass/Wellhub, Receita E-commerce
FORNECEDORES: Compras Mercadoria, Fornecedor Bebidas, Fornecedor Carnes, Fornecedor Alimentos, Hortifruti, Material de Embalagem, Material de Limpeza, Material de Escritório, Material Elétrico, Material de Construção, Material Médico, Padaria
OPERACIONAIS: Salários, Vale Transporte, Vale Alimentação, Vale Refeição, Aluguel, Condomínio, Energia Elétrica, Água e Esgoto, Telefonia e Internet, Gás, Combustível, Manutenção Veículos, Frete, Software/Tecnologia, Marketing Digital, Assinaturas
SERVIÇOS: Honorários Contábeis, Honorários Jurídicos, Serviços de Engenharia, Serviços Profissionais, Segurança, Limpeza, Saúde, Educação/Cursos
TRIBUTÁRIAS: Tributos Federais, DAS Simples Nacional, DAS MEI, INSS, FGTS, ICMS, ICMS-ST, ISS, IPTU, IPVA
BANCÁRIAS: Tarifas Bancárias, Juros e Encargos, Taxa Cartão
PESSOAIS: Distribuição de Lucros, Pró-labore, Refeições/Alimentação

CONFIANÇA HONESTA:
- 0.90-0.95: empresa muito conhecida ou pista MUITO clara na descrição
- 0.75-0.89: pista clara mas marca não famosa
- 0.60-0.74: inferência razoável
- < 0.60: realmente não tem pista

NUNCA seja medroso quando há pistas óbvias. "EMBALAGENS LTDA" claramente vende
embalagens. "PRODUTOS ALIMENTICIOS LTDA" claramente vende alimentos. USE ISSO.

RESPOSTA: JSON puro, sem markdown.`

// Sprint 5.0.2.s — orientação contábil POR SETOR
const SETOR_HINTS: Record<string, string> = {
  RESTAURANTE:
    'Para RESTAURANTE distinga: insumos para preparar pratos = "Matéria-Prima - Outros Insumos" / "Matéria-Prima - Carnes" / "Matéria-Prima - Bebidas" / "Matéria-Prima - Hortifruti" (NÃO "Fornecedor X"). Embalagens delivery = "Embalagens - Delivery". Descartáveis = "Embalagens - Descartáveis".',
  ACADEMIA:
    'Para ACADEMIA distinga: suplementos para revenda (Growth, Max Titanium, Probiotica) = "Mercadoria Revenda - Suplementos". Equipamentos novos = "Equipamentos Academia". Software (PACT/Tecnofit) = "Software Gestão Academia".',
  COMERCIO_ROUPA:
    'Para COMÉRCIO DE ROUPAS distinga: confecção/fornecedor têxtil = "Mercadoria Revenda - Confecções". Sacolas/etiquetas = "Embalagens Loja". Frete (Jadlog/Correios) = "Frete".',
  VAREJO_GERAL:
    'Para VAREJO GERAL use "Mercadoria para Revenda" ou "Compras Mercadoria" pra produtos revendidos.',
}

function buildUserPrompt(input: ClaudeVendorInput): string {
  const tipo =
    input.transactionType === 'DEBIT' ? 'Pagamento (despesa)' : 'Recebimento (receita)'
  const hintSetor =
    input.setor && SETOR_HINTS[input.setor] ? `\n\nCONTEXTO CONTÁBIL: ${SETOR_HINTS[input.setor]}\n` : ''
  return [
    `Identifique esta empresa que apareceu em transação bancária brasileira:`,
    '',
    `Razão social/Nome: ${input.vendorName}`,
    input.cnpj ? `CNPJ: ${input.cnpj}` : '',
    `Descrição completa do extrato: ${input.transactionDescription}`,
    `Tipo: ${tipo}`,
    input.setor ? `Setor da empresa: ${input.setor}` : '',
    hintSetor,
    'Aplique a estratégia em ordem:',
    '1. Você reconhece a empresa?',
    '2. Tem palavras-chave descritivas no nome?',
    '3. Tem contexto na descrição?',
    '',
    'Retorne JSON (sem markdown, sem explicação fora do JSON):',
    '{',
    '  "vendor_existe": true|false,',
    '  "razao_social": "razão social formal",',
    '  "nome_fantasia": "nome comercial se diferente",',
    '  "ramo_atividade": "descrição clara do que a empresa faz",',
    '  "categoria_sugerida": "uma das categorias da lista do system prompt",',
    '  "confidence": 0.0-1.0,',
    '  "description": "explicação curta (1 frase) do raciocínio",',
    '  "estrategia_usada": "RECONHECIMENTO_DIRETO" | "PISTA_NO_NOME" | "CONTEXTO" | "SEM_PISTA"',
    '}',
  ]
    .filter(Boolean)
    .join('\n')
}

interface AnthropicResponse {
  content: Array<{ type: string; text?: string }>
  usage: { input_tokens: number; output_tokens: number }
}

/**
 * Pergunta ao Claude. Timeout 8s. Falha → retorna confidence 0.3.
 *
 * Caller é responsável por:
 *  - decidir se chama (não tem cache, não tem brasilapi)
 *  - persistir resultado no cache global se confidence ≥ threshold
 */
export async function askClaudeAboutVendor(
  input: ClaudeVendorInput,
): Promise<ClaudeVendorResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return fallbackResult(input.vendorName)
  }

  const userPrompt = buildUserPrompt(input)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!res.ok) {
      console.error('[CLAUDE_VENDOR] HTTP', res.status)
      return fallbackResult(input.vendorName)
    }

    const data = (await res.json()) as AnthropicResponse
    const text = data.content.find((c) => c.type === 'text')?.text ?? ''
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean) as {
      razao_social?: string
      nome_fantasia?: string
      ramo_atividade?: string
      categoria_sugerida?: string
      confidence?: number | string
      description?: string
      estrategia_usada?: string
    }

    const inputTok = data.usage?.input_tokens ?? 0
    const outputTok = data.usage?.output_tokens ?? 0
    const custoApi =
      (inputTok * PRICE_INPUT_PER_1M + outputTok * PRICE_OUTPUT_PER_1M) / 1_000_000

    const confidenceNum =
      typeof parsed.confidence === 'number'
        ? parsed.confidence
        : parseFloat(String(parsed.confidence ?? '0.5'))

    return {
      vendorName: parsed.nome_fantasia || parsed.razao_social || input.vendorName,
      razaoSocial: parsed.razao_social ?? null,
      nomeFantasia: parsed.nome_fantasia ?? null,
      ramoAtividade: parsed.ramo_atividade ?? 'Desconhecido',
      categoriaSugerida: parsed.categoria_sugerida ?? 'A Categorizar',
      confidence: Math.max(0, Math.min(1, confidenceNum || 0.5)),
      description: parsed.description ?? '',
      custoApi,
      estrategiaUsada: parsed.estrategia_usada,
      rawText: text,
      rawJson: parsed,
    }
  } catch (err) {
    console.error('[CLAUDE_VENDOR] erro:', err)
    return fallbackResult(input.vendorName)
  } finally {
    clearTimeout(timeout)
  }
}

function fallbackResult(vendorName: string): ClaudeVendorResult {
  return {
    vendorName,
    razaoSocial: null,
    nomeFantasia: null,
    ramoAtividade: 'Desconhecido',
    categoriaSugerida: 'A Categorizar',
    confidence: 0.3,
    description: 'Não consegui identificar este vendor.',
    custoApi: 0,
  }
}
