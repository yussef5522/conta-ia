// ⭐ R63 — AGENDA NÃO PULA CONTRATO EM SILÊNCIO (25/11/2026, lei docs/emprestimos-referencia.html).
//
// ⛔ O importar agenda casava o PDF com os contratos cadastrados e, quando não achava, **pulava**:
// o preview dizia "cadastre antes" (sem caminho) e o confirm devolvia o contrato em `skipped` —
// que a tela NÃO desenhava. Agora o contrato desconhecido vira uma OFERTA de cadastro, com o nº
// e o banco do documento pré-preenchidos. As duas pontas (o link e a leitura dele no formulário)
// moram AQUI, num lugar só: o nome do parâmetro não tem como divergir entre quem manda e quem lê.

export interface ContratoDesconhecido {
  contractNumber: string
  banco: string | null
  valorFinanciado: number | null
  numParcelas: number | null
}

const P = { contrato: 'contrato', banco: 'banco', financiado: 'financiado', parcelas: 'parcelas' } as const

/** o link "cadastrar agora →" — para o formulário de novo contrato, já preenchido */
export function hrefCadastrarNaHora(empresaId: string, c: ContratoDesconhecido): string {
  const q = new URLSearchParams()
  q.set(P.contrato, c.contractNumber)
  if (c.banco) q.set(P.banco, c.banco)
  if (c.valorFinanciado != null && c.valorFinanciado > 0) q.set(P.financiado, String(c.valorFinanciado))
  if (c.numParcelas != null && c.numParcelas > 0) q.set(P.parcelas, String(c.numParcelas))
  return `/empresas/${empresaId}/emprestimos/novo?${q.toString()}`
}

/**
 * o que o formulário pré-preenche a partir do link. ⚠️ Só o que o DOCUMENTO declarou — nunca um
 * valor inventado (taxa, sistema e datas o dono preenche: "heurística sugere, nunca decide").
 */
export function prefillDoCadastro(sp: { get(k: string): string | null }): {
  contractNumber?: string; lender?: string; principal?: string; termMonths?: string
} {
  const out: { contractNumber?: string; lender?: string; principal?: string; termMonths?: string } = {}
  const contrato = sp.get(P.contrato)?.trim()
  if (contrato) out.contractNumber = contrato
  const banco = sp.get(P.banco)?.trim()
  if (banco) out.lender = banco
  const fin = Number(sp.get(P.financiado))
  if (Number.isFinite(fin) && fin > 0) out.principal = String(fin)
  const n = Number(sp.get(P.parcelas))
  if (Number.isInteger(n) && n > 0) out.termMonths = String(n)
  return out
}
