// ⛔⛔ SALVAR UM MODELO NOVO NÃO PODE TOCAR EM NENHUM MODELO EXISTENTE (01/09/2026).
//
// CASO REAL: o dono criou um modelo com nome próprio, viu "Modelo salvo" em verde, e não
// achou o modelo. No banco havia **um** modelo — o "Padrão" — com `atualizadoEm` da noite
// anterior e três campos trocados, **um deles a QUANTIDADE DESLIGADA**. Toda etiqueta
// impressa depois saiu sem a quantidade.
//
// ⚠️ O TESTE É SOBRE COMPORTAMENTO, não sobre mecanismo (pedido do dono): *"salvar um
// modelo NOVO não pode alterar o updatedAt nem os blocos de nenhum modelo existente"*.
//
// ⚠️ SÃO DUAS METADES, porque o defeito tinha duas:
//   1. o SERVIDOR — a rota real, contra o banco: `modeloId: null` cria e não encosta nos
//      outros. (Esta metade já estava certa; o teste existe pra continuar assim.)
//   2. o CLIENTE — era aqui que o bug morava: depois de salvar, `carregar()` reescrevia o
//      formulário com o PADRÃO, e o salvar seguinte ia por cima dele.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { signToken, COOKIE_NAME } from '@/lib/auth'
import { POST as salvarModelo } from '@/app/api/empresas/[id]/estoque/etiquetas/modelos/route'
import { BLOCOS_PADRAO } from '../blocos'
import { aoAbrir, aposSalvar, ficouNoModeloSalvo, type EstadoEditor } from '../estado-editor'

const CNPJ = '77777777000177'
let companyId: string
let userId: string
let token: string

/** ⚠️ NextRequest, não Request: a rota lê o cookie por `request.cookies.get()` — é o
 *  MESMO caminho do browser (padrão de `enforcement-estoque.integration.test.ts`). */
function req(body: unknown) {
  const r = new NextRequest(`http://localhost/api/empresas/${companyId}/estoque/etiquetas/modelos`, {
    method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
  })
  r.cookies.set(COOKIE_NAME, token)
  return r
}
const params = () => ({ params: Promise.resolve({ id: companyId }) })

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'EMPRESA MODELO' } })).id
  const u = await prisma.user.create({ data: { email: `mod-${Date.now()}@t.com`, password: 'x', name: 'Dono' } })
  userId = u.id
  const role = (await prisma.role.findFirst({ where: { name: 'OWNER' } }))
    ?? (await prisma.role.create({ data: { name: 'OWNER', isSystemDefault: true } }))
  await prisma.userCompanyRole.create({ data: { userId, companyId, roleId: role.id } })
  token = await signToken({ sub: userId, email: u.email, name: 'Dono', role: 'USER' })
})

afterEach(async () => {
  await prisma.stockEtiquetaModelo.deleteMany({ where: { companyId } })
  await prisma.userCompanyRole.deleteMany({ where: { companyId } })
  await prisma.user.deleteMany({ where: { id: userId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('⛔⛔ o SERVIDOR: criar um modelo não encosta nos que existem', () => {
  it('⛔⛔ `updatedAt` e `blocos` do modelo existente ficam INTACTOS', async () => {
    // 1. o "Padrão" da empresa, com a quantidade LIGADA (como era antes do acidente)
    const r1 = await salvarModelo(req({ nome: 'Padrão', blocos: BLOCOS_PADRAO, padrao: true }), params())
    const { modeloId: idPadrao } = await r1.json()
    const antes = await prisma.stockEtiquetaModelo.findUniqueOrThrow({ where: { id: idPadrao } })

    await new Promise((r) => setTimeout(r, 25)) // garante que um UPDATE mudaria o carimbo

    // 2. agora um modelo NOVO, com blocos diferentes (quantidade desligada, como no caso real)
    const outros = BLOCOS_PADRAO.map((b) => (b.campo === 'quantidade' ? { ...b, ativo: false } : b))
    const r2 = await salvarModelo(req({ modeloId: null, nome: 'Calabresa', blocos: outros, padrao: false }), params())
    expect(r2.status).toBe(200)
    const { modeloId: idNovo } = await r2.json()

    // 3. o novo existe E é outro
    expect(idNovo).not.toBe(idPadrao)
    const depois = await prisma.stockEtiquetaModelo.findUniqueOrThrow({ where: { id: idPadrao } })

    // ⛔ o que o dono pediu, ao pé da letra
    expect(depois.atualizadoEm.getTime(), 'o updatedAt do Padrão mudou').toBe(antes.atualizadoEm.getTime())
    expect(depois.blocos, 'os blocos do Padrão mudaram').toBe(antes.blocos)
    expect(depois.nome).toBe('Padrão')

    // e a QUANTIDADE do Padrão continua ligada — foi ela que sumiu no caso real
    const q = JSON.parse(depois.blocos).find((b: { id: string }) => b.id === 'quantidade')
    expect(q.ativo).toBe(true)
  })

  it('⭐ e agora existem DOIS modelos (o novo não substituiu o velho)', async () => {
    await salvarModelo(req({ nome: 'Padrão', blocos: BLOCOS_PADRAO, padrao: true }), params())
    await salvarModelo(req({ modeloId: null, nome: 'Calabresa', blocos: BLOCOS_PADRAO, padrao: false }), params())
    const todos = await prisma.stockEtiquetaModelo.findMany({ where: { companyId }, orderBy: { criadoEm: 'asc' } })
    expect(todos.map((m) => m.nome)).toEqual(['Padrão', 'Calabresa'])
  })

  it('⭐ editar de propósito (com modeloId) CONTINUA funcionando', async () => {
    const r1 = await salvarModelo(req({ nome: 'Padrão', blocos: BLOCOS_PADRAO, padrao: true }), params())
    const { modeloId } = await r1.json()
    const menos = BLOCOS_PADRAO.filter((b) => b.id !== 'colaborador')
    await salvarModelo(req({ modeloId, nome: 'Padrão', blocos: menos, padrao: true }), params())
    const m = await prisma.stockEtiquetaModelo.findUniqueOrThrow({ where: { id: modeloId } })
    expect(JSON.parse(m.blocos).length).toBe(BLOCOS_PADRAO.length - 1)
    expect(await prisma.stockEtiquetaModelo.count({ where: { companyId } })).toBe(1)
  })
})

describe('⛔⛔ o CLIENTE: depois de salvar, a tela FICA no que foi salvo', () => {
  // ⚠️ é aqui que o bug morava. Sem jsdom não dá pra clicar, então a decisão saiu do
  // componente pra `estado-editor.ts` — regra que vive dentro de `useState` é regra que
  // ninguém consegue provar (a lição do prefill do cardápio, 28/08).
  const PADRAO = { id: 'm-padrao', nome: 'Padrão', padrao: true, blocos: [{ id: 'a' }] }
  const NOVO = { id: 'm-novo', nome: 'Calabresa', padrao: false, blocos: [{ id: 'b' }] }

  /** o que o dono digitou: criou um modelo novo e nomeou */
  const digitado: EstadoEditor = { modeloId: null, nome: 'Calabresa', blocos: [{ id: 'b' }], padrao: false }

  it('⛔⛔ o caso REAL: salvar um NOVO não pode jogar a tela de volta pro Padrão', () => {
    const depois = aposSalvar(digitado, NOVO.id)
    expect(depois.modeloId).toBe(NOVO.id)
    expect(depois.nome).toBe('Calabresa')
    expect(ficouNoModeloSalvo(depois, NOVO.id)).toBe(true)

    // ⛔ o COMPORTAMENTO ANTIGO, pra deixar o contraste explícito: era isto que rodava
    // depois de salvar, e é isto que trocava o modelo debaixo do dono.
    const comoEra = aoAbrir([PADRAO, NOVO])!
    expect(comoEra.modeloId).toBe(PADRAO.id)
    expect(ficouNoModeloSalvo(comoEra, NOVO.id), 'a tela pulou pro Padrão').toBe(false)
  })

  it('⛔ e a MENSAGEM VERDE só é verdade se ficou — sucesso mentiroso é pior que erro', () => {
    // "mensagem de sucesso em cima de uma troca silenciosa é pior que erro — eu confiei
    // nela" (dono). Erro faz parar; sucesso mentiroso faz seguir destruindo.
    expect(ficouNoModeloSalvo(aposSalvar(digitado, NOVO.id), NOVO.id)).toBe(true)
  })

  it('⭐ salvar um modelo EXISTENTE também fica nele', () => {
    const editando: EstadoEditor = { modeloId: PADRAO.id, nome: 'Padrão', blocos: [{ id: 'a2' }], padrao: true }
    const depois = aposSalvar(editando, PADRAO.id)
    expect(depois.modeloId).toBe(PADRAO.id)
    expect(depois.blocos).toEqual([{ id: 'a2' }]) // o que ele acabou de editar, não o do servidor
  })

  it('⭐ ao ABRIR a tela, aí sim o servidor manda (é o único momento)', () => {
    expect(aoAbrir([NOVO, PADRAO])!.modeloId).toBe(PADRAO.id) // o padrão, mesmo fora de ordem
    expect(aoAbrir([NOVO])!.modeloId).toBe(NOVO.id) // sem padrão, o primeiro
    expect(aoAbrir([])).toBeNull() // empresa sem modelo nenhum
  })
})
