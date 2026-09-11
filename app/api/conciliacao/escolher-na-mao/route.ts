// GET /api/conciliacao/escolher-na-mao?empresaId=…
//
// ⭐ OS CARDS do Find & Match: cada linha do extrato que NOMEIA um fornecedor e não fecha
// na soma, contra as notas abertas dele.
//
// ⛔⛔ **DEVOLVE A LISTA INTEIRA, e essa é a correção de 10/09/2026.**
//
// A primeira versão carregava UMA linha por vez, sob demanda (`?extratoId=`). Na tela isso
// virou **porta sem maçaneta**: a seção nascia colapsada, o dono precisava (1) expandir,
// (2) clicar "escolher na mão" numa linha, e o card aparecia no RODAPÉ da página, longe do
// clique. Ele abriu `/conciliacao` e disse: *"continua a mensagem antiga… sem os cards
// novos"*. **A seção dos que não fecham VIRA os cards.**
//
// ⚠️ E o modo de uma-linha-só saiu junto: sem chamador, ele seria o campo decorativo que
// esta casa já pagou caro no `registry.parse` (existia, ninguém chamava, e o bug ficou
// invisível por semanas).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { fornecedoresDaEmpresa, lotesDaFila } from '@/lib/conciliacao/fila-de-conciliacao'
import { reconhecerFornecedorComIrmaos, canonizadorDeFornecedor } from '@/lib/conciliacao/sugestao-de-vinculo'
import { montarCardDeEscolha } from '@/lib/conciliacao/escolher-na-mao'
import { jaPagoPorConta } from '@/lib/conciliacao/aplicar-baixa-parcial'

const querySchema = z.object({
  empresaId: z.string().cuid(),
  /**
   * ⭐⭐ A PORTA DOS DOIS LADOS precisa montar o card de UMA LINHA QUALQUER (10/09/2026).
   *
   * ⛔ A fila só lista o que o motor de LOTE marcou como "não fecha", e o lote exige
   * 2+ notas. Fornecedor com UMA nota aberta (Oesa depois de conciliar uma, Focatto)
   * **não entra na fila** — e sem isto o "Casar com conta a pagar…" abriria a tela sem
   * card nenhum, que é a porta sem maçaneta de novo, agora do outro lado.
   *
   * ⚠️ É o MESMO `montarCardDeEscolha` — o card continua morando num lugar só.
   */
  abrir: z.string().cuid().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const data = querySchema.parse(Object.fromEntries(url.searchParams))
    const ctx = await getAuthContext(request, data.empresaId)
    ctx.requirePermission('transaction.view')

    const fila = await lotesDaFila(data.empresaId, prisma)
    const ids = [...new Set([
      ...fila.naoFecham.map((x) => x.extratoId),
      ...(data.abrir ? [data.abrir] : []),
    ])]
    if (!ids.length) return NextResponse.json({ cards: [] })

    const fornecedores = await fornecedoresDaEmpresa(prisma, data.empresaId)

    const linhas = await prisma.transaction.findMany({
      where: { id: { in: ids } },
      select: {
        id: true, description: true, amount: true, date: true, supplierId: true,
        bankAccount: { select: { name: true, companyId: true } },
        category: { select: { name: true } },
      },
    })
    // ⛔ REGRA 8: a linha tem que ser DESTA empresa — resolvida pelo dono da conta bancária
    const daEmpresa = linhas.filter((l) => l.bankAccount?.companyId === data.empresaId)

    // ⭐ UMA query pras notas de TODOS os fornecedores envolvidos — nunca uma por card.
    // ⚠️ N cards × 1 query cada é o padrão que já custou 9,6 s nesta mesma tela.
    // ⭐ o fornecedor da linha E os IRMÃOS dele no cadastro: 11 fornecedores da Caçula
    // estão cadastrados 2×, e as contas podem estar em qualquer um dos registros.
    const canon = canonizadorDeFornecedor(fornecedores)
    const fornecedorDaLinha = new Map<string, string>()
    const irmaosDe = new Map<string, string[]>()
    for (const l of daEmpresa) {
      const achado = reconhecerFornecedorComIrmaos(l.description, fornecedores)
      const fid = canon(l.supplierId) ?? (achado ? canon(achado.fornecedor.id) : null)
      if (!fid) continue
      fornecedorDaLinha.set(l.id, fid)
      const ids = l.supplierId
        ? fornecedores.filter((f) => canon(f.id) === fid).map((f) => f.id)
        : (achado?.ids ?? [])
      irmaosDe.set(fid, ids.length ? ids : [fid])
    }
    const notasTodas = fornecedorDaLinha.size
      ? await prisma.transaction.findMany({
          where: {
            supplierId: { in: [...new Set([...irmaosDe.values()].flat())] },
            lifecycle: { in: ['PAYABLE', 'RECEIVABLE'] },
            status: 'PENDING',
            paymentDate: null,
            reconciledWithId: null,
            reconciledFrom: { none: {} },
          },
          select: { id: true, description: true, amount: true, dueDate: true, date: true, supplierId: true },
          orderBy: { dueDate: 'asc' },
        })
      : []
    const jaPago = await jaPagoPorConta(notasTodas.map((n) => n.id), prisma)

    const hoje = new Date()
    const cards = daEmpresa.flatMap((l) => {
      const fid = fornecedorDaLinha.get(l.id)
      if (!fid) return []
      const dele = new Set(irmaosDe.get(fid) ?? [fid])
      const doForn = notasTodas.filter((n) => n.supplierId && dele.has(n.supplierId))
      if (!doForn.length) return []
      const forn = fornecedores.find((f) => f.id === fid)
      return [montarCardDeEscolha({
        linha: {
          id: l.id,
          descricao: l.description,
          valor: Math.abs(l.amount),
          data: l.date,
          conta: l.bankAccount?.name?.trim() ?? null,
          categoria: l.category?.name ?? null,
        },
        fornecedorId: fid,
        fornecedorNome: forn?.nomeFantasia ?? forn?.razaoSocial ?? 'fornecedor',
        notas: doForn.map((n) => ({
          id: n.id,
          descricao: n.description,
          valor: Math.abs(n.amount),
          vencimento: n.dueDate ?? n.date,
          jaPago: jaPago.get(n.id) ?? 0,
        })),
        hoje,
      })]
    })
    // ⚠️ a mais ANTIGA primeiro — a ordem que o dono pediu no mock ("da mais antiga")
    cards.sort((a, b) => a.linha.data.getTime() - b.linha.data.getTime())

    return NextResponse.json({ cards })
  } catch (error) {
    return handleApiError(error)
  }
}
