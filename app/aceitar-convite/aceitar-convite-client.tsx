'use client'

// Aceitar Convite — Sprint 1.4 (premium).
// Visual consistente com login (Logo CAIXAOS, paleta brand, layout centrado).
// Estados: loading, error, expired, accepted, needsLogin, success, pending.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  LogIn,
  Loader2,
  ArrowRight,
  UserCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Logo } from '@/components/logo'
import { RoleBadge } from '@/components/team/role-badge'
import { TeamAvatar } from '@/components/team/team-avatar'

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
  const [success, setSuccess] = useState<{
    companyId: string
    companyName: string
  } | null>(null)
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

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-white">
      <div className="w-full max-w-[440px] space-y-6">
        <Logo size="md" />

        <Card className="p-7">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Carregando convite...
            </div>
          ) : error && !info ? (
            <ErrorState title="Convite inválido" message={error} />
          ) : success ? (
            <SuccessState
              companyName={success.companyName}
              onGo={() => router.push(`/empresas/${success.companyId}`)}
            />
          ) : needsLogin && info ? (
            <NeedsLoginState info={info} token={token} />
          ) : info?.status === 'EXPIRED' ? (
            <ExpiredState companyName={info.company.name} />
          ) : info?.status === 'ACCEPTED' ? (
            <AlreadyAcceptedState />
          ) : info ? (
            <PendingState
              info={info}
              error={error}
              isAccepting={isAccepting}
              onAccept={handleAccept}
            />
          ) : null}
        </Card>

        <p className="text-center text-[11px] text-muted-foreground">
          Conexão segura · Dados criptografados · LGPD
        </p>
      </div>
    </div>
  )
}

// ============================================================
// Sub-estados
// ============================================================

function PendingState({
  info,
  error,
  isAccepting,
  onAccept,
}: {
  info: InviteInfo
  error: string | null
  isAccepting: boolean
  onAccept: () => void
}) {
  const inviterName = info.invitedBy?.name ?? 'Alguém'
  return (
    <>
      <h1
        className="font-medium tracking-tight"
        style={{ fontSize: 20, color: '#0C447C' }}
      >
        Você foi convidado(a)
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        <strong>{inviterName}</strong> te convidou pra fazer parte do time.
      </p>

      <div className="mt-5 space-y-3">
        {/* Card empresa */}
        <div className="rounded-md border bg-muted/30 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Empresa
          </p>
          <p className="mt-0.5 font-medium" style={{ color: '#0C447C' }}>
            {info.company.name}
          </p>
        </div>

        {/* Card papel */}
        <div className="rounded-md border bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Seu papel
            </p>
            <RoleBadge roleName={info.role.name} size="sm" />
          </div>
          {info.role.description && (
            <p className="mt-1.5 text-xs text-muted-foreground leading-snug">
              {info.role.description}
            </p>
          )}
        </div>

        {/* Email */}
        <p className="text-xs text-muted-foreground">
          Convite pra <strong>{info.email}</strong>
        </p>
      </div>

      {error && (
        <div
          className="mt-3 rounded-md border border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950 p-3 text-sm text-rose-900 dark:text-rose-100"
          role="alert"
        >
          {error}
        </div>
      )}

      <Button
        className="mt-5 w-full h-11"
        onClick={onAccept}
        disabled={isAccepting}
        style={{ backgroundColor: '#185FA5' }}
      >
        {isAccepting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Aceitando...
          </>
        ) : (
          <>
            <UserCheck className="h-4 w-4 mr-2" />
            Aceitar convite
          </>
        )}
      </Button>
    </>
  )
}

function SuccessState({
  companyName,
  onGo,
}: {
  companyName: string
  onGo: () => void
}) {
  return (
    <div className="text-center py-2">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full mb-4">
        <TeamAvatar
          name={companyName}
          roleName="ACCOUNTANT"
          size="lg"
        />
      </div>
      <h1
        className="font-medium tracking-tight"
        style={{ fontSize: 20, color: '#0C447C' }}
      >
        Bem-vindo(a) ao time
      </h1>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
        Você agora tem acesso a <strong>{companyName}</strong>.
      </p>
      <Button
        className="mt-5 w-full h-11"
        onClick={onGo}
        style={{ backgroundColor: '#185FA5' }}
      >
        Ir pra empresa
        <ArrowRight className="h-4 w-4 ml-2" />
      </Button>
    </div>
  )
}

function NeedsLoginState({
  info,
  token,
}: {
  info: InviteInfo
  token: string
}) {
  const redirect = encodeURIComponent(`/aceitar-convite?token=${token}`)
  return (
    <>
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950 mb-3">
        <LogIn className="h-5 w-5 text-blue-700 dark:text-blue-300" />
      </div>
      <h1
        className="font-medium tracking-tight"
        style={{ fontSize: 20, color: '#0C447C' }}
      >
        Faça login pra aceitar
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
        Você precisa estar logado pra aceitar este convite. Use o email{' '}
        <strong>{info.email}</strong>.
      </p>

      <div className="mt-5 space-y-2">
        <Button
          asChild
          className="w-full h-11"
          style={{ backgroundColor: '#185FA5' }}
        >
          <Link href={`/login?redirect=${redirect}`}>Fazer login</Link>
        </Button>
        <Button asChild variant="outline" className="w-full h-11">
          <Link
            href={`/cadastro?email=${encodeURIComponent(info.email)}&redirect=${redirect}`}
          >
            Não tenho conta — criar agora
          </Link>
        </Button>
      </div>
    </>
  )
}

function ExpiredState({ companyName }: { companyName: string }) {
  return (
    <>
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950 mb-3">
        <Clock className="h-5 w-5 text-amber-700 dark:text-amber-300" />
      </div>
      <h1
        className="font-medium tracking-tight"
        style={{ fontSize: 20, color: '#0C447C' }}
      >
        Convite expirado
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
        Este link de convite passou de 7 dias. Peça um novo convite ao
        administrador de <strong>{companyName}</strong>.
      </p>
    </>
  )
}

function AlreadyAcceptedState() {
  return (
    <>
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950 mb-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
      </div>
      <h1
        className="font-medium tracking-tight"
        style={{ fontSize: 20, color: '#0C447C' }}
      >
        Convite já aceito
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
        Este convite já foi utilizado. Faça login pra acessar a empresa.
      </p>
      <Button
        asChild
        className="mt-5 w-full h-11"
        style={{ backgroundColor: '#185FA5' }}
      >
        <Link href="/login">Fazer login</Link>
      </Button>
    </>
  )
}

function ErrorState({ title, message }: { title: string; message: string }) {
  return (
    <>
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-950 mb-3">
        <AlertCircle className="h-5 w-5 text-rose-700 dark:text-rose-300" />
      </div>
      <h1
        className="font-medium tracking-tight"
        style={{ fontSize: 20, color: '#0C447C' }}
      >
        {title}
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
        {message}
      </p>
      <Button
        asChild
        variant="outline"
        className="mt-5 w-full h-11"
      >
        <Link href="/login">Voltar ao login</Link>
      </Button>
    </>
  )
}
