'use client'

// ⭐⭐⭐ AS AÇÕES DO GERENTE NO HOJE AO VIVO (08/09/2026) — decisão do dono.
//
// *"Hoje é o primeiro dia da equipe no relógio — vai ter esquecimento, gente embora sem
// finalizar, e EU resolvendo. A tela viva já mostra os três grupos; quero AGIR dali."*
//
// ⛔⛔ FONTE ÚNICA, SEM SEGUNDA IMPLEMENTAÇÃO: estes botões chamam **a mesma rota** que a
// tela da ordem usa (`POST …/ordens/{id}/etapas`), que por sua vez chama as mesmas funções
// (`pedirPraFinalizar`, `finalizarPeloGerente`) e — quando é a última etapa — o **mesmo**
// `concluirDoTablet`. Nada de um segundo motor de conclusão nascendo numa tela nova; era
// exatamente isso que o dono pediu pra evitar.
//
// ⚠️ E A HONESTIDADE FICA INTACTA: "finalizar pelo gerente" grava *por mim em nome de
// Fulana*, com tempo **A APURAR** e fora das médias; "pedir pra finalizar" é o caminho
// PREFERIDO, porque aí ela aperta com o PIN dela e o tempo é **dela, medido de verdade**.

import { useState } from 'react'
import { Loader2, MessageSquare, UserCheck, Check } from 'lucide-react'

interface Props {
  empresaId: string
  ordemId: string
  etapaId: string
  /** o nome de quem está com a tarefa — entra na frase do gesto */
  quem: string
  /** já existe um recado esperando? o botão vira "reenviar" */
  pedidoEmAberto: boolean
  /** ⭐ última etapa da ordem → o gesto pergunta "quantos saíram?" ali mesmo */
  ehUltima: boolean
  onFeito: () => void
}

export function AcoesDoGerenteHoje({
  empresaId, ordemId, etapaId, quem, pedidoEmAberto, ehUltima, onFeito,
}: Props) {
  const [busy, setBusy] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  /** o passo do "quantos saíram?" — só existe quando é a última etapa */
  const [perguntando, setPerguntando] = useState(false)
  const [quanto, setQuanto] = useState('')

  const chamar = async (acao: 'pedir-finalizar' | 'finalizar-pelo-gerente', qtdGerada?: number) => {
    setBusy(acao); setErro(null); setOk(null)
    try {
      const r = await fetch(`/api/empresas/${empresaId}/estoque/producao/ordens/${ordemId}/etapas`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ etapaId, acao, ...(qtdGerada != null ? { qtdGerada } : {}) }),
      })
      const j = await r.json().catch(() => null)
      // ⚠️ falha VISÍVEL: sem isso o gerente aperta e não sabe se pegou
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui.'); return }
      setOk(acao === 'pedir-finalizar'
        ? `recado enviado pra ${quem}`
        : qtdGerada != null ? 'ordem concluída' : `finalizada em nome de ${quem}`)
      setPerguntando(false); setQuanto('')
      onFeito()
    } catch {
      setErro('Falha de rede. Tenta de novo.')
    } finally { setBusy(null) }
  }

  const n = Number(quanto.replace(',', '.'))
  const podeConcluir = Number.isFinite(n) && n > 0

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {/* ⭐ PEDIR vem PRIMEIRO e é o caminho preferido: o tempo continua sendo DELA */}
      <button
        onClick={() => chamar('pedir-finalizar')}
        disabled={!!busy}
        className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-[#c2760a]/40 bg-white px-2.5 text-[12px] font-medium text-[#a8650a] hover:bg-amber-50 disabled:opacity-40"
      >
        {busy === 'pedir-finalizar' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
        {pedidoEmAberto ? 'reenviar recado' : 'pedir pra finalizar'}
      </button>

      {!perguntando ? (
        <button
          onClick={() => (ehUltima ? setPerguntando(true) : chamar('finalizar-pelo-gerente'))}
          disabled={!!busy}
          className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-[12px] text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          title="o tempo fica A APURAR — fora das médias"
        >
          {busy === 'finalizar-pelo-gerente' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
          finalizar por {quem.split(' ')[0]}
        </button>
      ) : (
        // ⭐⭐ É A ÚLTIMA ETAPA: pergunta "quantos saíram?" AQUI e conclui pelo MESMO motor.
        // *"Um fluxo, na tela onde estou."*
        <span className="inline-flex flex-wrap items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5">
          <label className="text-[12px] text-slate-600">
            quantos saíram?
            <input
              autoFocus
              inputMode="decimal"
              value={quanto}
              onChange={(e) => setQuanto(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && podeConcluir) chamar('finalizar-pelo-gerente', n) }}
              // ⚠️ campo VAZIO, nunca pré-preenchido: número sugerido vira número confirmado
              // sem ninguém contar — é a mesma régua do "a previsão SUGERE, nunca preenche".
              placeholder="—"
              className="ml-1.5 w-20 rounded border border-slate-300 px-2 py-1 text-right text-[13px] tabular-nums"
            />
          </label>
          <button
            onClick={() => chamar('finalizar-pelo-gerente', n)}
            disabled={!!busy || !podeConcluir}
            className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-[#534AB7] px-2.5 text-[12px] font-semibold text-white hover:bg-[#453D9C] disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            concluir ordem
          </button>
          <button onClick={() => { setPerguntando(false); setQuanto('') }} className="text-[12px] text-slate-400 hover:text-slate-600">
            cancelar
          </button>
        </span>
      )}

      {/* ⛔ o rastro em UMA linha, pra ele saber o que acabou de gravar */}
      {ok && <span className="text-[11.5px] font-medium text-emerald-700">✓ {ok}</span>}
      {erro && <span className="text-[11.5px] text-rose-600">{erro}</span>}
      {perguntando && (
        <span className="w-full text-[11px] text-slate-400">
          o tempo desta etapa fica <b className="font-medium text-slate-500">a apurar</b> (fora das médias) — o rastro
          registra que foi você quem finalizou em nome de {quem}
        </span>
      )}
    </div>
  )
}
