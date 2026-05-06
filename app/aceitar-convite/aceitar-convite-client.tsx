'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface InviteInfo {
  email: string
  company: { name: string }
  role: { name: string; description: string | null }
  invitedBy: { name: string } | null
  expiresAt: string
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED'
}

export function AceitarConviteClient({ token }: { token: string }) {
  const router = useRouter()
  const [info, setInfo] = useState<InviteInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAccepting, setIsAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ companyId: string; companyName: string } | null>(
    null,
  )
  const [needsLogin, setNeedsLogin] = useState(false)

  useEffect(() => {
    fetch(`/api/aceitar-convite?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}))
          setError(body.erro ?? 'Convite inválido')
          return
        }
        const data = await r.json()
        setInfo(data.invite)
      })
      .catch(() => setError('Erro ao carregar convite'))
      .finally(() => setIsLoading(false))
  }, [token])

  async function handleAccept() {
    setIsAccepting(true)
    setError(null)

    try {
      const res = await fetch('/api/aceitar-convite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      const data = await res.json().catch(() => ({}))

      if (res.status === 401) {
        setNeedsLogin(true)
        return
      }

      if (!res.ok) {
        setError(data.erro ?? 'Erro ao aceitar convite')
        return
      }

      setSuccess({
        companyId: data.company.id,
        companyName: data.company.name,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setIsAccepting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-sm text-muted-foreground">Carregando convite...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-6">
        {error && !info ? (
          <>
            <h1 className="text-xl font-semibold">⚠️ Convite inválido</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          </>
        ) : success ? (
          <>
            <h1 className="text-xl font-semibold">🎉 Bem-vindo!</h1>
            <p className="mt-2 text-sm">
              Você agora tem acesso à empresa <strong>{success.companyName}</strong>.
            </p>
            <Button
              className="mt-4 w-full"
              onClick={() => router.push(`/empresas/${success.companyId}`)}
            >
              Ir pra empresa
            </Button>
          </>
        ) : needsLogin ? (
          <>
            <h1 className="text-xl font-semibold">🔐 Faça login pra aceitar</h1>
            <p className="mt-2 text-sm">
              Você precisa estar logado pra aceitar este convite. Use o email{' '}
              <strong>{info?.email}</strong>.
            </p>
            <div className="mt-4 space-y-2">
              <Link
                href={`/login?redirect=${encodeURIComponent(`/aceitar-convite?token=${token}`)}`}
                className="block"
              >
                <Button className="w-full">Fazer login</Button>
              </Link>
              <Link
                href={`/cadastro?email=${encodeURIComponent(info?.email ?? '')}&redirect=${encodeURIComponent(`/aceitar-convite?token=${token}`)}`}
                className="block"
              >
                <Button variant="outline" className="w-full">
                  Cadastrar conta
                </Button>
              </Link>
            </div>
          </>
        ) : info?.status === 'EXPIRED' ? (
          <>
            <h1 className="text-xl font-semibold">⏰ Convite expirado</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Peça um novo convite ao administrador da empresa{' '}
              <strong>{info.company.name}</strong>.
            </p>
          </>
        ) : info?.status === 'ACCEPTED' ? (
          <>
            <h1 className="text-xl font-semibold">✅ Convite já aceito</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Este convite já foi utilizado. Faça login pra acessar a empresa.
            </p>
            <Link href="/login" className="block mt-4">
              <Button className="w-full">Fazer login</Button>
            </Link>
          </>
        ) : info ? (
          <>
            <h1 className="text-xl font-semibold">👥 Você foi convidado!</h1>
            <p className="mt-2 text-sm">
              Acesso à empresa <strong>{info.company.name}</strong> como{' '}
              <strong>{info.role.name}</strong>.
            </p>
            {info.invitedBy && (
              <p className="mt-1 text-xs text-muted-foreground">
                Convidado por {info.invitedBy.name}
              </p>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              Email do convite: <strong>{info.email}</strong>
            </p>

            {error && (
              <div className="mt-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button className="mt-4 w-full" onClick={handleAccept} disabled={isAccepting}>
              {isAccepting ? 'Aceitando...' : 'Aceitar convite'}
            </Button>
          </>
        ) : null}
      </Card>
    </div>
  )
}
