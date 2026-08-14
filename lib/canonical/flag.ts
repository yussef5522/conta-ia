// Sprint Wiring-do-Juiz (14/08) — flag do JUIZ (canônico → saldoAntes → LEDGERBAL).
// OFF = pipeline legado (partitionFutureLines + heurística FITID) intocado = ROLLBACK.
// ON = a decisão única do que importa é o LEDGERBAL (FITID não decide status → a
// parcela paga não é mais descartada; a tela e o confirm classificam IGUAL).
//
// ROLLOUT PER BANK (o shadow de 14/08 exigiu): a flag mestra liga o juiz, mas ele
// só ENGATA nos bancos PROVADOS no shadow. Banrisul(041) está provado (o reimport
// do 13/08 fecha gap=0). Sicredi(748) tem um -0.57 sistemático a investigar e Stone
// tem downloads conflitantes do mesmo dia — enquanto não provados, seguem no LEGADO
// mesmo com a flag ON. "Provar por banco, ligar por banco" — nunca ligar no escuro.
//
// Allowlist via env `CANONICAL_CLASSIFY_BANKS` (bankCodes separados por vírgula);
// default '041' (Banrisul). Banco fora da lista → false (legado), mesmo com a flag ON.

function masterEnabled(): boolean {
  return (
    process.env.CANONICAL_CLASSIFY_ENABLED === 'true' ||
    process.env.CANONICAL_CLASSIFY_ENABLED === '1'
  )
}

/** Bancos provados (default Banrisul). Env sobrescreve pra adicionar sem deploy. */
function provenBanks(): Set<string> {
  const raw = process.env.CANONICAL_CLASSIFY_BANKS?.trim()
  const list = raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : ['041']
  return new Set(list)
}

/** Master switch cru — usado só onde não há bankId (não deve gatear import). */
export function isCanonicalClassifyEnabled(): boolean {
  return masterEnabled()
}

/**
 * O gate REAL do import: liga o juiz SÓ se a flag mestra está ON E o banco do
 * arquivo está na allowlist de provados. bankId ausente/desconhecido → false
 * (nunca liga no escuro num banco não identificado).
 */
export function isCanonicalClassifyEnabledForBank(bankId: string | null | undefined): boolean {
  if (!masterEnabled()) return false
  if (!bankId) return false
  return provenBanks().has(bankId.trim())
}
