// RoleBadge — Sprint 1.4.
// Badge colorido por role (OWNER roxo, ADMIN azul, ACCOUNTANT verde,
// FINANCIAL amarelo, VIEWER cinza). Custom roles caem no estilo default.

import { cn } from '@/lib/utils'
import { getRoleStyle } from '@/lib/team/role-style'

interface RoleBadgeProps {
  roleName: string
  size?: 'sm' | 'md'
  className?: string
}

export function RoleBadge({
  roleName,
  size = 'md',
  className,
}: RoleBadgeProps) {
  const style = getRoleStyle(roleName)

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border font-medium uppercase tracking-wide',
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs',
        style.badgeClass,
        className,
      )}
    >
      {roleName}
    </span>
  )
}
