// ⭐⭐⭐ EXCLUIR RECEITA — e o SERVIDOR decide qual dos dois casos é (16/09/2026).
//
// **A régua do dono:**
//   - receita **sem lote na história** → **exclui de vez**. *"Rascunho que nasceu errado
//     não merece cerimônia."*
//   - receita **com lotes** → **DESATIVA**: some das listas de planejar/produzir e não
//     entra em custo novo, **e os lotes antigos continuam apontando pra ela** com nome e
//     versões. ***O passado não se reescreve*** — a mesma regra do fornecedor mesclado
//     (11/09) e do item desativado (09/09).
//
// ⛔⛔ **A TRAVA MORA AQUI, NÃO NA TELA.** A tela só PERGUNTA; quem olha a história e
// escolhe o caso é o servidor. É a régua do FREIO da contagem (23/08): *"aviso que vive no
// componente some no dia em que a rota for chamada por outro caminho"* — e uma tela que
// decidisse "pode apagar" mandaria o `DELETE` de uma receita com 40 lotes.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'

export class ExcluirFichaError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message)
    this.name = 'ExcluirFichaError'
  }
}

/** ⭐ o que o servidor vai fazer — a tela mostra ANTES, no confirm */
export interface PrevisaoDaExclusao {
  caso: 'EXCLUI' | 'DESATIVA'
  fichaId: string
  nome: string
  /** quantos lotes existem na história (o que decide o caso) */
  lotes: number
  /** ⚠️ quem mais depende dela — some no confirm, porque desativar tem efeito colateral */
  usadaEmFichas: string[]
  mapeadaNoPdv: number
  /** a frase que o confirm imprime — nunca um "tem certeza?" seco */
  frase: string
}

/**
 * ⭐⭐ A PREVISÃO — **a MESMA função que o confirm usa e que a exclusão executa**.
 *
 * ⛔ Se a tela calculasse o caso por conta própria, ela diria *"será excluída"* e o
 * servidor desativaria (ou pior, o contrário) — a divergência entre o que se promete e o
 * que se faz é a doença que o `resolveImportStatuses` existe pra impedir desde 14/08.
 */
export async function preverExclusaoDaFicha(
  companyId: string, fichaId: string, db: PrismaClient = defaultPrisma,
): Promise<PrevisaoDaExclusao> {
  const ficha = await db.stockFicha.findFirst({
    where: { id: fichaId, companyId },
    select: { id: true, itemProduzidoId: true },
  })
  if (!ficha) throw new ExcluirFichaError('Receita não encontrada.')

  /**
   * ⚠️ O NOME VEM DE OUTRA CONSULTA, e isso é o ISOLAMENTO do módulo, não desleixo: as
   * tabelas `stock_` guardam `companyId` como **VALOR sem `@relation`** (Fase 0), então
   * não há navegação de relação — a migration não referencia tabela fechada nenhuma.
   */
  const itemProduzido = await db.stockItem.findFirst({
    where: { id: ficha.itemProduzidoId }, select: { nome: true },
  })
  const nome = itemProduzido?.nome ?? 'receita'

  /**
   * ⛔ **A HISTÓRIA É A ORDEM DE PRODUÇÃO, não o movimento.** Uma ordem CANCELADA também
   * conta: ela é passado, tem material separado e devolvido, e aparece nos relatórios.
   * Contar só as CONCLUIDAS apagaria a história de quem cancelou — e é história.
   */
  const lotes = await db.stockProductionOrder.count({ where: { companyId, fichaId } })

  // ⚠️ quem depende dela: outra receita que a usa como ingrediente
  const versoes = await db.stockFichaVersao.findMany({ where: { companyId, fichaId }, select: { id: true } })
  void versoes
  const comoComponente = await db.stockFichaComponente.findMany({
    where: { companyId, itemId: ficha.itemProduzidoId },
    select: { versaoId: true },
  })
  const versoesQueUsam = await db.stockFichaVersao.findMany({
    where: { id: { in: comoComponente.map((c) => c.versaoId) } },
    select: { fichaId: true },
  })
  const fichasQueUsam = await db.stockFicha.findMany({
    where: { id: { in: [...new Set(versoesQueUsam.map((v) => v.fichaId))] }, ativo: true },
    select: { itemProduzidoId: true },
  })
  const itensDasFichas = await db.stockItem.findMany({
    where: { id: { in: fichasQueUsam.map((f) => f.itemProduzidoId) } },
    select: { nome: true },
  })
  const usadaEmFichas = [...new Set(itensDasFichas.map((i) => i.nome))]

  const mapeadaNoPdv =
    (await db.stockVendaProdutoMap.count({ where: { companyId, fichaId } }))
    + (await db.stockVendaComplementoMap.count({ where: { companyId, fichaId } }))

  const caso: PrevisaoDaExclusao['caso'] = lotes > 0 ? 'DESATIVA' : 'EXCLUI'

  const partes: string[] = []
  partes.push(caso === 'DESATIVA'
    ? `"${nome}" tem ${lotes} lote${lotes > 1 ? 's' : ''} na história — ela será DESATIVADA e o histórico preservado.`
    : `"${nome}" nunca foi produzida — ela será EXCLUÍDA de vez.`)

  // ⚠️ o efeito colateral aparece ANTES, não depois: desativar tira ela de outras receitas
  if (usadaEmFichas.length > 0) {
    partes.push(`⚠️ ela é ingrediente de: ${usadaEmFichas.join(', ')} — essas receitas ficam sem esse componente.`)
  }
  if (mapeadaNoPdv > 0) {
    partes.push(`⚠️ ${mapeadaNoPdv} nome${mapeadaNoPdv > 1 ? 's' : ''} do PDV aponta${mapeadaNoPdv > 1 ? 'm' : ''} pra ela — a venda desses nomes para de baixar estoque.`)
  }

  return { caso, fichaId, nome, lotes, usadaEmFichas, mapeadaNoPdv, frase: partes.join(' ') }
}

export interface ResultadoDaExclusao {
  caso: 'EXCLUI' | 'DESATIVA'
  nome: string
  /** ⭐ o EFEITO no destino, pra tela dizer o que aconteceu (nunca "ok") */
  efeito: string
  /** o item-invólucro foi apagado junto? (só quando ele não tem movimento) */
  itemApagado: boolean
}

/**
 * ⭐⭐⭐ O GESTO. Ele **re-avalia o caso dentro da transação** — não confia no que a tela
 * mandou.
 *
 * ⚠️ Entre o confirm e o clique pode nascer um lote (a cozinha produz enquanto o dono
 * decide). Re-avaliar aqui é o que impede o `DELETE` de uma receita que **acabou de ganhar
 * história** — a mesma disciplina do `@@unique` da contagem aberta (23/08).
 */
export async function excluirFicha(
  companyId: string, fichaId: string, db: PrismaClient = defaultPrisma, userId?: string,
  /**
   * ⭐⭐ O QUE A TELA PROMETEU AO DONO no confirm.
   *
   * ⛔ Serve pra UMA coisa: quando o servidor decide **diferente** do que foi prometido
   * (a cozinha produziu enquanto ele lia), a resposta **DIZ que mudou** em vez de
   * anunciar o desfecho genérico. *Fazer diferente do que se prometeu e não avisar é a
   * família do clique que gravou em silêncio (14/09).*
   *
   * ⚠️ Ele **não decide nada** — a trava segue sendo a história, medida aqui.
   */
  casoPrometido?: 'EXCLUI' | 'DESATIVA',
): Promise<ResultadoDaExclusao> {
  const previa = await preverExclusaoDaFicha(companyId, fichaId, db)

  if (previa.caso === 'DESATIVA') {
    await db.stockFicha.update({ where: { id: fichaId }, data: { ativo: false } })
    const mudou = casoPrometido === 'EXCLUI'
    return {
      caso: 'DESATIVA', nome: previa.nome, itemApagado: false,
      efeito: mudou
        ? `"${previa.nome}" ganhou ${previa.lotes} lote(s) enquanto você decidia — foi DESATIVADA em vez de excluída, e a história ficou`
        : `"${previa.nome}" saiu do planejar e do produzir · os ${previa.lotes} lote(s) antigos seguem no histórico`,
    }
  }

  return db.$transaction(async (tx) => {
    // ⛔ RE-AVALIA DENTRO DA TRANSAÇÃO: se um lote nasceu no meio, vira desativação
    const agora = await tx.stockProductionOrder.count({ where: { companyId, fichaId } })
    if (agora > 0) {
      await tx.stockFicha.update({ where: { id: fichaId }, data: { ativo: false } })
      return {
        caso: 'DESATIVA' as const, nome: previa.nome, itemApagado: false,
        efeito: `"${previa.nome}" ganhou ${agora} lote(s) enquanto você decidia — foi DESATIVADA em vez de excluída, e a história ficou`,
      }
    }

    const ficha = await tx.stockFicha.findFirstOrThrow({
      where: { id: fichaId, companyId }, select: { itemProduzidoId: true },
    })
    const versoes = await tx.stockFichaVersao.findMany({ where: { companyId, fichaId }, select: { id: true } })

    // a ordem importa: componentes → versões → mapas do PDV → ficha
    await tx.stockFichaComponente.deleteMany({ where: { versaoId: { in: versoes.map((v) => v.id) } } })
    await tx.stockFichaVersao.deleteMany({ where: { companyId, fichaId } })
    await tx.stockVendaProdutoMap.deleteMany({ where: { companyId, fichaId } })
    await tx.stockVendaComplementoMap.deleteMany({ where: { companyId, fichaId } })
    await tx.stockVendaGrafiaAgrupada.deleteMany({ where: { companyId, fichaId } })
    await tx.stockFicha.delete({ where: { id: fichaId } })

    /**
     * ⭐ O ITEM-INVÓLUCRO VAI JUNTO — **se ele não tiver movimento**.
     *
     * ⚠️ Toda ficha cria um item pra nomear o que ela produz (o desenho de 09/09). Sem
     * apagá-lo, a exclusão deixaria um item órfão de saldo zero poluindo o catálogo — e
     * foi item-invólucro esquecido que produziu as contagens fantasma da Coca.
     *
     * ⛔ Mas **com movimento ele FICA e só desativa**: movimento é ledger, e ledger é
     * imutável. Apagar o item apagaria a referência de linhas que existem.
     */
    const temMovimento = await tx.stockMovement.count({ where: { companyId, itemId: ficha.itemProduzidoId } })
    if (temMovimento === 0) {
      await tx.stockItem.delete({ where: { id: ficha.itemProduzidoId } })
    } else {
      await tx.stockItem.update({ where: { id: ficha.itemProduzidoId }, data: { ativo: false } })
    }

    void userId
    return {
      caso: 'EXCLUI' as const, nome: previa.nome, itemApagado: temMovimento === 0,
      efeito: `"${previa.nome}" foi excluída de vez${temMovimento === 0 ? ' (o item dela saiu junto)' : ' — o item ficou, porque tem movimento no ledger'}`,
    }
  })
}
