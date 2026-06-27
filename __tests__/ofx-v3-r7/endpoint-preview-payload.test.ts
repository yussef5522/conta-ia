// Sprint OFX V3 R7 — defensivos no endpoint /importar-ofx?preview=true.
//
// FIX 3: categorySuggestions + categoriesForUI saíram de DENTRO do
// `if (!isV2PreviewEnabled())` e agora estão em AMBOS os caminhos (V2 e
// legacy). Antes, V3 (que consome esse payload com V2=true em prod) recebia
// undefined → todas as linhas viravam "escolha você".
//
// FIX 1: ownEntityRefs adicionado ao payload pra UI detectar transferência
// single-side (CNPJ próprio + nome empresa + nome de outras contas).

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const root = (p: string) => join(__dirname, '..', '..', p)
const file = root('app/api/contas-bancarias/[id]/importar-ofx/route.ts')

describe('Sprint V3 R7 — endpoint preview retorna categorySuggestions + categoriesForUI + ownEntityRefs em AMBOS os caminhos', () => {
  const code = readFileSync(file, 'utf-8')

  it('categorySuggestions: declaração comum FORA do if (!isV2PreviewEnabled)', () => {
    // Procura padrão: `let categorySuggestions: ...` antes do `if (!isV2PreviewEnabled())`
    const decl = code.indexOf('let categorySuggestions:')
    // Match no `if` real (não no comentário) — `if (!isV2PreviewEnabled()) {`
const v2Check = code.indexOf('if (!isV2PreviewEnabled()) {')
    expect(decl).toBeGreaterThan(-1)
    expect(v2Check).toBeGreaterThan(-1)
    expect(decl).toBeLessThan(v2Check) // declaração ANTES do split V2/legacy
  })

  it('categoriesForUI: declaração comum FORA do if (!isV2PreviewEnabled)', () => {
    const decl = code.indexOf('let categoriesForUI:')
    // Match no `if` real (não no comentário) — `if (!isV2PreviewEnabled()) {`
const v2Check = code.indexOf('if (!isV2PreviewEnabled()) {')
    expect(decl).toBeGreaterThan(-1)
    expect(decl).toBeLessThan(v2Check)
  })

  it('ownEntityRefs: computado pra ambos caminhos', () => {
    const decl = code.indexOf('let ownEntityRefs:')
    // Match no `if` real (não no comentário) — `if (!isV2PreviewEnabled()) {`
const v2Check = code.indexOf('if (!isV2PreviewEnabled()) {')
    expect(decl).toBeGreaterThan(-1)
    expect(decl).toBeLessThan(v2Check)
  })

  it('retorno V2 inclui categorySuggestions + categoriesForUI + ownEntityRefs', () => {
    // Captura desde o `return NextResponse.json({` até o fim do retorno V2.
    // V2 está no else (ou após) do `if (!isV2PreviewEnabled())`.
    const v2BlockStart = code.indexOf("// V2: busca candidatos do sistema")
    const v2BlockEnd = code.indexOf('// Inserção em lote', v2BlockStart)
    expect(v2BlockStart).toBeGreaterThan(-1)
    expect(v2BlockEnd).toBeGreaterThan(v2BlockStart)
    const v2Block = code.slice(v2BlockStart, v2BlockEnd)
    expect(v2Block).toMatch(/categorySuggestions/)
    expect(v2Block).toMatch(/categoriesForUI/)
    expect(v2Block).toMatch(/ownEntityRefs/)
  })

  it('retorno legacy inclui categorySuggestions + categoriesForUI + ownEntityRefs', () => {
    const legacyStart = code.indexOf('if (!isV2PreviewEnabled())')
    const v2Comment = code.indexOf("// V2: busca candidatos do sistema", legacyStart)
    expect(legacyStart).toBeGreaterThan(-1)
    expect(v2Comment).toBeGreaterThan(legacyStart)
    const legacyBlock = code.slice(legacyStart, v2Comment)
    expect(legacyBlock).toMatch(/categorySuggestions/)
    expect(legacyBlock).toMatch(/categoriesForUI/)
    expect(legacyBlock).toMatch(/ownEntityRefs/)
  })
})

describe('Sprint V3 R7 — PreviewV3Premium passa transferDetected + usa lib reutilizável', () => {
  const ui = readFileSync(root('components/importar-ofx/PreviewV3Premium.tsx'), 'utf-8')

  it('importa extractOwnSignals + detectTransferKeyword + findLoanInstallmentForTransaction', () => {
    expect(ui).toMatch(/extractOwnSignals/)
    expect(ui).toMatch(/detectTransferKeyword/)
    expect(ui).toMatch(/findLoanInstallmentForTransaction/)
  })

  it('passa transferDetected ao suggestLineKind (não mais undefined)', () => {
    // Confirma que existe assignment de transferDetected antes da chamada
    expect(ui).toMatch(/transferDetected\s*[:=]/)
    // E que suggestLineKind recebe transferDetected
    const block = ui.slice(ui.indexOf('suggestLineKind({'), ui.indexOf('m.set(n.ofxIndex, ai)'))
    expect(block).toMatch(/transferDetected/)
  })

  it('aceita ownEntityRefs nas Props', () => {
    expect(ui).toMatch(/ownEntityRefs\?:\s*OwnEntityRefs/)
  })

  it('NÃO usa mais o findLoanInstallmentCandidate local (substituído pela lib)', () => {
    // Deve não ter mais a função local — só a chamada à lib
    expect(ui).not.toMatch(/function findLoanInstallmentCandidate\(/)
  })
})
