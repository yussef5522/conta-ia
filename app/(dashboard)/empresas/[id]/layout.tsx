// Sprint 4.0.5.a — layout compartilhado pras páginas /empresas/[id]/*.
// Injeta EmpresaSubNav (tabs horizontais) substituindo a antiga ContextualSidebar.

import { EmpresaSubNav } from '@/components/layout/empresa-subnav'

interface LayoutProps {
  children: React.ReactNode
  params: Promise<{ id: string }>
}

export default async function EmpresaLayout({ children, params }: LayoutProps) {
  const { id } = await params
  return (
    <>
      <EmpresaSubNav empresaId={id} />
      {children}
    </>
  )
}
