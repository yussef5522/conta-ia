'use client'

// Sprint A-effected Fase A — TipoSelector header.
//
// Seleção entre 3 opções de filtro de conciliação. Default heurístico pela
// natureza do negócio (restaurant/retail → "apenas-pagamentos" pra não
// poluir lista com PIX maquininha sem candidato).

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { TipoConciliacao } from '@/lib/conciliacao/tipo-filter'

interface Props {
  value: TipoConciliacao
  onChange: (next: TipoConciliacao) => void
}

export function TipoSelector({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Tipo:</span>
      <Select value={value} onValueChange={(v) => onChange(v as TipoConciliacao)}>
        <SelectTrigger className="w-auto min-w-[220px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="apenas-pagamentos">
            Só pagamentos (saídas)
          </SelectItem>
          <SelectItem value="apenas-recebimentos">
            Só recebimentos (entradas)
          </SelectItem>
          <SelectItem value="todos">Pagamentos + recebimentos</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
