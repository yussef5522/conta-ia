'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function TrocarSenhaForm() {
  const router = useRouter()
  const [novaSenha, setNovaSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    if (novaSenha.length < 8) {
      setErro('A senha precisa ter ao menos 8 caracteres')
      return
    }
    if (novaSenha !== confirma) {
      setErro('As duas senhas não conferem')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/me/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ novaSenha }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErro(data.erro ?? 'Erro ao definir nova senha')
        setSubmitting(false)
        return
      }
      // Sucesso: cookie regenerado pelo servidor. Redireciona pro dashboard.
      router.push('/dashboard')
      router.refresh()
    } catch {
      setErro('Erro de rede. Tente de novo.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="novaSenha"
          className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
        >
          Nova senha
        </label>
        <input
          id="novaSenha"
          type="password"
          required
          autoFocus
          value={novaSenha}
          onChange={(e) => setNovaSenha(e.target.value)}
          minLength={8}
          className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30 outline-none"
          placeholder="Mínimo 8 caracteres"
        />
      </div>

      <div>
        <label
          htmlFor="confirma"
          className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
        >
          Confirme a nova senha
        </label>
        <input
          id="confirma"
          type="password"
          required
          value={confirma}
          onChange={(e) => setConfirma(e.target.value)}
          minLength={8}
          className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30 outline-none"
        />
      </div>

      {erro && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {erro}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !novaSenha || !confirma}
        className="w-full inline-flex items-center justify-center rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-violet-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? 'Definindo nova senha...' : 'Definir nova senha e entrar'}
      </button>
    </form>
  )
}
