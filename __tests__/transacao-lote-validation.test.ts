import { describe, it, expect } from 'vitest'
import { transacaoLoteClassificacaoSchema } from '../lib/validations/transacao-lote'

const ID_VALIDO_1 = 'cl1234567890abcdefghijklm'
const ID_VALIDO_2 = 'cl0987654321zyxwvutsrqpon'
const CAT_ID_VALIDO = 'clcat567890abcdefghijklmn'

describe('transacaoLoteClassificacaoSchema', () => {
  it('aceita lote válido com categoria', () => {
    const r = transacaoLoteClassificacaoSchema.safeParse({
      transactionIds: [ID_VALIDO_1, ID_VALIDO_2],
      categoryId: CAT_ID_VALIDO,
    })
    expect(r.success).toBe(true)
  })

  it('aceita 1 transação só (mínimo)', () => {
    const r = transacaoLoteClassificacaoSchema.safeParse({
      transactionIds: [ID_VALIDO_1],
      categoryId: CAT_ID_VALIDO,
    })
    expect(r.success).toBe(true)
  })

  it('aceita categoryId null (caso de descrassificar lote)', () => {
    const r = transacaoLoteClassificacaoSchema.safeParse({
      transactionIds: [ID_VALIDO_1],
      categoryId: null,
    })
    expect(r.success).toBe(true)
  })

  it('rejeita transactionIds vazio', () => {
    const r = transacaoLoteClassificacaoSchema.safeParse({
      transactionIds: [],
      categoryId: null,
    })
    expect(r.success).toBe(false)
  })

  it('rejeita transactionIds com mais de 500 entradas', () => {
    const r = transacaoLoteClassificacaoSchema.safeParse({
      transactionIds: Array(501).fill(ID_VALIDO_1),
      categoryId: null,
    })
    expect(r.success).toBe(false)
  })

  it('aceita exatamente 500 entradas (limite)', () => {
    const r = transacaoLoteClassificacaoSchema.safeParse({
      transactionIds: Array(500).fill(ID_VALIDO_1),
      categoryId: null,
    })
    expect(r.success).toBe(true)
  })

  it('rejeita transactionIds com formato inválido (não cuid)', () => {
    const r = transacaoLoteClassificacaoSchema.safeParse({
      transactionIds: ['nao-eh-cuid'],
      categoryId: null,
    })
    expect(r.success).toBe(false)
  })

  it('rejeita categoryId com formato inválido (não cuid)', () => {
    const r = transacaoLoteClassificacaoSchema.safeParse({
      transactionIds: [ID_VALIDO_1],
      categoryId: 'nao-eh-cuid',
    })
    expect(r.success).toBe(false)
  })

  it('rejeita campos extras silenciosamente (Zod é strict-by-default? não, mas aceita)', () => {
    // Zod por padrão ignora chaves extras — não falha. Validamos só que o parse funciona.
    const r = transacaoLoteClassificacaoSchema.safeParse({
      transactionIds: [ID_VALIDO_1],
      categoryId: CAT_ID_VALIDO,
      extra: 'campo nao previsto',
    })
    expect(r.success).toBe(true)
  })

  it('rejeita body sem transactionIds', () => {
    const r = transacaoLoteClassificacaoSchema.safeParse({ categoryId: null })
    expect(r.success).toBe(false)
  })

  it('rejeita body sem categoryId', () => {
    const r = transacaoLoteClassificacaoSchema.safeParse({ transactionIds: [ID_VALIDO_1] })
    expect(r.success).toBe(false)
  })
})
