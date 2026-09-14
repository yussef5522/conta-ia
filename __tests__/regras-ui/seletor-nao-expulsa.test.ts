// ⛔⛔⛔ "O DEFINIR FICHA ME EXPULSA DA TELA" (14/09/2026)
//
// **O dono, na revisão de complementos:** *"clico em definir → navega pro cardápio e eu SAIO
// da revisão — perco o dia, a lista e o fio. A referência é a NOSSA tela de PRODUTOS, que
// está certa: clico no destino → seletor abre ALI → escolho → sigo na mesma tela."*
//
// **A EXPULSÃO ERA LITERAL:** o "definir" era um `<a href>` pro cardápio. E o gesto se
// repete ~80 vezes num dia de import — sair e voltar 80 vezes não é fluxo, é castigo.
//
// ⭐ **A RÉGUA QUE FICA:** *ajuste de vínculo acontece ONDE a lista está; o único caminho
// que sai da tela é o da receita composta, e ele volta pro MESMO dia e pra MESMA linha.*
// **Ida com volta não é expulsão.**
//
// ⚠️ ESTE GUARD É ESTRUTURAL E ASSUMIDO COMO TAL (sem jsdom não dá pra clicar). Ele lê a
// FONTE — e tem **auto-teste dos detectores** (REGRA 11), senão passaria verde por cegueira.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { semComentarios } from './card-nao-nasce-escondido.test'
import { corpoDaFuncao } from './revisao-do-import-tem-macaneta.test'

const raiz = process.cwd()
const REVISAO = 'components/estoque/revisao-do-import.tsx'
const SELETOR = 'components/estoque/seletor-de-destino.tsx'
const VENDAS = 'app/(dashboard)/empresas/[id]/estoque/vendas/page.tsx'

const revisao = semComentarios(readFileSync(join(raiz, REVISAO), 'utf-8'))
const seletor = semComentarios(readFileSync(join(raiz, SELETOR), 'utf-8'))
const vendas = semComentarios(readFileSync(join(raiz, VENDAS), 'utf-8'))

/**
 * ⭐ A `tag` nasce DENTRO de um gate condicional?
 *
 * ⚠️⚠️ A 1ª VERSÃO DESTE DETECTOR NÃO MORDEU (REGRA 11): ela era um regex com janela de 400
 * caracteres entre o gate e o texto do botão — e no arquivo real há o bloco inteiro do
 * preview no meio. **Janela de distância já produziu falso vermelho e falso verde nesta
 * casa** (o detector de rastro em 12/09, o menu do PF em 13/09). O que morde é olhar o que
 * vem IMEDIATAMENTE antes da tag, que é estrutura e não distância.
 */
export function nasceAtrasDeGate(src: string, tag: string): boolean {
  const i = src.indexOf(tag)
  if (i === -1) return false
  const antes = src.slice(0, i).trimEnd()
  return antes.endsWith('&& (') || antes.endsWith('? (') || antes.endsWith('&&(')
}

/** ⭐ os `<a href>` que NAVEGAM pra outra tela do app (o que expulsa) */
export function linksQueNavegam(src: string): string[] {
  return [...src.matchAll(/href=\{?[`'"]([^`'"$}]*\$?\{?[^`'"]*)[`'"]/g)]
    .map((m) => m[1])
    .filter((h) => h.includes('/estoque/') || h.includes('/empresas/'))
}

describe('⛔⛔ a revisão ajusta o destino SEM sair da tela', () => {
  it('⛔ o "definir/trocar" não é mais um link pro cardápio', () => {
    const paraCardapio = linksQueNavegam(revisao).filter((h) => h.includes('/estoque/cardapio'))
    expect(paraCardapio, 'a expulsão voltou — "definir" virou link de novo').toEqual([])
  })

  it('a revisão usa o seletor inline', () => {
    expect(revisao).toContain('<SeletorDeDestino')
  })

  /**
   * ⭐⭐ FONTE ÚNICA (o pedido literal): o MESMO componente na revisão e na tela de
   * produtos. Dois seletores divergiriam no primeiro destino novo, e o dono veria opções
   * diferentes pra mesma pergunta em duas telas do mesmo módulo.
   */
  /**
   * ⚠️⚠️ REAPONTADO EM 14/09, NÃO AFROUXADO: a tela de produtos deixou de renderizar o
   * seletor **diretamente** porque a tabela velha morreu — agora ela renderiza a REVISÃO,
   * e é a revisão que usa o seletor. A pergunta continua a mesma ("o destino se edita pelo
   * componente único?"); o que mudou é por onde ela passa.
   */
  it('⭐ o destino se edita pelo MESMO seletor nas duas telas', () => {
    expect(revisao).toContain('<SeletorDeDestino')
    expect(revisao).toContain("from './seletor-de-destino'")
    expect(vendas).toContain('<RevisaoDoImport')
    // ⛔ e a página não pode ter um SEGUNDO desenho de destino por conta própria
    expect(vendas).not.toContain('optgroup')
  })

  it('⛔ o `<select>` de destino da tela de produtos morreu (não tinha busca)', () => {
    expect(vendas).not.toContain('Produtos finais (ficha)')
    expect(vendas).not.toContain("value={'FICHA:' + f.id}")
  })

  /**
   * ⛔ UNIFICAR NÃO PODE TIRAR CAPACIDADE: o `<select>` antigo oferecia "desmapear" (que
   * DEVOLVE o nome pra fila, diferente de ignorar) e "criar item de revenda". Os dois
   * sobreviveram — senão o fix seria uma regressão com cara de melhoria.
   */
  it('⭐ "desmapear" e "criar item" sobreviveram à unificação', () => {
    // ⭐ o guard da MUDANÇA DE CASA: desmapear migrou da tabela velha PRA REVISÃO antes de
    // a velha morrer. **Remoção sem realocação é perda** — a régua do dono em 14/09.
    expect(revisao).toContain('desmapear')
    expect(revisao).toContain("alvoTipo: 'DESMAPEAR'")
    expect(seletor).toMatch(/criar .{0,4}\{nomePdv\}/)
    expect(seletor).toContain("categoria: 'REVENDA'")
  })

  it('⭐ o seletor busca (a lista passa de 150 nomes)', () => {
    expect(seletor).toContain('filtrarPorBusca')
  })

  it('⭐ e ele é dispensável sem escolher — ESC e clique fora (a lição de 28/08)', () => {
    expect(seletor).toContain('useDismissivel')
  })
})

describe('⭐⭐ ida com volta — o combo sai e VOLTA pro mesmo dia', () => {
  it('a URL do editor vem da régua provada, não montada à mão na tela', () => {
    // ⚠️ só a REVISÃO monta o href agora: a tabela velha, que era o outro chamador, morreu
    expect(revisao).toContain('hrefDoEditor(')
    expect(existsSync(join(raiz, 'lib/stock/vendas/volta-da-revisao.ts'))).toBe(true)
  })

  /**
   * ⚠️ LIDO NO 1º RENDER, como o `?aba=`. Em `useEffect` a tela renderizaria SEM a revisão
   * antes de abri-la — e "voltar e não ver nada" é indistinguível de "não gravou".
   */
  it('⭐ a tela de Vendas lê `?revisar=` no 1º render (não em effect)', () => {
    const corpo = corpoDaFuncao(vendas, 'VendasImportPage')
    const decl = corpo.slice(corpo.indexOf('const [revisao'), corpo.indexOf('const [aba'))
    expect(decl, 'o `?revisar=` saiu do estado inicial').toContain("get('revisar')")
  })

  it('⭐ a linha tem âncora pra a volta cair nela, não no topo da lista', () => {
    expect(revisao).toContain('ancoraDaLinha(l.nome)')
  })
})

describe('⭐⭐ o arremate — confirmar no PÉ da tela onde eu trabalhei', () => {
  /**
   * ⛔ Antes o botão só existia quando já havia preview, e o preview só nascia DEPOIS de um
   * ajuste: voltar do editor com a linha vinculada deixava o dono sem onde aplicar. Botão
   * que aparece e some conforme o estado é botão que se aprende a não procurar.
   */
  it('o rodapé é permanente — não nasce atrás do preview', () => {
    expect(revisao).toContain('Confirmar e baixar')
    expect(nasceAtrasDeGate(revisao, '<div className="sticky bottom-0'),
      'o confirmar voltou pra trás de um gate — botão que some é botão que não se procura').toBe(false)
  })

  it('⛔ e ele NÃO grava sem preview — nada baixa pro destino novo às cegas', () => {
    // ⚠️ no modo DIA quem trava é o preview; no modo PRÉ-IMPORT quem trava é o
    // `confirmar.habilitado` da tela (que exige a DATA). Os dois caminhos travam.
    expect(revisao).toMatch(/gravando \|\| !preview \|\| preview\.mudam\.length === 0/)
    expect(revisao).toContain('confirmar.habilitado')
  })

  it('o preview carrega junto com a tela', () => {
    expect(revisao).toMatch(/useEffect\(\(\) => \{ if \(!externo\) void verPreview\(\) \}/)
  })
})

// ⭐⭐ REGRA 11 — o detector tem que pegar o defeito que motivou o guard.
describe('o detector morde (auto-teste)', () => {
  const EXPULSAO = `<a href={\`/empresas/\${empresaId}/estoque/cardapio?nome=\${n}\`}>definir</a>`
  const INLINE = `<SeletorDeDestino empresaId={empresaId} onEscolher={aplicar} />`

  it('acusa o link pro cardápio que era a expulsão', () => {
    expect(linksQueNavegam(EXPULSAO).some((h) => h.includes('/estoque/cardapio'))).toBe(true)
  })

  it('não acusa o seletor inline', () => {
    expect(linksQueNavegam(INLINE)).toEqual([])
  })

  it('não confunde link EXTERNO com navegação interna', () => {
    expect(linksQueNavegam('<a href="https://sefaz.gov.br">x</a>')).toEqual([])
  })

  it('acusa o rodapé escondido atrás de um gate', () => {
    expect(nasceAtrasDeGate('{preview && preview.mudam.length > 0 && (<div className="x"', '<div className="x"')).toBe(true)
    expect(nasceAtrasDeGate('{cond ? (\n  <div className="x"', '<div className="x"')).toBe(true)
  })

  it('não acusa o rodapé solto na árvore', () => {
    expect(nasceAtrasDeGate('</div>\n\n      <div className="x"', '<div className="x"')).toBe(false)
  })
})
