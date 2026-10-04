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

  it('⛔ clicar na linha abre a ORDEM (o pedido do dono), nos dois viewports', () => {
    const tela = semComentario(ler(TELA))
    // desktop: a linha da tabela navega
    expect(tela).toMatch(/estoque\/producao\/\$\{l\.ordemId\}/)
    // celular: o card é um <a> de verdade (não um div com onClick)
    expect(tela).toMatch(/<a[\s\S]{0,200}estoque\/producao\/\$\{l\.ordemId\}/)
  })
})
