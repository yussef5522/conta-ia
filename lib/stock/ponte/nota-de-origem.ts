// ⭐ "VER NOTA DE ORIGEM" — o caminho de volta da conta a pagar pra a nota (30/08/2026).
//
// A ponte já sabia ir do estoque pro financeiro. Faltava a volta: o dono abre o Contas a
// Pagar, vê "FRIGORIFICO SILVA — NF 2407777" e quer saber o que veio no caminhão. Sem o
// link ele teria que decorar o número da nota e caçar na tela de Recebimentos.
//
// ⚠️ POR QUE A FUNÇÃO MORA NO MÓDULO DE ESTOQUE, e não na rota do financeiro: quem
// conhece `stock_payable_link` e `stock_receipt_conference` é o estoque. A rota do
// financeiro chama ESTA função e recebe um `{ transactionId → href }` pronto — não
// aprende o esquema do estoque, não repete o join, e o dia em que o recibo mudar de
// endereço muda um arquivo só (REGRA 4).
//
// ⚠️ E é LEITURA PURA — nada aqui escreve em lugar nenhum. A exceção desenhada ao
// isolamento (o estoque escrevendo em `transactions`/`suppliers`) continua sendo só a
// ponte de criação; esta é a seta de volta, e ela só lê.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'

export interface NotaDeOrigem {
  nfeId: string
  chave: string | null
  /** nº da NF extraído da chave (posições 26..34), pra exibir sem outro join */
  nNF: string | null
  /** pra onde a tela manda o dono: o RECIBO quando a nota já foi conferida, senão a fila */
  href: string
}

const nNFdaChave = (chave: string | null | undefined) =>
  chave && chave.length === 44 ? String(Number(chave.slice(25, 34))) : null

/**
 * Dado um punhado de contas a pagar, devolve quais vieram de nota do estoque.
 *
 * ⚠️ Recebe os IDs da PÁGINA que a tela está mostrando (não varre a tabela inteira): a
 * lista do financeiro pagina, e resolver o universo todo pra exibir 50 linhas seria pagar
 * caro por dado que ninguém vai ver.
 */
export async function notasDeOrigem(
  companyId: string,
  transactionIds: string[],
  db: PrismaClient = defaultPrisma,
): Promise<Map<string, NotaDeOrigem>> {
  const out = new Map<string, NotaDeOrigem>()
  if (transactionIds.length === 0) return out

  const links = await db.stockPayableLink.findMany({
    where: { companyId, origem: 'NFE', transactionId: { in: transactionIds } },
    select: { transactionId: true, refId: true, chave: true },
  })
  if (links.length === 0) return out

  // a conferência é o que dá o recibo; nota ainda não conferida cai na fila
  const confs = await db.stockReceiptConference.findMany({
    where: { companyId, nfeId: { in: [...new Set(links.map((l) => l.refId))] } },
    select: { id: true, nfeId: true },
  })
  const reciboDaNota = new Map(confs.map((c) => [c.nfeId, c.id]))

  for (const l of links) {
    const conferenceId = reciboDaNota.get(l.refId)
    out.set(l.transactionId, {
      nfeId: l.refId,
      chave: l.chave,
      nNF: nNFdaChave(l.chave),
      href: conferenceId
        ? `/empresas/${companyId}/estoque/recibos/${conferenceId}`
        : `/empresas/${companyId}/estoque/recebimentos/${l.refId}`,
    })
  }
  return out
}
