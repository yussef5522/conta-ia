'use client'

// Sprint Gestão de Conta (31/05/2026) — Ações do cliente no admin.
// 3 ações: reset senha, trocar email, excluir (só OWNER).

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, Mail, Trash2 } from 'lucide-react'

interface Props {
  userId: string
  userEmail: string
  userName: string
  gerenciadorRole: string // 'OPERADOR' | 'OWNER'
}

type Modal = null | 'reset' | 'email' | 'delete' | 'tempPasswordReveal'

export function ClienteActions({
  userId,
  userEmail,
  userName,
  gerenciadorRole,
}: Props) {
  const router = useRouter()
  const [modal, setModal] = useState<Modal>(null)
  const [tempPassword, setTempPassword] = useState<string | null>(null)

  const canDelete = gerenciadorRole === 'OWNER'

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <ActionCard
          icon={KeyRound}
          title="Resetar senha"
          desc="Gera senha temporária. Cliente força troca no 1º login."
          onClick={() => setModal('reset')}
          tone="violet"
        />
        <ActionCard
          icon={Mail}
          title="Trocar email"
          desc="Corrigir email digitado errado no cadastro."
          onClick={() => setModal('email')}
          tone="violet"
        />
        <ActionCard
          icon={Trash2}
          title="Excluir cliente"
          desc={
            canDelete
              ? 'Apaga TUDO permanentemente. Irreversível.'
              : 'Apenas gerenciadores OWNER. Você é OPERADOR.'
          }
          onClick={() => canDelete && setModal('delete')}
          tone={canDelete ? 'danger' : 'disabled'}
          disabled={!canDelete}
        />
      </div>

      {modal === 'reset' && (
        <ResetPasswordModal
          userId={userId}
          userEmail={userEmail}
          userName={userName}
          onSuccess={(temp) => {
            setTempPassword(temp)
            setModal('tempPasswordReveal')
            router.refresh()
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'email' && (
        <ChangeEmailModal
          userId={userId}
          currentEmail={userEmail}
          onSuccess={() => {
            setModal(null)
            router.refresh()
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'delete' && (
        <DeleteUserModal
          userId={userId}
          userEmail={userEmail}
          userName={userName}
          onSuccess={() => router.push('/admin/clientes')}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'tempPasswordReveal' && tempPassword && (
        <TempPasswordRevealModal
          tempPassword={tempPassword}
          userEmail={userEmail}
          onClose={() => {
            setModal(null)
            setTempPassword(null)
          }}
        />
      )}
    </>
  )
}

function ActionCard({
  icon: Icon,
  title,
  desc,
  onClick,
  tone,
  disabled,
}: {
  icon: typeof KeyRound
  title: string
  desc: string
  onClick: () => void
  tone: 'violet' | 'danger' | 'disabled'
  disabled?: boolean
}) {
  const palette =
    tone === 'danger'
      ? { border: 'rgba(239, 68, 68, 0.2)', bg: '#0f0f0f', icon: '#fca5a5' }
      : tone === 'disabled'
        ? { border: '#1f1f1f', bg: '#0a0a0a', icon: '#404040' }
        : { border: '#1f1f1f', bg: '#0f0f0f', icon: '#a78bfa' }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-md p-4 text-left transition-all hover:brightness-125 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        background: palette.bg,
        border: `1px solid ${palette.border}`,
      }}
    >
      <Icon className="h-4 w-4" style={{ color: palette.icon }} />
      <p
        className="text-sm font-medium mt-2"
        style={{ color: tone === 'disabled' ? '#737373' : '#fafafa' }}
      >
        {title}
      </p>
      <p className="text-[11px] mt-1 leading-relaxed" style={{ color: '#737373' }}>
        {desc}
      </p>
    </button>
  )
}

/* ========== Modais ========== */

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg p-6"
        style={{ background: '#0f0f0f', border: '1px solid #1f1f1f' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          className="text-base font-medium tracking-tight mb-4"
          style={{ color: '#fafafa' }}
        >
          {title}
        </h2>
        {children}
      </div>
    </div>
  )
}

function ResetPasswordModal({
  userId,
  userEmail,
  userName,
  onSuccess,
  onClose,
}: {
  userId: string
  userEmail: string
  userName: string
  onSuccess: (tempPassword: string) => void
  onClose: () => void
}) {
  const [gerenciadorPassword, setGerenciadorPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleSubmit() {
    setSubmitting(true)
    setErro(null)
    try {
      const res = await fetch(`/api/admin/clientes/${userId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gerenciadorPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErro(data.erro ?? 'Erro ao resetar senha')
        return
      }
      onSuccess(data.tempPassword)
    } catch {
      setErro('Erro de rede. Tente de novo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalShell title="Resetar senha do cliente" onClose={onClose}>
      <p className="text-xs mb-4" style={{ color: '#a3a3a3' }}>
        Cliente: <span style={{ color: '#fafafa' }}>{userName}</span> ({userEmail})
      </p>
      <p className="text-xs mb-4 leading-relaxed" style={{ color: '#737373' }}>
        Uma senha temporária será gerada e mostrada UMA vez. Você copia e
        repassa pro cliente. No próximo login, ele será forçado a definir uma
        nova senha.
      </p>
      <label className="block text-[10px] uppercase tracking-wider mb-1.5" style={{ color: '#737373' }}>
        Sua senha de gerenciador (re-autenticação)
      </label>
      <input
        type="password"
        value={gerenciadorPassword}
        onChange={(e) => setGerenciadorPassword(e.target.value)}
        autoFocus
        className="w-full px-3 py-2 rounded text-xs font-mono mb-3"
        style={{
          background: '#0a0a0a',
          border: '1px solid #1f1f1f',
          color: '#e5e5e5',
          outline: 'none',
        }}
      />
      {erro && (
        <p className="text-xs mb-3" style={{ color: '#fca5a5' }}>
          {erro}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-3 py-2 rounded text-xs"
          style={{ color: '#a3a3a3' }}
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || !gerenciadorPassword}
          className="px-3 py-2 rounded text-xs font-medium disabled:opacity-50"
          style={{
            background: '#7c3aed',
            color: '#fafafa',
          }}
        >
          {submitting ? 'Resetando...' : 'Gerar senha temporária'}
        </button>
      </div>
    </ModalShell>
  )
}

function ChangeEmailModal({
  userId,
  currentEmail,
  onSuccess,
  onClose,
}: {
  userId: string
  currentEmail: string
  onSuccess: () => void
  onClose: () => void
}) {
  const [newEmail, setNewEmail] = useState('')
  const [gerenciadorPassword, setGerenciadorPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleSubmit() {
    setSubmitting(true)
    setErro(null)
    try {
      const res = await fetch(`/api/admin/clientes/${userId}/email`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gerenciadorPassword, newEmail }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErro(data.erro ?? 'Erro ao trocar email')
        return
      }
      onSuccess()
    } catch {
      setErro('Erro de rede.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalShell title="Trocar email do cliente" onClose={onClose}>
      <p className="text-xs mb-1" style={{ color: '#737373' }}>
        Email atual
      </p>
      <p className="text-xs font-mono mb-4" style={{ color: '#a3a3a3' }}>
        {currentEmail}
      </p>

      <label className="block text-[10px] uppercase tracking-wider mb-1.5" style={{ color: '#737373' }}>
        Novo email
      </label>
      <input
        type="email"
        value={newEmail}
        onChange={(e) => setNewEmail(e.target.value)}
        autoFocus
        placeholder="novo@email.com"
        className="w-full px-3 py-2 rounded text-xs font-mono mb-3"
        style={{
          background: '#0a0a0a',
          border: '1px solid #1f1f1f',
          color: '#e5e5e5',
          outline: 'none',
        }}
      />

      <label className="block text-[10px] uppercase tracking-wider mb-1.5" style={{ color: '#737373' }}>
        Sua senha de gerenciador (re-autenticação)
      </label>
      <input
        type="password"
        value={gerenciadorPassword}
        onChange={(e) => setGerenciadorPassword(e.target.value)}
        className="w-full px-3 py-2 rounded text-xs font-mono mb-3"
        style={{
          background: '#0a0a0a',
          border: '1px solid #1f1f1f',
          color: '#e5e5e5',
          outline: 'none',
        }}
      />
      {erro && (
        <p className="text-xs mb-3" style={{ color: '#fca5a5' }}>
          {erro}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-3 py-2 rounded text-xs" style={{ color: '#a3a3a3' }}>
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || !newEmail || !gerenciadorPassword}
          className="px-3 py-2 rounded text-xs font-medium disabled:opacity-50"
          style={{ background: '#7c3aed', color: '#fafafa' }}
        >
          {submitting ? 'Salvando...' : 'Trocar email'}
        </button>
      </div>
    </ModalShell>
  )
}

function DeleteUserModal({
  userId,
  userEmail,
  userName,
  onSuccess,
  onClose,
}: {
  userId: string
  userEmail: string
  userName: string
  onSuccess: () => void
  onClose: () => void
}) {
  const [confirmEmail, setConfirmEmail] = useState('')
  const [gerenciadorPassword, setGerenciadorPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleSubmit() {
    setSubmitting(true)
    setErro(null)
    try {
      const res = await fetch(`/api/admin/clientes/${userId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gerenciadorPassword, confirmEmail }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErro(data.erro ?? 'Erro ao excluir')
        return
      }
      onSuccess()
    } catch {
      setErro('Erro de rede.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalShell title="⚠️ Excluir cliente permanentemente" onClose={onClose}>
      <div
        className="rounded p-3 mb-4"
        style={{
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
        }}
      >
        <p className="text-xs leading-relaxed" style={{ color: '#fecaca' }}>
          Isso vai apagar <strong>TODOS</strong> os dados de{' '}
          <strong>{userName}</strong> ({userEmail}): empresas próprias,
          transações, categorias, fornecedores, agendamentos, etc.
        </p>
        <p className="text-xs mt-2" style={{ color: '#fca5a5' }}>
          Esta ação é <strong>IRREVERSÍVEL</strong>.
        </p>
      </div>

      <label className="block text-[10px] uppercase tracking-wider mb-1.5" style={{ color: '#737373' }}>
        Digite o email do cliente pra confirmar
      </label>
      <input
        type="email"
        value={confirmEmail}
        onChange={(e) => setConfirmEmail(e.target.value)}
        autoFocus
        placeholder={userEmail}
        className="w-full px-3 py-2 rounded text-xs font-mono mb-3"
        style={{
          background: '#0a0a0a',
          border: '1px solid #1f1f1f',
          color: '#e5e5e5',
          outline: 'none',
        }}
      />

      <label className="block text-[10px] uppercase tracking-wider mb-1.5" style={{ color: '#737373' }}>
        Sua senha de gerenciador OWNER
      </label>
      <input
        type="password"
        value={gerenciadorPassword}
        onChange={(e) => setGerenciadorPassword(e.target.value)}
        className="w-full px-3 py-2 rounded text-xs font-mono mb-3"
        style={{
          background: '#0a0a0a',
          border: '1px solid #1f1f1f',
          color: '#e5e5e5',
          outline: 'none',
        }}
      />
      {erro && (
        <p className="text-xs mb-3" style={{ color: '#fca5a5' }}>
          {erro}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-3 py-2 rounded text-xs" style={{ color: '#a3a3a3' }}>
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={
            submitting ||
            !gerenciadorPassword ||
            confirmEmail.toLowerCase() !== userEmail.toLowerCase()
          }
          className="px-3 py-2 rounded text-xs font-medium disabled:opacity-50"
          style={{ background: '#dc2626', color: '#fafafa' }}
        >
          {submitting ? 'Excluindo...' : 'Excluir permanentemente'}
        </button>
      </div>
    </ModalShell>
  )
}

function TempPasswordRevealModal({
  tempPassword,
  userEmail,
  onClose,
}: {
  tempPassword: string
  userEmail: string
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(60)

  // Copia automaticamente ao abrir
  useEffect(() => {
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(tempPassword)
        .then(() => setCopied(true))
        .catch(() => {})
    }
  }, [tempPassword])

  // Countdown 60s + auto-close ao zerar
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval)
          onClose()
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [onClose])

  function copyAgain() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(tempPassword).then(() => setCopied(true))
    }
  }

  return (
    <ModalShell title="Senha temporária gerada" onClose={onClose}>
      <p className="text-xs mb-3" style={{ color: '#a3a3a3' }}>
        Para: <span className="font-mono">{userEmail}</span>
      </p>

      <div
        className="rounded p-3 mb-3 font-mono text-base text-center"
        style={{
          background: '#0a0a0a',
          border: '1px solid #7c3aed',
          color: '#fafafa',
          letterSpacing: '0.05em',
        }}
      >
        {tempPassword}
      </div>

      <button
        onClick={copyAgain}
        className="w-full px-3 py-2 rounded text-xs font-medium mb-3"
        style={{
          background: copied ? 'rgba(34, 197, 94, 0.15)' : '#1f1f1f',
          color: copied ? '#5DCAA5' : '#fafafa',
          border: copied ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid #2a2a2a',
        }}
      >
        {copied ? '✓ Copiado pro clipboard' : 'Copiar senha'}
      </button>

      <p className="text-xs leading-relaxed mb-3" style={{ color: '#fbbf24' }}>
        ⚠️ Esta senha só será mostrada UMA vez. Repasse ao cliente agora. No
        próximo login ele será obrigado a trocar.
      </p>

      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider" style={{ color: '#525252' }}>
          Fecha automático em {secondsLeft}s
        </span>
        <button
          onClick={onClose}
          className="px-3 py-2 rounded text-xs font-medium"
          style={{ background: '#1f1f1f', color: '#fafafa' }}
        >
          Já anotei, fechar
        </button>
      </div>
    </ModalShell>
  )
}
