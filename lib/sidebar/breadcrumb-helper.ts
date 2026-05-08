import type { BreadcrumbItem } from '@/components/sidebar/breadcrumb'

const ROUTE_LABELS: Record<string, string> = {
  'contas-bancarias': 'Contas Bancárias',
  'contas': 'Contas Bancárias',
  'transacoes': 'Transações',
  'pendentes': 'Transações',
  'dre': 'DRE Gerencial',
  'usuarios': 'Usuários',
  'permissoes': 'Permissões',
  'auditoria': 'Auditoria',
  'configuracoes': 'Configurações',
  'categorias': 'Categorias',
}

interface BuildBreadcrumbOptions {
  pathname: string
  empresaName?: string
  empresaId?: string
}

// Constrói breadcrumb dado o pathname.
//
// Exemplos:
// /dashboard → "Dashboard"
// /empresas → "Empresas"
// /empresas/123 → "Empresas > [empresa]"
// /empresas/123/dre → "Empresas > [empresa] > DRE Gerencial"
export function buildBreadcrumb(options: BuildBreadcrumbOptions): BreadcrumbItem[] {
  const { pathname, empresaName, empresaId } = options
  const items: BreadcrumbItem[] = []

  if (pathname === '/dashboard') {
    return [{ label: 'Dashboard' }]
  }

  if (pathname === '/empresas') {
    return [{ label: 'Empresas' }]
  }

  if (pathname.startsWith('/empresas/') && empresaId) {
    items.push({ label: 'Empresas', href: '/empresas' })

    const segments = pathname.split('/').filter(Boolean)

    if (segments.length === 2) {
      items.push({ label: empresaName ?? 'Empresa' })
      return items
    }

    if (segments.length >= 3) {
      items.push({
        label: empresaName ?? 'Empresa',
        href: `/empresas/${empresaId}`,
      })

      const sectionSlug = segments[2]
      const sectionLabel = ROUTE_LABELS[sectionSlug] ?? sectionSlug
      items.push({ label: sectionLabel })
    }

    return items
  }

  return [{ label: 'Início' }]
}
