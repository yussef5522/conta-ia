// Sprint 4.0.5.b — redirect 308 pra /fornecedores (preserva bookmark).

import { redirect } from 'next/navigation'
import { setCurrentEmpresaCookie } from '@/lib/auth/current-empresa-cookie'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function OldPage({ params }: PageProps) {
  const { id } = await params
  await setCurrentEmpresaCookie(id)
  redirect('/fornecedores')
}
