// Sprint PF Fatia 3.5 — Integração: fixture sintético → pipeline IA → preview lines.
// Valida E2E que IA categoriza as compras do PDF Nubank fixture.

import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import {
  createProfile,
  listCategoriesForProfile,
} from '@/lib/personal-profile/queries'
import { createCreditCard } from '@/lib/credit-card/queries'
import { createPdfPreview } from '@/lib/pdf-import/queries'

const FIXTURE = readFileSync(
  join(__dirname, '..', 'fixtures', 'nubank-mai-2026.json'),
  'utf-8',
)

const PREFIX = `pdf-int-${Date.now()}-${process.pid}`
let userA: { id: string }
let profile: { id: string }
let card: { id: string }

// Env pra liberar PDF em test
process.env.PDF_IMPORT_ENABLED = 'true'

beforeAll(async () => {
  const pwd = await bcrypt.hash('TestPwd123!', 10)
  userA = await prisma.user.create({
    data: { name: 'A', email: `${PREFIX}-a@dev.local`, password: pwd },
  })
  profile = await createProfile({ userId: userA.id, name: 'A' })
  card = await createCreditCard({
    userId: userA.id,
    profileId: profile.id,
    name: 'Nubank',
    creditLimit: 10000,
    closingDay: 14,
    dueDay: 20,
  })
})

afterAll(async () => {
  await prisma.personalPdfExtractCache
    .deleteMany({ where: { ownerUserId: userA.id } })
    .catch(() => {})
  await prisma.user.deleteMany({ where: { email: { contains: PREFIX } } }).catch(() => {})
})

function fakePdfBytes(): Uint8Array {
  // PDF mínimo válido (header) com payload single
  return new TextEncoder().encode('%PDF-1.4\n%integration-test\n%%EOF')
}

function mockClaude() {
  return vi.fn(async () =>
    new Response(
      JSON.stringify({
        content: [{ type: 'text', text: FIXTURE }],
        usage: { input_tokens: 9000, output_tokens: 3200 },
        model: 'claude-sonnet-4-6',
        stop_reason: 'end_turn',
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ),
  ) as unknown as typeof fetch
}

describe('createPdfPreview — fixture Nubank mai/2026', () => {
  test('extrai 22 linhas e pipeline categoriza', async () => {
    const fetch = mockClaude()
    const result = await createPdfPreview(
      {
        userId: userA.id,
        profileId: profile.id,
        creditCardId: card.id,
        fileName: 'Fatura_Nubank_2026_05.pdf',
        pdfBytes: fakePdfBytes(),
      },
      { fetch, apiKey: 'k' },
    )
    expect(result.detectedBank).toBe('Nubank')
    expect(result.detectedCardLast4).toBe('2716')
    expect(result.lines.length).toBeGreaterThanOrEqual(20)
  })

  test('parcela Mercadolivre 4/10 detectada', async () => {
    const fetch = mockClaude()
    const result = await createPdfPreview(
      {
        userId: userA.id,
        profileId: profile.id,
        creditCardId: card.id,
        fileName: 'F.pdf',
        pdfBytes: new TextEncoder().encode('%PDF-1.4\nv2\n%%EOF'),
      },
      { fetch, apiKey: 'k' },
    )
    const ml = result.lines.find((l) => l.description.includes('Mercadolivre'))
    expect(ml?.isInstallment).toBe(true)
    expect(ml?.installmentNumber).toBe(4)
    expect(ml?.installmentTotal).toBe(10)
  })

  test('pagamento recebido → shouldSkipImport=true (não importa)', async () => {
    const fetch = mockClaude()
    const result = await createPdfPreview(
      {
        userId: userA.id,
        profileId: profile.id,
        creditCardId: card.id,
        fileName: 'F.pdf',
        pdfBytes: new TextEncoder().encode('%PDF-1.4\nv3\n%%EOF'),
      },
      { fetch, apiKey: 'k' },
    )
    expect(result.invoicePaymentsSkipped).toBe(1)
    const pag = result.lines.find((l) => l.description.includes('Pagamento'))
    expect(pag?.shouldSkipImport).toBe(true)
  })

  test('Netflix categorizado por KEYWORD → Lazer', async () => {
    const fetch = mockClaude()
    const result = await createPdfPreview(
      {
        userId: userA.id,
        profileId: profile.id,
        creditCardId: card.id,
        fileName: 'F.pdf',
        pdfBytes: new TextEncoder().encode('%PDF-1.4\nv4\n%%EOF'),
      },
      { fetch, apiKey: 'k' },
    )
    const netflix = result.lines.find((l) => l.description === 'Netflix')
    expect(netflix?.layer).toBe('KEYWORD')
    expect(netflix?.suggestedCategoryName).toBe('Lazer')
  })

  test('Anthropic (USD) → KEYWORD Educação + isInternational', async () => {
    const fetch = mockClaude()
    const result = await createPdfPreview(
      {
        userId: userA.id,
        profileId: profile.id,
        creditCardId: card.id,
        fileName: 'F.pdf',
        pdfBytes: new TextEncoder().encode('%PDF-1.4\nv5\n%%EOF'),
      },
      { fetch, apiKey: 'k' },
    )
    const anth = result.lines.find((l) => l.description.includes('Anthropic'))
    expect(anth?.suggestedCategoryName).toBe('Educação')
    expect(anth?.isInternational).toBe(true)
  })

  test('parcelasDetected = 3 (Mercadolivre + Airbnb + Laghetto)', async () => {
    const fetch = mockClaude()
    const result = await createPdfPreview(
      {
        userId: userA.id,
        profileId: profile.id,
        creditCardId: card.id,
        fileName: 'F.pdf',
        pdfBytes: new TextEncoder().encode('%PDF-1.4\nv6\n%%EOF'),
      },
      { fetch, apiKey: 'k' },
    )
    expect(result.parcelasDetected).toBe(3)
  })

  test('cache hit no 2º preview do mesmo PDF (sem chamada API)', async () => {
    const fetch1 = mockClaude()
    const sameBytes = new TextEncoder().encode('%PDF-1.4\nsame-bytes\n%%EOF')
    const r1 = await createPdfPreview(
      {
        userId: userA.id,
        profileId: profile.id,
        creditCardId: card.id,
        fileName: 'same.pdf',
        pdfBytes: sameBytes,
      },
      { fetch: fetch1, apiKey: 'k' },
    )
    expect(r1.cacheHit).toBe(false)
    expect(fetch1).toHaveBeenCalledTimes(1)

    const fetch2 = mockClaude()
    const r2 = await createPdfPreview(
      {
        userId: userA.id,
        profileId: profile.id,
        creditCardId: card.id,
        fileName: 'same.pdf',
        pdfBytes: sameBytes,
      },
      { fetch: fetch2, apiKey: 'k' },
    )
    expect(r2.cacheHit).toBe(true)
    expect(fetch2).toHaveBeenCalledTimes(0) // não chamou
    expect(r2.pdfSha256).toBe(r1.pdfSha256)
  })

  test('Tog4dev (compra internacional sem USD) → categoria Outros + isInternational', async () => {
    const fetch = mockClaude()
    const result = await createPdfPreview(
      {
        userId: userA.id,
        profileId: profile.id,
        creditCardId: card.id,
        fileName: 'F.pdf',
        pdfBytes: new TextEncoder().encode('%PDF-1.4\nv7\n%%EOF'),
      },
      { fetch, apiKey: 'k' },
    )
    const tog = result.lines.find((l) => l.description.includes('Tog4dev'))
    expect(tog?.isInternational).toBe(true)
    expect(tog?.rawAmount).toBe(334.03) // valor em REAL
  })
})

describe('createPdfPreview — feature flag', () => {
  test('PDF_IMPORT_ENABLED=false → DISABLED error', async () => {
    const prev = process.env.PDF_IMPORT_ENABLED
    process.env.PDF_IMPORT_ENABLED = 'false'
    try {
      await expect(
        createPdfPreview(
          {
            userId: userA.id,
            profileId: profile.id,
            creditCardId: card.id,
            fileName: 'F.pdf',
            pdfBytes: fakePdfBytes(),
          },
          { fetch: mockClaude(), apiKey: 'k' },
        ),
      ).rejects.toThrow()
    } finally {
      process.env.PDF_IMPORT_ENABLED = prev
    }
  })
})
