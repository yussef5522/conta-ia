// Sprint Cartao Credito PJ (24/06/2026) — POST .../importar-fatura/preview
//
// Recebe PDF da fatura, chama Claude Vision, sugere categorias, detecta
// duplicatas, confere totais. Retorna tudo pra UI conferir antes do confirm.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { checkCreditCardPjFlag } from '@/lib/credit-card-pj/feature-flag'
import { extractInvoiceSmart } from '@/lib/credit-card-pj/extract-invoice-smart'
import { CreditCardPjExtractError } from '@/lib/credit-card-pj/types'
import { checkInvoiceTotals } from '@/lib/credit-card-pj/totals-check'
import { suggestCategoriesForInvoiceLines } from '@/lib/credit-card-pj/suggest-category'
import { getOrCreateCardWithdrawalCategory } from '@/lib/credit-card-pj/card-withdrawal-category'
import { identidadeDaLinha } from '@/lib/credit-card-pj/identidade-da-linha'
import { findCardPaymentCandidatesInBank } from '@/lib/credit-card-pj/queries'
import { guardarNaQuarentena } from '@/lib/credit-card/quarentena-fatura'

interface Params { params: Promise<{ id: string; cardId: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const gate = checkCreditCardPjFlag()
  if (!gate.allowed) {
    return NextResponse.json(
      { erro: gate.message, code: 'CREDIT_CARD_PJ_DISABLED' },
      { status: 403 },
    )
  }

  const { id: companyId, cardId } = await params
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json(
      { erro: 'Sessão expirada ou não autenticado', code: 'AUTH_REQUIRED' },
      { status: 401 },
    )
  }

  // Acesso: empresa + cartao
  const card = await prisma.businessCreditCard.findFirst({
    where: {
      id: cardId,
      companyId,
      company: { users: { some: { userId: user.sub } } },
    },
  })
  if (!card) {
    return NextResponse.json({ erro: 'Cartão não encontrado' }, { status: 404 })
  }

  // Carrega categorias da empresa (pra UI montar dropdowns)
  const categories = await prisma.category.findMany({
    where: { companyId, isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, type: true, dreGroup: true, color: true },
  })

  // Carrega o PDF
  let pdfBytes: Uint8Array
  let fileName = 'fatura.pdf'
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!file || typeof file === 'string') {
      return NextResponse.json({ erro: 'Arquivo PDF não enviado' }, { status: 400 })
    }
    fileName = (file as File).name || 'fatura.pdf'
    pdfBytes = new Uint8Array(await (file as File).arrayBuffer())
  } catch {
    return NextResponse.json({ erro: 'Erro ao ler arquivo' }, { status: 400 })
  }

  // Extração: pdftotext determinístico PRIMEIRO (Sicredi), Vision só como fallback.
  let result
  try {
    result = await extractInvoiceSmart({ pdfBytes, fileName })
  } catch (err: unknown) {
    if (err instanceof CreditCardPjExtractError) {
      /**
       * ⭐⭐⭐ A QUARENTENA CHEGOU AO CAMINHO DA EMPRESA (16/09/2026).
       *
       * ⛔⛔ Ela nasceu no import PF e **o import PJ ficou de fora** — *"N caminhos, 1
       * esquecido"*, a doença que este projeto mais paga, agora entre dois imports de
       * fatura. O efeito foi caro e concreto: a fatura do dono entra POR AQUI, a recusa
       * jogava o texto fora, e eu passei duas rodadas consertando o parser **PF** achando
       * que o documento vinha de lá. *Sem o texto, o diagnóstico vira adivinhação.*
       *
       * ⚠️ Fail-soft: guardar é diagnóstico. Uma falha aqui não pode mudar a resposta que
       * o dono recebe.
       */
      void guardarNaQuarentena({
        companyId, cardId, banco: card.name,
        desfecho: 'RECUSADA', motivo: err.message,
        declarado: null, calculado: null,
        texto: err.texto ?? '', linhas: 0, criadoPorId: user.sub,
      })
      const code = err.code
      // Mensagens ACIONÁVEIS (BUG B): timeout/truncamento/validação não são "erro
      // genérico" — dizem o que fazer. 422 = "li mas não fecha / grande demais".
      const status =
        code === 'NOT_A_PDF' || code === 'FILE_TOO_LARGE' || code === 'NO_FILE' || code === 'ENCRYPTED_PDF'
          ? 400
          : code === 'CLAUDE_TIMEOUT'
            ? 504
            : code === 'VALIDATION_FAILED' || code === 'CLAUDE_TRUNCATED'
              ? 422
              : 500
      return NextResponse.json({ erro: err.message, code, checks: (err.details ?? null) }, { status })
    }
    console.error('[credit-card-pj/preview] erro inesperado:', err)
    return NextResponse.json({ erro: 'Erro ao processar fatura' }, { status: 500 })
  }

  const { extraction, metrics } = result

  /**
   * ⭐ E A QUE FECHOU TAMBÉM FICA GUARDADA — é o **golden de amanhã**. Foi por não ter os
   * PDFs antigos que o congelador nasceu com 9 fixtures em vez do histórico inteiro.
   * ⚠️ Só quando houve texto: leitura por Vision não produz documento pra congelar.
   */
  if (result.texto) {
    void guardarNaQuarentena({
      companyId, cardId, banco: extraction.detectedBank ?? card.name,
      desfecho: 'OK', motivo: null,
      declarado: extraction.totalDeclared ?? null, calculado: null,
      texto: result.texto, linhas: extraction.lines?.length ?? 0, criadoPorId: user.sub,
    })
  }

  // Sugestoes de categoria (reusa pipeline IA do OFX)
  const suggestions = await suggestCategoriesForInvoiceLines(extraction.lines, {
    companyId,
  })

  // Totais
  const totals = checkInvoiceTotals(extraction)

  // Dedup: pra cada linha que ENTRA (nao IGNORAR), calcula identity contra
  // o "ledger" da conta cartao. Como cartao nao tem fitidKey, dedup eh
  // por contentHash (cross-format) usando businessCreditCardId como scope.
  // ⛔⛔ AQUI MORAVA `type: 'DEBIT'` CRAVADO (17/09) — e o confirm usava o tipo de verdade.
  // Estorno gravado como CREDIT nunca casava com o hash DEBIT do preview: a tela dizia
  // "novo" pro que já estava gravado. Agora a conta é UMA (`identidadeDaLinha`).
  const lineHashes = extraction.lines.map((line) =>
    identidadeDaLinha(cardId, {
      date: line.date,
      description: line.description,
      amount: line.amount,
      kind: line.suggestedKind,
    }),
  )

  // Carrega tx existentes da MESMA conta cartao com contentHash batendo
  const existingHashes = new Set<string>()
  /**
   * ⭐⭐ O ESTADO "JÁ IMPORTADA" PRECISA CHEGAR NA TELA (17/09/2026).
   *
   * ⛔ Sem isto a tela de uma fatura inteiramente duplicada continuava com **cara de import
   * pendente** — tabela completa, checkbox em tudo, botão *"Confirmar e importar 0"* — e o
   * dono *"quase confirmou duas vezes achando que faltava algo"*. ⚠️ A informação existia
   * (as linhas vinham `isDuplicate`), mas espalhada por 33 linhas: **ninguém lê 33 selos
   * pra concluir "não tem nada a fazer aqui"**. Quem conclui é a tela.
   */
  const jaNoSistema: { importadaEm: Date | null; invoiceMonth: string | null } = {
    importadaEm: null, invoiceMonth: null,
  }
  if (lineHashes.length > 0) {
    const dups = await prisma.transaction.findMany({
      where: {
        businessCreditCardId: cardId,
        contentHash: { in: lineHashes },
      },
      // ⭐ a data e o mês vêm junto: a tela precisa dizer QUANDO entrou e pra ONDE levar
      select: { contentHash: true, createdAt: true, invoiceMonth: true },
    })
    for (const d of dups) {
      if (d.contentHash) existingHashes.add(d.contentHash)
      if (!jaNoSistema.importadaEm || d.createdAt < jaNoSistema.importadaEm) jaNoSistema.importadaEm = d.createdAt
      if (!jaNoSistema.invoiceMonth && d.invoiceMonth) jaNoSistema.invoiceMonth = d.invoiceMonth
    }
  }

  // Detector de "pagamento ja registrado como despesa" — busca candidatos
  // pelos 2 valores possiveis da fatura (totalToPay = valor que sai do banco;
  // totalDeclared = soma das compras+encargos do periodo). Caso real R$ 2.654,63.
  // Sempre busca tambem pagamentos aguardando (isCardPayment=true sem cardId).
  const targetTotals: number[] = []
  if (extraction.totalToPay && extraction.totalToPay > 0) {
    targetTotals.push(extraction.totalToPay)
  }
  if (
    extraction.totalDeclared &&
    extraction.totalDeclared > 0 &&
    Math.abs(extraction.totalDeclared - (extraction.totalToPay ?? 0)) > 0.02
  ) {
    targetTotals.push(extraction.totalDeclared)
  }
  const paymentCandidates = await findCardPaymentCandidatesInBank(
    companyId,
    targetTotals,
  )

  // Sprint Cartao-Uso-Pessoal: cartão marcado PESSOAL_SOCIO → as compras nascem como
  // RETIRADA (Distribuição, fora do DRE). NUNCA silencioso — a tela grita (banner +
  // categoria visível + resumo). Aqui só resolvemos a categoria e o nome do sócio.
  const isPersonalCard = card.defaultTreatment === 'PESSOAL_SOCIO'
  let withdrawalCategoryId: string | null = null
  let socioNome: string | null = null
  if (isPersonalCard) {
    withdrawalCategoryId = await getOrCreateCardWithdrawalCategory(prisma, companyId)
    if (card.socioPFId) {
      const socio = await prisma.socioPF.findFirst({
        where: { id: card.socioPFId, companyId },
        select: { nome: true },
      })
      socioNome = socio?.nome ?? null
    }
    console.log('[credit-card-pj/preview] CARD_DEFAULT=PESSOAL_SOCIO aplicado', {
      cardId, socioNome, withdrawalCategoryId, linhas: extraction.lines.length,
    })
  }

  // Log observabilidade
  console.log('[credit-card-pj/preview]', {
    companyId,
    cardId,
    fileName,
    cardTreatment: card.defaultTreatment,
    source: result.source, // PDFTEXT (determinístico) vs VISION (fallback)
    pdfSize: metrics.pdfSize,
    durationMs: metrics.durationMs,
    inputTokens: metrics.inputTokens,
    outputTokens: metrics.outputTokens,
    linhas: extraction.lines.length,
    duplicatas: existingHashes.size,
    paymentCandidates: paymentCandidates.length,
  })

  return NextResponse.json({
    card: {
      id: card.id,
      name: card.name,
      bankName: card.bankName,
      lastDigits: card.lastDigits,
      creditLimit: card.creditLimit,
    },
    // Sprint Cartao-Uso-Pessoal: pra tela GRITAR o default (banner + resumo).
    cardTreatment: card.defaultTreatment, // OPERACIONAL | PESSOAL_SOCIO
    withdrawalCategoryId, // categoria "Retirada via cartão" quando pessoal
    socioNome, // nome do sócio dono (pro banner)
    extraction: {
      dueDate: extraction.dueDate,
      closingDate: extraction.closingDate,
      totalDeclared: extraction.totalDeclared,
      totalToPay: extraction.totalToPay,
      creditLimit: extraction.creditLimit,
      availableLimit: extraction.availableLimit,
      detectedBank: extraction.detectedBank,
      cardLastDigitsFound: extraction.cardLastDigitsFound,
      scanQuality: extraction.scanQuality,
      notes: extraction.notes,
    },
    totals,
    lines: extraction.lines.map((line, idx) => {
      const sugg = suggestions.perIndex.get(idx) ?? {
        categoryId: null,
        source: 'NONE' as const,
        confidence: 0,
      }
      // Cartão pessoal: a compra/encargo nasce como RETIRADA (default por config,
      // NÃO palpite de IA). Estorno fica crédito; IGNORAR não recebe. O usuário
      // reclassifica as operacionais (exceção). source CARD_DEFAULT deixa a tela
      // mostrar que veio da config do cartão, não de uma escolha automática duvidosa.
      // Inclui ESTORNO: ele também vai pra fila A_CLASSIFICAR (categoria consistente,
      // não "SEM CATEGORIA"). Como é CREDIT, subtrai no total/DRE. IGNORAR fica de fora.
      const applyWithdrawal =
        isPersonalCard && withdrawalCategoryId != null && line.suggestedKind !== 'IGNORAR'
      const effCategoryId = applyWithdrawal ? withdrawalCategoryId : sugg.categoryId
      const effSource = applyWithdrawal ? ('CARD_DEFAULT' as const) : sugg.source
      return {
        index: idx,
        date: line.date,
        description: line.description,
        amount: line.amount,
        suggestedKind: line.suggestedKind,
        installmentNumber: line.installmentNumber ?? null,
        installmentTotal: line.installmentTotal ?? null,
        cardLastDigits: line.cardLastDigits ?? null,
        needsReview: line.needsReview === true,
        note: line.note ?? null,
        // Dedup
        contentHash: lineHashes[idx],
        isDuplicate: existingHashes.has(lineHashes[idx]),
        // Sugestao de categoria (CARD_DEFAULT quando cartão pessoal)
        suggestedCategoryId: effCategoryId,
        suggestedCategorySource: effSource,
        suggestedConfidence: applyWithdrawal ? 1 : sugg.confidence,
      }
    }),
    categories,
    /**
     * ⭐ O RESUMO DO "JÁ ESTÁ LÁ" — um lugar só, pra tela não ter que deduzir de 33 linhas.
     * ⚠️ `todasDuplicatas` é a pergunta que muda a CARA da tela; as duas contagens são o que
     * o caso misto precisa mostrar ("N novas · M já no sistema").
     */
    jaNoSistema: {
      duplicatas: extraction.lines.filter((_, i) => existingHashes.has(lineHashes[i])).length,
      novas: extraction.lines.filter((_, i) => !existingHashes.has(lineHashes[i])).length,
      todasDuplicatas: extraction.lines.length > 0
        && extraction.lines.every((_, i) => existingHashes.has(lineHashes[i])),
      importadaEm: jaNoSistema.importadaEm ? jaNoSistema.importadaEm.toISOString() : null,
      invoiceMonth: jaNoSistema.invoiceMonth,
    },
    counts: {
      total: extraction.lines.length,
      compraAvista: extraction.lines.filter((l) => l.suggestedKind === 'COMPRA_AVISTA').length,
      compraParcelada: extraction.lines.filter((l) => l.suggestedKind === 'COMPRA_PARCELADA').length,
      encargo: extraction.lines.filter((l) => l.suggestedKind === 'ENCARGO_FINANCEIRO').length,
      estorno: extraction.lines.filter((l) => l.suggestedKind === 'ESTORNO').length,
      ignorar: extraction.lines.filter((l) => l.suggestedKind === 'IGNORAR').length,
      duplicatas: existingHashes.size,
      precisaRevisar: extraction.lines.filter((l) => l.needsReview).length,
    },
    /**
     * Candidatos a "este pagamento já foi importado como despesa antes" —
     * UI mostra avisa pro user marcar pra RECLASSIFICAR como TRANSFER.
     * Score: 0-1, mais alto = melhor match. Calculado pelo proximidade do
     * valor com totalToPay (preferido) ou totalDeclared (fallback).
     */
    paymentCandidates: paymentCandidates
      .map((c) => {
        // Match score: proximidade do valor + isCardPayment ja marcado
        let matchScore = 0
        if (extraction.totalToPay && extraction.totalToPay > 0) {
          const diff = Math.abs(c.amount - extraction.totalToPay)
          if (diff <= 0.02) matchScore = 1.0
          else if (diff <= 1.0) matchScore = 0.9
        }
        if (matchScore < 0.5 && extraction.totalDeclared && extraction.totalDeclared > 0) {
          const diff = Math.abs(c.amount - extraction.totalDeclared)
          if (diff <= 0.02) matchScore = Math.max(matchScore, 0.95)
          else if (diff <= 1.0) matchScore = Math.max(matchScore, 0.85)
        }
        // Boost pequeno se ja marcado pelo hook (isCardPayment=true aguardando)
        if (c.isCardPayment) matchScore = Math.max(matchScore, 0.7)
        return {
          id: c.id,
          date: c.date.toISOString().slice(0, 10),
          description: c.description,
          amount: c.amount,
          bankAccountId: c.bankAccountId,
          bankAccountName: c.bankAccount?.name ?? null,
          currentCategoryName: c.category?.name ?? null,
          isAlreadyMarkedPayment: c.isCardPayment,
          matchScore,
        }
      })
      .sort((a, b) => b.matchScore - a.matchScore),
    metrics: {
      durationMs: metrics.durationMs,
      model: metrics.model,
      inputTokens: metrics.inputTokens,
      outputTokens: metrics.outputTokens,
    },
  })
}
