// ESTOQUE FASE 2 item 2.1 — ORDENS de produção + SEPARAÇÃO. A separação é PRÉ-PREENCHIDA
// da ficha (componentes × escala) e o dono ajusta o que REALMENTE tirou da câmara → gera
// SEPARACAO_SAIDA no ledger (insumo sai do estoque geral e entra no armazém virtual
// "em-produção"). Sobra volta com DEVOLUCAO_PRODUCAO. O armazém em-produção é DERIVADO dos
// movimentos (receiptId = id da ordem), nunca uma tabela de saldo à parte. Só stock_.

import type { PrismaClient, Prisma } from '@prisma/client'
import { ESTADOS_ABERTOS } from './data-da-ordem'
import { prisma as defaultPrisma } from '@/lib/db'
import { criarMovimento } from '../movement'
import { explodirReceita } from '../explodir-receita'
import { saldoItem, custoMedioPorItem, recomputeSaldoCache } from '../saldo'
import { materializarEtapasDaOrdem } from './etapas'
import { configDeRetalho } from './retalho'
import { encerrarEtapasAbertas } from './encerrar-etapas-abertas'
import { fichaEsperaRendimento } from './auto-conversao-de-lote'

type Db = PrismaClient | Prisma.TransactionClient

export class OrdemError extends Error {}

const round4 = (n: number) => Math.round((n + 1e-9) * 10000) / 10000
/**
 * ⭐⭐ 6 CASAS NA QUANTIDADE (29/09/2026) — o mesmo teto da digitação (`MAX_CASAS`).
 *
 * ⛔ **Aqui havia `round4` no planejado e `round2` no separado, e os dois cortavam dose
 * pequena ANTES de a tela poder escolher como mostrar.** Com a dose real do fermento
 * (0,0003 KG), `round4` a escala 1 devolvia **0,0003** — mas a 1 mg (0,000001) devolvia
 * **ZERO**, e `round2` no separado transformava 0,008 KG em 0,01. É a mesma lição de 01/09,
 * quando o `round2` do `porLote` fazia a porção de 0,135 virar 0,14: *"em 1 porção é nada;
 * em 370 porções é 1,85 kg de diferença"*.
 *
 * ⚠️ O arredondamento continua existindo pra matar lixo de ponto flutuante
 * (`0.30000000000000004`); o que muda é o degrau — 1 mg em vez de 100 mg.
 */
const round6 = (n: number) => Math.round((n + 1e-9) * 1_000_000) / 1_000_000
const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export const TIPO_SEPARACAO = 'SEPARACAO_SAIDA'
export const TIPO_DEVOLUCAO = 'DEVOLUCAO_PRODUCAO'
export const TIPO_CONSUMO = 'PRODUCAO_CONSUMO'
export const TIPO_GERACAO = 'PRODUCAO_GERACAO'

// ---- criar ----

export interface CriarOrdemInput {
  companyId: string
  fichaId: string
  /**
   * ⚠️⚠️ OPCIONAL DESDE 11/10 — **a criação deixou de perguntar quantidade** (decisão do dono:
   * *"pergunta UMA vez, no lugar certo = DEPOIS de criar, onde dá pra ver a prateleira"*).
   *
   * Ausente → a coluna fica no **default 1** do banco (ela é NOT NULL com CHECK > 0, então
   * "sem quantidade" não é representável ali) e a ordem nasce **AGUARDANDO** o pedido: quem
   * grava a quantidade de verdade é o `confirmarPedido`, o writer único.
   *
   * ⭐ Quem ainda manda é a **SUGESTÃO de mín/máx** (`origem: 'SUGESTAO'`), e ali é um **PLANO**,
   * não um pedido declarado — a tela da pergunta mostra como *"o mín/máx sugeriu ~N"*, nunca
   * pré-preenchido (*"número sugerido vira número confirmado sem ninguém contar"*).
   */
  escalaReceitas?: number
  dataProducao: Date
  setorId?: string | null
  colaboradorId?: string | null
  origem?: 'MANUAL' | 'SUGESTAO'
  observacao?: string | null
  userId?: string
  /**
   * ⛔⛔⛔ `pedidoUnidades` E `retalhoKg` **SAÍRAM DAQUI EM 11/10** — e saíram do TIPO, não de um
   * `if`: chamar `criarOrdem` com um pedido deixou de **compilar** (REGRA 5 — disciplina virada
   * impossibilidade).
   *
   * **Por quê:** a quantidade era perguntada 2× (na criação e no campo *"Quero fazer"* da página
   * da ordem) e **o 2º campo não escrevia nada** — só estado local. Quem separava obedecia ao
   * número novo e quem IMPRIMIA (cabeçalho, home, lista, relatórios) seguia no da criação. *O 1º
   * número ficava assombrando a tela.*
   *
   * ⭐ Os dois agora vivem em `confirmarPedido` (`confirmar-pedido.ts`), que grava meta + escala
   * + retalho **na mesma transação** e deixa rastro de quem declarou.
   */
}

export async function criarOrdem(input: CriarOrdemInput, db: Db = defaultPrisma): Promise<{ ordemId: string }> {
  /**
   * ⚠️ Escala ausente é LEGÍTIMA (a criação não pergunta mais) e cai no 1 — mas escala **negativa
   * ou zero** continua sendo recusada: ali não é ausência, é um número errado, e o CHECK do banco
   * recusaria com uma mensagem que o dono não entende.
   */
  if (input.escalaReceitas != null && !(input.escalaReceitas > 0)) {
    throw new OrdemError('A escala tem que ser maior que zero.')
  }
  const ficha = await db.stockFicha.findFirst({ where: { id: input.fichaId, companyId: input.companyId }, select: { id: true, itemProduzidoId: true, versaoAtual: true, ativo: true } })
  if (!ficha) throw new OrdemError('Ficha não encontrada.')
  if (!ficha.ativo) throw new OrdemError('Essa ficha está inativa.')

  /**
   * ⛔⛔ A CONFERÊNCIA DO RETALHO MUDOU DE CASA EM 11/10 — ela vive em `confirmarPedido`, junto
   * da pergunta. ⚠️ **E a régua NÃO afrouxou:** quem recusa continua sendo o SERVIDOR (esconder
   * o campo é combinado — a rota pode ser chamada por script, cliente copiado ou tela em cache,
   * e aí um retalho afrouxaria o fiscal de outra receita em silêncio). O que mudou é ONDE a
   * pergunta é feita, não quem a valida.
   */
  const ordem = await db.stockProductionOrder.create({
    data: {
      companyId: input.companyId, fichaId: ficha.id, versaoFicha: ficha.versaoAtual, itemProduzidoId: ficha.itemProduzidoId,
      setorId: input.setorId ?? null, colaboradorId: input.colaboradorId ?? null, dataProducao: input.dataProducao,
      escalaReceitas: input.escalaReceitas ?? 1, origem: input.origem ?? 'MANUAL', observacao: input.observacao ?? null,
      estado: 'PLANEJADA', criadoPorId: input.userId ?? null,
    },
  })
  /**
   * ⛔⛔⛔ **A META E O RETALHO NÃO NASCEM MAIS AQUI** (11/10) — a ordem nasce PLANEJADA e **sem
   * pedido**, e o `pedidoDaOrdem` a devolve como `AGUARDANDO`.
   *
   * ⚠️ Era aqui que o `stock_ordem_meta` era gravado desde 04/10. Mantê-lo faria a criação
   * responder a quantidade **de novo**, e aí a pergunta da página seria a segunda — exatamente o
   * fantasma que o dono mandou matar. O writer único é o `confirmarPedido`.
   */
  // ⭐ as etapas nascem COM a ordem (snapshot do método da versão). Receita sem etapa
  // declarada vira UMA etapa "produção" — a régua mora em `resolverEtapas`, num lugar só.
  const versao = await db.stockFichaVersao.findFirst({
    where: { companyId: input.companyId, fichaId: ficha.id, versao: ficha.versaoAtual }, select: { id: true },
  })
  await materializarEtapasDaOrdem(input.companyId, ordem.id, versao?.id ?? null, db)
  return { ordemId: ordem.id }
}

// ---- separação pré-preenchida (explode a ficha × escala) ----

export interface SeparacaoLinha {
  itemId: string
  nome: string
  unidade: string
  unidadeControle: string
  porLote: number // ⭐ o que a FICHA pede por 1× a receita (0,135 KG) — é a régua que a
  //                  tela usa pra converter "quero fazer N" ↔ "preciso tirar X". Sem ele a
  //                  tela teria que dividir qtdPlanejada pela escala e reinventar a conta.
  qtdPlanejada: number // ficha × escala
  qtdSeparada: number // em-produção (Σ SEPARACAO − DEVOLUCAO − CONSUMO), 0 antes de separar
  /** ⭐ o que a panela comeu (Σ|PRODUCAO_CONSUMO|) — é o "real" da eficiência por componente */
  qtdConsumida: number
  saldoDisponivel: number // saldo atual no estoque geral
  custoMedio: number | null
  fichaIdComponente: string | null // se o componente é PRODUZIDO (tem ficha) → dá pra "produzir antes"
}

async function componentesDaVersao(companyId: string, fichaId: string, versao: number, db: Db) {
  const v = await db.stockFichaVersao.findFirst({ where: { companyId, fichaId, versao }, select: { id: true } })
  if (!v) return []
  return db.stockFichaComponente.findMany({ where: { companyId, versaoId: v.id }, orderBy: { posicao: 'asc' } })
}

/** em-produção por item DESTA ordem = Σ|SEPARACAO| − Σ DEVOLUCAO − Σ CONSUMO (receiptId=ordemId). */
export async function separadoPorItem(companyId: string, ordemId: string, db: Db): Promise<Map<string, number>> {
  const movs = await db.stockMovement.findMany({ where: { companyId, receiptId: ordemId, tipo: { in: [TIPO_SEPARACAO, TIPO_DEVOLUCAO, TIPO_CONSUMO] } }, select: { itemId: true, tipo: true, quantidade: true } })
  const m = new Map<string, number>()
  for (const mv of movs) {
    const abs = Math.abs(mv.quantidade)
    const delta = mv.tipo === TIPO_SEPARACAO ? abs : -abs // separou entra; devolveu/consumiu sai
    m.set(mv.itemId, round6((m.get(mv.itemId) ?? 0) + delta))
  }
  return m
}

/**
 * ⭐ CONSUMO REAL por item desta ordem (Σ|PRODUCAO_CONSUMO|).
 *
 * ⚠️ **NÃO é o `separadoPorItem`**, e confundir os dois foi o que me fez quase desenhar a
 * eficiência com o número errado: aquele é **em-produção** (SEP − DEV − CON) e numa ordem
 * CONCLUÍDA ele é ~ZERO por construção (é o que o P4 vigia). O que a eficiência precisa é o
 * que a panela comeu.
 */
export async function consumidoPorItem(companyId: string, ordemId: string, db: Db): Promise<Map<string, number>> {
  // ⭐ UMA consulta, duas respostas: a quantidade é a leitura magra do MESMO consumo
  const m = new Map<string, number>()
  for (const [itemId, c] of await consumoDaOrdem(companyId, ordemId, db)) m.set(itemId, c.qtd)
  return m
}

export interface ConsumoDoItem {
  /** Σ|quantidade| dos PRODUCAO_CONSUMO — na unidade de controle do item */
  qtd: number
  /**
   * ⭐⭐ O CUSTO **CONGELADO** no instante da conclusão — somado do `custoTotal` do próprio
   * ledger, nunca `qtd × custoMedio de hoje`.
   *
   * ⛔⛔ **MEDIDO EM PROD ANTES DE ESCREVER ISTO (04/10), nas 12 conclusões mais recentes:**
   * ```
   * Σ do LEDGER (custoTotal)      × custoLoteReal → maior |dif| R$ 0,01 · 0 fora de 2 centavos
   * Σ (qtd × custo médio de HOJE) × custoLoteReal → maior |dif| R$ 40,96 · 5 de 12 fora
   * ```
   * A razão é estrutural: `conclusao.ts` grava o `custoLoteReal` e os movimentos de consumo
   * **com o MESMO `custoMap`** daquele instante (linhas 195 e 235). O custo médio de hoje já
   * andou com as compras posteriores — e o bloco "o que saiu do estoque" passaria a somar
   * **R$ 40,96 diferente** do "Saiu do estoque" da linha-mãe, no MESMO lote.
   *
   * ⚠️ O centavo que sobra é aritmética e não some: `custoLoteReal` é `round2(Σ qtd×custo)` e
   * o ledger guarda `Σ round2(qtd×custo)`. Quem lê tolera 1 centavo por componente.
   */
  custoTotal: number
  /** o custo médio **daquele dia**, pra a tela mostrar a conta por extenso */
  custoUnitario: number | null
}

/**
 * ⭐⭐ O CONSUMO DA ORDEM com o custo CONGELADO — a fonte do bloco *"o que saiu do estoque"*.
 *
 * ⛔ É a MESMA leitura que `consumidoPorItem` faz (um `findMany`, um tipo de movimento): ela
 * delega pra cá. Uma 2ª consulta daria duas respostas pra *"o que a panela comeu?"* — e é
 * exatamente a doença que o `separadoPorItem` × `consumidoPorItem` já custou em 03/10.
 */
export async function consumoDaOrdem(companyId: string, ordemId: string, db: Db): Promise<Map<string, ConsumoDoItem>> {
  const movs = await db.stockMovement.findMany({
    where: { companyId, receiptId: ordemId, tipo: TIPO_CONSUMO },
    select: { itemId: true, quantidade: true, custoTotal: true, custoUnitario: true },
  })
  const m = new Map<string, ConsumoDoItem>()
  for (const mv of movs) {
    const a = m.get(mv.itemId) ?? { qtd: 0, custoTotal: 0, custoUnitario: null as number | null }
    m.set(mv.itemId, {
      qtd: round6(a.qtd + Math.abs(mv.quantidade)),
      custoTotal: round2(a.custoTotal + Math.abs(mv.custoTotal)),
      // ⚠️ produção PARCIAL: o mesmo item pode ter 2 movimentos com custos de dias diferentes.
      // O unitário mostrado é o do ÚLTIMO (informativo); o que FECHA é o `custoTotal`.
      custoUnitario: mv.custoUnitario !== 0 ? Math.abs(mv.custoUnitario) : a.custoUnitario,
    })
  }
  return m
}

/**
 * ⭐⭐ O CONSUMO DE **N ORDENS** NUMA CONSULTA (04/10/2026) — pro fiscal da lista da home.
 *
 * ⛔⛔ **EM LOTE, nunca uma por ordem.** A home mostra até 30 conclusões por vez; chamar
 * `consumoDaOrdem` numa `.map` seria **30 round-trips** numa tela que o dono abre todo dia —
 * é literalmente o defeito medido de 28/09 (`listFichas` com `for … await` custou **4.909 ms e
 * 1.786 consultas**). Uma consulta, agrupada em memória.
 *
 * ⚠️ Lê o MESMO filtro de `consumoDaOrdem` (`receiptId` + `TIPO_CONSUMO`) — se um dia a
 * identidade do consumo mudar, as duas mudam juntas ou o teste do fiscal quebra.
 */
export async function consumidoPorOrdem(
  companyId: string,
  ordemIds: string[],
  db: Db,
): Promise<Map<string, Map<string, number>>> {
  const out = new Map<string, Map<string, number>>()
  if (!ordemIds.length) return out
  const movs = await db.stockMovement.findMany({
    where: { companyId, receiptId: { in: ordemIds }, tipo: TIPO_CONSUMO },
    select: { receiptId: true, itemId: true, quantidade: true },
  })
  for (const mv of movs) {
    if (!mv.receiptId) continue
    const porItem = out.get(mv.receiptId) ?? new Map<string, number>()
    porItem.set(mv.itemId, round6((porItem.get(mv.itemId) ?? 0) + Math.abs(mv.quantidade)))
    out.set(mv.receiptId, porItem)
  }
  return out
}

export async function explodirSeparacao(companyId: string, ordemId: string, db: Db = defaultPrisma): Promise<{ ordem: OrdemView; linhas: SeparacaoLinha[] }> {
  const ordem = await getOrdem(companyId, ordemId, db)
  if (!ordem) throw new OrdemError('Ordem não encontrada.')
  const comps = await componentesDaVersao(companyId, ordem.fichaId, ordem.versaoFicha, db)
  const [custoMap, separado, consumido] = await Promise.all([custoMedioPorItem(db, companyId), separadoPorItem(companyId, ordemId, db), consumidoPorItem(companyId, ordemId, db)])
  const itemIds = comps.map((c) => c.itemId)
  const [its, fichasComp] = await Promise.all([
    itemIds.length ? db.stockItem.findMany({ where: { companyId, id: { in: itemIds } }, select: { id: true, nome: true, unidadeControle: true } }) : Promise.resolve([]),
    // componente que é PRODUZIDO (tem ficha ativa) → dá pra "produzir antes" quando faltar
    itemIds.length ? db.stockFicha.findMany({ where: { companyId, ativo: true, itemProduzidoId: { in: itemIds } }, select: { id: true, itemProduzidoId: true } }) : Promise.resolve([]),
  ])
  const meta = new Map(its.map((i) => [i.id, i]))
  const fichaDoItem = new Map(fichasComp.map((f) => [f.itemProduzidoId, f.id]))

  /**
   * ⭐⭐ A PORTA ÚNICA, no modo `SEPARACAO` (02/10/2026).
   *
   * ⛔ **`SEPARACAO` não desce nenhum componente, e isso é DECLARAÇÃO, não omissão:** o gesto
   * aqui é FÍSICO — alguém vai à câmara buscar o que a ficha lista. Descer mandaria a pessoa
   * pegar farinha quando a ficha pede massa pronta (e a massa já saiu na ordem dela — descer
   * seria baixa DUPLA). Antes isso era um `for` com `c.qtdPlanejada * escala` solto aqui.
   */
  const planejado = new Map(
    explodirReceita(
      { fichaId: ordem.fichaId },
      ordem.escalaReceitas,
      { componentesByFicha: new Map([[ordem.fichaId, comps]]), fichaByItemProduzido: new Map() },
      'SEPARACAO',
    ).consumos.map((c) => [c.itemId, c.qtd] as const),
  )

  const linhas: SeparacaoLinha[] = []
  for (const c of comps) {
    const saldo = await saldoItem(db, companyId, c.itemId)
    linhas.push({
      itemId: c.itemId,
      nome: meta.get(c.itemId)?.nome ?? '(item removido)',
      unidade: c.unidade,
      unidadeControle: meta.get(c.itemId)?.unidadeControle ?? '—',
      // ⛔ NÃO ARREDONDAR (01/09): aqui havia `round2`, e a porção de 0,135 KG virava
      // **0,14** na tela. O dono: *"em 1 porção é nada; em 370 porções é 1,85 kg de
      // diferença"*. Era perda de dado no SERVIDOR, antes de a tela poder escolher como
      // mostrar. Conferido que não contamina gravação: `confirmarSeparacao` grava o que a
      // pessoa digitou (`qtdSeparada`), nunca este planejado. Quem formata é a tela, com a
      // precisão da ficha.
      porLote: c.qtdPlanejada,
      /**
       * ⭐ A MULTIPLICAÇÃO SAIU DAQUI (02/10/2026) — quem faz dose × escala é a porta única
       * `explodirReceita`, no modo `SEPARACAO` (nada desce: a cozinha tira da câmara o que a
       * ficha lista). ⚠️ O `round6` continua porque **esta é a borda de exibição**: o número
       * vai pra tela e pro campo pré-preenchido, não pro ledger (quem grava é o
       * `confirmarSeparacao`, com o que a pessoa digitou).
       */
      qtdPlanejada: round6(planejado.get(c.itemId) ?? 0),
      qtdSeparada: round6(separado.get(c.itemId) ?? 0),
      qtdConsumida: round6(consumido.get(c.itemId) ?? 0),
      saldoDisponivel: saldo.saldo,
      custoMedio: custoMap.get(c.itemId) ?? null,
      fichaIdComponente: fichaDoItem.get(c.itemId) ?? null,
    })
  }
  return { ordem, linhas }
}

// ---- confirmar separação (gera SEPARACAO_SAIDA) ----

export interface SepararInput { itemId: string; qtdSeparada: number }

export async function confirmarSeparacao(companyId: string, ordemId: string, itens: SepararInput[], db: PrismaClient = defaultPrisma, userId?: string): Promise<{ movimentos: number }> {
  const ordem = await db.stockProductionOrder.findFirst({ where: { id: ordemId, companyId } })
  if (!ordem) throw new OrdemError('Ordem não encontrada.')
  if (ordem.estado !== 'PLANEJADA') throw new OrdemError('Essa ordem já foi separada (ou está em outro estado).')
  const positivos = itens.filter((i) => i.qtdSeparada > 0)
  if (!positivos.length) throw new OrdemError('Separe ao menos um item (quantidade maior que zero).')

  const custoMap = await custoMedioPorItem(db, companyId)
  await db.$transaction(async (tx) => {
    for (const it of positivos) {
      const custo = custoMap.get(it.itemId) ?? 0
      // SEPARACAO_SAIDA: sai do estoque geral (quantidade NEGATIVA)
      await criarMovimento(tx, { companyId, itemId: it.itemId, tipo: TIPO_SEPARACAO, quantidade: -it.qtdSeparada, custoUnitario: custo, custoTotal: round2(-it.qtdSeparada * custo), receiptId: ordemId, origem: 'MANUAL', criadoPorId: userId ?? null })
    }
    await tx.stockProductionOrder.update({ where: { id: ordemId }, data: { estado: 'SEPARADA' } })
  })
  await recomputeSaldoCache(db, companyId) // o cache segue os movimentos (juiz E1)
  return { movimentos: positivos.length }
}

export async function iniciarProducao(companyId: string, ordemId: string, db: Db = defaultPrisma): Promise<void> {
  const ordem = await db.stockProductionOrder.findFirst({ where: { id: ordemId, companyId }, select: { estado: true } })
  if (!ordem) throw new OrdemError('Ordem não encontrada.')
  if (ordem.estado !== 'SEPARADA') throw new OrdemError('Só entra em produção depois de separar.')
  await db.stockProductionOrder.update({ where: { id: ordemId }, data: { estado: 'EM_PRODUCAO' } })
}

/** Devolve sobra pro estoque geral (DEVOLUCAO_PRODUCAO). */
export async function devolverInsumo(companyId: string, ordemId: string, itemId: string, qtd: number, db: PrismaClient = defaultPrisma, userId?: string): Promise<void> {
  if (!(qtd > 0)) throw new OrdemError('Quantidade a devolver tem que ser maior que zero.')
  const ordem = await db.stockProductionOrder.findFirst({ where: { id: ordemId, companyId }, select: { estado: true } })
  if (!ordem) throw new OrdemError('Ordem não encontrada.')
  if (ordem.estado !== 'SEPARADA' && ordem.estado !== 'EM_PRODUCAO') throw new OrdemError('Só dá pra devolver de uma ordem separada ou em produção.')
  const separado = await separadoPorItem(companyId, ordemId, db)
  const emProd = separado.get(itemId) ?? 0
  if (qtd > emProd + 0.001) throw new OrdemError(`Não dá pra devolver ${qtd} — só ${round2(emProd)} desse item está em produção.`)
  const custo = (await custoMedioPorItem(db, companyId)).get(itemId) ?? 0
  await criarMovimento(db, { companyId, itemId, tipo: TIPO_DEVOLUCAO, quantidade: qtd, custoUnitario: custo, custoTotal: round2(qtd * custo), receiptId: ordemId, origem: 'MANUAL', criadoPorId: userId ?? null })
  await recomputeSaldoCache(db, companyId)
}

/** Cancela: devolve TUDO que está em produção pro estoque geral e marca CANCELADA. */
export async function cancelarOrdem(companyId: string, ordemId: string, db: PrismaClient = defaultPrisma, userId?: string): Promise<void> {
  const ordem = await db.stockProductionOrder.findFirst({ where: { id: ordemId, companyId }, select: { estado: true } })
  if (!ordem) throw new OrdemError('Ordem não encontrada.')
  if (ordem.estado === 'CONCLUIDA' || ordem.estado === 'CANCELADA') throw new OrdemError('Essa ordem já foi encerrada.')
  const separado = await separadoPorItem(companyId, ordemId, db)
  const custoMap = await custoMedioPorItem(db, companyId)
  await db.$transaction(async (tx) => {
    for (const [itemId, emProd] of separado) {
      if (emProd > 0.001) {
        const custo = custoMap.get(itemId) ?? 0
        await criarMovimento(tx, { companyId, itemId, tipo: TIPO_DEVOLUCAO, quantidade: round2(emProd), custoUnitario: custo, custoTotal: round2(emProd * custo), receiptId: ordemId, origem: 'MANUAL', criadoPorId: userId ?? null })
      }
    }
    // ⛔ cancelar também LEVA a etapa aberta junto, e pelo mesmo motivo: depois de cancelada
    // não existe gesto que a resolva.
    await encerrarEtapasAbertas({ companyId, ordemId, motivo: 'ORDEM_CANCELADA', userId }, tx)
    await tx.stockProductionOrder.update({ where: { id: ordemId }, data: { estado: 'CANCELADA' } })
  })
  await recomputeSaldoCache(db, companyId)
}

// ---- leitura ----

export interface OrdemView {
  id: string
  fichaId: string
  versaoFicha: number
  itemProduzidoId: string
  nomeProduzido: string
  unidadeProduzido: string
  setorId: string | null
  setorNome: string | null
  dataProducao: string
  escalaReceitas: number // ⚠️ fica no MOTOR e no banco; a TELA fala em unidades, nunca em "×"
  loteBase: number // ⭐ o rendimento TEÓRICO da ficha: quantas unidades por 1× a receita
  /**
   * ⭐ a UNIDADE do lote base (11/10) — ela é o que o `avisosDaEscala` compara com a unidade do
   * produto pra denunciar o `LOTE_NAO_COMPARAVEL` (*"o lote base não diz quantas UN saem de uma
   * receita, e é ele que divide o seu pedido"*).
   *
   * ⚠️ Veio pro payload porque o aviso **mudou de tela**: ele nasceu na criação (03/10) e, com a
   * quantidade passando a ser perguntada na página da ordem, ele foi junto — *o aviso vive onde
   * o número é digitado*. Sem este campo a tela não tinha como fazer a pergunta.
   */
  unidadeLoteBase: string
  estado: string
  origem: string
  observacao: string | null
  /**
   * ⭐⭐ A FICHA DESTA ORDEM ESPERA O RENDIMENTO? (11/10, item 2b)
   *
   * **Ordem do dono:** *"se alguém criar ordem de receita ainda pendente, a página NÃO pergunta:
   * mostra «esta ficha ainda não diz quantas UN rendem de 1 receita — [completar a ficha →]»."*
   *
   * ⛔⛔ **A DECISÃO VEM DO SERVIDOR, nunca da tela.** Se a página derivasse isso comparando
   * `unidadeLoteBase` com `unidadeProduzido`, seria a **segunda régua** — e ela divergiria do
   * sininho e da fila no primeiro caso de borda (é a lição do B1 e dos 7 detectores de par).
   * ⚠️ E ela é `null` quando não há nada a esperar: ausência não é `false` disfarçado.
   */
  rendimentoPendente: { porQue: string } | null
}

export async function getOrdem(companyId: string, ordemId: string, db: Db = defaultPrisma): Promise<OrdemView | null> {
  const o = await db.stockProductionOrder.findFirst({ where: { id: ordemId, companyId } })
  if (!o) return null
  const [prod, setor, versao, pend] = await Promise.all([
    db.stockItem.findFirst({ where: { companyId, id: o.itemProduzidoId }, select: { nome: true, unidadeControle: true } }),
    o.setorId ? db.stockSetor.findFirst({ where: { companyId, id: o.setorId }, select: { nome: true } }) : Promise.resolve(null),
    // a versão TRAVADA na ordem — o teórico tem que ser o da época, não o da ficha de hoje
    db.stockFichaVersao.findFirst({ where: { companyId, fichaId: o.fichaId, versao: o.versaoFicha }, select: { loteBase: true, unidadeLoteBase: true } }),
    /**
     * ⚠️ A pergunta é sobre a ficha de HOJE (`versaoAtual`), não a versão travada: o que a
     * página precisa saber é se **o dono ainda deve um número** — e isso ele resolve na ficha
     * atual. Resolve POR ID (ver `fichaEsperaRendimento`), nunca varrendo a fila.
     */
    fichaEsperaRendimento(companyId, o.fichaId, db),
  ])
  return {
    id: o.id, fichaId: o.fichaId, versaoFicha: o.versaoFicha, itemProduzidoId: o.itemProduzidoId,
    nomeProduzido: prod?.nome ?? '(item removido)', unidadeProduzido: prod?.unidadeControle ?? '—',
    setorId: o.setorId, setorNome: setor?.nome ?? null, dataProducao: o.dataProducao.toISOString(),
    escalaReceitas: o.escalaReceitas, loteBase: versao?.loteBase ?? 1,
    /** ⚠️ sem a versão, cai na unidade do PRODUTO — e aí o aviso se cala em vez de acusar
     *  divergência inventada contra uma string vazia (*"não sei" nunca vira "está errado"*) */
    unidadeLoteBase: versao?.unidadeLoteBase ?? prod?.unidadeControle ?? '—',
    estado: o.estado, origem: o.origem, observacao: o.observacao,
    rendimentoPendente: pend.espera && pend.porQue ? { porQue: pend.porQue } : null,
  }
}

/**
 * ⭐⭐⭐ A RECEITA DE ORDENS **POR ID** — nome, unidade, escala e lote base, em LOTE (05/10/2026).
 *
 * ⛔⛔ **POR QUE ISTO EXISTE: a lista de CONCLUÍDAS não pode depender do teto das encerradas.**
 * O `listOrdens` corta as encerradas em **200** de propósito (elas são a massa e envelhecem) —
 * mas a lista de concluídas do PERÍODO monta o nome, o logo e o pedido a partir dela. Medido em
 * prod com o período de 30 dias: **379 conclusões e 207 ordens no payload → 200 linhas saíam com
 * nome "—", SEM logo, SEM pedido e SEM pílula.** Mais da metade da lista perdendo o visual v4 em
 * silêncio.
 *
 * ⭐ É a MESMA cura que a ordem ABERTA ganhou em 19/09 (*"trabalho pendente não é histórico"*) e
 * que a busca de item ganhou em 16/09 (o `take: 50` que escondia o fermento): **quem precisa de
 * uma linha específica resolve por ID**, não filtrando uma lista truncada.
 *
 * ⚠️ 3 consultas pra N ordens, nunca uma por ordem — a lição dos 4.909 ms de 28/09.
 */
export async function receitaDasOrdens(
  companyId: string,
  ordemIds: string[],
  db: Db = defaultPrisma,
): Promise<Record<string, { nome: string; unidade: string; escalaReceitas: number; loteBase: number; estado: string }>> {
  /**
   * ⭐ O `estado` VAI JUNTO (11/10) porque o `pedidoDaOrdem` passou a precisar dele pra separar
   * *"ainda não perguntei"* (`AGUARDANDO`) de *"nasceu antes do campo"* (`DERIVADO`).
   *
   * ⚠️ Ele sai do REGISTRO, nunca cravado como `'CONCLUIDA'` pelo chamador: a lista de
   * conclusões inclui **produção PARCIAL**, e nela a ordem segue `EM_PRODUCAO`. Cravar seria
   * uma afirmação da minha cabeça num lugar que já tem o dado.
   */
  const out: Record<string, { nome: string; unidade: string; escalaReceitas: number; loteBase: number; estado: string }> = {}
  const ids = [...new Set(ordemIds)]
  if (!ids.length) return out

  const ordens = await db.stockProductionOrder.findMany({
    where: { companyId, id: { in: ids } },
    select: { id: true, fichaId: true, versaoFicha: true, itemProduzidoId: true, escalaReceitas: true, estado: true },
  })
  if (!ordens.length) return out

  const [versoes, itens] = await Promise.all([
    db.stockFichaVersao.findMany({
      where: { companyId, OR: ordens.map((o) => ({ fichaId: o.fichaId, versao: o.versaoFicha })) },
      select: { fichaId: true, versao: true, loteBase: true },
    }),
    db.stockItem.findMany({
      where: { companyId, id: { in: [...new Set(ordens.map((o) => o.itemProduzidoId))] } },
      select: { id: true, nome: true, unidadeControle: true },
    }),
  ])
  const loteDe = new Map(versoes.map((v) => [`${v.fichaId}#${v.versao}`, v.loteBase]))
  const itemDe = new Map(itens.map((i) => [i.id, i]))

  for (const o of ordens) {
    const it = itemDe.get(o.itemProduzidoId)
    out[o.id] = {
      /** ⚠️ item removido NÃO vira string vazia: a linha diria o nome de ninguém */
      nome: it?.nome ?? '(item removido)',
      unidade: it?.unidadeControle ?? '',
      escalaReceitas: o.escalaReceitas,
      /** ⚠️ `1` como piso é o mesmo default do `ordemView` — versão sumida não zera o pedido */
      loteBase: loteDe.get(`${o.fichaId}#${o.versaoFicha}`) ?? 1,
      estado: o.estado,
    }
  }
  return out
}

export async function listOrdens(companyId: string, db: Db = defaultPrisma): Promise<OrdemView[]> {
  /**
   * ⛔⛔ A ORDEM ABERTA NUNCA DEPENDE DO TETO (19/09).
   *
   * Antes era um `findMany` só, `dataProducao desc` com `take: 200`. A ordem da calabresa
   * ralada nasceu com a data no **ano 202** (ver `data-da-ordem.ts`), foi pro fim da
   * ordenação — **posição 238 de 238** — e caiu fora das 200. Resultado medido: **1 ordem
   * aberta no banco, 0 visíveis em qualquer tela**, com R$ 42,18 de insumo preso nela.
   *
   * ⭐ Trabalho pendente não é histórico: ele é a razão da tela existir. O teto continua
   * valendo pras ENCERRADAS (que são a massa e envelhecem), e as abertas vêm inteiras —
   * a mesma cura do `take: 50` que escondia o fermento da busca (16/09).
   */
  const [naFila, encerradas] = await Promise.all([
    db.stockProductionOrder.findMany({
      where: { companyId, estado: { in: [...ESTADOS_ABERTOS] } },
      orderBy: [{ dataProducao: 'desc' }, { criadoEm: 'desc' }],
    }),
    db.stockProductionOrder.findMany({
      where: { companyId, estado: { notIn: [...ESTADOS_ABERTOS] } },
      orderBy: [{ dataProducao: 'desc' }, { criadoEm: 'desc' }], take: 200,
    }),
  ])
  const os = [...naFila, ...encerradas]
  const out: OrdemView[] = []
  for (const o of os) {
    const v = await getOrdem(companyId, o.id, db)
    if (v) out.push(v)
  }
  return out
}
