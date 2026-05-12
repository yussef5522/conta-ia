'use client'

// Seletor de empresa do Dashboard — Sprint 1 Dia 1.
// URL como source-of-truth: muda ?empresa=<id> via router.push.
// Renderiza só quando user tem 2+ empresas.

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Building2 } from 'lucide-react'

interface CompanyOption {
  id: string
  name: string
  tradeName: string | null
}

interface CompanySelectorProps {
  empresas: CompanyOption[]
  currentEmpresaId: string
}

export function CompanySelector({ empresas, currentEmpresaId }: CompanySelectorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  if (empresas.length < 2) return null

  function handleChange(empresaId: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('empresa', empresaId)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <Select value={currentEmpresaId} onValueChange={handleChange}>
      <SelectTrigger className="w-[260px]">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent>
        {empresas.map((e) => (
          <SelectItem key={e.id} value={e.id}>
            {e.tradeName || e.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
