// Sprint Cartão FASE 4 (18/08/2026) — o JUIZ da fatura Caixa.
//
// REGRA (impossibilidade): a Σ por cartão e por seção TEM que fechar com os totais
// declarados. Não fecha → import FALHA (nunca grava fatura errada). Checagens contra
// o dado real (viram teste — REGRA 3):
//   V(cartão N)  Σ débitos do cartão N = "Total final (cartão N)"
//   V compras    Σ COMPRAS             = "Total COMPRAS"
//   V parceladas Σ COMPRAS PARCELADAS  = "Total COMPRAS PARCELADAS"
//   V demonstr.  net do bloco Demonstr. = "Total" do Demonstrativo (assinado D/C)
//   V total      net (débitos − créd.)  = "Valor total desta fatura"
// Sem o total-âncora ("Valor total desta fatura") → FALHA (não dá pra julgar).
//
// ⚠️⚠️ O `V demonstrativo` SUBSTITUI o antigo `V créditos = Total Demonstrativo`, e é
// ESTRITAMENTE MAIS FORTE — não é afrouxamento:
//   · o antigo comparava `|Σ créditos de TODA a fatura|` com um número que é o net de
//     UM bloco. Batia na fixture de agosto por **duas coincidências somadas**: o par
//     anterior×pagamento se anula (então o net do bloco É −|créditos|) e todos os
//     créditos da fatura moram no Demonstrativo.
//   · e na fatura RICA ele nem rodava (o `totalDemonstrativo` vinha null, porque o
//     regex exigia sufixo C e lá o Total é `465,29 D`).
// O novo mede o bloco contra o número que o próprio bloco declara, com sinal — e é ele
// que pega o resíduo do par: pagamento parcial muda o net e a checagem morde.

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
  mk('V demonstrativo = Total do Demonstrativo', declared.totalDemonstrativo, computed.demonstrativoNet)
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
