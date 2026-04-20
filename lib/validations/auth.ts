import { z } from 'zod'

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'E-mail é obrigatório' })
    .email('E-mail inválido')
    .toLowerCase(),
  password: z
    .string({ required_error: 'Senha é obrigatória' })
    .min(1, 'Senha é obrigatória'),
})

export const cadastroSchema = z
  .object({
    name: z
      .string({ required_error: 'Nome é obrigatório' })
      .min(2, 'Nome deve ter pelo menos 2 caracteres')
      .max(100, 'Nome muito longo'),
    email: z
      .string({ required_error: 'E-mail é obrigatório' })
      .email('E-mail inválido')
      .toLowerCase(),
    password: z
      .string({ required_error: 'Senha é obrigatória' })
      .min(8, 'Senha deve ter pelo menos 8 caracteres')
      .regex(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiúscula')
      .regex(/[0-9]/, 'Senha deve conter pelo menos um número'),
    confirmPassword: z.string({ required_error: 'Confirmação de senha é obrigatória' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  })

export type LoginInput = z.infer<typeof loginSchema>
export type CadastroInput = z.infer<typeof cadastroSchema>
