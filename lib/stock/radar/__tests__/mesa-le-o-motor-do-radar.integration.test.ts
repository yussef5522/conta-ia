/**
 * ⛔⛔⛔ LEI DA TELA: UM MOTOR (29/09/2026) — Real × Teórico lê o Radar, e só ele.
 *
 * **A ordem do dono:** *"a tela Real × Teórico passa a ler EXCLUSIVAMENTE o motor do Radar
 * — o cálculo próprio que ela tem hoje MORRE. **Guard de página: Σ(Real×Teórico) ==
 * Σ(Radar) pro mesmo recorte/itens; qualquer divergência = vermelho.** Duas telas, uma
 * verdade."*
 *
 * ⭐⭐ **E AS DUAS DISCORDAVAM DE VERDADE — está medido no teste do item contado 2×:** o
 * `calcularRealVsTeorico` somava **TODOS os `AJUSTE_CONTAGEM` do período**; o Radar usa a
 * **ÚLTIMA contagem** de cada item. Com duas contagens no mesmo período, as duas telas
 * mostravam números diferentes pro mesmo item — e nenhuma delas dizia qual era a certa.
 *
 * ⚠️ Este arquivo roda contra o BANCO (REGRA 3): fixture real, os dois motores de verdade,
 * e a comparação entre eles. Um teste puro sobre a tradução não provaria nada sobre o que
 * a tela mostra.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { calcularFechamentoDoDia } from '../fechamento'
import { calcularRealVsTeorico } from '@/lib/stock/real-vs-teorico'
import { montarMesa, somaDaMesa, linhaDaMesa, colunasValidas, frasesDoRodape, COLUNAS_PADRAO, COLUNAS } from '../mesa'
import { criarMovimento } from '@/lib/stock/movement'

const CNPJ = '68686868000168'
let companyId: string
let coca: string, queijo: string
/**
 * ⚠️⚠️ A CENA É RELATIVA AO RELÓGIO (02/10/2026), e isso virou necessário quando a conta de
 * padeiro passou a distinguir *"lançado antes"* de *"lançado depois da contagem"*: o
 * `criadoEm` de um movimento é o relógio real e **não se backdata pela porta**. Com datas
 * fixas no passado, TODO movimento da fixture nascia depois das contagens — um estado que em
 * prod é a exceção (import atrasado), e aqui era 100% dos casos.
 *
 * ⭐ Os dias viraram offsets em MINUTOS a partir de agora, preservando a ORDEM que cada teste
 * precisa (ontem < 14 < 16 < 17). *Fixture que não reproduz a ordem de lançamento de prod não
 * prova nada sobre prod.*
 */
const AGORA = Date.now()
const H = 3_600_000
/** o dia do fato, em offsets — negativo é passado, e a ordem é o que importa */
const FATO = {
  antes: new Date(AGORA - 72 * H),   // fora da janela (era 10/09)
  meio: new Date(AGORA - 20 * H),    // dentro (era 13/09)
  dia: new Date(AGORA - 10 * H),     // dentro (era 15/09)
}
/** as contagens acontecem AGORA (como em prod: depois dos movimentos existirem) */
const QUANDO: Record<string, Date> = {
  '2026-09-13': new Date(AGORA + 1 * 60_000),
  '2026-09-14': new Date(AGORA + 2 * 60_000),
  '2026-09-16': new Date(AGORA + 3 * 60_000),
  '2026-09-17': new Date(AGORA + 4 * 60_000),
}
const diaISO = (d: Date) => new Date(+d - 3 * H).toISOString().slice(0, 10)
const JANELA = { de: diaISO(new Date(AGORA - 24 * H)), ate: diaISO(new Date(AGORA + 5 * 60_000)) }

/** cria a contagem do jeito que a tela cria: linha + AJUSTE_CONTAGEM na mesma história */
async function contar(itemId: string, quando: string, saldoSistema: number, contou: number, custo: number) {
  const contadoEm = QUANDO[quando] ?? new Date(AGORA + 9 * 60_000)
  const divergencia = Math.round((contou - saldoSistema) * 1000) / 1000
  const mov = divergencia === 0 ? null : await criarMovimento(prisma, {
    companyId, itemId, tipo: 'AJUSTE_CONTAGEM', quantidade: divergencia,
    custoUnitario: custo, custoTotal: Math.round(divergencia * custo * 100) / 100,
    origem: 'MANUAL', dataMovimento: contadoEm,
  })
  const sessao = await prisma.stockContagem.create({
    data: { companyId, tipo: 'ROTINA', status: 'FINALIZADA', iniciadaEm: contadoEm, finalizadaEm: contadoEm },
  })
  await prisma.stockContagemItem.create({
    data: {
      companyId, contagemId: sessao.id, itemId, saldoSistema, qtdContada: contou, divergencia,
      custoUnitario: custo, valorDivergencia: Math.round(divergencia * custo * 100) / 100,
      movementId: mov?.id ?? null, contadoEm, contadoPorNome: 'marcyelle',
    },
  })
}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'MESA' } })
  companyId = c.id
  const a = await prisma.stockItem.create({ data: { companyId, nome: 'COCA COLA 600ML', unidadeControle: 'UN', categoria: 'REVENDA', criadoVia: 'CONFERENCIA' } })
  const b = await prisma.stockItem.create({ data: { companyId, nome: 'porçao queijo 135 grama', unidadeControle: 'KG', categoria: 'INTERMEDIARIO', criadoVia: 'MANUAL' } })
  coca = a.id; queijo = b.id
  // compra antes do período (forma o INÍCIO) + venda dentro
  await criarMovimento(prisma, { companyId, itemId: coca, tipo: 'ENTRADA_NF', quantidade: 100, custoUnitario: 3, custoTotal: 300, origem: 'SEFAZ', dataMovimento: FATO.antes })
  await criarMovimento(prisma, { companyId, itemId: coca, tipo: 'BAIXA_VENDA', quantidade: -12, custoUnitario: 3, custoTotal: -36, origem: 'MANUAL', dataMovimento: FATO.dia })
  await criarMovimento(prisma, { companyId, itemId: queijo, tipo: 'PRODUCAO_GERACAO', quantidade: 20, custoUnitario: 4, custoTotal: 80, origem: 'MANUAL', dataMovimento: FATO.meio })
  await criarMovimento(prisma, { companyId, itemId: queijo, tipo: 'BAIXA_VENDA', quantidade: -5, custoUnitario: 4, custoTotal: -20, origem: 'MANUAL', dataMovimento: FATO.dia })
  await prisma.stockRadarWatchlist.createMany({ data: [
    { companyId, lista: 'REVENDA', itemId: coca },
    { companyId, lista: 'PORCOES', itemId: queijo },
  ] })
})
afterEach(async () => {
  for (const t of ['stockContagemItem', 'stockContagem', 'stockRadarWatchlist', 'stockMesaPreferencia', 'stockMovement', 'stockItem', 'stockSaldoCache'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

const rodarRadar = () => calcularFechamentoDoDia(
  { companyId, de: JANELA.de, ate: JANELA.ate, caros: [], revenda: [coca], porcoes: [queijo] }, prisma,
)

describe('⛔⛔⛔ Σ(mesa) == Σ(Radar) — a lei 0', () => {
  it('⭐⭐ sem filtro, a mesa soma EXATAMENTE o que o placar do Radar soma', async () => {
    await contar(coca, '2026-09-16', 88, 86, 3)   // faltou 2 un
    await contar(queijo, '2026-09-16', 15, 15, 4) // bateu
    const radar = await rodarRadar()
    const mesa = montarMesa(radar)
    const soma = somaDaMesa(mesa)
    // ⚠️ o placar do Radar é ABSOLUTO + tom (desenho de 20/09) — a comparação é campo a
    // campo, senão o guard acusaria divergência onde só há convenção de sinal.
    expect(soma.absoluto).toBe(radar.placar.valor)
    expect(soma.tom).toBe(radar.placar.tom)
    expect(soma.itensContados).toBe(radar.placar.itensContados)
    expect(soma.valor).toBe(-6) // 2 un × R$ 3, assinado
  })

  it('⭐ e com FILTRO ela soma o recorte — nunca o total escondido', async () => {
    await contar(coca, '2026-09-16', 88, 86, 3)
    await contar(queijo, '2026-09-16', 15, 13, 4)
    const radar = await rodarRadar()
    expect(somaDaMesa(montarMesa(radar)).valor).toBe(-14) // −6 da coca − 8 do queijo
    expect(somaDaMesa(montarMesa(radar, [coca])).valor).toBe(-6)
    expect(montarMesa(radar, [coca]).flatMap((s) => s.linhas)).toHaveLength(1)
  })

  it('⛔⛔ e o cálculo PARALELO que morreu discordava — o caso do item contado 2× no período', async () => {
    /**
     * ⭐ É a prova de que a lei 0 não é preferência de estilo. `calcularRealVsTeorico`
     * somava TODOS os ajustes do período; o Radar usa a ÚLTIMA contagem. Com duas
     * contagens, os dois davam números diferentes pro MESMO item, e nenhuma tela dizia
     * qual era a certa.
     */
    await contar(coca, '2026-09-14', 90, 85, 3)  // −5 un
    await contar(coca, '2026-09-17', 85, 84, 3)  // −1 un (a que vale)
    const radar = await rodarRadar()
    const mesa = somaDaMesa(montarMesa(radar, [coca]))
    const velho = await calcularRealVsTeorico({ companyId, de: JANELA.de, ate: JANELA.ate }, prisma)
    const linhaVelha = velho.linhas.find((l) => l.itemId === coca)!

    expect(mesa.valor, 'a mesa usa a ÚLTIMA contagem').toBe(-3)     // 1 un × R$ 3
    expect(linhaVelha.varianciaValor, 'o motor velho somava as DUAS').toBe(-18) // 6 un × R$ 3
    expect(mesa.valor).not.toBe(linhaVelha.varianciaValor) // ⛔ eram duas verdades
  })
})

describe('⭐ as colunas e o que cada uma diz', () => {
  it('⭐⭐ a linha FECHA na horizontal: início + entrou + produziu + vendeu + perdeu + separado == teórico', async () => {
    await contar(queijo, '2026-09-16', 15, 15, 4)
    const radar = await rodarRadar()
    const l = linhaDaMesa(radar.porcoes[0])
    const soma = (l.inicio ?? 0) + l.entrou + l.produziu + l.vendeu + l.perdeu + l.separado + l.outros
    expect(Math.round(soma * 1000) / 1000).toBe(l.teorico)
    expect(l.produziu).toBe(20)
    expect(l.vendeu).toBe(-5) // ⭐ o sinal é o do ledger — é ele que faz a conta fechar
  })

  it('⛔⛔ a linha FECHA na horizontal com TODOS os baldes — e o "sem explicação" é a rede', async () => {
    /**
     * ⚠️ Achado na PROVA EM PROD: a «porçao queijo 135 grama» tinha as colunas somando 937
     * e o teórico 934. O motor já sabia (`naoExplicado`), mas a MESA não carregava o campo
     * — a tabela mostraria os dois números e nada explicando os 3.
     *
     * ⚠️⚠️ ASSERÇÃO ATUALIZADA EM 02/10, COM O MOTIVO ESCRITO. Ela afirmava *"o motor EXCLUI
     * AJUSTE dos baldes, então a conta horizontal não fecha"* — e isso virou o defeito que a
     * lei *"a conta de padeiro SOMA SEMPRE"* mata: o ajuste do meio da janela passou a ter
     * LINHA (`ajustes`), e a mesa passou a carregar os baldes sem coluna própria (`outros`).
     * ⭐ A metade que CONTINUA valendo: **a horizontal tem que fechar**, e o `naoExplicado`
     * segue sendo a rede pro resíduo de verdade (hoje: import lançado depois da contagem).
     */
    await contar(coca, '2026-09-16', 88, 86, 3)
    const radar = await rodarRadar()
    const l = linhaDaMesa(radar.revenda[0])
    const horizontal = (l.inicio ?? 0) + l.entrou + l.produziu + l.vendeu + l.perdeu + l.separado + l.outros
    expect(Math.round((horizontal + l.naoExplicado) * 1000) / 1000,
      'início + TODOS os baldes + naoExplicado tem que dar o teórico, sempre').toBe(l.teorico)
    // ⛔ e o ajuste do meio da janela tem LINHA, não é resíduo
    expect(l.outros, 'o ajuste da janela sumiu da conta').toBe(-2)
  })

  it('⛔⛔ REAL sem contagem é null — NUNCA número inventado', async () => {
    const radar = await rodarRadar() // ninguém contou
    for (const l of montarMesa(radar).flatMap((s) => s.linhas)) {
      expect(l.real, `${l.nome} inventou um "real"`).toBeNull()
      expect(l.variancia).toBeNull()
      expect(l.veredito).toBe('SEM_CONTAGEM')
      // ⭐ mas o que o sistema SABE continua na mesa (início, entrou, teórico)
      expect(l.teorico).not.toBeNull()
    }
  })

  it('⭐ a linha carrega a JANELA que ela cobre — duas linhas podem ter janelas diferentes', async () => {
    await contar(coca, '2026-09-13', 100, 100, 3)   // contagem anterior da coca
    await contar(coca, '2026-09-17', 88, 86, 3)
    await contar(queijo, '2026-09-16', 15, 15, 4)   // 1ª contagem do queijo
    const radar = await rodarRadar()
    const porItem = new Map(montarMesa(radar).flatMap((s) => s.linhas).map((l) => [l.itemId, l]))
    // ⚠️ a cena é relativa ao relógio (ver o topo): o "desde" é o DIA da contagem anterior,
    // e as duas contagens da coca estão a minutos de distância — então a janela é do mesmo dia
    expect(porItem.get(coca)!.desde).toBe(diaISO(QUANDO['2026-09-13']!))
    expect(porItem.get(coca)!.diasDaJanela, 'minutos de distância arredondam pra 0 dia').toBe(0)
    expect(porItem.get(queijo)!.desde, 'sem contagem anterior a janela não tem começo').toBeNull()
  })

  it('⭐ o % é sobre o que ROTACIONOU, e some quando nada rotacionou', async () => {
    await contar(coca, '2026-09-16', 88, 86, 3)
    const radar = await rodarRadar()
    const l = linhaDaMesa(radar.revenda[0])
    expect(l.pct).toBeCloseTo(2 / 12, 3) // 2 un de furo sobre 12 vendidas
  })
})

describe('⛔⛔ o subtotal obedece a lei UN ≠ KG', () => {
  it('⭐ a quantidade sai POR UNIDADE; só o dinheiro soma tudo', async () => {
    await contar(coca, '2026-09-16', 88, 86, 3)    // −2 UN
    await contar(queijo, '2026-09-16', 15, 13.5, 4) // −1,5 KG
    const radar = await rodarRadar()
    const mesa = montarMesa(radar)
    const revenda = mesa.find((s) => s.chave === 'revenda')!
    const porcoes = mesa.find((s) => s.chave === 'porcoes')!
    expect(revenda.total.faltouPorUnidade).toEqual({ UN: 2 })
    expect(porcoes.total.faltouPorUnidade).toEqual({ KG: 1.5 })
    // ⛔ nenhum subtotal tem um número só misturando as duas
    for (const s of mesa) {
      const unidades = Object.keys(s.total.faltouPorUnidade)
      expect(unidades.length, 'o subtotal somou unidades diferentes num número só').toBeLessThanOrEqual(1)
    }
    expect(somaDaMesa(mesa).valor).toBe(-12) // −6 + −6, e dinheiro SOMA
  })

  it('⛔ "falta contar" fica FORA do total e o rodapé DIZ isso', async () => {
    await contar(coca, '2026-09-16', 88, 86, 3)
    const radar = await rodarRadar()
    const mesa = montarMesa(radar)
    const porcoes = mesa.find((s) => s.chave === 'porcoes')!
    expect(porcoes.total.itensSemContagem).toBe(1)
    expect(porcoes.total.faltouPorUnidade).toEqual({}) // não virou zero
    expect(frasesDoRodape(porcoes.total).join(' · ')).toContain('1 sem contagem — fora dos totais')
  })
})

describe('⭐ a escolha de colunas', () => {
  it('⛔ R$ e % nascem DESLIGADOS — esta tela olha quantidade', () => {
    expect(COLUNAS_PADRAO).not.toContain('valor')
    expect(COLUNAS_PADRAO).not.toContain('pct')
    expect(COLUNAS_PADRAO).toContain('variancia')
    expect(COLUNAS.map((c) => c.chave)).toContain('perdeu')
  })

  it('⛔⛔ chave inventada é descartada, e lista vazia NUNCA vira tela sem coluna', () => {
    expect(colunasValidas(['inicio', 'inventada', 'real'])).toEqual(['inicio', 'real'])
    expect(colunasValidas([])).toEqual(COLUNAS_PADRAO)
    expect(colunasValidas(['so', 'lixo'])).toEqual(COLUNAS_PADRAO)
    expect(colunasValidas(null)).toEqual(COLUNAS_PADRAO)
    expect(colunasValidas(['real', 'real'])).toEqual(['real']) // sem repetida
  })
})
