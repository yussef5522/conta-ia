'use client'

// Sprint Gestão de Conta (31/05/2026) — UI autoatendimento.

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  initialName: string
  email: string
  createdAt: string
  empresasCount: number
}

export function MinhaContaClient({
  initialName,
  email,
  createdAt,
  empresasCount,
}: Props) {
  return (
    <div className="space-y-6">
      <PerfilSection initialName={initialName} email={email} createdAt={createdAt} />
      <SenhaSection />
      <ZonaPerigoSection email={email} empresasCount={empresasCount} />
    </div>
  )
}

function Section({
  title,
  desc,
  tone = 'default',
  children,
}: {
  title: string
  desc?: string
  tone?: 'default' | 'danger'
  children: React.ReactNode
}) {
  return (
    <section
      className={[
        'rounded-xl border p-6',
        tone === 'danger'
          ? 'border-red-200 bg-red-50/40'
          : 'border-slate-200 bg-white',
      ].join(' ')}
    >
      <div className="mb-4">
        <h2
          className={[
            'text-lg font-semibold',
            tone === 'danger' ? 'text-red-700' : 'text-slate-900',
          ].join(' ')}
        >
          {title}
        </h2>
        {desc && <p className="mt-1 text-sm text-slate-600">{desc}</p>}
      </div>
      {children}
    </section>
  )
}

/* ===== PERFIL ===== */

function PerfilSection({
  initialName,
  email,
  createdAt,
}: {
  initialName: string
  email: string
  createdAt: string
}) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const dirty = name.trim() !== initialName

  async function handleSave() {
    setSubmitting(true)
    setMsg(null)
    try {
      const res = await fetch('/api/auth/me/perfil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMsg({ ok: false, text: data.erro ?? 'Erro ao salvar' })
        return
      }
      setMsg({ ok: true, text: 'Nome atualizado' })
      router.refresh()
    } catch {
      setMsg({ ok: false, text: 'Erro de rede' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Section title="Perfil" desc="Seu nome e dados de cadastro.">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
            Nome
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
            Email
          </label>
          <input
            type="email"
            value={email}
            disabled
            className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500"
          />
          <p className="mt-1 text-xs text-slate-500">
            Pra trocar o email, fale com o administrador.
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">
            Cadastrado em {new Date(createdAt).toLocaleDateString('pt-BR')}
          </p>
        </div>

        {msg && (
          <div
            className={[
              'rounded-md px-3 py-2 text-sm',
              msg.ok
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                : 'bg-red-50 border border-red-200 text-red-700',
            ].join(' ')}
          >
            {msg.text}
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={!dirty || submitting || !name.trim()}
            className="inline-flex items-center justify-center rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </Section>
  )
}

/* ===== SENHA ===== */

function SenhaSection() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (novaSenha.length < 8) {
      setMsg({ ok: false, text: 'A senha precisa ter ao menos 8 caracteres' })
      return
    }
    if (novaSenha !== confirma) {
      setMsg({ ok: false, text: 'As duas senhas não conferem' })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/me/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, novaSenha }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMsg({ ok: false, text: data.erro ?? 'Erro ao trocar senha' })
        return
      }
      setMsg({ ok: true, text: 'Senha alterada com sucesso' })
      setCurrentPassword('')
      setNovaSenha('')
      setConfirma('')
    } catch {
      setMsg({ ok: false, text: 'Erro de rede' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Section title="Segurança" desc="Troque sua senha periodicamente.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="Senha atual"
          type="password"
          value={currentPassword}
          onChange={setCurrentPassword}
          autoComplete="current-password"
        />
        <Field
          label="Nova senha"
          type="password"
          value={novaSenha}
          onChange={setNovaSenha}
          minLength={8}
          autoComplete="new-password"
        />
        <Field
          label="Confirme a nova senha"
          type="password"
          value={confirma}
          onChange={setConfirma}
          minLength={8}
          autoComplete="new-password"
        />

        {msg && (
          <div
            className={[
              'rounded-md px-3 py-2 text-sm',
              msg.ok
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                : 'bg-red-50 border border-red-200 text-red-700',
            ].join(' ')}
          >
            {msg.text}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={
              submitting || !currentPassword || !novaSenha || !confirma
            }
            className="inline-flex items-center justify-center rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Alterando...' : 'Trocar senha'}
          </button>
        </div>
      </form>
    </Section>
  )
}

function Field({
  label,
  type,
  value,
  onChange,
  minLength,
  autoComplete,
}: {
  label: string
  type: 'text' | 'password' | 'email'
  value: string
  onChange: (v: string) => void
  minLength?: number
  autoComplete?: string
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
        {label}
      </label>
      <input
        type={type}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        minLength={minLength}
        autoComplete={autoComplete}
        className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30 outline-none"
      />
    </div>
  )
}

/* ===== EXCLUIR PRÓPRIA CONTA ===== */

function ZonaPerigoSection({
  email,
  empresasCount,
}: {
  email: string
  empresasCount: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleDelete() {
    setSubmitting(true)
    setErro(null)
    try {
      const res = await fetch('/api/auth/me', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, confirmText }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErro(data.erro ?? 'Erro ao excluir conta')
        return
      }
      // Cookie limpo pelo servidor. Manda pro login.
      router.push('/login')
      router.refresh()
    } catch {
      setErro('Erro de rede')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <Section
        title="Zona de perigo"
        desc="Excluir permanentemente sua conta e todos os seus dados."
        tone="danger"
      >
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center justify-center rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
        >
          Quero excluir minha conta
        </button>
      </Section>
    )
  }

  return (
    <Section title="⚠️ Excluir conta permanentemente" tone="danger">
      <div className="space-y-4">
        <div className="rounded-md bg-red-100 border border-red-200 p-3">
          <p className="text-sm text-red-800 leading-relaxed">
            Isso vai apagar a conta <strong>{email}</strong>,{' '}
            <strong>{empresasCount} empresa{empresasCount === 1 ? '' : 's'}</strong>{' '}
            que você é o único dono, todas as transações, fornecedores,
            categorias, agendamentos e mais.
          </p>
          <p className="mt-2 text-sm font-semibold text-red-800">
            Esta ação é IRREVERSÍVEL.
          </p>
        </div>

        <Field
          label="Sua senha atual"
          type="password"
          value={currentPassword}
          onChange={setCurrentPassword}
          autoComplete="current-password"
        />

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
            Digite <code className="font-mono text-red-700">EXCLUIR</code> pra confirmar
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm font-mono text-slate-900 focus:border-red-500 focus:ring-2 focus:ring-red-500/30 outline-none"
            placeholder="EXCLUIR"
          />
        </div>

        {erro && (
          <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {erro}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={() => {
              setOpen(false)
              setCurrentPassword('')
              setConfirmText('')
              setErro(null)
            }}
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleDelete}
            disabled={
              submitting || !currentPassword || confirmText !== 'EXCLUIR'
            }
            className="inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Excluindo...' : 'Excluir permanentemente'}
          </button>
        </div>
      </div>
    </Section>
  )
}
