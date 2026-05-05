// Lista canônica de permissions do sistema (Sub-etapa 5.3.A).
// Esta é a fonte única de verdade — código nunca usa string solta.
// Adicionar nova permission: 1) adicionar aqui, 2) seed atualizado, 3) backfill.

export interface PermissionDef {
  key: string
  name: string
  description: string
  group: string
}

export const PERMISSIONS: PermissionDef[] = [
  // ═══ Categorias ═══
  { key: 'category.view',             name: 'Visualizar categorias',  description: 'Ver plano de contas',                              group: 'Categorias' },
  { key: 'category.create',           name: 'Criar categoria',        description: 'Criar novas categorias',                           group: 'Categorias' },
  { key: 'category.update',           name: 'Editar categoria',       description: 'Alterar categorias existentes',                    group: 'Categorias' },
  { key: 'category.delete',           name: 'Excluir categoria',      description: 'Excluir permanentemente categorias',               group: 'Categorias' },
  { key: 'category.deactivate',       name: 'Desativar categoria',    description: 'Desativar categorias (soft delete)',               group: 'Categorias' },
  { key: 'category.reorder',          name: 'Reordenar categorias',   description: 'Mover categorias por drag-and-drop',               group: 'Categorias' },
  { key: 'category.restore_template', name: 'Restaurar template',     description: 'Aplicar template oficial do setor',                group: 'Categorias' },

  // ═══ Transações ═══
  { key: 'transaction.view',       name: 'Visualizar transações', description: 'Ver lista de transações',         group: 'Transações' },
  { key: 'transaction.create',     name: 'Criar transação',       description: 'Adicionar receitas/despesas',     group: 'Transações' },
  { key: 'transaction.update',     name: 'Editar transação',      description: 'Alterar transações existentes',   group: 'Transações' },
  { key: 'transaction.delete',     name: 'Excluir transação',     description: 'Remover transações',              group: 'Transações' },
  { key: 'transaction.import_ofx', name: 'Importar OFX',          description: 'Importar extratos bancários',     group: 'Transações' },
  { key: 'transaction.categorize', name: 'Categorizar transações', description: 'Atribuir categoria a transações', group: 'Transações' },

  // ═══ Contas Bancárias ═══
  { key: 'bank_account.view',   name: 'Visualizar contas bancárias', description: 'Ver lista de contas bancárias', group: 'Contas Bancárias' },
  { key: 'bank_account.create', name: 'Criar conta bancária',         description: 'Adicionar conta bancária',      group: 'Contas Bancárias' },
  { key: 'bank_account.update', name: 'Editar conta bancária',        description: 'Alterar dados de conta',        group: 'Contas Bancárias' },
  { key: 'bank_account.delete', name: 'Excluir conta bancária',       description: 'Remover conta bancária',        group: 'Contas Bancárias' },

  // ═══ Empresa ═══
  { key: 'company.view',   name: 'Visualizar empresa', description: 'Ver dados da empresa',             group: 'Empresa' },
  { key: 'company.update', name: 'Editar empresa',     description: 'Alterar dados básicos da empresa', group: 'Empresa' },
  { key: 'company.delete', name: 'Excluir empresa',    description: 'Excluir empresa permanentemente',  group: 'Empresa' },

  // ═══ Usuários e Permissões ═══
  { key: 'user.invite',      name: 'Convidar usuário', description: 'Convidar novo usuário pra empresa', group: 'Usuários' },
  { key: 'user.remove',      name: 'Remover usuário',  description: 'Remover usuário da empresa',        group: 'Usuários' },
  { key: 'user.assign_role', name: 'Atribuir role',    description: 'Mudar role de usuário',             group: 'Usuários' },
  { key: 'role.view',        name: 'Visualizar roles', description: 'Ver roles e permissões',            group: 'Permissões' },
  { key: 'role.create',      name: 'Criar role custom', description: 'Criar nova role personalizada',    group: 'Permissões' },
  { key: 'role.update',      name: 'Editar role custom', description: 'Alterar permissões de role custom', group: 'Permissões' },
  { key: 'role.delete',      name: 'Excluir role custom', description: 'Remover role personalizada',     group: 'Permissões' },

  // ═══ Auditoria ═══
  { key: 'audit.view',   name: 'Visualizar auditoria', description: 'Ver log de alterações',     group: 'Auditoria' },
  { key: 'audit.export', name: 'Exportar auditoria',   description: 'Exportar logs em CSV/PDF',  group: 'Auditoria' },

  // ═══ Relatórios e DRE ═══
  { key: 'dre.view',      name: 'Visualizar DRE',         description: 'Ver Demonstrativo de Resultado',   group: 'Relatórios' },
  { key: 'dre.export',    name: 'Exportar DRE',           description: 'Exportar DRE em PDF/Excel',        group: 'Relatórios' },
  { key: 'report.view',   name: 'Visualizar relatórios',  description: 'Ver outros relatórios',            group: 'Relatórios' },
  { key: 'report.export', name: 'Exportar relatórios',    description: 'Exportar relatórios em PDF/Excel', group: 'Relatórios' },
]

// Roles padrão com suas permissions (wildcards permitidos)
export const DEFAULT_ROLES = {
  OWNER: {
    name: 'OWNER',
    description: 'Acesso total à empresa. Único que pode excluir empresa.',
    permissions: ['*'],
  },
  ADMIN: {
    name: 'ADMIN',
    description: 'Acesso total exceto excluir empresa.',
    permissions: [
      'category.*', 'transaction.*', 'bank_account.*',
      'company.view', 'company.update',
      'user.*', 'role.*',
      'audit.*', 'dre.*', 'report.*',
    ],
  },
  ACCOUNTANT: {
    name: 'ACCOUNTANT',
    description: 'Contador: gerencia plano de contas, transações e relatórios.',
    permissions: [
      'category.*', 'transaction.*',
      'bank_account.view',
      'company.view',
      'audit.view', 'audit.export',
      'dre.*', 'report.*',
    ],
  },
  FINANCIAL: {
    name: 'FINANCIAL',
    description: 'Financeiro: gerencia transações e contas bancárias.',
    permissions: [
      'transaction.*', 'bank_account.*',
      'category.view',
      'company.view',
      'dre.view', 'report.view',
    ],
  },
  VIEWER: {
    name: 'VIEWER',
    description: 'Consulta: apenas leitura.',
    permissions: ['*.view'],
  },
} as const

// Helper de wildcard matching: a lista `granted` (do user) cobre `required`?
// Suporta:
//   - "*"             (wildcard total)
//   - "<resource>.*"  (todas ações de um recurso)
//   - "*.<action>"    (mesma ação em todos recursos — ex: "*.view" pra Viewer)
//   - "<resource>.<action>" (match exato)
export function permissionMatches(granted: string[], required: string): boolean {
  if (granted.includes('*')) return true
  if (granted.includes(required)) return true

  const [resource, action] = required.split('.')
  if (!resource || !action) return false

  if (granted.includes(`${resource}.*`)) return true
  if (granted.includes(`*.${action}`)) return true

  return false
}

// Expande wildcards em lista concreta (pra atribuir em RolePermission no seed).
// Resultado é ordenado alfabeticamente e sem duplicatas.
export function expandPermissions(patterns: string[]): string[] {
  const expanded = new Set<string>()

  for (const pattern of patterns) {
    if (pattern === '*') {
      for (const p of PERMISSIONS) expanded.add(p.key)
      continue
    }

    if (pattern.endsWith('.*')) {
      const resource = pattern.slice(0, -2)
      for (const p of PERMISSIONS) {
        if (p.key.startsWith(`${resource}.`)) expanded.add(p.key)
      }
      continue
    }

    if (pattern.startsWith('*.')) {
      const action = pattern.slice(2)
      for (const p of PERMISSIONS) {
        if (p.key.endsWith(`.${action}`)) expanded.add(p.key)
      }
      continue
    }

    expanded.add(pattern)
  }

  return Array.from(expanded).sort()
}
