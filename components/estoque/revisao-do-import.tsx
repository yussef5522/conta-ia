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

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Check, AlertTriangle, Search, EyeOff, Undo2 } from 'lucide-react'
import { SeletorDeDestino, type EscolhaDeDestino } from './seletor-de-destino'
import { ancoraDaLinha, hrefDoEditor } from '@/lib/stock/vendas/volta-da-revisao'
import { fetchComTimeout } from '@/lib/http/fetch-com-timeout'
import { PlanoVendaModal, type PlanoVM } from './plano-venda-modal'

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

/**
 * ⭐⭐ O CONFIRMAR DELEGADO — o que permite UM botão por página (14/09).
 *
 * ⛔ Antes do import, quem grava é a tela (import + baixa num gesto só, a régua de 07/09);
 * depois, quem grava é a própria revisão (reprocessar o dia). **São dois donos pro mesmo
 * botão**, e por isso ele é parâmetro: dois botões na página seriam dois confirmares pro
 * mesmo dado — foi exatamente o que o dono achou empilhado na tela.
 */
export interface ConfirmarDelegado {
  rotulo: string
  acao: () => void
  habilitado: boolean
  /** a frase do rodapé — o que vai acontecer, ou por que ainda não dá */
  resumo: string
}

export function RevisaoDoImport({
  empresaId, data, relatorio, onMudou, revisaoExterna, recarregarExterna, confirmar,
}: {
  empresaId: string
  data: string
  relatorio: 'PRODUTOS' | 'COMPLEMENTOS'
  /** chamado depois de qualquer ajuste — a tela de trás recarrega */
  onMudou?: () => void
  /**
   * ⭐⭐ A MESMA LISTA, ANTES DO IMPORT. Quando vem preenchida, a revisão desenha ESTE DTO
   * em vez de ler o dia no banco — porque antes de confirmar o dia **não está no banco**.
   * Era essa a única razão de a tabela velha existir.
   */
  revisaoExterna?: RevisaoDTO | null
  /** como recarregar a lista externa depois de um ajuste (re-lê o arquivo, não o banco) */
  recarregarExterna?: () => Promise<RevisaoDTO | null>
  confirmar?: ConfirmarDelegado
}) {
  const [rev, setRev] = useState<RevisaoDTO | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('TODOS')
  const [busca, setBusca] = useState('')
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ mudam: { nome: string; frase: string }[]; inalterados: number } | null>(null)
  const [gravando, setGravando] = useState(false)
  /** ⭐ o plano na forma do modal ÚNICO — o mesmo da tela de produtos (14/09) */
  const [plano, setPlano] = useState<PlanoVM | null>(null)
  const [modal, setModal] = useState(false)
  /** ⭐ a tela RESPONDE depois de gravar — era o "clique mudo" do dono */
  const [recibo, setRecibo] = useState<{ baixados: number; itens: number; valor: number } | null>(null)

  const externo = revisaoExterna !== undefined

  /**
   * ⛔⛔⛔ AQUI NASCEU O LOOP DE 20 REQUISIÇÕES POR SEGUNDO (14/09/2026) — defeito MEU.
   *
   * **O dono:** *"três fetches não resolvem — o 'Lendo…', a lista de receitas do seletor e
   * o processar, todos presos."* **Medido no nginx: 489 de 500 requisições eram o MESMO
   * `POST /vendas/preview`, ~20/s, cada uma re-enviando o arquivo inteiro.**
   *
   * **A CAUSA:** o `carregar` tinha `recarregarExterna` nas dependências, e a tela pai
   * monta essa função **nova a cada render**. Efeito → fetch → `setState` no pai → render →
   * identidade nova → efeito de novo. ⚠️ **E o servidor estava SADIO o tempo todo** (54 MB,
   * 0,1% de CPU, cada rota em 72–302 ms): quem entupia era o limite de ~6 conexões do
   * browser, e as outras duas chamadas ficavam **na fila, pra sempre**.
   *
   * ⭐ **A CURA É ESTRUTURAL, não um `useRef` em cima do laço:** no modo externo a lista
   * **É a prop** — o componente ESPELHA, não busca. Quem busca é o pai, e só quando alguém
   * pede (um ajuste). Sem efeito que busca, não há laço possível.
   *
   * ⚠️ E a lição geral: **`useCallback` com função vinda de prop nas deps é um laço
   * esperando acontecer** — a identidade muda a cada render do pai por construção.
   */
  const carregarDoDia = useCallback(async () => {
    // ⛔ COM TIMEOUT: "abrindo a revisão…" não pode girar pra sempre (14/09)
    const r = await fetchComTimeout<{ revisao: RevisaoDTO }>(`/api/empresas/${empresaId}/estoque/vendas/revisao?data=${data}&relatorio=${relatorio}`)
    // ⛔ ERRO NUNCA VIRA VAZIO: "nenhuma linha" é uma afirmação, e quando a carga falha o
    // sistema NÃO SABE (a lição da tela da equipe, 09/09).
    if (!r.ok || !r.data) { setErro(r.erro ?? 'Não consegui carregar a revisão deste import.'); return }
    setErro(null)
    setRev(r.data.revisao)
  }, [empresaId, data, relatorio])

  // modo DIA: busca no banco, uma vez por (empresa, dia, relatório)
  useEffect(() => { if (!externo) void carregarDoDia() }, [externo, carregarDoDia])

  // ⭐ modo EXTERNO: espelha a prop. `revisaoExterna` só muda quando o PAI grava estado
  // novo — então isto roda uma vez por carga de verdade, nunca por render.
  useEffect(() => { if (externo) { setRev(revisaoExterna ?? null); setErro(null) } }, [externo, revisaoExterna])

  // ⚠️ o recarregar do pai fica num REF: ele é chamado por GESTO (depois de um ajuste),
  // nunca por efeito — e assim a identidade dele não entra em dependência nenhuma.
  const recarregarRef = useRef(recarregarExterna)
  recarregarRef.current = recarregarExterna

  const carregar = useCallback(async () => {
    if (externo) {
      const r = await recarregarRef.current?.()
      if (r) { setRev(r); setErro(null) }
      return
    }
    await carregarDoDia()
  }, [externo, carregarDoDia])

  /**
   * ⭐⭐ O PREVIEW NASCE JUNTO COM A TELA (14/09) — antes ele só existia DEPOIS de um ajuste,
   * então o rodapé de confirmar não existia ao abrir. O dono voltava do editor com a linha
   * vinculada e **não tinha onde aplicar**: o reprocessar morava na lista de dias, fora da
   * tela onde ele trabalhou.
   */
  // ⚠️ só no modo DIA: antes do import não existe dia pra prever reprocesso, e quem manda
  // no rodapé ali é o `confirmar` delegado da tela.
  useEffect(() => { if (!externo) void verPreview() }, [empresaId, data, relatorio, externo]) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * ⭐ A VOLTA DO EDITOR CAI NA LINHA. `?revisar=` reabre o dia (a tela de Vendas lê no 1º
   * render) e o hash traz o olho pro nome que acabou de ser resolvido.
   *
   * ⚠️ Roda depois que as linhas existem — antes disso o elemento não está no DOM, e um
   * scroll pra âncora inexistente é um scroll que não acontece, calado.
   */
  useEffect(() => {
    if (!rev) return
    const alvo = typeof window !== 'undefined' ? window.location.hash.slice(1) : ''
    if (!alvo.startsWith('rev-')) return
    const el = document.getElementById(alvo)
    el?.scrollIntoView({ block: 'center' })
    el?.classList.add('ring-2', 'ring-violet-400')
  }, [rev])

  /**
   * ⭐⭐ GRAVA PELAS ROTAS QUE JÁ EXISTEM — nenhuma porta de escrita nova (REGRA 4).
   *
   * ⚠️ Os dois mapas têm CONTRATOS diferentes de propósito (produtos aceita REVENDA, o de
   * complementos aceita IGNORAR/LIMPAR) — são dois mapas desde 02/09, porque 25 nomes
   * vivem nos dois relatórios e um mapa só faria cada um baixar duas vezes. A tradução
   * mora AQUI, num lugar; uniformizar as rotas quebraria um dos dois guards.
   */
  async function aplicar(nome: string, corpo: { alvoTipo: 'FICHA' | 'IGNORAR' | 'REVENDA' | 'DESMAPEAR'; fichaId?: string; itemId?: string }) {
    setOcupado(nome)
    try {
      const comp = relatorio === 'COMPLEMENTOS'
      const url = comp
        ? `/api/empresas/${empresaId}/estoque/vendas/complementos/mapear`
        : `/api/empresas/${empresaId}/estoque/vendas/mapear`
      /**
       * ⚠️⚠️ "DESFAZER" TEM NOME DIFERENTE NOS DOIS MAPAS — `LIMPAR` no de complementos,
       * `REMOVER` no de produtos. **A tradução mora AQUI, num lugar**: uniformizar as rotas
       * quebraria um dos dois guards (eles são opostos de propósito desde 02/09), e mandar
       * o verbo errado devolveria 400 na cara do dono num botão que existe.
       */
      const verbo = corpo.alvoTipo === 'DESMAPEAR' ? (comp ? 'LIMPAR' : 'REMOVER') : corpo.alvoTipo
      const body = comp
        ? { nomeSuitable: nome, destino: verbo, fichaId: corpo.fichaId, itemId: corpo.itemId }
        : { nomeSuitable: nome, alvoTipo: verbo, fichaId: corpo.fichaId, itemId: corpo.itemId }
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui gravar o destino.'); return }
      await carregar()
      await verPreview()
      onMudou?.()
    } finally { setOcupado(null) }
  }

  async function verPreview() {
    // ⛔ COM TIMEOUT: o rodapé não pode ficar em "conferindo o que mudou…" pra sempre
    const r = await fetchComTimeout<{ preview: typeof preview; plano: PlanoVM | null }>(
      `/api/empresas/${empresaId}/estoque/vendas/revisao`,
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data, relatorio, confirmar: false }) },
    )
    if (!r.ok || !r.data) { setErro(r.erro ?? 'Não consegui conferir o que muda neste dia.'); return }
    setPreview(r.data.preview)
    setPlano(r.data.plano)
  }

  /**
   * ⛔⛔⛔ O CLIQUE MUDO QUE GRAVAVA (14/09) — o pior desfecho possível.
   *
   * **O dono, navegando:** *"clico 'Confirmar e baixar' → NADA acontece."* **E acontecia:**
   * o ledger registrou `BAIXA_VENDA` às 19:33:17 do clique dele. A tela zerava o preview,
   * recarregava a lista (que não mudava, porque os nomes já estavam vinculados) e **jogava
   * o recibo fora**. *Gravar sem dizer é pior que não gravar: o dono clica de novo.*
   *
   * ⭐ Agora o botão **ABRE O MODAL** (o mesmo da tela de produtos) e quem grava é o
   * `gravar()`, que **guarda o recibo e o mostra**.
   */
  function abrirModal() { setErro(null); setModal(true) }

  async function gravar(confirmouSanidade: boolean) {
    setGravando(true)
    try {
      // ⚠️ teto MAIOR porque isto GRAVA: desistir cedo de uma escrita que está acontecendo
      // é pior que esperar — mas termina, com erro visível.
      const r = await fetchComTimeout<{ recibo?: { baixados?: number; itensBaixados?: number; valorBaixado?: number; ocorrencias?: number; itens?: number; valor?: number } }>(
        `/api/empresas/${empresaId}/estoque/vendas/revisao`,
        { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data, relatorio, confirmar: true, confirmouSanidade }), timeoutMs: 60_000 },
      )
      if (!r.ok || !r.data) { setErro(r.erro ?? 'Não consegui reprocessar o dia.'); return }
      setModal(false)
      // ⚠️ os dois relatórios nomeiam o recibo diferente (ocorrências × produtos) — a
      // tradução mora AQUI, num lugar, e o número que vai pra tela é sempre o do servidor.
      const rc = r.data.recibo ?? {}
      setRecibo({
        baixados: rc.ocorrencias ?? rc.baixados ?? 0,
        itens: rc.itens ?? rc.itensBaixados ?? 0,
        valor: rc.valor ?? rc.valorBaixado ?? 0,
      })
      setPreview(null)
      await carregar()
      await verPreview()
      onMudou?.()
    } finally { setGravando(false) }
  }

  if (erro && !rev) {
    // ⭐ ERRO COM SAÍDA — "tentar de novo" sem recarregar a página inteira
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-900">
        {erro}
        <button type="button" onClick={() => { setErro(null); void carregar() }} className="ml-1.5 font-semibold underline">tentar de novo</button>
      </div>
    )
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

      {/* ⭐ ERRO COM SAÍDA — âmbar, não vermelho de pânico: quase sempre é rede */}
      {erro && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {erro}
          <button type="button" onClick={() => { setErro(null); void verPreview() }} className="ml-1.5 font-semibold underline">tentar de novo</button>
        </div>
      )}

      {/* ⭐⭐⭐ A TELA RESPONDE (14/09) — era exatamente isto que faltava: o dono clicava,
          o ledger gravava e a tela ficava igual. **Gravar sem dizer é pior que não gravar,
          porque ele clica de novo.** */}
      {recibo && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-900">
          <Check className="h-4 w-4 shrink-0" />
          <span>
            <b>baixado: {recibo.baixados.toLocaleString('pt-BR')} {relatorio === 'COMPLEMENTOS' ? 'ocorrências' : 'produtos'}</b>
            {recibo.itens > 0 && <> · {recibo.itens} item(ns) do estoque</>}
            {recibo.valor > 0 && <> · {recibo.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</>}
          </span>
          <button type="button" onClick={() => setRecibo(null)} className="ml-auto text-[11px] underline">ok</button>
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
            <div key={l.nome} id={ancoraDaLinha(l.nome)} className="scroll-mt-24 flex flex-col gap-1.5 border-b border-slate-100 px-3 py-2.5 last:border-0 sm:flex-row sm:items-center sm:gap-3">
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
                {/* ⭐⭐ O SELETOR ABRE AQUI — não navega, não expulsa (14/09). O único
                    caminho que sai da tela é o "é um combo?", e ele volta pro MESMO dia. */}
                <SeletorDeDestino
                  empresaId={empresaId}
                  relatorio={relatorio}
                  nomePdv={l.nome}
                  jaTemDestino={l.estado === 'VINCULADO'}
                  ocupado={ocupado === l.nome}
                  hrefEditor={hrefDoEditor(empresaId, relatorio, data, l.nome)}
                  onEscolher={(e: EscolhaDeDestino) => aplicar(
                    l.nome,
                    e.tipo === 'FICHA'
                      ? { alvoTipo: 'FICHA', fichaId: e.fichaId }
                      : { alvoTipo: 'REVENDA', itemId: e.itemId },
                  )}
                />
                {/* ⭐⭐ IGNORAR NOS DOIS RELATÓRIOS (14/09) — era o que faltava no mapa de
                    PRODUTOS, e o dono nomeou o custo: *"os ~30 doces/milkshakes/açaí que por
                    minha decisão não controlam estoque param de engordar o contador de
                    pendentes pra sempre"*. ⛔ **Pendente = "espera decisão", nunca "tudo que
                    não baixa"** — contador que cobra o que já foi resolvido é como o dono
                    aprende a não olhar o contador. */}
                {l.estado !== 'IGNORADO' && (
                  <button
                    type="button" disabled={ocupado === l.nome}
                    onClick={() => aplicar(l.nome, { alvoTipo: 'IGNORAR' })}
                    className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-300 px-2 text-[11px] text-slate-500 hover:bg-slate-50 disabled:opacity-60"
                    title="decisão sua: este nome não controla estoque"
                  >
                    <EyeOff className="h-3 w-3" /> ignorar
                  </button>
                )}
                {/* ⭐ DESMAPEAR migrou da tabela velha ANTES de ela morrer (o guard da
                    mudança de casa): **remoção sem realocação é perda**. ⚠️ E ele é outra
                    coisa que ignorar — devolve o nome PRA FILA, não tira dela. */}
                {l.estado !== 'SEM_VINCULO' && (
                  <button
                    type="button" disabled={ocupado === l.nome}
                    onClick={() => aplicar(l.nome, { alvoTipo: 'DESMAPEAR' })}
                    className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-300 px-2 text-[11px] text-slate-500 hover:bg-slate-50 disabled:opacity-60"
                    title="desfaz a decisão: volta pra fila de pendentes"
                  >
                    <Undo2 className="h-3 w-3" /> desmapear
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

      {/* ⭐⭐⭐ O ARREMATE — CONFIRMAR NO PÉ DA TELA ONDE EU TRABALHEI (14/09).
          **O dono:** *"hoje o reprocessar mora na lista de dias, FORA da tela onde eu
          trabalhei"*. ⛔ Ajustar destino e aplicar eram dois lugares, e o segundo era fácil
          de não achar — a mesma anatomia do "baixar" separado que morreu em 07/09 por ser
          "estado intermediário que só serve pra ser esquecido".
          ⚠️ E o rodapé é PERMANENTE, não condicional ao preview: botão que aparece e some
          conforme o estado é botão que o dono aprende a não procurar. */}
      <div className="sticky bottom-0 -mx-3 flex flex-wrap items-center gap-2 border-t border-slate-200 bg-white/95 px-3 py-2 backdrop-blur">
        <div className="min-w-0 flex-1 text-[12px]">
          {confirmar ? (
            <span className="text-slate-600">{confirmar.resumo}</span>
          ) : preview == null ? (
            <span className="text-slate-400">conferindo o que mudou…</span>
          ) : preview.mudam.length === 0 ? (
            // ⚠️ "nada mudou" é um ESTADO, não um erro: o dia já está aplicado como está.
            <span className="text-slate-500">nada mudou de destino · {preview.inalterados} nome(s) seguem como estavam</span>
          ) : (
            <>
              <span className="font-semibold text-violet-900">
                {preview.mudam.length} {preview.mudam.length === 1 ? 'nome mudou' : 'nomes mudaram'} de destino
              </span>
              <span className="text-violet-700"> · {preview.inalterados} seguem como estavam</span>
              {/* ⛔ NADA BAIXA PRO DESTINO NOVO SEM O DONO VER O QUE MUDA */}
              <ul className="mt-0.5 max-h-20 overflow-auto text-[11px] text-violet-800">
                {preview.mudam.map((m) => <li key={m.nome}>· {m.frase}</li>)}
              </ul>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={confirmar ? confirmar.acao : abrirModal}
          disabled={confirmar ? !confirmar.habilitado : (gravando || !preview || preview.mudam.length === 0)}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 text-[13px] font-semibold text-white hover:bg-violet-700 disabled:opacity-40"
        >
          {gravando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {confirmar ? confirmar.rotulo : `Confirmar e baixar ${data.split('-').reverse().join('/')}`}
        </button>
      </div>

      {/* ⭐⭐ O MESMO MODAL DA TELA DE PRODUTOS — "o que acontece se eu confirmar?" numa
          tela só: o que baixa por NOME, o que sai do estoque item a item com custo, o
          custo total, e os pendentes numa linha neutra. ⛔ Nada grava sem ele. */}
      {modal && (
        <PlanoVendaModal
          plano={plano ?? { produtos: [], pendentes: [], fora: [], agregada: [] }}
          data={data}
          titulo={relatorio === 'COMPLEMENTOS' ? 'Baixa dos complementos' : 'Baixa das vendas'}
          subtitulo={preview && preview.mudam.length > 0 ? `${preview.mudam.length} nome(s) mudaram de destino — confirmar estorna e refaz o dia` : 'confirmar estorna e refaz a baixa deste dia'}
          processando={gravando}
          erro={erro}
          onConfirmar={(confirmouSanidade) => void gravar(confirmouSanidade)}
          onClose={() => setModal(false)}
        />
      )}
    </div>
  )
}
