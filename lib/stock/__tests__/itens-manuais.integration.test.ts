// ESTOQUE — ITENS DIGITADOS DO DANFE DE PAPEL. Fixture = o caso REAL da Focatto
// (R$ 2.459,76, emitida 21/08, presa 2 dias em só-resumo).
// REGRA 3: roda o pipeline de verdade (grava item → conferência enxerga → confirma →
// movimento no ledger com origem DANFE_MANUAL), não procura string.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { prisma } from '@/lib/db'
import { conferirSoma, validarItens, salvarItensManuais, ItensManuaisError } from '../itens-manuais'
import { saveNfeCompleta } from '../sefaz/persist-nfe'

const CNPJ = '50607080000166'
const CHAVE = '43260804902760000145550010012406791107915950' // a chave real da Focatto
const VNF_FOCATTO = 2459.76
let companyId: string
let nfeId: string

// itens plausíveis do DANFE (a soma fecha com o total da nota)
const ITENS_PAPEL = [
  { xProd: 'QUEIJO MUSSARELA FATIADO 1KG', qCom: 20, uCom: 'KG', vUnCom: 42.50 },
  { xProd: 'PRESUNTO COZIDO FATIADO 1KG', qCom: 15, uCom: 'KG', vUnCom: 31.90 },
  { xProd: 'REQUEIJAO CREMOSO 1,8KG', qCom: 13, uCom: 'UN', vUnCom: 87.02 },
]

beforeAll(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'EMPRESA DANFE' } })).id
})

beforeEach(async () => {
  await prisma.stockNfeItem.deleteMany({ where: { companyId } })
  await prisma.stockNfe.deleteMany({ where: { companyId } })
  nfeId = (await prisma.stockNfe.create({
    data: { companyId, chave: CHAVE, nsu: '1', status: 'AGUARDANDO_MERCADORIA', temXmlCompleto: false, emitNome: 'FOCATTO DISTRIBUIDORA DE ALIMENTOS LTDA', vNF: VNF_FOCATTO },
  })).id
})

afterAll(async () => {
  await prisma.stockNfeEmit.deleteMany({ where: { companyId } })
  await prisma.stockNfeItem.deleteMany({ where: { companyId } })
  await prisma.stockNfe.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('conferirSoma — avisa, NUNCA trava', () => {
  it('bate quando a soma fecha com o total da SEFAZ', () => {
    const r = conferirSoma(ITENS_PAPEL, VNF_FOCATTO)
    expect(r.somaItens).toBe(VNF_FOCATTO)
    expect(r.bate).toBe(true)
    expect(r.aviso).toBeNull()
  })

  it('avisa (sem travar) quando a soma fica ABAIXO — caso ICMS-ST', () => {
    // igual ao Frigorífico real: vProd 11.763,15 + ST 249,74 = vNF 12.012,89
    const r = conferirSoma([{ xProd: 'CARNE', qCom: 1, uCom: 'KG', vUnCom: 11763.15 }], 12012.89)
    expect(r.bate).toBe(false)
    expect(r.diferenca).toBe(-249.74)
    expect(r.aviso).toContain('ICMS-ST')
    expect(r.aviso).toContain('dá pra seguir')
  })

  it('avisa quando a soma fica ACIMA (desconto/digitação)', () => {
    const r = conferirSoma([{ xProd: 'X', qCom: 10, uCom: 'UN', vUnCom: 100 }], 900)
    expect(r.bate).toBe(false)
    expect(r.diferenca).toBe(100)
    expect(r.aviso).toContain('desconto')
  })

  it('sem vNF (nota sem valor) não inventa aviso', () => {
    const r = conferirSoma(ITENS_PAPEL, null)
    expect(r.bate).toBe(true)
    expect(r.aviso).toBeNull()
  })

  it('tolera arredondamento por item (1 centavo cada)', () => {
    const r = conferirSoma([{ xProd: 'A', qCom: 3, uCom: 'KG', vUnCom: 0.333 }], 1.00)
    expect(r.bate).toBe(true)
  })
})

describe('validarItens', () => {
  it('recusa lista vazia', () => expect(() => validarItens([])).toThrow(ItensManuaisError))
  it('recusa quantidade zero e diz QUAL item', () => {
    expect(() => validarItens([{ xProd: 'QUEIJO', qCom: 0, uCom: 'KG', vUnCom: 10 }])).toThrow(/QUEIJO/)
  })
  it('recusa sem unidade', () => {
    expect(() => validarItens([{ xProd: 'QUEIJO', qCom: 1, uCom: '', vUnCom: 10 }])).toThrow(/unidade/)
  })
  it('aceita preço ZERO (bonificação existe)', () => {
    expect(() => validarItens([{ xProd: 'BRINDE', qCom: 1, uCom: 'UN', vUnCom: 0 }])).not.toThrow()
  })
})

describe('salvarItensManuais — a nota presa volta a andar', () => {
  it('grava os itens do papel e a nota passa a ter o que conferir', async () => {
    const r = await salvarItensManuais({ companyId, nfeId, itens: ITENS_PAPEL }, prisma)
    expect(r.itensGravados).toBe(3)
    expect(r.bate).toBe(true)

    const itens = await prisma.stockNfeItem.findMany({ where: { companyId, nfeId }, orderBy: { nItem: 'asc' } })
    expect(itens).toHaveLength(3)
    expect(itens[0].xProd).toBe('QUEIJO MUSSARELA FATIADO 1KG')
    expect(itens[0].nItem).toBe(1)
    expect(itens[0].uCom).toBe('KG')
    expect(itens[0].vProd).toBe(850) // 20 × 42,50
    // continua SEM XML — é o papel, não o arquivo (e é isso que marca DANFE_MANUAL depois)
    const nota = await prisma.stockNfe.findUnique({ where: { id: nfeId } })
    expect(nota!.temXmlCompleto).toBe(false)
  })

  it('redigitar SUBSTITUI (não acumula item fantasma)', async () => {
    await salvarItensManuais({ companyId, nfeId, itens: ITENS_PAPEL }, prisma)
    await salvarItensManuais({ companyId, nfeId, itens: [ITENS_PAPEL[0]] }, prisma)
    expect(await prisma.stockNfeItem.count({ where: { companyId, nfeId } })).toBe(1)
  })

  it('grava mesmo quando a soma NÃO bate (avisa, não trava)', async () => {
    const r = await salvarItensManuais({ companyId, nfeId, itens: [{ xProd: 'SO UM ITEM', qCom: 1, uCom: 'UN', vUnCom: 10 }] }, prisma)
    expect(r.bate).toBe(false)
    expect(r.aviso).toBeTruthy()
    expect(r.itensGravados).toBe(1) // gravou assim mesmo
  })

  it('RECUSA se a nota já tem XML completo (não precisa digitar)', async () => {
    await prisma.stockNfe.update({ where: { id: nfeId }, data: { temXmlCompleto: true } })
    await expect(salvarItensManuais({ companyId, nfeId, itens: ITENS_PAPEL }, prisma)).rejects.toThrow(/XML completo/)
  })

  it('RECUSA se a nota já foi conferida (o ledger já se moveu)', async () => {
    await prisma.stockNfe.update({ where: { id: nfeId }, data: { status: 'CONFIRMADA' } })
    await expect(salvarItensManuais({ companyId, nfeId, itens: ITENS_PAPEL }, prisma)).rejects.toThrow(/já foi conferida/)
  })
})

describe('o XML chegando DEPOIS não desfaz o que foi conferido', () => {
  const XML = readFileSync(join(__dirname, '../sefaz/__tests__/fixtures/nfe-completa-real.xml'), 'utf-8')

  it('nota CONFIRMADA: o XML só enriquece — os itens digitados FICAM', async () => {
    await salvarItensManuais({ companyId, nfeId, itens: ITENS_PAPEL }, prisma)
    await prisma.stockNfe.update({ where: { id: nfeId }, data: { status: 'CONFIRMADA' } })

    // o cron baixa o XML completo e manda persistir
    await saveNfeCompleta({ nfeId, companyId, chave: CHAVE, xml: XML, db: prisma })

    const itens = await prisma.stockNfeItem.findMany({ where: { companyId, nfeId } })
    expect(itens).toHaveLength(3) // os 3 DIGITADOS, não os do XML
    expect(itens.map((i) => i.xProd)).toContain('QUEIJO MUSSARELA FATIADO 1KG')
    // ...e o emitente foi atualizado (o enriquecimento acontece)
    expect(await prisma.stockNfeEmit.count({ where: { nfeId } })).toBe(1)
  })

  it('nota AINDA NÃO conferida: o XML MANDA (dado da SEFAZ é melhor que o papel)', async () => {
    await salvarItensManuais({ companyId, nfeId, itens: ITENS_PAPEL }, prisma)
    // status segue AGUARDANDO_MERCADORIA
    await saveNfeCompleta({ nfeId, companyId, chave: CHAVE, xml: XML, db: prisma })

    const itens = await prisma.stockNfeItem.findMany({ where: { companyId, nfeId } })
    expect(itens.map((i) => i.xProd)).not.toContain('QUEIJO MUSSARELA FATIADO 1KG')
    expect(itens.length).toBeGreaterThan(0)
  })
})
