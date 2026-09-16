// Sprint Fundação Status (28/06/2026) — defensivos: todos os endpoints
// que filtram "pendente" usam a fonte única.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { statusFromCategoryId } from '@/lib/transacoes/needs-review'

const root = (p: string) => join(__dirname, '..', '..', p)

describe('PDF confirm aplica escada de status (categoryId null ⇒ PENDING)', () => {
  const code = readFileSync(
    root('app/api/contas-bancarias/[id]/importar-pdf-extrato/confirm/route.ts'),
    'utf-8',
  )

  it('importa statusFromCategoryId', () => {
    expect(code).toMatch(/statusFromCategoryId/)
    expect(code).toMatch(/from '@\/lib\/transacoes\/needs-review'/)
  })

  it('NAO usa mais hardcoded RECONCILED ao criar tx PDF', () => {
    expect(code).not.toMatch(/status:\s*'RECONCILED',\s*\n\s*origin:\s*'PDF'/)
  })

  it('usa statusFromCategoryId(null) na createMany', () => {
    expect(code).toMatch(/status:\s*statusFromCategoryId\(null\)/)
  })
})

describe('Fonte única usada em todos os callers de "pra revisar"', () => {
  const FILES = [
    'app/api/transacoes/route.ts',
    'app/api/conciliacao/ofx-pendentes/route.ts',
    'app/api/conciliacao/bulk-dry-run/route.ts',
    // ⚠️⚠️ `badges/route.ts` SAIU da lista na faxina de 15/09. Ele contava `NEEDS_REVIEW`
    // (linha sem categoria, desde sempre) pro badge da tela **Pendentes**, que morreu. A
    // vigilância não sumiu: foi REAPONTADA pro contador da CAIXA — e lá a pergunta não é
    // "falta categoria?", é "falta DESTINO?". Régua diferente, fonte única própria
    // (`contarLinhasEsperandoDecisao`, a MESMA que a tela desenha).
  ]

  for (const f of FILES) {
    it(`${f} importa NEEDS_REVIEW_WHERE_PRISMA`, () => {
      const code = readFileSync(root(f), 'utf-8')
      expect(code).toMatch(/NEEDS_REVIEW_WHERE_PRISMA/)
      expect(code).toMatch(/from '@\/lib\/transacoes\/needs-review'/)
    })

    it(`${f} usa spread ...NEEDS_REVIEW_WHERE_PRISMA OU Object.assign`, () => {
      const code = readFileSync(root(f), 'utf-8')
      // Tolerante: pode ser spread ou Object.assign
      const usaSpread = /\.\.\.NEEDS_REVIEW_WHERE_PRISMA/.test(code)
      const usaAssign = /Object\.assign\(where,\s*NEEDS_REVIEW_WHERE_PRISMA\)/.test(code)
      expect(usaSpread || usaAssign).toBe(true)
    })
  }
})

/**
 * ⚠️⚠️ REAPONTADO EM 15/09 — A TELA MORREU E A PERGUNTA FICOU MAIS FORTE.
 *
 * A régua antiga era *"o cliente dos Pendentes não pode forçar `status=PENDING`"* — porque
 * `status` é DERIVADO da escada (`categoryId` null ⇒ PENDING), e filtrar por ele congelava
 * a leitura. Os Pendentes viraram a **CAIXA DE ENTRADA**, e lá a régua é a mesma um degrau
 * acima: a fila não se define por STATUS **nem por CATEGORIA** — se define por **VÍNCULO
 * QUE FALTA** (a lição de 07/09: *"ter categoria não quita conta nenhuma"*).
 */
describe('a CAIXA não define a fila por status nem por categoria', () => {
  const caixa = readFileSync(root('lib/conciliacao/fila-de-conciliacao.ts'), 'utf-8')

  it('⛔ `LINHA_DISPONIVEL_WHERE` não filtra por categoryId', () => {
    const bloco = caixa.slice(caixa.indexOf('LINHA_DISPONIVEL_WHERE'), caixa.indexOf('LINHA_DISPONIVEL_WHERE') + 1400)
    expect(bloco, 'a fila voltou a esquecer a linha assim que ela ganha categoria').not.toMatch(/categoryId:/)
  })

  it('⭐ quem decide a estação é a derivação única, não um status gravado', () => {
    const lei = readFileSync(root('lib/conciliacao/caixa-de-entrada.ts'), 'utf-8')
    expect(lei).toContain('export function estacaoDaLinha')
    expect(lei).toContain('export function comoFoiResolvida')
  })
})

describe('/conciliacao/ofx-pendentes — NÃO duplica filtros inline (consolidou no spread)', () => {
  const code = readFileSync(
    root('app/api/conciliacao/ofx-pendentes/route.ts'),
    'utf-8',
  )

  it('o spread NEEDS_REVIEW_WHERE_PRISMA está dentro do where da query', () => {
    // Busca o bloco `findMany({ where: { ... ... } })` e confirma o spread
    const block = code.match(/findMany\(\{[\s\S]+?where:\s*\{[\s\S]+?\}/)
    expect(block).toBeTruthy()
    expect(block![0]).toMatch(/\.\.\.NEEDS_REVIEW_WHERE_PRISMA/)
  })
})

describe('Coerência: escada inviolável', () => {
  it('categoryId null produz status PENDING', () => {
    expect(statusFromCategoryId(null)).toBe('PENDING')
    expect(statusFromCategoryId('cat_xyz')).toBe('RECONCILED')
  })
})
