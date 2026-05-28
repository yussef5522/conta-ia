// Sprint 5.0.4.0c1 Fase 3 — Variâncias.

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import type { Metadata } from 'next'
import { Header } from '@/components/layout/header'
import { resolveEmpresaAccess } from '@/lib/auth/resolve-empresa-access'
import { prisma } from '@/lib/db'
import { VarianciasClient } from './variancias-client'

export const metadata: Metadata = { title: 'Variâncias — Relatórios' }
export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function VarianciasReportPage({ params }: PageProps) {
  const { id: empresaId } = await params
  const access = await resolveEmpresaAccess({ requirePermission: 'dre.view' })
  if (access.kind !== 'ok') notFound()

  const empresa = await prisma.company.findUnique({
    where: { id: empresaId },
    select: { id: true, name: true, tradeName: true },
  })
  if (!empresa) notFound()

  return (
    <div className="space-y-4">
      <Link
        href={`/empresas/${empresaId}/relatorios`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        data-testid="breadcrumb-back"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Voltar pra Relatórios
      </Link>

      <Header
        title="Variâncias Detectadas"
        description={`O que mudou em ${empresa.tradeName ?? empresa.name} este mês`}
      />

      <VarianciasClient empresaId={empresaId} />
    </div>
  )
}
