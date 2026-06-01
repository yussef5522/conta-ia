// Sprint post-3B: logout redireciona pra landing pública (/) em vez de
// /login. UX padrão Stripe/Netflix/GitHub. User vê o produto, pode voltar
// a se cadastrar com outro email.

import { NextResponse } from 'next/server'
import { COOKIE_NAME } from '@/lib/auth'

function redirectToLanding() {
  const response = NextResponse.redirect(
    new URL('/', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  )
  response.cookies.delete(COOKIE_NAME)
  return response
}

export async function POST() {
  return redirectToLanding()
}

export async function GET() {
  return redirectToLanding()
}
