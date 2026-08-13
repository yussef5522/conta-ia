// Sprint Rearquitetura-Import FASE 4 (13/08) — flag da CAMADA 1 (classificação
// por tradutor de banco). OFF = pipeline atual (partitionFutureLines + heurística
// FITID) intocado, é o ROLLBACK. ON = classifica pelo canônico (FITID não decide
// status → a parcela paga não é mais descartada).
//
// Só a Camada 1 (classificar EFETIVADA vs futuro). O JUIZ (Camada 2, LEDGERBAL
// bidirecional) NÃO entra aqui — fica pra quando o saldoAntes estiver resolvido.

export function isCanonicalClassifyEnabled(): boolean {
  return (
    process.env.CANONICAL_CLASSIFY_ENABLED === 'true' ||
    process.env.CANONICAL_CLASSIFY_ENABLED === '1'
  )
}
