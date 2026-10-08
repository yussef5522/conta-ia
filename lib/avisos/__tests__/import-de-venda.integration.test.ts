/**
 * ⭐⭐⭐ CAMADA 3 DO IMPORT DE VENDA, CONTRA O BANCO (08/10/2026).
 *
 * ⚠️ REGRA 3: roda o produtor REAL sobre linhas REAIS. Um teste puro provaria a frase e **não**
 * provaria o que mais importa: que o veredito vem da MESMA régua da tela, que o gate das 10h
 * segura o dia de ontem de manhã, que `origem+alvo` é UNIQUE (3 rodadas = 1 aviso) e que o
 * arquivo que entra RESOLVE o aviso.
 *
 * ⛔⛔ E ELE TEM O CONTRAFACTUAL DO GATE: às 3h o dia de ontem **não** entra; às 10h30 entra.
 * Sem esse par, o gate seria uma afirmação sobre o mundo bom — e a REGRA 11 já mostrou nesta
 * casa que guard testado só no caso conveniente dá selo verde de graça.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { SELOS_QUE_PEDEM_ACAO } from '@/lib/stock/vendas/razao-sabor-pizza'
import {
  produzirAvisosDeImportDeVenda,
  diaLimiteDoGate,
  mesesDaJanela,
  fraseDoDiaTorto,
  ORIGEM,
  HORA_DO_GATE,
} from '../produtores/import-de-venda'
import { avisosAbertos } from '../central'
import { avaliarLinguaDoBalcao } from '../lingua-do-balcao'
import { lerCentralDeImport } from '@/lib/stock/vendas/central-de-import'

const CNPJ = '81828384000181'
let companyId = ''

/** ⚠️ o módulo grava a data ao MEIO-DIA UTC — a convenção da casa (a cicatriz de 14/09) */
const dia = (d: string) => new Date(`${d}T12:00:00.000Z`)

/**
 * ⛔⛔ O CENÁRIO É **RELATIVO AO RELÓGIO DE QUEM RODA** — e isto não é preciosismo: o guard
 * `sem-data-fixa-no-futuro` me pegou com `new Date('…T13:30:00Z')` de um dia futuro na posição
 * de "agora". ***Data fixa no futuro não é futuro: é uma data que o calendário alcança*** (a
 * régua de 01/09, nascida de três bombas que explodiram na virada do mês).
 *
 * ⭐ `HOJE_BR` é o dia de hoje no Brasil; os dias do cenário são contados pra trás dele, e os
 * instantes são horas DAQUELE dia — então o teste prova a mesma coisa hoje, amanhã e em 2030.
 */
const HOJE_BR = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10)
const diaMenos = (n: number) =>
  new Date(new Date(`${HOJE_BR}T12:00:00Z`).getTime() - n * 86_400_000).toISOString().slice(0, 10)
/** ⚠️ hora em UTC: `13:30Z` = 10h30 em SP (depois do gate) · `06:00Z` = 3h (antes) */
const instante = (hora: string) => new Date(`${HOJE_BR}T${hora}Z`)

const MANHA = instante('13:30:00')
const MADRUGADA = instante('06:00:00')

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'SININHO DO IMPORT' } })
  companyId = c.id
})

afterEach(async () => {
  await prisma.aviso.deleteMany({ where: { companyId } })
  await prisma.stockVendaLinha.deleteMany({ where: { companyId } })
  await prisma.stockVendaComplementoLinha.deleteMany({ where: { companyId } })
  await prisma.stockVendaImport.deleteMany({ where: { companyId } })
  await prisma.vendaDiaria.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
})

/** ⭐ um dia com pizza vendida e N ocorrências de sabor — o estado que o selo lê */
async function diaComVenda(d: string, pizzas: number, sabores: number) {
  await prisma.stockVendaImport.create({
    data: { companyId, data: dia(d), totalLinhas: 1, totalUnidades: pizzas },
  })
  await prisma.stockVendaLinha.create({
    data: {
      companyId, importId: `imp-${d}`, data: dia(d),
      nomeSuitable: 'PIZZA GRANDE 35CM', quantidade: pizzas, valorTotal: pizzas * 78,
      mapeadoNoImport: true,
    },
  })
  if (sabores > 0) {
    await prisma.stockVendaComplementoLinha.create({
      data: {
        companyId, importId: `comp-${d}`, data: dia(d),
        nomeSuitable: 'CALABRESA', ocorrencias: sabores, valorTotal: 0,
        mapeadoNoImport: true,
      },
    })
  }
}

/** ⭐ dia de venda SEM arquivo nenhum — o buraco (é a `VendaDiaria` que o faz existir) */
async function diaDeVendaSemImport(d: string) {
  await prisma.vendaDiaria.create({
    data: {
      companyId, dataCompetencia: dia(d), dataCompetenciaFim: dia(d),
      meio: 'DINHEIRO', valorLiquido: 1_000, tipo: 'VENDA',
    },
  })
}

describe('⛔⛔ O GATE DA MANHÃ — o dia de ontem não é cobrado de madrugada', () => {
  it('⛔ às 3h de SP o limite é ANTEONTEM (o arquivo ainda pode entrar hoje)', () => {
    expect(diaLimiteDoGate(MADRUGADA)).toBe(diaMenos(2))
  })

  it(`⭐ depois das ${HORA_DO_GATE}h de SP o limite é ONTEM — é a "rodada da manhã"`, () => {
    expect(diaLimiteDoGate(MANHA)).toBe(diaMenos(1))
  })

  /**
   * ⚠️⚠️ ASSERÇÃO MINHA CORRIGIDA PELO CÓDIGO: eu esperava `2026-10-06` achando que 23h cairia
   * "antes do gate". Cai **depois**: às 23h de SP do dia 08, o gate das 10h daquele dia já
   * passou, então o dia 07 é cobrável. O que este teste prova é o FUSO — sem o desconto de 3h,
   * `toISOString` diria que já é dia **09** e o limite pularia pro 08, cobrando um dia que a
   * cozinha ainda vai importar naquela mesma noite.
   */
  it('⛔ o fuso é o do BRASIL: 23h de SP ainda é o dia de HOJE, não o seguinte', () => {
    // 23h em SP de hoje == 02h UTC de amanhã (daí o +26h sobre a meia-noite UTC de hoje)
    const vinteTres = new Date(instante('00:00:00').getTime() + 26 * 3_600_000)
    expect(diaLimiteDoGate(vinteTres)).toBe(diaMenos(1))
  })

  /**
   * ⛔⛔⛔ O CASO QUE **ISOLA** O FUSO — e ele existe porque a REGRA 11 reprovou o teste de cima.
   *
   * Repondo o defeito (ler o UTC cru, sem os −3h), o caso das 23h ficou **VERDE**: lá as duas
   * versões caem no mesmo dia por **coincidência aritmética** (o fix muda o dia *e* a hora, e os
   * dois erros se cancelam). ***Reposição que não reproduz o defeito é um verde de graça.***
   *
   * ⭐ O caso que separa é **9h da manhã em SP** (12h UTC): com o fuso certo o gate das 10h
   * AINDA NÃO passou e o limite é anteontem; lendo o UTC cru o relógio marca 12h, o gate "passa"
   * e **o dia de ontem é cobrado às 9h da manhã** — justamente a hora em que a cozinha ainda
   * pode subir o arquivo.
   */
  it('⛔⛔ às 9h de SP o gate AINDA não passou (o caso que isola o fuso)', () => {
    const noveDaManha = instante('12:00:00')
    expect(diaLimiteDoGate(noveDaManha), 'às 9h de SP o dia de ontem não pode ser cobrado').toBe(diaMenos(2))
    // ⛔ o contrafactual medido: sem os −3h o relógio diria 12h e o limite pularia pro 08
    const semFuso = new Date(noveDaManha.getTime())
    expect(semFuso.getUTCHours() >= HORA_DO_GATE, 'o UTC cru acharia que o gate já passou').toBe(true)
  })

  it('⭐ a janela atravessa a virada do mês e lê os DOIS meses', () => {
    // ⚠️ datas no PASSADO: a janela é função pura de um limite e não olha o relógio
    expect(mesesDaJanela('2025-10-05', 21)).toEqual(['2025-09', '2025-10'])
    expect(mesesDaJanela('2025-10-28', 21)).toEqual(['2025-10'])
  })
})

describe('⭐⭐ O PRODUTOR — um aviso por dia torto, com a consequência na frase', () => {
  const AGORA = MANHA // 10h30 em SP → limite = ontem

  it('⭐ dia SEM IMPORTAÇÃO vira aviso coral de estoque com o caminho pra central', async () => {
    await diaDeVendaSemImport(diaMenos(4))
    const r = await produzirAvisosDeImportDeVenda(companyId, AGORA, prisma)
    expect(r.gravados).toBe(1)
    const [a] = await avisosAbertos(companyId)
    expect(a.origem).toBe(ORIGEM)
    expect(a.alvo).toBe(`dia:${diaMenos(4)}`)
    expect(a.setor).toBe('estoque')
    expect(a.severidade).toBe('coral')
    expect(a.titulo).toContain(`${diaMenos(4).slice(8, 10)}/${diaMenos(4).slice(5, 7)}`)
    expect(a.acaoHref).toContain('/estoque/vendas')
  })

  it('⭐⭐ pizza vendida e ZERO sabor → a frase DIZ o que o dono perde', async () => {
    await diaComVenda(diaMenos(5), 389, 0)
    const r = await produzirAvisosDeImportDeVenda(companyId, AGORA, prisma)
    expect(r.gravados).toBe(1)
    const [a] = await avisosAbertos(companyId)
    expect(a.severidade).toBe('coral')
    /** ⛔ a CONSEQUÊNCIA, não o estado — a ordem do dono, ao pé da letra */
    expect(a.corpo).toContain('não baixaram sabor do estoque')
    expect(a.corpo).toContain('389')
  })

  it('⭐ sabor pela metade (razão < 1) → ÂMBAR, não coral', async () => {
    await diaComVenda(diaMenos(6), 412, 171)
    const r = await produzirAvisosDeImportDeVenda(companyId, AGORA, prisma)
    expect(r.gravados).toBe(1)
    const [a] = await avisosAbertos(companyId)
    expect(a.severidade).toBe('ambar')
    expect(a.corpo).toContain('171')
  })

  it('⭐ dia COMPLETO (razão ≥ 1) não gera aviso nenhum', async () => {
    await diaComVenda(diaMenos(7), 100, 260)
    const r = await produzirAvisosDeImportDeVenda(companyId, AGORA, prisma)
    expect(r.gravados).toBe(0)
    expect(await avisosAbertos(companyId)).toEqual([])
  })

  it('⛔⛔ O GATE SEGURA: o dia de ontem NÃO é cobrado às 3h, e é cobrado às 10h30', async () => {
    await diaComVenda(diaMenos(1), 300, 0)
    const madrugada = await produzirAvisosDeImportDeVenda(
      companyId, MADRUGADA, prisma,
    )
    expect(madrugada.gravados, 'às 3h o dia de ontem ainda pode receber o arquivo').toBe(0)
    expect(madrugada.calados.some((c) => c.dia === diaMenos(1))).toBe(true)

    const manha = await produzirAvisosDeImportDeVenda(companyId, AGORA, prisma)
    expect(manha.gravados, 'depois das 10h o dia de ontem entra').toBe(1)
  })

  it('⛔ o dia de HOJE nunca entra — ele ainda está vendendo', async () => {
    await diaComVenda(diaMenos(0), 50, 0)
    const r = await produzirAvisosDeImportDeVenda(companyId, AGORA, prisma)
    expect(r.gravados).toBe(0)
  })

  it('⛔⛔ ANTI-SPAM: 3 rodadas sobre o mesmo dia = UM aviso (origem+alvo UNIQUE)', async () => {
    await diaComVenda(diaMenos(5), 389, 0)
    await produzirAvisosDeImportDeVenda(companyId, AGORA, prisma)
    await produzirAvisosDeImportDeVenda(companyId, AGORA, prisma)
    await produzirAvisosDeImportDeVenda(companyId, AGORA, prisma)
    expect(await prisma.aviso.count({ where: { companyId, origem: ORIGEM } })).toBe(1)
  })

  it('⛔⛔ UMA CAUSA, UM ALARME: o dia sem arquivo nenhum não ganha DOIS avisos', async () => {
    await diaDeVendaSemImport(diaMenos(4))
    await produzirAvisosDeImportDeVenda(companyId, AGORA, prisma)
    const doDia = await prisma.aviso.count({
      where: { companyId, origem: ORIGEM, alvo: `dia:${diaMenos(4)}` },
    })
    expect(doDia, 'o pior selo fala sozinho — "sem importação" não empilha com "sem sabores"').toBe(1)
  })

  it('⭐⭐ o arquivo entra → o aviso é RESOLVIDO (trabalho feito sai da fila)', async () => {
    await diaComVenda(diaMenos(5), 389, 0)
    await produzirAvisosDeImportDeVenda(companyId, AGORA, prisma)
    expect((await avisosAbertos(companyId)).length).toBe(1)

    // ⭐ o relatório de sabores chega
    await prisma.stockVendaComplementoLinha.create({
      data: {
        companyId, importId: `comp-${diaMenos(5)}`, data: dia(diaMenos(5)),
        nomeSuitable: 'CALABRESA', ocorrencias: 900, valorTotal: 0, mapeadoNoImport: true,
      },
    })
    const r = await produzirAvisosDeImportDeVenda(companyId, AGORA, prisma)
    expect(r.resolvidos).toBe(1)
    expect(await avisosAbertos(companyId)).toEqual([])
  })

  it('⭐ empresa que não importa venda nenhuma é MUDA', async () => {
    const r = await produzirAvisosDeImportDeVenda(companyId, AGORA, prisma)
    expect(r).toMatchObject({ gravados: 0, reabertos: 0, resolvidos: 0 })
  })
})

describe('⛔⛔ A RÉGUA É A MESMA DA TELA — o sininho não decide o veredito', () => {
  const AGORA = MANHA

  it('⭐ o selo que o sininho usa é o MESMO que a central desenha', async () => {
    await diaComVenda(diaMenos(5), 389, 0)
    await diaComVenda(diaMenos(6), 412, 171)
    await diaComVenda(diaMenos(7), 100, 260)

    const central = await lerCentralDeImport(companyId, HOJE_BR.slice(0, 7), prisma)
    const porDia = new Map(central.dias.map((d) => [d.dia, d.selo]))
    expect(porDia.get(diaMenos(5))).toBe('SABORES_NAO_IMPORTADOS')
    expect(porDia.get(diaMenos(6))).toBe('COMPLEMENTOS_INCOMPLETOS')
    expect(porDia.get(diaMenos(7))).toBe('COMPLETO')

    await produzirAvisosDeImportDeVenda(companyId, AGORA, prisma)
    const alvos = (await avisosAbertos(companyId)).map((a) => a.alvo).sort()
    /** ⛔ exatamente os dias que a TELA marca com selo de ação — nem mais, nem menos */
    expect(alvos).toEqual([`dia:${diaMenos(6)}`, `dia:${diaMenos(5)}`])
  })

  /**
   * ⭐⭐ O TESTE DO PAR — ele existe porque a REGRA 11 mostrou que a lista
   * `SELOS_QUE_PEDEM_ACAO` **não é** o que filtra (quem filtra é a frase). Então o que se trava
   * é a CONCORDÂNCIA entre as duas: selo novo entrando na lista **sem frase** faria o aviso
   * nunca nascer (silêncio com cara de cobertura), e frase escrita pro `COMPLETO` faria o
   * sininho gritar sobre um dia saudável.
   */
  it('⛔⛔ a lista e as frases CONCORDAM — selo da lista tem frase, selo fora dela não', () => {
    const base = {
      dia: diaMenos(5), seloRotulo: '', razao: null, frase: '', unidades: 0, valor: 0,
      pizzas: 10, arquivos: 0, quem: null, hora: null, autorAproximado: false, buraco: false,
      conferencia: {
        somaArquivo: null, somaGravado: 0, diferenca: null, bate: null,
        linhasProdutos: 0, linhasSabores: 0, ocorrenciasSabores: 1, semDestino: 0,
      },
    } as unknown as Parameters<typeof fraseDoDiaTorto>[0]

    for (const selo of SELOS_QUE_PEDEM_ACAO) {
      expect(
        fraseDoDiaTorto({ ...base, selo }),
        `${selo} pede ação e NÃO tem frase — o aviso nunca nasceria, em silêncio`,
      ).toBeTruthy()
    }
    expect(
      fraseDoDiaTorto({ ...base, selo: 'COMPLETO' }),
      'o dia COMPLETO ganhou frase — o sininho passaria a gritar sobre dia saudável',
    ).toBeNull()
  })

  it('⛔ as 3 frases passam pela lei da língua do balcão', () => {
    const base = {
      dia: diaMenos(5), seloRotulo: '', razao: null, frase: '', unidades: 0, valor: 0,
      pizzas: 389, arquivos: 0, quem: null, hora: null, autorAproximado: false, buraco: false,
      conferencia: {
        somaArquivo: null, somaGravado: 0, diferenca: null, bate: null,
        linhasProdutos: 0, linhasSabores: 0, ocorrenciasSabores: 171, semDestino: 0,
      },
    } as unknown as Parameters<typeof fraseDoDiaTorto>[0]

    for (const selo of ['SEM_IMPORTACAO', 'SABORES_NAO_IMPORTADOS', 'COMPLEMENTOS_INCOMPLETOS'] as const) {
      const f = fraseDoDiaTorto({ ...base, selo })
      expect(f, `o selo ${selo} tem que ter frase`).toBeTruthy()
      const v = avaliarLinguaDoBalcao({
        companyId: 'x', origem: ORIGEM, alvo: `dia:${diaMenos(5)}`, setor: 'estoque',
        severidade: 'coral', titulo: f!.titulo, corpo: f!.corpo, oQueFazer: f!.oQueFazer,
        acaoRotulo: 'abrir a central de import', acaoHref: '/empresas/x/estoque/vendas',
      })
      /** ⛔ aviso recusado pela lei morre no `registrarAviso` **em silêncio** (fail-soft) —
       *  então a recusa tem que ser pega AQUI, não descoberta em prod (a cicatriz de 04/10) */
      expect(v.ok, `${selo} recusado pela língua do balcão: ${v.ok ? '' : v.motivo}`).toBe(true)
    }
  })
})
