'use client'

/**
 * ⭐⭐⭐ O ASSISTENTE DE CONVERSÃO KG→UN — a varredura das 37 numa sentada (04/10/2026).
 *
 * **Pedido do dono:** *"Em vez de eu abrir uma por uma: um gesto guiado. Eu digito UM número →
 * PREVIEW mostra a ficha convertida → eu confirmo → vira versão nova. Lista de pendentes com
 * progresso (37 → 0) pra eu varrer numa sentada. Ficha continua sendo MINHA decisão: nada
 * converte sozinho."*
 *
 * ⛔⛔ **UMA FICHA ABERTA POR VEZ** — a régua de 10/09, e aqui ela vale mais que na conciliação:
 * duas fichas abertas com campos de número parecidos lado a lado é o caminho pra digitar o
 * número de uma na outra. **Com uma por vez, o estado ruim é inalcançável** (REGRA 5).
 *
 * ⚠️ **A FRASE E O PREVIEW VÊM DO SERVIDOR.** Se a tela montasse a conta, ela prometeria um
 * material que a ordem não vai separar — e o dono descobriria com a carne na mão (a doença do
 * preview × confirm do import de OFX). A tela aqui **só desenha**.
 */

import { useEffect, useState, use, useCallback, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { fetchComTimeout } from '@/lib/http/fetch-com-timeout'
import { ArrowRight, CheckCircle2, ChevronRight, Loader2, Scale, Sparkles } from 'lucide-react'

/** ⭐ tokens das telas novas — cor só quando significa (o padrão do radar/produção) */
const C = {
  borda: 'rgba(0,0,0,0.08)', txt2: '#5F5E5A', txt3: '#888780', nomeTx: '#2C2C2A',
  primario: '#534AB7',
  verdeBg: '#EAF3DE', verdeTx: '#27500A',
  ambarBg: '#FAEEDA', ambarTx: '#633806',
  azulBg: '#E6F1FB', azulTx: '#0C447C',
  coralBg: '#FAECE7', coralTx: '#993C1D',
  zebra: '#FAF9F6',
}

interface Sugestao { origem: 'MEDIDO' | 'UM_POR_RECEITA' | 'NOME'; valor: number; porque: string }
interface Componente { itemId: string; nome: string; unidade: string; qtdPlanejada: number }
interface Pendente {
  fichaId: string; versaoAtual: number; nomeProduto: string; unidadeProduto: string
  loteBase: number; unidadeLoteBase: string; componentes: Componente[]
  dosePrincipal: number | null; medido: number | null; lotes: number
  sugestoes: { candidatas: Sugestao[]; recomendada: Sugestao | null; fontesDiscordam: boolean }
}
interface LinhaSep { nome: string; unidade: string; antes: number | null; depois: number | null; igual: boolean }
interface Preview {
  conversao: { loteBaseNovo: number; unidadeLoteBaseNova: string; soRotulo: boolean; componentes: (Componente & { qtdNova: number; intacta: boolean })[] }
  pedido: number; separacao: LinhaSep[]; separacaoIntacta: boolean; soRotulo: boolean
}
interface Fila { total: number; coerentes: number; pendentes: Pendente[]; progresso: { feitas: number; faltam: number; total: number } }

const n4 = (n: number | null) => (n == null ? '—' : n.toLocaleString('pt-BR', { maximumFractionDigits: 4 }))
const ORIGEM: Record<Sugestao['origem'], string> = {
  MEDIDO: 'o que seus lotes mediram',
  UM_POR_RECEITA: '1 receita = 1 unidade',
  NOME: 'o peso no nome',
}

export default function ConversaoDeLotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [fila, setFila] = useState<Fila | null | undefined>(undefined)
  /**
   * ⭐ `?ficha=` abre direto a ficha que o aviso da ordem apontou — lido no 1º render (como o
   * `?aba=`): em `useEffect` a tela piscaria fechada antes de abrir, e "cliquei e não vi nada"
   * é indistinguível de "o link não funciona".
   */
  const daUrl = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('ficha') : null
  const [aberta, setAberta] = useState<string | null>(daUrl)
  const [feitas, setFeitas] = useState<{ nome: string; efeito: string }[]>([])

  const carregar = useCallback(() => {
    return fetchComTimeout<Fila>(`/api/empresas/${id}/estoque/fichas/conversao`)
      .then((r) => setFila(r.ok ? r.data! : null))
      .catch(() => setFila(null))
  }, [id])

  useEffect(() => { void carregar() }, [carregar])

  const pendentes = fila?.pendentes ?? []
  const prog = fila?.progresso

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Scale className="h-5 w-5" style={{ color: C.primario }} />
          <h1 className="text-base font-semibold" style={{ color: C.nomeTx }}>Corrigir o lote das receitas</h1>
        </div>
        <p className="hidden text-xs lg:block" style={{ color: C.txt3 }}>
          Você pede produção em unidades — estas fichas declaram o lote em outra unidade, então o lote base
          não diz quantas unidades saem de uma receita. Corrija o rótulo uma vez e o aviso para.
        </p>
      </header>

      {/* ⭐ O PROGRESSO que o dono pediu (37 → 0) — e ele vem do SERVIDOR, não contado aqui */}
      {prog && (
        <Card><CardContent className="space-y-2 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[25px] font-medium tabular-nums" style={{ color: C.nomeTx }}>
              {prog.faltam}<span className="ml-1 text-[13px] font-normal" style={{ color: C.txt3 }}>
                {prog.faltam === 1 ? 'ficha pra corrigir' : 'fichas pra corrigir'}
              </span>
            </p>
            <p className="text-[13px] tabular-nums" style={{ color: C.txt2 }}>
              {prog.feitas} de {prog.total} já declaram o lote certo
            </p>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: C.zebra }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${prog.total ? Math.round((prog.feitas / prog.total) * 100) : 0}%`, background: C.primario }}
            />
          </div>
          {prog.faltam === 0 && (
            <p className="flex items-center gap-1.5 text-[13px]" style={{ color: C.verdeTx }}>
              <CheckCircle2 className="h-4 w-4" /> todas as receitas de produção declaram o lote na unidade do produto.
            </p>
          )}
        </CardContent></Card>
      )}

      {/* ⭐ o recibo das que acabaram de ser convertidas — "gravou e não disse nada" é o
          sucesso disfarçado (14/09); e aqui ele também dá a sensação de progresso na varredura */}
      {feitas.length > 0 && (
        <Card><CardContent className="space-y-1 p-4" style={{ background: C.verdeBg }}>
          <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: C.verdeTx }}>
            corrigidas agora ({feitas.length})
          </p>
          {feitas.map((f, i) => (
            <p key={i} className="text-[13px]" style={{ color: C.verdeTx }}>✓ <b>{f.nome}</b> — {f.efeito}</p>
          ))}
        </CardContent></Card>
      )}

      {fila === undefined && (
        <p className="flex items-center gap-2 text-sm" style={{ color: C.txt3 }}>
          <Loader2 className="h-4 w-4 animate-spin" /> lendo as fichas…
        </p>
      )}
      {/* ⛔ erro e vazio NUNCA juntos: sem a carga, o sistema não SABE se está vazio (09/09) */}
      {fila === null && (
        <Card><CardContent className="space-y-2 p-4" style={{ background: C.ambarBg }}>
          <p className="text-sm" style={{ color: C.ambarTx }}>Não consegui carregar as fichas.</p>
          <button onClick={() => { setFila(undefined); void carregar() }} className="text-xs underline" style={{ color: C.ambarTx }}>
            tentar de novo
          </button>
        </CardContent></Card>
      )}

      {fila && pendentes.length > 0 && (
        <div className="space-y-2">
          {pendentes.map((p, i) => (
            <LinhaDaFicha
              key={p.fichaId}
              empresaId={id}
              ficha={p}
              zebra={i % 2 === 1}
              aberta={aberta === p.fichaId}
              onAbrir={() => setAberta(aberta === p.fichaId ? null : p.fichaId)}
              onPronta={(efeito) => {
                setFeitas((xs) => [...xs, { nome: p.nomeProduto, efeito }])
                setAberta(null)
                void carregar()
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Uma linha da fila. Fechada mostra o problema em uma linha; aberta, o gesto inteiro.
 *
 * ⚠️ O preview é buscado **por ficha aberta**, não pra todas de uma vez: 37 previews no load
 * seriam 37 consultas pesadas pra uma tela em que o dono abre uma por vez — é a lição do badge
 * que virou 1,3 s (11/09).
 */
function LinhaDaFicha({ empresaId, ficha, zebra, aberta, onAbrir, onPronta }: {
  empresaId: string; ficha: Pendente; zebra: boolean; aberta: boolean
  onAbrir: () => void; onPronta: (efeito: string) => void
}) {
  const rec = ficha.sugestoes.recomendada
  /**
   * ⭐⭐ O CAMPO NASCE NO `loteBase` ATUAL quando não há recomendação — e isso é A LEI de 04/10:
   * a separação é neutra **exatamente** quando o número digitado é o lote de hoje (o caso "o
   * número estava certo, a UNIDADE estava errada", que é o diagnóstico das 37). Abrir no número
   * que não mexe no estoque é o que deixa o dono confortável pra varrer as 37.
   *
   * ⛔ E continua EDITÁVEL: nada converte sozinho.
   */
  const [valor, setValor] = useState(String(rec?.valor ?? ficha.loteBase).replace('.', ','))
  const [prev, setPrev] = useState<{ preview: Preview | null; frase: string | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const pedido = useRef(10)

  const num = Number(valor.replace(',', '.'))

  // ⚠️ `aberta` e `num` nas deps; `empresaId`/`ficha.fichaId` são estáveis. NUNCA função de
  // prop aqui — identidade instável vira o laço de 20 req/s de 14/09.
  useEffect(() => {
    if (!aberta || !(num > 0)) { setPrev(null); return }
    let vivo = true
    const t = setTimeout(() => {
      void fetchComTimeout<{ preview: Preview | null; frase: string | null }>(
        `/api/empresas/${empresaId}/estoque/fichas/${ficha.fichaId}/conversao?unidadesPorReceita=${num}&pedido=${pedido.current}`,
      ).then((r) => { if (vivo) setPrev(r.ok ? { preview: r.data!.preview, frase: r.data!.frase } : null) })
        .catch(() => { if (vivo) setPrev(null) })
    }, 250)
    return () => { vivo = false; clearTimeout(t) }
  }, [aberta, num, empresaId, ficha.fichaId])

  const confirmar = async () => {
    setErro(null)
    if (!(num > 0)) return setErro('Diga quantas unidades 1 receita produz.')
    setBusy(true)
    try {
      const r = await fetchComTimeout<{ ok?: boolean; efeito?: string; erro?: string }>(
        `/api/empresas/${empresaId}/estoque/fichas/${ficha.fichaId}/conversao`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ unidadesPorReceita: num }) },
      )
      if (!r.ok) { setErro(r.erro ?? 'Não consegui converter.'); return }
      onPronta(r.data?.efeito ?? 'lote corrigido')
    } finally { setBusy(false) }
  }

  return (
    <Card style={{ background: aberta ? '#FFFFFF' : zebra ? C.zebra : '#FFFFFF' }}>
      <CardContent className="p-0">
        {/* ─── cabeçalho: clicável inteiro, com afordância (a lição de 09/09) ─── */}
        <button
          onClick={onAbrir}
          aria-expanded={aberta}
          className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-black/[0.02]"
        >
          <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${aberta ? 'rotate-90' : ''}`} style={{ color: C.txt3 }} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-medium" style={{ color: C.nomeTx }}>{ficha.nomeProduto}</span>
            <span className="block text-[13px]" style={{ color: C.txt2 }}>
              a ficha diz <b className="tabular-nums">{n4(ficha.loteBase)} {ficha.unidadeLoteBase}</b> por receita ·
              o produto se conta em <b>{ficha.unidadeProduto}</b>
            </span>
          </span>
          <span className="hidden shrink-0 rounded-full px-2 py-0.5 text-[12px] tabular-nums sm:block" style={{ background: C.ambarBg, color: C.ambarTx }}>
            {ficha.lotes > 0 ? `${ficha.lotes} lote(s) medido(s)` : 'sem medição'}
          </span>
        </button>

        {aberta && (
          <div className="space-y-3 border-t px-4 py-3" style={{ borderColor: C.borda }}>
            {/* ─── o número ─── */}
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs" style={{ color: C.txt2 }}>
                Quantas <b>{ficha.unidadeProduto}</b> saem de 1 receita?
                <input
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  inputMode="decimal"
                  className="mt-1 block w-32 rounded-lg border py-2 px-3 text-sm tabular-nums"
                  style={{ borderColor: C.borda }}
                />
              </label>
              {/* ⭐ as sugestões como chips, cada uma COM A PROVENIÊNCIA no title — número sem
                  dizer de onde veio é chute com cara de autoridade */}
              <div className="flex flex-wrap gap-1.5">
                {ficha.sugestoes.candidatas.map((s) => (
                  <button
                    key={s.origem}
                    onClick={() => setValor(String(s.valor).replace('.', ','))}
                    title={s.porque}
                    className="rounded-full border px-2.5 py-1 text-[12px] tabular-nums hover:bg-black/[0.03]"
                    style={{
                      borderColor: rec?.origem === s.origem ? C.primario : C.borda,
                      color: rec?.origem === s.origem ? C.primario : C.txt2,
                    }}
                  >
                    {n4(s.valor)} <span className="opacity-70">· {ORIGEM[s.origem]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ⚠️ a DISCORDÂNCIA é dita, não escondida: "não sei qual é" é resposta (e aí o
                preview da dose é que decide — foi assim que a fórmula do nome caiu) */}
            {ficha.sugestoes.fontesDiscordam && (
              <p className="rounded-lg px-3 py-2 text-[13px]" style={{ background: C.ambarBg, color: C.ambarTx }}>
                As fontes discordam — nenhuma recomendação automática. Olhe a dose no preview abaixo antes de confirmar.
              </p>
            )}
            {ficha.sugestoes.candidatas.map((s) => (
              <p key={`p-${s.origem}`} className="text-[12px] leading-snug" style={{ color: C.txt3 }}>
                <b>{n4(s.valor)}</b> — {s.porque}
              </p>
            ))}

            {/* ─── o preview ─── */}
            {prev?.preview ? (
              <>
                <p
                  className="rounded-lg px-3 py-2 text-[13px] leading-snug"
                  style={
                    prev.preview.separacaoIntacta
                      ? { background: C.verdeBg, color: C.verdeTx }
                      : { background: C.coralBg, color: C.coralTx }
                  }
                >
                  {prev.frase}
                </p>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border px-3 py-2" style={{ borderColor: C.borda }}>
                    <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: C.txt3 }}>a ficha hoje</p>
                    <p className="text-[14px] tabular-nums" style={{ color: C.nomeTx }}>
                      1 receita = {n4(ficha.loteBase)} {ficha.unidadeLoteBase}
                    </p>
                  </div>
                  <div className="rounded-lg border px-3 py-2" style={{ borderColor: C.primario, background: '#F7F6FE' }}>
                    <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: C.primario }}>depois de corrigir</p>
                    <p className="text-[14px] tabular-nums" style={{ color: C.nomeTx }}>
                      1 receita = {n4(prev.preview.conversao.loteBaseNovo)} {prev.preview.conversao.unidadeLoteBaseNova}
                    </p>
                  </div>
                </div>

                {/* ⭐⭐ A TABELA QUE RESPONDE "ISSO MEXE NO MEU ESTOQUE?" */}
                <div className="overflow-x-auto">
                  <table className="density-normal w-full">
                    <thead>
                      <tr>
                        <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide" style={{ color: C.txt3 }}>componente</th>
                        <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide" style={{ color: C.txt3 }}>dose hoje</th>
                        <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide" style={{ color: C.txt3 }}>dose depois</th>
                        <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide" style={{ color: C.txt3 }}>
                          separa hoje ({n4(prev.preview.pedido)} {ficha.unidadeProduto})
                        </th>
                        <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide" style={{ color: C.txt3 }}>separa depois</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prev.preview.conversao.componentes.map((c, i) => {
                        const sep = prev.preview!.separacao[i]
                        return (
                          <tr key={c.itemId} style={{ background: i % 2 === 1 ? C.zebra : undefined }}>
                            <td className="px-3 py-0 text-[13px]" style={{ color: C.nomeTx }}>{c.nome}</td>
                            <td className="px-3 py-0 text-right text-[13px] tabular-nums" style={{ color: C.txt2 }}>{n4(c.qtdPlanejada)} {c.unidade}</td>
                            <td className="px-3 py-0 text-right text-[13px] tabular-nums" style={{ color: c.intacta ? C.txt2 : C.coralTx }}>{n4(c.qtdNova)} {c.unidade}</td>
                            <td className="px-3 py-0 text-right text-[13px] tabular-nums" style={{ color: C.txt2 }}>{n4(sep?.antes ?? null)}</td>
                            <td className="px-3 py-0 text-right text-[13px] tabular-nums font-medium" style={{ color: sep?.igual ? C.verdeTx : C.coralTx }}>
                              {n4(sep?.depois ?? null)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="text-[13px]" style={{ color: C.txt3 }}>
                {num > 0 ? 'calculando o preview…' : 'digite quantas unidades saem de 1 receita.'}
              </p>
            )}

            {erro && <p className="text-xs" style={{ color: C.coralTx }}>{erro}</p>}

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={confirmar}
                disabled={busy || !prev?.preview}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                style={{ background: C.primario }}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Confirmar — vira versão {ficha.versaoAtual + 1}
              </button>
              <a
                href={`/empresas/${empresaId}/estoque/fichas/${ficha.fichaId}`}
                className="inline-flex items-center gap-1 text-[13px] hover:underline"
                style={{ color: C.azulTx }}
              >
                abrir a ficha inteira <ArrowRight className="h-3 w-3" />
              </a>
              {/* ⚠️ a versão anterior FICA — o rastro da conversão É a versão */}
              <span className="text-[12px]" style={{ color: C.txt3 }}>a versão {ficha.versaoAtual} fica no histórico</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
