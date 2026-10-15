'use client'

/**
 * ⭐⭐⭐ O CHASSI DAS MESAS — **um chassi, duas mesas** (15/10/2026).
 *
 * `docs/dashboard-referencia.html` desenha ① Dashboard e ② Produção com **a mesma moldura**: o
 * mesmo cartão (`.mod`), o mesmo cabeçalho (`.mod-cab`), o mesmo radar (`.radar`/`.al`) e a
 * mesma fita (`.fita`). ⛔⛔ **Duas cópias disso divergiriam no primeiro ajuste de tom** — e aí
 * as duas telas que o dono alterna com um toque teriam cara diferente, que é exatamente o que
 * a referência existe pra impedir.
 *
 * ⚠️ Cada medida aqui é o **px LITERAL** do arquivo. ⛔ `gap-3` É 12px e `text-xs` É 12px,
 * certos — mas obrigam **tradução mental**, e *foi tradução mental que produziu as duas versões
 * erradas da Conciliação* (10/09).
 *
 * ⛔ **ZERO HEX DE COR:** tudo por token, e todo token tem par declarado nos DOIS temas — *color
 * cuja única definição vive dentro do `[data-theme]` nunca aplica no estado não-estampado*.
 */

import Link from 'next/link'
import type { LinhaDoRadar } from '@/lib/balance/radar-da-mesa'

/** ⭐ o tom de cada gravidade — a tela PINTA, a gravidade quem decide é a lib */
export const TOM: Record<string, { led: string; fundo: string; tinta: string }> = {
  CORAL: {
    led: 'var(--fam-coral-mid)',
    fundo: 'var(--fam-coral-bg)',
    tinta: 'var(--fam-coral-ink)',
  },
  AMBAR: {
    led: 'var(--fam-ambar-mid)',
    fundo: 'var(--fam-ambar-bg)',
    tinta: 'var(--fam-ambar-ink)',
  },
  VERDE: {
    led: 'var(--fam-verde-mid)',
    fundo: 'var(--fam-verde-bg)',
    tinta: 'var(--fam-verde-ink)',
  },
}

/** ⚠️ formata do TEXTO, nunca de `new Date(dia)` — em fuso negativo isso volta um dia */
export const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`

/** ⭐ o redondo é régua de MILHAR — o centavo vive no `title` (a dieta de 10/10) */
export const redondo = (n: number) =>
  `R$ ${Math.round(n).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`

/**
 * ⭐ O CHASSI DO MÓDULO — UM componente pros 14 módulos das duas mesas.
 *
 * ⚠️ `max-[1023px]:col-span-12` é o corte de **1023px** que o arquivo declara — abaixo dele
 * tudo empilha. ⛔ **UMA composição**: não há um bloco só-celular ao lado de um só-desktop
 * (REGRA 12); o que muda é o SPAN, e quem muda é o CSS.
 */
export function Mod({
  span,
  titulo,
  link,
  aoVivo,
  children,
}: {
  span: 4 | 5 | 6 | 7 | 8 | 12
  titulo: string
  link?: { rotulo: string; href: string }
  /** ⭐ o selo `AO VIVO` da referência (só a mesa ② usa) */
  aoVivo?: boolean
  children: React.ReactNode
}) {
  const spans: Record<number, string> = {
    4: 'col-span-4',
    5: 'col-span-5',
    6: 'col-span-6',
    7: 'col-span-7',
    8: 'col-span-8',
    12: 'col-span-12',
  }
  return (
    <section
      className={`${spans[span]} max-[1023px]:col-span-12 relative overflow-hidden border`}
      style={{
        background: 'var(--prod-surface)',
        borderColor: 'var(--prod-line)',
        borderRadius: 'var(--prod-r-cartao)',
      }}
    >
      <div className="flex items-center justify-between gap-[10px] px-[16px] pb-[8px] pt-[13px]">
        <div
          className="flex items-center text-[11px] font-extrabold tracking-[0.06em]"
          style={{ color: 'var(--prod-muted)' }}
        >
          {titulo}
          {aoVivo && (
            <span
              className="ml-[10px] inline-flex items-center gap-[6px] rounded-full px-[10px] py-[3px] text-[10.5px] font-extrabold"
              style={{ background: 'var(--fam-verde-bg)', color: 'var(--fam-verde-ink)' }}
            >
              <i
                className="h-[7px] w-[7px] rounded-full animate-pulse motion-reduce:animate-none"
                style={{ background: 'var(--fam-verde-mid)' }}
                aria-hidden
              />
              AO VIVO
            </span>
          )}
        </div>
        {link && (
          <Link
            href={link.href}
            className="text-[11.5px] font-extrabold hover:underline"
            style={{ color: 'var(--prod-accent)' }}
          >
            {link.rotulo} →
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

/**
 * ⭐⭐ O RADAR — o MESMO componente pras duas mesas, porque é o MESMO tipo (`LinhaDoRadar`).
 *
 * ⛔ **A linha em ORDEM FICA na tela dizendo que está em ordem.** Radar que some quando o
 * trabalho zera faz o dono deixar de saber se foi vigiado ou se a tela quebrou — é a lição da
 * *"fila zerada esconde o trabalho, nunca a ferramenta"* (12/09).
 */
export function RadarDaMesa({
  linhas,
  placar,
  fraseVazia = 'nada pede a tua mão agora',
}: {
  linhas: LinhaDoRadar[]
  placar: { coral: number; ambar: number }
  fraseVazia?: string
}) {
  return (
    <div className="flex flex-col gap-[6px] px-[10px] pb-[12px] pt-[4px]">
      {linhas.map((l) => {
        const t = TOM[l.gravidade]
        return (
          <Link
            key={l.id}
            href={l.href}
            className="flex items-center gap-[11px] px-[10px] py-[9px] text-[13px] font-bold"
            style={{ background: t.fundo, color: t.tinta, borderRadius: '10px' }}
          >
            {/*
             * ⚠️ O LED PULSA SÓ NO CORAL, e o `motion-reduce:animate-none` é obrigatório:
             * animação que ignora reduced-motion é acessibilidade quebrada.
             */}
            <span
              className={`h-[9px] w-[9px] flex-none rounded-full ${
                l.gravidade === 'CORAL' ? 'animate-pulse motion-reduce:animate-none' : ''
              }`}
              style={{ background: t.led }}
              aria-hidden
            />
            <span className="flex-1">
              {l.rotulo}
              {l.detalhe && (
                <span className="ml-[8px] text-[11.5px] font-semibold opacity-80">
                  {l.detalhe}
                </span>
              )}
            </span>
            <span className="tabular-nums">{l.valor}</span>
          </Link>
        )
      })}
      <div className="px-[10px] text-[11px] font-bold" style={{ color: 'var(--prod-muted)' }}>
        {placar.coral + placar.ambar === 0
          ? fraseVazia
          : `${placar.coral} pede(m) hoje · ${placar.ambar} de atenção`}
      </div>
    </div>
  )
}

export interface EventoDaFitaUI {
  id: string
  href: string
  hora: string
  texto: string
}

/**
 * ⭐⭐ A FITA — rola devagar, **PAUSA no hover** e **respeita reduced-motion**.
 *
 * ⛔ As duas metades são obrigatórias: fita que não pausa é fita que o dono não consegue ler, e
 * animação que ignora `prefers-reduced-motion` é acessibilidade quebrada.
 *
 * ⛔⛔ **EVENTO QUE NÃO EXISTE NA PORTA É PROIBIDO** — a lista chega pronta de um tradutor PURO
 * (`montarFita` na mesa ①, `fitaDaCozinha` na ②), cuja união de tipos é FECHADA, cada membro
 * com a porta escrita ao lado. Inventar uma linha aqui não compila.
 */
export function FitaDaMesa({
  eventos,
  fraseVazia,
  rotulo,
}: {
  eventos: EventoDaFitaUI[]
  fraseVazia: string
  rotulo: string
}) {
  return (
    <section
      className="group col-span-12 overflow-hidden whitespace-nowrap border-y"
      style={{ background: 'var(--prod-surface)', borderColor: 'var(--prod-line)' }}
      aria-label={rotulo}
    >
      {eventos.length === 0 ? (
        <div
          className="px-[16px] py-[9px] text-[12.5px] font-bold"
          style={{ color: 'var(--prod-muted)' }}
        >
          {fraseVazia}
        </div>
      ) : (
        <div className="inline-flex animate-[rolar_46s_linear_infinite] py-[9px] tabular-nums group-hover:[animation-play-state:paused] motion-reduce:animate-none">
          {/* ⚠️ a lista é desenhada DUAS vezes pra a rolagem não ter buraco no fim — o mesmo
              truque do `innerHTML += innerHTML` que a referência declara no `<script>`. */}
          {[0, 1].map((volta) =>
            eventos.map((e) => (
              <Link
                key={`${volta}:${e.id}`}
                href={e.href}
                className="mx-[14px] text-[12.5px] font-bold hover:underline"
              >
                <span style={{ color: 'var(--prod-muted)' }}>{e.hora}</span>{' '}
                <span>{e.texto}</span>
              </Link>
            )),
          )}
        </div>
      )}
    </section>
  )
}

/**
 * ⭐ O CONTAINER das duas mesas — o teto de **1440px** e o padding de **26px** que o arquivo
 * declara, com o corte de 1023px.
 */
export function MesaGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mx-auto grid max-w-[1440px] grid-cols-12 gap-[12px] px-[26px] pb-[70px] pt-[18px] max-[1023px]:px-[14px]"
      /** ⚠️ a tinta BASE da mesa — sem ela o texto herda a cor do shell e some no tema escuro */
      style={{ color: 'var(--prod-primary)' }}
    >
      {children}
    </div>
  )
}
