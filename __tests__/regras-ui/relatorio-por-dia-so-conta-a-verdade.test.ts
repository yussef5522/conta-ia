/**
 * ⛔⛔⛔ O GUARD DO ITEM 3 — *"a tela só conta a verdade; NENHUMA conta nova fora da porta"*.
 *
 * **Ordem do dono (04/10):** *"Dados que já existem no ledger/ordens — a tela só conta a
 * verdade; NENHUMA conta nova fora da porta `explodirReceita` / `eficienciaDaOrdem`
 * (REGRA 11: paralela = vermelho)."*
 *
 * ⭐⭐ **POR QUE ESTRUTURAL:** os testes de comportamento provam que as agregações de HOJE estão
 * certas. Eles **não impedem** alguém (eu, em três meses, "completando o relatório") de
 * recalcular a eficiência aqui em vez de ler a coluna congelada — e o estrago é **invisível**:
 * a tela mostraria um percentual plausível e o e-mail do juiz P8 mostraria outro, pro MESMO
 * lote. É a doença dos 7 detectores de par, em forma de relatório.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const raiz = process.cwd()
const ler = (rel: string) => readFileSync(join(raiz, rel), 'utf8')
const semComentario = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^[ \t]*\/\/.*$/gm, '')

const LIB = 'lib/stock/producao/relatorio-por-dia.ts'
const ROTA = 'app/api/empresas/[id]/estoque/producao/relatorio-por-dia/route.ts'
const TELA = 'app/(dashboard)/empresas/[id]/estoque/producao/por-dia/page.tsx'
const ROTA_CONSUMO = 'app/api/empresas/[id]/estoque/producao/ordens/[ordemId]/consumo/route.ts'
const TELA_DA_PRODUCAO = 'app/(dashboard)/empresas/[id]/estoque/producao/page.tsx'

describe('⭐⭐ o relatório TRADUZ — não calcula', () => {
  it('⭐⭐ os lotes vêm de `lotesDaJanela`, o dono da janela desde 13/09', () => {
    const lib = semComentario(ler(LIB))
    expect(lib).toContain('lotesDaJanela(')
    /**
     * ⛔ Uma query própria de conclusões faria este relatório e o de desempenho discordarem
     * sobre QUAIS lotes existem no mesmo dia — e os dois ficariam plausíveis.
     */
    expect(
      /stockProducaoConclusao\.findMany[\s\S]{0,400}criadoEm/.test(lib),
      'não monte a janela aqui: `lotesDaJanela` é quem responde "quais lotes existem"',
    ).toBe(false)
  })

  it('⛔⛔ a eficiência é a CONGELADA (`pctTeorico`), nunca recalculada', () => {
    const lib = semComentario(ler(LIB))
    expect(lib, 'tem que LER a coluna que o juiz P8 lê').toContain('pctTeorico')
    /**
     * ⛔ Recalcular aqui daria TRÊS percentuais pro mesmo lote: este relatório, o bloco da
     * ordem e o e-mail do P8. A coluna congelada é a única fonte.
     */
    expect(lib).not.toContain('eficienciaDaOrdem(')

    /**
     * ⚠️⚠️ **A REGRA 11 REPROVOU A 1ª VERSÃO DESTE TESTE — e o furo é a "menção, não uso" pela
     * 10ª vez nesta casa.** Eu conferia a MENÇÃO de `pctTeorico` (que fica no `select`, e
     * sobrevive a qualquer coisa) e proibia a FORMA `produzido / pedido`. Repondo o defeito
     * real — `eficiencia: l.entregue / l.pedido`, com os nomes que `lotesDaJanela` usa — o
     * guard passou **VERDE**. *Guard que adivinha o nome da variável errada não protege nada.*
     *
     * ⭐ O que morde é o **USO**: o campo `eficiencia` tem que ser ATRIBUÍDO a partir do mapa
     * da coluna congelada, e nada mais. Isso é imune ao nome do numerador.
     */
    /**
     * ⚠️⚠️ **E A 2ª VERSÃO FALHOU COM O CÓDIGO CERTO, pelo mesmo motivo invertido:** o 1º
     * `eficiencia:` do arquivo é a DECLARAÇÃO da interface (`eficiencia: number | null`), não
     * a atribuição. *A "menção, não uso" engana nos DOIS sentidos* — ora aprova o defeito, ora
     * reprova o acerto. O que delimita é a ESTRUTURA: o corpo do `lotes.map(`, onde a linha
     * do relatório é montada.
     */
    const corpoDoMap = lib.slice(lib.indexOf('lotes.map('))
    expect(corpoDoMap, 'não achei onde as linhas são montadas').not.toBe('')
    const atribuicao = corpoDoMap.match(/eficiencia:\s*([^,\n]+)/)
    expect(atribuicao, 'não achei a atribuição do campo `eficiencia`').not.toBeNull()
    expect(
      atribuicao![1],
      'o campo `eficiencia` tem que vir do mapa da coluna CONGELADA (pctTeorico), nunca de uma divisão',
    ).toContain('pctPorOrdem')
    expect(atribuicao![1], 'nenhuma divisão na atribuição da eficiência').not.toContain('/')
  })

  it('⭐⭐ as réguas compartilhadas são CHAMADAS, não reescritas', () => {
    const lib = semComentario(ler(LIB))
    for (const fn of ['somarQuantidades', 'rendimentoDoLote', 'foiMedido', 'ehRelampago']) {
      expect(lib, `${fn} tem dono em desempenho.ts — chame, não copie`).toContain(`${fn}(`)
    }
    expect(lib).toMatch(/from\s+'\.\/desempenho'/)
  })

  it('⛔⛔ o PISO do relâmpago não é digitado aqui (número solto é a 2ª régua)', () => {
    /**
     * ⚠️ O `5` de `PISO_DE_DURACAO_MIN` mora em `desempenho.ts`. Escrever `< 5` aqui faria
     * este relatório e os outros discordarem no dia em que o dono mudar o piso — é a cicatriz
     * do `TETO = 25` hardcoded e do `30` da janela do "a vencer".
     */
    const lib = semComentario(ler(LIB))
    expect(/minutos\s*[<>]=?\s*5\b/.test(lib), 'use foiMedido/ehRelampago').toBe(false)
  })

  it('⭐ a ROTA é casca: ela não soma nem divide nada', () => {
    const rota = semComentario(ler(ROTA))
    expect(rota).toContain('relatorioPorDia(')
    expect(/reduce\(|\.map\([^)]*\*|\/\s*lotes\b/.test(rota), 'a rota não calcula — ela chama').toBe(false)
  })

  it('⛔⛔ a TELA também não calcula: ela desenha o que o servidor mandou', () => {
    const tela = semComentario(ler(TELA))
    /**
     * ⚠️ O único `reduce` aceitável numa tela deste tipo seria somar o que o servidor já
     * somou — e aí seria a segunda derivação. A tela agrupa linhas por dia (apresentação) e
     * mais nada.
     */
    expect(/reduce\(/.test(tela), 'a tela não soma: os subtotais vêm do servidor').toBe(false)
    expect(tela, 'a quantidade usa o TEXTO do servidor (UN e KG nunca viram um número só)')
      .toMatch(/\.texto\}/)
  })
})

describe('⭐⭐ e a maçaneta existe (a família que esta casa pagou 11 vezes)', () => {
  it('a tela e a rota existem', () => {
    for (const rel of [TELA, ROTA, LIB]) {
      expect(() => statSync(join(raiz, rel)), `${rel} não existe`).not.toThrow()
    }
  })

  it('⭐ a Produção leva pro relatório, com afordância visível (não hover-only)', () => {
    const tela = semComentario(ler(TELA_DA_PRODUCAO))
    const links = [...tela.matchAll(/<a\b[\s\S]*?>/g)].filter((m) => m[0].includes('producao/por-dia'))
    expect(links.length, 'nenhum <a> aponta pro relatório por dia').toBeGreaterThan(0)
    for (const m of links) {
      expect(/border|bg-|rounded/.test(m[0]), 'o atalho precisa de borda/fundo — no celular não existe hover').toBe(true)
    }
  })

  /**
   * ⚠️⚠️ **ESTE TESTE FOI REAPONTADO EM 04/10 PORQUE O GESTO MUDOU POR PEDIDO DO DONO — ele
   * ficou vermelho COM A TELA CERTA.** A versão anterior afirmava *"clicar na linha NAVEGA pra
   * ordem"*; o dono pediu *"clicar na linha EXPANDE embaixo dela o bloco «o que saiu do estoque
   * pra esta ordem»"*.
   *
   * ⭐ **A régua que continua mordendo é a que importa: a ORDEM continua ALCANÇÁVEL da linha, nos
   * DOIS viewports** — agora pelo *"abrir a ordem →"* dentro do bloco que abre. Se alguém tirar o
   * caminho pra ordem, isto fica vermelho igual; o que deixou de ser exigido é a FORMA (navegar
   * no clique), não o destino. *Trocar um gesto não pode virar desculpa pra perder o destino.*
   */
  it('⭐ tocar a linha ABRE os produtos, e a ordem segue alcançável — nos dois viewports', () => {
    const tela = semComentario(ler(TELA))

    // o endereço da ordem tem UM dono na tela (href montado num lugar só)
    expect(tela, 'o href da ordem precisa de um construtor único').toMatch(
      /const ordemHref = \(ordemId: string\) => `\/empresas\/\$\{id\}\/estoque\/producao\/\$\{ordemId\}`/,
    )

    /**
     * ⛔ DOIS usos de cada, um por composição (REGRA 12): o gesto que ABRE e o caminho que
     * LEVA à ordem existem no desktop E no celular. Com um só, uma das duas telas perdeu
     * metade do comportamento — e é exatamente a metade que ninguém testa no notebook.
     */
    const toques = tela.match(/alternar\(l\.ordemId\)/g) ?? []
    expect(toques.length, 'o toque que abre tem que existir nas DUAS composições').toBe(2)

    const caminhos = tela.match(/href=\{ordemHref\(l\.ordemId\)\}/g) ?? []
    expect(caminhos.length, 'o caminho pra ordem tem que existir nas DUAS composições').toBe(2)

    // e o bloco que recebe esse href desenha um <a> de verdade (não um div com onClick)
    expect(tela).toMatch(/<a\s+href=\{href\}/)
    expect(tela).toContain('abrir a ordem →')
  })

  /**
   * ⭐⭐ O BLOCO QUE ABRE LÊ A MESMA FONTE DA TELA DA ORDEM — *"NUNCA recalcular por fora;
   * REGRA 11: fonte paralela = vermelho"* (palavras do dono).
   *
   * ⛔ E o `✓` do rodapé sai do **`bate` do SERVIDOR**, nunca de uma comparação feita aqui: a
   * tela não pode *"achar que bate"*. Medido em prod antes de escolher a fonte: `qtd × custo
   * médio de HOJE` diverge do `custoLoteReal` em até **R$ 40,96** (5 de 12 ordens), enquanto o
   * `custoTotal` congelado do ledger fecha a **R$ 0,01** — é por isso que a rota lê o ledger.
   */
  it('⛔⛔ o bloco do consumo NÃO soma nem confere nada — quem faz é o servidor', () => {
    const tela = semComentario(ler(TELA))
    const rota = semComentario(ler(ROTA_CONSUMO))

    // a tela desenha o total e o veredito que vieram prontos
    expect(tela).toMatch(/brl\(estado\.total\)/)
    expect(tela).toMatch(/estado\.bate === true/)
    // ⛔ nenhuma Σ própria do consumo na tela (a régua "a tela não soma", aplicada ao bloco novo)
    expect(/reduce\(/.test(tela), 'a tela não soma: o total do bloco vem do servidor').toBe(false)

    // e a rota lê o DONO ÚNICO do consumo, o mesmo que a tela de eficiência da ordem usa
    expect(rota, 'a rota tem que chamar consumoDaOrdem').toContain('consumoDaOrdem(')
    expect(
      /stockMovement\.findMany/.test(rota),
      'a rota não monta query própria de movimento — quem responde "o que consumiu" é consumoDaOrdem',
    ).toBe(false)
  })
})

/**
 * ⭐⭐⭐ "ESCOLHER O QUE EU VEJO" — a escolha do dono, persistida (04/10/2026).
 *
 * **Pedido:** *"Escolha SALVA EM TABELA por usuário (a régua do Real×Teórico: nunca
 * localStorage) — volto amanhã e está como deixei."*
 */
describe('⭐⭐ o seletor de receitas: escolha do dono, em TABELA', () => {
  const LIB_PREF = 'lib/stock/producao/receitas-ocultas.ts'

  /**
   * ⛔⛔ localStorage é por NAVEGADOR, e o dono confere no celular E no notebook — a escolha
   * feita num sumiria no outro. *"Salva por usuário" só é verdade se for no banco* (a decisão
   * da Mesa, 29/09). O guard proíbe a tela de inventar o atalho.
   */
  it('⛔⛔ NUNCA localStorage — a escolha mora no banco', () => {
    const tela = semComentario(ler(TELA))
    expect(/localStorage|sessionStorage/.test(tela), 'a preferência é TABELA, não navegador').toBe(false)
    const lib = semComentario(ler(LIB_PREF))
    expect(lib, 'a lib grava na tabela da preferência').toContain('stockPorDiaPreferencia')
    expect(lib, 'por (empresa, usuário) — a chave única do banco').toMatch(/companyId_userId/)
  })

  /**
   * ⛔⛔ **DELTA, nunca a lista inteira.** O painel só conhece as receitas do período ABERTO; se
   * ele mandasse a lista completa, abrir "hoje" (onde o TOMATE PICADO não produziu) e mexer em
   * qualquer coisa **apagaria o TOMATE da preferência em silêncio** — o dono voltaria amanhã e o
   * preparo que ele escondeu estaria de volta. *Só se decide sobre o que se vê.*
   */
  it('⛔⛔ a tela manda DELTA (ocultar/mostrar), nunca a lista inteira', () => {
    const tela = semComentario(ler(TELA))
    expect(tela, 'o gesto manda delta').toMatch(/salvarPref\(\{\s*(ocultar|mostrar)/)
    expect(
      /body: JSON\.stringify\(\{\s*ocultas/.test(tela),
      'substituir a lista apagaria em silêncio o que foi escondido fora do período',
    ).toBe(false)
    const rota = semComentario(ler(ROTA))
    expect(rota, 'a rota aplica o delta pela lib').toContain('aplicarDelta(')
    // ⚠️ o schema aceita os dois lados do delta, e NÃO um campo de lista inteira
    expect(rota).toContain('ocultar: z.array')
    expect(rota).toContain('mostrar: z.array')
  })

  /**
   * ⛔⛔ O TESTE QUE IMPEDE O PAINEL DE SE SUICIDAR: a lista que ele desenha é a COMPLETA
   * (`receitasDoPeriodo`), não as linhas filtradas. Derivá-la do que sobrou tiraria a receita
   * oculta do próprio painel que existe pra desocultá-la.
   */
  it('⭐⭐ o painel lê a lista COMPLETA, não as linhas desenhadas', () => {
    const tela = semComentario(ler(TELA))
    expect(tela).toMatch(/receitasFiltradas = useMemo\(\s*\(\)\s*=>\s*\(data\?\.receitasDoPeriodo/)
    expect(
      /receitasDoPeriodo.*=.*data\.linhas|new Set\(data\.linhas\.map/.test(tela),
      'derivar das linhas filtradas esconderia o gesto de desfazer',
    ).toBe(false)
    // ⚠️ e o CHIP de filtro também: a rota tira as tarefas da lista completa
    const rota = semComentario(ler(ROTA))
    expect(rota).toMatch(/tarefas: r\.receitasDoPeriodo/)
  })

  /**
   * ⭐ HONESTIDADE: *"a tela diz que está filtrando"*. E o número é o do PERÍODO, nunca o
   * tamanho da preferência — 10 ocultas com 3 produzindo no recorte são 3.
   */
  it('⭐⭐ o rodapé DIZ quantas estão ocultas, e oferece o [mostrar]', () => {
    const tela = semComentario(ler(TELA))
    expect(tela).toMatch(/receitas? ocultas?/)
    expect(tela, 'com o gesto de desfazer ao lado').toMatch(/>\s*mostrar\s*</)
    expect(tela, 'conta o do PERÍODO').toMatch(/ocultas = data\?\.ocultasNoPeriodo/)
    // ⛔ e some quando não há nenhuma (móvel zerado treina o dono a não olhar)
    expect(tela).toMatch(/\{ocultas > 0 && \(/)
  })

  /**
   * ⭐ O SUFIXO "(das visíveis)" — sem ele o dono compararia o total de hoje com o de ontem sem
   * saber que a régua mudou. ⛔ Nos DOIS viewports (REGRA 12).
   */
  it('⭐ com oculta, o total ganha "(das visíveis)" — nos dois viewports', () => {
    const tela = semComentario(ler(TELA))
    expect(tela).toContain("const suf = ocultas > 0 ? ' (das visíveis)' : ''")
    const usos = tela.match(/total do dia\{suf\}/g) ?? []
    expect(usos.length, 'o TOTAL DO DIA é marcado no desktop E no celular').toBe(2)
    expect(tela, 'e o cabeçalho do período também').toMatch(/a \{dia\(data\.periodo\.ate\)\}\{suf\}/)
  })

  /**
   * ⛔⛔ E O INVARIANTE QUE SEGURA TUDO: o recorte entra **antes** das agregações. Esconder só no
   * desenho deixaria o subtotal somando lote que a tela não mostra.
   */
  it('⛔⛔ o oculto é cortado ANTES de agregar (é o que faz o Σ fechar)', () => {
    const lib = semComentario(ler(LIB))
    const chamada = lib.indexOf('recortarPorReceitasVisiveis(linhas')
    /**
     * ⚠️⚠️ **A 1ª VERSÃO DESTE TESTE VEIO VERDE COM O DEFEITO REPOSTO — "menção, não uso" pela
     * 11ª vez nesta casa.** Eu media só a ORDEM (`chamada < agregação`); repondo o defeito real
     * — apagar o `linhas = recorte.linhas`, ou seja CHAMAR o recorte e **jogar o resultado
     * fora** — a ordem seguia certa e o guard passava, com o relatório mostrando as receitas
     * que o dono escondeu. *Chamar não é usar.*
     *
     * ⭐ O que morde é a ATRIBUIÇÃO: a lista que vai pra agregação tem que SER a do recorte.
     */
    const uso = lib.indexOf('linhas = recorte.linhas')
    const jDia = lib.indexOf('agruparPorDia(linhas)')
    const jRec = lib.indexOf('agruparPorReceita(linhas)')
    expect(chamada, 'não achei a chamada do recorte').toBeGreaterThan(0)
    expect(uso, 'o resultado do recorte tem que SUBSTITUIR as linhas, não só ser calculado').toBeGreaterThan(0)
    expect(uso, 'e a substituição vem ANTES do agruparPorDia').toBeLessThan(jDia)
    expect(uso, 'e ANTES do agruparPorReceita').toBeLessThan(jRec)
  })
})
