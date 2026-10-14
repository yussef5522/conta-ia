/**
 * ⭐⭐⭐ `'   '` NÃO É UMA ESCOLHA — OS 2 CHECKs FRACOS DO ESTOQUE, FECHADOS (14/10/2026).
 *
 * **Ordem do dono (item 3 do sprint do trilho):** *"mesma família do `'   '` (espaço passando por
 * escolha) em 2 campos `stock_`. ALTER é proibido pelo guard de CI, então fecha pelo caminho que
 * a casa permite — trigger (REGRA 13: NULL explícito PRIMEIRO) e/ou trava 422 na porta única de
 * escrita — e REPORTA qual caminho foi."*
 *
 * ═══ ⛔⛔ O BURACO, MEDIDO ANTES DE ESCREVER UMA LINHA ═══
 *
 * Os dois CHECKs usam `"coluna" <> ''`, e **`<> ''` só pega a string VAZIA**: `'   '` é `true`
 * nos dois. É a forma fraca que a prova de 14/10 (manhã) pegou em prod no `chk_user_trilho_forma`
 * — ali consertada por ALTER, caminho que **o estoque não tem**.
 *
 * ⭐ **E AS DUAS PORTAS NÃO SÃO IGUALMENTE ALCANÇÁVEIS — isso mudou o desenho:**
 *   · `stock_radar_item.lista` → a rota valida com `z.enum(LISTAS)`, vocabulário FECHADO.
 *     `'   '` é **impossível pela rota**. Ali a armadura que falta é a do BANCO.
 *   · `stock_venda_ignorado.nomeSuitable` → a rota valida com `z.string().min(1)`, e
 *     **`'   '` tem comprimento 3**. ***O buraco é REAL e alcançável pela rota de hoje.***
 *
 * Por isso o conserto tem DOIS caminhos, cada um pelo motivo dele — e os dois estão aqui.
 *
 * ⚠️ O CHECK/TRIGGER do banco **não existe no dev SQLite** (`db push` cria a tabela a partir do
 * schema, e trigger mora no SQL da migration). O que este arquivo prova é a **TRAVA DA PORTA**;
 * a do BANCO se prova contra Postgres em `scripts/prova-check-estoque-so-espaco.ts` (REGRA 13).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '@/lib/db'
import { upsertVendaMap, VendaMapError } from '@/lib/stock/vendas/venda-map'
import { porNaLista, RadarListaError } from '@/lib/stock/radar/watchlist'

const CNPJ = '83838383000183'
let companyId = ''
let itemId = ''

beforeAll(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { name: 'só-espaço ltda', cnpj: CNPJ } })
  companyId = c.id
  const i = await prisma.stockItem.create({
    data: { companyId, nome: 'COCA 2L', unidadeControle: 'UN', categoria: 'REVENDA', criadoVia: 'MANUAL' },
  })
  itemId = i.id
})

afterAll(async () => {
  await prisma.stockVendaIgnorado.deleteMany({ where: { companyId } })
  await prisma.stockVendaProdutoMap.deleteMany({ where: { companyId } })
  await prisma.stockRadarItem.deleteMany({ where: { companyId } })
  await prisma.stockItem.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

// ───────────── A TRAVA DA PORTA (o caminho alcançável HOJE) ─────────────

describe('⛔⛔ a PORTA ÚNICA recusa `\'   \'` — e DIZ por quê', () => {
  /**
   * ⛔⛔ ESTE É O CASO QUE A ROTA DE HOJE DEIXA PASSAR. `z.string().min(1)` aprova três espaços,
   * o CHECK `<> ''` aprova três espaços, e nasce uma linha de IGNORAR cujo nome **não casa com
   * nome nenhum do PDV** — um "ignorado" invisível que não ignora nada, e que ainda ocupa a
   * chave única `(companyId, nomeSuitable)`.
   */
  it('⛔⛔ IGNORAR com nome só-espaço é RECUSADO, e nada é gravado', async () => {
    for (const bruto of ['   ', '\t', '\n  ', '']) {
      await expect(
        upsertVendaMap(companyId, bruto, { tipo: 'IGNORAR' }, undefined, prisma),
        `"${bruto.replace(/\n/g, '\\n').replace(/\t/g, '\\t')}" não é um nome`,
      ).rejects.toThrow(VendaMapError)
    }
    expect(await prisma.stockVendaIgnorado.count({ where: { companyId } })).toBe(0)
  })

  /** ⚠️ e a recusa ENSINA — *"nome só-espaço"* manda o dono olhar o campo certo */
  it('⚠️ a frase da recusa nomeia o problema (recusa muda é recusa que não ensina)', async () => {
    await expect(
      upsertVendaMap(companyId, '   ', { tipo: 'IGNORAR' }, undefined, prisma),
    ).rejects.toThrow(/nome/i)
  })

  /**
   * ⛔ A TRAVA VALE PRO MAPA INTEIRO, não só pro IGNORAR. O `nomeSuitable` é a CHAVE do mapa de
   * produtos; mapear `'   '` pra uma ficha criaria um destino que a baixa nunca alcança, porque
   * nome nenhum do relatório normaliza pra três espaços.
   */
  it('⛔ e vale pros três destinos — a chave do mapa é a MESMA', async () => {
    /** ⚠️ `StockFicha` não tem campo `nome` — o nome é do ITEM que ela produz. Eu havia escrito
     *  `nome: 'XIS'` de cabeça e o Prisma recusou: *ler o schema em vez de supor*. */
    const produzido = await prisma.stockItem.create({
      data: { companyId, nome: 'XIS COMPLETO', unidadeControle: 'UN', categoria: 'PRODUTO_FINAL', criadoVia: 'MANUAL' },
    })
    const f = await prisma.stockFicha.create({
      data: { companyId, tipoProduto: 'PRODUTO_FINAL', itemProduzidoId: produzido.id, versaoAtual: 1 },
    })
    for (const alvo of [
      { tipo: 'FICHA' as const, fichaId: f.id },
      { tipo: 'REVENDA' as const, itemId },
      { tipo: 'IGNORAR' as const },
    ]) {
      await expect(upsertVendaMap(companyId, '  ', alvo, undefined, prisma)).rejects.toThrow(
        VendaMapError,
      )
    }
    expect(await prisma.stockVendaProdutoMap.count({ where: { companyId } })).toBe(0)
    await prisma.stockFicha.deleteMany({ where: { companyId } })
  })

  /**
   * ⭐ E O LEGÍTIMO PASSA — a trava mordeu o que tinha que morder e não virou parede. Nome com
   * espaço NO MEIO é o caso normal do PDV (*"COCA COLA 2L"*).
   */
  it('⭐ nome de verdade entra, inclusive com espaço no meio', async () => {
    await upsertVendaMap(companyId, 'COCA COLA 2L', { tipo: 'IGNORAR' }, undefined, prisma)
    expect(
      await prisma.stockVendaIgnorado.count({ where: { companyId, nomeSuitable: 'COCA COLA 2L' } }),
    ).toBe(1)
    await prisma.stockVendaIgnorado.deleteMany({ where: { companyId } })
  })

  /**
   * ⛔ O RADAR TAMBÉM GANHA A TRAVA — e aqui ela é **cinto sobre suspensório, declarado**: a rota
   * usa `z.enum(LISTAS)`, então `'   '` não chega por ali. A trava existe pro caminho que não
   * passa pela rota (script, lib nova, lançamento em lote) — foi exatamente por um caminho
   * desses que o `IGNORAR` ficou 9 dias morto em 23/09.
   */
  it('⛔ o radar recusa lista só-espaço (cinto: a rota já tem enum)', async () => {
    await expect(
      porNaLista({ companyId, lista: '   ' as never, itemId }, prisma),
    ).rejects.toThrow(RadarListaError)
    expect(await prisma.stockRadarItem.count({ where: { companyId } })).toBe(0)
  })

  it('⭐ e a lista de verdade entra', async () => {
    await porNaLista({ companyId, lista: 'REVENDA', itemId }, prisma)
    expect(await prisma.stockRadarItem.count({ where: { companyId, lista: 'REVENDA' } })).toBe(1)
  })
})

// ───────────── A ARMADURA DO BANCO (o caminho estrutural) ─────────────

describe('⛔⛔ a armadura do BANCO: trigger, porque ALTER é proibido', () => {
  const dir = join(process.cwd(), 'prisma/migrations')
  const migracao = () => {
    const d = readdirSync(dir).find((x) => /stock_so_espaco/.test(x))
    expect(d, 'a migration do trigger existe').toBeTruthy()
    return readFileSync(join(dir, d!, 'migration.sql'), 'utf8')
  }
  const semComentario = (sql: string) =>
    sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')

  /**
   * ⛔⛔ **POR QUE TRIGGER E NÃO ALTER DO CHECK:** migration de estoque é **CREATE-only por regra
   * dura**, com guard no CI (`migration-isolation.test.ts` reprova `ALTER TABLE`). E mesmo sem o
   * guard, migration APLICADA não se reescreve — o checksum do Prisma reprova o deploy (a
   * cicatriz de 04/10). O precedente da casa é trigger: `loan_installment_no_double_link` (15/08)
   * e `stock_ficha_rotulo_coerente` (11/10).
   */
  it('⛔ a migration SÓ CRIA — zero ALTER, zero DROP (o guard do módulo)', () => {
    const sql = semComentario(migracao())
    expect(sql).not.toMatch(/\bALTER\s+TABLE\b/i)
    expect(sql).not.toMatch(/\bDROP\s+(TABLE|COLUMN|INDEX|CONSTRAINT)\b/i)
    expect(sql, 'é função + trigger').toMatch(/CREATE\s+(OR REPLACE\s+)?FUNCTION/i)
    expect(sql, 'nas DUAS tabelas').toMatch(/CREATE\s+TRIGGER/i)
  })

  /**
   * ⚠️⚠️ **A ASSERÇÃO É DO `CREATE TRIGGER` INTEIRO, NÃO DO NOME DA TABELA SOLTO — e a 1ª versão
   * veio VERDE com um dos dois triggers desligado.** Ela procurava `ON stock_venda_ignorado` em
   * qualquer lugar do SQL, e o nome da tabela aparece **4 vezes** no arquivo (no cabeçalho que
   * documenta o CHECK velho, no ROLLBACK, e no fragmento que sobrou do statement comentado).
   * *Menção, não uso.* O que morde é exigir o comando que CRIA: nome do trigger + evento +
   * tabela + a função com a coluna certa.
   */
  it('⛔ o trigger morde as DUAS tabelas, no INSERT e no UPDATE', () => {
    const sql = semComentario(migracao())
    const esperados: [string, string][] = [
      ['stock_radar_item', 'lista'],
      ['stock_venda_ignorado', 'nomeSuitable'],
    ]
    for (const [tabela, coluna] of esperados) {
      expect(
        sql,
        `${tabela}: o CREATE TRIGGER inteiro (nome + BEFORE INSERT OR UPDATE + a coluna)`,
      ).toMatch(
        new RegExp(
          `CREATE TRIGGER\\s+\\w+\\s+BEFORE\\s+INSERT\\s+OR\\s+UPDATE\\s+ON\\s+${tabela}\\s+FOR EACH ROW\\s+EXECUTE FUNCTION\\s+stock_texto_de_escolha\\('${coluna}'\\)`,
          'i',
        ),
      )
    }
  })

  /**
   * ⛔⛔⛔ **REGRA 13 — O `IS NULL` VEM EXPLÍCITO E ANTES DA COMPARAÇÃO DE CONTEÚDO.**
   * `length(trim(NULL))` **não é 0, é NULL**, e NULL contamina o `AND` inteiro: a condição vira
   * NULL, o `IF` não entra, e o torto PASSA. É o furo exato do `chk_aviso_acao_completa` (04/10).
   *
   * ⚠️ Hoje as duas colunas são `NOT NULL`, então o `IS NULL` é redundante — e é justamente por
   * isso que ele tem que estar escrito: **a migration que um dia tornar a coluna nullable não vai
   * lembrar de revisar este trigger.**
   */
  it('⛔⛔ REGRA 13: o NULL é tratado EXPLICITAMENTE e PRIMEIRO', () => {
    const sql = semComentario(migracao())
    const fn = sql.slice(sql.search(/CREATE\s+(OR REPLACE\s+)?FUNCTION/i))
    const posNull = fn.search(/IS\s+NULL/i)
    const posTrim = fn.search(/length\s*\(\s*trim/i)
    expect(posNull, 'o IS NULL existe').toBeGreaterThan(-1)
    expect(posTrim, 'e a comparação de conteúdo também').toBeGreaterThan(-1)
    expect(posNull, 'o NULL é tratado ANTES do conteúdo').toBeLessThan(posTrim)
  })

  /** ⭐ e o ROLLBACK está escrito — trigger sem rollback documentado é trigger que ninguém desfaz */
  it('⭐ o ROLLBACK está escrito na migration', () => {
    expect(migracao()).toMatch(/ROLLBACK/i)
    expect(migracao()).toMatch(/DROP TRIGGER/i)
  })

  /** ⛔ a prova REGRA 13 contra Postgres existe — CHECK/trigger não existe no SQLite do dev */
  it('⛔ a prova contra Postgres existe (o dev não tem trigger)', () => {
    expect(existsSync(join(process.cwd(), 'scripts/prova-check-estoque-so-espaco.ts'))).toBe(true)
  })
})

// ───────────── A RÉGUA TEM UM DONO (REGRA 4) ─────────────

describe('⛔ a régua do "só-espaço" tem UM dono', () => {
  /**
   * ⛔⛔ **UMA RÉGUA, OS DOIS LADOS.** Se a porta e o trigger respondessem *"isto é um nome?"* por
   * duas definições, elas divergiriam no primeiro caractere novo (zero-width space, NBSP) — e o
   * dono levaria um **500 sem corpo** no lugar da frase que ensina. O TS é o dono do texto; o
   * trigger é o espelho em SQL, e o comentário dele diz isso.
   */
  it('⛔ a porta não escreve a régua à mão — ela chama o dono', () => {
    const vendaMap = readFileSync(join(process.cwd(), 'lib/stock/vendas/venda-map.ts'), 'utf8')
    const watchlist = readFileSync(join(process.cwd(), 'lib/stock/radar/watchlist.ts'), 'utf8')
    for (const [nome, src] of Object.entries({ vendaMap, watchlist })) {
      expect(src, `${nome} consome o dono da régua`).toMatch(/from '\.\.?\/(texto-de-escolha|\.\.\/texto-de-escolha)'/)
    }
  })

  it('⭐ e o dono é PURO (roda sem banco, nos dois lados)', () => {
    const src = readFileSync(join(process.cwd(), 'lib/stock/texto-de-escolha.ts'), 'utf8')
    expect(src, 'nada de Prisma na régua').not.toMatch(/\bprisma\b/)
  })
})
