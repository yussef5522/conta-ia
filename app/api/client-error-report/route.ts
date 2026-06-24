// Sprint 15 — endpoint pra capturar erro client-side com stack trace
// completo no PM2 log do servidor.
//
// Uso: client chama POST com { message, stack, digest, context, ... }
// → server faz console.error com marcador `[CLIENT_ERROR]` que vai pro
// PM2 out log (~/.pm2/logs/conta-ia-out.log) E pro error log.
//
// IMPORTANTE: não é endpoint de telemetria genérica — só pra Sprint 15
// debugar o erro de excluir contas a pagar. Pode ser removido depois.
//
// SEM auth (queremos capturar erro mesmo se auth quebrar). Rate limit
// implícito pelo nginx + body limit 8KB pra prevenir abuse.

import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

interface ClientErrorPayload {
  message?: string
  stack?: string
  digest?: string
  componentStack?: string
  context?: string
  url?: string
  userAgent?: string
  pathname?: string
  timestamp?: string
}

export async function POST(request: NextRequest) {
  try {
    // Defesa rasa: limita tamanho do body
    const raw = await request.text()
    if (raw.length > 8 * 1024) {
      return NextResponse.json({ ok: false, erro: 'payload muito grande' }, { status: 413 })
    }
    let body: ClientErrorPayload = {}
    try {
      body = JSON.parse(raw) as ClientErrorPayload
    } catch {
      body = { message: raw.slice(0, 500) }
    }

    const ts = body.timestamp ?? new Date().toISOString()
    const marker = '[CLIENT_ERROR]'
    const ctx = body.context ?? '(no context)'
    const pathname = body.pathname ?? '(no pathname)'
    const userAgent = body.userAgent ?? request.headers.get('user-agent') ?? '(no UA)'

    // Linha header chamativa pra grep facil no log
    /* eslint-disable no-console */
    console.error(`\n${marker} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.error(`${marker} timestamp: ${ts}`)
    console.error(`${marker} context:   ${ctx}`)
    console.error(`${marker} pathname:  ${pathname}`)
    console.error(`${marker} url:       ${body.url ?? '(no url)'}`)
    console.error(`${marker} userAgent: ${userAgent}`)
    if (body.digest) console.error(`${marker} digest:    ${body.digest}`)
    if (body.message) console.error(`${marker} message:   ${body.message}`)
    if (body.stack) {
      console.error(`${marker} stack:`)
      console.error(body.stack)
    }
    if (body.componentStack) {
      console.error(`${marker} componentStack:`)
      console.error(body.componentStack)
    }
    console.error(`${marker} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
    /* eslint-enable no-console */

    return NextResponse.json({ ok: true })
  } catch (err) {
    /* eslint-disable-next-line no-console */
    console.error('[__client-error endpoint failure]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
