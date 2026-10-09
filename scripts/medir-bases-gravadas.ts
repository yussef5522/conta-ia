/**
 * ⭐ PASSO 1 DO DONO — MEDIR O QUE JÁ ENTROU, ANTES DE QUALQUER ESCRITA.
 *
 * ⛔ Ele pediu isto porque a sessão estourou NO MEIO da gravação das 9 CLARAS, e o eco
 * do script (`9 fichas versionadas`) **não é prova**: eco é o que o processo DIZ, e o que
 * vale é o que o banco TEM. Regravar o que já entrou cria **versão dupla** — ruído
 * permanente no rastro de uma receita.
 *
 * ⚠️ READ-ONLY. Para cada linha CLARA do preview: a versão ATUAL da ficha, a hora em que
 * ela nasceu, e se a composição dela é a CANÔNICA do tamanho (massa + queijo + caixa).
 */
import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { previewNormalizacao } from '@/lib/margem/preview-normalizacao'
import { COMPOSICAO } from '@/lib/margem/bases-canonicas'

const EMPRESA = process.env.EMPRESA_ID ?? 'cmq17yapb00gnrndlh33sctbo'
const hhmm = (d: Date) =>
  d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'medium' })

async function main() {
  const nome = await exigirEmpresaNesteBanco(prisma, EMPRESA)
  console.log(`[medir] ${nome.trim()}\n`)

  const p = await previewNormalizacao(EMPRESA, {}, prisma)
  if (p.bloqueio) {
    console.log(`⛔ preview bloqueado: ${p.bloqueio}`)
    return
  }

  /** ⭐ as 9 CLARAS, na ordem do preview — a MESMA lista que o aplicador percorre */
  const claras = p.grupos.flatMap((g) =>
    g.linhas
      .filter((l) => !l.jaNormalizada && l.classificacao.confianca === 'CLARO')
      .map((l) => ({ ...l, tamanho: g.tamanho })),
  )
  const perguntam = p.grupos.flatMap((g) =>
    g.linhas.filter((l) => !l.jaNormalizada && l.classificacao.confianca !== 'CLARO'),
  )
  /** ⚠️ já normalizada = a régua diz que a composição JÁ é a canônica (pode ser deste gesto) */
  const jaOk = p.grupos.flatMap((g) => g.linhas.filter((l) => l.jaNormalizada).map((l) => ({ ...l, tamanho: g.tamanho })))

  console.log('═══ AS 9 CLARAS — gravada ✓ / pendente')
  const todas = [...claras, ...jaOk]
  let gravadas = 0
  for (const l of todas) {
    const ficha = await prisma.stockFicha.findUnique({
      where: { id: l.fichaId },
      select: { versaoAtual: true },
    })
    const v = await prisma.stockFichaVersao.findFirst({
      where: { fichaId: l.fichaId, versao: ficha!.versaoAtual },
      select: { id: true, versao: true, criadoEm: true, criadoPorId: true },
    })
    const comps = await prisma.stockFichaComponente.findMany({
      where: { versaoId: v!.id },
      select: { itemId: true, qtdPlanejada: true },
    })

    /** ⭐ a composição CANÔNICA do tamanho — é ela que decide "gravada", não a versão nem a hora */
    const t = l.classificacao.tamanho
    const alvo = t ? COMPOSICAO[t] : null
    const itens = p.itens
    let bate = false
    if (alvo && itens.massa && itens.queijo && t && itens.caixa[t]) {
      const porItem = new Map(comps.map((c) => [c.itemId, c.qtdPlanejada]))
      const mult = l.classificacao.multiplicador
      bate =
        comps.length === 3 &&
        porItem.get(itens.massa.id) === alvo.massa * mult &&
        porItem.get(itens.queijo.id) === alvo.queijo * mult &&
        porItem.get(itens.caixa[t]!.id) === alvo.caixa * mult
    }
    if (bate) gravadas++
    const quando = v!.criadoEm ? hhmm(v!.criadoEm) : 'sem data'
    console.log(
      `  ${bate ? '✓ GRAVADA ' : '⛔ PENDENTE'} «${l.nome}» [${l.tamanho ?? '?'}] v${v!.versao} · ${quando} · ${comps.length} componentes`,
    )
    if (!bate) console.log(`      o preview diz: ${l.classificacao.porque}`)
  }
  console.log(`\n  ⭐ ${gravadas} de ${todas.length} com a composição canônica`)

  console.log('\n═══ AS QUE PERGUNTAM — intactas por ordem do dono (ele deixou em branco)')
  for (const l of perguntam) {
    const ficha = await prisma.stockFicha.findUnique({ where: { id: l.fichaId }, select: { versaoAtual: true } })
    console.log(`  «${l.nome}» v${ficha!.versaoAtual} · ${l.classificacao.porque}`)
  }

  console.log('\n═══ CONTABILIDADE')
  console.log(`  versões de ficha: ${await prisma.stockFichaVersao.count()}`)
  console.log(`  bases apontadas:  ${await prisma.stockBaseDoTamanho.count({ where: { companyId: EMPRESA } })}`)
  console.log(`  doses a declarar: ${await prisma.stockDoseADeclarar.count({ where: { companyId: EMPRESA } })}`)
  console.log(`  movimentos:       ${await prisma.stockMovement.count({ where: { companyId: EMPRESA } })}`)
}

main()
  .catch((e) => {
    console.error('⛔', e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
