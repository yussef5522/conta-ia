// Sprint PF Fatia 2 — Lista de cartões do perfil.

'use client'

import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, CreditCard as CardIcon, Loader2, AlertTriangle, CheckCircle2, FileUp, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type EstadoDaFatura = 'ABERTA' | 'FECHADA' | 'VENCE_HOJE' | 'VENCIDA' | 'PAGA' | 'SEM_FATURA'

interface FaturaNoCard {
  estado: EstadoDaFatura
  tom: 'neutro' | 'atencao' | 'alerta' | 'ok'
  frase: string
  invoiceId: string | null
  valor: number | null
  cicloCorrenteSemFatura: boolean
}

interface PagamentoSugerido {
  transacaoId: string
  data: string
  descricao: string
  valor: number
  contaNome: string | null
  distanciaDias: number
}

interface CardItem {
  id: string
  name: string
  bankName: string | null
  brand: string | null
  lastDigits: string | null
  creditLimit: number
  closingDay: number
  dueDay: number
  fatura: FaturaNoCard
  pagamentoSugerido: PagamentoSugerido | null
}

/**
 * ⭐⭐ O TOM DA LINHA DA FATURA — decidido no SERVIDOR (`estadoDaFaturaNoCard`), aqui só
 * pintado. A tela não escolhe cor por conta própria: se ela derivasse o tom do estado,
 * seriam duas derivações da mesma pergunta e elas divergiriam no primeiro estado novo.
 */
const TOM: Record<FaturaNoCard['tom'], { caixa: string; texto: string }> = {
  alerta: { caixa: 'border-rose-200 bg-rose-50', texto: 'text-rose-800' },
  atencao: { caixa: 'border-amber-200 bg-amber-50', texto: 'text-amber-900' },
  ok: { caixa: 'border-emerald-200 bg-emerald-50', texto: 'text-emerald-800' },
  neutro: { caixa: 'border-zinc-200 bg-zinc-50', texto: 'text-zinc-700' },
}

function IconeDoEstado({ estado }: { estado: EstadoDaFatura }) {
  if (estado === 'VENCIDA' || estado === 'VENCE_HOJE') return <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
  if (estado === 'PAGA') return <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
  if (estado === 'SEM_FATURA') return <FileUp className="h-3.5 w-3.5 shrink-0" />
  return <Clock className="h-3.5 w-3.5 shrink-0" />
}

function formatBRL(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}

export default function CartoesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [cards, setCards] = useState<CardItem[]>([])
  const [loading, setLoading] = useState(true)
  const [vinculando, setVinculando] = useState<string | null>(null)

  const carregar = useCallback(() => {
    fetch(`/api/perfis/${id}/cartoes`)
      .then((r) => r.json())
      .then((d) => setCards(d.cards ?? []))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { carregar() }, [carregar])

  /**
   * ⭐ CONFIRMAR O PAGAMENTO — o clique é do dono; o resto é derivado.
   *
   * ⛔ Depois de vincular, a lista é RELIDA do servidor em vez de eu pintar "paga ✓" no
   * cliente: o estado da fatura é derivado lá, e estimá-lo aqui criaria a segunda
   * derivação que sempre diverge.
   */
  const confirmarPagamento = useCallback(async (c: CardItem) => {
    if (!c.pagamentoSugerido || !c.fatura.invoiceId) return
    setVinculando(c.id)
    try {
      const r = await fetch(
        `/api/perfis/${id}/cartoes/${c.id}/faturas/${c.fatura.invoiceId}/casar-pagamento`,
        {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactionId: c.pagamentoSugerido.transacaoId }),
        },
      )
      if (!r.ok) {
        const b = await r.json().catch(() => ({}))
        alert(b?.erro ?? 'Não deu pra registrar o pagamento.')
        return
      }
      carregar()
    } finally { setVinculando(null) }
  }, [id, carregar])

  return (
    <div>
      <Link
        href={`/perfis/${id}`}
        className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900 mb-3"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao perfil
      </Link>

      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Cartões de crédito</h1>
          <p className="text-sm text-zinc-600">
            Múltiplos cartões, limites, faturas e parcelamento.
          </p>
        </div>
        <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Link href={`/perfis/${id}/cartoes/novo`}>
            <Plus className="h-4 w-4 mr-1" />
            Novo cartão
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : cards.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <CardIcon className="h-10 w-10 mx-auto text-zinc-300 mb-3" />
            <h2 className="font-semibold text-zinc-900 mb-1">Nenhum cartão ainda</h2>
            <p className="text-sm text-zinc-600 max-w-md mx-auto mb-4">
              Cadastre seu cartão com limite, dia de fechamento e vencimento.
              Depois lance suas compras à vista ou parceladas.
            </p>
            <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Link href={`/perfis/${id}/cartoes/novo`}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar cartão
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((c) => (
            <Link key={c.id} href={`/perfis/${id}/cartoes/${c.id}`} className="group">
              <Card className="hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer h-full">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white">
                      <CardIcon className="h-5 w-5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-zinc-900 group-hover:text-emerald-700 truncate">
                        {c.name}
                      </h3>
                      <p className="text-xs text-zinc-500 truncate">
                        {c.bankName}
                        {c.brand && ` · ${c.brand}`}
                        {c.lastDigits && ` · ****${c.lastDigits}`}
                      </p>
                    </div>
                  </div>
                  {/* ⭐⭐ A LINHA DA FATURA VEM PRIMEIRO — é a pergunta que faz o dono
                      abrir a tela. O limite e o ciclo são cadastro, e cadastro não muda:
                      eles descem pro rodapé. */}
                  <div className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12.5px] font-medium ${TOM[c.fatura.tom].caixa} ${TOM[c.fatura.tom].texto}`}>
                    <IconeDoEstado estado={c.fatura.estado} />
                    <span className="min-w-0 truncate">{c.fatura.frase}</span>
                  </div>

                  {/* ⛔ AUSÊNCIA NUNCA VIRA CARA DE "TUDO CERTO": o card pode estar
                      mostrando uma VENCIDA de julho e não ter a do ciclo de agora — as
                      duas coisas são verdade, e as duas aparecem. */}
                  {c.fatura.cicloCorrenteSemFatura && c.fatura.estado !== 'SEM_FATURA' && (
                    <p className="mt-1.5 flex items-center gap-1 text-[11.5px] text-zinc-500">
                      <FileUp className="h-3 w-3 shrink-0" />
                      sem fatura importada deste ciclo
                    </p>
                  )}

                  {/* ⭐⭐ O PAGAMENTO QUE APARECEU NO EXTRATO — com o motivo à vista.
                      ⛔ O sistema NÃO casa sozinho: o dono tem 4 cartões e valores podem
                      se parecer; marcar uma fatura como paga com o dinheiro de outra é
                      caro de desfazer. Ele confirma uma vez, e daí em diante o "paga ✓"
                      é derivado sem ele tocar em nada. */}
                  {c.pagamentoSugerido && (
                    <div
                      onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
                      className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-2.5 py-2"
                    >
                      <p className="text-[11.5px] leading-relaxed text-emerald-900">
                        Achei um débito de <b>{formatBRL(c.pagamentoSugerido.valor)}</b> em{' '}
                        {c.pagamentoSugerido.data.split('-').reverse().join('/')}
                        {c.pagamentoSugerido.contaNome ? ` na ${c.pagamentoSugerido.contaNome}` : ''} —
                        valor exato da fatura. É o pagamento?
                      </p>
                      <Button
                        size="sm"
                        disabled={vinculando === c.id}
                        onClick={() => confirmarPagamento(c)}
                        className="mt-1.5 h-7 px-2.5 text-[11.5px]"
                      >
                        {vinculando === c.id ? 'registrando…' : 'Sim, é o pagamento'}
                      </Button>
                    </div>
                  )}

                  <div className="mt-3 flex items-baseline justify-between gap-2 border-t border-zinc-100 pt-2 text-[11.5px] text-zinc-500">
                    <span>Limite {formatBRL(c.creditLimit)}</span>
                    <span className="tabular-nums">fecha {c.closingDay} · vence {c.dueDay}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
