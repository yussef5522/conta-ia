'use client'

/**
 * ⭐⭐⭐ 🛒 CONSUMO & COMPRAS — A TELA. `docs/consumo-e-compras-referencia.html` É A LEI (16/10).
 *
 * **A ordem do dono:** *"O ARQUIVO É A LEI: tokens 1:1, os comentários do CSS são as leis
 * C0–C15, e o `<script>` é a especificação da MATEMÁTICA. Nada de inventar layout ou conta
 * diferente do arquivo."* O guard `__tests__/regras-ui/consumo-e-compras-bate-com-a-referencia`
 * **ABRE o arquivo** e compara token por VALOR, medida por medida, módulo por módulo.
 *
 * ⛔⛔ **LEI C0 — A TELA DE PRODUÇÃO FICA INTOCADA.** Isto é rota PRÓPRIA; nenhum arquivo de
 * `producao/` foi tocado, e há guard afirmando isso. *A tela nova não paga o preço de mexer na
 * que já funciona.*
 *
 * ⛔⛔ **A TELA NÃO CALCULA NADA.** Todo número vem de `lerConsumoECompras` (o orquestrador) ou
 * da lib PURA (`consumo-e-compras.ts`). A única aritmética que acontece no navegador é o − / +
 * do PEDIR, e ela mora em `ajustarQuantidade`/`totalDoCard` **na lib** — *regra que mora num
 * `onClick` é regra que ninguém prova*. Uma conta própria aqui seria a 2ª resposta pra *"quanto
 * pedir?"*, e ela divergiria do radar ① no primeiro ajuste de folga.
 *
 * ⛔ **TELA NOVA NASCE COM O GUARD** (a lição da lixeira, 20/09): `fetchComTimeout` + estados
 * EXPLÍCITOS (`CARREGANDO | FALHOU | OK`) + "tentar de novo". *Enquanto "ausência de dado"
 * servir de estado, o caso não previsto vira spinner eterno.*
 *
 * ⚠️ **E A EMPRESA VEM DA PORTA ÚNICA** (`use(params)`), nunca de `document.cookie` — o
 * `current_empresa_id` é `httpOnly` e o cliente **não o enxerga** (a cicatriz de 20/09, em que
 * a lixeira ficou em "carregando…" pra sempre porque o fetch nunca SAÍA).
 */

import { useCallback, useEffect, useMemo, useState, use } from 'react'
import Link from 'next/link'
import { ShoppingBasket, Loader2, Plus, ChevronRight, ClipboardCopy, Check } from 'lucide-react'
import { fetchComTimeout } from '@/lib/http/fetch-com-timeout'
import { BuscaItem } from '@/components/estoque/busca-item'
import { CC, FAROL, MED } from '@/lib/compras/tokens'
import {
  DIAS,
  fmt1,
  ajustarQuantidade,
  totalDoCard,
  textoDoPedido,
} from '@/lib/compras/consumo-e-compras'
import type { PeriodoDaMargem } from '@/lib/margem/janela'
import type {
  ConsumoECompras,
  LinhaDeConsumo,
  CardDaMesa,
} from '@/lib/compras/leitura'

type Estado = 'CARREGANDO' | 'FALHOU' | 'OK'
type Aba = 'CAROS' | 'PORCOES'

const brl = (n: number) => `R$ ${Math.round(n).toLocaleString('pt-BR')}`
const brl2 = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** ⭐ os 4 períodos da lei C4 — SEMANA é o padrão, e quem decide isso é a ROTA */
const PERIODOS: { chave: PeriodoDaMargem; rotulo: string }[] = [
  { chave: 'HOJE', rotulo: 'dia' },
  { chave: 'SEMANA', rotulo: 'semana' },
  { chave: 'MES', rotulo: 'mês' },
]

/* ═══════════════════════ C3 · o spark das 8 semanas ═══════════════════════ */
/**
 * ⭐ O SPARK DO HERÓI (lei C3) — 8 semanas, da mais antiga pra a mais recente.
 *
 * ⚠️ Semana sem consumo medido **não vira ponto em zero**: ela fica fora do traço, pela mesma
 * régua da sparkline do Radar — *zero se leria como "ninguém usou", e a verdade é "ninguém
 * mediu"*.
 */
function Spark8({ valores }: { valores: number[] }) {
  if (valores.length < 2) return null
  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const faixa = max - min || 1
  const pts = valores.map((v, i) => {
    const x = (i * 600) / (valores.length - 1)
    const y = 38 - ((v - min) / faixa) * 30
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const linha = pts.map((p, i) => `${i ? 'L' : 'M'}${p}`).join('')
  return (
    <svg
      viewBox="0 0 600 44"
      preserveAspectRatio="none"
      className="mt-2 w-full"
      style={{ height: MED.spark }}
      role="img"
      aria-label="consumo das últimas 8 semanas"
    >
      <path d={`${linha} L600,44 L0,44 Z`} fill={CC.acao} opacity="0.1" />
      <path d={linha} fill="none" stroke={CC.acao} strokeWidth="2.5" />
    </svg>
  )
}

/* ═══════════════════════ C4 · as barras com o GHOST ═══════════════════════ */
/**
 * ⭐⭐ AS BARRAS DA SEMANA COM O FANTASMA TRACEJADO (lei C3/C4): a barra cheia é o período, a
 * tracejada é o MESMO dia-da-semana na semana anterior.
 *
 * ⭐⭐⭐ **A LEI DO DIA FECHADO (17/10) MANDA NO RÓTULO — e ela nasceu de um defeito de RÓTULO,
 * não de número.** Antes, *"dia sem dado = a apurar"* era a única régua, e aí **ausência de
 * MOVIMENTO virava ausência de DADO**: o coxão aparecia com qua/qui/sex como "—" porque a casa
 * não abriu coxão naqueles dias — um fato que o dono conhece inteiro, mostrado como dúvida.
 *
 * | estado | barra | número |
 * |---|---|---|
 * | **FECHADO** | barra **NO CHÃO** (3px, cheia) | **"0" ESCRITO** — zero é dado |
 * | **HOJE** | o parcial, com selo *hoje · parcial* | o que já saiu |
 * | **PENDENTE** | tracejada vazia | **"—"**, com o MOTIVO no título |
 * | **SEM_LIVRO** | tracejada vazia | "—", *o item não estava na casa* |
 *
 * ⛔ Quem decide é o `estado` que o SERVIDOR mandou (`dia-do-consumo.ts`) — a tela **nunca**
 * pergunta `valor == null`: era essa pergunta que colapsava "zero" com "a apurar".
 */
function BarrasDaSemana({ barras, unidade }: { barras: LinhaDeConsumo['barras']; unidade: string }) {
  const medidos = barras.flatMap((b) => [b.valor, b.ghost]).filter((v): v is number => v != null)
  const max = Math.max(1, ...medidos)
  const pico = Math.max(0, ...barras.map((b) => b.valor ?? 0))
  return (
    <>
      <div className="flex items-end gap-[9px] px-4 pt-1" style={{ height: MED.barras }}>
        {barras.map((b) => {
          const top = b.valor != null && b.valor === pico && pico > 0
          const aApurar = b.estado === 'PENDENTE' || b.estado === 'SEM_LIVRO' || b.estado === 'FUTURO'
          const porque =
            b.estado === 'PENDENTE'
              ? 'a apurar — a venda deste dia ainda não foi baixada do estoque'
              : b.estado === 'SEM_LIVRO'
                ? 'a apurar — o item ainda não estava na casa neste dia'
                : b.estado === 'FUTURO'
                  ? 'o dia ainda não aconteceu'
                  : b.estado === 'HOJE'
                    ? `hoje · parcial: ${fmt1(b.valor ?? 0)} ${unidade.toLowerCase()} até agora`
                    : `${fmt1(b.valor ?? 0)} ${unidade.toLowerCase()}`
          return (
            <div key={b.dia} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span
                className="text-[10px] font-extrabold tabular-nums"
                style={{ color: top ? CC.verde : b.estado === 'HOJE' ? CC.acao : CC.tinta2 }}
                title={porque}
              >
                {aApurar ? '—' : fmt1(b.valor ?? 0)}
              </span>
              <div className="flex w-full flex-1 items-end justify-center gap-[3px]">
                <span
                  className="w-[42%] max-w-[24px] rounded-t-[5px]"
                  title={`semana passada: ${b.ghost == null ? 'a apurar' : `${fmt1(b.ghost)} ${unidade.toLowerCase()}`}`}
                  style={{
                    height: b.ghost == null ? 6 : `${Math.round((b.ghost / max) * 100)}%`,
                    border: `1.5px dashed ${CC.linhaForte}`,
                    borderBottom: 0,
                    background: 'transparent',
                  }}
                />
                <span
                  className="w-[42%] max-w-[24px] rounded-t-[5px]"
                  title={porque}
                  style={
                    aApurar
                      ? // ⛔ tracejada VAZIA: é a única coisa na tela que significa "a apurar"
                        { height: 6, background: CC.mod2, border: `1px dashed ${CC.linha}` }
                      : {
                          // ⭐ ZERO É BARRA NO CHÃO, cheia: o dia foi medido e deu zero
                          height: `${Math.max(3, Math.round(((b.valor ?? 0) / max) * 100))}%`,
                          background: top ? CC.verde : CC.acao,
                          opacity: b.estado === 'HOJE' ? 0.45 : 0.92,
                          border: b.estado === 'HOJE' ? `1.5px dashed ${CC.acao}` : undefined,
                        }
                  }
                />
              </div>
              <span
                className="text-[10px] font-extrabold"
                style={{ color: b.estado === 'HOJE' ? CC.acao : CC.tinta3 }}
              >
                {b.estado === 'HOJE' ? 'hoje' : DIAS[b.diaDaSemana]?.toLowerCase()}
              </span>
            </div>
          )
        })}
      </div>
      <div className="flex gap-3.5 px-4 pb-3 pt-1.5 text-[11px] font-bold" style={{ color: CC.tinta2 }}>
        <span>
          <i className="mr-[5px] inline-block h-[9px] w-[9px] rounded-[3px] align-[-1px]" style={{ background: CC.acao }} />
          este período
        </span>
        <span>
          <i
            className="mr-[5px] inline-block h-[9px] w-[9px] rounded-[3px] align-[-1px]"
            style={{ border: `1.5px dashed ${CC.linhaForte}` }}
          />
          o período anterior
        </span>
        <span>
          <i
            className="mr-[5px] inline-block h-[9px] w-[9px] rounded-[3px] align-[-1px]"
            style={{ border: `1.5px dashed ${CC.acao}`, background: CC.acao, opacity: 0.45 }}
          />
          hoje · parcial
        </span>
      </div>
    </>
  )
}

/* ═══════════════════════ o módulo (o chassi da referência) ═══════════════════════ */
function Mod({ titulo, dica, children }: { titulo: string; dica?: string; children: React.ReactNode }) {
  return (
    <section
      className="mb-3 overflow-hidden border"
      style={{ background: CC.mod, borderColor: CC.linha, borderRadius: CC.raio }}
      aria-label={titulo.toLowerCase()}
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 pb-2 pt-3">
        <h2 className="m-0 text-[11px] font-extrabold tracking-[.09em]" style={{ color: CC.tinta3 }}>
          {titulo}
        </h2>
        {dica && (
          <span className="text-[11px] font-bold" style={{ color: CC.tinta3 }}>
            {dica}
          </span>
        )}
      </div>
      {children}
    </section>
  )
}

/** ⭐ o chip da referência (`.chip`) — ligado, tracejado de "+ adicionar", ou mini */
function Chip({
  on,
  add,
  mini,
  diaOn,
  children,
  ...rest
}: {
  on?: boolean
  add?: boolean
  mini?: boolean
  diaOn?: boolean
  children: React.ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const estilo: React.CSSProperties = diaOn
    ? { background: CC.verdeChao, borderColor: CC.verdeChao, color: CC.verdeSobre }
    : on
      ? { background: CC.acaoVivo, borderColor: CC.acaoVivo, color: CC.sobreForte }
      : { background: CC.mod, borderColor: CC.linhaForte, color: add ? CC.tinta3 : CC.tinta2 }
  return (
    <button
      type="button"
      {...rest}
      className={`whitespace-nowrap rounded-full border font-bold ${mini ? 'px-[10px] py-[3px] text-[11px]' : 'px-[13px] py-[6px] text-[12.5px]'} ${add ? 'border-dashed' : ''}`}
      style={estilo}
    >
      {children}
    </button>
  )
}

/* ═══════════════════════ C8 · a MESA DE PEDIDO ═══════════════════════ */
/**
 * ⭐⭐⭐ UM CARD POR FORNECEDOR + DIA DE CHEGADA (lei C8) — *"como os líderes: um pedido por
 * fornecedor, não uma lista solta de itens"*.
 *
 * ⛔⛔ **PROSA É PROIBIDA no ⓘ:** a conta aberta sai em **números rotulados** (`cobre seg+ter ·
 * sai na janela 6 KG · folga +10% · precisa 6,6 · sobra 0 · → pedir 6,6`). Um parágrafo
 * explicando a conta é o que faz o dono parar de ler — e ele precisa CONFERIR, não ler.
 */
function MesaDePedido({
  card,
  ajustes,
  empresa,
  aoAjustar,
  aoAbrirItem,
  hoje,
  aberto,
  aoAlternar,
  temSel,
}: {
  card: CardDaMesa
  ajustes: Record<string, number>
  empresa: string
  aoAjustar: (itemId: string, delta: number) => void
  aoAbrirItem: (itemId: string) => void
  hoje: number
  /** ⭐ quem decide quem nasce aberto é a PÁGINA (o card do item na tela) — o card só obedece */
  aberto: boolean
  aoAlternar: () => void
  /** ⭐ este card contém o item aberto na tela → borda de AÇÃO (a `.sel` da referência) */
  temSel: boolean
}) {
  const [copiado, setCopiado] = useState(false)
  // ⭐ a quantidade EXIBIDA é o ajuste do dono quando existe, senão o que a conta pediu
  const qDe = (itemId: string, pedir: number) => ajustes[itemId] ?? pedir
  const linhas = card.linhas.map((l) => ({ ...l, q: qDe(l.itemId, l.pedir) }))
  // ⛔ a MESMA régua do servidor (`totalDoCard` na lib pura) — nunca uma soma local
  const total = totalDoCard(linhas.map((l) => ({ quantidade: l.q, precoPago: l.precoPago })))
  // ⭐ o texto do WhatsApp também é da LIB, com as quantidades AJUSTADAS
  const texto = textoDoPedido({
    empresa,
    fornecedor: card.fornecedor,
    chegaDia: card.chegaDia,
    linhas: linhas.map((l) => ({ nome: l.nome, quantidade: l.q, unidade: l.unidade })),
  })
  /**
   * ⛔⛔ O PILL DO PRAZO VEM DO `pedirEmMin` (lei C8 v3.2), NUNCA de `chegaDia === hoje`.
   *
   * A pergunta do card é *"quando eu PEÇO?"* — e pedir é **chegada − antecedência**. A régua
   * antiga perguntava *"a mercadoria chega hoje?"*, que é outra coisa: o pedido de um fornecedor
   * que entrega em 3 dias tem que gritar HOJE três dias ANTES da chegada. Com a régua antiga o
   * card só acendia no dia em que a entrega era esperada — ou seja, **tarde demais, sempre**.
   */
  const urgente = card.urgente

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
    } catch {
      // ⚠️ clipboard bloqueado não pode travar o gesto: o texto fica à vista pra copiar na mão
      setCopiado(false)
    }
  }

  return (
    <div
      className="mx-4 mb-3.5 mt-1 overflow-hidden rounded-[12px] border"
      /* ⚠️ a ORDEM é a do CSS da referência (`.urg` e depois `.sel`): o card do item ABERTO
         ganha a borda de AÇÃO mesmo sendo urgente — ali o dono já está trabalhando. */
      style={{ borderColor: temSel ? CC.acao : urgente ? CC.coral : CC.linhaForte }}
    >
      {/**
        * ⭐⭐⭐ A LINHA-RESUMO (lei C8 v3.2) — o card NASCE RECOLHIDO.
        *
        * Com 5 fornecedores pendentes a mesa inteira aberta era uma parede de 7 colunas × N
        * itens: o dono rolava a tela pra achar o que pedir. Recolhido, cada card responde em uma
        * linha *"quanto é e até quando"*, e ele abre o que vai pedir agora.
        *
        * ⛔ O TOQUE INTEIRO DO CABEÇALHO ABRE — não um chevron de 11px: no celular, alvo pequeno
        * é alvo que se erra, e errar aqui abre o card errado.
        */}
      <button
        type="button"
        onClick={aoAlternar}
        aria-expanded={aberto}
        className="flex w-full flex-wrap items-center gap-3 px-3.5 py-[11px] text-left"
        style={{ background: CC.mod2 }}
      >
        <span className="text-[13.5px] font-extrabold" style={{ color: CC.tinta }}>
          {card.fornecedor ?? 'sem fornecedor'}
        </span>
        <span className="text-[11.5px] font-bold" style={{ color: CC.tinta3 }}>
          chega {DIAS[card.chegaDia]}
        </span>
        <span className="ml-auto text-[12px] font-extrabold tabular-nums" style={{ color: CC.tinta2 }}>
          {card.linhas.length} item{card.linhas.length > 1 ? 's' : ''} ·{' '}
          {total == null ? 'total a apurar' : brl(total)}
        </span>
        {/* ⭐ o PRAZO é o que decide se o dono abre agora — por isso ele é pill, não texto solto */}
        <span
          className="rounded-full px-[11px] py-[4px] text-[11.5px] font-extrabold"
          style={
            urgente
              ? { background: CC.coralFundo, color: CC.coral }
              : { background: CC.acaoFundo, color: CC.acao }
          }
        >
          {urgente
            ? '⚠ PEDIR HOJE'
            : `pedir até ${DIAS[(hoje + card.pedirEmMin + 7) % 7]}`}
        </span>
        <span className="text-[11px] font-extrabold" style={{ color: CC.tinta3 }}>
          {aberto ? '▲' : '▼'}
        </span>
      </button>

      {/* ⛔ o corpo NÃO renderiza quando recolhido — esconder por CSS deixaria 7 colunas × N
          itens no DOM de cada card, e a mesa tem um card por fornecedor pendente */}
      {aberto && (
        <>
      {/* ⭐ as 7 colunas da referência, na ordem dela */}
      <div
        className="hidden grid-cols-[minmax(110px,1.2fr)_1fr_.85fr_.95fr_1.5fr_.85fr_.85fr] gap-2 border-b px-3.5 py-[9px] text-[9.5px] font-extrabold tracking-[.06em] min-[900px]:grid"
        style={{ borderColor: CC.linha, color: CC.tinta3 }}
      >
        <span>ITEM</span>
        <span>NA SEMANA</span>
        <span>TEM AGORA</span>
        <span>SAI ATÉ CHEGAR</span>
        {/* ⚠️⚠️ DIVERGÊNCIA DECLARADA DA REFERÊNCIA, com o motivo: ela escreve "+10%" cravado
            no cabeçalho porque a amostra dela tem folga FIXA. Aqui a folga é **POR ITEM** (lei
            C5: *"folga % (default 10)"*), então um número no cabeçalho mentiria no card que
            mistura itens com folgas diferentes. ⛔ E cravar `?? 10` seria a constante da lib
            digitada na tela — a 2ª régua. Cada LINHA diz a folga dela, que é a verdade. */}
        <span>PEDIR · JÁ COM A FOLGA DO ITEM</span>
        <span className="text-right">PAGO ÚLT.</span>
        <span className="text-right">TOTAL</span>
      </div>

      {linhas.map((l) => (
        <div
          key={l.itemId}
          className="grid grid-cols-1 gap-2 border-b px-3.5 py-[9px] text-[13px] font-bold min-[900px]:grid-cols-[minmax(110px,1.2fr)_1fr_.85fr_.95fr_1.5fr_.85fr_.85fr] min-[900px]:items-center"
          style={{ borderColor: CC.linha }}
        >
          <button type="button" onClick={() => aoAbrirItem(l.itemId)} className="text-left">
            <span className="font-extrabold" style={{ color: CC.tinta }}>
              {l.nome}
            </span>
            <span className="block text-[10px] font-bold" style={{ color: CC.tinta3 }}>
              ver o item
            </span>
          </button>

          <span style={{ color: CC.tinta }}>
            <span className="font-extrabold tabular-nums" style={{ fontSize: MED.uso }}>
              {fmt1(l.noPeriodo)} {l.unidade}
            </span>
            <span className="block text-[10px] font-bold" style={{ color: CC.tinta3 }}>
              NO PERÍODO
            </span>
          </span>

          <span style={{ color: CC.tinta }}>
            <span className="tabular-nums">{fmt1(l.temAgora)} {l.unidade}</span>
            <span className="block text-[10px] font-bold" style={{ color: CC.tinta3 }}>
              TEM AGORA
            </span>
          </span>

          <span style={{ color: CC.tinta }}>
            <span className="tabular-nums">{fmt1(l.saiAteChegar)} {l.unidade}</span>
            <span className="block text-[10px] font-bold" style={{ color: CC.tinta3 }}>
              SAI ATÉ CHEGAR
            </span>
          </span>

          {/* ⭐⭐ O PEDIR É O MAIOR NÚMERO DA LINHA (lei C8), na caixa índigo, editável */}
          <span>
            <span
              className="inline-flex items-center overflow-hidden rounded-[10px]"
              style={{ background: CC.acaoFundo, border: `1.5px solid ${CC.acao}` }}
            >
              <button
                type="button"
                onClick={() => aoAjustar(l.itemId, -1)}
                aria-label={`diminuir o pedido de ${l.nome}`}
                className="h-9 w-7 text-[15px] font-extrabold"
                style={{ color: CC.acao }}
              >
                −
              </button>
              <span
                className="min-w-[88px] text-center font-extrabold tabular-nums"
                style={{ fontSize: MED.pedir, color: CC.acao }}
              >
                {fmt1(l.q)} {l.unidade}
              </span>
              <button
                type="button"
                onClick={() => aoAjustar(l.itemId, 1)}
                aria-label={`aumentar o pedido de ${l.nome}`}
                className="h-9 w-7 text-[15px] font-extrabold"
                style={{ color: CC.acao }}
              >
                +
              </button>
            </span>
            <span className="block text-[10px] font-bold" style={{ color: CC.tinta3 }}>
              PRA NÃO FALTAR · JÁ COM +{l.conta.folga}%
            </span>
          </span>

          <span className="min-[900px]:text-right" style={{ color: CC.tinta }}>
            <span className="tabular-nums">
              {l.precoPago == null ? '—' : `R$ ${fmt1(l.precoPago)}/${l.unidade.toLowerCase()}`}
            </span>
            <span className="block text-[10px] font-bold" style={{ color: CC.tinta3 }}>
              PAGO ÚLT.
            </span>
          </span>

          <span className="min-[900px]:text-right" style={{ color: CC.tinta }}>
            <b className="tabular-nums">
              {l.precoPago == null ? 'a apurar' : brl(l.q * l.precoPago)}
            </b>
            <span className="block text-[10px] font-bold" style={{ color: CC.tinta3 }}>
              TOTAL
            </span>
          </span>

          {/* ⓘ A CONTA ABERTA, EM NÚMEROS ROTULADOS — PROSA É PROIBIDA */}
          <span className="flex flex-wrap gap-[7px] pb-1.5 pt-0.5 min-[900px]:col-span-full">
            {[
              <>ⓘ cobre <b style={{ color: CC.tinta }}>{l.conta.cobre}</b></>,
              <>sai na janela <b style={{ color: CC.tinta }}>{fmt1(l.conta.saiNaJanela)} {l.unidade}</b></>,
              <>folga <b style={{ color: CC.tinta }}>+{l.conta.folga}%</b></>,
              <>precisa <b style={{ color: CC.tinta }}>{fmt1(l.conta.precisa)} {l.unidade}</b></>,
              <>sobra na chegada <b style={{ color: CC.tinta }}>{fmt1(l.conta.sobra)} {l.unidade}</b></>,
              <>→ pedir <b style={{ color: CC.tinta }}>{fmt1(l.pedir)} {l.unidade}</b></>,
            ].map((n, i) => (
              <span
                key={i}
                className="rounded-full border px-[9px] py-[3px] text-[10.5px] font-extrabold"
                style={{ background: CC.mod2, borderColor: CC.linha, color: CC.tinta2 }}
              >
                {n}
              </span>
            ))}
          </span>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-3 px-3.5 py-[11px]">
        <span className="text-[14px] font-extrabold tabular-nums" style={{ color: CC.tinta }}>
          {total == null ? 'total a apurar' : brl(total)}{' '}
          <small className="text-[11px] font-bold" style={{ color: CC.tinta3 }}>
            {total == null ? '— falta o preço de um item' : 'o pedido inteiro'}
          </small>
        </span>
        <button
          type="button"
          onClick={(e) => {
            // ⛔ o copiar NÃO pode fechar o card (lei C8 v3.2): o dono copia e confere o texto
            e.stopPropagation()
            void copiar()
          }}
          className="ml-auto rounded-[9px] border px-3.5 py-2 text-[12.5px] font-extrabold"
          style={
            copiado
              ? { borderColor: CC.verde, background: CC.verdeFundo, color: CC.verde }
              : { borderColor: CC.acao, background: CC.acaoFundo, color: CC.acao }
          }
        >
          {copiado ? <><Check className="mr-1 inline h-3.5 w-3.5" />copiado</> : <><ClipboardCopy className="mr-1 inline h-3.5 w-3.5" />copiar pedido</>}
        </button>
      </div>
      {/* ⚠️ o texto fica à vista: clipboard bloqueado (navegador/permissão) não pode matar o gesto */}
      <p className="px-3.5 pb-3 text-[11px]" style={{ color: CC.tinta3 }}>
        {texto}
      </p>
        </>
      )}
    </div>
  )
}

/* ═══════════════════════ a página ═══════════════════════ */
export default function ConsumoEComprasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: empresaId } = use(params)

  const [estado, setEstado] = useState<Estado>('CARREGANDO')
  const [erro, setErro] = useState<string | null>(null)
  const [dados, setDados] = useState<ConsumoECompras | null>(null)
  const [periodo, setPeriodo] = useState<PeriodoDaMargem>('SEMANA')
  const [livre, setLivre] = useState<{ de: string; ate: string } | null>(null)
  const [aba, setAba] = useState<Aba>('CAROS')
  const [itemId, setItemId] = useState<string | null>(null)
  const [adicionando, setAdicionando] = useState(false)
  /** ⭐ o − / + é LOCAL de propósito: é o ajuste do dono ANTES de copiar, não um estado do banco */
  const [ajustes, setAjustes] = useState<Record<string, number>>({})
  /**
   * ⭐ o que o DONO abriu/fechou na mesa, por chave de card.
   *
   * ⚠️ Mapa esparso de propósito (`undefined` = *"ele não tocou"*): assim o default
   * *"o card do item aberto nasce aberto"* continua valendo, e um `false` só existe quando ele
   * FECHOU de verdade. Pré-popular com `false` apagaria o default no primeiro render.
   */
  const [cardsAbertos, setCardsAbertos] = useState<Record<string, boolean>>({})
  /**
   * ⭐ o que o dono está DIGITANDO nos campos de config, por item.
   *
   * ⚠️ **Rascunho local porque gravar a cada tecla seria um POST por caractere** — e cada POST
   * recarrega a conta inteira (`carregar()`), então a tela piscaria no meio da digitação. A
   * gravação é no blur/Enter. ⚠️ E ele é **por `itemId`**: trocar de item com um rascunho
   * pendurado não pode levar o texto do frango pro queijo.
   */
  const [rascunho, setRascunho] = useState<Record<string, { fornecedor?: string; antecedencia?: string; folga?: string }>>({})
  const [podeConfigurar, setPodeConfigurar] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    setEstado('CARREGANDO')
    setErro(null)
    const q =
      periodo === 'DATAS' && livre
        ? `periodo=DATAS&de=${livre.de}&ate=${livre.ate}`
        : `periodo=${periodo}`
    const r = await fetchComTimeout<ConsumoECompras>(
      `/api/empresas/${empresaId}/estoque/consumo-e-compras?${q}`,
    )
    // ⛔ o estado vem do QUE VOLTOU, nunca da ausência: `erro: null` com `ok: false` é a tela
    //    desmontada, e aí não há o que mostrar.
    if (!r.ok) {
      if (r.erro) {
        setErro(r.erro)
        setEstado('FALHOU')
      }
      return
    }
    setDados(r.data)
    setEstado('OK')
  }, [empresaId, periodo, livre])

  useEffect(() => {
    void carregar()
  }, [carregar])

  // ⚠️ quem pode mexer na CONFIG DE COMPRA é `stock.manage` — a tela PERGUNTA em vez de
  // adivinhar, senão o operador vê chips que o servidor vai recusar (o "chip mudo" de 17/09).
  useEffect(() => {
    let vivo = true
    void fetchComTimeout<{ permissions?: string[] }>(`/api/empresas/${empresaId}/me`).then((r) => {
      if (!vivo || !r.ok) return
      const p = r.data?.permissions ?? []
      setPodeConfigurar(p.includes('stock.manage') || p.includes('stock.*') || p.includes('*'))
    })
    return () => {
      vivo = false
    }
  }, [empresaId])

  const lista = useMemo<LinhaDeConsumo[]>(
    () => (dados ? (aba === 'CAROS' ? dados.caros : dados.porcoes) : []),
    [dados, aba],
  )
  const item = useMemo(
    () => lista.find((l) => l.itemId === itemId) ?? lista[0] ?? null,
    [lista, itemId],
  )

  /**
   * ⭐⭐⭐ A GRAVAÇÃO DA CONFIG — **UMA** função pros QUATRO campos (lei C5 v3.2).
   *
   * ⛔⛔ **ZERO PORTA NOVA:** os dias de chegada, o fornecedor, a antecedência e a folga vão
   * pela MESMA rota (`/config`, `stock.manage`) que já era a única porta de escrita de
   * `stock_compra_config`. Uma rota por campo faria quatro lugares gravando a mesma linha, e
   * eles divergiriam no primeiro campo novo — é a doença que o cabeçalho de
   * `config-de-compra.ts` existe pra impedir.
   *
   * ⚠️ `diasChegada` vai SEMPRE no corpo porque o zod da rota o exige; os outros três são
   * opcionais e só viajam quando mudam (o `fornecedor` é `nullable`: `null` explícito é
   * *"não tem"*, e é diferente de não mandar).
   */
  const salvarConfig = useCallback(
    async (
      patch: { diasChegada?: number[]; antecedenciaDias?: number; fornecedor?: string | null; folgaPct?: number },
      oQue: string,
    ) => {
      if (!item) return
      setSalvando(true)
      const r = await fetchComTimeout<{ ok: boolean }>(
        `/api/empresas/${empresaId}/estoque/consumo-e-compras/config`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            itemId: item.itemId,
            diasChegada: item.config.diasChegada,
            ...patch,
          }),
        },
      )
      setSalvando(false)
      // ⛔ falhou é ESTADO, não silêncio: o campo não muda e a tela diz o porquê
      if (!r.ok) {
        setErro(r.erro ?? `Não consegui gravar ${oQue}.`)
        return
      }
      setAjustes({})
      await carregar()
    },
    [item, empresaId, carregar],
  )

  /**
   * ⭐ o fornecedor — casca fina sobre a porta única.
   *
   * ⛔⛔ **VAZIO vira `null` EXPLÍCITO, nunca string vazia:** `fornecedor` é `nullable` no banco
   * e `null` significa *"não tem"* (é o que a mesa agrupa como *"sem fornecedor"*). Gravar `''`
   * criaria um TERCEIRO estado indistinguível de `null` na leitura e distinto na chave do card.
   * ⚠️ E o nome é aparado na EXIBIÇÃO pela leitura (a cicatriz da conta `'sicredi '`), mas o
   * espaço do dono não se grava: `trim()` aqui é o que impede o fornecedor `' '`.
   */
  const gravarFornecedor = useCallback(async () => {
    if (!item || !podeConfigurar) return
    const cru = rascunho[item.itemId]?.fornecedor
    if (cru === undefined) return // ⛔ ele não digitou nada — não grava por abrir e fechar o campo
    const novo = cru.trim() === '' ? null : cru.trim()
    // ⛔ nada muda → nada grava (senão todo blur recarrega a conta inteira)
    if (novo === (item.config.fornecedor ?? null)) {
      setRascunho((m) => ({ ...m, [item.itemId]: { ...m[item.itemId], fornecedor: undefined } }))
      return
    }
    await salvarConfig({ fornecedor: novo }, 'o fornecedor')
    setRascunho((m) => ({ ...m, [item.itemId]: { ...m[item.itemId], fornecedor: undefined } }))
  }, [item, podeConfigurar, rascunho, salvarConfig])

  /**
   * ⭐ antecedência e folga — os dois são INTEIROS ≥ 0 e a régua é a mesma.
   *
   * ⛔ Texto que não é número **não vira zero** (o `|| 0` que esta casa já pagou em quatro
   * parses de quantidade): ele é RECUSADO com a frase que ensina, e o campo volta pro valor
   * gravado. Antecedência 0 é legítima (*"peço e chega no mesmo dia"*); folga 0 também
   * (*"peço o exato"*) — o que não existe é negativo.
   */
  const gravarNumero = useCallback(
    async (qual: 'antecedencia' | 'folga') => {
      if (!item || !podeConfigurar) return
      const cru = rascunho[item.itemId]?.[qual]
      if (cru === undefined) return
      const limpar = () =>
        setRascunho((m) => ({ ...m, [item.itemId]: { ...m[item.itemId], [qual]: undefined } }))
      const n = Number(cru)
      const atual = qual === 'antecedencia' ? item.config.antecedenciaDias : item.config.folgaPct
      if (cru.trim() === '' || !Number.isInteger(n) || n < 0) {
        setErro(
          qual === 'antecedencia'
            ? 'A antecedência é em dias inteiros, a partir de 0 — quantos dias antes da chegada você precisa pedir?'
            : 'A folga é em % inteiro, a partir de 0 — quanto a mais do necessário você quer pedir?',
        )
        limpar()
        return
      }
      if (n === atual) {
        limpar()
        return
      }
      await salvarConfig(
        qual === 'antecedencia' ? { antecedenciaDias: n } : { folgaPct: n },
        qual === 'antecedencia' ? 'a antecedência' : 'a folga',
      )
      limpar()
    },
    [item, podeConfigurar, rascunho, salvarConfig],
  )

  /** ⭐ liga/desliga um dia de chegada — casca fina sobre a porta única */
  const mexerNoDia = useCallback(
    async (dia: number) => {
      if (!item) return
      const atuais = item.config.diasChegada
      const novos = atuais.includes(dia) ? atuais.filter((d) => d !== dia) : [...atuais, dia]
      await salvarConfig({ diasChegada: novos }, 'os dias de chegada')
    },
    [item, salvarConfig],
  )

  const mexerNaLista = useCallback(
    async (idDoItem: string) => {
      const r = await fetchComTimeout<{ ok: boolean }>(
        `/api/empresas/${empresaId}/estoque/radar/watchlist`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lista: aba, itemId: idDoItem }),
        },
      )
      if (!r.ok) {
        setErro(r.erro ?? 'Não consegui adicionar à lista.')
        return
      }
      setAdicionando(false)
      await carregar()
    },
    [empresaId, aba, carregar],
  )

  const ajustar = useCallback((id: string, delta: number) => {
    setAjustes((a) => {
      const base = a[id]
      const card = dados?.mesa.flatMap((c) => c.linhas).find((l) => l.itemId === id)
      const atual = base ?? card?.pedir ?? 0
      return { ...a, [id]: ajustarQuantidade(atual, delta) }
    })
  }, [dados])

  const abrirItem = useCallback(
    (id: string) => {
      setItemId(id)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [],
  )

  const farol = item ? FAROL[item.farol] ?? FAROL.A_APURAR : FAROL.A_APURAR

  return (
    <div className="mx-auto w-full" style={{ maxWidth: MED.teto, color: CC.tinta }}>
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <ShoppingBasket className="h-5 w-5 shrink-0" style={{ color: CC.acao }} />
        <h1 className="text-base font-semibold">Consumo &amp; Compras</h1>
        {dados && (
          <span className="text-[11.5px] font-bold" style={{ color: CC.tinta3 }}>
            {dados.janela.rotulo} · hoje é {DIAS[dados.hojeSegPrimeiro]?.toLowerCase()}
          </span>
        )}
      </div>

      {/* ═══ ESTADOS EXPLÍCITOS — nenhum deles é silêncio ═══ */}
      {estado === 'CARREGANDO' && (
        <div
          className="flex items-center gap-2 border px-4 py-5 text-[13px]"
          style={{ background: CC.mod, borderColor: CC.linha, borderRadius: CC.raio, color: CC.tinta3 }}
        >
          <Loader2 className="h-4 w-4 animate-spin" /> lendo o livro do estoque…
        </div>
      )}
      {estado === 'FALHOU' && (
        <div
          className="border px-4 py-4 text-[13px]"
          style={{ background: CC.coralFundo, borderColor: CC.coral, borderRadius: CC.raio, color: CC.coral }}
        >
          {erro}
          <button type="button" onClick={() => void carregar()} className="ml-2 font-bold underline">
            tentar de novo
          </button>
        </div>
      )}

      {estado === 'OK' && dados && (
        <>
          {erro && (
            <p
              className="mb-3 border px-3.5 py-2.5 text-[12.5px] font-semibold"
              style={{ background: CC.coralFundo, borderColor: CC.coral, borderRadius: CC.raio, color: CC.coral }}
            >
              {erro}
            </p>
          )}

          {/* ═════════ 1 · C7 v3.2 · A SEMANA DO COMPRADOR ═════════ */}
          {/**
            * ⭐⭐⭐ A ESTEIRA DE 7 DIAS (aprovada pelo dono 18/10) — *"a esteira se lê em 2
            * segundos"*. ⛔⛔ **FRASE CORRIDA É PROIBIDA AQUI** (lei C7): a agenda em texto
            * (*"pedir sáb FRANGO · chega SEG · ~18 KG"*) obrigava a LER pra saber o que fazer
            * hoje; a esteira põe o dia no eixo e o número no olho.
            *
            * ⛔ Os slots vêm do SERVIDOR (`dados.semana`, montada pela lib pura): agrupar por dia
            * aqui seria a 2ª resposta pra *"quando eu peço isto?"*, e ela divergiria do pill do
            * card no 1º atrasado.
            */}
          <Mod
            titulo="A SEMANA DO COMPRADOR — O QUE PEDIR EM CADA DIA"
            dica="pedido = chegada − prazo do fornecedor · toque abre o pedido na mesa"
          >
            {/* ⚠️ rola no eixo X no celular — 7 slots não cabem em 390px, e encolher o número
                mataria justamente o que a esteira existe pra mostrar */}
            <div
              className="grid gap-2 overflow-x-auto px-4 pb-3.5 pt-1 tabular-nums"
              style={{ gridTemplateColumns: 'repeat(7,minmax(96px,1fr))' }}
            >
              {dados.semana.map((slot) => (
                <div
                  key={slot.diaDaSemana}
                  className="flex min-h-[88px] flex-col gap-1.5 rounded-[12px] border px-[9px] py-2"
                  style={{
                    borderColor: slot.urgente ? CC.coral : slot.ehHoje ? CC.acao : CC.linha,
                    background: slot.ehHoje ? CC.acaoFundo : CC.mod2,
                  }}
                >
                  <span
                    className="text-[10px] font-extrabold tracking-[.07em]"
                    style={{ color: slot.urgente ? CC.coral : slot.ehHoje ? CC.acao : CC.tinta3 }}
                  >
                    {slot.rotulo}
                  </span>
                  {slot.pedidos.length === 0 ? (
                    /* ⛔ traço, NUNCA "0" — zero seria uma afirmação sobre um dia sem pedido */
                    <span className="my-auto text-[12px] font-bold" style={{ color: CC.tinta3 }}>
                      —
                    </span>
                  ) : (
                    slot.pedidos.map((ped) => (
                      <button
                        key={ped.itemId}
                        type="button"
                        onClick={() => abrirItem(ped.itemId)}
                        className="flex flex-col gap-px rounded-[9px] border px-2 py-1.5 text-left"
                        style={{
                          background: slot.urgente ? CC.coralFundo : CC.mod,
                          borderColor: slot.urgente ? CC.coral : CC.linhaForte,
                        }}
                      >
                        <span
                          className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-extrabold"
                          style={{ color: CC.tinta }}
                        >
                          {ped.pedirEm < 0 ? '⚠ atrasado · ' : slot.urgente ? '⚠ ' : ''}
                          {ped.nome}
                        </span>
                        <span
                          className="text-[15px] font-extrabold tracking-[-.02em]"
                          style={{ color: slot.urgente ? CC.coral : CC.tinta }}
                        >
                          {fmt1(ped.quantidade)} {ped.unidade}
                        </span>
                        <span className="text-[9.5px] font-extrabold" style={{ color: CC.tinta3 }}>
                          → chega {DIAS[ped.chegaDia]}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              ))}
            </div>
          </Mod>

          {/* ⚠️ item sem config APARECE NA LISTA e fica fora da mesa — dito, nunca escondido */}
          {dados.semConfig.length > 0 && (
            <p
              className="mb-3 border px-3.5 py-2.5 text-[12.5px]"
              style={{ background: CC.ambarFundo, borderColor: CC.ambar, borderRadius: CC.raio, color: CC.ambar }}
            >
              {dados.semConfig.length} item{dados.semConfig.length > 1 ? 's' : ''} fora da mesa de
              pedido: <b>{dados.semConfig.map((s) => s.nome).join(' · ')}</b> — configura os dias de
              chegada no item pra ele entrar no pedido.
            </p>
          )}

          {dados.avisos.map((a) => (
            <p
              key={a}
              className="mb-3 border px-3.5 py-2.5 text-[12.5px]"
              style={{ background: CC.ambarFundo, borderColor: CC.ambar, borderRadius: CC.raio, color: CC.ambar }}
            >
              {a}
            </p>
          ))}

          {/* ═════════ 2 · C1/C4 · AS DUAS LISTAS + O PERÍODO ═════════ */}
          <Mod titulo="AS SUAS LISTAS">
            <div className="flex flex-wrap items-center gap-[7px] px-4 pb-3">
              <Chip on={aba === 'CAROS'} onClick={() => { setAba('CAROS'); setItemId(null) }}>
                🥩 OS CAROS
              </Chip>
              <Chip on={aba === 'PORCOES'} onClick={() => { setAba('PORCOES'); setItemId(null) }}>
                🍟 AS PORÇÕES
              </Chip>
              <span className="flex-1" />
              <span className="text-[11px] font-bold" style={{ color: CC.tinta3 }}>
                ver por:
              </span>
              {PERIODOS.map((p) => (
                <Chip
                  key={p.chave}
                  mini
                  on={periodo === p.chave}
                  onClick={() => { setPeriodo(p.chave); setLivre(null) }}
                >
                  {p.rotulo}
                  {periodo === p.chave ? ' ✓' : ''}
                </Chip>
              ))}
              <label
                className="cursor-pointer whitespace-nowrap rounded-full border border-dashed px-[10px] py-[3px] text-[11px] font-bold"
                style={{ borderColor: CC.linhaForte, color: periodo === 'DATAS' ? CC.acao : CC.tinta3 }}
              >
                📅 datas
                <input
                  type="date"
                  className="sr-only"
                  onChange={(e) => {
                    const d = e.target.value
                    if (!d) return
                    const ate = livre?.ate && livre.ate >= d ? livre.ate : d
                    setLivre({ de: d, ate })
                    setPeriodo('DATAS')
                  }}
                />
              </label>
              {periodo === 'DATAS' && livre && (
                <input
                  type="date"
                  value={livre.ate}
                  aria-label="até"
                  onChange={(e) => setLivre({ de: livre.de, ate: e.target.value })}
                  className="rounded-full border px-3 py-[4px] text-[11px]"
                  style={{ borderColor: CC.linhaForte, background: CC.mod, color: CC.tinta }}
                />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-[7px] px-4 pb-3">
              {lista.length === 0 && (
                <span className="text-[12.5px]" style={{ color: CC.tinta3 }}>
                  esta lista nasce vazia — use o <b>+ adicionar</b> pra escolher o que você acompanha.
                </span>
              )}
              {lista.map((l) => (
                <Chip key={l.itemId} on={item?.itemId === l.itemId} onClick={() => setItemId(l.itemId)}>
                  {l.nome}
                </Chip>
              ))}
              {podeConfigurar && (
                <Chip add onClick={() => setAdicionando((v) => !v)}>
                  {adicionando ? 'fechar' : <><Plus className="mr-0.5 inline h-3 w-3" />adicionar</>}
                </Chip>
              )}
            </div>
            {adicionando && (
              <div className="border-t px-4 py-3" style={{ borderColor: CC.linha }}>
                {/* ⭐ o seletor ÚNICO da casa, no universo de cada lista (nenhuma busca nova) */}
                <BuscaItem
                  companyId={empresaId}
                  universo={aba === 'CAROS' ? 'COMPRAVEL' : 'PRATELEIRA'}
                  jaAdicionados={lista.map((l) => l.itemId)}
                  placeholder={aba === 'CAROS' ? 'buscar matéria-prima…' : 'buscar porção…'}
                  onEscolher={(i) => void mexerNaLista(i.id)}
                />
              </div>
            )}
          </Mod>

          {/* ═════════ 3 · C3 · O ITEM, FUNDO ═════════ */}
          {item && (
            <Mod titulo="O ITEM" dica="o número é o herói — o total consumido no período">
              <div className="flex flex-wrap items-start gap-5 px-4 pb-2.5 pt-1.5">
                <div className="min-w-[250px] flex-1">
                  <Link
                    href={`/empresas/${empresaId}/estoque/itens/${item.itemId}`}
                    className="text-[16px] font-extrabold tracking-[-.01em] hover:underline"
                    style={{ color: CC.tinta }}
                  >
                    {item.nome}
                  </Link>
                  <div className="text-[11.5px] font-bold" style={{ color: CC.tinta3 }}>
                    {item.config.fornecedor
                      ? `fornecedor: ${item.config.fornecedor} · prazo do pedido: ${item.config.antecedenciaDias} dia${item.config.antecedenciaDias > 1 ? 's' : ''}`
                      : item.lista === 'PORCOES'
                        ? 'produzido na casa'
                        : 'fornecedor não declarado'}
                  </div>
                  <div
                    className="mt-1.5 font-extrabold leading-[1.05] tracking-[-.03em] tabular-nums"
                    style={{ fontSize: MED.giga, color: CC.tinta }}
                  >
                    {fmt1(item.consumoDoPeriodo)}{' '}
                    <small className="font-bold" style={{ fontSize: MED.gigaUn, color: CC.tinta2 }}>
                      {item.unidade} no período
                    </small>
                  </div>
                  {/* ⛔ sem base pra comparar, o Δ% NÃO é zero — é "a apurar" (lei C2) */}
                  <div
                    className="mt-0.5 text-[13px] font-extrabold tabular-nums"
                    style={{ color: item.deltaPct == null ? CC.tinta3 : item.deltaPct >= 0 ? CC.coral : CC.verde }}
                  >
                    {item.deltaPct == null
                      ? 'sem período anterior pra comparar — a apurar'
                      : `${item.deltaPct >= 0 ? '▲ +' : '▼ '}${fmt1(item.deltaPct)}% vs o período anterior`}
                  </div>
                  {/**
                   * ⭐⭐ **UM selo, e só com pendência DE VERDADE** (anti-spam, ordem do dono):
                   * o Δ% compara dois períodos pelo MESMO critério, e o selo avisa quando um
                   * dos lados tem dia que **ainda vai mudar**. ⛔ Sem pendência, **sem selo** —
                   * alarme que pisca em todo item é alarme que o dono aprende a ignorar.
                   * ⚠️ Quem decide é o SERVIDOR (`temDiaAApurar`): se a tela varresse as barras,
                   * ela só veria o período atual e calaria sobre o lado anterior da comparação.
                   */}
                  {item.temDiaAApurar && (
                    <div
                      className="mt-1 inline-block rounded-[7px] px-2 py-[3px] text-[11px] font-extrabold"
                      style={{ background: CC.ambarFundo, color: CC.ambar }}
                      title="a venda de algum dia do período ainda não foi baixada do estoque — o número vai mudar"
                    >
                      ⚠ tem dia a apurar
                    </div>
                  )}
                  <Spark8 valores={item.spark} />
                </div>

                {/* ⭐ C5 · OS DIAS DE CHEGADA — o toque GRAVA na config do item */}
                {item.lista === 'CAROS' && (
                  <div className="min-w-[250px] max-w-[420px] flex-1">
                    <div className="mb-1.5 text-[11px] font-bold" style={{ color: CC.tinta3 }}>
                      DIAS DE CHEGADA{' '}
                      {podeConfigurar
                        ? '(toque liga/desliga — grava na config do item)'
                        : '(só quem gerencia o estoque pode mudar)'}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {DIAS.map((d, i) => (
                        <Chip
                          key={d}
                          mini
                          diaOn={item.config.diasChegada.includes(i)}
                          disabled={!podeConfigurar || salvando}
                          onClick={() => void mexerNoDia(i)}
                        >
                          {d}
                        </Chip>
                      ))}
                    </div>
                    <div className="mt-2 text-[11px] font-bold" style={{ color: CC.tinta3 }}>
                      {item.pedido?.ok
                        ? `próxima chegada: ${DIAS[item.pedido.chegaDia]} (em ${item.pedido.chegaEm} dia${item.pedido.chegaEm > 1 ? 's' : ''}) · pedir ${item.pedido.pedirEm <= 0 ? 'HOJE' : DIAS[(dados.hojeSegPrimeiro + item.pedido.pedirEm) % 7]}`
                        : 'liga pelo menos um dia de chegada'}
                    </div>

                    {/**
                      * ⭐⭐⭐ A CONFIG INTEIRA NA TELA (lei C5 v3.2) — *"ao lado dos chips de
                      * chegada: fornecedor · antecedência · folga"*.
                      *
                      * ⛔⛔ É ISTO QUE MATA O *"sem fornecedor"* nos cards e no texto do
                      * WhatsApp: a mesa agrupa por `(fornecedor, chegaDia)` e o texto abre com
                      * o nome dele — sem um lugar pra declarar, o pedido chegava no fornecedor
                      * com o cabeçalho em branco e a mesa juntava fornecedores diferentes no
                      * mesmo card.
                      *
                      * ⛔ A ANTECEDÊNCIA é o prazo DELE, não um palpite nosso: ela é o que
                      * decide o slot da esteira (`pedirEm = chegaEm − antecedência`). Cravar um
                      * default pra todo fornecedor faria a esteira avisar tarde pra quem entrega
                      * em 3 dias — o defeito que a lei C7 v3.2 existe pra matar.
                      */}
                    <div className="mt-3 flex flex-wrap items-end gap-2.5">
                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] font-extrabold tracking-[.06em]" style={{ color: CC.tinta3 }}>
                          FORNECEDOR
                        </span>
                        <input
                          type="text"
                          value={rascunho[item.itemId]?.fornecedor ?? item.config.fornecedor ?? ''}
                          disabled={!podeConfigurar || salvando}
                          placeholder="quem entrega"
                          onChange={(e) =>
                            setRascunho((m) => ({ ...m, [item.itemId]: { ...m[item.itemId], fornecedor: e.target.value } }))
                          }
                          onBlur={() => void gravarFornecedor()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.currentTarget.blur()
                          }}
                          className="w-[170px] rounded-[9px] border px-2.5 py-[6px] text-[12.5px] font-bold outline-none disabled:opacity-50"
                          style={{ borderColor: CC.linhaForte, background: CC.mod, color: CC.tinta }}
                        />
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] font-extrabold tracking-[.06em]" style={{ color: CC.tinta3 }}>
                          ANTECEDÊNCIA (dias)
                        </span>
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={rascunho[item.itemId]?.antecedencia ?? String(item.config.antecedenciaDias)}
                          disabled={!podeConfigurar || salvando}
                          onChange={(e) =>
                            setRascunho((m) => ({ ...m, [item.itemId]: { ...m[item.itemId], antecedencia: e.target.value } }))
                          }
                          onBlur={() => void gravarNumero('antecedencia')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.currentTarget.blur()
                          }}
                          className="w-[86px] rounded-[9px] border px-2.5 py-[6px] text-[12.5px] font-bold tabular-nums outline-none disabled:opacity-50"
                          style={{ borderColor: CC.linhaForte, background: CC.mod, color: CC.tinta }}
                        />
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] font-extrabold tracking-[.06em]" style={{ color: CC.tinta3 }}>
                          FOLGA (%)
                        </span>
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={rascunho[item.itemId]?.folga ?? String(item.config.folgaPct)}
                          disabled={!podeConfigurar || salvando}
                          onChange={(e) =>
                            setRascunho((m) => ({ ...m, [item.itemId]: { ...m[item.itemId], folga: e.target.value } }))
                          }
                          onBlur={() => void gravarNumero('folga')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.currentTarget.blur()
                          }}
                          className="w-[80px] rounded-[9px] border px-2.5 py-[6px] text-[12.5px] font-bold tabular-nums outline-none disabled:opacity-50"
                          style={{ borderColor: CC.linhaForte, background: CC.mod, color: CC.tinta }}
                        />
                      </label>
                    </div>
                    {!podeConfigurar && (
                      <p className="mt-1.5 text-[11px] font-bold" style={{ color: CC.tinta3 }}>
                        só quem gerencia o estoque pode mudar a config
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* ⭐ os stats — e cada "a apurar" é estado PRÓPRIO, nunca zero */}
              <div
                className="grid gap-[9px] px-4 pb-3 tabular-nums"
                style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))' }}
              >
                <div className="rounded-[10px] px-3 py-2.5" style={{ background: CC.mod2 }}>
                  <div className="text-[10px] font-extrabold tracking-[.05em]" style={{ color: CC.tinta3 }}>
                    NO ESTOQUE AGORA
                  </div>
                  <div className="mt-0.5 font-extrabold tracking-[-.02em]" style={{ fontSize: MED.statN }}>
                    {fmt1(item.estoque)} {item.unidade}
                  </div>
                  <div className="mt-px text-[10.5px] font-semibold" style={{ color: CC.tinta3 }}>
                    pela posição
                  </div>
                </div>

                <div className="rounded-[10px] px-3 py-2.5" style={{ background: farol.fundo }}>
                  <div className="text-[10px] font-extrabold tracking-[.05em]" style={{ color: CC.tinta3 }}>
                    COBERTURA
                  </div>
                  <div
                    className="mt-0.5 font-extrabold tracking-[-.02em]"
                    style={{ fontSize: MED.statN, color: farol.cor }}
                  >
                    {item.coberturaDias == null ? 'a apurar' : `${fmt1(item.coberturaDias)} dias`}
                  </div>
                  {/**
                   * ⭐⭐ **MORRE A CONTRADIÇÃO DE 17/10** — a tela dizia *"7,6 dias"* com
                   * *"sem média medida ainda"* embaixo. Eram DUAS perguntas colapsadas numa: a
                   * cobertura existe (precisa de média) e o farol existe (precisa dos dias de
                   * CHEGADA). ⛔ A legenda vem do SERVIDOR (`legendaDaCobertura`) — montá-la
                   * aqui seria a 2ª régua do mesmo rótulo, e era a tela que estava mentindo.
                   */}
                  <div className="mt-px text-[10.5px] font-semibold" style={{ color: CC.tinta3 }}>
                    {item.coberturaLegenda}
                  </div>
                </div>

                {item.lista === 'CAROS' ? (
                  <>
                    <div className="rounded-[10px] px-3 py-2.5" style={{ background: CC.mod2 }}>
                      <div className="text-[10px] font-extrabold tracking-[.05em]" style={{ color: CC.tinta3 }}>
                        CUSTO DO PERÍODO
                      </div>
                      <div className="mt-0.5 font-extrabold tracking-[-.02em]" style={{ fontSize: MED.statN }}>
                        {item.custoDoPeriodo == null ? 'a apurar' : brl(item.custoDoPeriodo)}
                      </div>
                      <div className="mt-px text-[10.5px] font-semibold" style={{ color: CC.tinta3 }}>
                        pelo custo vigente
                      </div>
                    </div>

                    <div className="rounded-[10px] px-3 py-2.5" style={{ background: CC.mod2 }}>
                      <div className="text-[10px] font-extrabold tracking-[.05em]" style={{ color: CC.tinta3 }}>
                        PREÇO PAGO
                      </div>
                      <div className="mt-0.5 font-extrabold tracking-[-.02em]" style={{ fontSize: MED.statN }}>
                        {item.precoPago.ultimo == null ? 'a apurar' : brl2(item.precoPago.ultimo)}
                      </div>
                      <div className="mt-px text-[10.5px] font-semibold" style={{ color: CC.tinta3 }}>
                        {item.precoPago.tendencia == null
                          ? 'sem compra suficiente pra comparar'
                          : `${item.precoPago.tendencia === 'SUBIU' ? '▲ subiu' : item.precoPago.tendencia === 'CAIU' ? '▼ caiu' : '━ estável'} vs a média das ${item.precoPago.baseDaTendencia} anteriores`}
                      </div>
                    </div>

                    <div
                      className="rounded-[10px] px-3 py-2.5"
                      style={{ background: item.perda.faltou == null ? CC.mod2 : CC.mod2 }}
                    >
                      <div className="text-[10px] font-extrabold tracking-[.05em]" style={{ color: CC.tinta3 }}>
                        PERDA (REAL × TEÓRICO)
                      </div>
                      <div
                        className="mt-0.5 font-extrabold tracking-[-.02em]"
                        style={{
                          fontSize: MED.statN,
                          color: item.perda.faltou == null ? CC.tinta3 : item.perda.faltou < 0 ? CC.coral : CC.verde,
                        }}
                      >
                        {item.perda.faltou == null
                          ? 'a apurar'
                          : `${fmt1(Math.abs(item.perda.faltou))} ${item.unidade}`}
                      </div>
                      <div className="mt-px text-[10.5px] font-semibold" style={{ color: CC.tinta3 }}>
                        {item.perda.porque ?? 'portas do Real vs Teórico'}
                      </div>
                    </div>
                  </>
                ) : (
                  item.plano?.ok && (
                    <>
                      <div className="rounded-[10px] px-3 py-2.5" style={{ background: CC.mod2 }}>
                        <div className="text-[10px] font-extrabold tracking-[.05em]" style={{ color: CC.tinta3 }}>
                          ESTOQUE MÍNIMO
                        </div>
                        <div className="mt-0.5 font-extrabold tracking-[-.02em]" style={{ fontSize: MED.statN }}>
                          {fmt1(item.plano.minimo)} {item.unidade}
                        </div>
                        <div className="mt-px text-[10.5px] font-semibold" style={{ color: CC.tinta3 }}>
                          3 dias × média
                        </div>
                      </div>
                      <div className="rounded-[10px] px-3 py-2.5" style={{ background: CC.mod2 }}>
                        <div className="text-[10px] font-extrabold tracking-[.05em]" style={{ color: CC.tinta3 }}>
                          SAI HOJE ({DIAS[dados.hojeSegPrimeiro]})
                        </div>
                        <div className="mt-0.5 font-extrabold tracking-[-.02em]" style={{ fontSize: MED.statN }}>
                          ~{fmt1(item.plano.saiHoje)} {item.unidade}
                        </div>
                        <div className="mt-px text-[10.5px] font-semibold" style={{ color: CC.tinta3 }}>
                          média das {DIAS[dados.hojeSegPrimeiro]?.toLowerCase()}
                        </div>
                      </div>
                      <div className="rounded-[10px] px-3 py-2.5" style={{ background: CC.mod2 }}>
                        <div className="text-[10px] font-extrabold tracking-[.05em]" style={{ color: CC.tinta3 }}>
                          PRODUZIR
                        </div>
                        <div
                          className="mt-0.5 font-extrabold tracking-[-.02em]"
                          style={{ fontSize: MED.statN, color: item.plano.produzir > 0 ? CC.coral : CC.verde }}
                        >
                          {item.plano.produzir > 0 ? `~${fmt1(item.plano.produzir)} ${item.unidade}` : '✓ ok'}
                        </div>
                        <div className="mt-px text-[10.5px] font-semibold" style={{ color: CC.tinta3 }}>
                          mínimo + hoje − tem
                        </div>
                      </div>
                    </>
                  )
                )}
              </div>

              <BarrasDaSemana barras={item.barras} unidade={item.unidade} />

              {/* ═══ C10 · PARA ONDE FOI ═══ */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 pb-2 pt-0.5">
                <h2 className="m-0 text-[11px] font-extrabold tracking-[.09em]" style={{ color: CC.tinta3 }}>
                  PARA ONDE FOI
                </h2>
                <span className="text-[11px] font-bold" style={{ color: CC.tinta3 }}>
                  pelo que o livro prova · toque abre a receita
                </span>
              </div>
              <div className="px-4 pb-3 tabular-nums">
                {item.destinos.length === 0 && (
                  <p className="text-[12.5px]" style={{ color: CC.tinta3 }}>
                    o livro não atribuiu destino neste período — a apurar
                  </p>
                )}
                {item.destinos.map((d) => {
                  const maior = Math.max(1, ...item.destinos.map((x) => x.quantidade))
                  const corpo = (
                    <>
                      <span
                        className="w-[210px] min-w-[130px] overflow-hidden text-ellipsis whitespace-nowrap"
                        style={{ color: CC.tinta }}
                      >
                        {d.nome}
                      </span>
                      <span
                        className="h-[9px] flex-1 overflow-hidden rounded-full"
                        style={{ background: CC.mod2 }}
                      >
                        <span
                          className="block h-full rounded-full"
                          style={{ width: `${Math.round((d.quantidade / maior) * 100)}%`, background: CC.acao }}
                        />
                      </span>
                      <span className="w-[120px] text-right font-extrabold" style={{ color: CC.tinta }}>
                        {fmt1(d.quantidade)} {item.unidade}{' '}
                        <small className="font-semibold" style={{ color: CC.tinta3 }}>
                          · {Math.round(d.pct)}%
                        </small>
                      </span>
                    </>
                  )
                  return d.fichaId ? (
                    <Link
                      key={d.nome}
                      href={`/empresas/${empresaId}/estoque/fichas/${d.fichaId}`}
                      className="flex items-center gap-2.5 py-[5px] text-[12.5px] font-bold hover:underline"
                    >
                      {corpo}
                    </Link>
                  ) : (
                    <div key={d.nome} className="flex items-center gap-2.5 py-[5px] text-[12.5px] font-bold">
                      {corpo}
                    </div>
                  )
                })}
                {item.naoAtribuido > 0 && (
                  <p className="mt-1.5 text-[11px]" style={{ color: CC.tinta3 }}>
                    {fmt1(item.naoAtribuido)} {item.unidade} saíram por venda — o livro guarda a baixa,
                    não a receita que a explodiu, então não é rateado por palpite.
                  </p>
                )}
              </div>
            </Mod>
          )}

          {/* ═════════ 4/5 · C8 · A MESA  /  C9 · O PLANO ═════════ */}
          {aba === 'CAROS' ? (
            <Mod
              titulo="A MESA DE PEDIDO — TODAS AS COMPRAS PENDENTES · UM PEDIDO POR FORNECEDOR"
              dica="o card do item aberto fica aberto e marcado · toque num card recolhido pra abrir · PEDIR já vem com a folga · 📋 copia pro WhatsApp"
            >
              {/**
                * ⭐⭐⭐ O EMPTY-STATE HONESTO (lei C8 v3.2) — TRÊS estados, e a mensagem nunca mente.
                *
                * ⛔⛔ O CASO REAL QUE PARIU A LEI (18/10): queijo em peça CONFIGURADO, com 591 KG
                * em estoque (PEDIR 0) — e a mesa dizia *"nenhum item com dias de chegada
                * configurados"*, mandando o dono CONFIGURAR o que já estava configurado. É a
                * família do *"mensagem que acusa o campo errado faz o dono caçar um erro que não
                * existe"*: ele abriria a config do queijo, veria tudo certo, e não saberia o que
                * fazer. **Zero a pedir e zero configurado são dois estados, e a tela diz qual.**
                *
                * ⛔ Quem decide é o SERVIDOR (`dados.estadoMesa`), nunca `mesa.length === 0`: a
                * pergunta *"tem item configurado?"* não dá pra responder olhando a lista de cards.
                */}
              {dados.estadoMesa === 'SEM_CONFIG' ? (
                <p className="px-4 pb-4 text-[13px]" style={{ color: CC.tinta3 }}>
                  nenhum item com dias de chegada configurados — configura no item acima e o pedido
                  nasce aqui.
                </p>
              ) : dados.estadoMesa === 'NADA_A_PEDIR' ? (
                <p className="px-4 pb-4 text-[13px]" style={{ color: CC.tinta3 }}>
                  <b style={{ color: CC.verde }}>tudo abastecido — nada a pedir</b>
                  {dados.proximoPedido
                    ? ` · o próximo dia de pedido é ${
                        dados.proximoPedido.emDias === 0
                          ? 'HOJE'
                          : `${DIAS[dados.proximoPedido.diaDaSemana]} (em ${dados.proximoPedido.emDias} dia${dados.proximoPedido.emDias > 1 ? 's' : ''})`
                      }`
                    : ''}
                </p>
              ) : (
                dados.mesa.map((c) => {
                  const chave = `${c.fornecedor ?? 'sem'}|${c.chegaDia}`
                  // ⭐ o card que contém o item ABERTO na tela nasce ABERTO e marcado
                  const temSel = c.linhas.some((l) => l.itemId === itemId)
                  return (
                    <MesaDePedido
                      key={chave}
                      card={c}
                      ajustes={ajustes}
                      empresa={dados.empresa}
                      hoje={dados.hojeSegPrimeiro}
                      aoAjustar={ajustar}
                      aoAbrirItem={abrirItem}
                      temSel={temSel}
                      // ⛔ o toque do dono GANHA do default; sem toque, quem manda é o item aberto
                      aberto={cardsAbertos[chave] ?? temSel}
                      aoAlternar={() =>
                        setCardsAbertos((m) => ({ ...m, [chave]: !(m[chave] ?? temSel) }))
                      }
                    />
                  )
                })
              )}
            </Mod>
          ) : (
            <Mod
              titulo="O PLANO DE PRODUÇÃO — O QUE PRODUZIR"
              dica="mínimo = 3 dias × média · produzir = mínimo + saída de hoje − tem agora · toque abre o item"
            >
              <div
                className="hidden grid-cols-[minmax(140px,1.5fr)_.8fr_1fr_1fr_1.1fr_1fr] gap-2 border-b px-4 py-2 text-[9.5px] font-extrabold tracking-[.06em] min-[900px]:grid"
                style={{ borderColor: CC.linha, color: CC.tinta3 }}
              >
                <span>PORÇÃO</span>
                <span>TEM AGORA</span>
                <span>MÍNIMO</span>
                <span>SAI HOJE</span>
                <span>PRODUZIR</span>
                <span />
              </div>
              {dados.plano.length === 0 && (
                <p className="px-4 pb-4 pt-2 text-[13px]" style={{ color: CC.tinta3 }}>
                  nenhuma porção na lista ainda — use o <b>+ adicionar</b> na aba 🍟 AS PORÇÕES.
                </p>
              )}
              {dados.plano.map((p) => (
                <div
                  key={p.itemId}
                  className="grid grid-cols-1 gap-2 border-b px-4 py-2 text-[13px] font-bold min-[900px]:grid-cols-[minmax(140px,1.5fr)_.8fr_1fr_1fr_1.1fr_1fr] min-[900px]:items-center"
                  style={{ borderColor: CC.linha }}
                >
                  <button type="button" onClick={() => abrirItem(p.itemId)} className="text-left">
                    <span className="font-extrabold" style={{ color: CC.tinta }}>
                      {p.nome}
                    </span>
                    <span className="block text-[10px] font-bold" style={{ color: CC.tinta3 }}>
                      ver o item
                    </span>
                  </button>
                  <span className="tabular-nums" style={{ color: CC.tinta }}>
                    {fmt1(p.temAgora)} {p.unidade}
                    <span className="block text-[10px] font-bold" style={{ color: CC.tinta3 }}>
                      TEM AGORA
                    </span>
                  </span>
                  <span className="tabular-nums" style={{ color: CC.tinta }}>
                    {fmt1(p.minimo)} {p.unidade}
                    <span className="block text-[10px] font-bold" style={{ color: CC.tinta3 }}>
                      MÍNIMO (3 DIAS)
                    </span>
                  </span>
                  <span className="tabular-nums" style={{ color: CC.tinta }}>
                    ~{fmt1(p.saiHoje)} {p.unidade}
                    <span className="block text-[10px] font-bold" style={{ color: CC.tinta3 }}>
                      SAI HOJE ({DIAS[dados.hojeSegPrimeiro]?.toLowerCase()})
                    </span>
                  </span>
                  <span
                    className="text-[15px] font-extrabold tabular-nums"
                    style={{ color: p.produzir > 0 ? CC.coral : CC.verde }}
                  >
                    {p.produzir > 0 ? `produzir ~${fmt1(p.produzir)}` : '✓ no mínimo'}
                  </span>
                  {/* ⛔⛔ LEI C9: SÓ APONTA, NUNCA CRIA. A ordem nasce na receita, com o
                      preview do que vai sair da câmara — criar daqui seria uma 2ª porta de
                      escrita de produção, e ela divergiria da pergunta do pedido (11/10). */}
                  <span>
                    {p.produzir > 0 ? (
                      p.fichaId ? (
                        <Link
                          href={`/empresas/${empresaId}/estoque/producao?ficha=${p.fichaId}`}
                          className="text-[11.5px] font-extrabold underline"
                          style={{ color: CC.acao }}
                        >
                          criar ordem <ChevronRight className="inline h-3 w-3" />
                        </Link>
                      ) : (
                        <span className="text-[11px] font-bold" style={{ color: CC.tinta3 }}>
                          sem receita ativa — crie a ficha primeiro
                        </span>
                      )
                    ) : (
                      <span
                        className="rounded-full px-[9px] py-[2px] text-[10px] font-extrabold"
                        style={{ background: CC.verdeFundo, color: CC.verde }}
                      >
                        tranquilo
                      </span>
                    )}
                  </span>
                </div>
              ))}
              {dados.plano.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 px-4 py-[11px] text-[13px] font-extrabold">
                  <span style={{ color: CC.tinta }}>
                    o dia pede ~{fmt1(dados.plano.reduce((s, p) => s + p.produzir, 0))} de produção
                  </span>
                  <span className="ml-auto text-[11px] font-bold" style={{ color: CC.tinta3 }}>
                    a ordem nasce na receita — aqui só aponta
                  </span>
                </div>
              )}
            </Mod>
          )}

          {/* ⭐⭐ A HONESTIDADE NO RODAPÉ (a mesma linha da referência) */}
          <p className="px-1 pb-6 text-[11px] leading-relaxed" style={{ color: CC.tinta3 }}>
            consumo = o livro (baixas + separações) · teórico = fichas × produção (portas do Real vs
            Teórico) · preço pago = entradas do livro · estoque = posição · custo = vigente ·{' '}
            <b style={{ color: CC.tinta }}>dia sem dado = “a apurar”</b> · folga por item · mínimo das
            porções = 3 dias × média · prazo por fornecedor na config
          </p>
        </>
      )}
    </div>
  )
}
