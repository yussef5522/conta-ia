// ⭐⭐⭐ RECUSA ENSINA A SAÍDA — o tradutor único de erro do estoque (16/09/2026).
//
// **A régua do dono:** *"erro sem motivo é defeito. A mensagem de falha diz SEMPRE o
// porquê e a saída — o 409 do fornecedor já faz isso, a contagem herda."*
//
// ⛔⛔ **O DEFEITO QUE ISTO FECHA, medido em prod:** a contagem do fermento respondia
// *"Não consegui gravar a contagem"* — **sem motivo**. O servidor tinha a explicação
// inteira na mão (`MovementInvalidError`: *"deixaria o item com 10 unidades e valor
// R$ −31,04 — dinheiro negativo com saldo positivo é um estado que não existe"*) e ela
// **morria no `throw e`** do catch da rota: sem `ContagemError`, virava **500 sem corpo**,
// e o cliente caía no `j.erro ?? 'Não consegui gravar a contagem.'`.
//
// ⚠️ **ERAM 52 `throw e` nas rotas de estoque** — cada um é um 500 mudo esperando a vez.
// Por isso a cura é um tradutor **único** (REGRA 5): erro de domínio tem mensagem e vira
// 422; o que ninguém previu continua 500 — *aí o genérico é honesto*.

import { ContagemError } from './contagem'
import { MovementInvalidError } from './movement'
import { ItensManuaisError } from './itens-manuais'
import { EntradaManualError } from './entrada-manual'
import { PonteError } from './ponte-contas-pagar'
import { RecusaError } from './recusa-nota'
import { ReunitizarError } from './reunitizar-item'
import { SaidaError } from './saida'
import { VendaMapError } from './vendas/venda-map'

export interface RespostaDeErro {
  erro: string
  /** o gesto que RESOLVE — a tela desenha como link. Recusa sem saída é beco. */
  saida?: { rotulo: string; href: string }
  code?: string
  status: number
}

/**
 * ⭐ OS ERROS QUE **TÊM MENSAGEM PRO DONO**. Um erro fora desta lista é coisa que
 * ninguém previu, e aí o 500 genérico é a resposta honesta.
 *
 * ⚠️ Lista FECHADA de propósito: `e instanceof Error` pegaria `TypeError` e
 * `PrismaClientKnownRequestError`, cujas mensagens são para MIM, não para o dono — e
 * jogar stack trace na tela é pior que "não consegui".
 */
const DE_DOMINIO = [
  ContagemError, MovementInvalidError, ItensManuaisError, EntradaManualError,
  PonteError, RecusaError, ReunitizarError, SaidaError, VendaMapError,
] as const

export function ehErroDeDominio(e: unknown): e is Error {
  return DE_DOMINIO.some((C) => e instanceof C)
}

/**
 * ⭐⭐ A SAÍDA DO ESTADO IMPOSSÍVEL — a única recusa do estoque que o dono **não consegue
 * resolver sozinho na tela**, e por isso ela é a que mais precisa ensinar.
 *
 * ⛔ **O caso real (fermento, 16/09):** o item tinha saldo **−1,921** e valor **−R$ 31,04**
 * — resíduo de consumo lançado ANTES da nota de compra. Contar 10 kg (a quantidade
 * CERTA, o que está na prateleira) faz o saldo cruzar o zero com o valor ainda negativo,
 * e o guard de 11/09 recusa, **corretamente**.
 *
 * ⚠️⚠️ **E A MENSAGEM ANTIGA MANDAVA O DONO PRO LUGAR ERRADO:** *"confira a quantidade
 * (ela costuma ser o sintoma)"* — mas aqui a quantidade dele está certa; o sintoma é o
 * VALOR. Mensagem que acusa o campo errado faz o dono caçar um erro que não existe.
 */
export function saidaDoEstadoImpossivel(empresaId: string, itemId?: string): RespostaDeErro['saida'] {
  return itemId
    ? { rotulo: 'ver o histórico deste item e corrigir a entrada que faltou', href: `/empresas/${empresaId}/estoque/itens/${itemId}` }
    : { rotulo: 'ver a posição do estoque', href: `/empresas/${empresaId}/estoque/posicao` }
}

/**
 * ⭐⭐⭐ O TRADUTOR. Toda rota de estoque chama ele no catch.
 *
 * ⛔ Devolve `null` pro erro que ninguém previu — e aí a rota **re-lança**, que é o certo:
 * inventar uma frase amigável pra um bug desconhecido esconde o bug.
 */
export function respostaDeErroDoEstoque(e: unknown, ctx?: { empresaId?: string; itemId?: string }): RespostaDeErro | null {
  if (!ehErroDeDominio(e)) return null

  const code = (e as { code?: string }).code

  // ⛔ o FREIO é 409 de propósito: a tela PERGUNTA de novo, não é erro final (23/08)
  if (e instanceof ContagemError && code === 'FREIO') return { erro: e.message, code, status: 409 }

  if (e instanceof MovementInvalidError && ctx?.empresaId) {
    return { erro: e.message, code: 'ESTADO_IMPOSSIVEL', status: 422, saida: saidaDoEstadoImpossivel(ctx.empresaId, ctx.itemId) }
  }

  return { erro: e.message, code, status: 422 }
}

/**
 * ⭐ A FRASE DA QUANTIDADE INVÁLIDA — o outro pedido do dono: *"formato inválido diz
 * 'usa vírgula: 2,5'"*.
 *
 * ⚠️ Ela mora aqui, e não no componente, porque **quatro telas** digitam quantidade
 * (contagem, entrada manual, saída, produção) e regra que mora em componente é regra que
 * ninguém prova — sem jsdom, o teste não a alcança (a lição do prefill do cardápio).
 */
export function fraseDeQuantidadeInvalida(unidade: string, digitado: string): string {
  const inteira = UNIDADES_INTEIRAS.includes(unidade.toUpperCase())
  if (inteira) {
    return `${unidade} conta em unidades inteiras — "${digitado}" tem fração. `
      + 'Se você usa meia unidade, o item precisa ser cadastrado numa unidade menor.'
  }
  return `Não entendi "${digitado}" — use vírgula pra decimal (ex.: 2,5).`
}

/** ⚠️ a MESMA lista do `lib/stock/quantidade.ts` — unidade que não se parte */
const UNIDADES_INTEIRAS = ['UN', 'UND', 'PC', 'PCT', 'CX', 'DZ', 'PAR', 'FD', 'SC']
