/**
 * ⛔⛔⛔ A CONVERSÃO "QUERO N" → ESCALA, com dono único e com GUARD (item 4b, 03/10/2026).
 *
 * **O caso vivo que criou este arquivo:** ordem de **10 beef de xis** propondo separar material
 * pra **~6,7** (0,617 de acém onde a ficha pede 0,910). O dono: *"achar a RAIZ, revisar TODAS as
 * fichas, matar pra sempre."*
 *
 * ⚠️⚠️ **E A ARITMÉTICA NÃO DÁ PRA AUDITAR DEPOIS — ela fecha por construção.** `separação ÷
 * pedido` sempre vai dar `dose ÷ rendimento`, qualquer que seja o rendimento usado. Então um
 * guard que confira a CONTA nunca morde. **O que dá pra auditar é a ENTRADA da conta:** o
 * rendimento que ela usou é confiável?
 *
 * ⭐ Por isso o guard pergunta três coisas, na ordem em que elas doem:
 *
 * 1. **A medição DISCORDA da ficha** (fora de ±20%) → o plano voltou pro declarado, e a tela
 *    tem que DIZER, porque um dos dois está errado e **quem decide é o dono**.
 * 2. **O lote não é comparável** (`unidadeLoteBase` ≠ unidade do produto) → o teórico não
 *    responde "quantas unidades saem de 1 receita", e o plano fica à mercê da média. É o M5.
 * 3. **A separação proposta destoa da dose nominal** → o número final, em KG, ao lado do que
 *    a ficha pede. É o que o dono vê e reconhece na hora.
 *
 * ⛔ **E ELE AVISA, NÃO BLOQUEIA.** Travar a criação da ordem pararia a cozinha por causa de
 * uma ficha mal declarada — e são **36 de 43** hoje. A régua da casa é a mesma do FREIO da
 * contagem e da sanidade do import: *pergunta com o número na tela, nunca recusa cega*.
 */

import type { Regua } from './previsao-rendimento'

export type MotivoDoAvisoDaEscala = 'MEDIA_DISCORDA' | 'LOTE_NAO_COMPARAVEL' | 'SEPARACAO_DESTOA'

export interface AvisoDaEscala {
  motivo: MotivoDoAvisoDaEscala
  frase: string
}

export interface PedidoDaOrdem {
  /** quantas unidades do produto o dono quer */
  pedido: number
  /** a escala que a conversão produziu (`pedido ÷ régua`) */
  escala: number
  regua: Regua
  /** `loteBase` da versão vigente */
  loteBase: number
  unidadeLoteBase: string
  /** unidade em que o item produzido se CONTA */
  unidadeProduto: string
  /** a maior dose da ficha, pra o aviso falar em KG de algo concreto */
  maiorDose?: { nome: string; dose: number } | null
}

const r3 = (n: number) => Math.round((n + 1e-9) * 1000) / 1000
const pct = (n: number) => `${Math.round(n * 100)}%`

/**
 * PURA. Os avisos de uma ordem que está nascendo — vazio quando está tudo coerente.
 *
 * ⚠️ A ORDEM DA LISTA É A DA CAUSA: `MEDIA_DISCORDA` primeiro porque é o que o dono pode
 * resolver hoje (conferir a ficha ou o lançamento do lote estranho); `SEPARACAO_DESTOA` por
 * último porque é a CONSEQUÊNCIA — dizer a consequência antes da causa manda o dono procurar
 * no lugar errado (a lição de 16/09: *"mensagem que acusa o campo errado faz o dono caçar um
 * erro que não existe"*).
 */
export function avisosDaEscala(p: PedidoDaOrdem): AvisoDaEscala[] {
  const out: AvisoDaEscala[] = []

  if (p.regua.discordante && p.regua.pct != null) {
    out.push({
      motivo: 'MEDIA_DISCORDA',
      frase:
        `a média dos últimos ${p.regua.lotes} lotes diz ${r3(p.regua.pct)}× o que a ficha promete ` +
        `(${pct(p.regua.pct)}) — discordância grande, então o plano usou o que a FICHA declara ` +
        `(${p.loteBase} por receita). Confira a ficha ou o lançamento dos lotes estranhos.`,
    })
  }

  if (p.unidadeLoteBase !== p.unidadeProduto) {
    out.push({
      motivo: 'LOTE_NAO_COMPARAVEL',
      frase:
        `a ficha declara que 1 receita produz ${p.loteBase} ${p.unidadeLoteBase}, mas o produto se ` +
        `conta em ${p.unidadeProduto} — o lote base não diz quantas ${p.unidadeProduto} saem de uma ` +
        `receita, e a conversão "quero ${p.pedido}" fica dependendo do rendimento medido.`,
    })
  }

  /**
   * ⭐ O NÚMERO FINAL, em cima do componente de maior dose — é o que o dono reconhece de
   * olho ("pedi 10 e vai separar 0,617 de acém onde a ficha pede 0,910").
   *
   * ⚠️ A comparação é com a dose NOMINAL (`dose × pedido`), e a tolerância é a faixa de
   * concordância: separar 6% a mais é a folga real de trim que a cozinha tem todo dia (o
   * `beef de hamburger` roda nisso e é legítimo). Abaixo disso o aviso seria ruído diário.
   */
  if (p.maiorDose && p.maiorDose.dose > 0 && p.pedido > 0) {
    const nominal = p.maiorDose.dose * p.pedido
    const proposto = p.maiorDose.dose * p.escala
    const razao = nominal > 0 ? proposto / nominal : 1
    if (Math.abs(razao - 1) > 0.2 + 1e-9) {
      out.push({
        motivo: 'SEPARACAO_DESTOA',
        frase:
          `pedindo ${p.pedido}, a separação vai propor ${r3(proposto)} de ${p.maiorDose.nome} — ` +
          `a ficha pede ${r3(nominal)} para ${p.pedido} (${pct(razao)}). ` +
          `${razao < 1 ? 'Vai faltar material.' : 'Vai sair material a mais.'}`,
      })
    }
  }

  return out
}
