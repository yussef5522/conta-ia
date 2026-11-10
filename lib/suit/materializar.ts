// SUITAPI — O FECHAMENTO DO DIA (10/11/2026). O dia operacional fechado vira as LINHAS que o XLS
// de PRODUTOS dava, e entra pela MESMA esteira (processarLinhasDaApi → gravarVenda).
//
// ⭐ A régua é a PROVADA (5/7 BATE + 2 DIVERGE explicados): status ≠ abandoned · item com
//    cancelled_at fora · janela 06h→06h no relógio da API · produto pela chave normalizarNome.
//    ⛔ Pedido APAGADO no PDV antes do fechamento fica fora (é o que a "foto" do XLS faria).
// ⭐ A LINHA DA ESTEIRA é a GRAFIA DO XLS — e a grafia É a chave: o XLS é HTML e COLAPSA espaço
//    ("HAMBURGUER  TRADICIONAL" → um espaço), mas mantém CAIXA e ACENTO. ⛔ Medido no fixture de
//    08/11: o XLS tem "XIS COMPLETO" E "Xis Completo" como DUAS linhas (dois produtos na Suit) —
//    agrupar por `normalizarNome` (a chave da régua de COMPARAÇÃO da sombra) fundia as duas e a
//    esteira recebia 105 linhas em vez de 106. A régua de totais segue a mesma; só a chave da
//    LINHA é a grafia.
// ⛔ Travas: dia ABERTO não materializa · dia antes do CORTE não materializa (≤08/11 é XLS) ·
//    dia que JÁ TEM import (XLS/manual) não é sobrescrito · já materializado = não refaz.

import type { PrismaClient } from '@prisma/client'
import { processarLinhasDaApi, gravarDiaDaApiSemBaixa, type LinhaVenda } from '../stock/vendas/baixa-venda'
import { SanidadeNaoConfirmadaError } from '../stock/vendas/medir-sanidade'
import { BaixaComItemBarradoError } from '../stock/vendas/itens-pendentes-da-baixa'
import { STATUS_FORA_DA_REGUA, somarDias, HORA_VIRADA_DIA } from './regua-sombra'

/** ⛔ a API é a fonte oficial a partir DESTE dia (decisão do dono, 10/11). ≤08/11 é XLS. */
export const CORTE_API = '2026-11-09'
/** o fechamento espera 10 min depois da virada (06:00 UTC = 03:00 BRT) */
export const MARGEM_FECHAMENTO_MIN = 10

export class DiaAbertoError extends Error {
  constructor(dia: string) { super(`o dia ${dia} ainda não fechou na Suit (fecha ${somarDias(dia, 1)} 03:${String(MARGEM_FECHAMENTO_MIN).padStart(2, '0')} de Brasília)`); this.name = 'DiaAbertoError' }
}
export class DiaForaDoCorteError extends Error {
  constructor(dia: string) { super(`o dia ${dia} é anterior ao corte da API (${CORTE_API}) — fica com o XLS`); this.name = 'DiaForaDoCorteError' }
}
export class DiaJaTemImportError extends Error {
  constructor(dia: string) { super(`o dia ${dia} já tem vendas importadas (arquivo ou lançamento) — a API não passa por cima`); this.name = 'DiaJaTemImportError' }
}

/** o instante em que D fecha pra materialização (UTC) */
export function fechamentoDe(dia: string): Date {
  const f = new Date(`${somarDias(dia, 1)}T${HORA_VIRADA_DIA}Z`)
  return new Date(f.getTime() + MARGEM_FECHAMENTO_MIN * 60_000)
}

export function exigirDiaFechado(dia: string, agora: Date): void {
  if (agora.getTime() < fechamentoDe(dia).getTime()) throw new DiaAbertoError(dia)
}

/** a grafia que o XLS mostraria: espaço colapsado + trim; caixa e acento intactos */
export function grafiaDoXls(nome: string): string {
  return nome.replace(/\s+/g, ' ').trim()
}

export type PedidoParaRegua = { status: string; sumidoEm: Date | null; itens: { nome: string; quantidade: number; precoCent: number; canceladoEm: Date | null }[] }

/** ⭐ A RÉGUA sobre os pedidos GRAVADOS → as linhas da esteira (ordenadas por produto). */
export function linhasDaRegua(pedidos: PedidoParaRegua[]): { linhas: LinhaVenda[]; pedidos: number; unidades: number; totalCent: number } {
  const porChave = new Map<string, { un: number; cent: number }>()
  let contados = 0
  for (const p of pedidos) {
    if (p.sumidoEm || p.status === STATUS_FORA_DA_REGUA) continue
    contados++
    for (const it of p.itens) {
      if (it.canceladoEm) continue
      const k = grafiaDoXls(it.nome)
      const cur = porChave.get(k) ?? { un: 0, cent: 0 }
      cur.un += it.quantidade
      cur.cent += it.precoCent
      porChave.set(k, cur)
    }
  }
  const linhas: LinhaVenda[] = []
  let unidades = 0
  let totalCent = 0
  for (const [k, v] of porChave) {
    const un = Math.round(v.un * 1000) / 1000
    // ⛔ a linha da esteira é INTEIRA (StockVendaLinha.quantidade Int, como o XLS): fração é ERRO, nunca arredondamento calado
    if (!Number.isInteger(un)) throw new Error(`quantidade fracionada no produto ${k}: ${un} — a esteira só aceita inteiro`)
    if (un === 0 && v.cent === 0) continue
    linhas.push({ produto: k, quantidade: un, valorTotal: v.cent / 100 })
    unidades += un
    totalCent += v.cent
  }
  linhas.sort((a, b) => a.produto.localeCompare(b.produto))
  return { linhas, pedidos: contados, unidades, totalCent }
}

export async function lerPedidosDoDia(db: PrismaClient, companyId: string, dia: string): Promise<PedidoParaRegua[]> {
  return db.suitPedido.findMany({
    where: { companyId, dia },
    select: { status: true, sumidoEm: true, itens: { select: { nome: true, quantidade: true, precoCent: true, canceladoEm: true } } },
  })
}

export async function linhasDoDia(db: PrismaClient, companyId: string, dia: string) {
  return linhasDaRegua(await lerPedidosDoDia(db, companyId, dia))
}

/** ⛔ o fuso do processo decide o `data` do import (T12:00 local). Prod = Brasília (15:00Z). */
export function exigirFusoDaCasa(): void {
  const iso = new Date('2026-01-15T12:00:00').toISOString()
  if (iso !== '2026-01-15T15:00:00.000Z') throw new Error(`fuso do processo não é o de Brasília (T12:00 local = ${iso}) — o dia cairia em outra chave`)
}

export type ResultadoMaterializacao =
  | { status: 'MATERIALIZADO'; importId: string; linhas: number; unidades: number; totalCent: number; pedidos: number }
  | { status: 'AGUARDANDO_DONO'; importId: string; motivo: string; linhas: number; unidades: number; totalCent: number; pedidos: number }
  | { status: 'JA_FEITO' }

/**
 * Entrega o dia D à esteira. Quem chama já sincronizou D por COMPLETO (detalhe de todos).
 * `reentregar` = o dono mandou ATUALIZAR o dia por causa de um evento (apagado/alterado).
 */
export async function materializarDia(db: PrismaClient, companyId: string, dia: string, agora: Date, opts: { reentregar?: boolean; substituirXls?: boolean } = {}): Promise<ResultadoMaterializacao> {
  exigirFusoDaCasa()
  if (dia < CORTE_API) throw new DiaForaDoCorteError(dia)
  exigirDiaFechado(dia, agora)
  const ja = await db.suitDiaMaterializado.findUnique({ where: { companyId_dia: { companyId, dia } } })
  if (ja && !opts.reentregar) return { status: 'JA_FEITO' }
  if (ja && ja.status === 'XLS_POR_CIMA') throw new DiaJaTemImportError(dia)
  if (!ja) {
    const imp = await db.stockVendaImport.findUnique({ where: { companyId_data: { companyId, data: new Date(`${dia}T12:00:00`) } }, select: { id: true } })
    // ⛔ `substituirXls` só existe por ordem EXPLÍCITA do dono (caso 09/11: XLS parcial, exportado
    // antes do dia fechar). A esteira reprocessa: estorna as baixas do arquivo e faz as da Suit.
    if (imp && !opts.substituirXls) throw new DiaJaTemImportError(dia)
  }
  const r = linhasDaRegua(await lerPedidosDoDia(db, companyId, dia))
  const base = { linhas: r.linhas.length, unidades: r.unidades, totalCent: r.totalCent, pedidos: r.pedidos }
  let importId: string
  let status: 'MATERIALIZADO' | 'AGUARDANDO_DONO' = 'MATERIALIZADO'
  let motivo: string | null = null
  try {
    importId = (await processarLinhasDaApi(companyId, dia, r.linhas, db)).importId
  } catch (e) {
    if (!(e instanceof SanidadeNaoConfirmadaError) && !(e instanceof BaixaComItemBarradoError)) throw e
    // ⭐ a esteira PERGUNTOU — a resposta é do dono. As linhas ficam gravadas, a baixa espera.
    importId = await gravarDiaDaApiSemBaixa(companyId, dia, r.linhas, db)
    status = 'AGUARDANDO_DONO'
    motivo = e.message
  }
  const dados = { status, importId, pedidos: r.pedidos, linhas: r.linhas.length, unidades: r.unidades, totalCent: r.totalCent, motivo, atualizadoEm: agora }
  await db.suitDiaMaterializado.upsert({
    where: { companyId_dia: { companyId, dia } },
    create: { companyId, dia, ...dados, materializadoEm: agora },
    update: dados,
  })
  return status === 'MATERIALIZADO' ? { status, importId, ...base } : { status, importId, motivo: motivo!, ...base }
}
