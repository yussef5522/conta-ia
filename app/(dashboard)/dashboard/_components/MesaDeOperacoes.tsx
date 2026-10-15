'use client'

/**
 * ⭐⭐⭐ A MESA DE OPERAÇÕES ① — o corpo da mesa (15/10/2026).
 *
 * **`docs/dashboard-referencia.html` é a LEI** do visual e do comportamento. Cada medida aqui é
 * o **px LITERAL** do arquivo (`44px`, `30px`, `170px`, `120px`, `64px`, `26px`, `1440px`) —
 * ⛔ `text-4xl` É 36px e `gap-3` É 12px, certos, mas obrigam **tradução mental**, e *foi
 * tradução mental que produziu as duas versões erradas da Conciliação* (10/09).
 *
 * ⛔⛔ **A TELA ECOA, NÃO CALCULA.** Todo número vem do payload que o servidor assinou
 * (`lerMesaDeOperacoes` → libs puras). ⚠️ Uma soma no JSX seria a 2ª conta do mesmo dinheiro, e
 * o guard proíbe (há teste exigindo que a barra do pregão venha de `montarPregao`).
 *
 * ⛔ **ZERO HEX DE COR:** tudo por token, e os tokens da referência têm par declarado nos DOIS
 * temas — *color cuja única definição vive dentro do `[data-theme]` nunca aplica no estado
 * não-estampado*, que é o bug clássico de artifact ilegível.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { fetchComTimeout } from '@/lib/http/fetch-com-timeout'
import type { MesaDeOperacoes } from '@/lib/balance/mesa-de-operacoes'
import { fraseDaFitaVazia } from '@/lib/balance/fita-do-dia'
import { formatBRL } from '@/lib/format/money'
/**
 * ⭐⭐ O CHASSI É COMPARTILHADO COM A MESA ② (15/10) — `Mod`, `RadarDaMesa`, `FitaDaMesa`,
 * `MesaGrid`, `TOM`, `ddmm` e `redondo` moravam AQUI em cópia local. ⛔ Duas cópias divergiriam
 * no primeiro ajuste de tom, e as duas telas que o dono alterna com um toque teriam cara
 * diferente — que é exatamente o que a referência existe pra impedir.
 */
import { Mod, RadarDaMesa, FitaDaMesa, MesaGrid, TOM, ddmm, redondo } from '@/components/mesa/chassi'

export function MesaDeOperacoes({ empresaId }: { empresaId: string }) {
  const [mesa, setMesa] = useState<MesaDeOperacoes | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  /**
   * ⛔⛔ O CARREGAMENTO NÃO PODE FICAR REFÉM DE UM PRÉ-REQUISITO QUE PODE NUNCA CHEGAR — sem
   * `empresaId` o estado vai pra `FALHOU`, nunca fica girando (*spinner eterno é a ausência
   * fingindo progresso*, 20/09). E o teto de tempo vem do `fetchComTimeout` da casa.
   */
  const carregar = useCallback(async () => {
    if (!empresaId) {
      setErro('nenhuma empresa selecionada')
      return
    }
    const r = await fetchComTimeout<MesaDeOperacoes>(`/api/empresas/${empresaId}/mesa`)
    if (!r.ok) {
      // ⚠️ o campo é `erro` (a frase que VAI pra tela) — e ele nunca é `null` com `ok: false`
      setErro(r.erro ?? 'não consegui carregar a mesa')
      return
    }
    setErro(null)
    setMesa(r.data)
  }, [empresaId])

  useEffect(() => {
    void carregar()
  }, [carregar])

  if (erro) {
    return (
      <div className="mx-auto max-w-[1440px] px-[26px] pb-[70px] pt-[18px]">
        <div
          className="border p-[16px] text-[13px] font-bold"
          style={{
            background: 'var(--fam-ambar-bg)',
            borderColor: 'var(--fam-ambar-mid)',
            color: 'var(--fam-ambar-ink)',
            borderRadius: 'var(--prod-r-cartao)',
          }}
        >
          {erro}{' '}
          <button type="button" className="underline" onClick={() => void carregar()}>
            tentar de novo
          </button>
        </div>
      </div>
    )
  }

  if (!mesa) {
    return (
      <div
        className="mx-auto max-w-[1440px] px-[26px] pb-[70px] pt-[18px] text-[13px] font-bold"
        style={{ color: 'var(--prod-muted)' }}
      >
        lendo a mesa…
      </div>
    )
  }

  const E = `/empresas/${empresaId}`

  return (
    <MesaGrid>
      {/* ⚠️ o que a mesa NÃO alcançou aparece NOMEADO — erro disfarçado de vazio é a doença
          que esta casa mais paga (o "nenhum cartão cadastrado" com o cartão lá). */}
      {mesa.naoAlcancado.length > 0 && (
        <div
          className="col-span-12 border px-[12px] py-[9px] text-[12.5px] font-bold"
          style={{
            background: 'var(--fam-ambar-bg)',
            borderColor: 'var(--fam-ambar-mid)',
            color: 'var(--fam-ambar-ink)',
            borderRadius: 'var(--prod-r-cartao)',
          }}
        >
          não consegui ler: {mesa.naoAlcancado.join(' · ')} — os outros módulos seguem certos
        </div>
      )}

      {/* ───────────── 1. NO CAIXA AGORA (c7) ───────────── */}
      <Mod span={7} titulo="NO CAIXA AGORA · COFRE + BANCOS" link={{ rotulo: 'movimentações', href: `${E}/transacoes` }}>
        <div className="px-[16px] pb-[16px]">
          <div
            className="text-[44px] font-extrabold tabular-nums tracking-[-0.03em]"
            title={formatBRL(mesa.caixa.saldoAgora)}
          >
            {redondo(mesa.caixa.saldoAgora)}
          </div>
          <div className="mt-[2px] text-[12.5px] font-semibold" style={{ color: 'var(--prod-secondary)' }}>
            hoje: +{formatBRL(mesa.caixa.hoje.entrou)} entraram · −{formatBRL(mesa.caixa.hoje.saiu)} saíram
            {' · '}passa o mouse na linha
          </div>
          <LinhaDos30Dias pontos={mesa.caixa.pontos} janelaCompleta={mesa.caixa.janelaCompleta} />
        </div>
      </Mod>

      {/* ───────────── 2. RADAR (c5) ───────────── */}
      <Mod span={5} titulo="RADAR · O QUE PEDE TUA MÃO" link={{ rotulo: 'ver tudo', href: `${E}/avisos` }}>
        <RadarDaMesa linhas={mesa.radar.linhas} placar={mesa.radar.placar} />
      </Mod>

      {/* ───────────── 3. O PREGÃO DO MÊS (c12) ───────────── */}
      <Mod
        span={12}
        titulo={mesa.pregao ? `${mesa.pregao.titulo.toUpperCase()} · A CASA SE ENCHENDO` : 'O PREGÃO DO MÊS'}
        link={{ rotulo: 'quem paga a casa', href: `${E}/margem` }}
      >
        <div className="px-[16px] pb-[16px] pt-[4px]">
          {mesa.pregao ? (
            <>
              <div className="flex flex-wrap items-baseline gap-x-[12px] gap-y-[2px]">
                <div className="text-[30px] font-extrabold tabular-nums tracking-[-0.02em]">
                  {mesa.pregao.valor}
                </div>
                <div
                  className="text-[13px] font-extrabold"
                  style={{
                    color:
                      mesa.pregao.veredito.tom === 'VERDE'
                        ? 'var(--fam-verde-mid)'
                        : mesa.pregao.veredito.tom === 'INDIGO'
                          ? 'var(--prod-accent)'
                          : 'var(--prod-muted)',
                  }}
                >
                  {mesa.pregao.veredito.rotulo}
                </div>
              </div>
              {/* ⛔ O VEREDITO NUNCA VEM SECO: a ressalva da cobertura viaja com ele (07/10) */}
              {mesa.pregao.veredito.ressalva && (
                <div className="mt-[3px] text-[11.5px] font-semibold" style={{ color: 'var(--prod-muted)' }}>
                  {mesa.pregao.veredito.ressalva}
                </div>
              )}
              <BarraDoPregao barra={mesa.pregao.barra} />
              <div className="mt-[12px] flex flex-col gap-[3px] text-[12.5px] font-semibold" style={{ color: 'var(--prod-secondary)' }}>
                {mesa.pregao.legenda.map((f) => (
                  <div key={f}>{f}</div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-[13px] font-bold" style={{ color: 'var(--prod-muted)' }}>
              a apurar — declare o plano do custo fixo pra a casa ter um valor
            </div>
          )}
        </div>
      </Mod>

      {/* ───────────── 4. PAGA × ENTRA · 7 DIAS (c12) ───────────── */}
      <Mod
        span={12}
        titulo="OS PRÓXIMOS 7 DIAS · O QUE PAGA × O QUE ENTRA"
        link={{ rotulo: 'contas a pagar', href: `${E}/contas-a-pagar` }}
      >
        <div className="px-[16px] pb-[8px]">
          <div className="flex h-[170px] items-end gap-[12px]">
            {mesa.pagaXEntra.dias.map((d) => {
              const teto = Math.max(
                ...mesa.pagaXEntra.dias.map((x) => Math.max(x.entra ?? 0, x.paga)),
                1,
              )
              const alt = (v: number) => `${Math.round((v / teto) * 120)}px`
              return (
                <div key={d.dia} className="flex h-full flex-1 flex-col items-center justify-end gap-[5px]">
                  {/* ⭐ o SALDO do dia em cima — verde/vermelho, ou "a apurar" quando não há média */}
                  <div
                    className="text-[10.5px] font-extrabold tabular-nums"
                    style={{
                      color:
                        d.saldo == null
                          ? 'var(--prod-muted)'
                          : d.saldo < 0
                            ? 'var(--fam-coral-mid)'
                            : 'var(--fam-verde-mid)',
                    }}
                  >
                    {d.saldo == null ? 'a apurar' : redondo(d.saldo)}
                  </div>
                  <div className="flex w-full items-end justify-center gap-[3px]">
                    {/* ⛔ dia sem média NÃO desenha barra verde — zero se leria como "não vende" */}
                    {d.entra != null && (
                      <div
                        className="w-[34%] max-w-[26px] rounded-t-[6px]"
                        style={{ height: alt(d.entra), background: 'var(--fam-verde-mid)' }}
                        title={`entra ~${formatBRL(d.entra)} (média de ${d.amostras} dia(s))`}
                      />
                    )}
                    <div
                      className="w-[34%] max-w-[26px] rounded-t-[6px]"
                      style={{ height: alt(d.paga), background: 'var(--fam-coral-mid)' }}
                      title={`paga ${formatBRL(d.paga)} em ${d.contas.length} conta(s)`}
                    />
                  </div>
                  <div
                    className="text-[10.5px] font-extrabold"
                    style={{ color: d.ehHoje ? 'var(--prod-accent)' : 'var(--prod-muted)' }}
                  >
                    {d.ehHoje ? 'hoje' : d.rotulo}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        {/* ⭐ UMA frase, gerada por regra: o pior dia e quem o cobre */}
        {mesa.pagaXEntra.aviso && (
          <div
            className="mx-[16px] mb-[14px] border px-[12px] py-[9px] text-[12.5px] font-bold"
            style={{
              borderColor: 'var(--fam-ambar-mid)',
              background: 'var(--fam-ambar-bg)',
              color: 'var(--fam-ambar-ink)',
              borderRadius: '10px',
            }}
          >
            {mesa.pagaXEntra.aviso}
          </div>
        )}
        {mesa.pagaXEntra.diasAApurar > 0 && (
          <div className="mx-[16px] mb-[14px] text-[11px] font-bold" style={{ color: 'var(--prod-muted)' }}>
            {mesa.pagaXEntra.diasAApurar} dia(s) sem média suficiente — entram como “a apurar”, nunca zero
          </div>
        )}
      </Mod>

      {/* ───────────── 5. A FITA (c12) ───────────── */}
      <FitaDaMesa
        eventos={mesa.fita}
        fraseVazia={fraseDaFitaVazia}
        rotulo="a fita de eventos"
      />

      {/* ───────────── 6a. CONTAS · 7 DIAS (c4) ───────────── */}
      <Mod
        span={4}
        titulo="CONTAS · 7 DIAS"
        link={{ rotulo: `as ${mesa.contas7Dias.resto || mesa.contas7Dias.topo.length}`, href: `${E}/contas-a-pagar` }}
      >
        <div className="px-[6px] pb-[8px] pt-[2px]">
          {mesa.contas7Dias.topo.length === 0 ? (
            <div className="px-[10px] py-[9px] text-[13px] font-bold" style={{ color: 'var(--prod-muted)' }}>
              nenhuma conta nos próximos 7 dias
            </div>
          ) : (
            mesa.contas7Dias.topo.map((c, n) => (
              <Link
                key={`${c.dia}:${n}`}
                href={`${E}/contas-a-pagar`}
                className="flex items-center gap-[10px] rounded-[9px] px-[10px] py-[9px] text-[13px] font-bold hover:bg-[var(--prod-surface-1)]"
              >
                <span className="tabular-nums" style={{ color: 'var(--prod-muted)' }}>
                  {ddmm(c.dia)}
                </span>
                <span className="flex-1 truncate">{c.descricao}</span>
                <span className="tabular-nums">{formatBRL(c.valor)}</span>
              </Link>
            ))
          )}
          {/* ⛔ o que ficou fora do top 5 é CONTADO e DITO — truncagem silenciosa já custou
              quatro vezes nesta casa (o fermento, a ordem do ano 202, o recebimento, as receitas) */}
          {mesa.contas7Dias.resto > 0 && (
            <div className="px-[10px] pt-[4px] text-[11px] font-bold" style={{ color: 'var(--prod-muted)' }}>
              + {mesa.contas7Dias.resto} outra(s) · total {formatBRL(mesa.contas7Dias.total)}
            </div>
          )}
        </div>
      </Mod>

      {/* ───────────── 6b. TUA SEMANA (c4) ───────────── */}
      <Mod span={4} titulo="TUA SEMANA · MÉDIA POR DIA" link={{ rotulo: 'vendas', href: `${E}/vendas` }}>
        <div className="flex h-[120px] items-end gap-[6px] px-[16px] pb-[14px] pt-[8px]">
          {mesa.tuaSemana.map((d) => {
            const teto = Math.max(...mesa.tuaSemana.map((x) => x.media ?? 0), 1)
            return (
              <div key={d.dow} className="flex h-full flex-1 flex-col items-center justify-end gap-[5px]">
                {/* ⛔ dia "a apurar" não desenha barra NEM é coroado — prêmio que ninguém disputou */}
                {d.media != null && (
                  <div
                    className="w-full max-w-[34px] rounded-t-[6px]"
                    style={{
                      height: `${Math.round((d.media / teto) * 80)}px`,
                      background: d.melhor ? 'var(--fam-verde-mid)' : 'var(--prod-accent)',
                      opacity: d.melhor ? 1 : 0.9,
                    }}
                    title={`${formatBRL(d.media)} · média de ${d.amostras} dia(s)`}
                  />
                )}
                <div className="text-[10px] font-extrabold" style={{ color: 'var(--prod-muted)' }}>
                  {d.rotulo}
                </div>
              </div>
            )
          })}
        </div>
      </Mod>

      {/* ───────────── 6c. COZINHA AGORA (c4) ───────────── */}
      <Mod
        span={4}
        titulo="COZINHA AGORA"
        link={{ rotulo: 'mesa da produção', href: `${E}/estoque/producao/hoje` }}
      >
        <div className="px-[16px] pb-[16px] pt-[4px]">
          <div className="text-[30px] font-extrabold tabular-nums tracking-[-0.02em]">
            {mesa.cozinhaAgora.fazendo}
          </div>
          <div className="mt-[2px] text-[12.5px] font-semibold" style={{ color: 'var(--prod-secondary)' }}>
            fazendo agora · {mesa.cozinhaAgora.naFila} na fila
          </div>
          <div className="mt-[8px] text-[11px] font-bold" style={{ color: 'var(--prod-muted)' }}>
            {mesa.cozinhaAgora.concluidasHoje} lote(s) hoje · {mesa.cozinhaAgora.unidades} un
          </div>
        </div>
      </Mod>
    </MesaGrid>
  )
}

/**
 * ⭐⭐ A LINHA DOS 30 DIAS COM SCRUB — o gesto que a referência declara (`mousemove` +
 * `mouseleave`).
 *
 * ⛔⛔ **O `onMouseLeave` É METADE DO GESTO:** sem ele a dica fica pendurada depois de o mouse
 * sair, e o dono lê o saldo de um dia que ele não está mais apontando.
 *
 * ⚠️ **JANELA INCOMPLETA É DITA.** Empresa sem 30 dias de história desenharia uma linha
 * *"saindo do zero"* como se o dinheiro tivesse nascido ali — o rodapé avisa.
 */
function LinhaDos30Dias({
  pontos,
  janelaCompleta,
}: {
  pontos: { dia: string; saldo: number }[]
  janelaCompleta: boolean
}) {
  const [dica, setDica] = useState<{ x: number; dia: string; saldo: number } | null>(null)
  const ref = useRef<HTMLDivElement | null>(null)

  if (pontos.length < 2) {
    return (
      <div className="mt-[10px] h-[64px] text-[11px] font-bold" style={{ color: 'var(--prod-muted)' }}>
        sem história suficiente pra desenhar a linha
      </div>
    )
  }

  const min = Math.min(...pontos.map((p) => p.saldo))
  const max = Math.max(...pontos.map((p) => p.saldo))
  const faixa = max - min || 1
  const d = pontos
    .map((p, i) => {
      const x = (i / (pontos.length - 1)) * 100
      const y = 100 - ((p.saldo - min) / faixa) * 100
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')

  const mover = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r || r.width === 0) return
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    const i = Math.round(f * (pontos.length - 1))
    setDica({ x: f * 100, dia: pontos[i].dia, saldo: pontos[i].saldo })
  }

  return (
    <div className="relative mt-[10px]" ref={ref} onMouseMove={mover} onMouseLeave={() => setDica(null)}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="block h-[64px] w-full cursor-crosshair"
        aria-label="o saldo dos últimos 30 dias"
      >
        <path d={d} fill="none" stroke="var(--prod-accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        {dica && (
          <line
            x1={dica.x}
            x2={dica.x}
            y1="0"
            y2="100"
            stroke="var(--prod-line-strong)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      {dica && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-[135%] whitespace-nowrap rounded-[7px] px-[9px] py-[4px] text-[11.5px] font-extrabold"
          style={{ left: `${dica.x}%`, top: 0, background: 'var(--prod-primary)', color: 'var(--prod-bg)' }}
        >
          {ddmm(dica.dia)} · {formatBRL(dica.saldo)}
        </div>
      )}
      {!janelaCompleta && (
        <div className="text-[11px] font-bold" style={{ color: 'var(--prod-muted)' }}>
          a empresa não tem 30 dias de história — a linha começa onde o dado começa
        </div>
      )}
    </div>
  )
}

/**
 * ⭐ A BARRA DO PREGÃO — enche UMA vez ao abrir, e respeita reduced-motion.
 *
 * ⛔⛔ **A FRAÇÃO VEM DA LIB.** `montarPregao` já devolve `pago`/`transbordo`; a tela só
 * desenha. ⚠️ Um 2º clamp aqui foi exatamente o que **estourou a pilha de tijolos em 07/10**,
 * quando a casa estava paga (152%) e as áreas somavam 1,52.
 */
function BarraDoPregao({
  barra,
}: {
  barra: { pago: number; transbordo: number; rotuloTransbordo: string | null; bandeira: boolean } | null
}) {
  const [cheia, setCheia] = useState(false)
  useEffect(() => {
    // ⚠️ dois frames: o 1º pinta a largura 0, o 2º dispara a transição (sem isso o browser
    // colapsa os dois estados e a barra nasce cheia, sem animar).
    const a = requestAnimationFrame(() => {
      const b = requestAnimationFrame(() => setCheia(true))
      return () => cancelAnimationFrame(b)
    })
    return () => cancelAnimationFrame(a)
  }, [])

  if (!barra) {
    return (
      <div className="mt-[12px] text-[12px] font-bold" style={{ color: 'var(--prod-muted)' }}>
        a barra aparece quando o plano do custo fixo estiver declarado
      </div>
    )
  }

  return (
    <div
      className="relative mt-[12px] h-[30px] overflow-visible rounded-full border"
      style={{ background: 'var(--prod-surface-1)', borderColor: 'var(--prod-line)' }}
    >
      <div
        className="absolute bottom-0 left-0 top-0 rounded-full transition-[width] duration-[1100ms] motion-reduce:transition-none"
        style={{
          width: cheia ? `${Math.round(barra.pago * 100)}%` : '0%',
          background: 'var(--prod-accent)',
        }}
      />
      {barra.bandeira && (
        <>
          <span
            className="absolute -bottom-[8px] -top-[8px] w-[3px] rounded-[2px]"
            style={{ left: `${Math.round(barra.pago * 100)}%`, background: 'var(--fam-verde-mid)' }}
            aria-hidden
          />
          <span
            className="absolute -top-[22px] text-[10.5px] font-extrabold"
            style={{ left: `${Math.round(barra.pago * 100)}%`, color: 'var(--fam-verde-mid)' }}
          >
            🏁 casa paga {barra.rotuloTransbordo ?? ''}
          </span>
        </>
      )}
    </div>
  )
}
