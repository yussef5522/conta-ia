// ⭐⭐ NOME DE NOTA VIRA NOME DE GENTE (09/09/2026) — sugestão, o dono revisa.
//
// **O dono:** *"A Posição está cheia de nome de nota: 'CC Zero PET 2L 8U FL', 'DV UVA LT
// 290ML 6U FL', '0000903482 - CERV HEINEKEN PIL 0.60GFA RT 24UN'. Quero nomes claros."*
//
// ⛔⛔ **NADA RENOMEIA SOZINHO.** Isto produz uma SUGESTÃO; quem decide é ele, linha a linha,
// e confirma em lote. Nome de item é o que a Marcyelle lê na contagem — errar aqui é pior que
// deixar feio.
//
// ⚠️⚠️ **E O NOME DO CARDÁPIO NÃO É A RESPOSTA — medido no dado real.** A ideia óbvia era
// "usa o nome do PDV quando o item está mapeado". Nos 13 itens que têm um, ele **perde
// informação** em vários: `SUCO DELL VALE` esquece que é **UVA** (e existe o de PÊSSEGO ao
// lado, mesmo custo 3,07); `HEINEKEN` perde o **600ML**; `ORIGINAL` perde "cerveja 600ML".
// Então ele entra como **atalho ao lado da sugestão**, nunca por cima dela.
//
// ⭐ A RÉGUA MECÂNICA, na ordem: tira código do fornecedor → expande sigla conhecida →
// normaliza tamanho → tira embalagem e contagem de pack → limpa espaço → CAIXA ALTA.

/** siglas que aparecem no nome da NOTA e que o dono não usa falando */
const SIGLAS: [RegExp, string][] = [
  [/\bCC\b/g, 'COCA COLA'],
  [/\bDV\b/g, 'DEL VALLE'],
  [/\bCERV\b/g, 'CERVEJA'],
  [/\bPIL\b/g, 'PILSEN'],
  [/\bREFRIG?\b/g, 'REFRIGERANTE'],
  [/\bINTEG\b/g, 'INTEGRAL'],
  [/\bPREP\.?\s*ALIM\.?/g, 'PREPARO'],
  [/\bLIGHT ZERO\b/g, 'ZERO'], // o rótulo do Fruki traz os dois; o dono fala um
]

/**
 * ⛔ EMBALAGEM e CONTAGEM DE PACK — o que descreve a CAIXA, não o produto.
 * ⚠️ `LT` fica de FORA desta lista de propósito: no nome da nota ele quase sempre é **LATA**
 * (`DV UVA LT 290ML`), e apagá-lo perderia o tamanho. Ele é tratado em `TAMANHO`.
 */
const EMBALAGEM = /\b(PET|FL|RT|GFA|EMB|SC|FD|UND|PC|PCT|CX|BD)\b/g
const CONTAGEM_PACK = /\b(C\s*\/\s*\d+\s*UN?|C\s*\/\s*\d+|\d{1,3}\s*UN|\d{1,3}\s*U)\b/g
/** o bloco de embalagem que a nota põe no fim: `[1 / 10 / 100(1,4KG)]` */
const BLOCO_COLCHETE = /\s*\[[^\]]*\]\s*$/

/** normaliza tamanho pro jeito que o dono fala */
function normalizarTamanho(s: string): string {
  return s
    // 0.60GFA / 0,60 L → 600ML  (o rótulo da cervejaria vem em litro fracionado)
    .replace(/\b0[.,](\d{2})\s*(GFA|L)?\b/g, (_m, d) => `${Number(d) * 10}ML`)
    .replace(/\b(\d+)\s*ML\b/gi, '$1ML')
    .replace(/\b(\d+)\s*L\b/gi, '$1L')
    .replace(/\b(\d+)\s*KG\b/gi, '$1KG')
    .replace(/\b(\d+)\s*GR?\b/gi, '$1G')
    // ⚠️⚠️ `LT` É AMBÍGUO — LATA **ou** LITRO. Achado no dado real: `DV UVA LT 290ML` é lata,
    // mas `LEITE UHT ... CX 12 X 1 LT` é LITRO, e trocar ali escreveria "1 LATA" de leite.
    // ⭐ A régua: só vira LATA quando há um tamanho em ML na mesma linha — é o que distingue
    // "a lata de 290ML" de "a caixa de 1 litro". Sem ML, `LT` fica como está.
    .replace(/\bLT\b/g, (m, ...a) => (/\d+\s*ML\b/i.test(String(a[a.length - 1])) ? 'LATA' : m))
}

export interface SugestaoDeNome {
  sugestao: string
  /** o que a régua fez — a tela mostra pra ele saber se confia */
  porque: string[]
  /** o nome do PDV, quando o item está ligado a ficha/mapa: atalho de um clique */
  doCardapio: string | null
}

/**
 * ⭐ Parece nome vindo da nota? É só o FILTRO da tela de revisão — nunca uma decisão.
 * ⚠️ Falso positivo aqui custa uma linha a mais pra ele olhar; falso negativo esconde um
 * nome feio pra sempre. Então erra pro lado de INCLUIR.
 */
export function pareceNomeDeNota(nome: string): boolean {
  return (
    /^\s*\d{4,}\s*[-–]/.test(nome) // código do fornecedor na frente
    || /\b(PET|FL|RT|GFA|CX|PCT|EMB|SC|FD|UND)\b/i.test(nome)
    || /\b\d{1,3}\s*(UN|U)\b/i.test(nome) // "12UN", "8U"
    || /\bC\s*\/\s*\d+\b/.test(nome) // "C/100"
    || BLOCO_COLCHETE.test(nome)
    || /\s{2,}/.test(nome) // espaço duplo do sistema do fornecedor
  )
}

export function sugerirNomeLimpo(nome: string, opts: { doCardapio?: string | null } = {}): SugestaoDeNome {
  const porque: string[] = []
  let s = nome

  const semCodigo = s.replace(/^\s*\d{4,}\s*[-–]\s*/, '')
  if (semCodigo !== s) { porque.push('tirou o código do fornecedor'); s = semCodigo }

  const semColchete = s.replace(BLOCO_COLCHETE, '')
  if (semColchete !== s) { porque.push('tirou o bloco de embalagem do fim'); s = semColchete }

  for (const [re, para] of SIGLAS) {
    if (re.test(s)) { porque.push(`${para.toLowerCase()}`); s = s.replace(re, para) }
    re.lastIndex = 0
  }
  if (porque.some((p) => !p.startsWith('tirou'))) porque.push('expandiu sigla')

  const comTamanho = normalizarTamanho(s)
  if (comTamanho !== s) { porque.push('normalizou o tamanho'); s = comTamanho }

  const semPack = s.replace(CONTAGEM_PACK, ' ')
  if (semPack !== s) { porque.push('tirou a contagem do pack'); s = semPack }

  const semEmb = s.replace(EMBALAGEM, ' ')
  if (semEmb !== s) { porque.push('tirou a embalagem'); s = semEmb }

  // ⚠️ SOBRA DA EMBALAGEM: `CX/08 PC` vira ` /08 ` quando o CX sai. O `/N` órfão não é
  // produto — é o resto da caixa. (Visto em "PREP. ALIM. SABOR CHEDDAR 2,27 KG CX/08 PC".)
  const semBarraOrfa = s.replace(/(^|\s)\/\s*\d+\b/g, ' ')
  if (semBarraOrfa !== s) { porque.push('tirou a embalagem'); s = semBarraOrfa }

  // ⚠️ CONTAGEM DE PACK SEM UNIDADE, no fim: `CC 600 PET 12` — o 12 é a caixa, não o produto.
  // ⛔ Só no FIM e só até 3 dígitos: no meio ele costuma ser o tamanho (`COPO 400ML`), e um
  // número grande no fim tende a ser modelo (`F9240`). Troca consciente: se algum item de
  // verdade terminar num número solto, o dono corrige na revisão — que existe pra isso.
  const semPackSolto = s.replace(/\s+\d{1,3}\s*$/, '')
  if (semPackSolto.trim() && semPackSolto !== s) { porque.push('tirou a contagem do pack'); s = semPackSolto }

  // ⚠️ limpeza final: espaço duplo, hífen solto e pontuação de sobra
  s = s.replace(/[-–]\s*$/, '').replace(/\s*-\s*/g, ' ').replace(/\s{2,}/g, ' ').trim().toUpperCase()

  return {
    sugestao: s || nome.trim().toUpperCase(),
    porque: [...new Set(porque)],
    doCardapio: opts.doCardapio?.trim() || null,
  }
}
