// ⛔⛔⛔ OS GOLDENS DE **TODOS** OS BANCOS, NUMA RODADA SÓ (16/09/2026)
//
// **A régua do dono:** *"consertar Banrisul roda os goldens de TODOS os bancos → se
// Sicredi quebrar, VERMELHO NA HORA, não no mês que vem na minha mão. 'Resolveu e voltou'
// vira impossível calado: a regressão morre no teste, não em prod."*
//
// ⛔ **OS GOLDENS JÁ EXISTIAM — SOLTOS, e era esse o buraco.** Cinco arquivos, um por
// banco, e **nada ligava** *"mexi no parser do Banrisul"* a *"rode o do Sicredi"*. Um
// conserto quebrava o vizinho **em silêncio**, e o defeito voltava semanas depois com cara
// de bug novo. Aqui a lista é UMA, e mexer em qualquer parser roda todas.
//
// ⚠️ **O QUE SE CONGELA É O QUE O DOCUMENTO DECLARA**, nunca o que a nossa soma produziu:
// congelar a nossa conta seria congelar o nosso erro junto dela.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { GOLDENS, parsersCobertos, goldensPara } from '../congelador'

const raiz = process.cwd()

/** ⭐ o parser de cada banco, resolvido pelo caminho que o congelador registra */
async function lerComOParserCerto(g: (typeof GOLDENS)[number], texto: string): Promise<{ declarado: number | null; fecha?: number | null }> {
  /**
   * ⚠️ CADA BANCO TEM O SEU CAMPO, e isso é o desenho, não desleixo: a composição que
   * fecha o Sicredi ("Total desta Fatura") não é a do Caixa ("Valor total desta fatura")
   * nem a do Banrisul ("TOTAL DE GASTOS" × "Saldo da fatura atual"). **Régua única aqui
   * reprovaria fatura correta** — foi a lição de 31/08.
   */
  if (g.parser.includes('sicredi-fatura-parser')) {
    const { parseSicrediFatura } = await import('../sicredi-fatura-parser')
    const r = parseSicrediFatura(texto)
    return { declarado: r.declared.totalFatura ?? r.declared.totalCartao ?? null }
  }
  if (g.parser.includes('banrisul-fatura-parser')) {
    const { parseBanrisulFatura } = await import('../banrisul-fatura-parser')
    const r = parseBanrisulFatura(texto)
    return { declarado: r.declared.totalGastos ?? null, fecha: r.declared.saldoAtual ?? null }
  }
  if (g.parser.includes('caixa-fatura-parser')) {
    const { parseCaixaFatura } = await import('../caixa-fatura-parser')
    const r = parseCaixaFatura(texto)
    return { declarado: r.declared.valorTotalFatura ?? null }
  }
  if (g.parser.includes('mercadopago-fatura-parser')) {
    const { parseMercadoPagoFatura } = await import('../mercadopago-fatura-parser')
    const r = parseMercadoPagoFatura(texto)
    return { declarado: r.declarados.total ?? null }
  }
  if (g.parser.includes('banrisul-fatura-pf')) {
    const { parseBanrisulFaturaPF } = await import('@/lib/fatura-banrisul/banrisul-fatura-pf')
    const r = parseBanrisulFaturaPF(texto)
    return { declarado: r.declared.totalGastos ?? null, fecha: r.declared.saldoAtual ?? null }
  }
  if (g.parser.includes('fatura-itau')) {
    const { parseItauFaturaPF } = await import('@/lib/fatura-itau/parser')
    const r = parseItauFaturaPF(texto)
    return { declarado: r.declared?.totalDaFatura ?? null }
  }
  if (g.parser.includes('fatura-nubank')) {
    const { parseNubankFaturaPF } = await import('@/lib/fatura-nubank/parser')
    const r = parseNubankFaturaPF(texto)
    return { declarado: r.declared?.totalAPagar ?? null }
  }
  throw new Error(`parser não mapeado no runner: ${g.parser}`)
}

describe('⛔⛔⛔ TODO golden de fatura, TODA rodada', () => {
  for (const g of GOLDENS) {
    describe(g.nome, () => {
      it('⭐ a fixture existe (senão o golden virou promessa)', () => {
        expect(existsSync(join(raiz, g.fixture)), `${g.fixture} sumiu — o congelador perdeu o alvo`).toBe(true)
      })

      it(`⭐ lê o total que o documento DECLARA · ${g.motivo}`, async () => {
        const texto = readFileSync(join(raiz, g.fixture), 'utf-8')
        const lido = await lerComOParserCerto(g, texto)

        if (g.esperado.declarado != null) {
          expect(
            lido.declarado,
            `${g.nome}: o parser leu ${lido.declarado} e o congelado é ${g.esperado.declarado}. `
            + 'Se foi VOCÊ que mexeu no parser de OUTRO banco, é a regressão silenciosa que este runner existe pra pegar.',
          ).toBeCloseTo(g.esperado.declarado, 2)
        }
        if (g.esperado.fecha != null) {
          expect(lido.fecha, `${g.nome}: a conferência deixou de fechar`).toBeCloseTo(g.esperado.fecha, 2)
        }
      })
    })
  }
})

describe('⛔⛔ o CONGELADOR cobre TODO parser de fatura — nenhum fica solto', () => {
  /**
   * ⭐ O guard que o dono pediu: *"parser alterado sem rodar os goldens de todos = não
   * passa no CI"*. A forma que isso toma aqui é **estrutural**: parser novo sem golden
   * fica vermelho, então ninguém consegue adicionar um banco que ninguém congela.
   */
  it('⭐ todo arquivo *-fatura-parser / fatura-*/parser tem golden no congelador', async () => {
    // ⚠️ `globSync` do node:fs não existe nesta versão — varredura à mão, que é explícita
    // e não depende de API que muda entre runtimes.
    const { readdirSync } = await import('node:fs')
    const candidatos: string[] = []
    for (const f of readdirSync(join(raiz, 'lib/credit-card-pj/deterministic'))) {
      if (f.endsWith('-fatura-parser.ts')) candidatos.push(`lib/credit-card-pj/deterministic/${f}`)
    }
    for (const dir of readdirSync(join(raiz, 'lib'))) {
      if (!dir.startsWith('fatura-')) continue
      for (const f of readdirSync(join(raiz, 'lib', dir))) {
        if (f === 'parser.ts' || f.endsWith('-fatura-pf.ts')) candidatos.push(`lib/${dir}/${f}`)
      }
    }
    const cobertos = parsersCobertos()
    const descobertos = candidatos.filter((c) => !cobertos.some((k) => c.includes(k) || k.includes(c)))

    expect(
      descobertos,
      'parser de fatura SEM golden: ele pode mudar sem ninguém ver. Congele um PDF lido certo em `congelador.ts`.',
    ).toEqual([])
  })

  /**
   * ⛔⛔ E A REGRA DE OURO: **mexer num parser roda TODOS**. `goldensPara` devolve a lista
   * inteira de propósito — não é filtro, é a afirmação de que não existe rodada parcial.
   */
  it('⛔ "mexi só no Banrisul" ainda roda o Sicredi e os outros', () => {
    const paraBanrisul = goldensPara('lib/credit-card-pj/deterministic/banrisul-fatura-parser.ts')
    expect(paraBanrisul.length, 'a rodada virou parcial — é assim que o vizinho quebra calado').toBe(GOLDENS.length)
    expect(paraBanrisul.map((g) => g.nome).join(' ')).toMatch(/Sicredi/)
    expect(paraBanrisul.map((g) => g.nome).join(' ')).toMatch(/Nubank/)
  })

  it('⭐ e há mais de um banco congelado (senão o runner não prova nada)', () => {
    const bancos = new Set(GOLDENS.map((g) => g.nome.split(' ·')[0]))
    expect(bancos.size).toBeGreaterThanOrEqual(5)
  })
})
