// ESTOQUE ↔ FINANCEIRO — PONTE 1 (24/08): o boleto da nota vira CONTA A PAGAR de verdade.
//
// ⚠️ AQUI O ESTOQUE ATRAVESSA A FRONTEIRA. É a exceção DESENHADA, e ela tem tamanho:
//   · escreve em `transactions` (a conta, lifecycle=PAYABLE, origin='ESTOQUE_NF')
//   · escreve em `suppliers` SÓ quando o dono confirma (fonte='ESTOQUE_NF')
//   · nada mais. Guard de teste prova que nenhum outro caminho do estoque escreve lá.
//
// REGRA 4 — não existe um segundo jeito de criar conta a pagar: esta ponte chama
// `createContaPendente`, a MESMA função do formulário do financeiro. Se as regras de
// conta a pagar mudarem (validação de lifecycle, vínculo obrigatório, audit), a ponte
// muda junto de graça. Um caminho de escrita, não dois.
//
// IDEMPOTÊNCIA por construção: `stock_payable_link` tem UNIQUE (companyId, origem, refId,
// nDup). Mandar a mesma nota 2× não cria a 2ª conta — o banco recusa.
//
// O DADO DO FORNECEDOR VEM DO XML (razão social + CNPJ assinados pela SEFAZ) — cadastro
// mais limpo que digitação, decisão do dono.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import type { AuthContext } from '@/lib/auth/rbac'
import { createContaPendente } from '@/lib/contas-ap-ar/create'

export const ORIGEM_PONTE = 'ESTOQUE_NF'

export class PonteError extends Error {}

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const soDigitos = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '')

// ---------------------------------------------------------------------------
// O QUE ESTÁ ESPERANDO (a lista que o dono aprova em lote)
// ---------------------------------------------------------------------------

export interface PendentePonte {
  suggestionId: string
  nfeId: string
  chave: string
  nDup: string | null
  fornecedorNome: string
  fornecedorCnpj: string | null
  /** já existe no financeiro? (se não, o dono confirma o cadastro no mesmo gesto) */
  fornecedorNoFinanceiro: boolean
  valor: number
  dVenc: string | null
  /** nº da nota extraído da chave (posições 25-34), pra o dono reconhecer */
  nNF: string | null
}

const nNFdaChave = (chave: string) => (chave?.length === 44 ? String(Number(chave.slice(25, 34))) : null)

export async function listarPendentes(companyId: string, db: PrismaClient = defaultPrisma): Promise<PendentePonte[]> {
  const sugestoes = await db.stockPayableSuggestion.findMany({
    where: { companyId },
    orderBy: { dVenc: 'asc' },
  })
  if (sugestoes.length === 0) return []

  // já enviadas? (o link é a verdade — status da sugestão é conveniência)
  const enviados = await db.stockPayableLink.findMany({
    where: { companyId, origem: 'NFE', suggestionId: { in: sugestoes.map((s) => s.id) } },
    select: { suggestionId: true },
  })
  const jaEnviada = new Set(enviados.map((e) => e.suggestionId))

  const cnpjs = [...new Set(sugestoes.map((s) => soDigitos(s.supplierCnpj)).filter(Boolean))]
  const forn = cnpjs.length
    ? await db.supplier.findMany({ where: { companyId }, select: { id: true, cnpj: true } })
    : []
  const temNoFinanceiro = new Set(forn.map((f) => soDigitos(f.cnpj)).filter(Boolean))

  return sugestoes
    .filter((s) => !jaEnviada.has(s.id))
    .map((s) => ({
      suggestionId: s.id,
      nfeId: s.nfeId,
      chave: s.chave,
      nDup: s.nDup,
      fornecedorNome: s.supplierNome ?? '(sem nome)',
      fornecedorCnpj: s.supplierCnpj,
      fornecedorNoFinanceiro: temNoFinanceiro.has(soDigitos(s.supplierCnpj)),
      valor: s.valor,
      dVenc: s.dVenc ? s.dVenc.toISOString() : null,
      nNF: nNFdaChave(s.chave),
    }))
}

// ---------------------------------------------------------------------------
// ENVIAR (o gesto do dono)
// ---------------------------------------------------------------------------

export interface EnviarResult {
  criadas: number
  puladas: number // já tinham sido enviadas (idempotência)
  fornecedoresCadastrados: number
  valorTotal: number
  erros: { suggestionId: string; motivo: string }[]
  transactionIds: string[]
}

/**
 * Resolve o Supplier do financeiro: acha por CNPJ ou — SE o dono confirmou — cadastra
 * com os dados do XML. Nunca cadastra sem o aceite explícito.
 */
async function resolverFornecedor(
  db: PrismaClient,
  companyId: string,
  nome: string,
  cnpj: string | null,
  podeCadastrar: boolean,
): Promise<{ supplierId: string | null; criou: boolean }> {
  const doc = soDigitos(cnpj)
  if (doc) {
    const todos = await db.supplier.findMany({ where: { companyId }, select: { id: true, cnpj: true } })
    const achou = todos.find((f) => soDigitos(f.cnpj) === doc)
    if (achou) return { supplierId: achou.id, criou: false }
  }
  if (!podeCadastrar) return { supplierId: null, criou: false }
  const novo = await db.supplier.create({
    data: {
      companyId,
      cnpj: doc || null,
      razaoSocial: nome,
      // marca a origem: foi a ponte do estoque que trouxe, com dado da SEFAZ
      fonte: ORIGEM_PONTE,
    },
    select: { id: true },
  })
  return { supplierId: novo.id, criou: true }
}

export async function enviarParaContasPagar(
  input: {
    companyId: string
    suggestionIds: string[]
    /** aceite explícito pra cadastrar fornecedor que ainda não existe no financeiro */
    cadastrarFornecedores: boolean
    ctx: AuthContext
    userId?: string
  },
  db: PrismaClient = defaultPrisma,
): Promise<EnviarResult> {
  const out: EnviarResult = { criadas: 0, puladas: 0, fornecedoresCadastrados: 0, valorTotal: 0, erros: [], transactionIds: [] }
  if (input.suggestionIds.length === 0) return out

  const sugestoes = await db.stockPayableSuggestion.findMany({
    where: { companyId: input.companyId, id: { in: input.suggestionIds } },
  })
  if (sugestoes.length !== input.suggestionIds.length) throw new PonteError('Alguma parcela não é desta empresa.')

  for (const s of sugestoes) {
    try {
      // idempotência: o UNIQUE do banco é a garantia; esta checagem dá a contagem boa
      const ja = await db.stockPayableLink.findFirst({
        where: { companyId: input.companyId, origem: 'NFE', refId: s.nfeId, nDup: s.nDup },
        select: { id: true },
      })
      if (ja) { out.puladas++; continue }

      if (!(s.valor > 0)) throw new PonteError('parcela sem valor')
      if (!s.dVenc) throw new PonteError('parcela sem vencimento — o Contas a Pagar precisa da data')

      const { supplierId, criou } = await resolverFornecedor(db, input.companyId, s.supplierNome ?? '(sem nome)', s.supplierCnpj, input.cadastrarFornecedores)
      if (!supplierId) {
        throw new PonteError(`"${s.supplierNome}" ainda não é fornecedor no financeiro — confirme o cadastro pra enviar esta parcela`)
      }
      if (criou) out.fornecedoresCadastrados++

      const nNF = nNFdaChave(s.chave)
      const conta = await createContaPendente({
        companyId: input.companyId,
        lifecycle: 'PAYABLE',
        description: `${s.supplierNome ?? 'Fornecedor'}${nNF ? ` — NF ${nNF}` : ''}${s.nDup ? ` (parcela ${s.nDup})` : ''}`,
        amount: round2(s.valor),
        dueDate: s.dVenc,
        supplierId,
        // rastro pro humano; o vínculo de máquina é o stock_payable_link
        notes: `Gerada pelo estoque na conferência da NF-e ${s.chave}.`,
        origin: ORIGEM_PONTE,
      }, input.ctx)

      await db.stockPayableLink.create({
        data: {
          companyId: input.companyId, origem: 'NFE', refId: s.nfeId, suggestionId: s.id,
          nDup: s.nDup, chave: s.chave, transactionId: conta.id, supplierId,
          valor: round2(s.valor), dVenc: s.dVenc, criadoPorId: input.userId ?? null,
        },
      })
      await db.stockPayableSuggestion.update({ where: { id: s.id }, data: { status: 'ENVIADA' } })

      out.criadas++
      out.valorTotal = round2(out.valorTotal + s.valor)
      out.transactionIds.push(conta.id)
    } catch (e) {
      out.erros.push({ suggestionId: s.id, motivo: (e as Error).message })
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// ENTRADA MANUAL — mesmo fluxo, mesma origem
// ---------------------------------------------------------------------------

export async function enviarEntradaManual(
  input: { companyId: string; entradaId: string; cadastrarFornecedor: boolean; ctx: AuthContext; userId?: string },
  db: PrismaClient = defaultPrisma,
): Promise<EnviarResult> {
  const out: EnviarResult = { criadas: 0, puladas: 0, fornecedoresCadastrados: 0, valorTotal: 0, erros: [], transactionIds: [] }
  const e = await db.stockEntradaManual.findFirst({ where: { id: input.entradaId, companyId: input.companyId } })
  if (!e) throw new PonteError('Entrada não encontrada.')
  if (!e.geraPayable || !e.payableVenc || !e.payableValor) return out // compra à vista: nada a fazer

  const ja = await db.stockPayableLink.findFirst({
    where: { companyId: input.companyId, origem: 'ENTRADA_MANUAL', refId: e.id, nDup: null },
    select: { id: true },
  })
  if (ja) { out.puladas++; return out }

  const forn = await db.stockSupplier.findFirst({ where: { id: e.supplierId, companyId: input.companyId }, select: { cnpj: true, razaoSocial: true } })
  const { supplierId, criou } = await resolverFornecedor(db, input.companyId, forn?.razaoSocial ?? e.fornecedorNome, forn?.cnpj ?? null, input.cadastrarFornecedor)
  if (!supplierId) throw new PonteError(`"${e.fornecedorNome}" ainda não é fornecedor no financeiro — confirme o cadastro pra gerar a parcela`)
  if (criou) out.fornecedoresCadastrados++

  const conta = await createContaPendente({
    companyId: input.companyId,
    lifecycle: 'PAYABLE',
    description: `${e.fornecedorNome} — compra sem nota`,
    amount: round2(e.payableValor),
    dueDate: e.payableVenc,
    supplierId,
    notes: `Gerada pelo estoque na entrada manual de ${e.data.toISOString().slice(0, 10)}.`,
    origin: ORIGEM_PONTE,
  }, input.ctx)

  await db.stockPayableLink.create({
    data: {
      companyId: input.companyId, origem: 'ENTRADA_MANUAL', refId: e.id, nDup: null,
      transactionId: conta.id, supplierId, valor: round2(e.payableValor), dVenc: e.payableVenc,
      criadoPorId: input.userId ?? null,
    },
  })
  out.criadas = 1
  out.valorTotal = round2(e.payableValor)
  out.transactionIds.push(conta.id)
  return out
}
