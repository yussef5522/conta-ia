// ⭐⭐⭐ RADAR DO ESTOQUE — O GUARD QUE MORDE O CORAÇÃO (20/09/2026).
//
// **A exigência do dono:** *"Σ(conta de padeiro) == veredito da linha == placar (guard: o
// detalhe soma o total, sempre)"*.
//
// ⛔ Por que isso é o teste que importa: a conta de padeiro existe pra o dono CONFERIR o
// número grande. No dia em que o detalhe não somar o total, a tela vira aquilo que esta
// casa mais combate — *"número em tela de dinheiro sem régua"* —, e ele para de confiar
// nas duas coisas de uma vez.
//
// REGRA 3: roda o pipeline REAL contra banco de verdade (contagem pela porta de sempre,
// movimentos pelo `criarMovimento`), nunca grep nem fixture montada na mão.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { criarMovimento } from '../movement'
import { iniciarContagem, contarLinha, finalizarContagem } from '../contagem'
import { calcularFechamentoDoDia, vereditoDe, ordenarPorDinheiro, totalDaSecao, DEGRAU_VERMELHO, type LinhaDoRadar } from '../radar/fechamento'
import { listasDoRadar, porNaLista, tirarDaLista, montarSemente } from '../radar/watchlist'
import { diaEmSaoPaulo } from '@/lib/datas/dia-sao-paulo'

const CNPJ = '50607080000201'
let companyId: string
let queijo: string
let coxao: string
let calabresa: string
const hoje = diaEmSaoPaulo()
const ontem = new Date(+new Date(`${hoje}T12:00:00-03:00`) - 86_400_000).toISOString().slice(0, 10)

const ator = { userId: 'u-radar', userName: 'Cristian' }

beforeAll(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'EMPRESA RADAR' } })
  companyId = c.id
  const mk = (nome: string, un: string, categoria = 'MATERIA_PRIMA') =>
    prisma.stockItem.create({ data: { companyId, nome, unidadeControle: un, categoria, criadoVia: 'CONFERENCIA' } })
  queijo = (await mk('QUEIJO MUSSARELA EM PECA 02 KG', 'KG')).id
  coxao = (await mk('Coxão Mole', 'KG')).id
  calabresa = (await mk('CALABRESA', 'KG')).id
  // ⭐ o estoque nasce como nasce de verdade: nota → movimento
  await criarMovimento(prisma, { companyId, itemId: queijo, tipo: 'ENTRADA_NF', quantidade: 60, custoUnitario: 30.95, origem: 'SEFAZ' })
  await criarMovimento(prisma, { companyId, itemId: coxao, tipo: 'ENTRADA_NF', quantidade: 40, custoUnitario: 48.23, origem: 'SEFAZ' })
  await criarMovimento(prisma, { companyId, itemId: calabresa, tipo: 'ENTRADA_NF', quantidade: 20, custoUnitario: 18.14, origem: 'SEFAZ' })
})

afterAll(async () => {
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS trg_stock_movement_no_update;').catch(() => {})
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS trg_stock_movement_no_delete;').catch(() => {})
  await prisma.stockRadarItem.deleteMany({ where: { companyId } })
  await prisma.stockContagemItem.deleteMany({ where: { companyId } })
  await prisma.stockContagem.deleteMany({ where: { companyId } })
  await prisma.stockMovement.deleteMany({ where: { companyId } })
  await prisma.stockSaldoCache.deleteMany({ where: { companyId } })
  await prisma.stockItem.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

/** conta uma linha pela PORTA REAL (a mesma da tela da contagem) */
async function contar(itemId: string, qtd: number) {
  const s = await iniciarContagem(companyId, ator, prisma)
  // ⚠️ `confirmarFreio` é o aceite da 2ª confirmação: sem ele o servidor RECUSA
  // divergência grande — e o cenário aqui é justamente o furo grande.
  await contarLinha({
    companyId, contagemId: s.id, itemId, qtdContada: qtd,
    confirmarFreio: true, userId: ator.userId, userName: ator.userName,
  }, prisma)
  await finalizarContagem(companyId, s.id, prisma)
}

const radar = (caros: string[], porcoes: string[] = [], revenda: string[] = []) =>
  calcularFechamentoDoDia({ companyId, de: ontem, ate: hoje, caros, revenda, porcoes }, prisma)

describe('⭐⭐⭐ Σ(conta de padeiro) == veredito == placar', () => {
  it('⭐ a conta explica a variância AO CENTAVO, e o placar soma as linhas', async () => {
    // 1ª contagem: o ponto de partida ("tinha")
    await contar(queijo, 60)
    // ⭐ o dia acontece: chegou nota, saiu venda
    await criarMovimento(prisma, { companyId, itemId: queijo, tipo: 'ENTRADA_NF', quantidade: 40, custoUnitario: 30.95, origem: 'SEFAZ' })
    await criarMovimento(prisma, { companyId, itemId: queijo, tipo: 'BAIXA_VENDA', quantidade: -38.2, custoUnitario: 30.95, origem: 'VENDA' })
    // 2ª contagem: sobrou menos do que devia — é o furo
    await contar(queijo, 58)

    const r = await radar([queijo])
    const l = r.caros[0]!
    expect(l.conta, 'a linha contada tem que trazer a conta de padeiro').not.toBeNull()
    const c = l.conta!

    // ⛔ A CONTA FECHA: tinha + baldes == DEVIA TER
    const somaBaldes = c.baldes.reduce((s, b) => s + b.qtd, 0)
    expect(Math.abs(c.tinha + somaBaldes - c.deviaTer), 'a conta de padeiro não soma o DEVIA TER').toBeLessThan(0.005)
    expect(c.naoExplicado, 'sobrou quantidade sem movimento que explique').toBe(0)

    // ⛔ O VEREDITO É A CONTA: contamos − devia ter
    expect(c.contamos, 'a linha contada tem que trazer o CONTAMOS').not.toBeNull()
    expect(Math.abs(c.contamos! - c.deviaTer - c.faltou!)).toBeLessThan(0.005)
    expect(l.faltouValor).toBe(c.faltouValor)

    // ⛔ E O PLACAR É A SOMA DAS LINHAS
    expect(r.placar.valor).toBe(Math.abs(c.faltouValor!))
    expect(r.placar.tom).toBe('FALTOU')
    expect(r.placar.maiorOfensor).toBe('QUEIJO MUSSARELA EM PECA 02 KG')

    // ⭐ e o número bate com a realidade: 60 + 40 − 38,2 = 61,8 esperados, 58 contados
    expect(c.deviaTer).toBeCloseTo(61.8, 2)
    expect(c.faltou!).toBeCloseTo(-3.8, 2)
  })

  it('⭐⭐ o placar soma MAIS DE UMA linha — e continua sendo a soma das contas', async () => {
    await contar(coxao, 40)
    await criarMovimento(prisma, { companyId, itemId: coxao, tipo: 'BAIXA_VENDA', quantidade: -10, custoUnitario: 48.23, origem: 'VENDA' })
    await contar(coxao, 29) // devia ter 30, faltou 1

    const r = await radar([queijo, coxao])
    const soma = r.caros.reduce((s, l) => s + (l.faltouValor ?? 0), 0)
    expect(r.placar.valor).toBeCloseTo(Math.abs(soma), 2)
    for (const l of r.caros) {
      if (!l.conta) continue
      const b = l.conta.baldes.reduce((s, x) => s + x.qtd, 0)
      expect(Math.abs(l.conta.tinha + b - l.conta.deviaTer), `a conta de ${l.nome} não fecha`).toBeLessThan(0.005)
    }
  })
})

describe('⛔⛔ "falta contar" é estado próprio — NUNCA zero', () => {
  it('item sem contagem no período não inventa variância', async () => {
    const r = await radar([calabresa])
    const l = r.caros[0]!
    expect(l.veredito).toBe('SEM_CONTAGEM')
    // ⛔ o par que importa: `null`, não `0` — zero afirmaria que bateu
    expect(l.faltouValor).toBeNull()
    expect(l.faltou).toBeNull()
    /**
     * ⭐⭐ v1.1 — A CONTA ABRE MESMO ASSIM (decisão do dono): o sistema mostra o que SABE
     * (tinha → comprou → vendeu → deve ter agora) e **diz que falta contar** onde depende
     * de alguém ir lá. ⛔ O que continua proibido é inventar variância.
     */
    expect(l.conta, 'a conta de padeiro tem que abrir mesmo sem contagem').not.toBeNull()
    expect(l.conta!.contamos, 'sem contagem, CONTAMOS é null — nunca 0').toBeNull()
    expect(l.conta!.faltou).toBeNull()
    expect(l.conta!.faltouValor).toBeNull()
    // ⭐ e o que o sistema sabe fecha: tinha + baldes == deve ter agora
    const soma = l.conta!.baldes.reduce((s, b) => s + b.qtd, 0)
    expect(Math.abs(l.conta!.tinha + soma - l.conta!.deviaTer)).toBeLessThan(0.005)
  })

  it('⭐⭐ v1.1 — TODA linha diz o saldo do sistema, contada ou não', async () => {
    const r = await radar([calabresa, queijo])
    for (const linha of r.caros) {
      expect(typeof linha.saldoSistema, `${linha.nome} sem saldo do sistema`).toBe('number')
      expect(typeof linha.valorSistema).toBe('number')
    }
    // ⛔ e o saldo é o MESMO da porta da Posição — não uma segunda conta
    const { saldosDaEmpresa } = await import('../saldo')
    const posicao = new Map((await saldosDaEmpresa(prisma, companyId)).map((x) => [x.itemId, x]))
    for (const linha of r.caros) {
      expect(linha.saldoSistema, `${linha.nome} divergiu da Posição`)
        .toBeCloseTo(posicao.get(linha.itemId)?.saldo ?? 0, 2)
    }
  })

  it('⭐ o placar sem contagem soma o SISTEMA em vez de mostrar um traço', async () => {
    const r = await radar([calabresa])
    expect(r.placar.tom).toBe('SEM_CONTAGEM')
    expect(r.placar.valorNoSistema, 'o placar não sabe o tamanho do que vigia').toBeGreaterThan(0)
  })

  it('⭐ e ele NÃO entra na conta do placar (nem pra somar zero)', async () => {
    const so = await radar([queijo])
    const com = await radar([queijo, calabresa])
    expect(com.placar.valor).toBe(so.placar.valor)
    expect(com.placar.itensContados).toBe(so.placar.itensContados)
    expect(com.placar.itensNasListas).toBe(so.placar.itensNasListas + 1)
  })

  it('⛔ e o gráfico por dia devolve `null` no dia sem contagem, nunca 0', async () => {
    const r = await radar([calabresa])
    expect(r.porDia.length).toBeGreaterThan(0)
    expect(r.porDia.every((d) => d.valor === null)).toBe(true)
  })
})

describe('⭐ a JANELA é por item, e vem ESCRITA (a decisão do dono)', () => {
  it('a conta diz DESDE QUANDO — senão mentiria o tamanho do furo', async () => {
    const r = await radar([queijo])
    const c = r.caros[0]!.conta!
    expect(c.desde, 'a janela não veio escrita').not.toBeNull()
    expect(c.ate).toBe(hoje)
    expect(c.diasDaJanela).not.toBeNull()
  })
})

describe('⭐ a ORDEM é pelo DINHEIRO (régua mundial: R$, não %)', () => {
  const l = (nome: string, v: number | null): LinhaDoRadar => ({
    itemId: nome, nome, unidadeControle: 'KG', custoMedio: 10,
    saldoSistema: 0, valorSistema: 0,
    veredito: vereditoDe(v), faltou: v, faltouValor: v, ultimaContagem: null, conta: null,
    ultimoVeredito: null, historico: [],
  })

  /** ⭐ v1.3 — um fabricante de linha com unidade, pro teste do total */
  const linhaCom = (nome: string, faltou: number | null, un: string): LinhaDoRadar => ({
    ...l(nome, faltou), unidadeControle: un, faltou, faltouValor: faltou == null ? null : faltou * 2,
  })

  it('quem faltou mais dinheiro primeiro; sem contagem por ÚLTIMO', () => {
    const ord = ordenarPorDinheiro([l('bateu', 0), l('sem', null), l('pequeno', -10), l('grande', -900), l('sobrou', 5)])
    expect(ord.map((x) => x.nome)).toEqual(['grande', 'pequeno', 'sobrou', 'bateu', 'sem'])
  })

  it('⛔ "sem contagem" no topo empurraria o furo real pra baixo', () => {
    const ord = ordenarPorDinheiro([l('sem', null), l('furo', -1)])
    expect(ord[0]!.nome).toBe('furo')
  })

  it('⭐ o degrau vermelho×âmbar é em DINHEIRO', () => {
    expect(vereditoDe(-(DEGRAU_VERMELHO + 1))).toBe('FALTOU_GRANDE')
    expect(vereditoDe(-(DEGRAU_VERMELHO - 1))).toBe('FALTOU_PEQUENO')
    expect(vereditoDe(0)).toBe('BATEU')
    expect(vereditoDe(3)).toBe('SOBROU')
    expect(vereditoDe(null)).toBe('SEM_CONTAGEM')
  })
})

describe('⭐⭐ as listas: semeiam UMA vez e depois são do dono', () => {
  it('a semente pega os nomes que o dono nomeou', async () => {
    const s = await montarSemente(companyId, prisma)
    // ⭐ os DOIS queijos entrariam se existissem; aqui existe um, e o coxão e a calabresa
    const nomes = await prisma.stockItem.findMany({ where: { id: { in: s.caros } }, select: { nome: true } })
    expect(nomes.map((n) => n.nome).sort()).toContain('Coxão Mole')
    expect(nomes.map((n) => n.nome)).toContain('QUEIJO MUSSARELA EM PECA 02 KG')
  })

  it('⛔ o SEED não roda de novo — senão sobrescreveria a edição do dono', async () => {
    const p1 = await listasDoRadar(companyId, prisma)
    expect(p1.semeadaAgora).toBe(true)
    await tirarDaLista({ companyId, lista: 'CAROS', itemId: coxao }, prisma)
    const p2 = await listasDoRadar(companyId, prisma)
    expect(p2.semeadaAgora, 'o seed rodou de novo e trouxe de volta o que o dono tirou').toBe(false)
    expect(p2.caros).not.toContain(coxao)
  })

  /**
   * ⚠️⚠️ **REGRA 11: O TESTE ACIMA VEIO VERDE COM O DEFEITO REPOSTO.** Removi o
   * early-return e ele passou — porque quem barrou a reposição foi o **índice único do
   * banco** (o `createMany` colide, cai no catch e relê). A trava existe, mas o teste
   * media a trava ERRADA, e no dia em que alguém trocar aquele `createMany` por `upsert`
   * o seed passaria a repor de verdade **com o guard verde**.
   *
   * ⭐ O que morde é a INTENÇÃO: com lista existente, a semente não pode nem ser
   * consultada. O `db` abaixo explode se alguém for buscá-la.
   */
  it('⛔⛔ com lista existente, a SEMENTE não é nem consultada', async () => {
    const espiao = {
      stockRadarItem: {
        findMany: async () => [{ lista: 'CAROS', itemId: 'i1' }, { lista: 'PORCOES', itemId: 'i2' }],
      },
      stockItem: {
        findMany: async () => { throw new Error('o seed foi consultado com a lista já existente') },
      },
    } as unknown as typeof prisma
    const r = await listasDoRadar('empresa-qualquer', espiao)
    expect(r.semeadaAgora).toBe(false)
    expect(r.caros).toEqual(['i1'])
    expect(r.porcoes).toEqual(['i2'])
  })

  it('⭐ pôr é idempotente — dois toques, uma linha', async () => {
    await porNaLista({ companyId, lista: 'CAROS', itemId: coxao }, prisma)
    await porNaLista({ companyId, lista: 'CAROS', itemId: coxao }, prisma)
    const n = await prisma.stockRadarItem.count({ where: { companyId, lista: 'CAROS', itemId: coxao } })
    expect(n).toBe(1)
  })
})

describe('⭐⭐ o que está FORA das listas aparece NOMEADO', () => {
  it('o placar não subestima em silêncio', async () => {
    // a calabresa é contada mas NÃO está nas listas do radar desta chamada
    await criarMovimento(prisma, { companyId, itemId: calabresa, tipo: 'BAIXA_VENDA', quantidade: -5, custoUnitario: 18.14, origem: 'VENDA' })
    await contar(calabresa, 13) // devia ter 15

    const r = await radar([queijo])
    expect(r.placar.foraDasListasItens).toBeGreaterThan(0)
    expect(r.placar.foraDasListasValor, 'o furo de fora das listas sumiu do payload').toBeLessThan(0)
  })
})


describe('⭐⭐⭐ v1.3 — o TOTAL da seção, e a LEI das unidades', () => {
  const l = (nome: string, faltou: number | null, un: string, valor?: number): LinhaDoRadar => ({
    itemId: nome, nome, unidadeControle: un, custoMedio: 10, saldoSistema: 0, valorSistema: 0,
    veredito: vereditoDe(valor ?? faltou), faltou, faltouValor: faltou == null ? null : (valor ?? faltou),
    ultimaContagem: null, conta: null, ultimoVeredito: null, historico: [],
  })

  it('⛔⛔ UN e KG NUNCA somam num número só', () => {
    const t = totalDaSecao([
      l('a', -14, 'UN', -100),
      l('b', -2.3, 'KG', -145.1),
    ])
    // ⭐ a quantidade sai POR UNIDADE…
    expect(t.faltouPorUnidade).toEqual({ UN: 14, KG: 2.3 })
    // …e o DINHEIRO soma tudo, porque real é real venha de onde vier
    expect(t.faltouValor).toBe(245.1)
  })

  it('⭐ faltou e sobrou são baldes SEPARADOS — um não abate o outro', () => {
    const t = totalDaSecao([l('a', -14, 'UN', -100), l('b', 3, 'UN', 12.6)])
    expect(t.faltouPorUnidade).toEqual({ UN: 14 })
    expect(t.faltouValor).toBe(100)
    expect(t.sobrouPorUnidade).toEqual({ UN: 3 })
    expect(t.sobrouValor).toBe(12.6)
  })

  it('⛔⛔ "falta contar" fica FORA do total — nunca vira zero', () => {
    const t = totalDaSecao([l('a', -5, 'UN', -50), l('sem', null, 'UN')])
    expect(t.itensContados).toBe(1)
    expect(t.itensSemContagem).toBe(1)
    expect(t.faltouPorUnidade).toEqual({ UN: 5 })
    // ⛔ o item sem contagem não acrescentou 0 a unidade nenhuma
    expect(Object.keys(t.faltouPorUnidade)).toEqual(['UN'])
  })

  it('⭐ quem BATEU não entra em falta nem em sobra', () => {
    const t = totalDaSecao([l('bateu', 0, 'UN', 0)])
    expect(t.itensContados).toBe(1)
    expect(t.faltouPorUnidade).toEqual({})
    expect(t.sobrouPorUnidade).toEqual({})
  })
})

describe('⭐⭐ v1.3 — a seção REVENDA e o Σ das três', () => {
  it('⭐ a revenda é uma lista PRÓPRIA no payload', async () => {
    const r = await radar([queijo], [], [calabresa])
    expect(r.revenda.map((x) => x.itemId)).toEqual([calabresa])
    expect(r.caros.map((x) => x.itemId)).toEqual([queijo])
    expect(r.totais.revenda).toBeTruthy()
  })

  it('⛔⛔ Σ das TRÊS seções == placar (o guard do dono)', async () => {
    const r = await radar([queijo, coxao], [], [calabresa])
    const somaSecoes = [...r.caros, ...r.revenda, ...r.porcoes]
      .reduce((s, x) => s + (x.faltouValor ?? 0), 0)
    expect(Math.abs(Math.abs(somaSecoes) - r.placar.valor)).toBeLessThan(0.005)
    // ⭐ e os rodapés somam o mesmo dinheiro que as linhas
    const doRodape = (['caros', 'revenda', 'porcoes'] as const)
      .reduce((s, k) => s + r.totais[k].faltouValor - r.totais[k].sobrouValor, 0)
    expect(Math.abs(Math.abs(doRodape) - r.placar.valor), 'o rodapé não bate com o placar').toBeLessThan(0.005)
  })
})

describe('⭐ v1.3 — o último veredito carrega a QUANTIDADE', () => {
  it('o chip tem qtd e valor — dinheiro sozinho não diz o tamanho do furo', async () => {
    const r = await radar([queijo])
    const u = r.caros[0]!.ultimoVeredito
    expect(u, 'o item contado perdeu o último veredito').not.toBeNull()
    expect(typeof u!.qtd, 'o último veredito não traz quantidade').toBe('number')
    expect(u!.qtd).not.toBe(0)
  })
})
