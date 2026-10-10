/**
 * ⛔⛔⛔ GUARD — O CARTÃO É FORTE E A TELA É MAGRA (10/10/2026).
 *
 * **Os três vermelhos que o dono pediu, ao pé da letra:**
 *   · *"parágrafo de volta no cartão = vermelho"*
 *   · *"centavos no número do cartão = vermelho"*
 *   · *"fundo sólido trocado por pastel = vermelho"*
 *
 * ⛔ Parte dele é ESTRUTURAL e isso está assumido: o projeto roda em `environment: node`, sem
 * jsdom — não dá pra renderizar nem clicar. O que é COMPORTAMENTO (o número redondo, a sub de
 * ≤5 palavras, a linha miúda, o ⓘ) é EXECUTADO em `lib/custos-fixos/__tests__/cartao-de-dono.test.ts`.
 *
 * ⚠️ E ele lê a tela SEM COMENTÁRIO: este arquivo e a própria tela DOCUMENTAM as frases que
 * morreram, e *"o arquivo que documenta o defeito não pode ser o que o absolve"* (a cicatriz
 * da 11ª "menção, não uso").
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { semComentarios, usosDe } from './_leitura-de-fonte'

const R = (p: string) => join(process.cwd(), p)
const ler = (p: string) => readFileSync(p, 'utf8')
const TELA = semComentarios(ler(R('app/(dashboard)/empresas/[id]/custos-fixos/page.tsx')))
const CSS = ler(R('app/globals.css'))

/** ⭐ o corpo do componente do cartão — o recorte que as asserções de chão/tinta olham */
function corpoDoCartao(): string {
  const i = TELA.indexOf('function CartaoDeDono')
  expect(i, 'o componente do cartão existe').toBeGreaterThan(-1)
  return TELA.slice(i, TELA.indexOf('\n}\n', i))
}

describe('⛔⛔ 1. O CHÃO É SÓLIDO — pastel no cartão é vermelho', () => {
  it('⭐ o par `solid`/`on`/`on-soft` existe pras 4 famílias, nos DOIS temas', () => {
    for (const f of ['indigo', 'azul', 'verde', 'coral']) {
      for (const d of ['solid', 'on', 'on-soft']) {
        const n = (CSS.match(new RegExp(`--fam-${f}-${d}:`, 'g')) ?? []).length
        expect(n, `--fam-${f}-${d} precisa existir no :root E no .dark`).toBe(2)
      }
    }
  })

  /**
   * ⛔⛔ O VERMELHO DO DONO: *"fundo sólido trocado por pastel = vermelho"*.
   * ⚠️ E o `-mid` também é proibido como chão, por MEDIÇÃO: branco sobre ele reprova WCAG em
   * 6 dos 8 casos (verde 3,51:1 e coral 3,91:1 no CLARO; os 4 abaixo de 3,3:1 no escuro).
   */
  it('⛔ o cartão não pinta o chão com `-bg` (pastel) nem com `-mid`', () => {
    const corpo = corpoDoCartao()
    expect(corpo, 'o chão é o degrau sólido').toContain('-solid)')
    expect(corpo, 'pastel no chão do cartão forte').not.toContain('-bg)')
    expect(corpo, 'o -mid cru não passa em contraste com branco').not.toContain('-mid)')
  })

  it('⛔ zero hex no cartão — a cor vem do token ou não vem', () => {
    expect(corpoDoCartao()).not.toMatch(/#[0-9a-fA-F]{3,8}/)
  })

  /** ⚠️ o `escuro` morreu: os quatro são sólidos, e um pastel ao lado de um escuro fazia o herói competir */
  it('⛔ não existe mais cartão "escuro" — os quatro são iguais em peso', () => {
    expect(TELA).not.toContain('escuro?: boolean')
    expect(TELA).not.toContain('escuro\n')
  })
})

describe('⛔⛔ 2. O NÚMERO É REDONDO — centavos no cartão é vermelho', () => {
  /**
   * ⛔ O VERMELHO DO DONO: *"centavos no número do cartão = vermelho"*.
   * ⚠️ A asserção é pelo USO da régua, não pela ausência da palavra: o cartão TEM que chamar
   * `valorDoCartao` (que arredonda e guarda o cheio) e NÃO pode formatar o número na mão —
   * `formatBRL` ali imprimiria os centavos de volta.
   */
  it('⛔ o cartão usa `valorDoCartao`, nunca `formatBRL` no número', () => {
    const corpo = corpoDoCartao()
    expect(usosDe(corpo, 'valorDoCartao'), 'a régua do número redondo').toBeGreaterThan(0)
    expect(corpo, 'formatBRL no cartão traria os centavos de volta').not.toContain('formatBRL(')
  })

  it('⭐ o centavo vai pro tooltip do número — guardado, não jogado fora', () => {
    expect(corpoDoCartao()).toContain('v.cheio')
  })

  it('⭐ o número é 30px/700 tabular, como o dono pediu', () => {
    const corpo = corpoDoCartao()
    expect(corpo).toContain('text-[30px]')
    expect(corpo).toContain('font-bold')
    expect(corpo).toContain('tabular-nums')
  })
})

describe('⛔⛔ 3. O CARTÃO TEM 3 LINHAS — parágrafo de volta é vermelho', () => {
  /**
   * ⛔⛔ O VERMELHO DO DONO: *"parágrafo de volta no cartão = vermelho"*.
   * ⚠️ O detector é ESTRUTURAL (conta os `<p>` do componente), não uma lista de frases: lista
   * de frases proibidas envelhece no dia em que alguém escrever um parágrafo NOVO.
   */
  it('⛔ o componente do cartão desenha no máximo 3 parágrafos', () => {
    const corpo = corpoDoCartao()
    const ps = (corpo.match(/<p\b/g) ?? []).length
    expect(ps, `o cartão tem ${ps} <p> — são 3 papéis: etiqueta · número · sub`).toBeLessThanOrEqual(3)
  })

  it('⛔ nem `sub` nem `detalhe` voltam como prop do cartão', () => {
    const corpo = corpoDoCartao()
    expect(corpo, 'a sub vem do mapa da lib, não da tela').not.toContain('sub:')
    expect(corpo, 'o detalhe era o parágrafo — ele morreu').not.toContain('detalhe')
  })

  it('⭐ a sub sai do dono único (o mapa), nunca escrita no JSX', () => {
    expect(usosDe(corpoDoCartao(), 'SUB_DO_CARTAO')).toBeGreaterThan(0)
  })

  /** ⚠️ as frases longas que o dono mandou matar, uma por uma */
  it('⛔ as 4 sublinhas antigas dos cartões não existem mais', () => {
    for (const morta of [
      'o plano que você declarou',
      'quanto isso come por dia, parado',
      'vendendo isso por dia, isso se paga',
      'cobre casa, banco e dívida; acima disso começa a sobrar de verdade',
      'o planejado é seu; o realizado é o que o fluxo pagou',
    ]) {
      expect(TELA, `a frase morta voltou: "${morta}"`).not.toContain(morta)
    }
  })

  /**
   * ⭐⭐ E A HONESTIDADE NÃO FOI JOGADA FORA — ela desceu pra UMA linha com ⓘ.
   * ⛔ Guard de dois lados: se eu só proibisse os parágrafos, aprovaria o dia em que a
   * ressalva do CMV sumisse da tela inteira.
   */
  it('⭐⭐ a linha miúda existe e o ⓘ carrega as explicações', () => {
    expect(usosDe(TELA, 'LinhaDeHonestidade'), 'o componente e o uso').toBeGreaterThan(1)
    expect(usosDe(TELA, 'linhaDeHonestidade'), 'a régua pura').toBeGreaterThan(0)
    expect(usosDe(TELA, 'explicacoesDoPopover'), 'o conteúdo do ⓘ').toBeGreaterThan(0)
    expect(TELA, 'o rótulo do ⓘ').toContain('como eu conto')
  })

  /**
   * ⛔⛔ O ⓘ É `<details>`, NUNCA `title` — **tooltip não existe no celular**, e é lá que o
   * dono opera (a cicatriz de 30/08). O que pode ir pro `title` nesta tela é só o que REPETE
   * um número já visível (os centavos do cartão) ou EXPLICA um rótulo; a régua completa fica
   * a um TOQUE.
   */
  it('⛔ o ⓘ abre por toque (`<details>`), não por hover', () => {
    const i = TELA.indexOf('function LinhaDeHonestidade')
    const corpo = TELA.slice(i, TELA.indexOf('\n}\n', i))
    expect(corpo).toContain('<details')
    expect(corpo).toContain('<summary')
  })
})

describe('⭐⭐ 4. O CHIP "N SEM PLANO →" — e ele FILTRA de verdade', () => {
  it('⭐ está no 1º cartão, como botão (teclado e leitor de tela)', () => {
    expect(TELA).toContain('sem plano')
    const i = TELA.indexOf('sem plano')
    const volta = TELA.slice(Math.max(0, i - 900), i)
    expect(volta, 'chip clicável que não é <button> perde teclado').toContain('<button')
    expect(volta, 'o chip mora no cartão do "O mês custa"').toContain('qual="conta"')
  })

  it('⭐ o clique LIGA o filtro e ROLA até a lista — os dois', () => {
    const i = TELA.indexOf('const irPraSemPlano')
    expect(i, 'o gesto existe').toBeGreaterThan(-1)
    const corpo = TELA.slice(i, i + 420)
    expect(corpo, 'filtra').toContain('setSoSemPlano(true)')
    expect(corpo, 'e rola').toContain('scrollIntoView')
  })

  it('⛔ o filtro nasce DESLIGADO — ligado por default esconderia linha sem ninguém pedir', () => {
    expect(TELA).toContain('const [soSemPlano, setSoSemPlano] = useState(false)')
  })

  /**
   * ⛔⛔ A régua de 23/09 (*"ausência de resultado NESTE recorte não é ausência de trabalho"*):
   * com o filtro ligado e zero linha sem plano, a tela não pode dizer nada que soe como
   * "tudo resolvido" — ela DIZ o recorte e oferece o "ver tudo".
   */
  it('⭐⭐ a tela DIZ que recortou e oferece voltar', () => {
    expect(TELA).toContain('ver tudo')
    expect(TELA).toContain('só as ${daFila.length} sem plano')
    expect(TELA).toContain('nenhuma linha sem plano aqui')
  })

  /**
   * ⛔⛔ E O Σ DO RODAPÉ É DA PRATELEIRA INTEIRA, nunca do recorte — um subtotal que mudasse
   * com o filtro deixaria de fechar com o cartão, que é o guard que o dono pediu pra manter.
   */
  /**
   * ⚠️⚠️ A 1ª VERSÃO DESTE TESTE DEU FALSO VERMELHO — eu fatiei ±700 caracteres em volta do
   * "Σ planejado" e a janela alcançou o botão *"ver todas"*, que usa `daFila` CORRETAMENTE
   * (o botão conta o recorte; o Σ não). **Janela de distância já produziu falso vermelho E
   * falso verde nesta casa 7 vezes** — o que morde é fatiar o BLOCO do rodapé, por estrutura.
   */
  it('⛔ o filtro não toca no subtotal', () => {
    const i = TELA.indexOf('border-t px-4 py-3')
    expect(i, 'o rodapé da prateleira existe').toBeGreaterThan(-1)
    const rodape = TELA.slice(i, TELA.indexOf('</div>', TELA.indexOf('% pago', i)))
    expect(rodape).toContain('Σ planejado')
    expect(rodape).toContain('prateleira.planejado')
    expect(rodape, 'o Σ não pode sair do recorte').not.toContain('daFila')
  })

  it('⭐ o Σ dos rodapés vai em 700, como o dono pediu', () => {
    const i = TELA.indexOf('Σ planejado')
    expect(TELA.slice(Math.max(0, i - 300), i)).toContain('font-bold')
  })
})
