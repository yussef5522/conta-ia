// Sprint Frontend (15/06/2026) — DateRangeFilter pending + Aplicar/Limpar.
// USWDS: NÃO auto-submeter na seleção.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const PATH = join(__dirname, '..', 'components/shared/DateRangeFilter.tsx')
const code = readFileSync(PATH, 'utf-8')

describe('Sprint Frontend — DateRangeFilter sem auto-submit', () => {
  it('(a) clicar data no Calendar mexe APENAS em pending — não chama onChange nem fecha', () => {
    // handleCalendarSelect só altera pending; NÃO chama onChange nem setOpen
    const handler = code.match(/function handleCalendarSelect[\s\S]*?^\s\s\}$/m)?.[0] ?? ''
    expect(handler.length).toBeGreaterThan(0)
    expect(handler).toContain('setPending')
    expect(handler).not.toMatch(/onChange\(/)
    expect(handler).not.toMatch(/setOpen\(/)
  })

  it('(b) APLICAR com range completo é o ÚNICO caminho que comita (onChange + setOpen(false))', () => {
    const handler = code.match(/function handleApply[\s\S]*?^\s\s\}$/m)?.[0] ?? ''
    expect(handler.length).toBeGreaterThan(0)
    expect(handler).toMatch(/onChange\(pending\)/)
    expect(handler).toMatch(/setOpen\(false\)/)
  })

  it('(c) Aplicar com pending vazio limpa o filtro (onChange com {inicio:"",fim:""})', () => {
    // O canApply permite isEmpty; ao aplicar com vazio, onChange recebe {inicio:'',fim:''}
    expect(code).toMatch(/const isEmpty\s*=\s*!pending\.inicio\s*&&\s*!pending\.fim/)
    expect(code).toMatch(/const canApply\s*=\s*isComplete\s*\|\|\s*isEmpty/)
  })

  it('(d) Aplicar disabled com seleção parcial (só inicio OU só fim)', () => {
    // botão Aplicar usa disabled={!canApply}; canApply = isComplete || isEmpty
    expect(code).toMatch(/disabled=\{!canApply\}/)
    expect(code).toMatch(/const isComplete\s*=\s*!!\(pending\.inicio\s*&&\s*pending\.fim\)/)
  })

  it('(e) Limpar zera pending mas MANTÉM popover aberto (não fecha)', () => {
    const handler = code.match(/function handleClear[\s\S]*?^\s\s\}$/m)?.[0] ?? ''
    expect(handler.length).toBeGreaterThan(0)
    expect(handler).toMatch(/setPending\(\{\s*inicio:\s*['"]{2}\s*,\s*fim:\s*['"]{2}\s*\}\)/)
    expect(handler).not.toMatch(/setOpen\(/)
    expect(handler).not.toMatch(/onChange\(/)
  })

  it('(f) Fechar (Esc/clicar fora) descarta pending — trigger sempre lê value (não pending)', () => {
    // O botão trigger renderiza `{formatRange(value)}`, não `formatRange(pending)`.
    expect(code).toMatch(/<span>\{formatRange\(value\)\}<\/span>/)
    // Ao reabrir, useEffect ressincroniza pending = value (descarta o pending anterior).
    expect(code).toMatch(/if \(open\) setPending\(value\)/)
  })

  it('(g) Preset pré-preenche pending sem comitar nem fechar', () => {
    const handler = code.match(/function handlePreset[\s\S]*?^\s\s\}$/m)?.[0] ?? ''
    expect(handler.length).toBeGreaterThan(0)
    expect(handler).toContain('setPending')
    expect(handler).not.toMatch(/onChange\(/)
    expect(handler).not.toMatch(/setOpen\(/)
  })
})

describe('Sprint Frontend — rodapé Aplicar/Limpar (visual)', () => {
  it('rodapé tem border-top + fundo sutil', () => {
    expect(code).toMatch(/border-t bg-muted\/30/)
  })

  it('resumo pt-BR "X dias" inclusivo', () => {
    expect(code).toMatch(/formatPendingSummary/)
    expect(code).toMatch(/days === 1 \? '' : 's'/)
    // 1 dia mesmo se inicio === fim (inclusivo)
    expect(code).toMatch(/Math\.round\(\(b - a\) \/ 86400000\) \+ 1/)
  })

  it('botões Limpar (ghost) e Aplicar (solid, primary)', () => {
    expect(code).toMatch(/onClick=\{handleClear\}[\s\S]{0,200}Limpar/)
    expect(code).toMatch(/onClick=\{handleApply\}[\s\S]{0,200}Aplicar/)
    expect(code).toMatch(/variant="ghost"[\s\S]{0,200}Limpar/)
  })

  it('"Selecione um período" quando pending vazio/parcial', () => {
    expect(code).toMatch(/'Selecione um período'/)
  })
})

describe('Sprint Frontend — onChange é chamado SÓ pelo Aplicar', () => {
  it('NÃO existe nenhum onChange dentro dos handlers de Calendar/preset/input', () => {
    // Conta ocorrências de onChange(...) dentro do componente.
    // Esperado: apenas DENTRO de handleApply.
    const ocorrencias = code.match(/^\s*onChange\(/gm) ?? []
    // ocorrências no JSX (props onChange=...) não devem contar — só as CHAMADAS.
    expect(ocorrencias.length).toBe(1)
  })
})
