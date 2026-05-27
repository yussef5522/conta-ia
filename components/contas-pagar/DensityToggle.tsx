'use client'

// Sprint 5.0.3.0c (c2) — DropdownMenu pra alternar densidade da tabela.
//
// 3 níveis: Compact (36px) / Normal (48px) / Comfortable (60px).
// Persistência localStorage via useTablePreferences (callsite).
//
// Em mobile, este botão fica DISABLED — viewport força compact.

import { Rows3, Rows2, Rows4, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import type { DensityLevel } from '@/lib/contas-pagar/use-table-preferences'

const OPTIONS: Array<{
  id: DensityLevel
  name: string
  height: string
  icon: typeof Rows2
}> = [
  { id: 'compact', name: 'Compacto', height: '36px', icon: Rows4 },
  { id: 'normal', name: 'Normal', height: '48px', icon: Rows3 },
  { id: 'comfortable', name: 'Confortável', height: '60px', icon: Rows2 },
]

interface Props {
  density: DensityLevel
  onChange: (d: DensityLevel) => void
  disabled?: boolean
}

export function DensityToggle({ density, onChange, disabled }: Props) {
  const current = OPTIONS.find((o) => o.id === density) ?? OPTIONS[1]
  const Icon = current.icon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          aria-label="Densidade da tabela"
          data-testid="density-toggle"
        >
          <Icon className="h-3.5 w-3.5 mr-1.5" />
          {current.name}
          <ChevronDown className="ml-1 h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-xs">Densidade</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {OPTIONS.map((opt) => {
          const OptIcon = opt.icon
          const isActive = opt.id === density
          return (
            <DropdownMenuItem
              key={opt.id}
              onSelect={() => onChange(opt.id)}
              data-testid={`density-${opt.id}`}
              className={
                isActive
                  ? 'bg-primary/5 font-medium'
                  : ''
              }
            >
              <OptIcon className="mr-2 h-3.5 w-3.5" />
              <span className="flex-1">{opt.name}</span>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {opt.height}
              </span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
