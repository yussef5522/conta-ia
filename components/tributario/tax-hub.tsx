'use client'

// Sprint 5.0.2.c.2 — Hub Tributário com 4 tabs (Visão / Análise / Histórico / Config).
// Padrão TurboTax/QuickBooks: 1 entrada na sidebar, sub-navegação por tabs.

import { useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BarChart3, Sparkles, History, Settings } from 'lucide-react'
import { AnaliseTab } from './tabs/analise-tab'
import { ConfigTab } from './tabs/config-tab'

type TabKey = 'visao' | 'analise' | 'historico' | 'config'

const VALID_TABS: TabKey[] = ['visao', 'analise', 'historico', 'config']

interface Props {
  visao: React.ReactNode
  historico: React.ReactNode
}

export function TaxHub({ visao, historico }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const active: TabKey = VALID_TABS.includes(tabParam as TabKey) ? (tabParam as TabKey) : 'visao'

  const handleChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value === 'visao') params.delete('tab')
      else params.set('tab', value)
      const qs = params.toString()
      router.replace(qs ? `/tributario?${qs}` : '/tributario', { scroll: false })
    },
    [router, searchParams],
  )

  return (
    <Tabs value={active} onValueChange={handleChange}>
      <TabsList className="w-full justify-start border-b bg-transparent p-0 h-auto rounded-none overflow-x-auto">
        <TabRow value="visao" icon={<BarChart3 className="h-4 w-4" />} label="Visão" />
        <TabRow value="analise" icon={<Sparkles className="h-4 w-4" />} label="Análise" />
        <TabRow value="historico" icon={<History className="h-4 w-4" />} label="Histórico" />
        <TabRow value="config" icon={<Settings className="h-4 w-4" />} label="Configurações" />
      </TabsList>

      <TabsContent value="visao" className="mt-6">
        {visao}
      </TabsContent>
      <TabsContent value="analise" className="mt-6">
        <AnaliseTab />
      </TabsContent>
      <TabsContent value="historico" className="mt-6">
        {historico}
      </TabsContent>
      <TabsContent value="config" className="mt-6">
        <ConfigTab />
      </TabsContent>
    </Tabs>
  )
}

function TabRow({
  value,
  icon,
  label,
}: {
  value: string
  icon: React.ReactNode
  label: string
}) {
  return (
    <TabsTrigger
      value={value}
      className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-4 py-2.5 text-sm whitespace-nowrap"
    >
      <span className="inline-flex items-center gap-1.5">
        {icon}
        {label}
      </span>
    </TabsTrigger>
  )
}
