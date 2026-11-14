/**
 * ⭐⭐ REGRA 13 — A PROVA DOS CHECKs DAS ROTINAS, CONTRA POSTGRES (13/11/2026).
 * Migration `20261113230000_stock_rotina`: stock_rotina · stock_rotina_item · stock_tarefa_rotina · stock_tarefa_item.
 *
 * ⛔ Por que não é teste da suíte: CHECK não existe no schema Prisma (mora no SQL da migration) — no
 * SQLite do dev o INSERT torto PASSA porque o CHECK não existe ali.
 * ⚠️ Três valores (REGRA 13): `limiteMin IS NULL OR (…)` — NULL é legítimo (sem limite) e precisa
 * PASSAR; o par (feitoEm, feitoPorId) é igualdade de `IS NULL` (nunca NULL), então o tique pela metade
 * é recusado nos dois sentidos.
 *
 * ⛔ ZERO ESCRITA LÍQUIDA: cada caso roda numa transação com ROLLBACK forçado; contagem antes/depois.
 * Os ids são inéditos (`zzprova…`) e as FKs apontam pra linhas criadas DENTRO da própria transação.
 */
import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'

const CO = process.env.PROVA_COMPANY_ID ?? 'cmq17yapb00gnrndlh33sctbo'

const ROT = (extra = '', vals = '') =>
  `INSERT INTO stock_rotina (id, "companyId", nome, regra${extra}) VALUES ('zzprova_r', $1, 'ZZPROVA', '{"tipo":"diaria"}'${vals})`
const BASE_TAREFA = `INSERT INTO stock_tarefa (id, "companyId", nome, dia) VALUES ('zzprova_t', $1, 'ZZPROVA', now())`

interface Caso { nome: string; sqls: string[]; esperado: string | 'aceita' }
const CASOS: Caso[] = [
  { nome: 'rotina com nome vazio', sqls: [`INSERT INTO stock_rotina (id, "companyId", nome, regra) VALUES ('zzprova_r', $1, '   ', '{"tipo":"diaria"}')`], esperado: 'chk_stock_rotina_nome' },
  { nome: 'rotina com regra vazia', sqls: [`INSERT INTO stock_rotina (id, "companyId", nome, regra) VALUES ('zzprova_r', $1, 'ZZPROVA', ' ')`], esperado: 'chk_stock_rotina_regra' },
  { nome: 'limite 1440 (passa do dia)', sqls: [ROT(', "limiteMin"', ', 1440')], esperado: 'chk_stock_rotina_limite' },
  { nome: 'limite negativo', sqls: [ROT(', "limiteMin"', ', -1')], esperado: 'chk_stock_rotina_limite' },
  { nome: 'pausada sem autor', sqls: [ROT(', "pausadaEm"', ', now()')], esperado: 'chk_stock_rotina_pausada' },
  { nome: 'autor de pausa sem instante', sqls: [ROT(', "pausadaPorId"', ", 'u'")], esperado: 'chk_stock_rotina_pausada' },
  { nome: 'excluída sem autor', sqls: [ROT(', "excluidaEm"', ', now()')], esperado: 'chk_stock_rotina_excluida' },
  { nome: 'item com texto vazio', sqls: [ROT(), `INSERT INTO stock_rotina_item (id, "rotinaId", posicao, texto) VALUES ('zzprova_i', 'zzprova_r', 0, '  ')`], esperado: 'chk_stock_rotina_item_texto' },
  { nome: 'vínculo com limite 2000', sqls: [ROT(), BASE_TAREFA, `INSERT INTO stock_tarefa_rotina (id, "companyId", "tarefaId", "rotinaId", dia, "limiteMin") VALUES ('zzprova_v', $1, 'zzprova_t', 'zzprova_r', now(), 2000)`], esperado: 'chk_stock_tarefa_rotina_limite' },
  { nome: '⭐ R25 a MESMA rotina 2× no MESMO dia (a idempotência no banco)', sqls: [ROT(), BASE_TAREFA,
    `INSERT INTO stock_tarefa (id, "companyId", nome, dia) VALUES ('zzprova_t2', $1, 'ZZPROVA', now())`,
    `INSERT INTO stock_tarefa_rotina (id, "companyId", "tarefaId", "rotinaId", dia) VALUES ('zzprova_v', $1, 'zzprova_t', 'zzprova_r', '2026-11-13 15:00')`,
    `INSERT INTO stock_tarefa_rotina (id, "companyId", "tarefaId", "rotinaId", dia) VALUES ('zzprova_v2', $1, 'zzprova_t2', 'zzprova_r', '2026-11-13 15:00')`], esperado: 'stock_tarefa_rotina_rotinaId_dia_key' },
  { nome: '⭐ R26 tique SEM quem (feitoEm sem feitoPorId)', sqls: [BASE_TAREFA, `INSERT INTO stock_tarefa_item (id, "companyId", "tarefaId", posicao, texto, "feitoEm") VALUES ('zzprova_ti', $1, 'zzprova_t', 0, 'X', now())`], esperado: 'chk_stock_tarefa_item_tique' },
  { nome: 'quem sem instante (feitoPorId sem feitoEm)', sqls: [BASE_TAREFA, `INSERT INTO stock_tarefa_item (id, "companyId", "tarefaId", posicao, texto, "feitoPorId") VALUES ('zzprova_ti', $1, 'zzprova_t', 0, 'X', 'c')`], esperado: 'chk_stock_tarefa_item_tique' },
  { nome: '⛔ R29 apagar rotina COM história (FK RESTRICT)', sqls: [ROT(), BASE_TAREFA,
    `INSERT INTO stock_tarefa_rotina (id, "companyId", "tarefaId", "rotinaId", dia) VALUES ('zzprova_v', $1, 'zzprova_t', 'zzprova_r', now())`,
    `DELETE FROM stock_rotina WHERE id = 'zzprova_r'`], esperado: 'stock_tarefa_rotina_rotinaId_fkey' },
  { nome: 'LEGÍTIMO: rotina sem limite (NULL passa)', sqls: [ROT()], esperado: 'aceita' },
  { nome: 'LEGÍTIMO: rotina com limite 23:59, pausada com autor', sqls: [ROT(', "limiteMin", "pausadaEm", "pausadaPorId"', ", 1439, now(), 'u'")], esperado: 'aceita' },
  { nome: 'LEGÍTIMO: grupo semeado + tique assinado', sqls: [ROT(), BASE_TAREFA,
    `INSERT INTO stock_tarefa_rotina (id, "companyId", "tarefaId", "rotinaId", dia, "limiteMin") VALUES ('zzprova_v', $1, 'zzprova_t', 'zzprova_r', now(), 660)`,
    `INSERT INTO stock_tarefa_item (id, "companyId", "tarefaId", posicao, texto, "feitoEm", "feitoPorId") VALUES ('zzprova_ti', $1, 'zzprova_t', 0, 'X', now(), 'c')`], esperado: 'aceita' },
]

async function contar() {
  const [r] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT (SELECT count(*) FROM stock_rotina) + (SELECT count(*) FROM stock_rotina_item) + (SELECT count(*) FROM stock_tarefa_rotina)
          + (SELECT count(*) FROM stock_tarefa_item) + (SELECT count(*) FROM stock_tarefa) AS n`)
  return Number(r.n)
}

async function main() {
  const nome = await exigirEmpresaNesteBanco(prisma, CO)
  console.log(`[prova] CHECKs das Rotinas · ${nome.trim()}`)
  const antes = await contar()
  let ok = 0
  const alvos = CASOS.map((x) => x.esperado).filter((n) => n !== 'aceita')
  for (const c of CASOS) {
    let veio: string | null = null
    try {
      await prisma.$transaction(async (tx) => {
        for (const s of c.sqls) await tx.$executeRawUnsafe(s, CO)
        throw new Error('ROLLBACK_PROPOSITAL')
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg !== 'ROLLBACK_PROPOSITAL') {
        veio = alvos.find((n) => msg.includes(n))
          ?? `outro: ${msg.replace(/\s+/g, ' ').replace(/postgres(ql)?:\/\/\S+/gi, '[uri]').slice(0, 110)}`
      }
    }
    const passou = c.esperado === 'aceita' ? veio === null : veio === c.esperado
    if (passou) ok++
    console.log(`  ${passou ? '✓' : '⛔'} ${c.nome} · esperado ${c.esperado} · veio ${veio ?? 'ACEITO'}`)
  }
  const depois = await contar()
  console.log(`  linhas (5 tabelas): ${antes} → ${depois} ${antes === depois ? '(ZERO ESCRITA ✓)' : '⛔ GRAVOU'}`)
  console.log(`  ${ok === CASOS.length && antes === depois ? '⭐ PROVA OK' : '⛔ PROVA FALHOU'} · ${ok} de ${CASOS.length}`)
  if (ok !== CASOS.length || antes !== depois) process.exit(1)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    // ⛔ a mensagem do erro pode vazar a URI com a senha — nunca imprimir a exceção crua
    console.error('FALHOU:', e instanceof Error ? e.name : 'erro desconhecido')
    process.exit(1)
  })
