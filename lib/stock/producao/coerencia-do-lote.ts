/**
 * ⭐⭐⭐ A PORTA DO RENDIMENTO — *"a ficha é a casa do número"* (11/10/2026).
 *
 * **Ordem do dono:** *"Criar/editar ficha EXIGE coerência: produto contado em UN ⇒ «A receita
 * rende» declarado em UN (o editor não salva torto). (…) o rendimento se declara UMA vez, na
 * ficha; nunca se pergunta de novo na ordem."*
 *
 * ═══ ⛔⛔ O QUE ESTA RÉGUA IMPEDE, medido ═══
 *
 * `loteBase` é o número que **divide o pedido** na porta da separação (`escala = pedido ÷
 * loteBase`). Declarado numa unidade que não é a do produto, ele **não responde** *"quantas UN
 * saem de 1 receita"* — e o `beef de xis` provou o custo disso: com `rende 1 KG` num produto
 * contado em UN, a conversão `pedido → escala` ficou à mercê do rendimento MEDIDO, e pedir 10
 * separava material pra 6,7 (03/10). Daí nasceu a lei *"a separação é SEMPRE ficha × pedido"*;
 * **esta porta é a outra metade dela** — a que impede o rótulo torto de nascer.
 *
 * ═══ ⚠️ O ESCOPO É O MESMO DO M5, E ISSO NÃO É DETALHE ═══
 *
 * A régua vale **só pra ficha que a cozinha PRODUZ por ordem** (`comoConsome === 'ESTOCADO'`).
 * No invólucro de cardápio (PRODUTO_FINAL/SABOR) **não existe "lote"**: ele monta na venda, e o
 * `loteBase` ali é enfeite. **Medido em prod (11/10):** o sabor `CALABRESA` está com
 * `rende 1 KG` num produto contado em UN — e é **o sabor de maior volume do cardápio**. Uma
 * régua global bloquearia a edição dele por um campo que a venda nem lê. *Guard largo demais
 * reprova o certo e ensina a afrouxar a régua.*
 *
 * ⛔ E o escopo DERIVA de `comoConsome` (o dono único do vocabulário de tipo), nunca de uma
 * lista reescrita aqui — três cópias do `tipoProduto === 'INTERMEDIARIO'` divergiriam no
 * primeiro tipo novo, que é a lição do B1 e do `loteEhComparavel`.
 */

import { comoConsome } from '../explodir-receita'
import { loteEhComparavel } from './lote-comparavel'

/**
 * PURA. Esta ficha é das que **declaram rendimento** (a cozinha produz por ordem)?
 *
 * ⚠️⚠️ **TIPO DESCONHECIDO CAI NO LADO QUE EXIGE — e eu escrevi o contrário aqui antes de
 * RODAR o guard (11/10).** `comoConsome` é **denylist** (`ATRAVESSA_POR_TIPO` lista os dois
 * invólucros; o resto é `ESTOCADO`), então tipo novo é tratado como estocado em TODO o módulo —
 * ele se conta na prateleira e se produz por ordem. Exigir o rendimento dele é **coerente com o
 * resto**, e o custo do erro é uma recusa COM frase que ensina, nunca um estrago calado.
 * *Comentário que afirma o contrário do código é pior que comentário nenhum* — foi a REGRA 11
 * que pegou este.
 */
export function fichaDeclaraRendimento(tipoProduto: string): boolean {
  return comoConsome(tipoProduto) === 'ESTOCADO'
}

/**
 * ⭐⭐ A RÉGUA VOCABULARY-FREE: *"o rótulo do rendimento está na unidade do produto?"*
 *
 * ⛔ Esta é a que o **TRIGGER do banco** espelha (ele não conhece `tipoProduto` — duplicar o
 * vocabulário no SQL é a cicatriz de 21/09, em que CHECK com lista fechada virou parede em um
 * dia). Ela vale pra **qualquer** tipo no NASCIMENTO: ficha nova não tem motivo pra nascer com
 * o rótulo numa unidade que não é a do produto — nem no cardápio, onde o número é enfeite.
 *
 * ⚠️ No EDITAR ela **não** vale sozinha: `MAIONESE` e `CALABRESA` já existem tortas, e exigir
 * coerência ali trancaria a edição legítima delas. Lá quem manda é a catraca (recusa só a
 * REGRESSÃO) — a mesma régua do trigger.
 */
export function avaliarCoerenciaDoRotulo(e: {
  unidadeLoteBase: string
  unidadeProduto: string
  nomeProduto?: string
}): CoerenciaDoLote {
  if (loteEhComparavel(e.unidadeLoteBase, e.unidadeProduto)) return { ok: true, frase: null }
  const quem = e.nomeProduto ? `“${e.nomeProduto}”` : 'este produto'
  return {
    ok: false,
    frase:
      `${quem} se conta em ${e.unidadeProduto}, então “A receita rende” tem que estar em ` +
      `${e.unidadeProduto} — está em ${e.unidadeLoteBase}. O rótulo do rendimento é SEMPRE a ` +
      'unidade em que o produto se conta.',
  }
}

export interface CoerenciaDoLote {
  /** `false` só quando a ficha declara rendimento E a unidade não é a do produto */
  ok: boolean
  /** a frase que ENSINA a saída — `null` quando está coerente */
  frase: string | null
}

/**
 * PURA. A porta: *"o que esta receita rende está declarado na unidade em que o produto se conta?"*
 *
 * ⭐ A recusa **diz o número que falta e onde ele mora** — recusa que não aponta a saída é
 * beco, e beco é o que esta casa mais paga (a régua da porta do negativo, 22/09).
 */
export function avaliarCoerenciaDoLote(e: {
  tipoProduto: string
  unidadeLoteBase: string
  /** a unidade em que o item produzido se CONTA */
  unidadeProduto: string
  /** só pra a frase ficar concreta */
  nomeProduto?: string
}): CoerenciaDoLote {
  if (!fichaDeclaraRendimento(e.tipoProduto)) return { ok: true, frase: null }
  if (loteEhComparavel(e.unidadeLoteBase, e.unidadeProduto)) return { ok: true, frase: null }

  const quem = e.nomeProduto ? `“${e.nomeProduto}”` : 'este produto'
  return {
    ok: false,
    frase:
      `${quem} se conta em ${e.unidadeProduto}, então “A receita rende” tem que estar em ` +
      `${e.unidadeProduto} — está em ${e.unidadeLoteBase}. Diga quantas ${e.unidadeProduto} saem ` +
      `de 1 receita: é esse número que divide o pedido quando a cozinha separa o material.`,
  }
}
