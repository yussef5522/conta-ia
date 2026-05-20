'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Landmark, ArrowUpRight, ArrowDownRight, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FreshnessBadge } from '@/components/contas-bancarias/freshness-badge'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Header } from '@/components/layout/header'
import { formatBRL } from '@/lib/format/money'

const TIPO_LABELS: Record<string, string> = {
  CHECKING: 'Corrente',
  SAVINGS: 'Poupança',
  INVESTMENT: 'Investimento',
}

interface Conta {
  id: string
  name: string
  bankName: string | null
  agency: string | null
  accountNumber: string | null
  accountType: string
  balance: number
  isActive: boolean
  companyId: string
  company: { name: string; tradeName: string | null }
  // Onda 2 Sprint 2.4 — badge "atualizado há X dias"
  lastSuccessfulImportAt: string | null
}

interface EmpresaGroup {
  id: string
  name: string
  tradeName: string | null
  contas: Conta[]
  saldoTotal: number
}

export default function ContasBancariasPage() {
  const router = useRouter()
  const [grupos, setGrupos] = useState<EmpresaGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [saldoGeral, setSaldoGeral] = useState(0)

  useEffect(() => {
    async function fetchContas() {
      try {
        const res = await fetch('/api/contas-bancarias')
        if (res.ok) {
          const data = await res.json()
          const contas: Conta[] = data.contas

          // Agrupa por empresa
          const map = new Map<string, EmpresaGroup>()
          for (const conta of contas) {
            if (!map.has(conta.companyId)) {
              map.set(conta.companyId, {
                id: conta.companyId,
                name: conta.company.name,
                tradeName: conta.company.tradeName,
                contas: [],
                saldoTotal: 0,
              })
            }
            const grupo = map.get(conta.companyId)!
            grupo.contas.push(conta)
            if (conta.accountType !== 'INVESTMENT') {
              grupo.saldoTotal += conta.balance
            }
          }

          const gruposList = Array.from(map.values())
          setGrupos(gruposList)
          setSaldoGeral(gruposList.reduce((s, g) => s + g.saldoTotal, 0))
        }
      } finally {
        setLoading(false)
      }
    }
    fetchContas()
  }, [])

  const totalContas = grupos.reduce((s, g) => s + g.contas.length, 0)

  return (
    <div className="space-y-6">
      <Header
        title="Contas Bancárias"
        description={`${totalContas} conta${totalContas !== 1 ? 's' : ''} em ${grupos.length} empresa${grupos.length !== 1 ? 's' : ''}`}
      >
        {loading ? (
          <Button size="sm" disabled>
            <Plus className="mr-1.5 h-3.5 w-3.5" />Nova Conta
          </Button>
        ) : grupos.length === 0 ? (
          <Button size="sm" asChild>
            <Link href="/empresas">
              <Plus className="mr-1.5 h-3.5 w-3.5" />Nova Conta
            </Link>
          </Button>
        ) : grupos.length === 1 ? (
          <Button size="sm" asChild>
            <Link href={`/empresas/${grupos[0].id}/contas/nova`}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />Nova Conta
            </Link>
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1.5 h-3.5 w-3.5" />Nova Conta
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {grupos.map((g) => (
                <DropdownMenuItem
                  key={g.id}
                  className="cursor-pointer"
                  onSelect={() => router.push(`/empresas/${g.id}/contas/nova`)}
                >
                  {g.tradeName ?? g.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </Header>

      {/* Saldo consolidado */}
      {!loading && totalContas > 0 && (
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <p className="text-sm opacity-80">Saldo Consolidado (corrente + poupança)</p>
              <p className="text-3xl font-bold">{formatBRL(saldoGeral)}</p>
            </div>
            <Landmark className="h-10 w-10 opacity-30" />
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-6">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-3">
              <div className="h-6 w-48 rounded bg-muted animate-pulse" />
              <div className="grid gap-4 sm:grid-cols-2">
                {[1, 2].map((j) => <div key={j} className="h-28 rounded-lg border bg-muted animate-pulse" />)}
              </div>
            </div>
          ))}
        </div>
      ) : grupos.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Landmark className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold text-lg">Nenhuma conta cadastrada</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-6">
            Selecione uma empresa para cadastrar a primeira conta bancária.
          </p>
          <Button asChild>
            <Link href="/empresas">
              <Building2 className="mr-2 h-4 w-4" />Ir para Empresas
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {grupos.map((grupo) => (
            <div key={grupo.id} className="space-y-3">
              {/* Cabeçalho da empresa */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <h2 className="font-semibold text-base">
                    {grupo.tradeName ?? grupo.name}
                  </h2>
                  <span className="text-sm text-muted-foreground">
                    · Saldo: {formatBRL(grupo.saldoTotal)}
                  </span>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/empresas/${grupo.id}/contas/nova`}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />Nova Conta
                  </Link>
                </Button>
              </div>

              {/* Cards de contas */}
              <div className="grid gap-4 sm:grid-cols-2">
                {grupo.contas.map((conta) => (
                  <Card key={conta.id} className="group">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-3 mb-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <Landmark className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold truncate">{conta.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {conta.bankName ?? 'Banco não informado'}
                            {conta.agency && ` · Ag. ${conta.agency}`}
                            {conta.accountNumber && ` · ${conta.accountNumber}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{TIPO_LABELS[conta.accountType] ?? conta.accountType}</Badge>
                          <FreshnessBadge lastImportAt={conta.lastSuccessfulImportAt} />
                        </div>
                        <div className={`flex items-center gap-1 font-bold text-lg ${conta.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {conta.balance >= 0
                            ? <ArrowUpRight className="h-4 w-4" />
                            : <ArrowDownRight className="h-4 w-4" />}
                          {formatBRL(conta.balance)}
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1 text-xs" asChild>
                          <Link href={`/empresas/${grupo.id}/contas/${conta.id}/transacoes`}>
                            Ver transações
                          </Link>
                        </Button>
                        <Button variant="ghost" size="sm" className="flex-1 text-xs" asChild>
                          <Link href={`/empresas/${grupo.id}/contas/${conta.id}/editar`}>
                            Editar
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
