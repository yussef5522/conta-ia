// Sprint BUG B FASE a (14/08/2026) — o JUIZ da fatura determinística.
//
// REGRA (impossibilidade, não combinado): a Σ das linhas TEM que fechar com os
// totais que o próprio PDF declara. Se não fecha, o import FALHA — nunca grava uma
// fatura que não bate. A tripla validação vem do Yussef, contra a fatura real:
//   (23/11: reescrito POR CARTÃO — ver o comentário do `validateSicrediFatura`)
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
  /**
   * ⭐⭐ A LEI DO LEITOR (23/11) — que prova este check carrega. Todo parser tem que entregar as
   * DUAS: `CARTAO` (a soma das linhas de cada cartão bate o total DELE) e `FATURA` (a fatura
   * inteira fecha com o total a pagar). Sem uma delas a fatura não entra (`lei-do-leitor.ts`).
   */
  lei?: 'CARTAO' | 'FATURA'
}

/** por que a fatura foi recusada — a tela diz em palavras do dono */
export type MotivoDaRecusa = 'BANCO_NAO_SUPORTADO' | 'LAYOUT_DIFERENTE' | 'CONTA_NAO_FECHOU'

export interface FaturaValidation {
  ok: boolean
  checks: FaturaCheck[]
  message: string | null
  motivo?: MotivoDaRecusa
}

const fmt = (n: number) => n.toFixed(2)

/**
 * ⭐⭐ O JUIZ DA FATURA SICREDI (reescrito em 23/11 — POR CARTÃO).
 *
 * ⛔ O CASO: a fatura de novembro veio com DOIS cartões (0115 físico + 0708 virtual). O juiz
 * antigo comparava a soma de TODAS as linhas com o "Total cartão" do PRIMEIRO e usava
 * "Total cartão + estornos = Total desta Fatura" — uma identidade que só vale quando a fatura
 * anterior foi paga exatamente. Recusou com "provável transação perdida" uma leitura correta.
 *
 * AS PROVAS (a lei do leitor):
 *   CARTAO  Σ positivos do cartão final X = "Total cartão (final X)" — um check POR cartão;
 *           cartão com linha e sem total (ou total sem linha) também é recusa
 *   CARTAO  nenhuma transação fora de uma seção "Cartão … (final)"
 *   FATURA  anterior + pagamentos/créditos + Σ despesas + encargos = "Total desta Fatura"
 *   FATURA  Pagamentos|Créditos = pagamento + estornos lidos
 *   resumo  Σ dos cartões = Brasil + Exterior
 */
export function validateSicrediFatura(parsed: SicrediFaturaParsed): FaturaValidation {
  const { declared, computed } = parsed
  const checks: FaturaCheck[] = []
  const mk = (name: string, expected: number | null, got: number, lei?: FaturaCheck['lei']): void => {
    if (expected == null) return
    const diff = round2(got - expected)
    checks.push({ name, expected, got: round2(got), diff, pass: Math.abs(diff) <= TOL, ...(lei ? { lei } : {}) })
  }
  const falha = (name: string, expected: number, got: number, lei: FaturaCheck['lei']) =>
    checks.push({ name, expected, got: round2(got), diff: round2(got - expected), pass: false, lei })

  // CARTAO — cada cartão fecha com o SEU total
  const finais = [...new Set([...Object.keys(declared.totalPorCartao), ...Object.keys(computed.positivosPorCartao)])]
  for (const f of finais) {
    const dec = declared.totalPorCartao[f]
    const got = computed.positivosPorCartao[f] ?? 0
    if (dec == null) falha(`cartão final ${f}: tem transação e não achei o "Total cartão" dele`, 0, got, 'CARTAO')
    else mk(`Σ cartão final ${f} = Total cartão (final ${f})`, dec, got, 'CARTAO')
  }
  for (const f of declared.totalPorCartaoConflito) falha(`"Total cartão (final ${f})" aparece com valores diferentes entre as páginas`, 0, 0, 'CARTAO')
  if (computed.linhasSemCartao > 0) falha(`${computed.linhasSemCartao} transação(ões) fora de uma seção de cartão`, 0, computed.linhasSemCartao, 'CARTAO')

  // resumo — os cartões somam as despesas declaradas
  if (declared.brasil != null && declared.exterior != null && declared.totalCartao != null) {
    mk('Σ cartões = Brasil + Exterior', round2(declared.brasil + declared.exterior), declared.totalCartao)
  }
  // FATURA — a fatura inteira fecha
  if (declared.anterior != null && declared.pagamentosCreditos != null) {
    mk(
      'anterior + pagamentos/créditos + despesas + encargos = Total desta Fatura',
      declared.totalFatura,
      round2(declared.anterior + computed.sumPayments + computed.sumEstornos + computed.sumPositives + (declared.subtotalEncargos ?? 0)),
      'FATURA',
    )
  }
  mk('Pagamentos/Créditos = pagamento + estorno', declared.pagamentosCreditos, round2(computed.sumPayments + computed.sumEstornos), 'FATURA')

  if (declared.totalCartao == null || declared.totalFatura == null || computed.count === 0) {
    return {
      ok: false, checks, motivo: 'LAYOUT_DIFERENTE',
      message:
        'Esta fatura do Sicredi não está no layout que eu conheço: não encontrei ' +
        (computed.count === 0 ? 'nenhuma transação' : declared.totalCartao == null ? 'o "Total cartão" de nenhum cartão' : 'o "Total desta Fatura"') +
        '. Sem conseguir conferir, nada foi importado.',
    }
  }
  const failed = checks.filter((c) => !c.pass)
  if (failed.length > 0) {
    const detail = failed.map((c) => `${c.name}: esperado ${fmt(c.expected)}, deu ${fmt(c.got)} (dif ${fmt(c.diff)})`).join(' · ')
    return {
      ok: false, checks, motivo: 'CONTA_NAO_FECHOU',
      message: `A conta da fatura do Sicredi não fechou com os totais do próprio PDF — nada foi importado (meia-fatura não existe). ${detail}.`,
    }
  }
  return { ok: true, checks, message: null }
}
