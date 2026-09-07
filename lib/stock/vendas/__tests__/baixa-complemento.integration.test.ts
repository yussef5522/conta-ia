// ⭐⭐⭐ A BAIXA DOS COMPLEMENTOS — o red-then-green combinado com o dono (03/09/2026).
//
// A regra que este arquivo trava, nas palavras dele:
//   **1 ocorrência de CALABRESA → CONSUMO de 1 UN da porção de calabresa, ZERO movimento na
//   calabresa CRUA. Saldo negativo = "vendeu sem produzir", sinal legítimo.**
//
// ⛔ E as duas armadilhas escritas no código em 02/09, antes de o problema existir:
//   1. linha de PERÍODO não baixa (baixaria o mês inteiro com cara de rotina)
//   2. reimport de dia já baixado não fica em silêncio

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarFicha } from '../../producao/fichas'
import { upsertComplementoMap } from '../complemento-map'
import { confirmarComplementos, previewComplementos } from '../import-complementos'
import { montarPlanoComplementos, processarComplementos, listarDiasComplemento, baixarSeHouverFicha, BaixaComplementoError } from '../baixa-complemento'
import { saldoItem } from '../../saldo'

/** o número do saldo (a lib devolve o objeto do item) */
const saldo = async (itemId: string) => (await saldoItem(prisma, companyId, itemId)).saldo

const CNPJ = '44556677000188'
const DIA = '2026-09-03'
let companyId = ''
let calabresaCrua = ''
let itemPorcao = ''
let fichaPorcao = ''
let fichaSabor = ''

/** relatório de complementos: Descrição | Valor médio | Quantidade | Valor Total */
const html = (linhas: [string, number][]) =>
  `<table><tr><td>Descrição</td><td>Valor médio</td><td>Quantidade</td><td>Valor Total</td></tr>` +
  linhas.map(([nome, q]) => `<tr><td>${nome}</td><td>R$ 0,00</td><td>${q}</td><td>R$ 0,00</td></tr>`).join('') +
  `</table>`

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'BAIXA' } })).id

  // a matéria-prima que a COZINHA usa (e que a venda NÃO pode tocar)
  const crua = await prisma.stockItem.create({ data: { companyId, nome: 'CALABRESA CRUA', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' } })
  calabresaCrua = crua.id
  await prisma.stockMovement.create({ data: { companyId, itemId: crua.id, tipo: 'ENTRADA_NF', quantidade: 10, custoUnitario: 30, custoTotal: 300, origem: 'SEFAZ' } })

  // a receita de produção: a porção que a cozinha faz em lote
  const p = await criarFicha({
    companyId, nomeProduzido: 'porcao de calabresa 120 grama', unidadeProduzido: 'UN',
    tipoProduto: 'INTERMEDIARIO', loteBase: 10, unidadeLoteBase: 'UN',
    componentes: [{ itemId: calabresaCrua, qtdPlanejada: 1.2, unidade: 'KG', posicao: 0 }],
  }, prisma)
  fichaPorcao = p.fichaId; itemPorcao = p.itemProduzidoId
  // 20 porções produzidas e na câmara
  await prisma.stockMovement.create({ data: { companyId, itemId: itemPorcao, tipo: 'PRODUCAO_GERACAO', quantidade: 20, custoUnitario: 3.6, custoTotal: 72, origem: 'MANUAL' } })

  // o SABOR: o que a venda consome (1 UN da porção pronta)
  const s = await criarFicha({
    companyId, nomeProduzido: 'CALABRESA', unidadeProduzido: 'UN',
    tipoProduto: 'SABOR', loteBase: 1, unidadeLoteBase: 'UN',
    componentes: [{ itemId: itemPorcao, qtdPlanejada: 1, unidade: 'UN', posicao: 0 }],
    mapearComplemento: ['CALABRESA'],
  }, prisma)
  fichaSabor = s.fichaId
})

afterEach(async () => {
  for (const t of ['stockVendaComplementoMap', 'stockVendaComplementoLinha', 'stockVendaComplementoNome',
    'stockVendaComplementoGrupo', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha',
    'stockMovement', 'stockSaldoCache', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('⭐⭐⭐ 1 ocorrência = 1 explosão da ficha', () => {
  it('⭐⭐⭐ 1 CALABRESA → 1 UN da PORÇÃO, ZERO movimento na crua — NO PRÓPRIO IMPORT', async () => {
    // ⭐⭐ 07/09: **confirmar o import JÁ BAIXA** (decisão do dono). O passo separado era
    // *"estado intermediário que só serve pra ser esquecido"* — e serviu: os dias 02, 03 e 04
    // ficaram importados e nunca baixados.
    const imp = await confirmarComplementos(companyId, DIA, html([['CALABRESA', 1]]), undefined, prisma)

    expect(imp.baixa, 'o import não baixou — o passo separado voltou').not.toBeNull()
    expect(imp.baixa!.ocorrencias).toBe(1)
    expect(imp.baixa!.itensBaixados).toBe(1)
    expect(imp.baixaFalhou).toBe(false)

    const movs = await prisma.stockMovement.findMany({ where: { companyId, tipo: 'BAIXA_VENDA' }, select: { itemId: true, quantidade: true } })
    expect(movs).toHaveLength(1)
    expect(movs[0].itemId, 'baixou o item errado').toBe(itemPorcao)
    expect(movs[0].quantidade).toBe(-1)
    // ⛔ a crua é da COZINHA: quem a consumiu foi a produção, não a venda
    expect(movs.some((m) => m.itemId === calabresaCrua), 'a venda mexeu na calabresa CRUA').toBe(false)
    expect(await saldo(calabresaCrua)).toBe(10)
    expect(await saldo(itemPorcao)).toBe(19)
  })

  it('⭐⭐ 4 ocorrências (pizza grande inteira) → 4 UN, sem fração por tamanho', async () => {
    await confirmarComplementos(companyId, DIA, html([['CALABRESA', 4]]), undefined, prisma)
    await processarComplementos(companyId, DIA, undefined, prisma)
    expect(await saldo(itemPorcao)).toBe(16)
  })

  it('⭐⭐ SALDO NEGATIVO é sinal legítimo: "vendeu sem produzir"', async () => {
    // 25 ocorrências com 20 porções na câmara
    // ⚠️ o PREVIEW avisa ANTES de gravar (é o que a tela imprime), e a baixa não bloqueia:
    // esconder isso trocaria informação verdadeira por estoque bonito e falso.
    const prev = await previewComplementos(companyId, DIA, html([['CALABRESA', 25]]), prisma)
    expect(prev.baixa!.itens[0].saldoDepois, 'a tela precisa AVISAR o negativo antes de gravar').toBe(-5)

    await confirmarComplementos(companyId, DIA, html([['CALABRESA', 25]]), undefined, prisma)
    expect(await saldo(itemPorcao)).toBe(-5)
  })

  it('⚠️ complemento SEM ficha não baixa e não some — fica visível', async () => {
    await confirmarComplementos(companyId, DIA, html([['CALABRESA', 2], ['OREO', 7]]), undefined, prisma)
    const plano = await montarPlanoComplementos(companyId, DIA, prisma)
    expect(plano.pendentes.map((p) => p.nomeSuitable)).toEqual(['OREO'])
    const r = await processarComplementos(companyId, DIA, undefined, prisma)
    expect(r.pendentes).toBe(1)
    expect(r.ocorrencias).toBe(2) // só as da CALABRESA
  })

  it('⭐ IGNORADO não baixa (é decisão de não baixar, não falta de ficha)', async () => {
    await upsertComplementoMap(companyId, 'GRANDE', { tipo: 'IGNORAR' }, undefined, prisma)
    await confirmarComplementos(companyId, DIA, html([['CALABRESA', 1], ['GRANDE', 9]]), undefined, prisma)
    const plano = await montarPlanoComplementos(companyId, DIA, prisma)
    expect(plano.ignorados.map((i) => i.nomeSuitable)).toEqual(['GRANDE'])
    expect(plano.pendentes).toEqual([])
  })
})

describe('⛔⛔ ARMADILHA 1 — linha de PERÍODO não baixa', () => {
  it('⛔⛔ import de PERÍODO é RECUSADO, com a saída na mensagem', async () => {
    await confirmarComplementos(companyId, '2026-08-31', html([['CALABRESA', 1220]]), undefined, prisma, 'PERIODO')
    const plano = await montarPlanoComplementos(companyId, '2026-08-31', prisma)
    expect(plano.ehPeriodo).toBe(true)

    await expect(processarComplementos(companyId, '2026-08-31', undefined, prisma))
      .rejects.toThrow(/PERÍODO/)
    // ⛔ e o ledger continua intocado — 1.220 ocorrências NÃO viraram baixa
    expect(await prisma.stockMovement.count({ where: { companyId, tipo: 'BAIXA_VENDA' } })).toBe(0)
    expect(await saldo(itemPorcao)).toBe(20)
  })

  it('⭐ e o mesmo arquivo como DIA baixa normalmente', async () => {
    await confirmarComplementos(companyId, DIA, html([['CALABRESA', 3]]), undefined, prisma)
    await processarComplementos(companyId, DIA, undefined, prisma)
    expect(await saldo(itemPorcao)).toBe(17)
  })
})

describe('⛔⛔ ARMADILHA 2 — reimport de dia JÁ BAIXADO', () => {
  // ⭐⭐ 07/09 — O REIMPORT PASSOU A SE AUTOCORRIGIR. Era uma das DUAS saídas que o dono já
  // tinha aceitado em 02/09 (*"estorno-e-refaz na hora OU marcar 'precisa reprocessar'
  // VISÍVEL — substituir calado não é opção"*), e com o gesto único ela virou a natural.
  // ⚠️ E não é silencioso: o PREVIEW diz "este dia já foi baixado — confirmar estorna e
  // refaz" ANTES do clique.
  it('⭐⭐ reimportar com número diferente ESTORNA e refaz no próprio confirmar', async () => {
    await confirmarComplementos(companyId, DIA, html([['CALABRESA', 10]]), undefined, prisma)
    expect(await saldo(itemPorcao)).toBe(10)

    // ⚠️ o preview AVISA antes: o dono vê que vai estornar
    const prev = await previewComplementos(companyId, DIA, html([['CALABRESA', 7]]), prisma)
    expect(prev.baixa!.jaBaixado, 'o dono confirmaria um estorno sem ser avisado').toBe(true)

    // o PDV corrigiu o dia: agora são 7
    const imp = await confirmarComplementos(companyId, DIA, html([['CALABRESA', 7]]), undefined, prisma)
    expect(imp.baixa!.estornou).toBe(1)
    expect(await saldo(itemPorcao), 'ficou linha nova (7) com movimento velho (10)').toBe(13)

    // ⭐ o ledger guarda a história inteira: baixa velha + estorno + baixa nova
    const movs = await prisma.stockMovement.findMany({ where: { companyId, itemId: itemPorcao }, select: { tipo: true } })
    expect(movs.filter((m) => m.tipo === 'BAIXA_VENDA')).toHaveLength(2)
    expect(movs.filter((m) => m.tipo === 'ESTORNO')).toHaveLength(1)
    // ⛔ e o dia NÃO fica pendurado em "precisa reprocessar": ele já está certo
    const plano = await montarPlanoComplementos(companyId, DIA, prisma)
    expect(plano.precisaReprocessar).toBe(false)
    expect(plano.jaBaixado).toBe(true)
  })

  it('⛔⛔ MAPEAR DEPOIS acende "precisa reprocessar" — o caso que a marca continua servindo', async () => {
    // ⚠️ é o bullet do dono: *"sem ficha → não baixa (entra pendente) e mapear depois acende
    // o 'precisa reprocessar' do dia"*. Aqui o import não tinha o que baixar; quando o
    // destino aparece, o dia passa a dever uma baixa — e a tela mostra.
    await confirmarComplementos(companyId, DIA, html([['MEXICANA', 9]]), undefined, prisma)
    expect(await prisma.stockMovement.count({ where: { companyId, tipo: 'BAIXA_VENDA' } }), 'baixou sem destino').toBe(0)

    await prisma.stockVendaComplementoMap.create({
      data: { companyId, nomeSuitable: 'MEXICANA', alvoTipo: 'FICHA', fichaId: fichaSabor },
    })

    const dias = await listarDiasComplemento(companyId, prisma)
    // ⚠️ `jaBaixado` é false (nunca baixou), então o dia aparece como PENDENTE — que é o
    // estado honesto: ele deve uma baixa que agora tem destino.
    expect(dias[0].baixado).toBe(false)
    const plano = await montarPlanoComplementos(companyId, DIA, prisma)
    expect(plano.ocorrenciasBaixadas, 'o destino novo não entrou no plano do dia').toBe(9)
  })

  it('⭐ rodar a baixa 2× sem mudar nada é IDEMPOTENTE no saldo', async () => {
    await confirmarComplementos(companyId, DIA, html([['CALABRESA', 5]]), undefined, prisma)
    await processarComplementos(companyId, DIA, undefined, prisma)
    expect(await saldo(itemPorcao)).toBe(15)
  })

  it('⭐ mapear uma ficha DEPOIS e reprocessar traz o que faltava', async () => {
    await confirmarComplementos(companyId, DIA, html([['CALABRESA', 2], ['OREO', 3]]), undefined, prisma)
    await processarComplementos(companyId, DIA, undefined, prisma)
    expect(await saldo(itemPorcao)).toBe(18)

    // o dono mapeia OREO na mesma porção (só pra provar o caminho) e reprocessa
    await upsertComplementoMap(companyId, 'OREO', { tipo: 'FICHA', fichaId: fichaSabor }, undefined, prisma)
    const plano = await montarPlanoComplementos(companyId, DIA, prisma)
    expect(plano.precisaReprocessar).toBe(true)
    await processarComplementos(companyId, DIA, undefined, prisma)
    expect(await saldo(itemPorcao)).toBe(15) // 20 − (2+3)
  })
})

describe('⭐ o motor é o MESMO da baixa de produtos', () => {
  it('⭐ ficha de sabor com 2 componentes baixa os dois, na proporção', async () => {
    const molho = await prisma.stockItem.create({ data: { companyId, nome: 'MOLHO', unidadeControle: 'LT', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' } })
    await prisma.stockMovement.create({ data: { companyId, itemId: molho.id, tipo: 'ENTRADA_NF', quantidade: 5, custoUnitario: 20, custoTotal: 100, origem: 'SEFAZ' } })
    await prisma.stockFicha.update({ where: { id: fichaSabor }, data: { versaoAtual: 2 } })
    const v = await prisma.stockFichaVersao.create({ data: { companyId, fichaId: fichaSabor, versao: 2, loteBase: 1, unidadeLoteBase: 'UN' } })
    await prisma.stockFichaComponente.createMany({ data: [
      { companyId, versaoId: v.id, itemId: itemPorcao, qtdPlanejada: 1, unidade: 'UN', posicao: 0 },
      { companyId, versaoId: v.id, itemId: molho.id, qtdPlanejada: 0.02, unidade: 'LT', posicao: 1 },
    ] })

    await confirmarComplementos(companyId, DIA, html([['CALABRESA', 10]]), undefined, prisma)
    await processarComplementos(companyId, DIA, undefined, prisma)
    expect(await saldo(itemPorcao)).toBe(10)
    expect(await saldo(molho.id)).toBe(4.8) // 5 − 0,2
  })

  it('⛔ dia sem nenhuma ficha mapeada recusa com mensagem, sem gravar', async () => {
    await prisma.stockVendaComplementoMap.deleteMany({ where: { companyId } })
    await confirmarComplementos(companyId, DIA, html([['OREO', 3]]), undefined, prisma)
    await expect(processarComplementos(companyId, DIA, undefined, prisma)).rejects.toThrow(BaixaComplementoError)
    expect(await prisma.stockMovement.count({ where: { companyId, tipo: 'BAIXA_VENDA' } })).toBe(0)
  })
})

// ⭐⭐⭐ O GESTO ÚNICO (07/09/2026) — decisão do dono.
//
// *"O botão 'baixar' separado é estado intermediário que só serve pra ser esquecido — provou
// isso a semana inteira (dias 02–04 importados e nunca baixados)."*
//
// ⚠️ PADRÃO DO RECEBIMENTO: **commit + ponte**. As linhas gravam numa transação; a baixa vem
// DEPOIS. Se a ponte falhar, o import NÃO se desfaz — a tela avisa e o dia fica pendente.
describe('⭐⭐⭐ confirmar o import JÁ BAIXA', () => {
  it('⭐⭐⭐ linhas gravadas E consumo no ledger, num gesto só', async () => {
    const imp = await confirmarComplementos(companyId, DIA, html([['CALABRESA', 12]]), undefined, prisma)

    expect(imp.linhas).toBe(1)
    expect(imp.ocorrencias).toBe(12)
    // ⛔ o ledger na MESMA ação — era isto que ficava pra depois e não acontecia
    expect(imp.baixa, 'importou e não baixou: o passo esquecível voltou').not.toBeNull()
    expect(imp.baixa!.ocorrencias).toBe(12)
    expect(imp.avisoBaixa).toBeNull()
    expect(imp.baixaFalhou).toBe(false)
    expect(await saldo(itemPorcao)).toBe(8)

    const dias = await listarDiasComplemento(companyId, prisma)
    expect(dias[0].baixado, 'a lista de dias tem que nascer "baixado"').toBe(true)
    expect(dias[0].precisaReprocessar).toBe(false)
  })

  it('⛔ SEM DESTINO → zero movimento, e a frase explica (não é erro)', async () => {
    const imp = await confirmarComplementos(companyId, DIA, html([['MEXICANA', 9]]), undefined, prisma)
    expect(imp.linhas, 'o nome tem que entrar na prateleira mesmo sem destino').toBe(1)
    expect(imp.baixa).toBeNull()
    expect(imp.baixaFalhou, 'sem ficha NÃO é falha — é o trabalho de mapear').toBe(false)
    expect(imp.avisoBaixa).toMatch(/ficha/i)
    expect(await prisma.stockMovement.count({ where: { companyId, tipo: 'BAIXA_VENDA' } })).toBe(0)
  })

  it('⛔⛔ PERÍODO continua NUNCA baixando — a trava de 02/09 sobrevive ao gesto único', async () => {
    // ⚠️ é a armadilha registrada antes de existir: período baixando como dia mandaria as
    // ocorrências do MÊS INTEIRO ao ledger com cara de rotina.
    const imp = await confirmarComplementos(companyId, DIA, html([['CALABRESA', 500]]), undefined, prisma, 'PERIODO')
    expect(imp.modo).toBe('PERIODO')
    expect(imp.baixa, 'o período baixou o mês inteiro de uma vez').toBeNull()
    expect(imp.avisoBaixa).toMatch(/PER[IÍ]ODO/i)
    expect(await saldo(itemPorcao)).toBe(20)
  })

  it('⭐ e o PREVIEW mostra a baixa ANTES do clique — um preview, um clique, tudo', async () => {
    const prev = await previewComplementos(companyId, DIA, html([['CALABRESA', 12], ['MEXICANA', 9]]), prisma)
    expect(prev.baixa).not.toBeNull()
    expect(prev.baixa!.complementosComFicha, 'só CALABRESA tem ficha').toBe(1)
    expect(prev.baixa!.ocorrenciasQueBaixam).toBe(12)
    expect(prev.pendentes).toBe(1)
    expect(prev.baixa!.itens[0]).toMatchObject({ qtd: 12, saldoDepois: 8 })
    // ⛔ preview NÃO grava
    expect(await prisma.stockMovement.count({ where: { companyId, tipo: 'BAIXA_VENDA' } })).toBe(0)
  })

  it('⭐⭐ o número do PREVIEW é o mesmo que o ledger grava — um motor só', async () => {
    // ⚠️ um cálculo "só pro preview" faria a tela prometer um número e o ledger gravar outro:
    // é a doença que este módulo mais paga (os 7 detectores de transferência).
    const prev = await previewComplementos(companyId, DIA, html([['CALABRESA', 7]]), prisma)
    const imp = await confirmarComplementos(companyId, DIA, html([['CALABRESA', 7]]), undefined, prisma)
    expect(imp.baixa!.ocorrencias).toBe(prev.baixa!.ocorrenciasQueBaixam)
    expect(await saldo(itemPorcao)).toBe(prev.baixa!.itens[0].saldoDepois)
  })

  it('⛔⛔ a ponte falhando AVISA ALTO e não some — e o import fica de pé', async () => {
    // ⚠️ PADRÃO DO RECEBIMENTO: uma transação única jogaria fora um import legítimo por causa
    // de um problema na baixa, e o dono perderia o arquivo que acabou de subir.
    //
    // ⚠️ A falha é injetada num db DUCK-TYPED porque não existe estado de dado que faça a
    // baixa explodir de propósito — e inventar um seria testar a sabotagem, não a regra. O
    // que este teste executa é a BIFURCAÇÃO: erro previsto vira frase, erro inesperado vira
    // `falhou: true`.
    const dbQueExplode = {
      stockVendaComplementoLinha: { findMany: async () => { throw new Error('banco caiu no meio') } },
    } as unknown as Parameters<typeof baixarSeHouverFicha>[3]

    const r = await baixarSeHouverFicha(companyId, DIA, undefined, dbQueExplode)
    expect(r.recibo).toBeNull()
    expect(r.falhou, 'erro inesperado passou como "não tinha o que baixar"').toBe(true)
    expect(r.motivo).toMatch(/banco caiu/)
  })

  it('⭐ e a recusa PREVISTA não é falha — período e sem-ficha viram frase, não incidente', async () => {
    // ⛔ marcar as duas como falha faria a tela gritar no caminho NORMAL, e alarme falso
    // repetido mata o alarme.
    await confirmarComplementos(companyId, DIA, html([['MEXICANA', 3]]), undefined, prisma)
    const r = await baixarSeHouverFicha(companyId, DIA, undefined, prisma)
    expect(r.falhou).toBe(false)
    expect(r.motivo).toMatch(/ficha/i)
  })
})
