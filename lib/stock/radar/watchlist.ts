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

/**
 * ⭐ O VOCABULÁRIO DAS LISTAS — e ele mora AQUI, não num CHECK do banco.
 *
 * ⚠️⚠️ A lição de 21/09: eu tinha posto `CHECK (lista IN ('CAROS','PORCOES'))` como
 * "camada 1" e, no dia seguinte, a 3ª lista (REVENDA) esbarrou nele — **o módulo é
 * CREATE-only, então enum fechada no banco custa uma tabela nova a cada valor novo**.
 * ⭐ O banco protege o que não muda (não-vazio, único por item); o vocabulário, que é
 * decisão de produto, mora no TypeScript com guard de teste.
 */
export type Lista = 'CAROS' | 'REVENDA' | 'PORCOES'
/** ⭐ a ORDEM importa: é a ordem das seções na tela (caros · revenda · porções) */
export const LISTAS: Lista[] = ['CAROS', 'REVENDA', 'PORCOES']

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
/** ⭐ e quantas de revenda — bebida é item de giro, a lista curta é a que se olha */
export const REVENDA_NO_SEED = 10

export interface ListasDoRadar { caros: string[]; revenda: string[]; porcoes: string[]; semeadaAgora: boolean }

export async function listasDoRadar(
  companyId: string,
  db: PrismaClient = defaultPrisma,
  quemSemeou?: string,
): Promise<ListasDoRadar> {
  const linhas = await db.stockRadarItem.findMany({
    where: { companyId },
    select: { lista: true, itemId: true },
  })
  if (linhas.length > 0) return { ...agrupar(linhas), semeadaAgora: false }

  const semente = await montarSemente(companyId, db)
  if (semente.caros.length === 0 && semente.revenda.length === 0 && semente.porcoes.length === 0) {
    return { caros: [], revenda: [], porcoes: [], semeadaAgora: false }
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
    await db.stockRadarItem.createMany({
      data: LISTAS.flatMap((lista) =>
        semente[lista === 'CAROS' ? 'caros' : lista === 'REVENDA' ? 'revenda' : 'porcoes']
          .map((itemId) => ({ companyId, lista, itemId, criadoPorId: quemSemeou ?? null }))),
    })
  } catch {
    const denovo = await db.stockRadarItem.findMany({ where: { companyId }, select: { lista: true, itemId: true } })
    return { ...agrupar(denovo), semeadaAgora: false }
  }
  return { ...semente, semeadaAgora: true }
}

function agrupar(linhas: { lista: string; itemId: string }[]): { caros: string[]; revenda: string[]; porcoes: string[] } {
  const da = (lista: Lista) => linhas.filter((l) => l.lista === lista).map((l) => l.itemId)
  return { caros: da('CAROS'), revenda: da('REVENDA'), porcoes: da('PORCOES') }
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
): Promise<{ caros: string[]; revenda: string[]; porcoes: string[] }> {
  const [itens, saldos] = await Promise.all([
    db.stockItem.findMany({
      // ⭐ v1.3 — REVENDA entra: *"os caros fica só matéria-prima, como o nome diz"*
      where: { companyId, ativo: true, categoria: { in: ['MATERIA_PRIMA', 'INTERMEDIARIO', 'REVENDA'] } },
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

  /** ⭐ v1.3 — a revenda começa pelo que tem mais dinheiro parado na prateleira */
  const revenda = itens
    .filter((i) => i.categoria === 'REVENDA')
    .sort((a, b) => (valorPorItem.get(b.id) ?? 0) - (valorPorItem.get(a.id) ?? 0))
    .slice(0, REVENDA_NO_SEED)
    .map((i) => i.id)

  return { caros, revenda, porcoes }
}

/** ⭐ pôr é IDEMPOTENTE pelo ÚNICO do banco — o dono toca duas vezes e o resultado é o mesmo */
export async function porNaLista(
  input: { companyId: string; lista: Lista; itemId: string; quem?: string },
  db: PrismaClient = defaultPrisma,
): Promise<void> {
  await db.stockRadarItem.upsert({
    where: { companyId_lista_itemId: { companyId: input.companyId, lista: input.lista, itemId: input.itemId } },
    create: { companyId: input.companyId, lista: input.lista, itemId: input.itemId, criadoPorId: input.quem ?? null },
    update: {},
  })
}

export async function tirarDaLista(
  input: { companyId: string; lista: Lista; itemId: string },
  db: PrismaClient = defaultPrisma,
): Promise<void> {
  await db.stockRadarItem.deleteMany({
    where: { companyId: input.companyId, lista: input.lista, itemId: input.itemId },
  })
}
