// Sprint 5.0.2.h — Redirect via route handler (cookies só em Server Action/Route Handler).

import { redirect } from 'next/navigation'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function OldPage({ params }: PageProps) {
  const { id } = await params
  redirect(`/api/empresas/${id}/select-and-redirect?to=/regras`)
}
