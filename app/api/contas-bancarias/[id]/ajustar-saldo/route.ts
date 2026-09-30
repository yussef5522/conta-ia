// POST /api/contas-bancarias/[id]/ajustar-saldo — Sprint 1.5.
//
// Cria um lançamento de ajuste que faz o saldo do sistema bater com o saldo
// real do extrato bancário. Caso de uso: conta criada com saldo errado (ex: 0)
// + OFX importado por cima → saldo do sistema ≠ saldo do banco.
//
// O lançamento usa categoria com dreGroup='AJUSTE_SALDO' (não infla DRE).
// Data = 1 dia antes da transação mais antiga (mantém timeline do saldo
// cumulativo correta) ou ontem se a conta não tiver transações.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { reAncorarContas } from '@/lib/balance/recalcular'
import { getAuthContext } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api/handle-error'
import { buildBalanceAdjustment } from '@/lib/balance/adjust'

interface Params {
  params: Promise<{ id: string }>
}

// Limite de sanity: evita erro de digitação (ex: 10 bilhões). ±R$ 1 bilhão.
const MAX_ABS_BALANCE = 1_000_000_000

const ajustarSaldoSchema = z.object({
  // Pode ser negativo (cheque especial). Limitado pra evitar typo gigante.
  saldoCorreto: z.coerce
    .number({ invalid_type_error: 'Saldo deve ser um número' })
    .min(-MAX_ABS_BALANCE, 'Valor fora do limite permitido')
    .max(MAX_ABS_BALANCE, 'Valor fora do limite permitido'),
  motivo: z.string().max(200).optional(),
})

const CATEGORIA_AJUSTE_NOME = 'Ajuste de Saldo'

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: contaId } = await params
    const body = await request.json()
    const { saldoCorreto, motivo } = ajustarSaldoSchema.parse(body)

    // 1. Fetch conta
    const conta = await prisma.bankAccount.findUnique({
      where: { id: contaId },
      // ⚠️ os 4 campos da ÂNCORA entram no select porque a recusa depende deles — sem isso
      // `conta.ledgerBal` viria `undefined` e a trava nasceria CEGA (a doença do PIX de
      // 7.000: o motor decide com um campo que a consulta não trouxe, e não dá erro: dá
      // silêncio). O `tsc` cobra os nomes, o select cobra a existência.
      select: {
        id: true, companyId: true, name: true, balance: true,
        ledgerBal: true, ledgerBalDate: true, openingBalance: true, openingDate: true,
      },
    })
    if (!conta) {
      return NextResponse.json({ erro: 'Conta não encontrada' }, { status: 404 })
    }

    // 2. RBAC
    const ctx = await getAuthContext(request, conta.companyId)
    ctx.requirePermission('transaction.create')

    // 3. Calcula o ajuste necessário (função pura)
    const adjustment = buildBalanceAdjustment({
      currentBalance: conta.balance,
      targetBalance: saldoCorreto,
    })

    if (!adjustment.needed) {
      return NextResponse.json({
        mensagem: 'O saldo já está correto. Nenhum ajuste necessário.',
        saldoAtual: conta.balance,
      })
    }

    // 4. Data do ajuste: 1 dia antes da transação mais antiga da conta.
    //    Mantém o saldo cumulativo (sparkline) correto desde o início.
    //    Fallback: ontem, se a conta não tiver transações.
    const txMaisAntiga = await prisma.transaction.findFirst({
      where: { bankAccountId: contaId },
      orderBy: { date: 'asc' },
      select: { date: true },
    })
    const adjustmentDate = new Date(
      (txMaisAntiga?.date ?? new Date()).getTime() - 24 * 60 * 60 * 1000,
    )

    /**
     * ⛔⛔⛔ CONTA COM ÂNCORA NÃO SE "AJUSTA" (30/09/2026 — achado do item 4).
     *
     * ⚠️ Este gesto data o lançamento **um dia ANTES da transação mais antiga** (é um saldo
     * de ABERTURA). Numa conta ancorada, o saldo é `âncora + Σ(depois dela)` — então um
     * lançamento no passado profundo fica FORA da conta e **o ajuste não teria efeito
     * nenhum**. Com o `increment` de antes ele "funcionava" mexendo no cache e deixando o
     * cache discordar da régua: exatamente o drift que este sprint existe pra matar.
     *
     * ⭐ A saída não é fazer nada em silêncio nem voltar o `increment`: é DIZER que o saldo
     * desta conta vem do que o banco declarou, e apontar a porta certa — a **âncora de
     * abertura** (decisão do dono, com evento auditado, desenho de 01/09). *"Saldo declarado
     * pelo banco é CONFERÊNCIA, não fonte"* vale nos dois sentidos: nem o extrato sobrescreve
     * a abertura, nem um número digitado sobrescreve o extrato.
     */
    const temAncora =
      (conta.ledgerBal != null && conta.ledgerBalDate != null) ||
      (conta.openingBalance != null && conta.openingDate != null)
    if (temAncora) {
      const qual =
        conta.openingBalance != null && conta.openingDate != null
          ? `a abertura conferida de ${conta.openingDate!.toISOString().slice(0, 10)}`
          : `o saldo que o banco declarou no extrato de ${conta.ledgerBalDate!.toISOString().slice(0, 10)}`
      return NextResponse.json(
        {
          erro:
            `o saldo da conta «${conta.name}» é derivado de ${qual} mais os lançamentos posteriores — ` +
            `ele não se ajusta por um número digitado, senão o sistema passaria a discordar do extrato. ` +
            `Se o saldo está errado, ou falta lançamento (importe o extrato) ou a ABERTURA da conta está ` +
            `errada — e mudar a abertura é uma decisão registrada, não um ajuste.`,
          code: 'CONTA_ANCORADA',
        },
        { status: 422 },
      )
    }

    // 5. find-or-create categoria "Ajuste de Saldo" da empresa
    let categoria = await prisma.category.findFirst({
      where: { companyId: conta.companyId, name: CATEGORIA_AJUSTE_NOME },
      select: { id: true },
    })
    if (!categoria) {
      categoria = await prisma.category.create({
        data: {
          companyId: conta.companyId,
          name: CATEGORIA_AJUSTE_NOME,
          // type da categoria é cosmético (DRE usa dreGroup). TRANSFER = neutro.
          type: 'TRANSFER',
          dreGroup: 'AJUSTE_SALDO',
          color: '#6B7280',
          description:
            'Lançamentos técnicos que ajustam o saldo do sistema ao extrato real do banco. Não entram no DRE.',
          isSystemDefault: true,
        },
        select: { id: true },
      })
    }

    // 6. Atomic: cria transação de ajuste + atualiza saldo cacheado
    const { transacao, contaAtualizada } = await prisma.$transaction(async (tx) => {
      const criada = await tx.transaction.create({
        data: {
          bankAccountId: contaId,
          categoryId: categoria.id,
          date: adjustmentDate,
          competenceDate: adjustmentDate,
          paymentDate: adjustmentDate,
          description: `Ajuste de saldo inicial — ${conta.name}`,
          amount: adjustment.amount,
          type: adjustment.type,
          status: 'RECONCILED',
          origin: 'MANUAL',
          notes: motivo ?? null,
        },
        include: { category: { select: { id: true, name: true, color: true, type: true } } },
      })
      // ⭐ item 4: a conta aqui é SEMPRE sem âncora (a recusa acima garante), então
      // re-ancorar = Σ(todas), que INCLUI o ajuste recém-criado → chega no target sozinho.
      // Nada de delta gravado: o saldo volta a ser derivação, não acumulação.
      const [recalc] = await reAncorarContas(tx, [contaId])
      return {
        transacao: criada,
        contaAtualizada: { id: contaId, name: conta.name, balance: recalc!.saldoDepois },
      }
    })

    // 7. Audit log
    await logAudit(ctx, {
      action: 'CREATE',
      entityType: 'BalanceAdjustment',
      entityId: transacao.id,
      metadata: {
        bankAccountId: contaId,
        bankAccountName: conta.name,
        saldoAnterior: conta.balance,
        saldoNovo: contaAtualizada.balance,
        diferenca: adjustment.difference,
        tipo: adjustment.type,
        motivo: motivo ?? null,
        adjustmentDate: adjustmentDate.toISOString(),
      },
      request,
    })

    return NextResponse.json(
      {
        transacao,
        saldoAnterior: conta.balance,
        saldoNovo: contaAtualizada.balance,
        diferenca: adjustment.difference,
      },
      { status: 201 },
    )
  } catch (error) {
    return handleApiError(error)
  }
}
