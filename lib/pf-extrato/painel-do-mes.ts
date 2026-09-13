// ⭐⭐⭐ O PAINEL DO MÊS DA PF (13/09/2026) — a tela-mãe, padrão Organizze.
//
// **O dono:** *"Topo: ENTROU · SAIU · SOBROU — o mês corrente, número grande, sem enfeite.
// Gastos por categoria do mês (barras), cartões com estado da fatura, e a lista do extrato
// categorizado embaixo. Zero orçamento/metas nessa fase — meta sem histórico é chute."*
//
// ⭐ É o irmão PF do Fluxo de Caixa da PJ (25/08) e herda as regras dele: **a exclusão
// aparece na tela** e **"a classificar" nunca some**.
//
// ⛔⛔ **E AQUI TEM UMA EXCLUSÃO QUE A PJ NÃO TEM: o PAGAMENTO DE FATURA.** Se ele entrasse
// no SAIU junto com as compras do cartão, a mesma despesa contaria **duas vezes** — a compra
// no mês em que foi feita e a fatura no mês em que foi paga. A régua é a do Fluxo: *entra o
// pagamento, saem as compras* — e como o painel PF mostra o extrato da CONTA, o que vale
// aqui é o pagamento; as compras vivem no módulo de cartões, linkado ao lado.

const r2 = (n: number) => Math.round(n * 100) / 100

export interface LinhaDoMes {
  id: string
  data: Date
  descricao: string
  /** positivo = entrou, negativo = saiu */
  valorComSinal: number
  categoriaId: string | null
  categoriaNome: string | null
  /** ⚠️ pagamento de fatura: sai do SAIU e aparece à parte, nomeado */
  ehPagamentoDeFatura: boolean
}

export interface GastoDaCategoria { categoriaId: string | null; nome: string; total: number; proporcao: number }

export interface PainelDoMes {
  mes: string
  entrou: number
  saiu: number
  sobrou: number
  lancamentos: number
  /** ⭐ por categoria, da maior pra menor — as barras */
  gastosPorCategoria: GastoDaCategoria[]
  /** ⚠️ o que ficou sem categoria — cobrando, nunca somido */
  semCategoria: { quantos: number; total: number }
  /** ⭐ a exclusão aparece na tela, como no Fluxo da PJ */
  pagamentosDeFatura: { quantos: number; total: number }
  vazio: string | null
}

/** ⭐ o painel do mês. PURO — a tela só pinta. */
export function painelDoMes(mes: string, linhas: LinhaDoMes[]): PainelDoMes {
  const doMes = linhas.filter((l) => l.data.toISOString().slice(0, 7) === mes)
  if (!doMes.length) {
    return {
      mes, entrou: 0, saiu: 0, sobrou: 0, lancamentos: 0,
      gastosPorCategoria: [], semCategoria: { quantos: 0, total: 0 },
      pagamentosDeFatura: { quantos: 0, total: 0 },
      // ⛔ vazio DIZ o motivo — nunca três zeros com cara de mês ruim
      vazio: 'sem lançamento nesse mês — importe o extrato da conta',
    }
  }

  const fatura = doMes.filter((l) => l.ehPagamentoDeFatura)
  const contam = doMes.filter((l) => !l.ehPagamentoDeFatura)
  const entrou = r2(contam.filter((l) => l.valorComSinal > 0).reduce((s, l) => s + l.valorComSinal, 0))
  const saiu = r2(Math.abs(contam.filter((l) => l.valorComSinal < 0).reduce((s, l) => s + l.valorComSinal, 0)))

  const porCat = new Map<string, { nome: string; total: number }>()
  let semCatTotal = 0, semCatQtd = 0
  for (const l of contam) {
    if (l.valorComSinal >= 0) continue
    if (!l.categoriaId) { semCatTotal += Math.abs(l.valorComSinal); semCatQtd++; continue }
    const a = porCat.get(l.categoriaId) ?? { nome: l.categoriaNome ?? '—', total: 0 }
    porCat.set(l.categoriaId, { nome: a.nome, total: a.total + Math.abs(l.valorComSinal) })
  }
  const maior = Math.max(1, ...[...porCat.values()].map((v) => v.total), semCatTotal)

  const gastos: GastoDaCategoria[] = [...porCat.entries()]
    .map(([categoriaId, v]) => ({ categoriaId, nome: v.nome, total: r2(v.total), proporcao: r2(v.total / maior) }))
    .sort((a, b) => b.total - a.total)
  // ⚠️ "a classificar" entra na LISTA, não some — é a régua do Fluxo da PJ (25/08): o balde
  // de erro tem que ficar à vista, senão ninguém o esvazia
  if (semCatQtd > 0) {
    gastos.push({ categoriaId: null, nome: 'a classificar', total: r2(semCatTotal), proporcao: r2(semCatTotal / maior) })
  }

  return {
    mes, entrou, saiu, sobrou: r2(entrou - saiu), lancamentos: doMes.length,
    gastosPorCategoria: gastos,
    semCategoria: { quantos: semCatQtd, total: r2(semCatTotal) },
    pagamentosDeFatura: { quantos: fatura.length, total: r2(Math.abs(fatura.reduce((s, l) => s + l.valorComSinal, 0))) },
    vazio: null,
  }
}
