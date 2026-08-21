// ESTOQUE FASE 1 item 4 — RECIBO da conferência (persistido = URL estável, derivado do
// que já está gravado: conferência + itens + movimentos criados + duplicatas). Não é um
// modelo novo — é a leitura auditável do que aquele recebimento fez no estoque. Só LÊ.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'

type Db = PrismaClient | Prisma.TransactionClient

const nNFdaChave = (chave: string) => (chave.length === 44 ? String(Number(chave.slice(25, 34))) : null)

export interface ReciboItem {
  xProd: string
  itemNome: string | null
  itemId: string | null
  qtdNota: number
  qtdRecebida: number | null
  unidadeNota: string | null
  divergencia: boolean
  motivo: string | null
  temFoto: boolean
  // do movimento gerado
  quantidade: number | null
  custoUnitario: number | null
  custoTotal: number | null
}
export interface ReciboData {
  conferenceId: string
  nfeId: string
  chave: string
  nNF: string | null
  status: string // CONFIRMADA | DIVERGENTE_ACEITA
  divergente: boolean
  confirmadoEm: string | null
  fornecedor: { nome: string | null; cnpj: string | null }
  valorEntrada: number // Σ custoTotal dos movimentos (valor que ENTROU no estoque, vProd)
  vNF: number | null // total da nota (com impostos; ≠ valorEntrada quando há ST/frete)
  itens: ReciboItem[]
  duplicatas: { nDup: string | null; dVenc: string | null; valor: number }[]
  conferidoPor: string | null
}

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export async function buildRecibo(companyId: string, conferenceId: string, db: Db = defaultPrisma): Promise<ReciboData | null> {
  const conf = await db.stockReceiptConference.findFirst({ where: { id: conferenceId, companyId }, select: { id: true, nfeId: true, chave: true, status: true, confirmadoEm: true, conferidoPorId: true } })
  if (!conf) return null

  const [nfe, confItens, movimentos, dups] = await Promise.all([
    db.stockNfe.findFirst({ where: { id: conf.nfeId, companyId }, select: { chave: true, emitNome: true, emitCnpj: true, vNF: true } }),
    db.stockConferenceItem.findMany({ where: { companyId, conferenceId }, orderBy: { criadoEm: 'asc' } }),
    db.stockMovement.findMany({ where: { companyId, receiptId: conferenceId }, select: { itemId: true, quantidade: true, custoUnitario: true, custoTotal: true } }),
    db.stockPayableSuggestion.findMany({ where: { companyId, nfeId: conf.nfeId }, orderBy: { dVenc: 'asc' }, select: { nDup: true, dVenc: true, valor: true } }),
  ])

  const itemIds = [...new Set(confItens.map((c) => c.itemId).filter((i): i is string => !!i))]
  const items = itemIds.length ? await db.stockItem.findMany({ where: { companyId, id: { in: itemIds } }, select: { id: true, nome: true } }) : []
  const nomePorItem = new Map(items.map((i) => [i.id, i.nome]))
  const usuario = conf.conferidoPorId ? await db.user.findUnique({ where: { id: conf.conferidoPorId }, select: { name: true } }).catch(() => null) : null

  // movimento por item (1 ENTRADA_NF por item na conferência)
  const movPorItem = new Map<string, { quantidade: number; custoUnitario: number; custoTotal: number }>()
  for (const m of movimentos) movPorItem.set(m.itemId, { quantidade: m.quantidade, custoUnitario: m.custoUnitario, custoTotal: m.custoTotal })

  const itens: ReciboItem[] = confItens.map((c) => {
    const mov = c.itemId ? movPorItem.get(c.itemId) : undefined
    return {
      xProd: c.xProd,
      itemNome: c.itemId ? nomePorItem.get(c.itemId) ?? null : null,
      itemId: c.itemId,
      qtdNota: c.qtdNota,
      qtdRecebida: c.qtdRecebida,
      unidadeNota: c.unidadeNota,
      divergencia: c.divergencia,
      motivo: c.motivo,
      temFoto: !!c.fotoBase64,
      quantidade: mov?.quantidade ?? null,
      custoUnitario: mov?.custoUnitario ?? null,
      custoTotal: mov?.custoTotal ?? null,
    }
  })

  return {
    conferenceId: conf.id,
    nfeId: conf.nfeId,
    chave: conf.chave,
    nNF: nNFdaChave(conf.chave),
    status: conf.status,
    divergente: conf.status === 'DIVERGENTE_ACEITA',
    confirmadoEm: conf.confirmadoEm?.toISOString() ?? null,
    fornecedor: { nome: nfe?.emitNome ?? null, cnpj: nfe?.emitCnpj ?? null },
    valorEntrada: round2(movimentos.reduce((s, m) => s + m.custoTotal, 0)),
    vNF: nfe?.vNF ?? null,
    itens,
    duplicatas: dups.map((d) => ({ nDup: d.nDup, dVenc: d.dVenc?.toISOString().slice(0, 10) ?? null, valor: d.valor })),
    conferidoPor: usuario?.name ?? null,
  }
}
