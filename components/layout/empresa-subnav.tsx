'use client'

// Sprint 4.0.5.a — Sub-nav horizontal pra páginas /empresas/[id]/*.
// Substitui ContextualSidebar (sidebar dupla) por tabs no header da página.

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
  href: string
  label: string
}

interface Props {
  empresaId: string
}

function buildNav(empresaId: string): NavItem[] {
  const base = `/empresas/${empresaId}`
  return [
    { href: base, label: 'Visão Geral' },
    { href: `${base}/contas`, label: 'Contas Bancárias' },
    { href: `${base}/dre`, label: 'DRE' },
    { href: `${base}/categorias`, label: 'Categorias' },
    { href: `${base}/regras`, label: 'Regras IA' },
    { href: `${base}/fornecedores`, label: 'Fornecedores' },
    { href: `${base}/imports`, label: 'Histórico OFX' },
    { href: `${base}/transferencias`, label: 'Transferências' },
    { href: `${base}/usuarios`, label: 'Usuários' },
    { href: `${base}/permissoes`, label: 'Permissões' },
    { href: `${base}/auditoria`, label: 'Auditoria' },
  ]
}

export function EmpresaSubNav({ empresaId }: Props) {
  const pathname = usePathname()
  const nav = buildNav(empresaId)

  function isActive(href: string): boolean {
    if (href === `/empresas/${empresaId}`) {
      // Visão Geral: ativa apenas no path exato (não em filhos)
      return pathname === href || pathname === `${href}/editar`
    }
    return pathname.startsWith(href)
  }

  return (
    <nav
      className="-mx-4 lg:-mx-6 mb-6 border-b bg-white"
      aria-label="Navegação da empresa"
    >
      <div className="px-4 lg:px-6 overflow-x-auto">
        <ul className="flex items-center gap-1 min-w-max">
          {nav.map((item) => {
            const active = isActive(item.href)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`inline-flex items-center px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    active
                      ? 'border-primary text-primary'
                      : 'border-transparent text-zinc-600 hover:text-zinc-900 hover:border-zinc-300'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
