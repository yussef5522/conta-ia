// Top 5 Categorias de Despesa — Sprint 1 Dia 2.
// Server component que faz fetch. Donut renderizado pelo client component via dynamic.

import { TrendingDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getTopCategories } from '@/lib/dashboard/queries'
import { formatBRL } from '@/lib/format/money'
import { TopCategoriesChart } from './TopCategoriesChart'

interface TopCategoriesProps {
  companyId: string
}

export async function TopCategories({ companyId }: TopCategoriesProps) {
  const top = await getTopCategories(companyId)

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Top 5 Despesas do mês</CardTitle>
      </CardHeader>
      <CardContent className="pb-5">
        {top.items.length === 0 ? (
          <EmptyTopCategories />
        ) : (
          <div className="flex items-center gap-6">
            <div className="shrink-0">
              <TopCategoriesChart items={top.items} size={120} />
            </div>
            <ul className="flex-1 space-y-2 min-w-0">
              {top.items.map((item) => (
                <li
                  key={item.categoryId}
                  className="flex items-center gap-3 text-sm"
                >
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="flex-1 truncate text-foreground">{item.name}</span>
                  <span className="font-medium tabular-nums shrink-0">
                    {formatBRL(item.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function EmptyTopCategories() {
  return (
    <div className="flex flex-col items-center text-center py-8">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted mb-3">
        <TrendingDown className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">Nenhuma despesa categorizada neste mês.</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">
        Importe um extrato OFX ou lance manualmente pra ver onde seu dinheiro tá saindo. 💸
      </p>
    </div>
  )
}
