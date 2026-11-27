/**
 * ⭐⭐⭐ A FICHA QUE CHEGOU DEPOIS — a pergunta de acerto (25/11/2026).
 *
 * ⛔ O CASO: PROMOO 3 PIZZAS GRANDES vendeu 31 un em 24/11 sem ficha → nada baixou; a ficha nasceu
 * às 05:00 do dia seguinte. Ninguém perguntou "e o que ficou pra trás?" — o estoque ficou com 93
 * caixas a mais do que a prateleira.
 *
 * ⭐ A REGRA (lei do dono):
 *   · ⛔ PASSADO NÃO SE REPROCESSA. O acerto é MOVIMENTO NOVO, datado de HOJE, motivo "ficha criada
 *     depois (venda de DD/MM)" — `tipo` BAIXA_VENDA, `receiptId` = o import do dia da venda (o
 *     rastro), `origem` = ACERTO_FICHA_TARDIA (o motivo que o extrato do item lê).
 *   · NUNCA sozinho: só com o SIM do dono (a rota POST). A máquina só PERGUNTA e AVISA.
 *   · IDEMPOTENTE: a linha `stock_acerto_ficha_tardia` (único por import + nome) nasce na MESMA
 *     transação dos movimentos — rodar duas vezes = 1 acerto.
 *   · ⛔ TRAVA DA CONTAGEM: item da ficha contado entre a venda e o acerto fica FORA — a contagem já
 *     fixou a verdade dele (baixar de novo seria tirar duas vezes). A pergunta DECLARA isso.
 *   · Janela: dias fechados nos últimos 30 dias.
 *
 * "Ficou pra trás?" é a porta única `baixou-na-hora.ts` (o EVENTO do fechamento manda, nunca a
 * config de hoje); "o que a ficha tira?" é o MESMO motor da baixa (`montarPlanoDeLinhas`).
 */
import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { registrarAviso, resolverAviso } from '@/lib/avisos/central'
import { diaEmSaoPaulo, somarDias } from '@/lib/datas/dia-sao-paulo'
import { ANCORAS } from '@/components/perguntas/ancoras'
import { montarPlanoDeLinhas } from './baixa-venda'
import { resolvedorDeGrafia, mapaQueDecide } from './grafia-canonica'
import { ficouPraTras, chaveDoAcerto, ORIGEM_ACERTO_FICHA_TARDIA, fraseDaPendencia } from './baixou-na-hora'
import { custoDaBaixa, estadoParaBaixa } from './custo-da-baixa'
import { criarMovimento, MovementInvalidError } from '../movement'
import { recomputeSaldoCache } from '../saldo'
import { contadosDesdeODia } from './trava-da-contagem'

export const JANELA_FICHA_TARDIA_DIAS = 30
export { ORIGEM_ACERTO_FICHA_TARDIA, fraseDaPendencia }
export const ORIGEM_AVISO_FICHA_TARDIA = 'FICHA_TARDIA'
export const ALVO_AVISO_FICHA_TARDIA = 'janela'

export interface ItemDoAcerto { itemId: string; nome: string; unidade: string; qtd: number }
export interface ItemForaPorContagem extends ItemDoAcerto { contadoEm: string }
export interface PendenciaFichaTardia {
  importId: string
  dia: string
  nomeSuitable: string
  quantidade: number
  fichaId: string | null
  alvoNome: string
  /** o que sai no acerto */
  baixa: ItemDoAcerto[]
  /** ⛔ a contagem já fixou a verdade: fica FORA, e a pergunta diz */
  foraPorContagem: ItemForaPorContagem[]
}

export class AcertoFichaTardiaError extends Error {
  constructor(msg: string) { super(msg); this.name = 'AcertoFichaTardiaError' }
}

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })

/**
 * ⭐ a LISTA (só leitura). `filtro.fichaId` / `filtro.nomes` restringem ao produto da tela;
 * sem filtro, a empresa inteira (o sininho e a tela de vendas).
 */
export async function listarFichaTardia(
  companyId: string,
  filtro: { fichaId?: string | null; nomes?: string[]; hoje?: string } = {},
  db: PrismaClient = defaultPrisma,
): Promise<PendenciaFichaTardia[]> {
  const hoje = filtro.hoje ?? diaEmSaoPaulo()
  const desde = new Date(`${somarDias(hoje, -JANELA_FICHA_TARDIA_DIAS)}T00:00:00.000Z`)
  // ⚠️ só dia FECHADO: linha de hoje ainda não é passado
  const ate = new Date(`${hoje}T00:00:00.000Z`)
  const linhas = await db.stockVendaLinha.findMany({
    where: { companyId, data: { gte: desde, lt: ate }, mapeadoNoImport: false },
    select: { importId: true, data: true, nomeSuitable: true, quantidade: true, valorTotal: true, mapeadoNoImport: true, criadoEm: true },
    orderBy: { data: 'asc' },
  })
  if (!linhas.length) return []
  const [mapa, ignorados, acertos] = await Promise.all([
    db.stockVendaProdutoMap.findMany({ where: { companyId }, select: { nomeSuitable: true, alvoTipo: true, fichaId: true, itemId: true, criadoEm: true } }),
    db.stockVendaIgnorado.findMany({ where: { companyId }, select: { nomeSuitable: true } }),
    db.stockAcertoFichaTardia.findMany({ where: { companyId, importId: { in: [...new Set(linhas.map((l) => l.importId))] } }, select: { importId: true, nomeSuitable: true } }),
  ])
  const resolver = resolvedorDeGrafia(mapa)
  const ignorado = new Set(ignorados.map((i) => i.nomeSuitable))
  const feito = new Set(acertos.map((a) => chaveDoAcerto(a.importId, a.nomeSuitable)))
  const nomesFiltro = filtro.nomes?.length ? new Set(filtro.nomes) : null

  const candidatas = linhas.filter((l) => {
    if (ignorado.has(l.nomeSuitable) || feito.has(chaveDoAcerto(l.importId, l.nomeSuitable))) return false
    const r = resolver(l.nomeSuitable)
    if (!ficouPraTras(l, r)) return false
    if (!filtro.fichaId && !nomesFiltro) return true
    const m = mapaQueDecide(r)!
    return (!!filtro.fichaId && m.fichaId === filtro.fichaId) || (!!nomesFiltro && nomesFiltro.has(l.nomeSuitable))
  })
  if (!candidatas.length) return []

  const out: PendenciaFichaTardia[] = []
  for (const l of candidatas) {
    const dia = l.data.toISOString().slice(0, 10)
    // ⭐ o MESMO motor da baixa, com a ficha de HOJE — é o que o dono acabou de cadastrar
    const plano = await montarPlanoDeLinhas(companyId, dia, [{ produto: l.nomeSuitable, quantidade: l.quantidade, valorTotal: l.valorTotal }], null, db)
    const p = plano.produtos[0]
    if (!p) continue
    const ids = p.baixa.filter((b) => b.qtd > 0).map((b) => b.itemId)
    if (!ids.length) continue
    const [itens, ultimaContagem] = await Promise.all([
      db.stockItem.findMany({ where: { companyId, id: { in: ids } }, select: { id: true, unidadeControle: true } }),
      contadosDesdeODia(db, companyId, dia, ids),
    ])
    const un = new Map(itens.map((i) => [i.id, i.unidadeControle]))
    const baixa: ItemDoAcerto[] = []
    const fora: ItemForaPorContagem[] = []
    for (const b of p.baixa) {
      if (b.qtd <= 0) continue
      const it = { itemId: b.itemId, nome: b.nome, unidade: un.get(b.itemId) ?? '', qtd: b.qtd }
      const cont = ultimaContagem.get(b.itemId)
      if (cont) fora.push({ ...it, contadoEm: cont.toISOString() })
      else baixa.push(it)
    }
    out.push({ importId: l.importId, dia, nomeSuitable: l.nomeSuitable, quantidade: l.quantidade, fichaId: p.fichaId ?? null, alvoNome: p.alvoNome, baixa, foraPorContagem: fora })
  }
  return out
}

export interface ResultadoDoAcerto { jaFeito: boolean; dia: string; baixados: ItemDoAcerto[]; foraPorContagem: ItemForaPorContagem[] }

/**
 * ⭐ O ACERTO — só com o SIM do dono. Idempotente: a 2ª chamada devolve `jaFeito` e não grava nada.
 */
export async function acertarFichaTardia(
  companyId: string,
  alvo: { importId: string; nomeSuitable: string },
  userId: string | undefined,
  db: PrismaClient = defaultPrisma,
  opts: { agora?: Date; hoje?: string } = {},
): Promise<ResultadoDoAcerto> {
  const ja = await db.stockAcertoFichaTardia.findUnique({ where: { companyId_importId_nomeSuitable: { companyId, importId: alvo.importId, nomeSuitable: alvo.nomeSuitable } } })
  if (ja) return { jaFeito: true, dia: ja.dia, baixados: JSON.parse(ja.baixados), foraPorContagem: JSON.parse(ja.foraPorContagem) }
  const pend = (await listarFichaTardia(companyId, { nomes: [alvo.nomeSuitable], hoje: opts.hoje }, db))
    .find((p) => p.importId === alvo.importId && p.nomeSuitable === alvo.nomeSuitable)
  if (!pend) throw new AcertoFichaTardiaError(`Não há nada pra acertar de "${alvo.nomeSuitable}" nesse dia — ou já baixou, ou não tem ficha.`)
  const agora = opts.agora ?? new Date()

  try {
    await db.$transaction(async (tx) => {
      const estado = await estadoParaBaixa(tx, companyId)
      const baixados: (ItemDoAcerto & { movementId: string })[] = []
      for (const b of pend.baixa) {
        const { custoUnitario, custoTotal } = custoDaBaixa(b.itemId, b.qtd, estado)
        const mov = await criarMovimento(tx, {
          companyId, itemId: b.itemId, tipo: 'BAIXA_VENDA', quantidade: -b.qtd, custoUnitario, custoTotal,
          receiptId: pend.importId, origem: ORIGEM_ACERTO_FICHA_TARDIA, criadoPorId: userId ?? null, dataMovimento: agora,
        })
        baixados.push({ ...b, movementId: mov.id })
      }
      // ⭐ a linha da idempotência nasce JUNTO: se outra chamada ganhou a corrida, o índice único derruba esta transação inteira
      await tx.stockAcertoFichaTardia.create({
        data: {
          companyId, importId: pend.importId, dia: pend.dia, nomeSuitable: pend.nomeSuitable, quantidade: pend.quantidade,
          baixados: JSON.stringify(baixados), foraPorContagem: JSON.stringify(pend.foraPorContagem), criadoPorId: userId ?? null,
        },
      })
    })
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002') return acertarFichaTardia(companyId, alvo, userId, db, opts)
    if (e instanceof MovementInvalidError) throw new AcertoFichaTardiaError(`O estoque recusou o acerto: ${e.message}`)
    throw e
  }
  await recomputeSaldoCache(db, companyId)
  // ⚠️ fail-soft: o acerto já está no ledger; o aviso se recompõe na próxima passada
  try { await avisarFichaTardia(companyId, db, opts.hoje) } catch (e) { console.error(`[ficha-tardia] aviso falhou: ${e instanceof Error ? e.name : 'erro'}`) }
  return { jaFeito: false, dia: pend.dia, baixados: pend.baixa, foraPorContagem: pend.foraPorContagem }
}


/**
 * ⭐ O GRITO NO SININHO: vermelho enquanto houver venda que ficou pra trás com ficha HOJE; resolvido
 * quando a lista zera. Chamado pela guarda diária, pelas portas que salvam ficha/vínculo e pelo acerto.
 */
export async function avisarFichaTardia(companyId: string, db: PrismaClient = defaultPrisma, hoje?: string): Promise<PendenciaFichaTardia[]> {
  const pend = await listarFichaTardia(companyId, { hoje }, db)
  if (!pend.length) {
    await resolverAviso(companyId, ORIGEM_AVISO_FICHA_TARDIA, ALVO_AVISO_FICHA_TARDIA, db)
    return pend
  }
  const p0 = pend[0]
  const titulo = pend.length === 1
    ? `Acerte o estoque: ${p0.nomeSuitable} vendeu ${num(p0.quantidade)} un em ${ddmm(p0.dia)} e nada saiu do estoque`
    : `Acerte o estoque: ${pend.length} vendas saíram sem baixar — a ficha foi criada depois`
  await registrarAviso({
    companyId, setor: 'estoque', severidade: 'vermelho', origem: ORIGEM_AVISO_FICHA_TARDIA, alvo: ALVO_AVISO_FICHA_TARDIA,
    titulo,
    corpo: `Na hora da venda não havia ficha, então o estoque não baixou: ${pend.slice(0, 10).map((p) => `${p.nomeSuitable} · ${num(p.quantidade)} un em ${ddmm(p.dia)}`).join('; ')}${pend.length > 10 ? `; e mais ${pend.length - 10}` : ''}.`,
    oQueFazer: 'Abra a pergunta e diga se baixa agora o que ficou pra trás. O que já foi contado depois fica de fora.',
    acaoRotulo: 'Ver a pergunta', acaoHref: `/empresas/${companyId}/estoque/vendas#${ANCORAS.FICHA_TARDIA}`,
  }, db)
  return pend
}

/**
 * ⭐ a porta das ROTAS que salvam ficha ou vínculo (criar ficha, editar ficha, mapear nome): a pergunta
 * nasce NA HORA no sininho. ⛔ Fail-soft e fora de transação: o que o dono salvou já está salvo, e um
 * problema aqui não pode virar erro na tela dele (o erro é nomeado sem a mensagem — a do Prisma vaza a URI).
 */
export async function avisarFichaTardiaSemFalhar(companyId: string, db: PrismaClient = defaultPrisma): Promise<void> {
  try { await avisarFichaTardia(companyId, db) } catch (e) { console.error(`[ficha-tardia] aviso falhou: ${e instanceof Error ? e.name : 'erro'}`) }
}
