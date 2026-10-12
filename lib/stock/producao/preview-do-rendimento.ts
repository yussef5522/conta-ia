/**
 * ⭐⭐ "SEPARA HOJE × SEPARA DEPOIS" — o preview do rendimento no editor (11/10/2026, item 2c).
 *
 * **Ordem do dono:** *"o editor mostra o preview «separa hoje × separa depois» ao mudar o
 * rendimento — **o medido NUNCA é sugerido** (medição não entra na conta)."*
 *
 * ⛔⛔ **POR QUE ISTO É LIB PURA E NÃO UMA CONTA NO JSX:** o projeto roda em `environment: node`,
 * **sem jsdom** — régua que mora dentro de um `onChange` é régua que ninguém prova. Foi assim que
 * o prefill do cardápio quebrou **duas vezes** (28/08).
 *
 * ⛔⛔ **E O "VAI SEPARAR" SAI DA PORTA DA SEPARAÇÃO (`insumoDoPedido`), NUNCA DE UMA CONTA
 * DAQUI.** Escrever `dose × pedido / loteBase` aqui faria o editor prometer um material e a
 * ordem separar outro — e o dono descobriria **com a carne na mão**. É a lição dos 7 detectores
 * de par aplicada a uma multiplicação (a mesma de `tabelaDaPergunta`, 11/10).
 *
 * ⚠️ **O MEDIDO NÃO ENTRA, e isso é a lei de 03/10:** a separação é SEMPRE ficha × pedido. Um
 * editor que sugerisse o rendimento medido seria o laço que *"aprende o roubo como normal"* —
 * exatamente o que o dono matou naquele dia. O medido pode ser ESPELHO na tela; aqui ele não
 * aparece nem como palpite.
 */
import { insumoDoPedido } from './escala-da-ordem'

export interface ComponenteDoPreview {
  itemId: string
  nome: string
  unidade: string
  qtdPlanejada: number
}

export interface LinhaDoPreview {
  itemId: string
  nome: string
  unidade: string
  /** o que a ordem separa HOJE, com o rendimento que está gravado */
  hoje: number | null
  /** o que ela passaria a separar com o rendimento que o dono está digitando */
  depois: number | null
  /** `depois − hoje` — `null` quando um dos lados não dá pra calcular */
  delta: number | null
}

export interface PreviewDoRendimento {
  /** o pedido da simulação, em unidades do produto */
  pedido: number
  linhas: LinhaDoPreview[]
  /** ⭐ `true` quando NADA se move — é o caso do rótulo errado (a conversão neutra) */
  naoMuda: boolean
  /** a maior diferença absoluta vista — o número que a tela destaca */
  piorDelta: number
  /**
   * ⚠️ `true` quando o número digitado ainda não dá pra calcular nada (vazio, zero, lixo). A
   * tela mostra o preview **apagado**, nunca uma tabela de zeros: zero é uma afirmação, e dizer
   * *"vai separar 0"* antes de o dono digitar é a mesma mentira do *"pedido 0"* (11/10).
   */
  semNumero: boolean
}

/**
 * ⚠️ O pedido da simulação é **PARÂMETRO**, nunca um número escolhido aqui dentro: a tela usa o
 * pedido que o dono está olhando (ou um redondo), e dois lugares escolhendo o pedido dariam dois
 * previews pro mesmo gesto.
 */
export function previewDoRendimento(e: {
  loteBaseAtual: number
  loteBaseNovo: number | null
  componentes: ComponenteDoPreview[]
  pedido: number
}): PreviewDoRendimento {
  const semNumero = e.loteBaseNovo == null || !(e.loteBaseNovo > 0) || !(e.pedido > 0)
  const linhas: LinhaDoPreview[] = []
  let pior = 0

  for (const c of e.componentes) {
    const hoje = semNumero ? null : insumoDoPedido({ pedido: e.pedido, loteBase: e.loteBaseAtual }, c.qtdPlanejada)
    const depois = semNumero ? null : insumoDoPedido({ pedido: e.pedido, loteBase: e.loteBaseNovo! }, c.qtdPlanejada)
    const delta = hoje != null && depois != null ? Math.round((depois - hoje) * 1e6) / 1e6 : null
    if (delta != null) pior = Math.max(pior, Math.abs(delta))
    linhas.push({ itemId: c.itemId, nome: c.nome, unidade: c.unidade, hoje, depois, delta })
  }

  return {
    pedido: e.pedido,
    linhas,
    // ⚠️ sem número não é "não muda" — é "não sei"; os dois estados são distintos na tela
    naoMuda: !semNumero && pior === 0,
    piorDelta: pior,
    semNumero,
  }
}

/**
 * PURA. A frase do preview — curta, do jeito que o dono lê.
 *
 * ⭐ Ela DIZ quando nada se move, porque é essa a notícia que ele precisa: *"corrigir o rótulo
 * não mexe na prateleira"*. Recusa (e confirmação) que não diz o efeito é um clique no escuro.
 */
export function fraseDoPreview(p: PreviewDoRendimento): string {
  if (p.semNumero) return 'diga o rendimento pra eu mostrar o que muda na separação'
  if (p.naoMuda) return `a separação NÃO muda — pedir ${p.pedido} continua tirando o mesmo material da câmara`
  const n = p.piorDelta.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
  return `a separação MUDA — em ${p.pedido} unidades, até ${n} de diferença no componente`
}
