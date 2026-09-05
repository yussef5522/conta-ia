// ⭐⭐⭐ O HISTÓRICO DO BANCO TEM FORMA CANÔNICA (04/09/2026).
//
// ⛔ O CASO, medido no arquivo real: a MESMA rubrica do Banrisul aparece como
//
//     "OP. CREDITO C/GARANTIA"   (o 4.250,99 de 01/09, no arquivo do dia 04)
//     "OP.CREDITO C/GARANTIA"    (o MESMO 4.250,99, no arquivo do dia 01)
//     "OP CRED C GARANT"         (o −3.700 de 03/09)
//
// A regra aprendida do dono é `CONTAINS "OP. CREDITO C/GARANTIA"`, e o casamento era
// `descricao.toUpperCase().includes(padrao.toUpperCase())` — **string crua**. Um espaço a
// menos e a regra não morde: foi assim que o **+5.252,06 de hoje caiu em "escolha você"**.
// (O dono já tinha criado uma 2ª regra na mão, `"OP CREDITO C/GARANTIA"`, com **0
// aplicações** — o sintoma clássico de match frágil.)
//
// ⚠️ E NÃO É QUE FALTASSE NORMALIZAÇÃO: `normalizeDescription`/`normalizeExact` já colapsam
// "OP. CREDITO"/"OP.CREDITO" desde 28/08. **O ramo CONTAINS simplesmente não passava por
// nenhuma delas** — e é o ramo em que TODAS as regras do Banrisul vivem. Corrigir a
// normalização e esquecer um dos ramos é a família "N caminhos, 1 esquecido".
//
// ⭐ A FORMA CANÔNICA: MAIÚSCULA, sem acento, pontuação vira espaço, espaços colapsados, e
// as abreviações do catálogo expandidas — token inteiro, nunca pedaço:
//
//     "OP. CREDITO C/GARANTIA" ┐
//     "OP.CREDITO C/GARANTIA"  ├─→  "OP CREDITO C GARANTIA"
//     "OP CRED C GARANT"       ┘
//
// ⚠️ O CATÁLOGO É CURTO DE PROPÓSITO — só entra abreviação que a gente VIU o banco alternar
// num arquivo real. Expandir por palpite faria dois históricos DIFERENTES colidirem, e
// colisão aqui classifica dinheiro na categoria errada em silêncio.
//
// ⚠️ ISTO NÃO TOCA A IDENTIDADE DA LINHA. O dedup usa `normalizeMemo`
// (`lib/reconciliation/normalize.ts`), que já trata "." como espaço — conferido: as duas
// grafias de "OP.CREDITO" **já** davam a mesma `stableKey`, então nunca houve duplicata por
// grafia. Aqui é casamento de REGRA, outro assunto.

/** Abreviações que o banco alterna com a forma extensa, vistas em arquivo real. */
export const ABREVIACOES: Record<string, string> = {
  CRED: 'CREDITO',
  GARANT: 'GARANTIA',
  TRANSF: 'TRANSFERENCIA',
  ENC: 'ENCARGOS',
  CTA: 'CONTA',
  SERV: 'SERVICOS',
  ADIC: 'ADICIONAL',
}

/**
 * A forma canônica de um histórico bancário. PURA.
 *
 * ⚠️ Pontuação vira ESPAÇO (não some): "C/GARANTIA" → "C GARANTIA". Colar as palavras
 * criaria tokens que não existem ("CGARANTIA") e o catálogo deixaria de reconhecê-los.
 */
export function canonizarHistorico(raw: string | null | undefined): string {
  if (!raw) return ''
  const tokens = raw
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // sem acento
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')                      // pontuação vira espaço
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  return tokens.map((t) => ABREVIACOES[t] ?? t).join(' ')
}

/**
 * ⭐ O HISTÓRICO GENÉRICO É CONJUNTO FECHADO — é o que permite detectar a inversão
 * **pela FORMA**, sem confiar na posição do campo (ver `corrigirInversao`).
 *
 * ⚠️ São os rótulos que o banco imprime pro TIPO da operação. Nome de pessoa/empresa nunca
 * está aqui — e é exatamente essa a distinção que resolve a inversão.
 */
export const HISTORICOS_GENERICOS: readonly string[] = [
  'PIX ENVIADO', 'PIX RECEBIDO', 'PIX DEVOLVIDO',
  'TED ENVIADA', 'TED RECEBIDA', 'DOC ENVIADO', 'DOC RECEBIDO',
  'TRANSFERENCIA ENVIADA', 'TRANSFERENCIA RECEBIDA',
  'OP CREDITO C GARANTIA', 'ANTECIP STONE', 'DEBITO STONE',
  'ANTECIPACAO BANRICOMPRAS', 'VERO ANTECIPACAO BANRICARD', 'BANRI A VISTA',
  'IOF', 'IOF ADICIONAL', 'TRANSFERENCIA ENCARGOS CONTA UNICA',
  'PACOTE SERVICOS', 'JUROS', 'CAPITALIZACAO RG', 'PAGAMENTO CONSORCIO',
].map(canonizarHistorico)

const GENERICOS = new Set(HISTORICOS_GENERICOS)

/** O texto é um rótulo de operação do banco (e não um nome próprio)? */
export function ehHistoricoGenerico(texto: string | null | undefined): boolean {
  const c = canonizarHistorico(texto)
  return c.length > 0 && GENERICOS.has(c)
}

export interface CamposDaLinha {
  /** o `<MEMO>` do OFX */
  memo: string | null | undefined
  /** o `<NAME>` do OFX */
  name: string | null | undefined
}

export interface CamposCorrigidos {
  /** vira a DESCRIÇÃO da transação (o histórico) */
  memo: string
  /** vira `counterpartyName` (o favorecido/pagador), quando houver */
  contraparte: string | null
  /** ⭐ pro teste e pro log: a inversão foi detectada e desfeita? */
  invertido: boolean
}

/**
 * ⭐⭐ O BANRISUL INVERTE OS CAMPOS — anotado em 01/09, tratado aqui.
 *
 * No arquivo real de setembro:
 *
 *     <NAME>PIX ENVIADO        <MEMO>CACULA MIX      ← o favorecido no MEMO!
 *     <NAME>PIX RECEBIDO       <MEMO>HUB INSTITUICAO DE PAGAMENTO SA
 *
 * O mapeamento normal (`memo` → descrição) gravava a descrição **"CACULA MIX"** e a
 * contraparte **"PIX ENVIADO"** — os dois errados, e **9 transações em prod já estão assim**.
 *
 * ⭐ A REGRA É PELA FORMA, NUNCA PELA POSIÇÃO: se o campo que deveria ser o nome próprio
 * contém um **histórico genérico** (conjunto fechado) e o outro **não**, os dois estão
 * trocados. Confiar na posição é o que faz isto voltar no dia em que o banco alternar de novo.
 *
 * ⚠️ Quando os DOIS são genéricos (o caso comum do Banrisul: `NAME == MEMO`) ou quando
 * NENHUM é, não há inversão a desfazer — e não se inventa nada.
 */
export function corrigirInversao({ memo, name }: CamposDaLinha): CamposCorrigidos {
  const m = (memo ?? '').trim()
  const n = (name ?? '').trim()

  const invertido = !!m && !!n && ehHistoricoGenerico(n) && !ehHistoricoGenerico(m)
  if (invertido) return { memo: n, contraparte: m, invertido: true }

  // caminho de sempre: MEMO é o histórico; NAME só vira contraparte quando DIFERE dele
  const descricao = m || n
  const contraparte = n && m && n.toUpperCase() !== m.toUpperCase() ? n : null
  return { memo: descricao, contraparte, invertido: false }
}
