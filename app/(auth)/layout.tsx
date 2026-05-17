// Layout do grupo (auth) — Sprint 1.2.
// Simplificado: cada página filha gerencia seu próprio layout (login premium
// usa split 40/60; cadastro usa form centralizado).

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-background">{children}</div>
}
