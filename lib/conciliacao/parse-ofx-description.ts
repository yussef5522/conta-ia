// Sprint Conciliação-Visual: parse heurístico da descrição OFX.
//
// O parser OFX hoje guarda só `description` (consolidação de MEMO+NAME do
// XML). Pra exibir o card de extrato no estilo Mercury/Linear queremos:
//   - Nome do favorecido em destaque (parte antes do " - " ou " | ")
//   - Sub-descrição em segunda linha (tipo "Pix | Maquininha")
//   - Chips visuais por tipo de operação (PIX/TED/BOLETO/etc) detectados
//     por regex case-insensitive na descrição inteira
//
// Função pura, sem DB, totalmente testável. Quando não há separador, a
// description vira favored e subDescription = null.

export type KindHint =
  | 'PIX'
  | 'TED'
  | 'DOC'
  | 'BOLETO'
  | 'TARIFA'
  | 'PAGAMENTO'
  | 'ESTORNO'
  | 'ANTECIPAÇÃO'

export interface StatementInfo {
  favored: string
  subDescription: string | null
  kindHints: KindHint[]
}

// Ordem importa: mais específicos primeiro pra evitar PIX engolir PIX-related.
const KIND_PATTERNS: Array<{ kind: KindHint; re: RegExp }> = [
  { kind: 'PIX', re: /\bpix\b/i },
  { kind: 'TED', re: /\bted\b/i },
  { kind: 'DOC', re: /\bdoc\b/i },
  { kind: 'BOLETO', re: /\bboleto\b/i },
  { kind: 'ESTORNO', re: /\b(estorno|devolu[çc][ãa]o)\b/i },
  { kind: 'ANTECIPAÇÃO', re: /\bantecipa[çc][ãa]o?\b/i },
  { kind: 'PAGAMENTO', re: /\bpagamento\b/i },
  // TARIFA por último: pega "pacote serviços", "manutenção", "tarifa", "iof", "juros".
  // Sem \b final no "pacote servi" pois "serviços" pode terminar com "os" sem boundary.
  { kind: 'TARIFA', re: /\btarifa\b|\bpacote\s+servi|\bmanuten[çc][ãa]o\b|\biof\b|\bjuros\b/i },
]

// Separadores comuns usados pelos bancos BR pra colar favorecido + tipo.
// Ordem: o mais específico (" | ") antes do mais genérico (" - ").
const SEPARATORS = [' | ', ' - ', ' – ']

/**
 * Extrai favorecido + sub-descrição + chips de tipo de uma descrição OFX.
 *
 * Exemplos:
 *   "JONAS - Pix | Maquininha" → { favored: "JONAS", subDescription: "Pix | Maquininha", hints: ["PIX"] }
 *   "PAGAMENTO CONSORCIO"      → { favored: "PAGAMENTO CONSORCIO", subDescription: null, hints: ["PAGAMENTO"] }
 *   "PACOTE SERVICOS"          → { favored: "PACOTE SERVICOS", subDescription: null, hints: ["TARIFA"] }
 */
export function extractStatementInfo(description: string): StatementInfo {
  const desc = (description ?? '').trim()
  if (!desc) {
    return { favored: '', subDescription: null, kindHints: [] }
  }

  // Detecta chips na descrição INTEIRA (favored + sub).
  const kindHints: KindHint[] = []
  for (const { kind, re } of KIND_PATTERNS) {
    if (re.test(desc) && !kindHints.includes(kind)) {
      kindHints.push(kind)
    }
  }

  // Tenta separar favorecido + sub. Pega o PRIMEIRO separador que aparece.
  let splitAt = -1
  let sepLen = 0
  for (const sep of SEPARATORS) {
    const idx = desc.indexOf(sep)
    if (idx !== -1 && (splitAt === -1 || idx < splitAt)) {
      splitAt = idx
      sepLen = sep.length
    }
  }

  if (splitAt === -1) {
    // Sem separador: description inteira é o favorecido (caso típico Banrisul:
    // "PAGAMENTO CONSORCIO", "PIX ENVIADO", "DEBITO STONE").
    return { favored: desc, subDescription: null, kindHints }
  }

  const favored = desc.slice(0, splitAt).trim()
  const subDescription = desc.slice(splitAt + sepLen).trim()

  // Edge case: separador no início ou fim, ou favored ficaria vazio
  if (!favored) {
    return { favored: subDescription, subDescription: null, kindHints }
  }
  if (!subDescription) {
    return { favored, subDescription: null, kindHints }
  }

  return { favored, subDescription, kindHints }
}
