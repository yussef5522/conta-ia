// REGRA 5 — a home do PF não pode voltar a ler chave que o endpoint não devolve.
//
// ⚠️ A CLASSE DE BUG: contrato quebrado **não dá erro, dá SILÊNCIO**. A home fazia
// `cardSummary?.cards ?? []` e o endpoint devolvia `byCard` dentro de `summary` —
// resultado: lista vazia e a tela dizendo **"Nenhum cartão cadastrado"** enquanto a
// tela de Cartões mostrava o banrisul PF normalmente. O empty state MENTE com cara de
// verdade: "nenhum cartão" é uma resposta plausível, então ninguém desconfia.
//
// A varredura de 27/08 achou DOIS: `cards` (cartões) e `transactions` × `items`
// (a lista de movimentações da home, vazia pelo mesmo motivo).
//
// Este guard é estrutural: casa as chaves que a home LÊ com as que a rota DEVOLVE.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const raiz = process.cwd()
const home = readFileSync(join(raiz, 'app/(dashboard)/perfis/[id]/page.tsx'), 'utf-8')
const rotaCartoes = readFileSync(
  join(raiz, 'app/api/perfis/[id]/cartoes/dashboard-summary/route.ts'), 'utf-8',
)

/** As chaves de topo que um `NextResponse.json({...})` devolve. */
function chavesDaResposta(src: string): string[] {
  const out: string[] = []
  for (const m of src.matchAll(/NextResponse\.json\(\{([\s\S]{0,400}?)\}\)/g)) {
    for (const k of m[1].matchAll(/^\s*(\w+)\s*[,:]/gm)) out.push(k[1])
  }
  return [...new Set(out)]
}

describe('cartões — o bug que dizia "Nenhum cartão cadastrado"', () => {
  it('⭐ a rota devolve `cards`, que é o que a home lê', () => {
    expect(home).toMatch(/cardSummary\?\.cards/)
    expect(chavesDaResposta(rotaCartoes)).toContain('cards')
  })

  it('⭐ e devolve `totalDue` dentro de summary (a home lê `summary?.totalDue`)', () => {
    expect(home).toMatch(/cardSummary\?\.summary\?\.totalDue/)
    expect(rotaCartoes).toMatch(/totalDue:/)
  })

  it('cada cartão vem com o que a home mostra (nome, %, fatura em aberto)', () => {
    for (const campo of ['id', 'name', 'brand', 'usedPercent', 'invoiceOpenAmount']) {
      expect(rotaCartoes).toMatch(new RegExp(`${campo}:`))
    }
  })
})

describe('movimentações — o segundo contrato quebrado, achado na varredura', () => {
  it('⭐ a home aceita `items` (o que a rota devolve de verdade)', () => {
    expect(home).toMatch(/txs\?\.items/)
  })

  it('⚠️ e o `transactions` fica como fallback — não some, pra não quebrar o inverso', () => {
    expect(home).toMatch(/txs\?\.items \?\? txs\?\.transactions/)
  })
})

describe('nenhum widget da home do PF lê fonte de EMPRESA', () => {
  it('⭐ todo fetch vai pra /api/perfis/ (ou passa profileId explícito)', () => {
    const urls = [...home.matchAll(/fetch\(\s*[`'"]([^`'"]+)/g)].map((m) => m[1])
    expect(urls.length).toBeGreaterThan(5) // garante que o teste está vendo os fetches
    const suspeitos = urls.filter((u) => u.includes('/empresas/'))
    expect(suspeitos).toEqual([])
    // o único global aceito é o que recebe profileId
    for (const u of urls) {
      if (u.includes('/api/perfis/')) continue
      expect(u).toMatch(/profileId=/)
    }
  })
})
