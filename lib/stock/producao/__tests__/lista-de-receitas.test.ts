/**
 * ⭐⭐ A RÉGUA DA LISTA DE RECEITAS — busca, chips, blocos (12/10/2026).
 *
 * **Os vermelhos que o dono pediu, todos aqui:** *"ordem não alfabética pt-BR dentro de cada
 * bloco = vermelho · chip âmbar não filtra exatamente as a-definir = vermelho · 'calab' não
 * traz CALABRESA, ou 'agua' não traz Água (a cicatriz de 08/09) = vermelho"*.
 *
 * ⚠️ Eles só são testáveis porque a decisão é LIB PURA. Na tela (sem jsdom) nenhum deles
 * poderia ser executado — e a casa já pagou isso duas vezes (o prefill do cardápio, o binding
 * do seletor de categoria).
 */
import { describe, it, expect } from 'vitest'
import { montarListaDeReceitas, ordemAlfabetica, type ReceitaDaLista } from '../lista-de-receitas'
import { trechosDaBusca } from '@/lib/busca-texto'

const r = (nome: string, extra: Partial<ReceitaDaLista> = {}): ReceitaDaLista => ({
  id: `id-${nome}`, nomeProduzido: nome, principal: false, custoADefinir: false, ...extra,
})

/** as receitas reais da Caçula que o pedido nomeia (as 4 "a definir" + acento + CALABRESA) */
const REAIS: ReceitaDaLista[] = [
  r('metade de bolinha massa de pizza', { custoADefinir: true }),
  r('porcao chuleta 200 grama', { custoADefinir: true }),
  r('beef de hamburger', { custoADefinir: true }),
  r('beef de xis', { custoADefinir: true }),
  r('porcao de calabresa 120 grama'),
  r('CALABRESA'),
  r('Água com gás'),
  r('porcao bacon 80 grama', { principal: true }),
  r('porçao queijo 135 grama', { principal: true }),
  r('Zucchini grelhado'),
]

describe('⭐ ORDEM ALFABÉTICA pt-BR — e o acento é o que separa do sort cru', () => {
  it('⛔ sem localeCompare("pt-BR"), "Água" vai pro FIM — é o contrafactual da régua', () => {
    const nomes = ['Zucchini grelhado', 'Água com gás', 'beef de xis']
    /**
     * o sort CRU (o defeito): compara code point — `Z`(0x5A) < `b`(0x62) < `Á`(0xC1), então o
     * acento vai pro FIM **e** a minúscula fica depois da maiúscula.
     * ⚠️ A ordem exata aqui me corrigiu: eu tinha escrito `Água` antes de `beef`. O que importa
     * (o acento no fim) estava certo; a minha aritmética de code point, não.
     */
    expect([...nomes].sort()).toEqual(['Zucchini grelhado', 'beef de xis', 'Água com gás'])
    // ⭐ a régua da casa põe Água no começo e não liga pra caixa
    expect(ordemAlfabetica(nomes.map((n) => r(n))).map((x) => x.nomeProduzido))
      .toEqual(['Água com gás', 'beef de xis', 'Zucchini grelhado'])
  })

  it('⭐ os DOIS blocos saem alfabéticos', () => {
    const l = montarListaDeReceitas({ receitas: REAIS })
    expect(l.modo).toBe('BLOCOS')
    for (const b of l.blocos) {
      const nomes = b.receitas.map((x) => x.nomeProduzido)
      expect(nomes, `bloco ${b.chave} fora de ordem`).toEqual([...nomes].sort((a, z) => a.localeCompare(z, 'pt-BR')))
    }
  })

  it('⭐ e o RECORTE também — a lista única não perde a ordem', () => {
    const l = montarListaDeReceitas({ receitas: REAIS, chip: 'CUSTO_A_DEFINIR' })
    const nomes = l.blocos[0].receitas.map((x) => x.nomeProduzido)
    expect(nomes).toEqual(['beef de hamburger', 'beef de xis', 'metade de bolinha massa de pizza', 'porcao chuleta 200 grama'])
  })
})

describe('⭐⭐ A BUSCA — pela porta da casa (a cicatriz de 08/09)', () => {
  it('⭐ "calab" acha CALABRESA (prefixo no meio da palavra, caixa diferente)', () => {
    const l = montarListaDeReceitas({ receitas: REAIS, busca: 'calab' })
    expect(l.blocos[0].receitas.map((x) => x.nomeProduzido).sort())
      .toEqual(['CALABRESA', 'porcao de calabresa 120 grama'])
  })

  it('⭐⭐ "agua" acha "Água com gás" — SEM acento no termo', () => {
    const l = montarListaDeReceitas({ receitas: REAIS, busca: 'agua' })
    expect(l.blocos[0].receitas.map((x) => x.nomeProduzido)).toEqual(['Água com gás'])
  })

  it('⛔ o CONTRAFACTUAL: `toLowerCase().includes()` cru NÃO acha "Água" por "agua"', () => {
    // é exatamente o que a tela NÃO pode fazer — e o guard de UI proíbe por grep
    expect('Água com gás'.toLowerCase().includes('agua')).toBe(false)
  })

  it('⭐ palavra em qualquer ordem: "queijo porçao" acha "porçao queijo 135 grama"', () => {
    const l = montarListaDeReceitas({ receitas: REAIS, busca: 'queijo porcao' })
    expect(l.blocos[0].receitas.map((x) => x.nomeProduzido)).toEqual(['porçao queijo 135 grama'])
  })

  it('⭐ 0 resultado DIZ o termo — "nenhuma receita" seco faria o dono achar que não existe', () => {
    const l = montarListaDeReceitas({ receitas: REAIS, busca: 'xxxx' })
    expect(l.vazio).toBe('nenhuma receita com “xxxx”')
    expect(l.blocos[0].receitas).toHaveLength(0)
  })

  it('⭐ busca só de espaço é o mesmo que não buscar — abre em BLOCOS', () => {
    expect(montarListaDeReceitas({ receitas: REAIS, busca: '   ' }).modo).toBe('BLOCOS')
  })
})

describe('⭐ O DESTAQUE do trecho que casou — cosmético, e conservador', () => {
  it('⭐ marca o pedaço no nome ORIGINAL, com a caixa que o dono lê', () => {
    const t = trechosDaBusca('porcao de calabresa 120 grama', 'calab')
    expect(t.filter((x) => x.casa).map((x) => x.texto)).toEqual(['calab'])
    expect(t.map((x) => x.texto).join('')).toBe('porcao de calabresa 120 grama')
  })

  it('⭐⭐ e o ACENTO não desloca o destaque — "agua" marca "Água" inteiro', () => {
    const t = trechosDaBusca('Água com gás', 'agua')
    expect(t.filter((x) => x.casa).map((x) => x.texto)).toEqual(['Água'])
    expect(t.map((x) => x.texto).join('')).toBe('Água com gás')
  })

  it('⛔ o texto NUNCA se perde no destaque — nem com termo de 2 palavras', () => {
    const nome = 'porçao queijo 135 grama'
    expect(trechosDaBusca(nome, 'queijo porcao').map((x) => x.texto).join('')).toBe(nome)
  })

  it('⭐ termo vazio não destaca nada (e devolve o nome inteiro)', () => {
    expect(trechosDaBusca('CALABRESA', '')).toEqual([{ texto: 'CALABRESA', casa: false }])
  })
})

describe('⭐⭐ OS CHIPS — contam o recorte da busca, e clicar devolve EXATAMENTE o número', () => {
  it('⭐ o chip âmbar filtra EXATAMENTE as "a definir" — as 4 reais, nem uma a mais', () => {
    const l = montarListaDeReceitas({ receitas: REAIS, chip: 'CUSTO_A_DEFINIR' })
    expect(l.contadores.custoADefinir).toBe(4)
    expect(l.blocos[0].receitas).toHaveLength(4)
    expect(l.blocos[0].receitas.every((x) => x.custoADefinir)).toBe(true)
  })

  it('⭐ o chip da estrela filtra EXATAMENTE as principais', () => {
    const l = montarListaDeReceitas({ receitas: REAIS, chip: 'PRINCIPAIS' })
    expect(l.blocos[0].receitas.map((x) => x.nomeProduzido))
      .toEqual(['porcao bacon 80 grama', 'porçao queijo 135 grama'])
  })

  it('⭐⭐ CHIP + BUSCA COMBINAM, e o contador do chip == o que a lista mostra ao clicar', () => {
    const comBusca = montarListaDeReceitas({ receitas: REAIS, busca: 'beef' })
    expect(comBusca.contadores).toEqual({ todas: 2, principais: 0, custoADefinir: 2 })

    // clicou no chip âmbar COM a busca ativa → tem que vir o número que o chip prometeu
    const clicou = montarListaDeReceitas({ receitas: REAIS, busca: 'beef', chip: 'CUSTO_A_DEFINIR' })
    expect(clicou.blocos[0].receitas).toHaveLength(comBusca.contadores.custoADefinir)
    expect(clicou.modo).toBe('RECORTE')
  })

  it('⛔ contador do UNIVERSO (o defeito) mentiria: "principais · 2" com 0 na tela', () => {
    // com a busca em "beef" nenhuma das 2 principais casa — se o chip contasse o universo,
    // ele diria 2 e o clique devolveria 0. É a divergência badge × tela.
    const l = montarListaDeReceitas({ receitas: REAIS, busca: 'beef' })
    expect(l.contadores.principais).toBe(0)
    expect(REAIS.filter((x) => x.principal)).toHaveLength(2) // o universo TEM 2
  })

  it('⭐ chip com 0 resultado DIZ o recorte (nunca lista vazia muda)', () => {
    const l = montarListaDeReceitas({ receitas: [r('só uma')], chip: 'PRINCIPAIS' })
    expect(l.vazio).toBe('nenhuma receita marcada como principal ainda')
  })
})

describe('⭐⭐ OS 2 BLOCOS — e o convite no lugar do bloco vazio', () => {
  /**
   * ⚠️⚠️ **INVERTIDO EM 12/10 COM O MOTIVO ESCRITO, não apagado.** A versão de hoje de manhã
   * afirmava *"«Todas as receitas» contém TODAS, inclusive as principais"* — e eu tinha
   * registrado as duas saídas como defensáveis. **O dono usou e decidiu a outra:** *"na hora de
   * clica em estrella receita sai de tudo as receitas e ir para PRINCIPAIS e nao fica no as 2"*.
   *
   * ⭐ E a metade que eu defendia (*o rótulo não pode prometer mais do que entrega*) **continua
   * valendo — ela é que obriga a renomear**: com as marcadas fora, *"Todas as receitas"* viraria
   * mentira. O bloco de baixo passa a se chamar **"outras receitas"**.
   */
  it('⭐⭐ BLOCOS EXCLUSIVOS: a estrelada sai de baixo, e o rótulo de baixo diz a verdade', () => {
    const l = montarListaDeReceitas({ receitas: REAIS })
    const [principais, outras] = l.blocos
    expect(principais.titulo).toBe('Principais')
    expect(principais.receitas).toHaveLength(2)
    expect(outras.titulo, 'com o bloco exclusivo, "Todas as receitas" seria mentira').toBe('outras receitas')
    expect(outras.receitas).toHaveLength(REAIS.length - 2)
  })

  it('⛔⛔ NENHUMA receita aparece nos DOIS blocos (o pedido de 12/10)', () => {
    const l = montarListaDeReceitas({ receitas: REAIS })
    const [principais, outras] = l.blocos
    const emCima = new Set(principais.receitas.map((x) => x.id))
    const repetida = outras.receitas.filter((x) => emCima.has(x.id)).map((x) => x.nomeProduzido)
    expect(repetida, 'a estrelada ficou nos dois blocos').toEqual([])
    expect(outras.receitas.every((x) => !x.principal)).toBe(true)
    expect(principais.receitas.every((x) => x.principal)).toBe(true)
  })

  it('⭐⭐ principais + outras == o total da casa (nada some no meio da divisão)', () => {
    for (const quantas of [0, 1, 2, REAIS.length]) {
      const receitas = REAIS.map((x, i) => ({ ...x, principal: i < quantas }))
      const l = montarListaDeReceitas({ receitas })
      const [p, o] = l.blocos
      expect(p.receitas.length + o.receitas.length, `com ${quantas} estreladas a soma furou`).toBe(REAIS.length)
    }
  })

  it('⭐ TODAS estreladas → o bloco de baixo fica vazio, e DIZ (nunca um branco mudo)', () => {
    const l = montarListaDeReceitas({ receitas: REAIS.map((x) => ({ ...x, principal: true })) })
    const [p, o] = l.blocos
    expect(p.receitas).toHaveLength(REAIS.length)
    expect(o.receitas).toHaveLength(0)
    expect(o.convite).toBe('todas as receitas estão fixadas aqui em cima')
  })

  it('⭐⭐ ZERO principais → CONVITE, nunca um bloco em branco (que se lê como defeito)', () => {
    const l = montarListaDeReceitas({ receitas: REAIS.map((x) => ({ ...x, principal: false })) })
    expect(l.blocos[0].receitas).toHaveLength(0)
    expect(l.blocos[0].convite).toBe('toque na estrela pra fixar as mais importantes aqui em cima')
    expect(l.contadores.principais).toBe(0)
    expect(l.vazio, 'a lista NÃO está vazia — só o bloco das principais').toBeNull()
  })

  it('⭐ a ESTRELA move a receita de bloco — e o chip conta +1 (o vai e vem do dono)', () => {
    const antes = montarListaDeReceitas({ receitas: REAIS })
    expect(antes.contadores.principais).toBe(2)

    // ⭐ a CALABRESA começa no bloco de baixo
    expect(antes.blocos[1].receitas.map((x) => x.nomeProduzido)).toContain('CALABRESA')

    const marcada = REAIS.map((x) => (x.nomeProduzido === 'CALABRESA' ? { ...x, principal: true } : x))
    const depois = montarListaDeReceitas({ receitas: marcada })
    expect(depois.contadores.principais).toBe(3)
    // ⭐⭐ ela SAI de baixo e vai pra cima — nunca nos dois (o pedido de 12/10)
    expect(depois.blocos[0].receitas.map((x) => x.nomeProduzido)).toContain('CALABRESA')
    expect(depois.blocos[1].receitas.map((x) => x.nomeProduzido)).not.toContain('CALABRESA')

    // e DESMARCAR a devolve pro bloco de baixo
    const voltou = montarListaDeReceitas({ receitas: REAIS })
    expect(voltou.blocos[0].receitas.map((x) => x.nomeProduzido)).not.toContain('CALABRESA')
    expect(voltou.blocos[1].receitas.map((x) => x.nomeProduzido), 'desmarcou e ela não voltou pro bloco de baixo')
      .toContain('CALABRESA')
  })

  it('⛔ com recorte ativo NÃO existem blocos — 3 resultados partidos em dois esconderiam o resultado', () => {
    expect(montarListaDeReceitas({ receitas: REAIS, busca: 'calab' }).blocos).toHaveLength(1)
    expect(montarListaDeReceitas({ receitas: REAIS, chip: 'PRINCIPAIS' }).blocos).toHaveLength(1)
    expect(montarListaDeReceitas({ receitas: REAIS, chip: 'PRINCIPAIS' }).blocos[0].titulo).toBeNull()
  })

  it('⭐ lista vazia não explode e não inventa vazio de busca', () => {
    const l = montarListaDeReceitas({ receitas: [] })
    expect(l.modo).toBe('BLOCOS')
    expect(l.contadores).toEqual({ todas: 0, principais: 0, custoADefinir: 0 })
    expect(l.vazio).toBeNull()
  })
})
