// ⛔⛔ O SINAL FAZ PARTE DA RÉGUA (04/09/2026) — regra do dono.
//
// *"'OP CREDITO C/GARANTIA' POSITIVO = a regra D18 (venda). NEGATIVO = histórico DIFERENTE,
// nunca casa com a regra da venda, nunca auto-classifica."*
//
// ⛔ O CASO REAL do mesmo arquivo: **+5.252,06** e **+4.250,99** são a liquidação da bandeira
// (Receita de Vendas, a regra que o dono ensinou) e **−3.700 "OP CRED C GARANT"** é OUTRA
// coisa — ele mesmo ainda vai descobrir o que. Sem o sinal na régua, a canonização que eu
// acabei de ligar faria os três casarem com a MESMA regra e **jogaria um DÉBITO de 3.700
// dentro da receita de vendas**. Ou seja: o conserto do item 2, sozinho, criaria um bug
// maior que o que ele resolve.
//
// ⭐ A RÉGUA GERAL, sem coluna nova no banco: **o grupo do DRE da categoria da regra já diz
// o sinal esperado.** Receita entra (CREDIT), despesa sai (DEBIT). Quando o sinal contradiz,
// o sistema NÃO classifica e diz o que viu — em vez de "escolha você" mudo.
//
// ⚠️ GRUPOS NEUTROS FICAM DE FORA da trava: transferência, aporte e investimento acontecem
// nos dois sentidos por natureza. Travar ali seria alarme falso — e alarme falso repetido é
// como um alarme morre.

/** Grupos que só fazem sentido ENTRANDO dinheiro. */
const GRUPOS_DE_ENTRADA = new Set(['RECEITA_BRUTA', 'OUTRAS_RECEITAS', 'RECEITA_FINANCEIRA'])

/** Grupos que só fazem sentido SAINDO dinheiro. */
const GRUPOS_DE_SAIDA = new Set([
  'DEDUCOES', 'CUSTO_PRODUTO_VENDIDO', 'DESPESAS_PESSOAL', 'DESPESAS_ADMINISTRATIVAS',
  'DESPESAS_COMERCIAIS', 'DESPESAS_FINANCEIRAS', 'DESPESAS_OPERACIONAIS',
  'IMPOSTOS', 'DISTRIBUICAO_LUCROS',
])

export type SinalDaLinha = 'CREDIT' | 'DEBIT'

/**
 * A regra pode valer pra uma linha com ESTE sinal? PURA.
 *
 * ⚠️ `null`/desconhecido → **true**: sem saber o grupo, não se inventa uma trava. A regra do
 * projeto é avisar quando não dá pra afirmar, nunca bloquear por ignorância.
 */
export function sinalCompativel(dreGroup: string | null | undefined, sinal: SinalDaLinha | undefined): boolean {
  if (!dreGroup || !sinal) return true
  if (GRUPOS_DE_ENTRADA.has(dreGroup)) return sinal === 'CREDIT'
  if (GRUPOS_DE_SAIDA.has(dreGroup)) return sinal === 'DEBIT'
  return true // TRANSFERENCIA, APORTES_CAPITAL, INVESTIMENTOS… — os dois sentidos são normais
}

/**
 * A frase que substitui o "escolha você" mudo.
 *
 * ⚠️ Ela NÃO chuta o que a linha é — diz o que o sistema VIU e por que parou. O dono é quem
 * descobre no banco; a tela existe pra ele saber que há uma pergunta a fazer.
 */
export function frasePorConflitoDeSinal(
  historico: string, sinal: SinalDaLinha, padraoDaRegra: string,
): string {
  return sinal === 'DEBIT'
    ? `Confira no banco: "${historico}" saiu como DÉBITO, e o histórico com esse nome sempre foi entrada `
      + `(regra "${padraoDaRegra}"). Débito com nome de crédito é outra operação — não classifiquei.`
    : `Confira no banco: "${historico}" entrou como CRÉDITO, e o histórico com esse nome sempre foi saída `
      + `(regra "${padraoDaRegra}"). Pode ser estorno — não classifiquei.`
}
