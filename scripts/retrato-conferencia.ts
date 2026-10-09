/**
 * ⭐⭐⭐ RETRATO ANTES DO DESENHO — QUEM PODE CARIMBAR? (09/10/2026, item 0 do dono)
 *
 * **A ordem:** *"Como papéis e PINs vivem hoje (o tablet usa PIN de colaborador nas etapas;
 * gerente é papel de usuário?) — a regra precisa de identidade forte: conferir exige PIN/login
 * de quem tem papel de gerência. Retrato no relatório; o desenho se curva ao que existe."*
 *
 * ⚠️ READ-ONLY. Nenhuma linha é escrita.
 */
import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { fichasParaConverter } from '@/lib/stock/producao/fichas-para-converter'
import { fiscalDeOrdens } from '@/lib/stock/producao/fiscal-dos-lotes'

const CO = process.env.EMPRESA_ID ?? 'cmq17yapb00gnrndlh33sctbo'
const hhmm = (d: Date) =>
  d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })

async function main() {
  const nome = await exigirEmpresaNesteBanco(prisma, CO)
  console.log(`[retrato] ${nome.trim()}\n`)

  /* ═══ 1. QUEM TEM PAPEL DE GERÊNCIA (identidade FORTE = sessão + RBAC) ═══ */
  console.log('═══ 1. PAPÉIS DE USUÁRIO nesta empresa (o que o RBAC sabe)')
  const papeis = await prisma.userCompanyRole.findMany({
    where: { companyId: CO },
    select: {
      userId: true,
      user: { select: { name: true, email: true } },
      role: { select: { name: true, permissions: { select: { permission: { select: { key: true } } } } } },
    },
  })
  for (const p of papeis) {
    const chaves = p.role.permissions.map((x) => x.permission.key)
    const estoque = chaves.filter((k) => k.startsWith('stock.'))
    const manage = chaves.includes('stock.manage') || chaves.includes('stock.*') || chaves.includes('*')
    console.log(
      `  ${manage ? '⭐ GERÊNCIA' : '          '} ${p.user?.name ?? p.userId} <${p.user?.email ?? '?'}>` +
        ` · papel ${p.role.name} · ${chaves.length} chaves · estoque: ${estoque.join(', ') || '(nenhuma)'}`,
    )
  }
  const comManage = papeis.filter((p) => {
    const k = p.role.permissions.map((x) => x.permission.key)
    return k.includes('stock.manage') || k.includes('stock.*') || k.includes('*')
  })
  console.log(`  ⭐ pessoas que podem CARIMBAR hoje (stock.manage): ${comManage.length}`)

  /* ═══ 2. OS PINs — de COLABORADOR, e colaborador não tem papel ═══ */
  console.log('\n═══ 2. OS PINs (o que o tablet usa nas etapas)')
  const colabs = await prisma.stockColaborador.findMany({
    where: { companyId: CO },
    select: { id: true, nome: true, ativo: true },
    orderBy: { nome: 'asc' },
  })
  const pins = await prisma.stockColaboradorPin.findMany({
    where: { companyId: CO, revogadoEm: null },
    select: { colaboradorId: true },
  })
  const temPin = new Set(pins.map((p) => p.colaboradorId))
  console.log(`  colaboradores: ${colabs.length} (ativos ${colabs.filter((c) => c.ativo).length}) · com PIN ativo: ${temPin.size}`)
  for (const c of colabs.filter((c) => c.ativo)) {
    console.log(`     ${temPin.has(c.id) ? '🔑' : '  '} ${c.nome}`)
  }

  /**
   * ⛔⛔ A PERGUNTA QUE DECIDE O DESENHO: existe vínculo colaborador ↔ usuário?
   * O schema de `stock_colaborador` tem `nome` e `ativo` — **mais nada**. Então a única
   * aproximação possível é o NOME, e nome não é identidade.
   */
  console.log('\n═══ 3. ⛔ EXISTE VÍNCULO colaborador ↔ usuário?')
  const usuarios = papeis.map((p) => ({ nome: p.user?.name ?? '', id: p.userId }))
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase()
  const casam = colabs.filter((c) => usuarios.some((u) => norm(u.nome) === norm(c.nome)))
  console.log(`  campo de vínculo no modelo: NENHUM (stock_colaborador = nome + ativo + criadoEm)`)
  console.log(`  colaboradores cujo NOME casa com um usuário: ${casam.length} de ${colabs.length}`)
  for (const c of casam) console.log(`     «${c.nome}»`)
  console.log(`  ⚠️ nome NÃO é identidade — dois homônimos ou um apelido quebram o casamento`)

  /* ═══ 4. AS CONCLUSÕES — quem declara hoje ═══ */
  console.log('\n═══ 4. AS CONCLUSÕES (quem declara, e com que identidade)')
  const concs = await prisma.stockProducaoConclusao.findMany({
    where: { companyId: CO },
    select: { id: true, ordemId: true, qtdGerada: true, colaboradorId: true, criadoPorId: true, criadoEm: true },
    orderBy: { criadoEm: 'desc' },
  })
  const comColab = concs.filter((c) => c.colaboradorId).length
  const comUser = concs.filter((c) => c.criadoPorId).length
  console.log(`  total: ${concs.length} · com colaborador (PIN do tablet): ${comColab} · com usuário (sessão): ${comUser}`)
  console.log(`  com AMBOS: ${concs.filter((c) => c.colaboradorId && c.criadoPorId).length} · com NENHUM: ${concs.filter((c) => !c.colaboradorId && !c.criadoPorId).length}`)
  console.log('  as 5 últimas:')
  const nomeColab = new Map(colabs.map((c) => [c.id, c.nome]))
  for (const c of concs.slice(0, 5)) {
    console.log(
      `     ${hhmm(c.criadoEm)} · ${c.qtdGerada} un · colab ${c.colaboradorId ? nomeColab.get(c.colaboradorId) ?? '?' : '—'}` +
        ` · user ${c.criadoPorId?.slice(-6) ?? '—'}`,
    )
  }

  /* ═══ 5. OS CASOS DO ITEM 3 — as podres e a 320% ═══ */
  console.log('\n═══ 5. OS CASOS QUE O DONO QUER CORRIGIR (item 3)')
  const estornadas = new Set(
    (await prisma.stockConclusaoEstornada.findMany({ where: { companyId: CO }, select: { conclusaoId: true } })).map(
      (r) => r.conclusaoId,
    ),
  )
  const podres = concs.filter((c) => c.qtdGerada > 10000)
  console.log(`  conclusões com qtdGerada > 10.000: ${podres.length}`)
  for (const c of podres) {
    const ordem = await prisma.stockProductionOrder.findUnique({
      where: { id: c.ordemId },
      select: { itemProduzidoId: true, dataProducao: true },
    })
    const item = ordem ? await prisma.stockItem.findUnique({ where: { id: ordem.itemProduzidoId }, select: { nome: true, unidadeControle: true } }) : null
    console.log(
      `     ${c.qtdGerada} ${item?.unidadeControle ?? ''} de «${item?.nome ?? '?'}» · produção ${ordem?.dataProducao.toISOString().slice(0, 10)}` +
        ` · ${estornadas.has(c.id) ? '✓ JÁ ESTORNADA' : '⛔ VIVA'} · id ${c.id}`,
    )
  }
  /** a 320% da NATHALIA — acho pela eficiência, não pelo nome */
  const ordensConc = await prisma.stockProductionOrder.findMany({
    where: { companyId: CO, estado: 'CONCLUIDA' },
    select: { id: true },
  })
  const fiscais = await fiscalDeOrdens(CO, ordensConc.map((o) => o.id), prisma)
  const impossiveis = [...fiscais.values()].filter((f) => f.impossivel)
  console.log(`  ordens que o FISCAL chama de impossível: ${impossiveis.length} de ${ordensConc.length} concluídas`)

  /* ═══ 6. OS PONTINHOS (item 4a) — quantos têm causa própria ═══ */
  console.log('\n═══ 6. OS PONTINHOS DO FISCAL NA LISTA (item 4a)')
  const fila = await fichasParaConverter(CO, prisma)
  const loteTorto = new Set(fila.pendentes.map((f) => f.fichaId))
  const comCausaPropria = impossiveis.filter((f) => !loteTorto.has(f.fichaId))
  const suprimiveis = impossiveis.filter((f) => loteTorto.has(f.fichaId))
  console.log(`  fichas na fila de conversão (lote na unidade errada): ${loteTorto.size}`)
  console.log(`  ⛔ pontinhos HOJE: ${impossiveis.length}`)
  console.log(`  ⭐ com a supressão do sininho: ${comCausaPropria.length} (saem ${suprimiveis.length} por já terem aviso na fila de conversão)`)
  for (const f of comCausaPropria.slice(0, 8)) {
    console.log(`     «${f.produto}» declarado ${f.declarado} ${f.unidade} · material dava ~${f.permitido} · ficha ${f.fichaId.slice(-6)}`)
  }

  /* ═══ 7. O SININHO — a fronteira de papel que já existe ═══ */
  console.log('\n═══ 7. A FRONTEIRA DO SININHO (o modelo que o dono mandou copiar)')
  const avisos = await prisma.aviso.groupBy({
    where: { companyId: CO, resolvidoEm: null },
    by: ['setor'],
    _count: true,
  })
  console.log(`  avisos abertos por setor: ${avisos.map((a) => `${a.setor}=${a._count}`).join(' · ')}`)
}

main()
  .catch((e) => {
    console.error('⛔', e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
