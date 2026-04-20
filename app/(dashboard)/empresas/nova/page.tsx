import { Header } from '@/components/layout/header'
import { EmpresaForm } from '@/components/empresas/empresa-form'
import { t } from '@/lib/i18n/pt-BR'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Nova Empresa' }

export default function NovaEmpresaPage() {
  return (
    <div className="space-y-6">
      <Header
        title={t.empresa.form.titleNew}
        description={t.empresa.form.subtitleNew}
      />
      <EmpresaForm />
    </div>
  )
}
