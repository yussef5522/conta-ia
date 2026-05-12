// Empty states do Dashboard — Sprint 1 Dia 1.

import Link from 'next/link'
import { Building2, Landmark, Plus, Upload, PenLine } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

// (a) user sem empresas
export function NoCompaniesEmpty() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-4">
          <Building2 className="h-7 w-7 text-primary" />
        </div>
        <h3 className="text-lg font-semibold">Cadastre sua primeira empresa</h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm">
          O Conta IA é multi-empresa. Cada CNPJ vira uma empresa separada — você pode
          ter quantas quiser.
        </p>
        <Button className="mt-6" asChild>
          <Link href="/empresas/nova">
            <Plus className="mr-2 h-4 w-4" />
            Cadastrar empresa
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

// (b) empresa sem contas bancárias
export function NoAccountsEmpty({ empresaId }: { empresaId: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-4">
          <Landmark className="h-7 w-7 text-primary" />
        </div>
        <h3 className="text-lg font-semibold">Cadastre uma conta bancária</h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm">
          O dashboard fica completo a partir de uma conta bancária com saldo e
          transações.
        </p>
        <Button className="mt-6" asChild>
          <Link href={`/empresas/${empresaId}/contas/nova`}>
            <Plus className="mr-2 h-4 w-4" />
            Cadastrar conta
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

// (c) contas existem mas sem transações
export function NoTransactionsBanner({
  empresaId,
  contaId,
}: {
  empresaId: string
  contaId: string
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium">Sem transações ainda</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            Comece importando um extrato OFX ou lançando manualmente.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="default" asChild>
            <Link href={`/empresas/${empresaId}/contas/${contaId}/importar`}>
              <Upload className="mr-2 h-4 w-4" />
              Importar OFX
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/empresas/${empresaId}/contas/${contaId}/transacoes/nova`}>
              <PenLine className="mr-2 h-4 w-4" />
              Lançar manualmente
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
