// ⛔⛔ AS TRÊS FICHAS ÓRFÃS (01/09/2026) — salvou, e o dado não apareceu.
//
// O dono montou a ficha do XIS COMPLETO e de duas PIZZAS pelo cardápio. **As três
// gravaram** — completas, com componentes e preço — e as três ficaram **sem vínculo com o
// nome do PDV**. O cardápio monta a linha por esse vínculo, então a tela voltava dizendo
// "sem ficha" e ele concluía que não tinha salvo. **A PIZZA saiu DUPLICADA no mesmo
// minuto** (23:22 e 23:22) — a assinatura de "não apareceu, tentei de novo".
//
// ⚠️ O REFETCH NÃO ERA O CULPADO, e essa distinção importa: diferente do editor de etiqueta
// (onde `carregar()` SOBRESCREVIA o formulário), aqui ele mostrava fielmente um estado que
// ficou incompleto na GRAVAÇÃO. O mensageiro estava certo.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarFicha, fichaAtivaComNome, FichaError } from '../fichas'

const CNPJ = '50505050000233'
let companyId: string
let insumoId: string

const base = (nome: string) => ({
  companyId, nomeProduzido: nome, unidadeProduzido: 'UN', tipoProduto: 'PRODUTO_FINAL' as const,
  loteBase: 1, unidadeLoteBase: 'UN', valorVenda: 23.37,
  componentes: [{ itemId: insumoId, qtdPlanejada: 1, unidade: 'UN', posicao: 0 }],
})

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'CARDAPIO' } })
  companyId = c.id
  const it = await prisma.stockItem.create({ data: { companyId, nome: 'PAO', unidadeControle: 'UN', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' } })
  insumoId = it.id
})
afterEach(async () => {
  for (const t of ['stockVendaProdutoMap', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('⭐⭐ criar ficha PELO CARDÁPIO vincula no mesmo gesto', () => {
  it('⭐⭐ a linha volta COM a ficha — o bug de 01/09 não acontece mais', async () => {
    const r = await criarFicha({ ...base('XIS COMPLETO'), mapearNomeSuitable: 'XIS COMPLETO' }, prisma)
    expect(r.vinculadoAoPdv).toBe(true)

    // ⭐ é ESTE vínculo que faz a linha do cardápio ter ficha
    const map = await prisma.stockVendaProdutoMap.findFirst({ where: { companyId, nomeSuitable: 'XIS COMPLETO' } })
    expect(map).not.toBeNull()
    expect(map!.fichaId).toBe(r.fichaId)
    expect(map!.alvoTipo).toBe('FICHA')
  })

  it('⛔⛔ SEM o nome do PDV, a ficha nasce ÓRFÃ — o estado exato das 3 de 01/09', async () => {
    const r = await criarFicha(base('PRODUTO SEM PDV'), prisma)
    expect(r.vinculadoAoPdv).toBe(false)
    expect(await prisma.stockVendaProdutoMap.count({ where: { companyId } })).toBe(0)
    // ⚠️ a ficha EXISTE e está completa — por isso o dono achava que não tinha salvo
    const f = await prisma.stockFicha.findUnique({ where: { id: r.fichaId } })
    expect(f).not.toBeNull()
    expect(f!.valorVenda).toBe(23.37)
  })

  it('⭐ ficha, item, versão, componentes e vínculo entram JUNTOS', async () => {
    // ⚠️ A ATOMICIDADE é por CONSTRUÇÃO: o upsert do vínculo roda DENTRO do mesmo
    // `db.$transaction` que cria ficha/item/versão/componentes. Aqui eu provo o lado
    // observável — que os cinco existem depois de UMA chamada.
    //
    // ⚠️ E NÃO tento forçar o rollback com um dado inválido: a 1ª versão deste teste usava
    // um nome de 3.000 caracteres esperando estourar o limite da coluna, e **o SQLite do dev
    // não tem limite em TEXT** — o teste passava verde afirmando uma coisa que não testou.
    // Prova de rollback real exigiria Postgres (mesmo caminho do `scripts/e2e-marcacoes-
    // atomicas.ts`, que roda contra o scratch justamente por isso).
    const r = await criarFicha({ ...base('ATOMICO'), mapearNomeSuitable: 'ATOMICO PDV' }, prisma)
    expect(await prisma.stockItem.count({ where: { companyId, nome: 'ATOMICO' } })).toBe(1)
    expect(await prisma.stockFicha.count({ where: { companyId, id: r.fichaId } })).toBe(1)
    const versao = await prisma.stockFichaVersao.findFirst({ where: { companyId, fichaId: r.fichaId } })
    expect(versao).not.toBeNull()
    expect(await prisma.stockFichaComponente.count({ where: { companyId, versaoId: versao!.id } })).toBe(1)
    expect(await prisma.stockVendaProdutoMap.count({ where: { companyId, nomeSuitable: 'ATOMICO PDV' } })).toBe(1)
  })
})

describe('⛔⛔ a duplicata da PIZZA não pode mais nascer', () => {
  it('⛔⛔ segunda ficha do MESMO produto é recusada, com mensagem que ensina', async () => {
    await criarFicha({ ...base('PIZZA PEQUENA 25CM'), mapearNomeSuitable: 'PIZZA PEQUENA 25CM' }, prisma)
    await expect(criarFicha(base('PIZZA PEQUENA 25CM'), prisma)).rejects.toThrow(FichaError)
    try {
      await criarFicha(base('PIZZA PEQUENA 25CM'), prisma)
    } catch (e) {
      expect((e as Error).message).toContain('Já existe uma ficha')
      expect((e as Error).message).toContain('Edite a ficha existente') // ⭐ diz o que FAZER
    }
    expect(await prisma.stockFicha.count({ where: { companyId } })).toBe(1)
  })

  it('⛔ e a recusa é por nome NORMALIZADO — caixa e acento não driblam', async () => {
    await criarFicha(base('PIZZA PEQUENA 25CM'), prisma)
    await expect(criarFicha(base('pizza pequena 25cm'), prisma)).rejects.toThrow(FichaError)
    await expect(criarFicha(base('Pizza Pequena 25cm'), prisma)).rejects.toThrow(FichaError)
    expect(await prisma.stockFicha.count({ where: { companyId } })).toBe(1)
  })

  it('⭐ mas produto DIFERENTE passa normal', async () => {
    await criarFicha(base('PIZZA PEQUENA 25CM'), prisma)
    const r = await criarFicha(base('PIZZA GRANDE 35CM'), prisma)
    expect(r.fichaId).toBeTruthy()
    expect(await prisma.stockFicha.count({ where: { companyId } })).toBe(2)
  })

  it('⚠️ ficha INATIVA não bloqueia — arquivar e recriar continua possível', async () => {
    const r = await criarFicha(base('PIZZA PEQUENA 25CM'), prisma)
    await prisma.stockFicha.update({ where: { id: r.fichaId }, data: { ativo: false } })
    expect(await fichaAtivaComNome(companyId, 'PIZZA PEQUENA 25CM', prisma)).toBeNull()
    await expect(criarFicha(base('PIZZA PEQUENA 25CM'), prisma)).resolves.toBeTruthy()
  })
})
