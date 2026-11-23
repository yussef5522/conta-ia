// Sprint PF Fatia 3.5 — Cache SHA256 (integração SQLite dev).

// ⭐ (23/11) O FLAKY CURADO (fichado desde 18/11 — passava sozinho, caía na suíte):
//  1. os efeitos do `getCachedExtraction` eram fire-and-forget e o teste dormia 50/100 ms
//     torcendo — sob a suíte cheia o SQLite demora mais. Agora o lib AGUARDA, e o teste não dorme.
//  2. os hashes eram FIXOS ('a'×64…) num campo ÚNICO global: uma rodada que morria antes do
//     `afterAll` deixava a linha com outro dono, e a próxima herdava. Agora cada rodada tem os
//     seus (derivados do PREFIX) e o beforeAll limpa por eles.
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { createHash } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import {
  getCachedExtraction,
  saveCachedExtraction,
  deleteCachedExtraction,
  listOwnerCaches,
} from '@/lib/pdf-import/cache'

const PREFIX = `pdf-cache-${Date.now()}-${process.pid}`
const H = (k: string) => createHash('sha256').update(`${PREFIX}:${k}`).digest('hex')
const HASHES = ['a', 'b', 'c', 'd'].map(H)
let userA: { id: string }
let userB: { id: string }

beforeAll(async () => {
  await prisma.personalPdfExtractCache.deleteMany({ where: { pdfSha256: { in: HASHES } } })
  const pwd = await bcrypt.hash('TestPwd123!', 10)
  userA = await prisma.user.create({
    data: { name: 'A', email: `${PREFIX}-a@dev.local`, password: pwd },
  })
  userB = await prisma.user.create({
    data: { name: 'B', email: `${PREFIX}-b@dev.local`, password: pwd },
  })
})

afterAll(async () => {
  await prisma.personalPdfExtractCache
    .deleteMany({ where: { OR: [{ ownerUserId: { in: [userA.id, userB.id] } }, { pdfSha256: { in: HASHES } }] } })
    .catch(() => {})
  await prisma.user.deleteMany({ where: { email: { contains: PREFIX } } }).catch(() => {})
})

function fakeResult() {
  return {
    detectedBank: 'Nubank',
    scanQuality: 'DIGITAL' as const,
    closingDate: '2026-05-14',
    dueDate: '2026-05-20',
    declaredTotal: 1000,
    extractedSum: 1000,
    declaredTxCount: 2,
    confidence: 0.9,
    detectedCardLast4: '1234',
    transactions: [],
    warnings: [],
    modelVersion: 'sonnet',
    inputTokens: 100,
    outputTokens: 50,
    costCentsUsdX100: 10,
  }
}

describe('Cache CRUD', () => {
  const hash = H('a')

  test('save → get retorna mesmo resultado', async () => {
    await saveCachedExtraction({
      pdfSha256: hash,
      ownerUserId: userA.id,
      result: fakeResult(),
    })
    const got = await getCachedExtraction(hash)
    expect(got).not.toBeNull()
    expect(got?.detectedBank).toBe('Nubank')
    expect(got?.declaredTotal).toBe(1000)
  })

  test('get cache inexistente → null', async () => {
    const got = await getCachedExtraction(H('b'))
    expect(got).toBeNull()
  })

  test('hit incrementa hitCount', async () => {
    const before = await prisma.personalPdfExtractCache.findUnique({
      where: { pdfSha256: hash },
    })
    await getCachedExtraction(hash)
    const after = await prisma.personalPdfExtractCache.findUnique({
      where: { pdfSha256: hash },
    })
    expect((after?.hitCount ?? 0)).toBeGreaterThan(before?.hitCount ?? 0)
  })
})

describe('Cache LGPD ownership', () => {
  const hashB = H('c')

  test('userB pode SALVAR cache (vira owner)', async () => {
    await saveCachedExtraction({
      pdfSha256: hashB,
      ownerUserId: userB.id,
      result: fakeResult(),
    })
  })

  test('🛡️ userA NÃO pode deletar cache de userB → false', async () => {
    const deleted = await deleteCachedExtraction(hashB, userA.id)
    expect(deleted).toBe(false)
    // cache ainda existe
    expect(await getCachedExtraction(hashB)).not.toBeNull()
  })

  test('userB DELETA seu próprio cache', async () => {
    const deleted = await deleteCachedExtraction(hashB, userB.id)
    expect(deleted).toBe(true)
    expect(await getCachedExtraction(hashB)).toBeNull()
  })

  test('listOwnerCaches só retorna do user', async () => {
    const a = await listOwnerCaches(userA.id)
    const b = await listOwnerCaches(userB.id)
    expect(a.some((c) => c.pdfSha256 === H('a'))).toBe(true)
    expect(b.some((c) => c.pdfSha256 === H('a'))).toBe(false)
  })
})

describe('TTL expiração lazy', () => {
  const hashExp = H('d')

  test('cache expirado → null + auto-clean', async () => {
    await prisma.personalPdfExtractCache.create({
      data: {
        pdfSha256: hashExp,
        modelVersion: 'sonnet',
        resultJson: JSON.stringify(fakeResult()),
        inputTokens: 100,
        outputTokens: 50,
        costCentsUsdX100: 10,
        ownerUserId: userA.id,
        expiresAt: new Date(Date.now() - 1000), // já expirou
      },
    })
    const got = await getCachedExtraction(hashExp)
    expect(got).toBeNull()
    const stillExists = await prisma.personalPdfExtractCache.findUnique({
      where: { pdfSha256: hashExp },
    })
    expect(stillExists).toBeNull()
  })
})
