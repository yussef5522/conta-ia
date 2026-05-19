// Lógica PURA de subdomain routing — Sprint 1.3.
// Sem deps de Next.js, testável sem instanciar NextRequest.

export function isAdminHost(host: string | null | undefined): boolean {
  if (!host) return false
  // admin.caixaos.com.br · admin.<algumacoisa> · admin (sem . — pra dev local)
  return host.startsWith('admin.') || host === 'admin'
}

export type SubdomainAction =
  | { kind: 'allow' }
  | { kind: 'rewrite-to-admin'; newPathname: string }
  | { kind: 'block-admin'; status: 404 }

// Decide o que fazer baseado em (host, pathname).
//
// Regras:
//   1. admin.* + path NÃO começa com /admin (e não é asset interno)
//      → rewrite pra /admin + path
//   2. /admin/* + host NÃO admin
//      → bloqueia 404 (não revela existência do painel)
//   3. caso contrário → allow
export function resolveSubdomainAction(
  host: string | null | undefined,
  pathname: string,
): SubdomainAction {
  const admin = isAdminHost(host)

  // Pula assets internos e API — middleware não deve reescrever
  const isInternal =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon')

  if (admin && !pathname.startsWith('/admin') && !isInternal) {
    const newPathname = pathname === '/' ? '/admin' : `/admin${pathname}`
    return { kind: 'rewrite-to-admin', newPathname }
  }

  if (pathname.startsWith('/admin') && !admin) {
    return { kind: 'block-admin', status: 404 }
  }

  return { kind: 'allow' }
}
