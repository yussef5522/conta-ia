/**
 * ⭐⭐⭐ A PORTA ÚNICA DA CONFIG DE COMPRA — contra banco (16/10/2026).
 *
 * **O teste que importa é o ENCAIXE** (`O ENCAIXE`, no fim): a config gravada pela porta real
 * alimenta `contaDoPedido` e tem que dar **o pin do dono — FRANGO, PEDIR 6,6 KG, pedido no
 * DOM**. ⚠️ *Guard que testa a função não prova o encaixe de quem a chama* — foi essa cegueira
 * que deixou o teto ponderado passar verde em 14/10 e o `rendimentoMedio` envenenar a separação
 * em 03/10. Aqui o número sai do BANCO, pela leitura que a tela vai usar.
 *
 * ⚠️ E o encaixe guarda um veneno específico: `ItemParaPedido.folga` é **FATOR** (`1.1`), e a
 * coluna guarda **PONTOS PERCENTUAIS** (`10`). Passar o pct cru vira fator 10 e pede **60 KG no
 * lugar de 6,6** — o contrafactual está medido no próprio teste.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import {
  salvarConfigDeCompra,
  configsDeCompraDaEmpresa,
  configDeCompraDoItem,
  configPadrao,
  parseDiasChegada,
  serializarDiasChegada,
  folgaDoPct,
  FOLGA_PCT_PADRAO,
  ConfigDeCompraError,
} from '../config-de-compra'
import { contaDoPedido, diaPedir, fmt1, ANTECEDENCIA_PADRAO, FOLGA_PADRAO } from '../consumo-e-compras'

const CNPJ = '85858585000185'
const CNPJ_VIZINHA = '86868686000186'
let companyId: string

async function item(nome: string) {
  const i = await prisma.stockItem.create({
    data: { companyId, nome, unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' },
  })
  return i.id
}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'CONFIG DE COMPRA' } })
  companyId = c.id
})
afterEach(async () => {
  await prisma.stockCompraConfig.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
})

describe('⭐ O CSV É DETALHE DE ARMAZENAMENTO — a serialização tem um dono só', () => {
  it('⭐ ida e volta: dias → CSV canônico → dias', () => {
    expect(serializarDiasChegada([0, 2, 4])).toBe('0,2,4')
    expect(parseDiasChegada('0,2,4')).toEqual([0, 2, 4])
  })

  it('⭐⭐ o CSV é CANÔNICO: fora de ordem e repetido viram a MESMA string', () => {
    // ⛔ sem isso o mesmo item pareceria duas configurações diferentes no banco
    expect(serializarDiasChegada([4, 0, 2, 0])).toBe('0,2,4')
    expect(serializarDiasChegada([2, 0, 4])).toBe(serializarDiasChegada([0, 4, 2]))
  })

  it('⭐ `` é "nenhum dia", nunca um dia 0 inventado', () => {
    expect(parseDiasChegada('')).toEqual([])
    expect(parseDiasChegada('   ')).toEqual([])
    expect(serializarDiasChegada([])).toBe('')
  })

  it('⚠️ a LEITURA é tolerante: lixo que escape por outra porta é IGNORADO, não derruba a tela', () => {
    expect(parseDiasChegada('0,9,2')).toEqual([0, 2])
    expect(parseDiasChegada('0,abc,4')).toEqual([0, 4])
  })

  it('⭐ pct → FATOR, a única conversão (e o padrão DERIVA da lib pura)', () => {
    expect(FOLGA_PCT_PADRAO).toBe(10)
    expect(folgaDoPct(FOLGA_PCT_PADRAO)).toBeCloseTo(FOLGA_PADRAO, 10)
    expect(folgaDoPct(0)).toBe(1)
    expect(folgaDoPct(20)).toBeCloseTo(1.2, 10)
  })
})

describe('⭐ A PORTA — o que ela grava e o que ela RECUSA', () => {
  it('⭐ grava e lê de volta, com o CSV canônico no banco', async () => {
    const frango = await item('FILE DE PEITO DE FRANGO')
    const r = await salvarConfigDeCompra(
      { companyId, itemId: frango, diasChegada: [4, 0, 2], antecedenciaDias: 1, fornecedor: 'Frigorífico Silva', folgaPct: 10 },
      prisma,
    )
    expect(r.diasChegada).toEqual([0, 2, 4])

    const linha = await prisma.stockCompraConfig.findFirst({ where: { companyId, itemId: frango } })
    expect(linha!.diasChegada, 'o banco guardou o CSV fora de ordem').toBe('0,2,4')

    const lido = await configDeCompraDoItem(companyId, frango, prisma)
    expect(lido).toEqual({
      itemId: frango,
      diasChegada: [0, 2, 4],
      antecedenciaDias: 1,
      fornecedor: 'Frigorífico Silva',
      folgaPct: 10,
      folga: 1.1,
    })
  })

  it('⭐⭐ IDEMPOTENTE: 10 salvamentos = 1 linha (dois toques no celular não criam duas configs)', async () => {
    const i = await item('ACEM')
    for (let k = 0; k < 10; k++) {
      await salvarConfigDeCompra({ companyId, itemId: i, diasChegada: [0], antecedenciaDias: 2 }, prisma)
    }
    expect(await prisma.stockCompraConfig.count({ where: { companyId } })).toBe(1)
  })

  it('⚠️ dia REPETIDO é o dedo do dono: deduplica, não recusa', async () => {
    const i = await item('QUEIJO')
    const r = await salvarConfigDeCompra({ companyId, itemId: i, diasChegada: [0, 0, 3, 3] }, prisma)
    expect(r.diasChegada).toEqual([0, 3])
    const linha = await prisma.stockCompraConfig.findFirst({ where: { companyId, itemId: i } })
    expect(linha!.diasChegada).toBe('0,3')
  })

  it('⛔⛔ dia FORA de 0..6 é RECUSADO — ele tornaria a conta do pedido inalcançável, calada', async () => {
    const i = await item('item com dia torto')
    await expect(
      salvarConfigDeCompra({ companyId, itemId: i, diasChegada: [0, 7] }, prisma),
    ).rejects.toThrow(ConfigDeCompraError)
    await expect(
      salvarConfigDeCompra({ companyId, itemId: i, diasChegada: [-1] }, prisma),
    ).rejects.toThrow('os dias vão de 0 (SEG) a 6 (DOM)')
    expect(await prisma.stockCompraConfig.count({ where: { companyId } }), 'recusou e gravou').toBe(0)
  })

  it('⭐ antecedência: 0 é LEGÍTIMO (entrega no mesmo dia), 31 é dedo escorregado', async () => {
    const i = await item('entrega no dia')
    const ok = await salvarConfigDeCompra({ companyId, itemId: i, diasChegada: [0], antecedenciaDias: 0 }, prisma)
    expect(ok.antecedenciaDias).toBe(0)

    await expect(
      salvarConfigDeCompra({ companyId, itemId: i, diasChegada: [0], antecedenciaDias: 31 }, prisma),
    ).rejects.toThrow('antecedência do pedido vai de 0 a 30')
    // ⚠️ a recusa não apagou a config boa que já estava lá
    expect((await configDeCompraDoItem(companyId, i, prisma)).antecedenciaDias).toBe(0)
  })

  it('⭐ folga: 0% é LEGÍTIMO (o dono pode não querer folga), 201% não', async () => {
    const i = await item('sem folga')
    const ok = await salvarConfigDeCompra({ companyId, itemId: i, diasChegada: [0], folgaPct: 0 }, prisma)
    expect(ok.folgaPct).toBe(0)
    expect(ok.folga).toBe(1)

    await expect(
      salvarConfigDeCompra({ companyId, itemId: i, diasChegada: [0], folgaPct: 201 }, prisma),
    ).rejects.toThrow('folga vai de 0% a 200%')
  })

  it('⭐⭐ REGRA 13 na porta: fornecedor só-espaço vira NULL, nunca `   `', async () => {
    const i = await item('sem fornecedor')
    const r = await salvarConfigDeCompra({ companyId, itemId: i, diasChegada: [0], fornecedor: '   ' }, prisma)
    expect(r.fornecedor).toBeNull()
    const linha = await prisma.stockCompraConfig.findFirst({ where: { companyId, itemId: i } })
    expect(linha!.fornecedor, 'um nome em branco sairia no texto do WhatsApp').toBeNull()
  })

  it('⭐ fornecedor é APARADO, e espaço no MEIO sobrevive (é nome de empresa)', async () => {
    const i = await item('com fornecedor')
    const r = await salvarConfigDeCompra({ companyId, itemId: i, diasChegada: [0], fornecedor: '  Frigorífico Silva  ' }, prisma)
    expect(r.fornecedor).toBe('Frigorífico Silva')
  })

  it('⭐ o rastro diz QUEM mexeu POR ÚLTIMO — a config de hoje manda na compra de amanhã', async () => {
    const i = await item('com rastro')
    await salvarConfigDeCompra({ companyId, itemId: i, diasChegada: [0], userId: 'u-dono' }, prisma)
    await salvarConfigDeCompra({ companyId, itemId: i, diasChegada: [0, 3], userId: 'u-gerente' }, prisma)
    const l = await prisma.stockCompraConfig.findFirst({ where: { companyId, itemId: i } })
    expect(l!.definidoPorId).toBe('u-gerente')
    expect(l!.diasChegada).toBe('0,3')
  })

  it('⛔⛔ REGRA 8 — item de OUTRA empresa é RECUSADO (sem o companyId no where, configuraria a compra do vizinho)', async () => {
    const outra = await prisma.company.create({ data: { cnpj: CNPJ_VIZINHA, name: 'VIZINHA' } })
    try {
      const alheio = await prisma.stockItem.create({
        data: { companyId: outra.id, nome: 'frango da vizinha', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' },
      })
      await expect(
        salvarConfigDeCompra({ companyId, itemId: alheio.id, diasChegada: [0] }, prisma),
      ).rejects.toThrow(ConfigDeCompraError)
      expect(await prisma.stockCompraConfig.count({})).toBe(0)
    } finally {
      await prisma.stockCompraConfig.deleteMany({ where: { companyId: outra.id } })
      await prisma.company.delete({ where: { id: outra.id } })
    }
  })

  it('⛔ id que não existe → recusa que ENSINA, e nada gravado', async () => {
    await expect(
      salvarConfigDeCompra({ companyId, itemId: 'nao-existe', diasChegada: [0] }, prisma),
    ).rejects.toThrow('Item não encontrado nesta empresa.')
    expect(await prisma.stockCompraConfig.count({ where: { companyId } })).toBe(0)
  })
})

describe('⭐ A LEITURA — em lote, e a AUSÊNCIA é a resposta', () => {
  it('⭐⭐ item SEM config NÃO entra no mapa — é a ausência que faz a mesa cobrar a config', async () => {
    const comConfig = await item('FRANGO')
    const semConfig = await item('ERVILHA')
    await salvarConfigDeCompra({ companyId, itemId: comConfig, diasChegada: [0, 2, 4] }, prisma)

    const mapa = await configsDeCompraDaEmpresa(companyId, prisma)
    expect(mapa.size).toBe(1)
    expect(mapa.has(comConfig)).toBe(true)
    expect(mapa.has(semConfig), 'item sem config não pode nascer com dia inventado').toBe(false)
  })

  it('⭐ a leitura em LOTE é UMA consulta pra N itens (o N+1 de 28/09 custou 4,9 s)', async () => {
    const ids: string[] = []
    for (let k = 0; k < 5; k++) {
      const i = await item(`item ${k}`)
      ids.push(i)
      await salvarConfigDeCompra({ companyId, itemId: i, diasChegada: [k % 7], antecedenciaDias: k % 3 }, prisma)
    }
    const mapa = await configsDeCompraDaEmpresa(companyId, prisma)
    expect(mapa.size).toBe(5)
    for (const [k, id] of ids.entries()) {
      expect(mapa.get(id)!.diasChegada).toEqual([k % 7])
      expect(mapa.get(id)!.antecedenciaDias).toBe(k % 3)
    }
  })

  it('⭐ sem linha, `configDeCompraDoItem` devolve o PADRÃO — a tela não lembra do default (REGRA 5)', async () => {
    const i = await item('nunca configurado')
    const c = await configDeCompraDoItem(companyId, i, prisma)
    expect(c).toEqual(configPadrao(i))
    expect(c.diasChegada).toEqual([])
    expect(c.antecedenciaDias).toBe(ANTECEDENCIA_PADRAO)
    expect(c.folga).toBe(FOLGA_PADRAO)
  })

  it('⭐ a config é DA CASA: a leitura não filtra por usuário', async () => {
    const i = await item('da casa')
    await salvarConfigDeCompra({ companyId, itemId: i, diasChegada: [0], userId: 'u-gerente' }, prisma)
    // o DONO (outro usuário) lê a mesma config — nada de `userId` no where
    const mapa = await configsDeCompraDaEmpresa(companyId, prisma)
    expect(mapa.get(i)!.diasChegada).toEqual([0])
  })
})

describe('⭐⭐⭐ O ENCAIXE — a config do BANCO alimenta a conta e dá o PIN DO DONO', () => {
  /** a amostra FRANGO da referência (SEG-first, hoje = SEX) */
  const MEDIA_FRANGO = [3.2, 2.8, 3.5, 4.1, 6.8, 8.2, 5.9]
  const HOJE_SEXTA = 4

  it('⭐⭐ FRANGO: cheg SEG/QUA/SEX · antec 1 · est 14,2 → PEDIR 6,6 KG, pedido no DOM', async () => {
    const frango = await item('FILE DE PEITO DE FRANGO')
    await salvarConfigDeCompra(
      { companyId, itemId: frango, diasChegada: [0, 2, 4], antecedenciaDias: 1, fornecedor: 'Frigorífico Silva', folgaPct: 10 },
      prisma,
    )

    // ⭐ a config vem do BANCO, pela leitura que a tela usa — não de um objeto montado à mão
    const cfg = (await configsDeCompraDaEmpresa(companyId, prisma)).get(frango)!

    const conta = contaDoPedido(
      {
        diasChegada: cfg.diasChegada,
        antecedenciaDias: cfg.antecedenciaDias,
        folga: cfg.folga,
        estoque: 14.2,
        mediaPorDia: MEDIA_FRANGO,
      },
      HOJE_SEXTA,
    )

    expect(conta.ok).toBe(true)
    if (!conta.ok) throw new Error(conta.porque)
    expect(conta.chegaDia, 'a próxima chegada é SEG').toBe(0)
    expect(conta.janela, 'cobre SEG e TER (até a chegada de QUA)').toEqual([0, 1])
    expect(conta.saiJanela).toBe(6)
    expect(conta.precisa).toBe(6.6)
    expect(conta.sobraNaChegada, 'o estoque não sobrevive ao fim de semana').toBe(0)
    expect(conta.pedir, '⭐ O PIN DO DONO').toBe(6.6)
    expect(diaPedir(conta, HOJE_SEXTA)).toBe('DOM')
  })

  it('⛔⛔ CONTRAFACTUAL: se a porta devolvesse o PCT CRU no lugar do FATOR, pediria ~9× o necessário', async () => {
    const frango = await item('FILE DE PEITO DE FRANGO')
    const cfg = await salvarConfigDeCompra(
      { companyId, itemId: frango, diasChegada: [0, 2, 4], antecedenciaDias: 1, folgaPct: 10 },
      prisma,
    )
    const base = { diasChegada: cfg.diasChegada, antecedenciaDias: cfg.antecedenciaDias, estoque: 14.2, mediaPorDia: MEDIA_FRANGO }

    const certo = contaDoPedido({ ...base, folga: cfg.folga }, HOJE_SEXTA)
    const veneno = contaDoPedido({ ...base, folga: cfg.folgaPct }, HOJE_SEXTA)
    if (!certo.ok || !veneno.ok) throw new Error('a conta deveria fechar nos dois')

    expect(certo.pedir).toBe(6.6)
    /**
     * ⚠️ O pct cru (`10`) entra como FATOR 10: `precisa = 6,0 × 10 = 60`. Com a folga certa são
     * **6,6 KG**; com o veneno, **60 KG de frango** — ~9× o necessário, num número que sai
     * **plausível na tela** (é quantidade de balcão, não um `NaN` que alguém notaria).
     */
    expect(veneno.pedir, 'o pct cru viraria fator 10 → 60 KG de frango').toBe(60)
    expect(veneno.pedir / certo.pedir).toBeCloseTo(9.09, 2)
  })

  it('⭐⭐ SEM dias de chegada, a conta DIZ o que falta — nunca um pedido inventado (lei C2)', async () => {
    const i = await item('item sem config')
    const cfg = await configDeCompraDoItem(companyId, i, prisma)
    const conta = contaDoPedido(
      { diasChegada: cfg.diasChegada, antecedenciaDias: cfg.antecedenciaDias, folga: cfg.folga, estoque: 10, mediaPorDia: MEDIA_FRANGO },
      HOJE_SEXTA,
    )
    expect(conta.ok).toBe(false)
    if (conta.ok) throw new Error('não deveria montar pedido sem dias')
    expect(conta.porque).toBe('configura os dias de chegada')
  })

  it('⭐ trocar os dias na config MUDA a janela e o pedido (a config é a lei da conta)', async () => {
    const i = await item('ACEM')
    // ACÉM da referência: chega só na SEG, antecedência 2
    await salvarConfigDeCompra({ companyId, itemId: i, diasChegada: [0], antecedenciaDias: 2 }, prisma)
    const cfg = await configDeCompraDoItem(companyId, i, prisma)
    const media = [2.1, 1.9, 2.4, 2.6, 4.9, 6.1, 4.2]
    const conta = contaDoPedido(
      { diasChegada: cfg.diasChegada, antecedenciaDias: cfg.antecedenciaDias, folga: cfg.folga, estoque: 9.8, mediaPorDia: media },
      HOJE_SEXTA,
    )
    if (!conta.ok) throw new Error(conta.porque)
    // chega só na segunda → a janela é a semana INTEIRA, e o pedido é muito maior
    expect(conta.janela).toHaveLength(7)
    /**
     * ⚠️ **26,62 no CRU; a referência IMPRIME "26,6"** — ela formata toda quantidade com 1 casa
     * (`fmt1`). Travar `26.6` aqui seria travar a FORMATAÇÃO no lugar da CONTA, e o teste
     * passaria a mentir no dia em que a tela mudasse de casas decimais.
     */
    expect(conta.pedir, '⭐ O PIN DO ACÉM').toBe(26.62)
    expect(fmt1(conta.pedir), 'o que a referência imprime').toBe('26,6')
    expect(diaPedir(conta, HOJE_SEXTA)).toBe('SÁB')
  })
})
