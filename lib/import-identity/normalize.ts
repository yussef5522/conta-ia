// Sprint Import Idempotente (18/06/2026) — normalização CANÔNICA.
//
// Princípio: a MESMA transação deve produzir a MESMA assinatura,
// independente do canal de origem (OFX SGML/XML, Excel, PDF Vision) ou
// formato do export (Banrisul sem timezone vs Sicredi BRT-3).
//
// Causa raiz do bug observado em 18/06/2026 (Cacula):
//   Banrisul exporta DTPOSTED 8 chars sem tz
//   Sicredi  exporta DTPOSTED com hora + BRT-3 (formato OFX bracket TZ)
//   Stone    exporta DTPOSTED com hora + UTC (formato OFX bracket TZ)
// Hash atual usa `t.datePosted.toISOString().slice(0,10)` que pode dar
// dia diferente conforme o parser interpretar (BRT-3 vs UTC).
//
// Solução: PEGAR SÓ OS 8 PRIMEIROS CHARS de DTPOSTED. Esse é o calendar
// date que o banco gravou — sem interpretação de fuso. yyyymmdd literal.
//
// Funções PURAS. Sem dependência de Date/timezone do runtime.

/**
 * Extrai yyyymmdd dos primeiros 8 chars de uma string DTPOSTED ou ISO date.
 * Funciona com OFX 8 chars literal, OFX com hora + bracket TZ, ISO date,
 * ISO datetime Z, e Date object (via componentes UTC).
 */
export function extractDateKey(raw: string | Date): string {
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return ''
    const y = raw.getUTCFullYear()
    const m = String(raw.getUTCMonth() + 1).padStart(2, '0')
    const d = String(raw.getUTCDate()).padStart(2, '0')
    return `${y}${m}${d}`
  }
  if (typeof raw !== 'string') return ''
  const compact = raw.replace(/-/g, '')
  const candidate = compact.slice(0, 8)
  if (!/^\d{8}$/.test(candidate)) return ''
  return candidate
}

/**
 * Converte valor float pra centavos inteiros COM SINAL — pela DIREÇÃO DE
 * CAIXA, NÃO pelo type cru.
 *
 * Mapeamento (Sprint ContentHash Estável — 20/06/2026):
 *   CREDIT             -> +cents  (entrada na conta)
 *   DEBIT              -> -cents  (saída da conta)
 *   TRANSFER + IN      -> +cents  (entrada na conta)
 *   TRANSFER + OUT     -> -cents  (saída da conta)
 *   TRANSFER + null    -> -cents  (DEFAULT seguro: trata como saída — compat
 *                                   pra tx antigas sem transferDirection;
 *                                   ainda assim previne colisão DEBIT/CREDIT)
 *   Resto              -> +cents  (CREDIT-like)
 *
 * Causa raiz que estamos matando: ANTES, `type='TRANSFER'` caía no else=+1
 * (CREDIT-like). Quando o detector promovia DEBIT (-) → TRANSFER OUT,
 * o contentHash MUDAVA de sinal. Banrisul re-export com FITID renumerado
 * (curto, não-confiável) trazia o DEBIT (-) original; gate via contentHash
 * incoming (-) ≠ stored (+) → considerava nova → duplicava.
 *
 * Agora a direção de CAIXA é a verdade: DEBIT (-) e TRANSFER OUT (-)
 * geram o MESMO contentHash. Re-import vê hash idêntico → barra. ✓
 *
 * Garantia anti-colisão preservada: DEBIT(-100) e CREDIT(+100) seguem
 * gerando hashes distintos.
 *
 * Round half-up pra evitar drift de float (0.005 -> 1 centavo).
 */
export function valorToCents(
  amount: number,
  type: 'CREDIT' | 'DEBIT' | 'TRANSFER' | string,
  transferDirection?: 'IN' | 'OUT' | null,
): number {
  if (!isFinite(amount)) return 0
  let sign: 1 | -1
  if (type === 'CREDIT') {
    sign = 1
  } else if (type === 'DEBIT') {
    sign = -1
  } else if (type === 'TRANSFER') {
    if (transferDirection === 'IN') sign = 1
    else if (transferDirection === 'OUT') sign = -1
    // Default DEFENSIVO pra TRANSFER sem direction:
    // trata como OUT (-1) pra preservar a regra "DEBIT == TRANSFER OUT".
    // Não usamos +1 default porque cria falsa colisão com CREDIT.
    else sign = -1
  } else {
    sign = 1
  }
  const abs = Math.abs(amount)
  const cents = Math.floor(abs * 100 + 0.5)
  return sign * cents
}

/**
 * Normalização da descrição (NAME + MEMO concatenados):
 *   - uppercase + strip acentos (NFD + combining marks U+0300-U+036F)
 *   - strip caracteres de controle U+0000-U+001F
 *   - strip pontuação/símbolos preservando letras [A-Z] e números [0-9]
 *   - colapsa qualquer whitespace em 1 espaço; trim
 *
 * Sprint Import Idempotente Iter 2 (18/06/2026): remover pontuação resolve
 * o caso real Banrisul "OP. CREDITO C/GARANTIA" vs "OP CREDITO C/GARANTIA"
 * (mesma tx exportada com pontuação levemente diferente) — ambos viram
 * "OP CREDITO C GARANTIA" e colidem no contentHash.
 *
 * Números PRESERVADOS pra distinguir tx genuinamente diferentes (ex:
 * "PARCELA 1/12" e "PARCELA 2/12" continuam separadas — viram
 * "PARCELA 1 12" e "PARCELA 2 12").
 *
 * "OP. CREDITO C/GARANTIA"      -> "OP CREDITO C GARANTIA"
 * "OP CREDITO C/GARANTIA"       -> "OP CREDITO C GARANTIA"
 * "Acai especial - Lote #42  "  -> "ACAI ESPECIAL LOTE 42"
 * "PIX YUSSEF | TRANSFERÊNCIA"  -> "PIX YUSSEF TRANSFERENCIA"
 */
export function normalizeDescription(raw: string | null | undefined): string {
  if (!raw) return ''
  return raw
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ -]/g, ' ')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Combina NAME + MEMO numa única descrição canônica.
 * Banco às vezes preenche só um dos dois.
 */
export function buildDescription(name?: string | null, memo?: string | null): string {
  const n = normalizeDescription(name)
  const m = normalizeDescription(memo)
  if (n && m) return n === m ? n : `${n} ${m}`
  return n || m
}
