// Sprint Empréstimos UI (17/06/2026) — testes de presença das telas + APIs.
//
// Não renderiza componentes (sem jsdom); valida via grep que arquivos existem
// com a estrutura esperada.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..')

// ============================================================================
// 1) APIs
// ============================================================================
describe('Sprint Empréstimos UI — APIs', () => {
  const api = (path: string) => join(ROOT, 'app/api/empresas/[id]/emprestimos', path, 'route.ts')

  it('GET+POST /api/empresas/[id]/emprestimos existe', () => {
    expect(existsSync(join(ROOT, 'app/api/empresas/[id]/emprestimos/route.ts'))).toBe(true)
    const code = readFileSync(join(ROOT, 'app/api/empresas/[id]/emprestimos/route.ts'), 'utf-8')
    expect(code).toMatch(/export async function GET/)
    expect(code).toMatch(/export async function POST/)
    expect(code).toMatch(/generateSchedule/)
    expect(code).toMatch(/agregados/)
  })

  it('GET+DELETE /[loanId] (detalhe) existe', () => {
    expect(existsSync(api('[loanId]'))).toBe(true)
    const code = readFileSync(api('[loanId]'), 'utf-8')
    expect(code).toMatch(/export async function GET/)
    expect(code).toMatch(/export async function DELETE/)
    expect(code).toMatch(/chartPoints/)
    expect(code).toMatch(/installments/)
  })

  it('linkar-liberacao GET (sugestão) + POST (vincula) + DELETE (desvincula)', () => {
    expect(existsSync(api('[loanId]/linkar-liberacao'))).toBe(true)
    const code = readFileSync(api('[loanId]/linkar-liberacao'), 'utf-8')
    expect(code).toMatch(/export async function GET/)
    expect(code).toMatch(/export async function POST/)
    expect(code).toMatch(/export async function DELETE/)
    expect(code).toMatch(/disbursementTransactionId/)
  })

  it('parcelas/[number] POST (confirmar) + DELETE (desfazer)', () => {
    const p = api('[loanId]/parcelas/[number]')
    expect(existsSync(p)).toBe(true)
    const code = readFileSync(p, 'utf-8')
    expect(code).toMatch(/export async function POST/)
    expect(code).toMatch(/export async function DELETE/)
    expect(code).toMatch(/reconciledTransactionId/)
    expect(code).toMatch(/PAID_OFF/)
  })

  it('parcelas/[number]/candidatos GET', () => {
    const p = api('[loanId]/parcelas/[number]/candidatos')
    expect(existsSync(p)).toBe(true)
    const code = readFileSync(p, 'utf-8')
    expect(code).toMatch(/export async function GET/)
    expect(code).toMatch(/candidates/)
  })
})

// ============================================================================
// 2) Telas
// ============================================================================
describe('Sprint Empréstimos UI — telas', () => {
  const screen = (path: string) =>
    join(ROOT, 'app/(dashboard)/empresas/[id]/emprestimos', path, 'page.tsx')

  it('Carteira page existe + agrupado por banco + agregados + barra progresso', () => {
    const p = join(ROOT, 'app/(dashboard)/empresas/[id]/emprestimos/page.tsx')
    expect(existsSync(p)).toBe(true)
    const code = readFileSync(p, 'utf-8')
    expect(code).toMatch(/groupedByBank/)
    expect(code).toMatch(/ProgressBar/)
    expect(code).toMatch(/StatusPill/)
    expect(code).toMatch(/Dívida total|totalSaldoDevedor/)
    // KPI top revisado: Vence este mês + Parcela mensal total (substitui
    // Compromisso do mês + Juros do mês)
    expect(code).toMatch(/Vence este mês/)
    expect(code).toMatch(/Parcela mensal total/)
    expect(code).toMatch(/Próximo vencimento/)
  })

  it('Cadastro page existe + form + linkar liberação', () => {
    const p = screen('novo')
    expect(existsSync(p)).toBe(true)
    const code = readFileSync(p, 'utf-8')
    expect(code).toMatch(/PRICE/)
    expect(code).toMatch(/SAC/)
    expect(code).toMatch(/preview/)
    expect(code).toMatch(/LINK_DISBURSEMENT/)
    expect(code).toMatch(/linkar/i)
  })

  it('Detalhe page existe + KPIs + chart + cronograma', () => {
    const p = screen('[loanId]')
    expect(existsSync(p)).toBe(true)
    const code = readFileSync(p, 'utf-8')
    expect(code).toMatch(/SaldoDevedorChart/)
    expect(code).toMatch(/StatusInstallment/)
    expect(code).toMatch(/Cronograma de parcelas/)
    expect(code).toMatch(/Paga · conciliada/)
    expect(code).toMatch(/CandidatosDialog/)
  })

  it('SaldoDevedorChart + CandidatosDialog em _components', () => {
    expect(
      existsSync(
        join(
          ROOT,
          'app/(dashboard)/empresas/[id]/emprestimos/[loanId]/_components/saldo-devedor-chart.tsx',
        ),
      ),
    ).toBe(true)
    expect(
      existsSync(
        join(
          ROOT,
          'app/(dashboard)/empresas/[id]/emprestimos/[loanId]/_components/candidatos-dialog.tsx',
        ),
      ),
    ).toBe(true)
  })

  it('SaldoDevedorChart usa Recharts AreaChart com token primary', () => {
    const code = readFileSync(
      join(
        ROOT,
        'app/(dashboard)/empresas/[id]/emprestimos/[loanId]/_components/saldo-devedor-chart.tsx',
      ),
      'utf-8',
    )
    expect(code).toMatch(/AreaChart/)
    expect(code).toMatch(/hsl\(var\(--primary\)\)/)
  })
})

// ============================================================================
// 3) Sidebar nav
// ============================================================================
describe('Sprint Empréstimos UI — sidebar', () => {
  it('global-sidebar tem item Empréstimos com HandCoins', () => {
    const code = readFileSync(join(ROOT, 'components/sidebar/global-sidebar.tsx'), 'utf-8')
    expect(code).toMatch(/HandCoins/)
    expect(code).toMatch(/label="Empréstimos"/)
    expect(code).toMatch(/\/empresas\/\$\{currentEmpresaId\}\/emprestimos/)
  })
})
