// Sprint 5.0.2.n — Histórico de Vendor Discoveries.
// Lista chamadas pra cache global / BrasilAPI / Claude por empresa.

import { Header } from '@/components/layout/header'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'

interface Params {
  params: Promise<{ id: string }>
}

const ORIGEM_LABEL: Record<string, string> = {
  CACHE_GLOBAL: 'Cache global',
  BRASIL_API: 'BrasilAPI',
  CLAUDE_AI: 'Claude AI',
  NONE: 'Sem match',
}

const RESULTADO_LABEL: Record<string, string> = {
  FOUND: '✓ Encontrado',
  LOW_CONFIDENCE: '⚠ Baixa confiança',
  NOT_FOUND: '✗ Não encontrado',
}

const ACTION_LABEL: Record<string, string> = {
  ACCEPTED: '✓ Aceito',
  REJECTED: '✗ Rejeitado',
  MODIFIED: '↻ Modificado',
}

export const dynamic = 'force-dynamic'

export default async function VendorDiscoveryHistoricoPage({ params }: Params) {
  const { id: empresaId } = await params

  // Faz validação de acesso via prisma findFirst (consistente com outras pages)
  // Usa server-side fetch direto pra cookie auth padrão (next/headers)
  const { cookies } = await import('next/headers')
  const token = (await cookies()).get('token')?.value
  if (!token) redirect('/login')

  let user: { sub: string } | null = null
  try {
    user = await verifyToken(token)
  } catch {
    redirect('/login')
  }
  if (!user) redirect('/login')

  const empresa = await prisma.company.findFirst({
    where: { id: empresaId, users: { some: { userId: user.sub } } },
    select: { id: true, name: true, setor: true },
  })
  if (!empresa) notFound()

  const [logs, stats] = await Promise.all([
    prisma.vendorDiscoveryLog.findMany({
      where: { companyId: empresaId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.vendorDiscoveryLog.groupBy({
      by: ['origem'],
      where: { companyId: empresaId },
      _count: { id: true },
      _sum: { custoApi: true },
    }),
  ])

  const totalCost = stats.reduce((acc, s) => acc + (s._sum.custoApi ?? 0), 0)

  return (
    <div className="space-y-6">
      <Header
        title="Histórico de Vendor Discovery"
        description={`${empresa.name} · ${logs.length} discoveries recentes · custo total $${totalCost.toFixed(4)}`}
      />

      {/* Stats por origem */}
      <div className="grid gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.origem}
            className="rounded-md border bg-card px-3 py-2"
          >
            <p className="text-xs text-muted-foreground">
              {ORIGEM_LABEL[s.origem] ?? s.origem}
            </p>
            <p className="text-lg font-semibold tabular-nums">{s._count.id}</p>
            {s._sum.custoApi !== null && s._sum.custoApi > 0 && (
              <p className="text-[10px] text-muted-foreground">
                ${(s._sum.custoApi ?? 0).toFixed(4)} acumulado
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Tabela log */}
      <div className="rounded-lg border overflow-hidden">
        {logs.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            Nenhum discovery ainda. Use o botão &quot;Sugerir IA&quot; em /pendentes pra começar.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-3 py-2 font-medium">Quando</th>
                <th className="text-left px-3 py-2 font-medium">Vendor consultado</th>
                <th className="text-left px-3 py-2 font-medium">CNPJ</th>
                <th className="text-left px-3 py-2 font-medium">Origem</th>
                <th className="text-left px-3 py-2 font-medium">Resultado</th>
                <th className="text-left px-3 py-2 font-medium">Ação user</th>
                <th className="text-right px-3 py-2 font-medium">Tempo</th>
                <th className="text-right px-3 py-2 font-medium">Custo</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b hover:bg-muted/20">
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {new Date(l.createdAt).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-3 py-2 max-w-xs truncate" title={l.vendorNameQueried}>
                    {l.vendorNameQueried}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {l.cnpjQueried ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {ORIGEM_LABEL[l.origem] ?? l.origem}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {RESULTADO_LABEL[l.resultado] ?? l.resultado}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {l.userAction ? ACTION_LABEL[l.userAction] ?? l.userAction : '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs">
                    {l.responseTime}ms
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs">
                    {l.custoApi && l.custoApi > 0 ? `$${l.custoApi.toFixed(5)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
