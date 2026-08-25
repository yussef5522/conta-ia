// Sprint Fase 3 CAMADA 3 (16/08/2026) — e-mail do juiz noturno, SÓ na falha.
// Traz o DETALHE (empresa, invariante, contrato, saldo esperado vs real) + link
// direto pra /juiz — não "houve uma falha, veja o painel". Função pura (testável).

export interface JudgeAlertInput {
  /** INFRA (25/08) — checks de máquina (swap/memória). O juiz olhava dinheiro e estoque;
   *  a máquina embaixo deles era ponto cego até o OOM derrubar o build. */
  infraChecks?: { invariante: string; nivel: string; detalhe: string }[]
  runAt: Date
  totalContracts: number
  totalFail: number
  balanceIssues: number
  dupIssues?: number
  byCompany: { name: string; contracts: number; fails: { contract: string; fails: string[] }[] }[]
  sharedTx: { txId: string; parcelas: string[] }[]
  balanceChecks: { name: string; stored: number; recomputed: number; delta: number }[]
  dupStableKey?: { accountName: string; stableKey: string; txIds: string[]; date: string; amount: number; memo: string }[]
  vendaChecks?: { invariante: string; companyName: string; detalhe: string }[]
  cardChecks?: { invariante: string; companyName: string; detalhe: string }[]
  stockChecks?: { invariante: string; companyId: string | null; detalhe: string }[]
  juizUrl: string
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function buildJudgeAlertEmail(i: JudgeAlertInput): { subject: string; html: string } {
  const nFalhas = i.totalFail + i.sharedTx.length + i.balanceIssues + (i.dupIssues ?? 0) + (i.vendaChecks?.length ?? 0) + (i.cardChecks?.length ?? 0) + (i.stockChecks?.length ?? 0) + (i.infraChecks?.length ?? 0)
  const subject = `🔴 Juiz de módulo: ${nFalhas} falha${nFalhas === 1 ? '' : 's'} (${i.runAt.toLocaleDateString('pt-BR')})`

  const linhas: string[] = []
  for (const c of i.byCompany) {
    for (const f of c.fails) {
      linhas.push(`<li><b>${c.name}</b> · contrato <code>${f.contract}</code> → <b style="color:#b91c1c">${f.fails.join(', ')}</b></li>`)
    }
  }
  for (const n of i.infraChecks ?? []) {
    const cor = n.nivel === 'aviso' ? '#b45309' : '#b91c1c'
    linhas.push(`<li><b>🖥️ ${n.invariante} servidor</b> → <span style="color:${cor}">${n.detalhe}</span></li>`)
  }
  for (const s of i.sharedTx) {
    linhas.push(`<li><b>I6 tx compartilhada</b> → ${s.parcelas.join(' + ')} (juros contado 2×)</li>`)
  }
  for (const b of i.balanceChecks) {
    linhas.push(`<li><b>I9 saldo ≠ Σtx</b> · ${b.name} → gravado <b>${brl(b.stored)}</b> vs recalculado <b>${brl(b.recomputed)}</b> (diferença <b style="color:#b91c1c">${brl(b.delta)}</b>)</li>`)
  }
  for (const d of i.dupStableKey ?? []) {
    linhas.push(`<li><b>I10 duplicata de tx</b> · ${d.accountName} → ${d.date} ${brl(d.amount)} <code>${d.memo}</code> criada ${d.txIds.length}× (mesma linha, imports diferentes): <code>${d.txIds.join(', ')}</code></li>`)
  }
  for (const v of i.vendaChecks ?? []) {
    linhas.push(`<li><b>Venda ${v.invariante}</b> · ${v.companyName} → ${v.detalhe}</li>`)
  }
  for (const c of i.cardChecks ?? []) {
    linhas.push(`<li><b>Cartão ${c.invariante}</b> · ${c.companyName} → ${c.detalhe}</li>`)
  }
  for (const s of i.stockChecks ?? []) {
    linhas.push(`<li><b>Estoque ${s.invariante}</b> → ${s.detalhe}</li>`)
  }
  if (linhas.length === 0) linhas.push('<li>(sem detalhe — verifique o painel)</li>')

  const html = `
<div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;color:#0f172a">
  <h2 style="color:#b91c1c">🔴 Juiz de módulo — ${nFalhas} falha${nFalhas === 1 ? '' : 's'}</h2>
  <p style="color:#475569">Rodada de ${i.runAt.toLocaleString('pt-BR')} · ${i.totalContracts - i.totalFail}/${i.totalContracts} contratos ok.</p>
  <ul style="line-height:1.7">${linhas.join('')}</ul>
  <p style="margin-top:24px">
    <a href="${i.juizUrl}" style="background:#7c3aed;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Abrir o painel do juiz →</a>
  </p>
  <p style="color:#94a3b8;font-size:12px;margin-top:24px">Você só recebe este e-mail quando um invariante quebra. Se não recebeu nada, o dado está íntegro.</p>
</div>`.trim()

  return { subject, html }
}
