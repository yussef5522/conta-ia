import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { transacaoUpdateSchema } from '@/lib/validations/transacao'
import { montarUpdateClassificacaoManual } from '@/lib/transacoes/classificar'
import { enforceStatusLadder } from '@/lib/transacoes/needs-review'
import { SELECT_VINCULO_MINIMO, temVinculoDeGesto } from '@/lib/conciliacao/carimbar-vinculo'
import { getAuthContext } from '@/lib/auth/rbac'
import { logAudit, diffFields } from '@/lib/audit'
import { handleApiError } from '@/lib/api/handle-error'
import { recordRuleOverride } from '@/lib/ai-categorizer/apply'
import { autoMemorizeVendor } from '@/lib/categorization/auto-memorize-vendor'
import { counterpartyRulePattern, CONTRAPARTE_TIPO_MATCH } from '@/lib/counterparty/rules'
import { recomputeVendasSeVenda } from '@/lib/vendas/recompute-hook'
import { reAncorarContas } from '@/lib/balance/recalcular'
import { prepararMudancaDeConta, MoverDeContaError, podeExcluirLancamento } from '@/lib/transacoes/mover-de-conta'

interface Params { params: Promise<{ id: string }> }

async function carregarTransacao(transacaoId: string) {
  return prisma.transaction.findUnique({
    where: { id: transacaoId },
    include: {
      bankAccount: { select: { id: true, companyId: true } },
      category: { select: { id: true, name: true, color: true, type: true } },
    },
  })
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const transacao = await carregarTransacao(id)
    if (!transacao) return NextResponse.json({ erro: 'Transação não encontrada' }, { status: 404 })
    // Sprint 4.0.1.a — rotas genéricas só lidam com EFFECTED (tx vinda do OFX ou manual já paga).
    // PAYABLE/RECEIVABLE pendentes têm endpoints próprios em /api/contas-a-pagar e /contas-a-receber.
    if (!transacao.bankAccount) {
      return NextResponse.json(
        { erro: 'Use /api/contas-a-pagar/[id] ou /api/contas-a-receber/[id] pra lançamentos pendentes' },
        { status: 422 },
      )
    }

    const ctx = await getAuthContext(request, transacao.bankAccount.companyId)
    ctx.requirePermission('transaction.view')

    return NextResponse.json({ transacao })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const antiga = await carregarTransacao(id)
    if (!antiga) return NextResponse.json({ erro: 'Transação não encontrada' }, { status: 404 })
    if (!antiga.bankAccount || !antiga.bankAccountId) {
      return NextResponse.json(
        { erro: 'Use endpoints de contas a pagar/receber pra lançamentos pendentes' },
        { status: 422 },
      )
    }

    const ctx = await getAuthContext(request, antiga.bankAccount.companyId)
    ctx.requirePermission('transaction.update')

    const body = await request.json()
    const data = transacaoUpdateSchema.parse(body)

    /**
     * ⭐⭐⭐ TROCA DE CONTA (30/09/2026) — a porta que faltava, e ela é do lado do SERVIDOR.
     *
     * A tela tranca o seletor quando a linha não pode se mover, mas **a trava de verdade é
     * aqui**: esconder o campo não impede a chamada, e a régua do FREIO da contagem (23/08)
     * vale igual — aviso que mora no componente some no dia em que a rota for chamada por
     * outro caminho.
     *
     * ⚠️ Recusa vira **422 com `code`**, nunca 500 — a tela age no código e mostra o motivo.
     */
    let mudanca: Awaited<ReturnType<typeof prepararMudancaDeConta>> | null = null
    if (data.bankAccountId && data.bankAccountId !== antiga.bankAccountId) {
      try {
        mudanca = await prepararMudancaDeConta(prisma, {
          transacaoId: id,
          contaDestinoId: data.bankAccountId,
          companyId: antiga.bankAccount.companyId,
        })
      } catch (e) {
        if (e instanceof MoverDeContaError) {
          return NextResponse.json({ erro: e.message, code: e.code }, { status: 422 })
        }
        throw e
      }
    }

    // Sprint Category-Combobox (29/06/2026) — DEFESA EM PROFUNDIDADE.
    //
    // Calcula status final via enforceStatusLadder ANTES do update:
    // - categoryId resultante (data.categoryId se vier, senão atual da tx)
    // - intendedStatus (data.status se vier, senão atual)
    // - accountType da conta (CASH força RECONCILED)
    //
    // Helper aplica:
    //   IGNORED via body → mantém (manual, independente)
    //   CASH → RECONCILED
    //   categoryId NOT NULL → RECONCILED
    //   categoryId NULL → PENDING
    //
    // Impossível body { categoryId: X, status: 'PENDING' } criar estado
    // invertido — o helper recalcula no fim.
    const categoryIdFinal =
      data.categoryId !== undefined ? data.categoryId ?? null : antiga.categoryId
    const intendedStatus =
      data.status !== undefined ? data.status : antiga.status
    const accountTypeBucket = await prisma.bankAccount.findUnique({
      where: { id: antiga.bankAccountId! },
      select: { accountType: true },
    })
    /**
     * ⭐ 27/09 — os vínculos da própria linha: sem eles, **editar a descrição** de um pagamento
     * de empréstimo devolveria ele pra "Pendente" (a escada decide pela categoria, que é nula
     * por desenho). *O defeito voltaria sozinho, em silêncio.*
     */
    const vinculosDaLinha = await prisma.transaction.findUnique({
      where: { id },
      select: SELECT_VINCULO_MINIMO,
    })
    const statusEnforced = enforceStatusLadder({
      intendedStatus: intendedStatus as 'PENDING' | 'RECONCILED' | 'IGNORED',
      categoryId: categoryIdFinal,
      accountType: accountTypeBucket?.accountType ?? null,
      temVinculoDeGesto: vinculosDaLinha ? temVinculoDeGesto(vinculosDaLinha) : false,
    })

    const transacao = await prisma.$transaction(async (tx) => {
      const updated = await tx.transaction.update({
        where: { id },
        data: {
          // Quando categoryId vem no body, é uma classificação manual: setamos
          // todos os metadados de classificação juntos (source, aiConfidence, ruleId)
          // pra manter o contrato da 4.1. Em 4.6, o helper vai ganhar a criação
          // automática de regra.
          ...(data.categoryId !== undefined
            ? montarUpdateClassificacaoManual(data.categoryId ?? null)
            : {}),
          ...(data.date !== undefined ? { date: data.date } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          // Contraparte editada à mão → origem MANUAL (precedência máxima; PDF/OFX
          // nunca sobrescrevem). NÃO afeta saldo/valor/data/categoria.
          ...(data.counterpartyName !== undefined
            ? {
                counterpartyName: data.counterpartyName?.trim() || null,
                counterpartySource: data.counterpartyName?.trim() ? 'MANUAL' : null,
                counterpartyConfidence: data.counterpartyName?.trim() ? 'EXACT' : null,
              }
            : {}),
          ...(data.amount !== undefined ? { amount: data.amount } : {}),
          ...(data.type !== undefined ? { type: data.type } : {}),
          // ⭐ a conta nova (já validada pela fronteira acima)
          ...(mudanca ? { bankAccountId: mudanca.para.id } : {}),
          ...(data.notes !== undefined ? { notes: data.notes ?? null } : {}),
          // Sprint Category-Combobox: status enforced SEMPRE no fim,
          // sobrescreve qualquer tentativa do body. SEM exceção.
          status: statusEnforced,
          // Sprint Fix-IgnoredAt (06/07/2026): sincroniza `ignoredAt` com o
          // `status` final. Antes, o PUT só setava `status='IGNORED'` mas
          // deixava `ignoredAt=NULL` — o filtro NEEDS_REVIEW_WHERE_PRISMA
          // usa `ignoredAt: null` (não `status`), então tx ignoradas voltavam
          // pra tela de Pendentes intermitentemente ("sumiu e voltou").
          //
          // Sempre que o status FINAL é 'IGNORED' e ainda não tinha timestamp,
          // seta agora (idempotente: não sobrescreve `ignoredAt` já existente,
          // preservando o timestamp original quando o user re-ignora).
          //
          // Quando o status sai de IGNORED (ex: reativar via body {status:
          // 'PENDING'}), zera `ignoredAt` — a tx volta a ser considerada
          // "não ignorada" pelos filtros.
          ...(statusEnforced === 'IGNORED'
            ? antiga.ignoredAt
              ? {}
              : { ignoredAt: new Date() }
            : { ignoredAt: null }),
        },
        include: { category: { select: { id: true, name: true, color: true, type: true } } },
      })
      /**
       * ⭐⭐⭐ RE-ANCORA, NUNCA SOMA DELTA (30/09/2026 — item 4, matar a classe do drift).
       *
       * ⛔ Aqui era `balance: { increment: ajusteSaldo }`. Isso drifta o cache sempre que a
       * data da linha é ANTERIOR à âncora do banco: o dinheiro já está dentro do saldo que
       * o banco declarou, e o delta o soma de novo. Foi assim que a Stone ficou 2.112,00
       * acima da régua — e o import culpou o extrato por um drift que era nosso.
       *
       * ⭐ Re-derivar é IDEMPOTENTE: roda sempre, sem condição (`ajusteSaldo !== 0` era mais
       * uma chance de esquecer — editar a DATA não muda o valor e mexe no saldo do mesmo
       * jeito, porque a âncora corta por data).
       *
       * ⚠️ E vai nas DUAS contas quando a linha muda de lugar: uma só deixaria a outra
       * errada na direção oposta.
       */
      await reAncorarContas(tx, [antiga.bankAccountId, mudanca?.para.id])

      const fieldsChanged = diffFields(
        antiga as unknown as Record<string, unknown>,
        updated as unknown as Record<string, unknown>,
        ['description', 'amount', 'date', 'competenceDate', 'paymentDate', 'categoryId', 'type', 'status', 'notes', 'bankAccountId'],
      )

      if (fieldsChanged) {
        await logAudit(
          ctx,
          {
            action: 'UPDATE',
            entityType: 'Transaction',
            entityId: updated.id,
            fieldsChanged,
            metadata: {
              description: updated.description,
              amount: updated.amount,
              // ⭐ o rastro em PALAVRAS: "movida de stone pra caixa loja/cofre". Sem ele, o
              // audit guardaria dois cuids e ninguém saberia o que aconteceu em três meses.
              ...(mudanca ? { mudancaDeConta: mudanca.rastro, deContaId: mudanca.de.id, paraContaId: mudanca.para.id } : {}),
            },
            request,
          },
          tx,
        )
      }

      return updated
    })

    // FASE 4 (01/08): user confirmou categoria numa tx com contraparte e pediu
    // pra criar a regra "contraparte → categoria" (por empresa, nunca global).
    // Upsert idempotente via @@unique([companyId, tipoMatch, padrao]). Fora da
    // $transaction; falha aqui é silenciosa (a categorização já foi salva).
    if (
      data.createCounterpartyRule &&
      categoryIdFinal &&
      antiga.counterpartyName &&
      antiga.bankAccount?.companyId
    ) {
      const padrao = counterpartyRulePattern(antiga.counterpartyName)
      if (padrao) {
        await prisma.aiLearningRule
          .upsert({
            where: {
              companyId_tipoMatch_padrao: {
                companyId: antiga.bankAccount.companyId,
                tipoMatch: CONTRAPARTE_TIPO_MATCH,
                padrao,
              },
            },
            create: {
              companyId: antiga.bankAccount.companyId,
              tipoMatch: CONTRAPARTE_TIPO_MATCH,
              padrao,
              categoryId: categoryIdFinal,
              fonte: 'MANUAL',
              confianca: 1.0,
            },
            update: { categoryId: categoryIdFinal, isActive: true },
          })
          .catch((e) => console.error('[contraparte-rule] upsert falhou:', e?.message))
      }
    }

    // Fase 3 Etapa 1: se a tx ANTIGA foi classificada por regra E o user
    // MUDOU a categoria (override), penaliza a regra (cai confiança).
    // Fora da $transaction pra não bloquear retorno; failure aqui é silencioso.
    if (
      antiga.classifiedByRuleId &&
      antiga.classificationSource === 'RULE' &&
      data.categoryId !== undefined &&
      data.categoryId !== antiga.categoryId
    ) {
      try {
        await recordRuleOverride(
          antiga.classifiedByRuleId,
          ctx,
          request,
          id,
        )
      } catch (e) {
        console.error('[RULE OVERRIDE] Falha registrar penalidade:', e)
      }
    }

    // Sprint 5.0.2.m — Memória Automática de Fornecedor (QuickBooks-style).
    // Sempre que user categoriza manualmente (categoryId vem no body), extrai
    // anchor word, cria/atualiza regra CONTAINS silenciosa, aplica retroativo.
    let vendorMemory: { anchor: string | null; retroactiveCount: number } = {
      anchor: null,
      retroactiveCount: 0,
    }
    if (
      data.categoryId !== undefined &&
      data.categoryId !== null &&
      data.categoryId !== antiga.categoryId
    ) {
      try {
        const result = await autoMemorizeVendor({
          companyId: antiga.bankAccount.companyId,
          baseTransactionId: id,
          baseDescription: transacao.description,
          categoryId: data.categoryId,
          baseType: transacao.type,
        })
        vendorMemory = {
          anchor: result.anchor,
          retroactiveCount: result.retroactiveCount,
        }
        if (result.anchor) {
          console.log(
            `[AUTO_MEMORIZE] company=${antiga.bankAccount.companyId} ` +
              `anchor="${result.anchor}" retroactive=${result.retroactiveCount} ` +
              `ruleCreated=${result.ruleCreated}`,
          )
        }
      } catch (e) {
        // Silencioso — falha de memória não bloqueia categorização
        console.error('[AUTO_MEMORIZE] erro:', e)
      }
    }

    // GATILHO DE VENDAS (fail-soft): se a categoria (antiga OU nova) é venda, o
    // recompute atualiza a VendaDiaria. Por companyId, nunca global; nunca derruba
    // a resposta (o juiz noturno pega). recategorizar venda→não-venda também dispara.
    if (antiga.bankAccount?.companyId) {
      await recomputeVendasSeVenda(prisma, antiga.bankAccount.companyId, [antiga.categoryId, categoryIdFinal], 'PATCH /api/transacoes/[id]')
    }

    /**
     * ⭐ A COMPETÊNCIA ANDOU? A tela precisa DIZER, não descobrir depois. A régua de
     * recebimento é POR CONTA (dinheiro no cofre é D+1 corrido, PIX na Stone é D+0), então
     * a mesma venda vale por outro dia dependendo de onde o dinheiro entrou. Mexer no
     * calendário em silêncio seria a família do "gravou e não disse".
     */
    return NextResponse.json({
      transacao,
      vendorMemory,
      ...(mudanca
        ? { mudancaDeConta: { ...mudanca, rastro: mudanca.rastro } }
        : {}),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const transacao = await carregarTransacao(id)
    if (!transacao) return NextResponse.json({ erro: 'Transação não encontrada' }, { status: 404 })
    if (!transacao.bankAccount || !transacao.bankAccountId) {
      return NextResponse.json(
        { erro: 'Use endpoints de contas a pagar/receber pra lançamentos pendentes' },
        { status: 422 },
      )
    }

    const ctx = await getAuthContext(request, transacao.bankAccount.companyId)
    ctx.requirePermission('transaction.delete')

    /**
     * ⭐⭐⭐ A FRONTEIRA DO EXCLUIR (30/09/2026) — e ela FALTAVA por completo.
     *
     * ⛔⛔ Este DELETE apagava **qualquer coisa**: linha de extrato, perna de transferência,
     * conta a pagar conciliada. Não havia botão na tela, então nunca mordeu — mas a rota
     * estava aberta, e o sprint acabou de pôr o botão. *Gesto novo em rota sem fronteira é
     * o estrago esperando a maçaneta.*
     *
     * ⚠️ É a MESMA allowlist do mover (`podeExcluirLancamento` reusa `ORIGENS_QUE_MOVEM`):
     * duas listas divergiriam na primeira origem nova, e um gesto permitiria sobre a mesma
     * linha o que o outro recusa.
     */
    const veredito = podeExcluirLancamento({
      origin: transacao.origin,
      reconciledWithId: transacao.reconciledWithId,
      transferGroupId: transacao.transferGroupId,
      type: transacao.type,
      lifecycle: transacao.lifecycle,
    })
    if (!veredito.pode) {
      return NextResponse.json({ erro: veredito.explicacao, code: veredito.motivo }, { status: 422 })
    }

    /**
     * ⭐ O MOTIVO VAI NO RASTRO. Excluir é irreversível (não há lixeira pra `Transaction`
     * EFFECTED), então o audit é o único lugar onde o "por quê" sobrevive — e é ele que o
     * contador vai ler em três meses. Opcional de propósito: cerimônia afasta, e o dono
     * escreve quando importa.
     */
    const motivo = new URL(request.url).searchParams.get('motivo')?.trim() || null

    const contaAfetada = transacao.bankAccountId!

    await prisma.$transaction(async (tx) => {
      await tx.transaction.delete({ where: { id } })
      // ⭐ item 4: re-ancora em vez de somar o reverso. Apagar uma linha ANTERIOR à âncora
      // com `increment` fazia o cache cair por um valor que o saldo declarado já não tinha —
      // o drift do mesmo mecanismo, na direção oposta.
      await reAncorarContas(tx, [contaAfetada])
      await logAudit(
        ctx,
        {
          action: 'DELETE',
          entityType: 'Transaction',
          entityId: id,
          metadata: {
            description: transacao.description,
            amount: transacao.amount,
            type: transacao.type,
            data: transacao.date.toISOString().slice(0, 10),
            bankAccountId: contaAfetada,
            origin: transacao.origin,
            categoryId: transacao.categoryId,
            // ⭐ o porquê, em palavras — o único lugar onde ele sobrevive à exclusão
            ...(motivo ? { motivo } : {}),
          },
          request,
        },
        tx,
      )
    })

    return NextResponse.json({ mensagem: 'Transação excluída com sucesso' })
  } catch (error) {
    return handleApiError(error)
  }
}

// ⛔⛔ `calcularAjusteSaldo` FOI REMOVIDA (30/09/2026) — ela calculava o DELTA pra somar no
// cache, e é justamente o que o item 4 aposentou. Deixá-la aqui sem chamador seria o campo
// decorativo que alguém religa por descuido (a lição do `registry.parse`, que ficou com
// ZERO chamadores e escondeu o fallback silencioso do parser por semanas).
// Quem responde "qual é o saldo?" agora é `recalcularSaldoConta`, derivando.
