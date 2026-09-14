// ⭐⭐ IDA COM VOLTA — a régua pura (14/09/2026).
//
// **O dono:** *"nasce a ficha → volto pra revisão NO MESMO dia/scroll, com a linha já
// vinculada. **Ida com volta não é expulsão.**"*
//
// ⛔ Estes testes existem porque a regra **não pode morar no componente**: o projeto roda em
// `environment: node`, sem jsdom, e regra dentro de JSX é regra que ninguém prova — foi
// assim que o prefill do cardápio quebrou duas vezes (28/08).

import { describe, it, expect } from 'vitest'
import { abaDoRelatorio, ancoraDaLinha, urlDaRevisao, hrefDoEditor } from '../volta-da-revisao'
import { ehCaminhoInterno } from '@/lib/stock/producao/voltar-ficha'

describe('⭐ a volta cai no MESMO dia e na MESMA linha', () => {
  it('a URL reabre o dia com a aba e o relatório certos', () => {
    const u = urlDaRevisao('emp1', 'COMPLEMENTOS', '2026-09-13')
    expect(u).toContain('aba=complementos')
    expect(u).toContain('revisar=2026-09-13')
    expect(u).toContain('relatorio=COMPLEMENTOS')
  })

  it('⭐ com o nome, ela traz a âncora da linha', () => {
    expect(urlDaRevisao('emp1', 'COMPLEMENTOS', '2026-09-13', 'COCA LATA MAIS MINI FRITAS'))
      .toContain('#rev-coca-lata-mais-mini-fritas')
  })

  it('cada relatório tem a sua aba — produtos NÃO cai na de complementos', () => {
    expect(abaDoRelatorio('PRODUTOS')).toBe('processados')
    expect(abaDoRelatorio('COMPLEMENTOS')).toBe('complementos')
  })

  /**
   * ⚠️ O slug é conservador de propósito: nome do PDV tem acento, barra e parêntese, e um
   * `id` de HTML com esses caracteres quebra o `querySelector` — a âncora existiria e o
   * scroll não aconteceria, **calado**.
   */
  it('⛔ a âncora nunca carrega acento, barra ou parêntese', () => {
    expect(ancoraDaLinha('PIZZA GRANDE (35CM) / BORDA')).toBe('rev-pizza-grande-35cm-borda')
    expect(ancoraDaLinha('PÃO DE XIS')).toBe('rev-pao-de-xis')
    expect(ancoraDaLinha('!!!')).toBe('rev-linha')
  })
})

describe('⭐ o editor sabe de onde veio e pra onde volta', () => {
  it('COMPLEMENTOS vincula no mapa de complementos', () => {
    const h = hrefDoEditor('emp1', 'COMPLEMENTOS', '2026-09-13', 'COCA LATA MAIS MINI FRITAS')
    expect(h).toContain('complemento=COCA+LATA+MAIS+MINI+FRITAS')
    expect(h).not.toContain('mapear=')
  })

  /**
   * ⛔⛔ O PARÂMETRO ERRADO VINCULARIA NO MAPA ERRADO EM SILÊNCIO — são **dois mapas desde
   * 02/09**, porque 25 nomes vivem nos dois relatórios e um mapa só faria cada um baixar
   * duas vezes.
   */
  it('PRODUTOS vincula no mapa de produtos', () => {
    const h = hrefDoEditor('emp1', 'PRODUTOS', '2026-09-12', 'XIS COMPLETO')
    expect(h).toContain('mapear=XIS+COMPLETO')
    expect(h).not.toContain('complemento=')
  })

  it('⭐ o nome vai carregado — o dono não digita o que a tela já sabe', () => {
    expect(hrefDoEditor('emp1', 'PRODUTOS', '2026-09-12', 'XIS COMPLETO')).toContain('nome=XIS+COMPLETO')
  })

  it('⛔ o `voltar` é SEMPRE caminho interno (open redirect é de manual)', () => {
    const h = hrefDoEditor('emp1', 'COMPLEMENTOS', '2026-09-13', 'COCA LATA')
    const voltar = new URLSearchParams(h.split('?')[1]).get('voltar')
    expect(ehCaminhoInterno(voltar)).toBe(true)
  })

  /**
   * ⚠️ Sem dia escolhido (a tela de produtos antes de o dono pôr a data) a volta é a
   * própria tela de Vendas — nunca `revisar=` vazio, que abriria o painel de um dia que
   * não existe.
   */
  it('sem dia, a volta é a tela de Vendas e não um dia fantasma', () => {
    const v = urlDaRevisao('emp1', 'PRODUTOS', null)
    expect(v).toContain('aba=importar')
    expect(v).not.toContain('revisar=')
  })
})
