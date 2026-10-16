/**
 * ⭐⭐⭐ **A FITA COMPLETA — OS 3 BALDES QUE ESTAVAM VAZIOS (16/10/2026).**
 *
 * **O defeito:** a fita do dia nasceu em 15/10 com `lotesConferidos`, `contasPagas` e `avisos`
 * em `[]` — as portas existiam (o carimbo de quatro olhos, o `whereDoStatus('PAGA')`, a central
 * de avisos) e **ninguém as chamava**. ⚠️ Enquanto estivessem vazios a fita mostrava MENOS do
 * que o dia teve: ela não INVENTAVA evento, mas também **não era a fita completa**.
 *
 * ⚠️⚠️ **E o comentário deles MENTIA**, o que é pior que o buraco: afirmava que a ausência
 * estava *"DITA em `naoAlcancado`"*, e a prova em prod mediu **`naoAlcancado: []`**. ⛔ Eles
 * NÃO podiam entrar ali — aquele campo significa *"a porta CAIU"*, e 3 entradas permanentes
 * apareceriam **todo dia, pra sempre**, treinando o dono a não ler a lista. *"Não construí
 * ainda"* e *"a porta caiu"* são estados diferentes.
 *
 * ⛔⛔ **A RÉGUA DO DONO, nas duas direções:**
 *   · **balde VAZIO com evento REAL na porta = VERMELHO** — é o que este arquivo mede, e ele
 *     mede **rodando `lerMesaDeOperacoes` contra o banco**. Um teste do `montarFita` puro seria
 *     o *"guard que testa a lib e aprova a tela que a ignora"*: o módulo da fita estava CERTO
 *     o tempo todo (ele traduz o que recebe); quem entregava `[]` era a mesa.
 *   · **evento SEM porta = VERMELHO** — e aqui a trava é de **TIPO**, não deste teste:
 *     `TipoDeEvento` é união FECHADA com a porta de cada membro escrita ao lado, então inventar
 *     uma linha de fita **não compila**. O que o teste acrescenta é a outra metade: que a mesa
 *     **não fabrica** evento por fora (nenhum `tipo:` nasce lá).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { lerMesaDeOperacoes } from '../mesa-de-operacoes'

const CNPJ = '51525354000176'
let companyId: string
let supplierId: string
let categoryId: string
let itemId: string
let ordemId: string
let conclusaoId: string

/** ⚠️ relógio real — data fixa no futuro é bomba de calendário (REGRA 12) */
const AGORA = new Date()
const diaBrasil = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
const HOJE = diaBrasil(AGORA)
/** o instante de hoje que a mesa recorta: `[00:00Z do dia, +24h)` */
const hojeAs = (h: number) => new Date(`${HOJE}T${String(h).padStart(2, '0')}:00:00.000Z`)
const ONTEM = new Date(new Date(`${HOJE}T00:00:00.000Z`).getTime() - 86_400_000)

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'EMPRESA DA FITA' } })).id
  supplierId = (
    await prisma.supplier.create({ data: { companyId, razaoSocial: 'FORNECEDOR DA FITA' } })
  ).id
  categoryId = (
    await prisma.category.create({
      data: { companyId, name: 'Matéria-Prima da Fita', type: 'EXPENSE', dreGroup: 'CUSTO_MERCADORIA' },
    })
  ).id

  // a cadeia que o nome do produto atravessa: carimbo → conclusão → ordem → item
  itemId = (
    await prisma.stockItem.create({
      data: { companyId, nome: 'porçao queijo 135 grama', unidadeControle: 'UN', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' },
    })
  ).id
  ordemId = (
    await prisma.stockProductionOrder.create({
      data: { companyId, fichaId: 'ficha-da-fita', versaoFicha: 1, itemProduzidoId: itemId, dataProducao: hojeAs(8), estado: 'CONCLUIDA' },
    })
  ).id
  conclusaoId = (
    await prisma.stockProducaoConclusao.create({
      data: { companyId, ordemId, qtdGerada: 120, escalaConsumida: 1, custoLoteReal: 489.6, rendimento: 120, criadoEm: hojeAs(9) },
    })
  ).id
})

afterEach(async () => {
  await prisma.stockConclusaoEstornada.deleteMany({ where: { companyId } })
  await prisma.stockConclusaoCarimbo.deleteMany({ where: { companyId } })
  await prisma.stockProducaoConclusao.deleteMany({ where: { companyId } })
  await prisma.stockProductionOrder.deleteMany({ where: { companyId } })
  await prisma.stockItem.deleteMany({ where: { companyId } })
  await prisma.aviso.deleteMany({ where: { companyId } })
  await prisma.transaction.deleteMany({
    where: { OR: [{ supplier: { companyId } }, { category: { companyId } }] },
  })
  await prisma.supplier.deleteMany({ where: { companyId } })
  await prisma.category.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
})

/** ⭐ o carimbo de quatro olhos, como a rota do gerente grava */
async function carimbo(quando: Date, quem = 'marcyelle') {
  return prisma.stockConclusaoCarimbo.create({
    data: {
      companyId,
      conclusaoId,
      conferidoPorId: 'user-gerente',
      conferidoPorNome: quem,
      declaradoPorId: 'user-cozinha',
      conferidoEm: quando,
    },
  })
}

/**
 * ⭐ a conta PAGA, como ela existe de verdade: **sem `bankAccountId`** (a ponte do estoque,
 * 24/08) — é o estado de 110 de 110 contas em prod, e é o que prova que a mesa resolve a
 * empresa pelos RAMOS, não por `bankAccount.companyId`.
 */
async function contaPaga(valor: number, pagoEm: Date, descricao: string) {
  return prisma.transaction.create({
    data: {
      description: descricao,
      amount: valor,
      type: 'DEBIT',
      date: pagoEm,
      dueDate: pagoEm,
      paymentDate: pagoEm,
      lifecycle: 'EFFECTED',
      status: 'RECONCILED',
      supplierId,
      categoryId,
    },
  })
}

/** ⭐ o aviso, pela forma que os produtores gravam (`origem + alvo` é o anti-spam) */
async function aviso(titulo: string, criadoEm: Date, origem = 'P8', setor = 'producao') {
  return prisma.aviso.create({
    data: {
      companyId,
      setor,
      severidade: 'ambar',
      titulo,
      corpo: 'o corpo do aviso, na língua do balcão',
      oQueFazer: 'confere a ficha antes de criar a ordem',
      origem,
      alvo: `ficha:${titulo}`,
      criadoEm,
    },
  })
}

describe('⛔⛔ a fita do dia não pode ter balde vazio com evento real na porta', () => {
  it('⭐⭐ LOTE_CONFERIDO — o carimbo de quatro olhos de hoje aparece na fita', async () => {
    const c = await carimbo(hojeAs(14), 'cristian fortes')

    const mesa = await lerMesaDeOperacoes(companyId, AGORA, prisma)
    const ev = mesa.fita.filter((e) => e.tipo === 'LOTE_CONFERIDO')

    expect(ev, 'o balde `lotesConferidos` está ligado na porta `carimbosDoDia`').toHaveLength(1)
    expect(ev[0].id).toContain(c.id)
    // o nome do produto atravessou a cadeia carimbo → conclusão → ordem → item
    expect(ev[0].texto).toContain('porçao queijo 135 grama')
    expect(ev[0].texto).toContain('cristian fortes')
    expect(ev[0].href).toContain(ordemId)
  })

  /**
   * ⛔⛔⛔ **O CARTÃO DUPLO DE 12/10 TENTANDO RENASCER NA FITA (achado pelo guard, 16/10).**
   *
   * A correção do gerente é **estorna-e-relança**: a conclusão antiga fica com o carimbo dela e
   * a nova ganha o `CORRIGIDA_E_CONFERIDA`. Sem a régua da porta, **o mesmo lote apareceria
   * carimbado DUAS VEZES na fita do dia** — e a fita é a tela em que o dono lê *"o que aconteceu
   * na casa hoje"*.
   *
   * ⚠️ Quem me cobrou isso foi o `uma-ordem-um-cartao`, e ele estava certo: eu tinha escrito um
   * `findMany` em `stockProducaoConclusao` **sem** a régua. ***A régua existia e o leitor novo
   * nasceu sem ela*** — exatamente o que aquele guard existe pra impedir.
   */
  it('⛔⛔ carimbo de conclusão ESTORNADA não entra na fita', async () => {
    await carimbo(hojeAs(14), 'cristian fortes')
    await prisma.stockConclusaoEstornada.create({
      data: { companyId, conclusaoId, motivo: 'corrigida pelo gerente', criadoPorId: 'user-gerente' },
    })

    const mesa = await lerMesaDeOperacoes(companyId, AGORA, prisma)
    expect(
      mesa.fita.filter((e) => e.tipo === 'LOTE_CONFERIDO'),
      'a declaração desfeita voltou a aparecer na fita',
    ).toHaveLength(0)
  })

  it('⭐⭐ CONTA_PAGA — a conta paga HOJE aparece, e ela nasceu SEM conta bancária', async () => {
    await contaPaga(1_940.59, hojeAs(10), 'LATICINIOS SANTO CRISTO — NF 179080')

    const mesa = await lerMesaDeOperacoes(companyId, AGORA, prisma)
    const ev = mesa.fita.filter((e) => e.tipo === 'CONTA_PAGA')

    expect(ev, 'o balde `contasPagas` está ligado no `whereDoStatus(PAGA)`').toHaveLength(1)
    expect(ev[0].texto).toContain('LATICINIOS SANTO CRISTO')
    expect(ev[0].texto).toContain('1.940,59')
  })

  it('⭐⭐ AVISO_ABERTO — o aviso que nasceu hoje aparece', async () => {
    await aviso('Confere a receita de PICAR BRÓCOLIS', hojeAs(3))

    const mesa = await lerMesaDeOperacoes(companyId, AGORA, prisma)
    const ev = mesa.fita.filter((e) => e.tipo === 'AVISO_ABERTO')

    expect(ev, 'o balde `avisos` está ligado na `avisosAbertos` do sininho').toHaveLength(1)
    expect(ev[0].texto).toContain('PICAR BRÓCOLIS')
  })

  it('⭐ os três baldes convivem no MESMO dia, e o MAIS RECENTE vem primeiro', async () => {
    await aviso('Confere a dose do sal', hojeAs(3))
    await contaPaga(500, hojeAs(10), 'ALAN SALBEGO')
    await carimbo(hojeAs(17))

    const mesa = await lerMesaDeOperacoes(companyId, AGORA, prisma)
    const tipos = mesa.fita
      .filter((e) => ['AVISO_ABERTO', 'CONTA_PAGA', 'LOTE_CONFERIDO'].includes(e.tipo))
      .map((e) => e.tipo)

    /**
     * ⚠️⚠️ **O TESTE CORRIGIU A MINHA ASSERÇÃO, e a ordem é DELIBERADA:** eu escrevi crescente
     * (3h → 10h → 17h) e a fita devolve **decrescente** (`b.quando − a.quando`, com desempate
     * por id pra ser estável). ⭐ E está certo: a pergunta da fita é *"o que aconteceu na casa
     * HOJE"*, e quem abre a home quer o que **acabou de acontecer** no topo — fita que começa
     * às 3h da manhã obriga a rolar até o fim pra ver o agora.
     */
    expect(tipos).toEqual(['LOTE_CONFERIDO', 'CONTA_PAGA', 'AVISO_ABERTO'])
  })
})

describe('⛔ o recorte do DIA — a fita é de HOJE, não do histórico', () => {
  it('⛔ carimbo de ONTEM não entra', async () => {
    await carimbo(new Date(ONTEM.getTime() + 14 * 3600 * 1000))
    const mesa = await lerMesaDeOperacoes(companyId, AGORA, prisma)
    expect(mesa.fita.filter((e) => e.tipo === 'LOTE_CONFERIDO')).toHaveLength(0)
  })

  it('⛔⛔ conta paga ONTEM não entra — e o recorte é pelo `paymentDate`, nunca pelo `criadoEm`', async () => {
    /**
     * ⚠️ A linha é **criada agora** (`criadoEm` = hoje) e **paga ontem**. Se o recorte olhasse o
     * instante do REGISTRO, ela apareceria na fita de hoje — e a fita contaria como "pago hoje"
     * um dinheiro que saiu ontem. **O instante do FATO é o `paymentDate`.**
     */
    await contaPaga(777, new Date(ONTEM.getTime() + 11 * 3600 * 1000), 'pago ONTEM')
    const mesa = await lerMesaDeOperacoes(companyId, AGORA, prisma)
    expect(mesa.fita.filter((e) => e.tipo === 'CONTA_PAGA')).toHaveLength(0)
  })

  it('⛔ aviso aberto ONTEM não entra na fita de hoje (mas segue ABERTO no sininho)', async () => {
    await aviso('Confere o estoque negativo', new Date(ONTEM.getTime() + 3 * 3600 * 1000))
    const mesa = await lerMesaDeOperacoes(companyId, AGORA, prisma)
    expect(mesa.fita.filter((e) => e.tipo === 'AVISO_ABERTO')).toHaveLength(0)
  })

  it('⛔⛔ conta EM ABERTO não entra — "paga" tem um dono só (`whereDoStatus`)', async () => {
    await prisma.transaction.create({
      data: {
        description: 'ainda vou pagar',
        amount: 300,
        type: 'DEBIT',
        date: hojeAs(9),
        dueDate: hojeAs(9),
        lifecycle: 'PAYABLE',
        status: 'PENDING',
        supplierId,
        categoryId,
      },
    })
    const mesa = await lerMesaDeOperacoes(companyId, AGORA, prisma)
    expect(mesa.fita.filter((e) => e.tipo === 'CONTA_PAGA')).toHaveLength(0)
  })
})

describe('⛔⛔ multi-tenant — a fita de uma empresa não vê o dia da outra', () => {
  it('⛔ carimbo, conta paga e aviso de OUTRA empresa ficam fora', async () => {
    const outra = await prisma.company.create({ data: { cnpj: '64646464000264', name: 'A OUTRA' } })
    try {
      await prisma.aviso.create({
        data: {
          companyId: outra.id,
          setor: 'producao',
          severidade: 'ambar',
          titulo: 'aviso da OUTRA',
          corpo: 'x',
          oQueFazer: 'y',
          origem: 'P8',
          alvo: 'z',
          criadoEm: hojeAs(5),
        },
      })
      const itemOutra = await prisma.stockItem.create({
        data: { companyId: outra.id, nome: 'item da outra', unidadeControle: 'UN', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' },
      })
      const ordemOutra = await prisma.stockProductionOrder.create({
        data: { companyId: outra.id, fichaId: 'f', versaoFicha: 1, itemProduzidoId: itemOutra.id, dataProducao: hojeAs(8) },
      })
      const conclOutra = await prisma.stockProducaoConclusao.create({
        data: { companyId: outra.id, ordemId: ordemOutra.id, qtdGerada: 10, escalaConsumida: 1, custoLoteReal: 10, rendimento: 10 },
      })
      await prisma.stockConclusaoCarimbo.create({
        data: {
          companyId: outra.id,
          conclusaoId: conclOutra.id,
          conferidoPorId: 'u',
          conferidoPorNome: 'de outra empresa',
          conferidoEm: hojeAs(15),
        },
      })

      const mesa = await lerMesaDeOperacoes(companyId, AGORA, prisma)
      const texto = mesa.fita.map((e) => e.texto).join(' | ')
      expect(texto).not.toContain('aviso da OUTRA')
      expect(texto).not.toContain('de outra empresa')
      expect(mesa.fita.filter((e) => ['AVISO_ABERTO', 'LOTE_CONFERIDO'].includes(e.tipo))).toHaveLength(0)
    } finally {
      await prisma.stockConclusaoCarimbo.deleteMany({ where: { companyId: outra.id } })
      await prisma.stockProducaoConclusao.deleteMany({ where: { companyId: outra.id } })
      await prisma.stockProductionOrder.deleteMany({ where: { companyId: outra.id } })
      await prisma.stockItem.deleteMany({ where: { companyId: outra.id } })
      await prisma.aviso.deleteMany({ where: { companyId: outra.id } })
      await prisma.company.delete({ where: { id: outra.id } })
    }
  })
})

describe('⛔⛔⛔ evento sem porta é proibido — a mesa não FABRICA linha de fita', () => {
  it('⭐ a mesa não inventa evento: todo tipo que ela entrega tem porta nomeada', async () => {
    /**
     * ⚠️ A trava forte é o TIPO (`TipoDeEvento` é união fechada, com a porta de cada membro
     * escrita ao lado — membro novo sem porta não compila). O que este teste acrescenta é a
     * metade de RUNTIME: **nenhum tipo chega à tela sem que a porta dele tenha sido lida**.
     */
    await carimbo(hojeAs(14))
    await contaPaga(100, hojeAs(10), 'uma conta')
    await aviso('um aviso', hojeAs(3))

    const mesa = await lerMesaDeOperacoes(companyId, AGORA, prisma)
    const COM_PORTA = new Set([
      'LOTE_CONCLUIDO',
      'LOTE_CONFERIDO',
      'CONTA_PAGA',
      'VENDA_IMPORTADA',
      'AVISO_ABERTO',
    ])
    for (const e of mesa.fita) expect(COM_PORTA.has(e.tipo), `tipo sem porta: ${e.tipo}`).toBe(true)

    // ⛔ e número morto é proibido: todo evento leva a algum lugar
    for (const e of mesa.fita) expect(e.href.startsWith(`/empresas/${companyId}`)).toBe(true)
  })

  it('⛔ dia vazio devolve fita VAZIA — nunca um evento de consolo', async () => {
    const mesa = await lerMesaDeOperacoes(companyId, AGORA, prisma)
    expect(mesa.fita).toHaveLength(0)
  })
})
