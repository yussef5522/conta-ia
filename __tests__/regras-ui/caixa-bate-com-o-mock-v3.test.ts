// ⭐⭐⭐ A CAIXA BATE COM O MOCK v3 — o guard que LÊ O ARQUIVO (16/09/2026)
//
// **A régua do dono:** *"o mock é a RÉGUA — igual primeiro, melhoria só com meu pedido."*
//
// ⚠️ **POR QUE ELE LÊ O HTML E NÃO UMA LISTA MINHA:** enquanto o mock viveu numa pasta de
// downloads, *"igual ao mock"* era **memória minha** — e memória é exatamente o que falhou
// nas duas voltas da Conciliação em 10/09. Versionado, ele é **dado**: se alguém ajustar
// um tom "no olho", o teste aponta o token e o valor que o arquivo manda.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { V3, MEDIDA, SOMBRA, SOMBRA_UP, CONECTOR } from '@/components/conciliacao/mock-v3-tokens'

const raiz = process.cwd()
const MOCK = readFileSync(join(raiz, 'docs/mocks/conciliacao-caixa-mock-v3.html'), 'utf-8')
/**
 * ⚠️⚠️ A TELA É LIDA **SEM COMENTÁRIO** — e isto nasceu da REGRA 11, hoje: repondo o
 * defeito (apagar "MELHOR PALPITE" do JSX) o guard ficou **VERDE**, porque a frase também
 * aparece no cabeçalho de documentação do arquivo. *Guard que conta a MENÇÃO aprova a
 * tela que não imprime nada* — a mesma lição do `acaoValePraSentido` de 15/09.
 */
const CAIXA = semComentario(readFileSync(join(raiz, 'components/conciliacao/caixa-de-entrada.tsx'), 'utf-8'))

export function semComentario(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

/**
 * ⭐ LÊ A **DECLARAÇÃO** DO TOKEN NO `:root{}`, nunca "a cor aparece em algum lugar".
 *
 * ⚠️⚠️ É a correção que a REGRA 11 impôs em 13/09: o guard do mock de produção conferia
 * que a cor existia **no arquivo** — e trocar o roxo no objeto de tokens passava VERDE,
 * porque o MESMO roxo estava no degradê de outro elemento. O que morde é a declaração.
 */
export function tokenDoMock(css: string, nome: string): string | null {
  const root = css.slice(css.indexOf(':root{'), css.indexOf('}', css.indexOf(':root{')))
  const m = root.match(new RegExp(`--${nome}\\s*:\\s*([^;]+);`))
  return m ? m[1]!.trim() : null
}

describe('⭐ as CORES saem do :root{} do mock, ao caractere', () => {
  const pares: [keyof typeof V3, string][] = [
    ['bg', 'bg'], ['card', 'card'], ['ink', 'ink'], ['sub', 'sub'], ['line', 'line'],
    ['roxo', 'roxo'], ['roxo2', 'roxo2'], ['roxoBg', 'roxo-bg'],
    ['verde', 'verde'], ['verde2', 'verde2'], ['verdeBg', 'verde-bg'],
    ['coral', 'coral'], ['coralBg', 'coral-bg'],
    ['ambar', 'ambar'], ['ambarBg', 'ambar-bg'],
    ['azul', 'azul'], ['azulBg', 'azul-bg'],
  ]
  for (const [nosso, deles] of pares) {
    it(`--${deles} == V3.${nosso}`, () => {
      expect(tokenDoMock(MOCK, deles), `o mock declara --${deles}; o nosso token divergiu`).toBe(V3[nosso])
    })
  }
})

describe('⭐ as SOMBRAS também são do arquivo', () => {
  it('a de repouso e a do hover que levanta', () => {
    expect(tokenDoMock(MOCK, 'sombra')).toBe(SOMBRA)
    expect(tokenDoMock(MOCK, 'sombra-up')).toBe(SOMBRA_UP)
  })
})

describe('⭐ as MEDIDAS batem com as regras do mock', () => {
  const casos: [string, number][] = [
    ['\\.par\\{[^}]*border-radius:(\\d+)px', MEDIDA.raioCartao],
    ['\\.stat\\{[^}]*border-radius:(\\d+)px', MEDIDA.raioStat],
    ['\\.palpite\\{[^}]*border-radius:(\\d+)px', MEDIDA.raioPalpite],
    ['\\.btn-ok\\{[^}]*border-radius:(\\d+)px', MEDIDA.raioBotao],
    ['\\.valor\\{font-size:(\\d+)px', MEDIDA.fonteValor],
    ['\\.stat \\.v\\{font-size:(\\d+)px', MEDIDA.fonteStat],
    ['\\.meio \\.simb\\{width:(\\d+)px', MEDIDA.simbolo],
    ['\\.ring\\{width:(\\d+)px', MEDIDA.anel],
    ['\\.avatar\\{width:(\\d+)px', MEDIDA.avatar],
    ['@media\\(max-width:(\\d+)px\\)\\{\\.par-grid', MEDIDA.breakpointEmpilha],
  ]
  for (const [re, esperado] of casos) {
    it(`${re.slice(0, 22)}… → ${esperado}`, () => {
      const m = MOCK.match(new RegExp(re))
      expect(m, `a regra ${re} sumiu do mock — o guard perdeu o alvo`).toBeTruthy()
      expect(Number(m![1]), 'a medida do nosso token divergiu do arquivo').toBe(esperado)
    })
  }
})

describe('⭐⭐ os TEXTOS que o mock imprime existem na tela', () => {
  /**
   * ⛔ Não é decoração: cada uma destas frases é uma PROMESSA do desenho. *"O BANCO DIZ"*
   * e *"MELHOR PALPITE"* são o que faz o dono não precisar procurar de que lado está.
   */
  const frases = [
    'Caixa de entrada do banco',
    'o banco diz o que aconteceu · você diz o que cada linha é',
    'O BANCO DIZ',
    'MELHOR PALPITE',
    'OU ESCOLHA OUTRO CAMINHO',
  ]
  for (const f of frases) {
    it(`"${f.slice(0, 34)}…" está no mock E na tela`, () => {
      expect(MOCK, 'a frase saiu do mock — reveja o guard').toContain(f)
      expect(CAIXA, `a tela não imprime "${f}"`).toContain(f)
    })
  }

  /**
   * ⭐ O glifo mora no TOKEN e a tela o CONSOME — por isso o guard confere o uso de
   * `{CONECTOR}`, não o caractere solto no JSX. ⚠️ Escrever `≍` direto no componente seria
   * a segunda cópia do valor, e ela divergiria no dia em que o mock trocasse o símbolo.
   */
  it(`⭐ o conector é "${CONECTOR}" no mock — e a tela usa o TOKEN, não uma cópia`, () => {
    expect(MOCK, 'o símbolo saiu do mock').toContain(`>${CONECTOR}<`)
    expect(CAIXA, 'a tela deixou de desenhar o conector').toContain('{CONECTOR}')
    expect(CAIXA, 'alguém escreveu o glifo à mão em vez de usar o token').not.toContain(`>${CONECTOR}<`)
  })
})

/**
 * ⭐⭐⭐ A CATEGORIA NO LADO ESQUERDO (20/09) — o mock foi ATUALIZADO junto com a tela.
 *
 * **A decisão do dono:** *"o lado esquerdo tem menos conteúdo e sobra espaço; assim a
 * categoria não fica espremida na fileira de chips da direita, e o cartão equilibra
 * visualmente."* — e a régua de sempre: ***o mock é o arquivo, divergir dele é defeito***.
 */
describe('⭐⭐ o SELETOR DE CATEGORIA mora na coluna da esquerda', () => {
  it('⛔ o mock desenha o bloco embaixo do VALOR, não entre os chips', () => {
    const esquerda = MOCK.slice(MOCK.indexOf('O BANCO DIZ'), MOCK.indexOf('class="meio"'))
    expect(esquerda, 'o bloco de categoria saiu do lado esquerdo do mock').toContain('class="cat"')
    expect(esquerda.indexOf('class="valor"'), 'a categoria tem que vir DEPOIS do valor')
      .toBeLessThan(esquerda.indexOf('class="cat"'))
    // ⛔ e NÃO pode ter voltado pra fileira de chips da direita
    const direita = MOCK.slice(MOCK.indexOf('class="acoes"'))
    expect(direita.slice(0, 400)).not.toContain('é despesa: categoria</span>\n        <span class="chip">🏷')
  })

  it('⭐ a tela põe o seletor no MESMO lugar — depois do valor, antes do conector', () => {
    const i = CAIXA.indexOf('O BANCO DIZ')
    const esquerda = CAIXA.slice(i, CAIXA.indexOf('O CONECTOR', i))
    expect(esquerda, 'o seletor não está na coluna da esquerda').toContain('CATEGORIA')
    expect(esquerda, 'a régua tem que vir da lib, não de um if na tela').toContain('sel.modo')
  })

  it('⛔⛔ e o gesto ESPERA a categoria — com o aviso que APONTA pro seletor', () => {
    expect(CAIXA).toContain('podeDisparar(')
    expect(CAIXA, 'o aviso sumiu — chip bloqueado sem explicação é botão quebrado')
      .toContain('AVISO_CATEGORIA')
    expect(MOCK, 'o mock perdeu o estilo do aviso').toContain('.aviso-cat{')
  })

  it('⭐ REGRA 12: o cartão empilha pela MESMA medida do mock, e o seletor vai junto', () => {
    // ⚠️ o seletor é o último bloco da coluna esquerda: no celular ele cai entre o valor e
    // o palpite **sem uma segunda composição** — é o empilhamento do grid fazendo o trabalho
    expect(CAIXA).toContain('grid-cols-1 min-[900px]:grid-cols-[1fr_64px_1fr]')
    expect((CAIXA.match(/CATEGORIA\n/g) ?? []).length, 'seletor duplicado por viewport = duas telas')
      .toBeLessThanOrEqual(1)
  })
})

describe('⭐ o INBOX ZERO e a FAIXA DE RESOLVIDA foram copiados', () => {
  it('o 🎉 do mock e a frase dele', () => {
    expect(MOCK).toContain('🎉')
    expect(CAIXA, 'o inbox zero do mock não chegou na tela').toContain('🎉')
    expect(CAIXA).toContain('É assim que a caixa fica quando você termina')
  })

  it('⛔ a faixa verde carrega o SELO do COMO — linha não sai em silêncio', () => {
    expect(MOCK).toContain('resolvida agora')
    expect(CAIXA).toContain('resolvida agora')
  })
})

// ⭐⭐ REGRA 11 — o detector tem que pegar o desvio que motivou o guard.
describe('o detector morde (auto-teste)', () => {
  const FAKE = ':root{ --roxo:#534AB7; --verde:#0f9d58; }'

  it('lê a declaração certa', () => {
    expect(tokenDoMock(FAKE, 'roxo')).toBe('#534AB7')
  })

  it('⭐ acusa o tom trocado', () => {
    expect(tokenDoMock(':root{ --roxo:#000000; }', 'roxo')).not.toBe(V3.roxo)
  })

  /**
   * ⚠️ O CASO QUE REPROVOU O GUARD IRMÃO EM 13/09: a cor aparece no arquivo (num degradê)
   * mas NÃO está declarada como token. O detector tem que devolver `null`.
   */
  it('⭐ NÃO se contenta com a cor aparecendo fora do :root', () => {
    const so_no_gradiente = ':root{ --card:#fff; }\n.barra{background:linear-gradient(#534AB7,#fff)}'
    expect(tokenDoMock(so_no_gradiente, 'roxo')).toBeNull()
  })
})
