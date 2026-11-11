'use client'
// A faixa da SuitAPI no topo de Vendas (10/11/2026): o dono VÊ que as vendas de produtos
// entram sozinhas, quando foi a última leitura, como ficou o último dia — e o botão pra decidir
// pedido apagado/alterado (a maçaneta do aviso "manter ou atualizar").
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Zap, AlertTriangle } from 'lucide-react'

export interface EstadoSuitDTO {
  ultimaLeitura: string | null
  parado: boolean
  dias: { dia: string; status: string; totalCent: number; unidades: number; pedidos: number; motivo: string | null }[]
  pendentes: { dia: string; n: number; deltaCent: number }[]
}

const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDia = (d: string) => d.split('-').reverse().slice(0, 2).join('/')
const ROTULO: Record<string, string> = { MATERIALIZADO: 'entrou', AGUARDANDO_DONO: 'esperando você', XLS_POR_CIMA: 'trocado pelo arquivo' }

export function FaixaDaSuit({ id }: { id: string }) {
  const [e, setE] = useState<EstadoSuitDTO | null>(null)
  useEffect(() => {
    let vivo = true
    fetch(`/api/empresas/${id}/estoque/vendas/suit`).then((r) => (r.ok ? r.json() : null)).then((j) => { if (vivo && j) setE(j) }).catch(() => {})
    return () => { vivo = false }
  }, [id])
  if (!e) return null
  const ult = e.dias[0]
  const pend = e.pendentes.reduce((s, p) => s + p.n, 0)
  return (
    <div data-testid="faixa-da-suit" className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2 text-xs ${e.parado ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
      {e.parado ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <Zap className="h-4 w-4 shrink-0" />}
      <span className="font-medium">{e.parado ? 'A Suit parou de mandar as vendas' : 'Vendas de produtos entram sozinhas pela Suit'}</span>
      {e.ultimaLeitura && <span className="tabular-nums text-slate-500">última leitura {new Date(e.ultimaLeitura).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}</span>}
      {ult && <span className="tabular-nums">{fmtDia(ult.dia)}: {ROTULO[ult.status] ?? ult.status} · {brl(ult.totalCent)} · {ult.unidades} un</span>}
      <Link href={`/empresas/${id}/estoque/vendas/suit`} className={`ml-auto inline-flex h-7 items-center rounded-md px-2.5 font-medium ${pend ? 'bg-amber-500 text-white hover:bg-amber-600' : 'border border-emerald-300 hover:bg-emerald-100'}`}>
        {pend ? `Decidir ${pend} pedido${pend > 1 ? 's' : ''} que mudou na Suit` : 'Vendas ao vivo'}
      </Link>
    </div>
  )
}

/** a faixa dos SABORES (complementos) na aba deles — a mesma cara da dos produtos */
export function FaixaDosSabores({ desde }: { desde: string }) {
  return (
    <div data-testid="faixa-dos-sabores" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
      <Zap className="h-4 w-4 shrink-0" />
      <span className="font-medium">Sabores entram sozinhos pela Suit desde {desde}</span>
    </div>
  )
}

/** a pergunta quando o dono tenta subir o arquivo de PRODUTOS num dia que a Suit já entregou */
export function PerguntaDiaDaSuit({ dia, onSubir, onCancelar, oQue = 'vendas' }: { dia: string; onSubir: () => void; onCancelar: () => void; oQue?: string }) {
  return (
    <div data-testid="pergunta-dia-da-suit" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      <p className="font-medium">{oQue === 'vendas' ? 'As vendas' : 'Os sabores'} de {dia.split('-').reverse().join('/')} já {oQue === 'vendas' ? 'entraram sozinhas' : 'entraram sozinhos'} pela Suit.</p>
      <p className="mt-1 text-xs">Subir o arquivo por cima troca o dia inteiro pelo do arquivo (o estoque do dia é refeito). Só faça isso se a Suit estiver errada.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button onClick={onSubir} className="h-8 rounded-md bg-amber-600 px-3 text-xs font-medium text-white hover:bg-amber-700">Subir o arquivo por cima</button>
        <button onClick={onCancelar} className="h-8 rounded-md border border-amber-300 px-3 text-xs hover:bg-amber-100">Cancelar — fico com a Suit</button>
      </div>
    </div>
  )
}
