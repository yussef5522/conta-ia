/**
 * ⭐⭐⭐ A REFERÊNCIA VISUAL ENTROU NO REPO — E O GUARD LÊ O ARQUIVO (07/10/2026).
 *
 * **`docs/margem-referencia.html` é a LEI VISUAL da tela `/margem`**, construída e aprovada
 * pelo dono: *"divergência visual da referência = defeito"*. Este guard não descreve o visual
 * em palavras — ele **ABRE o arquivo** e compara token a token, medida a medida, frase a frase.
 *
 * ⚠️⚠️ POR QUE ISSO É A ÚNICA FORMA QUE FUNCIONA: na Conciliação a mesma tela foi refeita
 * TRÊS vezes porque *"enquanto o mock vivia numa pasta de downloads, «igual ao mock» era
 * MEMÓRIA MINHA — e memória é exatamente o que falhou nas duas voltas anteriores"* (10/09).
 * Versionado, o mock é **dado**; e tom ajustado "no olho" fica vermelho apontando o valor que
 * o arquivo manda.
 *
 * ⭐⭐ A ANATOMIA DE CADA ASSERÇÃO DE FRASE É DE DOIS LADOS: a frase tem que existir **na
 * REFERÊNCIA** *e* **no CÓDIGO**. Se eu inventar uma frase, o lado da referência fica
 * vermelho; se o código andar, o lado do código fica vermelho. Uma asserção que só olhasse o
 * código me deixaria escrever qualquer coisa e chamar de "o que o dono aprovou".
 *
 * ⚠️ Estrutural e assumido como tal: o projeto roda em `environment: node`, sem jsdom — não dá
 * pra medir pixel renderizado aqui. O que se trava é o que já mordeu nesta casa: hex cravado,
 * token só no tema claro, medida traduzida de cabeça, peça da referência que sumiu.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { semComentarios, usosDe } from './_leitura-de-fonte'
import { lerReferenciaVisual } from '@/lib/referencias/visual'

const R = (p: string) => resolve(process.cwd(), p)
const ler = (p: string) => readFileSync(p, 'utf8')

/**
 * ⭐⭐ A PORTA ÚNICA DE LEITURA DA REFERÊNCIA — a MESMA que a sonda da prova em prod usa.
 *
 * ⛔ Ela existe porque o guard e a sonda extraíam as medidas com duas cópias do mesmo regex, e
 * na v3.1 eu consertei a do guard e deixei a da sonda atrás: a prova acusou *"FALTAM 1024"*
 * sobre uma tela correta. **Duas réguas pro mesmo arquivo e uma delas mente.**
 */
const REF = lerReferenciaVisual()
import { CARREGADORES_VISIVEIS } from '@/lib/margem/placar'
import { DIFERENCA_MAXIMA_EM_LINHAS, TOPO_DA_COLUNA } from '@/lib/margem/recorte-de-coluna'

const REFERENCIA = REF.html
const CSS_DA_REFERENCIA = REF.css
const SCRIPT_DA_REFERENCIA = REF.script

const TELA = semComentarios(ler(R('app/(dashboard)/empresas/[id]/margem/page.tsx')))
/** ⭐ as frases de dinheiro moram nas LIBS (quem escreve a frase é quem decide o número) */
const LIBS = [
  'lib/margem/placar.ts',
  'lib/margem/cascata.ts',
  'lib/margem/dia.ts',
  'lib/margem/liga.ts',
  'lib/margem/casa.ts',
  'lib/margem/montador.ts',
]
  .map((p) => semComentarios(ler(R(p))))
  .join('\n')
const CODIGO = `${TELA}\n${LIBS}`

/**
 * ⭐ A asserção de DOIS LADOS. `frase` tem que estar na referência E no código.
 *
 * ⚠️ Comparação sem acento e sem caixa: a referência escreve *"O que as vendas deixaram"* e a
 * lib pode escrever o mesmo com outra caixa — o que não pode é a PALAVRA mudar.
 */
const cru = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ')

/**
 * ⭐ fatia o bloco de UM componente da tela — a asserção morde onde a régua vive, em vez de
 * no arquivo inteiro. ⛔ Janela de distância já produziu falso vermelho E falso verde nesta
 * casa (o rastro em 12/09, o menu do PF em 13/09): o que delimita é a função SEGUINTE.
 */
function blocoDa(nome: string): string {
  const i = TELA.indexOf(`function ${nome}(`)
  expect(i, `componente ${nome} não existe na tela`).toBeGreaterThan(-1)
  const resto = TELA.slice(i + 1)
  const j = resto.indexOf('\nfunction ')
  return j === -1 ? resto : resto.slice(0, j)
}

/**
 * ⭐⭐ A LISTA DE RENDER — o JSX que roda quando o payload chega.
 *
 * ⛔ É ELA que o guard dos 6 cartões tem que ler, não o arquivo: a REGRA 11 mostrou que
 * arrancar `<MontadorDePizza />` da lista deixava a suíte VERDE, porque a `function` e todos
 * os textos dela continuavam no arquivo.
 *
 * ⚠️ O fim é o `</>` do fragmento, NUNCA o primeiro `</div>` — com as DUPLAS da v3.1 o
 * primeiro `</div>` é o fechamento de uma `<Duo>`, e cortar ali esconderia metade dos cartões
 * (o guard passaria a aprovar uma tela com 4 dos 6).
 */
function listaDeRender(): string {
  const i = TELA.indexOf("estado === 'OK' && dados && (")
  expect(i, 'a lista de render da tela não foi achada').toBeGreaterThan(-1)
  const fim = TELA.indexOf('</>', i)
  expect(fim, 'a lista de render não fecha com um fragmento').toBeGreaterThan(i)
  return TELA.slice(i, fim)
}

function frase(texto: string) {
  expect(cru(REFERENCIA), `"${texto}" NÃO está na referência — eu inventei a frase`).toContain(
    cru(texto),
  )
  expect(cru(CODIGO), `a referência imprime "${texto}" e o código não`).toContain(cru(texto))
}

/**
 * ⛔⛔⛔ A EXCEÇÃO NOMEADA: frase que vive SÓ NO CÓDIGO, porque a v4 foi construída sobre uma
 * base PRÉ-CASCATA.
 *
 * **MEDIDO (13/10):** a v3.1 versionada tinha a seção `2 · A CASCATA DO MÊS` (11 ocorrências
 * de "cascata"), posta lá pela ordem ESCRITA do dono em 10/10 (*"A CASCATA substitui o placar
 * atual (é ele crescido): 5 cartões em linha"*). A **v4 tem ZERO** e restaura *"O PLACAR DO
 * PERÍODO"* com 3 cartões. Três evidências de que é ARTEFATO e não reversão: a lista de
 * NOVIDADES da v4 tem **4 itens e nenhum é sobre o topo**; as seções 1 e 2 estão marcadas
 * **"INTOCADO na v4"**; e a cascata é decisão posterior, explícita e já em prod.
 *
 * ⭐ Seguir a letra da v4 aqui **desfaria a ordem mais recente do próprio dono**. Então a
 * cascata FICA, e a divergência está DECLARADA — nunca engolida.
 *
 * ⚠️ O `motivo` é parâmetro OBRIGATÓRIO de propósito: sem ele este helper viraria a porta
 * dos fundos pra qualquer frase inventada escapar da asserção de dois lados.
 */
function fraseSoNoCodigo(texto: string, motivo: string) {
  expect(motivo.length, 'exceção sem motivo escrito não existe').toBeGreaterThan(20)
  expect(cru(CODIGO), `o código parou de imprimir "${texto}" (${motivo})`).toContain(cru(texto))
}

/* ═══════════════════════════ 1. OS TOKENS, MAPEADOS 1:1 ═══════════════════════════ */

/**
 * ⭐⭐ O MAPA que o comentário da referência manda fazer: *"onde houver token genérico abaixo,
 * mapear 1:1 para o token da casa"*.
 *
 * ⚠️ O par NÃO é por VALOR HEX — é por PAPEL. `--verde` da referência é #1D9E75 e o
 * `--fam-verde-mid` da casa é #0f9d58: tons diferentes do MESMO verde, e o da casa é o que
 * inverte nos dois temas junto com o resto do sistema. Cravar o hex da referência aqui seria
 * trocar a paleta da casa pela do arquivo de exemplo.
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
  /**
   * ⚠️ O par SÓLIDO nasceu MEDIDO (10/10): branco sobre o `-mid` dá 3,51:1 no verde e 3,91:1 no
   * coral já no tema CLARO — reprova WCAG pra texto normal. O `-solid` inverte o CHÃO por tema
   * mantendo a tinta branca, e é o único chão que o herói da cascata pode ter.
   */
  '--verde-solid': '--fam-verde-solid',
  '--verde-on': '--fam-verde-on',
  '--verde-on-soft': '--fam-verde-on-soft',
  '--coral-solid': '--fam-coral-solid',
  '--coral-on': '--fam-coral-on',
  '--coral-on-soft': '--fam-coral-on-soft',
  '--rosa': '--fam-rosa-mid',
  '--rosa-50': '--fam-rosa-bg',
  '--azul': '--fam-azul-mid',
  '--azul-esc': '--fam-azul-ink',
  '--azul-50': '--fam-azul-bg',
  '--shadow': '--prod-sombra',
}

/**
 * ⚠️ OS DOIS TOKENS QUE A TELA USA E A REFERÊNCIA NÃO TEM, com o motivo:
 * `--prod-acao-bg`/`--prod-acao-ink` são o par "fundo forte / tinta sobre fundo forte" da casa.
 * A referência escreve `#fff` cravado no texto de dentro da fatia e nos botões; a casa tem um
 * token que **inverte** (branco no claro, quase-preto no escuro), e é ele que mantém o número
 * legível dentro da fatia nos dois temas.
 */
const TOKENS_EXTRA_PERMITIDOS = new Set(['--prod-acao-bg', '--prod-acao-ink'])

describe('⛔⛔ OS TOKENS — mapeados 1:1, e nos DOIS temas', () => {
  it('⭐ todo token do `:root{}` da referência tem par declarado no mapa', () => {
    expect(REF.tokens.length, 'o bloco de tokens da referência não foi lido').toBeGreaterThan(20)
    for (const t of REF.tokens) {
      expect(
        MAPA_DE_TOKENS[t],
        `a referência declara ${t} e o mapa 1:1 não diz pra qual token da casa ele vai`,
      ).toBeTruthy()
    }
  })

  it('⛔⛔ cada token da casa no mapa existe nos DOIS mapas do CSS (claro E escuro)', () => {
    const css = ler(R('app/globals.css'))
    /**
     * ⚠️ A régua é a CONTAGEM de declarações, não um fatiamento do arquivo: o `globals.css`
     * tem **dois** blocos `.dark` e vários `:root`, então cortar no primeiro `.dark {` acusa
     * token que está lá (foi o falso vermelho de uma versão anterior deste guard).
     *
     * ⛔ Conferir só a EXISTÊNCIA aprovaria token declarado apenas no claro — e a tela ficaria
     * com o texto de um tema sobre o fundo do outro.
     */
    const vezes = (t: string) => css.split(`${t}:`).length - 1
    for (const casa of new Set(Object.values(MAPA_DE_TOKENS))) {
      expect(vezes(casa), `${casa} precisa dos DOIS mapas (claro e escuro)`).toBeGreaterThanOrEqual(2)
    }
  })

  it('⛔ a tela não pinta por token FORA da paleta da referência', () => {
    const usados = [...new Set((TELA.match(/var\((--[a-z0-9-]+)\)/g) ?? []).map((m) => m.slice(4, -1)))]
    expect(usados.length, 'a tela não está pintando por token').toBeGreaterThan(8)
    const permitidos = new Set([...Object.values(MAPA_DE_TOKENS), ...TOKENS_EXTRA_PERMITIDOS])
    for (const t of usados) {
      // ⚠️ `--fam-${familia}-mid` é montado por TEMPLATE: a família vem do payload, e toda
      // família do mapa da casa é legítima (o `caraDaReceita` é a fonte única)
      if (/^--fam-[a-z]+-(bg|mid|ink)$/.test(t)) continue
      expect(permitidos.has(t), `${t} não está na paleta da referência nem nas exceções`).toBe(true)
    }
  })

  it('⛔⛔ ZERO HEX CRAVADO na tela — a referência tem hex, a tela tem token', () => {
    const hex = TELA.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []
    expect(hex, `cores cravadas: ${hex.join(' ')}`).toHaveLength(0)
  })

  it('⛔⛔ nada de `bg-[var(--x)]/70` — no Tailwind 3 isso sai TRANSPARENTE (05/10)', () => {
    expect(TELA).not.toMatch(/\[var\(--[a-z-]+\)\]\/\d/)
  })
})

/* ═══════════════════════════ 2. AS MEDIDAS, EXTRAÍDAS DO ARQUIVO ═══════════════════════════ */

describe('⛔⛔ AS MEDIDAS SÃO px LITERAL — tradução mental produziu as versões erradas (10/09)', () => {
  it('⭐ toda hierarquia de letra da referência aparece como `text-[Npx]` na tela', () => {
    expect(REF.letras.length, 'os tamanhos de letra da referência não foram lidos').toBeGreaterThan(10)
    const faltando = REF.letras.filter((t) => !TELA.includes(`text-[${t}px]`))
    expect(faltando, `tamanhos da referência que a tela não usa: ${faltando.join(', ')}`).toHaveLength(0)
  })

  it('⭐ toda largura/altura declarada na referência aparece literal na tela', () => {
    // ⚠️ a separação entre BREAKPOINT e medida de ELEMENTO mora no leitor único, com o motivo
    const medidas = REF.medidas
    expect(medidas.length, 'as medidas da referência não foram lidas').toBeGreaterThan(8)
    const faltando = medidas.filter((t) => !TELA.includes(`[${t}px]`))
    expect(faltando, `medidas da referência ausentes da tela: ${faltando.join(', ')}`).toHaveLength(0)
  })

  /* ═══════ A LEI DE LAYOUT (v3.1) — o container e as duplas ═══════ */

  /**
   * ⭐⭐ A LEI, escrita no CSS da própria referência: *"a tela ocupa a largura útil do conteúdo
   * do dashboard (ao lado da sidebar), como as telas profissionais — **NUNCA uma coluna
   * estreita centralizada com vazio dos dois lados**. Teto 1440px só pra monitores gigantes."*
   */
  it('⛔⛔ O CONTAINER: teto 1440px e o padding do arquivo — a coluna de 860px MORREU', () => {
    expect(CSS_DA_REFERENCIA).toContain('max-width:1440px')
    expect(CSS_DA_REFERENCIA).toContain('padding:22px 28px 64px')
    expect(CSS_DA_REFERENCIA).toContain('padding:16px 14px 56px')
    // ⛔ a lei em palavras tem que continuar no arquivo: se ela sair, a régua perdeu o dono
    expect(CSS_DA_REFERENCIA).toContain('LEI DE LAYOUT')

    expect(TELA).toContain('max-w-[1440px]')
    // ⛔⛔ a coluna estreita centralizada não pode voltar — foi o que o dono mandou matar
    expect(TELA, 'a coluna de 860px voltou — é exatamente o que a v3.1 mata').not.toContain('max-w-[860px]')
    // ⚠️ os 4 números do padding, LITERAIS (o 10/09: o número que está no arquivo, escrito igual)
    for (const n of ['22px', '28px', '64px', '16px', '14px', '56px']) {
      expect(TELA, `o padding do container precisa do ${n} literal`).toContain(`[${n}]`)
    }
  })

  it('⛔⛔ AS DUPLAS: (quem carregou | a liga) e (montador | fila) lado a lado em ≥1024px', () => {
    // ⭐ a referência declara a dupla no CSS e a usa DUAS vezes no HTML
    expect(CSS_DA_REFERENCIA).toContain('grid-template-columns:1fr 1fr')
    expect(CSS_DA_REFERENCIA).toContain('align-items:start')
    expect([...REFERENCIA.matchAll(/class="duo"/g)], 'a referência tem DUAS duplas').toHaveLength(2)

    const render = listaDeRender()
    expect([...render.matchAll(/<Duo>/g)], 'a tela precisa das DUAS duplas').toHaveLength(2)
    // ⭐ e cada dupla carrega o PAR que o arquivo nomeia, nessa ordem
    expect(render).toMatch(/<Duo>[\s\S]*?QuemCarregouACasa[\s\S]*?LigaCard[\s\S]*?<\/Duo>/)
    /**
     * ⭐⭐ REAPONTADO (v4, 13/10): a 2ª dupla é **montador | escolha um produto**.
     *
     * ⛔ Antes era `montador | fila de sabores` — e era exatamente isso que produzia o vazio
     * da esquerda: a fila é uma faixa de CHIPS, que nunca enche uma coluna, então sobrava
     * buraco comprido ao lado do montador. A v4 diz, com estas palavras: *"É esta dupla que
     * mata o vazio da esquerda"*.
     */
    expect(render).toMatch(/<Duo>[\s\S]*?MontadorDePizza[\s\S]*?EscolhaUmProduto[\s\S]*?<\/Duo>/)
    expect(render, 'a fila NÃO pode voltar pra dentro de uma dupla').not.toMatch(
      /<Duo>[\s\S]*?FilaDeSabores[\s\S]*?<\/Duo>/,
    )

    const duo = blocoDa('Duo')
    expect(duo).toContain('lg:grid-cols-2')
    expect(duo).toContain('lg:items-start')
    expect(duo).toContain('lg:gap-[14px]')
    /**
     * ⛔ `.duo .card{margin-bottom:0}` — a referência zera a margem do cartão DENTRO da dupla,
     * senão a coluna mais curta empurra a linha seguinte. ⭐ Aqui isso mora num lugar só (a
     * própria dupla, por seletor de filho), e não como uma prop que cada chamador tem que
     * lembrar de passar: **disciplina virada impossibilidade** (REGRA 5).
     */
    expect(CSS_DA_REFERENCIA).toContain('.duo .card{margin-bottom:0}')
    expect(duo).toMatch(/lg:\[&>section\]:mb-0/)
  })

  it('⭐ os BREAKPOINTS do arquivo estão expressos na tela — alias ou literal', () => {
    /**
     * ⚠️ O Tailwind já tem apelido pros cortes padrão (`sm:`=640, `lg:`=1024). Pros cortes que
     * o dono escolheu fora da escala (700 e 560) o número vai LITERAL, como o arquivo escreve.
     */
    const ALIAS: Record<string, string> = { '640': 'sm:', '768': 'md:', '1024': 'lg:', '1280': 'xl:' }
    const cortes = REF.cortes
    expect(cortes.length, 'os breakpoints da referência não foram lidos').toBeGreaterThan(2)
    for (const c of cortes) {
      const ok = ALIAS[c] ? TELA.includes(ALIAS[c]) : TELA.includes(`[${c}px]`)
      expect(ok, `o corte de ${c}px da referência não aparece na tela`).toBe(true)
    }
  })

  it('⛔ o respiro de 18px do cartão e o 9px das linhas são literais', () => {
    expect(CSS_DA_REFERENCIA).toContain('padding:9px 18px')
    expect(TELA).toContain('px-[18px]')
    expect(TELA).toContain('py-[9px]')
  })
})

/* ═══════════════════════════ 3. OS 6 CARTÕES, NA ORDEM ═══════════════════════════ */

describe('⛔⛔⛔ OS 6 CARTÕES DA REFERÊNCIA — RENDERIZADOS e NA ORDEM', () => {
  /**
   * ⚠️⚠️ ESTE BLOCO FOI APERTADO PELA REGRA 11, e o furo é a "menção, não uso" de novo: a 1ª
   * versão procurava as âncoras **no arquivo inteiro**. Repondo o defeito — arrancar
   * `<MontadorDePizza />` da lista de render — a suíte ficou **VERDE**, porque a `function
   * MontadorDePizza` e todos os textos dela continuavam no arquivo. Trocar a ORDEM de dois
   * cartões também passou, pela mesma razão. ***Guard que lê o arquivo aprova o componente
   * que ninguém desenha.***
   *
   * ⭐ O que morde é ler a **LISTA DE RENDER** (o JSX que roda quando o payload chega) e
   * exigir ali os 6, na ordem do arquivo do dono.
   */
  /**
   * ⚠️ `naTela` existe SÓ pra a seção 2, e é a declaração da divergência: a v4 escreve
   * *"O placar de"* ali (ela é pré-cascata) e o componente imprime *"em cascata"*. A **lei de
   * ORDEM continua inteira** — a seção 2 é a do resultado do período, e é a cascata que mora
   * nela. O que não se exige é que o dono reescreva o arquivo dele pra o guard ficar verde.
   */
  const ANCORAS: { texto: string; componente: string; naTela?: string }[] = [
    { texto: 'A LINHA DE CHEGADA', componente: 'LinhaDeChegadaCard' },
    { texto: 'O placar de', componente: 'CascataDoMes', naTela: 'em cascata' },
    { texto: 'Quem carregou a casa', componente: 'QuemCarregouACasa' },
    { texto: 'A liga do', componente: 'LigaCard' },
    { texto: 'Monte uma pizza e veja o custo', componente: 'MontadorDePizza' },
    { texto: 'sabores vendidos sem ficha', componente: 'FilaDeSabores' },
  ]

  const render = listaDeRender()

  it('⭐ as 6 âncoras existem na REFERÊNCIA (senão a lista está errada, não a tela)', () => {
    for (const a of ANCORAS) expect(cru(REFERENCIA), `âncora "${a.texto}"`).toContain(cru(a.texto))
  })

  it('⭐⭐ cada cartão DESENHA o título que a referência manda', () => {
    for (const a of ANCORAS) {
      const esperado = a.naTela ?? a.texto
      expect(
        cru(blocoDa(a.componente)),
        `o cartão ${a.componente} não imprime "${esperado}"`,
      ).toContain(cru(esperado))
    }
  })

  it('⛔⛔ os 6 estão na LISTA DE RENDER — componente definido e não desenhado é o mesmo que ausente', () => {
    for (const a of ANCORAS) {
      expect(
        render,
        `<${a.componente} /> não é desenhado — ele existe no arquivo e ninguém o renderiza`,
      ).toContain(`<${a.componente}`)
    }
  })

  it('⛔⛔ a ORDEM de render é a ORDEM da referência', () => {
    const pos = ANCORAS.map((a) => render.indexOf(`<${a.componente}`))
    for (let i = 1; i < pos.length; i++) {
      expect(
        pos[i],
        `<${ANCORAS[i].componente}> é desenhado ANTES de <${ANCORAS[i - 1].componente}> — a ordem da referência é outra`,
      ).toBeGreaterThan(pos[i - 1])
    }
  })

  it('⭐ a ordem das SEÇÕES na referência é a mesma que a lista acima declara', () => {
    // ⚠️ a referência numera as seções nos comentários — é dali que a ordem sai, não da minha
    // memória: se o dono reordenar o arquivo, ESTE teste fica vermelho antes de todos os outros
    const naReferencia = ANCORAS.map((a) => cru(REFERENCIA).indexOf(cru(a.texto)))
    for (let i = 1; i < naReferencia.length; i++) {
      expect(
        naReferencia[i],
        `a referência põe "${ANCORAS[i].texto}" antes de "${ANCORAS[i - 1].texto}" — a lista do guard está desatualizada`,
      ).toBeGreaterThan(naReferencia[i - 1])
    }
  })

  it('⭐ a fila tem a ÂNCORA `#fila` e o rodapé de "quem carregou" LEVA nela', () => {
    expect(REFERENCIA).toContain('id="fila"')
    expect(REFERENCIA).toContain('href="#fila"')
    expect(blocoDa('FilaDeSabores')).toContain('id="fila"')
    expect(blocoDa('QuemCarregouACasa')).toContain('href="#fila"')
  })
})

/* ═══════════════ 3b. A CASCATA NA TELA — o chão, o grito e o % gigante ═══════════════ */

describe('⛔⛔⛔ A CASCATA — as travas que o dono pediu por escrito (10/10)', () => {
  const bloco = () => blocoDa('CartaoDaCascataNaTela')

  /**
   * ⛔⛔ O CHÃO DO HERÓI É O `-solid`, NUNCA o `-mid` — e isso foi MEDIDO em 10/10: branco
   * sobre o `-mid` dá **3,51:1 no verde e 3,91:1 no coral já no tema CLARO**, reprovando WCAG
   * pra texto normal (a etiqueta de 11,5px e a sub vivem no mesmo chão). O contraste dos 4
   * cartões × 2 temas é provado em `dois-temas-na-raiz.test.ts`.
   */
  it('⛔⛔ o cartão sólido pinta o chão com `-solid`, nunca com `-mid` nem pastel', () => {
    const b = bloco()
    expect(b, 'o chão sólido do herói').toContain('-solid)')
    expect(b, 'a tinta sobre fundo forte').toContain('-on)')
    /**
     * ⚠️ A ASSERÇÃO OLHA O **CHÃO**, não o arquivo: proibir `-mid` em qualquer lugar do cartão
     * daria falso vermelho na ressalva, que é TEXTO índigo sobre a superfície clara (o
     * `--indigo` que a própria referência manda). O que reprova WCAG é branco sobre `-mid`
     * **como fundo** — então a régua morde na declaração do `fundo`.
     */
    const chao = b.slice(b.indexOf('const fundo'), b.indexOf('const tintaForte'))
    expect(chao.length, 'a declaração do chão do cartão não foi achada').toBeGreaterThan(20)
    expect(chao, 'o -mid como CHÃO não passa em contraste com branco').not.toMatch(/-mid\)/)
    expect(chao, 'o chão do herói é o degrau sólido').toContain('-solid)')
  })

  it('⭐ o número do herói é 26px e o dos outros 22px — o pedido do dono (22px+)', () => {
    const b = bloco()
    expect(b).toContain('text-[26px]')
    expect(b).toContain('text-[22px]')
    expect(b).toContain('tabular-nums')
  })

  /**
   * ⛔⛔ O CENTAVO VIVE NO TOOLTIP, o número é REDONDO ao real — a régua de 10/10, pela MESMA
   * `valorDoCartao` dos cartões de Custos Fixos (régua própria aqui faria duas telas
   * arredondarem diferente).
   */
  it('⛔ o número é redondo e o centavo vai pro tooltip (`valorDoCartao`)', () => {
    const b = bloco()
    expect(usosDe(b, 'valorDoCartao'), 'a régua do número redondo').toBeGreaterThan(0)
    expect(b, 'formatBRL no cartão traria os centavos de volta').not.toContain('formatBRL(')
    expect(b).toContain('v.cheio')
  })

  it('⭐⭐ o % GIGANTE do CMV fica EMBAIXO do valor, 17px/700', () => {
    const b = bloco()
    const iVal = b.indexOf('text-[22px]')
    const iPct = b.indexOf('text-[17px]')
    expect(iPct, 'o % do CMV não está na tela').toBeGreaterThan(-1)
    expect(iPct, 'o % tem que vir DEPOIS do valor — é ele que o qualifica').toBeGreaterThan(iVal)
    expect(b).toContain('pctDasVendas')
  })

  /**
   * ⛔⛔ A TELA GRITA QUANDO A CADEIA NÃO FECHA. *Número de dinheiro que não fecha com as
   * partes* é a família do cabeçalho que afirmava 69 duplicatas com a aba dizendo 0 — o
   * invariante tem que ser VISÍVEL, não só verde no CI.
   */
  it('⛔⛔ a tela DESENHA o aviso quando `fecha` é false', () => {
    const b = blocoDa('CascataDoMes')
    expect(b, 'o guard da cadeia não aparece na tela').toContain('!casc.fecha')
    expect(cru(b)).toContain(cru('a cascata não fecha'))
  })

  /**
   * ⛔ A TELA NÃO CALCULA DINHEIRO — ela desenha o que `montarCascata` assinou. Uma régua
   * própria aqui faria a tela e o teste discordarem no 1º caso de borda.
   */
  it('⛔⛔ a cascata da tela não faz aritmética de dinheiro por conta própria', () => {
    const b = blocoDa('CascataDoMes')
    const corpo = b.slice(b.indexOf('{'), b.indexOf('return ('))
    expect(corpo, 'a tela voltou a somar/subtrair dinheiro').not.toMatch(/\b(reduce|[-+*/]=)\b/)
    expect(usosDe(b, 'montarCascata'), 'a tela consome a lib única').toBeGreaterThan(0)
  })

  it('⭐ a barra de composição e a legenda dos 3 pedaços são desenhadas', () => {
    const b = blocoDa('CascataDoMes')
    expect(b).toContain('casc.composicao')
    expect(b).toContain('legenda.cmv')
    expect(b).toContain('legenda.casa')
    expect(b).toContain('legenda.lucro')
    // ⛔ com prejuízo não há verde: o selo coral carrega o que falta
    expect(b).toContain('faltam')
  })

  /**
   * ⛔⛔ O ⓘ ABRE POR TOQUE (`<details>`), NUNCA por hover — **tooltip não existe no celular**,
   * e é lá que o dono opera (a cicatriz de 30/08).
   */
  it('⛔⛔ o ⓘ da honestidade é `<details>`, não `title`', () => {
    const b = blocoDa('CascataDoMes')
    expect(b).toContain('<details')
    expect(b).toContain('<summary')
    expect(b).toContain('honestidade.explicacoes')
  })

  /**
   * ⭐⭐ A LINHA DA COBERTURA (o 🏁 do dia D e o limiar de 80%) NÃO SE PERDEU: ela virou o que
   * o ⓘ abre, em vez de uma 2ª linha repetindo o percentual. É a régua de 07/10, e
   * `linhaDaCobertura` continua viva com os testes dela.
   */
  it('⛔ a linha da cobertura segue DESENHADA — dentro do ⓘ', () => {
    expect(usosDe(blocoDa('CascataDoMes'), 'linhaDaCobertura')).toBeGreaterThan(0)
  })

  /** ⛔ a ressalva do veredito viaja com o HERÓI — o veredito nunca vem seco (guard de v1) */
  it('⛔⛔ a ressalva do veredito chega no cartão do lucro', () => {
    const b = blocoDa('CascataDoMes')
    expect(b).toContain('veredito.ressalva')
    expect(bloco(), 'o cartão tem que desenhar a ressalva').toContain('ressalva')
  })
})

/* ═══════════════════════════ 4. AS FRASES QUE O ARQUIVO IMPRIME ═══════════════════════════ */

describe('⛔ AS FRASES DA REFERÊNCIA — as duas pontas conferidas', () => {
  it('⭐ cabeçalho e linha de chegada', () => {
    frase('Quem paga a casa')
    frase('A LINHA DE CHEGADA')
    frase('pagou a casa do dia e ainda sobrou')
    frase('casa do dia')
    frase('sobra do dia')
    frase('daqui pra frente cada venda é lucro')
    frase('é o último dia fechado — o relatório de hoje entra na madrugada')
  })

  /**
   * ⚠️⚠️ ESTE BLOCO FOI REAPONTADO EM 10/10, NÃO AFROUXADO. As 5 frases do placar de 3 cartões
   * (*"O placar de"*, *"O que as vendas deixaram"*, *"A casa custou até aqui"*, *"✓ CASA PAGA —
   * e sobrou"*, *"pra pagar a casa do período"*) foram **substituídas pela cascata** por ordem
   * escrita do dono — elas não podem mais estar na referência nem no código, e há um teste
   * abaixo afirmando essa AUSÊNCIA (senão o placar antigo voltaria sem ninguém ver).
   */
  it('⭐⭐ a cascata — os 5 cartões com o operador que faz os números lerem como uma CONTA', () => {
    fraseSoNoCodigo('em cascata', 'a v4 foi construída sobre base PRÉ-CASCATA; a cascata é ordem escrita do dono de 10/10 e já está em prod')
    frase('custo fixo:')
    fraseSoNoCodigo('Vendeu', 'a v4 foi construída sobre base PRÉ-CASCATA; a cascata é ordem escrita do dono de 10/10 e já está em prod')
    fraseSoNoCodigo('CMV (insumos)', 'a v4 foi construída sobre base PRÉ-CASCATA; a cascata é ordem escrita do dono de 10/10 e já está em prod')
    frase('Sobra')
    frase('A casa')
    frase('Lucro')
    frase('Faltam')
    frase('das vendas')
    fraseSoNoCodigo('o que saiu da prateleira', 'a v4 foi construída sobre base PRÉ-CASCATA; a cascata é ordem escrita do dono de 10/10 e já está em prod')
    frase('daqui pra frente é lucro')
  })

  it('⭐ a barra de composição — de cada R$ 100 vendidos, os três pedaços', () => {
    fraseSoNoCodigo('de cada R$ 100 vendidos', 'a v4 foi construída sobre base PRÉ-CASCATA; a cascata é ordem escrita do dono de 10/10 e já está em prod')
    frase('CMV')
    frase('casa')
    frase('lucro')
  })

  it('⭐⭐ a honestidade numa linha — e a régua do setor', () => {
    fraseSoNoCodigo('medido em', 'a v4 foi construída sobre base PRÉ-CASCATA; a cascata é ordem escrita do dono de 10/10 e já está em prod')
    fraseSoNoCodigo('vendas totais', 'a v4 foi construída sobre base PRÉ-CASCATA; a cascata é ordem escrita do dono de 10/10 e já está em prod')
    fraseSoNoCodigo('CMV por compra (notas)', 'a v4 foi construída sobre base PRÉ-CASCATA; a cascata é ordem escrita do dono de 10/10 e já está em prod')
    fraseSoNoCodigo('detalhes', 'a v4 foi construída sobre base PRÉ-CASCATA; a cascata é ordem escrita do dono de 10/10 e já está em prod')
    /**
     * ⚠️ A ASSERÇÃO CASA A PARTE FIXA, NÃO OS NÚMEROS — e isso é MAIS forte, não mais frouxo:
     * a faixa é montada por template a partir de `CMV_SAUDAVEL`, então exigir
     * *"CMV 28–35%"* contíguo no código obrigaria a tela a DIGITAR o número, que é
     * exatamente o que `cascata.test.ts` proíbe (*"a régua do setor vem da CONSTANTE"* — a
     * cicatriz do `TETO = 25` hardcoded). Frase montada por template nunca é contígua.
     */
    fraseSoNoCodigo('pizzaria/lanchonete saudável: CMV', 'a v4 foi construída sobre base PRÉ-CASCATA; a cascata é ordem escrita do dono de 10/10 e já está em prod')
    frase('das vendas')
    /**
     * ⚠️ REAPONTADO (13/10): a faixa do setor também saiu da v4 (base pré-cascata). A régua
     * NÃO ficou sem guard — quem trava que o número vem da CONSTANTE (e não digitado na tela)
     * é `cascata.test.ts`, que é onde ela sempre morou. Aqui ficaria a 2ª cópia da mesma
     * afirmação, agora contra um arquivo que não a tem.
     */
    expect(cru(CODIGO), 'a faixa do setor saiu do código').toContain('saudavel: cmv')
  })

  /**
   * ⛔⛔ O VERMELHO QUE O DONO PEDIU: *"placar antigo de volta = vermelho"*. Sem isto, as 3
   * frases de cima poderiam conviver com o placar de 3 cartões na mesma tela — duas
   * apresentações do mesmo dinheiro, que é a doença que esta casa mais paga.
   */
  it('⛔⛔ o PLACAR de 3 cartões MORREU — no CÓDIGO (a referência v4 é pré-cascata)', () => {
    for (const morta of [
      'O que as vendas deixaram',
      'A casa custou até aqui',
      'CASA PAGA — e sobrou',
      'pra pagar a casa do período',
      'a casa se enchendo',
      'a bandeira é 100% = casa paga',
    ]) {
      // ⚠️ REAPONTADO (13/10): a ausência vale no CÓDIGO, não na referência. A v4 restaurou
      //    essas frases porque nasceu de base pré-cascata (ver `fraseSoNoCodigo`) — exigir a
      //    ausência nela seria o guard cobrando que o dono reescrevesse o arquivo dele.
      //    ⭐ A METADE QUE IMPORTA continua mordendo: duas apresentações do mesmo dinheiro no
      //    CÓDIGO é o que a casa paga caro, e é isso que fica travado.
      expect(cru(CODIGO), `a frase do placar antigo voltou pro código: "${morta}"`).not.toContain(cru(morta))
    }
    expect(TELA, 'o componente PlacarDaCasa voltou').not.toContain('function PlacarDaCasa')
    expect(listaDeRender(), 'o PlacarDaCasa voltou pra lista de render').not.toContain('<PlacarDaCasa')
  })

  it('⛔⛔ a LINHA DA COBERTURA — é ela que impede o veredito de ficar seco', () => {
    frase('cobertura:')
    frase('das unidades vendidas têm custo')
    frase('na obra')
    frase('acima de')
    frase('eu digo')
    frase('o dia em que a casa se pagou')
  })

  it('⭐ quem carregou a casa', () => {
    frase('Quem carregou a casa')
    frase('% = quanto da casa cada um pagou · toque abre a ficha')
    frase('ver todos')
    frase('fora da obra')
    frase('vendem e o custo é desconhecido')
    frase('sabores sem ficha')
    frase('criar fichas sobe a cobertura')
  })

  it('⭐ a liga', () => {
    frase('A liga do')
    frase('selo = veredito · tudo clicável → ficha')
    frase('encheu o caixa')
    frase('melhor margem')
    frase('mais vendidos')
    frase('os selos cortam pela MEDIANA do período')
  })

  it('⭐ o montador', () => {
    frase('Monte uma pizza e veja o custo')
    frase('só simula — nada grava, nada baixa')
    frase('custo da pizza')
    frase('vendendo a')
    frase('sobra')
    frase('1 ocorrência')
    frase('sabor — escolher')
    frase('sem ficha — tocar cria')
    frase('toque e escolha')
    frase('a definir')
    frase('escolher o sabor da fatia')
    frase('com ficha primeiro; âmbar = sem ficha, tocar cria')
    frase('sem ficha ⚠')
  })

  it('⭐ a fila dos sabores', () => {
    frase('sabores vendidos sem ficha')
    frase('cada ficha criada entra na obra e a cobertura sobe · maior volume primeiro')
    frase('e mais')
  })
})

/* ═════════════════ 5. O COMPORTAMENTO: o `<script>` É a especificação ═════════════════ */

describe('⛔⛔ O MONTADOR — o `<script>` da referência é o contrato', () => {
  it('⭐ trocar o tamanho REDESENHA N fatias (e reseta as escolhas)', () => {
    // na referência: `fat=Array(TAMANHOS[tam].fatias).fill(null)` no clique do chip
    expect(SCRIPT_DA_REFERENCIA).toMatch(/fat=Array\(TAMANHOS\[tam\]\.fatias\)\.fill\(null\)/)
    expect(TELA).toMatch(/function trocarTamanho[\s\S]{0,400}setEscolhas\(/)
    expect(TELA).toMatch(/length: Math\.max\(0, t\.sabores\)/)
  })

  it('⭐ precinho DERIVA do tamanho — a tela DIZ de quem veio', () => {
    expect(REFERENCIA).toContain('DERIVADO de grande')
    expect(TELA).toContain('derivadoDe')
    expect(cru(TELA)).toContain(cru('precinho segue o tamanho'))
  })

  it('⭐ clicar na fatia abre a lista de sabores', () => {
    expect(SCRIPT_DA_REFERENCIA).toContain(".fatia'")
    expect(SCRIPT_DA_REFERENCIA).toContain('abreLista()')
    expect(TELA).toMatch(/onClick=\{\(\) => aoTocar\(f\.indice\)\}/)
    expect(TELA).toMatch(/fatiaAberta != null/)
  })

  it('⭐⭐ a conta é base + Σ(1 ocorrência × ficha) — SEM fator por tamanho', () => {
    // na referência: `let total=t.base` e `total+=s.custo` por fatia — nenhuma divisão
    expect(SCRIPT_DA_REFERENCIA).toContain('let total=t.base')
    expect(SCRIPT_DA_REFERENCIA).toContain('total+=s.custo')
    expect(SCRIPT_DA_REFERENCIA).not.toMatch(/\/\s*t\.fatias/)
    // ⛔ na tela a conta é a lib PURA, e dividir por fatia ressuscitaria o fator morto em 07/10
    const bloco = blocoDa('MontadorDePizza')
    expect(usosDe(bloco, 'montarPizza')).toBeGreaterThan(0)
    expect(bloco).not.toMatch(/\/ (n|fatias\.length|pizza\.fatias\.length)/)
  })

  it('⭐ o preço é EDITÁVEL e recalcula a sobra por canal', () => {
    expect(SCRIPT_DA_REFERENCIA).toContain('preco-input')
    expect(SCRIPT_DA_REFERENCIA).toMatch(/inp\.onchange/)
    expect(TELA).toContain('w-[92px]')
    expect(usosDe(TELA, 'CampoDePreco')).toBeGreaterThan(1)
    // ⛔ sanitizador da casa: digitar vírgula não pode zerar o número (a cicatriz de 28/08)
    expect(TELA).toContain('sanitizarQtd')
    expect(TELA).toContain('valorQtd')
    expect(TELA).toContain('inputMode="decimal"')
  })

  it('⛔⛔ a referência SIMULA e nada grava — o único POST da seção é o da CONFIG', () => {
    expect(cru(REFERENCIA)).toContain(cru('só simula — nada grava, nada baixa'))
    const bloco = blocoDa('MontadorDePizza')
    const posts = [...TELA.matchAll(/method: 'POST'/g)]
    expect(posts, 'um POST a mais aqui é uma gravação de pizza').toHaveLength(1)
    expect(bloco).toContain("acao: 'SEMEAR'")
    expect(bloco).toContain('margem/config')
    /**
     * ⚠️ A RÉGUA É O CAMINHO DE ROTA, não a palavra: a própria dica do cartão diz *"nada
     * grava, nada **baixa**"* (texto da referência), e um regex por palavra reprovaria a
     * frase honesta. O que não pode existir é um `fetch` pra uma rota que MEXE em estoque.
     */
    expect(bloco).not.toMatch(/\/(vendas|baixa|baixar|movimentos|processar)\b/)
  })

  it('⛔ a taxa do iFood vem da CONFIG de canais, nunca digitada na tela', () => {
    expect(SCRIPT_DA_REFERENCIA).toContain('TAXA_IFOOD=0.20')
    // ⛔ na tela o 0,2 não existe: ele vem do canal (`taxaPct`), editável com rastro
    expect(TELA).toContain('cn.taxaPct')
    expect(TELA).not.toMatch(/0\.2\b/)
  })
})

/* ═════════════════ 6. AS DIVERGÊNCIAS DELIBERADAS, DECLARADAS ═════════════════ */

describe('⚠️⚠️ AS DUAS DIVERGÊNCIAS DELIBERADAS — declaradas, não escondidas', () => {
  it('⛔ o botão de tema da referência NÃO vem pra prod (a casa já tem o dela)', () => {
    // a referência tem o botão pra rodar sozinha no navegador
    expect(REFERENCIA).toContain('theme-btn')
    // ⛔ duas portas pra a mesma decisão: o tema da casa mora no `globals.css`
    expect(TELA).not.toContain('theme-btn')
    expect(TELA).not.toContain("dataset.theme")
    // ⭐ e o motivo está escrito no arquivo da tela (sem comentário o guard não o veria)
    expect(ler(R('app/(dashboard)/empresas/[id]/margem/page.tsx'))).toContain(
      'duas portas pra a mesma decisão',
    )
  })

  it('⭐ o aviso de relatório incompleto FICA, condicional — a referência mostra o estado normal', () => {
    expect(REFERENCIA).not.toContain('relatório de complementos possivelmente incompleto')
    expect(TELA).toContain('relatório de complementos possivelmente incompleto')
    expect(TELA).toContain('diasComRelatorioSuspeito.length > 0')
  })
})

/* ═════════════════ 7. AUTO-TESTE DO DETECTOR (senão ele passa por cegueira) ═════════════════ */

describe('⭐ AUTO-TESTE DO LEITOR — a régua única não pode voltar a confundir as coisas', () => {
  /**
   * ⛔⛔ ESTE BLOCO NASCEU DO VERMELHO REAL DA v3.1: a sonda da prova em prod acusou *"FALTAM
   * 1024"* sobre uma tela CORRETA, porque ela tinha a própria cópia do regex e o
   * `min-width:1024px` do `@media` entrava como se fosse largura de ELEMENTO. Agora a leitura
   * tem um dono só — e é aqui que ela prova que separa as duas coisas.
   */
  it('⛔⛔ BREAKPOINT não é medida de ELEMENTO, e vice-versa', () => {
    // 1024 e 700 são CORTES (vivem dentro de `@media (...)`)
    expect(REF.cortes).toContain('1024')
    expect(REF.cortes).toContain('700')
    expect(REF.medidas, 'o corte do @media entrou como largura de elemento').not.toContain('1024')
    expect(REF.medidas).not.toContain('700')
    // 170 (a pizza) e 132 (a coluna do valor) são MEDIDAS de elemento
    expect(REF.medidas).toContain('170')
    expect(REF.medidas).toContain('132')
    expect(REF.cortes).not.toContain('170')
  })

  it('⛔ o teto do container NÃO é medida de elemento (`max-width` fica de fora)', () => {
    expect(REF.css).toContain('max-width:1440px')
    expect(REF.medidas, 'o max-width do container entrou como largura de elemento').not.toContain('1440')
  })

  it('⭐ o leitor devolve as 4 listas cheias — arquivo mudo seria falso verde pra tudo', () => {
    expect(REF.tokens.length).toBeGreaterThan(20)
    expect(REF.letras.length).toBeGreaterThan(10)
    expect(REF.medidas.length).toBeGreaterThan(8)
    expect(REF.cortes.length).toBeGreaterThan(2)
    expect(REF.script).toContain('TAMANHOS')
    expect(REF.css).toContain('LEI DE LAYOUT')
  })
})

describe('⭐ AUTO-TESTE — o detector morde de verdade', () => {
  it('⛔ a asserção de dois lados reprova frase que não está na referência', () => {
    expect(() => frase('esta frase não existe em lugar nenhum')).toThrow()
  })

  it('⛔ a asserção de dois lados reprova frase da referência ausente do código', () => {
    // ⚠️ a referência imprime os NOMES de exemplo; eles NÃO podem estar no código (seriam
    // dado inventado) — então esta é uma frase que existe num lado só, de propósito
    expect(cru(REFERENCIA)).toContain(cru('Combo Caçula'))
    expect(() => frase('Combo Caçula')).toThrow()
  })

  it('⛔ o detector de hex acha hex de verdade', () => {
    expect('cor: #534AB7'.match(/#[0-9a-fA-F]{3,8}\b/g)).toHaveLength(1)
  })
})

/* ═══════════════ AS 4 NOVIDADES DA v4 — conferidas CONTRA O ARQUIVO ═══════════════ */

describe('⭐⭐⭐ v4 · AS 4 NOVIDADES QUE O DONO APROVOU', () => {
  it('⭐ a referência DECLARA as 4 novidades — se a lista mudar, é aqui que fica vermelho', () => {
    const n = cru(REFERENCIA)
    expect(n, 'novidade 1: a lei das colunas').toContain('lei das colunas')
    expect(n, 'novidade 2: o montador ganha cmv').toContain('o montador de pizza ganha cmv')
    expect(n, 'novidade 3: o cartão de produto').toContain('escolha um produto e veja o preco ideal')
    expect(n, 'novidade 4: a fila em largura cheia').toContain('largura cheia')
  })

  describe('⛔⛔ 1 · A LEI DAS COLUNAS', () => {
    it('o TETO é o que a referência escreve, e ele tem UM dono no código', () => {
      expect(cru(REFERENCIA), 'a referência manda TOP 10').toContain('top 10')
      expect(TOPO_DA_COLUNA, 'o teto do código tem que ser o da referência').toBe(10)
      // ⛔ e é o MESMO das duas colunas da dupla — dois tetos são a coluna fantasma esperando
      expect(CARREGADORES_VISIVEIS).toBe(TOPO_DA_COLUNA)
    })

    it('⛔ "ver todos" expande AQUI MESMO e o 2º toque RECOLHE', () => {
      expect(cru(REFERENCIA)).toContain('ver todos os')
      expect(cru(REFERENCIA), 'o rótulo do estado aberto').toContain('mostrar so o top 10')
      const liga = blocoDa('LigaCard')
      expect(liga, 'o rótulo vem da lib, nunca digitado na tela').toContain('recorte.rotuloDoBotao')
      expect(liga, 'o toque alterna — expandir sem recolher é meia-porta').toContain('setAbertaALiga((v) => !v)')
      expect(liga, 'e o estado é dito pra quem usa leitor de tela').toContain('aria-expanded')
      expect(liga, 'navegar em vez de expandir perderia o lugar do dono').not.toMatch(
        /rotuloDoBotao[\s\S]{0,400}href=/,
      )
    })

    it('⛔ a liga NASCE RECOLHIDA — nascer aberta É a lista de 50 rolando na coluna', () => {
      expect(cru(REFERENCIA)).toContain('estado inicial: sempre recolhido')
      expect(blocoDa('LigaCard')).toContain('useState(false)')
    })

    it('⛔ a liga desenha o RECORTE, nunca `l.linhas` inteiro', () => {
      const liga = blocoDa('LigaCard')
      expect(liga).toContain('recorte.visiveis.map')
      expect(liga, 'mapear a lista inteira é a lei das colunas quebrada').not.toContain('l.linhas.map')
    })

    it('⭐ a tolerância da coluna fantasma é a da referência (~140px)', () => {
      expect(cru(REFERENCIA)).toContain('coluna fantasma')
      expect(cru(REFERENCIA)).toContain('140px')
      expect(DIFERENCA_MAXIMA_EM_LINHAS, '~140px ÷ ~38px por linha').toBe(3)
    })
  })

  describe('⛔⛔ 2 · O MONTADOR GANHOU CMV', () => {
    const mont = () => blocoDa('MontadorDePizza')

    it('o FAROL nasce COLADO na linha do preço', () => {
      expect(cru(REFERENCIA)).toContain('o farol nasce colado na linha do preco')
      expect(mont()).toContain('<PilulaDoFarol farol={blocoDoVeredito.farol}')
    })

    it('⛔ fatia pendente → farol NEUTRO "fecha a pizza", nunca número parcial', () => {
      expect(cru(REFERENCIA)).toContain('fecha a pizza')
      expect(mont()).toContain("motivoNeutro: pizza && pizza.custoTotal == null ? 'fecha a pizza' : undefined")
    })

    it('⭐ o preço ideal NASCE EMBAIXO, e é o MESMO componente do cartão de produto', () => {
      const render = mont()
      expect(render).toContain('<BlocoDoPrecoIdeal')
      // ⛔⛔ a porta única: os DOIS cartões desenham o MESMO bloco
      expect(blocoDa('EscolhaUmProduto')).toContain('<BlocoDoPrecoIdeal')
    })

    it('⛔ O QUE EXISTIA NÃO MUDOU — tamanhos, fatias clicáveis, "vendendo a" e as 3 sobras', () => {
      const m = mont()
      expect(m, 'os chips de tamanho').toContain('cat.tamanhos.map')
      expect(m, 'a fatia clicável').toContain('setFatiaAberta')
      expect(m, 'o campo de preço').toContain('<CampoDePreco')
      expect(m, 'as sobras por canal').toContain('pizza.canais.map')
      expect(m, 'o breakdown do custo').toContain('custo da pizza')
    })
  })

  describe('⛔⛔ 3 · O CARTÃO "ESCOLHA UM PRODUTO"', () => {
    const prod = () => blocoDa('EscolhaUmProduto')

    it('ele ESTÁ na lista de render — componente definido e não desenhado é o mesmo que ausente', () => {
      expect(listaDeRender()).toContain('<EscolhaUmProduto')
    })

    it('⭐ o título que a referência manda', () => {
      frase('Escolha um produto e veja o preço ideal')
    })

    it('⛔ a BUSCA é a casaBusca da casa — includes cru não acha "porçao"', () => {
      const p = prod()
      expect(p).toContain('filtrarProdutosDoVeredito')
      expect(p, 'régua própria aqui é o bug de 08/09 de volta').not.toMatch(
        /\.toLowerCase\(\)[\s\S]{0,80}\.includes\(/,
      )
    })

    it('⛔ produto SEM FICHA aparece TRACEJADO ÂMBAR e NÃO mostra número', () => {
      expect(cru(REFERENCIA)).toContain('sem ficha')
      const p = prod()
      expect(p, 'o chip tracejado').toContain("border-dashed")
      expect(p, 'o custo diz "a definir", nunca 0').toContain("<b style={{ color: 'var(--fam-ambar-ink)' }}>a definir</b>")
      expect(p, 'e o convite LEVA — cartão que cobra sem dar caminho é cobrança').toContain('cria a ficha que eu te digo o preço na hora')
    })

    it('⭐⭐ "vendendo hoje a" é a MÉDIA REAL DO PDV, editável SÓ pra simular', () => {
      expect(cru(REFERENCIA)).toContain('media real do pdv')
      const p = prod()
      expect(p).toContain('vendendo hoje a')
      expect(p, 'a tela DIZ que nada grava').toContain('nada grava')
      expect(p, 'o preço vem do payload, não de uma 2ª conta').toContain('p.preco')
    })

    it('⛔ sem venda no período → campo VAZIO, nunca R$ 0,00', () => {
      const p = prod()
      expect(p).toContain("p.preco == null ? '' :")
      expect(p).toContain('sem venda no período')
    })

    it('⛔⛔ ZERO ESCRITA — o único POST da tela é a config, e ele mora no montador', () => {
      const p = prod()
      expect(p, 'o cartão de produto não grava nada').not.toMatch(/method:\s*'POST'/)
    })

    it('⭐ o custo abre a FICHA — pela porta de custo do estoque, nada recalculado', () => {
      expect(prod()).toContain('href={p.href}')
      // ⛔ e o custo vem do payload (`custoUnitario` da ficha), não de uma soma aqui
      expect(prod(), 'somar componente aqui seria a 2ª explosão da receita').not.toMatch(/\.reduce\(/)
    })
  })

  describe('⭐ 4 · A FILA EM LARGURA CHEIA', () => {
    it('ela fecha a tela, FORA de qualquer dupla', () => {
      expect(cru(REFERENCIA)).toContain('largura cheia')
      const render = listaDeRender()
      expect(render).toContain('<FilaDeSabores')
      expect(render, 'a fila dentro de uma dupla é o vazio da esquerda de volta').not.toMatch(
        /<Duo>[\s\S]*?FilaDeSabores[\s\S]*?<\/Duo>/,
      )
    })
  })
})
