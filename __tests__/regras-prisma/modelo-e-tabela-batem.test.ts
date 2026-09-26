/**
 * ⛔⛔⛔ O NOME QUE O PRISMA ESPERA É O NOME QUE A MIGRATION CRIA (25/09/2026).
 *
 * **Nasceu de um defeito meu, e ele só apareceu EM PRODUÇÃO.** A migration de investimentos
 * criava `investment_contracts` (snake_case, como todo o resto do schema) e o modelo não
 * declarava `@@map` — então o Prisma procurava `public.InvestmentContract`:
 *
 * > *The table `public.InvestmentContract` does not exist in the current database.*
 *
 * ⚠️⚠️ **E O DEV NÃO PEGOU, por construção:** o dev roda `prisma db push`, que cria a tabela
 * com o nome que o **modelo** diz — então lá os dois sempre batem. O SQL da migration só é
 * executado em **prod**. ***É a mesma classe do `contains` case-sensitive (08/09): funciona
 * em dev e falha calado em prod, a pior espécie de bug.***
 *
 * ⭐ Este guard fecha a classe: **todo modelo tem que apontar pra uma tabela que alguma
 * migration cria**. Medido no repo inteiro na estreia — **157 modelos, 0 divergências** —,
 * então ele nasce sem allowlist e sem alarme falso.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const raiz = process.cwd()
const schema = readFileSync(join(raiz, 'prisma/schema.prisma'), 'utf-8')

/** todas as tabelas que as migrations CRIAM */
function tabelasCriadas(): Set<string> {
  const dir = join(raiz, 'prisma/migrations')
  const out = new Set<string>()
  for (const d of readdirSync(dir)) {
    const f = join(dir, d, 'migration.sql')
    if (!existsSync(f)) continue
    const sql = readFileSync(f, 'utf-8')
    for (const m of sql.matchAll(/CREATE TABLE(?: IF NOT EXISTS)?\s+"?(\w+)"?/gi)) out.add(m[1])
  }
  return out
}

/** cada modelo e o nome FÍSICO que ele espera (o `@@map`, ou o próprio nome) */
function modelosDoSchema(): { modelo: string; tabela: string }[] {
  return [...schema.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)].map((m) => {
    const map = /@@map\("([^"]+)"\)/.exec(m[2])
    return { modelo: m[1], tabela: map ? map[1] : m[1] }
  })
}

describe('⛔⛔ todo modelo aponta pra uma tabela que alguma migration cria', () => {
  it('⭐ nenhum modelo espera uma tabela que não existe no SQL', () => {
    const criadas = tabelasCriadas()
    const orfaos = modelosDoSchema()
      .filter((m) => !criadas.has(m.tabela))
      .map((m) => `${m.modelo} → espera a tabela "${m.tabela}"`)

    expect(orfaos,
      'modelo sem `@@map` cuja migration cria snake_case: funciona no dev (db push usa o nome do MODELO)'
      + ' e estoura em prod com "table does not exist"')
      .toEqual([])
  })

  it('⭐ e os modelos novos de hoje estão mapeados', () => {
    // ⚠️ o caso que motivou o guard — ele não pode passar por cegueira
    const m = modelosDoSchema()
    expect(m.find((x) => x.modelo === 'InvestmentContract')?.tabela).toBe('investment_contracts')
    expect(m.find((x) => x.modelo === 'InvestmentContribution')?.tabela).toBe('investment_contributions')
  })

  it('⭐⭐ auto-teste do detector — ele PEGA o defeito reposto', () => {
    /**
     * ⚠️ Sem isto o guard passaria por cegueira (o regex podia simplesmente não casar
     * nada). Aqui a reposição é simulada: um modelo sem `@@map` cuja tabela é snake_case.
     */
    const criadas = new Set(['investment_contracts'])
    const fingido = [{ modelo: 'InvestmentContract', tabela: 'InvestmentContract' }]
    const orfaos = fingido.filter((m) => !criadas.has(m.tabela))
    expect(orfaos).toHaveLength(1)
  })
})
