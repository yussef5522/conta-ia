/**
 * ⭐⭐⭐ A REFERÊNCIA FLEXÍVEL DO MÊS — "o caixa deste mês cobriu a referência?" (07/10/2026).
 *
 * ⛔⛔ **O DEFEITO QUE A CRIOU, medido em prod:** a tela de compromissos de OUTUBRO mostrava
 * *"Arafat parcela 2 · R$ 50.000 · paga"* — e o dono não havia pago outubro. O retrato:
 *
 * ```
 * #1 · venc 15/09 (set) · 1:1 → 06/07  R$ 40.000
 * #2 · venc 15/10 (out) · 1:1 → 04/08  R$ 50.000   ← o selo mentiroso de OUTUBRO
 * #3 · venc 15/11 (nov) · N:1 → 01/09  R$ 50.000   ← o pagamento de SETEMBRO
 * ```
 *
 * **A causa:** a devolução promove a **próxima parcela aberta por NÚMERO**, e a agenda nominal
 * começa em **setembro** enquanto o dono começou a devolver em **julho** — ele está DUAS
 * devoluções à frente. O selo saía do VÍNCULO, e **nada na cadeia olhava a DATA do pagamento
 * contra o mês que estava sendo visto**.
 *
 * ⚠️⚠️ **E REALOCAR OS VÍNCULOS É IMPOSSÍVEL, não só indesejável:** julho e agosto **não têm
 * referência nenhuma** (a agenda começa em setembro). Não existe parcela onde encostar os
 * R$ 90.000 daqueles meses. É o argumento mais forte a favor de a lei olhar o CAIXA DO MÊS e
 * deixar o vínculo em paz — ele é escrituração, não verdade do mês.
 *
 * ═══ ⭐ A LEI (aprovada pelo dono em 07/10) ═══
 *
 * > **Só para FLEXIBLE:** no recorte de um mês, a referência daquele mês é **paga pelo caixa
 * > que SAIU dentro do mês** — nunca pela ordem do vínculo.
 *
 * ⛔⛔ **E ELA NÃO ALCANÇA O BANCÁRIO, de propósito.** Na parcela de banco *"PAID gravado é
 * DECISÃO"* (02/10) tem que valer: a **Caixa #28** venceu em maio e foi paga em **junho** — no
 * recorte de maio ela **é paga, com atraso**. Dizer "a vencer" ali seria mentira sobre dinheiro
 * que saiu. No FLEXIBLE a agenda é **referência** e a alocação é arbitrária; são perguntas
 * diferentes, e por isso a lei é escopada.
 *
 * ⭐ **E ela torna o selo IMUNE À ORDEM DO VÍNCULO:** quando o dono devolver esta semana, o
 * caixa de outubro passa do nominal e a referência fecha **independente de em qual parcela o
 * vínculo caiu**. Era a exigência dele: *"quando eu pagar, vira paga sozinho"*.
 *
 * ═══ ⛔⛔ O AJUSTE DO DONO QUE REVERTEU UMA DECISÃO MINHA (07/10) ═══
 *
 * Eu havia escrito, no mesmo dia: *"FLEXIBLE não-paga fica FORA da Σ — a prateleira promete
 * caixa que CERTAMENTE sai, e somar R$ 41.428,57 faria o 4º cartão exigir vender 41 mil a mais
 * por um pagamento que o dono ainda não decidiu fazer"*. **A premissa estava errada**, e o dado
 * a derrubou: o dono devolveu em **três meses seguidos** (jul 40k · ago 50k · set 50k). Nas
 * palavras dele: *"eu devolvo todo mês, esse caixa certamente sai; tela de compromissos que
 * esconde 41 mil me faz afundar sorrindo"*.
 *
 * ⭐ Então a referência NÃO PAGA **conta na Σ pelo NOMINAL**, marcada `ehReferencia` pra tela
 * dizer `~referência flexível`. Paga, conta pelo que REALMENTE saiu — igual às outras pagas.
 *
 * ⚠️ **Borda declarada:** caixa PARCIAL no mês (saiu 20k de 41.428,57) **segue valendo o
 * NOMINAL**, com o parcial dito no selo. A prateleira responde *"quanto o mês custa"*, não
 * *"quanto ainda falta sair"* — o parcial já é parte desse nominal, então não há dupla
 * contagem. É a leitura literal da regra do dono.
 *
 * ⚠️ Função PURA (zero prisma): é ela que dá UM lugar pra a decisão, em vez de um `if` no meio
 * da leitura dos compromissos — regra que mora numa rota é regra que ninguém prova.
 */
import { TOL, arredondar2 } from './estado-da-parcela'
import { rotuloDoMes } from '@/lib/periodo/mes-corrente'

/** uma devolução do contrato, com a DATA — é ela que a lei olha */
export interface DevolucaoDoContrato {
  data: Date
  valor: number
}

export interface ReferenciaFlexivel {
  /** ⛔ FLEXIBLE nunca é ATRASADA nem PARCIAL pelo nominal (a isenção de 02/10) */
  estado: 'PAGA' | 'A_VENCER'
  /** Σ do caixa que saiu DENTRO do mês — o número que a lei compara */
  saiuNoMes: number
  /** quantas devoluções compõem o caixa do mês (as "mordidas" do mês) */
  mordidas: number
  /** o valor da linha: PAGA → o caixa do mês; não paga → o NOMINAL da referência */
  valor: number
  /** `true` = o valor é a referência nominal (ainda não aconteceu) → a tela marca `~` */
  ehReferencia: boolean
  selo: string
  /**
   * ⭐ A LINHA-MITIGAÇÃO (exigência do dono): a página do empréstimo diz "#2 paga" e outubro
   * diz "a vencer" — são perguntas diferentes, e a prateleira DIZ qual é a dela. `null` quando
   * a referência do mês está paga (frase sobre o que não acontece é ruído).
   */
  porque: string | null
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const ddmm = (d: Date) =>
  `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`

/**
 * ⭐ A LEI, num lugar só.
 *
 * @param nominal  o devido nominal da referência daquele mês (`installment.payment`)
 * @param devolucoes  TODAS as devoluções do contrato, com data — a lei recorta por mês
 * @param janela  o recorte do mês (`janelaDoMes`), pra o "dentro do mês" ter um dono só
 */
export function referenciaFlexivelDoMes(
  nominal: number,
  devolucoes: readonly DevolucaoDoContrato[],
  janela: { mes: string; de: Date; ate: Date },
  agora: Date,
): ReferenciaFlexivel {
  const noMes = devolucoes.filter((d) => d.data >= janela.de && d.data < janela.ate)
  const saiuNoMes = arredondar2(noMes.reduce((s, d) => s + d.valor, 0))
  const devido = arredondar2(nominal)

  // ⭐ a lei: o caixa DO MÊS cobriu a referência DO MÊS?
  if (devido > 0 && saiuNoMes + TOL >= devido) {
    return {
      estado: 'PAGA',
      saiuNoMes,
      mordidas: noMes.length,
      // ⛔ PAGA mostra o que REALMENTE saiu, nunca o nominal (a régua de 07/10)
      valor: saiuNoMes,
      ehReferencia: false,
      selo: noMes.length > 1 ? `paga em ${noMes.length} devoluções` : 'paga',
      porque: null,
    }
  }

  // ⚠️ a ÚLTIMA devolução ANTES deste mês — é ela que explica o "ainda não teve devolução"
  const anteriores = devolucoes
    .filter((d) => d.data < janela.de)
    .sort((a, b) => a.data.getTime() - b.data.getTime())
  const ultima = anteriores[anteriores.length - 1]

  const nomeDoMes = rotuloDoMes(janela.mes, agora)
  const porque =
    saiuNoMes > TOL
      ? `agenda flexível — saíram ${brl(saiuNoMes)} em ${nomeDoMes}, e a referência do mês é ${brl(devido)}`
      : ultima
        ? `agenda flexível — a referência de ${nomeDoMes} ainda não teve devolução; a última saiu em ${ddmm(ultima.data)}`
        : `agenda flexível — a referência de ${nomeDoMes} ainda não teve devolução`

  return {
    estado: 'A_VENCER',
    saiuNoMes,
    mordidas: noMes.length,
    // ⭐ o AJUSTE DO DONO: não paga conta pelo NOMINAL (o caixa do mês certamente sai)
    valor: devido,
    ehReferencia: true,
    selo:
      saiuNoMes > TOL
        ? `~referência flexível · devolvido ${brl(saiuNoMes)} neste mês`
        : '~referência flexível',
    porque,
  }
}
