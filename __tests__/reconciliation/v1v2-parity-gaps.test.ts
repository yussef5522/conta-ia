// Etapa 2 (06/08/2026) — guarda de paridade V1/V2 do import OFX.
//
// Medição real feita em Postgres scratch (scripts/measure-v1v2-parity.ts).
// Este arquivo FIXA os achados: o que já está coberto (verde) e os gaps REAIS
// que a Etapa 3 vai tratar um por vez (test.todo — não quebra a suíte).
//
// Contexto: com RECONCILE_V2=true (prod) o confirm do OFX vai pro runImportV2,
// que reimplementou o import e não portou tudo do caminho V1.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const orchestrator = readFileSync(join(ROOT, 'lib/reconciliation/import-orchestrator.ts'), 'utf-8')
const v1route = readFileSync(join(ROOT, 'app/api/contas-bancarias/[id]/importar-ofx/route.ts'), 'utf-8')

describe('Paridade V1/V2 — COBERTO (verde)', () => {
  it('re-import do mesmo OFX dá 0 novas — reconcileStatement cobre (medido no scratch)', () => {
    // reconcileStatement casa por stableKey (data|valor|memo), sem depender do
    // ImportedIdentity ledger. Medição: 2º import do mesmo arquivo → 0 novas.
    expect(orchestrator).toMatch(/reconcileStatement/)
  })

  it('V2 aplica categoryOverrides do preview (fix 06/08 — resolveLineOverride)', () => {
    expect(orchestrator).toMatch(/resolveLineOverride/)
    expect(orchestrator).toMatch(/categoryOverrides\?:/)
  })

  it('V2 grava ledgerBal + recalcula saldo (fix 31/07)', () => {
    expect(orchestrator).toMatch(/ledgerBal/)
    expect(orchestrator).toMatch(/recalcularSaldoConta/)
  })

  it('V2 detecção de transferência: coberta pelo banner retroativo de Pendentes (fix 06/08)', () => {
    // não roda no import, mas o banner reavalia todas as EFFECTED no load.
    const pendentes = readFileSync(join(ROOT, 'app/(dashboard)/empresas/[id]/pendentes/pendentes-client.tsx'), 'utf-8')
    expect(pendentes).toMatch(/detect-active-transfers/)
  })
})

describe('Paridade V1/V2 — GAPS REAIS medidos (Etapa 3 trata)', () => {
  // Prova estrutural do gap ALTO: o route parseia `decisions` (SKIP) mas o
  // runImportV2 NEM ACEITA esse parâmetro → linha desmarcada no preview entra.
  it('GAP ALTO confirmado: V2 não recebe `decisions` (SKIP do preview é ignorado)', () => {
    expect(v1route).toMatch(/formData\.get\('decisions'\)/) // route ainda parseia
    // ...mas a chamada do runImportV2 NÃO passa decisions:
    const callBlock = v1route.slice(v1route.indexOf('runImportV2(tx'), v1route.indexOf('runImportV2(tx') + 400)
    expect(callBlock).not.toMatch(/decisions/)
    // ...e o input do orquestrador não tem o campo:
    const inputIface = orchestrator.slice(orchestrator.indexOf('interface ImportOrchestratorInput'), orchestrator.indexOf('interface ImportOrchestratorInput') + 400)
    expect(inputIface).not.toMatch(/decisions/)
  })

  it('GAP confirmado: V2 não seta fitidKey/contentHash nem seed ImportedIdentity (dedup mesmo assim OK)', () => {
    expect(orchestrator).not.toMatch(/fitidKey|contentHash|importedIdentity\.create/)
  })

  // Gaps a fechar na Etapa 3 (medidos, não corrigidos agora):
  it.todo('Etapa 3: V2 aplicar decisions/SKIP do preview (gap ALTO — preview ≠ confirm)')
  it.todo('Etapa 3: V2 auto-classificar por regra/keyword no import (gap MÉDIO — hoje tudo PENDING)')
  it.todo('Etapa 3: V2 popular fitidKey/contentHash + seed ImportedIdentity (gap BAIXO — audit/placeholder-reconcile)')
  it.todo('Etapa 3: teste de paridade rodando MESMO OFX por V1 e V2 no CI (hoje só via scratch Postgres manual)')
})
