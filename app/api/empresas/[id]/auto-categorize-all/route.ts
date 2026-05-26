// Sprint 5.0.2.l — Alias canônico de POST /api/empresas/[id]/recategorize-all.
// Re-exporta o mesmo handler. Nome novo é mais descritivo do propósito
// (auto-categorize ALL pendentes via pipeline 5 fases) e foi solicitado
// pelo Yussef como nome canônico daqui pra frente.

export { POST } from '../recategorize-all/route'
