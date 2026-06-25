// Sprint PDF Extrato Bancário (24/06/2026) — gate específico.
//
// Diferente do PDF de fatura cartão (PF Fatia 3.5), extrato bancário PJ:
// - Não tem dado sensível tipo cartão de crédito
// - É business data do owner do CNPJ
// - Não requer ZDR formal (mas continua opt-in via env var)
//
// Em prod: PDF_BANK_STATEMENT_ENABLED=true libera.
// Em dev/test: liberado por padrão (NODE_ENV !== production OU flag true).

export interface PdfBankStatementFlagEnv {
  NODE_ENV?: string
  PDF_BANK_STATEMENT_ENABLED?: string
}

export interface PdfBankStatementFlagResult {
  allowed: boolean
  reason: 'OK' | 'DISABLED'
  message: string | null
}

export function checkPdfBankStatementFlag(
  env: PdfBankStatementFlagEnv = process.env as PdfBankStatementFlagEnv,
): PdfBankStatementFlagResult {
  const enabled = (env.PDF_BANK_STATEMENT_ENABLED ?? '').trim().toLowerCase() === 'true'
  if (enabled) return { allowed: true, reason: 'OK', message: null }

  return {
    allowed: false,
    reason: 'DISABLED',
    message: 'Importação de extrato bancário por PDF não está ativada. Defina PDF_BANK_STATEMENT_ENABLED=true no .env e recarregue o servidor.',
  }
}

export function isPdfBankStatementEnabled(env?: PdfBankStatementFlagEnv): boolean {
  return checkPdfBankStatementFlag(env).allowed
}
