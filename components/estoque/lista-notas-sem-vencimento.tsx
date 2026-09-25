'use client'

// ⭐⭐ A FILA DAS NOTAS SEM VENCIMENTO — o F5 virando TELA (13/09/2026).
//
// **O dono:** *"lista das notas SEM_CONTA em Recebimentos — fornecedor · nº · total · data
// de entrada — cada uma abre no recibo pro gesto. É meu roteiro pra zerar as 21."*
//
// ⛔⛔ E ela é a metade que faltava do card: o card já dizia *"N notas sem data"* desde
// 04/09 e levava pra uma tela que **não listava nenhuma** — o dono via o número e não
// tinha por onde começar. É a "porta sem maçaneta" do outro lado, a 6ª volta da família.
//
// ⚠️ FRONTEIRA DE PAPEL: definir vencimento cria obrigação financeira → `stock.manage`.
// A operadora não vê a fila (e a rota por trás recusa, que é a trava de verdade).

import { useEffect, useState } from 'react'
import { CalendarClock, ChevronRight } from 'lucide-react'
import { usePermissoes } from '@/lib/hooks/use-permissoes'

interface Nota {
  nfeId: string; nNF: string | null; fornecedor: string | null
  total: number; entrouEm: string; conferenceId: string | null
  /** ⭐ 24/09 — null = precisa COMBINAR a data (F5) · com data = só falta MANDAR (F3) */
  dVenc: string | null
  suggestionIds: string[]
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dia = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')

export function ListaNotasSemVencimento({ empresaId }: { empresaId: string }) {
  const { pode, carregando } = usePermissoes(empresaId)
  const [notas, setNotas] = useState<Nota[] | null>(null)
  const [erro, setErro] = useState(false)
  /** ⭐ 24/09 — o gesto do F3: mandar o boleto que já tem data pro financeiro */
  const [enviando, setEnviando] = useState<string | null>(null)
  const [erroEnvio, setErroEnvio] = useState<string | null>(null)

  /**
   * ⭐⭐ REGRA 4 — vai pelo MESMO `POST /estoque/contas-a-pagar` que a conferência usa.
   * Uma segunda porta de criação de conta a pagar é o que o `@@unique` do
   * `stock_payable_link` existe pra recusar.
   */
  async function mandar(n: Nota) {
    setEnviando(n.nfeId); setErroEnvio(null)
    try {
      const r = await fetch(`/api/empresas/${empresaId}/estoque/contas-a-pagar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionIds: n.suggestionIds, cadastrarFornecedores: true }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErroEnvio(j?.erro ?? 'Não consegui mandar pro contas a pagar.'); return }
      // ⭐ some da fila na hora — e o número do card acompanha, porque os dois leem a mesma
      // pergunta. Recarregar a lista inteira seria mais lento e diria a mesma coisa.
      setNotas((atual) => (atual ?? []).filter((x) => x.nfeId !== n.nfeId))
    } catch {
      setErroEnvio('Falha de rede ao mandar pro contas a pagar.')
    } finally { setEnviando(null) }
  }

  useEffect(() => {
    let vivo = true
    fetch(`/api/empresas/${empresaId}/estoque/notas-sem-vencimento`)
      .then(async (r) => ({ ok: r.ok, j: await r.json().catch(() => null) }))
      .then(({ ok, j }) => { if (!vivo) return; if (!ok) { setErro(true); return } setNotas(j?.notas ?? []) })
      .catch(() => { if (vivo) setErro(true) })
    return () => { vivo = false }
  }, [empresaId])

  if (carregando || !pode('stock.manage')) return null

  // ⛔ ERRO NUNCA VIRA VAZIO: "nenhuma nota sem vencimento" é uma afirmação, e quando a
  // carga falha o sistema NÃO SABE. Foi assim que a tela da equipe disse "ninguém
  // cadastrado" com 17 pessoas no banco (09/09).
  if (erro) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-800">
        Não consegui carregar as notas sem vencimento — a ausência aqui não é prova de que não existem.
      </div>
    )
  }
  if (!notas || notas.length === 0) return null // ⭐ fila zerada = zero tela

  /**
   * ⭐⭐⭐ 24/09 — OS DOIS TRABALHOS, SEPARADOS, porque os GESTOS são diferentes.
   *
   * ⛔⛔ Esta tela nasceu em 13/09 pro **F5** (sem data) com a lição escrita no topo do
   * arquivo — e **o F3 ficou sem tela**: a parcela conferida COM data e nunca enviada não
   * aparecia em lugar nenhum. O boleto do IVAN (R$ 326,50) venceu em 14/09 e passou **10
   * dias** com o F3 gritando no e-mail e **nada na tela**. É literalmente o episódio de
   * 30/08 que o comentário deste arquivo cita como lição aprendida.
   *
   * ⚠️ Juntar os dois num contador só daria um número que não corresponde a nenhum gesto —
   * o erro que o card já cometeu em 04/09.
   */
  const semData = notas.filter((n) => !n.dVenc)
  const comData = notas.filter((n) => !!n.dVenc)
  const total = notas.reduce((s, n) => s + n.total, 0)
  const hojeISO = new Date().toISOString().slice(0, 10)

  return (
    <div id="sem-vencimento" className="rounded-xl border border-amber-200 bg-amber-50/60">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3.5 py-2.5">
        <CalendarClock className="h-4 w-4 shrink-0 text-amber-600" />
        <span className="text-[13px] font-semibold text-amber-900">
          {notas.length} {notas.length === 1 ? 'boleto não foi' : 'boletos não foram'} pro contas a pagar
          <span className="ml-1.5 tabular-nums font-bold">{brl(total)}</span>
        </span>
        {/* ⚠️ a frase diz o EFEITO, não o estado: "sem data" sozinho não explica por que
            isso é urgente. O que dói é o dinheiro fora do fluxo de caixa. */}
        <span className="w-full text-[11px] text-amber-700 sm:w-auto sm:ml-1">
          · elas não viraram conta a pagar e não aparecem no fluxo de caixa
        </span>
      </div>

      {/*
        ⭐ O GRUPO DO F3 — conferido, COM data, e é **um clique**: a data já é conhecida,
        então não há o que perguntar. O gesto vai pelo MESMO `POST /estoque/contas-a-pagar`
        que a conferência usa (REGRA 4 — nenhuma segunda porta de criação de conta).
      */}
      {comData.length > 0 && (
        <div className="border-t border-amber-200/70">
          <p className="px-3.5 pt-2 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
            já tem vencimento — só falta mandar
          </p>
          {comData.map((n) => {
            const vencido = !!n.dVenc && n.dVenc.slice(0, 10) < hojeISO
            return (
              <div key={n.nfeId} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-amber-100 px-3.5 py-2 last:border-0">
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-800">
                  {n.fornecedor ?? 'fornecedor não identificado'}
                </span>
                <span className="shrink-0 text-xs text-slate-500">NF {n.nNF ?? '—'}</span>
                <span className={`shrink-0 text-xs font-medium ${vencido ? 'text-rose-700' : 'text-slate-500'}`}>
                  {vencido ? 'venceu' : 'vence'} {dia(n.dVenc!)}
                </span>
                <span className="shrink-0 tabular-nums text-[13px] font-semibold text-slate-900">{brl(n.total)}</span>
                <button
                  onClick={() => void mandar(n)}
                  disabled={enviando === n.nfeId}
                  className="shrink-0 rounded-lg border border-amber-500 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                >
                  {enviando === n.nfeId ? 'mandando…' : 'mandar pro contas a pagar'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {semData.length > 0 && (
      <div className="border-t border-amber-200/70">
        <p className="px-3.5 pt-2 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
          sem data — combine com o fornecedor
        </p>
        {semData.map((n) => {
          const conteudo = (
            <>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-800">
                {n.fornecedor ?? 'fornecedor não identificado'}
              </span>
              <span className="shrink-0 text-xs text-slate-500">NF {n.nNF ?? '—'}</span>
              <span className="shrink-0 text-xs text-slate-400">entrou {dia(n.entrouEm)}</span>
              <span className="shrink-0 tabular-nums text-[13px] font-semibold text-slate-900">{brl(n.total)}</span>
            </>
          )
          // ⚠️ nota sem conferência não tem recibo pra abrir — em vez de um link morto
          // (que é pior que nenhum), a linha aparece cinza dizendo o porquê
          return n.conferenceId ? (
            <a
              key={n.nfeId}
              href={`/empresas/${empresaId}/estoque/recibos/${n.conferenceId}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-amber-100 px-3.5 py-2 last:border-0 hover:bg-amber-100/50"
            >
              {conteudo}
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-amber-600" />
            </a>
          ) : (
            <div key={n.nfeId} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-amber-100 px-3.5 py-2 opacity-60 last:border-0">
              {conteudo}
              <span className="shrink-0 text-[11px] text-slate-500">confira a nota primeiro</span>
            </div>
          )
        })}
      </div>
      )}
      {erroEnvio && (
        <p className="border-t border-amber-200/70 px-3.5 py-2 text-[12px] text-rose-700">{erroEnvio}</p>
      )}
    </div>
  )
}
