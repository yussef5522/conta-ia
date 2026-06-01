// Sprint Gestão de Conta (31/05/2026) — Gerador de senha temporária.
//
// Padrão Google/Microsoft: 16 caracteres alfanuméricos + símbolos seguros.
// Crypto-secure via Node `crypto.randomBytes`. Garante pelo menos 1
// uppercase + 1 lowercase + 1 digit + 1 símbolo (atende checkPasswordStrength).

import { randomBytes } from 'node:crypto'

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // sem I e O (confusão visual)
const LOWER = 'abcdefghjkmnpqrstuvwxyz' // sem i, l, o
const DIGITS = '23456789' // sem 0, 1 (confusão)
const SYMBOLS = '!@#$%&*+-=?' // visíveis e copiáveis facilmente

const ALL = UPPER + LOWER + DIGITS + SYMBOLS

function pickFrom(set: string, bytes: Buffer, idx: number): string {
  return set[bytes[idx] % set.length]
}

/** Gera senha temp de 16 chars com garantia de 4 classes presentes. */
export function generateTempPassword(length = 16): string {
  if (length < 12) throw new Error('Senha temporária deve ter ao menos 12 chars')

  // Buffer maior pra ter entropia sobrando
  const bytes = randomBytes(length * 2)

  // Garante 1 char de cada classe nos primeiros 4 slots
  const chars: string[] = [
    pickFrom(UPPER, bytes, 0),
    pickFrom(LOWER, bytes, 1),
    pickFrom(DIGITS, bytes, 2),
    pickFrom(SYMBOLS, bytes, 3),
  ]

  // Preenche o resto sorteando do conjunto total
  for (let i = 4; i < length; i++) {
    chars.push(pickFrom(ALL, bytes, i))
  }

  // Shuffle Fisher-Yates usando bytes restantes
  for (let i = chars.length - 1; i > 0; i--) {
    const j = bytes[length + i] % (i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }

  return chars.join('')
}
