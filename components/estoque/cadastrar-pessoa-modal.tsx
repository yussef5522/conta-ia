'use client'

// ⭐⭐ CADASTRAR GENTE EM UM GESTO (06/09/2026).
//
// **A régua do dono:** *"Contratei gente nova? Abro a tela, nome + função + PIN, e ela produz
// no mesmo dia."* Uma tela, sem passo dois, sem RBAC à vista — **a FUNÇÃO já diz tudo**.
//
// ⚠️ O campo que aparece depende da função, e é isso que mata a confusão: quem é da cozinha
// **não tem e-mail no sistema** (entra por PIN no tablet); quem é gerente **não tem PIN**
// (entra com a conta dele). Mostrar os dois campos sempre convidaria a preencher os dois.

import { useState } from 'react'
import { Loader2, Check, Copy, KeyRound, Mail } from 'lucide-react'
import { FUNCOES, DESCRICAO_DA_FUNCAO, validarCadastro, type FuncaoDaPessoa } from '@/lib/stock/producao/cadastrar-pessoa'

interface Resultado { funcao: string; mensagem: string; inviteUrl?: string | null; emailSent?: boolean }

export function CadastrarPessoaModal({ companyId, aoFechar, aoCadastrar }: {
  companyId: string
  aoFechar: () => void
  aoCadastrar: () => void
}) {
  const [nome, setNome] = useState('')
  const [funcao, setFuncao] = useState<FuncaoDaPessoa | ''>('')
  const [pin, setPin] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pronto, setPronto] = useState<Resultado | null>(null)
  const [copiado, setCopiado] = useState(false)

  /**
   * ⭐ PIN SORTEADO, e não sequencial: a pessoa que cadastra tende a usar 1111, 2222, 3333
   * pra "facilitar" — e aí o PIN deixa de dizer quem apertou o botão, que é a única coisa
   * que ele faz. O servidor recusa os óbvios; aqui a gente evita a briga.
   */
  const sortear = () => {
    let p = ''
    do { p = String(Math.floor(1000 + Math.random() * 9000)) } while (/^(\d)\1{3}$/.test(p) || p === '1234' || p === '4321')
    setPin(p)
  }

  async function salvar() {
    // ⚠️ a MESMA validação do servidor (lib pura): duas réguas divergiriam, e a tela
    // aprovaria o que o servidor recusa — o pior tipo de formulário.
    const e = validarCadastro({ nome, funcao, pin, email })
    if (e) { setErro(e); return }
    setBusy(true); setErro(null)
    try {
      const r = await fetch(`/api/empresas/${companyId}/estoque/equipe`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nome.trim(), funcao, pin: pin || undefined, email: email.trim() || undefined }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui cadastrar.'); return }
      setPronto(j)
      aoCadastrar()
    } finally { setBusy(false) }
  }

  // ── depois de cadastrar ────────────────────────────────────────────────────────────
  if (pronto) {
    return (
      <Moldura aoFechar={aoFechar}>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100"><Check className="h-5 w-5 text-emerald-700" /></div>
        <p className="mt-3 text-base font-medium text-slate-900">{nome.trim()} está cadastrada</p>
        <p className="mt-1 text-sm text-slate-500">{pronto.mensagem}</p>

        {pronto.funcao === 'COZINHA' && (
          // ⭐ o PIN aparece UMA vez, aqui, e nunca mais: depois de salvo ele vira hash e nem
          // o dono consegue ver. Se ela esquecer, o caminho é trocar — não "recuperar".
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">PIN de {nome.trim()}</p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-[0.3em] text-slate-900">{pin}</p>
            <p className="mt-1 text-[11px] text-slate-500">Anote agora — depois de salvo ninguém consegue ver de novo, nem você.</p>
          </div>
        )}

        {pronto.funcao === 'GERENTE_ESTOQUE' && pronto.inviteUrl && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">
              {pronto.emailSent ? 'Link do convite (se o e-mail não chegar)' : 'Mande este link'}
            </p>
            <p className="mt-0.5 break-all font-mono text-[11px] text-slate-600">{pronto.inviteUrl}</p>
            <button type="button"
              onClick={() => { navigator.clipboard?.writeText(pronto.inviteUrl!); setCopiado(true) }}
              className="mt-2 inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-white">
              <Copy className="h-3 w-3" /> {copiado ? 'copiado' : 'copiar link'}
            </button>
            {/* ⛔ o aviso que nasceu do incidente de 06/09: num aparelho compartilhado, o link
                do convite aberto na sessão de outra pessoa não deve ser aceito ali. */}
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              Peça pra ele abrir <strong>no aparelho dele</strong>. Se abrir num aparelho onde outra pessoa está
              logada, a tela avisa e oferece sair antes de aceitar.
            </p>
          </div>
        )}

        <button onClick={aoFechar} className="mt-5 w-full rounded-lg bg-[#185FA5] py-2.5 text-sm font-medium text-white hover:bg-[#0F4A8C]">
          Fechar
        </button>
      </Moldura>
    )
  }

  // ── o formulário ───────────────────────────────────────────────────────────────────
  return (
    <Moldura aoFechar={aoFechar}>
      <p className="text-base font-medium text-slate-900">Adicionar pessoa</p>

      <label className="mt-4 block text-xs text-slate-500">Nome
        <input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus placeholder="ex: Carlise"
          className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" />
      </label>

      <p className="mt-4 text-xs text-slate-500">Função</p>
      <div className="mt-1.5 space-y-2">
        {FUNCOES.map((f) => {
          const d = DESCRICAO_DA_FUNCAO[f]
          const ativa = funcao === f
          return (
            <button key={f} type="button" onClick={() => { setFuncao(f); setErro(null) }}
              className={`w-full rounded-lg border p-3 text-left transition ${ativa ? 'border-[#185FA5] bg-[#185FA5]/5' : 'border-slate-200 hover:bg-slate-50'}`}>
              <span className="flex items-center gap-2">
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${ativa ? 'border-[#185FA5]' : 'border-slate-300'}`}>
                  {ativa && <span className="h-2 w-2 rounded-full bg-[#185FA5]" />}
                </span>
                <span className="text-sm font-medium text-slate-800">{d.titulo}</span>
              </span>
              {/* ⚠️ a explicação vem da LIB, não daqui: a próxima tela que cadastrar gente
                  descreve a mesma função com as mesmas palavras. */}
              <span className="mt-1 block pl-6 text-[11px] leading-relaxed text-slate-500">{d.explica}</span>
            </button>
          )
        })}
      </div>

      {funcao === 'COZINHA' && (
        <label className="mt-4 block text-xs text-slate-500">
          <span className="flex items-center gap-1"><KeyRound className="h-3 w-3" /> PIN de 4 dígitos</span>
          <span className="mt-1 flex items-center gap-2">
            <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              inputMode="numeric" placeholder="4726"
              className="h-10 w-28 rounded-lg border border-slate-300 px-3 text-center text-lg tabular-nums tracking-[0.25em]" />
            <button type="button" onClick={sortear} className="rounded-lg border border-slate-300 px-2.5 py-2 text-xs text-slate-600 hover:bg-slate-50">sortear</button>
          </span>
          <span className="mt-1 block text-[11px] text-slate-400">É como ela assina o trabalho dela no tablet.</span>
        </label>
      )}

      {funcao === 'GERENTE_ESTOQUE' && (
        <label className="mt-4 block text-xs text-slate-500">
          <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> E-mail</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" placeholder="nome@email.com"
            className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" />
          <span className="mt-1 block text-[11px] text-slate-400">Ele recebe um convite e cria a própria senha.</span>
        </label>
      )}

      {erro && <p className="mt-3 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700">{erro}</p>}

      <div className="mt-5 flex gap-2">
        <button onClick={aoFechar} className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
        <button onClick={salvar} disabled={busy || !nome.trim() || !funcao}
          className="flex-1 rounded-lg bg-[#185FA5] py-2.5 text-sm font-medium text-white hover:bg-[#0F4A8C] disabled:opacity-50">
          {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Cadastrar'}
        </button>
      </div>
    </Moldura>
  )
}

function Moldura({ children, aoFechar }: { children: React.ReactNode; aoFechar: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={aoFechar}>
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}
