// ⛔⛔⛔ A PORTA TEM QUE ACOMPANHAR A SALA (09/09/2026) — a lição das DUAS PORTAS, 3ª vez.
//
// **O CASO:** o Cristian (GERENTE_ESTOQUE) não conseguia chegar em `/equipe`. Em 08/09 eu
// abri a **PÁGINA** pra `['user.invite', 'stock.manage']` — porque a tela faz duas coisas:
// gerenciar quem **LOGA** e gerenciar **COLABORADOR** de produção — e **deixei o item do
// menu exigindo só `user.invite`**.
//
// **MEDIDO EM PROD, papel a papel, com as chaves REAIS do banco:**
//   OWNER (37 chaves) ............ menu ✅ · página ✅ · PIN ✅
//   GERENTE_ESTOQUE (4 chaves) ... menu ⛔ · página ✅ · PIN ✅   ← Cristian E marcyelle
//   EXECUTOR_PRODUCAO (1 chave) .. menu ⛔ · página ⛔ · PIN ⛔   (correto)
//
// ⛔ **PORTA FECHADA COM A SALA ABERTA:** dois gerentes PODIAM usar a tela e não tinham como
// CHEGAR nela. É a metade complementar do defeito de 08/09 do próprio `/equipe` (*"uma
// permissão na PORTA escondia um gesto que o servidor já autorizava"*) — lá a porta era mais
// restrita que a ação; aqui o MENU ficou mais restrito que a porta.
//
// ⭐ **A REGRA QUE ESTE GUARD TRAVA:** o item do menu nunca pode exigir MAIS do que a página
// pra onde ele leva. Se a página aceita `A ou B`, o menu aceita `A ou B`.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { permissionMatches } from '@/lib/auth/permissions'

const raiz = process.cwd()
const SIDEBAR = readFileSync(join(raiz, 'components/sidebar/global-sidebar.tsx'), 'utf-8')

/** o `perm` declarado no item de menu que aponta pra um href */
function permDoMenu(href: string): string | null {
  for (const m of SIDEBAR.matchAll(/<SidebarItem\b([\s\S]*?)\/>/g)) {
    const corpo = m[1]
    const h = /href=\{?[`"]([^`"]+)/.exec(corpo)?.[1] ?? ''
    if (h === href) return /perm="([^"]+)"/.exec(corpo)?.[1] ?? null
  }
  return null
}

/** o que a PÁGINA exige (o `requirePermission` do server component) */
function permDaPagina(arquivo: string): string[] {
  const src = readFileSync(join(raiz, arquivo), 'utf-8')
  const m = /requirePermission:\s*(\[[^\]]*\]|'[^']*')/.exec(src)
  if (!m) return []
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
}

/** a régua do menu, igual à do `usePermissaoMenu` (qualquer uma das separadas por `|`) */
const menuLibera = (perm: string | null, chaves: string[]) =>
  perm != null && perm.split('|').some((k) => permissionMatches(chaves, k.trim()))

/** ⚠️ as chaves REAIS dos papéis, conferidas no banco de prod em 09/09 */
const PAPEIS = {
  OWNER: null, // lista concreta de 37; o que importa aqui é que ele tem as duas
  GERENTE_ESTOQUE: ['stock.executar', 'stock.manage', 'stock.operate', 'stock.view'],
  EXECUTOR_PRODUCAO: ['stock.executar'],
} as const

describe('⛔⛔ /equipe — o menu não pode ser mais restrito que a página', () => {
  const PAGINA = 'app/(dashboard)/equipe/page.tsx'

  it('⭐ a página aceita user.invite OU stock.manage (a tela faz duas coisas)', () => {
    expect(permDaPagina(PAGINA).sort()).toEqual(['stock.manage', 'user.invite'])
  })

  it('⛔⛔ e o MENU aceita exatamente o mesmo conjunto', () => {
    const doMenu = (permDoMenu('/equipe') ?? '').split('|').map((s) => s.trim()).sort()
    expect(doMenu, 'o item do menu ficou mais restrito que a página que ele abre').toEqual(
      permDaPagina(PAGINA).sort(),
    )
  })

  it('⛔⛔ O CASO CRISTIAN: com as 4 chaves reais dele, o link APARECE', () => {
    expect(menuLibera(permDoMenu('/equipe'), [...PAPEIS.GERENTE_ESTOQUE])).toBe(true)
  })

  it('⭐ e ele continua podendo REDEFINIR PIN — a ação é stock.manage', () => {
    const rota = readFileSync(join(raiz, 'app/api/empresas/[id]/estoque/colaboradores/route.ts'), 'utf-8')
    expect(rota).toContain("guardStock(request, companyId, 'stock.manage')")
    expect(permissionMatches([...PAPEIS.GERENTE_ESTOQUE], 'stock.manage')).toBe(true)
  })

  it('⛔ abrir a porta NÃO afrouxou a ação: quem só executa continua fora dos três', () => {
    // ⚠️ porta e ação são travas diferentes — o teste trava as duas (lição de 08/09).
    const executor = [...PAPEIS.EXECUTOR_PRODUCAO]
    expect(menuLibera(permDoMenu('/equipe'), executor), 'o tablet não vê o menu da Equipe').toBe(false)
    expect(permDaPagina(PAGINA).some((k) => permissionMatches(executor, k)), 'nem abre a página').toBe(false)
    expect(permissionMatches(executor, 'stock.manage'), 'nem redefine PIN').toBe(false)
  })

  it('⭐ a Produção continua oferecendo o atalho pra Equipe', () => {
    // ⚠️ é o caminho que o gerente usa de fato: ele vive na Produção, não no menu Sistema.
    const prod = readFileSync(join(raiz, 'app/(dashboard)/empresas/[id]/estoque/producao/page.tsx'), 'utf-8')
    expect(prod).toContain('/equipe?filtro=cozinha')
  })
})

describe('⭐ a régua "qualquer uma destas" do menu', () => {
  it('libera quando o papel tem UMA das chaves, não exige TODAS', () => {
    expect(menuLibera('user.invite|stock.manage', ['stock.manage'])).toBe(true)
    expect(menuLibera('user.invite|stock.manage', ['user.invite'])).toBe(true)
    expect(menuLibera('user.invite|stock.manage', ['stock.view'])).toBe(false)
  })

  it('⭐ e o wildcard do papel continua valendo dentro da lista', () => {
    expect(menuLibera('user.invite|stock.manage', ['stock.*'])).toBe(true)
    expect(menuLibera('user.invite|stock.manage', ['*'])).toBe(true)
  })
})
