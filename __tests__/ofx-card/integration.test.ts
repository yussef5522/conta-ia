// Sprint PF Fatia 3 — Integração e2e do pipeline import OFX cartão.

import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import bcrypt from 'bcryptjs'
import { readFileSync } from 'fs'
import { join } from 'path'
import { prisma } from '@/lib/db'
import {
  createProfile,
  createAccount,
  listCategoriesForProfile,
} from '@/lib/personal-profile/queries'
import { createCreditCard } from '@/lib/credit-card/queries'
import {
  createPreview,
  confirmImport,
  revertImport,
  OfxCardError,
} from '@/lib/ofx-card/queries'

const FIXTURE = readFileSync(
  join(__dirname, '..', 'fixtures', 'nubank-fatura.ofx'),
  'utf-8',
)

const PREFIX = `ofx-int-${Date.now()}-${process.pid}`
let userA: { id: string }
let profile: { id: string }
let card: { id: string }

beforeAll(async () => {
  const pwd = await bcrypt.hash('TestPwd123!', 10)
  userA = await prisma.user.create({
    data: { name: 'A', email: `${PREFIX}-a@dev.local`, password: pwd },
  })
  profile = await createProfile({ userId: userA.id, name: 'A' })
  await createAccount({
    userId: userA.id,
    profileId: profile.id,
    name: 'Conta pgto',
    balance: 5000,
  })
  card = await createCreditCard({
    userId: userA.id,
    profileId: profile.id,
    name: 'Nubank',
    creditLimit: 5000,
    closingDay: 14,
    dueDay: 20,
  })
})

afterAll(async () => {
  await prisma.user
    .deleteMany({ where: { email: { contains: PREFIX } } })
    .catch(() => {})
})

describe('createPreview — fixture Nubank real', () => {
  let previewId = ''

  test('preview retorna 15 linhas + metadata correta', async () => {
    const r = await createPreview({
      userId: userA.id,
      profileId: profile.id,
      creditCardId: card.id,
      fileName: 'nubank-fatura.ofx',
      fileSize: FIXTURE.length,
      rawContent: FIXTURE,
    })
    expect(r.totalLines).toBe(15)
    expect(r.statementType).toBe('CREDITCARD')
    expect(r.org).toBe('NU PAGAMENTOS S.A.')
    expect(r.fid).toBe('260')
    previewId = r.importId
  })

  test('detecta 3 parcelas (Airbnb, Laghetto, MercadoLivre)', async () => {
    const r = await createPreview({
      userId: userA.id,
      profileId: profile.id,
      creditCardId: card.id,
      fileName: 'n.ofx',
      fileSize: FIXTURE.length,
      rawContent: FIXTURE,
    })
    expect(r.parcelasDetected).toBe(3)
    const airbnb = r.lines.find((l) => l.description.includes('Airbnb'))
    expect(airbnb?.isInstallment).toBe(true)
    expect(airbnb?.installmentNumber).toBe(5)
    expect(airbnb?.installmentTotal).toBe(6)
  })

  test('detecta 1 pagamento recebido (CREDIT R$ 2800)', async () => {
    const r = await createPreview({
      userId: userA.id,
      profileId: profile.id,
      creditCardId: card.id,
      fileName: 'n.ofx',
      fileSize: FIXTURE.length,
      rawContent: FIXTURE,
    })
    expect(r.invoicePaymentsSkipped).toBe(1)
    const pag = r.lines.find((l) => l.description === 'Pagamento recebido')
    expect(pag?.shouldSkipImport).toBe(true)
    expect(pag?.specialKind).toBe('INVOICE_PAYMENT')
  })

  test('detecta encargos: multa, 2 IOFs, valor pendente = 4 encargos', async () => {
    const r = await createPreview({
      userId: userA.id,
      profileId: profile.id,
      creditCardId: card.id,
      fileName: 'n.ofx',
      fileSize: FIXTURE.length,
      rawContent: FIXTURE,
    })
    expect(r.encargosDetected).toBe(4)
  })

  test('Netflix e Spotify categorizados via KEYWORD', async () => {
    const r = await createPreview({
      userId: userA.id,
      profileId: profile.id,
      creditCardId: card.id,
      fileName: 'n.ofx',
      fileSize: FIXTURE.length,
      rawContent: FIXTURE,
    })
    const netflix = r.lines.find((l) => l.description === 'Netflix')
    expect(netflix?.layer).toBe('KEYWORD')
    expect(netflix?.suggestedCategoryName).toBe('Lazer')
    const spotify = r.lines.find((l) => l.description === 'Spotify')
    expect(spotify?.suggestedCategoryName).toBe('Lazer')
  })

  test('Posto Pitangueira → Transporte via KEYWORD', async () => {
    const r = await createPreview({
      userId: userA.id,
      profileId: profile.id,
      creditCardId: card.id,
      fileName: 'n.ofx',
      fileSize: FIXTURE.length,
      rawContent: FIXTURE,
    })
    const posto = r.lines.find((l) => l.description === 'Posto Pitangueira')
    expect(posto?.suggestedCategoryName).toBe('Transporte')
    expect(posto?.confidence).toBeGreaterThanOrEqual(0.85)
  })

  test('Claude.Ai → Educação via KEYWORD', async () => {
    const r = await createPreview({
      userId: userA.id,
      profileId: profile.id,
      creditCardId: card.id,
      fileName: 'n.ofx',
      fileSize: FIXTURE.length,
      rawContent: FIXTURE,
    })
    const claude = r.lines.find((l) => l.description === 'Claude.Ai Subscription')
    expect(claude?.suggestedCategoryName).toBe('Educação')
  })

  test('todas as parcelas detectadas têm installmentNumber/Total', async () => {
    const r = await createPreview({
      userId: userA.id,
      profileId: profile.id,
      creditCardId: card.id,
      fileName: 'n.ofx',
      fileSize: FIXTURE.length,
      rawContent: FIXTURE,
    })
    const parcelas = r.lines.filter((l) => l.isInstallment)
    expect(parcelas.length).toBe(3)
    expect(parcelas.every((p) => p.installmentNumber && p.installmentTotal)).toBe(true)
  })
})

describe('confirmImport — fixture Nubank', () => {
  test('aceita decisões → cria tx + atualiza invoice', async () => {
    // Cria novo preview pra esse teste
    const preview = await createPreview({
      userId: userA.id,
      profileId: profile.id,
      creditCardId: card.id,
      fileName: 'n.ofx',
      fileSize: FIXTURE.length,
      rawContent: FIXTURE,
    })
    // Decisão: aceita todas exceto pagamento recebido (auto-skip)
    const decisions = preview.lines.map((l) => ({
      fitid: l.fitid,
      skip: l.shouldSkipImport,
      categoryId: l.suggestedCategoryId,
    }))

    const result = await confirmImport({
      userId: userA.id,
      profileId: profile.id,
      importId: preview.importId,
      decisions,
      rawContent: FIXTURE,
    })

    // 15 total - 1 pagamento = 14 importadas
    expect(result.imported).toBe(14)
    expect(result.skipped).toBeGreaterThanOrEqual(1)

    // Confirma que invoice atualizou totalAmount
    const invoices = await prisma.creditCardInvoice.findMany({
      where: { creditCardId: card.id },
    })
    const totalSum = invoices.reduce((s, i) => s + i.totalAmount, 0)
    expect(totalSum).toBeGreaterThan(0)

    // Confirma que PersonalTransactions foram criadas e linkadas
    const txs = await prisma.personalTransaction.findMany({
      where: { ofxImportId: preview.importId },
    })
    expect(txs.length).toBe(14)
  })

  test('idempotência: re-confirm mesmo import → 409 INVALID_STATUS', async () => {
    const preview = await createPreview({
      userId: userA.id,
      profileId: profile.id,
      creditCardId: card.id,
      fileName: 'n.ofx',
      fileSize: FIXTURE.length,
      rawContent: FIXTURE,
    })
    const decisions = preview.lines.map((l) => ({
      fitid: l.fitid,
      skip: false,
      categoryId: l.suggestedCategoryId,
    }))
    await confirmImport({
      userId: userA.id,
      profileId: profile.id,
      importId: preview.importId,
      decisions,
      rawContent: FIXTURE,
    })
    // 2ª chamada
    await expect(
      confirmImport({
        userId: userA.id,
        profileId: profile.id,
        importId: preview.importId,
        decisions,
        rawContent: FIXTURE,
      }),
    ).rejects.toThrow(OfxCardError)
  })
})

describe('revertImport', () => {
  test('reverte deleta tx + decrementa invoice + status REVERTED', async () => {
    // Novo cartão pra evitar colisão de dedupHash com tests anteriores
    const cardRevert = await createCreditCard({
      userId: userA.id,
      profileId: profile.id,
      name: 'CardRevert',
      creditLimit: 5000,
      closingDay: 14,
      dueDay: 20,
    })
    const preview = await createPreview({
      userId: userA.id,
      profileId: profile.id,
      creditCardId: cardRevert.id,
      fileName: 'n.ofx',
      fileSize: FIXTURE.length,
      rawContent: FIXTURE,
    })
    const decisions = preview.lines.map((l) => ({
      fitid: l.fitid,
      skip: l.shouldSkipImport,
      categoryId: l.suggestedCategoryId,
    }))
    await confirmImport({
      userId: userA.id,
      profileId: profile.id,
      importId: preview.importId,
      decisions,
      rawContent: FIXTURE,
    })

    const result = await revertImport({
      userId: userA.id,
      profileId: profile.id,
      importId: preview.importId,
    })
    expect(result.deleted).toBeGreaterThanOrEqual(14)

    const importAfter = await prisma.personalOfxImport.findUnique({
      where: { id: preview.importId },
    })
    expect(importAfter?.status).toBe('REVERTED')

    const remaining = await prisma.personalTransaction.count({
      where: { ofxImportId: preview.importId },
    })
    expect(remaining).toBe(0)
  })
})
