/**
 * ⛔⛔⛔ REGRA 13 — A PROVA DOS 7 CHECKs DE `stock_grupo_vigiado` CONTRA POSTGRES.
 *
 * **Por que isto NÃO pode ser um teste da suíte:** CHECK **não existe no schema Prisma** (mora
 * no SQL da migration), e o `db push` do dev **cria a tabela a partir do schema** → no SQLite o
 * INSERT torto **PASSA**, e isso não é o CHECK falhando: é ele **não existir ali**. A prova é do
 * BANCO, então ela roda contra Postgres.
 *
 * ⚠️ **E ela usa `$executeRawUnsafe` DE PROPÓSITO:** passar pela porta (`criarGrupo`) provaria a
 * porta, não o banco. A camada 1 existe justamente pro caminho que **não** passa pela porta —
 * script, lib nova, lançamento em lote —, e foi por um caminho desses que o `IGNORAR` do mapa de
 * produtos ficou **9 dias morto em prod** (23/09).
 *
 * ⭐⭐ **AQUI O FURO DA REGRA 13 É REAL, NÃO TEÓRICO** — ao contrário da prova da estrela
 * (12/10), em que as colunas comparadas eram `NOT NULL`: `criadoPorId`, `renomeadoPorId` e
 * `agendaDefinidaPorId` são **NULLABLE comparados por CONTEÚDO**, a forma EXATA do
 * `chk_aviso_acao_completa` (04/10), em que `length(trim(NULL)) > 0` avalia pra **NULL** e
 * ***CHECK com expressão NULL PASSA***. O script **MEDE** isso no próprio banco em vez de eu
 * afirmar — inclusive `is_nullable`, porque *"é NOT NULL"* é o tipo de premissa que envelhece
 * quando alguém mexe no schema.
 *
 * ⚠️ E mede também o **`btrim`**: ele apara **só o ESPAÇO** por default (medido em 14/10), então
 * TAB e NEWLINE passariam por um `trim()` simples. ***Caractere que não está na lista é
 * caractere que passa.***
 *
 * ⛔ **ESCRITA LÍQUIDA ZERO** — a contagem é conferida antes e depois.
 */
import { prisma } from '@/lib/db'

type Caso = { nome: string; sql: string; constraint: string }

/** ⚠️ MEDIDO livre contra os CNPJs de teste do repo, nunca chutado (o guard anti-colisão de 24/09) */
const CNPJ = '96969696000196'

/** ⚠️ o id é fixo por caso: colisão de PK daria "recusou" pelo motivo ERRADO */
function linha(id: string, campos: Record<string, string>): string {
  const base: Record<string, string> = {
    id: `'${id}'`,
    companyId: 'COMPANY',
    slug: `'TESTE'`,
    nome: `'teste'`,
    emoji: `'⭐'`,
    ordem: '0',
    agendaTodoDia: 'false',
    agendaDias: `''`,
    criadoPorId: 'NULL',
    renomeadoPorId: 'NULL',
    agendaDefinidaPorId: 'NULL',
    ...campos,
  }
  const cols = Object.keys(base).map((c) => `"${c}"`).join(', ')
  const vals = Object.values(base).join(', ')
  return `INSERT INTO "stock_grupo_vigiado" (${cols}, "criadoEm") VALUES (${vals}, CURRENT_TIMESTAMP)`
}

async function main() {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const empresa = await prisma.company.create({ data: { cnpj: CNPJ, name: 'PROVA CHECK GRUPO' } })
  const C = `'${empresa.id}'`
  const sub = (s: string) => s.replace(/COMPANY/g, C)

  const antes = await prisma.stockGrupoVigiado.count()

  // ═══ OS TORTOS: cada um tem que ser recusado pela constraint CERTA ═══
  const TORTOS: Caso[] = [
    { nome: 'companyId VAZIO', sql: linha('t1', { companyId: `''` }), constraint: 'chk_grupo_vigiado_forma' },
    { nome: 'companyId só ESPAÇO', sql: linha('t2', { companyId: `'   '` }), constraint: 'chk_grupo_vigiado_forma' },
    { nome: 'companyId só TAB', sql: linha('t3', { companyId: `E'\\t'` }), constraint: 'chk_grupo_vigiado_forma' },
    { nome: 'slug VAZIO', sql: linha('t4', { slug: `''` }), constraint: 'chk_grupo_vigiado_forma' },
    { nome: 'slug só ESPAÇO', sql: linha('t5', { slug: `'   '` }), constraint: 'chk_grupo_vigiado_forma' },
    { nome: 'nome VAZIO', sql: linha('t6', { nome: `''` }), constraint: 'chk_grupo_vigiado_forma' },
    { nome: 'nome só NEWLINE', sql: linha('t7', { nome: `E'\\n'` }), constraint: 'chk_grupo_vigiado_forma' },
    { nome: 'emoji VAZIO', sql: linha('t8', { emoji: `''` }), constraint: 'chk_grupo_vigiado_forma' },
    { nome: 'slug MINÚSCULO (a membership recusaria)', sql: linha('t9', { slug: `'teste'` }), constraint: 'chk_grupo_vigiado_slug_caixa' },
    { nome: 'dia 7 não existe', sql: linha('t10', { agendaDias: `'7'` }), constraint: 'chk_grupo_vigiado_dias' },
    { nome: 'dia por NOME (SEG)', sql: linha('t11', { agendaDias: `'SEG'` }), constraint: 'chk_grupo_vigiado_dias' },
    { nome: 'CSV com vírgula solta', sql: linha('t12', { agendaDias: `'0,'` }), constraint: 'chk_grupo_vigiado_dias' },
    { nome: 'CSV com um dia torto', sql: linha('t13', { agendaDias: `'0,7'` }), constraint: 'chk_grupo_vigiado_dias' },
    { nome: 'TODO DIA com dias ao lado (3º estado)', sql: linha('t14', { agendaTodoDia: 'true', agendaDias: `'0'` }), constraint: 'chk_grupo_vigiado_agenda_coerente' },
    { nome: 'ordem NEGATIVA', sql: linha('t15', { ordem: '-1' }), constraint: 'chk_grupo_vigiado_ordem' },
    { nome: 'criadoPorId só ESPAÇO', sql: linha('t16', { criadoPorId: `'   '` }), constraint: 'chk_grupo_vigiado_criado_por' },
    { nome: 'renomeadoPorId só ESPAÇO', sql: linha('t17', { renomeadoPorId: `'   '` }), constraint: 'chk_grupo_vigiado_renomeado_por' },
    { nome: 'agendaDefinidaPorId só TAB', sql: linha('t18', { agendaDefinidaPorId: `E'\\t'` }), constraint: 'chk_grupo_vigiado_agenda_por' },
  ]

  console.log('═══ REDE 1 — INSERTs TORTOS (o banco recusa pela constraint CERTA) ═══')
  let okTortos = 0
  for (const c of TORTOS) {
    try {
      await prisma.$executeRawUnsafe(sub(c.sql))
      console.log(`⛔⛔ ACEITOU "${c.nome}" — o CHECK NÃO MORDE`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg.includes(c.constraint)) {
        okTortos++
        console.log(`⭐ recusou "${c.nome}" · pela ${c.constraint}`)
      } else {
        const outra = msg.match(/chk_[a-z_]+|23505/)?.[0] ?? 'motivo desconhecido'
        console.log(`⚠️ recusou "${c.nome}" mas por ${outra} (esperado ${c.constraint})`)
      }
    }
  }
  console.log(`\n→ ${okTortos} de ${TORTOS.length} recusados pela constraint certa\n`)

  // ═══ OS LEGÍTIMOS: nenhum CHECK pode barrar o estado REAL ═══
  const LEGITIMOS: Caso[] = [
    { nome: 'mínimo (os 3 autores NULL — nullable é legítimo)', sql: linha('g1', {}), constraint: '' },
    { nome: 'TODO DIA com dias vazio (coerente)', sql: linha('g2', { slug: `'G2'`, agendaTodoDia: 'true', agendaDias: `''` }), constraint: '' },
    { nome: 'dias SEG e DOM', sql: linha('g3', { slug: `'G3'`, agendaDias: `'0,6'` }), constraint: '' },
    { nome: 'nome com ESPAÇO no meio ("os caros")', sql: linha('g4', { slug: `'G4'`, nome: `'os caros'` }), constraint: '' },
    { nome: 'emoji multi-byte 💰', sql: linha('g5', { slug: `'G5'`, emoji: `'💰'` }), constraint: '' },
    { nome: 'slug de grupo NOVO (G + hex maiúsculo)', sql: linha('g6', { slug: `'GA1B2C3D4E5F6'` }), constraint: '' },
    { nome: 'os TRÊS autores preenchidos', sql: linha('g7', { slug: `'G7'`, criadoPorId: `'u1'`, renomeadoPorId: `'u2'`, agendaDefinidaPorId: `'u3'` }), constraint: '' },
    { nome: 'ordem alta (grupo no fim da mesa)', sql: linha('g8', { slug: `'G8'`, ordem: '99' }), constraint: '' },
  ]

  console.log('═══ REDE 2 — LEGÍTIMOS (nenhum CHECK pode barrar o estado real) ═══')
  let okLegit = 0
  for (const c of LEGITIMOS) {
    try {
      await prisma.$executeRawUnsafe(sub(c.sql))
      okLegit++
      console.log(`⭐ aceitou "${c.nome}"`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      console.log(`⛔⛔ RECUSOU o legítimo "${c.nome}" · ${msg.match(/chk_[a-z_]+|23505/)?.[0] ?? '?'}`)
    }
  }
  console.log(`\n→ ${okLegit} de ${LEGITIMOS.length} legítimos aceitos\n`)

  // ═══ O UNIQUE: dois grupos com o MESMO slug na mesma empresa é impossível ═══
  console.log('═══ REDE 3 — O ÍNDICE ÚNICO (companyId, slug) ═══')
  try {
    await prisma.$executeRawUnsafe(sub(linha('g9', { slug: `'TESTE'` })))
    console.log('⛔⛔ ACEITOU o 2º grupo com o MESMO slug — o unique NÃO morde')
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    console.log(msg.includes('23505') ? '⭐ recusou o slug repetido (23505)' : `⚠️ recusou por outro motivo: ${msg.slice(0, 80)}`)
  }

  // ═══ OS CONTRAFACTUAIS, medidos NO PRÓPRIO BANCO ═══
  console.log('\n═══ REDE 4 — O CONTRAFACTUAL (medido, não afirmado) ═══')
  const q = async (sql: string) => {
    const r = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(sql)
    return r[0]
  }

  const nulo = await q(`SELECT
    (length(trim(NULL)) > 0) AS ingenua,
    (NULL IS NULL OR length(btrim(NULL, E' \\t\\n\\r\\f\\v')) > 0) AS nossa`)
  console.log(`autor NULL · forma INGÊNUA → ${nulo.ingenua === null ? 'NULL ⇒ o CHECK PASSARIA' : nulo.ingenua}`)
  console.log(`autor NULL · a NOSSA       → ${nulo.nossa} ⇒ ACEITA (NULL é legítimo: autor é opcional)`)

  const espaco = await q(`SELECT
    ('   ' <> '') AS so_vazio,
    (length(btrim('   ', E' \\t\\n\\r\\f\\v')) > 0) AS nossa`)
  console.log(`só-ESPAÇO  · forma "<> ''"  → ${espaco.so_vazio} ⇒ PASSARIA (o furo de 21/09)`)
  console.log(`só-ESPAÇO  · a NOSSA        → ${espaco.nossa} ⇒ RECUSA`)

  const tab = await q(`SELECT
    (length(trim(E'\\t')) > 0) AS trim_simples,
    (length(btrim(E'\\t', E' \\t\\n\\r\\f\\v')) > 0) AS nossa`)
  console.log(`só-TAB     · trim SIMPLES   → ${tab.trim_simples} ⇒ PASSARIA (o btrim apara só o espaço)`)
  console.log(`só-TAB     · a NOSSA        → ${tab.nossa} ⇒ RECUSA`)

  const nullable = await prisma.$queryRawUnsafe<Array<{ column_name: string; is_nullable: string }>>(
    `SELECT column_name, is_nullable FROM information_schema.columns
     WHERE table_name = 'stock_grupo_vigiado'
       AND column_name IN ('criadoPorId','renomeadoPorId','agendaDefinidaPorId','slug','nome')
     ORDER BY column_name`,
  )
  console.log('\n⭐ is_nullable (o furo da REGRA 13 era REAL nas 3 de autor):')
  for (const c of nullable) console.log(`   ${c.column_name.padEnd(22)} nullable=${c.is_nullable}`)

  // ═══ LIMPEZA + escrita líquida ═══
  await prisma.stockGrupoVigiado.deleteMany({ where: { companyId: empresa.id } })
  await prisma.company.deleteMany({ where: { id: empresa.id } })
  const depois = await prisma.stockGrupoVigiado.count()
  console.log(`\n⭐ escrita líquida: ${antes} → ${depois} ${antes === depois ? '(ZERO ✓)' : '⛔ GRAVOU'}`)
}

main()
  .catch(() => {
    // ⚠️ a mensagem do Prisma vaza a URI com a senha — nunca imprimir o erro cru
    console.error('⛔ a prova falhou (mensagem silenciada: a exceção do Prisma vaza a credencial)')
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
