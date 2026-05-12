// Pendentes de Classificação CTA — Sprint 1 Dia 5.
// Server component. Card sutil que destaca quantas transações precisam de revisão.

import Link from 'next/link'
import { Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getPendingCount } from '@/lib/dashboard/queries'

interface PendingClassificationProps {
  companyId: string
}

export async function PendingClassification({ companyId }: PendingClassificationProps) {
  const count = await getPendingCount(companyId)

  if (count === 0) {
    return <CelebrationCard />
  }

  return <PendingCard companyId={companyId} count={count} />
}

function PendingCard({ companyId, count }: { companyId: string; count: number }) {
  return (
    <Card className="h-full border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Pendentes de Classificação
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-5 flex flex-col gap-4">
        <div>
          <p className="text-3xl font-semibold tabular-nums tracking-tight">
            {count}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {count === 1 ? 'transação aguardando' : 'transações aguardando'} revisão
          </p>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          A IA vai sugerir categorias automaticamente quando o módulo de
          classificação entrar no ar (Sprint 2).
        </p>

        <Button asChild className="self-start">
          <Link href={`/empresas/${companyId}/pendentes`}>
            Revisar agora
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function CelebrationCard() {
  return (
    <Card className="h-full border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          Tudo em dia
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-5">
        <p className="text-2xl font-semibold text-emerald-700 dark:text-emerald-300">
          🎉 Tudo classificado!
        </p>
        <p className="text-sm text-emerald-700/80 dark:text-emerald-300/80 mt-2">
          Você está em dia. Todas as transações estão revisadas e categorizadas.
        </p>
      </CardContent>
    </Card>
  )
}
