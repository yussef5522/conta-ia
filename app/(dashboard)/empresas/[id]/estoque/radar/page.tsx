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
import type { UniversoDoSeletor } from '@/lib/stock/universo-do-seletor'
import Link from 'next/link'
import { Radar, Loader2, Plus, X, ChevronRight, ChevronDown } from 'lucide-react'
import { fetchComTimeout } from '@/lib/http/fetch-com-timeout'
import { BuscaItem } from '@/components/estoque/busca-item'
import { RADAR, TOM } from '@/components/estoque/radar-tokens'
// ⭐ a conta de padeiro mora em UM lugar e serve as duas telas (Radar e Real × Teórico)
import { ContaDePadeiro } from '@/components/estoque/radar/conta-de-padeiro'
import type { RadarDoEstoque, LinhaDoRadar, Veredito, TotalDaSecao } from '@/lib/stock/radar/fechamento'
import type { Lista } from '@/lib/stock/radar/watchlist'
import type { ChavePeriodo } from '@/lib/stock/radar/periodo'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const qtd = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 6 })
const br = (d: string) => d.split('-').reverse().slice(0, 2).join('/')
/** ⚠️ o dia do BRASIL — o rótulo "AGORA" não pode virar ontem às 21h */
const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

type Estado = 'CARREGANDO' | 'FALHOU' | 'OK'

/** ⭐ as pílulas do mock — o rótulo do período vem do SERVIDOR, nunca escrito aqui */
const PILULAS: { chave: ChavePeriodo; rotulo: string }[] = [
  { chave: 'ONTEM_HOJE', rotulo: 'ontem → hoje' },
  { chave: 'SETE_DIAS', rotulo: '7 dias' },
  { chave: 'MES', rotulo: 'mês' },
]

/**
 * ⭐⭐ v1.2 — A MINI-SPARKLINE DOS 7 DIAS.
 *
 * ⛔ **Dia sem contagem é LACUNA, nunca ponto em zero** — zero se leria como "bateu
 * certinho", que é a mentira que esta tela inteira existe pra não contar. O traço
 * literalmente se interrompe, e o olho entende "aqui ninguém mediu".
 */
/**
 * ⭐⭐ v1.3 — O RODAPÉ DE CADA SEÇÃO.
 *
 * ⛔⛔ **UN e KG NUNCA somam num número só** — é lei da casa desde o placar de 13/09, onde
 * *"1.415,84 un"* misturava porção (UN) com massa (KG) e aquele `,84` era um número que
 * **não existe**. Aqui a quantidade sai por unidade (*"14 un e 2,3 kg"*) e só o DINHEIRO
 * soma tudo, porque real é real venha de onde vier.
 *
 * ⛔ E só o que foi CONTADO entra: *"falta-contar fica fora, nunca vira zero"*.
 */
function RodapeDaSecao({ t }: { t: TotalDaSecao }) {
  const porUn = (m: Record<string, number>) =>
    Object.entries(m).map(([un, v]) => `${qtd(v)} ${un.toLowerCase()}`).join(' e ')
  const temFalta = Object.keys(t.faltouPorUnidade).length > 0
  const temSobra = Object.keys(t.sobrouPorUnidade).length > 0
  // ⛔ nada contado no período: o rodapé DIZ isso, em vez de mostrar zeros
  if (t.itensContados === 0) {
    return (
      <p className="border-t px-4 py-2.5 text-[11.5px]" style={{ borderColor: RADAR.line, color: RADAR.mudo }}>
        nenhum item desta lista foi contado no período — sem contagem não há total a somar
      </p>
    )
  }
  return (
    <p className="border-t px-4 py-2.5 text-[11.5px]" style={{ borderColor: RADAR.line, color: RADAR.sub }}>
      {temFalta && (
        <>faltaram no total: <b style={{ color: RADAR.coral }}>{porUn(t.faltouPorUnidade)} · {brl(t.faltouValor)}</b></>
      )}
      {temFalta && temSobra && ' — '}
      {temSobra && (
        <>sobraram: <b style={{ color: RADAR.verde }}>{porUn(t.sobrouPorUnidade)} · {brl(t.sobrouValor)}</b></>
      )}
      {!temFalta && !temSobra && <>os {t.itensContados} contados <b style={{ color: RADAR.verde }}>bateram</b></>}
      {t.itensSemContagem > 0 && (
        <span style={{ color: RADAR.mudo }}> · {t.itensSemContagem} ainda sem contagem (fora do total)</span>
      )}
    </p>
  )
}

function Sparkline({ pontos }: { pontos: { dia: string; valor: number | null }[] }) {
  const medidos = pontos.filter((p) => p.valor != null)
  if (medidos.length === 0) return null
  const L = 62, A = 16
  const max = Math.max(1, ...medidos.map((p) => Math.abs(p.valor!)))
  const x = (i: number) => (pontos.length === 1 ? L / 2 : (i / (pontos.length - 1)) * L)
  const y = (v: number) => A / 2 - (v / max) * (A / 2 - 1.5)
  // ⭐ os segmentos só ligam dias VIZINHOS que os dois foram medidos — o resto é lacuna
  const segmentos: string[] = []
  for (let i = 1; i < pontos.length; i++) {
    const a = pontos[i - 1]!, b = pontos[i]!
    if (a.valor == null || b.valor == null) continue
    segmentos.push(`M ${x(i - 1).toFixed(1)} ${y(a.valor).toFixed(1)} L ${x(i).toFixed(1)} ${y(b.valor).toFixed(1)}`)
  }
  return (
    <svg width={L} height={A} className="shrink-0" aria-hidden
      role="img" style={{ overflow: 'visible' }}>
      <line x1="0" y1={A / 2} x2={L} y2={A / 2} stroke={RADAR.line} strokeWidth="1" />
      {segmentos.map((d) => (
        <path key={d} d={d} fill="none" stroke={RADAR.sub} strokeWidth="1.5" strokeLinecap="round" />
      ))}
      {pontos.map((p, i) => p.valor == null ? null : (
        <circle key={p.dia} cx={x(i)} cy={y(p.valor)} r="1.9"
          fill={p.valor < 0 ? RADAR.coral : p.valor > 0 ? RADAR.verde : RADAR.sub} />
      ))}
    </svg>
  )
}

/**
 * ⭐⭐ v1.2 — A MINI-BARRA DA SEMANA, no CELULAR também (ordem do dono).
 *
 * ⛔ **Dia sem contagem é barra VAZIA tracejada**, nunca uma barra de altura zero — é a
 * mesma régua do mock e da sparkline: *zero se leria como "bateu certinho"*.
 */
function BarraDaSemana({ dias }: { dias: { dia: string; valor: number | null }[] }) {
  const medidos = dias.filter((d) => d.valor != null)
  if (dias.length === 0) return null
  const max = Math.max(1, ...medidos.map((d) => Math.abs(d.valor!)))
  const pior = medidos.filter((d) => d.valor! < 0).sort((a, b) => a.valor! - b.valor!)[0]
  return (
    <div className="mt-3">
      <div className="flex h-[52px] items-end gap-[5px]">
        {dias.map((d) => {
          const v = d.valor
          const alt = v == null ? 8 : Math.max(4, (Math.abs(v) / max) * 46)
          return (
            <span key={d.dia} className="flex flex-1 flex-col items-center gap-1">
              <i className="w-full rounded-t-[4px]"
                title={`${br(d.dia)}: ${v == null ? 'sem contagem' : brl(v)}`}
                style={v == null
                  ? { height: 8, background: RADAR.mudoBg, border: `1px dashed ${RADAR.line}` }
                  : { height: alt, background: v < 0 ? RADAR.coral : RADAR.verde }} />
              <small className="text-[9.5px] font-bold" style={{ color: RADAR.sub }}>{d.dia.slice(8)}</small>
            </span>
          )
        })}
      </div>
      <p className="mt-1.5 text-[11px]" style={{ color: RADAR.sub }}>
        {pior
          ? <>pior foi <b style={{ color: RADAR.coral }}>{br(pior.dia)} ({brl(Math.abs(pior.valor!))})</b></>
          : medidos.length === 0
            ? 'nenhum dia desta semana foi contado'
            : <>nenhum dia desta semana fechou com falta</>}
        {dias.length - medidos.length > 0 && <> · {dias.length - medidos.length} sem contagem</>}
      </p>
    </div>
  )
}

/** ⭐ v1.2 — o último veredito MEDIDO, com data: história verdadeira no dia sem contagem */
function ChipDoUltimo({ u, unidade }: { u: NonNullable<LinhaDoRadar['ultimoVeredito']>; unidade: string }) {
  const t = TOM[u.veredito]
  // ⭐ v1.3 — a mesma régua da pílula: quantidade primeiro
  const texto = u.veredito === 'BATEU' ? 'bateu' : textoDoVeredito(u.qtd, u.valor, unidade)
  return (
    <span className="whitespace-nowrap rounded-full px-[7px] py-[2px] text-[10.5px] font-bold"
      style={{ background: t.bg, color: t.cor }}>
      {br(u.dia)}: {texto}
    </span>
  )
}

/**
 * ⭐⭐ v1.3 — **QUANTIDADE PRIMEIRO, dinheiro depois** (decisão do dono: *"quantidade é o
 * número MAIS importante"*). *"faltou 2 un · R$ 3,31"* — o dinheiro sozinho não diz se o
 * furo é meia caixa ou o estoque inteiro, e é a quantidade que a cozinha reconhece.
 */
function textoDoVeredito(qtdFaltou: number, valor: number, unidade: string): string {
  const verbo = valor < 0 ? 'faltou' : 'sobrou'
  return `${verbo} ${qtd(Math.abs(qtdFaltou))} ${unidade.toLowerCase()} · ${brl(Math.abs(valor))}`
}

/** ⛔ o veredito com o semáforo semântico do mock */
function Pilula({ l }: { l: LinhaDoRadar }) {
  const t = TOM[l.veredito]
  const texto =
    l.veredito === 'SEM_CONTAGEM' ? 'falta contar hoje'
      : l.veredito === 'BATEU' ? '✓ bateu'
        : textoDoVeredito(l.faltou!, l.faltouValor!, l.unidadeControle)
  return (
    <span className="shrink-0 whitespace-nowrap rounded-full px-[11px] py-[4px] text-[12.5px] font-extrabold tabular-nums"
      style={{ background: t.bg, color: t.cor }}>
      {texto}
    </span>
  )
}

function Bloco({ titulo, subtitulo, linhas, empresaId, lista, podeEditar, aoMudar, total, universo }: {
  titulo: string; subtitulo: string; linhas: LinhaDoRadar[]; empresaId: string
  lista: Lista; podeEditar: boolean; aoMudar: () => void
  total: TotalDaSecao
  /** ⭐ v1.3 — cada lista busca no SEU universo: revenda não oferece matéria-prima */
  // ⛔ DERIVADO do dono único (`universo-do-seletor.ts`), nunca enumerado aqui — lista
  // à mão envelhece no primeiro universo novo, que foi exatamente o que aconteceu com o
  // REVENDA. O tipo é o contrato: universo que não existe lá não compila aqui.
  universo: UniversoDoSeletor
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
            universo={universo}
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
                  {/* ⭐⭐ v1.1 — TODA LINHA DIZ O QUE O SISTEMA ACHA QUE TEM AGORA.
                      ⛔ Vem da porta da Posição: a tela do Radar e a da Posição não podem
                      discordar sobre o mesmo item. */}
                  <span className="block text-[11px]" style={{ color: RADAR.sub }}>
                    no sistema: <b style={{ color: RADAR.ink }}>{qtd(l.saldoSistema)} {l.unidadeControle.toLowerCase()}</b>
                    {' · '}<b style={{ color: RADAR.ink }}>{brl(l.valorSistema)}</b>
                    {l.veredito === 'SEM_CONTAGEM' && !l.ultimaContagem && <> · nunca contado</>}
                  </span>
                  {/* ⭐⭐ v1.2 — VIDA no dia sem contagem: o ÚLTIMO veredito medido (com
                      data e cor) + os 7 dias de história. ⛔ Nada aqui é número do dia de
                      hoje: é o que já foi medido, e só. */}
                  {l.veredito === 'SEM_CONTAGEM' && (l.ultimoVeredito || l.historico.some((h) => h.valor != null)) && (
                    <span className="mt-1 flex items-center gap-1.5">
                      {l.ultimoVeredito && <ChipDoUltimo u={l.ultimoVeredito} unidade={l.unidadeControle} />}
                      <Sparkline pontos={l.historico} />
                    </span>
                  )}
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
            {abertaAqui && l.conta && <ContaDePadeiro conta={l.conta} unidade={l.unidadeControle} itemId={l.itemId} empresaId={empresaId} />}
          </div>
        )
      })}

      {/* ⭐ v1.3 — o total da seção, com UN e KG separados */}
      {linhas.length > 0 && <RodapeDaSecao t={total} />}
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

  /**
   * ⭐⭐ v1.2 — a barra mostra a SEMANA, mesmo no período "ontem → hoje".
   *
   * ⚠️ O `porDia` do payload cobre o período ESCOLHIDO (2 dias no ontem→hoje), e uma barra
   * de 2 colunas não conta história nenhuma. ⛔ Em vez de uma 2ª consulta, a semana sai do
   * **histórico que as linhas já trazem** — mesma fonte, zero ida a mais ao banco.
   */
  const semana = useMemo(() => {
    if (!dados) return []
    const todas = [...dados.caros, ...dados.revenda, ...dados.porcoes]
    const base = todas[0]?.historico ?? []
    return base.map((p, i) => {
      const doDia = todas.map((l) => l.historico[i]?.valor).filter((v): v is number => v != null)
      return { dia: p.dia, valor: doDia.length ? Math.round(doDia.reduce((a, b) => a + b, 0) * 100) / 100 : null }
    })
  }, [dados])

  const placar = dados?.placar
  const frase = useMemo(() => {
    if (!placar) return ''
    const janela = dados?.janela.rotulo === 'ontem → hoje' ? 'de ontem pra hoje' : `no período (${dados?.janela.rotulo})`
    if (placar.tom === 'SEM_CONTAGEM') return 'suas listas somam, no sistema agora'
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
            {/* ⭐ v1.1 — sem contagem o placar deixa de ser um traço: ele diz o TAMANHO do
                que está sendo vigiado. ⛔ Em cinza, nunca em vermelho — não é variância. */}
            <div className="my-[2px] text-[40px] font-extrabold leading-[1.05] tracking-[-0.02em] tabular-nums"
              style={{ color: placar.tom === 'FALTOU' ? RADAR.coral : placar.tom === 'SEM_CONTAGEM' ? RADAR.ink : RADAR.verde }}>
              {placar.tom === 'SEM_CONTAGEM' ? brl(placar.valorNoSistema) : placar.tom === 'BATEU' ? 'bateu' : brl(placar.valor)}
            </div>
            <div className="text-[12px]" style={{ color: RADAR.sub }}>
              <b style={{ color: RADAR.ink }}>{placar.itensContados}</b> itens contados de{' '}
              <b style={{ color: RADAR.ink }}>{placar.itensNasListas}</b>
              {placar.maiorOfensor && <> · quase todo no <b style={{ color: RADAR.ink }}>{placar.maiorOfensor}</b></>}
            </div>
            {/* ⭐ v1.2 — a semana no placar, nos DOIS viewports: uma composição só, então
                o celular não fica com menos informação que o computador (REGRA 12). */}
            <BarraDaSemana dias={semana} />

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
          {/* ⭐ v1.3 — TRÊS seções, na ordem do dono: caros · revenda · porções.
              ⚠️ REGRA 12: empilham no celular pela MESMA medida de sempre. */}
          <div className="grid grid-cols-1 gap-3 min-[900px]:grid-cols-2 min-[900px]:items-start">
            <Bloco titulo="💰 OS CAROS" subtitulo="matéria-prima que você escolheu vigiar"
              linhas={dados.caros} total={dados.totais.caros} empresaId={empresaId} lista="CAROS"
              universo="COMPRAVEL" podeEditar={podeEditar} aoMudar={() => void carregar()} />
            <Bloco titulo="🥤 REVENDA" subtitulo="bebida e revenda — o que entra pronto e sai pronto"
              linhas={dados.revenda} total={dados.totais.revenda} empresaId={empresaId} lista="REVENDA"
              universo="REVENDA" podeEditar={podeEditar} aoMudar={() => void carregar()} />
            <Bloco titulo="🍳 PORÇÕES" subtitulo="o que a cozinha produz — em unidades"
              linhas={dados.porcoes} total={dados.totais.porcoes} empresaId={empresaId} lista="PORCOES"
              universo="PRATELEIRA" podeEditar={podeEditar} aoMudar={() => void carregar()} />
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
