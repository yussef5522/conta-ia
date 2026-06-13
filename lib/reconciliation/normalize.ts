// Normaliza memo (descrição) pra chave estável.
// - Remove acentos (NFD + strip diacríticos)
// - Trim
// - Colapsa whitespace (incluindo CR/LF, tabs, espaços duplos do banco)
// - Uppercase
// - Remove pontuação irrelevante que bancos variam entre exports (. , ; : - _)
//   PRESERVA / pra não estragar tipos de operação (ex: "OP.CREDITO C/GARANTIA")
//
// Não removemos / porque alguns bancos diferenciam "C/GARANTIA" vs "S/GARANTIA"
// (com garantia vs sem). Removeríamos info útil.

export function normalizeMemo(s: string): string {
  if (!s) return ''
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacríticos
    .replace(/[.,;:_-]+/g, ' ') // pontuação leve vira espaço
    .replace(/\s+/g, ' ') // colapsa whitespace
    .trim()
    .toUpperCase()
}
