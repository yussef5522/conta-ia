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
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { semComentarios, usosDe, hexCravados, blocoEntre } from './_leitura-de-fonte'

const raiz = process.cwd()
const ler = (p: string) => readFileSync(join(raiz, p), 'utf8')

const REF = ler('docs/contas-a-pagar-referencia.html')
const PAGE = ler('app/(dashboard)/contas-a-pagar/page.tsx')
const TABELA = ler('components/contas-pagar/PayableTable.tsx')
const BARRA = ler('components/contas-pagar/BulkActionsBar.tsx')
const CHIPS = ler('components/contas-pagar/ChipsDasFaixas.tsx')

/** ⭐ o CSS e o `<script>` da referência, separados: um manda na FORMA, o outro no COMPORTAMENTO */
const REF_CSS = blocoEntre(REF, '<style>', '</style>')
const REF_SCRIPT = blocoEntre(REF, '<script>', '</script>')

describe('a referência versionada é a lei — e ela existe de verdade', () => {
  it('o arquivo é o que o dono aprovou (título v2) e traz as 3 regras P1–P3', () => {
    expect(REF).toContain('CONTAS A PAGAR · PROPOSTA v2')
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
    expect(limpo).toContain('foraDaPagina')
    expect(limpo).toContain('em outra página')
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

describe('P2 · FAIXAS DO TEMPO — o rótulo adulto é NOME + DATA', () => {
  it('a referência põe a data no rótulo das 4 faixas de data', () => {
    for (const rot of ['VENCIDAS', 'VENCE HOJE', 'PRÓXIMOS 7 DIAS', 'RESTO DO MÊS']) {
      expect(REF_SCRIPT, `a faixa «${rot}» saiu da referência`).toContain(rot)
    }
    // ⚠️ o `sub` É a data: a lei do rótulo adulto mora nele
    expect(REF_SCRIPT).toMatch(/sub:"até ontem · \d{2}\/\d{2}"/)
    expect(REF_SCRIPT).toMatch(/sub:"\d{2} a \d{2}\/\d{2}"/)
  })

  it('os chips desenham o rótulo que o SERVIDOR mediu — a tela não deriva data', () => {
    const limpo = semComentarios(CHIPS)
    expect(limpo, 'o chip parou de desenhar o rótulo medido').toContain('m.rotulo')
    expect(limpo, 'a tela voltou a derivar o rótulo — um relógio só manda')
      .not.toMatch(/nomeDaFaixa|dataDaFaixa|rotuloDaFaixa|new Date\(\)/)
  })

  it('⛔ o chip FILTRA, e o número não é morto', () => {
    expect(REF_SCRIPT).toContain('onclick="filtrar(')
    const limpo = semComentarios(CHIPS)
    expect(limpo).toContain('onEscolher')
    expect(limpo).toContain('aria-pressed')
    const pag = semComentarios(PAGE)
    expect(pag, 'a tela parou de desenhar os chips').toContain('<ChipsDasFaixas')
    // ⭐ o chip zera o escopo dos cards: senão a lista é recortada 2× e o número divergiria
    const chamada = blocoEntre(pag, '<ChipsDasFaixas', '/>')
    expect(chamada).toContain('faixa: f')
    expect(chamada, 'o chip deixou de zerar o escopo — a divergência de 13/09').toContain('escopo: undefined')
  })

  it('⭐ Σ DAS FAIXAS == TOTAL EM ABERTO, e a tela GRITA quando não fecha', () => {
    const limpo = semComentarios(CHIPS)
    expect(limpo).toContain('somaDasFaixas')
    expect(limpo).toContain('totalEmAberto')
    expect(limpo, 'o invariante deixou de ser VISÍVEL na tela').toMatch(/Math\.abs\(somaDasFaixas - totalEmAberto\)/)
  })

  it('a faixa FILTRADA nunca desaparece da fileira', () => {
    const vis = blocoEntre(semComentarios(CHIPS), 'export function faixasVisiveis', '\n}')
    expect(vis).toContain('faixaAtiva')
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
    expect(limpo).toContain('totaisPorFaixa')
    const pag = semComentarios(PAGE)
    expect(pag, 'a tabela deixou de receber os totais do servidor').toMatch(/totaisPorFaixa=\{faixas\}/)
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
    expect(hexCravados(CHIPS), 'hex cravado nos chips das faixas').toEqual([])
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
    expect(semComentarios(CHIPS), 'os chips não têm variante escura').toContain('dark:')
    expect(semComentarios(BARRA), 'a régua não tem variante escura').toContain('dark:')
    const selo = blocoEntre(semComentarios(TABELA), 'function SeloSemBanco', '\n}')
    expect(selo, 'o selo pinta por hex/classe fixa — ele lê token da família').toContain('--fam-ambar')
  })
})

describe('⛔⛔ ZERO ESCRITA — a fatia 1 só LÊ', () => {
  it('nenhuma das peças novas grava nada', () => {
    for (const [nome, src] of [
      ['ChipsDasFaixas', CHIPS],
      ['BulkActionsBar', BARRA],
      ['faixa-do-tempo', ler('lib/contas-pagar/faixa-do-tempo.ts')],
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

describe('⭐ as faixas DERIVAM do dono da palavra — nunca uma 2ª régua de «vencida»', () => {
  it('whereDaFaixa delega em whereDoStatus nos dois degraus que ele já partia', () => {
    const faixa = semComentarios(ler('lib/contas-pagar/faixa-do-tempo.ts'))
    expect(faixa, 'a faixa passou a escrever a própria régua de vencida — o defeito de 13/09')
      .toContain('whereDoStatus')
    expect(faixa).toContain('inicioDoDiaBrasil')
  })

  it('⛔ a rota mede o rótulo no relógio do SERVIDOR (um relógio só manda)', () => {
    const rota = semComentarios(ler('app/api/contas-a-pagar/route.ts'))
    expect(rota).toContain('rotuloDaFaixa')
    expect(rota).toContain('faixaTemIntervaloVazio')
    // ⚠️ o filtro de faixa NÃO pode entrar no input dos cards, senão clicar zera os 4 números
    expect(rota).toMatch(/faixa:\s*undefined/)
  })
})
