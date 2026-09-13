'use client'

// ESTOQUE FASE 1 item 4 — RECIBO do recebimento (URL estável, acessível depois). Mostra
// o que aquela conferência fez no estoque: itens conferidos (nota vs recebido, divergência),
// movimentos gerados (o que entrou), duplicatas sugeridas. Link da nota, da ficha, das Recebidas.

import { useEffect, useState, use, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Receipt, Loader2, ArrowLeft, Package, CheckCircle2, AlertTriangle, Camera, ExternalLink, CalendarPlus } from 'lucide-react'
import { DefinirParcelasDaNota } from '@/components/estoque/definir-parcelas-da-nota'

interface ReciboItem {
  xProd: string; itemNome: string | null; itemId: string | null; qtdNota: number; qtdRecebida: number | null
  unidadeNota: string | null; divergencia: boolean; motivo: string | null; temFoto: boolean
  quantidade: number | null; custoUnitario: number | null; custoTotal: number | null
}
interface Recibo {
  conferenceId: string; nfeId: string; chave: string; nNF: string | null; status: string; divergente: boolean
  confirmadoEm: string | null; fornecedor: { nome: string | null; cnpj: string | null }
  valorEntrada: number; vNF: number | null
  itens: ReciboItem[]; parcelas: ParcelaComEstado[]; conferidoPor: string | null
}

/**
 * ⭐⭐ AS PARCELAS COM ESTADO (13/09) — a resposta pra *"cadê a 002?"*.
 *
 * O dono abriu o card do Casper, não achou a parcela 002 da NF 967122, foi no Contas a
 * Pagar e **não achou em estado nenhum**. Ela estava PAGA e conciliada — e conta conciliada
 * sai do Contas a Pagar por decisão de 28/05 (senão a mesma linha aparece em duas telas).
 * **A nota é onde a pergunta nasce; passa a ser onde ela morre.**
 */
interface ParcelaComEstado {
  numero: string; valor: number; vencimento: string | null; origem: string
  estado: 'ABERTA' | 'PAGA' | 'PAGA_SEM_VINCULO' | 'SEM_CONTA' | 'A_DEFINIR'
  transactionId: string | null; pagaEm: string | null
  linha: { transactionId: string; data: string; valor: number; conta: string | null; descricao: string; diferenca: number } | null
  frase: string
}

const brl = (n: number | null) => (n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
const num = (n: number | null) => (n == null ? '—' : n.toLocaleString('pt-BR', { maximumFractionDigits: 3 }))
const fmtData = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—')
const fmtDia = (d: string | null) => (d ? d.split('-').reverse().join('/') : '—')

/** ⭐ o selo é o estado por EXTENSO — sigla e cor sozinhas obrigam a decorar legenda */
function SeloDaParcela({ estado }: { estado: ParcelaComEstado['estado'] }) {
  const m = {
    PAGA: ['bg-emerald-50 text-emerald-700', 'paga'],
    // ⛔ "paga sem vínculo" NÃO é "paga": ninguém apontou o dinheiro que saiu, e é esse
    // estado que o juiz F1 vigia como dupla contagem. Cor própria, nome próprio.
    PAGA_SEM_VINCULO: ['bg-amber-50 text-amber-700', 'paga — sem linha vinculada'],
    ABERTA: ['bg-slate-100 text-slate-600', 'em aberto'],
    SEM_CONTA: ['bg-slate-100 text-slate-500', 'não enviada ao financeiro'],
    // ⚠️ ÂMBAR, não cinza: "a definir" é TRABALHO PENDENTE, não informação neutra — é o
    // estado das 21 notas que ficaram fora do fluxo de caixa sem ninguém ver.
    A_DEFINIR: ['bg-amber-50 text-amber-700', 'sem vencimento'],
  }[estado]
  return <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${m[0]}`}>{m[1]}</span>
}

export default function ReciboPage({ params }: { params: Promise<{ id: string; conferenceId: string }> }) {
  const { id, conferenceId } = use(params)
  const [r, setR] = useState<Recibo | null | undefined>(undefined)
  const [definindo, setDefinindo] = useState(false)

  const carregar = useCallback(() => {
    fetch(`/api/empresas/${id}/estoque/recibos/${conferenceId}`).then((x) => x.json()).then((j) => setR(j.recibo ?? null)).catch(() => setR(null))
  }, [id, conferenceId])
  useEffect(() => { carregar() }, [carregar])

  if (r === undefined) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
  if (!r) return <div className="p-6 text-sm text-slate-500">Recibo não encontrado.</div>

  const diff = r.vNF != null ? Math.round((r.vNF - r.valorEntrada) * 100) / 100 : null

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <a href={`/empresas/${id}/estoque/recebimentos`} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"><ArrowLeft className="h-3.5 w-3.5" /> voltar pros recebimentos</a>

      {/* cabeçalho */}
      <div className="flex items-start gap-3">
        <Receipt className="h-7 w-7 shrink-0 text-[#185FA5]" />
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-slate-900">Recibo de recebimento</h1>
          <p className="text-sm text-slate-500">{r.fornecedor.nome ?? 'Fornecedor'}{r.nNF ? ` · nota nº ${r.nNF}` : ''} · {fmtData(r.confirmadoEm)}</p>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${r.divergente ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {r.divergente ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}{r.divergente ? 'Com divergência' : 'Conferida'}
        </span>
      </div>

      {/* resumo de valores */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Entrou no estoque</p><p className="text-lg font-semibold tabular-nums text-slate-900">{brl(r.valorEntrada)}</p><p className="text-[10px] text-slate-400">valor da mercadoria (vProd)</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Total da nota</p><p className="text-lg font-semibold tabular-nums text-slate-900">{brl(r.vNF)}</p><p className="text-[10px] text-slate-400">com impostos (a pagar)</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Diferença</p><p className="text-lg font-semibold tabular-nums text-slate-700">{brl(diff)}</p><p className="text-[10px] text-slate-400">ST / frete / IPI</p></CardContent></Card>
      </div>

      {/* itens */}
      <Card><CardContent className="p-0">
        <table className="hidden w-full text-sm sm:table">
          <thead><tr className="border-b border-slate-100 text-left text-xs text-slate-400">
            <th className="p-3 font-medium">Item</th><th className="p-3 text-right font-medium">Nota</th>
            <th className="p-3 text-right font-medium">Recebido</th><th className="p-3 text-right font-medium">Custo un.</th>
            <th className="p-3 text-right font-medium">Entrou</th>
          </tr></thead>
          <tbody>
            {r.itens.map((it, k) => (
              <tr key={k} className={`border-b border-slate-50 last:border-0 ${it.divergencia ? 'bg-amber-50/40' : ''}`}>
                <td className="p-3">
                  {it.itemId ? <a href={`/empresas/${id}/estoque/itens/${it.itemId}`} className="font-medium text-[#185FA5] hover:underline">{it.itemNome ?? it.xProd}</a> : <span className="font-medium text-slate-800">{it.xProd}</span>}
                  {it.divergencia && <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-medium text-amber-700">{it.motivo}{it.temFoto && <Camera className="h-3 w-3" />}</span>}
                </td>
                <td className="p-3 text-right tabular-nums text-slate-500">{num(it.qtdNota)} {it.unidadeNota}</td>
                <td className={`p-3 text-right tabular-nums ${it.divergencia ? 'font-semibold text-amber-700' : 'text-slate-700'}`}>{num(it.qtdRecebida)}</td>
                <td className="p-3 text-right tabular-nums text-slate-600">{brl(it.custoUnitario)}</td>
                <td className="p-3 text-right font-medium tabular-nums text-slate-900">{brl(it.custoTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* mobile */}
        <div className="divide-y divide-slate-50 sm:hidden">
          {r.itens.map((it, k) => (
            <div key={k} className={`p-4 ${it.divergencia ? 'bg-amber-50/40' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                {it.itemId ? <a href={`/empresas/${id}/estoque/itens/${it.itemId}`} className="font-medium text-[#185FA5]">{it.itemNome ?? it.xProd}</a> : <span className="font-medium text-slate-800">{it.xProd}</span>}
                <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{brl(it.custoTotal)}</span>
              </div>
              <div className="mt-1 text-xs text-slate-500">nota {num(it.qtdNota)} {it.unidadeNota} · recebido <span className={it.divergencia ? 'font-semibold text-amber-700' : ''}>{num(it.qtdRecebida)}</span> · {brl(it.custoUnitario)}/un</div>
              {it.divergencia && <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-amber-700"><AlertTriangle className="h-3 w-3" />{it.motivo}{it.temFoto && <Camera className="h-3 w-3" />}</div>}
            </div>
          ))}
        </div>
      </CardContent></Card>

      {/* ⭐⭐ AS PARCELAS COM ESTADO — nasce e morre aqui a pergunta "cadê a 002?" */}
      {r.parcelas.length > 0 && (
        <div>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><Package className="h-4 w-4" /> Parcelas da nota</h2>
          <Card><CardContent className="p-0">
            <table className="w-full text-sm">
              <tbody>
                {r.parcelas.map((p, k) => (
                  <tr key={k} className="border-b border-slate-50 last:border-0 align-top">
                    <td className="p-3 whitespace-nowrap text-slate-600">
                      Parcela {p.numero}
                      {p.origem === 'RENEGOCIADO' && <span className="ml-1.5 rounded bg-violet-50 px-1 py-0.5 text-[10px] font-medium text-violet-700">renegociada</span>}
                    </td>
                    <td className="p-3">
                      <SeloDaParcela estado={p.estado} />
                      <div className="mt-1 text-xs text-slate-500">{p.frase}</div>
                      {/* ⭐ O LINK QUE FECHA A PERGUNTA: a linha do extrato que pagou.
                          Sem ele o selo diria "paga" e o dono continuaria sem saber POR ONDE. */}
                      {p.linha && (
                        <a
                          href={`/transacoes?empresaId=${id}&inicio=${p.linha.data}&fim=${p.linha.data}&valorMin=${p.linha.valor}&valorMax=${p.linha.valor}`}
                          className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-violet-700 hover:underline"
                        >
                          ver a linha em Movimentações <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap text-right text-slate-500">{p.vencimento ? `vence ${fmtDia(p.vencimento)}` : '—'}</td>
                    <td className="p-3 text-right font-medium tabular-nums text-slate-900">{brl(p.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent></Card>
          {/* ⚠️ a frase antiga dizia que "a ponte pro financeiro está desligada" — ela foi
              LIGADA em 24/08 e as parcelas viram conta a pagar de verdade. Texto de tela que
              descreve o mundo antigo é a mesma doença do parágrafo da Conciliação (10/09). */}
          {/* ⭐⭐ O GESTO QUE ZERA A FILA (13/09): a nota A DEFINIR ganha onde combinar. */}
          {r.parcelas.some((p) => p.estado === 'A_DEFINIR') && (
            <button
              type="button"
              onClick={() => setDefinindo(true)}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700"
            >
              <CalendarPlus className="h-4 w-4" /> Definir parcelas e vencimentos
            </button>
          )}
          <p className="mt-1 text-[11px] text-slate-400">
            Conta paga e conciliada com o extrato sai do Contas a Pagar e vive em Movimentações — por isso o link.
          </p>
        </div>
      )}

      {definindo && (
        <DefinirParcelasDaNota
          empresaId={id}
          nfeId={r.nfeId}
          totalNota={r.vNF ?? r.valorEntrada}
          onFechar={() => setDefinindo(false)}
          onSalvo={carregar}
        />
      )}

      <p className="text-xs text-slate-400">Conferido por {r.conferidoPor ?? '—'} · chave {r.chave}</p>
    </div>
  )
}
