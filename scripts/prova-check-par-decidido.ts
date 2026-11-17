/**
 * ⭐⭐ REGRA 13 — A PROVA DOS CHECKs DE `stock_item_par_decidido`, CONTRA POSTGRES (16/11/2026).
 * ⛔ CHECK não existe no schema Prisma (mora no SQL da migration): no SQLite o INSERT torto passa.
 * ⛔ ZERO ESCRITA LÍQUIDA: cada caso numa transação com ROLLBACK forçado; contagem antes/depois.
 */
import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'

const CO = process.env.PROVA_COMPANY_ID ?? 'cmq17yapb00gnrndlh33sctbo'
const INS = (a: string, b: string, dec: string, autor: string) =>
  `INSERT INTO stock_item_par_decidido (id, "companyId", "itemAId", "itemBId", decisao, "decididoPorId") VALUES ('zzprova_${Math.random().toString(36).slice(2, 8)}', $1, '${a}', '${b}', '${dec}', '${autor}')`
const CASOS: { nome: string; sqls: string[]; esperado: string }[] = [
  { nome: 'decisão fora da lista', sqls: [INS('zza', 'zzb', 'TALVEZ', 'u')], esperado: 'chk_stock_item_par_decisao' },
  { nome: 'decisão em minúscula', sqls: [INS('zza', 'zzb', 'diferentes', 'u')], esperado: 'chk_stock_item_par_decisao' },
  { nome: 'par fora de ordem (B < A)', sqls: [INS('zzb', 'zza', 'DIFERENTES', 'u')], esperado: 'chk_stock_item_par_ordem' },
  { nome: 'item com ele mesmo', sqls: [INS('zza', 'zza', 'DIFERENTES', 'u')], esperado: 'chk_stock_item_par_ordem' },
  { nome: 'autor em branco', sqls: [INS('zza', 'zzb', 'DIFERENTES', '  ')], esperado: 'chk_stock_item_par_autor' },
  { nome: 'o MESMO par duas vezes', sqls: [INS('zza', 'zzb', 'DIFERENTES', 'u'), INS('zza', 'zzb', 'JUNTADOS', 'u')], esperado: '23505:("companyId", "itemAId", "itemBId")' },
  { nome: 'LEGÍTIMO: DIFERENTES ordenado com autor', sqls: [INS('zza', 'zzb', 'DIFERENTES', 'u')], esperado: 'aceita' },
  { nome: 'LEGÍTIMO: JUNTADOS (dígito antes de letra, ordem byte)', sqls: [INS('zz1', 'zza', 'JUNTADOS', 'u')], esperado: 'aceita' },
]
async function main() {
  await exigirEmpresaNesteBanco(prisma, CO)
  const antes = await prisma.stockItemParDecidido.count()
  let ok = 0
  for (const c of CASOS) {
    let veio: string | null = null
    try {
      await prisma.$transaction(async (tx) => { for (const s of c.sqls) await tx.$executeRawUnsafe(s, CO); throw new Error('ROLLBACK_PROPOSITAL') })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg !== 'ROLLBACK_PROPOSITAL') {
        veio = CASOS.map((x) => x.esperado).filter((n) => n !== 'aceita')
          .find((n) => (n.startsWith('23505:') ? msg.includes('23505') && msg.includes(n.slice(6)) : msg.includes(n)))
          ?? `outro: ${msg.replace(/\s+/g, ' ').replace(/postgres\S+/g, '[uri]').slice(0, 100)}`
      }
    }
    const passou = c.esperado === 'aceita' ? veio === null : veio === c.esperado
    if (passou) ok++
    console.log(`  ${passou ? '✓' : '⛔'} ${c.nome} · esperado ${c.esperado} · veio ${veio ?? 'ACEITO'}`)
  }
  const depois = await prisma.stockItemParDecidido.count()
  console.log(`  linhas: ${antes} → ${depois} ${antes === depois ? '(ZERO ESCRITA ✓)' : '⛔ GRAVOU'}`)
  console.log(`  ${ok === CASOS.length && antes === depois ? '⭐ PROVA OK' : '⛔ PROVA FALHOU'} · ${ok} de ${CASOS.length}`)
  if (ok !== CASOS.length || antes !== depois) process.exit(1)
}
main().then(() => process.exit(0)).catch((e) => { console.error('FALHOU:', e instanceof Error ? e.name : 'erro'); process.exit(1) })
