/**
 * ⭐⭐⭐ REUNITIZAR O ITEM NUNCA É EFEITO COLATERAL DO RECEBIMENTO (24/09/2026).
 *
 * **O dono, com a nota do ALAN:** *"item da nota «SAL CISNE REFINADO 1KG · 10 UN · R$ 4,79»,
 * destino «sal» (controlado em KG). O preview propõe «o item passa a ser controlado em UN» +
 * converter 41 movimentos e 18 fichas + «saldo −0,9 KG → −12,76 UN» (número sem sentido)."*
 *
 * ⭐⭐ **SÃO DUAS PERGUNTAS DIFERENTES que "a unidade difere" não separa:**
 *   - **a nota veio noutra unidade** → é o **FATOR**, e converte **SÓ A ENTRADA**;
 *   - **o dono CORRIGIU a unidade** → aí a régua do ITEM está errada (o queijo, 11/09).
 *
 * ⚠️ **E A GRAVAÇÃO SEMPRE ESTEVE CERTA** (`if (aval.corrigida && …)`). Quem mentia era o
 * PREVIEW — o pior lugar possível, porque é onde o dono decide.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { avaliarUnidadeDeEntrada, normalizarUnidade } from '../unidade-de-entrada'
import { sugerirFator } from '../unidade-fator'

const ler = (p: string) => readFileSync(join(process.cwd(), p), 'utf-8')
const semComentario = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

/** a condição REAL que decide se o item é reunitizado — a MESMA nos dois lados */
const reunitiza = (e: Parameters<typeof avaliarUnidadeDeEntrada>[0]) => {
  const a = avaliarUnidadeDeEntrada(e)
  return a.corrigida && normalizarUnidade(a.unidade) !== normalizarUnidade(e.unidadeItem)
}

describe('⛔⛔ a nota noutra unidade é FATOR, não reunitização', () => {
  const SAL = { unidadeNota: 'UN', unidadeTributaria: 'UN', unidadeItem: 'KG', fator: 1 }

  it('⭐⭐ O CASO DO ALAN: nota em UN, item em KG, sem correção → NÃO reunitiza', () => {
    expect(reunitiza({ ...SAL, unidadeEntrada: null }), 'o recebimento voltou a propor trocar a régua do item').toBe(false)
  })

  it('⭐ e o FATOR é o caminho — sugerido pela própria nota, com a conta à vista', () => {
    const s = sugerirFator({ xProd: 'SAL CISNE REFINADO EXTRA 1KG', unidadeControle: 'KG', uCom: 'UN', fatorNota: 1, vUnCom: 4.79 })
    expect(s.fator, '1 UN da nota = 1 KG (o "1KG" do nome, confirmado pela tributária)').toBe(1)
    // ⚠️ o `Intl` usa espaço NÃO-QUEBRÁVEL depois do "R$" — comparar com espaço comum falha
    expect(s.explicacao).toMatch(/R\$.4,79\/KG/)
  })

  it('⭐⭐ o caso do QUEIJO (11/09) CONTINUA reunitizando — a régua não afrouxou', () => {
    // nota em UN, item em UN, o dono corrige pra KG: aí sim a régua do item está errada
    expect(reunitiza({ unidadeNota: 'UN', unidadeTributaria: 'UN', unidadeItem: 'UN', unidadeEntrada: 'KG', fator: 2 })).toBe(true)
  })

  it('⭐ corrigir pra a unidade que o item JÁ tem não reunitiza nada', () => {
    expect(reunitiza({ ...SAL, unidadeEntrada: 'KG' })).toBe(false)
  })

  it('⛔⛔ e a TELA usa a MESMA função do servidor (REGRA 4)', () => {
    /**
     * ⚠️ As duas condições escritas em paralelo **concordavam por acaso** nos três casos
     * que eu testei — e é exatamente assim que a divergência nasce no quarto.
     */
    const tela = semComentario(ler('components/estoque/conferencia-view.tsx'))
    expect(tela, 'a tela voltou a ter régua própria pra decidir se reunitiza')
      .toContain('avaliarUnidadeDeEntrada({')
    expect(tela).toMatch(/aval\.corrigida && normalizarUnidade\(aval\.unidade\) !== normalizarUnidade/)
    // ⛔ e a condição velha (que colapsava as duas perguntas) não pode voltar
    expect(tela).not.toMatch(/const entrada = e\?\.unidadeEntrada \?\? it\.uCom/)
  })

  it('⭐ o SERVIDOR continua sendo quem decide de verdade', () => {
    const conf = semComentario(ler('lib/stock/confirmar-conferencia.ts'))
    expect(conf).toMatch(/if \(aval\.corrigida && itemDoBanco/)
  })
})

describe('⛔⛔⛔ o preview do reunitizar tinha DUAS RÉGUAS DE SALDO', () => {
  it('⭐⭐ o "depois" aplica a MESMA régua de prateleira do saldo', () => {
    /**
     * **Medido no SAL:** `antes` vinha do `saldoItem` (que exclui `PRODUCAO_CONSUMO`,
     * transferência interna) e `depois` somava o plano CRU. Com **fator 1 — sem mudar
     * NADA** — o card dizia *"saldo −0,9 KG → −12,76 UN"*, porque −12,76 é a soma dos 41
     * movimentos incluindo os 19 consumos de produção (−11,86).
     */
    const src = semComentario(ler('lib/stock/reunitizar-item.ts'))
    expect(src, 'o saldo do "depois" voltou a somar o plano cru — o −12,76 volta')
      .toContain('const naPrateleira = (m: { tipo: string }) => movePrateleira(m.tipo)')
    expect(src).toMatch(/plano\.converte\.filter\(naPrateleira\)/)
    expect(src).toMatch(/plano\.jaEstaCerto\.filter\(naPrateleira\)/)
  })

  it('⭐ e o plano carrega o TIPO, senão a régua não tem como ser aplicada', () => {
    const src = semComentario(ler('lib/stock/unidade-do-movimento.ts'))
    expect(src).toContain('tipo: string')
    expect(src).toMatch(/tipo: m\.tipo/)
  })
})

describe('⛔⛔ a PORTA do negativo tem MAÇANETA do outro lado', () => {
  /**
   * ⚠️ A recusa manda o dono pra ficha do item dizendo *"corrigir a entrada que faltou"* —
   * e a ficha **não oferecia gesto nenhum**. Porta sem maçaneta, a 10ª volta da família.
   */
  it('⭐⭐ a ficha do item OFERECE a entrada quando o saldo é negativo', () => {
    const tela = semComentario(ler('app/(dashboard)/empresas/[id]/estoque/itens/[itemId]/page.tsx'))
    expect(tela, 'a ficha do item não oferece a entrada — a porta do negativo leva ao nada')
      .toContain('lançar a entrada que faltou')
    expect(tela).toMatch(/ficha\.saldo < 0 &&/)
    // ⛔ e é BOTÃO, não texto com hover: no celular hover não existe (30/08)
    expect(tela).toMatch(/entrada-manual\?item=\$\{itemId\}/)
    expect(tela).toContain('border-amber-500')
  })

  it('⭐ e a entrada manual ABRE com o item escolhido — sem procurar de novo entre 159', () => {
    const tela = semComentario(ler('app/(dashboard)/empresas/[id]/estoque/entrada-manual/page.tsx'))
    expect(tela).toContain("new URLSearchParams(window.location.search).get('item')")
    // ⚠️ no 1º render, não em useEffect: a tela pisca vazia e "voltar e não ver nada" é
    // indistinguível de "não pegou"
    expect(tela).toMatch(/useState<Linha\[\]>\(\(\) =>/)
  })

  it('⭐ a porta do negativo continua apontando pra ficha do item', () => {
    const src = semComentario(ler('lib/stock/porta-do-negativo.ts'))
    expect(src).toMatch(/href: `\$\{base\}\/itens\/\$\{f\.itemId\}`/)
  })
})
