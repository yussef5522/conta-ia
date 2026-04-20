'use client'

import Link from 'next/link'
import { Building2, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { t } from '@/lib/i18n/pt-BR'

interface EmpresaCardProps {
  empresa: {
    id: string
    name: string
    tradeName: string | null
    cnpj: string
    type: string
    isActive: boolean
  }
  onDelete: (id: string, name: string) => void
}

export function EmpresaCard({ empresa, onDelete }: EmpresaCardProps) {
  const tipo = t.empresa.tipos[empresa.type as keyof typeof t.empresa.tipos] ?? empresa.type
  const inicial = (empresa.tradeName || empresa.name)[0].toUpperCase()

  return (
    <div className="group relative rounded-lg border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        {/* Avatar + Nome */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-base">
            {inicial}
          </div>
          <div className="min-w-0">
            <Link
              href={`/empresas/${empresa.id}`}
              className="block truncate font-semibold text-foreground hover:text-primary transition-colors"
            >
              {empresa.tradeName || empresa.name}
            </Link>
            {empresa.tradeName && (
              <p className="truncate text-xs text-muted-foreground">{empresa.name}</p>
            )}
          </div>
        </div>

        {/* Menu de ações */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">Ações</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/empresas/${empresa.id}/editar`} className="flex items-center gap-2">
                <Pencil className="h-4 w-4" />
                {t.common.edit}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive flex items-center gap-2"
              onClick={() => onDelete(empresa.id, empresa.tradeName || empresa.name)}
            >
              <Trash2 className="h-4 w-4" />
              {t.common.delete}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* CNPJ + badges */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">{empresa.cnpj}</span>
        <div className="flex items-center gap-2 ml-auto">
          <Badge variant="secondary" className="text-xs">
            {tipo}
          </Badge>
          <Badge variant={empresa.isActive ? 'success' : 'outline'} className="text-xs">
            {empresa.isActive ? t.empresa.status.ativo : t.empresa.status.inativo}
          </Badge>
        </div>
      </div>
    </div>
  )
}
