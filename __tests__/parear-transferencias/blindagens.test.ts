// Sprint Parear-Transferencias (01/07/2026) — testes de blindagem.
//
// Cobre 3 fases:
// (a) Endpoint /parear-sugestoes (validações do match: contas diferentes,
//     valor ±0.01, ±3d, PENDING, tipos opostos)
// (b) UI /parear (pares sugeridos + manual + botão descoberta no dashboard)
// (c) Dashboard-summary aceita ?mes=YYYY-MM + fallback auto-detect
// (d) Placeholder TransferPanel da conciliação vira link útil

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const root = (p: string) => join(__dirname, '..', '..', p)
const read = (p: string) => readFileSync(root(p), 'utf-8')

describe('a) Endpoint /parear-sugestoes', () => {
  const p = 'app/api/empresas/[id]/transferencias/parear-sugestoes/route.ts'
  it('existe', () => {
    expect(existsSync(root(p))).toBe(true)
  })
  const code = read(p)
  it('filtra por status=PENDING', () => {
    expect(code).toMatch(/status:\s*['"]PENDING['"]/)
  })
  it('exige transferGroupId null (não já pareado)', () => {
    expect(code).toMatch(/transferGroupId:\s*null/)
  })
  it('separa DEBIT + CREDIT', () => {
    expect(code).toMatch(/type:\s*['"]DEBIT['"]/)
    expect(code).toMatch(/type:\s*['"]CREDIT['"]/)
  })
  it('exige contas diferentes', () => {
    expect(code).toMatch(/d\.bankAccountId === c\.bankAccountId.*continue/)
  })
  it('valor idêntico ±0.01', () => {
    expect(code).toMatch(/Math\.abs\(d\.amount - c\.amount\)\s*>\s*0\.01/)
  })
  it('janela de dias = 3', () => {
    expect(code).toMatch(/DAYS_WINDOW\s*=\s*3/)
  })
  it('RBAC transaction.view', () => {
    expect(code).toMatch(/requirePermission\(['"]transaction\.view['"]\)/)
  })
  it('sort: same-day primeiro, depois valor desc', () => {
    expect(code).toMatch(/sameDay/)
    expect(code).toMatch(/b\.debit\.amount - a\.debit\.amount/)
  })
})

describe('b) UI /parear', () => {
  const p = 'app/(dashboard)/empresas/[id]/transferencias/parear/page.tsx'
  it('existe', () => {
    expect(existsSync(root(p))).toBe(true)
  })
  const code = read(p)
  it('chama POST /api/transferencias/pair-pendentes (não createTransfer)', () => {
    expect(code).toMatch(/\/api\/transferencias\/pair-pendentes/)
    expect(code).toMatch(/transacaoIdA/)
    expect(code).toMatch(/transacaoIdB/)
  })
  it('NÃO chama POST /api/transferencias (criaria novas)', () => {
    // Body faz POST só pra pair-pendentes. Não pode ter POST direto pro criador.
    const posts = code.match(/method:\s*['"]POST['"]/g) ?? []
    // Espera 2 POSTs — um pra sugestão (handlePair), um pra manual (handleManualPair).
    // Ambos apontam pra /pair-pendentes.
    expect(posts.length).toBeGreaterThanOrEqual(2)
    const semPairPendentes = code.match(
      /fetch\(['"`]\/api\/transferencias['"`]/g,
    )
    expect(semPairPendentes).toBeNull()
  })
  it('aviso explicativo diferencia de "Nova transferência"', () => {
    expect(code).toMatch(/Não cria transações novas/)
    expect(code).toMatch(/liga 2 transações que já existem/)
  })
  it('lista pares sugeridos + ferramenta manual', () => {
    expect(code).toMatch(/Pares sugeridos/)
    expect(code).toMatch(/Casar manualmente/)
  })
  it('empty state bonito', () => {
    expect(code).toMatch(/Nenhum par sugerido/)
  })
  it('microinteração de saída no card + toast', () => {
    expect(code).toMatch(/AnimatePresence/)
    expect(code).toMatch(/removingKeys/)
    expect(code).toMatch(/Transferência casada/)
  })
})

describe('b2) Descoberta — botão "Parear existentes" no dashboard', () => {
  const code = read('app/(dashboard)/empresas/[id]/transferencias/page.tsx')
  it('linka pra /transferencias/parear', () => {
    expect(code).toMatch(/\/transferencias\/parear/)
  })
  it('label "Parear existentes"', () => {
    expect(code).toMatch(/Parear existentes/)
  })
})

describe('c) Dashboard-summary: mes param + auto-detect', () => {
  const code = read('app/api/empresas/[id]/transferencias/dashboard-summary/route.ts')
  it('aceita searchParams "mes"', () => {
    expect(code).toMatch(/searchParams\.get\(['"]mes['"]\)/)
  })
  it('parseMesParam com regex YYYY-MM', () => {
    expect(code).toMatch(/parseMesParam/)
    expect(code).toMatch(/\^\(\\d\{4\}\)-\(\\d\{2\}\)\$/)
  })
  it('fallback: procura último mês com dados quando atual vazio', () => {
    expect(code).toMatch(/temEsteMs\s*===\s*0/)
    expect(code).toMatch(/autoDetectado/)
    expect(code).toMatch(/findFirst[\s\S]{0,300}orderBy:\s*\{\s*date:\s*['"]desc['"]/)
  })
  it('response inclui mesParam + autoDetectado', () => {
    expect(code).toMatch(/mesParam:/)
    expect(code).toMatch(/autoDetectado,/)
  })
})

describe('c2) UI dashboard: seletor de mês', () => {
  const code = read('app/(dashboard)/empresas/[id]/transferencias/page.tsx')
  it('mesSelecionado state', () => {
    expect(code).toMatch(/mesSelecionado/)
    expect(code).toMatch(/setMesSelecionado/)
  })
  it('input type=month', () => {
    expect(code).toMatch(/type=["']month["']/)
  })
  it('URL do fetch usa ?mes= quando selecionado', () => {
    expect(code).toMatch(/dashboard-summary\?mes=\$\{mesAtual\}/)
  })
  it('banner quando autoDetectado', () => {
    expect(code).toMatch(/autoDetectado/)
    expect(code).toMatch(/último com movimento/)
  })
})

describe('d) TransferPanel da conciliação vira link útil', () => {
  const code = read('components/conciliacao/xero-row.tsx')
  it('recebe empresaId', () => {
    expect(code).toMatch(/function TransferPanel\(\{\s*empresaId/)
  })
  it('link aponta pra /transferencias/parear', () => {
    expect(code).toMatch(/\/empresas\/\$\{empresaId\}\/transferencias\/parear/)
  })
  it('label "Ir para Parear transferências"', () => {
    expect(code).toMatch(/Ir para Parear transferências/)
  })
  it('NÃO tem mais o texto "Fase B.3" no TransferPanel', () => {
    // Ainda pode existir "Fase B.3" no cabeçalho do arquivo (comentário
    // histórico) e no DiscussPanel. Limita ao bloco TransferPanel.
    const bloco = code.match(/function TransferPanel[\s\S]+?^\}/m)?.[0] ?? ''
    expect(bloco).not.toMatch(/Fase B\.3/)
    expect(bloco).not.toMatch(/reusar fluxo de Transferências/)
  })
})

describe('e) Preservação — endpoint pair-pendentes intacto', () => {
  const code = read('app/api/transferencias/pair-pendentes/route.ts')
  it('endpoint mantém shape original', () => {
    expect(code).toMatch(/pairPendentes/)
    expect(code).toMatch(/POST/)
  })
  it('createTransfer NÃO é chamado pela UI /parear', () => {
    const uiCode = read('app/(dashboard)/empresas/[id]/transferencias/parear/page.tsx')
    expect(uiCode).not.toMatch(/createTransfer/)
  })
})
