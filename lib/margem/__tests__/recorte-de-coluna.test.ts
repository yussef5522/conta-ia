/**
 * ⭐⭐⭐ A LEI DAS COLUNAS — os vermelhos que o dono ditou (13/10/2026).
 *
 * *"liga sem cap (lista inteira aberta por default) = vermelho · «ver todos» que não
 * expande/recolhe = vermelho · coluna fantasma (diferença de altura > ~um cartão quando
 * recolhido) = vermelho."*
 */
import { describe, it, expect } from 'vitest'
import {
  colunasTerminamJuntas,
  DIFERENCA_MAXIMA_EM_LINHAS,
  recorteDaColuna,
  TOPO_DA_COLUNA,
} from '../recorte-de-coluna'
import { CARREGADORES_VISIVEIS } from '../placar'

const lista = (n: number) => Array.from({ length: n }, (_, i) => `linha ${i + 1}`)

describe('⭐ O TETO — TOP 10, nunca a lista de 50 rolando sozinha', () => {
  it('⛔ VERMELHO DO DONO: recolhido mostra 10, não a lista inteira', () => {
    const r = recorteDaColuna(lista(51), false)
    expect(r.visiveis).toHaveLength(TOPO_DA_COLUNA)
    expect(r.escondidas).toBe(41)
  })

  it('⛔ VERMELHO DO DONO: o estado inicial é SEMPRE recolhido', () => {
    // a referência escreve isso: "Estado inicial: SEMPRE recolhido"
    const r = recorteDaColuna(lista(51), false)
    expect(r.expandido).toBe(false)
    expect(r.visiveis.length, 'nascer aberto É a lista de 50 rolando na coluna').toBeLessThan(51)
  })

  it('⛔ VERMELHO DO DONO: "ver todos" EXPANDE — e o segundo toque RECOLHE', () => {
    const fechado = recorteDaColuna(lista(51), false)
    expect(fechado.rotuloDoBotao).toBe('ver todos os 51 ▾')

    const aberto = recorteDaColuna(lista(51), true)
    expect(aberto.visiveis).toHaveLength(51)
    expect(aberto.rotuloDoBotao, 'o 2º toque tem que RECOLHER').toBe('mostrar só o top 10 ▴')
  })

  it('o teto é de EXIBIÇÃO: expandir não perde nem reordena linha', () => {
    const todas = lista(51)
    const aberto = recorteDaColuna(todas, true)
    expect(aberto.visiveis).toEqual(todas)
  })

  it('lista que CABE no teto não ganha botão — botão que não faz nada é ruído', () => {
    const r = recorteDaColuna(lista(7), false)
    expect(r.visiveis).toHaveLength(7)
    expect(r.escondidas).toBe(0)
    expect(r.rotuloDoBotao).toBeNull()
  })

  it('exatamente 10 não ganha botão (o teto é inclusivo)', () => {
    expect(recorteDaColuna(lista(10), false).rotuloDoBotao).toBeNull()
    expect(recorteDaColuna(lista(11), false).rotuloDoBotao).toBe('ver todos os 11 ▾')
  })

  it('lista vazia não explode nem oferece botão', () => {
    const r = recorteDaColuna(lista(0), false)
    expect(r.visiveis).toEqual([])
    expect(r.rotuloDoBotao).toBeNull()
  })
})

describe('⭐⭐ COLUNA FANTASMA — a lei virada teste', () => {
  it('⛔ VERMELHO DO DONO: diferença acima do teto da lei é tela REPROVADA', () => {
    const v = colunasTerminamJuntas(7, 13)
    expect(v.passa).toBe(false)
    expect(v.diferenca).toBe(6)
    expect(v.porque).toContain('COLUNA FANTASMA')
  })

  it('a tolerância é a da referência (~140px ÷ ~38px por linha = 3 linhas)', () => {
    expect(DIFERENCA_MAXIMA_EM_LINHAS).toBe(3)
    expect(colunasTerminamJuntas(10, 13).passa).toBe(true)
    expect(colunasTerminamJuntas(10, 14).passa).toBe(false)
  })

  it('a ordem dos lados não muda o veredito', () => {
    expect(colunasTerminamJuntas(13, 7)).toEqual(colunasTerminamJuntas(7, 13))
  })

  it('⭐⭐ A DUPLA 3+4 REAL (quem carregou | a liga) TERMINA JUNTA no recolhido', () => {
    // ⚠️ as duas colunas usam o MESMO `padding:9px 18px` e `font-size:13.5px` no CSS da
    // referência — então contar LINHA é medir ALTURA (ver o comentário da lib).
    const carregou =
      TOPO_DA_COLUNA + // as linhas de produto
      1 + //             a linha agregada ("+ N produtos · ver todos")
      1 //               o rodapé âmbar da fila de fichas
    const liga =
      1 + //             as abas (caixa / margem / vendidos)
      TOPO_DA_COLUNA + // as linhas do ranking
      1 //               o "ver todos os N ▾"

    const v = colunasTerminamJuntas(carregou, liga)
    expect(v.passa, v.porque).toBe(true)
    expect(v.diferenca, 'o desenho fecha em ZERO — não por sorte, por teto único').toBe(0)
  })

  it('⛔ E O TETO TEM UM DONO SÓ — dois tetos separados são a coluna fantasma de volta', () => {
    // é isso que torna a lei IMPOSSÍVEL de quebrar em vez de PROMETIDA: alguém mexer no teto
    // de um cartão mexe nos dois, e a dupla continua fechando.
    expect(CARREGADORES_VISIVEIS).toBe(TOPO_DA_COLUNA)
  })

  it('o contrafactual: com os 6 que a v4 DESENHA, a dupla reprova', () => {
    // a v4 declara TOP 10 e desenha 6 linhas em "quem carregou" — 4 linhas de diferença são
    // ~152px, fora dos ~140 que ela própria escreveu. É o conflito que o teto único resolve.
    const carregouAntigo = 6 + 1 + 1
    const liga = 1 + TOPO_DA_COLUNA + 1
    expect(colunasTerminamJuntas(carregouAntigo, liga).passa).toBe(false)
  })
})
