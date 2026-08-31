// ⭐⭐ O EDITOR REFEITO — as peças que a tela nova apoia (31/08/2026).
//
// ⛔ O QUE FALHOU ANTES: o comportamento estava certo e a TELA ensinou errado. Dois blocos
// de inputs idênticos em lados opostos, sem nada dizendo que "Rótulo" e o valor são partes
// da MESMA linha. O dono leu como duas coisas paralelas — porque a tela desenhou duas
// coisas paralelas.
//
// ⚠️ Sem jsdom não dá pra clicar aqui. O que estes testes travam é o que a tela CONSOME:
// as partes separadas, o reordenar único e o mapa que garante que todo campo tem como ser
// previsto. Se qualquer um quebrar, a tela volta a mentir.

import { describe, it, expect } from 'vitest'
import {
  BLOCOS_PADRAO, blocosParaLayout, previaDosBlocos, moverBloco, novoBlocoTexto,
  LADO_DOTS_USAVEL, MARGEM, ESPACO, type Bloco,
} from '../blocos'
import { ENTRADAS_PREVIA, entradasDaLinha } from '../campos-previa'
import { exemploDeEtiqueta } from '../exemplo'
import { LADO_DOTS, type CampoId, type DadosEtiqueta } from '../modelo'

const CARNE: DadosEtiqueta = {
  produto: 'Porção de carne 100g',
  lote: 'A1B2C3D4',
  fabricacao: new Date('2026-08-31T14:35:00'),
  validadeAte: new Date('2026-09-03T14:35:00'),
  estado: 'RESFRIADO',
  quantidade: 25,
  unidade: 'UN',
  colaborador: 'Cristian',
  empresa: 'Caçula Mix',
}

describe('⭐⭐ as DUAS PARTES da linha — o ensino que faltava', () => {
  it('⭐⭐ a linha chega separada em rótulo e conteúdo (é o que fica clicável)', () => {
    const val = blocosParaLayout(BLOCOS_PADRAO, CARNE).blocos.find((b) => b.bloco.campo === 'validade')!
    expect(val.partes.rotulo).toBe('VAL')
    expect(val.partes.conteudo).toBe('03/09/2026')
  })

  it('⭐⭐ e as partes RECOMPÕEM exatamente o texto desenhado (não são um 2º cálculo)', () => {
    // ⚠️ se as partes fossem montadas por outra régua, a etiqueta clicável mostraria uma
    // coisa e o ZPL imprimiria outra — a doença que este módulo mais paga.
    for (const p of blocosParaLayout(BLOCOS_PADRAO, CARNE).blocos) {
      const recomposto = p.partes.rotulo ? `${p.partes.rotulo} ${p.partes.conteudo}` : p.partes.conteudo
      expect(recomposto).toBe(p.valor)
    }
  })

  it('⭐ linha SEM rótulo tem a parte vazia (a tela não desenha chip nenhum)', () => {
    const prod = blocosParaLayout(BLOCOS_PADRAO, CARNE).blocos.find((b) => b.bloco.campo === 'produto')!
    expect(prod.partes.rotulo).toBe('')
    expect(prod.partes.conteudo).toBe('Porção de carne 100g')
  })

  it('⚠️ o rótulo do banco vem com espaço no fim — a parte sai LIMPA', () => {
    const comEspaco = BLOCOS_PADRAO.map((b) => (b.campo === 'lote' ? { ...b, rotulo: 'LOTE ' } : b))
    const l = blocosParaLayout(comEspaco, CARNE).blocos.find((b) => b.bloco.campo === 'lote')!
    expect(l.partes.rotulo).toBe('LOTE')      // sem o espaço, senão o chip da tela sai torto
    expect(l.valor).toBe('LOTE A1B2C3D4')     // e a linha continua com UM espaço
  })

  it('⭐ a prévia leva as partes e a faixa de clique da linha', () => {
    const c = previaDosBlocos(BLOCOS_PADRAO, CARNE).campos.find((x) => x.id === 'validade')!
    expect(c.partes.rotulo).toBe('VAL')
    expect(c.topoPct).toBeGreaterThan(0)
    expect(c.topoPct).toBeLessThan(100)
  })
})

describe('⭐⭐ reordenar: UMA função, dois gestos', () => {
  // ⚠️ arrastar e as setas ↑↓ existem nos DOIS (desktop e celular) e chamam esta função.
  // Dois comportamentos pra a mesma decisão é o "N caminhos, 1 esquecido".
  const nomes = (bs: Bloco[]) => bs.map((b) => b.campo ?? b.tipo)

  it('⭐ mover pra cima e pra baixo (o gesto das setas)', () => {
    const b = BLOCOS_PADRAO
    expect(nomes(moverBloco(b, 1, 0)).slice(0, 2)).toEqual(['validade', 'produto'])
    expect(nomes(moverBloco(b, 0, 1)).slice(0, 2)).toEqual(['validade', 'produto'])
  })

  it('⭐ mover pra longe (o gesto de arrastar) reposiciona sem perder ninguém', () => {
    const r = moverBloco(BLOCOS_PADRAO, 0, 5)
    expect(r.length).toBe(BLOCOS_PADRAO.length)
    expect(nomes(r)[5]).toBe('produto')
    expect(new Set(nomes(r))).toEqual(new Set(nomes(BLOCOS_PADRAO)))
  })

  it('⚠️ fora da lista NÃO move (arrastar pra fora é desistir, não "põe no fim")', () => {
    expect(moverBloco(BLOCOS_PADRAO, 0, -1)).toEqual(BLOCOS_PADRAO)
    expect(moverBloco(BLOCOS_PADRAO, 0, 99)).toEqual(BLOCOS_PADRAO)
    expect(moverBloco(BLOCOS_PADRAO, 3, 3)).toEqual(BLOCOS_PADRAO)
  })

  it('⭐⭐ e a ORDEM É O LAYOUT: mover muda a etiqueta na mesma medida', () => {
    const antes = blocosParaLayout(BLOCOS_PADRAO, CARNE).blocos.map((b) => b.bloco.campo)
    const depois = blocosParaLayout(moverBloco(BLOCOS_PADRAO, 0, 3), CARNE).blocos.map((b) => b.bloco.campo)
    expect(antes[0]).toBe('produto')
    expect(depois[0]).not.toBe('produto')
    expect(new Set(depois)).toEqual(new Set(antes))
  })
})

describe('⭐⭐ todo campo tem como editar o dado de exemplo', () => {
  it('⛔⛔ nenhum campo do modelo padrão fica sem jeito de ser previsto', () => {
    // ⚠️ ESTE é o teste que impede o bug original de voltar: o dono não conseguia trocar
    // "Porção de carne 100g" nem a data. Campo novo sem entrada aqui = campo que ele
    // não consegue prever — e aí ele vai tentar trocar pelo Rótulo de novo.
    const semEditor = BLOCOS_PADRAO
      .filter((b) => b.tipo === 'campo' && entradasDaLinha(b.campo).length === 0)
      .map((b) => b.campo)
    expect(semEditor).toEqual([])
  })

  it('⭐ o QR é a única exceção — e de propósito (ele carrega o LOTE)', () => {
    expect(ENTRADAS_PREVIA.qr).toEqual([])
    // dar um campo próprio ao QR criaria um 2º lugar pra dizer a mesma coisa
    expect(previaDosBlocos(BLOCOS_PADRAO, CARNE).campos.find((c) => c.id === 'qr')!.partes.conteudo)
      .toBe(CARNE.lote)
  })

  it('⭐ quantidade tem DOIS campos (número e unidade) — os dois viram uma linha só', () => {
    expect(entradasDaLinha('quantidade').map((e) => e.chave)).toEqual(['quantidade', 'unidade'])
    const l = blocosParaLayout(BLOCOS_PADRAO, CARNE).blocos.find((b) => b.bloco.campo === 'quantidade')!
    expect(l.partes.conteudo).toBe('25 UN')
  })

  it('⚠️ toda entrada aponta pra uma chave que EXISTE nos dados (chave torta = campo morto)', () => {
    const exemplo = exemploDeEtiqueta()
    for (const [campo, entradas] of Object.entries(ENTRADAS_PREVIA)) {
      for (const e of entradas) {
        expect(Object.keys(exemplo), `${campo} → ${String(e.chave)}`).toContain(String(e.chave))
      }
    }
  })
})

describe('⚠️ a barra "espaço usado" mede o MESMO limite que o estourou', () => {
  it('⛔ 100% da barra e o "estourou" viram na mesma linha', () => {
    // ⚠️ denominador próprio faria a barra dizer 92% numa etiqueta já estourada —
    // dois números pra a mesma pergunta.
    expect(LADO_DOTS_USAVEL).toBe(LADO_DOTS - MARGEM - ESPACO)

    const cabe = blocosParaLayout(BLOCOS_PADRAO, CARNE)
    expect(cabe.estourou).toBe(false)
    expect(cabe.alturaUsada).toBeLessThanOrEqual(LADO_DOTS_USAVEL)

    const demais: Bloco[] = [...BLOCOS_PADRAO, ...Array.from({ length: 6 }, (_, i) => ({
      ...novoBlocoTexto(`linha extra ${i}`), id: `x${i}`, fonte: 40,
    }))]
    const estoura = blocosParaLayout(demais, CARNE)
    expect(estoura.estourou).toBe(true)
    expect(estoura.alturaUsada).toBeGreaterThan(LADO_DOTS_USAVEL)
  })
})

describe('⭐ os dados de exemplo', () => {
  it('⚠️ é FUNÇÃO, não constante: duas chamadas dão datas diferentes ao longo do tempo', () => {
    // constante de módulo congelaria `new Date()` no carregamento do arquivo, e a aba
    // aberta há horas abriria a etiqueta com a fabricação de horas atrás.
    const a = exemploDeEtiqueta()
    expect(a.fabricacao).toBeInstanceOf(Date)
    expect(a.validadeAte!.getTime()).toBeGreaterThan(a.fabricacao.getTime())
  })

  it('⭐ e ele preenche todos os campos que a etiqueta desenha', () => {
    const l = blocosParaLayout(BLOCOS_PADRAO, exemploDeEtiqueta())
    // 8 linhas de texto + o QR fora do fluxo
    expect(l.blocos.length).toBe(8)
    expect(l.qr).not.toBeNull()
  })
})
