// TeamAvatar — Sprint 1.4.
// Avatar circular com gradient por role + iniciais do nome.
// Sem fetch de Gravatar (LGPD-friendly + offline-first).

import { cn } from '@/lib/utils'
import { getRoleStyle, initialsFromName } from '@/lib/team/role-style'

interface TeamAvatarProps {
  name: string
  roleName?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_MAP = {
  sm: { box: 'h-8 w-8', text: 'text-xs' },
  md: { box: 'h-10 w-10', text: 'text-sm' },
  lg: { box: 'h-12 w-12', text: 'text-base' },
} as const

export function TeamAvatar({
  name,
  roleName,
  size = 'md',
  className,
}: TeamAvatarProps) {
  const style = getRoleStyle(roleName)
  const { box, text } = SIZE_MAP[size]

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full font-semibold text-white shrink-0',
        box,
        text,
        className,
      )}
      style={{ background: style.avatarGradient }}
      aria-label={`Avatar de ${name}`}
    >
      {initialsFromName(name)}
    </div>
  )
}
