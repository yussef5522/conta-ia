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


import { canonicoDaGrafia } from './grafia-canonica'
/** quantas vezes acima da média um produto pode ir sem a tela perguntar */
export const FATOR_SUSPEITO = 10
/** ⚠️ abaixo disso a média é ruído — 2 unidades viram 20 num sábado sem que nada esteja errado */
export const PISO_PRA_SUSPEITAR = 20
/** ⚠️ dias de histórico que formam a média */
export const DIAS_DE_HISTORICO = 14
/**
 * ⭐⭐ (16/11) JANELA MÍNIMA: abaixo de N dias com venda do produto (gêmeos somados) não existe
 * "normal" — e sem normal a trava NÃO pergunta. O caso: domingo 15/11 a trava parou o dia inteiro
 * com "XIS COMPLETO: 88 num dia — o normal é 1", e o "1" era a grafia `Xis Completo` (2 linhas,
 * 1 un cada) que ESMAGOU no Map a `XIS COMPLETO` (13 dias, média 36) — chave `toUpperCase`, a
 * última vence. Normal feito de 2 dias é ruído, não régua.
 */
export const MIN_DIAS_PRA_NORMAL = 5

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
 * ⭐⭐ (16/11) A CHAVE DO NORMAL É A GRAFIA CANÔNICA — a MESMA régua dos complementos e do mapa
 * (`canonicoDaGrafia`: sem acento, caixa, pontuação e espaço). Gêmeos (`XIS COMPLETO`,
 * `Xis Completo`, `XIS - COMPLETO`) SOMAM — nunca um apaga o outro.
 */
function historicoCanonico(historico: HistoricoDoProduto[]): Map<string, { soma: number; dias: number }> {
  const m = new Map<string, { soma: number; dias: number }>()
  for (const h of historico) {
    const k = canonicoDaGrafia(h.produto)
    const cur = m.get(k) ?? { soma: 0, dias: 0 }
    cur.soma += h.mediaDiaria * h.dias
    cur.dias += h.dias
    m.set(k, cur)
  }
  return m
}

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
  const hist = historicoCanonico(historico)
  const suspeitas: Suspeita[] = []
  // ⭐ o DIA também soma os gêmeos: 60 `XIS COMPLETO` + 28 `Xis Completo` é 88 do mesmo produto
  const doDia = new Map<string, LinhaDoArquivo>()
  for (const l of linhas) {
    const k = canonicoDaGrafia(l.produto)
    const cur = doDia.get(k)
    doDia.set(k, cur ? { produto: cur.produto, quantidade: cur.quantidade + l.quantidade } : { ...l })
  }

  for (const [k, l] of doDia) {
    const hh = hist.get(k)
    if (!hh || hh.dias < MIN_DIAS_PRA_NORMAL || hh.soma <= 0) continue // sem histórico SUFICIENTE, sem palpite
    const h = { mediaDiaria: hh.soma / hh.dias }
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
