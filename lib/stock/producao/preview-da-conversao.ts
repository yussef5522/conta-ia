/**
 * ⭐⭐⭐ O PREVIEW DA CONVERSÃO — e a parte que importa é a SEPARAÇÃO ANTES × DEPOIS (04/10/2026).
 *
 * **Ordem do dono:** *"PREVIEW mostra a ficha convertida → eu confirmo → vira versão nova."*
 *
 * ⚠️⚠️ **MAS A FICHA CONVERTIDA SOZINHA NÃO RESPONDE A PERGUNTA QUE O DONO VAI FAZER.** Ele vai
 * olhar *"loteBase 1 KG → 1 UN"* e perguntar **"isso mexe no meu estoque?"**. Nas fichas 1:1
 * (28 das 30 medidas) a resposta é **NÃO: a separação não muda um grama** — `escala = pedido ÷ 1`
 * dá o mesmo de antes e as doses ficam intactas. Sem mostrar isso, converter 37 fichas parece
 * uma cirurgia no estoque, e o dono (com razão) não clica.
 *
 * ⛔⛔ **E A SEPARAÇÃO SAI DA PORTA ÚNICA** (`insumoDoPedido`), nunca de uma multiplicação daqui.
 * Uma 2ª conta faria o preview prometer um número que a ordem não vai separar — e seria
 * exatamente o defeito que o guard `uma-porta-pra-explosao` existe pra impedir. Mesma lição do
 * comentário mentiroso de `eficienciaDaOrdem` (03/10): *promessa de fonte única sem chamar a
 * fonte é pior que nenhuma*.
 *
 * ⚠️ O pedido de exemplo é **PARÂMETRO**, não um `10` cravado aqui: número solto em tela vira a
 * segunda régua no dia em que alguém quiser ver com outro pedido (a cicatriz do `TETO = 25`).
 */

import { converterLote, type LoteAtual, type ConversaoDoLote } from './converter-lote'
import { insumoDoPedido } from './escala-da-ordem'

const round4 = (n: number) => Math.round((n + 1e-9) * 1e4) / 1e4

/** quantas unidades o preview usa de exemplo quando a tela não pede outro número */
export const PEDIDO_DE_EXEMPLO = 10

export interface LinhaDaSeparacao {
  nome: string
  unidade: string
  /** o que a ordem separa HOJE, com o lote declarado como está */
  antes: number | null
  /** o que ela vai separar depois da conversão */
  depois: number | null
  /** `true` quando os dois são iguais ao grama — a conversão não mexe nesta linha */
  igual: boolean
}

export interface PreviewDaConversao {
  conversao: ConversaoDoLote
  /** o pedido (em unidades do produto) com que a comparação foi feita */
  pedido: number
  separacao: LinhaDaSeparacao[]
  /**
   * ⭐ A resposta à pergunta do dono, num booleano: **nenhuma linha da separação se move**.
   * É o que a tela diz em letras grandes nas fichas 1:1.
   */
  separacaoIntacta: boolean
  /** `true` quando nem as doses da ficha mudam — a conversão é puramente de rótulo */
  soRotulo: boolean
}

/**
 * PURA. A ficha convertida + o que a ordem de `pedido` unidades separaria antes e depois.
 *
 * ⚠️ **O "antes" só existe quando o lote declarado dá uma escala utilizável.** Com o lote em KG
 * num produto contado em UN, `pedido ÷ loteBase` é uma conta entre grandezas diferentes — e é
 * justamente a conta torta que o M5 denuncia. Ela é mostrada do jeito que a ordem faz HOJE
 * (é o estado real), e `null` quando nem isso dá — nunca um zero, que leria como "não separa
 * nada".
 */
export function previewDaConversao(
  atual: LoteAtual,
  unidadesPorReceita: number,
  pedido: number = PEDIDO_DE_EXEMPLO,
): PreviewDaConversao | null {
  const conversao = converterLote(atual, unidadesPorReceita)
  if (!conversao || !(pedido > 0)) return null

  const separacao: LinhaDaSeparacao[] = conversao.componentes.map((c) => {
    // ⭐ as DUAS pontas pela MESMA porta: muda só o que ela recebe (lote e dose)
    const antes = insumoDoPedido({ pedido, loteBase: atual.loteBase }, c.qtdPlanejada)
    const depois = insumoDoPedido({ pedido, loteBase: conversao.loteBaseNovo }, c.qtdNova)
    return {
      nome: c.nome,
      unidade: c.unidade,
      antes,
      depois,
      igual: antes != null && depois != null && Math.abs(antes - depois) < 1e-4,
    }
  })

  return {
    conversao,
    pedido: round4(pedido),
    separacao,
    separacaoIntacta: separacao.length > 0 && separacao.every((l) => l.igual),
    soRotulo: conversao.soRotulo,
  }
}

/**
 * PURA. A frase que a tela imprime acima da tabela — o resumo do que vai (ou não) mudar.
 *
 * ⚠️ **Três desfechos, três frases**: se todas dissessem a mesma coisa, o dono pararia de ler
 * (a lição dos 4 motivos de falha da fatura, 31/08). E a frase do caso 1:1 é a mais importante,
 * porque é a de 28 das 30 fichas medidas.
 */
export function fraseDoPreview(p: PreviewDaConversao, unidadeProduto: string): string {
  if (p.soRotulo && p.separacaoIntacta) {
    return (
      `a separação NÃO muda: pedir ${p.pedido} ${unidadeProduto} continua separando exatamente o ` +
      `mesmo material. O que muda é a ficha parar de dizer que produz outra coisa.`
    )
  }
  if (p.separacaoIntacta) {
    return `as doses da ficha mudam de escala, mas a separação de ${p.pedido} ${unidadeProduto} dá no mesmo material.`
  }
  const mudam = p.separacao.filter((l) => !l.igual).length
  return (
    `⚠️ a separação MUDA em ${mudam} de ${p.separacao.length} componente(s) — confira a tabela ` +
    `antes de confirmar: é material saindo da câmara em quantidade diferente.`
  )
}
