'use client'

// ⭐⭐⭐ AS DUAS LISTAS DO PAINEL DE PRODUÇÃO (lei v9 M7, docs/producao-referencia.html).
// Moram aqui (e não no page.tsx) pra serem RENDERIZADAS num teste de verdade (REGRA 3) — o
// Next não aceita export nomeado em page. ⚠️ As classes `pp-*` vêm do CSS da página do painel.

import { useState } from 'react'
import { formatBRL } from '@/lib/format/money'
import { formatarDuracao } from '@/lib/format/duracao'
import { SeloDaConferencia } from '@/components/estoque/selo-da-conferencia'
import type { LinhaDaTarefa } from '@/lib/stock/producao/linha-da-tarefa'
/** ⭐⭐ O PEDIDO NA TELA e a pílula "% do pedido" têm DONO ÚNICO (05/10) — a tela não arredonda nem divide. */
import { fmtPedido, pilulaDoPedido } from '@/lib/stock/producao/pedido-na-tela'
import type { OrigemDoPedido } from '@/lib/stock/producao/pedido-da-ordem'

export interface OrdemDaLista { id: string; nomeProduzido: string; unidadeProduzido: string; estado: string; dataProducao: string }

export type Aberta = OrdemDaLista & { deOntem?: boolean }
/**
 * ⚠️⚠️ A ORIGEM **DERIVA DO TIPO DA LIB** (`OrigemDoPedido`), não de uma união escrita à mão:
 * ao nascer o `AGUARDANDO` (11/10) a união digitada não conseguia nem mencionar o estado novo.
 */
export interface Contexto { pedido: number | null; pedidoOrigem: OrigemDoPedido | null; quem: string[]; comecouEm: string | null }
export interface PedidoFeito { pedido: number | null; origem: 'DECLARADO' | 'DERIVADO' | null }
export interface Conclusao { id: string; ordemId: string; qtdGerada: number; custoUnitarioReal: number | null; custoLoteReal: number; colaboradorNome: string | null; rendimento: number; criadoEm: string; pct: number | null; faixa: string; motivo: string | null; selo: 'FICHA' | 'SEM_DADO'
  /** ⭐⭐ O FISCAL: `true` quando o declarado NÃO cabe no material separado — vem do SERVIDOR */
  fiscalImpossivel: boolean
  /** ⭐ O SELO DA CONFERÊNCIA — vem do SERVIDOR, derivado da tabela de carimbo */
  conferencia: { estado: 'AGUARDANDO_CONFERENCIA' | 'CONFERIDA' | 'CORRIGIDA_E_CONFERIDA'
    conferidoPorNome: string | null; corrigiuDe: number | null; motivoDaCorrecao: string | null } | null }

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const fmtQtd = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 6 })
const fmtDia = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')
/** ⭐ o tom da pílula "% do pedido" → classe da lei. ⛔ A régua que decide o tom mora na lib (`pilulaDoPedido`). */
const TOM_DO_PEDIDO: Record<'verde' | 'ambar' | 'vermelho', string> = { verde: 'verde', ambar: 'ambar', vermelho: 'coral' }

/**
 * ⭐⭐⭐ EM ABERTO (M7.d/e) — filete de estado (índigo = fazendo, coral = desde ontem), nome 700 +
 * apoio (quem · começou · há), o PEDIDO à direita. ⛔ Sem fundo na linha: o fio e o selo bastam.
 * ⭐ TAREFA tem linha própria: selo TAREFA + nome + "para {quem}", a instrução à direita — nunca
 * "UN pedidas" — e o "cancelar" (gesto de sempre) pra quem opera.
 */
export function ListaAbertas({ id, ordens, ctx, deOntem, soDeOntem, onFiltrarOntem, tarefas, podeCancelar, cancelando, onCancelar, erroTarefa }: {
  id: string; ordens: Aberta[]; ctx: Record<string, Contexto>
  deOntem: number; soDeOntem: boolean; onFiltrarOntem: () => void
  tarefas: LinhaDaTarefa[]; podeCancelar: boolean; cancelando: string | null
  onCancelar: (t: LinhaDaTarefa) => void; erroTarefa: string | null
}) {
  if (!ordens.length && !tarefas.length && !soDeOntem) return null
  return (
    <section className="pp-painel" data-testid="em-aberto">
      <h3>
        Em aberto ({ordens.length + tarefas.length})
        {/* ⭐ o alerta de ontem: selo que FILTRA */}
        {deOntem > 0 && <> <button type="button" onClick={onFiltrarOntem} className="pp-pill mut2 pp-btn-selo">{soDeOntem ? 'ver todas' : `${deOntem} desde ontem`}</button></>}
      </h3>
      {erroTarefa && <span className="pp-pill coral pp-msg">{erroTarefa}</span>}
      {ordens.map((o) => {
        const c = ctx[o.id]
        const atrasada = !!o.deOntem
        /** ⚠️ "há X" vem do `formatarDuracao` (o formatador único), nunca de `% 60` à mão */
        const haQuanto = c?.comecouEm ? formatarDuracao((Date.now() - new Date(c.comecouEm).getTime()) / 60000) : null
        const estado = atrasada ? 'at' : o.estado === 'EM_PRODUCAO' || c?.comecouEm ? 'fz' : 'af'
        return (
          <a key={o.id} href={`/empresas/${id}/estoque/producao/${o.id}`} className={`pp-row e3 ${estado}`}>
            <span className="pp-nm">{o.nomeProduzido}
              {atrasada
                ? <span className="pp-sub2 at">desde ontem {fmtDia(o.dataProducao)} — insumo saiu e não virou produto</span>
                : <span className="pp-sub2">{c?.quem.length ? c.quem.join(' e ') : 'ninguém pegou ainda'}{c?.comecouEm && ` · começou ${hhmm(c.comecouEm)}`}{haQuanto && ` · há ${haQuanto}`}</span>}
            </span>
            <span className="pp-num">
              {c?.pedido == null
                /** ⭐ DUAS AUSÊNCIAS, DUAS FRASES: AGUARDANDO convida; "sem pedido" é a ordem velha */
                ? <i>{c?.pedidoOrigem === 'AGUARDANDO' ? 'pedido a definir →' : 'sem pedido'}</i>
                /** ⚠️⚠️ "pedidas" SÓ quando ele PEDIU — o derivado diz "esperadas" */
                : <>{fmtPedido(c.pedido, o.unidadeProduzido)} {o.unidadeProduzido} <i>{c.pedidoOrigem === 'DECLARADO' ? 'pedidas' : 'esperadas'}</i></>}
              {atrasada && <span className="pp-pill coral pp-selo-l">atrasada</span>}
            </span>
          </a>
        )
      })}
      {tarefas.map((t) => (
        <div key={t.tarefaId} className={`pp-row e3 ${t.fazendo ? 'fz' : 'af'}`} data-testid="tarefa-aberta">
          <span className="pp-nm"><span className="selo-t">{t.selo}</span>{t.nome}<span className="pp-sub2">{t.apoio}</span></span>
          <span className="pp-num">
            {t.instrucao ?? ''}
            {podeCancelar && t.podeCancelar && (
              <button type="button" className="pp-cancelar" disabled={cancelando === t.tarefaId} onClick={() => onCancelar(t)}>cancelar</button>
            )}
          </span>
        </div>
      ))}
    </section>
  )
}

/**
 * ⭐⭐⭐ CONCLUÍDAS (M7.a/e) — grade LOTE · CUSTO · FEZ/PED. · CONFERÊNCIA, números tabulares à
 * direita. ⭐ As cabecinhas são a régua: "76 / 80" sob FEZ / PED. não deixa adivinhar qual é qual.
 * ⛔ TAREFA concluída: selo + quem · hora · DURAÇÃO — sem R$/un, sem %, sem conferência (o print
 * do dono pegou "R$ 0,00/un" numa tarefa; a linha dela não tem campo pra isso).
 * ⭐ O sinal do fiscal (declarado que não cabe no material) segue colado no nome do lote.
 */
export function ListaConcluidas({ id, itens, periodo, nomePorOrdem, unidadePorOrdem, pedidoFeito, mostrar, onMais }: {
  id: string; itens: Conclusao[]; periodo: string
  nomePorOrdem: Map<string, string>; unidadePorOrdem: Map<string, string>
  pedidoFeito: Record<string, PedidoFeito>
  mostrar: number; onMais: () => void
}) {
  const rotulo = rotuloDoPeriodo(periodo)
  /**
   * ⭐⭐ EMENDA DO DONO (13/11): "Concluídas" vira DOIS blocos — LOTES aqui (custo, fez/pedido, %,
   * conferência) e TAREFAS no bloco próprio logo abaixo (`ListaTarefasConcluidas`). ⛔ Este bloco
   * não recebe tarefa: o tipo das props não tem onde pôr uma (REGRA 5 — impossível, não lembrado).
   */
  const todas = [...itens].sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : a.criadoEm > b.criadoEm ? -1 : 0))
  // ⚠️ PAGINAÇÃO: o "carregar mais" DIZ quantos faltam
  const visiveis = todas.slice(0, mostrar)
  const faltam = todas.length - visiveis.length
  return (
    <section className="pp-painel" data-testid="concluidas">
      <h3>Lotes concluídos · {rotulo} ({itens.length} lote{itens.length === 1 ? '' : 's'})</h3>
      {todas.length === 0 ? (
        <span className="pp-vazio">Nenhum lote concluído {rotulo}.</span>
      ) : (
        <>
          <div className="pp-head d4"><span>LOTE</span><span className="r">CUSTO</span><span className="r">FEZ / PED.</span><span className="r">CONFERÊNCIA</span></div>
          {visiveis.map((c) => {
            const pf = pedidoFeito[c.ordemId]
            const un = unidadePorOrdem.get(c.ordemId) ?? ''
            const pedidoTxt = fmtPedido(pf?.pedido, un)
            const pil = pilulaDoPedido(c.qtdGerada, pf?.pedido, un)
            return (
              <a key={c.id} href={`/empresas/${id}/estoque/producao/${c.ordemId}`} className="pp-row d4" data-testid="lote-concluido">
                <span className="pp-nm">
                  {c.fiscalImpossivel && <span className="pp-fiscal" role="img" aria-label="o declarado não cabe no material separado — abra a ordem pra ver a conta" title="o declarado não cabe no material separado — abra a ordem pra ver a conta" />}
                  {nomePorOrdem.get(c.ordemId) ?? '—'}
                  {/* ⛔ sem responsável registrado NÃO inventa pessoa */}
                  <span className="pp-sub2">{c.colaboradorNome ?? 'sem responsável'} · {hhmm(c.criadoEm)}{c.motivo && ` · ${c.motivo}`}</span>
                </span>
                {/* ⛔ moeda pelo formatador da casa; ausência não é R$ 0,00 */}
                <span className="pp-num" data-r="custo">{c.custoUnitarioReal != null ? <>{formatBRL(c.custoUnitarioReal)}<i>/un</i></> : '·'}</span>
                {/* ⚠️ ordem antiga sem pedido mostra SÓ o "fez" — inventar pedido seria o "pedido 0" */}
                <span className="pp-num" data-r="fez / ped.">
                  {fmtQtd(c.qtdGerada)}{pedidoTxt && <i> / {pedidoTxt}</i>}
                  {/* ⭐ a pílula "% do pedido" (fez ÷ pedido) — régua e tom da lib; sem pedido, sem pílula */}
                  {pil && (<> <span className={`pp-pill ${TOM_DO_PEDIDO[pil.tom]}`} title={pil.texto} aria-label={pil.texto}>{pil.alarme && '⚠ '}{pil.pct}%</span></>)}
                </span>
                {/** ⛔ o MESMO selo da página da ordem — dois seriam dois estados pro mesmo fato */}
                <span className="pp-conf" data-r="conferência">{c.conferencia && <SeloDaConferencia c={c.conferencia} unidade={un} />}</span>
              </a>
            )
          })}
          {faltam > 0 && (
            <button type="button" onClick={onMais} className="pp-mais">carregar mais ({faltam} restante{faltam > 1 ? 's' : ''})</button>
          )}
        </>
      )}
    </section>
  )
}

const rotuloDoPeriodo = (periodo: string) =>
  periodo === 'hoje' ? 'hoje' : periodo === 'semana' ? 'últimos 7 dias' : periodo === 'mes' ? 'últimos 30 dias' : periodo

/**
 * ⭐⭐ TAREFAS CONCLUÍDAS — o bloco PRÓPRIO (emenda do dono 13/11, lei M7.h): nome · instrução · quem fez ·
 * hora · duração. ⛔ SEM custo, sem fez/pedido, sem %, sem conferência — a `LinhaDaTarefa` não tem esses
 * campos. Só aparece quando há tarefa no período (o pai decide pelo comprimento; aqui `null` também).
 */
export function ListaTarefasConcluidas({ tarefas, periodo }: { tarefas: (LinhaDaTarefa & { em: string })[]; periodo: string }) {
  const [mostrar, setMostrar] = useState(PAGINA_DE_TAREFAS)
  if (tarefas.length === 0) return null
  const todas = [...tarefas].sort((a, b) => (a.em < b.em ? 1 : a.em > b.em ? -1 : 0))
  const visiveis = todas.slice(0, mostrar)
  const faltam = todas.length - visiveis.length
  return (
    <section className="pp-painel" data-testid="tarefas-concluidas">
      <h3>Tarefas concluídas · {rotuloDoPeriodo(periodo)} ({tarefas.length} tarefa{tarefas.length === 1 ? '' : 's'})</h3>
      <div className="pp-head d2"><span>TAREFA</span><span className="r">DURAÇÃO</span></div>
      {visiveis.map((t) => (
        <div key={`t-${t.tarefaId}`} className="pp-row d2 tar" data-testid="tarefa-concluida">
          <span className="pp-nm"><span className="selo-t">{t.selo}</span>{t.nome}{t.instrucao && <span className="pp-inst"> · {t.instrucao}</span>}<span className="pp-sub2">{t.apoio}</span></span>
          <span className="pp-num" data-r="duração">{t.duracao}</span>
        </div>
      ))}
      {faltam > 0 && (
        <button type="button" onClick={() => setMostrar((m) => m + PAGINA_DE_TAREFAS)} className="pp-mais">carregar mais ({faltam} restante{faltam > 1 ? 's' : ''})</button>
      )}
    </section>
  )
}
const PAGINA_DE_TAREFAS = 20
