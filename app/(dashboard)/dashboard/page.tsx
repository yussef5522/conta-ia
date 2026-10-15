/**
 * ⭐⭐⭐ A MESA DE OPERAÇÕES ① É A HOME (15/10/2026) — o dashboard Mercury morreu aqui.
 *
 * **`docs/dashboard-referencia.html` é a LEI** do visual e do comportamento desta tela. Os
 * módulos, a ordem e os spans saem do arquivo; o guard
 * (`__tests__/regras-ui/dashboard-bate-com-a-referencia.test.ts`) **abre a referência** e
 * compara — *divergência da referência = defeito*.
 *
 * ⛔⛔ **A HOME VELHA MORREU, não ficou ao lado.** O `MercuryDashboard`, o `PeriodSelector` e os
 * empty states de período saíram do render. ⚠️ *Quando a tela nova assume, a velha MORRE NO
 * MESMO DEPLOY* (a régua de 14/09) — conviver *"por enquanto"* é como nasce a página com duas
 * verdades sobre o mesmo mês.
 *
 * ⭐ **O QUE FOI PRESERVADO, e por quê:** a resolução de empresa pelas DUAS portas de vínculo
 * (`UserCompany` legado **e** `UserCompanyRole` do RBAC — checar UMA era o bug que deixava a
 * convidada no empty state, 30/08) · o redirect do workspace PF · o **gate de quem não tem
 * chave de dinheiro** (o incidente do tablet da cozinha, 06/09: *esconder o link não é negar o
 * dado*) · o empty state de empresa sem conta · e o **selo do juiz**, que continua no topo
 * porque *remoção sem realocação é perda* (10/09) e o radar fala de outra coisa.
 *
 * ⚠️ O gate de permissão roda **ANTES** de qualquer leitura de dinheiro: negar tarde ainda
 * deixa o número passar pelo servidor.
 */
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { getCurrentEmpresaIdFromCookie } from '@/lib/auth/current-empresa-cookie'
import { telaInicialDe } from '@/lib/auth/pode-ver-financeiro'
import { prisma } from '@/lib/db'
import type { Metadata } from 'next'
import { JuizSelo } from './_components/JuizSelo'
import { MesaDeOperacoes } from './_components/MesaDeOperacoes'
import { NoCompaniesEmpty, NoAccountsEmpty } from './_components/EmptyDashboard'

export const metadata: Metadata = { title: 'Dashboard' }

interface PageProps {
  searchParams: Promise<{ empresa?: string }>
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) redirect('/login')

  const workspaceType = cookieStore.get('caixaos_workspace_type')?.value
  if (workspaceType === 'pf') {
    const profileId = cookieStore.get('caixaos_perfil_atual')?.value
    if (profileId) redirect(`/perfis/${profileId}`)
  }

  const user = await verifyToken(token)
  const sp = await searchParams

  /**
   * ⭐⭐ AS DUAS PORTAS DE VÍNCULO (30/08/2026). Esta página lia só `UserCompany` (o modelo
   * ANTIGO) e o convite grava `UserCompanyRole` (RBAC): a convidada caía no empty state *"você
   * não está em nenhuma empresa"* **sendo membro de verdade**.
   */
  const [porLegado, porPapel] = await Promise.all([
    prisma.userCompany.findMany({
      where: { userId: user.sub },
      include: { company: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.userCompanyRole.findMany({
      where: { userId: user.sub },
      include: {
        company: true,
        role: { include: { permissions: { include: { permission: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ])
  const porId = new Map<string, (typeof porLegado)[number]['company']>()
  for (const uc of porLegado) porId.set(uc.company.id, uc.company)
  for (const ucr of porPapel) porId.set(ucr.company.id, ucr.company)
  const empresas = [...porId.values()]

  /**
   * ⛔⛔⛔ QUEM NÃO TEM CHAVE DE DINHEIRO NÃO VÊ ESTA TELA (06/09/2026). A conta do TABLET
   * abriu aqui e o dono viu o dashboard inteiro — a sidebar escondia os itens e as APIs
   * devolviam 403, mas **esta página monta os dados por caminho PRÓPRIO**.
   */
  const chaves = new Set(
    porPapel.flatMap((p) => p.role.permissions.map((rp) => rp.permission.key)),
  )
  const destino = telaInicialDe(chaves, porPapel[0]?.companyId ?? empresas[0]?.id ?? null)
  if (destino) redirect(destino)

  if (empresas.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-medium">Bem-vindo, {user.name.split(' ')[0]}</h1>
        <NoCompaniesEmpty />
      </div>
    )
  }

  const cookieEmpresaId = await getCurrentEmpresaIdFromCookie()
  const fromQuery = sp.empresa ? empresas.find((e) => e.id === sp.empresa) : undefined
  const fromCookie = cookieEmpresaId ? empresas.find((e) => e.id === cookieEmpresaId) : undefined
  const empresaAtual = fromQuery ?? fromCookie ?? empresas[0]

  const contasCount = await prisma.bankAccount.count({
    where: { companyId: empresaAtual.id, isActive: true },
  })

  return (
    <div className="-mx-4 lg:-mx-6">
      {/*
       * ───────────── O TOPO ─────────────
       * ⭐ Os chips ① / ② são a navegação entre as duas mesas. ⚠️ O ② é um `Link` de verdade,
       * não um `onClick` fingindo navegação: a mesa ② é OUTRA rota (`estoque/producao/hoje`), e
       * link é o que dá teclado, botão do meio e "abrir em nova aba" de graça.
       */}
      <div
        className="flex flex-wrap items-center gap-[14px] border-b px-[26px] py-[14px] max-[1023px]:px-[14px]"
        style={{ borderColor: 'var(--prod-line-strong)' }}
      >
        <div className="text-[13px] font-extrabold" style={{ color: 'var(--prod-primary)' }}>
          {empresaAtual.tradeName ?? empresaAtual.name}
        </div>
        <div className="flex gap-[8px]">
          <span
            className="rounded-full border px-[15px] py-[7px] text-[12.5px] font-extrabold"
            style={{
              borderColor: 'var(--prod-accent)',
              background: 'var(--fam-indigo-bg)',
              color: 'var(--prod-accent)',
            }}
            aria-current="page"
          >
            ① Dashboard
          </span>
          <Link
            href={`/empresas/${empresaAtual.id}/estoque/producao/hoje`}
            className="rounded-full border px-[15px] py-[7px] text-[12.5px] font-extrabold"
            style={{
              borderColor: 'var(--prod-line-strong)',
              background: 'var(--prod-surface)',
              color: 'var(--prod-secondary)',
            }}
          >
            ② Produção
          </Link>
        </div>
        <div className="ml-auto">
          <JuizSelo />
        </div>
      </div>

      {contasCount === 0 ? (
        <div className="px-[26px] py-[18px] max-[1023px]:px-[14px]">
          <NoAccountsEmpty empresaId={empresaAtual.id} />
        </div>
      ) : (
        <MesaDeOperacoes empresaId={empresaAtual.id} />
      )}
    </div>
  )
}
