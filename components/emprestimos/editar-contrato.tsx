// ⭐⭐ R60 — EDITAR O CONTRATO, campo a campo (25/11/2026). Grava pelo PATCH da ficha.
// ⚠️ A agenda NÃO é regerada aqui (R55): mudar taxa/sistema muda a FICHA; a agenda muda só por
// "importar agenda do banco" ou "corrigir agenda".
'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'

export interface FichaDoContrato {
  lender: string
  contractNumber: string | null
  rateType: 'PRE' | 'POS' | null
  indexer: 'CDI' | 'SELIC' | 'IPCA' | null
  indexerPercent: number | null
  interestRateMonthly: number
  amortizationSystem: 'PRICE' | 'SAC'
  termMonths: number
  principal: number
  iof: number
  carencia: number
  notes: string | null
}

const num = (s: string) => Number(s.replace(/\./g, '').replace(',', '.'))

export function EditarContrato({ empresaId, loanId, ficha, focar, onClose, onGravado }: {
  empresaId: string; loanId: string; ficha: FichaDoContrato; focar?: 'indexer'
  onClose: () => void; onGravado: () => void
}) {
  const { toast } = useToast()
  const [gravando, setGravando] = useState(false)
  const [f, setF] = useState({
    lender: ficha.lender,
    contractNumber: ficha.contractNumber ?? '',
    rateType: ficha.rateType ?? 'PRE',
    indexer: ficha.indexer ?? '',
    indexerPercent: ficha.indexerPercent != null ? String(ficha.indexerPercent) : '',
    taxa: (ficha.interestRateMonthly * 100).toLocaleString('pt-BR', { maximumFractionDigits: 6 }),
    amortizationSystem: ficha.amortizationSystem,
    termMonths: String(ficha.termMonths),
    principal: ficha.principal.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
    iof: ficha.iof.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
    carencia: String(ficha.carencia ?? 0),
    notes: ficha.notes ?? '',
  })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))

  async function salvar() {
    const body: Record<string, unknown> = {
      lender: f.lender.trim(),
      contractNumber: f.contractNumber.trim() || null,
      rateType: f.rateType,
      amortizationSystem: f.amortizationSystem,
      termMonths: Number(f.termMonths),
      principal: num(f.principal),
      iof: num(f.iof),
      carencia: Number(f.carencia),
      interestRateMonthly: num(f.taxa) / 100,
      notes: f.notes.trim() || null,
    }
    if (f.rateType === 'POS') {
      body.indexer = f.indexer || null
      body.indexerPercent = f.indexerPercent ? num(f.indexerPercent) : null
    }
    setGravando(true)
    try {
      const r = await fetch(`/api/empresas/${empresaId}/emprestimos/${loanId}`, {
        method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast({ variant: 'destructive', title: 'Não consegui salvar', description: j.erro ?? 'confira os campos' }); return }
      toast({ title: 'Contrato atualizado' })
      onGravado()
    } finally { setGravando(false) }
  }

  const campo = 'space-y-1'
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Editar contrato</DialogTitle></DialogHeader>
        <div data-editar-contrato className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className={campo}><Label>Credor</Label><Input value={f.lender} onChange={set('lender')} /></div>
          <div className={campo}><Label>Nº do contrato</Label><Input value={f.contractNumber} onChange={set('contractNumber')} /></div>
          <div className={campo}><Label>Tipo de taxa</Label>
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={f.rateType} onChange={set('rateType')}>
              <option value="PRE">Pré-fixado</option><option value="POS">Pós-fixado</option>
            </select>
          </div>
          <div className={campo}><Label>Taxa (% a.m.)</Label><Input inputMode="decimal" value={f.taxa} onChange={set('taxa')} /></div>
          {f.rateType === 'POS' && <>
            <div className={campo}><Label>Indexador</Label>
              <select autoFocus={focar === 'indexer'} data-campo="indexer" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={f.indexer} onChange={set('indexer')}>
                <option value="">— escolha —</option><option value="CDI">CDI</option><option value="SELIC">SELIC</option><option value="IPCA">IPCA</option>
              </select>
            </div>
            <div className={campo}><Label>% do indexador</Label><Input inputMode="decimal" value={f.indexerPercent} onChange={set('indexerPercent')} placeholder="100" /></div>
          </>}
          <div className={campo}><Label>Sistema</Label>
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={f.amortizationSystem} onChange={set('amortizationSystem')}>
              <option value="PRICE">PRICE</option><option value="SAC">SAC</option>
            </select>
          </div>
          <div className={campo}><Label>Nº de parcelas</Label><Input inputMode="numeric" value={f.termMonths} onChange={set('termMonths')} /></div>
          <div className={campo}><Label>Principal (R$)</Label><Input inputMode="decimal" value={f.principal} onChange={set('principal')} /></div>
          <div className={campo}><Label>IOF (R$)</Label><Input inputMode="decimal" value={f.iof} onChange={set('iof')} /></div>
          <div className={campo}><Label>Carência (meses)</Label><Input inputMode="numeric" value={f.carencia} onChange={set('carencia')} /></div>
          <div className={`${campo} sm:col-span-2`}><Label>Observações</Label><Input value={f.notes} onChange={set('notes')} /></div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={gravando}>{gravando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
