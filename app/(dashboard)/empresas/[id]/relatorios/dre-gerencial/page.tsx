// Sprint 5.0.4.0a — DRE Gerencial migrado para /relatorios.
//
// REUSA DREClient existente (mesmo código que rodava em /dre — paridade
// automática garantida, sem refactor). Diferença: rota per-empresa
// + breadcrumb "← Voltar pra Relatórios".

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import type { Metadata } from 'next'
import { DREClient } from '@/app/(dashboard)/empresas/[id]/dre/dre-client'
import { resolveEmpresaAccess } from '@/lib/auth/resolve-empresa-access'
import { prisma } from '@/lib/db'

export const metadata: Metadata = { title: 'DRE Gerencial — Relatórios' }
export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function DREGerencialReportPage({ params }: PageProps) {
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

      <DREClient
        empresaId={empresaId}
        empresaNome={empresa.tradeName ?? empresa.name}
      />
    </div>
  )
}
