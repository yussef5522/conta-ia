// Sprint Fix-Import-Vazio (05/07/2026) — blindagens estáticas.
//
// Cobre:
//   (a) Guard novas.length === 0 ANTES do V2Preview (evita Math.min([])=Infinity)
//   (b) Try/catch defensivo envolvendo o V2Preview (bugs futuros com msg útil)
//   (c) UI mostra toast informativo quando backend retorna mensagem + preview=[]

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const root = (p: string) => join(__dirname, '..', '..', p)
const read = (p: string) => readFileSync(root(p), 'utf-8')

describe('a) Guard novas.length === 0 no path V2Preview', () => {
  const code = read('app/api/contas-bancarias/[id]/importar-ofx/route.ts')

  it('existe guard antes do V2Preview (evita Math.min([])=Infinity)', () => {
    // O guard precisa vir DEPOIS do isV2PreviewEnabled legacy return e ANTES
    // do try/catch do V2Preview (que faz o Math.min/Math.max).
    // Match: `if (novas.length === 0)` seguido de return NextResponse.json
    expect(code).toMatch(
      /if\s*\(\s*novas\.length\s*===\s*0\s*\)\s*\{[\s\S]{0,600}return\s+NextResponse\.json/,
    )
  })

  it('guard usa buildLegacyPreviewPayload({novas: [], ...}) — shape compatível com UI', () => {
    // O shape deve ser IDÊNTICO ao que a UI recebe hoje quando IMPORT_PREVIEW_V2=false.
    // buildLegacyPreviewPayload({novas: [], ...}) retorna preview: [] + total + duplicadas.
    const guardBlock = code.match(
      /if\s*\(\s*novas\.length\s*===\s*0\s*\)\s*\{[\s\S]+?\}\s*\)\s*\}/,
    )
    expect(guardBlock).toBeTruthy()
    expect(guardBlock![0]).toMatch(/buildLegacyPreviewPayload/)
    expect(guardBlock![0]).toMatch(/novas:\s*\[\]/)
  })

  it('guard inclui mensagem informativa "já foram importadas"', () => {
    expect(code).toMatch(/já foram importadas anteriormente/)
  })

  it('guard NÃO fica DEPOIS do try/catch V2 (senão nunca dispara)', () => {
    // Regex: posição do guard novas.length===0 deve vir ANTES do Math.min(...datesIncoming)
    const guardPos = code.search(/if\s*\(\s*novas\.length\s*===\s*0\s*\)/)
    const mathMinPos = code.search(/Math\.min\(\.\.\.datesIncoming\)/)
    expect(guardPos).toBeGreaterThan(0)
    expect(mathMinPos).toBeGreaterThan(0)
    expect(guardPos).toBeLessThan(mathMinPos)
  })
})

describe('b) Try/catch defensivo envolvendo V2Preview', () => {
  const code = read('app/api/contas-bancarias/[id]/importar-ofx/route.ts')

  it('Math.min/Math.max ficam DENTRO de try/catch', () => {
    // O try precisa estar antes do const datesIncoming = novas.map(...)
    // Match: try {...datesIncoming...Math.min...
    const tryBlock = code.match(
      /try\s*\{[\s\S]{0,3000}Math\.min\(\.\.\.datesIncoming\)/,
    )
    expect(tryBlock).toBeTruthy()
  })

  it('catch retorna NextResponse.json com erro específico (não vira 500 opaco)', () => {
    // O catch precisa retornar { erro: '...', code: 'PREVIEW_V2_FAILED' } com status 500
    expect(code).toMatch(
      /catch\s*\(\s*e:\s*unknown\s*\)\s*\{[\s\S]{0,600}NextResponse\.json/,
    )
    expect(code).toMatch(/code:\s*['"]PREVIEW_V2_FAILED['"]/)
    expect(code).toMatch(/Falha ao gerar preview/)
  })

  it('catch loga o erro pro debug', () => {
    expect(code).toMatch(
      /\[importar-ofx preview V2\]\s+falhou/,
    )
  })

  it('catch usa e instanceof Error pra pegar msg segura', () => {
    // Padrão do projeto pra evitar exception secundária no logging.
    expect(code).toMatch(
      /e\s+instanceof\s+Error\s*\?\s*e\.message\s*:\s*String\(e\)/,
    )
  })
})

describe('c) UI mostra toast informativo em re-import', () => {
  const code = read(
    'app/(dashboard)/empresas/[id]/contas/[contaId]/importar/page.tsx',
  )

  it('handleFile detecta data.mensagem + preview vazio e mostra toast', () => {
    // Padrão: if (data.mensagem && (!data.preview || data.preview.length === 0)) toast(...)
    expect(code).toMatch(
      /data\.mensagem[\s\S]{0,200}data\.preview\.length\s*===\s*0[\s\S]{0,300}toast\(/,
    )
  })

  it('toast é neutro (não destrutivo) com título "Nada novo pra importar"', () => {
    expect(code).toMatch(/Nada novo pra importar/)
    // NÃO deve ser variant destructive nesse ponto (é informativo, não erro)
    const toastBlock = code.match(
      /Nada novo pra importar[\s\S]{0,200}/,
    )
    expect(toastBlock).toBeTruthy()
    expect(toastBlock![0]).not.toMatch(/variant:\s*['"]destructive['"]/)
  })

  it('toast propaga a mensagem exata que veio do backend', () => {
    expect(code).toMatch(/description:\s*data\.mensagem/)
  })
})
