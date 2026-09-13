// ⛔⛔⛔ A TELA SE PROVA NOS DOIS VIEWPORTS — REGRA DA CASA (13/09/2026)
//
// **O dono, vendo o dashboard PF num MacBook:** *"o mock era MOBILE e o desktop ficou uma
// coluna de 480px boiando no meio do monitor. Sistema que quer competir com Monarch/Mobills
// tem DOIS desenhos: app no celular, COCKPIT no desktop. Mesmos widgets, mesma fonte de
// dados, DUAS composições."*
//
// ⭐⭐ **A REGRA QUE NASCE AQUI, e vale pra TODA tela nova:** *mock mobile sem composição
// desktop definida **não é spec completa***. A prova é nos dois — e é por isso que este
// guard não fala só do dashboard PF: ele tem uma LISTA, e tela nova entra nela.
//
// ⚠️ ESTRUTURAL E ASSUMIDO COMO TAL: sem jsdom não dá pra medir pixel num viewport. O que
// morde é a COMPOSIÇÃO — que exista um caminho ≥1024 sem container estreito, com os cards
// da linha 1 lado a lado, e sem nada que force scroll horizontal.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const raiz = process.cwd()
const ler = (p: string) => readFileSync(join(raiz, p), 'utf-8')
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')

/**
 * ⭐ AS TELAS QUE JÁ TÊM COMPOSIÇÃO DESKTOP DEFINIDA.
 *
 * ⚠️ Entrar aqui é o gesto que diz *"esta tela foi pensada nos dois"*. Tela nova que o dono
 * aprove por mock mobile precisa OU entrar nesta lista, OU ter a decisão registrada de que
 * ela é mobile-only (o tablet da cozinha, por exemplo, que é um aparelho só).
 */
const COM_COCKPIT = ['components/perfis/dashboard-pf.tsx']

/** largura mínima que um container principal pode ter no desktop sem "boiar" */
const LARGURA_MINIMA_DESKTOP = 1100

describe('⛔⛔ no desktop a tela não é o celular esticado', () => {
  it.each(COM_COCKPIT)('%s tem UMA composição de celular e UMA de desktop', (arq) => {
    const src = semComentarios(ler(arq))
    // o celular só existe abaixo do breakpoint…
    expect(src, 'a composição de celular não some no desktop').toContain('lg:hidden')
    // …e o cockpit só existe acima
    expect(src, 'não existe composição de desktop').toContain('hidden lg:block')
  })

  it.each(COM_COCKPIT)('%s: NENHUM container ativo no desktop é mais estreito que 1100px', (arq) => {
    const src = semComentarios(ler(arq))
    const estreitos: string[] = []
    // pega `max-w-[NNNpx]` e olha se a MESMA className o desliga no desktop
    for (const m of src.matchAll(/className="([^"]*max-w-\[(\d+)px\][^"]*)"/g)) {
      const [, classe, larguraStr] = m
      const largura = Number(larguraStr)
      if (largura >= LARGURA_MINIMA_DESKTOP) continue
      // ⭐ é aceitável quando some no desktop (`lg:hidden`) ou cresce (`lg:max-w-…`)
      const desligado = /\blg:hidden\b/.test(classe) || /\blg:max-w-/.test(classe)
      if (!desligado) estreitos.push(classe.trim())
    }
    expect(estreitos, '⛔ container estreito ativo no desktop — a coluna boiando no monitor').toEqual([])
  })

  it('⭐ a LINHA 1 do cockpit tem 3 cards LADO A LADO, não empilhados', () => {
    const src = semComentarios(ler('components/perfis/dashboard-pf.tsx'))
    const grid = src.slice(src.indexOf('hidden lg:block'))
    expect(grid, 'o cockpit não usa grid de 12 colunas').toContain('grid-cols-12')

    /**
     * ⚠️ **A 1ª VERSÃO CONTAVA A LETRA `col-span-4` e quebrou quando a classe virou
     * variável** — e a tela estava CERTA. Guard que mede o texto e não a composição vira
     * falso vermelho no primeiro refactor legítimo. O que importa: os três widgets da
     * linha 1 vêm ANTES do donut, cada um no seu bloco de coluna.
     */
    const ateODonut = grid.slice(0, grid.indexOf('<WDonut'))
    for (const w of ['<WSaldo', '<WFluxo', '<WEmpresa']) {
      expect(ateODonut, `${w} não está na linha 1 do cockpit`).toContain(w)
    }
    /**
     * ⚠️⚠️ **REGRA 11 me pegou aqui:** a 1ª versão contava `col-span-` e **`col-span-12`
     * casava** — ou seja, com os três cards em largura cheia (EMPILHADOS, que é exatamente
     * o defeito) o guard ficava verde. Largura cheia num grid de 12 é "ocupa a linha
     * inteira", e é o oposto de lado a lado.
     */
    const spans = [...ateODonut.matchAll(/col-span-(\d+)/g)].map((m) => Number(m[1]))
    expect(spans.length, 'a linha 1 não está em colunas').toBeGreaterThanOrEqual(2)
    expect(spans.filter((n) => n < 12).length, '⛔ os cards da linha 1 ocupam a linha inteira — estão EMPILHADOS').toBeGreaterThanOrEqual(2)
    expect(Math.max(...spans), 'algum card da linha 1 ocupa as 12 colunas').toBeLessThan(12)
    // e as linhas 2 e 3 em duas colunas de 6
    expect([...grid.matchAll(/col-span-6/g)].length).toBeGreaterThanOrEqual(4)
  })

  it('⛔ ZERO scroll horizontal: nada com largura fixa maior que o grid', () => {
    const src = semComentarios(ler('components/perfis/dashboard-pf.tsx')) + semComentarios(ler('components/perfis/widgets-pf.tsx'))
    // largura fixa em px acima de 480 dentro de card é o que estoura a coluna
    // ⚠️ `(?<!max-)` porque `\b` casa DEPOIS do hífen de `max-w-[…]` — a 1ª versão acusava
    // os próprios containers do grid, que são teto e não largura fixa
    const fixos = [...src.matchAll(/(?<!max-)\bw-\[(\d+)px\]/g)].map((m) => Number(m[1])).filter((n) => n > 480)
    expect(fixos, 'largura fixa que estoura a coluna').toEqual([])
    // e o svg do donut/balanço é fluido
    expect(src).toContain('className="block w-full"')
  })

  it('⭐ a faixa do TABLET (768–1024) existe — nem coluna estreita, nem cockpit', () => {
    const src = semComentarios(ler('components/perfis/dashboard-pf.tsx'))
    expect(src).toContain('md:grid-cols-2')
    expect(src).toContain('md:max-w-[760px]')
  })
})

describe('⭐⭐ FONTE ÚNICA DE WIDGET — muda o layout, nunca o conteúdo', () => {
  const dash = semComentarios(ler('components/perfis/dashboard-pf.tsx'))
  const widgets = semComentarios(ler('components/perfis/widgets-pf.tsx'))

  it.each(['WSaldo', 'WFluxo', 'WEmpresa', 'WDonut', 'WCartoes', 'WBalanco', 'WAVencer', 'WUltimos'])(
    '%s é UM componente, usado nas DUAS composições', (w) => {
      expect(widgets, `${w} não mora no módulo de widgets`).toContain(`export function ${w}`)
      const usos = [...dash.matchAll(new RegExp(`<${w}\\b`, 'g'))].length
      expect(usos, `${w} aparece ${usos}× — precisa estar nas duas composições`).toBe(2)
    })

  it('⛔ e o dashboard NÃO redesenha widget por conta própria', () => {
    // se a composição desenhasse um card de cartão "só pro desktop", os dois divergiriam no
    // primeiro selo novo — e o dono veria um número no bolso e outro no monitor
    expect(dash, 'o dashboard voltou a desenhar o donut na mão').not.toContain('strokeDasharray')
    expect(dash, 'o dashboard voltou a desenhar a barra de limite na mão').not.toContain('do limite usado')
  })

  it('⭐ o gesto de lançar muda de FORMA, não de função', () => {
    // FAB no polegar, botão na barra no mouse — o MESMO componente de frase
    expect(dash).toContain('rounded-full text-[28px]')      // o FAB
    expect(dash).toContain('Novo lançamento')                // o botão da barra
    expect([...dash.matchAll(/<LancamentoRapido\b/g)].length, 'dois modais de lançamento').toBe(1)
  })

  it('⭐ o desktop responde ao MOUSE — hover e cursor', () => {
    expect(widgets).toContain('lg:hover:shadow')
    expect(widgets).toContain('lg:transition-shadow')
    // ⚠️ e o hover é `lg:` de propósito: no toque o :hover GRUDA e o card fica
    // com a sombra levantada depois do dedo sair, parecendo selecionado
    expect(widgets).not.toMatch(/[^:]\bhover:shadow-lg\b/)
  })
})
