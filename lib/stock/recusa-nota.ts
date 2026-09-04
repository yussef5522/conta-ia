// ⭐⭐ RECUSAR NOTA — a que não chegou, a devolvida na porta, a que não é minha (04/09/2026).
//
// ⛔ NÃO É EXCLUIR: a nota **existe na SEFAZ contra o CNPJ do dono**, e apagar do sistema
// perderia o rastro de um documento que continua valendo lá fora. É estado próprio,
// reversível, com quem/quando/por quê.
//
// ⭐⭐ O ESTADO É DERIVADO, NUNCA GRAVADO NO `status` DA NOTA — a lição do
// `ehReceitaDeProducao`: se cada tela filtrasse por um `status` novo, a próxima tela
// esqueceria (e foi assim que a ficha arquivada continuou aparecendo em 01/09). Aqui existe
// UMA função (`idsRecusados`) e todos os leitores da fila herdam a exclusão dela.
//
// ⛔ E RECUSAR NÃO MANDA NADA PRA SEFAZ. Manifestação (`210240` Operação não Realizada /
// `210220` Desconhecimento) tem **prazo legal e efeito fiscal** — é decisão do dono COM o
// contador. O `tpEventoSugerido` fica ANOTADO pra esse dia ser um botão, não arqueologia.
// ⚠️ E a Ciência automática (o cron) também PARA nessa nota: Ciência é a manifestação mais
// fraca, mas é manifestação — continuar mandando sozinho numa nota recusada seria o sistema
// se manifestando por conta própria sobre um documento que o dono está contestando.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { TP_EVENTO } from './sefaz/evento'

type Db = PrismaClient | Prisma.TransactionClient

export class RecusaError extends Error {}

export const MOTIVOS_RECUSA = ['NAO_CHEGOU', 'RECUSADA_NA_ENTREGA', 'NAO_E_MINHA'] as const
export type MotivoRecusa = (typeof MOTIVOS_RECUSA)[number]

export const ROTULO_MOTIVO: Record<MotivoRecusa, string> = {
  NAO_CHEGOU: 'Não chegou (mercadoria nunca veio)',
  RECUSADA_NA_ENTREGA: 'Recusada na entrega (veio errada, devolvida na porta)',
  NAO_E_MINHA: 'Não é minha (emitida por engano contra meu CNPJ)',
}

/**
 * ⚠️ ANOTAÇÃO, NÃO AÇÃO: qual manifestação a SEFAZ pediria pra cada motivo.
 *
 * `210220` (Desconhecimento) **não está implementado** no projeto — só o `210240` tem
 * builder hoje. O mapa existe pra a conversa com o contador começar do lugar certo.
 */
export const TP_EVENTO_POR_MOTIVO: Record<MotivoRecusa, string> = {
  NAO_CHEGOU: TP_EVENTO.OP_NAO_REALIZADA,          // 210240
  RECUSADA_NA_ENTREGA: TP_EVENTO.OP_NAO_REALIZADA, // 210240
  NAO_E_MINHA: '210220',                           // Desconhecimento — ainda sem builder
}

/**
 * ⭐ A RÉGUA ÚNICA: quais notas estão recusadas AGORA.
 *
 * Todo leitor da fila (tela, card, juiz, cron da Ciência) passa por aqui. Uma função, uma
 * verdade — em vez de um `where` copiado em 4 lugares, que é como um deles fica pra trás.
 */
export async function idsRecusados(db: Db, companyId?: string): Promise<Set<string>> {
  const rows = await db.stockNfeRecusa.findMany({
    where: { reabertaEm: null, ...(companyId ? { companyId } : {}) },
    select: { nfeId: true },
  })
  return new Set(rows.map((r) => r.nfeId))
}

export interface PreviewRecusa {
  nfeId: string
  chave: string
  fornecedor: string | null
  valor: number
  /** o que a recusa vai DESFAZER — se houver algo, o dono vê antes */
  conferencias: number
  movimentos: number
  sugestoes: number
  sugestoesEnviadas: number
  /** ⛔ trava: conta a pagar já criada no financeiro não se desfaz por aqui */
  bloqueio: string | null
}

/**
 * DRY-RUN da recusa: o que existe hoje pendurado nessa nota.
 *
 * ⛔ SE A NOTA JÁ VIROU CONTA A PAGAR NO FINANCEIRO, a recusa é BLOQUEADA e diz por quê:
 * desfazer obrigação financeira é gesto de lá (cancelar a conta), e fazer isso por aqui
 * deixaria as duas pontas discordando — a mesma regra do vencimento de ontem.
 */
export async function previewDaRecusa(companyId: string, nfeId: string, db: PrismaClient = defaultPrisma): Promise<PreviewRecusa> {
  const nfe = await db.stockNfe.findFirst({ where: { id: nfeId, companyId }, select: { id: true, chave: true, vNF: true, status: true } })
  if (!nfe) throw new RecusaError('Nota não encontrada nesta empresa.')

  const [emit, conferencias, movimentos, sugestoes, links] = await Promise.all([
    db.stockNfeEmit.findFirst({ where: { companyId, nfeId }, select: { xNome: true } }),
    db.stockReceiptConference.count({ where: { companyId, nfeId } }),
    db.stockMovement.count({ where: { companyId, nfeChave: nfe.chave } }),
    db.stockPayableSuggestion.findMany({ where: { companyId, nfeId }, select: { id: true } }),
    db.stockPayableLink.findMany({ where: { companyId, refId: nfeId }, select: { id: true } }),
  ])

  return {
    nfeId, chave: nfe.chave, fornecedor: emit?.xNome ?? null, valor: nfe.vNF ?? 0,
    conferencias, movimentos, sugestoes: sugestoes.length, sugestoesEnviadas: links.length,
    bloqueio: links.length
      ? `Esta nota já virou ${links.length} conta(s) a pagar no financeiro. Cancele a conta lá primeiro — desfazer obrigação financeira por aqui deixaria as duas pontas discordando.`
      : null,
  }
}

export interface EntradaRecusa {
  companyId: string
  nfeId: string
  motivo: MotivoRecusa
  observacao?: string | null
  userId?: string
}

/**
 * RECUSA a nota. Idempotente por construção (índice único parcial: 1 recusa ativa por nota).
 *
 * ⚠️ Estorna junto o que a nota gerou — **nada de meia-recusa**: sugestão de conta a pagar
 * ainda não enviada é apagada, e movimento de estoque vira ESTORNO (movimento é imutável).
 */
export async function recusarNota(input: EntradaRecusa, db: PrismaClient = defaultPrisma): Promise<{ recusaId: string; estornou: number; sugestoesRemovidas: number }> {
  if (!MOTIVOS_RECUSA.includes(input.motivo)) throw new RecusaError('Motivo inválido.')
  const prev = await previewDaRecusa(input.companyId, input.nfeId, db)
  if (prev.bloqueio) throw new RecusaError(prev.bloqueio)

  const jaRecusada = await db.stockNfeRecusa.findFirst({ where: { companyId: input.companyId, nfeId: input.nfeId, reabertaEm: null }, select: { id: true } })
  if (jaRecusada) return { recusaId: jaRecusada.id, estornou: 0, sugestoesRemovidas: 0 }

  return db.$transaction(async (tx) => {
    // ⚠️ sugestão AINDA NÃO ENVIADA é do estoque: some junto. (Enviada foi bloqueada acima.)
    const del = await tx.stockPayableSuggestion.deleteMany({ where: { companyId: input.companyId, nfeId: input.nfeId } })

    // ⚠️ movimento é IMUTÁVEL: correção é estorno, nunca DELETE
    const { estornarMovimento } = await import('./movement')
    const movs = await tx.stockMovement.findMany({ where: { companyId: input.companyId, nfeChave: prev.chave, tipo: 'ENTRADA_NF' }, select: { id: true } })
    const jaEstornados = new Set((await tx.stockMovement.findMany({
      where: { companyId: input.companyId, tipo: 'ESTORNO', estornoDeId: { in: movs.map((m) => m.id) } }, select: { estornoDeId: true },
    })).map((e) => e.estornoDeId))
    let estornou = 0
    for (const m of movs) if (!jaEstornados.has(m.id)) { await estornarMovimento(tx, m.id, { criadoPorId: input.userId ?? null }); estornou++ }

    const r = await tx.stockNfeRecusa.create({
      data: {
        companyId: input.companyId, nfeId: input.nfeId, chave: prev.chave,
        motivo: input.motivo, observacao: input.observacao?.trim() || null,
        tpEventoSugerido: TP_EVENTO_POR_MOTIVO[input.motivo], criadoPorId: input.userId ?? null,
      },
    })
    return { recusaId: r.id, estornou, sugestoesRemovidas: del.count }
  })
}

/** REABRE: a mercadoria apareceu depois. O rastro fica nos dois sentidos, no mesmo registro. */
export async function reabrirNota(
  companyId: string, nfeId: string, motivo?: string | null, userId?: string, db: PrismaClient = defaultPrisma,
): Promise<{ reaberta: boolean }> {
  const r = await db.stockNfeRecusa.findFirst({ where: { companyId, nfeId, reabertaEm: null }, select: { id: true } })
  if (!r) throw new RecusaError('Esta nota não está recusada.')
  await db.stockNfeRecusa.update({
    where: { id: r.id },
    data: { reabertaEm: new Date(), reabertaPorId: userId ?? null, reaberturaMotivo: motivo?.trim() || null },
  })
  return { reaberta: true }
}

export interface NotaRecusada {
  nfeId: string
  chave: string
  fornecedor: string | null
  valor: number
  dataEmissao: string | null
  motivo: MotivoRecusa
  motivoRotulo: string
  observacao: string | null
  recusadaEm: string
  recusadaPorNome: string | null
  tpEventoSugerido: string | null
}

/** A vista "Recusadas" — nunca some do sistema. */
export async function listarRecusadas(companyId: string, db: PrismaClient = defaultPrisma): Promise<NotaRecusada[]> {
  const recusas = await db.stockNfeRecusa.findMany({ where: { companyId, reabertaEm: null }, orderBy: { criadoEm: 'desc' } })
  if (!recusas.length) return []
  const [notas, emits, users] = await Promise.all([
    db.stockNfe.findMany({ where: { companyId, id: { in: recusas.map((r) => r.nfeId) } }, select: { id: true, vNF: true, dataEmissao: true } }),
    db.stockNfeEmit.findMany({ where: { companyId, nfeId: { in: recusas.map((r) => r.nfeId) } }, select: { nfeId: true, xNome: true } }),
    db.user.findMany({ where: { id: { in: recusas.map((r) => r.criadoPorId).filter((x): x is string => !!x) } }, select: { id: true, name: true } }),
  ])
  const nota = new Map(notas.map((n) => [n.id, n]))
  const emit = new Map(emits.map((e) => [e.nfeId, e.xNome]))
  const nome = new Map(users.map((u) => [u.id, u.name]))

  return recusas.map((r) => ({
    nfeId: r.nfeId, chave: r.chave,
    fornecedor: emit.get(r.nfeId) ?? null,
    valor: nota.get(r.nfeId)?.vNF ?? 0,
    dataEmissao: nota.get(r.nfeId)?.dataEmissao?.toISOString().slice(0, 10) ?? null,
    motivo: r.motivo as MotivoRecusa,
    motivoRotulo: ROTULO_MOTIVO[r.motivo as MotivoRecusa] ?? r.motivo,
    observacao: r.observacao,
    recusadaEm: r.criadoEm.toISOString(),
    recusadaPorNome: r.criadoPorId ? nome.get(r.criadoPorId) ?? null : null,
    tpEventoSugerido: r.tpEventoSugerido,
  }))
}
