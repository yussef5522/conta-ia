'use client'

// Sprint 5.0.1 — botão "Calcular DAS" com inputs mês + receita.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Calculator, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'

export function TributarioRecalcButton({ empresaId }: { empresaId: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const now = new Date()
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(String(now.getFullYear()))
  const [month, setMonth] = useState(String(now.getMonth() + 1))
  const [receita, setReceita] = useState('')
  const [loading, setLoading] = useState(false)

  async function calcular() {
    if (!receita || Number(receita) < 0) {
      toast({ variant: 'destructive', title: 'Receita inválida' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/empresas/${empresaId}/tax-calculate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paYear: Number(year),
          paMonth: Number(month),
          receitaBrutaMes: Number(receita),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Falha no cálculo',
          description: data.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      const r = data.result
      toast({
        title: `DAS R$ ${r.dasValue.toFixed(2).replace('.', ',')}`,
        description: `Alíquota efetiva ${(r.aliquotaEfetiva ?? 0).toFixed(2)}%`,
      })
      setOpen(false)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Calculator className="h-4 w-4 mr-1.5" />
        Calcular DAS
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Calcular DAS</DialogTitle>
            <DialogDescription>
              Informe o período e a receita bruta do mês.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs">Ano</label>
                <Input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  min="2020"
                  max="2099"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs">Mês</label>
                <Input
                  type="number"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  min="1"
                  max="12"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs">Receita Bruta do mês (R$)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={receita}
                onChange={(e) => setReceita(e.target.value)}
                placeholder="50000.00"
              />
              <p className="text-[10px] text-zinc-500">
                Esse valor é só pra cálculo; sistema soma RBA 12m automático.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={calcular} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Calculando…
                </>
              ) : (
                'Calcular'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
