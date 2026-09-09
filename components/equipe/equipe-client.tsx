'use client'

// ⭐⭐ EQUIPE — UMA LISTA COM TODO MUNDO (06/09/2026).
//
// **O pedido do dono:** *"UMA lista com TODO MUNDO — quem loga e quem usa PIN — nome, função
// e tipo de acesso."* É o padrão de Toast/Square/7shifts: a tela mostra **pessoas**, e o
// mecanismo de acesso é uma COLUNA, não uma tela separada.
//
// ⛔ E é a tela que faltava: o cadastro de gente vivia atrás da palavra "setores", em cinza
// de 11px, DENTRO do formulário de nova ordem da Produção — e só aparecia depois de clicar
// em "nova ordem" E ter pelo menos uma ficha. Medido: o `href` não existia no HTML da tela
// de Produção. O dono, com as 37 chaves do OWNER, não tinha caminho nenhum até ela.

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, UserPlus, KeyRound, Mail, Clock, Tablet, AlertTriangle, Users, UserMinus } from 'lucide-react'
import { CadastrarPessoaModal } from '@/components/estoque/cadastrar-pessoa-modal'

interface Pessoa {
  id: string; vinculoId: string | null; nome: string; funcao: string
  tipo: 'LOGIN' | 'PIN' | 'CONVITE_PENDENTE' | 'APARELHO' | 'SEM_ACESSO' | 'INATIVO'
  email: string | null; detalhe: string; colaboradorId: string | null; ehAparelho: boolean
}
interface Resumo { total: number; cozinha: number; comLogin: number; convitesPendentes: number; semAcesso: number; aparelhos: number; inativos: number }

const SELO: Record<Pessoa['tipo'], { icone: typeof Mail; cor: string }> = {
  LOGIN: { icone: Mail, cor: 'text-slate-600' },
  PIN: { icone: KeyRound, cor: 'text-emerald-700' },
  CONVITE_PENDENTE: { icone: Clock, cor: 'text-amber-700' },
  APARELHO: { icone: Tablet, cor: 'text-slate-400' },
  SEM_ACESSO: { icone: AlertTriangle, cor: 'text-rose-600' },
  INATIVO: { icone: UserMinus, cor: 'text-slate-400' },
}

export function EquipeClient({ empresaId, empresaNome, filtro, podeGerenciarAcessos = true }: {
  empresaId: string; empresaNome: string; filtro?: 'cozinha'
  /**
   * ⭐ Quem tem `user.invite` gerencia ACESSO AO SISTEMA (convite, papel, aparelho).
   * O gerente de estoque **não** tem — ele gerencia COLABORADOR (nome, PIN, ativo).
   *
   * ⛔ A fronteira do dono: *"eles gerenciam COLABORADOR (gente de PIN), NUNCA usuário de
   * login"*. Aqui ela vira botão desabilitado COM O MOTIVO; no servidor, `user.invite`
   * recusa igual. Esconder o botão seria pior: some a explicação junto.
   */
  podeGerenciarAcessos?: boolean
}) {
  const [pessoas, setPessoas] = useState<Pessoa[] | null>(null)
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [abrir, setAbrir] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [soCozinha, setSoCozinha] = useState(filtro === 'cozinha')
  const [verInativos, setVerInativos] = useState(false)
  // ⚠️ TROCAR O PIN existia na tela velha e não podia sumir: quem esquece os 4 dígitos não
  // consegue entrar no tablet, e o PIN é hash — nem o dono consegue vê-lo pra lembrar.
  // Sem este gesto, esquecer o PIN viraria beco sem saída.
  const [editando, setEditando] = useState<string | null>(null)
  const [pinNovo, setPinNovo] = useState('')
  const [erroPin, setErroPin] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // ⭐ A MARCA DE APARELHO — quem decide é o dono, nunca uma heurística (a régua antiga
  // deduzia do papel e chamou uma PESSOA de máquina).
  // ⭐ tirar da produção / trazer de volta. O erro do servidor vai INTEIRO pra tela: ele diz
  // QUANTAS etapas impedem, e isso é o que resolve.
  const mudarAtivo = async (colaboradorId: string, ativo: boolean) => {
    setBusy(true); setErro(null)
    try {
      const r = await fetch(`/api/empresas/${empresaId}/equipe/colaborador`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colaboradorId, ativo }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui salvar.'); return }
      carregar()
    } finally { setBusy(false) }
  }

  const marcarAparelho = async (vinculoId: string, ehAparelho: boolean) => {
    setBusy(true)
    try {
      const r = await fetch(`/api/empresas/${empresaId}/equipe/aparelho`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vinculoId, ehAparelho }),
      })
      if (!r.ok) { setErro('Não consegui salvar a marca de aparelho.'); return }
      carregar()
    } finally { setBusy(false) }
  }

  const salvarPin = async (colaboradorId: string, pin?: string) => {
    setBusy(true); setErroPin(null)
    try {
      // ⭐ REGRA 4: a MESMA rota que já existia — não nasce um segundo jeito de gravar PIN.
      const r = await fetch(`/api/empresas/${empresaId}/estoque/producao/cadastros/pin`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pin ? { colaboradorId, pin } : { colaboradorId }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErroPin(j?.erro ?? 'Não consegui salvar o PIN.'); return }
      setEditando(null); setPinNovo(''); carregar()
    } finally { setBusy(false) }
  }

  const carregar = () =>
    fetch(`/api/empresas/${empresaId}/equipe${verInativos ? '?inativos=1' : ''}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((j) => { setErro(null); return j })
      .then((j) => { setPessoas(j.pessoas ?? []); setResumo(j.resumo ?? null) })
      .catch(async (r: Response | undefined) => {
        // ⚠️ a mensagem DIZ o que houve: 403 é permissão, não "falhou". Antes tudo virava
        // "não consegui carregar" e o dono não sabia se era acesso ou rede.
        const j = r && typeof r.json === 'function' ? await r.json().catch(() => null) : null
        setErro(r?.status === 403
          ? `Sem permissão pra ver a equipe${j?.permission ? ` (falta ${j.permission})` : ''}.`
          : 'Não consegui carregar a equipe. Tenta de novo.')
        setPessoas([])
      })
  useEffect(() => { carregar() }, [empresaId, verInativos]) // eslint-disable-line react-hooks/exhaustive-deps

  const lista = (pessoas ?? []).filter((p) => !soCozinha || p.funcao === 'Cozinha / produção')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Users className="h-5 w-5 text-slate-400" />
        <h1 className="text-base font-semibold text-slate-900">Equipe</h1>
        <p className="hidden flex-1 truncate text-xs text-slate-400 lg:block">{empresaNome}</p>
        <button onClick={() => setAbrir(true)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-[#185FA5] px-3 py-2 text-sm font-medium text-white hover:bg-[#0F4A8C]">
          <UserPlus className="h-4 w-4" /> adicionar pessoa
        </button>
      </div>

      {/* ⚠️ o que a tela ensina antes de listar: as duas formas de entrar existem de
          propósito, e o dono não precisa escolher mecanismo — a FUNÇÃO escolhe. */}
      <p className="rounded-lg bg-slate-50 p-2.5 text-[11px] leading-relaxed text-slate-500">
        Quem é da <strong>cozinha</strong> entra pelo tablet com um PIN — não tem conta nem e-mail.
        Quem é <strong>gerente</strong> recebe um convite e cria a própria senha. A função decide; você não monta permissão.
      </p>

      {/* ⛔⛔ A FRONTEIRA, ESCRITA (08/09) — decisão do dono: o gerente de estoque gerencia
          COLABORADOR, nunca usuário de login. Dizer isso ANTES é o que evita ele tentar,
          apanhar de um 403 e achar que o sistema quebrou. */}
      {!podeGerenciarAcessos && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] leading-relaxed text-amber-900">
          Você gerencia a <strong>equipe de cozinha</strong>: adicionar pessoa, trocar o PIN de
          quem esqueceu, ativar e inativar. <strong>Convite, função e marcar aparelho</strong> são
          acessos ao sistema — <strong>só o dono gerencia acessos ao sistema</strong>.
        </p>
      )}

      {resumo && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
          <span><strong className="tabular-nums text-slate-800">{resumo.total}</strong> pessoas</span>
          <span><strong className="tabular-nums text-slate-800">{resumo.cozinha}</strong> na cozinha</span>
          <span><strong className="tabular-nums text-slate-800">{resumo.comLogin}</strong> com login</span>
          {/* ⚠️ pendência só aparece quando existe: contador zerado vira paisagem */}
          {resumo.convitesPendentes > 0 && <span className="text-amber-700">{resumo.convitesPendentes} convite(s) pendente(s)</span>}
          {resumo.semAcesso > 0 && <span className="text-rose-600">{resumo.semAcesso} sem PIN</span>}
          {resumo.aparelhos > 0 && <span className="text-slate-400">{resumo.aparelhos} aparelho</span>}
        </div>
      )}

      {(pessoas?.length ?? 0) > 0 && (
        <label className="flex items-center gap-1.5 text-xs text-slate-500">
          <input type="checkbox" checked={soCozinha} onChange={(e) => setSoCozinha(e.target.checked)} /> só a cozinha
          {/* ⚠️ inativo fica ESCONDIDO por padrão (não é trabalho do dia) mas tem caminho de
              volta — sem isso, inativar seria porta sem maçaneta. */}
          <span className="ml-3 flex items-center gap-1.5">
            <input type="checkbox" checked={verInativos} onChange={(e) => setVerInativos(e.target.checked)} /> mostrar inativos
            {resumo && resumo.inativos > 0 && <span className="text-slate-400">({resumo.inativos})</span>}
          </span>
        </label>
      )}

      {erro && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{erro}</p>}

      {/* ⛔⛔ ERRO E VAZIO NUNCA JUNTOS (09/09/2026) — o dono viu "Não consegui carregar a
          equipe" **e** "ninguém da cozinha cadastrado ainda" na mesma tela, com 17 pessoas no
          banco. É o "sucesso disfarçado" ao contrário: **erro disfarçado de vazio**. Quando a
          carga falhou, o sistema NÃO SABE se está vazio — e afirmar que está é inventar. */}
      {pessoas === null ? (
        <div className="flex items-center gap-2 p-6 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> carregando…</div>
      ) : erro ? null : lista.length === 0 ? (
        <Card><CardContent className="p-6 text-center">
          <p className="text-sm text-slate-600">{soCozinha ? 'Ninguém da cozinha cadastrado ainda.' : 'Nenhuma pessoa ainda.'}</p>
          <p className="mt-1 text-xs text-slate-400">Use “adicionar pessoa” — nome, função e pronto.</p>
        </CardContent></Card>
      ) : (
        <Card><CardContent className="p-0">
          <ul className="divide-y divide-slate-100">
            {lista.map((p) => {
              const Icone = SELO[p.tipo].icone
              return (
                <li key={`${p.tipo}-${p.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5">
                  <span className={`min-w-[9rem] flex-1 text-[13px] font-medium ${p.ehAparelho ? 'text-slate-500' : 'text-slate-900'}`}>
                    {p.nome}
                  </span>
                  <span className="min-w-[10rem] text-[13px] text-slate-600">{p.funcao}</span>
                  <span className={`flex items-center gap-1.5 text-xs ${SELO[p.tipo].cor}`}>
                    <Icone className="h-3.5 w-3.5" /> {p.detalhe}
                  </span>
                  {/* ⭐ só quem é colaborador de produção tem PIN pra mexer */}
                  {p.colaboradorId && p.tipo !== 'INATIVO' && (editando === p.colaboradorId ? (
                    <span className="flex w-full items-center gap-1.5 sm:w-auto">
                      <input value={pinNovo} onChange={(e) => setPinNovo(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        inputMode="numeric" placeholder="4 dígitos" autoFocus
                        aria-label={`PIN novo de ${p.nome}`} title={`PIN novo de ${p.nome}`}
                        className="h-7 w-24 rounded border border-slate-300 px-2 text-center text-xs tabular-nums" />
                      <button onClick={() => salvarPin(p.colaboradorId!, pinNovo)} disabled={busy || pinNovo.length !== 4}
                        className="rounded bg-[#185FA5] px-2 py-1 text-[11px] font-medium text-white disabled:opacity-40">salvar</button>
                      <button onClick={() => { setEditando(null); setPinNovo(''); setErroPin(null) }} className="text-[11px] text-slate-400">cancelar</button>
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-[11px]">
                      <button onClick={() => { setEditando(p.colaboradorId); setPinNovo(''); setErroPin(null) }}
                        className="text-[#185FA5] hover:underline">{p.tipo === 'PIN' ? 'trocar PIN' : 'definir PIN'}</button>
                      {p.tipo === 'PIN' && (
                        <button onClick={() => salvarPin(p.colaboradorId!)} className="text-slate-400 hover:text-rose-600">remover</button>
                      )}
                    </span>
                  ))}
                  {p.colaboradorId && editando === p.colaboradorId && erroPin && (
                    <p className="w-full text-[11px] text-rose-600">{erroPin}</p>
                  )}
                  {/* ⚠️ só quem LOGA pode ser aparelho — quem entra por PIN é pessoa por
                      definição (não existe tablet com PIN próprio). */}
                  {/* tirar da produção / trazer de volta — só colaborador tem isso */}
                  {p.colaboradorId && (
                    <button onClick={() => mudarAtivo(p.colaboradorId!, p.tipo === 'INATIVO')} disabled={busy}
                      className="text-[11px] text-slate-400 hover:text-slate-700">
                      {p.tipo === 'INATIVO' ? 'trazer de volta' : 'tirar da produção'}
                    </button>
                  )}
                  {p.vinculoId && (
                    <button onClick={() => marcarAparelho(p.vinculoId!, !p.ehAparelho)}
                      disabled={busy || !podeGerenciarAcessos}
                      title={podeGerenciarAcessos ? undefined : 'só o dono gerencia acessos ao sistema'}
                      className="text-[11px] text-slate-400 hover:text-slate-700">
                      {p.ehAparelho ? 'não é aparelho' : 'marcar como aparelho'}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </CardContent></Card>
      )}

      {/* ⭐ o mesmo modal de um gesto — REGRA 4: não existe um segundo formulário de cadastro
          de gente, senão os dois divergem na primeira regra nova. */}
      {abrir && <CadastrarPessoaModal companyId={empresaId} aoFechar={() => setAbrir(false)} aoCadastrar={carregar} />}
    </div>
  )
}
