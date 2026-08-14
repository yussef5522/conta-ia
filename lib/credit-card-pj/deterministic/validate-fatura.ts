// Sprint BUG B FASE a (14/08/2026) — o JUIZ da fatura determinística.
//
// REGRA (impossibilidade, não combinado): a Σ das linhas TEM que fechar com os
// totais que o próprio PDF declara. Se não fecha, o import FALHA — nunca grava uma
// fatura que não bate. A tripla validação vem do Yussef, contra a fatura real:
//   Σ positivos                 = "Total cartao (final XXXX)"
//   Total cartao + estornos     = "Total desta Fatura"
//   Brasil + Exterior           = "Total cartao"
//   Pagamentos|Creditos         = pagamento + estorno
// Sem NENHUM total declarado extraível → também FALHA (não dá pra julgar → não grava).

import type { SicrediFaturaParsed } from './sicredi-fatura-parser'

const TOL = 0.02
const round2 = (n: number) => Math.round(n * 100) / 100

export interface FaturaCheck {
  name: string
  expected: number
  got: number
  diff: number
  pass: boolean
}

export interface FaturaValidation {
  ok: boolean
  checks: FaturaCheck[]
  message: string | null
}

/** Julga a fatura parseada contra os totais declarados. */
export function validateSicrediFatura(parsed: SicrediFaturaParsed): FaturaValidation {
  const { declared, computed } = parsed
  const checks: FaturaCheck[] = []
  const mk = (name: string, expected: number | null, got: number): void => {
    if (expected == null) return // total não declarado/não extraído → pula esse check
    const diff = round2(got - expected)
    checks.push({ name, expected, got: round2(got), diff, pass: Math.abs(diff) <= TOL })
  }

  // 1) Σ positivos (compras+encargos) = Total cartao — o check PRIMÁRIO.
  mk('Σ compras+encargos = Total cartão', declared.totalCartao, computed.sumPositives)
  // 2) Total cartao + estornos = Total desta Fatura.
  if (declared.totalCartao != null) {
    mk('Total cartão + estornos = Total desta Fatura', declared.totalFatura, round2(declared.totalCartao + computed.sumEstornos))
  }
  // 3) Brasil + Exterior = Total cartao.
  if (declared.brasil != null && declared.exterior != null) {
    mk('Brasil + Exterior = Total cartão', declared.totalCartao, round2(declared.brasil + declared.exterior))
  }
  // 4) Pagamentos|Créditos = pagamento + estorno (ambos negativos).
  mk('Pagamentos/Créditos = pagamento + estorno', declared.pagamentosCreditos, round2(computed.sumPayments + computed.sumEstornos))

  // Sem NENHUM total declarado → não dá pra julgar → NÃO grava.
  if (declared.totalCartao == null && declared.totalFatura == null) {
    return {
      ok: false,
      checks,
      message:
        'Não encontrei os totais declarados na fatura pra conferir a leitura. ' +
        'Sem conseguir validar, não vou importar (pode faltar transação). Confira se o PDF é a fatura completa.',
    }
  }

  const failed = checks.filter((c) => !c.pass)
  if (failed.length > 0) {
    const detail = failed.map((c) => `${c.name}: esperado ${c.expected.toFixed(2)}, deu ${c.got.toFixed(2)} (dif ${c.diff.toFixed(2)})`).join(' · ')
    return {
      ok: false,
      checks,
      message:
        `A leitura da fatura NÃO fecha com os totais declarados no PDF — não vou importar pra não gravar valor errado. ${detail}. ` +
        `Provável transação perdida ou linha lida errado.`,
    }
  }
  return { ok: true, checks, message: null }
}
