// ⛔⛔⛔ O MOCK É A RÉGUA — DIVERGÊNCIA DO MOCK É DEFEITO (10/09/2026)
//
// **O dono:** *"basta de descrição em palavras: o arquivo do mock está em
// `docs/mocks/conciliacao-mock.html` — ABRE ELE e copia o visual EXATAMENTE. Ele é a
// régua; divergência do mock = defeito. (…) Se tua versão 'melhorou' algo do mock,
// desfaz — igual primeiro, melhoria só com meu pedido depois."*
//
// ⭐ POR ISSO O MOCK ENTROU NO REPO: enquanto ele vivia numa pasta de downloads, "igual ao
// mock" era memória minha. Versionado, ele é **dado**, e este teste LÊ o arquivo e compara
// com o que a tela usa. Cor ajustada "no olho" fica vermelha apontando o valor certo.
//
// ⚠️ ESTRUTURAL E ASSUMIDO COMO TAL: sem jsdom não dá pra renderizar e medir pixel. O que
// dá — e é o que morde — é provar que **os valores que a tela usa são os do arquivo**.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MOCK, LINHA_ENTRE_NOTAS, HOVER_NOTA } from '@/components/conciliacao/mock-tokens'

const raiz = process.cwd()
const ler = (p: string) => readFileSync(join(raiz, p), 'utf-8')

const mock = ler('docs/mocks/conciliacao-mock.html')
const fila = ler('components/conciliacao/fila-escolher-na-mao.tsx')
const card = ler('components/conciliacao/escolher-na-mao-card.tsx')
const stats = ler('components/conciliacao/stats-do-mock.tsx')
const pagina = ler('app/(dashboard)/conciliacao/page.tsx')
const tela = fila + card + stats

/**
 * ⚠️ COMENTÁRIO NÃO É TELA. Este arquivo (e os componentes) citam os textões mortos pra
 * explicar por que morreram — sem tirar comentário, o guard morderia a própria lápide.
 * Foi exatamente isso que aconteceu na 1ª rodada.
 */
function semComentarios(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}
const filaRender = semComentarios(fila)
const paginaRender = semComentarios(pagina)

/** ⭐ as variáveis do `:root{}` do mock, do jeito que estão escritas lá */
export function tokensDoMock(html: string): Record<string, string> {
  const bloco = /:root\s*\{([\s\S]*?)\}/.exec(html)?.[1] ?? ''
  const out: Record<string, string> = {}
  for (const m of bloco.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim()
  return out
}

/** ⭐ o valor de UMA propriedade dentro de UM seletor do mock */
export function regraDoMock(html: string, seletor: string, prop: string): string | null {
  const i = html.indexOf(seletor + '{')
  if (i === -1) return null
  const corpo = html.slice(i + seletor.length + 1, html.indexOf('}', i))
  const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`).exec(corpo)
  return m ? m[1].trim() : null
}

describe('⛔⛔ as CORES da tela são as do arquivo do mock', () => {
  const t = tokensDoMock(mock)

  it('o arquivo do mock está no repo e tem o :root', () => {
    expect(Object.keys(t).length).toBeGreaterThan(10)
  })

  const pares: [string, string][] = [
    ['bg', MOCK.bg], ['card', MOCK.card], ['ink', MOCK.ink], ['sub', MOCK.sub],
    ['line', MOCK.line], ['roxo', MOCK.roxo], ['roxo-fraco', MOCK.roxoFraco],
    ['verde', MOCK.verde], ['verde-fraco', MOCK.verdeFraco],
    ['ambar', MOCK.ambar], ['ambar-fraco', MOCK.ambarFraco],
    ['coral', MOCK.coral], ['coral-fraco', MOCK.coralFraco],
    ['slate', MOCK.slate], ['slate-fraco', MOCK.slateFraco],
    ['frio', MOCK.frio], ['quente', MOCK.quente],
  ]
  for (const [nome, usado] of pares) {
    it(`--${nome} bate ao caractere`, () => {
      expect(usado.toLowerCase()).toBe(t[nome].toLowerCase())
    })
  }

  it('as duas cores fora do :root (borda entre notas e hover) também', () => {
    expect(regraDoMock(mock, 'label.nota', 'border-top')).toContain(LINHA_ENTRE_NOTAS)
    expect(regraDoMock(mock, 'label.nota:hover', 'background')).toBe(HOVER_NOTA)
  })
})

describe('⛔⛔ as MEDIDAS da tela são as do arquivo do mock', () => {
  // cada linha: [seletor, propriedade, onde a tela tem que carregar o valor]
  const medidas: [string, string, string][] = [
    ['.card', 'border-radius', 'rounded-[16px]'],
    ['.card-h', 'gap', 'gap-[10px]'],
    ['.card-h', 'padding', 'py-[14px]'],
    ['.linha-banco', 'padding', 'py-[12px]'],
    ['.instr', 'padding', 'pt-[10px]'],
    ['.grupo-t', 'padding', 'pb-[4px]'],
    ['label.nota', 'padding', 'py-[10px]'],
    ['.ajuste', 'padding', 'px-[12px]'],
    ['.rodape', 'padding', 'py-[12px]'],
    ['.btn', 'padding', 'px-[18px]'],
    ['.card', 'margin-bottom', 'mb-[12px]'],
    ['.card-h .nome', 'font-size', 'text-[15px]'],
    ['label.nota', 'gap', 'gap-[12px]'],
    ['label.nota', 'font-size', 'text-[14px]'],
    ['label.nota input', 'width', "width: '19px'"],
    ['label.nota .desc small', 'font-size', 'text-[12px]'],
    ['.linha-banco', 'font-size', 'text-[13.5px]'],
    ['.linha-banco b', 'font-size', 'text-[15px]'],
    ['.instr', 'font-size', 'text-[13px]'],
    ['.grupo-t', 'font-size', 'text-[11.5px]'],
    ['.secao-t', 'font-size', 'text-[13px]'],
    ['.dica', 'font-size', 'text-[12.5px]'],
    ['.ajuste', 'font-size', 'text-[13px]'],
    ['.ajuste', 'border-radius', 'rounded-[10px]'],
    ['.conta', 'font-size', 'text-[13.5px]'],
    ['.btn', 'border-radius', 'rounded-[12px]'],
    ['.btn', 'font-size', 'text-[14.5px]'],
    // ── os 3 stats do topo ──
    ['.stats', 'gap', 'gap-[10px]'],
    ['.stats', 'margin-bottom', 'mb-[18px]'],
    ['.stat', 'border-radius', 'rounded-[14px]'],
    ['.stat', 'padding', 'py-[12px]'],
    ['.stat .k', 'font-size', 'text-[11px]'],
    ['.stat .k', 'letter-spacing', 'tracking-[.04em]'],
    ['.stat .v', 'font-size', 'text-[26px]'],
    ['.stat .v', 'margin-top', 'mt-[2px]'],
    ['.stat .d', 'font-size', 'text-[12px]'],
  ]
  for (const [seletor, prop, naTela] of medidas) {
    it(`${seletor} { ${prop} } → a tela usa ${naTela}`, () => {
      const doMock = regraDoMock(mock, seletor, prop)
      expect(doMock, `${seletor}{${prop}} sumiu do mock`).not.toBeNull()
      // o valor do mock aparece dentro do que a tela escreve (ex.: 16px em rounded-[16px])
      // ⚠️ padding do mock é shorthand ("14px 16px"): o número que a tela usa tem que ser
      // UM dos que o mock escreve — não "parecido", literalmente um deles.
      const numerosDoMock = (doMock!.match(/[\d.]+/g) ?? [])
      const numeroDaTela = (naTela.match(/[\d.]+/g) ?? []).pop()!
      expect(numerosDoMock, `${seletor}{${prop}} = ${doMock}`).toContain(numeroDaTela)
      expect(tela).toContain(naTela)
    })
  }

  it('⭐ o rodapé tem borda de 2px em cima, como no mock', () => {
    expect(regraDoMock(mock, '.rodape', 'border-top')).toContain('2px')
    expect(card).toContain('borderTop: `2px solid ${MOCK.line}`')
  })

  it('⭐ o botão primário NASCE opaco em 35% e sem pointer-events', () => {
    expect(regraDoMock(mock, '.btn-p', 'opacity')).toBe('.35')
    expect(regraDoMock(mock, '.btn-p', 'pointer-events')).toBe('none')
    expect(card).toContain('0.35')
    expect(card).toContain('pointerEvents')
  })

  it('⭐ a seta gira 90° ao abrir, como no mock', () => {
    expect(regraDoMock(mock, '.card.aberto .seta', 'transform')).toBe('rotate(90deg)')
    expect(fila).toContain("rotate(90deg)")
    expect(fila).toContain('▶')
  })

  it('⭐ a nota sugerida tem o fundo roxo-fraco', () => {
    expect(regraDoMock(mock, 'label.nota.sugerida', 'background')).toBe('var(--roxo-fraco)')
    expect(card).toContain('MOCK.roxoFraco')
  })
})

describe('⭐⭐ os 3 STATS do topo', () => {
  it('a grade é de 3 colunas, como no mock', () => {
    expect(regraDoMock(mock, '.stats', 'grid-template-columns')).toBe('repeat(3,1fr)')
    expect(stats).toContain('grid-cols-3')
  })

  it('o número do "pra tua mão" é ROXO (`.stat.acao .v`)', () => {
    expect(regraDoMock(mock, '.stat.acao .v', 'color')).toBe('var(--roxo)')
    expect(stats).toContain('acao ? MOCK.roxo')
  })

  it('os três rótulos são as três filas da tela', () => {
    for (const r of ['Prontos pra confirmar', 'Pra tua mão', 'Sem pagamento']) {
      expect(stats).toContain(r)
    }
  })

  it('⛔ a dupla contagem só entra quando > 0 — anomalia não é móvel fixo', () => {
    expect(stats).toContain('filas.duplaContagem > 0 &&')
  })

  it('⛔ os números vêm da MESMA função do badge (`contarFilas`)', () => {
    const lib = ler('lib/conciliacao/fila-de-conciliacao.ts')
    // no payload da tela E no contador do badge — duas chamadas, uma régua
    expect((lib.match(/contarFilas\(/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })
})

describe('⛔⛔ os TEXTÕES morreram — tela não é manual', () => {
  it('o parágrafo "Passo 2 de 2…" saiu da tela (virou ⓘ)', () => {
    // ⚠️ o texto vive no `title` do ⓘ; o que não pode é ele RENDERIZAR como parágrafo
    // ⚠️ a doutrina NÃO se perdeu — ela mudou de lugar. O teste separa os dois:
    // antes do `title={` (o que RENDERIZA) não pode ter; depois dele, tem que ter.
    const [renderizado, dentroDoTooltip] = paginaRender.split('title={')
    expect(renderizado, 'a aula voltou a renderizar como parágrafo').not.toContain('Importou o extrato →')
    expect(dentroDoTooltip, 'a doutrina sumiu junto com o parágrafo').toContain('Importou o extrato →')
    expect(pagina).toContain('ⓘ')
  })

  it('o parágrafo de instrução da seção "Pra tua mão" morreu inteiro', () => {
    expect(filaRender).not.toContain('esperando você dizer quais notas')
    expect(filaRender).not.toContain('Marque as notas')
    expect(filaRender).not.toContain('costuma ser')
  })

  it('⭐ mas o TÍTULO da seção fica — é ele que nomeia o trabalho', () => {
    expect(mock).toContain('Pra tua mão — o pagamento existe, você diz o que ele pagou')
    expect(fila).toContain('Pra tua mão — o pagamento existe, você diz o que ele pagou')
  })
})

describe('⛔ os textos que o mock imprime', () => {
  it('o rodapé fala "selecionado …" e "✓ soma crava com o pagamento"', () => {
    expect(mock).toContain('soma crava com o pagamento')
    expect(card).toContain('soma crava com o pagamento')
    expect(card).toContain('selecionado')
  })

  it('os dois botões do rodapé são "não é isso" (ghost) e o primário', () => {
    expect(mock).toContain('não é isso')
    expect(card).toContain('não é isso')
  })

  it('os títulos de grupo são "Vencidas" e "A vencer (…)"', () => {
    expect(mock).toContain('>Vencidas<')
    expect(card).toContain('Vencidas')
    expect(mock).toContain('A vencer (o pagamento pode ter levado junto)')
    expect(card).toContain('A vencer (o pagamento pode ter levado junto)')
  })

  it('⚠️ o menos é o U+2212 do mock, não hífen', () => {
    expect(mock).toContain('− R$')
    expect(card).toContain('`− ${formatBRL(v)}`')
  })
})

// ⭐⭐ REGRA 11 — o extrator tem que ENXERGAR, senão o guard aprova por cegueira.
describe('os extratores mordem (auto-teste)', () => {
  const AMOSTRA = ':root{ --a:#111111; --b-c:#222; }\n.x{border-radius:16px; gap:10px;}'

  it('lê as variáveis do :root', () => {
    expect(tokensDoMock(AMOSTRA)).toEqual({ a: '#111111', 'b-c': '#222' })
  })

  it('lê a propriedade certa dentro do seletor', () => {
    expect(regraDoMock(AMOSTRA, '.x', 'border-radius')).toBe('16px')
    expect(regraDoMock(AMOSTRA, '.x', 'gap')).toBe('10px')
    expect(regraDoMock(AMOSTRA, '.x', 'color')).toBeNull()
    expect(regraDoMock(AMOSTRA, '.nao-existe', 'gap')).toBeNull()
  })

  it('⛔ acusa cor trocada — o defeito que este guard existe pra pegar', () => {
    const t = tokensDoMock(mock)
    expect('#534AB7'.toLowerCase()).toBe(t.roxo.toLowerCase())
    expect('#5340FF'.toLowerCase()).not.toBe(t.roxo.toLowerCase())
  })
})
