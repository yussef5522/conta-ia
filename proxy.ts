// Middleware do Next.js — Sprint 1.3 + 1.6 (host-aware admin gate).
// Responsabilidades:
//   1. Subdomain routing: admin.caixaos.com.br/* → /admin/* (rewrite, Sprint 1.3)
//   2. Bloqueio: /admin/* via outros hosts → 404 (Sprint 1.3)
//   3. App auth gate: páginas/rotas protegidas exigem ci_session (existente)
//   4. Admin auth gate: /admin/* (em admin.*) exige admin_session (Sprint 1.6)
//
// COOKIES ISOLADOS:
//   - ci_session: cookie do app, host-only em app.caixaos.com.br
//   - admin_session: cookie do admin, Domain=admin.caixaos.com.br LITERAL
//   - Nunca cross-leak por design (host-only OR domain literal).
//
// IMPORTANTE: arquivo se chama "proxy.ts" (legado), mas a função exportada
// é o middleware do Next.js. Não renomear sem testar runtime.

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { resolveSubdomainAction, isAdminHost } from '@/lib/middleware/subdomain'
import {
  ADMIN_COOKIE_NAME,
  verifyAdminToken,
} from '@/lib/admin-auth/jwt'

const PUBLIC_PAGES = [
  '/login',
  '/cadastro',
  '/esqueci-senha',
  '/aceitar-convite',
]
const PUBLIC_API = [
  '/api/auth/login',
  '/api/auth/cadastro',
  '/api/aceitar-convite',
  // Sprint 1.5 — Esqueci senha (3 endpoints sem auth)
  '/api/auth/forgot-password',
  '/api/auth/verify-reset-code',
  '/api/auth/reset-password',
  // Sprint 1.7 — Validação pública de cupom (rate-limited)
  '/api/coupons/validate',
]

// Rotas /admin/* que NÃO exigem admin_session:
//   - /admin/login (a tela de login em si)
//   - /admin/api/admin/login (action de submeter)
//   - Robots, favicon (já excluídos via matcher)
const ADMIN_PUBLIC_PATHS = ['/admin/login']
const ADMIN_PUBLIC_API_AT_REWRITE = [
  // Após o rewrite, /api/admin/login fica em /admin/api/admin/login? Não:
  // o rewrite só altera path pra prefixar /admin em rotas PÁGINA. APIs
  // (/api/admin/*) NÃO são reescritas (resolveSubdomainAction.allow pra /api).
  '/api/admin/login',
  '/api/admin/logout',
]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const host = request.headers.get('host')
  const admin = isAdminHost(host)

  // ============================================================
  // 1. Subdomain routing (admin.* → /admin/* + bloqueio /admin via app)
  // ============================================================
  const subAction = resolveSubdomainAction(host, pathname)

  if (subAction.kind === 'rewrite-to-admin') {
    const url = request.nextUrl.clone()
    url.pathname = subAction.newPathname
    return NextResponse.rewrite(url)
  }

  if (subAction.kind === 'block-admin') {
    return new NextResponse('Not Found', { status: 404 })
  }

  // ============================================================
  // 2. /api/admin/* — só acessível via admin host (defesa em profundidade,
  //    o endpoint também checka, mas bloqueamos antes)
  // ============================================================
  if (pathname.startsWith('/api/admin')) {
    if (!admin) {
      return new NextResponse('Not Found', { status: 404 })
    }
    // Endpoints públicos do admin (login/logout): seguem direto
    if (ADMIN_PUBLIC_API_AT_REWRITE.some((p) => pathname.startsWith(p))) {
      return NextResponse.next()
    }
    // Endpoints protegidos (/api/admin/me, futuros): exigem admin_session
    const adminToken = request.cookies.get(ADMIN_COOKIE_NAME)?.value
    if (!adminToken) {
      return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
    }
    try {
      await verifyAdminToken(adminToken)
      return NextResponse.next()
    } catch {
      return NextResponse.json({ erro: 'Sessão inválida' }, { status: 401 })
    }
  }

  // ============================================================
  // 3. Páginas /admin/* — Sprint 1.6 protege com admin_session
  // ============================================================
  if (pathname.startsWith('/admin')) {
    // Páginas públicas do admin (login)
    if (ADMIN_PUBLIC_PATHS.some((p) => pathname === p)) {
      // Se já está autenticado, redireciona pra dashboard
      const adminToken = request.cookies.get(ADMIN_COOKIE_NAME)?.value
      if (adminToken) {
        try {
          await verifyAdminToken(adminToken)
          return NextResponse.redirect(new URL('/admin/dashboard', request.url))
        } catch {
          // Token inválido — deixa acessar o login
        }
      }
      return NextResponse.next()
    }

    // Demais páginas /admin/* exigem auth
    const adminToken = request.cookies.get(ADMIN_COOKIE_NAME)?.value
    if (!adminToken) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
    try {
      await verifyAdminToken(adminToken)
      return NextResponse.next()
    } catch {
      const response = NextResponse.redirect(
        new URL('/admin/login', request.url),
      )
      response.cookies.set(ADMIN_COOKIE_NAME, '', { maxAge: 0, path: '/' })
      return response
    }
  }

  // ============================================================
  // 4. App cliente — auth gate normal (Sprints anteriores)
  // ============================================================
  const token = request.cookies.get(COOKIE_NAME)?.value

  // Rotas de API públicas
  if (PUBLIC_API.some((route) => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Páginas de autenticação
  if (PUBLIC_PAGES.some((page) => pathname === page)) {
    if (token) {
      try {
        await verifyToken(token)
        return NextResponse.redirect(new URL('/dashboard', request.url))
      } catch {
        // Token inválido — deixa acessar o login
      }
    }
    return NextResponse.next()
  }

  // Rotas protegidas
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    await verifyToken(token)
    return NextResponse.next()
  } catch {
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete(COOKIE_NAME)
    return response
  }
}

export const config = {
  // Excluir do middleware:
  //   - Assets internos do Next (_next/static, _next/image)
  //   - Favicon e arquivos públicos servidos diretamente (robots.txt, sitemap.xml)
  //   - Extensões binárias (imagens, fontes, txt/xml)
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|woff|woff2|ttf|otf)$).*)',
  ],
}
