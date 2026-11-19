// ⭐⭐ A BANCADA DE VÍNCULOS BATE COM A LEI (docs/bancada-referencia.html, v1 APROVADA, R32–R35, 19/11/2026).
//
// ⛔ ARQUIVO DE REFERÊNCIA = LEI: este guard ABRE a referência e compara com a tela — tokens --esc-* POR
// VALOR, rótulos do placar, filtros (na ordem), colunas, ações, o ⓘ, os chips do Cardápio e os dois
// viewports (REGRA 12). Tela lida SEM comentário. A LÓGICA (ordem, placar que desconta, régua da baixa,
// sugestão que não grava) é provada por EXECUÇÃO em lib/stock/cardapio/__tests__/bancada-*.test.ts.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { FILTROS_DA_BANCADA } from '@/lib/stock/cardapio/bancada-regras'

const ler = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')
const semComentario = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
const norm = (s: string) => s.replace(/&quot;/g, '"').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
const LEI = ler('docs/bancada-referencia.html')
const LEI_SEM_COMENTARIO = LEI.replace(/<!--[\s\S]*?-->/g, '')
const TELA = semComentario(ler('components/estoque/bancada-de-vinculos.tsx'))
const CARDAPIO = semComentario(ler('app/(dashboard)/empresas/[id]/estoque/cardapio/page.tsx'))
const textoDaTela = norm(TELA.replace(/&quot;/g, '"'))

describe('a lei é a certa', () => {
  it('título exato', () => {
    expect(LEI).toContain('<title>BANCADA DE VÍNCULOS (estoque) — referência v1 APROVADA</title>')
  })
})

describe('tokens --esc-* POR VALOR', () => {
  it('cada --esc-* da lei tem o MESMO valor no :root da casa', () => {
    const css = ler('app/globals.css')
    const raiz = css.slice(css.indexOf('--esc-bg: #f3f5fa') - 200)
    const b = raiz.slice(raiz.indexOf(':root {'), raiz.indexOf('}', raiz.indexOf(':root {')))
    const tokens = [...LEI.match(/:root\{([\s\S]*?)\}/)![1].matchAll(/(--esc-[\w-]+):\s*(#[0-9A-Fa-f]{6})/g)]
    expect(tokens.length).toBeGreaterThan(12)
    for (const [, k, v] of tokens) expect(b.match(new RegExp(`${k}:\\s*(#[0-9a-f]{6})`))?.[1], k).toBe(v.toLowerCase())
  })
  it('a tela não tem cor crua: só var(--esc-*)', () => {
    expect(TELA).not.toMatch(/#[0-9A-Fa-f]{3,8}\b(?![\w-])/)
    expect(TELA).not.toMatch(/rgba?\(/)
  })
})

describe('R32 — a aba no Cardápio, com contador', () => {
  it('os 3 chips da lei, na ordem, e a Bancada com o número da fila', () => {
    const chips = [...LEI_SEM_COMENTARIO.match(/<div class="chips">([\s\S]*?)<\/div>/)![1].matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) => norm(m[1]))
    expect(chips).toEqual(['Produtos', 'Complementos (sabores)', 'Bancada'])
    expect(CARDAPIO).toContain("(['produtos', 'complementos', 'bancada'] as const)")
    expect(CARDAPIO).toContain("'Produtos' : t === 'complementos' ? 'Complementos (sabores)' : <>Bancada")
    expect(CARDAPIO).toContain('data-testid="bancada-contador"')
    expect(CARDAPIO).toContain('<BancadaDeVinculos id={id} onContagem={setNFila} />')
  })
})

describe('R33 — o placar', () => {
  it('os 3 cartões com os rótulos e o "ver a conta →" da lei', () => {
    const rot = [...LEI_SEM_COMENTARIO.matchAll(/<div class="rot">([^<]+)<\/div>/g)].map((m) => m[1])
    expect(rot).toEqual(['Vendido sem baixar · 30 dias', 'Custo vazando · estimado', 'Na fila'])
    for (const r of rot) expect(TELA, r).toContain(`<div className="rot">${r}</div>`)
    expect(TELA).toContain("'ver a conta →'")
    expect(LEI_SEM_COMENTARIO).toContain('pela razão custo/faturamento do que baixa')
    expect(TELA).toContain('<div className="sub">pela razão custo/faturamento do que baixa</div>')
  })
  it('o placar é DERIVADO das linhas (uso, não menção) — é isso que desconta na hora', () => {
    expect(TELA).toMatch(/useMemo\(\(\) => placarDe\(linhas, razao\)/)
    expect(TELA).toMatch(/setLinhas\(\(ls\) => aplicarDecisao\(ls, l\.chave/)
  })
})

describe('R34 — a fila', () => {
  it('filtros da lei, na ordem, com contador', () => {
    const daLei = [...LEI_SEM_COMENTARIO.matchAll(/\{rot:'([^']+)',/g)].map((m) => m[1])
    expect(FILTROS_DA_BANCADA.map((f) => f.rotulo)).toEqual(daLei)
    expect(TELA).toContain('FILTROS_DA_BANCADA.map((f) =>')
    expect(TELA).toContain('<span className="fn num">{contagem[f.chave]}</span>')
  })
  it('colunas da lei e o título do cartão', () => {
    const h = LEI_SEM_COMENTARIO.match(/<div class="bhead">([\s\S]*?)<\/div>/)![1]
    const cols = [...h.matchAll(/<span[^>]*>([^<]*)<\/span>/g)].map((m) => m[1])
    expect(cols).toEqual(['Nome', 'Vendido 30d', 'R$ 30d', ''])
    expect(TELA).toContain('<div className="bc-bhead"><span>Nome</span><span className="dir">Vendido 30d</span><span className="dir">R$ 30d</span><span className="dir"></span></div>')
    expect(textoDaTela).toContain('Fila · maior vazamento primeiro')
  })
  it('a ordem da tela é a da lib (R34): a lista desenhada sai de `filaVisivel`', () => {
    expect(TELA).toMatch(/useMemo\(\(\) => filaVisivel\(linhas, filtro, busca\)/)
    expect(TELA).toContain('{visiveis.map((l) =>')
  })
  it('chips de tipo, "incluso no preço" e as unidades da lei', () => {
    for (const p of ["'produto' : 'complemento'", 'incluso no preço', "'ocorr.' : 'un'"]) expect(TELA, p).toContain(p)
  })
})

describe('R35 — as ações e a sugestão', () => {
  it('as 3 ações da lei + desfazer; a sugestão com a frase da lei', () => {
    const acoes = [...LEI_SEM_COMENTARIO.match(/<div class="acoes">([\s\S]*?)<\/div>/)![1].matchAll(/<button[^>]*>([^<]+)<\/button>/g)].map((m) => m[1])
    expect(acoes).toEqual(['apontar ficha…', 'criar ficha →', 'ignorar'])
    expect(TELA).toContain('>apontar ficha…</button>')
    expect(TELA).toContain('>criar ficha →</a>')
    expect(TELA).toContain('>ignorar</button>')
    expect(TELA).toContain('>desfazer</button>')
    expect(LEI_SEM_COMENTARIO).toContain('parece com <a href="#">mapear na ficha “${r.sug}” →</a>')
    expect(TELA).toContain('parece com <button')
    expect(TELA).toContain('>mapear na ficha “{l.sugestao.nomeFicha}” →</button>')
  })
  it('as gravações são as MESMAS das abas (vendas/mapear e complementos/mapear)', () => {
    expect(TELA).toContain('`/api/empresas/${id}/estoque/vendas/mapear`')
    expect(TELA).toContain('`/api/empresas/${id}/estoque/vendas/complementos/mapear`')
  })
  it('o ⓘ diz o que a lei diz', () => {
    const pop = norm(LEI_SEM_COMENTARIO.match(/<span class="pop">([\s\S]*?)<\/span>/)![1])
    expect(textoDaTela).toContain(pop)
  })
})

describe('REGRA 12 — os dois viewports da lei', () => {
  it('o mesmo corte de 760px e a grade do celular', () => {
    expect(LEI).toContain('@media (max-width:760px)')
    expect(TELA).toContain('@media (max-width:760px)')
    expect(TELA).toContain('grid-template-areas:"nm rs" "meta meta" "acoes acoes"')
    expect(TELA).toContain('@media (min-width:761px){ .bc-brow .metawrap{display:contents} }')
  })
})
