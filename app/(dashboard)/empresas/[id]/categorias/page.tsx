import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import type { Metadata } from 'next'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { CategoriasClient } from './categorias-client'

interface Props {
  params: Promise<{ id: string }>
}

export const metadata: Metadata = { title: 'Plano de Contas' }

const TIPO_LABELS: Record<string, string> = {
  service: 'Serviço',
  restaurant: 'Restaurante',
  retail: 'Comércio',
  industry: 'Indústria',
  clinica: 'Clínica',
  salao: 'Salão',
  mixed: 'Misto',
  other: 'Outro',
}

const REGIME_LABELS: Record<string, string> = {
  SIMPLES_NACIONAL_I: 'Simples Nacional — Anexo I',
  SIMPLES_NACIONAL_II: 'Simples Nacional — Anexo II',
  SIMPLES_NACIONAL_III: 'Simples Nacional — Anexo III',
  SIMPLES_NACIONAL_IV: 'Simples Nacional — Anexo IV',
  SIMPLES_NACIONAL_V: 'Simples Nacional — Anexo V',
  LUCRO_PRESUMIDO: 'Lucro Presumido',
  LUCRO_REAL: 'Lucro Real',
  MEI: 'MEI',
  // legacy
  SIMPLES_NACIONAL: 'Simples Nacional',
}

export default async function CategoriasPage({ params }: Props) {
  const { id: empresaId } = await params

  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) redirect('/login')

  const user = await verifyToken(token)

  const userCompany = await prisma.userCompany.findFirst({
    where: { userId: user.sub, companyId: empresaId },
    include: {
      company: {
        select: { id: true, name: true, tradeName: true, type: true, taxRegime: true },
      },
    },
  })
  if (!userCompany) notFound()

  const empresa = userCompany.company

  const totalCategorias = await prisma.category.count({
    where: { companyId: empresaId, isActive: true },
  })

  const setorLabel = TIPO_LABELS[(empresa.type ?? '').toLowerCase()] ?? empresa.type
  const regimeLabel = REGIME_LABELS[empresa.taxRegime] ?? empresa.taxRegime

  return (
    <CategoriasClient
      empresaId={empresaId}
      empresaNome={empresa.tradeName ?? empresa.name}
      totalCategorias={totalCategorias}
      setorLabel={setorLabel}
      regimeLabel={regimeLabel}
    />
  )
}
