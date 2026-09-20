'use client'

// ⭐⭐⭐ RADAR DO ESTOQUE — a tela do mock aprovado (`docs/mocks/radar-do-estoque-mock.html`).
//
// **A régua:** *"o mock é a RÉGUA — igual primeiro, melhoria só com meu pedido."* O guard
// `__tests__/regras-ui/radar-bate-com-o-mock.test.ts` LÊ o HTML e compara os tokens.
//
// ⛔⛔ **TELA NOVA NASCE COM O GUARD** (a lição da lixeira, 20/09): `fetchComTimeout` +
// estados EXPLÍCITOS (`CARREGANDO | FALHOU | VAZIO | OK`) + "tentar de novo". *Enquanto
// "ausência de dado" servir de estado, o caso não previsto vira spinner eterno.*
//
// ⛔ **TEMA CLARO, decisão do dono (20/09):** *"o Radar nasce CLARO como o resto do app —
// nada de `prefers-color-scheme` sozinho (duas metades do sistema com temas diferentes,
// não)."* O mock guarda os dois temas versionados; ligar o dark global é sprint próprio,
// registrado como dívida com a conferência dos 107 arquivos no escopo.

import { useCallback, useEffect, useMemo, useRef, useState, use } from 'react'
import Link from 'next/link'
import { Radar, Loader2, Plus, X, ChevronRight, ChevronDown } from 'lucide-react'
import { fetchComTimeout } from '@/lib/http/fetch-com-timeout'
import { BuscaItem } from '@/components/estoque/busca-item'
import { RADAR, TOM } from '@/components/estoque/radar-tokens'
import type { RadarDoEstoque, LinhaDoRadar, Veredito } from '@/lib/stock/radar/fechamento'
import type { ChavePeriodo } from '@/lib/stock/radar/periodo'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const qtd = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
const br = (d: string) => d.split('-').reverse().slice(0, 2).join('/')

type Estado = 'CARREGANDO' | 'FALHOU' | 'OK'

/** ⭐ as pílulas do mock — o rótulo do período vem do SERVIDOR, nunca escrito aqui */
const PILULAS: { chave: ChavePeriodo; rotulo: string }[] = [
  { chave: 'ONTEM_HOJE', rotulo: 'ontem → hoje' },
  { chave: 'SETE_DIAS', rotulo: '7 dias' },
  { chave: 'MES', rotulo: 'mês' },
]

/** ⛔ o veredito EM DINHEIRO, com o semáforo semântico do mock */
function Pilula({ l }: { l: LinhaDoRadar }) {
  const t = TOM[l.veredito]
  const texto =
    l.veredito === 'SEM_CONTAGEM' ? 'falta contar hoje'
      : l.veredito === 'BATEU' ? '✓ bateu'
        : `${l.faltouValor! < 0 ? 'faltou' : 'sobrou'} ${brl(Math.abs(l.faltouValor!))}`
  return (
    <span className="shrink-0 whitespace-nowrap rounded-full px-[11px] py-[4px] text-[12.5px] font-extrabold tabular-nums"
      style={{ background: t.bg, color: t.cor }}>
      {texto}
    </span>
  )
}

/**
 * ⭐⭐ A CONTA DE PADEIRO — *"tinha ontem → comprou/produziu → vendeu → DEVIA TER →
 * CONTAMOS → FALTOU"*.
 *
 * ⛔ **Σ(conta) == veredito da linha, sempre** — o número de baixo é o MESMO da pílula de
 * cima, porque os dois saem do mesmo `l.conta`. Recalcular aqui seria a segunda régua.
 */
function ContaDePadeiro({ l, empresaId }: { l: LinhaDoRadar; empresaId: string }) {
  const c = l.conta!
  const un = l.unidadeControle
  return (
    <div className="border-t px-4 py-4" style={{ borderColor: RADAR.line, background: RADAR.roxoBg }}>
      {/* ⭐ A JANELA ESCRITA (decisão do dono): duas linhas da mesma tela podem falar de
          janelas diferentes, e esconder isso mentiria o tamanho do furo. */}
      <p className="mb-2.5 text-[11.5px] font-semibold" style={{ color: RADAR.sub }}>
        {c.desde
          ? <>desde a contagem de <b style={{ color: RADAR.ink }}>{br(c.desde)}</b>
            {c.diasDaJanela != null && <> — {c.diasDaJanela === 0 ? 'no mesmo dia' : `${c.diasDaJanela} dia${c.diasDaJanela > 1 ? 's' : ''}`}</>}</>
          : <>primeira contagem deste item — a janela é desde o começo do histórico</>}
      </p>
      <table className="w-full text-[13px]">
        <tbody>
          <tr>
            <td className="py-1.5" style={{ color: RADAR.sub }}>tinha</td>
            <td className="py-1.5 text-right font-bold tabular-nums">{qtd(c.tinha)} {un}</td>
          </tr>
          {c.baldes.map((b) => (
            <tr key={b.chave}>
              <td className="py-1.5" style={{ color: RADAR.sub }}>
                {b.rotulo}
                {b.movimentos > 0 && <span className="ml-1 opacity-70">({b.movimentos})</span>}
              </td>
              <td className="py-1.5 text-right font-bold tabular-nums">
                {b.qtd >= 0 ? '+' : '−'} {qtd(Math.abs(b.qtd))} {un}
              </td>
            </tr>
          ))}
          <tr className="border-t" style={{ borderColor: RADAR.line }}>
            <td className="pt-2 font-extrabold">DEVIA TER</td>
            <td className="pt-2 text-right font-extrabold tabular-nums">{qtd(c.deviaTer)} {un}</td>
          </tr>
          <tr>
            <td className="py-1.5 font-extrabold">CONTAMOS</td>
            <td className="py-1.5 text-right font-extrabold tabular-nums">{qtd(c.contamos)} {un}</td>
          </tr>
          <tr className="border-t-2" style={{ borderColor: c.faltouValor < 0 ? RADAR.coral : RADAR.verde }}>
            <td className="pt-2 text-[14.5px] font-extrabold" style={{ color: c.faltouValor < 0 ? RADAR.coral : RADAR.verde }}>
              {c.faltouValor < 0 ? 'FALTOU' : c.faltouValor > 0 ? 'SOBROU' : 'BATEU'}
            </td>
            <td className="pt-2 text-right text-[14.5px] font-extrabold tabular-nums"
              style={{ color: c.faltouValor < 0 ? RADAR.coral : RADAR.verde }}>
              {qtd(Math.abs(c.faltou))} {un} · {brl(Math.abs(c.faltouValor))}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ⛔ A CONTA QUE NÃO FECHA **DIZ** — nunca se esconde atrás de um número redondo */}
      {c.naoExplicado !== 0 && (
        <p className="mt-2.5 rounded-[10px] px-3 py-2 text-[12px] font-semibold"
          style={{ background: RADAR.ambarBg, color: RADAR.ambar }}>
          ⚠️ {qtd(Math.abs(c.naoExplicado))} {un} desta janela não têm movimento que explique
          (lançamento com data fora de ordem, ou ajuste avulso no meio).
        </p>
      )}

      <Link href={`/empresas/${empresaId}/estoque/movimentos?itemId=${l.itemId}`}
        className="mt-3 inline-block text-[12.5px] font-bold" style={{ color: RADAR.roxo }}>
        ver cada movimento →
      </Link>
    </div>
  )
}

function Bloco({ titulo, subtitulo, linhas, empresaId, lista, podeEditar, aoMudar }: {
  titulo: string; subtitulo: string; linhas: LinhaDoRadar[]; empresaId: string
  lista: 'CAROS' | 'PORCOES'; podeEditar: boolean; aoMudar: () => void
}) {
  const [aberta, setAberta] = useState<string | null>(null)
  const [adicionando, setAdicionando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  /**
   * ⚠️⚠️ **O GUARD DE FAMÍLIA PEGOU ISTO AQUI** (`spinner-eterno-nao-existe`, 14/09): o pai
   * monta `aoMudar` NOVO a cada render, então tê-la numa dep é **a bomba armada** do laço
   * de 20 req/s — hoje `mexer` só roda por GESTO, mas foi exatamente assim que o
   * `LinkPaymentModal` ficou com a mesma bomba esperando alguém ligar um efeito.
   * ⭐ A cura da casa: **função de prop vai pro ref**, e a dep some.
   */
  const aoMudarRef = useRef(aoMudar)
  useEffect(() => { aoMudarRef.current = aoMudar }, [aoMudar])

  const mexer = useCallback(async (metodo: 'POST' | 'DELETE', itemId: string) => {
    setErro(null)
    const url = `/api/empresas/${empresaId}/estoque/radar/watchlist`
    const r = metodo === 'POST'
      ? await fetchComTimeout<{ ok: boolean }>(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lista, itemId }),
      })
      : await fetchComTimeout<{ ok: boolean }>(`${url}?lista=${lista}&itemId=${itemId}`, { method: 'DELETE' })
    // ⛔ falhou é ESTADO, não silêncio: a lista não muda e a tela diz o porquê
    if (!r.ok) { setErro(r.erro ?? 'Não consegui mudar a lista.'); return }
    setAdicionando(false)
    aoMudarRef.current()
  }, [empresaId, lista])

  return (
    <section className="overflow-hidden rounded-[18px] border"
      style={{ background: RADAR.card, borderColor: RADAR.line, boxShadow: RADAR.sombra }}>
      <div className="flex items-start justify-between gap-2.5 px-4 pb-2.5 pt-3.5">
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-[.07em]" style={{ color: RADAR.sub }}>{titulo}</div>
          <div className="mt-[3px] text-[11px]" style={{ color: RADAR.sub }}>{subtitulo}</div>
        </div>
        {podeEditar && (
          <button type="button" onClick={() => setAdicionando((v) => !v)}
            className="shrink-0 whitespace-nowrap rounded-full border-[1.5px] border-dashed px-[11px] py-[5px] text-[11.5px] font-bold"
            style={{ borderColor: RADAR.line, color: RADAR.roxo }}>
            {adicionando ? 'fechar' : <><Plus className="mr-0.5 inline h-3 w-3" />adicionar</>}
          </button>
        )}
      </div>

      {adicionando && (
        <div className="border-t px-4 py-3" style={{ borderColor: RADAR.line }}>
          {/* ⭐ o seletor ÚNICO da casa, no universo da PRATELEIRA — o que se conta */}
          <BuscaItem
            companyId={empresaId}
            universo="PRATELEIRA"
            jaAdicionados={linhas.map((l) => l.itemId)}
            placeholder={lista === 'CAROS' ? 'buscar matéria-prima…' : 'buscar porção…'}
            onEscolher={(item) => void mexer('POST', item.id)}
          />
        </div>
      )}
      {erro && (
        <p className="border-t px-4 py-2 text-[12px] font-semibold"
          style={{ borderColor: RADAR.line, background: RADAR.coralBg, color: RADAR.coral }}>
          {erro}
        </p>
      )}

      {linhas.length === 0 && (
        <p className="border-t px-4 py-4 text-[13px]" style={{ borderColor: RADAR.line, color: RADAR.sub }}>
          Nenhum item nesta lista ainda — use o <b>+ adicionar</b> pra dizer o que você quer vigiar.
        </p>
      )}

      {linhas.map((l) => {
        const abertaAqui = aberta === l.itemId
        return (
          <div key={l.itemId}>
            <div className="flex w-full items-center gap-2.5 border-t px-4 py-3" style={{ borderColor: RADAR.line }}>
              <button type="button"
                onClick={() => setAberta(abertaAqui ? null : l.itemId)}
                disabled={!l.conta}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left disabled:cursor-default">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-bold" style={{ color: RADAR.ink }}>{l.nome}</span>
                  <span className="block text-[11px]" style={{ color: RADAR.sub }}>
                    {l.custoMedio != null ? `${brl(l.custoMedio)}/${l.unidadeControle.toLowerCase()}` : 'custo a definir'}
                    {l.veredito === 'SEM_CONTAGEM' && l.ultimaContagem && <> · última contagem {br(l.ultimaContagem)}</>}
                    {l.veredito === 'SEM_CONTAGEM' && !l.ultimaContagem && <> · nunca contado</>}
                  </span>
                </span>
                <Pilula l={l} />
                {l.conta && (abertaAqui
                  ? <ChevronDown className="h-3.5 w-3.5 shrink-0" style={{ color: RADAR.sub }} />
                  : <ChevronRight className="h-3.5 w-3.5 shrink-0" style={{ color: RADAR.sub }} />)}
              </button>
              {podeEditar && (
                <button type="button" onClick={() => void mexer('DELETE', l.itemId)}
                  title="tirar da lista" className="shrink-0 rounded-md p-1 hover:opacity-70">
                  <X className="h-3.5 w-3.5" style={{ color: RADAR.sub }} />
                </button>
              )}
            </div>
            {abertaAqui && l.conta && <ContaDePadeiro l={l} empresaId={empresaId} />}
          </div>
        )
      })}
    </section>
  )
}

export default function RadarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: empresaId } = use(params)
  const [estado, setEstado] = useState<Estado>('CARREGANDO')
  const [erro, setErro] = useState<string | null>(null)
  const [dados, setDados] = useState<(RadarDoEstoque & { janela: { rotulo: string; de: string; ate: string } }) | null>(null)
  const [periodo, setPeriodo] = useState<ChavePeriodo>('ONTEM_HOJE')
  const [livre, setLivre] = useState<{ de: string; ate: string } | null>(null)
  const [podeEditar, setPodeEditar] = useState(false)

  const carregar = useCallback(async () => {
    setEstado('CARREGANDO'); setErro(null)
    const q = periodo === 'LIVRE' && livre
      ? `periodo=LIVRE&de=${livre.de}&ate=${livre.ate}`
      : `periodo=${periodo}`
    const r = await fetchComTimeout<RadarDoEstoque & { janela: { rotulo: string; de: string; ate: string } }>(
      `/api/empresas/${empresaId}/estoque/radar?${q}`,
    )
    // ⛔ o estado vem do QUE VOLTOU, nunca da ausência: `erro: null` com `ok: false` é o
    // componente desmontado (a tela sumiu), e aí não há o que mostrar.
    if (!r.ok) { if (r.erro) { setErro(r.erro); setEstado('FALHOU') } return }
    setDados(r.data); setEstado('OK')
  }, [empresaId, periodo, livre])

  useEffect(() => { void carregar() }, [carregar])

  // ⚠️ quem pode EDITAR a lista é `stock.manage` — a tela pergunta em vez de adivinhar,
  // senão o operador vê um botão que o servidor vai recusar (o "chip mudo" de 17/09).
  useEffect(() => {
    let vivo = true
    void fetchComTimeout<{ permissions?: string[] }>(`/api/empresas/${empresaId}/me`).then((r) => {
      if (!vivo || !r.ok) return
      const p = r.data?.permissions ?? []
      setPodeEditar(p.includes('stock.manage') || p.includes('stock.*') || p.includes('*'))
    })
    return () => { vivo = false }
  }, [empresaId])

  const placar = dados?.placar
  const frase = useMemo(() => {
    if (!placar) return ''
    const janela = dados?.janela.rotulo === 'ontem → hoje' ? 'de ontem pra hoje' : `no período (${dados?.janela.rotulo})`
    if (placar.tom === 'SEM_CONTAGEM') return `${janela}, ninguém contou ainda`
    if (placar.tom === 'FALTOU') return `${janela}, sumiram`
    if (placar.tom === 'SOBROU') return `${janela}, sobraram`
    return `${janela}, bateu`
  }, [placar, dados])

  return (
    <div className="space-y-3" style={{ color: RADAR.ink }}>
      <div className="flex flex-wrap items-center gap-2.5">
        <Radar className="h-5 w-5 shrink-0" style={{ color: RADAR.roxo }} />
        <h1 className="text-base font-semibold">Radar do estoque</h1>
      </div>

      {/* ═══ PERÍODO ═══ */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {PILULAS.map((p) => (
          <button key={p.chave} type="button" onClick={() => { setPeriodo(p.chave); setLivre(null) }}
            className="whitespace-nowrap rounded-full border-[1.5px] px-3.5 py-[7px] text-[12.5px] font-bold"
            style={periodo === p.chave
              ? { borderColor: RADAR.roxo, background: RADAR.roxo, color: '#fff' }
              : { borderColor: RADAR.line, background: RADAR.card, color: RADAR.sub }}>
            {/* ⭐ o rótulo do mês vem do SERVIDOR quando essa é a pílula acesa */}
            {p.chave === 'MES' && periodo === 'MES' && dados ? dados.janela.rotulo : p.rotulo}
          </button>
        ))}
        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] border-dashed px-3.5 py-[7px] text-[12.5px] font-bold"
          style={{ borderColor: RADAR.line, color: RADAR.roxo }}>
          📅 escolher datas
          <input type="date" className="sr-only"
            onChange={(e) => {
              const d = e.target.value
              if (!d) return
              const ate = livre?.ate && livre.ate >= d ? livre.ate : d
              setLivre({ de: d, ate }); setPeriodo('LIVRE')
            }} />
        </label>
        {periodo === 'LIVRE' && livre && (
          <input type="date" value={livre.ate} onChange={(e) => setLivre({ de: livre.de, ate: e.target.value })}
            className="shrink-0 rounded-full border-[1.5px] px-3 py-[6px] text-[12px]"
            style={{ borderColor: RADAR.line }} />
        )}
      </div>

      {/* ═══ ESTADOS EXPLÍCITOS — nenhum deles é silêncio ═══ */}
      {estado === 'CARREGANDO' && (
        <div className="flex items-center gap-2 rounded-[18px] border px-4 py-5 text-[13px]"
          style={{ background: RADAR.card, borderColor: RADAR.line, color: RADAR.sub }}>
          <Loader2 className="h-4 w-4 animate-spin" /> lendo as contagens…
        </div>
      )}
      {estado === 'FALHOU' && (
        <div className="rounded-[18px] border px-4 py-4 text-[13px]"
          style={{ background: RADAR.coralBg, borderColor: RADAR.coral, color: RADAR.coral }}>
          {erro}
          <button type="button" onClick={() => void carregar()} className="ml-2 font-bold underline">tentar de novo</button>
        </div>
      )}

      {estado === 'OK' && dados && placar && (
        <>
          {/* ═══ PLACAR: uma frase, um número ═══ */}
          <div className="rounded-[22px] border p-5"
            style={{ background: RADAR.card, borderColor: RADAR.line, boxShadow: RADAR.sombra }}>
            <div className="text-[13px] font-semibold" style={{ color: RADAR.sub }}>{frase}</div>
            <div className="my-[2px] text-[40px] font-extrabold leading-[1.05] tracking-[-0.02em] tabular-nums"
              style={{ color: placar.tom === 'FALTOU' ? RADAR.coral : placar.tom === 'SEM_CONTAGEM' ? RADAR.mudo : RADAR.verde }}>
              {placar.tom === 'SEM_CONTAGEM' ? '—' : placar.tom === 'BATEU' ? 'bateu' : brl(placar.valor)}
            </div>
            <div className="text-[12px]" style={{ color: RADAR.sub }}>
              <b style={{ color: RADAR.ink }}>{placar.itensContados}</b> itens contados de{' '}
              <b style={{ color: RADAR.ink }}>{placar.itensNasListas}</b>
              {placar.maiorOfensor && <> · quase todo no <b style={{ color: RADAR.ink }}>{placar.maiorOfensor}</b></>}
            </div>
            {/* ⭐⭐ o que está FORA das listas aparece NOMEADO — senão o número grande
                subestimaria em silêncio, que é a família do "erro disfarçado de vazio" */}
            {placar.foraDasListasItens > 0 && Math.abs(placar.foraDasListasValor) >= 0.005 && (
              <div className="mt-2 text-[11.5px]" style={{ color: RADAR.sub }}>
                fora das suas listas, outros <b style={{ color: RADAR.ink }}>{placar.foraDasListasItens}</b> itens
                contados somam <b style={{ color: placar.foraDasListasValor < 0 ? RADAR.coral : RADAR.verde }}>
                  {brl(Math.abs(placar.foraDasListasValor))}</b>
                {placar.foraDasListasValor < 0 ? ' a menos' : ' a mais'}
              </div>
            )}
          </div>

          {dados.avisos.map((a) => (
            <p key={a} className="rounded-[14px] border px-3.5 py-2.5 text-[12.5px]"
              style={{ background: RADAR.ambarBg, borderColor: RADAR.ambar + '55', color: RADAR.ambar }}>{a}</p>
          ))}

          {/* ═══ OS DOIS BLOCOS — REGRA 12: empilham no celular, lado a lado no computador ═══ */}
          <div className="grid grid-cols-1 gap-3 min-[900px]:grid-cols-2 min-[900px]:items-start">
            <Bloco titulo="💰 OS CAROS" subtitulo="matéria-prima que você escolheu vigiar"
              linhas={dados.caros} empresaId={empresaId} lista="CAROS"
              podeEditar={podeEditar} aoMudar={() => void carregar()} />
            <Bloco titulo="🍳 PORÇÕES" subtitulo="o que a cozinha produz — em unidades"
              linhas={dados.porcoes} empresaId={empresaId} lista="PORCOES"
              podeEditar={podeEditar} aoMudar={() => void carregar()} />
          </div>

          {/* ⭐⭐ A HONESTIDADE NO RODAPÉ (exigência do dono) */}
          <div className="px-1 text-[11px] leading-relaxed" style={{ color: RADAR.sub }}>
            O radar aponta <b style={{ color: RADAR.ink }}>onde o dinheiro escapa</b> — não é fechamento contábil.<br />
            Item sem contagem no período aparece como <b style={{ color: RADAR.ink }}>“falta contar”</b>, nunca como zero.
          </div>
        </>
      )}
    </div>
  )
}

export type { Veredito }
