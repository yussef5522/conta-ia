/**
 * ⭐⭐ OS 2 JUÍZES DE COMPRA DO RADAR ① (lei C14, 16/10/2026) — PUROS.
 *
 * **A régua que este arquivo trava:** o radar é **TRADUTOR**. Ele recebe o que
 * `lerConsumoECompras` já decidiu (a agenda e o farol de cada linha) e **só conta** — nenhuma
 * pergunta de compra é respondida aqui.
 *
 * ⛔ Se ele perguntasse *"este item precisa de pedido?"* por conta própria, o alarme e a mesa
 * divergiriam no primeiro ajuste de folga, e o dono veria um item CORAL no radar que a tela
 * mostra em ordem — a doença dos 7 detectores de par, na pior roupa possível (o alarme).
 */
import { describe, it, expect } from 'vitest'
import { montarRadar, placarDoRadar, fatosDeCompra, type FatosDoRadar } from '../radar-da-mesa'

/** o resto dos fatos em ordem — o teste fala só das 2 linhas novas */
const EM_ORDEM: Omit<FatosDoRadar, 'compras'> = {
  empresaId: 'e1',
  venceHoje: { quantas: 0, total: 0 },
  itensNegativos: 0,
  aguardandoConferencia: 0,
  cardapio: { semFicha: 0, cobertura: 1 },
  importacao: { diasQuePedemAcao: 0, diaMaisAntigo: null },
}

const linha = (f: FatosDoRadar['compras'], id: string) =>
  montarRadar({ ...EM_ORDEM, compras: f }).find((l) => l.id === id)!

describe('⭐ fatosDeCompra SÓ CONTA — ele não decide nada', () => {
  it('⭐⭐ `pedirEm <= 0` é o atrasado, não `=== 0` (a mesma régua do `diaPedir`)', () => {
    const f = fatosDeCompra({
      agenda: [
        { nome: 'QUEIJO', pedirEm: -2, pedir: 14.6 }, // já devia ter saído
        { nome: 'FRANGO', pedirEm: 0, pedir: 6.6 }, //   sai hoje
        { nome: 'ACÉM', pedirEm: 1, pedir: 26.6 }, //    sai amanhã → NÃO conta
      ],
      caros: [],
    })
    expect(f.pedidoDeHojeNaoFeito.quantos).toBe(2)
    expect(f.pedidoDeHojeNaoFeito.primeiro).toBe('QUEIJO')
  })

  it('⛔⛔ ANTI-SPAM: item com `pedir: 0` NÃO acende, mesmo atrasado', () => {
    // ⚠️ sem isso, item configurado que não precisa de nada hoje gritaria todo dia — e é assim
    //    que o dono aprende a ignorar o radar (os 111 alarmes falsos de 26/08).
    const f = fatosDeCompra({ agenda: [{ nome: 'FRANGO', pedirEm: -1, pedir: 0 }], caros: [] })
    expect(f.pedidoDeHojeNaoFeito.quantos).toBe(0)
    expect(f.pedidoDeHojeNaoFeito.primeiro).toBeNull()
  })

  it('⭐ a cobertura CORAL vem do farol da leitura, nunca de um limiar daqui', () => {
    const f = fatosDeCompra({
      agenda: [],
      caros: [
        { nome: 'FRANGO', farol: 'CORAL' },
        { nome: 'ACÉM', farol: 'AMBAR' },
        { nome: 'QUEIJO', farol: 'VERDE' },
        { nome: 'SAL', farol: 'A_APURAR' },
      ],
    })
    expect(f.coberturaCoral.quantos).toBe(1)
    expect(f.coberturaCoral.primeiro).toBe('FRANGO')
  })

  it('⛔ `A_APURAR` não é coral — item sem média medida não vira alarme', () => {
    const f = fatosDeCompra({ agenda: [], caros: [{ nome: 'SAL', farol: 'A_APURAR' }] })
    expect(f.coberturaCoral.quantos).toBe(0)
  })
})

describe('⭐⭐ AS LINHAS DO RADAR — e a gravidade de cada uma tem motivo', () => {
  it('⭐⭐ pedido de hoje não feito é CORAL: o dia do pedido não volta', () => {
    const l = linha(
      {
        pedidoDeHojeNaoFeito: { quantos: 2, primeiro: 'QUEIJO' },
        coberturaCoral: { quantos: 0, primeiro: null },
      },
      'pedido-de-hoje',
    )
    expect(l.gravidade).toBe('CORAL')
    expect(l.valor).toBe('2')
    expect(l.detalhe).toContain('QUEIJO')
    expect(l.detalhe).toContain('não volta')
    // ⭐ número morto é proibido: a linha leva pra tela do assunto
    expect(l.href).toBe('/empresas/e1/estoque/consumo-e-compras')
  })

  it('⭐⭐ cobertura coral é ÂMBAR, não coral — UMA CAUSA, UM ALARME', () => {
    /**
     * ⚠️ As duas linhas acendem no MESMO item quando o pedido atrasa (o item acaba justamente
     * porque ninguém pediu). Dois corais pro mesmo fato é o que faz o dono parar de ler o
     * radar — a régua do N1 que não empilha sobre o N3 (25/08).
     */
    const l = linha(
      {
        pedidoDeHojeNaoFeito: { quantos: 1, primeiro: 'FRANGO' },
        coberturaCoral: { quantos: 1, primeiro: 'FRANGO' },
      },
      'cobertura-coral',
    )
    expect(l.gravidade).toBe('AMBAR')
    expect(l.detalhe).toContain('não alcança a próxima chegada')
  })

  it('⭐ tudo em ordem → VERDE nas duas, sem detalhe (nada pede a mão)', () => {
    const f: FatosDoRadar['compras'] = {
      pedidoDeHojeNaoFeito: { quantos: 0, primeiro: null },
      coberturaCoral: { quantos: 0, primeiro: null },
    }
    expect(linha(f, 'pedido-de-hoje')).toMatchObject({ gravidade: 'VERDE', valor: 'nenhum', detalhe: null })
    expect(linha(f, 'cobertura-coral')).toMatchObject({ gravidade: 'VERDE', valor: 'nenhum', detalhe: null })
  })

  it('⛔⛔ `compras: null` → "A APURAR", NUNCA "nenhum"', () => {
    /**
     * ⚠️ Esta é a régua de honestidade da casa: *ausência de medição não é ausência de fato*.
     * Dizer "nenhum" porque a porta falhou (ou porque as listas nem foram montadas) seria o
     * radar afirmando que não há pedido atrasado sobre dado que ele não tem — a família do
     * *"erro disfarçado de vazio"* (20/09).
     */
    for (const id of ['pedido-de-hoje', 'cobertura-coral']) {
      const l = linha(null, id)
      expect(l.valor, id).toBe('a apurar')
      expect(l.gravidade, id).toBe('AMBAR')
      expect(l.detalhe, id).toContain('ainda não foram montadas')
    }
  })
})

describe('⭐ O PLACAR CONTINUA DERIVADO DAS LINHAS', () => {
  it('⭐ as 2 linhas novas entram no placar sem ninguém recontar os fatos', () => {
    const linhas = montarRadar({
      ...EM_ORDEM,
      compras: {
        pedidoDeHojeNaoFeito: { quantos: 1, primeiro: 'FRANGO' },
        coberturaCoral: { quantos: 1, primeiro: 'FRANGO' },
      },
    })
    expect(linhas).toHaveLength(7) // 5 de antes + as 2 de compra
    const p = placarDoRadar(linhas)
    // ⛔ a soma fecha com o total de linhas — contador e lista não têm como divergir (10/09)
    expect(p.coral + p.ambar + p.emOrdem).toBe(linhas.length)
    expect(p.coral).toBe(1) // o pedido de hoje
    expect(p.ambar).toBe(1) // a cobertura
  })
})
