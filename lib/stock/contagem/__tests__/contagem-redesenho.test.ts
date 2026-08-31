// ⭐⭐ O REDESENHO DA CONTAGEM — as peças puras (31/08/2026).
//
// A tela antiga estava atrás das líderes em MÉTODO, não só em visual: mostrava a coluna
// SISTEMA durante a contagem (viés de confirmação — quem vê "571" escreve "571"), campo
// com setinha, unidade do outro lado da tela, e "branco" ambíguo entre "não contei" e
// "contei e deu zero".

import { describe, it, expect } from 'vitest'
import { partirNome } from '../nome-produto'
import { unidadeSuspeita, ehUnidadeContavel, avisoUnidadeSuspeita } from '../unidade-suspeita'
import { ordenarFila, moverNaFila, type ItemDaFila } from '../ordem-fila'
import { avisoSessaoVelha, HORAS_SESSAO_VELHA } from '../../contagem'

describe('⭐ o nome quebrado em duas linhas (o que é / qual é)', () => {
  it('⭐⭐ o caso que o dono citou', () => {
    expect(partirNome('CAIXA P/ PIZZA OITAVADA 35X35X4.0 CM - CACULA MIX')).toEqual({
      titulo: 'CAIXA P/ PIZZA OITAVADA',
      especificacao: '35X35X4.0 CM - CACULA MIX',
    })
  })

  it('⭐ nomes reais da Caçula que separam bem', () => {
    expect(partirNome('CERV SKOL 600ML').titulo).toBe('CERV SKOL')
    expect(partirNome('QUEIJO MUSSARELA EM PECA 02 KG').especificacao).toBe('02 KG')
    expect(partirNome('PREP. ALIM. SABOR CHEDDAR 2,27 KG CX/08 PC').titulo).toBe('PREP. ALIM. SABOR CHEDDAR')
    expect(partirNome('CREME LEITE ITALAC TP UND 200GR').especificacao).toBe('200GR')
  })

  it('⛔⛔ TÍTULO NÃO PODE SER CÓDIGO — pego rodando contra os 91 nomes reais', () => {
    // ⚠️ estes dois saíam INVERTIDOS, com o código na linha grande e o produto na pequena:
    //   "0000903482" | "CERV HEINEKEN…"     "F635" | "30,5X30Embalagem…"
    // Quem está no estoque leria "F635" em corpo 24 e caçaria o produto embaixo.
    const f = partirNome('F635 30,5X30Embalagem para Pizza Congelados- 30,0 x 30,0 x3,5 cm -Cacula Calabresa')
    expect(f.especificacao, 'título virou código — pior que não separar').toBe('')
    expect(f.titulo).toContain('Embalagem')

    const h = partirNome('0000903482 - CERV HEINEKEN PIL 0.60GFA RT 24UN')
    expect(h.titulo).toContain('HEINEKEN') // o nome do produto ficou na linha grande
  })

  it('⭐⭐ HEURÍSTICA SUGERE, NUNCA INVENTA: sem medida, nome INTEIRO numa linha', () => {
    for (const n of ['ALFACE CRESPA', 'Acém', 'BROCOLIS', 'CHULETA BOVINA', 'BATATA INGLESA']) {
      expect(partirNome(n)).toEqual({ titulo: n, especificacao: '' })
    }
  })

  it('⚠️ medida no COMEÇO não separa (o título ficaria sem sentido)', () => {
    expect(partirNome('500ML COPO DESCARTAVEL').especificacao).toBe('')
  })

  it('⚠️ o traço só separa quando o que vem depois é MEDIDA', () => {
    // "COXAO MOLE S/CAPA - BOVINO" não é nome + especificação: são duas partes do nome
    expect(partirNome('COXAO MOLE S/CAPA - BOVINO').especificacao).toBe('')
  })

  it('⚠️ nome vazio não quebra nada', () => {
    expect(partirNome('')).toEqual({ titulo: '', especificacao: '' })
  })
})

describe('⚠️ unidade suspeita — o caso REAL da BOBINA', () => {
  it('⛔ 1,86 UN é fração numa unidade que se conta inteira', () => {
    // a nota cobrou 0,93 Pc + 0,926 Pc (o fornecedor fatura por PESO) e o Pc entrou 1:1
    // como UN. Ela vai contar 2 rolos → divergência falsa de 0,14.
    expect(unidadeSuspeita('UN', 1.86)).toBe(true)
    expect(avisoUnidadeSuspeita('UN', 1.86)).toContain('CADASTRO')
  })

  it('⭐ os outros 57 contáveis da Caçula estão inteiros — não podem ser marcados', () => {
    for (const q of [0, 1, 2, 25, 571, 6313]) expect(unidadeSuspeita('UN', q)).toBe(false)
  })

  it('⚠️ KG e LT fracionam por natureza — nunca são suspeitos', () => {
    expect(unidadeSuspeita('KG', 4.235)).toBe(false)
    expect(unidadeSuspeita('LT', 0.5)).toBe(false)
    expect(ehUnidadeContavel('KG')).toBe(false)
    expect(ehUnidadeContavel('UN')).toBe(true)
    expect(ehUnidadeContavel('CX')).toBe(true)
  })

  it('⚠️ saldo ZERO não é suspeito (item novo é normal)', () => {
    expect(unidadeSuspeita('UN', 0)).toBe(false)
    expect(avisoUnidadeSuspeita('UN', 0)).toBeNull()
  })
})

describe('⭐ o caminho físico do estoque', () => {
  const itens: ItemDaFila[] = [
    { itemId: 'a', nome: 'Acém', categoria: 'CARNES' },
    { itemId: 'b', nome: 'BOBINA', categoria: 'EMBALAGEM' },
    { itemId: 'c', nome: 'COXÃO', categoria: 'CARNES' },
    { itemId: 'd', nome: 'DETERGENTE', categoria: 'LIMPEZA' },
  ]

  it('⭐ sem caminho gravado, cai no comportamento de hoje (categoria, depois nome)', () => {
    expect(ordenarFila(itens, new Map()).map((i) => i.itemId)).toEqual(['a', 'c', 'b', 'd'])
  })

  it('⭐⭐ com caminho, manda o caminho — é a ordem em que se ANDA', () => {
    const caminho = new Map([['d', 0], ['b', 1]])
    expect(ordenarFila(itens, caminho).map((i) => i.itemId)).toEqual(['d', 'b', 'a', 'c'])
  })

  it('⚠️ item NOVO vai pro FIM, nunca pro meio (não empurra o caminho que já existe)', () => {
    const caminho = new Map([['a', 0], ['b', 1], ['c', 2]])
    expect(ordenarFila(itens, caminho).map((i) => i.itemId).at(-1)).toBe('d')
  })

  it('⭐ arrastar renumera TUDO — buraco e empate fariam a fila trocar de ordem sozinha', () => {
    const novo = moverNaFila(itens, 3, 0) // detergente pro começo
    expect([...novo.entries()].sort((x, y) => x[1] - y[1]).map((e) => e[0])).toEqual(['d', 'a', 'b', 'c'])
    // todas as posições contíguas, sem empate
    const pos = [...novo.values()].sort((x, y) => x - y)
    expect(pos).toEqual([0, 1, 2, 3])
  })

  it('⚠️ mover pra fora da lista não quebra (devolve o caminho como está)', () => {
    expect([...moverNaFila(itens, 0, 99).entries()].length).toBe(4)
    expect([...moverNaFila(itens, -1, 2).entries()].length).toBe(4)
  })
})

describe('⚠️ sessão velha — AVISA, nunca fecha sozinha', () => {
  const agora = new Date('2026-08-31T10:00:00')

  it('⭐ menos de 24h: silêncio (alarme cedo demais vira ruído)', () => {
    expect(avisoSessaoVelha(new Date('2026-08-31T00:00:00'), agora)).toBeNull()
    expect(HORAS_SESSAO_VELHA).toBe(24)
  })

  it('⭐⭐ o caso real: 7 dias aberta, e ninguém foi avisado', () => {
    const aviso = avisoSessaoVelha(new Date('2026-08-24T10:00:00'), agora)!
    expect(aviso).toContain('7 dias')
    expect(aviso).toContain('pode não valer mais')
  })

  it('⚠️ o aviso não manda FECHAR — manda RECONTAR o que ficou velho', () => {
    const aviso = avisoSessaoVelha(new Date('2026-08-25T10:00:00'), agora)!
    expect(aviso).toContain('recontar')
    expect(aviso).not.toMatch(/fech|cancel|encerr/i)
  })
})
