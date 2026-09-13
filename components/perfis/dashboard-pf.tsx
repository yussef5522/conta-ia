'use client'

// ⭐⭐⭐ O DASHBOARD DA PF — **DUAS COMPOSIÇÕES, UM SÓ CONJUNTO DE WIDGETS** (13/09).
//
// **O dono, vendo o desktop:** *"o mock era MOBILE e o desktop ficou uma coluna de 480px
// boiando no meio do monitor. Sistema que quer competir com Monarch/Mobills tem DOIS
// desenhos: app no celular, COCKPIT no desktop. Mesmos widgets, mesma fonte de dados, DUAS
// composições."*
//
// ⭐ Os widgets moram em `widgets-pf.tsx` e são **os mesmos objetos** nas duas composições —
// muda o LAYOUT, nunca o conteúdo. Dois cards de cartão, um por viewport, divergiriam no
// primeiro selo novo, e o dono veria um número no bolso e outro no monitor.
//
// ⚠️ **AS DUAS COMPOSIÇÕES VIVEM NO DOM e o CSS escolhe** (`lg:hidden` × `hidden lg:grid`).
// Escolher por JS exigiria saber a largura no 1º render — e no servidor ela não existe:
// daria hydration mismatch, ou o app piscando o layout errado antes de trocar.

import { useCallback, useEffect, useState } from 'react'
import { fetchJson } from '@/lib/http/fetch-json'
import { LancamentoRapido } from './lancamento-rapido'
import {
  M, GRADIENTE_HERO, andar, nomeMes, saudacao,
  WSaldo, WFluxo, WEmpresa, WDonut, WCartoes, WBalanco, WAVencer, WUltimos,
  Card, type Dados, type Fmt,
} from './widgets-pf'

export function DashboardPFView({ profileId }: { profileId: string }) {
  // ⚠️ REGRA 9: todo hook antes de qualquer early return
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7))
  const [d, setD] = useState<Dados | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  /** ⭐ o olhinho esconde TODOS os números da tela, não só o hero (régua do dono) */
  const [oculto, setOculto] = useState(false)
  const [fab, setFab] = useState(false)

  const carregar = useCallback(async () => {
    const r = await fetchJson<Dados>(`/api/perfis/${profileId}/dashboard?mes=${mes}`)
    // ⛔ erro NUNCA vira vazio: "sem lançamento" é uma afirmação e precisa ser verdade
    if (!r.ok || !r.data) { setErro(r.message ?? 'resposta vazia'); return }
    setErro(null); setD(r.data)
  }, [profileId, mes])
  useEffect(() => { void carregar() }, [carregar])

  const f: Fmt = {
    oculto,
    brl: (n, semSimbolo = false) => oculto ? '••••'
      : (semSimbolo ? Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })),
    curto: (n) => oculto ? '••'
      : Math.abs(n) >= 1000 ? `${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
        : n.toLocaleString('pt-BR', { maximumFractionDigits: 0 }),
  }

  const navMes = (
    <div className="flex items-center gap-3 text-[14.5px] font-bold">
      <button onClick={() => setMes(andar(mes, -1))} className="text-[13px] font-normal opacity-[.55] hover:opacity-100">‹ {nomeMes(andar(mes, -1))}</button>
      <span>{nomeMes(mes)}</span>
      <button onClick={() => setMes(andar(mes, 1))} className="text-[13px] font-normal opacity-[.55] hover:opacity-100">{nomeMes(andar(mes, 1))} ›</button>
    </div>
  )
  const olhinho = (
    <button onClick={() => setOculto((v) => !v)} className="text-[12px] opacity-80 hover:opacity-100" title={oculto ? 'mostrar valores' : 'esconder valores'}>
      {oculto ? '🙈 mostrar' : '👁 esconder'}
    </button>
  )
  const aviso = erro && <Card><p className="text-[13px]" style={{ color: M.ambar }}>não consegui carregar: {erro} — <b>ausência aqui não é prova de que não houve movimento</b>.</p></Card>

  return (
    <>
      {/* ══════════════════════════════════════════════════════════════════════
          CELULAR (<768px) — **INTOCADO** (ordem do dono: "não mexe!")
          TABLET (768–1024px) — o MESMO desenho em 2 colunas: o hero segue banner,
          e só a pilha de cards vira grade. É o meio-termo honesto — nem a coluna
          estreita boiando, nem o cockpit num monitor que não tem largura pra ele.
         ══════════════════════════════════════════════════════════════════════ */}
      <div className="mx-auto max-w-[480px] pb-[90px] md:max-w-[760px] lg:hidden" style={{ background: M.bg, color: M.ink }}>
        <div className="rounded-b-[28px] px-[18px] pb-[54px] pt-5 text-white" style={{ background: GRADIENTE_HERO }}>
          <div className="mb-4 flex items-center justify-between">
            <div className="text-[14px] opacity-[.85]">{saudacao()} 👋<b className="block text-[16px] opacity-100">{d?.nome ?? ''}</b></div>
            <div className="flex h-[38px] w-[38px] items-center justify-center rounded-full font-extrabold" style={{ background: 'rgba(255,255,255,.2)' }}>
              {(d?.nome ?? '?').slice(0, 1).toUpperCase()}
            </div>
          </div>
          <div className="mb-2.5 flex justify-center">{navMes}</div>
          <div className="text-center">
            <button onClick={() => setOculto((v) => !v)} className="text-[11.5px] tracking-[.03em] opacity-80">
              SALDO NAS CONTAS {oculto ? '🙈' : '👁'}
            </button>
            <WSaldo d={d} f={f} />
          </div>
        </div>

        <div className="mx-[14px] mb-3 mt-[-38px]"><WFluxo d={d} f={f} /></div>

        <div className="px-[14px] md:grid md:grid-cols-2 md:items-start md:gap-x-3">
          {aviso}
          {d && (
            <>
              <WEmpresa d={d} f={f} />
              <WDonut d={d} f={f} />
              <WCartoes d={d} f={f} profileId={profileId} />
              {/* ⭐ 4 meses no bolso — o payload traz 6 e a TELA corta */}
              <WBalanco d={d} f={f} meses={4} />
              <WAVencer d={d} f={f} />
              <WUltimos d={d} f={f} profileId={profileId} />
              {d.vazio && <Card><p className="text-center text-[13px] italic" style={{ color: M.sub }}>{d.vazio}</p></Card>}
            </>
          )}
        </div>

        {/* ⚠️ FAB flutuante é gesto de POLEGAR — no desktop ele vira botão de barra */}
        <button onClick={() => setFab(true)}
          className="fixed bottom-[22px] right-[18px] flex h-14 w-14 items-center justify-center rounded-full text-[28px] text-white"
          style={{ background: `linear-gradient(140deg,${M.roxo},${M.roxo2})`, boxShadow: '0 8px 22px rgba(83,74,183,.4)' }}>
          ＋
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          COCKPIT (≥1024px) — grid de 12 colunas, ~1200px úteis, padrão Monarch
         ══════════════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:block" style={{ color: M.ink }}>
        <div className="mx-auto max-w-[1200px] px-2 pb-10">
          {/* ⭐ a barra fina de página: título · mês · olhinho · o gesto de lançar */}
          <div className="mb-4 flex items-center gap-4 border-b pb-3" style={{ borderColor: M.line }}>
            <h1 className="text-[19px] font-extrabold">Meu Dinheiro</h1>
            <span className="text-[13px]" style={{ color: M.sub }}>{saudacao()}, {d?.nome ?? ''}</span>
            <div className="ml-auto flex items-center gap-4" style={{ color: M.ink }}>
              {navMes}
              {olhinho}
              {/* ⚠️ no desktop o gesto é um BOTÃO da barra, não um FAB: mouse não tem polegar */}
              <button onClick={() => setFab(true)}
                className="h-9 rounded-lg px-3.5 text-[13px] font-bold text-white transition-shadow hover:shadow-lg"
                style={{ background: `linear-gradient(140deg,${M.roxo},${M.roxo2})` }}>
                ＋ Novo lançamento
              </button>
            </div>
          </div>

          {aviso}

          {d && (
            <div className="grid grid-cols-12 gap-4">
              {/* ── LINHA 1: saldo · fluxo · empresa ─────────────────────────
                  ⚠️⚠️ **O GUARD ME PEGOU AQUI.** Eu tinha posto o "a vencer" nesta coluna
                  quando não há recebimento da empresa, pra não deixar buraco — e com isso o
                  widget aparecia DUAS vezes na mesma composição. Tapar buraco duplicando
                  widget é o começo de duas telas divergentes. **Quem se adapta é a LINHA**:
                  sem a empresa, saldo e fluxo dividem as 12 colunas. */}
              {(() => {
                const temEmpresa = d.recebidoDaEmpresa.transferencias > 0
                const col = temEmpresa ? 'col-span-4' : 'col-span-6'
                return (
                  <>
                    <div className={col}><WSaldo d={d} f={f} comoCard /></div>
                    <div className={col}><WFluxo d={d} f={f} comCard /></div>
                    {temEmpresa && <div className="col-span-4"><WEmpresa d={d} f={f} /></div>}
                  </>
                )
              })()}

              {/* ── LINHA 2: donut · balanço ───────────────────────────────── */}
              <div className="col-span-6"><WDonut d={d} f={f} grande /></div>
              {/* ⭐ 6 meses no monitor: tem espaço, e a leitura fica melhor */}
              <div className="col-span-6"><WBalanco d={d} f={f} meses={6} /></div>

              {/* ── LINHA 3: cartões · (a vencer + últimos) ────────────────── */}
              <div className="col-span-6"><WCartoes d={d} f={f} profileId={profileId} /></div>
              <div className="col-span-6 flex flex-col gap-4">
                <WAVencer d={d} f={f} />
                <WUltimos d={d} f={f} profileId={profileId} />
              </div>

              {d.vazio && <div className="col-span-12"><Card><p className="text-center text-[13px] italic" style={{ color: M.sub }}>{d.vazio}</p></Card></div>}
            </div>
          )}
        </div>
      </div>

      {fab && <LancamentoRapido profileId={profileId} contas={d?.contas ?? []} aoFechar={() => setFab(false)} aoSalvar={() => { setFab(false); void carregar() }} />}
    </>
  )
}
