// Sprint 4.0.5.b — redirect 308 pra /categorias (preserva bookmark).

import { redirect } from 'next/navigation'
import { setCurrentEmpresaCookie } from '@/lib/auth/current-empresa-cookie'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function OldPage({ params }: PageProps) {
  const { id } = await params
  await setCurrentEmpresaCookie(id)
  redirect('/categorias')
}
