'use client'

// Sprint 4.0.5.b — empty/no-access/forbidden states pras server pages globais.

import Link from 'next/link'
import { Building2, Lock, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export function NoEmpresaSelectedState() {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <Building2 className="h-12 w-12 mx-auto mb-3 text-zinc-300" />
        <h3 className="text-base font-semibold text-zinc-900">
          Selecione uma empresa
        </h3>
        <p className="mt-1 text-sm text-zinc-500">
          Use o seletor no topo da tela ou cadastre sua primeira empresa.
        </p>
        <Button asChild size="sm" className="mt-4">
          <Link href="/empresas">Ver empresas</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

export function NoAccessState() {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <AlertCircle className="h-12 w-12 mx-auto mb-3 text-amber-400" />
        <h3 className="text-base font-semibold text-zinc-900">
          Sem acesso a esta empresa
        </h3>
        <p className="mt-1 text-sm text-zinc-500">
          Selecione outra empresa no topo da tela.
        </p>
      </CardContent>
    </Card>
  )
}

export function ForbiddenState({ permission }: { permission: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <Lock className="h-12 w-12 mx-auto mb-3 text-orange-400" />
        <h3 className="text-base font-semibold text-zinc-900">
          Acesso restrito
        </h3>
        <p className="mt-1 text-sm text-zinc-500">
          Você não tem a permissão{' '}
          <code className="text-xs bg-zinc-100 px-1 rounded">{permission}</code>{' '}
          nesta empresa. Fale com o administrador.
        </p>
      </CardContent>
    </Card>
  )
}
