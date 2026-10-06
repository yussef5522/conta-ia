/**
 * ⭐⭐⭐ A LEITURA DA TELA DE CUSTOS FIXOS (06/10/2026) — "a casa num olhar".
 *
 * ⛔⛔ **O REALIZADO VEM SÓ DAS TRANSAÇÕES, pela PORTA EXISTENTE.** O `whereFluxoCaixa` é o
 * dono de *"o que conta como dinheiro que saiu"* — transferência entre contas próprias fora,
 * conta a pagar em aberto não é caixa, conciliada não conta 2×, compra no cartão fora e
 * pagamento de fatura dentro. **Nenhum número digitado alimenta o realizado**, e isso é guard,
 * não promessa: a única coisa que o dono digita nesta tela é o PLANEJADO.
 *
 * ⚠️ **Σ(realizado por categoria) é SUBCONJUNTO do SAIU do Fluxo de Caixa, por construção** —
 * medido em prod nos 4 meses: `Σ(por categoria) + sem categoria == SAIU` ao centavo. Se um dia
 * divergir, divergiu lá, não aqui: a régua é a mesma função.
 *
 * ⚠️⚠️ **LACUNA HONESTA, MEDIDA E DECLARADA: custo fixo pago NO CARTÃO não aparece no
 * realizado.** O `whereFluxoCaixa` exclui a COMPRA no cartão (competência, não caixa) e inclui
 * o PAGAMENTO da fatura — e o pagamento não carrega a categoria "internet". Medido na Caçula:
 * 79 compras de cartão em agosto, 48 em setembro, **todas sem conta bancária** (a compra nasce
 * com `bankAccountId` null). A tela DIZ isso no rodapé; esconder faria a linha do fixo parecer
 * "nada lançado" num mês em que o dono pagou.
 */
import { prisma } from '@/lib/db'
import type { Prisma, PrismaClient } from '@prisma/client'
import { whereFluxoCaixa } from '@/lib/fluxo-caixa/motor'
import { janelaDoMes, mesCorrente, mesVizinho } from '@/lib/periodo/mes-corrente'
import { situacaoDaLinha, type SeloDaSituacao, type ContaEmAbertoDaLinha } from './situacao'
import { medirMargem, pontoDeEquilibrio, type MargemMedida, type PontoDeEquilibrio } from './margem'

type Db = PrismaClient | Prisma.TransactionClient

/** ⭐ o nome de uma categoria como a tela mostra — a base da linha E do seletor */
export interface CategoriaNomeada {
  id: string
  nome: string
  dreGroup: string | null
  /**
   * ⚠️ só quando o NOME REPETE. Medido em prod: *"DAS Simples Nacional"* existe 2× (DEDUCOES e
   * IMPOSTOS_SOBRE_LUCRO) e *"Frete"* 2× (OUTRAS_DESPESAS e DESPESAS_COMERCIAIS) — duas linhas
   * com o mesmo rótulo na tela fariam o dono achar que é duplicata do sistema.
   */
  qualificador: string | null
}

export interface CategoriaDisponivel extends CategoriaNomeada {
  /**
   * ⭐ já está na lista de custos fixos? É o ✓ do seletor — e é ele que permite **desmarcar
   * de lá**. ⚠️ Só existe no SELETOR: na linha seria sempre `true`, e campo que nunca varia
   * é campo que alguém lê como se significasse algo.
   */
  jaFixa: boolean
}

export interface LinhaDoCustoFixo extends CategoriaNomeada {
  categoryId: string
  /** o que o dono declarou — `null` = ainda não declarou (≠ declarou zero) */
  planejado: number | null
  planejadoRastro: { quem: string | null; quando: string } | null
  /** o que o fluxo REALMENTE pagou no mês naquela categoria */
  realizado: number
  /**
   * ⭐ 06/10 — O NÚMERO QUE SEMEIA O PLANO: o realizado daquela categoria no **mês de
   * REFERÊNCIA** (por padrão o mês anterior ao visto).
   *
   * ⛔⛔ **UM número semeia, não dois.** O botão da linha e o "preencher todos" leem ESTE
   * campo — se a linha usasse o realizado do mês VISTO e o lote usasse outro, haveria duas
   * respostas pra *"com que número começa o plano?"*, e elas divergiriam no dia 1º (quando o
   * mês visto tem realizado quase zero).
   */
  realizadoReferencia: number
  lancamentos: number
  emAbertoValor: number
  emAbertoN: number
  situacao: SeloDaSituacao
  /** ⭐ a FONTE auditável: as transações do mês daquela categoria */
  href: string
}

export interface CartaoPorDiaAberto {
  valor: number | null
  dias: number
  /** ⚠️ o rótulo HONESTO: a empresa não tem calendário de funcionamento cadastrado */
  rotulo: string
}

export interface CustosFixosNaTela {
  mes: string
  ehMesCorrente: boolean
  /** ⭐ o mês cujo realizado semeia o plano — default: o anterior ao visto */
  mesReferencia: string
  /** ⚠️ a referência é um mês que ainda está correndo? (o realizado dela é PARCIAL) */
  referenciaEhParcial: boolean
  /** ⭐ cartão (a): Σ do PLANEJADO das linhas. `null` = nada declarado ainda */
  casaCustaMes: number | null
  /** quantas linhas marcadas ainda não têm plano, e quanto elas realizaram */
  semPlano: { n: number; realizado: number }
  porDiaAberto: CartaoPorDiaAberto
  margem: MargemMedida
  pontoDeEquilibrio: PontoDeEquilibrio
  linhas: LinhaDoCustoFixo[]
  totalPlanejado: number | null
  totalRealizado: number
  /** ⭐ "% pago" = realizado ÷ planejado. `null` sem plano — nunca 0% */
  pctPago: number | null
  /**
   * o seletor do gesto "marcar categoria como fixa" — **o universo INTEIRO de despesa**,
   * cada uma dizendo se já está na lista.
   *
   * ⭐ 06/10: antes só vinham as NÃO marcadas, e aí o seletor não tinha como oferecer o
   * desmarcar. Com `jaFixa` ele passa a ser a visão completa — e **continua uma porta só**:
   * marcar e desmarcar caem no MESMO `POST` (`MARCAR`/`TIRAR`).
   */
  disponiveis: CategoriaDisponivel[]
  /** ⚠️ a lacuna do cartão, medida e dita na tela */
  comprasNoCartao: { n: number } | null
}

/** ⭐ quantos dias o mês tem — o denominador do "por dia aberto" */
export function diasDoMes(mes: string): number {
  const [a, m] = mes.split('-').map(Number)
  return new Date(Date.UTC(a, m, 0)).getUTCDate()
}

/**
 * ⭐ o qualificador só nasce quando o nome repete — e ele é o `dreGroup`, que é a decisão
 * ESTRUTURAL que separa as duas (nome é texto livre; grupo do DRE é escolha).
 */
export function comQualificador<T extends { id: string; nome: string; dreGroup: string | null }>(
  cats: T[],
): (T & { qualificador: string | null })[] {
  const vezes = new Map<string, number>()
  for (const c of cats) {
    const k = c.nome.trim().toLowerCase()
    vezes.set(k, (vezes.get(k) ?? 0) + 1)
  }
  return cats.map((c) => ({
    ...c,
    qualificador: (vezes.get(c.nome.trim().toLowerCase()) ?? 0) > 1 ? (c.dreGroup ?? 'sem grupo') : null,
  }))
}

/** ⭐ o link pra FONTE: as transações daquele mês, daquela categoria, pela tela que já existe */
export function hrefDasTransacoes(companyId: string, categoryId: string, mes: string): string {
  const { de, ate } = janelaDoMes(mes)
  const fim = new Date(ate.getTime() - 86_400_000)
  const p = new URLSearchParams({
    empresaId: companyId,
    categoryId,
    inicio: de.toISOString().slice(0, 10),
    fim: fim.toISOString().slice(0, 10),
    tipo: 'DEBIT',
  })
  return `/transacoes?${p.toString()}`
}

/**
 * ⭐ O MÊS QUE SEMEIA O PLANO, por padrão: **o ANTERIOR ao visto**.
 *
 * ⛔ Por que não o próprio mês visto: no dia 6 de outubro o realizado de outubro é quase
 * zero — semear com ele poria um plano de R$ 900 onde a folha é R$ 46.000. O mês anterior é
 * o único **completo** que o dono tem na mão, e é com ele que ele raciocina (*"este mês deve
 * custar o que custou no mês passado"*).
 */
export function referenciaPadrao(mes: string): string {
  return mesVizinho(mes, -1)
}

export async function lerCustosFixos(
  companyId: string,
  mes: string,
  agora: Date = new Date(),
  db: Db = prisma,
  /** ⭐ o mês cujo realizado semeia o plano — `null` usa o anterior ao visto */
  mesReferencia?: string | null,
): Promise<CustosFixosNaTela> {
  const { de, ate } = janelaDoMes(mes)
  const ehMesCorrente = mes === mesCorrente(agora)
  const ref = mesReferencia ?? referenciaPadrao(mes)
  const janelaRef = janelaDoMes(ref)

  /**
   * ⚠️ A JANELA DA MARGEM TERMINA NO FIM DO MÊS OLHADO (ou agora, se for o corrente) — assim
   * navegar pra trás mostra a margem DAQUELE período, e não a de hoje aplicada ao passado.
   * Uma régua só, que serve os dois casos.
   */
  const fimDaJanelaDaMargem = ehMesCorrente ? agora : new Date(ate.getTime() - 1)

  const [marcadas, planos, realizadoCru, realizadoRefCru, catsExpense, margem] = await Promise.all([
    db.custoFixoCategoria.findMany({
      where: { companyId, removidoEm: null },
      select: { categoryId: true, category: { select: { id: true, name: true, dreGroup: true, isActive: true } } },
    }),
    db.custoFixoPlanejado.findMany({
      where: { companyId, mes },
      select: { categoryId: true, valor: true, definidoPorId: true, atualizadoEm: true },
    }),
    db.transaction.groupBy({
      by: ['categoryId'],
      where: { ...whereFluxoCaixa(companyId, { de, ate: new Date(ate.getTime() - 1) }), type: 'DEBIT' },
      _sum: { amount: true },
      _count: true,
    }),
    /**
     * ⭐ o realizado do mês de REFERÊNCIA — o número que semeia o plano.
     *
     * ⚠️ Mesma porta (`whereFluxoCaixa`), mesma forma: se esta consulta tivesse régua própria,
     * o botão "usar o realizado" semearia um número que a tela não mostra em mês nenhum.
     */
    ref === mes
      ? Promise.resolve(null)
      : db.transaction.groupBy({
          by: ['categoryId'],
          where: { ...whereFluxoCaixa(companyId, { de: janelaRef.de, ate: new Date(janelaRef.ate.getTime() - 1) }), type: 'DEBIT' },
          _sum: { amount: true },
          _count: true,
        }),
    db.category.findMany({
      where: { companyId, type: 'EXPENSE', isActive: true },
      select: { id: true, name: true, dreGroup: true },
      orderBy: { name: 'asc' },
    }),
    medirMargem(companyId, fimDaJanelaDaMargem, db as typeof prisma),
  ])

  const idsFixos = marcadas.map((m) => m.categoryId)

  /**
   * ⚠️ CONTA A PAGAR NASCE **SEM** `bankAccountId` (a ponte do estoque desde 24/08) — medido:
   * 115 PAYABLE em aberto na Caçula, **0** com conta bancária. Resolver a empresa por
   * `bankAccount.companyId` aqui devolveria ZERO e o selo *"vence dia X"* nunca apareceria.
   * O multi-tenant vem da CATEGORIA, que é da empresa.
   */
  const emAberto = idsFixos.length
    ? await db.transaction.findMany({
        where: {
          lifecycle: 'PAYABLE',
          status: 'PENDING',
          paymentDate: null,
          type: 'DEBIT',
          category: { companyId, id: { in: idsFixos } },
        },
        select: { categoryId: true, amount: true, dueDate: true, status: true, paymentDate: true },
      })
    : []

  const quemDefiniu = await nomesDeQuem(planos.map((p) => p.definidoPorId), db)

  const realPorCat = new Map(realizadoCru.filter((r) => r.categoryId).map((r) => [r.categoryId as string, r]))
  // ⚠️ referência == mês visto reusa a MESMA leitura (nada de 2ª consulta pro mesmo período)
  const refPorCat = new Map(
    (realizadoRefCru ?? realizadoCru).filter((r) => r.categoryId).map((r) => [r.categoryId as string, r]),
  )
  const planoPorCat = new Map(planos.map((p) => [p.categoryId, p]))
  const abertoPorCat = new Map<string, ContaEmAbertoDaLinha[]>()
  for (const c of emAberto) {
    if (!c.categoryId) continue
    abertoPorCat.set(c.categoryId, [...(abertoPorCat.get(c.categoryId) ?? []), c])
  }

  const marcadasAtivas = marcadas.filter((m) => m.category?.isActive !== false)
  const comNome = comQualificador(
    marcadasAtivas.map((m) => ({
      id: m.categoryId,
      nome: m.category?.name ?? '(categoria removida)',
      dreGroup: m.category?.dreGroup ?? null,
    })),
  )

  const linhas: LinhaDoCustoFixo[] = comNome.map((c) => {
    const r = realPorCat.get(c.id)
    const realizado = r?._sum.amount ?? 0
    const p = planoPorCat.get(c.id)
    const abertas = abertoPorCat.get(c.id) ?? []
    return {
      ...c,
      categoryId: c.id,
      planejado: p ? p.valor : null,
      planejadoRastro: p
        ? { quem: p.definidoPorId ? (quemDefiniu.get(p.definidoPorId) ?? null) : null, quando: p.atualizadoEm.toISOString() }
        : null,
      realizado,
      realizadoReferencia: refPorCat.get(c.id)?._sum.amount ?? 0,
      lancamentos: r?._count ?? 0,
      emAbertoValor: abertas.reduce((s, x) => s + x.amount, 0),
      emAbertoN: abertas.length,
      situacao: situacaoDaLinha({ realizado, planejado: p ? p.valor : null, emAberto: abertas }, agora),
      href: hrefDasTransacoes(companyId, c.id, mes),
    }
  })

  /**
   * ⭐⭐ ORDEM DO TRABALHO, não alfabética: atrasado primeiro, depois estouro do plano, depois
   * o que vence, e o resto pelo DINHEIRO. ⚠️ A linha que pede ação não pode ficar na 12ª
   * posição atrás de um colapso de "+N categorias".
   */
  const PESO: Record<SeloDaSituacao['estado'], number> = {
    ATRASADO: 0, ACIMA_DO_PLANO: 1, VENCE: 2, PAGO: 3, SEM_LANCAMENTO: 4,
  }
  linhas.sort((a, b) => {
    const d = PESO[a.situacao.estado] - PESO[b.situacao.estado]
    if (d !== 0) return d
    return Math.max(b.planejado ?? 0, b.realizado) - Math.max(a.planejado ?? 0, a.realizado)
  })

  const comPlano = linhas.filter((l) => l.planejado != null)
  /**
   * ⭐⭐ O CARTÃO (a) É A Σ DAS LINHAS, **por construção** — é o guard que o dono pediu. ⛔ E
   * ele NÃO cai no realizado quando falta plano: misturar as duas coisas faria o cartão dizer
   * "a casa custa X" sobre um número que o dono nunca declarou. Sem plano nenhum, ele diz
   * **a apurar** e a tela ensina o gesto.
   */
  const casaCustaMes = comPlano.length > 0 ? comPlano.reduce((s, l) => s + (l.planejado ?? 0), 0) : null
  const semPlanoLinhas = linhas.filter((l) => l.planejado == null)
  const totalRealizado = linhas.reduce((s, l) => s + l.realizado, 0)

  const dias = diasDoMes(mes)
  const porDiaAberto: CartaoPorDiaAberto = {
    valor: casaCustaMes == null ? null : casaCustaMes / dias,
    dias,
    rotulo: `${dias} dias no mês — a empresa não tem calendário de funcionamento cadastrado, então conto os dias corridos`,
  }

  const comprasNoCartao = await db.transaction.count({
    where: { businessCreditCardId: { not: null }, isCardPayment: false, date: { gte: de, lt: ate } },
  })

  return {
    mes,
    ehMesCorrente,
    mesReferencia: ref,
    /**
     * ⚠️ **A REFERÊNCIA PARCIAL É DITA, nunca escondida.** Semear o plano com o realizado de um
     * mês que ainda está correndo põe um número pela metade no campo — e o dono não tem como
     * saber disso olhando o valor. A tela avisa; ele decide.
     */
    referenciaEhParcial: ref === mesCorrente(agora),
    casaCustaMes,
    semPlano: { n: semPlanoLinhas.length, realizado: semPlanoLinhas.reduce((s, l) => s + l.realizado, 0) },
    porDiaAberto,
    margem,
    pontoDeEquilibrio: pontoDeEquilibrio(porDiaAberto.valor, margem),
    linhas,
    totalPlanejado: casaCustaMes,
    totalRealizado,
    /** ⚠️ sem plano NÃO é 0% pago — é desconhecido */
    pctPago: casaCustaMes != null && casaCustaMes > 0 ? totalRealizado / casaCustaMes : null,
    /**
     * ⭐ O UNIVERSO INTEIRO, com o ✓ de quem já está na lista — é o que permite DESMARCAR pelo
     * mesmo seletor. ⛔ E continua uma porta só: marcar e desmarcar caem no MESMO `POST`.
     */
    disponiveis: comQualificador(
      catsExpense.map((c) => ({ id: c.id, nome: c.name, dreGroup: c.dreGroup, jaFixa: idsFixos.includes(c.id) })),
    ),
    comprasNoCartao: comprasNoCartao > 0 ? { n: comprasNoCartao } : null,
  }
}

/** ⚠️ o rastro mostra NOME, não id — id no rastro é rastro que ninguém lê */
async function nomesDeQuem(ids: (string | null)[], db: Db): Promise<Map<string, string>> {
  const unicos = [...new Set(ids.filter((x): x is string => !!x))]
  if (unicos.length === 0) return new Map()
  const us = await db.user.findMany({ where: { id: { in: unicos } }, select: { id: true, name: true } })
  return new Map(us.map((u) => [u.id, u.name]))
}
