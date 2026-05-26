// Sprint 5.0.2.h — Route Handler que SETA cookie de empresa + redireciona.
//
// Resolve bug ERROR digest 1446651374:
//   "Cookies can only be modified in a Server Action or Route Handler"
//
// Antes (Sprint 4.0.5.b), pages /empresas/[id]/X faziam setCurrentEmpresaCookie
// + redirect direto. Next.js 15+ bloqueia cookies.set em Server Component render.
//
// Agora os pages antigos redirecionam pra ESTE route handler, que tem
// permissão pra setar cookies. Ele seta + redireciona pro destino final.

import { NextRequest, NextResponse } from 'next/server'
import { setCurrentEmpresaCookie } from '@/lib/auth/current-empresa-cookie'

interface Params {
  params: Promise<{ id: string }>
}

// Whitelist de destinos permitidos (evita open redirect)
const ALLOWED_TARGETS = new Set([
  '/pendentes',
  '/dre',
  '/categorias',
  '/regras',
  '/fornecedores',
  '/permissoes',
  '/usuarios',
  '/imports',
  '/bancos',
  '/transacoes',
])

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params
  const url = new URL(request.url)
  const to = url.searchParams.get('to') ?? '/'

  // Anti open-redirect: só path interno + whitelist
  let target = '/'
  if (to.startsWith('/') && !to.startsWith('//')) {
    const pathOnly = to.split('?')[0]
    if (ALLOWED_TARGETS.has(pathOnly)) {
      target = to
    }
  }

  await setCurrentEmpresaCookie(id)
  return NextResponse.redirect(new URL(target, request.url))
}
