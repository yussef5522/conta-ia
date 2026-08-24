// ESTOQUE — ENTRADA MANUAL (23/08): compra SEM nota nenhuma.
// Produtor rural que não emite, compra avulsa no mercado, feira. É compra DE VERDADE:
// sobe o estoque pelo ledger (ENTRADA_MANUAL) com custo real, e o custo médio se move
// junto — não é ajuste, não é contagem.
//
// Diferença pro AJUSTE_CONTAGEM: ali o estoque estava errado e a contagem corrige; aqui
// entrou mercadoria nova que foi paga. O tipo do movimento separa os dois pra sempre no
// extrato e no Real vs Teórico.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { criarMovimento } from './movement'
import { recomputeSaldoCache } from './saldo'

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export class EntradaManualError extends Error {}

export interface ItemEntradaInput {
  /** item já existente no catálogo */
  itemId?: string
  /** OU um item novo, criado na hora (o fornecedor não tem catálogo pra puxar) */
  novo?: { nome: string; unidadeControle: string; categoria: string }
  quantidade: number
  custoUnitario: number
}

export interface EntradaManualInput {
  companyId: string
  fornecedor: { supplierId?: string; nome?: string; cnpj?: string | null }
  data: string // YYYY-MM-DD
  itens: ItemEntradaInput[]
  observacao?: string | null
  /** compra à vista NÃO gera parcela — por isso é opt-in explícito */
  payable?: { vencimento: string; valor: number } | null
  userId?: string
  userName?: string
}

export interface PreviewLinha { nome: string; quantidade: number; custoUnitario: number; custoTotal: number; novo: boolean }
export interface PreviewEntrada { linhas: PreviewLinha[]; valorTotal: number; nItens: number }

/** Valida e totaliza — PURA (a tela e o servidor mostram o MESMO número, REGRA 5). */
export function montarPreview(itens: ItemEntradaInput[], nomePorItemId: Map<string, string> = new Map()): PreviewEntrada {
  if (!itens.length) throw new EntradaManualError('Adicione ao menos um item na entrada.')
  const linhas = itens.map((i, idx) => {
    const n = idx + 1
    if (!i.itemId && !i.novo) throw new EntradaManualError(`Item ${n}: escolha um produto do catálogo ou crie um novo.`)
    if (i.itemId && i.novo) throw new EntradaManualError(`Item ${n}: escolha do catálogo OU crie novo, não os dois.`)
    if (i.novo && !i.novo.nome?.trim()) throw new EntradaManualError(`Item ${n}: o produto novo precisa de nome.`)
    if (!(i.quantidade > 0)) throw new EntradaManualError(`Item ${n}: a quantidade tem que ser maior que zero.`)
    if (!(i.custoUnitario >= 0)) throw new EntradaManualError(`Item ${n}: custo unitário inválido.`)
    const nome = i.novo?.nome?.trim() ?? nomePorItemId.get(i.itemId!) ?? '(item)'
    return { nome, quantidade: i.quantidade, custoUnitario: i.custoUnitario, custoTotal: round2(i.quantidade * i.custoUnitario), novo: !!i.novo }
  })
  return { linhas, valorTotal: round2(linhas.reduce((s, l) => s + l.custoTotal, 0)), nItens: linhas.length }
}

export interface EntradaManualResult {
  entradaId: string
  movimentos: number
  itensCadastrados: number
  valorTotal: number
  fornecedorNome: string
  payableGerada: boolean
}

export async function registrarEntradaManual(input: EntradaManualInput, db: PrismaClient = defaultPrisma): Promise<EntradaManualResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.data)) throw new EntradaManualError('Informe a data da compra.')
  if (input.payable) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.payable.vencimento)) throw new EntradaManualError('A parcela precisa de uma data de vencimento.')
    if (!(input.payable.valor > 0)) throw new EntradaManualError('A parcela precisa de um valor maior que zero.')
  }

  // nomes do catálogo pro preview/recibo (e valida que os itens são DESTA empresa)
  const idsExistentes = input.itens.map((i) => i.itemId).filter((x): x is string => !!x)
  const doCatalogo = idsExistentes.length
    ? await db.stockItem.findMany({ where: { companyId: input.companyId, id: { in: idsExistentes } }, select: { id: true, nome: true } })
    : []
  if (doCatalogo.length !== new Set(idsExistentes).size) throw new EntradaManualError('Algum item escolhido não é desta empresa.')
  const nomePorId = new Map(doCatalogo.map((i) => [i.id, i.nome]))

  const preview = montarPreview(input.itens, nomePorId)
  const dataDate = new Date(`${input.data}T12:00:00`)

  const r = await db.$transaction(async (tx) => {
    // 1) fornecedor: usa o escolhido, ou acha por CNPJ, ou cria na hora
    let supplierId = input.fornecedor.supplierId
    let fornecedorNome = input.fornecedor.nome?.trim() ?? ''
    if (supplierId) {
      const s = await tx.stockSupplier.findFirst({ where: { id: supplierId, companyId: input.companyId }, select: { id: true, razaoSocial: true } })
      if (!s) throw new EntradaManualError('Fornecedor não encontrado.')
      fornecedorNome = s.razaoSocial
    } else {
      if (!fornecedorNome) throw new EntradaManualError('Informe o fornecedor (escolha um ou digite o nome).')
      const cnpj = input.fornecedor.cnpj?.replace(/\D/g, '') || null
      const existente = cnpj ? await tx.stockSupplier.findFirst({ where: { companyId: input.companyId, cnpj }, select: { id: true, razaoSocial: true } }) : null
      if (existente) { supplierId = existente.id; fornecedorNome = existente.razaoSocial }
      else {
        const novo = await tx.stockSupplier.create({ data: { companyId: input.companyId, cnpj, razaoSocial: fornecedorNome, criadoVia: 'MANUAL', criadoPorId: input.userId ?? null } })
        supplierId = novo.id
      }
    }

    // 2) cabeçalho (o CHECK do banco garante parcela coerente)
    const entrada = await tx.stockEntradaManual.create({
      data: {
        companyId: input.companyId, supplierId: supplierId!, fornecedorNome, data: dataDate,
        valorTotal: preview.valorTotal, observacao: input.observacao ?? null,
        geraPayable: !!input.payable,
        payableVenc: input.payable ? new Date(`${input.payable.vencimento}T12:00:00`) : null,
        payableValor: input.payable ? input.payable.valor : null,
        criadoPorId: input.userId ?? null, criadoPorNome: input.userName ?? null,
      },
    })

    // 3) item a item: cadastra o que é novo e sobe o estoque pelo ledger
    let cadastrados = 0
    for (let idx = 0; idx < input.itens.length; idx++) {
      const i = input.itens[idx]
      const linha = preview.linhas[idx]
      let itemId = i.itemId
      if (!itemId) {
        const criado = await tx.stockItem.create({
          data: {
            companyId: input.companyId, nome: i.novo!.nome.trim(), unidadeControle: i.novo!.unidadeControle,
            categoria: i.novo!.categoria, criadoVia: 'MANUAL', criadoPorId: input.userId ?? null,
          },
        })
        itemId = criado.id
        cadastrados++
      }
      const mov = await criarMovimento(tx, {
        companyId: input.companyId, itemId, tipo: 'ENTRADA_MANUAL',
        quantidade: linha.quantidade, custoUnitario: linha.custoUnitario, custoTotal: linha.custoTotal,
        receiptId: entrada.id, origem: 'MANUAL', criadoPorId: input.userId ?? null, dataMovimento: dataDate,
      })
      await tx.stockEntradaManualItem.create({
        data: {
          companyId: input.companyId, entradaId: entrada.id, itemId, nome: linha.nome,
          quantidade: linha.quantidade, custoUnitario: linha.custoUnitario, custoTotal: linha.custoTotal, movementId: mov.id,
        },
      })
    }
    return { entradaId: entrada.id, cadastrados, fornecedorNome }
  })

  await recomputeSaldoCache(db, input.companyId)
  return {
    entradaId: r.entradaId, movimentos: input.itens.length, itensCadastrados: r.cadastrados,
    valorTotal: preview.valorTotal, fornecedorNome: r.fornecedorNome, payableGerada: !!input.payable,
  }
}

export interface EntradaManualRecibo {
  id: string; fornecedorNome: string; data: string; valorTotal: number
  observacao: string | null; criadoPorNome: string | null
  geraPayable: boolean; payableVenc: string | null; payableValor: number | null
  itens: { nome: string; quantidade: number; custoUnitario: number; custoTotal: number }[]
}

export async function getEntradaManual(companyId: string, entradaId: string, db: PrismaClient = defaultPrisma): Promise<EntradaManualRecibo | null> {
  const e = await db.stockEntradaManual.findFirst({ where: { id: entradaId, companyId } })
  if (!e) return null
  const itens = await db.stockEntradaManualItem.findMany({ where: { companyId, entradaId }, orderBy: { criadoEm: 'asc' } })
  return {
    id: e.id, fornecedorNome: e.fornecedorNome, data: e.data.toISOString(), valorTotal: e.valorTotal,
    observacao: e.observacao, criadoPorNome: e.criadoPorNome,
    geraPayable: e.geraPayable, payableVenc: e.payableVenc ? e.payableVenc.toISOString() : null, payableValor: e.payableValor,
    itens: itens.map((i) => ({ nome: i.nome, quantidade: i.quantidade, custoUnitario: i.custoUnitario, custoTotal: i.custoTotal })),
  }
}

/** Pra seção "Recebidas": entradas manuais aparecem junto das notas, marcadas MANUAL. */
export async function listarEntradasManuais(companyId: string, db: PrismaClient = defaultPrisma) {
  const es = await db.stockEntradaManual.findMany({ where: { companyId }, orderBy: { data: 'desc' }, take: 50 })
  return es.map((e) => ({
    id: e.id, fornecedorNome: e.fornecedorNome, data: e.data.toISOString(),
    valorTotal: e.valorTotal, geraPayable: e.geraPayable, criadoPorNome: e.criadoPorNome,
  }))
}
