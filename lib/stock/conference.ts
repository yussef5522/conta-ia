// ESTOQUE FASE 1 item 2 — dados da conferência da NOTA REAL (mesma forma do preview,
// pra a tela ser UMA só). Read-only: mostra itens, mapeamento existente e sugestões.
// Enquanto o CONFIRMAR não liga, NÃO grava. Só LÊ.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { sugerirCategoria, sugerirUnidade, sugerirNome, type CategoriaEstoque, type UnidadeControle } from './sugestoes'
import { combinadoDaNota } from './ponte/combinado'

type Db = PrismaClient | Prisma.TransactionClient

export interface ConfItem {
  nfeItemId: string
  xProd: string
  cProd: string
  ncm: string
  uCom: string
  qCom: number
  vUnCom: number
  vProd: number
  mapeado: { itemId: string; nome: string; unidadeControle: UnidadeControle; fatorConversao: number } | null
  sugestao: { nome: string; unidade: UnidadeControle | null; categoria: CategoriaEstoque }
  uTrib: string // unidade de tributação da nota (às vezes já é a de controle: UN/KG)
  fatorNota: number | null // qTrib/qCom quando uTrib é unidade de controle → o fator vem DA NOTA
}
export interface ConfView {
  modoTeste: false
  nfeId: string
  fornecedor: { nome: string; cnpj: string; uf: string; jaCadastrado: boolean }
  chave: string
  dataEmissao: string | null
  valorNota: number | null
  temItens: boolean
  itens: ConfItem[]
  /** PONTE 1 — as duplicatas (boletos) da nota, pro bloco "BOLETOS DA NOTA".
   *  Vêm de `stock_nfe_dup` (o dado CRU da NF-e): na hora da conferência as sugestões
   *  ainda não existem — elas nascem no CONFIRMAR. Por isso a seleção é por `nDup`.
   *  `jaEnviada` = essa parcela já virou conta a pagar (idempotência à vista). */
  duplicatas: { nDup: string | null; valor: number; dVenc: string | null; jaEnviada: boolean }[]
  /** houve renegociação? (o combinado ≠ as duplicatas do XML) */
  renegociada: boolean
  motivoRenegociacao: string | null
  /** o que a NOTA diz — referência, nunca editável (dado da SEFAZ) */
  duplicatasXml: { nDup: string | null; valor: number; dVenc: string | null }[]
  /** o fornecedor da nota já existe no FINANCEIRO? (≠ `fornecedor.jaCadastrado`, que é o estoque) */
  fornecedorNoFinanceiro: boolean
}

const r2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const CONTROLE = new Set(['KG', 'UN', 'LT'])

/** Fator que a PRÓPRIA nota resolve: quando a unidade de tributação (uTrib) é a de controle
 *  (UN/KG/LT), o fator = qTrib/qCom (ex: 1 CX comercial = 20 UN tributadas). A tela confirma,
 *  não pergunta. null quando a nota não resolve (uTrib = a mesma comercial, ou não bate). */
function fatorDaNota(uCom: string | null, qCom: number | null, uTrib: string | null, qTrib: number | null): number | null {
  if (!uTrib || !CONTROLE.has(uTrib.toUpperCase())) return null
  if (!qCom || !qTrib || qCom <= 0 || qTrib <= 0) return null
  const f = r2(qTrib / qCom)
  if (f < 1.5) return null // 1:1 (uCom já é a de controle) → não é conversão de embalagem
  return f
}

export async function buildConferenceView(companyId: string, nfeId: string, db: Db = defaultPrisma): Promise<ConfView | null> {
  const nfe = await db.stockNfe.findFirst({ where: { id: nfeId, companyId }, select: { id: true, chave: true, emitCnpj: true, emitNome: true, vNF: true, dataEmissao: true } })
  if (!nfe) return null

  const [emit, itensNfe] = await Promise.all([
    db.stockNfeEmit.findUnique({ where: { nfeId }, select: { cnpj: true, xNome: true, uf: true } }),
    db.stockNfeItem.findMany({ where: { companyId, nfeId }, orderBy: { nItem: 'asc' } }),
  ])
  const cnpj = (emit?.cnpj ?? nfe.emitCnpj ?? '').replace(/\D/g, '')

  const [fornecedor, mapeamentos] = await Promise.all([
    cnpj ? db.stockSupplier.findFirst({ where: { companyId, cnpj }, select: { id: true } }) : Promise.resolve(null),
    db.stockSupplierProduct.findMany({ where: { companyId, supplierCnpj: cnpj }, select: { cProd: true, itemId: true, fatorConversao: true } }),
  ])
  const mapaPorCProd = new Map(mapeamentos.map((m) => [m.cProd, m]))
  const itemIds = [...new Set(mapeamentos.map((m) => m.itemId))]
  const itensEstoque = itemIds.length ? await db.stockItem.findMany({ where: { companyId, id: { in: itemIds } }, select: { id: true, nome: true, unidadeControle: true } }) : []
  const itemById = new Map(itensEstoque.map((i) => [i.id, i]))

  const itens: ConfItem[] = itensNfe.map((it) => {
    const m = it.cProd ? mapaPorCProd.get(it.cProd) : undefined
    const estoque = m ? itemById.get(m.itemId) : undefined
    return {
      nfeItemId: it.id,
      xProd: it.xProd,
      cProd: it.cProd ?? '',
      ncm: it.ncm ?? '',
      uCom: it.uCom ?? '',
      qCom: it.qCom ?? 0,
      vUnCom: it.vUnCom ?? 0,
      vProd: it.vProd ?? r2((it.qCom ?? 0) * (it.vUnCom ?? 0)),
      mapeado: m && estoque ? { itemId: m.itemId, nome: estoque.nome, unidadeControle: estoque.unidadeControle as UnidadeControle, fatorConversao: m.fatorConversao } : null,
      sugestao: { nome: sugerirNome(it.xProd), unidade: sugerirUnidade(it.uCom), categoria: sugerirCategoria(it.xProd, it.ncm) },
      uTrib: it.uTrib ?? '',
      fatorNota: fatorDaNota(it.uCom, it.qCom, it.uTrib, it.qTrib),
    }
  })

  // ⭐⭐ AS PARCELAS QUE VALEM HOJE — o COMBINADO, não a duplicata crua (29/08/2026).
  //
  // ⚠️⚠️ BUG QUE ISTO CONSERTA, e ele foi MEU: eu criei `combinadoDaNota` justamente pra
  // ser o resolvedor ÚNICO, liguei no confirmar e na tela de boletos... e deixei ESTA
  // leitura no `stock_nfe_dup`. Resultado no uso real: o dono ajustou as parcelas, o
  // combinado GRAVOU (5 linhas em prod, 18:29), ele voltou pra tela e viu as 3 do XML —
  // **falha em silêncio**, a classe proibida. Segundo leitor da mesma pergunta = tela e
  // gravação discordando, exatamente a doença dos 7 detectores de par.
  const combinado = await combinadoDaNota(companyId, nfeId, db)
  const dups = (combinado?.parcelas ?? []).map((p) => ({ nDup: p.numero, vDup: p.valor, dVenc: p.dVenc }))
  const enviadas = new Set((await db.stockPayableLink.findMany({
    where: { companyId, origem: 'NFE', refId: nfeId }, select: { nDup: true },
  })).map((l) => l.nDup))
  const soDigitos = (x: string | null | undefined) => (x ?? '').replace(/\D/g, '')
  const fornFin = soDigitos(cnpj)
    ? (await db.supplier.findMany({ where: { companyId }, select: { cnpj: true } })).some((f) => soDigitos(f.cnpj) === soDigitos(cnpj))
    : false

  return {
    modoTeste: false,
    nfeId: nfe.id,
    fornecedor: { nome: emit?.xNome ?? nfe.emitNome ?? '(sem nome)', cnpj, uf: emit?.uf ?? '', jaCadastrado: !!fornecedor },
    chave: nfe.chave,
    dataEmissao: nfe.dataEmissao?.toISOString() ?? null,
    valorNota: nfe.vNF,
    temItens: itens.length > 0,
    itens,
    duplicatas: dups.map((d) => ({
      nDup: d.nDup, valor: d.vDup,
      dVenc: d.dVenc ? d.dVenc.toISOString() : null,
      jaEnviada: enviadas.has(d.nDup),
    })),
    // ⭐ o que a NOTA diz fica visível como REFERÊNCIA quando o combinado difere — os
    // dois na tela, nenhum sobrescrevendo o outro (a regra do módulo).
    renegociada: combinado?.renegociado ?? false,
    motivoRenegociacao: combinado?.motivo ?? null,
    duplicatasXml: (combinado?.xml ?? []).map((x) => ({
      nDup: x.numero, valor: x.valor, dVenc: x.dVenc ? x.dVenc.toISOString() : null,
    })),
    fornecedorNoFinanceiro: fornFin,
  }
}
