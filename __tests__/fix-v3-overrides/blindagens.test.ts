// Sprint Fix-V3-Overrides (01/07/2026) — blindagem contra regressão.
//
// Bug pré-existente (Sprint OFX V3, 27/06/2026): V3 (PreviewV3Premium)
// exibia CategoryCombobox por linha para o user escolher categoria manual
// das saídas sem regra automática, montava decisions.categoryOverrides
// corretamente no `onConfirmar`, mas o page.tsx chamava `handleImport()`
// SEM propagar esses overrides pro POST. Resultado: escolha manual
// perdida — tx entrava PENDING sem categoria (6 tx Cacula 01/07/2026).
//
// Fix: `handleImport` aceita `explicitOverrides?: Record<string, string|null>`
// como 2º parâmetro. `onConfirmar` do V3 constrói o Record a partir de
// `decisions.categoryOverrides` e passa direto — sem race condition de
// setState.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const root = (p: string) => join(__dirname, '..', '..', p)
const read = (p: string) => readFileSync(root(p), 'utf-8')

const pageCode = read(
  'app/(dashboard)/empresas/[id]/contas/[contaId]/importar/page.tsx',
)

describe('page.tsx — handleImport aceita explicitOverrides', () => {
  it('assinatura tem o parâmetro explicitOverrides (2º opcional)', () => {
    // 2 params, ambos opcionais. decisions?..., explicitOverrides?...
    expect(pageCode).toMatch(
      /async function handleImport\([\s\S]+?explicitOverrides\?:\s*Record<string,\s*string\s*\|\s*null>[\s\S]+?\)\s*\{/,
    )
  })

  it('usa explicitOverrides ?? overrides como source', () => {
    expect(pageCode).toMatch(/const overridesSource = explicitOverrides \?\? overrides/)
  })

  it('monta categoryOverrides no FormData a partir de overridesSource', () => {
    expect(pageCode).toMatch(/Object\.entries\(overridesSource\)/)
  })

  it('filtra null/undefined (não envia entrada sem categoria)', () => {
    expect(pageCode).toMatch(
      /\.filter\(\(\[,\s*v\]\)\s*=>\s*v\s*!==\s*undefined\s*&&\s*v\s*!==\s*null\)/,
    )
  })
})

describe('page.tsx — V3 propaga decisions.categoryOverrides pro handleImport', () => {
  it('onConfirmar do V3 constrói explicitOverrides do decisions.categoryOverrides', () => {
    // Bloco do PreviewV3Premium com onConfirmar
    const v3Block = pageCode.match(
      /<PreviewV3Premium[\s\S]+?<\/PreviewV3Premium>|<PreviewV3Premium[\s\S]+?\/>/,
    )?.[0]
    expect(v3Block).toBeTruthy()
    // Constrói o Record
    expect(v3Block!).toMatch(/const explicitOverrides:\s*Record<string,\s*string\s*\|\s*null>/)
    expect(v3Block!).toMatch(/for\s*\(const o of decisions\.categoryOverrides\)/)
    expect(v3Block!).toMatch(/explicitOverrides\[o\.dedupHash\]\s*=\s*o\.categoryId/)
  })

  it('handleImport recebe explicitOverrides no 2º parâmetro (não undefined)', () => {
    const v3Block = pageCode.match(
      /<PreviewV3Premium[\s\S]+?<\/PreviewV3Premium>|<PreviewV3Premium[\s\S]+?\/>/,
    )?.[0]
    expect(v3Block!).toMatch(/handleImport\(undefined,\s*explicitOverrides\)/)
  })

  it('NÃO chama mais handleImport() sem args na callback do V3', () => {
    const v3Block = pageCode.match(
      /<PreviewV3Premium[\s\S]+?<\/PreviewV3Premium>|<PreviewV3Premium[\s\S]+?\/>/,
    )?.[0]
    // Não pode ter "await handleImport()" (sem params) mais no bloco V3.
    // Nota: outras callbacks do V2 legacy podem ter — testamos só o V3.
    const linhas = v3Block!.split('\n')
    const chamadaSemArgs = linhas.some((l) =>
      /await handleImport\(\)/.test(l),
    )
    expect(chamadaSemArgs).toBe(false)
  })
})

describe('page.tsx — V2 legacy INTACTO (comportamento não regride)', () => {
  it('state "overrides" continua sendo lido pelo handleImport (via ?? fallback)', () => {
    expect(pageCode).toMatch(/const \[overrides, setOverrides\] = useState<Record<string, string \| null>>/)
    // O fallback lê o state quando explicitOverrides não é passado
    expect(pageCode).toMatch(/explicitOverrides \?\? overrides/)
  })

  it('EditablePreviewTable continua ligado ao setOverrides do state', () => {
    expect(pageCode).toMatch(/setOverrides=\{setOverrides\}/)
  })
})

describe('backend — pipeline do confirm intacto', () => {
  const routeCode = read(
    'app/api/contas-bancarias/[id]/importar-ofx/route.ts',
  )

  it('applyCategoryOverrides roda DEPOIS de autoClassifyTransactions', () => {
    const autoIdx = routeCode.indexOf('autoClassifyTransactions(')
    const applyIdx = routeCode.indexOf('applyCategoryOverrides(')
    expect(autoIdx).toBeGreaterThan(0)
    expect(applyIdx).toBeGreaterThan(0)
    expect(applyIdx).toBeGreaterThan(autoIdx)
  })

  it('categoryOverrides é lido do formData (contrato inalterado)', () => {
    expect(routeCode).toMatch(/formData\.get\(['"]categoryOverrides['"]\)/)
  })
})

describe('lib/apply-overrides — semântica preservada', () => {
  const applyCode = read('lib/import-categorization/apply-overrides.ts')

  it('override marca MANUAL + confidence 1.0 + RECONCILED quando tem categoria', () => {
    expect(applyCode).toMatch(/classificationSource:\s*['"]MANUAL['"]/)
    expect(applyCode).toMatch(/aiConfidence:\s*newCatId\s*\?\s*1\.0/)
    expect(applyCode).toMatch(/status:\s*newCatId\s*\?\s*['"]RECONCILED['"]/)
  })
})
