// Sprint Asaas FATIA 3C (02/06/2026) — POST /api/webhooks/asaas
//
// Recebe eventos do Asaas. Fluxo:
//   1. Valida header `asaas-access-token` (timingSafeEqual) → 401 se inválido
//   2. Parse body JSON
//   3. Idempotência: se asaasEventId já existe em WebhookEvent → 200 imediato
//   4. Cria WebhookEvent (status=RECEIVED) — UNIQUE garante race-safety
//   5. Roteia por event type:
//        - ACTIVATE  → Subscription.status=ACTIVE + currentPeriodEnd estende
//        - PAST_DUE  → Subscription.status=PAST_DUE
//        - CANCEL    → Subscription.status=CANCELED + canceledAt
//        - IGNORE    → grava como IGNORED (auditoria)
//   6. Marca status final (PROCESSED / IGNORED / ERROR)
//   7. Retorna 200 (exceto auth fail = 401)
//
// 🛡️ Segurança:
//   - Token NUNCA aparece em log
//   - Subscription não localizada → ERROR + 200 (não trava fila Asaas)
//   - Doc Asaas: 15 falhas consecutivas pausam a fila

import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import {
  validateAsaasToken,
  parseExternalReference,
  calculateNextPeriodEnd,
  routeEvent,
} from '@/lib/asaas/webhook'
import type {
  AsaasWebhookEvent,
  WebhookEventStatus,
} from '@/lib/asaas/types'

const ACCESS_TOKEN_HEADER = 'asaas-access-token'

interface IdentifiedSubscription {
  id: string
  userId: string
  status: string
  currentPeriodEnd: Date | null
  gatewaySubscriptionId: string | null
}

export async function POST(request: NextRequest) {
  // ============================================================
  // 1. Validação de origem
  // ============================================================
  const expected = (process.env.ASAAS_WEBHOOK_TOKEN ?? '').trim()
  if (!expected) {
    // Config faltando — falha fechada. Loga sem expor nada.
    console.error('[webhook] ASAAS_WEBHOOK_TOKEN não configurado')
    return new NextResponse('Unauthorized', { status: 401 })
  }
  const received = request.headers.get(ACCESS_TOKEN_HEADER)
  if (!validateAsaasToken(received, expected)) {
    console.error('[webhook] auth fail', {
      hasHeader: !!received,
      // NUNCA loga o conteúdo do token recebido nem o esperado.
    })
    return new NextResponse('Unauthorized', { status: 401 })
  }

  // ============================================================
  // 2. Parse body
  // ============================================================
  let body: AsaasWebhookEvent
  try {
    body = (await request.json()) as AsaasWebhookEvent
  } catch {
    console.error('[webhook] body JSON inválido')
    return NextResponse.json({ ok: false, erro: 'Invalid JSON' }, { status: 400 })
  }

  const asaasEventId = body?.id
  const eventType = body?.event
  if (!asaasEventId || !eventType) {
    console.error('[webhook] body sem id/event', {
      hasId: !!asaasEventId,
      hasEvent: !!eventType,
    })
    return NextResponse.json(
      { ok: false, erro: 'Body must include id and event' },
      { status: 400 },
    )
  }

  // ============================================================
  // 3. Idempotência (fast path)
  // ============================================================
  const existing = await prisma.webhookEvent.findUnique({
    where: { asaasEventId },
    select: { id: true, status: true },
  })
  if (existing) {
    console.log('[webhook] idempotent skip', {
      asaasEventId,
      eventType,
      previousStatus: existing.status,
    })
    return NextResponse.json({
      ok: true,
      eventId: asaasEventId,
      status: 'IDEMPOTENT_SKIP',
    })
  }

  // ============================================================
  // 4. Roteia + processa
  // ============================================================
  const action = routeEvent(eventType)
  const paymentId = body.payment?.id ?? null
  const payloadStr = JSON.stringify(body)

  // Caso IGNORE: grava + retorna sem processar
  if (action === 'IGNORE') {
    await safeCreateWebhookEvent({
      asaasEventId,
      eventType,
      paymentId,
      subscriptionId: null,
      payload: payloadStr,
      status: 'IGNORED',
      errorMessage: null,
    })
    return NextResponse.json({
      ok: true,
      eventId: asaasEventId,
      status: 'IGNORED',
    })
  }

  // Casos com efeito → precisa identificar Subscription
  const identified = await identifySubscription(body)
  if (!identified) {
    console.warn('[webhook] subscription não localizada', {
      asaasEventId,
      eventType,
      paymentId,
      // externalReference é controlado por nós — seguro pra log de debug
      externalReference: body.payment?.externalReference ?? null,
      asaasCustomerId: body.payment?.customer ?? null,
      asaasSubscriptionId: body.payment?.subscription ?? null,
    })
    await safeCreateWebhookEvent({
      asaasEventId,
      eventType,
      paymentId,
      subscriptionId: null,
      payload: payloadStr,
      status: 'ERROR',
      errorMessage: 'Subscription não localizada (externalReference/gatewayIds não bateram).',
    })
    // 200 pra Asaas não travar fila (15 falhas consecutivas pausam)
    return NextResponse.json({
      ok: true,
      eventId: asaasEventId,
      status: 'ERROR',
    })
  }

  // Aplica efeito + grava WebhookEvent no MESMO atomic
  try {
    await prisma.$transaction(async (tx) => {
      // Cria WebhookEvent (race-safe via UNIQUE em asaasEventId)
      await tx.webhookEvent.create({
        data: {
          asaasEventId,
          eventType,
          paymentId,
          subscriptionId: identified.id,
          payload: payloadStr,
          status: 'PROCESSED',
          processedAt: new Date(),
        },
      })

      if (action === 'ACTIVATE') {
        const ciclo = inferCiclo(body) ?? 'MONTHLY'
        const now = new Date()
        const newPeriodEnd = calculateNextPeriodEnd(
          identified.currentPeriodEnd,
          ciclo,
          now,
        )
        // Set gatewaySubscriptionId lazy: só se ainda não setado e veio
        // no payload (cartão recorrente). Pix não tem.
        const newGwSubId =
          identified.gatewaySubscriptionId ?? body.payment?.subscription ?? null

        await tx.subscription.update({
          where: { id: identified.id },
          data: {
            status: 'ACTIVE',
            currentPeriodEnd: newPeriodEnd,
            gatewaySubscriptionId: newGwSubId,
            canceledAt: null, // limpa cancel anterior se for reativação
          },
        })
      } else if (action === 'PAST_DUE') {
        await tx.subscription.update({
          where: { id: identified.id },
          data: { status: 'PAST_DUE' },
        })
      } else if (action === 'CANCEL') {
        await tx.subscription.update({
          where: { id: identified.id },
          data: {
            status: 'CANCELED',
            canceledAt: new Date(),
          },
        })
      }
    })

    console.log('[webhook] processed', {
      asaasEventId,
      eventType,
      action,
      subscriptionId: identified.id,
    })
    return NextResponse.json({
      ok: true,
      eventId: asaasEventId,
      status: 'PROCESSED',
      action,
    })
  } catch (err) {
    // Race: outro request criou o WebhookEvent no meio. Idempotência
    // garantida pela UNIQUE. Tratamos como sucesso.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      console.log('[webhook] race idempotent (P2002)', {
        asaasEventId,
        eventType,
      })
      return NextResponse.json({
        ok: true,
        eventId: asaasEventId,
        status: 'IDEMPOTENT_RACE',
      })
    }
    // Outro erro inesperado: registra como ERROR mas retorna 200 pra
    // Asaas não travar fila. Investigação manual via logs.
    const msg = err instanceof Error ? err.message : 'unknown error'
    console.error('[webhook] processamento falhou', {
      asaasEventId,
      eventType,
      action,
      subscriptionId: identified.id,
      err: msg,
    })
    await safeCreateWebhookEvent({
      asaasEventId,
      eventType,
      paymentId,
      subscriptionId: identified.id,
      payload: payloadStr,
      status: 'ERROR',
      errorMessage: msg,
    })
    return NextResponse.json({
      ok: true,
      eventId: asaasEventId,
      status: 'ERROR',
    })
  }
}

// ============================================================
// Helpers internos
// ============================================================

/**
 * 3 camadas pra achar Subscription:
 *   1. externalReference (preferida — controlada por nós)
 *   2. gatewaySubscriptionId (cartão Asaas)
 *   3. gatewayCustomerId (fallback Pix one-off)
 */
async function identifySubscription(
  body: AsaasWebhookEvent,
): Promise<IdentifiedSubscription | null> {
  const payment = body.payment
  if (!payment) return null

  // Camada 1: externalReference
  const parsed = parseExternalReference(payment.externalReference)
  if (parsed) {
    const sub = await prisma.subscription.findUnique({
      where: { userId: parsed.userId },
      select: {
        id: true,
        userId: true,
        status: true,
        currentPeriodEnd: true,
        gatewaySubscriptionId: true,
      },
    })
    if (sub) return sub
  }

  // Camada 2: gatewaySubscriptionId (Asaas cartão)
  if (payment.subscription) {
    const sub = await prisma.subscription.findFirst({
      where: { gatewaySubscriptionId: payment.subscription },
      select: {
        id: true,
        userId: true,
        status: true,
        currentPeriodEnd: true,
        gatewaySubscriptionId: true,
      },
    })
    if (sub) return sub
  }

  // Camada 3: gatewayCustomerId (fallback Pix)
  if (payment.customer) {
    const sub = await prisma.subscription.findFirst({
      where: { gatewayCustomerId: payment.customer },
      select: {
        id: true,
        userId: true,
        status: true,
        currentPeriodEnd: true,
        gatewaySubscriptionId: true,
      },
    })
    if (sub) return sub
  }

  return null
}

/** Infere ciclo do externalReference, com fallback MONTHLY. */
function inferCiclo(body: AsaasWebhookEvent): 'MONTHLY' | 'YEARLY' | null {
  const parsed = parseExternalReference(body.payment?.externalReference)
  return parsed?.ciclo ?? null
}

/**
 * Cria WebhookEvent ignorando colisão UNIQUE (idempotência race).
 * Usado nos paths IGNORE / ERROR (fora do $transaction principal).
 */
async function safeCreateWebhookEvent(data: {
  asaasEventId: string
  eventType: string
  paymentId: string | null
  subscriptionId: string | null
  payload: string
  status: WebhookEventStatus
  errorMessage: string | null
}): Promise<void> {
  try {
    await prisma.webhookEvent.create({
      data: {
        asaasEventId: data.asaasEventId,
        eventType: data.eventType,
        paymentId: data.paymentId,
        subscriptionId: data.subscriptionId,
        payload: data.payload,
        status: data.status,
        errorMessage: data.errorMessage,
        processedAt: new Date(),
      },
    })
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      // Race idempotente — outro request já gravou. OK.
      return
    }
    throw err
  }
}
