// /admin (root) — Sprint 1.6.
// Redireciona pra /admin/dashboard (proxy.ts já força auth gate).

import { redirect } from 'next/navigation'

export default function AdminRoot() {
  redirect('/admin/dashboard')
}
