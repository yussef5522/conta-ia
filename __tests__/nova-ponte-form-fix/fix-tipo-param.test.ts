// Sprint Fix-Tipo-Param (30/06/2026) — defensivos das 2 fases:
//
// FASE 1: URL construída pelo form usa `tipo=DEBIT` (PT), NÃO `type=DEBIT` (EN).
//   Causa raiz: /api/transacoes:23 lê searchParams.get('tipo'). Enviar `type`
//   era ignorado silenciosamente → endpoint devolvia CREDIT + DEBIT + TRANSFER
//   juntos, respeitando só status=RECONCILED + limit=200.
//   Efeito: (a) LM TRANSP (22/06, posição 78 entre DEBIT) ficava fora das
//   200 mais recentes RECONCILED (majoritariamente CREDIT); (b) recebimentos
//   PIX Sicredi (CREDIT) apareciam no dropdown de retirada de sócio.
//   Diagnóstico READ-ONLY 30/06 (HEAD 3a9415d) confirmou.
//
// FASE 2: filtro dinâmico por kind (limita candidatas ao universo semântico
//   de retirada de sócio).
//   DISTRIBUICAO / ADIANTAMENTO / RETIRADA_SOCIOS → dreGroup=DISTRIBUICAO_LUCROS
//   PRO_LABORE → category.name casa "pro-labore" normalizado sem acento
//   REEMBOLSO → não filtra (sócio reembolsa qualquer despesa)
//   Escape hatch `showAllTx` bypass o filtro (default off).

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const root = (p: string) => join(__dirname, '..', '..', p)

const code = readFileSync(
  root('components/bridges/NovaPonteForm.tsx'),
  'utf-8',
)

describe('FASE 1 — param renomeado type→tipo', () => {
  it('URLSearchParams usa `tipo` (PT), NÃO `type` (EN)', () => {
    expect(code).toMatch(/tipo:\s*['"]DEBIT['"]/)
  })

  it('NÃO tem mais `type: "DEBIT"` na URLSearchParams', () => {
    // Bloco do useEffect com URLSearchParams — o único que pode ter tinha
    // type: 'DEBIT' antes do fix.
    const block = code.match(/new URLSearchParams\(\{[\s\S]+?\}\)/)
    expect(block).toBeTruthy()
    expect(block![0]).not.toMatch(/type:\s*['"]DEBIT['"]/)
  })

  it('comentário cita a causa raiz (endpoint lê `tipo`, não `type`)', () => {
    expect(code).toMatch(/Fix-Tipo-Param/)
    expect(code).toMatch(/searchParams\.get\(['"]tipo['"]\)/)
  })
})

describe('FASE 2 — filtro dinâmico por kind', () => {
  it('função matchesKindFilter existe', () => {
    expect(code).toMatch(/function matchesKindFilter\s*\(/)
  })

  it('DISTRIBUICAO/ADIANTAMENTO/RETIRADA_SOCIOS filtram por dreGroup=DISTRIBUICAO_LUCROS', () => {
    // Fallback do filtro (após tratar REEMBOLSO e PRO_LABORE) é dreGroup.
    expect(code).toMatch(/tx\.dreGroup\s*===\s*['"]DISTRIBUICAO_LUCROS['"]/)
  })

  it('REEMBOLSO retorna true (não filtra — qualquer despesa)', () => {
    expect(code).toMatch(/kind\s*===\s*['"]REEMBOLSO['"][\s\S]{0,50}return\s+true/)
  })

  it('PRO_LABORE filtra por category.name normalizado (com/sem hífen/acento)', () => {
    expect(code).toMatch(/kind\s*===\s*['"]PRO_LABORE['"]/)
    expect(code).toMatch(/normalizeForProLabore/)
    expect(code).toMatch(/pro-labore/)
    expect(code).toMatch(/pro labore/)
    expect(code).toMatch(/prolabore/)
  })

  it('normalizador remove diacríticos via \\p{Diacritic} + NFD', () => {
    expect(code).toMatch(/\.normalize\(['"]NFD['"]\)/)
    expect(code).toMatch(/\\p\{Diacritic\}/)
  })

  it('categoryName é mapeado do ApiTxLite.category.name', () => {
    expect(code).toMatch(/categoryName:\s*tx\.category\?\.name/)
  })

  it('ApiTxLite tem category.name (não só dreGroup)', () => {
    expect(code).toMatch(
      /category:\s*\{\s*name:\s*string\s*\|\s*null;\s*dreGroup:/,
    )
  })
})

describe('FASE 2 — UX: contador + escape hatch', () => {
  it('estado showAllTx (default false, escape hatch)', () => {
    expect(code).toMatch(/setShowAllTx/)
    expect(code).toMatch(/useState\(false\)/)
  })

  it('kindFilteredTxs aplica matchesKindFilter (com bypass showAllTx)', () => {
    expect(code).toMatch(/const kindFilteredTxs/)
    expect(code).toMatch(/showAllTx[\s\S]{0,30}matchesKindFilter/)
  })

  it('checkbox "Mostrar todas" no UI', () => {
    expect(code).toMatch(/Mostrar todas/)
    expect(code).toMatch(/checked=\{showAllTx\}/)
  })

  it('contador visível "N tx compatível com <kind>"', () => {
    expect(code).toMatch(/tx compatível com/)
  })

  it('useEffect zera selectedPjTxId se ela sumir do filtro', () => {
    // Ao trocar kind, se a tx selecionada não passa mais, limpar seleção.
    expect(code).toMatch(
      /useEffect\(\(\)\s*=>\s*\{[\s\S]+?stillVisible[\s\S]+?setSelectedPjTxId\(''\)[\s\S]+?\},\s*\[kind,\s*showAllTx/,
    )
  })
})

describe('regressão — LM TRANSP + PIX Sicredi', () => {
  it('LM TRANSP: com kind=DISTRIBUICAO (default), filtro passa dreGroup=DISTRIBUICAO_LUCROS', () => {
    // kind default do form
    expect(code).toMatch(/useState<BridgeKind>\(['"]DISTRIBUICAO['"]\)/)
    // Filtro do kind DISTRIBUICAO usa DISTRIBUICAO_LUCROS
    expect(code).toMatch(/DISTRIBUICAO_LUCROS/)
  })

  it('PIX Sicredi (CREDIT) NÃO chega no cliente (endpoint filtra por tipo=DEBIT)', () => {
    // Se `tipo=DEBIT` chega no endpoint, ele aplica where.type='DEBIT'
    // e recebimentos CREDIT nem vêm no payload — dispensa filtro client.
    expect(code).toMatch(/tipo:\s*['"]DEBIT['"]/)
  })
})
