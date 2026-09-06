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
  esperandoEtapaAnterior: string | null; minha: boolean
}

export default function CozinhaPage({ params }: { params: Promise<{ empresaId: string }> }) {
  const { empresaId } = use(params)
  const [pin, setPin] = useState('')
  const [quem, setQuem] = useState<{ id: string; nome: string } | null>(null)
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [feito, setFeito] = useState<{ nome: string; minutos: number } | null>(null)
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

  const sair = () => { setQuem(null); setTarefas([]); setPin(''); pinRef.current = ''; setFeito(null); setErro(null) }

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
        {proxima
          ? <p className="mt-6 text-sm text-slate-400">próxima: {proxima.nome}</p>
          : <p className="mt-6 text-sm text-slate-400">não tem mais nada pra você hoje</p>}
        <button onClick={() => setFeito(null)}
          className="mt-8 rounded-xl bg-slate-800 px-6 py-3 text-sm text-slate-200 active:bg-slate-700">voltar às tarefas</button>
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
              const antes = emAndamento.minutos ?? 0
              const j = await chamar('finalizar', { etapaId: emAndamento.etapaId })
              if (j) setFeito({ nome: emAndamento.nome, minutos: Math.max(antes, Math.round(corridos / 60)) })
            }}
            disabled={busy}
            className="mt-10 w-full max-w-sm rounded-2xl bg-emerald-500 py-6 text-xl font-semibold text-white active:bg-emerald-600 disabled:opacity-50">
            {busy ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : 'FINALIZAR'}
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
              <button onClick={() => chamar('iniciar', { etapaId: t.etapaId })} disabled={busy}
                className="mt-4 w-full rounded-xl bg-emerald-500 py-4 text-lg font-semibold text-white active:bg-emerald-600 disabled:opacity-50">
                {busy ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : 'INICIAR'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
