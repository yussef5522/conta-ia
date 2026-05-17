// Extração de CNPJ da descrição — Fase 3 Etapa 2.
// FUNÇÃO PURA: sem deps, testável.
//
// Caso de uso: descrição "VIVO TELECOMUNICACOES 02.558.157/0001-62" →
// extrai "02558157000162", valida dígitos verificadores, retorna pra BrasilAPI.
//
// Aceita formatos:
//   - "12.345.678/0001-00" (formatado canônico)
//   - "12.345.678/0001/00" (separadores variados)
//   - "12345678000100" (14 dígitos puros)
//   - "12 345 678 0001 00" (com espaços)
//
// IGNORA:
//   - CPF (11 dígitos)
//   - Sequências de 14 dígitos que não passam no algoritmo de validação

// Regex captura sequências candidatas a CNPJ.
// Aceita múltiplos separadores entre blocos (pontuação, espaços, traços).
// Captura grupo com só dígitos via remoção pós-match.
const CNPJ_REGEX_LOOSE =
  /\d{2}[.\s/-]*\d{3}[.\s/-]*\d{3}[.\s/-]*\d{4}[.\s/-]*\d{2}/g

// Tira tudo que não é dígito.
function digitsOnly(s: string): string {
  return s.replace(/\D/g, '')
}

// Valida CNPJ via dígitos verificadores oficiais.
// Algoritmo: módulo 11 com pesos específicos pros 12 primeiros dígitos
// pra calcular o 13º, depois mesmo com 13 → 14.
export function validateCNPJ(cnpj: string): boolean {
  const d = digitsOnly(cnpj)
  if (d.length !== 14) return false

  // Sequências repetidas (00000000000000, 11111111111111, etc) são inválidas
  if (/^(\d)\1+$/.test(d)) return false

  const calcDigit = (slice: string, weights: number[]): number => {
    const sum = slice.split('').reduce(
      (acc, ch, i) => acc + parseInt(ch, 10) * weights[i],
      0,
    )
    const mod = sum % 11
    return mod < 2 ? 0 : 11 - mod
  }

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

  const dig13 = calcDigit(d.substring(0, 12), weights1)
  const dig14 = calcDigit(d.substring(0, 13), weights2)

  return dig13 === parseInt(d[12], 10) && dig14 === parseInt(d[13], 10)
}

// Extrai o PRIMEIRO CNPJ válido da descrição. Retorna 14 dígitos sem
// pontuação OU null se nenhum match válido.
export function extractCNPJ(text: string): string | null {
  if (!text) return null

  const matches = text.match(CNPJ_REGEX_LOOSE)
  if (!matches) return null

  for (const m of matches) {
    const digits = digitsOnly(m)
    if (digits.length === 14 && validateCNPJ(digits)) {
      return digits
    }
  }

  return null
}

// Formata 14 dígitos pra apresentação: "12.345.678/0001-00"
export function formatCNPJ(digits: string): string {
  const d = digitsOnly(digits)
  if (d.length !== 14) return digits
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}
