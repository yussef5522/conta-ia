'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

interface SidebarItemProps {
  icon: LucideIcon
  label: string
  href: string
  isActive: boolean
  badge?: string
  // Sprint 4.0.3 — tone semântico pro badge (cor)
  badgeTone?: 'red' | 'amber' | 'neutral'
  isComingSoon?: boolean
  onClick?: () => void
}

export function SidebarItem({
  icon: Icon,
  label,
  href,
  isActive,
  badge,
  badgeTone = 'neutral',
  isComingSoon,
  onClick,
}: SidebarItemProps) {
  const baseClasses = 'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors'

  if (isComingSoon) {
    return (
      <div className={`${baseClasses} text-muted-foreground/50 cursor-not-allowed`}>
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate">{label}</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
          breve
        </span>
      </div>
    )
  }

  const activeClasses = isActive
    ? 'bg-primary text-primary-foreground font-semibold'
    : 'text-foreground/80 hover:bg-muted hover:text-foreground'

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`${baseClasses} ${activeClasses}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {badge && (
        <span
          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums ${
            badgeTone === 'red'
              ? 'bg-red-100 text-red-700'
              : badgeTone === 'amber'
                ? 'bg-amber-100 text-amber-700'
                : isActive
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
          }`}
        >
          {badge}
        </span>
      )}
    </Link>
  )
}
