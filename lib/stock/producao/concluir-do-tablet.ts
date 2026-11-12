// ⭐⭐ "QUANTOS SAÍRAM?" NA PONTA, POR QUEM SABE O NÚMERO (06/09/2026).
//
// **O fluxo que o dono pediu:** finalizar a ÚLTIMA etapa no tablet pergunta ali mesmo quantos
// saíram, e esse número **conclui a ordem** — um gesto, na ponta, sem digitação dupla.
//
// ⛔⛔ E O MOTOR É O MESMO: esta lib **não conclui nada por conta própria** — ela monta o
// input e chama `concluir()`, o mesmo do botão "Concluir" da tela de Produção. Uma segunda
// conclusão divergiria no primeiro caso de borda (custo, rendimento, sobra, validade), e a
// divergente seria a que ninguém olha. É a REGRA 4 no lugar mais caro do módulo.
//
// ⚠️ O CONSUMO É **TUDO QUE ESTÁ EM PRODUÇÃO** — e essa é a decisão que precisa estar à
// vista: quem está no tablet não pesa sobra. É o mesmo default que a tela de Produção
// pré-preenche; a diferença é que lá o dono pode ajustar. **Se sobrou material, quem está na
// cozinha NÃO deve finalizar** — chama o encarregado, que conclui pela tela ajustando. A
// tela do tablet diz isso com todas as letras antes de perguntar o número.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { concluir, rendimentoMedidoDaFicha, type ConcluirResult } from './conclusao'
import { escalaDoConsumo } from './previsao-rendimento'
import { avaliarPlausibilidade, type VeredictoDaPlausibilidade } from './plausibilidade'
import { separadoPorItem, OrdemError } from './ordens'
import { naTransacao, type DbOuTx } from './transacao'
import { finalizarTarefa } from './minhas-tarefas'
import { somentePendentes } from './em-andamento'

export interface ConcluirDoTabletInput {
  companyId: string
  ordemId: string
  qtdGerada: number
  /** ⭐ o aceite explícito do aviso de grandeza (22864 KG?) — pergunta, nunca recusa cega */
  confirmouGrandeza?: boolean
  /**
   * Quem apertou FINALIZAR na última etapa — vem do PIN, não de dropdown.
   *
   * ⭐ 08/09: aceita `null` porque o gerente também conclui pelo HOJE ao vivo, e **ali
   * ninguém assinou com PIN**. `quemFechouOLote` continua mandando quando existe; quando não
   * existe, `null` é a resposta honesta — inventar um assinante seria pior que a ausência.
   */
  colaboradorId: string | null
  parcial?: boolean
}

/**
 * ⭐ QUEM PRODUZIU **DERIVA DAS ETAPAS**, não de um dropdown.
 *
 * ⚠️ A conclusão guarda UM `colaboradorId` e a produção tem N mãos — então o que se grava ali
 * é **quem fechou o lote** (o executor da última etapa). A atribuição verdadeira, por mão, já
 * vive nas etapas, e é dela que o relatório por pessoa tira tempo e volume. Gravar "o
 * primeiro" ou "o que mais tempo levou" seria inventar uma regra pra um campo que só comporta
 * uma resposta.
 */
export async function quemFechouOLote(
  companyId: string, ordemId: string, db: DbOuTx = defaultPrisma,
): Promise<string | null> {
  const ultima = await db.stockOrdemEtapa.findFirst({
    where: { companyId, ordemId, executorId: { not: null } },
    orderBy: { posicao: 'desc' },
    select: { executorId: true },
  })
  return ultima?.executorId ?? null
}

/** ⭐ o que a tela do tablet mostra ANTES de perguntar o número: o que vai ser consumido */
export async function oQueVaiSerConsumido(
  companyId: string, ordemId: string, db: DbOuTx = defaultPrisma,
): Promise<{ itemId: string; nome: string; qtd: number; unidade: string }[]> {
  const emProd = await separadoPorItem(companyId, ordemId, db)
  const ids = [...emProd.keys()].filter((id) => (emProd.get(id) ?? 0) > 0)
  if (!ids.length) return []
  const itens = await db.stockItem.findMany({
    where: { companyId, id: { in: ids } }, select: { id: true, nome: true, unidadeControle: true },
  })
  const meta = new Map(itens.map((i) => [i.id, i]))
  return ids.map((id) => ({
    itemId: id,
    nome: meta.get(id)?.nome ?? '(item)',
    // ⛔⛔ (12/11, D2) CRU — o mesmo valor que a tela do escritório manda. Arredondar a 3 casas
    // aqui transformava 0,0002 KG em 0: a lista ia vazia, `concluir` recusava ("informe o que foi
    // consumido") e a etapa já estava gravada. O arredondamento mora na porta do estoque
    // (`separadoPorItem` → round6), não na tela.
    qtd: emProd.get(id) ?? 0,
    unidade: meta.get(id)?.unidadeControle ?? '',
  }))
}

/**
 * ⭐⭐ A PERGUNTA DA GRANDEZA **ANTES DE QUALQUER ESCRITA** (19/09).
 *
 * ⚠️⚠️ **Achado ao ligar o guard:** o caminho do tablet finaliza a ETAPA e só então conclui
 * a ordem. Com a recusa dentro do `concluir`, a cozinha digitava 22864, levava o aviso — e
 * **a tarefa já estava fechada**, sem como repetir. Estado pela metade no meio do turno.
 *
 * ⛔ **E isto NÃO é uma segunda régua.** É a MESMA composição (`oQueVaiSerConsumido` →
 * `escalaDoConsumo` → `rendimentoMedidoDaFicha` → `avaliarPlausibilidade`) chamada mais
 * cedo; o guard dentro do `concluir` continua de pé pros outros caminhos — cinto e
 * suspensório, nunca duas contas diferentes da mesma pergunta.
 */
export async function avaliarGrandezaDaConclusao(
  companyId: string, ordemId: string, qtdGerada: number, db: DbOuTx = defaultPrisma,
): Promise<VeredictoDaPlausibilidade> {
  const ok: VeredictoDaPlausibilidade = { decisao: 'OK', fator: null, suspeitaDeGrandeza: null, mensagem: null, qtdProvavel: null }
  const ordem = await db.stockProductionOrder.findFirst({ where: { id: ordemId, companyId }, select: { fichaId: true, versaoFicha: true, itemProduzidoId: true } })
  if (!ordem) return ok
  const consumo = await oQueVaiSerConsumido(companyId, ordemId, db)
  if (!consumo.length) return ok
  const versao = await db.stockFichaVersao.findFirst({ where: { companyId, fichaId: ordem.fichaId, versao: ordem.versaoFicha }, select: { id: true } })
  const comps = versao ? await db.stockFichaComponente.findMany({ where: { companyId, versaoId: versao.id }, select: { itemId: true, qtdPlanejada: true } }) : []
  const porLote = new Map(comps.map((c) => [c.itemId, c.qtdPlanejada]))
  const escala = escalaDoConsumo(consumo.map((c) => ({ qtd: c.qtd, porLote: porLote.get(c.itemId) ?? 0 }))) ?? 1
  const medido = await rendimentoMedidoDaFicha(companyId, ordem.fichaId, db)
  const item = await db.stockItem.findUnique({ where: { id: ordem.itemProduzidoId }, select: { nome: true, unidadeControle: true } })
  return avaliarPlausibilidade({
    qtdGerada, rendimento: Math.round((qtdGerada / (escala || 1)) * 10000) / 10000,
    rendimentoMedio: medido.media, lotesNaMedia: medido.lotes,
    unidade: item?.unidadeControle ?? '', nomeDoProduto: item?.nome ?? 'este produto',
  })
}

/**
 * Conclui a ordem a partir do tablet. **Delegação pura** ao motor de sempre.
 *
 * ⛔ Recusa se não houver nada em produção: concluir sem consumo geraria produto do nada, e o
 * ledger recusaria — melhor uma frase clara aqui do que um erro de banco na cara da cozinha.
 */
export async function concluirDoTablet(
  input: ConcluirDoTabletInput, db: DbOuTx = defaultPrisma,
): Promise<ConcluirResult> {
  const consumo = await oQueVaiSerConsumido(input.companyId, input.ordemId, db)
  if (!consumo.length) {
    throw new OrdemError('Não há material separado nesta ordem. Fale com o encarregado antes de finalizar.')
  }
  return concluir({
    companyId: input.companyId,
    ordemId: input.ordemId,
    // ⚠️ consome TUDO que está em produção — a sobra não é medida no tablet (ver o topo)
    consumo: consumo.map((c) => ({ itemId: c.itemId, qtdConsumida: c.qtd })),
    qtdGerada: input.qtdGerada,
    colaboradorId: await quemFechouOLote(input.companyId, input.ordemId, db) ?? input.colaboradorId,
    parcial: input.parcial ?? false,
    confirmouGrandeza: input.confirmouGrandeza ?? false,
  }, db)
}

/**
 * ⭐⭐ FINALIZAR NO TABLET É UM ATO SÓ (12/11/2026 — conserto D1/D2 do raio-X da produção).
 *
 * ⛔ Antes: `finalizarTarefa` GRAVAVA a etapa e só DEPOIS a conclusão era tentada. Se ela recusava
 *    (D2: 409 "informe o que foi consumido"; D1: 500 da trava), a etapa ficava fechada, a ordem
 *    ficava aberta, e o 2º clique da funcionária dava "essa tarefa já foi finalizada" — só o
 *    escritório fechava. 7 ordens reais assim entre 07 e 11/11.
 * ⭐ Agora: etapa + conclusão (com a checagem de etapas pendentes) numa transação — ou TUDO grava,
 *    ou NADA grava, e o erro volta com o motivo; a funcionária pode tentar de novo.
 */
export async function finalizarEConcluirDoTablet(
  input: { companyId: string; etapaId: string; colaboradorId: string; qtdGerada?: number; parcial?: boolean; confirmouGrandeza?: boolean; agora?: Date },
  db: DbOuTx = defaultPrisma,
): Promise<{ concluida: { qtdGerada: number; custoUnitarioReal: number | null } | null }> {
  return naTransacao(db, async (tx) => {
    const t = tx as unknown as PrismaClient // os leitores antigos tipam PrismaClient; o client transacional serve a todos
    await finalizarTarefa({ companyId: input.companyId, etapaId: input.etapaId, colaboradorId: input.colaboradorId, agora: input.agora }, t)
    if (!input.qtdGerada) return { concluida: null }
    const etapa = await tx.stockOrdemEtapa.findFirst({ where: { id: input.etapaId, companyId: input.companyId }, select: { ordemId: true } })
    if (!etapa) throw new OrdemError('Tarefa não encontrada.')
    const candidatas = await tx.stockOrdemEtapa.findMany({
      where: { companyId: input.companyId, ordemId: etapa.ordemId, finalizadoEm: null },
      select: { id: true, ordemId: true, iniciadoEm: true, finalizadoEm: true },
    })
    const faltando = await somentePendentes(input.companyId, candidatas, t)
    if (faltando.length > 0) throw new OrdemError(`Ainda faltam ${faltando.length} etapa(s) nesta ordem — não dá pra fechar o lote agora.`)
    const r = await concluirDoTablet({
      companyId: input.companyId, ordemId: etapa.ordemId, qtdGerada: input.qtdGerada,
      colaboradorId: input.colaboradorId, parcial: input.parcial, confirmouGrandeza: input.confirmouGrandeza,
    }, tx)
    return { concluida: { qtdGerada: r.qtdGerada, custoUnitarioReal: r.custoUnitarioReal } }
  })
}
