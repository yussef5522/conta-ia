import { z } from 'zod'

function validarCNPJ(cnpj: string): boolean {
  const nums = cnpj.replace(/\D/g, '')
  if (nums.length !== 14) return false
  if (/^(\d)\1+$/.test(nums)) return false

  const calcDigit = (nums: string, length: number): number => {
    let sum = 0
    let pos = length - 7
    for (let i = length; i >= 1; i--) {
      sum += parseInt(nums[length - i]) * pos--
      if (pos < 2) pos = 9
    }
    return sum % 11 < 2 ? 0 : 11 - (sum % 11)
  }

  return (
    parseInt(nums[12]) === calcDigit(nums, 12) &&
    parseInt(nums[13]) === calcDigit(nums, 13)
  )
}

export const TIPOS_EMPRESA = [
  'SERVICE',
  'RETAIL',
  'RESTAURANT',
  'INDUSTRY',
  'MIXED',
  'OTHER',
] as const

// Sprint 5.0.2.l — Setor normalizado pra Knowledge Base SetorPattern.
// Valores devem casar com prisma/seeds/setor-patterns.ts > SetorEnum.
export const SETORES_KB = [
  'RESTAURANTE',
  'ACADEMIA',
  'COMERCIO_ROUPA',
  'VAREJO_GERAL',
] as const

export type SetorKB = (typeof SETORES_KB)[number]

export const REGIMES_TRIBUTARIOS = [
  'SIMPLES_NACIONAL',
  'LUCRO_PRESUMIDO',
  'LUCRO_REAL',
  'MEI',
] as const

export type TipoEmpresa = (typeof TIPOS_EMPRESA)[number]
export type RegimeTributario = (typeof REGIMES_TRIBUTARIOS)[number]

export const empresaSchema = z.object({
  cnpj: z
    .string({ required_error: 'CNPJ é obrigatório' })
    .min(1, 'CNPJ é obrigatório')
    .refine((val) => validarCNPJ(val), { message: 'CNPJ inválido' }),
  name: z
    .string({ required_error: 'Razão social é obrigatória' })
    .min(2, 'Razão social deve ter pelo menos 2 caracteres')
    .max(150, 'Razão social muito longa'),
  tradeName: z.string().max(150, 'Nome fantasia muito longo').optional().or(z.literal('')),
  type: z.enum(TIPOS_EMPRESA, { required_error: 'Setor é obrigatório' }),
  // Sprint 5.0.2.l — Setor normalizado pra KB de padrões. Opcional pra
  // empresas legado; novas empresas escolhem no form.
  setor: z.enum(SETORES_KB).optional().nullable().or(z.literal('')),
  taxRegime: z.enum(REGIMES_TRIBUTARIOS, { required_error: 'Regime tributário é obrigatório' }),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  phone: z.string().max(20).optional().or(z.literal('')),
  address: z.string().max(200).optional().or(z.literal('')),
  city: z.string().max(100).optional().or(z.literal('')),
  state: z.string().max(2).optional().or(z.literal('')),
  zipCode: z.string().max(9).optional().or(z.literal('')),
})

export type EmpresaInput = z.infer<typeof empresaSchema>
