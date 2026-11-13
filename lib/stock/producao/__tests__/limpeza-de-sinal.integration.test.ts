// ⭐⭐ LIMPEZA DE SINAL DA PRODUÇÃO (13/11/2026) — os consertos que as telas novas exigem.
// Cada caso nasce do raio-X de 13/11 em prod; a régua aqui EXECUTA o comportamento (REGRA 3).

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '@/lib/db'
import { criarFicha } from '../fichas'
import { criarOrdem, confirmarSeparacao } from '../ordens'
import { etapasDaOrdem, designarEtapa } from '../etapas'
import { iniciarTarefa } from '../minhas-tarefas'
import { concluir } from '../conclusao'
import { cadastrarPessoa } from '../cadastrar-pessoa'
import { encerrarEtapaFantasma, EtapaFantasmaError } from '../encerrar-etapas-abertas'
import { relatorioPorDia, janelaDoPorDia } from '../relatorio-por-dia'
import { lotesDaJanela } from '../lotes'
import { execucoesDaJanela, execucoesParaMedia } from '../execucoes'
import { unidadesPorPessoa } from '../relatorios'
import { cardsDoPainel, lotesDoPeriodo } from '../painel-producao'
import { custoMedioPorItem, saldosDoCache, recomputeSaldoCache } from '@/lib/stock/saldo'
import { faixaDoRodape } from '../mesa-da-cozinha'
import { palavraDoDia } from '../palavra-do-dia'
import { pctDoDiario } from '../eficiencia-da-ordem'
import { produzirAvisosDeProducao } from '@/lib/avisos/produtores/producao'
import { janelaDoDiaSP } from '@/lib/datas/dia-sao-paulo'
import type { Execucao } from '../desempenho'

const CNPJ = '13112026000177'
let companyId = ''
let fichaId = ''
let acem = ''
let rodrigo = ''
const DIA = '2026-11-12'
const emSP = (h: number, m = 0, d = 12) => new Date(Date.UTC(2026, 10, d, h + 3, m))

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'LIMPEZA DE SINAL' } })).id
  acem = (await prisma.stockItem.create({ data: { companyId, nome: 'Acém', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' } })).id
  await prisma.stockMovement.create({ data: { companyId, itemId: acem, tipo: 'ENTRADA_NF', quantidade: 500, custoUnitario: 30, custoTotal: 15000, origem: 'SEFAZ' } })
  fichaId = (await criarFicha({
    companyId, nomeProduzido: 'Beef de xis', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO',
    loteBase: 10, unidadeLoteBase: 'UN', validadeDias: 10, etapas: [{ nome: 'beef' }],
    componentes: [{ itemId: acem, qtdPlanejada: 1, unidade: 'KG', posicao: 0 }],
  }, prisma)).fichaId
  rodrigo = (await cadastrarPessoa({ companyId, nome: 'rodrigo', funcao: 'COZINHA', pin: '7351' }, prisma)).colaboradorId!
})
afterEach(async () => {
  for (const t of ['aviso', 'stockEtapaEncerrada', 'stockOrdemEtapa', 'stockProducaoDesvio', 'stockProducaoConclusao', 'stockSaldoCache', 'stockColaboradorPin', 'stockColaborador', 'stockMovement', 'stockOrdemMeta', 'stockProductionOrder', 'stockFichaEtapa', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockItem'] as const) {
    await (prisma[t] as unknown as { deleteMany: (a: unknown) => Promise<unknown> }).deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

async function ordemSeparada(dataProducao = emSP(6)) {
  const { ordemId } = await criarOrdem({ companyId, fichaId, escalaReceitas: 1, dataProducao }, prisma)
  await confirmarSeparacao(companyId, ordemId, [{ itemId: acem, qtdSeparada: 1 }], prisma)
  return ordemId
}
async function etapaIniciada(ordemId: string, quando: Date) {
  const [e] = await etapasDaOrdem(companyId, ordemId, quando, prisma)
  await designarEtapa({ companyId, etapaId: e.id, colaboradorId: rodrigo }, prisma)
  await iniciarTarefa({ companyId, etapaId: e.id, colaboradorId: rodrigo }, prisma)
  await prisma.stockOrdemEtapa.update({ where: { id: e.id }, data: { iniciadoEm: quando } })
  return e.id
}
const fecharLote = async (ordemId: string, qtd: number, quando: Date) => {
  const r = await concluir({ companyId, ordemId, qtdGerada: qtd, colaboradorId: rodrigo, userId: 'u-escritorio', confirmouGrandeza: true, consumo: [{ itemId: acem, qtdConsumida: 1 }] }, prisma)
  await prisma.stockProducaoConclusao.update({ where: { id: r.conclusaoId }, data: { criadoEm: quando } })
  await prisma.stockProducaoDesvio.updateMany({ where: { conclusaoId: r.conclusaoId }, data: { criadoEm: quando } })
  return r.conclusaoId
}

describe('1 · ETAPA FANTASMA — fechada com marca, tempo a apurar, nada apagado', () => {
  /** o caso real: "QUEM VAI PRODUZIR" iniciada 14/09 18:06, ordem CANCELADA sem registro de encerramento */
  async function fantasma() {
    const ordemId = await ordemSeparada()
    const etapaId = await etapaIniciada(ordemId, emSP(18, 6))
    await prisma.stockProductionOrder.update({ where: { id: ordemId }, data: { estado: 'CANCELADA' } }) // o caminho antigo, sem levar a etapa
    return { ordemId, etapaId }
  }

  it('fecha com o motivo administrativo, sem carimbar fim, e a tela DIZ', async () => {
    const { ordemId, etapaId } = await fantasma()
    const antes = { etapas: await prisma.stockOrdemEtapa.count({ where: { companyId } }), enc: await prisma.stockEtapaEncerrada.count({ where: { companyId } }) }
    expect(antes.enc).toBe(0)
    await encerrarEtapaFantasma({ companyId, etapaId }, prisma)
    const reg = await prisma.stockEtapaEncerrada.findUniqueOrThrow({ where: { etapaId } })
    expect(reg.motivo).toBe('ENCERRADA_ADMINISTRATIVAMENTE')
    const e = await prisma.stockOrdemEtapa.findUniqueOrThrow({ where: { id: etapaId } })
    expect(e.finalizadoEm, 'carimbou um fim que ninguém mediu').toBeNull()
    expect(e.executorId, 'o rastro de quem começou não se apaga').toBe(rodrigo)
    expect(await prisma.stockOrdemEtapa.count({ where: { companyId } }), 'apagou etapa').toBe(antes.etapas)
    const [vista] = await etapasDaOrdem(companyId, ordemId, new Date(), prisma)
    expect(vista.estado).toBe('ENCERRADA_SEM_FINALIZAR')
    expect(vista.minutos, 'tempo a apurar').toBeNull()
    const dm = reg.encerradaEm.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })
    expect(vista.rotulo).toBe(`encerrada administrativamente em ${dm} — ordem já estava encerrada`)
  })
  it('⛔ recusa a 2ª vez, a ordem viva e a etapa já finalizada — sem escrever', async () => {
    const { etapaId } = await fantasma()
    await encerrarEtapaFantasma({ companyId, etapaId }, prisma)
    await expect(encerrarEtapaFantasma({ companyId, etapaId }, prisma)).rejects.toThrow(EtapaFantasmaError)
    const viva = await ordemSeparada()
    const ev = await etapaIniciada(viva, emSP(15))
    await expect(encerrarEtapaFantasma({ companyId, etapaId: ev }, prisma)).rejects.toThrow(/ordem ainda está viva/)
    expect(await prisma.stockEtapaEncerrada.count({ where: { companyId } })).toBe(1)
  })
})

describe('2 · O AVISO DE PADRÃO LÊ O DIÁRIO NA ESCALA CERTA (razão → %)', () => {
  it('3 lotes que BATERAM (razão 1,0) não viram aviso — era o "dispara sempre" dos 48 avisos', async () => {
    for (let i = 0; i < 3; i++) await fecharLote(await ordemSeparada(), 10, emSP(15 + i, 0, 10 + i))
    const d = await prisma.stockProducaoDesvio.findMany({ where: { companyId } })
    expect(d.map((x) => x.pctTeorico), 'o diário grava TODO lote, em razão').toEqual([1, 1, 1])
    await produzirAvisosDeProducao(companyId, prisma)
    expect(await prisma.aviso.count({ where: { companyId, origem: 'PADRAO_RENDIMENTO', resolvidoEm: null } })).toBe(0)
  })
  it('3 lotes seguidos a 60% viram UM aviso — o sinal de verdade continua', async () => {
    for (let i = 0; i < 3; i++) await fecharLote(await ordemSeparada(), 6, emSP(15 + i, 0, 10 + i))
    await produzirAvisosDeProducao(companyId, prisma)
    expect(await prisma.aviso.count({ where: { companyId, origem: 'PADRAO_RENDIMENTO', resolvidoEm: null } })).toBe(1)
  })
  it('a porta: 1,049 → 104,9%; 0 é "sem régua" (null), nunca 0%', () => {
    expect(pctDoDiario(1.049)).toBe(104.9)
    expect(pctDoDiario(10.27)).toBe(1027)
    expect(pctDoDiario(0)).toBeNull()
    expect(pctDoDiario(null)).toBeNull()
  })
})

describe('3 · POR DIA no dia de BRASÍLIA — o lote das 22h30 fica no dia dele', () => {
  it('lote fechado às 22h30 de 12/11 (01h30 UTC de 13/11) entra em 12/11', async () => {
    await fecharLote(await ordemSeparada(emSP(6)), 10, emSP(22, 30))
    const { janela } = janelaDoPorDia(DIA, DIA, '2026-11-13')
    expect(janela).toEqual(janelaDoDiaSP(DIA, DIA))
    const r = await relatorioPorDia(companyId, janela, prisma)
    expect(r.linhas.map((l) => l.dia)).toEqual([DIA])
    // a janela antiga (UTC) perdia este lote — o defeito, escrito
    const utc = await relatorioPorDia(companyId, { de: new Date(`${DIA}T00:00:00.000Z`), ate: new Date(`${DIA}T23:59:59.999Z`) }, prisma)
    expect(utc.linhas).toHaveLength(0)
  })
  it('a rota usa a régua da lib, nunca o Z cravado', () => {
    const rota = readFileSync(join(process.cwd(), 'app/api/empresas/[id]/estoque/producao/relatorio-por-dia/route.ts'), 'utf8').replace(/^[ \t]*\/\/.*$/gm, '')
    expect(rota).toContain("janelaDoPorDia(sp.get('de'), sp.get('ate'), diaEmSaoPaulo())")
    expect(rota).not.toMatch(/T00:00:00\.000Z|T23:59:59\.999Z/)
  })
})

describe('4 · RELATÓRIOS: lote e execução na MESMA régua (o fechamento do lote)', () => {
  it('etapa começada às 23h de 11/11 e lote fechado 00h40 de 12/11 conta em 12/11 nos DOIS', async () => {
    const ordemId = await ordemSeparada(emSP(6, 0, 11))
    await etapaIniciada(ordemId, emSP(23, 0, 11))
    await fecharLote(ordemId, 10, emSP(0, 40, 12))
    // ⛔ e uma ordem de OUTRO dia (lote fechado 10/11) nunca entra no período de 12/11
    const outra = await ordemSeparada(emSP(6, 0, 10))
    await etapaIniciada(outra, emSP(15, 0, 10))
    await fecharLote(outra, 10, emSP(16, 0, 10))
    const janela = janelaDoDiaSP(DIA, DIA)
    const lotes = await lotesDaJanela(companyId, janela, prisma)
    expect(lotes.map((l) => l.ordemId)).toEqual([ordemId])
    const novas = await execucoesDaJanela(companyId, { ordemIds: lotes.map((l) => l.ordemId) }, prisma)
    expect(novas.map((e) => e.ordemId), 'a execução sumiu do dia do lote').toEqual([ordemId])
    const peloInicio = await execucoesDaJanela(companyId, janela, prisma)
    expect(peloInicio, 'a régua antiga (início) jogava a execução na véspera').toHaveLength(0)
  })
  it('a rota recorta a execução pelas ordens dos lotes do período', () => {
    const rota = readFileSync(join(process.cwd(), 'app/api/empresas/[id]/estoque/producao/relatorios/route.ts'), 'utf8')
    expect(rota).toContain('execucoesDaJanela(companyId, { ordemIds: lotesTudo.map((l) => l.ordemId), colaboradorId }, prisma)')
  })
  it('o link "por dia" da mesa leva ao Por dia', () => {
    const mesa = readFileSync(join(process.cwd(), 'components/estoque/mesa-da-cozinha.tsx'), 'utf8')
    expect(mesa).toContain("link={{ rotulo: 'por dia', href: `${E}/estoque/producao/por-dia` }}")
    expect(mesa).not.toMatch(/rotulo: 'por dia', href: `\$\{E\}\/estoque\/producao\/relatorios`/)
  })
})

describe('5 · A BARRA NÃO MENTE: um bloco por unidade, barra = o número escrito', () => {
  const ex = (colaboradorId: string, unidades: number, unidade = 'UN'): Execucao => ({
    ordemId: `o-${colaboradorId}-${unidades}-${Math.random()}`, tarefa: unidade === 'UN' ? 'beef' : 'massa', colaboradorId, nome: colaboradorId,
    minutos: 30, unidades, unidade, quando: new Date(),
  })
  it('o print do dono: rodrigo 1.238 UN (2 lotes) × edmar 1.003 UN (5 lotes) + eliane em KG', () => {
    const execs = [ex('rodrigo', 619), ex('rodrigo', 619), ...[1, 2, 3, 4, 5].map(() => ex('edmar', 200.6)), ex('eliane', 20, 'KG')]
    const b = unidadesPorPessoa(execs)
    const un = b.find((x) => x.unidade === 'UN')!
    expect(un.pessoas.map((p) => [p.nome, p.quantidade.texto])).toEqual([['rodrigo', '1.238 UN'], ['edmar', '1.003 UN']])
    expect(un.pessoas[0].proporcao, 'quem fez mais UN tem a barra cheia').toBe(1)
    expect(un.pessoas[1].proporcao).toBe(0.81)
    expect(b.find((x) => x.unidade === 'KG')!.pessoas.map((p) => p.nome), 'KG nunca na régua do UN').toEqual(['eliane'])
  })
})

describe('6 · "hoje" só quando o dia olhado É hoje', () => {
  it('dia passado não diz "ainda hoje"', () => {
    const agora = emSP(10, 0, 13)
    expect(faixaDoRodape({ saiu: '0', nadaSaiu: true, paradas: 0, aguardando: 0, palavra: palavraDoDia(DIA, agora) })).toMatch(/^nenhum lote fechado neste dia ·/)
    expect(faixaDoRodape({ saiu: '40 UN', nadaSaiu: false, paradas: 0, aguardando: 0, palavra: palavraDoDia(DIA, agora) })).toMatch(/^a cozinha produziu 40 UN neste dia ·/)
    expect(faixaDoRodape({ saiu: '0', nadaSaiu: true, paradas: 0, aguardando: 0, palavra: palavraDoDia('2026-11-13', agora) })).toMatch(/^nenhum lote fechado ainda hoje ·/)
  })
  it('a mesa e o Hoje ao vivo usam a palavra do dia e mostram o erro com "tentar de novo"', () => {
    const mesa = readFileSync(join(process.cwd(), 'components/estoque/mesa-da-cozinha.tsx'), 'utf8')
    expect(mesa).toContain('<Vazio>nenhum lote fechado {pd.ainda}</Vazio>')
    expect(mesa).toContain('<Vazio>ninguém registrou tarefa {pd.dia}</Vazio>')
    expect(mesa).not.toMatch(/<Vazio>[^<]*hoje<\/Vazio>/)
    expect(mesa).toContain('data-testid="mesa-tentar-de-novo"')
    const hoje = readFileSync(join(process.cwd(), 'app/(dashboard)/empresas/[id]/estoque/producao/hoje/page.tsx'), 'utf8')
    expect(hoje).toMatch(/\{mesa!\.naoAlcancado\.includes\('dia ao vivo'\) \? \(\s*<p[^>]*data-testid="vivo-falhou"/)
    expect(hoje).toMatch(/data-testid="dia-falhou">Não consegui carregar o dia\. <button type="button" onClick=\{carregar\}/)
  })
})

describe('7 · PESO DO HOJE AO VIVO — a MESMA resposta, mais leve', () => {
  it('a média só das tarefas do dia é a MESMA da história inteira, recortada', async () => {
    for (let i = 0; i < 4; i++) {
      const o = await ordemSeparada(emSP(6, 0, 5 + i))
      await etapaIniciada(o, emSP(15, 0, 5 + i))
      await fecharLote(o, 10, emSP(16, 0, 5 + i))
    }
    const tudo = await execucoesParaMedia(companyId, prisma)
    const doDia = await execucoesParaMedia(companyId, prisma, ['Beef de xis'])
    expect(doDia).toEqual(tudo.filter((e) => e.tarefa === 'Beef de xis'))
    expect(doDia.length).toBe(4)
    expect(await execucoesParaMedia(companyId, prisma, ['outra tarefa'])).toEqual([])
  })
  it('o cartão com lotes e custo (cache) prontos dá o MESMO que lendo tudo', async () => {
    const o = await ordemSeparada(emSP(6))
    await fecharLote(o, 10, emSP(15))
    await ordemSeparada(emSP(6)) // uma aberta com insumo na bancada
    await recomputeSaldoCache(prisma, companyId)
    const janela = janelaDoDiaSP(DIA, DIA)
    const agora = emSP(18)
    const cheio = await cardsDoPainel(companyId, janela, agora, prisma)
    const cache = await saldosDoCache(prisma, companyId)
    const leve = await cardsDoPainel(companyId, janela, agora, prisma, {
      lotes: await lotesDoPeriodo(companyId, janela, prisma), custo: new Map(cache.map((c) => [c.itemId, c.custoMedio])),
    })
    expect(leve).toEqual(cheio)
    expect(cheio.emAberto).toBe(1)
    expect(new Map(cache.map((c) => [c.itemId, c.custoMedio]))).toEqual(await custoMedioPorItem(prisma, companyId))
  })
})
