// ⭐⭐⭐ SANIDADE ANTES DE ESCREVER (11/09/2026) — o guard que o dono pediu.
//
// **Ele, depois do estoque explodir:** *"import de vendas com quantidade por produto > N×
// a média dos últimos dias PARA e pergunta antes de baixar — 'FANTA UVA 2L: 1.499 num dia
// — o normal é 4. Confirma?'. Sanidade antes de escrever, como a conferência de fatura já
// faz."*
//
// ⛔ **PERGUNTA, NÃO RECUSA CEGA** (a régua é dele): dia de evento existe, e um parser que
// recusa venda de verdade manda o dono lançar por fora — que é pior que o número alto.
// Quem decide é ele, **com o número na frente**.
//
// ⚠️ E ISTO É A SEGUNDA CAMADA, não a primeira: a primeira é o parser resolver a coluna
// pelo NOME do cabeçalho e recusar o arquivo trocado. Este guard existe pro caso que o
// cabeçalho não pega — arquivo certo, número errado.

/** quantas vezes acima da média um produto pode ir sem a tela perguntar */
export const FATOR_SUSPEITO = 10
/** ⚠️ abaixo disso a média é ruído — 2 unidades viram 20 num sábado sem que nada esteja errado */
export const PISO_PRA_SUSPEITAR = 20
/** ⚠️ dias de histórico que formam a média */
export const DIAS_DE_HISTORICO = 14

export interface LinhaDoArquivo { produto: string; quantidade: number }
export interface HistoricoDoProduto { produto: string; mediaDiaria: number; dias: number }

export interface Suspeita {
  produto: string
  quantidade: number
  mediaDiaria: number
  vezes: number
  frase: string
}

export interface ResultadoDaSanidade {
  suspeitas: Suspeita[]
  /** ⭐ o total do arquivo contra o total médio do dia — pega o layout trocado inteiro */
  totalDoArquivo: number
  totalMedioDoDia: number
  vezesNoTotal: number
  /** a tela PARA e pergunta? */
  precisaConfirmar: boolean
}

const round1 = (n: number) => Math.round(n * 10) / 10

/**
 * ⭐⭐ A CONTA, pura. Recebe o que o arquivo diz e o histórico; devolve o que perguntar.
 *
 * ⚠️ Produto SEM histórico não vira suspeita: item novo vende pela 1ª vez todo dia, e
 * acusar isso encheria a tela de alarme falso — que é como um alarme morre (a lição dos
 * 111 falsos do juiz de vendas).
 */
export function avaliarSanidade(
  linhas: LinhaDoArquivo[],
  historico: HistoricoDoProduto[],
  totalMedioDoDia: number,
): ResultadoDaSanidade {
  const media = new Map(historico.map((h) => [h.produto.trim().toUpperCase(), h]))
  const suspeitas: Suspeita[] = []

  for (const l of linhas) {
    const h = media.get(l.produto.trim().toUpperCase())
    if (!h || h.dias === 0 || h.mediaDiaria <= 0) continue           // sem histórico, sem palpite
    if (l.quantidade < PISO_PRA_SUSPEITAR) continue                  // número pequeno não assusta
    const vezes = l.quantidade / h.mediaDiaria
    if (vezes < FATOR_SUSPEITO) continue
    suspeitas.push({
      produto: l.produto,
      quantidade: l.quantidade,
      mediaDiaria: round1(h.mediaDiaria),
      vezes: round1(vezes),
      // ⭐ a frase é a do dono, com o número dele dentro: sem o "o normal é 4" ele não tem
      // como decidir, e um alerta que não dá o normal é só um susto.
      frase: `${l.produto}: ${l.quantidade.toLocaleString('pt-BR')} num dia — o normal é ${round1(h.mediaDiaria)}. Confirma?`,
    })
  }

  const totalDoArquivo = linhas.reduce((s, l) => s + l.quantidade, 0)
  const vezesNoTotal = totalMedioDoDia > 0 ? totalDoArquivo / totalMedioDoDia : 0

  return {
    suspeitas: suspeitas.sort((a, b) => b.vezes - a.vezes),
    totalDoArquivo,
    totalMedioDoDia: round1(totalMedioDoDia),
    vezesNoTotal: round1(vezesNoTotal),
    // ⚠️ o TOTAL também dispara sozinho: no caso de 10/09 foram 53.761 contra ~600 de
    // média (**72×**) — o layout trocado desloca o arquivo INTEIRO, e nem sempre um
    // produto isolado passa do fator.
    precisaConfirmar: suspeitas.length > 0 || vezesNoTotal >= FATOR_SUSPEITO,
  }
}
