/**
 * ⛔⛔⛔ A HOME DA PRODUÇÃO — o mock v3 virou régua (04/10/2026).
 *
 * **As decisões de design do dono que este arquivo trava:**
 * - *"Nova ordem preenchido de ÍNDIGO — a ÚNICA coisa preenchida de cor forte na tela"*;
 * - *"os 6 links viram chips IGUAIS, NENHUM aceso/preenchido — esta é a tela principal, quem diz
 *   onde estou é o título"*;
 * - *"NADA de fundo bege na linha inteira — o fio e o selo bastam"* (o banner âmbar morreu);
 * - *"Cores SEMPRE por token/escala da casa (dark mode tem que funcionar)"*.
 *
 * ⭐⭐ **POR QUE ESTRUTURAL:** nenhuma dessas é uma conta que dê pra provar por comportamento —
 * são decisões de LINGUAGEM VISUAL, e o jeito de elas sobreviverem a mim em três meses é um
 * teste que lê a tela. ⚠️ E o custo de perdê-las é concreto: dois primários competindo fazem a
 * ação principal deixar de ser óbvia, e coral numa receita comum mata o contraste do alarme de
 * ordem atrasada.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const raiz = process.cwd()
const ler = (rel: string) => readFileSync(join(raiz, rel), 'utf8')
const semComentario = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^[ \t]*\/\/.*$/gm, '')

const TELA = 'app/(dashboard)/empresas/[id]/estoque/producao/page.tsx'
const CSS = 'app/globals.css'
const CARA = 'lib/stock/producao/cara-da-receita.ts'

describe('⭐⭐ o topo: título, linha editorial e UM primário', () => {
  it('⭐ a raiz declara o escopo dos tokens', () => {
    expect(semComentario(ler(TELA))).toContain('data-tela="producao-home"')
  })

  it('⭐⭐ a linha editorial é SERIFADA e em itálico, pelo CSS do escopo', () => {
    const tela = semComentario(ler(TELA))
    expect(tela, 'a linha usa a classe .editorial').toMatch(/className="editorial/)
    const css = ler(CSS)
    const bloco = css.slice(css.indexOf("[data-tela='producao-home'] .editorial"))
    expect(bloco.slice(0, 220), 'serif + itálico no CSS, não inline').toMatch(/ui-serif[\s\S]*font-style: italic/)
  })

  /**
   * ⛔⛔ **UM PRIMÁRIO SÓ.** `--fam-*-mid` como FUNDO é "cor forte preenchida"; ela só pode
   * aparecer no "Nova ordem" e no "aplicar" do calendário (o primário DAQUELE painel, que é
   * transiente e só existe depois do dono abri-lo). Mais que isso e a ação principal se perde.
   */
  /**
   * ⚠️⚠️ REAPONTADO em 04/10 (sprint dos dois temas), **não afrouxado** — e ficou MAIS FORTE.
   * A régua é a mesma (*"cor forte preenchida só nos primários, e são DOIS"*); o que mudou é
   * que o "Nova ordem" passou a ler `--prod-acao-bg`/`--prod-acao-ink` em vez de
   * `--fam-indigo-mid` + `text-white` cravado. O motivo é de CONTRASTE: no tema escuro o fundo
   * da ação CLAREIA (#7F77DD) e o texto tem que ESCURECER junto — com `text-white` fixo o
   * único botão forte da tela ficaria branco sobre lilás claro. Então o guard passou a exigir
   * também o TOKEN DE TINTA, que a versão anterior nem olhava.
   */
  /**
   * ⚠️⚠️ REAPONTADO em 04/10 (os 3 ajustes do dono) — **e ficou mais forte, não mais frouxo.**
   * A régua é *"dois primários não competem"*, e um **PONTINHO de 7px sem texto não disputa o
   * papel de ação principal** — ele é SINAL (o fiscal acusou impossível naquela linha). O que
   * continua proibido é cor forte em CONTROLE: botão, chip, linha inteira. Então o guard passou
   * a separar os dois papéis **e a travar o sinal no tamanho de sinal**: no dia em que alguém
   * der `px-2 py-1` e um rótulo ao pontinho, ele vira um botão coral competindo com o
   * "Nova ordem" — e aí o teste morde.
   */
  it('⭐⭐ cor forte preenchida aparece em DOIS lugares, e os dois são primários', () => {
    const tela = semComentario(ler(TELA))
    const todos = [...tela.matchAll(/background: 'var\(--fam-[a-z]+-mid\)'/g)]
    const acao = [...tela.matchAll(/background: 'var\(--prod-acao-bg\)'/g)]

    /**
     * ⭐ o SINAL do fiscal: círculo pequeno, sem texto, com nome pra leitor de tela.
     * ⚠️ REAPONTADO em 05/10 — ele **mudou de casa** (fim da linha → canto do logo) e o guard
     * seguiu a casa nova. A régua não mudou: sinal é sinal, e sinal não vira controle.
     */
    const iSinal = tela.indexOf('{alerta && (')
    const sinal = tela.slice(iSinal)
    const tagDoSinal = sinal.slice(0, sinal.indexOf('/>') + 2)
    expect(tagDoSinal, 'o pontinho é um círculo de 9px no canto').toMatch(/h-\[9px\] w-\[9px\][^"]*rounded-full/)
    expect(tagDoSinal, 'sinal sem nome é enfeite').toMatch(/aria-label=/)
    expect(/px-\d|py-\d|text-\[/.test(tagDoSinal), 'pontinho com padding/texto é um botão disfarçado').toBe(false)
    /** ⚠️ por POSIÇÃO, nunca por texto: filtrar pelo literal apagaria um coral legítimo
     *  de outro lugar da tela, e aí o guard deixaria de contar o que ele existe pra contar. */
    const fimDoSinal = iSinal + tagDoSinal.length
    const familia = todos.filter((u) => u.index! < iSinal || u.index! >= fimDoSinal)

    expect(
      familia.length + acao.length,
      'cor forte preenchida fora dos primários = dois primários competindo',
    ).toBe(2)
    /**
     * ⭐⭐ E A PÍLULA "% do pedido" (05/10) usa o degrau **`-bg`** (fundo suave + tinta `-ink`),
     * nunca o `-mid` preenchido — é isso que a mantém **fora da disputa de primário** mesmo
     * sendo colorida em toda linha da lista.
     */
    const pilula = tela.slice(tela.indexOf('{pil && ('), tela.indexOf('{pil && (') + 600)
    expect(pilula, 'a pílula pinta com o fundo suave da família').toMatch(/fam\(TOM_DO_PEDIDO\[pil\.tom\]\)\.bg/)
    expect(pilula, 'e a tinta é o `ink` da MESMA família (nunca preto em fundo colorido)').toMatch(/\.ink/)
    expect(/-mid\)'/.test(pilula), 'pílula preenchida de cor forte competiria com o "Nova ordem"').toBe(false)
    // ⭐ a ação principal é UMA, e ela usa o par de tokens (fundo + tinta)
    expect(acao.length, 'o "Nova ordem" é o primário da TELA').toBe(1)
    expect(tela, 'e a TINTA dele também é token — senão o escuro fica ilegível').toMatch(
      /color: 'var\(--prod-acao-ink\)'/,
    )
    // o outro é o primário do painel transiente, e ele é índigo (nunca outra família)
    for (const u of familia) expect(u[0]).toContain('--fam-indigo-mid')
  })

  /**
   * ⛔ Os 6 chips são IGUAIS. Acender um diria que o dono está DENTRO daquela sub-tela —
   * e ele está na principal.
   */
  it('⭐⭐ os 6 chips de navegação, nenhum com estado aceso', () => {
    const tela = semComentario(ler(TELA))
    const chips = [...tela.matchAll(/<ChipNav href=/g)]
    expect(chips.length, 'os 6 atalhos do mock').toBe(6)

    /** ⚠️ a fatia terminava em `function PilulaEf`, que o dono APOSENTOU em 04/10 — com
     *  `indexOf` devolvendo −1 o slice passou a varrer a tela inteira e mordeu o `ativo` do
     *  `CardMetrica` (que é filtro legítimo). Reapontado pro vizinho que existe. */
    const comp = tela.slice(tela.indexOf('function ChipNav'), tela.indexOf('function dataPorExtenso'))
    expect(comp, 'o ChipNav não pode ter prop de ativo/aceso').not.toMatch(/\bativo\b|\baceso\b|\batual\b/)
    expect(comp, 'nem estilo condicional (um ternário de cor é um chip aceso disfarçado)').not.toMatch(/\?.*background|background.*\?/)
  })
})

describe('⛔⛔ a linha ATRASADA fala CORAL — e o banner bege morreu', () => {
  it('⭐⭐ o banner âmbar de largura total não existe mais', () => {
    const tela = semComentario(ler(TELA))
    expect(
      /className="flex w-full items-center[^"]*"[\s\S]{0,200}C\.ambarBg/.test(tela),
      'o banner bege de largura total foi aposentado por decisão de design',
    ).toBe(false)
    // ⭐ mas a FUNÇÃO ficou: o alerta virou o "N desde ontem" que FILTRA (realocação, não perda)
    expect(tela).toMatch(/desde ontem`/)
    expect(tela, 'e ele continua sendo o botão que filtra').toMatch(/onClick=\{onFiltrarOntem\}/)
  })

  it('⛔ a linha atrasada NÃO ganha fundo — só o fio, o ícone e o selo', () => {
    const tela = semComentario(ler(TELA))
    const lista = tela.slice(tela.indexOf('function ListaAbertas'), tela.indexOf('function ListaConcluidas'))
    // o filete coral existe…
    expect(lista).toMatch(/borderLeft: `3px solid \$\{t\.mid\}`/)
    expect(lista, 'o relógio coral no quadradinho').toMatch(/familia: 'coral', Icone: Clock/)
    expect(lista, 'e o selo "atrasada"').toMatch(/>atrasada</)
    /**
     * …e NENHUM background na LINHA.
     * ⚠️ **A 1ª versão deste teste estava errada, não a tela:** a fatia ia até o `</a>` e
     * engolia a PÍLULA "atrasada" — que tem fundo coral-50 **por pedido do dono**. O que é
     * proibido é a linha INTEIRA pintada (o fundo bege), e isso mora na tag de ABERTURA do
     * `<a>`. *Guard largo demais reprova o certo e ensina a afrouxar.*
     */
    const abre = lista.slice(lista.indexOf('<a key={o.id}'))
    const tagDeAbertura = abre.slice(0, abre.indexOf('}}>') + 3)
    expect(/background:/.test(tagDeAbertura), 'fundo na linha inteira foi proibido pelo dono').toBe(false)
    expect(tagDeAbertura, 'o que a linha pinta é só o filete').toMatch(/borderLeft/)
  })

  /**
   * ⛔⛔ CORAL É DO ALARME. Se o mapa de receitas puder devolver coral, toda linha daquela
   * receita nasce com a cara de atrasada — e a 1ª versão da lib fazia isso com CARNE, a receita
   * mais produzida da casa.
   */
  it('⭐⭐ nenhuma receita pode ser coral (é a cor da ordem atrasada)', () => {
    const cara = semComentario(ler(CARA))
    const tipos = cara.slice(cara.indexOf('const TIPOS'), cara.indexOf('const DO_HASH'))
    expect(/familia: 'coral'/.test(tipos), 'carne/porção/massa/preparo não podem ser coral').toBe(false)
    const hash = cara.slice(cara.indexOf('const DO_HASH'), cara.indexOf('function normalizar'))
    expect(/'coral'/.test(hash), 'o hash não pode sortear coral').toBe(false)
  })
})

describe('⭐ as listas: avatar, par tipográfico e pílula', () => {
  /**
   * ⚠️⚠️ **ACHADO NA PROVA EM PROD:** o mock diz *"200 UN pedidas"* e assume que a meta existe —
   * mas as 5 ordens abertas da Caçula são **todas DERIVADO** (o `stockOrdemMeta` só começou em
   * 04/10). Chamar de "pedidas" um número que o dono nunca digitou é o *"pedido 0"* de novo.
   */
  it('⭐⭐ "pedidas" só no DECLARADO; o derivado diz "esperadas"', () => {
    const tela = semComentario(ler(TELA))
    expect(tela).toMatch(/pedidoOrigem === 'DECLARADO' \? 'pedidas' : 'esperadas'/)
  })

  it('⭐⭐ o avatar é o MESMO componente da tela "Por dia"', () => {
    const tela = semComentario(ler(TELA))
    expect(tela).toMatch(/import \{ AvatarPessoa \} from '@\/components\/estoque\/avatar-pessoa'/)
    expect(tela, 'e ele desenha só o círculo — o nome está na sublinha').toMatch(/<AvatarPessoa [^>]*apenasAvatar/)
  })

  /**
   * ⛔⛔ **O PAR E A PÍLULA TÊM DENOMINADORES DIFERENTES.** `fez ÷ pedido` NÃO é a pílula (que é
   * a eficiência congelada contra a FICHA, a que o juiz P8 lê). Quem "simplificar" isso numa
   * divisão faz a tela e o e-mail do P8 discordarem sobre o mesmo lote.
   */
  /**
   * ⚠️⚠️ **INVERTIDO em 04/10 com o motivo escrito.** A metade CERTA deste caso — *"a tela NÃO
   * divide nada"* — continua sendo o que ele prova, e ficou mais apertada. O que caiu foi a
   * PÍLULA: ordem do dono, *"a pílula de % SAI DA LISTA da home — ela confundia, parecia
   * fez÷pedido e não é"*. ⭐ É a confissão do defeito que o comentário antigo deste arquivo já
   * descrevia (*"o par e a pílula têm denominadores diferentes"*): o problema não era a conta,
   * era **a tela pôr os dois lado a lado sem a régua**. Agora a lista mostra só o par de
   * números COM AS PALAVRAS, e o percentual vive onde tem a coluna do pedido ao lado (a tela
   * "Por dia") e no bloco de eficiência da ordem.
   */
  it('⛔⛔ a tela NÃO divide nada — e a pílula SAIU da lista', () => {
    const tela = semComentario(ler(TELA))
    const lista = tela.slice(tela.indexOf('function ListaConcluidas'))
    expect(lista, 'a pílula de % voltou pra lista e o par volta a parecer fez÷pedido').not.toMatch(/PilulaEf/)
    expect(
      /qtdGerada\s*\/|\/\s*pf\?\.pedido|\/\s*pedido\b/.test(lista),
      'nenhuma divisão: percentual nenhum nasce aqui',
    ).toBe(false)
    // ⭐ o que ficou: os DOIS números com as PALAVRAS escritas (nunca dois números soltos)
    expect(lista, 'a palavra "pedido" ao lado do número').toMatch(/>pedido </)
    expect(lista, 'a palavra "fez" ao lado do número').toMatch(/>fez </)
  })

  /**
   * ⚠️ REAPONTADO, não apagado: a régua da casa (`faixaDoSelo`) **não morreu com a pílula** —
   * ela continua servindo a tela "Por dia" e o juiz P8. Guard que só afirmasse a remoção
   * aprovaria o dia em que o percentual sumisse de todo lugar.
   */
  it('⭐ a régua da casa (faixaDoSelo) continua viva onde o % tem coluna ao lado', () => {
    const tela = semComentario(ler(TELA))
    expect(tela, 'a home não importa mais a régua — ela não desenha percentual').not.toContain('faixaDoSelo')
    const porDia = semComentario(ler('app/(dashboard)/empresas/[id]/estoque/producao/por-dia/page.tsx'))
    expect(porDia, 'na "Por dia" o percentual fica ao lado do pedido').toContain('faixaDoSelo(')
    expect(
      /0\.9|0\.85|1\.1|1\.15|>= 90|< 70/.test(porDia),
      'número de faixa digitado na tela é a 2ª régua',
    ).toBe(false)
  })

  /**
   * ⛔ Os cartões só VESTEM o `painel` que o servidor já montava. Σ ou divisão aqui seria a
   * conta paralela que a ordem do dono proíbe (REGRA 11).
   */
  it('⛔⛔ os 4 cartões não calculam nada — leem o painel do servidor', () => {
    const tela = semComentario(ler(TELA))
    const cards = tela.slice(tela.indexOf('{painel && ('), tela.indexOf('{/**') > 0 ? tela.indexOf('4. CHIPS') : undefined)
    expect(/reduce\(|\.length \/|\/ painel\./.test(cards), 'a tela não soma nem divide: o painel vem pronto').toBe(false)
    expect(cards, 'o rendimento vem do painel').toMatch(/painel\.rendimentoPeriodo/)
  })
})

describe('⭐⭐ acabamento: tokens, dark mode e os 3 degraus da família', () => {
  /**
   * ⚠️⚠️ REAPONTADO em 04/10 (sprint dos dois temas) — e a mudança de casa é o ponto do sprint.
   * Este guard afirmava o bloco ESCOPADO (`[data-tela='producao-por-dia'], [data-tela='producao-home']`),
   * e os tokens subiram pra **RAIZ** por ordem do dono (*"2 mapas de tokens NA RAIZ; as telas
   * modernas ganham o escuro de graça"*). ⛔ E não é preferência: `[data-tela='x']` (0,1,0)
   * EMPATA com `.dark` (0,1,0) — o bloco escopado venceria por ordem de arquivo e a tela
   * ficaria CLARA dentro do tema escuro. A régua continua sendo *"uma paleta só"*; quem a
   * guarda em detalhe agora é `dois-temas-na-raiz.test.ts`.
   */
  it('⭐⭐ a paleta das duas telas vive na RAIZ (uma paleta, dois temas)', () => {
    const css = ler(CSS)
    expect(css, 'o mapa CLARO na raiz').toMatch(/:root \{[\s\S]*?--prod-bg:/)
    expect(css, 'e o espelho ESCURO na raiz').toMatch(/\.dark \{[\s\S]*?--prod-bg:/)
    /** ⚠️ sem comentário: o bloco que DOCUMENTA a armadilha cita `[data-tela=…]` em texto, e o
     *  guard mordia a própria documentação dele (a lição de 21/09 pela enésima vez). */
    expect(
      semComentario(css),
      'token escopado volta a sombrear o .dark',
    ).not.toMatch(/\[data-tela=[^\]]+\][^{]*\{[^}]*--prod-/)
  })

  it('⭐⭐ cada família tem os 3 degraus, no claro E no escuro', () => {
    const css = ler(CSS)
    const familias = ['indigo', 'azul', 'verde', 'ambar', 'coral', 'teal', 'rosa', 'cinza']
    for (const f of familias) {
      for (const d of ['bg', 'mid', 'ink']) {
        const n = (css.match(new RegExp(`--fam-${f}-${d}:`, 'g')) ?? []).length
        expect(n, `--fam-${f}-${d} precisa existir no claro E no escuro`).toBe(2)
      }
    }
  })

  /**
   * ⛔ Nenhum hex de TEXTO fixo nas partes novas: o dono pediu *"nenhum hex de texto fixo fora
   * da família"*, e é isso que faz o dark mode funcionar sem retrabalho.
   */
  it('⛔ as partes novas não têm cor de texto em hex', () => {
    const tela = semComentario(ler(TELA))
    const novas = [
      tela.slice(tela.indexOf('function CardMetrica'), tela.indexOf('function ChipNav')),
      tela.slice(tela.indexOf('function ListaAbertas'), tela.indexOf('function ListaConcluidas')),
      tela.slice(tela.indexOf('function ListaConcluidas')),
    ]
    for (const bloco of novas) {
      expect(/color: '#|color: "#/.test(bloco), 'use os tokens da família, não hex').toBe(false)
    }
  })
})
