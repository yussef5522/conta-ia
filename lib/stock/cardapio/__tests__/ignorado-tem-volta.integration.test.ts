/**
 * ⭐⭐⭐ CLIQUE SEM QUERER NUNCA MAIS É SUMIÇO SEM VOLTA (23/09/2026).
 *
 * **O que o dono viveu:** *"cliquei sem querer num botão e a CALABRESA BLACK sumiu da minha
 * frente"*. No hub, `IGNORAR` caía num `continue` — a linha **desaparecia do Cardápio**,
 * sem seção, sem contador e sem caminho de volta.
 *
 * ⛔ **A régua dele:** *"o default é APARECER: sumir é perder trabalho"*.
 *
 * ⚠️ REGRA 3: roda o `hubCardapio` REAL contra o banco. Grep no arquivo não distingue
 * "a linha existe no tipo" de "a linha chega na tela".
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { hubCardapio, ehProntoNoCardapio } from '../hub'
import { upsertVendaMap, removerVendaMap } from '@/lib/stock/vendas/venda-map'
import { parseChave } from '../detalhe'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const CNPJ = '50607080000932' // ⚠️ exclusivo deste arquivo
let companyId = ''
let itemBebidaId = ''

beforeAll(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const co = await prisma.company.create({ data: { name: 'ignorado-volta', cnpj: CNPJ }, select: { id: true } })
  companyId = co.id
  const b = await prisma.stockItem.create({
    data: { companyId, nome: 'COCA LATA', unidadeControle: 'UN', categoria: 'REVENDA', criadoVia: 'MANUAL' },
    select: { id: true },
  })
  itemBebidaId = b.id
  // duas vendas reais: uma vira revenda, a outra o dono vai ignorar
  await prisma.stockVendaLinha.createMany({
    data: [
      { companyId, data: new Date('2026-09-20T15:00:00.000Z'), nomeSuitable: 'COCA LATA', quantidade: 10, valorTotal: 80, importId: 'v1' },
      { companyId, data: new Date('2026-09-20T15:00:00.000Z'), nomeSuitable: 'MILKSHAKE PACOCA', quantidade: 7, valorTotal: 140, importId: 'v1' },
    ],
  })
})

afterAll(async () => {
  await prisma.stockVendaLinha.deleteMany({ where: { companyId } })
  await prisma.stockVendaProdutoMap.deleteMany({ where: { companyId } })
  await prisma.stockItem.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('⛔⛔ o produto ignorado NÃO some do Cardápio', () => {
  it('⭐ antes de ignorar ele é uma linha normal, sem destino', async () => {
    const h = await hubCardapio(companyId, {}, prisma)
    expect(h.linhas.map((l) => l.nome)).toContain('MILKSHAKE PACOCA')
    expect(h.ignorados).toHaveLength(0)
    expect(h.totais.ignorados).toBe(0)
  })

  it('⛔⛔ depois de ignorar ele SAI da fila mas CONTINUA existindo', async () => {
    await upsertVendaMap(companyId, 'MILKSHAKE PACOCA', { tipo: 'IGNORAR' }, undefined, prisma)
    const h = await hubCardapio(companyId, {}, prisma)

    // ⛔ o defeito de 23/09: ele sumia daqui E de todo lugar
    expect(h.ignorados.map((l) => l.nome), 'o ignorado sumiu — é o bug do dono').toContain('MILKSHAKE PACOCA')
    expect(h.totais.ignorados).toBe(1)
    // ⭐ e a chave carrega o NOME cru, que é o que o [voltar] precisa
    expect(h.ignorados[0].chave).toBe('ignorado:MILKSHAKE PACOCA')
    expect(h.ignorados[0].status).toBe('IGNORADO')
    // ⚠️ as vendas dele continuam contadas na linha — some da FILA, não da história
    expect(h.ignorados[0].vendasQtd).toBe(7)
  })

  it('⛔ e NÃO polui a fila, o CSV nem contador nenhum', async () => {
    const h = await hubCardapio(companyId, {}, prisma)
    expect(h.linhas.map((l) => l.nome), 'decisão tomada disputando espaço com trabalho pendente')
      .not.toContain('MILKSHAKE PACOCA')
    // ⚠️ o COCA LATA segue sem destino de propósito (ninguém o mapeou) — o que o guard
    // afirma é que o IGNORADO não voltou pra fila, não que a fila esteja vazia.
    expect(h.linhas.filter((l) => l.status === 'SEM_DESTINO').map((l) => l.nome),
      'o ignorado voltou a contar como pendência').toEqual(['COCA LATA'])
    // ⛔ e nunca entra em "prontos": ele não baixa estoque nenhum
    expect(h.ignorados.some(ehProntoNoCardapio)).toBe(false)
  })

  it('⭐ o [voltar] devolve o nome pra fila — e NÃO escolhe destino por ele', async () => {
    await removerVendaMap(companyId, 'MILKSHAKE PACOCA', prisma)
    const h = await hubCardapio(companyId, {}, prisma)
    expect(h.ignorados).toHaveLength(0)
    const volta = h.linhas.find((l) => l.nome === 'MILKSHAKE PACOCA')
    expect(volta, 'o voltar perdeu a linha').toBeTruthy()
    // ⛔ volta como PERGUNTA, não como resposta: dizer pra onde ele vai é do dono
    expect(volta!.status).toBe('SEM_DESTINO')
    expect(volta!.destinoTipo).toBeNull()
  })

  it('⭐ a chave `ignorado:` é reconhecida — senão o [voltar] bate em 422', () => {
    expect(parseChave('ignorado:MILKSHAKE PACOCA')).toEqual({ tipo: 'ignorado', valor: 'MILKSHAKE PACOCA' })
    // ⚠️ nome com ':' dentro continua inteiro (o split é no PRIMEIRO)
    expect(parseChave('ignorado:COMBO: 2 LATAS')).toEqual({ tipo: 'ignorado', valor: 'COMBO: 2 LATAS' })
  })

  it('⛔ ignorar é por NOME, nunca por destino — dois ignorados não se fundem', async () => {
    await upsertVendaMap(companyId, 'MILKSHAKE PACOCA', { tipo: 'IGNORAR' }, undefined, prisma)
    await upsertVendaMap(companyId, 'COCA LATA', { tipo: 'IGNORAR' }, undefined, prisma)
    const h = await hubCardapio(companyId, {}, prisma)
    expect(h.ignorados).toHaveLength(2)
    expect(new Set(h.ignorados.map((l) => l.chave)).size).toBe(2)
    await removerVendaMap(companyId, 'MILKSHAKE PACOCA', prisma)
    await removerVendaMap(companyId, 'COCA LATA', prisma)
  })
})

describe('⛔ A TELA — seção colapsada no fim, com o [voltar] por item', () => {
  const tela = readFileSync(
    join(process.cwd(), 'app/(dashboard)/empresas/[id]/estoque/cardapio/page.tsx'), 'utf-8',
  )

  it('⭐ a seção existe, nasce COLAPSADA e some quando não há ignorado', () => {
    /**
     * ⚠️⚠️ A 1ª versão fazia `toContain('IgnoradosDoCardapio')` e passou VERDE com a
     * seção arrancada do JSX — a **definição** da função ainda tinha o nome. *"Menção,
     * não uso"* pela 7ª vez. O que morde é a TAG: quem desenha, não quem existe.
     */
    expect(tela, 'a seção saiu do JSX').toContain('<IgnoradosDoCardapio')
    /**
     * ⚠️ E a fatia tem que TERMINAR no fim do componente: indo até o fim do arquivo ela
     * alcançava o `useState(false)` do componente VIZINHO, e o guard do colapsado
     * aprovava a seção nascendo aberta.
     */
    const i = tela.indexOf('function IgnoradosDoCardapio')
    const fim = tela.indexOf('\nfunction ', i + 1)
    const bloco = tela.slice(i, fim > 0 ? fim : undefined)
    // ⛔ colapsada: decisão tomada não disputa espaço com trabalho pendente
    expect(bloco, 'a seção nasce aberta, roubando a dobra do trabalho pendente')
      .toContain('const [aberto, setAberto] = useState(false)')
    // ⛔ e móvel fixo zerado treina o dono a não olhar
    expect(bloco).toContain('if (!linhas.length) return null')
    expect(bloco).toContain("body: JSON.stringify({ voltar: true })")
  })

  it('⛔⛔ o gesto de IGNORAR pede confirmação — sumiço de 1 toque é como a linha some', () => {
    // ⭐ o clique abre a pergunta; quem chama o `IGNORAR` é o "sim"
    expect(tela).toContain('setConfirmando(l.titulo)')
    expect(tela).toMatch(/tirar «\{l\.titulo\}» do cardápio\?/)
    expect(tela).toMatch(/setConfirmando\(null\); await todosOsApelidos\(l, 'IGNORAR'\)/)
    // ⛔ e o botão NÃO chama mais a ação direto
    expect(tela, 'o ignorar voltou a ser 1 toque sem pergunta')
      .not.toMatch(/onClick=\{\(\) => todosOsApelidos\(l, 'IGNORAR'\)\}/)
    /**
     * ⚠️⚠️ `confirm()` nativo não — ele já falhou em silêncio no Safari dentro de fluxo
     * async (22/08, o reprocessar que não reprocessava).
     *
     * ⛔ E a 1ª versão deste guard veio VERMELHA mordendo **o próprio comentário** que
     * documenta essa proibição, logo acima do estado. *"Menção, não uso"* pela 6ª vez —
     * o arquivo que documenta a regra não pode ser o que a viola. Lê sem comentário.
     */
    const semComentario = tela.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(semComentario).not.toMatch(/\bwindow\.confirm\(|[^.\w]confirm\(/)
  })
})
