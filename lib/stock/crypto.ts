// ESTOQUE FASE 0 (19/08/2026) — cifra do certificado A1.
//
// O .pfx e a senha do certificado são dados SENSÍVEIS: quem tem o .pfx + a senha
// fala com a SEFAZ COMO a empresa. Guardamos CIFRADOS (AES-256-GCM autenticado), com
// a chave FORA do banco (env STOCK_CERT_ENC_KEY). NUNCA em texto, NUNCA em log.
//
// Formato do ciphertext: "v1:<iv b64>:<authTag b64>:<ciphertext b64>". A versão no
// prefixo permite trocar de algoritmo/chave depois sem ambiguidade.
//
// ⚠️ DÉBITOS REGISTRADOS (decisão do dono, 19/08 — servidor único hoje):
//  1) A chave em STOCK_CERT_ENC_KEY (.env) é aceitável AGORA (1 servidor). Quando o
//     CAIXAOS tiver mais clientes, a chave sai do .env pra um COFRE (KMS/Vault) ou
//     vira chave POR EMPRESA derivada de uma mestra. Não é urgente; é dívida sabida.
//  2) Se a chave for PERDIDA ou TROCADA, o .pfx cifrado vira lixo irrecuperável — e
//     isso é ACEITÁVEL: o original é do dono, ele sobe de novo. A tela diz isso quando
//     não decifrar (nunca "erro genérico"), e o juiz E12 alerta. NUNCA falha em
//     silêncio — decifrar quebrado = certificado INVÁLIDO visível, não sumiço mudo.

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

const ALGO = 'aes-256-gcm'
const PREFIX = 'v1'

/** Deriva a chave de 32 bytes da env (scrypt — sal fixo do domínio; a entropia vem
 *  da env, que é um segredo longo). Lança se a env faltar (nunca cifra com chave vazia). */
function key(): Buffer {
  const secret = process.env.STOCK_CERT_ENC_KEY
  if (!secret || secret.length < 16) {
    throw new StockCryptoError(
      'STOCK_CERT_ENC_KEY ausente ou curta (< 16 chars). O certificado não pode ser cifrado/decifrado sem ela. Configure a env antes de subir certificado.',
    )
  }
  return scryptSync(secret, 'conta-ia:stock-cert:v1', 32)
}

export class StockCryptoError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StockCryptoError'
  }
}

/** Cifra um buffer/string → "v1:iv:tag:ct" (base64). Determinístico NÃO (IV aleatório). */
export function encryptSecret(plain: Buffer | string): string {
  const iv = randomBytes(12) // 96-bit nonce recomendado pro GCM
  const cipher = createCipheriv(ALGO, key(), iv)
  const pt = typeof plain === 'string' ? Buffer.from(plain, 'utf8') : plain
  const ct = Buffer.concat([cipher.update(pt), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`
}

/** Decifra "v1:iv:tag:ct" → Buffer. Lança StockCryptoError se o formato/tag não
 *  bater (chave errada, dado corrompido) — o caller trata como "certificado inválido,
 *  suba de novo", NUNCA engole. */
export function decryptSecret(payload: string): Buffer {
  const parts = payload.split(':')
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    throw new StockCryptoError('Formato de segredo cifrado inválido (esperado v1:iv:tag:ct).')
  }
  const [, ivB64, tagB64, ctB64] = parts
  try {
    const decipher = createDecipheriv(ALGO, key(), Buffer.from(ivB64, 'base64'))
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()])
  } catch {
    // tag não confere = chave trocada/perdida OU dado corrompido. Mensagem acionável.
    throw new StockCryptoError(
      'Não consegui decifrar o certificado (chave de cifra mudou ou o dado foi corrompido). ' +
        'O .pfx original é seu — suba o certificado de novo. (Nunca falha em silêncio.)',
    )
  }
}

/** Decifra pra string utf8 (senha). */
export function decryptSecretToString(payload: string): string {
  return decryptSecret(payload).toString('utf8')
}
