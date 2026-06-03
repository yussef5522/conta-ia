// Sprint PF Fatia 3.5 — Feature flag pra liberar PDF import por ambiente.
//
// 🚨 GATE DE PRODUÇÃO: PDF de cliente real EM PROD só roda quando:
//   1. PDF_IMPORT_ENABLED === 'true'   (toggle global)
//   2. PDF_IMPORT_ZDR_CONFIRMED === 'true' (Yussef confirmou ZDR Anthropic)
//
// Em DEV/SANDBOX (NODE_ENV !== 'production'), ignora ZDR (testes locais OK).
// Em PROD, exige AMBOS = 'true' — falta um e o endpoint retorna 403.
//
// Variáveis:
//   PDF_IMPORT_ENABLED         — 'true' libera; default 'false' (closed by default)
//   PDF_IMPORT_ZDR_CONFIRMED   — 'true' libera em prod; default 'false'
//
// FUNÇÃO PURA — testável injetando env.

export type PdfImportStatus =
  | { allowed: true }
  | { allowed: false; reason: 'DISABLED' | 'ZDR_NOT_CONFIRMED'; message: string }

export interface FeatureFlagEnv {
  NODE_ENV?: string
  PDF_IMPORT_ENABLED?: string
  PDF_IMPORT_ZDR_CONFIRMED?: string
}

export function checkPdfImportFlag(
  env: FeatureFlagEnv = process.env,
): PdfImportStatus {
  const enabled = (env.PDF_IMPORT_ENABLED ?? '').trim().toLowerCase() === 'true'
  if (!enabled) {
    return {
      allowed: false,
      reason: 'DISABLED',
      message:
        'Import de PDF está temporariamente desligado. Use OFX (Nubank, Itaú, etc).',
    }
  }
  // Em prod, exige ZDR confirmado
  const isProd = (env.NODE_ENV ?? '').toLowerCase() === 'production'
  if (isProd) {
    const zdr =
      (env.PDF_IMPORT_ZDR_CONFIRMED ?? '').trim().toLowerCase() === 'true'
    if (!zdr) {
      return {
        allowed: false,
        reason: 'ZDR_NOT_CONFIRMED',
        message:
          'Import de PDF aguarda confirmação de Zero Data Retention com a Anthropic. Use OFX por enquanto.',
      }
    }
  }
  return { allowed: true }
}

export function isPdfImportEnabled(env: FeatureFlagEnv = process.env): boolean {
  return checkPdfImportFlag(env).allowed
}
