/**
 * ⛔⛔⛔ O GUARD DE PÁGINA DA LEI 0 — "duas telas, uma verdade" (29/09/2026)
 *
 * **A ordem do dono:** *"a tela Real × Teórico passa a ler EXCLUSIVAMENTE o motor do Radar
 * — o cálculo próprio que ela tem hoje MORRE. Guard de página: qualquer divergência =
 * vermelho."*
 *
 * ⚠️ **ESTE É O GUARD ESTRUTURAL, e ele é assumido como tal.** Quem prova o NÚMERO é
 * `lib/stock/radar/__tests__/mesa-le-o-motor-do-radar.integration.test.ts`, que roda os
 * DOIS motores contra o banco e compara. Este aqui trava a FORMA: o caminho da tela não
 * pode voltar a ter uma segunda conta — porque no dia em que tiver, o teste de número vai
 * acusar uma divergência cuja causa ninguém vai achar rápido.
 *
 * ⛔ **E ele tem AUTO-TESTE do detector** (a lição dos guards que nasceram cegos): se o
 * padrão que ele procura deixar de casar com o código antigo, ele passa por cegueira.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const raiz = process.cwd()
const ler = (p: string) => readFileSync(join(raiz, p), 'utf-8')
/** ⚠️ sem comentário: o arquivo que DOCUMENTA o defeito não pode ser o que o absolve */
const semComentario = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const ROTA = 'app/api/empresas/[id]/estoque/real-vs-teorico/route.ts'
const TELA = 'app/(dashboard)/empresas/[id]/estoque/real-vs-teorico/page.tsx'
const MESA = 'lib/stock/radar/mesa.ts'

describe('⛔⛔⛔ a mesa lê o motor do Radar, e só ele', () => {
  const rota = semComentario(ler(ROTA))

  it('⭐⭐ a rota chama `calcularFechamentoDoDia` — o motor do Radar', () => {
    expect(rota).toContain('calcularFechamentoDoDia')
    expect(rota).toContain("from '@/lib/stock/radar/fechamento'")
  })

  it('⛔⛔ e NÃO chama mais o cálculo paralelo que morreu', () => {
    /**
     * ⚠️ Os dois **discordavam de verdade**: `calcularRealVsTeorico` somava TODOS os
     * `AJUSTE_CONTAGEM` do período; o Radar usa a ÚLTIMA contagem de cada item. Item
     * contado duas vezes no período dava dois números, e nenhuma tela dizia qual valia.
     */
    expect(rota, 'o cálculo paralelo voltou pra rota — duas telas, duas verdades')
      .not.toMatch(/calcularRealVsTeorico\s*\(/)
  })

  it('⭐ o vocabulário (TIPOS, PISO_DADOS) pode continuar vindo de lá — ele não é a conta', () => {
    // ⚠️ o próprio motor do Radar importa os dois; proibir o arquivo inteiro seria
    // confundir "a segunda conta" com "o dicionário do módulo".
    const motor = ler('lib/stock/radar/fechamento.ts')
    expect(motor).toContain("from '@/lib/stock/real-vs-teorico'")
  })

  it('⛔⛔ a MESA não soma o ledger: ela traduz a linha que o motor devolveu', () => {
    const mesa = semComentario(ler(MESA))
    // nenhuma consulta ao banco, nenhum acesso a movimento cru
    expect(mesa).not.toMatch(/prisma|db\./)
    expect(mesa).not.toMatch(/stockMovement|stockContagemItem/)
    // e a variância é CAMPO do motor, não conta local
    expect(mesa).toMatch(/variancia:\s*l\.faltou\b/)
    expect(mesa, 'alguém recalculou a variância na mesa').not.toMatch(/real\s*-\s*teorico|contamos\s*-\s*deviaTer/)
  })

  it('⛔ a TELA também não recalcula — ela pinta o que veio pronto', () => {
    const tela = semComentario(ler(TELA))
    expect(tela).not.toMatch(/calcularRealVsTeorico|calcularFechamentoDoDia/)
    // o confronto com o Radar viaja no payload e é MOSTRADO
    expect(tela).toContain('placarDoRadar')
    expect(tela).toMatch(/divergiu/)
  })

  it('⭐ e a tela usa as MESMAS watchlists do Radar (uma configuração só)', () => {
    expect(rota).toContain('listasDoRadar')
  })
})

describe('⛔ o detector deste guard PEGA o código antigo (auto-teste)', () => {
  it('⚠️ a forma que ele proíbe é a que a rota tinha antes', () => {
    const antiga = `
      import { calcularRealVsTeorico } from '@/lib/stock/real-vs-teorico'
      const r = await calcularRealVsTeorico({ companyId, de, ate }, prisma)
    `
    expect(antiga).toMatch(/calcularRealVsTeorico\s*\(/) // ⭐ o detector morde o passado
    const nova = "const radar = await calcularFechamentoDoDia({ companyId, de, ate, caros, revenda, porcoes }, prisma)"
    expect(nova).not.toMatch(/calcularRealVsTeorico\s*\(/) // ⛔ e não acusa o presente
  })
})

describe('⭐ a tela nasce com o guard de família (a lição da lixeira, 20/09)', () => {
  const tela = semComentario(ler(TELA))

  it('⛔ estados EXPLÍCITOS — "ausência de dado" nunca é estado', () => {
    expect(tela).toContain("'CARREGANDO' | 'FALHOU' | 'OK'")
    expect(tela).toContain('tentar de novo')
  })

  it('⛔ e a carga tem teto de tempo (fetchComTimeout), nunca `fetch` cru', () => {
    expect(tela).toContain('fetchComTimeout')
    expect(tela).not.toMatch(/[^m]\bfetch\(/)
  })

  it('⭐ o vazio da busca DIZ o recorte — nunca "nada encontrado" seco', () => {
    expect(tela).toContain('entre os')
    expect(tela).toContain('listas do Radar')
  })
})
