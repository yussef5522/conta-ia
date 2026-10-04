/**
 * ⭐⭐⭐ A CENTRAL CONTRA O BANCO (04/10/2026) — dedupe, reabertura, "resolvido some" e a LEI.
 *
 * ⚠️ REGRA 3: executa a porta única contra o banco real. Um teste puro provaria a tradução e
 * **não** provaria o que mais importa aqui: que `origem+alvo` é UNIQUE e que 30 rodadas do juiz
 * sobre o mesmo defeito dão **UM** aviso.
 *
 * ⛔⛔ E ele prova as DUAS redes do "aviso mudo": a lib recusa com mensagem boa, **e o CHECK do
 * banco recusa quem tentar gravar por fora dela** (REGRA 5 — o próximo produtor não nasce
 * podendo criar aviso sem ação).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import {
  registrarAviso,
  resolverAviso,
  reconciliarOrigem,
  avisosAbertos,
  avisosDoSetor,
  marcarLido,
  marcarTodosLidos,
} from '../central'
import type { NovoAviso } from '../tipos'

const CNPJ = '76767676000257'
let companyId = ''

function base(over: Partial<NovoAviso> = {}): NovoAviso {
  return {
    companyId,
    setor: 'producao',
    severidade: 'ambar',
    titulo: 'Corrija a ficha de QUEIJO CHEDDAR',
    corpo: 'A ficha pede KG e o produto se conta em UN. Se alguém pedir 10, separa pra 1 só.',
    oQueFazer: 'Abra a ficha e diga quantas UN saem de uma receita.',
    acaoRotulo: 'corrigir a ficha',
    acaoHref: '/empresas/x/estoque/fichas/f1',
    origem: 'FICHA_SEM_COMPARACAO',
    alvo: 'f1',
    ...over,
  }
}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'CENTRAL DE AVISOS' } })
  companyId = c.id
})

afterEach(async () => {
  // ⚠️ `aviso` não cascateia (companyId é VALOR, sem @relation) — apaga explícito
  await prisma.aviso.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
})

describe('⛔⛔ o anti-spam é o UPSERT, não um `if`', () => {
  it('⭐⭐ 30 rodadas do juiz sobre o MESMO problema dão UM aviso', async () => {
    for (let i = 0; i < 30; i++) await registrarAviso(base())
    const abertos = await avisosAbertos(companyId)
    expect(abertos.length, 'o mesmo problema ATUALIZA, nunca cria 10').toBe(1)
    expect(abertos[0].vezes, 'e o contador diz quantas vezes ele reafirmou').toBe(30)
  })

  it('⭐ alvo DIFERENTE é outro problema — dois avisos', async () => {
    await registrarAviso(base({ alvo: 'f1' }))
    await registrarAviso(base({ alvo: 'f2' }))
    expect((await avisosAbertos(companyId)).length).toBe(2)
  })

  it('⭐ a mesma origem em OUTRA empresa não colide (REGRA 8)', async () => {
    await registrarAviso(base())
    const outra = await prisma.company.create({ data: { cnpj: '76767676000333', name: 'OUTRA' } })
    try {
      await registrarAviso(base({ companyId: outra.id }))
      expect((await avisosAbertos(companyId)).length).toBe(1)
      expect((await avisosAbertos(outra.id)).length).toBe(1)
    } finally {
      await prisma.aviso.deleteMany({ where: { companyId: outra.id } })
      await prisma.company.delete({ where: { id: outra.id } })
    }
  })

  it('⭐ o TEXTO é atualizado na rodada nova (o número mudou, a frase acompanha)', async () => {
    await registrarAviso(base({ titulo: 'Corrija a ficha de QUEIJO CHEDDAR' }))
    await registrarAviso(base({ titulo: 'Corrija a ficha de QUEIJO CHEDDAR — 4 lotes seguidos' }))
    const a = (await avisosAbertos(companyId))[0]
    expect(a.titulo).toMatch(/4 lotes seguidos/)
    expect(a.vezes).toBe(2)
  })
})

describe('⭐⭐ resolvido SOME · e problema que volta é notícia de novo', () => {
  it('⭐ resolver tira da tela (sem apagar o rastro)', async () => {
    await registrarAviso(base())
    expect(await resolverAviso(companyId, 'FICHA_SEM_COMPARACAO', 'f1')).toBe(true)
    expect(await avisosAbertos(companyId)).toEqual([])
    // ⭐ a linha FICA no banco — é o que permite reabrir e manter o histórico
    expect(await prisma.aviso.count({ where: { companyId } })).toBe(1)
  })

  it('⭐ resolver duas vezes não é erro (o juiz roda toda noite)', async () => {
    await registrarAviso(base())
    expect(await resolverAviso(companyId, 'FICHA_SEM_COMPARACAO', 'f1')).toBe(true)
    expect(await resolverAviso(companyId, 'FICHA_SEM_COMPARACAO', 'f1')).toBe(false)
  })

  /**
   * ⛔⛔ **REABRIR ZERA O "LIDO" — e é a decisão que impede a pior falha de uma central:** o
   * problema volta, o aviso reabre, e o sininho **CALA** porque o dono já tinha marcado como
   * lido na vez anterior.
   */
  it('⛔⛔ problema que VOLTA reabre e volta a ser NÃO LIDO', async () => {
    const { id } = await registrarAviso(base())
    await marcarLido(companyId, id)
    await resolverAviso(companyId, 'FICHA_SEM_COMPARACAO', 'f1')

    const r = await registrarAviso(base())
    expect(r.reaberto).toBe(true)
    expect(r.id, 'reabre a MESMA linha, não cria outra').toBe(id)
    const a = (await avisosAbertos(companyId))[0]
    expect(a.lido, 'problema que volta é notícia de novo').toBe(false)
  })

  /**
   * ⛔⛔ **SEM A RECONCILIAÇÃO A CENTRAL VIRA CEMITÉRIO.** O dono conserta o CHEDDAR e o aviso
   * do CHEDDAR fica lá pra sempre — em duas semanas ele para de abrir o sininho.
   */
  it('⭐⭐ o que a origem NÃO reportou na rodada é resolvido sozinho', async () => {
    await registrarAviso(base({ alvo: 'f1' }))
    await registrarAviso(base({ alvo: 'f2' }))
    await registrarAviso(base({ alvo: 'f3' }))

    // o juiz da noite seguinte só achou o f2
    const fechados = await reconciliarOrigem(companyId, 'FICHA_SEM_COMPARACAO', ['f2'])
    expect(fechados).toBe(2)
    const abertos = await avisosAbertos(companyId)
    expect(abertos.map((a) => a.alvo)).toEqual(['f2'])
  })

  /** ⚠️ escopado por ORIGEM: um guard que não rodou não pode apagar o aviso de outro */
  it('⛔ a reconciliação de uma origem não toca a de outra', async () => {
    await registrarAviso(base({ origem: 'ORDEM_PARADA', alvo: 'o1', titulo: 'Feche a ordem parada de hoje' }))
    await registrarAviso(base({ alvo: 'f1' }))
    await reconciliarOrigem(companyId, 'FICHA_SEM_COMPARACAO', [])
    const abertos = await avisosAbertos(companyId)
    expect(abertos.map((a) => a.origem)).toEqual(['ORDEM_PARADA'])
  })
})

describe('⛔⛔⛔ A LEI: financeiro NUNCA aparece na produção', () => {
  beforeEach(async () => {
    await registrarAviso(base({ setor: 'producao', alvo: 'p1' }))
    await registrarAviso(base({
      setor: 'financeiro', alvo: 'b1', origem: 'F3',
      titulo: 'Mande o boleto do IVAN pro contas a pagar',
      corpo: 'O boleto de R$ 326,50 foi conferido e nunca chegou ao financeiro — ele vence sem aparecer no fluxo.',
      oQueFazer: 'Abra a nota e mande a parcela pro contas a pagar.',
    }))
    await registrarAviso(base({
      setor: 'sistema', alvo: 's1', origem: 'E12',
      titulo: 'Troque o certificado antes de ele vencer',
      corpo: 'O certificado da empresa vence em menos de 30 dias; sem ele a nota não é baixada da SEFAZ.',
      oQueFazer: 'Abra a tela do certificado e suba o arquivo novo.',
    }))
  })

  it('⛔⛔ o bloco de PRODUÇÃO só traz produção — nem financeiro, nem sistema', async () => {
    const p = await avisosDoSetor(companyId, 'producao')
    expect(p.map((a) => a.setor)).toEqual(['producao'])
    expect(p.length).toBe(1)
  })

  it('⭐ o sininho traz os três (é ele que agrupa por setor)', async () => {
    const todos = await avisosAbertos(companyId)
    expect(new Set(todos.map((a) => a.setor))).toEqual(new Set(['producao', 'financeiro', 'sistema']))
  })

  /** ⚠️ `sistema` não entra em bloco de setor: é aviso sobre o SISTEMA, não sobre o trabalho */
  it('⛔ `sistema` não vaza pro bloco de estoque', async () => {
    expect(await avisosDoSetor(companyId, 'estoque')).toEqual([])
  })
})

describe('⭐ a ordem é a do que dói primeiro', () => {
  it('⭐ vermelho → coral → âmbar → azul → verde', async () => {
    const t = {
      vermelho: 'Corrija a ficha agora',
      coral: 'Feche a ordem parada',
      ambar: 'Revise a receita do beef',
      azul: 'Escolha a categoria do pagamento',
      verde: 'Está tudo certo — conferi a semana',
    } as const
    for (const [sev, titulo] of Object.entries(t)) {
      await registrarAviso(base({
        severidade: sev as never, alvo: `a-${sev}`, titulo,
        oQueFazer: 'Abra a tela e resolva.',
      }))
    }
    const abertos = await avisosAbertos(companyId)
    expect(abertos.map((a) => a.severidade)).toEqual(['vermelho', 'coral', 'ambar', 'azul', 'verde'])
  })
})

describe('⭐ marcar lido ≠ resolver', () => {
  it('⭐ lido continua em aberto (o problema não acabou)', async () => {
    const { id } = await registrarAviso(base())
    expect(await marcarLido(companyId, id)).toBe(true)
    const abertos = await avisosAbertos(companyId)
    expect(abertos.length, 'lido NÃO é resolvido').toBe(1)
    expect(abertos[0].lido).toBe(true)
  })

  it('⭐ marcar tudo lido zera o contador do sininho de uma vez', async () => {
    await registrarAviso(base({ alvo: 'f1' }))
    await registrarAviso(base({ alvo: 'f2' }))
    expect(await marcarTodosLidos(companyId)).toBe(2)
    expect((await avisosAbertos(companyId)).every((a) => a.lido)).toBe(true)
  })
})

describe('⛔⛔ as DUAS redes do aviso mudo (lib + banco)', () => {
  it('⛔ a lib recusa, com a mensagem boa', async () => {
    await expect(registrarAviso(base({ oQueFazer: '' }))).rejects.toThrow(/sem "o que fazer"/)
    expect(await prisma.aviso.count({ where: { companyId } }), 'e nada grava').toBe(0)
  })

  /**
   * ⛔⛔ **REGRA 5: o CHECK do banco é o que torna impossível gravar POR FORA da lib.** Sem ele,
   * o próximo produtor (um guard novo, um script de madrugada) nasceria podendo criar aviso
   * mudo — e a lei do dono voltaria a ser combinado.
   *
   * ⚠️⚠️ **E ESTE TESTE É ESTRUTURAL, ASSUMIDO COMO TAL — pelo mesmo motivo do trigger de
   * imutabilidade do ledger (Fase 1 do estoque).** O `db push` do dev cria a tabela a partir do
   * SCHEMA, e CHECK não existe no schema Prisma — ele mora no SQL da migration, que **só roda
   * em Postgres**. Tentar gravar o aviso mudo aqui PASSA no SQLite, e isso não é o CHECK
   * falhando: é ele não existir neste banco. A prova de comportamento é em prod
   * (`scripts/prova-check-aviso.ts`), exatamente como `scripts/stock-fase1-prova-ledger.ts`.
   */
  it('⛔⛔ a migration DECLARA o CHECK que torna o aviso mudo impossível (prova em prod à parte)', async () => {
    const { readFileSync } = await import('fs')
    void readFileSync
    const sql = readFileSync('prisma/migrations/20261005123000_aviso/migration.sql', 'utf8')
      .replace(/^\s*--.*$/gm, '')
    expect(sql, 'as três frases obrigatórias').toMatch(/chk_aviso_fala/)
    expect(sql).toMatch(/length\(trim\("oQueFazer"\)\) > 0/)
    expect(sql, 'botão pela metade').toMatch(/chk_aviso_acao_completa/)
    /**
     * ⛔⛔ E O CHECK TEM QUE TER O `IS NOT NULL` EXPLÍCITO. A 1ª versão em prod **não
     * bloqueava**: `length(trim(NULL))` é NULL, `false OR NULL` = NULL, e **CHECK com expressão
     * NULL PASSA** (medido no Postgres de prod). Sem este `expect`, o furo volta na próxima
     * tabela que alguém criar com par de colunas nullable.
     */
    const corrigida = readFileSync(
      'prisma/migrations/20261005130000_aviso_check_acao_tres_valores/migration.sql',
      'utf8',
    ).replace(/^\s*--.*$/gm, '')
    expect(corrigida, 'a lógica de três valores do SQL exige IS NOT NULL antes do length').toMatch(
      /"acaoRotulo" IS NOT NULL AND "acaoHref" IS NOT NULL/,
    )
    expect(sql, 'o dedupe por origem+alvo é UNIQUE no banco').toMatch(
      /CREATE UNIQUE INDEX "aviso_companyId_origem_alvo_key"/,
    )
  })
})

/**
 * ⭐⭐⭐ O PRODUTOR CONTRA O BANCO — o teste que a REGRA 11 EXIGIU (04/10/2026).
 *
 * ⛔⛔ **ELE NASCEU PORQUE UM DEFEITO REPOSTO VEIO VERDE.** Repus o produtor lendo o USUÁRIO do
 * sistema no lugar do colaborador da conclusão (`quem: null`) e os 72 testes passaram — porque
 * todos eles exercitavam a LIB (`fraseDoPadrao`) e **nenhum perguntava pro PRODUTOR**. É o
 * *"guard que testa a lib e aprova a tela que ignora a lib"* desta casa, pela enésima vez — e
 * aqui ele teria deixado em prod exatamente o defeito que a preview acusou: 7 avisos dizendo
 * *"feitos por sem nome registrado"*, sem o nome que o dono pediu.
 */
describe('⛔⛔ o PRODUTOR lê o nome de quem FEZ (não o usuário do sistema)', () => {
  it('⭐⭐ o aviso do padrão sai com o nome do colaborador da conclusão', async () => {
    const { produzirAvisosDeProducao } = await import('../produtores/producao')

    /** ⚠️ a ficha declara o lote na MESMA unidade do produto — senão a supressão do
     *  "uma causa, um alarme" entraria e o padrão nem seria avaliado. */
    const item = await prisma.stockItem.create({
      data: {
        companyId, nome: 'PORCAO TESTE', unidadeControle: 'UN',
        categoria: 'INTERMEDIARIO', criadoVia: 'MANUAL',
      },
    })
    const ficha = await prisma.stockFicha.create({
      data: { companyId, itemProduzidoId: item.id, tipoProduto: 'INTERMEDIARIO', versaoAtual: 1 },
    })
    await prisma.stockFichaVersao.create({
      data: { companyId, fichaId: ficha.id, versao: 1, loteBase: 1, unidadeLoteBase: 'UN' },
    })
    const quem = await prisma.stockColaborador.create({ data: { companyId, nome: 'rodrigo' } })

    /** 3 lotes seguidos a 70% — padrão de rendimento DE VERDADE, fora da faixa impossível */
    for (let i = 0; i < 3; i++) {
      const ordem = await prisma.stockProductionOrder.create({
        data: {
          companyId, fichaId: ficha.id, versaoFicha: 1, itemProduzidoId: item.id,
          dataProducao: new Date('2026-10-01T15:00:00.000Z'), escalaReceitas: 1, estado: 'CONCLUIDA',
        },
      })
      const conc = await prisma.stockProducaoConclusao.create({
        data: {
          companyId, ordemId: ordem.id, qtdGerada: 7, colaboradorId: quem.id,
          escalaConsumida: 1, custoLoteReal: 10, rendimento: 7,
        },
      })
      await prisma.stockProducaoDesvio.create({
        data: {
          companyId, conclusaoId: conc.id, ordemId: ordem.id, pctTeorico: 70,
          /** ⛔ o `criadoPorId` do desvio é o USUÁRIO do sistema — medido em prod: 78 de 400
           *  linhas, e NENHUM casa com `stock_colaborador`. Está aqui de propósito, com um id
           *  que não é colaborador nenhum: se o produtor voltar a ler daqui, o nome desaparece. */
          criadoPorId: 'user-do-sistema',
        },
      })
    }

    const r = await produzirAvisosDeProducao(companyId)
    expect(r.recusados, 'nenhuma frase pode ser recusada pela lei do balcão').toEqual([])

    const avisos = await avisosDoSetor(companyId, 'producao')
    const padrao = avisos.find((a) => a.origem === 'PADRAO_RENDIMENTO')
    expect(padrao, 'o padrão de 3 lotes a 70% tem que virar aviso').toBeTruthy()
    expect(padrao!.corpo, 'o NOME de quem fez — o pedido literal do dono').toMatch(/rodrigo/)
    expect(padrao!.corpo).not.toMatch(/sem nome registrado/)
    expect(padrao!.oQueFazer).toMatch(/rodrigo/)
  })

  afterEach(async () => {
    for (const t of ['stockProducaoDesvio', 'stockProducaoConclusao', 'stockProductionOrder',
                     'stockFichaVersao', 'stockFicha', 'stockColaborador', 'stockItem'] as const) {
      // @ts-expect-error dinâmico — `stock_*` não cascateia (o isolamento proíbe @relation)
      await prisma[t].deleteMany({ where: { companyId } })
    }
  })
})
