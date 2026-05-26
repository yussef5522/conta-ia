// Sprint 5.0.2.h — Parse heurístico de descrições Pix (OFX/extrato bancário).
//
// Extrai dados úteis de strings como:
//   "PIX ENVIADO YUSSEF MUSA 123.456.789-00"
//   "PIX TRANSF PARA ACADEMIA FORCA LTDA 12.345.678/0001-90"
//   "PIX yussef@email.com"
//   "PIX 11999998888"
//
// Função PURA — sem DB. Testável.

export interface ParsedPix {
  isPix: boolean
  cpf?: string // 11 dígitos, sem formatação
  cnpj?: string // 14 dígitos, sem formatação
  email?: string
  telefone?: string // 10/11 dígitos
  /** Texto remanescente após remover identificadores — usado pra match por nome */
  textoLimpo: string
}

const PIX_KEYWORDS = ['pix', 'transferencia', 'transfer ', 'transf ', 'ted ', 'doc ']

// Regex CPF formatado (xxx.xxx.xxx-xx). Sem formatação é ambíguo com telefone (11 dígitos)
// — pra evitar falso positivo, só extraímos CPF quando vem com pontos+hífen.
const CPF_RE = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g
// CPF sem formatação (11 dígitos puros) — só tentado se não houver telefone candidato
const CPF_RAW_RE = /\b\d{11}\b/g
// Regex CNPJ (xx.xxx.xxx/xxxx-xx ou 14 dígitos)
const CNPJ_RE = /\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{14})\b/g
const EMAIL_RE = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi
// Telefone 10/11 dígitos, opcionalmente com +55, (xx), espaços ou hífens
const TELEFONE_RE = /(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}[\s-]?\d{4}/g

function stripDigits(s: string): string {
  return s.replace(/\D/g, '')
}

function isValidCPF(d: string): boolean {
  if (d.length !== 11) return false
  if (/^(\d)\1{10}$/.test(d)) return false // 11111... etc
  return true
}

function isValidCNPJ(d: string): boolean {
  if (d.length !== 14) return false
  if (/^(\d)\1{13}$/.test(d)) return false
  return true
}

/**
 * Detecta se descrição é de Pix/transferência e extrai identificadores.
 */
export function parsePixDescription(description: string | null | undefined): ParsedPix {
  const empty: ParsedPix = { isPix: false, textoLimpo: '' }
  if (!description || typeof description !== 'string') return empty

  const desc = description.trim()
  const descLower = desc.toLowerCase()
  const isPix = PIX_KEYWORDS.some((k) => descLower.includes(k))
  if (!isPix) return { ...empty, textoLimpo: desc }

  // CNPJ tem prioridade sobre CPF (14 dígitos > 11)
  let cnpj: string | undefined
  const cnpjMatches = desc.match(CNPJ_RE) ?? []
  for (const m of cnpjMatches) {
    const digits = stripDigits(m)
    if (isValidCNPJ(digits)) {
      cnpj = digits
      break
    }
  }

  let cpf: string | undefined
  if (!cnpj) {
    // CPF formatado tem prioridade absoluta
    const cpfFormatMatches = desc.match(CPF_RE) ?? []
    for (const m of cpfFormatMatches) {
      const digits = stripDigits(m)
      if (isValidCPF(digits)) {
        cpf = digits
        break
      }
    }
  }

  const emailMatch = desc.match(EMAIL_RE)
  const email = emailMatch ? emailMatch[0].toLowerCase() : undefined

  // Telefone: 11 dígitos puros são interpretados como telefone (DDD + número).
  // CPF sem formatação é menos comum em descrições Pix.
  let telefone: string | undefined
  if (!cpf && !cnpj && !email) {
    const telMatches = desc.match(TELEFONE_RE) ?? []
    for (const m of telMatches) {
      const digits = stripDigits(m)
      if (digits.length === 10 || digits.length === 11) {
        telefone = digits
        break
      }
    }
  }

  // Se não achou telefone E não achou CPF formatado, tentar CPF puro (11 dígitos)
  if (!cpf && !cnpj && !telefone) {
    const rawMatches = desc.match(CPF_RAW_RE) ?? []
    for (const m of rawMatches) {
      if (isValidCPF(m)) {
        cpf = m
        break
      }
    }
  }

  // Texto "limpo" sem identificadores (pra match por nome)
  let textoLimpo = desc
    .replace(CNPJ_RE, ' ')
    .replace(CPF_RE, ' ')
    .replace(CPF_RAW_RE, ' ')
    .replace(EMAIL_RE, ' ')
    .replace(/pix|transferencia|transf|ted|doc|enviado|recebido|para|de/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return { isPix: true, cpf, cnpj, email, telefone, textoLimpo }
}

/**
 * Match heurístico por nome: case-insensitive, sem acentos, fuzzy básico.
 * Retorna true se o nome aparece na descrição (substring).
 */
export function nameMatch(nomeCadastrado: string, textoLimpo: string | null): boolean {
  if (!nomeCadastrado || !textoLimpo) return false

  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

  const n = norm(nomeCadastrado)
  const t = norm(textoLimpo)
  if (!n || !t) return false

  // Match exato substring
  if (t.includes(n)) return true

  // Match por palavras significativas (>= 3 chars). Precisa ter pelo menos 2 palavras
  // do nome cadastrado dentro do texto, ou 1 se nome só tem 1 palavra.
  const palavras = n.split(' ').filter((w) => w.length >= 3)
  if (palavras.length === 0) return false

  const matched = palavras.filter((w) => t.includes(w))
  if (palavras.length === 1) return matched.length === 1
  return matched.length >= 2
}

/**
 * Normaliza chave Pix pra comparação (remove formatação).
 */
export function normalizePixKey(key: string): string {
  const trimmed = key.trim()
  if (trimmed.includes('@')) return trimmed.toLowerCase() // email
  const digits = stripDigits(trimmed)
  // CPF (11), CNPJ (14), telefone (10/11)
  if (digits.length === 11 || digits.length === 14 || digits.length === 10) {
    return digits
  }
  return trimmed.toLowerCase() // aleatória (UUID-like)
}
