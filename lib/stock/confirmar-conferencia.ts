// ESTOQUE FASE 1 item 2 — CONFIRMAR a conferência. O coração: transforma a nota + a
// conferência do funcionário em ESTOQUE de verdade. Numa transação:
//  (a) cadastra fornecedor + itens novos (nota a nota) + APRENDE o mapeamento cProd→item
//  (b) grava a conferência (item a item, divergência/motivo/foto)
//  (c) gera 1 movimento ENTRADA_NF por item (qtd RECEBIDA, custo convertido pelo fator)
//  (d) gera contas a pagar SUGERIDO das duplicatas (ponte OFF — não toca o financeiro)
//  (e) tira a nota da fila (status CONFIRMADA)
// Depois (fora da transação): recomputa saldo + envia Confirmação 210200 à SEFAZ.
// Isolado: só escreve stock_*. Idempotente: nota já confirmada não duplica.

import { prisma } from '@/lib/db'
import { criarMovimento } from './movement'
import { recomputeSaldoCache } from './saldo'
import { enviarEvento } from './sefaz/ciencia'
import { TP_EVENTO } from './sefaz/evento'

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export interface ConfirmItemInput {
  nfeItemId: string
  cProd: string
  xProd: string
  uCom: string
  qtdNota: number
  vUnCom: number
  qtdRecebida: number
  motivo?: string | null
  fotoBase64?: string | null
  mapeado: { itemId: string; nome: string; unidadeControle: string; categoria?: string; fatorConversao: number; novo: boolean }
}
export interface ConfirmInput {
  companyId: string
  nfeId: string
  userId: string
  fornecedor: { cnpj: string; nome: string; uf?: string | null }
  itens: ConfirmItemInput[]
}
export interface ConfirmResult {
  conferenceId: string
  movimentos: number
  valorEntrada: number
  itensCadastrados: number
  payableSugeridas: number
  divergente: boolean
  sefaz: { ok: boolean; cStat: string; xMotivo: string; nProt?: string } | null
}

export async function confirmarConferencia(input: ConfirmInput): Promise<ConfirmResult> {
  const { companyId, nfeId, userId } = input

  const nfe = await prisma.stockNfe.findFirst({ where: { id: nfeId, companyId }, select: { id: true, chave: true, status: true } })
  if (!nfe) throw new Error('Nota não encontrada.')
  const jaConf = await prisma.stockReceiptConference.findFirst({ where: { companyId, nfeId }, select: { id: true, status: true } })
  if (jaConf && jaConf.status !== 'EM_CONFERENCIA') throw new Error('Essa nota já foi conferida.')

  const dups = await prisma.stockNfeDup.findMany({ where: { companyId, nfeId }, select: { nDup: true, dVenc: true, vDup: true } })
  const divergente = input.itens.some((i) => i.motivo)
  let itensCadastrados = 0

  const conf = await prisma.$transaction(async (tx) => {
    // (a) fornecedor
    const cnpj = input.fornecedor.cnpj.replace(/\D/g, '')
    if (cnpj) {
      const existe = await tx.stockSupplier.findFirst({ where: { companyId, cnpj }, select: { id: true } })
      if (!existe) await tx.stockSupplier.create({ data: { companyId, cnpj, razaoSocial: input.fornecedor.nome, uf: input.fornecedor.uf ?? null, criadoVia: 'CONFERENCIA', criadoPorId: userId } })
    }

    // (a) itens novos + mapeamento aprendido
    const itemIdReal = new Map<string, string>() // nfeItemId → stock_item.id
    for (const it of input.itens) {
      let itemId = it.mapeado.itemId
      if (it.mapeado.novo) {
        const novo = await tx.stockItem.create({ data: { companyId, nome: it.mapeado.nome, unidadeControle: it.mapeado.unidadeControle, categoria: it.mapeado.categoria ?? 'USO_INTERNO', criadoVia: 'CONFERENCIA', criadoPorId: userId } })
        itemId = novo.id
        itensCadastrados++
      }
      itemIdReal.set(it.nfeItemId, itemId)
      if (cnpj && it.cProd) {
        await tx.stockSupplierProduct.upsert({
          where: { companyId_supplierCnpj_cProd: { companyId, supplierCnpj: cnpj, cProd: it.cProd } },
          create: { companyId, supplierCnpj: cnpj, cProd: it.cProd, xProd: it.xProd, itemId, fatorConversao: it.mapeado.fatorConversao, unidadeNota: it.uCom },
          update: { itemId, fatorConversao: it.mapeado.fatorConversao, unidadeNota: it.uCom },
        })
      }
    }

    // (b) conferência
    const conference = await tx.stockReceiptConference.create({
      data: { companyId, nfeId, chave: nfe.chave, status: divergente ? 'DIVERGENTE_ACEITA' : 'CONFIRMADA', conferidoPorId: userId, confirmadoPorId: userId, confirmadoEm: new Date() },
    })
    for (const it of input.itens) {
      await tx.stockConferenceItem.create({
        data: { companyId, conferenceId: conference.id, nfeItemId: it.nfeItemId, itemId: itemIdReal.get(it.nfeItemId), xProd: it.xProd, cProd: it.cProd || null, qtdNota: it.qtdNota, unidadeNota: it.uCom, qtdRecebida: it.qtdRecebida, divergencia: !!it.motivo, motivo: it.motivo ?? null, fotoBase64: it.fotoBase64 ?? null },
      })
    }

    // (c) movimentos ENTRADA_NF (qtd RECEBIDA; custo por unidade de controle = vUnCom/fator)
    let valorEntrada = 0
    for (const it of input.itens) {
      const custoUnitario = round2(it.vUnCom / (it.mapeado.fatorConversao || 1))
      const custoTotal = round2(it.qtdRecebida * custoUnitario)
      valorEntrada = round2(valorEntrada + custoTotal)
      await criarMovimento(tx, {
        companyId, itemId: itemIdReal.get(it.nfeItemId)!, tipo: 'ENTRADA_NF',
        quantidade: it.qtdRecebida, custoUnitario, custoTotal,
        receiptId: conference.id, nfeChave: nfe.chave, nItem: null, origem: 'SEFAZ', criadoPorId: userId,
      })
    }

    // (d) contas a pagar SUGERIDO (ponte OFF)
    for (const d of dups) {
      await tx.stockPayableSuggestion.create({ data: { companyId, nfeId, chave: nfe.chave, supplierCnpj: cnpj || null, supplierNome: input.fornecedor.nome, nDup: d.nDup, dVenc: d.dVenc, valor: d.vDup } })
    }

    // (e) tira da fila
    await tx.stockNfe.update({ where: { id: nfeId }, data: { status: 'CONFIRMADA' } })

    return { conferenceId: conference.id, valorEntrada, movimentos: input.itens.length, payableSugeridas: dups.length }
  })

  // fora da transação: saldo + Confirmação SEFAZ (falha não desfaz o recebimento físico)
  await recomputeSaldoCache(prisma, companyId)
  let sefaz: ConfirmResult['sefaz'] = null
  try {
    const r = await enviarEvento({ companyId, chave: nfe.chave, tpEvento: TP_EVENTO.CONFIRMACAO })
    sefaz = { ok: r.ok, cStat: r.cStat, xMotivo: r.xMotivo, nProt: r.nProt }
  } catch (e) {
    sefaz = { ok: false, cStat: 'ERRO', xMotivo: (e as Error).message }
  }

  return { ...conf, itensCadastrados, divergente, sefaz }
}
