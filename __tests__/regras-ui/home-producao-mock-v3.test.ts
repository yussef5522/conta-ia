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
// ⚠️ (lei v9, 13/11) as listas do painel mudaram de arquivo (components/estoque/listas-do-painel.tsx, pra serem renderizadas em teste): o painel é lido com elas — mesmo texto, dois arquivos
const ler = (rel: string) => readFileSync(join(raiz, rel), 'utf8') + (rel === TELA ? '\n' + readFileSync(join(raiz, 'components/estoque/listas-do-painel.tsx'), 'utf8') : '')
const semComentario = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^[ \t]*\/\/.*$/gm, '')

const TELA = 'app/(dashboard)/empresas/[id]/estoque/producao/page.tsx'
const CSS = 'app/globals.css'
const CARA = 'lib/stock/producao/cara-da-receita.ts'

describe('⭐⭐ o topo: título, linha editorial e UM primário', () => {
  it('⭐ a raiz declara o escopo dos tokens', () => {
    expect(semComentario(ler(TELA))).toContain('data-tela="producao-home"')
  })

  /** ⚠️⚠️ REAPONTADO pela lei v9 M7 (13/11, docs/producao-referencia.html) — a CARA mudou por ordem do dono; a régua de fundo segue. */
  it('⛔⛔ (v9 M7.b) a linha editorial MORREU — só o título, nada escrito solto embaixo', () => {
    const tela = semComentario(ler(TELA))
    expect(tela, 'a linha serifada voltou').not.toMatch(/className="editorial/)
    expect(tela, 'o texto solto voltou').not.toMatch(/a cozinha já produziu|a cozinha ainda não fechou lote/)
    expect(tela).toMatch(/<div className="pp-topo"><h1 className="pp-h1">Produção<\/h1><\/div>/)
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
  /** ⚠️⚠️ REAPONTADO pela lei v9 M7 (13/11, docs/producao-referencia.html) — a CARA mudou por ordem do dono; a régua de fundo segue. */
  it('⭐⭐ cor forte preenchida só nos CONTROLES de ação, e por token (fundo + tinta)', () => {
    const tela = semComentario(ler(TELA))
    // ⛔ nada de `--fam-*-mid` como fundo inline na tela (era o "primário competindo")
    expect([...tela.matchAll(/background: 'var\(--fam-[a-z]+-mid\)'/g)].length).toBe(0)
    // ⭐ o botão de criar ordem é o índigo da ação, com a TINTA em token (senão o escuro fica ilegível)
    expect(tela).toMatch(/\.pp \.bt\{[^}]*background:var\(--indigo\);color:var\(--indigo-on\)/)
    expect(tela).toMatch(/--indigo:var\(--prod-acao-bg\);--indigo-on:var\(--prod-acao-ink\)/)
    // ⭐ e as pílulas pintam com o fundo SUAVE + tinta `-ink` da mesma família (nunca `-mid` preenchido)
    for (const f of ['verde', 'ambar', 'coral']) {
      expect(tela).toMatch(new RegExp(`\\.pp-pill\\.${f}\\{background:var\\(--fam-${f}-bg\\);color:var\\(--fam-${f}-ink\\)\\}`))
    }
    expect(tela, 'a pílula do pedido usa a classe da família, pela régua da lib').toMatch(/className=\{`pp-pill \$\{TOM_DO_PEDIDO\[pil\.tom\]\}`\}/)
  })

  /**
   * ⛔ Os 6 chips são IGUAIS. Acender um diria que o dono está DENTRO daquela sub-tela —
   * e ele está na principal.
   */
  /** ⚠️⚠️ REAPONTADO pela lei v9 M7 (13/11, docs/producao-referencia.html) — a CARA mudou por ordem do dono; a régua de fundo segue. */
  it('⭐⭐ os chips da lei R1 (13/11: Painel · Ao vivo · Desempenho · Receitas · Equipe) + CSV tracejado, nenhum aceso', async () => {
    const tela = semComentario(ler(TELA))
    const { CHIPS_DA_PRODUCAO } = await import('@/components/estoque/producao-telas')
    expect(CHIPS_DA_PRODUCAO.map((c) => c.rotulo)).toEqual(['Painel', 'Ao vivo', 'Desempenho', 'Receitas', 'Equipe'])
    expect(tela, 'o Painel desenha os chips da porta única (nunca uma lista cravada)').toMatch(/CHIPS_DA_PRODUCAO\.map\(\(c\) => \(\s*<a key=\{c\.aba\} className="pp-chip"/)
    const csv = tela.slice(tela.lastIndexOf('<button', tela.indexOf('>CSV</button>')), tela.indexOf('>CSV</button>'))
    expect(csv, 'o CSV é ferramenta: chip tracejado').toMatch(/className="pp-chip mut"/)
    expect(tela, 'nenhum chip aceso: quem diz onde estou é o título').not.toMatch(/pp-chip on|pp-chip\$\{/)
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

  /** ⚠️⚠️ REAPONTADO pela lei v9 M7 (13/11, docs/producao-referencia.html) — a CARA mudou por ordem do dono; a régua de fundo segue. */
  it('⛔ a linha atrasada NÃO ganha fundo — só o filete coral e o selo', () => {
    const tela = semComentario(ler(TELA))
    const lista = tela.slice(tela.indexOf('function ListaAbertas'), tela.indexOf('function ListaConcluidas'))
    expect(lista, 'a ordem de ontem ganha o estado "at"').toMatch(/const estado = atrasada \? 'at'/)
    expect(lista).toMatch(/className=\{`pp-row e3 \$\{estado\}`\}/)
    expect(tela, 'o filete é coral').toMatch(/\.pp-row\.e3\.at::before\{background:var\(--fam-coral-mid\)\}/)
    expect(lista, 'e o selo "atrasada"').toMatch(/>atrasada</)
    const regraDaLinha = tela.match(/\.pp-row\{[^}]*\}/)![0]
    expect(/background/.test(regraDaLinha), 'fundo na linha inteira foi proibido pelo dono').toBe(false)
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

  /** ⚠️⚠️ REAPONTADO pela lei v9 M7 (13/11, docs/producao-referencia.html) — a CARA mudou por ordem do dono; a régua de fundo segue. */
  it('⛔ (v9) a linha não tem avatar — e sem responsável não inventa pessoa', () => {
    const tela = semComentario(ler(TELA))
    expect(tela, 'a lei v9 tira o avatar da linha (nome 700 + apoio)').not.toMatch(/<AvatarPessoa/)
    expect(tela).toMatch(/\{c\.colaboradorNome \?\? 'sem responsável'\}/)
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
  /** ⚠️⚠️ REAPONTADO pela lei v9 M7 (13/11, docs/producao-referencia.html) — a CARA mudou por ordem do dono; a régua de fundo segue. */
  it('⛔⛔ a tela NÃO divide nada — o % vem da lib, a régua é a cabecinha', () => {
    const tela = semComentario(ler(TELA))
    const lista = tela.slice(tela.indexOf('function ListaConcluidas'))
    expect(lista, 'a pílula da FICHA (P8) não volta').not.toMatch(/PilulaEf/)
    expect(
      /qtdGerada\s*\/|\/\s*pf\?\.pedido|\/\s*pedido\b/.test(lista),
      'nenhuma divisão: percentual nenhum nasce aqui',
    ).toBe(false)
    expect(lista, 'a régua que diz qual número é qual').toMatch(/FEZ \/ PED\./)
  })

  /**
   * ⚠️ REAPONTADO, não apagado: a régua da casa (`faixaDoSelo`) **não morreu com a pílula** —
   * ela continua servindo a tela "Por dia" e o juiz P8. Guard que só afirmasse a remoção
   * aprovaria o dia em que o percentual sumisse de todo lugar.
   */
  it('⭐ a régua da casa (faixaDoSelo) continua viva onde o % tem coluna ao lado', () => {
    const tela = semComentario(ler(TELA))
    expect(tela, 'a home não importa mais a régua — ela não desenha percentual').not.toContain('faixaDoSelo')
    // ⭐ (13/11) a "Por dia" morreu (lei R1); a régua segue viva no texto da linha e no aviso de padrão
    expect(semComentario(ler('lib/stock/producao/eficiencia-da-ordem.ts'))).toContain('export function faixaDoSelo')
    expect(semComentario(ler('lib/avisos/produtores/producao.ts'))).toContain('faixaDoSelo')
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
