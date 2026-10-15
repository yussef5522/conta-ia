/**
 * ⭐⭐⭐ A MESA DE OPERAÇÕES BATE COM A REFERÊNCIA — E O GUARD ABRE O ARQUIVO (15/10/2026).
 *
 * **`docs/dashboard-referencia.html` é a LEI do VISUAL e do COMPORTAMENTO** do dashboard novo
 * (① Dashboard · ② Produção), construída e aprovada pelo dono. Este guard não descreve a tela
 * em palavras — ele **LÊ o arquivo** e compara token a token (por VALOR), medida a medida,
 * módulo a módulo, frase a frase, e trata o `<script>` da referência como **especificação de
 * comportamento**.
 *
 * ⚠️⚠️ POR QUE É A ÚNICA FORMA QUE FUNCIONA: na Conciliação a mesma tela foi refeita TRÊS
 * vezes porque *"enquanto o mock vivia numa pasta de downloads, «igual ao mock» era MEMÓRIA
 * MINHA"* (10/09). Versionado, ele é **dado**; e tom ajustado "no olho" fica vermelho
 * apontando o valor que o arquivo manda.
 *
 * ⛔⛔ **ESTE ARQUIVO É DARK-FIRST, e isso mordeu na primeira leitura:** o `:root` cru carrega
 * o tema ESCURO e o `:root[data-theme="light"]` carrega o CLARO — ao contrário da fundação.
 * Os campos `valores`/`valoresEscuros` do leitor recortam *"tudo antes do 1º `@media`"*, então
 * **os dois blocos caem no mesmo recorte e o último sobrescreve o primeiro**. Por isso aqui a
 * leitura é por SELETOR (`paletaDoSeletor`) — *quem sabe se o arquivo é claro-first ou
 * dark-first é o guard DELE*, não o leitor compartilhado.
 *
 * ⚠️ Estrutural e assumido como tal: o projeto roda em `environment: node`, sem jsdom — não dá
 * pra medir pixel renderizado nem clicar. O que se trava é o que já mordeu nesta casa: hex
 * cravado, token só num tema, medida traduzida de cabeça, módulo que sumiu, ordem trocada,
 * número que não vem de porta real, e gesto que a referência declara e a tela não tem.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { semComentarios, usosDe, hexCravados, blocoEntre } from './_leitura-de-fonte'
import {
  lerReferenciaVisual,
  paletaDoSeletor,
  CAMINHO_DO_DASHBOARD,
} from '@/lib/referencias/visual'

const R = (p: string) => resolve(process.cwd(), p)
const ler = (p: string) => readFileSync(p, 'utf8')

const REF = lerReferenciaVisual(CAMINHO_DO_DASHBOARD)
const ESCURO = paletaDoSeletor(REF.css, ':root')
const CLARO = paletaDoSeletor(REF.css, ':root[data-theme="light"]')

/**
 * ⭐⭐ A MESA ① SÃO DOIS ARQUIVOS, e a composição é DECLARADA aqui — não inferida.
 *
 * A `page.tsx` é SERVER (resolve empresa, aplica o gate de quem pode ver dinheiro, desenha o
 * topo com os chips ①/②) e o corpo interativo é CLIENT (`_components/MesaDeOperacoes.tsx`):
 * o scrub, a fita e a barra do pregão precisam de estado e de mouse.
 *
 * ⚠️ **Ler os dois não afrouxa nada** — a pergunta do guard é *"a mesa ① desenha os módulos da
 * referência?"*, e a mesa ① é exatamente este par. ⛔ O que seria afrouxar é um `glob` sobre
 * `_components/`: aí módulo desenhado em arquivo que ninguém declarou passaria a contar, e o
 * guard deixaria de saber o que está na tela.
 */
/**
 * ⭐⭐ **E O CHASSI É COMPARTILHADO** (15/10): `Mod`, o radar, a fita e o container moram em
 * `components/mesa/chassi.tsx` e servem **as duas mesas**. ⚠️ Este guard ficou vermelho COM O
 * CÓDIGO CERTO quando a fita mudou de casa — *grep não distingue "refatorei" de "quebrei"*, a
 * razão de existir da REGRA 3. **Reapontado, não afrouxado:** a pergunta continua *"a mesa
 * desenha os módulos da referência, com estas medidas e com o gesto?"*; o que mudou é o
 * endereço do chassi.
 */
const CHASSI = 'components/mesa/chassi.tsx'

const MESA_1_ARQUIVOS = [
  'app/(dashboard)/dashboard/page.tsx',
  'app/(dashboard)/dashboard/_components/MesaDeOperacoes.tsx',
  CHASSI,
]
/**
 * ⭐ A MESA ② TAMBÉM SÃO DOIS ARQUIVOS + o chassi: a `page.tsx` do HOJE (que carrega e desenha
 * o topo) e o corpo (`components/estoque/mesa-da-cozinha.tsx`).
 */
const MESA_2_ARQUIVOS = [
  'app/(dashboard)/empresas/[id]/estoque/producao/hoje/page.tsx',
  'components/estoque/mesa-da-cozinha.tsx',
  CHASSI,
]

const juntar = (ps: string[]) =>
  ps
    .filter((p) => existsSync(R(p)))
    .map((p) => semComentarios(ler(R(p))))
    .join('\n')

const MESA_1 = juntar(MESA_1_ARQUIVOS)
const MESA_2 = juntar(MESA_2_ARQUIVOS)

/**
 * ⭐ as frases de dinheiro moram nas LIBS — *quem escreve a frase é quem decide o número*.
 * ⚠️ A lista é EXPLÍCITA: um `glob` varreria lib nova sem ninguém declarar, e aí o guard
 * passaria a aprovar frase que nasceu em lugar que não devia escrever frase.
 */
const LIBS = [
  'lib/balance/serie-de-saldo.ts',
  'lib/balance/paga-x-entra.ts',
  'lib/balance/radar-da-mesa.ts',
  'lib/balance/fita-do-dia.ts',
  'lib/balance/pregao-do-mes.ts',
  /** ⭐ as da mesa ② — mesma régua: a frase mora em quem decide o número */
  'lib/stock/producao/radar-da-cozinha.ts',
  'lib/stock/producao/fita-da-cozinha.ts',
  'lib/stock/producao/mesa-da-cozinha.ts',
]
  .filter((p) => existsSync(R(p)))
  .map((p) => semComentarios(ler(R(p))))
  .join('\n')

const CODIGO = `${MESA_1}\n${MESA_2}\n${LIBS}`

const semAcento = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * ⭐ A ASSERÇÃO DE DOIS LADOS. A frase tem que estar na REFERÊNCIA **e** no CÓDIGO.
 *
 * ⛔ Uma asserção que só olhasse o código me deixaria escrever qualquer coisa e chamar de *"o
 * que o dono aprovou"*; uma que só olhasse a referência aprovaria a tela que não a desenha.
 */
function fraseDosDoisLados(frase: string, onde: string = CODIGO) {
  expect(semAcento(REF.html), `"${frase}" NÃO está na referência — eu inventei`).toContain(
    semAcento(frase),
  )
  expect(semAcento(onde), `"${frase}" está na referência e NÃO no código`).toContain(
    semAcento(frase),
  )
}

describe('a mesa de operações bate com a referência versionada', () => {
  // ─────────────────────────────────────────────────────────────────────
  // 0. a própria referência — se ela mudar de forma, o guard tem que saber
  // ─────────────────────────────────────────────────────────────────────
  it('⭐ a referência existe, é a B2 aprovada, e declara as DUAS mesas', () => {
    expect(REF.html).toContain('PROPOSTA B2 · A MESA DE OPERAÇÕES')
    expect(REF.html).toContain('id="tela-dash"')
    expect(REF.html).toContain('id="tela-prod"')
    // ⚠️ os chips do topo são a navegação entre as duas mesas
    expect(REF.html).toContain('① Dashboard')
    expect(REF.html).toContain('② Produção')
  })

  it('⛔ o arquivo é DARK-FIRST — as duas paletas existem e são DIFERENTES', () => {
    // ⚠️ se alguém "arrumar" a referência pra claro-first, este teste avisa ANTES de o guard
    // de tokens comparar a paleta errada com a tela.
    expect(Object.keys(ESCURO).length).toBeGreaterThanOrEqual(18)
    expect(Object.keys(CLARO).length).toBe(Object.keys(ESCURO).length)
    expect(ESCURO['--bg']).not.toBe(CLARO['--bg'])
    expect(ESCURO['--bg']).toBe('#070a14')
    expect(CLARO['--bg']).toBe('#eef1f8')
  })

  // ─────────────────────────────────────────────────────────────────────
  // 1. TOKENS por VALOR, nos DOIS temas
  // ─────────────────────────────────────────────────────────────────────
  it('⭐⭐ a tela pinta por TOKEN — ZERO hex de cor cravado', () => {
    for (const [nome, fonte] of [
      ['mesa ①', MESA_1],
      ['mesa ②', MESA_2],
    ] as const) {
      if (!fonte) continue
      /**
       * ⭐ O DETECTOR DE HEX TEM UM DONO (`hexCravados`, 14/10) — ***N cópias do mesmo regex
       * divergem, e a que diverge é sempre a que ninguém reconsertou***. Escrever o meu aqui
       * seria a 6ª cópia (o comentário do dono único lista as 5 anteriores).
       */
      const hex = hexCravados(fonte)
      expect(hex, `${nome} tem hex cravado: ${hex.join(', ')}`).toEqual([])
    }
  })

  it('⭐ todo token que a referência declara tem par declarado no CSS da casa, nos 2 temas', () => {
    /**
     * ⚠️⚠️ **`globals.split('.dark')[0]` NÃO É "O MAPA CLARO"** — e isto é cicatriz escrita
     * nesta casa em 10/10 e 11/10: a folha tem **vários** `.dark` (o 1º é um utilitário, muito
     * antes do bloco de tokens), então recortar pelo primeiro deu **10 falsos vermelhos** sobre
     * um CSS correto. ⭐ O certo é recortar o **corpo de CADA regra** e perguntar quais
     * seletores DEFINEM o token.
     *
     * ⚠️⚠️ **E O COMENTÁRIO ENTRA NO SELETOR — foi o 2º falso vermelho desta mesma asserção
     * (15/10):** o grupo `([^{}]+)` começa no `}` anterior, então ele engole o **bloco de
     * comentário gigante** que documenta a paleta — e esse comentário *fala de `.dark`*. Com
     * isso `sel.includes('.dark')` dava `true` **na regra do tema CLARO** e o guard jurava que
     * `--prod-bg` não existia no claro, com a linha 626 do arquivo dizendo o contrário.
     * ⭐ Por isso o CSS é lido **sem comentário**: *o arquivo que documenta o tema escuro não
     * pode ser o que faz a regra clara parecer escura.*
     */
    const globals = ler(R('app/globals.css')).replace(/\/\*[\s\S]*?\*\//g, '')
    const defineEm = (token: string, comDark: boolean) =>
      [...globals.matchAll(/([^{}]+)\{([^{}]*)\}/g)].some(
        ([, sel, corpo]) =>
          sel.includes('.dark') === comDark && new RegExp(`${token}\\s*:`).test(corpo),
      )
    /**
     * ⚠️ A régua é POR PAPEL, não por hex: a referência escreve `--acao` e a casa pode chamar
     * de `--prod-acao-bg` — o que não pode é o papel não existir em UM dos temas, que é a
     * classe do *"color cuja única definição vive dentro do `[data-theme]`"*.
     */
    const PARES: Record<string, string> = {
      '--bg': '--prod-bg',
      '--mod': '--prod-surface-1',
      '--linha': '--prod-line',
      '--tinta-3': '--prod-muted',
      '--acao': '--prod-accent',
      '--verde': '--fam-verde-mid',
      '--coral': '--fam-coral-mid',
      '--ambar': '--fam-ambar-mid',
    }
    for (const [daRef, daCasa] of Object.entries(PARES)) {
      expect(ESCURO, `a referência deixou de declarar ${daRef}`).toHaveProperty(daRef)
      expect(defineEm(daCasa, false), `${daCasa} (par de ${daRef}) não é DEFINIDO no tema CLARO`).toBe(true)
      expect(defineEm(daCasa, true), `${daCasa} (par de ${daRef}) não é DEFINIDO no tema ESCURO`).toBe(true)
    }
  })

  // ─────────────────────────────────────────────────────────────────────
  // 2. a LISTA DE RENDER — quais módulos, em que ORDEM, com que SPAN
  // ─────────────────────────────────────────────────────────────────────
  /**
   * ⭐⭐ A ORDEM SAI DA REFERÊNCIA, não da minha memória — e é lida do arquivo a cada rodada.
   * ⛔ Se o dono reordenar a mesa, é ESTE teste que fica vermelho primeiro, e ele diz a ordem
   * nova. Uma lista escrita à mão aqui envelheceria calada.
   */
  const modulosDaReferencia = (telaId: string) => {
    const body = REF.html.slice(REF.html.indexOf('</style>'))
    const fim = telaId === 'tela-dash' ? body.indexOf('id="tela-prod"') : body.length
    const trecho = body.slice(body.indexOf(`id="${telaId}"`), fim)
    return [...trecho.matchAll(/<section class="([^"]+)"/g)].map((m) => {
      const resto = trecho.slice(m.index! + m[0].length, m.index! + m[0].length + 500)
      const cab = /class="mod-cab"[^>]*>([\s\S]*?)<\/div>/.exec(resto)
      const aria = /aria-label="([^"]*)"/.exec(m[0] + resto.slice(0, 60))
      /**
       * ⚠️ Colapsa TODO espaço em um — cortar no 1º bloco de 2+ espaços partia
       * *"A COZINHA HOJE AO VIVO"* em *"A COZINHA HOJE"* (o `<span>` interno do cabeçalho
       * punha espaços no meio) e dava **falso vermelho** sobre a referência correta.
       */
      const titulo = cab
        ? cab[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        : (aria?.[1] ?? '')
      return { classes: m[1], titulo }
    })
  }

  it('⭐⭐ a mesa ① tem os 8 blocos da referência, na ORDEM e com o SPAN dela', () => {
    const mods = modulosDaReferencia('tela-dash')
    // a referência declara 7 módulos + a fita
    expect(mods.map((m) => m.classes)).toEqual([
      'mod c7',
      'mod c5',
      'mod c12',
      'mod c12',
      'c12 fita',
      'mod c4',
      'mod c4',
      'mod c4',
    ])
    const titulos = mods.map((m) => m.titulo)
    expect(titulos[0]).toContain('NO CAIXA AGORA')
    expect(titulos[1]).toContain('RADAR')
    expect(titulos[2]).toContain('O PREGÃO')
    expect(titulos[3]).toContain('OS PRÓXIMOS 7 DIAS')
    expect(titulos[4]).toContain('fita')
    expect(titulos[5]).toContain('CONTAS · 7 DIAS')
    expect(titulos[6]).toContain('TUA SEMANA')
    expect(titulos[7]).toContain('COZINHA AGORA')
  })

  it('⭐⭐ a mesa ② tem os 6 blocos da referência, na ORDEM e com o SPAN dela', () => {
    const mods = modulosDaReferencia('tela-prod')
    expect(mods.map((m) => m.classes)).toEqual([
      'mod c12',
      'mod c5',
      'mod c7',
      'c12 fita',
      'mod c6',
      'mod c6',
    ])
    const titulos = mods.map((m) => m.titulo)
    expect(titulos[0]).toContain('A COZINHA HOJE AO VIVO')
    expect(titulos[1]).toContain('RADAR DA COZINHA')
    expect(titulos[2]).toContain('QUEM FEZ O DIA')
    expect(titulos[3]).toContain('fita')
    expect(titulos[4]).toContain('ÚLTIMAS CONCLUSÕES')
    expect(titulos[5]).toContain('A SEMANA DA COZINHA')
  })

  it('⭐ cada módulo da mesa ① está DESENHADO na tela, pelo rótulo da referência', () => {
    for (const titulo of [
      'NO CAIXA AGORA',
      'RADAR',
      'O PREGÃO',
      'OS PRÓXIMOS 7 DIAS',
      'CONTAS · 7 DIAS',
      'TUA SEMANA',
      'COZINHA AGORA',
    ]) {
      expect(semAcento(MESA_1), `o módulo "${titulo}" não está na mesa ①`).toContain(
        semAcento(titulo),
      )
    }
  })

  it('⭐⭐ cada bloco da mesa ② está DESENHADO na tela, pelo rótulo da referência', () => {
    /**
     * ⛔⛔ **ESTE É O ESPELHO QUE FALTAVA.** O teste de cima afirma a ORDEM e o SPAN que a
     * REFERÊNCIA declara pra mesa ② — e um guard que só lê a referência **aprovaria uma mesa
     * ② VAZIA**: a porta sem maçaneta, 12ª volta nesta casa. A pergunta que morde é a outra
     * metade: *"a TELA desenha esses blocos?"*.
     *
     * ⚠️ O 1º bloco é conferido por **`A COZINHA HOJE` + o selo `aoVivo`**, não pela frase
     * inteira da referência (`A COZINHA HOJE AO VIVO`): no arquivo do dono o `AO VIVO` é um
     * **selo pulsante dentro do cabeçalho**, e o chassi o desenha pelo `aoVivo` — exigir a
     * string contígua obrigaria a tela a escrever o selo à mão, que é o oposto do chassi
     * compartilhado.
     *
     * ⚠️ E a fita é conferida pelo **rótulo acessível** (`a fita da cozinha`): o bloco dela não
     * tem cabeçalho na referência — ele é a tira que rola —, então o que dá pra afirmar é o
     * `aria-label`, que é justamente o que faz ela existir pra quem usa leitor de tela.
     */
    for (const titulo of [
      'A COZINHA HOJE',
      'RADAR DA COZINHA',
      'QUEM FEZ O DIA',
      'ULTIMAS CONCLUSOES',
      'A SEMANA DA COZINHA',
    ]) {
      expect(semAcento(MESA_2), `o bloco "${titulo}" não está na mesa ②`).toContain(
        semAcento(titulo),
      )
    }
    /**
     * ⚠️⚠️ **E AQUI O GUARD VEIO VERDE NA 1ª VERSÃO — *"menção, não uso"* de novo.** Eu afirmava
     * `MESA_2` conter `aoVivo`, e `MESA_2` **inclui o CHASSI**, que DECLARA a prop
     * (`aoVivo?: boolean`) e a desenha. Arrancar o selo do cabeçalho da mesa ② deixava os 19
     * verdes, porque a palavra sobrevivia no arquivo do vizinho. ⭐ O que morde é olhar o
     * **CABEÇALHO DAQUELE bloco**: o selo tem que chegar no `Mod` cujo título é
     * `A COZINHA HOJE`, e não em qualquer lugar do conjunto.
     */
    const corpo = ler(R('components/estoque/mesa-da-cozinha.tsx'))
    const cabecalho = blocoEntre(corpo, 'titulo="A COZINHA HOJE"', '>')
    expect(cabecalho, 'o selo AO VIVO não chega no cabeçalho do 1º bloco').toContain('aoVivo')
    expect(MESA_2, 'a fita da cozinha não tem rótulo acessível').toContain('a fita da cozinha')
  })

  it('⭐⭐ a mesa ② é RENDERIZADA na tela do HOJE — e no TOPO, antes da lista do dia', () => {
    /**
     * ⛔ Componente que existe no arquivo e ninguém monta é o defeito de 10/09 (*"o motor subiu
     * e a tela não mudou"*). Aqui as duas metades são afirmadas: a tela **monta** a mesa, e ela
     * vem **ANTES** do bloco `Agora` — se descesse pro fim, o dono rolaria a lista inteira pra
     * achar o resumo do dia, e o pedido era o contrário (*"a mesa ② é o novo TOPO"*).
     */
    const tela = ler(R('app/(dashboard)/empresas/[id]/estoque/producao/hoje/page.tsx'))
    expect(usosDe(tela, 'MesaDaCozinhaUI'), 'a tela do HOJE não monta a mesa ②').toBeGreaterThan(0)
    const iMesa = tela.indexOf('<MesaDaCozinhaUI')
    const iAgora = tela.indexOf('Agora</h2>')
    expect(iMesa, 'a mesa ② não é renderizada').toBeGreaterThan(-1)
    expect(iAgora, 'o bloco AGORA desapareceu — a lista do dia tem que ficar').toBeGreaterThan(-1)
    expect(iMesa, 'a mesa ② tem que vir ANTES da lista do dia').toBeLessThan(iAgora)
  })

  // ─────────────────────────────────────────────────────────────────────
  // 3. MEDIDAS e CORTES — o número que está no arquivo, escrito igual
  // ─────────────────────────────────────────────────────────────────────
  it('⭐ as medidas da referência estão na tela — px LITERAL, nunca traduzido de cabeça', () => {
    /**
     * ⚠️ `gap-3` É 12px e `text-4xl` É 36px — certos, mas obrigam tradução mental, e **foi
     * tradução mental que produziu as duas versões erradas da Conciliação** (10/09). O número
     * que está no arquivo vai escrito igual.
     */
    const CRITICAS = ['44', '30', '170', '120', '64', '26']
    for (const m of CRITICAS) {
      expect(REF.medidas.concat(REF.letras), `${m} não está na referência`).toContain(m)
      expect(MESA_1 + MESA_2, `a medida ${m}px da referência não está nas mesas`).toContain(
        `${m}px`,
      )
    }
  })

  it('⭐ o teto de 1440 e os cortes de 1023/860 vêm do arquivo', () => {
    expect(REF.css).toContain('max-width:1440px')
    expect(REF.cortes).toEqual(['1023', '860'])
    expect(MESA_1).toContain('1440px')
    // ⚠️ o corte de 1023 é o "empilha tudo" — a mesa expressa como `max-[1023px]:`
    expect(MESA_1 + MESA_2).toContain('1023px')
  })

  it('⭐ UMA composição, não uma por viewport (REGRA 12)', () => {
    /**
     * ⛔ A doença tem forma própria: um par `sm:hidden` × `hidden sm:` desenhando o MESMO
     * módulo duas vezes. ⚠️ Guard que CONTA blocos cresce com a tela e cobra por cada
     * controle novo — ele mediria o tamanho, não a doença (a lição de 25/09).
     */
    for (const [nome, fonte] of [
      ['mesa ①', MESA_1],
      ['mesa ②', MESA_2],
    ] as const) {
      if (!fonte) continue
      const soCelular = (fonte.match(/\bsm:hidden\b/g) ?? []).length
      const soDesktop = (fonte.match(/\bhidden\s+sm:/g) ?? []).length
      expect(
        soCelular > 0 && soDesktop > 0,
        `${nome} tem DUAS composições (${soCelular} só-celular × ${soDesktop} só-desktop)`,
      ).toBe(false)
    }
  })

  // ─────────────────────────────────────────────────────────────────────
  // 4. as FRASES — dos dois lados
  // ─────────────────────────────────────────────────────────────────────
  it('⭐ as frases que a referência imprime estão no código', () => {
    fraseDosDoisLados('NO CAIXA AGORA')
    fraseDosDoisLados('O QUE PEDE TUA MÃO')
    fraseDosDoisLados('O QUE PAGA × O QUE ENTRA')
    fraseDosDoisLados('pra pagar a casa de HOJE faltam')
    fraseDosDoisLados('empréstimos do mês')
  })

  // ─────────────────────────────────────────────────────────────────────
  // 5. o <script> da referência É a especificação do COMPORTAMENTO
  // ─────────────────────────────────────────────────────────────────────
  it('⭐⭐ a referência declara o SCRUB da linha de 30 dias — e a tela tem o gesto', () => {
    expect(REF.script).toContain('mousemove')
    expect(REF.script).toContain('mouseleave')
    // ⚠️ o `mouseleave` é metade do gesto: sem ele a dica fica pendurada depois do mouse sair
    expect(MESA_1).toContain('onMouseMove')
    expect(MESA_1).toContain('onMouseLeave')
  })

  it('⭐⭐ a fita PAUSA no hover e RESPEITA reduced-motion', () => {
    expect(REF.css).toContain('.fita:hover .fita-track{animation-play-state:paused}')
    expect(REF.css).toContain('prefers-reduced-motion')
    // ⛔ as duas metades são obrigatórias: animação que não pausa no hover é fita que o dono
    // não consegue ler, e animação que ignora reduced-motion é acessibilidade quebrada.
    expect(MESA_1 + MESA_2).toContain('animation-play-state')
    expect(MESA_1 + MESA_2).toContain('motion-reduce')
  })

  it('⭐ a barra do pregão enche UMA vez, e a conta da barra vem da LIB', () => {
    expect(REF.css).toContain('.enchendo')
    expect(REF.script).toContain('requestAnimationFrame')
    /**
     * ⛔⛔ A fração da barra NÃO pode ser calculada na tela: `montarPregao` já devolve
     * `barra.pago`/`barra.transbordo`, e um 2º clamp na tela foi exatamente o que estourou a
     * pilha de tijolos em 07/10.
     */
    if (MESA_1) {
      expect(usosDe(MESA_1, 'montarPregao') + usosDe(MESA_1, 'pregao'))
        .toBeGreaterThan(0)
      /**
       * ⚠️⚠️ **JANELA DE DISTÂNCIA JÁ PRODUZIU FALSO VERMELHO E FALSO VERDE NESTA CASA 8
       * VEZES** — e aqui ela me pegou na 1ª rodada: eu fatiava *"do primeiro `pregao` até o fim
       * do arquivo"* e o `Math.min(1, Math.max(0, …))` do **SCRUB** (outro componente, outro
       * assunto) caía dentro da janela. ⭐ O que morde é o **CORPO DA FUNÇÃO** que desenha a
       * barra — estrutura, nunca vizinhança.
       */
      const bloco = blocoEntre(MESA_1, 'function BarraDoPregao', '\n}')
      expect(bloco.length, 'não achei o corpo de BarraDoPregao').toBeGreaterThan(0)
      expect(
        /pctPago\s*[*/]/.test(bloco) || /Math\.min\(1\s*,/.test(bloco),
        'a mesa está clampando/calculando a barra do pregão por conta própria',
      ).toBe(false)
    }
  })
})

/**
 * ⭐⭐⭐ A REGRA DE OURO DO DONO — "o pregão == o placar AO CENTAVO".
 *
 * ⛔ Aqui a trava é ESTRUTURAL: o pregão **não pode somar dinheiro**. Ele recebe a `Casa` e a
 * `Cascata` que a tela de *Quem paga a casa* já assina e lê os campos. ⚠️ Uma soma própria —
 * ainda que "igualzinha" — divergiria na primeira borda (cobertura, complemento, plano
 * ausente), e o dono teria dois números pra mesma pergunta em duas telas.
 */
describe('REGRA DE OURO — o pregão não calcula dinheiro, ele LÊ o placar', () => {
  const PREGAO = semComentarios(ler(R('lib/balance/pregao-do-mes.ts')))

  it('⛔ o pregão não soma nem subtrai dinheiro — ele lê campos da Casa/Cascata', () => {
    // ⚠️ a régua é sobre os CAMPOS de dinheiro: `sobraLiquida`/`custoFixo`/`transbordo` só
    // aparecem sendo LIDOS, nunca num `reduce`/`+` entre si.
    expect(PREGAO).not.toMatch(/sobraLiquida\s*[-+]/)
    expect(PREGAO).not.toMatch(/\.reduce\(/)
    expect(PREGAO).not.toContain('sobraTotal -')
  })

  it('⭐ o número grande e o rótulo vêm dos MESMOS campos que o placar desenha', () => {
    expect(usosDe(PREGAO, 'sobraLiquida')).toBeGreaterThan(0)
    // ⛔ o rótulo é o do HERÓI da cascata — a MESMA string, nunca uma 2ª redação
    expect(PREGAO).toContain('cascata.heroi.rotulo')
    expect(PREGAO).not.toMatch(/'✓ CASA PAGA/)
    expect(PREGAO).not.toMatch(/"FALTAM"/)
  })

  it('⭐ a barra herda o clamp da Casa — o pregão não clampa de novo', () => {
    // `pctPago` já vem limitado a 1 lá; dois clamps são duas réguas.
    expect(PREGAO).not.toMatch(/Math\.min\(1\s*,\s*casa\.pctPago/)
  })
})
