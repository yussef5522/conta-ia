'use client'
// ⭐⭐ A FAIXA DO DIA PARADO (16/11/2026) — a pergunta da trava GRITA onde o dono olha: Painel, central de
// vendas e vendas ao vivo. "dia DD/MM parado esperando tua resposta — confirmar ou revisar", com o
// motivo (o número que a conferência estranhou) e o botão de responder ALI. Sem dia parado, nada aparece.
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Loader2 } from 'lucide-react'

interface DiaParadoDTO { dia: string; motivo: string; unidades: number; totalCent: number; pedidos: number }
const diaBr = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`

export function FaixaDiaParado({ empresaId }: { empresaId: string }) {
  const [dias, setDias] = useState<DiaParadoDTO[]>([])
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [erro, setErro] = useState<{ dia: string; msg: string } | null>(null)
  const ler = useCallback(() => {
    fetch(`/api/empresas/${empresaId}/estoque/vendas/suit/dia-parado`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null)).then((j) => setDias(j?.dias ?? [])).catch(() => {})
  }, [empresaId])
  useEffect(() => { ler() }, [ler])
  if (!dias.length) return null
  return (
    <div className="space-y-2" data-testid="faixa-dia-parado">
      {dias.map((d) => (
        <div key={d.dia} role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="font-semibold">dia {diaBr(d.dia)} parado esperando tua resposta — confirmar ou revisar</span>
          <span className="text-xs text-red-700">“{d.motivo}” · nada do dia entrou no estoque e a contagem está trancada</span>
          <span className="ml-auto flex gap-2">
            <button type="button" disabled={ocupado === d.dia} data-testid="confirmar-dia-parado"
              className="inline-flex h-8 items-center rounded-md bg-red-600 px-3 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              onClick={async () => {
                setOcupado(d.dia); setErro(null)
                try {
                  const r = await fetch(`/api/empresas/${empresaId}/estoque/vendas/suit/dia-parado`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dia: d.dia }) })
                  const j = await r.json().catch(() => ({}))
                  if (!r.ok) setErro({ dia: d.dia, msg: j.erro ?? 'Não consegui gravar o dia.' }); else ler()
                } catch { setErro({ dia: d.dia, msg: 'Não consegui falar com o servidor — nada mudou.' }) } finally { setOcupado(null) }
              }}>
              {ocupado === d.dia ? <Loader2 className="h-4 w-4 animate-spin" /> : 'confirmar — o número é de verdade'}
            </button>
            <Link href={`/empresas/${empresaId}/estoque/lucro-setor?dia=${d.dia}`} className="inline-flex h-8 items-center rounded-md border border-red-300 bg-white px-3 text-xs font-semibold text-red-700 hover:bg-red-100">revisar as vendas do dia</Link>
          </span>
          {erro?.dia === d.dia && <span className="w-full text-xs font-semibold text-red-800">{erro.msg}</span>}
        </div>
      ))}
    </div>
  )
}
