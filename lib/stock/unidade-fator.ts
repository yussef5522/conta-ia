// ESTOQUE — sugestão do FATOR DE CONVERSÃO a partir do nome do produto da nota.
//
// A nota costuma dizer o pack no próprio nome. Dois formatos:
//   · PACK SIMPLES: "FRUKI 600ML PET 12UN" → 12 · "REFRI C/6" → 6 · "CERV CX24" → 24
//   · COMPOSTO: "PREP. ALIM. SABOR CHEDDAR 2,27 KG CX/08 PC" = caixa com 8 PEÇAS de
//     2,27 KG cada. Aqui há DUAS conversões válidas e a resposta depende de em que
//     unidade o dono controla o item:
//         controle em KG → 1 CX = 8 × 2,27 = 18,16 KG   (R$ 37,65/KG)
//         controle em UN → 1 CX = 8 peças                (R$ 85,47/peça)
//     O parser antigo não pegava nada disso: "CX/08" não casa com `CX\s*\d+` (a barra
//     quebra), então voltava null e o campo ficava vazio e mudo.
//
// A sugestão é AJUDA, nunca decisão: sempre editável, e vem com a CONTA à vista pro dono
// conferir num relance. Quando não há sinal claro, devolve null — chutar fator é pior que
// perguntar (fator errado multiplica o custo de entrada, foi o bug da Skol).
//
// PRIORIDADE (a mesma de sempre): qTrib/uTrib da nota > composto > pack simples > perguntar.

export type OrigemFator = 'nota' | 'composto' | 'pack'

export interface SugestaoFator {
  fator: number | null
  /** conta legível: "8 pç × 2,27 kg = 18,16 KG · R$ 37,65/KG". null quando não há sugestão. */
  explicacao: string | null
  origem: OrigemFator | null
}

const SEM_SUGESTAO: SugestaoFator = { fator: null, explicacao: null, origem: null }

const nf = (n: number, casas = 2) => n.toLocaleString('pt-BR', { maximumFractionDigits: casas })
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const round3 = (n: number) => Math.round((n + 1e-9) * 1000) / 1000

// ---------------------------------------------------------------------------
// PACK SIMPLES (o que já existia)
// ---------------------------------------------------------------------------

const PADROES_PACK: RegExp[] = [
  /\bC\/\s*(\d{1,3})\b/i, // C/12, C/ 6
  /\b(\d{1,3})\s*UN\b/i, // 12UN, 12 UN
  /\bCX\s*(\d{1,3})\b/i, // CX24, CX 24
  /\bFD\s*(\d{1,3})\b/i, // FD6 (fardo)
  /\bPACK\s*(\d{1,3})\b/i, // PACK 6
  /\b(\d{1,3})\s*X\s*\d/i, // 12X600 (12 unidades de 600ml)
]

function packSimples(xProd: string): number | null {
  for (const re of PADROES_PACK) {
    const m = xProd.match(re)
    if (m) {
      const n = Number(m[1])
      if (Number.isFinite(n) && n >= 2 && n <= 144) return n
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// COMPOSTO — "N KG CX/M PC" e variantes
// ---------------------------------------------------------------------------

/** quantas PEÇAS vêm na caixa */
const PADROES_PECAS: RegExp[] = [
  /\bCX\s*\/\s*(\d{1,3})\s*(?:PC|PÇ|PECA|PEÇA|PECAS|PEÇAS)\b/i, // CX/08 PC
  /\bC\/\s*(\d{1,3})\s*(?:PC|PÇ|PECA|PEÇA|PECAS|PEÇAS)\b/i, // C/8 PC
  /\b(\d{1,3})\s*(?:PC|PÇ|PECA|PEÇA|PECAS|PEÇAS)\b/i, // 8 PC · 8PÇ
]

/** peso/volume de CADA peça (com a unidade) */
const PADRAO_MEDIDA = /(\d{1,4}(?:[.,]\d{1,3})?)\s*(KG|G|GR|GRAMAS?|ML|L|LT|LITROS?)\b/i

interface Medida { valor: number; unidade: 'KG' | 'LT' }

/** Normaliza a medida pra KG ou LT (a unidade de controle é uma dessas duas). */
function lerMedida(xProd: string): Medida | null {
  const m = xProd.match(PADRAO_MEDIDA)
  if (!m) return null
  const valor = Number(m[1].replace(',', '.'))
  if (!Number.isFinite(valor) || valor <= 0) return null
  const u = m[2].toUpperCase()
  if (u === 'KG') return { valor, unidade: 'KG' }
  if (u.startsWith('G')) return { valor: valor / 1000, unidade: 'KG' } // 500 G = 0,5 KG
  if (u === 'ML') return { valor: valor / 1000, unidade: 'LT' }
  return { valor, unidade: 'LT' } // L, LT, LITRO(S)
}

function pecasPorCaixa(xProd: string): number | null {
  for (const re of PADROES_PECAS) {
    const m = xProd.match(re)
    if (m) {
      const n = Number(m[1])
      if (Number.isFinite(n) && n >= 2 && n <= 144) return n
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// A função ÚNICA (REGRA 4)
// ---------------------------------------------------------------------------

export interface SugerirFatorInput {
  xProd: string
  /** unidade em que o item é controlado no estoque: KG | UN | LT */
  unidadeControle: string
  /** unidade da NOTA (CX, FD, PC…) — só pra montar a frase */
  uCom?: string | null
  /** fator resolvido pela dupla unidade da NF-e (qTrib/uTrib) — tem PRIORIDADE */
  fatorNota?: number | null
  /** preço unitário da nota — quando vem, a explicação mostra o preço convertido */
  vUnCom?: number | null
}

export function sugerirFator(input: SugerirFatorInput): SugestaoFator {
  const un = (input.unidadeControle || '').toUpperCase()
  const uCom = (input.uCom || 'CX').toUpperCase()
  const preco = (fator: number) => (input.vUnCom != null && fator > 0 ? ` · ${brl(input.vUnCom / fator)}/${un}` : '')

  // 1) a NOTA bem preenchida já responde (qTrib/uTrib) — nada ganha disso
  if (input.fatorNota != null && input.fatorNota > 0) {
    const f = round3(input.fatorNota)
    return { fator: f, explicacao: `a nota diz ${nf(f, 3)} ${un} em 1 ${uCom}${preco(f)}`, origem: 'nota' }
  }
  if (!input.xProd) return SEM_SUGESTAO

  // 2) COMPOSTO: caixa com M peças de N kg/lt cada
  const pecas = pecasPorCaixa(input.xProd)
  const medida = lerMedida(input.xProd)

  if (pecas != null) {
    // controle em PEÇA/UNIDADE → o fator é o número de peças; o peso não entra
    if (un === 'UN') {
      return {
        fator: pecas,
        explicacao: `${pecas} peças em 1 ${uCom}${preco(pecas)}`,
        origem: 'composto',
      }
    }
    // controle em KG/LT → precisa do peso de cada peça pra multiplicar
    if (medida && medida.unidade === un) {
      const f = round3(pecas * medida.valor)
      return {
        fator: f,
        explicacao: `${pecas} pç × ${nf(medida.valor, 3)} ${un.toLowerCase()} = ${nf(f, 3)} ${un}${preco(f)}`,
        origem: 'composto',
      }
    }
    // achou as peças mas não o peso (ou o peso é de outra grandeza): não dá pra
    // fechar a conta em KG — melhor perguntar do que multiplicar por um número errado.
    return SEM_SUGESTAO
  }

  // 3) PACK SIMPLES — só faz sentido quando o controle é por unidade
  const pack = packSimples(input.xProd)
  if (pack != null && un === 'UN') {
    return { fator: pack, explicacao: `${pack} ${uCom === 'CX' ? 'unidades na caixa' : `unidades em 1 ${uCom}`}${preco(pack)}`, origem: 'pack' }
  }
  // pack simples com controle em KG: "12UN" não diz quantos KG tem a caixa — perguntar.
  return SEM_SUGESTAO
}

/** Placeholder do campo quando não há sugestão: pergunta em vez de ficar vazio e mudo. */
export function placeholderFator(unidadeControle: string, uCom?: string | null): string {
  const un = (unidadeControle || 'UN').toUpperCase()
  const de = (uCom || 'CX').toUpperCase()
  return `quantas ${un} tem 1 ${de}?`
}
