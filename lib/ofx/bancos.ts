// Mapa de códigos FEBRABAN (BANKID no OFX) para nome do banco.
// Cobre os principais bancos brasileiros usados pelas empresas-alvo do Conta IA.

const BANCOS_FEBRABAN: Record<string, string> = {
  '001': 'Banco do Brasil',
  '033': 'Santander',
  '041': 'Banrisul',
  '077': 'Inter',
  '104': 'Caixa Econômica Federal',
  '208': 'BTG Pactual',
  '237': 'Bradesco',
  '260': 'Nubank',
  '290': 'PagSeguro',
  '323': 'Mercado Pago',
  '336': 'C6 Bank',
  '341': 'Itaú',
  '422': 'Safra',
  '748': 'Sicredi',
  '756': 'Sicoob',
}

export interface BancoDetectado {
  codigo: string
  nome: string
}

// Normaliza BANKID em código FEBRABAN de 3 dígitos (ex: "0341" → "341", "41" → "041").
export function normalizarCodigoBanco(bankId: string | null | undefined): string | null {
  if (!bankId) return null
  const limpo = bankId.trim()
  if (!limpo || !/^\d+$/.test(limpo)) return null
  return limpo.padStart(3, '0').slice(-3)
}

export function detectarBanco(bankId: string | null | undefined): BancoDetectado | null {
  const codigo = normalizarCodigoBanco(bankId)
  if (!codigo) return null
  const nome = BANCOS_FEBRABAN[codigo]
  if (!nome) return null
  return { codigo, nome }
}

// Retorna se o banco detectado bate com o cadastro da conta.
// null = conta sem banco cadastrado (não há o que comparar)
// true = bate por código ou por nome (case-insensitive, contains)
// false = não bate
export function bateComPerfilDaConta(
  conta: { bankName: string | null; bankCode: string | null },
  banco: BancoDetectado,
): boolean | null {
  if (conta.bankCode) {
    const codigoCadastrado = normalizarCodigoBanco(conta.bankCode)
    if (codigoCadastrado) return codigoCadastrado === banco.codigo
  }
  if (conta.bankName) {
    const cadastrado = conta.bankName.toLowerCase().trim()
    const detectado = banco.nome.toLowerCase()
    if (!cadastrado) return null
    return cadastrado.includes(detectado) || detectado.includes(cadastrado)
  }
  return null
}
