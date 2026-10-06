/**
 * ⛔⛔⛔ A CONTAGEM É A ÂNCORA — A LEI É GERAL, não um fix do fermento (05/10/2026).
 *
 * **Ordem do dono:** *"Toda contagem lançada ENTRA, sem exceção de estado do item: saldo
 * positivo, zero ou NEGATIVO (qtd e/ou R$). (…) Nenhum caminho termina em recusa."*
 *
 * ⚠️ REGRA 3: aqui a contagem **roda contra banco**, pelo `contarLinha` que a rota chama — não
 * por grep nem pela função pura (que tem teste próprio). É o que separa *"a régua está certa"*
 * de *"o caminho do dono funciona"*.
 *
 * ⛔ Os QUATRO estados são os que existem no mundo, e a prova é um `it` pra cada: saldo negativo
 * com dinheiro negativo (o fermento), saldo negativo com dinheiro POSITIVO (a ERVILHA — o
 * espelho real de prod), dinheiro negativo com saldo em pé (o estado que o guard de 11/09
 * nomeia) e item que **nunca teve compra**.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { criarMovimento, MovementInvalidError } from '@/lib/stock/movement'
import { contarLinha, ContagemError } from '@/lib/stock/contagem'
import { produzirAvisosDeEstoque, ORIGEM } from '@/lib/avisos/produtores/estoque'
import { registrarAviso, avisosAbertos } from '@/lib/avisos/central'
import { saldoItem } from '@/lib/stock/saldo'

const SUFIXO = `ancora-${Date.now()}`
let companyId = ''
let contagemId = ''

/** ⭐ um item por estado — a lei tem que valer nos quatro, não no caso que gritou */
const ids: Record<string, string> = {}

async function item(nome: string, categoria = 'MATERIA_PRIMA', unidade = 'KG') {
  const i = await prisma.stockItem.create({
    data: { companyId, nome, unidadeControle: unidade, categoria, criadoVia: 'MANUAL' },
    select: { id: true },
  })
  return i.id
}

beforeAll(async () => {
  const c = await prisma.company.create({ data: { name: `Empresa ${SUFIXO}`, cnpj: `79${Date.now()}`.slice(0, 14) } })
  companyId = c.id

  // (1) FERMENTO: saldo negativo COM dinheiro negativo — compra, depois consumo demais
  ids.fermento = await item('fermento')
  await criarMovimento(prisma, { companyId, itemId: ids.fermento, tipo: 'ENTRADA_NF', quantidade: 10, custoUnitario: 34, custoTotal: 340, origem: 'SEFAZ' })
  await criarMovimento(prisma, { companyId, itemId: ids.fermento, tipo: 'SEPARACAO_SAIDA', quantidade: -13.56, custoUnitario: 27.3938, custoTotal: -371.46, origem: 'MANUAL' })

  // (2) ERVILHA: saldo negativo com dinheiro POSITIVO — o espelho medido em prod
  ids.ervilha = await item('ERVILHA')
  await criarMovimento(prisma, { companyId, itemId: ids.ervilha, tipo: 'ENTRADA_NF', quantidade: 36, custoUnitario: 13.145, custoTotal: 473.22, origem: 'SEFAZ' })
  await criarMovimento(prisma, { companyId, itemId: ids.ervilha, tipo: 'SEPARACAO_SAIDA', quantidade: -114.39, custoUnitario: 0.0285, custoTotal: -3.26, origem: 'MANUAL' })

  /**
   * (3) ESPELHO: saldo EM PÉ com dinheiro negativo — o estado que o guard de 11/09 nomeia.
   *
   * ⛔⛔ ESTE ESTADO **NÃO NASCE** PELO `criarMovimento` — e é justamente isso que o guard de
   * 11/09 (`assertSaldoNaoFicaImpossivel`) garante desde a FANTA UVA. Então a cena tem que ser
   * montada por INSERT cru: é o jeito honesto de reproduzir o legado que entrou ANTES do guard
   * existir (medido em prod: itens nesse estado são anteriores a ele).
   *
   * ⚠️ E a cena **tem que existir**: a lei do dono diz *"saldo positivo, zero ou NEGATIVO (qtd
   * E/OU R$)"* — sem ela, o caso "dinheiro negativo com a prateleira cheia" nunca é exercido, e
   * era um dos quatro estados que o pedido nomeia. Montar pelo helper validado seria impossível;
   * não montar seria deixar um quarto da lei sem prova.
   */
  ids.espelho = await item('porcao chuleta', 'INTERMEDIARIO', 'UN')
  await criarMovimento(prisma, { companyId, itemId: ids.espelho, tipo: 'PRODUCAO_GERACAO', quantidade: 10, custoUnitario: 2, custoTotal: 20, origem: 'MANUAL' })
  await prisma.stockMovement.create({
    data: {
      companyId, itemId: ids.espelho, tipo: 'BAIXA_VENDA',
      // ⚠️ o CHECK do ledger continua valendo: |custoTotal − qtd×custoUnit| ≤ 0,01
      quantidade: -2, custoUnitario: 12.5, custoTotal: -25, origem: 'MANUAL',
    },
  })

  // (4) SEM CUSTO NENHUM: item que nunca teve compra nem produção com custo
  ids.semCusto = await item('tomate')
  await criarMovimento(prisma, { companyId, itemId: ids.semCusto, tipo: 'BAIXA_VENDA', quantidade: -5, custoUnitario: 0, custoTotal: 0, origem: 'MANUAL' })

  const s = await prisma.stockContagem.create({ data: { companyId, tipo: 'ROTINA', status: 'ABERTA' } })
  contagemId = s.id
})

afterAll(async () => {
  const ss = await prisma.stockContagem.findMany({ where: { companyId }, select: { id: true } })
  await prisma.stockContagemNegativo.deleteMany({ where: { contagemId: { in: ss.map((x) => x.id) } } })
  await prisma.stockContagemVersao.deleteMany({ where: { contagemId: { in: ss.map((x) => x.id) } } })
  await prisma.stockContagemItem.deleteMany({ where: { contagemId: { in: ss.map((x) => x.id) } } })
  await prisma.stockContagem.deleteMany({ where: { companyId } })
  await prisma.aviso.deleteMany({ where: { companyId } })
  await prisma.stockMovement.deleteMany({ where: { companyId } })
  await prisma.stockItem.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

const contar = (itemId: string, qtd: number, motivoDoNegativo?: string) =>
  contarLinha({ companyId, contagemId, itemId, qtdContada: qtd, confirmarFreio: true, motivoDoNegativo, viuSistema: true, observacao: null }, prisma)

describe('⛔⛔⛔ a lei vale nos QUATRO estados — nenhum termina em recusa', () => {
  it('⭐⭐ (1) saldo negativo COM dinheiro negativo: entra, e o custo renasce limpo', async () => {
    const antes = await saldoItem(prisma, companyId, ids.fermento)
    expect(antes.saldo, 'a cena existe mesmo').toBeLessThan(0)
    expect(antes.valor).toBeLessThan(0)

    const r = await contar(ids.fermento, 6, 'FICHA_ERRADA')
    expect(r.saldoDepois, 'o saldo VIRA o contado').toBe(6)
    const depois = await saldoItem(prisma, companyId, ids.fermento)
    expect(depois.saldo).toBeCloseTo(6, 1)
    expect(depois.valor, 'o dinheiro deixou de ser negativo').toBeGreaterThan(0)
    expect(depois.valor / 6, 'valorado no último custo CONHECIDO, não no médio podre').toBeCloseTo(34, 1)
    expect(r.residuoMovementId, 'o pendurado virou LINHA PRÓPRIA').toBeTruthy()
  })

  it('⭐⭐ (2) saldo negativo com dinheiro POSITIVO (a ERVILHA): entra e a ficção sai', async () => {
    const antes = await saldoItem(prisma, companyId, ids.ervilha)
    expect(antes.saldo).toBeLessThan(0)
    expect(antes.valor, 'dinheiro POSITIVO com saldo negativo — o espelho').toBeGreaterThan(0)

    const r = await contar(ids.ervilha, 10, 'NAO_SEI')
    const depois = await saldoItem(prisma, companyId, ids.ervilha)
    expect(depois.saldo).toBeCloseTo(10, 1)
    expect(depois.valor / 10, 'o custo volta ao da nota').toBeCloseTo(13.145, 1)
    expect(r.valoracao.residuo, 'a ficção foi escrita FORA do custo').toBeLessThan(0)
  })

  /**
   * ⚠️⚠️ ESTE É O ÚNICO ESTADO EM QUE A CONTAGEM **TIRA** DINHEIRO — e foi a REGRA 11 que me
   * obrigou a escrevê-lo assim.
   *
   * A 1ª versão contava **8 contra um saldo de 8**: divergência ZERO, nenhuma linha de
   * quantidade, e o teste passava **sem exercer a lei neste estado**. Pior: com ele, repor o
   * defeito *"`ancoraValorada` removido"* ficava **VERDE**, porque nos outros três estados a
   * contagem SOMA valor (`custoTotal > 0`) e o guard de 11/09 nem chega a olhar.
   *
   * ⭐ Contando **3** a divergência é −5 e o `AJUSTE_CONTAGEM` leva −R$ 10: no instante dele o
   * item fica com **saldo 3 e valor −15**, exatamente o estado que o guard chama de impossível.
   * É por isso que a lei precisa do `ancoraValorada` — e é só aqui que isso se prova.
   */
  it('⭐⭐ (3) dinheiro negativo com saldo EM PÉ: entra também — e aqui a contagem TIRA valor', async () => {
    const antes = await saldoItem(prisma, companyId, ids.espelho)
    expect(antes.saldo, 'saldo positivo').toBeGreaterThan(0)
    expect(antes.valor, 'e dinheiro negativo — o estado que 11/09 nomeia').toBeLessThan(0)

    const r = await contar(ids.espelho, 3, 'PERDA')
    expect(r.valoracao.divergencia, 'a contagem BAIXA a quantidade').toBeLessThan(0)
    expect(r.valoracao.custoTotal, 'e o ajuste leva dinheiro embora').toBeLessThan(0)
    const depois = await saldoItem(prisma, companyId, ids.espelho)
    expect(depois.saldo).toBeCloseTo(3, 1)
    expect(depois.valor, 'nunca mais negativo').toBeGreaterThan(0)
    expect(depois.valor / 3, 'o custo renasce no último conhecido').toBeCloseTo(2, 1)
    expect(r.residuoMovementId, 'a ficção saiu em linha própria').toBeTruthy()
  })

  /**
   * ⛔ **SEM CUSTO CONHECIDO O CUSTO É "A DEFINIR"** — e isso é honesto, não um buraco. Chutar
   * um número poria preço inventado na ficha e no CMV; a 1ª compra ensina o custo.
   */
  it('⛔ (4) item que nunca teve compra: entra com custo "a definir"', async () => {
    const r = await contar(ids.semCusto, 3, 'FALTA_LANCAMENTO')
    expect(r.valoracao.base).toBe('A_DEFINIR')
    const depois = await saldoItem(prisma, companyId, ids.semCusto)
    expect(depois.saldo).toBeCloseTo(3, 1)
    expect(depois.valor, 'zero é a ausência dita em voz alta, nunca negativo').toBe(0)
  })
})

describe('⛔⛔ O MOTIVO é PERGUNTA, não recusa — e nada grava antes da resposta', () => {
  it('⛔⛔ sem motivo: 409, com as opções, e o ledger INTACTO', async () => {
    const i = await item('BACON')
    await criarMovimento(prisma, { companyId, itemId: i, tipo: 'BAIXA_VENDA', quantidade: -4, custoUnitario: 0, custoTotal: 0, origem: 'MANUAL' })
    const antes = await prisma.stockMovement.count({ where: { companyId, itemId: i } })

    let capturado: unknown = null
    try { await contar(i, 2) } catch (e) { capturado = e }
    expect(capturado).toBeInstanceOf(ContagemError)
    expect((capturado as ContagemError & { code?: string }).code).toBe('MOTIVO_DO_NEGATIVO')
    expect((capturado as { motivos?: unknown[] }).motivos, 'pergunta sem respostas é beco').toHaveLength(4)
    expect(await prisma.stockMovement.count({ where: { companyId, itemId: i } }), 'nada se moveu').toBe(antes)

    // ⭐ e com a resposta, ENTRA
    const r = await contar(i, 2, 'NAO_SEI')
    expect(r.saldoDepois).toBe(2)
  })

  it('⛔ motivo fora da lista fechada não serve', async () => {
    const i = await item('SAL')
    await criarMovimento(prisma, { companyId, itemId: i, tipo: 'BAIXA_VENDA', quantidade: -1, custoUnitario: 0, custoTotal: 0, origem: 'MANUAL' })
    await expect(contar(i, 1, 'porque_eu_quis')).rejects.toThrow(/causou o negativo/i)
  })

  /** ⚠️ item SÃO não é importunado: a pergunta só existe onde há o que investigar */
  it('⭐ item em ordem NÃO pede motivo — a pergunta não vira pedágio', async () => {
    const i = await item('FARINHA')
    await criarMovimento(prisma, { companyId, itemId: i, tipo: 'ENTRADA_NF', quantidade: 20, custoUnitario: 5, custoTotal: 100, origem: 'SEFAZ' })
    const r = await contar(i, 18)
    expect(r.ok).toBe(true)
    expect(r.valoracao.eraNegativo).toBe(false)
    expect(r.valoracao.base, 'o caminho de todo dia usa o custo MÉDIO').toBe('CUSTO_MEDIO')
    expect(r.residuoMovementId, 'nenhuma linha de resíduo em item são').toBeNull()
  })
})

describe('⭐⭐ O RASTRO e o AVISO DE INVESTIGAÇÃO — o negativo não morre calado', () => {
  it('⭐ o rastro guarda o estado de ANTES e a causa; recontar é UPDATE', async () => {
    const i = await item('OVO', 'MATERIA_PRIMA', 'UN')
    await criarMovimento(prisma, { companyId, itemId: i, tipo: 'ENTRADA_NF', quantidade: 30, custoUnitario: 1, custoTotal: 30, origem: 'SEFAZ' })
    await criarMovimento(prisma, { companyId, itemId: i, tipo: 'BAIXA_VENDA', quantidade: -40, custoUnitario: 1, custoTotal: -40, origem: 'MANUAL' })

    await contar(i, 12, 'PERDA')
    let rastro = await prisma.stockContagemNegativo.findMany({ where: { contagemId, itemId: i } })
    expect(rastro).toHaveLength(1)
    expect(rastro[0].motivo).toBe('PERDA')
    expect(rastro[0].saldoAntes, 'o estado de antes fica congelado').toBeLessThan(0)

    /**
     * ⭐⭐ RECONTAR DEPOIS QUE A CONTAGEM ANCOROU **NÃO PEDE MOTIVO E NÃO REESCREVE O RASTRO** —
     * e isto é desenho, não omissão.
     *
     * ⚠️ Eu havia afirmado aqui *"a causa nova substitui"*. **O dado me corrigiu:** depois da 1ª
     * contagem o item está em 12 UN com dinheiro em pé, então a 2ª contagem é uma contagem de
     * TODO DIA — o `eraNegativo` é falso e o bloco do rastro nem roda. ⭐ E é o certo: o rastro
     * registra **o negativo que existiu** com a causa nomeada *naquele instante*; sobrescrevê-lo
     * com a causa de uma contagem SÃ reescreveria a história que o aviso de investigação existe
     * pra contar. A linha continua UMA (o unique), congelada no fato.
     */
    const r2 = await contar(i, 14)
    expect(r2.valoracao.eraNegativo, 'a 1ª contagem já ancorou o item').toBe(false)
    rastro = await prisma.stockContagemNegativo.findMany({ where: { contagemId, itemId: i } })
    expect(rastro, 'o unique impede a 2ª linha').toHaveLength(1)
    expect(rastro[0].motivo, 'a causa do NEGATIVO fica congelada').toBe('PERDA')
    expect(rastro[0].saldoAntes, 'e o estado de antes também').toBeLessThan(0)
  })

  it('⭐⭐ o aviso nasce no setor ESTOQUE, âmbar, com o link do histórico', async () => {
    const abertos = await avisosAbertos(companyId)
    const meus = abertos.filter((a) => a.origem === ORIGEM)
    expect(meus.length, 'os negativos contados viraram investigação').toBeGreaterThan(0)
    const a = meus[0]
    expect(a.setor).toBe('estoque')
    // ⛔ âmbar, não vermelho: o dado NÃO está errado agora — a contagem o ancorou
    expect(a.severidade).toBe('ambar')
    expect(a.acaoHref, 'o aviso leva DIRETO ao histórico').toContain('/estoque/itens/')
    expect(a.corpo, 'a causa que a pessoa nomeou fica à vista').toMatch(/Quem contou achou que foi/)
  })

  /**
   * ⛔⛔ A RÉGUA ANTI-SPAM: **uma causa, um alarme.** Se a causa já tem aviso aberto (a ficha
   * na fila de conversão), este cala — mandar o dono olhar a mesma coisa por outra porta é como
   * *alarme falso repetido mata o alarme* (os 111 do juiz de vendas).
   */
  it('⛔⛔ se a causa JÁ tem aviso aberto, o de investigação CALA', async () => {
    const i = await item('QUEIJO')
    await criarMovimento(prisma, { companyId, itemId: i, tipo: 'BAIXA_VENDA', quantidade: -7, custoUnitario: 0, custoTotal: 0, origem: 'MANUAL' })
    await contar(i, 2, 'FICHA_ERRADA')

    // a causa ganha aviso por OUTRA origem (a fila de conversão de ficha)
    await registrarAviso({
      companyId, setor: 'producao', severidade: 'ambar',
      titulo: 'Confere a receita do QUEIJO',
      corpo: 'A ficha declara o lote em KG e o produto se conta em UN.',
      // ⚠️ o texto é o do produtor REAL (`producao.ts`), não um inventado meu: fixture que não
      //    reproduz o aviso de verdade testaria uma supressão que não existe em prod.
      oQueFazer: 'Abra a fila de conversão e conserte quantas unidades saem de uma receita — ela mostra o antes e o depois, e digitar o lote de hoje não mexe no estoque.',
      origem: 'FICHA_SEM_COMPARACAO', alvo: `item:${i}`,
    })

    const r = await produzirAvisosDeEstoque(companyId)
    expect(r.calados.some((c) => c.item === 'QUEIJO'), 'a supressão aconteceu').toBe(true)
    const abertos = await avisosAbertos(companyId)
    expect(
      abertos.filter((a) => a.origem === ORIGEM && a.alvo === `item:${i}`),
      'nenhum aviso duplicado pra a mesma causa',
    ).toHaveLength(0)
  })
})

describe('⛔⛔⛔ e o guard de 11/09 CONTINUA de pé pra escrita crua', () => {
  /**
   * ⚠️⚠️ **A LEI É DO GESTO DE CONTAR, não de escrita crua no ledger** — e isto é o caso FANTA
   * UVA: a contagem de **+1.496 a R$ 0,00** deixou *"4 un · −R$ 10.160,52"*, o custo médio
   * virou **−R$ 2.540,13** e contaminou Posição, cardápio (margem 5218%) e CMV. Script ou
   * caminho novo que grave contagem **sem passar pela valoração** recria exatamente aquilo.
   */
  it('⛔⛔ AJUSTE_CONTAGEM a custo ZERO, por fora da valoração, continua RECUSADO', async () => {
    const i = await item('FANTA UVA 2L', 'REVENDA', 'UN')
    await criarMovimento(prisma, { companyId, itemId: i, tipo: 'ENTRADA_NF', quantidade: 7, custoUnitario: 6.81, custoTotal: 47.67, origem: 'SEFAZ' })
    await criarMovimento(prisma, { companyId, itemId: i, tipo: 'BAIXA_VENDA', quantidade: -1499, custoUnitario: 6.81, custoTotal: -10208.19, origem: 'MANUAL' })

    await expect(criarMovimento(prisma, {
      companyId, itemId: i, tipo: 'AJUSTE_CONTAGEM', quantidade: 1496, custoUnitario: 0, custoTotal: 0, origem: 'MANUAL',
    })).rejects.toBeInstanceOf(MovementInvalidError)

    // ⭐ e o MESMO item, contado pelo GESTO, entra — a lei vale onde ela tem que valer
    const r = await contar(i, 4, 'FALTA_LANCAMENTO')
    expect(r.saldoDepois).toBe(4)
    const s = await saldoItem(prisma, companyId, i)
    expect(s.valor, 'e o custo médio NUNCA fica negativo').toBeGreaterThanOrEqual(0)
  })
})
