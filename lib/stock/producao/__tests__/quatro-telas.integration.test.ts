// ⭐⭐ AS 4 TELAS DA PRODUÇÃO — os motores contra dado de verdade (leis R1–R24, 13/11/2026).
//
// Cada `describe` executa uma régua da lei (REGRA 3: comportamento, nunca grep):
//   AO VIVO      mediana da MESMA etapa (≥5 válidas), âmbar > 1,5×, barra trava em 100%, < 30s "não mediu"
//   DESEMPENHO   barra em ESCALA ÚNICA, < 30s fora do ritmo/horas, escritório fora do ranking, UN ≠ KG
//   EQUIPE       PIN nunca em resposta, excluir sem história apaga / com história some de tudo
//   ROTAS        as 4 telas velhas redirecionam pro destino novo
// Os replantios do sprint mordem AQUI (cada um vira vermelho num teste nomeado).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { signToken, COOKIE_NAME } from '@/lib/auth'
import { criarFicha } from '../fichas'
import { cadastrarPessoa } from '../cadastrar-pessoa'
import { definirPapel } from '../papel-da-conta'
import { aoVivo } from '../ao-vivo'
import { desempenhoDaProducao } from '../desempenho-da-producao'
import { contasDaEquipe, excluirConta, previaDaExclusao, criarConta } from '../contas-da-equipe'
import { hashDoPin } from '../pin'
import { GET as getEquipe, POST as postEquipe } from '@/app/api/empresas/[id]/estoque/producao/equipe/route'
import { GET as getConta, PATCH as patchConta } from '@/app/api/empresas/[id]/estoque/producao/equipe/[colaboradorId]/route'
import PaginaHoje from '@/app/(dashboard)/empresas/[id]/estoque/producao/hoje/page'
import PaginaPorDia from '@/app/(dashboard)/empresas/[id]/estoque/producao/por-dia/page'
import PaginaPessoas from '@/app/(dashboard)/empresas/[id]/estoque/producao/pessoas/page'
import PaginaRelatorios from '@/app/(dashboard)/empresas/[id]/estoque/producao/relatorios/page'

const CNPJ = '41414141000177'
let companyId = ''
let userId = ''
let token = ''
let edmar = '', rodrigo = '', gerente = ''
let beef = { fichaId: '', itemId: '' }
let maionese = { fichaId: '', itemId: '' }
const PIN_EDMAR = '4826'
/** 12/11/2026 em São Paulo (UTC-3) */
const sp = (h: number, m = 0, s = 0, d = 12) => new Date(Date.UTC(2026, 10, d, h + 3, m, s))
const AGORA = sp(15, 0)

async function lote(f: { fichaId: string; itemId: string }, o: { quem: string; etapa: string; ini: Date; fim: Date | null; meta?: number; qtd?: number; custoUn?: number | null; estado?: string }) {
  const ordem = await prisma.stockProductionOrder.create({
    data: { companyId, fichaId: f.fichaId, versaoFicha: 1, itemProduzidoId: f.itemId, escalaReceitas: 1, estado: o.estado ?? 'CONCLUIDA', dataProducao: o.ini },
  })
  await prisma.stockOrdemEtapa.create({ data: { companyId, ordemId: ordem.id, posicao: 0, nome: o.etapa, executorId: o.quem, colaboradorId: o.quem, iniciadoEm: o.ini, finalizadoEm: o.fim } })
  if (o.meta != null) await prisma.stockOrdemMeta.create({ data: { companyId, ordemId: ordem.id, unidades: o.meta } })
  if (o.qtd != null && o.fim) {
    const custo = o.custoUn ?? null
    await prisma.stockProducaoConclusao.create({
      data: { companyId, ordemId: ordem.id, qtdGerada: o.qtd, colaboradorId: o.quem, escalaConsumida: 1, rendimento: o.qtd, custoLoteReal: custo != null ? custo * o.qtd : 0, custoUnitarioReal: custo, criadoEm: o.fim },
    })
  }
  return ordem.id
}

beforeAll(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'QUATRO TELAS' } })).id
  const u = await prisma.user.create({ data: { email: `quatro-${Date.now()}@t.com`, password: 'x', name: 'Dono' } })
  userId = u.id
  const role = (await prisma.role.findFirst({ where: { name: 'OWNER' } })) ?? (await prisma.role.create({ data: { name: 'OWNER', isSystemDefault: true } }))
  await prisma.userCompanyRole.create({ data: { userId, companyId, roleId: role.id } })
  token = await signToken({ sub: userId, email: u.email, name: 'Dono', role: 'USER' })

  const carne = (await prisma.stockItem.create({ data: { companyId, nome: 'Carne', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' } })).id
  await prisma.stockMovement.create({ data: { companyId, itemId: carne, tipo: 'ENTRADA_NF', quantidade: 500, custoUnitario: 30, custoTotal: 15000, origem: 'SEFAZ' } })
  const b = await criarFicha({ companyId, nomeProduzido: 'BEEF', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO', loteBase: 10, unidadeLoteBase: 'UN', componentes: [{ itemId: carne, qtdPlanejada: 1, unidade: 'KG', posicao: 0 }] }, prisma)
  const m = await criarFicha({ companyId, nomeProduzido: 'MAIONESE', unidadeProduzido: 'KG', tipoProduto: 'INTERMEDIARIO', loteBase: 3, unidadeLoteBase: 'KG', componentes: [{ itemId: carne, qtdPlanejada: 1, unidade: 'KG', posicao: 0 }] }, prisma)
  beef = { fichaId: b.fichaId, itemId: b.itemProduzidoId }
  maionese = { fichaId: m.fichaId, itemId: m.itemProduzidoId }

  edmar = (await cadastrarPessoa({ companyId, nome: 'edmar', funcao: 'COZINHA', pin: PIN_EDMAR }, prisma)).colaboradorId!
  rodrigo = (await cadastrarPessoa({ companyId, nome: 'rodrigo', funcao: 'COZINHA', pin: '7351' }, prisma)).colaboradorId!
  gerente = (await cadastrarPessoa({ companyId, nome: 'gerente', funcao: 'COZINHA', pin: '9182' }, prisma)).colaboradorId!
  await definirPapel({ companyId, colaboradorId: gerente, papel: 'escritorio' }, prisma)

  // história do BEEF/PREPARO: 5 medições de 60min (dia 01/11) → mediana 3600s
  for (let i = 0; i < 5; i++) await lote(beef, { quem: edmar, etapa: 'PREPARO', ini: sp(10 + i, 0, 0, 1), fim: sp(11 + i, 0, 0, 1), meta: 100, qtd: 100, custoUn: 3 })
  // HOJE (12/11)
  await lote(beef, { quem: edmar, etapa: 'PREPARO', ini: sp(10), fim: sp(11), meta: 100, qtd: 95, custoUn: 3.5 })          // 60min · no ritmo
  await lote(beef, { quem: rodrigo, etapa: 'PREPARO', ini: sp(10), fim: sp(10, 0, 10), meta: 100, qtd: 50, custoUn: 3.5 })  // 10s · tempo de mentira · 50% fora
  await lote(maionese, { quem: rodrigo, etapa: 'BATER', ini: sp(9), fim: sp(9, 30), meta: 3, qtd: 3.2, custoUn: 9 })          // 30min · KG · sem mediana
  await lote(beef, { quem: gerente, etapa: 'PREPARO', ini: sp(8), fim: sp(9), meta: 100, qtd: 100, custoUn: 3.5 })           // escritório
  await lote(beef, { quem: edmar, etapa: 'PREPARO', ini: sp(12), fim: null, estado: 'EM_PRODUCAO' })                         // na mão: 3h contra 1h
})

afterAll(async () => {
  for (const t of ['stockOrdemEtapaParticipante', 'stockOrdemEtapa', 'stockProducaoConclusao', 'stockOrdemMeta', 'stockProductionOrder', 'stockColaboradorPapel', 'stockColaboradorPin', 'stockColaborador', 'stockSaldoCache', 'stockMovement', 'stockFichaEtapa', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockItem'] as const) {
    await (prisma[t] as unknown as { deleteMany: (a: unknown) => Promise<unknown> }).deleteMany({ where: { companyId } })
  }
  await prisma.userCompanyRole.deleteMany({ where: { companyId } })
  await prisma.user.deleteMany({ where: { id: userId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('AO VIVO — R3/R4/R7', () => {
  it('na mão agora: mediana da MESMA etapa (5 medições), âmbar acima de 1,5×, barra trava em 100%', async () => {
    const v = await aoVivo(companyId, AGORA, prisma)
    expect(v.naMao).toHaveLength(1)
    const [m] = v.naMao
    expect(m.oQue).toBe('BEEF')
    expect(m.seg).toBe(3 * 3600)
    expect(m.medSeg, 'a mediana da etapa BEEF/PREPARO').toBe(3600)
    expect(m.cor).toBe('ambar')
    expect(m.pct, 'a barra passou de 100%').toBe(100)
  })
  it('concluídas: < 30s é "tempo não mediu" — sem barra e fora da mediana; MAIONESE sem 5 medições = sem mediana', async () => {
    const v = await aoVivo(companyId, AGORA, prisma)
    const lotes = v.eventos.filter((e) => e.tipo === 'lote')
    expect(lotes).toHaveLength(4)
    const mentira = lotes.find((e) => e.tipo === 'lote' && e.seg === 10)!
    expect(mentira.tipo === 'lote' && mentira.mentira).toBe(true)
    expect(mentira.tipo === 'lote' && mentira.pct).toBeNull()
    const mai = lotes.find((e) => e.oQue === 'MAIONESE')!
    expect(mai.tipo === 'lote' && mai.medSeg).toBeNull()
    expect(v.recusasRegistradas).toBe(false)
    expect(v.pulso.pontos).toHaveLength(v.eventos.length)
  })
})

describe('DESEMPENHO — R10/R11/R12/R13/R14/R15', () => {
  it('⛔ escritório FORA do ranking (R13): o gerente vai pra "fora da comparação"', async () => {
    const d = await desempenhoDaProducao(companyId, { tipo: 'hoje' }, AGORA, prisma)
    expect(d.pessoas.map((p) => p.quem)).toEqual(['rodrigo', 'edmar'])
    expect(d.fora.map((p) => [p.quem, p.papel])).toEqual([['gerente', 'escritorio']])
  })
  it('⛔ barra em ESCALA ÚNICA (R11): o maior da COLUNA é 100% — rodrigo tem mais lotes, edmar mais horas', async () => {
    const d = await desempenhoDaProducao(companyId, { tipo: 'hoje' }, AGORA, prisma)
    const r = d.pessoas.find((p) => p.quem === 'rodrigo')!, e = d.pessoas.find((p) => p.quem === 'edmar')!
    expect([r.lotes, e.lotes]).toEqual([2, 1])
    expect([r.barLotes, e.barLotes]).toEqual([100, 50])
    expect([r.min, e.min]).toEqual([30, 60])
    expect([r.barMin, e.barMin], 'cada linha com a própria régua (a cicatriz do rodrigo 1.238 × edmar 1.003)').toEqual([50, 100])
  })
  it('⛔ < 30s fica fora das horas e do ritmo e é contado à parte (R10)', async () => {
    const d = await desempenhoDaProducao(companyId, { tipo: 'hoje' }, AGORA, prisma)
    const r = d.pessoas.find((p) => p.quem === 'rodrigo')!, e = d.pessoas.find((p) => p.quem === 'edmar')!
    expect(r.semTempo).toBe(1)
    expect(r.ritmo, 'os 10s entraram no ritmo').toBeNull()
    expect(e.ritmo).toBe(100)
  })
  it('⛔ cada receita na SUA unidade (R14): BEEF em UN e MAIONESE em KG nunca se somam', async () => {
    const d = await desempenhoDaProducao(companyId, { tipo: 'hoje' }, AGORA, prisma)
    expect(d.receitas.map((r) => [r.r, r.un, r.lotes, r.ped, r.feito])).toEqual([
      ['BEEF', 'UN', 3, 300, 245],
      ['MAIONESE', 'KG', 1, 3, 3.2],
    ])
  })
  it('rendimento contra 70–130% com "N fora" (R12); custo real × ficha (R15); lotes por trás (R16)', async () => {
    const d = await desempenhoDaProducao(companyId, { tipo: 'hoje' }, AGORA, prisma)
    const b = d.receitas.find((r) => r.r === 'BEEF')!
    expect(b.rend).toBe(82)
    expect(b.fora).toBe(1)
    expect(b.custo).toBe(3.5)
    expect(b.lotesPorTras).toHaveLength(3)
  })
})

describe('EQUIPE — R21/R23', () => {
  it('⛔ o PIN NUNCA sai em resposta: nem o PIN, nem o hash — na lib e nas 3 rotas', async () => {
    const proibidos = [PIN_EDMAR, hashDoPin(companyId, PIN_EDMAR), 'pinHash']
    const lista = JSON.stringify(await contasDaEquipe(companyId, prisma))
    const req = (url: string, init?: { method: string; body?: unknown }) => {
      const r = new NextRequest(`http://localhost/api/empresas/${companyId}/estoque/producao/equipe${url}`, { method: init?.method ?? 'GET', body: init?.body ? JSON.stringify(init.body) : undefined, headers: { 'Content-Type': 'application/json' } })
      r.cookies.set(COOKIE_NAME, token)
      return r
    }
    const g = await (await getEquipe(req(''), { params: Promise.resolve({ id: companyId }) })).text()
    const novo = await postEquipe(req('', { method: 'POST', body: { nome: 'nadine', papel: 'cozinha', pin: '6047' } }), { params: Promise.resolve({ id: companyId }) })
    const nTxt = await novo.text()
    const nadine = JSON.parse(nTxt).colaboradorId as string
    const p = await (await patchConta(req(`/${edmar}`, { method: 'PATCH', body: { pin: '5193' } }), { params: Promise.resolve({ id: companyId, colaboradorId: edmar }) })).text()
    const prev = await (await getConta(req(`/${nadine}`), { params: Promise.resolve({ id: companyId, colaboradorId: nadine }) })).text()
    for (const txt of [lista, g, nTxt, p, prev]) for (const x of [...proibidos, '6047', '5193', hashDoPin(companyId, '6047')]) expect(txt, `vazou "${x}"`).not.toContain(x)
    expect(JSON.parse(g).contas.find((c: { nome: string }) => c.nome === 'edmar').temPin).toBe(true)
    await excluirConta(companyId, nadine, prisma)
  })
  it('⛔ excluir COM história some de tudo — nunca apaga (R23)', async () => {
    const prev = await previaDaExclusao(companyId, rodrigo, prisma)
    expect(prev.destino).toBe('some-das-telas')
    expect(prev.frase).toContain('2 lotes e 0 tarefas ficam na história')
    const r = await excluirConta(companyId, rodrigo, prisma)
    expect(r.destino).toBe('some-das-telas')
    const c = await prisma.stockColaborador.findUnique({ where: { id: rodrigo } })
    expect(c, 'apagou quem tinha história — os relatórios antigos perdem o nome').toBeTruthy()
    expect(c!.ativo).toBe(false)
    expect(await prisma.stockColaboradorPin.count({ where: { colaboradorId: rodrigo, revogadoEm: null } }), 'continua no teclado de PIN').toBe(0)
    expect((await contasDaEquipe(companyId, prisma)).map((x) => x.nome)).not.toContain('rodrigo')
    // o nome vive nos relatórios do período em que trabalhou
    const d = await desempenhoDaProducao(companyId, { tipo: 'hoje' }, AGORA, prisma)
    expect(d.pessoas.map((p) => p.quem)).toContain('rodrigo')
  })
  it('⭐ excluir SEM história apaga de vez (conta, PIN e papel)', async () => {
    const { colaboradorId } = await criarConta({ companyId, nome: 'engano', papel: 'escritorio', pin: '3816' }, prisma)
    expect((await previaDaExclusao(companyId, colaboradorId, prisma)).destino).toBe('apaga')
    const r = await excluirConta(companyId, colaboradorId, prisma)
    expect(r.destino).toBe('apaga')
    expect(await prisma.stockColaborador.count({ where: { id: colaboradorId } })).toBe(0)
    expect(await prisma.stockColaboradorPin.count({ where: { colaboradorId } })).toBe(0)
    expect(await prisma.stockColaboradorPapel.count({ where: { colaboradorId } })).toBe(0)
  })
})

describe('ROTAS — as 4 telas velhas morreram e redirecionam (R1)', () => {
  const destino = async (Pagina: (p: { params: Promise<{ id: string }> }) => Promise<unknown>) => {
    try { await Pagina({ params: Promise.resolve({ id: 'emp1' }) }); return null } catch (e) {
      const d = (e as { digest?: string }).digest ?? ''
      return d.split(';').find((x) => x.startsWith('/')) ?? d
    }
  }
  it.each([
    ['hoje', PaginaHoje, '/empresas/emp1/estoque/producao/ao-vivo'],
    ['por-dia', PaginaPorDia, '/empresas/emp1/estoque/producao/desempenho'],
    ['pessoas', PaginaPessoas, '/empresas/emp1/estoque/producao/desempenho'],
    ['relatorios', PaginaRelatorios, '/empresas/emp1/estoque/producao/desempenho'],
  ] as const)('%s → redireciona', async (_n, Pagina, alvo) => {
    expect(await destino(Pagina as never)).toBe(alvo)
  })
})
