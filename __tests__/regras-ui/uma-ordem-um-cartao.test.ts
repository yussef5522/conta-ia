/**
 * ⭐⭐⭐ O GUARD DA FAMÍLIA — "lugar que soma EVENTOS em vez de ORDENS" (12/10/2026).
 *
 * **A ordem do dono:** *"Guard no padrão da casa: consulta direta aos eventos de conclusão fora
 * da porta = vermelho."* Porque o defeito de 12/10 não foi um cartão: foi uma **classe**. A
 * régua *"estornada não conta"* existia desde **19/09** e tinha **DOIS** consumidores; os
 * outros **NOVE** liam a tabela crua — ***a régua existia e não tinha dono, então cada leitor
 * novo nascia sem ela.***
 *
 * ⛔⛔ **O QUE O GUARD PROÍBE É A FORMA DE UMA LISTAGEM**, não todo acesso à tabela:
 * `findMany`/`aggregate`/`groupBy`/`count` sobre `stockProducaoConclusao` fora da porta. É
 * assim — e só assim — que um total de período nasce.
 *
 * ⭐ `findFirst`/`findUnique`/`create` **continuam livres de propósito**: a etiqueta, o
 * `resolverAlvo` da conferência e o estorna-e-relança precisam da linha ESPECÍFICA pelo id, e
 * proibir isso faria o guard virar parede (a lição do CHECK com vocabulário fechado, 21/09).
 * Quem decide se aquela linha vale é `conclusaoEstaEstornada`, que eles chamam.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { semComentarios, usosDe } from './_leitura-de-fonte'

const RAIZ = join(process.cwd())
const PORTA = 'lib/stock/producao/conclusoes-vigentes.ts'

/** ⛔ as formas que FAZEM uma listagem/total nascer — é a família inteira do defeito */
const FORMAS_DE_LISTAGEM = ['findMany', 'aggregate', 'groupBy', 'count'] as const

/**
 * ⚠️⚠️ AS EXCEÇÕES SÃO **NOMEADAS, COM O MOTIVO ESCRITO** — e a lista é curta de propósito.
 * Exceção sem motivo é a porta por onde o décimo leitor entra.
 */
const EXCECOES: Record<string, string> = {
  /** ⭐ a PORTA. É ela que faz as duas consultas (estornadas + conclusões). */
  [PORTA]: 'é a porta única',
  /**
   * ⭐ LOOKUP POR ID, não listagem: ele já tem os `conclusaoId` dos desvios na mão e busca
   * **o NOME de quem fez o lote** (`colaboradorId`). A fonte dos lotes dele é a porta
   * (`conclusoesVigentes`, linha ~392) — este `findMany` não decide quais lotes existem.
   */
  'lib/avisos/produtores/producao.ts':
    'findMany por ID (nome de quem fez); os LOTES vêm da porta',
  /**
   * ⭐ LOOKUP POR ID: `carimbosDoDia` já tem os `conclusaoId` que a JANELA DE CARIMBOS
   * selecionou e busca `ordemId` pra nomear o produto na fita. Ele **não decide quais
   * conclusões existem** — e a régua *"estornada não conta"* é aplicada pela porta
   * (`idsEstornados`), senão o mesmo lote apareceria carimbado 2× na fita (16/10).
   */
  'lib/stock/producao/conferencia.ts':
    'findMany por ID (ordem do carimbo); a régua da estornada vem da porta',
}

/** ⚠️ varre LIB e APP (não scripts: diagnóstico read-only pode ler o cru pra medir) */
function arquivosDeProducao(): string[] {
  const out: string[] = []
  const anda = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      if (nome === 'node_modules' || nome === '.next' || nome === '__tests__') continue
      const p = join(dir, nome)
      if (statSync(p).isDirectory()) anda(p)
      else if (p.endsWith('.ts') || p.endsWith('.tsx')) out.push(p)
    }
  }
  anda(join(RAIZ, 'lib'))
  anda(join(RAIZ, 'app'))
  return out
}

/** ⭐ as chamadas de LISTAGEM sobre a tabela, já SEM comentário (o arquivo que documenta o defeito não o absolve) */
export function listagensCruas(src: string): string[] {
  const limpo = semComentarios(src)
  const achados: string[] = []
  for (const forma of FORMAS_DE_LISTAGEM) {
    const re = new RegExp(`stockProducaoConclusao\\s*\\.\\s*${forma}\\b`, 'g')
    for (const m of limpo.match(re) ?? []) achados.push(m.replace(/\s+/g, ''))
  }
  return achados
}

describe('⛔⛔⛔ nenhum leitor de PERÍODO consulta a conclusão crua', () => {
  it('⛔⛔⛔ listagem/total de conclusão só nasce DENTRO da porta', () => {
    const culpados: string[] = []
    for (const abs of arquivosDeProducao()) {
      const rel = abs.slice(RAIZ.length + 1)
      if (EXCECOES[rel]) continue
      const achados = listagensCruas(readFileSync(abs, 'utf8'))
      if (achados.length) culpados.push(`${rel} → ${achados.join(', ')}`)
    }
    expect(
      culpados,
      `consulta direta aos eventos de conclusão fora da porta — leia por ` +
        `\`conclusoesVigentes\` (ou nomeie a exceção com o motivo):\n${culpados.join('\n')}`,
    ).toEqual([])
  })

  /**
   * ⭐⭐ E O OUTRO LADO: a porta tem que estar SENDO USADA.
   *
   * ⛔ Guard que só proíbe o cru aprovaria o dia em que alguém trocasse o leitor por uma
   * segunda porta — *"nenhuma consulta crua"* é verdade também num mundo onde ninguém lê nada.
   */
  it('⭐⭐ os consumidores de período CHAMAM a porta', () => {
    const consumidores = [
      'lib/stock/producao/conclusao.ts',
      'lib/stock/producao/lotes.ts',
      'lib/stock/producao/painel-producao.ts',
      'lib/stock/producao/relatorio-por-dia.ts',
      'lib/stock/producao/relatorio-por-pessoa.ts',
      'lib/stock/producao/execucoes.ts',
      'lib/stock/producao/fiscal-dos-lotes.ts',
      'lib/stock/producao/dia-ao-vivo.ts',
      'lib/stock/producao/fila-de-conferencia.ts',
      'lib/stock/producao/producao-invariants.ts',
      'lib/avisos/produtores/producao.ts',
      'lib/equipe/inativar-colaborador.ts',
    ]
    const mudos: string[] = []
    for (const rel of consumidores) {
      const src = readFileSync(join(RAIZ, rel), 'utf8')
      if (usosDe(src, 'conclusoesVigentes') < 1) mudos.push(rel)
    }
    expect(mudos, `estes deveriam ler pela porta e não leem: ${mudos.join(', ')}`).toEqual([])
  })

  /**
   * ⭐ E a etiqueta/conferência, que leem a linha POR ID, têm que perguntar se ela ainda vale —
   * é o que impede a etiqueta de colar no freezer o número que o gerente corrigiu.
   */
  it('⭐ quem lê a linha por ID pergunta se ela foi corrigida', () => {
    for (const rel of ['lib/stock/producao/etiqueta.ts', 'lib/stock/producao/conferencia.ts']) {
      const src = readFileSync(join(RAIZ, rel), 'utf8')
      expect(usosDe(src, 'conclusaoEstaEstornada'), rel).toBeGreaterThanOrEqual(1)
    }
  })
})

/**
 * ⚠️⚠️ AUTO-TESTE DO DETECTOR (REGRA 11) — sem ele o guard passaria por CEGUEIRA, que é como
 * três guards desta casa nasceram verdes.
 */
describe('⚠️ o detector pega o padrão e não morde o legítimo', () => {
  it('pega a listagem crua (a forma do defeito de 12/10)', () => {
    expect(listagensCruas(`const cs = await db.stockProducaoConclusao.findMany({ where: { companyId } })`)).toHaveLength(1)
    expect(listagensCruas(`const n = await db.stockProducaoConclusao.count({ where: {} })`)).toHaveLength(1)
    expect(listagensCruas(`await db.stockProducaoConclusao.aggregate({ _sum: { custoLoteReal: true } })`)).toHaveLength(1)
    /** ⚠️ com espaço no meio — o minificador não entra aqui, mas o prettier entra */
    expect(listagensCruas(`db.stockProducaoConclusao\n  .findMany({})`)).toHaveLength(1)
  })

  it('NÃO morde leitura por id, create, nem a porta sendo chamada', () => {
    expect(listagensCruas(`await db.stockProducaoConclusao.findFirst({ where: { id } })`)).toEqual([])
    expect(listagensCruas(`await db.stockProducaoConclusao.create({ data })`)).toEqual([])
    expect(listagensCruas(`const cs = await conclusoesVigentes(companyId, { de, ate }, db)`)).toEqual([])
  })

  it('⛔ e não se deixa absolver por COMENTÁRIO (a cicatriz do "menção, não uso")', () => {
    expect(listagensCruas(`// antes era db.stockProducaoConclusao.findMany({})`)).toEqual([])
    expect(listagensCruas(`/* o aggregate cru: db.stockProducaoConclusao.aggregate({}) */`)).toEqual([])
  })
})
