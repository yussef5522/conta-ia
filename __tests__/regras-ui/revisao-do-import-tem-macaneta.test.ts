// ⛔⛔⛔ 8ª VOLTA DA "PORTA SEM MAÇANETA" — A REVISÃO SÓ EXISTIA POR ROTA DIRETA (14/09/2026)
//
// **O dono, com o deploy 4/4 verde e a tela provada (86🟡/44✅ no dia 13/09):**
// *"NAVEGANDO EM PROD (cache limpo, celular e desktop) eu NÃO ACHO a tela: a área de
// importar vendas está igual era — subo arquivo, vejo o resumo velho, e nenhum botão/link
// leva à revisão por nome com os 3 contadores e as ações inline."*
//
// **ELE ESTAVA CERTO, E O DEFEITO ERA MAIOR QUE O RELATO.** Medido na fonte:
//   1. a revisão abria de UM lugar só — um link `text-xs … hover:underline` na ÚLTIMA
//      coluna da **4ª aba** ("Processados"). `hover` **não existe no celular**, que é
//      onde ele importa (a lição do "converter a unidade", 30/08);
//   2. o **caminho real dele** (subir o arquivo → confirmar) desembocava no **recibo
//      velho** — três números e um link pro extrato —, sem nenhum caminho pra revisão;
//   3. e do lado dos **COMPLEMENTOS** a revisão **não tinha caminho nenhum**: o
//      `relatorio` estava cravado em `'PRODUTOS'`, então o relatório que mais dói
//      (as bebidas) só era revisável por URL secreta.
//
// ⭐ **A REGRA QUE FICA (irmã da de 12/09, "fila zerada esconde o trabalho, nunca a
// ferramenta"):** *o RESULTADO do gesto abre a tela que responde a pergunta do gesto, e
// todo item da lista carrega o caminho À VISTA.* Motor provado por rota + tela sem
// maçaneta = motor que não subiu.
//
// ⚠️ ESTE GUARD É ESTRUTURAL E ASSUMIDO COMO TAL (o projeto roda em `environment: node`,
// sem jsdom — não dá pra clicar). Ele lê a FONTE, e tem **auto-teste dos detectores**
// (REGRA 11): sem isso passaria verde por cegueira, que é como três guards desta casa já
// nasceram mentindo.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { semComentarios, gatesQueEscondem } from './card-nao-nasce-escondido.test'

const raiz = process.cwd()
const PAGINA = 'app/(dashboard)/empresas/[id]/estoque/vendas/page.tsx'
const COMPONENTE = 'components/estoque/revisao-do-import.tsx'
const ROTA = 'app/api/empresas/[id]/estoque/vendas/revisao/route.ts'

const fonte = readFileSync(join(raiz, PAGINA), 'utf-8')
const renderizado = semComentarios(fonte)

/**
 * ⭐ O corpo de uma função, por contagem de chaves. Precisa ser por ESTRUTURA e não por
 * janela de N caracteres: janela de distância já produziu falso vermelho **com a tela
 * certa** duas vezes nesta casa (o detector de rastro em 12/09, o menu do PF em 13/09).
 */
export function corpoDaFuncao(src: string, nome: string): string {
  const i = src.indexOf(`function ${nome}(`)
  if (i === -1) return ''
  const abre = src.indexOf('{', src.indexOf(')', i))
  let n = 0
  for (let j = abre; j < src.length; j++) {
    if (src[j] === '{') n++
    else if (src[j] === '}') { n--; if (n === 0) return src.slice(abre, j + 1) }
  }
  return src.slice(abre)
}

/**
 * ⭐ Os `<button>` cujo TEXTO oferece revisar. Devolve o bloco inteiro de cada um pra
 * dar pra perguntar se ele **parece** clicável — a pergunta que o defeito levantou.
 */
export function botoesQueOferecem(src: string, palavra: string): string[] {
  const achados: string[] = []
  let de = src.indexOf('<button')
  while (de !== -1) {
    const ate = src.indexOf('</button>', de)
    const bloco = src.slice(de, ate === -1 ? src.length : ate)
    if (bloco.includes(palavra)) achados.push(bloco)
    de = src.indexOf('<button', de + 1)
  }
  return achados
}

/** ⛔ afordância: botão que só se anuncia no `hover` não existe no celular (30/08) */
export function pareceClicavelSemHover(bloco: string): boolean {
  return /\bborder(-|\s|"|')/.test(bloco) || /\bbg-(?!transparent)/.test(bloco)
}

describe('⛔⛔ a revisão do import tem MAÇANETA — nos dois relatórios e nos dois momentos', () => {
  it('o painel não nasce atrás de um booleano que começa fechado', () => {
    expect(gatesQueEscondem(fonte, '<BlocoRevisao')).toEqual([])
    expect(gatesQueEscondem(fonte, '<RevisaoDoImport')).toEqual([])
  })

  it('a página renderiza a revisão de verdade (não só importa o componente)', () => {
    expect(renderizado).toContain('<BlocoRevisao')
    expect(renderizado).toContain('<RevisaoDoImport')
  })

  // ⭐⭐ (a) O RESULTADO DO UPLOAD ABRE A REVISÃO — o defeito nº 2 do relato.
  it('confirmar o import de PRODUTOS abre a revisão do dia', () => {
    const corpo = corpoDaFuncao(renderizado, 'VendasImportPage')
    const confirmar = corpo.slice(corpo.indexOf('const confirmar ='))
    const ateFim = confirmar.slice(0, confirmar.indexOf('const linhasFiltradas'))
    expect(ateFim, 'o confirm voltou a terminar no recibo velho').toContain('setRevisao(')
  })

  it('confirmar o import de COMPLEMENTOS abre a revisão do dia', () => {
    const corpo = corpoDaFuncao(renderizado, 'ImportComplementos')
    expect(corpo, 'o import de complementos não avisa ninguém').toContain('onImportado(')
    // …e a página tem que AMARRAR o aviso na revisão, senão o callback é decorativo
    expect(renderizado).toMatch(/onImportado=\{[^}]*setRevisao/)
  })

  // ⭐⭐ (b) TODO IMPORT DA LISTA TEM "REVISAR" À VISTA — os dois relatórios.
  it('a lista de dias de PRODUTOS oferece revisar', () => {
    const botoes = botoesQueOferecem(renderizado, 'revisar')
    expect(botoes.length, 'sumiu o botão de revisar').toBeGreaterThan(0)
    expect(renderizado).toMatch(/relatorio: 'PRODUTOS', origem: 'LISTA'/)
  })

  it('a lista de dias de COMPLEMENTOS oferece revisar (era o que NÃO existia)', () => {
    const corpo = corpoDaFuncao(renderizado, 'BaixaComplementos')
    expect(corpo, 'a lista de complementos voltou a não ter caminho pra revisão').toContain('onRevisar(')
    expect(botoesQueOferecem(corpo, 'revisar').length).toBeGreaterThan(0)
  })

  it('⛔ nenhum "revisar" é texto que só se anuncia no hover', () => {
    const botoes = botoesQueOferecem(renderizado, 'revisar')
    const mudos = botoes.filter((b) => !pareceClicavelSemHover(b))
    expect(mudos, 'botão de revisar sem borda/fundo — invisível no celular').toEqual([])
  })

  it('⛔ a revisão de COMPLEMENTOS não pode voltar a ser impossível (relatório cravado)', () => {
    expect(renderizado).toContain(`relatorio="COMPLEMENTOS"`)
  })

  // ⭐⭐ (c) O GUARD DE 2 LADOS: o botão existe **E** a rota responde. Guard que só olha a
  // TELA aprovaria um botão apontando pro nada — o mesmo defeito de cabeça pra baixo.
  it('a rota por trás do painel EXISTE e responde GET e POST', () => {
    expect(existsSync(join(raiz, ROTA)), 'a rota da revisão sumiu').toBe(true)
    const rota = readFileSync(join(raiz, ROTA), 'utf-8')
    expect(rota).toMatch(/export async function GET/)
    expect(rota).toMatch(/export async function POST/)
    // ⚠️ ler é `view`, mudar vínculo é `manage` — a régua "ler é ler" da casa
    expect(rota).toContain(`'stock.view'`)
    expect(rota).toContain(`'stock.manage'`)
    // e ela tem que aceitar os DOIS relatórios, senão o botão novo cai num 400
    expect(rota).toMatch(/'PRODUTOS'\s*,\s*'COMPLEMENTOS'/)
  })

  it('o caminho que o componente CHAMA é exatamente o da rota que existe', () => {
    const comp = semComentarios(readFileSync(join(raiz, COMPONENTE), 'utf-8'))
    const urls = [...comp.matchAll(/\/api\/empresas\/\$\{empresaId\}([^`?]*)/g)].map((m) => m[1])
    expect(urls.length, 'o painel não chama rota nenhuma').toBeGreaterThan(0)
    for (const u of new Set(urls)) {
      const arquivo = join(raiz, 'app/api/empresas/[id]' + u + '/route.ts')
      expect(existsSync(arquivo), `o painel chama ${u} e não existe rota pra isso`).toBe(true)
    }
  })
})

// ⭐⭐ REGRA 11 — OS DETECTORES TÊM QUE PEGAR O DEFEITO QUE MOTIVOU O GUARD.
describe('os detectores mordem (auto-teste)', () => {
  const HOVER_ONLY = `<button onClick={f} className="text-xs font-medium text-violet-700 hover:underline">revisar</button>`
  const COM_BORDA = `<button onClick={f} className="h-7 rounded-lg border border-violet-300 px-2 text-xs">revisar</button>`

  it('acusa o link hover-only que era o defeito de 14/09', () => {
    expect(pareceClicavelSemHover(HOVER_ONLY)).toBe(false)
  })

  it('aprova o botão com borda', () => {
    expect(pareceClicavelSemHover(COM_BORDA)).toBe(true)
  })

  it('acha o botão pelo TEXTO, não pela posição', () => {
    const src = `<button a>outro</button><div/><button b>x revisar y</button>`
    expect(botoesQueOferecem(src, 'revisar')).toHaveLength(1)
  })

  it('o corpo da função é por chaves, não por janela de caracteres', () => {
    const src = `function A() { const x = { y: 1 }; return x }\nfunction B() { return 2 }`
    expect(corpoDaFuncao(src, 'A')).toContain('y: 1')
    expect(corpoDaFuncao(src, 'A')).not.toContain('return 2')
  })

  it('função inexistente devolve vazio (não morde por engano)', () => {
    expect(corpoDaFuncao('const a = 1', 'NaoExiste')).toBe('')
  })
})
