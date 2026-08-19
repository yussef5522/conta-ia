// Sprint Cartão FASE 4 (18/08/2026) — o JUIZ da fatura Banrisul.
//
// REGRA (impossibilidade): a Σ das linhas TEM que fechar com os totais que o próprio
// PDF declara. Não fecha → import FALHA (nunca grava fatura errada). 5 checagens,
// todas contra o dado real (viram teste — REGRA 3):
//   V1  Σ Brasil          = "Despesas / Débitos no Brasil"
//   V2  Σ Exterior (R$)   = "Saldo Convertido em Reais (+)"
//   V3  Σ IOF exterior    = "IOF sobre transações no exterior"
//   V4  Σ débitos (B+E+I) = "TOTAL DE GASTOS"
//   V5  net (débitos+est) = "Saldo da fatura atual"  (o que se paga)
//   +   consistência declarada: anterior − pag/créd + Brasil + Ext + IOF = Saldo atual
// Sem os totais-âncora (TOTAL DE GASTOS + Saldo atual) → FALHA (não dá pra julgar).

import type { BanrisulFaturaParsed } from './banrisul-fatura-parser'
import type { FaturaValidation, FaturaCheck } from './validate-fatura'

const TOL = 0.02
const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export function validateBanrisulFatura(parsed: BanrisulFaturaParsed): FaturaValidation {
  const { declared, computed } = parsed
  const checks: FaturaCheck[] = []
  const mk = (name: string, expected: number | null, got: number): void => {
    if (expected == null) return
    const diff = round2(got - expected)
    checks.push({ name, expected, got: round2(got), diff, pass: Math.abs(diff) <= TOL })
  }

  mk('V1 Σ Brasil = Débitos no Brasil', declared.brasil, computed.sumBrasil)
  mk('V2 Σ Exterior = Saldo Convertido em Reais', declared.exterior, computed.sumExterior)
  mk('V3 Σ IOF = IOF sobre transações no exterior', declared.iof, computed.sumIof)
  mk('V4 Σ débitos = TOTAL DE GASTOS', declared.totalGastos, computed.sumPositives)
  mk('V5 net = Saldo da fatura atual', declared.saldoAtual, computed.net)
  // consistência dos totais declarados entre si (não usa as linhas).
  if (declared.anterior != null && declared.pagamentosCreditos != null && declared.brasil != null && declared.exterior != null && declared.iof != null) {
    mk('Resumo declarado = Saldo atual', declared.saldoAtual, round2(declared.anterior - declared.pagamentosCreditos + declared.brasil + declared.exterior + declared.iof))
  }

  // âncoras mínimas pra julgar: sem elas não grava.
  if (declared.totalGastos == null || declared.saldoAtual == null) {
    return {
      ok: false,
      checks,
      message:
        'Não encontrei os totais declarados da fatura Banrisul (TOTAL DE GASTOS / Saldo da fatura atual) pra conferir a leitura. ' +
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
        `A leitura da fatura Banrisul NÃO fecha com os totais declarados no PDF — não vou importar pra não gravar valor errado. ${detail}. ` +
        `Provável transação perdida ou linha lida errado.`,
    }
  }
  return { ok: true, checks, message: null }
}
