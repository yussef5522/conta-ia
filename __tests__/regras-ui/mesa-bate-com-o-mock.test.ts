/**
 * ⛔⛔⛔ A MESA BATE COM O MOCK v2 — e o mock é o arquivo, não a minha memória (29/09/2026)
 *
 * **A ordem do dono:** *"o mock versionado (real-vs-teorico-mock) atualizado pra ESTA
 * versão, que vira a referência"* + *"guard visual: linha de item sem divisória inteira ou
 * seção sem faixa colorida = vermelho"*.
 *
 * ⚠️ **ESTE TESTE LÊ O HTML** (`docs/mocks/real-vs-teorico-mock.html`) e compara com os
 * tokens e a tela. É a disciplina de 10/09: enquanto o desenho vive em palavras,
 * *"igual ao mock"* é memória — e memória foi o que falhou nas duas voltas da Conciliação.
 * Tom ajustado "no olho" fica vermelho **apontando o valor que o arquivo manda**.
 *
 * ⛔ E ele lê os arquivos **sem comentário**: *o arquivo que documenta o defeito não pode
 * ser o que o absolve* (a lição do "menção, não uso", que já custou 7 guards nesta casa).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const raiz = process.cwd()
const ler = (p: string) => readFileSync(join(raiz, p), 'utf-8')
const semComentario = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const MOCK = ler('docs/mocks/real-vs-teorico-mock.html')
const TOKENS = ler('components/estoque/radar-tokens.ts')
const TELA = semComentario(ler('app/(dashboard)/empresas/[id]/estoque/real-vs-teorico/page.tsx'))

/** lê uma variável do `:root{}` do mock — a régua sai do ARQUIVO, nunca daqui */
function doMock(nome: string): string {
  const m = new RegExp(`--${nome}\\s*:\\s*([^;]+);`).exec(MOCK)
  if (!m) throw new Error(`o mock não declara --${nome} — a régua sumiu do arquivo`)
  return m[1]!.trim()
}

describe('⭐⭐ os TOKENS da mesa saem do mock, ao caractere', () => {
  it('⛔ a divisória e o zebrado do mock são os do código', () => {
    expect(TOKENS).toContain(`divisoria: '${doMock('divisoria')}'`)
    expect(TOKENS).toContain(`zebra: '${doMock('zebra')}'`)
  })

  it('⛔ e a divisória é MAIS ESCURA que a `line` de antes — senão ela não se vê', () => {
    /**
     * ⚠️ Com a `--line` (#eae9f2) a separação existia no CSS e **não aparecia**, que é o
     * mesmo que não existir. O teste compara a luminosidade das duas.
     */
    const luz = (hex: string) => {
      const h = hex.replace('#', '')
      return parseInt(h.slice(0, 2), 16) + parseInt(h.slice(2, 4), 16) + parseInt(h.slice(4, 6), 16)
    }
    expect(luz(doMock('divisoria'))).toBeLessThan(luz(doMock('line')))
  })

  it('⭐ as medidas da v2 (respiro, pílula, tipografia) batem com o mock', () => {
    expect(TOKENS).toContain(`linhaPy: '${doMock('linha-py')}'`)
    expect(TOKENS).toContain(`pilulaPy: '${doMock('pilula-py')}'`)
    expect(TOKENS).toContain(`pilulaPx: '${doMock('pilula-px')}'`)
    expect(TOKENS).toContain(`pilulaFs: '${doMock('pilula-fs')}'`)
    expect(TOKENS).toContain(`itemFs: '${doMock('item-fs')}'`)
    expect(TOKENS).toContain(`pesoForte: ${doMock('item-peso')}`)
    expect(TOKENS).toContain(`pesoContexto: ${doMock('contexto-peso')}`)
  })

  it('⭐⭐ as três famílias têm cores DISTINTAS, e são as do mock', () => {
    expect(TOKENS).toContain(`ambarBg: '${doMock('ambar-bg')}'`)
    expect(TOKENS).toContain(`azulBg: '${doMock('azul-bg')}'`)
    expect(TOKENS).toContain(`tealBg: '${doMock('teal-bg')}'`)
    // ⛔ duas famílias com o mesmo fundo é o mesmo que seção sem cor própria
    const fundos = [doMock('ambar-bg'), doMock('azul-bg'), doMock('teal-bg')]
    expect(new Set(fundos).size, 'duas seções ficaram com o mesmo fundo').toBe(3)
  })
})

describe('⛔⛔⛔ o guard visual do dono: divisória e faixa colorida', () => {
  it('⛔⛔ LINHA DE ITEM SEM DIVISÓRIA INTEIRA = VERMELHO', () => {
    // a linha da mesa (desktop) e o card (celular) têm borda em CIMA e EMBAIXO
    const bordas = TELA.match(/borderTop: `1px solid \$\{MESA\.divisoria\}`/g) ?? []
    const bordasB = TELA.match(/borderBottom: `1px solid \$\{MESA\.divisoria\}`/g) ?? []
    expect(bordas.length, 'a divisória de cima sumiu de um dos viewports').toBeGreaterThanOrEqual(2)
    expect(bordasB.length, 'a divisória de baixo sumiu de um dos viewports').toBeGreaterThanOrEqual(2)
    // ⛔ e a `divide-y` antiga (que só separa por dentro, com a linha clara) não volta
    expect(TELA, 'voltou o `divide-y` no lugar da faixa por produto').not.toMatch(/divide-y[^"]*"\s*style=\{\{\s*borderColor: RADAR\.line/)
  })

  it('⛔⛔ ZEBRADO nos dois viewports — cada produto numa faixa própria', () => {
    const zebras = TELA.match(/i % 2 === 0 \? MESA\.zebra/g) ?? []
    expect(zebras.length, 'o zebrado só existe num dos viewports').toBeGreaterThanOrEqual(2)
  })

  it('⛔⛔ SEÇÃO SEM FAIXA COLORIDA = VERMELHO (e o subtotal repete o fundo dela)', () => {
    // ⚠️ REAPONTADO (22/10), não afrouxado: a cor da família deixou de ser um MAPA indexado
    // pelos 3 nomes cravados e passou a ser `familiaDoGrupo(slug)` — o dono do grupo agora é
    // DADO do dono (RT2), e um `Record<'caros'|'porcoes'|'revenda'>` não tem como responder por
    // um grupo que ele acabou de criar. ⛔ A PERGUNTA NÃO MUDOU: *a faixa e o subtotal leem o
    // MESMO dono?* — se pegassem a cor em lugares diferentes, divergiriam no 1º ajuste de tom e
    // a seção deixaria de se ler como um bloco só. Guard que casasse o literal antigo ficaria
    // vermelho com a TELA CERTA (grep não distingue "refatorei" de "quebrei" — a razão de
    // existir da REGRA 3).
    expect(TELA).toContain('const fam = familiaDoGrupo(s.chave)')
    // ⛔ e o mapa indexado pelo nome não volta — ele é o que impede grupo novo de ter cor
    expect(TELA, 'voltou o mapa cravado pelos 3 nomes').not.toMatch(/FAMILIA\[s\.chave\]/)
    // a faixa do cabeçalho usa a cor da família
    expect(TELA).toMatch(/background: fam\.bg, color: fam\.cor/)
    // ⭐ e o SUBTOTAL usa a MESMA — se pegasse outra, a seção deixaria de ser um bloco só
    const usos = TELA.match(/background: fam\.bg, color: fam\.cor/g) ?? []
    expect(usos.length, 'a faixa e o subtotal não estão na mesma cor de família').toBeGreaterThanOrEqual(2)
    // ⛔ e o cinza de antes não volta no lugar da cor
    expect(TELA, 'o cabeçalho da seção voltou pro cinza').not.toMatch(/py-2\.5" style=\{\{ background: RADAR\.bg \}\}/)
  })

  it('⭐ a HIERARQUIA existe: teórico/real em peso forte, contexto em normal', () => {
    expect(TELA).toContain('fontWeight: forte ? MESA.pesoForte : MESA.pesoContexto')
    // o nome do item ancora a linha
    expect(TELA).toMatch(/fontSize: MESA\.itemFs, fontWeight: MESA\.pesoForte/)
    // e as colunas de contexto NÃO pedem `forte`
    expect(TELA).toMatch(/<Qtd v=\{l\.entrou\} un=\{l\.unidade\} \/>/)
    expect(TELA).toMatch(/<Qtd v=\{l\.teorico\} un=\{l\.unidade\} forte \/>/)
  })

  it('⭐ a pílula cresceu, e o tamanho vem do token (não digitado na tela)', () => {
    expect(TELA).toContain('${MESA.pilulaPy} ${MESA.pilulaPx}')
    expect(TELA).toContain('fontSize: MESA.pilulaFs')
  })
})

describe('⛔ o detector PEGA a versão antiga (auto-teste — senão passa por cegueira)', () => {
  it('⚠️ a forma que ele proíbe é a que a tela tinha antes da v2', () => {
    const antiga = `<tbody className="divide-y" style={{ borderColor: RADAR.line }}>`
    expect(antiga).toMatch(/divide-y[^"]*"\s*style=\{\{\s*borderColor: RADAR\.line/)
    const nova = `<tbody>`
    expect(nova).not.toMatch(/divide-y/)

    const faixaCinza = `<div className="flex items-center gap-2 px-4 py-2.5" style={{ background: RADAR.bg }}>`
    expect(faixaCinza).toMatch(/py-2\.5" style=\{\{ background: RADAR\.bg \}\}/)
  })
})

describe('⭐ o mock é a régua, e ele fala dos DOIS viewports', () => {
  it('⛔ o arquivo do mock existe e declara as três famílias', () => {
    expect(MOCK).toContain('data-familia="caros"')
    expect(MOCK).toContain('data-familia="porcoes"')
    expect(MOCK).toContain('data-familia="revenda"')
  })

  it('⭐ e o celular do mock tem a MESMA faixa por produto (divisória + zebrado)', () => {
    const celular = MOCK.slice(MOCK.indexOf('@container (max-width:640px)'))
    expect(celular).toContain('var(--divisoria)')
    expect(celular).toContain('var(--zebra)')
  })

  it('⚠️ e ele avisa que os números são reais, pra ninguém os citar como medição nova', () => {
    expect(MOCK).toContain('read-only')
    expect(MOCK).toContain('3.790,41')
  })
})
