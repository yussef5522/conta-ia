'use client'

// ⭐⭐ IMPORTAR O EXTRATO DA CONTA PF (13/09) — o mesmo gesto da PJ: escolhe a conta, sobe o
// OFX, VÊ o que vai acontecer, confirma.
//
// ⛔ O preview e o confirm rodam o MESMO motor com o MESMO arquivo — a tela não tem como
// mostrar uma coisa e a gravação fazer outra (a régua de 13/08).

import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { fetchJson } from '@/lib/http/fetch-json'

interface Preview {
  bloqueio: { erro: string; code: string } | null
  aviso: string | null
  aprender: { bankCode: string | null; accountNumber: string | null } | null
  banco: { rotulo: string; conhecido: boolean }
  periodo: { de: string | null; ate: string | null }
  novas: { fitid: string; data: string; valorComSinal: number; memo: string }[]
  jaImportadas: number
  casadas: { linha: { memo: string; valorComSinal: number }; temPonte: boolean; porQue: string }[]
  ambiguas: { linha: { memo: string; valorComSinal: number }; porQue: string }[]
  agendadas: { linha: { memo: string; valorComSinal: number }; porQue: string }[]
  conferencia: { estado: string; frase: string }
  pagamentosDeFatura: { fitid: string; cardNome: string; porQue: string }[]
  pagamentosAmbiguos: { fitid: string; faturas: { cardNome: string }[] }[]
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface ContaPF {
  id: string; name: string; bankName: string | null; balance: number
  bankCode: string | null; accountNumber: string | null
  ledgerBal: number | null; ledgerBalDate: string | null
}

export default function ImportarExtratoPFPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const sp = useSearchParams()
  // ⚠️ REGRA 9: todo hook antes de qualquer early return
  const [contas, setContas] = useState<ContaPF[]>([])
  // ⭐ `?conta=` vem do card — o gesto começa lá e chega aqui já apontado
  const [contaId, setContaId] = useState(sp.get('conta') ?? '')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [p, setP] = useState<Preview | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [aprender, setAprender] = useState(true)

  const carregarContas = useCallback(async () => {
    const r = await fetchJson<{ accounts?: ContaPF[] }>(`/api/perfis/${id}/contas`)
    if (!r.ok || !r.data?.accounts) return
    setContas(r.data.accounts)
    // ⚠️ só escolhe sozinho quando o dono não veio apontando de lugar nenhum
    setContaId((atual) => atual || r.data!.accounts![0]?.id || '')
  }, [id])
  useEffect(() => { void carregarContas() }, [carregarContas])

  const conta = contas.find((c) => c.id === contaId) ?? null

  async function enviar(confirmar: boolean) {
    if (!arquivo || !contaId) return setErro('Escolha a conta e o arquivo.')
    setOcupado(true); setErro(null)
    const fd = new FormData()
    fd.append('arquivo', arquivo); fd.append('contaId', contaId)
    if (confirmar) fd.append('aprenderConta', String(aprender))
    const r = await fetchJson<Preview & { criadas?: number }>(
      `/api/perfis/${id}/extrato-conta/${confirmar ? 'confirm' : 'preview'}`, { method: 'POST', body: fd })
    setOcupado(false)
    if (!r.ok || !r.data) return setErro(r.message ?? 'não consegui ler o arquivo')
    if (confirmar) return router.push(`/perfis/${id}/mes`)
    setP(r.data)
  }

  return (
    <div className="mx-auto max-w-[720px] pb-12">
      <div className="mb-3 flex items-center gap-2">
        <Link href={`/perfis/${id}/contas`} className="text-sm text-slate-500">←</Link>
        <div className="flex-1">
          <h1 className="text-base font-bold text-slate-800">Importar extrato da conta</h1>
          <p className="text-xs text-slate-400">o OFX do banco — o mesmo gesto da empresa, com a conferência de saldo</p>
        </div>
      </div>

      {/* ⭐ "DENTRO DA CONTA": com `?conta=` a tela abre falando DAQUELA conta — saldo,
          conferência e se ela já tem identidade pra trava morder. */}
      {conta && (
        <div className="mb-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-[13px] font-bold text-slate-800">{conta.name}
            {conta.bankName && <small className="ml-1.5 font-normal text-slate-400">{conta.bankName}</small>}
          </p>
          <p className="mt-0.5 text-[19px] font-bold tabular-nums text-slate-900">{brl(conta.balance)}</p>
          <p className="text-[11.5px]" style={{
            color: conta.ledgerBal == null ? '#94a3b8'
              : Math.abs(conta.balance - conta.ledgerBal) <= 0.02 ? '#177245' : '#b45309',
          }}>
            {conta.ledgerBal == null
              ? '○ nunca conferida com o banco'
              : Math.abs(conta.balance - conta.ledgerBal) <= 0.02
                ? `✓ confere com o banco${conta.ledgerBalDate ? ` em ${conta.ledgerBalDate.slice(8, 10)}/${conta.ledgerBalDate.slice(5, 7)}` : ''}`
                : `⚠ difere do banco em ${brl(Math.abs(conta.balance - conta.ledgerBal))}`}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            {conta.bankCode || conta.accountNumber
              ? `identificada: ${[conta.bankCode, conta.accountNumber].filter(Boolean).join(' · ')} — recuso OFX de outra conta`
              : '⚠ sem identificação ainda — o 1º import aprende quem ela é, e daí em diante recuso arquivo de outra conta'}
          </p>
        </div>
      )}

      <div className="mb-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5">
        <label className="mb-1 block text-[12px] font-semibold text-slate-600">Conta</label>
        <select value={contaId} onChange={(e) => { setContaId(e.target.value); setP(null) }} className="mb-3 h-9 w-full rounded-lg border border-slate-300 px-2 text-sm">
          {contas.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label className="mb-1 block text-[12px] font-semibold text-slate-600">Arquivo OFX</label>
        <input type="file" accept=".ofx,.OFX" onChange={(e) => { setArquivo(e.target.files?.[0] ?? null); setP(null) }} className="mb-3 w-full text-sm" />
        <button onClick={() => void enviar(false)} disabled={ocupado || !arquivo}
          className="h-9 rounded-lg bg-[#534AB7] px-4 text-sm font-semibold text-white disabled:opacity-40">
          {ocupado ? 'lendo…' : 'Ver o que vai entrar'}
        </button>
      </div>

      {erro && <div className="mb-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-[13px] text-red-700">{erro}</div>}

      {p?.bloqueio && (
        // ⛔ a trava da conta errada — a que em 12/08 impediu 355 tx de entrarem na conta errada
        <div className="mb-3 rounded-xl border border-red-400 bg-red-50 px-4 py-3 text-[13px] text-red-800">
          <b>Não importei.</b> {p.bloqueio.erro}
        </div>
      )}

      {p && !p.bloqueio && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5">
          <p className="mb-2 text-[13px] text-slate-600">
            <b>{p.banco.rotulo}</b>{p.periodo.de && ` · ${p.periodo.de} a ${p.periodo.ate}`}
          </p>
          {p.aviso && <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">{p.aviso}</p>}

          <Linha n={p.novas.length} rotulo="lançamentos novos" cor="#177245" />
          {/* ⭐ O CASAMENTO — o que o dono precisa ver pra confiar que não duplicou */}
          {p.casadas.length > 0 && (
            <div className="my-2 rounded-lg border border-[#534AB7] bg-[#eeecfa] px-3 py-2">
              <p className="text-[12.5px] font-bold text-[#3d3680]">
                {p.casadas.length} já estavam lançados — <b>casam, não duplicam</b>
              </p>
              {p.casadas.slice(0, 6).map((c, i) => (
                <p key={i} className="mt-1 text-[11.5px] text-[#3d3680]">
                  {brl(c.linha.valorComSinal)} · {c.linha.memo.slice(0, 28)} — {c.porQue}
                </p>
              ))}
            </div>
          )}
          <Linha n={p.jaImportadas} rotulo="já importados antes" cor="#6b7280" />
          {p.ambiguas.length > 0 && (
            <div className="my-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
              <b>{p.ambiguas.length} precisam de você:</b> {p.ambiguas[0].porQue} — vão entrar como novos
            </div>
          )}
          {p.agendadas.length > 0 && <Linha n={p.agendadas.length} rotulo="o banco listou e ainda não debitou (ficam de fora)" cor="#6b7280" />}

          {p.pagamentosDeFatura.length > 0 && (
            <div className="my-2 rounded-lg bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800">
              <b>{p.pagamentosDeFatura.length} pagamento(s) de fatura reconhecido(s):</b>{' '}
              {p.pagamentosDeFatura.map((x) => x.cardNome).join(', ')} — o cartão vira <b>paga ✓</b> sozinho
            </div>
          )}
          {p.pagamentosAmbiguos.length > 0 && (
            <p className="my-2 text-[12px] text-amber-700">
              {p.pagamentosAmbiguos.length} débito(s) batem com mais de uma fatura — <b>você aponta depois</b>
            </p>
          )}

          <p className="mt-2 rounded-lg px-3 py-2 text-[12.5px]"
            style={{
              background: p.conferencia.estado === 'BATE' ? '#e6f4ec' : p.conferencia.estado === 'DIVERGE' ? '#fdf3e3' : '#f1f5f9',
              color: p.conferencia.estado === 'BATE' ? '#177245' : p.conferencia.estado === 'DIVERGE' ? '#b45309' : '#475569',
            }}>
            {p.conferencia.estado === 'BATE' ? '✓ ' : p.conferencia.estado === 'DIVERGE' ? '⚠ ' : '○ '}{p.conferencia.frase}
          </p>

          {p.aprender && (
            <label className="mt-2 flex items-start gap-2 text-[12px] text-slate-600">
              <input type="checkbox" checked={aprender} onChange={(e) => setAprender(e.target.checked)} className="mt-0.5" />
              <span>
                guardar <b>{p.aprender.bankCode ?? ''}{p.aprender.bankCode && p.aprender.accountNumber ? ' · ' : ''}{p.aprender.accountNumber ?? ''}</b> nesta conta
                — é o que faz o sistema <b>recusar</b> um OFX de outra conta da próxima vez
              </span>
            </label>
          )}

          <button onClick={() => void enviar(true)} disabled={ocupado}
            className="mt-3 h-9 w-full rounded-lg bg-[#534AB7] px-4 text-sm font-semibold text-white disabled:opacity-40">
            {ocupado ? 'gravando…' : `Confirmar — ${p.novas.length} novo(s), ${p.casadas.length} casado(s)`}
          </button>
        </div>
      )}
    </div>
  )
}

function Linha({ n, rotulo, cor }: { n: number; rotulo: string; cor: string }) {
  if (!n) return null
  return <p className="py-0.5 text-[13px]"><b style={{ color: cor }}>{n}</b> <span className="text-slate-600">{rotulo}</span></p>
}
