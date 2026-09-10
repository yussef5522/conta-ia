// GET /api/conciliacao/escolher-na-mao?empresaId=…&extratoId=…
//
// ⭐ O card de UMA linha do extrato contra as notas abertas do fornecedor dela.
//
// ⚠️ CARREGA SOB DEMANDA, uma linha por vez — decisão do dono no mock (*"Casper (5 linhas):
// abre uma linha por vez, da mais antiga"*). Mandar as notas de todos os fornecedores na
// fila encheria o payload com as 15 parcelas da Box Paper sem ninguém ter pedido.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { fornecedoresDaEmpresa } from '@/lib/conciliacao/fila-de-conciliacao'
import { reconhecerFornecedor } from '@/lib/conciliacao/sugestao-de-vinculo'
import { montarCardDeEscolha } from '@/lib/conciliacao/escolher-na-mao'
import { jaPagoPorConta } from '@/lib/conciliacao/aplicar-baixa-parcial'

const querySchema = z.object({
  empresaId: z.string().cuid(),
  extratoId: z.string().cuid(),
})

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const data = querySchema.parse(Object.fromEntries(url.searchParams))
    const ctx = await getAuthContext(request, data.empresaId)
    ctx.requirePermission('transaction.view')

    const linha = await prisma.transaction.findUnique({
      where: { id: data.extratoId },
      select: {
        id: true, description: true, amount: true, date: true, supplierId: true,
        bankAccount: { select: { name: true, companyId: true } },
        category: { select: { name: true } },
      },
    })
    // ⛔ REGRA 8: a linha tem que ser DESTA empresa; sem isto um id de outra listaria as
    // contas desta contra o extrato de outra.
    if (!linha || linha.bankAccount?.companyId !== data.empresaId) {
      return NextResponse.json({ erro: 'Linha não encontrada nesta empresa' }, { status: 404 })
    }

    const fornecedores = await fornecedoresDaEmpresa(prisma, data.empresaId)
    const fid = linha.supplierId
      ?? reconhecerFornecedor(linha.description, fornecedores)?.id
      ?? null
    if (!fid) {
      // ⚠️ sem fornecedor reconhecido não há lista pra oferecer — e inventar uma seria o
      // caça-níquel do subset-sum sem âncora, que já mordeu em 09/09.
      return NextResponse.json({
        erro: 'Não reconheci o fornecedor nesta linha — não dá pra listar as notas dele.',
        card: null,
      }, { status: 422 })
    }
    const nome = fornecedores.find((f) => f.id === fid)
    const notas = await prisma.transaction.findMany({
      where: {
        supplierId: fid,
        lifecycle: { in: ['PAYABLE', 'RECEIVABLE'] }, status: 'PENDING', paymentDate: null,
        reconciledWithId: null, reconciledFrom: { none: {} },
      },
      select: { id: true, description: true, amount: true, dueDate: true, date: true },
      orderBy: { dueDate: 'asc' },
    })
    const jaPago = await jaPagoPorConta(notas.map((n) => n.id), prisma)

    const card = montarCardDeEscolha({
      linha: {
        id: linha.id, descricao: linha.description, valor: Math.abs(linha.amount),
        data: linha.date, conta: linha.bankAccount?.name?.trim() ?? null,
        categoria: linha.category?.name ?? null,
      },
      fornecedorId: fid,
      fornecedorNome: nome?.nomeFantasia ?? nome?.razaoSocial ?? 'fornecedor',
      notas: notas.map((n) => ({
        id: n.id, descricao: n.description, valor: Math.abs(n.amount),
        vencimento: n.dueDate ?? n.date, jaPago: jaPago.get(n.id) ?? 0,
      })),
      hoje: new Date(),
    })
    return NextResponse.json({ card })
  } catch (error) {
    return handleApiError(error)
  }
}
