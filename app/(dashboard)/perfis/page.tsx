// Sprint PF FATIA 1 — Lista de perfis PF do user.

'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Plus, UserRound, User, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface ProfileItem {
  id: string
  name: string
  cpf: string | null
  type: string
  isSelf: boolean
  role: string
  isActive: boolean
  createdAt: string
}

export default function PerfisPage() {
  const [profiles, setProfiles] = useState<ProfileItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/perfis')
      .then((r) => r.json())
      .then((d) => setProfiles(d.profiles ?? []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 mb-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold uppercase tracking-wide">
            <UserRound className="h-3 w-3" />
            Pessoal
          </div>
          <h1 className="text-2xl font-bold text-zinc-900">Perfis pessoais</h1>
          <p className="text-sm text-zinc-600 mt-1">
            Gerencie a vida financeira pessoal — sua e dos dependentes.
          </p>
        </div>
        <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Link href="/perfis/novo">
            <Plus className="h-4 w-4 mr-1" />
            Novo perfil
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : profiles.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <UserRound className="h-10 w-10 mx-auto text-emerald-200 mb-3" />
            <h2 className="font-semibold text-zinc-900 mb-1">
              Nenhum perfil pessoal ainda
            </h2>
            <p className="text-sm text-zinc-600 max-w-md mx-auto mb-4">
              Crie um perfil pra você e, depois, perfis pra dependentes (filhos,
              esposa). Cada um terá suas próprias contas, transações e
              relatórios.
            </p>
            <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Link href="/perfis/novo">
                <Plus className="h-4 w-4 mr-1" />
                Criar meu primeiro perfil
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {profiles.map((p) => {
            const Icon = p.type === 'DEPENDENT' ? User : UserRound
            return (
              <Link
                key={p.id}
                href={`/perfis/${p.id}`}
                className="group"
              >
                <Card className="hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white shrink-0">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-zinc-900 group-hover:text-emerald-700">
                          {p.name}
                        </h3>
                        <div className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                          {p.isSelf && (
                            <span className="text-emerald-700 font-medium">Meu</span>
                          )}
                          {p.isSelf && <span>·</span>}
                          <span>
                            {p.type === 'DEPENDENT' ? 'Dependente' : 'Titular'}
                          </span>
                          {p.cpf && (
                            <>
                              <span>·</span>
                              <span className="font-mono text-zinc-400">
                                CPF ****{p.cpf.slice(-2)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
