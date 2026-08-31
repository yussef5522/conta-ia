// ⭐⭐ O TOTAL DECLARADO TEM DUAS FONTES — O PDF, OU O DONO (31/08/2026).
//
// ⛔ A CLASSE DO PROBLEMA (formulada pelo dono): não é "falta suporte ao banco X". É que
// **quando o PDF não declara os totais, não existe saída nenhuma e o import morre** — e
// cada layout novo vai bater nessa mesma parede.
//
// ⭐ A INVERSÃO: o selo não exige que **o PDF** declare; exige que **ALGUÉM** declare. O
// parser é uma fonte; o dono olhando a fatura em papel é outra. **A conferência roda
// idêntica nos dois casos** — é isso que impede a saída manual de virar afrouxamento.
//
// ⚠️ REGRAS QUE NÃO MUDAM (do dono, e elas são o módulo):
//   · sem total de NENHUMA das duas fontes → **não importa**. Ponto.
//   · digitou e não fecha com a soma das linhas → **não importa**, e mostra a diferença
//     AO CENTAVO. Digitar não é atalho pra passar: é outra fonte pro MESMO gate.
//   · a ORIGEM fica gravada — "veio do PDF" ou "fui eu que digitei". A leitura de amanhã
//     precisa saber com que autoridade aquele número entrou. *a apurar > número inventado.*

export type OrigemTotal = 'PDF' | 'DIGITADO'

export interface TotalDeclarado {
  valor: number
  origem: OrigemTotal
}

export interface ResolverTotalInput {
  /** o que o parser conseguiu ler do documento (null = não achou) */
  doPdf: number | null
  /** o que o dono digitou olhando a fatura (null/undefined = não digitou) */
  digitado?: number | null
}

/**
 * Qual total vale?
 *
 * ⚠️ O PDF TEM PRECEDÊNCIA sobre o digitado, e de propósito: quando o documento declara,
 * ele é a fonte mais forte — é o número que o banco assinou. O digitado existe pro caso em
 * que o documento **não** declara, não pra corrigir o que ele declarou. (Se um dia o dono
 * precisar sobrepor um total do PDF, isso é outra decisão, com outro rastro.)
 */
export function resolverTotalDeclarado(i: ResolverTotalInput): TotalDeclarado | null {
  if (i.doPdf != null && Number.isFinite(i.doPdf)) return { valor: i.doPdf, origem: 'PDF' }
  if (i.digitado != null && Number.isFinite(i.digitado) && i.digitado > 0) {
    return { valor: i.digitado, origem: 'DIGITADO' }
  }
  return null
}

const round2 = (n: number) => Math.round(n * 100) / 100

export interface ConferenciaTotal {
  fecha: boolean
  lido: number
  declarado: number
  origem: OrigemTotal
  /** diferença AO CENTAVO — é o que a tela mostra quando não fecha */
  diferenca: number
  detalhe: string
}

/**
 * A conferência — **a MESMA nos dois casos**.
 *
 * ⚠️ A tolerância é de UM CENTAVO, não uma folga confortável: o total de uma fatura é a
 * soma de linhas em reais, e o único erro legítimo é arredondamento de centavo. Folga
 * maior aqui seria afrouxar o selo por conveniência — que é exatamente o que o dono
 * mandou não fazer.
 */
export function conferirTotal(lido: number, total: TotalDeclarado): ConferenciaTotal {
  const l = round2(lido)
  const d = round2(total.valor)
  const diferenca = round2(l - d)
  const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  return {
    fecha: Math.abs(diferenca) <= 0.01,
    lido: l,
    declarado: d,
    origem: total.origem,
    diferenca,
    detalhe:
      `   lido nas linhas: ${brl(l)} · declarado: ${brl(d)}` +
      ` (${total.origem === 'PDF' ? 'do PDF' : 'digitado por você'})` +
      (Math.abs(diferenca) > 0.01 ? `\n   diferença: ${brl(diferenca)}` : ''),
  }
}
