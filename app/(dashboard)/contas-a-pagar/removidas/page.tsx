'use client'

/**
 * ⭐⭐⭐ A LIXEIRA DAS CONTAS A PAGAR (20/09/2026).
 *
 * **O dono:** *"o total de vencidas BAIXOU e eu não sei quais contas sumiram (…) eu preciso
 * VER o que sumiu pra reconhecer."*
 *
 * ⛔ A auditoria sempre guardou os deletes — **nenhuma tela lia**. Registro que ninguém
 * desenha é a porta sem maçaneta de novo, e aqui ela custou caro: o dono passou dias sem
 * saber se tinha apagado as contas ou se algo as apagou por ele.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * ⛔⛔⛔ E ELA ESTREOU COM **CARREGANDO ETERNO** — o defeito é meu, e a lição é nova.
 *
 * A 1ª versão descobria a empresa assim:
 *
 *     const m = document.cookie.match(/current_empresa_id=([^;]+)/)   // ⛔ sempre null
 *     if (!empresaId) return                                          // ⛔ o fetch nunca sai
 *
 * **O cookie `current_empresa_id` é `httpOnly`** (`lib/auth/current-empresa-cookie.ts`,
 * desde o Sprint 4.0.5.b) — `document.cookie` **NUNCA** o enxerga. Medido no header real de
 * prod: `Set-Cookie: current_empresa_id=…; HttpOnly`. Resultado: `empresaId` ficava `''`,
 * `carregar()` retornava antes do fetch, e o estado **nunca saía de "carregando…"**.
 *
 * ⚠️⚠️ **E O TIMEOUT ESTAVA INSTALADO — ele não tinha como morder.** O guard da casa
 * (14/09) cobre ***fetch que não VOLTA***; este era ***fetch que não SAI***. ***Estado de
 * carregamento refém de um pré-requisito que pode nunca chegar é spinner eterno com outro
 * nome*** — e nenhum timeout do mundo alcança uma requisição que não aconteceu.
 *
 * ⭐ **A CURA É A PORTA ÚNICA:** quem responde *"qual empresa?"* nesta casa é o
 * `useEmpresa()` (o contexto que o layout já provê e que a `/conciliacao` e o resto usam).
 * Inventar um segundo caminho foi o erro — e ele nem podia funcionar.
 *
 * ⭐⭐ **E O ESTADO VIROU EXPLÍCITO** (`CARREGANDO | OK | FALHOU | SEM_EMPRESA`): não existe
 * mais "ausência de dado" servindo de estado. Cada um tem frase própria, e os dois que
 * pedem ação têm **botão de tentar de novo**.
 */

import { useEffect, useState, useCallback } from 'react'
import { Trash2, RotateCcw, AlertTriangle, Loader2, RefreshCw } from 'lucide-react'
import { fetchComTimeout } from '@/lib/http/fetch-com-timeout'
import { useEmpresa } from '@/lib/contexts/empresa-context'

interface Parecida { id: string; descricao: string; valor: number; vencimento: string | null; criadaEm: string }
interface Removida {
  auditId: string; removidaEm: string; quem: string; caminho: string
  descricao: string; valor: number; vencimento: string | null
  fornecedorNome: string | null; restauracaoCompleta: boolean; temAmarraDoEstoque: boolean
  parecidas: Parecida[]
}
interface Dia { dia: string; quantas: number; quem: string[]; caminhos: string[] }

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dia = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—')

interface Dados { removidas: Removida[]; porDia: Dia[] }
/** ⭐ o estado é EXPLÍCITO — ausência de dado nunca mais serve de estado */
type Estado =
  | { t: 'CARREGANDO' }
  | { t: 'SEM_EMPRESA' }
  | { t: 'FALHOU'; texto: string }
  | { t: 'OK'; dados: Dados }

export default function LixeiraPage() {
  /** ⭐ a PORTA ÚNICA da casa — o cookie é httpOnly e o cliente não tem como lê-lo */
  const { currentEmpresaId, loading: carregandoEmpresa } = useEmpresa()
  const [estado, setEstado] = useState<Estado>({ t: 'CARREGANDO' })
  const [busy, setBusy] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [venc, setVenc] = useState<Record<string, string>>({})

  const carregar = useCallback(async () => {
    // ⛔ enquanto o contexto resolve, é CARREGANDO — e ele SEMPRE termina
    if (carregandoEmpresa) { setEstado({ t: 'CARREGANDO' }); return }
    // ⛔ sem empresa é um estado com NOME e com saída, nunca um spinner parado
    if (!currentEmpresaId) { setEstado({ t: 'SEM_EMPRESA' }); return }
    setEstado({ t: 'CARREGANDO' })
    const r = await fetchComTimeout<Dados>(`/api/contas-a-pagar/removidas?empresaId=${currentEmpresaId}`)
    // ⛔ falha ao carregar NUNCA vira "nada foi removido" — erro disfarçado de vazio
    setEstado(r.ok && r.data
      ? { t: 'OK', dados: r.data }
      : { t: 'FALHOU', texto: r.erro ?? 'Não consegui carregar a lista.' })
  }, [currentEmpresaId, carregandoEmpresa])
  useEffect(() => { void carregar() }, [carregar])

  const dados = estado.t === 'OK' ? estado.dados : null

  async function restaurar(r: Removida) {
    setBusy(r.auditId); setErro(null)
    const body: Record<string, unknown> = { empresaId: currentEmpresaId, auditId: r.auditId }
    if (venc[r.auditId]) body.dueDate = venc[r.auditId]
    const res = await fetchComTimeout<{ ok: boolean }>('/api/contas-a-pagar/removidas/restaurar', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), timeoutMs: 30_000,
    })
    setBusy(null)
    if (!res.ok) { setErro(res.erro ?? 'Não consegui restaurar.'); return }
    await carregar()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <Trash2 className="h-5 w-5 shrink-0 text-slate-500" />
        <div>
          <h1 className="text-base font-semibold text-slate-900">Contas removidas</h1>
          <p className="text-xs text-slate-400">
            Tudo que saiu do Contas a Pagar, com data, quem e por qual caminho. Restaurar recria a conta —
            o vínculo com o banco não volta, porque quem diz que ela foi paga é a conciliação.
          </p>
        </div>
      </div>

      {estado.t === 'CARREGANDO' && (
        <p className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> carregando…
        </p>
      )}

      {/* ⛔ falha DIZ que não é "nada foi removido" — e carrega o gesto de tentar de novo */}
      {estado.t === 'FALHOU' && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {estado.texto} — <b>isso não quer dizer que nada foi removido.</b>
          <button type="button" onClick={() => void carregar()}
            className="ml-2 inline-flex items-center gap-1 font-semibold underline">
            <RefreshCw className="h-3 w-3" /> tentar de novo
          </button>
        </div>
      )}

      {/* ⚠️ "sem empresa" é ESTADO PRÓPRIO: o spinner aqui seria o defeito de novo */}
      {estado.t === 'SEM_EMPRESA' && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Escolha uma empresa no seletor do topo pra ver o que foi removido dela.
          <button type="button" onClick={() => void carregar()}
            className="ml-2 inline-flex items-center gap-1 font-semibold underline">
            <RefreshCw className="h-3 w-3" /> tentar de novo
          </button>
        </div>
      )}

      {/* ⭐ o mapa por dia responde "existe algo apagando sem meu gesto?" */}
      {dados?.porDia?.length ? (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">quando, quem e por onde</p>
          <ul className="mt-1.5 space-y-1">
            {dados.porDia.map((d) => (
              <li key={d.dia} className="flex flex-wrap gap-x-2 text-[12.5px] text-slate-700">
                <b className="tabular-nums">{dia(d.dia)}</b>
                <span>{d.quantas} conta{d.quantas === 1 ? '' : 's'}</span>
                <span className="text-slate-500">· {d.quem.join(', ')}</span>
                <span className="text-slate-400">· {d.caminhos.join(', ')}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {erro && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{erro}</p>}

      {dados?.removidas.length === 0 && (
        <p className="text-sm text-slate-500">Nenhuma conta removida nos últimos 90 dias.</p>
      )}

      <div className="space-y-2">
        {dados?.removidas.map((r) => (
          <div key={r.auditId} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <b className="text-[13.5px] text-slate-900">{r.descricao}</b>
              <span className="text-[13px] font-semibold tabular-nums text-slate-700">{brl(r.valor)}</span>
              {r.temAmarraDoEstoque && (
                <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">veio de uma nota</span>
              )}
            </div>
            <p className="mt-0.5 text-[11.5px] text-slate-500">
              removida em {dia(r.removidaEm)} por {r.quem} · {r.caminho}
              {r.vencimento ? ` · vencia ${dia(r.vencimento)}` : ''}
              {r.fornecedorNome ? ` · ${r.fornecedorNome}` : ''}
            </p>

            {/* ⭐⭐ a duplicata aparece ANTES do clique — descobrir depois seria tarde */}
            {r.parecidas.length > 0 && (
              <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2">
                <p className="flex items-center gap-1 text-[11.5px] font-bold text-amber-900">
                  <AlertTriangle className="h-3.5 w-3.5" /> já existe conta parecida — restaurar criaria duas
                </p>
                <ul className="mt-1 space-y-0.5">
                  {r.parecidas.map((p) => (
                    <li key={p.id} className="text-[11.5px] text-amber-800">
                      {p.descricao || '(sem descrição)'} · {brl(p.valor)} · vence {dia(p.vencimento)} · criada {dia(p.criadaEm)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {/* ⚠️ remoção antiga não guardou o vencimento — a tela PEDE em vez de inventar */}
              {!r.vencimento && (
                <label className="flex items-center gap-1.5 text-[11.5px] text-slate-600">
                  vencimento
                  <input type="date" value={venc[r.auditId] ?? ''}
                    onChange={(e) => setVenc((v) => ({ ...v, [r.auditId]: e.target.value }))}
                    className="rounded border border-slate-300 px-1.5 py-1 text-[11.5px]" />
                </label>
              )}
              <button type="button" disabled={busy === r.auditId || (!r.vencimento && !venc[r.auditId])}
                onClick={() => restaurar(r)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40">
                {busy === r.auditId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                restaurar
              </button>
              {!r.restauracaoCompleta && (
                <span className="text-[11px] text-slate-400">
                  remoção antiga — o sistema não guardava fornecedor/vencimento na época
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
