/**
 * ⭐⭐⭐ O PREVIEW DA NORMALIZAÇÃO DAS BASES — LÊ, NUNCA GRAVA (08/10/2026).
 *
 * Ordem do dono (07/10): *"SIM, normalizar — receita é lei, preview antes de gravar"*. Este
 * arquivo é o preview: ficha ATUAL × PROPOSTA × Δ custo por pizza × Δ na sobra × quais nomes
 * do PDV apontam pra cada base.
 *
 * ⛔⛔ ZERO CONTA NOVA — o custo da composição PROPOSTA sai da **porta única**
 * (`explodirReceita`, via `explodir`), com o `ctx` remendado pra conter a composição nova.
 * ⚠️ Isso não é preciosismo: se eu somasse `qtd × custoMedio` na mão aqui, o preview prometeria
 * um custo e a baixa de venda executaria outro na primeira borda (componente que é ficha,
 * intermediário que baixa o pack). O preview fala a MESMA língua de quem desconta o estoque.
 */
import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { montarCtx, explodir } from '@/lib/stock/vendas/baixa-venda'
import { custoMedioPorItem } from '@/lib/stock/saldo'
import {
  classificarBase,
  composicaoProposta,
  conferirBaseDeTamanho,
  ehBaseDeTamanho,
  type ClassificacaoDaBase,
  type ComponenteDaFicha,
  type ItensDaBase,
  type TamanhoCanonico,
} from './bases-canonicas'

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

type Ctx = Awaited<ReturnType<typeof montarCtx>>

/** ⭐ o custo de UMA unidade da ficha, pela porta única; `null` se alguma folha não tem custo */
function custoPelaPorta(fichaId: string, ctx: Ctx, custoDe: Map<string, number | null>): number | null {
  const acc = new Map<string, number>()
  explodir({ tipo: 'FICHA', fichaId }, 1, ctx, acc)
  if (acc.size === 0) return null
  let t = 0
  for (const [itemId, qtd] of acc) {
    const c = custoDe.get(itemId)
    if (c == null) return null
    t += c * qtd
  }
  return round2(t)
}

/**
 * ⭐ O custo da composição PROPOSTA — remenda o `ctx` e chama a MESMA porta.
 * ⚠️ O remendo é uma CÓPIA do Map: mexer no ctx original contaminaria o custo das outras
 * fichas lidas na mesma rodada, e o preview mentiria sobre as vizinhas.
 */
export function custoDaComposicao(
  fichaId: string,
  componentes: readonly ComponenteDaFicha[],
  ctx: Ctx,
  custoDe: Map<string, number | null>,
): number | null {
  const comps = new Map(ctx.componentesByFicha)
  comps.set(
    fichaId,
    componentes.map((c) => ({ itemId: c.itemId, qtdPlanejada: c.qtdPlanejada })),
  )
  return custoPelaPorta(fichaId, { ...ctx, componentesByFicha: comps }, custoDe)
}

export interface LinhaDoPreview {
  fichaId: string
  nome: string
  versaoAtual: number
  classificacao: ClassificacaoDaBase
  /** o que a ficha pede HOJE, legível */
  atual: { itemId: string; nome: string; qtd: number; custoUnit: number | null }[]
  /** o que ela passaria a pedir */
  proposta: { itemId: string; nome: string; qtd: number; custoUnit: number | null }[]
  custoAtual: number | null
  custoProposto: number | null
  /** `null` quando algum dos dois lados não tem custo fechado — nunca 0 fingindo diferença */
  deltaPorPizza: number | null
  /** o que falta HOJE pelo guard do dono (molho isento) */
  faltandoHoje: ('massa' | 'queijo' | 'caixa')[]
  /** os nomes do PDV que apontam pra esta ficha, com o que venderam na janela */
  pdv: { nome: string; unidades: number; faturamento: number; precoPraticado: number | null }[]
  unidades: number
  /** Δ no custo do período = o que sai da sobra da casa/liga */
  deltaNoPeriodo: number | null
  margemAntes: number | null
  margemDepois: number | null
  /** ⚠️ já mexida (a proposta é igual ao que ela já pede) — nada a fazer */
  jaNormalizada: boolean
}

export interface GrupoDeTamanho {
  tamanho: TamanhoCanonico | null
  linhas: LinhaDoPreview[]
  /** ⭐ pares com o MESMO preço praticado = candidato a duplicata de GRAFIA (mesmo produto) */
  duplicatasDeGrafia: { preco: number; nomes: string[] }[]
}

export interface PreviewDaNormalizacao {
  /** ⚠️ o que o leitor ACHOU por nome — declarado, porque tudo depende disso */
  itens: {
    massa: { id: string; nome: string } | null
    queijo: { id: string; nome: string } | null
    caixa: Partial<Record<TamanhoCanonico, { id: string; nome: string }>>
    molho: { id: string; nome: string } | null
  }
  /** ⛔ sem os 3 itens canônicos resolvidos o preview não existe — diz o que falta */
  bloqueio: string | null
  janela: { de: string; ate: string; dias: number }
  grupos: GrupoDeTamanho[]
  /** fichas com cara de base que a régua estrutural RECUSOU, com o motivo */
  recusadas: { fichaId: string; nome: string; porque: string }[]
  totais: {
    bases: number
    jaNormalizadas: number
    unidades: number
    deltaNoPeriodo: number | null
    /** quantas linhas o dono precisa confirmar antes de aplicar */
    pedemConfirmacao: number
  }
}

const ISO = (d: Date) => d.toISOString().slice(0, 10)

/** ⚠️ acha o item por fragmento de nome, sem caixa nem acento — e o preview DIZ o que achou */
function acharItem(itens: { id: string; nome: string }[], frag: string): { id: string; nome: string } | null {
  const f = frag
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
  const achados = itens.filter((i) =>
    i.nome
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .includes(f),
  )
  // ⛔ dois candidatos = "não sei qual é": devolve null e o preview bloqueia dizendo o motivo
  return achados.length === 1 ? { id: achados[0].id, nome: achados[0].nome } : null
}

export interface ItensResolvidos {
  achados: {
    massa: { id: string; nome: string } | null
    queijo: { id: string; nome: string } | null
    caixa: Partial<Record<TamanhoCanonico, { id: string; nome: string }>>
    molho: { id: string; nome: string } | null
  }
  /** `null` quando os 5 obrigatórios (massa + queijo + 3 caixas) foram resolvidos */
  bloqueio: string | null
  itens: ItensDaBase | null
}

/**
 * ⭐⭐ A RESOLUÇÃO DOS ITENS CANÔNICOS TEM UM DONO SÓ — o preview E o invariante do juiz
 * chamam ESTA. ⛔ Duas resoluções divergiriam no dia em que o dono renomear uma caixa: o
 * preview proporia a composição certa e o juiz acusaria a mesma ficha de estar incompleta,
 * ou o contrário. É a lição do B1 aplicada a "qual item é a caixa de 35".
 */
export function resolverItensDaBase(itensRaw: { id: string; nome: string }[]): ItensResolvidos {
  const massa = acharItem(itensRaw, 'metade de bolinha massa')
  const queijo = acharItem(itensRaw, 'queijo 135')
  const caixa: Partial<Record<TamanhoCanonico, { id: string; nome: string }>> = {
    PEQUENA: acharItem(itensRaw, 'CAIXA P/ PIZZA 25') ?? undefined,
    GRANDE: acharItem(itensRaw, 'CAIXA P/ PIZZA 35') ?? undefined,
    FAMILIA: acharItem(itensRaw, 'CAIXA P/ PIZZA 45') ?? undefined,
  }
  const molho = acharItem(itensRaw, 'MOLHO TOMATE PIZZA')

  const faltam: string[] = []
  if (!massa) faltam.push('a metade de bolinha de massa')
  if (!queijo) faltam.push('a porção de queijo 135g')
  for (const t of ['PEQUENA', 'GRANDE', 'FAMILIA'] as const) if (!caixa[t]) faltam.push(`a caixa de ${t}`)

  const achados = { massa, queijo, caixa, molho }
  if (faltam.length || !massa || !queijo) {
    return {
      achados,
      bloqueio: `não achei (ou achei mais de um candidato pra) ${faltam.join(' · ')} — sem isso a composição canônica não tem como ser montada`,
      itens: null,
    }
  }
  return {
    achados,
    bloqueio: null,
    itens: {
      massa: massa.id,
      queijo: queijo.id,
      caixa: { PEQUENA: caixa.PEQUENA!.id, GRANDE: caixa.GRANDE!.id, FAMILIA: caixa.FAMILIA!.id },
      molho: molho?.id ?? null,
    },
  }
}

export async function previewNormalizacao(
  companyId: string,
  opts: { dias?: number; agora?: Date } = {},
  db: PrismaClient = defaultPrisma,
): Promise<PreviewDaNormalizacao> {
  const dias = opts.dias ?? 30
  const agora = opts.agora ?? new Date()
  const desde = new Date(agora.getTime() - dias * 86_400_000)

  const [ctx, custoDe, fichas, mapProd, itensRaw] = await Promise.all([
    montarCtx(companyId, db),
    custoMedioPorItem(db, companyId),
    db.stockFicha.findMany({ where: { companyId, ativo: true } }),
    db.stockVendaProdutoMap.findMany({ where: { companyId } }),
    db.stockItem.findMany({ where: { companyId }, select: { id: true, nome: true } }),
  ])
  const nomeItem = new Map(itensRaw.map((i) => [i.id, i.nome]))

  // ─────────── os ITENS canônicos, pelo resolvedor ÚNICO (REGRA 4) ───────────
  const resolvidos = resolverItensDaBase(itensRaw)
  const { massa, queijo, caixa, molho } = resolvidos.achados
  const bloqueio = resolvidos.bloqueio

  const janela = { de: ISO(desde), ate: ISO(agora), dias }
  const vazio: PreviewDaNormalizacao = {
    itens: { massa, queijo, caixa, molho },
    bloqueio,
    janela,
    grupos: [],
    recusadas: [],
    totais: { bases: 0, jaNormalizadas: 0, unidades: 0, deltaNoPeriodo: 0, pedemConfirmacao: 0 },
  }
  if (bloqueio || !resolvidos.itens) return vazio
  const itens: ItensDaBase = resolvidos.itens

  // ─────────── vendas da janela, por nome do PDV ───────────
  const vendas = await db.stockVendaLinha.groupBy({
    by: ['nomeSuitable'],
    where: { companyId, data: { gte: desde } },
    _sum: { quantidade: true, valorTotal: true },
  })
  const vendaPorNome = new Map(
    vendas.map((v) => {
      const q = v._sum.quantidade ?? 0
      const f = v._sum.valorTotal ?? 0
      return [v.nomeSuitable, { unidades: q, faturamento: f, preco: q > 0 ? f / q : null }]
    }),
  )

  // ─────────── as CANDIDATAS: ficha do PDV cuja composição é só massa/queijo/caixa ───────────
  const fichaIdsDoPdv = new Set(mapProd.filter((m) => m.alvoTipo === 'FICHA' && m.fichaId).map((m) => m.fichaId!))
  const recusadas: PreviewDaNormalizacao['recusadas'] = []
  const linhas: LinhaDoPreview[] = []

  for (const f of fichas) {
    if (!fichaIdsDoPdv.has(f.id)) continue
    const nome = nomeItem.get(f.itemProduzidoId) ?? '(sem item)'
    const compsCtx = ctx.componentesByFicha.get(f.id) ?? []
    const atualComp: ComponenteDaFicha[] = compsCtx.map((c) => ({
      itemId: c.itemId,
      qtdPlanejada: c.qtdPlanejada,
      unidade: 'UN',
    }))

    if (!ehBaseDeTamanho(atualComp, itens)) {
      const forasteiros = atualComp
        .filter(
          (c) => c.itemId !== itens.massa && c.itemId !== itens.queijo && !Object.values(itens.caixa).includes(c.itemId),
        )
        .map((c) => nomeItem.get(c.itemId) ?? c.itemId)
      /**
       * ⭐⭐ O QUASE-BASE É SEMPRE REPORTADO, mesmo sem "PIZZA" no nome — é o caso do
       * **«Combo Caçula»**, que tem SÓ massa/queijo/caixa e foi recusado pelas travas extra
       * (duas caixas de tamanhos diferentes · 3 massas pra 2 queijos). ⛔ Calar sobre ele
       * esconderia justamente a linha que a 1ª versão desta régua quase destruiu.
       */
      const quaseBase = atualComp.length > 0 && forasteiros.length === 0
      if (quaseBase || /PIZZA|PRECINHO/i.test(nome)) {
        recusadas.push({
          fichaId: f.id,
          nome,
          porque: !atualComp.length
            ? 'a ficha não tem componente nenhum'
            : quaseBase
              ? 'usa só massa/queijo/caixa MAS não tem a forma de uma base: ou tem caixa de dois tamanhos, ou a massa não bate com o queijo — é combo, não base'
              : `não é base de tamanho: a composição tem ${forasteiros.join(', ')} — é produto pronto com sabor embutido`,
        })
      }
      continue
    }

    const cls = classificarBase({ nome, componentes: atualComp, itens })
    const propostaComp =
      cls.tamanho ? composicaoProposta(cls.tamanho, cls.multiplicador, itens) : []

    const custoAtual = custoPelaPorta(f.id, ctx, custoDe)
    const custoProposto = cls.tamanho ? custoDaComposicao(f.id, propostaComp, ctx, custoDe) : null
    const delta = custoAtual != null && custoProposto != null ? round2(custoProposto - custoAtual) : null

    const pdvNomes = mapProd.filter((m) => m.alvoTipo === 'FICHA' && m.fichaId === f.id).map((m) => m.nomeSuitable)
    const pdv = pdvNomes.map((n) => {
      const v = vendaPorNome.get(n)
      return { nome: n, unidades: v?.unidades ?? 0, faturamento: v?.faturamento ?? 0, precoPraticado: v?.preco ?? null }
    })
    const unidades = pdv.reduce((s, p) => s + p.unidades, 0)
    const faturamento = pdv.reduce((s, p) => s + p.faturamento, 0)
    const precoMedio = unidades > 0 ? faturamento / unidades : null

    const descreve = (cs: readonly ComponenteDaFicha[]) =>
      cs.map((c) => ({
        itemId: c.itemId,
        nome: nomeItem.get(c.itemId) ?? c.itemId,
        qtd: c.qtdPlanejada,
        custoUnit: custoDe.get(c.itemId) ?? null,
      }))

    const mesmaComposicao =
      propostaComp.length > 0 &&
      propostaComp.length === atualComp.length &&
      propostaComp.every((p) => atualComp.some((a) => a.itemId === p.itemId && a.qtdPlanejada === p.qtdPlanejada))

    linhas.push({
      fichaId: f.id,
      nome,
      versaoAtual: f.versaoAtual,
      classificacao: cls,
      atual: descreve(atualComp),
      proposta: descreve(propostaComp),
      custoAtual,
      custoProposto,
      deltaPorPizza: delta,
      faltandoHoje: conferirBaseDeTamanho(atualComp, itens).faltando,
      pdv,
      unidades,
      deltaNoPeriodo: delta != null ? round2(delta * unidades) : null,
      margemAntes: precoMedio != null && custoAtual != null ? round2(((precoMedio - custoAtual) / precoMedio) * 100) : null,
      margemDepois:
        precoMedio != null && custoProposto != null ? round2(((precoMedio - custoProposto) / precoMedio) * 100) : null,
      jaNormalizada: mesmaComposicao,
    })
  }

  // ─────────── agrupa por tamanho e procura DUPLICATA DE GRAFIA ───────────
  const porTamanho = new Map<string, LinhaDoPreview[]>()
  for (const l of linhas) {
    const k = l.classificacao.tamanho ?? 'SEM_TAMANHO'
    if (!porTamanho.has(k)) porTamanho.set(k, [])
    porTamanho.get(k)!.push(l)
  }
  const grupos: GrupoDeTamanho[] = []
  for (const [k, ls] of porTamanho) {
    /**
     * ⭐⭐ DUPLICATA DE GRAFIA É **MESMO PREÇO**, nunca "nome parecido".
     *
     * ⚠️ Medido em prod: `PIZZA GRANDE 35CM` (R$ 105,00) e `Pizza Grande (35cm)` (R$ 124,98)
     * têm nomes quase iguais e são **pontos de preço diferentes** (balcão × app). Fundir as
     * duas fichas faria a margem virar média ponderada e esconderia a de margem apertada —
     * que é justamente a que o dono precisa ver.
     */
    const porPreco = new Map<string, string[]>()
    for (const l of ls) {
      for (const p of l.pdv) {
        if (p.precoPraticado == null || p.unidades === 0) continue
        const kk = p.precoPraticado.toFixed(2)
        if (!porPreco.has(kk)) porPreco.set(kk, [])
        porPreco.get(kk)!.push(p.nome)
      }
    }
    const duplicatasDeGrafia = [...porPreco]
      .filter(([, ns]) => ns.length > 1)
      .map(([preco, nomes]) => ({ preco: Number(preco), nomes }))

    grupos.push({
      tamanho: k === 'SEM_TAMANHO' ? null : (k as TamanhoCanonico),
      linhas: ls.sort((a, b) => b.unidades - a.unidades),
      duplicatasDeGrafia,
    })
  }
  grupos.sort((a, b) => {
    const ordem = { PEQUENA: 0, GRANDE: 1, FAMILIA: 2 } as Record<string, number>
    return (ordem[a.tamanho ?? ''] ?? 9) - (ordem[b.tamanho ?? ''] ?? 9)
  })

  const deltas = linhas.map((l) => l.deltaNoPeriodo)
  return {
    itens: { massa, queijo, caixa, molho },
    bloqueio: null,
    janela,
    grupos,
    recusadas,
    totais: {
      bases: linhas.length,
      jaNormalizadas: linhas.filter((l) => l.jaNormalizada).length,
      unidades: linhas.reduce((s, l) => s + l.unidades, 0),
      // ⛔ um Δ desconhecido contamina o total: `null` em vez de somar o que dá e parecer completo
      deltaNoPeriodo: deltas.some((d) => d == null)
        ? null
        : round2(deltas.reduce<number>((s, d) => s + (d ?? 0), 0)),
      pedemConfirmacao: linhas.filter((l) => !l.jaNormalizada && l.classificacao.confianca === 'PERGUNTA').length,
    },
  }
}
