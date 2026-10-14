/**
 * ⭐⭐⭐ A CESTA NO CARTÃO DE PRODUTO — os vermelhos de TELA que o dono ditou (14/10/2026).
 *
 * *"CICATRIZ DO CAMPO: apagar e o valor voltar sozinho = vermelho — nos DOIS cartões"* ·
 * *"toque liga/desliga; qtd mínima 1"* · *"PIZZA SEPARADA: este cartão NÃO monta pizza por
 * sabor"* · *"'vendendo o combo a' nasce VAZIO"* · *"cesta/alvo/preço não persistem NADA"* ·
 * *"montador de pizza intocado"* · *"a conta mora na lib, a tela ecoa"*.
 *
 * ⚠️ **ESTRUTURAL E ASSUMIDO COMO TAL:** o projeto roda em `environment: node`, sem jsdom —
 * não dá pra clicar. O que é COMPORTAMENTO (a régua do campo, a soma da cesta, o teto
 * ponderado, a NA MESA) está travado nas libs, EXECUTADO: `lib/margem/__tests__/`
 * `campo-de-preco`, `cesta-do-veredito` e `na-mesa`. Aqui se trava o que SÓ a tela pode
 * errar — e o que ela está proibida de reescrever.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { semComentarios, usosDe } from './_leitura-de-fonte'

const TELA = semComentarios(
  readFileSync(resolve(process.cwd(), 'app/(dashboard)/empresas/[id]/margem/page.tsx'), 'utf8'),
)

/**
 * ⭐ fatia o bloco de UM componente — a asserção morde onde a régua vive. ⛔ Janela de
 * distância já produziu falso vermelho E falso verde nesta casa; o que delimita é a `function`
 * SEGUINTE.
 */
function blocoDa(nome: string): string {
  const i = TELA.indexOf(`function ${nome}(`)
  expect(i, `componente ${nome} não existe na tela`).toBeGreaterThan(-1)
  const resto = TELA.slice(i + 1)
  const j = resto.indexOf('\nfunction ')
  return j === -1 ? resto : resto.slice(0, j)
}

const CARTAO = () => blocoDa('EscolhaUmProduto')
const CAMPO = () => blocoDa('CampoDePreco')
const MONTADOR = () => blocoDa('MontadorDePizza')

describe('⛔⛔⛔ A CICATRIZ DO CAMPO — nos DOIS cartões', () => {
  it('⛔⛔ a régua do campo é a LIB — a tela não decide o texto que o input mostra', () => {
    const c = CAMPO()
    expect(usosDe(c, 'textoDoCampo'), 'o que o input MOSTRA vem da lib').toBeGreaterThan(0)
    expect(usosDe(c, 'digitar'), 'o que o onChange GRAVA vem da lib').toBeGreaterThan(0)
    /**
     * ⛔ O DEFEITO EXATO DE `page.tsx:968`, proibido por forma: qualquer fallback de média
     * dentro do `value` repõe o número no teclado do dono.
     */
    expect(c, 'nenhum fallback de média no value').not.toMatch(/value=\{[^}]*\?\s*[^}]*:/)
    expect(c, 'e nenhuma formatação por cima do texto dele').not.toMatch(/value=\{[^}]*toFixed/)
  })

  it('⛔ o "↺ voltar pra média" é o caminho EXPLÍCITO — e quem decide se ele aparece é a lib', () => {
    const c = CAMPO()
    expect(usosDe(c, 'mostrarVoltarParaMedia'), 'régua própria aqui divergiria da lib').toBeGreaterThan(0)
    expect(c).toContain('voltar pra média')
    expect(c, 'e ele devolve o campo ao estado INTOCADO, não à string da média').toContain('CAMPO_INTOCADO')
  })

  it('⛔⛔ UM PEDAÇO SÓ: o montador e o cartão de produto usam o MESMO campo', () => {
    expect(usosDe(TELA, 'CampoDePreco'), 'dois componentes divergiriam na 1ª régua nova').toBeGreaterThan(2)
    const m = MONTADOR()
    expect(m, 'o montador passa pela lib do campo').toContain('<CampoDePreco')
    expect(m, 'e nenhum input de preço próprio').not.toMatch(/<input[^>]*inputMode="decimal"/)
  })

  it('⛔ a régua de QUANTIDADE do estoque está PROIBIDA nesta tela', () => {
    expect(TELA, 'em KG o ponto é decimal: 1.500 virava 1,5').not.toMatch(/sanitizarQtd|valorQtd/)
  })

  it('⚠️ no montador a média é NULL — pizza montada não tem média no PDV', () => {
    expect(MONTADOR(), 'com média, o campo da pizza nasceria preenchido com um número que não existe')
      .toContain('media={null}')
  })
})

describe('⭐ A CESTA NA TELA', () => {
  it('⭐ o toque LIGA/DESLIGA pelo gesto da lib, e o chip diz que está dentro', () => {
    const c = CARTAO()
    expect(usosDe(c, 'alternarNaCesta'), 'o toggle é da lib').toBeGreaterThan(0)
    expect(usosDe(c, 'estaNaCesta'), 'e quem está dentro também').toBeGreaterThan(0)
    expect(c, 'o ✓ no chip').toContain("dentro ? '✓ ' : ''")
    expect(c, 'e o estado pra quem usa leitor de tela').toContain('aria-pressed={dentro}')
  })

  it('⛔ o −/+ passa pela lib (mínimo 1) — a tela não faz aritmética de quantidade', () => {
    const c = CARTAO()
    expect(usosDe(c, 'mudarQtd')).toBeGreaterThan(1)
    expect(c, 'um Math.max na tela seria a 2ª régua do mínimo').not.toMatch(/Math\.max\(\s*1\s*,/)
  })

  it('⛔⛔ A SOMA MORA NA LIB — a tela não soma custo, nem avulsos, nem vantagem', () => {
    const c = CARTAO()
    expect(usosDe(c, 'vereditoDaCesta'), 'o motor único da cesta').toBeGreaterThan(0)
    expect(c, '⛔ nenhum reduce de dinheiro no cartão').not.toMatch(/\.reduce\(/)
    expect(c, '⛔ e nenhuma conta de vantagem (avulsos − preço) na tela').not.toMatch(
      /avulsos\s*[-−]\s*preco|preco\s*\/\s*avulsos/,
    )
  })

  it('⭐ o combo desenha a cesta linha a linha, com o custo da ficha × qtd', () => {
    const c = CARTAO()
    expect(c).toContain('custo do combo')
    expect(c).toContain('os mesmos, avulsos, custam pro cliente')
    expect(c, 'o teto ponderado aparece em linha pequena').toContain('teto do combo')
    expect(c, 'e o toque abre a ficha do item').toContain('l.href')
  })

  it('⛔ "vendendo o combo a" NASCE VAZIO — combo não tem média no PDV', () => {
    const c = CARTAO()
    const i = c.indexOf('vendendo o combo a')
    expect(i, 'a linha do preço do combo').toBeGreaterThan(-1)
    const bloco = c.slice(i, i + 600)
    expect(bloco, 'média nula = campo vazio e nenhum "voltar pra média"').toContain('media={null}')
  })

  it('⛔⛔ "combo SEM vantagem" é CORAL, não cinza — linha morta no cardápio tem que doer', () => {
    const c = CARTAO()
    const i = c.indexOf('vCesta.vantagem.frase')
    expect(i).toBeGreaterThan(-1)
    const bloco = c.slice(i, i + 700)
    expect(bloco).toContain('--fam-coral-bg')
    expect(bloco, 'e o tom vem da LIB, não de um if na tela').toContain("vCesta.vantagem.tom === 'verde'")
  })

  it('⛔ cesta VAZIA é estado legítimo e DIZ o que fazer — nunca fica muda', () => {
    const c = CARTAO()
    expect(c).toContain('naCesta.length === 0')
    expect(c).toContain('pra montar um combo')
  })
})

describe('⭐⭐ 1 ITEM = O CARTÃO DE HOJE', () => {
  it('⛔⛔ no modo de UM produto a chamada é a de HOJE — não passa pela cesta', () => {
    const c = CARTAO()
    expect(usosDe(c, 'montarBlocoDoVeredito'), 'a porta única do veredito').toBeGreaterThan(0)
    expect(c, "e com tipo 'produto', como sempre").toContain("tipo: 'produto'")
    /** ⭐ a cesta só entra com 2+ — é o que faz "exatamente como hoje" ser literal */
    expect(c).toContain('naCesta.length >= 2')
  })

  it('⭐ as 3 sobras, a média do PDV e o farol continuam no cartão', () => {
    const c = CARTAO()
    expect(c).toContain('vendendo hoje a')
    expect(c).toContain('média real do PDV')
    expect(c, 'as sobras por canal').toContain('blocoDoProduto?.canais.map')
    expect(usosDe(c, 'PilulaDoFarol')).toBeGreaterThan(1)
  })
})

describe('⛔⛔ PIZZA SEPARADA — este cartão não monta por sabor', () => {
  it('⭐ produto-pizza ganha a linha discreta que LEVA ao montador', () => {
    const c = CARTAO()
    expect(c, 'a régua é a SEÇÃO do cardápio, o vocabulário que a casa já tem').toContain(
      "umSo.secao === 'PIZZAS'",
    )
    expect(c).toContain('no montador ao lado')
    expect(c, '⛔ "no montador ao lado" sem o caminho é ordem, não caminho').toContain('href="#montador"')
    expect(TELA, 'e a âncora EXISTE do outro lado').toContain('<Cartao id="montador">')
  })

  it('⛔ o cartão de produto não conhece sabor nem fatia', () => {
    const c = CARTAO()
    expect(c, 'montar pizza aqui seria a 2ª bancada').not.toMatch(
      /montarPizza|setFatiaAberta|saboresFiltrados/,
    )
  })

  it('⛔⛔ O MONTADOR FICA INTOCADO — o motor dele é o mesmo', () => {
    const m = MONTADOR()
    expect(usosDe(m, 'montarPizza'), 'a lib pura da pizza').toBeGreaterThan(0)
    expect(m, 'a fatia clicável').toContain('setFatiaAberta')
    expect(m, 'as sobras por canal').toContain('pizza.canais.map')
    expect(m, 'a busca de sabor pela casaBusca').toContain('casaBusca')
    expect(m, '⛔ e a cesta não entrou na bancada').not.toMatch(/vereditoDaCesta|alternarNaCesta/)
  })
})

describe('⛔⛔ ZERO ESCRITA — cesta, alvo e preço são SIMULAÇÃO', () => {
  it('o cartão de produto não grava nada', () => {
    const c = CARTAO()
    expect(c, 'o único POST da tela é a config, e ele mora no montador').not.toMatch(
      /method:\s*'POST'|fetchComTimeout/,
    )
  })

  it('⛔ e nenhuma das libs novas conhece banco', async () => {
    const fs = await import('node:fs')
    for (const f of ['cesta-do-veredito', 'campo-de-preco', 'na-mesa']) {
      const src = semComentarios(fs.readFileSync(`lib/margem/${f}.ts`, 'utf8'))
      expect(src, `${f} é PURA`).not.toMatch(/@\/lib\/db|prisma/i)
      expect(src, `${f} não escreve`).not.toMatch(/\.(create|update|upsert|delete)\w*\(/)
    }
  })
})

describe('⭐⭐ NA MESA + A FATIA DOS FIXOS', () => {
  it('⭐ a NA MESA vem da lib e usa o preço REAL, nunca o simulado', () => {
    const c = CARTAO()
    expect(usosDe(c, 'naMesa')).toBeGreaterThan(0)
    const i = c.indexOf('naMesa({')
    expect(i).toBeGreaterThan(-1)
    const chamada = c.slice(i, i + 300)
    expect(chamada, 'o preço de HOJE é a média do PDV').toContain('preco: umSo.preco')
    expect(chamada, '⛔ nunca o digitado: a pergunta é retrospectiva').not.toMatch(/preco:\s*preco\b/)
    expect(chamada, 'e as unidades do período').toContain('unidades: umSo.unidades')
  })

  it('⛔⛔ e NADA no cartão sugere BAIXAR preço', () => {
    const c = CARTAO()
    expect(c).toContain('🍽️ NA MESA')
    expect(c, 'o conselho de freio chega pronto da lib').toContain('mesa.conselho')
    expect(c, 'nenhum verbo de baixar').not.toMatch(/baixar o preço|reduza|diminua/i)
    expect(c, '⛔ e nenhum Math.abs escondendo o sinal').not.toMatch(/Math\.abs/)
  })

  it('⭐ a fatia dos fixos sai das DUAS portas que as telas já usam', () => {
    const c = CARTAO()
    expect(usosDe(c, 'fatiaDosFixos')).toBeGreaterThan(0)
    expect(c, 'o custo fixo pela porta do PLACAR').toContain('d.casa.custoFixo')
    expect(c, 'as unidades pela porta da LIGA — e as TOTAIS, não só as da obra').toContain(
      'd.sobras.cobertura.unidadesDentro + d.sobras.cobertura.unidadesFora',
    )
  })
})
