// ESTOQUE FASE 3 passo 2 — BAIXA_VENDA. A venda baixa o estoque: produto que MONTA na
// venda (PRODUTO_FINAL) EXPLODE nos componentes recursivamente; intermediário produzido em
// lote (beef, porção) baixa o PACK; matéria-prima/revenda baixa direto. Idempotente por dia
// (reprocessar estorna as baixas anteriores e refaz — movimento é imutável). Só stock_.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { explodirReceita } from '@/lib/stock/explodir-receita'
import { parseSuitable } from './parse-suitable'
import { lerComQuarentena } from './quarentena-venda'
import { medirSanidade, SanidadeNaoConfirmadaError } from './medir-sanidade'
import type { ResultadoDaSanidade } from './sanidade-do-import'
import { criarMovimento, estornarMovimento } from '../movement'
import { custoMedioPorItem, recomputeSaldoCache, saldosDaEmpresa } from '../saldo'
import { avaliarResiduo, custoParaBaixar } from '../residuo-de-centavos'
import { BaixaComItemBarradoError, semOsPendentes, type ItemBarrado } from './itens-pendentes-da-baixa'
import { MovementInvalidError } from '../movement'

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
/**
 * ⭐⭐ A QUANTIDADE ANDA EM 6 CASAS (29/09/2026), o dinheiro continua em 2.
 *
 * ⛔ **Este era o SEGUNDO motor com o mesmo defeito** (REGRA 4 — achar todas as cópias): a
 * explosão da ficha somava com `round2`, então componente dosado em décimo de grama
 * (fermento 0,0003 KG) virava **0,00** na baixa de uma unidade — e movimento com quantidade
 * zero o ledger RECUSA. A venda simplesmente não baixaria aquele componente.
 *
 * ⚠️ Só a QUANTIDADE muda de degrau; `custoTotal` segue em 2 casas, porque dinheiro tem 2
 * casas e o CHECK do ledger tolera ±0,01 por linha.
 */
const round6 = (n: number) => Math.round((n + 1e-9) * 1_000_000) / 1_000_000
const TIPO_BAIXA = 'BAIXA_VENDA'

// ⭐ EXPORTADOS (27/08) pro hub do cardápio calcular o custo do produto pela MESMA explosão
// que a venda usa pra BAIXAR. Se o cardápio tivesse fórmula própria, o custo da tela e o
// custo que sai do estoque divergiriam no 1º caso de borda — a doença dos 7 detectores de
// par. Nenhuma linha de lógica mudou aqui: só a visibilidade.
import { semearSecoesDeNovos } from '@/lib/stock/cardapio/secoes-db'

/**
 * ⚠️ ESTE CTX **É** O `GrafoDeFichas` da porta única (02/10/2026) — os dois primeiros campos
 * têm a forma que `explodirReceita` pede, de propósito. Montar um grafo "parecido" aqui seria
 * a segunda representação da mesma receita, e as duas divergiriam no 1º campo novo.
 */
export interface Ctx {
  componentesByFicha: Map<string, { itemId: string; qtdPlanejada: number }[]>
  fichaByItemProduzido: Map<string, { id: string; tipoProduto: string; itemProduzidoId: string }>
  fichaById: Map<string, { id: string; tipoProduto: string; itemProduzidoId: string }>
  nomeItem: Map<string, string>
}

export async function montarCtx(companyId: string, db: PrismaClient): Promise<Ctx> {
  const fichas = await db.stockFicha.findMany({ where: { companyId, ativo: true }, select: { id: true, tipoProduto: true, itemProduzidoId: true, versaoAtual: true } })
  const componentesByFicha = new Map<string, { itemId: string; qtdPlanejada: number }[]>()
  for (const f of fichas) {
    const v = await db.stockFichaVersao.findFirst({ where: { companyId, fichaId: f.id, versao: f.versaoAtual }, select: { id: true } })
    const comps = v ? await db.stockFichaComponente.findMany({ where: { companyId, versaoId: v.id }, select: { itemId: true, qtdPlanejada: true } }) : []
    componentesByFicha.set(f.id, comps)
  }
  const itens = await db.stockItem.findMany({ where: { companyId }, select: { id: true, nome: true } })
  return {
    componentesByFicha,
    fichaByItemProduzido: new Map(fichas.map((f) => [f.itemProduzidoId, { id: f.id, tipoProduto: f.tipoProduto, itemProduzidoId: f.itemProduzidoId }])),
    fichaById: new Map(fichas.map((f) => [f.id, { id: f.id, tipoProduto: f.tipoProduto, itemProduzidoId: f.itemProduzidoId }])),
    nomeItem: new Map(itens.map((i) => [i.id, i.nome])),
  }
}

/**
 * ⭐ CASCA FINA SOBRE A PORTA ÚNICA (`explodirReceita`, 02/10/2026).
 *
 * ⛔ **A recursão e a régua ESTOCADO×ATRAVESSA saíram daqui** — a decisão *"desce ou para?"*
 * tem um dono só agora. Esta função existe porque os chamadores (plano de venda, baixa de
 * complemento, custo do cardápio) acumulam **várias** explosões no mesmo `acc`, uma por linha
 * do PDV; a porta responde por UMA.
 *
 * ⚠️ **O `acc` fica EXATO** — quem arredonda é a borda de gravação (o `round6` já existe em
 * `montarPlanoDeLinhas`). Somar arredondado a cada linha é o arredondamento composto que o
 * dono proibiu: 500 linhas de 0,0003 KG perdiam dose de verdade.
 *
 * ⭐ `rastro` (opcional) colhe as FICHAS que a explosão atravessou. É o que permite o juiz
 * M1 perguntar *"a receita mudou depois desta baixa?"* sobre as fichas CERTAS — sem ele, a
 * pergunta viraria *"alguma ficha da empresa mudou?"*, e qualquer edição de receita daria
 * perdão geral à divergência de todos os dias.
 *
 * ⚠️ O parâmetro `depth` que existia aqui MORREU: o teto de profundidade (e o aviso de ciclo)
 * é da porta agora. Nenhum chamador o passava — conferido antes de trocar.
 */
export function explodir(alvo: { tipo: 'REVENDA'; itemId: string } | { tipo: 'FICHA'; fichaId: string }, qtd: number, ctx: Ctx, acc: Map<string, number>, rastro?: Set<string>): void {
  const r = explodirReceita(
    alvo.tipo === 'REVENDA' ? { itemId: alvo.itemId } : { fichaId: alvo.fichaId },
    qtd,
    ctx,
    'VENDA',
  )
  for (const c of r.consumos) {
    acc.set(c.itemId, (acc.get(c.itemId) ?? 0) + c.qtd)
    if (rastro) for (const f of c.viaFichas) rastro.add(f)
  }
}

export interface ProdutoBaixa { nome: string; quantidade: number; alvoTipo: 'FICHA' | 'REVENDA'; alvoNome: string; baixa: { itemId: string; nome: string; qtd: number; custoMedio: number | null }[] }
export interface PlanoVenda {
  data: string
  produtos: ProdutoBaixa[]
  pendentes: { nome: string; quantidade: number }[]
  fora: { nome: string; quantidade: number }[] // mapeado, mas o dono NÃO marcou pra este processamento
  /** ⭐ decisão do dono: não controla estoque. Não baixa e NÃO é pendente (14/09) */
  ignorados: { nome: string; quantidade: number }[]
  agregada: { itemId: string; nome: string; qtd: number; custoMedio: number | null; valor: number | null }[]
  totalUnidades: number
  totalMapeados: number
  totalPendentes: number
  /**
   * ⭐ As FICHAS que a explosão atravessou neste plano (o rastro da porta única).
   * O juiz M1 usa pra perguntar *"a receita mudou depois desta baixa?"* sobre as fichas
   * CERTAS — ver `lib/stock/vendas/juiz-da-baixa.ts`.
   */
  fichasUsadas: string[]
  /** ⭐ o que perguntar antes de baixar (N× a média) — o plano CARREGA a pergunta */
  sanidade: ResultadoDaSanidade
}

export interface LinhaVenda { produto: string; quantidade: number; valorTotal: number }

/** DRY-RUN a partir de LINHAS (parseadas ou do banco). incluir = nomes marcados pelo dono
 *  (null = todos os mapeados). Mapeado não-marcado → "fora" (não baixa, não é pendente). */
export async function montarPlanoDeLinhas(companyId: string, data: string, linhas: LinhaVenda[], incluir: string[] | null, db: PrismaClient = defaultPrisma): Promise<PlanoVenda> {
  const [mapa, ctx, custoMap, sanidade] = await Promise.all([
    db.stockVendaProdutoMap.findMany({ where: { companyId }, select: { nomeSuitable: true, alvoTipo: true, fichaId: true, itemId: true } }),
    montarCtx(companyId, db),
    custoMedioPorItem(db, companyId),
    medirSanidade(companyId, linhas.map((l) => ({ produto: l.produto, quantidade: l.quantidade })), db),
  ])
  const mapaPorNome = new Map(mapa.map((m) => [m.nomeSuitable, m]))
  const incluirSet = incluir ? new Set(incluir) : null
  const nomeAlvo = (m: { alvoTipo: string; fichaId: string | null; itemId: string | null }) =>
    m.alvoTipo === 'FICHA' ? ctx.nomeItem.get(ctx.fichaById.get(m.fichaId ?? '')?.itemProduzidoId ?? '') ?? '(ficha)' : ctx.nomeItem.get(m.itemId ?? '') ?? '(item)'

  const produtos: ProdutoBaixa[] = []
  const pendentes: { nome: string; quantidade: number }[] = []
  const fora: { nome: string; quantidade: number }[] = []
  /** ⭐ decisão do dono: este nome não controla estoque (14/09). NOMEADO, nunca só contado. */
  const ignorados: { nome: string; quantidade: number }[] = []
  const agregada = new Map<string, number>()
  /** ⭐ o rastro da porta: por quais fichas a explosão passou (o juiz M1 lê isto) */
  const fichasUsadas = new Set<string>()

  for (const l of linhas) {
    const m = mapaPorNome.get(l.produto)
    if (!m) { pendentes.push({ nome: l.produto, quantidade: l.quantidade }); continue }
    // ⛔ IGNORAR é DECISÃO, não ausência: não baixa, não volta pra fila, e aparece
    // nomeado no plano — "exclusão escondida é tão ruim quanto exclusão nenhuma" (25/08).
    if (m.alvoTipo === 'IGNORAR') { ignorados.push({ nome: l.produto, quantidade: l.quantidade }); continue }
    if (incluirSet && !incluirSet.has(l.produto)) { fora.push({ nome: l.produto, quantidade: l.quantidade }); continue }
    const acc = new Map<string, number>()
    if (m.alvoTipo === 'FICHA' && m.fichaId) explodir({ tipo: 'FICHA', fichaId: m.fichaId }, l.quantidade, ctx, acc, fichasUsadas)
    else if (m.alvoTipo === 'REVENDA' && m.itemId) explodir({ tipo: 'REVENDA', itemId: m.itemId }, l.quantidade, ctx, acc, fichasUsadas)
    const baixa = [...acc.entries()].map(([itemId, qtd]) => ({ itemId, nome: ctx.nomeItem.get(itemId) ?? '(item)', qtd: round6(qtd), custoMedio: custoMap.get(itemId) ?? null }))
    for (const [itemId, qtd] of acc) agregada.set(itemId, round6((agregada.get(itemId) ?? 0) + qtd))
    produtos.push({ nome: l.produto, quantidade: l.quantidade, alvoTipo: m.alvoTipo as 'FICHA' | 'REVENDA', alvoNome: nomeAlvo(m), baixa })
  }

  return {
    data, produtos, pendentes, fora, ignorados,
    agregada: [...agregada.entries()].map(([itemId, qtd]) => { const c = custoMap.get(itemId) ?? null; return { itemId, nome: ctx.nomeItem.get(itemId) ?? '(item)', qtd: round6(qtd), custoMedio: c, valor: c != null ? round2(qtd * c) : null } }),
    totalUnidades: linhas.reduce((s, l) => s + l.quantidade, 0),
    totalMapeados: produtos.length,
    totalPendentes: pendentes.length,
    fichasUsadas: [...fichasUsadas],
    sanidade,
  }
}

/** DRY-RUN a partir do HTML do Suitable. */
export async function montarPlanoVenda(companyId: string, data: string, html: string, db: PrismaClient = defaultPrisma, incluir: string[] | null = null): Promise<PlanoVenda> {
  // ⭐ a leitura passa pela porta ÚNICA: guarda o arquivo (falhe ou feche) e a recusa ensina
  const { resultado } = await lerComQuarentena({ companyId, relatorio: 'PRODUTOS', html, data }, parseSuitable, db)
  return montarPlanoDeLinhas(companyId, data, resultado.linhas, incluir, db)
}

export interface ReciboVenda { importId: string; data: string; baixados: number; itensBaixados: number; pendentes: number; valorBaixado: number }

/** EXECUTA a partir do HTML (import novo do dia). */
export async function processarVendas(companyId: string, data: string, html: string, userId: string | undefined, db: PrismaClient = defaultPrisma, incluir: string[] | null = null, confirmouSanidade = false, itensPendentes: string[] = []): Promise<ReciboVenda> {
  const { resultado } = await lerComQuarentena({ companyId, relatorio: 'PRODUTOS', html, data, userId }, parseSuitable, db)
  return gravarVenda(companyId, data, resultado.linhas, incluir, userId, db, confirmouSanidade, itensPendentes)
}

/** DRY-RUN do reprocesso: o que vai acontecer se refizer um dia já importado (com o mapa
 *  ATUAL) + quantas baixas ativas serão estornadas. Não grava. */
export async function montarPlanoReprocesso(companyId: string, data: string, db: PrismaClient = defaultPrisma): Promise<{ plano: PlanoVenda; estornaItens: number } | null> {
  const dataDate = new Date(`${data}T12:00:00`)
  const imp = await db.stockVendaImport.findUnique({ where: { companyId_data: { companyId, data: dataDate } }, select: { id: true } })
  if (!imp) return null
  const linhas = await db.stockVendaLinha.findMany({ where: { companyId, importId: imp.id }, select: { nomeSuitable: true, quantidade: true, valorTotal: true } })
  const plano = await montarPlanoDeLinhas(companyId, data, linhas.map((l) => ({ produto: l.nomeSuitable, quantidade: l.quantidade, valorTotal: l.valorTotal })), null, db)
  const baixas = await db.stockMovement.findMany({ where: { companyId, receiptId: imp.id, tipo: 'BAIXA_VENDA' }, select: { id: true } })
  const estornos = new Set((await db.stockMovement.findMany({ where: { companyId, tipo: 'ESTORNO', estornoDeId: { in: baixas.map((b) => b.id) } }, select: { estornoDeId: true } })).map((e) => e.estornoDeId))
  return { plano, estornaItens: baixas.filter((b) => !estornos.has(b.id)).length }
}

/** REPROCESSA um dia já importado a partir das linhas GRAVADAS (sem re-upload) — quando o
 *  dono mapeia mais fichas depois. incluir = null → todos os mapeados atuais. Idempotente. */
export async function reprocessarDia(companyId: string, data: string, userId: string | undefined, db: PrismaClient = defaultPrisma, confirmouSanidade = false, itensPendentes: string[] = []): Promise<ReciboVenda> {
  const dataDate = new Date(`${data}T12:00:00`)
  const imp = await db.stockVendaImport.findUnique({ where: { companyId_data: { companyId, data: dataDate } }, select: { id: true } })
  if (!imp) throw new Error('Não há import desse dia pra reprocessar.')
  const linhas = await db.stockVendaLinha.findMany({ where: { companyId, importId: imp.id }, select: { nomeSuitable: true, quantidade: true, valorTotal: true } })
  return gravarVenda(companyId, data, linhas.map((l) => ({ produto: l.nomeSuitable, quantidade: l.quantidade, valorTotal: l.valorTotal })), null, userId, db, confirmouSanidade, itensPendentes)
}

/** EXECUTA: cria/atualiza o import do dia (idempotente), estorna baixas anteriores e refaz,
 *  grava BAIXA_VENDA no ledger + as linhas (pra pendentes/reprocessar). */
async function gravarVenda(companyId: string, data: string, linhas: LinhaVenda[], incluir: string[] | null, userId: string | undefined, db: PrismaClient = defaultPrisma, confirmouSanidade = false, itensPendentes: string[] = []): Promise<ReciboVenda> {
  const plano = await montarPlanoDeLinhas(companyId, data, linhas, incluir, db)
  // ⛔⛔ ANTES DE ESCREVER: o import de 10/09 baixou 1.499 FANTA UVA porque nada perguntou.
  // Quem recusa é o SERVIDOR (a régua do FREIO da contagem) — aviso que mora na tela some
  // no dia em que a rota for chamada por outro caminho.
  if (plano.sanidade.precisaConfirmar && !confirmouSanidade) throw new SanidadeNaoConfirmadaError(plano.sanidade)
  const dataDate = new Date(`${data}T12:00:00`)
  const totalUnidades = linhas.reduce((s, l) => s + l.quantidade, 0)

  const importId = await db.$transaction(async (tx) => {
    // import do dia (idempotente por data)
    const imp = await tx.stockVendaImport.upsert({
      where: { companyId_data: { companyId, data: dataDate } },
      create: { companyId, data: dataDate, totalLinhas: linhas.length, totalUnidades, status: 'CONFIRMADO', criadoPorId: userId ?? null },
      update: { totalLinhas: linhas.length, totalUnidades, status: 'CONFIRMADO' },
    })
    // REPROCESSO: estorna as BAIXA_VENDA ativas deste import (movimento imutável → estorno)
    const baixasAntigas = await tx.stockMovement.findMany({ where: { companyId, receiptId: imp.id, tipo: TIPO_BAIXA }, select: { id: true } })
    const estornos = await tx.stockMovement.findMany({ where: { companyId, tipo: 'ESTORNO', estornoDeId: { in: baixasAntigas.map((b) => b.id) } }, select: { estornoDeId: true } })
    const jaEstornado = new Set(estornos.map((e) => e.estornoDeId))
    for (const b of baixasAntigas) if (!jaEstornado.has(b.id)) await estornarMovimento(tx, b.id, { criadoPorId: userId ?? null })

    /**
     * ⭐⭐ BAIXA NOVA — **custo em PRECISÃO CHEIA** (19/09).
     *
     * ⛔⛔ Antes: `custoMedioPorItem` devolve o custo **arredondado em 2 casas**, e a baixa
     * multiplicava pela quantidade — o erro **cresce com a quantidade**. Medido em prod:
     * zerar 1.019 ovos a `0,55` deixava **R$ −4,81** de resíduo, e **55 dos 215 itens**
     * estavam nesse estado. Era isso que barrava o lote inteiro do dono.
     *
     * ⭐ *O ledger guarda precisão cheia; quem arredonda é a leitura* — a lição que já
     * mordeu na reunitização do pão (2,3125) e na conclusão de produção. Com o custo cheio,
     * zerar a quantidade zera o valor **por construção**: o resíduo não nasce.
     *
     * ⚠️ E quando a baixa ZERA o item, ela leva o valor que sobrou do histórico junto —
     * dentro do teto do arredondamento (`avaliarResiduo`). Acima do teto continua recusando:
     * ali não é centavo, é dado torto.
     */
    const saldosAgora = await saldosDaEmpresa(tx, companyId)
    const estado = new Map(saldosAgora.map((s) => [s.itemId, s]))
    const barrados: ItemBarrado[] = []
    const aBaixar = semOsPendentes(plano.agregada, itensPendentes)
    for (const a of aBaixar) {
      if (a.qtd <= 0) continue
      const at = estado.get(a.itemId)
      const custo = custoParaBaixar(at?.valor ?? 0, at?.saldo ?? 0)
      let custoTotal = round2(-a.qtd * custo)
      const v = avaliarResiduo({
        saldoAntes: at?.saldo ?? 0, valorAntes: at?.valor ?? 0,
        qtdDaBaixa: a.qtd, valorDaBaixa: Math.abs(custoTotal),
      })
      // ⭐ zerou a quantidade e sobrou resíduo do histórico? vai junto — zerar qtd zera valor
      if (v.decisao === 'AJUSTA_RESIDUO') custoTotal = round2(custoTotal + v.valorDepois)
      try {
        await criarMovimento(tx, { companyId, itemId: a.itemId, tipo: TIPO_BAIXA, quantidade: -a.qtd, custoUnitario: custo, custoTotal, receiptId: imp.id, origem: 'MANUAL', criadoPorId: userId ?? null, dataMovimento: dataDate })
      } catch (e) {
        /**
         * ⛔ O LOTE NÃO É REFÉM DE UM: em vez de estourar no primeiro barrado, junta TODOS
         * e devolve a recusa com o caminho ("baixa os outros N e deixa estes pendentes").
         * ⚠️ A transação ainda é tudo-ou-nada — o `throw` abaixo a desfaz. O que mudou é
         * que a recusa agora NOMEIA e OFERECE.
         */
        if (e instanceof MovementInvalidError) { barrados.push({ itemId: a.itemId, nome: e.culpado?.nome ?? a.nome, motivo: e.message }); continue }
        throw e
      }
    }
    if (barrados.length) throw new BaixaComItemBarradoError(barrados, aBaixar.filter((x) => x.qtd > 0).length - barrados.length)

    // linhas (todas) pra pendentes/reprocessar — reescreve
    await tx.stockVendaLinha.deleteMany({ where: { companyId, importId: imp.id } })
    const mapaNomes = new Set((await tx.stockVendaProdutoMap.findMany({ where: { companyId }, select: { nomeSuitable: true } })).map((m) => m.nomeSuitable))
    await tx.stockVendaLinha.createMany({ data: linhas.map((l) => ({ companyId, importId: imp.id, data: dataDate, nomeSuitable: l.produto, quantidade: l.quantidade, valorTotal: l.valorTotal, mapeadoNoImport: mapaNomes.has(l.produto) })) })
    return imp.id
  })

  await recomputeSaldoCache(db, companyId)

  // ⭐⭐ PRODUTO NOVO ENTRA COM A SEÇÃO SUGERIDA, MARCADA (08/09) — decisão do dono:
  // *"entra com a seção sugerida pela mesma régua, marcada 'sugerida' até eu confirmar"*.
  //
  // ⛔ DEPOIS do commit e fail-soft, no padrão do recebimento: classificar é um bônus, e
  // um problema aqui não pode derrubar um import de vendas legítimo. ⚠️ E quem já tem
  // seção NÃO é tocado — reavaliar a cada import reabriria a decisão do dono.
  try {
    await semearSecoesDeNovos(companyId, linhas.map((l) => l.produto), db)
  } catch (e) {
    console.warn('[vendas] semear seções falhou (import seguiu):', (e as Error).message)
  }

  return {
    importId, data,
    baixados: plano.totalMapeados,
    itensBaixados: plano.agregada.length,
    pendentes: plano.totalPendentes,
    valorBaixado: round2(plano.agregada.reduce((s, a) => s + (a.valor ?? 0), 0)),
  }
}

export interface DiaProcessado { data: string; totalLinhas: number; totalUnidades: number; baixados: number; itensBaixados: number; valorBaixado: number; pendentes: number; status: string }

/** Histórico "Processados" — um dia por linha, com o que baixou e quantos pendentes. */
export async function listProcessados(companyId: string, db: PrismaClient = defaultPrisma): Promise<DiaProcessado[]> {
  const imports = await db.stockVendaImport.findMany({ where: { companyId }, orderBy: { data: 'desc' }, take: 90 })
  const out: DiaProcessado[] = []
  for (const imp of imports) {
    const [movs, linhas, mapa] = await Promise.all([
      db.stockMovement.findMany({ where: { companyId, receiptId: imp.id, tipo: 'BAIXA_VENDA' }, select: { id: true, itemId: true, custoTotal: true } }),
      db.stockVendaLinha.findMany({ where: { companyId, importId: imp.id }, select: { nomeSuitable: true } }),
      db.stockVendaProdutoMap.findMany({ where: { companyId }, select: { nomeSuitable: true } }),
    ])
    // baixas ATIVAS (sem estorno) — custo total baixado
    const estornos = new Set((await db.stockMovement.findMany({ where: { companyId, tipo: 'ESTORNO', estornoDeId: { in: movs.map((m) => m.id) } }, select: { estornoDeId: true } })).map((e) => e.estornoDeId))
    const ativas = movs.filter((m) => !estornos.has(m.id))
    const mapeados = new Set(mapa.map((m) => m.nomeSuitable))
    const pendentes = new Set(linhas.filter((l) => !mapeados.has(l.nomeSuitable)).map((l) => l.nomeSuitable)).size
    out.push({
      data: imp.data.toISOString().slice(0, 10), totalLinhas: imp.totalLinhas, totalUnidades: imp.totalUnidades,
      baixados: linhas.length - pendentes, itensBaixados: new Set(ativas.map((m) => m.itemId)).size,
      valorBaixado: round2(ativas.reduce((s, m) => s + Math.abs(m.custoTotal), 0)), pendentes, status: imp.status,
    })
  }
  return out
}

/** Pendentes de mapa (linhas de qualquer dia cujo nome ainda não foi mapeado). */
export async function vendasPendentesDeMapa(companyId: string, db: PrismaClient = defaultPrisma) {
  const [linhas, mapa] = await Promise.all([
    db.stockVendaLinha.findMany({ where: { companyId }, orderBy: { data: 'desc' }, select: { nomeSuitable: true, quantidade: true, data: true } }),
    db.stockVendaProdutoMap.findMany({ where: { companyId }, select: { nomeSuitable: true } }),
  ])
  const mapeados = new Set(mapa.map((m) => m.nomeSuitable))
  const agg = new Map<string, { quantidade: number; dias: number; ultima: string }>()
  for (const l of linhas) {
    if (mapeados.has(l.nomeSuitable)) continue
    const cur = agg.get(l.nomeSuitable) ?? { quantidade: 0, dias: 0, ultima: l.data.toISOString() }
    cur.quantidade += l.quantidade; cur.dias += 1
    agg.set(l.nomeSuitable, cur)
  }
  return [...agg.entries()].map(([nome, v]) => ({ nome, ...v })).sort((a, b) => b.quantidade - a.quantidade)
}
