// Sprint Filtro de Data Parte A — testes de presença + helpers puros.
// (a) /api/transferencias filtra por data (lê código)
// (b) helper rangeForPreset retorna intervalos consistentes
// (c) /api/transacoes cap subiu pra 500

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { rangeForPreset } from '../lib/hooks/use-date-range-filter'

const ROOT = join(__dirname, '..')

describe('Sprint Filtro de Data Parte A — backend honra inicio/fim', () => {
  it('/api/transferencias monta dateFilter (gte/lte) quando inicio/fim presentes', () => {
    const code = readFileSync(join(ROOT, 'app/api/transferencias/route.ts'), 'utf-8')
    expect(code).toMatch(/searchParams\.get\('inicio'\)/)
    expect(code).toMatch(/searchParams\.get\('fim'\)/)
    expect(code).toMatch(/dateFilter\.gte\s*=\s*new Date\(inicio\)/)
    expect(code).toMatch(/dateFilter\.lte\s*=\s*new Date\(fim/)
    expect(code).toMatch(/date: dateFilter/)
  })

  it('/api/transacoes cap subiu de 100 → 500', () => {
    const code = readFileSync(join(ROOT, 'app/api/transacoes/route.ts'), 'utf-8')
    expect(code).toMatch(/Math\.min\(500,/)
    expect(code).not.toMatch(/limit = Math\.min\(100,/)
  })
})

describe('rangeForPreset (helper puro)', () => {
  const ref = new Date('2026-06-15T12:00:00Z')

  it('hoje = hoje..hoje', () => {
    const r = rangeForPreset('hoje', ref)
    expect(r).toEqual({ inicio: '2026-06-15', fim: '2026-06-15' })
  })

  it('ultimos-7d = inclui hoje (7 dias)', () => {
    const r = rangeForPreset('ultimos-7d', ref)
    expect(r).toEqual({ inicio: '2026-06-09', fim: '2026-06-15' })
  })

  it('ultimos-30d = 30 dias contando hoje', () => {
    const r = rangeForPreset('ultimos-30d', ref)
    expect(r).toEqual({ inicio: '2026-05-17', fim: '2026-06-15' })
  })

  it('mes-atual = 01 → último dia do mês', () => {
    const r = rangeForPreset('mes-atual', ref)
    expect(r).toEqual({ inicio: '2026-06-01', fim: '2026-06-30' })
  })

  it('mes-passado = mês anterior inteiro', () => {
    const r = rangeForPreset('mes-passado', ref)
    expect(r).toEqual({ inicio: '2026-05-01', fim: '2026-05-31' })
  })

  it('virada de ano em mes-passado (janeiro)', () => {
    const jan = new Date('2026-01-10T12:00:00Z')
    const r = rangeForPreset('mes-passado', jan)
    expect(r).toEqual({ inicio: '2025-12-01', fim: '2025-12-31' })
  })

  it('virada de ano em mes-atual (dezembro)', () => {
    const dez = new Date('2026-12-15T12:00:00Z')
    const r = rangeForPreset('mes-atual', dez)
    expect(r).toEqual({ inicio: '2026-12-01', fim: '2026-12-31' })
  })
})

describe('Sprint Filtro de Data Parte A — uso compartilhado nas 3 páginas', () => {
    /**
   * ⚠️⚠️ REAPONTADO EM 15/09 — A TELA MORREU, E A RÉGUA MUDOU DE LADO.
   *
   * `/pendentes` deixou de existir: ela era a **segunda fila** sobre o mesmo extrato (a
   * linha aparecia lá sem categoria E na Conciliação sem vínculo), e virou a **CAIXA DE
   * ENTRADA**, com duas abas por sentido.
   *
   * ⛔ **E o filtro de período NÃO foi realocado, de propósito** — é a régua desta casa
   * desde 14/09: *"Pendentes é FILA DE TRABALHO e NUNCA ganha mês: esconder pendente antigo
   * é esconder trabalho, e foi assim que 21 notas ficaram invisíveis"*. A caixa é fila, não
   * lista; quem navega por período é **Movimentações**, o arquivo. O que a caixa tem no
   * lugar é o **corte de época**, que é outra coisa: ele diz de quando o dono começou a
   * conciliar, não esconde o que ele ainda não resolveu.
   */
  it('⛔ a caixa de entrada é FILA — e fila não ganha filtro de período', () => {
    const caixa = readFileSync(join(ROOT, 'components/conciliacao/caixa-de-entrada.tsx'), 'utf-8')
    expect(caixa).not.toMatch(/DateRangeFilter|useDateRangeFilter/)
    // ⭐ e o corte de época (que é outra coisa) mora no servidor, não na tela
    // ⚠️ o corte saiu da ROTA pra a LEITURA ÚNICA na faxina de 15/09 — a rota virou casca,
    // e é a leitura que a tela e o badge do menu compartilham.
    const leitura = readFileSync(join(ROOT, 'lib/conciliacao/leitura-da-caixa.ts'), 'utf-8')
    expect(leitura).toContain('conciliarAPartirDe')
})

  // ⚠️⚠️ INVERTIDO EM 07/09/2026, COM O MOTIVO ESCRITO (não apagado).
  //
  // O sprint do filtro de data listava 3 páginas; a `/conciliacao` era uma delas
  // porque ela era uma **lista de linhas do extrato** — e lista de extrato se
  // navega por período. A tela nova não é lista: é **fila de decisão** sobre as
  // contas que ainda não têm pagamento casado. O período dela é "o que está em
  // aberto", e um filtro de data ali só serviria pra ESCONDER conta vencida.
  //
  // É o mesmo raciocínio que este arquivo já registra pra `/transferencias` logo
  // abaixo. A `/pendentes` — que continua sendo lista — mantém o filtro, e o teste
  // dela continua valendo.
  it('/conciliacao é fila de decisão, não lista: NÃO tem filtro de período', () => {
    const code = readFileSync(join(ROOT, 'app/(dashboard)/conciliacao/page.tsx'), 'utf-8')
    expect(code).not.toMatch(/useDateRangeFilter/)
    expect(code).not.toMatch(/const \[periodo, setPeriodo\]/)
    // ⛔ e o que ela TEM que ter é o contador honesto por aba
    expect(code).toMatch(/comSugestao/)
  })

  it('/transferencias (dashboard) NÃO precisa de filtro de data — mostra o mês corrente automaticamente via dashboard-summary', () => {
    // Sprint Transferências Redesign (28/06/2026, Mercury/Ramp): a página
    // /transferencias virou dashboard executivo mostrando o MÊS CORRENTE
    // automaticamente. Filtro de data não aplicável aqui — endpoint
    // dashboard-summary já agrega por mês. Páginas detalhadas
    // (/conciliadas, /revisar) listam dados sem filtro de período, então
    // tb não precisam. Sprint válido: as outras 2 páginas listadas neste
    // arquivo (/pendentes, /conciliacao) continuam com o filtro.
    const code = readFileSync(
      join(ROOT, 'app/(dashboard)/empresas/[id]/transferencias/page.tsx'),
      'utf-8',
    )
    // Confirma que é dashboard (KPICard + FluxoContas), não lista plana
    expect(code).toMatch(/KPICard/)
    expect(code).toMatch(/FluxoContas/)
    expect(code).toMatch(/dashboard-summary/)
  })
})
