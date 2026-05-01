// Helpers de detecção de banco a partir de arquivos OFX.
// A lista canônica vive em `lib/bancos.ts` — este módulo só adiciona a lógica
// específica do contexto OFX (mapear BANKID → banco e comparar com o cadastro).

import { Banco, findBancoByCodigo, normalizarCodigoBanco } from '@/lib/bancos'

// Re-exporta utilitários genéricos para conveniência de quem importa daqui.
export { normalizarCodigoBanco }
export type { Banco }

// Detecta o banco a partir do BANKID extraído do OFX.
// Retorna null se o código não for reconhecido na lista canônica.
export function detectarBanco(bankId: string | null | undefined): Banco | null {
  return findBancoByCodigo(bankId)
}

// Retorna se o banco detectado bate com o cadastro da conta.
// null = conta sem banco cadastrado (não há o que comparar)
// true = bate por código ou por nome (case-insensitive, contains)
// false = não bate
export function bateComPerfilDaConta(
  conta: { bankName: string | null; bankCode: string | null },
  banco: Banco,
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
