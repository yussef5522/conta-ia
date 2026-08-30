'use client'

// ⭐⭐ A FILA DE ENVIO VIROU UM CARD — E ZERO BOLETO = ZERO TELA (30/08/2026).
//
// Depois da ponte, o boleto enviado vira conta a pagar do FINANCEIRO. A tela
// `/estoque/contas-a-pagar` virou duplicata: mostrava dívida que já morava lá.
// **DÍVIDA MORA NUM LUGAR SÓ.** Saiu da sidebar; o que sobrou vivo dela — a FILA DE
// ENVIO, que é trabalho do estoque, não dívida — é este card.
//
// ⛔⛔ E ELE NÃO É CONVENIÊNCIA: é o que impede o caso de 30/08. A conferência do dia
// verificou 8 boletos (R$ 21.968,02) que ficaram parados semanas sem chegar ao Contas a
// Pagar — R$ 6.237,26 deles VENCIDOS. O juiz F3 gritava desde sempre, por e-mail, e
// ninguém viu. Um card na tela que o dono abre todo dia vê o que um e-mail noturno não
// consegue mostrar.
//
// ⚠️ O RELÓGIO SÓ EXIBE, NÃO DECIDE: o "já venceu / vence hoje" é rótulo de tela. Nada
// aqui filtra, descarta ou classifica por data — a régua do módulo continua valendo.
//
// ⚠️ FRONTEIRA DE PAPEL: enviar boleto é `stock.manage` (obrigação financeira é decisão
// do dono). A OPERADORA não vê este card. E, diferente da sidebar — onde o menu aparece
// inteiro enquanto carrega, pra não sumir item na cara de quem já está lendo —, aqui a
// espera é o certo: um card que aparece e some parece defeito; aparecer meio segundo
// depois não incomoda ninguém.

import { useEffect, useState } from 'react'
import { Receipt, AlertTriangle, ChevronRight } from 'lucide-react'
import { usePermissoes } from '@/lib/hooks/use-permissoes'
import { resumoDaFila } from '@/lib/stock/ponte/fila-envio'

interface Pendente { suggestionId: string; valor: number; dVenc: string | null; fornecedorNome: string }

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function CardFilaBoletos({ empresaId }: { empresaId: string }) {
  const { pode, carregando } = usePermissoes(empresaId)
  const [fila, setFila] = useState<Pendente[] | null>(null)

  useEffect(() => {
    let vivo = true
    fetch(`/api/empresas/${empresaId}/estoque/contas-a-pagar`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (vivo) setFila((j?.pendentes ?? []) as Pendente[]) })
      .catch(() => { if (vivo) setFila([]) }) // falha macia: sem card, nunca uma tela quebrada
    return () => { vivo = false }
  }, [empresaId])

  if (carregando || !pode('stock.manage')) return null
  if (!fila || fila.length === 0) return null // ⭐ zero boletos = zero tela

  // ⭐ a régua mora em `lib/stock/ponte/fila-envio.ts` (pura, testada contra os 8 boletos
  // reais). O componente só ECOA — assim o que decide o vermelho dá pra provar.
  const r = resumoDaFila(fila, new Date())

  return (
    <a
      href={`/empresas/${empresaId}/estoque/contas-a-pagar`}
      className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border px-3.5 py-2.5 transition-colors ${
        r.alerta
          ? 'border-rose-200 bg-rose-50 hover:bg-rose-100/70'
          : 'border-amber-200 bg-amber-50 hover:bg-amber-100/70'
      }`}
    >
      {r.alerta
        ? <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
        : <Receipt className="h-4 w-4 shrink-0 text-amber-600" />}

      <span className={`text-[13px] font-semibold ${r.alerta ? 'text-rose-800' : 'text-amber-800'}`}>
        {r.n} {r.n === 1 ? 'boleto aguardando' : 'boletos aguardando'} envio ao financeiro
        <span className="ml-1.5 tabular-nums font-bold">{brl(r.total)}</span>
      </span>

      {r.alerta && (
        <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-semibold text-white tabular-nums">
          {r.vencidos > 0 && `${r.vencidos} vencido${r.vencidos > 1 ? 's' : ''}`}
          {r.vencidos > 0 && r.hoje > 0 && ' · '}
          {r.hoje > 0 && `${r.hoje} vence${r.hoje > 1 ? 'm' : ''} hoje`}
          {` · ${brl(r.valorUrgente)}`}
        </span>
      )}

      <span className={`ml-auto inline-flex items-center gap-1 text-xs font-medium ${r.alerta ? 'text-rose-700' : 'text-amber-700'}`}>
        revisar e enviar <ChevronRight className="h-3.5 w-3.5" />
      </span>
    </a>
  )
}
