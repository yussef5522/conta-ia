/**
 * ⭐⭐⭐ OS GUARDS DA CASA, CONTRA O BANCO (06/10/2026) — REGRA 3: executa o caminho real.
 *
 * ⛔⛔ **OS DOIS QUE O DONO PEDIU, e eles só se provam com banco:**
 *  1. **Σ(linhas planejado) == cartão (a)**, por construção;
 *  2. **o realizado vem SÓ das transações** — nenhum número digitado o alcança, e o que o
 *     `whereFluxoCaixa` exclui (transferência própria, conta a pagar em aberto, compra no
 *     cartão) continua fora.
 *
 * ⚠️ Um teste puro provaria a tradução e **não** provaria o que mais importa: que o realizado
 * sai da MESMA porta do Fluxo de Caixa, e que gravar plano não move número de fato nenhum.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { lerCustosFixos } from '../leitura'
import { marcarComoFixa, tirarDaLista, definirPlanejado, CustoFixoError } from '../gestos'
import { produzirAvisosDeFinanceiro, ORIGEM } from '@/lib/avisos/produtores/financeiro'
import { avisosAbertos } from '@/lib/avisos/central'

const CNPJ = '59595959000159'
const MES = '2026-09'
// ⚠️ relógio FIXO no PASSADO — data fixa no futuro é bomba de calendário (REGRA do dono)
const AGORA = new Date('2026-09-20T15:00:00Z')

let companyId = ''
let contaId = ''
let catAluguel = ''
let catEnergia = ''
let catReceita = ''

async function tx(over: Record<string, unknown>) {
  return prisma.transaction.create({
    data: {
      bankAccountId: contaId,
      date: new Date('2026-09-10T12:00:00Z'),
      description: 'lançamento de teste',
      amount: 100,
      type: 'DEBIT',
      lifecycle: 'EFFECTED',
      status: 'RECONCILED',
      ...over,
    } as never,
  })
}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'A CASA NUM OLHAR' } })
  companyId = c.id
  const conta = await prisma.bankAccount.create({
    data: { companyId, name: 'conta teste', bankName: 'teste', accountType: 'CHECKING', balance: 0 },
  })
  contaId = conta.id
  const mk = (name: string, type: string, dreGroup: string) =>
    prisma.category.create({ data: { companyId, name, type, dreGroup } })
  catAluguel = (await mk('Aluguel', 'EXPENSE', 'DESPESAS_ADMINISTRATIVAS')).id
  catEnergia = (await mk('Energia Elétrica', 'EXPENSE', 'DESPESAS_ADMINISTRATIVAS')).id
  catReceita = (await mk('Receita de Vendas', 'INCOME', 'RECEITA_BRUTA')).id
})

afterEach(async () => {
  await prisma.aviso.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
})

describe('⛔⛔ Σ(linhas planejado) == cartão "a casa custa", por construção', () => {
  it('⭐ dois custos fixos planejados: o cartão é a soma das linhas', async () => {
    await marcarComoFixa(companyId, catAluguel, null)
    await marcarComoFixa(companyId, catEnergia, null)
    await definirPlanejado(companyId, catAluguel, MES, 8500, null)
    await definirPlanejado(companyId, catEnergia, MES, 2000, null)

    const t = await lerCustosFixos(companyId, MES, AGORA)
    const soma = t.linhas.reduce((s, l) => s + (l.planejado ?? 0), 0)
    expect(t.casaCustaMes).toBeCloseTo(10500, 2)
    expect(soma, 'o cartão É a Σ das linhas').toBeCloseTo(t.casaCustaMes!, 2)
    expect(t.porDiaAberto.dias, 'setembro tem 30 dias corridos').toBe(30)
    expect(t.porDiaAberto.valor).toBeCloseTo(10500 / 30, 2)
  })

  it('⛔ sem NENHUM plano o cartão diz "a apurar" — nunca cai no realizado', async () => {
    await marcarComoFixa(companyId, catAluguel, null)
    await tx({ categoryId: catAluguel, amount: 8456.88 })

    const t = await lerCustosFixos(companyId, MES, AGORA)
    expect(t.casaCustaMes, 'número que o dono nunca declarou não vira "a casa custa"').toBeNull()
    expect(t.porDiaAberto.valor).toBeNull()
    expect(t.pontoDeEquilibrio.porDia).toBeNull()
    // ⭐ mas o realizado aparece, e a tela DIZ quantas linhas estão sem plano
    expect(t.totalRealizado).toBeCloseTo(8456.88, 2)
    expect(t.semPlano.n).toBe(1)
    expect(t.semPlano.realizado).toBeCloseTo(8456.88, 2)
    expect(t.pctPago, 'sem plano, "% pago" é desconhecido — nunca 0%').toBeNull()
  })
})

describe('⛔⛔ o realizado vem SÓ das transações', () => {
  it('⭐ gravar o PLANO não move o realizado um centavo', async () => {
    await marcarComoFixa(companyId, catAluguel, null)
    await tx({ categoryId: catAluguel, amount: 8456.88 })

    const antes = await lerCustosFixos(companyId, MES, AGORA)
    await definirPlanejado(companyId, catAluguel, MES, 99999, null)
    const depois = await lerCustosFixos(companyId, MES, AGORA)

    expect(depois.totalRealizado).toBeCloseTo(antes.totalRealizado, 2)
    expect(depois.linhas[0].realizado).toBeCloseTo(8456.88, 2)
  })

  it('⛔ o que o whereFluxoCaixa EXCLUI continua fora do realizado', async () => {
    await marcarComoFixa(companyId, catAluguel, null)
    await tx({ categoryId: catAluguel, amount: 1000 }) // ⭐ esta conta
    await tx({ categoryId: catAluguel, amount: 7777, type: 'TRANSFER', transferDirection: 'OUT' }) // transferência própria
    await tx({ categoryId: catAluguel, amount: 5555, lifecycle: 'PAYABLE', status: 'PENDING', dueDate: new Date('2026-09-25T00:00:00Z') }) // em aberto não é caixa
    await tx({ categoryId: catAluguel, amount: 3333, isInternalTransfer: true }) // marcada interna

    const t = await lerCustosFixos(companyId, MES, AGORA)
    expect(t.linhas[0].realizado, 'só o dinheiro que REALMENTE saiu').toBeCloseTo(1000, 2)
    // ⭐ e a conta em aberto não desaparece: ela vira o selo "vence dia X"
    expect(t.linhas[0].emAbertoN).toBe(1)
    expect(t.linhas[0].situacao.estado).toBe('VENCE')
  })

  it('⚠️ a conta a pagar em aberto NASCE SEM conta bancária — e o selo acha ela mesmo assim', async () => {
    await marcarComoFixa(companyId, catEnergia, null)
    await prisma.transaction.create({
      data: {
        bankAccountId: null, categoryId: catEnergia, date: new Date('2026-09-01T12:00:00Z'),
        description: 'energia', amount: 10851.83, type: 'DEBIT',
        lifecycle: 'PAYABLE', status: 'PENDING', dueDate: new Date('2026-09-10T00:00:00Z'),
      } as never,
    })
    const t = await lerCustosFixos(companyId, MES, AGORA)
    expect(t.linhas[0].emAbertoN, 'resolver por bankAccount.companyId daria ZERO').toBe(1)
    expect(t.linhas[0].situacao.estado).toBe('ATRASADO')
  })
})

describe('⭐ os gestos do dono', () => {
  it('⛔ categoria de RECEITA não entra na lista do que a casa custa', async () => {
    await expect(marcarComoFixa(companyId, catReceita, null)).rejects.toBeInstanceOf(CustoFixoError)
  })

  it('⛔ planejar categoria que não está na lista é recusado com a saída escrita', async () => {
    await expect(definirPlanejado(companyId, catAluguel, MES, 100, null)).rejects.toMatchObject({
      code: 'NAO_ESTA_NA_LISTA',
    })
  })

  it('⭐ tirar da lista NÃO apaga o plano do mês — o histórico de uma decisão fica', async () => {
    await marcarComoFixa(companyId, catAluguel, null)
    await definirPlanejado(companyId, catAluguel, MES, 8500, null)
    await tirarDaLista(companyId, catAluguel, null)

    const t = await lerCustosFixos(companyId, MES, AGORA)
    expect(t.linhas.length, 'saiu da lista').toBe(0)
    const plano = await prisma.custoFixoPlanejado.findFirst({ where: { companyId, categoryId: catAluguel, mes: MES } })
    expect(plano?.valor, 'o que ele declarou naquele mês não se reescreve').toBeCloseTo(8500, 2)
  })

  it('⭐ marcar de novo REABRE a mesma linha (não cria uma segunda)', async () => {
    await marcarComoFixa(companyId, catAluguel, null)
    await tirarDaLista(companyId, catAluguel, null)
    await marcarComoFixa(companyId, catAluguel, null)
    const n = await prisma.custoFixoCategoria.count({ where: { companyId, categoryId: catAluguel } })
    expect(n).toBe(1)
    const t = await lerCustosFixos(companyId, MES, AGORA)
    expect(t.linhas.length).toBe(1)
  })

  it('⚠️ plano VAZIO (null) volta pra "não declarei" — diferente de declarar ZERO', async () => {
    await marcarComoFixa(companyId, catAluguel, null)
    await definirPlanejado(companyId, catAluguel, MES, 0, null)
    let t = await lerCustosFixos(companyId, MES, AGORA)
    expect(t.linhas[0].planejado, 'zero é uma AFIRMAÇÃO').toBe(0)
    expect(t.casaCustaMes).toBe(0)

    await definirPlanejado(companyId, catAluguel, MES, null, null)
    t = await lerCustosFixos(companyId, MES, AGORA)
    expect(t.linhas[0].planejado, 'ausência é outra coisa').toBeNull()
    expect(t.casaCustaMes).toBeNull()
  })

  /**
   * ⚠️⚠️ **INVERTIDO EM 06/10 COM O MOTIVO ESCRITO, não apagado.** Ele afirmava *"o seletor não
   * oferece o que já está na lista"* — e o dono pediu o contrário: *"mostra as já marcadas com ✓
   * (pra desmarcar fácil também)"*. Esconder as marcadas tornava o desmarcar impossível por lá.
   *
   * ⭐ **A metade CERTA dele continua mordendo:** categoria de RECEITA nunca é oferecida, e
   * agora o teste também trava o `jaFixa`, que é o que separa o ✓ do +.
   */
  it('⭐ o seletor mostra o universo INTEIRO, com ✓ em quem já é fixa', async () => {
    const antes = await lerCustosFixos(companyId, MES, AGORA)
    expect(antes.disponiveis.map((d) => d.id)).toContain(catAluguel)
    expect(antes.disponiveis.find((d) => d.id === catAluguel)?.jaFixa).toBe(false)

    await marcarComoFixa(companyId, catAluguel, null)
    const depois = await lerCustosFixos(companyId, MES, AGORA)
    expect(depois.disponiveis.map((d) => d.id), 'ela CONTINUA no seletor — é de lá que se desmarca')
      .toContain(catAluguel)
    expect(depois.disponiveis.find((d) => d.id === catAluguel)?.jaFixa, 'com o ✓').toBe(true)
    // ⛔ e categoria de RECEITA nunca é oferecida (a metade que não mudou)
    expect(depois.disponiveis.map((d) => d.id)).not.toContain(catReceita)
  })

  it('⚠️ nome REPETIDO ganha qualificador (medido em prod: "Frete" existe 2×)', async () => {
    const a = await prisma.category.create({
      data: { companyId, name: 'Frete', type: 'EXPENSE', dreGroup: 'OUTRAS_DESPESAS' },
    })
    const b = await prisma.category.create({
      data: { companyId, name: 'Frete', type: 'EXPENSE', dreGroup: 'DESPESAS_COMERCIAIS', parentId: a.id },
    })
    await marcarComoFixa(companyId, a.id, null)
    await marcarComoFixa(companyId, b.id, null)
    const t = await lerCustosFixos(companyId, MES, AGORA)
    const fretes = t.linhas.filter((l) => l.nome === 'Frete')
    expect(fretes.length).toBe(2)
    expect(fretes.every((f) => f.qualificador != null), 'duas linhas com o mesmo rótulo pareceriam duplicata').toBe(true)
  })
})

describe('⛔⛔ o aviso do sininho — 1 por categoria/mês, e ele RECONCILIA', () => {
  it('⭐ estouro de 29% avisa uma vez, por mais que o cron rode', async () => {
    await marcarComoFixa(companyId, catEnergia, null)
    await definirPlanejado(companyId, catEnergia, MES, 2000, null)
    await tx({ categoryId: catEnergia, amount: 2590 })

    for (let i = 0; i < 5; i++) await produzirAvisosDeFinanceiro(companyId, AGORA)
    const abertos = (await avisosAbertos(companyId)).filter((a) => a.origem === ORIGEM)
    expect(abertos.length, '5 rodadas = 1 aviso').toBe(1)
    expect(abertos[0].setor).toBe('financeiro')
    expect(abertos[0].titulo.toLowerCase()).toContain('energia')
    expect(abertos[0].acaoHref, 'o botão leva às transações do mês naquela categoria')
      .toContain(`categoryId=${catEnergia}`)
  })

  it('⛔ 18% NÃO avisa — o sininho não repete o selo da tela', async () => {
    await marcarComoFixa(companyId, catEnergia, null)
    await definirPlanejado(companyId, catEnergia, MES, 2000, null)
    await tx({ categoryId: catEnergia, amount: 2360 })
    await produzirAvisosDeFinanceiro(companyId, AGORA)
    expect((await avisosAbertos(companyId)).filter((a) => a.origem === ORIGEM).length).toBe(0)
  })

  it('⭐ ajustar o plano RESOLVE o aviso — trabalho feito sai da fila', async () => {
    await marcarComoFixa(companyId, catEnergia, null)
    await definirPlanejado(companyId, catEnergia, MES, 2000, null)
    await tx({ categoryId: catEnergia, amount: 2590 })
    await produzirAvisosDeFinanceiro(companyId, AGORA)
    expect((await avisosAbertos(companyId)).filter((a) => a.origem === ORIGEM).length).toBe(1)

    await definirPlanejado(companyId, catEnergia, MES, 2600, null)
    await produzirAvisosDeFinanceiro(companyId, AGORA)
    expect((await avisosAbertos(companyId)).filter((a) => a.origem === ORIGEM).length).toBe(0)
  })

  it('⚠️ empresa que nunca marcou custo fixo é MUDA — nenhum aviso nasce', async () => {
    await tx({ categoryId: catEnergia, amount: 99999 })
    const r = await produzirAvisosDeFinanceiro(companyId, AGORA)
    expect(r.gravados).toBe(0)
    expect(r.recusados, 'e a lei da língua do balcão não recusou nada').toEqual([])
  })
})
