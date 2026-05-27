'use client'

// Sprint 5.0.3.0b — Botão "Imprimir" — dispara window.print() do browser.
//
// CSS @media print está em app/globals.css ou em PrintLayout.css — esconde
// sidebar/header/filtros/menus e otimiza tabela pra A4 paisagem.

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  disabled?: boolean
}

export function PrintButton({ disabled }: Props) {
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => window.print()}
      disabled={disabled}
      data-testid="print-button"
      aria-label="Imprimir página"
    >
      <Printer className="mr-1.5 h-3.5 w-3.5" />
      Imprimir
    </Button>
  )
}
