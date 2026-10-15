'use client'

// ⭐⭐ CONTAGEM — DOIS MODOS: CONTAR e REVISAR (31/08/2026).
//
// ⛔ A TELA ANTERIOR ESTAVA ATRÁS DAS LÍDERES EM **MÉTODO**, não só em visual (achados do
// dono testando em prod):
//   1. a coluna SISTEMA à vista durante a contagem → **viés de confirmação**: quem vê 571
//      escreve 571 mesmo tendo contado 560. É o problema que a contagem existe pra resolver.
//   2. campo com setinhas — inviável no dedo e absurdo pra digitar 6.313
//   3. unidade do outro lado da tela · 4. nome numa ponta e campo na outra (erro de linha)
//   5. coluna "última contagem" dizendo "sem contagem" em 91 linhas · 6. "0/91" duas vezes
//   7. cabeçalho de tabela repetido por categoria · 8. sessão aberta há 7 dias, sem aviso
//
// ⭐ AGORA: **CONTAR** é um item por vez, tela cheia, sem o número do sistema. **REVISAR**
// é a tela do dono — aí sim a tabela, aí sim o sistema, aí sim a divergência colorida.
// Separar os dois momentos é o que torna a contagem cega possível.
//
// ⚠️ O MOTOR NÃO MUDOU: `contarLinha`, o freio, o AJUSTE_CONTAGEM na hora e o invariante
// E8 são os mesmos. O que entrou é o RASTRO (append-only) ao lado, sem tocar na cabeça.

/**
 * ⭐⭐ **O UPGRADE DE TINTA (15/10)** — a modal do motivo (05/10) já pintava por token; o resto
 * da tela não: **7 hex cravados** (`#185FA5`) e **43 classes de paleta**.
 *
 * ⛔ Nenhum dos dois inverte no tema escuro, e numa tela de CÂMARA FRIA isso não é estética:
 * quem conta está com o celular na mão, no escuro, e tinta preta sobre chão preto é uma linha
 * que não se lê. A troca é por **PAPEL** (`--prod-primary` · `--prod-muted` · `--prod-line`
 * · `--prod-acao-bg/ink` · as famílias pros selos), nunca por tom; ⛔ e a **ESTRUTURA não
 * mudou**: os dois modos, o freio, a modal do motivo e os gestos são os mesmos.
 *
 * ⚠️ `text-[color:var(--x)]` precisa do **hint de tipo**; ⛔ e **nunca `bg-[var(--x)]/10`** —
 * opacidade sobre valor arbitrário sai **TRANSPARENTE** no Tailwind 3 (medido em 06/10).
 */
import { useEffect, useMemo, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { ClipboardList, Loader2, Play, AlertTriangle, ListChecks, Pencil, Check, X } from 'lucide-react'
import { CartaoContar, type LinhaContar } from '@/components/estoque/contagem/cartao-contar'
import { TrilhoFila } from '@/components/estoque/contagem/trilho-fila'
import { RevisaoContagem, type VersaoLinha, type Decisao } from '@/components/estoque/contagem/revisao-contagem'
import { usePermissoes } from '@/lib/hooks/use-permissoes'
import { moverNaFila } from '@/lib/stock/contagem/ordem-fila'

interface Linha extends LinhaContar {
  categoria: string
  custoUnitario: number
  diasSemContagem: number | null
  viuSistema: boolean
  observacao: string | null
  contado: { qtdContada: number; divergencia: number; valorDivergencia: number; contadoPorNome: string | null; contadoEm: string } | null
}
interface Quadro {
  contagem: { id: string; tipo: string; status: string; iniciadaEm: string; criadoPorNome: string | null } | null
  linhas: Linha[]; totalItens: number; totalContados: number; totalAApurar: number
  divergenciaValor: number; avisoSessao: string | null
}

const fmtQuando = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * ⭐⭐ A TRADUÇÃO DA FALHA — e ela **nunca inventa um genérico quando o servidor falou**.
 *
 * ⛔ **O DEFEITO DE 16/09:** era `j.erro ?? 'Não consegui gravar a contagem.'`. O `??` só
 * cai no fallback quando o servidor **não manda** `erro` — o que acontece no **500**. E foi
 * exatamente isso na contagem do fermento: o `MovementInvalidError` explicava tudo
 * (*"valor R$ −31,04 · dinheiro negativo com saldo positivo não existe"*) e morria num
 * `throw e` que virava 500 sem corpo. **A frase existia; ninguém a entregava.**
 *
 * ⚠️ O fallback continua existindo — porque 500 acontece —, mas agora ele **DIZ que é
 * falha do sistema** em vez de fingir que sabe o motivo.
 */
function comoErro(j: { erro?: string; saida?: { rotulo: string; href: string } }, oQue: string) {
  if (j?.erro) return { msg: j.erro, saida: j.saida }
  return { msg: `O sistema falhou ao ${oQue} e não devolveu o motivo — isso é defeito nosso, não seu. Tente de novo; se repetir, me chame.` }
}

export default function ContagemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { pode } = usePermissoes(id)
  const [q, setQ] = useState<Quadro | null | undefined>(undefined)
  const [modo, setModo] = useState<'contar' | 'revisar'>('contar')
  const [atualId, setAtualId] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  /**
   * ⭐⭐ O ERRO CARREGA A SAÍDA (16/09) — *"recusa ensina a saída"*, régua do dono.
   * ⛔ Antes era `string`, e a tela só sabia dizer o quê, nunca o que fazer.
   */
  const [erro, setErro] = useState<{ msg: string; saida?: { rotulo: string; href: string } } | null>(null)
  const [iniciando, setIniciando] = useState(false)
  const [finalizando, setFinalizando] = useState(false)
  /** ⭐ v1.1: o freio passa a carregar a SUGESTÃO — o número certo em 1 toque */
  const [freio, setFreio] = useState<{
    itemId: string; qtd: number; msg: string
    opts: { viuSistema: boolean; observacao: string | null }
    sugestao?: { qtdProvavel: number | null; fator: number | null } | null
  } | null>(null)
  /**
   * ⛔⛔ O MOTIVO DO NEGATIVO (05/10) — 1 toque, e as OPÇÕES descem do SERVIDOR.
   *
   * ⚠️ A lista não é digitada aqui: ela vem no 409 (`j.motivos`). Uma 2ª cópia do vocabulário
   * na tela é o que deixou 2 gestos MORTOS por dias em 25/09 — o `z.enum` da rota repetido à
   * mão. Aqui a tela só desenha os botões que o servidor mandou.
   */
  const [motivo, setMotivo] = useState<{
    itemId: string; qtd: number; msg: string
    opts: { viuSistema: boolean; observacao: string | null }
    confirmarFreio: boolean
    motivos: { codigo: string; rotulo: string }[]
  } | null>(null)
  const [historico, setHistorico] = useState<Record<string, VersaoLinha[]>>({})
  const [decisoes, setDecisoes] = useState<Record<string, { decisao: string; motivo: string | null; decididoPorNome: string | null }>>({})

  const carregar = () => fetch(`/api/empresas/${id}/estoque/contagem`).then((r) => r.json()).then((j) => setQ(j.quadro ?? null)).catch(() => setQ(null))
  useEffect(() => { carregar() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // o histórico só é buscado quando o dono abre a revisão — a contagem não precisa dele
  useEffect(() => {
    if (modo !== 'revisar' || !q?.contagem) return
    fetch(`/api/empresas/${id}/estoque/contagem/revisao?contagemId=${q.contagem.id}`)
      .then((r) => r.json())
      .then((j) => { setHistorico(j.historico ?? {}); setDecisoes(j.decisoes ?? {}) })
      .catch(() => {})
  }, [modo, q?.contagem?.id, id]) // eslint-disable-line react-hooks/exhaustive-deps

  const pendentes = useMemo(() => (q?.linhas ?? []).filter((l) => !l.estado), [q])
  const atual = useMemo(() => {
    const ls = q?.linhas ?? []
    return ls.find((l) => l.itemId === atualId) ?? pendentes[0] ?? ls[0] ?? null
  }, [q, atualId, pendentes])

  /** ⚠️ o próximo é sempre o próximo PENDENTE — quem já passou não volta sozinho */
  const irProximo = () => {
    const prox = (q?.linhas ?? []).find((l) => !l.estado && l.itemId !== atual?.itemId)
    setAtualId(prox?.itemId ?? null)
  }

  async function iniciar(tipo?: 'INICIAL' | 'ROTINA') {
    setIniciando(true); setErro(null)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/contagem`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tipo ? { tipo } : {}) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErro(comoErro(j, 'iniciar a contagem')); return }
      await carregar()
    } catch { setErro({ msg: 'A rede falhou ao iniciar a contagem — tente de novo.' }) } finally { setIniciando(false) }
  }

  async function contar(
    itemId: string, qtd: number, opts: { viuSistema: boolean; observacao: string | null },
    confirmarFreio = false, motivoDoNegativo: string | null = null,
  ) {
    if (!q?.contagem) return
    setSalvando(true); setErro(null)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/contagem/linha`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contagemId: q.contagem.id, itemId, qtdContada: qtd, confirmarFreio, motivoDoNegativo, ...opts }),
      })
      const j = await r.json().catch(() => ({}))
      // ⛔ o FREIO é do SERVIDOR: divergência grande sem 2ª confirmação = 409 e o ledger
      // não se move. A tela só PERGUNTA — não é ela que decide (REGRA 5).
      /**
       * ⛔ o FREIO é do SERVIDOR nos dois casos. ⭐ `FREIO_ESCALA` é o mesmo freio com a
       * PERGUNTA ESPECÍFICA (20/09) — ele vem com o número provável, e a tela oferece
       * *"usar 166"* em 1 toque em vez de só perguntar se é isso mesmo.
       */
      if (r.status === 409 && (j.code === 'FREIO' || j.code === 'FREIO_ESCALA')) {
        setFreio({ itemId, qtd, msg: j.erro, opts, sugestao: j.grandeza ?? null })
        return
      }
      /**
       * ⛔⛔ ITEM NEGATIVO PEDE A CAUSA — **409, igual ao freio: é PERGUNTA, não erro.**
       * ⚠️ A contagem ENTRA no toque seguinte; por isso a tela não mostra isto como falha.
       */
      if (r.status === 409 && j.code === 'MOTIVO_DO_NEGATIVO') {
        setFreio(null)
        setMotivo({ itemId, qtd, msg: j.erro, opts, confirmarFreio, motivos: j.motivos ?? [] })
        return
      }
      if (!r.ok) { setErro(comoErro(j, 'gravar a contagem')); return }
      setFreio(null); setMotivo(null)
      await carregar()
      irProximo()
    } catch { setErro({ msg: 'A rede falhou ao gravar a contagem — o que você digitou continua aí; tente de novo.' }) } finally { setSalvando(false) }
  }

  async function marcar(itemId: string, estado: 'NAO_SEI' | 'PULADO', observacao: string | null) {
    if (!q?.contagem) return
    setSalvando(true); setErro(null)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/contagem/marcar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contagemId: q.contagem.id, itemId, estado, observacao }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErro(comoErro(j, 'marcar a linha')); return }
      await carregar()
      irProximo()
    } catch { setErro({ msg: 'A rede falhou — o que você digitou continua aí; tente de novo.' }) } finally { setSalvando(false) }
  }

  async function reordenar(de: number, para: number) {
    if (!q) return
    const caminho = moverNaFila(q.linhas.map((l) => ({ itemId: l.itemId, nome: l.nome, categoria: l.categoria })), de, para)
    // otimista: a fila reordena na hora e o servidor guarda em seguida
    const ordenadas = [...q.linhas].sort((a, b) => (caminho.get(a.itemId)! - caminho.get(b.itemId)!))
    setQ({ ...q, linhas: ordenadas })
    await fetch(`/api/empresas/${id}/estoque/contagem/ordem`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caminho: [...caminho.entries()].map(([itemId, ordem]) => ({ itemId, ordem })) }),
    }).catch(() => {})
  }

  async function decidir(itemId: string, decisao: Decisao) {
    if (!q?.contagem) return
    const r = await fetch(`/api/empresas/${id}/estoque/contagem/revisao`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contagemId: q.contagem.id, itemId, decisao }),
    })
    if (r.ok) setDecisoes((s) => ({ ...s, [itemId]: { decisao, motivo: null, decididoPorNome: null } }))
  }

  async function finalizar(acao: 'finalizar' | 'cancelar') {
    if (!q?.contagem) return
    setFinalizando(true); setErro(null)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/contagem/finalizar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contagemId: q.contagem.id, acao }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErro(comoErro(j, 'encerrar a contagem')); return }
      location.href = `/empresas/${id}/estoque/contagens`
    } catch { setErro({ msg: 'A rede falhou ao encerrar — a contagem segue aberta; tente de novo.' }) } finally { setFinalizando(false) }
  }

  if (q === undefined) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--prod-muted)' }} /></div>
  if (!q) return <div className="p-6 text-sm" style={{ color: 'var(--prod-muted)' }}>Não consegui carregar a contagem.</div>

  // ── sem sessão aberta ──
  if (!q.contagem) {
    const primeira = q.linhas.every((l) => l.ultimaContagemEm == null)
    return (
      <div className="space-y-3">
        <Cabecalho id={id} />
        <Card><CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <ClipboardList className="h-10 w-10" style={{ color: 'var(--prod-line-strong)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--prod-primary)' }}>{primeira ? 'Nenhuma contagem ainda — essa é a INICIAL, o ponto-zero do estoque.' : 'Nenhuma contagem aberta.'}</p>
          <p className="max-w-lg text-xs" style={{ color: 'var(--prod-muted)' }}>
            Você conta <b>sem ver</b> o que o sistema acha que tem — é o que faz a contagem
            valer. Cada linha confirmada ajusta o saldo na hora, e dá pra parar e voltar:
            a sessão fica aberta até você finalizar.
          </p>
          {erro && (
        <div className="rounded-md px-3 py-2 text-xs" style={{ background: 'var(--fam-coral-bg)', color: 'var(--fam-coral-ink)' }}>
          <p>{erro.msg}</p>
          {/* ⭐ o gesto que RESOLVE — recusa sem saída é beco */}
          {erro.saida && (
            <a href={erro.saida.href} className="mt-1 inline-block font-semibold underline">
              {erro.saida.rotulo} →
            </a>
          )}
        </div>
      )}
          <button onClick={() => iniciar()} disabled={iniciando} className="inline-flex h-10 items-center gap-2 rounded-xl px-5 text-sm font-semibold disabled:opacity-50"
            style={{ background: 'var(--prod-acao-bg)', color: 'var(--prod-acao-ink)' }}>
            {iniciando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} {primeira ? 'Começar contagem inicial' : 'Começar contagem'}
          </button>
        </CardContent></Card>
      </div>
    )
  }

  const feitos = q.linhas.filter((l) => l.estado).length

  return (
    <div className="space-y-3 pb-6">
      <Cabecalho id={id} sessao={q.contagem} />

      {/* ⚠️ SESSÃO VELHA — AVISA, NUNCA FECHA SOZINHA: fechar jogaria fora o trabalho de
          quem está no meio do estoque, que é justamente quem mais precisa que não atrapalhe */}
      {q.avisoSessao && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2"
          style={{ borderColor: 'var(--fam-ambar-mid)', background: 'var(--fam-ambar-bg)' }}>
          <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: 'var(--fam-ambar-mid)' }} />
          <p className="flex-1 text-[12px] leading-snug" style={{ color: 'var(--fam-ambar-ink)' }}>{q.avisoSessao}</p>
          <button onClick={() => { setModo('contar'); setAtualId(q.linhas.find((l) => l.estado)?.itemId ?? null) }}
            className="shrink-0 rounded-md border px-2 py-1 text-[11px] font-medium"
            style={{ borderColor: 'var(--fam-ambar-mid)', background: 'var(--prod-surface)', color: 'var(--fam-ambar-ink)' }}>
            recontar os mais antigos
          </button>
        </div>
      )}

      {/* os dois modos */}
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="inline-flex rounded-lg border p-0.5" style={{ borderColor: 'var(--prod-line-strong)' }}>
          <button onClick={() => setModo('contar')}
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium"
            style={modo === 'contar'
              ? { background: 'var(--prod-acao-bg)', color: 'var(--prod-acao-ink)' }
              : { color: 'var(--prod-muted)' }}>
            <Pencil className="h-3.5 w-3.5" /> Contar
          </button>
          <button onClick={() => setModo('revisar')}
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium"
            style={modo === 'revisar'
              ? { background: 'var(--prod-acao-bg)', color: 'var(--prod-acao-ink)' }
              : { color: 'var(--prod-muted)' }}>
            <ListChecks className="h-3.5 w-3.5" /> Revisar
            {q.totalAApurar > 0 && <span className="ml-1 rounded-full px-1.5 text-[10px]" style={{ background: 'var(--fam-ambar-solid)', color: 'var(--fam-ambar-on)' }}>{q.totalAApurar}</span>}
          </button>
        </div>
        <span className="ml-auto text-xs tabular-nums" style={{ color: 'var(--prod-muted)' }}>
          <b style={{ color: 'var(--prod-primary)' }}>{feitos}</b> de {q.totalItens}
        </span>
        {modo === 'revisar' && pode('stock.manage') && (
          <button onClick={() => finalizar('finalizar')} disabled={finalizando}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold disabled:opacity-50"
            style={{ background: 'var(--fam-verde-solid)', color: 'var(--fam-verde-on)' }}>
            {finalizando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} finalizar contagem
          </button>
        )}
      </div>

      {erro && (
        <div className="rounded-md px-3 py-2 text-xs" style={{ background: 'var(--fam-coral-bg)', color: 'var(--fam-coral-ink)' }}>
          <p>{erro.msg}</p>
          {/* ⭐ o gesto que RESOLVE — recusa sem saída é beco */}
          {erro.saida && (
            <a href={erro.saida.href} className="mt-1 inline-block font-semibold underline">
              {erro.saida.rotulo} →
            </a>
          )}
        </div>
      )}

      {modo === 'contar' ? (
        atual ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
            <Card><CardContent className="py-6">
              <CartaoContar
                linha={atual}
                posicao={feitos + 1}
                total={q.totalItens}
                salvando={salvando}
                onConfirmar={(qtd, opts) => contar(atual.itemId, qtd, opts)}
                onMarcar={(estado, obs) => marcar(atual.itemId, estado, obs)}
                onPular={() => marcar(atual.itemId, 'PULADO', null)}
              />
            </CardContent></Card>

            <Card className="hidden lg:block"><CardContent className="p-2.5">
              <TrilhoFila
                itens={q.linhas}
                atualId={atual.itemId}
                onIr={setAtualId}
                onMover={reordenar}
                podeReordenar={pode('stock.manage')}
              />
            </CardContent></Card>
          </div>
        ) : (
          <Card><CardContent className="p-10 text-center">
            <Check className="mx-auto h-10 w-10" style={{ color: 'var(--fam-verde-mid)' }} />
            <p className="mt-2 text-sm font-medium" style={{ color: 'var(--prod-primary)' }}>Tudo passou — {feitos} de {q.totalItens}.</p>
            <p className="mt-1 text-xs" style={{ color: 'var(--prod-muted)' }}>Agora é a revisão: lá o sistema aparece e dá pra comparar.</p>
            <button onClick={() => setModo('revisar')} className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-xs font-semibold"
              style={{ background: 'var(--prod-acao-bg)', color: 'var(--prod-acao-ink)' }}>
              <ListChecks className="h-4 w-4" /> ir pra revisão
            </button>
          </CardContent></Card>
        )
      ) : (
        <RevisaoContagem
          linhas={q.linhas}
          historico={historico}
          decisoes={decisoes}
          podeDecidir={pode('stock.manage')}
          onDecidir={decidir}
          onRecontar={(itemId) => { setAtualId(itemId); setModo('contar') }}
        />
      )}

      {/**
        * ⛔⛔⛔ A CAUSA DO NEGATIVO — 1 toque, e a contagem ENTRA (05/10).
        *
        * ⚠️⚠️ **ISTO NÃO É A RECUSA DE 22/09 DE VOLTA.** Ali o desfecho era *"a contagem
        * espera"* e não havia gesto que fechasse a diferença — o dono ficava com 6 kg de
        * fermento na prateleira e o sistema dizendo −3,56. Aqui a frase **promete o desfecho**
        * e cada botão GRAVA. ⛔ Por isso não existe "voltar e conferir" como saída principal:
        * a saída é responder.
        *
        * ⭐ E *"não sei"* é um botão de primeira classe: obrigar a escolher uma causa que a
        * pessoa não conhece é **fabricar diagnóstico**, e diagnóstico inventado encerra a
        * investigação que o aviso do sininho existe pra abrir.
        */}
      {motivo && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={() => setMotivo(null)}>
          <div className="w-full rounded-t-2xl p-4 sm:max-w-md sm:rounded-xl"
            style={{ background: 'var(--prod-surface)' }} onClick={(e) => e.stopPropagation()}>
            <p className="flex items-start gap-2 text-sm" style={{ color: 'var(--prod-primary)' }}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--fam-ambar-mid)' }} />
              {motivo.msg}
            </p>
            <div className="mt-3 space-y-2">
              {motivo.motivos.map((m) => (
                <button
                  key={m.codigo}
                  onClick={() => contar(motivo.itemId, motivo.qtd, motivo.opts, motivo.confirmarFreio, m.codigo)}
                  disabled={salvando}
                  className="h-11 w-full rounded-lg px-3 text-left text-sm font-medium disabled:opacity-50"
                  style={{ border: '1px solid var(--prod-line-strong)', color: 'var(--prod-primary)' }}
                >
                  {m.rotulo}
                </button>
              ))}
            </div>
            {/* ⚠️ o escape existe, mas é SECUNDÁRIO: a saída daqui é responder, não fugir */}
            <button onClick={() => setMotivo(null)}
              className="mt-3 h-9 w-full rounded-lg text-xs" style={{ color: 'var(--prod-muted)' }}>
              deixar pra depois
            </button>
          </div>
        </div>
      )}

      {/* ⛔ O FREIO — a 2ª confirmação que o SERVIDOR exigiu */}
      {freio && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={() => setFreio(null)}>
          <div className="w-full rounded-t-2xl p-4 sm:max-w-md sm:rounded-xl"
            style={{ background: 'var(--prod-surface)' }} onClick={(e) => e.stopPropagation()}>
            <p className="flex items-start gap-2 text-sm" style={{ color: 'var(--prod-primary)' }}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--fam-ambar-mid)' }} /> {freio.msg}
            </p>
            {/*
              ⭐⭐ O NÚMERO CERTO EM 1 TOQUE (20/09) — a cura do creme de leite.
              ⛔ E ele é o botão PRIMÁRIO: quando o sistema sabe qual era o número, a saída
              fácil tem que ser a CERTA. *"Confirmar mesmo assim" continua ali* — um dia o
              número absurdo vai ser verdade, e travar empurraria a cozinha pra fora do
              sistema.
            */}
            {freio.sugestao?.qtdProvavel != null && (
              <button
                onClick={() => contar(freio.itemId, freio.sugestao!.qtdProvavel!, freio.opts, false)}
                className="mt-3 h-11 w-full rounded-lg text-sm font-bold"
                style={{ background: 'var(--fam-verde-solid)', color: 'var(--fam-verde-on)' }}>
                usar {String(freio.sugestao.qtdProvavel).replace('.', ',')}
              </button>
            )}
            <div className="mt-2 flex gap-2">
              <button onClick={() => setFreio(null)} className="h-10 flex-1 rounded-lg border text-sm"
                style={{ borderColor: 'var(--prod-line-strong)', color: 'var(--prod-primary)' }}>
                <X className="mr-1 inline h-4 w-4" /> voltar e conferir
              </button>
              <button onClick={() => contar(freio.itemId, freio.qtd, freio.opts, true)}
                className="h-10 flex-1 rounded-lg border text-sm font-semibold"
                style={freio.sugestao?.qtdProvavel != null
                  ? { borderColor: 'var(--prod-line-strong)', color: 'var(--prod-primary)' }
                  : { borderColor: 'transparent', background: 'var(--prod-acao-bg)', color: 'var(--prod-acao-ink)' }}>
                confirmar mesmo assim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Cabecalho({ id, sessao }: { id: string; sessao?: { tipo: string; iniciadaEm: string; criadoPorNome: string | null } }) {
  return (
    <div className="flex items-center gap-2.5">
      <ClipboardList className="h-5 w-5 shrink-0" style={{ color: 'var(--prod-accent)' }} />
      <h1 className="text-base font-semibold" style={{ color: 'var(--prod-primary)' }}>Contagem</h1>
      {sessao && (
        <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
          style={sessao.tipo === 'INICIAL'
            ? { background: 'var(--fam-indigo-bg)', color: 'var(--fam-indigo-ink)' }
            : { background: 'var(--prod-surface-1)', color: 'var(--prod-muted)' }}>
          {sessao.tipo === 'INICIAL' ? 'inicial' : 'rotina'}
        </span>
      )}
      {sessao && <p className="hidden flex-1 truncate text-xs lg:block" style={{ color: 'var(--prod-muted)' }}>aberta em {fmtQuando(sessao.iniciadaEm)}{sessao.criadoPorNome ? ` por ${sessao.criadoPorNome}` : ''} · confirmar a linha ajusta o saldo na hora</p>}
      <a href={`/empresas/${id}/estoque/contagens`} className="ml-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs hover:bg-[var(--prod-surface-1)]"
        style={{ borderColor: 'var(--prod-line-strong)', color: 'var(--prod-primary)' }}>Sessões</a>
    </div>
  )
}
