import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { DashboardShell } from '@/components/layout/dashboard-shell'
// Sprint Perf P3 (31/05/2026): Toaster movido do root layout pra cá
// (dashboard inteiro usa toast; landing pública não usa).
import { Toaster } from '@/components/ui/toaster'
// Sprint Engine de Assinatura FATIA 1 (31/05/2026): banner trial no topo
import { TrialBanner } from '@/components/layout/trial-banner'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value

  if (!token) redirect('/login')

  let user
  try {
    user = await verifyToken(token)
  } catch {
    redirect('/login')
  }

  return (
    <DashboardShell userName={user.name} userEmail={user.email}>
      <TrialBanner />
      {children}
      <Toaster />
    </DashboardShell>
  )
}
