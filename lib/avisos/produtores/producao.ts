/**
 * ⭐⭐⭐ OS PRODUTORES DE AVISO DA PRODUÇÃO (04/10/2026).
 *
 * **Ordem do dono:** *"os produtores já existem: o juiz das 3h e os guards passam a GRAVAR
 * aviso além do e-mail (e-mail continua como cópia)."*
 *
 * ⛔⛔ **ESTE ARQUIVO É A "PRIMEIRA CARGA" E O CRON AO MESMO TEMPO — de propósito.** O dono
 * pediu que *"os achados vivos de hoje virem avisos, pra a central nascer útil, não vazia"*. A
 * tentação era um script de carga separado; **isso criaria duas verdades** (um script que
 * traduz os achados de hoje + um produtor que traduz os de amanhã), e elas divergiriam na
 * primeira frase ajustada. É a doença dos 7 detectores de par, em forma de texto de alarme.
 * Aqui: **a primeira carga é o produtor rodando uma vez**.
 *
 * ⚠️ **E ELE RECONCILIA, não só grava.** O que ele deixa de reportar numa rodada é RESOLVIDO —
 * senão o dono conserta o CHEDDAR e o aviso do CHEDDAR fica lá pra sempre, e em duas semanas
 * ele para de abrir o sininho. Trabalho FEITO tem que sair da fila.
 */
import { prisma } from '@/lib/db'
import type { Prisma, PrismaClient } from '@prisma/client'
import { registrarAviso, reconciliarOrigem } from '../central'
import { avaliarLinguaDoBalcao } from '../lingua-do-balcao'
import { acharPadrao, fraseDoPadrao, type LoteMedido } from '../padrao-de-rendimento'
import { faixaDoSelo, DESVIO_GRAVE } from '@/lib/stock/producao/eficiencia-da-ordem'
import { loteEhComparavel } from '@/lib/stock/producao/lote-comparavel'
import type { NovoAviso } from '../tipos'

/**
 * ⚠️⚠️ **O CLIENT VEM POR PARÂMETRO, e isso não é enfeite — foi um BUG MEU pego antes de rodar.**
 * O preview da primeira carga embrulha o produtor num `$transaction` pra desfazer tudo no fim;
 * com o `prisma` GLOBAL cravado aqui dentro, as escritas sairiam **fora** da transação e o
 * "preview" **gravaria de verdade**. É a família do *"preview e confirm discordando"* que custou
 * o import de OFX inteiro — aqui seria um preview que mente sobre não ter gravado.
 */
type Db = PrismaClient | Prisma.TransactionClient

export interface ResumoDaCarga {
  gravados: number
  reabertos: number
  resolvidos: number
  recusados: { motivo: string; titulo: string }[]
}

/** ⭐ quantos lotes pra trás olhar quando se procura padrão — 2 meses cobre receita semanal */
const JANELA_DIAS = 60

/**
 * ⚠️ **GRAVA PELA PORTA ÚNICA e NUNCA derruba o cron.** Aviso recusado pela lei da língua do
 * balcão é **erro MEU** (texto mal escrito no produtor), não motivo pra o juiz noturno morrer
 * no meio e deixar os outros invariantes sem rodar. A recusa entra no resumo com o motivo, e é
 * assim que eu descubro.
 */
async function gravar(a: NovoAviso, r: ResumoDaCarga, db: Db) {
  const v = avaliarLinguaDoBalcao(a)
  if (!v.ok) {
    r.recusados.push({ motivo: v.motivo, titulo: a.titulo })
    return
  }
  const { reaberto } = await registrarAviso(a, db)
  r.gravados++
  if (reaberto) r.reabertos++
}

/**
 * ⭐⭐ (1) PADRÃO DE RENDIMENTO — N lotes seguidos fora, com o NOME de quem fez.
 *
 * ⛔⛔ **É AQUI QUE OS 42 LOTES DO P8 VIRAM POUCOS AVISOS.** O juiz denuncia lote a lote (e
 * continua denunciando no e-mail, que é a auditoria); a central agrupa **por receita** e só
 * fala quando há PADRÃO. Sem isso a central nasceria com 42 linhas e o dono aprenderia a
 * ignorar o sininho na primeira semana — os 111 alarmes falsos de 26/08 em outra roupa.
 */
async function padraoDeRendimento(companyId: string, r: ResumoDaCarga, db: Db): Promise<void> {
  const desde = new Date(Date.now() - JANELA_DIAS * 86400000)

  const desvios = await db.stockProducaoDesvio.findMany({
    where: { companyId, criadoEm: { gte: desde } },
    select: { ordemId: true, pctTeorico: true, criadoEm: true, criadoPorId: true },
    orderBy: { criadoEm: 'asc' },
  })
  if (!desvios.length) {
    await reconciliarOrigem(companyId, 'PADRAO_RENDIMENTO', [], db)
    return
  }

  const ordens = await db.stockProductionOrder.findMany({
    where: { companyId, id: { in: [...new Set(desvios.map((d) => d.ordemId))] } },
    select: { id: true, fichaId: true, itemProduzidoId: true },
  })
  const porOrdem = new Map(ordens.map((o) => [o.id, o]))

  const itens = await db.stockItem.findMany({
    where: { companyId, id: { in: [...new Set(ordens.map((o) => o.itemProduzidoId))] } },
    select: { id: true, nome: true },
  })
  const nomeDoItem = new Map(itens.map((i) => [i.id, i.nome]))

  const colabs = await db.stockColaborador.findMany({
    where: { companyId },
    select: { id: true, nome: true },
  })
  const nomeDoColab = new Map(colabs.map((c) => [c.id, c.nome]))

  /** agrupa por FICHA — é a receita que tem padrão, não a ordem */
  const porFicha = new Map<string, { nome: string; lotes: LoteMedido[] }>()
  for (const d of desvios) {
    const o = porOrdem.get(d.ordemId)
    if (!o) continue
    const chave = o.fichaId
    const nome = nomeDoItem.get(o.itemProduzidoId) ?? 'receita sem nome'
    if (!porFicha.has(chave)) porFicha.set(chave, { nome, lotes: [] })
    porFicha.get(chave)!.lotes.push({
      ordemId: d.ordemId,
      encerradoEm: d.criadoEm.toISOString(),
      pct: d.pctTeorico,
      quem: d.criadoPorId ? (nomeDoColab.get(d.criadoPorId) ?? null) : null,
    })
  }

  const vivos: string[] = []
  for (const [fichaId, g] of porFicha) {
    const p = acharPadrao(g.lotes)
    if (!p) continue
    vivos.push(fichaId)
    const f = fraseDoPadrao(g.nome, p)
    await gravar(
      {
        companyId,
        setor: 'producao',
        severidade: p.sentido === 'MISTO' || p.seguidos >= 4 ? 'vermelho' : 'ambar',
        titulo: f.titulo,
        corpo: f.corpo,
        oQueFazer: f.oQueFazer,
        acaoRotulo: 'abrir a receita',
        acaoHref: `/empresas/${companyId}/estoque/producao/receitas`,
        origem: 'PADRAO_RENDIMENTO',
        alvo: fichaId,
      },
      r,
      db,
    )
  }
  /** ⭐ receita que voltou pra faixa SAI da central sozinha */
  r.resolvidos += await reconciliarOrigem(companyId, 'PADRAO_RENDIMENTO', vivos, db)
}

/**
 * ⭐⭐ (2) FICHA QUE NÃO DÁ PRA COMPARAR — o caso do QUEIJO CHEDDAR a 1027%.
 *
 * ⛔ Este NÃO é problema de lote, é da FICHA: o lote base está declarado numa unidade que não é
 * a que o produto se conta (`unidadeLoteBase` KG × produto contado em UN), então a eficiência
 * sai em números absurdos e **a separação pede material pra 1 unidade quando o dono pede 10**.
 * É por isso que o título manda **não criar ordem** antes de corrigir — a ação que evita o
 * estrago, não a que descreve o defeito.
 */
async function fichaNaoComparavel(companyId: string, r: ResumoDaCarga, db: Db): Promise<void> {
  const fichas = await db.stockFicha.findMany({
    where: { companyId, ativo: true },
    select: { id: true, itemProduzidoId: true, versaoAtual: true },
  })
  /** ⚠️ consulta separada porque o ISOLAMENTO do módulo proíbe `@relation` entre `stock_*` —
   *  as versões se resolvem por VALOR (fichaId + versao), não por include. */
  const versoes = fichas.length
    ? await db.stockFichaVersao.findMany({
        where: { companyId, fichaId: { in: fichas.map((f) => f.id) } },
        select: { fichaId: true, versao: true, unidadeLoteBase: true },
      })
    : []
  const versaoAtualDaFicha = new Map(
    versoes.map((v) => [`${v.fichaId}#${v.versao}`, v]),
  )
  const itens = await db.stockItem.findMany({
    where: { companyId, id: { in: fichas.map((f) => f.itemProduzidoId) } },
    select: { id: true, nome: true, unidadeControle: true },
  })
  const item = new Map(itens.map((i) => [i.id, i]))

  const vivos: string[] = []
  for (const f of fichas) {
    const v = versaoAtualDaFicha.get(`${f.id}#${f.versaoAtual}`)
    const it = item.get(f.itemProduzidoId)
    if (!v || !it || !v.unidadeLoteBase) continue
    if (loteEhComparavel(v.unidadeLoteBase, it.unidadeControle)) continue

    vivos.push(f.id)
    await gravar(
      {
        companyId,
        setor: 'producao',
        severidade: 'vermelho',
        titulo: `Não cria ordem de ${it.nome} antes de corrigir a ficha`,
        corpo:
          `A ficha de ${it.nome} diz que o lote rende ${v.unidadeLoteBase}, mas o produto se conta em ` +
          `${it.unidadeControle}. Se alguém pedir 10, o sistema separa material pra 1 só.`,
        oQueFazer: `Abra a ficha de ${it.nome} e conserte quantas ${it.unidadeControle} saem de uma receita.`,
        acaoRotulo: 'corrigir a ficha',
        acaoHref: `/empresas/${companyId}/estoque/fichas/${f.id}`,
        origem: 'FICHA_SEM_COMPARACAO',
        alvo: f.id,
      },
      r,
      db,
    )
  }
  r.resolvidos += await reconciliarOrigem(companyId, 'FICHA_SEM_COMPARACAO', vivos, db)
}

/**
 * ⭐⭐ (3) ORDEM PARADA — a linguagem CORAL da ordem atrasada (a mesma da home).
 *
 * ⚠️ O corpo diz o que o dono precisa saber pra decidir: *"o insumo saiu e não virou produto"*.
 * E o aviso só nasce depois de 24h — ordem aberta durante o turno é a cozinha trabalhando, não
 * um problema (foi assim que o P2 nasceu, e a régua é a dele).
 */
async function ordemParada(companyId: string, r: ResumoDaCarga, db: Db): Promise<void> {
  const abertas = await db.stockProductionOrder.findMany({
    where: { companyId, estado: { in: ['PLANEJADA', 'SEPARADA', 'EM_PRODUCAO'] } },
    select: { id: true, estado: true, atualizadoEm: true, dataProducao: true, itemProduzidoId: true },
  })
  const itens = await db.stockItem.findMany({
    where: { companyId, id: { in: abertas.map((o) => o.itemProduzidoId) } },
    select: { id: true, nome: true },
  })
  const nome = new Map(itens.map((i) => [i.id, i.nome]))

  const vivos: string[] = []
  for (const o of abertas) {
    const horas = (Date.now() - o.atualizadoEm.getTime()) / 3_600_000
    if (horas <= 24) continue
    const dias = Math.floor(horas / 24)
    vivos.push(o.id)
    await gravar(
      {
        companyId,
        setor: 'producao',
        severidade: 'coral',
        titulo: `Feche a ordem de ${nome.get(o.itemProduzidoId) ?? 'produção'} que está parada`,
        corpo:
          `Essa ordem está parada há ${dias === 0 ? 'mais de um dia' : `${dias} dia(s)`} — ` +
          `o insumo saiu da prateleira e não virou produto.`,
        oQueFazer: 'Abra a ordem e escolha: concluir com o que saiu, cancelar e devolver, ou continuar depois.',
        acaoRotulo: 'abrir a ordem',
        acaoHref: `/empresas/${companyId}/estoque/producao/${o.id}`,
        origem: 'ORDEM_PARADA',
        alvo: o.id,
      },
      r,
      db,
    )
  }
  r.resolvidos += await reconciliarOrigem(companyId, 'ORDEM_PARADA', vivos, db)
}

/**
 * ⭐⭐ (4) LOTE DE GRANDEZA IMPOSSÍVEL — o lote que destoa em ORDEM DE GRANDEZA.
 *
 * ⚠️⚠️ **E ESTE É A EXCEÇÃO À REGRA DO PADRÃO, com o motivo escrito.** O dono disse *"NUNCA por
 * lote isolado — variação de carne é natural"*, e isso vale pra variação: 80%, 120%, 140%. Um
 * lote a **1027%** não é variação, é **dado impossível** (a família do `22864` que eram 22,864
 * kg, 19/09) — e ele já envenena o custo médio do item no mesmo instante. Deixá-lo esperando
 * três repetições seria esperar o erro virar norma, que é exatamente o que o estorno de
 * conclusão podre existe pra impedir.
 */
async function loteDeGrandezaImpossivel(companyId: string, r: ResumoDaCarga, db: Db): Promise<void> {
  /** ⭐ 10× a faixa grave — bem acima de qualquer variação de cozinha */
  const TETO = 100 * (1 + DESVIO_GRAVE) * 10
  const desde = new Date(Date.now() - JANELA_DIAS * 86400000)
  const desvios = await db.stockProducaoDesvio.findMany({
    where: { companyId, criadoEm: { gte: desde } },
    select: { ordemId: true, pctTeorico: true },
  })
  const fora = desvios.filter((d) => faixaDoSelo(d.pctTeorico) === 'EXTREMO' && d.pctTeorico >= TETO)

  const ordens = fora.length
    ? await db.stockProductionOrder.findMany({
        where: { companyId, id: { in: fora.map((d) => d.ordemId) } },
        select: { id: true, itemProduzidoId: true },
      })
    : []
  const itens = ordens.length
    ? await db.stockItem.findMany({
        where: { companyId, id: { in: ordens.map((o) => o.itemProduzidoId) } },
        select: { id: true, nome: true },
      })
    : []
  const nome = new Map(itens.map((i) => [i.id, i.nome]))
  const itemDaOrdem = new Map(ordens.map((o) => [o.id, o.itemProduzidoId]))

  const vivos: string[] = []
  for (const d of fora) {
    vivos.push(d.ordemId)
    const n = nome.get(itemDaOrdem.get(d.ordemId) ?? '') ?? 'o produto'
    await gravar(
      {
        companyId,
        setor: 'producao',
        severidade: 'vermelho',
        titulo: `Confira o lote de ${n} — saiu ${Math.round(d.pctTeorico)}% do esperado`,
        corpo:
          `Um lote de ${n} rendeu ${Math.round(d.pctTeorico)}% do que a ficha promete. ` +
          `Isso não é variação de cozinha: ou a quantidade foi digitada em outra unidade, ou a ficha está errada.`,
        oQueFazer: `Abra a ordem e confira quantas unidades saíram de verdade — e em qual unidade elas foram contadas.`,
        acaoRotulo: 'abrir a ordem',
        acaoHref: `/empresas/${companyId}/estoque/producao/${d.ordemId}`,
        origem: 'LOTE_GRANDEZA',
        alvo: d.ordemId,
      },
      r,
      db,
    )
  }
  r.resolvidos += await reconciliarOrigem(companyId, 'LOTE_GRANDEZA', vivos, db)
}

/**
 * ⭐⭐⭐ A PORTA: roda os 4 produtores de produção pra uma empresa.
 *
 * ⚠️ Chamada pelo cron das 3h **e** pela primeira carga — é a mesma função, e é por isso que a
 * central nasce útil sem um script com texto duplicado.
 */
export async function produzirAvisosDeProducao(
  companyId: string,
  db: Db = prisma,
): Promise<ResumoDaCarga> {
  const r: ResumoDaCarga = { gravados: 0, reabertos: 0, resolvidos: 0, recusados: [] }
  await padraoDeRendimento(companyId, r, db)
  await fichaNaoComparavel(companyId, r, db)
  await ordemParada(companyId, r, db)
  await loteDeGrandezaImpossivel(companyId, r, db)
  return r
}
