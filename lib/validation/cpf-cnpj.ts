// Sprint Asaas 3B (31/05/2026) — Validação CPF/CNPJ.
// Algoritmo Mod 11 padrão Receita Federal. Sem deps.
// 100% puro, testável.

/** Remove tudo que não é dígito. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

/** Calcula dígito verificador Mod 11 sobre os primeiros N dígitos. */
function calcMod11(digits: string, weights: number[]): number {
  let sum = 0
  for (let i = 0; i < weights.length; i++) {
    sum += parseInt(digits[i], 10) * weights[i]
  }
  const remainder = sum % 11
  return remainder < 2 ? 0 : 11 - remainder
}

/** CPF: 11 dígitos, mod 11 nos primeiros 9 (DV1) e 10 (DV2). */
export function isValidCpf(input: string): boolean {
  const cpf = onlyDigits(input)
  if (cpf.length !== 11) return false
  // Rejeita sequências repetidas (11111111111, 22222222222, etc)
  if (/^(\d)\1{10}$/.test(cpf)) return false

  const w1 = [10, 9, 8, 7, 6, 5, 4, 3, 2]
  const w2 = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]
  const dv1 = calcMod11(cpf, w1)
  const dv2 = calcMod11(cpf, w2)
  return dv1 === parseInt(cpf[9], 10) && dv2 === parseInt(cpf[10], 10)
}

/** CNPJ: 14 dígitos, mod 11 com pesos específicos. */
export function isValidCnpj(input: string): boolean {
  const cnpj = onlyDigits(input)
  if (cnpj.length !== 14) return false
  if (/^(\d)\1{13}$/.test(cnpj)) return false

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const dv1 = calcMod11(cnpj, w1)
  const dv2 = calcMod11(cnpj, w2)
  return dv1 === parseInt(cnpj[12], 10) && dv2 === parseInt(cnpj[13], 10)
}

/** True se for CPF OU CNPJ válido. */
export function isValidCpfCnpj(input: string): boolean {
  const digits = onlyDigits(input)
  return digits.length === 11 ? isValidCpf(digits) : isValidCnpj(digits)
}
