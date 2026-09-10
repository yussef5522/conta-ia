// ⛔⛔⛔ O IMPORT PF USA O PARSER DO BANCO RECONHECIDO (09/09/2026).
//
// **O BUG QUE ESTE TESTE EXISTE PRA IMPEDIR, e ele estava vivo em prod:** o registry de
// bancos nasceu em 31/08 pra acabar com o fallback silencioso — e ficou pela metade. O
// `previewFaturaPF` reconhecia o banco pelo `match`… e em seguida rodava
// `parseBanrisulFaturaPF` **cravado**, pra qualquer documento:
//
// ```
//   const parser = reconhecerBancoPF(input.texto)   // ⭐ reconhece
//   const r = parseBanrisulFaturaPF(input.texto)    // ⛔ e ignora o que reconheceu
// ```
//
// ⚠️⚠️ **POR QUE NINGUÉM VIU:** o único teste de ciclo do import PF roda com a fatura do
// **Banrisul** — o caso em que o bug é invisível por construção. O parser do Nubank tinha
// 20 testes verdes e **nenhum deles passava pelo import**; o import do Nubank também
// nunca foi validado em prod (segue como REGRA 2 pendente desde 31/08). Um parser testado
// isoladamente não prova que alguém o chama.
//
// ⭐ Este teste passa pelo caminho REAL (`previewFaturaPF`) com um documento que **não é**
// do Banrisul. Repondo o `parseBanrisulFaturaPF` cravado, ele fica vermelho.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { previewFaturaPF, confirmarFaturaPF } from '../importar-fatura-pf'

const db = new PrismaClient()
const ITAU = readFileSync(
  join(__dirname, '../../fatura-itau/__tests__/fixtures/itau-luizacred-pf.txt'), 'utf-8')
const NUBANK = readFileSync(
  join(__dirname, '../../fatura-nubank/__tests__/fixtures/nubank-fatura-pf.txt'), 'utf-8')

let userId = ''
let profileId = ''
let cardId = ''
/** ⚠️ cartão SÓ pro teste da saída manual: o de cima já importou as 37 linhas, e o dedup
 *  faria `criadas: 0` — o teste passaria a medir a dedup, não a saída manual. */
let cardManualId = ''

beforeAll(async () => {
  const u = await db.user.create({
    data: { email: `pf-dispatch-${Date.now()}@t.com`, password: 'x', name: 'Dono', role: 'USER' },
  })
  userId = u.id
  const p = await db.personalProfile.create({ data: { name: 'Dono PF', type: 'OWN' } })
  profileId = p.id
  await db.userPersonalProfile.create({ data: { userId, profileId, role: 'OWNER' } })
  // ⚠️ o cartão é o do Magazine Luiza (final 2971), com fechamento/vencimento reais
  const c = await db.creditCard.create({
    data: {
      profileId, name: 'magalu', bankName: 'Itaú', lastDigits: '2971',
      brand: 'MASTERCARD', creditLimit: 6535, closingDay: 2, dueDay: 9, closingDayRule: 'PROXIMA',
    },
  })
  cardId = c.id
  const c2 = await db.creditCard.create({
    data: {
      profileId, name: 'magalu manual', bankName: 'Itaú', lastDigits: '2971',
      brand: 'MASTERCARD', creditLimit: 6535, closingDay: 2, dueDay: 9, closingDayRule: 'PROXIMA',
    },
  })
  cardManualId = c2.id
})

afterAll(async () => {
  for (const id of [cardId, cardManualId]) {
    await db.personalTransaction.deleteMany({ where: { creditCardId: id } })
    await db.creditCardInvoice.deleteMany({ where: { creditCardId: id } })
  }
  await db.creditCard.deleteMany({ where: { profileId } })
  await db.userPersonalProfile.deleteMany({ where: { profileId } })
  await db.personalProfile.deleteMany({ where: { id: profileId } })
  await db.user.deleteMany({ where: { id: userId } })
  await db.$disconnect()
})

describe('⛔⛔ a fatura do ITAÚ é lida pelo parser do ITAÚ', () => {
  it('⭐ o preview reconhece o banco E lê com ele — 37 linhas, fecha ao centavo', async () => {
    const p = await previewFaturaPF({ userId, profileId, cardId, texto: ITAU })
    expect(p.banco).toBe('Itaú/Luizacred')
    // ⛔ com o Banrisul cravado isto vinha 0 e o erro era "não consegui ler nenhum lançamento"
    expect(p.linhas).toHaveLength(37)
    expect(p.ok).toBe(true)
    expect(p.erro).toBeNull()
  })

  it('⭐ os números do documento chegam inteiros na tela', async () => {
    const p = await previewFaturaPF({ userId, profileId, cardId, texto: ITAU })
    expect(p.vencimento).toBe('2026-09-09')
    expect(p.referencia).toBe('2026-09')
    expect(p.conferencia.despesasCalculado).toBeCloseTo(4370.79, 2)
    expect(p.conferencia.despesasDeclarado).toBeCloseTo(4370.79, 2)
    expect(p.conferencia.saldoDeclarado).toBeCloseTo(4491.18, 2)
    expect(p.totalDeclarado).toBeCloseTo(4491.18, 2)
  })

  it('⭐⭐ e os DOIS portadores chegam, com a linha sabendo de quem é', async () => {
    const p = await previewFaturaPF({ userId, profileId, cardId, texto: ITAU })
    expect(p.portadores).toEqual(['8818', '2971'])
    expect(p.linhas.filter((l) => l.portador === '8818')).toHaveLength(10)
    expect(p.linhas.filter((l) => l.portador === '2971')).toHaveLength(26)
    // o encargo de atraso é da FATURA, não de um cartão
    expect(p.linhas.filter((l) => !l.portador)).toHaveLength(1)
  })

  it('⭐ o estorno chega como crédito e as parcelas chegam como estrutura', async () => {
    const p = await previewFaturaPF({ userId, profileId, cardId, texto: ITAU })
    const estorno = p.linhas.filter((l) => l.credito)
    expect(estorno).toHaveLength(1)
    expect(estorno[0].valor).toBeCloseTo(0.03, 2)
    expect(p.linhas.filter((l) => l.parcelaNumero != null)).toHaveLength(15)
  })

  it('⛔ e as parcelas das PRÓXIMAS faturas não viraram lançamento', async () => {
    const p = await previewFaturaPF({ userId, profileId, cardId, texto: ITAU })
    expect(p.proximasFaturas.total).toBeCloseTo(1818.89, 2)
    // ⚠️ 4.370,79 é a Σ SEM as 10 do bloco futuro; com elas passaria de 6 mil
    expect(p.conferencia.despesasCalculado).toBeCloseTo(4370.79, 2)
  })
})

describe('⭐⭐ e o CONFIRM grava a fatura fechando com o boleto', () => {
  it('⛔ a fatura gravada soma 4.491,18 — o valor do boleto, ao centavo', async () => {
    const r = await confirmarFaturaPF({ userId, profileId, cardId, texto: ITAU })
    // 37 lançamentos + 1 linha de encargo (declarada no resumo, não é lançamento)
    expect(r.criadas).toBe(38)
    expect(r.totalFatura).toBeCloseTo(4491.18, 2)
    const inv = await db.creditCardInvoice.findFirstOrThrow({ where: { id: r.invoiceId } })
    expect(inv.totalAmount).toBeCloseTo(4491.18, 2)
  })

  it('⭐ o encargo é gravado com o nome QUE O DOCUMENTO USA', async () => {
    const enc = await db.personalTransaction.findFirstOrThrow({
      where: { creditCardId: cardId, amount: 120.39 },
    })
    // ⛔ "Encargos sobre rotativo" é rótulo do Banrisul; esta fatura chama de outro jeito
    expect(enc.description).toBe('Encargos (financiamento + moratório)')
  })

  it('⭐ o portador fica gravado em cada linha, e reimportar não duplica', async () => {
    const doOutro = await db.personalTransaction.count({
      where: { creditCardId: cardId, notes: 'portador ****8818' },
    })
    expect(doOutro).toBe(10)
    const denovo = await confirmarFaturaPF({ userId, profileId, cardId, texto: ITAU })
    expect(denovo.criadas).toBe(0)
    const inv = await db.creditCardInvoice.findFirstOrThrow({ where: { creditCardId: cardId } })
    expect(inv.totalAmount).toBeCloseTo(4491.18, 2)
  })
})

describe('⛔⛔ e a do NUBANK é lida pelo parser do NUBANK — o caso de 31/08', () => {
  it('⭐ reconhece Nubank e lê com ele (com o Banrisul cravado, dava 0 linhas)', async () => {
    const p = await previewFaturaPF({ userId, profileId, cardId, texto: NUBANK })
    expect(p.banco).toBe('Nubank')
    expect(p.linhas.length).toBeGreaterThan(0)
    expect(p.conferencia.saldoDeclarado).toBeCloseTo(3053.32, 2)
  })
})

describe('⛔ documento de banco desconhecido continua parando com a frase certa', () => {
  it('não inventa parser nem número', async () => {
    const p = await previewFaturaPF({
      userId, profileId, cardId, texto: 'EXTRATO DE CONTA\nSALDO ANTERIOR 100,00',
    })
    expect(p.ok).toBe(false)
    expect(p.causa).toBe('BANCO_NAO_RECONHECIDO')
    expect(p.linhas).toHaveLength(0)
    expect(p.erro).toContain('Itaú/Luizacred') // a lista do que ele sabe ler, atualizada
  })
})

describe('⛔⛔⛔ O TOTAL DIGITADO SOBREVIVE ATÉ A GRAVAÇÃO (09/09/2026)', () => {
  // ⛔ Medido em prod: o dono digitou o total da fatura do Magalu, o preview ficou VERDE,
  // ele confirmou — e o cartão ficou com **0 lançamentos**. O `confirmarFaturaPF` nem
  // aceitava `totalDigitado` e a rota não o repassava: o confirm rerodava a conferência
  // sem o número, caía em "não fecha" e recusava gravar **em silêncio pra quem olhava a
  // tela verde**. A saída "digite o total olhando a fatura", criada em 31/08, NUNCA
  // funcionou ponta a ponta.
  //
  // ⚠️ O documento aqui é o MESMO PDF com a linha do "Total desta fatura" removida — o
  // caso exato pra que a saída manual existe (o PDF não declara o total). Se ele
  // declarasse, este teste passaria por acidente e não provaria nada.
  // ⛔ Removo SÓ essa linha de propósito: cortar a capa inteira levaria junto o
  // vencimento, e aí a recusa seria por outro motivo — o teste ficaria verde pelo
  // caminho errado.
  const SEM_TOTAL = ITAU.split('\n').filter((l) => !/Total desta fatura/.test(l)).join('\n')

  it('⭐ sem o resumo, o preview pede o total — e o aceita', async () => {
    const semNada = await previewFaturaPF({ userId, profileId, cardId: cardManualId, texto: SEM_TOTAL })
    expect(semNada.ok).toBe(false)
    expect(semNada.causa).toBe('SEM_TOTAIS_DECLARADOS')

    const comTotal = await previewFaturaPF({
      userId, profileId, cardId: cardManualId, texto: SEM_TOTAL, totalDigitado: 4491.18,
    })
    expect(comTotal.origemTotal).toBe('DIGITADO')
    expect(comTotal.totalDeclarado).toBeCloseTo(4491.18, 2)
    // ⛔⛔ ESTE era o `false` que fazia o dono digitar o número e o import recusar
    expect(comTotal.ok).toBe(true)
  })

  it('⛔⛔ e o CONFIRM grava com ele — antes, recusava com o preview verde na tela', async () => {
    const r = await confirmarFaturaPF({
      userId, profileId, cardId: cardManualId, texto: SEM_TOTAL, totalDigitado: 4491.18,
    })
    expect(r.criadas).toBeGreaterThan(0)
    expect(r.totalFatura).toBeCloseTo(4491.18, 2)
    const n = await db.personalTransaction.count({ where: { creditCardId: cardManualId } })
    expect(n).toBeGreaterThan(0)
  })

  it('⛔ e sem o total digitado o confirm continua RECUSANDO — a trava não afrouxou', async () => {
    await expect(
      confirmarFaturaPF({ userId, profileId, cardId: cardManualId, texto: SEM_TOTAL }),
    ).rejects.toThrow()
  })

  it('⛔⛔ e digitar NÃO resgata fatura que o PDF declara e não bate — não é `force`', async () => {
    // ⚠️ a fatura completa declara 4.491,18; digitar 9.999 não pode fazê-la passar.
    const p = await previewFaturaPF({
      userId, profileId, cardId: cardManualId, texto: ITAU.replace('4.370,79', '4.999,99'), totalDigitado: 9999,
    })
    expect(p.ok).toBe(false)
  })
})
