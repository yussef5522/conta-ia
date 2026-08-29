// O JUIZ DA FATURA MERCADO PAGO (29/08/2026) — mesma regra dos outros três: a Σ das linhas
// TEM que fechar com os totais que o PRÓPRIO PDF declara. Não fecha → NÃO GRAVA.
//
// ⚠️⚠️ A FÓRMULA NÃO SUBTRAI OS PAGAMENTOS, e isso é contraintuitivo o bastante pra estar
// escrito aqui. Medido na fatura real de 20/08:
//
//     consumos 2.503,08 + juros 114,10 + tarifas 9,20 + multa 40,06 = 2.666,44  ✓ EXATO
//     a mesma conta − pagamentos 2.025,73                            =   640,71  ✗
//
// Por quê: os pagamentos (2.025,73) já quitaram a fatura ANTERIOR, e o PDF declara os dois
// números iguais (`Total da fatura de julho` == `Pagamentos e créditos devolvidos`). Eles se
// cancelam — subtrair de novo seria contar a quitação duas vezes.
//
// ⚠️ E é por isso que NÃO existe "pagamento parcial" aqui: a fatura de julho foi paga
// INTEGRALMENTE (42,42 + 0,02 + 1.983,29 = 2.025,73 ao centavo), só que EM ATRASO — daí a
// multa e os juros. O estado é PAGA COM ATRASO. O K-series não precisou mudar.

import type { MercadoPagoFaturaParsed } from './mercadopago-fatura-parser'
import type { FaturaCheck, FaturaValidation } from './validate-fatura'

const TOL = 0.02
const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export function validateMercadoPagoFatura(p: MercadoPagoFaturaParsed): FaturaValidation {
  const d = p.declarados
  const checks: FaturaCheck[] = []
  const add = (name: string, expected: number | null, got: number) => {
    if (expected == null) return
    const diff = round2(got - expected)
    checks.push({ name, expected, got: round2(got), diff, pass: Math.abs(diff) <= TOL })
  }

  // 1) as linhas de consumo somam o que o PDF declara como "Consumos do período"
  //    ⚠️ é esta amarra que decidiu a MADEIRA repetida: só fecha com as DUAS.
  add('Σ consumos == "Consumos de …"', d.consumos, p.somaConsumos)

  // 2) os encargos lidos somam juros + tarifas + multa
  const encargosDeclarados = d.jurosMesAnterior != null || d.tarifasEncargos != null || d.multasAtraso != null
    ? round2((d.jurosMesAnterior ?? 0) + (d.tarifasEncargos ?? 0) + (d.multasAtraso ?? 0))
    : null
  add('Σ encargos == juros + tarifas + multa', encargosDeclarados, p.somaEncargos)

  // 3) O TOTAL — consumos + encargos, SEM subtrair pagamentos
  const totalCalculado = round2(p.somaConsumos + p.somaEncargos)
  add('consumos + encargos == "Total"', d.total, totalCalculado)

  // 4) os pagamentos lidos batem com o declarado (não entram no total, mas têm que fechar —
  //    se não fecharem, alguma linha de pagamento foi lida errado)
  add('Σ pagamentos == "Pagamentos e créditos"', d.pagamentosCreditos, p.somaPagamentos)

  // 5) ⭐ a amarra que revela pagamento PARCIAL: quitação == total da fatura anterior.
  //    Hoje bate exato (2.025,73 == 2.025,73) ⇒ paga integralmente, só que em atraso. Se um
  //    dia NÃO bater, é rolagem pro rotativo de verdade e o estado da fatura muda.
  if (d.totalFaturaAnterior != null && d.pagamentosCreditos != null) {
    const diff = round2(d.pagamentosCreditos - d.totalFaturaAnterior)
    checks.push({
      name: 'quitação da fatura anterior (informativo)',
      expected: d.totalFaturaAnterior, got: d.pagamentosCreditos, diff,
      pass: true, // ⚠️ INFORMATIVO: pagar parcial é legítimo, não é erro de leitura
    })
  }

  // ⚠️ Sem NENHUM total declarado extraível → FALHA. Não dá pra julgar ⇒ não grava.
  const julgaveis = checks.filter((c) => c.name !== 'quitação da fatura anterior (informativo)')
  if (julgaveis.length === 0) {
    return { ok: false, checks, message: 'Não consegui ler nenhum total declarado nesta fatura — sem isso não dá pra conferir a soma, e fatura que não fecha não é gravada.' }
  }

  const falhas = julgaveis.filter((c) => !c.pass)
  if (falhas.length === 0) return { ok: true, checks, message: null }

  const detalhe = falhas
    .map((f) => `${f.name}: li ${f.got.toFixed(2)}, o PDF declara ${f.expected.toFixed(2)} (diferença ${f.diff.toFixed(2)})`)
    .join(' · ')
  return {
    ok: false, checks,
    message: `A soma não fecha com o que a fatura declara — ${detalhe}. Nada foi gravado.`,
  }
}
