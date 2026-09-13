'use client'

// ⭐⭐⭐ O BOTTOM-NAV DO PF (13/09) — padrão Monarch/Mobills no celular.
//
// **O dono:** *"BOTTOM-NAV de 4 abas + FAB central: Início · Lançamentos · ＋ · Cartões ·
// Contas. O FAB continua o da frase."*
//
// ⚠️ **Não é uma segunda navegação:** no celular a sidebar global vive atrás do hambúrguer
// — ela é o menu COMPLETO, e este é o atalho de polegar pras 4 telas do dia a dia. No
// desktop ele não existe (`lg:hidden`), porque lá a espinha está sempre à vista.
//
// ⛔ E o ＋ é **o mesmo** `LancamentoRapido` do dashboard: um modal de lançamento, não dois.

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { M } from './widgets-pf'

const ABAS = [
  { rota: '', rotulo: 'Início', icone: '🏠' },
  { rota: '/transacoes', rotulo: 'Lançamentos', icone: '📄' },
  null, // ⭐ o buraco do FAB, no centro
  { rota: '/cartoes', rotulo: 'Cartões', icone: '💳' },
  { rota: '/contas', rotulo: 'Contas', icone: '🏦' },
] as const

export function BottomNavPF({ profileId, aoLancar }: { profileId: string; aoLancar: () => void }) {
  const pathname = usePathname()
  const base = `/perfis/${profileId}`

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t px-1 pb-[env(safe-area-inset-bottom)] pt-1 lg:hidden"
      style={{ background: M.card, borderColor: M.line, boxShadow: '0 -2px 12px rgba(28,32,48,.06)' }}>
      {ABAS.map((a, i) => {
        if (!a) {
          return (
            <button key="fab" onClick={aoLancar} aria-label="Novo lançamento"
              className="-mt-6 flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-[28px] text-white"
              style={{ background: `linear-gradient(140deg,${M.roxo},${M.roxo2})`, boxShadow: '0 8px 22px rgba(83,74,183,.4)' }}>
              ＋
            </button>
          )
        }
        const href = base + a.rota
        // ⚠️ a Início só é ativa na rota EXATA — senão ela acenderia em toda tela do perfil
        const ativo = a.rota === '' ? pathname === base : pathname.startsWith(href)
        return (
          <Link key={a.rotulo} href={href} className="flex min-w-0 flex-1 flex-col items-center gap-0.5 py-1.5"
            style={{ color: ativo ? M.roxo : M.sub }}>
            <span className="text-[18px] leading-none" style={{ opacity: ativo ? 1 : 0.65 }}>{a.icone}</span>
            <span className="truncate text-[10px]" style={{ fontWeight: ativo ? 800 : 500 }}>{a.rotulo}</span>
          </Link>
        )
      })}
    </nav>
  )
}
