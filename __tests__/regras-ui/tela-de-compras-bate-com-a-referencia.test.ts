/**
 * ⭐⭐⭐ 🛒 CONSUMO & COMPRAS BATE COM A REFERÊNCIA — E O GUARD ABRE O ARQUIVO (16/10/2026).
 *
 * **A ordem do dono:** *"`docs/consumo-e-compras-referencia.html` é a LEI: tokens 1:1, os
 * comentários do CSS são as leis C0–C15, e o `<script>` é a especificação da MATEMÁTICA. Nada
 * de inventar layout ou conta diferente do arquivo."*
 *
 * ⚠️⚠️ **POR QUE LER O ARQUIVO É A ÚNICA FORMA QUE FUNCIONA:** na Conciliação a mesma tela foi
 * refeita TRÊS vezes porque *"enquanto o mock vivia numa pasta de downloads, «igual ao mock»
 * era MEMÓRIA MINHA"* (10/09). Versionado, ele é **dado** — e tom ajustado "no olho" fica
 * vermelho apontando o valor que o arquivo manda.
 *
 * ⛔⛔ **DARK-FIRST, e isso muda a leitura:** o `:root` cru carrega o ESCURO e o
 * `:root[data-theme="light"]` o CLARO. Os campos `valores`/`valoresEscuros` do leitor comum
 * recortam *"tudo antes do 1º `@media`"* → **os dois blocos caem no mesmo recorte e o último
 * sobrescreve o primeiro**. Por isso aqui a leitura é por SELETOR (`paletaDoSeletor`).
 *
 * ⚠️ Estrutural e assumido como tal: o projeto roda em `environment: node`, sem jsdom — não dá
 * pra medir pixel renderizado nem clicar. O que se trava é o que já mordeu nesta casa: hex
 * cravado, token só num tema, medida traduzida de cabeça, módulo que sumiu, ordem trocada,
 * número que não vem de porta real, prosa onde o dono pediu número, e gesto que a referência
 * declara e a tela não tem.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { semComentarios, usosDe, hexCravados, blocoEntre } from './_leitura-de-fonte'
import {
  lerReferenciaVisual,
  paletaDoSeletor,
  CAMINHO_DE_CONSUMO_E_COMPRAS,
} from '@/lib/referencias/visual'

const R = (p: string) => resolve(process.cwd(), p)
const ler = (p: string) => readFileSync(p, 'utf8')

const REF = lerReferenciaVisual(CAMINHO_DE_CONSUMO_E_COMPRAS)
const ESCURO = paletaDoSeletor(REF.css, ':root')
const CLARO = paletaDoSeletor(REF.css, ':root[data-theme="light"]')

/**
 * ⭐⭐ A TELA É UM ARQUIVO + O MAPA DE TOKENS, e a composição é DECLARADA aqui — não inferida.
 *
 * ⛔ Um `glob` sobre a pasta seria afrouxar: módulo desenhado em arquivo que ninguém declarou
 * passaria a contar, e o guard deixaria de saber o que está na tela.
 */
const TELA = 'app/(dashboard)/empresas/[id]/estoque/consumo-e-compras/page.tsx'
const TOKENS = 'lib/compras/tokens.ts'
const LIB_PURA = 'lib/compras/consumo-e-compras.ts'
const LEITURA = 'lib/compras/leitura.ts'

const CODIGO = semComentarios(ler(R(TELA)))
const CRU = ler(R(TELA))
const MAPA = ler(R(TOKENS))

/* ═══════════════════════ 1 · OS TOKENS, MAPEADOS 1:1 ═══════════════════════ */

/**
 * ⭐⭐ O MAPA que o comentário da referência manda fazer: *"onde houver token genérico abaixo,
 * mapear 1:1 para o token da casa"*.
 *
 * ⚠️⚠️ O par NÃO é por VALOR HEX — é por PAPEL. O `--verde` da referência é `#2EE6A8` e o
 * `--fam-verde-mid` da casa é outro tom: verdes diferentes do MESMO papel, e o da casa é o que
 * **inverte nos dois temas** junto com o resto do sistema.
 */
const MAPA_DE_TOKENS: Record<string, string> = {
  '--bg': '--prod-bg',
  '--mod': '--prod-surface',
  '--mod-2': '--prod-surface-1',
  '--linha': '--prod-line',
  '--linha-forte': '--prod-line-strong',
  '--tinta': '--prod-primary',
  '--tinta-2': '--prod-secondary',
  '--tinta-3': '--prod-muted',
  '--acao': '--fam-indigo-mid',
  '--acao-fundo': '--fam-indigo-bg',
  '--acao-vivo': '--prod-accent',
  '--verde': '--fam-verde-mid',
  '--verde-chao': '--fam-verde-solid',
  '--verde-fundo': '--fam-verde-bg',
  '--coral': '--fam-coral-mid',
  '--coral-fundo': '--fam-coral-bg',
  '--ambar': '--fam-ambar-mid',
  '--ambar-fundo': '--fam-ambar-bg',
}

/**
 * ⚠️ OS TOKENS QUE A REFERÊNCIA DECLARA E NÃO SÃO COR (não entram no mapa de paleta):
 * `--r` é o raio e `--font` é a família — os dois têm par na casa (`--prod-r-cartao` e a
 * fonte do shell), mas `paletaDoSeletor` só colhe `#hex`, então eles são conferidos à parte.
 */
const NAO_SAO_COR = new Set(['--r', '--font'])

/**
 * ⭐ OS TOKENS QUE A TELA USA E A REFERÊNCIA NÃO TEM, com o motivo escrito:
 * a referência crava `#fff` na tinta de dentro do chip aceso; a casa tem o par que **inverte**
 * (`--prod-acao-ink`, 04/10) e o par medido do chão sólido verde (`--fam-verde-on`, 10/10).
 * ⛔ Cravar branco deixaria o chip aceso ilegível no tema que o dono mais usa.
 */
const EXTRA_PERMITIDO = new Set(['--prod-acao-ink', '--fam-verde-on', '--prod-r-cartao'])

describe('⛔⛔ OS TOKENS — mapeados 1:1, e nos DOIS temas', () => {
  it('⭐ o leitor achou os DOIS blocos de paleta (o arquivo é dark-first)', () => {
    // ⚠️ sem isso, um arquivo mudo deixaria TODAS as asserções abaixo passar por vacuidade
    expect(Object.keys(ESCURO).length, 'o `:root{}` escuro não trouxe token nenhum').toBeGreaterThan(10)
    expect(Object.keys(CLARO).length, 'o `:root[data-theme="light"]` não trouxe token nenhum').toBeGreaterThan(10)
  })

  it('⭐⭐ todo token de COR do `:root{}` da referência tem par declarado no mapa', () => {
    for (const t of Object.keys(ESCURO)) {
      if (NAO_SAO_COR.has(t)) continue
      expect(MAPA_DE_TOKENS[t], `token "${t}" da referência sem par no mapa desta tela`).toBeTruthy()
    }
  })

  it('⭐⭐ a referência DECLARA os dois temas pra cada cor — nenhuma cor vive num tema só', () => {
    for (const t of Object.keys(ESCURO)) {
      if (NAO_SAO_COR.has(t)) continue
      expect(CLARO[t], `"${t}" existe no escuro e NÃO no claro — a tela ficaria sem ele num tema`).toBeTruthy()
    }
  })

  it('⭐⭐ cada par do mapa existe nos DOIS temas do `globals.css` da casa', () => {
    const css = ler(R('app/globals.css'))
    for (const casa of new Set([...Object.values(MAPA_DE_TOKENS), ...EXTRA_PERMITIDO])) {
      const n = css.split(`${casa}:`).length - 1
      // ⛔ 2 declarações = `:root` (claro) + `.dark` (escuro). Uma só = a cor morre num tema,
      //    e é literalmente o defeito do âmbar da tela de Vendas (10/10).
      expect(n, `o token da casa "${casa}" não está nos DOIS temas (achei ${n} declarações)`).toBeGreaterThanOrEqual(2)
    }
  })

  it('⛔⛔ a TELA não crava hex de cor — ela lê o mapa, e o mapa só tem `var(--…)`', () => {
    expect(hexCravados(CODIGO), 'hex de cor cravado na tela').toEqual([])
    // ⚠️ e o mapa é só indireção: hex ali seria o mesmo defeito um arquivo adentro
    expect(hexCravados(semComentarios(MAPA)), 'hex de cor cravado no mapa de tokens').toEqual([])
  })

  it('⭐ a TELA pinta SÓ pelo mapa — nenhum `var(--…)` solto escrito à mão', () => {
    const usados = [...CODIGO.matchAll(/var\(--[a-z0-9-]+\)/g)].map((m) => m[0])
    expect(usados, 'a tela escreveu `var(--…)` direto em vez de ler o mapa `CC`').toEqual([])
    expect(usosDe(CODIGO, 'CC'), 'a tela não consome o mapa de tokens').toBeGreaterThan(10)
  })
})

/* ═══════════════════════ 2 · AS MEDIDAS E AS LETRAS ═══════════════════════ */

describe('⭐ AS MEDIDAS — os números que o ARQUIVO declara, sem tradução mental', () => {
  /**
   * ⚠️ As medidas vão escritas como a referência as escreve (`46px`, `1440px`), nunca
   * traduzidas pra escala do Tailwind: *foi tradução mental que produziu as duas versões
   * erradas da Conciliação* (10/09).
   */
  const DECLARADAS: [string, string][] = [
    ['teto do miolo', '1440px'],
    ['o herói (lei C3)', '46px'],
    ['a unidade do herói', '20px'],
    ['o uso na semana', '16.5px'],
    ['o PEDIR, o maior da mesa', '19px'],
    ['o número do stat', '19px'],
    ['a altura das barras', '120px'],
    ['a altura do spark', '44px'],
  ]

  it('⭐⭐ cada medida declarada está no CSS da referência E no mapa desta tela', () => {
    for (const [papel, v] of DECLARADAS) {
      expect(REF.css, `a referência não declara ${v} (${papel})`).toContain(v)
      expect(semComentarios(MAPA), `o mapa não carrega ${v} (${papel})`).toContain(v)
    }
  })

  it('⭐ a tela lê as medidas do mapa (`MED`), nunca digita o número', () => {
    expect(usosDe(CODIGO, 'MED'), 'a tela não consome as medidas do mapa').toBeGreaterThan(4)
    // ⛔ o teto do container é o caso que mais já foi digitado de cabeça nesta casa
    expect(CODIGO, 'o teto de 1440px foi DIGITADO na tela em vez de vir do mapa').not.toContain('max-w-[1440px]')
  })

  it('⭐ o corte do celular é o MESMO que a casa usa (`min-[900px]`)', () => {
    // ⚠️ REGRA 12: UMA composição, dois viewports — a grade da mesa empilha no corte da casa
    expect(CODIGO, 'a mesa/plano não empilha no corte de 900px').toContain('min-[900px]')
  })
})

/* ═══════════════════════ 3 · OS 5 MÓDULOS, NA ORDEM DO ARQUIVO ═══════════════════════ */

/**
 * ⭐⭐ A ORDEM É LEI (a referência desenha nesta sequência), e o guard mede a ORDEM, não só a
 * presença: *módulo presente na posição errada é a tela que o dono não reconhece*.
 *
 * ⚠️⚠️ A ÂNCORA É O `titulo="…"` DO MÓDULO, NUNCA O TEXTO SOLTO — e isto nasceu de um VERMELHO
 * CONTRA A TELA CERTA. Com a âncora crua `'O ITEM'` (7 caracteres), o cabeçalho da mesa
 * *"PEDIR · JÁ COM A FOLGA DO ITEM"* casava PRIMEIRO (posição 8.426, dentro do componente, contra
 * 22.721 da lista de render) e o guard acusava o C3 de estar fora de ordem. ***Âncora genérica
 * casa a PROSA da tela e mede a posição errada*** — a mesma família do *"menção, não uso"*: o que
 * define o módulo é a PROP que o renderiza, não as palavras que aparecem perto.
 */
const MODULOS: [string, string][] = [
  ['C7 · a agenda do comprador', 'titulo="A AGENDA DO COMPRADOR — PRÓXIMOS PEDIDOS"'],
  ['C1/C4 · as listas e o período', 'titulo="AS SUAS LISTAS"'],
  ['C3 · o item, fundo', 'titulo="O ITEM"'],
]

describe('⭐⭐ OS MÓDULOS — presentes, e NA ORDEM', () => {
  it('⭐ cada módulo está na tela', () => {
    for (const [lei, titulo] of MODULOS) {
      expect(CODIGO, `o módulo ${lei} ("${titulo}") saiu da tela`).toContain(titulo)
    }
  })

  it('⭐⭐ a ORDEM na tela é a da referência', () => {
    const pos = MODULOS.map(([lei, t]) => ({ lei, i: CODIGO.indexOf(t) }))
    for (const p of pos) expect(p.i, `${p.lei} não está na tela`).toBeGreaterThan(-1)
    for (let k = 1; k < pos.length; k++) {
      expect(pos[k]!.i, `${pos[k]!.lei} está ANTES de ${pos[k - 1]!.lei}`).toBeGreaterThan(pos[k - 1]!.i)
    }
  })

  it('⭐⭐ a MESA (C8) e o PLANO (C9) são EXCLUSIVOS — a aba decide qual aparece', () => {
    expect(CODIGO).toContain('A MESA DE PEDIDO — UM PEDIDO POR FORNECEDOR')
    expect(CODIGO).toContain('O PLANO DE PRODUÇÃO — O QUE PRODUZIR')
    // ⛔ os dois ao mesmo tempo seriam duas respostas pra "o que eu faço agora?" na mesma tela
    expect(CODIGO, 'a mesa e o plano não estão no ternário da aba').toMatch(
      /aba === 'CAROS' \?[\s\S]{0,4000}A MESA DE PEDIDO[\s\S]{0,8000}\) : \([\s\S]{0,2000}O PLANO DE PRODUÇÃO/,
    )
  })

  it('⭐ as 7 colunas da MESA, na ordem da referência (lei C8)', () => {
    const cols = ['ITEM', 'NA SEMANA', 'TEM AGORA', 'SAI ATÉ CHEGAR', 'PEDIR', 'PAGO ÚLT.', 'TOTAL']
    let de = 0
    for (const c of cols) {
      const i = CODIGO.indexOf(`>${c}`, de)
      expect(i, `a coluna "${c}" da mesa saiu da tela ou trocou de ordem`).toBeGreaterThan(-1)
      de = i
    }
  })

  it('⭐ as 6 colunas do PLANO, na ordem da referência (lei C9)', () => {
    const cols = ['PORÇÃO', 'TEM AGORA', 'MÍNIMO', 'SAI HOJE', 'PRODUZIR']
    let de = CODIGO.indexOf('O PLANO DE PRODUÇÃO')
    for (const c of cols) {
      const i = CODIGO.indexOf(`>${c}`, de)
      expect(i, `a coluna "${c}" do plano saiu da tela ou trocou de ordem`).toBeGreaterThan(-1)
      de = i
    }
  })
})

/* ═══════════════════════ 4 · AS FRASES, NOS DOIS LADOS ═══════════════════════ */

/**
 * ⭐⭐ TODA ASSERÇÃO DE FRASE É DE DOIS LADOS: a frase existe **na REFERÊNCIA** *e* **no
 * CÓDIGO**. ⛔ Uma asserção que só olhasse o código me deixaria escrever qualquer coisa e
 * chamar de *"o que o dono aprovou"* (a lição do guard da margem, 07/10).
 */
const cru = (s: string) => s.replace(/\s+/g, ' ').trim()

function fraseNosDoisLados(texto: string) {
  expect(cru(REF.html), `a referência não imprime "${texto}"`).toContain(cru(texto))
  expect(cru(CODIGO), `a tela parou de imprimir "${texto}"`).toContain(cru(texto))
}

describe('⭐⭐ AS FRASES DECLARADAS — na referência E na tela', () => {
  it('⭐ a agenda e a mesa dizem o que o arquivo manda', () => {
    fraseNosDoisLados('pedido = chegada − prazo do fornecedor')
    fraseNosDoisLados('A MESA DE PEDIDO — UM PEDIDO POR FORNECEDOR')
    fraseNosDoisLados('O PLANO DE PRODUÇÃO — O QUE PRODUZIR')
    fraseNosDoisLados('PARA ONDE FOI')
  })

  it('⭐ o rodapé da honestidade — e ele NOMEIA o "a apurar"', () => {
    fraseNosDoisLados('consumo = o livro (baixas + separações)')
    fraseNosDoisLados('dia sem dado')
    fraseNosDoisLados('a ordem nasce na receita')
  })

  it('⭐ os dias de chegada dizem que o toque GRAVA (lei C5)', () => {
    fraseNosDoisLados('DIAS DE CHEGADA')
    fraseNosDoisLados('grava na config do item')
  })

  it('⛔⛔ o ⓘ da mesa é NÚMERO ROTULADO — PROSA É PROIBIDA (lei C8)', () => {
    for (const r of ['cobre', 'sai na janela', 'folga', 'precisa', 'sobra na chegada', 'pedir']) {
      fraseNosDoisLados(r)
    }
    /**
     * ⛔⛔ E O TESTE QUE MORDE DE VERDADE É ESTRUTURAL: **todo pedaço do ⓘ carrega um NÚMERO**.
     *
     * ⚠️⚠️ A minha 1ª versão media o TAMANHO do texto solto e deu **falso vermelho contra a
     * tela certa** — ela acusou os próprios rótulos (*"sai na janela"*, *"sobra na chegada"*),
     * que são exatamente o que a lei C8 pede. ***Guard que mede comprimento não distingue
     * rótulo de prosa*** (a família da janela de distância, que já produziu falso vermelho E
     * falso verde nesta casa).
     *
     * ⭐ O que separa os dois é o NÚMERO: *"cobre seg+ter"* é rótulo+valor; *"pedimos a mais
     * porque o fornecedor atrasa"* é prosa — e prosa **não tem `<b>` com número dentro**. Então
     * a régua é: tantos `<b>` quantos pedaços. Prosa entra como pedaço sem número e estoura.
     */
    const i = CODIGO.indexOf('ⓘ cobre')
    expect(i, 'o ⓘ da conta aberta saiu da mesa').toBeGreaterThan(-1)
    // ⚠️ a fatia começa no ABRE da lista, não no 1º rótulo: começando em "ⓘ cobre" ela perderia
    //    o `<>` do primeiro pedaço e o guard cobraria 6 contra 5 — com a tela correta.
    const bloco = CODIGO.slice(CODIGO.lastIndexOf('[', i), CODIGO.indexOf('].map(', i))
    const pedacos = (bloco.match(/<>/g) ?? []).length
    const numeros = (bloco.match(/<b style=/g) ?? []).length
    expect(pedacos, 'o ⓘ ficou sem pedaço nenhum').toBeGreaterThanOrEqual(6)
    expect(numeros, `o ⓘ tem ${pedacos} pedaços e só ${numeros} números — pedaço sem número é PROSA`)
      .toBe(pedacos)
  })
})

/* ═══════════════════════ 5 · A MATEMÁTICA VEM DA LIB, NUNCA DA TELA ═══════════════════════ */

describe('⛔⛔⛔ A TELA NÃO CALCULA — a conta mora na lib pura', () => {
  it('⭐⭐ os nomes que o `<script>` da referência declara existem na LIB com os MESMOS nomes', () => {
    // ⚠️ a referência chama de `contaDoPedido`/`contaDoPlano` e manda: *"lib pura em prod"*
    for (const n of ['contaDoPedido', 'contaDoPlano']) {
      expect(REF.script, `o <script> da referência não declara ${n}`).toContain(n)
      expect(ler(R(LIB_PURA)), `a lib pura não exporta ${n}`).toContain(`export function ${n}`)
    }
  })

  it('⭐⭐ as CONSTANTES da lei C15 vivem na lib com nome, nunca digitadas na tela', () => {
    const lib = ler(R(LIB_PURA))
    expect(lib).toContain('export const FOLGA_PADRAO = 1.1')
    expect(lib).toContain('export const PAR_DIAS = 3')
    expect(lib).toContain('export const ANTECEDENCIA_PADRAO = 1')
    /**
     * ⛔⛔ A FOLGA EXIBIDA VEM DO SERVIDOR (ela é POR ITEM, lei C5) — e a régua aqui é
     * ESTRUTURAL de propósito.
     *
     * ⚠️⚠️ A minha 1ª versão proibia `/\+10%['"`]/` — o `+10%` seguido de QUOTE — e veio
     * **VERDE com o defeito reposto**, porque a reposição real escreveu `+10%` seguido de
     * quebra de linha e `</span>`. ***Guard que proíbe UMA FORMA aprova a próxima*** (a
     * cicatriz do vendido somado por fora, 11/10).
     *
     * ⭐ O que morde é proibir **o literal `10%` em qualquer forma** na tela: a folga só pode
     * chegar pelo payload. ⚠️ Isso cobre também o `?? 10` de default que eu tinha deixado no
     * cabeçalho da mesa — a constante da lib digitada na tela.
     */
    expect(CODIGO, 'a folga de 10% foi DIGITADA na tela em vez de vir do payload').not.toContain('10%')
    expect(CODIGO, 'a folga chegou por default cravado em vez do payload').not.toMatch(/folga\s*\?\?\s*\d/)
  })

  it('⛔⛔ a tela não tem conta de PEDIDO/PLANO própria', () => {
    /**
     * ⚠️ A régua é ESTRUTURAL, não por nome de variável: *guard que proíbe uma forma aprova a
     * próxima* (a cicatriz do vendido somado por fora, 11/10). O que se proíbe é a tela
     * MULTIPLICAR pela folga ou dividir pela média — as duas contas que a lib faz.
     */
    expect(CODIGO, 'a tela multiplicou pela folga').not.toMatch(/\*\s*1\.1\b/)
    expect(CODIGO, 'a tela usou PAR_DIAS por conta própria').not.toContain('PAR_DIAS')
    expect(CODIGO, 'a tela dividiu por 7 (média por dia) por conta própria').not.toMatch(/\/\s*7\b/)
  })

  it('⭐⭐ o − / + e o TOTAL do card leem a LIB — uma régua, dois leitores', () => {
    expect(usosDe(CODIGO, 'ajustarQuantidade'), 'o − / + tem aritmética própria na tela').toBeGreaterThan(0)
    expect(usosDe(CODIGO, 'totalDoCard'), 'o total do card tem soma própria na tela').toBeGreaterThan(0)
    // ⛔ e o SERVIDOR lê a MESMA: com duas réguas, o card mostraria um total ao abrir e outro
    //    depois do primeiro clique — e ele é o número que o dono leva pro fornecedor.
    expect(usosDe(semComentarios(ler(R(LEITURA))), 'totalDoCard'), 'a leitura do servidor soma por conta própria').toBeGreaterThan(0)
  })

  it('⭐ o texto do WhatsApp vem da LIB, com as quantidades AJUSTADAS', () => {
    expect(usosDe(CODIGO, 'textoDoPedido'), 'a tela monta o texto do pedido à mão').toBeGreaterThan(0)
    // ⚠️ e o nome da empresa vem do PAYLOAD (cadastro), nunca cravado na tela
    expect(CODIGO, 'a tela não usa o nome da empresa do payload').toContain('dados.empresa')
  })

  it('⛔ o relógio entra UMA vez, pelo servidor (`hojeSegPrimeiro`)', () => {
    /**
     * ⚠️ `new Date()` na tela decidindo "hoje" é a cicatriz do tablet que mentiu zero por dois
     * dias (08/09): relógio de aparelho pode estar torto, e aqui ele escolheria o dia-da-semana
     * que decide a conta do pedido inteira.
     */
    expect(CODIGO, 'a tela leu o relógio pra decidir o dia').not.toMatch(/new Date\(\)/)
    expect(CODIGO, 'a tela não usa o `hojeSegPrimeiro` do servidor').toContain('hojeSegPrimeiro')
  })
})

/* ═══════════════════════ 6 · AS RÉGUAS DE HONESTIDADE ═══════════════════════ */

describe('⛔⛔ "A APURAR" NUNCA VIRA ZERO (lei C2)', () => {
  it('⭐ o Δ%, a cobertura, o preço e a perda dizem "a apurar" quando não há base', () => {
    for (const r of [
      'sem período anterior pra comparar',
      'sem compra suficiente pra comparar',
    ]) {
      expect(CODIGO, `a tela parou de dizer "${r}"`).toContain(r)
    }
    /**
     * ⚠️⚠️ **REAPONTADO EM 17/10, NÃO AFROUXADO — e o alvo antigo era o DEFEITO.** Este bloco
     * exigia a frase **"sem média medida ainda"** na tela; ela era exatamente a contradição que
     * o dono reportou (*"cobertura 7,6 dias · sem média medida ainda"* — um número com a legenda
     * se contradizendo ao lado). A frase MORREU. ⭐ A pergunta não mudou (*"a tela diz 'a apurar'
     * quando não há base?"*), mudou o DONO da resposta: a legenda vem do servidor
     * (`legendaDaCobertura`), e é lá que *"sem consumo medido ainda"* vive — provado em
     * `lib/compras/__tests__/dia-do-consumo.test.ts`.
     */
    expect(CODIGO, 'a legenda da cobertura voltou a ser montada na TELA').toContain('item.coberturaLegenda')
    expect(CODIGO, 'a contradição de 17/10 voltou: a tela nega a média que ela mesma usa')
      .not.toContain('sem média medida ainda')
    expect((CODIGO.match(/a apurar/g) ?? []).length, 'a tela deixou de nomear "a apurar"').toBeGreaterThan(4)
  })

  /**
   * ⚠️⚠️ **REAPONTADO E MAIS FORTE (17/10).** A âncora antiga era `/valor == null …{0,200} dashed/`
   * — e ela tinha DOIS problemas: (a) `valor == null` É A PERGUNTA DO DEFEITO (era ela que
   * colapsava *"zero medido"* com *"a apurar"*); (b) **janela de distância**, a classe que já
   * produziu falso vermelho E falso verde nesta casa nove vezes.
   *
   * ⭐ Agora a régua é a LEI: quem decide é o `estado` que o servidor mandou, a barra "a apurar"
   * é tracejada e vazia, e a de **ZERO é CHEIA, no chão** (3% de piso), com o "0" escrito.
   */
  it('⭐⭐ dia PENDENTE é barra vazia tracejada — e ZERO é barra CHEIA no chão', () => {
    const bloco = semComentarios(blocoEntre(CODIGO, 'function BarrasDaSemana', '/* ═'))
    expect(bloco, 'a tela voltou a decidir "a apurar" por `valor == null`').not.toMatch(/valor == null/)
    expect(bloco, 'a barra deixou de decidir pelo ESTADO que o servidor mandou').toMatch(/b\.estado === 'PENDENTE'/)
    expect(bloco, 'a barra "a apurar" deixou de ser tracejada').toMatch(/aApurar[\s\S]*?dashed \$\{CC\.linha\}/)
    // ⭐ ZERO não pode virar barra invisível: o piso de 3% é o que faz o dia medido APARECER
    expect(bloco, 'a barra do dia FECHADO com zero deixou de ter piso — ela desaparece').toMatch(/Math\.max\(3,/)
    // ⛔ e o número "0" tem que ser ESCRITO (zero é dado, não ausência)
    expect(bloco, 'o número do dia zero voltou a ser "—"').toMatch(/aApurar \? '—' : fmt1\(b\.valor \?\? 0\)/)
  })

  it('⭐⭐ HOJE é dia ABERTO e a tela DIZ isso — nunca um dia fechado disfarçado', () => {
    const bloco = semComentarios(blocoEntre(CODIGO, 'function BarrasDaSemana', '/* ═'))
    expect(bloco, 'o selo de hoje sumiu da barra').toMatch(/hoje · parcial/)
    expect(bloco, 'a barra de hoje deixou de se distinguir do dia fechado').toMatch(/b\.estado === 'HOJE'/)
    expect(CODIGO, 'a legenda deixou de explicar o parcial de hoje').toContain('hoje · parcial')
  })

  it('⭐⭐ UM selo de "tem dia a apurar" no herói — e só com pendência de verdade', () => {
    // ⛔ anti-spam: um caso, um alarme. E quem decide é o SERVIDOR, nunca a tela varrendo barras.
    expect(usosDe(CODIGO, 'temDiaAApurar'), 'o selo do herói sumiu').toBeGreaterThan(0)
    expect(CODIGO, 'o selo deixou de ser gateado pela pendência do servidor')
      .toMatch(/item\.temDiaAApurar && \(/)
    expect((CODIGO.match(/tem dia a apurar/g) ?? []).length, 'o selo virou N selos').toBe(1)
  })

  it('⭐⭐ item sem config APARECE e é DITO (lei C5) — nunca escondido', () => {
    expect(CODIGO, 'o item sem config sumiu da tela').toContain('semConfig')
    // ⚠️ `cru` porque o JSX quebra a frase em duas linhas — comparar o texto bruto daria falso
    //    vermelho com a tela CERTA (a cicatriz do `Sa\xeddas:` de 15/09, em outra forma)
    expect(cru(CODIGO), 'a tela não ensina a saída do item fora da mesa').toContain('configura os dias de chegada')
  })

  it('⭐ o que o livro NÃO sabe atribuir é dito, nunca rateado (divergência 3 da leitura)', () => {
    expect(CODIGO, 'a tela esconde o consumo não atribuído').toContain('naoAtribuido')
    expect(CODIGO, 'a tela não explica por que a venda não é rateada').toContain('não é rateado por palpite')
  })

  it('⛔⛔ o PLANO só APONTA — nenhuma porta de escrita de produção nasce aqui (lei C9)', () => {
    expect(CODIGO, 'a tela parou de oferecer o caminho da ordem').toContain('criar ordem')
    // ⛔ "só aponta": a ordem nasce na receita, com o preview do que sai da câmara
    expect(CODIGO, 'a tela cria ordem de produção por conta própria').not.toMatch(/\/ordens['"`]/)
  })
})

describe('⭐⭐ A TELA NOVA NASCEU COM O GUARD DA CASA', () => {
  it('⭐ `fetchComTimeout` + estados EXPLÍCITOS + "tentar de novo"', () => {
    expect(usosDe(CODIGO, 'fetchComTimeout'), 'a tela usa fetch cru (spinner eterno, 20/09)').toBeGreaterThan(0)
    for (const e of ['CARREGANDO', 'FALHOU', 'OK']) {
      expect(CODIGO, `o estado ${e} não existe — "ausência de dado" voltou a ser estado`).toContain(e)
    }
    expect(CODIGO, 'a tela não oferece "tentar de novo"').toContain('tentar de novo')
  })

  it('⛔⛔ a empresa vem da PORTA ÚNICA, nunca de `document.cookie`', () => {
    // ⚠️ o `current_empresa_id` é httpOnly: o cliente NÃO o enxerga (a lixeira de 20/09)
    expect(CODIGO, 'a tela leu cookie no cliente').not.toContain('document.cookie')
    expect(CODIGO, 'a tela não resolve a empresa pelos params').toContain('use(params)')
  })

  it('⭐ a tela PERGUNTA quem pode configurar — não oferece chip que o servidor recusa', () => {
    // ⚠️ o "chip mudo" de 17/09: gesto que leva 403 é trabalho que o dono faz pra levar um não
    expect(CODIGO, 'a tela não consulta as permissões').toContain('podeConfigurar')
    expect(CODIGO).toContain('stock.manage')
  })

  it('⭐ falha ao gravar é ESTADO, nunca silêncio', () => {
    expect(CODIGO, 'a tela engole a falha de gravar os dias de chegada').toContain('Não consegui gravar os dias de chegada')
  })
})

/* ═══════════════════════ 7 · LEI C0 · A PRODUÇÃO FICA INTOCADA ═══════════════════════ */

describe('⛔⛔⛔ LEI C0 — A TELA DE PRODUÇÃO FICA INTOCADA', () => {
  /**
   * ⭐⭐ A lei C0 é a primeira do arquivo, e ela é sobre o que NÃO se mexe. Este guard afirma
   * os dois lados: a tela nova existe na rota PRÓPRIA **e** nada dela mora dentro de
   * `producao/`. ⛔ Um guard que só afirmasse a existência aprovaria o dia em que alguém
   * resolvesse "aproveitar" a tela da cozinha pra encaixar a mesa de pedido.
   */
  it('⭐ a tela nova mora na rota própria', () => {
    expect(existsSync(R(TELA)), 'a tela de Consumo & Compras não existe na rota própria').toBe(true)
  })

  it('⛔⛔ nenhum arquivo de `producao/` conhece esta tela', () => {
    const alvos = [
      'app/(dashboard)/empresas/[id]/estoque/producao/page.tsx',
      'app/(dashboard)/empresas/[id]/estoque/producao/hoje/page.tsx',
      'components/estoque/mesa-da-cozinha.tsx',
    ].filter((p) => existsSync(R(p)))
    expect(alvos.length, 'os arquivos da Produção não foram achados — o guard ficaria vazio').toBeGreaterThan(1)
    for (const p of alvos) {
      const s = semComentarios(ler(R(p)))
      expect(s, `${p} passou a falar de consumo-e-compras — a lei C0 proíbe`).not.toContain('consumo-e-compras')
      expect(s, `${p} passou a montar a mesa de pedido`).not.toContain('contaDoPedido')
    }
  })

  it('⛔ a tela nova não importa nada de `producao/` (ela só LINKA pra lá)', () => {
    const imports = [...CRU.matchAll(/from '([^']+)'/g)].map((m) => m[1]!)
    for (const i of imports) {
      expect(i, `a tela importou de producao/ (${i}) — a lei C0 pede rota própria`).not.toMatch(/\/producao\//)
    }
  })
})

/* ═══════════════════════ 8 · O ITEM NO TRILHO ═══════════════════════ */

describe('⭐⭐ O TRILHO — o item nasce logo abaixo de Produção (lei C0)', () => {
  const SIDEBAR = semComentarios(ler(R('components/sidebar/global-sidebar.tsx')))

  it('⭐ o item existe, com a chave certa', () => {
    expect(SIDEBAR, 'o item "Consumo & Compras" não está no trilho').toContain('Consumo & Compras')
    expect(SIDEBAR).toContain('/estoque/consumo-e-compras')
  })

  it('⭐⭐ ele está DEPOIS de Produção — a ordem que a lei C0 declara', () => {
    const iProd = SIDEBAR.indexOf('label="Produção"')
    const iNovo = SIDEBAR.indexOf('label="Consumo & Compras"')
    expect(iProd, 'o item Produção não está no trilho').toBeGreaterThan(-1)
    expect(iNovo, 'o item novo não está no trilho').toBeGreaterThan(-1)
    expect(iNovo, 'o item novo está ANTES de Produção').toBeGreaterThan(iProd)
  })

  it('⛔ o ícone é PRÓPRIO — não o de "Vendas (Suitable)"', () => {
    /**
     * ⚠️ Dois itens com o MESMO ícone no mesmo grupo matam o reconhecimento, que é a razão de
     * o ícone existir. O guard mede a vizinhança do label, não o arquivo inteiro.
     */
    const i = SIDEBAR.indexOf('label="Consumo & Compras"')
    const bloco = SIDEBAR.slice(Math.max(0, i - 200), i)
    expect(bloco, 'o item novo usa o ícone de Vendas').not.toContain('icon={ShoppingCart}')
    expect(bloco, 'o item novo não declara ícone próprio').toContain('icon={ShoppingBasket}')
  })
})

/* ══════════ 7 · A LEI DO DIA FECHADO MORA NA REFERÊNCIA *E* NO CÓDIGO (17/10) ══════════ */

/**
 * ⭐⭐ **GUARD DE DOIS LADOS, de propósito.** Guard que só olhasse o CÓDIGO aprovaria o dia em
 * que a lei saísse da referência versionada (e aí *"igual à referência"* voltaria a ser memória
 * minha — a cicatriz de 10/09); guard que só olhasse a REFERÊNCIA aprovaria a lei escrita e não
 * implementada (*"invariante planejado num doc e não construído é pior que invariante nenhum"*,
 * 23/08).
 */
describe('⭐⭐⭐ A LEI DO DIA FECHADO — na referência E no motor', () => {
  const REFCRU = ler(R(CAMINHO_DE_CONSUMO_E_COMPRAS))
  const LEI = semComentarios(ler(R('lib/compras/dia-do-consumo.ts')))
  const LEITURA_SRC = semComentarios(ler(R(LEITURA)))

  it('⭐ a REFERÊNCIA declara a lei no C2, com a aprovação do dono datada', () => {
    for (const frase of [
      'A LEI DO DIA FECHADO',
      'aprovado pelo dono 17/10',
      'CONSUMO 0',
      'ZERO É DADO',
      'DIA ABERTO',
      'hoje · parcial',
      'tem dia a apurar',
    ]) {
      expect(REFCRU, `a referência parou de declarar "${frase}"`).toContain(frase)
    }
  })

  it('⭐ o C12 virou UMA verdade: até 10 compras, com a constante nomeada', () => {
    /**
     * ⚠️⚠️ A asserção mede a **REGRA**, não a ausência da palavra — e isto nasceu de um vermelho:
     * a 1ª versão proibia *"média das 4 últimas"* no arquivo inteiro e **reprovou a própria nota
     * que DOCUMENTA a troca** (*"ERA 'média das 4 últimas' …"*). ***O arquivo que registra o
     * defeito não pode ser condenado por registrá-lo*** — então o proibido é o "4" na
     * ESPECIFICAÇÃO (o `<script>`, que é o comportamento que a tela copia) e no enunciado da lei.
     */
    expect(REF.script, 'a ESPECIFICAÇÃO do C12 voltou a dizer "média das 4 últimas"')
      .not.toMatch(/média das 4 últimas/)
    expect(REFCRU, 'o C12 deixou de declarar o teto novo').toMatch(/até 10/)
    expect(REFCRU, 'o C12 deixou de nomear a constante').toContain('COMPRAS_NA_MEDIA')
    expect(semComentarios(ler(R(LIB_PURA))), 'a constante do C12 saiu da lib pura')
      .toMatch(/COMPRAS_NA_MEDIA = 10/)
    // ⛔ e o 4 não pode voltar DIGITADO no motor
    expect(LEITURA_SRC, 'o motor voltou a cravar 4 compras na média do preço')
      .not.toMatch(/slice\(0, 4\)|slice\(1, 4\)/)
  })

  it('⭐ o C13 diz a JANELA usada — e a janela não é digitada em lugar nenhum', () => {
    expect(REFCRU, 'o C13 deixou de declarar a janela da cobertura').toContain('média de 28d')
    // ⚠️ na tela e na lei, o número vem do parâmetro/constante — nunca um "28" cravado
    expect(LEI, 'a legenda da cobertura cravou a janela').not.toMatch(/média de 28d/)
  })

  it('⛔⛔ a LEI é PURA — ela não conhece banco nem React', () => {
    for (const proibido of ['prisma', '@prisma/client', 'react']) {
      expect(LEI.toLowerCase(), `a lei do dia fechado passou a importar ${proibido}`)
        .not.toContain(`from '${proibido}`)
    }
  })

  it('⭐⭐ BARRAS e BASELINE leem a MESMA lei — nunca duas montagens', () => {
    // ⛔ duas montagens divergiriam no 1º estado novo, e a barra diria "0" num dia que a média
    //    tratou como pendente (o B1 dentro de um item só)
    expect(usosDe(LEITURA_SRC, 'montarDias'), 'a baseline parou de usar a lei das barras')
      .toBeGreaterThanOrEqual(3)
    expect(LEITURA_SRC, 'a baseline voltou a decidir por `porDia.has`')
      .not.toMatch(/total: porDia\.has/)
    expect(LEITURA_SRC, 'a média deixou de perguntar pra lei quem entra').toContain('entraNaMedia')
  })

  it('⛔ a pendência é MEDIDA — e a trava do item não alcançado pela venda segue de pé', () => {
    const PEND = semComentarios(ler(R('lib/compras/pendencia-do-livro.ts')))
    expect(PEND, 'a pendência deixou de exigir o import do dia como evidência')
      .toContain('stockVendaImport')
    expect(PEND, 'a trava (c) caiu: item não alcançado pela venda voltaria a dizer "a apurar"')
      .toMatch(/itensAlcancadosPorVenda\.has\(itemId\) \? p\.diasSemBaixa : SEM_PENDENCIA/)
    expect(usosDe(LEITURA_SRC, 'pendentesDoItem'), 'o motor parou de usar a régua por item')
      .toBeGreaterThan(0)
  })
})
