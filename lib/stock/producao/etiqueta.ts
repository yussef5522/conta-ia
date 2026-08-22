// ESTOQUE FASE 2 item 2.3 — ETIQUETA da produção (Zebra 60×60). Derivada da conclusão +
// ficha: produto, manipulação (data), validade, LOTE (= id da ordem), qtd, colaborador, QR
// (= lote). Gera os dados pra tela imprimível E o ZPL cru (o agente USB da impressora é
// frente à parte; o ZPL já sai certo). Uma por LOTE ou uma por UNIDADE (config na chamada).

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'

const fmtDia = (d: Date | null) => (d ? d.toISOString().slice(0, 10).split('-').reverse().join('/') : '—')
const loteCurto = (ordemId: string) => ordemId.slice(-8).toUpperCase()

export interface EtiquetaData {
  conclusaoId: string
  produto: string
  lote: string
  manipulacao: string // dd/mm/aaaa
  validade: string // dd/mm/aaaa ou —
  qtdGerada: number
  unidade: string
  colaborador: string | null
}

export async function buildEtiqueta(companyId: string, conclusaoId: string, db: PrismaClient = defaultPrisma): Promise<EtiquetaData | null> {
  const c = await db.stockProducaoConclusao.findFirst({ where: { id: conclusaoId, companyId } })
  if (!c) return null
  const ordem = await db.stockProductionOrder.findFirst({ where: { id: c.ordemId, companyId }, select: { itemProduzidoId: true, dataProducao: true } })
  if (!ordem) return null
  const [prod, colab] = await Promise.all([
    db.stockItem.findFirst({ where: { companyId, id: ordem.itemProduzidoId }, select: { nome: true, unidadeControle: true } }),
    c.colaboradorId ? db.stockColaborador.findFirst({ where: { companyId, id: c.colaboradorId }, select: { nome: true } }) : Promise.resolve(null),
  ])
  return {
    conclusaoId: c.id,
    produto: prod?.nome ?? '(produto)',
    lote: loteCurto(c.ordemId),
    manipulacao: fmtDia(ordem.dataProducao),
    validade: fmtDia(c.validadeAte),
    qtdGerada: c.qtdGerada,
    unidade: prod?.unidadeControle ?? 'UN',
    colaborador: colab?.nome ?? null,
  }
}

/** ZPL de UMA etiqueta 60×60mm (~480 dots a 203dpi). Texto + QR do lote. */
export function etiquetaZpl(e: EtiquetaData): string {
  const q = (s: string) => s.replace(/\^/g, ' ').replace(/~/g, '-') // sanitiza controles ZPL
  return [
    '^XA',
    '^CI28', // UTF-8 (acentos)
    `^FO20,20^A0N,34,34^FD${q(e.produto)}^FS`,
    `^FO20,64^A0N,24,24^FDLote: ${q(e.lote)}^FS`,
    `^FO20,96^A0N,24,24^FDManip: ${q(e.manipulacao)}^FS`,
    `^FO20,128^A0N,28,28^FDVal: ${q(e.validade)}^FS`,
    `^FO20,164^A0N,24,24^FDQtd: ${e.qtdGerada} ${q(e.unidade)}^FS`,
    e.colaborador ? `^FO20,196^A0N,22,22^FD${q(e.colaborador)}^FS` : '',
    `^FO320,150^BQN,2,4^FDLA,${q(e.lote)}^FS`, // QR do lote
    '^XZ',
  ].filter(Boolean).join('\n')
}

/** Etiquetas de uma conclusão: 1 por LOTE (default) ou N por UNIDADE. */
export async function etiquetasDaConclusao(companyId: string, conclusaoId: string, modo: 'lote' | 'unidade', db: PrismaClient = defaultPrisma): Promise<{ etiqueta: EtiquetaData; zpl: string; copias: number } | null> {
  const e = await buildEtiqueta(companyId, conclusaoId, db)
  if (!e) return null
  const copias = modo === 'unidade' ? Math.max(1, Math.round(e.qtdGerada)) : 1
  const zplUnit = etiquetaZpl(e)
  const zpl = Array.from({ length: copias }, () => zplUnit).join('\n')
  return { etiqueta: e, zpl, copias }
}
