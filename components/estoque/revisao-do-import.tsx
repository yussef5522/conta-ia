'use client'

// ⭐⭐⭐ A REVISÃO DO IMPORT — O PADRÃO DO EXTRATO DE BANCO (14/09/2026).
//
// **O dono:** *"o que chegou · com quem está vinculado · **ajusto ali mesmo**"*.
//
// ⛔ Antes o import baixava por baixo e mostrava um resumo; o ajuste morava na prateleira,
// noutra tela. É a "porta sem maçaneta" de cabeça pra baixo: o gesto existe e mora longe
// de onde a pergunta nasce.
//
// ⚠️ REGRA 12: a mesma tela nos dois viewports — no celular cada linha vira um bloco (o
// destino embaixo do nome), no monitor vira tabela. **Mesmos dados, uma fonte.**

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Check, AlertTriangle, Search, Link2, EyeOff } from 'lucide-react'

export interface LinhaRevisaoDTO {
  nome: string
  ocorrencias: number
  estado: 'VINCULADO' | 'SEM_VINCULO' | 'IGNORADO'
  destinoId: string | null
  destinoNome: string | null
  baixa: { itemNome: string; qtd: number }[]
  sugestao: { fichaId: string; rotulo: string; porQue: string } | null
  ignoradoEm: string | null
}
export interface RevisaoDTO {
  data: string
  relatorio: 'PRODUTOS' | 'COMPLEMENTOS'
  linhas: LinhaRevisaoDTO[]
  contadores: { vinculados: number; semVinculo: number; ignorados: number }
  ocorrencias: { vinculadas: number; semVinculo: number; ignoradas: number }
}

type Filtro = 'TODOS' | 'SEM_VINCULO' | 'VINCULADO' | 'IGNORADO'

const SELO = {
  VINCULADO: { cor: 'bg-emerald-50 text-emerald-700', icone: '✅', texto: 'vinculado' },
  SEM_VINCULO: { cor: 'bg-amber-50 text-amber-800', icone: '🟡', texto: 'sem destino' },
  IGNORADO: { cor: 'bg-slate-100 text-slate-500', icone: '⚪', texto: 'ignorado' },
} as const

export function RevisaoDoImport({
  empresaId, data, relatorio, onMudou,
}: {
  empresaId: string
  data: string
  relatorio: 'PRODUTOS' | 'COMPLEMENTOS'
  /** chamado depois de qualquer ajuste — a tela de trás recarrega */
  onMudou?: () => void
}) {
  const [rev, setRev] = useState<RevisaoDTO | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('TODOS')
  const [busca, setBusca] = useState('')
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ mudam: { nome: string; frase: string }[]; inalterados: number } | null>(null)
  const [gravando, setGravando] = useState(false)

  const carregar = useCallback(async () => {
    const r = await fetch(`/api/empresas/${empresaId}/estoque/vendas/revisao?data=${data}&relatorio=${relatorio}`)
    const j = await r.json().catch(() => null)
    // ⛔ ERRO NUNCA VIRA VAZIO: "nenhuma linha" é uma afirmação, e quando a carga falha o
    // sistema NÃO SABE (a lição da tela da equipe, 09/09).
    if (!r.ok) { setErro(j?.erro ?? 'Não consegui carregar a revisão deste import.'); return }
    setErro(null)
    setRev(j.revisao)
  }, [empresaId, data, relatorio])

  useEffect(() => { void carregar() }, [carregar])

  /**
   * ⭐⭐ GRAVA PELAS ROTAS QUE JÁ EXISTEM — nenhuma porta de escrita nova (REGRA 4).
   *
   * ⚠️ Os dois mapas têm CONTRATOS diferentes de propósito (produtos aceita REVENDA, o de
   * complementos aceita IGNORAR/LIMPAR) — são dois mapas desde 02/09, porque 25 nomes
   * vivem nos dois relatórios e um mapa só faria cada um baixar duas vezes. A tradução
   * mora AQUI, num lugar; uniformizar as rotas quebraria um dos dois guards.
   */
  async function aplicar(nome: string, corpo: { alvoTipo: 'FICHA' | 'IGNORAR'; fichaId?: string }) {
    setOcupado(nome)
    try {
      const comp = relatorio === 'COMPLEMENTOS'
      const url = comp
        ? `/api/empresas/${empresaId}/estoque/vendas/complementos/mapear`
        : `/api/empresas/${empresaId}/estoque/vendas/mapear`
      const body = comp
        ? { nomeSuitable: nome, destino: corpo.alvoTipo, fichaId: corpo.fichaId }
        : { nomeSuitable: nome, alvoTipo: corpo.alvoTipo, fichaId: corpo.fichaId }
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui gravar o destino.'); return }
      await carregar()
      await verPreview()
      onMudou?.()
    } finally { setOcupado(null) }
  }

  async function verPreview() {
    const r = await fetch(`/api/empresas/${empresaId}/estoque/vendas/revisao`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data, relatorio, confirmar: false }),
    })
    const j = await r.json().catch(() => null)
    if (r.ok) setPreview(j.preview)
  }

  async function reprocessar() {
    setGravando(true)
    try {
      const r = await fetch(`/api/empresas/${empresaId}/estoque/vendas/revisao`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ data, relatorio, confirmar: true, confirmouSanidade: true }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui reprocessar o dia.'); return }
      setPreview(null)
      await carregar()
      onMudou?.()
    } finally { setGravando(false) }
  }

  if (erro && !rev) {
    return <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-900">{erro}</div>
  }
  if (!rev) return <div className="flex items-center gap-2 p-4 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> abrindo a revisão…</div>

  const visiveis = rev.linhas
    .filter((l) => filtro === 'TODOS' || l.estado === filtro)
    .filter((l) => !busca.trim() || l.nome.toLowerCase().includes(busca.trim().toLowerCase()))

  return (
    <div className="space-y-3">
      {/* ⭐ os 3 contadores — a MESMA lista que a tela desenha, nunca outra contagem */}
      <div className="flex flex-wrap items-center gap-1.5">
        {([
          ['SEM_VINCULO', `${rev.contadores.semVinculo} sem destino`, `${rev.ocorrencias.semVinculo} ocorr.`],
          ['VINCULADO', `${rev.contadores.vinculados} baixam`, `${rev.ocorrencias.vinculadas} ocorr.`],
          ['IGNORADO', `${rev.contadores.ignorados} ignorados`, `${rev.ocorrencias.ignoradas} ocorr.`],
        ] as const).map(([k, rotulo, sub]) => (
          <button
            key={k}
            type="button"
            onClick={() => setFiltro(filtro === k ? 'TODOS' : k)}
            className={`rounded-lg px-2.5 py-1.5 text-left text-[12px] font-semibold transition ${SELO[k].cor} ${filtro === k ? 'ring-2 ring-offset-1 ring-slate-400' : ''}`}
          >
            {rotulo}
            <span className="ml-1 font-normal opacity-70">· {sub}</span>
          </button>
        ))}
        <div className="relative ml-auto w-full sm:w-auto">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="procurar um nome…"
            className="h-8 w-full rounded-lg border border-slate-300 pl-7 pr-2 text-xs sm:w-[220px]"
          />
        </div>
      </div>

      {erro && <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{erro}</div>}

      {/* ⭐⭐ O PREVIEW DO AJUSTE — nada baixa pro destino novo sem ele */}
      {preview && preview.mudam.length > 0 && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
          <p className="text-[13px] font-semibold text-violet-900">
            {preview.mudam.length} {preview.mudam.length === 1 ? 'nome mudou' : 'nomes mudaram'} de destino
            <span className="ml-1 font-normal text-violet-700">· {preview.inalterados} seguem como estavam</span>
          </p>
          <ul className="mt-1 space-y-0.5 text-[12px] text-violet-800">
            {preview.mudam.map((m) => <li key={m.nome}>· {m.frase}</li>)}
          </ul>
          <button
            type="button" onClick={reprocessar} disabled={gravando}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
          >
            {gravando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            aplicar no dia {data.split('-').reverse().join('/')}
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200">
        {visiveis.length === 0 && (
          <p className="px-3 py-4 text-[13px] text-slate-500">
            {busca.trim() ? `Nenhum nome com "${busca}".` : 'Nada neste filtro.'}
          </p>
        )}
        {visiveis.map((l) => {
          const s = SELO[l.estado]
          return (
            <div key={l.nome} className="flex flex-col gap-1.5 border-b border-slate-100 px-3 py-2.5 last:border-0 sm:flex-row sm:items-center sm:gap-3">
              <div className="min-w-0 flex-1">
                <span className="text-[13px] font-medium text-slate-800">{l.nome}</span>
                <span className="ml-1.5 text-xs tabular-nums text-slate-400">{l.ocorrencias}×</span>
              </div>

              <div className="min-w-0 flex-1 text-[12px]">
                <span className={`mr-1.5 rounded px-1.5 py-0.5 text-[11px] font-semibold ${s.cor}`}>{s.icone} {s.texto}</span>
                {/* ⭐ O RESUMO DO QUE DESCONTA, à vista — "vinculado" sem isso é cego */}
                {l.estado === 'VINCULADO' && (
                  <span className="text-slate-600">
                    → {l.destinoNome}
                    {l.baixa.length > 0 && <span className="text-slate-400"> (baixa: {l.baixa.map((b) => `${b.itemNome} ×${b.qtd}`).join(' + ')})</span>}
                  </span>
                )}
                {l.estado === 'IGNORADO' && <span className="text-slate-500">→ fora do estoque (por você, em {l.ignoradoEm?.split('-').reverse().join('/')})</span>}
                {l.estado === 'SEM_VINCULO' && !l.sugestao && <span className="text-amber-700">→ escolher destino</span>}
                {/* ⭐⭐ A SUGESTÃO É MARCADA COMO SUGESTÃO — o clique é do dono */}
                {l.estado === 'SEM_VINCULO' && l.sugestao && (
                  <span className="text-amber-800">
                    parece <b>{l.sugestao.rotulo}</b>
                    <button
                      type="button" disabled={ocupado === l.nome}
                      onClick={() => aplicar(l.nome, { alvoTipo: 'FICHA', fichaId: l.sugestao!.fichaId })}
                      className="ml-1.5 rounded bg-amber-600 px-1.5 py-0.5 text-[11px] font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                    >
                      {ocupado === l.nome ? '…' : 'usar'}
                    </button>
                  </span>
                )}
              </div>

              {/* ⭐ AÇÕES EM TODA LINHA — inclusive na vinculada: vínculo errado se conserta aqui */}
              <div className="flex shrink-0 items-center gap-1">
                <a
                  href={`/empresas/${empresaId}/estoque/cardapio?nome=${encodeURIComponent(l.nome)}`}
                  className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-300 px-2 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                  title={l.estado === 'VINCULADO' ? 'trocar o destino' : 'definir o destino'}
                >
                  <Link2 className="h-3 w-3" /> {l.estado === 'VINCULADO' ? 'trocar' : 'definir'}
                </a>
                {/* ⚠️⚠️ "IGNORAR" SÓ EXISTE NO MAPA DE COMPLEMENTOS — o de produtos aceita
                    FICHA | REVENDA | REMOVER, e REMOVER **devolve a pendente**, que é outra
                    coisa. Oferecer o botão aqui e mandar REMOVER faria o nome voltar pra
                    fila em vez de sair dela: **um gesto que promete uma coisa e faz outra**.
                    Fica registrado como o que falta no mapa de produtos, não disfarçado. */}
                {relatorio === 'COMPLEMENTOS' && l.estado !== 'IGNORADO' && (
                  <button
                    type="button" disabled={ocupado === l.nome}
                    onClick={() => aplicar(l.nome, { alvoTipo: 'IGNORAR' })}
                    className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-300 px-2 text-[11px] text-slate-500 hover:bg-slate-50 disabled:opacity-60"
                    title="não baixa estoque"
                  >
                    <EyeOff className="h-3 w-3" /> ignorar
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ⚠️ o aviso do que falta é PERMANENTE enquanto houver pendente — some quando zera */}
      {rev.contadores.semVinculo > 0 && (
        <p className="flex items-start gap-1.5 text-[12px] text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {rev.contadores.semVinculo} nome(s) sem destino não baixaram estoque — eles esperam a sua escolha e voltam no próximo import.
        </p>
      )}
    </div>
  )
}
