import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'

const PUBLIC_PAGES = ['/login', '/cadastro', '/esqueci-senha']
const PUBLIC_API = ['/api/auth/login', '/api/auth/cadastro']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
