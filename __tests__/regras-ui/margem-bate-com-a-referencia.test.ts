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
import { lerReferenciaVisual } from '@/lib/margem/referencia'

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
const REFERENCIA = REF.html
const CSS_DA_REFERENCIA = REF.css
const SCRIPT_DA_REFERENCIA = REF.script

const TELA = semComentarios(ler(R('app/(dashboard)/empresas/[id]/margem/page.tsx')))
/** ⭐ as frases de dinheiro moram nas LIBS (quem escreve a frase é quem decide o número) */
const LIBS = [
  'lib/margem/placar.ts',
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
    expect(render).toMatch(/<Duo>[\s\S]*?MontadorDePizza[\s\S]*?FilaDeSabores[\s\S]*?<\/Duo>/)

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
  const ANCORAS: { texto: string; componente: string }[] = [
    { texto: 'A LINHA DE CHEGADA', componente: 'LinhaDeChegadaCard' },
    { texto: 'O placar de', componente: 'PlacarDaCasa' },
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
      expect(
        cru(blocoDa(a.componente)),
        `o cartão ${a.componente} não imprime "${a.texto}"`,
      ).toContain(cru(a.texto))
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

  it('⭐⭐ o placar — e o veredito mora no RÓTULO, do jeito que o arquivo escreve', () => {
    frase('O placar de')
    frase('custo fixo:')
    frase('O que as vendas deixaram')
    frase('A casa custou até aqui')
    frase('✓ CASA PAGA — e sobrou')
    frase('daqui pra frente é lucro')
    frase('FALTAM')
    frase('pra pagar a casa do período')
    frase('sobra medida em')
    frase('de complementos')
  })

  it('⭐ a barra única e a legenda dos três pedaços', () => {
    frase('a casa se enchendo')
    frase('a bandeira é 100% = casa paga')
    frase('o verde é o lucro')
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
