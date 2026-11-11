// SUITAPI — OS COMPLEMENTOS (sabores, bordas, adicionais) pela API (11/11/2026).
//
// ⭐ A RÉGUA (raio-X de 11/11, 100% em 07, 08 e 09/11 — nomes, ocorrências e R$ ao centavo):
//    pedido ≠ abandoned e não apagado · item não cancelado · TODA opção conta (sem filtro de
//    grupo; meio-a-meio = 1 por sabor) · ocorrências = qtd da opção × qtd do item-pai ·
//    valor = unit_price da opção × qtd do item-pai · chave = a grafia do XLS (espaço
//    colapsado, caixa e acento intactos) · janela 06h→06h no relógio da API.
//    ⛔ O `unit_price` da opção JÁ vem × qtd da opção; o `price` conta a qtd DUAS vezes
//    (medido: BATATA q=2 → unit_price 19,80, price 39,60; o XLS soma 19,80).
// ⭐ É um PRODUTOR de linhas do funil único (confirmarLinhasDeComplemento): o mesmo importId
//    (`comp-<empresa>-<dia>`), a mesma data e o mesmo formato que o XLS produziria.
// ⭐ A marca "o dia veio da Suit" é o StockVendaArquivo COMPLEMENTOS com nome "SuitAPI · …"
//    (único por empresa+dia+relatório) — sem coluna nova, sem migration.

import type { PrismaClient } from '@prisma/client'
import { centavos } from './regua-sombra'
import { grafiaDoXls, exigirDiaFechado, exigirFusoDaCasa } from './materializar'
import type { PedidoCru } from './cliente-leitura'
import { confirmarLinhasDeComplemento, ehArquivoDaApi, type LinhaDeComplemento } from '../stock/vendas/import-complementos'
import { importIdDe } from '../stock/vendas/identidade-import-complemento'

import { CORTE_COMPLEMENTOS } from './cortes'
export { CORTE_COMPLEMENTOS }
export const nomeArquivoComplementosApi = (dia: string) => `SuitAPI · complementos de ${dia}`

export type PedidoParaComplemento = {
  status: string
  sumido: boolean
  itens: { quantidade: number; cancelado: boolean; opcoes: { nome: string; quantidade: number; unitarioCent: number }[] }[]
}

/** ⭐ A RÉGUA (pura). Devolve as linhas do XLS de complementos, ordenadas pela Descrição. */
export function linhasDeComplementoDaRegua(pedidos: readonly PedidoParaComplemento[]): { linhas: LinhaDeComplemento[]; ocorrencias: number; totalCent: number } {
  const porNome = new Map<string, { occ: number; cent: number }>()
  for (const p of pedidos) {
    if (p.sumido || p.status === 'abandoned') continue
    for (const it of p.itens) {
      if (it.cancelado) continue
      for (const o of it.opcoes) {
        const k = grafiaDoXls(o.nome)
        const cur = porNome.get(k) ?? { occ: 0, cent: 0 }
        cur.occ += o.quantidade * it.quantidade
        cur.cent += Math.round(o.unitarioCent * it.quantidade)
        porNome.set(k, cur)
      }
    }
  }
  const linhas: LinhaDeComplemento[] = []
  let ocorrencias = 0
  let totalCent = 0
  for (const [produto, v] of porNome) {
    const occ = Math.round(v.occ * 1000) / 1000
    // ⛔ a Quantidade do XLS é INTEIRA (StockVendaComplementoLinha.ocorrencias Int): fração é ERRO
    if (!Number.isInteger(occ)) throw new Error(`ocorrência fracionada no complemento ${produto}: ${occ}`)
    if (occ === 0 && v.cent === 0) continue
    linhas.push({ produto, quantidade: occ, valorTotal: v.cent / 100 })
    ocorrencias += occ
    totalCent += v.cent
  }
  linhas.sort((a, b) => (a.produto < b.produto ? -1 : a.produto > b.produto ? 1 : 0))
  return { linhas, ocorrencias, totalCent }
}

/** adaptador: o pedido CRU da API (a guarda usa o que acabou de ler, independente do espelho) */
export function deCrus(crus: readonly PedidoCru[]): PedidoParaComplemento[] {
  return crus.map((d) => ({
    status: d.status,
    sumido: false,
    itens: d.items.map((i) => ({
      quantidade: Number(i.quantity),
      cancelado: !!i.cancelled_at,
      opcoes: (i.options ?? []).map((o) => ({ nome: o.name, quantidade: Number(o.quantity), unitarioCent: centavos(o.unit_price) })),
    })),
  }))
}

/** adaptador: o ESPELHO (suit_pedido → suit_pedido_item → suit_item_opcao) do dia */
export async function lerDoEspelho(db: PrismaClient, companyId: string, dia: string): Promise<PedidoParaComplemento[]> {
  const ps = await db.suitPedido.findMany({
    where: { companyId, dia },
    select: { status: true, sumidoEm: true, itens: { select: { quantidade: true, canceladoEm: true, opcoes: { select: { nome: true, quantidade: true, unitarioCent: true } } } } },
  })
  return ps.map((p) => ({ status: p.status, sumido: !!p.sumidoEm, itens: p.itens.map((i) => ({ quantidade: i.quantidade, cancelado: !!i.canceladoEm, opcoes: i.opcoes })) }))
}

/** o que a esteira JÁ tem de complementos do dia (XLS ou API) */
export async function complementosGravados(db: PrismaClient, companyId: string, dia: string) {
  const linhas = await db.stockVendaComplementoLinha.findMany({
    where: { companyId, importId: { in: [importIdDe(companyId, dia, 'DIA'), importIdDe(companyId, dia, 'PERIODO')] } },
    select: { nomeSuitable: true, ocorrencias: true, valorTotal: true },
  })
  const arq = await db.stockVendaArquivo.findFirst({ where: { companyId, relatorio: 'COMPLEMENTOS', data: { gte: new Date(`${dia}T00:00:00Z`), lt: new Date(new Date(`${dia}T00:00:00Z`).getTime() + 86_400_000) } }, select: { nomeArquivo: true } })
  return { linhas, daApi: ehArquivoDaApi(arq?.nomeArquivo), temArquivo: !!arq }
}

export class ComplementosJaTemXlsError extends Error {
  constructor(dia: string) { super(`os complementos de ${dia} já entraram pelo arquivo — a Suit não passa por cima`); this.name = 'ComplementosJaTemXlsError' }
}
export class ComplementosForaDoCorteError extends Error {
  constructor(dia: string) { super(`os complementos de ${dia} são anteriores ao corte (${CORTE_COMPLEMENTOS}) — ficam com o arquivo`); this.name = 'ComplementosForaDoCorteError' }
}

export type ResultadoComplementos =
  | { status: 'MATERIALIZADO'; linhas: number; ocorrencias: number; totalCent: number; baixou: boolean; avisoBaixa: string | null; baixaFalhou: boolean }
  | { status: 'JA_FEITO' }

/**
 * Entrega os complementos do dia D à esteira (o funil único). Quem chama já espelhou D por
 * COMPLETO. ⛔ Dia com XLS de complementos não é tocado (o passado do estoque não se mexe).
 */
export async function materializarComplementosDia(db: PrismaClient, companyId: string, dia: string, agora: Date, opts: { fechadoNaMao?: boolean; reentregar?: boolean } = {}): Promise<ResultadoComplementos> {
  exigirFusoDaCasa()
  if (dia < CORTE_COMPLEMENTOS) throw new ComplementosForaDoCorteError(dia)
  if (!opts.fechadoNaMao) exigirDiaFechado(dia, agora)
  const g = await complementosGravados(db, companyId, dia)
  if (g.daApi && !opts.reentregar) return { status: 'JA_FEITO' }
  if (!g.daApi && opts.reentregar) return { status: 'JA_FEITO' } // dia de XLS: nunca reprocessa
  if (!g.daApi && (g.linhas.length > 0 || g.temArquivo)) throw new ComplementosJaTemXlsError(dia)
  const r = linhasDeComplementoDaRegua(await lerDoEspelho(db, companyId, dia))
  const rec = await confirmarLinhasDeComplemento(companyId, dia, r.linhas, undefined, db, 'DIA', nomeArquivoComplementosApi(dia))
  return { status: 'MATERIALIZADO', linhas: r.linhas.length, ocorrencias: r.ocorrencias, totalCent: r.totalCent, baixou: !!rec.baixa, avisoBaixa: rec.avisoBaixa, baixaFalhou: rec.baixaFalhou }
}

export { ComplementosDaApiError, exigirComplementoSemApi } from '../stock/vendas/import-complementos'
