/**
 * ⭐⭐⭐ UMA ORDEM = UM CARTÃO — A CICATRIZ DE 12/10/2026, PRA SEMPRE.
 *
 * **O caso real, com os números do dono:** a ordem da MAIONESE apareceu **duas vezes** na lista
 * do dia — *"aguardando conferência · fez 34,236"* e *"✓✓ corrigido e conferido (era 34,236) ·
 * fez 34,296"*. A faixa do topo somou as duas: **68,53 KG** num dia de **34,30**. Idem a
 * calabresa (**107 + 127**), o *"Concluídas hoje 20"* (real 18), o *"1.723 UN"* e o
 * *"R$ 5.516,73"*.
 *
 * ⛔⛔ **ESTE ARQUIVO É CICATRIZ, não teste de feature** (ordem explícita do dono): *"esse teste
 * do caso real de 12/10 fica na suíte PRA SEMPRE: reintroduziu em qualquer consumidor, CI
 * vermelho antes do deploy"*. Ele percorre **TODOS os consumidores** da porta, um a um, com os
 * números reais — então o décimo leitor que nascer sem a régua fica vermelho aqui, não na tela
 * do dono.
 *
 * ⚠️ **E o ESTOQUE sempre esteve certo** (passo 0, medido em prod): o ledger é
 * `+34,236 → −34,236 (estorno) → +34,296` = líquido 34,296, UMA vez. O defeito era de LEITURA.
 *
 * ⚠️ **AS DATAS SÃO RELATIVAS AO RELÓGIO, de propósito** (a REGRA 12 de 01/09): a correção
 * grava a conclusão nova com o instante REAL, então janela de data fixa deixaria o teste verde
 * hoje e vermelho no dia em que o calendário passasse dela. **A cicatriz são os NÚMEROS**
 * (34,236 → 34,296 · 107 → 127), não o dia.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarMovimento } from '../../movement'
import { saldosDaEmpresa } from '../../saldo'
import { corrigirConclusao, carimbosDasConclusoes } from '../conferencia'
import { filaDeConferencia } from '../fila-de-conferencia'
import { conclusoesNoPeriodo, listConclusoes, rendimentoMedidoDaFicha } from '../conclusao'
import { lotesDaJanela } from '../lotes'
import { cardsDoPainel } from '../painel-producao'
import { fiscalDeOrdens } from '../fiscal-dos-lotes'
import { execucoesDaJanela } from '../execucoes'
import { relatorioPorDia } from '../relatorio-por-dia'
import { buildEtiqueta } from '../etiqueta'
import { conclusoesVigentes, listagemSemOrdemRepetida } from '../conclusoes-vigentes'

const CNPJ = '13141516000113'
let companyId = ''
let fichaMaio = ''
let ordemMaio = ''
let ordemCala = ''
let itemMaio = ''
let itemCala = ''
let insumoId = ''
let declaranteId = ''
let USER_GERENTE = ''

/** ⭐ o "agora" e a janela, derivados do relógio — nunca data fixa em posição de relógio */
const AGORA = new Date()
const QUANDO = AGORA
const DE = new Date(AGORA.getTime() - 2 * 3_600_000)
const ATE = new Date(AGORA.getTime() + 2 * 3_600_000)
const DEPOIS = new Date(AGORA.getTime() + 3_600_000)

async function receita(nome: string, unidade: string, loteBase: number) {
  const prod = await prisma.stockItem.create({
    data: { companyId, nome, unidadeControle: unidade, categoria: 'INTERMEDIARIO', criadoVia: 'MANUAL' },
  })
  const f = await prisma.stockFicha.create({
    data: { companyId, itemProduzidoId: prod.id, tipoProduto: 'INTERMEDIARIO', versaoAtual: 1 },
  })
  const v = await prisma.stockFichaVersao.create({
    data: { companyId, fichaId: f.id, versao: 1, loteBase, unidadeLoteBase: unidade },
  })
  await prisma.stockFichaComponente.create({
    data: { companyId, versaoId: v.id, itemId: insumoId, qtdPlanejada: 1, unidade: 'KG', posicao: 0 },
  })
  const o = await prisma.stockProductionOrder.create({
    data: {
      companyId, fichaId: f.id, versaoFicha: 1, itemProduzidoId: prod.id,
      escalaReceitas: 12, estado: 'CONCLUIDA', dataProducao: QUANDO,
    },
  })
  return { fichaId: f.id, ordemId: o.id, itemId: prod.id }
}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'UMA ORDEM UM CARTAO' } })
  companyId = c.id

  const insumo = await prisma.stockItem.create({
    data: { companyId, nome: 'OVO', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' },
  })
  insumoId = insumo.id
  const m = await receita('MAIONESE', 'KG', 2.858)
  const k = await receita('porcao de calabresa 100 grama', 'UN', 10)
  fichaMaio = m.fichaId; ordemMaio = m.ordemId; itemMaio = m.itemId
  ordemCala = k.ordemId; itemCala = k.itemId

  const dec = await prisma.stockColaborador.create({ data: { companyId, nome: 'viviane' } })
  declaranteId = dec.id

  const papel = await prisma.role.findFirst({ where: { name: 'GERENTE_ESTOQUE', companyId: null } })
    ?? await prisma.role.create({ data: { name: 'GERENTE_ESTOQUE', isSystemDefault: true, companyId: null } })
  const g = await prisma.user.create({ data: { email: `g-${c.id}@teste.local`, name: 'marcyelle', password: 'x' } })
  await prisma.userCompanyRole.create({ data: { userId: g.id, companyId, roleId: papel.id } })
  USER_GERENTE = g.id
})

afterEach(async () => {
  for (const t of [
    prisma.stockConclusaoCarimbo, prisma.stockConclusaoEstornada, prisma.stockProducaoDesvio,
    prisma.stockProducaoConclusao, prisma.stockMovement, prisma.stockOrdemEtapa,
    prisma.stockFichaComponente, prisma.stockFichaVersao, prisma.stockFicha,
    prisma.stockProductionOrder, prisma.stockOrdemMeta,
    prisma.stockColaborador, prisma.stockItem, prisma.stockSaldoCache,
  ]) {
    await (t as { deleteMany: (a: unknown) => Promise<unknown> }).deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  await prisma.user.deleteMany({ where: { id: { in: [USER_GERENTE].filter(Boolean) } } })
})

/** declara o lote como o motor real: geração no ledger + a conclusão */
async function declarar(ordemId: string, itemId: string, qtd: number, custoLote: number) {
  const unit = custoLote / qtd
  await criarMovimento(prisma, {
    companyId, itemId, tipo: 'PRODUCAO_GERACAO', quantidade: qtd,
    custoUnitario: unit, custoTotal: custoLote, receiptId: ordemId, origem: 'MANUAL',
  })
  return prisma.stockProducaoConclusao.create({
    data: {
      companyId, ordemId, qtdGerada: qtd, colaboradorId: declaranteId,
      escalaConsumida: 12, custoLoteReal: custoLote,
      custoUnitarioReal: Math.round(unit * 100) / 100,
      rendimento: Math.round((qtd / 12) * 10000) / 10000,
      criadoEm: QUANDO,
    },
  })
}

/** ⭐ o caso real: declara 34,236 e o gerente corrige pra 34,296 (e 107 → 127) */
async function oDia12() {
  const cMaio = await declarar(ordemMaio, itemMaio, 34.236, 376.11)
  const cCala = await declarar(ordemCala, itemCala, 107, 263.02)
  const rMaio = await corrigirConclusao(
    { companyId, conclusaoId: cMaio.id, qtdCerta: 34.296, motivo: 'CONTOU_ERRADO', userId: USER_GERENTE }, prisma,
  )
  const rCala = await corrigirConclusao(
    { companyId, conclusaoId: cCala.id, qtdCerta: 127, motivo: 'CONTOU_ERRADO', userId: USER_GERENTE }, prisma,
  )
  return { velhaMaio: cMaio.id, velhaCala: cCala.id, novaMaio: rMaio.conclusaoNovaId, novaCala: rCala.conclusaoNovaId }
}

// ───────────────────────── PASSO 0: o estoque ─────────────────────────

describe('⭐⭐ PASSO 0 — o ESTOQUE creditou UMA vez (o ledger sempre esteve certo)', () => {
  it('⭐⭐ a maionese entra 34,296 uma vez · a calabresa 127 uma vez', async () => {
    await oDia12()
    const saldos = await saldosDaEmpresa(prisma, companyId)
    expect(saldos.find((s) => s.itemId === itemMaio)?.saldo).toBeCloseTo(34.296, 2)
    expect(saldos.find((s) => s.itemId === itemCala)?.saldo).toBe(127)

    /** ⭐ e o ledger conta a história: geração → estorno → geração (correção = estorno + novo) */
    const movs = await prisma.stockMovement.findMany({
      where: { companyId, itemId: itemMaio }, select: { quantidade: true }, orderBy: { dataMovimento: 'asc' },
    })
    expect(movs).toHaveLength(3)
    expect(movs.reduce((s, m) => s + m.quantidade, 0)).toBeCloseTo(34.296, 2)
  })
})

// ───────────────────── A CICATRIZ: consumidor por consumidor ─────────────────────

describe('⛔⛔⛔ A CICATRIZ DE 12/10 — o dia NÃO soma a declaração desfeita', () => {
  it('⛔⛔⛔ a LISTA do dia: 2 cartões, não 4 — e com o número CONFERIDO', async () => {
    const ids = await oDia12()
    const lista = await conclusoesNoPeriodo(companyId, DE, ATE, prisma)
    expect(lista, 'uma ordem = um cartão').toHaveLength(2)
    expect(lista.map((c) => c.qtdGerada).sort((a, b) => a - b)).toEqual([34.296, 127])
    expect(lista.map((c) => c.id).sort()).toEqual([ids.novaMaio, ids.novaCala].sort())
    /** ⛔ o número VELHO não aparece em cartão nenhum */
    expect(lista.some((c) => c.qtdGerada === 34.236 || c.qtdGerada === 107), 'o fantasma').toBe(false)
  })

  it('⛔⛔⛔ a FAIXA DO TOPO: 34,296 KG e 127 UN — nunca 68,53', async () => {
    await oDia12()
    const lista = await conclusoesNoPeriodo(companyId, DE, ATE, prisma)
    const kg = lista.filter((c) => c.ordemId === ordemMaio).reduce((s, c) => s + c.qtdGerada, 0)
    const un = lista.filter((c) => c.ordemId === ordemCala).reduce((s, c) => s + c.qtdGerada, 0)
    expect(kg, 'o número do dono: 68,53 era 34,236 + 34,296').toBeCloseTo(34.296, 3)
    expect(un, 'e a calabresa carregava os 107 velhos').toBe(127)
  })

  it('⛔⛔ o CARD "Concluídas hoje" conta LOTES VIVOS, não eventos', async () => {
    await oDia12()
    const p = await cardsDoPainel(companyId, { de: DE, ate: ATE }, DEPOIS, prisma)
    expect(p.concluidasNoPeriodo, '20 → 18 no dado real; aqui 4 → 2').toBe(2)
    /** ⛔ e o R$: o custo do lote NÃO muda na correção, então somar as duas dobrava EXATO */
    expect(p.valorProduzidoNoPeriodo).toBeCloseTo(376.11 + 263.02, 2)
  })

  /**
   * ⚠️⚠️ **A TOLERÂNCIA AQUI É DELIBERADA, e ela nomeia um achado:** `lotesDaJanela` arredonda
   * o `entregue` em **2 casas** (`Math.round(v.entregue * 100) / 100`), então a tela mostra
   * **34,3** onde o ledger guarda **34,296** — e o relatório por dia herda, porque consome
   * ele. É **arredondamento de LEITURA, pré-existente, alheio a esta cicatriz** (o módulo
   * trabalha em 3 casas por causa de grama/ml), e travá-lo aqui faria o teste do cartão duplo
   * guardar a régua de arredondamento de outro arquivo — quebrando no dia em que alguém
   * legitimamente a mudasse.
   *
   * ⭐ O que a cicatriz afirma é o que importa: **UM lote, não o dobro** — 68,53 fica a uma
   * ordem de grandeza da tolerância, então o defeito continua mordendo.
   */
  it('⛔⛔ `lotesDaJanela` (relatório por dia, placar, selo da linha): 2 lotes', async () => {
    await oDia12()
    const lotes = await lotesDaJanela(companyId, { de: DE, ate: ATE }, prisma)
    expect(lotes).toHaveLength(2)
    const [kg, un] = lotes.map((l) => l.entregue).sort((a, b) => a - b)
    expect(kg, 'o dobro (68,53) está longe desta tolerância').toBeCloseTo(34.296, 1)
    expect(un).toBe(127)
  })

  it('⛔⛔ o RELATÓRIO POR DIA não dobra o dia', async () => {
    await oDia12()
    const r = await relatorioPorDia(companyId, { de: DE, ate: ATE }, prisma)
    expect(r.linhas).toHaveLength(2)
    expect(r.dias.reduce((s, d) => s + d.lotes, 0), 'nenhum dia conta o fantasma').toBe(2)
    const [kg, un] = r.linhas.map((l) => l.produzido).sort((a, b) => a - b)
    expect(kg).toBeCloseTo(34.296, 1)
    expect(un).toBe(127)
  })

  it('⛔⛔⛔ o FISCAL mede o declarado CONFERIDO — senão acusaria um lote CERTO', async () => {
    await oDia12()
    const f = await fiscalDeOrdens(companyId, [ordemMaio, ordemCala], prisma)
    expect(f.get(ordemMaio)!.declarado, 'somando as duas daria 68,53 contra material de ~34').toBeCloseTo(34.296, 3)
    expect(f.get(ordemCala)!.declarado).toBe(127)
  })

  it('⛔ as EXECUÇÕES (un/min por pessoa) não carregam o número velho', async () => {
    await oDia12()
    /** ⚠️ sem etapa não há execução — o que se afirma aqui é a FONTE, pela porta */
    const vivas = await conclusoesVigentes(companyId, { ordemIds: [ordemMaio, ordemCala] }, prisma)
    expect(vivas).toHaveLength(2)
    const ex = await execucoesDaJanela(companyId, { de: DE, ate: ATE }, prisma)
    for (const e of ex) expect(e.unidades === 34.236 || e.unidades === 107, 'número velho em execução').toBe(false)
  })

  it('⛔⛔ a FILA do gerente não pede conferência de um número já substituído', async () => {
    await oDia12()
    const fila = await filaDeConferencia(companyId, prisma, DEPOIS)
    expect(fila.aguardando, 'as duas foram conferidas na correção').toBe(0)
    expect(fila.cartoes).toHaveLength(0)
  })

  it('⛔ o RENDIMENTO MEDIDO da ficha usa o número conferido', async () => {
    await oDia12()
    const r = await rendimentoMedidoDaFicha(companyId, fichaMaio, prisma)
    expect(r.lotes, 'um lote, não dois').toBe(1)
    expect(r.media).toBeCloseTo(34.296 / 12, 4)
  })
})

// ───────────────────── O RASTRO É LEI ─────────────────────

describe('⭐⭐ O RASTRO NÃO MORRE — o que morre é o cartão duplicado', () => {
  it('⭐⭐ a PÁGINA DA ORDEM mostra as duas, com a desfeita MARCADA', async () => {
    const ids = await oDia12()
    const cs = await listConclusoes(companyId, ordemMaio, prisma)
    expect(cs, 'a história inteira').toHaveLength(2)
    const velha = cs.find((c) => c.id === ids.velhaMaio)!
    const nova = cs.find((c) => c.id === ids.novaMaio)!
    expect(velha.estornada, 'a antiga é história').toBe(true)
    expect(nova.estornada, 'a nova vale').toBeFalsy()
    expect(velha.qtdGerada).toBe(34.236)
  })

  it('⭐ e o carimbo diz "era 34,236" (o rastro que o dono já lia)', async () => {
    const ids = await oDia12()
    const m = await carimbosDasConclusoes(companyId, [ids.novaMaio], prisma)
    const c = m.get(ids.novaMaio)!
    expect(c.estado).toBe('CORRIGIDA_E_CONFERIDA')
    expect(c.corrigiuDe).toBe(34.236)
    expect(c.conferidoPorNome).toBe('marcyelle')
  })

  /** ⛔⛔ a desfeita NÃO pode aparecer como "aguardando conferência" — era o cartão fantasma */
  it('⛔⛔ a desfeita não fica pedindo conferência', async () => {
    const ids = await oDia12()
    const m = await carimbosDasConclusoes(companyId, [ids.velhaMaio], prisma)
    /**
     * ⚠️ ela segue SEM carimbo (o carimbo foi pra a nova) — e é justamente por isso que a
     * LISTA tem que ler a PORTA, nunca a ausência de carimbo.
     */
    expect(m.get(ids.velhaMaio)!.estado).toBe('AGUARDANDO_CONFERENCIA')
    const fila = await filaDeConferencia(companyId, prisma, DEPOIS)
    expect(fila.cartoes.some((c) => c.conclusaoId === ids.velhaMaio), 'mas não está na fila').toBe(false)
  })
})

// ───────────────────── AS TRAVAS QUE A FAMÍLIA EXIGIU ─────────────────────

describe('⛔⛔ O QUE NÃO SE FAZ COM UMA DECLARAÇÃO DESFEITA', () => {
  it('⛔⛔ não se corrige duas vezes (estornaria um movimento já estornado)', async () => {
    const ids = await oDia12()
    await expect(
      corrigirConclusao({ companyId, conclusaoId: ids.velhaMaio, qtdCerta: 40, motivo: 'CONTOU_ERRADO', userId: USER_GERENTE }, prisma),
    ).rejects.toThrow(/já foi corrigida/i)
    /** ⛔ e nada nasceu: continuam 2 conclusões e 3 movimentos */
    expect(await prisma.stockProducaoConclusao.count({ where: { companyId, ordemId: ordemMaio } })).toBe(2)
    expect(await prisma.stockMovement.count({ where: { companyId, itemId: itemMaio } })).toBe(3)
  })

  it('⛔⛔ a ETIQUETA do lote desfeito não sai — ela colaria o número velho no freezer', async () => {
    const ids = await oDia12()
    await expect(buildEtiqueta(companyId, ids.velhaMaio, prisma)).rejects.toThrow(/corrigida/i)
    const boa = await buildEtiqueta(companyId, ids.novaMaio, prisma)
    expect(boa!.qtdGerada).toBeCloseTo(34.296, 3)
  })
})

// ───────────────────── O INVARIANTE DE GUARDA ─────────────────────

describe('⭐⭐⭐ O INVARIANTE: nenhuma ordem 2× em listagem de período', () => {
  it('⭐⭐⭐ vale em TODAS as listagens do período', async () => {
    await oDia12()
    const lista = await conclusoesNoPeriodo(companyId, DE, ATE, prisma)
    const lotes = await lotesDaJanela(companyId, { de: DE, ate: ATE }, prisma)
    const rel = await relatorioPorDia(companyId, { de: DE, ate: ATE }, prisma)
    const listagens: Array<[string, Array<{ ordemId: string; parcial?: boolean }>]> = [
      ['lista do dia', lista.map((c) => ({ ordemId: c.ordemId, parcial: c.parcial }))],
      ['lotes da janela', lotes.map((l) => ({ ordemId: l.ordemId }))],
      ['relatório por dia', rel.linhas.map((l) => ({ ordemId: l.ordemId }))],
    ]
    for (const [nome, linhas] of listagens) {
      const v = listagemSemOrdemRepetida(linhas)
      expect(v.ok, `${nome}: ${JSON.stringify(v.repetidas)}`).toBe(true)
    }
  })

  it('⭐⭐⭐ total do período == soma dos estados ATUAIS', async () => {
    await oDia12()
    const vivas = await conclusoesVigentes(companyId, { de: DE, ate: ATE }, prisma)
    const p = await cardsDoPainel(companyId, { de: DE, ate: ATE }, DEPOIS, prisma)
    expect(p.valorProduzidoNoPeriodo).toBeCloseTo(vivas.reduce((s, c) => s + c.custoLoteReal, 0), 2)
    expect(p.concluidasNoPeriodo).toBe(vivas.length)
  })

  /**
   * ⚠️⚠️ **A EXCEÇÃO NOMEADA, e sem ela o invariante seria ERRADO.** Produção PARCIAL é
   * legítima e desenhada (*"300 hoje, 200 amanhã"*): ali duas conclusões vivas da mesma ordem
   * são **dois lotes de verdade**, e colapsá-las apagaria metade do que saiu da cozinha.
   * *Invariante que falha no caso legítimo é pior que invariante nenhum* (a lição de 14/08).
   */
  it('⭐⭐ produção PARCIAL: duas linhas da MESMA ordem são legítimas e SOMAM', async () => {
    await prisma.stockProducaoConclusao.create({
      data: {
        companyId, ordemId: ordemCala, qtdGerada: 60, colaboradorId: declaranteId,
        escalaConsumida: 6, custoLoteReal: 100, custoUnitarioReal: 1.67, rendimento: 10,
        parcial: true, criadoEm: QUANDO,
      },
    })
    await prisma.stockProducaoConclusao.create({
      data: {
        companyId, ordemId: ordemCala, qtdGerada: 67, colaboradorId: declaranteId,
        escalaConsumida: 6, custoLoteReal: 100, custoUnitarioReal: 1.49, rendimento: 11.17,
        parcial: true, criadoEm: new Date(QUANDO.getTime() + 60_000),
      },
    })
    const lista = await conclusoesNoPeriodo(companyId, DE, ATE, prisma)
    expect(lista, 'as duas parciais aparecem').toHaveLength(2)
    expect(lista.reduce((s, c) => s + c.qtdGerada, 0), 'e SOMAM 127').toBe(127)
    const v = listagemSemOrdemRepetida(lista.map((c) => ({ ordemId: c.ordemId, parcial: c.parcial })))
    expect(v.ok, 'parcial não é repetição').toBe(true)
  })

  /** ⛔ e a MESMA ordem com duas NÃO-parciais vivas é repetição — o invariante morde */
  it('⛔ duas não-parciais vivas da mesma ordem: o invariante ACUSA', () => {
    const v = listagemSemOrdemRepetida([{ ordemId: 'o1' }, { ordemId: 'o1' }, { ordemId: 'o2' }])
    expect(v.ok).toBe(false)
    expect(v.repetidas).toEqual([{ ordemId: 'o1', vezes: 2 }])
  })
})
