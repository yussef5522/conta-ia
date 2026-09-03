// ESTOQUE FASE 2 item 2.0 — FICHAS técnicas versionadas (a fonte que a produção vai usar).
// HEAD (identidade + item produzido + versão atual + preço) + VERSÃO (corpo: componentes,
// lote base, preparo). Editar componente/qtd/lote → versão nova (ordens antigas apontam pra
// versão da época). Ciclo proibido (grafo do banco). Custo teórico AO VIVO. Só stock_.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { ehTipoDeFicha, type TipoFicha } from '@/lib/stock/tipos-ficha'
import { detectaCicloFicha, type GrafoFichas } from './ciclo'
import { calcularCustoTeorico, calcularMargem, type ComponenteCusto } from './custo-teorico'
import { custoMedioPorItem } from '../saldo'
import { normalizarBusca } from '@/lib/busca-texto'
import { rendimentoMedidoDaFicha } from './conclusao'

type Db = PrismaClient | Prisma.TransactionClient

export interface ComponenteInput { itemId: string; qtdPlanejada: number; unidade: string; posicao?: number }
export interface FichaBodyInput {
  loteBase: number
  unidadeLoteBase: string
  modoPreparo?: string | null
  tempoPreparoMin?: number | null
  validadeDias?: number | null
  componentes: ComponenteInput[]
}
export interface CriarFichaInput extends FichaBodyInput {
  companyId: string
  userId?: string
  nomeProduzido: string
  unidadeProduzido: string // KG | UN | LT
  tipoProduto: TipoFicha
  setorId?: string | null
  valorVenda?: number | null
  /**
   * ⭐⭐ O NOME DO PDV QUE ESTA FICHA ATENDE (01/09/2026). Quando vem preenchido, o vínculo
   * `nome do Suitable → ficha` é criado **NA MESMA TRANSAÇÃO** — ficha e vínculo entram
   * juntos ou não entram.
   *
   * ⛔ INCIDENTE QUE CRIOU ISTO: o dono montou a ficha do XIS COMPLETO e de duas PIZZAS
   * pelo cardápio. As **três gravaram** — completas, com componentes e preço — e as três
   * ficaram **ÓRFÃS**: `criarFicha` criava a ficha e **nada** chamava `upsertVendaMap`, que
   * é quem liga o nome do PDV. O cardápio monta a linha por esse vínculo, então a tela
   * voltava dizendo "sem ficha" e o dono concluía que não tinha salvo. **A PIZZA saiu
   * DUPLICADA no mesmo minuto** — a assinatura de "não apareceu, tentei de novo".
   */
  /**
   * ⭐ O NOME (ou NOMES) do PDV que esta ficha atende.
   * ⚠️ ACEITA LISTA porque o PDV escreve o mesmo produto de vários jeitos
   * ("XIS COMPLETO" e "XIS - COMPLETO"): mapear só um deixaria metade das vendas sem baixar.
   */
  mapearNomeSuitable?: string | string[] | null
  /**
   * ⭐⭐ O NOME DO COMPLEMENTO que esta ficha atende (02/09/2026) — mesmo mecanismo do
   * `mapearNomeSuitable`, no mapa dos COMPLEMENTOS.
   *
   * ⛔ EXISTE PORQUE O BUG JÁ ACONTECEU, no mesmo lugar: em 01/09 o dono montou 3 fichas
   * pelo cardápio e as 3 ficaram ÓRFÃS — gravaram completas e nada as ligava ao nome do
   * PDV, então a tela voltava "sem ficha" e ele achava que não tinha salvo (e a PIZZA saiu
   * DUPLICADA). Aqui o gesto vai se repetir **~50 vezes** (um sabor por vez): sem o vínculo
   * na mesma transação, seriam ~50 chances do mesmo erro.
   *
   * ⚠️ MUTUAMENTE EXCLUSIVO com `mapearNomeSuitable`: produto aponta pra PRODUTO_FINAL,
   * complemento pra INTERMEDIARIO. Mandar os dois é sinal de chamada errada.
   */
  /**
   * ⭐ ACEITA LISTA (03/09): o PDV manda o mesmo sabor em várias grafias, e o dono confirma
   * o grupo de uma vez. Sem isso ele faria uma viagem ao editor **por grafia** — ~31 vezes
   * pra dizer 31 vezes a mesma coisa.
   */
  mapearComplemento?: string | string[] | null
}

export class FichaError extends Error {}

/** Grafo produzido→componentes das fichas ATIVAS (versão atual). Pra detectar ciclo. */
export async function buildGrafoFichas(companyId: string, db: Db, exceptFichaId?: string): Promise<GrafoFichas> {
  const fichas = await db.stockFicha.findMany({ where: { companyId, ativo: true }, select: { id: true, itemProduzidoId: true, versaoAtual: true } })
  const g: GrafoFichas = new Map()
  for (const f of fichas) {
    if (f.id === exceptFichaId) continue
    const versao = await db.stockFichaVersao.findFirst({ where: { companyId, fichaId: f.id, versao: f.versaoAtual }, select: { id: true } })
    if (!versao) continue
    const comps = await db.stockFichaComponente.findMany({ where: { companyId, versaoId: versao.id }, select: { itemId: true } })
    g.set(f.itemProduzidoId, comps.map((c) => c.itemId))
  }
  return g
}

export async function criarFicha(input: CriarFichaInput, db: PrismaClient = defaultPrisma): Promise<{ fichaId: string; itemProduzidoId: string; vinculadoAoPdv: boolean }> {
  if (!input.componentes.length) throw new FichaError('A ficha precisa de ao menos um componente.')
  if (!ehTipoDeFicha(input.tipoProduto)) throw new FichaError('Tipo de produto inválido.')

  // ⛔⛔ SEGUNDA FICHA PRO MESMO PRODUTO É RECUSADA (01/09/2026). `criarFicha` cria um
  // stock_item NOVO a cada chamada, então "salvar de novo" não colidia com nada e nascia um
  // segundo produto com o mesmo nome e ficha própria — foi assim que a PIZZA PEQUENA 25CM
  // ficou duplicada às 23:22. A comparação é por nome NORMALIZADO (sem caixa/acento), a
  // mesma régua da busca do catálogo.
  const jaExiste = await fichaAtivaComNome(input.companyId, input.nomeProduzido, db)
  if (jaExiste) {
    throw new FichaError(
      `Já existe uma ficha para “${jaExiste.nome}”. Edite a ficha existente em vez de criar outra — ` +
      'duas fichas do mesmo produto brigam pelo vínculo com o PDV e pelo custo.',
    )
  }

  return db.$transaction(async (tx) => {
    // item produzido (novo stock_item; INTERMEDIARIO/PRODUTO_FINAL como categoria)
    const produzido = await tx.stockItem.create({
      data: { companyId: input.companyId, nome: input.nomeProduzido.trim(), unidadeControle: input.unidadeProduzido, categoria: input.tipoProduto, criadoVia: 'MANUAL', criadoPorId: input.userId ?? null },
    })

    // ciclo (novo item não está em nenhuma ficha → impossível, mas valida por segurança)
    const grafo = await buildGrafoFichas(input.companyId, tx)
    const ciclo = detectaCicloFicha(produzido.id, input.componentes.map((c) => c.itemId), grafo)
    if (ciclo.ciclo) throw new FichaError('Esses componentes criariam um ciclo (a ficha usaria a si mesma).')

    const ficha = await tx.stockFicha.create({
      data: { companyId: input.companyId, itemProduzidoId: produzido.id, tipoProduto: input.tipoProduto, setorId: input.setorId ?? null, versaoAtual: 1, valorVenda: input.valorVenda ?? null, criadoPorId: input.userId ?? null },
    })
    const versao = await tx.stockFichaVersao.create({
      data: { companyId: input.companyId, fichaId: ficha.id, versao: 1, loteBase: input.loteBase, unidadeLoteBase: input.unidadeLoteBase, modoPreparo: input.modoPreparo ?? null, tempoPreparoMin: input.tempoPreparoMin ?? null, validadeDias: input.validadeDias ?? null, criadoPorId: input.userId ?? null },
    })
    await tx.stockFichaComponente.createMany({ data: input.componentes.map((c, i) => ({ companyId: input.companyId, versaoId: versao.id, itemId: c.itemId, qtdPlanejada: c.qtdPlanejada, unidade: c.unidade, posicao: c.posicao ?? i })) })

    // ⭐ O VÍNCULO COM O PDV, NA MESMA TRANSAÇÃO. Se ele falhar, a ficha também não entra —
    // é a regra do módulo (a mesma das marcações do import: "ou grava tudo, ou nada grava").
    // ⚠️ `upsertVendaMap` não serve aqui porque abre transação própria; a validação dos 3
    // níveis que ele faz é redundante neste caminho (a ficha é PRODUTO_FINAL por construção).
    // ⭐ conta o que REALMENTE entrou no banco. ⚠️ Antes era `!!input.mapearNomeSuitable`:
    // a flag afirmava vínculo que podia nunca ter sido gravado — "a flag diz PARECE, o
    // vínculo diz É" (lição de 29/08, na marcação de cartão).
    let vinculos = 0
    if (input.mapearNomeSuitable && input.mapearComplemento) {
      throw new FichaError('Uma ficha não pode ser mapeada como produto e como complemento no mesmo gesto.')
    }
    // ⭐ o vínculo do COMPLEMENTO, na MESMA transação — ficha e vínculo entram juntos ou
    // não entram. É a correção do bug das 3 fichas órfãs, aplicada antes de ele repetir.
    const complementos = (Array.isArray(input.mapearComplemento) ? input.mapearComplemento
      : input.mapearComplemento ? [input.mapearComplemento] : []).map((n) => n.trim()).filter(Boolean)
    for (const nomeSuitable of complementos) {
      vinculos++
      await tx.stockVendaComplementoMap.upsert({
        where: { companyId_nomeSuitable: { companyId: input.companyId, nomeSuitable } },
        create: { companyId: input.companyId, nomeSuitable, alvoTipo: 'FICHA', fichaId: ficha.id, criadoPorId: input.userId ?? null },
        update: { alvoTipo: 'FICHA', fichaId: ficha.id },
      })
    }
    // ⛔⛔ NOME PREFIXADO NUNCA VIRA MAPEAMENTO (03/09): a tela do produto mandava a CHAVE
    // do hub (`nome:GRANDE PRECINHO`, `ficha:<id>`) no lugar do nome do PDV, e o sistema
    // gravava alegremente um mapeamento com um nome que **não existe em relatório nenhum** —
    // a ficha nascia órfã E o banco ficava com lixo. A trava é aqui, na FONTE: quem grava
    // recusa a chave interna, então nenhuma tela futura consegue repetir isso.
    const nomesPdv = (Array.isArray(input.mapearNomeSuitable) ? input.mapearNomeSuitable
      : input.mapearNomeSuitable ? [input.mapearNomeSuitable] : [])
      .map((n) => n.trim()).filter(Boolean)
    for (const n of nomesPdv) {
      if (/^(nome|ficha|item):/.test(n)) {
        throw new FichaError(`"${n}" é chave interna da tela, não o nome do PDV. Mande o nome como o PDV escreve.`)
      }
    }
    if (nomesPdv.length && input.tipoProduto !== 'PRODUTO_FINAL') {
      // ⚠️ recusa BARULHENTA em vez de pular calado: pular é o que fazia o
      // `vinculadoAoPdv` dizer "vinculei" sem ter gravado nada.
      throw new FichaError('Só ficha de PRODUTO FINAL pode atender um nome do relatório de produtos.')
    }
    for (const nomeSuitable of nomesPdv) {
      await tx.stockVendaProdutoMap.upsert({
        where: { companyId_nomeSuitable: { companyId: input.companyId, nomeSuitable } },
        create: { companyId: input.companyId, nomeSuitable, alvoTipo: 'FICHA', fichaId: ficha.id, itemId: null, criadoPorId: input.userId ?? null },
        update: { alvoTipo: 'FICHA', fichaId: ficha.id, itemId: null },
      })
      vinculos++
    }

    return { fichaId: ficha.id, itemProduzidoId: produzido.id, vinculadoAoPdv: vinculos > 0 }
  })
}

/** Ficha ATIVA cujo produto tem o mesmo nome (normalizado). `null` = pode criar. */
export async function fichaAtivaComNome(
  companyId: string, nome: string, db: Db = defaultPrisma,
): Promise<{ fichaId: string; nome: string } | null> {
  const alvo = normalizarBusca(nome)
  if (!alvo) return null
  const fichas = await db.stockFicha.findMany({
    where: { companyId, ativo: true },
    select: { id: true, itemProduzidoId: true },
  })
  if (!fichas.length) return null
  const itens = await db.stockItem.findMany({
    where: { companyId, id: { in: fichas.map((f) => f.itemProduzidoId) } },
    select: { id: true, nome: true },
  })
  const porItem = new Map(itens.map((i) => [i.id, i.nome]))
  for (const f of fichas) {
    const n = porItem.get(f.itemProduzidoId)
    if (n && normalizarBusca(n) === alvo) return { fichaId: f.id, nome: n }
  }
  return null
}

/** Atualiza a ficha. Corpo (componentes/lote/preparo) mudou → versão NOVA. Head → in place. */
export async function atualizarFicha(companyId: string, fichaId: string, input: Partial<FichaBodyInput> & { setorId?: string | null; valorVenda?: number | null; nomeProduzido?: string; ativo?: boolean; userId?: string }, db: PrismaClient = defaultPrisma): Promise<{ versao: number }> {
  const ficha = await db.stockFicha.findFirst({ where: { id: fichaId, companyId } })
  if (!ficha) throw new FichaError('Ficha não encontrada.')

  const mudouCorpo = input.componentes !== undefined || input.loteBase !== undefined || input.unidadeLoteBase !== undefined || input.modoPreparo !== undefined || input.tempoPreparoMin !== undefined || input.validadeDias !== undefined

  return db.$transaction(async (tx) => {
    // head (não versiona)
    const headData: Prisma.StockFichaUpdateInput = {}
    if (input.setorId !== undefined) headData.setorId = input.setorId
    if (input.valorVenda !== undefined) headData.valorVenda = input.valorVenda
    if (input.ativo !== undefined) headData.ativo = input.ativo
    if (input.nomeProduzido !== undefined) await tx.stockItem.update({ where: { id: ficha.itemProduzidoId }, data: { nome: input.nomeProduzido.trim() } })

    if (!mudouCorpo) {
      if (Object.keys(headData).length) await tx.stockFicha.update({ where: { id: fichaId }, data: headData })
      return { versao: ficha.versaoAtual }
    }

    // corpo mudou → carrega a versão atual pra herdar o que não veio no input
    const atual = await tx.stockFichaVersao.findFirst({ where: { companyId, fichaId, versao: ficha.versaoAtual } })
    const atualComps = atual ? await tx.stockFichaComponente.findMany({ where: { companyId, versaoId: atual.id }, orderBy: { posicao: 'asc' } }) : []
    const componentes = input.componentes ?? atualComps.map((c) => ({ itemId: c.itemId, qtdPlanejada: c.qtdPlanejada, unidade: c.unidade, posicao: c.posicao }))
    if (!componentes.length) throw new FichaError('A ficha precisa de ao menos um componente.')

    // ciclo (exclui a própria ficha do grafo; detectaCicloFicha reinsere a aresta nova)
    const grafo = await buildGrafoFichas(companyId, tx, fichaId)
    const ciclo = detectaCicloFicha(ficha.itemProduzidoId, componentes.map((c) => c.itemId), grafo)
    if (ciclo.ciclo) throw new FichaError('Esses componentes criariam um ciclo (a ficha usaria a si mesma).')

    const novaVersao = ficha.versaoAtual + 1
    const versao = await tx.stockFichaVersao.create({
      data: {
        companyId, fichaId, versao: novaVersao,
        loteBase: input.loteBase ?? atual?.loteBase ?? 1,
        unidadeLoteBase: input.unidadeLoteBase ?? atual?.unidadeLoteBase ?? 'UN',
        modoPreparo: input.modoPreparo !== undefined ? input.modoPreparo : atual?.modoPreparo ?? null,
        tempoPreparoMin: input.tempoPreparoMin !== undefined ? input.tempoPreparoMin : atual?.tempoPreparoMin ?? null,
        validadeDias: input.validadeDias !== undefined ? input.validadeDias : atual?.validadeDias ?? null,
        criadoPorId: input.userId ?? null,
      },
    })
    await tx.stockFichaComponente.createMany({ data: componentes.map((c, i) => ({ companyId, versaoId: versao.id, itemId: c.itemId, qtdPlanejada: c.qtdPlanejada, unidade: c.unidade, posicao: c.posicao ?? i })) })
    await tx.stockFicha.update({ where: { id: fichaId }, data: { ...headData, versaoAtual: novaVersao } })
    return { versao: novaVersao }
  })
}

// ---- leitura ----

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export interface FichaComponenteView { itemId: string; nome: string; unidade: string; qtdPlanejada: number; custoMedio: number | null; subtotal: number | null; unidadeControle: string }
export interface FichaView {
  id: string
  itemProduzidoId: string
  nomeProduzido: string
  unidadeProduzido: string
  tipoProduto: string
  setorId: string | null
  versaoAtual: number
  valorVenda: number | null
  ativo: boolean
  loteBase: number
  unidadeLoteBase: string
  modoPreparo: string | null
  tempoPreparoMin: number | null
  validadeDias: number | null
  componentes: FichaComponenteView[]
  custoLote: number | null
  custoPorUnidade: number | null
  custoADefinir: boolean
  rendimentoMedio: number | null // MEDIDO: média das últimas 5 conclusões desta ficha
  rendimentoLotes: number // quantas conclusões compõem a média (0 = nunca produziu)
  margem: number | null
}

// custoMedio DERIVADO dos movimentos (mesma fonte da Posição), NÃO o campo stockItem.custoMedio
// (que fica null — o confirm não popula). Item com ENTRADA_NF → custo real; sem nota → null.
async function custoMedioDosItens(companyId: string, itemIds: string[], db: Db): Promise<Map<string, { custoMedio: number | null; nome: string; unidade: string }>> {
  if (!itemIds.length) return new Map()
  const [its, derivado] = await Promise.all([
    db.stockItem.findMany({ where: { companyId, id: { in: itemIds } }, select: { id: true, nome: true, unidadeControle: true } }),
    custoMedioPorItem(db, companyId),
  ])
  return new Map(its.map((i) => [i.id, { custoMedio: derivado.get(i.id) ?? null, nome: i.nome, unidade: i.unidadeControle }]))
}

async function versaoView(companyId: string, ficha: { id: string; itemProduzidoId: string; tipoProduto: string; setorId: string | null; versaoAtual: number; valorVenda: number | null; ativo: boolean }, versao: number, db: Db): Promise<FichaView | null> {
  const v = await db.stockFichaVersao.findFirst({ where: { companyId, fichaId: ficha.id, versao } })
  if (!v) return null
  const comps = await db.stockFichaComponente.findMany({ where: { companyId, versaoId: v.id }, orderBy: { posicao: 'asc' } })
  const produzido = await db.stockItem.findFirst({ where: { companyId, id: ficha.itemProduzidoId }, select: { nome: true, unidadeControle: true } })
  const custoMap = await custoMedioDosItens(companyId, comps.map((c) => c.itemId), db)

  const componentes: FichaComponenteView[] = comps.map((c) => {
    const meta = custoMap.get(c.itemId)
    const custoMedio = meta?.custoMedio ?? null
    return { itemId: c.itemId, nome: meta?.nome ?? '(item removido)', unidade: c.unidade, qtdPlanejada: c.qtdPlanejada, custoMedio, subtotal: custoMedio != null ? round2(custoMedio * c.qtdPlanejada) : null, unidadeControle: meta?.unidade ?? '—' }
  })

  // ⭐ LIGADO EM 01/09 — aqui havia `const rendimentoMedio = null // 2.0: a apurar`, cravado
  // desde a Fase 2.0. A função que mede já existia (`rendimentoMedidoDaFicha`) e **nada a
  // chamava daqui**: era o "tem o dado e não usa" que fez o dono ver "a apurar" numa ficha
  // com produção concluída. ⚠️ O CUSTO usa a medida desde o 1º lote (decisão do dono):
  // *"uma medição real é melhor que 'a definir'"* — o piso de 2 lotes vale só pra PREVISÃO.
  const medido = await rendimentoMedidoDaFicha(companyId, ficha.id, db as PrismaClient)
  const rendimentoMedio = medido.media
  const custo = calcularCustoTeorico(componentes.map<ComponenteCusto>((c) => ({ custoMedio: c.custoMedio, qtdPlanejada: c.qtdPlanejada })), rendimentoMedio)
  return {
    id: ficha.id, itemProduzidoId: ficha.itemProduzidoId, nomeProduzido: produzido?.nome ?? '(item removido)', unidadeProduzido: produzido?.unidadeControle ?? '—',
    tipoProduto: ficha.tipoProduto, setorId: ficha.setorId, versaoAtual: ficha.versaoAtual, valorVenda: ficha.valorVenda, ativo: ficha.ativo,
    loteBase: v.loteBase, unidadeLoteBase: v.unidadeLoteBase, modoPreparo: v.modoPreparo, tempoPreparoMin: v.tempoPreparoMin, validadeDias: v.validadeDias,
    componentes, custoLote: custo.custoLote, custoPorUnidade: custo.custoPorUnidade, custoADefinir: custo.custoADefinir, rendimentoMedio, rendimentoLotes: medido.lotes,
    margem: ficha.tipoProduto === 'PRODUTO_FINAL' ? calcularMargem(ficha.valorVenda, custo.custoPorUnidade) : null,
  }
}

export async function getFicha(companyId: string, fichaId: string, db: Db = defaultPrisma): Promise<{ ficha: FichaView; versoes: { versao: number; criadoEm: string }[] } | null> {
  const ficha = await db.stockFicha.findFirst({ where: { id: fichaId, companyId } })
  if (!ficha) return null
  const view = await versaoView(companyId, ficha, ficha.versaoAtual, db)
  if (!view) return null
  const versoes = await db.stockFichaVersao.findMany({ where: { companyId, fichaId }, orderBy: { versao: 'desc' }, select: { versao: true, criadoEm: true } })
  return { ficha: view, versoes: versoes.map((v) => ({ versao: v.versao, criadoEm: v.criadoEm.toISOString() })) }
}

export async function listFichas(companyId: string, db: Db = defaultPrisma): Promise<FichaView[]> {
  const fichas = await db.stockFicha.findMany({ where: { companyId }, orderBy: { criadoEm: 'desc' } })
  const out: FichaView[] = []
  for (const f of fichas) {
    const v = await versaoView(companyId, f, f.versaoAtual, db)
    if (v) out.push(v)
  }
  return out
}
