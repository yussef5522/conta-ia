/**
 * ⭐⭐ SEMEAR O RETALHO — **SÓ na «metade de bolinha massa de pizza»** (09/10/2026).
 *
 * **Ordem do dono:** *"aceitaRetalho ligado SÓ em metade de bolinha massa de pizza + peso da
 * metade crua semeado 200 g (bolinha inteira 400 g — declaração do dono; editável com rastro)."*
 *
 * ⛔⛔ **PREVIEW POR DEFAULT.** Sem `--aplicar` ele não grava nada — e **ABORTA se o nome não
 * casar EXATAMENTE UMA ficha**: ligar o interruptor na receita errada afrouxaria o fiscal dela
 * em silêncio, que é o pior desfecho possível deste sprint.
 *
 * ⚠️ **Resolver por NOME aqui é a única saída, e por isso a trava é a CONTAGEM.** A REGRA 8 da
 * casa proíbe `findFirst` por nome justamente porque nome é ambíguo; aqui o alvo é uma receita
 * que só o dono sabe nomear, então o script **lista o que achou** e exige unicidade.
 *
 * ⭐ IDEMPOTENTE: o `@@unique(companyId, fichaId)` faz a 2ª rodada ser um UPDATE do mesmo valor.
 */
import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { PESO_DA_METADE_G } from '@/lib/stock/producao/retalho'

const EMPRESA = process.env.EMPRESA_ID ?? 'cmq17yapb00gnrndlh33sctbo'
const APLICAR = process.argv.includes('--aplicar')
/** ⚠️ o nome que o dono usa — conferido contra a Posição/produção antes de rodar */
const NOME = process.env.RETALHO_NOME ?? 'metade de bolinha massa de pizza'

async function main() {
  await exigirEmpresaNesteBanco(prisma, EMPRESA)

  const itens = await prisma.stockItem.findMany({
    where: { companyId: EMPRESA, nome: { contains: NOME } },
    select: { id: true, nome: true, unidadeControle: true },
  })
  console.log(`\nitens que casam «${NOME}»: ${itens.length}`)
  for (const i of itens) console.log(`  · ${i.nome} [${i.unidadeControle}] ${i.id}`)
  if (itens.length !== 1) {
    console.log('\n⛔ ABORTA — o nome tem que casar EXATAMENTE UM item. Ligar o retalho na receita errada afrouxa o fiscal dela.')
    process.exit(1)
  }
  const item = itens[0]

  const fichas = await prisma.stockFicha.findMany({
    where: { companyId: EMPRESA, itemProduzidoId: item.id },
    select: { id: true, ativo: true, versaoAtual: true },
  })
  console.log(`\nfichas que produzem este item: ${fichas.length}`)
  for (const f of fichas) console.log(`  · ${f.id} · v${f.versaoAtual} · ${f.ativo ? 'ATIVA' : 'inativa'}`)
  const ativas = fichas.filter((f) => f.ativo)
  if (ativas.length !== 1) {
    console.log('\n⛔ ABORTA — tem que haver EXATAMENTE UMA ficha ATIVA produzindo este item.')
    process.exit(1)
  }
  const ficha = ativas[0]

  const atual = await prisma.stockFichaRetalho.findFirst({
    where: { companyId: EMPRESA, fichaId: ficha.id },
    select: { aceitaRetalho: true, pesoUnidadeG: true, definidoEm: true },
  })
  console.log(`\nestado hoje: ${atual ? `aceita=${atual.aceitaRetalho} · peso=${atual.pesoUnidadeG} g (desde ${atual.definidoEm.toISOString().slice(0, 16)})` : 'NENHUMA config (o retalho não existe pra esta ficha)'}`)
  console.log(`vai gravar:  aceita=true · peso=${PESO_DA_METADE_G} g  (a METADE; a bolinha inteira tem 400)`)

  /** ⛔ e as OUTRAS: a prova de que nada mais muda */
  const outras = await prisma.stockFicha.count({ where: { companyId: EMPRESA, ativo: true } })
  const comRetalho = await prisma.stockFichaRetalho.count({ where: { companyId: EMPRESA, aceitaRetalho: true } })
  console.log(`\nfichas ATIVAS na empresa: ${outras} · com retalho ligado HOJE: ${comRetalho}`)

  if (!APLICAR) {
    console.log('\n⚠️ PREVIEW — nada gravado. Rode com --aplicar pra gravar.')
    await prisma.$disconnect()
    return
  }

  const dono = await prisma.userCompanyRole.findFirst({
    where: { companyId: EMPRESA, role: { name: 'OWNER' } },
    select: { userId: true },
  })
  /** ⛔ sem autor eu não gravo: o peso é DECLARAÇÃO do dono, e declaração sem autor é chute */
  if (!dono) { console.log('\n⛔ ABORTA — não achei o OWNER desta empresa pra assinar a declaração.'); process.exit(1) }

  await prisma.stockFichaRetalho.upsert({
    where: { companyId_fichaId: { companyId: EMPRESA, fichaId: ficha.id } },
    create: {
      companyId: EMPRESA, fichaId: ficha.id,
      aceitaRetalho: true, pesoUnidadeG: PESO_DA_METADE_G, definidoPorId: dono.userId,
    },
    update: { aceitaRetalho: true, pesoUnidadeG: PESO_DA_METADE_G, definidoPorId: dono.userId },
  })
  const depois = await prisma.stockFichaRetalho.findFirstOrThrow({
    where: { companyId: EMPRESA, fichaId: ficha.id },
  })
  console.log(`\n⭐ GRAVADO · ficha ${ficha.id} · aceita=${depois.aceitaRetalho} · peso=${depois.pesoUnidadeG} g · por ${depois.definidoPorId}`)
  console.log(`⛔ fichas com retalho ligado agora: ${await prisma.stockFichaRetalho.count({ where: { companyId: EMPRESA, aceitaRetalho: true } })} (de ${outras} ativas)`)
  await prisma.$disconnect()
}

main().catch((e) => { console.error('[semear] erro:', e instanceof Error ? e.message : e); process.exit(1) })
