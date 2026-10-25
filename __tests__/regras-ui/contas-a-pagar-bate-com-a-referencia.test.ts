/**
 * ⭐⭐⭐ CONTAS A PAGAR · FATIA 1 — O GUARD QUE ABRE `docs/contas-a-pagar-referencia.html`.
 *
 * **O arquivo é A LEI desta tela** (aprovada pelo dono em 21/10): tokens 1:1 com a cara nova,
 * os comentários do CSS são as regras P1–P3, e o `<script>` é a ESPECIFICAÇÃO do comportamento
 * (quem seleciona, o que a seção marca, o que a barra soma).
 *
 * ⭐ **A LEI MAIOR (L1), nas palavras dele:** *"A TABELA ATUAL É INTOCÁVEL NA LEITURA. Mesmas
 * colunas, mesma ordem, mesmo formato de hoje. O que esta fatia ADICIONA nunca mexe no que já
 * se lê."* — então este guard é de **DOIS LADOS**: ele exige as peças NOVAS **e** afirma que as
 * 8 colunas antigas seguem na ordem.
 *
 * ⛔⛔ **ELE LÊ A TELA SEM COMENTÁRIO** (`semComentarios`): este arquivo e os componentes
 * documentam por escrito os defeitos que a fatia matou, e ***o arquivo que documenta o defeito
 * não pode ser o que o absolve*** (a cicatriz de 21/09, repetida 19 vezes nesta casa).
 *
 * ⚠️⚠️ **DUAS DIVERGÊNCIAS DA REFERÊNCIA, DECLARADAS — nunca aceitas em silêncio:**
 *
 * 1. **A referência desenha `agendar` e `marcar pagas →` na barra; a fatia 1 NÃO acrescenta
 *    botão de ação.** O brief escrito é explícito: *"⛔ Botões de ação em lote NÃO entram nesta
 *    fatia — são a fatia 2"*. ⭐ E os dois botões que a barra TEM (`marcar pagas`, `excluir`)
 *    **não nasceram aqui**: são do Sprint 5.0.3.0b (commit `408e6faa`), estão em prod e
 *    funcionam. **Medido antes de decidir** — por isso eles FICAM (*remoção sem realocação é
 *    perda*), e o que o guard trava é que **nenhum botão NOVO** apareça nesta fatia. O desenho
 *    de escrita em lote é da fatia 2.
 * 2. **A referência é dark-first com paleta própria; a tela é a antiga, em Tailwind.** Reescrever
 *    a tabela em token da fundação **mexeria na leitura** — exatamente o que L1 proíbe. Então o
 *    mapa 1:1 vale pras **peças NOVAS**, e o guard cobra delas: zero hex cravado e os dois temas.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { semComentarios, usosDe, hexCravados, blocoEntre } from './_leitura-de-fonte'

const raiz = process.cwd()
const ler = (p: string) => readFileSync(join(raiz, p), 'utf8')

const REF = ler('docs/contas-a-pagar-referencia.html')
const PAGE = ler('app/(dashboard)/contas-a-pagar/page.tsx')
const TABELA = ler('components/contas-pagar/PayableTable.tsx')
const BARRA = ler('components/contas-pagar/BulkActionsBar.tsx')
const CARTOES = ler('components/contas-pagar/CartoesDoTempo.tsx')
const FILTROS = ler('components/contas-pagar/PayableFilters.tsx')
const ROTULO_LIB = ler('lib/contas-pagar/rotulo-do-tempo.ts')

/** ⭐ o CSS e o `<script>` da referência, separados: um manda na FORMA, o outro no COMPORTAMENTO */
const REF_CSS = blocoEntre(REF, '<style>', '</style>')
const REF_SCRIPT = blocoEntre(REF, '<script>', '</script>')

describe('a referência versionada é a lei — e ela existe de verdade', () => {
  it('o arquivo é o que o dono aprovou (título v2) e traz as 3 regras P1–P3', () => {
    expect(REF).toContain('CONTAS A PAGAR · PROPOSTA v2')
    // ⭐ v2.1 (23/10): as duas janelas deslizantes morreram e o card único A VENCER voltou
    expect(REF, 'a referência perdeu o registro da aprovação de 23/10').toContain('v2.1')
    for (const p of ['P1.', 'P2.', 'P3.']) expect(REF).toContain(p)
    // ⚠️ sem CSS e sem script não há o que comparar — guard cego daria verde de graça
    expect(REF_CSS.length).toBeGreaterThan(2000)
    expect(REF_SCRIPT.length).toBeGreaterThan(1000)
  })
})

describe('⛔ L1 — a tabela de hoje é INTOCÁVEL na leitura', () => {
  /**
   * ⭐ As 8 colunas vêm do `<thead>` da REFERÊNCIA, nunca de uma lista que eu digite aqui:
   * lista à mão envelhece no dia em que o dono mudar o arquivo, e aí o guard passaria a
   * defender a tela contra a própria lei.
   */
  const colunasDaReferencia = [...REF.matchAll(/<th[^>]*>([^<]*)<\/th>/g)]
    .map((m) => m[1].trim())
    .filter(Boolean)

  it('as colunas da referência são as de hoje, na ordem', () => {
    expect(colunasDaReferencia).toEqual([
      'STATUS',
      'VENCIMENTO',
      'PAGAMENTO',
      'FAVORECIDO',
      'DESCRIÇÃO',
      'CATEGORIA',
      'VALOR',
    ])
  })

  it('a tabela em prod mantém as 8 colunas, na MESMA ordem', () => {
    const limpo = semComentarios(TABELA)
    const posicoes = colunasDaReferencia.map((c) => {
      // os headers da tela são Title Case ou upper; comparo pelo rótulo normalizado
      const alvo = c.charAt(0) + c.slice(1).toLowerCase()
      const i = limpo.toLowerCase().indexOf(`header: '${alvo.toLowerCase()}'`)
      return i >= 0 ? i : limpo.toLowerCase().indexOf(alvo.toLowerCase())
    })
    for (let i = 0; i < posicoes.length; i++) {
      expect(posicoes[i], `coluna «${colunasDaReferencia[i]}» desapareceu da tabela`).toBeGreaterThan(-1)
    }
    const ordenadas = [...posicoes].sort((a, b) => a - b)
    expect(posicoes, 'a ORDEM das colunas mudou — L1 proíbe').toEqual(ordenadas)
  })

  it('o valor continua com o «−» e o formatador único da casa', () => {
    expect(REF_SCRIPT).toContain('− ')
    expect(usosDe(TABELA, 'formatBRL')).toBeGreaterThan(0)
  })

  it('⛔ a NF continua ABRINDO a nota: o link para a propagação do clique da linha', () => {
    // na referência: <a … onclick="event.stopPropagation()">NF ↗</a>
    expect(REF_SCRIPT).toContain('↗')
    expect(REF_SCRIPT).toContain('stopPropagation')
    const link = blocoEntre(semComentarios(TABELA), 'function LinkNotaOrigem', 'function ')
    expect(link, 'o link da NF perdeu o stopPropagation — clicar na nota passaria a selecionar a linha')
      .toContain('stopPropagation')
  })
})

describe('P1 · SELEÇÃO — checkbox à esquerda e a LINHA seleciona', () => {
  it('a especificação da referência: a linha clica e seleciona', () => {
    expect(REF_SCRIPT).toMatch(/class="conta[^"]*"[^>]*onclick="tgl\(/)
    expect(REF).toContain('linha clica = seleciona')
  })

  it('a tela liga o clique da linha na seleção, com o onRowClick preservado', () => {
    const limpo = semComentarios(TABELA)
    const corpo = blocoEntre(limpo, 'onClick={() => {', '}}')
    expect(corpo, 'o clique da linha deixou de selecionar').toContain('toggleSelected')
    expect(corpo, 'o onRowClick foi atropelado — gesto de quem passar a prop').toContain('onRowClick')
  })

  it('⛔ o checkbox da linha NÃO propaga (senão o clique conta duas vezes e se anula)', () => {
    const limpo = semComentarios(TABELA)
    const cb = blocoEntre(limpo, 'onCheckedChange={(v) => row.toggleSelected', '/>')
    expect(cb).toContain('stopPropagation')
  })
})

describe('P1 · A BARRA — contagem, TOTAL gigante, régua do caixa e limpar', () => {
  it('a referência manda: total gigante (27px) e as frases da régua', () => {
    expect(REF_CSS).toContain('font-size:27px')
    expect(REF_SCRIPT).toContain('conta')
    expect(REF_SCRIPT).toContain('selecionada')
    expect(REF_SCRIPT).toContain('saldo hoje ')
    expect(REF_SCRIPT).toContain(' → pagando fica ')
    expect(REF).toContain('limpar')
  })

  it('a barra desenha as 4 peças da fatia 1', () => {
    const limpo = semComentarios(BARRA)
    expect(limpo).toContain('selecionada')
    expect(limpo, 'o TOTAL gigante sumiu').toContain('data-testid="bulk-total"')
    expect(limpo, 'a régua do caixa sumiu da barra').toContain('data-testid="regua-do-caixa"')
    expect(limpo).toContain('saldo hoje')
    expect(limpo).toContain('pagando fica')
    expect(limpo, 'o botão limpar sumiu').toContain('data-testid="bulk-clear"')
  })

  it('⭐ a régua vem PRONTA do servidor-pra-lib — a barra não faz aritmética de dinheiro', () => {
    const limpo = semComentarios(BARRA)
    expect(limpo).toContain('ReguaDoCaixaNaSelecao')
    expect(limpo.match(/regua\.(total|saldoHoje|depois|tom|frase)/g)?.length ?? 0).toBeGreaterThan(3)
    // ⛔ nenhuma soma/subtração de dinheiro dentro da barra
    const bloco = blocoEntre(limpo, 'export function BulkActionsBar', 'data-testid="bulk-clear"')
    expect(bloco, 'a barra voltou a calcular dinheiro — a 2ª derivação do mesmo número')
      .not.toMatch(/saldoHoje\s*[-+]|[-+]\s*regua\.total/)
  })

  it('⛔ O QUE O TOTAL NÃO ALCANÇA VAI NOMEADO (a seleção sobrevive à troca de página)', () => {
    const limpo = semComentarios(BARRA)
    /**
     * ⚠️⚠️ **INVERTIDO em 23/10, com o motivo escrito — não apagado.** Ele exigia
     * `foraDaPagina` e a nota *"em outra página"*: era a MITIGAÇÃO por TEXTO de um defeito
     * que a cura do item 3 **matou na raiz** — a barra somava a soma da PÁGINA enquanto a
     * contagem e as ações falavam do FILTRO inteiro. ⭐ Agora "selecionar todas" traz os
     * pares `{id, amount}` do servidor e o total **É** o agregado por construção, então não
     * existe mais "o que o total não alcança". ⛔ A metade que importava — *o total nunca é
     * soma de página* — ficou travada no `expect` de baixo e no guard da seleção.
     */
    expect(limpo, 'a nota de parcialidade voltou — o total virou soma de página de novo')
      .not.toContain('foraDaPagina')
    expect(limpo, 'a nota "em outra página" voltou — ela mitigava por TEXTO o total de página')
      .not.toContain('em outra página')
  })

  it('⛔ FATIA 1 NÃO ACRESCENTA BOTÃO DE AÇÃO — ação em lote é a fatia 2', () => {
    /**
     * ⚠️ Os dois gestos que existem (`bulk-mark-paid`, `bulk-delete`) são do Sprint 5.0.3.0b e
     * seguem intocados. O que este guard proíbe é um TERCEIRO nascer aqui — a referência
     * desenha `agendar`, e ele é da fatia 2.
     */
    const limpo = semComentarios(BARRA)
    expect(REF, 'a referência desenha o agendar — e ele fica pra fatia 2').toContain('agendar')
    expect(limpo, 'botão «agendar» entrou na fatia 1 — ação em lote é a fatia 2').not.toContain('agendar')
    /**
     * ⚠️ Conta só o que é BOTÃO. A 1ª versão casava todo `data-testid="bulk-…"` e mordeu o
     * `bulk-actions-bar` (o contêiner) e o `bulk-total` (um número) — ***guard que conta
     * ocorrência de atributo mede o tamanho do arquivo, não a doença.***
     */
    const gestos = [...limpo.matchAll(/<Button[\s\S]*?data-testid="bulk-([a-z-]+)"/g)]
      .map((m) => m[1])
      .sort()
    expect(gestos, 'a barra ganhou/perdeu gesto nesta fatia').toEqual(['clear', 'delete', 'mark-paid'])
  })
})

describe('P2 · OS CARTÕES DO TEMPO — o rótulo adulto é NOME + DATA', () => {
  /**
   * ⚠️⚠️ **REAPONTADO em 23/10, com a aprovação do dono escrita — nunca afrouxado.** Até
   * 21/10 este bloco exigia as **4 faixas de data** (`PRÓXIMOS 7 DIAS` · `RESTO DO MÊS`). A
   * ordem dele: *"morrem — janelas deslizantes que o dono não entende. Volta o card único A
   * VENCER com as datas do período no rótulo."* ⛔⛔ E havia uma razão mais dura que a
   * preferência: `whereDaFaixa('VENCIDAS')` era **cópia literal** de
   * `whereDoStatus('VENCIDA')` — o defeito de 13/09. **A PERGUNTA NÃO MUDOU** (*o rótulo é
   * NOME + DATA, medido pelo servidor?*); mudou quantos cartões existem.
   */
  it('a referência põe a data no rótulo dos 3 cartões de aberto', () => {
    for (const rot of ['VENCIDAS', 'VENCE HOJE', 'A VENCER']) {
      expect(REF_SCRIPT, `o cartão «${rot}» saiu da referência`).toContain(rot)
    }
    // ⛔ e as duas janelas deslizantes NÃO voltam pela referência
    /**
     * ⛔⛔ LIDO **SEM COMENTÁRIO**: a própria referência v2.1 DOCUMENTA a morte das duas
     * janelas (*"A v2 desenhava PRÓXIMOS 7 DIAS…"*), e ***o arquivo que documenta o defeito
     * não pode ser o que o absolve*** — a cicatriz de 21/09, pela 22ª vez nesta casa.
     */
    const refSemNota = semComentarios(REF_SCRIPT)
    for (const morto of ['PRÓXIMOS 7 DIAS', 'RESTO DO MÊS']) {
      expect(refSemNota, `a janela deslizante «${morto}» ressuscitou`).not.toContain(morto)
    }
    // ⚠️ o `sub` É a data: a lei do rótulo adulto mora nele
    expect(REF_SCRIPT).toMatch(/sub:"até ontem · \d{2}\/\d{2}"/)
    expect(REF_SCRIPT).toMatch(/sub:"\d{2} a \d{2}\/\d{2}"/)
  })

  it('os cartões desenham o rótulo que o SERVIDOR mediu — a tela não deriva data', () => {
    const limpo = semComentarios(CARTOES)
    expect(limpo, 'o cartão parou de desenhar o rótulo medido').toContain('m?.rotulo')
    expect(limpo, 'a tela voltou a derivar o rótulo — um relógio só manda')
      .not.toMatch(/nomeDoEscopo|dataDoEscopo|rotuloDoEscopo|new Date\(\)/)
  })

  it('⛔ o cartão FILTRA, e o número não é morto', () => {
    expect(REF_SCRIPT).toContain('onclick="filtrar(')
    const limpo = semComentarios(CARTOES)
    expect(limpo).toContain('onEscolherEscopo')
    expect(limpo, 'o cartão do estado perdeu o testid').toContain('cartao-escopo-')
    const pag = semComentarios(PAGE)
    expect(pag, 'a tela parou de desenhar a família de cartões').toContain('<CartoesDoTempo')
    // ⭐ o cartão zera o escopo dos cards: senão a lista é recortada 2× e o número divergiria
    const chamada = blocoEntre(pag, '<CartoesDoTempo', '/>')
    expect(chamada, 'o cartão parou de mandar o estado que ele mediu').toContain('escopo: e')
    /**
     * ⛔⛔ o cartão **mata a faixa legada** ao filtrar: deixar as duas ligadas recortaria a
     * lista DUAS vezes, e o cartão diria 25 com a tabela mostrando 3 (a divergência de 13/09).
     */
    expect(chamada, 'a faixa legada ficou ligada junto do escopo — recorte duplo').toContain('faixa: undefined')
    expect(chamada, 'o cartão deixou de limpar o status — o recorte sai por duas réguas').toContain("status: 'TODOS'")
  })

  it('⭐ Σ DOS ESTADOS == TOTAL EM ABERTO, e a tela GRITA quando não fecha', () => {
    const limpo = semComentarios(CARTOES)
    expect(limpo).toContain('somaDosEstados')
    expect(limpo).toContain('totalEmAberto')
    expect(limpo, 'o alarme deixou de ser VISÍVEL na tela').toMatch(/Math\.abs\(somaDosEstados - totalEmAberto\)/)
    /**
     * ⭐⭐ A LEGENDA PERMANENTE MORREU (item 5 do dono, 21/10): *"o invariante mora no TESTE,
     * não precisa morar na frente do dono"*. ⛔ **O GRITO FICA** — esconder uma Σ que NÃO
     * fecha trocaria a legenda por uma MENTIRA. O que o guard trava é a assimetria: a frase
     * de sucesso sai, o alarme fica, e é ele que renderiza só no `!fecha`.
     */
    expect(limpo, 'a legenda permanente do Σ voltou pra tela').not.toContain('= o total em aberto')
    expect(limpo, 'o grito deixou de ser condicional ao NÃO fechar').toContain('{!fecha && (')
  })

  /**
   * ⚠️⚠️ **TESTE INVERTIDO em 23/10, com o motivo escrito — não apagado.** Ele exigia
   * `faixasVisiveis`/`faixaAtiva`: com 5 chips havia o risco real de o chip FILTRADO sumir da
   * fileira e o dono perder o caminho de volta. ⭐ **Com 3 cartões a régua deixou de ser
   * necessária porque o estado ruim virou INALCANÇÁVEL** (REGRA 5): `ESCOPOS_EM_ABERTO.map`
   * desenha os três SEMPRE, e o filtrado só muda de tom (`active`). *Linha que não pode
   * falhar é linha que finge ser trava* (a lição do `ehVizinho`, 17/10).
   *
   * ⭐ **A METADE QUE IMPORTAVA FICOU TRAVADA, e mais forte:** o que ela protegia era *"o
   * cartão filtrado tem caminho de volta"* — e agora isso é **o próprio cartão**, que
   * desliga o filtro no 2º toque.
   */
  it('⭐ os TRÊS cartões de aberto são desenhados SEMPRE — nenhum some ao filtrar', () => {
    const limpo = semComentarios(CARTOES)
    expect(limpo, 'a fileira parou de derivar da família — cartão pode sumir ao filtrar')
      .toContain('ESCOPOS_EM_ABERTO.map')
    expect(limpo, 'a fileira passou a esconder o cartão filtrado')
      .not.toMatch(/\.filter\([^)]*escopoAtivo/)
    // ⭐ e o caminho de volta é o próprio cartão: 2º toque desliga o filtro
    expect(limpo, 'o cartão deixou de desligar o próprio filtro no 2º toque')
      .toContain('onEscolherEscopo(ativa ? undefined : e)')
  })
})

describe('⭐⭐⭐ FATIA 1.1 — UMA FAMÍLIA SÓ DE CARTÕES DO TEMPO', () => {
  /**
   * **O veredito do dono (print de 21/10 20:22):** *"bagunça total, cards repetidos, mesma
   * informação 2 vezes em 2 modelos"*. A mesma informação vivia em TRÊS formas — os 4 cartões
   * antigos, os 5 chips de faixa e a régua do rodapé —, com VENCE HOJE e VENCIDAS em DOBRO.
   *
   * ⚠️⚠️ **DIVERGÊNCIA DECLARADA Nº 3:** a referência v2 desenha, no `.faixas`, **só as faixas
   * de ABERTO**; o card **PAGAS** é acréscimo pedido por escrito no item 1 (*"PAGAS · OUTUBRO
   * vira o último cartão, verde, com o detalhe das conciliadas"*). Ele entra como **contexto**,
   * com tom próprio — e o guard cobra a POSIÇÃO (último) pra ele não disputar a leitura das
   * faixas de aberto.
   */
  it('⛔ os 4 cartões antigos e os 5 chips MORRERAM da tela', () => {
    const pag = semComentarios(PAGE)
    expect(pag, 'os StatsCards antigos voltaram — a mesma informação 2×').not.toContain('<StatsCard')
    expect(pag, 'o grid de 4 colunas voltou').not.toContain('<StatCardGrid')
    expect(pag, 'os chips duplicados voltaram').not.toContain('<ChipsDasFaixas')
    expect(pag, 'a família de cartões do tempo não é desenhada').toContain('<CartoesDoTempo')
  })

  it('⛔⛔ o COMPONENTE dos chips foi APAGADO, não deixado órfão', () => {
    /**
     * *Enquanto o componente existe no arquivo, alguém religa* (a cicatriz do
     * `GruposSugeridos`, 23/09) — e aí a tela volta a mostrar VENCE HOJE duas vezes.
     */
    expect(existsSync(join(raiz, 'components/contas-pagar/ChipsDasFaixas.tsx')),
      'o ChipsDasFaixas voltou a existir').toBe(false)
  })

  it('a grade é a da referência — medidas LITERAIS, nunca traduzidas no olho', () => {
    const faixas = blocoEntre(REF_CSS, '.faixas{', '}')
    expect(faixas).toContain('minmax(170px,1fr)')
    expect(faixas).toContain('gap:9px')
    const limpo = semComentarios(CARTOES)
    expect(limpo, 'a medida da grade saiu da referência').toContain('minmax(170px,1fr)')
    expect(limpo).toContain('gap-[9px]')
  })

  it('⭐ PAGAS é o ÚLTIMO cartão, verde, com o detalhe das conciliadas', () => {
    const limpo = semComentarios(CARTOES)
    expect(limpo).toContain('cartao-pagas')
    expect(limpo, 'o cartão de contexto perdeu o tom distinto').toMatch(/tone="emerald"/)
    const i = limpo.indexOf('cartao-escopo-')
    const j = limpo.indexOf('cartao-pagas')
    expect(i, 'os cartões de estado sumiram').toBeGreaterThan(0)
    expect(j, 'o cartão PAGAS sumiu').toBeGreaterThan(i)
    const pag = semComentarios(PAGE)
    const chamada = blocoEntre(pag, '<CartoesDoTempo', '/>')
    expect(chamada, 'o detalhe das conciliadas saiu do cartão').toContain('countPagasConciliadas')
    expect(chamada, 'a metade «sem vínculo» do detalhe sumiu').toContain('countPagasSemVinculo')
  })

  it('⛔ cada número aparece UMA vez — o IMPORT dos cartões antigos morreu', () => {
    /**
     * ⚠️ Proibir só a TAG (`<StatsCard`) deixaria o import vivo, e import vivo é o convite pra
     * alguém redesenhar o cartão duplicado *"porque já estava pronto"* (a lição do bloco de
     * avisos inline, 04/10). Sem o import, a mesma informação **não tem como** voltar 2×.
     */
    const pag = semComentarios(PAGE)
    expect(pag, 'o import do StatsCard voltou').not.toMatch(/import .*StatsCard/)
    expect(pag, 'o import do StatCardGrid voltou').not.toMatch(/import .*StatCardGrid/)
    expect(pag, 'o import dos chips voltou').not.toMatch(/import .*ChipsDasFaixas/)
    // ⭐ e o rótulo de faixa segue vindo MEDIDO do servidor, nunca escrito na tela
    expect(semComentarios(CARTOES)).toContain("label={m?.rotulo ?? ''}")
  })

  it('⛔⛔ a BARRA desceu pra posição da LEI: fixa EMBAIXO', () => {
    const barra = blocoEntre(semComentarios(BARRA), 'data-testid="bulk-actions-bar"', 'bulk-total')
    expect(barra, 'a barra voltou a ser sticky — na prática ela aparecia NO TOPO')
      .not.toContain('sticky')
    const limpo = semComentarios(BARRA)
    expect(limpo, 'a barra deixou de ser fixa embaixo').toContain('fixed bottom-0 left-0 right-0')
    const refBarra = blocoEntre(REF_CSS, '.barra{', '}')
    expect(refBarra).toContain('position:fixed')
    expect(refBarra).toContain('bottom:0')
    // ⭐ o miolo segue o teto da tela (`.barra .in`), com as medidas do arquivo
    const refIn = blocoEntre(REF_CSS, '.barra .in{', '}')
    expect(refIn).toContain('max-width:1440px')
    expect(refIn).toContain('padding:12px 26px')
    expect(limpo).toContain('max-w-[1440px]')
    expect(limpo).toContain('px-[26px]')
    expect(limpo).toContain('py-[12px]')
    // ⭐ o total GIGANTE é o da referência (27px), não o 24px de antes
    expect(blocoEntre(REF_CSS, '.barra .tot{', '}')).toContain('font-size:27px')
    expect(limpo, 'o total deixou de ter o tamanho da referência').toContain('text-[27px]')
  })

  it('⛔ a barra é renderizada no FIM do conteúdo, com o espaçador da referência', () => {
    const pag = semComentarios(PAGE)
    /**
     * ⚠️ Barra `fixed` sai do fluxo e **cobre a última linha da tabela** — justamente a que o
     * dono acabou de marcar. Os 110px são os do `body{padding-bottom:110px}` da referência, e
     * o espaçador só existe enquanto a barra existe.
     */
    expect(REF_CSS, 'o espaçador saiu da referência').toContain('padding-bottom:110px')
    expect(pag, 'o espaçador da barra fixa sumiu — ela cobre a última linha').toContain('h-[110px]')
    const bloco = blocoEntre(pag, 'selectedCount > 0 && (', '</>')
    expect(bloco, 'o espaçador deixou de nascer junto da barra').toContain('h-[110px]')
    expect(bloco).toContain('<BulkActionsBar')
    // ⭐ e ela vem DEPOIS da tabela: era a posição no DOM que a jogava pro topo
    expect(pag.indexOf('<PayableTable'), 'a tabela sumiu').toBeGreaterThan(0)
    expect(pag.indexOf('<BulkActionsBar'), 'a barra voltou pra ANTES do conteúdo')
      .toBeGreaterThan(pag.indexOf('<PayableTable'))
  })

  it('⛔ o checkbox «Só vencidas» morreu — mas o link antigo continua funcionando', () => {
    const limpo = semComentarios(FILTROS)
    expect(limpo, 'o checkbox duplicado voltou — o cartão VENCIDAS já filtra o mesmo')
      .not.toContain('filter-vencidasOnly')
    expect(limpo, 'o controle de «Só vencidas» voltou').not.toContain('Só vencidas')
    /**
     * ⚠️ O CAMPO fica: `?vencidasOnly=true` de print/e-mail/histórico continua valendo e
     * aparece como filtro ativo. *Link velho não vira 404 silencioso.*
     *
     * ⛔⛔ A asserção é no CAMPO DO TIPO e no USO, nunca na menção: `toContain('vencidasOnly')`
     * sobre o arquivo inteiro passa VERDE com o campo arrancado da interface, porque o nome
     * sobrevive no `EMPTY_FILTERS` e no `isFilterActive` logo abaixo (medido na REGRA 11 —
     * *"menção, não uso"*, a 21ª vez nesta casa).
     */
    const tipo = blocoEntre(limpo, 'export interface PayableFilterState {', '}')
    expect(tipo, 'o campo saiu do TIPO — link antigo passa a ser ignorado em silêncio')
      .toContain('vencidasOnly: boolean')
    const ativo = blocoEntre(limpo, 'export function isFilterActive', '}')
    expect(ativo, 'o campo deixou de contar como filtro ATIVO — o dono fica sem o "limpar"')
      .toContain('f.vencidasOnly')
  })
})

describe('P2 · SEÇÕES NA TABELA — subtotal da faixa e checkbox do grupo', () => {
  it('a referência manda: linha-seção com rótulo + subtotal + contagem + checkbox do grupo', () => {
    expect(REF_CSS).toContain('tr.sec td')
    expect(REF_SCRIPT).toContain('tglSec')
    expect(REF_SCRIPT).toMatch(/tr class="sec/)
  })

  it('a tabela injeta a seção pelo id da 1ª linha e marca o grupo inteiro', () => {
    const limpo = semComentarios(TABELA)
    expect(limpo, 'a tela parou de agrupar pela lib').toContain('secoesDasLinhas')
    expect(limpo).toContain('secaoQueComecaAqui')
    const sec = blocoEntre(limpo, '{secao && (', '</tr>')
    expect(sec, 'o checkbox da seção sumiu').toContain('Checkbox')
    /**
     * ⛔⛔ O APERTO QUE A REGRA 11 COBROU: `toContain('secao.ids')` passou **VERDE** com o laço
     * do handler marcando NADA (`for (const id of [])`) — porque o `checked={secao.ids.every(…)}`
     * logo acima mantém o símbolo no bloco. ***Guard que conta a MENÇÃO aprova o laço vazio***
     * (a 20ª volta desta classe). O que morde é o CORPO do gesto.
     */
    const gesto = blocoEntre(sec, 'onCheckedChange={(v) => {', 'aria-label')
    expect(gesto, 'o checkbox do grupo deixou de marcar as linhas da faixa')
      .toContain('for (const id of secao.ids)')
    expect(gesto, 'o gesto da seção deixou de devolver a seleção').toContain('onSelectionChange')
    expect(sec, 'o subtotal da faixa sumiu do cabeçalho').toContain('secao.subtotal')
    expect(sec, 'a contagem da faixa sumiu').toContain('secao.contagem')
    expect(sec, 'a parcialidade deixou de ser DITA — a cicatriz do take: 50').toContain('secao.parcial')
    expect(sec, 'colSpan cravado — número à mão quebra no dia em que uma coluna for escondida')
      .toContain('colunasVisiveis')
  })

  it('⭐ o subtotal é o da FAIXA INTEIRA (agregado do servidor), nunca a soma da página', () => {
    const limpo = semComentarios(TABELA)
    expect(limpo).toContain('totaisPorEstado')
    const pag = semComentarios(PAGE)
    expect(pag, 'a tabela deixou de receber os totais do servidor')
      .toMatch(/totaisPorEstado=\{medidasDoTempo\}/)
  })
})

describe('P3 · SELO «⚠ sem banco» — a família dos R$ 66 mil invisíveis', () => {
  /** ⭐ as medidas saem do CSS da REFERÊNCIA (`.semb`), não de números que eu escolha */
  const semb = blocoEntre(REF_CSS, '.semb{', '}')

  it('a referência define a pílula na coluna da CATEGORIA', () => {
    expect(semb).toContain('font-size:9.5px')
    expect(semb).toContain('font-weight:800')
    expect(semb).toContain('padding:2px 7px')
    expect(semb).toContain('border-radius:999px')
    expect(semb).toContain('margin-left:6px')
    expect(semb).toContain('white-space:nowrap')
    expect(REF_SCRIPT).toContain('⚠ sem banco')
  })

  it('o selo em prod tem as MESMAS medidas e a mesma frase', () => {
    const limpo = semComentarios(TABELA)
    const selo = blocoEntre(limpo, 'function SeloSemBanco', '\n}')
    expect(selo).toContain('⚠ sem banco')
    expect(selo, 'a medida da pílula saiu da referência').toContain('text-[9.5px]')
    expect(selo).toContain('font-extrabold')
    expect(selo).toContain('px-[7px]')
    expect(selo).toContain('py-[2px]')
    expect(selo).toContain('rounded-full')
    expect(selo).toContain('ml-1.5')
    expect(selo).toContain('whitespace-nowrap')
  })

  it('⛔ o selo nasce da AUSÊNCIA de banco, nunca de uma flag paralela', () => {
    const selo = blocoEntre(semComentarios(TABELA), 'function SeloSemBanco', '\n}')
    expect(selo).toContain('row.bankAccount')
  })

  it('ele aparece na CATEGORIA — nos DOIS ramos da célula (editável e texto)', () => {
    const limpo = semComentarios(TABELA)
    expect(usosDe(limpo, 'SeloSemBanco'), 'o selo ficou num ramo só da célula de categoria')
      .toBeGreaterThanOrEqual(3)
  })
})

describe('⭐ A CARA NOVA — tokens por PAPEL, zero hex nas peças da fatia', () => {
  it('a referência declara a paleta nos DOIS temas', () => {
    expect(REF_CSS).toContain(':root{')
    expect(REF_CSS).toContain(':root[data-theme="light"]')
    for (const t of ['--acao', '--verde', '--coral', '--ambar', '--tinta']) {
      expect(REF_CSS.split(':root[data-theme="light"]')[0], `token ${t} fora do tema escuro`).toContain(t)
      expect(REF_CSS.split(':root[data-theme="light"]')[1], `token ${t} fora do tema claro`).toContain(t)
    }
  })

  it('⛔ nenhuma peça NOVA crava hex — e o legado da tela não cresceu', () => {
    expect(hexCravados(CARTOES), 'hex cravado nos cartões do tempo').toEqual([])
    expect(hexCravados(BARRA), 'hex cravado na barra').toEqual([])
    const selo = blocoEntre(semComentarios(TABELA), 'function SeloSemBanco', '\n}')
    expect(hexCravados(selo), 'hex cravado no selo sem-banco').toEqual([])
    /**
     * ⚠️ A TABELA tem hex do azul LEGADO (`#534AB7`) — pré-existente, e L1 proíbe mexer na
     * leitura. A catraca é o NÚMERO: a fatia não pode acrescentar nenhum.
     */
    expect(hexCravados(TABELA).length, 'a fatia acrescentou hex na tabela').toBeLessThanOrEqual(4)
  })

  it('as peças novas respondem aos DOIS temas', () => {
    expect(semComentarios(CARTOES), 'os cartões não têm variante escura').toContain('dark:')
    expect(semComentarios(BARRA), 'a régua não tem variante escura').toContain('dark:')
    const selo = blocoEntre(semComentarios(TABELA), 'function SeloSemBanco', '\n}')
    expect(selo, 'o selo pinta por hex/classe fixa — ele lê token da família').toContain('--fam-ambar')
  })
})

describe('⛔⛔ ZERO ESCRITA — a fatia 1 só LÊ', () => {
  it('nenhuma das peças novas grava nada', () => {
    for (const [nome, src] of [
      ['CartoesDoTempo', CARTOES],
      ['BulkActionsBar', BARRA],
      ['rotulo-do-tempo', ROTULO_LIB],
      ['selecao-do-filtro', ler('lib/contas-pagar/selecao-do-filtro.ts')],
      ['regua-do-caixa-na-selecao', ler('lib/contas-pagar/regua-do-caixa-na-selecao.ts')],
      ['secoes-da-tabela', ler('lib/contas-pagar/secoes-da-tabela.ts')],
    ] as const) {
      const limpo = semComentarios(src)
      expect(limpo, `${nome} passou a escrever no banco`).not.toMatch(
        /prisma\.|\.(create|update|delete|upsert)(Many)?\(/,
      )
      expect(limpo, `${nome} passou a mandar gesto de escrita`).not.toMatch(
        /method:\s*'(POST|PUT|PATCH|DELETE)'/,
      )
    }
  })

  it('a régua do caixa é PURA — e o saldo vem da porta da mesa ①, nunca de estoque', () => {
    const regua = ler('lib/contas-pagar/regua-do-caixa-na-selecao.ts')
    expect(semComentarios(regua)).not.toContain('import')
    const rota = semComentarios(ler('app/api/contas-a-pagar/route.ts'))
    expect(rota, 'o saldo do caixa saiu da porta única').toMatch(/serieDeSaldo|saldoAgora|regua-do-caixa/)
    expect(rota, 'o saldo passou a vir de saldosDaEmpresa — aquilo é ESTOQUE, somaria mercadoria')
      .not.toContain('saldosDaEmpresa')
  })

  it('⭐⭐ A MESMA RÉGUA DA MESA ① — uma porta, dois leitores (Lei C0)', () => {
    /**
     * ⛔ A régua do caixa foi **EXTRAÍDA** de `serieDeSaldo`, nunca copiada: `Σ balance das
     * contas de caixa` escrito aqui seria a SEGUNDA resposta pra *"quanto tem no caixa
     * agora"*, e ela divergiria da mesa ① no primeiro `accountType` novo. O guard exige que
     * a mesa **consuma** a extração — reintroduzir o `findMany` lá dentro fica vermelho.
     */
    const serie = semComentarios(ler('lib/balance/serie-de-saldo.ts'))
    expect(serie, 'a extração perdeu o consumidor — a mesa ① voltou a ter régua própria')
      .toContain('await contasDeCaixaComSaldo(companyId, db)')
    const corpo = blocoEntre(serie, 'export async function serieDeSaldo', 'const hojeBr')
    expect(corpo, 'a 2ª cópia do Σ do caixa voltou pra dentro da mesa ①')
      .not.toContain('db.bankAccount.findMany')
  })

  it('⛔ saldo não lido é «a apurar», NUNCA zero', () => {
    const regua = semComentarios(ler('lib/contas-pagar/regua-do-caixa-na-selecao.ts'))
    expect(regua).toContain("'a-apurar'")
    expect(regua, 'o ?? 0 voltou — coral sobre um saldo que ninguém mediu')
      .not.toMatch(/saldoHoje\s*\?\?\s*0/)
    const pag = semComentarios(PAGE)
    expect(pag, 'a tela passou a chutar zero quando o saldo não vem')
      .not.toMatch(/saldoCaixa\s*\?\?\s*0/)
  })
})

describe('⭐⭐ O RÓTULO NÃO TEM RÉGUA DE RECORTE — ele só diz TEXTO', () => {
  /**
   * ⚠️⚠️ **REAPONTADO em 23/10.** Até 21/10 este bloco exigia que `whereDaFaixa` **delegasse**
   * a `whereDoStatus` — porque a faixa TINHA régua de recorte, e sem a delegação ela escreveria
   * uma 2ª definição de *"vencida"* (o defeito de 13/09: card 34, tabela 9). ⭐⭐ **Agora a
   * pergunta é mais forte: a lib do rótulo NÃO PODE TER RÉGUA DE RECORTE NENHUMA.** Quem
   * recorta é o `whereDoStatus`, e os três estados são partição por construção — então a 2ª
   * régua deixou de ser *"não delegada"* e passou a ser **impossível** (REGRA 5).
   */
  it('⛔ a lib do rótulo não monta `where` nem conhece Prisma', () => {
    const limpo = semComentarios(ROTULO_LIB)
    expect(limpo, 'o rótulo passou a montar where — a 2ª régua de «vencida» renasceu')
      .not.toMatch(/where|dueDate:\s*\{|prisma/i)
    // ⭐ o que ele importa é só a fronteira do DIA (o dono da palavra segue sendo o escopo)
    expect(limpo).toContain('inicioDoDiaBrasil')
  })

  it('⛔ quem recorta é o `whereDoStatus`, e a rota mede os 3 estados por ele', () => {
    const rota = semComentarios(ler('app/api/contas-a-pagar/route.ts'))
    expect(rota, 'a rota deixou de medir pelos estados de aberto').toContain('ESCOPOS_EM_ABERTO')
    expect(rota, 'a rota passou a recortar por uma régua que não é o dono da palavra')
      .toContain('whereDoStatus')
  })

  it('⛔ a rota mede o rótulo no relógio do SERVIDOR (um relógio só manda)', () => {
    const rota = semComentarios(ler('app/api/contas-a-pagar/route.ts'))
    expect(rota).toContain('rotuloDoEscopo')
    // ⚠️ nem o escopo nem a faixa legada entram no input dos cards, senão clicar zera os números
    expect(rota).toMatch(/faixa:\s*undefined/)
    /**
     * ⚠️ `escopo: undefined` NÃO é conferido aqui: medido na rota, ele **não existe como
     * linha** — o `kpiBaseInput` dropa `status`/`q`/`vencidasOnly`/`faixa`, e o escopo é
     * passado por cada medida (`escopo: 'PAGA'`, `escopo` do laço dos estados). Afirmar a
     * linha seria afirmar uma forma que o código não tem.
     */
  })

  it('⛔⛔ a lib MORTA não volta — `faixa-do-tempo.ts` foi APAGADA, não deixada órfã', () => {
    /**
     * *Enquanto o arquivo existe, alguém religa* (a cicatriz do `GruposSugeridos`, 23/09) — e
     * aí a 2ª régua de "vencida" renasce com o guard verde.
     */
    expect(existsSync(join(raiz, 'lib/contas-pagar/faixa-do-tempo.ts')),
      'a faixa-do-tempo voltou a existir').toBe(false)
  })
})
