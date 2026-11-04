/**
 * ⭐⭐⭐ O MUSEU DE ARMADILHAS DO APAGADOR DE COMENTÁRIOS (05/11/2026)
 *
 * ⛔⛔⛔ **A porta única de leitura de fonte não tinha teste próprio — e ela é a peça de que
 * TODOS os guards estruturais da casa dependem (55 arquivos a importam).** Três furos no
 * mesmo lugar, todos medidos:
 *
 *   1. 08/10 — comentário JSX preguiçoso comeu **4.431 chars** na central de import;
 *   2. a cura foi um regex melhor;
 *   3. 04/11 — `accept` de imagem (valor terminando em barra-asterisco) abriu comentário
 *      falso **dentro da string** e engoliu **27.816 de 81.765 chars (34%)** de
 *      `conferencia-view.tsx`, num bloco único de **16.069**.
 *
 * ⭐ A cura de verdade foi trocar regex por **parser do TypeScript**. Este arquivo é o museu:
 * cada caso aqui é uma armadilha que um apagador por regex erra e um parser acerta.
 * *Detector com um lugar só e um furo é cegueira em todos os guards de uma vez.*
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { semComentarios, semComentariosDeFragmento, semComentariosDeCss, chamadasDe } from './_leitura-de-fonte'

/** ⭐ o que um apagador honesto faz: tira o comentário e NÃO mexe no resto */
const limpo = (src: string, arq?: string) => semComentarios(src, arq)

describe('o apagador REMOVE comentário de verdade', () => {
  it('comentário de linha sai', () => {
    const r = limpo('const a = 1 // o apagador me tira\nconst b = 2\n', 'x.ts')
    expect(r).not.toContain('o apagador me tira')
    expect(r).toContain('const a = 1')
    expect(r).toContain('const b = 2')
  })

  it('comentário de bloco sai, inclusive multilinha', () => {
    const r = limpo('/* linha 1\n   linha 2 */\nconst a = 1\n', 'x.ts')
    expect(r).not.toContain('linha 1')
    expect(r).not.toContain('linha 2')
    expect(r).toContain('const a = 1')
  })

  it('{/* comentário JSX */} sai — o caso que o `forEachChild` sozinho não achava', () => {
    const r = limpo('const a = <div>{/* some daqui */}<b/></div>\n', 'x.tsx')
    expect(r).not.toContain('some daqui')
    expect(r).toContain('<b/>')
  })

  it('comentário TRAILING, no fim da linha de código, sai', () => {
    const r = limpo('const a = <div>{x /* trailing */}</div>\n', 'x.tsx')
    expect(r).not.toContain('trailing')
    expect(r).toContain('{x')
  })

  /** ⛔ O CASO QUE MORDEU EM 04/11: o corpo do comentário contém a sequência de abertura */
  it('⛔ comentário cujo CORPO tem a sequência de abre-comentário sai inteiro, sem vazar', () => {
    const src = 'const a = 1\n/* explico que o atributo vale "image" + barra + ' + '/' + '* e isso quebrava */\nconst visivel = 2\n'
    const r = limpo(src, 'x.ts')
    expect(r).not.toContain('explico que o atributo')
    expect(r, 'o código DEPOIS do comentário tem que sobreviver').toContain('const visivel = 2')
  })
})

describe('⛔ o apagador NÃO toca no que só PARECE comentário', () => {
  /**
   * ⛔⛔ A ARMADILHA MEDIDA EM PROD. O atributo de upload de imagem tem valor
   * `image` + barra + asterisco; a sequência dentro da string abria um comentário falso que
   * corria até o próximo fecha-comentário, lá embaixo.
   */
  it('⛔ barra-asterisco DENTRO DE STRING não abre comentário (o bug dos 27.816 chars)', () => {
    const src = 'const a = "image/*"\nconst depois = "EU TENHO QUE SOBREVIVER"\n/* este sim é comentário */\n'
    const r = limpo(src, 'x.ts')
    expect(r, 'a string é dado, não comentário').toContain('"image/*"')
    expect(r, 'o código seguinte não pode ser engolido').toContain('EU TENHO QUE SOBREVIVER')
    expect(r).not.toContain('este sim é comentário')
  })

  it('⛔ fecha-comentário dentro de string não fecha nada', () => {
    const src = 'const a = "fim: */"\nconst depois = "VIVO"\n'
    const r = limpo(src, 'x.ts')
    expect(r).toContain('"fim: */"')
    expect(r).toContain('VIVO')
  })

  it('⛔ a barra-barra de uma URL dentro de string não é comentário de linha', () => {
    const src = 'const u = "http://x.test/a"\nconst depois = "VIVO"\n'
    const r = limpo(src, 'x.ts')
    expect(r, 'a URL inteira fica').toContain('"http://x.test/a"')
    expect(r).toContain('VIVO')
  })

  it('⛔ template literal: texto é dado; só o que está dentro de ${} é código', () => {
    const src = 'const t = `antes /* nao e */ ${ y /* este é */ } depois */`\nconst depois = "VIVO"\n'
    const r = limpo(src, 'x.ts')
    expect(r, 'o texto do template é dado').toContain('antes /* nao e */')
    expect(r, 'e o fecha-comentário no texto também').toContain('depois */')
    expect(r, 'mas o comentário DENTRO da interpolação sai').not.toContain('este é')
    expect(r).toContain('VIVO')
  })

  it('⛔ regex literal com asterisco não é comentário — nem divisão é', () => {
    const src = 'const re = /a*/g\nconst div = a/b/c\nconst depois = "VIVO"\n'
    const r = limpo(src, 'x.ts')
    expect(r).toContain('/a*/g')
    expect(r).toContain('a/b/c')
    expect(r).toContain('VIVO')
  })

  it('⛔ TEXTO JSX com barra-asterisco é conteúdo de tela, não comentário', () => {
    const src = 'const a = <div>mostre 50% /* isto aparece */ ao usuário</div>\n'
    const r = limpo(src, 'x.tsx')
    expect(r, 'texto JSX é o que o dono LÊ na tela').toContain('/* isto aparece */')
  })
})

describe('⭐ posições e tamanho ficam INTACTOS (apaga por espaço, não remove)', () => {
  const src = 'const a = 1 // tchau\n/* bloco\n   de duas linhas */\nconst alvo = 2\n'

  it('o tamanho em chars é o mesmo', () => {
    expect(limpo(src, 'x.ts')).toHaveLength(src.length)
  })

  it('o número de linhas é o mesmo', () => {
    expect(limpo(src, 'x.ts').split('\n')).toHaveLength(src.split('\n').length)
  })

  /** ⛔ se removesse em vez de espaçar, todo guard que mede posição passaria a mentir */
  it('⛔ o índice de um trecho de código NÃO se move', () => {
    expect(limpo(src, 'x.ts').indexOf('const alvo = 2')).toBe(src.indexOf('const alvo = 2'))
  })
})

describe('⛔ FALHA ALTO — vigia lendo lixo é pior que vigia nenhum', () => {
  it('⛔ arquivo que não parseia EXPLODE, com o nome na mensagem', () => {
    expect(() => limpo('const a = (;\n', 'tela-torta.tsx'))
      .toThrow(/tela-torta\.tsx/)
  })

  it('⛔ e a mensagem diz que o problema é PARSE, não resultado vazio', () => {
    expect(() => limpo('function (((\n', 'x.ts')).toThrow(/PARSEAR/)
  })

  it('sem nome de arquivo, ainda explode — e diz que não tinha nome', () => {
    expect(() => limpo('const a = (;\n')).toThrow(/fonte sem nome/)
  })

  /** ⭐ `.ts` com cast de ângulo é válido e NÃO pode explodir (TSX leria como JSX) */
  it('⭐ cast <string>x num .ts parseia (o ScriptKind vem da extensão)', () => {
    const r = limpo('const a = <string>x // tchau\n', 'x.ts')
    expect(r).toContain('<string>x')
    expect(r).not.toContain('tchau')
  })

  /** ⭐ sem nome, o fallback TSX→TS resolve o mesmo caso sem explodir */
  it('⭐ sem nome, o cast de ângulo cai no fallback TS em vez de reprovar', () => {
    expect(() => limpo('const a = <string>x\n')).not.toThrow()
  })
})

/**
 * ⭐⭐⭐ O CONTRAFACTUAL CONTRA O ARQUIVO REAL — a prova do sprint.
 *
 * A régua VELHA (as três substituições por regex) engolia 27.816 chars desta tela. A nova
 * remove só comentários de verdade, e o `data-testid` que caía no ponto cego está visível.
 */
describe('a tela real medida em 04/11', () => {
  const ALVO = 'components/estoque/conferencia-view.tsx'
  const cru = readFileSync(join(process.cwd(), ALVO), 'utf8')

  /** as três substituições da régua velha, reproduzidas para comparar */
  const reguaVelha = (s: string) => s
    .replace(/\{\s*\/\*(?:[^*]|\*(?!\/))*\*\/\s*\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')

  it('⛔ a régua VELHA engolia ~34% do arquivo; a nova apaga MENOS', () => {
    const velho = cru.length - reguaVelha(cru).length
    const novo = [...limpo(cru, ALVO)].filter((c) => c === ' ').length
      - [...cru].filter((c) => c === ' ').length

    expect(velho, 'o engolido da régua velha, medido').toBeGreaterThan(20000)
    expect(novo, 'o apagado de verdade é muito menor que o engolido de antes').toBeLessThan(velho)
  })

  it('⭐ o data-testid que caía no ponto cego está VISÍVEL agora', () => {
    const r = limpo(cru, ALVO)
    expect(reguaVelha(cru), 'na régua velha ele sumia').not.toContain('data-testid="conferencia-cortesia"')
    expect(r, 'com o parser ele aparece').toContain('data-testid="conferencia-cortesia"')
  })

  it('⭐ e o atributo que causava o estrago segue no texto, como dado', () => {
    expect(limpo(cru, ALVO)).toContain('accept="image/')
  })
})

/**
 * ⭐⭐ AS DUAS PORTAS IRMÃS, nascidas dos achados de 05/11.
 *
 * ⛔ **Fragmento:** 25 guards ficaram vermelhos de uma vez porque `usosDe`/`hexCravados`
 * recebem PEDAÇO de código (corpo de função, snippet de atributo) e o `throw` do
 * arquivo-inteiro os matava. ⛔ **CSS:** `o-trilho-nasce-recolhido` passava `globals.css` —
 * com regex funcionava *por acidente*, porque regex não liga pra linguagem.
 */
describe('semComentariosDeFragmento — pedaço de código não é programa', () => {
  it('⛔ fragmento que não parseia volta INTOCADO, sem explodir', () => {
    const frag = `qual="conta" titulo="O mês custa"`
    expect(semComentariosDeFragmento(frag)).toBe(frag)
  })

  it('⛔ snippet de atributo JSX (o caso do zero-hex) volta intocado', () => {
    const frag = `style={{ color: '#fff' }}`
    expect(semComentariosDeFragmento(frag)).toBe(frag)
  })

  it('⭐ mas fragmento que PARSEIA tem o comentário removido de verdade', () => {
    const r = semComentariosDeFragmento('const a = 1 // tchau\n')
    expect(r).not.toContain('tchau')
    expect(r).toContain('const a = 1')
  })

  /** ⛔ a trava do arquivo inteiro NÃO foi enfraquecida: ela segue em `semComentarios` */
  it('⛔ o falhar-alto continua de pé na porta do arquivo inteiro', () => {
    expect(() => semComentarios('qual="conta" titulo="x"', 'tela.tsx')).toThrow(/PARSEAR/)
  })
})

describe('semComentariosDeCss — CSS não é TypeScript', () => {
  it('⭐ apaga comentário de CSS, preservando tamanho e linhas', () => {
    const css = '.a { color: red } /* comentário */\n.b { color: blue }\n'
    const r = semComentariosDeCss(css)
    expect(r).not.toContain('comentário')
    expect(r).toContain('.a { color: red }')
    expect(r).toContain('.b { color: blue }')
    expect(r).toHaveLength(css.length)
    expect(r.split('\n')).toHaveLength(css.split('\n').length)
  })

  /** ⛔ o motivo de existir: um seletor COMENTADO não pode passar por seletor de verdade */
  it('⛔ seletor dentro de comentário não sobrevive', () => {
    expect(semComentariosDeCss('/* .trilho { width: 0 } */\n.outro {}\n'))
      .not.toContain('.trilho {')
  })

  it('⭐ e o globals.css real tem os 143 comentários apagados sem quebrar os seletores', () => {
    const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')
    const r = semComentariosDeCss(css)
    expect(r).toHaveLength(css.length)
    expect(r, 'o bloco que o guard do trilho procura segue lá').toContain('.trilho {')
  })

  /**
   * ⚠️ O LIMITE, DECLARADO: barra-asterisco dentro de string de CSS confundiria o regex.
   * Medido em 05/11: `app/globals.css` tem **zero** `content:` com a sequência — então o
   * limite é teórico aqui. *Rótulo não promete o que não entrega*: se um dia aparecer, este
   * teste é onde a conversa começa.
   */
  it('⚠️ o limite conhecido: a sequência dentro de string de CSS não é tratada', () => {
    const css = app_css_com_string_arriscada()
    expect(semComentariosDeCss(css)).not.toBe(css) // o regex morde — limite declarado
  })
})

function app_css_com_string_arriscada(): string {
  return '.a::before { content: "' + '/' + '*" }\n.b { color: red }\n/* real */\n'
}

/**
 * ⭐⭐ A FIAÇÃO DAS DUAS PORTAS — quem lê PEDAÇO não pode usar a porta do ARQUIVO.
 *
 * ⛔⛔ **Achado na REGRA 11 deste próprio sprint:** repus `semComentarios(src)` dentro de
 * `usosDe` e o museu ficou **VERDE** — porque o museu testa as portas, não os detectores que
 * as consomem. Os 25 guards reais é que morreriam. *Guard que não cobre a fiação deixa a
 * troca de porta passar* — e foi justo essa troca que custou 25 vermelhos hoje.
 */
describe('os detectores internos usam a porta de FRAGMENTO', () => {
  const PORTA = '__tests__/regras-ui/_leitura-de-fonte.ts'
  const fonte = readFileSync(join(process.cwd(), PORTA), 'utf8')

  it('⛔ nenhum detector interno chama a porta do arquivo inteiro', () => {
    // ⚠️ só a declaração de `semComentarios` pode mencionar o nome sem o sufixo
    const chamadas = [...fonte.matchAll(/semComentarios\s*\(/g)].length
    const declaracao = [...fonte.matchAll(/export function semComentarios\s*\(/g)].length
    expect(chamadas - declaracao,
      'detector interno recebe PEDAÇO: tem que usar `semComentariosDeFragmento`').toBe(0)
  })

  it('⭐ e `usosDe` e `hexCravados` chamam a de fragmento, nominalmente', () => {
    for (const fn of ['usosDe', 'hexCravados']) {
      const [bloco] = chamadasDe(fonte, new RegExp(`export function ${fn}\\s*\\(`, 'g'))
      expect(bloco, `não achei ${fn}`).toBeTruthy()
    }
    expect(fonte.match(/semComentariosDeFragmento\(/g)?.length ?? 0,
      'os 4 detectores internos + a declaração').toBeGreaterThanOrEqual(4)
  })
})
