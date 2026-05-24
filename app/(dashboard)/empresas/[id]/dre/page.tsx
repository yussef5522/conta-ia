// Sprint 4.0.5.b — redireciona pra /dre global. Seta cookie de empresa antes
// pra preservar bookmark. Server component: 308 redirect transparente.

import { redirect } from 'next/navigation'
import { setCurrentEmpresaCookie } from '@/lib/auth/current-empresa-cookie'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function OldDREPage({ params }: PageProps) {
  const { id } = await params
  await setCurrentEmpresaCookie(id)
  redirect('/dre')
}
