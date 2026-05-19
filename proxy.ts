// Middleware do Next.js — Sprint 1.3.
// Responsabilidades:
//   1. Subdomain routing: admin.caixaos.com.br/* → /admin/* (rewrite)
//   2. Bloqueio: /admin/* via outros hosts → 404
//   3. Auth gate: páginas/rotas protegidas exigem cookie de sessão
//
// IMPORTANTE: arquivo se chama "proxy.ts" (legado), mas a função exportada
// é o middleware do Next.js. Não renomear sem testar runtime.

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { resolveSubdomainAction } from '@/lib/middleware/subdomain'

const PUBLIC_PAGES = ['/login', '/cadastro', '/esqueci-senha']
const PUBLIC_API = ['/api/auth/login', '/api/auth/cadastro']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const host = request.headers.get('host')

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
  // 2. Páginas /admin/* — públicas (placeholder Sprint 1.3)
  //    Sprint 1.6 vai adicionar gate de Gerenciador auth aqui.
  // ============================================================
  if (pathname.startsWith('/admin')) {
    return NextResponse.next()
  }

  // ============================================================
  // 3. App cliente — auth gate normal
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
