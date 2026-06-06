// Sprint Retirada-1-Clique — sugestão de retirada de sócio baseada na
// descrição da tx PJ.
//
// SEMPRE é sugestão (chip "parece retirada?"), nunca categoriza sozinho.
// User confirma na UI escolhendo sócio + tipo (kind).
//
// 3 sinais combinados:
//   1. CPF do sócio na descrição (forte — quase certeza)
//   2. Nome do sócio (forte)
//   3. Chave Pix do sócio (forte)
//   4. Keyword pessoal (médio — sugere sem afirmar)
//
// Função PURA — sem DB, sem rede. Testável.

export interface SocioRef {
  id: string
  nome: string
  cpf: string | null
  /** Array de chaves Pix (email, telefone, CPF, aleatória). */
  pixKeys: string[]
  papel: string // SOCIO | ADMINISTRADOR | FAMILIAR
}

export type WithdrawalKind =
  | 'PRO_LABORE'
  | 'DISTRIBUICAO'
  | 'REEMBOLSO'
  | 'ADIANTAMENTO'
  | 'RETIRADA_SOCIOS'

export interface WithdrawalSuggestion {
  socioId: string
  socioNome: string
  /** Tipo sugerido (kind). User pode mudar. */
  suggestedKind: WithdrawalKind
  /** 'STRONG' (CPF/nome/pix) ou 'WEAK' (só keyword pessoal). */
  strength: 'STRONG' | 'WEAK'
  /** Razões legíveis em pt-BR pra UI mostrar (chips). */
  reasons: string[]
}

// Keywords de despesa tipicamente PESSOAL (não-empresarial). Lista
// conservadora — falsos positivos possíveis (ex: "ESCOLA" pode ser
// fornecedor real), por isso retorna WEAK (só chip "parece retirada?",
// nunca categoriza sozinho).
const PERSONAL_KEYWORDS = [
  // ORDEM: mais específicas primeiro (regex retorna o 1º match)
  /\bcooperativa\s+de\s+pais\s+e\s+mestres\b/i,
  /\bmensalidade\s+escolar\b/i,
  /\bescola\b/i,
  /\bcol[eé]gio\b/i,
  /\bfaculdade\b/i,
  /\buniversidade\b/i,
  /\bplano\s+(de\s+)?sa[uú]de\b/i,
  /\bun[ií]med\s+individual\b/i,
  /\bamil\s+individual\b/i,
  /\biptu\b/i,
  /\bcond[oô]m[ií]nio\s+(residencial|do\s+pr[eé]dio)\b/i,
  /\bclube\b/i,
  /\bacademia\s+(particular|pessoal)\b/i,
  /\brecarga\s+(do\s+)?(celular|telefone)\b/i,
  /\bnetflix\b/i,
  /\bspotify\b/i,
  /\bdisney\s*\+?\b/i,
]

function hasPersonalKeyword(description: string): {
  has: boolean
  matched: string | null
} {
  for (const re of PERSONAL_KEYWORDS) {
    const m = description.match(re)
    if (m) return { has: true, matched: m[0] }
  }
  return { has: false, matched: null }
}

function normalizeCpf(cpf: string | null): string | null {
  if (!cpf) return null
  const d = cpf.replace(/\D/g, '')
  return d.length === 11 ? d : null
}

function normalizeForCompare(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

function extractCpfsFromDescription(desc: string): string[] {
  if (!desc) return []
  // CPF: 11 dígitos. Pode estar formatado ou puro.
  const matches: string[] = []
  const re = /\b(\d{11})\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(desc)) !== null) {
    matches.push(m[1])
  }
  return matches
}

function nomeFirstWords(nome: string, minLen = 4): string[] {
  // Pega primeiros 1-2 nomes significativos pra match (evita "DE", "DA")
  return nome
    .split(/\s+/)
    .filter((w) => w.length >= minLen)
    .slice(0, 2)
    .map((w) => normalizeForCompare(w))
}

// Mapa de papel → kind sugerido (mesmo do bridges/kind-defaults)
function kindFromPapel(papel: string): WithdrawalKind {
  if (papel === 'ADMINISTRADOR') return 'PRO_LABORE'
  if (papel === 'FAMILIAR') return 'RETIRADA_SOCIOS'
  return 'DISTRIBUICAO' // SOCIO regular
}

/**
 * Sugere retirada de sócio a partir da descrição da tx PJ.
 * Retorna null quando nenhum sinal foi encontrado.
 *
 * Multi-sócio: avalia cada um e retorna o melhor match (STRONG ganha de
 * WEAK; entre STRONGs, sócio com mais sinais ganha).
 */
export function suggestWithdrawal(
  description: string,
  socios: SocioRef[],
): WithdrawalSuggestion | null {
  const descNorm = normalizeForCompare(description)
  const cpfsInDesc = extractCpfsFromDescription(description)

  let best: WithdrawalSuggestion | null = null
  let bestScore = 0

  for (const socio of socios) {
    const reasons: string[] = []
    let score = 0

    // 1. CPF (forte)
    const socioCpf = normalizeCpf(socio.cpf)
    if (socioCpf && cpfsInDesc.includes(socioCpf)) {
      reasons.push('CPF do sócio')
      score += 4
    }

    // 2. Nome do sócio (forte)
    const words = nomeFirstWords(socio.nome)
    if (words.length > 0 && words.every((w) => descNorm.includes(w))) {
      reasons.push('Nome do sócio')
      score += 3
    }

    // 3. Chave Pix (forte) — checa cada chave (email, telefone, CPF formatado)
    for (const key of socio.pixKeys) {
      const k = key.trim().toLowerCase()
      if (!k || k.length < 4) continue
      if (descNorm.includes(k)) {
        reasons.push('Chave Pix do sócio')
        score += 3
        break
      }
    }

    if (score === 0) continue // sócio não bate; pula

    if (score > bestScore) {
      bestScore = score
      best = {
        socioId: socio.id,
        socioNome: socio.nome,
        suggestedKind: kindFromPapel(socio.papel),
        strength: 'STRONG',
        reasons,
      }
    }
  }

  // Se NENHUM sócio bateu por CPF/Nome/Pix, tenta keyword pessoal (WEAK)
  if (!best) {
    const kw = hasPersonalKeyword(description)
    if (kw.has && socios.length > 0) {
      // Sem indicação de QUAL sócio — sugere o 1º cadastrado como default
      // (user troca se quiser). Tipo: RETIRADA_SOCIOS (genérico, conservador).
      const first = socios[0]
      best = {
        socioId: first.id,
        socioNome: first.nome,
        suggestedKind: 'RETIRADA_SOCIOS',
        strength: 'WEAK',
        reasons: [`Despesa pessoal: "${kw.matched}"`],
      }
    }
  }

  return best
}
