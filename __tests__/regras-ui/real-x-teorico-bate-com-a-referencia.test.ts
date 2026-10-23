/**
 * ⭐⭐⭐ `docs/real-x-teorico-referencia.html` É A LEI DESTA TELA — e este guard **ABRE O
 * ARQUIVO** (22/10/2026).
 *
 * **A ordem do dono:** *"aprovado em 22/10, é A LEI da tela (leis RT0–RT8 nos comentários;
 * o `<script>` é a especificação)"*.
 *
 * ⭐⭐ **POR QUE LER O ARQUIVO, e não descrever o visual em palavras:** com a referência
 * VERSIONADA, *"igual à referência"* deixa de ser **memória minha** e vira **DADO que
 * diverge e grita** — é o pagamento do protocolo de 10/09, em que a mesma tela da
 * Conciliação foi refeita três vezes porque a régua vivia na minha cabeça. O `<title>` é
 * conferido primeiro: arquivo trocado por outro quebra aqui, não vinte asserções abaixo.
 *
 * ═══ ⚠️⚠️ O RECORTE DESTA FATIA, DECLARADO (não é o arquivo inteiro) ═══
 *
 * A ordem recorta: *"NESTA FATIA entram RT0, RT2 (parcial), RT3, RT5 e RT6. O
 * detalhe-que-expande (RT4) é a FATIA 2; o emagrecimento do Radar é a FATIA 3"*.
 *
 * ⛔⛔ **E O RT7 (tokens dark-first) TAMBÉM NÃO ENTRA — isto é divergência DECLARADA, não
 * esquecimento.** A referência é dark-first com paleta própria (`--bg:#070A14` + um bloco
 * `[data-theme="light"]`); a mesa hoje pinta por `components/estoque/radar-tokens.ts`, que
 * **crava hex** porque *"o Radar nasce CLARO como o resto do app"* (decisão de 20/09) e é
 * governado por `docs/mocks/real-vs-teorico-mock.html`, lido AO CARACTERE pelo guard
 * `mesa-bate-com-o-mock` (29/09). Aplicar o RT7 agora significaria **trocar a paleta da
 * mesa e reapontar aquele guard** — exatamente o escopo que a ordem manda não tocar.
 * ⭐ Há asserção abaixo afirmando que o RT7 **continua pendente**, pra a dívida não virar
 * paisagem: ela fica vermelha no dia em que alguém *achar* que converteu, e o par (mock ×
 * referência) tem que ser resolvido junto.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { semComentarios, usosDe, blocoEntre, hexCravados } from './_leitura-de-fonte'

const raiz = process.cwd()
const ler = (p: string) => readFileSync(join(raiz, p), 'utf8')

const REF = 'docs/real-x-teorico-referencia.html'
const TELA = 'app/(dashboard)/empresas/[id]/estoque/real-vs-teorico/page.tsx'
const MESA = 'lib/stock/radar/mesa.ts'
const AGENDA = 'lib/stock/radar/agenda-da-contagem.ts'
const FAROL = 'lib/stock/radar/farol-da-variancia.ts'
const TOKENS = 'components/estoque/radar-tokens.ts'
const ROTA = 'app/api/empresas/[id]/estoque/real-vs-teorico/route.ts'

const ref = ler(REF)
/** ⭐ o `<script>` da referência É a especificação do comportamento (ordem do dono) */
const spec = blocoEntre(ref, '<script>', '</script>')
/** o CSS dela é a régua das medidas que ESTA fatia introduz */
const css = blocoEntre(ref, '<style>', '</style>')

const tela = ler(TELA)
const telaLimpa = semComentarios(tela)

describe('⭐ a referência é o arquivo versionado que o dono aprovou', () => {
  it('⭐⭐ o `<title>` é o da PROPOSTA v1 (arquivo trocado quebra AQUI, não 20 asserções abaixo)', () => {
    expect(ref).toContain('REAL × TEÓRICO · PROPOSTA v1')
  })

  it('⭐ e ela declara as 9 leis RT0–RT8 (o recorte desta fatia sai delas)', () => {
    for (const n of [0, 1, 2, 3, 4, 5, 6, 7, 8]) {
      expect(ref, `a lei RT${n} desapareceu da referência`).toMatch(new RegExp(`RT${n}\\.`))
    }
  })
})

describe('⛔⛔ RT0 — A ESTRUTURA É A LEI: nada some', () => {
  /**
   * ⚠️ As colunas saem do `<thead>` da REFERÊNCIA, nunca de uma lista escrita por mim —
   * coluna nova no arquivo do dono tem que quebrar este teste, e lista à mão envelhece no
   * dia em que ele acrescentar uma.
   */
  const colunas = (blocoEntre(spec, '<thead>', '</thead>').match(/<th>([^<]+)<\/th>/g) ?? [])
    .map((t) => t.replace(/<\/?th>/g, ''))

  it('⭐ a referência declara as 9 colunas', () => {
    expect(colunas).toEqual([
      'ITEM', 'INÍCIO', 'ENTROU', 'PRODUZIDO', 'VENDEU', 'OUTROS', 'TEÓRICO', 'REAL', 'VARIÂNCIA',
    ])
  })

  /**
   * ⚠️⚠️ **A COMPARAÇÃO É SEM CAIXA, e é DIVERGÊNCIA DECLARADA, não folga de régua.** A
   * referência escreve `<th>INÍCIO</th>`; a mesa escreve `início` com `uppercase` no CSS — a
   * MESMA decisão tomada pro nome do grupo (o dado fica como foi escrito, a CAIXA ALTA é
   * pintura). Exigir o literal maiúsculo aqui reprovaria a tela CERTA.
   */
  it('⛔ e TODAS continuam na tela', () => {
    const semCaixa = telaLimpa.toLocaleUpperCase('pt-BR')
    for (const c of colunas) {
      expect(semCaixa, `a coluna ${c} sumiu da mesa`).toContain(c)
    }
  })

  /**
   * ⭐⭐ E O **DONO DOS RÓTULOS** CARREGA AS MESMAS (`COLUNAS` em `lib/stock/radar/mesa.ts`) —
   * é dele que nascem os chips de liga/desliga das colunas.
   *
   * ⚠️⚠️ **DÉBITO REGISTRADO, NÃO CONSERTADO NESTA FATIA:** o rótulo vive em DOIS lugares — o
   * `rotulo` do dono (que o chip desenha) e o `<th>` **cravado** no cabeçalho da tabela. Hoje
   * eles concordam (só a caixa difere), mas **divergem no 1º rótulo que o dono renomear**: o
   * chip diria o nome novo e o cabeçalho o velho. ⛔ Mapear o `<thead>` sobre as colunas é
   * refactor do cabeçalho (cada `<th>` tem o seu gate `mostra()` e o seu alinhamento) e a
   * ordem desta fatia é *"RT0: nada some"* — então **este teste é a trava provisória**: ele
   * fica vermelho no dia da divergência, em vez de a tela mentir calada.
   *
   * ⚠️ `ITEM` fica de fora de propósito: ela não é coluna configurável — é a 1ª coluna FIXA
   * (o nome do produto), e não existe mundo em que o dono a desligue.
   */
  it('⭐⭐ e o DONO dos rótulos (mesa.ts) declara as mesmas 8 configuráveis', () => {
    const mesa = ler(MESA)
    for (const c of colunas.filter((x) => x !== 'ITEM')) {
      expect(mesa, `o rótulo ${c} sumiu do dono das colunas`).toContain(`rotulo: '${c}'`)
    }
  })
})

describe('⛔⛔⛔ RT6 — O RODAPÉ DO GRUPO: SÓ QUANTIDADE, ZERO R$', () => {
  it('⭐ a referência não imprime R$ no rodapé do grupo', () => {
    const rodape = blocoEntre(spec, "'<div class=\"g-pe\">'", "'</div>'")
    expect(rodape).not.toMatch(/R\$/)
  })

  it('⛔⛔ e o rodapé da tela também não — nem pelo formatador de moeda', () => {
    // o bloco que renderiza o `g-pe` da tela: a faixa do subtotal
    const bloco = blocoEntre(telaLimpa, '└─ {frases.join', '</section>')
    expect(bloco, 'o R$ voltou pro rodapé do grupo (RT6)').not.toMatch(/brl\s*\(|R\$/)
  })

  it('⭐ as frases do rodapé são as da referência (faltou · sobrou · N sem contagem)', () => {
    const rodape = blocoEntre(spec, "'<div class=\"g-pe\">'", "'</div>'")
    const mesa = semComentarios(ler(MESA))
    for (const frase of ['faltou ', 'sobrou ', 'sem contagem']) {
      expect(rodape, `a referência deixou de dizer "${frase}"`).toContain(frase)
      expect(mesa, `o rodapé da mesa deixou de dizer "${frase}"`).toContain(frase)
    }
  })

  it('⛔ e a QUANTIDADE sai POR UNIDADE — UN e KG nunca somam num número só', () => {
    const mesa = semComentarios(ler(MESA))
    expect(mesa).toContain('faltouPorUnidade')
    expect(mesa).toContain('sobrouPorUnidade')
  })

  /**
   * ⭐⭐⭐ E ESTA RÉGUA É **EXECUTADA**, não grep — porque o grep não a cobria e o furo
   * apareceu na REGRA 11: repondo *"nada faltou"* no lugar do `tudo batendo`, as três frases
   * continuavam no arquivo e **o guard ficou VERDE**. ***A régua existia e não tinha ninguém
   * conferindo.***
   *
   * ⚠️ **A DIVERGÊNCIA DECLARADA da amostra da referência:** lá o grupo que não faltou nada
   * diz *"tudo batendo"* direto; aqui o *"tudo batendo"* exige **item CONTADO**. ⭐ O motivo é
   * o grupo NOVO (RT2): ele nasce VAZIO, e um grupo sem contagem nenhuma dizendo *"tudo
   * batendo"* afirmaria uma conferência que ninguém fez — ***ausência de MEDIÇÃO não é
   * ausência de FATO***.
   */
  it('⛔⛔ e o GRUPO VAZIO não diz "tudo batendo" (RT2 × RT6, régua EXECUTADA)', async () => {
    const { frasesDoRodape } = await import('@/lib/stock/radar/mesa')
    const zerado = {
      faltouPorUnidade: {},
      faltouValor: 0,
      sobrouPorUnidade: {},
      sobrouValor: 0,
      itensSemContagem: 0,
      itensContados: 0,
    }
    expect(frasesDoRodape(zerado), 'o grupo VAZIO afirmou uma conferência que ninguém fez').toEqual([])
    expect(frasesDoRodape({ ...zerado, itensContados: 3 })).toEqual(['tudo batendo'])
    expect(frasesDoRodape({ ...zerado, itensContados: 1, itensSemContagem: 2 })).toEqual([
      '2 sem contagem — fora dos totais',
    ])
    expect(
      frasesDoRodape({ ...zerado, itensContados: 2, faltouPorUnidade: { UN: 140, KG: 2.5 } })[0],
    ).toBe('faltou 140 UN · 2,5 KG')
  })

  it('⭐ RT1 — a reconciliação com o Radar fica em LETRA MIÚDA no pé da TELA', () => {
    expect(ref).toMatch(/linha de reconciliação com o Radar fica/)
    // o confronto viaja no payload e é MOSTRADO (não é a mesa recalculando)
    expect(telaLimpa).toContain('placarDoRadar')
    expect(telaLimpa).toMatch(/divergiu/)
  })
})

describe('⛔⛔⛔ RT5 — O FAROL HONESTO, e a régua tem UM dono', () => {
  /**
   * ⭐ Os quatro papéis saem das classes `.var.*` da referência; o mapa de cor é
   * `FAROL` em `radar-tokens.ts`. ⛔ A TELA não pode derivar cor nem veredito — seria a 2ª
   * régua da variância, e ela divergiria do Radar no 1º degrau novo.
   */
  it('⭐ a referência pinta falta=CORAL · sobra=ÂMBAR · bateu=VERDE · neutro=mudo', () => {
    expect(css).toMatch(/\.var\.falta\{[^}]*--coral/)
    expect(css).toMatch(/\.var\.sobra\{[^}]*--ambar/)
    expect(css).toMatch(/\.var\.ok\{[^}]*--verde/)
    expect(css).toMatch(/\.var\.neutro\{/)
  })

  /**
   * ⚠️ O recorte termina em `'\n}'`, nunca no 1º `}` — o primeiro fecha a **anotação de tipo**
   * (`Record<PapelDoFarol, { bg: string; cor: string }>`) e o bloco sairia VAZIO, aprovando
   * qualquer mapa por vacuidade. (Me pegou na 1ª rodada.)
   */
  it('⛔⛔ e o mapa de cor da casa tem os MESMOS 4 papéis, na MESMA semântica', () => {
    const tk = semComentarios(ler(TOKENS))
    const mapa = blocoEntre(tk, 'export const FAROL', '\n}')
    expect(mapa, 'o recorte do mapa saiu vazio — o delimitador não achou o fim').toContain('falta')
    expect(mapa).toMatch(/falta:\s*\{\s*bg:\s*RADAR\.coralBg,\s*cor:\s*RADAR\.coral/)
    expect(mapa).toMatch(/sobra:\s*\{\s*bg:\s*RADAR\.ambarBg,\s*cor:\s*RADAR\.ambar/)
    expect(mapa).toMatch(/ok:\s*\{\s*bg:\s*RADAR\.verdeBg,\s*cor:\s*RADAR\.verde/)
    expect(mapa).toMatch(/neutro:\s*\{\s*bg:\s*RADAR\.mudoBg,\s*cor:\s*RADAR\.mudo/)
  })

  it('⛔⛔ a TELA CONSOME a régua pura — nunca escreve `real < teorico`', () => {
    expect(usosDe(telaLimpa, 'farolDaVariancia'), 'a tela parou de consumir a régua do farol').toBeGreaterThanOrEqual(1)
    expect(usosDe(telaLimpa, 'FAROL')).toBeGreaterThanOrEqual(1)
    expect(telaLimpa, 'alguém escreveu a 2ª régua da variância na tela').not.toMatch(
      /real\s*[<>]\s*teorico|l\.real\s*[<>]\s*l\.teorico/,
    )
  })

  it('⭐⭐ "falta contar" vira "conta <dia>" — e o dia vem do SELO, não de uma 2ª régua', () => {
    // a referência: badge(it) com real==null → 'conta ' + rotuloAgenda(g,true)
    expect(spec).toMatch(/var neutro">conta '\+rotuloAgenda/)
    // a tela: o texto neutro é `conta ${contaEm}`, e `contaEm` sai do selo
    expect(telaLimpa).toMatch(/conta \$\{contaEm\}/)
    expect(telaLimpa).toMatch(/selo\?\.contaEm/)
  })

  it('⛔ e `teorico == null` NUNCA cai em `?? 0` (zero afirmaria que bateu)', () => {
    const bloco = blocoEntre(telaLimpa, 'function Pilula', '\n}')
    expect(bloco).toMatch(/l\.teorico\s*==\s*null/)
    expect(bloco, 'o teórico ausente virou zero — zero é uma afirmação').not.toMatch(
      /teorico\s*\?\?\s*0/,
    )
  })
})

describe('⛔⛔⛔ RT3 — AGENDA DE CONTAGEM POR GRUPO', () => {
  it('⭐ a referência desenha TODO DIA + os 7 dias SEG-first', () => {
    expect(spec).toMatch(/var DIAS=\["SEG","TER","QUA","QUI","SEX","SÁB","DOM"\]/)
    expect(spec).toMatch(/>TODO DIA</)
  })

  it('⛔⛔ o vocabulário de dia tem UM dono (SEG-first), e a tela o CONSOME', () => {
    const ag = semComentarios(ler(AGENDA))
    expect(ag).toMatch(/DIAS_SEG_FIRST\s*=\s*\[\s*'SEG',\s*'TER',\s*'QUA',\s*'QUI',\s*'SEX',\s*'SÁB',\s*'DOM'\s*\]/)
    expect(usosDe(telaLimpa, 'DIAS_SEG_FIRST')).toBeGreaterThanOrEqual(1)
    // ⛔ a tela não pode reescrever a lista (seria a 2ª resposta pra "que dia é o índice 0?")
    expect(telaLimpa).not.toMatch(/\[\s*'SEG'\s*,\s*'TER'/)
  })

  it('⛔⛔ TODO DIA e dias são UMA representação: ligar todo-dia ZERA os dias', () => {
    // a especificação: tglTodo zera
    expect(spec).toMatch(/function tglTodo\([^)]*\)\{[^}]*if\(a\.todoDia\)a\.dias=\[\]/)
    // a tela: o gesto manda `dias: []` junto do todoDia
    const bloco = blocoEntre(telaLimpa, 'const alternarTodoDia', '}')
    expect(bloco).toMatch(/todoDia:\s*!ag\.todoDia,\s*dias:\s*\[\]/)
  })

  it('⭐ o selo responde ao DIA, nos 4 estados da referência', () => {
    expect(spec).toMatch(/CONTAR HOJE/)
    expect(spec).toMatch(/contado hoje/)
    expect(spec).toMatch(/próxima '\+DIAS\[prox\.d\]\+' \(em '\+prox\.em\+'d\)/)
    expect(spec).toMatch(/sem dia de contagem/)
    const ag = semComentarios(ler(AGENDA))
    for (const frase of ['CONTAR HOJE', 'sem dia de contagem', 'próxima ']) {
      expect(ag, `a régua do selo deixou de dizer "${frase}"`).toContain(frase)
    }
  })

  it('⛔⛔ e o TOM do selo vem DECIDIDO do servidor — a tela só pinta', () => {
    const tk = semComentarios(ler(TOKENS))
    const mapa = blocoEntre(tk, 'export const TOM_DA_AGENDA', '\n}')
    expect(mapa, 'o recorte do mapa saiu vazio — o delimitador não achou o fim').toContain('VERDE')
    expect(mapa).toMatch(/AMBAR:\s*\{\s*bg:\s*RADAR\.ambarBg/) // CONTAR HOJE
    expect(mapa).toMatch(/CORAL:\s*\{\s*bg:\s*RADAR\.coralBg/) // atrasada
    expect(mapa).toMatch(/VERDE:\s*\{\s*bg:\s*RADAR\.verdeBg/) // contado hoje
    expect(mapa).toMatch(/NEUTRO:\s*\{\s*bg:\s*RADAR\.mudoBg/) // próxima SEX
    /**
     * ⚠️⚠️ **AS DUAS METADES, e o aperto nasceu de um VERDE DE GRAÇA.** A pílula pinta `bg`
     * **e** `cor` do mesmo mapa, **na mesma linha** — e a reposição que trocou só o `bg` por
     * um tom fixo deixou o guard VERDE, porque o `cor` sobreviveu e o `toMatch` o achou.
     * ⛔ Esse estado é defeito de verdade: fundo cravado com tinta do servidor é a pílula do
     * selo pintada **meio errada**. Cobrar as duas é o que torna meia-remoção vermelha.
     */
    expect(
      (telaLimpa.match(/TOM_DA_AGENDA\[selo\.tom\]/g) ?? []).length,
      'a pílula do selo deixou de pintar AS DUAS metades (bg e cor) com o tom do servidor',
    ).toBe(2)
    // ⛔ derivar o tom do ESTADO na tela seria a 2ª resposta pra "isto é urgente?"
    expect(telaLimpa).not.toMatch(/selo\.estado\s*===\s*'/)
  })

  /**
   * ⚠️⚠️ **ESTA ASSERÇÃO NASCEU LARGA DEMAIS E DEU FALSO VERMELHO CONTRA A TELA CERTA.** Eu
   * proibia `new Date()` na tela inteira — e a mesa tem UM uso legítimo: o `max=` dos campos
   * de data, que impede escolher dia futuro. Ali o relógio **não decide nada**; ele é a régua
   * do que o dono pode digitar — exatamente o *"o relógio serve pra exibir hoje na TELA, nunca
   * pra decidir"* da casa. ***Janela larga demais reprova o certo e ensina a afrouxar a
   * régua*** (a lição do guard de ordenação do Radar, 21/09).
   *
   * ⭐ A régua que fica é **ESTRUTURAL**: quem decide *"que dia é hoje"* e *"o que o selo diz"*
   * é a ROTA; a tela **não pode importar nem reescrever** nenhuma das duas réguas, e o selo
   * que ela pinta tem que ser o que veio no payload.
   */
  it('⛔⛔ UM RELÓGIO MANDA: o `hoje` é resolvido na ROTA, nunca na tela', () => {
    const rota = semComentarios(ler(ROTA))
    expect(rota).toMatch(/diaEmSaoPaulo\s*\(/)
    expect(rota).toMatch(/seloDaAgenda\s*\(/)

    // ⛔ a tela não pode calcular o dia nem o selo por conta própria
    expect(telaLimpa, 'a tela passou a derivar o dia de hoje').not.toMatch(/diaEmSaoPaulo/)
    expect(telaLimpa, 'a tela passou a derivar o selo da agenda').not.toMatch(/seloDaAgenda/)
    // ⭐ e o selo que ela pinta é o que o SERVIDOR mandou
    expect(telaLimpa).toMatch(/ag\.selo|selo\?\./)

    /**
     * ⭐ O ÚNICO uso de relógio na tela é o teto do campo de data. Qualquer uso NOVO fica
     * vermelho aqui — é o que mantém a trava sem reprovar o legítimo.
     */
    const usosDeRelogio = (telaLimpa.match(/new Date\s*\(\s*\)|Date\.now\s*\(/g) ?? []).length
    expect(usosDeRelogio, 'apareceu um uso NOVO de relógio na tela — o único permitido é o max= do campo de data').toBe(1)
    expect(telaLimpa).toMatch(/max=\{hojeBR\}/)
  })

  it('⭐⭐ "📋 contar agora" é ATALHO pra a contagem — nenhuma contagem nasce aqui', () => {
    expect(spec).toMatch(/📋 contar agora/)
    expect(telaLimpa).toMatch(/contar agora/)
    // leva à tela de contagem filtrada pelo grupo
    expect(telaLimpa).toMatch(/estoque\/contagem\?grupo=/)
    // ⛔⛔ e a TELA não tem porta de contagem: zero POST pra /contagem
    expect(telaLimpa, 'a mesa passou a criar contagem — a porta da contagem é ÚNICA').not.toMatch(
      /contagem\/(linha|iniciar|finalizar)/,
    )
  })

  it('⛔ e o botão só aparece quando a régua OFERECE (nunca quando ela cala)', () => {
    expect(telaLimpa).toMatch(/selo\?\.ofereceContarAgora\s*&&/)
    const ag = semComentarios(ler(AGENDA))
    expect(ag).toContain('ofereceContarAgora')
  })
})

describe('⛔⛔⛔ RT2 — OS GRUPOS SÃO AS LISTAS DO DONO (porta única, 3 telas)', () => {
  it('⭐ a referência dá os quatro gestos: ✎ · + novo grupo · adicionar item · tirar', () => {
    expect(spec).toMatch(/function renomear\(/)
    expect(spec).toMatch(/function novoGrupo\(/)
    expect(spec).toMatch(/adicionar item na lista/)
    expect(spec).toMatch(/function tirar\(/) // ⚠️ o "tirar" é da FATIA 2 (no detalhe aberto)
  })

  it('⭐ ✎ renomeia e "+ novo grupo" cria — os dois na tela', () => {
    expect(telaLimpa).toMatch(/gesto:\s*'renomear'/)
    expect(telaLimpa).toMatch(/gesto:\s*'criar'/)
    expect(telaLimpa).toMatch(/novo grupo/)
  })

  it('⭐⭐ "adicionar item" usa a BUSCA DA CASA, com o universo PRONTO do servidor', () => {
    expect(telaLimpa).toMatch(/<BuscaItem/)
    expect(telaLimpa).toMatch(/universo=\{ag\.universo\}/)
    expect(telaLimpa).toMatch(/gesto:\s*'adicionarItem'/)
    // ⛔ a tela é 'use client': derivar o universo aqui arrastaria o Prisma pro bundle
    expect(telaLimpa, 'a tela passou a derivar o universo (Prisma no bundle)').not.toContain(
      'universoDoGrupo',
    )
  })

  it('⛔⛔ e ela DIZ que vale nas três telas (uma verdade só)', () => {
    expect(spec).toMatch(/vale no Radar e no Consumo/)
    expect(telaLimpa).toMatch(/Radar e no Consumo/)
  })

  it('⛔⛔ MAIÚSCULA é CSS, nunca o dado — o nome fica como o dono escreveu', () => {
    expect(telaLimpa).toMatch(/uppercase/)
    expect(telaLimpa, 'o nome do grupo passou a ser gravado em caixa alta').not.toMatch(
      /nome:\s*nome\.trim\(\)\.toUpperCase\(\)/,
    )
  })

  it('⭐ o grupo NOVO nasce VAZIO e sem dia — e a tela diz isso', () => {
    // a referência: novoGrupo empurra agenda vazia e itens vazios
    expect(spec).toMatch(/novoGrupo[\s\S]{0,200}agenda:\{todoDia:false,dias:\[\]\}[\s\S]{0,40}itens:\[\]/)
    expect(telaLimpa).toMatch(/nasce vazio e sem dia de contagem/)
  })

  it('⛔⛔ o grupo vazio NÃO desaparece da mesa (era o `return null` que o sumia)', () => {
    expect(telaLimpa, 'o early-return voltou e o grupo novo sumiu da tela').not.toMatch(
      /!s\.linhas\.length\s*\)\s*return null/,
    )
    expect(telaLimpa).toMatch(/s\.linhas\.length === 0/)
  })

  it('⛔⛔⛔ os QUATRO gestos passam por UM POST só (porta única)', () => {
    const bloco = blocoEntre(telaLimpa, 'const gesto = useCallback', '[empresaId, carregar]')
    expect(bloco).toMatch(/real-vs-teorico\/grupos/)
    expect(bloco).toMatch(/method:\s*'POST'/)
    // ⛔ falha é ESTADO, nunca silêncio
    expect(bloco).toMatch(/setGestoErro/)
    // ⭐ e o estado novo vem do que o SERVIDOR gravou, nunca do clique
    expect(bloco).toMatch(/await carregar\(\)/)
  })
})

describe('⚠️⚠️ o que NÃO entra nesta fatia — declarado, não esquecido', () => {
  it('⭐ RT4 (detalhe que expande) é a FATIA 2 — a referência registra, a tela não tem', () => {
    expect(ref).toMatch(/RT4\.[\s\S]{0,400}LINHA EXPANDE/)
    // ⛔ "tirar da lista" mora no detalhe aberto (RT4) → não entra aqui
    expect(telaLimpa, 'o "tirar da lista" entrou antes da fatia 2').not.toMatch(
      /gesto:\s*'tirarItem'/,
    )
    // e a tela DIZ por onde se tira hoje, em vez de deixar o dono sem saída
    expect(telaLimpa).toMatch(/✕ do Radar/)
  })

  it('⚠️⚠️ RT7 (tokens dark-first) CONTINUA PENDENTE — e a dívida é afirmada aqui', () => {
    expect(ref).toMatch(/RT7\.[\s\S]{0,120}dark-first/)
    // a referência é dark-first com paleta própria…
    expect(css).toMatch(/--bg:#070A14/)
    expect(css).toMatch(/\[data-theme="light"\]/)
    // …e a mesa SEGUE no mapa claro de 20/09, cravado e governado pelo mock de 29/09.
    // ⛔ Quando o RT7 for aplicado, ESTA asserção fica vermelha — de propósito: ela obriga
    //    a resolver o par (mock de 29/09 × referência de 22/10) no mesmo gesto.
    const tk = ler(TOKENS)
    expect(hexCravados(tk).length, 'o RT7 foi aplicado? então reaponte este guard e o mock de 29/09').toBeGreaterThan(0)
    expect(tk).toMatch(/O TEMA ESCURO NÃO ENTRA AQUI/)
  })
})
