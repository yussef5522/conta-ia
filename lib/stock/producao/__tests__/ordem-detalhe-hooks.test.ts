// ESTOQUE FASE 2 — REGRA 1 do bug "página quebra ao abrir ordem EM_PRODUCAO" (21/08).
// CAUSA: um `useMemo` (escalaAviso) ficou DEPOIS do early-return `if (ordem === undefined)`.
// Na 1ª render (ordem undefined) o hook NÃO era chamado; quando a ordem carregava, ERA →
// nº de hooks mudou → React: "Rendered more hooks than during the previous render" → a
// página estourou ("This page couldn't load"). Servidor OK — crash de cliente.
//
// Sem jsdom/RTL no projeto (0 testes de componente), não dá pra renderizar o React aqui.
// Este guard encoda a INVARIANTE que o React aplica em runtime: no componente principal,
// NENHUM hook pode aparecer depois do primeiro early-return de guarda. Falha antes do fix
// (escalaAviso após o return), passa depois (movido pra antes). Cobre o caso real.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const FILE = join(process.cwd(), 'app/(dashboard)/empresas/[id]/estoque/producao/[ordemId]/page.tsx')

// corpo do componente principal (do export default até a 1ª função auxiliar do arquivo)
function corpoDoComponentePrincipal(src: string): string {
  const start = src.indexOf('export default function')
  expect(start).toBeGreaterThanOrEqual(0)
  const rest = src.slice(start)
  const nextFn = rest.indexOf('\nfunction ') // 1ª função auxiliar (ex: ConclusaoForm)
  return nextFn > 0 ? rest.slice(0, nextFn) : rest
}

describe('ordem/[id] — Regra dos Hooks (nenhum hook após early-return)', () => {
  const src = readFileSync(FILE, 'utf-8')
  const corpo = corpoDoComponentePrincipal(src)

  it('tem um early-return de guarda (ordem undefined/null)', () => {
    expect(corpo).toMatch(/if \(ordem === (undefined|null)\)\s*return/)
  })

  it('NENHUM hook (useMemo/useState/useEffect) aparece depois do early-return', () => {
    const guardIdx = corpo.search(/if \(ordem === (undefined|null)\)\s*return/)
    expect(guardIdx).toBeGreaterThan(0)
    const depois = corpo.slice(guardIdx)
    expect(depois).not.toMatch(/\buseMemo\s*\(/)
    expect(depois).not.toMatch(/\buseState\s*\(/)
    expect(depois).not.toMatch(/\buseEffect\s*\(/)
  })
})
