/**
 * ⭐ A TELA "LUCRO POR SETOR" BATE COM A LEI — docs/lucro-por-setor-referencia.html (v11 APROVADA, 11/11/2026 23:54).
 *
 * ⛔ ARQUIVO DE REFERÊNCIA = LEI: este guard ABRE o arquivo e tira dele as medidas e as frases —
 * nada aqui é "igual ao mock" de memória. A tela pode trocar o hex do mock pelos tokens da casa
 * (`--prod-*`), mas grade, medidas, rótulos e frases são 1:1.
 * ⚠️ S12: os NÚMEROS do arquivo são amostra — as contas são provadas em lib/lucro-setor/__tests__.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const raiz = process.cwd()
const ler = (rel: string) => readFileSync(join(raiz, rel), 'utf8')
const semComentario = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^[ \t]*\/\/.*$/gm, '')

const LEI = ler('docs/lucro-por-setor-referencia.html')
const TELA = semComentario(ler('app/(dashboard)/empresas/[id]/estoque/lucro-setor/page.tsx'))
const ESTUDO = semComentario(ler('lib/lucro-setor/estudo.ts'))
const CSS_LEI = LEI.slice(LEI.indexOf('<style>'), LEI.indexOf('</style>'))
const CSS_TELA = TELA.slice(TELA.indexOf('const CSS = `'))

describe('Lucro por Setor · a tela bate com a lei v11', () => {
  it('a lei é a v11 APROVADA (e tem as leis S0–S23)', () => {
    expect(LEI).toContain('<title>Lucro por Setor — referência v11 APROVADA</title>')
    for (let n = 0; n <= 23; n++) expect(LEI).toMatch(new RegExp(`S${n}\\s*·`))
  })

  it('S16 · as GRADES e medidas saem do arquivo da lei, 1:1', () => {
    const medidas = [
      /\.g5 \.head,\.g5 \.cab\{grid-template-columns:([^}]+)\}/,
      /\.g6 \.head,\.g6 \.cab\{grid-template-columns:([^}]+)\}/,
      /\.grid\{display:grid;grid-template-columns:([^}]+)\}/,
      /\.v-grid\{display:grid;grid-template-columns:([^;]+);/,
      /\.setor \.lucro\{font-size:(\d+px)/,
      /\.head\{display:grid;gap:10px;font-size:([\d.]+px)/,
      /@media\(max-width:(\d+px)\)/,
      /\.g5 \.cab\{grid-template-columns:([^;]+);grid-template-areas:"un nm ch" "st st st"\}/,
      /\.g6 \.cab\{grid-template-columns:([^;]+);grid-template-areas:"un nm bg" "st st st"\}/,
    ]
    for (const re of medidas) {
      const m = CSS_LEI.match(re)
      expect(m, `a lei tem ${re}`).not.toBeNull()
      expect(CSS_TELA, `a tela usa ${m![1]} (${re})`).toContain(m![1])
    }
  })

  it('S15 · tela muda: nenhum hex no CSS, nenhum parágrafo de prosa, nenhum número de lei na interface', () => {
    expect(CSS_TELA.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([])
    expect(TELA).not.toMatch(/<p[\s>]/)
    const jsx = TELA.slice(0, TELA.indexOf('const CSS = `'))
    expect(jsx.match(/>[^<{]*\bS\d{1,2}\b[^<]*</g) ?? []).toEqual([])
  })

  it('E1 · cara de sistema: a tela ocupa a área útil (nenhum teto herdado do mock)', () => {
    expect(CSS_LEI).toMatch(/max-width:1060px/) // o mock tem — a tela não herda
    expect(CSS_TELA).not.toMatch(/max-width:\s*1060px/)
  })

  it('S18 · celular nunca esconde dinheiro: a coluna vira 2ª linha com rótulo (VENDEU · CUSTO · MARGEM)', () => {
    expect(CSS_TELA).toMatch(/\.ls \.stats\{grid-area:st;display:flex/)
    expect(CSS_TELA).toMatch(/\.ls \.rot\{display:inline/)
    for (const r of ['vendeu', 'custo', 'margem', 'custo ficha', 'ficha']) expect(TELA).toContain(`<span className="rot">${r}</span>`)
    // a única coisa que some no celular é a CABECINHA (o rótulo vai pra linha)
    const some = [...CSS_TELA.matchAll(/@media\(max-width:620px\)\{([\s\S]*?)\n\}/g)].map((m) => m[1]).join('')
    expect([...some.matchAll(/([^{}]+)\{display:none\}/g)].map((m) => m[1].trim())).toEqual(['.ls .g5 .head,.ls .g6 .head'])
  })

  it('as FRASES da lei estão na tela (e só as da lei — lidas do arquivo)', () => {
    const frases = [
      'CAMADA 1 · O QUE VENDEU', 'CAMADA 2 · SABORES DO DIA', 'CUSTO TOTAL DO SETOR', 'LUCRO DO SETOR', 'LUCRO DO ITEM',
      'ver pedidos →', '🏷 PROMO DETECTADA', 'fichas 100% ✓', 'un sem ficha →', 'custo (fichas)', 'Itens do setor', 'ESTUDO DO ITEM',
      'e se vendesse a', 'pra empatar hoje', 'régua dias normais', 'em formação', 'lucro por un', 'não paga o custo',
      'item sem ficha — criar ficha pra estudar →', 'custo incompleto, lucro é', 'custou (base + sabores)', 'lucro de hoje', 'lucro por unidade',
      'A PROMOÇÃO VALEU', 'A PROMOÇÃO NÃO VALEU', 'de lucro vs um dia normal', 'vender pouco e caro (dia normal) daria', 'a promo deu só',
      'criar ficha →', 'abrir ficha →', '+ adicionar ingrediente', 'custo da ficha', '📅 escolher…', 'estudar ↓', 'importa o dia →',
    ]
    for (const f of frases) {
      expect(LEI, `a lei diz "${f}"`).toContain(f)
      expect(TELA + ler('components/estoque/ficha-na-linha.tsx'), `a tela diz "${f}"`).toContain(f)
    }
    // S21/S23 · os vereditos do E SE (moram na conta pura, que a tela usa)
    for (const f of ['✓ A PROMO GANHOU', '✓ COMO FOI HOJE GANHA', '✗ A PREÇO CHEIO LUCRARIA MAIS', '✗ A ESSE PREÇO LUCRARIA MAIS']) {
      expect(LEI).toContain(f)
      expect(ESTUDO).toContain(f)
    }
  })

  it('S6 · o quadrante da lei (⭐ 🐴 💎 🐶) e o corte na mediana de baixo, x[floor((n−1)/2)]', () => {
    expect(LEI).toContain('x[Math.floor((x.length-1)/2)]')
    expect(ESTUDO).toMatch(/x\[Math\.floor\(\(x\.length - 1\) \/ 2\)\]/)
    for (const q of ['⭐', '🐴', '💎', '🐶']) expect(ESTUDO).toContain(q)
  })

  it('E1 (12/11) · a emenda está NA LEI e a tela obedece: o estudo é painel próprio, nunca preso ao veredito nem ao parcial', () => {
    expect(LEI).toContain('EMENDAS APROVADAS PELO DONO (12/11/2026')
    expect(LEI).toContain('E1 · O ESTUDO DO ITEM APARECE TODO DIA')
    expect(LEI).toContain('E2 · LUGAR NO MENU')
    // o painel do estudo decide SÓ por `paineis.estudo` (a porta `paineisDoDia`)
    const corpo = TELA.slice(TELA.indexOf('const renderPainelEstudo'), TELA.indexOf('\n', TELA.indexOf('const renderPainelEstudo')))
    expect(corpo).toMatch(/paineis\.estudo \?/)
    expect(corpo).not.toMatch(/parcial|veredito/)
    // e o estudo NÃO mora dentro do painel do veredito
    const ver = TELA.slice(TELA.indexOf('const renderVeredito'), TELA.indexOf('const renderPainelEstudo'))
    expect(ver).not.toContain('renderEstudo()')
    expect(TELA).toMatch(/\{renderVeredito\(\)\}\s*\{renderPainelEstudo\(\)\}/)
    // o selo do parcial vai ao lado do estudo
    expect(TELA).toContain('data-testid="estudo-parcial"')
  })

  it('E3 (12/11) · a emenda está NA LEI e a tela separa "sem ficha" × "ingrediente sem preço", com ⚠ e o atalho pra porta do preço', () => {
    expect(LEI).toContain('E3 · FICHA COM INGREDIENTE SEM PREÇO')
    expect(TELA).toContain('un com ingrediente sem preço →')
    expect(TELA).toContain('un sem ficha →')
    expect(TELA).toContain('data-testid="selo-sem-preco"')
    // ⛔ "fichas 100% ✓" só quando NÃO falta ficha NEM preço
    expect(TELA).toMatch(/s\.unSemFicha === 0 && s\.unSemPreco === 0 && <span className="cob ok">fichas 100% ✓/)
    const ficha = semComentario(ler('components/estoque/ficha-na-linha.tsx'))
    expect(ficha).toContain('href={`/empresas/${companyId}/estoque/itens/${c.itemId}`}') // a porta que JÁ define o preço do insumo
    expect(ficha).toContain('rodapeDaFicha(comps, formatBRL)')
    // a lista do cardápio (irmão): o parcial aparece como PISO, com ⚠
    expect(semComentario(ler('app/(dashboard)/empresas/[id]/estoque/cardapio/page.tsx'))).toMatch(/⚠ ≥ \{brl\(l\.custoParcial\)\}/)
  })

  it('S21 · a conta do empate é a da lei (ceil(lucro ÷ lucro por un)) e o campo começa no preço de HOJE (S23)', () => {
    expect(LEI).toContain('Math.ceil(e.lucro/lucroUn)')
    expect(ESTUDO).toMatch(/Math\.ceil\(e\.lucro \/ lucroUn/)
    expect(LEI).toContain('começa no preço de HOJE do item')
    expect(TELA).toMatch(/precoTxt \?\? String\(e\.preco/)
  })
})
