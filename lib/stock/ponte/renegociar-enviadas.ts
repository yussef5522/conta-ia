// ⭐ RENEGOCIAR DEPOIS DE ENVIADO (29/08/2026) — item 3 do caso BOX PAPER.
//
// A conta a pagar já está no financeiro e o fornecedor renegocia. O gesto é: **cancela as
// pendentes daquela nota e recria o combinado novo**, com o vínculo à nota preservado.
//
// ⛔ NUNCA MEXE EM CONTA JÁ CONCILIADA OU PAGA. Essa é a linha vermelha: dinheiro que já
// saiu não se reescreve — se uma das parcelas já foi paga, a renegociação PARA e nomeia
// qual, pra o dono decidir (o combinado novo provavelmente já considera o que foi pago).
// É a mesma disciplina do "mês fechado não se reescreve; corrige por compensação".
//
// ⚠️ TUDO NUMA TRANSAÇÃO SÓ: apagar as contas velhas, apagar as amarras, gravar o
// combinado novo. Se fosse em duas, uma falha no meio deixaria o dono SEM as contas
// velhas e SEM as novas — o estado pela metade que a atomicidade do import eliminou.
//
// ⚠️ E POR QUE APAGAR A AMARRA JUNTO: `stock_payable_link` é o que o juiz F2 usa pra
// achar "amarra apontando conta que não existe mais". Apagar a conta e deixar o link
// criaria, por construção, um alerta falso todo dia. O rastro do que foi combinado antes
// NÃO se perde: ele vive nas linhas inativas de `stock_parcela_combinada`.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import type { AuthContext } from '@/lib/auth/rbac'
import {
  CombinadoError,
  combinadoDaNota,
  gravarCombinadoNaTx,
  novaRenegociacaoId,
  numeroRenegociado,
  validarCombinado,
  type ParcelaCombinada,
} from './combinado'
import { enviarParaContasPagar } from '../ponte-contas-pagar'

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export interface RenegociarInput {
  companyId: string
  nfeId: string
  parcelas: Array<{ valor: number; dVenc: string | Date }>
  motivo?: string | null
  /**
   * Recria no Contas a Pagar o que a renegociação cancelou. Default true.
   *
   * ⚠️ SÓ RECRIA O QUE FOI CANCELADO — nota que ainda não tinha mandado nada continua
   * sem mandar. A fronteira de papel do módulo é *"enviar boleto é obrigação financeira,
   * é decisão do dono"*: editar a lista de parcelas não pode virar, sozinho, um gesto de
   * criar conta a pagar. Quem manda é o botão da tela de boletos, como sempre foi.
   */
  reenviar?: boolean
  ctx: AuthContext
  userId?: string | null
}

export interface RenegociarResult {
  contasCanceladas: number
  valorCancelado: number
  parcelasNovas: number
  contasCriadas: number
  renegociacaoId: string
  avisos: string[]
}

export async function renegociarParcelasDaNota(
  input: RenegociarInput,
  db: PrismaClient = defaultPrisma,
): Promise<RenegociarResult> {
  const atual = await combinadoDaNota(input.companyId, input.nfeId, db)
  if (!atual) throw new CombinadoError('Nota não encontrada nesta empresa.')

  const propostas: ParcelaCombinada[] = input.parcelas.map((p, i) => ({
    numero: numeroRenegociado(i),
    valor: round2(Number(p.valor)),
    dVenc: p.dVenc,
    origem: 'RENEGOCIADO',
  }))
  const validacao = validarCombinado({
    parcelas: propostas, totalNota: atual.totalNota, motivo: input.motivo, hoje: new Date(),
  })
  if (!validacao.podeGravar) throw new CombinadoError(validacao.erros.join(' '))

  // ── o que já foi pro financeiro por esta nota ──
  const links = await db.stockPayableLink.findMany({
    where: { companyId: input.companyId, origem: 'NFE', refId: input.nfeId },
    select: { id: true, transactionId: true, valor: true, nDup: true },
  })
  const contas = links.length
    ? await db.transaction.findMany({
        where: { id: { in: links.map((l) => l.transactionId) } },
        select: {
          id: true, description: true, amount: true, lifecycle: true,
          paymentDate: true, reconciledWithId: true, reconcileGroupId: true, dueDate: true,
        },
      })
    : []

  // ⛔ A LINHA VERMELHA
  const intocaveis = contas.filter(
    (c) => c.reconciledWithId !== null || c.reconcileGroupId !== null || c.paymentDate !== null || c.lifecycle === 'EFFECTED',
  )
  if (intocaveis.length) {
    const lista = intocaveis
      .map((c) => `${c.description} (${brl(round2(c.amount))}${c.paymentDate ? `, paga em ${c.paymentDate.toISOString().slice(0, 10)}` : ', conciliada'})`)
      .join(' · ')
    throw new CombinadoError(
      `Esta nota tem ${intocaveis.length} parcela(s) JÁ PAGA(S) ou conciliada(s) — não dá pra reescrever dinheiro que já saiu: ${lista}. ` +
        `Renegocie só o que resta: lance as parcelas novas considerando o que já foi pago.`,
    )
  }

  const renegociacaoId = novaRenegociacaoId()
  const idsContas = contas.map((c) => c.id)
  const valorCancelado = round2(contas.reduce((s, c) => s + c.amount, 0))

  await db.$transaction(async (tx) => {
    if (idsContas.length) {
      // ⚠️ conta a pagar pendente NÃO tocou saldo (nasce sem bankAccount e sem paymentDate),
      // então apagar não mexe em saldo nenhum — diferente da exclusão de uma tx efetivada.
      await tx.transaction.deleteMany({ where: { id: { in: idsContas } } })
      await tx.stockPayableLink.deleteMany({ where: { id: { in: links.map((l) => l.id) } } })
    }
    await gravarCombinadoNaTx(
      tx, input.companyId, input.nfeId, propostas, input.motivo ?? null, renegociacaoId, input.userId ?? null,
    )
  })

  const out: RenegociarResult = {
    contasCanceladas: idsContas.length,
    valorCancelado,
    parcelasNovas: propostas.length,
    contasCriadas: 0,
    renegociacaoId,
    avisos: validacao.avisos,
  }

  // ⚠️ recria SÓ o que foi cancelado (ver o comentário do campo `reenviar`)
  if (input.reenviar !== false && idsContas.length > 0) {
    // as sugestões novas nasceram no gravarCombinadoNaTx e nenhuma tem link (acabamos de
    // apagar todos) → a ponte manda todas, pela MESMA função de sempre (REGRA 4).
    const sugestoes = await db.stockPayableSuggestion.findMany({
      where: { companyId: input.companyId, nfeId: input.nfeId },
      select: { id: true },
    })
    const envio = await enviarParaContasPagar(
      {
        companyId: input.companyId,
        suggestionIds: sugestoes.map((s) => s.id),
        cadastrarFornecedores: true, // o fornecedor já existe (a nota já tinha ido antes)
        ctx: input.ctx,
        userId: input.userId ?? undefined,
      },
      db,
    )
    out.contasCriadas = envio.criadas
    if (envio.erros.length) out.avisos.push(...envio.erros.map((e) => e.motivo))
  }

  return out
}
