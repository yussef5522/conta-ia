// ⭐⭐ AS DUAS LISTAS DO RADAR — o que o dono escolheu vigiar (20/09/2026).
//
// ⛔⛔ **LISTA É CONFIGURAÇÃO DO DONO, NÃO DADO DERIVADO.** A tentação era "mostrar sempre
// os N mais caros do momento" — e aí a lista dele **mudaria sozinha** quando o estoque
// mudasse, sem ninguém pedir. É a mesma família do *"categoria é decisão do dono — o
// sistema NUNCA reclassifica sozinho"* (17/08). Por isso é tabela.
//
// ⭐ **O SEED existe pra a tela não nascer vazia** (decisões do dono, 20/09): *"watchlist
// inicial: 5 itens — os DOIS queijos mussarela (peça E fatiado), coxão, calabresa, filé de
// frango"* e *"porções: começa com as 30 de maior valor em estoque; eu edito pela tela"*.
//
// ⚠️ **O SEED SÓ RODA NO PRIMEIRO ACESSO** (as duas listas vazias) — se ele rodasse a cada
// leitura, sobrescreveria a edição do dono, que é exatamente o que a régua acima proíbe.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { saldosDaEmpresa } from '@/lib/stock/saldo'

export type Lista = 'CAROS' | 'PORCOES'
export const LISTAS: Lista[] = ['CAROS', 'PORCOES']

/**
 * ⭐ Os nomes que o dono nomeou, pra semear a Caçula com o que ele pediu.
 *
 * ⚠️ **NÃO É `findFirst` POR NOME EM CAMINHO DE DINHEIRO** (a REGRA 8 continua de pé): isto
 * é SEED de preferência de tela, e ele resolve DENTRO da empresa, casando o que existir.
 * Empresa que não tenha estes nomes cai na régua geral logo abaixo.
 */
const SEMENTE_CAROS = [
  'QUEIJO MUSSARELA EM PECA',
  'QUEIJO MUSSARELA FATIADO',
  'Coxão Mole',
  'CALABRESA',
  'FILE DE PEITO DE FRANGO',
]

/** ⭐ quantas porções o dono pediu pra começar */
export const PORCOES_NO_SEED = 30

export interface ListasDoRadar { caros: string[]; porcoes: string[]; semeadaAgora: boolean }

export async function listasDoRadar(
  companyId: string,
  db: PrismaClient = defaultPrisma,
  quemSemeou?: string,
): Promise<ListasDoRadar> {
  const linhas = await db.stockRadarWatchlist.findMany({
    where: { companyId },
    select: { lista: true, itemId: true },
  })
  if (linhas.length > 0) return { ...agrupar(linhas), semeadaAgora: false }

  const semente = await montarSemente(companyId, db)
  if (semente.caros.length === 0 && semente.porcoes.length === 0) {
    return { caros: [], porcoes: [], semeadaAgora: false }
  }
  /**
   * ⚠️ **A CORRIDA DO PRIMEIRO ACESSO NÃO PODE DERRUBAR A TELA.** Duas abas abrindo junto
   * semeiam junto; quem perder bate no índice único do banco (que é quem manda) e, em vez
   * de erro na cara do dono, **relê** — o resultado é o mesmo nos dois casos.
   * ⛔ `skipDuplicates` não serve aqui: o Prisma não o oferece no SQLite do dev, e código
   * que só compila num dos dois bancos é a divergência dev×prod que já custou a busca
   * case-sensitive (28/08).
   */
  try {
    await db.stockRadarWatchlist.createMany({
      data: [
        ...semente.caros.map((itemId) => ({ companyId, lista: 'CAROS', itemId, criadoPorId: quemSemeou ?? null })),
        ...semente.porcoes.map((itemId) => ({ companyId, lista: 'PORCOES', itemId, criadoPorId: quemSemeou ?? null })),
      ],
    })
  } catch {
    const denovo = await db.stockRadarWatchlist.findMany({ where: { companyId }, select: { lista: true, itemId: true } })
    return { ...agrupar(denovo), semeadaAgora: false }
  }
  return { ...semente, semeadaAgora: true }
}

function agrupar(linhas: { lista: string; itemId: string }[]): { caros: string[]; porcoes: string[] } {
  return {
    caros: linhas.filter((l) => l.lista === 'CAROS').map((l) => l.itemId),
    porcoes: linhas.filter((l) => l.lista === 'PORCOES').map((l) => l.itemId),
  }
}

/**
 * ⭐⭐ A SEMENTE — e ela tem DUAS camadas de propósito.
 *
 * ⚠️ A 1ª (os nomes) serve a Caçula, que é quem pediu a tela. A 2ª (**os mais caros por
 * custo médio**) serve qualquer cliente novo: sem ela, empresa que não tem "Coxão Mole"
 * abriria o Radar com a lista vazia — *tela nova que nasce vazia é tela que ninguém volta
 * a abrir*.
 */
export async function montarSemente(
  companyId: string,
  db: PrismaClient = defaultPrisma,
): Promise<{ caros: string[]; porcoes: string[] }> {
  const [itens, saldos] = await Promise.all([
    db.stockItem.findMany({
      where: { companyId, ativo: true, categoria: { in: ['MATERIA_PRIMA', 'INTERMEDIARIO'] } },
      select: { id: true, nome: true, categoria: true },
    }),
    saldosDaEmpresa(db, companyId),
  ])
  const valorPorItem = new Map(saldos.map((s) => [s.itemId, s.valor]))
  const custoPorItem = new Map(saldos.map((s) => [s.itemId, s.custoMedio ?? 0]))

  const materia = itens.filter((i) => i.categoria === 'MATERIA_PRIMA')
  const nomeados = materia.filter((i) =>
    SEMENTE_CAROS.some((s) => i.nome.toLowerCase().includes(s.toLowerCase())))

  const caros = (nomeados.length > 0 ? nomeados : [...materia]
    .sort((a, b) => (custoPorItem.get(b.id) ?? 0) - (custoPorItem.get(a.id) ?? 0))
    .slice(0, 5)).map((i) => i.id)

  const porcoes = itens
    .filter((i) => i.categoria === 'INTERMEDIARIO')
    .sort((a, b) => (valorPorItem.get(b.id) ?? 0) - (valorPorItem.get(a.id) ?? 0))
    .slice(0, PORCOES_NO_SEED)
    .map((i) => i.id)

  return { caros, porcoes }
}

/** ⭐ pôr é IDEMPOTENTE pelo ÚNICO do banco — o dono toca duas vezes e o resultado é o mesmo */
export async function porNaLista(
  input: { companyId: string; lista: Lista; itemId: string; quem?: string },
  db: PrismaClient = defaultPrisma,
): Promise<void> {
  await db.stockRadarWatchlist.upsert({
    where: { companyId_lista_itemId: { companyId: input.companyId, lista: input.lista, itemId: input.itemId } },
    create: { companyId: input.companyId, lista: input.lista, itemId: input.itemId, criadoPorId: input.quem ?? null },
    update: {},
  })
}

export async function tirarDaLista(
  input: { companyId: string; lista: Lista; itemId: string },
  db: PrismaClient = defaultPrisma,
): Promise<void> {
  await db.stockRadarWatchlist.deleteMany({
    where: { companyId: input.companyId, lista: input.lista, itemId: input.itemId },
  })
}
