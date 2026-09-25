'use client'

/**
 * ⭐⭐⭐ INVESTIMENTOS — o espelho do empréstimo, do lado do ATIVO (25/09/2026).
 *
 * **Decisão do dono:** *"CAPITALIZACAO RG e PAGAMENTO CONSORCIO não são despesa nem conta a
 * pagar — são APORTES recorrentes que constroem patrimônio."*
 *
 * ⚠️ **O total aportado é DERIVADO** dos vínculos, nunca um campo gravado — a régua da casa
 * desde o saldo do empréstimo (*campo gravado envelhece*).
 */
import { useCallback, useEffect, useState } from 'react'
import { Loader2, TrendingUp, Plus } from 'lucide-react'
import { fetchComTimeout } from '@/lib/http/fetch-com-timeout'
import { useEmpresa } from '@/lib/contexts/empresa-context'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface ContratoDTO {
  id: string; nome: string; tipo: string; valorParcela: number; diaDoMes: number
  totalParcelas: number | null; parcelasPagasAoIniciar: number | null; ativo: boolean
  bankAccountNome: string | null; observacao: string | null
  totalAportado: number; aportes: number; parcelasPagasTotal: number; parcelasRestantes: number | null
  ultimoAporte: { competencia: string; valor: number; data: string } | null
}

/** ⛔ estado EXPLÍCITO — "ausência de dado" como estado é spinner eterno com outro nome (20/09) */
type Estado = 'CARREGANDO' | 'SEM_EMPRESA' | 'FALHOU' | 'OK'

export default function InvestimentosPage() {
  const { currentEmpresaId: empresaId, loading: carregandoEmpresa } = useEmpresa()
  const [estado, setEstado] = useState<Estado>('CARREGANDO')
  const [erro, setErro] = useState<string | null>(null)
  const [contratos, setContratos] = useState<ContratoDTO[]>([])
  const [tipos, setTipos] = useState<{ chave: string; rotulo: string }[]>([])
  const [abrindo, setAbrindo] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({ nome: '', tipo: 'CONSORCIO', valorParcela: '', diaDoMes: '', totalParcelas: '', parcelasPagasAoIniciar: '' })

  const carregar = useCallback(async () => {
    /**
     * ⛔ **O RETURN TOCA O ESTADO — sempre.** O guard de 20/09 pegou este exato padrão no
     * meu código: *"return antes do fetch sem setar estado = «carregando…» pra sempre"*.
     * Se o contexto da empresa travar, a tela fica refém de um pré-requisito que pode
     * nunca chegar — ***spinner eterno é a ausência fingindo progresso***.
     */
    if (carregandoEmpresa) { setEstado('CARREGANDO'); return }
    if (!empresaId) { setEstado('SEM_EMPRESA'); return }
    const r = await fetchComTimeout<{ contratos?: ContratoDTO[]; tipos?: { chave: string; rotulo: string }[] }>(
      `/api/empresas/${empresaId}/investimentos`,
    )
    if (!r.ok || !r.data?.contratos) { setErro(r.erro ?? 'Não consegui carregar os contratos.'); setEstado('FALHOU'); return }
    setContratos(r.data.contratos)
    if (r.data.tipos) setTipos(r.data.tipos)
    setErro(null); setEstado('OK')
  }, [empresaId, carregandoEmpresa])

  useEffect(() => { void carregar() }, [carregar])

  async function salvar() {
    if (!empresaId) return
    const valor = Number(form.valorParcela.replace(/\./g, '').replace(',', '.'))
    const dia = Number(form.diaDoMes)
    if (!form.nome.trim()) { setErro('Dê um nome ao contrato — é como você vai reconhecê-lo na conciliação.'); return }
    if (!Number.isFinite(valor) || valor <= 0) { setErro('O valor da parcela precisa ser maior que zero.'); return }
    if (!Number.isInteger(dia) || dia < 1 || dia > 31) { setErro('O dia do mês vai de 1 a 31.'); return }
    setSalvando(true); setErro(null)
    const r = await fetchComTimeout<{ ok?: boolean; erro?: string }>(`/api/empresas/${empresaId}/investimentos`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: form.nome.trim(), tipo: form.tipo, valorParcela: valor, diaDoMes: dia,
        totalParcelas: form.totalParcelas ? Number(form.totalParcelas) : null,
        parcelasPagasAoIniciar: form.parcelasPagasAoIniciar ? Number(form.parcelasPagasAoIniciar) : null,
      }),
    })
    setSalvando(false)
    if (!r.ok) { setErro(r.erro ?? 'Não consegui salvar o contrato.'); return }
    setForm({ nome: '', tipo: 'CONSORCIO', valorParcela: '', diaDoMes: '', totalParcelas: '', parcelasPagasAoIniciar: '' })
    setAbrindo(false)
    await carregar()
  }

  if (estado === 'CARREGANDO') {
    return <div className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> carregando…</div>
  }
  if (estado === 'SEM_EMPRESA') {
    return <div className="p-6 text-sm text-slate-500">Escolha uma empresa no topo pra ver os investimentos.</div>
  }

  return (
    <div className="mx-auto px-4 py-6 lg:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <TrendingUp className="h-5 w-5 text-emerald-600" />
        <h1 className="text-base font-bold text-slate-900">Investimentos</h1>
        <span className="hidden text-xs text-slate-400 lg:inline">
          consórcio e capitalização — aporte aumenta patrimônio, não é despesa
        </span>
        <button type="button" onClick={() => setAbrindo(!abrindo)}
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 text-xs font-bold text-emerald-700">
          <Plus className="h-3.5 w-3.5" /> novo contrato
        </button>
      </div>

      {/* ⛔ erro e vazio NUNCA juntos: com a carga falha o sistema NÃO SABE se está vazio (09/09) */}
      {erro && (
        <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[13px] text-amber-800">
          {erro}{' '}
          <button type="button" onClick={() => void carregar()} className="font-bold underline">tentar de novo</button>
        </div>
      )}

      {abrindo && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-[12px] font-bold text-slate-600">
              Nome do contrato
              <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="ex.: Consórcio Randon" maxLength={80}
                className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-2.5 text-[13px] font-normal" />
            </label>
            <label className="text-[12px] font-bold text-slate-600">
              Tipo
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-2 text-[13px] font-normal">
                {tipos.map((t) => <option key={t.chave} value={t.chave}>{t.rotulo}</option>)}
              </select>
            </label>
            <label className="text-[12px] font-bold text-slate-600">
              Valor da parcela
              <input value={form.valorParcela} onChange={(e) => setForm({ ...form, valorParcela: e.target.value })}
                inputMode="decimal" placeholder="1.478,51"
                className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-2.5 text-[13px] font-normal" />
            </label>
            <label className="text-[12px] font-bold text-slate-600">
              Dia do mês
              <input value={form.diaDoMes} onChange={(e) => setForm({ ...form, diaDoMes: e.target.value })}
                inputMode="numeric" placeholder="9"
                className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-2.5 text-[13px] font-normal" />
            </label>
            {/* ⚠️ os dois opcionais: o dono pode entrar no meio e não saber o total */}
            <label className="text-[12px] font-bold text-slate-600">
              Total de parcelas <span className="font-normal text-slate-400">(opcional)</span>
              <input value={form.totalParcelas} onChange={(e) => setForm({ ...form, totalParcelas: e.target.value })}
                inputMode="numeric" placeholder="80"
                className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-2.5 text-[13px] font-normal" />
            </label>
            <label className="text-[12px] font-bold text-slate-600">
              Já pagas antes do sistema <span className="font-normal text-slate-400">(opcional)</span>
              <input value={form.parcelasPagasAoIniciar} onChange={(e) => setForm({ ...form, parcelasPagasAoIniciar: e.target.value })}
                inputMode="numeric" placeholder="12"
                className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-2.5 text-[13px] font-normal" />
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={salvando} onClick={() => void salvar()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[13px] font-bold text-white disabled:opacity-50">
              {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} salvar contrato
            </button>
            <button type="button" onClick={() => { setAbrindo(false); setErro(null) }}
              className="h-9 rounded-lg border border-slate-300 px-3 text-[13px] font-bold text-slate-600">cancelar</button>
          </div>
        </div>
      )}

      {estado === 'OK' && contratos.length === 0 && !abrindo && (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-6 text-center">
          <p className="text-[13px] font-bold text-slate-700">Nenhum contrato cadastrado ainda</p>
          <p className="mt-1 text-[12px] text-slate-500">
            Cadastre o consórcio ou a capitalização e o aporte passa a ter um gesto próprio na
            conciliação (📈), em vez de virar despesa.
          </p>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {contratos.map((c) => (
          <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[14px] font-bold text-slate-900">{c.nome}</p>
                <p className="text-[11px] uppercase tracking-wide text-slate-400">
                  {tipos.find((t) => t.chave === c.tipo)?.rotulo ?? c.tipo}
                  {c.bankAccountNome ? ` · ${c.bankAccountNome}` : ''}
                </p>
              </div>
              {!c.ativo && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">encerrado</span>}
            </div>
            <p className="mt-3 text-[20px] font-extrabold tabular-nums text-emerald-700">{brl(c.totalAportado)}</p>
            <p className="text-[11px] text-slate-500">
              {/* ⛔ "já aportado" conta SÓ o que passou pelo gesto — o declarado vive à parte */}
              já aportado por aqui em {c.aportes} {c.aportes === 1 ? 'parcela' : 'parcelas'}
            </p>
            <div className="mt-3 border-t border-slate-100 pt-2 text-[12px] text-slate-600">
              <p>{brl(c.valorParcela)} · todo dia {c.diaDoMes}</p>
              {c.parcelasRestantes != null ? (
                <p className="text-slate-500">
                  {c.parcelasPagasTotal} de {c.totalParcelas} pagas · faltam {c.parcelasRestantes}
                </p>
              ) : (
                /* ⛔ sem total conhecido, NÃO inventa "faltam N" — a ausência se diz */
                <p className="text-slate-400">total de parcelas não informado</p>
              )}
              {c.ultimoAporte && (
                <p className="mt-1 text-slate-500">último: {c.ultimoAporte.competencia} · {brl(c.ultimoAporte.valor)}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
