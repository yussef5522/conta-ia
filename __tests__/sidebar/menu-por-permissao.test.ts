// ⭐⭐ O MENU É ALLOWLIST — DEFAULT É ESCONDER (30/08/2026).
//
// ⚠️ A 1ª TENTATIVA FOI BLOCKLIST e falhou exatamente como blocklist falha: escondi os
// itens que EU lembrei, e o dono mediu o resultado — a operadora de estoque continuava
// vendo **Dashboard com o faturamento na tela**, Tributário, Cadastros (Empresas, Bancos,
// Clientes, Fornecedores, Categorias, Sócios), Inteligência, Auditoria, Usuários,
// Permissões e "Em breve". Tudo que eu não tinha lembrado de esconder.
//
// Agora cada item DECLARA a permissão que exige (`perm`, obrigatória no tipo — item novo
// sem ela **nem compila**) e o `SidebarItem` some sozinho quando o papel não tem a chave.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SIDEBAR = readFileSync(join(process.cwd(), 'components/sidebar/global-sidebar.tsx'), 'utf-8')
const ITEM = readFileSync(join(process.cwd(), 'components/sidebar/sidebar-item.tsx'), 'utf-8')

/** as 36 chaves REAIS do banco (seed do RBAC) + a marca do workspace pessoal */
const CHAVES_VALIDAS = new Set([
  'audit.export', 'audit.view', 'bank_account.create', 'bank_account.delete', 'bank_account.update',
  'bank_account.view', 'category.create', 'category.deactivate', 'category.delete', 'category.reorder',
  'category.restore_template', 'category.update', 'category.view', 'company.delete', 'company.update',
  'company.view', 'dre.export', 'dre.view', 'report.export', 'report.view', 'role.create', 'role.delete',
  'role.update', 'role.view', 'stock.manage', 'stock.operate', 'stock.view', 'transaction.categorize',
  'transaction.create', 'transaction.delete', 'transaction.import_ofx', 'transaction.update',
  'transaction.view', 'user.assign_role', 'user.invite', 'user.remove',
  '@sempre', // workspace PESSOAL (PF) — não é dado da empresa
])

/** todo bloco <SidebarItem …/> com o `perm` e o `label` */
function itensDoMenu(): Array<{ label: string; perm: string | null }> {
  const out: Array<{ label: string; perm: string | null }> = []
  const re = /<SidebarItem\b([\s\S]*?)\/>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(SIDEBAR))) {
    const corpo = m[1]
    const label = /label="([^"]+)"/.exec(corpo)?.[1] ?? '(sem label)'
    const perm = /perm="([^"]+)"/.exec(corpo)?.[1] ?? null
    out.push({ label, perm })
  }
  return out
}

describe('⭐⭐ todo item do menu declara a permissão que exige', () => {
  const itens = itensDoMenu()

  it('achou o menu (o teste não passa por estar vazio)', () => {
    expect(itens.length).toBeGreaterThanOrEqual(40)
  })

  it('⭐⭐ NENHUM item sem `perm` — é isto que mata a classe "esqueceram de filtrar o novo"', () => {
    const semPerm = itens.filter((i) => !i.perm).map((i) => i.label)
    expect(semPerm, `itens sem permissão declarada: ${semPerm.join(', ')}`).toEqual([])
  })

  it('⭐ e a chave existe de verdade no RBAC (chave inventada some pra TODO MUNDO)', () => {
    // ⚠️ o OWNER tem uma lista CONCRETA de 36 chaves, não `*` — então um `perm` inventado
    // esconderia o item até do dono. Erro de digitação aqui é bug de tela pra todos.
    const invalidas = itens.filter((i) => i.perm && !CHAVES_VALIDAS.has(i.perm))
    expect(invalidas.map((i) => `${i.label}→${i.perm}`)).toEqual([])
  })

  it('⭐⭐ `perm` é OBRIGATÓRIA no tipo — item novo sem ela não compila', () => {
    expect(ITEM).toMatch(/\n\s{2}perm: string\n/)
    expect(ITEM).toMatch(/usePermissaoMenu\(perm\)/)
    expect(ITEM).toMatch(/if \(!permitido\) return null/)
  })
})

describe('⭐⭐ o que o OPERADOR_ESTOQUE enxerga', () => {
  // o papel tem exatamente estas duas chaves (conferido no banco de prod)
  const DO_OPERADOR = ['stock.view', 'stock.operate']
  const veria = (perm: string | null) => perm === '@sempre' || (perm != null && DO_OPERADOR.includes(perm))

  it('⭐⭐ o menu dela cabe numa mão: SÓ estoque', () => {
    const visiveis = itensDoMenu().filter((i) => veria(i.perm))
    const daEmpresa = visiveis.filter((i) => i.perm !== '@sempre').map((i) => i.label)
    // toda label visível tem que ser do grupo Estoque
    const ESTOQUE = [
      'Cardápio', 'Recebimentos', 'Posição', 'Catálogo', 'Movimentos', 'Contagem',
      'Real vs Teórico', 'Boletos p/ pagar', 'Produção', 'Vendas (Suitable)',
      'Etiquetas', 'Impressão', 'Certificado', 'Fichas técnicas', 'Receitas', 'Perdas', 'Entrada manual',
    ]
    const forintrusos = daEmpresa.filter((l) => !ESTOQUE.includes(l))
    expect(forintrusos, `itens FORA do estoque visíveis pra ela: ${forintrusos.join(', ')}`).toEqual([])
    expect(daEmpresa.length).toBeGreaterThan(5)
  })

  it('⛔⛔ os itens que VAZARAM na 1ª tentativa estão fechados', () => {
    // a lista exata que o dono reportou vendo na tela dela
    const VAZARAM = [
      'Dashboard', 'Recorrentes', 'Relatórios', 'Tributário', 'Empresas', 'Bancos',
      'Clientes', 'Fornecedores', 'Categorias', 'Sócios', 'Regras IA', 'Histórico OFX',
      'Usuários', 'Permissões', 'Auditoria', 'Alertas', 'Impostos', 'Chat IA', 'Configurações',
    ]
    const itens = itensDoMenu()
    for (const label of VAZARAM) {
      const achados = itens.filter((i) => i.label === label)
      if (achados.length === 0) continue // item pode ter outro nome; o teste acima cobre
      for (const a of achados) {
        expect(veria(a.perm), `"${label}" (perm=${a.perm}) AINDA aparece pra a operadora`).toBe(false)
      }
    }
  })

  it('⭐ mas o workspace PESSOAL dela continua visível (as despesas dela são dela)', () => {
    const pessoais = itensDoMenu().filter((i) => i.perm === '@sempre')
    expect(pessoais.length).toBeGreaterThan(0)
  })
})
