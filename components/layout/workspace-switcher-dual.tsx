'use client'

// Sprint PF FATIA 1 — WorkspaceSwitcher DUAL (PJ + PF).
// Substitui o switcher antigo só de empresas. Mostra ambos os contextos
// com distinção visual forte:
//   🟦 Empresas (azul, Building2)
//   🟢 Pessoal (verde, Users)
//
// Indicador de contexto ativo: pill colorida no botão (azul ou verde).

import { useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Building2,
  Check,
  ChevronsUpDown,
  Plus,
  Search,
  Settings,
  Users,
  User,
  UserRound,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { useEmpresa } from '@/lib/contexts/empresa-context'
import { useWorkspace, type ProfileMini } from '@/lib/contexts/workspace-context'

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export function WorkspaceSwitcherDual() {
  const router = useRouter()
  const pathname = usePathname()
  const empresaCtx = useEmpresa()
  const wsCtx = useWorkspace()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)

  const isPF = wsCtx.workspaceType === 'pf'

  const empresasFiltradas = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return empresaCtx.empresas
    return empresaCtx.empresas.filter((e) =>
      `${e.tradeName ?? ''} ${e.name}`.toLowerCase().includes(term),
    )
  }, [empresaCtx.empresas, q])

  const perfisFiltrados = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return wsCtx.profiles
    return wsCtx.profiles.filter((p) => p.name.toLowerCase().includes(term))
  }, [wsCtx.profiles, q])

  function selectEmpresa(id: string) {
    void wsCtx.setWorkspace('pj')
    // Bug 2 fix: se user está numa página PF (/perfis/...), navega pro
    // dashboard PJ antes do setCurrentEmpresa. Senão o router.refresh
    // do empresa-context refresca a página PF atual, não navega.
    if (pathname.startsWith('/perfis/') || pathname === '/perfis') {
      router.push(`/dashboard?empresa=${id}`)
    }
    void empresaCtx.setCurrentEmpresa(id)
    setOpen(false)
    setQ('')
  }

  function selectPerfil(id: string) {
    void wsCtx.setWorkspace('pf', id)
    router.push(`/perfis/${id}`)
    setOpen(false)
    setQ('')
  }

  // Label + cor do botão
  const currentLabel = isPF
    ? wsCtx.currentProfile?.name ?? 'Selecionar perfil'
    : empresaCtx.currentEmpresa
      ? empresaCtx.currentEmpresa.tradeName ?? empresaCtx.currentEmpresa.name
      : empresaCtx.loading
        ? 'Carregando…'
        : empresaCtx.empresas.length === 0
          ? 'Sem empresas'
          : 'Selecionar empresa'

  const currentInitials = isPF
    ? wsCtx.currentProfile
      ? initials(wsCtx.currentProfile.name)
      : 'PF'
    : empresaCtx.currentEmpresa
      ? initials(empresaCtx.currentEmpresa.tradeName ?? empresaCtx.currentEmpresa.name)
      : 'CA'

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        {/**
         * ⭐⭐ O SELETOR É A PÍLULA `.empresa` DA REFERÊNCIA (14/10): nome em 700/13.5px + SELO
         * do tipo + seta. ⛔ O quadradinho de iniciais coloridas SAIU — o nome já carrega a
         * identidade e o selo carrega o tipo; o quadrado repetia a mesma informação num 3º
         * elemento e a referência não o tem.
         * ⚠️ E o SELO não é enfeite: ele é o que separa *"a Caçula"* de *"o meu bolso"* num
         * olhar. Por isso ele **não é `hidden sm:inline`** como era antes — no celular, que é
         * onde o dono mais opera, era justo ali que a distinção sumia.
         */}
        <button type="button" className="empresa min-w-0 max-w-[260px]">
          <span className="truncate">{currentLabel}</span>
          <span className={isPF ? 'pf' : 'pj'}>
            {isPF ? (
              <>
                <UserRound className="mr-0.5 inline h-2.5 w-2.5" aria-hidden="true" />
                PF
              </>
            ) : (
              <>
                <Building2 className="mr-0.5 inline h-2.5 w-2.5" aria-hidden="true" />
                PJ
              </>
            )}
          </span>
          <ChevronsUpDown className="h-[13px] w-[13px] shrink-0 opacity-60" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[320px] p-0">
        {/* Search */}
        <div className="border-b p-2">
          <div className="relative">
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar workspace…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full h-8 pl-7 pr-2 text-sm rounded-md bg-muted border-0 focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
          </div>
        </div>

        <div className="max-h-[400px] overflow-y-auto py-1">
          {/* SEÇÃO EMPRESAS (PJ) — azul */}
          <div className="px-3 pt-2 pb-1 flex items-center gap-1.5">
            <Building2 className="h-3 w-3 text-blue-600" />
            <span className="text-[10px] uppercase font-semibold text-blue-700 tracking-wide">
              Empresas {empresasFiltradas.length > 0 && `(${empresasFiltradas.length})`}
            </span>
          </div>
          {empresasFiltradas.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              {q ? 'Nenhuma empresa encontrada' : 'Você não tem empresas'}
            </div>
          ) : (
            empresasFiltradas.map((e) => (
              <RowPJ
                key={e.id}
                empresa={e}
                isCurrent={!isPF && empresaCtx.currentEmpresaId === e.id}
                onSelect={() => selectEmpresa(e.id)}
              />
            ))
          )}

          <DropdownMenuSeparator />

          {/* SEÇÃO PESSOAL (PF) — verde */}
          <div className="px-3 pt-2 pb-1 flex items-center gap-1.5">
            <Users className="h-3 w-3 text-emerald-600" />
            <span className="text-[10px] uppercase font-semibold text-emerald-700 tracking-wide">
              Pessoal {perfisFiltrados.length > 0 && `(${perfisFiltrados.length})`}
            </span>
          </div>
          {perfisFiltrados.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              {q
                ? 'Nenhum perfil encontrado'
                : wsCtx.loadingProfiles
                  ? 'Carregando…'
                  : 'Você não tem perfis pessoais'}
            </div>
          ) : (
            perfisFiltrados.map((p) => (
              <RowPF
                key={p.id}
                profile={p}
                isCurrent={isPF && wsCtx.currentProfileId === p.id}
                onSelect={() => selectPerfil(p.id)}
              />
            ))
          )}
        </div>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-sm"
          onSelect={() => router.push('/empresas/nova')}
        >
          <Plus className="mr-2 h-4 w-4 text-blue-600" />
          Criar nova empresa
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer text-sm"
          onSelect={() => router.push('/perfis/novo')}
        >
          <Plus className="mr-2 h-4 w-4 text-emerald-600" />
          Criar perfil pessoal
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function RowPJ({
  empresa,
  isCurrent,
  onSelect,
}: {
  empresa: { id: string; name: string; tradeName: string | null }
  isCurrent: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-blue-50 ${
        isCurrent ? 'bg-blue-50/60' : ''
      }`}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded bg-blue-600 text-white text-[10px] font-bold shrink-0">
        {initials(empresa.tradeName ?? empresa.name)}
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">
          {empresa.tradeName ?? empresa.name}
        </div>
        {empresa.tradeName && (
          <div className="text-xs text-muted-foreground truncate">{empresa.name}</div>
        )}
      </div>
      {isCurrent && <Check className="h-4 w-4 text-blue-600 shrink-0" />}
    </button>
  )
}

function RowPF({
  profile,
  isCurrent,
  onSelect,
}: {
  profile: ProfileMini
  isCurrent: boolean
  onSelect: () => void
}) {
  const Icon = profile.type === 'DEPENDENT' ? User : UserRound
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-emerald-50 ${
        isCurrent ? 'bg-emerald-50/60' : ''
      }`}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded bg-emerald-600 text-white text-[10px] font-bold shrink-0">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{profile.name}</div>
        <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
          {profile.isSelf && <span className="text-emerald-700">Meu</span>}
          {profile.isSelf && profile.type === 'DEPENDENT' && <span>·</span>}
          <span>{profile.type === 'DEPENDENT' ? 'Dependente' : profile.isSelf ? 'Titular' : 'Perfil'}</span>
        </div>
      </div>
      {isCurrent && <Check className="h-4 w-4 text-emerald-600 shrink-0" />}
    </button>
  )
}
