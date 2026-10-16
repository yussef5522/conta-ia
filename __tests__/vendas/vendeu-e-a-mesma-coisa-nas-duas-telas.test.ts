/**
 * ⛔⛔⛔ "VENDEU" É A MESMA COISA NAS DUAS TELAS — AO CENTAVO (10/10/2026).
 *
 * ⚠️⚠️ **A DEFINIÇÃO MUDOU EM 16/10, E ESTE ARQUIVO FOI ATUALIZADO COM O MOTIVO ESCRITO.**
 *
 * **Até 11/10 (a lei velha, do dono):** *"VENDEU = produtos + complementos cobrados — o
 * dinheiro que o cliente pagou."*
 *
 * **Desde 16/10 (a lei nova, do dono):**
 * > *"relatorio de produtos ja vem total que foi vendido. a gente baixa relatorio
 * > complementos SO pra pegar os sabores de pizza e cocas que sairam. valor de venda mesmo
 * > so vem de 1 relatorio: produtos."*
 *
 * ⛔⛔ **POR QUE ELA VIROU:** o estudo de 16/10 mediu que adicional/borda **já entra no
 * `valorTotal` da linha de PRODUTOS** (é o que faz o preço praticado de uma pizza grande sair
 * ~17% acima da tabela). Somar o complemento por cima era contar o mesmo dinheiro **2×**:
 * ```
 *   06/10   produtos 15.873,77 + complementos 1.228,86 = 17.102,63   ⛔ dupla contagem
 *   06/10   VENDEU = 15.873,77                                        ⭐ a lei nova
 *   outubro 292.099,08 (produtos) × 312.902,47 (a soma velha) → 20.803,39 contados 2×
 * ```
 *
 * ⭐⭐ **A PERGUNTA DO GUARD NÃO MUDOU** — *"as duas telas dizem o MESMO número pro MESMO
 * dia?"*. ***Duas telas com números diferentes pro mesmo dia é a doença que esta casa mais
 * paga*** (os três agostos, os 111 alarmes falsos, o badge sem os lotes). O que mudou é **qual**
 * é o número, e ele agora mora num lugar só: `totaisDoPdvPorDia.vendeu`.
 *
 * ⚠️ É teste de INTEGRAÇÃO contra banco porque é exatamente o encaixe que importa: um teste
 * puro sobre `totaisDoPdvPorDia` passaria verde com uma das telas ignorando o dono (a lição
 * do *"guard que testa a lib aprova a tela que a ignora"*, 14/09).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { totaisDoPdvPorDia } from '@/lib/stock/vendas/total-do-pdv'
import { lerCentralDeImport } from '@/lib/stock/vendas/central-de-import'
import { montarDias, montarCartoes } from '@/lib/vendas/dia-a-dia'
import { janelaDoMes } from '@/lib/periodo/mes-corrente'

const CNPJ = '77665544000133'
let companyId = ''

/** ⭐ o dado real de outubro: produto + complemento no mesmo dia, como em prod */
const DIAS = [
  { dia: '2026-10-06', produtos: 15_873.77, complementos: 1_228.86, un: 515 },
  { dia: '2026-10-07', produtos: 15_207.36, complementos: 1_018.09, un: 431 },
  // ⚠️ um dia SEM complemento — a borda em que os dois números coincidem
  { dia: '2026-10-08', produtos: 15_657.01, complementos: 0, un: 402 },
]
const dt = (s: string, h: string) => new Date(`${s}T${h}`)

beforeAll(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({
    data: { name: 'vendeu-mesma-coisa', cnpj: CNPJ, state: 'RS' },
  })
  companyId = c.id

  for (const d of DIAS) {
    /**
     * ⚠️ AS CONVENÇÕES DE HORA DOS DOIS WRITERS SÃO DIFERENTES, e isso entra na fixture de
     * propósito: linha de PRODUTO grava **15:00:00Z** e COMPLEMENTO grava **00:00:00Z**.
     * Fixture com a mesma hora nos dois esconderia a cicatriz de 14/09 (a revisão do import
     * devolvendo *"0 nomes"* num dia com 130 linhas) em vez de testá-la.
     */
    await prisma.stockVendaImport.create({
      data: {
        companyId, data: dt(d.dia, '15:00:00.000Z'), status: 'CONFIRMADO',
        totalLinhas: 1, totalUnidades: d.un,
      },
    })
    await prisma.stockVendaLinha.create({
      data: {
        companyId, data: dt(d.dia, '15:00:00.000Z'), importId: `i-${d.dia}`,
        nomeSuitable: 'XIS COMPLETO', quantidade: d.un, valorTotal: d.produtos,
      },
    })
    if (d.complementos > 0) {
      await prisma.stockVendaComplementoLinha.create({
        data: {
          companyId, data: dt(d.dia, '00:00:00.000Z'), importId: `comp-${d.dia}`,
          nomeSuitable: 'BORDA CATUPIRY', ocorrencias: 40, valorTotal: d.complementos,
        },
      })
    }
  }
})

afterAll(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
})

describe('⛔⛔⛔ as duas telas, a mesma definição', () => {
  it('⭐⭐ o total do dia na tela de VENDAS == o total do dia na CENTRAL, AO CENTAVO', async () => {
    /**
     * ⚠️ A JANELA VEM DO DONO DELA (`janelaDoMes`), não de dois literais. Dois motivos, e
     * o 2º é o que me pegou: (a) REGRA 4 — escrever `2026-11-01` à mão aqui é a 2ª régua
     * do fim-exclusivo do mês, a mesma que o código de produção já deriva; (b) o guard
     * `sem-data-fixa-no-futuro` reprovou o literal, e com razão — **data fixa adiante do
     * relógio em posição de `ate` é contagem regressiva**, ainda que aqui ela só alimente
     * uma query. ⭐ `janelaDoMes('2026-10')` devolve 01/10 → 01/11 (exclusivo), igual.
     */
    const { de, ate } = janelaDoMes('2026-10')

    // ── a tela de VENDAS, pelo caminho dela
    const pdv = await totaisDoPdvPorDia(companyId, de, ate, prisma)
    const dias = montarDias({
      de: '2026-10-01', ate: '2026-10-31',
      pdv: new Map([...pdv].map(([k, v]) => [k, v])),
      extrato: [], hoje: '2026-10-20', moduleInicio: '2026-08-01',
    })

    // ── a CENTRAL, pelo caminho dela
    const central = await lerCentralDeImport(companyId, '2026-10', prisma, '2026-10-20')

    for (const d of DIAS) {
      const naVendas = dias.find((x) => x.dia === d.dia)!
      const naCentral = central.dias.find((x) => x.dia === d.dia)!
      expect(naVendas.total, `${d.dia} na tela de Vendas`).toBeCloseTo(d.produtos, 2)
      expect(naCentral.valor, `${d.dia} na central`).toBeCloseTo(d.produtos, 2)
      expect(naCentral.valor, `${d.dia}: as duas telas`).toBeCloseTo(naVendas.total!, 2)
      /**
       * ⛔⛔ O CONTRAFACTUAL DA LEI VELHA — sem ele os dois `expect` de cima passariam num
       * mundo em que `complementos` é sempre 0, e o guard viraria enfeite no dia em que
       * alguém somasse de novo num dia sem adicional.
       */
      if (d.complementos > 0) {
        const somaVelha = d.produtos + d.complementos
        expect(naVendas.total, `${d.dia}: a dupla contagem NÃO voltou na tela`).not.toBeCloseTo(somaVelha, 2)
        expect(naCentral.valor, `${d.dia}: nem na central`).not.toBeCloseTo(somaVelha, 2)
      }
    }
  })

  it('⭐ a CENTRAL diz a composição — e `valor` == produtos, com o complemento ao lado', async () => {
    const central = await lerCentralDeImport(companyId, '2026-10', prisma, '2026-10-20')
    for (const d of DIAS) {
      const x = central.dias.find((y) => y.dia === d.dia)!
      expect(x.valorProdutos).toBeCloseTo(d.produtos, 2)
      expect(x.valorComplementos, 'continua visível — é conferência do import').toBeCloseTo(d.complementos, 2)
      expect(x.valor, 'VENDEU == produtos').toBeCloseTo(x.valorProdutos, 2)
    }
  })

  /**
   * ⛔⛔⛔ A CONFERÊNCIA DO ARQUIVO É **SÓ DE PRODUTOS** — e isto continua sendo a metade que
   * impede o conserto de virar alarme falso diário. `conferencia.somaGravada` é comparada com
   * o `somaValor` que **o arquivo de PRODUTOS declarou**; somar o complemento ali faria a
   * central acusar divergência em TODO dia com adicional.
   *
   * ⚠️ Desde 16/10 `somaGravada` e `valor` são o MESMO número (os dois são produtos), então
   * o `not.toBeCloseTo` de antes deixou de distinguir qualquer coisa. **O que morde agora é o
   * contrafactual:** a conferência nunca pode virar `produtos + complementos`. ⛔ O relatório
   * de complementos **não declara total** (34% das linhas valem R$ 0,00), então não existe
   * lado do arquivo pra conferir contra.
   */
  it('⛔⛔ `conferencia.somaGravada` é SÓ PRODUTOS — nunca produtos + complementos', async () => {
    const central = await lerCentralDeImport(companyId, '2026-10', prisma, '2026-10-20')
    const x = central.dias.find((y) => y.dia === '2026-10-06')!
    expect(x.conferencia.somaGravada, 'a conferência compara com o arquivo de PRODUTOS')
      .toBeCloseTo(15_873.77, 2)
    expect(x.conferencia.somaGravada, 'o complemento não entra na conferência')
      .not.toBeCloseTo(15_873.77 + 1_228.86, 2)
  })

  it('⭐ dia SEM complemento: nada muda (a borda que prova que a régua é uma só)', async () => {
    const central = await lerCentralDeImport(companyId, '2026-10', prisma, '2026-10-20')
    const x = central.dias.find((y) => y.dia === '2026-10-08')!
    expect(x.valorComplementos).toBe(0)
    expect(x.valor).toBeCloseTo(x.valorProdutos, 2)
  })

  /**
   * ⛔⛔ O VERMELHO DO DONO: *"a central mostra o Σ dos complementos como conferência de
   * import, COM RÓTULO CLARO de que ele NÃO SOMA"*.
   *
   * ⚠️ E a asserção é ESTRUTURAL (sem jsdom não dá pra renderizar), lendo a fonte do
   * componente — o que ela trava é a tela DESENHAR, não só o payload carregar. ⭐ Ela tem
   * DUAS metades, e a segunda é a que importa: o rótulo mentiroso (*"total"* sobre a soma dos
   * dois) **não pode voltar**. Guard que só afirma a presença aprovaria o dia em que a frase
   * velha renascer ao lado da nova.
   */
  it('⛔⛔ a tela da central DIZ "vendeu" e DIZ que o complemento não soma', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const { semComentarios } = await import('../regras-ui/_leitura-de-fonte')
    const tela = semComentarios(
      readFileSync(join(process.cwd(), 'components/estoque/central-de-import.tsx'), 'utf8'),
    )
    expect(tela, 'o rótulo de VENDEU').toContain('vendeu ${brl(d.valor)}')
    expect(tela, 'o Σ do complemento, como conferência').toContain('${brl(d.valorComplementos)}')
    expect(tela, 'e dizendo por escrito que ele não soma').toContain('não soma na venda')
    // ⛔ o rótulo da lei velha não volta
    expect(tela, 'o "total" da soma dos dois MORREU').not.toContain('total ${brl(d.valor)}')
  })

  /**
   * ⛔⛔⛔ O GUARD QUE IMPEDE A 2ª SOMA DE RENASCER (REGRA 4). As duas telas têm que
   * **CONSUMIR** `totaisDoPdvPorDia`; somar `valorTotal` por conta própria em qualquer uma
   * delas é a 2ª derivação da mesma pergunta, e ela diverge no 1º caso de borda.
   */
  it('⛔⛔ nenhuma das duas soma `valorTotal` por conta própria', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const { semComentarios, usosDe } = await import('../regras-ui/_leitura-de-fonte')

    const central = semComentarios(
      readFileSync(join(process.cwd(), 'lib/stock/vendas/central-de-import.ts'), 'utf8'),
    )
    expect(usosDe(central, 'totaisDoPdvPorDia'), 'a central consome o dono do dinheiro')
      .toBeGreaterThan(0)
    expect(central, 'a central voltou a somar valor no laço').not.toMatch(/\+=\s*l\.valorTotal/)
    expect(central, 'a central voltou a somar complemento no laço').not.toMatch(/\+=\s*c\.valorTotal/)
    /**
     * ⛔⛔ E A 2ª DEFINIÇÃO DE "VENDEU" TAMBÉM NÃO VOLTA. Até 16/10 esta linha era
     * `valor: round2(vProd + vComp)` — a central somando por conta própria. **Era ela que
     * permitiu as duas telas divergirem em primeiro lugar**: a definição existia em dois
     * lugares, e cada um respondeu uma coisa.
     */
    expect(central, 'a central voltou a definir "vendeu" na mão').not.toMatch(/vProd\s*\+\s*vComp/)
    expect(central, 'e consome o `vendeu` da porta').toMatch(/t\?\.vendeu/)

    const rota = semComentarios(
      readFileSync(join(process.cwd(), 'app/api/empresas/[id]/vendas/route.ts'), 'utf8'),
    )
    expect(usosDe(rota, 'totaisDoPdvPorDia'), 'a tela de Vendas consome o MESMO dono')
      .toBeGreaterThan(0)
  })

  /**
   * ⛔⛔⛔ A VARREDURA DOS CONSUMIDORES (REGRA 4) — *"VENDEU somando complementos em QUALQUER
   * consumidor = vermelho"*, ordem do dono.
   *
   * ⭐ Os dois `expect` acima olham a central e a rota de Vendas; **este olha a lista fechada
   * de TODO leitor da porta**. É o que impede o conserto de valer em 2 de 6 lugares — e
   * *"corrigir N−1 é pior que não corrigir nenhum: o sistema fica com metade das telas certas
   * e nenhum alarme"* (a lição dos três agostos, 26/08).
   *
   * ⚠️ A régua é a FORMA de somar os dois campos (`produtos` com `complementos`), não a
   * menção deles: a composição **tem** que continuar viajando — é ela que faz a tela DIZER o
   * que soma. O proibido é o `+`.
   */
  it('⛔⛔⛔ nenhum consumidor da porta soma produtos + complementos', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const { semComentarios } = await import('../regras-ui/_leitura-de-fonte')

    /** os 6 leitores de `totaisDoPdvPorDia`/da composição, por caminho inteiro */
    const CONSUMIDORES = [
      'lib/stock/vendas/central-de-import.ts',
      'lib/vendas/dia-a-dia.ts',
      'lib/balance/mesa-de-operacoes.ts',
      'app/api/empresas/[id]/vendas/route.ts',
      'app/(dashboard)/empresas/[id]/vendas/page.tsx',
      'components/estoque/central-de-import.tsx',
    ]

    /**
     * ⛔ A soma proibida, em qualquer ordem e com qualquer prefixo de objeto:
     * `produtos + complementos`, `vProd + vComp`, `valorProdutos + valorComplementos`,
     * `x.produtos + x.complementos`, `prod + comp`.
     */
    const SOMA_PROIBIDA =
      /\b(?:\w+\.)?(?:v(?:alor)?)?[Pp]rod(?:utos?)?\b\s*\+\s*(?:\w+\.)?(?:v(?:alor)?)?[Cc]omp(?:lementos?)?\b|\b(?:\w+\.)?(?:v(?:alor)?)?[Cc]omp(?:lementos?)?\b\s*\+\s*(?:\w+\.)?(?:v(?:alor)?)?[Pp]rod(?:utos?)?\b/

    for (const f of CONSUMIDORES) {
      const src = semComentarios(readFileSync(join(process.cwd(), f), 'utf8'))
      expect(src, `${f} voltou a somar produtos + complementos`).not.toMatch(SOMA_PROIBIDA)
    }
  })

  /**
   * ⭐ AUTO-TESTE DO DETECTOR (REGRA 11) — sem ele o guard de cima passaria por **cegueira**,
   * e esta casa já pagou isso 7 vezes. Ele tem que pegar as formas reais que o código usava.
   */
  it('⭐ o detector da soma proibida reconhece as formas que existiam no código', async () => {
    const SOMA_PROIBIDA =
      /\b(?:\w+\.)?(?:v(?:alor)?)?[Pp]rod(?:utos?)?\b\s*\+\s*(?:\w+\.)?(?:v(?:alor)?)?[Cc]omp(?:lementos?)?\b|\b(?:\w+\.)?(?:v(?:alor)?)?[Cc]omp(?:lementos?)?\b\s*\+\s*(?:\w+\.)?(?:v(?:alor)?)?[Pp]rod(?:utos?)?\b/
    // as 4 formas que realmente estiveram no repo até 11/10
    expect('valor: round2(vProd + vComp),').toMatch(SOMA_PROIBIDA)
    expect('a.total = round2(a.produtos + a.complementos)').toMatch(SOMA_PROIBIDA)
    expect('formatBRL(prod + comp)').toMatch(SOMA_PROIBIDA)
    expect('x.valorProdutos + x.valorComplementos').toMatch(SOMA_PROIBIDA)
    // ⚠️ e NÃO morde a composição viajando (que tem que continuar)
    expect('produtos: v.produtos, complementos: v.complementos').not.toMatch(SOMA_PROIBIDA)
    expect('expect(x.valorComplementos).toBe(0)').not.toMatch(SOMA_PROIBIDA)
  })
})

/**
 * ⛔⛔⛔ O RECEBIDO LÊ O MESMO CONJUNTO QUE O MOTOR CLASSIFICA COMO VENDA (10/10).
 *
 * **Ordem do dono:** *"recebido pela porta única da lógica reaproveitada (teste: forma antiga
 * e nova devolvem o mesmo conjunto)"*.
 *
 * ⭐ A "lógica reaproveitada" é `computeExpectedVendas` — e a régua dela é dura: **só conta com
 * `RegraRecebimento`** e **só categoria `RECEITA_BRUTA`**, ***pela CATEGORIA do dono, nunca
 * pelo memo do banco*** (a régua de 17/08). O recebido **não reclassifica nada**: ele soma a
 * `VendaDiaria` que aquele motor gravou.
 *
 * ⛔⛔ E O TESTE PROVA O ENCAIXE, não a lib: ele monta transações reais (uma em conta COM
 * regra e categoria de venda, uma em conta SEM regra, uma de categoria que NÃO é venda, e um
 * ESTORNO), roda o motor, e exige que o recebido devolva **exatamente** a soma das que o
 * motor aceitou. ⚠️ Um teste puro sobre `montarFaixa` passaria verde com o motor mudando de
 * régua embaixo — é a lição do *"guard que testa a lib aprova a tela que a ignora"*.
 */
describe('⛔⛔⛔ o recebido × o motor de vendas — o mesmo conjunto', () => {
  const CNPJ2 = '77665544000299'
  let co2 = ''
  let contaComRegra = ''
  let contaSemRegra = ''
  let catVenda = ''
  let catEstorno = ''
  let catNaoVenda = ''

  beforeAll(async () => {
    await prisma.company.deleteMany({ where: { cnpj: CNPJ2 } })
    const c = await prisma.company.create({ data: { name: 'recebido-encaixe', cnpj: CNPJ2, state: 'RS' } })
    co2 = c.id

    const b1 = await prisma.bankAccount.create({
      data: { companyId: co2, name: 'stone', bankCode: '197', accountNumber: '1' },
    })
    const b2 = await prisma.bankAccount.create({
      data: { companyId: co2, name: 'conta sem regra', bankCode: '000', accountNumber: '2' },
    })
    contaComRegra = b1.id
    contaSemRegra = b2.id

    /**
     * ⭐ D+0 corrido: a competência é o próprio dia — mantém a fixture legível.
     * ⚠️ A regra PERTENCE a um `PerfilRecebimento` (1 por empresa) — li o erro do Prisma em
     * vez de chutar o campo, que é a cicatriz de sempre.
     */
    const perfil = await prisma.perfilRecebimento.create({ data: { companyId: co2 } })
    await prisma.regraRecebimento.create({
      data: {
        perfilId: perfil.id,
        companyId: co2, bankAccountId: b1.id, meio: 'PIX', diasUteisAtraso: 0,
        recebeSabDom: true, vigenteDe: new Date('2026-10-01T00:00:00.000Z'), confirmadoPeloDono: true,
      },
    })

    const cv = await prisma.category.create({
      data: { companyId: co2, name: 'Receita de Vendas', type: 'INCOME', dreGroup: 'RECEITA_BRUTA' },
    })
    const ce = await prisma.category.create({
      data: { companyId: co2, name: 'Estorno de venda (dinheiro)', type: 'INCOME', dreGroup: 'RECEITA_BRUTA' },
    })
    const cn = await prisma.category.create({
      data: { companyId: co2, name: 'Aporte de Capital', type: 'INCOME', dreGroup: 'APORTES_CAPITAL' },
    })
    catVenda = cv.id; catEstorno = ce.id; catNaoVenda = cn.id

    const tx = (bankAccountId: string, categoryId: string, amount: number, type: 'CREDIT' | 'DEBIT') =>
      prisma.transaction.create({
        data: {
          bankAccountId, categoryId, amount, type,
          date: new Date('2026-10-06T12:00:00.000Z'),
          description: 'fixture', lifecycle: 'EFFECTED', origin: 'MANUAL',
        },
      })

    await tx(contaComRegra, catVenda, 1_000, 'CREDIT')     // ⭐ ENTRA
    await tx(contaComRegra, catEstorno, 150, 'DEBIT')      // ⭐ ENTRA, subtraindo
    await tx(contaSemRegra, catVenda, 9_999, 'CREDIT')     // ⛔ FORA (conta sem regra)
    await tx(contaComRegra, catNaoVenda, 7_777, 'CREDIT')  // ⛔ FORA (não é RECEITA_BRUTA)

    const { recomputeVendas } = await import('@/lib/vendas/recompute-vendas')
    await recomputeVendas(prisma, co2, new Date('2026-10-01T00:00:00.000Z'))
  })

  afterAll(async () => {
    await prisma.company.deleteMany({ where: { cnpj: CNPJ2 } })
  })

  it('⭐⭐ o recebido == a soma do que o MOTOR aceitou — nem mais, nem menos', async () => {
    const { montarFaixa } = await import('@/lib/vendas/recebido')
    const linhas = await prisma.vendaDiaria.findMany({
      where: { companyId: co2 },
      select: { dataCompetencia: true, dataCompetenciaFim: true, valorLiquido: true, meio: true },
    })
    const f = montarFaixa({
      vendido: 2_000, linhas, de: '2026-10-01', ate: '2026-10-31', extratoAte: null,
    })
    // ⭐ 1.000 de venda − 150 de estorno = 850. Os 9.999 e os 7.777 ficaram FORA.
    expect(f.recebido, 'venda − estorno, sem a conta sem regra e sem o aporte').toBeCloseTo(850, 2)
    expect(f.aCaminho).toBeCloseTo(1_150, 2)
  })

  /**
   * ⛔⛔ OS CONTRAFACTUAIS — sem eles o teste de cima passaria num mundo em que a régua do
   * motor é "qualquer crédito", e aí o recebido inflaria com aporte e transferência.
   */
  it('⛔⛔ crédito em conta SEM regra de recebimento NÃO entra', async () => {
    const vinculadas = await prisma.vendaDiariaTransacao.findMany({
      where: { venda: { companyId: co2 } },
      select: { transactionId: true },
    })
    const ids = new Set(vinculadas.map((v) => v.transactionId))
    const daSemRegra = await prisma.transaction.findMany({
      where: { bankAccountId: contaSemRegra }, select: { id: true },
    })
    for (const t of daSemRegra) {
      expect(ids.has(t.id), 'a conta sem regra não produz venda').toBe(false)
    }
  })

  it('⛔⛔ crédito de categoria que NÃO é RECEITA_BRUTA não entra (o aporte)', async () => {
    const vinculadas = await prisma.vendaDiariaTransacao.findMany({
      where: { venda: { companyId: co2 } }, select: { transactionId: true },
    })
    const ids = new Set(vinculadas.map((v) => v.transactionId))
    const aporte = await prisma.transaction.findFirst({
      where: { bankAccountId: contaComRegra, categoryId: catNaoVenda }, select: { id: true },
    })
    expect(ids.has(aporte!.id), 'aporte não é venda — é dívida/capital entrando').toBe(false)
  })

  /**
   * ⭐ E O ESTORNO ENTRA COM SINAL, não por um ramo próprio — é o que o comentário da
   * interface `LinhaRecebida` afirma, provado contra o motor real.
   */
  it('⭐ o estorno entra na VendaDiaria com valor NEGATIVO', async () => {
    const neg = await prisma.vendaDiaria.findMany({
      where: { companyId: co2, valorLiquido: { lt: 0 } }, select: { valorLiquido: true, tipo: true },
    })
    expect(neg.length, 'o motor gravou o estorno').toBeGreaterThan(0)
    expect(neg.reduce((a, x) => a + x.valorLiquido, 0)).toBeCloseTo(-150, 2)
  })
})
