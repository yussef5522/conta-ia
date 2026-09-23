/**
 * ⭐⭐⭐ O LOTE OBEDECE A REGRA DA CATEGORIA (23/09/2026).
 *
 * **O furo, achado pelo dono:** as 6 notas da MARIA LUIZA estão **sem categoria** e o
 * *"Vincular 6"* deixaria passar. A causa é estrutural: o lote postava em
 * `/find-and-match/reconcile` — uma rota **própria**, fora do `resolverLinha`, que é onde
 * o `PEDE_CATEGORIA` mora (20/09).
 *
 * ⛔ ***"N caminhos, 1 esquecido"*** — agora na regra que existe justamente pra nada sair
 * da caixa sem classificação. Conciliadas por ali, as 6 sairiam da caixa e a despesa não
 * entraria em DRE nenhum.
 *
 * ⚠️ REGRA 3: roda o `resolverLinha` REAL contra o banco, com as 6 contas de verdade.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { resolverLinha, ResolverError } from '../resolver-linha'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const CNPJ = '50607080000933' // ⚠️ exclusivo deste arquivo
let companyId = ''
let contaBancariaId = ''
let fornecedorId = ''
let categoriaId = ''
let linhaId = ''
let notas: string[] = []
let userId = ''

/**
 * ⚠️ O `authCtx` vai COMPLETO de propósito — o `reconcileTransactions` usa `company.id` e
 * `requirePermission()`, e foi um `as never` sem eles que virou 500 sem corpo em 20/09.
 * ⛔ E NADA é mockado aqui: *guard que substitui a peça não prova o encaixe dela*.
 */
const pedido = (extra: Record<string, unknown> = {}) => ({
  companyId, txId: linhaId, acao: 'CASAR_PAGAR' as const, contaIds: notas, userId,
  authCtx: {
    user: { id: userId, name: 'teste', email: 't@t.t' },
    company: { id: companyId },
    role: { id: 'r', name: 'OWNER', isSystemDefault: true },
    permissions: ['*'],
    requirePermission: () => {},
  } as never,
  ...extra,
})

beforeAll(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const co = await prisma.company.create({ data: { name: 'lote-categoria', cnpj: CNPJ }, select: { id: true } })
  companyId = co.id
  /**
   * ⚠️ USUÁRIO DE VERDADE: o caminho real grava AUDITORIA, e o `auditLog` tem FK pro
   * `User`. Um id inventado passaria no TypeScript e estouraria no banco — e foi
   * exatamente assim que o `as never` de 20/09 virou 500 sem corpo.
   */
  const u = await prisma.user.create({
    data: { email: `lote-cat-${CNPJ}@teste.local`, name: 'teste', password: 'x' }, select: { id: true },
  })
  userId = u.id
  const ba = await prisma.bankAccount.create({
    data: { companyId, name: 'stone', bankCode: '197', balance: 0 }, select: { id: true },
  })
  contaBancariaId = ba.id
  const f = await prisma.supplier.create({
    data: { companyId, razaoSocial: 'MARIA LUIZA COELHO PIENEGONDA' }, select: { id: true },
  })
  fornecedorId = f.id
  const cat = await prisma.category.create({
    data: { companyId, name: 'Matéria-Prima - Alimentos', type: 'EXPENSE' }, select: { id: true },
  })
  categoriaId = cat.id
})

afterAll(async () => {
  await prisma.transaction.deleteMany({ where: { bankAccountId: contaBancariaId } })
  await prisma.transaction.deleteMany({ where: { supplierId: fornecedorId } })
  await prisma.supplier.deleteMany({ where: { companyId } })
  await prisma.category.deleteMany({ where: { companyId } })
  await prisma.bankAccount.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
  await prisma.auditLog.deleteMany({ where: { userId } })
  await prisma.user.deleteMany({ where: { id: userId } })
})

/** o cenário REAL: 1 pagamento na stone e 6 notas abertas SEM categoria */
beforeEach(async () => {
  await prisma.transaction.deleteMany({ where: { OR: [{ bankAccountId: contaBancariaId }, { supplierId: fornecedorId }] } })
  const valores = [1134.93, 460.96, 457.83, 376.89, 324.6, 131.16]
  const l = await prisma.transaction.create({
    data: {
      bankAccountId: contaBancariaId, description: 'MARIA LUIZA COELHO PIENEGONDA - Transferência | Pix',
      amount: 2886.37, type: 'DEBIT', date: new Date('2026-09-22T12:00:00.000Z'),
      lifecycle: 'EFFECTED', status: 'PENDING', origin: 'OFX',
    },
    select: { id: true },
  })
  linhaId = l.id
  notas = []
  for (const [i, v] of valores.entries()) {
    const n = await prisma.transaction.create({
      data: {
        supplierId: fornecedorId, description: `MARIA LUIZA — NF 6911${i}`, amount: v, type: 'DEBIT',
        date: new Date('2026-09-21T00:00:00.000Z'), dueDate: new Date('2026-09-21T00:00:00.000Z'),
        lifecycle: 'PAYABLE', status: 'PENDING', origin: 'ESTOQUE_NF',
        // ⛔ SEM categoria — exatamente como as 6 estão em prod
      },
      select: { id: true },
    })
    notas.push(n.id)
  }
})

describe('⛔⛔ nada sai da caixa sem categoria — e o LOTE não é exceção', () => {
  it('⛔ vincular as 6 SEM categoria é RECUSADO, e nada grava', async () => {
    await expect(
      resolverLinha(pedido(), prisma),
    ).rejects.toThrow(ResolverError)

    // ⛔ e a recusa não deixa meia gravação
    const conciliadas = await prisma.transaction.count({ where: { id: { in: notas }, reconciledWithId: { not: null } } })
    expect(conciliadas, 'gravou pela metade').toBe(0)
    const comCategoria = await prisma.transaction.count({ where: { id: { in: notas }, categoryId: { not: null } } })
    expect(comCategoria).toBe(0)
  })

  it('⭐ a recusa carrega o code PEDE_CATEGORIA — é ele que vira a pergunta na tela', async () => {
    const e = await resolverLinha(pedido(), prisma)
      .catch((err: unknown) => err)
    expect(e).toBeInstanceOf(ResolverError)
    expect((e as ResolverError & { code?: string }).code).toBe('PEDE_CATEGORIA')
  })

  it('⭐⭐ UMA resposta grava nas SEIS — e a próxima nota do fornecedor já vem com ela', async () => {
    await resolverLinha(pedido({ categoryId: categoriaId }), prisma)
    const comCategoria = await prisma.transaction.count({ where: { id: { in: notas }, categoryId: categoriaId } })
    expect(comCategoria, 'a categoria tem que gravar em CADA conta, não só na linha').toBe(6)
  })

  it('⛔ a que JÁ tem categoria não é sobrescrita — a resposta é cooperativa', async () => {
    const outra = await prisma.category.create({
      data: { companyId, name: 'Outra', type: 'EXPENSE' }, select: { id: true },
    })
    await prisma.transaction.update({ where: { id: notas[0] }, data: { categoryId: outra.id } })
    await resolverLinha(pedido({ categoryId: categoriaId }), prisma)
    const n0 = await prisma.transaction.findUniqueOrThrow({ where: { id: notas[0] }, select: { categoryId: true } })
    expect(n0.categoryId, 'sobrescreveu a decisão que o dono já tinha tomado').toBe(outra.id)
  })

  it('⭐ com TODAS já categorizadas, o lote passa sem perguntar nada', async () => {
    await prisma.transaction.updateMany({ where: { id: { in: notas } }, data: { categoryId: categoriaId } })
    await expect(
      resolverLinha(pedido(), prisma),
    ).resolves.toBeDefined()
  })
})

describe('⛔ A PORTA É UMA SÓ — o lote não pode ter rota própria', () => {
  const tela = readFileSync(join(process.cwd(), 'components/conciliacao/lote-sugerido.tsx'), 'utf-8')
  const semComentario = tela.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('⛔⛔ o lote posta no `/resolver`, nunca no `/find-and-match/reconcile`', () => {
    expect(semComentario, 'o lote voltou a ter porta própria — o PEDE_CATEGORIA fica de fora')
      .not.toContain('find-and-match/reconcile')
    expect(semComentario).toContain("'/api/conciliacao/resolver'")
    expect(semComentario).toContain("acao: 'CASAR_PAGAR'")
  })

  it('⭐ a tela PEDE antes do clique — e o Vincular não libera sem resposta', () => {
    // ⚠️ o dono não deve descobrir a regra clicando e levando um não
    expect(semComentario).toContain('faltamCategoria')
    expect(semComentario).toMatch(/disabled=\{ocupado \|\| !bate \|\| faltamCategoria\.length > 0\}/)
    // ⛔ e o botão desabilitado DIZ por quê — desabilitado mudo é o dono sem entender
    expect(tela).toContain('diga a categoria primeiro')
  })

  it('⭐ e a recusa do servidor ainda vira a pergunta (a rede, se a tela falhar)', () => {
    expect(semComentario).toContain("body?.code === 'PEDE_CATEGORIA'")
  })
})
