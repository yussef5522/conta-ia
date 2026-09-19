// ⭐⭐⭐ "RECEITA JÁ EXISTE" DEPOIS DE EXCLUÍDA — A RECUSA GANHA AS TRÊS PORTAS (19/09/2026).
//
// **O dono, tentando recriar a CUBA MAIONESE:** *"exclui a receita e na hora de criar de
// novo o sistema diz que já existe."*
//
// ⭐ **E ele estava certo, com uma sutileza que a medição mostrou:** "excluir" uma receita
// COM histórico **DESATIVA** (regra de 16/09 — *"o passado não se reescreve"*), e o
// **item-invólucro continua no estoque com o mesmo nome**. Criar de novo bate no guard de
// 09/09 (`itemDeEstoqueComMesmoNome`), que existe pra impedir DOIS itens com o mesmo nome
// — o defeito das bebidas. **O guard está certo; a recusa é que era um beco.**
//
// ⛔⛔ **A cura NÃO é afrouxar o guard.** Criar assim mesmo faria nascer o segundo item que
// ele existe pra impedir, e a contagem passaria a oferecer os dois. A cura é a recusa
// **carregar o caminho** — a régua do 422 do estoque (16/09) e do 409 do fornecedor (11/09):
// ***recusa ensina a saída***.
//
// **AS TRÊS SAÍDAS, e cada uma resolve um caso REAL diferente:**
//   • **reativar** — é a mesma receita, ele só quis limpar a lista. Volta inteira, com a
//     história e o vínculo do PDV. *É o caso do dono, e por isso é a primária.*
//   • **criar assim mesmo** — é OUTRO produto que por acaso tem o mesmo nome. Nasce com
//     item próprio, e ele fica com dois nomes iguais **porque decidiu**.
//   • **renomear a antiga** — a antiga vira "CUBA MAIONESE (antiga)" e o nome fica livre.
//     ⚠️ Renomear **não apaga nada**: o apelido de busca de 09/09 continua achando pelo
//     nome velho.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { normalizarBusca } from '@/lib/busca-texto'

type Db = PrismaClient | Prisma.TransactionClient

export interface FichaInativaHomonima {
  fichaId: string
  itemProduzidoId: string
  nome: string
  lotes: number
  ativo: false
}

/**
 * ⭐ A ficha DESATIVADA com este nome, se existir.
 *
 * ⚠️ Separada de `fichaAtivaComNome` de propósito: são duas perguntas com duas respostas
 * diferentes. *"Já existe uma ficha ATIVA"* é **edite aquela**; *"existe uma inativa"* é
 * **três caminhos**. Colapsar as duas daria a mesma frase pros dois casos, e o dono
 * acabaria editando o que queria recriar.
 */
export async function fichaInativaComNome(
  companyId: string, nome: string, db: Db = defaultPrisma,
): Promise<FichaInativaHomonima | null> {
  const alvo = normalizarBusca(nome)
  if (!alvo) return null
  const fichas = await db.stockFicha.findMany({ where: { companyId, ativo: false }, select: { id: true, itemProduzidoId: true } })
  if (!fichas.length) return null
  const itens = await db.stockItem.findMany({
    where: { companyId, id: { in: fichas.map((f) => f.itemProduzidoId) } },
    select: { id: true, nome: true },
  })
  const porItem = new Map(itens.map((i) => [i.id, i.nome]))
  for (const f of fichas) {
    const n = porItem.get(f.itemProduzidoId)
    if (n && normalizarBusca(n) === alvo) {
      const lotes = await db.stockProductionOrder.count({ where: { companyId, fichaId: f.id } })
      return { fichaId: f.id, itemProduzidoId: f.itemProduzidoId, nome: n, lotes, ativo: false }
    }
  }
  return null
}

export interface SaidaDaRecusa { acao: 'REATIVAR' | 'CRIAR_ASSIM_MESMO' | 'RENOMEAR_A_ANTIGA'; rotulo: string; primaria?: boolean }

/**
 * ⭐ A recusa montada — a mensagem E as portas, num lugar só.
 *
 * ⚠️ A ordem é deliberada: **reativar primeiro** porque é o caso comum (ele excluiu por
 * engano ou pra limpar). Pôr "criar assim mesmo" no topo treinaria o dedo a duplicar.
 */
export function recusaDeReceitaHomonima(f: FichaInativaHomonima): { mensagem: string; saidas: SaidaDaRecusa[] } {
  const historia = f.lotes > 0
    ? ` Ela tem ${f.lotes} lote${f.lotes === 1 ? '' : 's'} na história — por isso não foi apagada de vez.`
    : ''
  return {
    mensagem:
      `“${f.nome}” existe, mas está DESATIVADA.${historia} Criar outra com o mesmo nome faria nascer ` +
      'um segundo item, e a contagem passaria a oferecer os dois.',
    saidas: [
      { acao: 'REATIVAR', rotulo: `reativar “${f.nome}”`, primaria: true },
      { acao: 'RENOMEAR_A_ANTIGA', rotulo: 'renomear a antiga e liberar o nome' },
      { acao: 'CRIAR_ASSIM_MESMO', rotulo: 'criar assim mesmo (é outro produto)' },
    ],
  }
}

export class ReceitaHomonimaError extends Error {
  readonly ficha: FichaInativaHomonima
  readonly saidas: SaidaDaRecusa[]
  constructor(f: FichaInativaHomonima) {
    const r = recusaDeReceitaHomonima(f)
    super(r.mensagem)
    this.name = 'ReceitaHomonimaError'
    this.ficha = f
    this.saidas = r.saidas
  }
}

/**
 * ⭐ REATIVAR — a ficha volta inteira: a história, as versões e o vínculo do PDV.
 *
 * ⛔ Não cria nada: é a MESMA ficha. Criar uma cópia "limpa" jogaria fora o rendimento
 * medido, que é o número mais caro que este módulo produz.
 */
export async function reativarFicha(companyId: string, fichaId: string, db: Db = defaultPrisma) {
  const f = await db.stockFicha.findFirst({ where: { id: fichaId, companyId }, select: { id: true, itemProduzidoId: true } })
  if (!f) throw new Error('Ficha não encontrada.')
  await db.stockFicha.update({ where: { id: f.id }, data: { ativo: true } })
  // ⚠️ o item-invólucro volta junto: ficha ativa com item inativo some do cardápio e do
  // planejar, e o dono acharia que a reativação não pegou.
  await db.stockItem.update({ where: { id: f.itemProduzidoId }, data: { ativo: true } })
  return { fichaId: f.id, itemProduzidoId: f.itemProduzidoId }
}

/**
 * ⭐ RENOMEAR A ANTIGA — libera o nome sem perder o passado.
 *
 * ⚠️ Passa pelo `renomearEmLote` de sempre (REGRA 4), que é quem grava o **apelido de
 * busca** — sem ele, procurar pelo nome velho pararia de achar a história, que é
 * exatamente a tabela de apelido que nasceu em 09/09 pra impedir.
 */
export function nomeDaAntiga(nome: string): string {
  return `${nome} (antiga)`
}
