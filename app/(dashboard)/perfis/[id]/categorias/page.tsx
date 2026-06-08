// Sprint PF FATIA 1 — Categorias do perfil PF.
// Sprint Categorias-PF-Nav (07/06/2026) — modal limpo + update otimista.

'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  NovaCategoriaPFModal,
  type PersonalCategoryCreated,
} from '@/components/categorias-pf/NovaCategoriaPFModal'

interface Category {
  id: string
  name: string
  type: 'INCOME' | 'EXPENSE'
  color: string | null
  icon: string | null
  isDefault: boolean
  isActive: boolean
}

export default function CategoriasPFPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [items, setItems] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/perfis/${id}/categorias`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setItems(d.categories ?? [])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  function handleCreated(cat: PersonalCategoryCreated) {
    // Sprint Categorias-PF-Nav: update OTIMISTA — insere no estado local
    // sem refetch. Categoria aparece na seção certa (Receita/Despesa)
    // imediatamente, sem perder scroll nem causar flash de loading.
    setItems((prev) => [...prev, cat as Category])
  }

  const incomes = items.filter((c) => c.type === 'INCOME')
  const expenses = items.filter((c) => c.type === 'EXPENSE')

  return (
    <div>
      <Link
        href={`/perfis/${id}`}
        className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900 mb-3"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar ao perfil
      </Link>

      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">
            Categorias{' '}
            <span className="text-sm font-normal text-emerald-700">
              (perfil pessoal)
            </span>
          </h1>
          <p className="text-sm text-zinc-600">
            Plano de contas pessoal — 15 padrão + suas customizadas.
            Separadas das categorias da empresa.
          </p>
        </div>
        <Button
          onClick={() => setModalOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Plus className="h-4 w-4 mr-1" />
          Nova categoria
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <h2 className="font-semibold text-emerald-700 text-sm mb-3 uppercase tracking-wide">
                Receitas ({incomes.length})
              </h2>
              <div className="space-y-1.5">
                {incomes.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 py-1.5 border-b last:border-0"
                  >
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: c.color ?? '#10b981' }}
                    />
                    <span className="text-sm flex-1">{c.name}</span>
                    {c.isDefault && (
                      <span className="text-[9px] uppercase font-semibold text-zinc-400">
                        Padrão
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h2 className="font-semibold text-red-700 text-sm mb-3 uppercase tracking-wide">
                Despesas ({expenses.length})
              </h2>
              <div className="space-y-1.5">
                {expenses.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 py-1.5 border-b last:border-0"
                  >
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: c.color ?? '#ef4444' }}
                    />
                    <span className="text-sm flex-1">{c.name}</span>
                    {c.isDefault && (
                      <span className="text-[9px] uppercase font-semibold text-zinc-400">
                        Padrão
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <NovaCategoriaPFModal
        open={modalOpen}
        profileId={id}
        defaultType="EXPENSE"
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  )
}
