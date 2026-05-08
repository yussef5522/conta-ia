'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  if (items.length === 0) return null

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1 text-sm text-muted-foreground mb-3"
    >
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1

        return (
          <div key={idx} className="flex items-center gap-1 min-w-0">
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="hover:text-foreground transition-colors truncate"
              >
                {item.label}
              </Link>
            ) : (
              <span className={`truncate ${isLast ? 'text-foreground font-medium' : ''}`}>
                {item.label}
              </span>
            )}
            {!isLast && <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
          </div>
        )
      })}
    </nav>
  )
}
