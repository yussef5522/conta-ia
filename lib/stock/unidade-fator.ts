// ESTOQUE — sugestão do FATOR DE CONVERSÃO pelo nome do produto da nota. A nota costuma
// dizer o pack no próprio nome: "FRUKI GUARANA 600ML PET 12UN" → 12; "REFRI C/6" → 6;
// "CERV CX24" → 24. Se achar, sugere (o dono só confirma); se não, null (ele digita).
// Puro e testável. NÃO chuta quando não há sinal claro (ex: "CERV SKOL 600ML" → null).

const PADROES: RegExp[] = [
  /\bC\/\s*(\d{1,3})\b/i, // C/12, C/ 6
  /\b(\d{1,3})\s*UN\b/i, // 12UN, 12 UN
  /\bCX\s*(\d{1,3})\b/i, // CX24, CX 24
  /\bFD\s*(\d{1,3})\b/i, // FD6 (fardo)
  /\bPACK\s*(\d{1,3})\b/i, // PACK 6
  /\b(\d{1,3})\s*X\s*\d/i, // 12X600 (12 unidades de 600ml)
]

export function sugerirFatorConversao(xProd: string): number | null {
  if (!xProd) return null
  for (const re of PADROES) {
    const m = xProd.match(re)
    if (m) {
      const n = Number(m[1])
      if (Number.isFinite(n) && n >= 2 && n <= 144) return n // pack plausível
    }
  }
  return null
}
