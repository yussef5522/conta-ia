// ⭐⭐ CONTAGEM COM DIREÇÃO — o motor EXECUTADO contra o banco (REGRA 3), com relógio fixo.
// R36 o que conta hoje · R43 excluir zona nunca apaga item / sem zona no fim · R37 assinatura
// (conta logada e PIN do aparelho) · R40 acuracidade · R41 história · R42 recibo.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { criarMovimento } from '../../movement'
import { cadastrarPessoa } from '@/lib/stock/producao/cadastrar-pessoa'
import {
  carregarBase, montarPosto, listaDeHoje, assinarZona, reciboDaSessao, historiaDoItem,
  DirecaoError, SEM_ZONA, CHAVE_SESSAO,
} from '../direcao-dados'
import { criarZona, excluirZona, adicionarItemNaZona, definirGrupo, ordenarZona, zonasDoDono } from '../zonas'

const CNPJ = '50607080000777'
const AGORA = new Date('2026-11-23T20:00:00Z') // 17:00 em Brasília
const diasAtras = (n: number, h = 15) => new Date(Date.parse('2026-11-23T00:00:00Z') - n * 86_400_000 + h * 3_600_000)
let companyId = ''
const it_: Record<string, string> = {}
let camara = ''
let bebidas = ''
let antiga = ''
let sessaoAberta = ''
let userId = ''
let tabletId = ''

async function contagemPassada(quando: Date, linhas: { item: string; div: number; valor?: number; quem?: string }[]) {
  const c = await prisma.stockContagem.create({ data: { companyId, tipo: 'ROTINA', status: 'FINALIZADA', iniciadaEm: quando, finalizadaEm: quando } })
  for (const l of linhas) {
    await prisma.stockContagemItem.create({
      data: {
        companyId, contagemId: c.id, itemId: it_[l.item], saldoSistema: 10, qtdContada: 10 + l.div, divergencia: l.div,
        custoUnitario: 2, valorDivergencia: l.valor ?? l.div * 2, contadoPorNome: l.quem ?? 'Michele', contadoEm: quando,
      },
    })
  }
  return c.id
}

beforeAll(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'EMPRESA DIRECAO' } })).id
  const mk = async (k: string, nome: string, un = 'UN') => {
    it_[k] = (await prisma.stockItem.create({ data: { companyId, nome, unidadeControle: un, categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' } })).id
    await criarMovimento(prisma, { companyId, itemId: it_[k], tipo: 'ENTRADA_NF', quantidade: 50, custoUnitario: 10, origem: 'SEFAZ', dataMovimento: diasAtras(40) })
  }
  await mk('queijo', 'QUEIJO EM PEÇA', 'KG')
  await mk('brahma', 'BRAHMA LATA')
  await mk('sal', 'SAL')
  await mk('nunca', 'FRUKI 2L')
  await mk('solto', 'COXÃO MOLE', 'KG')
  await mk('parado', 'GUARDANAPO')
  // giro 30d: o "nunca" vende (é candidato); o "parado" não vende (não é)
  await criarMovimento(prisma, { companyId, itemId: it_.nunca, tipo: 'BAIXA_VENDA', quantidade: -6, custoUnitario: 10, origem: 'MANUAL', dataMovimento: diasAtras(3) })
  await criarMovimento(prisma, { companyId, itemId: it_.queijo, tipo: 'BAIXA_VENDA', quantidade: -4, custoUnitario: 10, origem: 'MANUAL', dataMovimento: diasAtras(2) })

  // história: queijo ontem (bateu) · brahma há 9 dias (ajustou) · sal em 4 dias desta semana (último HOJE)
  // · solto há 2 dias · parado há 60 dias
  antiga = await contagemPassada(diasAtras(9), [{ item: 'brahma', div: -3, valor: -19.19 }])
  await contagemPassada(diasAtras(60), [{ item: 'parado', div: 0 }])
  for (const d of [6, 4, 2]) await contagemPassada(diasAtras(d), [{ item: 'sal', div: d === 4 ? 1 : 0 }])
  await contagemPassada(diasAtras(2), [{ item: 'solto', div: 0.4, valor: 4.61 }])
  await contagemPassada(diasAtras(1), [{ item: 'queijo', div: 0 }])
  await contagemPassada(diasAtras(0, 12), [{ item: 'sal', div: 0 }])

  await definirGrupo(companyId, it_.queijo, 'A', 'dono')
  await definirGrupo(companyId, it_.solto, 'A', 'dono')
  camara = (await criarZona(companyId, 'Câmara fria', 'dono')).id
  bebidas = (await criarZona(companyId, 'Bebidas', 'dono')).id
  await adicionarItemNaZona(companyId, camara, it_.sal, 'dono')
  await adicionarItemNaZona(companyId, camara, it_.queijo, 'dono')
  await adicionarItemNaZona(companyId, bebidas, it_.brahma, 'dono')

  sessaoAberta = (await prisma.stockContagem.create({ data: { companyId, tipo: 'ROTINA', status: 'ABERTA', iniciadaEm: diasAtras(0, 19) } })).id

  const role = await prisma.role.create({ data: { companyId, name: 'equipe-direcao' } })
  userId = (await prisma.user.create({ data: { email: 'michele-direcao@t.com', password: 'x', name: 'Michele' } })).id
  tabletId = (await prisma.user.create({ data: { email: 'tablet-direcao@t.com', password: 'x', name: 'Tablet' } })).id
  await prisma.userCompanyRole.create({ data: { companyId, userId, roleId: role.id } })
  await prisma.userCompanyRole.create({ data: { companyId, userId: tabletId, roleId: role.id, ehAparelho: true } })
  await cadastrarPessoa({ companyId, nome: 'Tauan', funcao: 'COZINHA', pin: '4826' }, prisma)
})

afterAll(async () => {
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_update;`).catch(() => {})
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_delete;`).catch(() => {})
  for (const t of ['stockContagemAssinatura', 'stockContagemZonaItem', 'stockContagemZona', 'stockItemGrupo', 'stockContagemRitmo', 'stockContagemVersao', 'stockContagemItem', 'stockContagem', 'stockMovement', 'stockSaldoCache', 'stockColaboradorPin', 'stockColaboradorPapel', 'stockColaborador', 'userCompanyRole', 'role'] as const) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any)[t].deleteMany({ where: { companyId } })
  }
  await prisma.user.deleteMany({ where: { id: { in: [userId, tabletId] } } })
  await prisma.stockItem.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('R36 — o que conta hoje', () => {
  it('⛔ a sessão NÃO abre com todos os itens sem regra: só os que vencem; atrasados primeiro; sem zona no FIM', async () => {
    const b = await carregarBase(companyId, AGORA, prisma)
    const hoje = listaDeHoje(b.itens, b.ritmo).map((i) => i.itemId)
    expect(b.itens).toHaveLength(6)
    // brahma: B sugerido (1 contagem em 28d), 9 dias → ATRASADO · queijo: A decidido, ontem → vence
    // parado: C sugerido, 60 dias, SEM ZONA · solto: A decidido, 2 dias, SEM ZONA
    expect(hoje).toEqual([it_.brahma, it_.queijo, it_.parado, it_.solto])
    expect(hoje).not.toContain(it_.sal) // contado hoje (4 dias em 28 → A sugerido): não vence
    expect(hoje).not.toContain(it_.nunca) // nunca contado e sem grupo: fila própria (candidato)
  })
  it('a sugestão do grupo: ≥ 4 dias contados em 4 semanas → A', async () => {
    const b = await carregarBase(companyId, AGORA, prisma)
    const sal = b.itens.find((i) => i.itemId === it_.sal)!
    expect(sal.grupoSugerido).toBe('A')
    expect(sal.grupoDecidido).toBeNull()
  })
})

describe('R40 — o posto de comando', () => {
  it('acuracidade da ÚLTIMA contagem de cada item, com o critério do "Bateram"', async () => {
    const p = montarPosto(await carregarBase(companyId, AGORA, prisma))
    // últimas: queijo 0 · brahma −3 · sal 0 (hoje) · solto 0,4 · parado 0 → 3 de 5
    expect(p.acuracidade).toMatchObject({ dentro: 3, total: 5, pct: 60 })
  })
  it('nunca contados + candidatos (com giro), e R$ sob contagem do grupo A', async () => {
    const p = montarPosto(await carregarBase(companyId, AGORA, prisma))
    expect(p.nuncaContados.total).toBe(1)
    expect(p.nuncaContados.candidatos.map((c) => c.itemId)).toEqual([it_.nunca])
    // A = queijo, solto (decididos) + sal (sugerido). Só o queijo gira: 4 × R$ 10
    expect(p.sobContagem).toMatchObject({ valor: 40, itens: 3 })
  })
  it('o mapa: cartão por zona + "sem zona" quando alguém dela vence; escopo da zona na ORDEM dela', async () => {
    const p = montarPosto(await carregarBase(companyId, AGORA, prisma))
    // (as duas zonas nascem no mesmo instante: a ordem entre elas não é o assunto) — "sem zona" é SEMPRE o último
    expect(p.zonas.slice(0, 2).map((z) => [z.nome, z.hoje]).sort()).toEqual([['Bebidas', 1], ['Câmara fria', 1]])
    expect(p.zonas[2]).toMatchObject({ nome: 'sem zona', hoje: 2 })
    expect(p.zonas.find((z) => z.chave === camara)!.ultima?.quem).toBe('Michele')
    expect(p.escopos[`zona:${SEM_ZONA}`]).toEqual([it_.parado, it_.solto])
    expect(p.hoje.estimadoMin).toBe(4) // 4 itens × 50 s
  })
  it('ajustes por semana (líquido e mexido), 4 barras', async () => {
    const p = montarPosto(await carregarBase(companyId, AGORA, prisma))
    expect(p.ajustesSemanas).toHaveLength(4)
    // esta semana: sal +1 (2,00) e solto +0,4 (4,61) ; brahma (9 dias) cai na anterior
    expect(p.ajustesSemanas[3]).toMatchObject({ liquido: 6.61, mexido: 6.61 })
    expect(p.ajustesSemanas[2].liquido).toBe(-19.19)
  })
})

describe('R43 — as zonas do dono', () => {
  it('ordenar a zona muda o caminho', async () => {
    await ordenarZona(companyId, camara, [it_.queijo, it_.sal], 'dono')
    const z = await zonasDoDono(companyId, prisma)
    expect(z.zonas.find((x) => x.id === camara)!.itens.map((i) => i.itemId)).toEqual([it_.queijo, it_.sal])
  })
  it('⛔ EXCLUIR zona NUNCA apaga item: os itens ficam sem zona e o conta-hoje os mantém (no fim)', async () => {
    const tmp = (await criarZona(companyId, 'Despensa', 'dono')).id
    await adicionarItemNaZona(companyId, tmp, it_.queijo, 'dono') // muda de casa: sai da câmara
    const antes = await prisma.stockItem.count({ where: { companyId } })
    const r = await excluirZona(companyId, tmp, prisma)
    expect(r.itensSemZona).toBe(1)
    expect(await prisma.stockItem.count({ where: { companyId } })).toBe(antes)
    const b = await carregarBase(companyId, AGORA, prisma)
    const hoje = listaDeHoje(b.itens, b.ritmo).map((i) => i.itemId)
    expect(hoje).toContain(it_.queijo)
    expect(hoje.indexOf(it_.queijo)).toBeGreaterThan(hoje.indexOf(it_.brahma))
    expect(b.itens.find((i) => i.itemId === it_.queijo)!.zonaId).toBeNull()
    await adicionarItemNaZona(companyId, camara, it_.queijo, 'dono')
  })
  it('nome de zona repetido é recusado com a frase', async () => {
    await expect(criarZona(companyId, 'câmara fria', 'dono')).rejects.toThrow('Já existe uma zona chamada')
  })
})

describe('R37 — zona fechada ASSINA', () => {
  it('conta logada assina com o próprio nome', async () => {
    const a = await assinarZona({ companyId, contagemId: sessaoAberta, zonaChave: bebidas, userId, userName: 'Michele' }, AGORA, prisma)
    expect(a).toMatchObject({ assinadoPorNome: 'Michele', viaPin: false, zonaNome: 'Bebidas' })
    await expect(assinarZona({ companyId, contagemId: sessaoAberta, zonaChave: bebidas, userId, userName: 'Michele' }, AGORA, prisma))
      .rejects.toThrow('já foi fechada por Michele')
  })
  it('⛔ conta de APARELHO: sem PIN recusa; PIN errado recusa; PIN certo assina com o nome do dono do PIN', async () => {
    const base = { companyId, contagemId: sessaoAberta, zonaChave: camara, userId: tabletId, userName: 'Tablet' }
    await expect(assinarZona(base, AGORA, prisma)).rejects.toMatchObject({ code: 'PIN_OBRIGATORIO' })
    await expect(assinarZona({ ...base, pin: '0000' }, AGORA, prisma)).rejects.toMatchObject({ code: 'PIN_ERRADO' })
    const a = await assinarZona({ ...base, pin: '4826' }, AGORA, prisma)
    expect(a).toMatchObject({ assinadoPorNome: 'Tauan', viaPin: true })
    expect(a.colaboradorId).toBeTruthy()
  })
  it('o posto mostra a zona fechada com quem assinou', async () => {
    const p = montarPosto(await carregarBase(companyId, AGORA, prisma))
    expect(p.zonas.find((z) => z.chave === camara)!.assinada?.quem).toBe('Tauan')
  })
  it('sessão encerrada não aceita assinatura', async () => {
    await expect(assinarZona({ companyId, contagemId: antiga, zonaChave: camara, userId, userName: 'Michele' }, AGORA, prisma))
      .rejects.toBeInstanceOf(DirecaoError)
  })
})

describe('R41 — a história do item', () => {
  it('saldo 14 dias desenhável, pontos das contagens e "nunca bate" só com 5+', async () => {
    const h = await historiaDoItem(companyId, it_.sal, AGORA, prisma)
    expect(h.saldo14).toHaveLength(14)
    expect(h.pontos.length).toBe(4)
    expect(h.pontos.filter((p) => !p.ok)).toHaveLength(1)
    expect(h.nuncaBate).toBe(false)
    expect(h.caixa).toBeNull() // sem vínculo de fornecedor com fator: nada de "cx"
  })
})

describe('R42 — o recibo', () => {
  it('a sessão: bateram, ajustados (líquido e mexido), a apurar, zonas assinadas e a sem assinatura', async () => {
    await prisma.stockContagemItem.create({ data: { companyId, contagemId: sessaoAberta, itemId: it_.brahma, saldoSistema: 10, qtdContada: 7, divergencia: -3, custoUnitario: 6.4, valorDivergencia: -19.19, contadoPorNome: 'Michele', contadoEm: AGORA } })
    await prisma.stockContagemItem.create({ data: { companyId, contagemId: sessaoAberta, itemId: it_.queijo, saldoSistema: 5, qtdContada: 5, divergencia: 0, custoUnitario: 10, valorDivergencia: 0, contadoPorNome: 'Tauan', contadoEm: AGORA } })
    await prisma.stockContagemItem.create({ data: { companyId, contagemId: sessaoAberta, itemId: it_.solto, saldoSistema: 3, qtdContada: 3.4, divergencia: 0.4, custoUnitario: 11.5, valorDivergencia: 4.61, contadoPorNome: 'Michele', contadoEm: AGORA } })
    await prisma.stockContagemVersao.create({ data: { companyId, contagemId: sessaoAberta, itemId: it_.parado, versao: 1, estado: 'NAO_SEI', saldoSistema: 50 } })
    await assinarZona({ companyId, contagemId: sessaoAberta, zonaChave: CHAVE_SESSAO, userId, userName: 'Michele' }, AGORA, prisma)
    const r = await reciboDaSessao(companyId, sessaoAberta, AGORA, prisma)
    expect(r).toMatchObject({ itens: 4, bateram: 1, ajustados: 2, liquido: -14.58, mexido: 23.8, aApurar: 1, acuracidadeSessao: 33, finalizadaPor: 'Michele' })
    expect(r.zonas.map((z) => [z.nome, z.quem]).slice(0, 2).sort()).toEqual([['Bebidas', 'Michele'], ['Câmara fria', 'Tauan']])
    expect(r.zonas[2]).toMatchObject({ nome: 'sem zona', quem: null }) // contada e NÃO assinada: o recibo diz
    expect(r.ajustes[0].nome).toBe('BRAHMA LATA')
  })
})
