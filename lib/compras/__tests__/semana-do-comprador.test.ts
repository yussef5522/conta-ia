/**
 * ⭐⭐⭐ A SEMANA DO COMPRADOR + O ESTADO DA MESA (leis C7/C8 da v3.2, 18/10/2026).
 *
 * ⭐ A amostra é a do ARQUIVO (`docs/consumo-e-compras-referencia.html`, `HOJE=4` = sexta), com
 * os `pedirEm` que o `<script>` da referência produz: FRANGO 2 · ACÉM 1 · QUEIJO 0. Travar
 * contra a amostra da LEI é o que impede a esteira de divergir do arquivo que o dono aprovou.
 */
import { describe, it, expect } from 'vitest'
import {
  montarSemanaDoComprador,
  estadoDaMesa,
  proximoDiaDePedido,
  DIAS,
  type PedidoDaSemana,
} from '../consumo-e-compras'

/** SEG-first: 0=SEG … 4=SEX · 5=SÁB · 6=DOM */
const SEX = 4
const SAB = 5
const DOM = 6
const SEG = 0

const ped = (p: Partial<PedidoDaSemana> & { nome: string; pedirEm: number }): PedidoDaSemana => ({
  itemId: `i-${p.nome}`,
  unidade: 'KG',
  quantidade: 10,
  chegaDia: SEG,
  ...p,
})

/** a amostra da referência */
const AMOSTRA = [
  ped({ nome: 'FRANGO', pedirEm: 2, chegaDia: SEG }),
  ped({ nome: 'ACÉM', pedirEm: 1, chegaDia: SEG }),
  ped({ nome: 'QUEIJO', pedirEm: 0, chegaDia: SEG }),
]

describe('⭐⭐⭐ A ESTEIRA — a amostra da referência cai nos slots do arquivo', () => {
  const semana = montarSemanaDoComprador(AMOSTRA, SEX)

  it('⭐ são SEMPRE 7 slots, começando em hoje', () => {
    expect(semana).toHaveLength(7)
    expect(semana.map((s) => s.diaDaSemana)).toEqual([SEX, SAB, DOM, SEG, 1, 2, 3])
    expect(semana[0].ehHoje).toBe(true)
    expect(semana.filter((s) => s.ehHoje)).toHaveLength(1)
  })

  it('⭐⭐ QUEIJO pedirEm=0 → slot de HOJE, e o slot fica CORAL', () => {
    expect(semana[0].pedidos.map((p) => p.nome)).toEqual(['QUEIJO'])
    expect(semana[0].urgente).toBe(true)
  })

  it('⭐ ACÉM pedirEm=1 → slot de SÁB (amanhã), e ele NÃO é urgente', () => {
    expect(semana[1].pedidos.map((p) => p.nome)).toEqual(['ACÉM'])
    expect(semana[1].diaDaSemana).toBe(SAB)
    expect(semana[1].urgente).toBe(false)
  })

  it('⭐ FRANGO pedirEm=2 → slot de DOM', () => {
    expect(semana[2].pedidos.map((p) => p.nome)).toEqual(['FRANGO'])
    expect(semana[2].diaDaSemana).toBe(DOM)
  })

  it('⛔ dia sem pedido fica VAZIO — a tela desenha o traço, nunca um zero', () => {
    for (const k of [3, 4, 5, 6]) expect(semana[k].pedidos).toEqual([])
  })

  it('⭐⭐ o RÓTULO é da LIB: "HOJE · sex" · "amanhã · sáb" · "DOM"', () => {
    expect(semana[0].rotulo).toBe('HOJE · sex')
    expect(semana[1].rotulo).toBe('amanhã · sáb')
    expect(semana[2].rotulo).toBe('DOM')
    // ⛔ do 3º dia em diante é só o nome do dia — "em 3 dias" seria a frase corrida que a lei proíbe
    expect(semana[3].rotulo).toBe(DIAS[SEG])
  })

  it('⛔⛔ nenhum rótulo é FRASE CORRIDA (lei C7: a esteira se lê em 2 segundos)', () => {
    for (const s of semana) {
      expect(s.rotulo.length).toBeLessThanOrEqual(12)
      expect(s.rotulo).not.toMatch(/pedir|chega|prazo|fornecedor/i)
    }
  })

  it('⭐ a soma dos slots == os pedidos: nenhum se perde, nenhum conta 2×', () => {
    const nos = semana.flatMap((s) => s.pedidos.map((p) => p.nome)).sort()
    expect(nos).toEqual(['ACÉM', 'FRANGO', 'QUEIJO'])
  })
})

describe('⛔⛔ O ATRASADO ENTRA NO SLOT DE HOJE — nunca num slot que não existe', () => {
  it('⭐ pedirEm NEGATIVO cai em HOJE (clamp em 0) e acende o coral', () => {
    const s = montarSemanaDoComprador([ped({ nome: 'ATRASADO', pedirEm: -3 })], SEX)
    expect(s[0].pedidos.map((p) => p.nome)).toEqual(['ATRASADO'])
    expect(s[0].urgente).toBe(true)
    // ⭐ e o `pedirEm` CRU sobrevive — é ele que a tela usa pra dizer que está atrasado
    expect(s[0].pedidos[0].pedirEm).toBe(-3)
  })

  it('⭐ atrasado e pedido-de-hoje convivem no MESMO slot', () => {
    const s = montarSemanaDoComprador(
      [ped({ nome: 'ATRASADO', pedirEm: -1 }), ped({ nome: 'HOJE', pedirEm: 0 })],
      SEX,
    )
    expect(s[0].pedidos.map((p) => p.nome).sort()).toEqual(['ATRASADO', 'HOJE'])
  })

  it('⛔ pedido pra DEPOIS de 7 dias não aparece — a esteira é de 7 slots, e ela não mente o tamanho', () => {
    const s = montarSemanaDoComprador([ped({ nome: 'LONGE', pedirEm: 9 })], SEX)
    expect(s.flatMap((x) => x.pedidos)).toEqual([])
  })
})

describe('⛔ QUANTIDADE ZERO NÃO É PEDIDO', () => {
  it('⛔ item com PEDIR 0 fica fora da esteira — e o slot de hoje NÃO acende por ele', () => {
    const s = montarSemanaDoComprador([ped({ nome: 'ABASTECIDO', pedirEm: 0, quantidade: 0 })], SEX)
    expect(s[0].pedidos).toEqual([])
    expect(s[0].urgente).toBe(false)
  })
})

describe('⭐⭐ OS TRÊS ESTADOS DA MESA — a mensagem nunca mente', () => {
  it('⛔ nenhum item configurado → SEM_CONFIG (a mensagem que manda configurar)', () => {
    expect(estadoDaMesa({ cards: 0, itensComConfig: 0 })).toBe('SEM_CONFIG')
  })

  it('⭐⭐ o CASO REAL (18/10): configurado, 591 KG em estoque, PEDIR 0 → NADA_A_PEDIR', () => {
    // ⛔ com a régua antiga a mesa dizia "nenhum item com dias de chegada configurados" — e o
    //    queijo ESTAVA configurado. A mensagem mandava consertar o que já estava certo.
    expect(estadoDaMesa({ cards: 0, itensComConfig: 1 })).toBe('NADA_A_PEDIR')
  })

  it('⭐ tem card → TEM_PEDIDO', () => {
    expect(estadoDaMesa({ cards: 2, itensComConfig: 5 })).toBe('TEM_PEDIDO')
  })
})

describe('⭐ O PRÓXIMO DIA DE PEDIDO — o NADA_A_PEDIR não termina sem saída', () => {
  it('⭐ chegada na SEG com 3 dias de antecedência, hoje SEX → pedir HOJE (clamp)', () => {
    // SEX→SEG são 3 dias; 3 − 3 = 0
    expect(proximoDiaDePedido([{ diasChegada: [SEG], antecedenciaDias: 3 }], SEX)).toEqual({
      diaDaSemana: SEX,
      emDias: 0,
    })
  })

  it('⭐ chegada na SEG com 1 dia, hoje SEX → pedir DOM', () => {
    expect(proximoDiaDePedido([{ diasChegada: [SEG], antecedenciaDias: 1 }], SEX)).toEqual({
      diaDaSemana: DOM,
      emDias: 2,
    })
  })

  it('⭐ com vários itens, vale o MAIS PRÓXIMO (é quando o comprador tem que voltar)', () => {
    const r = proximoDiaDePedido(
      [
        { diasChegada: [SEG], antecedenciaDias: 1 }, // em 2
        { diasChegada: [SAB], antecedenciaDias: 1 }, // em 0
      ],
      SEX,
    )
    expect(r).toEqual({ diaDaSemana: SEX, emDias: 0 })
  })

  it('⛔ item SEM dia de chegada não vira palpite — devolve null', () => {
    expect(proximoDiaDePedido([{ diasChegada: [], antecedenciaDias: 2 }], SEX)).toBeNull()
    expect(proximoDiaDePedido([], SEX)).toBeNull()
  })
})
