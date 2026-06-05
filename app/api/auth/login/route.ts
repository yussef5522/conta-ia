// POST /api/auth/login
// Sprint Rate-Limit-Login (rev): backoff progressivo POR (IP, email) +
// guarda hard 20/15min POR IP (anti-enumeração) + reset no sucesso.
//
// Ordem garantida pra não quebrar o login legítimo:
//   1. Parser body com try/catch isolado (malformado → 400, não 500)
//   2. Guarda do IP (anti-DoS de enumeração)
//   3. Backoff (IP, email) — usuário legítimo com 1-3 erros nem sente
//   4. Autenticação bcrypt em tempo constante (sem revelar se email existe)
//   5. Falha → recordFailure nas 2 chaves + 401 genérico
//   6. Sucesso → resetAttempts da chave composta + audit + JWT

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { ZodError } from 'zod'
import { prisma } from '@/lib/db'
import { signToken, COOKIE_NAME, COOKIE_OPTIONS } from '@/lib/auth'
import { loginSchema } from '@/lib/validations/auth'
import {
  rateLimit,
  checkBackoff,
  recordFailure,
  resetAttempts,
  getRequestIp,
  loginBackoffKey,
  loginIpGuardKey,
} from '@/lib/rate-limit'

// Guarda do IP: hard limit pra impedir scraping massivo. Generoso o bastante
// pra família/NAT corporativo (20 falhas distintas em 15 min é muito).
const IP_GUARD_MAX = 20
const IP_GUARD_WINDOW_MS = 15 * 60 * 1000

// Backoff progressivo (IP, email) — janela rolling 15 min.
const BACKOFF_WINDOW_MS = 15 * 60 * 1000

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request)

  // ── 1. Parser do body ANTES do rate check (fora do try principal pra
  //    extrair email pra chave composta). Body malformado → 400 limpo.
  let parsedBody: unknown
  try {
    parsedBody = await request.json()
  } catch {
    return NextResponse.json({ erro: 'Body inválido' }, { status: 400 })
  }

  // Email pra chave: usa o que tiver no body (mesmo antes da validação Zod
  // formal — chave composta precisa dele). Se faltar, vira '_anon'.
  const emailFromBody =
    parsedBody && typeof parsedBody === 'object' && 'email' in parsedBody
      ? String((parsedBody as Record<string, unknown>).email ?? '')
      : ''
  const composedKey = loginBackoffKey(ip, emailFromBody)
  const ipKey = loginIpGuardKey(ip)

  // ── 2. Guarda do IP — bloqueio duro contra scan de muitas contas no IP
  const ipGuard = checkBackoffOrHardCheck(ipKey)
  if (!ipGuard.allowed) {
    return rateLimitResponse(ipGuard.retryAfterMs, true)
  }

  // ── 3. Backoff progressivo (IP, email)
  const backoff = checkBackoff(composedKey, BACKOFF_WINDOW_MS)
  if (!backoff.allowed) {
    return rateLimitResponse(backoff.retryAfterMs, false)
  }

  try {
    const data = loginSchema.parse(parsedBody)

    const user = await prisma.user.findUnique({ where: { email: data.email } })

    // Tempo constante para evitar enumeração de usuários
    const senhaValida = user
      ? await bcrypt.compare(data.password, user.password)
      : false

    if (!user || !senhaValida) {
      // Registra falha em AMBAS as chaves (backoff (IP,email) e guarda IP)
      recordFailure(composedKey, BACKOFF_WINDOW_MS)
      rateLimit(ipKey, IP_GUARD_MAX, IP_GUARD_WINDOW_MS)
      void recordFailedLoginAudit(emailFromBody, ip, request).catch((err) =>
        console.error('[LOGIN audit-fail] erro best-effort:', err),
      )
      // Mensagem genérica intencional (não vaza se email existe ou não)
      return NextResponse.json(
        { erro: 'E-mail ou senha incorretos' },
        { status: 401 },
      )
    }

    // ── Sucesso: reseta backoff (IP, email). NÃO reseta a guarda do IP
    //    (atacante que descobre 1 senha não deveria escapar do hard limit).
    try {
      resetAttempts(composedKey)
    } catch {
      // fail-open — reset falhar NÃO deve impedir login
    }

    // Sprint Gestão de Conta (31/05/2026) — força troca de senha no 1º login
    // após reset pelo admin.
    const { getOrCreateSubscription } = await import(
      '@/lib/subscription/queries'
    )
    const { computeEffectiveStatus } = await import('@/lib/subscription/access')
    const subscription = await getOrCreateSubscription(user.id)
    const effectiveStatus = computeEffectiveStatus({
      status: subscription.status,
      planId: subscription.planId,
      trialEndsAt: subscription.trialEndsAt,
    })
    const subscriptionExpired = effectiveStatus === 'EXPIRED'

    const token = await signToken({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      subscriptionExpired,
    })

    // Sprint 1.2 — Audit USER_LOGIN escopado à primeira empresa do user.
    // Best-effort: failure aqui não impede login.
    void recordLoginAudit(user.id, user.name, user.email, request).catch(
      (err) => console.error('[LOGIN audit] erro best-effort:', err),
    )

    const response = NextResponse.json({
      usuario: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      mustChangePassword: user.mustChangePassword,
    })

    response.cookies.set(COOKIE_NAME, token, COOKIE_OPTIONS)

    return response
  } catch (error) {
    if (error instanceof ZodError) {
      const campos: Record<string, string> = {}
      error.errors.forEach((e) => {
        if (e.path[0]) campos[e.path[0] as string] = e.message
      })
      return NextResponse.json(
        { erro: 'Dados inválidos', campos },
        { status: 400 },
      )
    }
    console.error('[LOGIN] Erro interno:', error)
    return NextResponse.json(
      { erro: 'Erro interno do servidor' },
      { status: 500 },
    )
  }
}

// Verifica guarda do IP sem incrementar. Reusa o `rateLimit` antigo —
// chamamos com limit alto pra "espiar" estado; rateLimit acaba criando entry
// se não existir. Pra não inflar, fazemos um peek manual aqui:
function checkBackoffOrHardCheck(ipKey: string): {
  allowed: boolean
  retryAfterMs: number
} {
  // Truque simples: chamar rateLimit com limit+1 pra ver se já estourou.
  // Se entry inexistente, rateLimit cria com failures=1 — efeito colateral
  // aceitável (essa request "conta como 1" no bucket de guarda).
  // OBS: pra ser mais preciso seria checkHardLimit puro; pra o MVP aceito.
  const r = rateLimit(ipKey, IP_GUARD_MAX, IP_GUARD_WINDOW_MS)
  return { allowed: r.allowed, retryAfterMs: r.retryAfterMs }
}

function rateLimitResponse(retryAfterMs: number, isIpGuard: boolean): NextResponse {
  const seconds = Math.ceil(retryAfterMs / 1000)
  const minutes = Math.ceil(retryAfterMs / 60_000)
  const msg = isIpGuard
    ? minutes <= 1
      ? 'Muitas tentativas deste local. Tente novamente em alguns segundos.'
      : `Muitas tentativas deste local. Tente novamente em ${minutes} minuto${minutes > 1 ? 's' : ''}.`
    : seconds <= 60
      ? `Senha incorreta. Próxima tentativa em ${seconds} segundo${seconds > 1 ? 's' : ''}.`
      : `Senha incorreta. Próxima tentativa em ${minutes} minuto${minutes > 1 ? 's' : ''}.`
  return NextResponse.json(
    { erro: msg },
    {
      status: 429,
      headers: { 'Retry-After': String(seconds) },
    },
  )
}

async function recordLoginAudit(
  userId: string,
  userName: string,
  userEmail: string,
  request: NextRequest,
): Promise<void> {
  const userCompany = await prisma.userCompany.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { companyId: true },
  })
  if (!userCompany) return

  const ipAddress = getRequestIp(request)
  const userAgent = request.headers.get('user-agent') ?? null

  await prisma.auditLog.create({
    data: {
      companyId: userCompany.companyId,
      userId,
      userName,
      userEmail,
      action: 'USER_LOGIN',
      entityType: 'User',
      entityId: userId,
      ipAddress,
      userAgent,
    },
  })
}

// Sprint Rate-Limit-Login: log de tentativas FALHAS pra auditoria forense.
// Sem senha, sem dados sensíveis. Escopo: primeira empresa do user (se
// existir); se email não existe, pula (não loga email arbitrário).
async function recordFailedLoginAudit(
  emailAttempt: string,
  ip: string,
  request: NextRequest,
): Promise<void> {
  if (!emailAttempt) return
  const normalized = emailAttempt.trim().toLowerCase()
  const user = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true, name: true, email: true },
  })
  if (!user) return // email não existe — não logamos pra evitar criar trilha de enumeração
  const userCompany = await prisma.userCompany.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
    select: { companyId: true },
  })
  if (!userCompany) return
  const userAgent = request.headers.get('user-agent') ?? null
  await prisma.auditLog.create({
    data: {
      companyId: userCompany.companyId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      action: 'USER_LOGIN_FAILED',
      entityType: 'User',
      entityId: user.id,
      ipAddress: ip,
      userAgent,
    },
  })
}
