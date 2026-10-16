/**
 * ⚠️⚠️⚠️ **O DIA RACHADO — e a frase FALSA que escondia metade do dinheiro (16/10/2026).**
 *
 * O CASO REAL, medido em prod: à 1h da manhã de 16/10 os dois relatórios da sexta que **não
 * tinha aberto** foram subidos. O de complementos foi apontado pro dia **15** (R$ 769, só
 * sabores) e o de produtos pro dia **16** (R$ 13.749).
 *
 * **O que a central dizia, e por que era pior que um número errado:**
 *   · **15/10 → `SEM_IMPORTACAO` com a frase *"dia de venda sem arquivo nenhum"*** — e o dia
 *     tinha **1 arquivo**, com 769 reais de sabores dentro. ***Frase falsa com cara de fato:*** o
 *     dono lê que nada entrou, importa de novo, e o sistema aceita (o reimport substitui) sem
 *     ninguém nunca saber que a metade que faltava era a OUTRA.
 *   · **16/10 → `SABORES_NAO_IMPORTADOS`**, pedindo um arquivo que **já estava no sistema**,
 *     datado no dia anterior.
 *   · **nenhum selo dizia que os dois são o MESMO dia.**
 *
 * ⭐ Este arquivo trava as duas metades da cura: o selo **honesto** (há arquivo, então não é
 * "sem importação") e o selo **do par** (`🪓 dia rachado`, um por caso).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { lerCentralDeImport, diasQuePedemAcao } from '../central-de-import'
import { vereditoDoDia, SELOS_QUE_PEDEM_ACAO } from '../razao-sabor-pizza'
import { acharDiasRachados } from '../dia-rachado'
import { fraseDoDiaTorto } from '@/lib/avisos/produtores/import-de-venda'

const CNPJ = '93949596000173'
let companyId = ''
/** ⚠️ datas no PASSADO: o guard `sem-data-fixa-no-futuro` barra data fixa em posição de relógio */
const SEXTA = '2025-10-17' // o dia dos SABORES (o "15/10" do caso)
const SABADO = '2025-10-18' // o dia dos PRODUTOS (o "16/10" do caso)
const MES = '2025-10'
/** o dia seguinte ao par, pra `hoje` deixar os dois no passado (buraco é de ontem pra trás) */
const HOJE = '2025-10-19'

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'DIA RACHADO' } })
  companyId = c.id
})

afterEach(async () => {
  await prisma.stockVendaImport.deleteMany({ where: { companyId } })
  await prisma.stockVendaLinha.deleteMany({ where: { companyId } })
  await prisma.stockVendaComplementoLinha.deleteMany({ where: { companyId } })
  await prisma.vendaDiaria.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
})

/**
 * ⚠️ as DUAS convenções de hora dos writers reais — fixture que "arredonda" esconde bug (08/10).
 *
 * ⚠️⚠️ E o produto grava **DUAS linhas**: a do PDV (`stock_venda_linha`) **e o registro do
 * import** (`stock_venda_import`) — e é o REGISTRO que responde *"este dia tem produtos?"*. A 1ª
 * versão desta fixture gravou só as linhas: o dia veio `SEM_IMPORTACAO` e o teste ficou vermelho
 * **pela fixture**, não pelo código. ***Fixture que não reproduz o que o writer real grava não
 * prova nada sobre o writer real.***
 */
const produtos = async (dia: string, valor: number) => {
  await prisma.stockVendaLinha.create({
    data: {
      companyId, importId: `p-${dia}`, data: new Date(`${dia}T12:00:00.000Z`),
      nomeSuitable: 'PIZZA GRANDE 35CM', quantidade: 38, valorTotal: valor, mapeadoNoImport: true,
    },
  })
  await prisma.stockVendaImport.create({
    data: { companyId, data: new Date(`${dia}T12:00:00.000Z`), totalLinhas: 1, totalUnidades: 38 },
  })
}

const sabores = (dia: string, valor: number) =>
  prisma.stockVendaComplementoLinha.create({
    data: {
      companyId, importId: `c-${dia}`, data: new Date(`${dia}T00:00:00.000Z`),
      nomeSuitable: 'CALABRESA', ocorrencias: 76, valorTotal: valor, mapeadoNoImport: true,
    },
  })

// ════════════════════════════════════════════════════════════════════════════
describe('⛔⛔⛔ a frase FALSA: "sem arquivo nenhum" num dia que TEM arquivo', () => {
  it('⭐⭐ só complementos → PRODUTOS_NAO_IMPORTADOS, e a frase NÃO diz "nenhum"', () => {
    const v = vereditoDoDia({ temProdutos: false, temComplementos: true, pizzas: 0, sabores: 76 })
    expect(v.selo).toBe('PRODUTOS_NAO_IMPORTADOS')
    /** ⛔ o vermelho de 16/10: a frase afirmava ausência de arquivo com 1 arquivo gravado */
    expect(v.frase).not.toContain('nenhum')
    expect(v.frase).toContain('PRODUTOS')
  })

  it('⭐ ZERO arquivo continua `SEM_IMPORTACAO` — o selo não perdeu o significado dele', () => {
    const v = vereditoDoDia({ temProdutos: false, temComplementos: false, pizzas: 0, sabores: 0 })
    expect(v.selo).toBe('SEM_IMPORTACAO')
    expect(v.frase).toBe('dia de venda sem arquivo nenhum')
  })

  it('⚠️ sem o campo (o leitor da margem), o default não inventa arquivo', () => {
    expect(vereditoDoDia({ temProdutos: false, pizzas: 0, sabores: 0 }).selo).toBe('SEM_IMPORTACAO')
  })

  it('⭐ o selo novo PEDE AÇÃO — senão o sininho calaria sobre um dia sem venda lançada', () => {
    expect(SELOS_QUE_PEDEM_ACAO).toContain('PRODUTOS_NAO_IMPORTADOS')
  })

  it('⛔ o PAR: todo selo que pede ação tem frase; selo fora da lista não tem', () => {
    const base = {
      dia: SEXTA, seloRotulo: '', razao: null, unidades: 0, valor: 0, valorProdutos: 0,
      valorComplementos: 0, pizzas: 10, sabores: 0, arquivos: 1, detalheArquivos: [],
      quem: null, hora: null, autorAproximado: false, buraco: false, rachado: null,
      conferencia: {
        somaArquivo: null, somaGravada: 0, bate: null, diferenca: null,
        linhasProdutos: 0, ocorrenciasSabores: 0, semDestino: 0,
      },
    }
    for (const selo of SELOS_QUE_PEDEM_ACAO) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const f = fraseDoDiaTorto({ ...base, selo, frase: 'x' } as any)
      expect(f, `o selo ${selo} pede ação e NÃO tem frase — dia contado que nunca avisa`).not.toBeNull()
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(fraseDoDiaTorto({ ...base, selo: 'COMPLETO', frase: 'x' } as any)).toBeNull()
  })
})

// ════════════════════════════════════════════════════════════════════════════
describe('⭐⭐ a régua do racho (pura)', () => {
  const caso = [
    { dia: SEXTA, temProdutos: false, temComplementos: true },
    { dia: SABADO, temProdutos: true, temComplementos: false },
  ]

  it('⭐⭐ o caso real: complementos num dia, produtos no seguinte → UM racho', () => {
    const r = acharDiasRachados(caso)
    expect(r).toHaveLength(1)
    /** ⭐ a âncora é o dia dos PRODUTOS — o que o dono acabou de importar, o suspeito */
    expect(r[0].dia).toBe(SABADO)
    expect(r[0].vizinho).toBe(SEXTA)
    expect(r[0].frase).toContain('dia rachado')
  })

  it('⛔⛔ UM CASO, UM ALARME: o par não produz dois rachos', () => {
    expect(acharDiasRachados(caso).filter((r) => r.dia === SEXTA)).toEqual([])
  })

  it('⛔ dia só-complementos com vizinho COMPLETO não é racho — é arquivo que falta', () => {
    const r = acharDiasRachados([
      { dia: SEXTA, temProdutos: false, temComplementos: true },
      { dia: SABADO, temProdutos: true, temComplementos: true },
    ])
    expect(r).toEqual([])
  })

  it('⛔ dias DISTANTES não racham (a assinatura é a vizinhança)', () => {
    const r = acharDiasRachados([
      { dia: '2025-10-10', temProdutos: false, temComplementos: true },
      { dia: SABADO, temProdutos: true, temComplementos: false },
    ])
    expect(r).toEqual([])
  })

  it('⛔ a ordem NÃO é simétrica: produtos antes, complementos depois, não é racho de data', () => {
    const r = acharDiasRachados([
      { dia: SEXTA, temProdutos: true, temComplementos: false },
      { dia: SABADO, temProdutos: false, temComplementos: true },
    ])
    expect(r).toEqual([])
  })

  it('⭐ dois rachos independentes no mês = dois alarmes (um por CASO, não por mês)', () => {
    const r = acharDiasRachados([
      { dia: '2025-10-03', temProdutos: false, temComplementos: true },
      { dia: '2025-10-04', temProdutos: true, temComplementos: false },
      { dia: SEXTA, temProdutos: false, temComplementos: true },
      { dia: SABADO, temProdutos: true, temComplementos: false },
    ])
    expect(r.map((x) => x.dia)).toEqual(['2025-10-04', SABADO])
  })
})

// ════════════════════════════════════════════════════════════════════════════
describe('⭐⭐⭐ a CENTRAL com o caso real gravado', () => {
  it('⭐⭐ o par 17↔18 vem com o selo honesto nos dois E um racho só', async () => {
    await sabores(SEXTA, 769)
    await produtos(SABADO, 13_749)

    const c = await lerCentralDeImport(companyId, MES, prisma, HOJE)
    const sexta = c.dias.find((d) => d.dia === SEXTA)!
    const sabado = c.dias.find((d) => d.dia === SABADO)!

    /** ⛔ ERA AQUI QUE A TELA MENTIA */
    expect(sexta.selo).toBe('PRODUTOS_NAO_IMPORTADOS')
    expect(sexta.arquivos, 'o dia TEM arquivo — era o que a frase negava').toBe(1)
    expect(sexta.frase).not.toContain('nenhum')
    expect(sabado.selo).toBe('SABORES_NAO_IMPORTADOS')

    /** ⭐ o selo do par: UM, ancorado nos produtos */
    expect(c.diasRachados).toHaveLength(1)
    expect(c.diasRachados[0].dia).toBe(SABADO)
    expect(c.diasRachados[0].vizinho).toBe(SEXTA)
    expect(sabado.rachado?.vizinho).toBe(SEXTA)
    expect(sexta.rachado, 'um caso, um alarme — a sexta não repete o aviso').toBeNull()
  })

  it('⭐ os dois dias CONTAM na fila de ação — o dinheiro de nenhum deles está lançado', async () => {
    await sabores(SEXTA, 769)
    await produtos(SABADO, 13_749)
    const c = await lerCentralDeImport(companyId, MES, prisma, HOJE)
    expect(diasQuePedemAcao(c)).toBe(2)
    expect(c.contagem.PRODUTOS_NAO_IMPORTADOS).toBe(1)
  })

  it('⭐⭐ o SININHO fala do RACHO, não pede o arquivo que já existe', async () => {
    await sabores(SEXTA, 769)
    await produtos(SABADO, 13_749)
    const c = await lerCentralDeImport(companyId, MES, prisma, HOJE)
    const sabado = c.dias.find((d) => d.dia === SABADO)!

    const f = fraseDoDiaTorto(sabado)!
    expect(f.titulo).toContain('data')
    expect(f.corpo).toContain('dia rachado')
    /** ⛔ a frase genérica mandaria importar o que já está no sistema (lição de 16/09) */
    expect(f.oQueFazer).toContain('reimporte')
  })

  it('⭐ dia COMPLETO ao lado não racha nada — a régua não é ruidosa', async () => {
    await sabores(SEXTA, 769)
    await produtos(SEXTA, 10_000)
    await produtos(SABADO, 13_749)
    await sabores(SABADO, 2_000)
    const c = await lerCentralDeImport(companyId, MES, prisma, HOJE)
    expect(c.diasRachados).toEqual([])
    expect(c.dias.every((d) => d.rachado === null)).toBe(true)
  })

  it('⛔ dia de venda sem arquivo NENHUM continua buraco coral (o selo não sumiu)', async () => {
    await prisma.vendaDiaria.create({
      data: {
        companyId, dataCompetencia: new Date(`${SEXTA}T12:00:00.000Z`),
        dataCompetenciaFim: new Date(`${SEXTA}T12:00:00.000Z`),
        meio: 'DINHEIRO', valorLiquido: 500, tipo: 'VENDA',
      },
    })
    const c = await lerCentralDeImport(companyId, MES, prisma, HOJE)
    const sexta = c.dias.find((d) => d.dia === SEXTA)!
    expect(sexta.selo).toBe('SEM_IMPORTACAO')
    expect(sexta.buraco).toBe(true)
    expect(c.buracos).toEqual([SEXTA])
  })
})
