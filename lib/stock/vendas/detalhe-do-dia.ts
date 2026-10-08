/**
 * ⭐⭐⭐ O DETALHE DO DIA — abas Produtos | Sabores (08/10/2026). LÊ, NUNCA GRAVA.
 *
 * ⛔⛔ A COLUNA "DESTINO NO ESTOQUE" **TRADUZ O QUE A BAIXA FEZ — NUNCA RECALCULA.** A ordem
 * do dono é literal: *"lendo do motor de baixa EXISTENTE (…) nunca recalcular, só traduzir o
 * que a baixa fez"*.
 *
 * ⚠️ E não é preciosismo: `montarPlanoDeLinhas` é o MESMO motor que o `gravarVenda` executa,
 * com a MESMA explosão (`explodirReceita`) e o MESMO mapa. Se eu perguntasse "este nome tem
 * destino?" por conta própria, a tela diria *"baixou ficha ✓"* sobre um nome que a baixa
 * pulou — e a divergência apareceria só no dia em que o saldo não fechasse. É a doença dos 7
 * detectores de par, agora na coluna de uma tabela.
 */
import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { montarPlanoDeLinhas } from './baixa-venda'
import { ehSaborDeVerdade } from './razao-sabor-pizza'

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export type DestinoNoEstoque =
  | 'BAIXOU_FICHA'
  | 'BAIXOU_BASE_E_SABORES'
  | 'BAIXOU_REVENDA'
  | 'SEM_DESTINO'
  /** ⚠️ decisão do dono: não controla estoque. Não é pendência. */
  | 'IGNORADO'

export const ROTULO_DO_DESTINO: Record<DestinoNoEstoque, string> = {
  BAIXOU_FICHA: 'baixou ficha ✓',
  BAIXOU_BASE_E_SABORES: 'baixou base + sabores ✓',
  BAIXOU_REVENDA: 'baixou revenda ✓',
  SEM_DESTINO: 'sem destino',
  IGNORADO: 'ignorado (sua decisão)',
}

export interface LinhaProduto {
  nome: string
  unidades: number
  valor: number
  destino: DestinoNoEstoque
  destinoRotulo: string
  /** o nome do destino quando há um (a ficha/item que baixou) */
  alvoNome: string | null
}

export interface LinhaSabor {
  nome: string
  vezes: number
  temFicha: boolean
  /** ⚠️ tamanho vazado (`GRANDE`) NUNCA oferece "criar ficha" — decisão do dono de 07/10 */
  ehSabor: boolean
  rotulo: string
}

export interface DetalheDoDia {
  dia: string
  produtos: LinhaProduto[]
  sabores: LinhaSabor[]
  totais: {
    unidades: number
    valor: number
    linhas: number
    semDestino: number
    ocorrencias: number
    saboresSemFicha: number
    /** ⭐ o guard da tela: Σ(linhas) == Σ do dia */
    bateComODia: boolean
  }
}

/**
 * ⚠️ `pizzaDaBase` pergunta se o produto baixa uma BASE de pizza — e nesse caso o sabor vem
 * do relatório de complementos, então o rótulo é *"base + sabores"*. ⛔ Detectar isso pelo
 * NOME erraria: quem decide é a composição (a régua de 08/10), e aqui basta a evidência de
 * que a ficha do produto é a base apontada de algum tamanho.
 */
async function basesApontadas(companyId: string, db: PrismaClient): Promise<Set<string>> {
  const bases = await db.stockBaseDoTamanho.findMany({ where: { companyId }, select: { fichaId: true } })
  return new Set(bases.map((b) => b.fichaId))
}

export async function lerDetalheDoDia(
  companyId: string,
  dia: string,
  db: PrismaClient = defaultPrisma,
): Promise<DetalheDoDia> {
  const dataDate = new Date(`${dia}T12:00:00`)
  const [linhas, comp, mapaProd, mapaComp, bases] = await Promise.all([
    db.stockVendaLinha.findMany({
      where: { companyId, data: dataDate },
      select: { nomeSuitable: true, quantidade: true, valorTotal: true },
    }),
    db.stockVendaComplementoLinha.findMany({
      where: { companyId, data: dataDate },
      select: { nomeSuitable: true, ocorrencias: true },
    }),
    db.stockVendaProdutoMap.findMany({ where: { companyId } }),
    db.stockVendaComplementoMap.findMany({ where: { companyId } }),
    basesApontadas(companyId, db),
  ])

  /**
   * ⭐⭐ O PLANO VEM DO MOTOR REAL. `incluir: null` = "todos os mapeados", que é exatamente o
   * que o import confirmado fez. ⚠️ Ele é DRY-RUN: `montarPlanoDeLinhas` não escreve nada.
   */
  const plano = await montarPlanoDeLinhas(
    companyId,
    dia,
    linhas.map((l) => ({ produto: l.nomeSuitable, quantidade: l.quantidade, valorTotal: l.valorTotal })),
    null,
    db,
  )
  const noPlano = new Map(plano.produtos.map((p) => [p.nome, p]))
  const pendentes = new Set(plano.pendentes.map((p) => p.nome))
  const ignorados = new Set(plano.ignorados.map((p) => p.nome))
  const mapaPorNome = new Map(mapaProd.map((m) => [m.nomeSuitable, m]))

  const produtos: LinhaProduto[] = linhas
    .map((l) => {
      const p = noPlano.get(l.nomeSuitable)
      const m = mapaPorNome.get(l.nomeSuitable)
      let destino: DestinoNoEstoque
      if (ignorados.has(l.nomeSuitable)) destino = 'IGNORADO'
      else if (pendentes.has(l.nomeSuitable) || !p) destino = 'SEM_DESTINO'
      else if (p.alvoTipo === 'REVENDA') destino = 'BAIXOU_REVENDA'
      else if (m?.fichaId && bases.has(m.fichaId)) destino = 'BAIXOU_BASE_E_SABORES'
      else destino = 'BAIXOU_FICHA'
      return {
        nome: l.nomeSuitable,
        unidades: l.quantidade,
        valor: round2(l.valorTotal),
        destino,
        destinoRotulo: ROTULO_DO_DESTINO[destino],
        alvoNome: p?.alvoNome ?? null,
      }
    })
    // ⚠️ ordenado por VALOR (a referência), não por nome: é onde o dinheiro está
    .sort((a, b) => b.valor - a.valor)

  const comFicha = new Set(mapaComp.filter((m) => m.fichaId).map((m) => m.nomeSuitable))
  const sabores: LinhaSabor[] = comp
    .map((c) => {
      const ehSab = ehSaborDeVerdade(c.nomeSuitable)
      const tem = comFicha.has(c.nomeSuitable)
      return {
        nome: c.nomeSuitable,
        vezes: c.ocorrencias,
        temFicha: tem,
        ehSabor: ehSab,
        /**
         * ⛔ TAMANHO VAZADO NÃO OFERECE "CRIAR FICHA". `GRANDE` (208 ocorrências) é tamanho,
         * não sabor — oferecer ali criaria uma ficha de sabor chamada "GRANDE" que baixaria
         * estoque errado em toda pizza grande. A frase diz o que ele É.
         */
        rotulo: !ehSab
          ? 'tamanho, não sabor — fora da fila'
          : tem
            ? 'com ficha · baixou ✓'
            : 'sem ficha',
      }
    })
    .sort((a, b) => b.vezes - a.vezes)

  const unidades = linhas.reduce((s, l) => s + l.quantidade, 0)
  const valor = round2(linhas.reduce((s, l) => s + l.valorTotal, 0))
  return {
    dia,
    produtos,
    sabores,
    totais: {
      unidades,
      valor,
      linhas: linhas.length,
      semDestino: produtos.filter((p) => p.destino === 'SEM_DESTINO').length,
      ocorrencias: comp.reduce((s, c) => s + c.ocorrencias, 0),
      // ⚠️ só conta "sem ficha" o que É sabor — tamanho vazado não é pendência
      saboresSemFicha: sabores.filter((s) => s.ehSabor && !s.temFicha).length,
      /**
       * ⭐ O GUARD DA TELA: a Σ das linhas desenhadas tem que ser a Σ do dia. ⛔ Ele é
       * TRIVIAL por construção aqui (as duas saem da mesma lista) — e é de propósito: o dia
       * em que alguém puser um filtro, um `take` ou um agrupamento no meio, ele fica
       * vermelho em vez de a tela mostrar um total que não fecha com as partes.
       */
      bateComODia:
        round2(produtos.reduce((s, p) => s + p.valor, 0)) === valor &&
        produtos.reduce((s, p) => s + p.unidades, 0) === unidades,
    },
  }
}
