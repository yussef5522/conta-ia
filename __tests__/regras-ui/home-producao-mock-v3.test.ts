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
  it('⭐⭐ cor forte preenchida aparece em DOIS lugares, e os dois são primários', () => {
    const tela = semComentario(ler(TELA))
    const usos = [...tela.matchAll(/background: 'var\(--fam-[a-z]+-mid\)'/g)]
    expect(usos.length, 'cor forte preenchida fora dos primários = dois primários competindo').toBe(2)
    // e os dois são índigo (o primário da casa), nunca outra família
    for (const u of usos) expect(u[0]).toContain('--fam-indigo-mid')
  })

  /**
   * ⛔ Os 6 chips são IGUAIS. Acender um diria que o dono está DENTRO daquela sub-tela —
   * e ele está na principal.
   */
  it('⭐⭐ os 6 chips de navegação, nenhum com estado aceso', () => {
    const tela = semComentario(ler(TELA))
    const chips = [...tela.matchAll(/<ChipNav href=/g)]
    expect(chips.length, 'os 6 atalhos do mock').toBe(6)

    const comp = tela.slice(tela.indexOf('function ChipNav'), tela.indexOf('function PilulaEf'))
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
  it('⛔⛔ a tela NÃO divide nada pra achar a eficiência', () => {
    const tela = semComentario(ler(TELA))
    const lista = tela.slice(tela.indexOf('function ListaConcluidas'))
    expect(lista, 'a pílula lê o pct CONGELADO').toMatch(/<PilulaEf pct=\{c\.pct\}/)
    expect(
      /qtdGerada\s*\/|\/\s*pf\?\.pedido|\/\s*pedido\b/.test(lista),
      'nenhuma divisão: o pct vem congelado do servidor',
    ).toBe(false)
  })

  it('⭐ a pílula usa a régua da casa (faixaDoSelo), não degraus próprios', () => {
    const tela = semComentario(ler(TELA))
    const p = tela.slice(tela.indexOf('function PilulaEf'), tela.indexOf('function dataPorExtenso'))
    expect(p).toContain('faixaDoSelo(')
    expect(/0\.9|0\.85|1\.1|1\.15|>= 90|< 70/.test(p), 'número de faixa digitado na tela é a 2ª régua').toBe(false)
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
  it('⭐⭐ a home entrou no MESMO bloco de tokens da tela "Por dia" (uma paleta)', () => {
    const css = ler(CSS)
    expect(css, 'claro').toMatch(/\[data-tela='producao-por-dia'\],\s*\n\[data-tela='producao-home'\] \{/)
    expect(css, 'e o espelho ESCURO').toMatch(/\.dark \[data-tela='producao-home'\]/)
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
