// Sprint Cartão FASE 4 (18/08/2026) — o JUIZ da fatura Caixa.
//
// REGRA (impossibilidade): a Σ por cartão e por seção TEM que fechar com os totais
// declarados. Não fecha → import FALHA (nunca grava fatura errada). Checagens contra
// o dado real (viram teste — REGRA 3):
//   V(cartão N)  Σ débitos do cartão N = "Total final (cartão N)"
//   V compras    Σ COMPRAS             = "Total COMPRAS"
//   V parceladas Σ COMPRAS PARCELADAS  = "Total COMPRAS PARCELADAS"
//   V créditos   |Σ créditos (C)|      = "Total" do Demonstrativo
//   V total      net (débitos − créd.) = "Valor total desta fatura"
// Sem o total-âncora ("Valor total desta fatura") → FALHA (não dá pra julgar).

import type { CaixaFaturaParsed } from './caixa-fatura-parser'
import type { FaturaValidation, FaturaCheck } from './validate-fatura'

const TOL = 0.02
const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export function validateCaixaFatura(parsed: CaixaFaturaParsed): FaturaValidation {
  const { declared, computed } = parsed
  const checks: FaturaCheck[] = []
  const mk = (name: string, expected: number | null, got: number): void => {
    if (expected == null) return
    const diff = round2(got - expected)
    checks.push({ name, expected, got: round2(got), diff, pass: Math.abs(diff) <= TOL })
  }

  // V por cartão — cada "Total final (cartão N)" bate a Σ dos débitos daquele cartão.
  for (const [card, total] of Object.entries(declared.totalFinalByCard)) {
    mk(`V cartão ${card} = Total final`, total, computed.debitsByCard[card] ?? 0)
  }
  mk('V COMPRAS = Total COMPRAS', declared.totalCompras, computed.comprasSum)
  mk('V PARCELADAS = Total COMPRAS PARCELADAS', declared.totalParceladas, computed.parceladasSum)
  mk('V créditos = Total Demonstrativo', declared.totalDemonstrativo, Math.abs(computed.sumCredits))
  mk('V total = Valor total desta fatura', declared.valorTotalFatura, computed.net)

  if (declared.valorTotalFatura == null) {
    return {
      ok: false,
      checks,
      message:
        'Não encontrei o "Valor total desta fatura" da Caixa pra conferir a leitura. ' +
        'Sem validar, não vou importar (pode faltar transação). Confira se o PDF é a fatura completa.',
    }
  }

  const failed = checks.filter((c) => !c.pass)
  if (failed.length > 0) {
    const detail = failed.map((c) => `${c.name}: esperado ${c.expected.toFixed(2)}, deu ${c.got.toFixed(2)} (dif ${c.diff.toFixed(2)})`).join(' · ')
    return {
      ok: false,
      checks,
      message:
        `A leitura da fatura Caixa NÃO fecha com os totais declarados no PDF — não vou importar pra não gravar valor errado. ${detail}. ` +
        `Provável transação perdida ou crédito (sufixo C) lido errado.`,
    }
  }
  return { ok: true, checks, message: null }
}
