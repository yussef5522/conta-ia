// Mapeamento PURO role.name → estilos visuais — Sprint 1.4.
// Knowledge geral compartilhado entre RoleBadge, Avatar, Modais.
// Cores alinhadas à brand CAIXAOS (#0C447C primary, #5DCAA5 success).

export interface RoleStyle {
  // Classes Tailwind pro badge (background + border + texto)
  badgeClass: string
  // Gradient pra avatar (CSS background string)
  avatarGradient: string
  // Cor sólida do anel/borda (hex)
  accentColor: string
  // Descrição curta usada no modal Convidar
  description: string
  // Ordem de display (OWNER no topo)
  displayOrder: number
}

const DEFAULT_STYLE: RoleStyle = {
  badgeClass:
    'border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
  avatarGradient: 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)',
  accentColor: '#64748b',
  description: 'Acesso conforme permissões customizadas da role.',
  displayOrder: 99,
}

const ROLE_STYLES: Record<string, RoleStyle> = {
  OWNER: {
    badgeClass:
      'border-purple-300 bg-purple-50 text-purple-800 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-200',
    avatarGradient: 'linear-gradient(135deg, #a855f7 0%, #6b21a8 100%)',
    accentColor: '#7e22ce',
    description: 'Acesso total. Pode excluir empresa, mudar plano, gerenciar tudo.',
    displayOrder: 1,
  },
  ADMIN: {
    badgeClass:
      'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200',
    avatarGradient: 'linear-gradient(135deg, #185FA5 0%, #0C447C 100%)',
    accentColor: '#0C447C',
    description:
      'Acesso completo (exceto excluir empresa e mudar plano). Convida, remove, edita tudo.',
    displayOrder: 2,
  },
  ACCOUNTANT: {
    badgeClass:
      'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
    avatarGradient: 'linear-gradient(135deg, #5DCAA5 0%, #1D9E75 100%)',
    accentColor: '#1D9E75',
    description:
      'Foco contábil: visualiza tudo, lança transações, edita categorias e fornecedores.',
    displayOrder: 3,
  },
  FINANCIAL: {
    badgeClass:
      'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
    avatarGradient: 'linear-gradient(135deg, #EF9F27 0%, #b45309 100%)',
    accentColor: '#b45309',
    description:
      'Foco financeiro: vê dashboard e DRE, lança transações. Não edita estrutura.',
    displayOrder: 4,
  },
  VIEWER: {
    badgeClass:
      'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
    avatarGradient: 'linear-gradient(135deg, #94a3b8 0%, #475569 100%)',
    accentColor: '#475569',
    description: 'Apenas visualizar dashboard, relatórios e transações. Sem edição.',
    displayOrder: 5,
  },
}

export function getRoleStyle(roleName: string | null | undefined): RoleStyle {
  if (!roleName) return DEFAULT_STYLE
  return ROLE_STYLES[roleName.toUpperCase()] ?? DEFAULT_STYLE
}

// Pra ordenar lista de roles na UI (Convidar modal)
export function compareRolesByDisplayOrder(
  a: { name: string },
  b: { name: string },
): number {
  return getRoleStyle(a.name).displayOrder - getRoleStyle(b.name).displayOrder
}

// Pra avatar fallback (iniciais maiusculas)
export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

export const KNOWN_ROLE_NAMES = Object.keys(ROLE_STYLES)
