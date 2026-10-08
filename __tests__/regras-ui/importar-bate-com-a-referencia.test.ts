/**
 * ⭐⭐⭐ `docs/importar-referencia.html` É A LEI DESTA TELA — E O GUARD ABRE O ARQUIVO (08/10/2026).
 *
 * Mesmo protocolo da margem (07/10) e do mock da Conciliação (10/09): a referência **entrou no
 * repo**, então *"igual à referência"* deixou de ser **memória minha** e virou **dado**. Tom
 * ajustado "no olho" fica vermelho apontando o valor que o arquivo manda.
 *
 * ⚠️⚠️ POR QUE SÓ ASSIM FUNCIONA: na Conciliação a mesma tela foi refeita TRÊS vezes porque
 * *"enquanto o mock vivia numa pasta de downloads, «igual ao mock» era MEMÓRIA MINHA — e
 * memória é exatamente o que falhou nas duas voltas anteriores"*.
 *
 * ⭐⭐ TODA ASSERÇÃO DE FRASE É DE DOIS LADOS: a frase tem que existir **na REFERÊNCIA** *e* **no
 * CÓDIGO**. Se eu inventar uma frase, o lado da referência fica vermelho; se o código andar, o
 * lado do código fica vermelho. Uma asserção que só olhasse o código me deixaria escrever
 * qualquer coisa e chamar de *"o que o dono aprovou"*.
 *
 * ⛔⛔ E AS SEÇÕES SÃO CONFERIDAS NA **LISTA DE RENDER**, NUNCA NO ARQUIVO (a cicatriz de 07/10):
 * a REGRA 11 mostrou que arrancar `<MontadorDePizza />` da lista deixava a suíte **VERDE**,
 * porque a `function` e todos os textos dela continuavam no arquivo. ***Guard que lê o arquivo
 * aprova o componente que ninguém desenha.***
 *
 * ⚠️ Estrutural e assumido como tal: o projeto roda em `environment: node`, sem jsdom — não dá
 * pra medir pixel renderizado aqui. O que se trava é o que já mordeu nesta casa: hex cravado,
 * token só no tema claro, medida traduzida de cabeça, peça da referência que sumiu da tela.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { semComentarios, usosDe } from './_leitura-de-fonte'
import { lerReferenciaVisual, CAMINHO_DA_REFERENCIA_IMPORTAR } from '@/lib/referencias/visual'

const R = (p: string) => resolve(process.cwd(), p)
const ler = (p: string) => readFileSync(p, 'utf8')

/** ⭐ a PORTA ÚNICA de leitura — a MESMA que a sonda da prova em prod usa (a lição de 08/10) */
const REF = lerReferenciaVisual(CAMINHO_DA_REFERENCIA_IMPORTAR)

/**
 * ⚠️ A TELA É LIDA **SEM COMENTÁRIO**, de propósito. O arquivo documenta, no próprio texto, as
 * frases e as peças que ele desenha — lendo o texto cru, ***o arquivo que documenta o defeito
 * seria o que o absolve*** (a 5ª "menção, não uso" desta casa, 21/09).
 */
const TELA = semComentarios(ler(R('components/estoque/central-de-import.tsx')))

/** ⭐ as frases que falam de DADO moram nas LIBS — quem escreve a frase é quem decide o número */
const LIBS = [
  'lib/stock/vendas/razao-sabor-pizza.ts',
  'lib/stock/vendas/central-de-import.ts',
  'lib/stock/vendas/detalhe-do-dia.ts',
]
  .map((p) => semComentarios(ler(R(p))))
  .join('\n')

const CODIGO = `${TELA}\n${LIBS}`

/** ⚠️ sem acento e sem caixa: o que não pode mudar é a PALAVRA, não a tipografia dela */
const cru = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ')

function frase(texto: string) {
  expect(cru(REF.html), `"${texto}" NÃO está na referência — eu inventei a frase`).toContain(
    cru(texto),
  )
  expect(cru(CODIGO), `a referência imprime "${texto}" e o código não`).toContain(cru(texto))
}

/**
 * ⭐⭐ A LISTA DE RENDER — o JSX que roda quando o payload chega.
 *
 * ⚠️ O fim é a **função SEGUINTE**, nunca o primeiro `</div>`: a tela é uma árvore de divs, e
 * cortar no primeiro fechamento esconderia 5 das 6 seções (o guard passaria a aprovar uma tela
 * com o cabeçalho e mais nada).
 */
function listaDeRender(): string {
  const i = TELA.lastIndexOf('return (', TELA.indexOf('max-w-[1440px]'))
  expect(i, 'a lista de render da central não foi achada').toBeGreaterThan(-1)
  const fim = TELA.indexOf('\nfunction AlvoDeUpload(', i)
  expect(fim, 'a lista de render não termina na função seguinte').toBeGreaterThan(i)
  return TELA.slice(i, fim)
}

/* ═══════════════════════════ 1. OS TOKENS, MAPEADOS 1:1 ═══════════════════════════ */

/**
 * ⭐⭐ O par é por **PAPEL**, nunca por VALOR HEX. `--verde` da referência é `#1D9E75` e o
 * `--fam-verde-mid` da casa é `#0f9d58`: tons diferentes do MESMO verde, e o da casa é o que
 * **inverte nos dois temas** junto com o resto do sistema. Cravar o hex da referência aqui
 * seria trocar a paleta da casa pela do arquivo de exemplo.
 */
const MAPA_DE_TOKENS: Record<string, string> = {
  '--bg': '--prod-bg',
  '--surface': '--prod-surface',
  '--surface-2': '--prod-surface-1',
  '--border': '--prod-line',
  '--border-strong': '--prod-line-strong',
  '--text': '--prod-primary',
  '--text-2': '--prod-secondary',
  '--text-3': '--prod-muted',
  '--indigo': '--fam-indigo-mid',
  '--indigo-50': '--fam-indigo-bg',
  '--indigo-900': '--fam-indigo-ink',
  '--verde': '--fam-verde-mid',
  '--verde-esc': '--fam-verde-ink',
  '--verde-50': '--fam-verde-bg',
  '--verde-900': '--fam-verde-ink',
  '--ambar': '--fam-ambar-mid',
  '--ambar-esc': '--fam-ambar-ink',
  '--ambar-50': '--fam-ambar-bg',
  '--ambar-900': '--fam-ambar-ink',
  '--coral': '--fam-coral-mid',
  '--coral-esc': '--fam-coral-ink',
  '--coral-50': '--fam-coral-bg',
  '--coral-900': '--fam-coral-ink',
  '--shadow': '--prod-sombra',
}

describe('⛔⛔ OS TOKENS — mapeados 1:1, e nos DOIS temas', () => {
  it('⭐ todo token do `:root{}` da referência tem par declarado no mapa', () => {
    expect(REF.tokens.length, 'o bloco de tokens da referência não foi lido').toBeGreaterThan(20)
    for (const t of REF.tokens) {
      expect(
        MAPA_DE_TOKENS[t],
        `o token ${t} existe na referência e NÃO tem par declarado — token novo no arquivo do dono tem que ganhar par aqui, não ser ignorado`,
      ).toBeTruthy()
    }
  })

  it('⛔ a tela NÃO crava hex de cor — ela pinta por token', () => {
    const hex = [...TELA.matchAll(/#[0-9A-Fa-f]{3,8}\b/g)].map((m) => m[0])
    expect(hex, `hex cravado na tela: ${hex.join(', ')} — a casa pinta por token, que inverte nos 2 temas`).toEqual([])
  })

  it('⛔ a tela só pinta com tokens da paleta mapeada', () => {
    const usados = [...new Set([...TELA.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1]))]
    const permitidos = new Set(Object.values(MAPA_DE_TOKENS))
    for (const t of usados) {
      expect(
        permitidos.has(t),
        `a tela pinta com ${t}, que NÃO é par de nenhum token da referência — ou o mapa está incompleto, ou a tela saiu da paleta`,
      ).toBe(true)
    }
  })

  it('⛔ todo token que a tela usa existe nos DOIS mapas do CSS (claro E escuro)', () => {
    const css = ler(R('app/globals.css'))
    const usados = [...new Set([...TELA.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1]))]
    /**
     * ⚠️⚠️ A RÉGUA É A **CONTAGEM** DE DECLARAÇÕES, NUNCA UM FATIAMENTO DO ARQUIVO — e eu
     * aprendi isso duas vezes: o `globals.css` tem **dois** blocos `.dark` e vários `:root`,
     * então cortar no primeiro `.dark {` acusa token que ESTÁ lá. Foi o falso vermelho de uma
     * versão anterior do guard da margem, **e a primeira versão deste** acusou
     * `--fam-verde-bg` "ausente do tema claro" com ele declarado na linha 561.
     *
     * ⛔ E conferir só a EXISTÊNCIA aprovaria token declarado apenas no claro — a tela ficaria
     * com o texto de um tema sobre o fundo do outro.
     */
    const vezes = (t: string) => css.split(`${t}:`).length - 1
    for (const t of usados) {
      expect(vezes(t), `${t} precisa dos DOIS mapas (claro e escuro) — token só num tema é a tela ilegível no outro`).toBeGreaterThanOrEqual(2)
    }
  })
})

/* ═══════════════════════════ 2. MEDIDAS E CORTES ═══════════════════════════ */

describe('⛔ AS MEDIDAS vêm do arquivo, não da minha cabeça', () => {
  /**
   * ⚠️ px LITERAL, não alias do Tailwind: `gap-2.5` **é** 10px, mas obriga tradução mental — e
   * foi tradução mental que produziu as duas versões erradas da Conciliação (10/09).
   */
  /**
   * ⚠️ A BASE DO `body{}` FICA DE FORA, e não é folga: aquele `font-size:14px` é o tamanho da
   * PÁGINA, que no app vem do shell — não é hierarquia de elemento que um componente declara.
   * Cobrá-lo aqui exigiria um `text-[14px]` decorativo só pra calar o guard.
   */
  const BASE_DO_BODY = (REF.css.match(/body\{[^}]*font-size:\s*([\d.]+)px/) ?? [])[1]

  it('⭐ as hierarquias de letra da referência estão na tela', () => {
    expect(REF.letras.length, 'nenhuma font-size lida da referência').toBeGreaterThan(5)
    expect(BASE_DO_BODY, 'a referência deixou de declarar a base do body').toBeTruthy()
    const faltam = REF.letras.filter((px) => px !== BASE_DO_BODY && !TELA.includes(`text-[${px}px]`))
    expect(faltam, `font-size da referência ausentes da tela: ${faltam.join(', ')}`).toEqual([])
  })

  it('⭐ a LEI DE LAYOUT: container de largura útil com teto de 1440 — NUNCA coluna estreita', () => {
    expect(REF.css).toContain('max-width:1440px')
    expect(TELA, 'o container perdeu o teto de 1440 da referência').toContain('max-w-[1440px]')
    expect(TELA, 'o padding do container não é o do arquivo (22/28)').toContain('px-[28px]')
    expect(TELA).toContain('pt-[22px]')
    const estreito = [...TELA.matchAll(/max-w-(?:xl|2xl|3xl|4xl|5xl|6xl|\[(?:[1-9]\d{2})px\])/g)]
    expect(estreito.map((m) => m[0]), 'voltou uma coluna estreita — a LEI DE LAYOUT do arquivo proíbe').toEqual([])
  })

  /**
   * ⚠️⚠️ A REGRA 11 REPROVOU A 1ª VERSÃO DESTE TESTE: ele exigia só o PREFIXO `max-[700px]:`,
   * e a tela tem três utilitários nele — **arrancar um deixava o guard VERDE**. O que morde é
   * exigir os TRÊS NÚMEROS que o arquivo declara (`padding:16px 14px 56px`), lidos dali e não
   * da minha cabeça: ***reposição que não reproduz o defeito é um verde de graça.***
   *
   * ⛔ E a dupla de dropzone empilhar no celular é o OUTRO corte de 700 do arquivo
   * (`.drop-grid{grid-template-columns:1fr}`) — a tela expressa isso como `max-[700px]:grid-cols-1`.
   */
  it('⭐ o corte do CELULAR da referência existe na tela, com as 3 medidas do arquivo', () => {
    expect(REF.cortes, 'a referência não declara o corte de 700px').toContain('700')
    const regra = REF.css.match(/@media\s*\(max-width:700px\)\{\s*\.wrap\{padding:([\d.]+)px\s+([\d.]+)px\s+([\d.]+)px\}/)
    expect(regra, 'a referência deixou de declarar o padding do celular no `.wrap`').toBeTruthy()
    const [, topo, lado, baixo] = regra!
    for (const esperado of [`max-[700px]:px-[${lado}px]`, `max-[700px]:pt-[${topo}px]`, `max-[700px]:pb-[${baixo}px]`]) {
      expect(TELA, `o celular perdeu ${esperado} — é a medida que o arquivo manda`).toContain(esperado)
    }
    expect(TELA, 'a dupla de dropzone tem que empilhar no celular (o 2º corte de 700 do arquivo)').toContain('max-[700px]:grid-cols-1')
  })
})

/* ═══════════════════════════ 3. AS 6 PEÇAS, NA ORDEM DO ARQUIVO ═══════════════════════════ */

/**
 * ⭐⭐ A ORDEM É A DO ARQUIVO DO DONO, e ela é conferida CONTRA A REFERÊNCIA — se ele reordenar
 * o arquivo, é este teste que fica vermelho primeiro, em vez de a tela divergir calada.
 */
/**
 * ⚠️ A ORDEM É LIDA NO **CORPO**, nunca no arquivo inteiro: o `<style>` traz as mesmas palavras
 * nos comentários das regras, em OUTRA ordem — a 1ª versão deste guard acusou *"ordem quebrada
 * em DROPZONE DUPLA"* porque a palavra aparece primeiro num comentário de CSS.
 */
const CORPO_DA_REFERENCIA = REF.html.slice(REF.html.indexOf('<body>'))

const PECAS: { nome: string; naRef: string; naTela: RegExp }[] = [
  { nome: 'CABEÇALHO', naRef: 'CABEÇALHO', naTela: /Importar vendas/ },
  { nome: '1 · DROPZONE DUPLA', naRef: 'DROPZONE DUPLA', naTela: /<AlvoDeUpload/ },
  { nome: '2 · ALERTA DO BURACO', naRef: 'ALERTA DO BURACO', naTela: /importar este dia/ },
  { nome: '3 · DIAS IMPORTADOS', naRef: 'DIAS IMPORTADOS', naTela: /Dias importados/ },
  { nome: '4 · DETALHE DO DIA', naRef: 'DETALHE DO DIA', naTela: /DESTINO NO ESTOQUE/ },
]

describe('⛔⛔ AS PEÇAS DA REFERÊNCIA ESTÃO NA LISTA DE RENDER, NA ORDEM', () => {
  it('⭐ as 5 peças aparecem na lista de render', () => {
    const lista = listaDeRender()
    for (const p of PECAS) {
      expect(
        cru(CORPO_DA_REFERENCIA).includes(cru(p.naRef)),
        `a peça "${p.naRef}" não está na referência — a lista do guard está desatualizada`,
      ).toBe(true)
      expect(
        p.naTela.test(lista),
        `a peça "${p.nome}" da referência NÃO é desenhada pela tela — peça removida da referência = vermelho`,
      ).toBe(true)
    }
  })

  it('⭐ a ORDEM na tela é a ORDEM na referência', () => {
    const lista = listaDeRender()
    const naRef = PECAS.map((p) => cru(CORPO_DA_REFERENCIA).indexOf(cru(p.naRef)))
    const naTela = PECAS.map((p) => lista.search(p.naTela))
    for (let k = 1; k < PECAS.length; k++) {
      expect(naRef[k], `ordem da referência quebrada em ${PECAS[k].naRef}`).toBeGreaterThan(naRef[k - 1])
      expect(
        naTela[k],
        `"${PECAS[k].nome}" aparece ANTES de "${PECAS[k - 1].nome}" na tela, e na referência é o contrário`,
      ).toBeGreaterThan(naTela[k - 1])
    }
  })

  it('⭐ a NOTA DO SININHO (camada 3) fica entre os dias e o detalhe, como no arquivo', () => {
    const lista = listaDeRender()
    expect(cru(CORPO_DA_REFERENCIA)).toContain(cru('camada 3'))
    const sino = lista.indexOf('camada 3')
    expect(sino, 'a nota do sininho não é desenhada').toBeGreaterThan(-1)
    expect(sino, 'a nota do sininho tem que vir DEPOIS dos dias importados').toBeGreaterThan(lista.indexOf('Dias importados'))
    expect(sino, 'a nota do sininho tem que vir ANTES do detalhe').toBeLessThan(lista.search(/DESTINO NO ESTOQUE/))
  })
})

/* ═══════════════════════════ 4. AS FRASES (dois lados) ═══════════════════════════ */

describe('⭐⭐ AS FRASES SÃO AS DO ARQUIVO — nos dois lados', () => {
  it('cabeçalho', () => {
    frase('Importar vendas')
    frase('do Suitable — e a memória do que já entrou')
  })

  it('dropzone dupla · camada 1 do aviso', () => {
    frase('Relatório de Produtos')
    frase('Relatório de Complementos')
    frase('sem ele, as pizzas vendem sem baixar sabor do estoque')
  })

  it('alerta do buraco', () => {
    frase('ficou sem importação')
    frase('importar este dia')
  })

  it('dias importados · os 4 selos · a conferência', () => {
    frase('Dias importados')
    frase('toque no dia pra abrir a conferência')
    frase('completo ✓')
    frase('complementos incompletos ⚠')
    frase('sabores não importados ✗')
    frase('sem importação ✗')
    frase('Σ do arquivo × Σ gravado')
    frase('bate ao centavo')
    frase('sem destino')
    frase('mapear →')
    frase('substituir o dia (re-importar com preview) →')
  })

  it('a nota do sininho (camada 3)', () => {
    frase('camada 3')
    frase('uma causa, um alarme')
  })

  it('detalhe do dia · as duas abas · a coluna DESTINO', () => {
    frase('buscar produto ou sabor')
    frase('PRODUTO')
    frase('DESTINO NO ESTOQUE')
    frase('baixou ficha ✓')
    frase('baixou base + sabores ✓')
    frase('baixou revenda ✓')
    frase('SABOR')
    frase('VEZES')
    frase('com ficha · baixou ✓')
    frase('sem ficha')
    frase('criar agora →')
  })
})

/* ═══════════════════════════ 5. OS GESTOS (o `<script>` é a spec) ═══════════════════════════ */

/**
 * ⭐⭐ O BLOCO DE SCRIPT DA REFERÊNCIA **É A ESPECIFICAÇÃO DOS GESTOS** — ordem do dono. Os três
 * gestos dele (`tgl` · `aba` · `filtra`) têm que existir na tela como comportamento REAL.
 */
describe('⭐ OS GESTOS que o `<script>` da referência especifica', () => {
  it('⭐ a referência declara os 3 gestos', () => {
    for (const g of ['function tgl(', 'function aba(', 'function filtra(']) {
      expect(REF.script, `a referência não declara ${g} — a spec dos gestos mudou`).toContain(g)
    }
  })

  it('⭐ `tgl` — abrir/fechar a conferência do dia, com o chevron virando', () => {
    const lista = listaDeRender()
    expect(lista, 'o clique na linha do dia não abre a conferência').toMatch(/setAberto/)
    expect(lista, 'o chevron ▾/▴ da referência não aparece na tela').toMatch(/▴|▾/)
  })

  it('⭐ `aba` — Produtos | Sabores trocam de pane', () => {
    const lista = listaDeRender()
    expect(lista, 'as abas do detalhe não existem').toMatch(/setAba/)
    expect(lista).toMatch(/Produtos/)
    expect(lista).toMatch(/Sabores/)
  })

  it('⛔⛔ `filtra` — a busca é a `casaBusca` DA CASA, nunca `includes` cru', () => {
    expect(usosDe(TELA, 'casaBusca'), 'a busca do detalhe tem que usar a régua da casa').toBeGreaterThan(0)
    /**
     * ⚠️ A referência comenta isso no próprio arquivo (*"em prod: casaBusca da casa, que acha
     * «agua»→«Água»"*), e é a cicatriz de 08/09: `contains`/`includes` cru é case-sensitive no
     * Postgres e cego a acento — digitar "agua" não achava "Água".
     */
    expect(cru(REF.html), 'a referência parou de mandar usar a casaBusca').toContain(cru('casaBusca'))
    const cru_includes = [...TELA.matchAll(/\.toLowerCase\(\)\.includes\(/g)]
    expect(cru_includes.map((m) => m[0]), 'voltou busca por includes cru — a régua da casa é a casaBusca').toEqual([])
  })
})

/* ═══════════ 5b. A DIVERGÊNCIA DECLARADA (realocação, não invenção) ═══════════ */

/**
 * ⭐⭐ A CENTRAL SUBSTITUI A ABA "PROCESSADOS", E O GESTO DELA NÃO PODE MORRER NO CAMINHO.
 *
 * O arquivo do dono não tem o "refazer a baixa": ele nasceu na aba que esta tela aposenta, e
 * ***remoção sem realocação é perda*** (a régua de 10/09, quando a conferência de saldo mudou
 * de casa). Então ele FICA, **declarado** — e este teste prova os DOIS lados, como o guard da
 * margem faz com o botão de tema: a referência NÃO tem o gesto, a tela TEM, e o motivo está
 * escrito no arquivo da tela (sem o comentário, ninguém saberia que é escolha e não descuido).
 */
describe('⚠️ A DIVERGÊNCIA DECLARADA — o reprocessar mudou de casa', () => {
  it('⭐ a referência NÃO tem o gesto, a tela TEM, e o motivo está escrito', () => {
    expect(cru(CORPO_DA_REFERENCIA), 'a referência passou a ter o gesto — a divergência deixou de existir').not.toContain(
      cru('refazer a baixa'),
    )
    expect(listaDeRender(), 'o gesto do reprocessar sumiu da central — a aba que o tinha foi aposentada').toContain(
      'refazer a baixa com o mapa de hoje',
    )
    /** ⚠️ lido COM comentário de propósito: o que se afirma aqui é que a decisão está escrita */
    expect(
      ler(R('components/estoque/central-de-import.tsx')),
      'a divergência da referência tem que ter o motivo escrito no arquivo',
      /** ⚠️ âncora de UMA linha: o comentário quebra em duas e o literal inteiro não casa */
    ).toContain('realocação é perda')
  })

  it('⛔ reprocessar e substituir-o-dia são DOIS gestos, nunca um', () => {
    const lista = listaDeRender()
    expect(lista).toContain('substituir o dia (re-importar com preview)')
    expect(lista).toContain('refazer a baixa com o mapa de hoje')
    expect(TELA, 'os dois gestos têm que chegar por props distintas').toContain('onSubstituirDia')
    expect(TELA).toContain('onReprocessarDia')
  })
})

/* ═══════════════════════════ 6. TELA DE LEITURA: ZERO ESCRITA ═══════════════════════════ */

/**
 * ⛔⛔ A ORDEM DO DONO: *"tela de leitura: ZERO escrita fora de (futuro) Σ do arquivo no ato de
 * importar e do fluxo de substituir-com-preview"*.
 *
 * ⚠️ O componente **não grava nada por conta própria**: ele recebe os gestos por PROP e quem
 * escreve é a tela que o hospeda, pelas portas que já existem. É isso que este teste trava — o
 * dia em que alguém puser um `fetch` de escrita aqui, a central deixa de ser leitura.
 */
describe('⛔ A CENTRAL É LEITURA — quem escreve é o gesto do dono, por prop', () => {
  it('⭐ nenhum POST/PATCH/DELETE nasce dentro do componente', () => {
    const escritas = [...TELA.matchAll(/method:\s*'(POST|PATCH|PUT|DELETE)'/g)].map((m) => m[1])
    expect(escritas, `a central grava por conta própria (${escritas.join(', ')}) — ela é tela de LEITURA`).toEqual([])
  })

  it('⭐ os gestos que ESCREVEM chegam por prop (quem grava é a tela que hospeda)', () => {
    for (const p of ['onImportar', 'onMapearProduto', 'onCriarFichaDeSabor', 'onSubstituirDia']) {
      expect(TELA, `o gesto ${p} deixou de ser prop — a central passaria a decidir a escrita`).toContain(p)
    }
  })
})
