// Atividade Recente — Sprint 1 Dia 5.
// Server component: últimas 10 transações (sem TRANSFER), lista simples estilo Mercury.

import Link from 'next/link'
import { ArrowUpRight, ArrowDownRight, Receipt, Upload, PenLine } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getRecentActivity } from '@/lib/dashboard/queries'
import { formatBRL } from '@/lib/format/money'
import { formatActivityDate } from '@/lib/dashboard/format-activity-date'

interface RecentActivityProps {
  companyId: string
}

export async function RecentActivity({ companyId }: RecentActivityProps) {
  const items = await getRecentActivity(companyId, 10)

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Atividade Recente</CardTitle>
      </CardHeader>
      <CardContent className="pb-5">
        {items.length === 0 ? (
          <EmptyRecentActivity companyId={companyId} />
        ) : (
          <ul className="divide-y divide-border/50">
            {items.map((item) => {
              const isCredit = item.type === 'CREDIT'
              const Avatar = isCredit ? ArrowUpRight : ArrowDownRight
              const colorBg = isCredit
                ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
                : 'bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400'
              const valueColor = isCredit
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
              const sign = isCredit ? '+' : '-'

              return (
                <li key={item.id}>
                  <Link
                    href={`/empresas/${companyId}/contas/${item.bankAccountId}/transacoes/${item.id}/editar`}
                    className="flex items-center gap-3 py-2.5 hover:bg-muted/40 -mx-3 px-3 rounded-md transition-colors"
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${colorBg}`}>
                      <Avatar className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-sm font-medium truncate">{item.description}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        <span className="whitespace-nowrap">{formatActivityDate(item.date)}</span>
                        <span aria-hidden>•</span>
                        {item.categoryName ? (
                          <Badge variant="outline" className="text-xs h-5 px-1.5 font-normal">
                            {item.categoryName}
                          </Badge>
                        ) : (
                          <span className="italic">Sem categoria</span>
                        )}
                        <span aria-hidden>•</span>
                        <span className="truncate">{item.bankAccountName}</span>
                      </div>
                    </div>
                    <span className={`text-sm font-semibold tabular-nums shrink-0 ${valueColor}`}>
                      {sign} {formatBRL(item.amount)}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function EmptyRecentActivity({ companyId }: { companyId: string }) {
  return (
    <div className="flex flex-col items-center text-center py-8">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted mb-3">
        <Receipt className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">Nenhuma transação registrada ainda</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">
        Importe um extrato OFX ou lance manualmente pra ver seu histórico aqui.
      </p>
      <div className="flex gap-2 mt-4">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/empresas/${companyId}/contas`}>
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Importar OFX
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/empresas/${companyId}/contas`}>
            <PenLine className="mr-1.5 h-3.5 w-3.5" />
            Lançar manual
          </Link>
        </Button>
      </div>
    </div>
  )
}
