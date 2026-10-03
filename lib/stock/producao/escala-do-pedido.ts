/**
 * ⛔⛔⛔ OS AVISOS DO ATO DA CRIAÇÃO DA ORDEM (item 4b, 03/10/2026).
 *
 * **O caso vivo que criou este arquivo:** ordem de **10 beef de xis** propondo separar material
 * pra **~6,7** (0,617 de acém onde a ficha pede 0,910).
 *
 * ⭐⭐ **E A DECISÃO DO DONO (mesmo dia) MUDOU A NATUREZA DESTE ARQUIVO:** *"receita é lei,
 * rendimento é só relatório — a separação é SEMPRE ficha × pedido"*. Com isso **a aritmética
 * da separação deixou de ter como errar**: `escalaDoPedido` é `pedido ÷ loteBase` e ponto.
 *
 * ⛔ **Por isso o aviso `SEPARACAO_DESTOA` MORREU** — ele comparava a separação proposta com a
 * dose nominal, e agora **as duas são a mesma coisa por construção**. Aviso que não tem como
 * disparar é pior que aviso nenhum: ele ocupa espaço na tela e ensina o dono a não ler a
 * faixa âmbar. (O teste dele foi invertido com o motivo escrito, não apagado.)
 *
 * ⭐ **O que sobrou é o que continua podendo estar errado — e os dois são do DADO, não da conta:**
 *
 * 1. **O LOTE NÃO É COMPARÁVEL** (`unidadeLoteBase` ≠ unidade em que o produto se conta) → o
 *    `loteBase` não responde *"quantas unidades saem de 1 receita"*, e agora ele é **o único
 *    divisor que existe**. ⚠️ Este aviso ficou MAIS importante depois da decisão, não menos:
 *    antes a média mascarava um lote mal declarado; agora ele aparece na separação.
 * 2. **A EFICIÊNCIA MÉDIA DESTOA DA FICHA** → espelho puro: *"seus últimos N lotes renderam
 *    125% do que a ficha promete"*. **Denuncia, não corrige** (palavras do dono) — a separação
 *    segue a ficha, e quem decide se a ficha muda é ele.
 *
 * ⛔ **E ELES AVISAM, NUNCA BLOQUEIAM.** Travar a criação pararia a cozinha por causa de uma
 * ficha mal declarada — e são **36 de 43** hoje. A régua da casa é a mesma do FREIO da
 * contagem e da sanidade do import: *pergunta com o número na tela, nunca recusa cega*.
 */

import type { EficienciaMedia } from './previsao-rendimento'
import { DESVIO_ALERTA } from './previsao-rendimento'

export type MotivoDoAvisoDaEscala = 'MEDIA_DESTOA' | 'LOTE_NAO_COMPARAVEL'

export interface AvisoDaEscala {
  motivo: MotivoDoAvisoDaEscala
  frase: string
}

export interface PedidoDaOrdem {
  /** quantas unidades do produto o dono quer */
  pedido: number
  /** `loteBase` da versão vigente — o ÚNICO número da ficha que entra na escala */
  loteBase: number
  unidadeLoteBase: string
  /** unidade em que o item produzido se CONTA */
  unidadeProduto: string
  /** a maior dose da ficha, pra o aviso falar em KG de algo concreto */
  maiorDose?: { nome: string; dose: number } | null
  /**
   * ⭐ O espelho da medição. **Não entra em conta nenhuma** — só na frase.
   *
   * ⛔⛔ E repare no que NÃO existe neste tipo: não há `escala` nem `regua`. **Não dá pra
   * comparar a separação com nada aqui, porque não há com o que comparar** (REGRA 5) — a
   * separação é a ficha, e a ficha é a referência.
   */
  espelho?: EficienciaMedia | null
}

const r3 = (n: number) => Math.round((n + 1e-9) * 1000) / 1000
const pct = (n: number) => `${Math.round(n * 100)}%`

/**
 * PURA. Os avisos de uma ordem que está nascendo — vazio quando está tudo coerente.
 *
 * ⚠️ A ORDEM DA LISTA É A DA CAUSA: o lote não-comparável primeiro, porque é ele que pode
 * tornar a conta da escala sem sentido; a eficiência depois, porque é observação. Dizer a
 * consequência antes da causa manda o dono procurar no lugar errado (a lição de 16/09).
 */
export function avisosDaEscala(p: PedidoDaOrdem): AvisoDaEscala[] {
  const out: AvisoDaEscala[] = []

  if (p.unidadeLoteBase !== p.unidadeProduto) {
    const nominal = p.maiorDose && p.maiorDose.dose > 0 && p.pedido > 0 && p.loteBase > 0
      ? ` A separação vai pedir ${r3((p.maiorDose.dose * p.pedido) / p.loteBase)} de ${p.maiorDose.nome} — confira se é isso.`
      : ''
    out.push({
      motivo: 'LOTE_NAO_COMPARAVEL',
      frase:
        `a ficha declara que 1 receita produz ${p.loteBase} ${p.unidadeLoteBase}, mas o produto se ` +
        `conta em ${p.unidadeProduto} — o lote base não diz quantas ${p.unidadeProduto} saem de uma ` +
        `receita, e é ele que divide o seu pedido.${nominal}`,
    })
  }

  /**
   * ⭐ A DENÚNCIA (item 2 do dono): a média destoa do que a ficha promete.
   *
   * ⚠️ A faixa é a MESMA ±15% da eficiência por ordem e do juiz P3 — número solto aqui seria
   * a segunda régua no dia em que a faixa mudasse.
   */
  if (p.espelho && Math.abs(p.espelho.pct - 1) > DESVIO_ALERTA + 1e-9) {
    const lado = p.espelho.pct < 1 ? 'MENOS' : 'MAIS'
    out.push({
      motivo: 'MEDIA_DESTOA',
      frase:
        `os seus últimos ${p.espelho.lotes} lotes renderam ${pct(p.espelho.pct)} do que a ficha ` +
        `promete — está saindo ${lado} do que a receita diz. **A separação segue a ficha**; se a ` +
        `perda é real, mude a ficha. Se não, confira a operação e o lançamento dos lotes.`,
    })
  }

  return out
}
