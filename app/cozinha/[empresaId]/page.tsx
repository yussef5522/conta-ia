'use client'

// ⭐⭐ A JANELA DA COZINHA (06/09/2026) — a tela que fica no tablet o dia inteiro.
//
// ⛔ FORA DO `(dashboard)` DE PROPÓSITO: sem barra lateral, sem seletor de empresa, sem nada
// que leve pro financeiro. O funcionário vê **as tarefas dele de hoje** e mais nada — é o
// *Lists → Mine* do Jolt, com o vocabulário desta cozinha.
//
// ⚠️ QUATRO ESTADOS, UM POR VEZ (padrão de tela de cozinha: um toque, alvo grande, sem
// menu): identificar → escolher → executar → confirmar. Botão pequeno com luva molhada e
// pressa é botão que não é apertado — e tarefa não apertada é média que não existe.
//
// ⛔⛔ O `colaboradorId` NUNCA GOVERNA NADA AQUI: toda ação manda o PIN e o SERVIDOR resolve
// quem é. Guardar o id e mandá-lo deixaria qualquer um assinar o trabalho de outro sem saber
// o PIN dele — e aí o PIN não protegeria nada, que é pior do que não ter.

import { useEffect, useRef, useState, use } from 'react'
import { Loader2, Check, Delete } from 'lucide-react'
import { duracao } from '@/components/estoque/etapas-da-ordem'

interface Tarefa {
  etapaId: string; ordemId: string; posicao: number; nome: string; produto: string
  escalaReceitas: number; estado: 'AGUARDANDO' | 'EM_ANDAMENTO' | 'FEITA'
  iniciadoEm: string | null; minutos: number | null
  esperandoEtapaAnterior: string | null; minha: boolean; ultima: boolean
}
interface Consumo { itemId: string; nome: string; qtd: number; unidade: string }

export default function CozinhaPage({ params }: { params: Promise<{ empresaId: string }> }) {
  const { empresaId } = use(params)
  const [pin, setPin] = useState('')
  const [quem, setQuem] = useState<{ id: string; nome: string } | null>(null)
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [feito, setFeito] = useState<{ nome: string; minutos: number; qtdGerada?: number } | null>(null)
  // ⭐ "quantos saíram?" na ÚLTIMA etapa — o número vem de quem sabe, na ponta
  const [fechando, setFechando] = useState<Tarefa | null>(null)
  const [quanto, setQuanto] = useState('')
  const [parcial, setParcial] = useState(false)
  const [consumo, setConsumo] = useState<Consumo[] | null>(null)
  // ⚠️ o PIN fica só em memória, nunca em storage: tablet compartilhado, e fechar a aba
  // TEM que deslogar — senão o próximo a pegar o aparelho assina como o anterior.
  const pinRef = useRef('')
  const [agora, setAgora] = useState(() => Date.now())

  // o cronômetro da tela (só pintura — quem conta o tempo é o servidor, pelos toques)
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const chamar = async (acao: string, corpo: Record<string, unknown>) => {
    setBusy(true); setErro(null)
    try {
      const r = await fetch(`/api/empresas/${empresaId}/estoque/producao/minhas-tarefas/${acao}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinRef.current, ...corpo }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) {
        // ⚠️ a mensagem do servidor vai INTEIRA pra tela: "outra pessoa já está nessa tarefa"
        // ensina o que fazer; "erro" manda procurar o encarregado.
        setErro(j?.erro ?? 'Não consegui falar com o sistema. Tente de novo.')
        if (r.status === 401) { setQuem(null); pinRef.current = ''; setPin('') }
        return null
      }
      setQuem(j.colaborador ? { id: j.colaborador.id, nome: j.colaborador.nome } : null)
      setTarefas(j.tarefas ?? [])
      return j
    } finally { setBusy(false) }
  }

  const digitar = (d: string) => {
    if (busy) return
    setErro(null)
    const novo = (pin + d).slice(0, 4)
    setPin(novo)
    if (novo.length === 4) { pinRef.current = novo; chamar('entrar', {}).then((j) => { if (!j) setPin('') }) }
  }

  const sair = () => {
    setQuem(null); setTarefas([]); setPin(''); pinRef.current = ''
    setFeito(null); setErro(null); setFechando(null); setQuanto(''); setConsumo(null)
  }

  /** abre o passo de fechar o lote: mostra o que será consumido e pergunta o número */
  const abrirFechamento = async (t: Tarefa) => {
    setFechando(t); setQuanto(''); setParcial(false); setConsumo(null); setErro(null)
    const r = await fetch(`/api/empresas/${empresaId}/estoque/producao/minhas-tarefas/o-que-consome`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: pinRef.current, etapaId: t.etapaId }),
    }).catch(() => null)
    const j = await r?.json().catch(() => null)
    setConsumo(j?.consumo ?? [])
  }

  // ── 1. IDENTIFICAR ────────────────────────────────────────────────────────────────
  if (!quem) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-900 p-6 text-slate-100">
        <h1 className="text-lg font-medium">Quem está trabalhando?</h1>
        <p className="mt-1 text-sm text-slate-400">digite seu PIN de 4 dígitos</p>
        <div className="mt-6 flex gap-3" aria-label={`${pin.length} de 4 dígitos`}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`h-4 w-4 rounded-full ${i < pin.length ? 'bg-emerald-400' : 'bg-slate-700'}`} />
          ))}
        </div>
        {erro && <p className="mt-4 max-w-xs text-center text-sm text-rose-300">{erro}</p>}
        {busy && <Loader2 className="mt-4 h-5 w-5 animate-spin text-slate-400" />}
        <div className="mt-8 grid grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button key={d} onClick={() => digitar(d)} disabled={busy}
              className="h-20 w-20 rounded-2xl bg-slate-800 text-2xl font-medium tabular-nums text-slate-100 active:bg-slate-700 disabled:opacity-40">
              {d}
            </button>
          ))}
          <button onClick={() => { setPin(''); setErro(null) }} aria-label="limpar"
            className="h-20 w-20 rounded-2xl bg-slate-800 text-sm text-slate-400 active:bg-slate-700">limpar</button>
          <button onClick={() => digitar('0')} disabled={busy}
            className="h-20 w-20 rounded-2xl bg-slate-800 text-2xl font-medium tabular-nums text-slate-100 active:bg-slate-700 disabled:opacity-40">0</button>
          <button onClick={() => setPin((p) => p.slice(0, -1))} aria-label="apagar"
            className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-800 text-slate-400 active:bg-slate-700"><Delete className="h-6 w-6" /></button>
        </div>
      </main>
    )
  }

  // ── 4. CONFIRMAR ──────────────────────────────────────────────────────────────────
  if (feito) {
    const proxima = tarefas[0]
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-900 p-6 text-center text-slate-100">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20"><Check className="h-10 w-10 text-emerald-400" /></div>
        <p className="mt-5 text-lg font-medium">Tarefa finalizada</p>
        <p className="mt-1 text-slate-300">{feito.nome}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-400">{duracao(feito.minutos)}</p>
        {feito.qtdGerada != null && (
          <p className="mt-3 rounded-xl bg-slate-800 px-4 py-2 text-sm text-slate-300">
            lote fechado · <strong className="tabular-nums text-slate-100">{feito.qtdGerada}</strong> saíram
          </p>
        )}
        {proxima
          ? <p className="mt-6 text-sm text-slate-400">próxima: {proxima.nome}</p>
          : <p className="mt-6 text-sm text-slate-400">não tem mais nada pra você hoje</p>}
        <button onClick={() => setFeito(null)}
          className="mt-8 rounded-xl bg-slate-800 px-6 py-3 text-sm text-slate-200 active:bg-slate-700">voltar às tarefas</button>
      </main>
    )
  }

  // ── 3b. FECHAR O LOTE (só na última etapa) ─────────────────────────────────────────
  if (fechando) {
    const num = Number(quanto.replace(',', '.'))
    return (
      <main className="flex min-h-screen flex-col bg-slate-900 p-6 text-slate-100">
        <div className="flex items-center justify-between">
          <button onClick={() => setFechando(null)} className="text-sm text-slate-400">← voltar</button>
          <span className="text-sm text-slate-500">{quem.nome}</span>
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center text-center">
          <p className="text-lg font-medium">{fechando.produto}</p>
          <p className="mt-1 text-sm text-slate-400">última etapa: {fechando.nome}</p>

          <p className="mt-8 text-base">Quantos saíram?</p>
          {/* ⛔⛔ O CAMPO NASCE E CONTINUA VAZIO — regra dura do dono: "a previsão SUGERE,
              nunca preenche. Se preencher, todo mundo confirma o número sem contar." */}
          <input
            value={quanto} onChange={(e) => setQuanto(e.target.value.replace(/[^\d,.]/g, ''))}
            inputMode="decimal" placeholder="conte e digite" autoFocus
            className="mt-3 w-full rounded-2xl bg-slate-800 py-5 text-center text-4xl font-semibold tabular-nums text-slate-100 placeholder:text-lg placeholder:font-normal placeholder:text-slate-600"
          />

          {/* ⚠️ O QUE VAI SER CONSUMIDO, à vista: finalizar aqui consome TUDO que foi
              separado. Quem está na cozinha não pesa sobra — se sobrou, não finaliza. */}
          {consumo === null ? (
            <p className="mt-5 text-xs text-slate-500">carregando o que foi separado…</p>
          ) : consumo.length === 0 ? (
            <p className="mt-5 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300">
              Não há material separado nesta ordem. Chame o encarregado.
            </p>
          ) : (
            <div className="mt-5 rounded-xl bg-slate-800/60 p-3 text-left">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">vai consumir</p>
              <ul className="mt-1 space-y-0.5">
                {consumo.map((c) => (
                  <li key={c.itemId} className="flex justify-between text-xs text-slate-300">
                    <span>{c.nome}</span><span className="tabular-nums">{c.qtd} {c.unidade}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                Sobrou material? <strong>Não finalize</strong> — chame o encarregado, ele fecha ajustando a sobra.
              </p>
            </div>
          )}

          <label className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400">
            <input type="checkbox" checked={parcial} onChange={(e) => setParcial(e.target.checked)} />
            produção parcial (o resto sai depois)
          </label>

          {erro && <p className="mt-4 text-sm text-rose-300">{erro}</p>}

          <button
            onClick={async () => {
              const j = await chamar('finalizar', { etapaId: fechando.etapaId, qtdGerada: num, parcial })
              if (j) {
                setFechando(null)
                setFeito({ nome: fechando.nome, minutos: fechando.minutos ?? 0, qtdGerada: j.concluida?.qtdGerada ?? num })
              }
            }}
            disabled={busy || !(num > 0) || !consumo?.length}
            className="mt-8 w-full rounded-2xl bg-emerald-500 py-6 text-xl font-semibold text-white active:bg-emerald-600 disabled:opacity-40">
            {busy ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : 'FINALIZAR E FECHAR O LOTE'}
          </button>
        </div>
      </main>
    )
  }

  const emAndamento = tarefas.find((t) => t.estado === 'EM_ANDAMENTO')

  // ── 3. EXECUTAR ───────────────────────────────────────────────────────────────────
  if (emAndamento) {
    const corridos = emAndamento.iniciadoEm
      ? Math.max(0, Math.floor((agora - new Date(emAndamento.iniciadoEm).getTime()) / 1000))
      : 0
    const mm = String(Math.floor(corridos / 60)).padStart(2, '0')
    const ss = String(corridos % 60).padStart(2, '0')
    return (
      <main className="flex min-h-screen flex-col bg-slate-900 p-6 text-slate-100">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400">{quem.nome}</p>
          <button onClick={sair} className="text-sm text-slate-500">sair</button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-lg font-medium">{emAndamento.nome}</p>
          <p className="mt-1 text-sm text-slate-400">{emAndamento.produto} · {emAndamento.escalaReceitas} receitas</p>
          <p className="mt-8 text-6xl font-semibold tabular-nums text-amber-400">{mm}:{ss}</p>
          <p className="mt-2 text-xs text-slate-500">
            rodando desde {new Date(emAndamento.iniciadoEm!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}
          </p>
          {erro && <p className="mt-4 max-w-xs text-sm text-rose-300">{erro}</p>}
          <button
            onClick={async () => {
              // ⭐ ÚLTIMA etapa → pergunta "quantos saíram?" ANTES de finalizar; as demais
              // finalizam direto (não há lote a fechar no meio do caminho).
              if (emAndamento.ultima) { abrirFechamento(emAndamento); return }
              const antes = emAndamento.minutos ?? 0
              const j = await chamar('finalizar', { etapaId: emAndamento.etapaId })
              if (j) setFeito({ nome: emAndamento.nome, minutos: Math.max(antes, Math.round(corridos / 60)) })
            }}
            disabled={busy}
            className="mt-10 w-full max-w-sm rounded-2xl bg-emerald-500 py-6 text-xl font-semibold text-white active:bg-emerald-600 disabled:opacity-50">
            {busy ? <Loader2 className="mx-auto h-6 w-6 animate-spin" />
              : emAndamento.ultima ? 'FINALIZAR E FECHAR O LOTE' : 'FINALIZAR'}
          </button>
          {/* ⚠️ devolver NÃO é finalizar com zero: quem começou por engano solta a tarefa e
              nenhum tempo é gravado — um lote de 0 minuto envenenaria a média. */}
          <button onClick={() => chamar('devolver', { etapaId: emAndamento.etapaId })} disabled={busy}
            className="mt-4 text-sm text-slate-500 underline underline-offset-4">não é meu turno</button>
        </div>
      </main>
    )
  }

  // ── 2. ESCOLHER ───────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-slate-900 p-5 text-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-medium">Oi, {quem.nome}</p>
          <p className="text-xs capitalize text-slate-500">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' })}
          </p>
        </div>
        <button onClick={sair} className="text-sm text-slate-500">sair</button>
      </div>

      <p className="mt-6 text-[11px] uppercase tracking-wider text-slate-500">Suas tarefas de hoje</p>
      {erro && <p className="mt-3 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300">{erro}</p>}

      {tarefas.length === 0 ? (
        // ⚠️ vazio HONESTO: "nada designado" ≠ "nada a fazer". A frase manda falar com o
        // encarregado em vez de deixar a pessoa parada achando que o sistema quebrou.
        <div className="mt-4 rounded-2xl bg-slate-800/60 p-6 text-center">
          <p className="text-slate-300">Nenhuma tarefa pra você hoje.</p>
          <p className="mt-1 text-sm text-slate-500">Fale com o encarregado — pode ser que ainda não tenha sido designada.</p>
        </div>
      ) : (
        <ul className="mt-3 space-y-3">
          {tarefas.map((t) => (
            <li key={t.etapaId} className="rounded-2xl bg-slate-800 p-4">
              <p className="text-base font-medium text-slate-100">{t.nome}</p>
              <p className="mt-0.5 text-sm text-slate-400">{t.produto} · {t.escalaReceitas} receitas</p>
              {t.esperandoEtapaAnterior ? (
                // ⚠️ AVISA, não bloqueia: o encarregado pode mandar adiantar, e travar aqui
                // faria a pessoa parar de olhar a tela.
                <p className="mt-2 text-xs text-amber-400/80">depois de “{t.esperandoEtapaAnterior}”</p>
              ) : null}
              {!t.minha && <p className="mt-1 text-xs text-slate-500">não é sua — se você pegar, fica registrado no seu nome</p>}
              {/* ⛔⛔ DESABILITADO quando espera a anterior — e o SERVIDOR também recusa.
                  Antes o aviso era só texto e o botão funcionava: em 06/09 a etapa 2 do beef
                  foi iniciada e finalizada com a 1 ainda AGUARDANDO. As duas portas, sempre. */}
              <button
                onClick={() => chamar('iniciar', { etapaId: t.etapaId })}
                disabled={busy || !!t.esperandoEtapaAnterior}
                className="mt-4 w-full rounded-xl bg-emerald-500 py-4 text-lg font-semibold text-white active:bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-400 disabled:opacity-100">
                {busy ? <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  : t.esperandoEtapaAnterior ? `aguardando “${t.esperandoEtapaAnterior}”` : 'INICIAR'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
