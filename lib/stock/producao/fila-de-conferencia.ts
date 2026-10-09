/**
 * ⭐⭐⭐ A FILA DO GERENTE — "CONFERÊNCIA DO DIA" (09/10/2026, item 2 do dono).
 *
 * **Ordem:** *"Seção «Conferência do dia» na home de produção, visível SÓ pra papéis de
 * gerência (fronteira igual à do sininho), com badge «N aguardando»; cartões como no mock:
 * logo + quem declarou + «declarou X · pedido Y» + a hora + há quanto tempo."*
 *
 * ⛔⛔⛔ **O FISCAL FALA SÓ AQUI — e isto é a metade mais importante do arquivo.** A tela de
 * quem DECLARA continua CEGA: a lei de 05/10 (*"NENHUM número esperado/sugerido/médio aparece
 * na tela de conclusão pra quem declara — é cola de prova, ensina qual número digitar"*) segue
 * valendo inteira, e o guard `conclusao-nao-da-cola` não é tocado. Aqui é **depois do fato**,
 * pra outra pessoa, com outro papel — o lugar onde o juízo sempre pôde existir.
 *
 * ⚠️ E o gate é do **PAYLOAD**, não da tela: quem não tem `stock.manage` não recebe a fila.
 * Esconder no componente deixaria o veredito do fiscal viajando no JSON até o tablet da
 * cozinha, e aí a cola de prova estaria a um DevTools de distância — exatamente o canal
 * lateral que a lei de 05/10 fechou quando o campo de motivo deixou de aparecer condicional.
 *
 * ⭐ ZERO CONTA NOVA: pedido vem de `pedidoDaOrdem`, fiscal de `eficienciaDaOrdem`
 * (`fiscalDeOrdens` em lote), logo de `caraDaReceita`, estado de `carimbosDasConclusoes`.
 */
import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { caraDaReceita, type CaraDaReceita } from './cara-da-receita'
import { fiscalDeOrdens } from './fiscal-dos-lotes'
import { fraseDoFiscal } from './eficiencia-da-ordem'
import { pedidoDaOrdem, type OrigemDoPedido } from './pedido-da-ordem'
import { fmtPedido } from './pedido-na-tela'
import { carimbosDasConclusoes } from './conferencia'

type Db = PrismaClient | Prisma.TransactionClient

/** ⚠️ a janela da fila: o dono confere o DIA, não o histórico — 48h cobre o turno da noite */
export const JANELA_DA_FILA_HORAS = 48
/** ⭐ o degrau do aviso (item 2d): conclusão parada >3h sem conferência */
export const HORAS_PRA_AVISAR = 3

export interface CartaoDaConferencia {
  conclusaoId: string
  ordemId: string
  produto: string
  unidade: string
  cara: CaraDaReceita
  /** quem declarou — nome do colaborador do PIN, ou `null` (e aí a tela NÃO inventa pessoa) */
  declaradoPor: string | null
  declarado: number
  declaradoTxt: string
  /** o pedido da ordem e de onde ele vem (declarado pelo dono × derivado da ficha) */
  pedido: number | null
  pedidoTxt: string | null
  origemDoPedido: OrigemDoPedido | null
  declaradoEm: Date
  /** há quanto tempo, em minutos — a tela traduz */
  minutosEsperando: number
  /** ⛔ passou do degrau de 3h (o mesmo número do aviso — um lugar só) */
  atrasado: boolean
  /** ⭐ O VEREDITO DO FISCAL, EM LÍNGUA DE BALCÃO — só existe neste cartão */
  fiscalOk: boolean | null
  fiscalFrase: string | null
}

export interface FilaDeConferencia {
  cartoes: CartaoDaConferencia[]
  /** o badge "N aguardando" */
  aguardando: number
  /** quantos passaram das 3h — é o que pinta o badge de coral */
  atrasados: number
}

/**
 * ⭐ A fila das conclusões sem carimbo. ⚠️ Em **lote de consultas** (a lição dos 4.909 ms de
 * 28/09): a home é tela de todo dia, e `for (…) await` nela é defeito conhecido.
 */
export async function filaDeConferencia(
  companyId: string,
  db: Db = defaultPrisma,
  agora: Date = new Date(),
): Promise<FilaDeConferencia> {
  const desde = new Date(agora.getTime() - JANELA_DA_FILA_HORAS * 3_600_000)
  const concs = await db.stockProducaoConclusao.findMany({
    where: { companyId, criadoEm: { gte: desde } },
    select: { id: true, ordemId: true, qtdGerada: true, colaboradorId: true, criadoEm: true, escalaConsumida: true },
    orderBy: { criadoEm: 'desc' },
  })
  if (!concs.length) return { cartoes: [], aguardando: 0, atrasados: 0 }

  /** ⛔ conclusão ESTORNADA não entra na fila: ela não vale mais, e pedir conferência de um
   *  número que já foi substituído seria cobrar trabalho sobre dado morto */
  const estornadas = new Set(
    (await db.stockConclusaoEstornada.findMany({ where: { companyId }, select: { conclusaoId: true } })).map((r) => r.conclusaoId),
  )
  const carimbos = await carimbosDasConclusoes(companyId, concs.map((c) => c.id), db)
  const pendentes = concs.filter(
    (c) => !estornadas.has(c.id) && carimbos.get(c.id)?.estado === 'AGUARDANDO_CONFERENCIA',
  )
  if (!pendentes.length) return { cartoes: [], aguardando: 0, atrasados: 0 }

  const ordemIds = [...new Set(pendentes.map((c) => c.ordemId))]
  const [ordens, colabs, fiscais] = await Promise.all([
    db.stockProductionOrder.findMany({
      where: { companyId, id: { in: ordemIds } },
      select: { id: true, itemProduzidoId: true, fichaId: true, versaoFicha: true, escalaReceitas: true },
    }),
    db.stockColaborador.findMany({ where: { companyId }, select: { id: true, nome: true } }),
    fiscalDeOrdens(companyId, ordemIds, db),
  ])
  const itens = await db.stockItem.findMany({
    where: { companyId, id: { in: [...new Set(ordens.map((o) => o.itemProduzidoId))] } },
    select: { id: true, nome: true, unidadeControle: true },
  })
  const metas = await db.stockOrdemMeta.findMany({
    where: { companyId, ordemId: { in: ordemIds } },
    select: { ordemId: true, unidades: true },
  })
  const versoes = await db.stockFichaVersao.findMany({
    where: { companyId, fichaId: { in: [...new Set(ordens.map((o) => o.fichaId))] } },
    select: { fichaId: true, versao: true, loteBase: true },
  })

  const ordemDe = new Map(ordens.map((o) => [o.id, o]))
  const itemDe = new Map(itens.map((i) => [i.id, i]))
  const nomeColab = new Map(colabs.map((c) => [c.id, c.nome]))
  const metaDe = new Map(metas.map((m) => [m.ordemId, m.unidades]))
  const loteDe = new Map(versoes.map((v) => [`${v.fichaId}:${v.versao}`, v.loteBase]))

  const cartoes: CartaoDaConferencia[] = []
  for (const c of pendentes) {
    const o = ordemDe.get(c.ordemId)
    if (!o) continue
    const item = itemDe.get(o.itemProduzidoId)
    const unidade = item?.unidadeControle ?? ''
    const produto = item?.nome ?? '(produto)'

    const pedido = pedidoDaOrdem({
      meta: metaDe.get(c.ordemId) ?? null,
      escala: o.escalaReceitas,
      loteBase: loteDe.get(`${o.fichaId}:${o.versaoFicha}`) ?? 0,
    })
    const f = fiscais.get(c.ordemId)
    const minutos = Math.max(0, Math.round((agora.getTime() - c.criadoEm.getTime()) / 60000))

    cartoes.push({
      conclusaoId: c.id,
      ordemId: c.ordemId,
      produto,
      unidade,
      cara: caraDaReceita(produto),
      /** ⚠️ sem PIN a tela NÃO inventa pessoa (a lição de 04/10) — fala do lote */
      declaradoPor: c.colaboradorId ? nomeColab.get(c.colaboradorId) ?? null : null,
      declarado: c.qtdGerada,
      declaradoTxt: fmtPedido(c.qtdGerada, unidade) ?? String(c.qtdGerada),
      pedido: pedido.unidades,
      pedidoTxt: fmtPedido(pedido.unidades, unidade),
      origemDoPedido: pedido.origem,
      declaradoEm: c.criadoEm,
      minutosEsperando: minutos,
      atrasado: minutos > HORAS_PRA_AVISAR * 60,
      /**
       * ⭐ O VEREDITO — e `null` quando não há material pra fiscalizar.
       * ⛔ `fiscalOk: false` só quando o fiscal diz IMPOSSÍVEL; "não deu pra medir" nunca
       * vira acusação (a régua do próprio fiscal: inventar acusação a partir de ausência é
       * o oposto do que ele existe pra fazer).
       */
      fiscalOk: f == null || f.permitido == null ? null : !f.impossivel,
      fiscalFrase: f ? fraseDoFiscal(f, c.qtdGerada, unidade) : null,
    })
  }

  return {
    cartoes,
    aguardando: cartoes.length,
    atrasados: cartoes.filter((c) => c.atrasado).length,
  }
}
