import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type UserCompany = {
  userId: string
  companyId: string
}

type ContaBancariaData = {
  name: string
  bankName?: string
  accountType: string
  balance?: unknown
}

type ValidationResult =
  | { success: true; data: { name: string; bankName?: string; accountType: AccountType; balance: number } }
  | { success: false; errors: string[] }

type AccountType = 'CHECKING' | 'SAVINGS' | 'INVESTMENT'

// ---------------------------------------------------------------------------
// Implementações inline (self-contained, sem importações externas)
// ---------------------------------------------------------------------------

/**
 * Verifica se um usuário tem acesso a uma empresa.
 * Regra de isolamento multi-tenant: um usuário só pode operar sobre
 * empresas às quais está vinculado na tabela user_companies.
 */
function pertenceAoUsuario(
  userId: string,
  companyId: string,
  userCompanies: UserCompany[]
): boolean {
  return userCompanies.some(
    (uc) => uc.userId === userId && uc.companyId === companyId
  )
}

/**
 * Valida os dados de entrada para criação/atualização de uma conta bancária.
 * Retorna um objeto com { success, data } ou { success, errors }.
 */
function validarContaBancaria(data: ContaBancariaData): ValidationResult {
  const TIPOS_VALIDOS: AccountType[] = ['CHECKING', 'SAVINGS', 'INVESTMENT']
  const errors: string[] = []

  // Validação do nome (obrigatório, mínimo 2 caracteres)
  if (!data.name || data.name.trim().length < 2) {
    errors.push('O nome da conta é obrigatório e deve ter pelo menos 2 caracteres.')
  }

  // Validação do tipo de conta (deve ser um dos valores permitidos)
  if (!TIPOS_VALIDOS.includes(data.accountType as AccountType)) {
    errors.push(`Tipo de conta inválido. Use: ${TIPOS_VALIDOS.join(', ')}.`)
  }

  // Validação do saldo: deve ser numérico quando fornecido
  const balanceRaw = data.balance
  const balanceValor =
    balanceRaw === undefined || balanceRaw === null ? 0 : balanceRaw

  if (typeof balanceValor !== 'number' || isNaN(balanceValor)) {
    errors.push('O saldo deve ser um número válido.')
  }

  if (errors.length > 0) {
    return { success: false, errors }
  }

  return {
    success: true,
    data: {
      name: data.name.trim(),
      ...(data.bankName !== undefined ? { bankName: data.bankName } : {}),
      accountType: data.accountType as AccountType,
      balance: typeof balanceValor === 'number' ? balanceValor : 0,
    },
  }
}

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe('pertenceAoUsuario', () => {
  const userCompanies: UserCompany[] = [
    { userId: 'user-1', companyId: 'empresa-A' },
    { userId: 'user-1', companyId: 'empresa-B' },
    { userId: 'user-2', companyId: 'empresa-C' },
  ]

  it('retorna true quando o usuário tem acesso à empresa', () => {
    expect(pertenceAoUsuario('user-1', 'empresa-A', userCompanies)).toBe(true)
  })

  it('retorna true para segunda empresa do mesmo usuário', () => {
    expect(pertenceAoUsuario('user-1', 'empresa-B', userCompanies)).toBe(true)
  })

  it('retorna false quando o usuário não tem acesso à empresa', () => {
    // user-2 não tem vínculo com empresa-A
    expect(pertenceAoUsuario('user-2', 'empresa-A', userCompanies)).toBe(false)
  })

  it('retorna false quando o userId não existe na lista', () => {
    expect(pertenceAoUsuario('user-999', 'empresa-A', userCompanies)).toBe(false)
  })

  it('retorna false quando a lista de vínculos está vazia', () => {
    expect(pertenceAoUsuario('user-1', 'empresa-A', [])).toBe(false)
  })

  it('não vaza acesso entre empresas de usuários diferentes', () => {
    // Garante que user-2 não acessa as empresas de user-1 e vice-versa
    expect(pertenceAoUsuario('user-2', 'empresa-B', userCompanies)).toBe(false)
    expect(pertenceAoUsuario('user-1', 'empresa-C', userCompanies)).toBe(false)
  })
})

describe('validarContaBancaria', () => {
  const dadosValidos: ContaBancariaData = {
    name: 'Conta Corrente Principal',
    bankName: 'Banco do Brasil',
    accountType: 'CHECKING',
    balance: 1500.75,
  }

  it('aceita dados completamente válidos', () => {
    const result = validarContaBancaria(dadosValidos)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Conta Corrente Principal')
      expect(result.data.bankName).toBe('Banco do Brasil')
      expect(result.data.accountType).toBe('CHECKING')
      expect(result.data.balance).toBe(1500.75)
    }
  })

  it('aceita tipo SAVINGS', () => {
    const result = validarContaBancaria({ ...dadosValidos, accountType: 'SAVINGS' })
    expect(result.success).toBe(true)
  })

  it('aceita tipo INVESTMENT', () => {
    const result = validarContaBancaria({ ...dadosValidos, accountType: 'INVESTMENT' })
    expect(result.success).toBe(true)
  })

  it('aceita bankName ausente (campo opcional)', () => {
    const { bankName: _omitido, ...semBanco } = dadosValidos
    const result = validarContaBancaria(semBanco)
    expect(result.success).toBe(true)
  })

  it('usa saldo 0 quando balance não é informado', () => {
    const { balance: _omitido, ...semBalance } = dadosValidos
    const result = validarContaBancaria(semBalance)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.balance).toBe(0)
    }
  })

  it('falha quando o nome está vazio', () => {
    const result = validarContaBancaria({ ...dadosValidos, name: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0)
    }
  })

  it('falha quando o nome tem apenas 1 caractere (mínimo é 2)', () => {
    const result = validarContaBancaria({ ...dadosValidos, name: 'X' })
    expect(result.success).toBe(false)
  })

  it('falha quando o nome é só espaços em branco', () => {
    const result = validarContaBancaria({ ...dadosValidos, name: '   ' })
    expect(result.success).toBe(false)
  })

  it('falha quando o tipo de conta é inválido', () => {
    const result = validarContaBancaria({ ...dadosValidos, accountType: 'CORRENTE' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors.some((e) => e.includes('CHECKING'))).toBe(true)
    }
  })

  it('falha quando o tipo de conta está em minúsculas', () => {
    // A validação é case-sensitive — o enum exige maiúsculas
    const result = validarContaBancaria({ ...dadosValidos, accountType: 'checking' })
    expect(result.success).toBe(false)
  })

  it('aceita balance negativo (conta no vermelho é válida)', () => {
    const result = validarContaBancaria({ ...dadosValidos, balance: -200 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.balance).toBe(-200)
    }
  })

  it('aceita balance zero', () => {
    const result = validarContaBancaria({ ...dadosValidos, balance: 0 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.balance).toBe(0)
    }
  })

  it('falha quando balance é a string "abc"', () => {
    const result = validarContaBancaria({ ...dadosValidos, balance: 'abc' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors.some((e) => e.includes('número'))).toBe(true)
    }
  })

  it('falha quando balance é uma string numérica como "100"', () => {
    // Strings numéricas também são rejeitadas — o campo deve ser number
    const result = validarContaBancaria({ ...dadosValidos, balance: '100' })
    expect(result.success).toBe(false)
  })

  it('remove espaços extras do nome ao retornar os dados válidos', () => {
    const result = validarContaBancaria({ ...dadosValidos, name: '  Conta Poupança  ' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Conta Poupança')
    }
  })

  it('acumula múltiplos erros quando nome e tipo são inválidos ao mesmo tempo', () => {
    const result = validarContaBancaria({ name: '', accountType: 'INVALIDO', balance: 0 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThanOrEqual(2)
    }
  })
})
