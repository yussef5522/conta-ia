/**
 * ⛔⛔⛔ DOSE EM DÉCIMO DE GRAMA — O CAMPO PROIBIA A VERDADE (29/09/2026)
 *
 * **O dono, com o caso na mão:** *"a dose verdadeira do fermento na «metade de bolinha massa
 * de pizza» é **0,0003 KG** (0,3 g por metade; 5 g fazem 17 metades, fermento seco
 * instantâneo). O campo de quantidade SÓ ACEITA 3 casas — não dá pra digitar 0,0003. Pra
 * item em KG/LT com dose em décimos de grama, o campo proíbe a verdade — e a ficha fica
 * gorda 10×. **Foi isso que derreteu o fermento virtual: 3 g no lugar de 0,3 g.**"*
 *
 * ⭐⭐ **ERAM QUATRO CORTES, NÃO UM** — e este arquivo percorre o caminho inteiro, do campo
 * ao ledger, porque consertar só a digitação deixaria a dose morrer no motor:
 *   1. `sanitizarQtd` cortava na 3ª casa (0,0003 → "0,000")
 *   2. `stepDaUnidade` dava `0.001` (o navegador recusa sozinho, sem erro nenhum)
 *   3. o motor da SEPARAÇÃO fazia `round4` no planejado e `round2` no separado
 *   4. o motor da BAIXA DE VENDA somava a explosão com `round2` — dose pequena virava 0,00,
 *      e movimento com quantidade zero o ledger RECUSA (a venda não baixaria o componente)
 *
 * ⚠️ **A gravação segue em KG**; a unidade natural é só EXIBIÇÃO (`formatarQtd`).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarFicha, atualizarFicha, getFicha } from '@/lib/stock/producao/fichas'
import { criarOrdem, explodirSeparacao, confirmarSeparacao } from '@/lib/stock/producao/ordens'
import { saldoItem } from '@/lib/stock/saldo'
import { sanitizarQtd, valorQtd, validarQtd, stepDaUnidade, formatarQtd, descreverQtd, MAX_CASAS } from '@/lib/stock/quantidade'
import { montarPlanoDeLinhas } from '@/lib/stock/vendas/baixa-venda'
import { upsertVendaMap } from '@/lib/stock/vendas/venda-map'

const CNPJ = '67676767000167'
const DOSE = 0.0003 // ⭐ 0,3 g — a dose REAL do fermento, em KG
let companyId: string
let fermentoId: string, farinhaId: string, fichaId: string, produzidoId: string

/** o caminho REAL da tela: digita → sanitiza → vira número */
const digitar = (t: string, u: string) => valorQtd(sanitizarQtd(t, u))

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'DOSE FINA' } })
  companyId = c.id
  const ferm = await prisma.stockItem.create({ data: { companyId, nome: 'fermento', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' } })
  const far = await prisma.stockItem.create({ data: { companyId, nome: 'FARINHA', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' } })
  fermentoId = ferm.id; farinhaId = far.id
  // fermento a R$ 34/KG (o custo real da última nota) e farinha a R$ 3,61
  await prisma.stockMovement.create({ data: { companyId, itemId: fermentoId, tipo: 'ENTRADA_NF', quantidade: 5, custoUnitario: 34, custoTotal: 170, origem: 'SEFAZ' } })
  await prisma.stockMovement.create({ data: { companyId, itemId: farinhaId, tipo: 'ENTRADA_NF', quantidade: 100, custoUnitario: 3.61, custoTotal: 361, origem: 'SEFAZ' } })
  const f = await criarFicha({
    companyId, nomeProduzido: 'metade de bolinha massa de pizza', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO',
    loteBase: 1, unidadeLoteBase: 'KG',
    componentes: [
      { itemId: farinhaId, qtdPlanejada: 0.15, unidade: 'KG', posicao: 0 },
      { itemId: fermentoId, qtdPlanejada: 0.003, unidade: 'KG', posicao: 1 }, // a ficha GORDA (3 g)
    ],
  }, prisma)
  fichaId = f.fichaId; produzidoId = f.itemProduzidoId
})
afterEach(async () => {
  for (const t of ['stockVendaLinha', 'stockVendaProdutoMap', 'stockProducaoConclusao', 'stockMovement', 'stockProductionOrder', 'stockFichaEtapa', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockItem', 'stockSaldoCache'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('⛔⛔ 1. o campo aceita a dose real (até 1 mg)', () => {
  it('⭐ 0,0003 KG sobrevive à digitação — era o corte na 3ª casa', () => {
    expect(sanitizarQtd('0,0003', 'KG')).toBe('0,0003')
    expect(digitar('0,0003', 'KG')).toBe(DOSE)
    expect(validarQtd('0,0003', 'KG', 'fermento')).toBeNull()
  })

  it('⭐ os estados INTERMEDIÁRIOS da digitação sobrevivem (é o bug de origem do módulo)', () => {
    const passos = ['0', '0,', '0,0', '0,00', '0,000', '0,0003']
    for (const p of passos) expect(sanitizarQtd(p, 'KG')).toBe(p)
  })

  it('⛔ o passo do input acompanha — senão o navegador recusa sozinho, sem erro', () => {
    expect(stepDaUnidade('KG')).toBe('0.000001')
    expect(MAX_CASAS).toBe(6)
  })

  it('⛔⛔ e UN continua INTEIRO — 6 casas não afrouxaram a régua da peça', () => {
    expect(sanitizarQtd('0,5', 'UN')).toBe('05')
    expect(validarQtd('0,5', 'UN', 'pão')).toContain('não dá pra usar fração')
  })
})

describe('⭐⭐ 2. a tela mostra na unidade natural (a gravação segue em KG)', () => {
  it('⭐ 0,0003 KG lê "0,3 g" — o padeiro lê grama, não fração de quilo', () => {
    expect(formatarQtd(DOSE, 'KG')).toBe('0,3 g')
    expect(descreverQtd(DOSE, 'KG')).toBe('0,3 g')
  })

  it('⛔ e NUNCA trunca pra "0" — era o defeito gêmeo, do lado da exibição', () => {
    // `maximumFractionDigits: 3` transformava a dose em "0" na tela
    expect(formatarQtd(DOSE, 'KG')).not.toBe('0')
    expect(formatarQtd(0.000001, 'KG')).toBe('0,001 g')
    expect((0.0003).toLocaleString('pt-BR', { maximumFractionDigits: 3 })).toBe('0') // o contrafactual
  })

  it('⛔⛔ o TETO da exibição é o mesmo da digitação — 6 casas, não 3', () => {
    /**
     * ⚠️ REGRA 11 REPROVOU A 1ª VERSÃO DESTE BLOCO: eu repus o teto de 3 casas na
     * formatação e **os 30 testes ficaram VERDES**, porque "0,3 g" e "0,001 g" cabem
     * folgados em 3 casas. O que SEPARA 3 de 6 é o valor que a tela mostra **na própria
     * unidade** (o caminho ≥ 1) e o grama com 4ª casa — e é justo aí que a tela dizia
     * menos do que o campo aceita.
     */
    expect(formatarQtd(1.000001, 'KG')).toBe('1,000001 KG')  // com 3 casas: "1 KG"
    expect(formatarQtd(2.0456, 'UN')).toBe('2,0456 UN')      // com 3 casas: "2,046 UN"
    /**
     * ⚠️ E UM CASO MEU CAIU AQUI, medido: eu tinha afirmado `0,0000005 KG → "0,0005 g"`.
     * **Está abaixo do piso que o campo aceita** (0,5 µg contra 1 mg) — a digitação corta
     * antes de chegar na tela, então era asserção sobre um valor inalcançável. A precisão
     * da unidade menor é `MAX_CASAS − 3` **por construção** (1.000× menor = 3 casas menos),
     * o que dá 1 µg: mais fino que o piso, e por isso o grama nunca perde dose válida.
     */
    expect(formatarQtd(0.000001, 'KG')).toBe('0,001 g') // o piso do campo, inteiro na tela
  })

  it('⭐ volume vira ml, e acima de 1 fica na unidade do item', () => {
    expect(formatarQtd(0.0005, 'LT')).toBe('0,5 ml')
    expect(formatarQtd(1.5, 'KG')).toBe('1,5 KG')
    expect(formatarQtd(12, 'UN')).toBe('12 UN')
    expect(formatarQtd(0.15, 'KG')).toBe('150 g')
  })

  it('⚠️ e peça NÃO ganha unidade menor (não existe "0,3 g de pão")', () => {
    expect(formatarQtd(0.5, 'UN')).toBe('0,5 UN')
  })
})

describe('⛔⛔⛔ 3. o caminho inteiro: editar a ficha → separar → o ledger', () => {
  it('⭐ salva v2 com 0,0003 e a ficha DEVOLVE 0,0003 (não 0)', async () => {
    const { versao } = await atualizarFicha(companyId, fichaId, {
      loteBase: 1, unidadeLoteBase: 'KG',
      componentes: [
        { itemId: farinhaId, qtdPlanejada: 0.15, unidade: 'KG', posicao: 0 },
        { itemId: fermentoId, qtdPlanejada: DOSE, unidade: 'KG', posicao: 1 },
      ],
    }, prisma)
    expect(versao).toBe(2) // mudar componente gera versão nova (ordens antigas intactas)

    const f = await getFicha(companyId, fichaId, prisma)
    const comp = f!.ficha.componentes.find((c) => c.itemId === fermentoId)!
    expect(comp.qtdPlanejada).toBe(DOSE)
    expect(formatarQtd(comp.qtdPlanejada, comp.unidadeControle)).toBe('0,3 g')
    // ⭐ e o subtotal não vira zero: 0,0003 × 34 = R$ 0,0102 → R$ 0,01
    expect(comp.subtotal).toBe(0.01)
  })

  it('⛔⛔ a SEPARAÇÃO multiplica sem arredondar cedo (era round4/round2)', async () => {
    await atualizarFicha(companyId, fichaId, {
      loteBase: 1, unidadeLoteBase: 'KG',
      componentes: [
        { itemId: farinhaId, qtdPlanejada: 0.15, unidade: 'KG', posicao: 0 },
        { itemId: fermentoId, qtdPlanejada: DOSE, unidade: 'KG', posicao: 1 },
      ],
    }, prisma)

    // escala 1
    const a = await criarOrdem({ companyId, fichaId, escalaReceitas: 1, dataProducao: new Date('2026-09-29') }, prisma)
    const linhasA = (await explodirSeparacao(companyId, a.ordemId, prisma)).linhas
    expect(linhasA.find((l) => l.itemId === fermentoId)!.qtdPlanejada).toBe(DOSE)

    // escala 267 (o lote real da padaria): 0,0003 × 267 = 0,0801 KG = 80,1 g
    const b = await criarOrdem({ companyId, fichaId, escalaReceitas: 267, dataProducao: new Date('2026-09-29') }, prisma)
    const linhaB = (await explodirSeparacao(companyId, b.ordemId, prisma)).linhas.find((l) => l.itemId === fermentoId)!
    expect(linhaB.qtdPlanejada).toBe(0.0801)
    expect(formatarQtd(linhaB.qtdPlanejada, 'KG')).toBe('80,1 g')
    expect(linhaB.porLote).toBe(DOSE) // o por-lote nunca foi arredondado (a lição de 01/09)
  })

  it('⛔⛔ e o motor carrega até 1 mg — o que o campo aceita, o motor tem que levar', async () => {
    /**
     * ⚠️ REGRA 11 REPROVOU A 1ª VERSÃO: repus o `round4` no planejado e os 30 testes ficaram
     * VERDES, porque 0,0003 e 0,0801 **cabem em 4 casas**. O caso que SEPARA round4 de
     * round6 é o piso que o campo passou a aceitar: **1 mg**, que o `round4` zera.
     *
     * ⛔ E zerar ali não é detalhe: com planejado 0, a tela pré-preenche a separação com
     * ZERO e a pessoa confirma sem o componente — o insumo sai do lote sem sair do estoque.
     */
    await atualizarFicha(companyId, fichaId, {
      loteBase: 1, unidadeLoteBase: 'KG',
      componentes: [{ itemId: fermentoId, qtdPlanejada: 0.000001, unidade: 'KG', posicao: 0 }],
    }, prisma)
    const o = await criarOrdem({ companyId, fichaId, escalaReceitas: 1, dataProducao: new Date('2026-09-29') }, prisma)
    const linha = (await explodirSeparacao(companyId, o.ordemId, prisma)).linhas.find((l) => l.itemId === fermentoId)!
    expect(linha.qtdPlanejada, 'o planejado virou ZERO — o motor arredondou antes da tela').toBe(0.000001)
    expect(Math.round(0.000001 * 10000) / 10000).toBe(0) // o contrafactual do round4
  })

  it('⭐⭐ o LEDGER recebe a dose exata e o saldo desconta 0,3 g por metade', async () => {
    await atualizarFicha(companyId, fichaId, {
      loteBase: 1, unidadeLoteBase: 'KG',
      componentes: [
        { itemId: farinhaId, qtdPlanejada: 0.15, unidade: 'KG', posicao: 0 },
        { itemId: fermentoId, qtdPlanejada: DOSE, unidade: 'KG', posicao: 1 },
      ],
    }, prisma)
    const { ordemId } = await criarOrdem({ companyId, fichaId, escalaReceitas: 100, dataProducao: new Date('2026-09-29') }, prisma)
    const antes = (await saldoItem(prisma, companyId, fermentoId)).saldo

    // 100 metades × 0,3 g = 30 g = 0,03 KG
    await confirmarSeparacao(companyId, ordemId, [{ itemId: fermentoId, qtdSeparada: 0.03 }], prisma)

    const mov = await prisma.stockMovement.findFirst({ where: { companyId, itemId: fermentoId, tipo: 'SEPARACAO_SAIDA' } })
    expect(mov!.quantidade).toBe(-0.03)
    const depois = (await saldoItem(prisma, companyId, fermentoId)).saldo
    expect(depois).toBeCloseTo(antes - 0.03, 6)
    // ⭐ e a linha do histórico é legível: "30 g", não "0,03"
    expect(formatarQtd(mov!.quantidade, 'KG')).toBe('-30 g')
  })

  it('⛔⛔ a BAIXA DE VENDA não zera a dose (o 2º motor, com o mesmo defeito)', async () => {
    await atualizarFicha(companyId, fichaId, {
      loteBase: 1, unidadeLoteBase: 'KG',
      componentes: [{ itemId: fermentoId, qtdPlanejada: DOSE, unidade: 'KG', posicao: 0 }],
    }, prisma)
    // a ficha do produto final que o PDV vende, consumindo a massa como componente
    const pf = await criarFicha({
      companyId, nomeProduzido: 'PIZZA DE TESTE', unidadeProduzido: 'UN', tipoProduto: 'PRODUTO_FINAL',
      loteBase: 1, unidadeLoteBase: 'UN',
      componentes: [{ itemId: fermentoId, qtdPlanejada: DOSE, unidade: 'KG', posicao: 0 }],
    }, prisma)
    await upsertVendaMap(companyId, 'PIZZA DE TESTE', { tipo: 'FICHA', fichaId: pf.fichaId }, undefined, prisma)

    // vender UMA unidade: com round2 na explosão isso virava 0,00 e o ledger recusaria
    const plano = await montarPlanoDeLinhas(companyId, '2026-09-29', [{ produto: 'PIZZA DE TESTE', quantidade: 1, valorTotal: 30 }], null, prisma)
    const linha = plano.agregada.find((a) => a.itemId === fermentoId)
    expect(linha, 'o fermento sumiu do plano — a dose foi arredondada a zero').toBeDefined()
    expect(linha!.qtd).toBe(DOSE)
    expect(formatarQtd(linha!.qtd, 'KG')).toBe('0,3 g')
  })
})

describe('⭐ e a conta do dono fecha: 5 g fazem 17 metades', () => {
  it('0,0003 KG × 17 = 0,0051 KG ≈ 5 g', () => {
    expect(Math.round(DOSE * 17 * 1000 * 10) / 10).toBe(5.1)
    // ⚠️ e com a ficha GORDA (3 g/un) os mesmos 5 g fariam só 1,7 metades — o número que
    // fez o mapa de 28/09 achar que a receita pedia 10× mais fermento do que pede.
    expect(Math.round(5 / 3 * 10) / 10).toBe(1.7)
  })
})
