// Validação client-side do form de login — Sprint 1.2.
// Função PURA, testável sem React/JSDom.

export interface LoginFormErrors {
  email?: string
  password?: string
}

export interface LoginFormValues {
  email: string
  password: string
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const PASSWORD_MIN_LENGTH = 6

export function validateLoginForm(values: LoginFormValues): LoginFormErrors {
  const errors: LoginFormErrors = {}

  if (!values.email.trim()) {
    errors.email = 'Informe seu e-mail'
  } else if (!EMAIL_REGEX.test(values.email.trim())) {
    errors.email = 'E-mail inválido'
  }

  if (!values.password) {
    errors.password = 'Informe sua senha'
  } else if (values.password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `Senha precisa ter ao menos ${PASSWORD_MIN_LENGTH} caracteres`
  }

  return errors
}

export function isLoginFormValid(values: LoginFormValues): boolean {
  return Object.keys(validateLoginForm(values)).length === 0
}
