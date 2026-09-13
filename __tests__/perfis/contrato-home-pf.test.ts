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
//
// ⚠️⚠️ **REAPONTADO EM 13/09, NÃO APAGADO.** A home do PF virou o DASHBOARD (`page.tsx` é
// uma casca sobre `components/perfis/dashboard-pf.tsx`), e as asserções antigas falavam de
// `cardSummary?.cards`/`summary?.totalDue` — chaves da tela que morreu. **A LIÇÃO não
// mudou:** contrato quebrado dá silêncio, e o empty state mente com cara de verdade. O que
// muda é o alvo: agora ele casa as chaves que o DASHBOARD lê com as que
// `/api/perfis/[id]/dashboard` devolve. Apagar o guard porque a tela mudou seria exatamente
// como o bug volta.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const raiz = process.cwd()
// ⭐ a home é uma casca sobre a view — o contrato vive na VIEW
const home = readFileSync(join(raiz, 'app/(dashboard)/perfis/[id]/page.tsx'), 'utf-8')
  + readFileSync(join(raiz, 'components/perfis/dashboard-pf.tsx'), 'utf-8')
  + readFileSync(join(raiz, 'components/perfis/lancamento-rapido.tsx'), 'utf-8')
const rotaCartoes = readFileSync(
  join(raiz, 'app/api/perfis/[id]/cartoes/dashboard-summary/route.ts'), 'utf-8',
)
const rotaDash = readFileSync(join(raiz, 'app/api/perfis/[id]/dashboard/route.ts'), 'utf-8')

/**
 * As chaves de topo que um `NextResponse.json({...})` devolve.
 *
 * ⚠️ A 1ª versão cortava em 400 caracteres e **enxergava só o `{ erro }` do 404** na rota do
 * dashboard — o guard acusaria contrato quebrado num payload correto. Janela larga e
 * indentação de 4 espaços (o objeto do `json` fica aninhado no `return`).
 */
function chavesDaResposta(src: string): string[] {
  const out: string[] = []
  // ⚠️ o fechamento aceita QUALQUER indentação: a rota do dashboard fecha com 2 espaços e a
  // dos cartões com 4 — cravar um número faz o guard enxergar só metade das rotas
  for (const m of src.matchAll(/NextResponse\.json\(\{([\s\S]{0,3000}?)\n\s*\}\)/g)) {
    for (const k of (m[1] ?? '').matchAll(/^\s{2,}(\w+)\s*[,:]/gm)) out.push(k[1])
  }
  return [...new Set(out)]
}

describe('⭐⭐ a home LÊ só chave que a rota DEVOLVE (o alvo mudou, a lição não)', () => {
  /** as chaves que o dashboard consome do payload, lidas do próprio componente */
  const lidas = [...home.matchAll(/\bd[.?]{1,2}(\w+)/g)].map((m) => m[1])
  const devolvidas = new Set([
    ...chavesDaResposta(rotaDash),
    // o spread `...dash` traz o que `montarDashboard` monta — conferido no teste do motor
    ...['entrou', 'saiu', 'sobrou', 'lancamentos', 'gastosPorCategoria', 'semCategoria',
      'pagamentosDeFatura', 'vazio', 'saldoNasContas', 'previstoFimDoMes', 'faturasNoPrevisto',
      'recebidoDaEmpresa', 'donut', 'cartoes', 'balanco', 'aVencer', 'mes'],
  ])

  it('⛔ nenhuma chave lida pelo dashboard falta no payload da rota', () => {
    const faltando = [...new Set(lidas)].filter((k) => !devolvidas.has(k))
    expect(faltando, 'a tela lê o que a rota não devolve — o widget viraria vazio em silêncio').toEqual([])
  })

  it('⭐ e a rota devolve o que a tela precisa pros widgets do mock', () => {
    for (const k of ['nome', 'contas', 'ultimos']) expect(chavesDaResposta(rotaDash)).toContain(k)
  })

  it('⚠️ os cartões ainda têm a rota antiga viva — ela não pode perder as chaves dela', () => {
    // a tela de Cartões (outra) consome esta; o guard de 27/08 continua valendo lá
    for (const campo of ['id', 'name', 'brand', 'usedPercent', 'invoiceOpenAmount']) {
      expect(rotaCartoes).toMatch(new RegExp(`${campo}:`))
    }
    expect(chavesDaResposta(rotaCartoes)).toContain('cards')
    expect(rotaCartoes).toMatch(/totalDue:/)
  })
})

describe('nenhum widget da home do PF lê fonte de EMPRESA', () => {
  it('⭐ todo fetch vai pra /api/perfis/ (ou passa profileId explícito)', () => {
    // ⚠️ o dashboard usa `fetchJson`, não `fetch` cru — o detector tem que ver os dois,
    // senão passa por cegueira (a lição dos guards que nasceram verdes)
    const urls = [...home.matchAll(/fetchJson<[^>]*>\(\s*[`'"]([^`'"]+)|fetch\(\s*[`'"]([^`'"]+)/g)]
      .map((m) => m[1] ?? m[2])
    expect(urls.length, 'o detector não está vendo os fetches').toBeGreaterThan(1)
    const suspeitos = urls.filter((u) => u.includes('/empresas/'))
    expect(suspeitos).toEqual([])
    // o único global aceito é o que recebe profileId
    for (const u of urls) {
      if (u.includes('/api/perfis/')) continue
      expect(u).toMatch(/profileId=/)
    }
  })
})
