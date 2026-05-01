// Lista canônica de bancos brasileiros suportados pelo Conta IA.
// FONTE ÚNICA — qualquer outra parte do código (form de cadastro, detecção OFX,
// futuras telas de fornecedores etc.) deve consumir desta lista.
//
// Ordenada alfabeticamente por nome para uso direto em dropdowns.

export interface Banco {
  codigo: string // código FEBRABAN de 3 dígitos
  nome: string
}

export const BANCOS_BR: ReadonlyArray<Banco> = [
  { codigo: '001', nome: 'Banco do Brasil' },
  { codigo: '041', nome: 'Banrisul' },
  { codigo: '237', nome: 'Bradesco' },
  { codigo: '208', nome: 'BTG Pactual' },
  { codigo: '336', nome: 'C6 Bank' },
  { codigo: '104', nome: 'Caixa Econômica Federal' },
  { codigo: '077', nome: 'Inter' },
  { codigo: '341', nome: 'Itaú' },
  { codigo: '323', nome: 'Mercado Pago' },
  { codigo: '260', nome: 'Nubank' },
  { codigo: '290', nome: 'PagBank' },
  { codigo: '422', nome: 'Safra' },
  { codigo: '033', nome: 'Santander' },
  { codigo: '756', nome: 'Sicoob' },
  { codigo: '748', nome: 'Sicredi' },
] as const

// Normaliza um BANKID em código FEBRABAN de 3 dígitos.
// Aceita variações como "0341" → "341", "41" → "041", "  341  " → "341".
// Retorna null se a entrada for vazia ou não-numérica.
export function normalizarCodigoBanco(bankId: string | null | undefined): string | null {
  if (!bankId) return null
  const limpo = bankId.trim()
  if (!limpo || !/^\d+$/.test(limpo)) return null
  return limpo.padStart(3, '0').slice(-3)
}

// Procura um banco pelo código FEBRABAN. Aceita códigos não normalizados.
export function findBancoByCodigo(codigo: string | null | undefined): Banco | null {
  const normalizado = normalizarCodigoBanco(codigo)
  if (!normalizado) return null
  return BANCOS_BR.find((b) => b.codigo === normalizado) ?? null
}
