// ⛔⛔⛔ TELA DE DINHEIRO EXIGE CHAVE DE DINHEIRO (06/09/2026).
//
// **INCIDENTE:** a conta do tablet da cozinha (`EXECUTOR_PRODUCAO`, uma chave só:
// `stock.executar`) abriu o `/dashboard` e viu **31 valores em reais** — saldo total,
// por banco, receita, despesa, fluxo de 6 meses. Iguais aos do dono.
//
// ⚠️ A SIDEBAR ESCONDIA e as APIs devolviam 403. A página server monta os dados por caminho
// PRÓPRIO — outra porta. É a régua que o dono ditou: *"cada página de dado sensível exige a
// chave do dado, não só a sidebar esconder o link"*.
//
// Este arquivo tem DUAS metades: a decisão (executada) e a COBERTURA (estrutural, e assumida
// como tal — sem jsdom não dá pra renderizar um server component aqui; a prova de navegação
// roda contra prod).

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join } from 'path'
import { podeVerFinanceiro, telaInicialDe, ehChaveDeDinheiro } from '@/lib/auth/pode-ver-financeiro'
import { DEFAULT_ROLES, expandPermissions } from '@/lib/auth/permissions'

const EMPRESA = 'empresa-1'
const chavesDo = (papel: keyof typeof DEFAULT_ROLES) => expandPermissions([...DEFAULT_ROLES[papel].permissions])

describe('⛔⛔ a régua: chave de dinheiro abre tela de dinheiro', () => {
  it('⛔⛔ o TABLET (só stock.executar) NÃO vê financeiro — era o furo', () => {
    const tablet = chavesDo('EXECUTOR_PRODUCAO')
    expect(tablet).toEqual(['stock.executar'])
    expect(podeVerFinanceiro(tablet)).toBe(false)
  })

  it('⛔⛔ e a tela inicial dele é a COZINHA, não o dashboard', () => {
    expect(telaInicialDe(chavesDo('EXECUTOR_PRODUCAO'), EMPRESA)).toBe(`/cozinha/${EMPRESA}`)
  })

  it('⛔ nenhum papel de ESTOQUE vê financeiro — a fronteira do dono, na classe', () => {
    for (const papel of ['GERENTE_ESTOQUE', 'OPERADOR_ESTOQUE', 'LEITURA_ESTOQUE', 'EXECUTOR_PRODUCAO'] as const) {
      expect(podeVerFinanceiro(chavesDo(papel)), `${papel} vê financeiro`).toBe(false)
      expect(telaInicialDe(chavesDo(papel), EMPRESA), `${papel} caiu no dashboard`).not.toBeNull()
    }
  })

  it('⭐ e quem TEM dinheiro segue pro dashboard, como sempre', () => {
    for (const papel of ['OWNER', 'ADMIN', 'ACCOUNTANT', 'FINANCIAL', 'VIEWER'] as const) {
      expect(podeVerFinanceiro(chavesDo(papel)), `${papel} perdeu o dashboard`).toBe(true)
      expect(telaInicialDe(chavesDo(papel), EMPRESA)).toBeNull()
    }
  })

  it('⛔⛔ O GUARD ANTIGO deixava o tablet passar — é o red deste fix', () => {
    // a fórmula que estava no dashboard desde 30/08:
    const antigo = (ks: string[]) => {
      const c = new Set(ks)
      return !c.has('transaction.view') && !c.has('*') && c.has('stock.view')
    }
    // ⛔ pro tablet ela responde FALSE ("não é só estoque") → seguia pro dashboard
    expect(antigo(chavesDo('EXECUTOR_PRODUCAO'))).toBe(false)
    // ⭐ a régua nova responde certo
    expect(podeVerFinanceiro(chavesDo('EXECUTOR_PRODUCAO'))).toBe(false)
  })

  it('⭐ a régua é pelo DADO, não pelo papel: chave nova de estoque nasce sem ver', () => {
    expect(podeVerFinanceiro(['stock.qualquer_coisa_nova'])).toBe(false)
    expect(podeVerFinanceiro(['producao.executar', 'stock.view'])).toBe(false)
    // e chave nova de dinheiro é reconhecida pelo RECURSO, sem lista de ações
    expect(ehChaveDeDinheiro('transaction.acao_que_nao_existe_ainda')).toBe(true)
    expect(ehChaveDeDinheiro('dre.export')).toBe(true)
    expect(ehChaveDeDinheiro('stock.manage')).toBe(false)
  })

  it('⚠️ conjunto VAZIO não vê nada — e sem empresa vai pro dashboard (empty state honesto)', () => {
    expect(podeVerFinanceiro([])).toBe(false)
    // ⛔ mandar pra uma cozinha que não existe seria trocar o problema por tela quebrada
    expect(telaInicialDe([], null)).toBeNull()
  })

  it('⭐ o VIEWER (`*.view`) conta como financeiro — ele alcança transaction.view', () => {
    expect(ehChaveDeDinheiro('*.view')).toBe(true)
    expect(podeVerFinanceiro(['*.view'])).toBe(true)
  })
})

// ───────────────────────────────────────────────────────────────────────────────────
// A COBERTURA — o handler nº 51 do acesso: página server NOVA que monta dinheiro.
// ───────────────────────────────────────────────────────────────────────────────────
//
// ⚠️ ESTRUTURAL, E ASSUMIDO COMO TAL: o projeto roda em `environment: node`, sem jsdom — não
// dá pra renderizar um server component aqui. A prova de COMPORTAMENTO é a navegação contra
// produção (medida antes: 31 valores no HTML do tablet; depois: redirect pra cozinha).
// Este bloco cobre o que aquela prova não cobre: a página que ainda não existe.

const RAIZ = join(process.cwd(), 'app', '(dashboard)')
/** o que caracteriza "esta página monta dinheiro no servidor" */
const CONSULTA_BANCO = /prisma\.|from '@\/lib\/db'/
const SINAL_DE_DINHEIRO = /\b(transaction|bankAccount|balance|dreGroup|calculateDRE|fluxoDeCaixa|receitaBruta)\b/

function paginasServer(dir: string): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...paginasServer(p))
    else if (e === 'page.tsx' && !readFileSync(p, 'utf-8').slice(0, 60).includes("'use client'")) out.push(p)
  }
  return out
}

describe('⛔ nenhuma página server nova monta dinheiro sem exigir a chave', () => {
  /**
   * As que já negam, e COMO — cada uma com o motivo escrito.
   *
   * ⚠️ Isto é allowlist com justificativa, não "lista do que ignorar": entrar aqui exige
   * dizer qual é a trava. Página nova que monte dinheiro sem trava fica VERMELHA.
   */
  const JA_NEGAM: Record<string, string> = {
    'dashboard/page.tsx': 'telaInicialDe() redireciona ANTES de consultar dinheiro',
    'empresas/[id]/page.tsx': 'resolveEmpresaAccess com requirePermission (devolve 404 pro tablet — medido)',
    'empresas/[id]/relatorios/dre-gerencial/page.tsx': 'requirePermission dre.view',
    'empresas/[id]/relatorios/fluxo-caixa/page.tsx': 'requirePermission report.view',
    'empresas/[id]/relatorios/categorias/page.tsx': 'requirePermission report.view',
    'empresas/[id]/relatorios/comparativo/page.tsx': 'requirePermission report.view',
    'empresas/[id]/relatorios/fornecedores/page.tsx': 'requirePermission report.view',
    'empresas/[id]/relatorios/funcionarios/page.tsx': 'requirePermission report.view',
    'empresas/[id]/relatorios/analise-ia/page.tsx': 'requirePermission report.view',
    'empresas/[id]/relatorios/analise-variacao/page.tsx': 'requirePermission report.view',
    'empresas/[id]/relatorios/variancias/page.tsx': 'requirePermission report.view',
    'empresas/[id]/despesas/page.tsx': 'resolveEmpresaAccess',
    'empresas/[id]/contas/[contaId]/editar/page.tsx': 'resolveEmpresaAccess',
    'empresas/[id]/contas/[contaId]/transacoes/nova/page.tsx': 'resolveEmpresaAccess',
    'empresas/[id]/contas/[contaId]/transacoes/[transacaoId]/editar/page.tsx': 'resolveEmpresaAccess',
    'pendentes/page.tsx': 'client-side: o server não entrega número; a API nega (403 medido)',
    'fornecedores/page.tsx': 'client-side: o server não entrega número; a API nega',
    'imports/page.tsx': 'client-side: o server não entrega número; a API nega',
    'regras/page.tsx': 'client-side: o server não entrega número; a API nega',
  }
  /** o que uma página pode chamar pra provar que trava */
  const TRAVAS = /telaInicialDe|podeVerFinanceiro|requirePermission|resolveEmpresaAccess|getAuthContext/

  const suspeitas = paginasServer(RAIZ)
    .map((f) => ({ arquivo: f.slice(RAIZ.length + 1), src: readFileSync(f, 'utf-8') }))
    .filter((p) => CONSULTA_BANCO.test(p.src) && SINAL_DE_DINHEIRO.test(p.src))

  it('⭐ achou páginas pra checar (não passa por estar vazio)', () => {
    expect(suspeitas.length).toBeGreaterThan(3)
  })

  it('⛔⛔ toda página server que monta dinheiro trava — ou está na allowlist COM motivo', () => {
    const sem = suspeitas
      .filter((p) => !TRAVAS.test(p.src) && !JA_NEGAM[p.arquivo])
      .map((p) => p.arquivo)
    expect(sem, 'página server monta dinheiro sem exigir chave').toEqual([])
  })

  it('⚠️ e a allowlist não vira paisagem: toda entrada aponta pra arquivo que existe', () => {
    const existentes = new Set(paginasServer(RAIZ).map((f) => f.slice(RAIZ.length + 1)))
    for (const arquivo of Object.keys(JA_NEGAM)) {
      expect(existentes.has(arquivo), `allowlist aponta pra página que sumiu: ${arquivo}`).toBe(true)
    }
  })

  it('⛔⛔ o DASHBOARD especificamente chama o gate — foi ele que vazou', () => {
    const src = readFileSync(join(RAIZ, 'dashboard', 'page.tsx'), 'utf-8')
    expect(src).toMatch(/telaInicialDe\(/)
    // ⚠️ e o desvio vem ANTES do motor do dashboard: negar depois de calcular ainda passa
    // o número pelo servidor.
    expect(src.indexOf('telaInicialDe(')).toBeLessThan(src.indexOf('customPeriod'))
  })
})
