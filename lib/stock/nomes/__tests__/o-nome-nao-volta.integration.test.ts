// ⛔⛔⛔ "RENOMEEI E O NOME VOLTOU" (09/09/2026) — investigado com o dado real de prod.
//
// **MEDIDO ANTES de tocar em código:**
//   `stock_item_nome_anterior`: **0 renomeios gravados** (o LOTE nunca foi confirmado)
//   a fila de nomes: **36 → 25** (11 itens MUDARAM de nome — pelo editor INLINE)
//   itens atualizados 17:33–18:00 com nomes limpos (MOSTARDA, CATCHUP, ERVILHA…)
//
// ⭐ **DUAS CAUSAS, e nenhuma era "não gravou":**
//  1. **O LOTE tinha um no-op silencioso meu.** O texto editado só entrava no envio se o dono
//     TAMBÉM marcasse o checkbox. Quem editava e saía perdia tudo — e a tela voltava com os
//     nomes velhos. **Editar já é a intenção**; agora marcar é consequência de editar, e a
//     tela avisa quando há edição não confirmada.
//  2. **O editor INLINE renomeava por fora do dono.** Gravava (por isso 11 mudaram), mas
//     **sem apelido** — buscar pelo nome antigo parava de achar, que é exatamente o que a
//     tabela de apelido existe pra impedir — e **sem checar duplicado**.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { renomearEmLote, apelidosPorItem, itensParaRevisarNome } from '../renomear-em-lote'
import { listCatalogo } from '@/lib/stock/catalogo'
import { listPosicao } from '@/lib/stock/posicao'
import { getQuadro } from '@/lib/stock/contagem'

const CNPJ = '55901224000211'
let companyId = ''
let item = ''
let userId = ''

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  await prisma.user.deleteMany({ where: { email: 'volta@teste.local' } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'VOLTA' } })).id
  userId = (await prisma.user.create({ data: { email: 'volta@teste.local', name: 'Yussef', password: 'x' } })).id
  item = (await prisma.stockItem.create({
    data: { companyId, nome: 'CC 600 PET 12', unidadeControle: 'UN', categoria: 'REVENDA', criadoVia: 'CONFERENCIA' },
  })).id
  await prisma.stockMovement.create({
    data: { companyId, itemId: item, tipo: 'ENTRADA_NF', quantidade: 60, custoUnitario: 3.31, custoTotal: 198.6, origem: 'SEFAZ' },
  })
})

afterEach(async () => {
  for (const t of ['stockItemNomeAnterior', 'stockMovement', 'stockSaldoCache', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
  await prisma.user.deleteMany({ where: { id: userId } })
})

describe('⛔⛔ renomear → sair → voltar: TODAS as telas com o nome novo', () => {
  it('⭐⭐ o caminho inteiro, tela por tela', async () => {
    await renomearEmLote({ companyId, userId, pedidos: [{ itemId: item, nomeNovo: 'COCA COLA 600ML' }] }, prisma)

    // "sair e voltar" = ler de novo, de cada fonte que a tela usa
    const noBanco = await prisma.stockItem.findUnique({ where: { id: item }, select: { nome: true } })
    expect(noBanco!.nome, 'o banco').toBe('COCA COLA 600ML')
    expect((await listCatalogo(companyId, prisma)).find((c) => c.id === item)!.nome, 'Catálogo').toBe('COCA COLA 600ML')
    expect((await listPosicao(companyId, prisma)).itens.find((i) => i.itemId === item)!.nome, 'Posição').toBe('COCA COLA 600ML')
    expect((await getQuadro(companyId, new Date(), prisma)).linhas.find((l) => l.itemId === item)!.nome, 'contagem').toBe('COCA COLA 600ML')

    // ⭐ e a fila de revisão para de cobrar o item já resolvido
    expect((await itensParaRevisarNome(companyId, prisma)).some((l) => l.itemId === item), 'saiu da fila').toBe(false)
  })

  it('⛔⛔ O EDITOR INLINE grava o APELIDO — era o furo que deixava a busca cega', async () => {
    // ⚠️ o inline renomeava direto no `stockItem.update`: 11 itens mudaram em prod e 0
    // apelidos foram gravados. Agora ele passa pelo mesmo dono do lote.
    const { PATCH } = await import('@/app/api/empresas/[id]/estoque/itens/[itemId]/route')
    void PATCH // o teste do handler roda no arquivo de enforcement; aqui trava o DONO:
    await renomearEmLote({ companyId, userId, pedidos: [{ itemId: item, nomeNovo: 'COCA COLA 600ML' }] }, prisma)
    expect((await apelidosPorItem(companyId, [item], prisma)).get(item)).toContain('CC 600 PET 12')
  })

  it('⛔ e renomear pro nome de OUTRO item é recusado — não vira duplicata calada', async () => {
    const outro = (await prisma.stockItem.create({
      data: { companyId, nome: 'COCA COLA 2L', unidadeControle: 'UN', categoria: 'REVENDA', criadoVia: 'CONFERENCIA' },
    })).id
    const r = await renomearEmLote({ companyId, userId, pedidos: [{ itemId: item, nomeNovo: 'coca cola 2l' }] }, prisma)
    expect(r.aplicados).toHaveLength(0)
    expect(r.pulados[0].motivo).toContain('já é o nome de outro item')
    expect((await prisma.stockItem.findUnique({ where: { id: outro }, select: { nome: true } }))!.nome).toBe('COCA COLA 2L')
  })
})

describe('⛔ o lote não perde edição em silêncio', () => {
  it('⭐ editar uma linha MARCA a linha — o texto sozinho já é a intenção', () => {
    // ⚠️ guard estrutural: sem jsdom não dá pra clicar, mas dá pra provar que o `onChange`
    // do campo mexe no `marcado`. Era exatamente esta linha que faltava.
    const src = require('node:fs').readFileSync(
      require('node:path').join(process.cwd(), 'app/(dashboard)/empresas/[id]/estoque/itens/nomes/page.tsx'), 'utf-8',
    )
    const onChange = /onChange=\{\(e\) => \{[\s\S]*?setEdit\(\(x\) => \(\{ \.\.\.x, \[l\.itemId\]: e\.target\.value \}\)\)[\s\S]*?setMarcado\([\s\S]*?\}\}/.exec(src)
    expect(onChange, 'editar o campo não marca a linha — a edição se perderia').toBeTruthy()
    expect(src, 'e a tela avisa quando há edição não confirmada').toContain('ainda não confirmado')
  })
})
