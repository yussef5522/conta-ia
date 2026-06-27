// Sprint OFX V3 Premium (27/06/2026) — flag pra rollback rápido.
//
// Quando OFX_IMPORT_V3_ENABLED=true (default false), a tela de import OFX
// usa PreviewV3Premium com seletor de tipo, edicao inline, IA explica.
// Quando false, mantém o componente PreviewV2Classificado intacto.

export interface OfxV3FlagEnv {
  OFX_IMPORT_V3_ENABLED?: string
}

export function isOfxImportV3Enabled(
  env: OfxV3FlagEnv = process.env as OfxV3FlagEnv,
): boolean {
  return (env.OFX_IMPORT_V3_ENABLED ?? '').trim().toLowerCase() === 'true'
}
