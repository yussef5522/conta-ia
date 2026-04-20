'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Header } from '@/components/layout/header'
import { EmpresaCard } from '@/components/empresas/empresa-card'
import { DeleteDialog } from '@/components/empresas/delete-dialog'
import { useToast } from '@/components/ui/use-toast'
import { t } from '@/lib/i18n/pt-BR'

interface Empresa {
  id: string
  name: string
  tradeName: string | null
  cnpj: string
  type: string
  isActive: boolean
}

export default function EmpresasPage() {
  const { toast } = useToast()
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nome: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function fetchEmpresas() {
    try {
      const res = await fetch('/api/empresas')
      if (res.ok) {
        const data = await res.json()
        setEmpresas(data.empresas)
      }
    } catch {
      toast({ variant: 'destructive', title: t.common.error, description: t.errors.serverError })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEmpresas()
  }, [])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/empresas/${deleteTarget.id}`, { method: 'DELETE' })
      if (res.ok) {
        setEmpresas((prev) => prev.filter((e) => e.id !== deleteTarget.id))
        toast({ variant: 'success', title: t.common.success, description: t.success.empresaExcluida })
      } else {
        const data = await res.json()
        toast({ variant: 'destructive', title: t.common.error, description: data.erro })
      }
    } catch {
      toast({ variant: 'destructive', title: t.common.error, description: t.errors.serverError })
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const total = empresas.length

  return (
    <div className="space-y-6">
      <Header
        title={t.empresa.list.title}
        description={
          loading
            ? t.common.loading
            : `${total} ${total === 1 ? t.empresa.list.total : t.empresa.list.totalPlural}`
        }
      >
        <Button asChild>
          <Link href="/empresas/nova">
            <Plus className="mr-2 h-4 w-4" />
            {t.empresa.list.newButton}
          </Link>
        </Button>
      </Header>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 rounded-lg border bg-muted animate-pulse" />
          ))}
        </div>
      ) : total === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-4">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <h3 className="text-lg font-semibold">{t.empresa.list.emptyTitle}</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm">
            {t.empresa.list.emptySubtitle}
          </p>
          <Button className="mt-6" asChild>
            <Link href="/empresas/nova">
              <Plus className="mr-2 h-4 w-4" />
              {t.empresa.list.addFirst}
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {empresas.map((empresa) => (
            <EmpresaCard
              key={empresa.id}
              empresa={empresa}
              onDelete={(id, nome) => setDeleteTarget({ id, nome })}
            />
          ))}
        </div>
      )}

      <DeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        empresaNome={deleteTarget?.nome ?? ''}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  )
}
