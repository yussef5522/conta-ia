/**
 * ⭐⭐⭐ ITEM NEGATIVO É AVISO NA LINHA DELE, NÃO VENENO NA FICHA (23/09/2026).
 *
 * **O dono, na ficha do XIS:** *"ERVILHA −45,48 sem custo derruba o CUSTO e a MARGEM da ficha
 * INTEIRA («a definir») e o «dá pra fazer» vira −4548 (número absurdo)."*
 *
 * ⚠️ A causa de fundo, medida: `custoMedio` é `valor/saldo` e **não existe com saldo ≤ 0** —
 * então um item negativo entra na receita **sem custo**, e a ficha inteira caía pra "a
 * definir". O conserto não é inventar custo: é **mostrar o parcial e nomear o que falta**.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ler = (p: string) => readFileSync(join(process.cwd(), p), 'utf-8')
const semComentario = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('⛔⛔ "dá pra fazer" NUNCA é negativo', () => {
  const src = semComentario(ler('lib/stock/cardapio/detalhe.ts'))

  it('⭐⭐ saldo negativo rende ZERO — falta é falta, não produção negativa', () => {
    expect(src, 'o rendeAte voltou a ser Math.floor(saldo/qtd) cru — o −4548 volta')
      .toContain('Math.max(0, Math.floor(saldo / qtdPorUnidade))')
  })

  it('⭐ e o componente carrega o estado "em falta", pro gargalo nomear', () => {
    expect(src).toContain('emFalta: saldo <= 0')
    expect(src).toMatch(/gargalo = \{ nome: c\.nome, rendeAte: c\.rendeAte, emFalta: c\.emFalta \}/)
  })

  it('⭐⭐ a TELA nomeia quem limita, com o motivo', () => {
    const tela = semComentario(ler('app/(dashboard)/empresas/[id]/estoque/cardapio/[chave]/page.tsx'))
    expect(tela).toContain('limitado por')
    expect(tela, 'o "em falta" sumiu — "limitado por ERVILHA" sem o motivo não ensina nada')
      .toContain("' — em falta'")
  })
})

describe('⭐⭐ o custo PARCIAL sobrevive ao componente sem custo', () => {
  it('⛔ a régua devolve o parcial, e o custo fechado continua null', () => {
    const hub = semComentario(ler('lib/stock/cardapio/hub.ts'))
    expect(hub).toContain('parcial: round2(total)')
    // ⛔ margem inventada é pior que margem ausente — o `custo` só fecha com TODAS as folhas
    expect(hub).toContain('custo: semCusto > 0 ? null : round2(total)')
  })

  it('⭐⭐ a tela mostra "R$ X +" e NOMEIA o que falta', () => {
    const tela = semComentario(ler('app/(dashboard)/empresas/[id]/estoque/cardapio/[chave]/page.tsx'))
    expect(tela, 'o custo parcial sumiu da tela — volta o "a definir" seco')
      .toContain('det.custoParcial > 0 ? `${brl(det.custoParcial)} +`')
    expect(tela).toContain('det.faltamCusto.slice(0, 2).join')
  })

  it('⛔⛔ a margem parcial vai marcada como TETO, nunca como a margem', () => {
    /**
     * ⚠️ O que falta só pode DERRUBAR a margem — então o número parcial é um limite
     * superior. Mostrá-lo sem o selo seria a tela afirmando uma margem que não se sustenta.
     */
    const tela = semComentario(ler('app/(dashboard)/empresas/[id]/estoque/cardapio/[chave]/page.tsx'))
    expect(tela).toContain('teto — falta custo de componente')
    expect(tela).toMatch(/`até \$\{Math\.round/)
  })

  it('⭐ e a linha do componente explica POR QUE não tem custo quando está negativo', () => {
    const tela = semComentario(ler('app/(dashboard)/empresas/[id]/estoque/cardapio/[chave]/page.tsx'))
    expect(tela).toContain('saiu mais do que entrou, por isso sem custo médio')
  })
})
